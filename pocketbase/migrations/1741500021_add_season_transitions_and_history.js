migrate(
  (app) => {
    // 1. Criar collection 'season_histories'
    try {
      app.findCollectionByNameOrId('season_histories')
    } catch (_) {
      const colHistories = new Collection({
        name: 'season_histories',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: '',
        fields: [
          { name: 'season_year', type: 'number', required: true },
          {
            name: 'team_id',
            type: 'relation',
            collectionId: app.findCollectionByNameOrId('teams').id,
            maxSelect: 1,
          },
          { name: 'drivers_champion', type: 'json' },
          { name: 'constructors_champion', type: 'json' },
          { name: 'final_driver_standings', type: 'json' },
          { name: 'final_constructor_standings', type: 'json' },
          { name: 'team_summary', type: 'json' },
          { name: 'financial_close_summary', type: 'json' },
          { name: 'cost_cap_report', type: 'json' },
          { name: 'major_records', type: 'json' },
          { name: 'archived_at', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_season_histories_year ON season_histories (season_year)',
          'CREATE INDEX idx_season_histories_team ON season_histories (team_id)',
        ],
      })
      app.save(colHistories)
    }

    // 2. Criar collection 'season_transitions'
    try {
      app.findCollectionByNameOrId('season_transitions')
    } catch (_) {
      const colTransitions = new Collection({
        name: 'season_transitions',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: '',
        fields: [
          { name: 'transition_key', type: 'text', required: true },
          { name: 'from_season', type: 'number', required: true },
          { name: 'to_season', type: 'number', required: true },
          {
            name: 'team_id',
            type: 'relation',
            collectionId: app.findCollectionByNameOrId('teams').id,
            maxSelect: 1,
          },
          { name: 'status', type: 'text', required: true },
          { name: 'current_step', type: 'text' },
          { name: 'snapshot_data', type: 'json' },
          { name: 'audit_results', type: 'json' },
          { name: 'error_message', type: 'text' },
          { name: 'completed_at', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_season_transitions_key ON season_transitions (transition_key)',
        ],
      })
      app.save(colTransitions)
    }

    // 3. Adicionar campos aditivos na collection 'seasons' se não existirem
    const colSeasons = app.findCollectionByNameOrId('seasons')
    if (!colSeasons.fields.getByName('is_completed')) {
      colSeasons.fields.add(new BoolField({ name: 'is_completed' }))
    }
    if (!colSeasons.fields.getByName('archived_history_id')) {
      colSeasons.fields.add(new TextField({ name: 'archived_history_id' }))
    }
    app.save(colSeasons)
  },
  (app) => {
    try {
      const hist = app.findCollectionByNameOrId('season_histories')
      app.delete(hist)
    } catch (_) {}
    try {
      const trans = app.findCollectionByNameOrId('season_transitions')
      app.delete(trans)
    } catch (_) {}
  },
)
