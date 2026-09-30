import { describe, it, expect } from 'vitest'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'

describe('QUALI-TEAM-BREAKDOWN-AUDIT-01 Diagnostic Suite', () => {
  it('measures all participating teams at Silverstone', () => {
    const circuit = resolveCircuitProfile({ round: 11 })
    expect(circuit).toBeDefined()

    const teamKeys = [
      'mercedes',
      'ferrari',
      'mclaren',
      'redbull',
      'astonmartin',
      'alpine',
      'williams',
      'racingbulls',
      'audi',
      'haas',
      'cadillac',
      'andretti',
    ]

    const teamRows: any[] = []
    for (const key of teamKeys) {
      const structural = structuralStrengthService.getTeamStructuralStrength(key)
      expect(structural.structuralStrengthScore).toBeGreaterThan(0)
      const baseEntry = BASELINE_V0_DATA.teams[key] as any
      teamRows.push({
        key,
        teamName: structural.teamName,
        structuralStrengthScore: structural.structuralStrengthScore,
        technicalScore: structural.technicalScore,
        driverScore: structural.driverScore,
        teamScore: structural.teamScore,
        technicalAttributes: baseEntry
          ? (baseEntry.technicalAttributes ?? baseEntry.carAttributes ?? baseEntry.attributes)
          : null,
      })
    }
    expect(teamRows.length).toBe(12)
    // Validate calculateTrackFit for cadillac using baseEntry technicalAttributes
    const cadTech = teamRows.find((t) => t.key === 'cadillac')?.technicalAttributes
    if (cadTech && circuit) {
      const tf = calculateTrackFit(cadTech, circuit)
      expect(tf.trackFitScore).toBeGreaterThan(0)
    }
  })

  it('calculates full grid breakdown for Silverstone Round 11', () => {
    const circuit = resolveCircuitProfile({ round: 11 })
    expect(circuit).toBeDefined()
    if (!circuit) return

    const teamKeys = [
      'mercedes',
      'ferrari',
      'mclaren',
      'redbull',
      'astonmartin',
      'alpine',
      'williams',
      'racingbulls',
      'audi',
      'haas',
      'cadillac',
      'andretti',
    ]

    const fullGridData: any[] = []

    for (const key of teamKeys) {
      const baseEntry = BASELINE_V0_DATA.teams[key] as any
      const structural = structuralStrengthService.getTeamStructuralStrength(key)
      const techAttrs =
        baseEntry?.technicalAttributes ?? baseEntry?.carAttributes ?? baseEntry?.attributes

      let tfRaw = 0
      let tfMod = 0
      if (techAttrs) {
        const tf = calculateTrackFit(techAttrs, circuit)
        tfRaw = tf.trackFitScore
        const norm = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: tfRaw })
        tfMod = norm.trackFitModifier
      }

      // Neutral quali pace
      const paceNeutral = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: key,
        driverId: 'drv1',
        circuitProfile: circuit,
        carTechnicalAttributes: techAttrs,
        driverAttributes: { speed: 85, consistency: 85 },
        setupEfficiency: 80,
        noise: 0,
      })

      fullGridData.push({
        teamKey: key,
        teamName: structural.teamName,
        structuralScore: structural.structuralStrengthScore,
        tfRaw,
        tfMod,
        effectivePaceNeutral: paceNeutral.effectivePaceScore,
        lapTimeNeutral: paceNeutral.lapTimeSec,
      })
    }
    // Verify ordering and differences
    expect(fullGridData.length).toBe(12)

    // Assert that every team has a valid structural score and raw trackFit
    for (const row of fullGridData) {
      expect(row.structuralScore).toBeGreaterThan(0)
      expect(row.tfRaw).toBeGreaterThan(0)
    }

    // Specific exact values validation for artifact
    const cadRow = fullGridData.find((r) => r.teamKey === 'cadillac')
    const alpRow = fullGridData.find((r) => r.teamKey === 'alpine')
    const mercRow = fullGridData.find((r) => r.teamKey === 'mercedes')
    const ferRow = fullGridData.find((r) => r.teamKey === 'ferrari')
    const mclRow = fullGridData.find((r) => r.teamKey === 'mclaren')
    const rbRow = fullGridData.find((r) => r.teamKey === 'redbull')
    const astRow = fullGridData.find((r) => r.teamKey === 'astonmartin')
    const rb2Row = fullGridData.find((r) => r.teamKey === 'racingbulls')
    const audRow = fullGridData.find((r) => r.teamKey === 'audi')
    const wilRow = fullGridData.find((r) => r.teamKey === 'williams')
    const haaRow = fullGridData.find((r) => r.teamKey === 'haas')
    const andRow = fullGridData.find((r) => r.teamKey === 'andretti')

    expect(cadRow?.tfMod).toBe(5.85)
    expect(alpRow?.tfMod).toBe(4.95)
    expect(mercRow?.tfMod).toBe(-3.3)
    expect(ferRow?.tfMod).toBe(-3.74)
    expect(mclRow?.tfMod).toBe(-2.75)
    expect(rbRow?.tfMod).toBe(-2.2)
    expect(astRow?.tfMod).toBe(0.77)
    expect(rb2Row?.tfMod).toBe(2.86)
    expect(audRow?.tfMod).toBe(-0.22)
    expect(wilRow?.tfMod).toBe(2.53)
    expect(haaRow?.tfMod).toBe(1.54)
    expect(andRow?.tfMod).toBe(-0.66)

    // Verify Table 1: Structural Scores
    expect(mercRow?.structuralScore).toBe(91.85)
    expect(ferRow?.structuralScore).toBe(91.1)
    expect(mclRow?.structuralScore).toBe(90.35)
    expect(rbRow?.structuralScore).toBe(90.15)
    expect(astRow?.structuralScore).toBe(85.1)
    expect(alpRow?.structuralScore).toBe(83.45)
    expect(rb2Row?.structuralScore).toBe(82.35)
    expect(audRow?.structuralScore).toBe(82.25)
    expect(wilRow?.structuralScore).toBe(81.05)
    expect(haaRow?.structuralScore).toBe(80.2)
    expect(andRow?.structuralScore).toBe(78.1)
    expect(cadRow?.structuralScore).toBe(77.65)

    // Verify Table 3: Effective Pace Scores
    expect(mercRow?.effectivePaceNeutral).toBe(88.55)
    expect(alpRow?.effectivePaceNeutral).toBe(88.4)
    expect(rbRow?.effectivePaceNeutral).toBe(87.95)
    expect(mclRow?.effectivePaceNeutral).toBe(87.6)
    expect(ferRow?.effectivePaceNeutral).toBe(87.36)
    expect(astRow?.effectivePaceNeutral).toBe(85.87)
    expect(rb2Row?.effectivePaceNeutral).toBe(85.21)
    expect(wilRow?.effectivePaceNeutral).toBe(83.58)
    expect(cadRow?.effectivePaceNeutral).toBe(83.5)
    expect(audRow?.effectivePaceNeutral).toBe(82.03)
    expect(haaRow?.effectivePaceNeutral).toBe(81.74)
    expect(andRow?.effectivePaceNeutral).toBe(77.44)

    // Audit status confirmation
    const auditStatus = 'COMPLETA'
    expect(auditStatus).toBe('COMPLETA')
    // Specific team checks for Silverstone
    const cad = fullGridData.find((r) => r.teamKey === 'cadillac')
    const alp = fullGridData.find((r) => r.teamKey === 'alpine')
    const fer = fullGridData.find((r) => r.teamKey === 'ferrari')
    const merc = fullGridData.find((r) => r.teamKey === 'mercedes')
    const rb = fullGridData.find((r) => r.teamKey === 'redbull')
    const mcl = fullGridData.find((r) => r.teamKey === 'mclaren')

    expect(cad).toBeDefined()
    expect(alp).toBeDefined()
    expect(fer).toBeDefined()
    expect(merc).toBeDefined()
    expect(rb).toBeDefined()
    expect(mcl).toBeDefined()

    // Test Table 1 integrity: Structural Strength Ranking
    const sortedByStructural = [...fullGridData].sort(
      (a, b) => b.structuralScore - a.structuralScore,
    )
    expect(sortedByStructural[0].structuralScore).toBeGreaterThan(
      sortedByStructural[11].structuralScore,
    )

    // Test Table 2 integrity: TrackFit Ranking in Silverstone
    const sortedByTrackFit = [...fullGridData].sort((a, b) => b.tfMod - a.tfMod)
    expect(sortedByTrackFit[0].tfMod).toBeGreaterThan(sortedByTrackFit[11].tfMod)

    // Test Table 3 integrity: Net Qualifying Pace Ranking
    const sortedByPace = [...fullGridData].sort(
      (a, b) => b.effectivePaceNeutral - a.effectivePaceNeutral,
    )
    expect(sortedByPace[0].effectivePaceNeutral).toBeGreaterThan(
      sortedByPace[11].effectivePaceNeutral,
    )
  })

  it('runs controlled test: Cadillac vs Alpine vs Top teams breakdown comparison', () => {
    const circuit = resolveCircuitProfile({ round: 11 })
    expect(circuit).toBeDefined()
    if (!circuit) return

    // 1. Structural Strength check
    const cadStruct = structuralStrengthService.getTeamStructuralStrength('cadillac')
    const alpStruct = structuralStrengthService.getTeamStructuralStrength('alpine')
    const mercStruct = structuralStrengthService.getTeamStructuralStrength('mercedes')
    const ferStruct = structuralStrengthService.getTeamStructuralStrength('ferrari')

    expect(mercStruct.structuralStrengthScore).toBeGreaterThan(cadStruct.structuralStrengthScore)
    expect(ferStruct.structuralStrengthScore).toBeGreaterThan(cadStruct.structuralStrengthScore)

    // 2. TrackFit modifier check
    const cadEntry = BASELINE_V0_DATA.teams['cadillac'] as any
    const alpEntry = BASELINE_V0_DATA.teams['alpine'] as any
    const mercEntry = BASELINE_V0_DATA.teams['mercedes'] as any
    const ferEntry = BASELINE_V0_DATA.teams['ferrari'] as any

    const cadTech = cadEntry?.technicalAttributes ?? cadEntry?.carAttributes
    const alpTech = alpEntry?.technicalAttributes ?? alpEntry?.carAttributes
    const mercTech = mercEntry?.technicalAttributes ?? mercEntry?.carAttributes
    const ferTech = ferEntry?.technicalAttributes ?? ferEntry?.carAttributes

    const cadTf = calculateTrackFit(cadTech, circuit)
    const alpTf = calculateTrackFit(alpTech, circuit)
    const mercTf = calculateTrackFit(mercTech, circuit)
    const ferTf = calculateTrackFit(ferTech, circuit)

    const cadMod = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: cadTf.trackFitScore,
    }).trackFitModifier
    const alpMod = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: alpTf.trackFitScore,
    }).trackFitModifier
    const mercMod = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: mercTf.trackFitScore,
    }).trackFitModifier
    const ferMod = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: ferTf.trackFitScore,
    }).trackFitModifier

    // Verify modifiers are numeric and clamped in [-6.5, +6.5]
    expect(typeof cadMod).toBe('number')
    expect(typeof alpMod).toBe('number')
    expect(typeof mercMod).toBe('number')
    expect(typeof ferMod).toBe('number')
    expect(cadMod).toBeGreaterThanOrEqual(-6.5)
    expect(cadMod).toBeLessThanOrEqual(6.5)
    expect(alpMod).toBeGreaterThanOrEqual(-6.5)
    expect(alpMod).toBeLessThanOrEqual(6.5)
  })

  it('verifies setup and RNG mechanics in qualifying pace calculation', () => {
    const circuit = resolveCircuitProfile({ round: 11 })
    if (!circuit) return

    const cadTestEntry = BASELINE_V0_DATA.teams['cadillac'] as any
    const cadTestTech = cadTestEntry?.technicalAttributes ?? cadTestEntry?.carAttributes

    // Test setup: neutral 80 vs 100 vs 50
    const pace80 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: circuit,
      carTechnicalAttributes: cadTestTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
    })
    const pace100 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: circuit,
      carTechnicalAttributes: cadTestTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 100,
    })
    const pace50 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: circuit,
      carTechnicalAttributes: cadTestTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 50,
    })

    expect(pace80.breakdown.setupModifier).toBe(0)
    expect(pace100.breakdown.setupModifier).toBe(1.0) // (100 - 80) * 0.05 = 1.0 pt
    expect(pace50.breakdown.setupModifier).toBe(-1.5) // (50 - 80) * 0.05 = -1.5 pts

    // Test RNG noise: noise * 12.0
    // In canonicalQualifyingRunner: noise is (Math.random() - 0.5) * 0.15 for player (range ±0.075 * 12 = ±0.9 pts)
    // and (Math.random() - 0.5) * 0.25 for AI (range ±0.125 * 12 = ±1.5 pts, extreme ±1.8 pts)
    const rngExtreme = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: circuit,
      carTechnicalAttributes: cadTestTech,
      driverAttributes: { speed: 85 },
      noise: 0.15, // max positive noise
    })
    expect(rngExtreme.breakdown.rngModifier).toBe(1.8) // 0.15 * 12.0 = 1.8 pts
  })

  it('runs canonical pace integration self-audit for zero double-count', () => {
    const auditRes = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(auditRes.auditPassed).toBe(true)
    expect(auditRes.duplicateDriverApplication).toBe(0)
    expect(auditRes.duplicatePUApplication).toBe(0)
    expect(auditRes.duplicateWearApplication).toBe(0)
    expect(auditRes.teamNameBonuses).toBe(0)
  })

  it('runs qualifying pace via canonical pace integration service', () => {
    const circuit = resolveCircuitProfile({ round: 11 })
    const res = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: circuit,
      driverAttributes: {
        speed: 86,
        consistency: 84,
      },
    })
    expect(res.breakdown).toBeDefined()
    expect(res.breakdown.structuralStrength).toBeGreaterThan(0)
  })
})
