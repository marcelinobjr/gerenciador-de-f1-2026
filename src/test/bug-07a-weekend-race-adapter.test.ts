import { describe, it, expect, vi } from 'vitest'
import { weekendSimulationService } from '@/services/weekendSimulationService'
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

  it('BUG7A-01: simulateRaceSessionCanonical não usa mais score baseado em qPos nem variância sintética', async () => {
    const qualyGrid = createQualyGrid24()

    const result = await (weekendSimulationService as any).simulateRaceSessionCanonical({
      team: mockTeam,
      season: mockSeason,
      drivers: mockDrivers,
      parts: [],
      gpMeta: mockGpMeta,
      currentRound: 1,
      qualyGrid,
    })

    expect(result.finalGrid).toBeDefined()
    expect(result.finalGrid.length).toBe(24)

    // Nenhum piloto possui score com a fórmula legada (24 - qPos) * 1.5
    result.finalGrid.forEach((driver: any) => {
      const legacyScore = (24 - driver.gridPosition) * 1.5
      expect(driver.score).not.toBe(legacyScore)
    })
  })

  it('BUG7A-02: mesmo grid/seed aciona a engine canônica (inicialização canônica ocorre)', async () => {
    const qualyGrid = createQualyGrid24()
    const initSpy = vi.spyOn(canonicalRaceInitializationService, 'initializeRaceFromCanonicalGrid')
    const engineSpy = vi.spyOn(canonicalRaceEngineService, 'advanceMultipleLaps')

    try {
      const result = await (weekendSimulationService as any).simulateRaceSessionCanonical({
        team: mockTeam,
        season: mockSeason,
        drivers: mockDrivers,
        parts: [],
        gpMeta: mockGpMeta,
        currentRound: 1,
        qualyGrid,
      })

      expect(initSpy).toHaveBeenCalledTimes(1)
      expect(engineSpy).toHaveBeenCalledTimes(1)
      expect(result.finalGrid).toHaveLength(24)

      const callArgs = initSpy.mock.calls[0][0]
      expect(callArgs.totalLaps).toBe(50)
      expect(callArgs.canonicalQualifyingGrid).toHaveLength(24)
      expect(callArgs.playerTeamId).toBe(mockTeam.id)
    } finally {
      initSpy.mockRestore()
      engineSpy.mockRestore()
    }
  })

  it('BUG7A-03: resultado retornado deriva de officializeRace/OfficialRaceResult canônico', async () => {
    const qualyGrid = createQualyGrid24()
    const officializeSpy = vi.spyOn(canonicalRaceResultService, 'officializeRace')

    try {
      const result = await (weekendSimulationService as any).simulateRaceSessionCanonical({
        team: mockTeam,
        season: mockSeason,
        drivers: mockDrivers,
        parts: [],
        gpMeta: mockGpMeta,
        currentRound: 1,
        qualyGrid,
      })

      expect(officializeSpy).toHaveBeenCalledTimes(1)
      const officialResult = officializeSpy.mock.results[0].value

      // O vencedor da finalGrid bate exatamente com o winnerDriverId do resultado oficial
      const winnerInFinalGrid = result.finalGrid.find((g: any) => g.position === 1)
      expect(winnerInFinalGrid?.driverId).toBe(officialResult.winnerDriverId)

      // Total de voltas no resultado bate com o oficial
      expect(winnerInFinalGrid?.lapsCompleted).toBe(officialResult.totalLaps)

      // Strategic decisions citam o vencedor canônico
      expect(
        result.strategicDecisions.some((d: string) => d.includes(officialResult.winnerDriverId)),
      ).toBe(true)
    } finally {
      officializeSpy.mockRestore()
    }
  })

  it('BUG7A-04: gridPosition preservado sem recálculo (autoridade BUG-04)', async () => {
    const qualyGrid = createQualyGrid24()

    const result = await (weekendSimulationService as any).simulateRaceSessionCanonical({
      team: mockTeam,
      season: mockSeason,
      drivers: mockDrivers,
      parts: [],
      gpMeta: mockGpMeta,
      currentRound: 1,
      qualyGrid,
    })

    // Cada piloto no finalGrid mantém exatamente seu gridPosition da qualyGrid
    qualyGrid.forEach((qEntry) => {
      const found = result.finalGrid.find((g: any) => g.driverId === qEntry.driverId)
      expect(found).toBeDefined()
      expect(found.gridPosition).toBe(qEntry.position)
    })
  })

  it('BUG7A-05: nenhum caminho local de race score define a ordem final', async () => {
    const qualyGrid = createQualyGrid24()

    const result = await (weekendSimulationService as any).simulateRaceSessionCanonical({
      team: mockTeam,
      season: mockSeason,
      drivers: mockDrivers,
      parts: [],
      gpMeta: mockGpMeta,
      currentRound: 1,
      qualyGrid,
    })

    // Posições finais 1..24 são estritamente contínuas
    const positions = result.finalGrid
      .map((g: any) => g.position)
      .sort((a: number, b: number) => a - b)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))

    // Os pontos concedidos vêm do regulamento oficial da engine canônica (P1=25, P2=18, ...)
    const p1 = result.finalGrid.find((g: any) => g.position === 1)
    const p2 = result.finalGrid.find((g: any) => g.position === 2)
    const p11 = result.finalGrid.find((g: any) => g.position === 11)

    expect(p1.points).toBe(25)
    expect(p2.points).toBe(18)
    expect(p11.points).toBe(0)
  })

  it('Prova: Cadillac largando P5 — P5 é só posição inicial, sem bônus de pace legado', async () => {
    // Configura a Cadillac largando em P5 na qualificação
    const qualyGrid = createQualyGrid24()

    // Encontra o piloto de P5 e o carro 1 da equipe 11 (Cadillac no mapping das rivais)
    const cadillacCar = qualyGrid.find((q) => q.driverId === 'ai_team_11_d1')!
    const originalP5 = qualyGrid.find((q) => q.position === 5)!

    const cadillacOrigPos = cadillacCar.position
    cadillacCar.position = 5
    originalP5.position = cadillacOrigPos

    const result = await (weekendSimulationService as any).simulateRaceSessionCanonical({
      team: mockTeam,
      season: mockSeason,
      drivers: mockDrivers,
      parts: [],
      gpMeta: mockGpMeta,
      currentRound: 1,
      qualyGrid,
    })

    const cadillacFinal = result.finalGrid.find((g: any) => g.driverId === 'ai_team_11_d1')
    expect(cadillacFinal).toBeDefined()
    // A posição de largada permaneceu P5
    expect(cadillacFinal.gridPosition).toBe(5)

    // O score NÃO é o bônus de pace legado (24 - 5) * 1.5 = 28.5
    expect(cadillacFinal.score).not.toBe((24 - 5) * 1.5)

    // A posição final é determinada pela simulação física canônica
    expect(typeof cadillacFinal.position).toBe('number')
    expect(cadillacFinal.position).toBeGreaterThanOrEqual(1)
    expect(cadillacFinal.position).toBeLessThanOrEqual(24)
  })
})
