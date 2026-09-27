/**
 * src/lib/race/types.ts
 *
 * Tipos canônicos para a configuração esportiva versionada e funções do simulador de corrida.
 * Baseado no pacote RACE-SOURCE-01 (v1.0.0).
 */

export interface RaceParameters {
  grid_target_spread_ms: number
  effective_driver_form_weight: number
  effective_driver_morale_weight: number
  effective_driver_wet_skill_weight: number
  legacy_race_noise_fraction: number
  qualifying_noise_sd_ms: number
  wet_noise_multiplier: number
  light_rain_time_fraction: number
  mechanical_failure_base_probability: number
  accident_base_probability: number
  wet_accident_multiplier: number
  legacy_sc_gap_multiplier: number
  race_base_over_record_factor: number
  qualifying_base_over_record_factor: number
  blue_flag_loss_seconds: number
  seconds_per_pace_point: number
  race_execution_weight: number
  lap_morale_weight: number
  physical_condition_weight: number
  noise_per_inconsistency_point: number
  tyre_age_linear_loss: number
  post_cliff_loss_per_lap: number
  fuel_max_kg: number
  fuel_reference_kg_per_lap: number
  fuel_seconds_per_kg: number
  start_fixed_loss: number
  start_loss_per_grid_position: number
  start_uniform_half_width: number
  pit_lane_green_loss: number
  pit_lane_sc_loss: number
  stationary_pit_min: number
  stationary_pit_max: number
  slow_pit_probability: number
  slow_pit_extra_min: number
  slow_pit_extra_max: number
  overtake_margin_multiplier: number
  blocked_gap_seconds: number
  sc_lap_time_multiplier: number
  sc_duration_min_laps: number
  sc_duration_max_laps: number
  sc_restart_gap_seconds: number
  heavy_rain_conditional_probability: number
  heavy_rain_time_fraction: number
  practice_lap_count_variation: number
  practice_best_lap_noise_sd_ms: number
  max_setup_qualifying_bonus_seconds: number
  max_setup_race_bonus_seconds_per_lap: number
  long_run_laps: number
  sprint_target_distance_km: number
  sprint_dry_compound: string
  sq1_sq2_dry_compound: string
}

export const MANDATORY_RACE_PARAM_KEYS: (keyof RaceParameters)[] = [
  'grid_target_spread_ms',
  'effective_driver_form_weight',
  'effective_driver_morale_weight',
  'effective_driver_wet_skill_weight',
  'legacy_race_noise_fraction',
  'qualifying_noise_sd_ms',
  'wet_noise_multiplier',
  'light_rain_time_fraction',
  'mechanical_failure_base_probability',
  'accident_base_probability',
  'wet_accident_multiplier',
  'legacy_sc_gap_multiplier',
  'race_base_over_record_factor',
  'qualifying_base_over_record_factor',
  'blue_flag_loss_seconds',
  'seconds_per_pace_point',
  'race_execution_weight',
  'lap_morale_weight',
  'physical_condition_weight',
  'noise_per_inconsistency_point',
  'tyre_age_linear_loss',
  'post_cliff_loss_per_lap',
  'fuel_max_kg',
  'fuel_reference_kg_per_lap',
  'fuel_seconds_per_kg',
  'start_fixed_loss',
  'start_loss_per_grid_position',
  'start_uniform_half_width',
  'pit_lane_green_loss',
  'pit_lane_sc_loss',
  'stationary_pit_min',
  'stationary_pit_max',
  'slow_pit_probability',
  'slow_pit_extra_min',
  'slow_pit_extra_max',
  'overtake_margin_multiplier',
  'blocked_gap_seconds',
  'sc_lap_time_multiplier',
  'sc_duration_min_laps',
  'sc_duration_max_laps',
  'sc_restart_gap_seconds',
  'heavy_rain_conditional_probability',
  'heavy_rain_time_fraction',
  'practice_lap_count_variation',
  'practice_best_lap_noise_sd_ms',
  'max_setup_qualifying_bonus_seconds',
  'max_setup_race_bonus_seconds_per_lap',
  'long_run_laps',
  'sprint_target_distance_km',
  'sprint_dry_compound',
  'sq1_sq2_dry_compound',
]

export interface VersionedRaceConfig {
  id: string
  version: string
  sha256: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  is_active: boolean
  work_item: string
  delivery_version: string
  source_declared_version: string
  source_sha256: string
  parameters: RaceParameters
  tables?: Record<string, unknown>
  catalogs?: Record<string, unknown>
  metadata?: Record<string, unknown>
  created: string
  updated: string
}
