import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { DriverModel, EventModel, PartModel, RaceResultModel } from '@/types/f1'
import { F1_2026_CALENDAR, AI_GRID_TEAMS } from '@/lib/f1-data'
import { formatCurrency, formatDateTimeBR } from '@/lib/formatters'
import {
  Trophy,
  DollarSign,
  HeartPulse,
  Calendar,
  ChevronRight,
  TrendingUp,
  Award,
  Zap,
  Activity,
  UserCheck,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function Index() {
  const { user, team, season, refreshTeamAndSeason } = useAuth()
  const navigate = useNavigate()

  const [drivers, setDrivers] = useState<DriverModel[]>([])
  const [events, setEvents] = useState<EventModel[]>([])
  const [parts, setParts] = useState<PartModel[]>([])
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [loading, setLoading] = useState(true)

  const loadDashboardData = async () => {
    if (!team || !season) return
    try {
      const [dList, eList, pList, rList] = await Promise.all([
        f1Service.getTeamDrivers(team.id),
        f1Service.getTeamEvents(team.id, 10),
        f1Service.getTeamParts(team.id),
        f1Service.getSeasonRaceResults(season.id),
      ])
      setDrivers(dList)
      setEvents(eList)
      setParts(pList)
      setRaceResults(rList)
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [team?.id, season?.id])

  // Realtime updates
  useRealtime('events', () => {
    if (team?.id) f1Service.getTeamEvents(team.id, 10).then(setEvents)
  })
  useRealtime('race_results', () => {
    if (season?.id) f1Service.getSeasonRaceResults(season.id).then(setRaceResults)
  })
  useRealtime('drivers', () => {
    if (team?.id) f1Service.getTeamDrivers(team.id).then(setDrivers)
  })
  useRealtime('seasons', () => {
    refreshTeamAndSeason()
  })

  // Standings calculation
  const { constructorPosition, teamPoints, driverPointsMap, morale } = useMemo(() => {
    // team points
    const myResults = raceResults.filter((r) => r.team_id === team?.id)
    const tPoints = myResults.reduce((acc, curr) => acc + (curr.points || 0), 0)

    // drivers points map
    const dMap: Record<string, number> = {}
    drivers.forEach((d) => {
      const dResults = raceResults.filter((r) => r.driver_id === d.id)
      dMap[d.id] = dResults.reduce((acc, curr) => acc + (curr.points || 0), 0)
    })

    // Simulated competitor points based on past rounds
    const currentRound = season?.current_round || 1
    const completedRounds = Math.max(0, currentRound - 1)

    // Rough competitor totals
    const competitorsWithPoints = AI_GRID_TEAMS.map((aiTeam, idx) => {
      // Base points per completed round according to car level
      const estimatedPts = Math.round((aiTeam.carLevel - 65) * 0.45 * completedRounds)
      return {
        id: aiTeam.id,
        name: aiTeam.name,
        points: estimatedPts,
      }
    })

    const allTeams = [
      ...competitorsWithPoints,
      { id: team?.id || 'player', name: team?.name || 'Escuderia Brasil', points: tPoints },
    ].sort((a, b) => b.points - a.points)

    const myRank = allTeams.findIndex((t) => t.id === (team?.id || 'player')) + 1

    // Team Morale: based on average part levels, points and budget
    const avgParts = parts.length > 0 ? parts.reduce((a, b) => a + b.level, 0) / parts.length : 5
    let calcMorale = Math.round(50 + (avgParts - 5) * 4 + Math.min(25, tPoints / 3))
    if (myRank <= 3) calcMorale += 10
    else if (myRank <= 6) calcMorale += 5
    calcMorale = Math.max(10, Math.min(100, calcMorale))

    return {
      constructorPosition: myRank > 0 ? myRank : 5,
      teamPoints: tPoints,
      driverPointsMap: dMap,
      morale: calcMorale,
    }
  }, [raceResults, team, season, drivers, parts])

  const currentRoundIndex = (season?.current_round || 1) - 1
  const currentGP = F1_2026_CALENDAR[Math.min(currentRoundIndex, F1_2026_CALENDAR.length - 1)]

  // Morale color logic: <50 red, 50-75 yellow, >75 green
  const getMoraleColor = (val: number) => {
    if (val < 50) return { bar: 'bg-[#EF4444]', text: 'text-[#EF4444]', label: 'Baixa' }
    if (val <= 75) return { bar: 'bg-[#F59E0B]', text: 'text-[#F59E0B]', label: 'Estável' }
    return { bar: 'bg-[#22C55E]', text: 'text-[#22C55E]', label: 'Excelente' }
  }
  const moraleStyle = getMoraleColor(morale)

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold tracking-widest text-[#E10600] uppercase">
              Centro de Operações F1 2026
            </span>
            <Badge
              variant="outline"
              className="text-[10px] border-[#00A6FB]/40 text-[#00A6FB] bg-[#00A6FB]/5"
            >
              Live Telemetry
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-[#F5F7FA]">
            Bem-vindo, {user?.name || 'Chefe de Equipe'}
          </h1>
          <p className="text-sm text-[#8B95A7] mt-0.5">
            Comandando a{' '}
            <strong className="text-[#F5F7FA]">{team?.name || 'Escuderia Brasil'}</strong> na
            temporada de transição para o novo regulamento híbrido 50/50.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            asChild
            className="bg-[#E10600] hover:bg-[#FF2E25] text-white shadow-lg shadow-[#E10600]/25 font-semibold"
          >
            <Link to="/race">
              Ir para Corrida
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* 4 Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Posição Construtores */}
        <Card className="bg-[#11161F] border-[#1F2733] hover:border-[#E10600]/50 hover:-translate-y-0.5 transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-[#8B95A7]">
              Construtores
            </CardTitle>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-20 bg-[#1F2733]" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono text-[#F5F7FA]">
                  {constructorPosition}º
                </span>
                <span className="text-xs text-[#8B95A7] font-mono">/ 11 equipes</span>
              </div>
            )}
            <p className="text-[11px] text-[#8B95A7] mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-[#00A6FB]" /> Grid Oficial 2026
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Pontos */}
        <Card className="bg-[#11161F] border-[#1F2733] hover:border-[#E10600]/50 hover:-translate-y-0.5 transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-[#8B95A7]">
              Pontos Totais
            </CardTitle>
            <div className="w-7 h-7 rounded-lg bg-[#E10600]/10 text-[#E10600] flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-20 bg-[#1F2733]" />
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold font-mono text-[#F5F7FA]">
                  {teamPoints}
                </span>
                <span className="text-xs font-mono text-[#8B95A7]">pts</span>
              </div>
            )}
            <p className="text-[11px] text-[#8B95A7] mt-1">
              {raceResults.length > 0
                ? `${raceResults.length / 2} GPs disputados`
                : 'Início de temporada'}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Orçamento */}
        <Card className="bg-[#11161F] border-[#1F2733] hover:border-[#00A6FB]/50 hover:-translate-y-0.5 transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-[#8B95A7]">
              Orçamento Disponível
            </CardTitle>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-28 bg-[#1F2733]" />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#F5F7FA]">
                {formatCurrency(team?.budget ?? 150000000)}
              </div>
            )}
            <p className="text-[11px] text-[#8B95A7] mt-1 font-mono">
              Teto de gastos FIA respeitado
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Moral da Equipe */}
        <Card className="bg-[#11161F] border-[#1F2733] hover:border-amber-500/50 hover:-translate-y-0.5 transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-[#8B95A7]">
              Moral da Equipe
            </CardTitle>
            <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
              <HeartPulse className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-20 bg-[#1F2733]" />
            ) : (
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-3xl font-extrabold font-mono text-[#F5F7FA]">{morale}</span>
                  <span className={`text-xs font-bold font-mono ${moraleStyle.text}`}>
                    {moraleStyle.label}
                  </span>
                </div>
                <div className="w-full bg-[#0B0E14] h-2 rounded-full overflow-hidden border border-[#1F2733]">
                  <div
                    className={`h-full transition-all duration-500 ${moraleStyle.bar}`}
                    style={{ width: `${morale}%` }}
                  />
                </div>
              </div>
            )}
            <p className="text-[11px] text-[#8B95A7] mt-2">
              Influencia pit-stops e foco dos pilotos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Próxima Corrida: Big Featured Card with Soft Glowing Pulse */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#11161F] via-[#161D29] to-[#11161F] border border-[#1F2733] p-6 shadow-xl animate-pulse-glow">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#E10600] text-white hover:bg-[#E10600] font-mono text-xs">
                RODADA {season?.current_round || 1} DE {season?.total_rounds || 24}
              </Badge>
              <span className="text-xs font-mono text-[#8B95A7] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Próximo Evento Oficial
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-3xl">{currentGP?.flag}</span>
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA] tracking-tight">
                  {currentGP?.name}
                </h2>
                <p className="text-sm font-mono text-[#00A6FB]">{currentGP?.circuit}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 text-xs font-mono text-[#8B95A7]">
              <div>
                <span className="text-[#8B95A7] block text-[10px] uppercase">Extensão</span>
                <strong className="text-[#F5F7FA]">{currentGP?.circuitLengthKm} km</strong>
              </div>
              <div>
                <span className="text-[#8B95A7] block text-[10px] uppercase">Voltas</span>
                <strong className="text-[#F5F7FA]">{currentGP?.laps} voltas</strong>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[#8B95A7] block text-[10px] uppercase">Desafio</span>
                <strong className="text-[#F5F7FA]">{currentGP?.characteristic}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-[#E10600] to-[#FF6B35] hover:from-[#FF2E25] hover:to-[#FF7B48] text-white font-bold px-8 shadow-xl shadow-[#E10600]/25 transition-all hover:scale-[1.02]"
            >
              <Link to="/race" className="flex items-center gap-2">
                <Zap className="w-5 h-5 fill-current" />
                Ver Detalhes do GP
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-[#1F2733] bg-[#0B0E14] text-[#F5F7FA] hover:bg-[#1F2733]"
            >
              <Link to="/car">Ajustar Aerodinâmica Ativa</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Two Columns: Pilotos Resumo & Linha do Tempo Notícias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resumo dos Pilotos */}
        <Card className="bg-[#11161F] border-[#1F2733]">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#E10600]" />
                Dupla de Pilotos Titulares
              </CardTitle>
              <p className="text-xs text-[#8B95A7]">
                Escalação atual da {team?.name || 'sua equipe'}
              </p>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs text-[#00A6FB] hover:text-[#00A6FB]/80"
            >
              <Link to="/team">Gerenciar</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full bg-[#1F2733]" />
                <Skeleton className="h-16 w-full bg-[#1F2733]" />
              </div>
            ) : drivers.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8B95A7] border border-dashed border-[#1F2733] rounded-lg">
                Nenhum piloto contratado no momento.{' '}
                <Link to="/team" className="text-[#00A6FB] underline">
                  Acessar mercado de pilotos
                </Link>
              </div>
            ) : (
              drivers.map((driver, idx) => {
                const pts = driverPointsMap[driver.id] || 0
                return (
                  <div
                    key={driver.id}
                    className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2733] flex items-center justify-between gap-4 hover:border-[#1F2733]/80 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1F2733] border border-[#1F2733] flex items-center justify-center font-mono font-bold text-sm text-[#F5F7FA]">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#F5F7FA]">
                            {driver.name}
                          </span>
                          <span className="text-xs">
                            {driver.nationality === 'Brasil' ? '🇧🇷' : '🏁'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono text-[#8B95A7] mt-0.5">
                          <span>Idade: {driver.age}</span>
                          <span>•</span>
                          <span>Salário: {formatCurrency(driver.salary)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xl font-bold text-[#F5F7FA]">{pts}</span>
                      <span className="text-xs text-[#8B95A7] block">pts</span>
                    </div>
                  </div>
                )
              })
            )}

            <div className="p-3 rounded-lg bg-[#161D29]/40 border border-[#1F2733] flex items-center justify-between text-xs font-mono text-[#8B95A7]">
              <span>Fornecedor de Motor:</span>
              <strong className="text-[#00A6FB] font-semibold">
                {team?.engine_supplier || 'Mercedes'} (50/50 Híbrido)
              </strong>
            </div>
          </CardContent>
        </Card>

        {/* Notícias / Eventos Recentes */}
        <Card className="bg-[#11161F] border-[#1F2733]">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#00A6FB]" />
                Linha do Tempo de Notícias
              </CardTitle>
              <p className="text-xs text-[#8B95A7]">
                Acontecimentos recentes e comunicados oficiais
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#8B95A7]">Últimos eventos</span>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full bg-[#1F2733]" />
                <Skeleton className="h-12 w-full bg-[#1F2733]" />
                <Skeleton className="h-12 w-full bg-[#1F2733]" />
              </div>
            ) : events.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8B95A7] border border-dashed border-[#1F2733] rounded-lg">
                Nenhum comunicado registrado ainda.
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {events.map((ev) => {
                  const getBadge = (t: string) => {
                    switch (t) {
                      case 'resultado':
                        return (
                          <Badge className="bg-[#E10600]/20 text-[#E10600] border-none text-[10px]">
                            Corrida
                          </Badge>
                        )
                      case 'contrato':
                        return (
                          <Badge className="bg-[#00A6FB]/20 text-[#00A6FB] border-none text-[10px]">
                            Contrato
                          </Badge>
                        )
                      case 'desenvolvimento':
                        return (
                          <Badge className="bg-purple-500/20 text-purple-400 border-none text-[10px]">
                            P&D
                          </Badge>
                        )
                      case 'patrocinio':
                        return (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[10px]">
                            Patrocínio
                          </Badge>
                        )
                      default:
                        return (
                          <Badge className="bg-gray-500/20 text-gray-400 border-none text-[10px]">
                            Info
                          </Badge>
                        )
                    }
                  }

                  return (
                    <div
                      key={ev.id}
                      className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] flex items-start gap-3 text-xs"
                    >
                      <div className="mt-0.5">{getBadge(ev.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#F5F7FA] font-medium leading-relaxed">{ev.message}</p>
                        <span className="text-[10px] font-mono text-[#8B95A7] mt-1 block">
                          {formatDateTimeBR(ev.created)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
