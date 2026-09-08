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
        team_id: newTeam.id,
      })
    }

    // 4. Initial sponsor matching official prestige
    const sponsorVal = Math.round(officialData.strength * 350000)
    await pb.collection('sponsors').create({
      name: `${officialData.name.split(' ')[0]} Global Partner`,
      value_per_round: sponsorVal,
      requirement: 'Sem exigência',
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
      budget: initialBudget,
      engine_supplier: engineSupplier,
      strength: initialStrength,
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
        team_id: newTeam.id,
      })
    }

    // 4. Initial modest sponsor
    await pb.collection('sponsors').create({
      name: 'Venture Capital Motorsport',
      value_per_round: 18000000,
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
