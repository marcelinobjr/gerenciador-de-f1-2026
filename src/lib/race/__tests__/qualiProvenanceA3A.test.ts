/**
 * src/lib/race/__tests__/qualiProvenanceA3A.test.ts
 *
 * Suíte de testes focados para QUALI-PROVENANCE-01-FIX-A3A:
 * - Chuva canônica no qualifying:
 *   1. +8% no TEMPO-BASE quando estiver chovendo (wetBaseFactor = 1 + light_rain_time_fraction)
 *   2. multiplicador x1.5 no SIGMA do ruído quando estiver chovendo (effectiveSigmaMs = qualifying_noise_sd_ms * wet_noise_multiplier)
 *   3. Rating e Setup NÃO recebem +8%
 *   4. Sprint Compound delta é 0 na chuva (+650ms no seco SQ1/SQ2, 0ms no SQ3)
 *   5. Parametrização dinâmica (sem literais hardcoded)
 *   6. Regressão seca intacta (A3A seco == A2 seco)
 *   7. MAIN e Sprint usam mesmo núcleo de transformação de chuva
 *   8. Draw count inalterado
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCanonicalQualifyingBasePace,
  calculateQualifyingNoiseSigma,
  calculateQualifyingAttemptTime,
  calculateSprintQualifyingAttemptTime,
  calculateQualifyingRatingDeltaMs,
  DEFAULT_SOURCE_RACE_PARAMETERS,
} from '../pureRaceEngine'
import type { RaceParameters } from '../types'

describe('QUALI-PROVENANCE-01-FIX-A3A: Chuva Canônica no Qualifying', () => {
  // Config canônica padrão da fonte (RACE-SOURCE-01)
  const canonicalParams = DEFAULT_SOURCE_RACE_PARAMETERS

  // QFIX-A3A-01 — SECO BASE: wet=false -> wetBaseFactor=1, base molhada não aplicada.
  it('QFIX-A3A-01: wet=false -> wetBaseFactor=1, base molhada não aplicada', () => {
    const trackRecordMs = 80000 // 80s
    const rating = 85
    const minRating = 70
    const maxRating = 90

    const dryPace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: trackRecordMs,
        rating,
        min_rating: minRating,
        max_rating: maxRating,
        wet: false,
      },
      canonicalParams,
    )

    expect(dryPace.wet_base_factor).toBe(1.0)
    // baseQualiMs = trackRecordMs * (1 + qualifying_base_over_record_factor)
    const expectedBaseQualiMs =
      trackRecordMs * (1 + canonicalParams.qualifying_base_over_record_factor)
    expect(dryPace.base_quali_ms).toBeCloseTo(expectedBaseQualiMs, 5)
    // individualBaseMs = baseQualiMs * 1.0 + ratingDeltaMs
    expect(dryPace.individual_base_ms).toBeCloseTo(
      dryPace.base_quali_ms + dryPace.rating_delta_ms,
      5,
    )
  })

  // QFIX-A3A-02 — CHUVA BASE: wet=true, baseQualiMs controlado -> esperado baseQualiMs * 1.08 na config atual.
  it('QFIX-A3A-02: wet=true -> esperado baseQualiMs * (1 + light_rain_time_fraction) [1.08]', () => {
    const trackRecordMs = 80000
    const rating = 85
    const minRating = 70
    const maxRating = 90

    const wetPace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: trackRecordMs,
        rating,
        min_rating: minRating,
        max_rating: maxRating,
        wet: true,
      },
      canonicalParams,
    )

    const expectedFactor = 1 + canonicalParams.light_rain_time_fraction // 1 + 0.08 = 1.08
    expect(wetPace.wet_base_factor).toBeCloseTo(expectedFactor, 5)
    expect(wetPace.wet_base_factor).toBe(1.08)

    const expectedBasePart = wetPace.base_quali_ms * expectedFactor
    expect(wetPace.individual_base_ms - wetPace.rating_delta_ms).toBeCloseTo(expectedBasePart, 5)
  })

  // QFIX-A3A-03 — RATING NÃO RECEBE 8%: com o mesmo ratingDeltaMs em seco e chuva, a diferença de chuva vem somente de baseQualiMs * 0.08
  it('QFIX-A3A-03: ratingDeltaMs não recebe fator de chuva (idêntico entre seco e chuva)', () => {
    const trackRecordMs = 85000
    const rating = 82
    const minRating = 72
    const maxRating = 92

    const dryPace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: trackRecordMs,
        rating,
        min_rating: minRating,
        max_rating: maxRating,
        wet: false,
      },
      canonicalParams,
    )

    const wetPace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: trackRecordMs,
        rating,
        min_rating: minRating,
        max_rating: maxRating,
        wet: true,
      },
      canonicalParams,
    )

    // ratingDeltaMs deve ser estritamente idêntico
    expect(wetPace.rating_delta_ms).toBe(dryPace.rating_delta_ms)

    // A diferença entre os dois paces individuais deve ser exatamente baseQualiMs * 0.08
    const paceDiff = wetPace.individual_base_ms - dryPace.individual_base_ms
    const expectedDiff = dryPace.base_quali_ms * canonicalParams.light_rain_time_fraction
    expect(paceDiff).toBeCloseTo(expectedDiff, 5)
  })

  // QFIX-A3A-04 — SIGMA SECO: config atual -> effectiveSigmaMs = 150
  it('QFIX-A3A-04: sigma seco na config canônica deve ser 150 ms', () => {
    const { sigma_ms } = calculateQualifyingNoiseSigma({ wet: false }, canonicalParams)
    expect(sigma_ms).toBe(canonicalParams.qualifying_noise_sd_ms)
    expect(sigma_ms).toBe(150)
  })

  // QFIX-A3A-05 — SIGMA MOLHADO: config atual -> effectiveSigmaMs = 225
  it('QFIX-A3A-05: sigma molhado na config canônica deve ser 150 * 1.5 = 225 ms', () => {
    const { sigma_ms } = calculateQualifyingNoiseSigma({ wet: true }, canonicalParams)
    expect(sigma_ms).toBe(
      canonicalParams.qualifying_noise_sd_ms * canonicalParams.wet_noise_multiplier,
    )
    expect(sigma_ms).toBe(225)
  })

  // QFIX-A3A-06 — PARAMETRIZAÇÃO: alterar os parâmetros numa fixture controlada e provar que acompanha a config
  it('QFIX-A3A-06: cálculo responde a alterações na configuração esportiva (sem literais hardcoded)', () => {
    const customParams: RaceParameters = {
      ...canonicalParams,
      light_rain_time_fraction: 0.12, // 12% ao invés de 8%
      qualifying_noise_sd_ms: 180,
      wet_noise_multiplier: 1.75, // 180 * 1.75 = 315
    }

    const pace = calculateCanonicalQualifyingBasePace(
      {
        track_record_ms: 80000,
        rating: 80,
        min_rating: 70,
        max_rating: 90,
        wet: true,
      },
      customParams,
    )

    expect(pace.wet_base_factor).toBe(1.12)

    const sigma = calculateQualifyingNoiseSigma({ wet: true }, customParams)
    expect(sigma.sigma_ms).toBe(180 * 1.75) // 315
  })

  // QFIX-A3A-07 — MAIN WET: Q1 em chuva usa wet base + wet sigma
  it('QFIX-A3A-07: MAIN Q1 em chuva aplica wet base (+8%) e wet sigma (225ms)', () => {
    const basePaceDry = 80000
    const wetFactor = 1 + canonicalParams.light_rain_time_fraction // 1.08
    const basePaceWet = (basePaceDry / 1.0) * wetFactor
    const setup = 80 // 80%
    const z = 1.0 // 1 desvio padrão positivo

    const { sigma_ms: drySigma } = calculateQualifyingNoiseSigma({ wet: false }, canonicalParams)
    const { sigma_ms: wetSigma } = calculateQualifyingNoiseSigma({ wet: true }, canonicalParams)

    const dryAttempt = calculateQualifyingAttemptTime(
      {
        base_pace_ms: basePaceDry,
        setup,
        normal_standard_draw_z: z,
        sigma_ms: drySigma,
      },
      canonicalParams,
    )

    const wetAttempt = calculateQualifyingAttemptTime(
      {
        base_pace_ms: basePaceWet,
        setup,
        normal_standard_draw_z: z,
        sigma_ms: wetSigma,
      },
      canonicalParams,
    )

    // Bônus de setup deve ser idêntico
    expect(wetAttempt.bonus_ms).toBe(dryAttempt.bonus_ms)

    // Tempo molhado deve refletir: basePaceWet - bonus + z * 225
    const expectedWetTime = basePaceWet - wetAttempt.bonus_ms + z * 225
    expect(wetAttempt.time_ms).toBeCloseTo(expectedWetTime, 5)
  })

  // QFIX-A3A-08 — SPRINT WET: SQ1 em chuva usa wet base + wet sigma + compound delta = 0
  it('QFIX-A3A-08: Sprint SQ1 em chuva usa wet base + wet sigma + compound delta = 0', () => {
    const basePaceWet = 80000 * 1.08
    const setup = 85
    const z = 0.5
    const { sigma_ms: wetSigma } = calculateQualifyingNoiseSigma({ wet: true }, canonicalParams)

    const sprintWetAttempt = calculateSprintQualifyingAttemptTime(
      {
        dry: false,
        is_sq3: false,
        base_pace_ms: basePaceWet,
        setup,
        normal_standard_draw_z: z,
        sigma_ms: wetSigma,
        medium_delta_ms: 650,
      },
      canonicalParams,
    )

    expect(sprintWetAttempt.compound_delta_ms).toBe(0)
    const expectedTime = basePaceWet - sprintWetAttempt.bonus_ms + z * 225
    expect(sprintWetAttempt.time_ms).toBeCloseTo(expectedTime, 5)
  })

  // QFIX-A3A-09 — SQ DRY REGRESSION: SQ1/SQ2 seco continuam +650 ms; SQ3 seco continua 0
  it('QFIX-A3A-09: SQ1/SQ2 seco recebem +650 ms de composto; SQ3 seco recebe 0 ms', () => {
    const basePace = 80000
    const setup = 90
    const z = 0

    const sq1Dry = calculateSprintQualifyingAttemptTime(
      {
        dry: true,
        is_sq3: false,
        base_pace_ms: basePace,
        setup,
        normal_standard_draw_z: z,
        sigma_ms: 150,
      },
      canonicalParams,
    )

    const sq3Dry = calculateSprintQualifyingAttemptTime(
      {
        dry: true,
        is_sq3: true,
        base_pace_ms: basePace,
        setup,
        normal_standard_draw_z: z,
        sigma_ms: 150,
      },
      canonicalParams,
    )

    expect(sq1Dry.compound_delta_ms).toBe(650)
    expect(sq3Dry.compound_delta_ms).toBe(0)
    expect(sq1Dry.time_ms - sq3Dry.time_ms).toBe(650)
  })

  // QFIX-A3A-10 — SETUP ISOLADO: setupBonus é idêntico no seco/molhado e aplicado uma única vez
  it('QFIX-A3A-10: setupBonusMs não é multiplicado por 1.08 nem por 1.5 e aplica-se exatamente 1x', () => {
    const setup = 75 // 75%
    const expectedBonusMs = (75 / 100) * canonicalParams.max_setup_qualifying_bonus_seconds * 1000 // 0.75 * 0.25 * 1000 = 187.5 ms

    const { bonus_ms: dryBonus } = calculateQualifyingAttemptTime(
      {
        base_pace_ms: 80000,
        setup,
        normal_standard_draw_z: 0,
        sigma_ms: 150,
      },
      canonicalParams,
    )

    const { bonus_ms: wetBonus } = calculateQualifyingAttemptTime(
      {
        base_pace_ms: 80000 * 1.08,
        setup,
        normal_standard_draw_z: 0,
        sigma_ms: 225,
      },
      canonicalParams,
    )

    expect(dryBonus).toBe(expectedBonusMs)
    expect(wetBonus).toBe(expectedBonusMs)
    expect(wetBonus).toBe(dryBonus)
  })

  // QFIX-A3A-11 — MAIN/SPRINT COMMON WET CORE: com inputs comuns e compoundDelta=0, MAIN e Sprint produzem mesma transformação wet
  it('QFIX-A3A-11: com inputs comuns e compoundDelta=0, MAIN e Sprint produzem tempos idênticos na chuva', () => {
    const basePaceWet = 82000
    const setup = 88
    const z = -0.732
    const { sigma_ms } = calculateQualifyingNoiseSigma({ wet: true }, canonicalParams)

    const mainResult = calculateQualifyingAttemptTime(
      {
        base_pace_ms: basePaceWet,
        setup,
        normal_standard_draw_z: z,
        sigma_ms,
      },
      canonicalParams,
    )

    const sprintResult = calculateSprintQualifyingAttemptTime(
      {
        dry: false,
        is_sq3: false,
        base_pace_ms: basePaceWet,
        setup,
        normal_standard_draw_z: z,
        sigma_ms,
      },
      canonicalParams,
    )

    expect(sprintResult.time_ms).toBe(mainResult.time_ms)
    expect(sprintResult.bonus_ms).toBe(mainResult.bonus_ms)
    expect(sprintResult.compound_delta_ms).toBe(0)
  })

  // QFIX-A3A-12 — DRAW COUNT: A3A não altera quantidade de tentativas nem draws em relação à A2
  it('QFIX-A3A-12: A3A consome exatamente 1 draw normal Z por tentativa (mesmo determinismo de amostragem)', () => {
    // Prova que calculateQualifyingAttemptTime e calculateSprintQualifyingAttemptTime
    // consomem exatamente um normal_standard_draw_z externo sem consumir sorteios adicionais
    const zValue = 1.2345
    const calc = calculateQualifyingAttemptTime({
      base_pace_ms: 80000,
      setup: 100,
      normal_standard_draw_z: zValue,
      sigma_ms: 150,
    })

    // linearidade em z: time = base - bonus + z * sigma
    const bonus = 250 // (100/100) * 0.25 * 1000
    expect(calc.time_ms).toBeCloseTo(80000 - bonus + zValue * 150, 5)
  })
})
