migrate(
  (app) => {
    // 1. Adicionar campo aditivo 'regulation_timeline_state' na collection 'teams'
    const colTeams = app.findCollectionByNameOrId('teams')
    if (!colTeams.fields.getByName('regulation_timeline_state')) {
      colTeams.fields.add(new JSONField({ name: 'regulation_timeline_state' }))
    }
    app.save(colTeams)

    // 2. Adicionar campo aditivo 'technical_era_id' na collection 'season_histories'
    try {
      const colHistories = app.findCollectionByNameOrId('season_histories')
      if (!colHistories.fields.getByName('technical_era_id')) {
        colHistories.fields.add(new TextField({ name: 'technical_era_id' }))
      }
      app.save(colHistories)
    } catch (_) {}

    // 3. Adicionar campo aditivo 'technical_era_id' na collection 'seasons'
    try {
      const colSeasons = app.findCollectionByNameOrId('seasons')
      if (!colSeasons.fields.getByName('technical_era_id')) {
        colSeasons.fields.add(new TextField({ name: 'technical_era_id' }))
      }
      app.save(colSeasons)
    } catch (_) {}
  },
  (app) => {
    try {
      const colTeams = app.findCollectionByNameOrId('teams')
      const f1 = colTeams.fields.getByName('regulation_timeline_state')
      if (f1) colTeams.fields.remove(f1)
      app.save(colTeams)
    } catch (_) {}

    try {
      const colHist = app.findCollectionByNameOrId('season_histories')
      const f2 = colHist.fields.getByName('technical_era_id')
      if (f2) colHist.fields.remove(f2)
      app.save(colHist)
    } catch (_) {}

    try {
      const colSeasons = app.findCollectionByNameOrId('seasons')
      const f3 = colSeasons.fields.getByName('technical_era_id')
      if (f3) colSeasons.fields.remove(f3)
      app.save(colSeasons)
    } catch (_) {}
  },
)
