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
  activeExecutorId?: string
  executorLeaseUntil?: string
  lockHeartbeatAt?: string
  revision: number
  createdAt: string
  updatedAt: string
}

export const CANONICAL_PRACTICE_DURATION_SEC = 3600 // 60 minutos
