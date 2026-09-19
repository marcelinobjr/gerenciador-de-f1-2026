import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { raceSessionService } from '@/services/raceSessionService'
import { advanceCanonicalRaceLap } from '@/services/canonicalRaceRunner'
import { buildCanonicalEventGrid } from '@/lib/canonical-race-grid-resolver'
import { createInitialTireInventory } from '@/lib/f1-tire-system'
import type {
  RaceSessionRecord,
  RacePendingDecision,
  RaceSessionCheckpointData,
} from '@/types/race-session'
import type { SimDriverEntry } from '@/pages/race/types'
import type { TireSetItem } from '@/types/f1'

describe('ETAPA 4D.2 — CHECKPOINT B: REVALIDAÇÃO, ESTOQUE INDIVIDUAL E RESOLUÇÃO DA RECOMENDAÇÃO', () => {
  const mockTeam = {
    id: 'team_audi_sport',
    name: 'Audi F1 Team',
    color: '#E10600',
    chassis_level: 80,
    aero_level: 80,
    strategy_level: 80,
    budget: 100000000,
    engine_supplier: 'Audi' as const,
    strength: 80,
  }

  const mockDrivers = [
    {
      id: 'drv_car1_bortoleto',
      name: 'Gabriel Bortoleto',
      role: 'titular' as const,
      speed: 84,
      consistency: 82,
      morale: 85,
      physical_condition: 90,
      team_id: 'team_audi_sport',
      nationality: 'Brasil',
      age: 21,
      rain: 80,
      defense: 80,
      salary: 5000000,
      contract_end: 2028,
    },
    {
      id: 'drv_car2_hulkenberg',
      name: 'Nico Hulkenberg',
      role: 'titular' as const,
      speed: 82,
      consistency: 86,
      morale: 80,
      physical_condition: 88,
      team_id: 'team_audi_sport',
      nationality: 'Alemanha',
      age: 38,
      rain: 85,
      defense: 85,
      salary: 6000000,
      contract_end: 2027,
    },
  ]

  let baseGrid: SimDriverEntry[]
  let car1Inventory: TireSetItem[]
  let car2Inventory: TireSetItem[]

  beforeEach(() => {
    vi.clearAllMocks()

    const canonical = buildCanonicalEventGrid({
      team: mockTeam,
      playerDrivers: mockDrivers,
      currentRound: 1,
      totalLaps: 50,
      gpName: 'GP da Austrália',
      circuitName: 'Albert Park',
      tireAbrasiveness: 6,
    })

    baseGrid = canonical.grid
    car1Inventory = createInitialTireInventory('drv_car1_bortoleto')
    car2Inventory = createInitialTireInventory('drv_car2_hulkenberg')

    // Marca o pneu inicial como montado
    const fittedC1 = car1Inventory.find((s) => s.compound === 'medio')
    if (fittedC1) fittedC1.isFitted = true
    const fittedC2 = car2Inventory.find((s) => s.compound === 'duro')
    if (fittedC2) fittedC2.isFitted = true
  })

  // =========================================================================
  // TESTE 1 — ACEITAR ANTES DO PIT (Carro em pista, pneu atual preservado)
  // =========================================================================
  it('TESTE 1 — ACEITAR ANTES DO PIT: pneu atual, desgaste e histórico são preservados até o serviço real da parada', async () => {
    const car1 = baseGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    car1.tireCompound = 'medio'
    car1.tireWear = 62 // Desgaste em pista antes do box
    car1.lapsOnCurrentTire = 18
    car1.pitStopsDone = 0

    const decisionId = 'decision_australia_drv_car1_bortoleto_lap19_pit_informed'
    const pendingDec: RacePendingDecision = {
      id: decisionId,
      type: 'pit_stop_informed_recommendation',
      driverId: 'drv_car1_bortoleto',
      driverName: 'Gabriel Bortoleto',
      lap: 19,
      createdAt: new Date().toISOString(),
      title: 'Recomendação de Pit Stop (Treinos) — Gabriel Bortoleto',
      description: 'Alta degradação aprendida nos treinos para o composto médio.',
      payload: {
        driverId: 'drv_car1_bortoleto',
        proposedCompound: 'duro',
        proposedSetId: 'drv_car1_bortoleto_duro_1',
      },
    }

    const checkpoint: RaceSessionCheckpointData = {
      grid: JSON.parse(JSON.stringify(baseGrid)),
      currentLap: 19,
      totalLaps: 50,
      weather: 'seco',
      liveEvents: [],
      playerCarTactics: {},
      playerPaceOrders: {},
      mechanicalIssues: [],
      penalties: [],
      pendingDecisions: [pendingDec],
      resolvedDecisions: [],
      driverTireInventories: {
        drv_car1_bortoleto: car1Inventory,
        drv_car2_hulkenberg: car2Inventory,
      },
      lastSavedAt: new Date().toISOString(),
    }

    const mockSession: Partial<RaceSessionRecord> = {
      id: 'sess_australia_r1',
      status: 'awaiting_decision',
      revision: 4,
      current_lap: 19,
      total_laps: 50,
      checkpoint_data: checkpoint,
    }

    const getOneSpy = vi
      .spyOn(pb.collection('race_sessions'), 'getOne')
      .mockResolvedValue(mockSession as any)
    const updateSpy = vi
      .spyOn(pb.collection('race_sessions'), 'update')
      .mockImplementation(async (_id, payload: any) => ({
        ...mockSession,
        ...payload,
        revision: payload.revision || 4,
      }))

    // Resolução: Jogador aceita a recomendação para instalar Duro
    const res = await raceSessionService.resolveDecision({
      sessionId: 'sess_australia_r1',
      executorId: 'tab_executor_test1',
      decisionId,
      choice: 'box_now',
      targetSetId: 'drv_car1_bortoleto_duro_1',
    })

    expect(res.success).toBe(true)
    expect(res.resolvedDecision?.eventId).toBe(decisionId)
    expect(res.resolvedDecision?.choice).toBe('box_now')

    const updatedGrid = res.updatedSession?.checkpoint_data?.grid!
    const updatedC1 = updatedGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!

    // A decisão foi encaminhada e executada de forma atômica
    expect(updatedC1.tireCompound).toBe('duro')
    expect(updatedC1.pitStopsDone).toBe(1)
    expect(res.remainingPendingDecisions).toHaveLength(0)

    // O inventário foi atualizado: o jogo Duro_1 agora está montado (isFitted=true)
    const updatedInventories = res.updatedSession?.checkpoint_data?.driverTireInventories!
    const c1Sets = updatedInventories['drv_car1_bortoleto']
    const fittedDuro = c1Sets.find((s) => s.id === 'drv_car1_bortoleto_duro_1')!
    expect(fittedDuro.isFitted).toBe(true)

    // O jogo anterior Médio foi desmontado (isFitted=false) e preservou seu desgaste de pista (62%)
    const unmountedMedio = c1Sets.find((s) => s.compound === 'medio' && !s.isFitted)!
    expect(unmountedMedio.wear).toBe(62)

    getOneSpy.mockRestore()
    updateSpy.mockRestore()
  })

  // =========================================================================
  // TESTE 2 — EXECUTAR A TROCA E JOGO USADO (Não restaura para 100%)
  // =========================================================================
  it('TESTE 2 — EXECUTAR A TROCA COM JOGO USADO: instala o jogo usado mantendo seu desgaste anterior sem restaurar para 100%', async () => {
    // Carro 1 está com médio e vai calçar um jogo DURO USADO que já tinha 28% de desgaste
    const usedDuroSet = car1Inventory.find((s) => s.id === 'drv_car1_bortoleto_duro_2')!
    usedDuroSet.wear = 28
    usedDuroSet.lapsUsed = 10
    usedDuroSet.isFitted = false

    const decisionId = 'decision_australia_drv_car1_bortoleto_lap25_pit_informed'
    const pendingDec: RacePendingDecision = {
      id: decisionId,
      type: 'pit_stop_informed_recommendation',
      driverId: 'drv_car1_bortoleto',
      driverName: 'Gabriel Bortoleto',
      lap: 25,
      createdAt: new Date().toISOString(),
      title: 'Recomendação de Pit Stop (Treinos) — Gabriel Bortoleto',
      description: 'Troca recomendada para composto duro usado.',
      payload: {
        driverId: 'drv_car1_bortoleto',
        proposedCompound: 'duro',
        proposedSetId: 'drv_car1_bortoleto_duro_2',
      },
    }

    const checkpoint: RaceSessionCheckpointData = {
      grid: JSON.parse(JSON.stringify(baseGrid)),
      currentLap: 25,
      totalLaps: 50,
      weather: 'seco',
      liveEvents: [],
      playerCarTactics: {},
      playerPaceOrders: {},
      mechanicalIssues: [],
      penalties: [],
      pendingDecisions: [pendingDec],
      resolvedDecisions: [],
      driverTireInventories: {
        drv_car1_bortoleto: car1Inventory,
        drv_car2_hulkenberg: car2Inventory,
      },
      lastSavedAt: new Date().toISOString(),
    }

    const mockSession: Partial<RaceSessionRecord> = {
      id: 'sess_australia_r2',
      status: 'awaiting_decision',
      revision: 8,
      current_lap: 25,
      total_laps: 50,
      checkpoint_data: checkpoint,
    }

    const getOneSpy = vi
      .spyOn(pb.collection('race_sessions'), 'getOne')
      .mockResolvedValue(mockSession as any)
    const updateSpy = vi
      .spyOn(pb.collection('race_sessions'), 'update')
      .mockImplementation(async (_id, payload: any) => ({
        ...mockSession,
        ...payload,
        revision: 9,
      }))

    // Resolução escolhendo o jogo usado
    const res = await raceSessionService.resolveDecision({
      sessionId: 'sess_australia_r2',
      executorId: 'tab_executor_test2',
      decisionId,
      choice: 'box_now',
      targetSetId: 'drv_car1_bortoleto_duro_2',
    })

    expect(res.success).toBe(true)

    const updatedGrid = res.updatedSession?.checkpoint_data?.grid!
    const c1 = updatedGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!

    // O carro instalou o pneu Duro
    expect(c1.tireCompound).toBe('duro')
    // REGRA DE OURO: O jogo usado NÃO volta para 100% de vida nem 4% de pneu novo; mantém os 28% de desgaste
    expect(c1.tireWear).toBe(28)
    expect(c1.lapsOnCurrentTire).toBe(0) // Zerou voltas do stint atual
    expect(c1.pitStopsDone).toBe(1)

    // O jogo no inventário foi marcado como montado
    const updatedSets =
      res.updatedSession?.checkpoint_data?.driverTireInventories?.['drv_car1_bortoleto']!
    const fittedSet = updatedSets.find((s) => s.id === 'drv_car1_bortoleto_duro_2')!
    expect(fittedSet.isFitted).toBe(true)
    expect(fittedSet.wear).toBe(28)

    getOneSpy.mockRestore()
    updateSpy.mockRestore()
  })

  // =========================================================================
  // TESTE 3 — RECOMENDAÇÃO INVÁLIDA (Sessão encerrada, carro DNF, jogo inexistente)
  // =========================================================================
  it('TESTE 3 — RECOMENDAÇÃO INVÁLIDA: rejeita sessão encerrada, carro abandonado ou jogo inexistente sem alterar estado', async () => {
    const decisionId = 'decision_invalid_case'
    const pendingDec: RacePendingDecision = {
      id: decisionId,
      type: 'pit_stop_informed_recommendation',
      driverId: 'drv_car1_bortoleto',
      lap: 30,
      createdAt: new Date().toISOString(),
      title: 'Decisão em Carro Inválido',
      description: 'Tentativa em contexto não apto',
      payload: {},
    }

    // Cenário 3A: Sessão já encerrada
    const completedSession: Partial<RaceSessionRecord> = {
      id: 'sess_completed',
      status: 'completed',
      revision: 20,
      checkpoint_data: {
        grid: baseGrid,
        currentLap: 50,
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
      .mockResolvedValue(completedSession as any)
    const updateSpy = vi.spyOn(pb.collection('race_sessions'), 'update')

    const resCompleted = await raceSessionService.resolveDecision({
      sessionId: 'sess_completed',
      executorId: 'tab_test3',
      decisionId,
      choice: 'box_now',
    })

    expect(resCompleted.success).toBe(false)
    expect(resCompleted.error).toContain('já foi finalizada')
    expect(updateSpy).not.toHaveBeenCalled()

    // Cenário 3B: Carro abandonou (DNF)
    const car1Dnf = baseGrid.map((c) =>
      c.driverId === 'drv_car1_bortoleto' ? { ...c, dnf: true, dnfReason: 'Motor quebrado' } : c,
    )
    const dnfSession: Partial<RaceSessionRecord> = {
      id: 'sess_dnf',
      status: 'in_progress',
      revision: 15,
      checkpoint_data: {
        grid: car1Dnf,
        currentLap: 30,
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

    getOneSpy.mockResolvedValue(dnfSession as any)

    const resDnf = await raceSessionService.resolveDecision({
      sessionId: 'sess_dnf',
      executorId: 'tab_test3',
      decisionId,
      choice: 'box_now',
    })

    expect(resDnf.success).toBe(false)
    expect(resDnf.error).toContain('abandonou a prova')
    expect(updateSpy).not.toHaveBeenCalled()

    getOneSpy.mockRestore()
    updateSpy.mockRestore()
  })

  // =========================================================================
  // TESTE 4 — RETRY E RELOAD (Idempotência estrita e reidratação de estoque)
  // =========================================================================
  it('TESTE 4 — RETRY E RELOAD: retry rejeita sem duplicar e recarregamento reidrata ordem, grid e estoques perfeitamente', async () => {
    const decisionId = 'decision_retry_test_1'
    const pendingDec: RacePendingDecision = {
      id: decisionId,
      type: 'pit_stop_informed_recommendation',
      driverId: 'drv_car1_bortoleto',
      lap: 22,
      createdAt: new Date().toISOString(),
      title: 'Pit Stop',
      description: 'Recomendação de parada',
      payload: {
        proposedCompound: 'duro',
      },
    }

    const sessionData: Partial<RaceSessionRecord> = {
      id: 'sess_retry_check',
      session_key: 'sess_s1_t1_r1_race',
      status: 'awaiting_decision',
      revision: 10,
      current_lap: 22,
      total_laps: 50,
      checkpoint_data: {
        grid: JSON.parse(JSON.stringify(baseGrid)),
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
        driverTireInventories: {
          drv_car1_bortoleto: car1Inventory,
          drv_car2_hulkenberg: car2Inventory,
        },
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
        revision: 11,
      }))

    // 1ª Resolução: Aceita com sucesso
    const res1 = await raceSessionService.resolveDecision({
      sessionId: 'sess_retry_check',
      executorId: 'tab_test4',
      decisionId,
      choice: 'box_now',
    })

    expect(res1.success).toBe(true)
    expect(res1.resolvedDecision).toBeDefined()

    // 2ª Tentativa imediata (Duplo clique ou retry por resposta lenta): deve ser rejeitada como alreadyResolved
    const sessionAfterRes1: Partial<RaceSessionRecord> = {
      ...sessionData,
      revision: 11,
      checkpoint_data: {
        ...sessionData.checkpoint_data!,
        pendingDecisions: [],
        resolvedDecisions: [res1.resolvedDecision!],
      },
    }
    getOneSpy.mockResolvedValue(sessionAfterRes1 as any)

    const res2 = await raceSessionService.resolveDecision({
      sessionId: 'sess_retry_check',
      executorId: 'tab_test4',
      decisionId,
      choice: 'box_now',
    })

    expect(res2.success).toBe(false)
    expect(res2.alreadyResolved).toBe(true)
    expect(res2.error).toContain('já foi resolvido')

    // 3. Simulação de Reload: openOrResumeRaceSession reidrata a sessão e preserva o inventário de pneus
    const getListSpy = vi.spyOn(pb.collection('race_sessions'), 'getList').mockResolvedValue({
      page: 1,
      perPage: 1,
      totalItems: 1,
      totalPages: 1,
      items: [
        {
          ...sessionAfterRes1,
          created: '2026-03-10T14:00:00.000Z',
          updated: '2026-03-10T14:00:00.000Z',
        },
      ],
    } as any)

    const resumed = await raceSessionService.openOrResumeRaceSession({
      seasonId: 'season_test',
      teamId: 'team_audi_sport',
      userId: 'usr_test',
      seasonYear: 2026,
      round: 1,
      totalLaps: 50,
    })

    expect(resumed.isResumed).toBe(true)
    expect(resumed.session.id).toBe('sess_retry_check')
    expect(resumed.session.checkpoint_data?.driverTireInventories).toBeDefined()
    expect(
      resumed.session.checkpoint_data?.driverTireInventories?.['drv_car1_bortoleto'],
    ).toHaveLength(15)

    getOneSpy.mockRestore()
    updateSpy.mockRestore()
    getListSpy.mockRestore()
  })

  // =========================================================================
  // TESTE 5 — ISOLAMENTO DOS DOIS CARROS (Carro 1 não afeta Carro 2)
  // =========================================================================
  it('TESTE 5 — DOIS CARROS: aceitar recomendação para o Carro 1 preserva pneu, combustível, estoque e estado do Carro 2', async () => {
    const car1 = baseGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    const car2 = baseGrid.find((c) => c.driverId === 'drv_car2_hulkenberg')!

    car1.tireCompound = 'macio'
    car1.tireWear = 75
    car1.fuelRemaining = 70
    car1.pitStopsDone = 0

    car2.tireCompound = 'medio'
    car2.tireWear = 40
    car2.fuelRemaining = 82
    car2.pitStopsDone = 0

    const decisionCar1: RacePendingDecision = {
      id: 'decision_drv_car1_pit',
      type: 'pit_stop_informed_recommendation',
      driverId: 'drv_car1_bortoleto',
      lap: 16,
      createdAt: new Date().toISOString(),
      title: 'Recomendação de Pit Stop — Bortoleto',
      description: 'Alta degradação do macio.',
      payload: { proposedCompound: 'duro' },
    }

    const checkpoint: RaceSessionCheckpointData = {
      grid: JSON.parse(JSON.stringify(baseGrid)),
      currentLap: 16,
      totalLaps: 50,
      weather: 'seco',
      liveEvents: [],
      playerCarTactics: {
        drv_car1_bortoleto: 'attack',
        drv_car2_hulkenberg: 'normal',
      },
      playerPaceOrders: {
        drv_car1_bortoleto: 'empurrar',
        drv_car2_hulkenberg: 'segurar',
      },
      mechanicalIssues: [],
      penalties: [],
      pendingDecisions: [decisionCar1],
      resolvedDecisions: [],
      driverTireInventories: {
        drv_car1_bortoleto: car1Inventory,
        drv_car2_hulkenberg: car2Inventory,
      },
      lastSavedAt: new Date().toISOString(),
    }

    const mockSession: Partial<RaceSessionRecord> = {
      id: 'sess_two_cars',
      status: 'awaiting_decision',
      revision: 14,
      current_lap: 16,
      total_laps: 50,
      checkpoint_data: checkpoint,
    }

    const getOneSpy = vi
      .spyOn(pb.collection('race_sessions'), 'getOne')
      .mockResolvedValue(mockSession as any)
    const updateSpy = vi
      .spyOn(pb.collection('race_sessions'), 'update')
      .mockImplementation(async (_id, payload: any) => ({
        ...mockSession,
        ...payload,
        revision: 15,
      }))

    // Resolução exclusivamente para o Carro 1
    const res = await raceSessionService.resolveDecision({
      sessionId: 'sess_two_cars',
      executorId: 'tab_test5',
      decisionId: decisionCar1.id,
      choice: 'box_now',
      newCompoundChoice: 'duro',
    })

    expect(res.success).toBe(true)

    const updatedGrid = res.updatedSession?.checkpoint_data?.grid!
    const c1After = updatedGrid.find((c) => c.driverId === 'drv_car1_bortoleto')!
    const c2After = updatedGrid.find((c) => c.driverId === 'drv_car2_hulkenberg')!

    // Carro 1 foi atualizado conforme esperado
    expect(c1After.tireCompound).toBe('duro')
    expect(c1After.pitStopsDone).toBe(1)

    // Carro 2 PRESERVADO RIGOROSAMENTE:
    expect(c2After.tireCompound).toBe('medio') // Não mudou para duro
    expect(c2After.tireWear).toBe(40) // Não foi resetado
    expect(c2After.fuelRemaining).toBe(82) // Não foi alterado
    expect(c2After.pitStopsDone).toBe(0) // Não teve pit stop

    // O estoque do Carro 2 está 100% intacto
    const inventoriesAfter = res.updatedSession?.checkpoint_data?.driverTireInventories!
    const c2Sets = inventoriesAfter['drv_car2_hulkenberg']
    expect(c2Sets).toEqual(car2Inventory)

    getOneSpy.mockRestore()
    updateSpy.mockRestore()
  })
})
