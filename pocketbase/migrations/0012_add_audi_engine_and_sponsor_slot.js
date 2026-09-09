migrate(
  (app) => {
    // 1. Atualizar campo engine_supplier da collection 'teams' para incluir 'Audi'
    const teamsCol = app.findCollectionByNameOrId('teams')
    const engineField = teamsCol.fields.getByName('engine_supplier')
    if (engineField) {
      engineField.values = ['Ferrari', 'Mercedes', 'Honda', 'Ford', 'Audi']
      teamsCol.fields.add(engineField)
      app.save(teamsCol)
    }

    // 2. Atualizar todas as equipes da Audi existentes para terem o motor Audi
    app
      .db()
      .newQuery(`
    UPDATE teams 
    SET engine_supplier = 'Audi' 
    WHERE team_key = 'audi' OR name LIKE '%Audi%'
  `)
      .execute()

    // 3. Adicionar campo slot opcional na collection sponsors para exclusividade de cota
    const sponsorsCol = app.findCollectionByNameOrId('sponsors')
    if (!sponsorsCol.fields.getByName('slot')) {
      sponsorsCol.fields.add(
        new TextField({
          name: 'slot',
          required: false,
        }),
      )
      app.save(sponsorsCol)
    }
  },
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')
    const engineField = teamsCol.fields.getByName('engine_supplier')
    if (engineField) {
      engineField.values = ['Ferrari', 'Mercedes', 'Honda', 'Ford']
      teamsCol.fields.add(engineField)
      app.save(teamsCol)
    }

    const sponsorsCol = app.findCollectionByNameOrId('sponsors')
    const slotField = sponsorsCol.fields.getByName('slot')
    if (slotField) {
      sponsorsCol.fields.removeByName('slot')
      app.save(sponsorsCol)
    }
  },
)
