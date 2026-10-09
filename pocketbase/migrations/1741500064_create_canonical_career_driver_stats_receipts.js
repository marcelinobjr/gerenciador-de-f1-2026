/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    if (app.hasTable('canonical_career_driver_stats_receipts')) {
      return
    }

    const collection = new Collection({
      name: 'canonical_career_driver_stats_receipts',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'operation_key',
          type: 'text',
          required: true,
        },
        {
          name: 'career_id',
          type: 'text',
          required: true,
        },
        {
          name: 'season',
          type: 'number',
          required: true,
        },
        {
          name: 'round',
          type: 'number',
          required: true,
        },
        {
          name: 'session',
          type: 'text',
          required: true,
        },
        {
          name: 'session_type',
          type: 'text',
          required: false,
        },
        {
          name: 'driver_id',
          type: 'text',
          required: true,
        },
        {
          name: 'career_driver_id',
          type: 'text',
          required: true,
        },
        {
          name: 'driver_slug',
          type: 'text',
          required: false,
        },
        {
          name: 'race_result_id',
          type: 'text',
          required: false,
        },
        {
          name: 'official_race_result_id',
          type: 'text',
          required: false,
        },
        {
          name: 'result_hash',
          type: 'text',
          required: true,
        },
        {
          name: 'before_stats',
          type: 'json',
          required: false,
        },
        {
          name: 'effect_data',
          type: 'json',
          required: false,
        },
        {
          name: 'after_stats',
          type: 'json',
          required: false,
        },
        {
          name: 'applied_at',
          type: 'date',
          required: true,
        },
        {
          name: 'payload',
          type: 'json',
          required: false,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_career_driver_stats_operation_key ON canonical_career_driver_stats_receipts (operation_key)',
        'CREATE INDEX idx_career_driver_stats_lookup ON canonical_career_driver_stats_receipts (career_id, season, round, driver_id)',
        'CREATE INDEX idx_career_driver_stats_target ON canonical_career_driver_stats_receipts (career_driver_id)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('canonical_career_driver_stats_receipts')
      app.delete(col)
    } catch (_) {}
  },
)
