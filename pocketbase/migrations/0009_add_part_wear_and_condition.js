migrate(
  (app) => {
    const parts = app.findCollectionByNameOrId('parts')

    if (!parts.fields.getByName('condition')) {
      parts.fields.add(
        new NumberField({
          name: 'condition',
          min: 0,
          max: 100,
          onlyInt: true,
        }),
      )
      app.save(parts)
    }

    // Initialize condition to 100 on existing parts
    try {
      app
        .db()
        .newQuery('UPDATE parts SET condition = 100 WHERE condition IS NULL OR condition = 0')
        .execute()
    } catch (err) {
      console.warn('Erro ao inicializar condition das peças:', err)
    }
  },
  (app) => {
    const parts = app.findCollectionByNameOrId('parts')
    const field = parts.fields.getByName('condition')
    if (field) {
      parts.fields.removeByName('condition')
      app.save(parts)
    }
  },
)
