migrate(
  (app) => {
    const driversCol = app.findCollectionByNameOrId('drivers')

    // Add morale (0-100) to drivers collection if not present
    if (!driversCol.fields.getByName('morale')) {
      driversCol.fields.add(
        new NumberField({
          name: 'morale',
          min: 0,
          max: 100,
        }),
      )
    }

    // Add physical_condition / fitness (0-100) to drivers collection if not present
    if (!driversCol.fields.getByName('physical_condition')) {
      driversCol.fields.add(
        new NumberField({
          name: 'physical_condition',
          min: 0,
          max: 100,
        }),
      )
    }

    app.save(driversCol)

    // Populate initial morale and physical_condition for existing drivers via SQL
    app
      .db()
      .newQuery(`
      UPDATE drivers 
      SET morale = CASE 
        WHEN speed >= 88 THEN 85
        WHEN speed >= 83 THEN 78
        ELSE 72
      END 
      WHERE morale IS NULL OR morale = 0
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE drivers 
      SET physical_condition = CASE 
        WHEN age <= 24 THEN 95
        WHEN age <= 30 THEN 90
        WHEN age <= 36 THEN 84
        ELSE 78
      END 
      WHERE physical_condition IS NULL OR physical_condition = 0
    `)
      .execute()
  },
  (app) => {
    // Revert is optional or can leave fields
  },
)
