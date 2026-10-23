migrate(
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')

    // SQLite suporta: CREATE UNIQUE INDEX idx_teams_one_active_per_user ON teams (user_id) WHERE (is_archived IS NOT TRUE AND user_id != '')
    try {
      app
        .db()
        .newQuery(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_one_active_per_user 
      ON teams (user_id) 
      WHERE (is_archived IS NOT 1 AND user_id != '' AND user_id IS NOT NULL)
    `)
        .execute()
      console.log(
        '[MIGRATION_1741500091] Created partial unique index idx_teams_one_active_per_user via SQL',
      )
    } catch (err) {
      console.log('[MIGRATION_1741500091] Notice on idx_teams_one_active_per_user:', err)
    }
  },
  (app) => {
    try {
      app.db().newQuery(`DROP INDEX IF EXISTS idx_teams_one_active_per_user`).execute()
    } catch (err) {}
  },
)
