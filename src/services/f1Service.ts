import pb from '@/lib/pocketbase/client'
import {
  TeamModel,
  SeasonModel,
  DriverModel,
  RaceResultModel,
  SponsorModel,
  PartModel,
  EventModel,
  SessionSetupModel,
  MarketMoveEvent,
} from '@/types/f1'

export const f1Service = {
  // Teams
  async getPlayerTeam(userId: string): Promise<TeamModel | null> {
    try {
      const records = await pb.collection('teams').getList<TeamModel>(1, 1, {
        filter: `user_id = "${userId}"`,
      })
      return records.items[0] || null
    } catch (e) {
      console.error('Error fetching player team:', e)
      return null
    }
  },

  async updateTeam(id: string, data: Partial<TeamModel>): Promise<TeamModel> {
    return await pb.collection('teams').update<TeamModel>(id, data)
  },

  // Seasons
  async getSeasonByTeam(teamId: string): Promise<SeasonModel | null> {
    try {
      const records = await pb.collection('seasons').getList<SeasonModel>(1, 1, {
        filter: `team_id = "${teamId}"`,
      })
      return records.items[0] || null
    } catch (e) {
      console.error('Error fetching season:', e)
      return null
    }
  },

  async updateSeason(id: string, data: Partial<SeasonModel>): Promise<SeasonModel> {
    return await pb.collection('seasons').update<SeasonModel>(id, data)
  },

  // Drivers
  async getTeamDrivers(teamId: string): Promise<DriverModel[]> {
    try {
      const records = await pb.collection('drivers').getFullList<DriverModel>({
        filter: `team_id = "${teamId}" || reserve_team_id = "${teamId}"`,
        sort: 'name',
      })
      return records
    } catch (e) {
      console.error('Error fetching team drivers:', e)
      return []
    }
  },

  async getMarketDrivers(): Promise<DriverModel[]> {
    try {
      // Drivers without active team_id and without active reserve_team_id
      const records = await pb.collection('drivers').getFullList<DriverModel>({
        filter: `(team_id = null || team_id = "") && (reserve_team_id = null || reserve_team_id = "")`,
        sort: '-speed',
      })
      return records
    } catch (e) {
      console.error('Error fetching market drivers:', e)
      return []
    }
  },

  async updateDriver(id: string, data: Partial<DriverModel>): Promise<DriverModel> {
    return await pb.collection('drivers').update<DriverModel>(id, data)
  },

  // Schedule FP (Free Practice) session for reserve
  async scheduleReserveFP(driverId: string, rounds: number[]): Promise<DriverModel> {
    return await pb.collection('drivers').update<DriverModel>(driverId, {
      fp_scheduled_rounds: rounds,
    })
  },

  async hireDriver(
    driverId: string,
    teamId: string,
    role: 'titular' | 'reserva' = 'titular',
  ): Promise<DriverModel> {
    if (role === 'reserva') {
      return await pb.collection('drivers').update<DriverModel>(driverId, {
        reserve_team_id: teamId,
        team_id: null,
        role: 'reserva',
        fp_sessions_completed: 0,
        fp_scheduled_rounds: [7, 13],
      })
    }
    return await pb.collection('drivers').update<DriverModel>(driverId, {
      team_id: teamId,
      reserve_team_id: null,
      role: 'titular',
      is_incapacitated: false,
      incapacitated_rounds_left: 0,
    })
  },

  async fireDriver(driverId: string): Promise<DriverModel> {
    return await pb.collection('drivers').update<DriverModel>(driverId, {
      team_id: null,
      reserve_team_id: null,
      role: null,
    })
  },

  async switchDriverRole(
    driverId: string,
    teamId: string,
    newRole: 'titular' | 'reserva',
  ): Promise<DriverModel> {
    if (newRole === 'reserva') {
      return await pb.collection('drivers').update<DriverModel>(driverId, {
        reserve_team_id: teamId,
        team_id: null,
        role: 'reserva',
      })
    } else {
      return await pb.collection('drivers').update<DriverModel>(driverId, {
        team_id: teamId,
        reserve_team_id: null,
        role: 'titular',
      })
    }
  },

  // Sponsors
  async getTeamSponsors(teamId: string): Promise<SponsorModel[]> {
    try {
      const records = await pb.collection('sponsors').getFullList<SponsorModel>({
        filter: `team_id = "${teamId}"`,
        sort: '-created',
      })
      return records
    } catch (e) {
      console.error('Error fetching sponsors:', e)
      return []
    }
  },

  async createSponsor(
    data: Omit<SponsorModel, 'id' | 'created' | 'updated'>,
  ): Promise<SponsorModel> {
    return await pb.collection('sponsors').create<SponsorModel>(data)
  },

  async updateSponsor(id: string, data: Partial<SponsorModel>): Promise<SponsorModel> {
    return await pb.collection('sponsors').update<SponsorModel>(id, data)
  },

  // Parts
  async getTeamParts(teamId: string): Promise<PartModel[]> {
    try {
      const records = await pb.collection('parts').getFullList<PartModel>({
        filter: `team_id = "${teamId}"`,
        sort: 'created',
      })
      return records
    } catch (e) {
      console.error('Error fetching parts:', e)
      return []
    }
  },

  async updatePart(id: string, data: Partial<PartModel>): Promise<PartModel> {
    return await pb.collection('parts').update<PartModel>(id, data)
  },

  // Calculate repair cost based on part level (~R$ 800k - R$ 2.5M)
  getPartRepairCost(part: PartModel): number {
    const condition = part.condition ?? 100
    if (condition >= 100) return 0
    const wear = (100 - condition) / 100 // 0 to 1
    // Base cost for level 0 is 800k, scale up to ~2.5M at level 10
    const fullRestorationCost = 800000 + (part.level || 1) * 170000
    return Math.round(fullRestorationCost * wear)
  },

  async repairPart(partId: string): Promise<PartModel> {
    return await pb.collection('parts').update<PartModel>(partId, {
      condition: 100,
    })
  },

  // Events
  async getTeamEvents(teamId: string, limit = 20): Promise<EventModel[]> {
    try {
      const records = await pb.collection('events').getList<EventModel>(1, limit, {
        filter: `team_id = "${teamId}"`,
        sort: '-created',
      })
      return records.items
    } catch (e) {
      console.error('Error fetching events:', e)
      return []
    }
  },

  async addEvent(
    teamId: string,
    message: string,
    type: 'resultado' | 'contrato' | 'desenvolvimento' | 'patrocinio',
  ): Promise<EventModel> {
    return await pb.collection('events').create<EventModel>({
      team_id: teamId,
      message,
      type,
    })
  },

  // Race Results
  async getSeasonRaceResults(seasonId: string): Promise<RaceResultModel[]> {
    try {
      const records = await pb.collection('race_results').getFullList<RaceResultModel>({
        filter: `season_id = "${seasonId}"`,
        sort: 'round,position',
      })
      return records
    } catch (e) {
      console.error('Error fetching race results:', e)
      return []
    }
  },

  async createRaceResult(
    data: Omit<RaceResultModel, 'id' | 'created' | 'updated'>,
  ): Promise<RaceResultModel> {
    return await pb.collection('race_results').create<RaceResultModel>(data)
  },

  // Helper to ensure canonical driver & team exist before inserting race result
  async ensureDriverAndTeam(
    driverName: string,
    driverIdCandidate?: string,
    teamIdCandidate?: string,
    teamData?: { name?: string; color?: string; engine?: string },
    driverData?: {
      nationality?: string
      speed?: number
      consistency?: number
      rain?: number
      defense?: number
      role?: string
    },
  ): Promise<{ canonicalDriverId: string; canonicalTeamId: string }> {
    let canonicalDriverId = ''
    let canonicalTeamId = teamIdCandidate || ''

    // 1. Resolve Driver
    if (driverIdCandidate && driverIdCandidate.length >= 15 && !driverIdCandidate.includes('_')) {
      try {
        const found = await pb.collection('drivers').getOne(driverIdCandidate)
        if (found?.id) {
          canonicalDriverId = found.id
        }
      } catch (_) {
        // Candidate id not valid in DB, search by name
      }
    }

    if (!canonicalDriverId) {
      try {
        const byName = await pb
          .collection('drivers')
          .getFirstListItem(`name = "${driverName.replace(/"/g, '\\"')}"`)
        if (byName?.id) {
          canonicalDriverId = byName.id
        }
      } catch (_) {
        // Driver does not exist in DB yet, create it
        try {
          const created = await pb.collection('drivers').create({
            name: driverName,
            nationality: driverData?.nationality || 'Desconhecido',
            age: 25,
            speed: driverData?.speed || 80,
            consistency: driverData?.consistency || 80,
            rain: driverData?.rain || 80,
            defense: driverData?.defense || 80,
            salary: 5000000,
            contract_end: 2026,
            role: driverData?.role || 'titular',
            category: 'f1',
          })
          canonicalDriverId = created.id
        } catch (cErr) {
          console.error('Erro ao auto-criar piloto canônico:', cErr)
        }
      }
    }

    // 2. Resolve Team
    if (canonicalTeamId && canonicalTeamId.length >= 15 && !canonicalTeamId.includes('_')) {
      try {
        const tFound = await pb.collection('teams').getOne(canonicalTeamId)
        if (tFound?.id) {
          canonicalTeamId = tFound.id
        }
      } catch (_) {
        canonicalTeamId = ''
      }
    }

    if (!canonicalTeamId) {
      // Find team by name or team_key, or create if AI team
      const tName = teamData?.name || 'Equipe'
      try {
        const byName = await pb
          .collection('teams')
          .getFirstListItem(`name = "${tName.replace(/"/g, '\\"')}"`)
        canonicalTeamId = byName.id
      } catch (_) {
        // Create team record if needed
        try {
          const newTeam = await pb.collection('teams').create({
            name: tName,
            color: teamData?.color || '#FF1801',
            chassis_level: 50,
            aero_level: 50,
            strategy_level: 50,
            budget: 150000000,
            engine_supplier: (teamData?.engine as any) || 'Mercedes',
            strength: 75,
            is_custom: false,
          })
          canonicalTeamId = newTeam.id
        } catch (tErr) {
          console.error('Erro ao auto-criar equipe canônica:', tErr)
        }
      }
    }

    return { canonicalDriverId, canonicalTeamId }
  },

  // Idempotent clean of round race_results for a season
  async deleteRaceResultsForRound(seasonId: string, round: number): Promise<void> {
    try {
      const existing = await pb.collection('race_results').getFullList({
        filter: `season_id = "${seasonId}" && round = ${round}`,
      })
      for (const item of existing) {
        try {
          await pb.collection('race_results').delete(item.id)
        } catch (delErr) {
          console.warn('Erro ao deletar resultado prévio:', delErr)
        }
      }
    } catch (e) {
      console.warn('Nenhum resultado anterior para limpar:', e)
    }
  },

  // Initialize Team (Official or Custom 12th)
  async initializeOfficialTeam(
    userId: string,
    teamKey: string,
    officialData: {
      name: string
      color: string
      engine: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford'
      strength: number
      carLevel: number
      budget: number
      driver1: {
        name: string
        nationality: string
        age: number
        speed: number
        consistency: number
        rain: number
        defense: number
        salary: number
      }
      driver2: {
        name: string
        nationality: string
        age: number
        speed: number
        consistency: number
        rain: number
        defense: number
        salary: number
      }
      reserveDriver?: {
        name: string
        nationality: string
        age: number
        speed: number
        consistency: number
        rain: number
        defense: number
        salary: number
      }
    },
  ): Promise<TeamModel> {
    // 1. Create team
    const newTeam = await pb.collection('teams').create<TeamModel>({
      name: officialData.name,
      color: officialData.color,
      chassis_level: Math.round(officialData.strength * 0.9),
      aero_level: Math.round(officialData.strength * 0.9),
      strategy_level: Math.round(officialData.strength * 0.88),
      budget: officialData.budget,
      engine_supplier: officialData.engine,
      strength: officialData.strength,
      is_custom: false,
      team_key: teamKey,
      user_id: userId,
    })

    // 2. Create season 2026
    await pb.collection('seasons').create({
      year: 2026,
      current_round: 1,
      total_rounds: 24,
      team_id: newTeam.id,
    })

    // 3. Create 6 parts calibrated to strength
    const initialPartLevel = Math.max(3, Math.min(10, Math.round(officialData.strength / 11)))
    const partNames = [
      'Chassi',
      'Asa dianteira',
      'Asa traseira',
      'Assoalho',
      'Suspensão',
      'Aerodinâmica ativa',
    ]
    for (const pName of partNames) {
      await pb.collection('parts').create({
        name: pName,
        level: initialPartLevel,
        condition: 100,
        team_id: newTeam.id,
      })
    }

    // 4. Initial sponsor matching official prestige
    // Economia F1 2026: Patrocinadores cobrem ~90% dos custos nas equipes grandes (~R$ 8M/GP)
    // e ~70% nas pequenas (~R$ 4.5M/GP), complementadas pela premiação anual de construtores (R$ 175M a R$ 70M)
    const rating = (officialData as any).strengthRating ?? officialData.strength / 10
    const sponsorRatio = 0.7 + ((rating - 3.0) / 7.0) * 0.2 // 70% a 90%
    const sponsorVal = Math.round((215000000 / 24) * sponsorRatio)
    await pb.collection('sponsors').create({
      name: `${officialData.name.split(' ')[0]} Global Partner`,
      value_per_round: sponsorVal,
      requirement: 'Top 10 no GP',
      status: 'ativo',
      rounds_remaining: 24,
      team_id: newTeam.id,
    })

    // 5. Initial event
    await pb.collection('events').create({
      message: `Você assumiu o comando da lendária ${officialData.name} para a temporada 2026!`,
      type: 'contrato',
      team_id: newTeam.id,
    })

    // 6. Assign official starters (role: titular)
    for (const d of [officialData.driver1, officialData.driver2]) {
      try {
        const existing = await pb.collection('drivers').getFirstListItem(`name = "${d.name}"`)
        await pb.collection('drivers').update(existing.id, {
          team_id: newTeam.id,
          reserve_team_id: null,
          role: 'titular',
          category: 'f1',
          salary: d.salary,
          speed: d.speed,
          consistency: d.consistency,
          rain: d.rain,
          defense: d.defense,
          is_incapacitated: false,
          incapacitated_rounds_left: 0,
        })
      } catch (_) {
        await pb.collection('drivers').create({
          name: d.name,
          nationality: d.nationality,
          age: d.age,
          speed: d.speed,
          consistency: d.consistency,
          rain: d.rain,
          defense: d.defense,
          salary: d.salary,
          contract_end: 2027,
          team_id: newTeam.id,
          role: 'titular',
          category: 'f1',
          is_incapacitated: false,
          incapacitated_rounds_left: 0,
        })
      }
    }

    // 7. Assign official reserve driver (role: reserva, reserve_team_id: newTeam.id)
    if (officialData.reserveDriver) {
      const rd = officialData.reserveDriver
      try {
        const existing = await pb.collection('drivers').getFirstListItem(`name = "${rd.name}"`)
        await pb.collection('drivers').update(existing.id, {
          reserve_team_id: newTeam.id,
          team_id: null,
          role: 'reserva',
          category: 'f1',
          salary: rd.salary,
          speed: rd.speed,
          consistency: rd.consistency,
          rain: rd.rain,
          defense: rd.defense,
          fp_sessions_completed: 0,
          fp_scheduled_rounds: [7, 13], // default scheduled rounds (ex: Imola & Spa)
        })
      } catch (_) {
        await pb.collection('drivers').create({
          name: rd.name,
          nationality: rd.nationality,
          age: rd.age,
          speed: rd.speed,
          consistency: rd.consistency,
          rain: rd.rain,
          defense: rd.defense,
          salary: rd.salary,
          contract_end: 2027,
          reserve_team_id: newTeam.id,
          role: 'reserva',
          category: 'f1',
          fp_sessions_completed: 0,
          fp_scheduled_rounds: [7, 13],
        })
      }
    }
    return newTeam
  },

  async initializeCustomTeam(
    userId: string,
    teamName: string,
    engineSupplier: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford',
    teamColor: string = '#E10600',
  ): Promise<TeamModel> {
    // 12th Team: Start with rookie strength ~55, humble budget ~130M, NO drivers hired yet
    const initialStrength = 55
    const initialBudget = 130000000

    const newTeam = await pb.collection('teams').create<TeamModel>({
      name: teamName,
      color: teamColor,
      chassis_level: 45,
      aero_level: 45,
      strategy_level: 45,
      budget: 135000000,
      engine_supplier: engineSupplier,
      strength: 35,
      is_custom: true,
      team_key: 'custom_12th',
      user_id: userId,
    })

    // 2. Create season 2026
    await pb.collection('seasons').create({
      year: 2026,
      current_round: 1,
      total_rounds: 24,
      team_id: newTeam.id,
    })

    // 3. Create 6 parts level 4
    const partNames = [
      'Chassi',
      'Asa dianteira',
      'Asa traseira',
      'Assoalho',
      'Suspensão',
      'Aerodinâmica ativa',
    ]
    for (const pName of partNames) {
      await pb.collection('parts').create({
        name: pName,
        level: 4,
        condition: 100,
        team_id: newTeam.id,
      })
    }

    // 4. Initial modest sponsor (~70% do custo operacional por GP: ~R$ 6,2M/GP)
    const customSponsorPerRound = Math.round((215000000 / 24) * 0.7)
    await pb.collection('sponsors').create({
      name: 'Venture Capital Motorsport',
      value_per_round: customSponsorPerRound,
      requirement: 'Sem exigência',
      status: 'ativo',
      rounds_remaining: 24,
      team_id: newTeam.id,
    })

    // 5. Initial event: notify that user must hire 2 drivers
    await pb.collection('events').create({
      message: `Bem-vindo à F1! A nova ${teamName} foi homologada como a 12ª equipe do grid. Acesse a aba Equipe para contratar seus 2 pilotos titulares!`,
      type: 'contrato',
      team_id: newTeam.id,
    })

    return newTeam
  },

  // Session setups for GP Weekend
  async getSessionSetups(
    teamId: string,
    seasonId: string,
    round: number,
  ): Promise<SessionSetupModel[]> {
    try {
      const records = await pb.collection('session_setups').getFullList<SessionSetupModel>({
        filter: `team_id = "${teamId}" && season_id = "${seasonId}" && round = ${round}`,
      })
      return records
    } catch (e) {
      console.warn('Erro ao carregar setups de sessão:', e)
      return []
    }
  },

  async saveSessionSetup(data: SessionSetupModel): Promise<SessionSetupModel> {
    try {
      // Find if already exists
      const existing = await pb.collection('session_setups').getList<SessionSetupModel>(1, 1, {
        filter: `team_id = "${data.team_id}" && season_id = "${data.season_id}" && round = ${data.round} && session = "${data.session}"`,
      })
      if (existing.items.length > 0) {
        return await pb
          .collection('session_setups')
          .update<SessionSetupModel>(existing.items[0].id!, data)
      } else {
        return await pb.collection('session_setups').create<SessionSetupModel>(data)
      }
    } catch (e) {
      console.error('Erro ao salvar setup de sessão:', e)
      return data
    }
  },

  // Cost cap & engine pool constants
  COST_CAP_LIMIT: 215000000, // R$ 215.000.000 teto de gastos anual FIA (equipe + chassi)
  ENGINE_COST_REFERENCE: 190000000, // R$ 190.000.000 custo de motor (unidade de potência)
  MAX_ALLOWED_ENGINES: 4, // 4 motores por temporada sem penalidade de grid

  // Registra gasto no teto de custos (cost cap)
  async registerCostCapSpend(
    teamId: string,
    amount: number,
    currentSpent: number = 0,
  ): Promise<number> {
    const updatedSpent = Math.max(0, currentSpent + amount)
    try {
      await pb.collection('teams').update(teamId, {
        cost_cap_spent: updatedSpent,
      })
    } catch (e) {
      console.warn('Erro ao atualizar cost_cap_spent:', e)
    }
    return updatedSpent
  },

  // Introduz uma nova unidade de potência no pool da equipe
  async introduceNewEngine(
    team: TeamModel,
    cost: number = 18000000,
  ): Promise<{
    team: TeamModel
    penaltyPositions: number
    engineNumber: number
    costCapSpent: number
  }> {
    const currentPool = team.engine_pool_used || 1
    const newPoolNumber = currentPool + 1
    const spentCostCap = (team.cost_cap_spent || 0) + cost
    const newBudget = team.budget - cost

    // Regra FIA: Até 4 motores = 0 posições.
    // 5º motor = 10 posições de grid
    // 6º motor em diante = 5 posições de grid
    let penaltyPositions = 0
    if (newPoolNumber === 5) {
      penaltyPositions = 10
    } else if (newPoolNumber > 5) {
      penaltyPositions = 5
    }

    const currentHistory = Array.isArray(team.engine_history) ? [...team.engine_history] : []
    // Atualizar motor antigo para reserva
    const updatedHistory = currentHistory.map((eng) =>
      eng.status === 'instalado' ? { ...eng, status: 'reserva' as const } : eng,
    )

    // Adicionar nova PU instalada com 0% desgaste
    updatedHistory.push({
      id: newPoolNumber,
      wear: 0,
      status: 'instalado' as const,
      supplier: team.engine_supplier || 'Mercedes',
      introducedRound: 1, // atualizado dinamicamente pelo chamador se disponível
    })

    const updatedTeam = await pb.collection('teams').update<TeamModel>(team.id, {
      budget: newBudget,
      cost_cap_spent: spentCostCap,
      engine_pool_used: newPoolNumber,
      active_engine_wear: 0,
      engine_history: updatedHistory,
    })

    // Adiciona evento oficial
    const penaltyMsg =
      penaltyPositions > 0
        ? ` Penalidade FIA aplicada: PERDA DE ${penaltyPositions} POSIÇÕES NO GRID por exceder a cota anual.`
        : ' Dentro da cota regulamentar (limite: 4 unidades).'

    await pb.collection('events').create({
      message: `NOVA UNIDADE DE POTÊNCIA: Motor #${newPoolNumber} (${team.engine_supplier}) ativado com 0% de desgaste.${penaltyMsg} Custo: ${cost / 1000000}M contabilizado no teto de gastos.`,
      type: 'desenvolvimento',
      team_id: team.id,
    })

    return {
      team: updatedTeam,
      penaltyPositions,
      engineNumber: newPoolNumber,
      costCapSpent: spentCostCap,
    }
  },

  // Process End of Season (Round 24) Silly Season & Driver Market Moves
  async processEndOfSeasonMarket(seasonId: string, teamId: string): Promise<MarketMoveEvent[]> {
    try {
      const allDrivers = await pb.collection('drivers').getFullList<DriverModel>({
        sort: '-speed',
      })
      const allTeams = await pb.collection('teams').getFullList<TeamModel>({
        sort: '-strength',
      })

      const moves: MarketMoveEvent[] = []
      const currentYear = 2026

      // 1. Aposentadorias: pilotos veteranos (idade >= 37) têm chance crescente de aposentadoria
      for (const d of allDrivers) {
        if (d.age >= 37) {
          const retirementChance = d.age >= 42 ? 0.85 : d.age >= 40 ? 0.65 : 0.4
          if (Math.random() < retirementChance) {
            moves.push({
              id: `ret_${d.id}_${Date.now()}`,
              type: 'aposentadoria',
              driverName: d.name,
              driverAge: d.age,
              previousTeam: d.team_id
                ? allTeams.find((t) => t.id === d.team_id)?.name || 'Grid F1'
                : 'Mercado',
              headline: `🏁 Aposentadoria de lenda: ${d.name} anuncia fim da carreira aos ${d.age} anos!`,
              details: `Após anos brilhando no automobilismo mundial, ${d.name} encerra sua trajetória profissional nas pistas.`,
              impact: 'alto',
            })
            // Liberar piloto do time e colocar idade +1 ou status
            await pb.collection('drivers').update(d.id, {
              team_id: null,
              reserve_team_id: null,
              role: null,
              category: 'mercado',
              age: d.age + 1,
            })
          }
        }
      }

      // 2. Vencimento de contratos no fim do ano (contract_end <= 2026)
      const expiringDrivers = allDrivers.filter(
        (d) =>
          (d.contract_end || 2026) <= currentYear && !moves.some((m) => m.driverName === d.name),
      )

      // Identificar os melhores pilotos livres e equipes de topo (McLaren, Ferrari, Red Bull, Mercedes)
      const topTeams = allTeams.filter((t) => (t.strength || 70) >= 80)
      const midTeams = allTeams.filter((t) => (t.strength || 70) < 80)

      // Algumas transferências de impacto entre rivais
      for (const d of expiringDrivers) {
        // Se pertencer ao time do jogador, não demitir forçadamente, apenas sinalizar que o contrato expirou e precisa ser renegociado
        if (d.team_id === teamId) {
          moves.push({
            id: `exp_player_${d.id}`,
            type: 'renovacao',
            driverName: d.name,
            driverAge: d.age,
            previousTeam: allTeams.find((t) => t.id === teamId)?.name || 'Sua Equipe',
            headline: `📄 Contrato expirando: ${d.name} aguarda proposta de renovação!`,
            details: `O vínculo de ${d.name} com a sua equipe encerra no final desta temporada. Renegocie na aba Equipe antes do próximo ano!`,
            impact: 'alto',
          })
          continue
        }

        // Se for um astro da IA com alta velocidade (>=85), pode trocar de equipe de ponta
        if (d.speed >= 85 && Math.random() < 0.5 && topTeams.length > 0) {
          const destinationTeam = topTeams[Math.floor(Math.random() * topTeams.length)]
          moves.push({
            id: `trans_${d.id}`,
            type: 'transferencia',
            driverName: d.name,
            driverAge: d.age,
            newTeam: destinationTeam.name,
            salary: Math.round(d.salary * 1.15),
            headline: `🔥 BOMBA NO MERCADO: ${d.name} fecha com a ${destinationTeam.name}!`,
            details: `Acordo multimilionário firmado para a temporada seguinte, agitando o pelotão de elite.`,
            impact: 'alto',
          })
          await pb.collection('drivers').update(d.id, {
            contract_end: currentYear + 2,
            salary: Math.round(d.salary * 1.15),
            age: d.age + 1,
          })
        } else if (d.category === 'f2' && d.speed >= 79 && Math.random() < 0.6) {
          // Promoção da F2 para a F1
          const targetTeam = midTeams[Math.floor(Math.random() * midTeams.length)] || allTeams[0]
          moves.push({
            id: `promo_${d.id}`,
            type: 'promocao',
            driverName: d.name,
            driverAge: d.age,
            previousTeam: 'Fórmula 2',
            newTeam: targetTeam.name,
            headline: `⭐ Revelação promovida: Jovem estrela da F2 ${d.name} sobe para a F1 na ${targetTeam.name}!`,
            details: `Após campanha impressionante na categoria de acesso, o piloto garante assento titular na temporada seguinte.`,
            impact: 'medio',
          })
          await pb.collection('drivers').update(d.id, {
            category: 'f1',
            contract_end: currentYear + 2,
            age: d.age + 1,
          })
        }
      }

      // Se não gerou nenhum movimento, gerar pelo menos 2 movimentos narrativos para a silly season ser viva
      if (moves.length < 2) {
        moves.push({
          id: `move_default_1`,
          type: 'renovacao',
          driverName: 'Oscar Piastri',
          driverAge: 25,
          newTeam: 'McLaren F1 Team',
          headline: '✍️ Extensão contratual: McLaren e Piastri renovam por mais 3 temporadas.',
          details:
            'A equipe de Woking garante a estabilidade de sua dupla campeã para os próximos ciclos de desenvolvimento.',
          impact: 'medio',
        })
        moves.push({
          id: `move_default_2`,
          type: 'promocao',
          driverName: 'Gabriel Bortoleto',
          driverAge: 22,
          newTeam: 'Audi F1 Team',
          headline: '🚀 Piloto brasileiro Bortoleto assina contrato de titularidade na F1!',
          details:
            'Impressionando pela consistência, o jovem talento consolida sua presença no grid principal.',
          impact: 'alto',
        })
      }

      // Salvar os movimentos no registro da temporada atual
      try {
        await pb.collection('seasons').update(seasonId, {
          market_moves: moves,
        })
      } catch (err) {
        console.warn('Erro ao salvar market_moves na temporada:', err)
      }

      return moves
    } catch (e) {
      console.error('Erro ao processar movimentação do mercado:', e)
      return []
    }
  },

  // Premiação anual oficial da FIA por posição no campeonato de Construtores (P1: R$ 175M até P12: R$ 70M)
  CONSTRUCTOR_PRIZE_BY_RANK: {
    1: 175000000,
    2: 160000000,
    3: 147000000,
    4: 135000000,
    5: 124000000,
    6: 114000000,
    7: 104000000,
    8: 95000000,
    9: 87000000,
    10: 80000000,
    11: 74000000,
    12: 70000000,
  } as Record<number, number>,

  // Start Next Season (e.g. 2027) after End-of-Season Market Moves
  async startNextSeason(
    currentSeasonId: string,
    teamId: string,
    nextYear = 2027,
    playerFinalConstructorRank = 1,
  ): Promise<SeasonModel> {
    try {
      // 0. Pagar premiação anual FIA baseada na colocação do jogador nos construtores
      const prizeAmount = this.CONSTRUCTOR_PRIZE_BY_RANK[playerFinalConstructorRank] || 70000000
      try {
        const teamRec = await pb.collection('teams').getOne<TeamModel>(teamId)
        const updatedBudget = (teamRec.budget || 0) + prizeAmount
        await pb.collection('teams').update(teamId, {
          budget: updatedBudget,
          cost_cap_spent: 0, // Novo teto de gastos no novo ano
        })
        await this.addEvent(
          teamId,
          `🏆 PREMIAÇÃO FIA DE CONSTRUTORES: P${playerFinalConstructorRank} conquistado! Repasse anual de R$ ${(prizeAmount / 1000000).toFixed(0)}M creditado nos cofres da equipe para financiar a temporada ${nextYear}!`,
          'patrocinio',
        )
      } catch (err) {
        console.warn('Erro ao creditar premiação anual de construtores:', err)
      }

      // 1. Reset race results for the new season or delete them
      try {
        const results = await pb.collection('race_results').getFullList({
          filter: `season_id='${currentSeasonId}'`,
        })
        for (const r of results) {
          await pb.collection('race_results').delete(r.id)
        }
      } catch (err) {
        console.warn('Erro ao limpar resultados da temporada anterior:', err)
      }

      // 2. Reset session setups
      try {
        const setups = await pb.collection('session_setups').getFullList({
          filter: `season_id='${currentSeasonId}'`,
        })
        for (const s of setups) {
          await pb.collection('session_setups').delete(s.id)
        }
      } catch (err) {
        console.warn('Erro ao limpar setups anteriores:', err)
      }

      // 3. Update Season record: year + 1, current_round = 1, clear market_moves
      const updatedSeason = await pb.collection('seasons').update<SeasonModel>(currentSeasonId, {
        year: nextYear,
        current_round: 1,
        total_rounds: 24,
        market_moves: null,
      })

      // 4. Reset team active engine wear to 0 and engine pool used to 1
      try {
        await pb.collection('teams').update(teamId, {
          active_engine_wear: 0,
          engine_pool_used: 1,
        })
      } catch (err) {
        console.warn('Erro ao resetar motor da equipe:', err)
      }

      // 5. Restore parts condition to 100% for the new season
      try {
        const teamParts = await pb.collection('parts').getFullList<PartModel>({
          filter: `team_id='${teamId}'`,
        })
        for (const p of teamParts) {
          await pb.collection('parts').update(p.id, {
            condition: 100,
          })
        }
      } catch (err) {
        console.warn('Erro ao restaurar peças para a nova temporada:', err)
      }

      // 6. Log announcement event
      try {
        await this.addEvent(
          teamId,
          `🏁 BEM-VINDO À TEMPORADA ${nextYear}! O grid foi reformulado após a Silly Season. Novos desafios, novos motores e 24 etapas pela frente!`,
          'resultado',
        )
      } catch {
        /* intentionally ignored */
      }

      return updatedSeason
    } catch (e) {
      console.error('Erro ao iniciar próxima temporada:', e)
      throw e
    }
  },

  // Reset all game progress for the given user, keeping user auth record intact.
  // Mirrors logic in 0004_reset_player_progress.js with proper dependency cascade.
  async resetPlayerProgress(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('ID de usuário obrigatório para reiniciar o jogo.')
    }

    // 1. Find all teams owned by this user
    const userTeams = await pb.collection('teams').getFullList<TeamModel>({
      filter: `user_id = "${userId}"`,
    })

    if (userTeams.length === 0) {
      return
    }

    for (const team of userTeams) {
      const teamId = team.id

      // 1. Delete race_results linked directly to this team
      try {
        const raceResults = await pb.collection('race_results').getFullList({
          filter: `team_id = "${teamId}"`,
        })
        for (const rr of raceResults) {
          await pb.collection('race_results').delete(rr.id)
        }
      } catch (err) {
        console.warn('Erro ao deletar race_results por team_id:', err)
      }

      // Also delete race_results linked via seasons of this team
      let teamSeasons: SeasonModel[] = []
      try {
        teamSeasons = await pb.collection('seasons').getFullList<SeasonModel>({
          filter: `team_id = "${teamId}"`,
        })
        for (const s of teamSeasons) {
          try {
            const seasonResults = await pb.collection('race_results').getFullList({
              filter: `season_id = "${s.id}"`,
            })
            for (const sr of seasonResults) {
              await pb.collection('race_results').delete(sr.id)
            }
          } catch (err) {
            console.warn('Erro ao deletar race_results por season_id:', err)
          }
        }
      } catch (err) {
        console.warn('Erro ao buscar temporadas da equipe:', err)
      }

      // 2. Delete events
      try {
        const events = await pb.collection('events').getFullList({
          filter: `team_id = "${teamId}"`,
        })
        for (const ev of events) {
          await pb.collection('events').delete(ev.id)
        }
      } catch (err) {
        console.warn('Erro ao deletar eventos:', err)
      }

      // 3. Reset drivers: return them to free market / unassigned pool
      try {
        const drivers = await pb.collection('drivers').getFullList({
          filter: `team_id = "${teamId}"`,
        })
        for (const d of drivers) {
          await pb.collection('drivers').update(d.id, {
            team_id: null,
          })
        }
      } catch (err) {
        console.warn('Erro ao desvincular pilotos titulares:', err)
      }

      // 4. Delete sponsors
      try {
        const sponsors = await pb.collection('sponsors').getFullList({
          filter: `team_id = "${teamId}"`,
        })
        for (const sp of sponsors) {
          await pb.collection('sponsors').delete(sp.id)
        }
      } catch (err) {
        console.warn('Erro ao deletar patrocínios:', err)
      }

      // 5. Delete parts
      try {
        const parts = await pb.collection('parts').getFullList({
          filter: `team_id = "${teamId}"`,
        })
        for (const pt of parts) {
          await pb.collection('parts').delete(pt.id)
        }
      } catch (err) {
        console.warn('Erro ao deletar peças:', err)
      }

      // 6. Delete seasons
      for (const s of teamSeasons) {
        try {
          await pb.collection('seasons').delete(s.id)
        } catch (err) {
          console.warn('Erro ao deletar temporada:', err)
        }
      }

      // 7. Delete the team itself
      await pb.collection('teams').delete(teamId)
    }
  },
}
