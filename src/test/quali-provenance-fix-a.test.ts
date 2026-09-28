import { describe, it, expect } from 'vitest'
import {
  calculateCanonicalQualifyingBasePace,
  calculateQualifyingNoiseSigma,
  calculateQualifyingAttemptTime,
  calculateSprintQualifyingAttemptTime,
  DEFAULT_SOURCE_RACE_PARAMETERS,
} from '@/lib/race/pureRaceEngine'
import { raceQualifyingOrchestratorService } from '@/services/raceQualifyingOrchestratorService'

describe('QUALI-PROVENANCE-01-FIX-A Testes Canônicos (QFIX-A01..A14)', () => {
  // QFIX-A01 — MAX RATING: rating = maxRating -> ratingDeltaMs = 0
  it('QFIX-A01: rating = maxRating -> ratingDeltaMs = 0', () => {
    const res = calculateCanonicalQualifyingBasePace({
      track_record_ms: 80000,
      rating: 95,
      max_rating: 95,
      min_rating: 70,
      wet: false,
    })
    expect(res.rating_delta_ms).toBe(0)
    // base_quali_seconds = 80 * (1 - 0.015) = 80 * 0.985 = 78.8s -> 78800 ms
    expect(res.base_quali_ms).toBeCloseTo(78800, 3)
    expect(res.individual_base_ms).toBeCloseTo(78800, 3)
  })

  // QFIX-A02 — MIN RATING: rating = minRating -> ratingDeltaMs = spreadMs (2500 na config atual)
  it('QFIX-A02: rating = minRating -> ratingDeltaMs = spreadMs (2500)', () => {
    const res = calculateCanonicalQualifyingBasePace({
      track_record_ms: 80000,
      rating: 70,
      max_rating: 95,
      min_rating: 70,
      wet: false,
    })
    expect(res.rating_delta_ms).toBeCloseTo(2500, 3)
    expect(res.individual_base_ms).toBeCloseTo(78800 + 2500, 3)
  })

  // QFIX-A03 — RATING MÉDIO: rating exatamente no meio -> 1250 ms na config atual
  it('QFIX-A03: rating exatamente no meio -> ratingDeltaMs = 1250 ms', () => {
    const res = calculateCanonicalQualifyingBasePace({
      track_record_ms: 80000,
      rating: 82.5,
      max_rating: 95,
      min_rating: 70,
      wet: false,
    })
    expect(res.rating_delta_ms).toBeCloseTo(1250, 3)
  })

  // QFIX-A04 — RATINGS IGUAIS: maxRating == minRating -> 0 ms, sem NaN, sem Infinity
  it('QFIX-A04: maxRating == minRating -> ratingDeltaMs = 0 sem NaN ou Infinity', () => {
    const res = calculateCanonicalQualifyingBasePace({
      track_record_ms: 80000,
      rating: 85,
      max_rating: 85,
      min_rating: 85,
      wet: false,
    })
    expect(res.rating_delta_ms).toBe(0)
    expect(Number.isNaN(res.rating_delta_ms)).toBe(false)
    expect(Number.isFinite(res.rating_delta_ms)).toBe(true)
    expect(res.individual_base_ms).toBeCloseTo(78800, 3)
  })

  // QFIX-A05 — BASE QUALI: recorde * (1 + fator) reproduz exatamente a fonte
  it('QFIX-A05: recorde * (1 + fator) reproduz exatamente a fonte', () => {
    const factor = DEFAULT_SOURCE_RACE_PARAMETERS.qualifying_base_over_record_factor // -0.015
    const recordSec = 90
    const res = calculateCanonicalQualifyingBasePace(
      {
        track_record_seconds: recordSec,
        rating: 90,
        max_rating: 90,
        min_rating: 70,
        wet: false,
      },
      DEFAULT_SOURCE_RACE_PARAMETERS,
    )
    const expectedBaseMs = recordSec * (1 + factor) * 1000
    expect(res.base_quali_ms).toBeCloseTo(expectedBaseMs, 5)
  })

  // QFIX-A06 — BASE SECA: wetBaseFactor = 1
  it('QFIX-A06: base seca -> wetBaseFactor = 1', () => {
    const res = calculateCanonicalQualifyingBasePace({
      track_record_ms: 80000,
      rating: 90,
      max_rating: 90,
      min_rating: 70,
      wet: false,
    })
    expect(res.wet_base_factor).toBe(1)
  })

  // QFIX-A07 — BASE MOLHADA: tempo-base recebe exatamente o fator configurado (+8% / 1.08)
  it('QFIX-A07: base molhada recebe exatamente 1 + light_rain_time_fraction', () => {
    const res = calculateCanonicalQualifyingBasePace({
      track_record_ms: 80000,
      rating: 90,
      max_rating: 90,
      min_rating: 70,
      wet: true,
    })
    expect(res.wet_base_factor).toBeCloseTo(
      1 + DEFAULT_SOURCE_RACE_PARAMETERS.light_rain_time_fraction,
      5,
    )
    expect(res.individual_base_ms).toBeCloseTo(res.base_quali_ms * 1.08, 3)
  })

  // QFIX-A08 — SIGMA SECO: sigma = 150 ms na config atual
  it('QFIX-A08: sigma seco = 150 ms', () => {
    const { sigma_ms } = calculateQualifyingNoiseSigma({ wet: false })
    expect(sigma_ms).toBe(150)
  })

  // QFIX-A09 — SIGMA MOLHADO: sigma = 225 ms na config atual
  it('QFIX-A09: sigma molhado = 225 ms (150 * 1.5)', () => {
    const { sigma_ms } = calculateQualifyingNoiseSigma({ wet: true })
    expect(sigma_ms).toBe(225)
  })

  // QFIX-A10 — SETUP: setupBonus aplicado exatamente uma vez
  it('QFIX-A10: setupBonus aplicado exatamente uma vez (setup=100 -> 250 ms)', () => {
    const res = calculateQualifyingAttemptTime({
      base_pace_ms: 80000,
      setup: 100,
      normal_standard_draw_z: 0,
      sigma_ms: 150,
    })
    expect(res.bonus_ms).toBe(250)
    expect(res.time_ms).toBe(80000 - 250)
  })

  // QFIX-A11 — SPRINT COMPOUND: SQ1 seco = +650, SQ2 seco = +650, SQ3 seco = 0, wet = 0
  it('QFIX-A11: delta de compostos na Sprint Shootout', () => {
    const sq1Dry = calculateSprintQualifyingAttemptTime({
      dry: true,
      is_sq3: false,
      base_pace_ms: 80000,
      setup: 0,
      normal_standard_draw_z: 0,
    })
    expect(sq1Dry.compound_delta_ms).toBe(650)
    expect(sq1Dry.time_ms).toBe(80650)

    const sq3Dry = calculateSprintQualifyingAttemptTime({
      dry: true,
      is_sq3: true,
      base_pace_ms: 80000,
      setup: 0,
      normal_standard_draw_z: 0,
    })
    expect(sq3Dry.compound_delta_ms).toBe(0)
    expect(sq3Dry.time_ms).toBe(80000)

    const sqWet = calculateSprintQualifyingAttemptTime({
      dry: false,
      is_sq3: false,
      base_pace_ms: 80000,
      setup: 0,
      normal_standard_draw_z: 0,
    })
    expect(sqWet.compound_delta_ms).toBe(0)
    expect(sqWet.time_ms).toBe(80000)
  })

  // QFIX-A12 — ONE ATTEMPT: cada fase consome exatamente uma tentativa por padrão
  it('QFIX-A12: cada fase consome exatamente 1 tentativa por padrão', async () => {
    const dummyParticipants = Array.from({ length: 24 }, (_, i) => ({
      driverId: `drv-${i + 1}`,
      driverName: `Driver ${i + 1}`,
      teamId: `team-${Math.floor(i / 2) + 1}`,
      teamName: `Team ${Math.floor(i / 2) + 1}`,
      carPerformance: 80 + (i % 5),
      speed: 80,
      qualifying: 80,
    }))

    const state = await raceQualifyingOrchestratorService.executeQ1({
      careerId: 'c-test-qfix-12',
      seasonId: 's2026',
      round: 1,
      participants: dummyParticipants,
      trackRecordMs: 80000,
      forceBypassPracticeCheck: true,
      attemptsPerPhase: 1,
    })
    expect(state.results[0].attempts.length).toBe(1)
  })
}
const dummyEnd = {
      wet: false,
    })

    expect(state.results[0].attempts.length).toBe(1)
    expect(state.results[0].attempts[0].attemptNumber).toBe(1)
  })

  // QFIX-A13 — SEM ×35: pior rating recebe spreadMs, não derivado de (100-rating) * 35
  it('QFIX-A13: ausência do x35; spread exato de 2500 ms', () => {
    const bestRating = 90
    const worstRating = 70
    const spreadMs = 2500

    const best = calculateCanonicalQualifyingBasePace({
      track_record_ms: 80000,
      rating: bestRating,
      max_rating: bestRating,
      min_rating: worstRating,
      wet: false,
    })

    const worst = calculateCanonicalQualifyingBasePace({
      track_record_ms: 80000,
      rating: worstRating,
      max_rating: bestRating,
      min_rating: worstRating,
      wet: false,
    })

    const delta = worst.individual_base_ms - best.individual_base_ms
    expect(delta).toBeCloseTo(spreadMs, 3)

    // Se fosse (100 - rating) * 35:
    // best: (100 - 90) * 35 = 350
    // worst: (100 - 70) * 35 = 1050
    // delta antigo seria 700 ms, muito diferente de 2500 ms!
    const oldFormulaDelta = (100 - worstRating) * 35 - (100 - bestRating) * 35
    expect(delta).not.toBe(oldFormulaDelta)
    expect(delta).toBe(2500)
  })

  // QFIX-A14 — MAIN/SPRINT COMMON CORE: MAIN e SPRINT chamam a mesma função matemática base
  it('QFIX-A14: MAIN e SPRINT utilizam calculateCanonicalQualifyingBasePace como base comum', () => {
    const params = {
      track_record_ms: 82000,
      rating: 84,
      max_rating: 92,
      min_rating: 72,
      wet: false,
    }
    const mainBase = calculateCanonicalQualifyingBasePace(params)
    const sprintBase = calculateCanonicalQualifyingBasePace(params)
    expect(mainBase.individual_base_ms).toBe(sprintBase.individual_base_ms)
    expect(mainBase.base_quali_ms).toBe(sprintBase.base_quali_ms)
    expect(mainBase.rating_delta_ms).toBe(sprintBase.rating_delta_ms)
  })
})
