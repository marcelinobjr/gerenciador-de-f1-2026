import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function makeMockRaceState(raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE'): CanonicalRaceState {
  const drivers = Array.from({ length: 24 }, (_, i) => ({
    driverId: `drv_${i + 1}`,
    driverName: `Driver ${i + 1}`,
    teamId: `team_${Math.floor(i / 2) + 1}`,
    teamName: `Team ${Math.floor(i / 2) + 1}`,
    teamColor: '#E10600',
    currentPosition: i + 1,
    position: i + 1,
    gridPosition: i + 1,
    startingGridPosition: i + 1,
    lap: 20,
    lapsCompleted: 20,
    isDnf: false,
    status: 'finished',
    raceStatus: 'finished',
    pitStopsCount: 0,
    bestLapSec: 80 + i * 0.1,
  }))

  return {
    careerId: 'car_test_01',
    season: 2026,
    round: 2,
    raceId: 'race_r2',
    raceVariant,
    status: 'completed',
    currentLap: 20,
    totalLaps: 20,
    drivers,
    raceControl: {
      currentFlag: 'FINISHED',
      safetyCarLaps: 0,
      vscLaps: 0,
    },
    fastestLap: {
      driverId: 'drv_1',
      lapTimeSec: 80.1,
      lapTimeFormatted: '1:20.100',
      lap: 15,
    },
    events: [],
  } as any
}

describe('SPT-PTS: Tabela de Pontos da Sprint 2026 (Fix A)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('SPT-PTS-01: oficializar SPRINT_RACE concede P1=8, P2=7, P3=6, P4=5, P5=4, P6=3, P7=2, P8=1', () => {
    const state = makeMockRaceState('SPRINT_RACE')
    const result = canonicalRaceResultService.officializeRace(state)

    expect(result.raceVariant).toBe('SPRINT_RACE')
    expect(result.entries[0].pointsAwarded).toBe(8)
    expect(result.entries[1].pointsAwarded).toBe(7)
    expect(result.entries[2].pointsAwarded).toBe(6)
    expect(result.entries[3].pointsAwarded).toBe(5)
    expect(result.entries[4].pointsAwarded).toBe(4)
    expect(result.entries[5].pointsAwarded).toBe(3)
    expect(result.entries[6].pointsAwarded).toBe(2)
    expect(result.entries[7].pointsAwarded).toBe(1)
  })

  it('SPT-PTS-02: oficializar SPRINT_RACE concede 0 pontos para P9 a P24', () => {
    const state = makeMockRaceState('SPRINT_RACE')
    const result = canonicalRaceResultService.officializeRace(state)

    for (let pos = 9; pos <= 24; pos++) {
      expect(result.entries[pos - 1].pointsAwarded).toBe(0)
    }
  })

  it('SPT-PTS-03: oficializar SPRINT_RACE não concede ponto por volta mais rápida', () => {
    const state = makeMockRaceState('SPRINT_RACE')
    // drv_1 tem fastest lap no mock
    const result = canonicalRaceResultService.officializeRace(state)
    expect(result.fastestLapDriverId).toBe('drv_1')
    // P1 continua exatamente com 8 pontos, sem +1 de fastest lap
    expect(result.entries[0].pointsAwarded).toBe(8)
  })

  it('SPT-PTS-04: oficializar MAIN_RACE continua intocada com tabela FIA 25-18-15-12-10-8-6-4-2-1', () => {
    const state = makeMockRaceState('MAIN_RACE')
    const result = canonicalRaceResultService.officializeRace(state)

    expect(result.entries[0].pointsAwarded).toBe(25)
    expect(result.entries[1].pointsAwarded).toBe(18)
    expect(result.entries[2].pointsAwarded).toBe(15)
    expect(result.entries[3].pointsAwarded).toBe(12)
    expect(result.entries[4].pointsAwarded).toBe(10)
    expect(result.entries[5].pointsAwarded).toBe(8)
    expect(result.entries[6].pointsAwarded).toBe(6)
    expect(result.entries[7].pointsAwarded).toBe(4)
    expect(result.entries[8].pointsAwarded).toBe(2)
    expect(result.entries[9].pointsAwarded).toBe(1)
    expect(result.entries[10].pointsAwarded).toBe(0)
  })
})
