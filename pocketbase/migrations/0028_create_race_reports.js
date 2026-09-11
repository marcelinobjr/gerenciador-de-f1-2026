migrate(
  (app) => {
    try {
      app.findCollectionByNameOrId('race_reports')
      return // já existe
    } catch (_) {}

    const seasons = app.findCollectionByNameOrId('seasons')
    const teams = app.findCollectionByNameOrId('teams')

    const collection = new Collection({
      name: 'race_reports',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'season_id',
          type: 'relation',
          required: true,
          collectionId: seasons.id,
          maxSelect: 1,
        },
        {
          name: 'team_id',
          type: 'relation',
          required: true,
          collectionId: teams.id,
          maxSelect: 1,
        },
        { name: 'round', type: 'number', required: true, onlyInt: true },
        { name: 'gp_name', type: 'text', required: true },
        { name: 'circuit_name', type: 'text' },
        { name: 'country', type: 'text' },
        { name: 'data', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_race_reports_season_round ON race_reports (season_id, round)',
        'CREATE INDEX idx_race_reports_team ON race_reports (team_id)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('race_reports')
      app.delete(collection)
    } catch (_) {}
  },
)
