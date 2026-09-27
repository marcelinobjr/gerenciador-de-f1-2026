migrate(
  (app) => {
    // 1. Criar a coleção financial_versioned_configs caso ainda não exista
    let configCol
    try {
      configCol = app.findCollectionByNameOrId('financial_versioned_configs')
    } catch (_) {
      configCol = new Collection({
        name: 'financial_versioned_configs',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: '',
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
          { name: 'is_active', type: 'bool', required: false },
          { name: 'work_item', type: 'text', required: true },
          { name: 'delivery_version', type: 'text', required: true },
          { name: 'source_declared_version', type: 'text', required: true },
          { name: 'source_sha256', type: 'text', required: true },
          { name: 'parameters', type: 'json', required: true },
          { name: 'catalogs', type: 'json', required: false },
          { name: 'metadata', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_fin_conf_version ON financial_versioned_configs (version)',
          'CREATE INDEX idx_fin_conf_sha256 ON financial_versioned_configs (sha256)',
          'CREATE INDEX idx_fin_conf_status ON financial_versioned_configs (status)',
        ],
      })
      app.save(configCol)
    }

    // 2. Importação idempotente do snapshot DRAFT de FIN-SOURCE-01A
    const versionKey = 'FIN-SOURCE-01A-DRAFT-1.0.0'
    const sourceSha256 = 'd3f6dafcde83e81b75b4c57f670aef48508c1a842980a16a327179ca1c94f56a'
    const file1Sha256 = 'b5278c520db7b4613ff1da33b2bf8bfa79fbc3585b4676be36802524458572b8'

    let existingRecord = null
    try {
      existingRecord = app.findFirstRecordByData(
        'financial_versioned_configs',
        'version',
        versionKey,
      )
    } catch (_) {
      existingRecord = null
    }

    // Regras B6:B39 estruturadas a partir de 01_FIN_EVO_PARAMETROS.json
    const rules = {
      participation_annual_fixed: 60,
      participation_per_gp: 1.2,
      participation_per_sprint: 0.2,
      gp_win_prize: 0.5,
      sprint_win_prize: 0.1,
      constructors_minimum_prize: 0.5,
      constructors_position_amplitude: 5.5,
      constructors_champion_bonus: 2,
      sponsor_position_coefficient: 0.01,
      initial_reserve_over_c0: 0.25,
      initial_cash_over_c0: 0.35,
      sponsor_wins_coefficient: 0.08,
      preparation_test_event: 1.2,
      localized_development_multiplier: 0.6,
      broad_development_multiplier: 1.6,
      win_curve_calendar_divisor: 4,
      weekend_fixed_operation: 0.45,
      logistics_regional: 0.45,
      logistics_standard: 0.7,
      logistics_long_distance: 0.95,
      logistics_complex: 1.15,
      sprint_incremental_operation: 0.15,
      logistics_savings_default: 0,
      logistics_savings_max: 0.08,
      staff_win_bonus_share: 0.25,
      construction_contract_share: 0.3,
      construction_execution_share: 0.4,
      construction_delivery_share: 0.3,
      no_gp_wins_surplus_warning_fraction: 0.05,
      stress_fixed_sponsor_change: -0.1,
      stress_staff_change: 0.1,
      months_per_year: 12,
      reconciliation_tolerance: 0.000001,
      monetary_scale_to_usd: 1000000,
    }

    const catalogs = {
      reference_team: 'Audi',
      reference_c0: 260,
      initial_cash: 91,
      initial_debt: 0,
      initial_reserve: 65,
    }

    const metadata = {
      work_item: 'FIN-EVO-03',
      source_declared_version: 'FIN-EVO-02',
      delivery_version: 'FIN-SOURCE-01-3FILES-1.0.0',
      source_sha256: sourceSha256,
      parameters_file_sha256: file1Sha256,
      status: 'SOURCE_EXTRACTION_NOT_PRODUCTION_HOMOLOGATION',
      config_state: 'DRAFT',
      original_FIN_EVO_03_JSON_recovered: false,
      relegation_rule_status: 'NOT_DEFINED_IN_SOURCE',
      auto_select_in_careers: false,
    }

    if (!existingRecord) {
      const record = new Record(configCol)
      record.set('version', versionKey)
      record.set('sha256', file1Sha256)
      record.set('status', 'DRAFT')
      record.set('is_active', false)
      record.set('work_item', 'FIN-EVO-03')
      record.set('delivery_version', 'FIN-SOURCE-01-3FILES-1.0.0')
      record.set('source_declared_version', 'FIN-EVO-02')
      record.set('source_sha256', sourceSha256)
      record.set('parameters', rules)
      record.set('catalogs', catalogs)
      record.set('metadata', metadata)
      app.save(record)
    } else {
      existingRecord.set('sha256', file1Sha256)
      existingRecord.set('status', 'DRAFT')
      existingRecord.set('is_active', false)
      existingRecord.set('work_item', 'FIN-EVO-03')
      existingRecord.set('delivery_version', 'FIN-SOURCE-01-3FILES-1.0.0')
      existingRecord.set('source_declared_version', 'FIN-EVO-02')
      existingRecord.set('source_sha256', sourceSha256)
      existingRecord.set('parameters', rules)
      existingRecord.set('catalogs', catalogs)
      existingRecord.set('metadata', metadata)
      app.save(existingRecord)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('financial_versioned_configs')
      app.delete(col)
    } catch (_) {}
  },
)
