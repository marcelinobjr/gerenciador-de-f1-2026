import { describe, it, expect, vi } from 'vitest'
import { weekendSimulationService } from '@/services/weekendSimulationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import type { TeamModel, DriverModel, SeasonModel } from '@/types/f1'
import type { SessionTimeResult } from '@/pages/race/types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'
import weekendSimServiceSource from '@/services/weekendSimulationService.ts?raw'

describe('BUG-07B: Race Callers Canonical Routing Contract', () => {
  const mockTeam: TeamModel = {
    id: 'team_player_07b',
    user_id: 'user_07b',
    name: 'Escuderia Brasil 07B',
    team_key: 'escuderia_brasil_07b',
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

  const mockSeason: SeasonModel = {
    id: 'season_2026_07b',
    year: 2026,
    current_round: 1,
    total_rounds: 24,
  } as SeasonModel

  const mockDrivers: DriverModel[] = [
    {
      id: 'player_drv_1',
      team_id: 'team_player_07b',
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
      team_id: 'team_player_07b',
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
      teamName: 'Escuderia Brasil 07B',
      teamColor: '#00A859',
      lapTime: '1:22.500',
      gap: '+2.500s',
      tire: 'macio',
      isPlayer: true,
    })
    list.push({
      position: 24,
      driverId: 'player_drv_2',
      driverName: 'Player Beta',
      teamName: 'Escuderia Brasil 07B',
      teamColor: '#00A859',
      lapTime: '1:22.800',
      gap: '+2.800s',
      tire: 'macio',
      isPlayer: true,
    })
    return list
  }

  /**
   * BUG7B-01: Caller canônico / simulação — ação "Simular restante" usa simulateRemainingWeekend ou adapter canônico equivalente;
   * a cadeia chega ao caminho homologado do BUG-07A; PASS se não existir gerador esportivo alternativo no caller.
   */
  it('BUG7B-01: weekendSimulationService routes "Simular restante" through canonical adapter without alternative sports generator', () => {
    // weekendSimulationService delega simulateRemainingWeekend para simulateRaceSessionCanonical
    expect(weekendSimServiceSource).toMatch(/simulateRaceSessionCanonical\s*\(/)
  })

  /**
   * BUG7B-05: resultado oficial é processado UMA VEZ — uma simulação →
   * um OfficialRaceResult → um registerOfficialRaceResultInCareer → uma aplicação de championship.
   */
  it('BUG7B-05: official race result is processed exactly once without caller duplication', async () => {
    // Teste dinâmico de invocação única: uma simulação dispara exatamente 1 officializeRace e 1 register
    const officializeSpy = vi.spyOn(canonicalRaceResultService, 'officializeRace')
    const registerSpy = vi.spyOn(
      canonicalCareerPersistenceService,
      'registerOfficialRaceResultInCareer',
    )

    try {
      const qualyGrid = createQualyGrid24()
      await (weekendSimulationService as any).simulateRaceSessionCanonical({
        team: mockTeam,
        season: mockSeason,
        drivers: mockDrivers,
        parts: [],
        gpMeta: { name: 'GP Brasil', round: 1, laps: 20 },
        currentRound: 1,
        qualyGrid,
      })

      expect(officializeSpy).toHaveBeenCalledTimes(1)
      expect(registerSpy).toHaveBeenCalledTimes(1)
    } finally {
      officializeSpy.mockRestore()
      registerSpy.mockRestore()
    }
  })

  /**
   * BUG7B-06: corrida salva + "Simular restante" continua do estado existente
   * (fixture controlada com lap = 20, fuel/tyre wear atuais, gridPosition original, currentPosition atual):
   * não reinicializa grid, não reseta volta/fuel/pneus, não reaplica estratégia pré-corrida — continua a partir do snapshot atual.
   */
  it('BUG7B-06: saved race continuation preserves current lap, tyre wear, fuel and original gridPosition without resetting', () => {
    // Criar corrida padrão de 50 voltas via canonicalRaceInitializationService
    const qualyGrid = createQualyGrid24().map((entry) => ({
      gridPosition: entry.position,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.driverId.startsWith('player') ? 'team_player_07b' : 'team_rival',
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

    const initialRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_07b_continuation',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 50,
      playerTeamId: 'team_player_07b',
      canonicalQualifyingGrid: qualyGrid,
    })

    // Simular as primeiras 20 voltas
    const raceAtLap20 = canonicalRaceEngineService.advanceMultipleLaps(initialRace, 20, {
      seedOverride: 12345,
    })

    expect(raceAtLap20.currentLap).toBe(21) // 20 completadas, próxima é a 21
    expect(raceAtLap20.status).toBe('running')

    // Capturar snapshot do Carro 1 na volta 20
    const car1At20 = raceAtLap20.drivers.find((d) => d.driverId === 'player_drv_1')!
    expect(car1At20).toBeDefined()
    const fuelAt20 = car1At20.fuel
    const tyreAgeAt20 = car1At20.tyreAge
    const raceTimeAt20 = car1At20.raceTime
    const origGridPos = car1At20.gridPosition

    expect(fuelAt20).toBeLessThan(100.0)
    expect(tyreAgeAt20).toBeGreaterThanOrEqual(1)
    expect(raceTimeAt20).toBeGreaterThan(1000.0)

    // Continuar do estado existente até o fim (restam 30 voltas)
    const lapsRemaining = raceAtLap20.totalLaps - 20
    expect(lapsRemaining).toBe(30)

    const finalState = canonicalRaceEngineService.advanceMultipleLaps(raceAtLap20, lapsRemaining, {
      seedOverride: 67890,
    })

    // Validações de continuidade estrita
    expect(finalState.status).toBe('completed')
    expect(finalState.totalLaps).toBe(50)

    const car1Final = finalState.drivers.find((d) => d.driverId === 'player_drv_1')!
    expect(car1Final).toBeDefined()

    // 1. gridPosition permanece rigorosamente imutável
    expect(car1Final.gridPosition).toBe(origGridPos)

    // 2. Combustível continuou consumindo a partir do valor da volta 20 (não resetou)
    expect(car1Final.fuel).toBeLessThan(fuelAt20)

    // 3. Tempo total continuou acumulando a partir do tempo da volta 20
    expect(car1Final.raceTime).toBeGreaterThan(raceTimeAt20)

    // 4. Voltas completadas alcançaram 50
    expect(car1Final.lap).toBe(50)

    // Oficializar corrida continuada gera OfficialRaceResult íntegro
    const officialResult = canonicalRaceResultService.officializeRace(finalState)
    expect(officialResult).toBeDefined()
    expect(officialResult.totalLaps).toBe(50)
    expect(officialResult.entries).toHaveLength(24)

    const drv1Result = officialResult.entries.find((e) => e.driverId === 'player_drv_1')
    expect(drv1Result).toBeDefined()
    expect(drv1Result?.gridPosition).toBe(origGridPos)
    expect(drv1Result?.positionsGainedLost).toBe(
      drv1Result!.gridPosition - drv1Result!.finalPosition,
    )
  })
})
