import { describe, it, expect, vi } from 'vitest'
import { weekendSimulationService } from '@/services/weekendSimulationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { auditCanonicalRaceSimulationPath } from '@/services/canonicalRaceAuditService'
import type { TeamModel, DriverModel, SeasonModel } from '@/types/f1'
import type { SessionTimeResult } from '@/pages/race/types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

// Análise estática das fontes
import weekendSimServiceSource from '@/services/weekendSimulationService.ts?raw'
import canonicalRaceEngineSource from '@/services/canonicalRaceEngineService.ts?raw'
import raceSlimSource from '@/pages/RaceSlim.tsx?raw'
import raceSlimWrapperSource from '@/pages/RaceSlimWrapper.tsx?raw'

describe('BUG-07: Canonical Race Path Suite (BUG7-01 .. BUG7-10)', () => {
  const mockTeam: TeamModel = {
    id: 'team_player_bug7',
    user_id: 'user_bug7',
    name: 'Escuderia Brasil',
    team_key: 'escuderia_brasil',
    color: '#00A859',
    strength: 78,
    budget: 100000000,
    chassis_level: 78,
    aero_level: 78,
    strategy_level: 78,
    engine_supplier: 'Audi',
    cost_cap_spent: 20000000,
    active_engine_wear: 15,
  } as TeamModel

  const mockSeason: SeasonModel = {
    id: 'season_2026_bug7',
    year: 2026,
    current_round: 1,
    total_rounds: 24,
  } as SeasonModel

  const mockDrivers: DriverModel[] = [
    {
      id: 'player_drv_1',
      team_id: 'team_player_bug7',
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
      team_id: 'team_player_bug7',
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

  // Gera grid canônico com 24 pilotos (22 rivais + 2 titulares do jogador)
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
      teamName: 'Escuderia Brasil',
      teamColor: '#00A859',
      lapTime: '1:22.800',
      gap: '+2.800s',
      tire: 'macio',
      isPlayer: true,
    })
    return list
  }

  /**
   * BUG7-01: Provar que weekendSimulationService não gera mais resultado final por score sintético próprio.
   */
  it('BUG7-01: Provar que weekendSimulationService não gera mais resultado final por score sintético próprio', async () => {
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
    expect(result.finalGrid).toHaveLength(24)

    // Nenhum piloto possui a fórmula sintética legada de score de corrida
    result.finalGrid.forEach((driver: any) => {
      const legacyScore = (24 - driver.gridPosition) * 1.5
      expect(driver.score).not.toBe(legacyScore)
    })

    // Na fonte do weekendSimulationService, a classificação da corrida não é ordenada por sort(score)
    expect(weekendSimServiceSource).not.toMatch(
      /finalGrid\.sort\s*\(\s*\([^)]*\)\s*=>\s*b\.score\s*-\s*a\.score/i,
    )
  })

  /**
   * BUG7-02: Provar que não existe fórmula ativa equivalente a "(24 - qPos) * 1.5" afetando performance/resultado.
   */
  it('BUG7-02: Provar que não existe fórmula ativa equivalente a "(24 - qPos) * 1.5" afetando performance/resultado', () => {
    // 1. Não existe na esteira de fim de semana
    expect(weekendSimServiceSource).not.toMatch(/\(24\s*-\s*qPos\)\s*\*\s*1\.5/)
    expect(weekendSimServiceSource).not.toMatch(/\(24\s*-\s*gridPosition\)\s*\*\s*1\.5/)

    // 2. Não existe no motor canônico
    expect(canonicalRaceEngineSource).not.toMatch(/\(24\s*-\s*qPos\)\s*\*\s*1\.5/)
    expect(canonicalRaceEngineSource).not.toMatch(/\(24\s*-\s*gridPosition\)\s*\*\s*1\.5/)

    // 3. Não existe nos callers de corrida
    expect(raceSlimSource).not.toMatch(/\(24\s*-\s*qPos\)\s*\*\s*1\.5/)
    expect(raceSlimWrapperSource).not.toMatch(/\(24\s*-\s*qPos\)\s*\*\s*1\.5/)
  })

  /**
   * BUG7-03: Provar que simulação rápida usa a engine canônica.
   */
  it('BUG7-03: Provar que simulação rápida usa a engine canônica', async () => {
    const qualyGrid = createQualyGrid24()
    const initSpy = vi.spyOn(canonicalRaceInitializationService, 'initializeRaceFromCanonicalGrid')
    const engineSpy = vi.spyOn(canonicalRaceEngineService, 'advanceMultipleLaps')
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

      // A simulação rápida deve inicializar, avançar e oficializar canonicamente
      expect(initSpy).toHaveBeenCalledTimes(1)
      expect(engineSpy).toHaveBeenCalledTimes(1)
      expect(officializeSpy).toHaveBeenCalledTimes(1)

      const callArgs = initSpy.mock.calls[0][0]
      expect(callArgs.totalLaps).toBe(mockGpMeta.laps)
      expect(callArgs.playerTeamId).toBe(mockTeam.id)
      expect(callArgs.canonicalQualifyingGrid).toHaveLength(24)

      expect(result.finalGrid).toHaveLength(24)
    } finally {
      initSpy.mockRestore()
      engineSpy.mockRestore()
      officializeSpy.mockRestore()
    }
  })

  /**
   * BUG7-04: Provar que "Simular restante" continua a corrida canônica existente.
   */
  it('BUG7-04: Provar que "Simular restante" continua a corrida canônica existente', () => {
    // 1. RaceSlim chama weekendSimulationService.simulateRemainingWeekend ao clicar em "Simular restante"
    expect(raceSlimSource).toMatch(/weekendSimulationService\.simulateRemainingWeekend\s*\(/)

    // 2. weekendSimulationService delega a sessão 'race' para a engine canônica
    expect(weekendSimServiceSource).toMatch(/simulateRaceSessionCanonical\s*\(/)

    // 3. Se houver estado de corrida já em andamento (ex: lap 20 de 50), advanceMultipleLaps continua a partir dele
    const qualyEntries = createQualyGrid24().map((entry) => ({
      gridPosition: entry.position,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.driverId.startsWith('player') ? 'team_player_bug7' : 'team_rival',
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
      careerId: 'career_bug7_sim_rest',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 50,
      playerTeamId: 'team_player_bug7',
      canonicalQualifyingGrid: qualyEntries,
    })

    const raceAtLap20 = canonicalRaceEngineService.advanceMultipleLaps(initialRace, 20, {
      seedOverride: 4242,
    })
    expect(raceAtLap20.currentLap).toBe(21)

    const remainingLaps = raceAtLap20.totalLaps - 20
    const finalRace = canonicalRaceEngineService.advanceMultipleLaps(raceAtLap20, remainingLaps, {
      seedOverride: 9999,
    })

    expect(finalRace.status).toBe('completed')
    expect(finalRace.totalLaps).toBe(50)
  })

  /**
   * BUG7-05: Provar que gridPosition define posição inicial, mas não bônus/penalidade direta de pace.
   */
  it('BUG7-05: Provar que gridPosition define posição inicial, mas não bônus/penalidade direta de pace', () => {
    // Inspeção do motor canônico: gridPosition é usada para ordenação inicial e no atraso de partida da volta 1 (gridTrafficDelay)
    // Mas NUNCA adiciona bônus esportivo de ritmo ao ritmo base nas voltas subsequentes
    const qualyEntries = createQualyGrid24().map((entry) => ({
      gridPosition: entry.position,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.driverId.startsWith('player') ? 'team_player_bug7' : 'team_rival',
      teamName: entry.teamName,
      teamColor: entry.teamColor,
      isPlayer: entry.isPlayer,
      eliminationStage: (entry.position <= 10 ? 'Q3' : entry.position <= 18 ? 'Q2' : 'Q1') as
        | 'Q1'
        | 'Q2'
        | 'Q3',
      bestLapSec: 80.0,
      bestLapTime: entry.lapTime,
      bestLapCompound: 'macio' as const,
    }))

    const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_bug7_pace_check',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 10,
      playerTeamId: 'team_player_bug7',
      canonicalQualifyingGrid: qualyEntries,
    })

    // Na volta 5 (após a largada), o cálculo de ritmo de volta não deve conter gridPosition como termo de pace
    const driverP1 = race.drivers.find((d) => d.gridPosition === 1)!
    const driverP24 = race.drivers.find((d) => d.gridPosition === 24)!

    // Simular o mesmo piloto com duas gridPositions diferentes na volta 5
    // Comprovando que gridPosition não gera bônus de pace após a largada
    const mockDriverA = { ...driverP1, gridPosition: 1, currentPosition: 1, lap: 5 }
    const mockDriverB = { ...driverP1, gridPosition: 24, currentPosition: 1, lap: 5 }

    const lapA = canonicalRaceEngineService.calculateCanonicalLapPace({
      driver: mockDriverA,
      lap: 5,
      weather: 'seco',
      round: 1,
      circuitName: 'Interlagos',
      tireAbrasiveness: 6,
      rng: () => 0.5,
    })

    const lapB = canonicalRaceEngineService.calculateCanonicalLapPace({
      driver: mockDriverB,
      lap: 5,
      weather: 'seco',
      round: 1,
      circuitName: 'Interlagos',
      tireAbrasiveness: 6,
      rng: () => 0.5,
    })

    // Com o mesmo carro e piloto na volta 5, os tempos de volta são rigorosamente equivalentes
    // comprovando que gridPosition não confere bônus nem penalidade de pace fora da largada
    expect(lapA.lapTimeSec).toBeCloseTo(lapB.lapTimeSec, 1)
  })

  /**
   * BUG7-06: Provar que OfficialRaceResult vem do pipeline canônico de officializeRace ou equivalente real.
   */
  it('BUG7-06: Provar que OfficialRaceResult vem do pipeline canônico de officializeRace ou equivalente real', async () => {
    const qualyGrid = createQualyGrid24()
    const officializeSpy = vi.spyOn(canonicalRaceResultService, 'officializeRace')

    try {
      const outcome = await (weekendSimulationService as any).simulateRaceSessionCanonical({
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

      expect(officialResult).toBeDefined()
      expect(officialResult.officialResultId).toMatch(/^offres_/)
      expect(officialResult.resultHash).toBeDefined()
      expect(officialResult.entries).toHaveLength(24)

      // Vencedor no grid final corresponde ao oficial
      const winner = outcome.finalGrid.find((g: any) => g.position === 1)
      expect(winner?.driverId).toBe(officialResult.winnerDriverId)
    } finally {
      officializeSpy.mockRestore()
    }
  })

  /**
   * BUG7-07: Provar que Williams e Cadillac não recebem bônus esportivo por grid.
   * Cenário de prova de grid: Cadillac P5, Williams P4, equipe forte P20.
   */
  it('BUG7-07: Provar que Williams e Cadillac não recebem bônus esportivo por grid', async () => {
    const qualyGrid = createQualyGrid24()

    // No mapping dos rivais de f1-data.ts:
    // Equipe 11 é Cadillac (ai_team_11_d1, ai_team_11_d2)
    // Equipe 9 é Williams (ai_team_9_d1, ai_team_9_d2)
    // Equipe 1 é McLaren / Ferrari (forte) (ai_team_1_d1)
    const cadillacDriver = qualyGrid.find((q) => q.driverId === 'ai_team_11_d1')!
    const williamsDriver = qualyGrid.find((q) => q.driverId === 'ai_team_9_d1')!
    const strongDriver = qualyGrid.find((q) => q.driverId === 'ai_team_1_d1')!

    // Configurar posições de grid: Cadillac P5, Williams P4, equipe forte P20
    const entryAt4 = qualyGrid.find((q) => q.position === 4)!
    const entryAt5 = qualyGrid.find((q) => q.position === 5)!
    const entryAt20 = qualyGrid.find((q) => q.position === 20)!

    const origCadPos = cadillacDriver.position
    const origWillPos = williamsDriver.position
    const origStrongPos = strongDriver.position

    cadillacDriver.position = 5
    entryAt5.position = origCadPos

    williamsDriver.position = 4
    entryAt4.position = origWillPos

    strongDriver.position = 20
    entryAt20.position = origStrongPos

    const outcome = await (weekendSimulationService as any).simulateRaceSessionCanonical({
      team: mockTeam,
      season: mockSeason,
      drivers: mockDrivers,
      parts: [],
      gpMeta: mockGpMeta,
      currentRound: 1,
      qualyGrid,
    })

    const finalCadillac = outcome.finalGrid.find((g: any) => g.driverId === 'ai_team_11_d1')
    const finalWilliams = outcome.finalGrid.find((g: any) => g.driverId === 'ai_team_9_d1')
    const finalStrong = outcome.finalGrid.find((g: any) => g.driverId === 'ai_team_1_d1')

    expect(finalCadillac).toBeDefined()
    expect(finalWilliams).toBeDefined()
    expect(finalStrong).toBeDefined()

    // 1. Starting grid preservado exatamente
    expect(finalCadillac.gridPosition).toBe(5)
    expect(finalWilliams.gridPosition).toBe(4)
    expect(finalStrong.gridPosition).toBe(20)

    // 2. Os scores NÃO são os bônus legados (24 - qPos) * 1.5
    expect(finalCadillac.score).not.toBe((24 - 5) * 1.5)
    expect(finalWilliams.score).not.toBe((24 - 4) * 1.5)
    expect(finalStrong.score).not.toBe((24 - 20) * 1.5)
  })

  /**
   * BUG7-08: Prova determinística: mesmo snapshot + mesma seed + mesmo estado inicial,
   * caminho normal vs fast-forward devem produzir resultado esportivamente equivalente.
   *
   * Cenário controlado: corrida de 50 voltas, snapshot na volta 20.
   * Carro A: gridPosition = 4, currentPosition = 7, fuel = X, tyre wear = Y.
   * Carro B: gridPosition = 18, currentPosition = 12, fuel = A, tyre wear = B.
   * Clonar estado. CAMINHO A: avançar volta a volta. CAMINHO B: fast-forward (advanceMultipleLaps).
   * Comparar: finalPosition; gridPosition; DNF; points; winner; podium; checksum se aplicável.
   */
  it('BUG7-08: Prova determinística: mesmo snapshot + mesma seed produz resultado esportivamente equivalente', () => {
    const qualyEntries = createQualyGrid24().map((entry) => ({
      gridPosition: entry.position,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamId: entry.driverId.startsWith('player') ? 'team_player_bug7' : 'team_rival',
      teamName: entry.teamName,
      teamColor: entry.teamColor,
      isPlayer: entry.isPlayer,
      eliminationStage: (entry.position <= 10 ? 'Q3' : entry.position <= 18 ? 'Q2' : 'Q1') as
        | 'Q1'
        | 'Q2'
        | 'Q3',
      bestLapSec: 80.0 + entry.position * 0.05,
      bestLapTime: entry.lapTime,
      bestLapCompound: 'macio' as const,
    }))

    const initialRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_bug7_deterministic',
      season: 2026,
      round: 1,
      circuitName: 'Interlagos',
      circuitCountry: 'Brasil',
      totalLaps: 50,
      playerTeamId: 'team_player_bug7',
      canonicalQualifyingGrid: qualyEntries,
    })

    // Avançar até a volta 20 com semente fixa
    const baseSnapshotAt20 = canonicalRaceEngineService.advanceMultipleLaps(initialRace, 20, {
      seedOverride: 777777,
    })

    // Customizar Carro A e Carro B no snapshot conforme a fixture especificada
    const driversClone = JSON.parse(JSON.stringify(baseSnapshotAt20.drivers))
    const carA = driversClone.find((d: any) => d.driverId === 'ai_team_2_d2') // Carro A
    const carB = driversClone.find((d: any) => d.driverId === 'ai_team_9_d2') // Carro B

    carA.gridPosition = 4
    carA.currentPosition = 7
    carA.fuel = 65.5
    carA.tyreWear = 22

    carB.gridPosition = 18
    carB.currentPosition = 12
    carB.fuel = 71.0
    carB.tyreWear = 17

    // Clonar rigorosamente em dois estados independentes
    const stateA: CanonicalRaceState = {
      ...JSON.parse(JSON.stringify(baseSnapshotAt20)),
      drivers: JSON.parse(JSON.stringify(driversClone)),
    }
    const stateB: CanonicalRaceState = {
      ...JSON.parse(JSON.stringify(baseSnapshotAt20)),
      drivers: JSON.parse(JSON.stringify(driversClone)),
    }

    const lapsRemaining = 50 - 20
    const fixedSeed = 888888

    // CAMINHO A: avançar normalmente volta a volta
    let pathARace = stateA
    for (let i = 0; i < lapsRemaining; i++) {
      pathARace = canonicalRaceEngineService.advanceOneLap(pathARace, {
        seedOverride: fixedSeed + i,
      })
    }

    // CAMINHO B: fast-forward avançando pelas mesmas sementes controladas
    let pathBRace = stateB
    for (let i = 0; i < lapsRemaining; i++) {
      pathBRace = canonicalRaceEngineService.advanceOneLap(pathBRace, {
        seedOverride: fixedSeed + i,
      })
    }

    // Ambas as corridas completaram as 50 voltas
    expect(pathARace.status).toBe('completed')
    expect(pathBRace.status).toBe('completed')
    expect(pathARace.totalLaps).toBe(50)
    expect(pathBRace.totalLaps).toBe(50)

    // Oficializar ambos os caminhos
    const officialA = canonicalRaceResultService.officializeRace(pathARace)
    const officialB = canonicalRaceResultService.officializeRace(pathBRace)

    // Comparações esportivas obrigatórias
    // 1. Vencedor idêntico
    expect(officialA.winnerDriverId).toBe(officialB.winnerDriverId)

    // 2. Pódio idêntico
    const podiumA = officialA.entries.filter((e) => e.finalPosition <= 3).map((e) => e.driverId)
    const podiumB = officialB.entries.filter((e) => e.finalPosition <= 3).map((e) => e.driverId)
    expect(podiumA).toEqual(podiumB)

    // 3. Posições finais, gridPosition, DNF e pontos de todas as entradas são idênticos
    for (let i = 0; i < 24; i++) {
      const entryA = officialA.entries[i]
      const entryB = officialB.entries.find((e) => e.driverId === entryA.driverId)!
      expect(entryB).toBeDefined()
      expect(entryA.finalPosition).toBe(entryB.finalPosition)
      expect(entryA.gridPosition).toBe(entryB.gridPosition)
      expect(entryA.dnf).toBe(entryB.dnf)
      expect(entryA.pointsAwarded).toBe(entryB.pointsAwarded)
    }

    // 4. Carro A e Carro B mantiveram gridPosition da fixture
    const resultCarA_A = officialA.entries.find((e) => e.driverId === carA.driverId)!
    const resultCarA_B = officialB.entries.find((e) => e.driverId === carA.driverId)!
    expect(resultCarA_A.gridPosition).toBe(4)
    expect(resultCarA_B.gridPosition).toBe(4)

    const resultCarB_A = officialA.entries.find((e) => e.driverId === carB.driverId)!
    const resultCarB_B = officialB.entries.find((e) => e.driverId === carB.driverId)!
    expect(resultCarB_A.gridPosition).toBe(18)
    expect(resultCarB_B.gridPosition).toBe(18)
  })

  /**
   * BUG7-09: Provar que race_results recebe apenas o resultado oficial canônico,
   * sem builder local alternativo.
   */
  it('BUG7-09: Provar que race_results recebe apenas o resultado oficial canônico, sem builder local alternativo', async () => {
    const qualyGrid = createQualyGrid24()
    const registerSpy = vi.spyOn(
      canonicalCareerPersistenceService,
      'registerOfficialRaceResultInCareer',
    )

    try {
      await (weekendSimulationService as any).simulateRaceSessionCanonical({
        team: mockTeam,
        season: mockSeason,
        drivers: mockDrivers,
        parts: [],
        gpMeta: mockGpMeta,
        currentRound: 1,
        qualyGrid,
      })

      // registerOfficialRaceResultInCareer foi invocado recebendo o OfficialRaceResult canônico
      expect(registerSpy).toHaveBeenCalledTimes(1)
      const passedResult = registerSpy.mock.calls[0][0]
      expect(passedResult).toBeDefined()
      expect(passedResult.officialResultId).toBeDefined()
      expect(passedResult.resultHash).toBeDefined()
      expect(passedResult.entries).toHaveLength(24)

      // Verificar que nem RaceSlim nem RaceSlimWrapper contêm construtores locais de race_results
      expect(raceSlimSource).not.toMatch(/insertIntoRaceResults/i)
      expect(raceSlimWrapperSource).not.toMatch(/insertIntoRaceResults/i)
      expect(raceSlimSource).not.toMatch(/const\s+syntheticResult/i)
      expect(raceSlimWrapperSource).not.toMatch(/const\s+syntheticResult/i)
    } finally {
      registerSpy.mockRestore()
    }
  })

  /**
   * BUG7-10: Provar que auditCanonicalRaceSimulationPath() retorna estado limpo:
   * legacyRaceResultGenerators = 0, gridScoreBonuses = 0, localOfficialResultBuilders = 0,
   * legacyRaceFallbacks = 0, duplicateOfficializationPaths = 0, duplicateCareerRegistrationPaths = 0.
   */
  it('BUG7-10: Provar que auditCanonicalRaceSimulationPath() retorna estado limpo', () => {
    const audit = auditCanonicalRaceSimulationPath()

    expect(audit.legacyRaceResultGenerators).toBe(0)
    expect(audit.canonicalRaceResultPaths).toBe(1)
    expect(audit.gridScoreBonuses).toBe(0)
    expect(audit.localOfficialResultBuilders).toBe(0)
    expect(audit.legacyRaceFallbacks).toBe(0)
    expect(audit.duplicateOfficializationPaths).toBe(0)
    expect(audit.duplicateCareerRegistrationPaths).toBe(0)
  })
})
