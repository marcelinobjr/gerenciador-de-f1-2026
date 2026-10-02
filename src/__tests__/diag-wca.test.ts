import { describe, it } from 'vitest'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { BASELINE_2026_V1_TEAMS, BASELINE_2026_V1_ORDER } from '@/data/baseline-2026-v1'
import {
  resolveCircuitProfile,
  CIRCUIT_PERFORMANCE_PROFILES,
} from '@/data/circuit-performance-profiles'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'

describe('WCA Diagnostic Runner', () => {
  it('computes before audit and pace translation', () => {
    console.log('=== BEFORE AUDIT TABLE (12 TEAMS) ===')
    const beforeData = BASELINE_2026_V1_ORDER.map((teamKey) => {
      const breakdown = structuralStrengthService.getTeamStructuralStrength(teamKey, {
        seasonYear: 2026,
      })
      const target = BASELINE_2026_V1_TEAMS[teamKey].score
      const delta = Number((breakdown.structuralStrengthScore - target).toFixed(2))

      // Neutral pace computation
      const neutralPace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-drv`,
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: { speed: 85, consistency: 85, morale: 80 },
        setupEfficiency: 80,
        weather: 'seco',
        tyreCompound: 'macio',
        fuelKg: 12,
        noise: 0,
      })

      return {
        teamKey,
        teamName: breakdown.teamName,
        currentStructural: breakdown.structuralStrengthScore,
        target,
        delta,
        technicalScore: breakdown.technicalScore,
        driverScore: breakdown.driverScore,
        teamScore: breakdown.teamScore,
        partsScore: breakdown.technicalBreakdown.partsScore,
        puScore: breakdown.technicalBreakdown.effectivePuScore,
        reliability: breakdown.technicalBreakdown.reliabilityScore,
        condition: breakdown.technicalBreakdown.conditionScore,
        infrastructure: breakdown.teamBreakdown.infrastructureScore,
        teamMorale: breakdown.teamBreakdown.teamMoraleScore,
        neutralPaceScore: neutralPace.effectivePaceScore,
        neutralLapTime: neutralPace.lapTimeSec,
      }
    })

    console.table(beforeData)

    console.log('=== TRACK MATRIX (8 CIRCUIT PROFILES) ===')
    // Select 8 distinct profiles
    // Slow (Monaco, round 8), Medium (Australia, round 1), Fast (Silverstone, round 11),
    // Power (Monza, round 16), Downforce (Barcelona, round 9),
    // Traction (Bahrain, round 4), Braking (Canada, round 7), Mixed (Spa, round 14 or Suzuka, round 3)
    const circuitRounds = [
      { name: 'Slow (Monaco)', round: 8 },
      { name: 'Medium (Australia)', round: 1 },
      { name: 'Fast (Silverstone)', round: 11 },
      { name: 'Power (Monza)', round: 16 },
      { name: 'Downforce (Barcelona)', round: 9 },
      { name: 'Traction (Bahrain)', round: 4 },
      { name: 'Braking (Canada)', round: 7 },
      { name: 'Mixed (Suzuka)', round: 3 },
    ]

    const trackMatrixResults = circuitRounds.map(({ name, round }) => {
      const circuit = resolveCircuitProfile({ round })
      const teamPaces = BASELINE_2026_V1_ORDER.map((teamKey) => {
        const baseEntry = BASELINE_V0_DATA.teams[teamKey] as any
        const techAttrs = baseEntry?.technicalAttributes ?? baseEntry?.carAttributes
        const pace = canonicalPaceIntegrationService.computeQualifyingPace({
          teamKey,
          driverId: `${teamKey}-drv`,
          circuitProfile: circuit,
          carTechnicalAttributes: techAttrs,
          driverAttributes: { speed: 85, consistency: 85, morale: 80 },
          setupEfficiency: 80,
          weather: 'seco',
          tyreCompound: 'macio',
          fuelKg: 12,
          noise: 0,
        })
        return {
          teamKey,
          score: pace.effectivePaceScore,
          tfMod: pace.breakdown.trackFitModifier,
          lapTimeSec: pace.lapTimeSec,
        }
      })
      teamPaces.sort((a, b) => b.score - a.score)
      const rankMap: Record<string, number> = {}
      teamPaces.forEach((tp, idx) => {
        rankMap[tp.teamKey] = idx + 1
      })
      return {
        circuit: name,
        rankings: rankMap,
        paces: teamPaces,
      }
    })

    console.log(JSON.stringify(trackMatrixResults, null, 2))

    console.log('=== REAL DRIVERS EFFECT ===')
    const realDriverResults = BASELINE_2026_V1_ORDER.map((teamKey) => {
      const baseEntry = BASELINE_V0_DATA.teams[teamKey] as any
      const drivers = baseEntry?.drivers ?? []
      const d1 = drivers[0]
      const d2 = drivers[1]
      const techAttrs = baseEntry?.technicalAttributes ?? baseEntry?.carAttributes
      const paceNeutralDrv = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: `${teamKey}-neutral`,
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: { speed: 85, consistency: 85, morale: 80 },
        setupEfficiency: 80,
        noise: 0,
      })
      const paceD1 = d1
        ? canonicalPaceIntegrationService.computeQualifyingPace({
            teamKey,
            driverId: d1.id ?? d1.name,
            circuitProfile: null,
            carTechnicalAttributes: null,
            driverAttributes: { speed: d1.overallRating, morale: d1.morale ?? 80 },
            setupEfficiency: 80,
            noise: 0,
          })
        : null
      const paceD2 = d2
        ? canonicalPaceIntegrationService.computeQualifyingPace({
            teamKey,
            driverId: d2.id ?? d2.name,
            circuitProfile: null,
            carTechnicalAttributes: null,
            driverAttributes: { speed: d2.overallRating, morale: d2.morale ?? 80 },
            setupEfficiency: 80,
            noise: 0,
          })
        : null

      return {
        teamKey,
        structural: paceNeutralDrv.breakdown.structuralStrength,
        d1: d1
          ? { name: d1.name, rating: d1.overallRating, pace: paceD1?.effectivePaceScore }
          : null,
        d2: d2
          ? { name: d2.name, rating: d2.overallRating, pace: paceD2?.effectivePaceScore }
          : null,
      }
    })
    console.log(JSON.stringify(realDriverResults, null, 2))
  })
})
