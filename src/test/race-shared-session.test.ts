import { describe, it, expect } from 'vitest'
import { raceSessionService } from '@/services/raceSessionService'
import { advanceCanonicalRaceLap } from '@/services/canonicalRaceRunner'
import type { SimDriverEntry } from '@/pages/race/types'

/**
 * Testes focados da Etapa 1 — Nova Corrida & Sessão Compartilhada
 * Valida a sessão persistente, canonical runner, física e critérios A-H de QA.
 */
describe('Etapa 1: Sessão Persistente e Runner Canônico de Corrida', () => {
  it('constrói a chave canônica da sessão contendo carreira, temporada, rodada e tipo', () => {
    const key = raceSessionService.buildSessionKey({
      seasonId: 'season_2026',
      teamId: 'team_audi',
      round: 1,
      sessionType: 'race',
    })

    expect(key).toBe('sess_season_2026_team_audi_r1_race')

    // Sprint tem chave diferente para a mesma rodada
    const sprintKey = raceSessionService.buildSessionKey({
      seasonId: 'season_2026',
      teamId: 'team_audi',
      round: 1,
      sessionType: 'sprint',
    })
    expect(sprintKey).toBe('sess_season_2026_team_audi_r1_sprint')
    expect(key).not.toBe(sprintKey)
  })

  it('avança voltas mantendo física e tempos canônicos de volta', () => {
    const grid: SimDriverEntry[] = [
      {
        position: 1,
        gridPosition: 1,
        driverId: 'drv_nor',
        driverName: 'L. Norris',
        teamId: 'team_mclaren',
        teamName: 'McLaren',
        score: 88,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        tireCompound: 'medio',
        accumulatedTimeSec: 82.5,
        tireWear: 5,
        fuelRemaining: 98,
        lapsOnCurrentTire: 1,
        pitStopsDone: 0,
      },
      {
        position: 2,
        gridPosition: 2,
        driverId: 'drv_ver',
        driverName: 'M. Verstappen',
        teamId: 'team_redbull',
        teamName: 'Red Bull',
        score: 92,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        tireCompound: 'medio',
        accumulatedTimeSec: 82.8,
        tireWear: 5,
        fuelRemaining: 98,
        lapsOnCurrentTire: 1,
        pitStopsDone: 0,
      },
    ]

    const result = advanceCanonicalRaceLap({
      currentLap: 1,
      totalLaps: 58,
      grid,
      weather: 'seco',
      round: 1,
      gpName: 'Grande Prêmio da Austrália',
      circuitName: 'Albert Park',
      tireAbrasiveness: 6,
      team: null,
      playerCarTactics: {},
      playerPaceOrders: {},
      mechanicalIssues: [],
      redFlagState: {
        active: false,
        ticksFrozen: 0,
        usedThisRace: false,
        safetyCarLapsRemaining: 0,
      },
      lapHistory: {},
    })

    expect(result.nextLap).toBe(2)
    expect(result.nextGrid.length).toBe(2)
    expect(result.nextGrid[0].accumulatedTimeSec).toBeGreaterThan(82.5)
    expect(result.nextGrid[0].tireWear).toBeGreaterThan(5)
    expect(result.nextGrid[0].fuelRemaining).toBeLessThan(98)
    expect(result.nextLapHistory['drv_nor']).toBeDefined()
    expect(result.nextLapHistory['drv_nor'].length).toBe(1)
    expect(result.isCompleted).toBe(false)
  })

  it('detecta término oficial ao atingir totalLaps', () => {
    const grid: SimDriverEntry[] = [
      {
        position: 1,
        gridPosition: 1,
        driverId: 'drv_nor',
        driverName: 'L. Norris',
        teamId: 'team_mclaren',
        teamName: 'McLaren',
        score: 88,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        tireCompound: 'medio',
        accumulatedTimeSec: 4000,
      },
    ]

    const result = advanceCanonicalRaceLap({
      currentLap: 57,
      totalLaps: 58,
      grid,
      weather: 'seco',
      round: 1,
      gpName: 'Grande Prêmio da Austrália',
      circuitName: 'Albert Park',
      tireAbrasiveness: 6,
      team: null,
      playerCarTactics: {},
      playerPaceOrders: {},
      mechanicalIssues: [],
      redFlagState: {
        active: false,
        ticksFrozen: 0,
        usedThisRace: false,
        safetyCarLapsRemaining: 0,
      },
      lapHistory: {},
    })

    expect(result.nextLap).toBe(58)
    expect(result.isCompleted).toBe(true)
  })
})
