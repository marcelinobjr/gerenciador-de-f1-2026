migrate(
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')

    if (!teams.fields.getByName('manager_name')) {
      teams.fields.add(
        new TextField({
          name: 'manager_name',
          required: false,
        }),
      )
    }

    if (!teams.fields.getByName('manager_profile')) {
      teams.fields.add(
        new JSONField({
          name: 'manager_profile',
          required: false,
        }),
      )
    }

    if (!teams.fields.getByName('career_settings')) {
      teams.fields.add(
        new JSONField({
          name: 'career_settings',
          required: false,
        }),
      )
    }

    if (!teams.fields.getByName('custom_grid_teams')) {
      teams.fields.add(
        new JSONField({
          name: 'custom_grid_teams',
          required: false,
        }),
      )
    }

    if (!teams.fields.getByName('universe_type')) {
      teams.fields.add(
        new TextField({
          name: 'universe_type',
          required: false,
        }),
      )
    }

    app.save(teams)
  },
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')

    const fieldsToRemove = [
      'manager_name',
      'manager_profile',
      'career_settings',
      'custom_grid_teams',
      'universe_type',
    ]

    for (const fName of fieldsToRemove) {
      const field = teams.fields.getByName(fName)
      if (field) {
        teams.fields.removeById(field.id)
      }
    }

    app.save(teams)
  },
)
