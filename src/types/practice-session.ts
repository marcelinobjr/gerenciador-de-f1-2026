import type { TireCompound } from './f1'
import type {
  PracticeSessionType,
  PracticeProgramType,
  PracticeCarSetup,
} from './practice-preparation'

export type PracticeCarTrackStatus = 'garage' | 'out_lap' | 'flying_lap' | 'in_lap'

export type PracticeSessionStatus = 'not_started' | 'running' | 'paused' | 'completed'

export interface PracticeLapRecord {
  lapNumber: number
  lapTimeSec: number
  lapTimeFormatted: string
  compound: TireCompound
  tyreWear: number
  fuelRemainingKg: number
  program: PracticeProgramType
  stintId: string
  isValid: boolean
  isPersonalBest: boolean
  isSessionBest: boolean
  timestamp: string
}

export interface PracticeStint {
  id: string
  driverId: string
  carId: 'car1' | 'car2'
  program: PracticeProgramType
  setupSnapshot: PracticeCarSetup
  tyreSetId: string
  compound: TireCompound
  initialFuelKg: number
  finalFuelKg?: number
  initialWear: number
  finalWear?: number
  lapsCount: number
  laps: PracticeLapRecord[]
  startedAt: string
  endedAt?: string
  status: 'active' | 'completed'
}

export type SetupConfidenceLevel = 'baixa' | 'media' | 'alta'
export type SetupAxisDirection = 'increase' | 'decrease' | 'ok'
export type SetupAxisSeverity = 'ideal' | 'moderada' | 'alta'

export interface SetupKnowledgeAxis {
  minKnown: number
  maxKnown: number
  confidence: SetupConfidenceLevel
  confidenceScore: number // 0 a 100 para cálculo interno / info secundária
  revealed: boolean // se já saiu do estado "?" inicial
}

export interface SetupKnowledgeModel {
  frontWing: SetupKnowledgeAxis
  rearWing: SetupKnowledgeAxis
  suspension: SetupKnowledgeAxis
  differential: SetupKnowledgeAxis
  overallConfidence: SetupConfidenceLevel
  totalStintsAnalyzed: number
  lastUpdatedStintId?: string
  updatedAt: string
}

export interface StintAxisFeedback {
  axis: 'frontWing' | 'rearWing' | 'suspension' | 'differential'
  axisLabel: string
  direction: SetupAxisDirection
  severity: SetupAxisSeverity
  confidence: SetupConfidenceLevel
  message: string
}

export interface StintFeedbackRecord {
  id: string // feedback_{sessionId}_{stintId}
  sessionId: string
  stintId: string
  driverId: string
  driverName: string
  carId: 'car1' | 'car2'
  setupSnapshot: PracticeCarSetup
  lapsCount: number
  program: PracticeProgramType
  timestamp: string
  quality: 'insufficient' | 'preliminary' | 'reliable'
  generalMessage: string
  axisFeedbacks: StintAxisFeedback[]
  knowledgeDelta?: {
    frontWing?: { min: number; max: number }
    rearWing?: { min: number; max: number }
    suspension?: { min: number; max: number }
    differential?: { min: number; max: number }
  }
}

export interface PracticeCarLiveState {
  carId: 'car1' | 'car2'
  driverId: string
  driverName: string
  status: PracticeCarTrackStatus
  pitRequested: boolean
  program: PracticeProgramType
  setup: PracticeCarSetup
  currentTyreSetId: string
  currentCompound: TireCompound
  tyreWear: number
  fuelKg: number
  lapsInStint: number
  totalLaps: number
  lastLapTime?: string
  lastLapSec?: number
  bestLapTime?: string
  bestLapSec?: number
  currentStintId?: string
  currentLapProgressPct: number // 0 a 100 dentro da fase
}

export interface PracticeTimeEntry {
  position: number
  driverId: string
  driverName: string
  teamName: string
  teamColor: string
  compound: TireCompound
  laps: number
  bestLapSec: number
  bestLapTime: string
  gap: string
  lastLapSec?: number
  lastLapTime?: string
  isPlayer: boolean
  carId?: 'car1' | 'car2'
  isRookie?: boolean
}

export interface PracticeRadioFeedEvent {
  id: string
  second: number
  type: 'info' | 'box' | 'out' | 'fast_lap' | 'tyre_alert' | 'weather' | 'finish'
  message: string
  driverName?: string
  carId?: 'car1' | 'car2'
  timestamp: string
}

export interface PracticeSessionRecordState {
  careerId: string
  seasonId: string
  round: number
  sessionType: PracticeSessionType
  status: PracticeSessionStatus
  sessionDurationSec: number // canônico = 3600 (60 minutos)
  elapsedTimeSec: number
  timeRemainingSec: number
  simSpeed: 1 | 2 | 4
  cars: {
    car1: PracticeCarLiveState
    car2: PracticeCarLiveState
  }
  stints: PracticeStint[]
  lapHistory: Record<string, PracticeLapRecord[]>
  leaderboard: PracticeTimeEntry[]
  radioFeed: PracticeRadioFeedEvent[]
  feedbacks: StintFeedbackRecord[]
  knowledge: SetupKnowledgeModel
  unreadFeedbackCarIds?: Array<'car1' | 'car2'>
  // Etapa 4C2: Conhecimento Progressivo de Pneus e Comportamento dos Compostos
  tyreObservations?: import('./practice-tyres').TyreStintObservation[]
  tyreKnowledge?: import('./practice-tyres').WeekendTyreKnowledge
  activeExecutorId?: string
  executorLeaseUntil?: string
  lockHeartbeatAt?: string
  revision: number
  createdAt: string
  updatedAt: string
}

export const CANONICAL_PRACTICE_DURATION_SEC = 3600 // 60 minutos
