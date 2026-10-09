migrate(
  (app) => {
    const collection = new Collection({
      name: 'canonical_career_apply_journals',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'journal_key', type: 'text', required: true },
        { name: 'career_id', type: 'text', required: true },
        { name: 'season', type: 'number', required: true },
        { name: 'round', type: 'number', required: true },
        { name: 'race_variant', type: 'text' },
        { name: 'official_race_result_id', type: 'text', required: true },
        { name: 'result_hash', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['PENDING', 'APPLYING', 'COMPLETE', 'FAILED'],
          maxSelect: 1,
        },
        { name: 'applied_driver_ids', type: 'json' },
        { name: 'total_entries', type: 'number' },
        { name: 'version', type: 'number' },
        { name: 'started_at', type: 'text' },
        { name: 'completed_at', type: 'text' },
        { name: 'last_error', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_career_apply_journal_key ON canonical_career_apply_journals (journal_key)',
        'CREATE INDEX idx_career_apply_journal_lookup ON canonical_career_apply_journals (career_id, season, round)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('canonical_career_apply_journals')
      app.delete(collection)
    } catch (_) {}
  },
)
