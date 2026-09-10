import { TireCompound } from '@/types/f1'

export type WeekendSession = 'tp1' | 'tp2' | 'q1' | 'q2' | 'q3' | 'race'

export interface LiveRaceEvent {
  id: string
  lap: number
  type:
    | 'overtake'
    | 'fastest_lap'
    | 'tire_warning'
    | 'incident'
    | 'safety_car'
    | 'weather'
    | 'pit_stop'
    | 'info'
    | 'team_radio'
  message: string
  driverName?: string
  teamColor?: string
  isPlayer?: boolean
  timestamp: string
}
