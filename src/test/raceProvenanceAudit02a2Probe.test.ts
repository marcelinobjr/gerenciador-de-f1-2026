import { describe, it, expect } from 'vitest'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { advanceCanonicalRaceLap } from '@/services/canonicalRaceRunner'
import raceRegrasParametros from '@/assets/01raceregraseparametros-3c0c5.json'

describe('RACE-PROVENANCE-AUDIT-02A2 Formal Test Suite', () => {
  it('C1..C8: 24/24 GPs circuit resolution and raceLaps provenance', () => {
    // 1. Verify 24 rounds exist
    expect(F1_2026_CALENDAR).toHaveLength(24)

    // Expected laps per GP according to official FIA regulations and source spreadsheet
    const canonicalExpectedLaps: Record<number, { name: string; laps: number }> = {
      1: { name: 'Grande Prêmio da Austrália', laps: 58 },
      2: { name: 'Grande Prêmio da China', laps: 56 },
      3: { name: 'Grande Prêmio do Japão', laps: 53 },
      4: { name: 'Grande Prêmio do Bahrein', laps: 57 },
      5: { name: 'Grande Prêmio da Arábia Saudita', laps: 50 },
      6: { name: 'Grande Prêmio de Miami', laps: 57 },
      7: { name: 'Grande Prêmio do Canadá', laps: 70 },
      8: { name: 'Grande Prêmio de Mônaco', laps: 78 },
      9: { name: 'Grande Prêmio da Espanha (Barcelona)', laps: 66 },
      10: { name: 'Grande Prêmio da Áustria', laps: 71 },
      11: { name: 'Grande Prêmio da Grã-Bretanha', laps: 52 },
      12: { name: 'Grande Prêmio da Bélgica', laps: 44 },
      13: { name: 'Grande Prêmio da Hungria', laps: 70 },
      14: { name: 'Grande Prêmio dos Países Baixos', laps: 72 },
      15: { name: 'Grande Prêmio da Itália', laps: 53 },
      16: { name: 'Grande Prêmio de Madri', laps: 66 },
      17: { name: 'Grande Prêmio do Azerbaijão', laps: 51 },
      18: { name: 'Grande Prêmio de Singapura', laps: 62 },
      19: { name: 'Grande Prêmio dos Estados Unidos', laps: 56 },
      20: { name: 'Grande Prêmio do México', laps: 71 },
      21: { name: 'Grande Prêmio de São Paulo', laps: 71 },
      22: { name: 'Grande Prêmio de Las Vegas', laps: 50 },
      23: { name: 'Grande Prêmio do Catar', laps: 57 },
      24: { name: 'Grande Prêmio de Abu Dhabi', laps: 58 },
    }

    let matchCount = 0
    let divergedCount = 0

    F1_2026_CALENDAR.forEach((gp) => {
      const expected = canonicalExpectedLaps[gp.round]
      expect(expected).toBeDefined()
      expect(gp.name).toBe(expected.name)
      if (gp.laps === expected.laps) {
        matchCount++
      } else {
        divergedCount++
      }
    })

    expect(matchCount).toBe(24)
    expect(divergedCount).toBe(0)
  })

  it('D1..D10: Deterministic Fuel Exhaustion Fixture (raceLaps=10, initialFuel=3.0kg)', () => {
    // Car starts with 3.0 kg of fuel.
    // Lap consumption rate in 'normal' mode is 1.75 kg/lap.
    // Lap 1: fuel consumed: 1.75 kg -> fuelRemaining: 1.25 kg. Status: RUNNING.
    // Lap 2: fuel consumed: 1.25 kg (requested 1.75) -> fuelRemaining clamped to 0.0 kg. Status: RUNNING (no DNF).
    // Lap 3: fuel starts at 0.0 kg, burn clamped to 0.0 kg -> car continues running and records lap!
    const mockDriver = {
      driverId: 'drv_fuel_audit',
      driverName: 'Fuel Audit Driver',
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      teamColor: '#FF2A00',
      position: 1,
      accumulatedTimeSec: 0,
      dnf: false,
      fuelRemaining: 3.0,
      tireCompound: 'medio' as const,
      tireWear: 5,
      lapsOnCurrentTire: 1,
      isPlayer: true,
      score: 85,
      morale: 85,
      physicalCondition: 85,
      pitLap: 99,
      pitStopsDone: 0,
      points: 0,
      fastestLap: false,
      usedOvertake: false,
    }

    const baseParams = {
      totalLaps: 10,
      weather: 'seco' as const,
      round: 1,
      gpName: 'Grande Prêmio da Austrália',
      circuitName: 'Circuito de Albert Park, Melbourne',
      tireAbrasiveness: 5,
      team: { id: 'team_audi', name: 'Audi F1 Team', strength: 75 } as any,
      playerCarTactics: { drv_fuel_audit: 'normal' as const },
      playerPaceOrders: { drv_fuel_audit: 'normal' as const },
      mechanicalIssues: [],
      redFlagState: {
        active: false,
        ticksFrozen: 0,
        usedThisRace: false,
        safetyCarLapsRemaining: 0,
      },
    }

    // Lap 1 execution
    const lap1 = advanceCanonicalRaceLap({
      ...baseParams,
      currentLap: 0,
      grid: [{ ...mockDriver }],
      lapHistory: {},
    })
    const car1 = lap1.nextGrid[0]
    expect(car1.lapsCompleted).toBe(1)
    expect(car1.fuelRemaining).toBeCloseTo(1.25, 2)
    expect(car1.dnf).toBe(false)

    // Lap 2 execution (fuel hits 0)
    const lap2 = advanceCanonicalRaceLap({
      ...baseParams,
      currentLap: 1,
      grid: lap1.nextGrid,
      lapHistory: lap1.nextLapHistory,
    })
    const car2 = lap2.nextGrid[0]
    expect(car2.lapsCompleted).toBe(2)
    expect(car2.fuelRemaining).toBe(0)
    expect(car2.dnf).toBe(false)

    // Lap 3 execution (car running with fuelRemaining === 0)
    const lap3 = advanceCanonicalRaceLap({
      ...baseParams,
      currentLap: 2,
      grid: lap2.nextGrid,
      lapHistory: lap2.nextLapHistory,
    })
    const car3 = lap3.nextGrid[0]
    expect(car3.lapsCompleted).toBe(3)
    expect(car3.fuelRemaining).toBe(0)
    expect(car3.dnf).toBe(false) // GAP DE PRODUTO PROVADO: carro não abandona quando o combustível zera!
  })
})
