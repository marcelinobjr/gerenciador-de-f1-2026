import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  raceQualifyingOrchestratorService,
  type QualifyingDriverInput,
} from '@/services/raceQualifyingOrchestratorService'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { BASELINE_2026_V1_TEAMS } from '@/data/baseline-2026-v1'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'

describe('QUALI-UNIFY-01B: Canonical Pace Integration in Qualifying Orchestrator', () => {
  const dummyCareer = 'car_test_quali_01b'
  const dummySeason = 'season_2026'
  const dummyRound = 1
  const defaultCircuitProfile = resolveCircuitProfile({ round: dummyRound })

  beforeEach(() => {
    localStorage.clear()
    raceQualifyingOrchestratorService.clearMemoryCache()
    vi.restoreAllMocks()
  })

  // Helper para criar participante neutro padronizado
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
      setup: 80, // neutro canônico
      ...overrides,
    }
  }

  // =========================================================================
  // CASOS B-01 .. B-36 EXATOS CONFORME ESPECIFICAÇÃO
  // =========================================================================

  // B-01: orchestrator usa computeQualifyingPace no caminho oficial de pace
  it('B-01: orchestrator usa computeQualifyingPace no caminho oficial de pace', async () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    const participants = [
      createNeutralDriver('drv_merc', 'mercedes', 'Mercedes'),
      createNeutralDriver('drv_fer', 'ferrari', 'Ferrari'),
    ]

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
    spy.mockRestore()
  })

  // B-02: Mercedes usa Structural = 100
  it('B-02: Mercedes usa Structural = 100', async () => {
    const participants = [createNeutralDriver('drv_merc', 'mercedes', 'Mercedes-AMG Petronas')]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const res = state.results.find((r) => r.driverId === 'drv_merc')!
    const canonPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv_merc',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: 0,
    })
    expect(canonPace.breakdown.structuralStrength).toBe(100)
    expect(res.trackRating).toBe(canonPace.effectivePaceScore)
    expect(res.trackRating).toBe(100)
  })

  // B-03: Audi usa Structural = 86
  it('B-03: Audi usa Structural = 86', async () => {
    const participants = [createNeutralDriver('drv_audi', 'audi', 'Audi Revolut F1 Team')]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const res = state.results.find((r) => r.driverId === 'drv_audi')!
    const canonPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv_audi',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: 0,
    })
    expect(canonPace.breakdown.structuralStrength).toBe(86)
    expect(res.trackRating).toBe(canonPace.effectivePaceScore)
    expect(res.trackRating).toBe(86)
  })

  // B-04: Williams usa Structural = 70
  it('B-04: Williams usa Structural = 70', async () => {
    const participants = [createNeutralDriver('drv_wms', 'williams', 'Williams Racing')]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const res = state.results.find((r) => r.driverId === 'drv_wms')!
    const canonPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'drv_wms',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: 0,
    })
    expect(canonPace.breakdown.structuralStrength).toBe(70)
    expect(res.trackRating).toBe(canonPace.effectivePaceScore)
    expect(res.trackRating).toBe(70)
  })

  // B-05: Cadillac usa Structural = 50
  it('B-05: Cadillac usa Structural = 50', async () => {
    const participants = [createNeutralDriver('drv_cad', 'cadillac', 'Cadillac F1 Team')]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const res = state.results.find((r) => r.driverId === 'drv_cad')!
    const canonPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv_cad',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: 0,
    })
    expect(canonPace.breakdown.structuralStrength).toBe(50)
    expect(res.trackRating).toBe(canonPace.effectivePaceScore)
    expect(res.trackRating).toBe(50)
  })

  // B-06: Andretti usa Structural = 45
  it('B-06: Andretti usa Structural = 45', async () => {
    const participants = [createNeutralDriver('drv_and', 'andretti', 'Andretti Global')]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const res = state.results.find((r) => r.driverId === 'drv_and')!
    const canonPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'andretti',
      driverId: 'drv_and',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: 0,
    })
    expect(canonPace.breakdown.structuralStrength).toBe(45)
    expect(res.trackRating).toBe(canonPace.effectivePaceScore)
    expect(res.trackRating).toBe(45)
  })

  // B-07: teams.strength não controla pace (fixture: Audi teams.strength = 20, Structural continua 86)
  it('B-07: teams.strength não controla pace (fixture: Audi teams.strength = 20, Structural continua 86)', async () => {
    const participants = [
      createNeutralDriver('drv_audi_s20', 'team_audi', 'Audi Revolut', {
        carPerformance: 20, // Stale strength ignorado
      }),
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
    const res = state.results.find((r) => r.driverId === 'drv_audi_s20')!
    const canonPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv_audi_s20',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: 0,
    })
    expect(canonPace.breakdown.structuralStrength).toBe(86)
    expect(res.trackRating).toBe(86)
    expect(res.trackRating).not.toBe(20)
  })

  // B-08: fixture Williams teams.strength = 99, Structural continua 70
  it('B-08: fixture Williams teams.strength = 99, Structural continua 70', async () => {
    const participants = [
      createNeutralDriver('drv_wms_s99', 'team_williams', 'Williams Racing', {
        carPerformance: 99, // Stale strength ignorado
      }),
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
    const res = state.results.find((r) => r.driverId === 'drv_wms_s99')!
    const canonPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'drv_wms_s99',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: 0,
    })
    expect(canonPace.breakdown.structuralStrength).toBe(70)
    expect(res.trackRating).toBe(70)
    expect(res.trackRating).not.toBe(99)
  })

  // B-09: modelo legado 0.65×carPerformance + 0.35×effective_driver não participa do caminho oficial
  it('B-09: modelo legado 0.65×carPerformance + 0.35×effective_driver não participa do caminho oficial', async () => {
    const carPerf = 90
    const speed = 70
    const participants = [
      createNeutralDriver('drv_legacy_test', 'williams', 'Williams Racing', {
        carPerformance: carPerf,
        speed: speed,
      }),
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
    const res = state.results[0]
    // Se o modelo legado 0.65 * 90 + 0.35 * 70 = 58.5 + 24.5 = 83 estivesse ativo:
    const legacyLinearScore = 0.65 * carPerf + 0.35 * speed
    expect(res.trackRating).not.toBeCloseTo(legacyLinearScore, 1)

    // Caminho oficial: Williams Structural (70) + Driver Execution canônico
    const canonPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'drv_legacy_test',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 70, morale: 80 },
      noise: 0,
    })
    expect(res.trackRating).toBe(canonPace.effectivePaceScore)
  })

  // B-10: min-max para 2500ms não participa do caminho oficial
  it('B-10: min-max para 2500ms não participa do caminho oficial', async () => {
    const participants = [
      createNeutralDriver('drv_merc', 'mercedes', 'Mercedes'),
      createNeutralDriver('drv_and', 'andretti', 'Andretti'),
    ]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b10',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const merc = state.results.find((r) => r.driverId === 'drv_merc')!
    const and = state.results.find((r) => r.driverId === 'drv_and')!
    const deltaMs = and.basePaceMs - merc.basePaceMs

    // Mercedes 100 vs Andretti 45 = 55 pace points * 82ms/pt = 4510ms
    // Se o min-max legados de 2500ms estivesse ativo, o gap estaria comprimido para 2500ms
    expect(deltaMs).toBeCloseTo(4510, -1)
    expect(deltaMs).not.toBe(2500)
    expect(deltaMs).toBeGreaterThan(3500)
  })

  // B-11: fixture neutra Audi 86 vs Williams 70, delta 16 pace points
  it('B-11: fixture neutra Audi 86 vs Williams 70, delta 16 pace points (~1.312 s)', () => {
    const audiPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv1',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    const wmsPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'drv2',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    const paceDelta = audiPace.effectivePaceScore - wmsPace.effectivePaceScore
    expect(paceDelta).toBeCloseTo(16, 2)
    const timeDeltaSec = wmsPace.lapTimeSec - audiPace.lapTimeSec
    expect(timeDeltaSec).toBeCloseTo(16 * 0.082, 3) // 1.312 s
  })

  // B-12: fixture neutra Audi 86 vs Cadillac 50, delta 36
  it('B-12: fixture neutra Audi 86 vs Cadillac 50, delta 36 pace points (~2.952 s)', () => {
    const audiPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv1',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    const cadPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv2',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    const paceDelta = audiPace.effectivePaceScore - cadPace.effectivePaceScore
    expect(paceDelta).toBeCloseTo(36, 2)
    const timeDeltaSec = cadPace.lapTimeSec - audiPace.lapTimeSec
    expect(timeDeltaSec).toBeCloseTo(36 * 0.082, 3) // 2.952 s
  })

  // B-13: fixture neutra Mercedes 100 vs Andretti 45, delta 55
  it('B-13: fixture neutra Mercedes 100 vs Andretti 45, delta 55 pace points (~4.510 s)', () => {
    const mercPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv1',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    const andPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'andretti',
      driverId: 'drv2',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    const paceDelta = mercPace.effectivePaceScore - andPace.effectivePaceScore
    expect(paceDelta).toBeCloseTo(55, 2)
    const timeDeltaSec = andPace.lapTimeSec - mercPace.lapTimeSec
    expect(timeDeltaSec).toBeCloseTo(55 * 0.082, 3) // 4.510 s
  })

  // B-14: full grid — medir gap neutro Audi-Williams
  it('B-14: full grid — medir gap neutro Audi-Williams', async () => {
    const fullGrid: QualifyingDriverInput[] = [
      createNeutralDriver('drv_merc', 'mercedes', 'Mercedes'),
      createNeutralDriver('drv_fer', 'ferrari', 'Ferrari'),
      createNeutralDriver('drv_mcl', 'mclaren', 'McLaren'),
      createNeutralDriver('drv_rb', 'red_bull', 'Red Bull'),
      createNeutralDriver('drv_rbulls', 'racing_bulls', 'Racing Bulls'),
      createNeutralDriver('drv_alp', 'alpine', 'Alpine'),
      createNeutralDriver('drv_audi', 'audi', 'Audi'),
      createNeutralDriver('drv_haas', 'haas', 'Haas'),
      createNeutralDriver('drv_wms', 'williams', 'Williams'),
      createNeutralDriver('drv_am', 'aston_martin', 'Aston Martin'),
      createNeutralDriver('drv_cad', 'cadillac', 'Cadillac'),
      createNeutralDriver('drv_and', 'andretti', 'Andretti'),
    ]

    const fullState = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b14_full',
      seasonId: dummySeason,
      round: dummyRound,
      participants: fullGrid,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const audi = fullState.results.find((r) => r.driverId === 'drv_audi')!
    const wms = fullState.results.find((r) => r.driverId === 'drv_wms')!
    const deltaMs = wms.basePaceMs - audi.basePaceMs

    // Audi 86 vs Williams 70: 16 pts * 82ms = 1312 ms
    expect(deltaMs).toBe(1312)
  })

  // B-15: subset grid — mesmos Audi/Williams, mesmas condições, menos participantes; gap permanece idêntico, sem renormalização por população
  it('B-15: subset grid — gap Audi-Williams permanece rigorosamente idêntico ao full grid', async () => {
    const subsetGrid: QualifyingDriverInput[] = [
      createNeutralDriver('drv_audi', 'audi', 'Audi'),
      createNeutralDriver('drv_wms', 'williams', 'Williams'),
    ]

    const subState = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b15_subset',
      seasonId: dummySeason,
      round: dummyRound,
      participants: subsetGrid,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const subAudi = subState.results.find((r) => r.driverId === 'drv_audi')!
    const subWms = subState.results.find((r) => r.driverId === 'drv_wms')!
    const subDeltaMs = subWms.basePaceMs - subAudi.basePaceMs

    // Compara com B-14 (1312ms): gap idêntico, sem renormalização
    expect(subDeltaMs).toBe(1312)
    expect(subAudi.basePaceMs).toBe(75148) // 74000 + (100 - 86) * 82 = 75148
    expect(subWms.basePaceMs).toBe(76460) // 74000 + (100 - 70) * 82 = 76460
  })

  // B-16: Q2 não usa carPerformance ?? 80 como fonte de performance
  it('B-16: Q2 não usa carPerformance ?? 80 como fonte de performance', async () => {
    const q1Participants: QualifyingDriverInput[] = []
    for (let i = 1; i <= 24; i++) {
      const teamKey = i <= 2 ? 'mercedes' : i <= 4 ? 'audi' : i <= 6 ? 'williams' : 'cadillac'
      q1Participants.push(
        createNeutralDriver(`drv_q2_${i}`, teamKey, teamKey, {
          carPerformance: undefined, // Sem carPerformance
        }),
      )
    }

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b16_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      participants: q1Participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const q2State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_b16_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const audiQ2 = q2State.results.find((r) => r.teamId === 'audi')!
    const wmsQ2 = q2State.results.find((r) => r.teamId === 'williams')!

    expect(audiQ2.trackRating).toBe(86)
    expect(wmsQ2.trackRating).toBe(70)
    expect(audiQ2.trackRating).not.toBe(80)
    expect(wmsQ2.trackRating).not.toBe(80)
  })

  // B-17: Q3 não usa carPerformance ?? 80
  it('B-17: Q3 não usa carPerformance ?? 80', async () => {
    const q1Participants: QualifyingDriverInput[] = []
    for (let i = 1; i <= 24; i++) {
      const teamKey = i <= 2 ? 'mercedes' : i <= 4 ? 'ferrari' : i <= 6 ? 'mclaren' : 'williams'
      q1Participants.push(createNeutralDriver(`drv_q3_${i}`, teamKey, teamKey))
    }

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b17_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      participants: q1Participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_b17_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const q3State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q3',
      careerId: 'career_b17_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const mercDriver = q3State.results.find((r) => r.teamId === 'mercedes')!
    expect(mercDriver.trackRating).toBe(100)
    expect(mercDriver.trackRating).not.toBe(80)
  })

  // B-18: SQ2 não usa carPerformance ?? 80
  it('B-18: SQ2 não usa carPerformance ?? 80', async () => {
    const sq1Participants: QualifyingDriverInput[] = []
    for (let i = 1; i <= 24; i++) {
      const teamKey = i <= 2 ? 'mercedes' : i <= 4 ? 'audi' : 'williams'
      sq1Participants.push(createNeutralDriver(`drv_sq2_${i}`, teamKey, teamKey))
    }

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_b18_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      participants: sq1Participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const sq2State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: 'career_b18_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const audiSQ2 = sq2State.results.find((r) => r.teamId === 'audi')!
    const canonAudi = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: audiSQ2.driverId,
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      tyreCompound: 'medio',
      noise: 0,
    })
    expect(audiSQ2.trackRating).toBe(canonAudi.effectivePaceScore)
    expect(audiSQ2.trackRating).not.toBe(80)
  })

  // B-19: SQ3 não usa carPerformance ?? 80
  it('B-19: SQ3 não usa carPerformance ?? 80', async () => {
    const sq1Participants: QualifyingDriverInput[] = []
    for (let i = 1; i <= 24; i++) {
      const teamKey = i <= 2 ? 'mercedes' : i <= 4 ? 'audi' : 'williams'
      sq1Participants.push(createNeutralDriver(`drv_sq3_${i}`, teamKey, teamKey))
    }

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_b19_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      participants: sq1Participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: 'career_b19_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const sq3State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ3',
      careerId: 'career_b19_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const mercSQ3 = sq3State.results.find((r) => r.teamId === 'mercedes')!
    expect(mercSQ3.trackRating).toBe(100)
    expect(mercSQ3.trackRating).not.toBe(80)
  })

  // B-20: Q1 usa canonical pace core
  it('B-20: Q1 usa canonical pace core', async () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b20',
      seasonId: dummySeason,
      round: dummyRound,
      participants: [createNeutralDriver('d1', 'mercedes', 'Mercedes')],
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // B-21: Q2 usa canonical pace core
  it('B-21: Q2 usa canonical pace core', async () => {
    const participants = Array.from({ length: 24 }, (_, i) =>
      createNeutralDriver(`d_${i}`, 'mercedes', 'Mercedes'),
    )
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b21',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_b21',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // B-22: Q3 usa canonical pace core
  it('B-22: Q3 usa canonical pace core', async () => {
    const participants = Array.from({ length: 24 }, (_, i) =>
      createNeutralDriver(`d_${i}`, 'mercedes', 'Mercedes'),
    )
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b22',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_b22',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q3',
      careerId: 'career_b22',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // B-23: SQ1 usa canonical pace core
  it('B-23: SQ1 usa canonical pace core', async () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_b23',
      seasonId: dummySeason,
      round: dummyRound,
      participants: [createNeutralDriver('d1', 'mercedes', 'Mercedes')],
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // B-24: SQ2 usa canonical pace core
  it('B-24: SQ2 usa canonical pace core', async () => {
    const participants = Array.from({ length: 24 }, (_, i) =>
      createNeutralDriver(`ds_${i}`, 'mercedes', 'Mercedes'),
    )
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_b24',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: 'career_b24',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // B-25: SQ3 usa canonical pace core
  it('B-25: SQ3 usa canonical pace core', async () => {
    const participants = Array.from({ length: 24 }, (_, i) =>
      createNeutralDriver(`ds_${i}`, 'mercedes', 'Mercedes'),
    )
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_b25',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: 'career_b25',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ3',
      careerId: 'career_b25',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // B-26: setup aplicado exatamente UMA vez — fixture controlada: setupEfficiency 80 → modifier 0; acima/abaixo → exatamente o modifier canônico esperado; provar que qualifying_bonus_ms legado não duplica o efeito
  it('B-26: setup aplicado exatamente UMA vez (setupEfficiency 80 -> 0; 90 -> +0.50; sem bônus duplicado)', async () => {
    // 1. Prova do modificador canônico unitário no canonicalPaceIntegrationService
    const neutralSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv_setup_80',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(neutralSetup.breakdown.setupModifier).toBe(0.0)

    const highSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv_setup_90',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 90,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(highSetup.breakdown.setupModifier).toBeCloseTo(0.5, 3) // (90 - 80) * 0.05 = +0.5 pts

    const lowSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv_setup_70',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 70,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(lowSetup.breakdown.setupModifier).toBeCloseTo(-0.5, 3) // (70 - 80) * 0.05 = -0.5 pts

    // 2. Prova de que no orchestrator o qualifying_bonus_ms legado é 0 e não se duplica aos tempos
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b26_single_setup',
      seasonId: dummySeason,
      round: dummyRound,
      participants: [
        createNeutralDriver('drv_setup_test', 'mercedes', 'Mercedes', {
          setup: 90,
        }),
      ],
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const res = state.results[0]
    expect(res.bonusMs).toBe(0)
    expect(res.attempts[0].bonusMs).toBe(0)
  })

  // B-27: QExec aplicado exatamente UMA vez — não pode coexistir QExec canônico + effective_driver legado
  it('B-27: QExec aplicado exatamente UMA vez — sem coexistência com effective_driver legado', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv_qexec',
      circuitProfile: defaultCircuitProfile,
      driverAttributes: { speed: 85, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
    })
    const b = pace.breakdown
    expect(b.driverEventModifier).toBeDefined()

    // Soma exata dos modificadores canônicos comprova single-application
    const expectedPace = Number(
      (
        b.structuralStrength +
        b.trackFitModifier +
        b.setupModifier +
        b.driverEventModifier +
        b.tyreModifier +
        b.fuelModifier +
        b.wearModifier +
        b.weatherModifier +
        b.rngModifier
      ).toFixed(2),
    )
    expect(pace.effectivePaceScore).toBe(expectedPace)
    // Se estivesse duplicado:
    expect(pace.effectivePaceScore).not.toBe(
      Number((expectedPace + b.driverEventModifier).toFixed(2)),
    )
  })

  // B-28: TrackFit aplicado exatamente UMA vez — sem track bonus externo paralelo
  it('B-28: TrackFit normalizado aplicado exatamente UMA vez — sem track bonus externo paralelo', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv_tf',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    const b = pace.breakdown
    expect(b.trackFitModifier).toBeDefined()
    const expectedPace = Number(
      (
        b.structuralStrength +
        b.trackFitModifier +
        b.setupModifier +
        b.driverEventModifier +
        b.tyreModifier +
        b.fuelModifier +
        b.wearModifier +
        b.weatherModifier +
        b.rngModifier
      ).toFixed(2),
    )
    expect(pace.effectivePaceScore).toBe(expectedPace)
    expect(pace.effectivePaceScore).not.toBe(Number((expectedPace + b.trackFitModifier).toFixed(2)))
  })

  // B-29: bestTimeMs persistido deriva do lap time produzido pela tentativa canônica
  it('B-29: bestTimeMs persistido deriva do lap time produzido pela tentativa canônica', async () => {
    const participants = [createNeutralDriver('drv_time', 'mercedes', 'Mercedes')]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b29',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const res = state.results[0]
    expect(res.bestTimeMs).toBe(res.attempts[0].timeMs)
    expect(res.bestTimeMs).toBeGreaterThan(50000)
    expect(res.bestTimeMs).toBeLessThan(120000)
  })

  // B-30: sorting: menor bestTimeMs → melhor posição
  it('B-30: sorting: menor bestTimeMs → melhor posição (P1 vence P2)', async () => {
    const participants = [
      createNeutralDriver('drv_slow', 'williams', 'Williams'),
      createNeutralDriver('drv_fast', 'mercedes', 'Mercedes'),
    ]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b30',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(state.results[0].driverId).toBe('drv_fast')
    expect(state.results[0].position).toBe(1)
    expect(state.results[1].driverId).toBe('drv_slow')
    expect(state.results[1].position).toBe(2)
    expect(state.results[0].bestTimeMs).toBeLessThan(state.results[1].bestTimeMs)
  })

  // B-31: Q1→Q2 classificados corretos avançam, identidade driverId + canonicalTeamKey preservada
  it('B-31: Q1→Q2 classificados corretos avançam, identidade driverId + canonicalTeamKey preservada', async () => {
    const participants = Array.from({ length: 24 }, (_, i) =>
      createNeutralDriver(`d_${i + 1}`, i < 18 ? 'mercedes' : 'andretti', 'Team'),
    )
    const q1 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b31',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(q1.classifiedDriverIds.length).toBe(18)
    expect(q1.eliminatedDriverIds.length).toBe(6)

    const q2 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_b31',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(q2.totalParticipants).toBe(18)
    for (const res of q2.results) {
      expect(q1.classifiedDriverIds).toContain(res.driverId)
      expect(res.teamId).toBe('mercedes')
    }
  })

  // B-32: Q2→Q3 idem
  it('B-32: Q2→Q3 classificados corretos avançam, identidade driverId + canonicalTeamKey preservada', async () => {
    const participants = Array.from({ length: 24 }, (_, i) =>
      createNeutralDriver(`d_${i + 1}`, i < 10 ? 'mercedes' : 'andretti', 'Team'),
    )
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b32',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const q2 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_b32',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(q2.classifiedDriverIds.length).toBe(10)

    const q3 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q3',
      careerId: 'career_b32',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(q3.totalParticipants).toBe(10)
    for (const res of q3.results) {
      expect(q2.classifiedDriverIds).toContain(res.driverId)
      expect(res.teamId).toBe('mercedes')
    }
  })

  // B-33: SQ1→SQ2 idem
  it('B-33: SQ1→SQ2 classificados corretos avançam, identidade driverId + canonicalTeamKey preservada', async () => {
    const participants = Array.from({ length: 24 }, (_, i) =>
      createNeutralDriver(`ds_${i + 1}`, i < 18 ? 'mercedes' : 'andretti', 'Team'),
    )
    const sq1 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_b33',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(sq1.classifiedDriverIds.length).toBe(18)

    const sq2 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: 'career_b33',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(sq2.totalParticipants).toBe(18)
    for (const res of sq2.results) {
      expect(sq1.classifiedDriverIds).toContain(res.driverId)
      expect(res.teamId).toBe('mercedes')
    }
  })

  // B-34: SQ2→SQ3 idem
  it('B-34: SQ2→SQ3 classificados corretos avançam, identidade driverId + canonicalTeamKey preservada', async () => {
    const participants = Array.from({ length: 24 }, (_, i) =>
      createNeutralDriver(`ds_${i + 1}`, i < 10 ? 'mercedes' : 'andretti', 'Team'),
    )
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_b34',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const sq2 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: 'career_b34',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(sq2.classifiedDriverIds.length).toBe(10)

    const sq3 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ3',
      careerId: 'career_b34',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(sq3.totalParticipants).toBe(10)
    for (const res of sq3.results) {
      expect(sq2.classifiedDriverIds).toContain(res.driverId)
      expect(res.teamId).toBe('mercedes')
    }
  })

  // B-35: main qualifying persistence idempotente (reexecutar mesma fase/tentativa não duplica nem altera resultado indevidamente)
  it('B-35: main qualifying persistence idempotente (reexecutar não duplica nem altera resultado)', async () => {
    const participants = [createNeutralDriver('d1', 'mercedes', 'Mercedes')]
    const state1 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b35',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const state2 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b35',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(state1.results[0].bestTimeMs).toBe(state2.results[0].bestTimeMs)
    expect(state1.results[0].attempts[0].normalDrawZ).toBe(
      state2.results[0].attempts[0].normalDrawZ,
    )
    expect(state1.results.length).toBe(1)
    expect(state2.results.length).toBe(1)
  })

  // B-36: sprint qualifying persistence idempotente; SQ1/SQ2/SQ3 compatíveis com fluxo Sprint homologado
  it('B-36: sprint qualifying persistence idempotente; SQ1/SQ2/SQ3 compatíveis com fluxo Sprint homologado', async () => {
    const participants = [createNeutralDriver('ds1', 'mercedes', 'Mercedes')]
    const state1 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_b36',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const state2 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_b36',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(state1.results[0].bestTimeMs).toBe(state2.results[0].bestTimeMs)
    expect(state1.results[0].attempts[0].normalDrawZ).toBe(
      state2.results[0].attempts[0].normalDrawZ,
    )
    expect(state1.variant).toBe('SPRINT_QUALIFYING')
    expect(state2.variant).toBe('SPRINT_QUALIFYING')
  })

  // =========================================================================
  // FIXTURE NEUTRA OBRIGATÓRIA (TABELA E PROVA DAS 12 ÂNCORAS)
  // =========================================================================
  it('FIXTURE NEUTRA OBRIGATÓRIA: gera tabela TEAM / STRUCTURAL / FINAL NEUTRAL PACE / LAP TIME / DELTA TO MERCEDES / RANK', () => {
    const expectedAnchors: Record<string, number> = {
      mercedes: 100,
      ferrari: 98,
      mclaren: 96,
      red_bull: 94,
      racing_bulls: 87,
      alpine: 87,
      audi: 86,
      haas: 75,
      williams: 70,
      aston_martin: 60,
      cadillac: 50,
      andretti: 45,
    }

    const neutralResults: Array<{
      team: string
      structural: number
      finalNeutralPace: number
      lapTime: number
      deltaToMercedes: number
      rank: number
    }> = []

    const mercPace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'neutral_merc',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: 0,
    })

    for (const [team, expectedScore] of Object.entries(expectedAnchors)) {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: team,
        driverId: `neutral_${team}`,
        circuitProfile: defaultCircuitProfile,
        setupEfficiency: 80,
        driverAttributes: { speed: 80, rain: 80, morale: 80 },
        noise: 0,
      })

      expect(pace.breakdown.structuralStrength).toBe(expectedScore)
      expect(pace.breakdown.setupModifier).toBe(0)
      expect(pace.breakdown.rngModifier).toBe(0)
      expect(pace.effectivePaceScore).toBe(expectedScore)

      const deltaSec = pace.lapTimeSec - mercPace.lapTimeSec

      neutralResults.push({
        team,
        structural: pace.breakdown.structuralStrength,
        finalNeutralPace: pace.effectivePaceScore,
        lapTime: pace.lapTimeSec,
        deltaToMercedes: Number(deltaSec.toFixed(3)),
        rank: 0,
      })
    }

    // Ordenação estrita por menor lapTime (ou maior pace)
    neutralResults.sort((a, b) => a.lapTime - b.lapTime)
    neutralResults.forEach((r, idx) => {
      r.rank = idx + 1
    })

    // Imprime tabela formatada para logs e relatórios
    console.table(neutralResults)

    // Validações da hierarquia emergente pura
    expect(neutralResults[0].team).toBe('mercedes')
    expect(neutralResults[0].rank).toBe(1)
    expect(neutralResults[neutralResults.length - 1].team).toBe('andretti')
    expect(neutralResults[neutralResults.length - 1].rank).toBe(12)

    // Audi e Williams
    const audiRow = neutralResults.find((r) => r.team === 'audi')!
    const wmsRow = neutralResults.find((r) => r.team === 'williams')!
    expect(audiRow.structural).toBe(86)
    expect(wmsRow.structural).toBe(70)
    expect(Number((wmsRow.lapTime - audiRow.lapTime).toFixed(3))).toBeCloseTo(1.312, 3)
  })

  // =========================================================================
  // REAL DRIVER CHECK (8 PILOTOS REAIS)
  // =========================================================================
  it('REAL DRIVER CHECK: Carlos Sainz, Alex Albon, Nico Hülkenberg, Gabriel Bortoleto, Esteban Ocon, Oliver Bearman, Sergio Pérez, Valtteri Bottas', () => {
    const realDrivers = [
      { name: 'Carlos Sainz', id: 'driver_carlos_sainz', team: 'williams', speed: 86 },
      { name: 'Alex Albon', id: 'driver_alexander_albon', team: 'williams', speed: 83 },
      { name: 'Nico Hülkenberg', id: 'driver_nico_hulkenberg', team: 'audi', speed: 83 },
      { name: 'Gabriel Bortoleto', id: 'driver_gabriel_bortoleto', team: 'audi', speed: 83 },
      { name: 'Esteban Ocon', id: 'driver_esteban_ocon', team: 'haas', speed: 82 },
      { name: 'Oliver Bearman', id: 'driver_oliver_bearman', team: 'haas', speed: 81 },
      { name: 'Sergio Pérez', id: 'driver_sergio_perez', team: 'cadillac', speed: 79 },
      { name: 'Valtteri Bottas', id: 'driver_valtteri_bottas', team: 'cadillac', speed: 79 },
    ]

    const realReport: Array<{
      driver: string
      team: string
      structural: number
      qExec: number
      trackFit: number
      setup: number
      rng: number
      finalPace: number
      lap: number
    }> = []

    for (const d of realDrivers) {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: d.team,
        driverId: d.id,
        circuitProfile: defaultCircuitProfile,
        setupEfficiency: 80,
        driverAttributes: { speed: d.speed, morale: 80 },
        noise: 0,
      })

      const b = pace.breakdown
      realReport.push({
        driver: d.name,
        team: d.team,
        structural: b.structuralStrength,
        qExec: b.driverEventModifier,
        trackFit: b.trackFitModifier,
        setup: b.setupModifier,
        rng: b.rngModifier,
        finalPace: pace.effectivePaceScore,
        lap: pace.lapTimeSec,
      })

      // Validações estruturais obrigatórias
      if (d.team === 'williams') {
        expect(b.structuralStrength).toBe(70)
      } else if (d.team === 'audi') {
        expect(b.structuralStrength).toBe(86)
      } else if (d.team === 'haas') {
        expect(b.structuralStrength).toBe(75)
      } else if (d.team === 'cadillac') {
        expect(b.structuralStrength).toBe(50)
      }
    }

    console.table(realReport)

    // Sainz e Albon na Williams (70): provar que Sainz (speed 86) tem lapTime ligeiramente melhor que Albon (speed 83)
    const sainz = realReport.find((r) => r.driver === 'Carlos Sainz')!
    const albon = realReport.find((r) => r.driver === 'Alex Albon')!
    expect(sainz.structural).toBe(70)
    expect(albon.structural).toBe(70)
    expect(sainz.finalPace).toBeGreaterThan(albon.finalPace)
    expect(sainz.lap).toBeLessThan(albon.lap)

    // Audi (86): Hülkenberg (exp 250) vs Bortoleto (exp 24, speed 83)
    const hul = realReport.find((r) => r.driver === 'Nico Hülkenberg')!
    const bor = realReport.find((r) => r.driver === 'Gabriel Bortoleto')!
    expect(hul.structural).toBe(86)
    expect(bor.structural).toBe(86)
    expect(hul.qExec).toBeGreaterThan(bor.qExec) // maior experiência F1 produz qExec superior

    // Cadillac (50): Pérez e Bottas
    const perez = realReport.find((r) => r.driver === 'Sergio Pérez')!
    const bottas = realReport.find((r) => r.driver === 'Valtteri Bottas')!
    expect(perez.structural).toBe(50)
    expect(bottas.structural).toBe(50)
  })
})
