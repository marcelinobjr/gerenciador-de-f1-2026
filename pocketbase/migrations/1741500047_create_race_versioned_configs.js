migrate(
  (app) => {
    const collection = new Collection({
      name: 'race_versioned_configs',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'version', type: 'text', required: true },
        { name: 'sha256', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
          maxSelect: 1,
        },
        { name: 'is_active', type: 'bool' },
        { name: 'work_item', type: 'text' },
        { name: 'delivery_version', type: 'text' },
        { name: 'source_declared_version', type: 'text' },
        { name: 'source_sha256', type: 'text' },
        { name: 'parameters', type: 'json' },
        { name: 'tables', type: 'json' },
        { name: 'catalogs', type: 'json' },
        { name: 'metadata', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_race_conf_version ON race_versioned_configs (version)',
        'CREATE INDEX idx_race_conf_sha256 ON race_versioned_configs (sha256)',
        'CREATE INDEX idx_race_conf_status ON race_versioned_configs (status)',
      ],
    })

    app.save(collection)

    // Seed com snapshot DRAFT inativo v1.0.0 (work_item: RACE-SOURCE-01A)
    try {
      const existing = app.findFirstRecordByData(
        'race_versioned_configs',
        'version',
        'RACE-SOURCE-01A-DRAFT-1.0.0',
      )
      if (existing) return
    } catch (_) {}

    const seededParameters = {
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

    const seededTables = {
      points_gp: [
        { position: 1, points: 25 },
        { position: 2, points: 18 },
        { position: 3, points: 15 },
        { position: 4, points: 12 },
        { position: 5, points: 10 },
        { position: 6, points: 8 },
        { position: 7, points: 6 },
        { position: 8, points: 4 },
        { position: 9, points: 2 },
        { position: 10, points: 1 },
      ],
      points_sprint: [
        { position: 1, points: 8 },
        { position: 2, points: 7 },
        { position: 3, points: 6 },
        { position: 4, points: 5 },
        { position: 5, points: 4 },
        { position: 6, points: 3 },
        { position: 7, points: 2 },
        { position: 8, points: 1 },
      ],
      tyres: [
        { compound: 'Macio', delta_sec: -0.65, life_laps: 13, cliff_lap: 11 },
        { compound: 'Médio', delta_sec: 0, life_laps: 26, cliff_lap: 24 },
        { compound: 'Duro', delta_sec: 0.55, life_laps: 40, cliff_lap: 38 },
        { compound: 'Intermediário', delta_sec: 0, life_laps: 26, cliff_lap: 24 },
        { compound: 'Chuva extrema', delta_sec: 0, life_laps: 22, cliff_lap: 20 },
      ],
      practices: [
        { session: 'TL1', laps: 24, max_setup_gain: 40, time_offset_sec: 1.5, soft_tyre_prob: 0.3 },
        { session: 'TL2', laps: 26, max_setup_gain: 40, time_offset_sec: 0.8, soft_tyre_prob: 0.5 },
        { session: 'TL3', laps: 18, max_setup_gain: 30, time_offset_sec: 0.2, soft_tyre_prob: 0.8 },
      ],
    }

    const rec = new Record(collection)
    rec.set('version', 'RACE-SOURCE-01A-DRAFT-1.0.0')
    rec.set('sha256', '15e9e24a41300938f29cefdca68480db80c05988548bb2268798e4d35e1286ae')
    rec.set('status', 'DRAFT')
    rec.set('is_active', false)
    rec.set('work_item', 'RACE-SOURCE-01A')
    rec.set('delivery_version', 'RACE-SOURCE-01A-DRAFT-1.0.0')
    rec.set('source_declared_version', 'v1')
    rec.set('source_sha256', '0d02e79794f6defabfa3385d2854a4fc0bed7e5a17495c008075185d71f289a2')
    rec.set('parameters', seededParameters)
    rec.set('tables', seededTables)
    rec.set('catalogs', {
      entrants_count: 24,
      teams_count: 12,
      qualifying_q2_cutoff: 18,
      qualifying_q3_cutoff: 10,
    })
    rec.set('metadata', {
      source_label: 'APEX GP MANAGER — Simulador de Corrida (v1)',
      source_filename: 'Apex GP Manager - Simulacao de Corrida.xlsx',
      package_id: 'RACE-SOURCE-01-3FILES',
      package_version: '1.0.0',
      production_activation_authorized: false,
      notes:
        'Configuração DRAFT inativa criada na rodada RACE-SOURCE-01A. Não substitui o motor esportivo ativo de produção.',
    })

    app.save(rec)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('race_versioned_configs')
      app.delete(col)
    } catch (_) {}
  },
)
