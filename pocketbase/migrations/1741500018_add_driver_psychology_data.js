migrate(
  (app) => {
    const driversCol = app.findCollectionByNameOrId('drivers')

    // Campo aditivo para persistência de psicologia, relações e memórias
    if (!driversCol.fields.getByName('psychology_data')) {
      driversCol.fields.add(
        new JSONField({
          name: 'psychology_data',
          required: false,
        }),
      )
      app.save(driversCol)
    }
  },
  (app) => {
    try {
      const driversCol = app.findCollectionByNameOrId('drivers')
      const field = driversCol.fields.getByName('psychology_data')
      if (field) {
        driversCol.fields.removeByName('psychology_data')
        app.save(driversCol)
      }
    } catch (_) {}
  },
)
