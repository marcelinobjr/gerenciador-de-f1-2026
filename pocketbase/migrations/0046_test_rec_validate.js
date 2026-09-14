// Diagnostic & idempotency test for teams collection
migrate(
  (app) => {
    // Idempotent migration - do not throw error
    try {
      const teamsCol = app.findCollectionByNameOrId('teams')
      console.log('[MIGRATION_0046] teams collection loaded successfully:', teamsCol.id)
    } catch (err) {
      console.log('[MIGRATION_0046] Error finding teams collection:', err)
    }
  },
  (app) => {
    // no-op revert
  },
)
