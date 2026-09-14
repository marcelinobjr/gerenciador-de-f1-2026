/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Atualizar os valores para todas as equipes onde o valor for 0 ou nulo
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

    for (const key of Object.keys(teamKeyRatingMap)) {
      const val = teamKeyRatingMap[key]
      try {
        app
          .db()
          .newQuery(
            `UPDATE teams SET 
              factory_level = {:val},
              simulator_level = {:val},
              pitstop_center_level = {:val},
              youth_academy_level = {:val}
             WHERE team_key = {:key} AND (factory_level = 0 OR factory_level IS NULL)`,
          )
          .bind({ val, key })
          .execute()
      } catch (err) {
        console.warn('Erro ao atualizar chave de equipe 0048:', key, err)
      }
    }

    // Equipes que sobraram (ex: custom ou sem team_key)
    try {
      app
        .db()
        .newQuery(
          `UPDATE teams SET 
            factory_level = CASE 
              WHEN strength >= 85 THEN 5
              WHEN strength >= 70 THEN 4
              ELSE 3
            END,
            simulator_level = CASE 
              WHEN strength >= 85 THEN 5
              WHEN strength >= 70 THEN 4
              ELSE 3
            END,
            pitstop_center_level = CASE 
              WHEN strength >= 85 THEN 5
              WHEN strength >= 70 THEN 4
              ELSE 3
            END,
            youth_academy_level = CASE 
              WHEN strength >= 85 THEN 5
              WHEN strength >= 70 THEN 4
              ELSE 3
            END
           WHERE factory_level = 0 OR factory_level IS NULL`,
        )
        .execute()
    } catch (e) {
      console.warn('Erro ao popular default facilities 0048:', e)
    }
  },
  (app) => {},
)
