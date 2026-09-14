/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // SEED IDEMPOTENTE E 100% SEGURA DO UNIVERSO MBJ
    // Regra pétrea: Save existente (ex: m.blasques@multi.br.com / Audi) permanece 100% INTACTO.
    // Nenhuma mutation sobre pilotos com team_id de usuário ou equipes de usuário.
    // Apenas insere equipes MBJ que ainda não existam no catálogo geral
    // e cadastra pilotos do universo MBJ (WEC, IndyCar, Fórmula E, F2, Clássicas) sem alterar vínculos existentes.

    const teamsCol = app.findCollectionByNameOrId('teams')
    const driversCol = app.findCollectionByNameOrId('drivers')

    // 28 Equipes Estruturadas do Universo MBJ (src/lib/grid-teams-database.ts)
    const mbjTeams = [
      {
        key: 'mercedes',
        name: 'Mercedes-AMG Petronas',
        color: '#27F4D2',
        engine: 'Mercedes',
        strength: 86,
        budget: 150000000,
      },
      {
        key: 'mclaren',
        name: 'McLaren F1 Team',
        color: '#FF8000',
        engine: 'Mercedes',
        strength: 92,
        budget: 150000000,
      },
      {
        key: 'ferrari',
        name: 'Scuderia Ferrari',
        color: '#E8002D',
        engine: 'Ferrari',
        strength: 88,
        budget: 150000000,
      },
      {
        key: 'redbull',
        name: 'Oracle Red Bull Racing',
        color: '#1E41FF',
        engine: 'Ford',
        strength: 87,
        budget: 150000000,
      },
      {
        key: 'astonmartin',
        name: 'Aston Martin Aramco',
        color: '#229971',
        engine: 'Honda',
        strength: 80,
        budget: 150000000,
      },
      {
        key: 'audi',
        name: 'Audi F1 Team',
        color: '#FF2A00',
        engine: 'Audi',
        strength: 70,
        budget: 150000000,
      },
      {
        key: 'williams',
        name: 'Williams Racing',
        color: '#64C4FF',
        engine: 'Mercedes',
        strength: 77,
        budget: 150000000,
      },
      {
        key: 'racingbulls',
        name: 'Visa Cash App RB',
        color: '#6692FF',
        engine: 'Ford',
        strength: 73,
        budget: 150000000,
      },
      {
        key: 'haas',
        name: 'Haas F1 Team',
        color: '#B6BABD',
        engine: 'Ferrari',
        strength: 71,
        budget: 150000000,
      },
      {
        key: 'alpine',
        name: 'Alpine F1 Team',
        color: '#0093CC',
        engine: 'Mercedes',
        strength: 72,
        budget: 150000000,
      },
      {
        key: 'cadillac',
        name: 'Cadillac F1 Team',
        color: '#D4AF37',
        engine: 'Ferrari',
        strength: 67,
        budget: 150000000,
      },
      {
        key: 'porsche',
        name: 'Porsche Motorsport',
        color: '#C4001A',
        engine: 'Audi',
        strength: 58,
        budget: 175000000,
      },
      {
        key: 'honda',
        name: 'Honda HRC F1 Team',
        color: '#DC0000',
        engine: 'Honda',
        strength: 60,
        budget: 170000000,
      },
      {
        key: 'lamborghini',
        name: 'Lamborghini Squadra Corse',
        color: '#D4AF37',
        engine: 'Audi',
        strength: 55,
        budget: 160000000,
      },
      {
        key: 'andretti',
        name: 'Andretti Global',
        color: '#002B49',
        engine: 'Honda',
        strength: 65,
        budget: 135000000,
      },
      {
        key: 'byd',
        name: 'BYD Formula E-Tech',
        color: '#0062A8',
        engine: 'Mercedes',
        strength: 45,
        budget: 160000000,
      },
      {
        key: 'penske',
        name: 'Team Penske F1',
        color: '#E01E26',
        engine: 'Ford',
        strength: 50,
        budget: 155000000,
      },
      {
        key: 'lotus',
        name: 'Team Lotus Classic',
        color: '#004225',
        engine: 'Mercedes',
        strength: 46,
        budget: 145000000,
      },
      {
        key: 'toyota',
        name: 'Toyota Gazoo Racing F1',
        color: '#EB0A1E',
        engine: 'Mercedes',
        strength: 62,
        budget: 180000000,
      },
      {
        key: 'benetton',
        name: 'Benetton Formula',
        color: '#00A859',
        engine: 'Ford',
        strength: 49,
        budget: 145000000,
      },
      {
        key: 'copersucar',
        name: 'Copersucar Fittipaldi',
        color: '#FED100',
        engine: 'Ford',
        strength: 44,
        budget: 138000000,
      },
      {
        key: 'alfaromeo',
        name: 'Alfa Romeo F1 Team',
        color: '#900000',
        engine: 'Ferrari',
        strength: 47,
        budget: 142000000,
      },
      {
        key: 'alphatauri',
        name: 'Scuderia AlphaTauri',
        color: '#00293F',
        engine: 'Ford',
        strength: 51,
        budget: 150000000,
      },
      {
        key: 'fittipaldi',
        name: 'Fittipaldi Racing Team',
        color: '#008744',
        engine: 'Ferrari',
        strength: 43,
        budget: 135000000,
      },
      {
        key: 'jordan',
        name: 'Jordan Grand Prix',
        color: '#FFD700',
        engine: 'Honda',
        strength: 48,
        budget: 140000000,
      },
      {
        key: 'renault',
        name: 'Renault F1 Team',
        color: '#FFF500',
        engine: 'Mercedes',
        strength: 53,
        budget: 155000000,
      },
      {
        key: 'sauber',
        name: 'Sauber Motorsport',
        color: '#00E700',
        engine: 'Ferrari',
        strength: 41,
        budget: 140000000,
      },
      {
        key: 'toleman',
        name: 'Toleman Motorsport',
        color: '#003399',
        engine: 'Ferrari',
        strength: 40,
        budget: 135000000,
      },
    ]

    // Garantir registro no catálogo de equipes que ainda não existem (sem user_id para catálogo neutro)
    for (const t of mbjTeams) {
      let existingTeam
      try {
        existingTeam = app.findFirstRecordByFilter(
          'teams',
          `team_key = "${t.key}" && (user_id = null || user_id = "")`,
        )
      } catch (_) {
        existingTeam = null
      }

      if (!existingTeam) {
        try {
          const rec = new Record(teamsCol)
          rec.set('name', t.name)
          rec.set('team_key', t.key)
          rec.set('color', t.color)
          rec.set('strength', t.strength)
          rec.set('budget', t.budget)
          rec.set('engine_supplier', t.engine)
          rec.set('chassis_level', Math.round(t.strength * 0.8))
          rec.set('aero_level', Math.round(t.strength * 0.8))
          rec.set('strategy_level', Math.round(t.strength * 0.8))
          rec.set('is_custom', false)
          app.save(rec)
        } catch (err) {
          // Ignora se conflito
        }
      }
    }

    // Pilotos do Universo MBJ para catalogação completa nos 3 grupos:
    // V = Valores Exatos (nome, nacionalidade, idade, categoria, salário, contrato)
    // P = Faixas/Projeções (potencial, elegibilidade)
    // O = Operacionais/Simulação (speed, consistency, rain, defense, physical_condition, morale)
    const mbjPilotsSeed = [
      // Endurance / WEC & Prótotipos
      {
        name: 'Kévin Estre',
        nationality: 'França',
        age: 37,
        category: 'prototipos',
        speed: 79,
        consistency: 81,
        rain: 83,
        defense: 79,
        salary: 4000000,
        contract_end: 2026,
      },
      {
        name: 'Kamui Kobayashi',
        nationality: 'Japão',
        age: 39,
        category: 'prototipos',
        speed: 80,
        consistency: 82,
        rain: 84,
        defense: 81,
        salary: 6000000,
        contract_end: 2026,
      },
      {
        name: 'Mirko Bortolotti',
        nationality: 'Itália',
        age: 36,
        category: 'prototipos',
        speed: 79,
        consistency: 80,
        rain: 81,
        defense: 80,
        salary: 5000000,
        contract_end: 2026,
      },
      {
        name: 'Matteo Cairoli',
        nationality: 'Itália',
        age: 29,
        category: 'prototipos',
        speed: 76,
        consistency: 77,
        rain: 77,
        defense: 76,
        salary: 3000000,
        contract_end: 2026,
      },
      {
        name: 'Sebastien Buemi',
        nationality: 'Suíça',
        age: 37,
        category: 'prototipos',
        speed: 79,
        consistency: 82,
        rain: 83,
        defense: 80,
        salary: 4000000,
        contract_end: 2026,
      },
      {
        name: 'Alessandro Pier Guidi',
        nationality: 'Itália',
        age: 42,
        category: 'prototipos',
        speed: 79,
        consistency: 84,
        rain: 82,
        defense: 81,
        salary: 5500000,
        contract_end: 2026,
      },
      {
        name: 'Robert Kubica',
        nationality: 'Polônia',
        age: 41,
        category: 'prototipos',
        speed: 80,
        consistency: 83,
        rain: 84,
        defense: 82,
        salary: 6000000,
        contract_end: 2026,
      },

      // IndyCar
      {
        name: 'Colton Herta',
        nationality: 'Estados Unidos',
        age: 25,
        category: 'indycar',
        speed: 80,
        consistency: 77,
        rain: 78,
        defense: 78,
        salary: 8000000,
        contract_end: 2026,
      },
      {
        name: 'Josef Newgarden',
        nationality: 'Estados Unidos',
        age: 35,
        category: 'indycar',
        speed: 81,
        consistency: 83,
        rain: 78,
        defense: 82,
        salary: 8000000,
        contract_end: 2026,
      },
      {
        name: 'Will Power',
        nationality: 'Austrália',
        age: 44,
        category: 'indycar',
        speed: 80,
        consistency: 79,
        rain: 78,
        defense: 81,
        salary: 4000000,
        contract_end: 2026,
      },
      {
        name: 'Scott Dixon',
        nationality: 'Nova Zelândia',
        age: 45,
        category: 'indycar',
        speed: 81,
        consistency: 88,
        rain: 84,
        defense: 85,
        salary: 7000000,
        contract_end: 2026,
      },
      {
        name: 'Alexander Rossi',
        nationality: 'Estados Unidos',
        age: 34,
        category: 'indycar',
        speed: 79,
        consistency: 80,
        rain: 80,
        defense: 80,
        salary: 6000000,
        contract_end: 2026,
      },
      {
        name: 'Marcus Ericsson',
        nationality: 'Suécia',
        age: 35,
        category: 'indycar',
        speed: 77,
        consistency: 79,
        rain: 78,
        defense: 78,
        salary: 3000000,
        contract_end: 2026,
      },
      {
        name: 'Tony Kanaan',
        nationality: 'Brasil',
        age: 51,
        category: 'indycar',
        speed: 79,
        consistency: 82,
        rain: 80,
        defense: 83,
        salary: 2000000,
        contract_end: 2026,
      },
      {
        name: 'Helio Castroneves',
        nationality: 'Brasil',
        age: 50,
        category: 'indycar',
        speed: 78,
        consistency: 83,
        rain: 80,
        defense: 82,
        salary: 2000000,
        contract_end: 2026,
      },

      // Fórmula E
      {
        name: 'Pascal Wehrlein',
        nationality: 'Alemanha',
        age: 31,
        category: 'formula_e',
        speed: 82,
        consistency: 82,
        rain: 80,
        defense: 81,
        salary: 8000000,
        contract_end: 2026,
      },
      {
        name: 'Jake Dennis',
        nationality: 'Reino Unido',
        age: 30,
        category: 'formula_e',
        speed: 78,
        consistency: 79,
        rain: 78,
        defense: 78,
        salary: 3000000,
        contract_end: 2026,
      },
      {
        name: 'Lucas di Grassi',
        nationality: 'Brasil',
        age: 41,
        category: 'formula_e',
        speed: 80,
        consistency: 83,
        rain: 82,
        defense: 81,
        salary: 4500000,
        contract_end: 2026,
      },

      // Prospectos Jovens & Talentos de Formação (F2 / F3 / Academia)
      {
        name: 'Caio Collet',
        nationality: 'Brasil',
        age: 23,
        category: 'indynxt',
        speed: 78,
        consistency: 77,
        rain: 79,
        defense: 77,
        salary: 3000000,
        contract_end: 2026,
      },
      {
        name: 'Nelson Piquet Jr',
        nationality: 'Brasil',
        age: 40,
        category: 'prototipos',
        speed: 78,
        consistency: 80,
        rain: 80,
        defense: 80,
        salary: 3500000,
        contract_end: 2026,
      },
      {
        name: 'Rubens Barrichello',
        nationality: 'Brasil',
        age: 53,
        category: 'mercado',
        speed: 78,
        consistency: 85,
        rain: 85,
        defense: 81,
        salary: 3000000,
        contract_end: 2026,
      },
      {
        name: 'Sebastián Montoya',
        nationality: 'Colômbia',
        age: 20,
        category: 'f2',
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
        category: 'f2',
        speed: 77,
        consistency: 77,
        rain: 75,
        defense: 76,
        salary: 3500000,
        contract_end: 2026,
      },
      {
        name: 'Martinius Stenshorne',
        nationality: 'Noruega',
        age: 20,
        category: 'f2',
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
        category: 'f2',
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
        category: 'f2',
        speed: 77,
        consistency: 75,
        rain: 76,
        defense: 75,
        salary: 3000000,
        contract_end: 2026,
      },
      {
        name: 'Noel León',
        nationality: 'México',
        age: 21,
        category: 'f2',
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
        category: 'f2',
        speed: 77,
        consistency: 75,
        rain: 76,
        defense: 75,
        salary: 3000000,
        contract_end: 2026,
      },
      {
        name: 'Sami Meguetounif',
        nationality: 'França',
        age: 21,
        category: 'f2',
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
        category: 'f2',
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
        category: 'f2',
        speed: 74,
        consistency: 73,
        rain: 72,
        defense: 75,
        salary: 2500000,
        contract_end: 2026,
      },
    ]

    // Inserção estritamente idempotente de pilotos
    for (const p of mbjPilotsSeed) {
      let existing
      try {
        existing = app.findFirstRecordByFilter('drivers', `name = "${p.name}"`)
      } catch (_) {
        existing = null
      }

      if (!existing) {
        try {
          const rec = new Record(driversCol)
          rec.set('name', p.name)
          rec.set('nationality', p.nationality)
          rec.set('age', p.age)
          rec.set('category', p.category)
          rec.set('speed', p.speed)
          rec.set('consistency', p.consistency)
          rec.set('rain', p.rain)
          rec.set('defense', p.defense)
          rec.set('salary', p.salary)
          rec.set('contract_end', p.contract_end)
          rec.set('morale', 75)
          rec.set('physical_condition', 100)
          rec.set('fatigue', 0)
          rec.set('is_incapacitated', false)
          rec.set('incapacitated_rounds_left', 0)
          app.save(rec)
        } catch (e) {
          // Ignora se concorrente ou restrição
        }
      }
    }
  },
  (app) => {
    // rollback seguro
  },
)
