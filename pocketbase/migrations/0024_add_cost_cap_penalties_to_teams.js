migrate(
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')

    // 1. cost_cap_penalties: JSON com histórico de investigações e penalidades aplicadas pela FIA
    if (!teams.fields.getByName('cost_cap_penalties')) {
      teams.fields.add(
        new JSONField({
          name: 'cost_cap_penalties',
          required: false,
        }),
      )
    }

    // 2. rd_penalty_rounds_left: quantas rodadas de redução de eficácia de P&D / oficina restam
    if (!teams.fields.getByName('rd_penalty_rounds_left')) {
      teams.fields.add(
        new NumberField({
          name: 'rd_penalty_rounds_left',
          required: false,
          min: 0,
          onlyInt: true,
        }),
      )
    }

    // 3. constructors_points_deduction: pontos deduzidos no mundial de construtores
    if (!teams.fields.getByName('constructors_points_deduction')) {
      teams.fields.add(
        new NumberField({
          name: 'constructors_points_deduction',
          required: false,
          min: 0,
          onlyInt: true,
        }),
      )
    }

    app.save(teams)
  },
  (app) => {
    const teams = app.findCollectionByNameOrId('teams')
    if (teams.fields.getByName('cost_cap_penalties')) {
      teams.fields.removeByName('cost_cap_penalties')
    }
    if (teams.fields.getByName('rd_penalty_rounds_left')) {
      teams.fields.removeByName('rd_penalty_rounds_left')
    }
    if (teams.fields.getByName('constructors_points_deduction')) {
      teams.fields.removeByName('constructors_points_deduction')
    }
    app.save(teams)
  },
)
