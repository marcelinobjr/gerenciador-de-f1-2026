migrate(
  (app) => {
    const seasonsCol = app.findCollectionByNameOrId('seasons')
    const teamsCol = app.findCollectionByNameOrId('teams')

    // Create session_setups collection: saves wing, suspension, power balance for TP1, TP2, Q1, Q2, Q3, Corrida
    try {
      app.findCollectionByNameOrId('session_setups')
    } catch (_) {
      const sessionSetups = new Collection({
        name: 'session_setups',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'team_id',
            type: 'relation',
            required: true,
            collectionId: teamsCol.id,
            maxSelect: 1,
          },
          {
            name: 'season_id',
            type: 'relation',
            required: true,
            collectionId: seasonsCol.id,
            maxSelect: 1,
          },
          { name: 'round', type: 'number', required: true },
          {
            name: 'session',
            type: 'select',
            required: true,
            values: ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race'],
            maxSelect: 1,
          },
          { name: 'wing_level', type: 'number', min: 1, max: 10 }, // Asa: 1 (mínimo arrasto) a 10 (máxima pressão aerodinâmica)
          { name: 'suspension_stiffness', type: 'number', min: 1, max: 10 }, // Suspensão: 1 (macia) a 10 (rígida)
          { name: 'pu_electric_ratio', type: 'number', min: 20, max: 80 }, // Gestão 50/50: % de energia elétrica vs combustão
          {
            name: 'tire_compound',
            type: 'select',
            values: ['duro', 'medio', 'macio', 'intermediario', 'chuva_extrema'],
            maxSelect: 1,
          },
          { name: 'target_pit_lap', type: 'number', min: 0, max: 100 }, // Volta programada de pit-stop
          {
            name: 'second_tire_compound',
            type: 'select',
            values: ['duro', 'medio', 'macio', 'intermediario', 'chuva_extrema'],
            maxSelect: 1,
          },
          { name: 'driver_wear', type: 'number', min: 0, max: 100 }, // Desgaste/fadiga do piloto (0-100)
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_session_setups_lookup ON session_setups (team_id, season_id, round)',
        ],
      })
      app.save(sessionSetups)
    }

    // Add driver_wear (fadiga) to drivers collection if not present
    const driversCol = app.findCollectionByNameOrId('drivers')
    if (!driversCol.fields.getByName('fatigue')) {
      driversCol.fields.add(
        new NumberField({
          name: 'fatigue',
          min: 0,
          max: 100,
        }),
      )
      app.save(driversCol)
    }

    // Ensure all 11 official teams exist in teams collection if not present, so canonical AI team IDs are available
    const officialAIProfiles = [
      {
        key: 'mclaren',
        name: 'McLaren F1 Team',
        color: '#FF8000',
        engine: 'Mercedes',
        strength: 92,
      },
      {
        key: 'ferrari',
        name: 'Scuderia Ferrari',
        color: '#E8002D',
        engine: 'Ferrari',
        strength: 88,
      },
      {
        key: 'redbull',
        name: 'Oracle Red Bull Racing',
        color: '#3671C6',
        engine: 'Ford',
        strength: 87,
      },
      {
        key: 'mercedes',
        name: 'Mercedes-AMG PETRONAS',
        color: '#27F4D2',
        engine: 'Mercedes',
        strength: 86,
      },
      {
        key: 'astonmartin',
        name: 'Aston Martin Aramco',
        color: '#229971',
        engine: 'Honda',
        strength: 80,
      },
      {
        key: 'williams',
        name: 'Williams Racing',
        color: '#64C4FF',
        engine: 'Mercedes',
        strength: 77,
      },
      {
        key: 'racingbulls',
        name: 'Visa Cash App RB',
        color: '#6692FF',
        engine: 'Ford',
        strength: 73,
      },
      { key: 'alpine', name: 'Alpine F1 Team', color: '#0093CC', engine: 'Mercedes', strength: 72 },
      { key: 'haas', name: 'Haas F1 Team', color: '#B6BABD', engine: 'Ferrari', strength: 71 },
      { key: 'audi', name: 'Audi F1 Team', color: '#FF2A00', engine: 'Ferrari', strength: 70 },
      {
        key: 'cadillac',
        name: 'Cadillac F1 Team',
        color: '#D4AF37',
        engine: 'Ferrari',
        strength: 67,
      },
    ]

    for (const t of officialAIProfiles) {
      try {
        app.findFirstRecordByData('teams', 'name', t.name)
      } catch (_) {
        const teamRec = new Record(teamsCol)
        teamRec.set('name', t.name)
        teamRec.set('color', t.color)
        teamRec.set('chassis_level', Math.round(t.strength * 0.9))
        teamRec.set('aero_level', Math.round(t.strength * 0.9))
        teamRec.set('strategy_level', Math.round(t.strength * 0.88))
        teamRec.set('budget', 150000000)
        teamRec.set('engine_supplier', t.engine)
        teamRec.set('strength', t.strength)
        teamRec.set('is_custom', false)
        teamRec.set('team_key', t.key)
        app.save(teamRec)
      }
    }
  },
  (app) => {
    try {
      const sessionSetups = app.findCollectionByNameOrId('session_setups')
      app.delete(sessionSetups)
    } catch (_) {}
  },
)
