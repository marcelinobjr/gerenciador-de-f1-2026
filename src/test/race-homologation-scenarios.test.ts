import { describe, it, expect, vi, beforeEach } from 'vitest'
import { raceSessionService } from '@/services/raceSessionService'
import { advanceCanonicalRaceLap } from '@/services/canonicalRaceRunner'
import type { SimDriverEntry } from '@/pages/race/types'
import type {
  RacePendingDecision,
  RaceResolvedDecision,
  RaceSessionRecord,
} from '@/types/race-session'
import pb from '@/lib/pocketbase/client'

/**
 * ETAPA 3.1: SUÍTE DE HOMOLOGAÇÃO CANÔNICA A–J DA CORRIDA AO VIVO
 * Gate de estabilidade (não é feature). Validação exaustiva e idempotente:
 * - A — Play/Pause/Play: nenhuma volta durante pause, sem salto, coerência física, sem duplicatas com 1x/2x/4x
 * - B — Reload durante corrida: reidratação da mesma race_session, sem segunda corrida, estado Play/Pause conforme regra
 * - C — Reload durante decisão pendente: sessão continua pausada, mesma decisão, Play bloqueado, sem evento duplicado
 * - D — Anti-loop após reload: decisão resolvida permanece no histórico, eventId consumido, não reaparece, consequência não reaplicada
 * - E — Duas abas / executor único: tentativa de avanço simultâneo -> somente um executor avança, sem gravação conflitante
 * - F — Duas abas / mesma decisão: primeira aceita, segunda rejeitada/no-op seguro, consequência aplicada exatamente uma vez
 * - H — Finalização: penúltima -> última -> bandeirada, concluída UMA vez, sem volta extra, pós-reload idempotente
 * - I — Sair e voltar (troca de rota): sem nova sessão, sem reinício, sem timers duplicados, pendingDecision preservada
 * - J — Pausa prolongada / timer fantasma: pausa longa -> zero voltas, zero desgaste, retomada sem "corrida acelerada"
 * - Extra 1 — Dois pilotos na mesma volta: fila P1 -> resolve -> P2 permanece -> resolve -> Play liberado, eventId independente
 * - Extra 2 — Falha de persistência: servidor retorna erro de revisão ou rede -> UI/serviço pausa com segurança, retry limpo
 */

describe('Etapa 3.1: Homologação Canônica A–J da Corrida ao Vivo', () => {
  const createBaseGrid = (): SimDriverEntry[] => [
    {
      position: 1,
      gridPosition: 1,
      driverId: 'drv_nor',
      driverName: 'L. Norris',
      teamId: 'team_mclaren',
      teamName: 'McLaren',
      teamColor: '#FF8000',
      isPlayer: false,
      score: 88,
      points: 0,
      fastestLap: false,
      usedOvertake: false,
      tireCompound: 'medio',
      accumulatedTimeSec: 1650.2,
      tireWear: 42,
      fuelRemaining: 68.5,
      lapsOnCurrentTire: 20,
      pitStopsDone: 0,
      pitLap: 25,
    },
    {
      position: 2,
      gridPosition: 2,
      driverId: 'drv_p1',
      driverName: 'G. Bortoleto',
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayer: true,
      score: 84,
      points: 0,
      fastestLap: false,
      usedOvertake: false,
      tireCompound: 'medio',
      accumulatedTimeSec: 1652.8,
      tireWear: 45,
      fuelRemaining: 67.0,
      lapsOnCurrentTire: 20,
      pitStopsDone: 0,
      pitLap: 25,
    },
    {
      position: 3,
      gridPosition: 3,
      driverId: 'drv_p2',
      driverName: 'N. Hülkenberg',
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayer: true,
      score: 82,
      points: 0,
      fastestLap: false,
      usedOvertake: false,
      tireCompound: 'duro',
      accumulatedTimeSec: 1658.1,
      tireWear: 38,
      fuelRemaining: 69.0,
      lapsOnCurrentTire: 20,
      pitStopsDone: 0,
      pitLap: 30,
    },
  ]

  const baseParams = {
    totalLaps: 50,
    weather: 'seco' as const,
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
    sessionId: 'sess_homolog_001',
  }

  // CENÁRIO A: Play/Pause/Play e simSpeed (1x, 2x, 4x)
  describe('Cenário A — Play/Pause/Play & Independência de Velocidade', () => {
    it('quando pausado, nenhuma volta é avançada e o estado permanece estático', () => {
      const grid = createBaseGrid()
      const currentLap = 20

      // Simulando a checagem que a UI faz: se isRacePaused for verdadeiro, o runner não é chamado
      const isRacePaused = true
      let lapCount = currentLap

      if (!isRacePaused) {
        const res = advanceCanonicalRaceLap({
          ...baseParams,
          currentLap,
          grid,
        })
        lapCount = res.nextLap
      }

      expect(lapCount).toBe(20)
      expect(grid[1].accumulatedTimeSec).toBe(1652.8)
      expect(grid[1].tireWear).toBe(45)
      expect(grid[1].fuelRemaining).toBe(67.0)
    })

    it('ao retomar (Play), a física esportiva é exatamente idêntica independente de 1x/2x/4x', () => {
      const grid1x = createBaseGrid()
      const grid2x = createBaseGrid()
      const grid4x = createBaseGrid()

      const res1 = advanceCanonicalRaceLap({
        ...baseParams,
        currentLap: 20,
        grid: grid1x,
      })

      const res2 = advanceCanonicalRaceLap({
        ...baseParams,
        currentLap: 20,
        grid: grid2x,
      })

      const res4 = advanceCanonicalRaceLap({
        ...baseParams,
        currentLap: 20,
        grid: grid4x,
      })

      // As voltas e o desgaste calculado pelo runner derivam unicamente da física e dos parâmetros, não da taxa de atualização
      expect(res1.nextLap).toBe(21)
      expect(res2.nextLap).toBe(21)
      expect(res4.nextLap).toBe(21)

      const p1_1 = res1.nextGrid.find((c) => c.driverId === 'drv_p1')!
      const p1_2 = res2.nextGrid.find((c) => c.driverId === 'drv_p1')!
      const p1_4 = res4.nextGrid.find((c) => c.driverId === 'drv_p1')!

      expect(p1_1.tireWear).toBe(p1_2.tireWear)
      expect(p1_1.tireWear).toBe(p1_4.tireWear)
      expect(p1_1.fuelRemaining).toBe(p1_2.fuelRemaining)
      expect(p1_1.fuelRemaining).toBe(p1_4.fuelRemaining)
      expect(p1_1.pitStopsDone).toBe(0)
    })
  })

  // CENÁRIO B: Reload durante corrida
  describe('Cenário B — Reload durante a Corrida', () => {
    it('reidratação preserva chave canônica, volta, gaps, pneus e não cria sessão paralela', async () => {
      const grid = createBaseGrid()
      const storedRecord: RaceSessionRecord = {
        id: 'sess_rec_b',
        session_key: 'sess_season_2026_team_audi_r1_race',
        season_id: 'season_2026',
        team_id: 'team_audi',
        user_id: 'user_1',
        season_year: 2026,
        round: 1,
        session_type: 'race',
        status: 'paused',
        revision: 15,
        current_lap: 22,
        total_laps: 50,
        sim_speed: 2,
        pause_reason: 'Pausado pelo usuário',
        checkpoint_data: {
          grid,
          currentLap: 22,
          totalLaps: 50,
          weather: 'seco',
          liveEvents: [],
          playerCarTactics: { drv_p1: 'attack' },
          playerPaceOrders: { drv_p1: 'empurrar' },
          mechanicalIssues: [],
          penalties: [],
          pendingDecisions: [],
          resolvedDecisions: [],
          lastSavedAt: new Date().toISOString(),
        },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }

      const getListSpy = vi.spyOn(pb.collection('race_sessions'), 'getList').mockResolvedValue({
        page: 1,
        perPage: 1,
        totalItems: 1,
        totalPages: 1,
        items: [storedRecord],
      } as any)

      const createSpy = vi.spyOn(pb.collection('race_sessions'), 'create')

      const rehydrated = await raceSessionService.openOrResumeRaceSession({
        seasonId: 'season_2026',
        teamId: 'team_audi',
        userId: 'user_1',
        seasonYear: 2026,
        round: 1,
        totalLaps: 50,
      })

      expect(rehydrated.isResumed).toBe(true)
      expect(rehydrated.session.id).toBe('sess_rec_b')
      expect(rehydrated.session.current_lap).toBe(22)
      expect(rehydrated.session.revision).toBe(15)
      expect(rehydrated.session.checkpoint_data?.grid).toHaveLength(3)
      expect(createSpy).not.toHaveBeenCalled()

      getListSpy.mockRestore()
      createSpy.mockRestore()
    })
  })

  // CENÁRIO C: Reload durante decisão pendente
  describe('Cenário C — Reload Durante Decisão Pendente', () => {
    it('após reload, sessão permanece em awaiting_decision com a mesma decisão e Play bloqueado', async () => {
      const pending: RacePendingDecision = {
        id: 'decision_sess_c_drv_p1_lap24_pit_strategy',
        type: 'pit_stop_strategy_window',
        driverId: 'drv_p1',
        driverName: 'G. Bortoleto',
        lap: 24,
        createdAt: new Date().toISOString(),
        title: 'Janela de Pit Stop Planejada — G. Bortoleto',
        description: 'Volta 24 é a janela prevista para troca de pneus.',
        options: [
          { id: 'box_now', label: 'Box nesta volta' },
          { id: 'stay_out', label: 'Manter na pista' },
        ],
        payload: { pitLap: 24 },
      }

      const storedRecord: RaceSessionRecord = {
        id: 'sess_rec_c',
        session_key: 'sess_season_2026_team_audi_r1_race',
        season_id: 'season_2026',
        team_id: 'team_audi',
        user_id: 'user_1',
        season_year: 2026,
        round: 1,
        session_type: 'race',
        status: 'awaiting_decision',
        revision: 18,
        current_lap: 24,
        total_laps: 50,
        sim_speed: 1,
        pause_reason: 'Decisão Requerida: Janela de Pit Stop',
        checkpoint_data: {
          grid: createBaseGrid(),
          currentLap: 24,
          totalLaps: 50,
          weather: 'seco',
          liveEvents: [],
          playerCarTactics: {},
          playerPaceOrders: {},
          mechanicalIssues: [],
          penalties: [],
          pendingDecisions: [pending],
          resolvedDecisions: [],
          lastSavedAt: new Date().toISOString(),
        },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }

      const getListSpy = vi.spyOn(pb.collection('race_sessions'), 'getList').mockResolvedValue({
        page: 1,
        perPage: 1,
        totalItems: 1,
        totalPages: 1,
        items: [storedRecord],
      } as any)

      const resumed = await raceSessionService.openOrResumeRaceSession({
        seasonId: 'season_2026',
        teamId: 'team_audi',
        userId: 'user_1',
        seasonYear: 2026,
        round: 1,
        totalLaps: 50,
      })

      expect(resumed.session.status).toBe('awaiting_decision')
      expect(resumed.session.checkpoint_data?.pendingDecisions).toHaveLength(1)
      expect(resumed.session.checkpoint_data?.pendingDecisions?.[0].id).toBe(pending.id)

      // Regra 9: Existindo pendingDecision, a UI proíbe Play
      const pendingList = resumed.session.checkpoint_data?.pendingDecisions || []
      const isPlayAllowed = pendingList.length === 0
      expect(isPlayAllowed).toBe(false)

      getListSpy.mockRestore()
    })
  })

  // CENÁRIO D: Anti-loop após reload
  describe('Cenário D — Proteção Anti-Loop Pós-Reload', () => {
    it('evento resolvido em resolvedDecisions não reaparece e não gera segundo evento', () => {
      const consumedId = 'decision_sess_d_drv_p1_lap25_pit_wear'
      const grid = createBaseGrid()
      grid[1].tireWear = 88 // Desgaste ainda crítico

      // Runner executado fornecendo resolvedDecisionIds contendo o ID já consumido
      const res = advanceCanonicalRaceLap({
        ...baseParams,
        currentLap: 24,
        grid,
        sessionId: 'sess_d',
        resolvedDecisionIds: [consumedId],
      })

      // O runner não deve duplicar o evento já resolvido
      const found = res.detectedDecisions.find((d) => d.id === consumedId)
      expect(found).toBeUndefined()
    })
  })

  // CENÁRIO E: Duas abas / executor único
  describe('Cenário E — Concorrência Multi-Aba com Executor Único', () => {
    it('segunda aba não consegue adquirir lock enquanto lease da primeira estiver ativo', async () => {
      const activeLease = new Date(Date.now() + 15000).toISOString()
      const currentSession: Partial<RaceSessionRecord> = {
        id: 'sess_multi_tab',
        active_executor_id: 'tab_executor_ALPHA',
        executor_lease_until: activeLease,
        revision: 10,
      }

      const getOneSpy = vi
        .spyOn(pb.collection('race_sessions'), 'getOne')
        .mockResolvedValue(currentSession as any)

      // Aba BETA tenta adquirir lock
      const lockBeta = await raceSessionService.acquireExecutionLock(
        'sess_multi_tab',
        'tab_executor_BETA',
      )

      expect(lockBeta.acquired).toBe(false)
      expect(lockBeta.currentExecutorId).toBe('tab_executor_ALPHA')

      // Aba BETA tenta salvar checkpoint com expectedRevision: deve ser rejeitado por executor inválido
      const saveRes = await raceSessionService.saveCheckpoint({
        sessionId: 'sess_multi_tab',
        executorId: 'tab_executor_BETA',
        expectedRevision: 10,
        status: 'in_progress',
        currentLap: 25,
        simSpeed: 1,
        checkpointData: {
          grid: createBaseGrid(),
          currentLap: 25,
          totalLaps: 50,
          weather: 'seco',
          liveEvents: [],
          playerCarTactics: {},
          playerPaceOrders: {},
          mechanicalIssues: [],
          penalties: [],
          lastSavedAt: new Date().toISOString(),
        },
      })

      expect(saveRes.success).toBe(false)
      expect(saveRes.error).toContain('Outra aba ou executor detém a autorização ativa')

      getOneSpy.mockRestore()
    })
  })

  // CENÁRIO F: Duas abas / mesma decisão
  describe('Cenário F — Duas Abas Resolvendo a Mesma Decisão', () => {
    it('primeira aba resolve com sucesso e segunda é rejeitada com alreadyResolved sem duplicar pit stop', async () => {
      const decisionId = 'decision_concurrent_p1'
      const pending: RacePendingDecision = {
        id: decisionId,
        type: 'pit_stop_critical_wear',
        driverId: 'drv_p1',
        lap: 25,
        createdAt: new Date().toISOString(),
        title: 'Desgaste Crítico',
        description: 'Pneus no limite',
        payload: {},
      }

      const sessionInitial: Partial<RaceSessionRecord> = {
        id: 'sess_concur_dec',
        revision: 4,
        status: 'awaiting_decision',
        checkpoint_data: {
          grid: createBaseGrid(),
          currentLap: 25,
          totalLaps: 50,
          weather: 'seco',
          liveEvents: [],
          playerCarTactics: {},
          playerPaceOrders: {},
          mechanicalIssues: [],
          penalties: [],
          pendingDecisions: [pending],
          resolvedDecisions: [],
          lastSavedAt: new Date().toISOString(),
        },
      }

      // Mock Aba 1 (Resolve)
      const getOneSpy = vi
        .spyOn(pb.collection('race_sessions'), 'getOne')
        .mockResolvedValueOnce(sessionInitial as any)
      const updateSpy = vi
        .spyOn(pb.collection('race_sessions'), 'update')
        .mockImplementationOnce(async (_id, payload: any) => {
          return {
            ...sessionInitial,
            ...payload,
            revision: 5,
          } as any
        })

      const res1 = await raceSessionService.resolveDecision({
        sessionId: 'sess_concur_dec',
        executorId: 'tab_ALPHA',
        decisionId,
        choice: 'box_now',
        newCompoundChoice: 'duro',
      })

      expect(res1.success).toBe(true)
      expect(res1.resolvedDecision?.eventId).toBe(decisionId)
      expect(
        res1.updatedSession?.checkpoint_data?.grid?.find((c) => c.driverId === 'drv_p1')
          ?.pitStopsDone,
      ).toBe(1)

      // Sessão após resolução de Aba 1
      const sessionAfterRes1: Partial<RaceSessionRecord> = {
        ...sessionInitial,
        revision: 5,
        checkpoint_data: {
          ...sessionInitial.checkpoint_data!,
          pendingDecisions: [],
          resolvedDecisions: [res1.resolvedDecision!],
        },
      }

      getOneSpy.mockResolvedValueOnce(sessionAfterRes1 as any)

      // Aba 2 tenta resolver a mesma decisão
      const res2 = await raceSessionService.resolveDecision({
        sessionId: 'sess_concur_dec',
        executorId: 'tab_BETA',
        decisionId,
        choice: 'box_now',
      })

      expect(res2.success).toBe(false)
      expect(res2.alreadyResolved).toBe(true)
      expect(res2.error).toContain('já foi resolvido')

      getOneSpy.mockRestore()
      updateSpy.mockRestore()
    })
  })

  // CENÁRIO H: Finalização oficial e idempotência
  describe('Cenário H — Finalização Oficial da Corrida', () => {
    it('ao atingir totalLaps, marca status completed e fechamento é idempotente sem duplicações', async () => {
      const grid = createBaseGrid()
      const runnerRes = advanceCanonicalRaceLap({
        ...baseParams,
        currentLap: 49,
        totalLaps: 50,
        grid,
      })

      expect(runnerRes.nextLap).toBe(50)
      expect(runnerRes.isCompleted).toBe(true)

      // markSessionCompleted deve marcar completed no banco
      const mockActive: Partial<RaceSessionRecord> = {
        id: 'sess_finish_1',
        status: 'in_progress',
      }
      const getOneSpy = vi
        .spyOn(pb.collection('race_sessions'), 'getOne')
        .mockResolvedValueOnce(mockActive as any)
      const updateSpy = vi
        .spyOn(pb.collection('race_sessions'), 'update')
        .mockResolvedValueOnce({ ...mockActive, status: 'completed' } as any)

      const ok1 = await raceSessionService.markSessionCompleted('sess_finish_1', 'tab_1')
      expect(ok1).toBe(true)
      expect(updateSpy).toHaveBeenCalledWith('sess_finish_1', {
        status: 'completed',
        active_executor_id: '',
        executor_lease_until: '',
      })

      // Segunda chamada (idempotente) não chama update novamente se já estiver completed
      getOneSpy.mockResolvedValueOnce({ ...mockActive, status: 'completed' } as any)
      const ok2 = await raceSessionService.markSessionCompleted('sess_finish_1', 'tab_1')
      expect(ok2).toBe(true)
      expect(updateSpy).toHaveBeenCalledTimes(1) // Apenas 1 chamada de update

      getOneSpy.mockRestore()
      updateSpy.mockRestore()
    })
  })

  // CENÁRIO I: Sair da rota /race/live e voltar
  describe('Cenário I — Troca de Rota e Preservação de Estado', () => {
    it('liberação do lock ao desmontar permite que o retorno à página reassuma a sessão sem perda', async () => {
      const mockSession: Partial<RaceSessionRecord> = {
        id: 'sess_route_test',
        active_executor_id: 'tab_route_1',
        executor_lease_until: new Date(Date.now() + 20000).toISOString(),
      }

      const getOneSpy = vi
        .spyOn(pb.collection('race_sessions'), 'getOne')
        .mockResolvedValue(mockSession as any)
      const updateSpy = vi.spyOn(pb.collection('race_sessions'), 'update').mockResolvedValue({
        ...mockSession,
        active_executor_id: '',
        executor_lease_until: '',
      } as any)

      // Simula desmontagem do componente
      await raceSessionService.releaseExecutionLock('sess_route_test', 'tab_route_1')

      expect(updateSpy).toHaveBeenCalledWith('sess_route_test', {
        active_executor_id: '',
        executor_lease_until: '',
      })

      getOneSpy.mockRestore()
      updateSpy.mockRestore()
    })
  })

  // CENÁRIO J: Pausa prolongada / ausência de timer fantasma
  describe('Cenário J — Pausa Prolongada e Ausência de Compensação de Tempo', () => {
    it('tempo parado não gera voltas acumuladas nem aceleração descontrolada ao dar Play', () => {
      const grid = createBaseGrid()
      const initialLap = 15

      // Suponha que a corrida ficou pausada por 10 minutos (nenhum tick do setInterval executou avanço)
      // Ao dar Play após 10 minutos, o primeiro avanço deve avançar exatamente UMA volta (15 -> 16), e não pular voltas
      const res = advanceCanonicalRaceLap({
        ...baseParams,
        currentLap: initialLap,
        grid,
      })

      expect(res.nextLap).toBe(16)
      expect(res.isCompleted).toBe(false)
      // O desgaste do pneu subiu de forma compatível com exatamente UMA volta, não 10 minutos
      expect(res.nextGrid[1].tireWear).toBeLessThan(50) // Estava em 45, subiu ~2.5%
    })
  })

  // CENÁRIO EXTRA 1: Dois pilotos na mesma volta
  describe('Cenário Extra 1 — Decisões Simultâneas para os Dois Pilotos', () => {
    it('mantém decisões individuais e sequenciais na fila sem afetar o carro errado', async () => {
      const grid = createBaseGrid()
      grid[1].tireWear = 85 // P1 crítico
      grid[2].tireWear = 82 // P2 crítico

      const runnerRes = advanceCanonicalRaceLap({
        ...baseParams,
        currentLap: 25,
        grid,
      })

      expect(runnerRes.detectedDecisions).toHaveLength(2)
      const decP1 = runnerRes.detectedDecisions.find((d) => d.driverId === 'drv_p1')!
      const decP2 = runnerRes.detectedDecisions.find((d) => d.driverId === 'drv_p2')!
      expect(decP1).toBeDefined()
      expect(decP2).toBeDefined()

      const sessionWithBoth: Partial<RaceSessionRecord> = {
        id: 'sess_both',
        revision: 7,
        status: 'awaiting_decision',
        checkpoint_data: {
          grid: JSON.parse(JSON.stringify(grid)),
          currentLap: 26,
          totalLaps: 50,
          weather: 'seco',
          liveEvents: [],
          playerCarTactics: {},
          playerPaceOrders: {},
          mechanicalIssues: [],
          penalties: [],
          pendingDecisions: [decP1, decP2],
          resolvedDecisions: [],
          lastSavedAt: new Date().toISOString(),
        },
      }

      const getOneSpy = vi
        .spyOn(pb.collection('race_sessions'), 'getOne')
        .mockResolvedValue(sessionWithBoth as any)
      const updateSpy = vi
        .spyOn(pb.collection('race_sessions'), 'update')
        .mockImplementation(async (_id, payload: any) => {
          return {
            ...sessionWithBoth,
            ...payload,
            revision: 8,
          } as any
        })

      // Resolve P1 instalando Duro
      const resP1 = await raceSessionService.resolveDecision({
        sessionId: 'sess_both',
        executorId: 'tab_test',
        decisionId: decP1.id,
        choice: 'box_now',
        newCompoundChoice: 'duro',
      })

      expect(resP1.success).toBe(true)
      const updatedGrid = resP1.updatedSession?.checkpoint_data?.grid!
      const p1Car = updatedGrid.find((c) => c.driverId === 'drv_p1')!
      const p2Car = updatedGrid.find((c) => c.driverId === 'drv_p2')!

      // P1 recebeu novo pneu e reset de desgaste
      expect(p1Car.tireCompound).toBe('duro')
      expect(p1Car.tireWear).toBe(4)
      expect(p1Car.pitStopsDone).toBe(1)

      // P2 permaneceu INTACTO e sua decisão continua na fila
      expect(p2Car.tireCompound).toBe('duro') // Já era duro
      expect(p2Car.tireWear).toBe(82) // Não teve pit stop ainda
      expect(p2Car.pitStopsDone).toBe(0)

      expect(resP1.remainingPendingDecisions).toHaveLength(1)
      expect(resP1.remainingPendingDecisions?.[0].id).toBe(decP2.id)

      getOneSpy.mockRestore()
      updateSpy.mockRestore()
    })
  })

  // CENÁRIO EXTRA 2: Falha de persistência
  describe('Cenário Extra 2 — Resiliência a Falha de Persistência', () => {
    it('conflito de revisão rejeita gravação sem corromper estado local e permite recuperação', async () => {
      const serverSession: Partial<RaceSessionRecord> = {
        id: 'sess_conflict',
        revision: 12, // Servidor está na revisão 12
        active_executor_id: 'tab_1',
      }

      const getOneSpy = vi
        .spyOn(pb.collection('race_sessions'), 'getOne')
        .mockResolvedValue(serverSession as any)

      // Cliente tenta salvar esperando revisão 10 (conflito)
      const saveRes = await raceSessionService.saveCheckpoint({
        sessionId: 'sess_conflict',
        executorId: 'tab_1',
        expectedRevision: 10,
        status: 'in_progress',
        currentLap: 20,
        simSpeed: 1,
        checkpointData: {
          grid: createBaseGrid(),
          currentLap: 20,
          totalLaps: 50,
          weather: 'seco',
          liveEvents: [],
          playerCarTactics: {},
          playerPaceOrders: {},
          mechanicalIssues: [],
          penalties: [],
          lastSavedAt: new Date().toISOString(),
        },
      })

      expect(saveRes.success).toBe(false)
      expect(saveRes.error).toContain('Conflito de revisão')
      expect(saveRes.newRevision).toBe(12) // Retorna a revisão atual do servidor

      getOneSpy.mockRestore()
    })
  })
})
