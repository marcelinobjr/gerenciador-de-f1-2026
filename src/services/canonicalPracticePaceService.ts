/**
 * TL-PACE-01A1 — CANONICAL PRACTICE PACE SERVICE
 * Core canônico de cálculo de pace para sessões de Treino Livre (Practice / TL).
 *
 * Arquitetura unificada com Qualifying:
 * canonical team identity -> Structural Strength -> TrackFit canônico -> setup canônico -> tyre -> fuel -> wear -> weather
 * Diferenças legítimas de Practice:
 * PracticeExecution (consistency, technical/feedback, adaptation, experience, morale) -> Practice Program -> Rookie/Adaptation -> Deterministic RNG (injected)
 */

import {
  CANONICAL_2026_TEAM_STRENGTHS,
  resolveCanonicalTeamKeyFromContext,
  type CanonicalTeamKey,
} from './canonicalTeamIdentityService'
import { calculateSetupModifier, normalizeSetupEfficiency } from './canonicalSetupEfficiencyService'
import { calculateCanonicalTrackFitModifier } from './canonicalTrackFitService'

export interface PracticeDriverInput {
  id?: string
  name?: string
  speed?: number
  consistency?: number
  technical_feedback?: number
  technicalFeedback?: number
  f1_adaptation?: number
  adaptation?: number
  experience?: number
  morale?: number
  age?: number
  role?: string
  is_academy?: boolean
  is_test_driver?: boolean
  [key: string]: unknown
}

export interface PracticeTeamInput {
  id?: string
  name?: string
  team_key?: string
  key?: string
  engine_supplier?: string
  chassis_level?: number
  aero_level?: number
  strength?: number
  strengthRating?: number
  teamChassisRating?: number
  [key: string]: unknown
}

export interface PracticeSessionContext {
  team?: PracticeTeamInput | null
  driver?: PracticeDriverInput | null
  carIndex?: 1 | 2
  playerTeamId?: string | null
  playerTeamKey?: string | null
  playerCar1DriverId?: string | null
  playerCar2DriverId?: string | null
  trackFitScore?: number
  trackFitModifier?: number
  setupEfficiency?: number
  practiceProgram?: 'track_acclimatization' | 'tyre_management' | 'qualifying_pace' | 'race_pace' | 'setup_work' | string
  programModifier?: number
  tyreCompound?: 'macio' | 'medio' | 'duro' | 'intermediario' | 'chuva_extrema' | string
  tyreModifier?: number
  fuelLoadKg?: number
  fuelModifier?: number
  wearPercentage?: number
  wearModifier?: number
  weatherCondition?: 'dry' | 'damp' | 'wet' | 'monsoon' | string
  weatherModifier?: number
  isRookie?: boolean
  adaptationModifier?: number
  rngModifier?: number
}

export interface PracticePaceBreakdown {
  teamKey: CanonicalTeamKey
  structural: number
  practiceExecution: number
  trackFit: number
  setup: number
  program: number
  tyre: number
  fuel: number
  wear: number
  weather: number
  rookieAdaptation: number
  rng: number
  finalPace: number
}

export interface PracticePaceResult {
  finalPace: number
  breakdown: PracticePaceBreakdown
}

/**
 * Normaliza e resolve a força estrutural canônica (Structural Strength).
 * Baseline homologada 2026:
 * Mercedes 100, Ferrari 98, McLaren 96, Red Bull 94, Racing Bulls 87, Alpine 87,
 * Audi 86, Haas 75, Williams 70, Aston Martin 60, Cadillac 50, Andretti 45.
 *
 * IGNORA completamente teams.strength, strengthRating, teamChassisRating.
 */
export function resolvePracticeStructuralStrength(
  teamInput: PracticeTeamInput | null | undefined,
  context?: {
    playerTeamId?: string | null
    playerTeamKey?: string | null
    driverId?: string | null
    playerCar1DriverId?: string | null
    playerCar2DriverId?: string | null
    carIndex?: 1 | 2
  }
): { teamKey: CanonicalTeamKey; structural: number } {
  const teamKey = resolveCanonicalTeamKeyFromContext(teamInput, context)
  const structural = CANONICAL_2026_TEAM_STRENGTHS[teamKey] ?? 75
  return { teamKey, structural }
}

/**
 * Calcula o TrackFit Canônico.
 * Neutral 75, scale 0.08, clamp ±2.0 pts.
 * (NÃO usa o modelo legado de 0.22 / ±6.5).
 */
export function calculatePracticeTrackFitModifier(
  trackFitScore?: number,
  explicitModifier?: number
): number {
  if (explicitModifier !== undefined && Number.isFinite(explicitModifier)) {
    return explicitModifier
  }
  if (trackFitScore === undefined || !Number.isFinite(trackFitScore)) {
    return 0
  }
  return calculateCanonicalTrackFitModifier(trackFitScore)
}

/**
 * Calcula o modificador de setup canônico.
 * Neutral 80, scale 0.05: (eff - 80) * 0.05.
 * Aplicado uma única vez.
 */
export function calculatePracticeSetupModifier(
  setupEfficiency?: number,
  explicitModifier?: number
): number {
  if (explicitModifier !== undefined && Number.isFinite(explicitModifier)) {
    return explicitModifier
  }
  if (setupEfficiency === undefined || !Number.isFinite(setupEfficiency)) {
    return 0
  }
  const normEff = normalizeSetupEfficiency(setupEfficiency)
  return calculateSetupModifier(normEff)
}

/**
 * Camada de execução do piloto específica para Practice (PracticeExecution).
 * Utiliza atributos existentes no piloto:
 * - Consistency
 * - Technical Feedback
 * - Adaptation (f1_adaptation)
 * - Morale
 * - Experience (ou age se experience não disponível)
 *
 * Modificador sutil e balanceado (poucos pontos), mantendo o Structural dominante.
 * Se o piloto for neutro (todos os stats em 75..80), modifier tende a 0.
 */
export function calculatePracticeExecution(driver?: PracticeDriverInput | null): number {
  if (!driver) return 0

  const consistency = Number(driver.consistency ?? 75)
  const technicalFeedback = Number(driver.technical_feedback ?? driver.technicalFeedback ?? 75)
  const adaptation = Number(driver.f1_adaptation ?? driver.adaptation ?? 75)
  const morale = Number(driver.morale ?? 75)
  const experience = Number(driver.experience ?? (driver.age ? Math.min(100, Math.max(0, (driver.age - 18) * 6)) : 75))

  // Média ponderada com âncora neutra em 75:
  // consistency: 30%, technicalFeedback: 25%, adaptation: 20%, experience: 15%, morale: 10%
  const composite =
    (consistency - 75) * 0.30 +
    (technicalFeedback - 75) * 0.25 +
    (adaptation - 75) * 0.20 +
    (experience - 75) * 0.15 +
    (morale - 75) * 0.10

  // Escala suave: cada 10 pontos de diferença em relação a 75 move 0.15 pontos de pace, clamped em [-2.0, +2.0]
  const executionModifier = composite * 0.015
  return Math.min(2.0, Math.max(-2.0, Number(executionModifier.toFixed(4))))
}

/**
 * Modificador de Programa de Treino (Practice Program).
 * Programas existentes:
 * - track_acclimatization: foco em conhecimento de pista (+pace modesto ou neutro)
 * - tyre_management: ritmo conservador (-0.8 a -1.2 pts)
 * - qualifying_pace: volta rápida de simulação (+1.2 a +1.8 pts)
 * - race_pace: simulação de corrida (-0.4 a -0.6 pts)
 * - setup_work: trabalho sistemático de acerto (neutro 0)
 */
export function calculatePracticeProgramModifier(
  program?: string,
  explicitModifier?: number
): number {
  if (explicitModifier !== undefined && Number.isFinite(explicitModifier)) {
    return explicitModifier
  }
  if (!program) return 0

  switch (program) {
    case 'qualifying_pace':
      return 1.5
    case 'race_pace':
      return -0.5
    case 'tyre_management':
      return -1.0
    case 'track_acclimatization':
      return 0.2
    case 'setup_work':
    default:
      return 0
  }
}

/**
 * Modificador de Pneu (Tyre compound).
 * macio: referência mais veloz (+0.8), medio: 0, duro: -0.8
 */
export function calculatePracticeTyreModifier(
  compound?: string,
  explicitModifier?: number
): number {
  if (explicitModifier !== undefined && Number.isFinite(explicitModifier)) {
    return explicitModifier
  }
  if (!compound) return 0

  const c = compound.toLowerCase()
  if (c.includes('macio') || c === 'soft') return 0.8
  if (c.includes('medio') || c === 'medium') return 0.0
  if (c.includes('duro') || c === 'hard') return -0.8
  if (c.includes('intermediario') || c === 'intermediate') return -2.5
  if (c.includes('chuva') || c === 'wet') return -4.5
  return 0
}

/**
 * Modificador de Combustível (Fuel load).
 * Base neutra de qualificação/simulação leve = 10-15 kg.
 * Cada 10 kg adicionais = -0.3 pts de pace.
 */
export function calculatePracticeFuelModifier(
  fuelKg?: number,
  explicitModifier?: number
): number {
  if (explicitModifier !== undefined && Number.isFinite(explicitModifier)) {
    return explicitModifier
  }
  if (fuelKg === undefined || !Number.isFinite(fuelKg)) return 0
  // 15kg neutro
  const deltaKg = fuelKg - 15
  return Number((-deltaKg * 0.03).toFixed(4))
}

/**
 * Modificador de Desgaste (Part / Tyre Wear).
 * 0% wear = 0 mod. Cada 10% wear reduz pace em -0.15 pts.
 */
export function calculatePracticeWearModifier(
  wearPercentage?: number,
  explicitModifier?: number
): number {
  if (explicitModifier !== undefined && Number.isFinite(explicitModifier)) {
    return explicitModifier
  }
  if (wearPercentage === undefined || !Number.isFinite(wearPercentage)) return 0
  return Number((-Math.max(0, wearPercentage) * 0.015).toFixed(4))
}

/**
 * Modificador Climático (Weather).
 */
export function calculatePracticeWeatherModifier(
  weather?: string,
  explicitModifier?: number
): number {
  if (explicitModifier !== undefined && Number.isFinite(explicitModifier)) {
    return explicitModifier
  }
  if (!weather) return 0
  const w = weather.toLowerCase()
  if (w === 'dry') return 0
  if (w === 'damp') return -1.5
  if (w === 'wet') return -4.0
  if (w === 'monsoon') return -7.0
  return 0
}

/**
 * Modificador de Novato / Adaptação (Rookie / Adaptation).
 * NUNCA altera o Structural do carro; incide apenas como sessão/piloto modifier.
 */
export function calculatePracticeRookieAdaptationModifier(
  driver?: PracticeDriverInput | null,
  isRookie?: boolean,
  explicitModifier?: number
): number {
  if (explicitModifier !== undefined && Number.isFinite(explicitModifier)) {
    return explicitModifier
  }
  const rookie = isRookie ?? driver?.is_academy ?? driver?.is_test_driver ?? false
  if (!rookie) return 0

  const adaptation = Number(driver?.f1_adaptation ?? driver?.adaptation ?? 60)
  // Se rookie com adaptação baixa (ex: 50), penalidade modesta até -0.6 pts
  const delta = (adaptation - 70) * 0.02
  return Math.min(0, Math.max(-1.0, Number(delta.toFixed(4))))
}

/**
 * Core canônico de cálculo de pace para sessões de Treino Livre.
 * NÃO utiliza Math.random(): rngModifier deve ser injetado externamente.
 */
export function computePracticePace(context: PracticeSessionContext): PracticePaceResult {
  const { teamKey, structural } = resolvePracticeStructuralStrength(context.team, {
    playerTeamId: context.playerTeamId,
    playerTeamKey: context.playerTeamKey,
    driverId: context.driver?.id,
    playerCar1DriverId: context.playerCar1DriverId,
    playerCar2DriverId: context.playerCar2DriverId,
    carIndex: context.carIndex,
  })

  const practiceExecution = calculatePracticeExecution(context.driver)
  const trackFit = calculatePracticeTrackFitModifier(context.trackFitScore, context.trackFitModifier)
  const setup = calculatePracticeSetupModifier(context.setupEfficiency, context.setupModifier)
  const program = calculatePracticeProgramModifier(context.practiceProgram, context.programModifier)
  const tyre = calculatePracticeTyreModifier(context.tyreCompound, context.tyreModifier)
  const fuel = calculatePracticeFuelModifier(context.fuelLoadKg, context.fuelModifier)
  const wear = calculatePracticeWearModifier(context.wearPercentage, context.wearModifier)
  const weather = calculatePracticeWeatherModifier(context.weatherCondition, context.weatherModifier)
  const rookieAdaptation = calculatePracticeRookieAdaptationModifier(
    context.driver,
    context.isRookie,
    context.adaptationModifier
  )

  // RNG determinístico injetado (TL-PACE-01A1 aceita via context.rngModifier, default 0)
  const rng = Number.isFinite(context.rngModifier) ? Number(context.rngModifier) : 0

  const sumModifiers =
    practiceExecution +
    trackFit +
    setup +
    program +
    tyre +
    fuel +
    wear +
    weather +
    rookieAdaptation +
    rng

  const finalPace = Number((structural + sumModifiers).toFixed(4))

  return {
    finalPace,
    breakdown: {
      teamKey,
      structural,
      practiceExecution,
      trackFit,
      setup,
      program,
      tyre,
      fuel,
      wear,
      weather,
      rookieAdaptation,
      rng,
      finalPace,
    },
  }
}
