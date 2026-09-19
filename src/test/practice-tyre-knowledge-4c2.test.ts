import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createInitialWeekendTyreKnowledge,
  evaluateTyreStint,
  updateTyreKnowledge,
  classifyDegradationRate,
  classifyConsistency,
  formatDegradationLevel,
  formatUsefulWindowLabel,
  formatPaceDropLabel,
  formatConsistencyLabel,
  CANONICAL_COMPOUNDS,
} from '@/services/canonicalPracticeTyreService'
import {
  evaluateStintFeedback,
  createInitialSetupKnowledge,
} from '@/services/canonicalPracticeFeedbackService'
import { PracticeSessionRunner } from '@/services/canonicalPracticeRunner'
import { practiceSessionService } from '@/services/practiceSessionService'
import { advanceCanonicalRaceLap } from '@/services/canonicalRaceRunner'
import type { PracticeStint } from '@/types/practice-session'
import type { DriverFeedbackProfile } from '@/services/canonicalPracticeFeedbackService'
import type { PracticePreparation } from '@/types/practice-preparation'
import type { TireCompound } from '@/types/f1'

describe('APEX GP MANAGER — ETAPA 4C2: Conhecimento Progressivo de Pneus e Comportamento dos Compostos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  const mockDriverSenior: DriverFeedbackProfile = {
    id: 'drv_hulkenberg',
    name: 'Nico Hülkenberg',
    technical_feedback: 88,
    consistency: 86,
    speed: 84,
  }

  const mockDriverJunior: DriverFeedbackProfile = {
    id: 'drv_rookie',
    name: 'Piloto Novato',
    technical_feedback: 62,
    consistency: 65,
    speed: 79,
  }

  const createMockStint = (overrides?: Partial<PracticeStint>): PracticeStint => {
    const lapsCount = overrides?.lapsCount ?? 6
    const laps = Array.from({ length: lapsCount }, (_, i) => ({
      lapNumber: i + 1,
      lapTimeSec: 80.5 + i * 0.08,
      lapTimeFormatted: '1:20.500',
      compound: overrides?.compound ?? ('medio' as TireCompound),
      tyreWear: 2 + (i + 1) * 2.2,
      fuelRemainingKg: 28 - (i + 1) * 1.6,
      program: overrides?.program ?? 'race_pace',
      stintId: overrides?.id ?? 'stint_test_1',
      isValid: true,
      isPersonalBest: false,
      isSessionBest: false,
      timestamp: new Date().toISOString(),
    }))

    return {
      id: 'stint_test_1',
      driverId: 'drv_hulkenberg',
      carId: 'car1',
      program: 'race_pace',
      setupSnapshot: {
        frontWing: 6,
        rearWing: 6,
        suspension: 6,
        differential: 50,
      },
      tyreSetId: 'set_med_1',
      compound: 'medio',
      initialFuelKg: 28,
      finalFuelKg: 28 - lapsCount * 1.6,
      initialWear: 2,
      finalWear: 2 + lapsCount * 2.2,
      lapsCount,
      laps,
      startedAt: new Date().toISOString(),
      status: 'completed',
      ...overrides,
    }
  }

  // TESTE A: Sem dados: composto nunca utilizado -> "?" e "Sem dados"
  it('Teste A — Sem dados: composto nunca utilizado exibe "?" e confiança "sem_dados"', () => {
    const knowledge = createInitialWeekendTyreKnowledge()

    CANONICAL_COMPOUNDS.forEach((comp) => {
      const data = knowledge[comp]
      expect(data).toBeDefined()
      expect(data.overallConfidence).toBe('sem_dados')
      expect(data.degradation.revealed).toBe(false)
      expect(data.degradation.confidence).toBe('sem_dados')
      expect(data.usefulWindow.revealed).toBe(false)
      expect(data.usefulWindow.confidence).toBe('sem_dados')
      expect(data.paceDrop.revealed).toBe(false)
      expect(data.consistency.revealed).toBe(false)
      expect(formatDegradationLevel(data.degradation.value)).toBe('?')
      expect(formatUsefulWindowLabel(data.usefulWindow.value)).toBe('?')
      expect(formatPaceDropLabel(data.paceDrop.value)).toBe('?')
      expect(formatConsistencyLabel(data.consistency.value)).toBe('?')
    })
  })

  // TESTE B: Stint insuficiente (<= 1 volta) -> sem falsa precisão
  it('Teste B — Stint insuficiente (<= 1 volta) não inventa precisão nem estreita janelas úteis', () => {
    const knowledge = createInitialWeekendTyreKnowledge()
    const shortStint = createMockStint({ lapsCount: 1, laps: [] })

    const obs = evaluateTyreStint({
      sessionId: 'sess_1',
      stint: shortStint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: knowledge,
    })

    expect(obs.quality).toBe('insufficient')
    expect(obs.summaryMessage).toContain('insuficiente')

    const updated = updateTyreKnowledge(knowledge, obs)
    const medioKnowledge = updated.medio

    // As dimensões principais permanecem não reveladas ("?")
    expect(medioKnowledge.degradation.revealed).toBe(false)
    expect(medioKnowledge.usefulWindow.revealed).toBe(false)
    expect(medioKnowledge.paceDrop.revealed).toBe(false)
    expect(medioKnowledge.consistency.revealed).toBe(false)
    expect(medioKnowledge.totalStintsObserved).toBe(1)
    expect(medioKnowledge.totalLapsObserved).toBe(1)
  })

  // TESTE C: Stint válido -> observação criada e conhecimento atualizado
  it('Teste C — Stint válido cria observação completa e atualiza o conhecimento do composto', () => {
    const knowledge = createInitialWeekendTyreKnowledge()
    const stint = createMockStint({ lapsCount: 6, compound: 'medio' })

    const obs = evaluateTyreStint({
      sessionId: 'sess_1',
      stint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: knowledge,
    })

    expect(obs.quality).toBe('reliable')
    expect(obs.compound).toBe('medio')
    expect(obs.wearPerLap).toBeGreaterThan(0)
    expect(obs.observedDegradationLevel).toBeDefined()
    expect(obs.estimatedUsefulWindow.minLaps).toBeGreaterThan(0)
    expect(obs.estimatedUsefulWindow.maxLaps).toBeGreaterThan(obs.estimatedUsefulWindow.minLaps)

    const updated = updateTyreKnowledge(knowledge, obs)
    const medio = updated.medio

    expect(medio.degradation.revealed).toBe(true)
    expect(medio.usefulWindow.revealed).toBe(true)
    expect(medio.paceDrop.revealed).toBe(true)
    expect(medio.consistency.revealed).toBe(true)
    expect(medio.overallConfidence).not.toBe('sem_dados')
    expect(medio.totalLapsObserved).toBe(6)
    expect(medio.testedDrivers).toContain(mockDriverSenior.id)
  })

  // TESTE D: Degradação -> categorias coerentes com o desgaste real
  it('Teste D — Classificação de degradação mapeia fielmente a taxa física observada', () => {
    expect(classifyDegradationRate(0.8)).toBe('muito_baixa')
    expect(classifyDegradationRate(1.5)).toBe('baixa')
    expect(classifyDegradationRate(2.5)).toBe('moderada')
    expect(classifyDegradationRate(3.8)).toBe('alta')
    expect(classifyDegradationRate(5.2)).toBe('muito_alta')

    // Stint com desgaste moderado
    const stint = createMockStint({ initialWear: 2, finalWear: 16, lapsCount: 6 }) // wearPerLap = 2.33
    const obs = evaluateTyreStint({
      sessionId: 'sess_1',
      stint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: createInitialWeekendTyreKnowledge(),
    })
    expect(obs.observedDegradationLevel).toBe('moderada')
  })

  // TESTE E: Janela útil -> dados parciais geram faixa ampla; mais dados estreitam progressivamente
  it('Teste E — Dados parciais geram faixa ampla; mais rodagem consolida e estreita a janela', () => {
    const knowledge = createInitialWeekendTyreKnowledge()

    // Stint preliminar de 3 voltas
    const shortStint = createMockStint({
      id: 'stint_short',
      lapsCount: 3,
      initialWear: 2,
      finalWear: 8,
      program: 'race_pace',
    })
    const obsShort = evaluateTyreStint({
      sessionId: 'sess_1',
      stint: shortStint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: knowledge,
    })
    const k1 = updateTyreKnowledge(knowledge, obsShort)
    const window1 = k1.medio.usefulWindow.value!
    const spread1 = window1.maxLaps - window1.minLaps

    // Stint longo de 10 voltas adicionais
    const longStint = createMockStint({
      id: 'stint_long',
      lapsCount: 10,
      initialWear: 8,
      finalWear: 30,
      program: 'race_pace',
    })
    const obsLong = evaluateTyreStint({
      sessionId: 'sess_1',
      stint: longStint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: k1,
    })
    const k2 = updateTyreKnowledge(k1, obsLong)
    const window2 = k2.medio.usefulWindow.value!
    const spread2 = window2.maxLaps - window2.minLaps

    expect(spread1).toBeGreaterThanOrEqual(spread2)
    expect(k2.medio.usefulWindow.confidenceScore).toBeGreaterThan(
      k1.medio.usefulWindow.confidenceScore,
    )
  })

  // TESTE F: Combustível -> queda de tempo causada por combustível NÃO atribuída ao pneu
  it('Teste F — Normalização de combustível: redução de peso não mascara a degradação do pneu', () => {
    // Simula 5 voltas onde o tempo bruto do cronômetro é IDÊNTICO (80.0s),
    // enquanto o combustível caiu de 30kg para 22kg (-8kg = ~0.28s mais rápido em carro puro).
    // Logo, o pneu na verdade perdeu rendimento por volta (+0.056s/volta normalizado)!
    const laps = [
      {
        lapNumber: 1,
        lapTimeSec: 80.0,
        lapTimeFormatted: '1:20.000',
        compound: 'medio' as const,
        tyreWear: 5,
        fuelRemainingKg: 30,
        program: 'race_pace' as const,
        stintId: 'st_f',
        isValid: true,
        isPersonalBest: false,
        isSessionBest: false,
        timestamp: '',
      },
      {
        lapNumber: 2,
        lapTimeSec: 80.0,
        lapTimeFormatted: '1:20.000',
        compound: 'medio' as const,
        tyreWear: 7,
        fuelRemainingKg: 28,
        program: 'race_pace' as const,
        stintId: 'st_f',
        isValid: true,
        isPersonalBest: false,
        isSessionBest: false,
        timestamp: '',
      },
      {
        lapNumber: 3,
        lapTimeSec: 80.0,
        lapTimeFormatted: '1:20.000',
        compound: 'medio' as const,
        tyreWear: 9,
        fuelRemainingKg: 26,
        program: 'race_pace' as const,
        stintId: 'st_f',
        isValid: true,
        isPersonalBest: false,
        isSessionBest: false,
        timestamp: '',
      },
      {
        lapNumber: 4,
        lapTimeSec: 80.0,
        lapTimeFormatted: '1:20.000',
        compound: 'medio' as const,
        tyreWear: 11,
        fuelRemainingKg: 24,
        program: 'race_pace' as const,
        stintId: 'st_f',
        isValid: true,
        isPersonalBest: false,
        isSessionBest: false,
        timestamp: '',
      },
      {
        lapNumber: 5,
        lapTimeSec: 80.0,
        lapTimeFormatted: '1:20.000',
        compound: 'medio' as const,
        tyreWear: 13,
        fuelRemainingKg: 22,
        program: 'race_pace' as const,
        stintId: 'st_f',
        isValid: true,
        isPersonalBest: false,
        isSessionBest: false,
        timestamp: '',
      },
    ]

    const stint = createMockStint({ id: 'st_f', lapsCount: 5, laps, initialWear: 3, finalWear: 13 })
    const obs = evaluateTyreStint({
      sessionId: 'sess_1',
      stint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: createInitialWeekendTyreKnowledge(),
    })

    // O ritmo normalizado detecta queda real de rendimento do pneu (> 0), mesmo com tempo bruto constante
    expect(obs.observedPaceDropPerLapSec).toBeGreaterThan(0)
  })

  // TESTE G: Programa Conhecimento de Pneus -> maior ganho de conhecimento
  it('Teste G — Programa tyre_knowledge obtém o maior ganho de conhecimento em condições equivalentes', () => {
    const k = createInitialWeekendTyreKnowledge()
    const stintBase = createMockStint({ lapsCount: 6 })

    const obsTyreProg = evaluateTyreStint({
      sessionId: 'sess_1',
      stint: { ...stintBase, id: 'st_prog_1', program: 'tyre_knowledge' },
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: k,
    })

    const obsSetupProg = evaluateTyreStint({
      sessionId: 'sess_1',
      stint: { ...stintBase, id: 'st_prog_2', program: 'car_setup' },
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: k,
    })

    expect(obsTyreProg.knowledgeGain).toBeGreaterThan(obsSetupProg.knowledgeGain)
  })

  // TESTE H: Ritmo de Corrida (long run) -> ganho relevante
  it('Teste H — Ritmo de Corrida (long run) produz ganho relevante de conhecimento de pneu', () => {
    const k = createInitialWeekendTyreKnowledge()
    const stint = createMockStint({ id: 'st_long', lapsCount: 8, program: 'race_pace' })

    const obs = evaluateTyreStint({
      sessionId: 'sess_1',
      stint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: k,
    })

    expect(obs.quality).toBe('reliable')
    expect(obs.knowledgeGain).toBeGreaterThanOrEqual(30)
  })

  // TESTE I: Qualifying Sim -> stint curto não inventa vida útil de corrida precisa
  it('Teste I — Qualifying Sim em stint curto não infere janela útil de corrida com alta precisão', () => {
    const k = createInitialWeekendTyreKnowledge()
    const stintQualy = createMockStint({ id: 'st_q', lapsCount: 2, program: 'qualifying_sim' })

    const obs = evaluateTyreStint({
      sessionId: 'sess_1',
      stint: stintQualy,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: k,
    })

    expect(obs.summaryMessage).toContain('Simulação de Classificação')
    const updated = updateTyreKnowledge(k, obs)

    // Janela útil NÃO deve ser revelada ou estreitada por qualifying_sim
    expect(updated.medio.usefulWindow.revealed).toBe(false)
  })

  // TESTE J: Dois compostos independentes (Carro 1 Médio / Carro 2 Duro)
  it('Teste J — Carro 1 no Médio e Carro 2 no Duro aprendem ambos os compostos isoladamente', () => {
    const k = createInitialWeekendTyreKnowledge()
    const stintC1 = createMockStint({ id: 'st_c1', carId: 'car1', compound: 'medio', lapsCount: 6 })
    const stintC2 = createMockStint({ id: 'st_c2', carId: 'car2', compound: 'duro', lapsCount: 6 })

    const obsC1 = evaluateTyreStint({
      sessionId: 's1',
      stint: stintC1,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: k,
    })
    const kAfterC1 = updateTyreKnowledge(k, obsC1)

    const obsC2 = evaluateTyreStint({
      sessionId: 's1',
      stint: stintC2,
      driver: mockDriverJunior,
      weather: 'seco',
      currentKnowledge: kAfterC1,
    })
    const kFinal = updateTyreKnowledge(kAfterC1, obsC2)

    // Ambos os compostos foram aprendidos de forma independente
    expect(kFinal.medio.degradation.revealed).toBe(true)
    expect(kFinal.medio.totalStintsObserved).toBe(1)
    expect(kFinal.duro.degradation.revealed).toBe(true)
    expect(kFinal.duro.totalStintsObserved).toBe(1)

    // Macio e chuva continuam sem dados
    expect(kFinal.macio.overallConfidence).toBe('sem_dados')
    expect(kFinal.chuva_extrema.overallConfidence).toBe('sem_dados')
  })

  // TESTE K: Mesmo composto (Carro 1 + Carro 2 Médio) consolida evidência sem sobrescrever
  it('Teste K — Carro 1 e Carro 2 ambos no Médio consolidam evidência cumulativa sem sobrescrita', () => {
    const k = createInitialWeekendTyreKnowledge()
    const stintC1 = createMockStint({
      id: 'st_k1',
      carId: 'car1',
      driverId: 'drv1',
      compound: 'medio',
      lapsCount: 5,
    })
    const stintC2 = createMockStint({
      id: 'st_k2',
      carId: 'car2',
      driverId: 'drv2',
      compound: 'medio',
      lapsCount: 6,
    })

    const obsC1 = evaluateTyreStint({
      sessionId: 's1',
      stint: stintC1,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: k,
    })
    const k1 = updateTyreKnowledge(k, obsC1)

    const obsC2 = evaluateTyreStint({
      sessionId: 's1',
      stint: stintC2,
      driver: mockDriverJunior,
      weather: 'seco',
      currentKnowledge: k1,
    })
    const k2 = updateTyreKnowledge(k1, obsC2)

    const medio = k2.medio
    expect(medio.totalStintsObserved).toBe(2)
    expect(medio.totalLapsObserved).toBe(11)
    expect(medio.testedCars).toEqual(['car1', 'car2'])
    expect(medio.testedDrivers).toContain('drv1')
    expect(medio.testedDrivers).toContain('drv2')
    expect(medio.degradation.confidenceScore).toBeGreaterThan(k1.medio.degradation.confidenceScore)
  })

  // TESTE L: Clima incompatível (seco vs molhado) não consolida cegamente
  it('Teste L — Dados coletados em condições secas vs molhadas são segmentados com peso adequado', () => {
    const k = createInitialWeekendTyreKnowledge()
    const stintDry = createMockStint({ id: 'st_dry', compound: 'intermediario', lapsCount: 5 })
    const obsDry = evaluateTyreStint({
      sessionId: 's1',
      stint: stintDry,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: k,
    })
    const kDry = updateTyreKnowledge(k, obsDry)

    const stintWet = createMockStint({ id: 'st_wet', compound: 'intermediario', lapsCount: 5 })
    const obsWet = evaluateTyreStint({
      sessionId: 's1',
      stint: stintWet,
      driver: mockDriverSenior,
      weather: 'chuva_fraca',
      currentKnowledge: kDry,
    })
    const kWet = updateTyreKnowledge(kDry, obsWet)

    expect(kWet.intermediario.testedConditions).toContain('seco')
    expect(kWet.intermediario.testedConditions).toContain('chuva_fraca')
    expect(kWet.intermediario.totalStintsObserved).toBe(2)
  })

  // TESTE M: Idempotência: processar o mesmo stint duas vezes não duplica observações nem conhecimento
  it('Teste M — Idempotência: reprocessar o mesmo stint não altera contadores nem duplica deltas', () => {
    const k = createInitialWeekendTyreKnowledge()
    const stint = createMockStint({ id: 'stint_idem', lapsCount: 6 })

    const obs = evaluateTyreStint({
      sessionId: 's1',
      stint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: k,
    })
    const k1 = updateTyreKnowledge(k, obs)
    const snapshot1 = JSON.stringify(k1)

    const k2 = updateTyreKnowledge(k1, obs)
    expect(JSON.stringify(k2)).toBe(snapshot1)
    expect(k2.medio.totalStintsObserved).toBe(1)
  })

  // TESTE N: Reload -> preserva conhecimento consolidado e histórico
  it('Teste N — Reload / persistência preserva rigorosamente observações e conhecimento', async () => {
    const prep: PracticePreparation = {
      careerId: 'car_reload',
      seasonId: 's2026',
      round: 1,
      sessionType: 'tp1',
      status: 'ready',
      cars: [
        {
          carId: 'car1',
          driverId: 'drv1',
          program: 'race_pace',
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          tyreSelection: { setId: 's1', compound: 'medio', isReserved: true },
          fuelLoad: { kg: 25, estimatedLaps: 15 },
          objective: 'Test objective',
          status: 'ready',
        },
        {
          carId: 'car2',
          driverId: 'drv2',
          program: 'car_setup',
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          tyreSelection: { setId: 's2', compound: 'duro', isReserved: true },
          fuelLoad: { kg: 25, estimatedLaps: 15 },
          objective: 'Test objective',
          status: 'ready',
        },
      ],
      updatedAt: new Date().toISOString(),
    }

    const session = practiceSessionService.createInitialSessionState({
      careerId: 'car_reload',
      seasonId: 's2026',
      round: 1,
      sessionType: 'tp1',
      preparation: prep,
    })

    const stint = createMockStint({ id: 'st_rel', compound: 'medio', lapsCount: 6 })
    const obs = evaluateTyreStint({
      sessionId: 'sess_rel',
      stint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: session.tyreKnowledge!,
    })
    session.tyreObservations = [obs]
    session.tyreKnowledge = updateTyreKnowledge(session.tyreKnowledge!, obs)

    await practiceSessionService.saveSessionState(session)
    const reloaded = practiceSessionService.readFromLocalCache('car_reload', 's2026', 1, 'tp1')

    expect(reloaded).not.toBeNull()
    expect(reloaded!.tyreObservations).toHaveLength(1)
    expect(reloaded!.tyreKnowledge!.medio.degradation.revealed).toBe(true)
    expect(reloaded!.tyreKnowledge!.medio.totalStintsObserved).toBe(1)
  })

  // TESTE O: Coexistência 4C1 + 4C2 -> mesmo stint gera feedback de setup e observação de pneu
  it('Teste O — Coexistência 4C1 + 4C2: o fechamento do stint processa setup e pneus na mesma esteira', () => {
    const setupK = createInitialSetupKnowledge()
    const tyreK = createInitialWeekendTyreKnowledge()
    const stint = createMockStint({ id: 'st_coex', lapsCount: 6 })

    // 4C1 Setup
    const setupFb = evaluateStintFeedback({
      sessionId: 'sess_coex',
      stint,
      driver: mockDriverSenior,
      round: 1,
      weather: 'seco',
      currentKnowledge: setupK,
    })
    expect(setupFb.quality).toBe('reliable')
    expect(setupFb.axisFeedbacks.length).toBeGreaterThan(0)

    // 4C2 Pneus
    const tyreObs = evaluateTyreStint({
      sessionId: 'sess_coex',
      stint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: tyreK,
    })
    expect(tyreObs.quality).toBe('reliable')
    expect(tyreObs.observedDegradationLevel).toBeDefined()

    const updatedTyreK = updateTyreKnowledge(tyreK, tyreObs)
    expect(updatedTyreK.medio.degradation.revealed).toBe(true)
  })

  // TESTE P: TL1 -> TL2: conhecimento adquirido no TL1 é herdado no TL2 no mesmo fim de semana
  it('Teste P — TL1 → TL2: o conhecimento de pneus consolidado no TL1 fica disponível no TL2', async () => {
    const prep1: PracticePreparation = {
      careerId: 'car_tl1_tl2',
      seasonId: 's2026',
      round: 3,
      sessionType: 'tp1',
      status: 'ready',
      cars: [
        {
          carId: 'car1',
          driverId: 'drv1',
          program: 'tyre_knowledge',
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          tyreSelection: { setId: 's1', compound: 'medio', isReserved: true },
          fuelLoad: { kg: 25, estimatedLaps: 15 },
          objective: 'Test objective',
          status: 'ready',
        },
        {
          carId: 'car2',
          driverId: 'drv2',
          program: 'race_pace',
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          tyreSelection: { setId: 's2', compound: 'duro', isReserved: true },
          fuelLoad: { kg: 25, estimatedLaps: 15 },
          objective: 'Test objective',
          status: 'ready',
        },
      ],
      updatedAt: new Date().toISOString(),
    }

    // Criar e simular stint no TL1
    const sessionTL1 = practiceSessionService.createInitialSessionState({
      careerId: 'car_tl1_tl2',
      seasonId: 's2026',
      round: 3,
      sessionType: 'tp1',
      preparation: prep1,
    })

    const stintTL1 = createMockStint({
      id: 'st_tl1',
      compound: 'medio',
      lapsCount: 8,
      program: 'tyre_knowledge',
    })
    const obsTL1 = evaluateTyreStint({
      sessionId: 's_tl1',
      stint: stintTL1,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: sessionTL1.tyreKnowledge!,
    })
    sessionTL1.tyreObservations = [obsTL1]
    sessionTL1.tyreKnowledge = updateTyreKnowledge(sessionTL1.tyreKnowledge!, obsTL1)
    await practiceSessionService.saveSessionState(sessionTL1)

    // Agora abrir TL2 para o mesmo round
    const prep2: PracticePreparation = { ...prep1, sessionType: 'tp2' }
    const sessionTL2 = await practiceSessionService.openOrResumePracticeSession({
      careerId: 'car_tl1_tl2',
      seasonId: 's2026',
      round: 3,
      sessionType: 'tp2',
      preparation: prep2,
    })

    // TL2 deve herdar o conhecimento de Médios adquirido no TL1
    expect(sessionTL2.session.tyreKnowledge).toBeDefined()
    expect(sessionTL2.session.tyreKnowledge!.medio.degradation.revealed).toBe(true)
    expect(sessionTL2.session.tyreKnowledge!.medio.totalStintsObserved).toBe(1)
  })

  // TESTE Q: Finalização do treino -> resumo persistido
  it('Teste Q — Finalização do treino: markPracticeCompleted preserva o conhecimento e observações', async () => {
    const prep: PracticePreparation = {
      careerId: 'car_fin',
      seasonId: 's2026',
      round: 1,
      sessionType: 'tp1',
      status: 'ready',
      cars: [
        {
          carId: 'car1',
          driverId: 'drv1',
          program: 'race_pace',
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          tyreSelection: { setId: 's1', compound: 'medio', isReserved: true },
          fuelLoad: { kg: 25, estimatedLaps: 15 },
          objective: 'Test objective',
          status: 'ready',
        },
        {
          carId: 'car2',
          driverId: 'drv2',
          program: 'race_pace',
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          tyreSelection: { setId: 's2', compound: 'medio', isReserved: true },
          fuelLoad: { kg: 25, estimatedLaps: 15 },
          objective: 'Test objective',
          status: 'ready',
        },
      ],
      updatedAt: new Date().toISOString(),
    }

    const session = practiceSessionService.createInitialSessionState({
      careerId: 'car_fin',
      seasonId: 's2026',
      round: 1,
      sessionType: 'tp1',
      preparation: prep,
    })

    const stint = createMockStint({ id: 'st_fin', compound: 'macio', lapsCount: 6 })
    const obs = evaluateTyreStint({
      sessionId: 's_fin',
      stint,
      driver: mockDriverSenior,
      weather: 'seco',
      currentKnowledge: session.tyreKnowledge!,
    })
    session.tyreObservations = [obs]
    session.tyreKnowledge = updateTyreKnowledge(session.tyreKnowledge!, obs)

    const completed = await practiceSessionService.markPracticeCompleted(session)
    expect(completed.status).toBe('completed')
    expect(completed.tyreKnowledge!.macio.degradation.revealed).toBe(true)
    expect(completed.tyreObservations).toHaveLength(1)
  })

  // TESTE R: Regressão 4B (PracticeSessionRunner)
  it('Teste R — Regressão 4B: avanço de ticks e transições de treino continuam canônicas', () => {
    const prep: PracticePreparation = {
      careerId: 'reg_4b',
      seasonId: 's2026',
      round: 1,
      sessionType: 'tp1',
      status: 'ready',
      cars: [
        {
          carId: 'car1',
          driverId: 'drv1',
          program: 'race_pace',
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          tyreSelection: { setId: 's1', compound: 'medio', isReserved: true },
          fuelLoad: { kg: 25, estimatedLaps: 15 },
          objective: 'Test objective',
          status: 'ready',
        },
        {
          carId: 'car2',
          driverId: 'drv2',
          program: 'car_setup',
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          tyreSelection: { setId: 's2', compound: 'duro', isReserved: true },
          fuelLoad: { kg: 25, estimatedLaps: 15 },
          objective: 'Test objective',
          status: 'ready',
        },
      ],
      updatedAt: new Date().toISOString(),
    }

    const session = practiceSessionService.createInitialSessionState({
      careerId: 'reg_4b',
      seasonId: 's2026',
      round: 1,
      sessionType: 'tp1',
      preparation: prep,
    })
    session.status = 'running'

    const orderRes = PracticeSessionRunner.orderCarExitToTrack(session, 'car1')
    expect(orderRes.success).toBe(true)
    expect(session.cars.car1.status).toBe('out_lap')

    const tickRes = PracticeSessionRunner.tick(session, 10, {
      round: 1,
      gpName: 'GP Test',
      circuitName: 'Circuito Test',
      lengthKm: 5.0,
      weather: 'seco',
      tireAbrasiveness: 6,
      teamChassisRating: 75,
      teamEngineSupplier: 'Audi',
      teamName: 'Audi Test',
      teamColor: '#E10600',
      drivers: [
        {
          id: mockDriverSenior.id,
          name: mockDriverSenior.name,
          speed: mockDriverSenior.speed,
          consistency: mockDriverSenior.consistency,
          defense: 80,
          technical_feedback: mockDriverSenior.technical_feedback,
        },
      ],
    })

    expect(tickRes.nextState.elapsedTimeSec).toBe(10)
    expect(tickRes.nextState.timeRemainingSec).toBe(3590)
  })

  // TESTE S: Regressão Corrida Ao Vivo
  it('Teste S — Regressão Corrida Ao Vivo: advanceCanonicalRaceLap mantém integridade física e esportiva', () => {
    const dummyGrid = [
      {
        position: 1,
        gridPosition: 1,
        driverId: 'drv_test',
        driverName: 'Piloto Teste',
        teamId: 'team_audi',
        teamName: 'Equipe Teste',
        isPlayer: true,
        score: 85,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        accumulatedTimeSec: 80,
        tireCompound: 'medio' as const,
        tireWear: 5,
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
      playerCarTactics: { car1: 'normal' },
      playerPaceOrders: { car1: 'normal' },
      mechanicalIssues: [],
      redFlagState: {
        active: false,
        ticksFrozen: 0,
        usedThisRace: false,
        safetyCarLapsRemaining: 0,
      },
      lapHistory: {},
    })

    expect(raceLapResult).toBeDefined()
    expect(raceLapResult.nextGrid).toHaveLength(1)
    expect(raceLapResult.nextGrid[0].tireWear).toBeGreaterThan(5)
  })
})
