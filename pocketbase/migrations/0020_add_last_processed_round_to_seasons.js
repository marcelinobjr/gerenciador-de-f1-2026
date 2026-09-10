migrate(
  (app) => {
    const seasonsCol = app.findCollectionByNameOrId('seasons')

    if (!seasonsCol.fields.getByName('last_processed_round')) {
      seasonsCol.fields.add(
        new NumberField({
          name: 'last_processed_round',
          min: 0,
          max: 50,
        }),
      )
      app.save(seasonsCol)
    }
  },
  (app) => {
    try {
      const seasonsCol = app.findCollectionByNameOrId('seasons')
      if (seasonsCol.fields.getByName('last_processed_round')) {
        seasonsCol.fields.removeByName('last_processed_round')
        app.save(seasonsCol)
      }
    } catch (_) {}
  },
)
