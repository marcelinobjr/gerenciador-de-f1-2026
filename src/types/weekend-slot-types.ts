/**
 * src/types/weekend-slot-types.ts
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01A
 * Tipos canônicos da arquitetura de 7 slots do fim de semana.
 *
 * FORMATOS:
 * - NORMAL:
 *   slot 1 = TL1, slot 2 = TL2, slot 3 = TL3, slot 4 = Q1, slot 5 = Q2, slot 6 = Q3, slot 7 = CORRIDA
 * - SPRINT:
 *   slot 1 = TL1, slot 2 = QUALI_SPRINT, slot 3 = SPRINT, slot 4 = Q1, slot 5 = Q2, slot 6 = Q3, slot 7 = CORRIDA
 *
 * REGRA ESTRUTURAL IMPORTANTE:
 * Slot é a posição lógica no fim de semana (1..7).
 * Não confundir slot com subfase. No formato Sprint:
 * slot 2 = QUALI_SPRINT (que futuramente conterá SQ1 -> SQ2 -> SQ3 como subfases).
 * slot 3 = SPRINT (corrida Sprint completa).
 * SQ1/SQ2/SQ3 NÃO são slots independentes.
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
  | 'SPRINT_RACE'
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'CORRIDA'
  | 'RACE'

export type WeekendSlotStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_RUN'

/** Subfase futura para Qualificação Sprint (RACE-SPRINT-SLOTS-01B) */
export type SprintQualifyingSubPhase = 'SQ1' | 'SQ2' | 'SQ3'

/** Subfase para Qualificação Principal */
export type MainQualifyingSubPhase = 'Q1' | 'Q2' | 'Q3'

export interface WeekendSlotDefinition {
  slotNumber: WeekendSlotNumber
  slotType: WeekendSlotType
  displayLabel: string
  shortLabel: string
  category: 'practice' | 'sprint' | 'qualifying' | 'race'
  isCompetitive: boolean
  generatesSetup: boolean
  description: string
}

export interface WeekendSlotViewModel {
  slotNumber: WeekendSlotNumber
  slotType: WeekendSlotType
  displayLabel: string
  shortLabel: string
  status: WeekendSlotStatus
  subPhase?: SprintQualifyingSubPhase | MainQualifyingSubPhase | null
  isCurrent: boolean
  isCompleted: boolean
  isLocked: boolean
  isNotRun: boolean
}

export type WeekendSlotSubPhase = SprintQualifyingSubPhase | MainQualifyingSubPhase | string

export interface CanonicalWeekendSlotState {
  careerId: string
  seasonId: string
  round: number
  weekendFormat: WeekendFormat
  configVersion: string
  currentSlot: WeekendSlotNumber
  slotType: WeekendSlotType
  slotStatus: WeekendSlotStatus
  subPhase?: SprintQualifyingSubPhase | MainQualifyingSubPhase | null
  completedSlots: WeekendSlotNumber[]
  slots: Record<
    WeekendSlotNumber,
    {
      slotNumber: WeekendSlotNumber
      slotType: WeekendSlotType
      status: WeekendSlotStatus
      subPhase?: WeekendSlotSubPhase | string | null
      completedAt?: string | null
    }
  >
  updatedAt: string
}

/**
 * NOTA DE ARQUITETURA PARA RACE-SPRINT-SLOTS-01B (não implementar agora no 01A):
 * A fonte RACE existente define SPRINT QUALIFYING:
 * - SQ1/SQ2/SQ3 com cortes 18/10
 * - No seco: SQ1 e SQ2 usam composto Médio e SQ3 usa Macio
 * - Diferencial atual da fonte: +650 ms em SQ1/SQ2
 * - Em chuva: ajuste de composto = 0
 * - Reutilização de raceQualifyingOrchestratorService + QualifyingPhaseView
 */
