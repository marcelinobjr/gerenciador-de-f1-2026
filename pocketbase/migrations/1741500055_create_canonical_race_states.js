/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    if (app.hasTable('canonical_race_states')) {
      return
    }

    const collection = new Collection({
      name: 'canonical_race_states',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'session_key',
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
          name: 'variant',
          type: 'select',
          values: ['MAIN_RACE', 'SPRINT_RACE'],
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
        'CREATE UNIQUE INDEX idx_canonical_race_state_session_key ON canonical_race_states (session_key)',
        'CREATE INDEX idx_canonical_race_state_career_season ON canonical_race_states (career_id, season)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('canonical_race_states')
      app.delete(col)
    } catch (_) {}
  },
)
