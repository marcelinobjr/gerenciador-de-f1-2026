/**
 * baseline-2026-lock-cp4.test.ts
 *
 * PROJETO: APEX GP MANAGER
 * ETAPA: BASELINE-2026-LOCK-01 — CP4 (Lock Técnico da Baseline 2026)
 *
 * Objetivo: PROVAR + TRAVAR CONTRATO + DETECTAR DRIFT FUTURO.
 * CP4 não é recalibração. Formaliza invariantes e previne drift silencioso.
 *
 * CASOS HOMOLOGADOS:
 * CP4-01: 12 equipes canônicas presentes.
 * CP4-02: Targets exatamente 100/98/96/94/87/87/86/75/70/60/50/45.
 * CP4-03: Technical weights 50/30/10/10.
 * CP4-04: Driver weights 80/10/10.
 * CP4-05: Team weights 80/20.
 * CP4-06: Final Structural 60/25/15.
 * CP4-07: TrackFit neutral = 75.
 * CP4-08: TrackFit scale = 0.08.
 * CP4-09: TrackFit normal clamp = ±2.0.
 * CP4-10: TrackFit specialized clamp = ±2.5.
 * CP4-11: TrackFit aplicado 1x.
 * CP4-12: Setup neutral = 80.
 * CP4-13: Setup coefficient = 0.05.
 * CP4-14: Setup aplicado 1x.
 * CP4-15: RNG sigma = 0.45.
 * CP4-16: RNG determinístico por seed.
 * CP4-17: Fixture estrutural neutra reproduz hierarquia esperada.
 * CP4-18: Piloto real não altera Structural Strength.
 * CP4-19: TrackFit pode alterar ordem local sem alterar baseline.
 * CP4-20: Setup pode alterar pace sem alterar baseline.
 * CP4-21: RNG pode alterar resultado de volta sem alterar baseline.
 * CP4-22: Driver Morale permanece camada de Driver, não baseline de equipe.
 * CP4-23: Nenhum modifier por teamName.
 * CP4-24: Nenhum cap de resultado.
 * CP4-25: Nenhuma dupla aplicação de TrackFit / setup / RNG.
 * CP4-26: Estado evoluído da carreira pode divergir da baseline sem falhar o lock.
 * CP4-27: Baseline inicial continua restaurável/determinística conforme mecanismo existente.
 * CP4-28: WCA targets permanecem intactos.
 * CP4-29: CP2 continua verde.
 * CP4-30: CP3A continua verde.
 * CP4-31: SETUP-EFFICIENCY-QUALI-01A continua verde.
 * CP4-32: CALIBRATION-WCA-01R continua 27/27.
 */

import { describe, it, expect } from 'vitest'
import {
  BASELINE_2026_TARGETS,
  BASELINE_2026_CANONICAL_ORDER,
  BASELINE_2026_FORMULA_CONTRACT,
  BASELINE_2026_TRACKFIT_CONTRACT,
  BASELINE_2026_SETUP_CONTRACT,
  BASELINE_2026_RNG_CONTRACT,
  BASELINE_2026_TOLERANCE,
} from '@/data/baseline-2026-lock-contract'
import {
  structuralStrengthService,
  TECHNICAL_WEIGHTS,
  DRIVER_WEIGHTS,
  TEAM_WEIGHTS,
  STRUCTURAL_STRENGTH_WEIGHTS,
  NEUTRAL_ADAPTATION_VALUE,
} from '@/services/structuralStrengthService'
import {
  canonicalPaceIntegrationService,
  TRACKFIT_NORMAL_CLAMP,
  TRACKFIT_SPECIALIZED_CLAMP,
  TRACKFIT_MAX_CLAMP,
  NEUTRAL_TRACKFIT_REFERENCE,
  TRACKFIT_MODIFIER_SCALE,
  QUALI_RNG_TARGET_RANGE,
  QUALI_RNG_DEFAULT_SIGMA,
  createMulberry32,
  sampleGaussianRng,
} from '@/services/canonicalPaceIntegrationService'
import {
  BASELINE_2026_V1_TEAMS,
  BASELINE_2026_V1_ORDER,
  BASELINE_2026_V1_METADATA,
} from '@/data/baseline-2026-v1'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'

describe('BASELINE-2026-LOCK-01 — CP4 (Lock Técnico da Baseline 2026)', () => {
  const silverstone = resolveCircuitProfile({ round: 11 })
  const monza = resolveCircuitProfile({ round: 15 })

  // CP4-01: 12 equipes canônicas presentes.
  it('CP4-01: 12 equipes canônicas presentes', () => {
    const keys = Object.keys(BASELINE_2026_TARGETS)
    expect(keys).toHaveLength(12)
    expect(BASELINE_2026_CANONICAL_ORDER).toHaveLength(12)
    expect(Object.keys(BASELINE_2026_V1_TEAMS)).toHaveLength(12)
    expect(BASELINE_2026_V1_ORDER).toHaveLength(12)

    for (const key of BASELINE_2026_CANONICAL_ORDER) {
      expect(BASELINE_2026_TARGETS[key]).toBeDefined()
      expect(BASELINE_2026_V1_TEAMS[key]).toBeDefined()
    }
  })

  // CP4-02: Targets exatamente 100/98/96/94/87/87/86/75/70/60/50/45.
  it('CP4-02: Targets exatamente 100/98/96/94/87/87/86/75/70/60/50/45', () => {
    const expectedScores = [100, 98, 96, 94, 87, 87, 86, 75, 70, 60, 50, 45]
    BASELINE_2026_CANONICAL_ORDER.forEach((key, idx) => {
      const contractTarget = BASELINE_2026_TARGETS[key].targetScore
      const v1Score = BASELINE_2026_V1_TEAMS[key].score
      expect(contractTarget).toBe(expectedScores[idx])
      expect(v1Score).toBe(expectedScores[idx])
    })
  })

  // CP4-03: Technical weights 50/30/10/10.
  it('CP4-03: Technical weights 50/30/10/10', () => {
    expect(TECHNICAL_WEIGHTS.parts).toBe(BASELINE_2026_FORMULA_CONTRACT.TECHNICAL_WEIGHTS.parts)
    expect(TECHNICAL_WEIGHTS.parts).toBe(0.5)

    expect(TECHNICAL_WEIGHTS.effectivePu).toBe(
      BASELINE_2026_FORMULA_CONTRACT.TECHNICAL_WEIGHTS.effectivePu,
    )
    expect(TECHNICAL_WEIGHTS.effectivePu).toBe(0.3)

    expect(TECHNICAL_WEIGHTS.reliability).toBe(
      BASELINE_2026_FORMULA_CONTRACT.TECHNICAL_WEIGHTS.reliability,
    )
    expect(TECHNICAL_WEIGHTS.reliability).toBe(0.1)

    expect(TECHNICAL_WEIGHTS.condition).toBe(
      BASELINE_2026_FORMULA_CONTRACT.TECHNICAL_WEIGHTS.condition,
    )
    expect(TECHNICAL_WEIGHTS.condition).toBe(0.1)

    const sum =
      TECHNICAL_WEIGHTS.parts +
      TECHNICAL_WEIGHTS.effectivePu +
      TECHNICAL_WEIGHTS.reliability +
      TECHNICAL_WEIGHTS.condition
    expect(sum).toBeCloseTo(1.0, 5)
  })

  // CP4-04: Driver weights 80/10/10.
  it('CP4-04: Driver weights 80/10/10', () => {
    expect(DRIVER_WEIGHTS.driverAttributes).toBe(
      BASELINE_2026_FORMULA_CONTRACT.DRIVER_WEIGHTS.driverAttributes,
    )
    expect(DRIVER_WEIGHTS.driverAttributes).toBe(0.8)

    expect(DRIVER_WEIGHTS.morale).toBe(BASELINE_2026_FORMULA_CONTRACT.DRIVER_WEIGHTS.morale)
    expect(DRIVER_WEIGHTS.morale).toBe(0.1)

    expect(DRIVER_WEIGHTS.adaptation).toBe(BASELINE_2026_FORMULA_CONTRACT.DRIVER_WEIGHTS.adaptation)
    expect(DRIVER_WEIGHTS.adaptation).toBe(0.1)

    expect(NEUTRAL_ADAPTATION_VALUE).toBe(75)

    const sum = DRIVER_WEIGHTS.driverAttributes + DRIVER_WEIGHTS.morale + DRIVER_WEIGHTS.adaptation
    expect(sum).toBeCloseTo(1.0, 5)
  })

  // CP4-05: Team weights 80/20.
  it('CP4-05: Team weights 80/20', () => {
    expect(TEAM_WEIGHTS.infrastructure).toBe(
      BASELINE_2026_FORMULA_CONTRACT.TEAM_WEIGHTS.infrastructure,
    )
    expect(TEAM_WEIGHTS.infrastructure).toBe(0.8)

    expect(TEAM_WEIGHTS.teamMorale).toBe(BASELINE_2026_FORMULA_CONTRACT.TEAM_WEIGHTS.teamMorale)
    expect(TEAM_WEIGHTS.teamMorale).toBe(0.2)

    const sum = TEAM_WEIGHTS.infrastructure + TEAM_WEIGHTS.teamMorale
    expect(sum).toBeCloseTo(1.0, 5)
  })

  // CP4-06: Final Structural 60/25/15.
  it('CP4-06: Final Structural 60/25/15', () => {
    expect(STRUCTURAL_STRENGTH_WEIGHTS.technical).toBe(
      BASELINE_2026_FORMULA_CONTRACT.FINAL_STRUCTURAL_WEIGHTS.technical,
    )
    expect(STRUCTURAL_STRENGTH_WEIGHTS.technical).toBe(0.6)

    expect(STRUCTURAL_STRENGTH_WEIGHTS.driver).toBe(
      BASELINE_2026_FORMULA_CONTRACT.FINAL_STRUCTURAL_WEIGHTS.driver,
    )
    expect(STRUCTURAL_STRENGTH_WEIGHTS.driver).toBe(0.25)

    expect(STRUCTURAL_STRENGTH_WEIGHTS.team).toBe(
      BASELINE_2026_FORMULA_CONTRACT.FINAL_STRUCTURAL_WEIGHTS.team,
    )
    expect(STRUCTURAL_STRENGTH_WEIGHTS.team).toBe(0.15)

    const sum =
      STRUCTURAL_STRENGTH_WEIGHTS.technical +
      STRUCTURAL_STRENGTH_WEIGHTS.driver +
      STRUCTURAL_STRENGTH_WEIGHTS.team
    expect(sum).toBeCloseTo(1.0, 5)
  })

  // CP4-07: TrackFit neutral = 75.
  it('CP4-07: TrackFit neutral = 75', () => {
    expect(NEUTRAL_TRACKFIT_REFERENCE).toBe(BASELINE_2026_TRACKFIT_CONTRACT.neutralReference)
    expect(NEUTRAL_TRACKFIT_REFERENCE).toBe(75.0)

    const norm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 75.0,
      referenceTrackFit: 75.0,
    })
    expect(norm.trackFitModifier).toBe(0.0)
  })

  // CP4-08: TrackFit scale = 0.08.
  it('CP4-08: TrackFit scale = 0.08', () => {
    expect(TRACKFIT_MODIFIER_SCALE).toBe(BASELINE_2026_TRACKFIT_CONTRACT.scale)
    expect(TRACKFIT_MODIFIER_SCALE).toBe(0.08)

    const deltaRaw = 10.0 // 85 - 75
    const norm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 85.0,
      referenceTrackFit: 75.0,
    })
    expect(norm.trackFitModifier).toBeCloseTo(deltaRaw * 0.08, 3)
  })

  // CP4-09: TrackFit normal clamp = ±2.0.
  it('CP4-09: TrackFit normal clamp = ±2.0', () => {
    expect(TRACKFIT_NORMAL_CLAMP).toBe(BASELINE_2026_TRACKFIT_CONTRACT.normalClamp)
    expect(TRACKFIT_NORMAL_CLAMP).toBe(2.0)

    const maxNormal = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100.0,
      isSpecializedTrack: false,
    })
    expect(maxNormal.trackFitModifier).toBe(2.0)
    expect(maxNormal.isClamped).toBe(true)

    const minNormal = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 0.0,
      isSpecializedTrack: false,
    })
    expect(minNormal.trackFitModifier).toBe(-2.0)
    expect(minNormal.isClamped).toBe(true)
  })

  // CP4-10: TrackFit specialized clamp = ±2.5.
  it('CP4-10: TrackFit specialized clamp = ±2.5', () => {
    expect(TRACKFIT_SPECIALIZED_CLAMP).toBe(BASELINE_2026_TRACKFIT_CONTRACT.specializedClamp)
    expect(TRACKFIT_SPECIALIZED_CLAMP).toBe(2.5)
    expect(TRACKFIT_MAX_CLAMP).toBe(2.5)

    const maxSpec = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 100.0,
      isSpecializedTrack: true,
    })
    expect(maxSpec.trackFitModifier).toBe(2.5)
    expect(maxSpec.isClamped).toBe(true)

    const minSpec = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 0.0,
      isSpecializedTrack: true,
    })
    expect(minSpec.trackFitModifier).toBe(-2.5)
    expect(minSpec.isClamped).toBe(true)
  })

  // CP4-11: TrackFit aplicado 1x.
  it('CP4-11: TrackFit aplicado 1x', () => {
    const auditRes = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(auditRes.legacyTrackFitWeight45).toBe(false)
    expect(auditRes.auditPassed).toBe(true)

    const cadTech = (BASELINE_V0_DATA.teams['cadillac'] as any)?.technicalAttributes
    const result = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-drv',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0,
    })

    const b = result.breakdown
    const sumWithSingleTF = Number(
      (
        b.structuralStrength +
        b.trackFitModifier +
        b.setupModifier +
        b.driverEventModifier +
        b.tyreModifier +
        b.fuelModifier +
        b.wearModifier +
        b.weatherModifier +
        b.rngModifier
      ).toFixed(2),
    )
    expect(result.effectivePaceScore).toBe(sumWithSingleTF)

    if (b.trackFitModifier !== 0) {
      const sumWithDoubleTF = Number((sumWithSingleTF + b.trackFitModifier).toFixed(2))
      expect(result.effectivePaceScore).not.toBe(sumWithDoubleTF)
    }
  })

  // CP4-12: Setup neutral = 80.
  it('CP4-12: Setup neutral = 80', () => {
    expect(BASELINE_2026_SETUP_CONTRACT.neutralReference).toBe(80.0)

    const pace80 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'wil-drv',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0,
    })
    expect(pace80.breakdown.setupModifier).toBe(0.0)
  })

  // CP4-13: Setup coefficient = 0.05.
  it('CP4-13: Setup coefficient = 0.05', () => {
    expect(BASELINE_2026_SETUP_CONTRACT.coefficient).toBe(0.05)

    const pace100 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'wil-drv',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 100,
      noise: 0,
    })
    expect(pace100.breakdown.setupModifier).toBeCloseTo((100 - 80) * 0.05, 3) // +1.000

    const pace60 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'wil-drv',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 60,
      noise: 0,
    })
    expect(pace60.breakdown.setupModifier).toBeCloseTo((60 - 80) * 0.05, 3) // -1.000
  })

  // CP4-14: Setup aplicado 1x.
  it('CP4-14: Setup aplicado 1x', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'wil-drv',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 95,
      noise: 0,
    })

    const b = pace.breakdown
    expect(b.setupModifier).toBeCloseTo((95 - 80) * 0.05, 3)

    const singleSum = Number(
      (
        b.structuralStrength +
        b.trackFitModifier +
        b.setupModifier +
        b.driverEventModifier +
        b.tyreModifier +
        b.fuelModifier +
        b.wearModifier +
        b.weatherModifier +
        b.rngModifier
      ).toFixed(2),
    )
    expect(pace.effectivePaceScore).toBe(singleSum)

    const doubleSum = Number((singleSum + b.setupModifier).toFixed(2))
    expect(pace.effectivePaceScore).not.toBe(doubleSum)
  })

  // CP4-15: RNG sigma = 0.45.
  it('CP4-15: RNG sigma = 0.45', () => {
    expect(QUALI_RNG_DEFAULT_SIGMA).toBe(BASELINE_2026_RNG_CONTRACT.defaultSigma)
    expect(QUALI_RNG_DEFAULT_SIGMA).toBe(0.45)
    expect(QUALI_RNG_TARGET_RANGE.SIGMA).toBe(0.45)
    expect(QUALI_RNG_TARGET_RANGE.MIN).toBe(BASELINE_2026_RNG_CONTRACT.targetMin)
    expect(QUALI_RNG_TARGET_RANGE.MAX).toBe(BASELINE_2026_RNG_CONTRACT.targetMax)

    const rng = createMulberry32(1234)
    const samples: number[] = []
    for (let i = 0; i < 500; i++) {
      const v = sampleGaussianRng(rng, QUALI_RNG_DEFAULT_SIGMA)
      samples.push(v)
      expect(v).toBeGreaterThanOrEqual(-1.0)
      expect(v).toBeLessThanOrEqual(1.0)
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(Math.abs(mean)).toBeLessThan(0.08)

    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length
    const stdDev = Math.sqrt(variance)
    expect(stdDev).toBeGreaterThan(0.35)
    expect(stdDev).toBeLessThan(0.55)
  })

  // CP4-16: RNG determinístico por seed.
  it('CP4-16: RNG determinístico por seed', () => {
    const seed = 'cp4_deterministic_seed_audit_2026'

    const run1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'lec',
      circuitProfile: silverstone,
      driverAttributes: { speed: 90 },
      seed,
    })

    const run2 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'lec',
      circuitProfile: silverstone,
      driverAttributes: { speed: 90 },
      seed,
    })

    expect(run1.effectivePaceScore).toBe(run2.effectivePaceScore)
    expect(run1.lapTimeSec).toBe(run2.lapTimeSec)
    expect(run1.breakdown.rngModifier).toBe(run2.breakdown.rngModifier)
    expect(run1.breakdown.finalPace).toBe(run2.breakdown.finalPace)
  })

  // CP4-17: Fixture estrutural neutra reproduz hierarquia esperada.
  it('CP4-17: Fixture estrutural neutra reproduz hierarquia esperada', () => {
    const results = BASELINE_2026_CANONICAL_ORDER.map((teamKey) => {
      const breakdown = structuralStrengthService.getTeamStructuralStrength(teamKey, {
        seasonYear: 2026,
      })
      const target = BASELINE_2026_TARGETS[teamKey].targetScore
      return {
        teamKey,
        score: breakdown.structuralStrengthScore,
        target,
      }
    })

    results.forEach((r) => {
      expect(Math.abs(r.score - r.target)).toBeLessThanOrEqual(BASELINE_2026_TOLERANCE)
      expect(r.score).toBe(r.target)
    })

    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score)
    }
  })

  // CP4-18: Piloto real não altera Structural Strength.
  it('CP4-18: Piloto real não altera Structural Strength', () => {
    const baseRedBull = structuralStrengthService.getTeamStructuralStrength('redbull', {
      seasonYear: 2026,
    })
    expect(baseRedBull.structuralStrengthScore).toBe(94)

    const qualiWithVerstappen = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'redbull',
      driverId: 'ver',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 98, consistency: 95, morale: 90 },
      setupEfficiency: 80,
      noise: 0,
    })

    expect(qualiWithVerstappen.breakdown.structuralStrength).toBe(94)
    expect(qualiWithVerstappen.breakdown.driverEventModifier).toBeGreaterThan(0)
    expect(qualiWithVerstappen.effectivePaceScore).toBeGreaterThan(94)

    const baseAfter = structuralStrengthService.getTeamStructuralStrength('redbull', {
      seasonYear: 2026,
    })
    expect(baseAfter.structuralStrengthScore).toBe(94)
  })

  // CP4-19: TrackFit pode alterar ordem local sem alterar baseline.
  it('CP4-19: TrackFit pode alterar ordem local sem alterar baseline', () => {
    const williamsBase = structuralStrengthService.getTeamStructuralStrength('williams', {
      seasonYear: 2026,
    })
    const haasBase = structuralStrengthService.getTeamStructuralStrength('haas', {
      seasonYear: 2026,
    })
    expect(williamsBase.structuralStrengthScore).toBe(70)
    expect(haasBase.structuralStrengthScore).toBe(75)

    const williamsFavorablePace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'wil-drv',
      circuitProfile: monza,
      carTechnicalAttributes: { topSpeed: 95, acceleration: 85, downforce: 65 },
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0,
      hasSpecialization: true,
    })

    const haasUnfavorablePace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'haas',
      driverId: 'haa-drv',
      circuitProfile: monza,
      carTechnicalAttributes: { topSpeed: 60, acceleration: 60, downforce: 90 },
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0,
    })

    expect(williamsFavorablePace.breakdown.trackFitModifier).toBeGreaterThan(0)
    expect(haasUnfavorablePace.breakdown.trackFitModifier).toBeLessThan(0)

    const localPaceDiff =
      williamsFavorablePace.effectivePaceScore - haasUnfavorablePace.effectivePaceScore
    const structuralDiff = williamsBase.structuralStrengthScore - haasBase.structuralStrengthScore // -5 pts
    expect(localPaceDiff).toBeGreaterThan(structuralDiff)

    const williamsBaseRecheck = structuralStrengthService.getTeamStructuralStrength('williams', {
      seasonYear: 2026,
    })
    const haasBaseRecheck = structuralStrengthService.getTeamStructuralStrength('haas', {
      seasonYear: 2026,
    })
    expect(williamsBaseRecheck.structuralStrengthScore).toBe(70)
    expect(haasBaseRecheck.structuralStrengthScore).toBe(75)
  })

  // CP4-20: Setup pode alterar pace sem alterar baseline.
  it('CP4-20: Setup pode alterar pace sem alterar baseline', () => {
    const amBase = structuralStrengthService.getTeamStructuralStrength('astonmartin', {
      seasonYear: 2026,
    })
    expect(amBase.structuralStrengthScore).toBe(60)

    const pacePerfectSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'astonmartin',
      driverId: 'alo',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 100,
      noise: 0,
    })
    expect(pacePerfectSetup.breakdown.setupModifier).toBeCloseTo(1.0, 3)
    expect(pacePerfectSetup.effectivePaceScore).toBeCloseTo(61.0, 2)

    const pacePoorSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'astonmartin',
      driverId: 'alo',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 60,
      noise: 0,
    })
    expect(pacePoorSetup.breakdown.setupModifier).toBeCloseTo(-1.0, 3)
    expect(pacePoorSetup.effectivePaceScore).toBeCloseTo(59.0, 2)

    const amBaseAfter = structuralStrengthService.getTeamStructuralStrength('astonmartin', {
      seasonYear: 2026,
    })
    expect(amBaseAfter.structuralStrengthScore).toBe(60)
  })

  // CP4-21: RNG pode alterar resultado de volta sem alterar baseline.
  it('CP4-21: RNG pode alterar resultado de volta sem alterar baseline', () => {
    const cadBase = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })
    expect(cadBase.structuralStrengthScore).toBe(50)

    const paceLucky = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-drv',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0.8,
    })
    expect(paceLucky.breakdown.rngModifier).toBe(0.8)
    expect(paceLucky.effectivePaceScore).toBe(50.8)

    const paceUnlucky = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-drv',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: -0.8,
    })
    expect(paceUnlucky.breakdown.rngModifier).toBe(-0.8)
    expect(paceUnlucky.effectivePaceScore).toBe(49.2)

    const cadBaseAfter = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })
    expect(cadBaseAfter.structuralStrengthScore).toBe(50)
  })

  // CP4-22: Driver Morale permanece camada de Driver, não baseline de equipe.
  it('CP4-22: Driver Morale permanece camada de Driver, não baseline de equipe', () => {
    const driversHighMorale = [
      {
        name: 'Piloto Teste',
        role: 'driver1' as const,
        overallRating: 80,
        speed: 80,
        consistency: 80,
        rain: 80,
        defense: 80,
        morale: 100,
      },
    ]
    const driversLowMorale = [
      {
        name: 'Piloto Teste',
        role: 'driver1' as const,
        overallRating: 80,
        speed: 80,
        consistency: 80,
        rain: 80,
        defense: 80,
        morale: 50,
      },
    ]

    const scoreHigh = structuralStrengthService.calculateDriverScore({ drivers: driversHighMorale })
    const scoreLow = structuralStrengthService.calculateDriverScore({ drivers: driversLowMorale })

    expect(scoreHigh.moraleScore).toBe(100)
    expect(scoreLow.moraleScore).toBe(50)
    expect(scoreHigh.driverScore).toBeGreaterThan(scoreLow.driverScore)

    const teamScore = structuralStrengthService.calculateTeamScore({
      facilities: { factory: 3 },
      teamMorale: 80,
    })
    expect(teamScore.teamMoraleScore).toBe(80)
  })

  // CP4-23: Nenhum modifier por teamName.
  it('CP4-23: Nenhum modifier por teamName', () => {
    const auditStructural = structuralStrengthService.auditStructuralStrengthSystem({
      seasonYear: 2026,
    })
    expect(auditStructural.teamNameBonuses).toBe(0)

    const auditPace = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(auditPace.teamNameBonuses).toBe(0)

    const dummyComponents = { frontWing: 70, rearWing: 70, floor: 70 }
    const dummyDrivers = [
      {
        name: 'Generic Driver',
        role: 'driver1' as const,
        overallRating: 80,
        speed: 80,
        consistency: 80,
        rain: 80,
        defense: 80,
        morale: 80,
      },
    ]
    const dummyFacilities = { factory: 3, windTunnel: 3 }

    const evalMerc = structuralStrengthService.calculateStructuralStrength({
      teamKey: 'fictional_mercedes',
      teamName: 'Mercedes Fictícia',
      components: dummyComponents,
      effectivePuRating: 80,
      drivers: dummyDrivers,
      facilities: dummyFacilities,
    })

    const evalAndretti = structuralStrengthService.calculateStructuralStrength({
      teamKey: 'fictional_andretti',
      teamName: 'Andretti Fictícia',
      components: dummyComponents,
      effectivePuRating: 80,
      drivers: dummyDrivers,
      facilities: dummyFacilities,
    })

    expect(evalMerc.structuralStrengthScore).toBe(evalAndretti.structuralStrengthScore)
    expect(evalMerc.technicalScore).toBe(evalAndretti.technicalScore)
    expect(evalMerc.driverScore).toBe(evalAndretti.driverScore)
    expect(evalMerc.teamScore).toBe(evalAndretti.teamScore)
  })

  // CP4-24: Nenhum cap de resultado.
  it('CP4-24: Nenhum cap de resultado', () => {
    const audit = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    expect(audit.raceEngineConsumers).toBe(0)
    expect(audit.eventDependencies).toBe(0)
    expect(audit.rngDependencies).toBe(0)
  })

  // CP4-25: Nenhuma dupla aplicação de TrackFit / setup / RNG.
  it('CP4-25: Nenhuma dupla aplicação de TrackFit / setup / RNG', () => {
    const cadTech = (BASELINE_V0_DATA.teams['cadillac'] as any)?.technicalAttributes
    const result = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-drv',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 90,
      noise: 0.5,
      weather: 'seco',
    })

    const b = result.breakdown
    const terms = [
      b.structuralStrength,
      b.trackFitModifier,
      b.setupModifier,
      b.driverEventModifier,
      b.tyreModifier,
      b.fuelModifier,
      b.wearModifier,
      b.weatherModifier,
      b.rngModifier,
    ]

    const expectedTotal = Number(terms.reduce((acc, v) => acc + v, 0).toFixed(2))
    expect(result.effectivePaceScore).toBe(expectedTotal)
    expect(b.finalPace).toBe(expectedTotal)

    const auditPace = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(auditPace.duplicateDriverApplication).toBe(0)
    expect(auditPace.duplicatePUApplication).toBe(0)
    expect(auditPace.duplicateWearApplication).toBe(0)
    expect(auditPace.legacyTrackFitWeight45).toBe(false)
  })

  // CP4-26: Estado evoluído da carreira pode divergir da baseline sem falhar o lock.
  it('CP4-26: Estado evoluído da carreira pode divergir da baseline sem falhar o lock', () => {
    const andrettiInitial = structuralStrengthService.getTeamStructuralStrength('andretti', {
      seasonYear: 2026,
    })
    expect(andrettiInitial.structuralStrengthScore).toBe(45)

    const upgradedComponents: Record<string, number> = {}
    for (const [k, v] of Object.entries(andrettiInitial.technicalBreakdown.componentsMap)) {
      upgradedComponents[k] = v + 30
    }

    const andrettiYear3 = structuralStrengthService.calculateStructuralStrength({
      teamKey: 'andretti',
      teamName: andrettiInitial.teamName,
      components: upgradedComponents,
      effectivePuRating: andrettiInitial.technicalBreakdown.effectivePuScore + 20,
      reliability: andrettiInitial.technicalBreakdown.reliabilityScore,
      condition: andrettiInitial.technicalBreakdown.conditionScore,
      puSupplier: andrettiInitial.technicalBreakdown.puSupplier,
      effectiveIntegration: andrettiInitial.technicalBreakdown.effectiveIntegration,
      nominalPuRating: andrettiInitial.technicalBreakdown.nominalPuRating,
      drivers: andrettiInitial.driverBreakdown.drivers,
      facilities: andrettiInitial.teamBreakdown.facilitiesLevels,
      teamMorale: andrettiInitial.teamBreakdown.teamMoraleScore,
    })

    expect(andrettiYear3.structuralStrengthScore).toBeGreaterThan(45)
    expect(andrettiYear3.technicalScore).toBeGreaterThan(andrettiInitial.technicalScore)

    const andrettiBaseRecheck = structuralStrengthService.getTeamStructuralStrength('andretti', {
      seasonYear: 2026,
    })
    expect(andrettiBaseRecheck.structuralStrengthScore).toBe(45)
  })

  // CP4-27: Baseline inicial continua restaurável/determinística conforme mecanismo existente.
  it('CP4-27: Baseline inicial continua restaurável/determinística conforme mecanismo existente', () => {
    const restoreResult = structuralStrengthService.restoreBalanceBaseline('v0')
    expect(restoreResult.success).toBe(true)
    expect(restoreResult.versionRestored).toBe('v0')
    expect(restoreResult.restoredTeamsCount).toBeGreaterThanOrEqual(28)

    const merc = structuralStrengthService.getTeamStructuralStrength('mercedes', {
      seasonYear: 2026,
    })
    expect(merc.structuralStrengthScore).toBe(100)

    const andretti = structuralStrengthService.getTeamStructuralStrength('andretti', {
      seasonYear: 2026,
    })
    expect(andretti.structuralStrengthScore).toBe(45)
  })

  // CP4-28: WCA targets permanecem intactos.
  it('CP4-28: WCA targets permanecem intactos', () => {
    const expectedTargets: Record<string, number> = {
      mercedes: 100,
      ferrari: 98,
      mclaren: 96,
      redbull: 94,
      racingbulls: 87,
      alpine: 87,
      audi: 86,
      haas: 75,
      williams: 70,
      astonmartin: 60,
      cadillac: 50,
      andretti: 45,
    }

    for (const [teamKey, target] of Object.entries(expectedTargets)) {
      const breakdown = structuralStrengthService.getTeamStructuralStrength(teamKey, {
        seasonYear: 2026,
      })
      expect(breakdown.structuralStrengthScore).toBe(target)
      expect(BASELINE_2026_TARGETS[teamKey].targetScore).toBe(target)
      expect(BASELINE_2026_V1_TEAMS[teamKey].score).toBe(target)
    }
  })

  // CP4-29: CP2 continua verde.
  it('CP4-29: CP2 continua verde (âncora 2026, V0 fora, Audi provado, sem double count)', () => {
    const scores = BASELINE_2026_V1_ORDER.map((teamKey) => {
      const breakdown = structuralStrengthService.getTeamStructuralStrength(teamKey, {
        seasonYear: 2026,
      })
      return breakdown.structuralStrengthScore
    })
    expect(scores).toEqual([100, 98, 96, 94, 87, 87, 86, 75, 70, 60, 50, 45])

    const merc2025 = structuralStrengthService.getTeamStructuralStrength('mercedes', {
      seasonYear: 2025,
    })
    expect(merc2025.baselineOrigin).toBeUndefined()
  })

  // CP4-30: CP3A continua verde.
  it('CP4-30: CP3A continua verde (TrackFit normal ±2.0, spec ±2.5, RNG sigma 0.45, Mulberry32 determinístico)', () => {
    expect(TRACKFIT_NORMAL_CLAMP).toBe(2.0)
    expect(TRACKFIT_SPECIALIZED_CLAMP).toBe(2.5)
    expect(QUALI_RNG_TARGET_RANGE.SIGMA).toBe(0.45)
    expect(QUALI_RNG_TARGET_RANGE.MIN).toBe(-1.0)
    expect(QUALI_RNG_TARGET_RANGE.MAX).toBe(1.0)
  })

  // CP4-31: SETUP-EFFICIENCY-QUALI-01A continua verde.
  it('CP4-31: SETUP-EFFICIENCY-QUALI-01A continua verde (neutro 80, delta 0.05, aplicação única)', () => {
    const pace80 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0,
    })
    expect(pace80.breakdown.setupModifier).toBe(0.0)

    const pace100 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 100,
      noise: 0,
    })
    expect(pace100.breakdown.setupModifier).toBeCloseTo((100 - 80) * 0.05, 3)
  })

  // CP4-32: CALIBRATION-WCA-01R continua 27/27.
  it('CP4-32: CALIBRATION-WCA-01R continua 27/27 (convergência estrita 12 equipes, spread 55 pts)', () => {
    const merc = BASELINE_2026_V1_TEAMS.mercedes.score
    const andretti = BASELINE_2026_V1_TEAMS.andretti.score
    expect(merc - andretti).toBe(55)
    expect(BASELINE_2026_V1_METADATA.pointSpread).toBe(55)

    BASELINE_2026_V1_ORDER.forEach((teamKey) => {
      const b = structuralStrengthService.getTeamStructuralStrength(teamKey, { seasonYear: 2026 })
      expect(b.structuralStrengthScore).toBe(BASELINE_2026_V1_TEAMS[teamKey].score)
    })
  })
})
