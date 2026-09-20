/**
 * canonical-qualifying-types.ts
 *
 * Modelos e Tipos Canônicos de Qualificação V2 (Q1, Q2, Q3) — F1 Manager 2026.
 * Etapa FW2.1D: Qualificação Real por Sessões e Eliminação Progressiva.
 *
 * Princípios:
 * 1. Sessões Reais: PREPARAÇÃO → INÍCIO → VOLTAS → RETORNO AOS BOXES → NOVA TENTATIVA → ENCERRAMENTO.
 * 2. Sem resultados instantâneos, sem sorteio de posições, sem fórmulas mágicas.
 * 3. Grid canônico de 24 carros:
 *    - Q1: 24 participantes, 18 avançam, 6 eliminados (P19–P24). Duração: 18 minutos (1080s).
 *    - Q2: 18 participantes, 10 avançam, 8 eliminados (P11–P18). Duração: 15 minutos (900s).
 *    - Q3: 10 participantes, define P1–P10. Duração: 12 minutos (720s).
 * 4. Pneus herdados do inventário de fim de semana (20 jogos por piloto).
 * 5. Parc Fermé: a partir do início de Q1, configurações de chassi ficam congeladas.
 */

import type { TireCompound, TireSetItem } from '@/types/f1'
import type { PracticeCarSetup } from '@/types/practice-preparation'

export type QualifyingStageId = 'q1' | 'q2' | 'q3'

export type QualifyingDriverStatus =
  | 'garage'
  | 'out_lap'
  | 'flying_lap'
  | 'in_lap'
  | 'classified'
  | 'eliminated'

export type QualifyingSessionStatus = 'not_started' | 'running' | 'paused' | 'completed'

export interface QualifyingStageRegulationConfig {
  stageId: QualifyingStageId
  durationSec: number // 1080 (18m), 900 (15m), 720 (12m)
  participantsCount: number // 24, 18, 10
  advancingCount: number // 18, 10, 10 (define P1-P10)
  eliminatedCount: number // 6, 8, 0
  minGridPos: number // P19, P11, P1
  maxGridPos: number // P24, P18, P10
}

export const CANONICAL_QUALIFYING_RULES: Record<
  QualifyingStageId,
  QualifyingStageRegulationConfig
> = {
  q1: {
    stageId: 'q1',
    durationSec: 18 * 60, // 1080s (18 minutos)
    participantsCount: 24,
    advancingCount: 18,
    eliminatedCount: 6,
    minGridPos: 19,
    maxGridPos: 24,
  },
  q2: {
    stageId: 'q2',
    durationSec: 15 * 60, // 900s (15 minutos)
    participantsCount: 18,
    advancingCount: 10,
    eliminatedCount: 8,
    minGridPos: 11,
    maxGridPos: 18,
  },
  q3: {
    stageId: 'q3',
    durationSec: 12 * 60, // 720s (12 minutos)
    participantsCount: 10,
    advancingCount: 10,
    eliminatedCount: 0,
    minGridPos: 1,
    maxGridPos: 10,
  },
}

export interface QualifyingLapRecord {
  lapNumber: number
  lapTimeSec: number
  lapTimeFormatted: string
  compound: TireCompound
  tyreSetId: string
  tyreWear: number
  fuelRemainingKg: number
  isValid: boolean
  isPersonalBest: boolean
  isSessionBest: boolean
  stintId: string
  timestamp: string
  recordedAtSessionSec: number
}

export interface QualifyingCarState {
  carId: 'car1' | 'car2'
  driverId: string
  driverName: string
  driverNumber?: number
  status: QualifyingDriverStatus
  pitRequested: boolean
  setup: PracticeCarSetup
  currentTyreSetId: string
  currentCompound: TireCompound
  tyreWear: number
  fuelKg: number
  outLapsDone: number
  flyingLapsDone: number
  inLapsDone: number
  totalLaps: number
  currentLapProgressPct: number // 0-100 dentro da volta atual
  lastLapTime?: string
  lastLapSec?: number
  bestLapTime?: string
  bestLapSec?: number
  bestLapNumber?: number
  bestLapCompound?: TireCompound
  bestLapTyreSetId?: string
  isEliminated: boolean
  eliminatedInStage?: QualifyingStageId
  currentStintId?: string
}

export interface QualifyingTimeEntry {
  position: number
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  teamColor: string
  compound: TireCompound
  tyreSetId?: string
  laps: number
  bestLapSec: number
  bestLapTime: string
  bestLapRecordedAtSec?: number // Desempate determinístico: primeiro a registrar o tempo fica à frente
  gap: string
  isPlayer: boolean
  carId?: 'car1' | 'car2'
  status: QualifyingDriverStatus
  isEliminated?: boolean
  eliminatedInStage?: QualifyingStageId
  carNumber?: number
}

export interface QualifyingRadioFeedEvent {
  id: string
  second: number
  type: 'info' | 'box' | 'out' | 'fast_lap' | 'tyre_alert' | 'elimination' | 'finish' | 'traffic'
  message: string
  driverName?: string
  carId?: 'car1' | 'car2'
  timestamp: string
}

export interface QualifyingStageState {
  stageId: QualifyingStageId
  status: QualifyingSessionStatus
  sessionDurationSec: number
  elapsedTimeSec: number
  timeRemainingSec: number
  simSpeed: 1 | 2 | 4
  cars: {
    car1: QualifyingCarState
    car2: QualifyingCarState
  }
  leaderboard: QualifyingTimeEntry[]
  lapHistory: Record<string, QualifyingLapRecord[]>
  radioFeed: QualifyingRadioFeedEvent[]
  parcFermeActive: boolean
  revision: number
  createdAt: string
  updatedAt: string
}

export interface QualifyingStageResult {
  stageId: QualifyingStageId
  seasonId: string
  round: number
  completedAt: string
  entries: Array<{
    position: number
    driverId: string
    driverName: string
    teamId: string
    teamName: string
    teamColor: string
    bestLapSec: number
    bestLapTime: string
    bestLapRecordedAtSec: number
    compound: TireCompound
    tyreSetId?: string
    lapsCount: number
    isPlayer: boolean
    carId?: 'car1' | 'car2'
    isEliminated: boolean
    eliminatedInStage?: QualifyingStageId
    assignedGridPosition?: number
  }>
  advancingDriverIds: string[]
  eliminatedDriverIds: string[]
}

export interface FinalQualifyingGridEntry {
  gridPosition: number // 1 a 24
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  carId?: 'car1' | 'car2'
  eliminationStage: 'Q1' | 'Q2' | 'Q3'
  bestLapSec: number
  bestLapTime: string
  bestLapCompound: TireCompound
  tyreSetId?: string
  q1LapTime?: string
  q2LapTime?: string
  q3LapTime?: string
}

export interface CompleteQualifyingWeekendResult {
  seasonId: string
  round: number
  completedAt: string
  poleDriverId: string
  poleDriverName: string
  poleLapTime: string
  q1Result: QualifyingStageResult
  q2Result: QualifyingStageResult
  q3Result: QualifyingStageResult
  finalGrid: FinalQualifyingGridEntry[] // 24 posições completas
}
