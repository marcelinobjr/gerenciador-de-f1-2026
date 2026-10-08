/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    if (app.hasTable('canonical_qualifying_final_grids')) {
      return
    }

    const collection = new Collection({
      name: 'canonical_qualifying_final_grids',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'grid_key',
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
        'CREATE UNIQUE INDEX idx_canonical_quali_final_grid_key ON canonical_qualifying_final_grids (grid_key)',
        'CREATE INDEX idx_canonical_quali_final_grid_career_season_round ON canonical_qualifying_final_grids (career_id, season, round)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('canonical_qualifying_final_grids')
      app.delete(col)
    } catch (_) {}
  },
)
