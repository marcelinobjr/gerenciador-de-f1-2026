migrate(
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')
    if (!teamsCol.fields.getByName('carImage')) {
      teamsCol.fields.add(
        new FileField({
          name: 'carImage',
          required: false,
          maxSelect: 1,
          maxSize: 5242880, // 5MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          thumbs: ['800x260'],
        }),
      )
      app.save(teamsCol)
    }
  },
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')
    const carImageField = teamsCol.fields.getByName('carImage')
    if (carImageField) {
      teamsCol.fields.removeByName('carImage')
      app.save(teamsCol)
    }
  },
)
