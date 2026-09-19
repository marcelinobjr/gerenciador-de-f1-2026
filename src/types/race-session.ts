import type { SimDriverEntry } from '@/pages/race/types'
import type { LiveRaceEvent } from '@/types/race-events'
import type { LapRecord } from '@/components/race/LiveStandingsTable'
import type { TrackWeatherState } from '@/lib/f1-tire-system'

export type RaceSessionStatus =
  | 'not_started'
  | 'in_progress'
  | 'paused'
  | 'awaiting_decision'
  | 'completed'
  | 'recovering'

export type RaceSessionType = 'race' | 'sprint'

export interface RaceSessionCheckpointData {
  grid: SimDriverEntry[]
  currentLap: number
  totalLaps: number
  weather: TrackWeatherState
  liveEvents: LiveRaceEvent[]
  playerCarTactics: Record<string, 'attack' | 'normal' | 'save_fuel'>
  playerPaceOrders: Record<string, 'normal' | 'empurrar' | 'segurar'>
  mechanicalIssues: Array<{
    driverId: string
    name: string
    severity: 'minor' | 'moderate' | 'severe'
    isDnf?: boolean
    pacePenaltySec?: number
  }>
  penalties: any[]
  redFlagState?: {
    active: boolean
    ticksFrozen: number
    usedThisRace: boolean
    safetyCarLapsRemaining: number
  }
  safetyCarActive?: boolean
  seed?: number
  lastSavedAt: string
}

export interface RaceSessionRecord {
  id: string
  session_key: string
  season_id: string
  team_id: string
  user_id: string
  season_year: number
  round: number
  session_type: RaceSessionType
  status: RaceSessionStatus
  revision: number
  current_lap: number
  total_laps: number
  sim_speed: number
  pause_reason?: string
  active_executor_id?: string
  executor_lease_until?: string
  lock_heartbeat_at?: string
  checkpoint_data?: RaceSessionCheckpointData
  lap_history?: Record<string, LapRecord[]>
  created: string
  updated: string
}
