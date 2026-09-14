/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // ATENÇÃO: Esta seed popula apenas novas carreiras / catálogo base sem mutar saves de usuários existentes!
    // Saves existentes (ex: equipe Audi de m.blasques@multi.br.com) permanecem 100% INTACTOS.

    const driversCol = app.findCollectionByNameOrId('drivers')
    const teamsCol = app.findCollectionByNameOrId('teams')

    // Localizar equipe Cadillac oficial se existir ou registrar
    let cadillacTeam
    try {
      cadillacTeam = app.findFirstRecordByFilter(
        'teams',
        'team_key = "cadillac" || name ~ "Cadillac"',
      )
    } catch (e) {
      cadillacTeam = null
    }

    if (!cadillacTeam) {
      try {
        cadillacTeam = new Record(teamsCol)
        cadillacTeam.set('name', 'Cadillac F1 Team')
        cadillacTeam.set('team_key', 'cadillac')
        cadillacTeam.set('color', '#FFD700')
        cadillacTeam.set('strength', 74)
        cadillacTeam.set('budget', 130000000)
        cadillacTeam.set('engine_supplier', 'Ferrari')
        cadillacTeam.set('chassis_level', 2)
        cadillacTeam.set('aero_level', 2)
        cadillacTeam.set('strategy_level', 2)
        cadillacTeam.set('is_custom', false)
        app.save(cadillacTeam)
      } catch (err) {
        // ignora se já criado concorrentemente
      }
    }

    // Se Cadillac existe, garantir que Sergio Pérez e Valtteri Bottas estão presentes no catálogo base
    if (cadillacTeam) {
      const cadillacPilots = [
        {
          name: 'Sergio Perez',
          nationality: 'México',
          age: 36,
          speed: 88,
          consistency: 86,
          rain: 89,
          defense: 91,
          salary: 14000000,
          contract_end: 2027,
          role: 'titular',
          category: 'f1',
        },
        {
          name: 'Valtteri Bottas',
          nationality: 'Finlândia',
          age: 36,
          speed: 88,
          consistency: 88,
          rain: 86,
          defense: 87,
          salary: 12000000,
          contract_end: 2027,
          role: 'titular',
          category: 'f1',
        },
      ]

      for (const p of cadillacPilots) {
        let existing
        try {
          existing = app.findFirstRecordByFilter(
            'drivers',
            `name ~ "${p.name.split(' ')[1]}" && team_id = "${cadillacTeam.id}"`,
          )
        } catch (err) {
          existing = null
        }

        if (!existing) {
          try {
            const rec = new Record(driversCol)
            rec.set('name', p.name)
            rec.set('nationality', p.nationality)
            rec.set('age', p.age)
            rec.set('speed', p.speed)
            rec.set('consistency', p.consistency)
            rec.set('rain', p.rain)
            rec.set('defense', p.defense)
            rec.set('salary', p.salary)
            rec.set('contract_end', p.contract_end)
            rec.set('role', p.role)
            rec.set('category', p.category)
            rec.set('team_id', cadillacTeam.id)
            app.save(rec)
          } catch (e) {
            // ignora
          }
        }
      }
    }
  },
  (app) => {
    // rollback seguro
  },
)
