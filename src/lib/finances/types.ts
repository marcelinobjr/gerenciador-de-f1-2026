/**
 * Definições de Tipos para a Configuração Econômica Versionada (FIN-SOURCE-01A / FIN-EVO-03).
 */

export interface FinancialEconomicRules {
  participation_annual_fixed: number
  participation_per_gp: number
  participation_per_sprint: number
  gp_win_prize: number
  sprint_win_prize: number
  constructors_minimum_prize: number
  constructors_position_amplitude: number
  constructors_champion_bonus: number
  sponsor_position_coefficient: number
  initial_reserve_over_c0: number
  initial_cash_over_c0: number
  sponsor_wins_coefficient: number
  preparation_test_event: number
  localized_development_multiplier: number
  broad_development_multiplier: number
  win_curve_calendar_divisor: number
  weekend_fixed_operation: number
  logistics_regional: number
  logistics_standard: number
  logistics_long_distance: number
  logistics_complex: number
  sprint_incremental_operation: number
  logistics_savings_default: number
  logistics_savings_max: number
  staff_win_bonus_share: number
  construction_contract_share: number
  construction_execution_share: number
  construction_delivery_share: number
  no_gp_wins_surplus_warning_fraction: number
  stress_fixed_sponsor_change: number
  stress_staff_change: number
  months_per_year: number
  reconciliation_tolerance: number
  monetary_scale_to_usd: number
}

export interface FinancialEconomicCatalogs {
  reference_team: string
  reference_c0: number
  initial_cash: number
  initial_debt: number
  initial_reserve: number
}

export interface FinancialEconomicMetadata {
  work_item: string
  source_declared_version: string
  delivery_version: string
  source_sha256: string
  parameters_file_sha256?: string
  status: string
  config_state: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  original_FIN_EVO_03_JSON_recovered: boolean
  relegation_rule_status?: string
  auto_select_in_careers?: boolean
  [key: string]: unknown
}

export interface VersionedEconomicConfig {
  id?: string
  version: string
  sha256: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  is_active: boolean
  work_item: string
  delivery_version: string
  source_declared_version: string
  source_sha256: string
  parameters: FinancialEconomicRules
  catalogs?: FinancialEconomicCatalogs
  metadata?: FinancialEconomicMetadata
  created?: string
  updated?: string
}

export const MANDATORY_RULE_KEYS: (keyof FinancialEconomicRules)[] = [
  'participation_annual_fixed',
  'participation_per_gp',
  'participation_per_sprint',
  'gp_win_prize',
  'sprint_win_prize',
  'constructors_minimum_prize',
  'constructors_position_amplitude',
  'constructors_champion_bonus',
  'sponsor_position_coefficient',
  'initial_reserve_over_c0',
  'initial_cash_over_c0',
  'sponsor_wins_coefficient',
  'preparation_test_event',
  'localized_development_multiplier',
  'broad_development_multiplier',
  'win_curve_calendar_divisor',
  'weekend_fixed_operation',
  'logistics_regional',
  'logistics_standard',
  'logistics_long_distance',
  'logistics_complex',
  'sprint_incremental_operation',
  'logistics_savings_default',
  'logistics_savings_max',
  'staff_win_bonus_share',
  'construction_contract_share',
  'construction_execution_share',
  'construction_delivery_share',
  'no_gp_wins_surplus_warning_fraction',
  'stress_fixed_sponsor_change',
  'stress_staff_change',
  'months_per_year',
  'reconciliation_tolerance',
  'monetary_scale_to_usd',
]
