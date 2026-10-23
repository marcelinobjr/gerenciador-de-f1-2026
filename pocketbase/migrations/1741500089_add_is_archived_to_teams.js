migrate(
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')
    if (!teamsCol.fields.getByName('is_archived')) {
      teamsCol.fields.add(
        new BoolField({
          name: 'is_archived',
          required: false,
        }),
      )
      app.save(teamsCol)
    }
    // Adicionar índice para consultas de equipe ativa por user_id e is_archived
    try {
      teamsCol.addIndex('idx_teams_user_archived', false, 'user_id, is_archived', '')
      app.save(teamsCol)
    } catch (e) {
      console.log('Index idx_teams_user_archived already exists or skipped: ' + e)
    }
  },
  (app) => {
    const teamsCol = app.findCollectionByNameOrId('teams')
    try {
      teamsCol.removeIndex('idx_teams_user_archived')
    } catch (e) {}
    const field = teamsCol.fields.getByName('is_archived')
    if (field) {
      teamsCol.fields.removeByName('is_archived')
      app.save(teamsCol)
    }
  },
)
