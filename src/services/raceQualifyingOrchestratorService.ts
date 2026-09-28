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

export type QualifyingPhase = 'Q1' | 'Q2' | 'Q3'

export type QualifyingPhaseStatus =
  | 'READY_FOR_Q1'
  | 'Q1'
  | 'Q1_COMPLETE'
  | 'READY_FOR_Q2'
  | 'Q2'
  | 'Q2_COMPLETE'
  | 'READY_FOR_Q3'
  | 'Q3'
  | 'Q3_COMPLETE'
  | 'QUALIFYING_COMPLETE'
  | 'QUALIFYING_RESULT_READY'
  | 'STARTING_GRID_READY'
  | 'GRID_READY'

export interface QualifyingDriverInput {
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

// Aliases para compatibilidade reversa com Q1
export type Q1DriverInput = QualifyingDriverInput

export interface QualifyingLapAttempt {
  attemptNumber: number
  normalDrawZ: number
  timeMs: number
  bonusMs: number
  formattedTime: string
}

export type Q1LapAttempt = QualifyingLapAttempt

export interface QualifyingParticipantResult {
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
  attempts: QualifyingLapAttempt[]
  position: number // 1..N dentro da fase
  isClassified: boolean // true = avança para a próxima fase (ou Q3 finalizado no top)
  isEliminated: boolean // true = eliminado nesta fase
}

export type Q1ParticipantResult = QualifyingParticipantResult

export interface QualifyingPhaseExecutionState {
  phase: QualifyingPhase
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
  results: QualifyingParticipantResult[]
  classifiedDriverIds: string[]
  eliminatedDriverIds: string[]
  trackRecordMs: number
  createdAt: string
  updatedAt: string
}

// Aliases para compatibilidade reversa com Q1
export type Q1ExecutionState = QualifyingPhaseExecutionState

export interface GlobalQualifyingResultEntry {
  position: number // P1..P24
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  carIndex: 1 | 2
  eliminationPhase: 'Q1' | 'Q2' | 'Q3'
  phaseBestTimeMs: number
  formattedPhaseBestTime: string
  setup: number
  q1BestTimeMs?: number
  q2BestTimeMs?: number
  q3BestTimeMs?: number
}

export interface GlobalQualifyingResultState {
  careerId: string
  seasonId: string
  round: number
  configVersion: string
  configSha256?: string
  status: 'QUALIFYING_RESULT_READY'
  totalParticipants: number
  results: GlobalQualifyingResultEntry[]
  poleDriverId: string
  poleDriverName: string
  poleTimeMs: number
  formattedPoleTime: string
  createdAt: string
  updatedAt: string
}

export interface GridPenaltyApplied {
  id?: string
  unitIndex?: number
  positions: number
  reason: string
  appliedAt?: string
  source?: string
}

export interface StartingGridEntry {
  gridPosition: number // P1..P24 efetivo de largada
  qualifyingPosition: number // P1..P24 classificação pura imutável
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  carIndex: 1 | 2
  eliminationPhase: 'Q1' | 'Q2' | 'Q3'
  qualifyingTimeMs: number
  formattedQualifyingTime: string
  setup: number
  penalties: GridPenaltyApplied[]
  totalPenaltyPositions: number
  hasPenalty: boolean
  penaltyReason?: string
}

export interface StartingGridState {
  careerId: string
  seasonId: string
  round: number
  configVersion: string
  configSha256?: string
  status: 'STARTING_GRID_READY' | 'GRID_READY'
  totalParticipants: number
  grid: StartingGridEntry[]
  poleDriverId: string
  poleDriverName: string
  createdAt: string
  updatedAt: string
}

export interface BuildStartingGridParams {
  careerId: string
  seasonId: string
  round: number
  penaltiesByTeamId?: Record<string, GridPenaltyApplied[]>
  penaltiesByDriverId?: Record<string, GridPenaltyApplied[]>
}

export interface ExecuteQ1Params {
  careerId: string
  seasonId: string
  round: number
  configVersion?: string
  participants: QualifyingDriverInput[]
  trackRecordMs?: number
  driverWeight?: number
  wet?: boolean
  forceBypassPracticeCheck?: boolean // Somente para testes sintéticos isolados de Q1
}

export interface ExecuteQualifyingPhaseParams {
  phase: QualifyingPhase
  careerId: string
  seasonId: string
  round: number
  configVersion?: string
  participants?: QualifyingDriverInput[] // Obrigatório no Q1; em Q2 e Q3 herdado automaticamente do resultado persistido
  trackRecordMs?: number
  driverWeight?: number
  wet?: boolean
  forceBypassPracticeCheck?: boolean
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

export function buildQualifyingStorageKey(
  phase: QualifyingPhase,
  careerId: string,
  seasonId: string,
  round: number,
): string {
  const p = phase.toLowerCase()
  return `apex_${p}_state_${careerId}_${seasonId}_r${round}`
}

export function buildQ1StorageKey(careerId: string, seasonId: string, round: number): string {
  return buildQualifyingStorageKey('Q1', careerId, seasonId, round)
}

export function buildQ2StorageKey(careerId: string, seasonId: string, round: number): string {
  return buildQualifyingStorageKey('Q2', careerId, seasonId, round)
}

export function buildQ3StorageKey(careerId: string, seasonId: string, round: number): string {
  return buildQualifyingStorageKey('Q3', careerId, seasonId, round)
}

export function buildGlobalQualifyingStorageKey(
  careerId: string,
  seasonId: string,
  round: number,
): string {
  return `apex_qualifying_result_state_${careerId}_${seasonId}_r${round}`
}

export function buildStartingGridStorageKey(
  careerId: string,
  seasonId: string,
  round: number,
): string {
  return `apex_starting_grid_state_${careerId}_${seasonId}_r${round}`
}

export class RaceQualifyingOrchestratorService {
  private inMemoryCache: Map<string, QualifyingPhaseExecutionState> = new Map()

  /**
   * Resolve a regra de corte de classificados/eliminados baseada na fase e no número de participantes.
   * Regra oficial FIA / Especificação:
   * Q1:
   *   24 carros -> 18 classificados, 6 eliminados.
   *   22 carros -> 16 classificados, 6 eliminados.
   *   20 carros -> 15 classificados, 5 eliminados.
   * Q2:
   *   18 carros -> 10 classificados, 8 eliminados.
   *   16 carros -> 10 classificados, 6 eliminados.
   *   15 carros -> 10 classificados, 5 eliminados.
   *   Geral: Top 10 avança para o Q3.
   * Q3:
   *   10 carros -> 10 classificados (P1..P10), 0 eliminados.
   */
  public resolveCutoffRules(
    totalParticipants: number,
    phase: QualifyingPhase = 'Q1',
  ): {
    advancingCount: number
    eliminatedCount: number
  } {
    if (phase === 'Q3') {
      return {
        advancingCount: totalParticipants,
        eliminatedCount: 0,
      }
    }

    if (phase === 'Q2') {
      const advancingCount = Math.min(10, totalParticipants)
      const eliminatedCount = Math.max(0, totalParticipants - advancingCount)
      return { advancingCount, eliminatedCount }
    }

    // Q1
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
  public async executeQ1(params: ExecuteQ1Params): Promise<QualifyingPhaseExecutionState> {
    return this.executeQualifyingPhase({
      ...params,
      phase: 'Q1',
    })
  }

  /**
   * Executa a fase Q2 de forma determinística, idempotente e estrita.
   * Recebe EXATAMENTE os classificados persistidos do Q1 (18 na fixture canônica).
   * Transição: READY_FOR_Q2 → Q2 → Q2_COMPLETE → READY_FOR_Q3.
   */
  public async executeQ2(
    params: Omit<ExecuteQualifyingPhaseParams, 'phase'>,
  ): Promise<QualifyingPhaseExecutionState> {
    return this.executeQualifyingPhase({
      ...params,
      phase: 'Q2',
    })
  }

  /**
   * Executa a fase Q3 de forma determinística, idempotente e estrita.
   * Recebe EXATAMENTE os classificados persistidos do Q2 (10 na fixture canônica).
   * Transição: READY_FOR_Q3 → Q3 → Q3_COMPLETE → QUALIFYING_COMPLETE.
   */
  public async executeQ3(
    params: Omit<ExecuteQualifyingPhaseParams, 'phase'>,
  ): Promise<QualifyingPhaseExecutionState> {
    return this.executeQualifyingPhase({
      ...params,
      phase: 'Q3',
    })
  }

  /**
   * Executa qualquer fase de classificação (Q1 | Q2 | Q3) sob a mesma máquina matemática unificada.
   */
  public async executeQualifyingPhase(
    params: ExecuteQualifyingPhaseParams,
  ): Promise<QualifyingPhaseExecutionState> {
    const {
      phase,
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

    const storageKey = buildQualifyingStorageKey(phase, careerId, seasonId, round)

    // 1. CHECAGEM DE IDEMPOTÊNCIA / PERSISTÊNCIA PRÉVIA E RECUPERAÇÃO DE FALHA PARCIAL
    // Se a fase já foi executada (mesmo com falha na transição de status final),
    // recupera os tempos calculados sem gerar novos sorteios nem recalcular tempos.
    const existingState = await this.loadPersistedPhaseState(phase, careerId, seasonId, round)
    const completedStatus =
      phase === 'Q1' ? 'READY_FOR_Q2' : phase === 'Q2' ? 'READY_FOR_Q3' : 'QUALIFYING_COMPLETE'

    if (
      existingState &&
      (existingState.isCompleted ||
        existingState.status === completedStatus ||
        (existingState.results && existingState.results.length > 0))
    ) {
      // Se tem resultados calculados mas o status final ou isCompleted não foram finalizados (falha parcial):
      if (existingState.status !== completedStatus || !existingState.isCompleted) {
        existingState.status = completedStatus
        existingState.isCompleted = true
        await this.persistPhaseState(existingState)
      }
      this.inMemoryCache.set(storageKey, existingState)
      return existingState
    }

    // 2. VALIDAÇÃO DE ORDEM E RESOLUÇÃO DE PARTICIPANTES HERDADOS
    let effectiveParticipants: QualifyingDriverInput[] = []

    if (phase === 'Q1') {
      if (!participants || participants.length === 0) {
        throw new Error('Nenhum participante informado para o Q1.')
      }

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

      effectiveParticipants = participants
    } else if (phase === 'Q2') {
      // Q2 EXIGE Q1 CONCLUÍDO (READY_FOR_Q2)
      const q1State = await this.loadPersistedPhaseState('Q1', careerId, seasonId, round)
      if (!q1State || !q1State.isCompleted) {
        throw new Error(
          `Ordem de sessões violada: Q2 só pode ser iniciado após a conclusão do Q1 (READY_FOR_Q2). Q1 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
        )
      }

      // Herança esportiva estrita: os participantes de Q2 são EXATAMENTE os classificados de Q1
      const q1ClassifiedSet = new Set(q1State.classifiedDriverIds)
      const q1ClassifiedResults = q1State.results.filter((r) => q1ClassifiedSet.has(r.driverId))

      // Se o chamador forneceu metadata adicional de pilotos, mescla atributos mantendo setup e integridade
      const inputDriverMap = new Map((participants || []).map((p) => [p.driverId, p]))

      effectiveParticipants = q1ClassifiedResults.map((r) => {
        const extra = inputDriverMap.get(r.driverId)
        return {
          driverId: r.driverId,
          driverName: r.driverName,
          teamId: r.teamId,
          teamName: r.teamName,
          carIndex: r.carIndex,
          carPerformance: extra?.carPerformance ?? 80,
          speed: extra?.speed ?? 80,
          qualifying: extra?.qualifying ?? 80,
          form: extra?.form ?? 50,
          morale: extra?.morale ?? 50,
          wet_skill: extra?.wet_skill ?? 50,
          setup: r.setup, // Mantém exatamente o mesmo setup dos TLs consolidado no Q1
        }
      })
    } else if (phase === 'Q3') {
      // Q3 EXIGE Q2 CONCLUÍDO (READY_FOR_Q3)
      const q2State = await this.loadPersistedPhaseState('Q2', careerId, seasonId, round)
      if (!q2State || !q2State.isCompleted) {
        throw new Error(
          `Ordem de sessões violada: Q3 só pode ser iniciado após a conclusão do Q2 (READY_FOR_Q3). Q2 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
        )
      }

      // Herança esportiva estrita: os participantes de Q3 são EXATAMENTE os classificados de Q2
      const q2ClassifiedSet = new Set(q2State.classifiedDriverIds)
      const q2ClassifiedResults = q2State.results.filter((r) => q2ClassifiedSet.has(r.driverId))

      const inputDriverMap = new Map((participants || []).map((p) => [p.driverId, p]))

      effectiveParticipants = q2ClassifiedResults.map((r) => {
        const extra = inputDriverMap.get(r.driverId)
        return {
          driverId: r.driverId,
          driverName: r.driverName,
          teamId: r.teamId,
          teamName: r.teamName,
          carIndex: r.carIndex,
          carPerformance: extra?.carPerformance ?? 80,
          speed: extra?.speed ?? 80,
          qualifying: extra?.qualifying ?? 80,
          form: extra?.form ?? 50,
          morale: extra?.morale ?? 50,
          wet_skill: extra?.wet_skill ?? 50,
          setup: r.setup, // Mantém exatamente o mesmo setup dos TLs consolidado
        }
      })
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
    const seenDrivers = new Set<string>()
    const uniqueParticipants: QualifyingDriverInput[] = []
    for (const p of effectiveParticipants) {
      if (!seenDrivers.has(p.driverId)) {
        seenDrivers.add(p.driverId)
        uniqueParticipants.push(p)
      }
    }

    const { advancingCount, eliminatedCount } = this.resolveCutoffRules(
      uniqueParticipants.length,
      phase,
    )

    // 5. PROCESSAMENTO DE CADA PARTICIPANTE (2 TENTATIVAS DETERMINÍSTICAS POR FASE)
    const results: QualifyingParticipantResult[] = []

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

      // Duas tentativas oficiais por fase
      const attempts: QualifyingLapAttempt[] = []
      let bestTimeMs = Infinity
      let appliedBonusMs = 0

      for (let attNum = 1; attNum <= 2; attNum++) {
        // Identidade da tentativa no RNG: career + season + round + phase + entry/car + attempt
        // Garante namespaces distintos para Q1, Q2 e Q3
        const seedIdentity = `${careerId}:${seasonId}:r${round}:${phase}:${p.teamId}_c${carIdx}_${p.driverId}:att${attNum}`
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

    // Atribuição de posições 1..N únicas dentro da fase
    results.forEach((r, idx) => {
      r.position = idx + 1
      if (phase === 'Q3') {
        r.isClassified = true
        r.isEliminated = false
      } else if (idx < advancingCount) {
        r.isClassified = true
        r.isEliminated = false
      } else {
        r.isClassified = false
        r.isEliminated = true
      }
    })

    const classifiedDriverIds = results.filter((r) => r.isClassified).map((r) => r.driverId)
    const eliminatedDriverIds = results.filter((r) => r.isEliminated).map((r) => r.driverId)

    const nextStatus: QualifyingPhaseStatus =
      phase === 'Q1' ? 'READY_FOR_Q2' : phase === 'Q2' ? 'READY_FOR_Q3' : 'QUALIFYING_COMPLETE'

    const finalState: QualifyingPhaseExecutionState = {
      phase,
      careerId,
      seasonId,
      round,
      configVersion: loadedConfig?.version ?? configVersion,
      configSha256: loadedConfig?.sha256,
      status: nextStatus,
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
    await this.persistPhaseState(finalState)
    this.inMemoryCache.set(storageKey, finalState)

    return finalState
  }

  /**
   * Consulta o estado salvo de uma fase (Q1 | Q2 | Q3).
   */
  public async loadPersistedPhaseState(
    phase: QualifyingPhase,
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<QualifyingPhaseExecutionState | null> {
    const storageKey = buildQualifyingStorageKey(phase, careerId, seasonId, round)
    const sessionName = phase.toLowerCase()
    const stateProp = `${sessionName}State`

    // 1. Memória rápida
    if (this.inMemoryCache.has(storageKey)) {
      return this.inMemoryCache.get(storageKey)!
    }

    // 2. PocketBase session_setups com session = 'q1' | 'q2' | 'q3'
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "${sessionName}"`,
      })
      if (records.items.length > 0) {
        const item = records.items[0]
        const strategies = (item.driver_strategies as any) || {}
        if (strategies[stateProp]) {
          const loaded = strategies[stateProp] as QualifyingPhaseExecutionState
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
          const parsed = JSON.parse(raw) as QualifyingPhaseExecutionState
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
   * Alias de consulta para Q1 (compatibilidade com RACE-QUALI-01A1).
   */
  public async loadPersistedQ1State(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<QualifyingPhaseExecutionState | null> {
    return this.loadPersistedPhaseState('Q1', careerId, seasonId, round)
  }

  /**
   * Alias de consulta para Q2.
   */
  public async loadPersistedQ2State(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<QualifyingPhaseExecutionState | null> {
    return this.loadPersistedPhaseState('Q2', careerId, seasonId, round)
  }

  /**
   * Alias de consulta para Q3.
   */
  public async loadPersistedQ3State(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<QualifyingPhaseExecutionState | null> {
    return this.loadPersistedPhaseState('Q3', careerId, seasonId, round)
  }

  /**
   * Grava o estado de qualquer fase (Q1 | Q2 | Q3) de forma resiliente.
   */
  public async persistPhaseState(state: QualifyingPhaseExecutionState): Promise<void> {
    const { phase, careerId, seasonId, round, status } = state
    const storageKey = buildQualifyingStorageKey(phase, careerId, seasonId, round)
    const sessionName = phase.toLowerCase()
    const stateProp = `${sessionName}State`

    // 1. Gravação no PocketBase
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "${sessionName}"`,
      })

      if (records.items.length > 0) {
        const existing = records.items[0]
        const strategies = (existing.driver_strategies as any) || {}
        strategies[stateProp] = state
        await pb.collection('session_setups').update(existing.id, {
          driver_strategies: strategies,
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      } else {
        await pb.collection('session_setups').create({
          team_id: careerId,
          season_id: seasonId,
          round,
          session: sessionName,
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            [stateProp]: state,
          },
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      }
    } catch (err) {
      console.warn(
        `[RaceQualifyingOrchestratorService] Erro ao persistir ${phase} no PocketBase:`,
        err,
      )
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
   * Grava o estado de Q1 de forma resiliente (compatibilidade retroativa).
   */
  public async persistQ1State(state: QualifyingPhaseExecutionState): Promise<void> {
    return this.persistPhaseState({ ...state, phase: 'Q1' })
  }

  /**
   * Limpa o estado em memória (utilitário de teste).
   */
  /**
   * Constrói e persiste o resultado global da classificação (QUALIFYING_RESULT_READY)
   * a partir EXCLUSIVAMENTE dos resultados persistidos de Q1, Q2 e Q3.
   *
   * REGRAS ESPORTIVAS E INVARIANTES:
   * 1. Q3_COMPLETE → QUALIFYING_COMPLETE → QUALIFYING_RESULT_READY.
   * 2. P1–P10: ordem final do Q3.
   * 3. P11–P18: os 8 eliminados no Q2, ordenados exclusivamente pelo resultado persistido do Q2.
   * 4. P19–P24: os 6 eliminados no Q1, ordenados exclusivamente pelo resultado persistido do Q1.
   * 5. Precedência de fase: tempo de fase anterior NÃO reordena participantes de fase posterior.
   * 6. Bijeção estrita: exatamente uma ocorrência de cada participante original, posições contínuas P1..P24.
   *    Se houver duplicata, participante ausente ou desconhecido, lança erro explícito.
   * 7. Zero consumo de RNG, zero recálculo de tempos ou setup.
   * 8. Idempotência estrita: reexecutar devolve o mesmo artefato idêntico.
   */
  public async buildGlobalQualifyingResult(params: {
    careerId: string
    seasonId: string
    round: number
  }): Promise<GlobalQualifyingResultState> {
    const { careerId, seasonId, round } = params

    if (!careerId || !seasonId || round <= 0) {
      throw new Error(
        `Contexto de carreira/temporada inválido: careerId='${careerId}', seasonId='${seasonId}', round=${round}`,
      )
    }

    const storageKey = buildGlobalQualifyingStorageKey(careerId, seasonId, round)

    // 1. CHECAGEM DE IDEMPOTÊNCIA PRÉVIA
    const existing = await this.loadPersistedGlobalQualifyingResult(careerId, seasonId, round)
    if (existing && existing.status === 'QUALIFYING_RESULT_READY' && existing.results?.length > 0) {
      this.inMemoryCache.set(storageKey, existing as any)
      return existing
    }

    // 2. CARREGAR RESULTADOS PERSISTIDOS DE Q1, Q2 E Q3
    const q1State = await this.loadPersistedPhaseState('Q1', careerId, seasonId, round)
    if (!q1State || !q1State.isCompleted) {
      throw new Error(
        `Não é possível consolidar o resultado global da classificação: Q1 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
      )
    }

    const q2State = await this.loadPersistedPhaseState('Q2', careerId, seasonId, round)
    if (!q2State || !q2State.isCompleted) {
      throw new Error(
        `Não é possível consolidar o resultado global da classificação: Q2 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
      )
    }

    const q3State = await this.loadPersistedPhaseState('Q3', careerId, seasonId, round)
    if (!q3State || !q3State.isCompleted) {
      throw new Error(
        `Não é possível consolidar o resultado global da classificação: Q3 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
      )
    }

    // 3. MAPAS DE TEMPOS POR FASE (FATOS JÁ PERSISTIDOS)
    const q1Map = new Map(q1State.results.map((r) => [r.driverId, r]))
    const q2Map = new Map(q2State.results.map((r) => [r.driverId, r]))
    const q3Map = new Map(q3State.results.map((r) => [r.driverId, r]))

    // 4. BIJEÇÃO E CONFERÊNCIA RIGOROSA DE PARTICIPANTES ORIGINAIS
    // O conjunto de participantes originais são os 24 inscritos que largaram no Q1
    const originalParticipants = q1State.results
    const totalEntrants = originalParticipants.length
    if (totalEntrants === 0) {
      throw new Error('Nenhum participante encontrado no resultado persistido do Q1.')
    }

    const originalDriverIdsSet = new Set(originalParticipants.map((p) => p.driverId))
    if (originalDriverIdsSet.size !== totalEntrants) {
      throw new Error(
        `Violação de bijeção no Q1: participantes duplicados detectados (${totalEntrants} registros, ${originalDriverIdsSet.size} únicos).`,
      )
    }

    // 5. AGRUPAMENTO POR FASES
    // P1–P10: pilotos do Q3 (ordenados pela posição já persistida do Q3)
    const q3Ordered = [...q3State.results].sort((a, b) => a.position - b.position)

    // P11–P18: eliminados do Q2 (ordenados pela posição já persistida do Q2)
    const q2Eliminated = q2State.results
      .filter((r) => r.isEliminated || q2State.eliminatedDriverIds.includes(r.driverId))
      .sort((a, b) => a.position - b.position)

    // P19–P24: eliminados do Q1 (ordenados pela posição já persistida do Q1)
    const q1Eliminated = q1State.results
      .filter((r) => r.isEliminated || q1State.eliminatedDriverIds.includes(r.driverId))
      .sort((a, b) => a.position - b.position)

    // 6. VALIDAÇÕES EXPLÍCITAS DE INTEGRIDADE ANTES DA MONTAGEM
    const q3DriverIds = q3Ordered.map((r) => r.driverId)
    const q2ElimDriverIds = q2Eliminated.map((r) => r.driverId)
    const q1ElimDriverIds = q1Eliminated.map((r) => r.driverId)

    // Verificar se não há sobreposição de grupos
    for (const dId of q3DriverIds) {
      if (q2ElimDriverIds.includes(dId)) {
        throw new Error(
          `Violação de integridade esportiva: piloto '${dId}' classificado no Q3 consta também como eliminado no Q2.`,
        )
      }
      if (q1ElimDriverIds.includes(dId)) {
        throw new Error(
          `Violação de integridade esportiva: piloto '${dId}' classificado no Q3 consta também como eliminado no Q1.`,
        )
      }
    }
    for (const dId of q2ElimDriverIds) {
      if (q1ElimDriverIds.includes(dId)) {
        throw new Error(
          `Violação de integridade esportiva: piloto '${dId}' eliminado no Q2 consta também como eliminado no Q1.`,
        )
      }
    }

    // Verificar se todas as entradas pertencem ao conjunto original de participantes
    const candidateIds = [...q3DriverIds, ...q2ElimDriverIds, ...q1ElimDriverIds]
    for (const dId of candidateIds) {
      if (!originalDriverIdsSet.has(dId)) {
        throw new Error(
          `Violação de integridade esportiva: piloto desconhecido '${dId}' não estava nos participantes originais do Q1.`,
        )
      }
    }

    // Conferir bijeção exata: mesma quantidade e nenhum faltando
    if (candidateIds.length !== totalEntrants) {
      throw new Error(
        `Violação de bijeção na contagem: candidatos somam ${candidateIds.length}, esperado ${totalEntrants} participantes.`,
      )
    }

    const candidateSet = new Set(candidateIds)
    if (candidateSet.size !== totalEntrants) {
      throw new Error(
        `Violação de bijeção: piloto duplicado detectado na união das fases (${candidateIds.length} registros, ${candidateSet.size} únicos).`,
      )
    }

    for (const origId of originalDriverIdsSet) {
      if (!candidateSet.has(origId)) {
        throw new Error(
          `Violação de bijeção: participante original '${origId}' ausente na consolidação do resultado global.`,
        )
      }
    }

    // 7. COMPOSIÇÃO BIJETIVA DO RESULTADO GLOBAL (P1..P24)
    const globalEntries: GlobalQualifyingResultEntry[] = []
    let currentPosition = 1

    // P1–P10 (Q3)
    for (const r of q3Ordered) {
      const q1Data = q1Map.get(r.driverId)
      const q2Data = q2Map.get(r.driverId)
      globalEntries.push({
        position: currentPosition++,
        driverId: r.driverId,
        driverName: r.driverName,
        teamId: r.teamId,
        teamName: r.teamName,
        carIndex: r.carIndex,
        eliminationPhase: 'Q3',
        phaseBestTimeMs: r.bestTimeMs,
        formattedPhaseBestTime: r.formattedBestTime,
        setup: r.setup,
        q1BestTimeMs: q1Data?.bestTimeMs,
        q2BestTimeMs: q2Data?.bestTimeMs,
        q3BestTimeMs: r.bestTimeMs,
      })
    }

    // P11–P18 (Q2 eliminados)
    for (const r of q2Eliminated) {
      const q1Data = q1Map.get(r.driverId)
      globalEntries.push({
        position: currentPosition++,
        driverId: r.driverId,
        driverName: r.driverName,
        teamId: r.teamId,
        teamName: r.teamName,
        carIndex: r.carIndex,
        eliminationPhase: 'Q2',
        phaseBestTimeMs: r.bestTimeMs,
        formattedPhaseBestTime: r.formattedBestTime,
        setup: r.setup,
        q1BestTimeMs: q1Data?.bestTimeMs,
        q2BestTimeMs: r.bestTimeMs,
        q3BestTimeMs: undefined,
      })
    }

    // P19–P24 (Q1 eliminados)
    for (const r of q1Eliminated) {
      globalEntries.push({
        position: currentPosition++,
        driverId: r.driverId,
        driverName: r.driverName,
        teamId: r.teamId,
        teamName: r.teamName,
        carIndex: r.carIndex,
        eliminationPhase: 'Q1',
        phaseBestTimeMs: r.bestTimeMs,
        formattedPhaseBestTime: r.formattedBestTime,
        setup: r.setup,
        q1BestTimeMs: r.bestTimeMs,
        q2BestTimeMs: undefined,
        q3BestTimeMs: undefined,
      })
    }

    // Validação final de posições contínuas e únicas de 1 a N
    const finalPositions = globalEntries.map((e) => e.position)
    const expectedPositions = Array.from({ length: totalEntrants }, (_, i) => i + 1)
    if (JSON.stringify(finalPositions) !== JSON.stringify(expectedPositions)) {
      throw new Error(
        `Violação de bijeção de posições: posições geradas não são contínuas de 1 a ${totalEntrants}.`,
      )
    }

    const poleEntry = globalEntries[0]
    const globalState: GlobalQualifyingResultState = {
      careerId,
      seasonId,
      round,
      configVersion: q3State.configVersion || q1State.configVersion || 'v1',
      configSha256: q3State.configSha256 || q1State.configSha256,
      status: 'QUALIFYING_RESULT_READY',
      totalParticipants: totalEntrants,
      results: globalEntries,
      poleDriverId: poleEntry?.driverId || '',
      poleDriverName: poleEntry?.driverName || '',
      poleTimeMs: poleEntry?.phaseBestTimeMs || 0,
      formattedPoleTime: poleEntry?.formattedPhaseBestTime || '-:--.---',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 8. PERSISTÊNCIA CANÔNICA (PocketBase + Cache Local)
    await this.persistGlobalQualifyingResult(globalState)
    this.inMemoryCache.set(storageKey, globalState as any)

    return globalState
  }

  /**
   * Consulta o estado salvo do resultado global da classificação.
   */
  public async loadPersistedGlobalQualifyingResult(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<GlobalQualifyingResultState | null> {
    const storageKey = buildGlobalQualifyingStorageKey(careerId, seasonId, round)

    // 1. Memória rápida
    if (this.inMemoryCache.has(storageKey)) {
      return this.inMemoryCache.get(storageKey) as unknown as GlobalQualifyingResultState
    }

    // 2. PocketBase session_setups com session = 'q3'
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "q3"`,
      })
      if (records.items.length > 0) {
        const item = records.items[0]
        const strategies = (item.driver_strategies as any) || {}
        if (strategies.globalQualifyingResult) {
          const loaded = strategies.globalQualifyingResult as GlobalQualifyingResultState
          this.inMemoryCache.set(storageKey, loaded as any)
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
          const parsed = JSON.parse(raw) as GlobalQualifyingResultState
          this.inMemoryCache.set(storageKey, parsed as any)
          return parsed
        }
      } catch {
        // ignore
      }
    }

    return null
  }

  /**
   * Grava o estado do resultado global da classificação de forma resiliente.
   */
  public async persistGlobalQualifyingResult(state: GlobalQualifyingResultState): Promise<void> {
    const { careerId, seasonId, round, status } = state
    const storageKey = buildGlobalQualifyingStorageKey(careerId, seasonId, round)

    // 1. Gravação no PocketBase session_setups (session = 'q3')
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "q3"`,
      })

      if (records.items.length > 0) {
        const existing = records.items[0]
        const strategies = (existing.driver_strategies as any) || {}
        strategies.globalQualifyingResult = state
        await pb.collection('session_setups').update(existing.id, {
          driver_strategies: strategies,
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      } else {
        await pb.collection('session_setups').create({
          team_id: careerId,
          season_id: seasonId,
          round,
          session: 'q3',
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            globalQualifyingResult: state,
          },
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      }
    } catch (err) {
      console.warn(
        `[RaceQualifyingOrchestratorService] Erro ao persistir resultado global no PocketBase:`,
        err,
      )
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
   * Constrói e persiste o STARTING_GRID (transição para GRID_READY) a partir de:
   * 1. QUALIFYING_RESULT imutável (fato esportivo P1..P24).
   * 2. Penalidades regulamentares existentes (PU5 = +10, PU6+ = +5 em teams.grid_penalties / f1Service).
   *
   * POLÍTICA DETERMINÍSTICA E REGRAS:
   * - qualifyingPosition permanece estritamente IMUTÁVEL.
   * - gridPosition é calculada pelo mecanismo canônico de ordenação provisória (pos + penalidade) e desempate determinístico.
   * - Bijeção: 24 participantes -> P1..P24 contínuos, sem duplicados, sem ausentes.
   * - Idempotência: reexecução com o grid já persistido retorna o grid existente sem reaplicar penalidades.
   * - Falha parcial: se o grid já foi calculado mas o status final GRID_READY não foi concluído, finaliza sem recalcular.
   */
  public async buildStartingGrid(params: BuildStartingGridParams): Promise<StartingGridState> {
    const { careerId, seasonId, round, penaltiesByTeamId = {}, penaltiesByDriverId = {} } = params

    if (!careerId || !seasonId || round <= 0) {
      throw new Error(
        `Contexto de carreira/temporada inválido: careerId='${careerId}', seasonId='${seasonId}', round=${round}`,
      )
    }

    const storageKey = buildStartingGridStorageKey(careerId, seasonId, round)

    // 1. CHECAGEM DE IDEMPOTÊNCIA E RECUPERAÇÃO DE FALHA PARCIAL
    const existing = await this.loadPersistedStartingGrid(careerId, seasonId, round)
    if (existing && existing.grid?.length > 0) {
      if (existing.status !== 'GRID_READY') {
        // Falha parcial: completa a transição para GRID_READY sem recalcular posições ou penalidades
        existing.status = 'GRID_READY'
        existing.updatedAt = new Date().toISOString()
        await this.persistStartingGrid(existing)
      }
      this.inMemoryCache.set(storageKey, existing as any)
      return existing
    }

    // 2. RECUPERA QUALIFYING_RESULT (OU CONSTRÓI CASO AINDA NÃO PERSISTIDO)
    let globalQuali = await this.loadPersistedGlobalQualifyingResult(careerId, seasonId, round)
    if (!globalQuali || globalQuali.status !== 'QUALIFYING_RESULT_READY') {
      globalQuali = await this.buildGlobalQualifyingResult({ careerId, seasonId, round })
    }

    const qualifyingEntries = globalQuali.results
    const totalEntrants = qualifyingEntries.length
    if (totalEntrants === 0) {
      throw new Error('QUALIFYING_RESULT vazio: impossível formar o grid de largada.')
    }

    // 3. RECUPERAR PENALIDADES APLICÁVEIS
    // Busca do PocketBase / parâmetros passados
    let teamPenaltiesMap = { ...penaltiesByTeamId }
    try {
      const teams = await pb.collection('teams').getFullList({
        filter: `user_id = "${careerId}"`,
      })
      teams.forEach((t) => {
        if (Array.isArray(t.grid_penalties) && t.grid_penalties.length > 0) {
          teamPenaltiesMap[t.id] = (teamPenaltiesMap[t.id] || []).concat(t.grid_penalties)
          if (t.team_key) {
            teamPenaltiesMap[t.team_key] = (teamPenaltiesMap[t.team_key] || []).concat(
              t.grid_penalties,
            )
          }
        }
      })
    } catch {
      // Ignora erro se estiver em ambiente simulado ou offline
    }

    // 4. MAPEAR PENALIDADES PARA CADA ENTRANTE (SEM DUPLICAR)
    // Piloto penalizado perde posições definidas pelas unidades de potência excedentes
    interface ProvisionalGridItem {
      entry: GlobalQualifyingResultEntry
      qualifyingPosition: number
      targetPos: number
      penalties: GridPenaltyApplied[]
      totalPenaltyPositions: number
    }

    const provisionalItems: ProvisionalGridItem[] = qualifyingEntries.map((entry) => {
      const driverPenalties = penaltiesByDriverId[entry.driverId] || []
      const teamPens =
        penaltiesByTeamId?.[entry.teamId] ||
        penaltiesByTeamId?.[entry.teamId.replace('team_', '')] ||
        teamPenaltiesMap[entry.teamId] ||
        teamPenaltiesMap[entry.teamId.replace('team_', '')] ||
        []

      // As penalidades específicas do piloto têm precedência ou combinam-se com penalidades da equipe atribuídas a esta entrada/carro
      const combinedPenalties: GridPenaltyApplied[] = [...driverPenalties]
      for (const tp of teamPens) {
        // Se a penalidade da equipe especificar driverId ou carIndex, aplica apenas se for compatível
        const penaltyMatchesDriver = (tp as any).driverId
          ? (tp as any).driverId === entry.driverId
          : true
        const penaltyMatchesCar = (tp as any).carIndex
          ? (tp as any).carIndex === entry.carIndex
          : true

        if (penaltyMatchesDriver && penaltyMatchesCar) {
          // Evita duplicata por id
          if (!combinedPenalties.some((p) => p.id && tp.id && p.id === tp.id)) {
            combinedPenalties.push({
              ...tp,
              source: tp.source || 'PU_QUOTA_REGULATION',
            })
          }
        }
      }

      const totalPenaltyPositions = combinedPenalties.reduce(
        (sum, p) => sum + (Math.max(0, p.positions) || 0),
        0,
      )

      return {
        entry,
        qualifyingPosition: entry.position,
        targetPos: entry.position + totalPenaltyPositions,
        penalties: combinedPenalties,
        totalPenaltyPositions,
      }
    })

    // 5. SERVIÇO CANÔNICO DE ORDENAÇÃO BIJETIVA DO GRID
    // Algoritmo determinístico comprovado em raceQualifyingService:
    // 1. Menor targetPos (posição provisória calculada)
    // 2. Se empate em targetPos: desempate por melhor qualifyingPosition original
    // 3. Se ainda empatado: desempate lexicográfico por driverId
    provisionalItems.sort((a, b) => {
      if (a.targetPos !== b.targetPos) {
        return a.targetPos - b.targetPos
      }
      if (a.qualifyingPosition !== b.qualifyingPosition) {
        return a.qualifyingPosition - b.qualifyingPosition
      }
      return a.entry.driverId.localeCompare(b.entry.driverId)
    })

    // 6. ATRIBUIÇÃO DE POSIÇÕES FINAIS P1..P24 BIJETIVAS
    const startingGrid: StartingGridEntry[] = provisionalItems.map((item, index) => {
      const gridPosition = index + 1
      return {
        gridPosition,
        qualifyingPosition: item.qualifyingPosition, // IMUTÁVEL
        driverId: item.entry.driverId,
        driverName: item.entry.driverName,
        teamId: item.entry.teamId,
        teamName: item.entry.teamName,
        carIndex: item.entry.carIndex,
        eliminationPhase: item.entry.eliminationPhase,
        qualifyingTimeMs: item.entry.phaseBestTimeMs,
        formattedQualifyingTime: item.entry.formattedPhaseBestTime,
        setup: item.entry.setup,
        penalties: item.penalties,
        totalPenaltyPositions: item.totalPenaltyPositions,
        hasPenalty: item.totalPenaltyPositions > 0,
        penaltyReason:
          item.penalties.length > 0
            ? item.penalties.map((p) => p.reason || `+${p.positions} posições`).join(', ')
            : undefined,
      }
    })

    // 7. VALIDAÇÕES EXPLÍCITAS DE BIJEÇÃO E REGRESSÃO DE DUPLICAÇÃO DE PILOTOS
    const driverIdsSet = new Set(startingGrid.map((g) => g.driverId))
    if (driverIdsSet.size !== totalEntrants) {
      throw new Error(
        `Regressão de pilotos duplicados detectada no STARTING_GRID: ${totalEntrants} entradas, ${driverIdsSet.size} motoristas únicos.`,
      )
    }

    const gridPositions = startingGrid.map((g) => g.gridPosition).sort((a, b) => a - b)
    const expectedGridPositions = Array.from({ length: totalEntrants }, (_, i) => i + 1)
    if (JSON.stringify(gridPositions) !== JSON.stringify(expectedGridPositions)) {
      throw new Error(
        `Violação de bijeção de posições no STARTING_GRID: posições não são contínuas P1..P${totalEntrants}.`,
      )
    }

    const poleEntry = startingGrid[0]

    const startingGridState: StartingGridState = {
      careerId,
      seasonId,
      round,
      configVersion: globalQuali.configVersion,
      configSha256: globalQuali.configSha256,
      status: 'GRID_READY',
      totalParticipants: totalEntrants,
      grid: startingGrid,
      poleDriverId: poleEntry.driverId,
      poleDriverName: poleEntry.driverName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 8. PERSISTÊNCIA RESILIENTE (PocketBase + Cache Local)
    await this.persistStartingGrid(startingGridState)
    this.inMemoryCache.set(storageKey, startingGridState as any)

    return startingGridState
  }

  /**
   * Consulta o STARTING_GRID persistido.
   */
  public async loadPersistedStartingGrid(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<StartingGridState | null> {
    const storageKey = buildStartingGridStorageKey(careerId, seasonId, round)

    // 1. Memória rápida
    if (this.inMemoryCache.has(storageKey)) {
      return this.inMemoryCache.get(storageKey) as unknown as StartingGridState
    }

    // 2. PocketBase session_setups (session = 'q3' ou 'grid')
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "q3"`,
      })
      if (records.items.length > 0) {
        const item = records.items[0]
        const strategies = (item.driver_strategies as any) || {}
        if (strategies.startingGridState) {
          const loaded = strategies.startingGridState as StartingGridState
          this.inMemoryCache.set(storageKey, loaded as any)
          return loaded
        }
      }
    } catch {
      // ignora erro do PB
    }

    // 3. Cache Local (localStorage)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          const parsed = JSON.parse(raw) as StartingGridState
          this.inMemoryCache.set(storageKey, parsed as any)
          return parsed
        }
      } catch {
        // ignore
      }
    }

    return null
  }

  /**
   * Persiste o STARTING_GRID de forma resiliente.
   */
  public async persistStartingGrid(state: StartingGridState): Promise<void> {
    const { careerId, seasonId, round, status } = state
    const storageKey = buildStartingGridStorageKey(careerId, seasonId, round)

    // 1. Gravação no PocketBase session_setups (session = 'q3')
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "q3"`,
      })

      if (records.items.length > 0) {
        const existing = records.items[0]
        const strategies = (existing.driver_strategies as any) || {}
        strategies.startingGridState = state
        await pb.collection('session_setups').update(existing.id, {
          driver_strategies: strategies,
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      } else {
        await pb.collection('session_setups').create({
          team_id: careerId,
          season_id: seasonId,
          round,
          session: 'q3',
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            startingGridState: state,
          },
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      }
    } catch (err) {
      console.warn(`[RaceQualifyingOrchestratorService] Erro ao persistir starting grid:`, err)
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

  public clearMemoryCache(): void {
    this.inMemoryCache.clear()
  }
}

export const raceQualifyingOrchestratorService = new RaceQualifyingOrchestratorService()
export default raceQualifyingOrchestratorService
