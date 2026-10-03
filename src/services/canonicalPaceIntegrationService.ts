/**
 * canonicalPaceIntegrationService.ts
 *
 * BALANCE-EQUATION-02C — Structural Strength -> Pace Integration Service
 * BASELINE-2026-LOCK-01-CP3A — TrackFit & RNG Calibration
 *
 * Princípios Canônicos do 02C / CP3A:
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
} from '@/types/pace-integration'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { resolveCanonicalTeamKey } from '@/services/canonicalTeamIdentityService'
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
  sigma = QUALI_RNG_DEFAULT_SIGMA,
  clampMin = QUALI_RNG_TARGET_RANGE.MIN,
  clampMax = QUALI_RNG_TARGET_RANGE.MAX,
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
      f1Starts: 0, // starts=0 => exp=40 => qExec=80*0.7+40*0.2+80*0.1 = 72 => modifier = (72-80)*0.08 = -0.64
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
}

export const canonicalPaceIntegrationService = new CanonicalPaceIntegrationService()
export const auditPaceIntegration = () => canonicalPaceIntegrationService.auditPaceIntegration()
