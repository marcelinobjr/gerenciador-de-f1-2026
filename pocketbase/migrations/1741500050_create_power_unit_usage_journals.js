/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    if (app.hasTable('power_unit_usage_journals')) {
      return
    }

    const collection = new Collection({
      name: 'power_unit_usage_journals',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'journal_key',
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
          name: 'race_variant',
          type: 'text',
          required: true,
        },
        {
          name: 'session_key',
          type: 'text',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          values: ['PENDING', 'APPLYING', 'COMPLETE', 'PARTIAL', 'FAILED', 'SKIPPED'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'applied_unit_ids',
          type: 'json',
          required: false,
        },
        {
          name: 'applied_driver_ids',
          type: 'json',
          required: false,
        },
        {
          name: 'last_error',
          type: 'text',
          required: false,
        },
        {
          name: 'unit_results',
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
        'CREATE UNIQUE INDEX idx_pu_usage_journal_key ON power_unit_usage_journals (journal_key)',
        'CREATE INDEX idx_pu_usage_career_season ON power_unit_usage_journals (career_id, season)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('power_unit_usage_journals')
      app.delete(col)
    } catch (_) {}
  },
)
