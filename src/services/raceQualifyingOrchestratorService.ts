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
import { DEFAULT_SOURCE_RACE_PARAMETERS } from '@/lib/race/pureRaceEngine'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { resolveCanonicalTeamKeyFromContext } from '@/services/canonicalTeamIdentityService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { racePracticeSetupService } from '@/services/racePracticeSetupService'

export type QualifyingVariant = 'MAIN_QUALIFYING' | 'SPRINT_QUALIFYING'

export type QualifyingPhase = 'Q1' | 'Q2' | 'Q3' | 'SQ1' | 'SQ2' | 'SQ3'

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
  | 'READY_FOR_SQ1'
  | 'SQ1'
  | 'SQ1_COMPLETE'
  | 'READY_FOR_SQ2'
  | 'SQ2'
  | 'SQ2_COMPLETE'
  | 'READY_FOR_SQ3'
  | 'SQ3'
  | 'SQ3_COMPLETE'
  | 'SPRINT_QUALIFYING_COMPLETE'
  | 'SPRINT_QUALIFYING_RESULT_READY'
  | 'SPRINT_STARTING_GRID_READY'
  | 'SPRINT_GRID_READY'

export interface QualifyingDriverInput {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  carIndex?: 1 | 2
  carPerformance?: number // Opcional / legado — qualifying usa canonicalTeamKey -> Structural Strength
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
  compoundDeltaMs?: number
  compoundUsed?: 'MEDIUM' | 'SOFT'
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
  compoundDeltaMs?: number
  compoundUsed?: 'MEDIUM' | 'SOFT'
  bestTimeMs: number
  formattedBestTime: string
  attempts: QualifyingLapAttempt[]
  position: number // 1..N dentro da fase
  isClassified: boolean // true = avança para a próxima fase (ou Q3 finalizado no top)
  isEliminated: boolean // true = eliminado nesta fase
}

export type Q1ParticipantResult = QualifyingParticipantResult

export interface QualifyingPhaseExecutionState {
  variant?: QualifyingVariant
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
  status: 'STARTING_GRID_READY' | 'GRID_READY' | 'SPRINT_GRID_READY'
  totalParticipants: number
  grid: StartingGridEntry[]
  poleDriverId: string
  poleDriverName: string
  createdAt: string
  updatedAt: string
}

export interface SprintQualifyingResultEntry {
  position: number // P1..P24
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  carIndex: 1 | 2
  eliminationPhase: 'SQ1' | 'SQ2' | 'SQ3'
  phaseBestTimeMs: number
  formattedPhaseBestTime: string
  setup: number
  sq1BestTimeMs?: number
  sq2BestTimeMs?: number
  sq3BestTimeMs?: number
}

export interface SprintQualifyingResultState {
  careerId: string
  seasonId: string
  round: number
  configVersion: string
  configSha256?: string
  status: 'SPRINT_QUALIFYING_RESULT_READY'
  totalParticipants: number
  results: SprintQualifyingResultEntry[]
  poleDriverId: string
  poleDriverName: string
  poleTimeMs: number
  formattedPoleTime: string
  createdAt: string
  updatedAt: string
}

export interface SprintStartingGridEntry {
  gridPosition: number // P1..P24 efetivo de largada da Sprint
  qualifyingPosition: number // P1..P24 puro da Quali Sprint
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  carIndex: 1 | 2
  eliminationPhase: 'SQ1' | 'SQ2' | 'SQ3'
  qualifyingTimeMs: number
  formattedQualifyingTime: string
  setup: number
  penalties: GridPenaltyApplied[]
  totalPenaltyPositions: number
  hasPenalty: boolean
  penaltyReason?: string
}

export interface SprintStartingGridState {
  careerId: string
  seasonId: string
  round: number
  configVersion: string
  configSha256?: string
  status: 'SPRINT_GRID_READY'
  totalParticipants: number
  grid: SprintStartingGridEntry[]
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
  attemptsPerPhase?: number
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
  participants?: QualifyingDriverInput[] // Obrigatório no Q1/SQ1; herdado nas fases seguintes
  trackRecordMs?: number
  driverWeight?: number
  wet?: boolean
  forceBypassPracticeCheck?: boolean
  mediumDeltaMs?: number
  attemptsPerPhase?: number
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
  variant?: QualifyingVariant,
): string {
  const p = phase.toLowerCase()
  const isSprint = variant === 'SPRINT_QUALIFYING' || phase.startsWith('SQ')
  if (isSprint) {
    return `apex_sprint_${p}_state_${careerId}_${seasonId}_r${round}`
  }
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

export function buildSprintQualifyingStorageKey(
  phase: 'SQ1' | 'SQ2' | 'SQ3' | QualifyingPhase,
  careerId: string,
  seasonId: string,
  round: number,
): string {
  const p = phase.toLowerCase()
  return `apex_sprint_${p}_state_${careerId}_${seasonId}_r${round}`
}

export function buildGlobalSprintQualifyingStorageKey(
  careerId: string,
  seasonId: string,
  round: number,
): string {
  return `apex_sprint_qualifying_result_state_${careerId}_${seasonId}_r${round}`
}

export function buildSprintStartingGridStorageKey(
  careerId: string,
  seasonId: string,
  round: number,
): string {
  return `apex_sprint_starting_grid_state_${careerId}_${seasonId}_r${round}`
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
    if (phase === 'Q3' || phase === 'SQ3') {
      return {
        advancingCount: totalParticipants,
        eliminatedCount: 0,
      }
    }

    if (phase === 'Q2' || phase === 'SQ2') {
      const advancingCount = Math.min(10, totalParticipants)
      const eliminatedCount = Math.max(0, totalParticipants - advancingCount)
      return { advancingCount, eliminatedCount }
    }

    // Q1 / SQ1
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
   * Executa a subfase SQ1 do Sprint Qualifying de forma determinística, idempotente e estrita.
   * Transição: READY_FOR_SQ1 → SQ1 → SQ1_COMPLETE → READY_FOR_SQ2.
   * 24 participantes -> 18 classificados, 6 eliminados.
   * Pneus no seco: Médio (+650ms). Na chuva: 0ms.
   */
  public async executeSQ1(
    params: Omit<ExecuteQualifyingPhaseParams, 'phase'>,
  ): Promise<QualifyingPhaseExecutionState> {
    return this.executeQualifyingPhase({
      ...params,
      phase: 'SQ1',
    })
  }

  /**
   * Executa a subfase SQ2 do Sprint Qualifying de forma determinística, idempotente e estrita.
   * Transição: READY_FOR_SQ2 → SQ2 → SQ2_COMPLETE → READY_FOR_SQ3.
   * Recebe EXATAMENTE os 18 classificados persistidos do SQ1.
   * 18 participantes -> 10 classificados, 8 eliminados.
   * Pneus no seco: Médio (+650ms). Na chuva: 0ms.
   */
  public async executeSQ2(
    params: Omit<ExecuteQualifyingPhaseParams, 'phase'>,
  ): Promise<QualifyingPhaseExecutionState> {
    return this.executeQualifyingPhase({
      ...params,
      phase: 'SQ2',
    })
  }

  /**
   * Executa a subfase SQ3 do Sprint Qualifying de forma determinística, idempotente e estrita.
   * Transição: READY_FOR_SQ3 → SQ3 → SQ3_COMPLETE → SPRINT_QUALIFYING_COMPLETE.
   * Recebe EXATAMENTE os 10 classificados persistidos do SQ2.
   * 10 participantes -> 10 classificados (P1..P10), 0 eliminados.
   * Pneus no seco: Macio (sem delta +650ms). Na chuva: 0ms.
   */
  public async executeSQ3(
    params: Omit<ExecuteQualifyingPhaseParams, 'phase'>,
  ): Promise<QualifyingPhaseExecutionState> {
    return this.executeQualifyingPhase({
      ...params,
      phase: 'SQ3',
    })
  }

  public async executePhase(
    params: ExecuteQualifyingPhaseParams,
  ): Promise<QualifyingPhaseExecutionState> {
    return this.executeQualifyingPhase(params)
  }

  /**
   * Conclui a sessão de Qualificação Sprint (slot 2) e avança o fim de semana para o slot 3 (SPRINT_RACE / READY),
   * após garantir que SQ1, SQ2, SQ3, SPRINT_QUALIFYING_RESULT e SPRINT_STARTING_GRID foram todos gerados e persistidos com sucesso.
   * Não executa a corrida Sprint, não roda voltas e não computa pontos.
   */
  public async transitionSprintQualifyingToSprintRaceSlot(params: {
    careerId: string
    seasonId: string
    round: number
  }): Promise<{
    currentSlot: number
    slotType: string
    slotStatus: string
  }> {
    const { careerId, seasonId, round } = params

    // 1. Validar existência e completude de SQ1
    const sq1 = await this.loadPersistedSQ1State(careerId, seasonId, round)
    if (!sq1 || !sq1.isCompleted) {
      throw new Error(`Transição slot 2->3 abortada: SQ1 não está concluído para round ${round}.`)
    }

    // 2. Validar existência e completude de SQ2
    const sq2 = await this.loadPersistedSQ2State(careerId, seasonId, round)
    if (!sq2 || !sq2.isCompleted) {
      throw new Error(`Transição slot 2->3 abortada: SQ2 não está concluído para round ${round}.`)
    }

    // 3. Validar existência e completude de SQ3
    const sq3 = await this.loadPersistedSQ3State(careerId, seasonId, round)
    if (!sq3 || !sq3.isCompleted) {
      throw new Error(`Transição slot 2->3 abortada: SQ3 não está concluído para round ${round}.`)
    }

    // 4. Validar ou construir SPRINT_QUALIFYING_RESULT
    let sprintQualiResult = await this.loadPersistedSprintQualifyingResult(
      careerId,
      seasonId,
      round,
    )
    if (!sprintQualiResult || sprintQualiResult.status !== 'SPRINT_QUALIFYING_RESULT_READY') {
      sprintQualiResult = await this.buildSprintQualifyingResult({ careerId, seasonId, round })
    }

    // 5. Validar ou construir SPRINT_STARTING_GRID
    let sprintGrid = await this.loadPersistedSprintStartingGrid(careerId, seasonId, round)
    if (!sprintGrid || sprintGrid.status !== 'SPRINT_GRID_READY') {
      sprintGrid = await this.buildSprintStartingGrid({ careerId, seasonId, round })
    }

    // 6. Atualizar transição canônica de slot (slot 2 -> slot 3) via canonicalWeekendSlotPersistenceService
    const { canonicalWeekendSlotPersistenceService } =
      await import('@/services/canonicalWeekendSlotPersistenceService')
    const currentSlotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
    })

    if (
      currentSlotState.currentSlot === 2 &&
      (currentSlotState.slotType === 'QUALI_SPRINT' ||
        currentSlotState.slotType === 'SPRINT_QUALIFYING')
    ) {
      // Conclui slot 2 e avança para slot 3 (SPRINT_RACE)
      await canonicalWeekendSlotPersistenceService.completeSlot(currentSlotState, 2)
      await canonicalWeekendSlotPersistenceService.saveSlotState(currentSlotState)
    } else if (
      currentSlotState.currentSlot === 3 &&
      (currentSlotState.slotType === 'QUALI_SPRINT' ||
        currentSlotState.slotType === 'SPRINT_QUALIFYING')
    ) {
      // Conclui slot 3 e avança para slot 4 (SPRINT_RACE) em persistência com 8 slots (TL1, TL2, QUALI_SPRINT...)
      await canonicalWeekendSlotPersistenceService.completeSlot(currentSlotState, 3)
      await canonicalWeekendSlotPersistenceService.saveSlotState(currentSlotState)
    }

    const updatedSlot = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
    })

    return {
      currentSlot: updatedSlot.currentSlot,
      slotType: updatedSlot.slotType,
      slotStatus: updatedSlot.slotStatus,
    }
  }

  /**
   * Executa qualquer fase de classificação (Q1 | Q2 | Q3 | SQ1 | SQ2 | SQ3) sob a mesma máquina matemática unificada.
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
      mediumDeltaMs,
      attemptsPerPhase,
    } = params

    if (!careerId || !seasonId || round <= 0) {
      throw new Error(
        `Contexto de carreira/temporada inválido: careerId='${careerId}', seasonId='${seasonId}', round=${round}`,
      )
    }

    const isSprintQuali = phase === 'SQ1' || phase === 'SQ2' || phase === 'SQ3'
    const variant: QualifyingVariant = isSprintQuali ? 'SPRINT_QUALIFYING' : 'MAIN_QUALIFYING'
    const storageKey = buildQualifyingStorageKey(phase, careerId, seasonId, round, variant)

    // Validação esportiva: weekendFormat deve ser SPRINT para executar SQ1
    if (isSprintQuali) {
      const { resolveWeekendFormat } = await import('@/services/weekendSlotSequenceService')
      const format = resolveWeekendFormat(round)
      if (format !== 'SPRINT') {
        throw new Error(
          `Formato inválido: Quali Sprint (${phase}) só é permitida em finais de semana Sprint. Rodada ${round} é formato ${format}.`,
        )
      }

      // Pré-condição do weekend: o fluxo canônico deve ter alcançado a Qualificação Sprint
      // Aceita slot 2 (arquitetura compacta) ou slot 3 (TL1 concluído + TL2 concluído -> QUALI_SPRINT)
      // bem como checagem esportiva de pré-requisitos dos treinos concluídos
      if (!forceBypassPracticeCheck) {
        const { canonicalWeekendSlotPersistenceService } =
          await import('@/services/canonicalWeekendSlotPersistenceService')
        const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
          careerId,
          seasonId,
          round,
        })
        const currentSlotDef = slotState.slots[slotState.currentSlot]
        const isSlotTypeValid =
          slotState.slotType === 'QUALI_SPRINT' ||
          slotState.slotType === 'SPRINT_QUALIFYING' ||
          currentSlotDef?.slotType === 'QUALI_SPRINT' ||
          currentSlotDef?.slotType === 'SPRINT_QUALIFYING'

        // Também verifica se os treinos anteriores (slots 1 e 2) já foram concluídos na persistência
        const practicesCompleted =
          slotState.completedSlots.includes(1) &&
          (slotState.completedSlots.includes(2) || slotState.currentSlot === 2)

        if (!isSlotTypeValid && !practicesCompleted) {
          throw new Error(
            `Pré-condição violada: Quali Sprint (${phase}) exige slot atual de qualificação sprint (SPRINT_QUALIFYING / QUALI_SPRINT). Slot atual: ${slotState.currentSlot} (${slotState.slotType}).`,
          )
        }
      }
    }

    // 1. CHECAGEM DE IDEMPOTÊNCIA / PERSISTÊNCIA PRÉVIA E RECUPERAÇÃO DE FALHA PARCIAL
    // Se a fase já foi executada (mesmo com falha na transição de status final),
    // recupera os tempos calculados sem gerar novos sorteios nem recalcular tempos.
    const existingState = await this.loadPersistedPhaseState(phase, careerId, seasonId, round)
    const completedStatus: QualifyingPhaseStatus =
      phase === 'Q1'
        ? 'READY_FOR_Q2'
        : phase === 'Q2'
          ? 'READY_FOR_Q3'
          : phase === 'Q3'
            ? 'QUALIFYING_COMPLETE'
            : phase === 'SQ1'
              ? 'READY_FOR_SQ2'
              : phase === 'SQ2'
                ? 'READY_FOR_SQ3'
                : 'SPRINT_QUALIFYING_COMPLETE'

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
    } else if (phase === 'SQ1') {
      if (!participants || participants.length === 0) {
        throw new Error('Nenhum participante informado para o SQ1.')
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

      const inputDriverMap = new Map((participants || []).map((p) => [p.driverId, p]))

      effectiveParticipants = q1ClassifiedResults.map((r) => {
        const extra = inputDriverMap.get(r.driverId)
        return {
          driverId: r.driverId,
          driverName: r.driverName,
          teamId: r.teamId,
          teamName: r.teamName,
          carIndex: r.carIndex,
          speed: extra?.speed ?? 80,
          qualifying: extra?.qualifying ?? 80,
          form: extra?.form ?? 50,
          morale: extra?.morale ?? 50,
          wet_skill: extra?.wet_skill ?? 50,
          setup: r.setup, // Mantém exatamente o mesmo setup dos TLs consolidado no Q1
        }
      })
    } else if (phase === 'SQ2') {
      // SQ2 EXIGE SQ1 CONCLUÍDO (READY_FOR_SQ2)
      const sq1State = await this.loadPersistedPhaseState('SQ1', careerId, seasonId, round)
      if (!sq1State || !sq1State.isCompleted) {
        throw new Error(
          `Ordem de sessões violada: SQ2 só pode ser iniciado após a conclusão do SQ1 (READY_FOR_SQ2). SQ1 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
        )
      }

      // Herança esportiva estrita: os participantes de SQ2 são EXATAMENTE os 10/18 classificados de SQ1
      const sq1ClassifiedSet = new Set(sq1State.classifiedDriverIds)
      const sq1ClassifiedResults = sq1State.results.filter((r) => sq1ClassifiedSet.has(r.driverId))

      const inputDriverMap = new Map((participants || []).map((p) => [p.driverId, p]))

      effectiveParticipants = sq1ClassifiedResults.map((r) => {
        const extra = inputDriverMap.get(r.driverId)
        return {
          driverId: r.driverId,
          driverName: r.driverName,
          teamId: r.teamId,
          teamName: r.teamName,
          carIndex: r.carIndex,
          speed: extra?.speed ?? 80,
          qualifying: extra?.qualifying ?? 80,
          form: extra?.form ?? 50,
          morale: extra?.morale ?? 50,
          wet_skill: extra?.wet_skill ?? 50,
          setup: r.setup, // Mantém exatamente o mesmo setup do TL1 herdado do SQ1
        }
      })
    } else if (phase === 'SQ3') {
      // SQ3 EXIGE SQ2 CONCLUÍDO (READY_FOR_SQ3)
      const sq2State = await this.loadPersistedPhaseState('SQ2', careerId, seasonId, round)
      if (!sq2State || !sq2State.isCompleted) {
        throw new Error(
          `Ordem de sessões violada: SQ3 só pode ser iniciado após a conclusão do SQ2 (READY_FOR_SQ3). SQ2 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
        )
      }

      // Herança esportiva estrita: os participantes de SQ3 são EXATAMENTE os 10 classificados de SQ2
      const sq2ClassifiedSet = new Set(sq2State.classifiedDriverIds)
      const sq2ClassifiedResults = sq2State.results.filter((r) => sq2ClassifiedSet.has(r.driverId))

      const inputDriverMap = new Map((participants || []).map((p) => [p.driverId, p]))

      effectiveParticipants = sq2ClassifiedResults.map((r) => {
        const extra = inputDriverMap.get(r.driverId)
        return {
          driverId: r.driverId,
          driverName: r.driverName,
          teamId: r.teamId,
          teamName: r.teamName,
          carIndex: r.carIndex,
          speed: extra?.speed ?? 80,
          qualifying: extra?.qualifying ?? 80,
          form: extra?.form ?? 50,
          morale: extra?.morale ?? 50,
          wet_skill: extra?.wet_skill ?? 50,
          setup: r.setup, // Mantém exatamente o mesmo setup do TL1 herdado do SQ2
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

    // 5. PROCESSAMENTO DE CADA PARTICIPANTE (CANÔNICO ABSOLUTO: computeQualifyingPace)
    // QUALI-UNIFY-01B: orquestrador consome canonicalPaceIntegrationService como único motor de performance
    const circuitProfile = resolveCircuitProfile({ round })
    const isWetCondition = Boolean(wet)
    const effectiveAttemptsPerPhase = attemptsPerPhase ?? 1

    const results: QualifyingParticipantResult[] = []

    for (let pIdx = 0; pIdx < uniqueParticipants.length; pIdx++) {
      const p = uniqueParticipants[pIdx]
      const carIdx: 1 | 2 = p.carIndex ?? ((pIdx % 2) + 1 === 1 ? 1 : 2)

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
          finalSetup = 80 // neutro canônico se não disponível
        }
      }

      // Resolução contextual de equipe (Player vs AI)
      const rawCandidate = p.teamId || p.teamName || 'custom_team'
      const resolvedContextualKey = resolveCanonicalTeamKeyFromContext({
        teamId: p.teamId,
        rawTeamIdentity: rawCandidate,
        team: {
          id: p.teamId,
          name: p.teamName,
          team_key: (p as any).teamKey,
        },
      })
      const canonicalTeamKey = resolvedContextualKey || rawCandidate

      const compoundUsed: 'MEDIUM' | 'SOFT' =
        isSprintQuali && (phase === 'SQ1' || phase === 'SQ2') ? 'MEDIUM' : 'SOFT'
      const canonicalTyreCompound =
        isSprintQuali && (phase === 'SQ1' || phase === 'SQ2') ? 'medio' : 'macio'
      const weatherState = isWetCondition ? 'chuva_fraca' : 'seco'

      const attempts: QualifyingLapAttempt[] = []
      let bestTimeMs = Infinity

      for (let attNum = 1; attNum <= effectiveAttemptsPerPhase; attNum++) {
        // Identidade da tentativa no RNG: career + season + round + variant + phase + entry/car + attempt
        // Garante namespaces distintos e preserva a distribuição seeded PRNG atual
        const seedIdentity = `${careerId}:${seasonId}:r${round}:${variant}:${phase}:${p.teamId}_c${carIdx}_${p.driverId}:att${attNum}`
        const seedUint = hashStringToUint32(seedIdentity)
        const rng = mulberry32(seedUint)
        const z = getStandardNormal(rng)

        // Converter z standard normal para noise de pace (sigma calibrado ~0.45 pt)
        // QUALI_RNG_TARGET_RANGE.SIGMA = 0.45. z * 0.45 produz o sorteio gaussiano desejado
        const seededPaceNoise = z * 0.45

        const paceResult = canonicalPaceIntegrationService.computeQualifyingPace({
          teamKey: canonicalTeamKey,
          driverId: p.driverId,
          circuitProfile,
          driverAttributes: {
            speed: p.speed ?? 80,
            consistency: 80,
            rain: p.wet_skill ?? p.speed ?? 80,
            morale: p.morale ?? 80,
          },
          tyreCompound: canonicalTyreCompound,
          tyreWearPct: 0,
          fuelKg: 12,
          setupEfficiency: finalSetup,
          weather: weatherState,
          noise: seededPaceNoise,
        })

        // Converte lapTimeSec (ex: 74.000 + (100 - pace)*0.082) para ms inteiros
        const attemptTimeMs = Math.round(paceResult.lapTimeSec * 1000)

        attempts.push({
          attemptNumber: attNum,
          normalDrawZ: z,
          timeMs: attemptTimeMs,
          bonusMs: 0,
          compoundDeltaMs: isSprintQuali && canonicalTyreCompound === 'medio' ? 650 : undefined,
          compoundUsed,
          formattedTime: formatLapTimeMs(attemptTimeMs),
        })

        if (attemptTimeMs < bestTimeMs) {
          bestTimeMs = attemptTimeMs
        }
      }

      // Snapshot canônico de pace neutro/base (RNG=0) para exibição e rastreabilidade
      const basePaceSnapshot = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: canonicalTeamKey,
        driverId: p.driverId,
        circuitProfile,
        driverAttributes: {
          speed: p.speed ?? 80,
          rain: p.wet_skill ?? p.speed ?? 80,
          morale: p.morale ?? 80,
        },
        tyreCompound: canonicalTyreCompound,
        setupEfficiency: finalSetup,
        weather: weatherState,
        noise: 0,
      })

      results.push({
        driverId: p.driverId,
        driverName: p.driverName,
        teamId: p.teamId,
        teamName: p.teamName,
        carIndex: carIdx,
        setup: finalSetup,
        effectiveDriver: basePaceSnapshot.breakdown.driverEventModifier,
        trackRating: basePaceSnapshot.effectivePaceScore,
        basePaceMs: Math.round(basePaceSnapshot.lapTimeSec * 1000),
        bonusMs: 0,
        compoundDeltaMs: isSprintQuali && canonicalTyreCompound === 'medio' ? 650 : undefined,
        compoundUsed: isSprintQuali ? compoundUsed : undefined,
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
      if (phase === 'Q3' || (phase as QualifyingPhase) === 'SQ3') {
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
      phase === 'Q1'
        ? 'READY_FOR_Q2'
        : phase === 'Q2'
          ? 'READY_FOR_Q3'
          : phase === 'Q3'
            ? 'QUALIFYING_COMPLETE'
            : phase === 'SQ1'
              ? 'READY_FOR_SQ2'
              : phase === 'SQ2'
                ? 'READY_FOR_SQ3'
                : 'SPRINT_QUALIFYING_COMPLETE'

    const finalState: QualifyingPhaseExecutionState = {
      variant,
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

    // Atualizar subfase no slot do fim de semana quando aplicável
    if (isSprintQuali) {
      try {
        const { canonicalWeekendSlotPersistenceService } =
          await import('@/services/canonicalWeekendSlotPersistenceService')
        await canonicalWeekendSlotPersistenceService.updateSubPhase({
          careerId,
          seasonId,
          round,
          slotNumber: 2,
          subPhase: phase,
        })
      } catch {
        // ignora se offline/mock
      }
    }

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
    const isSprint = phase.startsWith('SQ')
    const storageKey = buildQualifyingStorageKey(
      phase,
      careerId,
      seasonId,
      round,
      isSprint ? 'SPRINT_QUALIFYING' : 'MAIN_QUALIFYING',
    )
    const sessionName = phase.toLowerCase()
    const stateProp = isSprint ? `sprint_${sessionName}State` : `${sessionName}State`

    // 1. Memória rápida
    if (this.inMemoryCache.has(storageKey)) {
      return this.inMemoryCache.get(storageKey)!
    }

    // 2. PocketBase session_setups
    try {
      const pbSessionFilter = isSprint
        ? phase === 'SQ1'
          ? 'q1'
          : phase === 'SQ2'
            ? 'q2'
            : 'q3'
        : sessionName
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "${pbSessionFilter}"`,
      })
      if (records.items.length > 0) {
        for (const item of records.items) {
          const strategies = (item.driver_strategies as any) || {}
          if (strategies[stateProp]) {
            const loaded = strategies[stateProp] as QualifyingPhaseExecutionState
            this.inMemoryCache.set(storageKey, loaded)
            return loaded
          }
          // Compatibilidade retroativa para SQ1 sem prefixo
          if (isSprint && strategies[`${sessionName}State`]) {
            const loaded = strategies[`${sessionName}State`] as QualifyingPhaseExecutionState
            this.inMemoryCache.set(storageKey, loaded)
            return loaded
          }
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
   * Alias de consulta para SQ1.
   */
  public async loadPersistedSQ1State(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<QualifyingPhaseExecutionState | null> {
    // Busca primária pelo namespace canônico SQ1
    const state = await this.loadPersistedPhaseState('SQ1', careerId, seasonId, round)
    if (state) return state

    // Suporte a chave legada/alternativa: apex_sprint_qualifying_phase_sq1_*
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const legacyKey = `apex_sprint_qualifying_phase_sq1_${careerId}_${seasonId}_r${round}`
        const raw = localStorage.getItem(legacyKey)
        if (raw) {
          const parsed = JSON.parse(raw) as QualifyingPhaseExecutionState
          return parsed
        }
      } catch {
        // ignore
      }
    }
    return null
  }

  /**
   * Grava o estado de qualquer fase (Q1 | Q2 | Q3 | SQ1) de forma resiliente.
   */
  public async persistPhaseState(state: QualifyingPhaseExecutionState): Promise<void> {
    const { phase, careerId, seasonId, round, status, variant } = state
    const isSprint = variant === 'SPRINT_QUALIFYING' || phase.startsWith('SQ')
    const effectiveVariant: QualifyingVariant = isSprint ? 'SPRINT_QUALIFYING' : 'MAIN_QUALIFYING'
    const stateToPersist: QualifyingPhaseExecutionState = {
      ...state,
      variant: effectiveVariant,
    }

    const storageKey = buildQualifyingStorageKey(phase, careerId, seasonId, round, effectiveVariant)
    const sessionName = phase.toLowerCase()
    const stateProp = isSprint ? `sprint_${sessionName}State` : `${sessionName}State`

    // 1. Gravação no PocketBase
    // Para session no PB, o enum de schema aceita (tp1 | tp2 | tp3 | q1 | q2 | q3 | race).
    // Para SQ1 usamos 'q1' com namespace 'sprint_sq1State'.
    // Para SQ2 usamos 'q2' com namespace 'sprint_sq2State'.
    // Para SQ3 usamos 'q3' com namespace 'sprint_sq3State'.
    const pbSession =
      phase === 'SQ1' ? 'q1' : phase === 'SQ2' ? 'q2' : phase === 'SQ3' ? 'q3' : sessionName

    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "${pbSession}"`,
      })

      if (records.items.length > 0) {
        const existing = records.items[0]
        const strategies = (existing.driver_strategies as any) || {}
        strategies[stateProp] = stateToPersist
        await pb.collection('session_setups').update(existing.id, {
          driver_strategies: strategies,
          notes: JSON.stringify({ variant: effectiveVariant, phase: status, completed: true }),
        })
      } else {
        await pb.collection('session_setups').create({
          team_id: careerId,
          season_id: seasonId,
          round,
          session: pbSession,
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            [stateProp]: stateToPersist,
          },
          notes: JSON.stringify({ variant: effectiveVariant, phase: status, completed: true }),
        })
      }
    } catch (err) {
      console.warn(
        `[RaceQualifyingOrchestratorService] Erro ao persistir ${phase} (${effectiveVariant}) no PocketBase:`,
        err,
      )
    }

    // 2. Gravação no Cache Local
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(stateToPersist))
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
   * Alias de consulta para SQ2.
   */
  public async loadPersistedSQ2State(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<QualifyingPhaseExecutionState | null> {
    return this.loadPersistedPhaseState('SQ2', careerId, seasonId, round)
  }

  /**
   * Alias de consulta para SQ3.
   */
  public async loadPersistedSQ3State(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<QualifyingPhaseExecutionState | null> {
    return this.loadPersistedPhaseState('SQ3', careerId, seasonId, round)
  }

  /**
   * Constrói e persiste o resultado global da classificação Sprint (SPRINT_QUALIFYING_RESULT_READY)
   * a partir EXCLUSIVAMENTE dos resultados persistidos de SQ1, SQ2 e SQ3.
   *
   * REGRAS ESPORTIVAS E INVARIANTES:
   * 1. SQ3_COMPLETE → SPRINT_QUALIFYING_COMPLETE → SPRINT_QUALIFYING_RESULT_READY.
   * 2. P1–P10: ordem final do SQ3.
   * 3. P11–P18: os 8 eliminados no SQ2, ordenados exclusivamente pelo resultado persistido do SQ2.
   * 4. P19–P24: os 6 eliminados no SQ1, ordenados exclusivamente pelo resultado persistido do SQ1.
   * 5. Precedência de fase: tempo de fase anterior NÃO reordena participantes de fase posterior.
   * 6. Bijeção estrita: exatamente uma ocorrência de cada participante original, posições contínuas P1..P24.
   *    Se houver duplicata, participante ausente ou desconhecido, lança erro explícito.
   * 7. Zero consumo de RNG, zero recálculo de tempos ou setup.
   * 8. Idempotência estrita: reexecutar devolve o mesmo artefato idêntico.
   */
  public async buildSprintQualifyingResultLegacy(params: {
    careerId: string
    seasonId: string
    round: number
  }): Promise<SprintQualifyingResultState> {
    const { careerId, seasonId, round } = params

    if (!careerId || !seasonId || round <= 0) {
      throw new Error(
        `Contexto de carreira/temporada inválido: careerId='${careerId}', seasonId='${seasonId}', round=${round}`,
      )
    }

    const storageKey = buildGlobalSprintQualifyingStorageKey(careerId, seasonId, round)

    // 1. CHECAGEM DE IDEMPOTÊNCIA PRÉVIA
    const existing = await this.loadPersistedSprintQualifyingResult(careerId, seasonId, round)
    if (
      existing &&
      existing.status === 'SPRINT_QUALIFYING_RESULT_READY' &&
      existing.results?.length > 0
    ) {
      this.inMemoryCache.set(storageKey, existing as any)
      return existing
    }

    // 2. CARREGAR RESULTADOS PERSISTIDOS DE SQ1, SQ2 E SQ3
    const sq1State = await this.loadPersistedPhaseState('SQ1', careerId, seasonId, round)
    if (!sq1State || !sq1State.isCompleted) {
      throw new Error(
        `Não é possível consolidar o resultado da Quali Sprint: SQ1 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
      )
    }

    const sq2State = await this.loadPersistedPhaseState('SQ2', careerId, seasonId, round)
    if (!sq2State || !sq2State.isCompleted) {
      throw new Error(
        `Não é possível consolidar o resultado da Quali Sprint: SQ2 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
      )
    }

    const sq3State = await this.loadPersistedPhaseState('SQ3', careerId, seasonId, round)
    if (!sq3State || !sq3State.isCompleted) {
      throw new Error(
        `Não é possível consolidar o resultado da Quali Sprint: SQ3 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
      )
    }

    // 3. MAPAS DE TEMPOS POR FASE (FATOS JÁ PERSISTIDOS)
    const sq1Map = new Map(sq1State.results.map((r) => [r.driverId, r]))
    const sq2Map = new Map(sq2State.results.map((r) => [r.driverId, r]))
    const sq3Map = new Map(sq3State.results.map((r) => [r.driverId, r]))

    // 4. BIJEÇÃO E CONFERÊNCIA RIGOROSA DE PARTICIPANTES ORIGINAIS
    const originalParticipants = sq1State.results
    const totalEntrants = originalParticipants.length
    if (totalEntrants === 0) {
      throw new Error('Nenhum participante encontrado no resultado persistido do SQ1.')
    }

    const originalDriverIdsSet = new Set(originalParticipants.map((p) => p.driverId))
    if (originalDriverIdsSet.size !== totalEntrants) {
      throw new Error(
        `Violação de bijeção no SQ1: participantes duplicados detectados (${totalEntrants} registros, ${originalDriverIdsSet.size} únicos).`,
      )
    }

    // 5. AGRUPAMENTO POR FASES
    // P1–P10: pilotos do SQ3 (ordenados pela posição já persistida do SQ3)
    const sq3Ordered = [...sq3State.results].sort((a, b) => a.position - b.position)

    // P11–P18: eliminados do SQ2 (ordenados pela posição já persistida do SQ2)
    const sq2Eliminated = sq2State.results
      .filter((r) => r.isEliminated || sq2State.eliminatedDriverIds.includes(r.driverId))
      .sort((a, b) => a.position - b.position)

    // P19–P24: eliminados do SQ1 (ordenados pela posição já persistida do SQ1)
    const sq1Eliminated = sq1State.results
      .filter((r) => r.isEliminated || sq1State.eliminatedDriverIds.includes(r.driverId))
      .sort((a, b) => a.position - b.position)

    // 6. VALIDAÇÕES EXPLÍCITAS DE INTEGRIDADE
    const sq3DriverIds = sq3Ordered.map((r) => r.driverId)
    const sq2ElimDriverIds = sq2Eliminated.map((r) => r.driverId)
    const sq1ElimDriverIds = sq1Eliminated.map((r) => r.driverId)

    for (const dId of sq3DriverIds) {
      if (sq2ElimDriverIds.includes(dId)) {
        throw new Error(
          `Violação de integridade esportiva Sprint: piloto '${dId}' classificado no SQ3 consta também como eliminado no SQ2.`,
        )
      }
      if (sq1ElimDriverIds.includes(dId)) {
        throw new Error(
          `Violação de integridade esportiva Sprint: piloto '${dId}' classificado no SQ3 consta também como eliminado no SQ1.`,
        )
      }
    }
    for (const dId of sq2ElimDriverIds) {
      if (sq1ElimDriverIds.includes(dId)) {
        throw new Error(
          `Violação de integridade esportiva Sprint: piloto '${dId}' eliminado no SQ2 consta também como eliminado no SQ1.`,
        )
      }
    }

    const candidateIds = [...sq3DriverIds, ...sq2ElimDriverIds, ...sq1ElimDriverIds]
    for (const dId of candidateIds) {
      if (!originalDriverIdsSet.has(dId)) {
        throw new Error(
          `Violação de integridade esportiva Sprint: piloto desconhecido '${dId}' não estava nos participantes originais do SQ1.`,
        )
      }
    }

    if (candidateIds.length !== totalEntrants) {
      throw new Error(
        `Violação de bijeção na contagem Sprint: candidatos somam ${candidateIds.length}, esperado ${totalEntrants} participantes.`,
      )
    }

    const candidateSet = new Set(candidateIds)
    if (candidateSet.size !== totalEntrants) {
      throw new Error(
        `Violação de bijeção Sprint: piloto duplicado detectado na união das fases (${candidateIds.length} registros, ${candidateSet.size} únicos).`,
      )
    }

    for (const origId of originalDriverIdsSet) {
      if (!candidateSet.has(origId)) {
        throw new Error(
          `Violação de bijeção Sprint: participante original '${origId}' ausente na consolidação do resultado global.`,
        )
      }
    }

    // 7. COMPOSIÇÃO BIJETIVA DO RESULTADO SPRINT (P1..P24)
    const sprintEntries: SprintQualifyingResultEntry[] = []
    let currentPosition = 1

    // P1–P10 (SQ3)
    for (const r of sq3Ordered) {
      const sq1Data = sq1Map.get(r.driverId)
      const sq2Data = sq2Map.get(r.driverId)
      sprintEntries.push({
        position: currentPosition++,
        driverId: r.driverId,
        driverName: r.driverName,
        teamId: r.teamId,
        teamName: r.teamName,
        carIndex: r.carIndex,
        eliminationPhase: 'SQ3',
        phaseBestTimeMs: r.bestTimeMs,
        formattedPhaseBestTime: r.formattedBestTime,
        setup: r.setup,
        sq1BestTimeMs: sq1Data?.bestTimeMs,
        sq2BestTimeMs: sq2Data?.bestTimeMs,
        sq3BestTimeMs: r.bestTimeMs,
      })
    }

    // P11–P18 (SQ2 eliminados)
    for (const r of sq2Eliminated) {
      const sq1Data = sq1Map.get(r.driverId)
      sprintEntries.push({
        position: currentPosition++,
        driverId: r.driverId,
        driverName: r.driverName,
        teamId: r.teamId,
        teamName: r.teamName,
        carIndex: r.carIndex,
        eliminationPhase: 'SQ2',
        phaseBestTimeMs: r.bestTimeMs,
        formattedPhaseBestTime: r.formattedBestTime,
        setup: r.setup,
        sq1BestTimeMs: sq1Data?.bestTimeMs,
        sq2BestTimeMs: r.bestTimeMs,
        sq3BestTimeMs: undefined,
      })
    }

    // P19–P24 (SQ1 eliminados)
    for (const r of sq1Eliminated) {
      sprintEntries.push({
        position: currentPosition++,
        driverId: r.driverId,
        driverName: r.driverName,
        teamId: r.teamId,
        teamName: r.teamName,
        carIndex: r.carIndex,
        eliminationPhase: 'SQ1',
        phaseBestTimeMs: r.bestTimeMs,
        formattedPhaseBestTime: r.formattedBestTime,
        setup: r.setup,
        sq1BestTimeMs: r.bestTimeMs,
        sq2BestTimeMs: undefined,
        sq3BestTimeMs: undefined,
      })
    }

    const finalPositions = sprintEntries.map((e) => e.position)
    const expectedPositions = Array.from({ length: totalEntrants }, (_, i) => i + 1)
    if (JSON.stringify(finalPositions) !== JSON.stringify(expectedPositions)) {
      throw new Error(
        `Violação de bijeção de posições Sprint: posições geradas não são contínuas de 1 a ${totalEntrants}.`,
      )
    }

    const poleEntry = sprintEntries[0]
    const sprintState: SprintQualifyingResultState = {
      careerId,
      seasonId,
      round,
      configVersion: sq3State.configVersion || sq1State.configVersion || 'v1',
      configSha256: sq3State.configSha256 || sq1State.configSha256,
      status: 'SPRINT_QUALIFYING_RESULT_READY',
      totalParticipants: totalEntrants,
      results: sprintEntries,
      poleDriverId: poleEntry?.driverId || '',
      poleDriverName: poleEntry?.driverName || '',
      poleTimeMs: poleEntry?.phaseBestTimeMs || 0,
      formattedPoleTime: poleEntry?.formattedPhaseBestTime || '-:--.---',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await this.persistSprintQualifyingResult(sprintState)
    this.inMemoryCache.set(storageKey, sprintState as any)

    return sprintState
  }

  /**
   * Consulta o estado salvo do resultado da Quali Sprint.
   */
  public async loadPersistedSprintQualifyingResultLegacy(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<SprintQualifyingResultState | null> {
    const storageKey = buildGlobalSprintQualifyingStorageKey(careerId, seasonId, round)

    if (this.inMemoryCache.has(storageKey)) {
      return this.inMemoryCache.get(storageKey) as unknown as SprintQualifyingResultState
    }

    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round}`,
      })
      if (records.items.length > 0) {
        for (const item of records.items) {
          const strategies = (item.driver_strategies as any) || {}
          if (strategies.sprintQualifyingResult) {
            const loaded = strategies.sprintQualifyingResult as SprintQualifyingResultState
            this.inMemoryCache.set(storageKey, loaded as any)
            return loaded
          }
        }
      }
    } catch {
      // Ignora erro de PB e tenta cache local
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          const parsed = JSON.parse(raw) as SprintQualifyingResultState
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
   * Persiste o resultado da Quali Sprint de forma resiliente.
   */
  public async persistSprintQualifyingResultLegacy(
    state: SprintQualifyingResultState,
  ): Promise<void> {
    const { careerId, seasonId, round, status } = state
    const storageKey = buildGlobalSprintQualifyingStorageKey(careerId, seasonId, round)

    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "sq3"`,
      })

      if (records.items.length > 0) {
        const existing = records.items[0]
        const strategies = (existing.driver_strategies as any) || {}
        strategies.sprintQualifyingResult = state
        await pb.collection('session_setups').update(existing.id, {
          driver_strategies: strategies,
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      } else {
        await pb.collection('session_setups').create({
          team_id: careerId,
          season_id: seasonId,
          round,
          session: 'sq3',
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            sprintQualifyingResult: state,
          },
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      }
    } catch (err) {
      console.warn(`[RaceQualifyingOrchestratorService] Erro ao persistir resultado Sprint:`, err)
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state))
      } catch {
        // ignore
      }
    }
  }

  /**
   * Constrói e persiste o SPRINT_STARTING_GRID a partir do SPRINT_QUALIFYING_RESULT.
   * Não mistura com o grid da corrida principal.
   */
  public async buildSprintStartingGridLegacy(params: {
    careerId: string
    seasonId: string
    round: number
  }): Promise<SprintStartingGridState> {
    const { careerId, seasonId, round } = params

    if (!careerId || !seasonId || round <= 0) {
      throw new Error(
        `Contexto de carreira/temporada inválido: careerId='${careerId}', seasonId='${seasonId}', round=${round}`,
      )
    }

    const storageKey = buildSprintStartingGridStorageKey(careerId, seasonId, round)

    // 1. CHECAGEM DE IDEMPOTÊNCIA
    const existing = await this.loadPersistedSprintStartingGrid(careerId, seasonId, round)
    if (existing && existing.grid?.length > 0) {
      this.inMemoryCache.set(storageKey, existing as any)
      return existing
    }

    // 2. RECUPERA SPRINT_QUALIFYING_RESULT
    let sprintQuali = await this.loadPersistedSprintQualifyingResult(careerId, seasonId, round)
    if (!sprintQuali || sprintQuali.status !== 'SPRINT_QUALIFYING_RESULT_READY') {
      sprintQuali = await this.buildSprintQualifyingResult({ careerId, seasonId, round })
    }

    const qualifyingEntries = sprintQuali.results
    const totalEntrants = qualifyingEntries.length
    if (totalEntrants === 0) {
      throw new Error('SPRINT_QUALIFYING_RESULT vazio: impossível formar o grid da Sprint.')
    }

    // 3. PENALIDADES: REGRA EXPLÍCITA
    // Não inventar regra nova de penalidade para Sprint; mantém grid derivado diretamente
    // da Quali Sprint sem penalidades de PU do GP a menos que haja regra homologada futura.
    const startingGrid: SprintStartingGridEntry[] = qualifyingEntries.map((entry, index) => {
      const gridPosition = index + 1
      return {
        gridPosition,
        qualifyingPosition: entry.position,
        driverId: entry.driverId,
        driverName: entry.driverName,
        teamId: entry.teamId,
        teamName: entry.teamName,
        carIndex: entry.carIndex,
        eliminationPhase: entry.eliminationPhase,
        qualifyingTimeMs: entry.phaseBestTimeMs,
        formattedQualifyingTime: entry.formattedPhaseBestTime,
        setup: entry.setup,
        penalties: [],
        totalPenaltyPositions: 0,
        hasPenalty: false,
      }
    })

    // 4. VALIDAÇÃO DE BIJEÇÃO
    const driverIdsSet = new Set(startingGrid.map((g) => g.driverId))
    if (driverIdsSet.size !== totalEntrants) {
      throw new Error(
        `Regressão de pilotos duplicados detectada no SPRINT_STARTING_GRID: ${totalEntrants} entradas, ${driverIdsSet.size} motoristas únicos.`,
      )
    }

    const poleEntry = startingGrid[0]

    const sprintGridState: SprintStartingGridState = {
      careerId,
      seasonId,
      round,
      configVersion: sprintQuali.configVersion,
      configSha256: sprintQuali.configSha256,
      status: 'SPRINT_GRID_READY',
      totalParticipants: totalEntrants,
      grid: startingGrid,
      poleDriverId: poleEntry.driverId,
      poleDriverName: poleEntry.driverName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await this.persistSprintStartingGrid(sprintGridState)
    this.inMemoryCache.set(storageKey, sprintGridState as any)

    return sprintGridState
  }

  /**
   * Consulta o SPRINT_STARTING_GRID persistido.
   */
  public async loadPersistedSprintStartingGridLegacy(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<SprintStartingGridState | null> {
    const storageKey = buildSprintStartingGridStorageKey(careerId, seasonId, round)

    if (this.inMemoryCache.has(storageKey)) {
      return this.inMemoryCache.get(storageKey) as unknown as SprintStartingGridState
    }

    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round}`,
      })
      if (records.items.length > 0) {
        for (const item of records.items) {
          const strategies = (item.driver_strategies as any) || {}
          if (strategies.sprintStartingGridState) {
            const loaded = strategies.sprintStartingGridState as SprintStartingGridState
            this.inMemoryCache.set(storageKey, loaded as any)
            return loaded
          }
        }
      }
    } catch {
      // ignora erro
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          const parsed = JSON.parse(raw) as SprintStartingGridState
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
   * Persiste o SPRINT_STARTING_GRID de forma resiliente.
   */
  public async persistSprintStartingGridLegacy(state: SprintStartingGridState): Promise<void> {
    const { careerId, seasonId, round, status } = state
    const storageKey = buildSprintStartingGridStorageKey(careerId, seasonId, round)

    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "sq3"`,
      })

      if (records.items.length > 0) {
        const existing = records.items[0]
        const strategies = (existing.driver_strategies as any) || {}
        strategies.sprintStartingGridState = state
        await pb.collection('session_setups').update(existing.id, {
          driver_strategies: strategies,
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      } else {
        await pb.collection('session_setups').create({
          team_id: careerId,
          season_id: seasonId,
          round,
          session: 'sq3',
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            sprintStartingGridState: state,
          },
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      }
    } catch (err) {
      console.warn(
        `[RaceQualifyingOrchestratorService] Erro ao persistir starting grid Sprint:`,
        err,
      )
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state))
      } catch {
        // ignore
      }
    }
  }

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

  /**
   * Constrói e persiste o resultado global da classificação Sprint (SPRINT_QUALIFYING_RESULT_READY)
   * a partir EXCLUSIVAMENTE dos resultados persistidos de SQ1, SQ2 e SQ3.
   *
   * REGRAS ESPORTIVAS E INVARIANTES:
   * 1. SQ3_COMPLETE → SPRINT_QUALIFYING_COMPLETE → SPRINT_QUALIFYING_RESULT_READY.
   * 2. P1–P10: ordem final do SQ3.
   * 3. P11–P18: os 8 eliminados no SQ2, ordenados exclusivamente pelo resultado persistido do SQ2.
   * 4. P19–P24: os 6 eliminados no SQ1, ordenados exclusivamente pelo resultado persistido do SQ1.
   * 5. Precedência de fase: tempo de fase anterior NÃO reordena participantes de fase posterior.
   * 6. Bijeção estrita: exatamente uma ocorrência de cada participante original, posições contínuas P1..P24.
   *    Se houver duplicata, participante ausente ou desconhecido, lança erro explícito.
   * 7. Zero consumo de RNG, zero recálculo de tempos ou setup.
   * 8. Idempotência estrita: reexecutar devolve o mesmo artefato idêntico.
   */
  public async buildSprintQualifyingResult(params: {
    careerId: string
    seasonId: string
    round: number
  }): Promise<SprintQualifyingResultState> {
    const { careerId, seasonId, round } = params

    if (!careerId || !seasonId || round <= 0) {
      throw new Error(
        `Contexto de carreira/temporada inválido: careerId='${careerId}', seasonId='${seasonId}', round=${round}`,
      )
    }

    const storageKey = buildGlobalSprintQualifyingStorageKey(careerId, seasonId, round)

    // 1. CHECAGEM DE IDEMPOTÊNCIA PRÉVIA
    const existing = await this.loadPersistedSprintQualifyingResult(careerId, seasonId, round)
    if (
      existing &&
      existing.status === 'SPRINT_QUALIFYING_RESULT_READY' &&
      existing.results?.length > 0
    ) {
      this.inMemoryCache.set(storageKey, existing as any)
      return existing
    }

    // 2. CARREGAR RESULTADOS PERSISTIDOS DE SQ1, SQ2 E SQ3
    const sq1State = await this.loadPersistedPhaseState('SQ1', careerId, seasonId, round)
    if (!sq1State || !sq1State.isCompleted) {
      throw new Error(
        `Não é possível consolidar o resultado da Quali Sprint: SQ1 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
      )
    }

    const sq2State = await this.loadPersistedPhaseState('SQ2', careerId, seasonId, round)
    if (!sq2State || !sq2State.isCompleted) {
      throw new Error(
        `Não é possível consolidar o resultado da Quali Sprint: SQ2 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
      )
    }

    const sq3State = await this.loadPersistedPhaseState('SQ3', careerId, seasonId, round)
    if (!sq3State || !sq3State.isCompleted) {
      throw new Error(
        `Não é possível consolidar o resultado da Quali Sprint: SQ3 não concluído para careerId='${careerId}', seasonId='${seasonId}', round=${round}.`,
      )
    }

    // 3. MAPAS DE TEMPOS POR FASE (FATOS JÁ PERSISTIDOS)
    const sq1Map = new Map(sq1State.results.map((r) => [r.driverId, r]))
    const sq2Map = new Map(sq2State.results.map((r) => [r.driverId, r]))
    const sq3Map = new Map(sq3State.results.map((r) => [r.driverId, r]))

    // 4. BIJEÇÃO E CONFERÊNCIA RIGOROSA DE PARTICIPANTES ORIGINAIS
    const originalParticipants = sq1State.results
    const totalEntrants = originalParticipants.length
    if (totalEntrants === 0) {
      throw new Error('Nenhum participante encontrado no resultado persistido do SQ1.')
    }

    const originalDriverIdsSet = new Set(originalParticipants.map((p) => p.driverId))
    if (originalDriverIdsSet.size !== totalEntrants) {
      throw new Error(
        `Violação de bijeção no SQ1: participantes duplicados detectados (${totalEntrants} registros, ${originalDriverIdsSet.size} únicos).`,
      )
    }

    // 5. AGRUPAMENTO POR FASES
    // P1–P10: pilotos do SQ3 (ordenados pela posição já persistida do SQ3)
    const sq3Ordered = [...sq3State.results].sort((a, b) => a.position - b.position)

    // P11–P18: eliminados do SQ2 (ordenados pela posição já persistida do SQ2)
    const sq2Eliminated = sq2State.results
      .filter((r) => r.isEliminated || sq2State.eliminatedDriverIds.includes(r.driverId))
      .sort((a, b) => a.position - b.position)

    // P19–P24: eliminados do SQ1 (ordenados pela posição já persistida do SQ1)
    const sq1Eliminated = sq1State.results
      .filter((r) => r.isEliminated || sq1State.eliminatedDriverIds.includes(r.driverId))
      .sort((a, b) => a.position - b.position)

    // 6. VALIDAÇÕES EXPLÍCITAS DE INTEGRIDADE ANTES DA MONTAGEM
    const sq3DriverIds = sq3Ordered.map((r) => r.driverId)
    const sq2ElimDriverIds = sq2Eliminated.map((r) => r.driverId)
    const sq1ElimDriverIds = sq1Eliminated.map((r) => r.driverId)

    for (const dId of sq3DriverIds) {
      if (sq2ElimDriverIds.includes(dId)) {
        throw new Error(
          `Violação de integridade esportiva Sprint: piloto '${dId}' classificado no SQ3 consta também como eliminado no SQ2.`,
        )
      }
      if (sq1ElimDriverIds.includes(dId)) {
        throw new Error(
          `Violação de integridade esportiva Sprint: piloto '${dId}' classificado no SQ3 consta também como eliminado no SQ1.`,
        )
      }
    }
    for (const dId of sq2ElimDriverIds) {
      if (sq1ElimDriverIds.includes(dId)) {
        throw new Error(
          `Violação de integridade esportiva Sprint: piloto '${dId}' eliminado no SQ2 consta também como eliminado no SQ1.`,
        )
      }
    }

    const candidateIds = [...sq3DriverIds, ...sq2ElimDriverIds, ...sq1ElimDriverIds]
    for (const dId of candidateIds) {
      if (!originalDriverIdsSet.has(dId)) {
        throw new Error(
          `Violação de integridade esportiva Sprint: piloto desconhecido '${dId}' não estava nos participantes originais do SQ1.`,
        )
      }
    }

    if (candidateIds.length !== totalEntrants) {
      throw new Error(
        `Violação de bijeção Sprint na contagem: candidatos somam ${candidateIds.length}, esperado ${totalEntrants} participantes.`,
      )
    }

    const candidateSet = new Set(candidateIds)
    if (candidateSet.size !== totalEntrants) {
      throw new Error(
        `Violação de bijeção Sprint: piloto duplicado detectado na união das fases (${candidateIds.length} registros, ${candidateSet.size} únicos).`,
      )
    }

    for (const origId of originalDriverIdsSet) {
      if (!candidateSet.has(origId)) {
        throw new Error(
          `Violação de bijeção Sprint: participante original '${origId}' ausente na consolidação do resultado Sprint.`,
        )
      }
    }

    // 7. COMPOSIÇÃO BIJETIVA DO RESULTADO GLOBAL SPRINT (P1..P24)
    const sprintEntries: SprintQualifyingResultEntry[] = []
    let currentPosition = 1

    // P1–P10 (SQ3)
    for (const r of sq3Ordered) {
      const sq1Data = sq1Map.get(r.driverId)
      const sq2Data = sq2Map.get(r.driverId)
      sprintEntries.push({
        position: currentPosition++,
        driverId: r.driverId,
        driverName: r.driverName,
        teamId: r.teamId,
        teamName: r.teamName,
        carIndex: r.carIndex,
        eliminationPhase: 'SQ3',
        phaseBestTimeMs: r.bestTimeMs,
        formattedPhaseBestTime: r.formattedBestTime,
        setup: r.setup,
        sq1BestTimeMs: sq1Data?.bestTimeMs,
        sq2BestTimeMs: sq2Data?.bestTimeMs,
        sq3BestTimeMs: r.bestTimeMs,
      })
    }

    // P11–P18 (SQ2 eliminados)
    for (const r of sq2Eliminated) {
      const sq1Data = sq1Map.get(r.driverId)
      sprintEntries.push({
        position: currentPosition++,
        driverId: r.driverId,
        driverName: r.driverName,
        teamId: r.teamId,
        teamName: r.teamName,
        carIndex: r.carIndex,
        eliminationPhase: 'SQ2',
        phaseBestTimeMs: r.bestTimeMs,
        formattedPhaseBestTime: r.formattedBestTime,
        setup: r.setup,
        sq1BestTimeMs: sq1Data?.bestTimeMs,
        sq2BestTimeMs: r.bestTimeMs,
        sq3BestTimeMs: undefined,
      })
    }

    // P19–P24 (SQ1 eliminados)
    for (const r of sq1Eliminated) {
      sprintEntries.push({
        position: currentPosition++,
        driverId: r.driverId,
        driverName: r.driverName,
        teamId: r.teamId,
        teamName: r.teamName,
        carIndex: r.carIndex,
        eliminationPhase: 'SQ1',
        phaseBestTimeMs: r.bestTimeMs,
        formattedPhaseBestTime: r.formattedBestTime,
        setup: r.setup,
        sq1BestTimeMs: r.bestTimeMs,
        sq2BestTimeMs: undefined,
        sq3BestTimeMs: undefined,
      })
    }

    // Validação final de posições contínuas e únicas de 1 a N
    const finalPositions = sprintEntries.map((e) => e.position)
    const expectedPositions = Array.from({ length: totalEntrants }, (_, i) => i + 1)
    if (JSON.stringify(finalPositions) !== JSON.stringify(expectedPositions)) {
      throw new Error(
        `Violação de bijeção de posições Sprint: posições geradas não são contínuas de 1 a ${totalEntrants}.`,
      )
    }

    const poleEntry = sprintEntries[0]
    const sprintState: SprintQualifyingResultState = {
      careerId,
      seasonId,
      round,
      configVersion: sq3State.configVersion || sq1State.configVersion || 'v1',
      configSha256: sq3State.configSha256 || sq1State.configSha256,
      status: 'SPRINT_QUALIFYING_RESULT_READY',
      totalParticipants: totalEntrants,
      results: sprintEntries,
      poleDriverId: poleEntry?.driverId || '',
      poleDriverName: poleEntry?.driverName || '',
      poleTimeMs: poleEntry?.phaseBestTimeMs || 0,
      formattedPoleTime: poleEntry?.formattedPhaseBestTime || '-:--.---',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 8. PERSISTÊNCIA CANÔNICA (PocketBase + Cache Local)
    await this.persistSprintQualifyingResult(sprintState)
    this.inMemoryCache.set(storageKey, sprintState as any)

    return sprintState
  }

  /**
   * Consulta o resultado global da classificação Sprint.
   */
  public async loadPersistedSprintQualifyingResult(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<SprintQualifyingResultState | null> {
    const storageKey = buildGlobalSprintQualifyingStorageKey(careerId, seasonId, round)

    // 1. Memória rápida
    if (this.inMemoryCache.has(storageKey)) {
      return this.inMemoryCache.get(storageKey) as unknown as SprintQualifyingResultState
    }

    // 2. PocketBase session_setups com session = 'sq3'
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "sq3"`,
      })
      if (records.items.length > 0) {
        const item = records.items[0]
        const strategies = (item.driver_strategies as any) || {}
        if (strategies.sprintQualifyingResult) {
          const loaded = strategies.sprintQualifyingResult as SprintQualifyingResultState
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
          const parsed = JSON.parse(raw) as SprintQualifyingResultState
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
   * Grava o resultado global da classificação Sprint de forma resiliente.
   */
  public async persistSprintQualifyingResult(state: SprintQualifyingResultState): Promise<void> {
    const { careerId, seasonId, round, status } = state
    const storageKey = buildGlobalSprintQualifyingStorageKey(careerId, seasonId, round)

    // 1. PocketBase session_setups (session = 'sq3')
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "sq3"`,
      })

      if (records.items.length > 0) {
        const existing = records.items[0]
        const strategies = (existing.driver_strategies as any) || {}
        strategies.sprintQualifyingResult = state
        await pb.collection('session_setups').update(existing.id, {
          driver_strategies: strategies,
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      } else {
        await pb.collection('session_setups').create({
          team_id: careerId,
          season_id: seasonId,
          round,
          session: 'sq3',
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            sprintQualifyingResult: state,
          },
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      }
    } catch (err) {
      console.warn(
        `[RaceQualifyingOrchestratorService] Erro ao persistir resultado Sprint no PocketBase:`,
        err,
      )
    }

    // 2. Cache Local
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state))
      } catch {
        // ignore
      }
    }
  }

  /**
   * Constrói e persiste o SPRINT_STARTING_GRID a partir de SPRINT_QUALIFYING_RESULT.
   * Não aplica penalidades do GP por analogia silenciosa.
   * Transição para SPRINT_GRID_READY.
   */
  public async buildSprintStartingGrid(params: {
    careerId: string
    seasonId: string
    round: number
  }): Promise<SprintStartingGridState> {
    const { careerId, seasonId, round } = params

    if (!careerId || !seasonId || round <= 0) {
      throw new Error(
        `Contexto de carreira/temporada inválido: careerId='${careerId}', seasonId='${seasonId}', round=${round}`,
      )
    }

    const storageKey = buildSprintStartingGridStorageKey(careerId, seasonId, round)

    // 1. CHECAGEM DE IDEMPOTÊNCIA
    const existing = await this.loadPersistedSprintStartingGrid(careerId, seasonId, round)
    if (existing && existing.grid?.length > 0) {
      if (existing.status !== 'SPRINT_GRID_READY') {
        existing.status = 'SPRINT_GRID_READY'
        existing.updatedAt = new Date().toISOString()
        await this.persistSprintStartingGrid(existing)
      }
      this.inMemoryCache.set(storageKey, existing as any)
      return existing
    }

    // 2. CARREGA OU CONSTRÓI SPRINT_QUALIFYING_RESULT
    let sprintQuali = await this.loadPersistedSprintQualifyingResult(careerId, seasonId, round)
    if (!sprintQuali || sprintQuali.status !== 'SPRINT_QUALIFYING_RESULT_READY') {
      sprintQuali = await this.buildSprintQualifyingResult({ careerId, seasonId, round })
    }

    const sprintEntries = sprintQuali.results
    const totalEntrants = sprintEntries.length
    if (totalEntrants === 0) {
      throw new Error('SPRINT_QUALIFYING_RESULT vazio: impossível formar o grid da Sprint.')
    }

    // 3. DERIVAÇÃO DIRETA DO GRID DA SPRINT (Conforme item 16: sem penalidades do GP por analogia silenciosa)
    const sprintGrid: SprintStartingGridEntry[] = sprintEntries.map((item, index) => {
      const gridPosition = index + 1
      return {
        gridPosition,
        qualifyingPosition: item.position,
        driverId: item.driverId,
        driverName: item.driverName,
        teamId: item.teamId,
        teamName: item.teamName,
        carIndex: item.carIndex,
        eliminationPhase: item.eliminationPhase,
        qualifyingTimeMs: item.phaseBestTimeMs,
        formattedQualifyingTime: item.formattedPhaseBestTime,
        setup: item.setup,
        penalties: [],
        totalPenaltyPositions: 0,
        hasPenalty: false,
      }
    })

    // Validações de bijeção
    const driverIdsSet = new Set(sprintGrid.map((g) => g.driverId))
    if (driverIdsSet.size !== totalEntrants) {
      throw new Error(
        `Regressão de pilotos duplicados detectada no SPRINT_STARTING_GRID: ${totalEntrants} entradas, ${driverIdsSet.size} motoristas únicos.`,
      )
    }

    const poleEntry = sprintGrid[0]
    const sprintGridState: SprintStartingGridState = {
      careerId,
      seasonId,
      round,
      configVersion: sprintQuali.configVersion,
      configSha256: sprintQuali.configSha256,
      status: 'SPRINT_GRID_READY',
      totalParticipants: totalEntrants,
      grid: sprintGrid,
      poleDriverId: poleEntry.driverId,
      poleDriverName: poleEntry.driverName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Persistência
    await this.persistSprintStartingGrid(sprintGridState)
    this.inMemoryCache.set(storageKey, sprintGridState as any)

    return sprintGridState
  }

  /**
   * Consulta o SPRINT_STARTING_GRID persistido.
   */
  public async loadPersistedSprintStartingGrid(
    careerId: string,
    seasonId: string,
    round: number,
  ): Promise<SprintStartingGridState | null> {
    const storageKey = buildSprintStartingGridStorageKey(careerId, seasonId, round)

    // 1. Memória rápida
    if (this.inMemoryCache.has(storageKey)) {
      return this.inMemoryCache.get(storageKey) as unknown as SprintStartingGridState
    }

    // 2. PocketBase session_setups com session = 'sq3'
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "sq3"`,
      })
      if (records.items.length > 0) {
        const item = records.items[0]
        const strategies = (item.driver_strategies as any) || {}
        if (strategies.sprintStartingGridState) {
          const loaded = strategies.sprintStartingGridState as SprintStartingGridState
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
          const parsed = JSON.parse(raw) as SprintStartingGridState
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
   * Persiste o SPRINT_STARTING_GRID de forma resiliente.
   */
  public async persistSprintStartingGrid(state: SprintStartingGridState): Promise<void> {
    const { careerId, seasonId, round, status } = state
    const storageKey = buildSprintStartingGridStorageKey(careerId, seasonId, round)

    // 1. PocketBase session_setups (session = 'sq3')
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "sq3"`,
      })

      if (records.items.length > 0) {
        const existing = records.items[0]
        const strategies = (existing.driver_strategies as any) || {}
        strategies.sprintStartingGridState = state
        await pb.collection('session_setups').update(existing.id, {
          driver_strategies: strategies,
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      } else {
        await pb.collection('session_setups').create({
          team_id: careerId,
          season_id: seasonId,
          round,
          session: 'sq3',
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            sprintStartingGridState: state,
          },
          notes: JSON.stringify({ phase: status, completed: true }),
        })
      }
    } catch (err) {
      console.warn(
        `[RaceQualifyingOrchestratorService] Erro ao persistir sprint starting grid:`,
        err,
      )
    }

    // 2. Cache Local
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state))
      } catch {
        // ignore
      }
    }
  }

  /**
   * Conclui a Qualificação Sprint no weekend e avança para o Slot 3 (SPRINT_RACE / SPRINT).
   *
   * PRÉ-CONDIÇÕES OBRIGATÓRIAS (Item 19):
   * 1. SQ1 concluído e persistido.
   * 2. SQ2 concluído e persistido (18 -> 10).
   * 3. SQ3 concluído e persistido (10 classificados).
   * 4. SPRINT_QUALIFYING_RESULT construído, válido e persistido.
   * 5. SPRINT_STARTING_GRID construído, válido e persistido.
   *
   * Efeito:
   * currentSlot = 3
   * slotType = SPRINT_RACE (ou SPRINT)
   * slotStatus = AVAILABLE / READY
   * Não inicia a corrida Sprint. Não processa voltas. Não pontua.
   */
  public async transitionToSprintRaceSlot(params: {
    careerId: string
    seasonId: string
    round: number
  }): Promise<import('@/types/weekend-slot-types').CanonicalWeekendSlotState> {
    const { careerId, seasonId, round } = params

    // 1. Validar existência e integridade de SQ1, SQ2, SQ3
    const sq1 = await this.loadPersistedPhaseState('SQ1', careerId, seasonId, round)
    if (!sq1 || !sq1.isCompleted) {
      throw new Error(
        `Transição para slot 3 bloqueada: SQ1 não concluído para careerId='${careerId}', round=${round}.`,
      )
    }

    const sq2 = await this.loadPersistedPhaseState('SQ2', careerId, seasonId, round)
    if (!sq2 || !sq2.isCompleted) {
      throw new Error(
        `Transição para slot 3 bloqueada: SQ2 não concluído para careerId='${careerId}', round=${round}.`,
      )
    }

    const sq3 = await this.loadPersistedPhaseState('SQ3', careerId, seasonId, round)
    if (!sq3 || !sq3.isCompleted) {
      throw new Error(
        `Transição para slot 3 bloqueada: SQ3 não concluído para careerId='${careerId}', round=${round}.`,
      )
    }

    // 2. Validar existência e integridade de SPRINT_QUALIFYING_RESULT
    let sprintQualiResult = await this.loadPersistedSprintQualifyingResult(
      careerId,
      seasonId,
      round,
    )
    if (!sprintQualiResult || sprintQualiResult.status !== 'SPRINT_QUALIFYING_RESULT_READY') {
      sprintQualiResult = await this.buildSprintQualifyingResult({ careerId, seasonId, round })
    }

    // 3. Validar existência e integridade de SPRINT_STARTING_GRID
    let sprintGrid = await this.loadPersistedSprintStartingGrid(careerId, seasonId, round)
    if (!sprintGrid || sprintGrid.status !== 'SPRINT_GRID_READY') {
      sprintGrid = await this.buildSprintStartingGrid({ careerId, seasonId, round })
    }

    // 4. Executar transição no canonicalWeekendSlotPersistenceService
    const { canonicalWeekendSlotPersistenceService } =
      await import('@/services/canonicalWeekendSlotPersistenceService')
    const slotState = await canonicalWeekendSlotPersistenceService.getWeekendSlotState({
      careerId,
      seasonId,
      round,
    })

    const activeSlotNum = slotState.currentSlot
    const activeSlotType = slotState.slotType || slotState.slots[activeSlotNum]?.slotType

    // No formato Sprint de 8 slots: slot 3 é QUALI_SPRINT; no de 7 slots compacto: slot 2 é QUALI_SPRINT
    const targetSlot =
      activeSlotType === 'QUALI_SPRINT' || activeSlotType === 'SPRINT_QUALIFYING'
        ? activeSlotNum
        : slotState.slots[3]?.slotType === 'QUALI_SPRINT' ||
            slotState.slots[3]?.slotType === 'SPRINT_QUALIFYING'
          ? 3
          : 2

    if (slotState.completedSlots.includes(targetSlot) || slotState.currentSlot > targetSlot) {
      return slotState
    }

    if (slotState.currentSlot !== targetSlot) {
      throw new Error(
        `Transição inválida: o slot atual é ${slotState.currentSlot} (${slotState.slotType}), esperado slot ${targetSlot}.`,
      )
    }

    const updatedSlotState = await canonicalWeekendSlotPersistenceService.completeSlot(
      slotState,
      targetSlot,
      'SQ3',
    )

    return updatedSlotState
  }

  public clearMemoryCache(): void {
    this.inMemoryCache.clear()
  }
}

export const raceQualifyingOrchestratorService = new RaceQualifyingOrchestratorService()
export default raceQualifyingOrchestratorService
