import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  evaluateStintFeedback,
  updateSetupKnowledge,
  createInitialSetupKnowledge,
  resolveInternalIdealSetup,
} from '@/services/canonicalPracticeFeedbackService'
import { PracticeSessionRunner } from '@/services/canonicalPracticeRunner'
import { practiceSessionService } from '@/services/practiceSessionService'
import { createInitialPracticePreparation } from '@/services/practicePreparationService'
import type { PracticeStint } from '@/types/practice-session'
import type { PracticeCarSetup } from '@/types/practice-preparation'
import { advanceCanonicalRaceLap } from '@/services/canonicalRaceRunner'
import type { SimDriverEntry } from '@/pages/race/types'

describe('APEX GP MANAGER — ETAPA 4C1: Feedback de Stint + Descoberta Progressiva da Faixa de Setup', () => {
  const round = 1 // GP da Austrália
  const ideal = resolveInternalIdealSetup(round)

  const accurateDriver = {
    id: 'drv_veteran',
    name: 'Nico Hülkenberg',
    technical_feedback: 90,
    consistency: 88,
    speed: 84,
    defense: 80,
  }

  const rookieDriver = {
    id: 'drv_rookie',
    name: 'Gabriel Bortoleto',
    technical_feedback: 65,
    consistency: 78,
    speed: 82,
    defense: 75,
  }

  const baseSetup: PracticeCarSetup = {
    frontWing: 6,
    rearWing: 6,
    suspension: 6,
    differential: 50,
  }

  function createMockStint(params: {
    id?: string
    carId?: 'car1' | 'car2'
    driverId?: string
    lapsCount: number
    setup?: PracticeCarSetup
    program?: 'car_setup' | 'race_pace' | 'qualifying_sim' | 'tyre_knowledge'
  }): PracticeStint {
    const lapsCount = params.lapsCount
    const lapsList = Array.from({ length: lapsCount }, (_, i) => ({
      lapNumber: i + 1,
      lapTimeSec: 85.5,
      lapTimeFormatted: '1:25.500',
      compound: 'medio' as const,
      tyreWear: 5 + i * 3,
      fuelRemainingKg: 30 - i * 1.65,
      program: params.program || 'car_setup',
      stintId: params.id || 'stint_1',
      isValid: true,
      isPersonalBest: i === 0,
      isSessionBest: false,
      timestamp: new Date().toISOString(),
    }))

    return {
      id: params.id || 'stint_1',
      driverId: params.driverId || 'drv_veteran',
      carId: params.carId || 'car1',
      program: params.program || 'car_setup',
      setupSnapshot: params.setup ? { ...params.setup } : { ...baseSetup },
      tyreSetId: 'set_1',
      compound: 'medio',
      initialFuelKg: 30,
      initialWear: 0,
      lapsCount,
      laps: lapsList,
      startedAt: new Date().toISOString(),
      status: 'completed',
    }
  }

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  // Teste A: Stint curto demais -> feedback insuficiente, sem falsa precisão
  it('Teste A — Stint curto demais (<= 1 volta) gera feedback insuficiente sem falsa precisão', () => {
    const shortStint = createMockStint({ lapsCount: 1 })
    const initialKnowledge = createInitialSetupKnowledge()

    const feedback = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: shortStint,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: initialKnowledge,
    })

    expect(feedback.quality).toBe('insufficient')
    expect(feedback.axisFeedbacks).toHaveLength(0)
    expect(feedback.knowledgeDelta).toBeUndefined()
    expect(feedback.generalMessage).toContain('Dados insuficientes')

    // Conhecimento não deve sofrer alteração com feedback insuficiente
    const knowledgeAfter = updateSetupKnowledge(initialKnowledge, feedback)
    expect(knowledgeAfter.frontWing.revealed).toBe(false)
    expect(knowledgeAfter.totalStintsAnalyzed).toBe(0)
  })

  // Teste B: Setup abaixo do ideal -> diagnóstico aponta direção 'increase'
  it('Teste B — Setup abaixo do ideal aponta direção correta (increase)', () => {
    // Forçar setup bem abaixo do ideal interno
    const lowSetup: PracticeCarSetup = {
      frontWing: Math.max(1, ideal.frontWing - 3),
      rearWing: Math.max(1, ideal.rearWing - 3),
      suspension: Math.max(1, ideal.suspension - 3),
      differential: Math.max(20, ideal.differential - 15),
    }

    const stint = createMockStint({ lapsCount: 5, setup: lowSetup })
    const initialKnowledge = createInitialSetupKnowledge()

    const feedback = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: initialKnowledge,
    })

    expect(feedback.quality).toBe('reliable')
    const frontWingFeedback = feedback.axisFeedbacks.find((a) => a.axis === 'frontWing')
    expect(frontWingFeedback?.direction).toBe('increase')
    expect(frontWingFeedback?.message).toBeDefined()
    expect(frontWingFeedback?.message.length).toBeGreaterThan(10)
  })

  // Teste C: Setup acima do ideal -> direção 'decrease'
  it('Teste C — Setup acima do ideal aponta direção correta (decrease)', () => {
    const highSetup: PracticeCarSetup = {
      frontWing: Math.min(10, ideal.frontWing + 3),
      rearWing: Math.min(10, ideal.rearWing + 3),
      suspension: Math.min(10, ideal.suspension + 3),
      differential: Math.min(80, ideal.differential + 15),
    }

    const stint = createMockStint({ lapsCount: 5, setup: highSetup })
    const initialKnowledge = createInitialSetupKnowledge()

    const feedback = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: initialKnowledge,
    })

    expect(feedback.quality).toBe('reliable')
    const rearWingFeedback = feedback.axisFeedbacks.find((a) => a.axis === 'rearWing')
    expect(rearWingFeedback?.direction).toBe('decrease')
    expect(rearWingFeedback?.message).toBeDefined()
  })

  // Teste D: Conhecimento inicial "?" -> após stint válido, faixa criada e revealed = true
  it('Teste D — Conhecimento inicial "?" se torna faixa conhecida após primeiro stint válido', () => {
    const initialKnowledge = createInitialSetupKnowledge()
    expect(initialKnowledge.frontWing.revealed).toBe(false)

    const stint = createMockStint({ lapsCount: 4 })
    const feedback = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: initialKnowledge,
    })

    const updated = updateSetupKnowledge(initialKnowledge, feedback)
    expect(updated.frontWing.revealed).toBe(true)
    expect(updated.rearWing.revealed).toBe(true)
    expect(updated.suspension.revealed).toBe(true)
    expect(updated.differential.revealed).toBe(true)

    expect(updated.frontWing.minKnown).toBeGreaterThanOrEqual(1)
    expect(updated.frontWing.maxKnown).toBeLessThanOrEqual(10)
    expect(updated.frontWing.minKnown).toBeLessThanOrEqual(updated.frontWing.maxKnown)
  })

  // Teste E: Estreitamento progressivo entre stints (faixa mantém ou estreita)
  it('Teste E — Estreitamento progressivo entre stints sucessivos (mantém ou contrai a faixa)', () => {
    const k0 = createInitialSetupKnowledge()

    // Stint 1 com piloto testando setup 1
    const stint1 = createMockStint({
      id: 'stint_1',
      lapsCount: 4,
      setup: { frontWing: 3, rearWing: 4, suspension: 4, differential: 40 },
    })
    const fb1 = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: stint1,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: k0,
    })
    const k1 = updateSetupKnowledge(k0, fb1)
    const rangeSpan1 = k1.frontWing.maxKnown - k1.frontWing.minKnown

    // Stint 2 com piloto ajustando setup para testar outro ponto
    const stint2 = createMockStint({
      id: 'stint_2',
      lapsCount: 6,
      setup: { frontWing: 8, rearWing: 8, suspension: 7, differential: 60 },
    })
    const fb2 = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: stint2,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: k1,
    })
    const k2 = updateSetupKnowledge(k1, fb2)
    const rangeSpan2 = k2.frontWing.maxKnown - k2.frontWing.minKnown

    expect(rangeSpan2).toBeLessThanOrEqual(rangeSpan1)
    expect(k2.totalStintsAnalyzed).toBe(2)
  })

  // Teste F: Faixa não expande arbitrariamente com mais dados válidos
  it('Teste F — Faixa é monotonicamente restrita e não expande arbitrariamente com novos dados', () => {
    let k = createInitialSetupKnowledge()

    for (let i = 1; i <= 3; i++) {
      const stint = createMockStint({
        id: `stint_${i}`,
        lapsCount: 4 + i,
        setup: { frontWing: 5 + i, rearWing: 5, suspension: 6, differential: 50 },
      })
      const fb = evaluateStintFeedback({
        sessionId: 'sess_1',
        stint,
        driver: accurateDriver,
        round,
        weather: 'seco',
        currentKnowledge: k,
      })

      const prevMin = k.frontWing.minKnown
      const prevMax = k.frontWing.maxKnown
      k = updateSetupKnowledge(k, fb)

      if (i > 1) {
        expect(k.frontWing.minKnown).toBeGreaterThanOrEqual(prevMin)
        expect(k.frontWing.maxKnown).toBeLessThanOrEqual(prevMax)
      }
    }
  })
  // Teste G: Piloto preciso vs menos preciso -> mesma direção, precisão/confiança diferentes
  it('Teste G — Piloto preciso vs menos preciso: mesma direção técnica, mas piloto experiente gera maior confiança e faixa mais estreita', () => {
    const kInit = createInitialSetupKnowledge()
    const testSetup: PracticeCarSetup = {
      frontWing: Math.max(1, ideal.frontWing - 3),
      rearWing: Math.max(1, ideal.rearWing - 3),
      suspension: Math.max(1, ideal.suspension - 3),
      differential: Math.max(20, ideal.differential - 15),
    }

    const stintAccurate = createMockStint({ id: 'stint_acc', lapsCount: 6, setup: testSetup })
    const stintRookie = createMockStint({ id: 'stint_rok', lapsCount: 6, setup: testSetup })

    const fbAccurate = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: stintAccurate,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: kInit,
    })

    const fbRookie = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: stintRookie,
      driver: rookieDriver,
      round,
      weather: 'seco',
      currentKnowledge: kInit,
    })

    // Ambos concordam na direção
    expect(fbAccurate.axisFeedbacks[0].direction).toBe(fbRookie.axisFeedbacks[0].direction)

    // Piloto experiente produz faixa igual ou mais estreita que o menos experiente
    const deltaAcc = fbAccurate.knowledgeDelta?.frontWing
    const deltaRok = fbRookie.knowledgeDelta?.frontWing

    if (deltaAcc && deltaRok) {
      const spreadAcc = deltaAcc.max - deltaAcc.min
      const spreadRok = deltaRok.max - deltaRok.min
      expect(spreadAcc).toBeLessThanOrEqual(spreadRok)
    }
  })

  // Teste H: Programa car_setup -> maior ganho de conhecimento que outros programas
  it('Teste H — Programa car_setup gera mais ganho de conhecimento que qualifying_sim', () => {
    const kInit = createInitialSetupKnowledge()

    const stintSetupProg = createMockStint({
      id: 'stint_setup',
      lapsCount: 4,
      program: 'car_setup',
    })
    const stintQualyProg = createMockStint({
      id: 'stint_qualy',
      lapsCount: 4,
      program: 'qualifying_sim',
    })

    const fbSetup = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: stintSetupProg,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: kInit,
    })

    const fbQualy = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: stintQualyProg,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: kInit,
    })

    // Delta do car_setup é mais focado/preciso
    const kAfterSetup = updateSetupKnowledge(kInit, fbSetup)
    const kAfterQualy = updateSetupKnowledge(kInit, fbQualy)

    expect(kAfterSetup.frontWing.confidenceScore).toBeGreaterThanOrEqual(
      kAfterQualy.frontWing.confidenceScore,
    )
  })

  // Teste I: Reload -> mesma mensagem, mesmo conhecimento
  it('Teste I — Reload: reidratar sessão preserva frases exatas e conhecimento consolidado', async () => {
    const prep = createInitialPracticePreparation({
      careerId: 'audi_team',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
    })

    const initial = practiceSessionService.createInitialSessionState({
      careerId: 'audi_team',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
      preparation: prep,
    })

    // Simula stint e feedback persistido
    const mockFeedback = evaluateStintFeedback({
      sessionId: 'audi_team_season_2026_1_tp1',
      stint: createMockStint({ id: 'stint_saved', lapsCount: 5 }),
      driver: accurateDriver,
      round: 1,
      weather: 'seco',
      currentKnowledge: initial.knowledge,
    })

    initial.feedbacks.push(mockFeedback)
    initial.knowledge = updateSetupKnowledge(initial.knowledge, mockFeedback)

    await practiceSessionService.saveSessionState(initial)

    // Recarrega
    const reloaded = await practiceSessionService.openOrResumePracticeSession({
      careerId: 'audi_team',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
      preparation: prep,
    })

    expect(reloaded.isResumed).toBe(true)
    expect(reloaded.session.feedbacks).toHaveLength(1)
    expect(reloaded.session.feedbacks[0].generalMessage).toBe(mockFeedback.generalMessage)
    expect(reloaded.session.feedbacks[0].axisFeedbacks[0].message).toBe(
      mockFeedback.axisFeedbacks[0].message,
    )
    expect(reloaded.session.knowledge.frontWing.minKnown).toBe(initial.knowledge.frontWing.minKnown)
  })

  // Teste J: Idempotência -> processar mesmo stint 2x atualiza conhecimento uma única vez
  it('Teste J — Idempotência: processar o mesmo stint duas vezes não duplica feedback nem altera contadores', () => {
    const kInit = createInitialSetupKnowledge()
    const stint = createMockStint({ id: 'stint_unique', lapsCount: 5 })

    const fb = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: kInit,
    })

    const kAfterFirst = updateSetupKnowledge(kInit, fb)
    expect(kAfterFirst.totalStintsAnalyzed).toBe(1)

    // Segunda chamada com o mesmo feedback
    const kAfterSecond = updateSetupKnowledge(kAfterFirst, fb)
    expect(kAfterSecond.totalStintsAnalyzed).toBe(1)
    expect(kAfterSecond.lastUpdatedStintId).toBe('stint_unique')
  })

  // Teste K: Alteração entre stints -> cada feedback usa o snapshot correto do seu stint
  it('Teste K — Alteração de setup entre stints: cada feedback usa estritamente o snapshot do stint respectivo', () => {
    const k = createInitialSetupKnowledge()

    const setupStint1: PracticeCarSetup = {
      frontWing: 3,
      rearWing: 4,
      suspension: 5,
      differential: 40,
    }
    const setupStint2: PracticeCarSetup = {
      frontWing: 9,
      rearWing: 8,
      suspension: 7,
      differential: 70,
    }

    const s1 = createMockStint({ id: 's1', lapsCount: 4, setup: setupStint1 })
    const s2 = createMockStint({ id: 's2', lapsCount: 4, setup: setupStint2 })

    const fb1 = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: s1,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: k,
    })

    const fb2 = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: s2,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: k,
    })

    expect(fb1.setupSnapshot.frontWing).toBe(3)
    expect(fb2.setupSnapshot.frontWing).toBe(9)
  })

  // Teste L: Dois carros com feedbacks simultâneos -> sem sobrescrita, atribuição correta
  it('Teste L — Dois carros simultâneos: alimentam o mesmo conhecimento da equipe sem sobrescrever dados', () => {
    const kInit = createInitialSetupKnowledge()

    const stintCar1 = createMockStint({
      id: 'stint_c1',
      carId: 'car1',
      driverId: 'drv_c1',
      lapsCount: 5,
    })
    const stintCar2 = createMockStint({
      id: 'stint_c2',
      carId: 'car2',
      driverId: 'drv_c2',
      lapsCount: 5,
    })

    const fb1 = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: stintCar1,
      driver: accurateDriver,
      round,
      weather: 'seco',
      currentKnowledge: kInit,
    })

    const kAfterC1 = updateSetupKnowledge(kInit, fb1)

    const fb2 = evaluateStintFeedback({
      sessionId: 'sess_1',
      stint: stintCar2,
      driver: rookieDriver,
      round,
      weather: 'seco',
      currentKnowledge: kAfterC1,
    })

    const kAfterBoth = updateSetupKnowledge(kAfterC1, fb2)

    expect(fb1.carId).toBe('car1')
    expect(fb2.carId).toBe('car2')
    expect(kAfterBoth.totalStintsAnalyzed).toBe(2)
  })

  // Teste M: Finalização do TL1 -> conhecimento persistido
  it('Teste M — Finalização do TL1: conhecimento e feedbacks permanecem salvos no estado concluído', async () => {
    const prep = createInitialPracticePreparation({
      careerId: 'audi_team',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
    })

    const session = practiceSessionService.createInitialSessionState({
      careerId: 'audi_team',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
      preparation: prep,
    })

    // Adiciona feedback
    const fb = evaluateStintFeedback({
      sessionId: 'sess_finish_test',
      stint: createMockStint({ lapsCount: 5 }),
      driver: accurateDriver,
      round: 1,
      weather: 'seco',
      currentKnowledge: session.knowledge,
    })
    session.feedbacks.push(fb)
    session.knowledge = updateSetupKnowledge(session.knowledge, fb)

    const completed = await practiceSessionService.markPracticeCompleted(session)
    expect(completed.status).toBe('completed')
    expect(completed.feedbacks).toHaveLength(1)
    expect(completed.knowledge.frontWing.revealed).toBe(true)
  })

  // Teste N: Regressão 4B (runner de treino) -> zero regressões
  it('Teste N — Regressão 4B: avanço de ticks e transições de treino continuam canônicas', () => {
    const prep = createInitialPracticePreparation({
      careerId: 'audi_team',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
    })

    const session = practiceSessionService.createInitialSessionState({
      careerId: 'audi_team',
      seasonId: 'season_2026',
      round: 1,
      sessionType: 'tp1',
      preparation: prep,
    })
    session.status = 'running'

    PracticeSessionRunner.orderCarExitToTrack(session, 'car1')
    expect(session.cars.car1.status).toBe('out_lap')

    session.cars.car1.currentLapProgressPct = 100
    const tick = PracticeSessionRunner.tick(session, 1, {
      round: 1,
      gpName: 'Austrália',
      circuitName: 'Albert Park',
      lengthKm: 5.278,
      tireAbrasiveness: 6,
      weather: 'seco',
      teamChassisRating: 75,
      teamEngineSupplier: 'Audi',
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      drivers: [accurateDriver],
    })

    expect(tick.nextState.cars.car1.status).toBe('flying_lap')
  })

  // Teste O: Regressão Corrida ao Vivo -> zero regressões
  it('Teste O — Regressão Corrida ao Vivo: advanceCanonicalRaceLap mantém integridade física e esportiva', () => {
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
    expect(raceLapResult.isCompleted).toBe(false)
  })
})
