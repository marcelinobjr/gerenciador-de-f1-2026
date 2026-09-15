migrate(
  (app) => {
    // Migration aditiva 1741500019: Mercado de Pilotos, Contratos Canônicos & Silly Season (Implementação 7A)
    // Preserva 100% de dados existentes e adiciona campos JSON/select aditivos sem alterar tabelas destrutivamente.

    // 1. Atualizar coleção teams:
    // - driver_shortlist: json (shortlists contextuais de cada equipe para posições futuras/atuais)
    // - active_driver_negotiations: json (negociações em andamento com pilotos)
    // - driver_contract_preferences: json (estratégia de elenco e perfil buscado)
    try {
      const teams = app.findCollectionByNameOrId('teams')
      if (!teams.fields.getByName('driver_shortlist')) {
        teams.fields.add(new JSONField({ name: 'driver_shortlist', maxSize: 5242880 }))
      }
      if (!teams.fields.getByName('active_driver_negotiations')) {
        teams.fields.add(new JSONField({ name: 'active_driver_negotiations', maxSize: 5242880 }))
      }
      if (!teams.fields.getByName('driver_contract_preferences')) {
        teams.fields.add(new JSONField({ name: 'driver_contract_preferences', maxSize: 5242880 }))
      }
      app.save(teams)
    } catch (err) {
      console.log('Aviso ao atualizar coleção teams na migration 7A:', err)
    }

    // 2. Atualizar coleção drivers:
    // - canonical_contract: json (DriverContract canônico detalhado com cláusulas, opções, promessas contratuais e histórico)
    // - future_contract: json (contrato futuro assinado para N+1 com reserva de vaga)
    // - career_intent_state: text (estado qualitativo derivado: COMMITTED, CONTENT, OPEN_TO_TALKS, EXPLORING_OPTIONS, LOOKING_TO_LEAVE, DETERMINED_TO_LEAVE)
    // - contract_role: text (LEAD_DRIVER, EQUAL_STATUS, SUPPORT_DRIVER, RESERVE, TEST_DEVELOPMENT)
    // - estimated_market_value: json (faixa min/max, sem valor único mágico)
    try {
      const drivers = app.findCollectionByNameOrId('drivers')
      if (!drivers.fields.getByName('canonical_contract')) {
        drivers.fields.add(new JSONField({ name: 'canonical_contract', maxSize: 5242880 }))
      }
      if (!drivers.fields.getByName('future_contract')) {
        drivers.fields.add(new JSONField({ name: 'future_contract', maxSize: 5242880 }))
      }
      if (!drivers.fields.getByName('career_intent_state')) {
        drivers.fields.add(new TextField({ name: 'career_intent_state' }))
      }
      if (!drivers.fields.getByName('contract_role')) {
        drivers.fields.add(new TextField({ name: 'contract_role' }))
      }
      if (!drivers.fields.getByName('estimated_market_value')) {
        drivers.fields.add(new JSONField({ name: 'estimated_market_value', maxSize: 1048576 }))
      }
      app.save(drivers)
    } catch (err) {
      console.log('Aviso ao atualizar coleção drivers na migration 7A:', err)
    }

    // 3. Atualizar coleção seasons:
    // - silly_season_board: json (tabela consolidada de vagas ocupadas/rumores/anúncios)
    // - confidential_market_events: json (contratos assinados em sigilo antes de vazamento ou anúncio oficial)
    try {
      const seasons = app.findCollectionByNameOrId('seasons')
      if (!seasons.fields.getByName('silly_season_board')) {
        seasons.fields.add(new JSONField({ name: 'silly_season_board', maxSize: 5242880 }))
      }
      if (!seasons.fields.getByName('confidential_market_events')) {
        seasons.fields.add(new JSONField({ name: 'confidential_market_events', maxSize: 5242880 }))
      }
      app.save(seasons)
    } catch (err) {
      console.log('Aviso ao atualizar coleção seasons na migration 7A:', err)
    }
  },
  (app) => {
    // Reversão segura
    try {
      const teams = app.findCollectionByNameOrId('teams')
      teams.fields.removeByName('driver_shortlist')
      teams.fields.removeByName('active_driver_negotiations')
      teams.fields.removeByName('driver_contract_preferences')
      app.save(teams)

      const drivers = app.findCollectionByNameOrId('drivers')
      drivers.fields.removeByName('canonical_contract')
      drivers.fields.removeByName('future_contract')
      drivers.fields.removeByName('career_intent_state')
      drivers.fields.removeByName('contract_role')
      drivers.fields.removeByName('estimated_market_value')
      app.save(drivers)

      const seasons = app.findCollectionByNameOrId('seasons')
      seasons.fields.removeByName('silly_season_board')
      seasons.fields.removeByName('confidential_market_events')
      app.save(seasons)
    } catch (err) {
      console.log('Reversão da migration 1741500019:', err)
    }
  },
)
