migrate(
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')
    if (!teamsCol.fields.getByName('photo')) {
      teamsCol.fields.add(
        new FileField({
          name: 'photo',
          required: false,
          maxSelect: 1,
          maxSize: 2097152,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          thumbs: ['400x200'],
        }),
      )
      app.save(teamsCol)
    }
  },
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')
    const photoField = teamsCol.fields.getByName('photo')
    if (photoField) {
      teamsCol.fields.removeByName('photo')
      app.save(teamsCol)
    }
  },
)
