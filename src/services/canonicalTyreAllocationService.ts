/**
 * CANONICAL TYRE ALLOCATION SERVICE — F1 2026 / APEX GP MANAGER
 *
 * Regulamento Canônico da Alocação de Pneus (Item 17 do Regulamento Esportivo 2026):
 *
 * GP PADRÃO (sem Sprint), por PILOTO, 20 jogos no total:
 * - SLICKS (13 jogos):
 *   - DURO / HARD: 2 jogos
 *   - MÉDIO / MEDIUM: 3 jogos
 *   - MACIO / SOFT: 8 jogos
 * - CHUVA (7 jogos):
 *   - INTERMEDIÁRIO: 4 jogos
 *   - CHUVA EXTREMA / FULL WET: 3 jogos
 * - Total: 2 + 3 + 8 + 4 + 3 = 20 jogos por piloto (80 pneus por piloto).
 *
 * GP COM SPRINT (Weekend com formato Sprint), por PILOTO, 19 jogos no total:
 * - SLICKS (12 jogos):
 *   - DURO / HARD: 2 jogos
 *   - MÉDIO / MEDIUM: 4 jogos
 *   - MACIO / SOFT: 6 jogos
 * - CHUVA (7 jogos canônicos):
 *   - INTERMEDIÁRIO: 4 jogos
 *   - CHUVA EXTREMA: 3 jogos
 * - Total: 2 + 4 + 6 + 4 + 3 = 19 jogos por piloto (76 pneus por piloto).
 *
 * COMPOSTOS FÍSICOS REAIS (17D):
 * Em cada evento, exatamente 3 compostos slick são selecionados (C1 a C5).
 * A designação Hard/Medium/Soft é associada aos compostos físicos reais:
 * Exemplo: C2 = Hard, C3 = Medium, C4 = Soft.
 * Circuitos mais abrasivos usam C1/C2/C3; circuitos de rua ou baixa abrasão usam C3/C4/C5.
 */

import type { TireCompound, TireAllotment } from '@/types/f1'
import { hasSprintWeekend } from '@/services/weekendProgressionService'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'

export type PhysicalTyreCompound = 'C1' | 'C2' | 'C3' | 'C4' | 'C5'

export interface EventTyreCompoundNomination {
  hardPhysical: PhysicalTyreCompound
  mediumPhysical: PhysicalTyreCompound
  softPhysical: PhysicalTyreCompound
  rangeLabel: string // ex: "C2 - C3 - C4"
}

export interface CanonicalTyreAllocationRules {
  format: 'standard' | 'sprint'
  slicks: {
    duro: number
    medio: number
    macio: number
    total: number
  }
  wet: {
    intermediario: number
    chuva_extrema: number
    total: number
  }
  totalSetsPerDriver: number
  totalTyresPerDriver: number // totalSets * 4
}

/** Regra Canônica GP Padrão (20 jogos = 80 pneus por piloto) */
export const STANDARD_GP_TYRE_ALLOCATION: CanonicalTyreAllocationRules = {
  format: 'standard',
  slicks: {
    duro: 2,
    medio: 3,
    macio: 8,
    total: 13,
  },
  wet: {
    intermediario: 4,
    chuva_extrema: 3,
    total: 7,
  },
  totalSetsPerDriver: 20,
  totalTyresPerDriver: 80,
}

/** Regra Canônica Fim de Semana com Sprint (19 jogos = 76 pneus por piloto) */
export const SPRINT_GP_TYRE_ALLOCATION: CanonicalTyreAllocationRules = {
  format: 'sprint',
  slicks: {
    duro: 2,
    medio: 4,
    macio: 6,
    total: 12,
  },
  wet: {
    intermediario: 4,
    chuva_extrema: 3,
    total: 7,
  },
  totalSetsPerDriver: 19,
  totalTyresPerDriver: 76,
}

/**
 * Tabela de nomeações de compostos físicos Pirelli para as 24 etapas de 2026.
 * Baseada na severidade de asfalto, cargas aerodinâmicas e características de tração.
 */
export const ROUND_PHYSICAL_COMPOUND_MAP: Record<number, EventTyreCompoundNomination> = {
  1: { hardPhysical: 'C2', mediumPhysical: 'C3', softPhysical: 'C4', rangeLabel: 'C2 - C3 - C4' }, // Austrália
  2: { hardPhysical: 'C2', mediumPhysical: 'C3', softPhysical: 'C4', rangeLabel: 'C2 - C3 - C4' }, // China (Sprint)
  3: { hardPhysical: 'C1', mediumPhysical: 'C2', softPhysical: 'C3', rangeLabel: 'C1 - C2 - C3' }, // Japão (Suzuka - alta severidade)
  4: { hardPhysical: 'C1', mediumPhysical: 'C2', softPhysical: 'C3', rangeLabel: 'C1 - C2 - C3' }, // Bahrein (Sakhir - asfalto muito abrasivo)
  5: { hardPhysical: 'C2', mediumPhysical: 'C3', softPhysical: 'C4', rangeLabel: 'C2 - C3 - C4' }, // Arábia Saudita
  6: { hardPhysical: 'C2', mediumPhysical: 'C3', softPhysical: 'C4', rangeLabel: 'C2 - C3 - C4' }, // Miami (Sprint)
  7: { hardPhysical: 'C3', mediumPhysical: 'C4', softPhysical: 'C5', rangeLabel: 'C3 - C4 - C5' }, // Canadá (baixa abrasão)
  8: { hardPhysical: 'C3', mediumPhysical: 'C4', softPhysical: 'C5', rangeLabel: 'C3 - C4 - C5' }, // Mônaco (gama mais macia)
  9: { hardPhysical: 'C1', mediumPhysical: 'C2', softPhysical: 'C3', rangeLabel: 'C1 - C2 - C3' }, // Barcelona (alta carga)
  10: { hardPhysical: 'C3', mediumPhysical: 'C4', softPhysical: 'C5', rangeLabel: 'C3 - C4 - C5' }, // Áustria
  11: { hardPhysical: 'C1', mediumPhysical: 'C2', softPhysical: 'C3', rangeLabel: 'C1 - C2 - C3' }, // Grã-Bretanha (Silverstone)
  12: { hardPhysical: 'C2', mediumPhysical: 'C3', softPhysical: 'C4', rangeLabel: 'C2 - C3 - C4' }, // Bélgica (Spa)
  13: { hardPhysical: 'C3', mediumPhysical: 'C4', softPhysical: 'C5', rangeLabel: 'C3 - C4 - C5' }, // Hungria (Hungaroring)
  14: { hardPhysical: 'C1', mediumPhysical: 'C2', softPhysical: 'C3', rangeLabel: 'C1 - C2 - C3' }, // Holanda (Zandvoort)
  15: { hardPhysical: 'C3', mediumPhysical: 'C4', softPhysical: 'C5', rangeLabel: 'C3 - C4 - C5' }, // Itália (Monza)
  16: { hardPhysical: 'C3', mediumPhysical: 'C4', softPhysical: 'C5', rangeLabel: 'C3 - C4 - C5' }, // Azerbaijão (Baku)
  17: { hardPhysical: 'C3', mediumPhysical: 'C4', softPhysical: 'C5', rangeLabel: 'C3 - C4 - C5' }, // Singapura (Marina Bay)
  18: { hardPhysical: 'C2', mediumPhysical: 'C3', softPhysical: 'C4', rangeLabel: 'C2 - C3 - C4' }, // EUA (Austin)
  19: { hardPhysical: 'C3', mediumPhysical: 'C4', softPhysical: 'C5', rangeLabel: 'C3 - C4 - C5' }, // México
  20: { hardPhysical: 'C2', mediumPhysical: 'C3', softPhysical: 'C4', rangeLabel: 'C2 - C3 - C4' }, // Brasil (Interlagos)
  21: { hardPhysical: 'C3', mediumPhysical: 'C4', softPhysical: 'C5', rangeLabel: 'C3 - C4 - C5' }, // Las Vegas
  22: { hardPhysical: 'C1', mediumPhysical: 'C2', softPhysical: 'C3', rangeLabel: 'C1 - C2 - C3' }, // Catar (Lusail)
  23: { hardPhysical: 'C3', mediumPhysical: 'C4', softPhysical: 'C5', rangeLabel: 'C3 - C4 - C5' }, // Abu Dhabi
  24: { hardPhysical: 'C2', mediumPhysical: 'C3', softPhysical: 'C4', rangeLabel: 'C2 - C3 - C4' }, // Final reserva
}

/**
 * Retorna os compostos físicos selecionados para um determinado evento/rodada.
 */
export function getEventPhysicalCompounds(round: number): EventTyreCompoundNomination {
  if (ROUND_PHYSICAL_COMPOUND_MAP[round]) {
    return ROUND_PHYSICAL_COMPOUND_MAP[round]
  }

  // Fallback baseado na severidade do circuito se a rodada não estiver explicitada
  const circuit = CIRCUIT_PERFORMANCE_PROFILES.find((c) => c.round === round)
  const severity = circuit?.auxiliary?.tyreSeverity ?? 55

  if (severity >= 70) {
    return {
      hardPhysical: 'C1',
      mediumPhysical: 'C2',
      softPhysical: 'C3',
      rangeLabel: 'C1 - C2 - C3',
    }
  }
  if (severity <= 48) {
    return {
      hardPhysical: 'C3',
      mediumPhysical: 'C4',
      softPhysical: 'C5',
      rangeLabel: 'C3 - C4 - C5',
    }
  }
  return {
    hardPhysical: 'C2',
    mediumPhysical: 'C3',
    softPhysical: 'C4',
    rangeLabel: 'C2 - C3 - C4',
  }
}

/**
 * Retorna a regra canônica de alocação de pneus para a rodada / formato especificado.
 */
export function getCanonicalTyreAllocation(
  round: number,
  isSprintOverride?: boolean,
): CanonicalTyreAllocationRules {
  const isSprint =
    typeof isSprintOverride === 'boolean' ? isSprintOverride : hasSprintWeekend(round)
  return isSprint ? SPRINT_GP_TYRE_ALLOCATION : STANDARD_GP_TYRE_ALLOCATION
}

/**
 * Retorna o objeto TireAllotment padrão derivado das regras canônicas do formato.
 */
export function getCanonicalTireAllotment(
  round: number,
  isSprintOverride?: boolean,
): TireAllotment {
  const rules = getCanonicalTyreAllocation(round, isSprintOverride)
  return {
    duro: rules.slicks.duro,
    medio: rules.slicks.medio,
    macio: rules.slicks.macio,
    intermediario: rules.wet.intermediario,
    chuva_extrema: rules.wet.chuva_extrema,
  }
}

/**
 * Resolve o composto físico real para o papel atribuído (duro, médio, macio, ou chuva).
 */
export function resolvePhysicalCompoundForRole(compoundRole: TireCompound, round: number): string {
  const nomination = getEventPhysicalCompounds(round)
  switch (compoundRole) {
    case 'duro':
      return nomination.hardPhysical
    case 'medio':
      return nomination.mediumPhysical
    case 'macio':
      return nomination.softPhysical
    case 'intermediario':
      return 'Intermediário (C-Wet Int)'
    case 'chuva_extrema':
      return 'Chuva Extrema (C-Wet Ext)'
    default:
      return nomination.mediumPhysical
  }
}
