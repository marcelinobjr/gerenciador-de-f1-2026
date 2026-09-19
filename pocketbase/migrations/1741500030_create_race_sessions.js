migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const teams = app.findCollectionByNameOrId('teams')
    const seasons = app.findCollectionByNameOrId('seasons')

    const collection = new Collection({
      name: 'race_sessions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'session_key',
          type: 'text',
          required: true,
        },
        {
          name: 'season_id',
          type: 'relation',
          required: true,
          collectionId: seasons.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'team_id',
          type: 'relation',
          required: true,
          collectionId: teams.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'season_year',
          type: 'number',
          required: false,
        },
        {
          name: 'round',
          type: 'number',
          required: true,
        },
        {
          name: 'session_type',
          type: 'select',
          required: true,
          values: ['race', 'sprint'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'not_started',
            'in_progress',
            'paused',
            'awaiting_decision',
            'completed',
            'recovering',
          ],
          maxSelect: 1,
        },
        {
          name: 'revision',
          type: 'number',
          required: false,
        },
        {
          name: 'current_lap',
          type: 'number',
          required: false,
        },
        {
          name: 'total_laps',
          type: 'number',
          required: false,
        },
        {
          name: 'sim_speed',
          type: 'number',
          required: false,
        },
        {
          name: 'pause_reason',
          type: 'text',
          required: false,
        },
        {
          name: 'active_executor_id',
          type: 'text',
          required: false,
        },
        {
          name: 'executor_lease_until',
          type: 'text',
          required: false,
        },
        {
          name: 'lock_heartbeat_at',
          type: 'text',
          required: false,
        },
        {
          name: 'checkpoint_data',
          type: 'json',
          required: false,
        },
        {
          name: 'lap_history',
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
        'CREATE UNIQUE INDEX idx_race_sessions_key ON race_sessions (session_key)',
        'CREATE INDEX idx_race_sessions_lookup ON race_sessions (season_id, round, session_type)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('race_sessions')
      app.delete(col)
    } catch (_) {}
  },
)
