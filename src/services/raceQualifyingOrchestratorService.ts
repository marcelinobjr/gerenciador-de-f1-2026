/**
 * src/services/raceQualifyingOrchestratorService.ts
 *
 * Orquestrador canônico do fluxo de classificação (RACE-QUALI-01A1: SOMENTE Q1).
 *
 * Microentrega focada:
 * READY_FOR_Q1 → Q1 → Q1_COMPLETE → READY_FOR_Q2
 *
 * CONTRATO E INVARIANTES:
 * 1. Usa pureRaceEngine.ts (calculateQualifyingAttemptTime, etc.) como motor matemático único.
 * 2. Consome o setup final já persistido pelos TLs (racePracticeSetupService).
 * 3. Fixture RF07: setup = 90.2275; bônus = 225.56875000000002 ms aplicado exatamente UMA vez por tentativa.
 * 4. RNG determinístico canônico Mulberry32 + Box-Muller com semente baseada em:
 *    careerId + seasonId + round + Q1 + entry/car + attempt. Zero Math.random().
 * 5. Participantes reais da rodada/save (sem hardcode de Audi ou pilotos). Fixture canônica = 24 inscritos.
 * 6. Corte canônico: 24 participantes → 18 classificados avançam para READY_FOR_Q2; 6 eliminados fixados em P19-P24.
 * 7. Posições únicas: política determinística de desempate por tempo e identificador estável.
 * 8. Persistência canônica resiliente em session_setups (PocketBase) e cache local.
 * 9. Idempotência estrita: reabrir ou reexecutar Q1 devolve os mesmos tempos/posições sem novo RNG.
 * 10. Ordem estrita: só inicia se o estado for equivalente a READY_FOR_Q1 (TL3 concluído em fim de semana normal).
 *     Tentativa fora de ordem não altera estado, não gera tempos nem gasta sorteios.
 * 11. Isolamento estrito entre carreiras e rodadas.
 * 12. NÃO executa Q2/Q3/corrida/grid final nesta microentrega.
 */

import pb from '@/lib/pocketbase/client'
import { loadVersionedRaceConfig, RaceConfigLoadError } from '@/lib/race/loader'
import type { VersionedRaceConfig } from '@/lib/race/types'
import {
  calculateQualifyingAttemptTime,
  calculateEffectiveQualifyingDriver,
  calculateTrackQualifyingRating,
  DEFAULT_SOURCE_RACE_PARAMETERS,
} from '@/lib/race/pureRaceEngine'
import { racePracticeSetupService } from '@/services/racePracticeSetupService'

export type QualifyingPhaseStatus = 'READY_FOR_Q1' | 'Q1' | 'Q1_COMPLETE' | 'READY_FOR_Q2'

export interface Q1DriverInput {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  carIndex?: 1 | 2
  carPerformance: number // 0-100 base do carro
  speed: number // 0-100
  qualifying: number // 0-100
  form?: number // default 50
  morale?: number // default 50
  wet_skill?: number // default 50
  setup?: number // Acerto vindo dos TLs (ex: 90.2275). Se omitido, busca da persistência
}

export interface Q1LapAttempt {
  attemptNumber: number
  normalDrawZ: number
  timeMs: number
  bonusMs: number
  formattedTime: string
}

export interface Q1ParticipantResult {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  carIndex: 1 | 2
  setup: number
  effectiveDriver: number
  trackRating: number
  basePaceMs: number
  bonusMs: number
  bestTimeMs: number
  formattedBestTime: string
  attempts: Q1LapAttempt[]
  position: number // 1..N
  isClassified: boolean // true = avança para Q2 (top 18 em 24)
  isEliminated: boolean // true = eliminado no Q1 (P19-P24 em 24)
}

export interface Q1ExecutionState {
  careerId: string
  seasonId: string
  round: number
  configVersion: string
  configSha256?: string
  status: QualifyingPhaseStatus
  isCompleted: boolean
  totalParticipants: number
  advancingCount: number
  eliminatedCount: number
  results: Q1ParticipantResult[]
  classifiedDriverIds: string[]
  eliminatedDriverIds: string[]
  trackRecordMs: number
  createdAt: string
  updatedAt: string
}

export interface ExecuteQ1Params {
  careerId: string
  seasonId: string
  round: number
  configVersion?: string
  participants: Q1DriverInput[]
  trackRecordMs?: number
  driverWeight?: number
  wet?: boolean
  forceBypassPracticeCheck?: boolean // Somente para testes sintéticos isolados de Q1
}

/**
 * PRNG Determinístico Mulberry32
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Hash determinístico de string para uint32 (FNV-1a)
 */
function hashStringToUint32(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Box-Muller determinístico usando o PRNG
 */
function getStandardNormal(rng: () => number): number {
  let u1 = rng()
  let u2 = rng()
  while (u1 <= 1e-15) {
    u1 = rng()
  }
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
}

/**
 * Converte milissegundos para string mm:ss.sss
 */
export function formatLapTimeMs(ms: number | undefined): string {
  if (ms === undefined || isNaN(ms) || ms <= 0) return '-:--.---'
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const secStr = seconds.toFixed(3).padStart(6, '0')
  return `${minutes}:${secStr}`
}

export function buildQ1StorageKey(careerId: string, seasonId: string, round: number): string {
  return `apex_q1_state_${careerId}_${seasonId}_r${round}`
}

export class RaceQualifyingOrchestratorService {
  private inMemoryCache: Map<string, Q1ExecutionState> = new Map()

  /**
   * Resolve a regra de corte de classificados/eliminados baseada no número de participantes.
   * Regra oficial FIA / Especificação:
   * 24 carros -> 18 classificados, 6 eliminados.
   * 22 carros -> 16 classificados, 6 eliminados.
   * 20 carros -> 15 classificados, 5 eliminados.
   */
  public resolveCutoffRules(totalParticipants: number): {
    advancingCount: number
    eliminatedCount: number
  } {
    if (totalParticipants === 24) {
      return { advancingCount: 18, eliminatedCount: 6 }
    }
    if (totalParticipants === 22) {
      return { advancingCount: 16, eliminatedCount: 6 }
    }
    if (totalParticipants === 20) {
      return { advancingCount: 15, eliminatedCount: 5 }
    }
    // Proporcional determinístico caso grid difira
    const eliminated = Math.max(1, Math.floor(totalParticipants * 0.25))
    return {
      advancingCount: totalParticipants - eliminated,
      eliminatedCount: eliminated,
    }
  }

  /**
   * Executa a fase Q1 de forma determinística, idempotente e estrita.
   * Transição: READY_FOR_Q1 → Q1 → Q1_COMPLETE → READY_FOR_Q2.
   */
  public async executeQ1(params: ExecuteQ1Params): Promise<Q1ExecutionState> {
    const {
      careerId,
      seasonId,
      round,
      configVersion = 'v1',
      participants,
      trackRecordMs = 80000,
      driverWeight = 0.35,
      wet = false,
      forceBypassPracticeCheck = false,
    } = params

    if (!careerId || !seasonId || round <= 0) {
      throw new Error(
        `Contexto de carreira/temporada inválido: careerId='${careerId}', seasonId='${seasonId}', round=${round}`,
      )
    }

    if (!participants || participants.length === 0) {
      throw new Error('Nenhum participante informado para o Q1.')
    }

    const storageKey = buildQ1StorageKey(careerId, seasonId, round)

    // 1. CHECAGEM DE IDEMPOTÊNCIA / PERSISTÊNCIA PRÉVIA
    // Se Q1 já foi executado e persistido para este contexto, retorna imediatamente
    // sem gerar novos sorteios nem recalcular tempos.
    const existingState = await this.loadPersistedQ1State(careerId, seasonId, round)
    if (existingState && (existingState.isCompleted || existingState.status === 'READY_FOR_Q2')) {
      this.inMemoryCache.set(storageKey, existingState)
      return existingState
    }

    // 2. VALIDAÇÃO DE ORDEM (Q1 só inicia se estado anterior for READY_FOR_Q1)
    if (!forceBypassPracticeCheck) {
      // Verifica se os treinos livres foram concluídos para os carros participantes
      const checkTeams = Array.from(new Set(participants.map((p) => p.teamId)))
      for (const tId of checkTeams) {
        const weekendState = await racePracticeSetupService.getWeekendNormalState({
          careerId,
          seasonId,
          round,
          teamId: tId,
          cars: [1, 2],
        })
        if (weekendState.status !== 'READY_FOR_Q1') {
          throw new Error(
            `Ordem de sessões violada: Q1 só pode ser iniciado a partir do estado READY_FOR_Q1 (TL3 concluído). Estado atual da equipe '${tId}': '${weekendState.status}'.`,
          )
        }
      }
    }

    // 3. CARREGAR CONFIGURAÇÃO VERSIONADA
    let loadedConfig: VersionedRaceConfig | null = null
    try {
      loadedConfig = await loadVersionedRaceConfig(configVersion)
    } catch {
      // Usa fallback com parâmetros default caso config versionada não esteja semeada no PB
    }
    const raceParams = loadedConfig?.parameters ?? DEFAULT_SOURCE_RACE_PARAMETERS

    // 4. GARANTIR UNICIDADE DOS PARTICIPANTES
    // Nenhum piloto ou vaga duplicada
    const seenDrivers = new Set<string>()
    const uniqueParticipants: Q1DriverInput[] = []
    for (const p of participants) {
      if (!seenDrivers.has(p.driverId)) {
        seenDrivers.add(p.driverId)
        uniqueParticipants.push(p)
      }
    }

    const { advancingCount, eliminatedCount } = this.resolveCutoffRules(uniqueParticipants.length)

    // 5. PROCESSAMENTO DE CADA PARTICIPANTE (2 TENTATIVAS DETERMINÍSTICAS NO Q1)
    const results: Q1ParticipantResult[] = []

    for (let pIdx = 0; pIdx < uniqueParticipants.length; pIdx++) {
      const p = uniqueParticipants[pIdx]
      const carIdx: 1 | 2 = p.carIndex ?? ((pIdx % 2) + 1 === 1 ? 1 : 2)

      // Recupera o setup final acumulado dos TLs se não foi passado explicitamente
      let finalSetup = p.setup
      if (finalSetup === undefined) {
        try {
          const carSetupState = await racePracticeSetupService.getCarAccumulatedSetup({
            careerId,
            seasonId,
            round,
            teamId: p.teamId,
            carIndex: carIdx,
          })
          finalSetup = carSetupState.accumulatedSetup
        } catch {
          finalSetup = 0
        }
      }

      // Calcula piloto efetivo via função pura
      const { effective_driver } = calculateEffectiveQualifyingDriver(
        {
          speed: p.speed,
          qualifying: p.qualifying,
          form: p.form ?? 50,
          morale: p.morale ?? 50,
          wet_skill: p.wet_skill ?? 50,
          wet,
        },
        raceParams,
      )

      // Calcula rating de classificação ponderado
      const { rating } = calculateTrackQualifyingRating({
        car: p.carPerformance,
        effective_driver,
        driver_weight: driverWeight,
      })

      // Base pace em ms (record + delta por ponto de rating)
      const ratingGap = (100 - Math.min(100, Math.max(0, rating))) * 35
      const basePaceMs = trackRecordMs + ratingGap

      // Duas tentativas oficiais no Q1
      const attempts: Q1LapAttempt[] = []
      let bestTimeMs = Infinity
      let appliedBonusMs = 0

      for (let attNum = 1; attNum <= 2; attNum++) {
        // Identidade da tentativa no RNG: career + season + round + Q1 + entry/car + attempt
        const seedIdentity = `${careerId}:${seasonId}:r${round}:Q1:${p.teamId}_c${carIdx}_${p.driverId}:att${attNum}`
        const seedUint = hashStringToUint32(seedIdentity)
        const rng = mulberry32(seedUint)
        const z = getStandardNormal(rng)

        // Aplicação EXATA do motor puro oficial (pureRaceEngine.ts)
        const calc = calculateQualifyingAttemptTime(
          {
            base_pace_ms: basePaceMs,
            setup: finalSetup,
            normal_standard_draw_z: z,
            sigma_ms: raceParams.qualifying_noise_sd_ms,
          },
          raceParams,
        )

        appliedBonusMs = calc.bonus_ms
        attempts.push({
          attemptNumber: attNum,
          normalDrawZ: z,
          timeMs: calc.time_ms,
          bonusMs: calc.bonus_ms,
          formattedTime: formatLapTimeMs(calc.time_ms),
        })

        if (calc.time_ms < bestTimeMs) {
          bestTimeMs = calc.time_ms
        }
      }

      results.push({
        driverId: p.driverId,
        driverName: p.driverName,
        teamId: p.teamId,
        teamName: p.teamName,
        carIndex: carIdx,
        setup: finalSetup,
        effectiveDriver: effective_driver,
        trackRating: rating,
        basePaceMs,
        bonusMs: appliedBonusMs,
        bestTimeMs,
        formattedBestTime: formatLapTimeMs(bestTimeMs),
        attempts,
        position: 0,
        isClassified: false,
        isEliminated: false,
      })
    }

    // 6. ORDENAÇÃO E DESEMPATE DETERMINÍSTICO
    // Menor tempo vence. Em caso de empate idêntico em ms: desempate por driverId lexicográfico estável.
    results.sort((a, b) => {
      if (a.bestTimeMs !== b.bestTimeMs) {
        return a.bestTimeMs - b.bestTimeMs
      }
      return a.driverId.localeCompare(b.driverId)
    })

    // Atribuição de posições 1..N únicas
    results.forEach((r, idx) => {
      r.position = idx + 1
      if (idx < advancingCount) {
        r.isClassified = true
        r.isEliminated = false
      } else {
        r.isClassified = false
        r.isEliminated = true
      }
    })

    const classifiedDriverIds = results.filter((r) => r.isClassified).map((r) => r.driverId)
    const eliminatedDriverIds = results.filter((r) => r.isEliminated).map((r) => r.driverId)

    const finalState: Q1ExecutionState = {
      careerId,
      seasonId,
      round,
      configVersion: loadedConfig?.version ?? configVersion,
      configSha256: loadedConfig?.sha256,
      status: 'READY_FOR_Q2',
      isCompleted: true,
      totalParticipants: uniqueParticipants.length,
      advancingCount,
      eliminatedCount,
      results,
      classifiedDriverIds,
      eliminatedDriverIds,
      trackRecordMs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 7. PERSISTÊNCIA CANÔNICA (PocketBase + Cache Local)
    await this.persistQ1State(finalState)
    this.inMemoryCache.set(storageKey, finalState)

    return finalState
  }

  /**
   * Consulta o estado salvo de Q1.
   */
  public async loadPersistedQ1State(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<Q1ExecutionState | null> {
    const storageKey = buildQ1StorageKey(careerId, seasonId, round)

    // 1. Memória rápida
    if (this.inMemoryCache.has(storageKey)) {
      return this.inMemoryCache.get(storageKey)!
    }

    // 2. PocketBase session_setups com session = 'q1'
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "q1"`,
      })
      if (records.items.length > 0) {
        const item = records.items[0]
        const strategies = (item.driver_strategies as any) || {}
        if (strategies.q1State) {
          const loaded = strategies.q1State as Q1ExecutionState
          this.inMemoryCache.set(storageKey, loaded)
          return loaded
        }
      }
    } catch {
      // Ignora erro de PB e tenta cache local
    }

    // 3. Fallback no Cache Local (localStorage)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          const parsed = JSON.parse(raw) as Q1ExecutionState
          this.inMemoryCache.set(storageKey, parsed)
          return parsed
        }
      } catch {
        // ignore
      }
    }

    return null
  }

  /**
   * Grava o estado de Q1 de forma resiliente.
   */
  private async persistQ1State(state: Q1ExecutionState): Promise<void> {
    const { careerId, seasonId, round } = state
    const storageKey = buildQ1StorageKey(careerId, seasonId, round)

    // 1. Gravação no PocketBase
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "q1"`,
      })

      if (records.items.length > 0) {
        const existing = records.items[0]
        const strategies = (existing.driver_strategies as any) || {}
        strategies.q1State = state
        await pb.collection('session_setups').update(existing.id, {
          driver_strategies: strategies,
          notes: JSON.stringify({ phase: 'READY_FOR_Q2', completed: true }),
        })
      } else {
        await pb.collection('session_setups').create({
          team_id: careerId,
          season_id: seasonId,
          round,
          session: 'q1',
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            q1State: state,
          },
          notes: JSON.stringify({ phase: 'READY_FOR_Q2', completed: true }),
        })
      }
    } catch (err) {
      console.warn(`[RaceQualifyingOrchestratorService] Erro ao persistir Q1 no PocketBase:`, err)
    }

    // 2. Gravação no Cache Local
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state))
      } catch {
        // ignore
      }
    }
  }

  /**
   * Limpa o estado em memória (utilitário de teste).
   */
  public clearMemoryCache(): void {
    this.inMemoryCache.clear()
  }
}

export const raceQualifyingOrchestratorService = new RaceQualifyingOrchestratorService()
export default raceQualifyingOrchestratorService
