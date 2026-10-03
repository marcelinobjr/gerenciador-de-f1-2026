/**
 * canonicalQualifyingRngService.ts
 *
 * SERVIÇO CANÔNICO DE RNG DETERMINÍSTICO PARA QUALIFICAÇÃO (QUALI-UNIFY-01C)
 *
 * Centraliza o contrato de seed, PRNG (Mulberry32) e amostragem gaussiana (Box-Muller polar)
 * para todas as fases e modos de qualificação (Orchestrator e Runner interativo).
 *
 * Contrato de seed canônico:
 *   "${careerId}:${seasonId}:r${round}:${variant}:${phase}:${teamId}_c${carIdx}_${driverId}:att${attempt}"
 *
 * Distribuição canônica:
 *   - Box-Muller polar padrão: z ~ N(0, 1)
 *   - Calibrado com sigma 0.45: noise = z * 0.45
 *   - Injetado no CanonicalPaceIntegrationService (clamped canonicamente em [-1.0, +1.0])
 */

import {
  createMulberry32,
  hashStringToSeed,
  sampleGaussianRng,
  QUALI_RNG_TARGET_RANGE,
  QUALI_RNG_DEFAULT_SIGMA,
} from './canonicalPaceIntegrationService'

export interface QualifyingSeedIdentityParams {
  careerId: string
  seasonId: string
  round: number
  variant: 'MAIN_QUALIFYING' | 'SPRINT_QUALIFYING' | string
  phase: 'Q1' | 'Q2' | 'Q3' | 'SQ1' | 'SQ2' | 'SQ3' | string
  teamId: string
  carIdx: number | string
  driverId: string
  attempt: number
}

export interface QualifyingDeterministicRngResult {
  seedIdentity: string
  seedUint: number
  normalDrawZ: number
  rngModifier: number
}

/**
 * Constrói a string de identidade canônica de seed para uma tentativa de qualificação.
 * Formato unificado:
 *   "${careerId}:${seasonId}:r${round}:${variant}:${phase}:${teamId}_c${carIdx}_${driverId}:att${attempt}"
 */
export function buildQualifyingSeedIdentity(params: QualifyingSeedIdentityParams): string {
  const { careerId, seasonId, round, variant, phase, teamId, carIdx, driverId, attempt } = params
  return `${careerId}:${seasonId}:r${round}:${variant}:${phase}:${teamId}_c${carIdx}_${driverId}:att${attempt}`
}

/**
 * Calcula o sorteio determinístico padrão Box-Muller (z ~ N(0, 1)) e o modificador
 * de pace gaussiano (z * sigma) para a tentativa de qualificação identificada.
 *
 * Utiliza o PRNG Mulberry32 inicializado com o hash FNV-1a (32-bit uint) da seedIdentity.
 * O modificador retornado é idêntico à amostragem de referência do RaceQualifyingOrchestratorService.
 */
export function getQualifyingDeterministicDraw(
  params: QualifyingSeedIdentityParams,
  sigma = QUALI_RNG_DEFAULT_SIGMA,
): QualifyingDeterministicRngResult {
  const seedIdentity = buildQualifyingSeedIdentity(params)
  const seedUint = hashStringToSeed(seedIdentity)
  const rng = createMulberry32(seedUint)

  // Box-Muller polar padrão idêntico ao orquestrador
  let u1 = rng()
  let u2 = rng()
  while (u1 <= 1e-15) {
    u1 = rng()
  }
  const normalDrawZ = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)

  // Noise bruto gerado por z * sigma
  const rawNoise = normalDrawZ * sigma

  // Clamp canônico de proteção [-1.0, +1.0]
  const clampedNoise = Math.max(
    QUALI_RNG_TARGET_RANGE.MIN,
    Math.min(QUALI_RNG_TARGET_RANGE.MAX, rawNoise),
  )
  const rngModifier = Number(clampedNoise.toFixed(3))

  return {
    seedIdentity,
    seedUint,
    normalDrawZ,
    rngModifier,
  }
}

/**
 * Obtém diretamente o modificador de pace (em pontos de pace) para a tentativa informada.
 */
export function getQualifyingRandomModifier(
  params: QualifyingSeedIdentityParams,
  sigma = QUALI_RNG_DEFAULT_SIGMA,
): number {
  return getQualifyingDeterministicDraw(params, sigma).rngModifier
}

export const canonicalQualifyingRngService = {
  buildSeedIdentity: buildQualifyingSeedIdentity,
  getDeterministicDraw: getQualifyingDeterministicDraw,
  getRandomModifier: getQualifyingRandomModifier,
  createMulberry32,
  hashStringToSeed,
  sampleGaussianRng,
}
