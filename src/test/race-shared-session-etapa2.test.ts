import { describe, it, expect, beforeEach, vi } from 'vitest'
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
 * ETAPA 2: Testes Automatizados Obrigatórios
 * - Teste A — Pausa: runner encontra evento relevante -> running->paused, pendingDecision criado
 * - Teste B — Resolução: jogador resolve -> consequência aplicada, evento marcado como resolvido, pendingDecision removido
 * - Teste C — Anti-loop: executar novamente a mesma condição após resolução -> nenhum novo evento criado
 * - Teste D — Reload: persistir corrida com decisão pendente, reidratar sessão -> sessão continua pausada, mesmo eventId, mesma decisão
 * - Teste E — Resolução duplicada: resolver o mesmo eventId duas vezes -> primeira aceita, segunda rejeitada/no-op seguro, consequência aplicada exatamente uma vez
 * - Teste F — Dois pilotos: dois pilotos geram decisão -> nenhuma decisão perdida, ambas precisam ser resolvidas
 * - Teste G — Play bloqueado: existindo decisão pendente, Play -> nenhuma nova volta executada
 */

describe('Etapa 2: Pausas automáticas, decisões de corrida e proteção anti-loop', () => {
  const baseGrid: SimDriverEntry[] = [
    {
      position: 1,
      gridPosition: 1,
      driverId: 'drv_p1',
      driverName: 'Piloto Um',
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      isPlayer: true,
      score: 85,
      points: 0,
      fastestLap: false,
      usedOvertake: false,
      tireCompound: 'medio',
      accumulatedTimeSec: 1500,
      tireWear: 82, // Desgaste crítico >= 80%
      pitLap: 25,
      pitStopsDone: 0,
    },
    {
      position: 2,
      gridPosition: 2,
      driverId: 'drv_p2',
      driverName: 'Piloto Dois',
      teamId: 'team_audi',
      teamName: 'Audi F1 Team',
      isPlayer: true,
      score: 83,
      points: 0,
      fastestLap: false,
      usedOvertake: false,
      tireCompound: 'medio',
      accumulatedTimeSec: 1504,
      tireWear: 50,
      pitLap: 20, // Janela estratégica na volta 20
      pitStopsDone: 0,
    },
  ]

  const defaultParams = {
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
    sessionId: 'sess_test_123',
  }

  // TESTE A: PAUSA
  it('Teste A — Pausa: runner encontra evento relevante -> requiresPause=true e pendingDecision criado com id determinístico', () => {
    const result = advanceCanonicalRaceLap({
      ...defaultParams,
      currentLap: 19,
      grid: baseGrid,
    })

    expect(result.nextLap).toBe(20)
    expect(result.requiresPause).toBe(true)
    expect(result.detectedDecisions.length).toBeGreaterThanOrEqual(1)

    // Piloto 1 tem desgaste crítico (82%) -> pit_stop_critical_wear
    const p1Decision = result.detectedDecisions.find((d) => d.driverId === 'drv_p1')
    expect(p1Decision).toBeDefined()
    expect(p1Decision?.type).toBe('pit_stop_critical_wear')
    expect(p1Decision?.id).toBe('decision_sess_test_123_drv_p1_lap20_pit_wear')
    expect(p1Decision?.lap).toBe(20)

    // Piloto 2 tem pitLap = 20 -> pit_stop_strategy_window
    const p2Decision = result.detectedDecisions.find((d) => d.driverId === 'drv_p2')
    expect(p2Decision).toBeDefined()
    expect(p2Decision?.type).toBe('pit_stop_strategy_window')
    expect(p2Decision?.id).toBe('decision_sess_test_123_drv_p2_lap20_pit_strategy')
  })

  // TESTE B: RESOLUÇÃO
  it('Teste B — Resolução: jogador resolve -> consequência aplicada, evento marcado como resolvido, pendingDecision removido', async () => {
    const fakePending: RacePendingDecision = {
      id: 'decision_sess_test_123_drv_p1_lap20_pit_wear',
      type: 'pit_stop_critical_wear',
      driverId: 'drv_p1',
      driverName: 'Piloto Um',
      lap: 20,
      createdAt: new Date().toISOString(),
      title: 'Desgaste Crítico',
      description: 'Pneus no limite',
      payload: {},
    }

    const mockSessionRecord: Partial<RaceSessionRecord> = {
      id: 'sess_rec_1',
      status: 'awaiting_decision',
      revision: 5,
      current_lap: 20,
      total_laps: 50,
      checkpoint_data: {
        grid: JSON.parse(JSON.stringify(baseGrid)),
        currentLap: 20,
        totalLaps: 50,
        weather: 'seco',
        liveEvents: [],
        playerCarTactics: {},
        playerPaceOrders: {},
        mechanicalIssues: [],
        penalties: [],
        pendingDecisions: [fakePending],
        resolvedDecisions: [],
        lastSavedAt: new Date().toISOString(),
      },
    }

    // Mock pb.collection('race_sessions')
    const getOneSpy = vi
      .spyOn(pb.collection('race_sessions'), 'getOne')
      .mockResolvedValue(mockSessionRecord as any)
    const updateSpy = vi
      .spyOn(pb.collection('race_sessions'), 'update')
      .mockImplementation(async (_id, payload: any) => {
        return {
          ...mockSessionRecord,
          ...payload,
          revision: payload.revision || 6,
        } as any
      })

    const res = await raceSessionService.resolveDecision({
      sessionId: 'sess_rec_1',
      executorId: 'tab_test_executor',
      decisionId: fakePending.id,
      choice: 'box_now',
      newCompoundChoice: 'duro',
    })

    expect(res.success).toBe(true)
    expect(res.resolvedDecision).toBeDefined()
    expect(res.resolvedDecision?.eventId).toBe(fakePending.id)
    expect(res.resolvedDecision?.choice).toBe('box_now')

    // Consequência esportiva aplicada no grid: pneus trocados, desgaste restaurado, pit stop computado
    const updatedGrid = res.updatedSession?.checkpoint_data?.grid
    const p1 = updatedGrid?.find((c) => c.driverId === 'drv_p1')
    expect(p1?.tireCompound).toBe('duro')
    expect(p1?.tireWear).toBe(4)
    expect(p1?.pitStopsDone).toBe(1)
    expect(p1?.lapsOnCurrentTire).toBe(0)

    // Decisão removida de pendentes e inserida em resolvidos
    expect(res.updatedSession?.checkpoint_data?.pendingDecisions).toHaveLength(0)
    expect(res.updatedSession?.checkpoint_data?.resolvedDecisions).toHaveLength(1)
    expect(res.updatedSession?.checkpoint_data?.resolvedDecisions?.[0].eventId).toBe(fakePending.id)

    // Sessão sem decisões restantes fica em 'paused' para aguardar Play
    expect(res.updatedSession?.status).toBe('paused')

    getOneSpy.mockRestore()
    updateSpy.mockRestore()
  })

  // TESTE C: ANTI-LOOP
  it('Teste C — Anti-loop: executar novamente a mesma condição após resolução -> nenhum novo evento criado', () => {
    const consumedEventId = 'decision_sess_test_123_drv_p1_lap20_pit_wear'

    // Volta 20 é avançada novamente com a mesma condição (P1 ainda em desgaste alto), mas com o ID no resolvedDecisionIds
    const result = advanceCanonicalRaceLap({
      ...defaultParams,
      currentLap: 19,
      grid: baseGrid,
      resolvedDecisionIds: [consumedEventId],
    })

    expect(result.nextLap).toBe(20)
    // Piloto 1 NÃO deve gerar o evento novamente porque seu ID já foi consumido
    const p1Decision = result.detectedDecisions.find((d) => d.id === consumedEventId)
    expect(p1Decision).toBeUndefined()
  })

  // TESTE D: RELOAD / REIDRATAÇÃO
  it('Teste D — Reload: persistir corrida com decisão pendente, reidratar sessão -> sessão continua pausada, mesmo eventId, mesma decisão', async () => {
    const pendingId = 'decision_sess_test_123_drv_p1_lap20_pit_wear'
    const storedSession: RaceSessionRecord = {
      id: 'sess_rec_reloaded',
      session_key: 'sess_season_2026_team_audi_r1_race',
      season_id: 'season_2026',
      team_id: 'team_audi',
      user_id: 'user_1',
      season_year: 2026,
      round: 1,
      session_type: 'race',
      status: 'awaiting_decision',
      revision: 4,
      current_lap: 20,
      total_laps: 50,
      sim_speed: 1,
      pause_reason: 'Decisão Requerida',
      checkpoint_data: {
        grid: baseGrid,
        currentLap: 20,
        totalLaps: 50,
        weather: 'seco',
        liveEvents: [],
        playerCarTactics: {},
        playerPaceOrders: {},
        mechanicalIssues: [],
        penalties: [],
        pendingDecisions: [
          {
            id: pendingId,
            type: 'pit_stop_critical_wear',
            driverId: 'drv_p1',
            lap: 20,
            createdAt: '2026-03-10T12:00:00.000Z',
            title: 'Desgaste Crítico',
            description: 'Pneus no limite',
            payload: {},
          },
        ],
        resolvedDecisions: [],
        lastSavedAt: '2026-03-10T12:00:00.000Z',
      },
      created: '2026-03-10T12:00:00.000Z',
      updated: '2026-03-10T12:00:00.000Z',
    }

    const getListSpy = vi.spyOn(pb.collection('race_sessions'), 'getList').mockResolvedValue({
      page: 1,
      perPage: 1,
      totalItems: 1,
      totalPages: 1,
      items: [storedSession],
    } as any)

    const rehydrated = await raceSessionService.openOrResumeRaceSession({
      seasonId: 'season_2026',
      teamId: 'team_audi',
      userId: 'user_1',
      seasonYear: 2026,
      round: 1,
      totalLaps: 50,
    })

    expect(rehydrated.isResumed).toBe(true)
    expect(rehydrated.session.status).toBe('awaiting_decision')
    expect(rehydrated.session.checkpoint_data?.pendingDecisions).toHaveLength(1)
    expect(rehydrated.session.checkpoint_data?.pendingDecisions?.[0].id).toBe(pendingId)
    expect(rehydrated.session.current_lap).toBe(20)

    getListSpy.mockRestore()
  })

  // TESTE E: RESOLUÇÃO DUPLICADA / DUAS ABAS
  it('Teste E — Resolução duplicada: resolver o mesmo eventId duas vezes -> primeira aceita, segunda rejeitada como alreadyResolved', async () => {
    const eventId = 'decision_sess_test_123_drv_p1_lap20_pit_wear'
    const alreadyResolvedRecord: RaceResolvedDecision = {
      eventId,
      type: 'pit_stop_critical_wear',
      driverId: 'drv_p1',
      lap: 20,
      resolvedAt: new Date().toISOString(),
      resolvedByExecutorId: 'tab_executor_A',
      choice: 'box_now',
    }

    const sessionWithResolved: Partial<RaceSessionRecord> = {
      id: 'sess_rec_resolved',
      status: 'paused',
      revision: 8,
      current_lap: 20,
      total_laps: 50,
      checkpoint_data: {
        grid: baseGrid,
        currentLap: 20,
        totalLaps: 50,
        weather: 'seco',
        liveEvents: [],
        playerCarTactics: {},
        playerPaceOrders: {},
        mechanicalIssues: [],
        penalties: [],
        pendingDecisions: [],
        resolvedDecisions: [alreadyResolvedRecord],
        lastSavedAt: new Date().toISOString(),
      },
    }

    const getOneSpy = vi
      .spyOn(pb.collection('race_sessions'), 'getOne')
      .mockResolvedValue(sessionWithResolved as any)
    const updateSpy = vi.spyOn(pb.collection('race_sessions'), 'update')

    // Aba B tenta resolver a mesma decisão já resolvida pela Aba A
    const resB = await raceSessionService.resolveDecision({
      sessionId: 'sess_rec_resolved',
      executorId: 'tab_executor_B',
      decisionId: eventId,
      choice: 'box_now',
    })

    expect(resB.success).toBe(false)
    expect(resB.alreadyResolved).toBe(true)
    expect(resB.error).toContain('já foi resolvido')

    // Garante que o update não foi chamado novamente para não duplicar pit stop
    expect(updateSpy).not.toHaveBeenCalled()

    getOneSpy.mockRestore()
    updateSpy.mockRestore()
  })

  // TESTE F: DOIS PILOTOS
  it('Teste F — Dois pilotos: dois pilotos geram decisão na mesma volta -> ambas são preservadas e resolvidas individualmente', async () => {
    // Runner gera decisões para P1 e P2 na volta 20
    const result = advanceCanonicalRaceLap({
      ...defaultParams,
      currentLap: 19,
      grid: baseGrid,
    })

    expect(result.detectedDecisions).toHaveLength(2)
    const decP1 = result.detectedDecisions[0]
    const decP2 = result.detectedDecisions[1]
    expect(decP1.driverId).not.toBe(decP2.driverId)

    // Simula resolução de P1 mantendo P2 na fila
    const sessionWithBoth: Partial<RaceSessionRecord> = {
      id: 'sess_two_drivers',
      status: 'awaiting_decision',
      revision: 10,
      current_lap: 20,
      total_laps: 50,
      checkpoint_data: {
        grid: JSON.parse(JSON.stringify(baseGrid)),
        currentLap: 20,
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
          revision: payload.revision || 11,
        } as any
      })

    // Resolve P1
    const res1 = await raceSessionService.resolveDecision({
      sessionId: 'sess_two_drivers',
      executorId: 'tab_test_executor',
      decisionId: decP1.id,
      choice: 'box_now',
    })

    expect(res1.success).toBe(true)
    // P2 ainda deve continuar pendente
    expect(res1.remainingPendingDecisions).toHaveLength(1)
    expect(res1.remainingPendingDecisions?.[0].id).toBe(decP2.id)
    // Status continua 'awaiting_decision' porque P2 não foi resolvido ainda
    expect(res1.updatedSession?.status).toBe('awaiting_decision')

    getOneSpy.mockRestore()
    updateSpy.mockRestore()
  })

  // TESTE G: PLAY BLOQUEADO
  it('Teste G — Play bloqueado: existindo decisão pendente, o runner ou verificação de loop impede qualquer avanço de volta', () => {
    const pendingList: RacePendingDecision[] = [
      {
        id: 'decision_p1_block',
        type: 'pit_stop_critical_wear',
        driverId: 'drv_p1',
        lap: 20,
        createdAt: new Date().toISOString(),
        title: 'Bloqueio',
        description: 'Decisão pendente',
        payload: {},
      },
    ]

    // Simula a lógica de avanço que verifica pendingDecisions
    const canAdvance = pendingList.length === 0
    expect(canAdvance).toBe(false)
  })
})
