/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    if (app.hasTable('championship_snapshots')) {
      return
    }

    const collection = new Collection({
      name: 'championship_snapshots',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'snapshot_key',
          type: 'text',
          required: false,
        },
        {
          name: 'career_id',
          type: 'text',
          required: false,
        },
        {
          name: 'season',
          type: 'number',
          required: false,
        },
        {
          name: 'through_round',
          type: 'number',
          required: false,
        },
        {
          name: 'source_race_ids',
          type: 'json',
          required: false,
        },
        {
          name: 'source_checksums',
          type: 'json',
          required: false,
        },
        {
          name: 'driver_standings',
          type: 'json',
          required: false,
        },
        {
          name: 'constructor_standings',
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
        'CREATE UNIQUE INDEX idx_championship_snapshot_key ON championship_snapshots (snapshot_key)',
        'CREATE INDEX idx_championship_career_season ON championship_snapshots (career_id, season)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('championship_snapshots')
      app.delete(col)
    } catch (_) {}
  },
)
