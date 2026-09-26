import { describe, it, expect } from 'vitest'
import { canonicalRaceDiagnosticHarnessService } from '@/services/canonicalRaceDiagnosticHarnessService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'

describe('Canonical Race Diagnostic Harness — Fast Smoke Tests', () => {
  it('executes a single race with deterministic Mulberry32 producing 24 unique drivers and valid positions', () => {
    const circuit = CIRCUIT_PERFORMANCE_PROFILES[0]
    const race = canonicalRaceDiagnosticHarnessService.runSingleRace({
      sampleId: 1,
      seed: 20263000,
      circuit,
      weatherCategory: 'seca',
      totalLaps: 15,
    })

    expect(race.driverResults).toHaveLength(24)
    const uniqueIds = new Set(race.driverResults.map((d) => d.driverId))
    expect(uniqueIds.size).toBe(24)

    const positions = race.driverResults.map((d) => d.finalPosition).sort((a, b) => a - b)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
    expect(race.winnerDriverId).toBeDefined()
  })

  it('verifies AI pit stop triggers and two-compound rule in dry races', () => {
    const circuit = CIRCUIT_PERFORMANCE_PROFILES[1]
    const race = canonicalRaceDiagnosticHarnessService.runSingleRace({
      sampleId: 2,
      seed: 20263037,
      circuit,
      weatherCategory: 'seca',
      totalLaps: 25,
    })

    // Active finished drivers should have done at least 1 pit stop and used at least 2 compounds
    const finishedDrivers = race.driverResults.filter((d) => d.raceStatus === 'finished')
    expect(finishedDrivers.length).toBeGreaterThan(15)

    finishedDrivers.forEach((d) => {
      expect(d.pitStops).toBeGreaterThanOrEqual(1)
      expect(d.distinctCompoundsCount).toBeGreaterThanOrEqual(2)
      expect(d.conformsTwoCompoundRule).toBe(true)
    })
    expect(race.ruleViolationsTwoCompounds).toHaveLength(0)
    expect(race.zeroPitsViolationsDry).toHaveLength(0)
  })

  it('calculates canonical weather delta properly in calculateCanonicalLapPace', () => {
    const driverState = {
      careerId: 'test',
      season: 2026,
      raceId: 'test_r1',
      driverId: 'verstappen',
      teamId: 'redbull',
      gridPosition: 1,
      currentPosition: 1,
      lap: 5,
      raceTime: 400,
      gap: 'LÍDER',
      tyreCompound: 'macio' as const,
      tyreAge: 5,
      fuel: 80,
      carCondition: 100,
      raceStatus: 'racing' as const,
      pitStops: 0,
      driverName: 'Max Verstappen',
      teamName: 'Red Bull Racing',
      teamColor: '#1E41FF',
      isPlayer: false,
    }

    const rng = () => 0.5
    const paceDry = canonicalRaceEngineService.calculateCanonicalLapPace({
      driver: driverState,
      lap: 5,
      weather: 'seco',
      round: 1,
      circuitName: 'Bahrein',
      rng,
    })

    const paceRain = canonicalRaceEngineService.calculateCanonicalLapPace({
      driver: driverState,
      lap: 5,
      weather: 'chuva_fraca',
      round: 1,
      circuitName: 'Bahrein',
      rng,
    })

    // Em chuva fraca com pneu macio, há penalidade meteorológica (+4.2s conforme f1-pace-model)
    expect(paceRain.lapTimeSec).toBeGreaterThan(paceDry.lapTimeSec + 3.0)
  })
})
