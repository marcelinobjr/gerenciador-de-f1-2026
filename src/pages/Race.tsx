import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import {
  DriverModel,
  PartModel,
  SponsorModel,
  SessionSetupModel,
  TireCompound,
  TireAllotment,
  WeatherForecast,
} from '@/types/f1'
import { F1_2026_CALENDAR, getAICompetitors, ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import {
  Gauge,
  Play,
  CloudRain,
  Sun,
  Zap,
  Flag,
  Award,
  AlertCircle,
  TrendingUp,
  Layers,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Trophy,
  Sliders,
  Disc,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Flame,
  Activity,
  HeartPulse,
  Wrench,
  Radio,
  AlertTriangle,
  ArrowDownCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export type WeekendSession = 'tp1' | 'tp2' | 'q1' | 'q2' | 'q3' | 'race'

interface SimDriverEntry {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  teamColor: string
  isPlayer: boolean
  flag: string
  score: number
  position: number
  points: number
  fastestLap: boolean
  usedOvertake: boolean
  dnf: boolean
  dnfReason?: string
  totalTime: string
  tireCompound?: TireCompound
  secondCompound?: TireCompound
  pitLap?: number
  tireWear?: number // 0-100%
  driverFatigue?: number // 0-100%
  morale?: number
  physicalCondition?: number
  pitStopsDone?: number
  hasWingDamage?: boolean
}

export interface LiveRaceEvent {
  id: string
  lap: number
  type:
    | 'overtake'
    | 'fastest_lap'
    | 'tire_warning'
    | 'incident'
    | 'safety_car'
    | 'weather'
    | 'pit_stop'
    | 'info'
  message: string
  driverName?: string
  teamColor?: string
  isPlayer?: boolean
  timestamp: string
}

interface SessionTimeResult {
  position: number
  driverId: string
  driverName: string
  teamName: string
  teamColor: string
  lapTime: string
  gap: string
  tire: TireCompound
  isPlayer: boolean
  isEliminated?: boolean
  eliminatedInSession?: 'q1' | 'q2'
}

// Initial tire allotment per weekend per driver
const INITIAL_ALLOTMENT: TireAllotment = {
  duro: 2,
  medio: 3,
  macio: 3,
  intermediario: 4,
  chuva_extrema: 3,
}

export default function RacePage() {
  const { team, season, refreshTeamAndSeason } = useAuth()
  const navigate = useNavigate()

  const [drivers, setDrivers] = useState<DriverModel[]>([])
  const [parts, setParts] = useState<PartModel[]>([])
  const [sponsors, setSponsors] = useState<SponsorModel[]>([])
  const [loading, setLoading] = useState(true)

  // Current session step in GP weekend
  const [activeSession, setActiveSession] = useState<WeekendSession>('tp1')
  const [completedSessions, setCompletedSessions] = useState<WeekendSession[]>([])

  // Setup per session
  const [setups, setSetups] = useState<Record<WeekendSession, SessionSetupModel>>({
    tp1: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'tp1',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'medio',
    },
    tp2: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'tp2',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'macio',
    },
    q1: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'q1',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'macio',
    },
    q2: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'q2',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'macio',
    },
    q3: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'q3',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'macio',
    },
    race: {
      team_id: '',
      season_id: '',
      round: 1,
      session: 'race',
      wing_level: 6,
      suspension_stiffness: 6,
      pu_electric_ratio: 50,
      tire_compound: 'medio',
      target_pit_lap: 25,
      second_tire_compound: 'duro',
    },
  })

  // Tire inventory for the GP weekend
  const [tireStock, setTireStock] = useState<TireAllotment>({ ...INITIAL_ALLOTMENT })

  // Session results records
  const [sessionResults, setSessionResults] = useState<Record<string, SessionTimeResult[]>>({})

  // Simulation animation states
  const [isSimulatingSession, setIsSimulatingSession] = useState(false)
  const [simText, setSimText] = useState('')
  const [simProgress, setSimProgress] = useState(0)

  // Race final results
  const [raceResults, setRaceResults] = useState<SimDriverEntry[] | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const [seasonCompleted, setSeasonCompleted] = useState(false)

  // Incidents log during race
  const [raceIncidents, setRaceIncidents] = useState<string[]>([])
  const [safetyCarActive, setSafetyCarActive] = useState(false)

  // Live race feed & simulation settings
  const [liveEvents, setLiveEvents] = useState<LiveRaceEvent[]>([])
  const [simSpeed, setSimSpeed] = useState<number>(1) // 1x, 2x, 4x, or instant
  const [autoSimulateWithoutPause, setAutoSimulateWithoutPause] = useState<boolean>(false)

  // Modals for tactical decisions during race
  // 1. Broken wing / Touch damage decision modal
  const [wingDamageModalOpen, setWingDamageModalOpen] = useState(false)
  const [wingDamageDriver, setWingDamageDriver] = useState<SimDriverEntry | null>(null)
  const [wingDamageTireChoice, setWingDamageTireChoice] = useState<TireCompound>('duro')

  // 2. Safety car decision modal
  const [safetyCarModalOpen, setSafetyCarModalOpen] = useState(false)
  const [safetyCarReason, setSafetyCarReason] = useState<string>('')
  const [safetyCarTireChoice, setSafetyCarTireChoice] = useState<TireCompound>('medio')

  // Weather and forecast state
  const [weather, setWeather] = useState<'seco' | 'chuva'>('seco')
  const [forecast, setForecast] = useState<WeatherForecast>({
    probability: 20,
    expectedCondition: 'Parcialmente Nublado',
    airTemp: 24,
    trackTemp: 35,
  })

  // Dynamic live race state (for tire wear, weather shifts & tactical decision modals)
  const [liveRaceState, setLiveRaceState] = useState<{
    inProgress: boolean
    currentLap: number
    totalLaps: number
    weather: 'seco' | 'chuva'
    grid: SimDriverEntry[]
    safetyCarLapRemaining?: number
  } | null>(null)

  // Rain Decision Modal state
  const [rainDecisionOpen, setRainDecisionOpen] = useState(false)
  const [rainDecisionWaitLaps, setRainDecisionWaitLaps] = useState(2)

  const currentRound = season?.current_round || 1
  const totalRounds = season?.total_rounds || 24
  const gpInfo = F1_2026_CALENDAR[Math.min(currentRound - 1, F1_2026_CALENDAR.length - 1)]

  // Initial load & Weather Forecast calculation
  useEffect(() => {
    // Determine forecast probability based on circuit history & random factor
    const wetCircuits = [
      'Spa-Francorchamps',
      'Silverstone',
      'Interlagos',
      'Suzuka',
      'Montreal',
      'Zandvoort',
    ]
    const isWetTrack = wetCircuits.some((c) => gpInfo.circuit.includes(c))
    const baseProb = isWetTrack ? 45 : 20
    const prob = Math.min(95, Math.max(5, Math.round(baseProb + (Math.random() - 0.5) * 35)))

    let cond: WeatherForecast['expectedCondition'] = 'Ensolarado'
    if (prob > 70) cond = 'Tempestade'
    else if (prob > 50) cond = 'Chuva Iminente'
    else if (prob > 30) cond = 'Nublado com risco de chuva'
    else if (prob > 15) cond = 'Parcialmente Nublado'

    const airT = Math.round(20 + Math.random() * 12)
    const trackT = airT + Math.round(8 + Math.random() * 12)
    const rainLap = prob >= 35 ? Math.round(gpInfo.laps * (0.2 + Math.random() * 0.5)) : undefined

    setForecast({
      probability: prob,
      expectedCondition: cond,
      airTemp: airT,
      trackTemp: trackT,
      rainLapStart: rainLap,
    })

    // Start weather condition: if prob > 65%, starts raining already, else dry
    const startRain = prob >= 65
    setWeather(startRain ? 'chuva' : 'seco')

    if (currentRound > totalRounds) {
      setSeasonCompleted(true)
    }
  }, [currentRound, totalRounds, gpInfo.circuit, gpInfo.laps])

  const loadData = async () => {
    if (!team || !season) {
      setLoading(false)
      return
    }
    try {
      const [dList, pList, spList, savedSetups] = await Promise.all([
        f1Service.getTeamDrivers(team.id),
        f1Service.getTeamParts(team.id),
        f1Service.getTeamSponsors(team.id),
        f1Service.getSessionSetups(team.id, season.id, currentRound),
      ])
      setDrivers(dList)
      setParts(pList)
      setSponsors(spList)

      // Merge saved setups if any
      if (savedSetups.length > 0) {
        setSetups((prev) => {
          const next = { ...prev }
          savedSetups.forEach((s) => {
            if (s.session && next[s.session]) {
              next[s.session] = { ...next[s.session], ...s }
            }
          })
          return next
        })
      } else {
        // Defaults calibrated to track characteristics
        const idealWing = gpInfo.downforceIdeal || 6
        const idealSuspension = gpInfo.suspensionIdeal || 6
        setSetups((prev) => {
          const next = { ...prev }
          Object.keys(next).forEach((k) => {
            const key = k as WeekendSession
            next[key] = {
              ...next[key],
              wing_level: idealWing,
              suspension_stiffness: idealSuspension,
              target_pit_lap: Math.round(gpInfo.laps * 0.42),
            }
          })
          return next
        })
      }
    } catch (err) {
      console.error('Error loading race weekend data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [team?.id, season?.id, currentRound])

  useRealtime('drivers', () => {
    loadData()
  })

  // Engine Spec
  const currentEngine = useMemo(() => {
    const sName = team?.engine_supplier || 'Mercedes'
    return ENGINE_SUPPLIERS.find((s) => s.name === sName) || ENGINE_SUPPLIERS[1]
  }, [team?.engine_supplier])

  // Player Car Overall Level & Condition Penalty
  const { playerCarLevel, avgPartCondition } = useMemo(() => {
    if (parts.length === 0) return { playerCarLevel: 75, avgPartCondition: 100 }
    const sum = parts.reduce((acc, p) => acc + p.level, 0)
    const sumCond = parts.reduce((acc, p) => acc + (p.condition ?? 100), 0)
    const avg = (sum / parts.length) * 10
    const avgCond = Math.round(sumCond / parts.length)

    let base = Math.round(avg * 0.6 + currentEngine.power * 0.4)
    // If average condition < 60%, apply real-time pace penalty
    if (avgCond < 60) {
      const pacePenalty = Math.round((60 - avgCond) * 0.25)
      base = Math.max(20, base - pacePenalty)
    }

    const finalScore = team?.reserve_setup_bonus ? Math.min(100, base + 2) : base
    return { playerCarLevel: finalScore, avgPartCondition: avgCond }
  }, [parts, currentEngine, team?.reserve_setup_bonus])

  // Aerodynamic parts rating
  const aeroPart = parts.find((p) => p.name.includes('Aerodinâmica') || p.name.includes('Asa'))
  const aeroRating = aeroPart
    ? aeroPart.level >= 8
      ? 'Excelente'
      : aeroPart.level >= 5
        ? 'Bom'
        : 'Em desenvolvimento'
    : 'Bom'

  // Update setup slider / compound for current session
  const updateCurrentSetup = (field: keyof SessionSetupModel, value: any) => {
    setSetups((prev) => ({
      ...prev,
      [activeSession]: {
        ...prev[activeSession],
        team_id: team?.id || '',
        season_id: season?.id || '',
        round: currentRound,
        session: activeSession,
        [field]: value,
      },
    }))
  }

  // Handle saving setup to PocketBase
  const handleSaveSetup = async () => {
    if (!team || !season) return
    const setupData = setups[activeSession]
    try {
      await f1Service.saveSessionSetup({
        ...setupData,
        team_id: team.id,
        season_id: season.id,
        round: currentRound,
        session: activeSession,
      })
      toast({
        title: `Setup de ${activeSession.toUpperCase()} Salvo`,
        description: 'As configurações de aerodinâmica, rigidez e trem de força foram registradas.',
      })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar setup',
        description: 'Não foi possível persistir a configuração da sessão.',
      })
    }
  }

  // Calculate setup penalty for a session (deviations from track ideal)
  const calculateSetupDelta = (sessionKey: WeekendSession) => {
    const current = setups[sessionKey]
    const idealWing = gpInfo.downforceIdeal || 6
    const idealSuspension = gpInfo.suspensionIdeal || 6

    const wingDiff = Math.abs(current.wing_level - idealWing)
    const suspDiff = Math.abs(current.suspension_stiffness - idealSuspension)
    // 50/50 balance deviation from 50
    const puDiff = Math.abs(current.pu_electric_ratio - 50) / 10

    // Total penalty: 0 to 6 seconds per lap score
    const penalty = wingDiff * 0.8 + suspDiff * 0.6 + puDiff * 0.4
    return penalty
  }

  // Helper for tire compound name in PT-BR
  const formatTireName = (c?: TireCompound) => {
    switch (c) {
      case 'duro':
        return 'Duro (Branco - C1/C2)'
      case 'medio':
        return 'Médio (Amarelo - C3)'
      case 'macio':
        return 'Macio (Vermelho - C4/C5)'
      case 'intermediario':
        return 'Intermediário (Verde)'
      case 'chuva_extrema':
        return 'Chuva Extrema (Azul)'
      default:
        return 'Médio (Amarelo)'
    }
  }

  // Run Free Practice (TP1 / TP2) or Qualifying (Q1 / Q2 / Q3)
  const handleRunSession = (sessionToRun: WeekendSession) => {
    const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team?.id)
    const reserve = drivers.find(
      (d) => d.role === 'reserva' || (d.reserve_team_id === team?.id && d.team_id !== team?.id),
    )

    if (titulars.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Escalação Incompleta',
        description: 'Você precisa de 2 pilotos titulares contratados para participar das sessões.',
      })
      navigate('/team')
      return
    }

    // Decrement tire compound chosen from stock
    const chosenTire = setups[sessionToRun].tire_compound || 'macio'
    if (tireStock[chosenTire] <= 0) {
      toast({
        variant: 'destructive',
        title: 'Estoque de Pneus Esgotado!',
        description: `Você não possui mais jogos do pneu ${formatTireName(chosenTire)}. Selecione outro composto disponível.`,
      })
      return
    }

    // Pre-requisites for Q2 and Q3
    if (sessionToRun === 'q2' && !sessionResults.q1) {
      toast({
        variant: 'destructive',
        title: 'Q1 Obrigatório!',
        description: 'Você precisa disputar o Q1 antes de avançar para o Q2.',
      })
      return
    }
    if (sessionToRun === 'q3' && !sessionResults.q2) {
      toast({
        variant: 'destructive',
        title: 'Q2 Obrigatório!',
        description: 'Você precisa disputar o Q2 antes de disputar o Q3 (Pole Shootout).',
      })
      return
    }

    // Consume 1 tire set
    setTireStock((prev) => ({
      ...prev,
      [chosenTire]: Math.max(0, prev[chosenTire] - 1),
    }))

    setIsSimulatingSession(true)
    setSimProgress(0)

    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiRivals = getAICompetitors(team?.team_key, isCustomTeam)
    const playerTeamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)
    const penalty = calculateSetupDelta(sessionToRun)

    // Simulation steps text
    const sessionNames: Record<WeekendSession, string> = {
      tp1: 'Treino Livre 1 (TP1) — Todos os 24 carros na pista para acerto e telemetria',
      tp2: 'Treino Livre 2 (TP2) — Simulação de voltas rápidas e ritmo de corrida dos 24 pilotos',
      q1: 'Classificação Q1 — 24 pilotos na pista! Apenas os 16 primeiros passam para o Q2 (8 eliminados)',
      q2: 'Classificação Q2 — 16 pilotos na pista! Apenas os 10 primeiros passam para o Q3 (6 eliminados)',
      q3: 'Classificação Q3 — Os 10 melhores pilotos aceleram pelo Grid e pela Pole Position!',
      race: 'Grande Prêmio 2026',
    }

    setSimText(`Iniciando ${sessionNames[sessionToRun]}...`)

    let step = 0
    const interval = setInterval(() => {
      step += 25
      setSimProgress(step)
      if (step === 50) {
        setSimText(
          `Telemetria de pista: Asa ativa nível ${setups[sessionToRun].wing_level}, MGU-K ${setups[sessionToRun].pu_electric_ratio}% elétrico...`,
        )
      } else if (step === 75) {
        setSimText(`Todos os 24 pilotos completando voltas rápidas no ${gpInfo.circuit}!`)
      } else if (step >= 100) {
        clearInterval(interval)
        setIsSimulatingSession(false)

        // Build session grid of 24 drivers
        interface RawGridEntry {
          driverId: string
          name: string
          team: string
          color: string
          lapScore: number
          isPlayer: boolean
          tire: TireCompound
          morale: number
          fitness: number
        }

        const fullGrid: RawGridEntry[] = []

        // 1. Player drivers (2 drivers)
        titulars.forEach((d) => {
          const moraleFactor = ((d.morale ?? 80) - 75) * 0.15
          const fitnessFactor = ((d.physical_condition ?? 90) - 80) * 0.12
          let skill =
            d.speed * 0.45 + d.consistency * 0.35 + d.defense * 0.2 + moraleFactor + fitnessFactor
          if (weather === 'chuva') {
            skill = d.speed * 0.3 + d.rain * 0.5 + d.consistency * 0.2 + moraleFactor
          }
          const carScore = playerCarLevel * 0.65 + playerTeamStrength * 0.35 - penalty
          const luck = (Math.random() - 0.5) * 6
          fullGrid.push({
            driverId: d.id,
            name: d.name,
            team: team?.name || 'Sua Escuderia',
            color: team?.color || '#FF3B30',
            lapScore: skill * 0.45 + carScore * 0.55 + luck,
            isPlayer: true,
            tire: chosenTire,
            morale: d.morale ?? 80,
            fitness: d.physical_condition ?? 90,
          })
        })

        // 2. AI drivers (11 rival teams * 2 = 22 drivers -> Total 24 drivers)
        aiRivals.forEach((ai) => {
          const aiCar = ai.carLevel * 0.65 + ai.strength * 0.35
          let d1Skill =
            ai.driver1.speed * 0.45 + ai.driver1.consistency * 0.35 + ai.driver1.defense * 0.2
          let d2Skill =
            ai.driver2.speed * 0.45 + ai.driver2.consistency * 0.35 + ai.driver2.defense * 0.2
          if (weather === 'chuva') {
            d1Skill = ai.driver1.speed * 0.3 + ai.driver1.rain * 0.5 + ai.driver1.consistency * 0.2
            d2Skill = ai.driver2.speed * 0.3 + ai.driver2.rain * 0.5 + ai.driver2.consistency * 0.2
          }

          fullGrid.push({
            driverId: `${ai.id}_d1`,
            name: ai.driver1.name,
            team: ai.name,
            color: ai.color,
            lapScore: d1Skill * 0.45 + aiCar * 0.55 + (Math.random() - 0.5) * 6,
            isPlayer: false,
            tire: weather === 'chuva' ? 'intermediario' : 'macio',
            morale: 80,
            fitness: 90,
          })
          fullGrid.push({
            driverId: `${ai.id}_d2`,
            name: ai.driver2.name,
            team: ai.name,
            color: ai.color,
            lapScore: d2Skill * 0.45 + aiCar * 0.55 + (Math.random() - 0.5) * 6,
            isPlayer: false,
            tire: weather === 'chuva' ? 'intermediario' : 'macio',
            morale: 80,
            fitness: 90,
          })
        })

        // Handle specific Qualifying elimination rules
        // In Q1: All 24 compete -> top 16 advance to Q2, 8 eliminated (P17-P24)
        // In Q2: Top 16 from Q1 compete -> top 10 advance to Q3, 6 eliminated (P11-P16)
        // In Q3: Top 10 from Q2 compete -> P1 to P10 grid
        let activeParticipants: RawGridEntry[] = fullGrid
        let eliminatedFromEarlier: SessionTimeResult[] = []

        if (sessionToRun === 'q2' && sessionResults.q1) {
          const q1Top16DriverIds = new Set(sessionResults.q1.slice(0, 16).map((r) => r.driverId))
          activeParticipants = fullGrid.filter((g) => q1Top16DriverIds.has(g.driverId))
          // Keep eliminated from Q1 (positions 17 to 24)
          eliminatedFromEarlier = sessionResults.q1.slice(16, 24).map((r) => ({
            ...r,
            isEliminated: true,
            eliminatedInSession: 'q1',
          }))
        } else if (sessionToRun === 'q3' && sessionResults.q2) {
          const q2Top10DriverIds = new Set(sessionResults.q2.slice(0, 10).map((r) => r.driverId))
          activeParticipants = fullGrid.filter((g) => q2Top10DriverIds.has(g.driverId))
          // Keep eliminated from Q2 (positions 11 to 16) and Q1 (17 to 24)
          const eliminatedQ2: SessionTimeResult[] = sessionResults.q2.slice(10, 16).map((r) => ({
            ...r,
            isEliminated: true,
            eliminatedInSession: 'q2' as const,
          }))
          const eliminatedQ1: SessionTimeResult[] = sessionResults.q2.slice(16, 24).map((r) => ({
            ...r,
            isEliminated: true,
            eliminatedInSession: 'q1' as const,
          }))
          eliminatedFromEarlier = [...eliminatedQ2, ...eliminatedQ1]
        }

        // Sort descending lapScore for active drivers
        activeParticipants.sort((a, b) => b.lapScore - a.lapScore)

        // Generate realistic lap times (e.g. 1:12.345 or 1:18.420)
        const baseMin = 1
        const baseSec = 14 + Math.random() * 3
        const bestScore = activeParticipants[0].lapScore

        const activeFormatted: SessionTimeResult[] = activeParticipants.map((entry, idx) => {
          const gapSec = (bestScore - entry.lapScore) * 0.045
          const entrySec = baseSec + gapSec
          const minPart = baseMin + Math.floor(entrySec / 60)
          const secPart = (entrySec % 60).toFixed(3)
          const lapTime = `${minPart}:${secPart.padStart(6, '0')}`

          // Flag elimination in Q1 (P17-24) or Q2 (P11-16)
          const isEliminated =
            (sessionToRun === 'q1' && idx >= 16) || (sessionToRun === 'q2' && idx >= 10)
          const eliminatedInSession =
            sessionToRun === 'q1' && idx >= 16
              ? 'q1'
              : sessionToRun === 'q2' && idx >= 10
                ? 'q2'
                : undefined

          return {
            position: idx + 1,
            driverId: entry.driverId,
            driverName: entry.name,
            teamName: entry.team,
            teamColor: entry.color,
            lapTime,
            gap: idx === 0 ? 'LÍDER' : `+${gapSec.toFixed(3)}s`,
            tire: entry.tire,
            isPlayer: entry.isPlayer,
            isEliminated,
            eliminatedInSession,
          }
        })

        // Combine active and previously eliminated (totaling 24 drivers in Q1, Q2, Q3)
        const finalResults: SessionTimeResult[] = [
          ...activeFormatted,
          ...eliminatedFromEarlier,
        ].map((item, index) => ({
          ...item,
          position: index + 1,
        }))

        setSessionResults((prev) => ({
          ...prev,
          [sessionToRun]: finalResults,
        }))

        // Mark session completed
        setCompletedSessions((prev) => [...new Set<WeekendSession>([...prev, sessionToRun])])

        // Advance tab to next session automatically
        const sessionSequence: WeekendSession[] = ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race']
        const currentIdx = sessionSequence.indexOf(sessionToRun)
        if (currentIdx >= 0 && currentIdx < sessionSequence.length - 1) {
          setActiveSession(sessionSequence[currentIdx + 1])
        }

        const playerPos = finalResults
          .filter((r) => r.isPlayer)
          .map((r) => `P${r.position}`)
          .join(' e ')
        toast({
          title: `${sessionToRun.toUpperCase()} Finalizado!`,
          description: `Classificação dos 24 pilotos registrada! Seus pilotos: ${playerPos}.`,
        })
      }
    }, 450)
  }

  // Calculate tire life in laps based on track abrasiveness
  const calculateCompoundLaps = (compound: TireCompound) => {
    const abrasiveness = gpInfo.tireAbrasiveness || 6
    // Higher abrasiveness reduces life
    const wearMultiplier = 1 + (abrasiveness - 5) * 0.08
    let baseLaps = 30
    switch (compound) {
      case 'duro':
        baseLaps = 42
        break
      case 'medio':
        baseLaps = 30
        break
      case 'macio':
        baseLaps = 18
        break
      case 'intermediario':
        baseLaps = 26
        break
      case 'chuva_extrema':
        baseLaps = 22
        break
    }
    return Math.max(8, Math.round(baseLaps / wearMultiplier))
  }

  // START MAIN RACE SIMULATION WITH DYNAMIC WEAR AND RAIN DECISION
  const handleStartRace = () => {
    const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team?.id)
    const reserve = drivers.find(
      (d) => d.role === 'reserva' || (d.reserve_team_id === team?.id && d.team_id !== team?.id),
    )

    if (titulars.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Escalação Incompleta',
        description: 'Você precisa de 2 pilotos titulares contratados para largar.',
      })
      navigate('/team')
      return
    }

    // Regulation check: 2 different compounds mandatory in dry race!
    const raceSetup = setups.race
    const startCompound = raceSetup.tire_compound || 'medio'
    const pitCompound = raceSetup.second_tire_compound || 'duro'

    if (weather === 'seco' && startCompound === pitCompound) {
      toast({
        variant: 'destructive',
        title: 'Regulamento FIA 2026 Violado!',
        description:
          'É OBRIGATÓRIO usar pelo menos dois compostos diferentes durante a corrida em pista seca (ex: Médio + Duro).',
      })
      return
    }

    // Check tire availability
    if (tireStock[startCompound] <= 0 || tireStock[pitCompound] <= 0) {
      toast({
        variant: 'destructive',
        title: 'Estoque Insuficiente de Pneus',
        description: 'Você não possui jogos suficientes dos compostos selecionados para a corrida.',
      })
      return
    }

    // Deduct initial starting tires
    setTireStock((prev) => ({
      ...prev,
      [startCompound]: Math.max(0, prev[startCompound] - 1),
    }))

    setIsSimulatingSession(true)
    setSimProgress(0)
    setRaceIncidents([])
    setSafetyCarActive(false)

    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiRivals = getAICompetitors(team?.team_key, isCustomTeam)
    const playerTeamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)
    const setupPenalty = calculateSetupDelta('race')
    const abrasiveness = gpInfo.tireAbrasiveness || 6

    // Construct 24 drivers starting grid
    const initialGrid: SimDriverEntry[] = []

    // 1. Player drivers
    titulars.forEach((d) => {
      const isIncapacitated = !!d.is_incapacitated
      const activeDriver = isIncapacitated && reserve ? reserve : d
      const isSubstituted = isIncapacitated && !!reserve

      const driverFatigue = Math.min(
        100,
        (d.age > 35 ? 35 : 20) +
          (sessionResults.tp1 ? 8 : 0) +
          (sessionResults.tp2 ? 8 : 0) +
          (sessionResults.q3 ? 12 : 0),
      )

      initialGrid.push({
        driverId: activeDriver.id,
        driverName: isSubstituted ? `${activeDriver.name} (Substituto)` : activeDriver.name,
        teamId: team?.id || 'player',
        teamName: team?.name || 'Sua Escuderia',
        teamColor: team?.color || '#FF3B30',
        isPlayer: true,
        flag: activeDriver.nationality === 'Brasil' ? '🇧🇷' : '🏁',
        score: 0,
        position: 0,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: false,
        totalTime: '',
        tireCompound: startCompound,
        secondCompound: pitCompound,
        pitLap: raceSetup.target_pit_lap || Math.round(gpInfo.laps * 0.42),
        tireWear: 5, // initial fresh wear
        driverFatigue,
        morale: activeDriver.morale ?? 80,
        physicalCondition: activeDriver.physical_condition ?? 90,
        pitStopsDone: 0,
      })
    })

    // 2. AI rivals (22 drivers)
    aiRivals.forEach((aiTeam) => {
      initialGrid.push({
        driverId: `${aiTeam.id}_d1`,
        driverName: aiTeam.driver1.name,
        teamId: aiTeam.id,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        isPlayer: false,
        flag: aiTeam.driver1.flag,
        score: 0,
        position: 0,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: false,
        totalTime: '',
        tireCompound: weather === 'chuva' ? 'intermediario' : 'medio',
        secondCompound: weather === 'chuva' ? 'chuva_extrema' : 'duro',
        pitLap: Math.round(gpInfo.laps * 0.45),
        tireWear: 5,
        driverFatigue: 25,
        morale: 80,
        physicalCondition: 90,
        pitStopsDone: 0,
      })
      initialGrid.push({
        driverId: `${aiTeam.id}_d2`,
        driverName: aiTeam.driver2.name,
        teamId: aiTeam.id,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        isPlayer: false,
        flag: aiTeam.driver2.flag,
        score: 0,
        position: 0,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: false,
        totalTime: '',
        tireCompound: weather === 'chuva' ? 'intermediario' : 'macio',
        secondCompound: weather === 'chuva' ? 'chuva_extrema' : 'medio',
        pitLap: Math.round(gpInfo.laps * 0.4),
        tireWear: 5,
        driverFatigue: 28,
        morale: 80,
        physicalCondition: 90,
        pitStopsDone: 0,
      })
    })

    // Initial live race event
    const startEvent: LiveRaceEvent = {
      id: `ev_start_${Date.now()}`,
      lap: 1,
      type: 'info',
      message: `🟢 LUZES APAGADAS! Largada autorizada para o ${gpInfo.name} com 24 monopostos na pista!`,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }

    setLiveEvents([startEvent])

    // Save live race state and begin simulation loop
    setLiveRaceState({
      inProgress: true,
      currentLap: 1,
      totalLaps: gpInfo.laps,
      weather,
      grid: initialGrid,
    })

    // Ensure race session tab is actively viewed
    setActiveSession('race')

    // Start live narrated simulation loop
    runLiveRaceLoop(initialGrid, 1, weather)
  }

  // HELPER: Generate periodic narrated race events as laps progress
  const generateLapNarratedEvents = (
    currentLap: number,
    grid: SimDriverEntry[],
    currentWeather: 'seco' | 'chuva',
  ): LiveRaceEvent[] => {
    const events: LiveRaceEvent[] = []
    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const playerDrivers = grid.filter((g) => g.isPlayer && !g.dnf)

    // 1. Critical tire wear warning for player
    playerDrivers.forEach((pd) => {
      if ((pd.tireWear || 0) >= 75 && (pd.tireWear || 0) < 82 && Math.random() < 0.4) {
        events.push({
          id: `ev_tire_${currentLap}_${pd.driverId}`,
          lap: currentLap,
          type: 'tire_warning',
          message: `⚠️ RÁDIO DA EQUIPE: "${pd.driverName}, seus pneus ${formatTireName(pd.tireCompound)} atingiram ${pd.tireWear}% de desgaste! Perda iminente de aderência."`,
          driverName: pd.driverName,
          teamColor: pd.teamColor,
          isPlayer: true,
          timestamp: nowStr,
        })
      } else if ((pd.tireWear || 0) >= 88 && Math.random() < 0.5) {
        events.push({
          id: `ev_crit_tire_${currentLap}_${pd.driverId}`,
          lap: currentLap,
          type: 'tire_warning',
          message: `🚨 PNEU EM FIM DE VIDA! ${pd.driverName} relata forte granulação e risco de delaminação (${pd.tireWear}% desgaste).`,
          driverName: pd.driverName,
          teamColor: pd.teamColor,
          isPlayer: true,
          timestamp: nowStr,
        })
      }
    })

    // 2. Overtakes involving the player or Top 5
    if (Math.random() < 0.35 && playerDrivers.length > 0) {
      const p = playerDrivers[Math.floor(Math.random() * playerDrivers.length)]
      const isOvertaking = Math.random() > 0.45
      if (isOvertaking) {
        events.push({
          id: `ev_overtake_${currentLap}_${p.driverId}`,
          lap: currentLap,
          type: 'overtake',
          message: `⚡ ULTRAPASSAGEM! ${p.driverName} aciona o modo de ataque elétrico 350kW na reta e ganha posição com bela manobra!`,
          driverName: p.driverName,
          teamColor: p.teamColor,
          isPlayer: true,
          timestamp: nowStr,
        })
      } else {
        events.push({
          id: `ev_def_${currentLap}_${p.driverId}`,
          lap: currentLap,
          type: 'overtake',
          message: `🛡️ DEFESA DE POSIÇÃO: ${p.driverName} fecha a porta na frenagem e segura o ataque do adversário!`,
          driverName: p.driverName,
          teamColor: p.teamColor,
          isPlayer: true,
          timestamp: nowStr,
        })
      }
    }

    // 3. Fastest lap shoutout
    if (currentLap > 3 && Math.random() < 0.2) {
      const candidates = grid.filter((g) => !g.dnf)
      const fastDriver = candidates[Math.floor(Math.random() * candidates.length)]
      if (fastDriver) {
        events.push({
          id: `ev_fl_${currentLap}_${fastDriver.driverId}`,
          lap: currentLap,
          type: 'fastest_lap',
          message: `🟣 VOLTA MAIS RÁPIDA! ${fastDriver.driverName} (${fastDriver.teamName}) crava o melhor tempo da prova com 1:${Math.floor(18 + Math.random() * 8)}.${Math.floor(100 + Math.random() * 899)}.`,
          driverName: fastDriver.driverName,
          teamColor: fastDriver.teamColor,
          isPlayer: fastDriver.isPlayer,
          timestamp: nowStr,
        })
      }
    }

    // 4. Rival AI pit stops
    const aiInPits = grid.filter((g) => !g.isPlayer && !g.dnf && g.pitLap === currentLap)
    aiInPits.forEach((ai) => {
      events.push({
        id: `ev_pit_${currentLap}_${ai.driverId}`,
        lap: currentLap,
        type: 'pit_stop',
        message: `🔧 BOX, BOX! ${ai.driverName} (${ai.teamName}) nos boxes para troca de pneus (${formatTireName(ai.secondCompound)}). Parada realizada em ${(2.1 + Math.random() * 0.8).toFixed(2)}s.`,
        driverName: ai.driverName,
        teamColor: ai.teamColor,
        isPlayer: false,
        timestamp: nowStr,
      })
    })

    return events
  }

  // LIVE RACE NARRATED LOOP RUNNER
  const runLiveRaceLoop = (
    initialGrid: SimDriverEntry[],
    startLap: number,
    initialWeather: 'seco' | 'chuva',
  ) => {
    let currentGrid = [...initialGrid]
    let currentLap = startLap
    let currentWeather = initialWeather
    const totalLaps = gpInfo.laps
    const abrasiveness = gpInfo.tireAbrasiveness || 6

    // Pre-calculate possible dynamic milestone laps (if not already triggered)
    const rainLap =
      initialWeather === 'seco' && forecast.probability >= 35
        ? forecast.rainLapStart || Math.round(totalLaps * 0.42)
        : null

    // Safety car trigger lap (chance ~45% in full GP)
    const safetyCarLap =
      Math.random() < 0.45 ? Math.round(totalLaps * (0.28 + Math.random() * 0.4)) : null

    // Wing damage touch trigger lap (chance ~40% for player in GP)
    const wingDamageLap =
      Math.random() < 0.4 ? Math.round(totalLaps * (0.22 + Math.random() * 0.45)) : null

    const stepIntervalMs = autoSimulateWithoutPause ? 80 : Math.max(150, Math.round(650 / simSpeed))

    const timer = setInterval(() => {
      currentLap += 1
      const pct = Math.min(99, Math.round((currentLap / totalLaps) * 100))
      setSimProgress(pct)
      setSimText(
        `Volta ${currentLap} de ${totalLaps} • ${gpInfo.circuit} • Velocidade ${simSpeed}x`,
      )

      // Accumulate wear and fatigue for all active cars
      currentGrid = currentGrid.map((entry) => {
        if (entry.dnf) return entry
        const compoundWearRate =
          entry.tireCompound === 'macio'
            ? 3.2
            : entry.tireCompound === 'medio'
              ? 2.2
              : entry.tireCompound === 'duro'
                ? 1.5
                : 2.4
        const inc = (compoundWearRate * (abrasiveness / 5)) / 1.5
        const currentWear = Math.min(100, Math.round((entry.tireWear || 5) + inc))

        // AI regular pit stop execution when pitLap reached
        let nextCompound = entry.tireCompound
        let pitStops = entry.pitStopsDone || 0
        if (!entry.isPlayer && entry.pitLap === currentLap && pitStops === 0) {
          nextCompound = entry.secondCompound || 'duro'
          pitStops += 1
        }

        return {
          ...entry,
          tireWear: currentWear,
          tireCompound: nextCompound,
          pitStopsDone: pitStops,
        }
      })

      // Generate narrated events for this lap
      const newEvents = generateLapNarratedEvents(currentLap, currentGrid, currentWeather)
      if (newEvents.length > 0) {
        setLiveEvents((prev) => [...newEvents, ...prev].slice(0, 40))
      }

      // Update live race state
      setLiveRaceState({
        inProgress: true,
        currentLap,
        totalLaps,
        weather: currentWeather,
        grid: currentGrid,
      })

      // CHECK DECISION PAUSE 1: RAIN ARRIVAL
      if (
        !autoSimulateWithoutPause &&
        rainLap &&
        currentLap === rainLap &&
        currentWeather === 'seco'
      ) {
        clearInterval(timer)
        currentWeather = 'chuva'
        setWeather('chuva')

        const rainEvent: LiveRaceEvent = {
          id: `ev_rain_${currentLap}`,
          lap: currentLap,
          type: 'weather',
          message: `🌧️ CLIMA MUDOU! Asfalto molhado e chuva moderada no ${gpInfo.circuit}! A corrida foi pausada pela Direção de Prova.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        }
        setLiveEvents((prev) => [rainEvent, ...prev])

        setLiveRaceState({
          inProgress: true,
          currentLap,
          totalLaps,
          weather: 'chuva',
          grid: currentGrid,
        })
        setIsSimulatingSession(false)
        setRainDecisionOpen(true)
        toast({
          title: '🌧️ COMEÇOU A CHOVER NA PISTA!',
          description: `Volta ${currentLap}/${totalLaps}: Asfalto molhado! Decida a estratégia de pneus imediatamente.`,
        })
        return
      }

      // CHECK DECISION PAUSE 2: TOQUE COM DANO / ASA QUEBRADA DO JOGADOR
      if (
        !autoSimulateWithoutPause &&
        wingDamageLap &&
        currentLap === wingDamageLap &&
        !wingDamageModalOpen
      ) {
        const playerEntries = currentGrid.filter((g) => g.isPlayer && !g.dnf && !g.hasWingDamage)
        if (playerEntries.length > 0) {
          clearInterval(timer)
          const affectedDriver = playerEntries[0]
          affectedDriver.hasWingDamage = true

          const dmgEvent: LiveRaceEvent = {
            id: `ev_wing_${currentLap}`,
            lap: currentLap,
            type: 'incident',
            message: `💥 CONTATO NA PISTA! ${affectedDriver.driverName} tocou no carro rival na curva! ASA DIANTEIRA QUEBRADA! Fim de placa solto.`,
            driverName: affectedDriver.driverName,
            teamColor: affectedDriver.teamColor,
            isPlayer: true,
            timestamp: new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          }
          setLiveEvents((prev) => [dmgEvent, ...prev])

          setWingDamageDriver(affectedDriver)
          setWingDamageTireChoice(affectedDriver.secondCompound || 'duro')
          setIsSimulatingSession(false)
          setWingDamageModalOpen(true)
          toast({
            variant: 'destructive',
            title: '💥 TOQUE COM DANO / ASA QUEBRADA!',
            description: `Volta ${currentLap}/${totalLaps}: ${affectedDriver.driverName} danificou a asa dianteira! Chamar para o box trocar?`,
          })
          return
        }
      }

      // CHECK DECISION PAUSE 3: SAFETY CAR ENTRA NA PISTA
      if (
        !autoSimulateWithoutPause &&
        safetyCarLap &&
        currentLap === safetyCarLap &&
        !safetyCarActive &&
        !safetyCarModalOpen
      ) {
        clearInterval(timer)
        setSafetyCarActive(true)

        // Find a rival who caused the incident or spun
        const rivalAccident = currentGrid.find((g) => !g.isPlayer && !g.dnf) || currentGrid[1]
        const reason = `Acidente de ${rivalAccident.driverName} (${rivalAccident.teamName}) no setor 2 com detritos espalhados no traçado`
        setSafetyCarReason(reason)

        const scEvent: LiveRaceEvent = {
          id: `ev_sc_${currentLap}`,
          lap: currentLap,
          type: 'safety_car',
          message: `🟡 SAFETY CAR NA PISTA! Bernd Mayländer entra com o Aston Martin Vantage! ${reason}. Velocidade controlada.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        }
        setLiveEvents((prev) => [scEvent, ...prev])

        // AI rival teams rationally decide pit stops under Safety Car (cheap pit stop window!)
        currentGrid.forEach((entry) => {
          if (!entry.isPlayer && !entry.dnf) {
            // 70% of AI drivers take advantage of cheap SC pit stop if tire wear > 40%
            if ((entry.tireWear || 0) > 40 && (entry.pitStopsDone || 0) < 2) {
              entry.tireCompound = entry.secondCompound || 'duro'
              entry.tireWear = 8
              entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
            }
          }
        })

        // Default player tire choice to secondary compound or available
        const p1 = currentGrid.find((g) => g.isPlayer && !g.dnf)
        if (p1) {
          setSafetyCarTireChoice(p1.secondCompound || 'duro')
        }

        setIsSimulatingSession(false)
        setSafetyCarModalOpen(true)
        toast({
          title: '🟡 SAFETY CAR NA PISTA!',
          description: `Volta ${currentLap}/${totalLaps}: Janela barata de pit stop aberta! Entrar nos boxes ou ficar na pista?`,
        })
        return
      }

      // Check if race laps completed
      if (currentLap >= totalLaps) {
        clearInterval(timer)
        finishRaceSimulation(currentGrid, currentWeather)
      }
    }, stepIntervalMs)
  }

  // Handle Player Rain Decision (Intermediate, Extreme Wet, or Wait X laps)
  const handleConfirmRainDecision = (decision: 'intermediario' | 'chuva_extrema' | 'aguardar') => {
    setRainDecisionOpen(false)
    setIsSimulatingSession(true)

    if (!liveRaceState) return
    const currentGrid = [...liveRaceState.grid]
    const currentLap = liveRaceState.currentLap
    const totalLaps = gpInfo.laps
    const incidents = [...raceIncidents]
    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    // AI rivals rationally pit for wet tires right away or on next lap
    currentGrid.forEach((entry) => {
      if (!entry.isPlayer) {
        // AI pit stop for wet tires
        const chooseExtreme = forecast.expectedCondition === 'Tempestade' || Math.random() < 0.35
        entry.tireCompound = chooseExtreme ? 'chuva_extrema' : 'intermediario'
        entry.tireWear = 10
        entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
      }
    })

    // Player choice application
    if (decision === 'aguardar') {
      const waitLaps = Math.max(1, rainDecisionWaitLaps)
      const penaltyScore = waitLaps * 15 // Severe penalty for driving slick tires in wet
      const accidentRisk = Math.min(75, waitLaps * 18) // High crash risk on wet track with slicks
      const hadAccident = Math.random() * 100 < accidentRisk

      const waitMsg = `🌧️ ESTRATÉGIA ARRISCADA: Você decidiu aguardar ${waitLaps} volta(s) com slicks no asfalto molhado!`
      incidents.push(waitMsg)
      setLiveEvents((prev) => [
        {
          id: `ev_wait_${Date.now()}`,
          lap: currentLap,
          type: 'weather',
          message: waitMsg,
          timestamp: nowStr,
        },
        ...prev,
      ])

      if (hadAccident) {
        const crashMsg = `💥 AQUAPLANAGEM: Carro da equipe perdeu completamente a aderência na água e colidiu!`
        incidents.push(crashMsg)
        setLiveEvents((prev) => [
          {
            id: `ev_crash_${Date.now()}`,
            lap: currentLap,
            type: 'incident',
            message: crashMsg,
            timestamp: nowStr,
          },
          ...prev,
        ])
      } else {
        incidents.push(
          `⏱️ PERDA DE RITMO: Sem aderência no molhado com slicks, perdeu ~${(waitLaps * 2.8).toFixed(1)}s por volta antes de colocar intermediários!`,
        )
      }

      currentGrid.forEach((entry) => {
        if (entry.isPlayer) {
          entry.tireWear = Math.min(100, (entry.tireWear || 50) + waitLaps * 8)
          entry.score -= penaltyScore
          if (hadAccident) {
            entry.dnf = true
            entry.dnfReason = 'Aquaplanagem com pneus de pista seca na chuva'
          } else {
            entry.tireCompound = 'intermediario'
            entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
            if (tireStock.intermediario > 0) {
              setTireStock((prev) => ({
                ...prev,
                intermediario: Math.max(0, prev.intermediario - 1),
              }))
            }
          }
        }
      })
    } else {
      // Player pits for selected wet tire
      const chosenTire = decision
      if (tireStock[chosenTire] > 0) {
        setTireStock((prev) => ({
          ...prev,
          [chosenTire]: Math.max(0, prev[chosenTire] - 1),
        }))
      }
      const pitMsg = `🌧️ PIT STOP EMERGENCIAL: Equipe chamou os carros para troca imediata para pneus ${formatTireName(chosenTire)}.`
      incidents.push(pitMsg)
      setLiveEvents((prev) => [
        {
          id: `ev_wetpit_${Date.now()}`,
          lap: currentLap,
          type: 'pit_stop',
          message: pitMsg,
          timestamp: nowStr,
        },
        ...prev,
      ])
      currentGrid.forEach((entry) => {
        if (entry.isPlayer) {
          entry.tireCompound = chosenTire
          entry.tireWear = 10
          entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
        }
      })
    }

    setRaceIncidents(incidents)
    setSimText('Retomando corrida sob condições de chuva...')

    // Resume narrated race loop until finish
    runLiveRaceLoop(currentGrid, currentLap, 'chuva')
  }

  // Handle Player Decision for Broken Wing / Touch Damage
  const handleConfirmWingDamageDecision = (decision: 'pit_trocar' | 'continuar') => {
    setWingDamageModalOpen(false)
    setIsSimulatingSession(true)

    if (!liveRaceState) return
    const currentGrid = [...liveRaceState.grid]
    const currentLap = liveRaceState.currentLap
    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const driver = wingDamageDriver
    if (!driver) return

    if (decision === 'pit_trocar') {
      // Pit stop immediately to replace the front wing cone
      // Time penalty in pit: ~12s extra for nose cone change, but car returns with full pace and zero aero loss
      if (tireStock[wingDamageTireChoice] > 0) {
        setTireStock((prev) => ({
          ...prev,
          [wingDamageTireChoice]: Math.max(0, prev[wingDamageTireChoice] - 1),
        }))
      }

      currentGrid.forEach((entry) => {
        if (entry.driverId === driver.driverId) {
          entry.hasWingDamage = false
          entry.tireCompound = wingDamageTireChoice
          entry.tireWear = 8 // Fresh rubber
          entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
          entry.score -= 10 // Pit time loss with nose change
        }
      })

      const msg = `🔧 PIT STOP PARA TROCA DE BICO E ASA: ${driver.driverName} entrou nos boxes! A equipe trocou o bico e montou pneus ${formatTireName(wingDamageTireChoice)} em rápidos 13.8s. O carro volta à pista com 100% de downforce!`
      setRaceIncidents((prev) => [...prev, msg])
      setLiveEvents((prev) => [
        {
          id: `ev_wing_pit_${Date.now()}`,
          lap: currentLap,
          type: 'pit_stop',
          message: msg,
          driverName: driver.driverName,
          teamColor: driver.teamColor,
          isPlayer: true,
          timestamp: nowStr,
        },
        ...prev,
      ])
      toast({
        title: 'Asa Substituída com Sucesso',
        description: `${driver.driverName} retornou com aerodinâmica íntegra e pneus novos.`,
      })
    } else {
      // Stay on track with broken wing: heavy pace penalty (-25 score) + 30% chance of sudden DNF or secondary crash
      const secondaryCrash = Math.random() < 0.28
      currentGrid.forEach((entry) => {
        if (entry.driverId === driver.driverId) {
          entry.hasWingDamage = true
          entry.score -= 28 // Severe continuous downforce penalty
          if (secondaryCrash) {
            entry.dnf = true
            entry.dnfReason = 'Perda total de controle por colapso da asa dianteira danificada'
          }
        }
      })

      const msg = secondaryCrash
        ? `💥 ACIDENTE GRAVE! Sem sustentação aerodinâmica com a asa quebrada, ${driver.driverName} escapou na curva de alta velocidade e bateu no guard-rail! Fim de prova.`
        : `⚠️ DECISÃO ARRISCADA: ${driver.driverName} permaneceu na pista com a asa quebrada! O carro está sofrendo com saída de frente extrema (-2.4s por volta).`

      setRaceIncidents((prev) => [...prev, msg])
      setLiveEvents((prev) => [
        {
          id: `ev_wing_stay_${Date.now()}`,
          lap: currentLap,
          type: 'incident',
          message: msg,
          driverName: driver.driverName,
          teamColor: driver.teamColor,
          isPlayer: true,
          timestamp: nowStr,
        },
        ...prev,
      ])
    }

    // Resume loop
    runLiveRaceLoop(currentGrid, currentLap, liveRaceState.weather)
  }

  // Handle Player Decision for Safety Car (Cheap Pit Stop or Stay Out)
  const handleConfirmSafetyCarDecision = (decision: 'pit_sc' | 'stay_out') => {
    setSafetyCarModalOpen(false)
    setIsSimulatingSession(true)

    if (!liveRaceState) return
    const currentGrid = [...liveRaceState.grid]
    const currentLap = liveRaceState.currentLap
    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    if (decision === 'pit_sc') {
      // Pit stop under Safety Car is cheap! Only loses ~10-12s instead of ~22-25s in green flag!
      if (tireStock[safetyCarTireChoice] > 0) {
        setTireStock((prev) => ({
          ...prev,
          [safetyCarTireChoice]: Math.max(0, prev[safetyCarTireChoice] - 1),
        }))
      }

      currentGrid.forEach((entry) => {
        if (entry.isPlayer && !entry.dnf) {
          entry.tireCompound = safetyCarTireChoice
          entry.tireWear = 6 // Fresh tires
          entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
          entry.score += 6 // Tactical gain: fresh tires with cheap delta!
        }
      })

      const msg = `🟡 PIT STOP ESTRATÉGICO SOB SAFETY CAR: A equipe aproveitou o delta reduzido de velocidade para colocar pneus ${formatTireName(safetyCarTireChoice)} com perda mínima de tempo de pista!`
      setRaceIncidents((prev) => [...prev, msg])
      setLiveEvents((prev) => [
        {
          id: `ev_sc_pit_${Date.now()}`,
          lap: currentLap,
          type: 'pit_stop',
          message: msg,
          isPlayer: true,
          timestamp: nowStr,
        },
        ...prev,
      ])
      toast({
        title: 'Pit Stop Sob Safety Car Executado!',
        description: `Pneus novos (${formatTireName(safetyCarTireChoice)}) montados perdendo pouquíssimo tempo de pelotão.`,
      })
    } else {
      // Stay on track: retain track position, but tire wear will continue without fresh rubber
      currentGrid.forEach((entry) => {
        if (entry.isPlayer && !entry.dnf) {
          entry.score += 3 // Kept track position on the restart
        }
      })

      const msg = `🟡 ESTRATÉGIA DE PISTA: A equipe optou por não parar nos boxes sob Safety Car para manter a posição na relargada.`
      setRaceIncidents((prev) => [...prev, msg])
      setLiveEvents((prev) => [
        {
          id: `ev_sc_stay_${Date.now()}`,
          lap: currentLap,
          type: 'info',
          message: msg,
          isPlayer: true,
          timestamp: nowStr,
        },
        ...prev,
      ])
    }

    // Safety Car leaves after 3 laps
    const scRestartLap = Math.min(gpInfo.laps, currentLap + 3)
    const restartMsg = `🟢 SAFETY CAR NA BOX NESTA VOLTA! Bernd Mayländer apaga as luzes no teto do SC. Corrida relargada!`
    setLiveEvents((prev) => [
      {
        id: `ev_sc_restart_${Date.now()}`,
        lap: scRestartLap,
        type: 'info',
        message: restartMsg,
        timestamp: nowStr,
      },
      ...prev,
    ])

    // Resume loop
    runLiveRaceLoop(currentGrid, currentLap, liveRaceState.weather)
  }

  // Calculate final positions, points, tire degradation & race results
  const finishRaceSimulation = (grid: SimDriverEntry[], finalWeather: 'seco' | 'chuva') => {
    const abrasiveness = gpInfo.tireAbrasiveness || 6
    const setupPenalty = calculateSetupDelta('race')
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const playerTeamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)
    const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team?.id)
    const reserve = drivers.find(
      (d) => d.role === 'reserva' || (d.reserve_team_id === team?.id && d.team_id !== team?.id),
    )

    const incidents = [...raceIncidents]

    grid.forEach((entry) => {
      if (entry.dnf) return // already DNF

      let driverSkill = 80
      let carLevel = 75

      if (entry.isPlayer) {
        const dObj = titulars.find((d) => d.id === entry.driverId) || titulars[0]
        const active = dObj?.is_incapacitated && reserve ? reserve : dObj
        driverSkill =
          finalWeather === 'chuva'
            ? active.speed * 0.25 + active.rain * 0.45 + active.consistency * 0.3
            : active.speed * 0.4 + active.consistency * 0.35 + active.defense * 0.25

        // Factor in driver moral and physical condition
        const moraleBonus = ((active.morale ?? 80) - 70) * 0.12
        const physicalBonus = ((active.physical_condition ?? 90) - 80) * 0.1
        driverSkill += moraleBonus + physicalBonus

        carLevel = playerCarLevel * 0.7 + playerTeamStrength * 0.3 - setupPenalty

        // Mechanical failure check: Engine reliability + parts condition risk
        const criticalPart = parts.find((p) => (p.condition ?? 100) < 30)
        const lowConditionPenaltyRisk = criticalPart
          ? Math.round((30 - (criticalPart.condition ?? 100)) * 1.5)
          : 0
        const mechRisk =
          100 -
          currentEngine.reliability +
          (setups.race.pu_electric_ratio > 65 ? 8 : 0) +
          lowConditionPenaltyRisk

        if (Math.random() * 100 < mechRisk) {
          entry.dnf = true
          if (criticalPart && Math.random() < 0.6) {
            entry.dnfReason = `Quebra mecânica estrutural em ${criticalPart.name}`
            incidents.push(
              `⚠️ ABANDONO: ${entry.driverName} abandonou por quebra mecânica estrutural em ${criticalPart.name}!`,
            )
          } else {
            entry.dnfReason = 'Falha no inversor de 350kW do MGU-K'
            incidents.push(`⚠️ ABANDONO: ${entry.driverName} sofreu pane elétrica no MGU-K!`)
          }
        }
      } else {
        // AI rival driver
        driverSkill = 81 + Math.random() * 6
        carLevel = 76 + Math.random() * 6
        if (Math.random() < 0.05) {
          entry.dnf = true
          entry.dnfReason = 'Problema de pressão hidráulica'
          incidents.push(`⚠️ ABANDONO: ${entry.driverName} abandonou por quebra mecânica.`)
        }
      }

      // Tire wear impacts score and risk
      const finalWear = Math.min(
        100,
        Math.max(30, (entry.tireWear || 60) + Math.round(Math.random() * 20)),
      )
      entry.tireWear = finalWear

      // Tire puncture / sudden drop risk if wear > 88%
      if (finalWear > 88) {
        entry.score -= 15
        if (Math.random() < 0.25 && !entry.dnf) {
          entry.dnf = true
          entry.dnfReason = 'Delaminação e estouro de pneu por desgaste excessivo'
          incidents.push(
            `💥 ESTOURO DE PNEU: ${entry.driverName} perdeu a banda de rodagem e bateu!`,
          )
        }
      }

      const luck = (Math.random() - 0.5) * 12
      entry.score = driverSkill * 0.4 + carLevel * 0.5 + luck - (finalWear > 80 ? 5 : 0)
    })

    // Sort: non-DNF by score, then DNF
    grid.sort((a, b) => {
      if (a.dnf && !b.dnf) return 1
      if (!a.dnf && b.dnf) return -1
      return b.score - a.score
    })

    // Points attribution for Top 10 (FIA regulation)
    const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    const baseMinutes = 78
    const baseSeconds = 14

    grid.forEach((entry, idx) => {
      entry.position = idx + 1
      if (!entry.dnf && idx < pointsTable.length) {
        entry.points = pointsTable[idx]
      }
      if (idx > 0 && !entry.dnf && Math.random() < 0.65) {
        entry.usedOvertake = true
      }
      if (entry.dnf) {
        entry.totalTime = 'ABANDONO (DNF)'
      } else if (idx === 0) {
        entry.totalTime = `1h ${baseMinutes}m ${baseSeconds.toFixed(3)}s`
      } else {
        const gap = (idx * 1.65 + Math.random() * 0.7).toFixed(3)
        entry.totalTime = `+${gap}s`
      }
    })

    // Fastest Lap
    const top10 = grid.filter((g) => !g.dnf && g.position <= 10)
    if (top10.length > 0) {
      const flIndex = Math.floor(Math.random() * top10.length)
      top10[flIndex].fastestLap = true
      top10[flIndex].points += 1
    }

    if (incidents.length > 0) {
      setSafetyCarActive(true)
    }
    setRaceIncidents(incidents)

    setIsSimulatingSession(false)
    setRaceResults(grid)
    setCompletedSessions((prev) => [...new Set<WeekendSession>([...prev, 'race'])])
    if (liveRaceState) {
      setLiveRaceState((prev) => (prev ? { ...prev, inProgress: false, grid } : null))
    }
  }

  // ADVANCE ROUND & PERSIST RESULTS ROBUSTLY
  const handleAdvanceRound = async () => {
    if (!raceResults || !team || !season) return
    setIsFinishing(true)

    try {
      // 1. Idempotency: clean any previous partial results for this round
      await f1Service.deleteRaceResultsForRound(season.id, currentRound)

      // 2. Persist race_results with canonical ID resolution
      const resultsToSave = raceResults.filter((r) => r.isPlayer || r.position <= 10)

      let savedCount = 0
      for (const res of resultsToSave) {
        try {
          // Canonical resolution of driver and team
          const { canonicalDriverId, canonicalTeamId } = await f1Service.ensureDriverAndTeam(
            res.driverName,
            res.driverId,
            res.teamId,
            { name: res.teamName, color: res.teamColor },
            { role: 'titular' },
          )

          if (canonicalDriverId && canonicalTeamId) {
            await f1Service.createRaceResult({
              season_id: season.id,
              round: currentRound,
              driver_id: canonicalDriverId,
              team_id: canonicalTeamId,
              position: res.position,
              points: res.points ?? 0,
              fastest_lap: !!res.fastestLap,
            })
            savedCount++
          }
        } catch (resErr) {
          console.warn('Erro tolerado ao gravar resultado de um piloto:', res.driverName, resErr)
        }
      }

      // 3. Process Finances
      let totalSponsorIncome = 0
      for (const sp of sponsors) {
        if (sp.status === 'ativo') {
          totalSponsorIncome += sp.value_per_round
          if (sp.rounds_remaining && sp.rounds_remaining > 1) {
            await f1Service.updateSponsor(sp.id, { rounds_remaining: sp.rounds_remaining - 1 })
          } else if (sp.rounds_remaining === 1) {
            await f1Service.updateSponsor(sp.id, { rounds_remaining: 0, status: 'encerrado' })
          }
        }
      }

      const driversCost = drivers.reduce((sum, d) => sum + Math.round(d.salary / 24), 0)
      const engineCost = Math.round(currentEngine.costAnnual / 24)
      const netCashflow = totalSponsorIncome - driversCost - engineCost
      const updatedBudget = Math.max(0, team.budget + netCashflow)

      // 4. Update Driver fatigue, injuries & reserves
      const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team.id)
      const reserve = drivers.find(
        (d) => d.role === 'reserva' || (d.reserve_team_id === team.id && d.team_id !== team.id),
      )

      for (const t of titulars) {
        if (t.is_incapacitated) {
          const roundsLeft = (t.incapacitated_rounds_left || 1) - 1
          if (roundsLeft <= 0) {
            await f1Service.updateDriver(t.id, {
              is_incapacitated: false,
              incapacitated_rounds_left: 0,
              incapacitated_reason: '',
            })
            await f1Service.addEvent(
              team.id,
              `Piloto ${t.name} foi liberado pelo departamento médico e retorna ao cockpit!`,
              'resultado',
            )
          } else {
            await f1Service.updateDriver(t.id, { incapacitated_rounds_left: roundsLeft })
          }
        } else {
          // Small chance of fatigue/injury
          const injuryRoll = Math.random() < 0.04
          if (injuryRoll && reserve) {
            const reasons = [
              'Lesão cervical por fadiga em alta velocidade',
              'Contratura muscular nas costas',
              'Intoxicação alimentar',
            ]
            const reason = reasons[Math.floor(Math.random() * reasons.length)]
            await f1Service.updateDriver(t.id, {
              is_incapacitated: true,
              incapacitated_rounds_left: 1,
              incapacitated_reason: reason,
            })
            await f1Service.addEvent(
              team.id,
              `ALERTA MÉDICO: ${t.name} sofreu "${reason}" e ficará fora da próxima etapa. O reserva ${reserve.name} assumirá o carro!`,
              'resultado',
            )
          }
        }
      }

      // 4.1 Apply wear to parts (8% to 18% wear per race, more if aggressive setup)
      const aggressiveAero = (setups.race.wing_level || 5) > 7
      const aggressiveSuspension = (setups.race.suspension_stiffness || 5) > 7
      const aggressiveMGU = (setups.race.pu_electric_ratio || 50) > 65

      for (const p of parts) {
        let wearPercent = Math.floor(8 + Math.random() * 11) // 8 to 18
        if (p.name.toLowerCase().includes('asa') && aggressiveAero) wearPercent += 3
        if (p.name.toLowerCase().includes('suspens') && aggressiveSuspension) wearPercent += 4
        if (p.name.toLowerCase().includes('aerodin') && aggressiveAero) wearPercent += 3
        if (p.name.toLowerCase().includes('chassi') && aggressiveMGU) wearPercent += 2

        const currentPartCond = p.condition ?? 100
        const newCondition = Math.max(0, currentPartCond - wearPercent)
        try {
          await f1Service.updatePart(p.id, { condition: newCondition })
        } catch (pErr) {
          console.warn('Erro ao atualizar desgaste de peça:', p.name, pErr)
        }
      }

      await f1Service.updateTeam(team.id, {
        budget: updatedBudget,
      })

      // 5. Register Event
      const playerWinner = raceResults.find((p) => p.isPlayer && p.position === 1)
      const bestPos = Math.min(...raceResults.filter((p) => p.isPlayer).map((p) => p.position))
      const eventMsg = playerWinner
        ? `VITÓRIA ESPETACULAR! ${playerWinner.driverName} venceu o ${gpInfo.name}!`
        : `Rodada ${currentRound} (${gpInfo.name}) concluída. Melhor posição da equipe: P${bestPos}. Fluxo financeiro: ${formatCurrency(netCashflow)}.`

      await f1Service.addEvent(team.id, eventMsg, 'resultado')

      // 6. Advance season round
      const nextRound = currentRound + 1
      await f1Service.updateSeason(season.id, { current_round: nextRound })

      toast({
        title: `Rodada ${currentRound} Concluída com Sucesso!`,
        description: `${savedCount} classificações registradas no campeonato oficial.`,
      })

      await refreshTeamAndSeason()

      if (nextRound > totalRounds) {
        setSeasonCompleted(true)
      } else {
        navigate('/')
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao avançar rodada',
        description: err?.message || 'Tente novamente.',
      })
    } finally {
      setIsFinishing(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-[#E10600] uppercase">
            Fim de Semana de Grande Prêmio Oficial • Regulamento F1 2026
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA] mt-1">
            {gpInfo.name} • Rodada {currentRound}/{totalRounds}
          </h1>
          <p className="text-sm font-mono text-[#00A6FB] mt-0.5">
            {gpInfo.circuit} • {gpInfo.country} {gpInfo.flag}
          </p>
        </div>

        {/* Global Weather & Abrasiveness Badge */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`font-mono text-xs px-3 py-1 flex items-center gap-1.5 ${
              weather === 'chuva'
                ? 'border-sky-400 text-sky-400 bg-sky-400/10'
                : 'border-amber-400 text-amber-400 bg-amber-400/10'
            }`}
          >
            {weather === 'chuva' ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {weather === 'chuva' ? 'Pista Molhada (Chuva)' : 'Pista Seca'}
          </Badge>

          <Badge variant="outline" className="border-[#1F2733] text-[#8B95A7] font-mono text-xs">
            Abrasividade: {gpInfo.tireAbrasiveness || 6}/10
          </Badge>
        </div>
      </div>

      {/* PAINEL DE PREVISÃO METEOROLÓGICA OFICIAL DA FIA 2026 */}
      <Card className="bg-[#11161F] border-[#1F2733] p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                forecast.probability >= 50
                  ? 'bg-sky-500/10 border-sky-500/40 text-sky-400'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              }`}
            >
              {forecast.probability >= 50 ? (
                <CloudRain className="w-6 h-6 animate-pulse" />
              ) : (
                <Sun className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#8B95A7]">
                  Radar Meteorológico Oficial
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono px-1.5 py-0 ${
                    forecast.probability >= 60
                      ? 'border-red-500/40 text-red-400 bg-red-500/10'
                      : forecast.probability >= 30
                        ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                        : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                  }`}
                >
                  {forecast.probability}% Risco de Chuva
                </Badge>
              </div>
              <h3 className="text-base font-bold text-[#F5F7FA] mt-0.5">
                Previsão para o GP: {forecast.expectedCondition}
              </h3>
              <p className="text-xs text-[#8B95A7]">
                {forecast.probability >= 35 && forecast.rainLapStart
                  ? `Alerta de Radar: Nuvem densa se aproximando com chuva prevista por volta da volta ${forecast.rainLapStart}.`
                  : 'Condições meteorológicas estáveis previstas durante o evento.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <span className="text-[10px] text-[#8B95A7] block">Temp. Ar</span>
              <strong className="text-sm text-[#F5F7FA]">{forecast.airTemp}°C</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <span className="text-[10px] text-[#8B95A7] block">Temp. Asfalto</span>
              <strong className="text-sm text-amber-400">{forecast.trackTemp}°C</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <span className="text-[10px] text-[#8B95A7] block">Clima Atual</span>
              <strong
                className={`text-sm ${weather === 'chuva' ? 'text-sky-400' : 'text-emerald-400'}`}
              >
                {weather === 'chuva' ? 'Chovendo' : 'Seco'}
              </strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Season Completed Banner if R24 */}
      {seasonCompleted && (
        <Card className="bg-gradient-to-r from-[#11161F] via-[#1E2738] to-[#11161F] border-2 border-amber-500/60 p-6 shadow-2xl">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA]">
                Temporada 2026 Finalizada!
              </h2>
              <p className="text-sm text-[#8B95A7] max-w-lg mx-auto mt-1">
                Todas as 24 etapas foram concluídas sob a nova era dos motores 50/50 e aerodinâmica
                ativa.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Button asChild className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                <a href="/standings">Ver Classificação Final de Campeões</a>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* TIRE ALLOTMENT STATUS BAR (FIA 2026 Regulation) */}
      <Card className="bg-[#11161F] border-[#1F2733] p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#F5F7FA] flex items-center gap-2">
              <Disc className="w-4 h-4 text-[#E10600]" />
              Estoque Oficial de Pneus do Piloto (Regulamento FIA)
            </h3>
            <p className="text-xs text-[#8B95A7] mt-0.5">
              Alocação limitada por GP. Pista seca exige uso obrigatório de 2 compostos na corrida!
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
            {/* Hard */}
            <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white ring-1 ring-slate-400" />
                <span className="text-[#8B95A7] text-[10px]">DURO</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.duro === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.duro} jogos
              </strong>
              <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                ~{calculateCompoundLaps('duro')} voltas
              </span>
            </div>

            {/* Medium */}
            <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-500" />
                <span className="text-[#8B95A7] text-[10px]">MÉDIO</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.medio === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.medio} jogos
              </strong>
              <span className="text-[10px] text-amber-400 font-mono block mt-0.5">
                ~{calculateCompoundLaps('medio')} voltas
              </span>
            </div>

            {/* Soft */}
            <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-1 ring-red-600" />
                <span className="text-[#8B95A7] text-[10px]">MACIO</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.macio === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.macio} jogos
              </strong>
              <span className="text-[10px] text-rose-400 font-mono block mt-0.5">
                ~{calculateCompoundLaps('macio')} voltas
              </span>
            </div>

            {/* Intermediate */}
            <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-emerald-600" />
                <span className="text-[#8B95A7] text-[10px]">INTERMEDIÁRIO</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.intermediario === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.intermediario} jogos
              </strong>
              <span className="text-[10px] text-sky-400 font-mono block mt-0.5">
                ~{calculateCompoundLaps('intermediario')} voltas
              </span>
            </div>

            {/* Wet */}
            <div className="p-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-center col-span-2 sm:col-span-1">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-1 ring-blue-600" />
                <span className="text-[#8B95A7] text-[10px]">CHUVA EXT.</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.chuva_extrema === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.chuva_extrema} jogos
              </strong>
              <span className="text-[10px] text-blue-400 font-mono block mt-0.5">
                ~{calculateCompoundLaps('chuva_extrema')} voltas
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* WEEKEND TABS: TP1, TP2, Q1, Q2, Q3, CORRIDA */}
      <Tabs
        value={activeSession}
        onValueChange={(v) => setActiveSession(v as WeekendSession)}
        className="w-full"
      >
        <TabsList className="bg-[#11161F] border border-[#1F2733] grid grid-cols-3 sm:grid-cols-6 h-auto p-1 gap-1">
          {(['tp1', 'tp2', 'q1', 'q2', 'q3', 'race'] as WeekendSession[]).map((sess) => {
            const isDone = completedSessions.includes(sess)
            const labelMap: Record<WeekendSession, string> = {
              tp1: 'Treino 1',
              tp2: 'Treino 2',
              q1: 'Q1',
              q2: 'Q2',
              q3: 'Q3',
              race: 'Corrida GP',
            }

            return (
              <TabsTrigger
                key={sess}
                value={sess}
                className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white font-mono text-xs py-2 flex items-center justify-center gap-1"
              >
                {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {labelMap[sess]}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Dynamic content for each session */}
        {(['tp1', 'tp2', 'q1', 'q2', 'q3', 'race'] as WeekendSession[]).map((sessKey) => {
          const currentSetup = setups[sessKey]
          const isRaceSession = sessKey === 'race'
          const isDone = completedSessions.includes(sessKey)
          const resultsForThis = sessionResults[sessKey]

          return (
            <TabsContent key={sessKey} value={sessKey} className="space-y-6 mt-4">
              {/* Setup Configuration Panel for this session */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sliders: Wing, Suspension, 50/50 Power */}
                <Card className="bg-[#11161F] border-[#1F2733] lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-[#E10600]" />
                        Configuração do Carro — {sessKey.toUpperCase()}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveSetup}
                        className="border-[#1F2733] text-xs h-8 text-[#00A6FB] hover:bg-[#1F2733]"
                      >
                        Salvar Setup
                      </Button>
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8B95A7]">
                      Ajuste fino de aerodinâmica ativa, suspensão mecânica e gestão do trem de
                      força híbrido para {gpInfo.circuit}.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Slider 1: Wing Downforce */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-[#F5F7FA] font-bold flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-[#00A6FB]" /> Nível da Asa (Pressão
                          Aerodinâmica):
                        </span>
                        <Badge variant="outline" className="border-[#1F2733] text-[#00A6FB]">
                          Nível {currentSetup.wing_level}/10 •{' '}
                          {currentSetup.wing_level <= 3
                            ? 'Baixo Arrasto (Monza)'
                            : currentSetup.wing_level >= 8
                              ? 'Alta Carga (Mônaco)'
                              : 'Misto Médio'}
                        </Badge>
                      </div>
                      <Slider
                        value={[currentSetup.wing_level]}
                        min={1}
                        max={10}
                        step={1}
                        onValueChange={(val) => updateCurrentSetup('wing_level', val[0])}
                        className="py-2"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                        <span>1 (Mínimo arrasto em retas)</span>
                        <span>Ideal do circuito: {gpInfo.downforceIdeal || 6}</span>
                        <span>10 (Máxima aderência em curvas)</span>
                      </div>
                    </div>

                    {/* Slider 2: Suspension Stiffness */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-[#F5F7FA] font-bold flex items-center gap-1.5">
                          <Gauge className="w-4 h-4 text-emerald-400" /> Rigidez da Suspensão:
                        </span>
                        <Badge variant="outline" className="border-[#1F2733] text-emerald-400">
                          Nível {currentSetup.suspension_stiffness}/10 •{' '}
                          {currentSetup.suspension_stiffness <= 4
                            ? 'Macia (Absorve zebras)'
                            : currentSetup.suspension_stiffness >= 8
                              ? 'Rígida (Alta estabilidade)'
                              : 'Equilibrada'}
                        </Badge>
                      </div>
                      <Slider
                        value={[currentSetup.suspension_stiffness]}
                        min={1}
                        max={10}
                        step={1}
                        onValueChange={(val) => updateCurrentSetup('suspension_stiffness', val[0])}
                        className="py-2"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                        <span>1 (Macia / menos desgaste)</span>
                        <span>Ideal do circuito: {gpInfo.suspensionIdeal || 6}</span>
                        <span>10 (Rígida / mais resposta)</span>
                      </div>
                    </div>

                    {/* Slider 3: 50/50 Power Unit Balance */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-[#F5F7FA] font-bold flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-400" /> Balanço de Potência 50/50
                          (Elétrico MGU-K vs Combustão V6):
                        </span>
                        <Badge variant="outline" className="border-[#1F2733] text-amber-400">
                          {currentSetup.pu_electric_ratio}% Elétrico /{' '}
                          {100 - currentSetup.pu_electric_ratio}% V6
                        </Badge>
                      </div>
                      <Slider
                        value={[currentSetup.pu_electric_ratio]}
                        min={20}
                        max={80}
                        step={5}
                        onValueChange={(val) => updateCurrentSetup('pu_electric_ratio', val[0])}
                        className="py-2"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                        <span>20% (Conservador / mais confiável)</span>
                        <span>50% (Padrão Oficial FIA 2026)</span>
                        <span>80% (Pico elétrico agressivo / risco térmico)</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tire & Pit Stop Strategy Choice */}
                <Card className="bg-[#11161F] border-[#1F2733] flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                      <Disc className="w-5 h-5 text-yellow-400" />
                      Estratégia de Pneus & Boxes
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8B95A7]">
                      {isRaceSession
                        ? 'Defina os 2 compostos obrigatórios e a volta prevista do pit stop.'
                        : 'Escolha o jogo de pneus para este stint de treino/classificação.'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Primary Tire Choice */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono text-[#8B95A7] block">
                        {isRaceSession ? 'Composto de Largada (Stint 1):' : 'Composto da Sessão:'}
                      </label>
                      <select
                        value={currentSetup.tire_compound || 'medio'}
                        onChange={(e) =>
                          updateCurrentSetup('tire_compound', e.target.value as TireCompound)
                        }
                        className="w-full bg-[#0B0E14] border border-[#1F2733] rounded-lg px-3 py-2 text-xs font-mono text-[#F5F7FA] focus:outline-none focus:border-[#00A6FB]"
                      >
                        <option value="macio">Macio (Vermelho) — Estoque: {tireStock.macio}</option>
                        <option value="medio">Médio (Amarelo) — Estoque: {tireStock.medio}</option>
                        <option value="duro">Duro (Branco) — Estoque: {tireStock.duro}</option>
                        <option value="intermediario">
                          Intermediário (Verde) — Estoque: {tireStock.intermediario}
                        </option>
                        <option value="chuva_extrema">
                          Chuva Extrema (Azul) — Estoque: {tireStock.chuva_extrema}
                        </option>
                      </select>
                    </div>

                    {/* Secondary Tire & Pit Lap (only for Race) */}
                    {isRaceSession && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-mono text-[#8B95A7] block">
                            Segundo Composto (Stint 2 pós-pit):
                          </label>
                          <select
                            value={currentSetup.second_tire_compound || 'duro'}
                            onChange={(e) =>
                              updateCurrentSetup(
                                'second_tire_compound',
                                e.target.value as TireCompound,
                              )
                            }
                            className="w-full bg-[#0B0E14] border border-[#1F2733] rounded-lg px-3 py-2 text-xs font-mono text-[#F5F7FA] focus:outline-none focus:border-[#00A6FB]"
                          >
                            <option value="duro">Duro (Branco) — Estoque: {tireStock.duro}</option>
                            <option value="medio">
                              Médio (Amarelo) — Estoque: {tireStock.medio}
                            </option>
                            <option value="macio">
                              Macio (Vermelho) — Estoque: {tireStock.macio}
                            </option>
                            <option value="intermediario">
                              Intermediário (Verde) — Estoque: {tireStock.intermediario}
                            </option>
                            <option value="chuva_extrema">
                              Chuva Extrema (Azul) — Estoque: {tireStock.chuva_extrema}
                            </option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-[#8B95A7]">Volta-alvo de Pit Stop:</span>
                            <strong className="text-[#F5F7FA]">
                              Volta {currentSetup.target_pit_lap || 25} de {gpInfo.laps}
                            </strong>
                          </div>
                          <Slider
                            value={[currentSetup.target_pit_lap || 25]}
                            min={10}
                            max={Math.max(15, gpInfo.laps - 8)}
                            step={1}
                            onValueChange={(val) => updateCurrentSetup('target_pit_lap', val[0])}
                            className="py-1"
                          />
                        </div>
                      </>
                    )}

                    {/* Action button to execute session */}
                    <div className="pt-2 space-y-2">
                      {isRaceSession ? (
                        <>
                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            <Button
                              size="lg"
                              onClick={handleStartRace}
                              disabled={isSimulatingSession || isDone}
                              className="flex-1 w-full bg-gradient-to-r from-[#E10600] to-[#FF6B35] hover:from-[#FF2E25] hover:to-[#FF7B48] text-white font-extrabold shadow-lg"
                            >
                              <Play className="w-4 h-4 mr-2 fill-current" />
                              {isDone ? 'Corrida Concluída' : 'Iniciar Corrida Narrada (Ao Vivo)'}
                            </Button>

                            {!isDone && (
                              <div className="flex items-center gap-1.5 p-1 bg-[#0B0E14] border border-[#1F2733] rounded-lg">
                                <span className="text-[10px] text-[#8B95A7] px-1 font-mono">
                                  Velocidade:
                                </span>
                                {[1, 2, 4].map((spd) => (
                                  <button
                                    key={spd}
                                    type="button"
                                    onClick={() => setSimSpeed(spd)}
                                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                                      simSpeed === spd
                                        ? 'bg-[#00A6FB] text-[#0B0E14]'
                                        : 'text-[#8B95A7] hover:text-white'
                                    }`}
                                  >
                                    {spd}x
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {!isDone && (
                            <div className="flex items-center justify-between text-[11px] font-mono text-[#8B95A7] px-1">
                              <span>Modo de Corrida:</span>
                              <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={autoSimulateWithoutPause}
                                  onChange={(e) => setAutoSimulateWithoutPause(e.target.checked)}
                                  className="rounded border-[#1F2733] text-[#E10600] focus:ring-0"
                                />
                                <span>Simulação Rápida (sem pausar em incidentes)</span>
                              </label>
                            </div>
                          )}
                        </>
                      ) : (
                        <Button
                          size="lg"
                          onClick={() => handleRunSession(sessKey)}
                          disabled={isSimulatingSession}
                          className="w-full bg-[#00A6FB] hover:bg-[#0092DC] text-[#0B0E14] font-bold shadow-md"
                        >
                          <Play className="w-4 h-4 mr-2 fill-current" />
                          {isDone
                            ? `Repetir Stint ${sessKey.toUpperCase()}`
                            : `Executar ${sessKey.toUpperCase()}`}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Simulation Animation Banner & Live Status */}
              {isSimulatingSession && (
                <Card className="bg-[#11161F] border border-[#00A6FB]/60 p-5 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#1F2733] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#00A6FB]/20 text-[#00A6FB] animate-spin">
                        <Gauge className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#F5F7FA]">{simText}</h3>
                        <p className="text-xs text-[#8B95A7] font-mono">
                          Simulação e telemetria ativas em tempo real
                        </p>
                      </div>
                    </div>

                    {isRaceSession && liveRaceState && (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-xs font-mono">
                          Volta {liveRaceState.currentLap} / {liveRaceState.totalLaps}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`font-mono text-xs ${
                            liveRaceState.weather === 'chuva'
                              ? 'border-sky-400 text-sky-400 bg-sky-400/10'
                              : 'border-amber-400 text-amber-400 bg-amber-400/10'
                          }`}
                        >
                          {liveRaceState.weather === 'chuva' ? 'Molhado' : 'Seco'}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <Progress value={simProgress} className="h-2 w-full bg-[#0B0E14]" />
                </Card>
              )}

              {/* CORRIDA AO VIVO: FEED DE EVENTOS EM TEMPO REAL E TELEMETRIA NARRADA */}
              {isRaceSession &&
                (liveEvents.length > 0 || (liveRaceState && liveRaceState.inProgress)) && (
                  <div className="space-y-4">
                    <Card className="bg-[#11161F] border border-[#1F2733] shadow-lg overflow-hidden">
                      <CardHeader className="py-3 px-4 bg-[#0B0E14] border-b border-[#1F2733] flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <CardTitle className="text-sm font-bold text-[#F5F7FA] tracking-wide font-mono flex items-center gap-2">
                            <Radio className="w-4 h-4 text-emerald-400" />
                            FEED DE TRANSMISSÃO AO VIVO // PIT WALL & RÁDIO
                          </CardTitle>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono border-slate-700 text-slate-300"
                        >
                          {liveEvents.length} eventos registrados
                        </Badge>
                      </CardHeader>

                      <CardContent className="p-0">
                        <div className="max-h-[340px] overflow-y-auto divide-y divide-[#1F2733]/60 scrollbar-thin">
                          {liveEvents.map((ev) => {
                            let badgeBg = 'bg-slate-800 text-slate-300 border-slate-700'
                            let icon = <Flag className="w-3.5 h-3.5" />

                            if (ev.type === 'overtake') {
                              badgeBg = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                              icon = <Zap className="w-3.5 h-3.5 text-cyan-400" />
                            } else if (ev.type === 'fastest_lap') {
                              badgeBg = 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              icon = <Flame className="w-3.5 h-3.5 text-purple-400" />
                            } else if (ev.type === 'tire_warning') {
                              badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            } else if (ev.type === 'incident') {
                              badgeBg = 'bg-red-500/20 text-red-300 border-red-500/40'
                              icon = <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                            } else if (ev.type === 'safety_car') {
                              badgeBg = 'bg-amber-400 text-black border-amber-500'
                              icon = <ShieldAlert className="w-3.5 h-3.5" />
                            } else if (ev.type === 'weather') {
                              badgeBg = 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                              icon = <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                            } else if (ev.type === 'pit_stop') {
                              badgeBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              icon = <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                            }

                            return (
                              <div
                                key={ev.id}
                                className={`p-3 text-xs font-mono flex items-start gap-3 transition-colors ${
                                  ev.isPlayer
                                    ? 'bg-[#E10600]/10 border-l-2 border-l-[#E10600]'
                                    : 'hover:bg-[#161D29]/40'
                                }`}
                              >
                                <div className="flex flex-col items-center shrink-0 w-12 text-[10px] text-[#8B95A7]">
                                  <span className="font-bold text-white">V{ev.lap}</span>
                                  <span>{ev.timestamp}</span>
                                </div>

                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0.5 shrink-0 flex items-center gap-1 ${badgeBg}`}
                                >
                                  {icon}
                                  <span className="capitalize">{ev.type.replace('_', ' ')}</span>
                                </Badge>

                                <div className="flex-1 text-[#F5F7FA] leading-relaxed">
                                  {ev.message}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

              {/* Session Results Timesheet (TP1, TP2, Q1, Q2, Q3) */}
              {!isRaceSession && resultsForThis && resultsForThis.length > 0 && (
                <Card className="bg-[#11161F] border-[#1F2733]">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        Tabela de Tempos Oficiais — {sessKey.toUpperCase()}
                      </CardTitle>
                      <CardDescription className="text-xs text-[#8B95A7]">
                        Classificação após voltas rápidas completadas no {gpInfo.circuit}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-400 font-mono text-xs"
                    >
                      Sessão Finalizada
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-[#1F2733] text-[#8B95A7] uppercase tracking-wider">
                            <th className="py-2 px-3 w-12">Pos</th>
                            <th className="py-2 px-3">Piloto</th>
                            <th className="py-2 px-3">Escuderia</th>
                            <th className="py-2 px-3">Pneu</th>
                            <th className="py-2 px-3">Melhor Volta</th>
                            <th className="py-2 px-3 text-right">Diferença</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1F2733]/60">
                          {resultsForThis.slice(0, 15).map((row) => (
                            <tr
                              key={row.position}
                              className={`transition-colors ${
                                row.isPlayer
                                  ? 'bg-[#E10600]/10 font-bold border-l-4 border-l-[#E10600]'
                                  : 'hover:bg-[#161D29]/40'
                              }`}
                            >
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold ${
                                    row.position === 1
                                      ? 'bg-amber-400 text-black'
                                      : row.position <= 3
                                        ? 'bg-slate-300 text-black'
                                        : 'text-[#8B95A7]'
                                  }`}
                                >
                                  {row.position}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={
                                    row.isPlayer ? 'text-[#F5F7FA] font-bold' : 'text-[#F5F7FA]'
                                  }
                                >
                                  {row.driverName}
                                </span>
                                {row.isPlayer && (
                                  <Badge className="ml-2 bg-[#E10600] text-white text-[9px] px-1 py-0 h-3.5">
                                    Sua Equipe
                                  </Badge>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span style={{ color: row.teamColor }}>{row.teamName}</span>
                              </td>
                              <td className="py-2.5 px-3 text-capitalize text-[#8B95A7]">
                                {row.tire}
                              </td>
                              <td className="py-2.5 px-3 text-[#00A6FB]">{row.lapTime}</td>
                              <td className="py-2.5 px-3 text-right text-[#8B95A7]">{row.gap}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* RACE RESULTS (Only for race session) */}
              {isRaceSession && raceResults && (
                <div className="space-y-6">
                  {/* Safety Car / Incidents alert if occurred */}
                  {raceIncidents.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-amber-400 text-xs font-mono uppercase">
                        <ShieldAlert className="w-4 h-4" /> Relatório de Incidentes & Bandeiras
                      </div>
                      <div className="space-y-1 text-xs text-[#F5F7FA] font-mono">
                        {raceIncidents.map((inc, i) => (
                          <div key={i}>{inc}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Classification Table */}
                  <Card className="bg-[#11161F] border-[#1F2733]">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
                      <div>
                        <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                          <Award className="w-5 h-5 text-amber-400" />
                          Resultado Oficial do GP — {gpInfo.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-[#8B95A7]">
                          Desgaste de pneus acumulado, paradas nos boxes e pontos FIA atribuídos.
                        </CardDescription>
                      </div>

                      {/* Advance Button */}
                      <Button
                        size="sm"
                        onClick={handleAdvanceRound}
                        disabled={isFinishing}
                        className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-6 shadow-lg"
                      >
                        {isFinishing ? 'Salvando dados...' : 'Avançar para Próxima Rodada'}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardHeader>

                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-[#1F2733] text-[#8B95A7] uppercase tracking-wider">
                              <th className="py-2.5 px-3">Pos</th>
                              <th className="py-2.5 px-3">Piloto</th>
                              <th className="py-2.5 px-3">Equipe</th>
                              <th className="py-2.5 px-2 text-center">Pneus (1º/2º)</th>
                              <th className="py-2.5 px-2 text-center">Desgaste</th>
                              <th className="py-2.5 px-3">Tempo / Gap</th>
                              <th className="py-2.5 px-3 text-right">Pts</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1F2733]/60">
                            {raceResults.map((row) => (
                              <tr
                                key={row.driverId}
                                className={`transition-colors ${
                                  row.isPlayer
                                    ? 'bg-[#E10600]/10 font-bold border-l-4 border-l-[#E10600]'
                                    : 'hover:bg-[#161D29]/40'
                                }`}
                              >
                                <td className="py-3 px-3">
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold ${
                                      row.position === 1
                                        ? 'bg-amber-400 text-black'
                                        : row.position === 2
                                          ? 'bg-slate-300 text-black'
                                          : row.position === 3
                                            ? 'bg-amber-700 text-white'
                                            : 'text-[#8B95A7]'
                                    }`}
                                  >
                                    {row.dnf ? 'DNF' : row.position}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <span>{row.flag}</span>
                                    <span
                                      className={
                                        row.isPlayer ? 'text-[#F5F7FA] font-bold' : 'text-[#F5F7FA]'
                                      }
                                    >
                                      {row.driverName}
                                    </span>
                                    {row.fastestLap && (
                                      <Badge className="bg-purple-600 text-white text-[9px] px-1 py-0 h-4">
                                        FL +1
                                      </Badge>
                                    )}
                                  </div>
                                  {row.dnfReason && (
                                    <span className="text-[10px] text-red-400 block mt-0.5 font-normal">
                                      {row.dnfReason}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <span style={{ color: row.teamColor }}>{row.teamName}</span>
                                </td>
                                <td className="py-3 px-2 text-center text-[#8B95A7]">
                                  {row.tireCompound?.slice(0, 3)} /{' '}
                                  {row.secondCompound?.slice(0, 3)}
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <span
                                    className={`font-bold ${
                                      (row.tireWear || 0) > 85
                                        ? 'text-red-400'
                                        : (row.tireWear || 0) > 65
                                          ? 'text-amber-400'
                                          : 'text-emerald-400'
                                    }`}
                                  >
                                    {row.tireWear || 70}%
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-[#8B95A7]">{row.totalTime}</td>
                                <td className="py-3 px-3 text-right">
                                  {row.points > 0 ? (
                                    <strong className="text-emerald-400 font-bold text-sm">
                                      +{row.points}
                                    </strong>
                                  ) : (
                                    <span className="text-[#8B95A7]">0</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      {/* 1. DIÁLOGO / MODAL DE DECISÃO ESTRATÉGICA DE CHUVA */}
      <Dialog open={rainDecisionOpen} onOpenChange={setRainDecisionOpen}>
        <DialogContent className="bg-[#11161F] border-2 border-sky-500/70 text-[#F5F7FA] max-w-xl sm:max-w-2xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2 border-b border-[#1F2733] pb-4">
            <div className="flex items-center gap-2 text-sky-400 font-mono text-xs uppercase tracking-wider font-bold">
              <CloudRain className="w-5 h-5 animate-bounce" />
              Alerta Meteorológico • Mudança Climática na Pista
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-[#F5F7FA] flex items-center justify-between">
              <span>🌧️ Começou a Chover na Corrida!</span>
              <Badge className="bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-mono">
                Volta {liveRaceState?.currentLap || 1} de {gpInfo.laps}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-[#8B95A7]">
              O asfalto está molhado no circuito de <strong>{gpInfo.circuit}</strong> (
              {gpInfo.country}). A simulação foi pausada para que a equipe tome uma decisão
              estratégica de pit stop. Escolha uma das 3 opções abaixo:
            </DialogDescription>
          </DialogHeader>

          {/* Context Banner: Track & Rival status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-xs font-mono">
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Condição do Tempo:</span>
              <strong className="text-sky-400 font-semibold flex items-center gap-1.5 mt-0.5">
                <CloudRain className="w-4 h-4" /> Chuva Ativa ({forecast.expectedCondition})
              </strong>
            </div>
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Comportamento dos Rivais:</span>
              <strong className="text-amber-400 font-semibold block mt-0.5">
                IA entrando nos boxes para compostos de chuva
              </strong>
            </div>
          </div>

          {/* Options Grid */}
          <div className="space-y-3 pt-1">
            {/* Option 1: Intermediates */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                tireStock.intermediario > 0
                  ? 'bg-[#161D29]/60 border-emerald-500/40 hover:border-emerald-500 hover:bg-[#161D29]'
                  : 'bg-[#161D29]/20 border-red-900/40 opacity-70'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-600 inline-block" />
                    <h4 className="font-bold text-sm text-[#F5F7FA]">
                      Opção 1: Trocar para INTERMEDIÁRIOS (Verde)
                    </h4>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        tireStock.intermediario > 0
                          ? 'border-emerald-500/40 text-emerald-400'
                          : 'border-red-500/40 text-red-400'
                      }`}
                    >
                      Estoque: {tireStock.intermediario} jogo(s)
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8B95A7]">
                    Ideal para asfalto molhado moderado ou chuva contínua padrão. Garante boa tração
                    e reduz desgaste térmico.
                  </p>
                  {tireStock.intermediario <= 0 && (
                    <p className="text-[11px] text-red-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Composto esgotado no estoque deste fim de semana.
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => handleConfirmRainDecision('intermediario')}
                  disabled={tireStock.intermediario <= 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 shrink-0"
                >
                  {tireStock.intermediario > 0 ? 'Colocar Intermediários' : 'Esgotado'}
                </Button>
              </div>
            </div>

            {/* Option 2: Extreme Wet */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                tireStock.chuva_extrema > 0
                  ? 'bg-[#161D29]/60 border-blue-500/40 hover:border-blue-500 hover:bg-[#161D29]'
                  : 'bg-[#161D29]/20 border-red-900/40 opacity-70'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-600 inline-block" />
                    <h4 className="font-bold text-sm text-[#F5F7FA]">
                      Opção 2: Trocar para CHUVA EXTREMA (Azul)
                    </h4>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        tireStock.chuva_extrema > 0
                          ? 'border-blue-500/40 text-blue-400'
                          : 'border-red-500/40 text-red-400'
                      }`}
                    >
                      Estoque: {tireStock.chuva_extrema} jogo(s)
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8B95A7]">
                    Máxima drenagem de água (85L/segundo). Essencial para tempestades ou poças
                    profundas, máxima segurança contra aquaplanagem.
                  </p>
                  {tireStock.chuva_extrema <= 0 && (
                    <p className="text-[11px] text-red-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Composto esgotado no estoque deste fim de semana.
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => handleConfirmRainDecision('chuva_extrema')}
                  disabled={tireStock.chuva_extrema <= 0}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-9 px-4 shrink-0"
                >
                  {tireStock.chuva_extrema > 0 ? 'Colocar Chuva Extrema' : 'Esgotado'}
                </Button>
              </div>
            </div>

            {/* Option 3: Wait X laps on current tire */}
            <div className="p-4 rounded-xl border border-amber-500/40 bg-[#161D29]/60 hover:bg-[#161D29] transition-all space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h4 className="font-bold text-sm text-[#F5F7FA]">
                      Opção 3: AGUARDAR X voltas no pneu atual
                    </h4>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-amber-500/40 text-amber-400"
                    >
                      Alto Risco
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8B95A7]">
                    Manter os carros na pista com os pneus atuais (slicks) esperando a chuva passar
                    ou torcendo por um Safety Car.
                  </p>
                  <p className="text-[11px] text-amber-300/90 font-mono">
                    ⚠️ Atenção: Rodar de slick na água custa muito tempo e posições, além de alto
                    risco de aquaplanagem e abandono!
                  </p>
                </div>
              </div>

              {/* Slider / Number selector for laps */}
              <div className="pt-2 border-t border-[#1F2733] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#8B95A7]">Voltas a aguardar na pista:</span>
                    <strong className="text-amber-400 text-sm">
                      {rainDecisionWaitLaps} {rainDecisionWaitLaps === 1 ? 'volta' : 'voltas'}
                    </strong>
                  </div>
                  <Slider
                    value={[rainDecisionWaitLaps]}
                    min={1}
                    max={6}
                    step={1}
                    onValueChange={(val) => setRainDecisionWaitLaps(val[0])}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                    <span>1 volta (Risco moderado)</span>
                    <span>3 voltas (Perda severa)</span>
                    <span>6 voltas (Risco extremo)</span>
                  </div>
                </div>

                <Button
                  onClick={() => handleConfirmRainDecision('aguardar')}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9 px-4 shrink-0 sm:self-center"
                >
                  Aguardar {rainDecisionWaitLaps} volta(s)
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. DIÁLOGO DE DECISÃO: TOQUE COM DANO / ASA QUEBRADA */}
      <Dialog open={wingDamageModalOpen} onOpenChange={setWingDamageModalOpen}>
        <DialogContent className="bg-[#11161F] border-2 border-red-500/80 text-[#F5F7FA] max-w-xl sm:max-w-2xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2 border-b border-[#1F2733] pb-4">
            <div className="flex items-center gap-2 text-red-400 font-mono text-xs uppercase tracking-wider font-bold">
              <AlertTriangle className="w-5 h-5 animate-pulse text-red-500" />
              Incidente na Pista • Danos no Monoposto
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-[#F5F7FA] flex items-center justify-between">
              <span>💥 Toque com Dano — Asa Quebrada!</span>
              <Badge className="bg-red-500/20 text-red-300 border border-red-400/40 text-xs font-mono">
                Volta {liveRaceState?.currentLap || 1} de {gpInfo.laps}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-[#8B95A7]">
              O piloto <strong>{wingDamageDriver?.driverName}</strong> sofreu contato direto com um
              adversário e quebrou a placa terminal da asa dianteira. A simulação foi pausada pela
              telemetria do pit wall!
            </DialogDescription>
          </DialogHeader>

          {/* Context box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-xs font-mono">
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Piloto Afetado:</span>
              <strong className="text-white block mt-0.5">{wingDamageDriver?.driverName}</strong>
            </div>
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Pneu Atual:</span>
              <strong className="text-amber-400 block mt-0.5">
                {formatTireName(wingDamageDriver?.tireCompound)} ({wingDamageDriver?.tireWear}%
                desgaste)
              </strong>
            </div>
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Diagnóstico FIA:</span>
              <strong className="text-red-400 block mt-0.5">
                Perda de ~40% de downforce dianteiro
              </strong>
            </div>
          </div>

          {/* Choice 1: Pit stop for nose cone replacement */}
          <div className="space-y-3 pt-1">
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-[#161D29]/60 hover:bg-[#161D29] transition-all space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-bold text-sm text-[#F5F7FA]">
                      Opção 1: BOX IMEDIATO — Trocar Bico e Asa Dianteira
                    </h4>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-emerald-500/40 text-emerald-400"
                    >
                      Recomendado
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8B95A7]">
                    Chamar o piloto para os boxes imediatamente. Os mecânicos trocam todo o bico
                    dianteiro em ~13.8 segundos e colocam um novo jogo de pneus. O carro volta com
                    100% de sustentação aerodinâmica e ritmo total.
                  </p>
                </div>
              </div>

              {/* Select compound for the pit stop */}
              <div className="pt-2 border-t border-[#1F2733] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#8B95A7]">Novo jogo de pneus:</span>
                  <select
                    value={wingDamageTireChoice}
                    onChange={(e) => setWingDamageTireChoice(e.target.value as TireCompound)}
                    className="bg-[#0B0E14] border border-[#1F2733] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  >
                    <option value="duro" disabled={tireStock.duro <= 0}>
                      Duro ({tireStock.duro} rest.)
                    </option>
                    <option value="medio" disabled={tireStock.medio <= 0}>
                      Médio ({tireStock.medio} rest.)
                    </option>
                    <option value="macio" disabled={tireStock.macio <= 0}>
                      Macio ({tireStock.macio} rest.)
                    </option>
                    <option value="intermediario" disabled={tireStock.intermediario <= 0}>
                      Intermediário ({tireStock.intermediario} rest.)
                    </option>
                    <option value="chuva_extrema" disabled={tireStock.chuva_extrema <= 0}>
                      Chuva Extrema ({tireStock.chuva_extrema} rest.)
                    </option>
                  </select>
                </div>

                <Button
                  onClick={() => handleConfirmWingDamageDecision('pit_trocar')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 shrink-0"
                >
                  Confirmar Pit Stop e Troca de Asa
                </Button>
              </div>
            </div>

            {/* Choice 2: Stay on track with broken wing */}
            <div className="p-4 rounded-xl border border-red-500/40 bg-[#161D29]/60 hover:bg-[#161D29] transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-red-400" />
                    <h4 className="font-bold text-sm text-[#F5F7FA]">
                      Opção 2: CONTINUAR NA PISTA — Não parar agora
                    </h4>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-red-500/40 text-red-400"
                    >
                      Extremo Perigo
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8B95A7]">
                    Manter o piloto na pista sem trocar a asa. Não perde tempo nos boxes, mas o
                    ritmo despencará em até 2.5s por volta e há ~28% de risco de quebra total da asa
                    ou colisão com abandono (DNF).
                  </p>
                </div>
                <Button
                  onClick={() => handleConfirmWingDamageDecision('continuar')}
                  variant="outline"
                  className="border-red-500/60 text-red-300 hover:bg-red-500/20 font-bold text-xs h-9 px-4 shrink-0"
                >
                  Assumir Risco e Ficar na Pista
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. DIÁLOGO DE DECISÃO: SAFETY CAR NA PISTA */}
      <Dialog open={safetyCarModalOpen} onOpenChange={setSafetyCarModalOpen}>
        <DialogContent className="bg-[#11161F] border-2 border-amber-500/80 text-[#F5F7FA] max-w-xl sm:max-w-2xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2 border-b border-[#1F2733] pb-4">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider font-bold">
              <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />
              Direção de Prova da FIA • Intervenção do Safety Car
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-[#F5F7FA] flex items-center justify-between">
              <span>🟡 SAFETY CAR NA PISTA!</span>
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-mono">
                Volta {liveRaceState?.currentLap || 1} de {gpInfo.laps}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-[#8B95A7]">
              Motivo do SC: <strong>{safetyCarReason || 'Acidente e detritos na pista'}</strong>. Os
              carros estão em fila indiana a velocidade controlada (delta limitado).
            </DialogDescription>
          </DialogHeader>

          {/* Context box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-xs font-mono">
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Vantagem da Parada sob SC:</span>
              <strong className="text-emerald-400 block mt-0.5">
                Perde apenas ~11s de tempo de volta em vez de ~24s!
              </strong>
            </div>
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Comportamento dos Rivais:</span>
              <strong className="text-amber-400 block mt-0.5">
                Maioria das equipes IA entrando nos boxes para pneus novos
              </strong>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {/* Option 1: Pit under SC */}
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-[#161D29]/60 hover:bg-[#161D29] transition-all space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-bold text-sm text-[#F5F7FA]">
                      Opção 1: ENTRAR NOS BOXES (Parada Barata sob SC)
                    </h4>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-emerald-500/40 text-emerald-400"
                    >
                      Tática Clássica de F1
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8B95A7]">
                    Aproveitar a bandeira amarela para colocar borracha nova sem perder muitas
                    posições. Você relargará com pneus novos contra rivais com desgaste alto.
                  </p>
                </div>
              </div>

              {/* Select compound */}
              <div className="pt-2 border-t border-[#1F2733] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#8B95A7]">Composto de pneu:</span>
                  <select
                    value={safetyCarTireChoice}
                    onChange={(e) => setSafetyCarTireChoice(e.target.value as TireCompound)}
                    className="bg-[#0B0E14] border border-[#1F2733] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  >
                    <option value="duro" disabled={tireStock.duro <= 0}>
                      Duro ({tireStock.duro} rest.)
                    </option>
                    <option value="medio" disabled={tireStock.medio <= 0}>
                      Médio ({tireStock.medio} rest.)
                    </option>
                    <option value="macio" disabled={tireStock.macio <= 0}>
                      Macio ({tireStock.macio} rest.)
                    </option>
                    <option value="intermediario" disabled={tireStock.intermediario <= 0}>
                      Intermediário ({tireStock.intermediario} rest.)
                    </option>
                    <option value="chuva_extrema" disabled={tireStock.chuva_extrema <= 0}>
                      Chuva Extrema ({tireStock.chuva_extrema} rest.)
                    </option>
                  </select>
                </div>

                <Button
                  onClick={() => handleConfirmSafetyCarDecision('pit_sc')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 shrink-0"
                >
                  Fazer Pit Stop sob SC
                </Button>
              </div>
            </div>

            {/* Option 2: Stay out to gain track position */}
            <div className="p-4 rounded-xl border border-cyan-500/40 bg-[#161D29]/60 hover:bg-[#161D29] transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-bold text-sm text-[#F5F7FA]">
                      Opção 2: FICAR NA PISTA (Priorizar Posição de Pista)
                    </h4>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-cyan-500/40 text-cyan-400"
                    >
                      Defesa de Posição
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8B95A7]">
                    Não parar agora. Se os rivais à frente entrarem nos boxes, você ganha posições
                    imediatamente na pista para a relargada. Seus pneus, no entanto, continuarão
                    desgastados.
                  </p>
                </div>
                <Button
                  onClick={() => handleConfirmSafetyCarDecision('stay_out')}
                  variant="outline"
                  className="border-cyan-500/60 text-cyan-300 hover:bg-cyan-500/20 font-bold text-xs h-9 px-4 shrink-0"
                >
                  Ficar na Pista (Track Position)
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
