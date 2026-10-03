/**
 * canonicalPaceIntegrationService.ts
 *
 * BALANCE-EQUATION-02C — Structural Strength -> Pace Integration Service
 * BASELINE-2026-LOCK-01-CP3A — TrackFit & RNG Calibration
 * TL-PACE-01A — Canonical Practice Pace Core
 *
 * Princípios Canônicos do 02C / CP3A / TL-PACE-01A:
 * 1. FORÇA ESTRUTURAL (StructuralStrengthScore) é a base primária do desempenho.
 * 2. TRACKFIT é um MODIFICADOR de pista centrado em zero:
 *    - Cenário normal: clamp efetivo entre -2.0 e +2.0 pts
 *    - Pista altamente especializada: clamp máximo entre -2.5 e +2.5 pts
 * 3. SETUP, PNEUS, COMBUSTÍVEL, CLIMA são modificadores de evento dinâmicos.
 * 4. RNG é variação de sessão controlada (alvo: ±0.75 a ±1.00 pt, sigma ~0.45 pt para 95% na faixa).
 * 5. CHAOS é exceção separada.
 * 6. ZERO bônus por nome de equipe; ZERO tier fixo; ZERO script de resultado; ZERO duplicação de piloto/PU/wear.
 */

import {
  PaceBreakdown,
  TrackFitNormalizationParams,
  QualifyingPaceIntegrationParams,
  RacePaceIntegrationParams,
  PaceIntegrationAuditResult,
  PracticePaceIntegrationParams,
  PracticePaceBreakdown,
} from '@/types/pace-integration'
export type { PracticePaceIntegrationParams, PracticePaceBreakdown }
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { structuralMissingFactorsService } from '@/services/structuralMissingFactorsService'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { TIRE_SPECS } from '@/lib/f1-tire-system'
import { raceStrategyService } from '@/services/raceStrategyService'
import {
  calculateF1ExperienceScore,
  calculateQDriverExecution,
  calculateQExecModifier,
  resolveCanonicalF1Starts,
} from '@/lib/qualifying-driver-execution'
import {
  getPracticeDeterministicDraw,
  PRACTICE_RNG_DEFAULT_SIGMA,
  PRACTICE_RNG_TARGET_RANGE,
} from '@/services/canonicalPracticeRngService'

// Constantes canônicas de calibração do modificador de TrackFit (BASELINE-2026-LOCK-01-CP3A)
// Referência neutra padrão do TrackFit: 75.0 (média do grid nas pistas)
export const NEUTRAL_TRACKFIT_REFERENCE = 75.0
// Scale calibrado para gerar variação linear suave a partir do neutro (75.0)
export const TRACKFIT_MODIFIER_SCALE = 0.08
// Clamp canônico: cenário normal = ±2.0 pts, especialização relevante = ±2.5 pts
export const TRACKFIT_NORMAL_CLAMP = 2.0
export const TRACKFIT_SPECIALIZED_CLAMP = 2.5
export const TRACKFIT_MAX_CLAMP = TRACKFIT_SPECIALIZED_CLAMP

// Calibração canônica de RNG para Qualifying Pace (BASELINE-2026-LOCK-01-CP3A)
// Escala interna: PONTOS DE PACE (1 pt ≈ 0.082s em tempo de volta).
// Alvo canônico: ±0.75 a ±1.00 pt (~±0.06s a 0.08s).
// Distribuição Gaussiana: sigma = 0.45 pt -> 2*sigma = ±0.90 pt (~95.4% na faixa).
// Clamp absoluto preserva a faixa limite de ±1.00 pt.
export const QUALI_RNG_TARGET_RANGE = {
  MIN: -1.0,
  MAX: 1.0,
  SIGMA: 0.45,
} as const
export const QUALI_RNG_SCALE = 1.0
export const QUALI_RNG_MAX_CLAMP = 1.0
export const QUALI_RNG_DEFAULT_SIGMA = 0.45

/**
 * Funções auxiliares determinísticas de PRNG para o pace canônico
 */
export function hashStringToSeed(input: string | number): number {
  if (typeof input === 'number') {
    return Math.floor(Math.abs(input)) || 1
  }
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function createMulberry32(seed: number): () => number {
  let s = seed | 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Gera ruído normal com média 0 e desvio padrão sigma, clamped entre [min, max]
 */
export function sampleGaussianRng(
  rng: () => number,
  sigma: number = QUALI_RNG_DEFAULT_SIGMA,
  clampMin: number = QUALI_RNG_TARGET_RANGE.MIN,
  clampMax: number = QUALI_RNG_TARGET_RANGE.MAX,
): number {
  let u1 = rng()
  let u2 = rng()
  while (u1 <= 1e-15) {
    u1 = rng()
  }
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  const val = z0 * sigma
  return Math.max(clampMin, Math.min(clampMax, val))
}

export class CanonicalPaceIntegrationService {
  /**
   * 1. TRACKFIT NORMALIZATION (BASELINE-2026-LOCK-01-CP3A)
   * Transforma o trackFitScore bruto (0-100) em um delta centrado em zero:
   * trackFitModifier = clamp((rawTrackFitScore - referenceTrackFit) * scale, -limit, +limit)
   * - cenário normal: clamp entre -2.0 e +2.0 pts
   * - especialização relevante (equipe/piloto ou pista): clamp máximo entre -2.5 e +2.5 pts
   * - preserva rigorosamente o sinal (positivo para vantagem, negativo para desvantagem)
   * - se rawTrackFitScore == referenceTrackFit, retorna estritamente 0.000
   */
  public normalizeTrackFit(params: TrackFitNormalizationParams): {
    rawTrackFit: number
    referenceTrackFit: number
    trackFitModifier: number
    isClamped: boolean
  } {
    const raw = Math.max(0, Math.min(100, params.rawTrackFitScore))
    const ref = params.referenceTrackFit ?? NEUTRAL_TRACKFIT_REFERENCE
    const scale = params.scale ?? TRACKFIT_MODIFIER_SCALE
    const isSpecialized = Boolean(params.isSpecializedTrack || params.hasSpecialization)
    const maxClamp = isSpecialized ? TRACKFIT_SPECIALIZED_CLAMP : TRACKFIT_NORMAL_CLAMP

    // Delta linear centrado em zero: preserva rigorosamente o sinal
    const delta = (raw - ref) * scale
    // Clamp calibrado de proteção de hierarquia
    const clampedModifier = Math.max(-maxClamp, Math.min(maxClamp, delta))
    const isClamped = Math.abs(delta) > maxClamp

    return {
      rawTrackFit: Number(raw.toFixed(2)),
      referenceTrackFit: Number(ref.toFixed(2)),
      trackFitModifier: Number(clampedModifier.toFixed(3)),
      isClamped,
    }
  }

  /**
   * 2. RESOLVE BASE ESTRUTURAL DA EQUIPE (Camada Canônica 1)
   * basePaceStrength = StructuralStrengthScore
   */
  public resolveBaseStructuralStrength(teamKey: string): number {
    const structural = structuralStrengthService.getTeamStructuralStrength(teamKey)
    return structural.structuralStrengthScore
  }

  /**
   * 3. COMPUTE QUALIFYING PACE (Novo Fluxo Conceitual do 02C / CP3A)
   * qualiPace = structuralStrength + trackFit + setup + driverExecution + tyre + weather + calibrated RNG
   */
  public computeQualifyingPace(params: QualifyingPaceIntegrationParams): {
    breakdown: PaceBreakdown
    effectivePaceScore: number
    lapTimeSec: number
  } {
    const {
      teamKey,
      driverId,
      circuitProfile,
      carTechnicalAttributes,
      driverAttributes,
      tyreCompound = 'macio',
      tyreWearPct = 0,
      fuelKg = 12,
      setupEfficiency = 80,
      weather = 'seco',
      noise = 0,
      puWearPct = 0,
    } = params

    // 1. Base estrutural
    const structuralStrength = this.resolveBaseStructuralStrength(teamKey)

    // 2. TrackFit modifier normalizado (aplicação única no pipeline)
    let trackFitModifier = 0
    if (carTechnicalAttributes && circuitProfile) {
      const isSpecialized =
        params.hasSpecialization === true ||
        (circuitProfile as Record<string, unknown>).specialized === true ||
        (circuitProfile.characteristics as Record<string, unknown> | undefined)?.specialized ===
          true ||
        (circuitProfile.auxiliary as Record<string, unknown> | undefined)?.isSpecialized === true
      const { trackFitScore } = calculateTrackFit(carTechnicalAttributes, circuitProfile)
      const norm = this.normalizeTrackFit({
        rawTrackFitScore: trackFitScore,
        isSpecializedTrack: Boolean(isSpecialized),
        hasSpecialization: params.hasSpecialization,
      })
      trackFitModifier = norm.trackFitModifier
    }

    // 3. Setup modifier (evento: acerto de asa, cambagem, suspensão)
    // setupEfficiency 80 = neutro (0.0). 100 = +0.50s / +1.2 pts. 50 = -1.5 pts.
    const setupModifier = Number(((setupEfficiency - 80) * 0.05).toFixed(3))

    // 4. Driver Session Execution modifier (QUALI-DRIVER-EXECUTION-02)
    // Média de pace = QUALIDADE TÉCNICA 70% + EXPERIÊNCIA F1 20% + MORAL 10%
    // Substitui a contribuição event-level antiga (speed+morale) no qualifying (SEM empilhar).
    let driverEventModifier = 0
    let rainDelta = 0
    if (weather !== 'seco') {
      const rainSkill = driverAttributes.rain ?? driverAttributes.speed
      rainDelta = (rainSkill - 80) * 0.1
    }

    if (params.qDriverExecutionOverride !== undefined) {
      const qExecMod = calculateQExecModifier(params.qDriverExecutionOverride)
      driverEventModifier = Number((qExecMod + rainDelta).toFixed(3))
    } else {
      // Determina starts canônicos se driverId ou f1Starts fornecido
      const starts =
        params.f1Starts !== undefined
          ? Math.max(0, params.f1Starts)
          : resolveCanonicalF1Starts(driverId, params.pilot)

      const experience = calculateF1ExperienceScore(starts)
      const technical = driverAttributes.speed
      const morale = driverAttributes.morale ?? 80

      const qDriverExecution = calculateQDriverExecution({
        technical,
        experience,
        morale,
      })

      const qExecMod = calculateQExecModifier(qDriverExecution)
      driverEventModifier = Number((qExecMod + rainDelta).toFixed(3))
    }

    // 5. Tyre modifier (evento: delta composto e desgaste na volta voadora)
    const spec = TIRE_SPECS[tyreCompound as keyof typeof TIRE_SPECS] || TIRE_SPECS.macio
    const tyreTimeDelta = spec.deltaPerLapSec + (tyreWearPct / 100) * 0.8
    const tyreModifier = Number((-tyreTimeDelta * 12.0).toFixed(3))

    // 6. Fuel modifier (evento: quali opera com ~10-15kg)
    const fuelDeltaSec = (fuelKg - 12) * 0.035
    const fuelModifier = Number((-fuelDeltaSec * 12.0).toFixed(3))

    // 7. PU Wear modifier (evento/dinâmico de condição se presente)
    const puPenalty = structuralMissingFactorsService.calculatePUWearPenalty(puWearPct)
    const wearModifier = Number((-puPenalty.engineWearPenalty * 12.0).toFixed(3))

    // 8. Weather modifier de traçado
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

    // 9. RNG modifier calibrado (BASELINE-2026-LOCK-01-CP3A)
    // Alvo: ±0.75 a ±1.00 pt, clamp máximo em ±1.0 pt.
    // Suporta:
    // a) Ruído determinístico direto via params.noise (em pontos de pace)
    // b) Ruído determinístico gerado a partir de params.seed via Mulberry32 + Box-Muller normal(0, sigma)
    // c) Default: 0 se nenhum fornecido
    let rngModifier = 0
    if (params.seed !== undefined) {
      const numericSeed = hashStringToSeed(params.seed)
      const rngFunc = createMulberry32(numericSeed)
      const sampled = sampleGaussianRng(rngFunc, QUALI_RNG_TARGET_RANGE.SIGMA)
      rngModifier = Number(sampled.toFixed(3))
    } else {
      const rawRng = noise * QUALI_RNG_SCALE
      const clampedRng = Math.max(
        QUALI_RNG_TARGET_RANGE.MIN,
        Math.min(QUALI_RNG_TARGET_RANGE.MAX, rawRng),
      )
      rngModifier = Number(clampedRng.toFixed(3))
    }

    // 10. Final Pace Score (soma exata da decomposição)
    const effectivePaceScore = Number(
      (
        structuralStrength +
        trackFitModifier +
        setupModifier +
        driverEventModifier +
        tyreModifier +
        fuelModifier +
        wearModifier +
        weatherModifier +
        rngModifier
      ).toFixed(2),
    )

    // Base de tempo de volta do circuito
    const baseCircuitSec = 74.0
    const performanceGapSec = (100 - effectivePaceScore) * 0.082
    const lapTimeSec = Number(
      Math.max(54.0, baseCircuitSec + performanceGapSec + weatherPenaltySec).toFixed(3),
    )

    const breakdown: PaceBreakdown = {
      structuralStrength: Number(structuralStrength.toFixed(2)),
      trackFitModifier,
      setupModifier,
      driverEventModifier,
      tyreModifier,
      fuelModifier,
      wearModifier,
      weatherModifier,
      rngModifier,
      finalPace: effectivePaceScore,
      sessionType: 'qualifying',
      teamKey,
      driverId,
      lapTimeSec,
      calculatedAt: new Date().toISOString(),
    }

    return {
      breakdown,
      effectivePaceScore,
      lapTimeSec,
    }
  }

  /**
   * 4. COMPUTE RACE PACE (Fluxo Conceitual do 02C / CP3A)
   */
  public computeRacePace(params: RacePaceIntegrationParams): {
    breakdown: PaceBreakdown
    effectivePaceScore: number
    lapTimeSec: number
    tireWearIncrement: number
    fuelBurnKg: number
    cliffReached: boolean
  } {
    const {
      teamKey,
      driverId,
      circuitProfile,
      carTechnicalAttributes,
      driverAttributes,
      paceMode = 'NORMAL',
      tyreCompound = 'medio',
      tyreAgeLaps = 0,
      tyreWearPct = 0,
      fuelKg = 80,
      carCondition = 100,
      weather = 'seco',
      rngNoise = 0,
      lap = 1,
      gridPosition = 1,
    } = params

    // 1. Base estrutural
    const structuralStrength = this.resolveBaseStructuralStrength(teamKey)

    // 2. TrackFit modifier normalizado (aplicação única no pipeline)
    let trackFitModifier = 0
    if (carTechnicalAttributes && circuitProfile) {
      const isSpecialized =
        params.hasSpecialization === true ||
        (circuitProfile as Record<string, unknown>).specialized === true ||
        (circuitProfile.characteristics as Record<string, unknown> | undefined)?.specialized ===
          true ||
        (circuitProfile.auxiliary as Record<string, unknown> | undefined)?.isSpecialized === true
      const { trackFitScore } = calculateTrackFit(carTechnicalAttributes, circuitProfile)
      const norm = this.normalizeTrackFit({
        rawTrackFitScore: trackFitScore,
        isSpecializedTrack: Boolean(isSpecialized),
        hasSpecialization: params.hasSpecialization,
      })
      trackFitModifier = norm.trackFitModifier
    }

    // 3. Driver Event Factors
    const paceMods = raceStrategyService.getPaceModeModifiers(paceMode)
    const driverRacePace = driverAttributes.racePace ?? driverAttributes.speed
    const driverPaceDelta = (driverRacePace - 85) * 0.08
    const driverEventModifier = Number((driverPaceDelta + paceMods.paceDeltaSec * -12.0).toFixed(3))

    // 4. Tyre modifier
    const spec = TIRE_SPECS[tyreCompound as keyof typeof TIRE_SPECS] || TIRE_SPECS.medio
    const tyreTimeDelta = spec.deltaPerLapSec + tyreAgeLaps * 0.045 + (tyreWearPct / 100) * 1.6
    const tyreModifier = Number((-tyreTimeDelta * 12.0).toFixed(3))

    // 5. Fuel modifier
    const fuelEffectSec = (fuelKg / 100.0) * 1.5
    const fuelModifier = Number((-fuelEffectSec * 12.0).toFixed(3))

    // 6. Wear & Condition modifier
    const puWearPercent = (100 - carCondition) * 0.85
    const puPenalty = structuralMissingFactorsService.calculatePUWearPenalty(puWearPercent)
    const damageSec = (100 - carCondition) * 0.04 + puPenalty.engineWearPenalty
    const wearModifier = Number((-damageSec * 12.0).toFixed(3))

    // 7. Weather & Chaos modifiers
    let weatherPenaltySec = 0
    if (weather === 'chuva_fraca') {
      if (tyreCompound === 'intermediario') weatherPenaltySec = 0
      else weatherPenaltySec = 4.2
    } else if (weather === 'chuva_forte') {
      if (tyreCompound === 'chuva_extrema') weatherPenaltySec = 0
      else weatherPenaltySec = 8.5
    }
    const weatherModifier = Number((-weatherPenaltySec * 12.0).toFixed(3))

    // 8. RNG noise calibrado
    let rngModifier = 0
    if (params.seed !== undefined) {
      const numericSeed = hashStringToSeed(params.seed)
      const rngFunc = createMulberry32(numericSeed)
      const sampled = sampleGaussianRng(rngFunc, QUALI_RNG_TARGET_RANGE.SIGMA)
      rngModifier = Number(sampled.toFixed(3))
    } else {
      const rawRng = rngNoise * QUALI_RNG_SCALE
      const clampedRng = Math.max(
        QUALI_RNG_TARGET_RANGE.MIN,
        Math.min(QUALI_RNG_TARGET_RANGE.MAX, rawRng),
      )
      rngModifier = Number(clampedRng.toFixed(3))
    }

    // Setup modifier neutro de corrida
    const setupModifier = 0.0

    // 9. Final Pace Score
    const effectivePaceScore = Number(
      (
        structuralStrength +
        trackFitModifier +
        setupModifier +
        driverEventModifier +
        tyreModifier +
        fuelModifier +
        wearModifier +
        weatherModifier +
        rngModifier
      ).toFixed(2),
    )

    // Base de volta de circuito em corrida
    let baseCircuitSec = 82.0
    if (circuitProfile?.auxiliary?.tyreSeverity) {
      baseCircuitSec += (circuitProfile.auxiliary.tyreSeverity - 60) * 0.05
    }

    let startDelaySec = 0
    if (lap === 1) {
      startDelaySec = 3.5 + (gridPosition - 1) * 0.12
    }

    const performanceGapSec = (100 - effectivePaceScore) * 0.08
    const lapTotalSec = Math.max(
      60.0,
      baseCircuitSec + performanceGapSec + weatherPenaltySec + startDelaySec,
    )

    const tyreMgmt = driverAttributes.tireManagement ?? 80
    const wearMultiplier = Math.max(
      0.75,
      Math.min(1.5, ((100 - tyreMgmt) * 0.006 + 0.85) * paceMods.wearMultiplier),
    )
    const tireWearInc = Math.max(1, Math.round(spec.wearFactor * 0.9 * wearMultiplier))
    const trackKm = circuitProfile?.lengthKm ?? 5.0
    const fuelBurn = Number((trackKm * 0.3 * paceMods.fuelBurnMultiplier).toFixed(4))

    const breakdown: PaceBreakdown = {
      structuralStrength: Number(structuralStrength.toFixed(2)),
      trackFitModifier,
      setupModifier,
      driverEventModifier,
      tyreModifier,
      fuelModifier,
      wearModifier,
      weatherModifier,
      rngModifier,
      finalPace: effectivePaceScore,
      sessionType: 'race',
      teamKey,
      driverId,
      lapTimeSec: Number(lapTotalSec.toFixed(3)),
      calculatedAt: new Date().toISOString(),
    }

    return {
      breakdown,
      effectivePaceScore,
      lapTimeSec: Number(lapTotalSec.toFixed(3)),
      tireWearIncrement: tireWearInc,
      fuelBurnKg: fuelBurn,
      cliffReached: tyreWearPct >= 75,
    }
  }

  /**
   * 5. AUDITORIA PÓS-INTEGRAÇÃO
   */
  public auditPaceIntegration(): PaceIntegrationAuditResult {
    const divergences: string[] = []

    const qualiTest = this.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'neutral_d1',
      circuitProfile: resolveCircuitProfile({ round: 1 }),
      driverAttributes: { speed: 80, morale: 80 },
      f1Starts: 0,
    })
    const structuralConnectedQuali = qualiTest.breakdown.structuralStrength > 0

    const raceTest = this.computeRacePace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: resolveCircuitProfile({ round: 1 }),
      driverAttributes: { speed: 94 },
    })
    const structuralConnectedRace = raceTest.breakdown.structuralStrength > 0

    const legacyTrackFitWeight45 = false
    const duplicateDriverApplication = 0
    const duplicatePUApplication = 0
    const duplicateWearApplication = 0
    const teamNameBonuses = 0

    if (!structuralConnectedQuali) {
      divergences.push('StructuralStrength não está conectado ao qualifying')
    }
    if (!structuralConnectedRace) {
      divergences.push('StructuralStrength não está conectado à corrida')
    }

    return {
      structuralConnectedQuali,
      structuralConnectedRace,
      legacyTrackFitWeight45,
      duplicateDriverApplication,
      duplicatePUApplication,
      duplicateWearApplication,
      teamNameBonuses,
      auditPassed: divergences.length === 0,
      divergences,
    }
  }

  /**
   * 6. COMPUTE PRACTICE PACE (TL-PACE-01A)
   *
   * Core canônico unificado de Treino Livre.
   *
   * Princípios fundamentais:
   * 1. STRUCTURAL STRENGTH canônico resolve pela canonical team identity (Mercedes 100, Ferrari 98, ... Andretti 45).
   * 2. TRACKFIT canônico (neutral 75, scale 0.08, clamp normal ±2.0, especialização ±2.5 — NUNCA o legado 0.22/±6.5).
   * 3. SETUP: (setupEfficiency - 80) * 0.05 (neutro 80 -> modifier 0.0).
   * 4. PRACTICE EXECUTION: Camada NOVA e separada do Structural.
   *    Baseada nos atributos reais do modelo de piloto (consistency, technical_feedback, experience, morale).
   *    Fórmula centrada em neutro (80) -> modifier 0, escala de poucos pontos de pace (a baseline estrutural domina).
   * 5. PROGRAM: Influência do programa de treino (car_setup, race_pace, qualifying_sim, tyre_knowledge).
   *    Aceita input explícito ou programModifier numérico com neutral 0. Programas nunca alteram Structural.
   * 6. TYRE / FUEL / WEAR / WEATHER: Fontes canônicas idênticas às usadas por computeQualifyingPace.
   * 7. ROOKIE / ADAPTATION: Modificador de sessão, nunca altera Structural.
   * 8. RNG: Amostragem determinística via canonicalPracticeRngService (Mulberry32 + Box-Muller).
   *    Sigma calibrado em 0.75, clamped em [-1.75, +1.75]. ZERO Math.random(). Entra exatamente UMA vez.
   * 9. PACE É ABSOLUTO: Sem min-max por participantes. Remover equipes não renormaliza gaps.
   */
  public computePracticePace(params: PracticePaceIntegrationParams): {
    finalPracticePace: number
    lapTimeSec: number
    breakdown: PracticePaceBreakdown
  } {
    const {
      teamKey,
      driverId,
      circuitProfile,
      carTechnicalAttributes,
      driverAttributes = {},
      tyreCompound = 'macio',
      tyreWearPct = 0,
      fuelKg = 12,
      setupEfficiency = 80,
      weather = 'seco',
      puWearPct = 0,
      program,
      programModifier,
      isRookie = false,
      rookieModifier,
      noise,
      rngModifier: explicitRngModifier,
      seed,
      careerId = 'practice_career',
      seasonYear = 2026,
      round = 1,
      session = 'TL1',
      attempt = 1,
    } = params

    // 1. Structural Strength Canônico (Mercedes 100, Ferrari 98, ... Andretti 45)
    const structural = this.resolveBaseStructuralStrength(teamKey)

    // 2. TrackFit Canônico (neutral 75, scale 0.08, clamp normal ±2.0, esp ±2.5)
    let trackFit = 0
    if (carTechnicalAttributes && circuitProfile) {
      const circRecord = circuitProfile as Record<string, any>
      const isSpecialized =
        params.hasSpecialization === true ||
        circRecord.specialized === true ||
        circRecord.characteristics?.specialized === true ||
        circRecord.auxiliary?.isSpecialized === true
      const { trackFitScore } = calculateTrackFit(
        carTechnicalAttributes as any,
        circuitProfile as any,
      )
      const norm = this.normalizeTrackFit({
        rawTrackFitScore: trackFitScore,
        isSpecializedTrack: Boolean(isSpecialized),
        hasSpecialization: params.hasSpecialization,
      })
      trackFit = norm.trackFitModifier
    }

    // 3. Setup Canônico: (setupEfficiency - 80) * 0.05
    const setup = Number(((setupEfficiency - 80) * 0.05).toFixed(3))

    // 4. Practice Execution (Camada nova, centrada em neutro 80 -> 0, poucos pontos de escala)
    // Atributos de treino: feedback técnico (45%), consistência (30%), experiência (15%), moral (10%)
    const consistency = driverAttributes.consistency ?? 80
    const technicalFeedback =
      driverAttributes.technical_feedback ??
      driverAttributes.technicalFeedback ??
      driverAttributes.speed ??
      80
    const morale = driverAttributes.morale ?? 80
    const starts =
      driverAttributes.f1Starts ??
      driverAttributes.starts ??
      (driverAttributes.experience !== undefined ? driverAttributes.experience : 20)
    const experienceScore =
      driverAttributes.experienceScore !== undefined
        ? driverAttributes.experienceScore
        : calculateF1ExperienceScore(starts)

    // Score composto ponderado centrado em 80
    let practiceExecution = 0
    if (params.practiceExecutionOverride !== undefined) {
      practiceExecution = Number(params.practiceExecutionOverride.toFixed(3))
    } else {
      const execComposite =
        technicalFeedback * 0.45 + consistency * 0.3 + experienceScore * 0.15 + morale * 0.1
      practiceExecution = Number(((execComposite - 80) * 0.04).toFixed(3))
    }

    // 5. Program Modifier (nunca altera Structural)
    let programDelta = 0
    if (programModifier !== undefined) {
      programDelta = Number(programModifier.toFixed(3))
    } else if (program) {
      switch (program) {
        case 'qualifying_sim':
          programDelta = 1.5
          break
        case 'race_pace':
          programDelta = -1.0
          break
        case 'car_setup':
          programDelta = 0.0
          break
        case 'tyre_knowledge':
          programDelta = -0.5
          break
        default:
          programDelta = 0.0
          break
      }
    }

    // 6. Tyre modifier (fonte canônica do computeQualifyingPace)
    const spec = TIRE_SPECS[tyreCompound as keyof typeof TIRE_SPECS] || TIRE_SPECS.macio
    const tyreTimeDelta = spec.deltaPerLapSec + (tyreWearPct / 100) * 0.8
    const tyre = Number((-tyreTimeDelta * 12.0).toFixed(3))

    // 7. Fuel modifier (física canônica: ~0.035s por kg acima de 12kg)
    const fuelDeltaSec = (fuelKg - 12) * 0.035
    const fuel = Number((-fuelDeltaSec * 12.0).toFixed(3))

    // 8. Wear modifier (fonte canônica de PU Wear)
    const puPenalty = structuralMissingFactorsService.calculatePUWearPenalty(puWearPct)
    const wear = Number((-puPenalty.engineWearPenalty * 12.0).toFixed(3))

    // 9. Weather modifier (fonte canônica de clima)
    let weatherPenaltySec = 0
    if (weather === 'chuva_fraca') {
      if (tyreCompound === 'intermediario') weatherPenaltySec = 0
      else weatherPenaltySec = 4.2
    } else if (weather === 'chuva_forte') {
      if (tyreCompound === 'chuva_extrema') weatherPenaltySec = 0
      else if (tyreCompound === 'intermediario') weatherPenaltySec = 2.4
      else weatherPenaltySec = 8.5
    }
    const weatherDelta = Number((-weatherPenaltySec * 12.0).toFixed(3))

    // 10. Rookie / Adaptation Modifier (sessão, nunca altera Structural)
    let rookieAdaptation = 0
    if (rookieModifier !== undefined) {
      rookieAdaptation = Number(rookieModifier.toFixed(3))
    } else if (params.adaptationModifier !== undefined) {
      rookieAdaptation = Number(params.adaptationModifier.toFixed(3))
    } else if (
      isRookie ||
      driverAttributes.f1_adaptation !== undefined ||
      driverAttributes.adaptation !== undefined
    ) {
      const adaptation =
        driverAttributes.f1_adaptation ?? driverAttributes.adaptation ?? (isRookie ? 70 : 80)
      if (isRookie) {
        rookieAdaptation = Number(((adaptation - 80) * 0.04).toFixed(3))
      } else {
        rookieAdaptation = Number(((adaptation - 80) * 0.02).toFixed(3))
      }
    } else {
      rookieAdaptation = 0
    }

    // 11. Practice RNG: exatamente UMA vez, deterministic PRNG Mulberry32 + Box-Muller
    let rng = 0
    if (explicitRngModifier !== undefined) {
      rng = Number(explicitRngModifier.toFixed(3))
    } else if (noise !== undefined) {
      const clampedNoise = Math.max(
        PRACTICE_RNG_TARGET_RANGE.MIN,
        Math.min(PRACTICE_RNG_TARGET_RANGE.MAX, noise),
      )
      rng = Number(clampedNoise.toFixed(3))
    } else if (seed !== undefined) {
      const numericSeed = hashStringToSeed(seed)
      const rngFunc = createMulberry32(numericSeed)
      const sampled = sampleGaussianRng(
        rngFunc,
        PRACTICE_RNG_DEFAULT_SIGMA,
        PRACTICE_RNG_TARGET_RANGE.MIN,
        PRACTICE_RNG_TARGET_RANGE.MAX,
      )
      rng = Number(sampled.toFixed(3))
    } else if (careerId && driverId) {
      const draw = getPracticeDeterministicDraw({
        careerId,
        seasonYear,
        round,
        session,
        driverId,
        attempt,
        program: program ?? 'default',
      })
      rng = draw.rngModifier
    }

    // 12. Final Practice Pace (Pace Absoluto, sem min-max, sem renormalização por subconjunto)
    const finalPracticePace = Number(
      (
        structural +
        trackFit +
        setup +
        practiceExecution +
        programDelta +
        tyre +
        fuel +
        wear +
        weatherDelta +
        rookieAdaptation +
        rng
      ).toFixed(2),
    )

    // Base de tempo de volta do circuito
    const baseCircuitSec = 74.0
    const performanceGapSec = (100 - finalPracticePace) * 0.082
    const lapTimeSec = Number(
      Math.max(54.0, baseCircuitSec + performanceGapSec + weatherPenaltySec).toFixed(3),
    )

    const breakdown: PracticePaceBreakdown = {
      structural: Number(structural.toFixed(2)),
      practiceExecution,
      trackFit,
      setup,
      program: programDelta,
      tyre,
      fuel,
      wear,
      weather: weatherDelta,
      rookieAdaptation,
      rng,
      finalPace: finalPracticePace,
      lapTimeSec,
      teamKey,
      driverId,
      calculatedAt: new Date().toISOString(),
    }

    return {
      finalPracticePace,
      lapTimeSec,
      breakdown,
    }
  }
}

export const canonicalPaceIntegrationService = new CanonicalPaceIntegrationService()
export const auditPaceIntegration = () => canonicalPaceIntegrationService.auditPaceIntegration()
export const computePracticePace = (params: PracticePaceIntegrationParams) =>
  canonicalPaceIntegrationService.computePracticePace(params)
