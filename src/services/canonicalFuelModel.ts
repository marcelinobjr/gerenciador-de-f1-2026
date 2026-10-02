/**
 * canonicalFuelModel.ts
 *
 * Modelo canônico de combustível F1 2026 para APEX GP Manager.
 * Rodada FUEL-01B — Substitui taxa fixa nominal por consumo proporcional à distância.
 */

export const TANK_CAPACITY_KG = 110.0
export const BASE_FUEL_BURN_KG_PER_KM = 0.3
export const START_FUEL_RESERVE_KG = 1.0

export const STRATEGY_FUEL_BURN_MULTIPLIERS = {
  ATTACK: 1.15,
  NORMAL: 1.0,
  SAVE_FUEL: 0.85,
  ECONOMY: 0.85,
} as const

export const RACE_CONTROL_FUEL_BURN_MULTIPLIERS = {
  GREEN: 1.0,
  SAFETY_CAR: 0.95,
  VSC: 0.85,
  RED_FLAG: 0.0,
} as const

/**
 * Calcula a distância total de uma corrida em km.
 */
export function calculateRaceDistanceKm(laps: number, circuitLengthKm: number): number {
  if (
    !laps ||
    laps <= 0 ||
    !circuitLengthKm ||
    circuitLengthKm <= 0 ||
    isNaN(laps) ||
    isNaN(circuitLengthKm)
  ) {
    return 0
  }
  return Number((laps * circuitLengthKm).toFixed(3))
}

/**
 * Calcula o consumo de combustível por volta (kg) com base na extensão da pista e multiplicador.
 * Formula canônica: circuitLengthKm * 0.30 * fuelBurnMultiplier
 */
export function calculateLapFuelBurnKg(
  circuitLengthKm: number,
  fuelBurnMultiplier: number = 1.0,
): number {
  if (!circuitLengthKm || circuitLengthKm <= 0 || isNaN(circuitLengthKm)) {
    throw new Error(`[canonicalFuelModel] circuitLengthKm inválido: ${circuitLengthKm}`)
  }
  if (fuelBurnMultiplier === 0) {
    return 0
  }
  return Number((circuitLengthKm * BASE_FUEL_BURN_KG_PER_KM * fuelBurnMultiplier).toFixed(4))
}

/**
 * Calcula a carga inicial recomendada/necessária de combustível para a corrida.
 * Formula canônica: raceDistanceKm * 0.30 * expectedStrategyMultiplier + 1.0
 */
export function calculateRequiredStartingFuelKg(
  raceLaps: number,
  circuitLengthKm: number,
  expectedStrategyMultiplier: number = 1.0,
): number {
  if (
    !raceLaps ||
    raceLaps <= 0 ||
    !circuitLengthKm ||
    circuitLengthKm <= 0 ||
    isNaN(raceLaps) ||
    isNaN(circuitLengthKm) ||
    isNaN(expectedStrategyMultiplier) ||
    expectedStrategyMultiplier < 0
  ) {
    throw new Error(
      `[canonicalFuelModel] Parâmetros inválidos para calculateRequiredStartingFuelKg: laps=${raceLaps}, length=${circuitLengthKm}`,
    )
  }

  const distanceKm = raceLaps * circuitLengthKm
  const required =
    distanceKm * BASE_FUEL_BURN_KG_PER_KM * expectedStrategyMultiplier + START_FUEL_RESERVE_KG
  return Number(required.toFixed(4))
}
