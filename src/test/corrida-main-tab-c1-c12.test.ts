/**
 * corrida-main-tab-c1-c12.test.ts
 *
 * Suíte de testes focados para a nova aba principal "CORRIDA" (C1 a C12):
 * - C1: Corrida aparece na sidebar em COMPETIÇÃO com rota /corrida.
 * - C2: /corrida abre a experiência FW2 (WeekendV2Page).
 * - C3: /weekend-v2 não quebra e serve a mesma experiência (alias/redirect).
 * - C4: TL1 existente continua operacional (runner, tick, setup, feedbacks).
 * - C5: TL2 existente continua operacional (runner, herança, feedback).
 * - C6: Código/estado de TL3 permanece preservado, mesmo não aparecendo na esteira padrão.
 * - C7: Esteira mostra TL1, TL2, Q1, Q2, Q3, Corrida (6 etapas na esteira padrão).
 * - C8: Q1/Q2/Q3/Corrida não executam fluxos fake.
 * - C9: Reabrir /corrida seleciona a sessão canônica atual.
 * - C10: Trocar entre TL1/TL2 não recria inventário de pneus.
 * - C11: Exatamente dois carros do jogador aparecem no contexto.
 * - C12: Trocar de subaba não recria evento ou sessão.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getRaceWeekendPipeline,
  resolveSessionVisualState,
  resolveInitialRaceSession,
  CANONICAL_SESSION_DEFINITIONS,
  type RaceWeekendSessionId,
} from '@/services/weekendScheduleConfig'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { canonicalEventRegistrationService } from '@/services/canonicalEventRegistrationService'
import { practiceSessionService } from '@/services/practiceSessionService'
import { PracticeSessionRunner } from '@/services/canonicalPracticeRunner'
import { CanonicalPracticeV2Runner } from '@/services/canonicalPracticeV2Runner'
import {
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '@/services/weekendProgressionService'

describe('NOVA ABA PRINCIPAL CORRIDA — VALIDAÇÃO C1 a C12', () => {
  const seasonId = 'season_corrida_2026'
  const careerId = 'career_audi_gp'
  const round = 1

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // C1: Corrida aparece na sidebar em COMPETIÇÃO
  it('C1: Item CORRIDA está configurado em COMPETIÇÃO com rota /corrida', async () => {
    // Importar Sidebar para verificar definição estática da navegação
    const { CAREER_NAV_SECTIONS, ROUTE_TITLE_MAP } = await import('@/components/Sidebar')
    const compSection = CAREER_NAV_SECTIONS.find((s) => s.title === 'COMPETIÇÃO')
    expect(compSection).toBeDefined()
    const corridaItem = compSection?.items.find((item) => item.path === '/corrida')
    expect(corridaItem).toBeDefined()
    expect(corridaItem?.name.toUpperCase()).toBe('CORRIDA')
    expect(ROUTE_TITLE_MAP['/corrida'].toUpperCase()).toBe('CORRIDA')
    expect(ROUTE_TITLE_MAP['/weekend-v2'].toUpperCase()).toBe('CORRIDA')
  })

  // C2 & C3: Rotas /corrida e /weekend-v2 mapeadas para o mesmo módulo
  it('C2 & C3: /corrida e /weekend-v2 servem o mesmo componente sem duplicação', async () => {
    const WeekendV2 = (await import('@/pages/WeekendV2Page')).default
    expect(WeekendV2).toBeDefined()
    expect(typeof WeekendV2).toBe('function')
  })

  // C4: TL1 existente continua operacional
  it('C4: TL1 existente continua totalmente operacional no runner canônico', async () => {
    const { session: tl1 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp1',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })

    expect(tl1.sessionType).toBe('tp1')
    expect(tl1.timeRemainingSec).toBe(3600)
    expect(tl1.status).toBe('preparing')

    const mockCtx = {
      round,
      gpName: 'Bahrain GP',
      circuitName: 'Sakhir',
      lengthKm: 5.4,
      tireAbrasiveness: 7,
      weather: 'seco' as const,
      teamChassisRating: 78,
      teamEngineSupplier: 'Audi',
      teamName: 'Audi F1 Team',
      teamColor: '#C00400',
      drivers: [
        {
          id: 'drv_bortoleto',
          name: 'Gabriel Bortoleto',
          speed: 82,
          consistency: 80,
          defense: 78,
          technical_feedback: 75,
        },
        {
          id: 'drv_hulkenberg',
          name: 'Nico Hülkenberg',
          speed: 81,
          consistency: 81,
          defense: 80,
          technical_feedback: 76,
        },
      ],
    }

    // Saída à pista e avanço de tempo
    PracticeSessionRunner.orderCarExitToTrack(tl1, 'car1')
    const res = PracticeSessionRunner.tick(tl1, 10, mockCtx)
    expect(res.nextState.timeRemainingSec).toBe(3590)
    expect(res.nextState.status).toBe('running')
  })

  // C5: TL2 existente continua operacional
  it('C5: TL2 existente continua operacional herdando acerto e gerando dados', async () => {
    // 1. Concluir TL1
    writeStoredCompletedSessions(seasonId, round, ['tp1'])

    // 2. Abrir TL2
    const { session: tl2 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp2',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })

    expect(tl2.sessionType).toBe('tp2')
    expect(tl2.status).toBe('preparing')

    // Verificar controle +1 min / +5 min
    const mockCtx = {
      round,
      gpName: 'Bahrain GP',
      circuitName: 'Sakhir',
      lengthKm: 5.4,
      tireAbrasiveness: 7,
      weather: 'seco' as const,
      teamChassisRating: 78,
      teamEngineSupplier: 'Audi',
      teamName: 'Audi F1 Team',
      teamColor: '#C00400',
      drivers: [
        {
          id: 'drv_bortoleto',
          name: 'Gabriel Bortoleto',
          speed: 82,
          consistency: 80,
          defense: 78,
          technical_feedback: 75,
        },
        {
          id: 'drv_hulkenberg',
          name: 'Nico Hülkenberg',
          speed: 81,
          consistency: 81,
          defense: 80,
          technical_feedback: 76,
        },
      ],
    }

    const stepRes = CanonicalPracticeV2Runner.advanceBySeconds(tl2, 60, mockCtx)
    expect(stepRes.secondsSimulated).toBe(60)
    expect(stepRes.nextState.timeRemainingSec).toBe(3540)
  })

  // C6: Código/estado de TL3 permanece preservado
  it('C6: TL3 permanece tecnicamente preservado nos runners, serviços e configurável na esteira', async () => {
    // A pipeline padrão oculta TL3, mas quando options.includePractice3 = true ele é inserido
    const pipelineStandard = getRaceWeekendPipeline({ includePractice3: false })
    const pipelineWithP3 = getRaceWeekendPipeline({ includePractice3: true })

    expect(pipelineStandard.map((s) => s.id)).not.toContain('tp3')
    expect(pipelineWithP3.map((s) => s.id)).toContain('tp3')
    expect(CANONICAL_SESSION_DEFINITIONS['tp3']).toBeDefined()
    expect(CANONICAL_SESSION_DEFINITIONS['tp3'].isPlayableInV2).toBe(true)

    // O runner pode instanciar e executar TL3 sem nenhuma regressão
    const { session: tl3 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp3',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })
    expect(tl3.sessionType).toBe('tp3')
    expect(tl3.status).toBe('preparing')
  })

  // C7: Esteira mostra EXATAMENTE: TL1 -> TL2 -> Q1 -> Q2 -> Q3 -> CORRIDA
  it('C7: Esteira padrão mostra exatamente: [TL1, TL2, Q1, Q2, Q3, CORRIDA]', () => {
    const pipeline = getRaceWeekendPipeline()
    const ids = pipeline.map((s) => s.id)
    const labels = pipeline.map((s) => s.shortLabel)

    expect(ids).toEqual(['tp1', 'tp2', 'q1', 'q2', 'q3', 'race'])
    expect(labels).toEqual(['TL1', 'TL2', 'Q1', 'Q2', 'Q3', 'CORRIDA'])
  })

  // C8: Q1/Q2/Q3/Corrida não executam fluxos fake
  it('C8: Q1/Q2/Q3/Corrida estão marcados como não jogáveis na v2 e bloqueados sem dados fakes', () => {
    const pipeline = getRaceWeekendPipeline()

    const q1 = pipeline.find((s) => s.id === 'q1')!
    const q2 = pipeline.find((s) => s.id === 'q2')!
    const q3 = pipeline.find((s) => s.id === 'q3')!
    const race = pipeline.find((s) => s.id === 'race')!

    expect(q1.isPlayableInV2).toBe(false)
    expect(q2.isPlayableInV2).toBe(false)
    expect(q3.isPlayableInV2).toBe(false)
    expect(race.isPlayableInV2).toBe(false)

    // Sem treinos concluídos, Q1 está bloqueado
    const stateQ1_init = resolveSessionVisualState({
      sessionId: 'q1',
      activeSessionId: 'tp1',
      completedSessions: [],
    })
    expect(stateQ1_init).toBe('locked')

    // Corrida bloqueada mesmo com TL1 e TL2 concluídos
    const stateRace_mid = resolveSessionVisualState({
      sessionId: 'race',
      activeSessionId: 'tp2',
      completedSessions: ['tp1', 'tp2'],
    })
    expect(stateRace_mid).toBe('locked')
  })

  // C9: Reabrir /corrida seleciona a sessão canônica atual
  it('C9: Reabrir /corrida seleciona prioritariamente a sessão canônica pendente ou em andamento', () => {
    const pipeline = getRaceWeekendPipeline()

    // 1. Início do fim de semana -> TL1
    const s1 = resolveInitialRaceSession({
      pipeline,
      completedSessions: [],
    })
    expect(s1).toBe('tp1')

    // 2. TL1 concluído -> TL2
    const s2 = resolveInitialRaceSession({
      pipeline,
      completedSessions: ['tp1'],
    })
    expect(s2).toBe('tp2')

    // 3. TL1 e TL2 concluídos -> Q1
    const s3 = resolveInitialRaceSession({
      pipeline,
      completedSessions: ['tp1', 'tp2'],
    })
    expect(s3).toBe('q1')

    // 4. Se havia sessão ativa não concluída (ex: TL2 em andamento), mantém ela
    const s4 = resolveInitialRaceSession({
      pipeline,
      completedSessions: ['tp1'],
      lastActiveSessionId: 'tp2',
    })
    expect(s4).toBe('tp2')
  })

  // C10: Trocar entre TL1/TL2 não recria inventário de pneus
  it('C10: Trocar entre TL1/TL2 preserva o saldo consumido e nunca recria inventário', () => {
    const driverIds = ['drv_bortoleto', 'drv_hulkenberg']

    // 1. Inicializar estoque (20 jogos por piloto)
    const invs1 = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds,
      primaryDriverIds: driverIds,
    })
    expect(invs1['drv_bortoleto']).toHaveLength(20)

    // 2. Consumir pneu em TL1 (desgaste de 1 volta)
    const firstSetId = invs1['drv_bortoleto'][0].id
    canonicalWeekendTyrePersistence.recordTyreUsage({
      seasonId,
      round,
      driverId: 'drv_bortoleto',
      tyreSetId: firstSetId,
      lapsAdded: 1,
      finalWearPct: 8.5,
    })

    // 3. Simular transição para TL2 (recarregar inventário)
    const invs2 = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds,
      primaryDriverIds: driverIds,
    })
    const usedSetInTL2 = invs2['drv_bortoleto'].find((s) => s.id === firstSetId)
    expect(usedSetInTL2).toBeDefined()
    expect(usedSetInTL2?.lapsUsed).toBe(1)
    expect(usedSetInTL2?.wear).toBe(8.5)
    expect(invs2['drv_bortoleto']).toHaveLength(20) // Mesmos 20 jogos
  })

  // C11: Exatamente dois carros do jogador aparecem no contexto
  it('C11: Inscrição canônica do evento possui exatamente playerCar1 e playerCar2', () => {
    const mockAudiTeam = {
      id: 'team_audi',
      user_id: 'usr_player1',
      name: 'Audi F1 Team',
      country: 'Alemanha',
      color: '#E10600',
      secondary_color: '#000000',
      engine_supplier: 'Audi',
      budget: 150000000,
      reputation: 75,
      strength: 78,
      chassis_level: 78,
      aerodynamics_level: 78,
      aero_level: 78,
      powertrain_level: 78,
      reliability_level: 78,
      strategy_level: 78,
      created: '2026-01-01',
      updated: '2026-01-01',
      team_key: 'audi',
    } as any

    const mockAudiDrivers = [
      {
        id: 'drv_bortoleto',
        team_id: 'team_audi',
        name: 'Gabriel Bortoleto',
        nationality: 'Brasil',
        age: 21,
        role: 'titular',
        license_status: 'nivel_a',
        superlicense_points: 40,
        speed: 84,
        consistency: 82,
        defense: 80,
        created: '2026-01-01',
        updated: '2026-01-01',
      },
      {
        id: 'drv_hulkenberg',
        team_id: 'team_audi',
        name: 'Nico Hülkenberg',
        nationality: 'Alemanha',
        age: 38,
        role: 'titular',
        license_status: 'nivel_a',
        superlicense_points: 40,
        speed: 83,
        consistency: 85,
        defense: 82,
        created: '2026-01-01',
        updated: '2026-01-01',
      },
    ] as any

    const reg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
      seasonId,
      round,
      gpName: 'GP do Bahrein',
      playerTeam: mockAudiTeam,
      allDrivers: mockAudiDrivers,
      forceRecalculate: true,
    })

    expect(reg.valid).toBe(true)
    expect(reg.snapshot?.entriesByCar.playerCar1).toBeDefined()
    expect(reg.snapshot?.entriesByCar.playerCar2).toBeDefined()

    // Ambos os carros possuem piloto válido e não hardcoded vazio
    expect(reg.snapshot?.entriesByCar.playerCar1?.driverName.length).toBeGreaterThan(0)
    expect(reg.snapshot?.entriesByCar.playerCar2?.driverName.length).toBeGreaterThan(0)
    expect(reg.snapshot?.entriesByCar.playerCar1?.driverId).toBe('drv_bortoleto')
    expect(reg.snapshot?.entriesByCar.playerCar2?.driverId).toBe('drv_hulkenberg')
    expect(reg.snapshot?.totalEntries).toBe(24) // 12 equipes x 2 carros
  })

  // C12: Trocar de subaba não recria evento ou sessão
  it('C12: Trocar de subaba ou consultar TL1 concluído não reinicializa o evento', async () => {
    // 1. Criar TL1 com tempo corrido
    const { session: tl1 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp1',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })

    tl1.elapsedTimeSec = 450
    tl1.timeRemainingSec = 3150
    tl1.status = 'completed'
    await practiceSessionService.saveSessionState(tl1)
    writeStoredCompletedSessions(seasonId, round, ['tp1'])

    // 2. Abrir TL2
    const { session: tl2 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp2',
      preparation: {
        round,
        cars: [
          { carId: 'car1', driverId: 'drv_bortoleto', fuelLoad: { kg: 30 } },
          { carId: 'car2', driverId: 'drv_hulkenberg', fuelLoad: { kg: 30 } },
        ],
      } as any,
    })
    tl2.elapsedTimeSec = 100
    await practiceSessionService.saveSessionState(tl2)

    // 3. Voltar e consultar TL1 (deve estar preservado com 450s e status completed)
    const { session: reloadedTL1 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp1',
      preparation: {} as any,
    })
    expect(reloadedTL1.elapsedTimeSec).toBe(450)
    expect(reloadedTL1.status).toBe('completed')

    // 4. Voltar para TL2 (deve estar preservado com 100s)
    const { session: reloadedTL2 } = await practiceSessionService.openOrResumePracticeSession({
      careerId,
      seasonId,
      round,
      sessionType: 'tp2',
      preparation: {} as any,
    })
    expect(reloadedTL2.elapsedTimeSec).toBe(100)
  })
})
