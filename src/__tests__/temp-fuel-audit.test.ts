import { describe, it } from 'vitest'
import * as raceEng from '../services/canonicalRaceEngineService'
import * as circuitProfiles from '../data/circuit-performance-profiles'

describe('temp audit inspect', () => {
  it('inspects exports', () => {
    console.log(
      'CIRCUIT_PERFORMANCE_PROFILES length:',
      circuitProfiles.CIRCUIT_PERFORMANCE_PROFILES.length,
    )
    console.log(
      'Sample profile keys:',
      Object.keys(circuitProfiles.CIRCUIT_PERFORMANCE_PROFILES[0]),
    )
    console.log(
      'canonicalRaceEngineService keys:',
      Object.getOwnPropertyNames(Object.getPrototypeOf(raceEng.canonicalRaceEngineService)),
    )
  })
})
