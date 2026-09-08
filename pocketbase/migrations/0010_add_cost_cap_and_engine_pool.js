migrate(
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')

    // 1. cost_cap_spent: total gasto na temporada com P&D, reparos e motores (limite FIA de 135M)
    if (!teams.fields.getByName('cost_cap_spent')) {
      teams.fields.add(
        new NumberField({
          name: 'cost_cap_spent',
          min: 0,
        }),
      )
    }

    // 2. engine_pool_used: quantidade de motores introduzidos no pool (limite regulamentar FIA: 4)
    if (!teams.fields.getByName('engine_pool_used')) {
      teams.fields.add(
        new NumberField({
          name: 'engine_pool_used',
          min: 1,
          max: 10,
          onlyInt: true,
        }),
      )
    }

    // 3. active_engine_wear: desgaste acumulado do motor em uso atual (0 a 100%)
    if (!teams.fields.getByName('active_engine_wear')) {
      teams.fields.add(
        new NumberField({
          name: 'active_engine_wear',
          min: 0,
          max: 100,
          onlyInt: true,
        }),
      )
    }

    // 4. engine_history: json array registrando as unidades do pool: [{ id: 1, wear: 12, status: 'ativo' }]
    if (!teams.fields.getByName('engine_history')) {
      teams.fields.add(
        new JSONField({
          name: 'engine_history',
          maxSize: 524288,
        }),
      )
    }

    app.save(teams)

    // Inicializar valores padrão para equipes existentes
    try {
      app
        .db()
        .newQuery('UPDATE teams SET cost_cap_spent = 0 WHERE cost_cap_spent IS NULL')
        .execute()
      app
        .db()
        .newQuery('UPDATE teams SET engine_pool_used = 1 WHERE engine_pool_used IS NULL')
        .execute()
      app
        .db()
        .newQuery('UPDATE teams SET active_engine_wear = 0 WHERE active_engine_wear IS NULL')
        .execute()
    } catch (err) {
      console.warn('Erro ao inicializar campos de motor e cost cap:', err)
    }
  },
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')
    if (teams.fields.getByName('cost_cap_spent')) {
      teams.fields.removeByName('cost_cap_spent')
    }
    if (teams.fields.getByName('engine_pool_used')) {
      teams.fields.removeByName('engine_pool_used')
    }
    if (teams.fields.getByName('active_engine_wear')) {
      teams.fields.removeByName('active_engine_wear')
    }
    if (teams.fields.getByName('engine_history')) {
      teams.fields.removeByName('engine_history')
    }
    app.save(teams)
  },
)
