migrate(
  (app) => {
    const drivers = app.findCollectionByNameOrId('drivers')
    const teams = app.findCollectionByNameOrId('teams')

    if (!drivers.fields.getByName('next_team_id')) {
      drivers.fields.add(
        new RelationField({
          name: 'next_team_id',
          collectionId: teams.id,
          required: false,
          maxSelect: 1,
        }),
      )
    }

    if (!drivers.fields.getByName('next_contract_role')) {
      drivers.fields.add(
        new SelectField({
          name: 'next_contract_role',
          required: false,
          values: ['titular', 'reserva'],
          maxSelect: 1,
        }),
      )
    }

    app.save(drivers)
  },
  (app) => {
    const drivers = app.findCollectionByNameOrId('drivers')
    const field1 = drivers.fields.getByName('next_team_id')
    if (field1) drivers.fields.removeById(field1.id)
    const field2 = drivers.fields.getByName('next_contract_role')
    if (field2) drivers.fields.removeById(field2.id)
    app.save(drivers)
  },
)
