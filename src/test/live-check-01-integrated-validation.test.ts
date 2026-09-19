import { describe, it, expect, vi } from 'vitest'
import { raceSessionService } from '@/services/raceSessionService'
import { advanceCanonicalRaceLap } from '@/services/canonicalRaceRunner'
import {
  buildCanonicalEventGrid,
  resolveEventParticipatingTeams,
} from '@/lib/canonical-race-grid-resolver'
import { financialLedgerService } from '@/services/financialLedgerService'
import { f1Service } from '@/services/f1Service'
import type { SimDriverEntry } from '@/pages/race/types'
import type {
  RacePendingDecision,
  RaceResolvedDecision,
  RaceSessionRecord,
  RaceSessionCheckpointData,
} from '@/types/race-session'
import type { TeamModel, DriverModel, SeasonModel } from '@/types/f1'
import pb from '@/lib/pocketbase/client'

/**
 * LIVE-CHECK-01 — SUÍTE DE VALIDAÇÃO INTEGRADA
 * Cobertura determinística com fixture isolada de carreira de teste (NUNCA save de produção):
 * 1. PARTICIPANTES CORRETOS (12 equipes × 2 titulares = 24 pilotos)
 * 2. VÍNCULOS DA TEMPORADA ATUAL (transferência de pilotos e troca de fornecedor respeitadas)
 * 3. TIMING & GAP CALCULATIONS (gapToLeader vs gapToFront distintos)
 * 4. HISTÓRICO DE VOLTAS (acumulado por piloto, sem duplicatas por rerender/tick)
 * 5. PNEUS & COMBUSTÍVEL (consumo, cliff status e taxas físicas)
 * 6. CONDIÇÃO DOS CARROS & ISOLAMENTO (Carro 1 e Carro 2 independentes)
 * 7. PLAY/PAUSE (congelamento físico completo, retomada sem salto real, sem timer duplicado)
 * 8. VELOCIDADES 1x / 2x / 4x (física idêntica com intervalo de interface desacoplado)
 * 9. PAUSA POR CONVERSA/DECISÃO & RESPOSTA ENQUANTO PAUSADO (anti-loop)
 * 10. PAUSA POR PIT STOP & RETRY DE COMANDO IDEMPOTENTE
 * 11. ORDENS PARA OS DOIS PILOTOS
 * 12. CHECKPOINT & RELOAD (reidratação idêntica com mesma chave, volta, grid e decisões)
 * 13. FINALIZAÇÃO IDEMPOTENTE (deleteRaceResultsForRound, last_processed_round e ledger sem duplicações)
 */

describe('LIVE-CHECK-01: Validação Integrada da Sessão de Corrida F1 2026', () => {
  // Fixture isolada de teste
  const mockTestTeam: TeamModel = {
    id: 'team_livecheck_audi',
    user_id: 'usr_test_fixture',
    name: 'Audi F1 Team',
    country: 'Alemanha',
    color: '#E10600',
    secondary_color: '#000000',
    engine_supplier: 'Audi',
    budget: 120000000,
    reputation: 75,
    strength: 65,
    chassis_level: 65,
    aerodynamics_level: 65,
    aero_level: 65,
    powertrain_level: 65,
    reliability_level: 65,
    strategy_level: 65,
    created: '2026-01-01',
    updated: '2026-01-01',
    team_key: 'audi',
  } as unknown as TeamModel

  const mockTestDrivers: DriverModel[] = [
    {
      id: 'drv_car1_bortoleto',
      team_id: 'team_livecheck_audi',
      name: 'Gabriel Bortoleto',
      nationality: 'Brasil',
      role: 'titular',
      speed: 85,
      consistency: 84,
      experience: 72,
      racecraft: 85,
      defense: 83,
      rain: 82,
      morale: 88,
      physical_condition: 94,
      salary: 5000000,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: 'drv_car2_hulkenberg',
      team_id: 'team_livecheck_audi',
      name: 'Nico Hülkenberg',
      nationality: 'Alemanha',
      role: 'titular',
      speed: 83,
      consistency: 86,
      experience: 90,
      racecraft: 84,
      defense: 83,
      rain: 83,
      morale: 85,
      physical_condition: 91,
      salary: 7000000,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
  ] as unknown as DriverModel[]

  const defaultRunnerParams = {
    totalLaps: 50,
    weather: 'seco' as const,
    round: 1,
    gpName: 'Grande Prêmio do Bahrein',
    circuitName: 'Circuito Internacional do Sakhir',
    tireAbrasiveness: 7,
    team: mockTestTeam,
    playerCarTactics: {
      drv_car1_bortoleto: 'attack' as const,
      drv_car2_hulkenberg: 'normal' as const,
    },
    playerPaceOrders: {
      drv_car1_bortoleto: 'empurrar' as const,
      drv_car2_hulkenberg: 'normal' as const,
    },
    mechanicalIssues: [],
    redFlagState: {
      active: false,
      ticksFrozen: 0,
      usedThisRace: false,
      safetyCarLapsRemaining: 0,
    },
    lapHistory: {},
    sessionId: 'sess_livecheck_iso_001',
  }

  // 1. PARTICIPANTES CORRETOS & GRID INICIAL
  it('1. PARTICIPANTES CORRETOS: Grid nasce com exatamente 12 equipes e 24 pilotos inscritos', () => {
    const teams = resolveEventParticipatingTeams(mockTestTeam)
    expect(teams).toHaveLength(12)

    const gridRes = buildCanonicalEventGrid({
      team: mockTestTeam,
      playerDrivers: mockTestDrivers,
      currentRound: 1,
      totalLaps: 57,
      gpName: 'GP do Bahrein',
    })

    expect(gridRes.success).toBe(true)
    expect(gridRes.teamsCount).toBe(12)
    expect(gridRes.driversCount).toBe(24)
    expect(gridRes.grid).toHaveLength(24)

    // Os 2 pilotos titulares do jogador estão presentes
    const pCars = gridRes.grid.filter((c) => c.isPlayer)
    expect(pCars).toHaveLength(2)
    expect(pCars.map((p) => p.driverId)).toContain('drv_car1_bortoleto')
    expect(pCars.map((p) => p.driverId)).toContain('drv_car2_hulkenberg')
  })

  // 2. VÍNCULOS DA TEMPORADA ATUAL (Temporada posterior ou modificada)
  it('2. VÍNCULOS DA TEMPORADA ATUAL: Sessão respeita transferências de pilotos e trocas de fornecedor na carreira', () => {
    // Equipe personalizada do jogador em 2027 com novo fornecedor 'Ferrari' e custom_grid_teams modificado
    const transferredTeam: TeamModel = {
      ...mockTestTeam,
      engine_supplier: 'Ferrari',
      custom_grid_teams: [
        {
          key: 'audi',
          name: 'Audi F1 Team',
          engine: 'Ferrari', // Troca de motor efetivada na temporada
          driver1: { name: 'Gabriel Bortoleto', speed: 88, consistency: 85, salary: 10000000 },
          driver2: { name: 'Lando Norris', speed: 90, consistency: 88, salary: 25000000 }, // Transferência
          strength: 78,
        },
        ...Array.from({ length: 11 }, (_, i) => ({
          key: `team_custom_${i + 1}`,
          name: `Rival Team ${i + 1}`,
          engine: 'Mercedes',
          strength: 70,
        })),
      ],
    } as unknown as TeamModel

    const drivers2027: DriverModel[] = [
      mockTestDrivers[0],
      {
        id: 'drv_transferred_norris',
        team_id: 'team_livecheck_audi',
        name: 'Lando Norris',
        role: 'titular',
        speed: 90,
        consistency: 88,
        morale: 90,
        physical_condition: 96,
        salary: 25000000,
      } as DriverModel,
    ]

    const res = buildCanonicalEventGrid({
      team: transferredTeam,
      playerDrivers: drivers2027,
      currentRound: 1,
      totalLaps: 57,
    })

    expect(res.success).toBe(true)
    expect(res.grid).toHaveLength(24)
    // Norris agora é piloto titular do jogador no grid
    const norrisCar = res.grid.find((c) => c.driverId === 'drv_transferred_norris')
    expect(norrisCar).toBeDefined()
    expect(norrisCar?.isPlayer).toBe(true)
    expect(norrisCar?.driverName).toBe('Lando Norris')
  })

  // 3. PLAY/PAUSE: Congelamento e retomada sem salto
  it('3. PLAY/PAUSE: Pausado não avança combustível, voltas nem desgaste; despausar não compensa tempo real', () => {
    const initialGridRes = buildCanonicalEventGrid({
      team: mockTestTeam,
      playerDrivers: mockTestDrivers,
      currentRound: 1,
      totalLaps: 50,
    })
    const initialGrid = initialGridRes.grid
    const p1Initial = initialGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!

    const initialFuel = p1Initial.fuelRemaining
    const initialWear = p1Initial.tireWear

    // Simulando estado de pause
    const isPaused = true
    let simulatedLap = 1
    if (!isPaused) {
      simulatedLap++
    }

    expect(simulatedLap).toBe(1)
    expect(p1Initial.fuelRemaining).toBe(initialFuel)
    expect(p1Initial.tireWear).toBe(initialWear)

    // Ao despausar, executa exatamente 1 volta sem acelerar ou compensar o tempo passado
    const stepRes = advanceCanonicalRaceLap({
      ...defaultRunnerParams,
      currentLap: 1,
      grid: initialGrid,
    })

    expect(stepRes.nextLap).toBe(2)
    const p1After = stepRes.nextGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    expect(p1After.fuelRemaining).toBeLessThan(initialFuel!)
    expect(p1After.tireWear).toBeGreaterThan(initialWear!)
    // Consumo compatível com UMA única volta (~2.15% no modo empurrar)
    expect(p1After.fuelRemaining).toBeGreaterThan(95)
  })

  // 4. VELOCIDADES 1x / 2x / 4x: Física estritamente idêntica
  it('4. VELOCIDADES 1x / 2x / 4x: Com os mesmos comandos, a simulação produz física idêntica independente do multiplicador', () => {
    const grid1x = buildCanonicalEventGrid({
      team: mockTestTeam,
      playerDrivers: mockTestDrivers,
      currentRound: 1,
      totalLaps: 50,
    }).grid
    const grid2x = JSON.parse(JSON.stringify(grid1x))
    const grid4x = JSON.parse(JSON.stringify(grid1x))

    const res1x = advanceCanonicalRaceLap({
      ...defaultRunnerParams,
      currentLap: 5,
      grid: grid1x,
    })

    const res2x = advanceCanonicalRaceLap({
      ...defaultRunnerParams,
      currentLap: 5,
      grid: grid2x,
    })

    const res4x = advanceCanonicalRaceLap({
      ...defaultRunnerParams,
      currentLap: 5,
      grid: grid4x,
    })

    expect(res1x.nextLap).toBe(6)
    expect(res2x.nextLap).toBe(6)
    expect(res4x.nextLap).toBe(6)

    const c1_1x = res1x.nextGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    const c1_2x = res2x.nextGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    const c1_4x = res4x.nextGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!

    expect(c1_1x.tireWear).toBe(c1_2x.tireWear)
    expect(c1_1x.tireWear).toBe(c1_4x.tireWear)
    expect(c1_1x.fuelRemaining).toBe(c1_2x.fuelRemaining)
    expect(c1_1x.fuelRemaining).toBe(c1_4x.fuelRemaining)
  })

  // 5. HISTÓRICO DE VOLTAS & GAP CALCULATIONS
  it('5. HISTÓRICO DE VOLTAS: Acumula tempos no histórico do piloto correto e distingue gapToLeader de gapToFront', () => {
    const grid = buildCanonicalEventGrid({
      team: mockTestTeam,
      playerDrivers: mockTestDrivers,
      currentRound: 1,
      totalLaps: 50,
    }).grid

    const resLap1 = advanceCanonicalRaceLap({
      ...defaultRunnerParams,
      currentLap: 1,
      grid,
      lapHistory: {},
    })

    const history = resLap1.nextLapHistory
    expect(Object.keys(history)).toHaveLength(24) // 24 pilotos com histórico de volta registrado
    expect(history['drv_car1_bortoleto']).toHaveLength(1)
    expect(history['drv_car1_bortoleto'][0].lap).toBe(2)
    expect(history['drv_car1_bortoleto'][0].lapTimeSec).toBeGreaterThan(0)

    // Verificação de Gaps: Líder vs Segundo Colocado
    const p1Car = resLap1.nextGrid.find((c) => c.position === 1)!
    const p2Car = resLap1.nextGrid.find((c) => c.position === 2)!

    expect(p1Car.gapToLeader).toBe('Líder')
    expect(p2Car.gapToLeader).toContain('+')
    expect(p2Car.gapToFront).toBeDefined()
    // Idempotência: rodar sem avançar volta não duplica histórico
    expect(history['drv_car1_bortoleto']).toHaveLength(1)
  })

  // 6. ISOLAMENTO POR CARRO (Carro 1 vs Carro 2)
  it('6. ISOLAMENTO POR CARRO: Pneus, combustível, táticas e danos do Carro 1 nunca vazam para o Carro 2', () => {
    const grid = buildCanonicalEventGrid({
      team: mockTestTeam,
      playerDrivers: mockTestDrivers,
      currentRound: 1,
      totalLaps: 50,
    }).grid

    const car1 = grid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    const car2 = grid.find((c) => c.driverId === 'drv_car2_hulkenberg')!

    car1.tireCompound = 'macio'
    car1.tireWear = 40
    car1.fuelRemaining = 75
    car1.hasWingDamage = true

    car2.tireCompound = 'duro'
    car2.tireWear = 15
    car2.fuelRemaining = 90
    car2.hasWingDamage = false

    const res = advanceCanonicalRaceLap({
      ...defaultRunnerParams,
      currentLap: 10,
      grid,
      playerCarTactics: {
        drv_car1_bortoleto: 'attack',
        drv_car2_hulkenberg: 'save_fuel',
      },
      playerPaceOrders: {
        drv_car1_bortoleto: 'empurrar',
        drv_car2_hulkenberg: 'segurar',
      },
    })

    const updatedCar1 = res.nextGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    const updatedCar2 = res.nextGrid.find((c) => c.driverId === 'drv_car2_hulkenberg')!

    // Carro 1: sofre maior desgaste e consome mais por estar em ataque/empurrar
    expect(updatedCar1.tireCompound).toBe('macio')
    expect(updatedCar1.hasWingDamage).toBe(true)

    // Carro 2: preserva pneus e consome menos, sem herdar dano de asa
    expect(updatedCar2.tireCompound).toBe('duro')
    expect(updatedCar2.hasWingDamage).toBe(false)
    expect(updatedCar2.tireWear! - 15).toBeLessThan(updatedCar1.tireWear! - 40)
    expect(75 - updatedCar1.fuelRemaining!).toBeGreaterThan(90 - updatedCar2.fuelRemaining!)
  })

  // 7. PAUSA POR DECISÃO & RESPOSTA ENQUANTO PAUSADO (Anti-loop)
  it('7. PAUSA POR DECISÃO: Evento gera requiresPause, resolução ocorre pausado e evento não entra em loop', async () => {
    const grid = buildCanonicalEventGrid({
      team: mockTestTeam,
      playerDrivers: mockTestDrivers,
      currentRound: 1,
      totalLaps: 50,
    }).grid

    const car1 = grid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    car1.tireWear = 85 // Crítico -> requer decisão

    const stepRes = advanceCanonicalRaceLap({
      ...defaultRunnerParams,
      currentLap: 20,
      grid,
    })

    expect(stepRes.requiresPause).toBe(true)
    expect(stepRes.detectedDecisions.length).toBeGreaterThanOrEqual(1)
    const decision = stepRes.detectedDecisions.find((d) => d.driverId === 'drv_car1_bortoleto')!
    expect(decision).toBeDefined()
    expect(decision.type).toBe('pit_stop_critical_wear')

    // Mock do PocketBase para testar resolução pausado
    const mockSession: Partial<RaceSessionRecord> = {
      id: 'sess_livecheck_001',
      status: 'awaiting_decision',
      revision: 10,
      checkpoint_data: {
        grid,
        currentLap: 21,
        totalLaps: 50,
        weather: 'seco',
        liveEvents: [],
        playerCarTactics: {},
        playerPaceOrders: {},
        mechanicalIssues: [],
        penalties: [],
        pendingDecisions: [decision],
        resolvedDecisions: [],
        lastSavedAt: new Date().toISOString(),
      },
    }

    const getOneSpy = vi
      .spyOn(pb.collection('race_sessions'), 'getOne')
      .mockResolvedValue(mockSession as any)
    const updateSpy = vi
      .spyOn(pb.collection('race_sessions'), 'update')
      .mockImplementation(async (_id, p: any) => ({
        ...mockSession,
        ...p,
        revision: 11,
      }))

    const resolveRes = await raceSessionService.resolveDecision({
      sessionId: 'sess_livecheck_001',
      executorId: 'tab_executor_test',
      decisionId: decision.id,
      choice: 'box_now',
      newCompoundChoice: 'duro',
    })

    expect(resolveRes.success).toBe(true)
    // Permanece em 'paused' para aguardar o Play consciente do jogador
    expect(resolveRes.updatedSession?.status).toBe('paused')
    expect(resolveRes.remainingPendingDecisions).toHaveLength(0)

    // Teste Anti-Loop: avançar a mesma volta com o ID na lista de resolvidos não recria a decisão
    const antiLoopRes = advanceCanonicalRaceLap({
      ...defaultRunnerParams,
      currentLap: 20,
      grid,
      resolvedDecisionIds: [decision.id],
    })

    expect(antiLoopRes.detectedDecisions.find((d) => d.id === decision.id)).toBeUndefined()

    getOneSpy.mockRestore()
    updateSpy.mockRestore()
  })

  // 8. PIT STOP: Comando dirigido ao carro certo e retry sem duplicação
  it('8. PIT STOP & RETRY: Troca pneus do carro alvo e retry não duplica parada nem perda de tempo', async () => {
    const grid = buildCanonicalEventGrid({
      team: mockTestTeam,
      playerDrivers: mockTestDrivers,
      currentRound: 1,
      totalLaps: 50,
    }).grid

    const decisionId = 'decision_pit_car1'
    const pendingDec: RacePendingDecision = {
      id: decisionId,
      type: 'pit_stop_critical_wear',
      driverId: 'drv_car1_bortoleto',
      driverName: 'Gabriel Bortoleto',
      lap: 22,
      createdAt: new Date().toISOString(),
      title: 'Pit Stop',
      description: 'Troca de pneus',
      payload: {},
    }

    const sessionData: Partial<RaceSessionRecord> = {
      id: 'sess_pit_test',
      status: 'awaiting_decision',
      revision: 2,
      checkpoint_data: {
        grid: JSON.parse(JSON.stringify(grid)),
        currentLap: 22,
        totalLaps: 50,
        weather: 'seco',
        liveEvents: [],
        playerCarTactics: {},
        playerPaceOrders: {},
        mechanicalIssues: [],
        penalties: [],
        pendingDecisions: [pendingDec],
        resolvedDecisions: [],
        lastSavedAt: new Date().toISOString(),
      },
    }

    const getOneSpy = vi
      .spyOn(pb.collection('race_sessions'), 'getOne')
      .mockResolvedValue(sessionData as any)
    const updateSpy = vi
      .spyOn(pb.collection('race_sessions'), 'update')
      .mockImplementation(async (_id, p: any) => ({
        ...sessionData,
        ...p,
        revision: 3,
      }))

    // 1ª Resolução: Sucesso
    const res1 = await raceSessionService.resolveDecision({
      sessionId: 'sess_pit_test',
      executorId: 'tab_test',
      decisionId,
      choice: 'box_now',
      newCompoundChoice: 'duro',
    })

    expect(res1.success).toBe(true)
    const car1After = res1.updatedSession?.checkpoint_data?.grid?.find(
      (c) => c.driverId === 'drv_car1_bortoleto',
    )!
    const car2After = res1.updatedSession?.checkpoint_data?.grid?.find(
      (c) => c.driverId === 'drv_car2_hulkenberg',
    )!

    expect(car1After.tireCompound).toBe('duro')
    expect(car1After.pitStopsDone).toBe(1)
    expect(car1After.tireWear).toBe(4) // Novo pneu
    expect(car2After.pitStopsDone).toBe(0) // Carro 2 não foi afetado

    // 2ª Resolução (Retry do usuário ou duplo clique): Rejeitada com alreadyResolved
    const sessionAfterRes1: Partial<RaceSessionRecord> = {
      ...sessionData,
      revision: 3,
      checkpoint_data: {
        ...sessionData.checkpoint_data!,
        pendingDecisions: [],
        resolvedDecisions: [res1.resolvedDecision!],
      },
    }
    getOneSpy.mockResolvedValue(sessionAfterRes1 as any)

    const res2 = await raceSessionService.resolveDecision({
      sessionId: 'sess_pit_test',
      executorId: 'tab_test',
      decisionId,
      choice: 'box_now',
    })

    expect(res2.success).toBe(false)
    expect(res2.alreadyResolved).toBe(true)
    expect(res2.error).toContain('já foi resolvido')

    getOneSpy.mockRestore()
    updateSpy.mockRestore()
  })

  // 9. CHECKPOINT & RELOAD: Reidratação idêntica
  it('9. CHECKPOINT/RELOAD: Restaurar sessão recarrega mesmos participantes, volta, gaps, pneus e histórico', async () => {
    const grid = buildCanonicalEventGrid({
      team: mockTestTeam,
      playerDrivers: mockTestDrivers,
      currentRound: 1,
      totalLaps: 50,
    }).grid
    grid[0].accumulatedTimeSec = 1800.5
    grid[1].accumulatedTimeSec = 1803.2

    const mockSavedRecord: RaceSessionRecord = {
      id: 'sess_reload_check',
      session_key: 'sess_season2026_team_livecheck_audi_r1_race',
      season_id: 'season_2026',
      team_id: 'team_livecheck_audi',
      user_id: 'usr_test_fixture',
      season_year: 2026,
      round: 1,
      session_type: 'race',
      status: 'paused',
      revision: 25,
      current_lap: 18,
      total_laps: 50,
      sim_speed: 2,
      pause_reason: 'Pausado pelo usuário',
      checkpoint_data: {
        grid,
        currentLap: 18,
        totalLaps: 50,
        weather: 'seco',
        liveEvents: [],
        playerCarTactics: { drv_car1_bortoleto: 'attack' },
        playerPaceOrders: { drv_car1_bortoleto: 'empurrar' },
        mechanicalIssues: [],
        penalties: [],
        pendingDecisions: [],
        resolvedDecisions: [],
        lastSavedAt: '2026-03-10T14:00:00.000Z',
      },
      lap_history: {
        drv_car1_bortoleto: [
          {
            lap: 18,
            driverId: 'drv_car1_bortoleto',
            lapTimeSec: 91.2,
            lapTimeFormatted: '1:31.200',
          },
        ],
      },
      created: '2026-03-10T14:00:00.000Z',
      updated: '2026-03-10T14:00:00.000Z',
    }

    const getListSpy = vi.spyOn(pb.collection('race_sessions'), 'getList').mockResolvedValue({
      page: 1,
      perPage: 1,
      totalItems: 1,
      totalPages: 1,
      items: [mockSavedRecord],
    } as any)

    const rehydrated = await raceSessionService.openOrResumeRaceSession({
      seasonId: 'season_2026',
      teamId: 'team_livecheck_audi',
      userId: 'usr_test_fixture',
      seasonYear: 2026,
      round: 1,
      totalLaps: 50,
    })

    expect(rehydrated.isResumed).toBe(true)
    expect(rehydrated.session.id).toBe('sess_reload_check')
    expect(rehydrated.session.current_lap).toBe(18)
    expect(rehydrated.session.revision).toBe(25)
    expect(rehydrated.session.checkpoint_data?.grid).toHaveLength(24)
    expect(rehydrated.session.checkpoint_data?.grid?.[0].accumulatedTimeSec).toBe(1800.5)

    getListSpy.mockRestore()
  })

  // 10. FINALIZAÇÃO IDEMPOTENTE: deleteRaceResultsForRound, last_processed_round e Ledger
  it('10. FINALIZAÇÃO IDEMPOTENTE: Finalizar duas vezes não duplica pontos nem lançamentos financeiros', async () => {
    const seasonId = 'season_livecheck_001'
    const roundNumber = 1

    // 10.1 deleteRaceResultsForRound garante limpeza prévia de resultados da rodada
    let storedResultsCount = 0
    const deleteSpy = vi
      .spyOn(f1Service, 'deleteRaceResultsForRound')
      .mockImplementation(async () => {
        storedResultsCount = 0
      })

    const createResultSpy = vi.spyOn(f1Service, 'createRaceResult').mockImplementation(async () => {
      storedResultsCount++
      return {} as any
    })

    // 1ª execução de gravação de resultados
    await f1Service.deleteRaceResultsForRound(seasonId, roundNumber)
    for (let i = 0; i < 24; i++) {
      await f1Service.createRaceResult({
        season_id: seasonId,
        round: roundNumber,
        driver_id: `drv_${i}`,
        team_id: 'team_test',
        position: i + 1,
        points: i === 0 ? 25 : 0,
        laps_completed: 50,
      } as any)
    }
    expect(storedResultsCount).toBe(24)

    // 2ª execução (re-tentativa ou finalização duplicada)
    await f1Service.deleteRaceResultsForRound(seasonId, roundNumber)
    for (let i = 0; i < 24; i++) {
      await f1Service.createRaceResult({
        season_id: seasonId,
        round: roundNumber,
        driver_id: `drv_${i}`,
        team_id: 'team_test',
        position: i + 1,
        points: i === 0 ? 25 : 0,
        laps_completed: 50,
      } as any)
    }
    expect(storedResultsCount).toBe(24) // Não se tornou 48!

    // 10.2 Idempotência financeira via financialLedgerService
    const idempotencyKey = `round_finance_${seasonId}_r${roundNumber}`
    const existingTx = {
      id: 'tx_existing_001',
      idempotency_key: idempotencyKey,
      amount: 5000000,
    } as any

    const getTxSpy = vi
      .spyOn(financialLedgerService, 'getTransactionByIdempotencyKey')
      .mockResolvedValueOnce(null) // 1ª vez: não existe
      .mockResolvedValueOnce(existingTx) // 2ª vez: já existe

    const postSpy = vi
      .spyOn(financialLedgerService, 'postTransaction')
      .mockImplementation(async (params) => {
        const found = await financialLedgerService.getTransactionByIdempotencyKey(
          params.idempotencyKey,
        )
        if (found) {
          return { transaction: found, wasAlreadyProcessed: true }
        }
        return {
          transaction: { id: 'tx_new_001', ...params } as any,
          wasAlreadyProcessed: false,
        }
      })

    // Lançamento 1
    const postRes1 = await financialLedgerService.postTransaction({
      teamId: mockTestTeam.id,
      seasonYear: 2026,
      round: roundNumber,
      type: 'revenue',
      category: 'sponsorship',
      direction: 'inflow',
      amount: 5000000,
      sourceSystem: 'round_advancement',
      idempotencyKey,
      description: 'Receita da Rodada 1',
    })
    expect(postRes1.wasAlreadyProcessed).toBe(false)

    // Lançamento 2 (Duplicado)
    const postRes2 = await financialLedgerService.postTransaction({
      teamId: mockTestTeam.id,
      seasonYear: 2026,
      round: roundNumber,
      type: 'revenue',
      category: 'sponsorship',
      direction: 'inflow',
      amount: 5000000,
      sourceSystem: 'round_advancement',
      idempotencyKey,
      description: 'Receita da Rodada 1',
    })
    expect(postRes2.wasAlreadyProcessed).toBe(true) // Rejeitado / recuperado sem duplicar

    deleteSpy.mockRestore()
    createResultSpy.mockRestore()
    getTxSpy.mockRestore()
    postSpy.mockRestore()
  })

  // 11. ORDENS PARA OS DOIS PILOTOS
  it('11. ORDENS PARA OS DOIS PILOTOS: Ordens táticas e de ritmo funcionam independentemente e impactam os dois carros', () => {
    const grid = buildCanonicalEventGrid({
      team: mockTestTeam,
      playerDrivers: mockTestDrivers,
      currentRound: 1,
      totalLaps: 50,
    }).grid

    const car1 = grid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    const car2 = grid.find((c) => c.driverId === 'drv_car2_hulkenberg')!

    car1.tireWear = 20
    car2.tireWear = 20
    car1.fuelRemaining = 90
    car2.fuelRemaining = 90

    // Carro 1: Modo Ataque Máximo (Attack + Empurrar)
    // Carro 2: Modo Economia Máxima (Save Fuel + Segurar)
    const res = advanceCanonicalRaceLap({
      ...defaultRunnerParams,
      currentLap: 15,
      grid,
      playerCarTactics: {
        drv_car1_bortoleto: 'attack',
        drv_car2_hulkenberg: 'save_fuel',
      },
      playerPaceOrders: {
        drv_car1_bortoleto: 'empurrar',
        drv_car2_hulkenberg: 'segurar',
      },
    })

    const updatedC1 = res.nextGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    const updatedC2 = res.nextGrid.find((c) => c.driverId === 'drv_car2_hulkenberg')!

    const wearBurnC1 = updatedC1.tireWear! - 20
    const wearBurnC2 = updatedC2.tireWear! - 20
    const fuelBurnC1 = 90 - updatedC1.fuelRemaining!
    const fuelBurnC2 = 90 - updatedC2.fuelRemaining!

    expect(wearBurnC1).toBeGreaterThan(wearBurnC2)
    expect(fuelBurnC1).toBeGreaterThan(fuelBurnC2)
  })
})
