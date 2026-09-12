import type { WeekendSession, LiveRaceEvent } from '@/types/race-events'
import type { RaceResultEntry } from '@/components/race/RaceResultsTable'
import type { SessionResultRow } from '@/components/race/PracticeQualyResults'
import type { TireCompound, TireCliffStatus } from '@/lib/f1-tire-system'

export type { WeekendSession, LiveRaceEvent }

export interface SimDriverEntry extends RaceResultEntry {
  nationality?: string
  score: number
  points: number
  fastestLap: boolean
  usedOvertake: boolean
  accumulatedTimeSec: number
  lapsCompleted: number
  lastLapTimeSec?: number
  lapsInDirtyAir?: number
  tireCompound?: TireCompound
  secondCompound?: TireCompound
  pitLap?: number
  tireWear?: number
  driverFatigue?: number
  morale?: number
  physicalCondition?: number
  oldMorale?: number
  newMorale?: number
  moraleDelta?: number
  oldPhysical?: number
  newPhysical?: number
  physicalDelta?: number
  pitStopsDone?: number
  hasWingDamage?: boolean
  lastLapTime?: string
  gapToLeader?: string
  gapToFront?: string
  wearMultiplier?: number
  wearProfileName?: string
  strategyPlan?: { lap: number; compound: TireCompound }[]
  lapsOnCurrentTire?: number
  cliffStatus?: TireCliffStatus
  dnfLap?: number
  fuelRemaining?: number // % combustível restante (0 a 110)
  carPartsHealth?: { id: string; name: string; condition: number }[]
  aiStrategyProfile?: {
    type: 'conservadora' | 'equilibrada' | 'agressiva' | 'reativa'
    label: string
    color: string
    badgeBg: string
    description: string
  }
}

export type SessionTimeResult = SessionResultRow
