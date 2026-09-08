migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const teamsCol = app.findCollectionByNameOrId('teams')
    const seasonsCol = app.findCollectionByNameOrId('seasons')
    const driversCol = app.findCollectionByNameOrId('drivers')
    const sponsorsCol = app.findCollectionByNameOrId('sponsors')
    const partsCol = app.findCollectionByNameOrId('parts')
    const eventsCol = app.findCollectionByNameOrId('events')

    // 1. Seed user: m.blasques@multi.br.com / Skip@Pass
    let userRecord
    try {
      userRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'm.blasques@multi.br.com')
    } catch (_) {
      userRecord = new Record(usersCol)
      userRecord.setEmail('m.blasques@multi.br.com')
      userRecord.setPassword('Skip@Pass')
      userRecord.setVerified(true)
      userRecord.set('name', 'Jogador')
      app.save(userRecord)
    }

    // 2. Seed player team: Escuderia Brasil (#FF3B30)
    let teamRecord
    try {
      teamRecord = app.findFirstRecordByData('teams', 'user_id', userRecord.id)
    } catch (_) {
      teamRecord = new Record(teamsCol)
      teamRecord.set('name', 'Escuderia Brasil')
      teamRecord.set('color', '#FF3B30')
      teamRecord.set('chassis_level', 50)
      teamRecord.set('aero_level', 50)
      teamRecord.set('strategy_level', 50)
      teamRecord.set('budget', 150000000)
      teamRecord.set('engine_supplier', 'Mercedes')
      teamRecord.set('user_id', userRecord.id)
      app.save(teamRecord)
    }

    // 3. Seed season 2026, round 1 of 24
    try {
      app.findFirstRecordByData('seasons', 'team_id', teamRecord.id)
    } catch (_) {
      const seasonRecord = new Record(seasonsCol)
      seasonRecord.set('year', 2026)
      seasonRecord.set('current_round', 1)
      seasonRecord.set('total_rounds', 24)
      seasonRecord.set('team_id', teamRecord.id)
      app.save(seasonRecord)
    }

    // 4. Seed 6 parts for the player's team (all level 5)
    const partNames = [
      'Chassi',
      'Asa dianteira',
      'Asa traseira',
      'Assoalho',
      'Suspensão',
      'Aerodinâmica ativa',
    ]
    for (const pName of partNames) {
      try {
        const existing = app.findRecordsByFilter(
          'parts',
          `team_id = '${teamRecord.id}' && name = '${pName}'`,
          '',
          1,
          0,
        )
        if (existing.length === 0) {
          const part = new Record(partsCol)
          part.set('name', pName)
          part.set('level', 5)
          part.set('team_id', teamRecord.id)
          app.save(part)
        }
      } catch (_) {
        const part = new Record(partsCol)
        part.set('name', pName)
        part.set('level', 5)
        part.set('team_id', teamRecord.id)
        app.save(part)
      }
    }

    // 5. Seed initial sponsor: Banco do Brasil (30M/rodada, sem exigência, ativo)
    try {
      const existingSponsor = app.findRecordsByFilter(
        'sponsors',
        `team_id = '${teamRecord.id}' && name = 'Banco do Brasil'`,
        '',
        1,
        0,
      )
      if (existingSponsor.length === 0) {
        const sp = new Record(sponsorsCol)
        sp.set('name', 'Banco do Brasil')
        sp.set('value_per_round', 30000000)
        sp.set('requirement', 'Sem exigência')
        sp.set('status', 'ativo')
        sp.set('rounds_remaining', 24)
        sp.set('team_id', teamRecord.id)
        app.save(sp)
      }
    } catch (_) {}

    // 6. Seed initial event
    try {
      const existingEvents = app.findRecordsByFilter(
        'events',
        `team_id = '${teamRecord.id}'`,
        '',
        1,
        0,
      )
      if (existingEvents.length === 0) {
        const ev = new Record(eventsCol)
        ev.set('message', 'Sua jornada na temporada 2026 começa!')
        ev.set('type', 'contrato')
        ev.set('team_id', teamRecord.id)
        app.save(ev)
      }
    } catch (_) {}

    // 7. Seed drivers: Bortoleto & Fittipaldi under player's team; others in the free market (team_id null)
    const driversData = [
      // Equipe do jogador
      {
        name: 'Gabriel Bortoleto',
        nationality: 'Brasil',
        age: 21,
        speed: 82,
        consistency: 80,
        rain: 84,
        defense: 76,
        salary: 12000000,
        contract_end: 2027,
        team_id: teamRecord.id,
      },
      {
        name: 'Pietro Fittipaldi',
        nationality: 'Brasil',
        age: 29,
        speed: 78,
        consistency: 76,
        rain: 80,
        defense: 72,
        salary: 8000000,
        contract_end: 2026,
        team_id: teamRecord.id,
      },
      // Mercado
      {
        name: 'Lewis Hamilton',
        nationality: 'Reino Unido',
        age: 41,
        speed: 90,
        consistency: 88,
        rain: 85,
        defense: 82,
        salary: 45000000,
        contract_end: 2026,
        team_id: null,
      },
      {
        name: 'Max Verstappen',
        nationality: 'Holanda',
        age: 28,
        speed: 95,
        consistency: 90,
        rain: 80,
        defense: 88,
        salary: 50000000,
        contract_end: 2028,
        team_id: null,
      },
      {
        name: 'Charles Leclerc',
        nationality: 'Mônaco',
        age: 28,
        speed: 88,
        consistency: 85,
        rain: 80,
        defense: 84,
        salary: 35000000,
        contract_end: 2027,
        team_id: null,
      },
      {
        name: 'Lando Norris',
        nationality: 'Reino Unido',
        age: 26,
        speed: 87,
        consistency: 84,
        rain: 82,
        defense: 80,
        salary: 30000000,
        contract_end: 2027,
        team_id: null,
      },
      {
        name: 'Oscar Piastri',
        nationality: 'Austrália',
        age: 25,
        speed: 86,
        consistency: 86,
        rain: 80,
        defense: 78,
        salary: 28000000,
        contract_end: 2026,
        team_id: null,
      },
      {
        name: 'George Russell',
        nationality: 'Reino Unido',
        age: 28,
        speed: 85,
        consistency: 83,
        rain: 78,
        defense: 82,
        salary: 26000000,
        contract_end: 2026,
        team_id: null,
      },
      {
        name: 'Carlos Sainz',
        nationality: 'Espanha',
        age: 31,
        speed: 84,
        consistency: 82,
        rain: 78,
        defense: 80,
        salary: 24000000,
        contract_end: 2026,
        team_id: null,
      },
      {
        name: 'Fernando Alonso',
        nationality: 'Espanha',
        age: 44,
        speed: 88,
        consistency: 84,
        rain: 90,
        defense: 85,
        salary: 20000000,
        contract_end: 2026,
        team_id: null,
      },
      {
        name: 'Franco Colapinto',
        nationality: 'Argentina',
        age: 23,
        speed: 80,
        consistency: 78,
        rain: 75,
        defense: 74,
        salary: 10000000,
        contract_end: 2026,
        team_id: null,
      },
      {
        name: 'Yuki Tsunoda',
        nationality: 'Japão',
        age: 26,
        speed: 76,
        consistency: 75,
        rain: 70,
        defense: 78,
        salary: 8000000,
        contract_end: 2026,
        team_id: null,
      },
    ]

    for (const d of driversData) {
      try {
        const found = app.findFirstRecordByData('drivers', 'name', d.name)
        // If found and it's player driver, ensure team_id is linked
        if (d.team_id && !found.get('team_id')) {
          found.set('team_id', d.team_id)
          app.save(found)
        }
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
        if (d.team_id) {
          rec.set('team_id', d.team_id)
        }
        app.save(rec)
      }
    }
  },
  (app) => {
    // down: optionally clear seeded records
  },
)
