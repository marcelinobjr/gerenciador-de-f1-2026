migrate(
  (app) => {
    // Executar passos da transição 2026->2027 e reconstrução
    // 1. Corrigir Verstappen retrato procedural e gênero
    try {
      const verstappen = app.findFirstRecordByData('drivers', 'name', 'Max Verstappen')
      if (verstappen) {
        const procData = verstappen.get('procedural_data') || {}
        const vi = procData.visualIdentity || {}
        vi.gender = 'male'
        // Manter ou atualizar generatedPortraitProfileId para um perfil masculino (ex: Piloto_01 ou compatível)
        // Se era Piloto_13 (feminino), usar um masculino canônico, ex: Piloto_01
        if (
          vi.generatedPortraitProfileId === 'Piloto_13' ||
          procData.generatedPortraitProfileId === 'Piloto_13'
        ) {
          vi.generatedPortraitProfileId = 'Piloto_01'
          vi.portraitAssetId = 'Piloto_01'
          procData.generatedPortraitProfileId = 'Piloto_01'
        }
        procData.visualIdentity = vi
        verstappen.set('procedural_data', procData)
        app.save(verstappen)
      }
    } catch (err) {
      console.log('Erro ao atualizar Verstappen:', err)
    }

    // 2. Localizar equipes 2026 e Toyota
    const mercedesRecords = app.findRecordsByFilter('teams', "name ~ 'Mercedes'", '+created', 5, 0)
    const mercedesId = mercedesRecords.length > 0 ? mercedesRecords[0].id : ''
    const toyotaRecord = app.findFirstRecordByData('teams', 'id', 'jsxe8t2ks3kt322')

    // 3. Re-agregar campeonato 2026 a partir dos race_results canônicos
    const season2026Id = 'z36hmcbqa75kt7k'
    const allDrivers = app.findRecordsByFilter('drivers', '', '+name', 200, 0)
    const driverMap = {}
    allDrivers.forEach((d) => {
      driverMap[d.id] = {
        id: d.id,
        name: d.get('name'),
        teamId: d.get('team_id'),
        points: 0,
        wins: 0,
        podiums: 0,
        bestPosition: 99,
        nationality: d.get('nationality') || '',
      }
    })

    const allTeams = app.findRecordsByFilter('teams', '', '+name', 50, 0)
    const teamMap = {}
    allTeams.forEach((t) => {
      teamMap[t.id] = {
        id: t.id,
        name: t.get('name'),
        color: t.get('color') || '#333',
        engine: t.get('engine_supplier') || 'Mercedes',
        points: 0,
        wins: 0,
        podiums: 0,
        bestPosition: 99,
        isPlayer: t.id === '475a684zt1btgev',
      }
    })

    const results = app.findRecordsByFilter(
      'race_results',
      `season_id='${season2026Id}'`,
      '+round',
      1000,
      0,
    )
    console.log('Total 2026 race results encontrados:', results.length)

    results.forEach((r) => {
      const dId = r.get('driver_id')
      const tId = r.get('team_id')
      const pos = Number(r.get('position')) || 99
      const pts = Number(r.get('points')) || 0

      if (driverMap[dId]) {
        driverMap[dId].points += pts
        if (pos === 1) driverMap[dId].wins += 1
        if (pos <= 3) driverMap[dId].podiums += 1
        if (pos < driverMap[dId].bestPosition) driverMap[dId].bestPosition = pos
      }

      if (teamMap[tId]) {
        teamMap[tId].points += pts
        if (pos === 1) teamMap[tId].wins += 1
        if (pos <= 3) teamMap[tId].podiums += 1
        if (pos < teamMap[tId].bestPosition) teamMap[tId].bestPosition = pos
      }
    })

    // Ordenar pilotos
    const driverStandings = Object.values(driverMap)
      .filter((d) => d.points > 0 || d.bestPosition <= 24)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.wins !== a.wins) return b.wins - a.wins
        if (b.podiums !== a.podiums) return b.podiums - a.podiums
        return a.bestPosition - b.bestPosition
      })

    // Ordenar equipes
    const teamStandings = Object.values(teamMap)
      .filter((t) => t.points > 0 || t.bestPosition <= 24)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.wins !== a.wins) return b.wins - a.wins
        if (b.podiums !== a.podiums) return b.podiums - a.podiums
        return a.bestPosition - b.bestPosition
      })

    const dChamp = driverStandings[0] || {
      id: '',
      name: 'Campeão Piloto',
      points: 0,
      wins: 0,
      podiums: 0,
      teamName: '',
    }
    const cChamp = teamStandings[0] || {
      id: '',
      name: 'Campeão Construtores',
      points: 0,
      wins: 0,
      podiums: 0,
    }

    const playerTeamStanding = teamStandings.find((t) => t.isPlayer) || {
      points: 0,
      wins: 0,
      podiums: 0,
    }
    const playerRank = teamStandings.findIndex((t) => t.isPlayer) + 1 || 6

    // Atualizar season_histories (5nhtg9yykdu8yde)
    try {
      const historyRec = app.findFirstRecordByData('season_histories', 'season_year', 2026)
      if (historyRec) {
        historyRec.set('drivers_champion', {
          driverId: dChamp.id,
          driverName: dChamp.name,
          teamName: dChamp.teamName || teamMap[dChamp.teamId]?.name || '',
          points: dChamp.points,
          wins: dChamp.wins,
          podiums: dChamp.podiums,
        })
        historyRec.set('constructors_champion', {
          teamId: cChamp.id,
          teamName: cChamp.name,
          points: cChamp.points,
          wins: cChamp.wins,
          podiums: cChamp.podiums,
        })
        historyRec.set('final_driver_standings', driverStandings)
        historyRec.set('final_constructor_standings', teamStandings)
        historyRec.set('team_summary', {
          teamId: '475a684zt1btgev',
          teamName: 'Audi F1 Team',
          finalRank: playerRank,
          points: playerTeamStanding.points,
          wins: playerTeamStanding.wins,
          podiums: playerTeamStanding.podiums,
          closingCash: 46691666,
          costCapSpent: 40700000,
        })
        historyRec.set('major_records', {
          totalRaces: 24,
          mostWinsDriver: dChamp.name,
        })
        app.save(historyRec)
      }
    } catch (err) {
      console.log('Erro ao regravar season_history:', err)
    }

    // 4. Executar passos pendentes da transição 2027:
    // (a) Aplicar pilotos com next_team_id / future_contract
    allDrivers.forEach((d) => {
      let changed = false
      const nextTeam = d.get('next_team_id')
      const nextRole = d.get('next_contract_role')
      const futureContract = d.get('future_contract')

      if (
        futureContract &&
        (futureContract.startSeason === 2027 || futureContract.start_season === 2027)
      ) {
        d.set('team_id', futureContract.teamId || futureContract.team_id)
        d.set('role', futureContract.role || 'titular')
        d.set('salary', futureContract.salary || d.get('salary'))
        d.set('contract_end', futureContract.endSeason || 2028)
        d.set('canonical_contract', futureContract)
        d.set('future_contract', null)
        d.set('next_team_id', '')
        d.set('next_contract_role', '')
        changed = true
      } else if (nextTeam) {
        d.set('team_id', nextTeam)
        if (nextRole) d.set('role', nextRole)
        d.set('next_team_id', '')
        d.set('next_contract_role', '')
        d.set('contract_end', 2027)
        changed = true
      }

      if (changed) {
        try {
          app.save(d)
        } catch (err) {
          console.log('Erro ao salvar driver transição:', d.get('name'), err)
        }
      }
    })

    // (b) Garantir que cada equipe ativa no grid 2027 (incluindo Toyota) tenha 2 titulares + 1 reserva
    // Se a Mercedes for substituída por Toyota: transferir pilotos que ainda estavam na Mercedes para Toyota, ou alocar pilotos free agents
    const driversInGrid = app.findRecordsByFilter('drivers', "category='f1'", '+name', 200, 0)
    const activeGridTeams = teamStandings.map((t) => t.id)
    // Se Toyota jsxe8t2ks3kt322 entra no lugar da Mercedes:
    const targetMercedesId = mercedesRecords.length > 0 ? mercedesRecords[0].id : ''
    const toyotaId = 'jsxe8t2ks3kt322'

    // Mover titulares/reservas da Mercedes para Toyota se a substituição for aplicada
    if (targetMercedesId && toyotaRecord) {
      const mercDrivers = app.findRecordsByFilter(
        'drivers',
        `team_id='${targetMercedesId}'`,
        '+name',
        10,
        0,
      )
      mercDrivers.forEach((d) => {
        d.set('team_id', toyotaId)
        try {
          app.save(d)
        } catch (err) {
          console.log('Erro ao mover piloto para Toyota:', err)
        }
      })
    }

    // Preencher assentos vazios de equipes que tenham menos de 2 titulares
    const teamsToCheck = app.findRecordsByFilter('teams', 'is_custom=false', '+name', 20, 0)
    const freeAgents = app.findRecordsByFilter(
      'drivers',
      "team_id='' || team_id=null || career_status='free_agent'",
      '-speed',
      50,
      0,
    )
    let faIndex = 0

    teamsToCheck.forEach((t) => {
      // Se for a Mercedes que saiu do grid, ignorar
      if (t.id === targetMercedesId) return

      const tDrivers = app.findRecordsByFilter('drivers', `team_id='${t.id}'`, '+name', 10, 0)
      const titulares = tDrivers.filter((d) => d.get('role') === 'titular')
      const reservas = tDrivers.filter((d) => d.get('role') === 'reserva')

      let titularCount = titulares.length
      while (titularCount < 2 && faIndex < freeAgents.length) {
        const candidate = freeAgents[faIndex++]
        candidate.set('team_id', t.id)
        candidate.set('role', 'titular')
        candidate.set('career_status', 'f1_driver')
        candidate.set('contract_end', 2027)
        try {
          app.save(candidate)
          titularCount++
        } catch (err) {
          console.log('Erro ao preencher titular:', err)
        }
      }

      let reservaCount = reservas.length
      while (reservaCount < 1 && faIndex < freeAgents.length) {
        const candidate = freeAgents[faIndex++]
        candidate.set('team_id', t.id)
        candidate.set('role', 'reserva')
        candidate.set('career_status', 'reserve')
        candidate.set('contract_end', 2027)
        try {
          app.save(candidate)
          reservaCount++
        } catch (err) {
          console.log('Erro ao preencher reserva:', err)
        }
      }
    })

    // 5. Atualizar season_transitions id c2845wc0t5noc4h para COMPLETE
    try {
      const transition = app.findFirstRecordByData('season_transitions', 'id', 'c2845wc0t5noc4h')
      if (transition) {
        transition.set('status', 'COMPLETE')
        transition.set('current_step', 'COMPLETE')
        transition.set('completed_at', new Date().toISOString())
        app.save(transition)
      }
    } catch (err) {
      console.log('Erro ao finalizar transition c2845wc0t5noc4h:', err)
    }

    // 6. Atualizar temporada 2027
    try {
      const season2027 = app.findFirstRecordByData('seasons', 'id', 'd8rf7m6cpmhstt7')
      if (season2027) {
        season2027.set('archived_history_id', '5nhtg9yykdu8yde')
        app.save(season2027)
      }
    } catch (err) {
      console.log('Erro ao atualizar temporada 2027:', err)
    }
  },
  (app) => {},
)
