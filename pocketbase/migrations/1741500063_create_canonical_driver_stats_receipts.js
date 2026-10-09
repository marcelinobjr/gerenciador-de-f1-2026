/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    if (app.hasTable('canonical_driver_stats_receipts')) {
      return
    }

    const collection = new Collection({
      name: 'canonical_driver_stats_receipts',
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
          name: 'session_type',
          type: 'text',
          required: true,
        },
        {
          name: 'driver_id',
          type: 'text',
          required: true,
        },
        {
          name: 'driver_slug',
          type: 'text',
        },
        {
          name: 'official_race_result_id',
          type: 'text',
          required: true,
        },
        {
          name: 'result_hash',
          type: 'text',
          required: true,
        },
        {
          name: 'deltas',
          type: 'json',
        },
        {
          name: 'stats_before',
          type: 'json',
        },
        {
          name: 'stats_after',
          type: 'json',
        },
        {
          name: 'applied_at',
          type: 'text',
          required: true,
        },
        {
          name: 'payload',
          type: 'json',
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
        'CREATE UNIQUE INDEX idx_driver_stats_operation_key ON canonical_driver_stats_receipts (operation_key)',
        'CREATE INDEX idx_driver_stats_receipt_lookup ON canonical_driver_stats_receipts (career_id, season, round, driver_id)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('canonical_driver_stats_receipts')
      app.delete(col)
    } catch (_) {}
  },
)
