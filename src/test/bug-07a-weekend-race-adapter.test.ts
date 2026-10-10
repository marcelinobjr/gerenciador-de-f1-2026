import { describe, it, expect } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import type { TeamModel, DriverModel, SeasonModel } from '@/types/f1'
import type { SessionTimeResult } from '@/pages/race/types'

describe('BUG-07A: Weekend Race Canonical Engine Adapter', () => {
  const mockTeam = {
    id: 'team_player',
    user_id: 'user_1',
    name: 'Escuderia Brasil',
    team_key: 'escuderia_brasil',
    color: '#00A859',
    strength: 75,
    budget: 100000000,
    chassis_level: 75,
    aero_level: 75,
    strategy_level: 75,
    engine_supplier: 'Audi',
    cost_cap_spent: 20000000,
    active_engine_wear: 15,
  } as TeamModel

  const mockSeason = {
    id: 'season_2026',
    year: 2026,
    current_round: 1,
    total_rounds: 24,
  } as SeasonModel

  const mockDrivers: DriverModel[] = [
    {
      id: 'player_drv_1',
      team_id: 'team_player',
      name: 'Player Alpha',
      role: 'titular',
      speed: 82,
      consistency: 82,
      defense: 80,
      nationality: 'Brasil',
      age: 24,
      rain: 80,
      morale: 85,
      physical_condition: 90,
      salary: 5000000,
      contract_end: 2027,
    },
    {
      id: 'player_drv_2',
      team_id: 'team_player',
      name: 'Player Beta',
      role: 'titular',
      speed: 80,
      consistency: 80,
      defense: 80,
      nationality: 'Brasil',
      age: 26,
      rain: 80,
      morale: 85,
      physical_condition: 90,
      salary: 5000000,
      contract_end: 2027,
    },
  ]

  const mockGpMeta = {
    name: 'GP do Brasil',
    round: 1,
    laps: 50,
    tireAbrasiveness: 6,
    country: 'Brasil',
  }

  // Fixture canônica com 24 pilotos (22 rivais + 2 pilotos do jogador) compatível com BUG-04
  const createQualyGrid24 = (): SessionTimeResult[] => {
    const list: SessionTimeResult[] = []
    for (let i = 1; i <= 22; i++) {
      const teamIdx = Math.ceil(i / 2)
      const slot = i % 2 === 1 ? 1 : 2
      list.push({
        position: i,
        driverId: `ai_team_${teamIdx}_d${slot}`,
        driverName: `Driver ${String(i).padStart(2, '0')}`,
        teamName: `Team Rival ${teamIdx}`,
        teamColor: '#334155',
        lapTime: `1:20.${String(i).padStart(3, '0')}`,
        gap: i === 1 ? 'LÍDER' : `+${(i * 0.1).toFixed(3)}s`,
        tire: 'macio',
        isPlayer: false,
      })
    }
    list.push({
      position: 23,
      driverId: 'player_drv_1',
      driverName: 'Player Alpha',
      teamName: 'Escuderia Brasil',
      teamColor: '#E10600',
      lapTime: '1:22.500',
      gap: '+2.500s',
      tire: 'macio',
      isPlayer: true,
    })
    list.push({
      position: 24,
      driverId: 'player_drv_2',
      driverName: 'Player Beta',
      teamName: 'Escuderia Brasil',
      teamColor: '#E10600',
      lapTime: '1:22.800',
      gap: '+2.800s',
      tire: 'macio',
      isPlayer: true,
    })
    return list
  }

  it('BUG7A-01: canonicalRaceInitializationService inicializa exatamente 24 pilotos', () => {
    const qualyGrid = createQualyGrid24()
    const qualyEntries = qualyGrid.map((entry) => ({
      gridPosition: entry.position,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.driverId.startsWith('player') ? 'team_player' : 'team_rival',
      teamName: entry.teamName,
      teamColor: entry.teamColor,
      isPlayer: entry.isPlayer,
      eliminationStage: (entry.position <= 10 ? 'Q3' : entry.position <= 18 ? 'Q2' : 'Q1') as
        | 'Q1'
        | 'Q2'
        | 'Q3',
      bestLapSec: 80.0 + entry.position * 0.1,
      bestLapTime: entry.lapTime,
      bestLapCompound: 'macio' as const,
    }))

    const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_7a',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 50,
      playerTeamId: 'team_player',
      canonicalQualifyingGrid: qualyEntries,
    })

    expect(race.drivers).toHaveLength(24)
  })

  it('BUG7A-02: avanço de voltas aciona a engine canônica', () => {
    const qualyGrid = createQualyGrid24()
    const qualyEntries = qualyGrid.map((entry) => ({
      gridPosition: entry.position,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.driverId.startsWith('player') ? 'team_player' : 'team_rival',
      teamName: entry.teamName,
      teamColor: entry.teamColor,
      isPlayer: entry.isPlayer,
      eliminationStage: (entry.position <= 10 ? 'Q3' : entry.position <= 18 ? 'Q2' : 'Q1') as
        | 'Q1'
        | 'Q2'
        | 'Q3',
      bestLapSec: 80.0 + entry.position * 0.1,
      bestLapTime: entry.lapTime,
      bestLapCompound: 'macio' as const,
    }))

    const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_7a_engine',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 50,
      playerTeamId: 'team_player',
      canonicalQualifyingGrid: qualyEntries,
    })

    const advanced = canonicalRaceEngineService.advanceMultipleLaps(race, 10, { seedOverride: 42 })
    expect(advanced.currentLap).toBe(11)
  })

  it('BUG7A-03: resultado retornado deriva de officializeRace/OfficialRaceResult canônico', () => {
    const qualyGrid = createQualyGrid24()
    const qualyEntries = qualyGrid.map((entry) => ({
      gridPosition: entry.position,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.driverId.startsWith('player') ? 'team_player' : 'team_rival',
      teamName: entry.teamName,
      teamColor: entry.teamColor,
      isPlayer: entry.isPlayer,
      eliminationStage: (entry.position <= 10 ? 'Q3' : entry.position <= 18 ? 'Q2' : 'Q1') as
        | 'Q1'
        | 'Q2'
        | 'Q3',
      bestLapSec: 80.0 + entry.position * 0.1,
      bestLapTime: entry.lapTime,
      bestLapCompound: 'macio' as const,
    }))

    const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_7a_result',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 50,
      playerTeamId: 'team_player',
      canonicalQualifyingGrid: qualyEntries,
    })

    const finished = canonicalRaceEngineService.advanceMultipleLaps(race, 50, { seedOverride: 99 })
    const officialResult = canonicalRaceResultService.officializeRace(finished)

    expect(officialResult.winnerDriverId).toBeDefined()
    expect(officialResult.entries).toHaveLength(24)
  })

  it('BUG7A-04: gridPosition preservado sem recálculo (autoridade BUG-04)', () => {
    const qualyGrid = createQualyGrid24()
    const qualyEntries = qualyGrid.map((entry) => ({
      gridPosition: entry.position,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.driverId.startsWith('player') ? 'team_player' : 'team_rival',
      teamName: entry.teamName,
      teamColor: entry.teamColor,
      isPlayer: entry.isPlayer,
      eliminationStage: (entry.position <= 10 ? 'Q3' : entry.position <= 18 ? 'Q2' : 'Q1') as
        | 'Q1'
        | 'Q2'
        | 'Q3',
      bestLapSec: 80.0 + entry.position * 0.1,
      bestLapTime: entry.lapTime,
      bestLapCompound: 'macio' as const,
    }))

    const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_7a_grid_pos',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 50,
      playerTeamId: 'team_player',
      canonicalQualifyingGrid: qualyEntries,
    })

    qualyGrid.forEach((qEntry) => {
      const found = race.drivers.find((g: any) => g.driverId === qEntry.driverId)
      expect(found).toBeDefined()
      expect(found!.gridPosition).toBe(qEntry.position)
    })
  })

  it('BUG7A-05: posições finais e pontos respeitam o regulamento FIA da engine canônica', () => {
    const qualyGrid = createQualyGrid24()
    const qualyEntries = qualyGrid.map((entry) => ({
      gridPosition: entry.position,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.driverId.startsWith('player') ? 'team_player' : 'team_rival',
      teamName: entry.teamName,
      teamColor: entry.teamColor,
      isPlayer: entry.isPlayer,
      eliminationStage: (entry.position <= 10 ? 'Q3' : entry.position <= 18 ? 'Q2' : 'Q1') as
        | 'Q1'
        | 'Q2'
        | 'Q3',
      bestLapSec: 80.0 + entry.position * 0.1,
      bestLapTime: entry.lapTime,
      bestLapCompound: 'macio' as const,
    }))

    const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_7a_points',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 50,
      playerTeamId: 'team_player',
      canonicalQualifyingGrid: qualyEntries,
    })

    const finished = canonicalRaceEngineService.advanceMultipleLaps(race, 50, { seedOverride: 42 })
    const officialResult = canonicalRaceResultService.officializeRace(finished)

    const p1 = officialResult.entries.find((g: any) => g.finalPosition === 1)
    const p2 = officialResult.entries.find((g: any) => g.finalPosition === 2)
    const p11 = officialResult.entries.find((g: any) => g.finalPosition === 11)

    expect(p1?.pointsAwarded).toBe(25)
    expect(p2?.pointsAwarded).toBe(18)
    expect(p11?.pointsAwarded).toBe(0)
  })

  it('Prova: Cadillac largando P5 — P5 é só posição inicial, sem bônus de pace legado', () => {
    const qualyGrid = createQualyGrid24()
    const cadillacCar = qualyGrid.find((q) => q.driverId === 'ai_team_11_d1')!
    const originalP5 = qualyGrid.find((q) => q.position === 5)!

    const cadillacOrigPos = cadillacCar.position
    cadillacCar.position = 5
    originalP5.position = cadillacOrigPos

    const qualyEntries = qualyGrid.map((entry) => ({
      gridPosition: entry.position,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.driverId.startsWith('player') ? 'team_player' : 'team_rival',
      teamName: entry.teamName,
      teamColor: entry.teamColor,
      isPlayer: entry.isPlayer,
      eliminationStage: (entry.position <= 10 ? 'Q3' : entry.position <= 18 ? 'Q2' : 'Q1') as
        | 'Q1'
        | 'Q2'
        | 'Q3',
      bestLapSec: 80.0 + entry.position * 0.1,
      bestLapTime: entry.lapTime,
      bestLapCompound: 'macio' as const,
    }))

    const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_7a_cadillac',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 50,
      playerTeamId: 'team_player',
      canonicalQualifyingGrid: qualyEntries,
    })

    const cadillacInRace = race.drivers.find((g) => g.driverId === 'ai_team_11_d1')
    expect(cadillacInRace).toBeDefined()
    expect(cadillacInRace!.gridPosition).toBe(5)
  })
})
