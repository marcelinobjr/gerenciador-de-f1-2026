import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { OFFICIAL_GRID_TEAMS, getAICompetitors, OfficialGridTeam } from '@/lib/f1-data'
import {
  simulateAiGridFiaStandings,
  normalizeEntityName,
  getFiaPointsForPosition,
} from '@/lib/f1-standings-calculator'
import { DriverModel, RaceResultModel } from '@/types/f1'
import { formatCurrency } from '@/lib/formatters'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Shield,
  Zap,
  Users,
  Trophy,
  DollarSign,
  Flag,
  Flame,
  TrendingUp,
  Cpu,
  Search,
  Layers,
  Sparkles,
} from 'lucide-react'

// Informações calculadas de construtores
interface TeamStandingSummary {
  position: number
  points: number
  wins: number
}

export default function TeamsPage() {
  const { team, season } = useAuth()
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [playerDrivers, setPlayerDrivers] = useState<DriverModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [engineFilter, setEngineFilter] = useState<string>('todos')

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
      console.error('Erro ao carregar dados do paddock:', err)
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

  // Calcula a tabela de construtores da temporada atual para sabermos posição e pontos de cada equipe
  const constructorStandingsMap = useMemo(() => {
    const currentRound = season?.current_round || 1
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiGrid = getAICompetitors(team?.team_key, isCustomTeam)

    const recordedRounds = new Set<number>()
    raceResults.forEach((r) => {
      if (typeof r.round === 'number') recordedRounds.add(r.round)
    })
    const hasRecordedResults = recordedRounds.size > 0
    const pastRoundsToSimulate = hasRecordedResults ? 0 : Math.max(0, currentRound - 1)

    const { teamStandingsMap: aiTeamStats } = simulateAiGridFiaStandings(
      team?.team_key,
      isCustomTeam,
      pastRoundsToSimulate,
    )

    const standings: Record<
      string,
      { name: string; points: number; wins: number; isPlayer: boolean; bestPosition: number }
    > = {}

    // Equipes rivais da IA
    aiGrid.forEach((aiTeam) => {
      const stat = aiTeamStats[aiTeam.id] || { points: 0, wins: 0, podiums: 0, bestPos: 99 }
      standings[aiTeam.id] = {
        name: aiTeam.name,
        points: stat.points,
        wins: stat.wins,
        bestPosition: stat.bestPos,
        isPlayer: false,
      }
    })

    // Equipe do jogador
    let playerPoints = 0
    let playerWins = 0
    let playerBestPos = 99
    raceResults.forEach((r) => {
      const isPlayerResult =
        r.team_id === team?.id || (r.expand?.team_id && r.expand.team_id.name === team?.name)
      if (isPlayerResult || !r.team_id) {
        const pts =
          typeof r.points === 'number' && r.points > 0
            ? r.points
            : getFiaPointsForPosition(r.position) + (r.fastest_lap && r.position <= 10 ? 1 : 0)
        playerPoints += pts
        if (r.position === 1) playerWins += 1
        if (r.position < playerBestPos) playerBestPos = r.position
      }
    })

    const playerTeamId = team?.id || 'player'
    standings[playerTeamId] = {
      name: team?.name || 'Escuderia Brasil',
      points: playerPoints,
      wins: playerWins,
      bestPosition: playerBestPos,
      isPlayer: true,
    }

    // Ordenar para extrair a posição oficial segundo regulamento FIA
    const sorted = Object.entries(standings).sort(([, a], [, b]) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.wins !== a.wins) return b.wins - a.wins
      if (a.bestPosition !== b.bestPosition) return a.bestPosition - b.bestPosition
      return a.name.localeCompare(b.name)
    })

    const resultMap: Record<string, TeamStandingSummary> = {}
    sorted.forEach(([id, data], index) => {
      resultMap[id] = {
        position: index + 1,
        points: data.points,
        wins: data.wins,
      }
      // Também mapear por nome e nome normalizado para correspondência com OFFICIAL_GRID_TEAMS
      resultMap[data.name.toLowerCase()] = {
        position: index + 1,
        points: data.points,
        wins: data.wins,
      }
      resultMap[normalizeEntityName(data.name)] = {
        position: index + 1,
        points: data.points,
        wins: data.wins,
      }
    })

    return resultMap
  }, [season, team, raceResults])

  // Titulares e reserva da equipe do jogador
  const playerTitular1 = playerDrivers.filter((d) => d.role !== 'reserva')[0]
  const playerTitular2 = playerDrivers.filter((d) => d.role !== 'reserva')[1]
  const playerReserve = playerDrivers.find((d) => d.role === 'reserva')

  // Flag helper
  const getFlag = (nat?: string) => {
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
      case 'dinamarca':
      case 'dnk':
        return '🇩🇰'
      case 'méxico':
      case 'mex':
        return '🇲🇽'
      case 'nova zelândia':
      case 'nzl':
        return '🇳🇿'
      case 'estônia':
      case 'est':
        return '🇪🇪'
      case 'barbados':
      case 'brb':
        return '🇧🇧'
      case 'estados unidos':
      case 'usa':
        return '🇺🇸'
      case 'finlândia':
      case 'fin':
        return '🇫🇮'
      case 'china':
      case 'chn':
        return '🇨🇳'
      default:
        return '🏁'
    }
  }

  // Lista de equipes oficiais (11 oficiais ou as 12 da F1 2026)
  // Se o usuário assumiu uma oficial (ex: Ferrari), seu card é o destaque
  const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'

  // Combina lista para exibição
  const allDisplayTeams = useMemo(() => {
    // 1. Se for equipe customizada (ex: Escuderia Brasil), temos as 11 oficiais rivais + 1 do jogador = 12 equipes
    // 2. Se for equipe oficial assumida pelo jogador (ex: Ferrari), destacamos a Ferrari com a tag "Sua Escuderia"
    const list: Array<{
      key: string
      name: string
      color: string
      engine: 'Ferrari' | 'Mercedes' | 'Honda' | 'Ford'
      strengthRating: number
      strengthVerdict: string
      budget: number
      historySummary: string
      currentSituation: string
      isUserTeam: boolean
      driver1: {
        name: string
        speed: number
        consistency: number
        nationality: string
        flag: string
        age: number
      }
      driver2: {
        name: string
        speed: number
        consistency: number
        nationality: string
        flag: string
        age: number
      }
      reserveDriver?: {
        name: string
        speed: number
        consistency: number
        nationality: string
        flag: string
        age: number
      }
    }> = []

    // Adiciona o card da equipe do jogador se for customizada
    if (isCustomTeam && team) {
      list.push({
        key: 'user_custom',
        name: team.name,
        color: team.color || '#E10600',
        engine: (team.engine_supplier as any) || 'Mercedes',
        strengthRating: Number(((team.strength || 58) / 10).toFixed(1)),
        strengthVerdict: 'Sua Escuderia Própria // 12ª Equipe do Grid',
        budget: team.budget,
        historySummary: 'Equipe estreante sob seu comando direto na Fórmula 1 2026.',
        currentSituation:
          'Desenvolvendo infraestrutura, pacote aerodinâmico e gestão de motores para alcançar os líderes.',
        isUserTeam: true,
        driver1: {
          name: playerTitular1?.name || 'Piloto 1',
          speed: playerTitular1?.speed || 80,
          consistency: playerTitular1?.consistency || 80,
          nationality: playerTitular1?.nationality || 'Brasil',
          flag: getFlag(playerTitular1?.nationality || 'Brasil'),
          age: playerTitular1?.age || 24,
        },
        driver2: {
          name: playerTitular2?.name || 'Piloto 2',
          speed: playerTitular2?.speed || 79,
          consistency: playerTitular2?.consistency || 78,
          nationality: playerTitular2?.nationality || 'Brasil',
          flag: getFlag(playerTitular2?.nationality || 'Brasil'),
          age: playerTitular2?.age || 25,
        },
        reserveDriver: playerReserve
          ? {
              name: playerReserve.name,
              speed: playerReserve.speed,
              consistency: playerReserve.consistency,
              nationality: playerReserve.nationality,
              flag: getFlag(playerReserve.nationality),
              age: playerReserve.age,
            }
          : undefined,
      })
    }

    // Adiciona as oficiais
    OFFICIAL_GRID_TEAMS.forEach((official) => {
      const isThisUserTeam =
        !isCustomTeam &&
        ((team?.team_key && team.team_key === official.key) ||
          (team?.name && team.name.toLowerCase() === official.name.toLowerCase()))

      list.push({
        key: official.key,
        name: isThisUserTeam ? team?.name || official.name : official.name,
        color: isThisUserTeam ? team?.color || official.color : official.color,
        engine: isThisUserTeam
          ? (team?.engine_supplier as any) || official.engine
          : official.engine,
        strengthRating: official.strengthRating,
        strengthVerdict: official.strengthVerdict,
        budget: isThisUserTeam ? (team?.budget ?? official.budget) : official.budget,
        historySummary: official.historySummary,
        currentSituation: official.currentSituation,
        isUserTeam: isThisUserTeam,
        driver1:
          isThisUserTeam && playerTitular1
            ? {
                name: playerTitular1.name,
                speed: playerTitular1.speed,
                consistency: playerTitular1.consistency,
                nationality: playerTitular1.nationality,
                flag: getFlag(playerTitular1.nationality),
                age: playerTitular1.age,
              }
            : official.driver1,
        driver2:
          isThisUserTeam && playerTitular2
            ? {
                name: playerTitular2.name,
                speed: playerTitular2.speed,
                consistency: playerTitular2.consistency,
                nationality: playerTitular2.nationality,
                flag: getFlag(playerTitular2.nationality),
                age: playerTitular2.age,
              }
            : official.driver2,
        reserveDriver:
          isThisUserTeam && playerReserve
            ? {
                name: playerReserve.name,
                speed: playerReserve.speed,
                consistency: playerReserve.consistency,
                nationality: playerReserve.nationality,
                flag: getFlag(playerReserve.nationality),
                age: playerReserve.age,
              }
            : official.reserveDriver,
      })
    })

    return list
  }, [team, isCustomTeam, playerTitular1, playerTitular2, playerReserve])

  // Filtragem por busca e por fornecedor de motor
  const filteredTeams = useMemo(() => {
    return allDisplayTeams.filter((t) => {
      const matchesSearch =
        search.trim() === '' ||
        t.name.toLowerCase().includes(search.toLowerCase().trim()) ||
        t.driver1.name.toLowerCase().includes(search.toLowerCase().trim()) ||
        t.driver2.name.toLowerCase().includes(search.toLowerCase().trim()) ||
        t.strengthVerdict.toLowerCase().includes(search.toLowerCase().trim())

      const matchesEngine = engineFilter === 'todos' || t.engine === engineFilter

      return matchesSearch && matchesEngine
    })
  }, [allDisplayTeams, search, engineFilter])

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-[#E10600] uppercase flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#E10600]" />
            Paddock Oficial F1 2026 // Grid Completo
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA] mt-1">
            Escuderias do Campeonato
          </h1>
          <p className="text-sm text-[#8B95A7] mt-0.5">
            Hierarquia de forças da temporada 2026, pareceres técnicos oficiais, pilotos titulares e
            reservas, fornecedores de unidade de potência e posição no mundial de construtores.
          </p>
        </div>

        {/* Indicador de Temporada */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="font-mono text-xs px-3 py-1.5 border-[#00A6FB]/40 text-[#00A6FB] bg-[#00A6FB]/10 flex items-center gap-1.5"
          >
            <Trophy className="w-3.5 h-3.5 text-[#00A6FB]" />
            <span>Rodada {season?.current_round || 1} de 24</span>
          </Badge>
          <Badge
            variant="outline"
            className="font-mono text-xs px-3 py-1.5 border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
          >
            12 Escuderias • 24 Carros
          </Badge>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11161F] border border-[#1F2733] p-3 rounded-xl font-mono text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A7]" />
          <input
            type="text"
            placeholder="Buscar equipe, piloto ou parecer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0B0E14] border border-[#1F2733] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#F5F7FA] focus:outline-none focus:border-[#00A6FB] placeholder:text-[#8B95A7]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8B95A7] shrink-0">Motor:</span>
          <div className="flex items-center gap-1">
            {['todos', 'Mercedes', 'Ferrari', 'Honda', 'Ford'].map((eng) => (
              <button
                key={eng}
                type="button"
                onClick={() => setEngineFilter(eng)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  engineFilter === eng
                    ? 'bg-[#E10600] text-white font-bold'
                    : 'bg-[#0B0E14] text-[#8B95A7] hover:text-[#F5F7FA] border border-[#1F2733]'
                }`}
              >
                {eng === 'todos' ? 'Todos' : eng}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Cards de Equipes */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full bg-[#11161F] rounded-xl" />
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-[#1F2733] rounded-2xl text-[#8B95A7] font-mono text-xs space-y-2">
          <p>Nenhuma equipe encontrada para os filtros selecionados.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setEngineFilter('todos')
            }}
            className="text-[#00A6FB] underline underline-offset-4"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredTeams.map((t) => {
            // Posição no Mundial de Construtores
            const standing = (t.isUserTeam && team?.id ? constructorStandingsMap[team.id] : null) ||
              constructorStandingsMap[t.name.toLowerCase()] || {
                position: 0,
                points: 0,
                wins: 0,
              }

            const isUser = t.isUserTeam

            return (
              <Card
                key={t.key}
                className={`relative overflow-hidden transition-all duration-200 ${
                  isUser
                    ? 'bg-[#141A24] shadow-xl ring-2'
                    : 'bg-[#11161F] border-[#1F2733] hover:border-[#1F2733]/90'
                }`}
                style={{
                  borderColor: isUser ? t.color : undefined,
                  boxShadow: isUser ? `0 0 25px ${t.color}25` : undefined,
                }}
              >
                {/* Linha superior colorida da equipe */}
                <div className="h-1.5 w-full" style={{ backgroundColor: t.color }} />

                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shadow-md shrink-0"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.name.substring(0, 2).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg font-bold text-[#F5F7FA]">
                            {t.name}
                          </CardTitle>
                          {isUser && (
                            <Badge
                              className="text-[10px] font-mono font-bold px-2 py-0.5"
                              style={{
                                backgroundColor: t.color,
                                color: '#0B0E14',
                              }}
                            >
                              ★ Sua Escuderia
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-mono text-[#8B95A7] flex items-center gap-2 mt-0.5">
                          <span>
                            Motor: <strong className="text-cyan-400">{t.engine}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Orçamento:{' '}
                            <strong className="text-emerald-400">{formatCurrency(t.budget)}</strong>
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Nota de Força 0-10 */}
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-mono text-[#8B95A7] uppercase">
                        Força 2026
                      </div>
                      <div className="text-xl font-mono font-black text-amber-400 flex items-baseline justify-end gap-0.5">
                        <span>{t.strengthRating.toFixed(1)}</span>
                        <span className="text-[10px] text-[#8B95A7] font-normal">/10</span>
                      </div>
                    </div>
                  </div>

                  {/* Parecer oficial da hierarquia */}
                  <div className="mt-2 p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8B95A7]">Parecer Oficial:</span>
                    <strong className="text-amber-300 font-bold">{t.strengthVerdict}</strong>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-1">
                  {/* Posição no Mundial de Construtores */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-xs font-mono text-center">
                    <div>
                      <span className="text-[#8B95A7] block text-[10px]">Mundial Construtores</span>
                      <strong className="text-sm text-[#F5F7FA]">
                        {standing.position > 0 ? `${standing.position}º Lugar` : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#8B95A7] block text-[10px]">Pontos Totais</span>
                      <strong className="text-sm text-cyan-400">{standing.points} pts</strong>
                    </div>
                    <div>
                      <span className="text-[#8B95A7] block text-[10px]">Vitórias 2026</span>
                      <strong className="text-sm text-amber-400">{standing.wins}</strong>
                    </div>
                  </div>

                  {/* Pilotos Titulares + Piloto Reserva */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#8B95A7] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#00A6FB]" />
                      <span>Elenco de Pilotos (Titulares + Reserva)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
                      {/* Titular 1 */}
                      <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-emerald-400 font-bold">#1 TITULAR</span>
                          <span className="text-sm">{t.driver1.flag}</span>
                        </div>
                        <div
                          className="font-bold text-[#F5F7FA] truncate text-xs"
                          title={t.driver1.name}
                        >
                          {t.driver1.name}
                        </div>
                        <div className="text-[10px] text-[#8B95A7]">{t.driver1.age} anos</div>
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#1F2733]/60">
                          <span className="text-[#E10600] font-bold">VEL {t.driver1.speed}</span>
                          <span className="text-cyan-400 font-bold">
                            CONS {t.driver1.consistency}
                          </span>
                        </div>
                      </div>

                      {/* Titular 2 */}
                      <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-emerald-400 font-bold">#2 TITULAR</span>
                          <span className="text-sm">{t.driver2.flag}</span>
                        </div>
                        <div
                          className="font-bold text-[#F5F7FA] truncate text-xs"
                          title={t.driver2.name}
                        >
                          {t.driver2.name}
                        </div>
                        <div className="text-[10px] text-[#8B95A7]">{t.driver2.age} anos</div>
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#1F2733]/60">
                          <span className="text-[#E10600] font-bold">VEL {t.driver2.speed}</span>
                          <span className="text-cyan-400 font-bold">
                            CONS {t.driver2.consistency}
                          </span>
                        </div>
                      </div>

                      {/* Reserva */}
                      <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-amber-400 font-bold">RESERVA</span>
                          <span className="text-sm">{t.reserveDriver?.flag || '🏁'}</span>
                        </div>
                        <div
                          className="font-bold text-[#F5F7FA] truncate text-xs"
                          title={t.reserveDriver?.name || 'Reserva a definir'}
                        >
                          {t.reserveDriver?.name || 'Reserva a definir'}
                        </div>
                        <div className="text-[10px] text-[#8B95A7]">
                          {t.reserveDriver ? `${t.reserveDriver.age} anos` : 'Disponível'}
                        </div>
                        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#1F2733]/60">
                          <span className="text-[#E10600] font-bold">
                            VEL {t.reserveDriver?.speed || '—'}
                          </span>
                          <span className="text-cyan-400 font-bold">
                            CONS {t.reserveDriver?.consistency || '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resumo da situação atual */}
                  <p className="text-[11px] text-[#8B95A7] leading-relaxed italic bg-[#0B0E14]/40 p-2.5 rounded-lg border border-[#1F2733]/60">
                    "{t.currentSituation}"
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
