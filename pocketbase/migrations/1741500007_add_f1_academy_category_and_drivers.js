/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const driversCol = app.findCollectionByNameOrId('drivers')

    // 1. Atualizar o campo 'category' para incluir 'f1_academy' nos select values
    const categoryField = driversCol.fields.getByName('category')
    if (categoryField) {
      const currentValues = categoryField.values || []
      if (!currentValues.includes('f1_academy')) {
        categoryField.values = [...currentValues, 'f1_academy']
        app.save(driversCol)
      }
    }

    // 2. Semear pilotos da F1 Academy (idempotente)
    const f1AcademyDrivers = [
      {
        name: 'Nina Gademan',
        nationality: 'Holanda',
        age: 22,
        speed: 73,
        consistency: 75,
        rain: 74,
        defense: 72,
        salary: 1200000,
        category: 'f1_academy',
      },
      {
        name: 'Megan Bruce',
        nationality: 'Reino Unido',
        age: 21,
        speed: 72,
        consistency: 74,
        rain: 73,
        defense: 71,
        salary: 1100000,
        category: 'f1_academy',
      },
      {
        name: 'Mathilda Paatz',
        nationality: 'Alemanha',
        age: 18,
        speed: 71,
        consistency: 73,
        rain: 72,
        defense: 70,
        salary: 950000,
        category: 'f1_academy',
      },
      {
        name: 'Alba Larsen',
        nationality: 'Dinamarca',
        age: 19,
        speed: 72,
        consistency: 73,
        rain: 74,
        defense: 71,
        salary: 1050000,
        category: 'f1_academy',
      },
      {
        name: 'Payton Westcott',
        nationality: 'Estados Unidos',
        age: 20,
        speed: 71,
        consistency: 74,
        rain: 72,
        defense: 71,
        salary: 1000000,
        category: 'f1_academy',
      },
      {
        name: 'Emma Felbermayr',
        nationality: 'Áustria',
        age: 19,
        speed: 70,
        consistency: 72,
        rain: 71,
        defense: 70,
        salary: 900000,
        category: 'f1_academy',
      },
      {
        name: 'Lisa Billard',
        nationality: 'França',
        age: 17,
        speed: 71,
        consistency: 73,
        rain: 72,
        defense: 69,
        salary: 850000,
        category: 'f1_academy',
      },
      {
        name: 'Rafaela Ferreira',
        nationality: 'Brasil',
        age: 20,
        speed: 73,
        consistency: 75,
        rain: 74,
        defense: 72,
        salary: 1250000,
        category: 'f1_academy',
      },
      {
        name: 'Rachel Robertson',
        nationality: 'Reino Unido',
        age: 21,
        speed: 70,
        consistency: 72,
        rain: 70,
        defense: 71,
        salary: 900000,
        category: 'f1_academy',
      },
      {
        name: 'Kaylee Countryman',
        nationality: 'Estados Unidos',
        age: 19,
        speed: 70,
        consistency: 71,
        rain: 70,
        defense: 70,
        salary: 850000,
        category: 'f1_academy',
      },
      {
        name: 'Jade Jacquet',
        nationality: 'França',
        age: 19,
        speed: 71,
        consistency: 72,
        rain: 71,
        defense: 70,
        salary: 920000,
        category: 'f1_academy',
      },
      {
        name: 'Alisha Palmowski',
        nationality: 'Reino Unido',
        age: 19,
        speed: 72,
        consistency: 74,
        rain: 73,
        defense: 71,
        salary: 1050000,
        category: 'f1_academy',
      },
      {
        name: 'Ava Dobson',
        nationality: 'Estados Unidos',
        age: 18,
        speed: 70,
        consistency: 72,
        rain: 70,
        defense: 70,
        salary: 880000,
        category: 'f1_academy',
      },
      {
        name: 'Ella Lloyd',
        nationality: 'Reino Unido',
        age: 20,
        speed: 72,
        consistency: 73,
        rain: 72,
        defense: 71,
        salary: 1100000,
        category: 'f1_academy',
      },
      {
        name: 'Esmee Kosterman',
        nationality: 'Holanda',
        age: 20,
        speed: 71,
        consistency: 73,
        rain: 72,
        defense: 70,
        salary: 950000,
        category: 'f1_academy',
      },
      {
        name: 'Natalia Granada',
        nationality: 'Colômbia',
        age: 20,
        speed: 70,
        consistency: 72,
        rain: 71,
        defense: 70,
        salary: 900000,
        category: 'f1_academy',
      },
    ]

    for (const pilot of f1AcademyDrivers) {
      let exists = false
      try {
        app.findFirstRecordByFilter('drivers', `name = "${pilot.name}"`)
        exists = true
      } catch (_) {
        exists = false
      }

      if (!exists) {
        const rec = new Record(driversCol)
        rec.set('name', pilot.name)
        rec.set('nationality', pilot.nationality)
        rec.set('age', pilot.age)
        rec.set('speed', pilot.speed)
        rec.set('consistency', pilot.consistency)
        rec.set('rain', pilot.rain)
        rec.set('defense', pilot.defense)
        rec.set('salary', pilot.salary)
        rec.set('contract_end', 2026)
        rec.set('category', 'f1_academy')
        rec.set('role', null)
        rec.set('morale', 75)
        rec.set('physical_condition', 100)
        rec.set('fatigue', 0)
        rec.set('is_incapacitated', false)
        rec.set('incapacitated_rounds_left', 0)
        rec.set('fp_sessions_completed', 0)
        app.save(rec)
      }
    }
  },
  (app) => {
    // down migration
    const driversCol = app.findCollectionByNameOrId('drivers')
    try {
      const f1aRecords = app.findRecordsByFilter('drivers', 'category = "f1_academy"')
      for (const rec of f1aRecords) {
        app.delete(rec)
      }
    } catch (_) {}
  },
)
