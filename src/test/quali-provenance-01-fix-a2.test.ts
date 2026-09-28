import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateQualifyingRatingDeltaMs,
  DEFAULT_SOURCE_RACE_PARAMETERS,
} from '@/lib/race/pureRaceEngine'
import {
  raceQualifyingOrchestratorService,
  QualifyingDriverInput,
} from '@/services/raceQualifyingOrchestratorService'

describe('QUALI-PROVENANCE-01-FIX-A2: Conectar MAIN e SPRINT ao Núcleo Min-Max', () => {
  const dummyCareer = 'car_test_qfix_a2'
  const dummySeason = 'season_2026'
  const dummyRound = 1

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // Gerador controlado de 24 pilotos com ratings variados
  function createControlledParticipants(): QualifyingDriverInput[] {
    const list: QualifyingDriverInput[] = []
    // 24 pilotos com ratings espaçados de 70 a 93 (ou definidos controladamente)
    for (let i = 1; i <= 24; i++) {
      list.push({
        driverId: `drv_${i}`,
        driverName: `Driver ${i}`,
        teamId: `team_${Math.ceil(i / 2)}`,
        teamName: `Team ${Math.ceil(i / 2)}`,
        carIndex: (i % 2 === 1 ? 1 : 2) as 1 | 2,
        carPerformance: 50 + i * 1.5, // 51.5 .. 86
        speed: 50 + i,
        qualifying: 50 + i,
        form: 50,
        morale: 50,
        wet_skill: 50,
        setup: 90,
      })
    }
    return list
  }

  // QFIX-A2-01 — MAIN USA NÚCLEO A1: Q1 usa calculateQualifyingRatingDeltaMs, não usa ×35.
  it('QFIX-A2-01 — MAIN USA NÚCLEO A1: Q1 usa calculateQualifyingRatingDeltaMs, não usa ×35', async () => {
    const participants: QualifyingDriverInput[] = [
      {
        driverId: 'drv_p1',
        driverName: 'P1 Driver',
        teamId: 't1',
        teamName: 'Team 1',
        carPerformance: 90,
        speed: 90,
        qualifying: 90,
        setup: 100,
      },
      {
        driverId: 'drv_p2',
        driverName: 'P2 Driver',
        teamId: 't2',
        teamName: 'Team 2',
        carPerformance: 70,
        speed: 70,
        qualifying: 70,
        setup: 100,
      },
    ]

    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const p1 = state.results.find((r) => r.driverId === 'drv_p1')!
    const p2 = state.results.find((r) => r.driverId === 'drv_p2')!

    const maxRating = Math.max(p1.trackRating, p2.trackRating)
    const minRating = Math.min(p1.trackRating, p2.trackRating)
    const spreadMs = DEFAULT_SOURCE_RACE_PARAMETERS.grid_target_spread_ms ?? 2500

    const expectedDeltaP1 = calculateQualifyingRatingDeltaMs({
      rating: p1.trackRating,
      minRating,
      maxRating,
      spreadMs,
    })
    const expectedDeltaP2 = calculateQualifyingRatingDeltaMs({
      rating: p2.trackRating,
      minRating,
      maxRating,
      spreadMs,
    })

    // Base de pista pura = 80000 ms (track_record_ms)
    // No seco, basePaceMs = trackBaseMs + ratingDeltaMs
    expect(p1.basePaceMs).toBe(80000 + expectedDeltaP1)
    expect(p2.basePaceMs).toBe(80000 + expectedDeltaP2)

    // Anti ×35 check: se usasse (100 - rating) * 35:
    const divergentP2 = 80000 + (100 - p2.trackRating) * 35
    expect(p2.basePaceMs).not.toBe(divergentP2)
  })

  // QFIX-A2-02 — SPRINT USA NÚCLEO A1: SQ1 usa calculateQualifyingRatingDeltaMs, não usa ×35.
  it('QFIX-A2-02 — SPRINT USA NÚCLEO A1: SQ1 usa calculateQualifyingRatingDeltaMs, não usa ×35', async () => {
    const participants: QualifyingDriverInput[] = [
      {
        driverId: 'drv_s1',
        driverName: 'Sprint 1',
        teamId: 't1',
        teamName: 'Team 1',
        carPerformance: 92,
        speed: 92,
        qualifying: 92,
        setup: 100,
      },
      {
        driverId: 'drv_s2',
        driverName: 'Sprint 2',
        teamId: 't2',
        teamName: 'Team 2',
        carPerformance: 68,
        speed: 68,
        qualifying: 68,
        setup: 100,
      },
    ]

    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const s1 = state.results.find((r) => r.driverId === 'drv_s1')!
    const s2 = state.results.find((r) => r.driverId === 'drv_s2')!

    const maxRating = Math.max(s1.trackRating, s2.trackRating)
    const minRating = Math.min(s1.trackRating, s2.trackRating)
    const spreadMs = DEFAULT_SOURCE_RACE_PARAMETERS.grid_target_spread_ms ?? 2500

    const expectedDeltaS1 = calculateQualifyingRatingDeltaMs({
      rating: s1.trackRating,
      minRating,
      maxRating,
      spreadMs,
    })
    const expectedDeltaS2 = calculateQualifyingRatingDeltaMs({
      rating: s2.trackRating,
      minRating,
      maxRating,
      spreadMs,
    })

    expect(s1.basePaceMs).toBe(80000 + expectedDeltaS1)
    expect(s2.basePaceMs).toBe(80000 + expectedDeltaS2)

    // SQ1 basePaceMs não usa ×35
    const divergentS2 = 80000 + (100 - s2.trackRating) * 35
    expect(s2.basePaceMs).not.toBe(divergentS2)
  })

  // QFIX-A2-03 — PIOR RATING MAIN: fixture controlada, pior participante recebe exatamente spreadMs no canal de rating (config atual: 2500 ms).
  it('QFIX-A2-03 — PIOR RATING MAIN: fixture controlada, pior participante recebe exatamente spreadMs (2500 ms)', async () => {
    const participants: QualifyingDriverInput[] = [
      {
        driverId: 'drv_best',
        driverName: 'Best',
        teamId: 't1',
        teamName: 'Team 1',
        carPerformance: 95,
        speed: 95,
        qualifying: 95,
      },
      {
        driverId: 'drv_worst',
        driverName: 'Worst',
        teamId: 't2',
        teamName: 'Team 2',
        carPerformance: 65,
        speed: 65,
        qualifying: 65,
      },
    ]

    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    const worst = state.results.find((r) => r.driverId === 'drv_worst')!
    const best = state.results.find((r) => r.driverId === 'drv_best')!

    const ratingDeltaWorst = worst.basePaceMs - 80000
    expect(ratingDeltaWorst).toBe(2500)
    expect(worst.basePaceMs - best.basePaceMs).toBe(2500)
  })

  // QFIX-A2-04 — MELHOR RATING MAIN: melhor participante = 0 ms no canal de rating.
  it('QFIX-A2-04 — MELHOR RATING MAIN: melhor participante = 0 ms no canal de rating', async () => {
    const participants: QualifyingDriverInput[] = [
      {
        driverId: 'drv_best',
        driverName: 'Best',
        teamId: 't1',
        teamName: 'Team 1',
        carPerformance: 95,
        speed: 95,
        qualifying: 95,
      },
      {
        driverId: 'drv_other',
        driverName: 'Other',
        teamId: 't2',
        teamName: 'Team 2',
        carPerformance: 75,
        speed: 75,
        qualifying: 75,
      },
    ]

    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    const best = state.results.find((r) => r.driverId === 'drv_best')!
    const ratingDeltaBest = best.basePaceMs - 80000
    expect(ratingDeltaBest).toBe(0)
    expect(best.basePaceMs).toBe(80000)
  })

  // QFIX-A2-05 — RATING INTERMEDIÁRIO MAIN: participante exatamente no meio = 1250 ms na config atual.
  it('QFIX-A2-05 — RATING INTERMEDIÁRIO MAIN: participante exatamente no meio = 1250 ms na config atual', async () => {
    // Carros e pilotos tais que o rating final seja simétrico: 90, 80, 70
    const participants: QualifyingDriverInput[] = [
      {
        driverId: 'drv_high',
        driverName: 'High',
        teamId: 't1',
        teamName: 'Team 1',
        carPerformance: 90,
        speed: 90,
        qualifying: 90,
      },
      {
        driverId: 'drv_mid',
        driverName: 'Mid',
        teamId: 't2',
        teamName: 'Team 2',
        carPerformance: 80,
        speed: 80,
        qualifying: 80,
      },
      {
        driverId: 'drv_low',
        driverName: 'Low',
        teamId: 't3',
        teamName: 'Team 3',
        carPerformance: 70,
        speed: 70,
        qualifying: 70,
      },
    ]

    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    const mid = state.results.find((r) => r.driverId === 'drv_mid')!
    const ratingDeltaMid = mid.basePaceMs - 80000
    expect(ratingDeltaMid).toBeCloseTo(1250, 4)
  })

  // QFIX-A2-06 — SPRINT EQUIVALENTE: mesmos ratings e mesmo spread → MAIN e SPRINT produzem o mesmo ratingDeltaMs antes dos canais específicos da Sprint.
  it('QFIX-A2-06 — SPRINT EQUIVALENTE: mesmos ratings e spread -> MAIN e SPRINT produzem mesmo ratingDeltaMs e basePaceMs', async () => {
    const participants: QualifyingDriverInput[] = [
      {
        driverId: 'drv_a',
        driverName: 'Driver A',
        teamId: 't1',
        teamName: 'Team 1',
        carPerformance: 88,
        speed: 88,
        qualifying: 88,
      },
      {
        driverId: 'drv_b',
        driverName: 'Driver B',
        teamId: 't2',
        teamName: 'Team 2',
        carPerformance: 72,
        speed: 72,
        qualifying: 72,
      },
    ]

    const mainState = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 82000,
      forceBypassPracticeCheck: true,
    })

    const sprintState = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 82000,
      forceBypassPracticeCheck: true,
    })

    const mainA = mainState.results.find((r) => r.driverId === 'drv_a')!
    const sprintA = sprintState.results.find((r) => r.driverId === 'drv_a')!

    const mainB = mainState.results.find((r) => r.driverId === 'drv_b')!
    const sprintB = sprintState.results.find((r) => r.driverId === 'drv_b')!

    expect(sprintA.basePaceMs).toBe(mainA.basePaceMs)
    expect(sprintB.basePaceMs).toBe(mainB.basePaceMs)
  })

  // QFIX-A2-07 — COMPOUND ISOLADO: com rating/base iguais, SQ1/SQ2 seco continuam exatamente +650 ms sobre a base comum; SQ3 = 0 ms.
  it('QFIX-A2-07 — COMPOUND ISOLADO: SQ1/SQ2 seco tem compoundDeltaMs = +650 ms; SQ3 = 0 ms', async () => {
    const participants = createControlledParticipants()

    const sq1State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const sq1Driver = sq1State.results[0]
    expect(sq1Driver.compoundUsed).toBe('MEDIUM')
    expect(sq1Driver.compoundDeltaMs).toBe(650)
    expect(sq1Driver.attempts[0].compoundDeltaMs).toBe(650)

    const sq2State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const sq2Driver = sq2State.results[0]
    expect(sq2Driver.compoundUsed).toBe('MEDIUM')
    expect(sq2Driver.compoundDeltaMs).toBe(650)
    expect(sq2Driver.attempts[0].compoundDeltaMs).toBe(650)

    const sq3State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ3',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const sq3Driver = sq3State.results[0]
    expect(sq3Driver.compoundUsed).toBe('SOFT')
    expect(sq3Driver.compoundDeltaMs).toBe(0)
    expect(sq3Driver.attempts[0].compoundDeltaMs).toBe(0)
  })

  // QFIX-A2-08 — ANTI ×35 PRODUÇÃO: fixture em que min-max × spread e (100-rating)×35 sejam claramente diferentes; assertar o valor da função efetivamente usado pelo serviço de produção. Não basta testar a função pura A1.
  it('QFIX-A2-08 — ANTI ×35 PRODUÇÃO: prova que o serviço de produção usa min-max e não ×35', async () => {
    const participants: QualifyingDriverInput[] = [
      {
        driverId: 'drv_top',
        driverName: 'Top',
        teamId: 't1',
        teamName: 'Team 1',
        carPerformance: 90,
        speed: 90,
        qualifying: 90,
      },
      {
        driverId: 'drv_bottom',
        driverName: 'Bottom',
        teamId: 't2',
        teamName: 'Team 2',
        carPerformance: 70,
        speed: 70,
        qualifying: 70,
      },
    ]

    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    const bottom = state.results.find((r) => r.driverId === 'drv_bottom')!
    // No modelo antigo ×35: delta = (100 - 70) * 35 = 1050 ms -> basePace = 81050 ms
    // No modelo canônico A1: rating delta = 2500 ms -> basePace = 82500 ms
    const canonicalBasePace = 80000 + 2500
    const divergentLegacyBasePace = 80000 + (100 - bottom.trackRating) * 35

    expect(bottom.basePaceMs).toBe(canonicalBasePace)
    expect(bottom.basePaceMs).not.toBe(divergentLegacyBasePace)
    expect(Math.abs(bottom.basePaceMs - divergentLegacyBasePace)).toBeGreaterThan(1000)
  })

  // QFIX-A2-09 — FASES Q2/Q3: também usam a função canônica, não apenas Q1.
  it('QFIX-A2-09 — FASES Q2/Q3: também usam a função canônica min-max', async () => {
    const participants = createControlledParticipants()

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    const q2State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q2',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    expect(q2State.results.length).toBe(18)
    const q2Ratings = q2State.results.map((r) => r.trackRating)
    const q2Max = Math.max(...q2Ratings)
    const q2Min = Math.min(...q2Ratings)
    const q2Spread = DEFAULT_SOURCE_RACE_PARAMETERS.grid_target_spread_ms ?? 2500

    q2State.results.forEach((r) => {
      const expectedDelta = calculateQualifyingRatingDeltaMs({
        rating: r.trackRating,
        minRating: q2Min,
        maxRating: q2Max,
        spreadMs: q2Spread,
      })
      expect(r.basePaceMs).toBe(80000 + expectedDelta)
    })

    const q3State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q3',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    expect(q3State.results.length).toBe(10)
    const q3Ratings = q3State.results.map((r) => r.trackRating)
    const q3Max = Math.max(...q3Ratings)
    const q3Min = Math.min(...q3Ratings)
    const q3Spread = DEFAULT_SOURCE_RACE_PARAMETERS.grid_target_spread_ms ?? 2500

    q3State.results.forEach((r) => {
      const expectedDelta = calculateQualifyingRatingDeltaMs({
        rating: r.trackRating,
        minRating: q3Min,
        maxRating: q3Max,
        spreadMs: q3Spread,
      })
      expect(r.basePaceMs).toBe(80000 + expectedDelta)
    })
  })

  // QFIX-A2-10 — FASES SQ2/SQ3: também usam o núcleo canônico.
  it('QFIX-A2-10 — FASES SQ2/SQ3: também usam o núcleo canônico min-max', async () => {
    const participants = createControlledParticipants()

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    const sq2State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    expect(sq2State.results.length).toBe(18)
    const sq2Ratings = sq2State.results.map((r) => r.trackRating)
    const sq2Max = Math.max(...sq2Ratings)
    const sq2Min = Math.min(...sq2Ratings)
    const sq2Spread = DEFAULT_SOURCE_RACE_PARAMETERS.grid_target_spread_ms ?? 2500

    sq2State.results.forEach((r) => {
      const expectedDelta = calculateQualifyingRatingDeltaMs({
        rating: r.trackRating,
        minRating: sq2Min,
        maxRating: sq2Max,
        spreadMs: sq2Spread,
      })
      expect(r.basePaceMs).toBe(80000 + expectedDelta)
    })

    const sq3State = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ3',
      careerId: dummyCareer,
      seasonId: dummySeason,
      round: dummyRound,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
    })

    expect(sq3State.results.length).toBe(10)
    const sq3Ratings = sq3State.results.map((r) => r.trackRating)
    const sq3Max = Math.max(...sq3Ratings)
    const sq3Min = Math.min(...sq3Ratings)
    const sq3Spread = DEFAULT_SOURCE_RACE_PARAMETERS.grid_target_spread_ms ?? 2500

    sq3State.results.forEach((r) => {
      const expectedDelta = calculateQualifyingRatingDeltaMs({
        rating: r.trackRating,
        minRating: sq3Min,
        maxRating: sq3Max,
        spreadMs: sq3Spread,
      })
      expect(r.basePaceMs).toBe(80000 + expectedDelta)
    })
  })
})
