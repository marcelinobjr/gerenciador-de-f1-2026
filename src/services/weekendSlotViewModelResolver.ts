/**
 * src/services/weekendSlotViewModelResolver.ts
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01A
 * Resolvedor canônico de ViewModel dos 7 slots para a UI.
 *
 * Fornece à interface:
 * - slotNumber (1..7)
 * - slotType (TL1, TL2, TL3, QUALI_SPRINT, SPRINT, Q1, Q2, Q3, CORRIDA)
 * - displayLabel ("Treino Livre 1", "Qualificação Sprint", etc.)
 * - shortLabel ("TL1", "Quali Sprint", "Sprint", "Q1", "Q2", "Q3", "Corrida")
 * - status (LOCKED, AVAILABLE, IN_PROGRESS, COMPLETED, NOT_RUN)
 * - subPhase (quando aplicável, ex: SQ2, Q1)
 * - flags booleanas de conveniência visual (isCurrent, isCompleted, isLocked, isNotRun)
 */

import type {
  WeekendFormat,
  WeekendSlotNumber,
  WeekendSlotViewModel,
  CanonicalWeekendSlotState,
} from '@/types/weekend-slot-types'
import { getWeekendSlotSequence } from '@/services/weekendSlotSequenceService'

export function resolveWeekendSlotsViewModel(
  state: CanonicalWeekendSlotState,
): WeekendSlotViewModel[] {
  const sequence = getWeekendSlotSequence(state.weekendFormat)

  return sequence.map((def) => {
    const slotData = state.slots[def.slotNumber]
    const isCurrent = state.currentSlot === def.slotNumber
    const isCompleted = slotData.status === 'COMPLETED'
    const isNotRun = slotData.status === 'NOT_RUN'
    const isLocked = slotData.status === 'LOCKED'

    return {
      slotNumber: def.slotNumber,
      slotType: def.slotType,
      displayLabel: def.displayLabel,
      shortLabel: def.shortLabel,
      status: slotData.status,
      subPhase: (slotData.subPhase as any) || (isCurrent ? state.subPhase : null),
      isCurrent,
      isCompleted,
      isLocked,
      isNotRun,
    }
  })
}

/**
 * Helper estático quando o componente só possui o formato e a lista de sessões concluídas
 */
export function resolveStaticSlotsViewModel(params: {
  format: WeekendFormat
  currentSlot: WeekendSlotNumber
  completedSlots: WeekendSlotNumber[]
}): WeekendSlotViewModel[] {
  const { format, currentSlot, completedSlots } = params
  const sequence = getWeekendSlotSequence(format)

  return sequence.map((def) => {
    const isCompleted = completedSlots.includes(def.slotNumber)
    const isCurrent = currentSlot === def.slotNumber
    let status: WeekendSlotViewModel['status'] = 'LOCKED'

    if (isCompleted) {
      status = 'COMPLETED'
    } else if (isCurrent) {
      status = 'AVAILABLE'
    } else if (def.slotNumber < currentSlot) {
      status = 'COMPLETED'
    } else {
      status = 'LOCKED'
    }

    return {
      slotNumber: def.slotNumber,
      slotType: def.slotType,
      displayLabel: def.displayLabel,
      shortLabel: def.shortLabel,
      status,
      subPhase: null,
      isCurrent,
      isCompleted,
      isLocked: status === 'LOCKED',
      isNotRun: false,
    }
  })
}
