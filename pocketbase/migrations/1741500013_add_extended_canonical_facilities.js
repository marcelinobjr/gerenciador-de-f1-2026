/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')

    // 1. design_centre_level: Centro de Design & Escritório de Projetos (Nível 1 a 5)
    if (!teams.fields.getByName('design_centre_level')) {
      teams.fields.add(
        new NumberField({
          name: 'design_centre_level',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    // 2. cfd_level: Cluster Computacional de Dinâmica de Fluidos CFD (Nível 1 a 5)
    if (!teams.fields.getByName('cfd_level')) {
      teams.fields.add(
        new NumberField({
          name: 'cfd_level',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    // 3. wind_tunnel_level: Túnel de Vento Aerodinâmico 60% (Nível 1 a 5)
    if (!teams.fields.getByName('wind_tunnel_level')) {
      teams.fields.add(
        new NumberField({
          name: 'wind_tunnel_level',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    // 4. manufacturing_level: Centro de Manufatura & Compósitos (Nível 1 a 5)
    if (!teams.fields.getByName('manufacturing_level')) {
      teams.fields.add(
        new NumberField({
          name: 'manufacturing_level',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    // 5. operations_centre_level: Centro de Operações de Corrida & Pit Wall Remoto (Nível 1 a 5)
    if (!teams.fields.getByName('operations_centre_level')) {
      teams.fields.add(
        new NumberField({
          name: 'operations_centre_level',
          min: 1,
          max: 5,
          onlyInt: true,
        }),
      )
    }

    // 6. facility_projects: Obras e projetos de expansão em andamento com prazo no tempo
    if (!teams.fields.getByName('facility_projects')) {
      teams.fields.add(
        new JSONField({
          name: 'facility_projects',
        }),
      )
    }

    app.save(teams)

    // Inicialização coerente de dados com herança das instalações existentes
    // e perfis distintos para as 28 equipes do grid (Requisitos 31 e 40)
    const initialProfiles = {
      // Top 4
      mercedes: { design: 5, cfd: 5, aero: 5, mfg: 5, ops: 5 },
      ferrari: { design: 5, cfd: 5, aero: 5, mfg: 5, ops: 4 },
      mclaren: { design: 5, cfd: 5, aero: 5, mfg: 4, ops: 5 },
      redbull: { design: 5, cfd: 5, aero: 5, mfg: 5, ops: 5 },
      // Intermediárias altas
      astonmartin: { design: 4, cfd: 4, aero: 4, mfg: 4, ops: 4 },
      audi: { design: 4, cfd: 4, aero: 3, mfg: 4, ops: 4 },
      alpine: { design: 4, cfd: 4, aero: 4, mfg: 3, ops: 3 },
      racingbulls: { design: 3, cfd: 4, aero: 4, mfg: 3, ops: 4 },
      // Intermediárias / desenvolvimento
      williams: { design: 3, cfd: 3, aero: 3, mfg: 3, ops: 3 },
      haas: { design: 3, cfd: 3, aero: 3, mfg: 2, ops: 3 },
      cadillac: { design: 3, cfd: 3, aero: 2, mfg: 3, ops: 3 },
      // Históricas e base
      porsche: { design: 5, cfd: 5, aero: 5, mfg: 5, ops: 4 },
      honda: { design: 5, cfd: 5, aero: 5, mfg: 5, ops: 4 },
      toyota: { design: 5, cfd: 5, aero: 5, mfg: 5, ops: 4 },
      lamborghini: { design: 4, cfd: 4, aero: 4, mfg: 4, ops: 3 },
      andretti: { design: 4, cfd: 4, aero: 3, mfg: 4, ops: 4 },
      byd: { design: 4, cfd: 5, aero: 3, mfg: 5, ops: 3 },
      penske: { design: 4, cfd: 3, aero: 3, mfg: 4, ops: 4 },
      lotus: { design: 3, cfd: 3, aero: 3, mfg: 3, ops: 3 },
      benetton: { design: 3, cfd: 3, aero: 3, mfg: 3, ops: 3 },
      copersucar: { design: 3, cfd: 2, aero: 2, mfg: 3, ops: 3 },
      alfaromeo: { design: 4, cfd: 4, aero: 3, mfg: 3, ops: 4 },
      alphatauri: { design: 3, cfd: 4, aero: 3, mfg: 3, ops: 4 },
      fittipaldi: { design: 3, cfd: 2, aero: 2, mfg: 3, ops: 3 },
      jordan: { design: 3, cfd: 3, aero: 3, mfg: 3, ops: 3 },
      renault: { design: 4, cfd: 4, aero: 4, mfg: 4, ops: 4 },
      sauber: { design: 4, cfd: 4, aero: 4, mfg: 3, ops: 3 },
      toleman: { design: 3, cfd: 2, aero: 2, mfg: 3, ops: 2 },
    }

    for (const key of Object.keys(initialProfiles)) {
      const p = initialProfiles[key]
      try {
        app
          .db()
          .newQuery(
            `UPDATE teams SET 
              design_centre_level = COALESCE(design_centre_level, {:design}),
              cfd_level = COALESCE(cfd_level, {:cfd}),
              wind_tunnel_level = COALESCE(wind_tunnel_level, {:aero}),
              manufacturing_level = COALESCE(manufacturing_level, {:mfg}),
              operations_centre_level = COALESCE(operations_centre_level, {:ops})
             WHERE team_key = {:key}`,
          )
          .bind({
            key,
            design: p.design,
            cfd: p.cfd,
            aero: p.aero,
            mfg: p.mfg,
            ops: p.ops,
          })
          .execute()
      } catch (err) {
        console.warn('Erro ao atualizar novos facilities para', key, err)
      }
    }

    // Fallback universal para times que não caíram na lista ou saves em andamento
    try {
      app
        .db()
        .newQuery(
          `UPDATE teams SET 
            design_centre_level = COALESCE(design_centre_level, factory_level, 3),
            cfd_level = COALESCE(cfd_level, factory_level, 3),
            wind_tunnel_level = COALESCE(wind_tunnel_level, factory_level, 3),
            manufacturing_level = COALESCE(manufacturing_level, factory_level, 3),
            operations_centre_level = COALESCE(operations_centre_level, simulator_level, 3)
           WHERE design_centre_level IS NULL 
              OR cfd_level IS NULL 
              OR wind_tunnel_level IS NULL 
              OR manufacturing_level IS NULL 
              OR operations_centre_level IS NULL`,
        )
        .execute()
    } catch (e) {
      console.warn('Erro ao popular fallback de facilities:', e)
    }
  },
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')
    const fields = [
      'design_centre_level',
      'cfd_level',
      'wind_tunnel_level',
      'manufacturing_level',
      'operations_centre_level',
      'facility_projects',
    ]
    for (const f of fields) {
      if (teams.fields.getByName(f)) {
        teams.fields.removeByName(f)
      }
    }
    app.save(teams)
  },
)
