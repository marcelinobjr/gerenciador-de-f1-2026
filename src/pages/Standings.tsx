import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { DriverModel, RaceResultModel } from '@/types/f1'
import { standingsService, DriverStanding, TeamStanding } from '@/services/standingsService'
import { Trophy, Award, Users, Flag, Medal, Scale } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AmbientBackground } from '@/components/AmbientBackground'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/formatters'

export type { DriverStanding, TeamStanding }

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

  // Calculate aggregated standings via unified service
  const { driverStandings, constructorStandings } = useMemo(() => {
    return standingsService.calculateStandings({
      raceResults,
      playerDrivers,
      team,
      season,
    })
  }, [raceResults, playerDrivers, team, season])

  return (
    <div className="relative space-y-8 animate-fade-in-up">
      <AmbientBackground />
      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-black tracking-widest text-[#E10600] uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E10600] shadow-[0_0_8px_#E10600] animate-pulse" />
            Tabela Oficial do Campeonato Mundial
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white mt-1 drop-shadow-md">
            Classificação Geral F1 2026
          </h1>
          <p className="text-xs sm:text-sm text-[#8B95A7] font-mono mt-1">
            Grid oficial com{' '}
            {team?.is_custom ? '12 equipes (11 oficiais + 12ª sua escuderia)' : '11 equipes'} •
            Pontuação FIA (25-18-15-12-10-8-6-4-2-1), vitórias e pódios ao longo das 24 etapas.
          </p>
        </div>
      </div>

      {/* Tabs Pilotos / Construtores */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="relative z-10 w-full"
      >
        <div className="flex justify-between items-center mb-4">
          <TabsList className="bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-1">
            <TabsTrigger
              value="drivers"
              className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white font-bold text-xs sm:text-sm shadow"
            >
              <Users className="w-4 h-4 mr-1.5" />
              Campeonato de Pilotos
            </TabsTrigger>
            <TabsTrigger
              value="constructors"
              className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white font-bold text-xs sm:text-sm shadow"
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
          <Card className="bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] shadow-xl">
            <CardHeader className="pb-3 border-b border-[#1A2333]">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                CLASSIFICAÇÃO DE PILOTOS
              </span>
              <CardTitle className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                <Award className="w-5 h-5 text-[#E10600]" />
                Mundial de Pilotos — Temporada 2026
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7] font-mono mt-0.5">
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
                                <span
                                  title={driver.nationality}
                                  className="text-base select-none cursor-default"
                                >
                                  {driver.flag}
                                </span>
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
                                {(driver.totalPenaltiesSec || 0) > 0 && (
                                  <Badge
                                    className="bg-amber-950/80 text-amber-300 border border-amber-500/60 text-[9px] px-1.5 py-0 h-4 font-mono font-bold flex items-center gap-0.5"
                                    title={`Penalidades acumuladas nesta temporada: +${driver.totalPenaltiesSec}s (${driver.penaltiesCount || 1} infração(ões))`}
                                  >
                                    <Scale className="w-2.5 h-2.5" />
                                    ⚖️ +{driver.totalPenaltiesSec}s
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
          <Card className="bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] shadow-xl">
            <CardHeader className="pb-3 border-b border-[#1A2333]">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-400 block">
                CLASSIFICAÇÃO DE EQUIPES
              </span>
              <CardTitle className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                <Trophy className="w-5 h-5 text-amber-400" />
                Mundial de Construtores — Temporada 2026
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7] font-mono mt-0.5">
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
                                  <div className="flex items-center gap-1">
                                    <Badge className="bg-[#E10600] text-white text-[9px] px-1.5 py-0 h-4">
                                      Sua Escuderia
                                    </Badge>
                                    {(team?.constructors_points_deduction || 0) > 0 && (
                                      <Badge
                                        className="bg-red-950/80 text-red-400 border border-red-500/50 text-[9px] px-1.5 py-0 h-4"
                                        title="Penalidade FIA por exceder teto de gastos"
                                      >
                                        -{team?.constructors_points_deduction} pts FIA
                                      </Badge>
                                    )}
                                  </div>
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
