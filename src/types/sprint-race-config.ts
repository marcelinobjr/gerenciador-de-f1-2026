/**
 * src/types/sprint-race-config.ts
 *
 * RACE-SPRINT-SLOTS-01C1:
 * Configurações, contratos e parâmetros parametrizados para a Corrida Sprint (SPRINT_RACE)
 * e isolamento conceitual com a Corrida Principal (MAIN_RACE).
 *
 * PRINCÍPIO:
 * - A mesma máquina de simulação suporta MAIN_RACE e SPRINT_RACE.
 * - Não cria engines paralelas nem duplica lógicas de corrida.
 * - Parametriza:
 *   1. Distância alvo homologada da Sprint: 100 km.
 *   2. Número de voltas da Sprint: ceil(100 / circuitLengthKm).
 *   3. Pneu inicial no seco: 'medio' (Medium).
 *   4. Pneu inicial no molhado: 'chuva_extrema' (chuva forte) ou 'intermediario' (chuva fraca).
 *   5. Consumo de combustível parametrizado proporcionalmente às voltas da Sprint.
 *   6. Política de pit stop Sprint (preparada para 01C2, default 0 pits).
 *   7. Probabilidade de eventos Sprint escalada proporcionalmente à distância (sprintLaps / mainRaceLaps).
 *   8. Namespace RNG isolado por variante (MAIN_RACE vs SPRINT_RACE).
 */

import type { RaceVariant } from './canonical-race-v2'

export const SPRINT_TARGET_DISTANCE_KM = 100

export interface RaceVariantConfig {
  raceVariant: RaceVariant
  targetDistanceKm?: number
  defaultDryCompound: 'medio' | 'macio' | 'duro'
  mandatoryPitStops: number
  eventProbabilityScale: number
  rngNamespace: string
}

export const SPRINT_RACE_CONFIG: RaceVariantConfig = {
  raceVariant: 'SPRINT_RACE',
  targetDistanceKm: SPRINT_TARGET_DISTANCE_KM,
  defaultDryCompound: 'medio',
  mandatoryPitStops: 0,
  eventProbabilityScale: 1.0, // Multiplicador base, escalado dinamicamente por (sprintLaps / mainLaps)
  rngNamespace: 'SPRINT_RACE',
}

export const MAIN_RACE_CONFIG: RaceVariantConfig = {
  raceVariant: 'MAIN_RACE',
  defaultDryCompound: 'medio',
  mandatoryPitStops: 1,
  eventProbabilityScale: 1.0,
  rngNamespace: 'MAIN_RACE',
}

/**
 * Calcula a escala de eventos da Sprint relativo à corrida principal:
 * sprintEventProbability = mainRaceProbability * (sprintLaps / mainRaceLaps)
 */
export function calculateSprintEventProbabilityScale(
  sprintLaps: number,
  mainRaceLaps: number,
): number {
  if (!mainRaceLaps || mainRaceLaps <= 0) return 1.0
  if (!sprintLaps || sprintLaps <= 0) return 0.0
  return Number((sprintLaps / mainRaceLaps).toFixed(4))
}
