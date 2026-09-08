migrate(
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')
    const driversCol = app.findCollectionByNameOrId('drivers')

    // 1. Add 'strength' field to teams collection if it doesn't exist
    if (!teamsCol.fields.getByName('strength')) {
      teamsCol.fields.add(
        new NumberField({
          name: 'strength',
          min: 0,
          max: 100,
        }),
      )
    }

    // Also add 'is_custom' bool field to teams (to differentiate custom 12th team vs real 11)
    if (!teamsCol.fields.getByName('is_custom')) {
      teamsCol.fields.add(
        new BoolField({
          name: 'is_custom',
        }),
      )
    }

    // Also add 'key' text field to identify official teams (e.g. 'mclaren', 'ferrari', 'cadillac', etc.)
    if (!teamsCol.fields.getByName('team_key')) {
      teamsCol.fields.add(
        new TextField({
          name: 'team_key',
        }),
      )
    }

    app.save(teamsCol)

    // Update existing teams: set default strength to 58, is_custom = true if Escuderia Brasil
    try {
      app
        .db()
        .newQuery(`UPDATE teams SET strength = 58 WHERE strength IS NULL OR strength = 0`)
        .execute()
      app.db().newQuery(`UPDATE teams SET is_custom = 1 WHERE name = 'Escuderia Brasil'`).execute()
    } catch (_) {}

    // 2. Add 'out of grid' / reserve drivers if not already present
    // These will be available for hire, especially for the 12th custom team
    const outOfGridDrivers = [
      {
        name: 'Felipe Drugovich',
        nationality: 'Brasil',
        age: 25,
        speed: 79,
        consistency: 80,
        rain: 82,
        defense: 76,
        salary: 7000000,
        contract_end: 2026,
      },
      {
        name: 'Mick Schumacher',
        nationality: 'Alemanha',
        age: 26,
        speed: 77,
        consistency: 75,
        rain: 78,
        defense: 74,
        salary: 6500000,
        contract_end: 2026,
      },
      {
        name: 'Zane Maloney',
        nationality: 'Barbados',
        age: 22,
        speed: 76,
        consistency: 74,
        rain: 76,
        defense: 75,
        salary: 5000000,
        contract_end: 2026,
      },
      {
        name: 'Valtteri Bottas',
        nationality: 'Finlândia',
        age: 36,
        speed: 81,
        consistency: 85,
        rain: 79,
        defense: 80,
        salary: 12000000,
        contract_end: 2026,
      },
      {
        name: 'Kevin Magnussen',
        nationality: 'Dinamarca',
        age: 33,
        speed: 79,
        consistency: 76,
        rain: 77,
        defense: 83,
        salary: 9000000,
        contract_end: 2026,
      },
      {
        name: 'Paul Aron',
        nationality: 'Estônia',
        age: 22,
        speed: 75,
        consistency: 77,
        rain: 74,
        defense: 72,
        salary: 4500000,
        contract_end: 2026,
      },
      {
        name: 'Oliver Rowland',
        nationality: 'Reino Unido',
        age: 33,
        speed: 78,
        consistency: 76,
        rain: 80,
        defense: 78,
        salary: 6000000,
        contract_end: 2026,
      },
      {
        name: 'Theo Pourchaire',
        nationality: 'França',
        age: 22,
        speed: 78,
        consistency: 76,
        rain: 75,
        defense: 75,
        salary: 5500000,
        contract_end: 2026,
      },
    ]

    for (const d of outOfGridDrivers) {
      try {
        app.findFirstRecordByData('drivers', 'name', d.name)
        // already exists, skip
      } catch (_) {
        const rec = new Record(driversCol)
        rec.set('name', d.name)
        rec.set('nationality', d.nationality)
        rec.set('age', d.age)
        rec.set('speed', d.speed)
        rec.set('consistency', d.consistency)
        rec.set('rain', d.rain)
        rec.set('defense', d.defense)
        rec.set('salary', d.salary)
        rec.set('contract_end', d.contract_end)
        rec.set('team_id', null)
        app.save(rec)
      }
    }
  },
  (app) => {
    // down migration
    try {
      const teamsCol = app.findCollectionByNameOrId('teams')
      if (teamsCol.fields.getByName('strength')) {
        teamsCol.fields.removeByName('strength')
      }
      if (teamsCol.fields.getByName('is_custom')) {
        teamsCol.fields.removeByName('is_custom')
      }
      if (teamsCol.fields.getByName('team_key')) {
        teamsCol.fields.removeByName('team_key')
      }
      app.save(teamsCol)
    } catch (_) {}
  },
)
