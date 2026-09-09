migrate(
  (app) => {
    // Verificar se collection circuits já existe
    try {
      app.findCollectionByNameOrId('circuits')
      return // já existe
    } catch (_) {}

    const collection = new Collection({
      name: 'circuits',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'round', type: 'number', required: true, onlyInt: true },
        { name: 'name', type: 'text', required: true },
        { name: 'circuit_name', type: 'text' },
        { name: 'country', type: 'text' },
        {
          name: 'photo',
          type: 'file',
          maxSelect: 1,
          maxSize: 2097152, // 2MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          thumbs: ['800x450', '400x225'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_circuits_round ON circuits (round)'],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('circuits')
      app.delete(collection)
    } catch (_) {}
  },
)
