migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. teams collection
    const teams = new Collection({
      name: 'teams',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'color', type: 'text', required: true },
        { name: 'chassis_level', type: 'number', min: 0, max: 100 },
        { name: 'aero_level', type: 'number', min: 0, max: 100 },
        { name: 'strategy_level', type: 'number', min: 0, max: 100 },
        { name: 'budget', type: 'number' },
        {
          name: 'engine_supplier',
          type: 'select',
          required: true,
          values: ['Ferrari', 'Mercedes', 'Honda', 'Ford'],
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: usersCol.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_teams_user ON teams (user_id)'],
    })
    app.save(teams)

    // 2. seasons collection
    const seasons = new Collection({
      name: 'seasons',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && team_id.user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && team_id.user_id = @request.auth.id",
      fields: [
        { name: 'year', type: 'number', required: true },
        { name: 'current_round', type: 'number', required: true },
        { name: 'total_rounds', type: 'number', required: true },
        {
          name: 'team_id',
          type: 'relation',
          required: true,
          collectionId: teams.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_seasons_team ON seasons (team_id)'],
    })
    app.save(seasons)

    // 3. drivers collection
    const drivers = new Collection({
      name: 'drivers',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'nationality', type: 'text', required: true },
        { name: 'age', type: 'number' },
        { name: 'speed', type: 'number', min: 0, max: 100 },
        { name: 'consistency', type: 'number', min: 0, max: 100 },
        { name: 'rain', type: 'number', min: 0, max: 100 },
        { name: 'defense', type: 'number', min: 0, max: 100 },
        { name: 'salary', type: 'number' },
        { name: 'contract_end', type: 'number' },
        {
          name: 'team_id',
          type: 'relation',
          collectionId: teams.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_drivers_team ON drivers (team_id)',
        'CREATE INDEX idx_drivers_name ON drivers (name)',
      ],
    })
    app.save(drivers)

    // 4. race_results collection
    const raceResults = new Collection({
      name: 'race_results',
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
        { name: 'round', type: 'number', required: true },
        {
          name: 'driver_id',
          type: 'relation',
          required: true,
          collectionId: drivers.id,
          maxSelect: 1,
        },
        {
          name: 'team_id',
          type: 'relation',
          required: true,
          collectionId: teams.id,
          maxSelect: 1,
        },
        { name: 'position', type: 'number', required: true },
        { name: 'points', type: 'number', required: true },
        { name: 'fastest_lap', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_race_results_season_round ON race_results (season_id, round)'],
    })
    app.save(raceResults)

    // 5. sponsors collection
    const sponsors = new Collection({
      name: 'sponsors',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && team_id.user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && team_id.user_id = @request.auth.id",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'value_per_round', type: 'number', required: true },
        { name: 'requirement', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'suspenso', 'encerrado'],
          maxSelect: 1,
        },
        { name: 'rounds_remaining', type: 'number' },
        {
          name: 'team_id',
          type: 'relation',
          required: true,
          collectionId: teams.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_sponsors_team ON sponsors (team_id)'],
    })
    app.save(sponsors)

    // 6. parts collection
    const parts = new Collection({
      name: 'parts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && team_id.user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && team_id.user_id = @request.auth.id",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'level', type: 'number', min: 0, max: 10 },
        {
          name: 'team_id',
          type: 'relation',
          required: true,
          collectionId: teams.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_parts_team ON parts (team_id)'],
    })
    app.save(parts)

    // 7. events collection
    const events = new Collection({
      name: 'events',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && team_id.user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && team_id.user_id = @request.auth.id",
      fields: [
        { name: 'message', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['resultado', 'contrato', 'desenvolvimento', 'patrocinio'],
          maxSelect: 1,
        },
        {
          name: 'team_id',
          type: 'relation',
          required: true,
          collectionId: teams.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_events_team_created ON events (team_id, created DESC)'],
    })
    app.save(events)
  },
  (app) => {
    const collections = [
      'events',
      'parts',
      'sponsors',
      'race_results',
      'drivers',
      'seasons',
      'teams',
    ]
    for (const name of collections) {
      try {
        const c = app.findCollectionByNameOrId(name)
        app.delete(c)
      } catch (_) {}
    }
  },
)
