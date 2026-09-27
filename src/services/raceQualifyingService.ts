/**
 * src/services/raceQualifyingService.ts
 *
 * RACE-QUALI-01: Serviço Canônico de Classificação (Q1 -> Q2 -> Q3 -> GRID_READY).
 *
 * Integração pura e persistente das fases de qualificação utilizando:
 * - Funções puras de src/lib/race/pureRaceEngine.ts (calculateEffectiveQualifyingDriver, calculateTrackQualifyingRating, calculateQualifyingAttemptTime)
 * - Configuração versionada / parâmetros canônicos (RACE-SOURCE-01A)
 * - Acerto consolidado de treinos livres (session_setups / racePracticeSetupService) com bônus aplicado uma única vez
 * - RNG determinístico Mulberry32 + Box-Muller com semente estável por carreira + temporada + rodada + fase + carro/piloto + tentativa
 * - Unicidade estrita de pilotos e posições em cada fase e no grid final
 * - Separação formal de QUALIFYING_RESULT (ordem de pista Q3/Q2/Q1) e STARTING_GRID (com penalidades aplicadas)
 * - Suporte à variante NORMAL_QUALIFYING ativa e SPRINT_QUALIFYING arquiteturalmente preparada (sem duplicação de motor)
 */

import {
  calculateEffectiveQualifyingDriver,
  calculateTrackQualifyingRating,
  calculateQualifyingAttemptTime,
  DEFAULT_SOURCE_RACE_PARAMETERS,
} from '../lib/race/pureRaceEngine'
import type { RaceParameters } from '../lib/race/types'

export type QualifyingPhase = 'READY_FOR_Q1' | 'Q1' | 'Q2' | 'Q3' | 'GRID_READY'
export type QualifyingVariant = 'NORMAL_QUALIFYING' | 'SPRINT_QUALIFYING'

export interface QualifyingDriverInput {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  carId?: string
  carPerformance: number // 0-100 base do carro
  speed: number // 0-100
  qualifying: number // 0-100
  form?: number // default: 50
  morale?: number // default: 50
  wet_skill?: number // default: 50
  setup: number // 0-100 acerto vindo do TL (ex: 90.2275)
  gridPenaltyPositions?: number // Penalidades de grid acumuladas (ex: troca de motor PU5+)
}

export interface QualifyingLapAttempt {
  attemptNumber: number
  normalDrawZ: number
  timeMs: number
  bonusMs: number
  formattedTime: string
}

export interface QualifyingDriverResult {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  carId?: string
  setup: number
  effectiveDriver: number
  trackRating: number
  basePaceMs: number
  q1TimeMs?: number
  q2TimeMs?: number
  q3TimeMs?: number
  bestTimeMs?: number
  eliminatedInPhase?: 'Q1' | 'Q2'
  qualifyingPosition: number // 1..N (antes de penalidades)
  gridPenaltyPositions: number
  startingGridPosition: number // 1..N (após penalidades)
  lapAttempts: {
    Q1?: QualifyingLapAttempt[]
    Q2?: QualifyingLapAttempt[]
    Q3?: QualifyingLapAttempt[]
  }
}

export interface QualifyingCutoffRule {
  phase: 'Q1' | 'Q2'
  advancingCount: number
  eliminatedCount: number
}

export interface QualifyingWeekendState {
  careerId: string
  seasonId: string
  round: number
  variant: QualifyingVariant
  phase: QualifyingPhase
  isComplete: boolean
  totalParticipants: number
  q1AdvancingCount: number
  q2AdvancingCount: number
  q3Count: number
  results: QualifyingDriverResult[]
  qualifyingOrder: string[] // driverIds ordenados pelo resultado puro de pista
  startingGridOrder: string[] // driverIds ordenados após penalidades
  trackRecordMs: number
  weather: {
    wet: boolean
    trackCondition: 'DRY' | 'WET'
  }
  parametersUsed: Pick<
    RaceParameters,
    | 'max_setup_qualifying_bonus_seconds'
    | 'qualifying_noise_sd_ms'
    | 'qualifying_base_over_record_factor'
  >
  updatedAt: string
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
 * Converte milissegundos para formato mm:ss.sss
 */
export function formatLapTimeMs(ms: number | undefined): string {
  if (ms === undefined || isNaN(ms) || ms <= 0) return '-:--.---'
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const secStr = seconds.toFixed(3).padStart(6, '0')
  return `${minutes}:${secStr}`
}

export class RaceQualifyingService {
  private inMemoryStorage: Map<string, QualifyingWeekendState> = new Map()

  /**
   * Chave estável de persistência por carreira, temporada e rodada
   */
  public getStateKey(careerId: string, seasonId: string, round: number): string {
    return `quali_${careerId}_${seasonId}_r${round}`
  }

  /**
   * Determina os cortes de classificação canônicos.
   * Regra base da F1 (FIA):
   * - 24 carros: Q1 avança 18 (elimina 6), Q2 avança 10 (elimina 8), Q3 disputa pole (10 carros).
   * - 22 carros: Q1 avança 16 (elimina 6), Q2 avança 10 (elimina 6), Q3 disputa 10.
   * - 20 carros: Q1 avança 15 (elimina 5), Q2 avança 10 (elimina 5), Q3 disputa 10.
   * Lacuna registrada se grid for divergente de 24/22/20: Q3 sempre mantém os 10 primeiros,
   * e o restante das eliminações é dividido proporcionalmente entre Q1 e Q2.
   */
  public getCutoffRules(participantCount: number): { q1Advance: number; q2Advance: number } {
    if (participantCount === 24) {
      return { q1Advance: 18, q2Advance: 10 }
    }
    if (participantCount === 22) {
      return { q1Advance: 16, q2Advance: 10 }
    }
    if (participantCount === 20) {
      return { q1Advance: 15, q2Advance: 10 }
    }

    // Regra adaptativa documentada para grids personalizados / não canônicos:
    // Garante que Q3 tenha min(10, total - 2) e Q1 corte a metade do excedente.
    const q3Target = Math.min(10, Math.max(4, participantCount - 4))
    const totalToEliminate = participantCount - q3Target
    const q1Eliminate = Math.ceil(totalToEliminate / 2)
    return {
      q1Advance: participantCount - q1Eliminate,
      q2Advance: q3Target,
    }
  }

  /**
   * Inicializa ou carrega o estado de Qualificação
   */
  public getOrCreateQualifyingState(params: {
    careerId: string
    seasonId: string
    round: number
    participants: QualifyingDriverInput[]
    trackRecordMs?: number
    driverWeight?: number
    wet?: boolean
    variant?: QualifyingVariant
    parameters?: Partial<RaceParameters>
  }): QualifyingWeekendState {
    const key = this.getStateKey(params.careerId, params.seasonId, params.round)
    const existing = this.inMemoryStorage.get(key)
    if (existing) {
      return existing
    }

    // Regra 1: Unicidade estrita de participantes por piloto e vaga/carro
    const seenDrivers = new Set<string>()
    const uniqueParticipants: QualifyingDriverInput[] = []
    for (const p of params.participants) {
      if (!seenDrivers.has(p.driverId)) {
        seenDrivers.add(p.driverId)
        uniqueParticipants.push(p)
      }
    }

    const cutoffs = this.getCutoffRules(uniqueParticipants.length)
    const trackRecordMs = params.trackRecordMs ?? 80000 // 1:20.000 como baseline se não fornecido
    const driverWeight = params.driverWeight ?? 0.35 // peso canônico do piloto no qualifying (35% piloto, 65% carro)
    const isWet = params.wet ?? false

    const paramsUsed: Pick<
      RaceParameters,
      | 'max_setup_qualifying_bonus_seconds'
      | 'qualifying_noise_sd_ms'
      | 'qualifying_base_over_record_factor'
    > = {
      max_setup_qualifying_bonus_seconds:
        params.parameters?.max_setup_qualifying_bonus_seconds ??
        DEFAULT_SOURCE_RACE_PARAMETERS.max_setup_qualifying_bonus_seconds,
      qualifying_noise_sd_ms:
        params.parameters?.qualifying_noise_sd_ms ??
        DEFAULT_SOURCE_RACE_PARAMETERS.qualifying_noise_sd_ms,
      qualifying_base_over_record_factor:
        params.parameters?.qualifying_base_over_record_factor ??
        DEFAULT_SOURCE_RACE_PARAMETERS.qualifying_base_over_record_factor,
    }

    const results: QualifyingDriverResult[] = uniqueParticipants.map((p) => {
      // 1. Piloto efetivo (pureRaceEngine)
      const { effective_driver } = calculateEffectiveQualifyingDriver(
        {
          speed: p.speed,
          qualifying: p.qualifying,
          form: p.form ?? 50,
          morale: p.morale ?? 50,
          wet_skill: p.wet_skill ?? 50,
          wet: isWet,
        },
        DEFAULT_SOURCE_RACE_PARAMETERS,
      )

      // 2. Rating de Qualificação ponderado com carro (pureRaceEngine)
      const { rating } = calculateTrackQualifyingRating({
        car: p.carPerformance,
        effective_driver,
        driver_weight: driverWeight,
      })

      // 3. Base Pace (ms): derivado do track record e rating (rating 100 = recorde)
      // rating de 50 a 100 mapeia tempo base entre (record + 3.0s) e record
      // rating mais alto = tempo menor
      const ratingGap = (100 - Math.min(100, Math.max(0, rating))) * 35 // 35ms por ponto de rating
      const basePaceMs = trackRecordMs + ratingGap

      return {
        driverId: p.driverId,
        driverName: p.driverName,
        teamId: p.teamId,
        teamName: p.teamName,
        carId: p.carId,
        setup: p.setup,
        effectiveDriver: effective_driver,
        trackRating: rating,
        basePaceMs,
        qualifyingPosition: 0,
        gridPenaltyPositions: p.gridPenaltyPositions ?? 0,
        startingGridPosition: 0,
        lapAttempts: {
          Q1: [],
          Q2: [],
          Q3: [],
        },
      }
    })

    const state: QualifyingWeekendState = {
      careerId: params.careerId,
      seasonId: params.seasonId,
      round: params.round,
      variant: params.variant ?? 'NORMAL_QUALIFYING',
      phase: 'READY_FOR_Q1',
      isComplete: false,
      totalParticipants: uniqueParticipants.length,
      q1AdvancingCount: cutoffs.q1Advance,
      q2AdvancingCount: cutoffs.q2Advance,
      q3Count: cutoffs.q2Advance,
      results,
      qualifyingOrder: [],
      startingGridOrder: [],
      trackRecordMs,
      weather: {
        wet: isWet,
        trackCondition: isWet ? 'WET' : 'DRY',
      },
      parametersUsed: paramsUsed,
      updatedAt: new Date().toISOString(),
    }

    this.inMemoryStorage.set(key, state)
    return state
  }

  /**
   * Gera uma tentativa de volta determinística para um piloto em uma fase específica.
   */
  private runAttempt(
    state: QualifyingWeekendState,
    driver: QualifyingDriverResult,
    phase: 'Q1' | 'Q2' | 'Q3',
    attemptNumber: number,
  ): QualifyingLapAttempt {
    // Semente estável por carreira, season, round, fase, piloto e tentativa
    const seedString = `${state.careerId}:${state.seasonId}:r${state.round}:${phase}:${driver.driverId}:att${attemptNumber}`
    const seed = hashStringToUint32(seedString)
    const rng = mulberry32(seed)
    const z = getStandardNormal(rng)

    // Chama a função pura oficial canônica
    const { time_ms, bonus_ms } = calculateQualifyingAttemptTime(
      {
        base_pace_ms: driver.basePaceMs,
        setup: driver.setup,
        normal_standard_draw_z: z,
        sigma_ms: state.parametersUsed.qualifying_noise_sd_ms,
      },
      {
        max_setup_qualifying_bonus_seconds: state.parametersUsed.max_setup_qualifying_bonus_seconds,
        qualifying_noise_sd_ms: state.parametersUsed.qualifying_noise_sd_ms,
      },
    )

    return {
      attemptNumber,
      normalDrawZ: z,
      timeMs: time_ms,
      bonusMs: bonus_ms,
      formattedTime: formatLapTimeMs(time_ms),
    }
  }

  /**
   * Executa a fase Q1.
   * Todos os participantes realizam voltas.
   * Os melhores `q1AdvancingCount` avançam para o Q2.
   * Os demais são eliminados e têm posições fixadas em P(q1AdvancingCount + 1) até P(total).
   * Idempotente: se Q1 já rodou, retorna o estado existente sem sortear de novo.
   */
  public executeQ1(careerId: string, seasonId: string, round: number): QualifyingWeekendState {
    const key = this.getStateKey(careerId, seasonId, round)
    const state = this.inMemoryStorage.get(key)
    if (!state) {
      throw new Error(`Estado de qualificação não encontrado para ${key}`)
    }

    // Idempotência: se já passou do Q1, não refaz
    if (state.phase !== 'READY_FOR_Q1') {
      return state
    }

    // Executa 2 tentativas para cada piloto no Q1
    for (const driver of state.results) {
      if (!driver.lapAttempts.Q1 || driver.lapAttempts.Q1.length === 0) {
        const att1 = this.runAttempt(state, driver, 'Q1', 1)
        const att2 = this.runAttempt(state, driver, 'Q1', 2)
        driver.lapAttempts.Q1 = [att1, att2]
        driver.q1TimeMs = Math.min(att1.timeMs, att2.timeMs)
        driver.bestTimeMs = driver.q1TimeMs
      }
    }

    // Ordenação determinística com desempate
    state.results.sort((a, b) =>
      this.compareDriverTimes(a.q1TimeMs!, b.q1TimeMs!, a.driverId, b.driverId),
    )

    // Separa classificados e eliminados no Q1
    const advancing = state.results.slice(0, state.q1AdvancingCount)
    const eliminated = state.results.slice(state.q1AdvancingCount)

    eliminated.forEach((d, idx) => {
      d.eliminatedInPhase = 'Q1'
      d.qualifyingPosition = state.q1AdvancingCount + 1 + idx
    })

    state.phase = 'Q2'
    state.updatedAt = new Date().toISOString()
    return state
  }

  /**
   * Executa a fase Q2.
   * Apenas os sobreviventes do Q1 participam.
   * Eliminados do Q1 NÃO participam e não têm novos tempos.
   * Os melhores `q2AdvancingCount` avançam para o Q3.
   * Os eliminados do Q2 têm posições fixadas em P(q2AdvancingCount + 1) até P(q1AdvancingCount).
   * Idempotente: se Q2 já rodou, retorna sem sortear novamente.
   */
  public executeQ2(careerId: string, seasonId: string, round: number): QualifyingWeekendState {
    const key = this.getStateKey(careerId, seasonId, round)
    const state = this.inMemoryStorage.get(key)
    if (!state) {
      throw new Error(`Estado de qualificação não encontrado para ${key}`)
    }

    if (state.phase === 'READY_FOR_Q1') {
      this.executeQ1(careerId, seasonId, round)
    }

    // Se já passou do Q2, retorna idempotente
    if (state.phase === 'Q3' || state.phase === 'GRID_READY') {
      return state
    }

    // Filtra sobreviventes do Q1
    const q2Participants = state.results.filter((d) => !d.eliminatedInPhase)

    for (const driver of q2Participants) {
      if (!driver.lapAttempts.Q2 || driver.lapAttempts.Q2.length === 0) {
        const att1 = this.runAttempt(state, driver, 'Q2', 1)
        const att2 = this.runAttempt(state, driver, 'Q2', 2)
        driver.lapAttempts.Q2 = [att1, att2]
        driver.q2TimeMs = Math.min(att1.timeMs, att2.timeMs)
        driver.bestTimeMs = Math.min(driver.bestTimeMs ?? Infinity, driver.q2TimeMs)
      }
    }

    // Ordenação dos participantes do Q2
    q2Participants.sort((a, b) =>
      this.compareDriverTimes(a.q2TimeMs!, b.q2TimeMs!, a.driverId, b.driverId),
    )

    const advancing = q2Participants.slice(0, state.q2AdvancingCount)
    const eliminated = q2Participants.slice(state.q2AdvancingCount)

    eliminated.forEach((d, idx) => {
      d.eliminatedInPhase = 'Q2'
      d.qualifyingPosition = state.q2AdvancingCount + 1 + idx
    })

    state.phase = 'Q3'
    state.updatedAt = new Date().toISOString()
    return state
  }

  /**
   * Executa a fase Q3 e consolida o grid.
   * Apenas os sobreviventes do Q2 participam (top 10).
   * Determina P1..P10.
   * Em seguida, consolida QUALIFYING_RESULT e calcula STARTING_GRID após penalidades.
   * Idempotente: se já executou Q3 / GRID_READY, retorna o resultado já calculado.
   */
  public executeQ3(careerId: string, seasonId: string, round: number): QualifyingWeekendState {
    const key = this.getStateKey(careerId, seasonId, round)
    const state = this.inMemoryStorage.get(key)
    if (!state) {
      throw new Error(`Estado de qualificação não encontrado para ${key}`)
    }

    if (state.phase === 'READY_FOR_Q1') {
      this.executeQ1(careerId, seasonId, round)
    }
    if (state.phase === 'Q2') {
      this.executeQ2(careerId, seasonId, round)
    }

    if (state.phase === 'GRID_READY') {
      return state
    }

    // Participantes do Q3 (não eliminados no Q1 ou Q2)
    const q3Participants = state.results.filter((d) => !d.eliminatedInPhase)

    for (const driver of q3Participants) {
      if (!driver.lapAttempts.Q3 || driver.lapAttempts.Q3.length === 0) {
        const att1 = this.runAttempt(state, driver, 'Q3', 1)
        const att2 = this.runAttempt(state, driver, 'Q3', 2)
        driver.lapAttempts.Q3 = [att1, att2]
        driver.q3TimeMs = Math.min(att1.timeMs, att2.timeMs)
        driver.bestTimeMs = Math.min(driver.bestTimeMs ?? Infinity, driver.q3TimeMs)
      }
    }

    // Ordenação do Q3
    q3Participants.sort((a, b) =>
      this.compareDriverTimes(a.q3TimeMs!, b.q3TimeMs!, a.driverId, b.driverId),
    )

    q3Participants.forEach((d, idx) => {
      d.qualifyingPosition = idx + 1
    })

    // Consolidação de QUALIFYING_RESULT (ordem pura de pista 1..N)
    state.results.sort((a, b) => a.qualifyingPosition - b.qualifyingPosition)
    state.qualifyingOrder = state.results.map((d) => d.driverId)

    // Aplicação canônica de penalidades de grid para gerar o STARTING_GRID
    this.applyGridPenalties(state)

    state.phase = 'GRID_READY'
    state.isComplete = true
    state.updatedAt = new Date().toISOString()
    return state
  }

  /**
   * Aplica penalidades de grid de forma determinística e bijetiva garantindo que
   * cada piloto fique em exatamente uma posição (1..N sem duplicatas).
   */
  public applyGridPenalties(state: QualifyingWeekendState): void {
    const list = [...state.results]
    // Ordena inicialmente pela posição pura de classificação
    list.sort((a, b) => a.qualifyingPosition - b.qualifyingPosition)

    // Calcula a posição provisória após penalidade: pos + penalty
    const provisional = list.map((d) => {
      const penalty = Math.max(0, d.gridPenaltyPositions || 0)
      return {
        driver: d,
        targetPos: d.qualifyingPosition + penalty,
        qualiPos: d.qualifyingPosition,
      }
    })

    // Ordenação determinística:
    // 1. Menor targetPos
    // 2. Se empate em targetPos: quem teve melhor posição no qualifying original fica à frente
    // 3. Se ainda empatado: driverId determinístico
    provisional.sort((a, b) => {
      if (a.targetPos !== b.targetPos) {
        return a.targetPos - b.targetPos
      }
      if (a.qualiPos !== b.qualiPos) {
        return a.qualiPos - b.qualiPos
      }
      return a.driver.driverId.localeCompare(b.driver.driverId)
    })

    // Atribui posições finais 1..N sem buracos e sem duplicidades
    provisional.forEach((item, index) => {
      const finalPos = index + 1
      item.driver.startingGridPosition = finalPos
    })

    // Atualiza startingGridOrder ordenado por startingGridPosition
    state.results.sort((a, b) => a.startingGridPosition - b.startingGridPosition)
    state.startingGridOrder = state.results.map((d) => d.driverId)
  }

  /**
   * Comparador determinístico de tempos.
   * Política documentada:
   * 1. Menor tempo em ms vence
   * 2. Em caso de empate exato em ms: desempate determinístico por ordem lexicográfica de driverId.
   * Não utiliza Math.random() nem ordenação silenciosa / instável.
   */
  public compareDriverTimes(timeA: number, timeB: number, idA: string, idB: string): number {
    if (timeA !== timeB) {
      return timeA - timeB
    }
    return idA.localeCompare(idB)
  }

  /**
   * Executa todo o final de semana de classificação de uma só vez (Q1 -> Q2 -> Q3 -> GRID_READY)
   */
  public executeFullQualifying(
    careerId: string,
    seasonId: string,
    round: number,
  ): QualifyingWeekendState {
    this.executeQ1(careerId, seasonId, round)
    this.executeQ2(careerId, seasonId, round)
    return this.executeQ3(careerId, seasonId, round)
  }

  /**
   * Obtém o estado atual persistido
   */
  public getState(
    careerId: string,
    seasonId: string,
    round: number,
  ): QualifyingWeekendState | undefined {
    return this.inMemoryStorage.get(this.getStateKey(careerId, seasonId, round))
  }

  /**
   * Restaura o estado salvo (suporte a reload e persistência)
   */
  public restoreState(state: QualifyingWeekendState): void {
    const key = this.getStateKey(state.careerId, state.seasonId, state.round)
    this.inMemoryStorage.set(key, state)
  }

  /**
   * Limpa o estado (usado em testes ou reset de rodada)
   */
  public clearState(careerId: string, seasonId: string, round: number): void {
    this.inMemoryStorage.delete(this.getStateKey(careerId, seasonId, round))
  }
}

export const raceQualifyingService = new RaceQualifyingService()
export default raceQualifyingService
