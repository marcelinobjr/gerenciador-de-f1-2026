migrate(
  (app) => {
    // =========================================================================
    // 1. APOSENTADORIA DE PILOTOS VETERANOS
    // Regra: piloto com idade >= 40 e contract_end <= 2026, OU idade >= 45 em qualquer caso.
    // Torna category = 'retired', remove de equipes e limpa pré-contrato.
    // =========================================================================
    const allDrivers = app.findRecordsByFilter('drivers', '1 = 1', '', 500, 0)
    for (const d of allDrivers) {
      const age = d.getInt('age') || 0
      const contractEnd = d.getInt('contract_end') || 2026
      const shouldRetire = (age >= 40 && contractEnd <= 2026) || age >= 45

      if (shouldRetire) {
        d.set('category', 'mercado') // Usar 'mercado' com role/team vazios para segurança de schema select
        d.set('role', '')
        d.set('team_id', '')
        d.set('reserve_team_id', '')
        d.set('next_team_id', '')
        d.set('next_contract_role', '')
        d.set('salary', 0)
        app.save(d)
      }
    }

    // =========================================================================
    // 2. MERCADO DA IA PARA 2027: COMPLETAR O GRID COM 2 TITULARES POR EQUIPE
    // Cada equipe de IA precisa ter exatamente 2 titulares.
    // =========================================================================
    // Equipes de IA canônicas (11 equipes de IA distintas da Audi do jogador '8oveg16plyvu1yj')
    // As 11 escuderias do grid oficial:
    // McLaren (92), Ferrari (88), Red Bull (87), Mercedes (86), Aston Martin (80),
    // Williams (77), Racing Bulls (73), Alpine (72), Haas (71), Audi IA / Andretti (70), Cadillac (67)
    const teams = app.findRecordsByFilter(
      'teams',
      'id != "8oveg16plyvu1yj" && (user_id = "" || user_id = null)',
      '-strength',
      50,
      0,
    )

    // Agrupar por team_key única para garantir que operamos sobre as 11 escuderias ativas do grid
    const canonicalAiTeams = []
    const seenKeys = new Set()
    for (const t of teams) {
      const key = t.getString('team_key')
      if (key && !seenKeys.has(key)) {
        seenKeys.add(key)
        canonicalAiTeams.push(t)
      }
    }
    // Ordenar estritamente por força decrescente
    canonicalAiTeams.sort((a, b) => b.getInt('strength') - a.getInt('strength'))

    // Pilotos disponíveis para contratação: não aposentados, sem equipe titular
    // Re-buscar drivers atualizados
    const currentDrivers = app.findRecordsByFilter('drivers', '1 = 1', '', 500, 0)

    // Contar titulares já alocados por equipe
    const titularCounts = {}
    for (const t of canonicalAiTeams) {
      titularCounts[t.id] = 0
    }

    for (const d of currentDrivers) {
      const tId = d.getString('team_id')
      const role = d.getString('role')
      if (tId && role === 'titular' && titularCounts[tId] !== undefined) {
        titularCounts[tId] += 1
      }
    }

    // Pilotos elegíveis para o mercado: idade < 40 (ou contrato vigente), team_id vazio, não aposentados
    const availablePool = currentDrivers.filter((d) => {
      const age = d.getInt('age') || 0
      const contractEnd = d.getInt('contract_end') || 2026
      const isRetired = (age >= 40 && contractEnd <= 2026) || age >= 45
      if (isRetired) return false
      const teamId = d.getString('team_id')
      const role = d.getString('role')
      // Se já é titular em alguma equipe, não está disponível
      if (teamId && role === 'titular') return false
      return true
    })

    // Ordenar pilotos disponíveis por score = speed * 0.6 + consistency * 0.4 decrescente
    availablePool.sort((a, b) => {
      const scoreA = (a.getInt('speed') || 75) * 0.6 + (a.getInt('consistency') || 75) * 0.4
      const scoreB = (b.getInt('speed') || 75) * 0.6 + (b.getInt('consistency') || 75) * 0.4
      return scoreB - scoreA
    })

    // Alocar os melhores pilotos para as melhores equipes que precisem de titulares (até 2 por equipe)
    let poolIndex = 0
    for (const team of canonicalAiTeams) {
      let needed = 2 - (titularCounts[team.id] || 0)
      while (needed > 0 && poolIndex < availablePool.length) {
        const selectedDriver = availablePool[poolIndex]
        poolIndex++

        selectedDriver.set('team_id', team.id)
        selectedDriver.set('role', 'titular')
        selectedDriver.set('category', 'f1')
        selectedDriver.set('contract_end', 2029)
        selectedDriver.set('next_team_id', '')
        selectedDriver.set('next_contract_role', '')
        app.save(selectedDriver)

        needed--
        titularCounts[team.id]++
      }
    }

    // =========================================================================
    // 3. NORMALIZAÇÃO DO ORÇAMENTO DA AUDI (EQUIPE DO JOGADOR)
    // Reduz o caixa hiperinflado para ~R$ 50M (patamar sustentável de início de ano)
    // =========================================================================
    try {
      const audiPlayer = app.findFirstRecordByData('teams', 'id', '8oveg16plyvu1yj')
      audiPlayer.set('budget', 50000000) // R$ 50.000.000
      app.save(audiPlayer)
    } catch (_) {}

    // =========================================================================
    // 4. REAJUSTE DE PATROCÍNIOS ATIVOS DA AUDI (REDUÇÃO PARA 40-50%)
    // =========================================================================
    const playerSponsors = app.findRecordsByFilter(
      'sponsors',
      'team_id = "8oveg16plyvu1yj"',
      '',
      100,
      0,
    )
    for (const sp of playerSponsors) {
      const currentVal = sp.getInt('value_per_round') || 0
      // Reduz em ~55% (ficando ~45% do original)
      const adjustedVal = Math.round(currentVal * 0.45)
      sp.set('value_per_round', adjustedVal)
      app.save(sp)
    }
  },
  (app) => {},
)
