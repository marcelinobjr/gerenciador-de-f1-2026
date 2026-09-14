import pb from '@/lib/pocketbase/client'
import { withAuthRetry, refreshAuthSession } from '@/lib/pocketbase/authHelper'
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
  CircuitModel,
  F1NotificationModel,
  F1NotificationType,
  RaceReportModel,
} from '@/types/f1'

export const f1Service = {
  // === NOTIFICAÇÕES (CRUD POCKETBASE) ===
  async getNotifications(userId: string, limit = 30): Promise<F1NotificationModel[]> {
    if (!userId) return []
    try {
      const records = await pb.collection('notifications').getList<F1NotificationModel>(1, limit, {
        filter: `user_id = "${userId}"`,
        sort: '-created',
      })
      return records.items
    } catch (err) {
      console.warn('Erro ao carregar notificações do PocketBase:', err)
      return []
    }
  },

  async createNotification(
    userId: string,
    data: {
      type: F1NotificationType
      title: string
      message: string
      round?: number
      link?: string
      read?: boolean
    },
  ): Promise<F1NotificationModel | null> {
    if (!userId) return null
    try {
      const cleanTitle = data.title.replace(/"/g, '\\"')
      const filter = `user_id = "${userId}" && title = "${cleanTitle}" && round = ${data.round || 1}`
      const existing = await pb.collection('notifications').getList(1, 1, { filter })
      if (existing.items.length > 0) {
        return existing.items[0] as unknown as F1NotificationModel
      }

      return await pb.collection('notifications').create<F1NotificationModel>({
        user_id: userId,
        type: data.type,
        title: data.title,
        message: data.message,
        round: data.round || 1,
        read: data.read ?? false,
        link: data.link || '',
      })
    } catch (err) {
      console.warn('Erro ao criar notificação no PocketBase:', err)
      return null
    }
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await pb.collection('notifications').update(notificationId, { read: true })
    } catch (err) {
      console.warn('Erro ao marcar notificação como lida:', err)
    }
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    if (!userId) return
    try {
      const unreadList = await pb.collection('notifications').getFullList<F1NotificationModel>({
        filter: `user_id = "${userId}" && read = false`,
      })
      await Promise.all(
        unreadList.map((item) =>
          pb
            .collection('notifications')
            .update(item.id, { read: true })
            .catch(() => null),
        ),
      )
    } catch (err) {
      console.warn('Erro ao marcar todas notificações como lidas:', err)
    }
  },

  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await pb.collection('notifications').delete(notificationId)
    } catch (err) {
      console.warn('Erro ao deletar notificação:', err)
    }
  },
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

  async getAllTeams(): Promise<TeamModel[]> {
    try {
      return await pb.collection('teams').getFullList<TeamModel>({
        sort: 'name',
      })
    } catch (e) {
      console.error('Error fetching all teams:', e)
      return []
    }
  },

  async updateTeam(id: string, data: Partial<TeamModel> | FormData): Promise<TeamModel> {
    return await pb.collection('teams').update<TeamModel>(id, data)
  },

  async updateHeroPreferences(
    teamId: string,
    prefs: { hero_title?: string; hero_tagline?: string; hero_car_model?: string },
  ): Promise<TeamModel> {
    return await pb.collection('teams').update<TeamModel>(teamId, prefs)
  },

  async uploadTeamCarImage(teamId: string, file: File): Promise<TeamModel> {
    const formData = new FormData()
    formData.append('carImage', file)
    return await pb.collection('teams').update<TeamModel>(teamId, formData)
  },

  async resetTeamCarImage(teamId: string): Promise<TeamModel> {
    return await pb.collection('teams').update<TeamModel>(teamId, {
      carImage: null,
    })
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
  async getAllDrivers(): Promise<DriverModel[]> {
    try {
      const records = await pb.collection('drivers').getFullList<DriverModel>({
        sort: '-speed',
        expand: 'team_id,reserve_team_id',
      })
      return records
    } catch (e) {
      console.error('Error fetching all drivers:', e)
      return []
    }
  },

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
      // (or in the market pool)
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

  // Busca todos os pilotos elegíveis para negociação na Silly Season
  // Inclui pilotos livres e pilotos com contrato expirando
  async getSillySeasonMarketDrivers(currentSeasonYear = 2026): Promise<DriverModel[]> {
    try {
      const all = await pb.collection('drivers').getFullList<DriverModel>({
        sort: '-speed',
      })
      return all.filter((d) => {
        // Pilotos sem equipe
        if (!d.team_id && !d.reserve_team_id) return true
        // Pilotos com contrato expirando no ano corrente
        if ((d.contract_end || currentSeasonYear) <= currentSeasonYear) return true
        return false
      })
    } catch (e) {
      console.error('Error fetching silly season market drivers:', e)
      return []
    }
  },

  // Assinar pré-contrato para a PRÓXIMA TEMPORADA (Silly Season da rodada 12+)
  async signNextSeasonDriver(
    driverId: string,
    teamId: string,
    role: 'titular' | 'reserva' = 'titular',
    salary?: number,
  ): Promise<DriverModel> {
    const updateData: Partial<DriverModel> = {
      next_team_id: teamId,
      next_contract_role: role,
    }
    if (typeof salary === 'number' && salary > 0) {
      updateData.salary = salary
    }
    return await pb.collection('drivers').update<DriverModel>(driverId, updateData)
  },

  // Cancelar pré-contrato para a próxima temporada
  async cancelNextSeasonDriver(driverId: string): Promise<DriverModel> {
    return await pb.collection('drivers').update<DriverModel>(driverId, {
      next_team_id: null,
      next_contract_role: null,
    })
  },

  // Calcula o multiplicador de preço/salário de um piloto com base no desempenho da temporada atual
  calculateDriverPerformancePriceMultiplier(
    driverPoints = 0,
    bestPosition = 99,
    wins = 0,
    podiums = 0,
    currentRound = 1,
  ): { multiplier: number; explanation: string } {
    if (currentRound < 2) {
      return { multiplier: 1, explanation: 'Início de temporada' }
    }

    // Base: pontos acumulados por corrida disputada
    const ptsPerRound = driverPoints / Math.max(1, currentRound)

    let factor = 1.0
    const reasons: string[] = []

    if (wins > 0) {
      const winBonus = Math.min(0.4, wins * 0.12)
      factor += winBonus
      reasons.push(`${wins} vitória(s) (+${Math.round(winBonus * 100)}%)`)
    }

    if (podiums > wins) {
      const podBonus = Math.min(0.25, (podiums - wins) * 0.06)
      factor += podBonus
      reasons.push(`${podiums - wins} pódio(s) (+${Math.round(podBonus * 100)}%)`)
    }

    if (ptsPerRound >= 12) {
      factor += 0.35
      reasons.push(`Ritmo de postulante ao título (+35%)`)
    } else if (ptsPerRound >= 6) {
      factor += 0.2
      reasons.push(`Presença constante no Top 5 (+20%)`)
    } else if (ptsPerRound >= 2) {
      factor += 0.1
      reasons.push(`Pontuador regular (+10%)`)
    } else if (bestPosition > 16 && currentRound >= 12 && driverPoints === 0) {
      factor -= 0.15
      reasons.push(`Sem pontos no campeonato (-15%)`)
    }

    const clamped = Math.round(Math.max(0.75, Math.min(2.0, factor)) * 100) / 100
    const explanation = reasons.length > 0 ? reasons.join(' • ') : 'Desempenho estável'
    return { multiplier: clamped, explanation }
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

  // Sponsors & Performance Scaling
  // Multiplicador baseado na posição atual de construtores, vitórias e pódios:
  // Líder (P1): ~x1.40 | Lanterna (P12): ~x0.70
  calculateSponsorMultiplier(params: {
    constructorPos?: number
    wins?: number
    podiums?: number
  }): { multiplier: number; explanation: string } {
    const pos = Math.max(1, Math.min(12, params.constructorPos ?? 6))
    const wins = Math.max(0, params.wins ?? 0)
    const podiums = Math.max(0, params.podiums ?? 0)

    // Base por posição de 1º a 12º (escala linear de 1.30 a 0.70)
    // P1: 1.30, P2: 1.245, ..., P12: 0.70
    const baseByPos = 1.3 - ((pos - 1) / 11) * 0.6

    // Bônus por vitórias (+2.5% por vitória, até +10%)
    const winBonus = Math.min(0.1, wins * 0.025)

    // Bônus por pódios (+1% por pódio adicional fora vitórias, até +5%)
    const nonWinPodiums = Math.max(0, podiums - wins)
    const podiumBonus = Math.min(0.05, nonWinPodiums * 0.01)

    const rawMultiplier = baseByPos + winBonus + podiumBonus
    // Teto de 1.45 e piso de 0.65
    const multiplier = Math.round(Math.max(0.65, Math.min(1.45, rawMultiplier)) * 100) / 100

    let explanation = `P${pos} nos construtores`
    if (wins > 0) explanation += ` + ${wins} vitórias`
    if (nonWinPodiums > 0) explanation += ` + ${nonWinPodiums} pódios`

    return { multiplier, explanation }
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

  // Race Reports
  async getRaceReport(seasonId: string, round: number): Promise<RaceReportModel | null> {
    try {
      return await pb
        .collection('race_reports')
        .getFirstListItem<RaceReportModel>(`season_id = "${seasonId}" && round = ${round}`)
    } catch (_) {
      return null
    }
  },

  async getSeasonRaceReports(seasonId: string): Promise<RaceReportModel[]> {
    try {
      return await pb.collection('race_reports').getFullList<RaceReportModel>({
        filter: `season_id = "${seasonId}"`,
        sort: 'round',
      })
    } catch (e) {
      console.error('Error fetching season race reports:', e)
      return []
    }
  },

  async saveRaceReport(
    seasonId: string,
    teamId: string,
    round: number,
    gpName: string,
    circuitName: string,
    country: string,
    data: any,
  ): Promise<RaceReportModel> {
    try {
      const existing = await pb
        .collection('race_reports')
        .getFirstListItem<RaceReportModel>(`season_id = "${seasonId}" && round = ${round}`)
      return await pb.collection('race_reports').update<RaceReportModel>(existing.id, {
        team_id: teamId,
        gp_name: gpName,
        circuit_name: circuitName,
        country,
        data,
      })
    } catch (_) {
      return await pb.collection('race_reports').create<RaceReportModel>({
        season_id: seasonId,
        team_id: teamId,
        round,
        gp_name: gpName,
        circuit_name: circuitName,
        country,
        data,
      })
    }
  },

  // Race Results
  async getSeasonRaceResults(seasonId: string): Promise<RaceResultModel[]> {
    try {
      const records = await pb.collection('race_results').getFullList<RaceResultModel>({
        filter: `season_id = "${seasonId}"`,
        sort: 'round,position',
        expand: 'driver_id,team_id',
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
    const created = await pb.collection('race_results').create<RaceResultModel>(data)

    // Hook auxiliar pós-corrida: Quando todos os resultados da rodada forem gravados (ou ao salvar resultado do jogador),
    // disparar geração e persistência assíncrona do relatório se ainda não existir para esta rodada.
    setTimeout(async () => {
      try {
        if (!data.season_id || !data.round) return
        const existingReport = await this.getRaceReport(data.season_id, data.round)
        if (existingReport) return

        // Busca season e team
        const sRecord = await pb.collection('seasons').getOne<SeasonModel>(data.season_id)
        if (!sRecord?.team_id) return
        const tRecord = await pb.collection('teams').getOne<TeamModel>(sRecord.team_id)
        if (!tRecord) return

        // Busca resultados desta temporada
        const allSeasonResults = await this.getSeasonRaceResults(data.season_id)
        const roundResults = allSeasonResults.filter((r) => r.round === data.round)
        if (roundResults.length < 5) return // Espera ter o grid razoável salvo

        // Busca pilotos da equipe
        const teamDrivers = await pb.collection('drivers').getFullList<DriverModel>({
          filter: `team_id = "${tRecord.id}"`,
        })

        // Import dinâmico do raceReportService para evitar dependência circular
        const { raceReportService } = await import('./raceReportService')
        const { F1_2026_CALENDAR } = await import('@/lib/f1-data')

        const gpMeta = F1_2026_CALENDAR.find((c) => c.round === data.round) || {
          round: data.round,
          name: `GP da Rodada ${data.round}`,
          circuit: 'Autódromo Internacional',
          country: 'Mundial',
          flag: '🏁',
          laps: 55,
        }

        const prevResults = allSeasonResults.filter((r) => r.round < data.round)
        const currResults = allSeasonResults.filter((r) => r.round <= data.round)

        const reportData = raceReportService.generateReportData({
          round: data.round,
          gpInfo: {
            name: gpMeta.name,
            circuit: (gpMeta as any).circuit || 'Circuito Oficial FIA',
            country: gpMeta.country,
            flag: gpMeta.flag,
            laps: (gpMeta as any).laps || 55,
          },
          finalGrid: roundResults.map((r) => ({
            driverId: r.driver_id,
            driverName: r.expand?.driver_id?.name || 'Piloto',
            teamId: r.team_id,
            teamName: r.expand?.team_id?.name || '',
            teamColor: r.expand?.team_id?.color || '#E10600',
            isPlayer: r.team_id === tRecord.id,
            flag: (r.expand?.driver_id as any)?.flag || '🏁',
            position: r.position,
            points: r.points,
            fastestLap: r.fastest_lap,
            dnf: false,
            totalTime: r.position === 1 ? 'Vencedor' : `+${r.position * 2.1}s`,
          })),
          raceIncidents: [],
          liveEvents: [],
          team: tRecord,
          season: sRecord,
          drivers: teamDrivers,
          previousRaceResults: prevResults,
          currentRaceResults: currResults,
        })

        await this.saveRaceReport(
          data.season_id,
          tRecord.id,
          data.round,
          gpMeta.name,
          (gpMeta as any).circuit || 'Circuito Oficial',
          gpMeta.country || '',
          reportData,
        )
      } catch (repErr) {
        // Tolerância a falha silenciosa para não travar avanço
        console.warn('Geração automática de relatório pós-corrida em background:', repErr)
      }
    }, 1200)

    return created
  },

  // Circuits
  async getAllCircuits(): Promise<CircuitModel[]> {
    try {
      const records = await pb.collection('circuits').getFullList<CircuitModel>({
        sort: 'round',
      })
      return records
    } catch (e) {
      console.error('Error fetching circuits:', e)
      return []
    }
  },

  async updateCircuitPhoto(
    round: number,
    formData: FormData,
    circuitMeta?: { name: string; circuit_name?: string; country?: string },
  ): Promise<CircuitModel> {
    try {
      const existing = await pb
        .collection('circuits')
        .getFirstListItem<CircuitModel>(`round = ${round}`)
      return await pb.collection('circuits').update<CircuitModel>(existing.id, formData)
    } catch (_) {
      // Se ainda não existir no DB, cria o registro com a foto
      if (circuitMeta?.name) {
        formData.append('name', circuitMeta.name)
      }
      if (circuitMeta?.circuit_name) {
        formData.append('circuit_name', circuitMeta.circuit_name)
      }
      if (circuitMeta?.country) {
        formData.append('country', circuitMeta.country)
      }
      formData.append('round', String(round))
      return await pb.collection('circuits').create<CircuitModel>(formData)
    }
  },

  // Cache em memória para evitar buscas repetidas
  _driverCache: new Map<string, string>(),
  _teamCache: new Map<string, string>(),

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
    let canonicalTeamId = ''

    const cleanDriverName = (driverName || '').trim()
    const normDriverName = cleanDriverName.toLowerCase()
    const rawTeamName = (teamData?.name || '').trim()
    const normTeamName = rawTeamName.toLowerCase()

    // 1. Resolve Driver
    if (this._driverCache.has(normDriverName)) {
      canonicalDriverId = this._driverCache.get(normDriverName)!
    } else if (
      driverIdCandidate &&
      driverIdCandidate.length >= 15 &&
      !driverIdCandidate.includes('_')
    ) {
      try {
        const found = await pb.collection('drivers').getOne(driverIdCandidate)
        if (found?.id) {
          canonicalDriverId = found.id
          this._driverCache.set(normDriverName, canonicalDriverId)
        }
      } catch (_) {
        // Candidate id not valid in DB, search by name
      }
    }

    if (!canonicalDriverId && cleanDriverName) {
      try {
        const safeName = cleanDriverName.replace(/"/g, '\\"')
        const byName = await pb.collection('drivers').getFirstListItem(`name = "${safeName}"`)
        if (byName?.id) {
          canonicalDriverId = byName.id
          this._driverCache.set(normDriverName, canonicalDriverId)
        }
      } catch (_) {
        // Busca flexível sem acentos ou parcial
        try {
          const simplified = cleanDriverName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          const byPartial = await pb
            .collection('drivers')
            .getFirstListItem(`name ~ "${simplified.replace(/"/g, '\\"')}"`)
          if (byPartial?.id) {
            canonicalDriverId = byPartial.id
            this._driverCache.set(normDriverName, canonicalDriverId)
          }
        } catch (__) {
          // Driver não existe no DB, cria registro novo
          try {
            const created = await pb.collection('drivers').create({
              name: cleanDriverName,
              nationality: driverData?.nationality || 'Internacional',
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
            this._driverCache.set(normDriverName, canonicalDriverId)
          } catch (cErr) {
            console.error('Erro ao auto-criar piloto canônico:', cleanDriverName, cErr)
          }
        }
      }
    }

    // 2. Resolve Team
    if (this._teamCache.has(normTeamName)) {
      canonicalTeamId = this._teamCache.get(normTeamName)!
    } else if (teamIdCandidate && teamIdCandidate.length >= 15 && !teamIdCandidate.includes('_')) {
      try {
        const tFound = await pb.collection('teams').getOne(teamIdCandidate)
        if (tFound?.id) {
          canonicalTeamId = tFound.id
          this._teamCache.set(normTeamName, canonicalTeamId)
        }
      } catch (_) {
        canonicalTeamId = ''
      }
    }

    if (!canonicalTeamId && rawTeamName) {
      // Busca exata pelo nome
      try {
        const safeTName = rawTeamName.replace(/"/g, '\\"')
        const byName = await pb.collection('teams').getFirstListItem(`name = "${safeTName}"`)
        if (byName?.id) {
          canonicalTeamId = byName.id
          this._teamCache.set(normTeamName, canonicalTeamId)
        }
      } catch (_) {
        // Tenta buscar por team_key se o teamIdCandidate for tipo "ai_williams"
        let fallbackKey = ''
        if (teamIdCandidate && teamIdCandidate.startsWith('ai_')) {
          fallbackKey = teamIdCandidate.replace(/^ai_/, '')
        }
        if (fallbackKey) {
          try {
            const byKey = await pb
              .collection('teams')
              .getFirstListItem(`team_key = "${fallbackKey}"`)
            if (byKey?.id) {
              canonicalTeamId = byKey.id
              this._teamCache.set(normTeamName, canonicalTeamId)
            }
          } catch {
            /* intentionally ignored */
          }
        }

        if (!canonicalTeamId) {
          // Cria registro de equipe se não encontrado
          try {
            const validSupplier = ['Ferrari', 'Mercedes', 'Honda', 'Ford', 'Audi'].includes(
              teamData?.engine || '',
            )
              ? (teamData?.engine as any)
              : 'Mercedes'

            const newTeam = await pb.collection('teams').create({
              name: rawTeamName,
              color: teamData?.color || '#FF1801',
              chassis_level: 50,
              aero_level: 50,
              strategy_level: 50,
              budget: 150000000,
              engine_supplier: validSupplier,
              strength: 75,
              is_custom: false,
              team_key: fallbackKey || undefined,
            })
            canonicalTeamId = newTeam.id
            this._teamCache.set(normTeamName, canonicalTeamId)
          } catch (tErr) {
            console.error('Erro ao auto-criar equipe canônica:', rawTeamName, tErr)
          }
        }
      }
    }

    // Se a equipe não tem id canônico resolvido, tentar ao menos o teamIdCandidate
    if (!canonicalTeamId && teamIdCandidate && teamIdCandidate.length >= 15) {
      canonicalTeamId = teamIdCandidate
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

  // Normalizador defensivo para fornecedores válidos no PocketBase (Ferrari | Mercedes | Honda | Ford | Audi)
  normalizeEngineSupplier(supplier?: string): 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi' {
    if (!supplier) return 'Mercedes'
    const s = supplier.trim()
    if (['Ferrari', 'Mercedes', 'Honda', 'Ford', 'Audi'].includes(s)) {
      return s as 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
    }
    const lower = s.toLowerCase()
    if (lower.includes('ferrari')) return 'Ferrari'
    if (lower.includes('mercedes')) return 'Mercedes'
    if (lower.includes('honda') || lower.includes('rbpt') || lower.includes('red bull'))
      return 'Honda'
    if (lower.includes('ford')) return 'Ford'
    if (lower.includes('audi')) return 'Audi'
    if (lower.includes('renault') || lower.includes('alpine')) return 'Mercedes' // Parceria técnica moderna
    return 'Mercedes'
  },

  // Initialize Career from Wizard (Fase 2: NewGameConfig completo)
  async initializeCareerWithConfig(
    userId: string,
    config: import('@/types/career-wizard').NewGameConfig,
  ): Promise<TeamModel> {
    // 1. Garantir que a sessão esteja fresca antes de criar a carreira
    await refreshAuthSession()

    // 2. Usar o ID do usuário atualmente autenticado no cliente compartilhado
    const activeUserId = pb.authStore.record?.id || userId

    const isCustom = config.playerTeam.isCustom
    const managerName = config.manager.name || 'Chefe de Equipe'

    if (isCustom) {
      // Criar equipe personalizada com dados do wizard com retry resiliente
      const teamName = config.playerTeam.customName?.trim() || 'Minha Escuderia'
      const teamColor = config.playerTeam.customColor || '#00A6FB'
      const engineSupplier = this.normalizeEngineSupplier(config.playerTeam.customEngine)

      const newTeam = await withAuthRetry(() =>
        pb.collection('teams').create<TeamModel>({
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
          user_id: activeUserId,
          manager_name: managerName,
          manager_profile: {
            profileId: config.managerProfile.id,
            title: config.managerProfile.title,
            archetype: config.managerProfile.archetype,
            specialty: config.managerProfile.specialty,
            style: config.managerProfile.style,
            nationality: config.manager.nationality,
            age: config.manager.age,
            avatarUrl: config.manager.avatarUrl || config.managerProfile.avatarUrl,
            bonuses: config.managerProfile.bonuses,
            weakness: config.managerProfile.weakness,
            baseAttributes: config.managerProfile.baseAttributes,
          },
          career_settings: config.careerSettings,
          custom_grid_teams: config.selectedTeams.map((t) => ({
            key: t.key,
            name: t.name,
            engine: this.normalizeEngineSupplier(t.engine),
            strength: t.strength,
            color: t.color,
          })),
          universe_type: config.universeType,
        }),
      )

      // Temporada 2026
      await withAuthRetry(() =>
        pb.collection('seasons').create({
          year: 2026,
          current_round: 1,
          total_rounds: 24,
          team_id: newTeam.id,
        }),
      )

      // 6 Peças calibradas
      const partNames = [
        'Chassi',
        'Asa dianteira',
        'Asa traseira',
        'Assoalho',
        'Suspensão',
        'Aerodinâmica ativa',
      ]
      for (const pName of partNames) {
        await withAuthRetry(() =>
          pb.collection('parts').create({
            name: pName,
            level: 4,
            condition: 100,
            team_id: newTeam.id,
          }),
        )
      }

      // Patrocinador inicial
      const customSponsorPerRound = Math.round((215000000 / 24) * 0.7)
      await withAuthRetry(() =>
        pb.collection('sponsors').create({
          name: 'Venture Capital Motorsport',
          slot: 'laterais',
          value_per_round: customSponsorPerRound,
          requirement: 'Sem exigência',
          status: 'ativo',
          rounds_remaining: 24,
          team_id: newTeam.id,
        }),
      )

      // Evento de boas-vindas
      await withAuthRetry(() =>
        pb.collection('events').create({
          message: `Bem-vindo, ${managerName}! A nova ${teamName} foi homologada como a 12ª equipe do grid da F1 2026. Acesse a aba Equipe para contratar seus 2 pilotos titulares!`,
          type: 'contrato',
          team_id: newTeam.id,
        }),
      )

      return newTeam
    } else {
      // Equipe oficial escolhida pelo jogador
      const teamDef =
        config.playerTeam.officialTeam ||
        config.selectedTeams.find((t) => t.key === config.playerTeam.teamKey)
      if (!teamDef) {
        throw new Error('Equipe oficial não encontrada no grid.')
      }

      const engineSupplier = this.normalizeEngineSupplier(teamDef.engine)

      const newTeam = await withAuthRetry(() =>
        pb.collection('teams').create<TeamModel>({
          name: teamDef.name,
          color: teamDef.color,
          chassis_level: Math.round(teamDef.strength * 0.9),
          aero_level: Math.round(teamDef.strength * 0.9),
          strategy_level: Math.round(teamDef.strength * 0.88),
          budget: teamDef.budget,
          engine_supplier: engineSupplier,
          strength: teamDef.strength,
          is_custom: false,
          team_key: teamDef.key,
          user_id: activeUserId,
          manager_name: managerName,
          manager_profile: {
            profileId: config.managerProfile.id,
            title: config.managerProfile.title,
            archetype: config.managerProfile.archetype,
            specialty: config.managerProfile.specialty,
            style: config.managerProfile.style,
            nationality: config.manager.nationality,
            age: config.manager.age,
            avatarUrl: config.manager.avatarUrl || config.managerProfile.avatarUrl,
            bonuses: config.managerProfile.bonuses,
            weakness: config.managerProfile.weakness,
            baseAttributes: config.managerProfile.baseAttributes,
          },
          career_settings: config.careerSettings,
          custom_grid_teams: config.selectedTeams.map((t) => ({
            key: t.key,
            name: t.name,
            engine: this.normalizeEngineSupplier(t.engine),
            strength: t.strength,
            color: t.color,
          })),
          universe_type: config.universeType,
        }),
      )

      // Temporada 2026
      await withAuthRetry(() =>
        pb.collection('seasons').create({
          year: 2026,
          current_round: 1,
          total_rounds: 24,
          team_id: newTeam.id,
        }),
      )

      // 6 peças
      const initialPartLevel = Math.max(3, Math.min(10, Math.round(teamDef.strength / 11)))
      const partNames = [
        'Chassi',
        'Asa dianteira',
        'Asa traseira',
        'Assoalho',
        'Suspensão',
        'Aerodinâmica ativa',
      ]
      for (const pName of partNames) {
        await withAuthRetry(() =>
          pb.collection('parts').create({
            name: pName,
            level: initialPartLevel,
            condition: 100,
            team_id: newTeam.id,
          }),
        )
      }

      // Patrocinador oficial
      const rating = teamDef.strengthRating ?? teamDef.strength / 10
      const sponsorRatio = 0.7 + ((rating - 3.0) / 7.0) * 0.2
      const sponsorVal = Math.round((215000000 / 24) * sponsorRatio)
      await withAuthRetry(() =>
        pb.collection('sponsors').create({
          name: `${teamDef.name.split(' ')[0]} Global Partner`,
          slot: 'laterais',
          value_per_round: sponsorVal,
          requirement: 'Top 10 no GP',
          status: 'ativo',
          rounds_remaining: 24,
          team_id: newTeam.id,
        }),
      )

      // Evento de boas-vindas
      await withAuthRetry(() =>
        pb.collection('events').create({
          message: `${managerName} assumiu o comando da lendária ${teamDef.name} para a temporada 2026!`,
          type: 'contrato',
          team_id: newTeam.id,
        }),
      )

      // Atribuir pilotos titulares
      for (const d of [teamDef.driver1, teamDef.driver2]) {
        try {
          const existing = await pb.collection('drivers').getFirstListItem(`name = "${d.name}"`)
          await withAuthRetry(() =>
            pb.collection('drivers').update(existing.id, {
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
            }),
          )
        } catch (_) {
          await withAuthRetry(() =>
            pb.collection('drivers').create({
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
            }),
          )
        }
      }

      // Piloto reserva
      if (teamDef.reserveDriver) {
        const rd = teamDef.reserveDriver
        try {
          const existing = await pb.collection('drivers').getFirstListItem(`name = "${rd.name}"`)
          await withAuthRetry(() =>
            pb.collection('drivers').update(existing.id, {
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
              fp_scheduled_rounds: [7, 13],
            }),
          )
        } catch (_) {
          await withAuthRetry(() =>
            pb.collection('drivers').create({
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
            }),
          )
        }
      }

      return newTeam
    }
  },

  // Initialize Team (Official or Custom 12th) - Legado compatível
  async initializeOfficialTeam(
    userId: string,
    teamKey: string,
    officialData: {
      name: string
      color: string
      engine: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
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
      slot: 'laterais',
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
          fp_scheduled_rounds: [7, 13], // default scheduled rounds (ex: Madri & Spa)
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
    engineSupplier: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi',
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
      slot: 'laterais',
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

  // Aplica violação deliberada do teto de gastos com Investigação Oficial da FIA
  async applyCostCapBreach(
    team: TeamModel,
    cost: number,
    reason: string,
  ): Promise<{
    team: TeamModel
    overspendAmount: number
    pointsDeducted: number
    rdPenaltyRounds: number
  }> {
    const currentSpent = team.cost_cap_spent || 0
    const newSpent = currentSpent + cost
    const newBudget = team.budget - cost
    const overspendAmount = Math.max(0, newSpent - this.COST_CAP_LIMIT)

    // Penalidade proporcional ao excedente:
    // Mínimo de 10 pts, + 5 pts por cada R$ 5M de excedente
    // P&D afetado por 2 a 5 rodadas
    const pointsDeducted = Math.max(10, Math.round(10 + (overspendAmount / 5000000) * 5))
    const rdPenaltyRounds = Math.min(6, Math.max(2, Math.round(2 + overspendAmount / 10000000)))

    const currentPenalties = Array.isArray(team.cost_cap_penalties)
      ? [...team.cost_cap_penalties]
      : []

    currentPenalties.push({
      id: `cc_pen_${Date.now()}`,
      timestamp: new Date().toISOString(),
      overspendAmount,
      pointsDeducted,
      rdPenaltyRounds,
      reason,
    })

    const totalDeduction = (team.constructors_points_deduction || 0) + pointsDeducted
    const currentRdLeft = team.rd_penalty_rounds_left || 0
    const newRdLeft = Math.max(currentRdLeft, rdPenaltyRounds)

    const updatedTeam = await pb.collection('teams').update<TeamModel>(team.id, {
      budget: newBudget,
      cost_cap_spent: newSpent,
      constructors_points_deduction: totalDeduction,
      rd_penalty_rounds_left: newRdLeft,
      cost_cap_penalties: currentPenalties,
    })

    // Adiciona evento oficial da FIA
    await pb.collection('events').create({
      message: `🚨 INVESTIGAÇÃO FIA: VIOLAÇÃO DO TETO DE GASTOS! A equipe ${team.name} excedeu o teto em R$ ${(overspendAmount / 1000000).toFixed(1)}M (${reason}). PUNIÇÕES APLICADAS: -${pointsDeducted} pontos no Mundial de Construtores e eficácia de P&D/Oficina reduzida por ${newRdLeft} corridas.`,
      type: 'desenvolvimento',
      team_id: team.id,
    })

    return {
      team: updatedTeam,
      overspendAmount,
      pointsDeducted,
      rdPenaltyRounds: newRdLeft,
    }
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

  // Process Silly Season moves for a specific round between 12 and 24
  // Generates 1 to 3 moves among rival teams/drivers, taking into account player's signings
  async processMidSeasonSillyMoves(
    seasonId: string,
    teamId: string,
    round: number,
  ): Promise<MarketMoveEvent[]> {
    if (round < 12 || round > 24) return []

    try {
      const allDrivers = await pb.collection('drivers').getFullList<DriverModel>({
        sort: '-speed',
      })
      const allTeams = await pb.collection('teams').getFullList<TeamModel>({
        sort: '-strength',
      })

      // Equipes rivais (excluindo a do jogador)
      const rivalTeams = allTeams.filter((t) => t.id !== teamId)
      if (rivalTeams.length === 0) return []

      const count = Math.floor(Math.random() * 3) + 1 // 1 a 3 movimentos
      const moves: MarketMoveEvent[] = []
      const currentYear = 2026

      // Pilotos disponíveis que NÃO foram assinados pelo jogador (next_team_id !== teamId)
      // e que ainda não têm destino para a próxima temporada
      const candidateDrivers = allDrivers.filter(
        (d) =>
          d.next_team_id !== teamId &&
          !d.next_team_id &&
          d.team_id !== teamId &&
          d.reserve_team_id !== teamId,
      )

      for (let i = 0; i < count; i++) {
        const rand = Math.random()
        const targetTeam = rivalTeams[Math.floor(Math.random() * rivalTeams.length)]
        const targetTeamName = targetTeam?.name || 'Equipe Rival'

        if (rand < 0.4) {
          // Renovação entre pilotos da própria equipe rival
          const teamDrivers = allDrivers.filter((d) => d.team_id === targetTeam.id && d.id)
          const driverToRenew = teamDrivers[Math.floor(Math.random() * teamDrivers.length)]
          if (driverToRenew && !moves.some((m) => m.driverName === driverToRenew.name)) {
            const headline = `✍️ Renovação Silly Season (R${round}): ${targetTeamName} estende contrato de ${driverToRenew.name}!`
            const details = `Com forte desempenho nas pistas, o piloto assina novo vínculo até ${currentYear + 2} para fechar as portas para rivais.`
            const move: MarketMoveEvent = {
              id: `mid_ren_${round}_${driverToRenew.id}_${Date.now()}`,
              type: 'renovacao',
              driverName: driverToRenew.name,
              driverAge: driverToRenew.age,
              previousTeam: targetTeamName,
              newTeam: targetTeamName,
              salary: Math.round(driverToRenew.salary * 1.1),
              headline,
              details,
              impact: 'medio',
            }
            moves.push(move)
            try {
              await pb.collection('drivers').update(driverToRenew.id, {
                next_team_id: targetTeam.id,
                next_contract_role: 'titular',
                contract_end: currentYear + 2,
              })
              await this.addEvent(teamId, headline, 'contrato')
            } catch (err) {
              console.warn('Erro ao atualizar renovação rival:', err)
            }
          }
        } else if (rand < 0.75) {
          // Contratação / Transferência de piloto livre ou de rival para próxima temporada
          // Se o jogador já tiver assinado com um piloto (next_team_id === teamId), o rival busca outro!
          const availableToSign = candidateDrivers.filter(
            (d) =>
              d.next_team_id !== teamId &&
              !moves.some((m) => m.driverName === d.name) &&
              d.team_id !== targetTeam.id,
          )

          if (availableToSign.length > 0) {
            const picked = availableToSign[Math.floor(Math.random() * availableToSign.length)]
            const prevTeamName = picked.team_id
              ? allTeams.find((t) => t.id === picked.team_id)?.name || 'Grid F1'
              : picked.category === 'f2'
                ? 'Fórmula 2'
                : 'Mercado Livre'

            const headline = `🚨 Silly Season R${round}: ${targetTeamName} fecha pré-contrato com ${picked.name} para ${currentYear + 1}!`
            const details = `Em movimento estratégico antecipado na rodada ${round}, a escuderia rival garante o assento do piloto para o ano seguinte.`
            const move: MarketMoveEvent = {
              id: `mid_sign_${round}_${picked.id}_${Date.now()}`,
              type: picked.category === 'f2' ? 'promocao' : 'transferencia',
              driverName: picked.name,
              driverAge: picked.age,
              previousTeam: prevTeamName,
              newTeam: targetTeamName,
              salary: Math.round(picked.salary * 1.15),
              headline,
              details,
              impact: 'alto',
            }
            moves.push(move)
            try {
              await pb.collection('drivers').update(picked.id, {
                next_team_id: targetTeam.id,
                next_contract_role: 'titular',
              })
              await this.addEvent(teamId, headline, 'contrato')
            } catch (err) {
              console.warn('Erro ao atualizar contratação rival:', err)
            }
          }
        } else {
          // Promoção de jovem talento da F2
          const f2Candidates = candidateDrivers.filter(
            (d) =>
              d.category === 'f2' &&
              d.next_team_id !== teamId &&
              !moves.some((m) => m.driverName === d.name),
          )
          if (f2Candidates.length > 0) {
            const picked = f2Candidates[Math.floor(Math.random() * f2Candidates.length)]
            const headline = `⭐ Revelação da F2: ${picked.name} assina com a ${targetTeamName} para ${currentYear + 1}!`
            const details = `O destaque das categorias de base foi contratado na Silly Season e estreará na F1 na próxima temporada.`
            const move: MarketMoveEvent = {
              id: `mid_f2_${round}_${picked.id}_${Date.now()}`,
              type: 'promocao',
              driverName: picked.name,
              driverAge: picked.age,
              previousTeam: 'Fórmula 2',
              newTeam: targetTeamName,
              headline,
              details,
              impact: 'medio',
            }
            moves.push(move)
            try {
              await pb.collection('drivers').update(picked.id, {
                next_team_id: targetTeam.id,
                next_contract_role: 'titular',
              })
              await this.addEvent(teamId, headline, 'contrato')
            } catch (err) {
              console.warn('Erro ao promover piloto F2 rival:', err)
            }
          }
        }
      }

      // Adiciona aos market_moves da season para histórico persistente
      if (moves.length > 0) {
        try {
          const currentSeason = await pb.collection('seasons').getOne<SeasonModel>(seasonId)
          const existingMoves = currentSeason.market_moves || []
          await pb.collection('seasons').update(seasonId, {
            market_moves: [...existingMoves, ...moves],
          })
        } catch (err) {
          console.warn('Erro ao persistir market_moves parciais na temporada:', err)
        }
      }

      return moves
    } catch (e) {
      console.error('Erro ao processar Silly Season intermediária:', e)
      return []
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
              next_team_id: null,
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
          (d.contract_end || 2026) <= currentYear &&
          !moves.some((m) => m.driverName === d.name) &&
          !d.next_team_id, // Se já assinou pré-contrato para o próximo ano, não gera evento de vácuo
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
            next_team_id: destinationTeam.id,
            next_contract_role: 'titular',
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
            next_team_id: targetTeam.id,
            next_contract_role: 'titular',
            age: d.age + 1,
          })
        }
      }

      // Se não gerou nenhum movimento, recuperar histórico já registrado durante a temporada ou defaults
      try {
        const seasonRec = await pb.collection('seasons').getOne<SeasonModel>(seasonId)
        if (seasonRec?.market_moves && seasonRec.market_moves.length > 0) {
          moves.push(...seasonRec.market_moves)
        }
      } catch {
        /* intentionally ignored */
      }

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

      // Salvar todos os movimentos acumulados no registro da temporada atual
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
      // 1. PREMIAÇÃO FIA DE CONSTRUTORES (P1: R$ 175M até P12: R$ 70M)
      const prizeAmount = this.CONSTRUCTOR_PRIZE_BY_RANK[playerFinalConstructorRank] || 70000000
      try {
        const teamRec = await pb.collection('teams').getOne<TeamModel>(teamId)
        const updatedBudget = (teamRec.budget || 0) + prizeAmount
        await pb.collection('teams').update(teamId, {
          budget: updatedBudget,
          cost_cap_spent: 0, // Novo teto de gastos no novo ano
          constructors_points_deduction: 0,
          rd_penalty_rounds_left: 0,
        })
        await this.addEvent(
          teamId,
          `🏆 PREMIAÇÃO FIA DE CONSTRUTORES: P${playerFinalConstructorRank} conquistado! Repasse anual de R$ ${(prizeAmount / 1000000).toFixed(0)}M creditado nos cofres da equipe para financiar a temporada ${nextYear}!`,
          'patrocinio',
        )
      } catch (err: any) {
        console.error('Erro ao creditar premiação anual de construtores:', err)
        throw new Error(
          `Falha ao creditar premiação de construtores da FIA: ${err?.message || err}`,
        )
      }

      // 2. MIGRAÇÃO CRÍTICA DE PRÉ-CONTRATOS (OBRIGATÓRIO SEM SILÊNCIO)
      // Executado com prioridade máxima para que o grid da nova temporada seja consolidado
      const migratedDriverIds = new Set<string>()
      try {
        const driversWithNext = await pb.collection('drivers').getFullList<DriverModel>({
          filter: 'next_team_id != null && next_team_id != ""',
        })

        const migrationErrors: string[] = []

        for (const d of driversWithNext) {
          try {
            const nextTeam = d.next_team_id
            const nextRole = d.next_contract_role || 'titular'

            if (nextRole === 'reserva') {
              await pb.collection('drivers').update(d.id, {
                team_id: null,
                reserve_team_id: nextTeam,
                role: 'reserva',
                category: 'f1',
                next_team_id: null,
                next_contract_role: null,
                contract_end: nextYear + 1,
              })
            } else {
              await pb.collection('drivers').update(d.id, {
                team_id: nextTeam,
                reserve_team_id: null,
                role: 'titular',
                category: 'f1',
                next_team_id: null,
                next_contract_role: null,
                contract_end: nextYear + 1,
              })
            }
            migratedDriverIds.add(d.id)
          } catch (driverErr: any) {
            console.error(`Falha ao migrar pré-contrato de ${d.name}:`, driverErr)
            migrationErrors.push(`${d.name}: ${driverErr?.message || driverErr}`)
          }
        }

        if (migrationErrors.length > 0) {
          throw new Error(
            `Falha na efetivação de contratos (${migrationErrors.length} piloto(s)): ${migrationErrors.join('; ')}`,
          )
        }
      } catch (migErr: any) {
        console.error('Erro ao migrar pilotos com pré-contrato na troca de temporada:', migErr)
        throw new Error(`Falha crítica na migração dos pré-contratos: ${migErr?.message || migErr}`)
      }

      // 2.1 APOSENTADORIA DE VETERANOS (executada antes do mercado da IA)
      // Regra: idade >= 40 e contract_end <= (nextYear - 1), OU idade >= 45 em qualquer caso
      try {
        const allDriversForRetirement = await pb.collection('drivers').getFullList<DriverModel>()
        for (const d of allDriversForRetirement) {
          const contractEnd = d.contract_end || nextYear - 1
          const shouldRetire = (d.age >= 40 && contractEnd <= nextYear - 1) || d.age >= 45
          if (shouldRetire) {
            await pb.collection('drivers').update(d.id, {
              category: 'mercado',
              role: null,
              team_id: null,
              reserve_team_id: null,
              next_team_id: null,
              next_contract_role: null,
              salary: 0,
            })
            await this.addEvent(
              teamId,
              `🏁 APOSENTADORIA: A lenda ${d.name} encerrou sua carreira profissional aos ${d.age} anos!`,
              'contrato',
            )
          }
        }
      } catch (retErr: any) {
        console.error('Erro ao processar aposentadorias de pilotos:', retErr)
        throw new Error(
          `Falha crítica no processamento de aposentadorias: ${retErr?.message || retErr}`,
        )
      }

      // 2.2 MERCADO DA IA: COMPLETAR VAGAS DE TITULARES EM EQUIPES DA IA
      // Equipes de IA com menos de 2 titulares contratam os melhores pilotos livres por score (speed*0.6 + consistency*0.4)
      try {
        const allTeamsForMarket = await pb.collection('teams').getFullList<TeamModel>({
          sort: '-strength',
        })
        const aiTeams = allTeamsForMarket.filter((t) => t.id !== teamId)

        const allDriversAfterRetirement = await pb.collection('drivers').getFullList<DriverModel>()

        // Contar titulares atuais por equipe
        const teamTitularCount = new Map<string, number>()
        aiTeams.forEach((t) => teamTitularCount.set(t.id, 0))

        allDriversAfterRetirement.forEach((d) => {
          if (d.team_id && d.role === 'titular' && teamTitularCount.has(d.team_id)) {
            teamTitularCount.set(d.team_id, (teamTitularCount.get(d.team_id) || 0) + 1)
          }
        })

        // Pilotos ativos elegíveis para o mercado da IA
        const freeDriversPool = allDriversAfterRetirement.filter((d) => {
          const contractEnd = d.contract_end || nextYear - 1
          const isRetired = (d.age >= 40 && contractEnd <= nextYear - 1) || d.age >= 45
          if (isRetired) return false
          if (d.team_id && d.role === 'titular') return false
          return true
        })

        // Ordenar pilotos por score decrescente
        freeDriversPool.sort((a, b) => {
          const scoreA = (a.speed || 75) * 0.6 + (a.consistency || 75) * 0.4
          const scoreB = (b.speed || 75) * 0.6 + (b.consistency || 75) * 0.4
          return scoreB - scoreA
        })

        let poolPtr = 0
        // Ordenar equipes de IA por força decrescente (já ordenado pelo sort PocketBase)
        for (const aiTeam of aiTeams) {
          const currentCount = teamTitularCount.get(aiTeam.id) || 0
          let needed = 2 - currentCount
          while (needed > 0 && poolPtr < freeDriversPool.length) {
            const chosenDriver = freeDriversPool[poolPtr++]
            await pb.collection('drivers').update(chosenDriver.id, {
              team_id: aiTeam.id,
              role: 'titular',
              category: 'f1',
              contract_end: nextYear + 2,
              next_team_id: null,
              next_contract_role: null,
            })
            needed--
            teamTitularCount.set(aiTeam.id, (teamTitularCount.get(aiTeam.id) || 0) + 1)
          }
        }
      } catch (aiMarketErr: any) {
        console.error('Erro ao processar mercado da IA na virada de temporada:', aiMarketErr)
        throw new Error(`Falha crítica no mercado da IA: ${aiMarketErr?.message || aiMarketErr}`)
      }

      // 2.3 IDENTIFICAR CAMPEÃO DE PILOTOS DA TEMPORADA ANTERIOR
      let championDriverId: string | null = null
      let championDriverName: string | null = null
      try {
        const seasonRaceResults = await pb.collection('race_results').getFullList({
          filter: `season_id='${currentSeasonId}'`,
        })

        if (seasonRaceResults.length > 0) {
          const driverPtsMap = new Map<string, number>()
          seasonRaceResults.forEach((r: any) => {
            const dId = r.driver_id
            if (dId) {
              driverPtsMap.set(dId, (driverPtsMap.get(dId) || 0) + (r.points || 0))
            }
          })

          let maxPts = -1
          for (const [dId, pts] of driverPtsMap.entries()) {
            if (pts > maxPts) {
              maxPts = pts
              championDriverId = dId
            }
          }
        }

        // Fallback: se não tiver pontos ou registros na tabela, buscar piloto da equipe campeã de construtores
        if (!championDriverId) {
          const sortedTeams = await pb.collection('teams').getFullList<TeamModel>({
            sort: '-points,-strength',
          })
          if (sortedTeams.length > 0) {
            const topTeam = sortedTeams[0]
            const topTeamDrivers = await pb.collection('drivers').getFullList<DriverModel>({
              filter: `team_id='${topTeam.id}' && role='titular'`,
              sort: '-speed',
            })
            if (topTeamDrivers.length > 0) {
              championDriverId = topTeamDrivers[0].id
              championDriverName = topTeamDrivers[0].name
            }
          }
        }
      } catch (champErr) {
        console.warn('Aviso ao determinar campeão da temporada:', champErr)
      }

      // 3. LIMPEZA TOTAL DE RESULTADOS DE CORRIDA E RELATÓRIOS DA TEMPORADA ANTERIOR
      // Garante que a classificação do novo ano inicie estritamente zerada
      try {
        const results = await pb.collection('race_results').getFullList({
          filter: `season_id='${currentSeasonId}'`,
        })
        for (const r of results) {
          await pb.collection('race_results').delete(r.id)
        }
      } catch (err: any) {
        console.error('Erro ao limpar resultados de corrida anteriores:', err)
        throw new Error(`Falha ao zerar resultados da temporada anterior: ${err?.message || err}`)
      }

      try {
        const reports = await pb.collection('race_reports').getFullList({
          filter: `season_id='${currentSeasonId}'`,
        })
        for (const rep of reports) {
          await pb.collection('race_reports').delete(rep.id)
        }
      } catch (repErr) {
        console.warn('Aviso ao limpar relatórios antigos:', repErr)
      }

      // 4. RESET DE SETUPS E TELEMETRIA DE SESSÃO
      try {
        const setups = await pb.collection('session_setups').getFullList({
          filter: `season_id='${currentSeasonId}'`,
        })
        for (const s of setups) {
          await pb.collection('session_setups').delete(s.id)
        }
      } catch (err: any) {
        console.error('Erro ao limpar setups anteriores:', err)
        throw new Error(`Falha ao limpar setups da temporada anterior: ${err?.message || err}`)
      }

      // 5. RENEGOCIAÇÃO DE PATROCÍNIOS DA EQUIPE PARA A NOVA TEMPORADA
      try {
        const teamSponsors = await pb.collection('sponsors').getFullList<SponsorModel>({
          filter: `team_id='${teamId}'`,
        })
        const { multiplier, explanation } = this.calculateSponsorMultiplier({
          constructorPos: playerFinalConstructorRank,
        })
        for (const sp of teamSponsors) {
          const recalculatedValue = Math.round(sp.value_per_round * multiplier)
          await pb.collection('sponsors').update(sp.id, {
            value_per_round: recalculatedValue,
            rounds_remaining: 24,
            status: 'ativo',
          })
        }
        await this.addEvent(
          teamId,
          `📈 RENEGOCIAÇÃO DE PATROCÍNIOS: Contratos ajustados em ${multiplier >= 1 ? `+${Math.round((multiplier - 1) * 100)}%` : `-${Math.round((1 - multiplier) * 100)}%`} devido ao desempenho de construtores (${explanation}).`,
          'patrocinio',
        )
      } catch (spErr) {
        console.warn('Aviso ao renegociar patrocínios na nova temporada:', spErr)
      }

      // 6. RESET DE FÍSICA E MORAL DOS PILOTOS NA VIRADA DE TEMPORADA
      // Regras:
      // - Física = 100 para TODOS os drivers (category='f1', mercado e reservas) — férias de pré-temporada;
      // - Moral = 50 para todos os drivers, EXCETO:
      //   * Campeão de pilotos da temporada anterior: moral 80;
      //   * Pilotos que RENOVARAM contrato com a mesma equipe (team_id inalterado pela migração): moral 65;
      try {
        const allDrivers = await pb.collection('drivers').getFullList<DriverModel>()
        const driverResetErrors: string[] = []

        for (const d of allDrivers) {
          try {
            const isChampion = championDriverId ? d.id === championDriverId : false
            const isRenewed =
              !migratedDriverIds.has(d.id) && Boolean(d.team_id) && d.role === 'titular'

            let targetMorale = 50
            if (isChampion) {
              targetMorale = 80
            } else if (isRenewed) {
              targetMorale = 65
            }

            await pb.collection('drivers').update(d.id, {
              physical_condition: 100,
              morale: targetMorale,
              is_incapacitated: false,
              incapacitated_rounds_left: 0,
              incapacitated_reason: '',
            })
          } catch (drvErr: any) {
            console.error(`Erro ao resetar física e moral de ${d.name}:`, drvErr)
            driverResetErrors.push(`${d.name}: ${drvErr?.message || drvErr}`)
          }
        }

        if (driverResetErrors.length > 0) {
          throw new Error(
            `Falha ao resetar condição dos pilotos (${driverResetErrors.length}): ${driverResetErrors.join('; ')}`,
          )
        }
      } catch (drvResetErr: any) {
        console.error('Erro crítico no reset de física e moral dos pilotos:', drvResetErr)
        throw new Error(
          `Falha crítica no reset de pilotos para a pré-temporada: ${drvResetErr?.message || drvResetErr}`,
        )
      }

      // 6.1 RESET DE MOTOR E PEÇAS PARA O NOVO ANO
      try {
        await pb.collection('teams').update(teamId, {
          active_engine_wear: 0,
          engine_pool_used: 1,
          cost_cap_spent: 0,
          constructors_points_deduction: 0,
          rd_penalty_rounds_left: 0,
        })
      } catch (err: any) {
        console.error('Erro ao resetar motor da equipe:', err)
        throw new Error(`Falha ao resetar motor da equipe: ${err?.message || err}`)
      }

      try {
        const teamParts = await pb.collection('parts').getFullList<PartModel>({
          filter: `team_id='${teamId}'`,
        })
        for (const p of teamParts) {
          await pb.collection('parts').update(p.id, {
            condition: 100,
          })
        }
      } catch (err: any) {
        console.error('Erro ao restaurar peças para a nova temporada:', err)
        throw new Error(`Falha ao restaurar peças para a nova temporada: ${err?.message || err}`)
      }

      // 7. ATUALIZAÇÃO DO REGISTRO DE TEMPORADA
      // Inicia a nova temporada no Round 1, zera last_processed_round e market_moves
      const updatedSeason = await pb.collection('seasons').update<SeasonModel>(currentSeasonId, {
        year: nextYear,
        current_round: 1,
        total_rounds: 24,
        market_moves: null,
        last_processed_round: 0,
      })

      // 8. LOG DE EVENTO ANÚNCIO DE NOVA TEMPORADA
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
    } catch (e: any) {
      console.error('Erro crítico ao iniciar próxima temporada:', e)
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
