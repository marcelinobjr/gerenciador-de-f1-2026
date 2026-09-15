/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')

    // 1. development_projects: Projetos de P&D de componentes (Concept, Sim, Val, Design, etc.)
    if (!teams.fields.getByName('development_projects')) {
      teams.fields.add(
        new JSONField({
          name: 'development_projects',
        }),
      )
    }

    // 2. component_specs: Especificações canônicas de peças (Spec A, Spec B, Spec C...)
    if (!teams.fields.getByName('component_specs')) {
      teams.fields.add(
        new JSONField({
          name: 'component_specs',
        }),
      )
    }

    // 3. manufacturing_orders: Ordens de fabricação de unidades físicas
    if (!teams.fields.getByName('manufacturing_orders')) {
      teams.fields.add(
        new JSONField({
          name: 'manufacturing_orders',
        }),
      )
    }

    // 4. technical_knowledge: Conhecimento técnico acumulado por componente/família
    if (!teams.fields.getByName('technical_knowledge')) {
      teams.fields.add(
        new JSONField({
          name: 'technical_knowledge',
        }),
      )
    }

    app.save(teams)
  },
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')
    const fields = [
      'development_projects',
      'component_specs',
      'manufacturing_orders',
      'technical_knowledge',
    ]
    for (const f of fields) {
      if (teams.fields.getByName(f)) {
        teams.fields.removeByName(f)
      }
    }
    app.save(teams)
  },
)
