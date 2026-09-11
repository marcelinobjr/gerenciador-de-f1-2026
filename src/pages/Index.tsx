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
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { ProgressBar } from '@/components/ProgressBar'
import { EmptyState } from '@/components/EmptyState'

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
        {/* 0. PAGE HEADER (RACE OPERATIONS) */}
        {/* ============================================================== */}
        <PageHeader
          eyebrow="RACE OPERATIONS // VISÃO GERAL"
          title={`Centro de Operações — ${team?.name || 'Escuderia'}`}
          description={`Temporada ${season?.year || 2026} • Rodada ${currentRoundNumber} de ${totalRounds} • Gestão esportiva, técnica e financeira`}
          badge={
            <Badge className="bg-[#161D29] text-[#F5F7FA] border border-[#1F2733] font-mono text-[11px] font-semibold">
              GP {currentRoundNumber}: {currentGP.name}
            </Badge>
          }
          actions={
            <Button
              asChild
              size="sm"
              className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-bold font-mono text-xs px-4 shadow-sm"
            >
              <Link to="/race" className="flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 fill-current" />
                Ir para o GP
              </Link>
            </Button>
          }
        />

        {/* ============================================================== */}
        {/* 1. LINHA DE CARDS DE STATUS (STATCARDS RACE OPERATIONS) */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: CONSTRUTORES */}
          <StatCard
            eyebrow="CONSTRUTORES"
            value={`${constructorPosition}º`}
            subtext={`/ ${totalGridTeams} equipes no grid oficial`}
            icon={Trophy}
            iconColor="text-amber-400"
            accentColor="#E10600"
          />

          {/* Card 2: PONTOS TOTAIS */}
          <StatCard
            eyebrow="PONTOS TOTAIS"
            value={teamPoints}
            subtext={gpsDisputadosText}
            icon={UserCheck}
            iconColor="text-[#E10600]"
          />

          {/* Card 3: ORÇAMENTO DISPONÍVEL */}
          <StatCard
            eyebrow="ORÇAMENTO DISPONÍVEL"
            value={`R$ ${formattedBudgetM} M`}
            subtext="Teto de gastos FIA respeitado"
            icon={DollarSign}
            iconColor="text-emerald-400"
          />

          {/* Card 4: MORAL DA EQUIPE */}
          <StatCard
            eyebrow="MORAL DA EQUIPE"
            value={`${morale}%`}
            subtext={
              morale >= 70
                ? 'Ambiente otimista'
                : morale >= 40
                  ? 'Estável sob pressão'
                  : 'Clima tenso'
            }
            icon={TrendingUp}
            iconColor={
              morale >= 70 ? 'text-emerald-400' : morale >= 40 ? 'text-amber-400' : 'text-red-400'
            }
          />
        </div>

        {/* ============================================================== */}
        {/* 2. HERO DO GP (CAMADA 1 COM BORDA CAMADA 2) + ESTADO DO MONOPOSTO COM PROGRESSBAR */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Lado Esquerdo: Hero Card do GP na Camada 1 */}
          <div className="lg:col-span-7 rounded-xl bg-[#11161F] border border-[#1F2733] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              {/* Lado Esquerdo do Card GP */}
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-[#E10600] text-white hover:bg-[#FF2E25] font-mono text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 border-none">
                    RODADA {currentRoundNumber} DE {totalRounds}
                  </Badge>
                  <span className="text-xs font-mono text-[#8B95A7] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#8B95A7]" />
                    Próximo Evento Oficial
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#F5F7FA] tracking-tight">
                    {currentGP.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 text-sm font-mono">
                    <span className="text-lg shrink-0">{currentGP.flag}</span>
                    <span className="text-[#F5F7FA] font-semibold truncate">
                      {currentGP.circuit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lado Direito do Card GP: Traçado real */}
              <div className="shrink-0 flex items-center justify-center w-36 h-28 sm:w-44 sm:h-32 rounded-lg bg-[#0E131B] border border-[#1F2733] p-2 relative overflow-hidden group">
                {currentCircuitPhotoUrl ? (
                  <CircuitTrackImage
                    src={currentCircuitPhotoUrl}
                    alt={`Traçado ${currentGP.circuit}`}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <svg
                    viewBox={currentTrack.viewBox}
                    className="w-full h-full drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
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
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Colunas: EXTENSÃO, VOLTAS, DESAFIO */}
            <div className="grid grid-cols-[auto_auto_1fr] sm:grid-cols-[110px_90px_1fr] gap-4 sm:gap-6 pt-4 mt-4 text-xs font-mono border-t border-[#1F2733]">
              <div className="shrink-0">
                <span className="text-[#8B95A7] block text-[10px] uppercase font-bold tracking-wider">
                  EXTENSÃO
                </span>
                <strong className="text-[#F5F7FA] font-num text-sm sm:text-base">
                  {currentGP.circuitLengthKm.toFixed(3)} km
                </strong>
              </div>
              <div className="shrink-0">
                <span className="text-[#8B95A7] block text-[10px] uppercase font-bold tracking-wider">
                  VOLTAS
                </span>
                <strong className="text-[#F5F7FA] font-num text-sm sm:text-base">
                  {currentGP.laps}
                </strong>
              </div>
              <div className="min-w-0">
                <span className="text-[#8B95A7] block text-[10px] uppercase font-bold tracking-wider">
                  DESAFIO
                </span>
                <strong
                  className="text-[#F5F7FA] text-xs sm:text-sm font-semibold truncate block"
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
                size="default"
                className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-bold px-5 text-xs font-mono tracking-wide"
              >
                <Link to="/race" className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Ver Detalhes do GP
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="default"
                className="border-[#1F2733] bg-[#161D29] text-[#F5F7FA] hover:bg-[#1C2534] hover:border-[#2C3849] text-xs font-mono tracking-wide"
              >
                <Link to="/car" className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#8B95A7]" />
                  Ajustar Aerodinâmica Ativa
                </Link>
              </Button>
            </div>
          </div>

          {/* Lado Direito: Estado do Monoposto com ProgressBar padronizado (Camada 1) */}
          <div className="lg:col-span-5 flex flex-col justify-center">
            <div className="w-full rounded-xl bg-[#11161F] border border-[#1F2733] p-5 font-mono text-xs shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#1F2733]">
                <span className="eyebrow text-[#8B95A7]">ESTADO DO MONOPOSTO</span>
                <Badge
                  variant="outline"
                  className="border-[#1F2733] bg-[#161D29] text-[#8B95A7] font-mono text-[10px] px-2 py-0"
                >
                  TELEMETRIA BASE
                </Badge>
              </div>

              {/* Barra 1: DESGASTE PNEUS (estimativa da média das peças) */}
              <div className="space-y-1">
                <ProgressBar value={tireWearPct} label="DESGASTE PNEUS (MÉDIA PEÇAS)" size="sm" />
              </div>

              {/* Barra 2: COMBUSTÍVEL (carga inicial do setup de corrida) */}
              <div className="space-y-1">
                <ProgressBar value={fuelPct} label={`COMBUSTÍVEL (${fuelSubtitle})`} size="sm" />
              </div>

              {/* Barra 3: ERS (condição da UP 50% elétrica) */}
              <div className="space-y-1">
                <ProgressBar value={ersPct} label="ERS (UNIDADE DE ENERGIA)" size="sm" />
              </div>

              {/* Barra 4: SAÚDE DO MOTOR */}
              <div className="space-y-1">
                <ProgressBar
                  value={engineHealthPct}
                  label="SAÚDE DO MOTOR (DESGASTE DO CARRO)"
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. LINHA INFERIOR (DUPLA DE PILOTOS TITULARES & LINHA DO TEMPO DE NOTÍCIAS) */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Coluna A: Dupla de Pilotos Titulares */}
          <div className="rounded-xl bg-[#11161F] border border-[#1F2733] p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1F2733]">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#E10600] shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-[#F5F7FA]">Dupla de Pilotos Titulares</h3>
                    <p className="text-xs text-[#8B95A7]">Pilares da temporada oficial</p>
                  </div>
                </div>

                <Link
                  to="/team"
                  className="text-xs font-mono font-semibold text-[#8B95A7] hover:text-[#F5F7FA] transition-colors flex items-center gap-1"
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
                  <EmptyState
                    icon={UserCheck}
                    title="Nenhum piloto titular vinculado"
                    description="Contrate pilotos no Centro de Equipe para pontuar na temporada."
                    compact
                    action={
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="border-[#1F2733] bg-[#161D29]"
                      >
                        <Link to="/team">Ir para Centro de Equipe</Link>
                      </Button>
                    }
                  />
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
                          className="p-3 rounded-lg bg-[#161D29] border border-[#1F2733] hover:border-[#2C3849] transition-all flex items-center justify-between gap-3"
                        >
                          {/* Avatar / Helmet */}
                          <div className="flex items-center gap-3 min-w-0">
                            <DriverHelmet driver={driver} teamColor={team?.color} size="md" />

                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0" title={driver.nationality}>
                                {flag}
                              </span>
                              <div className="min-w-0">
                                <h4 className="font-semibold text-sm text-[#F5F7FA] truncate">
                                  {driver.name}
                                </h4>
                                <span className="text-[11px] font-mono text-[#8B95A7]">
                                  {driver.age} anos • R$ {salaryM} M/ano
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Pontos */}
                          <div className="text-right shrink-0">
                            <span className="font-num text-lg font-bold text-[#F5F7FA]">{pts}</span>
                            <span className="text-xs text-[#8B95A7] ml-1">pts</span>
                          </div>
                        </div>
                      )
                    })}

                    {/* Piloto Reserva */}
                    {reserveDriver && (
                      <div className="p-3 rounded-lg bg-[#0E131B] border border-[#1F2733] hover:border-[#2C3849] transition-all flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <DriverHelmet driver={reserveDriver} teamColor={team?.color} size="md" />

                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0" title={reserveDriver.nationality}>
                              {getCountryFlag(reserveDriver.nationality)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-medium text-sm text-[#8B95A7] truncate">
                                  {reserveDriver.name}
                                </h4>
                                <Badge
                                  variant="outline"
                                  className="border-[#1F2733] text-[9px] uppercase font-mono px-1 py-0 text-[#8B95A7]"
                                >
                                  Reserva
                                </Badge>
                              </div>
                              <span className="text-[11px] font-mono text-[#55657E]">
                                {reserveDriver.age} anos • R${' '}
                                {((reserveDriver.salary || 0) / 1_000_000).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}{' '}
                                M/ano
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-num text-sm font-semibold text-[#8B95A7]">
                            {driverPointsMap[reserveDriver.id] || 0}
                          </span>
                          <span className="text-xs text-[#55657E] ml-1">pts</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Coluna B: Linha do Tempo de Notícias */}
          <div className="rounded-xl bg-[#11161F] border border-[#1F2733] p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1F2733]">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#8B95A7] shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-[#F5F7FA]">Linha do Tempo de Notícias</h3>
                    <p className="text-xs text-[#8B95A7]">
                      Acontecimentos recentes e comunicados oficiais
                    </p>
                  </div>
                </div>

                <Link
                  to="/race"
                  className="text-xs font-mono font-semibold text-[#8B95A7] hover:text-[#F5F7FA] transition-colors flex items-center gap-1"
                >
                  Ver todas
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Feed de Eventos */}
              <div className="mt-4 space-y-2.5">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full bg-[#161D29]" />
                    <Skeleton className="h-12 w-full bg-[#161D29]" />
                    <Skeleton className="h-12 w-full bg-[#161D29]" />
                  </div>
                ) : displayEvents.length === 0 ? (
                  <EmptyState
                    icon={Radio}
                    title="Nenhum comunicado recente"
                    description="Comunicados de imprensa e eventos de corrida serão registrados aqui."
                    compact
                  />
                ) : (
                  displayEvents.map((ev) => {
                    const isResult = ev.type === 'resultado'
                    const isDev = ev.type === 'desenvolvimento'
                    const isContract = ev.type === 'patrocinio' || ev.type === 'contrato'

                    return (
                      <div
                        key={ev.id}
                        className="p-3 rounded-lg bg-[#161D29] border border-[#1F2733] flex items-start gap-3 text-xs transition-all hover:border-[#2C3849]"
                      >
                        <div className="mt-0.5 shrink-0">
                          {isResult && (
                            <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
                              <Trophy className="w-3 h-3" />
                            </div>
                          )}
                          {isDev && (
                            <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                              <Wrench className="w-3 h-3" />
                            </div>
                          )}
                          {isContract && (
                            <div className="w-6 h-6 rounded-md bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                              <FileText className="w-3 h-3" />
                            </div>
                          )}
                          {!isResult && !isDev && !isContract && (
                            <div className="w-6 h-6 rounded-md bg-purple-500/10 text-purple-400 flex items-center justify-center">
                              <Info className="w-3 h-3" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[#F5F7FA] font-semibold text-xs truncate">
                              {ev.title}
                            </p>
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
