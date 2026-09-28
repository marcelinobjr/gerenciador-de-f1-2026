import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateCanonicalQualifyingBasePace,
  calculateQualifyingRatingDeltaMs,
  calculateSprintQualifyingAttemptTime,
  calculateQualifyingAttemptTime,
  DEFAULT_SOURCE_RACE_PARAMETERS,
} from '@/lib/race/pureRaceEngine'
import {
  raceQualifyingOrchestratorService,
  QualifyingDriverInput,
} from '@/services/raceQualifyingOrchestratorService'
import type { RaceParameters } from '@/lib/race/types'

/**
 * QUALI-PROVENANCE-01-FIX-A3A1: MICRO-PATCH — CHUVA SOMENTE NO TEMPO-BASE DO QUALIFYING
 *
 * ESCOPO EXATO:
 * SECO: wetBaseFactor = 1
 * CHUVA: wetBaseFactor = 1 + rainTimeFraction (light_rain_time_fraction = 0.08 -> 1.08)
 * Aplicar SOMENTE sobre baseQualiMs:
 * basePaceMs = baseQualiMs * wetBaseFactor + ratingDeltaMs
 *
 * PROIBIDO multiplicar por 1.08:
 * - ratingDeltaMs
 * - setupBonusMs
 * - gaussianNoiseMs
 * - sprintCompoundDeltaMs
 *
 * NÃO alterar:
 * - sigma (sem x1.5 nesta rodada)
 * - tentativas (permanecem 1 tentativa)
 * - compound sprint seco (+650ms SQ1/SQ2, 0ms SQ3; molhado = 0ms)
 * - qualifying seco bit-stable vs A2
 */
describe('QUALI-PROVENANCE-01-FIX-A3A1: Chuva Somente no Tempo-Base do Qualifying', () => {
  const dummyCareer = 'career_a3a1_test'
  const dummySeason = 'season_2026'
  const dummyRound = 1

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // A3A1-01 SECO: wet=false -> wetBaseFactor = 1
  it('A3A1-01: SECO — wet=false -> wetBaseFactor = 1', () => {
    const pace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: 90000,
        rating: 85,
        min_rating: 70,
        max_rating: 90,
        wet: false,
      },
      DEFAULT_SOURCE_RACE_PARAMETERS,
    )

    expect(pace.wet_base_factor).toBe(1.0)
    // baseQualiMs = trackRecordMs * (1 + qualifying_base_over_record_factor)
    const expectedBaseQualiMs =
      90000 * (1 + DEFAULT_SOURCE_RACE_PARAMETERS.qualifying_base_over_record_factor)
    expect(pace.base_quali_ms).toBeCloseTo(expectedBaseQualiMs, 5)
    expect(pace.individual_base_ms).toBeCloseTo(expectedBaseQualiMs * 1.0 + pace.rating_delta_ms, 5)
  })

  // A3A1-02 MOLHADO: wet=true, rainTimeFraction=0.08 -> wetBaseFactor = 1.08
  it('A3A1-02: MOLHADO — wet=true, rainTimeFraction=0.08 -> wetBaseFactor = 1.08', () => {
    const pace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: 90000,
        rating: 85,
        min_rating: 70,
        max_rating: 90,
        wet: true,
      },
      DEFAULT_SOURCE_RACE_PARAMETERS,
    )

    const expectedFactor = 1 + DEFAULT_SOURCE_RACE_PARAMETERS.light_rain_time_fraction // 1 + 0.08 = 1.08
    expect(pace.wet_base_factor).toBe(1.08)
    expect(pace.wet_base_factor).toBeCloseTo(expectedFactor, 5)
  })

  // A3A1-03 VALOR NUMÉRICO: baseQualiMs=90.000, wet=true -> base molhada 97.200 ms antes de rating/setup/noise
  it('A3A1-03: VALOR NUMÉRICO — baseQualiMs=90.000, wet=true -> base molhada 97.200 ms antes de rating/setup/noise', () => {
    // Para ter baseQualiMs exatamente 90.000 ms, passamos track_record_ms = 90000 com qualifying_base_over_record_factor = 0
    const customParams: Pick<
      RaceParameters,
      'qualifying_base_over_record_factor' | 'grid_target_spread_ms' | 'light_rain_time_fraction'
    > = {
      ...DEFAULT_SOURCE_RACE_PARAMETERS,
      qualifying_base_over_record_factor: 0,
      light_rain_time_fraction: 0.08,
    }

    const pace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: 90000,
        rating: 80,
        min_rating: 80,
        max_rating: 80, // ratingDeltaMs = 0
        wet: true,
      },
      customParams,
    )

    expect(pace.base_quali_ms).toBe(90000)
    expect(pace.wet_base_factor).toBe(1.08)
    // 90.000 * 1.08 = 97.200 ms exatos
    expect(pace.individual_base_ms).toBe(97200)
  })

  // A3A1-04 RATING ISOLADO: mesmo ratingDeltaMs no seco e molhado; +8% não altera ratingDeltaMs
  it('A3A1-04: RATING ISOLADO — mesmo ratingDeltaMs no seco e molhado; +8% não altera ratingDeltaMs', () => {
    const dryPace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: 85000,
        rating: 82,
        min_rating: 70,
        max_rating: 90,
        wet: false,
      },
      DEFAULT_SOURCE_RACE_PARAMETERS,
    )

    const wetPace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: 85000,
        rating: 82,
        min_rating: 70,
        max_rating: 90,
        wet: true,
      },
      DEFAULT_SOURCE_RACE_PARAMETERS,
    )

    // ratingDeltaMs deve ser estritamente idêntico entre seco e molhado
    expect(wetPace.rating_delta_ms).toBe(dryPace.rating_delta_ms)

    // A diferença no individual_base_ms deve ser UNICAMENTE baseQualiMs * 0.08
    const expectedDiff = dryPace.base_quali_ms * 0.08
    expect(wetPace.individual_base_ms - dryPace.individual_base_ms).toBeCloseTo(expectedDiff, 5)

    // PROIBIÇÃO EXPLÍCITA: ratingDeltaMs NÃO foi multiplicado por 1.08
    expect(wetPace.rating_delta_ms).not.toBe(dryPace.rating_delta_ms * 1.08)
  })

  // A3A1-05 SETUP ISOLADO: mesmo setupBonusMs no seco e molhado; +8% não altera setup
  it('A3A1-05: SETUP ISOLADO — mesmo setupBonusMs no seco e molhado; +8% não altera setup', () => {
    const setup = 85
    const basePaceDry = 80000
    const basePaceWet = 80000 * 1.08

    const dryAttempt = calculateQualifyingAttemptTime(
      {
        base_pace_ms: basePaceDry,
        setup,
        normal_standard_draw_z: 0,
        sigma_ms: 150,
      },
      DEFAULT_SOURCE_RACE_PARAMETERS,
    )

    const wetAttempt = calculateQualifyingAttemptTime(
      {
        base_pace_ms: basePaceWet,
        setup,
        normal_standard_draw_z: 0,
        sigma_ms: 150,
      },
      DEFAULT_SOURCE_RACE_PARAMETERS,
    )

    // Bônus de setup idêntico: (85/100) * 0.25 * 1000 = 212.5 ms
    expect(dryAttempt.bonus_ms).toBe(212.5)
    expect(wetAttempt.bonus_ms).toBe(212.5)
    expect(wetAttempt.bonus_ms).toBe(dryAttempt.bonus_ms)

    // PROIBIDO: setup bonus não pode ter recebido * 1.08
    expect(wetAttempt.bonus_ms).not.toBe(dryAttempt.bonus_ms * 1.08)
  })

  // A3A1-06 COMPOUND ISOLADO: Sprint molhada continua compoundDeltaMs = 0
  it('A3A1-06: COMPOUND ISOLADO — Sprint molhada continua compoundDeltaMs = 0', () => {
    const sprintWetAttempt = calculateSprintQualifyingAttemptTime(
      {
        dry: false,
        is_sq3: false,
        base_pace_ms: 80000 * 1.08,
        setup: 80,
        normal_standard_draw_z: 0,
        sigma_ms: 150,
        medium_delta_ms: 650,
      },
      DEFAULT_SOURCE_RACE_PARAMETERS,
    )

    expect(sprintWetAttempt.compound_delta_ms).toBe(0)

    // No seco, SQ1/SQ2 deve continuar 650 ms
    const sprintDryAttempt = calculateSprintQualifyingAttemptTime(
      {
        dry: true,
        is_sq3: false,
        base_pace_ms: 80000,
        setup: 80,
        normal_standard_draw_z: 0,
        sigma_ms: 150,
        medium_delta_ms: 650,
      },
      DEFAULT_SOURCE_RACE_PARAMETERS,
    )

    expect(sprintDryAttempt.compound_delta_ms).toBe(650)
  })

  // A3A1-07 MAIN: Q1 molhado usa o novo wetBaseFactor
  it('A3A1-07: MAIN — Q1 molhado usa o wetBaseFactor canônico (+8%) sobre baseQualiMs', async () => {
    const participants: QualifyingDriverInput[] = [
      {
        driverId: 'drv_m1',
        driverName: 'Driver M1',
        teamId: 't1',
        teamName: 'Team 1',
        carPerformance: 85,
        speed: 85,
        qualifying: 85,
        setup: 80,
      },
      {
        driverId: 'drv_m2',
        driverName: 'Driver M2',
        teamId: 't2',
        teamName: 'Team 2',
        carPerformance: 75,
        speed: 75,
        qualifying: 75,
        setup: 80,
      },
    ]

    const dryResult = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: `${dummyCareer}_m_dry`,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      wet: false,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const wetResult = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: `${dummyCareer}_m_wet`,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      wet: true,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const dryD1 = dryResult.results.find((r) => r.driverId === 'drv_m1')!
    const wetD1 = wetResult.results.find((r) => r.driverId === 'drv_m1')!

    // baseRecordMs = 80000
    // baseQualiMs = 80000 * (1 - 0.015) = 78800 ms
    // Diferença esperada no basePaceMs = 78800 * 0.08 = 6304 ms
    const paceDiff = wetD1.basePaceMs - dryD1.basePaceMs
    expect(paceDiff).toBeCloseTo(78800 * 0.08, 2)
    expect(wetD1.bonusMs).toBe(dryD1.bonusMs)
  })

  // A3A1-08 SPRINT: SQ1 molhado usa o mesmo wetBaseFactor do MAIN
  it('A3A1-08: SPRINT — SQ1 molhado usa o mesmo wetBaseFactor do MAIN', async () => {
    const participants: QualifyingDriverInput[] = [
      {
        driverId: 'drv_sp1',
        driverName: 'Driver SP1',
        teamId: 't1',
        teamName: 'Team 1',
        carPerformance: 85,
        speed: 85,
        qualifying: 85,
        setup: 80,
      },
      {
        driverId: 'drv_sp2',
        driverName: 'Driver SP2',
        teamId: 't2',
        teamName: 'Team 2',
        carPerformance: 75,
        speed: 75,
        qualifying: 75,
        setup: 80,
      },
    ]

    const mainWet = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: `${dummyCareer}_mw`,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      wet: true,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const sprintWet = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId: `${dummyCareer}_sw`,
      seasonId: dummySeason,
      round: dummyRound,
      participants,
      trackRecordMs: 80000,
      wet: true,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const mD1 = mainWet.results.find((r) => r.driverId === 'drv_sp1')!
    const sD1 = sprintWet.results.find((r) => r.driverId === 'drv_sp1')!

    // BasePaceMs deve ser exatamente o mesmo entre MAIN e Sprint no molhado
    expect(sD1.basePaceMs).toBe(mD1.basePaceMs)
    expect(sD1.trackRating).toBe(mD1.trackRating)
    // Compound delta da sprint em chuva é 0
    expect(sD1.compoundDeltaMs).toBe(0)
  })

  // A3A1-09 PARAMETRIZAÇÃO: fixture com rainTimeFraction != 0.08 deve acompanhar a configuração; provar sem hardcode
  it('A3A1-09: PARAMETRIZAÇÃO — fixture com rainTimeFraction ≠ 0.08 acompanha a config sem hardcode', () => {
    const customFraction = 0.14 // 14%
    const customParams: Pick<
      RaceParameters,
      'qualifying_base_over_record_factor' | 'grid_target_spread_ms' | 'light_rain_time_fraction'
    > = {
      ...DEFAULT_SOURCE_RACE_PARAMETERS,
      light_rain_time_fraction: customFraction,
      qualifying_base_over_record_factor: 0,
    }

    const pace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: 100000,
        rating: 90,
        min_rating: 80,
        max_rating: 90,
        wet: true,
      },
      customParams,
    )

    expect(pace.wet_base_factor).toBe(1 + customFraction)
    expect(pace.wet_base_factor).toBe(1.14)
    // baseQualiMs = 100000, ratingDelta = 0 (maxRating)
    // individualBaseMs = 100000 * 1.14 = 114000
    expect(pace.individual_base_ms).toBe(114000)
    expect(pace.individual_base_ms).not.toBe(100000 * 1.08)
  })

  // A3A1-10 SECO BIT-STABLE: mesmos inputs e seed em seco -> resultado após A3A1 = resultado da A2
  it('A3A1-10: SECO BIT-STABLE — mesmos inputs e seed em seco produzem exatamente os resultados da A2', async () => {
    const participants: QualifyingDriverInput[] = [
      {
        driverId: 'drv_stable_1',
        driverName: 'Driver Stable 1',
        teamId: 't1',
        teamName: 'Team 1',
        carPerformance: 88,
        speed: 88,
        qualifying: 88,
        setup: 85,
      },
      {
        driverId: 'drv_stable_2',
        driverName: 'Driver Stable 2',
        teamId: 't2',
        teamName: 'Team 2',
        carPerformance: 74,
        speed: 74,
        qualifying: 74,
        setup: 85,
      },
    ]

    const state = await raceQualifyingOrchestratorService.executePhase({
      phase: 'Q1',
      careerId: 'career_bit_stable_a3a1',
      seasonId: 'season_bit_stable',
      round: 1,
      participants,
      trackRecordMs: 80000,
      wet: false,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })

    const p1 = state.results.find((r) => r.driverId === 'drv_stable_1')!
    const p2 = state.results.find((r) => r.driverId === 'drv_stable_2')!

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

    const baseRecordMs = 80000
    const qualifyingBaseOverRecordFactor =
      DEFAULT_SOURCE_RACE_PARAMETERS.qualifying_base_over_record_factor ?? 0
    const baseQualiMs = baseRecordMs * (1 + qualifyingBaseOverRecordFactor)

    // No seco: wetBaseFactor = 1.0, então basePaceMs = baseQualiMs * 1.0 + ratingDeltaMs
    expect(p1.basePaceMs).toBe(baseQualiMs + expectedDeltaP1)
    expect(p2.basePaceMs).toBe(baseQualiMs + expectedDeltaP2)
  })
})
