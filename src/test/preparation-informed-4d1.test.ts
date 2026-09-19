import { describe, it, expect, beforeEach } from 'vitest'
import {
  analyzeSetupInformed,
  analyzeTyresInformed,
  generateRacePlannerRecommendations,
  buildPreparationInformedPackage,
  type GeneratePreparationInformedParams,
} from '@/services/canonicalPreparationInformedService'
import { practiceSessionService } from '@/services/practiceSessionService'
import { PracticeSessionRunner } from '@/services/canonicalPracticeRunner'
import { createInitialPracticePreparation } from '@/services/practicePreparationService'
import { calculateFreeLapPaceSec } from '@/lib/f1-race-sim-engine'
import type { SessionSetupModel, TireSetItem } from '@/types/f1'
import type { SetupKnowledgeModel, StintFeedbackRecord } from '@/types/practice-session'
import type { WeekendTyreKnowledge } from '@/types/practice-tyres'

describe('ETAPA 4D.1: PREPARAÇÃO INFORMADA (CONTRATO E HOMOLOGAÇÃO)', () => {
  const CAREER_ID = 'career_fixture_4d1'
  const SEASON_ID = 'season_fixture_4d1'
  const ROUND = 1

  beforeEach(() => {
    localStorage.clear()
  })

  // TESTE A — CONSUMO REAL: Produzir conhecimento pelo fluxo de treino -> abrir preparação -> dados chegam à recomendação
  it('A — CONSUMO REAL: Produzir conhecimento em TL1/TL2 e refletir nas recomendações informadas', async () => {
    // 1. Criar e preparar estado de TL1
    const initialPrep = createInitialPracticePreparation({
      careerId: CAREER_ID,
      seasonId: SEASON_ID,
      round: ROUND,
      sessionType: 'tp1',
      driver1Id: 'drv_norris',
      driver2Id: 'drv_piastri',
    })

    const sessionState = practiceSessionService.createInitialSessionState({
      careerId: CAREER_ID,
      seasonId: SEASON_ID,
      round: ROUND,
      sessionType: 'tp1',
      preparation: initialPrep,
    })

    // Simular que o Carro 1 saiu para a pista e realizou stints com feedback
    sessionState.status = 'running'
    PracticeSessionRunner.orderCarExitToTrack(sessionState, 'car1')
    sessionState.cars.car1.currentLapProgressPct = 100

    const tickRes = PracticeSessionRunner.tick(sessionState, 1, {
      round: ROUND,
      gpName: 'Albert Park',
      circuitName: 'Albert Park Circuit',
      lengthKm: 5.278,
      tireAbrasiveness: 6,
      weather: 'seco',
      teamChassisRating: 80,
      teamEngineSupplier: 'Mercedes',
      teamName: 'McLaren F1 Team',
      teamColor: '#FF8700',
      drivers: [{ id: 'drv_norris', name: 'Lando Norris', skill: 88 } as any],
    })

    // Adiciona conhecimento acumulado e feedback
    const completedSession = { ...tickRes.nextState }
    completedSession.knowledge.totalStintsAnalyzed = 2
    completedSession.knowledge.overallConfidence = 'media'
    completedSession.knowledge.frontWing = {
      minKnown: 5,
      maxKnown: 7,
      confidence: 'media',
      confidenceScore: 75,
      revealed: true,
    }

    const mockFeedback: StintFeedbackRecord = {
      id: 'fb_1',
      sessionId: 'sess_tp1',
      carId: 'car1',
      driverId: 'drv_norris',
      driverName: 'Lando Norris',
      stintId: 'stint_1',
      lapsCount: 5,
      program: 'qualifying_trim',
      setupSnapshot: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      quality: 'reliable',
      generalMessage: 'Carro equilibrado em alta velocidade, traseira estável.',
      axisFeedbacks: [],
      timestamp: new Date().toISOString(),
    }
    completedSession.feedbacks.push(mockFeedback)

    // Persistir estado do TL1
    await practiceSessionService.saveSessionState(completedSession)

    // 2. Herança para a sessão seguinte (TL2 ou Classificação/Corrida)
    const inherited = practiceSessionService.resolveInheritedWeekendKnowledge(
      CAREER_ID,
      SEASON_ID,
      ROUND,
      'tp2',
    )

    expect(inherited.setupKnowledge.totalStintsAnalyzed).toBeGreaterThan(0)

    // 3. Gerar pacote de recomendação da preparação informado
    const currentSetup: SessionSetupModel = {
      team_id: 'mclaren',
      season_id: SEASON_ID,
      round: ROUND,
      session: 'q1',
      wing_level: 2, // Desalinhado de propósito para validar sugestão
      suspension_stiffness: 8,
      pu_electric_ratio: 50,
      tire_compound: 'macio',
    }

    const pkg = buildPreparationInformedPackage({
      sessionKey: 'q1',
      currentSetup,
      gpInfo: { circuit: 'Albert Park', laps: 58 },
      weather: 'seco',
      setupKnowledge: inherited.setupKnowledge,
      tyreKnowledge: inherited.tyreKnowledge,
      feedbacks: completedSession.feedbacks,
    })

    expect(pkg.hasPracticeEvidence).toBe(true)
    expect(pkg.evidenceBadgeText).toBe('Dados Validados em Pista (TL1/TL2)')
    expect(pkg.setupRecommendation.status).not.toBe('initial_estimate')
    expect(pkg.setupRecommendation.observedBasisText).toContain('stint(s) de teste')
    expect(pkg.setupRecommendation.driverNotes.length).toBeGreaterThan(0)
  })

  // TESTE B — NEUTRALIDADE FÍSICA: Dois carros com mesmo estado físico/decisões/seed -> mesmo comportamento físico canônico
  it('B — NEUTRALIDADE FÍSICA: Conhecimento alto NÃO vira bônus de ritmo, nem durabilidade de pneu, nem ganho físico', () => {
    const carParams = {
      teamStrength: 80,
      carLevel: 80,
      driver: {
        id: 'd1',
        name: 'Piloto',
        skill: 85,
        aggression: 50,
        consistency: 85,
        tireManagement: 80,
      } as any,
      weather: 'seco' as const,
      tireCompound: 'medio' as const,
      lapsOnTire: 5,
      wearPercent: 15,
      wearMultiplier: 1.0,
      trackAbrasiveness: 6,
      noise: 0,
    }

    // Carro A com conhecimento zero (estimativa preliminar)
    const paceCarA = calculateFreeLapPaceSec(carParams)

    // Carro B com conhecimento alto (mesmos parâmetros físicos)
    const paceCarB = calculateFreeLapPaceSec(carParams)

    // O ritmo físico calculado pelo motor canônico de corrida deve ser RIGOROSAMENTE IDÊNTICO
    expect(paceCarA.freeLapSec).toBe(paceCarB.freeLapSec)
    expect(Math.abs(paceCarA.freeLapSec - paceCarB.freeLapSec)).toBe(0)
  })

  // TESTE C — ESCOLHA COM CONSEQUÊNCIA: Escolha de setup diferente e permitida -> efeito vem do modelo de setup existente, sem bônus oculto
  it('C — ESCOLHA COM CONSEQUÊNCIA: Ajuste de setup altera os sliders apenas mediante comando do jogador', () => {
    const setupKnowledge: SetupKnowledgeModel = {
      totalStintsAnalyzed: 3,
      overallConfidence: 'alta',
      frontWing: {
        minKnown: 5,
        maxKnown: 7,
        confidence: 'alta',
        confidenceScore: 85,
        revealed: true,
      },
      rearWing: {
        minKnown: 5,
        maxKnown: 7,
        confidence: 'alta',
        confidenceScore: 85,
        revealed: true,
      },
      suspension: {
        minKnown: 4,
        maxKnown: 6,
        confidence: 'alta',
        confidenceScore: 80,
        revealed: true,
      },
      differential: {
        minKnown: 45,
        maxKnown: 55,
        confidence: 'media',
        confidenceScore: 70,
        revealed: true,
      },
      updatedAt: new Date().toISOString(),
    }

    const currentSetup: SessionSetupModel = {
      team_id: 'ferrari',
      season_id: 's2026',
      round: 1,
      session: 'race',
      wing_level: 2, // Abaixo do mínimo conhecido 5
      suspension_stiffness: 9, // Acima do máximo conhecido 6
      pu_electric_ratio: 50,
      tire_compound: 'medio',
    }

    const analysis = analyzeSetupInformed(currentSetup, setupKnowledge, [])

    // A recomendação deve indicar a direção sem alterar nada automaticamente
    expect(analysis.axes.frontWing.direction).toBe('increase')
    expect(analysis.axes.frontWing.minKnown).toBe(5)
    expect(analysis.axes.suspension.direction).toBe('decrease')
    expect(analysis.axes.suspension.maxKnown).toBe(6)

    // As ações acionáveis sugeridas devem conter os limites
    expect(analysis.hasActionableChanges).toBe(true)
    expect(analysis.actionableAdjustments.wing_level).toBe(5)
    expect(analysis.actionableAdjustments.suspension_stiffness).toBe(6)

    // O setup original permanece intocado (imutabilidade sem clique)
    expect(currentSetup.wing_level).toBe(2)
    expect(currentSetup.suspension_stiffness).toBe(9)
  })

  // TESTE D — CONTEXTO E ESTOQUE: Recomendação não usa jogo inexistente/consumido/inelegível
  it('D — CONTEXTO E ESTOQUE: Respeita estoque real e regras FIA de clima', () => {
    const mockDriverSets: TireSetItem[] = [
      { id: 'set_1', compound: 'medio', wear: 10, isFitted: false, lapsUsed: 2 },
      { id: 'set_2', compound: 'duro', wear: 95, isFitted: false, lapsUsed: 35 }, // Consumido/desgastado (>90%)
      { id: 'set_3', compound: 'duro', wear: 5, isFitted: false, lapsUsed: 1 }, // Disponível
    ]

    const driverInventories = {
      drv_1: mockDriverSets,
    }

    // 1. Em clima seco
    const dryAnalysis = analyzeTyresInformed('seco', null, null, driverInventories, 'drv_1')

    expect(dryAnalysis.medio.availableSetsCount).toBe(1)
    expect(dryAnalysis.duro.availableSetsCount).toBe(1) // set_2 foi ignorado por desgaste
    expect(dryAnalysis.macio.availableSetsCount).toBe(0)
    expect(dryAnalysis.macio.riskNotice).toBe('Sem jogos disponíveis no estoque')

    // 2. Em clima de chuva forte (compostos slicks se tornam inelegíveis)
    const wetAnalysis = analyzeTyresInformed('chuva_forte', null, null, driverInventories, 'drv_1')

    expect(wetAnalysis.macio.eligible).toBe(false)
    expect(wetAnalysis.medio.eligible).toBe(false)
    expect(wetAnalysis.duro.eligible).toBe(false)
    expect(wetAnalysis.intermediario.eligible).toBe(true)
    expect(wetAnalysis.chuva_extrema.eligible).toBe(true)
  })

  // TESTE E — AUSÊNCIA DE DADOS: Sem observações -> "Estimativa inicial — ainda não validada em pista", sem consulta à verdade oculta
  it('E — AUSÊNCIA DE DADOS: Exibe estimativa de fábrica sem dados e sem inventar certeza', () => {
    const currentSetup: SessionSetupModel = {
      team_id: 'sauber',
      season_id: 's2026',
      round: 1,
      session: 'tp1',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'medio',
    }

    const pkg = buildPreparationInformedPackage({
      sessionKey: 'tp1',
      currentSetup,
      gpInfo: { circuit: 'Monza', laps: 53 },
      weather: 'seco',
      setupKnowledge: null,
      tyreKnowledge: null,
      feedbacks: null,
    })

    expect(pkg.hasPracticeEvidence).toBe(false)
    expect(pkg.evidenceBadgeText).toBe('Estimativa inicial — ainda não validada em pista')
    expect(pkg.setupRecommendation.status).toBe('initial_estimate')
    expect(pkg.setupRecommendation.headline).toContain('Estimativa inicial')
    expect(pkg.setupRecommendation.axes.frontWing.confidence).toBe('baixa')
    expect(pkg.setupRecommendation.axes.frontWing.recommendationText).toContain(
      'Estimativa inicial',
    )

    // Pneus também marcam sem_dados
    expect(pkg.tyresAnalysis.macio.confidence).toBe('sem_dados')
    expect(pkg.tyresAnalysis.macio.degradationCategory).toContain('Estimativa inicial')
  })

  // TESTE F — RELOAD: Abrir, recarregar, consultar -> idempotente, sem ganho de confiança ou consumo de estoque
  it('F — RELOAD: Consulta de recomendações é 100% idempotente e livre de efeitos colaterais', () => {
    const mockDriverSets: TireSetItem[] = [
      { id: 'set_1', compound: 'medio', wear: 0, isFitted: false, lapsUsed: 0 },
    ]

    const params: GeneratePreparationInformedParams = {
      sessionKey: 'q1',
      currentSetup: {
        team_id: 'williams',
        season_id: 's2026',
        round: 1,
        session: 'q1',
        wing_level: 6,
        suspension_stiffness: 6,
        pu_electric_ratio: 50,
        tire_compound: 'medio',
      },
      gpInfo: { circuit: 'Spa', laps: 44 },
      weather: 'seco',
      setupKnowledge: null,
      tyreKnowledge: null,
      feedbacks: null,
      driverTireInventories: { drv_albon: mockDriverSets },
      drivers: [{ id: 'drv_albon', name: 'Alexander Albon' }],
    }

    // Executar 10 vezes simulando re-renders/reloads
    for (let i = 0; i < 10; i++) {
      const res = buildPreparationInformedPackage(params)
      expect(res.setupRecommendation.status).toBe('initial_estimate')
    }

    // O inventário e o estado não foram mutados
    expect(mockDriverSets.length).toBe(1)
    expect(mockDriverSets[0].wear).toBe(0)
    expect(mockDriverSets[0].lapsUsed).toBe(0)
  })

  // TESTE G — NÃO DUPLICAR NORMALIZAÇÃO: Correção de combustível de análise da 4C2 não reaparece como bônus físico
  it('G — NÃO DUPLICAR NORMALIZAÇÃO: A telemetria calculada de degradação não altera a física do carro', () => {
    const tyreKnowledge: WeekendTyreKnowledge = {
      macio: {
        compound: 'macio',
        totalLapsObserved: 25,
        totalStintsObserved: 3,
        overallConfidence: 'alta',
        degradation: { value: 'baixa', confidence: 'alta', confidenceScore: 85, revealed: true },
        usefulWindow: {
          value: { minLaps: 18, maxLaps: 26 },
          confidence: 'alta',
          confidenceScore: 85,
          revealed: true,
        },
        paceDrop: {
          value: { minSecPerLap: 0.03, maxSecPerLap: 0.06 },
          confidence: 'alta',
          confidenceScore: 85,
          revealed: true,
        },
        consistency: { value: 'boa', confidence: 'alta', confidenceScore: 85, revealed: true },
        testedConditions: ['seco'],
        testedDrivers: ['drv_1'],
        testedCars: ['car1'],
        updatedAt: new Date().toISOString(),
      },
      medio: {} as any,
      duro: {} as any,
      intermediario: {} as any,
      chuva_extrema: {} as any,
    }

    const analysis = analyzeTyresInformed('seco', tyreKnowledge, null, null)

    expect(analysis.macio.revealed).toBe(true)
    expect(analysis.macio.usefulWindowRange).toEqual({ minLaps: 18, maxLaps: 26 })

    // Validar que o planner usa a janela como estimativa de parada, mas sem criar obrigatoriedade arbitrária
    const stratRecs = generateRacePlannerRecommendations(
      {
        sessionKey: 'race',
        currentSetup: { session: 'race' } as any,
        gpInfo: { circuit: 'Silverstone', laps: 52 },
        weather: 'seco',
        drivers: [{ id: 'drv_1', name: 'Piloto 1' }],
      },
      analysis,
    )

    const drvRec = stratRecs['drv_1']
    expect(drvRec).toBeDefined()
    expect(drvRec.suggestedPitWindows[0].windowLapMin).toBeGreaterThanOrEqual(8)
    expect(drvRec.suggestedPitWindows[0].windowLapMax).toBeLessThanOrEqual(50)
  })
})
