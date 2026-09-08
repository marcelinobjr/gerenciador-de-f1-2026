import pb from '@/lib/pocketbase/client'
import {
  TeamModel,
  SeasonModel,
  DriverModel,
  RaceResultModel,
  SponsorModel,
  PartModel,
  EventModel,
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
        filter: `team_id = "${teamId}"`,
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
      const records = await pb.collection('drivers').getFullList<DriverModel>({
        filter: `team_id = null || team_id = ""`,
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

    // 6. Assign official drivers to this team
    for (const d of [officialData.driver1, officialData.driver2]) {
      try {
        const existing = await pb.collection('drivers').getFirstListItem(`name = "${d.name}"`)
        await pb.collection('drivers').update(existing.id, {
          team_id: newTeam.id,
          salary: d.salary,
          speed: d.speed,
          consistency: d.consistency,
          rain: d.rain,
          defense: d.defense,
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
}
