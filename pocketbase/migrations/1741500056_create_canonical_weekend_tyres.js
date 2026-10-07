/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    if (app.hasTable('canonical_weekend_tyres')) {
      return
    }

    const collection = new Collection({
      name: 'canonical_weekend_tyres',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'inventory_key',
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
          name: 'driver_id',
          type: 'text',
          required: false,
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
        'CREATE UNIQUE INDEX idx_canonical_weekend_tyres_inventory_key ON canonical_weekend_tyres (inventory_key)',
        'CREATE INDEX idx_canonical_weekend_tyres_career_season_round ON canonical_weekend_tyres (career_id, season, round)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('canonical_weekend_tyres')
      app.delete(col)
    } catch (_) {}
  },
)
