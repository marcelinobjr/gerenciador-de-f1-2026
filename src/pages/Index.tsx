import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { DriverModel, EventModel, PartModel, RaceResultModel } from '@/types/f1'
import { F1_2026_CALENDAR, getAICompetitors, OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import { simulateAiGridFiaStandings, normalizeEntityName } from '@/lib/f1-standings-calculator'
import { formatCurrency } from '@/lib/formatters'
import {
  Trophy,
  DollarSign,
  TrendingUp,
  Award,
  Zap,
  Activity,
  UserCheck,
  ChevronRight,
  Sliders,
  Calendar,
  Wrench,
  Radio,
  FileText,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Gauge,
  Info,
  CircleDot,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CircuitBlueprint, TRACK_LAYOUTS } from '@/components/CircuitBlueprint'
import { CircuitTrackImage } from '@/components/CircuitTrackImage'
import { DriverHelmet } from '@/components/DriverHelmet'
import pb from '@/lib/pocketbase/client'
import { CircuitModel } from '@/types/f1'
import defaultAustraliaMap from '@/assets/01-australia-aeace.jpg'
import { AmbientBackground } from '@/components/AmbientBackground'
import { getCountryFlag } from '@/lib/country-flags'

// Format relative/compact date in PT-BR (e.g. "26 mai", "19 mai")
const formatEventDateBR = (isoString?: string) => {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const day = d.getDate()
    const months = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ]
    const m = months[d.getMonth()]
    return `${day} ${m}`
  } catch {
    return ''
  }
}

export default function Index() {
  const { user, team, season, refreshTeamAndSeason } = useAuth()
  const navigate = useNavigate()

  const [drivers, setDrivers] = useState<DriverModel[]>([])
  const [events, setEvents] = useState<EventModel[]>([])
  const [parts, setParts] = useState<PartModel[]>([])
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [circuits, setCircuits] = useState<CircuitModel[]>([])
  const [loading, setLoading] = useState(true)

  const loadDashboardData = async () => {
    if (!team || !season) {
      setLoading(false)
      return
    }
    try {
      const [dList, eList, pList, rList, cList] = await Promise.all([
        f1Service.getTeamDrivers(team.id),
        f1Service.getTeamEvents(team.id, 20),
        f1Service.getTeamParts(team.id),
        f1Service.getSeasonRaceResults(season.id),
        f1Service.getAllCircuits().catch(() => [] as CircuitModel[]),
      ])

      // Se não houver piloto reserva diretamente em team_id, buscar quem tem reserve_team_id
      let fullDrivers = [...dList]
      const hasReserve = fullDrivers.some((d) => d.role === 'reserva')
      if (!hasReserve) {
        try {
          const marketOrReserves = await f1Service.getMarketDrivers()
          const myReserve = marketOrReserves.find(
            (d) => d.reserve_team_id === team.id || (d.role === 'reserva' && d.team_id === team.id),
          )
          if (myReserve && !fullDrivers.some((d) => d.id === myReserve.id)) {
            fullDrivers.push(myReserve)
          }
        } catch (rErr) {
          console.warn('Erro ao carregar piloto reserva:', rErr)
        }
      }

      setDrivers(fullDrivers)
      setEvents(eList)
      setParts(pList)
      setRaceResults(rList)
      setCircuits(cList)
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
    if (team?.id) f1Service.getTeamEvents(team.id, 20).then(setEvents)
  })
  useRealtime('race_results', () => {
    if (season?.id) f1Service.getSeasonRaceResults(season.id).then(setRaceResults)
  })
  useRealtime('drivers', () => {
    if (team?.id) {
      f1Service.getTeamDrivers(team.id).then((dList) => {
        setDrivers((prev) => {
          const reserves = prev.filter(
            (p) => p.role === 'reserva' && !dList.some((d) => d.id === p.id),
          )
          return [...dList, ...reserves]
        })
      })
    }
  })
  useRealtime('seasons', () => {
    refreshTeamAndSeason()
  })
  useRealtime('circuits', () => {
    f1Service
      .getAllCircuits()
      .then(setCircuits)
      .catch(() => {})
  })

  // Standings calculation
  const { constructorPosition, teamPoints, driverPointsMap, morale } = useMemo(() => {
    // team points (com dedução da FIA se houver infração do teto de gastos)
    const myResults = raceResults.filter((r) => r.team_id === team?.id)
    const rawTPoints = myResults.reduce((acc, curr) => acc + (curr.points || 0), 0)
    const fiaDeduction = team?.constructors_points_deduction || 0
    const tPoints = Math.max(0, rawTPoints - fiaDeduction)

    // drivers points map
    const dMap: Record<string, number> = {}
    drivers.forEach((d) => {
      const dResults = raceResults.filter((r) => r.driver_id === d.id)
      dMap[d.id] = dResults.reduce((acc, curr) => acc + (curr.points || 0), 0)
    })

    // Simulated competitor points based on past rounds using official FIA scale
    const currentRound = season?.current_round || 1
    const isCustom = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiTeams = getAICompetitors(team?.team_key, isCustom)

    const recordedRounds = new Set<number>()
    raceResults.forEach((r) => {
      if (typeof r.round === 'number') recordedRounds.add(r.round)
    })
    const hasRecordedResults = recordedRounds.size > 0
    const pastRoundsToSimulate = hasRecordedResults ? 0 : Math.max(0, currentRound - 1)

    const { teamStandingsMap: aiTeamStats } = simulateAiGridFiaStandings(
      team?.team_key,
      isCustom,
      pastRoundsToSimulate,
    )

    // Se temos resultados gravados no banco, somamos os pontos reais das equipes rivais
    const competitorPointsFromDB: Record<string, number> = {}
    if (hasRecordedResults) {
      raceResults.forEach((res) => {
        if (res.team_id !== team?.id) {
          const expTeam = (res.expand as any)?.team_id
          const teamNameNorm = expTeam?.name ? normalizeEntityName(expTeam.name) : ''
          const matchedAiTeam = aiTeams.find(
            (t) =>
              t.id === res.team_id ||
              (teamNameNorm && normalizeEntityName(t.name) === teamNameNorm),
          )
          const matchedId = matchedAiTeam ? matchedAiTeam.id : res.team_id
          competitorPointsFromDB[matchedId] =
            (competitorPointsFromDB[matchedId] || 0) + (res.points || 0)
        }
      })
    }

    const competitorsWithPoints = aiTeams.map((aiTeam) => {
      const realPoints = competitorPointsFromDB[aiTeam.id]
      const simulatedPoints = (aiTeamStats[aiTeam.id] || { points: 0 }).points
      const points = hasRecordedResults && realPoints !== undefined ? realPoints : simulatedPoints
      return {
        id: aiTeam.id,
        name: aiTeam.name,
        points,
      }
    })

    const allTeams = [
      ...competitorsWithPoints,
      { id: team?.id || 'player', name: team?.name || 'Sua Escuderia', points: tPoints },
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
  const currentGP =
    F1_2026_CALENDAR[Math.min(currentRoundIndex, F1_2026_CALENDAR.length - 1)] ||
    F1_2026_CALENDAR[0]
  const currentRoundNumber = season?.current_round || 1
  const totalRounds = season?.total_rounds || 24

  const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
  const totalGridTeams = isCustomTeam ? 12 : 11

  // GPs disputados formatado (ex: "35.5 GPs disputados" ou "X GPs disputados")
  const gpsDisputadosText = useMemo(() => {
    if (raceResults.length > 0) {
      const distinctRounds = new Set<number>()
      raceResults.forEach((r) => {
        if (typeof r.round === 'number') distinctRounds.add(r.round)
      })
      const count =
        distinctRounds.size > 0 ? distinctRounds.size : Math.max(1, currentRoundNumber - 1)
      const numResults = raceResults.length / 2
      return `${numResults % 1 === 0 ? numResults : numResults.toFixed(1)} GPs disputados`
    }
    const prior = Math.max(0, currentRoundNumber - 1)
    if (prior === 0) return '0 GPs disputados'
    return `${prior} GPs disputados`
  }, [raceResults, currentRoundNumber])

  // Desgaste real do carro da equipe
  const engineWearPct = team?.active_engine_wear ?? 36
  const engineHealthPct = Math.max(0, 100 - engineWearPct)
  const avgPartCondition = useMemo(() => {
    if (parts.length === 0) return 85
    const total = parts.reduce((acc, p) => acc + (p.condition ?? 100), 0)
    return Math.round(total / parts.length)
  }, [parts])

  // Estimativas de telemetria da sessão
  const tireWearPct = Math.round(Math.min(95, Math.max(15, 100 - avgPartCondition + 12)))
  const fuelPct = 58
  const ersPct = 76

  // Pilotos organizados: titulares (1 e 2) e reserva
  const { titularDrivers, reserveDriver } = useMemo(() => {
    const tit = drivers.filter((d) => d.role !== 'reserva').slice(0, 2)
    let res = drivers.find((d) => d.role === 'reserva')

    // Se faltar algum piloto na listagem por não ter sido cadastrado ainda no banco, puxa da OFFICIAL_GRID_TEAMS
    if (tit.length < 2 && team?.team_key) {
      const official = OFFICIAL_GRID_TEAMS.find((t) => t.key === team.team_key)
      if (official) {
        if (tit.length === 0) {
          tit.push({
            id: 'mock_driver_1',
            name: official.driver1.name,
            age: official.driver1.age,
            salary: official.driver1.salary,
            nationality: official.driver1.nationality,
            role: 'titular',
            speed: official.driver1.speed,
            consistency: official.driver1.consistency,
            rain: official.driver1.rain,
            defense: official.driver1.defense,
            physical_condition: 95,
            morale: 80,
          } as any)
        }
        if (tit.length === 1) {
          tit.push({
            id: 'mock_driver_2',
            name: official.driver2.name,
            age: official.driver2.age,
            salary: official.driver2.salary,
            nationality: official.driver2.nationality,
            role: 'titular',
            speed: official.driver2.speed,
            consistency: official.driver2.consistency,
            rain: official.driver2.rain,
            defense: official.driver2.defense,
            physical_condition: 92,
            morale: 78,
          } as any)
        }
        if (!res && official.reserveDriver) {
          res = {
            id: 'mock_driver_res',
            name: official.reserveDriver.name,
            age: official.reserveDriver.age,
            salary: official.reserveDriver.salary,
            nationality: official.reserveDriver.nationality,
            role: 'reserva',
            speed: official.reserveDriver.speed,
            consistency: official.reserveDriver.consistency,
            rain: official.reserveDriver.rain,
            defense: official.reserveDriver.defense,
            physical_condition: 95,
            morale: 75,
          } as any
        }
      }
    }

    return { titularDrivers: tit, reserveDriver: res }
  }, [drivers, team?.team_key])

  // Notícias formatadas com badges e ícones
  const displayEvents = useMemo(() => {
    if (events.length === 0) {
      return [
        {
          id: 'mock_ev_1',
          type: 'resultado',
          title: 'Temporada Oficial F1 2026 iniciada!',
          desc: 'Todas as escuderias ajustaram os parâmetros para o novo regulamento híbrido 50/50.',
          date: 'Início',
        },
      ]
    }
    return events.slice(0, 3).map((ev) => {
      let title = ''
      let desc = ''
      const msg = ev.message || ''

      if (msg.includes('!')) {
        const partsMsg = msg.split('!')
        title = partsMsg[0].trim() + '!'
        desc =
          partsMsg.slice(1).join('!').trim() ||
          'Desempenho elogiado pelos engenheiros da escuderia.'
      } else if (msg.includes('.')) {
        const partsMsg = msg.split('.')
        title = partsMsg[0].trim() + '.'
        desc =
          partsMsg.slice(1).join('.').trim() ||
          'Acompanhamento registrado pelo centro de operações.'
      } else {
        title = msg
        desc = 'Registro oficial da equipe técnica.'
      }

      return {
        id: ev.id,
        type: ev.type,
        title,
        desc,
        date: formatEventDateBR(ev.created),
      }
    })
  }, [events])

  // Traçado vetorial mini para o card de setores
  const currentTrack = TRACK_LAYOUTS[currentRoundNumber] || TRACK_LAYOUTS[1]

  // Imagem do circuito do calendário (upload do PocketBase ou default da Austrália)
  const currentCircuitPhotoUrl = useMemo(() => {
    const dbCircuit = circuits.find((c) => c.round === currentRoundNumber)
    if (dbCircuit?.photo) {
      return pb.files.getUrl(dbCircuit, dbCircuit.photo)
    }
    if (currentRoundNumber === 1) {
      return defaultAustraliaMap
    }
    return null
  }, [circuits, currentRoundNumber])

  // Formatter de orçamento simplificado em M
  const formattedBudgetM = useMemo(() => {
    const b = team?.budget ?? 150000000
    const inMillions = b / 1_000_000
    return inMillions.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }, [team?.budget])

  return (
    <div className="relative min-h-[calc(100vh-5rem)] -mx-3 sm:-mx-5 lg:-mx-8 -my-4 md:-my-6 px-3 sm:px-5 lg:px-8 py-5 md:py-6 overflow-hidden flex flex-col justify-between space-y-6 text-[#F5F7FA]">
      {/* ============================================================== */}
      {/* FUNDO GLOBAL: Garagem com carro F1 ao centro e luzes vermelhas de teto */}
      {/* ============================================================== */}
      <AmbientBackground />

      {/* ============================================================== */}
      {/* CONTEÚDO PRINCIPAL (Z-INDEX 10) */}
      {/* ============================================================== */}
      <div className="relative z-10 space-y-5 sm:space-y-6">
        {/* ============================================================== */}
        {/* 1. LINHA DE CARDS DE STATUS (5 CARDS TRANSLÚCIDOS COM BLUR) */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          {/* Card 1: CONSTRUTORES (col-span-2) */}
          <div className="lg:col-span-2 rounded-xl bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333]/90 p-3.5 relative overflow-hidden group hover:border-[#E10600]/40 transition-all shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-[#8B95A7]">
                CONSTRUTORES
              </span>
              <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Trophy className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono tracking-tight text-white">
                {constructorPosition}º
              </span>
              <span className="text-xs text-[#8B95A7] font-mono">/ {totalGridTeams} equipes</span>
            </div>

            <p className="text-[11px] text-[#00A6FB] mt-2 flex items-center gap-1 font-mono">
              <TrendingUp className="w-3 h-3 text-[#00A6FB]" />
              Grid Oficial da F1 2026
            </p>
          </div>

          {/* Card 2: PONTOS TOTAIS (col-span-2) */}
          <div className="lg:col-span-2 rounded-xl bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333]/90 p-3.5 relative overflow-hidden group hover:border-[#E10600]/40 transition-all shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-[#8B95A7]">
                PONTOS TOTAIS
              </span>
              <div className="w-5 h-5 rounded-full bg-[#E10600]/15 text-[#E10600] flex items-center justify-center">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black font-mono tracking-tight text-white">
                {teamPoints}
              </span>
              <span className="text-xs text-[#8B95A7] font-mono">pts</span>
            </div>

            <p className="text-[11px] text-[#8B95A7] mt-2 font-mono truncate">
              {gpsDisputadosText}
            </p>
          </div>

          {/* Card 3: ORÇAMENTO DISPONÍVEL (col-span-3) */}
          <div className="lg:col-span-3 rounded-xl bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333]/90 p-3.5 relative overflow-hidden group hover:border-[#00A6FB]/40 transition-all shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-[#8B95A7] truncate">
                ORÇAMENTO DISPONÍVEL
              </span>
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline whitespace-nowrap overflow-hidden">
              <span className="text-2xl lg:text-3xl font-black font-mono tracking-tight text-white whitespace-nowrap">
                R$ {formattedBudgetM} <span className="text-base font-bold text-[#8B95A7]">M</span>
              </span>
            </div>

            <p className="text-[11px] text-[#8B95A7] mt-2 font-mono truncate">
              Teto de gastos FIA respeitado
            </p>
          </div>

          {/* Card 4: SETORES S1/S2/S3 COM TEMPOS EM VERMELHO E TRAÇADO REAL DO CALENDÁRIO (col-span-2) */}
          <div className="lg:col-span-2 rounded-xl bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333]/90 p-3 relative overflow-hidden shadow-lg flex items-center justify-between gap-2">
            {/* Tempos em vermelho */}
            <div className="space-y-1 font-mono">
              <div>
                <span className="text-[10px] text-cyan-400 font-bold block leading-none">S1</span>
                <span className="text-[#E10600] font-black text-xs leading-none">22.431</span>
              </div>
              <div>
                <span className="text-[10px] text-cyan-400 font-bold block leading-none">S2</span>
                <span className="text-[#E10600] font-black text-xs leading-none">31.208</span>
              </div>
              <div>
                <span className="text-[10px] text-cyan-400 font-bold block leading-none">S3</span>
                <span className="text-[#E10600] font-black text-xs leading-none">26.917</span>
              </div>
            </div>

            {/* Traçado real do circuito (Imagem do Calendário) ao lado com pontos vermelhos */}
            <div className="w-20 h-16 sm:w-24 sm:h-18 flex items-center justify-center relative rounded-lg bg-black/40 border border-white/10 overflow-hidden p-1">
              {currentCircuitPhotoUrl ? (
                <CircuitTrackImage
                  src={currentCircuitPhotoUrl}
                  alt={`Traçado ${currentGP.name}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <svg
                  viewBox={currentTrack.viewBox}
                  className="w-full h-full drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                >
                  <path
                    d={currentTrack.svgPath}
                    fill="none"
                    stroke="#1E293B"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={currentTrack.svgPath}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={currentTrack.startFinish.x}
                    cy={currentTrack.startFinish.y}
                    r="3.5"
                    fill="#E10600"
                    className="animate-pulse"
                  />
                </svg>
              )}
              {/* Pontos vermelhos luminosos sutis nos setores */}
              <div className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-[#E10600] shadow-[0_0_6px_#E10600]" />
              <div className="absolute bottom-2 left-3 w-1.5 h-1.5 rounded-full bg-[#E10600] shadow-[0_0_6px_#E10600]" />
            </div>
          </div>

          {/* Card 5: VOLTA ATUAL COM DELTA EM VERMELHO + ESTRATÉGIA DE CORRIDA COM GRÁFICO (col-span-3) */}
          <div className="lg:col-span-3 rounded-xl bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333]/90 p-3.5 relative overflow-hidden shadow-lg grid grid-cols-2 gap-2">
            {/* Lado Esquerdo: VOLTA ATUAL com delta em vermelho */}
            <div className="flex flex-col justify-between border-r border-[#1F2733]/70 pr-2">
              <span className="text-[10px] font-mono text-[#8B95A7] uppercase font-bold tracking-wider">
                VOLTA ATUAL
              </span>
              <div className="my-1">
                <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight block">
                  1:13.542
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-[#E10600]">
                  +0.217
                </span>
              </div>
              <span className="text-[9px] font-mono text-[#8B95A7] uppercase">VOLTA</span>
            </div>

            {/* Lado Direito: ESTRATÉGIA DE CORRIDA com gráfico de linha Soft/Medium/Hard */}
            <div className="flex flex-col justify-between pl-1 font-mono">
              <span className="text-[9px] text-[#8B95A7] uppercase font-bold tracking-wider truncate">
                ESTRATÉGIA DE CORRIDA
              </span>

              {/* Compostos com anéis de cor */}
              <div className="space-y-0.5 text-[9px] my-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full ring-2 ring-[#E10600] bg-transparent" />
                  <span className="text-white font-semibold">Soft</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full ring-2 ring-[#F59E0B] bg-transparent" />
                  <span className="text-[#CBD5E1]">Medium</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full ring-2 ring-slate-400 bg-transparent" />
                  <span className="text-[#8B95A7]">Hard</span>
                </div>
              </div>

              {/* Gráfico de linha dos compostos */}
              <div className="h-6 w-full relative">
                <svg viewBox="0 0 100 24" className="w-full h-full overflow-visible">
                  {/* Linhas de base */}
                  <line
                    x1="0"
                    y1="20"
                    x2="100"
                    y2="20"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                  />
                  {/* Linha de degradação vermelha conectando os stints */}
                  <path
                    d="M 10 4 L 45 10 L 95 18"
                    fill="none"
                    stroke="#E10600"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  {/* Pontos nos compostos */}
                  <circle cx="10" cy="4" r="2.5" fill="#E10600" />
                  <circle cx="45" cy="10" r="2.5" fill="#F59E0B" />
                  <circle cx="95" cy="18" r="2.5" fill="#FFFFFF" />
                </svg>
                <div className="flex justify-between text-[7px] text-[#8B95A7] mt-0.5">
                  <span>0</span>
                  <span>20</span>
                  <span>40</span>
                  <span>60</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. HERO DO GP (CARD TRANSLÚCIDO COM GLOW VERMELHO) + BARRAS CIANO FLUTUANDO À DIREITA */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center min-h-[300px]">
          {/* Lado Esquerdo: Hero Card do GP com badge, título gigante, bandeira+circuito em azul-claro, colunas, botões e traçado */}
          <div className="lg:col-span-7 rounded-2xl bg-[#090D15]/85 backdrop-blur-md border border-[#E10600]/40 p-5 sm:p-6 shadow-[0_0_35px_rgba(225,6,0,0.22)] hover:border-[#E10600]/70 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              {/* Lado Esquerdo do Card GP */}
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-[#E10600] text-white hover:bg-[#FF2E25] font-mono text-[11px] font-black uppercase tracking-wider px-3 py-1 shadow-md shadow-[#E10600]/40 border-none">
                    RODADA {currentRoundNumber} DE {totalRounds}
                  </Badge>
                  <span className="text-xs font-mono text-[#E2E8F0] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#8B95A7]" />
                    Próximo Evento Oficial
                  </span>
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-[36px] font-black text-white tracking-tight leading-tight drop-shadow-md">
                    {currentGP.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-2 text-sm sm:text-base font-mono">
                    <span className="text-xl shrink-0">{currentGP.flag}</span>
                    <span className="text-[#00A6FB] font-bold drop-shadow truncate">
                      {currentGP.circuit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lado Direito do Card GP: Traçado real com pontos vermelhos */}
              <div className="shrink-0 flex items-center justify-center w-36 h-28 sm:w-44 sm:h-32 rounded-xl bg-black/40 border border-white/10 p-2 relative overflow-hidden group">
                {currentCircuitPhotoUrl ? (
                  <CircuitTrackImage
                    src={currentCircuitPhotoUrl}
                    alt={`Traçado ${currentGP.circuit}`}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <svg
                    viewBox={currentTrack.viewBox}
                    className="w-full h-full drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]"
                  >
                    <path
                      d={currentTrack.svgPath}
                      fill="none"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={currentTrack.svgPath}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx={currentTrack.startFinish.x}
                      cy={currentTrack.startFinish.y}
                      r="4"
                      fill="#E10600"
                      className="animate-pulse"
                    />
                  </svg>
                )}
                {/* Pontos vermelhos indicadores nos setores */}
                <div className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-[#E10600] animate-pulse shadow-[0_0_8px_#E10600]" />
                <div className="absolute bottom-3 left-3 w-2 h-2 rounded-full bg-[#E10600] animate-pulse shadow-[0_0_8px_#E10600]" />
                <div className="absolute top-1/2 left-2 w-1.5 h-1.5 rounded-full bg-[#E10600] shadow-[0_0_6px_#E10600]" />
              </div>
            </div>

            {/* Colunas: EXTENSÃO, VOLTAS, DESAFIO */}
            <div className="grid grid-cols-[auto_auto_1fr] sm:grid-cols-[110px_90px_1fr] gap-4 sm:gap-6 pt-4 mt-4 text-xs font-mono border-t border-white/10">
              <div className="shrink-0">
                <span className="text-[#8B95A7] block text-[10px] uppercase font-bold tracking-wider">
                  EXTENSÃO
                </span>
                <strong className="text-white text-sm sm:text-base">
                  {currentGP.circuitLengthKm.toFixed(3)} km
                </strong>
              </div>
              <div className="shrink-0">
                <span className="text-[#8B95A7] block text-[10px] uppercase font-bold tracking-wider">
                  VOLTAS
                </span>
                <strong className="text-white text-sm sm:text-base">{currentGP.laps}</strong>
              </div>
              <div className="min-w-0">
                <span className="text-[#8B95A7] block text-[10px] uppercase font-bold tracking-wider">
                  DESAFIO
                </span>
                <strong
                  className="text-white text-xs sm:text-sm font-semibold truncate block"
                  title={currentGP.characteristic}
                >
                  {currentGP.characteristic}
                </strong>
              </div>
            </div>

            {/* Botões: "Ver Detalhes do GP" em vermelho + "Ajustar Aerodinâmica Ativa" secundário */}
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <Button
                asChild
                size="lg"
                className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-black px-6 shadow-xl shadow-[#E10600]/40 transition-all hover:scale-[1.02] text-sm font-mono tracking-wide"
              >
                <Link to="/race" className="flex items-center gap-2">
                  <Zap className="w-4 h-4 fill-current" />
                  Ver Detalhes do GP
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/15 bg-black/40 backdrop-blur-md text-[#F5F7FA] hover:bg-white/10 hover:border-cyan-400/50 text-sm font-mono tracking-wide"
              >
                <Link to="/car" className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Ajustar Aerodinâmica Ativa
                </Link>
              </Button>
            </div>
          </div>

          {/* Lado Direito: Barras de Desgaste (Pneus/Combustível/ERS/Motor) com barras ciano flutuando à direita sobre o carro */}
          <div className="lg:col-span-5 flex flex-col justify-center items-end">
            <div className="w-full max-w-sm rounded-xl bg-[#090D15]/80 backdrop-blur-md border border-white/10 p-4 font-mono text-xs shadow-2xl space-y-3">
              {/* Barra 1: DESGASTE PNEUS */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-[#8B95A7] uppercase font-bold tracking-wider w-32">
                  DESGASTE PNEUS
                </span>
                <div className="flex-1 bg-black/60 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_#22D3EE]"
                    style={{ width: `${tireWearPct}%` }}
                  />
                </div>
                <span className="text-white font-mono font-bold w-10 text-right">
                  {tireWearPct}%
                </span>
              </div>

              {/* Barra 2: COMBUSTÍVEL */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-[#8B95A7] uppercase font-bold tracking-wider w-32">
                  COMBUSTÍVEL
                </span>
                <div className="flex-1 bg-black/60 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_#22D3EE]"
                    style={{ width: `${fuelPct}%` }}
                  />
                </div>
                <span className="text-white font-mono font-bold w-10 text-right">{fuelPct}%</span>
              </div>

              {/* Barra 3: ERS */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-[#8B95A7] uppercase font-bold tracking-wider w-32">
                  ERS
                </span>
                <div className="flex-1 bg-black/60 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_#22D3EE]"
                    style={{ width: `${ersPct}%` }}
                  />
                </div>
                <span className="text-white font-mono font-bold w-10 text-right">{ersPct}%</span>
              </div>

              {/* Barra 4: MOTOR */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-[#8B95A7] uppercase font-bold tracking-wider w-32">
                  MOTOR
                </span>
                <div className="flex-1 bg-black/60 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_#22D3EE]"
                    style={{ width: `${engineHealthPct}%` }}
                  />
                </div>
                <span className="text-white font-mono font-bold w-10 text-right">
                  {engineHealthPct}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. LINHA INFERIOR (DUPLA DE PILOTOS TITULARES & LINHA DO TEMPO DE NOTÍCIAS) */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Coluna A: Dupla de Pilotos Titulares */}
          <div className="rounded-2xl bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333]/90 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1F2733]/60">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#E10600] shrink-0" />
                  <div>
                    <h2 className="text-base font-extrabold text-white">
                      Dupla de Pilotos Titulares
                    </h2>
                    <p className="text-xs text-[#8B95A7] font-mono mt-0.5">
                      Pilares da nossa temporada
                    </p>
                  </div>
                </div>

                <Link
                  to="/team"
                  className="text-xs font-mono font-bold text-[#00A6FB] hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  Gerenciar
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Lista dos Pilotos */}
              <div className="mt-4 space-y-2.5">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full bg-[#161D29]" />
                    <Skeleton className="h-16 w-full bg-[#161D29]" />
                  </div>
                ) : (
                  <>
                    {/* Titular 1 & Titular 2 */}
                    {titularDrivers.map((driver, idx) => {
                      const pts = driverPointsMap[driver.id] ?? (idx === 0 ? 52 : 18)
                      const flag = getCountryFlag(driver.nationality)
                      const salaryM = ((driver.salary || 10000000) / 1_000_000).toLocaleString(
                        'pt-BR',
                        {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        },
                      )

                      return (
                        <div
                          key={driver.id}
                          className="p-3 rounded-xl bg-[#080C14]/90 border border-[#1F2733] hover:border-[#E10600]/40 transition-all flex items-center justify-between gap-3"
                        >
                          {/* Avatar / Helmet */}
                          <div className="flex items-center gap-3 min-w-0">
                            <DriverHelmet driver={driver} teamColor={team?.color} size="md" />

                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0" title={driver.nationality}>
                                {flag}
                              </span>
                              <div className="min-w-0">
                                <h3 className="font-bold text-sm text-white truncate">
                                  {driver.name}
                                </h3>
                              </div>
                            </div>
                          </div>

                          {/* Idade | Salário e Pontos */}
                          <div className="flex items-center gap-4 shrink-0 font-mono">
                            <span className="text-xs text-[#8B95A7] hidden sm:inline">
                              {driver.age} anos <span className="text-[#334155]">|</span> R${' '}
                              {salaryM} M
                            </span>
                            <div className="text-right">
                              <span className="text-base font-black text-white">{pts}</span>
                              <span className="text-xs text-[#8B95A7] ml-1">pts</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Piloto Reserva */}
                    {reserveDriver && (
                      <div className="p-3 rounded-xl bg-[#080C14]/70 border border-[#1F2733]/80 hover:border-cyan-500/30 transition-all flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <DriverHelmet driver={reserveDriver} teamColor={team?.color} size="md" />

                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0" title={reserveDriver.nationality}>
                              {getCountryFlag(reserveDriver.nationality)}
                            </span>
                            <h3 className="font-semibold text-sm text-[#E2E8F0] truncate">
                              {reserveDriver.name}
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 font-mono">
                          <span className="text-xs text-[#8B95A7] hidden sm:inline">
                            {reserveDriver.age} anos <span className="text-[#334155]">|</span> R${' '}
                            {((reserveDriver.salary || 4000000) / 1_000_000).toLocaleString(
                              'pt-BR',
                              {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              },
                            )}{' '}
                            M
                          </span>
                          <div className="text-right">
                            <span className="text-base font-bold text-[#8B95A7]">
                              {driverPointsMap[reserveDriver.id] || 0}
                            </span>
                            <span className="text-xs text-[#8B95A7] ml-1">pts</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Coluna B: Linha do Tempo de Notícias */}
          <div className="rounded-2xl bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333]/90 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1F2733]/60">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-[#00A6FB] shrink-0" />
                  <div>
                    <h2 className="text-base font-extrabold text-white">
                      Linha do Tempo de Notícias
                    </h2>
                    <p className="text-xs text-[#8B95A7] font-mono mt-0.5">
                      Acontecimentos recentes e comunicados oficiais
                    </p>
                  </div>
                </div>

                <Link
                  to="/race"
                  className="text-xs font-mono font-bold text-[#00A6FB] hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  Ver todas
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Feed de Eventos */}
              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full bg-[#161D29]" />
                    <Skeleton className="h-12 w-full bg-[#161D29]" />
                    <Skeleton className="h-12 w-full bg-[#161D29]" />
                  </div>
                ) : (
                  displayEvents.map((ev) => {
                    const isResult = ev.type === 'resultado'
                    const isDev = ev.type === 'desenvolvimento'
                    const isContract = ev.type === 'patrocinio' || ev.type === 'contrato'

                    return (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl bg-[#080C14]/90 border border-[#1F2733] flex items-start gap-3 text-xs transition-all hover:border-[#1F2733]/90"
                      >
                        <div className="mt-0.5 shrink-0">
                          {isResult && (
                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                              <Trophy className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {isDev && (
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                              <Wrench className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {isContract && (
                            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {!isResult && !isDev && !isContract && (
                            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                              <Info className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-white font-bold text-xs truncate">{ev.title}</p>
                            <span className="text-[10px] font-mono text-[#8B95A7] shrink-0">
                              {ev.date}
                            </span>
                          </div>
                          <p className="text-[#8B95A7] text-[11px] mt-0.5 line-clamp-2 leading-relaxed">
                            {ev.desc}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. FOOTER IDENTIDADE: AUDI F1 TEAM | GERENCIADOR DE F1 2026 // MAIS QUE UMA EQUIPE. UMA ESTRATÉGIA. */}
      {/* ============================================================== */}
      <footer className="relative z-10 pt-4 pb-2 border-t border-[#1F2733]/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono uppercase tracking-widest text-[#8B95A7]">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="font-extrabold text-white">{team?.name || 'AUDI F1 TEAM'}</span>
          <span className="text-[#334155]">|</span>
          <span>GERENCIADOR DE F1 2026</span>
        </div>

        <div className="flex items-center gap-3 text-center sm:text-right text-[11px]">
          <span className="w-6 h-0.5 bg-[#8B95A7]" />
          <span>MAIS QUE UMA EQUIPE. UMA ESTRATÉGIA.</span>
        </div>
      </footer>
    </div>
  )
}
