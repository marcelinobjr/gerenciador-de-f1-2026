import { f1Service } from './f1Service'
import { standingsService } from './standingsService'
import type {
  RaceReportData,
  RaceReportModel,
  DriverPostRaceSummary,
  RadioHighlight,
  ConstructorPositionDelta,
  TireCompound,
  DriverModel,
  TeamModel,
  SeasonModel,
  RaceResultModel,
} from '@/types/f1'

export interface GenerateReportParams {
  round: number
  gpInfo: {
    name: string
    circuit: string
    country?: string
    flag?: string
    laps: number
  }
  finalGrid: any[]
  raceIncidents: string[]
  liveEvents: any[]
  team: TeamModel
  season: SeasonModel
  drivers: DriverModel[]
  previousRaceResults: RaceResultModel[] // resultados até round - 1
  currentRaceResults: RaceResultModel[] // resultados incluindo o round atual
}

export const raceReportService = {
  /**
   * Constrói os dados consolidados do relatório pós-corrida da equipe do jogador.
   */
  generateReportData(params: GenerateReportParams): RaceReportData {
    const {
      round,
      gpInfo,
      finalGrid = [],
      raceIncidents = [],
      liveEvents = [],
      team,
      season,
      drivers = [],
      previousRaceResults = [],
      currentRaceResults = [],
    } = params

    // 1. Pilotos da equipe do jogador no grid final
    const playerGridEntries = finalGrid.filter((g) => g.isPlayer)
    const playerDriversList = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team?.id)

    // 2. Extrai rádio highlights da corrida (melhores rádios dos pilotos da equipe)
    const radioEvents = liveEvents.filter(
      (ev) => ev.type === 'team_radio' || (ev.message && ev.message.includes('📻 RÁDIO')),
    )

    const radioHighlights: RadioHighlight[] = radioEvents.slice(0, 5).map((rev, idx) => {
      // Formato típico: "📻 RÁDIO (Nome): "msg" ➔ Pit Wall: [ORDEM] ➔ Piloto: "feedback""
      const raw = rev.message || ''
      let driverMsg = raw
      let bossResp = ''
      let driverFeed = ''

      const match = raw.match(
        /📻 RÁDIO \(([^)]+)\): "([^"]+)" ➔ Pit Wall: \[([^\]]+)\] ➔ Piloto: "([^"]+)"/,
      )
      if (match) {
        return {
          id: rev.id || `rad_${idx}`,
          lap: rev.lap || 1,
          driverName: match[1],
          driverMessage: match[2],
          bossResponse: match[3],
          driverFeedback: match[4],
        }
      }

      return {
        id: rev.id || `rad_${idx}`,
        lap: rev.lap || 1,
        driverName: rev.driverName || 'Piloto',
        driverMessage: driverMsg.replace(/^📻 RÁDIO[^:]*:\s*/, ''),
        bossResponse: bossResp,
        driverFeedback: driverFeed,
      }
    })

    // 3. Incidentes envolvendo a equipe
    const playerDriverNames = [
      ...playerDriversList.map((d) => d.name.toLowerCase()),
      ...playerGridEntries.map((g) => (g.driverName || '').toLowerCase()),
      (team?.name || '').toLowerCase(),
    ]

    const teamIncidents = raceIncidents.filter((inc) => {
      const lower = inc.toLowerCase()
      return playerDriverNames.some((pName) => pName && lower.includes(pName))
    })

    // 4. Sumário dos 2 pilotos da equipe
    let teamPointsTotal = 0
    const teamDriversSummary: DriverPostRaceSummary[] = playerGridEntries.map((entry) => {
      const matchedDriver = drivers.find((d) => d.id === entry.driverId)
      const pts = typeof entry.points === 'number' ? entry.points : 0
      teamPointsTotal += pts

      // Stints e Paradas
      const startComp: TireCompound = entry.tireCompound || 'medio'
      const secondComp: TireCompound = entry.secondCompound || 'duro'
      const pitCount = entry.pitStopsDone || (entry.secondCompound ? 1 : 0)

      const pitStops: { lap: number; toCompound: TireCompound; durationSec?: number }[] = []
      const stints: {
        compound: TireCompound
        startLap: number
        endLap: number
        lapsDone: number
        wearAtEnd?: number
      }[] = []

      if (pitCount > 0) {
        const estPitLap = Math.max(1, Math.round(gpInfo.laps * 0.45))
        pitStops.push({
          lap: estPitLap,
          toCompound: secondComp,
          durationSec: 2.5,
        })

        stints.push({
          compound: startComp,
          startLap: 1,
          endLap: estPitLap,
          lapsDone: estPitLap,
          wearAtEnd: 72,
        })
        stints.push({
          compound: secondComp,
          startLap: estPitLap + 1,
          endLap: gpInfo.laps,
          lapsDone: gpInfo.laps - estPitLap,
          wearAtEnd: entry.tireWear || 65,
        })
      } else {
        stints.push({
          compound: startComp,
          startLap: 1,
          endLap: gpInfo.laps,
          lapsDone: gpInfo.laps,
          wearAtEnd: entry.tireWear || 80,
        })
      }

      return {
        driverId: entry.driverId,
        driverName: entry.driverName || matchedDriver?.name || 'Piloto',
        nationality: entry.nationality || matchedDriver?.nationality,
        flag: entry.flag,
        finalPosition: entry.dnf ? 99 : entry.position,
        points: pts,
        fastestLap: !!entry.fastestLap,
        dnf: !!entry.dnf,
        dnfReason: entry.dnfReason,
        totalTime: entry.totalTime || (entry.dnf ? 'DNF' : 'Tempo Concluído'),
        stints,
        pitStops,
        oldMorale: entry.oldMorale,
        newMorale: entry.newMorale,
        oldPhysical: entry.oldPhysical,
        newPhysical: entry.newPhysical,
      }
    })

    // 5. Standings antes ⇄ depois via standingsService
    const standingsBefore = standingsService.calculateStandings({
      raceResults: previousRaceResults,
      playerDrivers: playerDriversList,
      team,
      season,
    })

    const standingsAfter = standingsService.calculateStandings({
      raceResults: currentRaceResults,
      playerDrivers: playerDriversList,
      team,
      season,
    })

    const rankBefore = standingsBefore.playerConstructorRank
    const rankAfter = standingsAfter.playerConstructorRank
    const ptsBefore = standingsBefore.teamPoints
    const ptsAfter = standingsAfter.teamPoints
    const ptsGained = Math.max(0, ptsAfter - ptsBefore)
    // rank menor é melhor (P1 é melhor que P4): se rankBefore=4 e rankAfter=3 => subiu 1 posição (+1)
    const positionDelta = rankBefore - rankAfter

    const constructorDelta: ConstructorPositionDelta = {
      rankBefore,
      rankAfter,
      pointsBefore: ptsBefore,
      pointsAfter: ptsAfter,
      pointsGained: ptsGained || teamPointsTotal,
      positionDelta,
    }

    // 6. Destaque do Melhor Momento
    let bestMoment = {
      title: 'Batalha Estratégica Completa',
      description: `A ${team.name} completou os ${gpInfo.laps} giros do traçado de ${gpInfo.circuit} somando ${teamPointsTotal} pontos para o Mundial.`,
      badge: 'Fim de Prova',
      driverName: teamDriversSummary[0]?.driverName,
    }

    const winnerDriver = teamDriversSummary.find((d) => d.finalPosition === 1)
    const podiumDriver = teamDriversSummary.find((d) => d.finalPosition <= 3 && !d.dnf)
    const pointsDriver = teamDriversSummary.find((d) => d.finalPosition <= 10 && !d.dnf)
    const flDriver = teamDriversSummary.find((d) => d.fastestLap)

    if (winnerDriver) {
      bestMoment = {
        title: `🏆 VITÓRIA TRIUNFAL EM ${gpInfo.name.toUpperCase()}!`,
        description: `${winnerDriver.driverName} dominou o pelotão e cruzou a linha de chegada no lugar mais alto do pódio (+25 pontos FIA).`,
        badge: 'Vitória P1',
        driverName: winnerDriver.driverName,
      }
    } else if (podiumDriver) {
      bestMoment = {
        title: `🥈 PÓDIO CONQUISTADO: ${podiumDriver.driverName.toUpperCase()} P${podiumDriver.finalPosition}!`,
        description: `Pilotagem de elite garantindo um lugar no pódio e valiosos ${podiumDriver.points} pontos para a escuderia.`,
        badge: `Pódio P${podiumDriver.finalPosition}`,
        driverName: podiumDriver.driverName,
      }
    } else if (flDriver) {
      bestMoment = {
        title: `⚡ VOLTA MAIS RÁPIDA: ${flDriver.driverName.toUpperCase()}!`,
        description: `${flDriver.driverName} registrou a volta mais rápida da corrida, provando a velocidade de ponta do pacote aerodinâmico.`,
        badge: 'Volta Mais Rápida (FL)',
        driverName: flDriver.driverName,
      }
    } else if (positionDelta > 0) {
      bestMoment = {
        title: `📈 SALTO NO MUNDIAL DE CONSTRUTORES (+${positionDelta} POSIÇÃO${positionDelta > 1 ? 'ÕES' : ''})`,
        description: `Com o resultado somado em ${gpInfo.name}, a ${team.name} subiu da P${rankBefore} para a P${rankAfter} na classificação oficial.`,
        badge: `Subida P${rankBefore} ➔ P${rankAfter}`,
        driverName: teamDriversSummary[0]?.driverName,
      }
    } else if (pointsDriver) {
      bestMoment = {
        title: `🎯 PONTOS GARANTIDOS: ${pointsDriver.driverName.toUpperCase()} P${pointsDriver.finalPosition}!`,
        description: `Entrada sólida na zona de pontos com ritmo consistente e execução limpa nos boxes.`,
        badge: `Top 10 (P${pointsDriver.finalPosition})`,
        driverName: pointsDriver.driverName,
      }
    }

    return {
      round,
      gpName: gpInfo.name,
      circuitName: gpInfo.circuit,
      country: gpInfo.country,
      flag: gpInfo.flag,
      date: new Date().toLocaleDateString('pt-BR'),
      totalLaps: gpInfo.laps,
      teamDrivers: teamDriversSummary,
      teamPoints: teamPointsTotal,
      constructorDelta,
      teamIncidents:
        teamIncidents.length > 0
          ? teamIncidents
          : ['Nenhum incidente crítico envolvendo os carros da equipe.'],
      allIncidents: raceIncidents,
      radioHighlights,
      bestMoment,
    }
  },

  /**
   * Salva o relatório consolidado no banco PocketBase
   */
  async saveReport(
    seasonId: string,
    teamId: string,
    data: RaceReportData,
  ): Promise<RaceReportModel> {
    return await f1Service.saveRaceReport(
      seasonId,
      teamId,
      data.round,
      data.gpName,
      data.circuitName,
      data.country || '',
      data,
    )
  },

  /**
   * Busca um relatório por rodada e temporada
   */
  async getReport(seasonId: string, round: number): Promise<RaceReportModel | null> {
    return await f1Service.getRaceReport(seasonId, round)
  },

  /**
   * Busca todos os relatórios da temporada
   */
  async getSeasonReports(seasonId: string): Promise<RaceReportModel[]> {
    return await f1Service.getSeasonRaceReports(seasonId)
  },
}
