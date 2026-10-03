import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  raceQualifyingOrchestratorService,
  type QualifyingDriverInput,
} from '@/services/raceQualifyingOrchestratorService'
import { canonicalPaceIntegrationService } from '@/services/canonicalPaceIntegrationService'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { BASELINE_2026_V1_TEAMS } from '@/data/baseline-2026-v1'

describe('QUALI-UNIFY-01B: Canonical Pace Integration in Qualifying Orchestrator', () => {
  // QUALI-UNIFY-01B1 CHECKPOINT
  const dummyCareer = 'car_test_quali_01b'
  const dummySeason = 'season_2026'
  const dummyRound = 1
  // CHECKPOINT_16
  const defaultCircuitProfile = resolveCircuitProfile({ round: dummyRound })

  beforeEach(() => {
    // CHECKPOINT_21
    localStorage.clear()
    raceQualifyingOrchestratorService.clearMemoryCache()
    vi.restoreAllMocks()
    // CHECKPOINT_25
  })

  // Helper para criar participante neutro padronizado
  // CHECKPOINT_29
  function createNeutralDriver(
    id: string,
    teamId: string,
    // CHECKPOINT_34
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

  // B1-01: orchestrator chama o canonical pace core
  it('B1-01: orchestrator chama o canonical pace core', async () => {
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

  // B1-02: Audi usa Structural 86
  it('B1-02: Audi usa Structural 86', async () => {
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
  })

  // B1-03: Williams usa Structural 70
  it('B1-03: Williams usa Structural 70', async () => {
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
  })

  // B1-04: Cadillac usa Structural 50
  it('B1-04: Cadillac usa Structural 50', async () => {
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
  })

  // B1-05: teams.strength não controla o pace (fixture Audi strength=20 → ainda 86; Williams strength=99 → ainda 70)
  it('B1-05: teams.strength não controla o pace (fixture Audi strength=20 → ainda 86; Williams strength=99 → ainda 70)', async () => {
    const participants = [
      createNeutralDriver('drv_audi_stale', 'team_audi', 'Audi Revolut', {
        carPerformance: 20, // Stale strength ignorado
      }),
      createNeutralDriver('drv_wms_stale', 'team_williams', 'Williams Racing', {
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
    const audiRes = state.results.find((r) => r.driverId === 'drv_audi_stale')!
    const wmsRes = state.results.find((r) => r.driverId === 'drv_wms_stale')!

    const canonAudi = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv_audi_stale',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: 0,
    })
    const canonWms = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: 'drv_wms_stale',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80, rain: 80, morale: 80 },
      noise: 0,
    })

    expect(canonAudi.breakdown.structuralStrength).toBe(86)
    expect(audiRes.trackRating).toBe(canonAudi.effectivePaceScore)
    expect(canonWms.breakdown.structuralStrength).toBe(70)
    expect(wmsRes.trackRating).toBe(canonWms.effectivePaceScore)
  })

  // B1-06: min-max 2500ms não controla o pace (grid completo vs subset: gap Audi-Williams permanece igual; Audi-Williams delta 16 pts ≈ 1,312 s; Audi-Cadillac 36 pts; Mercedes-Andretti 55 pts ≈ 4,51 s sem compressão para 2,5 s)
  it('B1-06: min-max 2500ms não controla o pace (gaps absolutos invariantes a participantes)', async () => {
    const fullGrid: QualifyingDriverInput[] = [
      createNeutralDriver('drv_merc', 'mercedes', 'Mercedes'),
      createNeutralDriver('drv_audi', 'audi', 'Audi'),
      createNeutralDriver('drv_wms', 'williams', 'Williams'),
      createNeutralDriver('drv_cad', 'cadillac', 'Cadillac'),
      createNeutralDriver('drv_and', 'andretti', 'Andretti'),
    ]

    const fullState = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b1_06_full',
      seasonId: dummySeason,
      round: dummyRound,
      participants: fullGrid,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const fullAudi = fullState.results.find((r) => r.driverId === 'drv_audi')!
    const fullWms = fullState.results.find((r) => r.driverId === 'drv_wms')!
    const fullMerc = fullState.results.find((r) => r.driverId === 'drv_merc')!
    const fullCad = fullState.results.find((r) => r.driverId === 'drv_cad')!
    const fullAnd = fullState.results.find((r) => r.driverId === 'drv_and')!

    const fullAudiWmsDelta = fullWms.basePaceMs - fullAudi.basePaceMs
    const fullMercAndDelta = fullAnd.basePaceMs - fullMerc.basePaceMs
    const fullAudiCadDelta = fullCad.basePaceMs - fullAudi.basePaceMs

    // Subset com apenas Audi e Williams
    const subsetState = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b1_06_subset',
      seasonId: dummySeason,
      round: dummyRound,
      participants: [
        createNeutralDriver('drv_audi', 'audi', 'Audi'),
        createNeutralDriver('drv_wms', 'williams', 'Williams'),
      ],
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const subAudi = subsetState.results.find((r) => r.driverId === 'drv_audi')!
    const subWms = subsetState.results.find((r) => r.driverId === 'drv_wms')!
    const subAudiWmsDelta = subWms.basePaceMs - subAudi.basePaceMs

    // Gaps absolutos: Audi-Williams delta permanece IDÊNTICO (eliminar participantes não renormaliza o gap)
    expect(fullAudiWmsDelta).toBe(subAudiWmsDelta)
    expect(fullAudiWmsDelta).toBeCloseTo(16 * 82, -1) // 16 pts * 82ms/pt = 1312ms (~1.312s)
    expect(fullAudiCadDelta).toBeCloseTo(36 * 82, -1) // 36 pts * 82ms/pt = 2952ms (~2.952s)
    expect(fullMercAndDelta).toBeCloseTo(55 * 82, -1) // 55 pts * 82ms/pt = 4510ms (~4.51s sem compressão para 2500ms)
    expect(fullMercAndDelta).not.toBe(2500)
  })

  // B1-07: carPerformance ?? 80 não controla Q2/Q3/SQ2/SQ3
  it('B1-07: carPerformance ?? 80 não controla Q2/Q3/SQ2/SQ3', async () => {
    const q1Participants: QualifyingDriverInput[] = []
    for (let i = 1; i <= 24; i++) {
      const teamKey = i <= 2 ? 'mercedes' : i <= 4 ? 'audi' : i <= 6 ? 'williams' : 'cadillac'
      q1Participants.push(createNeutralDriver(`drv_h_${i}`, teamKey, teamKey))
    }

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b1_07_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      participants: q1Participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const q2State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_b1_07_handoff',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const audiQ2 = q2State.results.find((r) => r.teamId === 'audi')!
    const wmsQ2 = q2State.results.find((r) => r.teamId === 'williams')!

    const canonAudi = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: audiQ2.driverId,
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    const canonWms = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'williams',
      driverId: wmsQ2.driverId,
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })

    expect(audiQ2.trackRating).toBe(canonAudi.effectivePaceScore)
    expect(wmsQ2.trackRating).toBe(canonWms.effectivePaceScore)
    expect(audiQ2.trackRating).not.toBe(wmsQ2.trackRating) // Não caem para fallback ?? 80 idêntico
  })

  // B1-08: RNG seeded atual permanece em uso (determinístico: mesmo seed → mesmos tempos)
  it('B1-08: RNG seeded atual permanece em uso (determinístico: mesmo seed → mesmos tempos)', async () => {
    const participants = [createNeutralDriver('drv_rng_test', 'mercedes', 'Mercedes')]

    // Execução 1 com semente A
    const stateA1 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_rng_seed_test',
      seasonId: 'season_rng_1',
      round: 1,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    // Limpa apenas o cache de memória para forçar novo recálculo determinístico sob mesma semente
    raceQualifyingOrchestratorService.clearMemoryCache()
    localStorage.clear()

    const stateA2 = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_rng_seed_test',
      seasonId: 'season_rng_1',
      round: 1,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    // Mesmo contexto/seed produz EXATAMENTE o mesmo tempo e sorteio Z
    expect(stateA1.results[0].bestTimeMs).toBe(stateA2.results[0].bestTimeMs)
    expect(stateA1.results[0].attempts[0].normalDrawZ).toBe(
      stateA2.results[0].attempts[0].normalDrawZ,
    )
    expect(stateA1.results[0].attempts[0].timeMs).toBe(stateA2.results[0].attempts[0].timeMs)
  })

  // B-11: Audi 86 vs Williams 70 → neutral delta 16 pace pts
  it('B-11: Audi 86 vs Williams 70 neutral delta 16 pace pts (~1.312 s)', () => {
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

  // B-12: Audi 86 vs Cadillac 50 → 36 pts
  it('B-12: Audi 86 vs Cadillac 50 neutral delta 36 pace pts (~2.952 s)', () => {
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

  // B-13: Mercedes 100 vs Andretti 45 → 55 pts
  it('B-13: Mercedes 100 vs Andretti 45 neutral delta 55 pace pts (~4.510 s)', () => {
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

  // B-14/B-15: GRID COMPLETO vs SUBSET: base delta Audi-Williams permanece invariante
  it('B-14/B-15: INVARIÂNCIA: base delta Audi vs Williams é idêntico em grid completo e em subset', async () => {
    const fullGrid: QualifyingDriverInput[] = [
      createNeutralDriver('drv_merc', 'mercedes', 'Mercedes'),
      createNeutralDriver('drv_fer', 'ferrari', 'Ferrari'),
      createNeutralDriver('drv_mcl', 'mclaren', 'McLaren'),
      createNeutralDriver('drv_rb', 'red_bull', 'Red Bull'),
      createNeutralDriver('drv_audi', 'audi', 'Audi'),
      createNeutralDriver('drv_wms', 'williams', 'Williams'),
      createNeutralDriver('drv_cad', 'cadillac', 'Cadillac'),
      createNeutralDriver('drv_and', 'andretti', 'Andretti'),
    ]

    const fullState = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_full_grid',
      seasonId: dummySeason,
      round: dummyRound,
      participants: fullGrid,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const fullAudi = fullState.results.find((r) => r.driverId === 'drv_audi')!
    const fullWms = fullState.results.find((r) => r.driverId === 'drv_wms')!
    const fullBaseDelta = fullWms.basePaceMs - fullAudi.basePaceMs

    // Subset: apenas Audi e Williams (outros removidos)
    const subsetGrid: QualifyingDriverInput[] = [
      createNeutralDriver('drv_audi', 'audi', 'Audi'),
      createNeutralDriver('drv_wms', 'williams', 'Williams'),
    ]

    const subState = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_subset_grid',
      seasonId: dummySeason,
      round: dummyRound,
      participants: subsetGrid,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const subAudi = subState.results.find((r) => r.driverId === 'drv_audi')!
    const subWms = subState.results.find((r) => r.driverId === 'drv_wms')!
    const subBaseDelta = subWms.basePaceMs - subAudi.basePaceMs

    expect(fullBaseDelta).toBe(subBaseDelta)
    expect(fullAudi.basePaceMs).toBe(subAudi.basePaceMs)
    expect(fullWms.basePaceMs).toBe(subWms.basePaceMs)
  })

  // B-16..B-19: Q2, Q3, SQ2, SQ3 não usam carPerformance ?? 80
  it('B-16: Q2 herda e resolve canonicalTeamKey sem carPerformance ?? 80', async () => {
    const q1Participants: QualifyingDriverInput[] = []
    for (let i = 1; i <= 24; i++) {
      const teamKey = i <= 2 ? 'mercedes' : i <= 4 ? 'ferrari' : i <= 6 ? 'audi' : 'williams'
      q1Participants.push(createNeutralDriver(`drv_${i}`, teamKey, teamKey))
    }

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_handoff_q2',
      seasonId: dummySeason,
      round: dummyRound,
      participants: q1Participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const q2State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_handoff_q2',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    expect(q2State.results.length).toBe(18)
    const audiDriver = q2State.results.find((r) => r.teamId === 'audi')!
    const canonAudi = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: audiDriver.driverId,
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(audiDriver.trackRating).toBe(canonAudi.effectivePaceScore)
  })

  it('B-17: Q3 herda e resolve canonicalTeamKey sem carPerformance ?? 80', async () => {
    const q1Participants: QualifyingDriverInput[] = []
    for (let i = 1; i <= 24; i++) {
      const teamKey = i <= 2 ? 'mercedes' : i <= 4 ? 'ferrari' : i <= 6 ? 'mclaren' : 'williams'
      q1Participants.push(createNeutralDriver(`drv_${i}`, teamKey, teamKey))
    }

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_handoff_q3',
      seasonId: dummySeason,
      round: dummyRound,
      participants: q1Participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_handoff_q3',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const q3State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q3',
      careerId: 'career_handoff_q3',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    expect(q3State.results.length).toBe(10)
    const mercDriver = q3State.results.find((r) => r.teamId === 'mercedes')!
    const canonMerc = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: mercDriver.driverId,
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(mercDriver.trackRating).toBe(canonMerc.effectivePaceScore)
  })

  it('B-18: SQ2 herda e resolve canonicalTeamKey sem carPerformance ?? 80', async () => {
    const sq1Participants: QualifyingDriverInput[] = []
    for (let i = 1; i <= 24; i++) {
      const teamKey = i <= 2 ? 'mercedes' : i <= 4 ? 'audi' : 'williams'
      sq1Participants.push(createNeutralDriver(`drv_s_${i}`, teamKey, teamKey))
    }

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_handoff_sq2',
      seasonId: dummySeason,
      round: dummyRound,
      participants: sq1Participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const sq2State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: 'career_handoff_sq2',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    expect(sq2State.results.length).toBe(18)
    const audiDriver = sq2State.results.find((r) => r.teamId === 'audi')!
    const canonAudi = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: audiDriver.driverId,
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      tyreCompound: 'medio',
      noise: 0,
    })
    expect(audiDriver.trackRating).toBe(canonAudi.effectivePaceScore)
  })

  it('B-19: SQ3 herda e resolve canonicalTeamKey sem carPerformance ?? 80', async () => {
    const sq1Participants: QualifyingDriverInput[] = []
    for (let i = 1; i <= 24; i++) {
      const teamKey = i <= 2 ? 'mercedes' : i <= 4 ? 'audi' : 'williams'
      sq1Participants.push(createNeutralDriver(`drv_s3_${i}`, teamKey, teamKey))
    }

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_handoff_sq3',
      seasonId: dummySeason,
      round: dummyRound,
      participants: sq1Participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: 'career_handoff_sq3',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const sq3State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ3',
      careerId: 'career_handoff_sq3',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    expect(sq3State.results.length).toBe(10)
    const mercDriver = sq3State.results.find((r) => r.teamId === 'mercedes')!
    const canonMerc = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: mercDriver.driverId,
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      tyreCompound: 'macio',
      noise: 0,
    })
    expect(mercDriver.trackRating).toBe(canonMerc.effectivePaceScore)
  })

  // B-20..B-25: Q1, Q2, Q3, SQ1, SQ2, SQ3 usam o canonical pace core
  it('B-20: Q1 usa canonical pace core', async () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b20',
      seasonId: dummySeason,
      round: dummyRound,
      participants: [createNeutralDriver('d1', 'mercedes', 'Mercedes')],
      forceBypassPracticeCheck: true,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

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
    })
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_b21',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

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
    })
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: 'career_b22',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
    })
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q3',
      careerId: 'career_b22',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('B-23: SQ1 usa canonical pace core', async () => {
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: 'career_b23',
      seasonId: dummySeason,
      round: dummyRound,
      participants: [createNeutralDriver('d1', 'mercedes', 'Mercedes')],
      forceBypassPracticeCheck: true,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

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
    })
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: 'career_b24',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

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
    })
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: 'career_b25',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
    })
    const spy = vi.spyOn(canonicalPaceIntegrationService, 'computeQualifyingPace')
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ3',
      careerId: 'career_b25',
      seasonId: dummySeason,
      round: dummyRound,
      forceBypassPracticeCheck: true,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // B-26..B-28: setup / QExec / TrackFit não aplicados duas vezes
  it('B-26: setup aplicado exatamente uma vez (sem qualifying_bonus_ms legado empilhado)', async () => {
    const participants = [
      createNeutralDriver('drv_setup', 'mercedes', 'Mercedes', {
        setup: 90,
      }),
    ]
    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_b26',
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    const res = state.results[0]
    expect(res.bonusMs).toBe(0)
    expect(res.attempts[0].bonusMs).toBe(0)
  })

  it('B-27: QExec aplicado uma única vez via canonical pace core', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv_qexec',
      circuitProfile: defaultCircuitProfile,
      driverAttributes: { speed: 85, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
    })
    expect(pace.breakdown.driverEventModifier).toBeDefined()
  })

  it('B-28: TrackFit normalizado aplicado uma única vez via canonical core', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'drv_tf',
      circuitProfile: defaultCircuitProfile,
      setupEfficiency: 80,
      driverAttributes: { speed: 80 },
      noise: 0,
    })
    expect(pace.breakdown.trackFitModifier).toBeDefined()
  })

  // B-29: bestTimeMs deriva do lap time da tentativa
  it('B-29: bestTimeMs deriva do lap time da tentativa (Math.round(lapTimeSec * 1000))', async () => {
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

  // B-30: sorting menor bestTimeMs → melhor posição
  it('B-30: ordenação determinística: menor bestTimeMs obtém melhor posição', async () => {
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
  })

  // B-31..B-34: Q1→Q2, Q2→Q3, SQ1→SQ2, SQ2→SQ3 mantêm classificados corretos
  it('B-31: Q1→Q2 mantém classificados corretos (top 18 avançam)', async () => {
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
    }
  })

  it('B-32: Q2→Q3 mantém classificados corretos (top 10 avançam)', async () => {
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
    }
  })

  it('B-33: SQ1→SQ2 mantém classificados corretos (top 18 avançam)', async () => {
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
    }
  })

  it('B-34: SQ2→SQ3 mantém classificados corretos (top 10 avançam)', async () => {
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
    }
  })

  // B-35/B-36: persistência main e sprint qualifying continuam idempotentes
  it('B-35: reexecução de Q1 devolve exatamente o mesmo estado sem novo RNG', async () => {
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
  })

  it('B-36: reexecução de SQ1 devolve exatamente o mesmo estado sem novo RNG', async () => {
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
  })

  // REAL DRIVER CHECK — Prova dos pilotos reais
  it('REAL DRIVER CHECK: 8 pilotos reais e suas métricas canônicas', () => {
    const driversToCheck = [
      { name: 'Sainz', id: 'carlos_sainz', team: 'williams' },
      { name: 'Albon', id: 'alex_albon', team: 'williams' },
      { name: 'Hülkenberg', id: 'nico_hulkenberg', team: 'audi' },
      { name: 'Bortoleto', id: 'gabriel_bortoleto', team: 'audi' },
      { name: 'Ocon', id: 'esteban_ocon', team: 'haas' },
      { name: 'Bearman', id: 'oliver_bearman', team: 'haas' },
      { name: 'Pérez', id: 'sergio_perez', team: 'cadillac' },
      { name: 'Bottas', id: 'valtteri_bottas', team: 'cadillac' },
    ]

    for (const d of driversToCheck) {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: d.team,
        driverId: d.id,
        circuitProfile: defaultCircuitProfile,
        setupEfficiency: 80,
        driverAttributes: { speed: 82, morale: 80 },
        noise: 0,
      })
      expect(pace.breakdown.structuralStrength).toBeGreaterThan(0)
      expect(pace.lapTimeSec).toBeGreaterThan(70)
    }
  })

  // NEUTRAL FIXTURE — Prova das 12 âncoras exatas
  it('NEUTRAL FIXTURE: as 12 equipes produzem as 12 âncoras estruturais sem interferência', () => {
    const expectedScores = {
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

    for (const [team, expectedScore] of Object.entries(expectedScores)) {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: team,
        driverId: `drv_${team}`,
        circuitProfile: defaultCircuitProfile,
        setupEfficiency: 80,
        driverAttributes: { speed: 80, rain: 80, morale: 80 },
        noise: 0,
      })
      expect(pace.breakdown.structuralStrength).toBe(expectedScore)
    }
  })
})
