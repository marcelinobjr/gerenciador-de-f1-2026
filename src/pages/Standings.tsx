import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { DriverModel, RaceResultModel } from '@/types/f1'
import { getAICompetitors } from '@/lib/f1-data'
import { Trophy, Award, Users, Flag, TrendingUp, ShieldCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface DriverStanding {
  id: string
  name: string
  nationality: string
  flag: string
  teamName: string
  teamColor: string
  points: number
  wins: number
  podiums: number
  isPlayer: boolean
}

interface TeamStanding {
  id: string
  name: string
  color: string
  engine: string
  points: number
  wins: number
  isPlayer: boolean
}

export default function StandingsPage() {
  const { team, season } = useAuth()

  const [activeTab, setActiveTab] = useState<'drivers' | 'constructors'>('drivers')
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [playerDrivers, setPlayerDrivers] = useState<DriverModel[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    if (!season || !team) {
      setLoading(false)
      return
    }
    try {
      const [rList, dList] = await Promise.all([
        f1Service.getSeasonRaceResults(season.id),
        f1Service.getTeamDrivers(team.id),
      ])
      setRaceResults(rList)
      setPlayerDrivers(dList)
    } catch (err) {
      console.error('Error loading standings data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [season?.id, team?.id])

  useRealtime('race_results', () => {
    loadData()
  })

  // Flag helper
  const getFlag = (nat: string) => {
    switch (nat?.toLowerCase()) {
      case 'brasil':
      case 'bra':
        return '🇧🇷'
      case 'reino unido':
      case 'gbr':
        return '🇬🇧'
      case 'holanda':
      case 'ned':
        return '🇳🇱'
      case 'mônaco':
      case 'mon':
        return '🇲🇨'
      case 'austrália':
      case 'aus':
        return '🇦🇺'
      case 'espanha':
      case 'esp':
        return '🇪🇸'
      case 'argentina':
      case 'arg':
        return '🇦🇷'
      case 'japão':
      case 'jpn':
        return '🇯🇵'
      case 'alemanha':
      case 'ger':
        return '🇩🇪'
      case 'frança':
      case 'fra':
        return '🇫🇷'
      case 'tailândia':
      case 'tha':
        return '🇹🇭'
      case 'canadá':
      case 'can':
        return '🇨🇦'
      case 'itália':
      case 'ita':
        return '🇮🇹'
      default:
        return '🏁'
    }
  }

  // Calculate aggregated standings
  const { driverStandings, constructorStandings } = useMemo(() => {
    const currentRound = season?.current_round || 1
    const pastRounds = Math.max(0, currentRound - 1)

    // Determine if player has custom 12th team or operates an official one
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiGrid = getAICompetitors(team?.team_key, isCustomTeam)

    // 1. Drivers map
    const dMap: Record<string, DriverStanding> = {}

    // Init player drivers
    playerDrivers.forEach((d) => {
      dMap[d.id] = {
        id: d.id,
        name: d.name,
        nationality: d.nationality,
        flag: getFlag(d.nationality),
        teamName: team?.name || 'Escuderia Brasil',
        teamColor: team?.color || '#FF3B30',
        points: 0,
        wins: 0,
        podiums: 0,
        isPlayer: true,
      }
    })

    // Init AI Drivers from dynamic grid
    aiGrid.forEach((aiTeam) => {
      // Estimated points factoring both driver speed and team strength
      const teamMultiplier = aiTeam.strength / 80
      const d1BasePts = Math.max(
        0,
        Math.round((aiTeam.driver1.speed - 75) * 0.4 * pastRounds * teamMultiplier),
      )
      const d2BasePts = Math.max(
        0,
        Math.round((aiTeam.driver2.speed - 75) * 0.3 * pastRounds * teamMultiplier),
      )

      dMap[`${aiTeam.id}_d1`] = {
        id: `${aiTeam.id}_d1`,
        name: aiTeam.driver1.name,
        nationality: aiTeam.driver1.nationality,
        flag: aiTeam.driver1.flag,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        points: d1BasePts,
        wins: d1BasePts > 50 ? Math.floor(d1BasePts / 40) : 0,
        podiums: d1BasePts > 30 ? Math.floor(d1BasePts / 25) : 0,
        isPlayer: false,
      }

      dMap[`${aiTeam.id}_d2`] = {
        id: `${aiTeam.id}_d2`,
        name: aiTeam.driver2.name,
        nationality: aiTeam.driver2.nationality,
        flag: aiTeam.driver2.flag,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        points: d2BasePts,
        wins: d2BasePts > 60 ? 1 : 0,
        podiums: d2BasePts > 30 ? Math.floor(d2BasePts / 30) : 0,
        isPlayer: false,
      }
    })

    // Aggregate real race_results from DB for player drivers
    raceResults.forEach((res) => {
      if (dMap[res.driver_id]) {
        dMap[res.driver_id].points += res.points || 0
        if (res.position === 1) dMap[res.driver_id].wins += 1
        if (res.position <= 3) dMap[res.driver_id].podiums += 1
      }
    })

    const sortedDrivers = Object.values(dMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return b.wins - a.wins
    })

    // 2. Teams map
    const tMap: Record<string, TeamStanding> = {}

    // Init AI Teams from dynamic grid
    aiGrid.forEach((aiTeam) => {
      const p1 = dMap[`${aiTeam.id}_d1`]?.points || 0
      const p2 = dMap[`${aiTeam.id}_d2`]?.points || 0
      const w1 = dMap[`${aiTeam.id}_d1`]?.wins || 0
      const w2 = dMap[`${aiTeam.id}_d2`]?.wins || 0

      tMap[aiTeam.id] = {
        id: aiTeam.id,
        name: aiTeam.name,
        color: aiTeam.color,
        engine: aiTeam.engine,
        points: p1 + p2,
        wins: w1 + w2,
        isPlayer: false,
      }
    })

    // Player team
    let playerTeamPts = 0
    let playerTeamWins = 0
    playerDrivers.forEach((d) => {
      if (dMap[d.id]) {
        playerTeamPts += dMap[d.id].points
        playerTeamWins += dMap[d.id].wins
      }
    })

    tMap[team?.id || 'player'] = {
      id: team?.id || 'player',
      name: team?.name || 'Escuderia Brasil',
      color: team?.color || '#FF3B30',
      engine: team?.engine_supplier || 'Mercedes',
      points: playerTeamPts,
      wins: playerTeamWins,
      isPlayer: true,
    }

    const sortedTeams = Object.values(tMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      return b.wins - a.wins
    })

    return {
      driverStandings: sortedDrivers,
      constructorStandings: sortedTeams,
    }
  }, [raceResults, playerDrivers, team, season])

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-[#E10600] uppercase">
            Tabela Oficial do Campeonato Mundial
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA] mt-1">
            Classificação Geral F1 2026
          </h1>
          <p className="text-sm text-[#8B95A7] mt-0.5">
            Grid oficial com{' '}
            {team?.is_custom ? '12 equipes (11 oficiais + 12ª sua escuderia)' : '11 equipes'} •
            Pontuação, vitórias e pódios ao longo das 24 etapas.
          </p>
        </div>
      </div>

      {/* Tabs Pilotos / Construtores */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList className="bg-[#11161F] border border-[#1F2733]">
            <TabsTrigger
              value="drivers"
              className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white font-semibold text-xs sm:text-sm"
            >
              <Users className="w-4 h-4 mr-1.5" />
              Campeonato de Pilotos
            </TabsTrigger>
            <TabsTrigger
              value="constructors"
              className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white font-semibold text-xs sm:text-sm"
            >
              <Trophy className="w-4 h-4 mr-1.5" />
              Campeonato de Construtores
            </TabsTrigger>
          </TabsList>

          <span className="text-xs font-mono text-[#8B95A7] hidden sm:inline">
            Rodada {season?.current_round || 1} de {season?.total_rounds || 24}
          </span>
        </div>

        {/* Pilotos Tab */}
        <TabsContent value="drivers">
          <Card className="bg-[#11161F] border-[#1F2733]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                <Award className="w-5 h-5 text-[#E10600]" />
                Mundial de Pilotos — Temporada 2026
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                Seus pilotos destacados em negrito na cor da sua escuderia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full bg-[#1F2733]" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1F2733] text-[#8B95A7] uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-14">Pos</th>
                        <th className="py-2.5 px-3">Piloto</th>
                        <th className="py-2.5 px-3">Escuderia</th>
                        <th className="py-2.5 px-3 text-center">Vitórias</th>
                        <th className="py-2.5 px-3 text-center">Pódios</th>
                        <th className="py-2.5 px-4 text-right">Pontos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F2733]/60">
                      {driverStandings.map((driver, index) => {
                        const pos = index + 1
                        return (
                          <tr
                            key={driver.id}
                            className={`transition-colors ${
                              driver.isPlayer
                                ? 'bg-[#E10600]/10 font-bold border-l-4 border-l-[#E10600]'
                                : 'hover:bg-[#161D29]/40'
                            }`}
                          >
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold ${
                                  pos === 1
                                    ? 'bg-amber-400 text-black'
                                    : pos === 2
                                      ? 'bg-slate-300 text-black'
                                      : pos === 3
                                        ? 'bg-amber-700 text-white'
                                        : 'text-[#8B95A7]'
                                }`}
                              >
                                {pos}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span>{driver.flag}</span>
                                <span
                                  className={
                                    driver.isPlayer
                                      ? 'font-extrabold text-[#F5F7FA] text-sm'
                                      : 'text-[#F5F7FA]'
                                  }
                                >
                                  {driver.name}
                                </span>
                                {driver.isPlayer && (
                                  <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-4">
                                    Sua Equipe
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span style={{ color: driver.teamColor }} className="text-xs">
                                {driver.teamName}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center text-[#F5F7FA]">
                              {driver.wins > 0 ? (
                                <strong className="text-amber-400">{driver.wins}</strong>
                              ) : (
                                <span className="text-[#8B95A7]">0</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center text-[#F5F7FA]">
                              {driver.podiums}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <strong
                                className={`text-base ${
                                  driver.isPlayer ? 'text-[#00A6FB]' : 'text-[#F5F7FA]'
                                }`}
                              >
                                {driver.points}
                              </strong>
                              <span className="text-[10px] text-[#8B95A7] ml-1">pts</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Construtores Tab */}
        <TabsContent value="constructors">
          <Card className="bg-[#11161F] border-[#1F2733]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Mundial de Construtores — Temporada 2026
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                A pontuação acumulada define o prêmio de final de temporada e a moral da escuderia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full bg-[#1F2733]" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1F2733] text-[#8B95A7] uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-14">Pos</th>
                        <th className="py-2.5 px-3">Equipe</th>
                        <th className="py-2.5 px-3">Motor 50/50</th>
                        <th className="py-2.5 px-3 text-center">Vitórias</th>
                        <th className="py-2.5 px-4 text-right">Pontos Totais</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F2733]/60">
                      {constructorStandings.map((cTeam, index) => {
                        const pos = index + 1
                        return (
                          <tr
                            key={cTeam.id}
                            className={`transition-colors ${
                              cTeam.isPlayer
                                ? 'bg-[#E10600]/15 font-bold border-l-4 border-l-[#E10600]'
                                : 'hover:bg-[#161D29]/40'
                            }`}
                          >
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold ${
                                  pos === 1
                                    ? 'bg-amber-400 text-black'
                                    : pos === 2
                                      ? 'bg-slate-300 text-black'
                                      : pos === 3
                                        ? 'bg-amber-700 text-white'
                                        : 'text-[#8B95A7]'
                                }`}
                              >
                                {pos}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: cTeam.color }}
                                />
                                <span
                                  className={`text-sm ${
                                    cTeam.isPlayer
                                      ? 'font-extrabold text-white underline decoration-[#E10600] decoration-2'
                                      : 'text-[#F5F7FA]'
                                  }`}
                                >
                                  {cTeam.name}
                                </span>
                                {cTeam.isPlayer && (
                                  <Badge className="bg-[#E10600] text-white text-[9px] px-1.5 py-0 h-4">
                                    Sua Escuderia
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-[#8B95A7]">{cTeam.engine}</td>
                            <td className="py-3 px-3 text-center text-[#F5F7FA]">
                              {cTeam.wins > 0 ? (
                                <strong className="text-amber-400">{cTeam.wins}</strong>
                              ) : (
                                <span className="text-[#8B95A7]">0</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <strong
                                className={`text-base ${
                                  cTeam.isPlayer ? 'text-[#00A6FB]' : 'text-[#F5F7FA]'
                                }`}
                              >
                                {cTeam.points}
                              </strong>
                              <span className="text-[10px] text-[#8B95A7] ml-1">pts</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
