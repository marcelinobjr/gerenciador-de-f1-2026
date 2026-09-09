migrate(
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')
    // Garantir que list, view, create e update estejam abertos para usuários autenticados
    // para permitir que o usuário atualize a foto de qualquer equipe do grid
    teamsCol.listRule = "@request.auth.id != ''"
    teamsCol.viewRule = "@request.auth.id != ''"
    teamsCol.createRule = "@request.auth.id != ''"
    teamsCol.updateRule = "@request.auth.id != ''"
    app.save(teamsCol)

    // Também garantir que todas as equipes oficiais tenham seu team_key preenchido caso estejam em branco
    const officialKeyMap = {
      'Mercedes-AMG PETRONAS': 'mercedes',
      'Mercedes-AMG Petronas': 'mercedes',
      'Scuderia Ferrari': 'ferrari',
      'Oracle Red Bull Racing': 'redbull',
      'Red Bull Racing': 'redbull',
      'McLaren F1 Team': 'mclaren',
      'Aston Martin Aramco': 'astonmartin',
      'Alpine F1 Team': 'alpine',
      'Williams Racing': 'williams',
      'Visa Cash App RB': 'racingbulls',
      'Audi F1 Team': 'audi',
      'Haas F1 Team': 'haas',
      'Cadillac F1 Team': 'cadillac',
      'Andretti Global': 'andretti',
    }

    try {
      const records = app.findRecordsByFilter('teams', '1 = 1', '', 100, 0)
      for (const rec of records) {
        const currentKey = rec.getString('team_key')
        const currentName = rec.getString('name')
        if (!currentKey && officialKeyMap[currentName]) {
          rec.set('team_key', officialKeyMap[currentName])
          app.save(rec)
        }
      }
    } catch (_) {}
  },
  (app) => {
    // Revert opcional
  },
)
