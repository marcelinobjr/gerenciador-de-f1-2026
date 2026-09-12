migrate(
  (app) => {
    // 1. Processar todos os drivers com next_team_id
    const driversWithNext = app.findRecordsByFilter(
      'drivers',
      'next_team_id != null && next_team_id != ""',
      '',
      200,
      0,
    )

    for (const d of driversWithNext) {
      const nextTeam = d.getString('next_team_id')
      const nextRole = d.getString('next_contract_role') || 'titular'

      if (nextRole === 'reserva') {
        d.set('team_id', '')
        d.set('reserve_team_id', nextTeam)
        d.set('role', 'reserva')
      } else {
        d.set('team_id', nextTeam)
        d.set('reserve_team_id', '')
        d.set('role', 'titular')
      }

      d.set('category', 'f1')
      d.set('next_team_id', '')
      d.set('next_contract_role', '')
      d.set('contract_end', 2028)

      app.save(d)
    }

    // 2. Ajuste específico para Audi (equipe do jogador):
    // Ricciardo veio como titular via pré-contrato e Rafael Câmara como reserva.
    // Bortoleto já é titular.
    // Nico Hülkenberg não tinha pré-contrato para 2027 (venceu em 2026), portanto desvincula da Audi.
    try {
      const hulkenberg = app.findFirstRecordByData('drivers', 'name', 'Nico Hülkenberg')
      if (hulkenberg.getString('team_id') === '8oveg16plyvu1yj') {
        hulkenberg.set('team_id', '')
        hulkenberg.set('role', '')
        hulkenberg.set('category', 'mercado')
        app.save(hulkenberg)
      }
    } catch (_) {}

    // 3. Limpeza de race_results legados da temporada 2026:
    // Como a temporada 2027 já disputou a rodada 1, manter apenas resultados com round = 1,
    // e deletar todos os resultados com round > 1.
    const oldResults = app.findRecordsByFilter('race_results', 'round > 1', '', 500, 0)
    for (const r of oldResults) {
      app.delete(r)
    }

    // 4. Limpeza de race_reports legados da temporada 2026
    const oldReports = app.findRecordsByFilter('race_reports', 'round > 1', '', 200, 0)
    for (const rep of oldReports) {
      app.delete(rep)
    }

    // 5. Resetar penalidades de cost cap e deductions de equipes
    const teams = app.findRecordsByFilter('teams', '1 = 1', '', 50, 0)
    for (const t of teams) {
      t.set('cost_cap_spent', 0)
      t.set('constructors_points_deduction', 0)
      t.set('rd_penalty_rounds_left', 0)
      app.save(t)
    }

    // 6. Atualizar a season 2027
    const seasons = app.findRecordsByFilter('seasons', 'year = 2027', '', 10, 0)
    for (const s of seasons) {
      s.set('total_rounds', 24)
      s.set('market_moves', null)
      app.save(s)
    }
  },
  (app) => {},
)
