/**
 * canonicalPracticeRngService.ts
 *
 * SERVIÇO CANÔNICO DE RNG DETERMINÍSTICO PARA TREINO LIVRE (TL-PACE-01A)
 *
 * Reutiliza os mesmos primitivos matemáticos do Qualifying (FNV-1a + Mulberry32 + Box-Muller).
 * Seed canônica para treinos livres:
 *   "${careerId}:${seasonYear}:r${round}:${session}:${driverId}:att${attempt}:${program}"
 *
 * Propriedades canônicas:
 * - Namespaces distintos para sessões: 'TL1' | 'TL2' | 'TL3' (ou 'FP1' | 'FP2' | 'FP3')
 * - Sigma de practice calibrado: 0.8 (maior que o 0.45 da quali, mas controlado frente ao structural)
 * - Clamp protetivo calibrado: [-2.0, +2.0] pontos de pace
 * - ZERO Math.random() no core canônico
 * - Aplicação estritamente única no cálculo de pace
 */

import { createMulberry32, hashStringToSeed } from './canonicalPaceIntegrationService'

export const PRACTICE_RNG_DEFAULT_SIGMA = 0.8
export const PRACTICE_RNG_TARGET_RANGE = {
  MIN: -2.0,
  MAX: 2.0,
  SIGMA: 0.8,
} as const

export interface PracticeSeedIdentityParams {
  careerId: string
  seasonYear: number | string
  round: number
  session: 'TL1' | 'TL2' | 'TL3' | 'FP1' | 'FP2' | 'FP3' | string
  driverId: string
  attempt: number
  program?: string | number
}

export interface PracticeDeterministicRngResult {
  seedIdentity: string
  seedUint: number
  normalDrawZ: number
  rngModifier: number
}

/**
 * Constrói a string de identidade canônica de seed para uma volta/tentativa de treino livre.
 * Formato unificado:
 *   "${careerId}:${seasonYear}:r${round}:${session}:${driverId}:att${attempt}:${program}"
 */
export function buildPracticeSeedIdentity(params: PracticeSeedIdentityParams): string {
  const { careerId, seasonYear, round, session, driverId, attempt, program = 'default' } = params
  return `${careerId}:${seasonYear}:r${round}:${session}:${driverId}:att${attempt}:${program}`
}

/**
 * Amostra ruído gaussiano (Box-Muller polar) determinístico a partir de um gerador Mulberry32.
 */
export function samplePracticeGaussianRng(
  rng: () => number,
  sigma = PRACTICE_RNG_DEFAULT_SIGMA,
  clampMin = PRACTICE_RNG_TARGET_RANGE.MIN,
  clampMax = PRACTICE_RNG_TARGET_RANGE.MAX,
): { normalDrawZ: number; rngModifier: number } {
  let u1 = rng()
  let u2 = rng()
  while (u1 <= 1e-15) {
    u1 = rng()
  }
  const normalDrawZ = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  const rawNoise = normalDrawZ * sigma
  const clamped = Math.max(clampMin, Math.min(clampMax, rawNoise))
  return {
    normalDrawZ,
    rngModifier: Number(clamped.toFixed(3)),
  }
}

/**
 * Calcula o sorteio determinístico padrão Box-Muller e o modificador de pace
 * para uma tentativa de treino livre identificada.
 */
export function getPracticeDeterministicDraw(
  params: PracticeSeedIdentityParams,
  sigma = PRACTICE_RNG_DEFAULT_SIGMA,
): PracticeDeterministicRngResult {
  const seedIdentity = buildPracticeSeedIdentity(params)
  const seedUint = hashStringToSeed(seedIdentity)
  const rng = createMulberry32(seedUint)
  const { normalDrawZ, rngModifier } = samplePracticeGaussianRng(rng, sigma)

  return {
    seedIdentity,
    seedUint,
    normalDrawZ,
    rngModifier,
  }
}

/**
 * Retorna diretamente o modificador de pace (em pontos de pace) para a tentativa informada.
 */
export function getPracticeRandomModifier(
  params: PracticeSeedIdentityParams,
  sigma = PRACTICE_RNG_DEFAULT_SIGMA,
): number {
  return getPracticeDeterministicDraw(params, sigma).rngModifier
}

export const canonicalPracticeRngService = {
  buildSeedIdentity: buildPracticeSeedIdentity,
  getDeterministicDraw: getPracticeDeterministicDraw,
  getRandomModifier: getPracticeRandomModifier,
  createMulberry32,
  hashStringToSeed,
  sampleGaussianRng: samplePracticeGaussianRng,
}
