migrate(
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')

    if (!teams.fields.getByName('hero_title')) {
      teams.fields.add(
        new TextField({
          name: 'hero_title',
          required: false,
        }),
      )
    }

    if (!teams.fields.getByName('hero_tagline')) {
      teams.fields.add(
        new TextField({
          name: 'hero_tagline',
          required: false,
        }),
      )
    }

    if (!teams.fields.getByName('hero_car_model')) {
      teams.fields.add(
        new TextField({
          name: 'hero_car_model',
          required: false,
        }),
      )
    }

    app.save(teams)
  },
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')
    const fieldsToRemove = ['hero_title', 'hero_tagline', 'hero_car_model']

    for (const fName of fieldsToRemove) {
      const field = teams.fields.getByName(fName)
      if (field) {
        teams.fields.removeById(field.id)
      }
    }

    app.save(teams)
  },
)
