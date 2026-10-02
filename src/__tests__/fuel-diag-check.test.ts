import { describe, it, expect } from 'vitest'
import { CIRCUIT_PERFORMANCE_PROFILES } from '../data/circuit-performance-profiles'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'

describe('Fuel Diagnostic Quick Test', () => {
  it('checks profiles and race engine methods', () => {
    expect(CIRCUIT_PERFORMANCE_PROFILES.length).toBe(24)
    const p1 = CIRCUIT_PERFORMANCE_PROFILES[0]
    expect(p1.id).toBe('circuit_01')
    expect(typeof canonicalRaceEngineService.advanceOneLap).toBe('function')
  })
})
