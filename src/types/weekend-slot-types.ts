/**
 * src/types/weekend-slot-types.ts
 *
 * Tipagens do sistema de slots de final de semana (Normal vs Sprint).
 */

export type WeekendFormat = 'NORMAL' | 'SPRINT'

export type WeekendSlotNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type WeekendSlotType =
  | 'TL1'
  | 'TL2'
  | 'TL3'
  | 'QUALI_SPRINT'
  | 'SPRINT_QUALIFYING'
  | 'SPRINT'
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'CORRIDA'

export type WeekendSlotStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_RUN'

export type SprintQualifyingSubPhase = 'SQ1' | 'SQ2' | 'SQ3'
export type MainQualifyingSubPhase = 'Q1' | 'Q2' | 'Q3'

export interface WeekendSlotDefinition {
  slotNumber: WeekendSlotNumber
  slotType: WeekendSlotType
  displayLabel: string
  shortLabel: string
  category:
    | 'PRACTICE'
    | 'QUALIFYING'
    | 'SPRINT'
    | 'RACE'
    | 'practice'
    | 'qualifying'
    | 'sprint'
    | 'race'
  isCompetitive?: boolean
  generatesSetup?: boolean
  description?: string
}

export interface WeekendSlotData {
  slotNumber: WeekendSlotNumber
  slotType: WeekendSlotType
  status: WeekendSlotStatus
  subPhase?: string | null
  completedAt?: string | null
}

export interface CanonicalWeekendSlotState {
  careerId?: string
  seasonId?: string
  round?: number
  weekendFormat: WeekendFormat
  configVersion?: string
  currentSlot: WeekendSlotNumber
  slotType?: WeekendSlotType
  slotStatus?: WeekendSlotStatus
  subPhase?: string | null
  completedSlots?: WeekendSlotNumber[]
  slots: Record<WeekendSlotNumber, WeekendSlotData>
  updatedAt?: string
  generation?: number
  weekendGeneration?: number
}

export interface WeekendSlotViewModel {
  slotNumber: WeekendSlotNumber
  slotType: WeekendSlotType
  displayLabel: string
  shortLabel: string
  status: WeekendSlotStatus
  subPhase: string | null
  isCurrent: boolean
  isCompleted: boolean
  isLocked: boolean
  isNotRun: boolean
}
