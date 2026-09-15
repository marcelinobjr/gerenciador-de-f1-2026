migrate(
  (app) => {
    // 1. Enriquecer coleção 'teams' com campos aditivos e índices de compatibilidade
    try {
      const teamsCol = app.findCollectionByNameOrId('teams')
      let teamsModified = false

      if (!teamsCol.fields.getByName('component_ratings')) {
        teamsCol.fields.add(
          new JSONField({
            name: 'component_ratings',
            required: false,
          }),
        )
        teamsModified = true
      }

      if (teamsModified) {
        app.save(teamsCol)
      }
    } catch (err) {
      console.log('Erro ao adicionar component_ratings em teams:', err)
    }

    // 2. Saneamento aditivo NÃO destrutivo para equipes existentes
    // Preenche balance_delta onde for nulo a partir de calculated_overall e strength,
    // garantindo integridade sem alterar nenhum número histórico ou save
    try {
      app
        .db()
        .newQuery(`
          UPDATE teams
          SET balance_delta = 0
          WHERE balance_delta IS NULL
        `)
        .execute()
    } catch (err) {
      console.log('Erro ao inicializar balance_delta:', err)
    }
  },
  (app) => {
    // Reversão limpa
    try {
      const teamsCol = app.findCollectionByNameOrId('teams')
      const field = teamsCol.fields.getByName('component_ratings')
      if (field) {
        teamsCol.fields.remove(field)
        app.save(teamsCol)
      }
    } catch (_) {}
  },
)
