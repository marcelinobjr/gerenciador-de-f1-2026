/**
 * src/lib/race/pureRaceEngine.ts
 *
 * Implementação puramente funcional das regras e equações esportivas do pacote RACE-SOURCE-01.
 * Fórmulas derivadas estritamente da especificação (R03, R04, R05, R09, R11, R12, etc.)
 * e das células correspondentes da planilha de origem.
 */

import { RaceParameters } from './types'

/**
 * Parâmetros canônicos default da fonte (RACE-SOURCE-01 v1.0.0).
 */
export const DEFAULT_SOURCE_RACE_PARAMETERS: RaceParameters = {
  grid_target_spread_ms: 2500,
  effective_driver_form_weight: 0.1,
  effective_driver_morale_weight: 0.05,
  effective_driver_wet_skill_weight: 0.08,
  legacy_race_noise_fraction: 0.002,
  qualifying_noise_sd_ms: 150,
  wet_noise_multiplier: 1.5,
  light_rain_time_fraction: 0.08,
  mechanical_failure_base_probability: 0.03,
  accident_base_probability: 0.02,
  wet_accident_multiplier: 2,
  legacy_sc_gap_multiplier: 0.6,
  race_base_over_record_factor: 0.07,
  qualifying_base_over_record_factor: -0.015,
  blue_flag_loss_seconds: 0.6,
  seconds_per_pace_point: 0.08,
  race_execution_weight: 0.06,
  lap_morale_weight: 0.04,
  physical_condition_weight: 0.03,
  noise_per_inconsistency_point: 0.015,
  tyre_age_linear_loss: 0.045,
  post_cliff_loss_per_lap: 0.35,
  fuel_max_kg: 110,
  fuel_reference_kg_per_lap: 1.75,
  fuel_seconds_per_kg: 0.015,
  start_fixed_loss: 3.5,
  start_loss_per_grid_position: 0.12,
  start_uniform_half_width: 0.125,
  pit_lane_green_loss: 19.5,
  pit_lane_sc_loss: 8.5,
  stationary_pit_min: 2.2,
  stationary_pit_max: 3,
  slow_pit_probability: 0.04,
  slow_pit_extra_min: 2.5,
  slow_pit_extra_max: 5.5,
  overtake_margin_multiplier: 0.5,
  blocked_gap_seconds: 0.3,
  sc_lap_time_multiplier: 1.4,
  sc_duration_min_laps: 3,
  sc_duration_max_laps: 5,
  sc_restart_gap_seconds: 0.8,
  heavy_rain_conditional_probability: 0.4,
  heavy_rain_time_fraction: 0.15,
  practice_lap_count_variation: 0.15,
  practice_best_lap_noise_sd_ms: 250,
  max_setup_qualifying_bonus_seconds: 0.25,
  max_setup_race_bonus_seconds_per_lap: 0.15,
  long_run_laps: 10,
  sprint_target_distance_km: 100,
  sprint_dry_compound: 'Médio',
  sq1_sq2_dry_compound: 'Médio',
}

/**
 * R03 / RF01: Nota de classificação e Piloto Efetivo.
 * Fórmula:
 *   qualifying_note = (speed + qualifying) / 2
 *   effective_driver = qualifying_note
 *     * (1 + form_weight * (form - 50) / 50)
 *     * (1 + morale_weight * (morale - 50) / 50)
 *     * (wet ? (1 + wet_skill_weight * (wet_skill - 50) / 50) : 1)
 */
export function calculateEffectiveQualifyingDriver(
  inputs: {
    speed: number
    qualifying: number
    form: number
    morale: number
    wet_skill: number
    wet: boolean
  },
  params: Pick<
    RaceParameters,
    | 'effective_driver_form_weight'
    | 'effective_driver_morale_weight'
    | 'effective_driver_wet_skill_weight'
  > = DEFAULT_SOURCE_RACE_PARAMETERS,
): { qualifying_note: number; effective_driver: number } {
  const qualifying_note = (inputs.speed + inputs.qualifying) / 2
  const formFactor = 1 + params.effective_driver_form_weight * ((inputs.form - 50) / 50)
  const moraleFactor = 1 + params.effective_driver_morale_weight * ((inputs.morale - 50) / 50)
  const wetFactor = inputs.wet
    ? 1 + params.effective_driver_wet_skill_weight * ((inputs.wet_skill - 50) / 50)
    : 1

  const effective_driver = qualifying_note * formFactor * moraleFactor * wetFactor
  return { qualifying_note, effective_driver }
}

/**
 * R03 / RF02: Rating de Classificação ponderado com o circuito.
 * Fórmula:
 *   rating = (1 - driver_weight) * car + driver_weight * effective_driver
 */
export function calculateTrackQualifyingRating(inputs: {
  car: number
  effective_driver: number
  driver_weight: number
}): { rating: number } {
  const rating =
    (1 - inputs.driver_weight) * inputs.car + inputs.driver_weight * inputs.effective_driver
  return { rating }
}

/**
 * R09 / RF03: Pace de Execução de Corrida (Voltas!K13).
 * Fórmula:
 *   pace = car + (race_execution - 85) * race_execution_weight
 *              + (morale - 80) * lap_morale_weight
 *              + (physical_condition - 85) * physical_condition_weight
 */
export function calculateRaceExecutionPace(
  inputs: {
    car: number
    race_execution: number
    morale: number
    physical_condition: number
  },
  params: Pick<
    RaceParameters,
    'race_execution_weight' | 'lap_morale_weight' | 'physical_condition_weight'
  > = DEFAULT_SOURCE_RACE_PARAMETERS,
): { pace: number } {
  const pace =
    inputs.car +
    (inputs.race_execution - 85) * params.race_execution_weight +
    (inputs.morale - 80) * params.lap_morale_weight +
    (inputs.physical_condition - 85) * params.physical_condition_weight

  return { pace }
}

/**
 * R05 / RF04, RF05, RF06: Ganho de Acerto de Treino Livre (TL).
 * Fórmula:
 *   exposure = MIN(1, completed_laps / planned_laps)
 *   consistencyFactor = 0.5 + 0.5 * (consistency / 100)
 *   drawFactor = 0.7 + 0.3 * uniform_setup_draw
 *   gain = max_gain * exposure * consistencyFactor * drawFactor
 */
export function calculatePracticeSetupGain(inputs: {
  planned_laps: number
  completed_laps: number
  max_gain: number
  consistency: number
  uniform_setup_draw: number
}): { gain: number } {
  const exposure =
    inputs.planned_laps > 0 ? Math.min(1, inputs.completed_laps / inputs.planned_laps) : 0

  const consistencyFactor = 0.5 + 0.5 * (inputs.consistency / 100)
  const drawFactor = 0.7 + 0.3 * inputs.uniform_setup_draw
  const gain = inputs.max_gain * exposure * consistencyFactor * drawFactor

  return { gain }
}

/**
 * R05 / RF07, RF08, RF09: Acumulação de Acerto dos TLs e bônus para Quali e Corrida.
 * Limite de acerto: acerto = MIN(100, anterior + ganho)
 * Bônus de quali (ms): (acerto / 100) * max_setup_qualifying_bonus_seconds * 1000
 * Bônus de corrida (s/volta): (acerto / 100) * max_setup_race_bonus_seconds_per_lap
 */
export function calculateWeekendSetupProgression(
  inputs: {
    consistency: number
    completed_laps: number[] // [TL1, TL2, TL3]
    uniform_setup_draws: number[] // [draw1, draw2, draw3]
    planned_laps?: number[] // default: [24, 26, 18]
    max_gains?: number[] // default: [40, 40, 30]
  },
  params: Pick<
    RaceParameters,
    'max_setup_qualifying_bonus_seconds' | 'max_setup_race_bonus_seconds_per_lap'
  > = DEFAULT_SOURCE_RACE_PARAMETERS,
): {
  after_TL1: number
  after_TL2: number
  after_TL3: number
  final_setup: number
  qualifying_bonus_ms: number
  race_bonus_s: number
} {
  const planned = inputs.planned_laps || [24, 26, 18]
  const maxGains = inputs.max_gains || [40, 40, 30]

  let currentSetup = 0
  const sessionSetups: number[] = []

  for (let i = 0; i < 3; i++) {
    const plannedLaps = planned[i] || 0
    const completedLaps = inputs.completed_laps[i] || 0
    const maxGain = maxGains[i] || 0
    const draw = inputs.uniform_setup_draws[i] ?? 0.5

    if (completedLaps > 0 && plannedLaps > 0) {
      const { gain } = calculatePracticeSetupGain({
        planned_laps: plannedLaps,
        completed_laps: completedLaps,
        max_gain: maxGain,
        consistency: inputs.consistency,
        uniform_setup_draw: draw,
      })
      currentSetup = Math.min(100, currentSetup + gain)
    }
    sessionSetups.push(currentSetup)
  }

  const final_setup = currentSetup
  const qualifying_bonus_ms = (final_setup / 100) * params.max_setup_qualifying_bonus_seconds * 1000
  const race_bonus_s = (final_setup / 100) * params.max_setup_race_bonus_seconds_per_lap

  return {
    after_TL1: sessionSetups[0],
    after_TL2: sessionSetups[1],
    after_TL3: sessionSetups[2],
    final_setup,
    qualifying_bonus_ms,
    race_bonus_s,
  }
}

/**
 * RF09: Guarda simples de limite máximo de acerto (100).
 */
export function applySetupCap(inputs: { previous_setup: number; session_gain: number }): {
  new_setup: number
} {
  return { new_setup: Math.min(100, inputs.previous_setup + inputs.session_gain) }
}

/**
 * R04 / RF10: Tempo de tentativa de Classificação (Q1, Q2, Q3).
 * Fórmula:
 *   qualifying_bonus_ms = (setup / 100) * max_setup_qualifying_bonus_seconds * 1000
 *   time_ms = base_pace_ms - qualifying_bonus_ms + normal_standard_draw_z * sigma_ms
 */
/**
 * R04 / Classificação!L7: Ritmo base canônico de Qualificação.
 *
 * Fórmula:
 *   baseQualiSeconds = trackRecordSeconds * (1 + qualifyingBaseOverRecordFactor)
 *   baseQualiMs = baseQualiSeconds * 1000
 *   ratingDeltaMs = (maxRating - rating) / (maxRating - minRating) * qualifyingGridSpreadMs
 *   individualBaseMs = baseQualiMs * wetBaseFactor + ratingDeltaMs
 *
 * ADAPTAÇÃO DOCUMENTADA DE PRODUÇÃO:
 * Se maxRating == minRating (todos os participantes empatados no canal de performance),
 * ratingDeltaMs = 0 para evitar divisão por zero (0 / 0 = NaN) sem criar spread artificial.
 */
export function calculateCanonicalQualifyingBasePace(
  inputs: {
    track_record_seconds?: number
    track_record_ms?: number
    rating: number
    max_rating: number
    min_rating: number
    wet: boolean
  },
  params: Pick<
    RaceParameters,
    'qualifying_base_over_record_factor' | 'grid_target_spread_ms' | 'light_rain_time_fraction'
  > = DEFAULT_SOURCE_RACE_PARAMETERS,
): {
  base_quali_ms: number
  rating_delta_ms: number
  individual_base_ms: number
  wet_base_factor: number
} {
  // Obtenção consistente do tempo base a partir de segundos ou ms
  const recordSeconds =
    inputs.track_record_seconds ??
    (inputs.track_record_ms !== undefined ? inputs.track_record_ms / 1000 : 80)

  const factor = params.qualifying_base_over_record_factor ?? 0
  const base_quali_seconds = recordSeconds * (1 + factor)
  const base_quali_ms = base_quali_seconds * 1000

  // Canal de performance relativo (min-max)
  let rating_delta_ms = 0
  const ratingRange = inputs.max_rating - inputs.min_rating
  if (ratingRange > 1e-9) {
    const spreadMs = params.grid_target_spread_ms ?? 2500
    rating_delta_ms = ((inputs.max_rating - inputs.rating) / ratingRange) * spreadMs
  } else {
    // ADAPTAÇÃO DOCUMENTADA DE PRODUÇÃO: caso limite maxRating == minRating
    rating_delta_ms = 0
  }

  // Fator climático na base de tempo
  const wet_base_factor = inputs.wet ? 1 + (params.light_rain_time_fraction ?? 0.08) : 1
  const individual_base_ms = base_quali_ms * wet_base_factor + rating_delta_ms

  return {
    base_quali_ms,
    rating_delta_ms,
    individual_base_ms,
    wet_base_factor,
  }
}

/**
 * R04 / Classificação!H3: Desvio padrão efetivo (sigma) de qualificação.
 * Seco: sigma = qualifying_noise_sd_ms (default: 150 ms)
 * Molhado: sigma = qualifying_noise_sd_ms * wet_noise_multiplier (default: 150 * 1.5 = 225 ms)
 */
export function calculateQualifyingNoiseSigma(
  inputs: {
    wet: boolean
  },
  params: Pick<
    RaceParameters,
    'qualifying_noise_sd_ms' | 'wet_noise_multiplier'
  > = DEFAULT_SOURCE_RACE_PARAMETERS,
): { sigma_ms: number } {
  const baseSigma = params.qualifying_noise_sd_ms ?? 150
  const multiplier = inputs.wet ? (params.wet_noise_multiplier ?? 1.5) : 1
  return { sigma_ms: baseSigma * multiplier }
}

export function calculateQualifyingAttemptTime(
  inputs: {
    base_pace_ms: number
    setup: number
    normal_standard_draw_z: number
    sigma_ms?: number
  },
  params: Pick<
    RaceParameters,
    'max_setup_qualifying_bonus_seconds' | 'qualifying_noise_sd_ms'
  > = DEFAULT_SOURCE_RACE_PARAMETERS,
): { time_ms: number; bonus_ms: number } {
  const sigma = inputs.sigma_ms ?? params.qualifying_noise_sd_ms
  const bonus_ms = (inputs.setup / 100) * params.max_setup_qualifying_bonus_seconds * 1000
  const time_ms = inputs.base_pace_ms - bonus_ms + inputs.normal_standard_draw_z * sigma
  return { time_ms, bonus_ms }
}

/**
 * R04 / RF11, RF12: Tentativa de Classificação Sprint (SQ1, SQ2, SQ3).
 * No seco: SQ1 e SQ2 usam pneu Médio (+0.65s = +650ms em relação ao Macio base).
 * SQ3 usa pneu Macio (+0ms). No molhado: delta = 0ms.
 */
export function calculateSprintQualifyingAttemptTime(
  inputs: {
    dry: boolean
    is_sq3?: boolean
    base_pace_ms: number
    setup: number
    normal_standard_draw_z: number
    sigma_ms?: number
    medium_delta_ms?: number
  },
  params: Pick<
    RaceParameters,
    'max_setup_qualifying_bonus_seconds' | 'qualifying_noise_sd_ms'
  > = DEFAULT_SOURCE_RACE_PARAMETERS,
): { time_ms: number; compound_delta_ms: number; bonus_ms: number } {
  const sigma = inputs.sigma_ms ?? params.qualifying_noise_sd_ms
  const bonus_ms = (inputs.setup / 100) * params.max_setup_qualifying_bonus_seconds * 1000
  const defaultMediumDelta = inputs.medium_delta_ms ?? 650

  const compound_delta_ms = inputs.dry ? (inputs.is_sq3 ? 0 : defaultMediumDelta) : 0

  const time_ms =
    inputs.base_pace_ms - bonus_ms + inputs.normal_standard_draw_z * sigma + compound_delta_ms

  return { time_ms, compound_delta_ms, bonus_ms }
}

/**
 * R09 / RF21, RF22: Desvio padrão por volta do piloto (Voltas!M13).
 * Fórmula:
 *   sigma_s = (100 - consistency) * noise_per_inconsistency_point * (wet ? wet_noise_multiplier : 1)
 */
export function calculateLapSigma(
  inputs: {
    consistency: number
    wet: boolean
  },
  params: Pick<
    RaceParameters,
    'noise_per_inconsistency_point' | 'wet_noise_multiplier'
  > = DEFAULT_SOURCE_RACE_PARAMETERS,
): { sigma_s: number } {
  const baseSigma = (100 - inputs.consistency) * params.noise_per_inconsistency_point
  const sigma_s = inputs.wet ? baseSigma * params.wet_noise_multiplier : baseSigma
  return { sigma_s }
}

/**
 * RF28: Tempos base conforme condição climática (Voltas!C9, Voltas!F6).
 * Fórmulas:
 *   dry_s = base_race_s
 *   light_rain_s = base_race_s * (1 + light_rain_time_fraction)
 *   heavy_rain_s = base_race_s * (1 + heavy_rain_time_fraction)
 *   SC_source_s = base_race_s * sc_lap_time_multiplier
 */
export function calculateWeatherBaseTimes(
  inputs: {
    base_race_s: number
  },
  params: Pick<
    RaceParameters,
    'light_rain_time_fraction' | 'heavy_rain_time_fraction' | 'sc_lap_time_multiplier'
  > = DEFAULT_SOURCE_RACE_PARAMETERS,
): {
  dry_s: number
  light_rain_s: number
  heavy_rain_s: number
  SC_source_s: number
} {
  const dry_s = inputs.base_race_s
  const light_rain_s = inputs.base_race_s * (1 + params.light_rain_time_fraction)
  const heavy_rain_s = inputs.base_race_s * (1 + params.heavy_rain_time_fraction)
  const SC_source_s = inputs.base_race_s * params.sc_lap_time_multiplier

  return { dry_s, light_rain_s, heavy_rain_s, SC_source_s }
}
