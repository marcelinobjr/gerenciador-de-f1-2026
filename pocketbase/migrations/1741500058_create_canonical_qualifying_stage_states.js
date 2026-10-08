/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    if (app.hasTable('canonical_qualifying_stage_states')) {
      return
    }

    const collection = new Collection({
      name: 'canonical_qualifying_stage_states',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'state_key',
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
          name: 'stage',
          type: 'select',
          values: ['q1', 'q2', 'q3', 'sq1', 'sq2', 'sq3'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'payload',
          type: 'json',
          required: true,
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
        'CREATE UNIQUE INDEX idx_canonical_quali_stage_state_key ON canonical_qualifying_stage_states (state_key)',
        'CREATE INDEX idx_canonical_quali_stage_state_career_season_round ON canonical_qualifying_stage_states (career_id, season, round, stage)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('canonical_qualifying_stage_states')
      app.delete(col)
    } catch (_) {}
  },
)
