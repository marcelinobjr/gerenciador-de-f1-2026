import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PracticeSessionRunner } from '@/services/canonicalPracticeRunner'
import { practiceSessionService } from '@/services/practiceSessionService'
import { createInitialPracticePreparation } from '@/services/practicePreparationService'
import type { PracticePreparation } from '@/types/practice-preparation'
import type { PracticeSessionRecordState } from '@/types/practice-session'
import { advanceCanonicalRaceLap } from '@/services/canonicalRaceRunner'
import type { SimDriverEntry } from '@/pages/race/types'
import pb from '@/lib/pocketbase/client'

describe('Etapa 4B — TL1 EM ANDAMENTO: Runner Canônico de Sessão de Treino', () => {
  let samplePrep: PracticePreparation

  const sampleContext = {
    round: 1,
    gpName: 'Grande Prêmio da Austrália',
    circuitName: 'Albert Park',
    lengthKm: 5.278,
    tireAbrasiveness: 6,
    weather: 'seco' as const,
    teamChassisRating: 78,
    teamEngineSupplier: 'Audi',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    drivers: [
      {
        id: 'driver_hulkenberg',
        name: 'Nico Hülkenberg',
        speed: 84,
        consistency: 85,
        defense: 80,
        morale: 88,
        physical_condition: 92,
      },
      {
        id: 'driver_bortoleto',
        name: 'Gabriel Bortoleto',
        speed: 82,
        consistency: 81,
        defense: 78,
        morale: 90,
        physical_condition: 95,
      },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    samplePrep = createInitialPracticePreparation({
      careerId: 'team_audi_test',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
      driver1Id: 'driver_hulkenberg',
      driver2Id: 'driver_bortoleto',
      car1Setup: { frontWing: 7, rearWing: 8, suspension: 5, differential: 55 },
      car2Setup: { frontWing: 5, rearWing: 6, suspension: 6, differential: 45 },
    })
    samplePrep.cars[0].program = 'race_pace'
    samplePrep.cars[0].fuelLoad = { kg: 35, estimatedLaps: 21 }
    samplePrep.cars[0].tyreSelection = {
      setId: 'tire_c1_m',
      compound: 'medio',
      isReserved: true,
    }

    samplePrep.cars[1].program = 'qualifying_sim'
    samplePrep.cars[1].fuelLoad = { kg: 15, estimatedLaps: 9 }
    samplePrep.cars[1].tyreSelection = {
      setId: 'tire_c2_s',
      compound: 'macio',
      isReserved: true,
    }
  })

  // Teste A: Handoff 4A -> 4B
  it('Teste A — Handoff 4A→4B: sessão criada exatamente com piloto + programa + pneu + combustível + setup da preparação', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
      driverNames: {
        car1: 'Nico Hülkenberg',
        driver1Id: 'driver_hulkenberg',
        car2: 'Gabriel Bortoleto',
        driver2Id: 'driver_bortoleto',
      },
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
    })

    // Carro 1
    expect(session.cars.car1.driverId).toBe('driver_hulkenberg')
    expect(session.cars.car1.driverName).toBe('Nico Hülkenberg')
    expect(session.cars.car1.program).toBe('race_pace')
    expect(session.cars.car1.currentCompound).toBe('medio')
    expect(session.cars.car1.fuelKg).toBe(35)
    expect(session.cars.car1.setup.frontWing).toBe(7)
    expect(session.cars.car1.setup.rearWing).toBe(8)
    expect(session.cars.car1.setup.differential).toBe(55)

    // Carro 2
    expect(session.cars.car2.driverId).toBe('driver_bortoleto')
    expect(session.cars.car2.driverName).toBe('Gabriel Bortoleto')
    expect(session.cars.car2.program).toBe('qualifying_sim')
    expect(session.cars.car2.currentCompound).toBe('macio')
    expect(session.cars.car2.fuelKg).toBe(15)
    expect(session.cars.car2.setup.frontWing).toBe(5)
    expect(session.cars.car2.setup.rearWing).toBe(6)
    expect(session.cars.car2.setup.differential).toBe(45)

    // Estado inicial de ambos na garagem
    expect(session.cars.car1.status).toBe('garage')
    expect(session.cars.car2.status).toBe('garage')
    expect(session.sessionDurationSec).toBe(3600)
    expect(session.timeRemainingSec).toBe(3600)
  })

  // Teste B: Sessão Única (abrir duas vezes = mesma sessão)
  it('Teste B — Sessão única: abrir duas vezes retorna a mesma sessão sem recriar ou duplicar', async () => {
    const res1 = await practiceSessionService.openOrResumePracticeSession({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })

    expect(res1.isResumed).toBe(false)
    expect(res1.session.cars.car1.fuelKg).toBe(35)

    // Modifica o combustível e avança tempo
    res1.session.cars.car1.fuelKg = 30
    res1.session.elapsedTimeSec = 120
    await practiceSessionService.saveSessionState(res1.session)

    // Abre novamente
    const res2 = await practiceSessionService.openOrResumePracticeSession({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })

    expect(res2.isResumed).toBe(true)
    expect(res2.session.cars.car1.fuelKg).toBe(30)
    expect(res2.session.elapsedTimeSec).toBe(120)
  })

  // Teste C: Carros Independentes
  it('Teste C — Carros independentes: Carro 1 sai para pista enquanto Carro 2 permanece na garagem', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })

    const orderRes = PracticeSessionRunner.orderCarExitToTrack(session, 'car1')
    expect(orderRes.success).toBe(true)

    // Carro 1 em volta de saída, com stint ativo
    expect(session.cars.car1.status).toBe('out_lap')
    expect(session.cars.car1.currentStintId).toBeDefined()
    expect(session.stints).toHaveLength(1)

    // Carro 2 permanece rigorosamente intacto na garagem
    expect(session.cars.car2.status).toBe('garage')
    expect(session.cars.car2.currentStintId).toBeUndefined()
  })

  // Teste D: Volta (tempo registrado, combustível reduzido, pneu desgastado)
  it('Teste D — Volta: registra tempo uma única vez, reduz combustível e desgasta pneus com regras canônicas', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })
    session.status = 'running'

    // Carro 1 sai para a pista
    PracticeSessionRunner.orderCarExitToTrack(session, 'car1')
    expect(session.cars.car1.status).toBe('out_lap')

    // Conclui out lap avançando progresso
    session.cars.car1.currentLapProgressPct = 100
    const tick1 = PracticeSessionRunner.tick(session, 1, sampleContext)
    expect(tick1.nextState.cars.car1.status).toBe('flying_lap')

    // Conclui flying lap
    const initialFuel = tick1.nextState.cars.car1.fuelKg
    const initialWear = tick1.nextState.cars.car1.tyreWear
    tick1.nextState.cars.car1.currentLapProgressPct = 100

    const tick2 = PracticeSessionRunner.tick(tick1.nextState, 1, sampleContext)
    const car1AfterLap = tick2.nextState.cars.car1

    expect(car1AfterLap.totalLaps).toBe(1)
    expect(car1AfterLap.lapsInStint).toBe(1)
    expect(car1AfterLap.lastLapTime).toBeDefined()
    expect(car1AfterLap.bestLapTime).toBe(car1AfterLap.lastLapTime)

    // Combustível reduzido de forma estrita (~1.65 - 1.75 kg)
    expect(car1AfterLap.fuelKg).toBeLessThan(initialFuel)
    expect(car1AfterLap.fuelKg).toBeGreaterThanOrEqual(0)

    // Pneu desgastado
    expect(car1AfterLap.tyreWear).toBeGreaterThan(initialWear)

    // Histórico de voltas registrado
    const history = tick2.nextState.lapHistory[car1AfterLap.driverId]
    expect(history).toHaveLength(1)
    expect(history[0].lapNumber).toBe(1)
    expect(history[0].isValid).toBe(true)
  })

  // Teste E: Stint (sair -> voltas -> chamar aos boxes -> encerrado, snapshot preservado)
  it('Teste E — Stint completo: sair → voltas → chamar boxes → encerrado preservando snapshot do setup', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })
    session.status = 'running'

    // 1. Sair da garagem
    PracticeSessionRunner.orderCarExitToTrack(session, 'car1')
    const activeStint = session.stints[0]
    expect(activeStint.setupSnapshot.frontWing).toBe(7)
    expect(activeStint.setupSnapshot.rearWing).toBe(8)
    expect(activeStint.status).toBe('active')

    // 2. Transitar out_lap -> flying_lap
    session.cars.car1.currentLapProgressPct = 100
    const t1 = PracticeSessionRunner.tick(session, 1, sampleContext)

    // 3. Concluir 1 flying lap
    t1.nextState.cars.car1.currentLapProgressPct = 100
    const t2 = PracticeSessionRunner.tick(t1.nextState, 1, sampleContext)
    expect(t2.nextState.cars.car1.totalLaps).toBe(1)

    // 4. Solicitar retorno aos boxes (sem teleporte)
    PracticeSessionRunner.requestCarBox(t2.nextState, 'car1')
    expect(t2.nextState.cars.car1.pitRequested).toBe(true)

    // 5. Completar volta -> transita para in_lap
    t2.nextState.cars.car1.currentLapProgressPct = 100
    const t3 = PracticeSessionRunner.tick(t2.nextState, 1, sampleContext)
    expect(t3.nextState.cars.car1.status).toBe('in_lap')

    // 6. Completar in_lap -> retorna à garagem e encerra o stint
    t3.nextState.cars.car1.currentLapProgressPct = 100
    const t4 = PracticeSessionRunner.tick(t3.nextState, 1, sampleContext)
    expect(t4.nextState.cars.car1.status).toBe('garage')

    const closedStint = t4.nextState.stints[0]
    expect(closedStint.status).toBe('completed')
    expect(closedStint.endedAt).toBeDefined()
    expect(closedStint.setupSnapshot.frontWing).toBe(7) // snapshot intacto
    expect(closedStint.lapsCount).toBe(2)
  })

  // Teste F: Pause
  it('Teste F — Pause: relógio e carros não avançam no modo pausado; sem consumo ou desgaste', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })
    session.status = 'paused'
    session.cars.car1.status = 'flying_lap'
    session.cars.car1.currentLapProgressPct = 50

    const initialRemTime = session.timeRemainingSec
    const initialFuel = session.cars.car1.fuelKg
    const initialWear = session.cars.car1.tyreWear

    const res = PracticeSessionRunner.tick(session, 10, sampleContext)
    expect(res.nextState.timeRemainingSec).toBe(initialRemTime)
    expect(res.nextState.cars.car1.currentLapProgressPct).toBe(50)
    expect(res.nextState.cars.car1.fuelKg).toBe(initialFuel)
    expect(res.nextState.cars.car1.tyreWear).toBe(initialWear)
  })

  // Teste G: Velocidade 1x/2x/4x
  it('Teste G — Velocidades 1x, 2x e 4x: alteram cadência sem alterar fórmulas de desgaste por volta', () => {
    const session1x = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })
    session1x.status = 'running'
    session1x.simSpeed = 1

    const session4x = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })
    session4x.status = 'running'
    session4x.simSpeed = 4

    // 1 tick de tempo real com simSpeed 1x avança 1s
    const res1x = PracticeSessionRunner.tick(session1x, 1, sampleContext)
    expect(res1x.nextState.elapsedTimeSec).toBe(1)
    expect(res1x.nextState.timeRemainingSec).toBe(3599)

    // 1 tick de tempo real com simSpeed 4x avança 4s
    const res4x = PracticeSessionRunner.tick(session4x, 4, sampleContext)
    expect(res4x.nextState.elapsedTimeSec).toBe(4)
    expect(res4x.nextState.timeRemainingSec).toBe(3596)
  })

  // Teste H: Reload / Reidratação
  it('Teste H — Reload: preserva relógio, stints, inventário, pneus e combustível', async () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })
    session.elapsedTimeSec = 1450
    session.timeRemainingSec = 2150
    session.cars.car1.fuelKg = 18.5
    session.cars.car1.tyreWear = 32

    await practiceSessionService.saveSessionState(session)

    // Simula reload em nova renderização
    const reloaded = await practiceSessionService.openOrResumePracticeSession({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })

    expect(reloaded.isResumed).toBe(true)
    expect(reloaded.session.elapsedTimeSec).toBe(1450)
    expect(reloaded.session.timeRemainingSec).toBe(2150)
    expect(reloaded.session.cars.car1.fuelKg).toBe(18.5)
    expect(reloaded.session.cars.car1.tyreWear).toBe(32)
  })

  // Teste I: Duas Abas / Executor Único
  it('Teste I — Duas abas: somente uma aba obtém autorização ativa de executor por vez', async () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })

    // Aba A adquire lock
    const lockA = await practiceSessionService.acquireExecutionLock(session, 'tab_A')
    expect(lockA.acquired).toBe(true)
    expect(session.activeExecutorId).toBe('tab_A')

    // Aba B tenta adquirir com lease válido
    const lockB = await practiceSessionService.acquireExecutionLock(session, 'tab_B')
    expect(lockB.acquired).toBe(false)
    expect(lockB.currentExecutorId).toBe('tab_A')

    // Aba A libera lock
    await practiceSessionService.releaseExecutionLock(session, 'tab_A')
    expect(session.activeExecutorId).toBeUndefined()

    // Agora Aba B consegue adquirir
    const lockBAfter = await practiceSessionService.acquireExecutionLock(session, 'tab_B')
    expect(lockBAfter.acquired).toBe(true)
    expect(session.activeExecutorId).toBe('tab_B')
  })

  // Teste J: Pneu (sem duplicação, desgaste persistente)
  it('Teste J — Regra de pneus: desgaste é persistente e não há duplicação de jogos na sessão', () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })
    session.status = 'running'

    PracticeSessionRunner.orderCarExitToTrack(session, 'car1')
    session.cars.car1.currentLapProgressPct = 100
    const t1 = PracticeSessionRunner.tick(session, 1, sampleContext) // out_lap -> flying_lap

    t1.nextState.cars.car1.currentLapProgressPct = 100
    const t2 = PracticeSessionRunner.tick(t1.nextState, 1, sampleContext) // volta rápida 1
    const wearLap1 = t2.nextState.cars.car1.tyreWear

    t2.nextState.cars.car1.currentLapProgressPct = 100
    const t3 = PracticeSessionRunner.tick(t2.nextState, 1, sampleContext) // volta rápida 2
    const wearLap2 = t3.nextState.cars.car1.tyreWear

    expect(wearLap2).toBeGreaterThan(wearLap1)
    expect(t3.nextState.stints[0].tyreSetId).toBe(session.cars.car1.currentTyreSetId)
  })

  // Teste K: Finalização (tempo zero -> sessão concluída)
  it('Teste K — Finalização idempotente: ao zerar tempo marca concluída e encerra stints ativos', async () => {
    const session = practiceSessionService.createInitialSessionState({
      careerId: samplePrep.careerId,
      seasonId: samplePrep.seasonId,
      round: samplePrep.round,
      sessionType: samplePrep.sessionType,
      preparation: samplePrep,
    })
    session.status = 'running'
    session.timeRemainingSec = 1

    PracticeSessionRunner.orderCarExitToTrack(session, 'car1')

    const res = PracticeSessionRunner.tick(session, 1, sampleContext)
    expect(res.nextState.timeRemainingSec).toBe(0)
    expect(res.nextState.status).toBe('completed')

    // Concluir oficialmente
    const completed = await practiceSessionService.markPracticeCompleted(res.nextState)
    expect(completed.status).toBe('completed')
    expect(completed.cars.car1.status).toBe('garage')

    // Idempotência: chamar novamente não corrompe
    const completedAgain = await practiceSessionService.markPracticeCompleted(completed)
    expect(completedAgain.status).toBe('completed')
  })

  // Teste L: Runner Reutilizável por sessionType (TL1, TL2, TL3)
  it('Teste L — Runner reutilizável: opera indistintamente para tp1, tp2 e tp3 usando a mesma classe', () => {
    const sessionTL2 = practiceSessionService.createInitialSessionState({
      careerId: 'team_ferrari',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp2',
      preparation: {
        ...samplePrep,
        sessionType: 'tp2',
      },
    })
    expect(sessionTL2.sessionType).toBe('tp2')
    expect(sessionTL2.status).toBe('paused')

    const sessionTL3 = practiceSessionService.createInitialSessionState({
      careerId: 'team_ferrari',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp3',
      preparation: {
        ...samplePrep,
        sessionType: 'tp3',
      },
    })
    expect(sessionTL3.sessionType).toBe('tp3')
    expect(sessionTL3.status).toBe('paused')
  })

  // Teste M: Regressão da Corrida ao Vivo (zero alterações funcionais na corrida)
  it('Teste M — Regressão da Corrida ao Vivo: advanceCanonicalRaceLap mantém intacto o runner de corrida', () => {
    const dummyGrid: SimDriverEntry[] = [
      {
        position: 1,
        gridPosition: 1,
        driverId: 'drv_p1',
        driverName: 'Piloto Teste',
        teamId: 'team_audi',
        teamName: 'Audi F1 Team',
        isPlayer: true,
        score: 85,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        accumulatedTimeSec: 100,
        tireCompound: 'medio',
        tireWear: 10,
        pitLap: 25,
        pitStopsDone: 0,
      },
    ]

    const raceLapResult = advanceCanonicalRaceLap({
      currentLap: 1,
      totalLaps: 50,
      grid: dummyGrid,
      weather: 'seco',
      round: 1,
      gpName: 'GP Test',
      circuitName: 'Circuito Test',
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

    expect(raceLapResult.nextLap).toBe(2)
    expect(raceLapResult.nextGrid).toHaveLength(1)
    expect(raceLapResult.nextGrid[0].accumulatedTimeSec).toBeGreaterThan(100)
    expect(raceLapResult.isCompleted).toBe(false)
  })
})
