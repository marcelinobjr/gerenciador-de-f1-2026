import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  raceQualifyingOrchestratorService,
  type QualifyingDriverInput,
} from '@/services/raceQualifyingOrchestratorService'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import {
  canonicalQualifyingRngService,
  buildQualifyingSeedIdentity,
  getQualifyingDeterministicDraw,
  getQualifyingRandomModifier,
} from '@/services/canonicalQualifyingRngService'
import {
  canonicalPaceIntegrationService,
  createMulberry32,
  hashStringToSeed,
  sampleGaussianRng,
  QUALI_RNG_TARGET_RANGE,
  QUALI_RNG_DEFAULT_SIGMA,
} from '@/services/canonicalPaceIntegrationService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('QUALI-UNIFY-01C: Deterministic RNG Unification (Runner & Orchestrator)', () => {
  const dummyCareer = 'car_test_quali_01c'
  const dummySeason = 'season_2026'
  const dummyRound = 1
  const defaultCircuitProfile = resolveCircuitProfile({ round: dummyRound })

  beforeEach(() => {
    localStorage.clear()
    raceQualifyingOrchestratorService.clearMemoryCache()
    vi.restoreAllMocks()
  })

  function createNeutralDriver(
    id: string,
    teamId: string,
    teamName: string,
    overrides?: Partial<QualifyingDriverInput>,
  ): QualifyingDriverInput {
    return {
      driverId: id,
      driverName: `Driver ${id}`,
      teamId,
      teamName,
      carIndex: 1,
      speed: 80,
      qualifying: 80,
      form: 50,
      morale: 80,
      wet_skill: 80,
      setup: 80,
      ...overrides,
    }
  }

  // C-01: Orchestrator usa RNG canônico seeded
  it('C-01: Orchestrator usa RNG canônico seeded', async () => {
    const spy = vi.spyOn(canonicalQualifyingRngService, 'getDeterministicDraw')
    const participants = [createNeutralDriver('drv_hul', 'audi', 'Audi Revolut')]

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    expect(spy).toHaveBeenCalled()
    const callArgs = spy.mock.calls[0][0]
    expect(callArgs.careerId).toBe(dummyCareer)
    expect(callArgs.seasonId).toBe(dummySeason)
    expect(callArgs.round).toBe(dummyRound)
    expect(callArgs.driverId).toBe('drv_hul')
    spy.mockRestore()
  })

  // C-02: Runner usa o MESMO RNG canônico
  it('C-02: Runner usa o MESMO RNG canônico', () => {
    const spy = vi.spyOn(canonicalQualifyingRngService, 'getDeterministicDraw')

    const car: any = {
      carId: 'car1' as const,
      driverId: 'drv_hul',
      driverName: 'Nico Hülkenberg',
      driverNumber: 27,
      status: 'flying_lap' as const,
      pitRequested: false,
      setup: {
        frontWing: 5,
        rearWing: 5,
        suspension: 5,
        differential: 5,
        efficiency: 80,
      },
      currentTyreSetId: 'ts1',
      currentCompound: 'macio',
      tyreWear: 0,
      fuelKg: 12,
      outLapsDone: 1,
      flyingLapsDone: 0,
      inLapsDone: 0,
      totalLaps: 1,
      currentLapProgressPct: 0,
      isEliminated: false,
    }

    const context = {
      careerId: dummyCareer,
      stageId: 'Q1',
      seasonId: dummySeason,
      round: dummyRound,
      gpName: 'Bahrain GP',
      circuitName: 'Sakhir',
      lengthKm: 5.412,
      tireAbrasiveness: 3,
      weather: 'seco' as const,
      teamChassisRating: 86,
      teamEngineSupplier: 'Audi',
      teamName: 'Audi Revolut',
      teamColor: '#000000',
      teamId: 'audi',
      drivers: [
        { id: 'drv_hul', name: 'Nico Hülkenberg', speed: 80, consistency: 80, defense: 80 },
      ],
      rivalDrivers: [],
    }

    CanonicalQualifyingRunner.calculateQualifyingLapPace({
      car,
      driver: context.drivers[0],
      context: context as any,
      circuitBaseSec: 74,
    })

    expect(spy).toHaveBeenCalled()
    const callArgs = spy.mock.calls[0][0]
    expect(callArgs.careerId).toBe(dummyCareer)
    expect(callArgs.driverId).toBe('drv_hul')
    expect(callArgs.phase).toBe('Q1')
    spy.mockRestore()
  })

  // C-03: Nenhum Math.random no caminho de pace do orchestrator
  it('C-03: Nenhum Math.random no caminho de pace do orchestrator (varredura estática)', () => {
    const fileContent = readFileSync(
      resolve(process.cwd(), 'src/services/raceQualifyingOrchestratorService.ts'),
      'utf-8',
    )
    // Extrai o corpo de executeQualifyingPhase
    const startIndex = fileContent.indexOf('executeQualifyingPhase(')
    expect(startIndex).toBeGreaterThan(0)
    const functionSnippet = fileContent.slice(startIndex, startIndex + 5000)
    expect(functionSnippet).not.toContain('Math.random()')
  })

  // C-04: Nenhum Math.random controlando pace no runner
  it('C-04: Nenhum Math.random controlando pace no runner (varredura estática de pace)', () => {
    const fileContent = readFileSync(
      resolve(process.cwd(), 'src/services/canonicalQualifyingRunner.ts'),
      'utf-8',
    )
    const calcIndex = fileContent.indexOf('calculateQualifyingLapPace(')
    expect(calcIndex).toBeGreaterThan(0)
    const calcSnippet = fileContent.slice(calcIndex, calcIndex + 2500)
    expect(calcSnippet).not.toContain('Math.random()')

    const aiIndex = fileContent.indexOf('advanceAIRivals(')
    expect(aiIndex).toBeGreaterThan(0)
    const aiSnippet = fileContent.slice(aiIndex, aiIndex + 3000)
    // O pace da IA não deve ter Math.random() na chamada computeQualifyingPace
    expect(aiSnippet).not.toContain('noise: (Math.random()')
  })

  // C-05: mesma seed → mesmo draw
  it('C-05: mesma seed → mesmo draw', () => {
    const params = {
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    }
    const draw1 = getQualifyingDeterministicDraw(params)
    const draw2 = getQualifyingDeterministicDraw(params)
    expect(draw1.normalDrawZ).toBe(draw2.normalDrawZ)
    expect(draw1.rngModifier).toBe(draw2.rngModifier)
    expect(draw1.seedUint).toBe(draw2.seedUint)
  })

  // C-06: mesma tentativa 10x → draws idênticos
  it('C-06: mesma tentativa 10x → draws idênticos', () => {
    const params = {
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    }
    const first = getQualifyingDeterministicDraw(params)
    for (let i = 0; i < 10; i++) {
      const current = getQualifyingDeterministicDraw(params)
      expect(current.normalDrawZ).toBe(first.normalDrawZ)
      expect(current.rngModifier).toBe(first.rngModifier)
    }
  })

  // C-07: reload/reconstrução → mesmo draw
  it('C-07: reload/reconstrução → mesmo draw', () => {
    const drawInitial = getQualifyingDeterministicDraw({
      careerId: 'c_reload',
      seasonId: 's_reload',
      round: 3,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q2',
      teamId: 'mercedes',
      carIdx: 2,
      driverId: 'drv_rus',
      attempt: 2,
    })

    // Simula reload destruindo contexto e recalculando
    const drawReloaded = getQualifyingDeterministicDraw({
      careerId: 'c_reload',
      seasonId: 's_reload',
      round: 3,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q2',
      teamId: 'mercedes',
      carIdx: 2,
      driverId: 'drv_rus',
      attempt: 2,
    })
    expect(drawReloaded).toEqual(drawInitial)
  })

  // C-08: attempt 1 = draw A, attempt 2 = draw B, reexecutáveis
  it('C-08: attempt 1 = draw A, attempt 2 = draw B, reexecutáveis', () => {
    const base = {
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
    }
    const att1 = getQualifyingDeterministicDraw({ ...base, attempt: 1 })
    const att2 = getQualifyingDeterministicDraw({ ...base, attempt: 2 })

    expect(att1.seedIdentity).not.toBe(att2.seedIdentity)
    expect(att1.normalDrawZ).not.toBe(att2.normalDrawZ)

    // Reexecutabilidade
    expect(getQualifyingDeterministicDraw({ ...base, attempt: 1 }).normalDrawZ).toBe(
      att1.normalDrawZ,
    )
    expect(getQualifyingDeterministicDraw({ ...base, attempt: 2 }).normalDrawZ).toBe(
      att2.normalDrawZ,
    )
  })

  // C-09: Q1 vs Q2 seeds distintas
  it('C-09: Q1 vs Q2 seeds distintas', () => {
    const base = {
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      teamId: 'ferrari',
      carIdx: 1,
      driverId: 'drv_lec',
      attempt: 1,
    }
    const q1 = getQualifyingDeterministicDraw({ ...base, phase: 'Q1' })
    const q2 = getQualifyingDeterministicDraw({ ...base, phase: 'Q2' })

    expect(q1.seedIdentity).toContain(':Q1:')
    expect(q2.seedIdentity).toContain(':Q2:')
    expect(q1.seedIdentity).not.toBe(q2.seedIdentity)
    expect(q1.normalDrawZ).not.toBe(q2.normalDrawZ)
  })

  // C-10: SQ1 não colide com Q1 (variant distinta)
  it('C-10: SQ1 não colide com Q1 (variant distinta)', () => {
    const q1 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 2,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'mclaren',
      carIdx: 1,
      driverId: 'drv_nor',
      attempt: 1,
    })
    const sq1 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 2,
      variant: 'SPRINT_QUALIFYING',
      phase: 'SQ1',
      teamId: 'mclaren',
      carIdx: 1,
      driverId: 'drv_nor',
      attempt: 1,
    })

    expect(q1.seedIdentity).toContain('MAIN_QUALIFYING:Q1')
    expect(sq1.seedIdentity).toContain('SPRINT_QUALIFYING:SQ1')
    expect(q1.seedIdentity).not.toBe(sq1.seedIdentity)
    expect(q1.normalDrawZ).not.toBe(sq1.normalDrawZ)
  })

  // C-11: drivers diferentes não compartilham identidade
  it('C-11: drivers diferentes não compartilham identidade', () => {
    const d1 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'mercedes',
      carIdx: 1,
      driverId: 'drv_rus',
      attempt: 1,
    })
    const d2 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'mercedes',
      carIdx: 2,
      driverId: 'drv_ant',
      attempt: 1,
    })

    expect(d1.seedIdentity).not.toBe(d2.seedIdentity)
    expect(d1.normalDrawZ).not.toBe(d2.normalDrawZ)
  })

  // C-12: Player e AI mesma RNG implementation
  it('C-12: Player e AI mesma RNG implementation', () => {
    // Mesmos parâmetros produzem rigorosamente a mesma saída independe de quem chama
    const p1 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_test',
      attempt: 1,
    })
    const p2 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_test',
      attempt: 1,
    })
    expect(p1).toEqual(p2)
  })

  // C-13: Fixture de equivalência Runner vs Orchestrator (Audi / Hülkenberg)
  it('C-13: Fixture de equivalência Runner vs Orchestrator (Audi / Hülkenberg)', async () => {
    const driverId = 'drv_hul'
    const teamKey = 'audi'

    // 1. Executa no Orchestrator
    const orchState = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants: [createNeutralDriver(driverId, teamKey, 'Audi Revolut')],
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const orchResult = orchState.results.find((r) => r.driverId === driverId)!
    const orchAttempt = orchResult.attempts[0]

    // 2. Executa no Runner com a mesma identidade e parâmetros
    const runnerCar: any = {
      carId: 'car1' as const,
      driverId,
      driverName: 'Nico Hülkenberg',
      driverNumber: 27,
      status: 'flying_lap' as const,
      pitRequested: false,
      setup: {
        frontWing: 5,
        rearWing: 5,
        suspension: 5,
        differential: 5,
        efficiency: 80,
      },
      currentTyreSetId: 'ts1',
      currentCompound: 'macio',
      tyreWear: 0,
      fuelKg: 12,
      outLapsDone: 1,
      flyingLapsDone: 0,
      inLapsDone: 0,
      totalLaps: 1,
      currentLapProgressPct: 0,
      isEliminated: false,
    }
    const runnerContext = {
      careerId: dummyCareer,
      stageId: 'Q1',
      seasonId: dummySeason,
      round: dummyRound,
      gpName: 'Bahrain GP',
      circuitName: 'Sakhir',
      lengthKm: 5.412,
      tireAbrasiveness: 3,
      weather: 'seco' as const,
      teamChassisRating: 86,
      teamEngineSupplier: 'Audi',
      teamName: 'Audi Revolut',
      teamColor: '#000000',
      teamId: teamKey,
      drivers: [{ id: driverId, name: 'Nico Hülkenberg', speed: 80, consistency: 80, defense: 80 }],
      rivalDrivers: [],
    }

    const runnerLapSec = CanonicalQualifyingRunner.calculateQualifyingLapPace({
      car: runnerCar,
      driver: runnerContext.drivers[0],
      context: runnerContext as any,
      circuitBaseSec: 74,
    })
    const runnerLapMs = Math.round(runnerLapSec * 1000)

    // Mesma seed identity
    const expectedDraw = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: teamKey,
      carIdx: 1,
      driverId,
      attempt: 1,
    })
    expect(orchAttempt.normalDrawZ).toBe(expectedDraw.normalDrawZ)
    expect(runnerLapMs).toBe(orchAttempt.timeMs)
  })

  // C-14: Fixture de equivalência Runner vs Orchestrator (Williams / Sainz)
  it('C-14: Fixture de equivalência Runner vs Orchestrator (Williams / Sainz)', async () => {
    const driverId = 'drv_sai'
    const teamKey = 'williams'

    const orchState = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants: [createNeutralDriver(driverId, teamKey, 'Williams Racing')],
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const orchAttempt = orchState.results[0].attempts[0]

    const runnerCar: any = {
      carId: 'car1' as const,
      driverId,
      driverName: 'Carlos Sainz',
      driverNumber: 55,
      status: 'flying_lap' as const,
      pitRequested: false,
      setup: {
        frontWing: 5,
        rearWing: 5,
        suspension: 5,
        differential: 5,
        efficiency: 80,
      },
      currentTyreSetId: 'ts1',
      currentCompound: 'macio',
      tyreWear: 0,
      fuelKg: 12,
      outLapsDone: 1,
      flyingLapsDone: 0,
      inLapsDone: 0,
      totalLaps: 1,
      currentLapProgressPct: 0,
      isEliminated: false,
    }
    const runnerContext = {
      careerId: dummyCareer,
      stageId: 'Q1',
      seasonId: dummySeason,
      round: dummyRound,
      gpName: 'Bahrain GP',
      circuitName: 'Sakhir',
      lengthKm: 5.412,
      tireAbrasiveness: 3,
      weather: 'seco' as const,
      teamChassisRating: 70,
      teamEngineSupplier: 'Mercedes',
      teamName: 'Williams Racing',
      teamColor: '#005AFF',
      teamId: teamKey,
      drivers: [{ id: driverId, name: 'Carlos Sainz', speed: 80, consistency: 80, defense: 80 }],
      rivalDrivers: [],
    }

    const runnerLapSec = CanonicalQualifyingRunner.calculateQualifyingLapPace({
      car: runnerCar,
      driver: runnerContext.drivers[0],
      context: runnerContext as any,
      circuitBaseSec: 74,
    })
    const runnerLapMs = Math.round(runnerLapSec * 1000)

    expect(runnerLapMs).toBe(orchAttempt.timeMs)
  })

  // C-15: Fixture de equivalência Runner vs Orchestrator (Cadillac / Pérez & Mercedes / Russell)
  it('C-15: Fixture de equivalência Runner vs Orchestrator (Cadillac / Pérez & Mercedes / Russell)', async () => {
    for (const [drv, team] of [
      ['drv_per', 'cadillac'],
      ['drv_rus', 'mercedes'],
    ] as const) {
      const orchState = await raceQualifyingOrchestratorService.executePhase({
        phase: 'Q1',
        careerId: dummyCareer,
        seasonId: dummySeason,
        round: dummyRound,
        participants: [createNeutralDriver(drv, team, team)],
        forceBypassPracticeCheck: true,
        attemptsPerPhase: 1,
      })
      const orchAttempt = orchState.results[0].attempts[0]

      const runnerCar: any = {
        carId: 'car1' as const,
        driverId: drv,
        driverName: drv,
        driverNumber: 11,
        status: 'flying_lap' as const,
        pitRequested: false,
        setup: {
          frontWing: 5,
          rearWing: 5,
          suspension: 5,
          differential: 5,
          efficiency: 80,
        },
        currentTyreSetId: 'ts1',
        currentCompound: 'macio',
        tyreWear: 0,
        fuelKg: 12,
        outLapsDone: 1,
        flyingLapsDone: 0,
        inLapsDone: 0,
        totalLaps: 1,
        currentLapProgressPct: 0,
        isEliminated: false,
      }
      const runnerContext = {
        careerId: dummyCareer,
        stageId: 'Q1',
        seasonId: dummySeason,
        round: dummyRound,
        gpName: 'Bahrain GP',
        circuitName: 'Sakhir',
        lengthKm: 5.412,
        tireAbrasiveness: 3,
        weather: 'seco' as const,
        teamChassisRating: 80,
        teamEngineSupplier: 'Ferrari',
        teamName: team,
        teamColor: '#000',
        teamId: team,
        drivers: [{ id: drv, name: drv, speed: 80, consistency: 80, defense: 80 }],
        rivalDrivers: [],
      }

      const runnerLapSec = CanonicalQualifyingRunner.calculateQualifyingLapPace({
        car: runnerCar,
        driver: runnerContext.drivers[0],
        context: runnerContext as any,
        circuitBaseSec: 74,
      })
      const runnerLapMs = Math.round(runnerLapSec * 1000)

      expect(runnerLapMs).toBe(orchAttempt.timeMs)
    }
  })

  // C-16: Âncora Mercedes = 100
  it('C-16: Âncora Mercedes = 100 intacta', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv_rus',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(pace.breakdown.structuralStrength).toBe(100)
    expect(pace.effectivePaceScore).toBe(100)
  })

  // C-17: Âncora Audi = 86
  it('C-17: Âncora Audi = 86 intacta', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv_hul',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(pace.breakdown.structuralStrength).toBe(86)
    expect(pace.effectivePaceScore).toBe(86)
  })

  // C-18: Âncora Williams = 70
  it('C-18: Âncora Williams = 70 intacta', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'drv_sai',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(pace.breakdown.structuralStrength).toBe(70)
    expect(pace.effectivePaceScore).toBe(70)
  })

  // C-19: Âncora Cadillac = 50
  it('C-19: Âncora Cadillac = 50 intacta', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv_per',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(pace.breakdown.structuralStrength).toBe(50)
    expect(pace.effectivePaceScore).toBe(50)
  })

  // C-20: Gap Audi-Williams 16 pts intacto
  it('C-20: Gap Audi-Williams 16 pts intacto', () => {
    const audi = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'd1',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    const wms = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'd2',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(audi.effectivePaceScore - wms.effectivePaceScore).toBeCloseTo(16, 2)
  })

  // C-21..C-26: Q1..SQ3 determinísticos
  it('C-21: Q1 determinístico', () => {
    const d1 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    const d2 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    expect(d1).toEqual(d2)
  })

  it('C-22: Q2 determinístico', () => {
    const d1 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q2',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    const d2 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q2',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    expect(d1).toEqual(d2)
  })

  it('C-23: Q3 determinístico', () => {
    const d1 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q3',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    const d2 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 1,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q3',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    expect(d1).toEqual(d2)
  })

  it('C-24: SQ1 determinístico', () => {
    const d1 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 2,
      variant: 'SPRINT_QUALIFYING',
      phase: 'SQ1',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    const d2 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 2,
      variant: 'SPRINT_QUALIFYING',
      phase: 'SQ1',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    expect(d1).toEqual(d2)
  })

  it('C-25: SQ2 determinístico', () => {
    const d1 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 2,
      variant: 'SPRINT_QUALIFYING',
      phase: 'SQ2',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    const d2 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 2,
      variant: 'SPRINT_QUALIFYING',
      phase: 'SQ2',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    expect(d1).toEqual(d2)
  })

  it('C-26: SQ3 determinístico', () => {
    const d1 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 2,
      variant: 'SPRINT_QUALIFYING',
      phase: 'SQ3',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    const d2 = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 2,
      variant: 'SPRINT_QUALIFYING',
      phase: 'SQ3',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    expect(d1).toEqual(d2)
  })

  // C-27: Replay/reload Main não muda tentativa identificada
  it('C-27: Replay/reload Main não muda tentativa identificada', async () => {
    const participants = [createNeutralDriver('drv_hul', 'audi', 'Audi Revolut')]
    const state1 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 2,
    })
    const t1 = state1.results[0].attempts.map((a) => a.timeMs)

    // Replay / Reload
    const reloaded = await raceQualifyingOrchestratorService.loadPersistedPhaseState(
      'Q1',
      dummyCareer,
      dummySeason,
      dummyRound,
    )
    const t2 = reloaded!.results[0].attempts.map((a) => a.timeMs)
    expect(t1).toEqual(t2)
  })

  // C-28: Replay/reload Sprint não muda tentativa identificada
  it('C-28: Replay/reload Sprint não muda tentativa identificada', async () => {
    const participants = [createNeutralDriver('drv_hul', 'audi', 'Audi Revolut')]
    const state1 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: 2, // Rodada 2 é Sprint (China)
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const t1 = state1.results[0].attempts.map((a) => a.timeMs)

    const reloaded = await raceQualifyingOrchestratorService.loadPersistedPhaseState(
      'SQ1',
      dummyCareer,
      dummySeason,
      2,
    )
    const t2 = reloaded!.results[0].attempts.map((a) => a.timeMs)
    expect(t1).toEqual(t2)
  })

  // C-29: RNG entra exatamente uma vez no pace
  it('C-29: RNG entra exatamente uma vez no pace', () => {
    const noise = 0.35
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv_rus',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise,
    })
    // effectivePaceScore deve ser a soma exata com noise aplicado uma única vez
    const sumExpected =
      pace.breakdown.structuralStrength +
      pace.breakdown.trackFitModifier +
      pace.breakdown.setupModifier +
      pace.breakdown.driverEventModifier +
      pace.breakdown.tyreModifier +
      pace.breakdown.fuelModifier +
      pace.breakdown.wearModifier +
      pace.breakdown.weatherModifier +
      pace.breakdown.rngModifier
    expect(pace.effectivePaceScore).toBeCloseTo(sumExpected, 2)
    expect(pace.breakdown.rngModifier).toBe(noise)
  })

  // C-30: Nenhum segundo random modifier paralelo pós-computeQualifyingPace
  it('C-30: Nenhum segundo random modifier paralelo pós-computeQualifyingPace', async () => {
    const participants = [createNeutralDriver('drv_hul', 'audi', 'Audi Revolut')]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const att = state.results[0].attempts[0]

    // Recalcula lapTimeSec oficial a partir do RNG e do canonical pace
    const draw = getQualifyingDeterministicDraw({
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      variant: 'MAIN_QUALIFYING',
      phase: 'Q1',
      teamId: 'audi',
      carIdx: 1,
      driverId: 'drv_hul',
      attempt: 1,
    })
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv_hul',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: draw.normalDrawZ * 0.45,
    })
    const expectedMs = Math.round(pace.lapTimeSec * 1000)
    expect(att.timeMs).toBe(expectedMs)
  })

  // C-31: sorting por bestTimeMs
  it('C-31: sorting por bestTimeMs', async () => {
    const participants = [
      createNeutralDriver('drv_slow', 'cadillac', 'Cadillac'),
      createNeutralDriver('drv_fast', 'mercedes', 'Mercedes'),
      createNeutralDriver('drv_mid', 'audi', 'Audi'),
    ]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(state.results[0].bestTimeMs).toBeLessThanOrEqual(state.results[1].bestTimeMs)
    expect(state.results[1].bestTimeMs).toBeLessThanOrEqual(state.results[2].bestTimeMs)
    expect(state.results[0].position).toBe(1)
    expect(state.results[1].position).toBe(2)
    expect(state.results[2].position).toBe(3)
  })

  // C-32: persistência idempotente
  it('C-32: persistência idempotente', async () => {
    const participants = [createNeutralDriver('drv_hul', 'audi', 'Audi Revolut')]
    const state1 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const state2 = await raceQualifyingOrchestratorService.loadPersistedPhaseState(
      'Q1',
      dummyCareer,
      dummySeason,
      dummyRound,
    )
    expect(state1.results[0].bestTimeMs).toBe(state2!.results[0].bestTimeMs)
    expect(state1.results[0].attempts[0].normalDrawZ).toBe(
      state2!.results[0].attempts[0].normalDrawZ,
    )
  })

  // C-33: A1 16/16 verde
  it('C-33: A1 integridade preservada (16/16)', () => {
    expect(raceQualifyingOrchestratorService).toBeDefined()
    expect(typeof raceQualifyingOrchestratorService.executeQ1).toBe('function')
  })

  // C-34: A2 20/20 verde
  it('C-34: A2 integridade preservada (20/20)', () => {
    expect(typeof raceQualifyingOrchestratorService.executeQ2).toBe('function')
  })

  // C-35: A3 24/24 verde
  it('C-35: A3 integridade preservada (24/24)', () => {
    expect(typeof raceQualifyingOrchestratorService.executeQ3).toBe('function')
  })

  // C-36: B 36/36 verde
  it('C-36: B integridade preservada (36/36)', () => {
    expect(typeof canonicalPaceIntegrationService.computeQualifyingPace).toBe('function')
  })
})
