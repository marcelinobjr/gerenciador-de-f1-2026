import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { DriverModel, EventModel, PartModel, RaceResultModel } from '@/types/f1'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { standingsService } from '@/services/standingsService'
import { formatCurrency } from '@/lib/formatters'
import {
  Trophy,
  Flag,
  DollarSign,
  TrendingUp,
  UserCheck,
  ChevronRight,
  Radio,
  FileText,
  Wrench,
  Sliders,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  Gauge,
  Info,
  CircleDot,
  Check,
  HelpCircle,
  Calendar,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
  const [initialFuelLoad, setInitialFuelLoad] = useState<number | null>(null)

  const loadDashboardData = async () => {
    if (!team || !season) {
      setLoading(false)
      return
    }
    try {
      const currentRoundForSetups = season.current_round || 1
      const [dList, eList, pList, rList, cList, setupsList] = await Promise.all([
        f1Service.getTeamDrivers(team.id),
        f1Service.getTeamEvents(team.id, 20),
        f1Service.getTeamParts(team.id),
        f1Service.getSeasonRaceResults(season.id),
        f1Service.getAllCircuits().catch(() => [] as CircuitModel[]),
        f1Service.getSessionSetups(team.id, season.id, currentRoundForSetups).catch(() => []),
      ])

      try {
        const raceSetup = setupsList?.find((s) => s.session === 'race')
        if (raceSetup && typeof raceSetup.initial_fuel_load === 'number') {
          setInitialFuelLoad(raceSetup.initial_fuel_load)
        } else {
          setInitialFuelLoad(null)
        }
      } catch {
        setInitialFuelLoad(null)
      }

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

  // Standings calculation via standingsService
  const { constructorPosition, teamPoints, driverPointsMap, morale } = useMemo(() => {
    const standings = standingsService.calculateStandings({
      raceResults,
      playerDrivers: drivers,
      team,
      season,
    })

    const calcMorale = standingsService.getTeamMorale({
      teamPoints: standings.teamPoints,
      constructorRank: standings.playerConstructorRank,
      parts,
    })

    return {
      constructorPosition: standings.playerConstructorRank,
      teamPoints: standings.teamPoints,
      driverPointsMap: standings.driverPointsMap,
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
  const tireWearPct =
    parts.length > 0 ? Math.round(Math.min(95, Math.max(15, 100 - avgPartCondition + 12))) : 100

  // Combustível: carga inicial do setup de corrida (fallback neutro 100%)
  const fuelPct = initialFuelLoad ?? 100
  const fuelSubtitle = 'carga inicial'

  // ERS: condição da unidade de potência (50% elétrico no regulamento 2026)
  const ersPct = team ? Math.max(0, 100 - (team.active_engine_wear ?? 0)) : 100

  // Pilotos organizados: titulares (1 e 2) e reserva (apenas dados reais persistidos no banco)
  const { titularDrivers, reserveDriver } = useMemo(() => {
    const tit = drivers.filter((d) => d.role !== 'reserva').slice(0, 2)
    const res = drivers.find((d) => d.role === 'reserva')
    return { titularDrivers: tit, reserveDriver: res }
  }, [drivers])

  // Notícias formatadas com badges e ícones
  const displayEvents = useMemo(() => {
    if (events.length === 0) {
      return []
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

          {/* Card 4: SETORES DO CIRCUITO / TELEMETRIA EM TEMPO REAL (col-span-2) */}
          <div className="lg:col-span-2 rounded-xl bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333]/90 p-3 relative overflow-hidden shadow-lg flex items-center justify-between gap-2">
            {/* Estado honesto dos setores */}
            <div className="space-y-1 font-mono min-w-0">
              <span className="text-[10px] text-[#8B95A7] uppercase font-bold tracking-wider block">
                SETORES S1/S2/S3
              </span>
              <div className="space-y-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-cyan-400/80 font-bold leading-none">S1</span>
                  <span className="text-[#8B95A7] font-mono text-[11px]">--.---</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-cyan-400/80 font-bold leading-none">S2</span>
                  <span className="text-[#8B95A7] font-mono text-[11px]">--.---</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-cyan-400/80 font-bold leading-none">S3</span>
                  <span className="text-[#8B95A7] font-mono text-[11px]">--.---</span>
                </div>
              </div>
            </div>

            {/* Traçado real do circuito (Imagem do Calendário) */}
            <div className="w-20 h-16 sm:w-24 sm:h-18 flex items-center justify-center relative rounded-lg bg-black/40 border border-white/10 overflow-hidden p-1 shrink-0">
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
                </svg>
              )}
            </div>
          </div>

          {/* Card 5: STATUS DE SESSÃO / TELEMETRIA EM PISTA (col-span-3) */}
          <div className="lg:col-span-3 rounded-xl bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333]/90 p-3.5 relative overflow-hidden shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#1F2733]/60">
              <span className="text-[10px] font-mono text-[#8B95A7] uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-cyan-400" />
                TELEMETRIA DE SESSÃO
              </span>
              <Badge
                variant="outline"
                className="text-[9px] font-mono text-[#8B95A7] border-white/10 bg-black/40 px-1.5 py-0"
              >
                GP {currentRoundNumber}
              </Badge>
            </div>

            <div className="py-2">
              <p className="text-xs font-mono text-[#CBD5E1] font-semibold leading-snug">
                Telemetria disponível durante o fim de semana
              </p>
              <p className="text-[11px] font-mono text-[#8B95A7] mt-1 leading-relaxed">
                Tempos de volta, setores e estratégia de compostos ativos na sessão de pista.
              </p>
            </div>

            <div className="pt-1.5 border-t border-[#1F2733]/40 flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#8B95A7]">
                Volta atual: <strong className="text-white font-normal">--:--.---</strong>
              </span>
              <Link
                to="/race"
                className="text-[10px] font-mono font-bold text-[#00A6FB] hover:text-cyan-300 transition-colors flex items-center gap-1"
              >
                Abrir Pista
                <ChevronRight className="w-3 h-3" />
              </Link>
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
                <div className="w-36 flex flex-col min-w-0">
                  <span className="text-[11px] text-[#8B95A7] uppercase font-bold tracking-wider truncate">
                    DESGASTE PNEUS
                  </span>
                  <span className="text-[9px] text-[#55657E] font-mono leading-tight truncate">
                    média das peças
                  </span>
                </div>
                <div className="flex-1 bg-black/60 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_#22D3EE]"
                    style={{ width: `${tireWearPct}%` }}
                  />
                </div>
                <span className="text-white font-mono font-bold w-12 text-right">
                  {tireWearPct}%
                </span>
              </div>

              {/* Barra 2: COMBUSTÍVEL */}
              <div className="flex items-center justify-between gap-3">
                <div className="w-36 flex flex-col min-w-0">
                  <span className="text-[11px] text-[#8B95A7] uppercase font-bold tracking-wider truncate">
                    COMBUSTÍVEL
                  </span>
                  <span className="text-[9px] text-[#55657E] font-mono leading-tight truncate">
                    {fuelSubtitle}
                  </span>
                </div>
                <div className="flex-1 bg-black/60 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_#22D3EE]"
                    style={{ width: `${Math.min(100, fuelPct)}%` }}
                  />
                </div>
                <span className="text-white font-mono font-bold w-12 text-right">{fuelPct}%</span>
              </div>

              {/* Barra 3: ERS */}
              <div className="flex items-center justify-between gap-3">
                <div className="w-36 flex flex-col min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-[#8B95A7] uppercase font-bold tracking-wider truncate">
                      ERS
                    </span>
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center text-[#55657E] hover:text-cyan-400 transition-colors focus:outline-none"
                            aria-label="Informações sobre o ERS"
                          >
                            <HelpCircle className="w-3 h-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="bg-[#0B0E14] text-cyan-300 border border-cyan-500/30 text-xs font-mono shadow-xl max-w-xs"
                        >
                          ≈ condição da unidade de potência (50% elétrico)
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span className="text-[9px] text-[#55657E] font-mono leading-tight truncate">
                    unidade de energia
                  </span>
                </div>
                <div className="flex-1 bg-black/60 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_#22D3EE]"
                    style={{ width: `${ersPct}%` }}
                  />
                </div>
                <span className="text-white font-mono font-bold w-12 text-right">{ersPct}%</span>
              </div>

              {/* Barra 4: MOTOR */}
              <div className="flex items-center justify-between gap-3">
                <div className="w-36 flex flex-col min-w-0">
                  <span className="text-[11px] text-[#8B95A7] uppercase font-bold tracking-wider truncate">
                    MOTOR
                  </span>
                  <span className="text-[9px] text-[#55657E] font-mono leading-tight truncate">
                    desgaste do carro
                  </span>
                </div>
                <div className="flex-1 bg-black/60 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-cyan-400 rounded-full transition-all duration-500 shadow-[0_0_10px_#22D3EE]"
                    style={{ width: `${engineHealthPct}%` }}
                  />
                </div>
                <span className="text-white font-mono font-bold w-12 text-right">
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
                ) : titularDrivers.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#080C14]/60 border border-dashed border-[#1F2733] text-center font-mono text-xs text-[#8B95A7] space-y-2">
                    <p>Nenhum piloto titular vinculado à escuderia no momento.</p>
                    <Link
                      to="/team"
                      className="inline-flex items-center gap-1 text-[#00A6FB] hover:text-cyan-300 font-bold underline underline-offset-4"
                    >
                      Contratar pilotos no Centro de Equipe
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Titular 1 & Titular 2 */}
                    {titularDrivers.map((driver) => {
                      const pts = driverPointsMap[driver.id] ?? 0
                      const flag = getCountryFlag(driver.nationality)
                      const salaryM = ((driver.salary || 0) / 1_000_000).toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })

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
                            {((reserveDriver.salary || 0) / 1_000_000).toLocaleString('pt-BR', {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}{' '}
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
                ) : displayEvents.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#080C14]/60 border border-dashed border-[#1F2733] text-center font-mono text-xs text-[#8B95A7]">
                    Nenhum comunicado oficial registrado recentemente.
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
