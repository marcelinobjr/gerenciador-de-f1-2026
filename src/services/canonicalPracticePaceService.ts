/**
 * canonicalPracticePaceService.ts
 *
 * TL-PACE-01A — Core Canônico de Pace do Treino Livre (computePracticePace)
 *
 * ARQUITETURA ALVO (pipeline canônico):
 * CANONICAL TEAM IDENTITY -> STRUCTURAL STRENGTH -> TRACKFIT CANÔNICO ->
 * SETUP/CAR STATE -> SESSION-SPECIFIC DRIVER EXECUTION (PracticeExecution) ->
 * PRACTICE PROGRAM -> TYRE -> FUEL -> WEAR/CONDITION -> WEATHER ->
 * DETERMINISTIC PRACTICE RNG -> FINAL PRACTICE PACE
 *
 * Princípio:
 * Qualificação e Treino Livre compartilham a MESMA realidade física do carro:
 * - Mesma identidade canônica de equipe (canonicalTeamIdentityService)
 * - Mesmo Structural Strength (100, 98, 96, 94, 87, 87, 86, 75, 70, 60, 50, 45)
 * - Mesmo TrackFit canônico (neutral 75, scale 0.08, normal clamp ±2.0, specialized clamp ±2.5)
 * - Mesmo modelo de setup (neutral 80, modifier (eff - 80) * 0.05)
 * As diferenças de treino vêm de:
 * - PracticeExecution (capacidade do piloto de extrair volta e dar feedback no treino)
 * - Programa de treino (car_setup, race_pace, qualifying_sim, tyre_knowledge)
 * - Carga de combustível (física canônica: ~0.035s por kg a partir do neutro ou base)
 * - Pneus, desgaste, clima e RNG determinístico (maior dispersão de treino, sigma 0.65)
 *
 * NÃO altera canonicalPracticeRunner (TL-PACE-01B cuidará da integração).
 */

import {
  canonicalPaceIntegrationService,
  hashStringToSeed,
  createMulberry32,
  NEUTRAL_TRACKFIT_REFERENCE,
  TRACKFIT_MODIFIER_SCALE,
  TRACKFIT_NORMAL_CLAMP,
  TRACKFIT_SPECIALIZED_CLAMP,
} from './canonicalPaceIntegrationService'
import {
  resolveCanonicalTeamKeyFromContext,
  resolveCanonicalTeamKey,
  type TeamResolutionContext,
} from './canonicalTeamIdentityService'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'
import { TIRE_SPECS } from '@/lib/f1-tire-system'
import { structuralMissingFactorsService } from './structuralMissingFactorsService'
import type { PracticeProgramType } from '@/types/practice-preparation'
import type { TeamModel } from '@/types/f1'

/**
 * Constantes canônicas de Practice Driver Execution (PDE)
 * Atributos utilizados (existentes no modelo de dados do projeto):
 * - consistency: capacidade de manter ritmo consistente no stint (peso 0.40)
 * - technical_feedback: qualidade técnica de trabalhar o carro e entender ajustes (peso 0.35)
 * - speed: velocidade pura do piloto (peso 0.15)
 * - morale: estado anímico do piloto (peso 0.10)
 *
 * Ponto neutro canônico: 80
 * Escala: 0.08 pt de pace por ponto de desvio (compatível com os modifiers de pace, ~poucos pontos)
 * Ex: Driver neutro (80) -> modifier = 0.000
 */
export const PRACTICE_EXECUTION_CONSTANTS = {
  NEUTRAL: 80,
  SCALE: 0.08,
  WEIGHT_CONSISTENCY: 0.4,
  WEIGHT_TECHNICAL_FEEDBACK: 0.35,
  WEIGHT_SPEED: 0.15,
  WEIGHT_MORALE: 0.1,
} as const

/**
 * Calibração canônica de RNG para Practice Pace
 * Dispersão ligeiramente maior que qualifying (sigma 0.65 vs 0.45 de quali),
 * porém estritamente clamped em ±1.50 pts.
 * Princípio: embaralha carros próximos sem desfigurar o Structural Strength.
 */
export const PRACTICE_RNG_TARGET_RANGE = {
  MIN: -1.5,
  MAX: 1.5,
  SIGMA: 0.65,
} as const

export interface PracticeDriverAttributes {
  speed?: number
  consistency?: number
  technical_feedback?: number
  technicalFeedback?: number
  morale?: number
  adaptation?: number
  f1_adaptation?: number
  isRookie?: boolean
  careerF1GrandPrixStarts?: number
  f1RacesCompleted?: number
}

export interface PracticePaceBreakdown {
  structuralStrength: number
  trackFitModifier: number
  setupModifier: number
  practiceExecutionModifier: number
  programModifier: number
  tyreModifier: number
  fuelModifier: number
  wearModifier: number
  weatherModifier: number
  rookieAdaptationModifier: number
  rngModifier: number
  finalPracticePace: number
  sessionType: 'practice'
  teamKey: string
  driverId: string
  lapTimeSec: number
  calculatedAt: string
}

export interface PracticePaceParams {
  teamKey?: string
  teamContext?: TeamResolutionContext | string | Partial<TeamModel> | null
  teamIdentity?: string
  driverId: string
  driverAttributes?: PracticeDriverAttributes
  circuitProfile?: any
  carTechnicalAttributes?: any
  setupEfficiency?: number // Padrão neutro 80 (modifier = 0)
  program?:
    | PracticeProgramType
    | 'QUALIFYING_SIM'
    | 'RACE_SIM'
    | 'LONG_RUN'
    | 'AERO_TEST'
    | 'TYRE_TEST'
    | 'SETUP_WORK'
    | string
  programPaceModifier?: number // Modifier explícito de programa se fornecido
  tyreCompound?: string // 'macio', 'medio', 'duro', 'intermediario', 'chuva_extrema'
  tyreWearPct?: number // 0 a 100
  fuelKg?: number // Padrão neutro de treino: 25 kg
  puWearPct?: number // Desgaste de motor
  carCondition?: number // Condição do carro (100 = novo)
  weather?: string // 'seco', 'chuva_fraca', 'chuva_forte'
  seed?: string | number // Seed determinística para RNG
  noise?: number // Ruído injetado diretamente em pontos de pace
  isRookie?: boolean
  rookieModifier?: number
  adaptationModifier?: number
  hasSpecialization?: boolean
  practiceExecutionOverride?: number // Override para testes
}

export interface PracticeSeedIdentityParams {
  careerId: string
  seasonYear: number | string
  round: number
  session: 'tp1' | 'tp2' | 'tp3' | 'TL1' | 'TL2' | 'TL3' | string
  teamId: string
  carIdx?: number | string
  driverId: string
  lapOrAttempt?: number | string
  program?: string
}

/**
 * Constrói a seed de identidade determinística canônica para o treino livre.
 */
export function buildPracticeSeedIdentity(params: PracticeSeedIdentityParams): string {
  const {
    careerId,
    seasonYear,
    round,
    session,
    teamId,
    carIdx = 1,
    driverId,
    lapOrAttempt = 1,
    program = 'car_setup',
  } = params
  return `${careerId}:${seasonYear}:r${round}:${session}:${teamId}_c${carIdx}_${driverId}:lap${lapOrAttempt}:prog_${program}`
}

/**
 * Amostra o modificador determinístico de RNG de treino livre a partir de uma seed.
 */
export function getPracticeDeterministicRngModifier(
  seed: string | number,
  sigma = PRACTICE_RNG_TARGET_RANGE.SIGMA,
): number {
  const numericSeed = hashStringToSeed(seed)
  const rng = createMulberry32(numericSeed)
  let u1 = rng()
  let u2 = rng()
  while (u1 <= 1e-15) {
    u1 = rng()
  }
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  const val = z0 * sigma
  const clamped = Math.max(
    PRACTICE_RNG_TARGET_RANGE.MIN,
    Math.min(PRACTICE_RNG_TARGET_RANGE.MAX, val),
  )
  return Number(clamped.toFixed(3))
}

/**
 * Calcula o score composto de Practice Driver Execution (0-100).
 * Ponto neutro = 80.
 */
export function calculatePracticeDriverExecution(attrs: PracticeDriverAttributes): number {
  const consistency = Number.isFinite(attrs.consistency) ? (attrs.consistency as number) : 80
  const technicalFeedback = Number.isFinite(attrs.technical_feedback)
    ? (attrs.technical_feedback as number)
    : Number.isFinite(attrs.technicalFeedback)
      ? (attrs.technicalFeedback as number)
      : 80
  const speed = Number.isFinite(attrs.speed) ? (attrs.speed as number) : 80
  const morale = Number.isFinite(attrs.morale) ? (attrs.morale as number) : 80

  const score =
    consistency * PRACTICE_EXECUTION_CONSTANTS.WEIGHT_CONSISTENCY +
    technicalFeedback * PRACTICE_EXECUTION_CONSTANTS.WEIGHT_TECHNICAL_FEEDBACK +
    speed * PRACTICE_EXECUTION_CONSTANTS.WEIGHT_SPEED +
    morale * PRACTICE_EXECUTION_CONSTANTS.WEIGHT_MORALE

  return Math.max(0, Math.min(100, Number(score.toFixed(3))))
}

/**
 * Converte o score de Practice Driver Execution no modificador de pace correspondente.
 * Ex: score 80 -> modifier 0.000
 * Ex: score 85 -> modifier +0.400 pt
 */
export function calculatePracticeExecutionModifier(executionScore: number): number {
  const diff = executionScore - PRACTICE_EXECUTION_CONSTANTS.NEUTRAL
  return Number((diff * PRACTICE_EXECUTION_CONSTANTS.SCALE).toFixed(3))
}

/**
 * Normaliza o modificador de programa de treino.
 * Programas canônicos suportados:
 * - 'qualifying_sim' / 'QUALIFYING_SIM': simulação de qualificação (+0.75 pt no pace)
 * - 'race_pace' / 'RACE_SIM' / 'LONG_RUN': ritmo de corrida/long run (-0.50 pt no pace devido a ritmo sustentado)
 * - 'car_setup' / 'SETUP_WORK': trabalho de acerto (neutro: 0.0 pt)
 * - 'tyre_knowledge' / 'TYRE_TEST' / 'AERO_TEST': teste de pneus ou aero (neutro: 0.0 pt)
 */
export function resolveProgramPaceModifier(program?: string, explicitModifier?: number): number {
  if (explicitModifier !== undefined && Number.isFinite(explicitModifier)) {
    return Number(explicitModifier.toFixed(3))
  }
  if (!program) return 0.0

  const p = program.toLowerCase().trim()
  if (p === 'qualifying_sim') {
    // Modo de ataque / simulação de qualificação: carro mais rápido (+0.75 pt)
    return 0.75
  }
  if (p === 'race_pace' || p === 'race_sim' || p === 'long_run') {
    // Modo de preservação / simulação de corrida com ritmo constante (-0.50 pt)
    return -0.5
  }
  return 0.0
}

/**
 * CORE CANÔNICO DE PACE DO TREINO LIVRE: computePracticePace
 *
 * Executa o pipeline puro e completo para cálculo de ritmo de volta em sessão de treino.
 * Retorna o pace final + breakdown detalhado de cada componente físico/esportivo.
 */
export function computePracticePace(params: PracticePaceParams): {
  finalPracticePace: number
  lapTimeSec: number
  breakdown: PracticePaceBreakdown
} {
  const {
    teamKey,
    teamContext,
    teamIdentity,
    driverId,
    driverAttributes = {},
    circuitProfile,
    carTechnicalAttributes,
    setupEfficiency = 80,
    program = 'car_setup',
    programPaceModifier,
    tyreCompound = 'medio',
    tyreWearPct = 0,
    fuelKg = 25, // Referência neutra padrão do treino livre = 25 kg
    puWearPct = 0,
    carCondition = 100,
    weather = 'seco',
    seed,
    noise = 0,
    isRookie = false,
    rookieModifier,
    adaptationModifier,
    hasSpecialization,
    practiceExecutionOverride,
  } = params

  // 1. CANONICAL TEAM IDENTITY RESOLUTION
  // Utiliza estritamente resolveCanonicalTeamKeyFromContext e resolveCanonicalTeamKey
  let resolvedTeamKey: string | null = null
  if (teamContext) {
    resolvedTeamKey = resolveCanonicalTeamKeyFromContext(teamContext)
  }
  if (!resolvedTeamKey && teamKey) {
    resolvedTeamKey = resolveCanonicalTeamKey(teamKey)
  }
  if (!resolvedTeamKey && teamIdentity) {
    resolvedTeamKey = resolveCanonicalTeamKey(teamIdentity)
  }
  const effectiveTeamKey = resolvedTeamKey || teamKey || 'custom_team'

  // 2. STRUCTURAL STRENGTH CANÔNICO
  // Mesma fonte unificada da qualificação: resolveBaseStructuralStrength
  const structuralStrength =
    canonicalPaceIntegrationService.resolveBaseStructuralStrength(effectiveTeamKey)

  // 3. TRACKFIT CANÔNICO (neutral 75, scale 0.08, normal clamp ±2.0, specialized clamp ±2.5)
  let trackFitModifier = 0
  if (carTechnicalAttributes && circuitProfile) {
    const isSpecialized =
      hasSpecialization === true ||
      (circuitProfile as Record<string, unknown>).specialized === true ||
      (circuitProfile.characteristics as Record<string, unknown> | undefined)?.specialized ===
        true ||
      (circuitProfile.auxiliary as Record<string, unknown> | undefined)?.isSpecialized === true
    const { trackFitScore } = calculateTrackFit(carTechnicalAttributes, circuitProfile)
    const norm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: trackFitScore,
      referenceTrackFit: NEUTRAL_TRACKFIT_REFERENCE,
      scale: TRACKFIT_MODIFIER_SCALE,
      isSpecializedTrack: Boolean(isSpecialized),
      hasSpecialization,
    })
    trackFitModifier = norm.trackFitModifier
  }

  // 4. SETUP MODIFIER CANÔNICO
  // setupEfficiency 80 = neutro (0.0). Escala: (eff - 80) * 0.05
  const setupModifier = Number(((setupEfficiency - 80) * 0.05).toFixed(3))

  // 5. PRACTICE DRIVER EXECUTION (capacidade de trabalhar o carro no treino)
  let practiceExecutionModifier = 0
  if (practiceExecutionOverride !== undefined) {
    practiceExecutionModifier = Number(practiceExecutionOverride.toFixed(3))
  } else {
    const execScore = calculatePracticeDriverExecution(driverAttributes)
    practiceExecutionModifier = calculatePracticeExecutionModifier(execScore)
  }

  // 6. PRACTICE PROGRAM MODIFIER
  const progMod = resolveProgramPaceModifier(program, programPaceModifier)

  // 7. TYRE MODIFIER CANÔNICO
  // Baseado na especificação oficial de pneus do projeto (TIRE_SPECS)
  const spec = TIRE_SPECS[tyreCompound as keyof typeof TIRE_SPECS] || TIRE_SPECS.medio
  const tyreDeltaPerLapSec = spec.deltaPerLapSec + (tyreWearPct / 100) * 1.0
  const tyreModifier = Number((-tyreDeltaPerLapSec * 12.0).toFixed(3))

  // 8. FUEL MODIFIER CANÔNICO
  // Referência neutra de treino = 25 kg. Física canônica: 0.035s por kg a mais ou a menos
  const fuelDeltaSec = (fuelKg - 25) * 0.035
  const fuelModifier = Number((-fuelDeltaSec * 12.0).toFixed(3))

  // 9. WEAR & CONDITION MODIFIER
  // PU wear e condição do carro (100 = condição perfeita)
  const effectivePuWear = puWearPct > 0 ? puWearPct : (100 - carCondition) * 0.85
  const puPenalty = structuralMissingFactorsService.calculatePUWearPenalty(effectivePuWear)
  const wearModifier = Number((-puPenalty.engineWearPenalty * 12.0).toFixed(3))

  // 10. WEATHER MODIFIER CANÔNICO
  let weatherPenaltySec = 0
  if (weather === 'chuva_fraca') {
    if (tyreCompound === 'intermediario') weatherPenaltySec = 0
    else weatherPenaltySec = 4.2
  } else if (weather === 'chuva_forte') {
    if (tyreCompound === 'chuva_extrema') weatherPenaltySec = 0
    else if (tyreCompound === 'intermediario') weatherPenaltySec = 2.4
    else weatherPenaltySec = 8.5
  }
  const weatherModifier = Number((-weatherPenaltySec * 12.0).toFixed(3))

  // 11. ROOKIE / ADAPTATION MODIFIER (Driver modifier de sessão, NUNCA alterando Structural)
  let rookieAdaptationMod = 0
  if (rookieModifier !== undefined) {
    rookieAdaptationMod += rookieModifier
  } else if (isRookie || driverAttributes.isRookie) {
    // Rookie tem pequena desvantagem de adaptação inicial (-0.35 pt de pace)
    rookieAdaptationMod -= 0.35
  }
  if (adaptationModifier !== undefined) {
    rookieAdaptationMod += adaptationModifier
  } else if (driverAttributes.adaptation !== undefined) {
    // Adaptation neutra = 75
    const diff = driverAttributes.adaptation - 75
    rookieAdaptationMod += diff * 0.02
  }
  rookieAdaptationMod = Number(rookieAdaptationMod.toFixed(3))

  // 12. DETERMINISTIC PRACTICE RNG
  // Zero Math.random(). Suporta seed de identidade ou ruído direto.
  let rngModifier = 0
  if (seed !== undefined) {
    rngModifier = getPracticeDeterministicRngModifier(seed)
  } else {
    const clampedNoise = Math.max(
      PRACTICE_RNG_TARGET_RANGE.MIN,
      Math.min(PRACTICE_RNG_TARGET_RANGE.MAX, noise),
    )
    rngModifier = Number(clampedNoise.toFixed(3))
  }

  // 13. FINAL PRACTICE PACE SCORE (Soma canônica de cada termo aplicado exatamente 1x)
  const finalPracticePace = Number(
    (
      structuralStrength +
      trackFitModifier +
      setupModifier +
      practiceExecutionModifier +
      progMod +
      tyreModifier +
      fuelModifier +
      wearModifier +
      weatherModifier +
      rookieAdaptationMod +
      rngModifier
    ).toFixed(2),
  )

  // 14. LAP TIME SEC (Base de circuito 74.0s, gap canônico de 0.082s por ponto de pace)
  const baseCircuitSec = 74.0
  const performanceGapSec = (100 - finalPracticePace) * 0.082
  const lapTimeSec = Number(
    Math.max(54.0, baseCircuitSec + performanceGapSec + weatherPenaltySec).toFixed(3),
  )

  const breakdown: PracticePaceBreakdown = {
    structuralStrength: Number(structuralStrength.toFixed(2)),
    trackFitModifier,
    setupModifier,
    practiceExecutionModifier,
    programModifier: progMod,
    tyreModifier,
    fuelModifier,
    wearModifier,
    weatherModifier,
    rookieAdaptationModifier: rookieAdaptationMod,
    rngModifier,
    finalPracticePace,
    sessionType: 'practice',
    teamKey: effectiveTeamKey,
    driverId,
    lapTimeSec,
    calculatedAt: new Date().toISOString(),
  }

  return {
    finalPracticePace,
    lapTimeSec,
    breakdown,
  }
}

export const canonicalPracticePaceService = {
  computePracticePace,
  calculatePracticeDriverExecution,
  calculatePracticeExecutionModifier,
  resolveProgramPaceModifier,
  buildPracticeSeedIdentity,
  getPracticeDeterministicRngModifier,
}
