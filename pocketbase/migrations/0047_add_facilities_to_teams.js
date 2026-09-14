/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')

    // 1. factory_level: Fábrica (Nível 1 a 5) — acelera P&D e reduz custo de peças
    if (!teams.fields.getByName('factory_level')) {
      teams.fields.add(
        new NumberField({
          name: 'factory_level',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    // 2. simulator_level: Simulador (Nível 1 a 5) — reduz fadiga física e melhora moral dos pilotos
    if (!teams.fields.getByName('simulator_level')) {
      teams.fields.add(
        new NumberField({
          name: 'simulator_level',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    // 3. pitstop_center_level: Centro de Testes de Pit Stop (Nível 1 a 5) — reduz tempo de parada
    if (!teams.fields.getByName('pitstop_center_level')) {
      teams.fields.add(
        new NumberField({
          name: 'pitstop_center_level',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    // 4. youth_academy_level: Academia de Jovens Pilotos (Nível 1 a 5) — prospecção de talentos no mercado
    if (!teams.fields.getByName('youth_academy_level')) {
      teams.fields.add(
        new NumberField({
          name: 'youth_academy_level',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    app.save(teams)

    // Inicializar os valores herdados do infrastructureRating por equipe
    // Mapeamento baseado no grid-teams-database oficial
    const teamKeyRatingMap = {
      mercedes: 5,
      mclaren: 5,
      ferrari: 5,
      redbull: 5,
      astonmartin: 4,
      audi: 4,
      williams: 3,
      racingbulls: 4,
      haas: 3,
      alpine: 4,
      cadillac: 3,
      porsche: 5,
      honda: 5,
      lamborghini: 4,
      andretti: 4,
      byd: 4,
      penske: 4,
      lotus: 3,
      toyota: 5,
      benetton: 3,
      copersucar: 3,
      alfaromeo: 4,
      alphatauri: 4,
      fittipaldi: 3,
      jordan: 3,
      renault: 4,
      sauber: 4,
      toleman: 3,
    }

    // Atualiza equipes conhecidas pelo team_key
    for (const key of Object.keys(teamKeyRatingMap)) {
      const rating = teamKeyRatingMap[key]
      try {
        app
          .db()
          .newQuery(
            `UPDATE teams SET 
              factory_level = COALESCE(factory_level, {:rating}),
              simulator_level = COALESCE(simulator_level, {:rating}),
              pitstop_center_level = COALESCE(pitstop_center_level, {:rating}),
              youth_academy_level = COALESCE(youth_academy_level, {:rating})
             WHERE team_key = {:key}`,
          )
          .bind({ rating, key })
          .execute()
      } catch (err) {
        console.warn('Erro ao atualizar chave de equipe:', key, err)
      }
    }

    // Para equipes restantes ou personalizadas sem team_key mapeado, usa fallback baseado em strength ou 3
    try {
      app
        .db()
        .newQuery(
          `UPDATE teams SET 
            factory_level = CASE 
              WHEN strength >= 85 THEN 5
              WHEN strength >= 70 THEN 4
              ELSE 3
            END
           WHERE factory_level IS NULL`,
        )
        .execute()

      app
        .db()
        .newQuery(
          `UPDATE teams SET 
            simulator_level = factory_level,
            pitstop_center_level = factory_level,
            youth_academy_level = factory_level
           WHERE simulator_level IS NULL OR pitstop_center_level IS NULL OR youth_academy_level IS NULL`,
        )
        .execute()
    } catch (e) {
      console.warn('Erro ao popular default facilities:', e)
    }
  },
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')
    const fields = [
      'factory_level',
      'simulator_level',
      'pitstop_center_level',
      'youth_academy_level',
    ]
    for (const f of fields) {
      if (teams.fields.getByName(f)) {
        teams.fields.removeByName(f)
      }
    }
    app.save(teams)
  },
)
