/**
 * src/services/weekendSlotSequenceService.ts
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01A
 * Definição versionada, imutável e canônica das sequências de 7 slots.
 *
 * NORMAL:
 * slot 1 = TL1
 * slot 2 = TL2
 * slot 3 = TL3
 * slot 4 = Q1
 * slot 5 = Q2
 * slot 6 = Q3
 * slot 7 = CORRIDA
 *
 * SPRINT:
 * slot 1 = TL1
 * slot 2 = QUALI_SPRINT (conterá subfases SQ1 -> SQ2 -> SQ3 futuramente)
 * slot 3 = SPRINT (corrida Sprint completa)
 * slot 4 = Q1
 * slot 5 = Q2
 * slot 6 = Q3
 * slot 7 = CORRIDA
 *
 * PROIBIÇÃO FORMAL:
 * - Sessões competitivas NÃO geram pontos de setup.
 * - No formato Sprint, TL2 e TL3 são inativas (NOT_RUN) e NUNCA rodam escondidas.
 * - Q1 principal NUNCA herda a ordem esportiva da Sprint.
 *
 * FONTE PARA O PRÓXIMO PASSO (RACE-SPRINT-SLOTS-01B):
 * A fonte RACE existente define SPRINT QUALIFYING:
 * - SQ1/SQ2/SQ3; cortes 18/10;
 * - No seco SQ1 e SQ2 usam composto Médio e SQ3 usa Macio;
 * - Diferencial atual da fonte: +650 ms em SQ1/SQ2; em chuva ajuste de composto = 0.
 * Essas regras pertencem ao futuro 01B, não implementadas no 01A.
 */

import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'
import type {
  WeekendFormat,
  WeekendSlotNumber,
  WeekendSlotType,
  WeekendSlotDefinition,
} from '@/types/weekend-slot-types'

export const CANONICAL_NORMAL_SLOT_DEFINITIONS: Record<WeekendSlotNumber, WeekendSlotDefinition> = {
  1: {
    slotNumber: 1,
    slotType: 'TL1',
    displayLabel: 'Treino Livre 1',
    shortLabel: 'TL1',
    category: 'practice',
    isCompetitive: false,
    generatesSetup: true,
    description: 'Primeira sessão de treino livre para calibragem do acerto do carro.',
  },
  2: {
    slotNumber: 2,
    slotType: 'TL2',
    displayLabel: 'Treino Livre 2',
    shortLabel: 'TL2',
    category: 'practice',
    isCompetitive: false,
    generatesSetup: true,
    description: 'Segunda sessão de treino livre para refinamento do acerto do carro.',
  },
  3: {
    slotNumber: 3,
    slotType: 'TL3',
    displayLabel: 'Treino Livre 3',
    shortLabel: 'TL3',
    category: 'practice',
    isCompetitive: false,
    generatesSetup: true,
    description: 'Terceira e última sessão de treino livre antes da classificação.',
  },
  4: {
    slotNumber: 4,
    slotType: 'Q1',
    displayLabel: 'Classificação Principal — Q1',
    shortLabel: 'Q1',
    category: 'qualifying',
    isCompetitive: true,
    generatesSetup: false,
    description: 'Primeira fase eliminatória da classificação principal do GP.',
  },
  5: {
    slotNumber: 5,
    slotType: 'Q2',
    displayLabel: 'Classificação Principal — Q2',
    shortLabel: 'Q2',
    category: 'qualifying',
    isCompetitive: true,
    generatesSetup: false,
    description: 'Segunda fase eliminatória da classificação principal (definição do Top 10).',
  },
  6: {
    slotNumber: 6,
    slotType: 'Q3',
    displayLabel: 'Classificação Principal — Q3',
    shortLabel: 'Q3',
    category: 'qualifying',
    isCompetitive: true,
    generatesSetup: false,
    description: 'Fase final da classificação principal (disputa da pole position).',
  },
  7: {
    slotNumber: 7,
    slotType: 'CORRIDA',
    displayLabel: 'Grande Prêmio (Corrida Principal)',
    shortLabel: 'Corrida',
    category: 'race',
    isCompetitive: true,
    generatesSetup: false,
    description: 'Grande Prêmio de domingo (Corrida Principal).',
  },
}

export const CANONICAL_SPRINT_SLOT_DEFINITIONS: Record<WeekendSlotNumber, WeekendSlotDefinition> = {
  1: {
    slotNumber: 1,
    slotType: 'TL1',
    displayLabel: 'Treino Livre 1',
    shortLabel: 'TL1',
    category: 'practice',
    isCompetitive: false,
    generatesSetup: true,
    description: 'Única sessão de treino livre do fim de semana Sprint.',
  },
  2: {
    slotNumber: 2,
    slotType: 'QUALI_SPRINT',
    displayLabel: 'Qualificação Sprint',
    shortLabel: 'Quali Sprint',
    category: 'qualifying',
    isCompetitive: true,
    generatesSetup: false,
    description: 'Sessão de qualificação para o grid da Sprint (subfases SQ1, SQ2, SQ3).',
  },
  3: {
    slotNumber: 3,
    slotType: 'SPRINT',
    displayLabel: 'Corrida Sprint',
    shortLabel: 'Sprint',
    category: 'sprint',
    isCompetitive: true,
    generatesSetup: false,
    description: 'Corrida Sprint oficial de ~100 km com pontuação para o Top 8.',
  },
  4: {
    slotNumber: 4,
    slotType: 'Q1',
    displayLabel: 'Classificação Principal — Q1',
    shortLabel: 'Q1',
    category: 'qualifying',
    isCompetitive: true,
    generatesSetup: false,
    description: 'Primeira fase eliminatória da classificação para a corrida principal de domingo.',
  },
  5: {
    slotNumber: 5,
    slotType: 'Q2',
    displayLabel: 'Classificação Principal — Q2',
    shortLabel: 'Q2',
    category: 'qualifying',
    isCompetitive: true,
    generatesSetup: false,
    description: 'Segunda fase da classificação principal (Top 10).',
  },
  6: {
    slotNumber: 6,
    slotType: 'Q3',
    displayLabel: 'Classificação Principal — Q3',
    shortLabel: 'Q3',
    category: 'qualifying',
    isCompetitive: true,
    generatesSetup: false,
    description: 'Disputa da pole position para a corrida principal de domingo.',
  },
  7: {
    slotNumber: 7,
    slotType: 'CORRIDA',
    displayLabel: 'Grande Prêmio (Corrida Principal)',
    shortLabel: 'Corrida',
    category: 'race',
    isCompetitive: true,
    generatesSetup: false,
    description: 'Grande Prêmio de domingo (Corrida Principal).',
  },
}

/**
 * Sequência versionada de 7 slots lógicos para o formato NORMAL.
 */
export const NORMAL_SLOT_TYPES: readonly WeekendSlotType[] = Object.freeze([
  'TL1',
  'TL2',
  'TL3',
  'Q1',
  'Q2',
  'Q3',
  'CORRIDA',
])

/**
 * Sequência versionada de 7 slots lógicos para o formato SPRINT.
 */
export const SPRINT_SLOT_TYPES: readonly WeekendSlotType[] = Object.freeze([
  'TL1',
  'QUALI_SPRINT',
  'SPRINT',
  'Q1',
  'Q2',
  'Q3',
  'CORRIDA',
])

/**
 * Resolve o formato canônico do fim de semana com base no calendário/rodada.
 * Fonte única: CIRCUIT_PERFORMANCE_PROFILES[round].hasSprint.
 * Não inventa flags concorrentes e não infere por nome do GP.
 */
export function resolveWeekendFormat(round: number): WeekendFormat {
  const profile = CIRCUIT_PERFORMANCE_PROFILES.find((c) => c.round === round)
  return profile?.hasSprint ? 'SPRINT' : 'NORMAL'
}

/**
 * Retorna as definições dos 7 slots na ordem correta para o formato especificado.
 */
export function getWeekendSlotSequence(format: WeekendFormat): WeekendSlotDefinition[] {
  const dict =
    format === 'SPRINT' ? CANONICAL_SPRINT_SLOT_DEFINITIONS : CANONICAL_NORMAL_SLOT_DEFINITIONS

  return ([1, 2, 3, 4, 5, 6, 7] as const).map((slotNum) => dict[slotNum])
}

/**
 * Retorna a definição de um slot específico para um formato.
 */
export function getWeekendSlotDefinition(
  format: WeekendFormat,
  slotNumber: WeekendSlotNumber,
): WeekendSlotDefinition {
  const dict =
    format === 'SPRINT' ? CANONICAL_SPRINT_SLOT_DEFINITIONS : CANONICAL_NORMAL_SLOT_DEFINITIONS
  return dict[slotNumber]
}

/**
 * Retorna o tipo de slot correspondente a um número de slot.
 */
export function getSlotTypeForNumber(
  format: WeekendFormat,
  slotNumber: WeekendSlotNumber,
): WeekendSlotType {
  const sequence = format === 'SPRINT' ? SPRINT_SLOT_TYPES : NORMAL_SLOT_TYPES
  return sequence[slotNumber - 1]
}

/**
 * Retorna o número de slot correspondente a um tipo de slot.
 */
export function getSlotNumberForType(
  format: WeekendFormat,
  slotType: WeekendSlotType,
): WeekendSlotNumber | null {
  const sequence = format === 'SPRINT' ? SPRINT_SLOT_TYPES : NORMAL_SLOT_TYPES
  const index = sequence.indexOf(slotType)
  return index >= 0 ? ((index + 1) as WeekendSlotNumber) : null
}
