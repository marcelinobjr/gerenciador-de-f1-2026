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

export type RaceDecisionType =
  | 'pit_stop_critical_wear'
  | 'pit_stop_strategy_window'
  | 'pit_stop_informed_recommendation'
  | 'pit_stop_weather_change'
  | 'operational_incident'

export interface RacePendingDecision {
  id: string
  type: RaceDecisionType
  driverId: string
  driverName?: string
  lap: number
  createdAt: string
  title: string
  description: string
  priority?: number
  options?: Array<{
    id: string
    label: string
    description?: string
  }>
  payload: Record<string, unknown>
}

export interface RaceResolvedDecision {
  eventId: string
  type: RaceDecisionType
  driverId: string
  lap: number
  resolvedAt: string
  resolvedByExecutorId: string
  choice: string
  consequenceSummary?: string
}

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
  // Etapa 2: Decisões pendentes e resolvidas persistidas no checkpoint
  pendingDecisions?: RacePendingDecision[]
  resolvedDecisions?: RaceResolvedDecision[]
  // Etapa 4D.2: Estoque e inventário de pneus por piloto sincronizados no checkpoint
  driverTireInventories?: Record<string, import('@/types/f1').TireSetItem[]>
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
