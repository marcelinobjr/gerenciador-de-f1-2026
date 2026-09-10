import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { DriverModel, RaceResultModel } from '@/types/f1'
import { getAICompetitors } from '@/lib/f1-data'
import {
  simulateAiGridFiaStandings,
  normalizeEntityName,
  getFiaPointsForPosition,
} from '@/lib/f1-standings-calculator'
import { Trophy, Award, Users, Flag, Medal } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/formatters'

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
  bestPosition: number
  isPlayer: boolean
}

interface TeamStanding {
  id: string
  name: string
  color: string
  engine: string
  points: number
  wins: number
  podiums: number
  bestPosition: number
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

    // Determina se a rodada atual já possui resultados gravados
    const recordedRounds = new Set<number>()
    raceResults.forEach((r) => {
      if (typeof r.round === 'number') {
        recordedRounds.add(r.round)
      }
    })
    const hasRecordedResults = recordedRounds.size > 0

    // Se o banco tem resultados gravados para as rodadas, calculamos diretamente deles.
    // Caso a rodada atual esteja avançada sem corridas gravadas (fallback), simulamos pelas rodadas passadas
    // com a tabela oficial FIA.
    const pastRoundsToSimulate = hasRecordedResults ? 0 : Math.max(0, currentRound - 1)

    // Determine if player has custom 12th team or operates an official one
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiGrid = getAICompetitors(team?.team_key, isCustomTeam)

    const { driverStandingsMap: aiDriverStats, teamStandingsMap: aiTeamStats } =
      simulateAiGridFiaStandings(team?.team_key, isCustomTeam, pastRoundsToSimulate)

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
        bestPosition: 99,
        isPlayer: true,
      }
    })

    // Init AI Drivers from dynamic grid
    aiGrid.forEach((aiTeam) => {
      const d1Key = `${aiTeam.id}_d1`
      const d2Key = `${aiTeam.id}_d2`
      const d1Stat = aiDriverStats[d1Key] || { points: 0, wins: 0, podiums: 0, bestPos: 99 }
      const d2Stat = aiDriverStats[d2Key] || { points: 0, wins: 0, podiums: 0, bestPos: 99 }

      dMap[d1Key] = {
        id: d1Key,
        name: aiTeam.driver1.name,
        nationality: aiTeam.driver1.nationality,
        flag: aiTeam.driver1.flag,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        points: d1Stat.points,
        wins: d1Stat.wins,
        podiums: d1Stat.podiums,
        bestPosition: d1Stat.bestPos,
        isPlayer: false,
      }

      dMap[d2Key] = {
        id: d2Key,
        name: aiTeam.driver2.name,
        nationality: aiTeam.driver2.nationality,
        flag: aiTeam.driver2.flag,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        points: d2Stat.points,
        wins: d2Stat.wins,
        podiums: d2Stat.podiums,
        bestPosition: d2Stat.bestPos,
        isPlayer: false,
      }
    })

    // Prepara índices de busca rápida por ID e por nome normalizado
    const driverLookupByName: Record<string, DriverStanding> = {}
    const driverLookupByNormalizedSimple: Record<string, DriverStanding> = {}

    Object.values(dMap).forEach((d) => {
      const norm1 = normalizeEntityName(d.name)
      const norm2 = d.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '')
      driverLookupByName[norm1] = d
      driverLookupByNormalizedSimple[norm2] = d
    })

    // 2. Processa race_results reais persistidos no banco
    raceResults.forEach((res) => {
      // Tenta achar piloto por id direto
      let targetDriver = dMap[res.driver_id]

      // Se não achou, tenta pelo expand do PocketBase
      if (!targetDriver && res.expand?.driver_id?.name) {
        const normExp = normalizeEntityName(res.expand.driver_id.name)
        const normExpSimple = res.expand.driver_id.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]/g, '')
        targetDriver = driverLookupByName[normExp] || driverLookupByNormalizedSimple[normExpSimple]
      }

      // Se ainda não achou, tenta cruzar com banco local / nome direto de res se houver
      if (!targetDriver && (res as any).driverName) {
        const dName = (res as any).driverName
        const normDirect = normalizeEntityName(dName)
        const normDirectSimple = dName
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]/g, '')
        targetDriver =
          driverLookupByName[normDirect] || driverLookupByNormalizedSimple[normDirectSimple]
      }

      // Se ainda não achou, faz busca difusa nos nomes conhecidos do grid
      if (!targetDriver) {
        const allDrivers = Object.values(dMap)
        // Busca se algum nome de piloto contém ou é contido pelo expand
        const expName = res.expand?.driver_id?.name?.toLowerCase().trim()
        if (expName) {
          targetDriver = allDrivers.find((d) => {
            const dn = d.name.toLowerCase().trim()
            return dn === expName || dn.includes(expName) || expName.includes(dn)
          })
        }
      }

      if (targetDriver) {
        // Pontuação oficial FIA: usa res.points ou calcula da posição oficial caso salvo com 0
        const pts =
          typeof res.points === 'number' && res.points > 0
            ? res.points
            : getFiaPointsForPosition(res.position) +
              (res.fastest_lap && res.position <= 10 ? 1 : 0)

        targetDriver.points += pts

        if (res.position === 1) {
          targetDriver.wins += 1
          targetDriver.podiums += 1
        } else if (res.position <= 3) {
          targetDriver.podiums += 1
        }

        if (res.position < targetDriver.bestPosition) {
          targetDriver.bestPosition = res.position
        }
      }
    })

    // Ordenação de pilotos: Pontos DESC > Vitórias DESC > Pódios DESC > Melhor Posição ASC > Nome ASC
    const sortedDrivers = Object.values(dMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.podiums !== a.podiums) return b.podiums - a.podiums
      if (a.bestPosition !== b.bestPosition) return a.bestPosition - b.bestPosition
      return a.name.localeCompare(b.name)
    })

    // 3. Teams map (Construtores)
    const tMap: Record<string, TeamStanding> = {}

    // Init AI Teams from dynamic grid
    aiGrid.forEach((aiTeam) => {
      const d1 = dMap[`${aiTeam.id}_d1`]
      const d2 = dMap[`${aiTeam.id}_d2`]
      const pts = (d1?.points || 0) + (d2?.points || 0)
      const w = (d1?.wins || 0) + (d2?.wins || 0)
      const pod = (d1?.podiums || 0) + (d2?.podiums || 0)
      const best = Math.min(d1?.bestPosition ?? 99, d2?.bestPosition ?? 99)

      tMap[aiTeam.id] = {
        id: aiTeam.id,
        name: aiTeam.name,
        color: aiTeam.color,
        engine: aiTeam.engine,
        points: pts,
        wins: w,
        podiums: pod,
        bestPosition: best,
        isPlayer: false,
      }
    })

    // Player team
    let playerTeamPts = 0
    let playerTeamWins = 0
    let playerTeamPodiums = 0
    let playerTeamBestPos = 99

    playerDrivers.forEach((d) => {
      const standing = dMap[d.id]
      if (standing) {
        playerTeamPts += standing.points
        playerTeamWins += standing.wins
        playerTeamPodiums += standing.podiums
        if (standing.bestPosition < playerTeamBestPos) {
          playerTeamBestPos = standing.bestPosition
        }
      }
    })

    const playerTeamId = team?.id || 'player'
    tMap[playerTeamId] = {
      id: playerTeamId,
      name: team?.name || 'Escuderia Brasil',
      color: team?.color || '#FF3B30',
      engine: team?.engine_supplier || 'Mercedes',
      points: playerTeamPts,
      wins: playerTeamWins,
      podiums: playerTeamPodiums,
      bestPosition: playerTeamBestPos,
      isPlayer: true,
    }

    // Ordenação de equipes: Pontos DESC > Vitórias DESC > Pódios DESC > Melhor Posição ASC > Nome ASC
    const sortedTeams = Object.values(tMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.podiums !== a.podiums) return b.podiums - a.podiums
      if (a.bestPosition !== b.bestPosition) return a.bestPosition - b.bestPosition
      return a.name.localeCompare(b.name)
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
            Pontuação FIA (25-18-15-12-10-8-6-4-2-1), vitórias e pódios ao longo das 24 etapas.
          </p>
        </div>
      </div>

      {/* Tabs Pilotos / Construtores */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333]/90">
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
          <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333]/90 shadow-xl">
            <CardHeader className="pb-3 border-b border-[#1F2733]/60">
              <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                <Award className="w-5 h-5 text-[#E10600]" />
                Mundial de Pilotos — Temporada 2026
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                Seus pilotos destacados em negrito na cor da sua escuderia. Escala oficial FIA (25,
                18, 15, 12, 10, 8, 6, 4, 2, 1).
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
                                <strong className="text-amber-400 font-bold">{driver.wins}</strong>
                              ) : (
                                <span className="text-[#8B95A7]">0</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center text-[#F5F7FA]">
                              {driver.podiums > 0 ? (
                                <strong className="text-emerald-400 font-bold">
                                  {driver.podiums}
                                </strong>
                              ) : (
                                <span className="text-[#8B95A7]">0</span>
                              )}
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
          <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333]/90 shadow-xl">
            <CardHeader className="pb-3 border-b border-[#1F2733]/60">
              <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Mundial de Construtores — Temporada 2026
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                A pontuação acumulada define a premiação anual de construtores (R$ 175M no P1 até R$
                70M no P12) e a moral da escuderia.
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
                        <th className="py-2.5 px-3 text-center">Pódios</th>
                        <th className="py-2.5 px-3 text-right">Premiação FIA (Final)</th>
                        <th className="py-2.5 px-4 text-right">Pontos Totais</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F2733]/60">
                      {constructorStandings.map((cTeam, index) => {
                        const pos = index + 1
                        const prizeByRank: Record<number, number> = {
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
                        }
                        const estimatedPrize = prizeByRank[pos] || 70000000
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
                                <strong className="text-amber-400 font-bold">{cTeam.wins}</strong>
                              ) : (
                                <span className="text-[#8B95A7]">0</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center text-[#F5F7FA]">
                              {cTeam.podiums > 0 ? (
                                <strong className="text-emerald-400 font-bold">
                                  {cTeam.podiums}
                                </strong>
                              ) : (
                                <span className="text-[#8B95A7]">0</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="text-xs font-bold text-emerald-400">
                                {formatCurrency(estimatedPrize)}
                              </span>
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
