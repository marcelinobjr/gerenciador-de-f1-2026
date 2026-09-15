/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const driversCol = app.findCollectionByNameOrId('drivers')

    // Adiciona campos de superlicença e homologação se ainda não existirem
    if (!driversCol.fields.getByName('superlicense_points')) {
      driversCol.fields.add(
        new NumberField({
          name: 'superlicense_points',
          min: 0,
          onlyInt: true,
        }),
      )
    }

    if (!driversCol.fields.getByName('homologation_status')) {
      driversCol.fields.add(
        new SelectField({
          name: 'homologation_status',
          values: ['formacao', 'homologacao', 'elegivel'],
          maxSelect: 1,
        }),
      )
    }

    if (!driversCol.fields.getByName('homologation_sessions_done')) {
      driversCol.fields.add(
        new NumberField({
          name: 'homologation_sessions_done',
          min: 0,
          onlyInt: true,
        }),
      )
    }

    if (!driversCol.fields.getByName('f1_adaptation')) {
      driversCol.fields.add(
        new NumberField({
          name: 'f1_adaptation',
          min: 0,
          max: 100,
        }),
      )
    }

    app.save(driversCol)

    // Inicializa registros existentes de forma segura e não destrutiva
    // Default homologation_status = 'elegivel' (para não quebrar titulares existentes da Audi e grid)
    try {
      app
        .db()
        .newQuery(`
      UPDATE drivers
      SET homologation_status = 'elegivel'
      WHERE homologation_status IS NULL OR homologation_status = ''
    `)
        .execute()
    } catch (err) {
      console.log('Aviso update homologation_status:', err)
    }

    try {
      app
        .db()
        .newQuery(`
      UPDATE drivers
      SET superlicense_points = 0
      WHERE superlicense_points IS NULL
    `)
        .execute()
    } catch (err) {
      console.log('Aviso update superlicense_points:', err)
    }

    try {
      app
        .db()
        .newQuery(`
      UPDATE drivers
      SET homologation_sessions_done = 0
      WHERE homologation_sessions_done IS NULL
    `)
        .execute()
    } catch (err) {
      console.log('Aviso update homologation_sessions_done:', err)
    }

    try {
      app
        .db()
        .newQuery(`
      UPDATE drivers
      SET f1_adaptation = 0
      WHERE f1_adaptation IS NULL
    `)
        .execute()
    } catch (err) {
      console.log('Aviso update f1_adaptation:', err)
    }
  },
  (app) => {
    const driversCol = app.findCollectionByNameOrId('drivers')
    if (driversCol.fields.getByName('superlicense_points')) {
      driversCol.fields.removeByName('superlicense_points')
    }
    if (driversCol.fields.getByName('homologation_status')) {
      driversCol.fields.removeByName('homologation_status')
    }
    if (driversCol.fields.getByName('homologation_sessions_done')) {
      driversCol.fields.removeByName('homologation_sessions_done')
    }
    if (driversCol.fields.getByName('f1_adaptation')) {
      driversCol.fields.removeByName('f1_adaptation')
    }
    app.save(driversCol)
  },
)
