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
}
