import { describe, it, expect } from 'vitest'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { OFFICIAL_TEAMS_TECHNICAL_DATA } from '@/lib/car-technical-data'

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

    for (const key of teamKeys) {
      const structural = structuralStrengthService.getTeamStructuralStrength(key)
      expect(structural.structuralStrengthScore).toBeGreaterThan(0)
    }
  })
})
