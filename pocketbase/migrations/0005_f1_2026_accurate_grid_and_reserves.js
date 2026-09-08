migrate(
  (app) => {
    const driversCol = app.findCollectionByNameOrId('drivers')
    const teamsCol = app.findCollectionByNameOrId('teams')

    // 1. Add fields to 'drivers' collection if not present
    // role: 'titular' | 'reserva'
    if (!driversCol.fields.getByName('role')) {
      driversCol.fields.add(
        new SelectField({
          name: 'role',
          values: ['titular', 'reserva'],
          maxSelect: 1,
        }),
      )
    }

    // category: 'f1' | 'f2' | 'mercado'
    if (!driversCol.fields.getByName('category')) {
      driversCol.fields.add(
        new SelectField({
          name: 'category',
          values: ['f1', 'f2', 'mercado'],
          maxSelect: 1,
        }),
      )
    }

    // fp_sessions_completed: number (0, 1, 2)
    if (!driversCol.fields.getByName('fp_sessions_completed')) {
      driversCol.fields.add(
        new NumberField({
          name: 'fp_sessions_completed',
          min: 0,
          max: 10,
        }),
      )
    }

    // fp_scheduled_rounds: json (ex: [3, 8])
    if (!driversCol.fields.getByName('fp_scheduled_rounds')) {
      driversCol.fields.add(
        new JSONField({
          name: 'fp_scheduled_rounds',
        }),
      )
    }

    // is_incapacitated: bool
    if (!driversCol.fields.getByName('is_incapacitated')) {
      driversCol.fields.add(
        new BoolField({
          name: 'is_incapacitated',
        }),
      )
    }

    // incapacitated_rounds_left: number
    if (!driversCol.fields.getByName('incapacitated_rounds_left')) {
      driversCol.fields.add(
        new NumberField({
          name: 'incapacitated_rounds_left',
          min: 0,
          max: 10,
        }),
      )
    }

    // incapacitated_reason: text
    if (!driversCol.fields.getByName('incapacitated_reason')) {
      driversCol.fields.add(
        new TextField({
          name: 'incapacitated_reason',
        }),
      )
    }

    // reserve_team_id: relation to teams (to which team the reserve belongs)
    if (!driversCol.fields.getByName('reserve_team_id')) {
      driversCol.fields.add(
        new RelationField({
          name: 'reserve_team_id',
          collectionId: teamsCol.id,
          maxSelect: 1,
        }),
      )
    }

    // team_reserve_fp_bonus: bool on teams (indicates that reserve gave setup bonus for next race)
    if (!teamsCol.fields.getByName('reserve_setup_bonus')) {
      teamsCol.fields.add(
        new BoolField({
          name: 'reserve_setup_bonus',
        }),
      )
    }

    app.save(driversCol)
    app.save(teamsCol)

    // 2. Set default values for existing drivers in the DB:
    // Any existing driver with team_id gets role = 'titular', category = 'f1'
    // Any driver without team_id gets role = null, category = 'mercado'
    try {
      app
        .db()
        .newQuery(
          `UPDATE drivers SET role = 'titular', category = 'f1' WHERE team_id IS NOT NULL AND team_id != ''`,
        )
        .execute()
      app
        .db()
        .newQuery(
          `UPDATE drivers SET category = 'mercado' WHERE (team_id IS NULL OR team_id = '') AND (category IS NULL OR category = '')`,
        )
        .execute()
    } catch (_) {}

    // 3. Complete Official 2026 Grid Drivers Seed:
    // Ensure all 22 official starters + 11 official reserves exist in DB.
    // If user has an official team assigned, keep their link; otherwise these drivers are registered with role and category.
    // Notice Gabriel Bortoleto is AUDI'S driver (not default player driver).
    const officialDriversToSeed = [
      // McLaren (Norris, Piastri, Reserve: Pato O'Ward)
      {
        name: 'Lando Norris',
        nationality: 'Reino Unido',
        age: 26,
        speed: 89,
        consistency: 86,
        rain: 84,
        defense: 82,
        salary: 30000000,
        contract_end: 2027,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Oscar Piastri',
        nationality: 'Austrália',
        age: 25,
        speed: 88,
        consistency: 87,
        rain: 82,
        defense: 81,
        salary: 28000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: "Patricio O'Ward",
        nationality: 'México',
        age: 26,
        speed: 81,
        consistency: 80,
        rain: 79,
        defense: 78,
        salary: 5000000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },

      // Ferrari (Hamilton, Leclerc, Reserve: Antonio Giovinazzi)
      {
        name: 'Lewis Hamilton',
        nationality: 'Reino Unido',
        age: 41,
        speed: 91,
        consistency: 88,
        rain: 87,
        defense: 84,
        salary: 45000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Charles Leclerc',
        nationality: 'Mônaco',
        age: 28,
        speed: 90,
        consistency: 85,
        rain: 82,
        defense: 84,
        salary: 35000000,
        contract_end: 2027,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Antonio Giovinazzi',
        nationality: 'Itália',
        age: 32,
        speed: 79,
        consistency: 81,
        rain: 78,
        defense: 79,
        salary: 4500000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },

      // Red Bull (Verstappen, Hadjar, Reserve: Ayumu Iwasa)
      {
        name: 'Max Verstappen',
        nationality: 'Holanda',
        age: 28,
        speed: 95,
        consistency: 91,
        rain: 88,
        defense: 90,
        salary: 50000000,
        contract_end: 2028,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Isack Hadjar',
        nationality: 'França',
        age: 21,
        speed: 82,
        consistency: 79,
        rain: 78,
        defense: 76,
        salary: 5000000,
        contract_end: 2027,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Ayumu Iwasa',
        nationality: 'Japão',
        age: 24,
        speed: 79,
        consistency: 78,
        rain: 77,
        defense: 76,
        salary: 3500000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },

      // Mercedes (Russell, Antonelli, Reserve: Frederik Vesti)
      {
        name: 'George Russell',
        nationality: 'Reino Unido',
        age: 28,
        speed: 87,
        consistency: 86,
        rain: 82,
        defense: 84,
        salary: 26000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Andrea Kimi Antonelli',
        nationality: 'Itália',
        age: 19,
        speed: 85,
        consistency: 80,
        rain: 79,
        defense: 78,
        salary: 9000000,
        contract_end: 2027,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Frederik Vesti',
        nationality: 'Dinamarca',
        age: 24,
        speed: 79,
        consistency: 80,
        rain: 78,
        defense: 77,
        salary: 4000000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },

      // Aston Martin (Alonso, Stroll, Reserve: Felipe Drugovich)
      {
        name: 'Fernando Alonso',
        nationality: 'Espanha',
        age: 44,
        speed: 88,
        consistency: 86,
        rain: 90,
        defense: 87,
        salary: 20000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Lance Stroll',
        nationality: 'Canadá',
        age: 27,
        speed: 78,
        consistency: 76,
        rain: 81,
        defense: 76,
        salary: 10000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Felipe Drugovich',
        nationality: 'Brasil',
        age: 25,
        speed: 81,
        consistency: 82,
        rain: 83,
        defense: 78,
        salary: 5000000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },

      // Williams (Albon, Sainz, Reserve: Luke Browning)
      {
        name: 'Carlos Sainz',
        nationality: 'Espanha',
        age: 31,
        speed: 86,
        consistency: 85,
        rain: 81,
        defense: 83,
        salary: 24000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Alexander Albon',
        nationality: 'Tailândia',
        age: 29,
        speed: 84,
        consistency: 83,
        rain: 79,
        defense: 81,
        salary: 14000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Luke Browning',
        nationality: 'Reino Unido',
        age: 24,
        speed: 78,
        consistency: 77,
        rain: 76,
        defense: 75,
        salary: 3200000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },

      // Racing Bulls (Lawson, Lindblad, Reserve: Jak Crawford)
      {
        name: 'Liam Lawson',
        nationality: 'Nova Zelândia',
        age: 24,
        speed: 82,
        consistency: 80,
        rain: 78,
        defense: 80,
        salary: 8000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Arvid Lindblad',
        nationality: 'Reino Unido',
        age: 18,
        speed: 81,
        consistency: 78,
        rain: 77,
        defense: 75,
        salary: 4000000,
        contract_end: 2027,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Jak Crawford',
        nationality: 'Estados Unidos',
        age: 20,
        speed: 78,
        consistency: 77,
        rain: 75,
        defense: 76,
        salary: 3000000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },

      // Alpine (Gasly, Colapinto, Reserve: Paul Aron)
      {
        name: 'Pierre Gasly',
        nationality: 'França',
        age: 30,
        speed: 83,
        consistency: 82,
        rain: 81,
        defense: 81,
        salary: 15000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Franco Colapinto',
        nationality: 'Argentina',
        age: 23,
        speed: 82,
        consistency: 79,
        rain: 77,
        defense: 77,
        salary: 8000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Paul Aron',
        nationality: 'Estônia',
        age: 22,
        speed: 78,
        consistency: 77,
        rain: 75,
        defense: 74,
        salary: 3500000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },

      // Haas (Ocon, Bearman, Reserve: Ryo Hirakawa)
      {
        name: 'Esteban Ocon',
        nationality: 'França',
        age: 29,
        speed: 83,
        consistency: 82,
        rain: 83,
        defense: 84,
        salary: 12000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Oliver Bearman',
        nationality: 'Reino Unido',
        age: 20,
        speed: 81,
        consistency: 79,
        rain: 78,
        defense: 78,
        salary: 6000000,
        contract_end: 2027,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Ryo Hirakawa',
        nationality: 'Japão',
        age: 32,
        speed: 78,
        consistency: 79,
        rain: 77,
        defense: 77,
        salary: 3500000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },

      // Audi (Hülkenberg, Bortoleto, Reserve: Zane Maloney)
      {
        name: 'Nico Hülkenberg',
        nationality: 'Alemanha',
        age: 38,
        speed: 83,
        consistency: 84,
        rain: 82,
        defense: 82,
        salary: 10000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Gabriel Bortoleto',
        nationality: 'Brasil',
        age: 21,
        speed: 83,
        consistency: 81,
        rain: 83,
        defense: 79,
        salary: 7000000,
        contract_end: 2027,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Zane Maloney',
        nationality: 'Barbados',
        age: 22,
        speed: 78,
        consistency: 77,
        rain: 77,
        defense: 76,
        salary: 3500000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },

      // Cadillac (Pérez, Bottas, Reserve: Zhou Guanyu)
      {
        name: 'Sergio Pérez',
        nationality: 'México',
        age: 36,
        speed: 82,
        consistency: 83,
        rain: 80,
        defense: 83,
        salary: 14000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Valtteri Bottas',
        nationality: 'Finlândia',
        age: 36,
        speed: 82,
        consistency: 84,
        rain: 80,
        defense: 81,
        salary: 13000000,
        contract_end: 2026,
        role: 'titular',
        category: 'f1',
      },
      {
        name: 'Zhou Guanyu',
        nationality: 'China',
        age: 26,
        speed: 79,
        consistency: 80,
        rain: 77,
        defense: 78,
        salary: 5000000,
        contract_end: 2026,
        role: 'reserva',
        category: 'f1',
      },
    ]

    for (const d of officialDriversToSeed) {
      try {
        const found = app.findFirstRecordByData('drivers', 'name', d.name)
        // Update attributes & category/role if present
        found.set('speed', d.speed)
        found.set('consistency', d.consistency)
        found.set('rain', d.rain)
        found.set('defense', d.defense)
        found.set('salary', d.salary)
        found.set('contract_end', d.contract_end)
        found.set('nationality', d.nationality)
        found.set('age', d.age)
        found.set('category', d.category)
        if (!found.get('role')) {
          found.set('role', d.role)
        }
        app.save(found)
      } catch (_) {
        const rec = new Record(driversCol)
        rec.set('name', d.name)
        rec.set('nationality', d.nationality)
        rec.set('age', d.age)
        rec.set('speed', d.speed)
        rec.set('consistency', d.consistency)
        rec.set('rain', d.rain)
        rec.set('defense', d.defense)
        rec.set('salary', d.salary)
        rec.set('contract_end', d.contract_end)
        rec.set('role', d.role)
        rec.set('category', d.category)
        app.save(rec)
      }
    }

    // 4. Seed Current F2 Grid Drivers (available on market)
    const f2DriversData = [
      {
        name: 'Rafael Câmara',
        nationality: 'Brasil',
        age: 20,
        speed: 80,
        consistency: 79,
        rain: 81,
        defense: 78,
        salary: 4000000,
        contract_end: 2026,
      },
      {
        name: 'Joshua Dürksen',
        nationality: 'Paraguai',
        age: 22,
        speed: 78,
        consistency: 76,
        rain: 77,
        defense: 76,
        salary: 3500000,
        contract_end: 2026,
      },
      {
        name: 'Leonardo Fornaroli',
        nationality: 'Itália',
        age: 21,
        speed: 79,
        consistency: 80,
        rain: 78,
        defense: 77,
        salary: 3800000,
        contract_end: 2026,
      },
      {
        name: 'Dino Beganovic',
        nationality: 'Suécia',
        age: 22,
        speed: 79,
        consistency: 78,
        rain: 79,
        defense: 76,
        salary: 3600000,
        contract_end: 2026,
      },
      {
        name: 'Gabriele Minì',
        nationality: 'Itália',
        age: 20,
        speed: 79,
        consistency: 78,
        rain: 77,
        defense: 77,
        salary: 3700000,
        contract_end: 2026,
      },
      {
        name: 'Oliver Goethe',
        nationality: 'Alemanha',
        age: 21,
        speed: 78,
        consistency: 76,
        rain: 76,
        defense: 75,
        salary: 3200000,
        contract_end: 2026,
      },
      {
        name: 'Sebastián Montoya',
        nationality: 'Colômbia',
        age: 20,
        speed: 78,
        consistency: 74,
        rain: 76,
        defense: 79,
        salary: 3200000,
        contract_end: 2026,
      },
      {
        name: 'Kush Maini',
        nationality: 'Índia',
        age: 25,
        speed: 77,
        consistency: 77,
        rain: 75,
        defense: 76,
        salary: 3500000,
        contract_end: 2026,
      },
      {
        name: 'Ritomo Miyata',
        nationality: 'Japão',
        age: 26,
        speed: 78,
        consistency: 79,
        rain: 77,
        defense: 77,
        salary: 3600000,
        contract_end: 2026,
      },
      {
        name: 'Rafael Villagómez',
        nationality: 'México',
        age: 24,
        speed: 75,
        consistency: 74,
        rain: 73,
        defense: 74,
        salary: 2800000,
        contract_end: 2026,
      },
      {
        name: 'Alex Dunne',
        nationality: 'Irlanda',
        age: 20,
        speed: 79,
        consistency: 77,
        rain: 76,
        defense: 76,
        salary: 3400000,
        contract_end: 2026,
      },
      {
        name: 'Martinius Stenshorne',
        nationality: 'Noruega',
        age: 20,
        speed: 78,
        consistency: 76,
        rain: 77,
        defense: 75,
        salary: 3200000,
        contract_end: 2026,
      },
      {
        name: 'Roman Bilinski',
        nationality: 'Polônia',
        age: 21,
        speed: 76,
        consistency: 75,
        rain: 74,
        defense: 74,
        salary: 2800000,
        contract_end: 2026,
      },
      {
        name: 'Mari Boya',
        nationality: 'Espanha',
        age: 21,
        speed: 77,
        consistency: 75,
        rain: 76,
        defense: 75,
        salary: 3000000,
        contract_end: 2026,
      },
      {
        name: 'Nikola Tsolov',
        nationality: 'Bulgária',
        age: 19,
        speed: 78,
        consistency: 75,
        rain: 75,
        defense: 74,
        salary: 3000000,
        contract_end: 2026,
      },
      {
        name: 'Noel León',
        nationality: 'México',
        age: 21,
        speed: 76,
        consistency: 75,
        rain: 74,
        defense: 75,
        salary: 2800000,
        contract_end: 2026,
      },
      {
        name: 'Emerson Fittipaldi Jr.',
        nationality: 'Brasil',
        age: 19,
        speed: 77,
        consistency: 75,
        rain: 76,
        defense: 75,
        salary: 3000000,
        contract_end: 2026,
      },
      {
        name: 'Victor Martins',
        nationality: 'França',
        age: 24,
        speed: 80,
        consistency: 78,
        rain: 77,
        defense: 79,
        salary: 4200000,
        contract_end: 2026,
      },
      {
        name: 'Richard Verschoor',
        nationality: 'Holanda',
        age: 25,
        speed: 78,
        consistency: 79,
        rain: 78,
        defense: 78,
        salary: 3800000,
        contract_end: 2026,
      },
      {
        name: 'Josep María Martí',
        nationality: 'Espanha',
        age: 20,
        speed: 78,
        consistency: 76,
        rain: 76,
        defense: 76,
        salary: 3200000,
        contract_end: 2026,
      },
      {
        name: 'Sami Meguetounif',
        nationality: 'França',
        age: 21,
        speed: 76,
        consistency: 75,
        rain: 75,
        defense: 74,
        salary: 2800000,
        contract_end: 2026,
      },
      {
        name: 'Roman Staněk',
        nationality: 'República Tcheca',
        age: 22,
        speed: 76,
        consistency: 76,
        rain: 75,
        defense: 75,
        salary: 2900000,
        contract_end: 2026,
      },
      {
        name: 'Amaury Cordeel',
        nationality: 'Bélgica',
        age: 23,
        speed: 74,
        consistency: 73,
        rain: 72,
        defense: 75,
        salary: 2500000,
        contract_end: 2026,
      },
    ]

    for (const d of f2DriversData) {
      try {
        const found = app.findFirstRecordByData('drivers', 'name', d.name)
        found.set('category', 'f2')
        found.set('speed', d.speed)
        found.set('consistency', d.consistency)
        found.set('rain', d.rain)
        found.set('defense', d.defense)
        found.set('salary', d.salary)
        found.set('nationality', d.nationality)
        found.set('age', d.age)
        app.save(found)
      } catch (_) {
        const rec = new Record(driversCol)
        rec.set('name', d.name)
        rec.set('nationality', d.nationality)
        rec.set('age', d.age)
        rec.set('speed', d.speed)
        rec.set('consistency', d.consistency)
        rec.set('rain', d.rain)
        rec.set('defense', d.defense)
        rec.set('salary', d.salary)
        rec.set('contract_end', d.contract_end)
        rec.set('role', null)
        rec.set('category', 'f2')
        app.save(rec)
      }
    }

    // 5. Seed Established Free Market Drivers (available on market)
    const marketDriversData = [
      {
        name: 'Yuki Tsunoda',
        nationality: 'Japão',
        age: 26,
        speed: 82,
        consistency: 80,
        rain: 78,
        defense: 81,
        salary: 8000000,
        contract_end: 2026,
      },
      {
        name: 'Daniel Ricciardo',
        nationality: 'Austrália',
        age: 36,
        speed: 80,
        consistency: 82,
        rain: 80,
        defense: 82,
        salary: 9000000,
        contract_end: 2026,
      },
      {
        name: 'Mick Schumacher',
        nationality: 'Alemanha',
        age: 26,
        speed: 78,
        consistency: 76,
        rain: 79,
        defense: 75,
        salary: 6500000,
        contract_end: 2026,
      },
      {
        name: 'Kevin Magnussen',
        nationality: 'Dinamarca',
        age: 33,
        speed: 79,
        consistency: 76,
        rain: 77,
        defense: 83,
        salary: 8500000,
        contract_end: 2026,
      },
      {
        name: 'Pietro Fittipaldi',
        nationality: 'Brasil',
        age: 29,
        speed: 78,
        consistency: 78,
        rain: 81,
        defense: 75,
        salary: 6000000,
        contract_end: 2026,
      },
      {
        name: 'Oliver Rowland',
        nationality: 'Reino Unido',
        age: 33,
        speed: 78,
        consistency: 76,
        rain: 80,
        defense: 78,
        salary: 5500000,
        contract_end: 2026,
      },
      {
        name: 'Theo Pourchaire',
        nationality: 'França',
        age: 22,
        speed: 79,
        consistency: 77,
        rain: 76,
        defense: 76,
        salary: 5000000,
        contract_end: 2026,
      },
      {
        name: 'Jack Doohan',
        nationality: 'Austrália',
        age: 23,
        speed: 78,
        consistency: 76,
        rain: 75,
        defense: 75,
        salary: 4500000,
        contract_end: 2026,
      },
    ]

    for (const d of marketDriversData) {
      try {
        const found = app.findFirstRecordByData('drivers', 'name', d.name)
        found.set('category', 'mercado')
        found.set('speed', d.speed)
        found.set('consistency', d.consistency)
        found.set('rain', d.rain)
        found.set('defense', d.defense)
        found.set('salary', d.salary)
        found.set('nationality', d.nationality)
        found.set('age', d.age)
        app.save(found)
      } catch (_) {
        const rec = new Record(driversCol)
        rec.set('name', d.name)
        rec.set('nationality', d.nationality)
        rec.set('age', d.age)
        rec.set('speed', d.speed)
        rec.set('consistency', d.consistency)
        rec.set('rain', d.rain)
        rec.set('defense', d.defense)
        rec.set('salary', d.salary)
        rec.set('contract_end', d.contract_end)
        rec.set('role', null)
        rec.set('category', 'mercado')
        app.save(rec)
      }
    }
  },
  (app) => {
    // down migration
  },
)
