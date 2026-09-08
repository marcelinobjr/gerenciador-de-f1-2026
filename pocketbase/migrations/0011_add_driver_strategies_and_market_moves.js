migrate(
  (app) => {
    // 1. Expand session_setups to store driver-specific strategies if needed (json field)
    const sessionSetups = app.findCollectionByNameOrId('session_setups')
    if (!sessionSetups.fields.getByName('driver_strategies')) {
      sessionSetups.fields.add(
        new JSONField({
          name: 'driver_strategies',
        }),
      )
      app.save(sessionSetups)
    }

    // 2. Expand seasons to store silly season / end of season market moves history
    const seasonsCol = app.findCollectionByNameOrId('seasons')
    if (!seasonsCol.fields.getByName('market_moves')) {
      seasonsCol.fields.add(
        new JSONField({
          name: 'market_moves',
        }),
      )
      app.save(seasonsCol)
    }
  },
  (app) => {
    try {
      const sessionSetups = app.findCollectionByNameOrId('session_setups')
      if (sessionSetups.fields.getByName('driver_strategies')) {
        sessionSetups.fields.removeByName('driver_strategies')
        app.save(sessionSetups)
      }
    } catch (_) {}

    try {
      const seasonsCol = app.findCollectionByNameOrId('seasons')
      if (seasonsCol.fields.getByName('market_moves')) {
        seasonsCol.fields.removeByName('market_moves')
        app.save(seasonsCol)
      }
    } catch (_) {}
  },
)
