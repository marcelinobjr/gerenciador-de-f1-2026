migrate(
  (app) => {
    const sessionSetups = app.findCollectionByNameOrId('session_setups')
    const sessionField = sessionSetups.fields.getByName('session')
    if (sessionField) {
      sessionField.values = ['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race']
      sessionField.maxSelect = 1
      app.save(sessionSetups)
    }
  },
  (app) => {
    try {
      const sessionSetups = app.findCollectionByNameOrId('session_setups')
      const sessionField = sessionSetups.fields.getByName('session')
      if (sessionField) {
        sessionField.values = ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race']
        sessionField.maxSelect = 1
        app.save(sessionSetups)
      }
    } catch (_) {}
  },
)
