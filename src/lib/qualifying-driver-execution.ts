/**
 * qualifying-driver-execution.ts
 *
 * QUALI-DRIVER-EXECUTION-02: Helper canônico de Qualifying Driver Execution
 *
 * Princípios e fórmulas canônicas:
 * 1. EXPERIENCE:
 *    calculateF1ExperienceScore(starts)
 *    starts = max(0, largadas F1 canônicas)
 *    Experience = clamp(40 + 60 * (1 - exp(-starts / 100)), 40, 100)
 *    Zero persistência / zero migration / determinístico em runtime.
 *
 * 2. QDRIVEREXECUTION:
 *    calculateQDriverExecution({ technical, experience, morale })
 *    QDriverExecution = technical * 0.70 + experience * 0.20 + morale * 0.10
 *    Range 0-100 (clamp seguro documentado 0-100).
 *    SEM Adaptation (Driver Strength estrutural já contém), SEM Consistency (futuro), SEM Rain (camada de clima).
 *
 * 3. MODIFIER:
 *    calculateQExecModifier(qDriverExecution)
 *    QExecModifier = (qDriverExecution - NEUTRAL) * SCALE
 *    NEUTRAL = 80
 *    SCALE = 0.24 (Calibração esportiva QDE02-H2: 10 pts QExec = 2.4 pts de pace = ~0.197s em volta de referência)
 *    Substitui a contribuição event-level antiga (speedDelta + moraleDelta) no qualifying.
 */

import { getDriverCareerBaseline2025 } from '@/data/driverCareerStats2025'

export const QDE_CONSTANTS = {
  EXPERIENCE_FLOOR: 40,
  EXPERIENCE_CEIL: 100,
  EXPERIENCE_EXP_SCALE: 100,
  EXPERIENCE_RANGE: 60, // 100 - 40

  WEIGHT_TECHNICAL: 0.7,
  WEIGHT_EXPERIENCE: 0.2,
  WEIGHT_MORALE: 0.1,

  NEUTRAL: 80,
  SCALE: 0.24,
} as const

/**
 * 1. Helper canônico de Experience F1:
 * clamp(40 + 60 * (1 - exp(-starts / 100)), 40, 100)
 * Trata valores negativos como 0, não-finitos/inválidos defensivamente como 0.
 */
export function calculateF1ExperienceScore(starts: number | null | undefined): number {
  if (
    starts === null ||
    starts === undefined ||
    typeof starts !== 'number' ||
    !Number.isFinite(starts) ||
    starts <= 0
  ) {
    return QDE_CONSTANTS.EXPERIENCE_FLOOR
  }

  const rawExperience =
    QDE_CONSTANTS.EXPERIENCE_FLOOR +
    QDE_CONSTANTS.EXPERIENCE_RANGE * (1 - Math.exp(-starts / QDE_CONSTANTS.EXPERIENCE_EXP_SCALE))

  return Math.max(
    QDE_CONSTANTS.EXPERIENCE_FLOOR,
    Math.min(QDE_CONSTANTS.EXPERIENCE_CEIL, Number(rawExperience.toFixed(4))),
  )
}

/**
 * 2. Helper canônico de QDriverExecution:
 * QDriverExecution = Technical * 0.70 + Experience * 0.20 + Morale * 0.10
 */
export interface QDriverExecutionInputs {
  technical: number // speed (0-100)
  experience: number // derived experience (40-100)
  morale: number // morale (0-100, default 80)
}

export function calculateQDriverExecution(inputs: QDriverExecutionInputs): number {
  const tech = Number.isFinite(inputs.technical) ? inputs.technical : 80
  const exp = Number.isFinite(inputs.experience)
    ? inputs.experience
    : QDE_CONSTANTS.EXPERIENCE_FLOOR
  const mor = Number.isFinite(inputs.morale) ? inputs.morale : 80

  const score =
    tech * QDE_CONSTANTS.WEIGHT_TECHNICAL +
    exp * QDE_CONSTANTS.WEIGHT_EXPERIENCE +
    mor * QDE_CONSTANTS.WEIGHT_MORALE

  return Math.max(0, Math.min(100, Number(score.toFixed(4))))
}

/**
 * 3. Helper canônico de Modificador de Qualifying Driver Execution:
 * QExecModifier = (QDriverExecution - 80) * 0.08
 */
export function calculateQExecModifier(qDriverExecution: number): number {
  const diff = qDriverExecution - QDE_CONSTANTS.NEUTRAL
  return Number((diff * QDE_CONSTANTS.SCALE).toFixed(3))
}

/**
 * 4. Helper canônico para extrair largadas F1 a partir do driverId / pilot.
 * FONTE CANÔNICA:
 * Consulta primária ao dicionário histórico getDriverCareerBaseline2025(driverId)?.races.
 * Fallback único: Number(pilot.f1RacesCompleted ?? pilot.careerF1GrandPrixStarts ?? 0).
 * PROIBIDO somar contadores equivalentes.
 */
export function resolveCanonicalF1Starts(
  driverId?: string | null,
  pilot?: { f1RacesCompleted?: number; careerF1GrandPrixStarts?: number; f1Gps?: number } | null,
): number {
  if (driverId) {
    const historical = getDriverCareerBaseline2025(driverId)
    if (historical !== null && historical !== undefined) {
      return Math.max(0, historical.races)
    }
  }

  if (pilot) {
    const fallback = Number(pilot.f1RacesCompleted ?? pilot.careerF1GrandPrixStarts ?? 0)
    return Math.max(0, Number.isFinite(fallback) ? fallback : 0)
  }

  return 0
}
