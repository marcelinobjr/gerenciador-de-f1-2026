migrate(
  (app) => {
    // MICRO-PATCH FIA-ENTRY-01: NORMALIZAÇÃO GLOBAL DE SUPERLICENÇA 2026 (Idempotente)
    // Critério Canônico:
    // Pilotos com vínculo canônico titular de equipe F1 2026 (role = 'titular' e category = 'f1')
    // recebem license_status = 'nivel_a', homologation_status = 'elegivel',
    // superlicense_points = MAX(superlicense_points, 40).
    //
    // PROTEÇÃO: academia, development, procedurais e reservas sem superlicença permanecem em 'nivel_c'/'nivel_b'.
    // Vínculo com equipe NÃO concede Licença A se não for titular f1.
    // Não alterar ratings, contratos, salários; não duplicar registros; já-Licença-A fica intacto;
    // Rodar 2x = mesmo estado.

    try {
      app
        .db()
        .newQuery(`
      UPDATE drivers
      SET 
        license_status = 'nivel_a',
        homologation_status = 'elegivel',
        superlicense_points = CASE 
          WHEN superlicense_points IS NULL OR superlicense_points < 40 THEN 40 
          ELSE superlicense_points 
        END
      WHERE role = 'titular' 
        AND category = 'f1'
    `)
        .execute()
    } catch (err) {
      console.log('Erro ao normalizar superlicenças F1 2026:', err)
    }
  },
  (app) => {
    // Reversão segura
  },
)
