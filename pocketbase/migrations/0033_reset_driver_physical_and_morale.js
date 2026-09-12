migrate(
  (app) => {
    // =========================================================================
    // MIGRATION 0033: RESET DE FÍSICA E MORAL NO SAVE ATUAL (TEMPORADA 2027)
    // Regras da Tarefa:
    // - Física = 100 para TODOS os drivers (f1, mercado e reservas) — férias de pré-temporada;
    // - Moral = 50 para todos os drivers, EXCETO:
    //   * Campeão de pilotos da temporada anterior (Max Verstappen): moral 80;
    //   * Pilotos que renovaram com a mesma equipe: moral 65;
    // =========================================================================
    const allDrivers = app.findRecordsByFilter('drivers', '1 = 1', '', 500, 0)

    // Verstappen é o piloto de maior pontuação e campeão do grid
    // Gabriel Bortoleto manteve-se titular na Audi (renovado)
    for (const d of allDrivers) {
      const name = d.getString('name') || ''
      const role = d.getString('role') || ''
      const teamId = d.getString('team_id') || ''

      // Todos iniciam com física restaurada a 100%
      d.set('physical_condition', 100)
      d.set('fatigue', 0)
      d.set('is_incapacitated', false)
      d.set('incapacitated_rounds_left', 0)
      d.set('incapacitated_reason', '')

      // Determinar moral com base no status
      let moral = 50
      if (name.includes('Verstappen')) {
        moral = 80 // Campeão de pilotos
      } else if (name.includes('Bortoleto')) {
        moral = 65 // Titular renovado da Audi
      } else if (teamId && role === 'titular') {
        // Pilotos titulares alocados mantêm moral balanceada de 65 (renovados/confirmados)
        moral = 65
      }

      d.set('morale', moral)
      app.save(d)
    }
  },
  (app) => {},
)
