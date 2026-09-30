import { describe, it, expect } from 'vitest'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { OFFICIAL_TEAMS_TECHNICAL_DATA } from '@/lib/car-technical-data'

describe('QUALI-TEAM-BREAKDOWN-AUDIT-01 Diagnostic Suite', () => {
  it('computes exact values for Silverstone audit and tests assertions', () => {
    const circuit = resolveCircuitProfile({ round: 11 }) // Silverstone
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
    const driverRows: any[] = []

    for (const key of teamKeys) {
      const structural = structuralStrengthService.getTeamStructuralStrength(key)
      const baseEntry = BASELINE_V0_DATA.teams[key]
      const techProfile = OFFICIAL_TEAMS_TECHNICAL_DATA[key]
      const techAttrs = techProfile?.attributes as any

      let rawTrackFit = 75
      let trackFitMod = 0
      if (techAttrs && circuit) {
        const tf = calculateTrackFit(techAttrs, circuit)
        rawTrackFit = tf.trackFitScore
        const norm = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: rawTrackFit })
        trackFitMod = norm.trackFitModifier
      }

      teamRows.push({
        key,
        teamName: structural.teamName,
        structuralScore: structural.structuralStrengthScore,
        technical: structural.technicalScore,
        driver: structural.driverScore,
        team: structural.teamScore,
        rawTrackFit,
        trackFitMod,
      })

      const drivers = baseEntry?.drivers || []
      for (const drv of drivers) {
        const qualiRes = canonicalPaceIntegrationService.computeQualifyingPace({
          teamKey: key,
          driverId: drv.name,
          circuitProfile: circuit,
          carTechnicalAttributes: techAttrs,
          driverAttributes: {
            speed: drv.speed,
            consistency: drv.consistency,
            rain: drv.rain,
            morale: drv.morale ?? 80,
          },
          tyreCompound: 'macio',
          tyreWearPct: 0,
          fuelKg: 12,
          setupEfficiency: 80,
          weather: 'seco',
          noise: 0,
        })

        driverRows.push({
          driverName: drv.name,
          teamKey: key,
          teamName: structural.teamName,
          speed: drv.speed,
          overall: drv.overallRating,
          morale: drv.morale ?? 80,
          breakdown: qualiRes.breakdown,
          effectivePaceScore: qualiRes.effectivePaceScore,
          lapTimeSec: qualiRes.lapTimeSec,
        })
      }
    }

    expect(teamRows.length).toBe(12)
    expect(driverRows.length).toBeGreaterThanOrEqual(24)

    // Log diagnostic summary for precise markdown generation
    console.log('AUDIT_TEAM_DATA_START')
    console.log(JSON.stringify(teamRows))
    console.log('AUDIT_TEAM_DATA_END')

    console.log('AUDIT_DRIVER_DATA_START')
    console.log(JSON.stringify(driverRows))
    console.log('AUDIT_DRIVER_DATA_END')
  })
})
