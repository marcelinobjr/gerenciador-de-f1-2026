migrate(
  (app) => {
    // TEAM-CAPITAL-01: Injeção de capital na temporada
    // Adicionar US$ 150.000.000 ao saldo de CADA equipe ativa da temporada atual (12 equipes oficiais do grid 2026).
    const INJECTION_AMOUNT = 150000000
    const SEASON_YEAR = 2026

    // As 12 equipes ativas da temporada atual (OFFICIAL_2026_GRID_KEYS)
    const ACTIVE_TEAM_KEYS = [
      'mercedes',
      'ferrari',
      'mclaren',
      'redbull',
      'racingbulls',
      'alpine',
      'audi',
      'haas',
      'williams',
      'astonmartin',
      'andretti',
      'cadillac',
    ]

    const ledgerCol = app.findCollectionByNameOrId('financial_ledger')

    // Localizar a equipe do jogador ativa (se houver, ela tem user_id != '' e é Audi na temporada 2026)
    let playerTeam = null
    try {
      playerTeam = app.findFirstRecordByFilter('teams', 'user_id != "" && user_id != null')
    } catch (_) {
      playerTeam = null
    }

    // Processar cada chave de equipe ativa
    for (const key of ACTIVE_TEAM_KEYS) {
      let targetTeam = null

      // Se for a equipe do jogador (audi), dá prioridade ao registro da carreira do jogador
      if (
        playerTeam &&
        (playerTeam.get('team_key') === key ||
          (key === 'audi' && playerTeam.get('name').toLowerCase().includes('audi')))
      ) {
        targetTeam = playerTeam
      } else {
        try {
          targetTeam = app.findFirstRecordByFilter(
            'teams',
            `team_key = "${key}" && (user_id = "" || user_id = null)`,
          )
        } catch (_) {
          targetTeam = null
        }
      }

      if (!targetTeam) {
        console.log(`[TEAM-CAPITAL-01] Equipe com key ${key} não encontrada no banco.`)
        continue
      }

      const teamId = targetTeam.id
      const currentBudget = Number(targetTeam.get('budget')) || 0
      const newBudget = currentBudget + INJECTION_AMOUNT

      // 1. Atualizar saldo no registro teams
      targetTeam.set('budget', newBudget)
      app.save(targetTeam)
      console.log(
        `[TEAM-CAPITAL-01] Saldo da equipe ${targetTeam.get('name')} (${teamId}) atualizado: ${currentBudget} -> ${newBudget}`,
      )

      // 2. Registrar transação no Financial Ledger (idempotente)
      const idempotencyKey = `capital_injection_team_capital_01_${teamId}_${SEASON_YEAR}`
      let existingTx = null
      try {
        existingTx = app.findFirstRecordByData(
          'financial_ledger',
          'idempotency_key',
          idempotencyKey,
        )
      } catch (_) {
        existingTx = null
      }

      if (!existingTx) {
        const tx = new Record(ledgerCol)
        tx.set('team_id', teamId)
        tx.set('season_year', SEASON_YEAR)
        tx.set('round', 14) // Rodada atual da temporada
        tx.set('date_display', 'Injeção de Capital 2026')
        tx.set('type', 'revenue')
        tx.set('category', 'ownerFunding')
        tx.set('subcategory', 'capital_injection')
        tx.set('direction', 'inflow')
        tx.set('amount', INJECTION_AMOUNT)
        tx.set('cash_impact', INJECTION_AMOUNT)
        tx.set('cost_cap_impact', 0)
        tx.set('cost_cap_classification', 'excluded') // Aporte de capital dos acionistas é excluído do teto de gastos FIA
        tx.set('source_system', 'team_capital_injection_01')
        tx.set('source_entity_id', teamId)
        tx.set('idempotency_key', idempotencyKey)
        tx.set('description', 'Injeção de capital extraordinária na temporada: +US$ 150.000.000')
        tx.set('status', 'effective')
        tx.set('effective_date', new Date().toISOString())
        app.save(tx)
        console.log(`[TEAM-CAPITAL-01] Transação no ledger gravada para equipe ${teamId}`)
      }
    }
  },
  (app) => {
    // Reversão
    const INJECTION_AMOUNT = 150000000
    const SEASON_YEAR = 2026
    const ACTIVE_TEAM_KEYS = [
      'mercedes',
      'ferrari',
      'mclaren',
      'redbull',
      'racingbulls',
      'alpine',
      'audi',
      'haas',
      'williams',
      'astonmartin',
      'andretti',
      'cadillac',
    ]

    for (const key of ACTIVE_TEAM_KEYS) {
      let targetTeam = null
      try {
        targetTeam = app.findFirstRecordByFilter('teams', `team_key = "${key}"`)
      } catch (_) {
        targetTeam = null
      }

      if (targetTeam) {
        const teamId = targetTeam.id
        const currentBudget = Number(targetTeam.get('budget')) || 0
        targetTeam.set('budget', currentBudget - INJECTION_AMOUNT)
        try {
          app.save(targetTeam)
        } catch (_) {}

        const idempotencyKey = `capital_injection_team_capital_01_${teamId}_${SEASON_YEAR}`
        try {
          const tx = app.findFirstRecordByData(
            'financial_ledger',
            'idempotency_key',
            idempotencyKey,
          )
          app.delete(tx)
        } catch (_) {}
      }
    }
  },
)
