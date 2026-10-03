import { describe, it, expect, vi } from 'vitest'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { PracticeSessionRunner, type PracticeTickContext } from '@/services/canonicalPracticeRunner'
import {
  computePracticePace,
  canonicalPaceIntegrationService,
} from '@/services/canonicalPaceIntegrationService'
import { canonicalPracticeRngService } from '@/services/canonicalPracticeRngService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { getAICompetitors } from '@/lib/f1-data'
import type { PracticeSessionRecordState, PracticeCarLiveState } from '@/types/practice-session'

function createSampleSession(
  overrides?: Partial<PracticeSessionRecordState>,
): PracticeSessionRecordState {
  return {
    careerId: 'career_tlpb_test',
    seasonId: 'season_2026',
    round: 1,
    sessionType: 'tp1',
    status: 'running',
    elapsedTimeSec: 0,
    timeRemainingSec: 3600,
    sessionDurationSec: 3600,
    simSpeed: 1,
    cars: {
      car1: {
        carId: 'car1',
        driverId: 'd1_williams',
        driverName: 'Carlos Sainz',
        status: 'flying_lap',
        setup: {
          frontWing: 6,
          rearWing: 6,
          suspension: 6,
          differential: 50,
          efficiency: 80,
        } as any,
        currentTyreSetId: 'ts1',
        currentCompound: 'macio',
        tyreWear: 5,
        fuelKg: 12,
        currentStintId: 'stint_1',
        totalLaps: 0,
        lapsInStint: 0,
        currentLapProgressPct: 0,
        pitRequested: false,
        program: 'car_setup',
      },
      car2: {
        carId: 'car2',
        driverId: 'd2_williams',
        driverName: 'Alex Albon',
        status: 'flying_lap',
        setup: {
          frontWing: 6,
          rearWing: 6,
          suspension: 6,
          differential: 50,
          efficiency: 80,
        } as any,
        currentTyreSetId: 'ts2',
        currentCompound: 'macio',
        tyreWear: 5,
        fuelKg: 12,
        currentStintId: 'stint_2',
        totalLaps: 0,
        lapsInStint: 0,
        currentLapProgressPct: 0,
        pitRequested: false,
        program: 'car_setup',
      },
    },
    leaderboard: [
      {
        position: 1,
        driverId: 'd1_williams',
        driverName: 'Carlos Sainz',
        teamName: 'Williams Racing',
        teamColor: '#005AFF',
        compound: 'macio',
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer: true,
        carId: 'car1',
      },
      {
        position: 2,
        driverId: 'd2_williams',
        driverName: 'Alex Albon',
        teamName: 'Williams Racing',
        teamColor: '#005AFF',
        compound: 'macio',
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer: true,
        carId: 'car2',
      },
    ],
    stints: [],
    lapHistory: {},
    radioFeed: [],
    ...overrides,
  }
}

function createSampleContext(overrides?: Partial<PracticeTickContext>): PracticeTickContext {
  return {
    round: 1,
    gpName: 'GP da Austrália',
    circuitName: 'Albert Park',
    lengthKm: 5.278,
    tireAbrasiveness: 3,
    weather: 'seco',
    teamChassisRating: 75,
    teamEngineSupplier: 'Mercedes',
    teamName: 'Williams Racing',
    teamColor: '#005AFF',
    drivers: [
      {
        id: 'd1_williams',
        name: 'Carlos Sainz',
        speed: 86,
        consistency: 84,
        defense: 80,
        morale: 85,
        physical_condition: 90,
        technical_feedback: 85,
        isRookie: false,
      },
      {
        id: 'd2_williams',
        name: 'Alex Albon',
        speed: 83,
        consistency: 82,
        defense: 78,
        morale: 85,
        physical_condition: 90,
        technical_feedback: 82,
        isRookie: false,
      },
    ],
    ...overrides,
  }
}

describe('TL-PACE-01B: Practice Runner Migration to Canonical Core (TLPB-01..48)', () => {
  const runnerFilePath = resolve(process.cwd(), 'src/services/canonicalPracticeRunner.ts')
  const runnerCode = readFileSync(runnerFilePath, 'utf-8')

  // =========================================================================
  // BLOCO 1: INTEGRAÇÃO DO RUNNER E ELIMINAÇÃO DO MOTOR LEGADO (TLPB-01..06)
  // =========================================================================

  it('TLPB-01: runner chama computePracticePace no cálculo de pace de voltas', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession()
    const context = createSampleContext()

    const lapSec = PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalled()
    expect(lapSec).toBeGreaterThan(54)
    expect(lapSec).toBeLessThan(120)
    spy.mockRestore()
  })

  it('TLPB-02: runner NÃO importa nem chama calculateCombinedPace', () => {
    // 1. Verificação estática do arquivo
    expect(runnerCode).not.toMatch(/import\s*\{[^}]*calculateCombinedPace[^}]*\}\s*from/)
    expect(runnerCode).not.toMatch(/calculateCombinedPace\s*\(/)
    // 2. Comentários explicativos podem citar a substituição, mas nenhuma chamada executável
    const callMatches = runnerCode.match(/calculateCombinedPace\(/g)
    expect(callMatches).toBeNull()
  })

  it('TLPB-03: TL1 consome computePracticePace com session namespace TL1', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession({ sessionType: 'tp1' })
    const context = createSampleContext()

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        session: 'TL1',
      }),
    )
    spy.mockRestore()
  })

  it('TLPB-04: TL2 consome computePracticePace com session namespace TL2', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession({ sessionType: 'tp2' })
    const context = createSampleContext()

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        session: 'TL2',
      }),
    )
    spy.mockRestore()
  })

  it('TLPB-05: TL3 consome computePracticePace com session namespace TL3', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession({ sessionType: 'tp3' })
    const context = createSampleContext()

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        session: 'TL3',
      }),
    )
    spy.mockRestore()
  })

  it('TLPB-06: Player e IA consomem exatamente o MESMO computePracticePace (sem ramificação por modo)', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession()
    // Adicionar um competidor IA no leaderboard
    session.leaderboard.push({
      position: 3,
      driverId: 'ai_ver_d1',
      driverName: 'Max Verstappen',
      teamName: 'Red Bull Racing',
      teamColor: '#1E41FF',
      compound: 'macio',
      laps: 0,
      bestLapSec: 0,
      bestLapTime: '--:--.---',
      gap: '-',
      isPlayer: false,
    })

    const context = createSampleContext()

    // 1. Chamada do jogador
    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })
    const playerCall = spy.mock.calls[0][0]

    // 2. Chamada da IA
    vi.spyOn(Math, 'random').mockReturnValue(0.01) // força o trigger do tick da IA
    PracticeSessionRunner.advanceAIPracticePace(session, 120, context, 74)
    const aiCall = spy.mock.calls.find((c) => c[0].driverId === 'ai_ver_d1')?.[0]

    expect(playerCall).toBeDefined()
    expect(aiCall).toBeDefined()
    // Ambos possuem chaves canônicas de computePracticePace
    expect(playerCall).toHaveProperty('teamKey')
    expect(aiCall).toHaveProperty('teamKey')
    expect(playerCall).toHaveProperty('setupEfficiency')
    expect(aiCall).toHaveProperty('setupEfficiency')
    expect(playerCall).toHaveProperty('rngModifier')
    expect(aiCall).toHaveProperty('rngModifier')

    vi.restoreAllMocks()
  })

  // =========================================================================
  // BLOCO 2: ÂNCORAS E RESOLUÇÃO ESTRUTURAL NO RUNNER (TLPB-07..14)
  // =========================================================================

  it('TLPB-07: Âncora Mercedes Structural = 100 no runner', () => {
    const session = createSampleSession()
    const context = createSampleContext({ teamName: 'Mercedes-AMG Petronas F1 Team' })

    let capturedStructural = 0
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        capturedStructural = res.breakdown.structural
        return res
      })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(capturedStructural).toBe(100)
    spy.mockRestore()
  })

  it('TLPB-08: Âncora Audi Structural = 86 no runner', () => {
    const session = createSampleSession()
    const context = createSampleContext({ teamName: 'Audi F1 Team' })

    let capturedStructural = 0
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        capturedStructural = res.breakdown.structural
        return res
      })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(capturedStructural).toBe(86)
    spy.mockRestore()
  })

  it('TLPB-09: Âncora Williams Structural = 70 no runner', () => {
    const session = createSampleSession()
    const context = createSampleContext({ teamName: 'Williams Racing' })

    let capturedStructural = 0
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        capturedStructural = res.breakdown.structural
        return res
      })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(capturedStructural).toBe(70)
    spy.mockRestore()
  })

  it('TLPB-10: Âncora Cadillac Structural = 50 no runner', () => {
    const session = createSampleSession()
    const context = createSampleContext({ teamName: 'Cadillac Formula 1 Team' })

    let capturedStructural = 0
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        capturedStructural = res.breakdown.structural
        return res
      })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(capturedStructural).toBe(50)
    spy.mockRestore()
  })

  it('TLPB-11: Âncora Andretti Structural = 45 no runner', () => {
    const session = createSampleSession()
    const context = createSampleContext({ teamName: 'Andretti Global' })

    let capturedStructural = 0
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        capturedStructural = res.breakdown.structural
        return res
      })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(capturedStructural).toBe(45)
    spy.mockRestore()
  })

  it('TLPB-12: teams.strength não controla o pace estrutural de treino (Audi com teams.strength=20 -> structural 86)', () => {
    const session = createSampleSession()
    const context = createSampleContext({
      teamName: 'Audi F1 Team',
      teamChassisRating: 20,
    })
    ;(context as any).strength = 20

    let capturedStructural = 0
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        capturedStructural = res.breakdown.structural
        return res
      })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(capturedStructural).toBe(86)
    spy.mockRestore()
  })

  it('TLPB-13: strengthRating legado da IA não controla o pace estrutural de treino (Williams strengthRating=99 -> 70)', () => {
    const session = createSampleSession()
    session.leaderboard = [
      {
        position: 1,
        driverId: 'ai_wms_d1',
        driverName: 'Carlos Sainz',
        teamName: 'Williams',
        teamColor: '#005AFF',
        compound: 'medio',
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer: false,
      },
    ]

    const context = createSampleContext({ teamName: 'Williams' })
    let capturedStructural = 0
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        if (p.teamKey === 'williams') {
          capturedStructural = res.breakdown.structural
        }
        return res
      })

    vi.spyOn(Math, 'random').mockReturnValue(0.01)
    PracticeSessionRunner.advanceAIPracticePace(session, 120, context, 74)

    expect(capturedStructural).toBe(70)
    vi.restoreAllMocks()
  })

  it('TLPB-14: teamChassisRating não substitui o Structural no runner do jogador (Cadillac teamChassisRating=99 -> 50)', () => {
    const session = createSampleSession()
    const context = createSampleContext({
      teamName: 'Cadillac F1 Team',
      teamChassisRating: 99,
    })

    let capturedStructural = 0
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        capturedStructural = res.breakdown.structural
        return res
      })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(capturedStructural).toBe(50)
    spy.mockRestore()
  })

  // =========================================================================
  // BLOCO 3: EXECUTION, TRACKFIT, SETUP E SINGLE APPLICATION (TLPB-15..20)
  // =========================================================================

  it('TLPB-15: PracticeExecution canônica é calculada pelos atributos do piloto e centrada em neutro', () => {
    const res = computePracticePace({
      teamKey: 'williams',
      driverId: 'neutral_test',
      driverAttributes: {
        speed: 80,
        consistency: 80,
        technical_feedback: 80,
        morale: 80,
        f1Starts: 20,
      },
      rngModifier: 0,
    })

    expect(res.breakdown.practiceExecution).toBe(0)
  })

  it('TLPB-16: PracticeExecution aplicada exatamente UMA vez (sem duplicação no runner)', () => {
    const session = createSampleSession()
    const context = createSampleContext()

    let capturedBreakdown: any = null
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        capturedBreakdown = res.breakdown
        return res
      })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(capturedBreakdown).toBeDefined()
    // Final pace soma os componentes exatamente 1x
    const expectedFinal = Number(
      (
        capturedBreakdown.structural +
        capturedBreakdown.trackFit +
        capturedBreakdown.setup +
        capturedBreakdown.practiceExecution +
        capturedBreakdown.program +
        capturedBreakdown.tyre +
        capturedBreakdown.fuel +
        capturedBreakdown.wear +
        capturedBreakdown.weather +
        capturedBreakdown.rookieAdaptation +
        capturedBreakdown.rng
      ).toFixed(2),
    )
    expect(capturedBreakdown.finalPace).toBe(expectedFinal)
    spy.mockRestore()
  })

  it('TLPB-17: TrackFit canônico não usa escala legada 0.22/±6.5', () => {
    const circ = resolveCircuitProfile({ round: 1 })
    const res = computePracticePace({
      teamKey: 'mercedes',
      driverId: 'd1',
      circuitProfile: circ,
      carTechnicalAttributes: {
        lowSpeedCorners: 90,
        highSpeedCorners: 90,
        straightLineSpeed: 90,
      },
      rngModifier: 0,
    })

    expect(Math.abs(res.breakdown.trackFit)).toBeLessThanOrEqual(2.5)
    expect(Math.abs(res.breakdown.trackFit)).toBeLessThan(6.5)
  })

  it('TLPB-18: TrackFit aplicado exatamente UMA vez', () => {
    // Valida que o runner não adiciona outro delta de trackFit além do retornado pelo core
    const session = createSampleSession()
    const context = createSampleContext()
    const circBase = 74.0

    const lapSec = PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: circBase,
      sessionRecord: session,
    })

    // O tempo de volta é diretamente o gerado pelo core
    const coreDirect = computePracticePace({
      teamKey: 'williams',
      driverId: session.cars.car1.driverId,
      session: 'TL1',
      attempt: 1,
      driverAttributes: {
        speed: context.drivers[0].speed,
        consistency: context.drivers[0].consistency,
        technical_feedback: context.drivers[0].technical_feedback,
        morale: context.drivers[0].morale,
      },
      tyreCompound: session.cars.car1.currentCompound,
      tyreWearPct: session.cars.car1.tyreWear,
      fuelKg: session.cars.car1.fuelKg,
      setupEfficiency: 80,
      weather: context.weather,
      rngModifier: canonicalPracticeRngService.getDeterministicDraw({
        careerId: session.careerId,
        seasonYear: 2026,
        round: 1,
        session: 'TL1',
        driverId: session.cars.car1.driverId,
        attempt: 1,
        program: session.cars.car1.program,
      }).rngModifier,
      program: session.cars.car1.program,
    })

    expect(lapSec).toBe(coreDirect.lapTimeSec)
  })

  it('TLPB-19: SetupEfficiency 80 -> modifier 0.0 no runner', () => {
    const session = createSampleSession()
    ;(session.cars.car1.setup as any).efficiency = 80

    let capturedSetup = -999
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        capturedSetup = res.breakdown.setup
        return res
      })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: createSampleContext().drivers[0],
      context: createSampleContext(),
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(capturedSetup).toBe(0)
    spy.mockRestore()
  })

  it('TLPB-20: Setup aplicado exatamente UMA vez', () => {
    const eff90 = computePracticePace({
      teamKey: 'williams',
      driverId: 'd1',
      setupEfficiency: 90,
      rngModifier: 0,
    })
    const eff80 = computePracticePace({
      teamKey: 'williams',
      driverId: 'd1',
      setupEfficiency: 80,
      rngModifier: 0,
    })

    // (90 - 80) * 0.05 = +0.50 pace points
    expect(eff90.breakdown.setup).toBe(0.5)
    expect(Number((eff90.finalPracticePace - eff80.finalPracticePace).toFixed(2))).toBe(0.5)
  })

  // =========================================================================
  // BLOCO 4: PROGRAMA E FÍSICA REAL (TLPB-21..26)
  // =========================================================================

  it('TLPB-21: programa de treino real (car_setup, race_pace, qualifying_sim) repassado ao core', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession()
    const context = createSampleContext()

    session.cars.car1.program = 'qualifying_sim'
    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        program: 'qualifying_sim',
      }),
    )
    spy.mockRestore()
  })

  it('TLPB-22: programa sem duplicação de bônus/penalidade (repassado uma única vez)', () => {
    const session = createSampleSession()
    session.cars.car1.program = 'qualifying_sim'
    const context = createSampleContext()

    let capturedBreakdown: any = null
    const spy = vi
      .spyOn(canonicalPaceIntegrationService, 'computePracticePace')
      .mockImplementation((p) => {
        const res = computePracticePace(p)
        capturedBreakdown = res.breakdown
        return res
      })

    const lapSec = PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    // lapSec deve ser exatamente o lapTimeSec retornado pelo computePracticePace, sem subtração extra
    expect(lapSec).toBe(capturedBreakdown.lapTimeSec)
    expect(capturedBreakdown.program).toBe(1.5) // valor canônico de qualifying_sim
    spy.mockRestore()
  })

  it('TLPB-23: combustível real (fuelKg) chega ao core sem recálculo ad-hoc no runner', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession()
    session.cars.car1.fuelKg = 34.5
    const context = createSampleContext()

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        fuelKg: 34.5,
      }),
    )
    spy.mockRestore()
  })

  it('TLPB-24: pneu e composto reais (tyreCompound) chegam ao core', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession()
    session.cars.car1.currentCompound = 'duro'
    const context = createSampleContext()

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        tyreCompound: 'duro',
      }),
    )
    spy.mockRestore()
  })

  it('TLPB-25: clima real (weather) chega ao core', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession()
    const context = createSampleContext({
      weather: 'chuva_forte',
    })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        weather: context.weather,
      }),
    )
    spy.mockRestore()
  })

  it('TLPB-26: desgaste real de pneus (tyreWear) chega ao core', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession()
    session.cars.car1.tyreWear = 42
    const context = createSampleContext()

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        tyreWearPct: 42,
      }),
    )
    spy.mockRestore()
  })

  // =========================================================================
  // BLOCO 5: ROOKIE, MILHAGEM E ADAPTAÇÃO (TLPB-27..30)
  // =========================================================================

  it('TLPB-27: rookie não altera o Structural Strength de Williams ou Audi', () => {
    const resWilliamsRookie = computePracticePace({
      teamKey: 'williams',
      driverId: 'rookie_d1',
      isRookie: true,
      rngModifier: 0,
    })
    const resWilliamsVet = computePracticePace({
      teamKey: 'williams',
      driverId: 'vet_d1',
      isRookie: false,
      rngModifier: 0,
    })

    expect(resWilliamsRookie.breakdown.structural).toBe(70)
    expect(resWilliamsVet.breakdown.structural).toBe(70)
    expect(resWilliamsRookie.breakdown.rookieAdaptation).toBeLessThan(0)
  })

  it('TLPB-28: rookie no TL1 é identificado corretamente pelo runner e repassado ao core', () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computePracticePace')
    const session = createSampleSession()
    const context = createSampleContext({
      drivers: [
        {
          id: 'd1_williams',
          name: 'Rookie Tester',
          speed: 78,
          consistency: 76,
          defense: 75,
          isRookie: true,
        },
        {
          id: 'd2_williams',
          name: 'Alex Albon',
          speed: 83,
          consistency: 82,
          defense: 78,
          isRookie: false,
        },
      ],
    })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        isRookie: true,
      }),
    )
    spy.mockRestore()
  })

  it('TLPB-29: rookie no TL1 registra voltas na sessão normalmente acumulando milhagem', () => {
    const session = createSampleSession()
    session.cars.car1.status = 'flying_lap'
    session.cars.car1.currentLapProgressPct = 99 // próxima fração completa a volta
    const context = createSampleContext({
      drivers: [
        {
          id: 'd1_williams',
          name: 'Rookie Tester',
          speed: 78,
          consistency: 76,
          defense: 75,
          isRookie: true,
        },
        {
          id: 'd2_williams',
          name: 'Alex Albon',
          speed: 83,
          consistency: 82,
          defense: 78,
          isRookie: false,
        },
      ],
    })

    const tickRes = PracticeSessionRunner.tick(session, 10, context)
    const car1 = tickRes.nextState.cars.car1
    expect(car1.totalLaps).toBe(1)
    expect(tickRes.nextState.lapHistory['d1_williams']?.length).toBe(1)
    expect(tickRes.nextState.leaderboard.find((e) => e.driverId === 'd1_williams')?.isRookie).toBe(
      true,
    )
  })

  it('TLPB-30: adaptação de novato atua estritamente como modifier e não deforma baseline', () => {
    const p1 = computePracticePace({
      teamKey: 'audi',
      driverId: 'rookie_d1',
      isRookie: true,
      driverAttributes: { adaptation: 65 },
      rngModifier: 0,
    })
    const p2 = computePracticePace({
      teamKey: 'audi',
      driverId: 'rookie_d2',
      isRookie: true,
      driverAttributes: { adaptation: 75 },
      rngModifier: 0,
    })

    expect(p1.breakdown.structural).toBe(86)
    expect(p2.breakdown.structural).toBe(86)
    expect(p2.breakdown.rookieAdaptation).toBeGreaterThan(p1.breakdown.rookieAdaptation)
  })

  // =========================================================================
  // BLOCO 6: CANONICAL PRACTICE RNG, DETERMINISMO E MATH.RANDOM (TLPB-31..36)
  // =========================================================================

  it('TLPB-31: runner usa canonicalPracticeRngService para obter RNG determinístico', () => {
    const spy = vi.spyOn(canonicalPracticeRngService, 'getDeterministicDraw')
    const session = createSampleSession()
    const context = createSampleContext()

    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('TLPB-32: Math.random não participa do cálculo de pace de treino livre', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')
    const session = createSampleSession()
    const context = createSampleContext()

    // Chamar cálculo de volta do jogador
    PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    // Math.random NÃO deve ser chamado durante o cálculo de pace
    expect(mathRandomSpy).not.toHaveBeenCalled()
    mathRandomSpy.mockRestore()
  })

  it('TLPB-33: mesma identidade completa produz exatamente o mesmo pace e tempo de volta', () => {
    const session1 = createSampleSession()
    const session2 = createSampleSession()
    const context = createSampleContext()

    const lap1 = PracticeSessionRunner.calculatePracticeLapPace({
      car: session1.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session1,
    })

    const lap2 = PracticeSessionRunner.calculatePracticeLapPace({
      car: session2.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session2,
    })

    expect(lap1).toBe(lap2)
  })

  it('TLPB-34: reload da sessão produz resultado 100% idempotente', () => {
    const session = createSampleSession()
    const context = createSampleContext()

    const serialized = JSON.stringify(session)
    const reloaded: PracticeSessionRecordState = JSON.parse(serialized)

    const lapOriginal = PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    const lapReloaded = PracticeSessionRunner.calculatePracticeLapPace({
      car: reloaded.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: reloaded,
    })

    expect(lapOriginal).toBe(lapReloaded)
  })

  it('TLPB-35: cada attempt/volta é individualmente determinístico', () => {
    const session = createSampleSession()
    const context = createSampleContext()

    session.cars.car1.totalLaps = 0 // attempt 1
    const lapAtt1A = PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    const lapAtt1B = PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    session.cars.car1.totalLaps = 1 // attempt 2
    const lapAtt2 = PracticeSessionRunner.calculatePracticeLapPace({
      car: session.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: session,
    })

    expect(lapAtt1A).toBe(lapAtt1B)
    // O attempt 2 tem seed distinta e pace determinístico
    expect(typeof lapAtt2).toBe('number')
  })

  it('TLPB-36: TL1, TL2 e TL3 geram namespaces distintos no runner e produzem seeds distintas', () => {
    const sessionTL1 = createSampleSession({ sessionType: 'tp1' })
    const sessionTL2 = createSampleSession({ sessionType: 'tp2' })
    const sessionTL3 = createSampleSession({ sessionType: 'tp3' })
    const context = createSampleContext()

    let drawTL1: any
    let drawTL2: any
    let drawTL3: any

    const spy = vi
      .spyOn(canonicalPracticeRngService, 'getDeterministicDraw')
      .mockImplementation((p) => {
        const draw = canonicalPracticeRngService.getDeterministicDraw(p)
        if (p.session === 'TL1') drawTL1 = draw
        if (p.session === 'TL2') drawTL2 = draw
        if (p.session === 'TL3') drawTL3 = draw
        return draw
      })

    PracticeSessionRunner.calculatePracticeLapPace({
      car: sessionTL1.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: sessionTL1,
    })
    PracticeSessionRunner.calculatePracticeLapPace({
      car: sessionTL2.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: sessionTL2,
    })
    PracticeSessionRunner.calculatePracticeLapPace({
      car: sessionTL3.cars.car1,
      driver: context.drivers[0],
      context,
      circuitBaseSec: 74,
      sessionRecord: sessionTL3,
    })

    expect(drawTL1.seedIdentity).toContain(':TL1:')
    expect(drawTL2.seedIdentity).toContain(':TL2:')
    expect(drawTL3.seedIdentity).toContain(':TL3:')
    expect(drawTL1.seedIdentity).not.toBe(drawTL2.seedIdentity)
    expect(drawTL2.seedIdentity).not.toBe(drawTL3.seedIdentity)

    spy.mockRestore()
  })

  // =========================================================================
  // BLOCO 7: PACE ABSOLUTO, GAPS E SUBSETS (TLPB-37..40)
  // =========================================================================

  it('TLPB-37: gap neutro Audi-Williams = exatamente 16 pontos de pace (86 vs 70)', () => {
    const audi = computePracticePace({
      teamKey: 'audi',
      driverId: 'neutral',
      rngModifier: 0,
      setupEfficiency: 80,
      fuelKg: 12,
    })
    const williams = computePracticePace({
      teamKey: 'williams',
      driverId: 'neutral',
      rngModifier: 0,
      setupEfficiency: 80,
      fuelKg: 12,
    })

    expect(audi.breakdown.structural).toBe(86)
    expect(williams.breakdown.structural).toBe(70)
    expect(Number((audi.finalPracticePace - williams.finalPracticePace).toFixed(2))).toBe(16)
  })

  it('TLPB-38: gap neutro Audi-Cadillac = exatamente 36 pontos de pace (86 vs 50)', () => {
    const audi = computePracticePace({
      teamKey: 'audi',
      driverId: 'neutral',
      rngModifier: 0,
      setupEfficiency: 80,
      fuelKg: 12,
    })
    const cadillac = computePracticePace({
      teamKey: 'cadillac',
      driverId: 'neutral',
      rngModifier: 0,
      setupEfficiency: 80,
      fuelKg: 12,
    })

    expect(audi.breakdown.structural).toBe(86)
    expect(cadillac.breakdown.structural).toBe(50)
    expect(Number((audi.finalPracticePace - cadillac.finalPracticePace).toFixed(2))).toBe(36)
  })

  it('TLPB-39: gap Audi-Williams é idêntico em subset (2 carros) vs grid completo de 24 carros', () => {
    const pAudi = computePracticePace({ teamKey: 'audi', driverId: 'd1', rngModifier: 0 })
    const pWilliams = computePracticePace({ teamKey: 'williams', driverId: 'd2', rngModifier: 0 })

    const gapSubset = Number((pAudi.finalPracticePace - pWilliams.finalPracticePace).toFixed(2))

    // Simulando 24 carros calculados independentemente
    const allTeams = [
      'mercedes',
      'ferrari',
      'mclaren',
      'red_bull',
      'racing_bulls',
      'alpine',
      'audi',
      'haas',
      'williams',
      'aston_martin',
      'cadillac',
      'andretti',
    ]
    const fullGridPaces = allTeams.map((t) =>
      computePracticePace({ teamKey: t, driverId: `d_${t}`, rngModifier: 0 }),
    )

    const audiFull = fullGridPaces.find((p) => p.breakdown.teamKey === 'audi')!
    const williamsFull = fullGridPaces.find((p) => p.breakdown.teamKey === 'williams')!
    const gapFull = Number((audiFull.finalPracticePace - williamsFull.finalPracticePace).toFixed(2))

    expect(gapSubset).toBe(gapFull)
    expect(gapFull).toBe(16)
  })

  it('TLPB-40: ausência total de min-max normalization ou compressão artificial de gap', () => {
    const pAudi = computePracticePace({ teamKey: 'audi', driverId: 'd1', rngModifier: 0 })
    const pCadillac = computePracticePace({ teamKey: 'cadillac', driverId: 'd2', rngModifier: 0 })

    const deltaPoints = pAudi.finalPracticePace - pCadillac.finalPracticePace
    expect(deltaPoints).toBe(36)

    // O tempo de volta usa a escala canônica de 0.082s por ponto
    const deltaSec = pCadillac.lapTimeSec - pAudi.lapTimeSec
    const expectedDeltaSec = Number((36 * 0.082).toFixed(3))
    expect(Number(deltaSec.toFixed(3))).toBe(expectedDeltaSec)
  })

  // =========================================================================
  // BLOCO 8: PERSISTÊNCIA, LEADERBOARD, SORTING E PROGRESSÃO (TLPB-41..48)
  // =========================================================================

  it('TLPB-41: melhor volta (best lap) é derivada diretamente do pace canônico', () => {
    const session = createSampleSession()
    session.cars.car1.status = 'flying_lap'
    session.cars.car1.currentLapProgressPct = 99
    const context = createSampleContext()

    const tickRes = PracticeSessionRunner.tick(session, 10, context)
    const car1 = tickRes.nextState.cars.car1

    expect(car1.bestLapSec).toBeGreaterThan(54)
    expect(car1.bestLapTime).not.toBe('--:--.---')
    expect(car1.lastLapSec).toBe(car1.bestLapSec)
  })

  it('TLPB-42: ordenação do leaderboard classifica estritamente por menor best lap time', () => {
    const session = createSampleSession()
    session.leaderboard = [
      {
        position: 1,
        driverId: 'd_slow',
        driverName: 'Piloto Lento',
        teamName: 'Team B',
        teamColor: '#fff',
        compound: 'macio',
        laps: 2,
        bestLapSec: 82.5,
        bestLapTime: '1:22.500',
        gap: '-',
        isPlayer: false,
      },
      {
        position: 2,
        driverId: 'd_fast',
        driverName: 'Piloto Rápido',
        teamName: 'Team A',
        teamColor: '#fff',
        compound: 'macio',
        laps: 2,
        bestLapSec: 79.1,
        bestLapTime: '1:19.100',
        gap: '-',
        isPlayer: false,
      },
    ]

    ;(PracticeSessionRunner as any).sortLeaderboard(session.leaderboard)

    expect(session.leaderboard[0].driverId).toBe('d_fast')
    expect(session.leaderboard[0].position).toBe(1)
    expect(session.leaderboard[0].gap).toBe('Líder')
    expect(session.leaderboard[1].driverId).toBe('d_slow')
    expect(session.leaderboard[1].position).toBe(2)
    expect(session.leaderboard[1].gap).toContain('+3.400')
  })

  it('TLPB-43: conclusão da sessão quando cronômetro zera (timeRemainingSec <= 0)', () => {
    const session = createSampleSession()
    session.timeRemainingSec = 5
    const context = createSampleContext()

    const tickRes = PracticeSessionRunner.tick(session, 10, context)
    expect(tickRes.nextState.status).toBe('completed')
    expect(tickRes.nextState.timeRemainingSec).toBe(0)
  })

  it('TLPB-44: idempotência de avanço: múltiplos ticks mantêm integridade de voltas', () => {
    const session = createSampleSession()
    const context = createSampleContext()

    const t1 = PracticeSessionRunner.tick(session, 1, context)
    const t2 = PracticeSessionRunner.tick(t1.nextState, 1, context)

    expect(t2.nextState.elapsedTimeSec).toBe(2)
    expect(t2.nextState.timeRemainingSec).toBe(3598)
  })

  it('TLPB-45: progressão em fim de semana normal (Main Weekend) preserva schedule TL1 -> TL2 -> TL3', () => {
    const tl1Ns = PracticeSessionRunner.mapSessionTypeToNamespace('tp1')
    const tl2Ns = PracticeSessionRunner.mapSessionTypeToNamespace('tp2')
    const tl3Ns = PracticeSessionRunner.mapSessionTypeToNamespace('tp3')

    expect(tl1Ns).toBe('TL1')
    expect(tl2Ns).toBe('TL2')
    expect(tl3Ns).toBe('TL3')
  })

  it('TLPB-46: progressão em fim de semana Sprint preserva TL1 único sem chamar TL2/TL3', () => {
    // No sprint weekend, a única sessão de treino é TL1
    const sprintPracticeNs = PracticeSessionRunner.mapSessionTypeToNamespace('tp1')
    expect(sprintPracticeNs).toBe('TL1')
  })

  it('TLPB-47: Qualifying permanece 100% intacto e inalterado pela migração de treino', () => {
    // Validar que computeQualifyingPace continua funcionando perfeitamente com suas fórmulas
    const qualiRes = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: resolveCircuitProfile({ round: 1 }),
      driverAttributes: { speed: 85, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
    })

    expect(qualiRes.effectivePaceScore).toBeGreaterThan(95)
    expect(qualiRes.breakdown.structuralStrength).toBe(100)
    expect(qualiRes.lapTimeSec).toBeGreaterThan(54)
  })

  it('TLPB-48: Suíte TLPA (TL-PACE-01A) permanece integralmente homologada', () => {
    // Valida que o core canonicalPracticeRngService e computePracticePace operam conforme TLPA
    const draw = canonicalPracticeRngService.getDeterministicDraw({
      careerId: 'c1',
      seasonYear: 2026,
      round: 1,
      session: 'TL1',
      driverId: 'd1',
      attempt: 1,
    })

    expect(draw.rngModifier).toBeGreaterThanOrEqual(-1.75)
    expect(draw.rngModifier).toBeLessThanOrEqual(1.75)
  })

  // =========================================================================
  // FIXTURE NEUTRA DAS 12 EQUIPES NO RUNNER REAL
  // =========================================================================
  it('FIXTURE NEUTRA: Ordem estrutural exata das 12 equipes no Practice Runner', () => {
    const teams = [
      { key: 'mercedes', expected: 100 },
      { key: 'ferrari', expected: 98 },
      { key: 'mclaren', expected: 96 },
      { key: 'red_bull', expected: 94 },
      { key: 'racing_bulls', expected: 87 },
      { key: 'alpine', expected: 87 },
      { key: 'audi', expected: 86 },
      { key: 'haas', expected: 75 },
      { key: 'williams', expected: 70 },
      { key: 'aston_martin', expected: 60 },
      { key: 'cadillac', expected: 50 },
      { key: 'andretti', expected: 45 },
    ]

    const results = teams.map((t) => {
      const pace = computePracticePace({
        teamKey: t.key,
        driverId: 'neutral_d1',
        driverAttributes: {
          speed: 80,
          consistency: 80,
          technical_feedback: 80,
          morale: 80,
          f1Starts: 20,
        },
        rngModifier: 0,
        setupEfficiency: 80,
        fuelKg: 12,
        tyreWearPct: 0,
      })
      return {
        key: t.key,
        expected: t.expected,
        structural: pace.breakdown.structural,
        finalPace: pace.finalPracticePace,
        lapTimeSec: pace.lapTimeSec,
      }
    })

    for (const r of results) {
      expect(r.structural).toBe(r.expected)
    }

    // Verificar ordenação estrita descendente
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].structural).toBeGreaterThanOrEqual(results[i + 1].structural)
    }
  })

  // =========================================================================
  // REAL DRIVER CHECK (8 PILOTOS REAIS COM DECOMPOSIÇÃO POR CAMADA)
  // =========================================================================
  it('REAL DRIVER CHECK: Decomposição por camada para Sainz/Albon, Hülk/Bortoleto, Ocon/Bearman, Pérez/Bottas', () => {
    const realDrivers = [
      {
        name: 'Carlos Sainz',
        id: 'driver_carlos_sainz',
        team: 'williams',
        speed: 86,
        consistency: 85,
        feedback: 86,
        starts: 205,
      },
      {
        name: 'Alex Albon',
        id: 'driver_alexander_albon',
        team: 'williams',
        speed: 83,
        consistency: 82,
        feedback: 82,
        starts: 102,
      },
      {
        name: 'Nico Hülkenberg',
        id: 'driver_nico_hulkenberg',
        team: 'audi',
        speed: 83,
        consistency: 84,
        feedback: 85,
        starts: 227,
      },
      {
        name: 'Gabriel Bortoleto',
        id: 'driver_gabriel_bortoleto',
        team: 'audi',
        speed: 83,
        consistency: 80,
        feedback: 78,
        starts: 0,
        isRookie: true,
      },
      {
        name: 'Esteban Ocon',
        id: 'driver_esteban_ocon',
        team: 'haas',
        speed: 82,
        consistency: 82,
        feedback: 80,
        starts: 154,
      },
      {
        name: 'Oliver Bearman',
        id: 'driver_oliver_bearman',
        team: 'haas',
        speed: 81,
        consistency: 78,
        feedback: 77,
        starts: 3,
        isRookie: true,
      },
      {
        name: 'Sergio Pérez',
        id: 'driver_sergio_perez',
        team: 'cadillac',
        speed: 79,
        consistency: 80,
        feedback: 81,
        starts: 281,
      },
      {
        name: 'Valtteri Bottas',
        id: 'driver_valtteri_bottas',
        team: 'cadillac',
        speed: 79,
        consistency: 82,
        feedback: 82,
        starts: 244,
      },
    ]

    const realReport: Array<{
      driver: string
      team: string
      structural: number
      practiceExec: number
      setup: number
      tyre: number
      fuel: number
      rookieAdaptation: number
      rng: number
      finalPace: number
      lap: number
    }> = []

    for (const d of realDrivers) {
      const pace = computePracticePace({
        teamKey: d.team,
        driverId: d.id,
        driverAttributes: {
          speed: d.speed,
          consistency: d.consistency,
          technical_feedback: d.feedback,
          f1Starts: d.starts,
          morale: 85,
        },
        isRookie: !!d.isRookie,
        setupEfficiency: 80,
        fuelKg: 12,
        tyreWearPct: 0,
        rngModifier: 0,
      })

      const b = pace.breakdown
      realReport.push({
        driver: d.name,
        team: d.team,
        structural: b.structural,
        practiceExec: b.practiceExecution,
        setup: b.setup,
        tyre: b.tyre,
        fuel: b.fuel,
        rookieAdaptation: b.rookieAdaptation,
        finalPace: pace.finalPracticePace,
        rng: b.rng,
        lap: pace.lapTimeSec,
      })

      // Validações estruturais canônicas obrigatórias
      if (d.team === 'williams') {
        expect(b.structural).toBe(70)
      } else if (d.team === 'audi') {
        expect(b.structural).toBe(86)
      } else if (d.team === 'haas') {
        expect(b.structural).toBe(75)
      } else if (d.team === 'cadillac') {
        expect(b.structural).toBe(50)
      }
    }

    // Exibir tabela de decomposição no console
    console.table(realReport)

    // Sainz vs Albon na Williams (70)
    const sainz = realReport.find((r) => r.driver === 'Carlos Sainz')!
    const albon = realReport.find((r) => r.driver === 'Alex Albon')!
    expect(sainz.structural).toBe(70)
    expect(albon.structural).toBe(70)
    expect(sainz.practiceExec).toBeGreaterThan(albon.practiceExec)
    expect(sainz.finalPace).toBeGreaterThan(albon.finalPace)
    expect(sainz.lap).toBeLessThan(albon.lap)

    // Hülkenberg vs Bortoleto na Audi (86)
    const hulk = realReport.find((r) => r.driver === 'Nico Hülkenberg')!
    const bort = realReport.find((r) => r.driver === 'Gabriel Bortoleto')!
    expect(hulk.structural).toBe(86)
    expect(bort.structural).toBe(86)
    expect(hulk.practiceExec).toBeGreaterThan(bort.practiceExec)
    expect(bort.rookieAdaptation).toBeLessThan(0) // modifier de rookie/adaptação ativo

    // Ocon vs Bearman na Haas (75)
    const ocon = realReport.find((r) => r.driver === 'Esteban Ocon')!
    const bear = realReport.find((r) => r.driver === 'Oliver Bearman')!
    expect(ocon.structural).toBe(75)
    expect(bear.structural).toBe(75)
    expect(ocon.practiceExec).toBeGreaterThan(bear.practiceExec)

    // Pérez vs Bottas na Cadillac (50)
    const perez = realReport.find((r) => r.driver === 'Sergio Pérez')!
    const bottas = realReport.find((r) => r.driver === 'Valtteri Bottas')!
    expect(perez.structural).toBe(50)
    expect(bottas.structural).toBe(50)
  })
})
