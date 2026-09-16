migrate(
  (app) => {
    // 1. Adicionar campos aditivos na collection 'teams' para 8C.2:
    // - 'regulation_development_allocation': JSON (alocação current vs future)
    // - 'regulation_preparations': JSON (mapa de preparação por regulationId)
    // - 'next_regulation_research_projects': JSON (projetos ativos/histórico de pesquisa futura)
    const colTeams = app.findCollectionByNameOrId('teams')

    if (!colTeams.fields.getByName('regulation_development_allocation')) {
      colTeams.fields.add(new JSONField({ name: 'regulation_development_allocation' }))
    }

    if (!colTeams.fields.getByName('regulation_preparations')) {
      colTeams.fields.add(new JSONField({ name: 'regulation_preparations' }))
    }

    if (!colTeams.fields.getByName('next_regulation_research_projects')) {
      colTeams.fields.add(new JSONField({ name: 'next_regulation_research_projects' }))
    }

    app.save(colTeams)
  },
  (app) => {
    try {
      const colTeams = app.findCollectionByNameOrId('teams')
      const f1 = colTeams.fields.getByName('regulation_development_allocation')
      if (f1) colTeams.fields.remove(f1)
      const f2 = colTeams.fields.getByName('regulation_preparations')
      if (f2) colTeams.fields.remove(f2)
      const f3 = colTeams.fields.getByName('next_regulation_research_projects')
      if (f3) colTeams.fields.remove(f3)
      app.save(colTeams)
    } catch (_) {}
  },
)
