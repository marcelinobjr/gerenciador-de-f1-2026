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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CircuitBlueprint, TRACK_LAYOUTS } from '@/components/CircuitBlueprint'
import pb from '@/lib/pocketbase/client'
import { CircuitModel } from '@/types/f1'
import defaultAustraliaMap from '@/assets/01-australia-aeace.jpg'
import heroGarageBg from '@/assets/chatgpt-image-10-de-set.de-2026-122312-e3312.png'

// Flag emoji helper
const getCountryFlag = (nat?: string) => {
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
    // team points
    const myResults = raceResults.filter((r) => r.team_id === team?.id)
    const tPoints = myResults.reduce((acc, curr) => acc + (curr.points || 0), 0)

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
      // Se metade de algo ou número inteiro
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
    return events.slice(0, 5).map((ev) => {
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

  // Imagem do circuito do calendário (upload do PocketBase ou default)
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
    <div className="space-y-6 animate-fade-in text-[#F5F7FA]">
      {/* ============================================================== */}
      {/* 1. LINHA DE CARDS DE STATUS (4 METRIC CARDS + MINI HUD DE TELEMETRIA) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Construtores */}
        <div className="rounded-xl bg-[#0D121B]/90 border border-[#1F2733]/80 p-4 relative overflow-hidden backdrop-blur-sm group hover:border-[#E10600]/40 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-[#8B95A7]">
              CONSTRUTORES
            </span>
            <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Trophy className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
              {constructorPosition}º
            </span>
            <span className="text-xs text-[#8B95A7] font-mono">/ {totalGridTeams} equipes</span>
          </div>

          <p className="text-[11px] text-[#8B95A7] mt-2 flex items-center gap-1 font-mono">
            <TrendingUp className="w-3 h-3 text-[#00A6FB]" />
            Grid Oficial da F1 2026
          </p>
        </div>

        {/* Card 2: Pontos Totais */}
        <div className="rounded-xl bg-[#0D121B]/90 border border-[#1F2733]/80 p-4 relative overflow-hidden backdrop-blur-sm group hover:border-[#E10600]/40 transition-all duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-[#8B95A7]">
              PONTOS TOTAIS
            </span>
            <div className="w-6 h-6 rounded-md bg-[#E10600]/10 text-[#E10600] flex items-center justify-center">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold font-mono tracking-tight text-white">
              {teamPoints}
            </span>
            <span className="text-xs text-[#8B95A7] font-mono">pts</span>
          </div>

          <p className="text-[11px] text-[#8B95A7] mt-2 font-mono">{gpsDisputadosText}</p>
        </div>

        {/* Card 3: Orçamento Disponível */}
        <div className="rounded-xl bg-[#0D121B]/90 border border-[#1F2733]/80 p-4 relative overflow-hidden backdrop-blur-sm group hover:border-[#00A6FB]/40 transition-all duration-200 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-[#8B95A7] truncate">
              ORÇAMENTO DISPONÍVEL
            </span>
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-2.5 flex items-baseline whitespace-nowrap overflow-hidden">
            <span className="text-xl sm:text-2xl xl:text-3xl font-extrabold font-mono tracking-tight text-white whitespace-nowrap">
              R$ {formattedBudgetM}{' '}
              <span className="text-base sm:text-lg font-bold text-[#8B95A7]">M</span>
            </span>
          </div>

          <p className="text-[11px] text-emerald-400/90 mt-2 font-mono flex items-center gap-1 truncate">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            Teto de gastos FIA respeitado
          </p>
        </div>

        {/* Card 4: Mini Traçado & Setores (S1, S2, S3) */}
        <div className="rounded-xl bg-[#0D121B]/90 border border-[#1F2733]/80 p-3.5 relative overflow-hidden backdrop-blur-sm flex items-center justify-between gap-2">
          <div className="space-y-1.5 font-mono text-xs">
            <div>
              <span className="text-[10px] text-cyan-400 font-bold block">S1</span>
              <strong className="text-white text-xs">22.431</strong>
            </div>
            <div>
              <span className="text-[10px] text-cyan-400 font-bold block">S2</span>
              <strong className="text-white text-xs">31.208</strong>
            </div>
            <div>
              <span className="text-[10px] text-cyan-400 font-bold block">S3</span>
              <strong className="text-white text-xs">26.917</strong>
            </div>
          </div>

          {/* Mini Track Imagem do Calendário com fallback Blueprint */}
          <div className="w-24 h-20 flex items-center justify-center relative rounded-md overflow-hidden bg-black/40 border border-cyan-500/10">
            {currentCircuitPhotoUrl ? (
              <img
                src={currentCircuitPhotoUrl}
                alt={`Traçado ${currentGP.name}`}
                className="w-full h-full object-contain p-1 drop-shadow-[0_0_8px_rgba(0,166,251,0.4)]"
              />
            ) : (
              <svg
                viewBox={currentTrack.viewBox}
                className="w-full h-full drop-shadow-[0_0_8px_rgba(0,166,251,0.35)]"
              >
                <path
                  d={currentTrack.svgPath}
                  fill="none"
                  stroke="#1F2A3D"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={currentTrack.svgPath}
                  fill="none"
                  stroke="#00A6FB"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={currentTrack.startFinish.x}
                  cy={currentTrack.startFinish.y}
                  r="3.5"
                  fill="#E10600"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Card 5: Volta Atual & Estratégia de Corrida */}
        <div className="rounded-xl bg-[#0D121B]/90 border border-[#1F2733]/80 p-3.5 relative overflow-hidden backdrop-blur-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#8B95A7] uppercase font-bold tracking-wider">
              VOLTA ATUAL
            </span>
            <span className="text-[10px] font-mono text-cyan-400">
              LAP {Math.min(42, currentGP.laps)} / {currentGP.laps}
            </span>
          </div>

          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-white tracking-tight">1:13.542</span>
            <span className="text-xs font-mono font-bold text-[#E10600]">+0.217</span>
          </div>

          {/* Mini Degradação / Estratégia */}
          <div className="mt-2 pt-1.5 border-t border-[#1F2733]/60 flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#E10600]" title="Soft" />
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" title="Medium" />
              <span className="w-2 h-2 rounded-full bg-slate-300" title="Hard" />
            </div>
            <span className="text-[#8B95A7]">Degradação -0.4s/v</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SEÇÃO HERO: CARRO EM DESTAQUE MÁXIMO + CARDS FLUTUANTES COM GLOW VERMELHO */}
      {/* ============================================================== */}
      <div className="relative rounded-2xl border border-red-950/40 overflow-hidden shadow-2xl bg-[#05070B] min-h-[560px] lg:min-h-[580px] flex flex-col justify-between">
        {/* Foto do Carro na garagem: Fundo de largura total centrado no carro */}
        <div
          className="absolute inset-0 bg-cover bg-center lg:bg-[center_top_35%] bg-no-repeat pointer-events-none scale-100 transition-transform duration-1000"
          style={{ backgroundImage: `url(${heroGarageBg})` }}
        />

        {/* Efeitos de Iluminação Ambiente Vermelha F1 e Reflexos de Asfalto Noturno */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-transparent to-[#05070B]/50 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070B]/85 via-black/20 to-[#05070B]/80 pointer-events-none" />
        {/* Glows vermelhos difusores nas laterais e no chão */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#E10600]/25 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#E10600]/25 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Conteúdo flutuante sobre a imagem do carro */}
        <div className="relative z-10 p-5 sm:p-7 flex flex-col justify-between h-full gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Card do GP: Estilo da referência com borda/glow vermelho e traçado do calendário */}
            <div className="lg:col-span-7 rounded-2xl bg-[#090D15]/80 backdrop-blur-md border border-[#E10600]/40 p-5 sm:p-6 shadow-[0_0_35px_rgba(225,6,0,0.18)] hover:border-[#E10600]/70 transition-all duration-300">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Lado Esquerdo do Card: Badges, Título e Circuito */}
                <div className="space-y-3 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-[#E10600] text-white hover:bg-[#FF2E25] font-mono text-xs font-black uppercase tracking-wider px-3 py-1 shadow-md shadow-[#E10600]/40 border-none">
                      RODADA {currentRoundNumber} DE {totalRounds}
                    </Badge>
                    <span className="text-xs font-mono text-[#E2E8F0] flex items-center gap-1.5 bg-[#0D121B]/90 px-2.5 py-1 rounded-md border border-[#1F2733]/90 backdrop-blur-sm">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                      Próximo Evento Oficial
                    </span>
                  </div>

                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-[38px] font-black text-white tracking-tight leading-tight drop-shadow-md">
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

                {/* Lado Direito do Card: Mini Traçado (Imagem do Calendário com pontos vermelhos ou blueprint) */}
                <div className="shrink-0 flex items-center justify-center w-36 h-28 sm:w-44 sm:h-32 rounded-xl bg-black/40 border border-white/10 p-2 relative overflow-hidden group">
                  {currentCircuitPhotoUrl ? (
                    <img
                      src={currentCircuitPhotoUrl}
                      alt={`Traçado ${currentGP.circuit}`}
                      className="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(255,255,255,0.45)] group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <svg
                      viewBox={currentTrack.viewBox}
                      className="w-full h-full drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                    >
                      <path
                        d={currentTrack.svgPath}
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="10"
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
                        r="4.5"
                        fill="#E10600"
                        className="animate-pulse"
                      />
                    </svg>
                  )}
                  {/* Ponto indicador neon vermelho */}
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E10600] animate-pulse shadow-[0_0_8px_#E10600]" />
                </div>
              </div>

              {/* Linha de Especificações Técnicas do GP */}
              <div className="grid grid-cols-[auto_auto_1fr] sm:grid-cols-[120px_100px_1fr] gap-4 sm:gap-6 pt-4 mt-4 text-xs font-mono border-t border-white/10">
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

              {/* Botões de Ação com o estilo exato da referência */}
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

            {/* Coluna Direita: Cards Translúcidos sobre a foto do carro (Estratégia + Telemetria) */}
            <div className="lg:col-span-5 flex flex-col gap-3.5">
              {/* Card Translúcido 1: Estratégia de Corrida (Soft / Medium / Hard com gráfico de degradação) */}
              <div className="rounded-xl bg-[#090D15]/80 border border-white/10 p-3.5 backdrop-blur-md font-mono text-xs shadow-xl">
                <div className="flex items-center justify-between text-[10px] text-cyan-400 uppercase font-bold tracking-wider pb-2 border-b border-white/10">
                  <span>ESTRATÉGIA DE CORRIDA</span>
                  <span className="text-[#8B95A7]">VOLTA 0 → {currentGP.laps}</span>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  {/* Legenda de Compostos */}
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#E10600] shadow-[0_0_6px_#E10600]" />
                      <span className="text-white font-semibold">Soft</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#F59E0B]" />
                      <span className="text-[#CBD5E1]">Medium</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                      <span className="text-[#8B95A7]">Hard</span>
                    </div>
                  </div>

                  {/* Gráfico Simplificado de Degradação (estilo curva da referência) */}
                  <div className="flex-1 max-w-[170px] h-14 relative flex items-end">
                    <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
                      {/* Grid sutil */}
                      <line
                        x1="0"
                        y1="10"
                        x2="100"
                        y2="10"
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1="0"
                        y1="25"
                        x2="100"
                        y2="25"
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="2 2"
                      />
                      <line x1="0" y1="38" x2="100" y2="38" stroke="rgba(255,255,255,0.15)" />
                      {/* Curva de degradação: Soft -> Medium -> Hard */}
                      <path
                        d="M 5,8 L 38,20 L 72,28 L 95,35"
                        fill="none"
                        stroke="#E10600"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      {/* Pontos nos stints */}
                      <circle cx="5" cy="8" r="3" fill="#E10600" />
                      <circle cx="38" cy="20" r="3" fill="#F59E0B" />
                      <circle cx="72" cy="28" r="3" fill="#CBD5E1" />
                      <circle cx="95" cy="35" r="3" fill="#FFFFFF" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Card Translúcido 2: Telemetria ao Vivo // Status do Carro */}
              <div className="rounded-xl bg-[#090D15]/80 border border-cyan-500/30 p-3.5 backdrop-blur-md space-y-2 font-mono text-xs shadow-xl">
                <div className="flex items-center justify-between text-[10px] text-cyan-400 uppercase font-bold tracking-widest pb-1 border-b border-white/10">
                  <span>TELEMETRIA AO VIVO // STATUS DO CARRO</span>
                  <span className="text-[#8B95A7]">{team?.engine_supplier || 'Audi'} PU</span>
                </div>

                {/* Barra 1: Pneus */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-[#8B95A7] w-28 uppercase">DESGASTE PNEUS</span>
                  <div className="flex-1 bg-black/50 h-2 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-500 rounded-full shadow-[0_0_8px_#22D3EE]"
                      style={{ width: `${tireWearPct}%` }}
                    />
                  </div>
                  <span className="text-white font-bold w-10 text-right">{tireWearPct}%</span>
                </div>

                {/* Barra 2: Combustível */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-[#8B95A7] w-28 uppercase">COMBUSTÍVEL</span>
                  <div className="flex-1 bg-black/50 h-2 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-500 rounded-full shadow-[0_0_8px_#22D3EE]"
                      style={{ width: `${fuelPct}%` }}
                    />
                  </div>
                  <span className="text-white font-bold w-10 text-right">{fuelPct}%</span>
                </div>

                {/* Barra 3: ERS */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-[#8B95A7] w-28 uppercase">
                    ERS (HÍBRIDO 50/50)
                  </span>
                  <div className="flex-1 bg-black/50 h-2 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-500 rounded-full shadow-[0_0_8px_#22D3EE]"
                      style={{ width: `${ersPct}%` }}
                    />
                  </div>
                  <span className="text-white font-bold w-10 text-right">{ersPct}%</span>
                </div>

                {/* Barra 4: Motor (Integridade restante da PU) */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-[#8B95A7] w-28 uppercase">
                    MOTOR (SAÚDE PU)
                  </span>
                  <div className="flex-1 bg-black/50 h-2 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-500 rounded-full shadow-[0_0_8px_#22D3EE]"
                      style={{ width: `${engineHealthPct}%` }}
                    />
                  </div>
                  <span className="text-white font-bold w-10 text-right">{engineHealthPct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. LINHA INFERIOR (2 COLUNAS: DUPLA DE PILOTOS & LINHA DO TEMPO) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Coluna A: Dupla de Pilotos Titulares (+ Reserva) */}
        <div className="rounded-2xl bg-[#0D121B]/95 border border-[#1F2733]/80 p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2733]/60">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#E10600]" />
                  Dupla de Pilotos Titulares
                </h2>
                <p className="text-xs text-[#8B95A7] font-mono mt-0.5">
                  Pilares da nossa temporada • {team?.name || 'Audi F1 Team'}
                </p>
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
                    const salaryFormatted = formatCurrency(driver.salary || 10000000)

                    return (
                      <div
                        key={driver.id}
                        className="p-3 rounded-xl bg-[#080C14] border border-[#1F2733] hover:border-[#E10600]/40 transition-all flex items-center justify-between gap-3"
                      >
                        {/* Avatar / Helmet */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1E293B] to-[#0A0E17] border border-[#334155] flex items-center justify-center font-black text-xs text-white shrink-0 relative overflow-hidden">
                            {/* Helmet icon styling */}
                            <CircleDot className="w-5 h-5 text-[#E10600]" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-base" title={driver.nationality}>
                                {flag}
                              </span>
                              <h3 className="font-bold text-sm text-white truncate">
                                {driver.name}
                              </h3>
                            </div>
                            <p className="text-xs font-mono text-[#8B95A7] mt-0.5 truncate">
                              {driver.age} anos <span className="text-[#334155]">|</span>{' '}
                              {salaryFormatted}
                            </p>
                          </div>
                        </div>

                        {/* Pontos */}
                        <div className="text-right font-mono shrink-0">
                          <span className="text-lg font-black text-white">{pts}</span>
                          <span className="text-xs text-[#8B95A7] ml-1">pts</span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Terceiro: Piloto Reserva (se existir) */}
                  {reserveDriver && (
                    <div className="p-3 rounded-xl bg-[#080C14]/70 border border-[#1F2733]/80 hover:border-cyan-500/30 transition-all flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1E293B] to-[#0A0E17] border border-[#334155] flex items-center justify-center font-mono font-bold text-xs text-amber-400 shrink-0">
                          FP
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base" title={reserveDriver.nationality}>
                              {getCountryFlag(reserveDriver.nationality)}
                            </span>
                            <h3 className="font-semibold text-sm text-[#E2E8F0] truncate">
                              {reserveDriver.name}
                            </h3>
                            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] px-1.5 py-0 font-mono">
                              Reserva
                            </Badge>
                          </div>
                          <p className="text-xs font-mono text-[#8B95A7] mt-0.5 truncate">
                            {reserveDriver.age} anos <span className="text-[#334155]">|</span>{' '}
                            {formatCurrency(reserveDriver.salary || 4000000)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <span className="text-base font-bold text-[#8B95A7]">
                          {driverPointsMap[reserveDriver.id] || 0}
                        </span>
                        <span className="text-xs text-[#8B95A7] ml-1">pts</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Rodapé do card: Moral da equipe */}
          <div className="mt-4 pt-3 border-t border-[#1F2733]/60 flex items-center justify-between text-xs font-mono">
            <span className="text-[#8B95A7] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Moral da Equipe:
            </span>
            <span className="font-bold text-white">{morale}%</span>
          </div>
        </div>

        {/* Coluna B: Linha do Tempo de Notícias */}
        <div className="rounded-2xl bg-[#0D121B]/95 border border-[#1F2733]/80 p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2733]/60">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-cyan-400" />
                  Linha do Tempo de Notícias
                </h2>
                <p className="text-xs text-[#8B95A7] font-mono mt-0.5">
                  Acontecimentos recentes e comunicados oficiais
                </p>
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
                  const isContract = ev.type === 'contrato'

                  return (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl bg-[#080C14] border border-[#1F2733] flex items-start gap-3 text-xs transition-all hover:border-[#1F2733]/90"
                    >
                      <div className="mt-0.5 shrink-0">
                        {isResult && (
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                            <Trophy className="w-4 h-4" />
                          </div>
                        )}
                        {isDev && (
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                            <Wrench className="w-4 h-4" />
                          </div>
                        )}
                        {isContract && (
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}
                        {!isResult && !isDev && !isContract && (
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                            <Info className="w-4 h-4" />
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

          <div className="mt-4 pt-3 border-t border-[#1F2733]/60 flex items-center justify-between text-xs font-mono text-[#8B95A7]">
            <span>Feed sincronizado com o Paddock</span>
            <span className="text-cyan-400 font-bold">● Ao vivo</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 6. FOOTER: NOME DA EQUIPE | GERENCIADOR DE F1 2026 */}
      {/* ============================================================== */}
      <footer className="pt-4 pb-2 border-t border-[#1F2733]/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono uppercase tracking-widest text-[#8B95A7]">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="font-extrabold text-white">{team?.name || 'AUDI F1 TEAM'}</span>
          <span className="text-[#334155]">|</span>
          <span>GERENCIADOR DE F1 2026</span>
        </div>

        <div className="flex items-center gap-3 text-center sm:text-right text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E10600]" />
          <span>MAIS QUE UMA EQUIPE. UMA ESTRATÉGIA.</span>
        </div>
      </footer>
    </div>
  )
}
