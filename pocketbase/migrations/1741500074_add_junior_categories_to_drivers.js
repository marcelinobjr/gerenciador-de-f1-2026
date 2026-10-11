/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const driversCol = app.findCollectionByNameOrId('drivers')
    const categoryField = driversCol.fields.getByName('category')

    if (categoryField) {
      const currentValues = categoryField.values || []
      const newValuesToAdd = ['f3', 'f4', 'regional', 'karting']
      const mergedValues = [...currentValues]

      for (const val of newValuesToAdd) {
        if (!mergedValues.includes(val)) {
          mergedValues.push(val)
        }
      }

      categoryField.values = mergedValues
      if (categoryField.maxSelect && categoryField.maxSelect > mergedValues.length) {
        categoryField.maxSelect = mergedValues.length
      }
      app.save(driversCol)
    }
  },
  (app) => {
    const driversCol = app.findCollectionByNameOrId('drivers')
    const categoryField = driversCol.fields.getByName('category')

    if (categoryField) {
      const currentValues = categoryField.values || []
      const valuesToRemove = ['f3', 'f4', 'regional', 'karting']
      categoryField.values = currentValues.filter((v) => !valuesToRemove.includes(v))
      app.save(driversCol)
    }
  },
)
