import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { f1Service } from '@/services/f1Service'
import {
  DriverModel,
  PartModel,
  SponsorModel,
  SessionSetupModel,
  TireCompound,
  TireAllotment,
  TireSetItem,
  DriverRaceStrategy,
  DriverCarSetup,
  WeatherForecast,
} from '@/types/f1'
import { WeekendSession, LiveRaceEvent } from '@/types/race-events'
import {
  TrackWeatherState,
  TIRE_SPECS,
  createInitialTireInventory,
  calculateDriverTireWearProfile,
  calculatePitStopDuration,
  TireCliffStatus,
  calculateTireCliffStatus,
  isTireInCliff,
  calculateLapPerformanceScoreDelta,
} from '@/lib/f1-tire-system'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import {
  getCircuitOvertakeFactor,
  calculateFreeLapPaceSec,
  evaluateOvertakeAttempt,
  formatLapTime,
  formatGap,
} from '@/lib/f1-race-sim-engine'
import { F1_2026_CALENDAR, getAICompetitors, ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { generateAIStrategyProfile } from '@/lib/f1-ai-strategy'
import { formatCurrency } from '@/lib/formatters'
import { CircuitBlueprint } from '@/components/CircuitBlueprint'
import { AmbientBackground } from '@/components/AmbientBackground'
import pb from '@/lib/pocketbase/client'
import defaultAustraliaMap from '@/assets/01-australia-aeace.jpg'
import { CircuitModel } from '@/types/f1'
import { analyzeSetupEngineering } from '@/lib/setup-advisor'
import { useToast } from '@/hooks/use-toast'
import {
  Sun,
  CloudRain,
  Play,
  Trophy,
  ArrowRight,
  Layers,
  Gauge,
  Zap,
  Sliders,
  Disc,
  CheckCircle2,
  AlertTriangle,
  Flag,
  Wrench,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { DriverHelmet } from '@/components/DriverHelmet'

// Sub-componentes modulares da corrida
import { LiveRaceFeed } from '@/components/race/LiveRaceFeed'
import { LiveTelemetryTable } from '@/components/race/LiveTelemetryTable'
import { LiveRaceHUD } from '@/components/race/LiveRaceHUD'
import { PracticeQualyResults, SessionResultRow } from '@/components/race/PracticeQualyResults'
import { RaceResultsTable, RaceResultEntry } from '@/components/race/RaceResultsTable'
import { DecisionModals } from '@/components/race/DecisionModals'
import { SillySeasonModal } from '@/components/race/SillySeasonModal'
import { TeamRadioDialog } from '@/components/TeamRadioDialog'
import {
  evaluateDriverRadioTriggers,
  DriverRadioMessage,
  DriverRadioCooldowns,
  BossResponseType,
  DRIVER_FEEDBACKS,
} from '@/lib/f1-radio-system'

export type { WeekendSession, LiveRaceEvent }

export interface SimDriverEntry extends RaceResultEntry {
  score: number
  points: number
  fastestLap: boolean
  usedOvertake: boolean
  accumulatedTimeSec: number
  lastLapTimeSec?: number
  lapsInDirtyAir?: number
  tireCompound?: TireCompound
  secondCompound?: TireCompound
  pitLap?: number
  tireWear?: number
  driverFatigue?: number
  morale?: number
  physicalCondition?: number
  oldMorale?: number
  newMorale?: number
  moraleDelta?: number
  oldPhysical?: number
  newPhysical?: number
  physicalDelta?: number
  pitStopsDone?: number
  hasWingDamage?: boolean
  lastLapTime?: string
  gapToLeader?: string
  gapToFront?: string
  wearMultiplier?: number
  wearProfileName?: string
  strategyPlan?: { lap: number; compound: TireCompound }[]
  lapsOnCurrentTire?: number
  cliffStatus?: TireCliffStatus
  dnfLap?: number
  fuelRemaining?: number // % combustível restante (0 a 110)
  carPartsHealth?: { id: string; name: string; condition: number }[]
  aiStrategyProfile?: {
    type: 'conservadora' | 'equilibrada' | 'agressiva' | 'reativa'
    label: string
    color: string
    badgeBg: string
    description: string
  }
}

export type SessionTimeResult = SessionResultRow

// Initial tire allotment per weekend per driver
const INITIAL_ALLOTMENT: TireAllotment = {
  duro: 2,
  medio: 3,
  macio: 3,
  intermediario: 4,
  chuva_extrema: 3,
}

// Helper para identificar circuitos fisicamente exigentes
export function isDemandingTrackName(name: string, circuit: string): boolean {
  const demandingTrackKeywords = [
    'Singapura',
    'Marina Bay',
    'Interlagos',
    'São Paulo',
    'Brasil',
    'Malásia',
    'Sepang',
    'Catar',
    'Lusail',
  ]
  return demandingTrackKeywords.some(
    (kw) =>
      name.toLowerCase().includes(kw.toLowerCase()) ||
      circuit.toLowerCase().includes(kw.toLowerCase()),
  )
}

export default function RacePage() {
  const { team, season, refreshTeamAndSeason } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [drivers, setDrivers] = useState<DriverModel[]>([])
  const [parts, setParts] = useState<PartModel[]>([])
  const [sponsors, setSponsors] = useState<SponsorModel[]>([])
  const [circuits, setCircuits] = useState<CircuitModel[]>([])
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
      initial_fuel_load: 100,
    },
  })

  // Selected driver for individual car setup & telemetry view in practice/qualy/race
  const [selectedDriverSetupId, setSelectedDriverSetupId] = useState<string>('')

  // Tire inventory for the GP weekend (allotment counts and individual sets per driver)
  const [tireStock, setTireStock] = useState<TireAllotment>({ ...INITIAL_ALLOTMENT })
  // Inventário de 13 jogos de pneus da FIA 100% individual por piloto (driverId -> TireSetItem[])
  const [driverTireInventories, setDriverTireInventories] = useState<Record<string, TireSetItem[]>>(
    {},
  )

  // Backward compatibility accessor for current driver selected
  const playerTireSets = useMemo(() => {
    if (selectedDriverSetupId && driverTireInventories[selectedDriverSetupId]) {
      return driverTireInventories[selectedDriverSetupId]
    }
    const firstKey = Object.keys(driverTireInventories)[0]
    return firstKey ? driverTireInventories[firstKey] : createInitialTireInventory()
  }, [driverTireInventories, selectedDriverSetupId])

  // Inicializar inventário individual para cada piloto titular do jogador (13 jogos cada, sem compartilhar)
  useEffect(() => {
    if (drivers.length > 0 && team?.id) {
      setDriverTireInventories((prev) => {
        const next = { ...prev }
        let changed = false
        const playerDrivers = drivers.filter((d) => d.team_id === team.id && d.role !== 'reserva')
        for (const drv of playerDrivers) {
          if (!next[drv.id] || next[drv.id].length === 0) {
            next[drv.id] = createInitialTireInventory(drv.id)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }
  }, [drivers, team?.id])

  // Estratégias de corrida personalizadas por piloto (até 4 paradas planejáveis)
  const [driverStrategies, setDriverStrategies] = useState<Record<string, DriverRaceStrategy>>({})

  // Force Pit Stop Modal state
  const [forcePitModalOpen, setForcePitModalOpen] = useState(false)
  const [forcePitSelectedDriverId, setForcePitSelectedDriverId] = useState<string>('')
  const [forcePitSelectedSetId, setForcePitSelectedSetId] = useState<string>('')
  const wasPausedBeforeForcePitRef = useRef<boolean>(false)

  // Session results records
  const [sessionResults, setSessionResults] = useState<Record<string, SessionTimeResult[]>>({})

  // Simulation animation states
  const [isSimulatingSession, setIsSimulatingSession] = useState(false)
  const [simText, setSimText] = useState('')
  const [simProgress, setSimProgress] = useState(0)

  // End of Season / Silly Season Modal State
  const [sillySeasonModalOpen, setSillySeasonModalOpen] = useState(false)
  const [marketMoves, setMarketMoves] = useState<any[]>([])
  const [isProcessingSillySeason, setIsProcessingSillySeason] = useState(false)
  const [isStartingNewSeason, setIsStartingNewSeason] = useState(false)

  // Race final results
  const [raceResults, setRaceResults] = useState<SimDriverEntry[] | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const [seasonCompleted, setSeasonCompleted] = useState(false)

  // Incidents log during race
  const [raceIncidents, setRaceIncidents] = useState<string[]>([])
  const [safetyCarActive, setSafetyCarActive] = useState(false)

  // Live race pause & interval control
  const [isRacePaused, setIsRacePaused] = useState<boolean>(false)
  const isRacePausedRef = useRef<boolean>(false)
  const liveRaceTimerRef = useRef<any>(null)

  // Sincroniza ref com estado de pausa para leitura dentro do loop assíncrono da corrida
  useEffect(() => {
    isRacePausedRef.current = isRacePaused
  }, [isRacePaused])

  // Live race feed & simulation settings (0.5x, 1x, 2x, 4x, Rapido)
  const [liveEvents, setLiveEvents] = useState<LiveRaceEvent[]>([])
  const [simSpeed, setSimSpeed] = useState<number>(1) // 0.5, 1, 2, 4
  const [autoSimulateWithoutPause, setAutoSimulateWithoutPause] = useState<boolean>(false)

  // Modals for tactical decisions during race
  // 1. Broken wing / Touch damage decision modal
  const [wingDamageModalOpen, setWingDamageModalOpen] = useState(false)
  const [wingDamageDriver, setWingDamageDriver] = useState<SimDriverEntry | null>(null)
  const [wingDamageTireChoice, setWingDamageTireChoice] = useState<TireCompound>('duro')

  // 2. Safety car decision modal & queue
  const [safetyCarModalOpen, setSafetyCarModalOpen] = useState(false)
  const [safetyCarReason, setSafetyCarReason] = useState<string>('')
  const [safetyCarTireChoice, setSafetyCarTireChoice] = useState<TireCompound>('medio')
  const [safetyCarQueue, setSafetyCarQueue] = useState<string[]>([])
  const [safetyCarQueueTotal, setSafetyCarQueueTotal] = useState<number>(0)
  const [safetyCarActiveDriverId, setSafetyCarActiveDriverId] = useState<string>('')

  // Team Radio System (Fase 1 do Chefe de Equipe Real)
  const [radioQueue, setRadioQueue] = useState<DriverRadioMessage[]>([])
  const [radioActiveMessage, setRadioActiveMessage] = useState<DriverRadioMessage | null>(null)
  const [radioQueueTotal, setRadioQueueTotal] = useState<number>(1)
  const radioCooldownsRef = useRef<Map<string, DriverRadioCooldowns>>(new Map())
  const tacticalModifiersRef = useRef<
    Map<
      string,
      {
        mode: 'attack' | 'preserve' | 'save_fuel' | 'stay_out'
        expiresAtLap: number
        startLap?: number
      }
    >
  >(new Map())
  const [hudTacticalModes, setHudTacticalModes] = useState<
    Record<string, 'attack' | 'preserve' | 'save_fuel' | 'normal'>
  >({})
  const [forcePitRepairWing, setForcePitRepairWing] = useState<boolean>(false)
  const [forcePitRepairParts, setForcePitRepairParts] = useState<boolean>(false)
  const [raceInitialFuelPct, setRaceInitialFuelPct] = useState<number>(100)
  // Rastreia se piloto respondeu 'stay_out' ("AGUENTE MAIS") durante a prova
  const driversRespondedStayOutRef = useRef<Set<string>>(new Set())
  const hasUsedPreserveModeRef = useRef<boolean>(false)

  // Weather and forecast state with 3 intensity states: seco | chuva_fraca | chuva_forte
  const [weather, setWeather] = useState<TrackWeatherState>('seco')
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
    weather: TrackWeatherState
    grid: SimDriverEntry[]
    safetyCarLapRemaining?: number
  } | null>(null)

  // Rain Decision Modal & Queue state
  const [rainDecisionOpen, setRainDecisionOpen] = useState(false)
  const [rainDecisionWaitLaps, setRainDecisionWaitLaps] = useState(2)
  const [rainQueue, setRainQueue] = useState<string[]>([])
  const [rainQueueTotal, setRainQueueTotal] = useState<number>(0)
  const [rainActiveDriverId, setRainActiveDriverId] = useState<string>('')

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

    // Start weather condition: if prob > 65%, starts raining already (chuva_fraca or chuva_forte), else seco
    const startRain = prob >= 65
    const initialCondition: TrackWeatherState = startRain
      ? prob >= 80
        ? 'chuva_forte'
        : 'chuva_fraca'
      : 'seco'
    setWeather(initialCondition)

    if (currentRound > totalRounds) {
      setSeasonCompleted(true)
      if (season?.market_moves && season.market_moves.length > 0) {
        setMarketMoves(season.market_moves)
      }
    }
  }, [currentRound, totalRounds, gpInfo.circuit, gpInfo.laps, season?.market_moves])

  const loadData = async () => {
    if (!team || !season) {
      setLoading(false)
      return
    }
    try {
      const [dList, pList, spList, savedSetups, circuitsList] = await Promise.all([
        f1Service.getTeamDrivers(team.id),
        f1Service.getTeamParts(team.id),
        f1Service.getTeamSponsors(team.id),
        f1Service.getSessionSetups(team.id, season.id, currentRound),
        f1Service.getAllCircuits(),
      ])
      setDrivers(dList)
      setParts(pList)
      setSponsors(spList)
      setCircuits(circuitsList)

      // Merge saved setups if any
      if (savedSetups.length > 0) {
        setSetups((prev) => {
          const next = { ...prev }
          savedSetups.forEach((s) => {
            if (s.session && next[s.session]) {
              next[s.session] = { ...next[s.session], ...s }
            }
            if (s.session === 'race') {
              if (s.driver_strategies) {
                setDriverStrategies(s.driver_strategies)
              }
              if (s.initial_fuel_load) {
                setRaceInitialFuelPct(s.initial_fuel_load)
              }
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
  useRealtime('circuits', () => {
    loadData()
  })

  // Engine Spec
  const currentEngine = useMemo(() => {
    const sName = team?.engine_supplier || 'Mercedes'
    return ENGINE_SUPPLIERS.find((s) => s.name === sName) || ENGINE_SUPPLIERS[1]
  }, [team?.engine_supplier])

  // ITEM 5: Avaliação do Pool de Motores Comprometido
  const puPoolStatus = useMemo(() => {
    const activeWear = team?.active_engine_wear ?? 15
    const history =
      Array.isArray(team?.engine_history) && team.engine_history.length > 0
        ? team.engine_history
        : [
            {
              id: 1,
              wear: activeWear,
              status: 'instalado',
              supplier: team?.engine_supplier || 'Mercedes',
              introducedRound: 1,
            },
          ]

    const allWornAbove65 = history.every((pu: any) => (pu.wear ?? 0) > 65)
    // Custo de uma nova PU = R$ 15M; verificar se tem orçamento ou margem de teto
    const engineCost = 15000000
    const currentCostCapSpent = team?.cost_cap_spent ?? 0
    const COST_CAP_LIMIT = 135000000
    const hasBudget = (team?.budget ?? 0) >= engineCost
    const hasCapMargin = currentCostCapSpent + engineCost <= COST_CAP_LIMIT
    const cannotAffordOrExceedsCap = !hasBudget || !hasCapMargin

    const isCompromised = allWornAbove65 && cannotAffordOrExceedsCap

    // Encontrar o motor com menor desgaste
    const sortedByWear = [...history].sort((a: any, b: any) => (a.wear ?? 0) - (b.wear ?? 0))
    const leastWornPu = sortedByWear[0] || { id: 1, wear: activeWear }
    const leastWear = leastWornPu.wear ?? activeWear
    const excessOver65 = Math.max(0, leastWear - 65)
    const pacePenaltySec = excessOver65 * 0.03

    return {
      isCompromised,
      leastWornPu,
      leastWear,
      excessOver65,
      pacePenaltySec,
    }
  }, [
    team?.active_engine_wear,
    team?.engine_history,
    team?.budget,
    team?.cost_cap_spent,
    team?.engine_supplier,
  ])

  // Set default selected driver once drivers load
  useEffect(() => {
    if (!selectedDriverSetupId && drivers.length > 0) {
      const titular = drivers.find((d) => d.role !== 'reserva' && d.team_id === team?.id)
      if (titular) setSelectedDriverSetupId(titular.id)
    }
  }, [drivers, team?.id, selectedDriverSetupId])

  // Get car setup specific to a driver in a session (defaults to base session setup)
  const getDriverCarSetup = (sessionKey: WeekendSession, driverId: string): DriverCarSetup => {
    const sess = setups[sessionKey]
    if (sess?.driver_setups && sess.driver_setups[driverId]) {
      return sess.driver_setups[driverId]
    }
    return {
      driverId,
      wing_level: sess?.wing_level ?? gpInfo.downforceIdeal ?? 6,
      suspension_stiffness: sess?.suspension_stiffness ?? gpInfo.suspensionIdeal ?? 6,
      pu_electric_ratio: sess?.pu_electric_ratio ?? 50,
      tire_compound: sess?.tire_compound ?? 'medio',
    }
  }

  // Update car setup for a specific driver
  const updateDriverCarSetup = (
    sessionKey: WeekendSession,
    driverId: string,
    field: keyof DriverCarSetup,
    value: any,
  ) => {
    setSetups((prev) => {
      const currentSess = prev[sessionKey]
      const existingDriverSetup = getDriverCarSetup(sessionKey, driverId)
      const updatedDriverSetup = {
        ...existingDriverSetup,
        [field]: value,
      }
      return {
        ...prev,
        [sessionKey]: {
          ...currentSess,
          driver_setups: {
            ...(currentSess.driver_setups || {}),
            [driverId]: updatedDriverSetup,
          },
        },
      }
    })
  }

  // Setup Engineering Feedback for active session and selected driver
  const setupFeedback = useMemo(() => {
    const currentSetup = setups[activeSession]
    const effectiveSetup =
      selectedDriverSetupId && currentSetup.driver_setups?.[selectedDriverSetupId]
        ? {
            ...currentSetup,
            wing_level: currentSetup.driver_setups[selectedDriverSetupId].wing_level,
            suspension_stiffness:
              currentSetup.driver_setups[selectedDriverSetupId].suspension_stiffness,
            pu_electric_ratio: currentSetup.driver_setups[selectedDriverSetupId].pu_electric_ratio,
          }
        : currentSetup
    return analyzeSetupEngineering(effectiveSetup, gpInfo)
  }, [setups, activeSession, gpInfo, selectedDriverSetupId])

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

  // Estratégias por piloto: inicializador padrão caso não exista
  const getStrategyForDriver = (d: DriverModel): DriverRaceStrategy => {
    if (driverStrategies[d.id]) {
      return driverStrategies[d.id]
    }
    const defaultStart: TireCompound =
      weather === 'chuva_forte'
        ? 'chuva_extrema'
        : weather === 'chuva_fraca'
          ? 'intermediario'
          : 'medio'
    const defaultSecond: TireCompound =
      weather === 'chuva_forte'
        ? 'intermediario'
        : weather === 'chuva_fraca'
          ? 'chuva_extrema'
          : 'duro'
    const targetLap = Math.max(12, Math.round(gpInfo.laps * 0.42))

    return {
      driverId: d.id,
      driverName: d.name,
      startCompound: defaultStart,
      pitStops: [
        {
          id: `pit_1_${d.id}`,
          lap: targetLap,
          compound: defaultSecond,
        },
      ],
    }
  }

  const updateDriverStartCompound = (driverId: string, compound: TireCompound) => {
    setDriverStrategies((prev) => {
      const existing =
        prev[driverId] || getStrategyForDriver(drivers.find((d) => d.id === driverId)!)
      return {
        ...prev,
        [driverId]: {
          ...existing,
          startCompound: compound,
        },
      }
    })
  }

  const addDriverPitStop = (driverId: string) => {
    setDriverStrategies((prev) => {
      const existing =
        prev[driverId] || getStrategyForDriver(drivers.find((d) => d.id === driverId)!)
      if (existing.pitStops.length >= 4) {
        toast({
          variant: 'destructive',
          title: 'Limite de Paradas Atingido',
          description: 'Você pode planejar no máximo 4 paradas por piloto.',
        })
        return prev
      }

      const lastLap =
        existing.pitStops.length > 0
          ? existing.pitStops[existing.pitStops.length - 1].lap
          : Math.round(gpInfo.laps * 0.3)
      const newLap = Math.min(
        gpInfo.laps - 4,
        lastLap + Math.max(8, Math.round(gpInfo.laps * 0.22)),
      )

      const nextCompound: TireCompound =
        weather !== 'seco'
          ? existing.startCompound
          : existing.startCompound === 'duro'
            ? 'medio'
            : 'duro'

      return {
        ...prev,
        [driverId]: {
          ...existing,
          pitStops: [
            ...existing.pitStops,
            {
              id: `pit_${Date.now()}_${Math.random()}`,
              lap: newLap,
              compound: nextCompound,
            },
          ].sort((a, b) => a.lap - b.lap),
        },
      }
    })
  }

  const updateDriverPitStop = (
    driverId: string,
    pitId: string,
    field: 'lap' | 'compound',
    value: any,
  ) => {
    setDriverStrategies((prev) => {
      const existing =
        prev[driverId] || getStrategyForDriver(drivers.find((d) => d.id === driverId)!)
      return {
        ...prev,
        [driverId]: {
          ...existing,
          pitStops: existing.pitStops
            .map((p) => {
              if (p.id === pitId) {
                return { ...p, [field]: value }
              }
              return p
            })
            .sort((a, b) => a.lap - b.lap),
        },
      }
    })
  }

  const removeDriverPitStop = (driverId: string, pitId: string) => {
    setDriverStrategies((prev) => {
      const existing =
        prev[driverId] || getStrategyForDriver(drivers.find((d) => d.id === driverId)!)
      return {
        ...prev,
        [driverId]: {
          ...existing,
          pitStops: existing.pitStops.filter((p) => p.id !== pitId),
        },
      }
    })
  }

  // Executar ou abrir Silly Season manualmente caso a temporada já tenha terminado
  const handleOpenSillySeason = async () => {
    if (!season || !team) return
    if (marketMoves.length > 0) {
      setSillySeasonModalOpen(true)
      return
    }
    setIsProcessingSillySeason(true)
    try {
      const moves = await f1Service.processEndOfSeasonMarket(season.id, team.id)
      setMarketMoves(moves)
      setSillySeasonModalOpen(true)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro no Mercado de Pilotos',
        description: 'Não foi possível processar a movimentação de fim de temporada.',
      })
    } finally {
      setIsProcessingSillySeason(false)
    }
  }

  // Iniciar Próxima Temporada (2027) com grid atualizado e pagamento de premiação de construtores
  const handleStartNextSeason = async () => {
    if (!season || !team) return
    setIsStartingNewSeason(true)
    try {
      const nextYear = (season.year || 2026) + 1
      // Determinar colocação final nos construtores do jogador
      let playerRank = 1
      try {
        const standings = await f1Service.getSeasonRaceResults(season.id)
        if (standings && standings.length > 0) {
          const teamPoints: Record<string, number> = {}
          standings.forEach((r) => {
            const tId = r.team_id || ''
            teamPoints[tId] = (teamPoints[tId] || 0) + (r.points || 0)
          })
          const sorted = Object.entries(teamPoints).sort((a, b) => b[1] - a[1])
          const idx = sorted.findIndex(([tId]) => tId === team.id)
          if (idx >= 0) playerRank = idx + 1
        }
      } catch (err) {
        console.warn('Erro ao obter posição de construtores final:', err)
      }
      await f1Service.startNextSeason(season.id, team.id, nextYear, playerRank)
      await refreshTeamAndSeason()
      setSillySeasonModalOpen(false)
      setSeasonCompleted(false)
      const prize = f1Service.CONSTRUCTOR_PRIZE_BY_RANK[playerRank] || 70000000
      toast({
        title: `🏆 Temporada ${nextYear} Iniciada!`,
        description: `Premiação de P${playerRank} nos Construtores paga: R$ ${(prize / 1000000).toFixed(0)}M adicionados ao saldo!`,
      })
      navigate('/')
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao iniciar temporada',
        description: err?.message || 'Tente novamente.',
      })
    } finally {
      setIsStartingNewSeason(false)
    }
  }

  // Handle saving setup to PocketBase
  const handleSaveSetup = async () => {
    if (!team || !season) return
    const setupData = setups[activeSession]
    try {
      await f1Service.saveSessionSetup({
        ...setupData,
        driver_strategies: activeSession === 'race' ? driverStrategies : undefined,
        team_id: team.id,
        season_id: season.id,
        round: currentRound,
        session: activeSession,
      })
      toast({
        title: `Setup de ${activeSession.toUpperCase()} Salvo`,
        description:
          'As configurações de aerodinâmica, rigidez e estratégias de corrida foram registradas.',
      })
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar setup',
        description: 'Verifique a conexão.',
      })
    }
  }

  // Calculate setup penalty for a session, optionally per driver (deviations from track ideal)
  const calculateSetupDelta = (sessionKey: WeekendSession, driverId?: string) => {
    const current = setups[sessionKey]
    const driverSetup =
      driverId && current.driver_setups?.[driverId] ? current.driver_setups[driverId] : current
    const idealWing = gpInfo.downforceIdeal || 6
    const idealSuspension = gpInfo.suspensionIdeal || 6

    const wingDiff = Math.abs(driverSetup.wing_level - idealWing)
    const suspDiff = Math.abs(driverSetup.suspension_stiffness - idealSuspension)
    // 50/50 balance deviation from 50
    const puDiff = Math.abs(driverSetup.pu_electric_ratio - 50) / 10

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

    // Check if player's drivers were eliminated in previous quali phases
    if (sessionToRun === 'q2' && sessionResults.q1) {
      const q1EliminatedPlayerDrivers = titulars.filter((d) => {
        const q1Res = sessionResults.q1?.find((r) => r.driverId === d.id)
        return q1Res && q1Res.position > 16
      })
      if (q1EliminatedPlayerDrivers.length === titulars.length) {
        toast({
          title: 'Pilotos Eliminados no Q1',
          description:
            'Nenhum dos seus pilotos se classificou entre os 16 primeiros do Q1. A simulação do Q2 continuará sem a sua equipe.',
        })
      }
    }

    if (sessionToRun === 'q3' && sessionResults.q2) {
      const q2EliminatedPlayerDrivers = titulars.filter((d) => {
        const q2Res = sessionResults.q2?.find((r) => r.driverId === d.id)
        return q2Res && q2Res.position > 10
      })
      if (q2EliminatedPlayerDrivers.length === titulars.length) {
        toast({
          title: 'Pilotos Eliminados no Q2',
          description:
            'Nenhum dos seus pilotos se classificou entre os 10 primeiros do Q2 (Top 10 Shootout). A disputa da Pole será entre os rivais.',
        })
      }
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
    let penalty = calculateSetupDelta(sessionToRun)

    // Penalidade por motor excedente (ex: 5º motor = 10 posições, 6º motor = 5 posições)
    const enginePoolUsed = team?.engine_pool_used ?? 1
    const isGridPenalized = enginePoolUsed > 4
    if (sessionToRun === 'race' && isGridPenalized) {
      // Aplica penalidade no score de largada
      penalty += enginePoolUsed === 5 ? 12 : 7
    }

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

        // 1. Player drivers (2 drivers) - Modelo combinado f1-pace-model (70% Carro / 30% Piloto)
        titulars.forEach((d) => {
          // Considerar desgaste acumulado do motor e penalidade de excedente no grid
          const engineWearDeduction = Math.round(((team?.active_engine_wear ?? 15) / 100) * 5)
          const enginePoolUsed = team?.engine_pool_used ?? 1
          const poolPenalty = enginePoolUsed > 4 ? (enginePoolUsed === 5 ? 12 : 7) : 0

          const paceResult = calculateCombinedPace({
            teamStrength: playerTeamStrength,
            carLevel: playerCarLevel,
            driver: {
              speed: d.speed,
              consistency: d.consistency,
              defense: d.defense,
              rain: d.rain,
              morale: d.morale ?? 80,
              physicalCondition: d.physical_condition ?? 90,
            },
            weather,
            tireCompound: chosenTire,
            lapsOnTire: 0,
            wearPercent: 0,
            setupPenalty: penalty,
            engineWearPenalty: engineWearDeduction,
            poolPenalty,
            noise: (Math.random() - 0.5) * 0.5,
            isQualifying: true,
          })

          fullGrid.push({
            driverId: d.id,
            name: d.name,
            team: team?.name || 'Sua Escuderia',
            color: team?.color || '#FF3B30',
            lapScore: paceResult.lapScore,
            isPlayer: true,
            tire: chosenTire,
            morale: d.morale ?? 80,
            fitness: d.physical_condition ?? 90,
          })
        })

        // 2. AI drivers (11 rival teams * 2 = 22 drivers -> Total 24 drivers)
        aiRivals.forEach((ai) => {
          const aiTire: TireCompound =
            weather === 'chuva_forte'
              ? 'chuva_extrema'
              : weather === 'chuva_fraca'
                ? 'intermediario'
                : 'macio'

          const aiPace1 = calculateCombinedPace({
            teamStrength: ai.strength,
            carLevel: ai.carLevel,
            driver: {
              speed: ai.driver1.speed,
              consistency: ai.driver1.consistency,
              defense: ai.driver1.defense,
              rain: ai.driver1.rain,
              morale: 80,
              physicalCondition: 90,
            },
            weather,
            tireCompound: aiTire,
            lapsOnTire: 0,
            wearPercent: 0,
            noise: (Math.random() - 0.5) * 0.5,
            isQualifying: true,
          })

          const aiPace2 = calculateCombinedPace({
            teamStrength: ai.strength,
            carLevel: ai.carLevel,
            driver: {
              speed: ai.driver2.speed,
              consistency: ai.driver2.consistency,
              defense: ai.driver2.defense,
              rain: ai.driver2.rain,
              morale: 80,
              physicalCondition: 90,
            },
            weather,
            tireCompound: aiTire,
            lapsOnTire: 0,
            wearPercent: 0,
            noise: (Math.random() - 0.5) * 0.5,
            isQualifying: true,
          })

          fullGrid.push({
            driverId: `${ai.id}_d1`,
            name: ai.driver1.name,
            team: ai.name,
            color: ai.color,
            lapScore: aiPace1.lapScore,
            isPlayer: false,
            tire: aiTire,
            morale: 80,
            fitness: 90,
          })
          fullGrid.push({
            driverId: `${ai.id}_d2`,
            name: ai.driver2.name,
            team: ai.name,
            color: ai.color,
            lapScore: aiPace2.lapScore,
            isPlayer: false,
            tire: aiTire,
            morale: 80,
            fitness: 90,
          })
        })

        // Handle specific Qualifying elimination rules
        let activeParticipants: RawGridEntry[] = fullGrid
        let eliminatedFromEarlier: SessionTimeResult[] = []

        if (sessionToRun === 'q2' && sessionResults.q1) {
          const q1Top16DriverIds = new Set(sessionResults.q1.slice(0, 16).map((r) => r.driverId))
          activeParticipants = fullGrid.filter((g) => q1Top16DriverIds.has(g.driverId))
          eliminatedFromEarlier = sessionResults.q1.slice(16, 24).map((r) => ({
            ...r,
            isEliminated: true,
            eliminatedInSession: 'q1',
          }))
        } else if (sessionToRun === 'q3' && sessionResults.q2) {
          const q2Top10DriverIds = new Set(sessionResults.q2.slice(0, 10).map((r) => r.driverId))
          activeParticipants = fullGrid.filter((g) => q2Top10DriverIds.has(g.driverId))
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

        // Generate realistic lap times
        const baseMin = 1
        const baseSec = 14 + Math.random() * 3
        const bestScore = activeParticipants[0].lapScore

        const activeFormatted: SessionTimeResult[] = activeParticipants.map((entry, idx) => {
          const gapSec = (bestScore - entry.lapScore) * 0.045
          const entrySec = baseSec + gapSec
          const minPart = baseMin + Math.floor(entrySec / 60)
          const secPart = (entrySec % 60).toFixed(3)
          const lapTime = `${minPart}:${secPart.padStart(6, '0')}`

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

    // Regulation check: for each player driver, verify dry race 2 distinct compounds rule if race is dry
    for (const d of titulars) {
      const strat = getStrategyForDriver(d)
      if (weather === 'seco') {
        const usedCompounds = new Set<TireCompound>([
          strat.startCompound,
          ...strat.pitStops.map((p) => p.compound),
        ])
        const slickCompounds = ['macio', 'medio', 'duro']
        const hasTwoSlicks =
          slickCompounds.filter((c) => usedCompounds.has(c as TireCompound)).length >= 2

        if (strat.pitStops.length > 0 && !hasTwoSlicks) {
          toast({
            variant: 'destructive',
            title: `Regulamento FIA 2026 — ${d.name}`,
            description:
              'É OBRIGATÓRIO usar pelo menos dois compostos diferentes durante a corrida em pista seca (ex: Médio + Duro). Ajuste a estratégia deste piloto.',
          })
          return
        }
      }

      // Check starting tire stock
      if (tireStock[strat.startCompound] <= 0) {
        toast({
          variant: 'destructive',
          title: `Estoque Insuficiente de Pneus — ${d.name}`,
          description: `Você não possui jogos suficientes de pneus ${strat.startCompound.toUpperCase()} para largar.`,
        })
        return
      }
    }

    // Deduct initial starting tires for all player drivers from allotment
    titulars.forEach((d) => {
      const strat = getStrategyForDriver(d)
      setTireStock((prev) => ({
        ...prev,
        [strat.startCompound]: Math.max(0, prev[strat.startCompound] - 1),
      }))
      setDriverTireInventories((prev) => {
        const driverSets = prev[d.id] || []
        const idx = driverSets.findIndex((s) => s.compound === strat.startCompound && !s.isFitted)
        if (idx >= 0) {
          const nextSets = [...driverSets]
          nextSets[idx] = { ...nextSets[idx], isFitted: true }
          return { ...prev, [d.id]: nextSets }
        }
        return prev
      })
    })

    setIsSimulatingSession(true)
    setSimProgress(0)
    setRaceIncidents([])
    setSafetyCarActive(false)
    driversRespondedStayOutRef.current.clear()

    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const aiRivals = getAICompetitors(team?.team_key, isCustomTeam)
    const abrasiveness = gpInfo.tireAbrasiveness || 6

    const initialGrid: SimDriverEntry[] = []
    const engineWearDeduction = Math.round(((team?.active_engine_wear ?? 15) / 100) * 5)
    const enginePoolUsedNum = team?.engine_pool_used ?? 1
    const poolPenaltyNum = enginePoolUsedNum > 4 ? (enginePoolUsedNum === 5 ? 12 : 7) : 0

    const rawDriverPool: {
      driverId: string
      driverName: string
      teamId: string
      teamName: string
      teamColor: string
      isPlayer: boolean
      flag: string
      driverFatigue: number
      morale: number
      physicalCondition: number
      tireCompound: TireCompound
      secondCompound: TireCompound
      pitLap: number
      wearMultiplier: number
      wearProfileName: string
      strategyPlan: { lap: number; compound: TireCompound }[]
    }[] = []

    // 1. Player drivers
    titulars.forEach((d) => {
      const isIncapacitated = !!d.is_incapacitated
      const activeDriver = isIncapacitated && reserve ? reserve : d
      const isSubstituted = isIncapacitated && !!reserve

      const strat = getStrategyForDriver(activeDriver)
      const wearProf = calculateDriverTireWearProfile(activeDriver)

      const driverFatigue = Math.min(
        100,
        (d.age > 35 ? 35 : 20) +
          (sessionResults.tp1 ? 8 : 0) +
          (sessionResults.tp2 ? 8 : 0) +
          (sessionResults.q3 ? 12 : 0),
      )

      const firstPit = strat.pitStops[0]
      const firstPitLap = firstPit ? firstPit.lap : Math.round(gpInfo.laps * 0.42)
      const firstPitCompound = firstPit ? firstPit.compound : 'duro'

      rawDriverPool.push({
        driverId: activeDriver.id,
        driverName: isSubstituted ? `${activeDriver.name} (Substituto)` : activeDriver.name,
        teamId: team?.id || 'player',
        teamName: team?.name || 'Sua Escuderia',
        teamColor: team?.color || '#FF3B30',
        isPlayer: true,
        flag: activeDriver.nationality === 'Brasil' ? '🇧🇷' : '🏁',
        driverFatigue,
        morale: activeDriver.morale ?? 80,
        physicalCondition: activeDriver.physical_condition ?? 90,
        tireCompound: strat.startCompound,
        secondCompound: firstPitCompound,
        pitLap: firstPitLap,
        wearMultiplier: wearProf.multiplier,
        wearProfileName: wearProf.profileName,
        strategyPlan: strat.pitStops.map((p) => ({ lap: p.lap, compound: p.compound })),
      })
    })

    // 2. AI rivals (22 drivers) — Distribuição tática e perfis autênticos por piloto/equipe
    aiRivals.forEach((aiTeam, teamIdx) => {
      const wearProf1 = calculateDriverTireWearProfile({
        speed: aiTeam.driver1.speed || 82,
        consistency: aiTeam.driver1.consistency || 80,
        morale: 80,
        physical_condition: 90,
      })
      const wearProf2 = calculateDriverTireWearProfile({
        speed: aiTeam.driver2.speed || 80,
        consistency: aiTeam.driver2.consistency || 82,
        morale: 80,
        physical_condition: 90,
      })

      // Gerar perfil tático individual variado (Conservador, Equilibrado, Agressivo, Reativo)
      const seed1 = Math.abs(Math.sin((teamIdx + 1) * 17.3 + currentRound * 7.1))
      const seed2 = Math.abs(Math.cos((teamIdx + 2) * 23.7 + currentRound * 5.3))

      const strat1 = generateAIStrategyProfile({
        teamStrength: aiTeam.strength,
        driverSpeed: aiTeam.driver1.speed || 82,
        driverConsistency: aiTeam.driver1.consistency || 80,
        totalLaps: gpInfo.laps,
        weather,
        gridPosition: teamIdx * 2 + 1,
        driverSeed: seed1,
      })

      const strat2 = generateAIStrategyProfile({
        teamStrength: aiTeam.strength,
        driverSpeed: aiTeam.driver2.speed || 80,
        driverConsistency: aiTeam.driver2.consistency || 82,
        totalLaps: gpInfo.laps,
        weather,
        gridPosition: teamIdx * 2 + 2,
        driverSeed: seed2,
      })

      const pitLap1 = strat1.pitStops[0]?.lap || Math.round(gpInfo.laps * 0.42)
      const secondCompound1 = strat1.pitStops[0]?.compound || 'duro'

      const pitLap2 = strat2.pitStops[0]?.lap || Math.round(gpInfo.laps * 0.45)
      const secondCompound2 = strat2.pitStops[0]?.compound || 'duro'

      rawDriverPool.push({
        driverId: `${aiTeam.id}_d1`,
        driverName: aiTeam.driver1.name,
        teamId: aiTeam.id,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        isPlayer: false,
        flag: aiTeam.driver1.flag,
        driverFatigue: 25,
        morale: 80,
        physicalCondition: isDemandingTrackName(gpInfo.name, gpInfo.circuit) ? 85 : 90,
        tireCompound: strat1.startCompound,
        secondCompound: secondCompound1,
        pitLap: pitLap1,
        wearMultiplier: wearProf1.multiplier,
        wearProfileName: wearProf1.profileName,
        strategyPlan: strat1.pitStops.map((p) => ({ lap: p.lap, compound: p.compound })),
        aiStrategyProfile: {
          type: strat1.type,
          label: strat1.label,
          color: strat1.color,
          badgeBg: strat1.badgeBg,
          description: strat1.description,
        },
      } as any)

      rawDriverPool.push({
        driverId: `${aiTeam.id}_d2`,
        driverName: aiTeam.driver2.name,
        teamId: aiTeam.id,
        teamName: aiTeam.name,
        teamColor: aiTeam.color,
        isPlayer: false,
        flag: aiTeam.driver2.flag,
        driverFatigue: 28,
        morale: 80,
        physicalCondition: 90,
        tireCompound: strat2.startCompound,
        secondCompound: secondCompound2,
        pitLap: pitLap2,
        wearMultiplier: wearProf2.multiplier,
        wearProfileName: wearProf2.profileName,
        strategyPlan: strat2.pitStops.map((p) => ({ lap: p.lap, compound: p.compound })),
        aiStrategyProfile: {
          type: strat2.type,
          label: strat2.label,
          color: strat2.color,
          badgeBg: strat2.badgeBg,
          description: strat2.description,
        },
      } as any)
    })

    // Order grid by Q3 result if available, or Q2, or Q1
    const qualiOrder = sessionResults.q3 || sessionResults.q2 || sessionResults.q1
    const orderedPool = qualiOrder
      ? [...rawDriverPool].sort((a, b) => {
          const posA = qualiOrder.findIndex((q) => q.driverId === a.driverId)
          const posB = qualiOrder.findIndex((q) => q.driverId === b.driverId)
          return (posA >= 0 ? posA : 99) - (posB >= 0 ? posB : 99)
        })
      : rawDriverPool

    orderedPool.forEach((driver, idx) => {
      const gridPosition = idx + 1
      const isPlayerDriver = driver.isPlayer
      const gridScoreAdvantage = (24 - gridPosition) * 0.8
      const penalty = isPlayerDriver ? engineWearDeduction + poolPenaltyNum : 0

      // Inicialização do modelo de tempo acumulado: (gridPosition - 1) * 0.350s
      const startAccumulatedTime = (gridPosition - 1) * 0.35

      initialGrid.push({
        driverId: driver.driverId,
        driverName: driver.driverName,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        isPlayer: driver.isPlayer,
        flag: driver.flag,
        score: gridScoreAdvantage - penalty,
        accumulatedTimeSec: Number(startAccumulatedTime.toFixed(3)),
        lapsInDirtyAir: 0,
        position: gridPosition,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        dnf: false,
        totalTime: '',
        tireCompound: driver.tireCompound,
        secondCompound: driver.secondCompound,
        pitLap: driver.pitLap,
        tireWear: 5,
        lapsOnCurrentTire: 1,
        cliffStatus: calculateTireCliffStatus({
          compound: driver.tireCompound || 'medio',
          lapsOnTire: 1,
          wearPercent: 5,
          wearMultiplier: driver.wearMultiplier ?? 1.0,
          trackAbrasiveness: abrasiveness,
        }),
        driverFatigue: driver.driverFatigue,
        morale: driver.morale,
        physicalCondition: driver.physicalCondition,
        pitStopsDone: 0,
        wearMultiplier: driver.wearMultiplier,
        wearProfileName: driver.wearProfileName,
        aiStrategyProfile: (driver as any).aiStrategyProfile,
        strategyPlan: driver.strategyPlan,
        lastLapTime: '1:18.420',
        gapToLeader: gridPosition === 1 ? 'LÍDER' : `+${startAccumulatedTime.toFixed(3)}s`,
        gapToFront: gridPosition === 1 ? '-' : '+0.350s',
      })
    })

    const enginePoolUsed = team?.engine_pool_used ?? 1
    const isPenalized = enginePoolUsed > 4
    const penaltyPlaces = enginePoolUsed === 5 ? 10 : enginePoolUsed > 5 ? 5 : 0

    const initialEvents: LiveRaceEvent[] = []

    if (isPenalized) {
      initialEvents.push({
        id: `ev_pen_${Date.now()}`,
        lap: 1,
        type: 'incident',
        message: `⚠️ PENALIDADE FIA DE GRID: Pilotos da equipe ${team?.name} largam com punição de ${penaltyPlaces} posições devido ao uso de Motor excedente (#${enginePoolUsed} no pool anual).`,
        isPlayer: true,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      })
    }

    const startEvent: LiveRaceEvent = {
      id: `ev_start_${Date.now()}`,
      lap: 1,
      type: 'info',
      message: `🟢 LUZES APAGADAS! Largada autorizada para o ${gpInfo.name} (${gpInfo.laps} voltas) com 24 monopostos na pista!`,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    }
    initialEvents.push(startEvent)

    setLiveEvents(initialEvents)

    // Save live race state and begin simulation loop
    setLiveRaceState({
      inProgress: true,
      currentLap: 1,
      totalLaps: gpInfo.laps,
      weather,
      grid: initialGrid,
    })

    setActiveSession('race')
    runLiveRaceLoop(initialGrid, 1, weather)
  }

  // HELPER: Generate periodic narrated race events as laps progress
  const generateLapNarratedEvents = (
    currentLap: number,
    grid: SimDriverEntry[],
    _currentWeather: TrackWeatherState,
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
    initialWeather: TrackWeatherState,
  ) => {
    let currentGrid = [...initialGrid]
    let currentLap = startLap
    let currentWeather: TrackWeatherState = initialWeather
    const totalLaps = gpInfo.laps
    const abrasiveness = gpInfo.tireAbrasiveness || 6
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const playerTeamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)

    const rainLap =
      initialWeather === 'seco' && forecast.probability >= 35
        ? forecast.rainLapStart || Math.round(totalLaps * 0.38)
        : null

    const dryOutLap =
      initialWeather !== 'seco' || (rainLap && rainLap < totalLaps - 14)
        ? Math.round((rainLap || 8) + 12 + Math.random() * 8)
        : null

    const rainIntensityShiftLap =
      rainLap && rainLap < totalLaps - 8
        ? Math.round(rainLap + 5 + Math.random() * 6)
        : initialWeather !== 'seco'
          ? Math.round(totalLaps * 0.45)
          : null

    const safetyCarLap =
      Math.random() < 0.55 ? Math.round(totalLaps * (0.25 + Math.random() * 0.45)) : null

    const mechanicalFailureLap =
      Math.random() < 0.35 ? Math.round(totalLaps * (0.3 + Math.random() * 0.45)) : null

    const wingDamageLap =
      Math.random() < 0.4 ? Math.round(totalLaps * (0.22 + Math.random() * 0.45)) : null

    const stepIntervalMs = autoSimulateWithoutPause ? 160 : Math.round(10000 / simSpeed)

    if (liveRaceTimerRef.current) {
      clearInterval(liveRaceTimerRef.current)
    }

    const timer = setInterval(() => {
      if (isRacePausedRef.current) {
        return
      }

      currentLap += 1
      const pct = Math.min(99, Math.round((currentLap / totalLaps) * 100))
      setSimProgress(pct)
      setSimText(
        `Volta ${currentLap} de ${totalLaps} • ${gpInfo.circuit} • Velocidade ${simSpeed}x`,
      )

      // Fator de facilidade de ultrapassagem do circuito atual
      const circuitOvertakeFactor = getCircuitOvertakeFactor(gpInfo.name, gpInfo.circuit)
      const currentTrackTemp = forecast.trackTemp || 35
      const overtakeEventsThisLap: LiveRaceEvent[] = []

      // Ordenação anterior (ordem na pista antes da volta ser completada)
      const previousTrackOrder = [...currentGrid]
        .filter((c) => !c.dnf)
        .sort((a, b) => (a.position || 99) - (b.position || 99))

      // PASSO 1: Atualização de pneus, paradas planejadas/estratégicas e cálculo de ritmo livre
      const intermediateStates = currentGrid.map((entry) => {
        if (entry.dnf) return { entry, freeLapSec: 0, pitLossSec: 0, didPitThisLap: false }

        // Modificadores táticos do piloto
        const tacticalMod = tacticalModifiersRef.current.get(entry.driverId)
        const isModActive = entry.isPlayer && tacticalMod && currentLap <= tacticalMod.expiresAtLap
        if (entry.isPlayer && tacticalMod && currentLap > tacticalMod.expiresAtLap) {
          tacticalModifiersRef.current.delete(entry.driverId)
        }

        const spec = TIRE_SPECS[entry.tireCompound || 'medio'] || TIRE_SPECS.medio
        const compoundWearRate = spec.wearFactor
        const driverMultiplier = entry.wearMultiplier ?? 1.0

        // Dirty air extra wear: +0.35% a +0.65%/volta a partir da 3ª volta seguida em dirty air
        const dirtyAirExtraWear = (entry.lapsInDirtyAir || 0) >= 3 ? 0.35 + Math.random() * 0.3 : 0

        // Modificador de desgaste de pneus: 0.75 no modo PRESERVE O CARRO
        const tireWearMultiplier = isModActive && tacticalMod.mode === 'preserve' ? 0.75 : 1.0
        const inc =
          ((compoundWearRate * (abrasiveness / 5)) / 1.5) * driverMultiplier * tireWearMultiplier +
          dirtyAirExtraWear
        let currentWear = Math.min(100, Math.round((entry.tireWear || 5) + inc))

        let nextCompound = entry.tireCompound
        let pitStops = entry.pitStopsDone || 0
        let didPitThisLap = false
        let pitLossSec = 0
        const lapsOnCurrentTire = (entry.lapsOnCurrentTire || 1) + 1

        // 1. Check Player Planned Pit Stops
        if (entry.isPlayer && entry.strategyPlan && entry.strategyPlan.length > 0) {
          const matchingPlan = entry.strategyPlan.find((p) => p.lap === currentLap)
          if (matchingPlan) {
            didPitThisLap = true
            tacticalModifiersRef.current.delete(entry.driverId)
            nextCompound = matchingPlan.compound
            pitStops += 1
            currentWear = 4

            const pitTiming = calculatePitStopDuration(
              team?.name || 'Sua Escuderia',
              entry.driverName,
              true,
              team?.strength || 75,
            )
            // Sob Safety Car a perda de tempo no pit lane é menor (~14s vs 22-25s em bandeira verde)
            pitLossSec = safetyCarActive
              ? pitTiming.durationSec + 11.0
              : pitTiming.durationSec + 19.5

            if (tireStock[matchingPlan.compound] > 0) {
              setTireStock((prev) => ({
                ...prev,
                [matchingPlan.compound]: Math.max(0, prev[matchingPlan.compound] - 1),
              }))
            }

            setLiveEvents((prev) => [
              {
                id: `ev_auto_player_pit_${currentLap}_${entry.driverId}`,
                lap: currentLap,
                type: 'pit_stop',
                message: `🔧 PIT STOP PLANEJADO (#${pitStops})! ${entry.driverName} entra nos boxes na volta ${currentLap}. ${pitTiming.narrativeText} Composto calçado: ${formatTireName(matchingPlan.compound)}.`,
                driverName: entry.driverName,
                teamColor: entry.teamColor,
                isPlayer: true,
                timestamp: new Date().toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
              },
              ...prev,
            ])
          }
        }

        // 2. AI regular or anticipated pit stop execution + Reatividade a undercut do jogador
        let shouldAiAnticipateSoftCliff = false
        if (!entry.isPlayer && entry.tireCompound === 'macio' && pitStops < 4) {
          const softDriverFactor = Math.max(0.75, Math.min(1.35, driverMultiplier))
          const abrasivenessFactor = 1 + (abrasiveness - 5) * 0.07
          const effectiveCliffThreshold = Math.max(
            6,
            Math.round(spec.cliffLapThreshold / (softDriverFactor * abrasivenessFactor)),
          )
          if (lapsOnCurrentTire >= effectiveCliffThreshold - 2) {
            shouldAiAnticipateSoftCliff = true
          }
        }

        let isDefensiveUndercutCover = false
        if (
          !entry.isPlayer &&
          currentWeather === 'seco' &&
          pitStops < 3 &&
          lapsOnCurrentTire >= 8
        ) {
          const aiProfile = entry.aiStrategyProfile
          const isReactive = aiProfile?.type === 'reativa' || aiProfile?.type === 'agressiva'
          if (isReactive) {
            const playerNear = currentGrid.find(
              (p) =>
                p.isPlayer &&
                !p.dnf &&
                Math.abs((p.position || 0) - (entry.position || 0)) <= 2 &&
                (p.lapsOnCurrentTire || 1) <= 2,
            )
            if (playerNear && Math.random() < 0.65) {
              isDefensiveUndercutCover = true
            }
          }
        }

        const matchingPlanLap = entry.strategyPlan?.find((p) => p.lap === currentLap)
        const isScheduledPlanPit = Boolean(matchingPlanLap)
        const isWearCritical =
          currentWear >= (entry.aiStrategyProfile?.type === 'conservadora' ? 86 : 80)

        if (
          !entry.isPlayer &&
          (entry.pitLap === currentLap ||
            isScheduledPlanPit ||
            isWearCritical ||
            shouldAiAnticipateSoftCliff ||
            isDefensiveUndercutCover) &&
          pitStops < 4
        ) {
          didPitThisLap = true
          if (currentWeather === 'seco') {
            if (matchingPlanLap) {
              nextCompound = matchingPlanLap.compound
            } else if (entry.tireCompound === 'macio') {
              nextCompound = 'duro'
            } else if (entry.tireCompound === 'duro') {
              nextCompound = 'medio'
            } else {
              nextCompound = 'duro'
            }
          } else if (currentWeather === 'chuva_fraca') {
            nextCompound = 'intermediario'
          } else {
            nextCompound = 'chuva_extrema'
          }
          pitStops += 1
          currentWear = 5

          if (currentLap < totalLaps - 18 && pitStops < 3) {
            entry.pitLap = currentLap + Math.round((totalLaps - currentLap) * 0.5)
          }

          const pitResult = calculatePitStopDuration(entry.teamName, entry.driverName, false, 75)
          pitLossSec = safetyCarActive ? pitResult.durationSec + 11.0 : pitResult.durationSec + 19.5

          let pitReasonMsg = pitResult.narrativeText
          if (isDefensiveUndercutCover) {
            pitReasonMsg = `🛡️ UNDERCUT DEFENSIVO (IA): ${entry.driverName} cobriu imediatamente a parada do adversário para proteger posição! ${pitResult.narrativeText} Composto: ${formatTireName(nextCompound)}.`
          } else if (shouldAiAnticipateSoftCliff) {
            pitReasonMsg = `⚡ PIT ANTECIPADO (IA): ${entry.driverName} antecipou a parada nos boxes a ~2 voltas do cliff do pneu macio! ${pitResult.narrativeText} Composto: ${formatTireName(nextCompound)}.`
          } else if (isScheduledPlanPit) {
            pitReasonMsg = `🔧 PIT STOP ESTRATÉGICO (${entry.aiStrategyProfile?.label || 'IA'}): ${entry.driverName} cumpre plano na volta ${currentLap}. ${pitResult.narrativeText} Composto: ${formatTireName(nextCompound)}.`
          }

          setLiveEvents((prev) => [
            {
              id: `ev_ai_pit_${currentLap}_${entry.driverId}`,
              lap: currentLap,
              type: 'pit_stop',
              message: pitReasonMsg,
              driverName: entry.driverName,
              teamColor: entry.teamColor,
              isPlayer: false,
              timestamp: new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
            },
            ...prev,
          ])
        }

        const effectiveLapsOnTire = didPitThisLap ? 1 : lapsOnCurrentTire
        const effectiveWear = didPitThisLap ? (entry.isPlayer ? 4 : 5) : currentWear
        const isAttackingNow = isModActive && tacticalMod.mode === 'attack'
        const isPreservingNow = isModActive && tacticalMod.mode === 'preserve'
        const tacticalMode = isAttackingNow ? 'attack' : isPreservingNow ? 'preserve' : undefined

        // Cálculo de força do carro e piloto
        const driverSkillVal =
          (entry.morale ?? 80) * 0.2 + (entry.physicalCondition ?? 90) * 0.1 + 80 * 0.7
        const carStrengthVal = entry.isPlayer
          ? playerCarLevel * 0.65 + playerTeamStrength * 0.35
          : 75

        // Penalidade de dirty air: +0.12s a partir da 3ª volta seguida colado
        const dirtyAirPacePenalty = (entry.lapsInDirtyAir || 0) >= 3 ? 0.12 : 0

        // Cálculo do ritmo livre (sem tráfego) individual
        const { freeLapSec, cliffStatus } = calculateFreeLapPaceSec({
          teamStrength: entry.isPlayer ? playerTeamStrength : 75,
          carLevel: entry.isPlayer ? playerCarLevel : 75,
          driver: {
            speed: driverSkillVal,
            consistency: driverSkillVal,
            defense: driverSkillVal,
            rain: 80,
            morale: entry.morale,
            physicalCondition: entry.physicalCondition,
          },
          weather: currentWeather,
          tireCompound: nextCompound || 'medio',
          lapsOnTire: effectiveLapsOnTire,
          wearPercent: effectiveWear,
          wearMultiplier: driverMultiplier,
          trackAbrasiveness: abrasiveness,
          hasWingDamage: entry.hasWingDamage,
          tacticalMode,
          trackTemp: currentTrackTemp,
          noise: (Math.random() - 0.5) * 0.3,
        })

        const totalFreePace = freeLapSec + dirtyAirPacePenalty

        const updatedEntry: SimDriverEntry = {
          ...entry,
          tireWear: effectiveWear,
          tireCompound: nextCompound,
          pitStopsDone: pitStops,
          lapsOnCurrentTire: effectiveLapsOnTire,
          cliffStatus,
        }

        return {
          entry: updatedEntry,
          freeLapSec: totalFreePace,
          pitLossSec,
          didPitThisLap,
        }
      })

      // PASSO 2: Modelagem de Tráfego, Vácuo, Ultrapassagem como evento e Dirty Air
      // Avaliamos carro a carro de acordo com a ordem da pista
      const processedLaps = new Map<
        string,
        { lapTimeSec: number; extraWear: number; dirtyAirCount: number; passedFront: boolean }
      >()

      for (let i = 0; i < previousTrackOrder.length; i++) {
        const currentCar = previousTrackOrder[i]
        const stateObj = intermediateStates.find((s) => s.entry.driverId === currentCar.driverId)
        if (!stateObj) continue

        const carFreePace = stateObj.freeLapSec

        // Carro líder da fila ou se parou nos boxes nesta volta (livre ou entra na pista atrás)
        if (i === 0 || stateObj.didPitThisLap) {
          const finalLapSec = carFreePace + stateObj.pitLossSec
          processedLaps.set(currentCar.driverId, {
            lapTimeSec: finalLapSec,
            extraWear: 0,
            dirtyAirCount: 0,
            passedFront: false,
          })
          continue
        }

        const carAhead = previousTrackOrder[i - 1]
        const stateAhead = intermediateStates.find((s) => s.entry.driverId === carAhead.driverId)
        const aheadFreePace = stateAhead?.freeLapSec || carFreePace

        // Gap anterior para o carro da frente em tempo acumulado
        const prevGapToFrontSec = Math.max(
          0,
          currentCar.accumulatedTimeSec - carAhead.accumulatedTimeSec,
        )

        let finalLapSec = carFreePace
        let extraWear = 0
        let dirtyAirCount = currentCar.lapsInDirtyAir || 0
        let passedFront = false

        // Dirty air tracking (gap <= 1.2s)
        if (prevGapToFrontSec <= 1.2) {
          dirtyAirCount += 1
        } else if (prevGapToFrontSec > 1.5) {
          dirtyAirCount = 0
        }

        // B) Tráfego e fila: se gapToFront <= 1.0s, o perseguidor não usa o próprio ritmo livre
        if (prevGapToFrontSec <= 1.0) {
          // Anda colado: ritmo limitado pelo carro da frente, mas beneficiado pelo vácuo (-0.15s)
          // lapTime = max(ritmoDaFrente, ritmoLivre - 0.15s)
          const stuckPace = Math.max(aheadFreePace, carFreePace - 0.15)
          finalLapSec = stuckPace

          // C) Função de ultrapassagem discreta: se ritmo livre do perseguidor é melhor
          if (carFreePace < aheadFreePace - 0.05) {
            const hasOvertakeEnergy = Boolean(
              currentCar.isPlayer &&
              tacticalModifiersRef.current.get(currentCar.driverId)?.mode === 'attack',
            )
            const overtakeResult = evaluateOvertakeAttempt({
              attacker: currentCar as any,
              target: carAhead as any,
              attackerFreePaceSec: carFreePace,
              targetFreePaceSec: aheadFreePace,
              circuitOvertakeFactor,
              currentLap,
              hasOvertakeEnergy,
            })

            if (overtakeResult.attempted) {
              if (overtakeResult.success) {
                // Sucesso: atacante conclui ultrapassagem, assume posição à frente (-0.250s do alvo)
                passedFront = true
                dirtyAirCount = 0 // Zera dirty air ao ultrapassar
                if (overtakeResult.narrativeMessage) {
                  overtakeEventsThisLap.push({
                    id: `ev_ot_${currentLap}_${currentCar.driverId}`,
                    lap: currentLap,
                    type: 'overtake',
                    message: overtakeResult.narrativeMessage,
                    driverName: currentCar.driverName,
                    teamColor: currentCar.teamColor,
                    isPlayer: currentCar.isPlayer,
                    timestamp: new Date().toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    }),
                  })
                }
              } else {
                // Falha: atacante perde tempo (+0.4s a +0.7s) e gasta pneu (+1.5%)
                finalLapSec += overtakeResult.attackerTimePenaltySec || 0.5
                extraWear += overtakeResult.attackerExtraWearPct || 1.5
                if (overtakeResult.narrativeMessage && Math.random() < 0.6) {
                  overtakeEventsThisLap.push({
                    id: `ev_def_${currentLap}_${carAhead.driverId}`,
                    lap: currentLap,
                    type: 'overtake',
                    message: overtakeResult.narrativeMessage,
                    driverName: carAhead.driverName,
                    teamColor: carAhead.teamColor,
                    isPlayer: carAhead.isPlayer,
                    timestamp: new Date().toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    }),
                  })
                }
              }
            }
          }
        }

        // Se fez pit stop, soma perda de pit stop
        finalLapSec += stateObj.pitLossSec

        processedLaps.set(currentCar.driverId, {
          lapTimeSec: finalLapSec,
          extraWear,
          dirtyAirCount,
          passedFront,
        })
      }

      // PASSO 3: Atualizar accumulatedTimeSec e ordenar estritamente por tempo acumulado
      const updatedGridIntermediate: SimDriverEntry[] = intermediateStates.map(({ entry }) => {
        if (entry.dnf) return entry

        const lapData = processedLaps.get(entry.driverId)
        const lapSec = lapData?.lapTimeSec || 78.42
        const extraWear = lapData?.extraWear || 0
        const dirtyAirCount = lapData?.dirtyAirCount || 0
        const didPass = lapData?.passedFront || false

        let newAccumulated = entry.accumulatedTimeSec + lapSec
        const finalWear = Math.min(100, (entry.tireWear || 5) + extraWear)

        return {
          ...entry,
          accumulatedTimeSec: Number(newAccumulated.toFixed(3)),
          lastLapTimeSec: Number(lapSec.toFixed(3)),
          tireWear: finalWear,
          lapsInDirtyAir: dirtyAirCount,
          usedOvertake: didPass || entry.usedOvertake,
        }
      })

      // Ordenação estrita por tempo acumulado para pilotos ativos
      const sortedActiveGrid = [...updatedGridIntermediate].sort((a, b) => {
        if (a.dnf && !b.dnf) return 1
        if (!a.dnf && b.dnf) return -1
        if (a.dnf && b.dnf) {
          const lapA = a.dnfLap ?? 0
          const lapB = b.dnfLap ?? 0
          return lapB - lapA
        }
        return a.accumulatedTimeSec - b.accumulatedTimeSec
      })

      // Ajuste fino pós-ultrapassagem se marcado como passedFront: garante que fique à frente por -0.250s
      for (let i = 0; i < sortedActiveGrid.length; i++) {
        const car = sortedActiveGrid[i]
        if (car.dnf) continue
        const lapData = processedLaps.get(car.driverId)
        if (lapData?.passedFront && i > 0) {
          const carAhead = sortedActiveGrid[i - 1]
          if (car.accumulatedTimeSec >= carAhead.accumulatedTimeSec) {
            car.accumulatedTimeSec = Number((carAhead.accumulatedTimeSec - 0.25).toFixed(3))
          }
        }
      }

      // Re-ordenar estritamente após eventual ajuste de ultrapassagem
      sortedActiveGrid.sort((a, b) => {
        if (a.dnf && !b.dnf) return 1
        if (!a.dnf && b.dnf) return -1
        if (a.dnf && b.dnf) {
          return (b.dnfLap ?? 0) - (a.dnfLap ?? 0)
        }
        return a.accumulatedTimeSec - b.accumulatedTimeSec
      })

      // PASSO 4: Formatar gaps reais a partir do tempo acumulado exato
      const leaderAccumulated = sortedActiveGrid.find((g) => !g.dnf)?.accumulatedTimeSec || 0

      currentGrid = sortedActiveGrid.map((entry, idx) => {
        const position = idx + 1
        if (entry.dnf) {
          return {
            ...entry,
            position,
            lastLapTime: 'DNF',
            gapToLeader: 'ABANDONO',
            gapToFront: '-',
          }
        }

        const gapLeaderSec = Math.max(0, entry.accumulatedTimeSec - leaderAccumulated)
        const gapFrontSec =
          idx === 0
            ? 0
            : Math.max(0, entry.accumulatedTimeSec - sortedActiveGrid[idx - 1].accumulatedTimeSec)

        const formattedLap = formatLapTime(entry.lastLapTimeSec || 78.42)
        const gapLeaderStr = position === 1 ? 'LÍDER' : formatGap(gapLeaderSec)
        const gapFrontStr = position === 1 ? '-' : formatGap(gapFrontSec)

        return {
          ...entry,
          position,
          lastLapTime: formattedLap,
          gapToLeader: gapLeaderStr,
          gapToFront: gapFrontStr,
        }
      })

      const narratedEvents = generateLapNarratedEvents(currentLap, currentGrid, currentWeather)
      const combinedLapEvents = [...overtakeEventsThisLap, ...narratedEvents]
      if (combinedLapEvents.length > 0) {
        setLiveEvents((prev) => [...combinedLapEvents, ...prev].slice(0, 40))
      }

      setLiveRaceState({
        inProgress: true,
        currentLap,
        totalLaps,
        weather: currentWeather,
        grid: currentGrid,
      })

      // AVALIAÇÃO DE RÁDIO DO PILOTO (Fase 1 - Team Radio System)
      if (!autoSimulateWithoutPause) {
        const triggeredRadioMsgs: DriverRadioMessage[] = []
        for (let i = 0; i < currentGrid.length; i++) {
          const car = currentGrid[i]
          if (!car.isPlayer || car.dnf) continue

          const rawGapFront = car.gapToFront || ''
          const gapFrontSec =
            rawGapFront === 'LÍDER' || rawGapFront === '-' || !rawGapFront
              ? 0
              : parseFloat(rawGapFront.replace(/[+s]/g, '')) || 0

          const nextCar = currentGrid[i + 1]
          let gapBehindSec = 99
          if (nextCar && !nextCar.dnf) {
            const rawGapBehind = nextCar.gapToFront || ''
            gapBehindSec =
              rawGapBehind === 'LÍDER' || rawGapBehind === '-' || !rawGapBehind
                ? 0
                : parseFloat(rawGapBehind.replace(/[+s]/g, '')) || 99
          }

          const driverMorale = car.morale ?? 80
          const engineWear = team?.active_engine_wear ?? 15
          const cliffResult = isTireInCliff(
            car.tireCompound || 'medio',
            car.lapsOnCurrentTire || 1,
            car.wearMultiplier ?? 1.0,
            gpInfo.tireAbrasiveness || 6,
          )
          const tacticalMod = tacticalModifiersRef.current.get(car.driverId)
          const isStayOutActive =
            tacticalMod?.mode === 'stay_out' && currentLap <= tacticalMod.expiresAtLap
          const engineWearMult = tacticalMod?.mode === 'preserve' ? 0.85 : 1.0

          const radioContext = {
            driverId: car.driverId,
            driverName: car.driverName,
            teamName: car.teamName,
            teamColor: car.teamColor,
            isPlayer: true,
            tireCompound: car.tireCompound || 'medio',
            tireWear: isStayOutActive ? 0 : car.tireWear || 0,
            lapsOnCurrentTire: car.lapsOnCurrentTire || 1,
            cliffStatus: isStayOutActive ? undefined : car.cliffStatus,
            isInCliff: isStayOutActive ? false : cliffResult.inCliff,
            position: car.position || i + 1,
            gapToFront: car.gapToFront,
            gapFrontSec,
            gapBehindSec,
            engineWear: Math.round(engineWear * engineWearMult),
            wearProfileName: car.wearProfileName,
            morale: driverMorale,
            speed: tacticalMod?.mode === 'attack' ? 95 : 80,
            defense: tacticalMod?.mode === 'preserve' ? 95 : 80,
          }

          const currentCooldowns = radioCooldownsRef.current.get(car.driverId) || {}
          const result = evaluateDriverRadioTriggers(
            radioContext,
            currentLap,
            currentWeather,
            currentCooldowns,
          )

          // Suprimir gatilho de cliff/pneus se stay_out estiver ativo (as 2 voltas)
          const isTireOrCliffMessage =
            result &&
            (result.message.category === 'cliff' ||
              result.message.category === 'tire_critical' ||
              result.message.category === 'tire_high')

          if (result && (!isStayOutActive || !isTireOrCliffMessage)) {
            radioCooldownsRef.current.set(car.driverId, result.updatedCooldowns)
            triggeredRadioMsgs.push(result.message)
          }
        }

        if (triggeredRadioMsgs.length > 0) {
          clearInterval(timer)
          liveRaceTimerRef.current = null
          isRacePausedRef.current = true
          setIsRacePaused(true)
          setRadioActiveMessage(triggeredRadioMsgs[0])
          setRadioQueue(triggeredRadioMsgs.slice(1))
          setRadioQueueTotal(triggeredRadioMsgs.length)
          return
        }
      }

      // CHECK DYNAMIC WEATHER: TRACK DRYING UP
      if (
        dryOutLap &&
        currentLap === dryOutLap &&
        currentWeather !== 'seco' &&
        currentLap < totalLaps - 5
      ) {
        clearInterval(timer)
        liveRaceTimerRef.current = null
        setIsRacePaused(true)
        isRacePausedRef.current = true

        currentWeather = 'seco'
        setWeather('seco')
        const dryEvent: LiveRaceEvent = {
          id: `ev_dry_${currentLap}`,
          lap: currentLap,
          type: 'weather',
          message: `☀️ A CHUVA PAROU! O sol reapareceu no ${gpInfo.circuit} e a pista está secando rapidamente! Formou-se o trilho seco. Pneus de chuva estão sobreaquecendo! Janela aberta para retorno aos slicks!`,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        }
        setLiveEvents((prev) => [dryEvent, ...prev])

        currentGrid.forEach((entry) => {
          if (!entry.isPlayer && !entry.dnf) {
            entry.pitLap = currentLap + Math.floor(Math.random() * 2) + 1
            entry.secondCompound = 'medio'
          }
        })

        setLiveRaceState({
          inProgress: true,
          currentLap,
          totalLaps,
          weather: currentWeather,
          grid: currentGrid,
        })
        setIsSimulatingSession(false)

        const activePlayerCars = currentGrid.filter((g) => g.isPlayer && !g.dnf)
        if (activePlayerCars.length > 0) {
          const ids = activePlayerCars.map((c) => c.driverId)
          setRainActiveDriverId(ids[0])
          setRainQueue(ids.slice(1))
          setRainQueueTotal(ids.length)
          setRainDecisionOpen(true)
          toast({
            title: '☀️ A CHUVA PAROU / PISTA SECANDO! [CORRIDA CONGELADA]',
            description: `Volta ${currentLap}/${totalLaps}: Decisão 1 de ${ids.length} (${activePlayerCars[0].driverName}). Escolha a estratégia de troca para slicks ou manter composto.`,
          })
        }
        return
      }

      // CHECK DECISION PAUSE 1: RAIN ARRIVAL
      if (
        !autoSimulateWithoutPause &&
        rainLap &&
        currentLap === rainLap &&
        currentWeather === 'seco'
      ) {
        clearInterval(timer)
        liveRaceTimerRef.current = null
        setIsRacePaused(true)
        isRacePausedRef.current = true

        const isStorm = forecast.expectedCondition === 'Tempestade' || forecast.probability >= 75
        currentWeather = isStorm ? 'chuva_forte' : 'chuva_fraca'
        setWeather(currentWeather)

        const rainEvent: LiveRaceEvent = {
          id: `ev_rain_${currentLap}`,
          lap: currentLap,
          type: 'weather',
          message:
            currentWeather === 'chuva_forte'
              ? `⛈️ TEMPESTADE DESABOU! Chuva torrencial no ${gpInfo.circuit}! Pista inundada com poças profundas. Obrigatório composto de Chuva Extrema para evitar aquaplanagem!`
              : `🌧️ COMEÇOU A CHOVER! Chuva fraca/moderada no ${gpInfo.circuit}! Asfalto úmido favorece pneus Intermediários.`,
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
          weather: currentWeather,
          grid: currentGrid,
        })
        setIsSimulatingSession(false)

        const activePlayerCars = currentGrid.filter((g) => g.isPlayer && !g.dnf)
        if (activePlayerCars.length > 0) {
          const ids = activePlayerCars.map((c) => c.driverId)
          setRainActiveDriverId(ids[0])
          setRainQueue(ids.slice(1))
          setRainQueueTotal(ids.length)
          setRainDecisionOpen(true)
          toast({
            title:
              currentWeather === 'chuva_forte'
                ? '⛈️ TEMPESTADE NA PISTA! [CORRIDA CONGELADA]'
                : '🌧️ COMEÇOU A CHOVER NA PISTA! [CORRIDA CONGELADA]',
            description: `Volta ${currentLap}/${totalLaps}: Decisão 1 de ${ids.length} (${activePlayerCars[0].driverName}). Escolha a estratégia de pneus.`,
          })
        }
        return
      }

      // CHECK DECISION PAUSE 1B: RAIN INTENSITY SHIFT
      if (
        !autoSimulateWithoutPause &&
        rainIntensityShiftLap &&
        currentLap === rainIntensityShiftLap &&
        currentWeather !== 'seco'
      ) {
        clearInterval(timer)
        liveRaceTimerRef.current = null
        setIsRacePaused(true)
        isRacePausedRef.current = true

        const nextRainCondition: TrackWeatherState =
          currentWeather === 'chuva_fraca' ? 'chuva_forte' : 'chuva_fraca'
        currentWeather = nextRainCondition
        setWeather(nextRainCondition)

        const shiftEvent: LiveRaceEvent = {
          id: `ev_rain_shift_${currentLap}`,
          lap: currentLap,
          type: 'weather',
          message:
            nextRainCondition === 'chuva_forte'
              ? `⛈️ A CHUVA APERTOU! A intensidade aumentou para Tempestade / Chuva Forte no ${gpInfo.circuit}! Risco severo de aquaplanagem.`
              : `🌧️ A CHUVA DIMINUIU DE INTENSIDADE! Volume de água diminuiu para Chuva Fraca/Moderada no ${gpInfo.circuit}. Intermediários voltam a ser ideais.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        }
        setLiveEvents((prev) => [shiftEvent, ...prev])

        setLiveRaceState({
          inProgress: true,
          currentLap,
          totalLaps,
          weather: currentWeather,
          grid: currentGrid,
        })
        setIsSimulatingSession(false)

        const activePlayerCars = currentGrid.filter((g) => g.isPlayer && !g.dnf)
        if (activePlayerCars.length > 0) {
          const ids = activePlayerCars.map((c) => c.driverId)
          setRainActiveDriverId(ids[0])
          setRainQueue(ids.slice(1))
          setRainQueueTotal(ids.length)
          setRainDecisionOpen(true)
          toast({
            title:
              nextRainCondition === 'chuva_forte'
                ? '⛈️ TEMPESTADE INTENSIFICOU! [CORRIDA CONGELADA]'
                : '🌧️ CHUVA ENFRAQUECEU! [CORRIDA CONGELADA]',
            description: `Volta ${currentLap}/${totalLaps}: Decisão 1 de ${ids.length} (${activePlayerCars[0].driverName}). Ajuste a estratégia de pneus.`,
          })
        }
        return
      }

      // CHECK DECISION PAUSE 2: TOQUE COM DANO / ASA QUEBRADA DO JOGADOR
      // No modo de ataque, chance dobrada de incidente / toque com dano
      const hasAttackActive = currentGrid.some(
        (g) =>
          g.isPlayer &&
          !g.dnf &&
          tacticalModifiersRef.current.get(g.driverId)?.mode === 'attack' &&
          currentLap <= (tacticalModifiersRef.current.get(g.driverId)?.expiresAtLap ?? 0),
      )
      const isWingDamageLapTriggered =
        wingDamageLap &&
        (currentLap === wingDamageLap ||
          (hasAttackActive && Math.random() < 0.12 && currentLap > 3 && currentLap < totalLaps - 3))

      if (!autoSimulateWithoutPause && isWingDamageLapTriggered && !wingDamageModalOpen) {
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
        liveRaceTimerRef.current = null
        setIsRacePaused(true)
        isRacePausedRef.current = true
        setSafetyCarActive(true)

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

        currentGrid.forEach((entry) => {
          if (!entry.isPlayer && !entry.dnf) {
            // Reação sob Safety Car: quem tem mais de 28% de desgaste ou calça pneu macio aproveita a janela de pit stop barato
            const stratType = entry.aiStrategyProfile?.type || 'equilibrada'
            const minWearForPit = stratType === 'reativa' || stratType === 'agressiva' ? 24 : 36
            const isSoftWorn = entry.tireCompound === 'macio' && (entry.tireWear || 0) > 20

            if (
              ((entry.tireWear || 0) >= minWearForPit || isSoftWorn) &&
              (entry.pitStopsDone || 0) < 3
            ) {
              const scNextCompound: TireCompound =
                currentWeather === 'seco'
                  ? entry.tireCompound === 'duro'
                    ? 'medio'
                    : 'duro'
                  : currentWeather === 'chuva_fraca'
                    ? 'intermediario'
                    : 'chuva_extrema'

              entry.tireCompound = scNextCompound
              entry.tireWear = 6
              entry.lapsOnCurrentTire = 1
              entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
              entry.score += 4 // Bônus de pit stop barato sob SC
            }
          }
        })

        const activePlayerCars = currentGrid.filter((g) => g.isPlayer && !g.dnf)
        if (activePlayerCars.length > 0) {
          const ids = activePlayerCars.map((c) => c.driverId)
          const firstDriver = activePlayerCars[0]
          setSafetyCarActiveDriverId(ids[0])
          setSafetyCarQueue(ids.slice(1))
          setSafetyCarQueueTotal(ids.length)
          setSafetyCarTireChoice(firstDriver.secondCompound || 'duro')
          setIsSimulatingSession(false)
          setSafetyCarModalOpen(true)
          toast({
            title: '🟡 SAFETY CAR NA PISTA! [CORRIDA CONGELADA]',
            description: `Volta ${currentLap}/${totalLaps}: Decisão 1 de ${ids.length} (${firstDriver.driverName}). Entrar nos boxes ou ficar na pista?`,
          })
        }
        return
      }

      // CHECK FALHA MECÂNICA OCASIONAL EM CARRO DA IA (Probabilidade controlada de ~10% na prova)
      if (mechanicalFailureLap && currentLap === mechanicalFailureLap && !safetyCarActive) {
        const eligibleFailures = currentGrid.filter((g) => !g.isPlayer && !g.dnf)
        if (eligibleFailures.length > 0 && Math.random() < 0.4) {
          const brokenCar = eligibleFailures[Math.floor(Math.random() * eligibleFailures.length)]
          brokenCar.dnf = true
          brokenCar.dnfLap = currentLap
          const failureTypes = [
            'Falha de pressão hidráulica no câmbio',
            'Superaquecimento catastrófico do MGU-K',
            'Perda repentina de telemetria e potência do motor',
            'Quebra de suspensão traseira na zebra',
          ]
          const chosenFailure = failureTypes[Math.floor(Math.random() * failureTypes.length)]
          brokenCar.dnfReason = chosenFailure

          setLiveEvents((prev) => [
            {
              id: `ev_mech_fail_${currentLap}_${brokenCar.driverId}`,
              lap: currentLap,
              type: 'incident',
              message: `🚨 FALHA MECÂNICA! Fumaça no carro de ${brokenCar.driverName} (${brokenCar.teamName})! Abandono imediato por ${chosenFailure.toLowerCase()}.`,
              driverName: brokenCar.driverName,
              teamColor: brokenCar.teamColor,
              isPlayer: false,
              timestamp: new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
            },
            ...prev,
          ])
        }
      }

      // Check if race laps completed
      if (currentLap >= totalLaps) {
        clearInterval(timer)
        liveRaceTimerRef.current = null
        finishRaceSimulation(currentGrid, currentWeather)
      }
    }, stepIntervalMs)

    liveRaceTimerRef.current = timer
  }

  // Helper central: Aplica troca definitiva de pneus para um piloto do jogador
  const applyTireSwitchToPlayerDriver = (
    grid: SimDriverEntry[],
    driverId: string,
    newCompound: TireCompound,
    currentLap: number,
    options?: {
      newWear?: number
      newCliffWear?: number
      customSetId?: string
      preserveFuturePlan?: boolean
    },
  ) => {
    const target = grid.find((g) => g.driverId === driverId)
    if (!target) return

    // Limpar modificadores táticos ao trocar de pneu
    tacticalModifiersRef.current.delete(driverId)

    const effectiveWear = options?.newWear ?? 5

    // 1. Limpar paradas programadas a partir de currentLap
    if (!options?.preserveFuturePlan) {
      target.strategyPlan = (target.strategyPlan || []).filter((s) => s.lap < currentLap)
    }

    // 2. Atualizar estado do carro na prova
    target.tireCompound = newCompound
    target.secondCompound = newCompound
    target.tireWear = effectiveWear
    target.lapsOnCurrentTire = 1
    target.cliffStatus = calculateTireCliffStatus({
      compound: newCompound,
      lapsOnTire: 1,
      wearPercent: options?.newCliffWear ?? effectiveWear,
      wearMultiplier: target.wearMultiplier ?? 1.0,
      trackAbrasiveness: gpInfo.tireAbrasiveness || 6,
    })

    // 3. Atualizar driverStrategies
    setDriverStrategies((prev) => {
      const existing = prev[driverId]
      if (!existing) return prev
      return {
        ...prev,
        [driverId]: {
          ...existing,
          startCompound: existing.startCompound,
          pitStops: options?.preserveFuturePlan
            ? existing.pitStops
            : (existing.pitStops || []).filter((p) => p.lap < currentLap),
        },
      }
    })

    // 4. Atualizar driverTireInventories do piloto
    setDriverTireInventories((prev) => {
      const currentSets = prev[driverId] || []
      let fittedNew = false
      const updatedSets = currentSets.map((set) => {
        if (options?.customSetId) {
          if (set.id === options.customSetId) {
            fittedNew = true
            return { ...set, isFitted: true, lapsUsed: set.lapsUsed + 1 }
          }
          if (set.isFitted) {
            return { ...set, isFitted: false, wear: Math.max(set.wear, target.tireWear || 50) }
          }
          return set
        }

        if (set.isFitted) {
          return { ...set, isFitted: false, wear: Math.max(set.wear, target.tireWear || 50) }
        }
        if (!fittedNew && !set.isFitted && set.compound === newCompound) {
          fittedNew = true
          return { ...set, isFitted: true, lapsUsed: set.lapsUsed + 1 }
        }
        return set
      })
      return { ...prev, [driverId]: updatedSets }
    })
  }

  // Handle Player Weather Decision
  const handleConfirmRainDecision = (
    decision: 'intermediario' | 'chuva_extrema' | 'macio' | 'medio' | 'duro' | 'aguardar',
  ) => {
    if (!liveRaceState) return
    const currentGrid = [...liveRaceState.grid]
    const currentLap = liveRaceState.currentLap
    const currentWeather = liveRaceState.weather
    const incidents = [...raceIncidents]
    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const isFirstDecision = rainQueue.length + 1 === rainQueueTotal
    if (isFirstDecision) {
      currentGrid.forEach((entry) => {
        if (!entry.isPlayer) {
          const optimalAiCompound: TireCompound =
            currentWeather === 'seco'
              ? 'medio'
              : currentWeather === 'chuva_forte'
                ? 'chuva_extrema'
                : 'intermediario'

          if (entry.tireCompound !== optimalAiCompound) {
            entry.tireCompound = optimalAiCompound
            entry.tireWear = 6
            entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
            entry.lapsOnCurrentTire = 1
            entry.cliffStatus = calculateTireCliffStatus({
              compound: optimalAiCompound,
              lapsOnTire: 1,
              wearPercent: 6,
              wearMultiplier: entry.wearMultiplier ?? 1.0,
              trackAbrasiveness: gpInfo.tireAbrasiveness || 6,
            })

            const aiPit = calculatePitStopDuration(entry.teamName, entry.driverName, false, 78)
            setLiveEvents((prev) => [
              {
                id: `ev_ai_weatherpit_${Date.now()}_${entry.driverId}`,
                lap: currentLap,
                type: 'pit_stop',
                message: `🔄 BOX RIVAL (CLIMA): ${entry.driverName} montou pneus ${formatTireName(optimalAiCompound)} (${aiPit.durationSec.toFixed(2)}s).`,
                driverName: entry.driverName,
                teamColor: entry.teamColor,
                isPlayer: false,
                timestamp: nowStr,
              },
              ...prev,
            ])
          }
        }
      })
    }

    const currentDriver = currentGrid.find((g) => g.driverId === rainActiveDriverId)

    if (currentDriver) {
      if (decision === 'aguardar') {
        const waitLaps = Math.max(1, rainDecisionWaitLaps)
        const penaltyScore = waitLaps * (currentWeather === 'chuva_forte' ? 24 : 15)
        const accidentRisk = Math.min(88, waitLaps * (currentWeather === 'chuva_forte' ? 32 : 18))
        const hadAccident = Math.random() * 100 < accidentRisk

        const waitMsg = `🌧️ ESTRATÉGIA ARRISCADA (${currentDriver.driverName}): Você decidiu aguardar ${waitLaps} volta(s) com slicks sob ${currentWeather === 'chuva_forte' ? 'chuva torrencial' : 'asfalto molhado'}!`
        incidents.push(waitMsg)
        setLiveEvents((prev) => [
          {
            id: `ev_wait_${Date.now()}_${currentDriver.driverId}`,
            lap: currentLap,
            type: 'weather',
            message: waitMsg,
            timestamp: nowStr,
          },
          ...prev,
        ])

        if (hadAccident) {
          const crashMsg = `💥 AQUAPLANAGEM VIOLENTA: ${currentDriver.driverName} perdeu totalmente a linha em poça d'água com slicks e bateu no muro!`
          incidents.push(crashMsg)
          setLiveEvents((prev) => [
            {
              id: `ev_crash_${Date.now()}_${currentDriver.driverId}`,
              lap: currentLap,
              type: 'incident',
              message: crashMsg,
              timestamp: nowStr,
            },
            ...prev,
          ])
          currentDriver.dnf = true
          currentDriver.dnfReason = 'Aquaplanagem com pneus de pista seca na chuva'
        } else {
          incidents.push(
            `⏱️ PERDA DE RITMO (${currentDriver.driverName}): Sem aderência no molhado com slicks, perdeu ~${(waitLaps * 3.4).toFixed(1)}s por volta!`,
          )
          const autoWet: TireCompound =
            currentWeather === 'chuva_forte' ? 'chuva_extrema' : 'intermediario'
          currentDriver.tireWear = Math.min(100, (currentDriver.tireWear || 50) + waitLaps * 8)
          currentDriver.score -= penaltyScore
          currentDriver.pitStopsDone = (currentDriver.pitStopsDone || 0) + 1

          applyTireSwitchToPlayerDriver(currentGrid, currentDriver.driverId, autoWet, currentLap, {
            newWear: currentDriver.tireWear,
            newCliffWear: currentDriver.tireWear,
          })

          if (tireStock[autoWet] > 0) {
            setTireStock((prev) => ({
              ...prev,
              [autoWet]: Math.max(0, prev[autoWet] - 1),
            }))
          }
        }
      } else {
        const chosenTire = decision
        if (tireStock[chosenTire] > 0) {
          setTireStock((prev) => ({
            ...prev,
            [chosenTire]: Math.max(0, prev[chosenTire] - 1),
          }))
        }

        const pitResult = calculatePitStopDuration(
          team?.name || 'Sua Escuderia',
          currentDriver.driverName,
          true,
          team?.chassis_level || 75,
        )
        const pitMsg = `🌧️ ${currentDriver.driverName}: ${pitResult.narrativeText} (Troca para ${formatTireName(chosenTire)})`
        incidents.push(pitMsg)
        setLiveEvents((prev) => [
          {
            id: `ev_wetpit_${Date.now()}_${currentDriver.driverId}`,
            lap: currentLap,
            type: 'pit_stop',
            message: pitMsg,
            driverName: currentDriver.driverName,
            teamColor: currentDriver.teamColor,
            isPlayer: true,
            timestamp: nowStr,
          },
          ...prev,
        ])

        currentDriver.pitStopsDone = (currentDriver.pitStopsDone || 0) + 1
        // Duração do pit somada ao tempo acumulado (perda de pit lane ~21.5s sob chuva)
        currentDriver.accumulatedTimeSec = Number(
          ((currentDriver.accumulatedTimeSec || 0) + pitResult.durationSec + 19.5).toFixed(3),
        )
        applyTireSwitchToPlayerDriver(currentGrid, currentDriver.driverId, chosenTire, currentLap, {
          newWear: 5,
          newCliffWear: 5,
        })
      }
    }

    setRaceIncidents(incidents)
    setLiveRaceState({
      ...liveRaceState,
      grid: currentGrid,
    })

    if (rainQueue.length > 0) {
      const nextDriverId = rainQueue[0]
      const nextQueue = rainQueue.slice(1)
      const nextDriver = currentGrid.find((g) => g.driverId === nextDriverId)
      setRainActiveDriverId(nextDriverId)
      setRainQueue(nextQueue)
      const currentStep = rainQueueTotal - nextQueue.length
      toast({
        title: `🌧️ Decisão ${currentStep} de ${rainQueueTotal}: ${nextDriver?.driverName || 'Piloto'}`,
        description: `Escolha a estratégia independente para este carro.`,
      })
    } else {
      setRainDecisionOpen(false)
      setRainActiveDriverId('')
      setRainQueueTotal(0)
      setIsRacePaused(false)
      isRacePausedRef.current = false
      setIsSimulatingSession(true)
      setSimText(
        currentWeather === 'seco'
          ? 'Retomando corrida em pista seca...'
          : `Retomando corrida sob ${currentWeather === 'chuva_forte' ? 'chuva forte' : 'chuva fraca'}...`,
      )
      runLiveRaceLoop(currentGrid, currentLap, currentWeather)
    }
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
      if (tireStock[wingDamageTireChoice] > 0) {
        setTireStock((prev) => ({
          ...prev,
          [wingDamageTireChoice]: Math.max(0, prev[wingDamageTireChoice] - 1),
        }))
      }

      const pitResult = calculatePitStopDuration(
        team?.name || 'Sua Escuderia',
        driver.driverName,
        true,
        team?.chassis_level || 75,
      )
      const totalStopSeconds = (pitResult.durationSec + 10.5).toFixed(2)

      currentGrid.forEach((entry) => {
        if (entry.driverId === driver.driverId) {
          entry.hasWingDamage = false
          entry.tireCompound = wingDamageTireChoice
          entry.tireWear = 6
          entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
          entry.lapsOnCurrentTire = 1
          entry.accumulatedTimeSec = Number(
            ((entry.accumulatedTimeSec || 0) + pitResult.durationSec + 10.5 + 19.5).toFixed(3),
          )
          entry.cliffStatus = calculateTireCliffStatus({
            compound: wingDamageTireChoice,
            lapsOnTire: 1,
            wearPercent: 6,
            wearMultiplier: entry.wearMultiplier ?? 1.0,
            trackAbrasiveness: gpInfo.tireAbrasiveness || 6,
          })
          entry.score -= 8
        }
      })

      const msg = `🔧 PIT STOP COM TROCA DE BICO: ${driver.driverName} nos boxes! Equipe trocou asa dianteira e pneus ${formatTireName(wingDamageTireChoice)} em ${totalStopSeconds}s (${pitResult.narrativeText}). Carro liberado!`
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
      const secondaryCrash = Math.random() < 0.28
      currentGrid.forEach((entry) => {
        if (entry.driverId === driver.driverId) {
          entry.hasWingDamage = true
          entry.score -= 28
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

    runLiveRaceLoop(currentGrid, currentLap, liveRaceState.weather)
  }

  // Handle Player Decision for Safety Car
  const handleConfirmSafetyCarDecision = (decision: 'pit_sc' | 'stay_out') => {
    if (!liveRaceState) return
    const currentGrid = [...liveRaceState.grid]
    const currentLap = liveRaceState.currentLap
    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const targetDriver = currentGrid.find((g) => g.driverId === safetyCarActiveDriverId)

    if (targetDriver) {
      if (decision === 'pit_sc') {
        if (tireStock[safetyCarTireChoice] > 0) {
          setTireStock((prev) => ({
            ...prev,
            [safetyCarTireChoice]: Math.max(0, prev[safetyCarTireChoice] - 1),
          }))
        }

        const pitResult = calculatePitStopDuration(
          team?.name || 'Sua Escuderia',
          targetDriver.driverName,
          true,
          team?.chassis_level || 75,
        )
        const msg = `🟡 PIT STOP SOB SAFETY CAR: ${targetDriver.driverName} calçou pneus ${formatTireName(safetyCarTireChoice)} em ${pitResult.durationSec.toFixed(2)}s (${pitResult.narrativeText}). Janela perfeita!`
        setRaceIncidents((prev) => [...prev, msg])
        setLiveEvents((prev) => [
          {
            id: `ev_sc_pit_${Date.now()}_${targetDriver.driverId}`,
            lap: currentLap,
            type: 'pit_stop',
            message: msg,
            driverName: targetDriver.driverName,
            teamColor: targetDriver.teamColor,
            isPlayer: true,
            timestamp: nowStr,
          },
          ...prev,
        ])

        targetDriver.pitStopsDone = (targetDriver.pitStopsDone || 0) + 1
        targetDriver.score += 6
        // Pit sob Safety Car tem perda reduzida de tempo no pit lane (~11s delta vs 19.5s)
        targetDriver.accumulatedTimeSec = Number(
          ((targetDriver.accumulatedTimeSec || 0) + pitResult.durationSec + 11.0).toFixed(3),
        )

        applyTireSwitchToPlayerDriver(
          currentGrid,
          targetDriver.driverId,
          safetyCarTireChoice,
          currentLap,
          {
            newWear: 5,
            newCliffWear: 5,
          },
        )

        toast({
          title: `Pit Stop Sob Safety Car: ${targetDriver.driverName}`,
          description: `Pneus novos (${formatTireName(safetyCarTireChoice)}) montados sem perda pesada de tempo.`,
        })
      } else {
        targetDriver.score += 3
        const msg = `🟡 ESTRATÉGIA DE PISTA: ${targetDriver.driverName} permaneceu na pista sob Safety Car para defender posição.`
        setRaceIncidents((prev) => [...prev, msg])
        setLiveEvents((prev) => [
          {
            id: `ev_sc_stay_${Date.now()}_${targetDriver.driverId}`,
            lap: currentLap,
            type: 'info',
            message: msg,
            driverName: targetDriver.driverName,
            teamColor: targetDriver.teamColor,
            isPlayer: true,
            timestamp: nowStr,
          },
          ...prev,
        ])
      }
    }

    setLiveRaceState({
      ...liveRaceState,
      grid: currentGrid,
    })

    if (safetyCarQueue.length > 0) {
      const nextDriverId = safetyCarQueue[0]
      const nextQueue = safetyCarQueue.slice(1)
      const nextDriver = currentGrid.find((g) => g.driverId === nextDriverId)
      setSafetyCarActiveDriverId(nextDriverId)
      setSafetyCarQueue(nextQueue)
      if (nextDriver) {
        setSafetyCarTireChoice(nextDriver.secondCompound || 'duro')
      }
      const currentStep = safetyCarQueueTotal - nextQueue.length
      toast({
        title: `🟡 Decisão ${currentStep} de ${safetyCarQueueTotal}: ${nextDriver?.driverName || 'Piloto'}`,
        description: `Escolha a estratégia sob Safety Car para este carro.`,
      })
    } else {
      setSafetyCarModalOpen(false)
      setSafetyCarActiveDriverId('')
      setSafetyCarQueueTotal(0)

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

      setIsRacePaused(false)
      isRacePausedRef.current = false
      setIsSimulatingSession(true)
      runLiveRaceLoop(currentGrid, currentLap, liveRaceState.weather)
    }
  }

  // Handle Forced Pit Stop Action by Player
  const handleOpenForcePitModal = () => {
    if (!liveRaceState) return
    const activePlayerDrivers = liveRaceState.grid.filter((g) => g.isPlayer && !g.dnf)
    if (activePlayerDrivers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum piloto ativo',
        description: 'Não há pilotos da equipe na pista para realizar parada.',
      })
      return
    }

    wasPausedBeforeForcePitRef.current = isRacePausedRef.current
    setIsRacePaused(true)
    isRacePausedRef.current = true

    const defaultDriverId = activePlayerDrivers[0].driverId
    setForcePitSelectedDriverId(defaultDriverId)
    const driverInventory = driverTireInventories[defaultDriverId] || playerTireSets
    const availableSet = driverInventory.find((s) => !s.isFitted && s.wear < 90)
    setForcePitSelectedSetId(availableSet ? availableSet.id : driverInventory[0]?.id || '')
    setForcePitModalOpen(true)
  }

  const handleCloseForcePitModal = () => {
    setForcePitModalOpen(false)
    if (!wasPausedBeforeForcePitRef.current) {
      setIsRacePaused(false)
      isRacePausedRef.current = false
    }
  }

  const handleExecuteForcedPitStop = () => {
    if (!liveRaceState || !forcePitSelectedDriverId || !forcePitSelectedSetId) return

    const driverInventory = driverTireInventories[forcePitSelectedDriverId] || playerTireSets
    const selectedSet = driverInventory.find((s) => s.id === forcePitSelectedSetId)
    if (!selectedSet) {
      toast({
        variant: 'destructive',
        title: 'Jogo de pneus inválido',
        description: 'Selecione um jogo de pneus válido do estoque do piloto.',
      })
      return
    }

    const currentGrid = [...liveRaceState.grid]
    const currentLap = liveRaceState.currentLap
    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const targetDriver = currentGrid.find((g) => g.driverId === forcePitSelectedDriverId)
    if (!targetDriver) return

    const pitResult = calculatePitStopDuration(
      team?.name || 'Sua Escuderia',
      targetDriver.driverName,
      true,
      team?.chassis_level || 75,
    )

    if (selectedSet.lapsUsed === 0 && tireStock[selectedSet.compound] > 0) {
      setTireStock((prev) => ({
        ...prev,
        [selectedSet.compound]: Math.max(0, prev[selectedSet.compound] - 1),
      }))
    }

    targetDriver.pitStopsDone = (targetDriver.pitStopsDone || 0) + 1
    targetDriver.score -= pitResult.isSlowPit ? 12 : 7
    // Duração real do pit somada ao tempo acumulado (pit stop + perda de tráfego/pit lane)
    targetDriver.accumulatedTimeSec = Number(
      ((targetDriver.accumulatedTimeSec || 0) + pitResult.durationSec + 19.5).toFixed(3),
    )

    applyTireSwitchToPlayerDriver(
      currentGrid,
      targetDriver.driverId,
      selectedSet.compound,
      currentLap,
      {
        newWear: selectedSet.wear,
        newCliffWear: selectedSet.wear,
        customSetId: selectedSet.id,
      },
    )

    const eventMsg = `🔧 BOX FORÇADO: ${pitResult.narrativeText} [Pneus: ${formatTireName(selectedSet.compound)} - ${selectedSet.wear === 0 ? 'NOVO 100%' : `Usado (${selectedSet.wear}% desgaste)`}]`
    setRaceIncidents((prev) => [...prev, eventMsg])
    setLiveEvents((prev) => [
      {
        id: `ev_forcepit_${Date.now()}_${targetDriver.driverId}`,
        lap: currentLap,
        type: 'pit_stop',
        message: eventMsg,
        driverName: targetDriver.driverName,
        teamColor: targetDriver.teamColor,
        isPlayer: true,
        timestamp: nowStr,
      },
      ...prev,
    ])

    setLiveRaceState({
      ...liveRaceState,
      grid: currentGrid,
    })

    setForcePitModalOpen(false)
    if (!wasPausedBeforeForcePitRef.current) {
      setIsRacePaused(false)
      isRacePausedRef.current = false
    }

    toast({
      title: pitResult.isSlowPit ? '⚠️ PIT STOP LENTO!' : '✅ PIT STOP CONCLUÍDO!',
      description: `${targetDriver.driverName} calçou pneus ${formatTireName(selectedSet.compound)} (${pitResult.durationSec.toFixed(2)}s). Corrida retomada.`,
    })
  }

  // Handle Boss Response to Team Radio (EDIT 2)
  const handleRadioResponse = (
    responseType: BossResponseType,
    options?: {
      tireSetId?: string
      chosenCompound?: TireCompound
      driverFeedbackText?: string
    },
  ) => {
    if (!radioActiveMessage) return

    const driverMsg = radioActiveMessage
    const driverFeedback =
      options?.driverFeedbackText ||
      DRIVER_FEEDBACKS[responseType]?.[0] ||
      'Entendido, copiado pit wall!'

    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    // Registrar evento team_radio no feed (setLiveEvents, prev primeiro)
    const radioEvent: LiveRaceEvent = {
      id: `ev_radio_${Date.now()}_${driverMsg.driverId}`,
      lap: driverMsg.lap,
      type: 'team_radio',
      message: `📻 RÁDIO (${driverMsg.driverName}): "${driverMsg.message}" ➔ Pit Wall: [${responseType.toUpperCase()}] ➔ Piloto: "${driverFeedback}"`,
      driverName: driverMsg.driverName,
      teamColor: driverMsg.teamColor,
      isPlayer: true,
      timestamp: nowStr,
    }
    setLiveEvents((prev) => [radioEvent, ...prev])

    const activeCurrentLap = liveRaceState?.currentLap ?? driverMsg.lap

    // PASSO 3 — Efeitos reais das 4 ordens do chefe
    if (responseType === 'box_now') {
      // 1. BOX AGORA: pit forçado na volta corrente; limpar modificadores táticos ativos
      tacticalModifiersRef.current.delete(driverMsg.driverId)

      if (liveRaceState) {
        const currentGrid = [...liveRaceState.grid]
        const targetDriver = currentGrid.find((g) => g.driverId === driverMsg.driverId)
        if (targetDriver) {
          const driverInventory = driverTireInventories[driverMsg.driverId] || playerTireSets
          const selectedSet = options?.tireSetId
            ? driverInventory.find((s) => s.id === options.tireSetId)
            : driverInventory.find((s) => !s.isFitted && s.wear < 90) || driverInventory[0]

          const chosenCompound: TireCompound =
            selectedSet?.compound ||
            options?.chosenCompound ||
            targetDriver.secondCompound ||
            'medio'

          const pitResult = calculatePitStopDuration(
            team?.name || 'Sua Escuderia',
            targetDriver.driverName,
            true,
            team?.chassis_level || 75,
          )

          if (selectedSet && selectedSet.lapsUsed === 0 && tireStock[selectedSet.compound] > 0) {
            setTireStock((prev) => ({
              ...prev,
              [selectedSet.compound]: Math.max(0, prev[selectedSet.compound] - 1),
            }))
          } else if (!selectedSet && tireStock[chosenCompound] > 0) {
            setTireStock((prev) => ({
              ...prev,
              [chosenCompound]: Math.max(0, prev[chosenCompound] - 1),
            }))
          }

          targetDriver.pitStopsDone = (targetDriver.pitStopsDone || 0) + 1
          targetDriver.score -= pitResult.isSlowPit ? 12 : 7
          // Duração real do pit somada ao tempo acumulado
          targetDriver.accumulatedTimeSec = Number(
            ((targetDriver.accumulatedTimeSec || 0) + pitResult.durationSec + 19.5).toFixed(3),
          )

          applyTireSwitchToPlayerDriver(
            currentGrid,
            targetDriver.driverId,
            chosenCompound,
            activeCurrentLap,
            {
              newWear: selectedSet?.wear ?? 4,
              newCliffWear: selectedSet?.wear ?? 4,
              customSetId: selectedSet?.id,
            },
          )

          const pitMsg = `🔧 BOX AGORA (RÁDIO): ${pitResult.narrativeText} [Pneus: ${formatTireName(chosenCompound)} - ${!selectedSet || selectedSet.wear === 0 ? 'NOVO 100%' : `Usado (${selectedSet.wear}% desgaste)`}]`
          setRaceIncidents((prev) => [...prev, pitMsg])
          setLiveEvents((prev) => [
            {
              id: `ev_radio_pit_${Date.now()}_${targetDriver.driverId}`,
              lap: activeCurrentLap,
              type: 'pit_stop',
              message: pitMsg,
              driverName: targetDriver.driverName,
              teamColor: targetDriver.teamColor,
              isPlayer: true,
              timestamp: nowStr,
            },
            ...prev,
          ])

          setLiveRaceState((prev) => (prev ? { ...prev, grid: currentGrid } : null))
          toast({
            title: pitResult.isSlowPit ? '⚠️ BOX AGORA - PIT LENTO!' : '✅ BOX AGORA CONCLUÍDO!',
            description: `${targetDriver.driverName} calçou pneus ${formatTireName(chosenCompound)} (${pitResult.durationSec.toFixed(2)}s).`,
          })
        }
      }
    } else if (responseType === 'stay_out') {
      // 2. AGUENTE MAIS: expiração = currentLap + 2; suspende gatilho de cliff/pneus por 2 voltas
      // Piloto com moral alta (85+) aceita com queda de moral reduzida (-1 em vez de -3)
      driversRespondedStayOutRef.current.add(driverMsg.driverId)
      tacticalModifiersRef.current.set(driverMsg.driverId, {
        mode: 'stay_out',
        expiresAtLap: activeCurrentLap + 2,
        startLap: activeCurrentLap,
      })

      const currentMorale =
        liveRaceState?.grid.find((g) => g.driverId === driverMsg.driverId)?.morale ??
        drivers.find((d) => d.id === driverMsg.driverId)?.morale ??
        80
      const moraleLoss = currentMorale >= 85 ? 1 : 3

      if (liveRaceState) {
        const currentGrid = [...liveRaceState.grid]
        const targetDriver = currentGrid.find((g) => g.driverId === driverMsg.driverId)
        if (targetDriver) {
          targetDriver.morale = Math.max(5, (targetDriver.morale ?? 80) - moraleLoss)
          setLiveRaceState((prev) => (prev ? { ...prev, grid: currentGrid } : null))
        }
      }
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driverMsg.driverId
            ? { ...d, morale: Math.max(5, (d.morale ?? 80) - moraleLoss) }
            : d,
        ),
      )

      // Cooldown de acknowledgement para não repetir imediatamente
      const currentCd = radioCooldownsRef.current.get(driverMsg.driverId) || {}
      radioCooldownsRef.current.set(driverMsg.driverId, {
        ...currentCd,
        acknowledgedStayOutCliffLap: activeCurrentLap,
        lastLapCliff: activeCurrentLap,
        lastLapTireCrit: activeCurrentLap,
        lastLapTireHigh: activeCurrentLap,
      })

      toast({
        title: '📻 ORDEM: AGUENTE MAIS',
        description:
          moraleLoss === 1
            ? `${driverMsg.driverName} (Moral Alta) compreende a estratégia e fica na pista por mais 2 voltas (Moral -1). Alertas de pneus suspensos.`
            : `${driverMsg.driverName} fica na pista contrariado por mais 2 voltas (Moral -3). Alertas de pneus suspensos.`,
      })
    } else if (responseType === 'attack_mode') {
      // 3. MODO ATAQUE: +3% de ritmo por 5 voltas, chance de incidente/dano dobrada
      tacticalModifiersRef.current.set(driverMsg.driverId, {
        mode: 'attack',
        expiresAtLap: activeCurrentLap + 5,
        startLap: activeCurrentLap,
      })

      toast({
        title: '⚡ ORDEM: MODO ATAQUE!',
        description: `${driverMsg.driverName} acionou ritmo de ataque (+3% de ritmo por 5 voltas. Risco de incidentes dobrado).`,
      })
    } else if (responseType === 'preserve_car') {
      // 4. PRESERVE O CARRO: desgaste de pneus 0,75 e motor 0,85 por 8 voltas, ritmo -1,5%; moral estável
      hasUsedPreserveModeRef.current = true
      tacticalModifiersRef.current.set(driverMsg.driverId, {
        mode: 'preserve',
        expiresAtLap: activeCurrentLap + 8,
        startLap: activeCurrentLap,
      })

      toast({
        title: '🛡️ ORDEM: PRESERVE O CARRO',
        description: `${driverMsg.driverName} está poupando equipamento (Desgaste pneus 75%, motor 85%, ritmo -1,5% por 8 voltas).`,
      })
    }

    // Avançar fila ou limpar e retomar
    if (radioQueue.length > 0) {
      setRadioActiveMessage(radioQueue[0])
      setRadioQueue(radioQueue.slice(1))
    } else {
      setRadioActiveMessage(null)
      setRadioQueue([])
      setRadioQueueTotal(0)
      setIsRacePaused(false)
      isRacePausedRef.current = false
      if (liveRaceState && liveRaceState.inProgress) {
        runLiveRaceLoop(liveRaceState.grid, liveRaceState.currentLap, liveRaceState.weather)
      }
    }
  }

  // Calculate final positions, points, tire degradation & race results
  const finishRaceSimulation = async (grid: SimDriverEntry[], _finalWeather: TrackWeatherState) => {
    const incidents = [...raceIncidents]

    const activeDrivers = grid
      .filter((e) => !e.dnf)
      .sort((a, b) => (a.position || 0) - (b.position || 0))

    const dnfDrivers = grid
      .filter((e) => e.dnf)
      .sort((a, b) => {
        const lapA = a.dnfLap ?? 0
        const lapB = b.dnfLap ?? 0
        if (lapB !== lapA) {
          return lapB - lapA
        }
        return (a.position || 0) - (b.position || 0)
      })

    const finalOrderedGrid = [...activeDrivers, ...dnfDrivers]

    const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    const winnerAccTime = finalOrderedGrid[0]?.accumulatedTimeSec || 0
    const winnerMinutes = Math.floor(winnerAccTime / 60)
    const winnerRemainingSec = (winnerAccTime % 60).toFixed(3)

    finalOrderedGrid.forEach((entry, idx) => {
      entry.position = idx + 1
      entry.points = !entry.dnf && idx < pointsTable.length ? pointsTable[idx] : 0

      if (entry.dnf) {
        entry.totalTime = 'ABANDONO (DNF)'
      } else if (idx === 0) {
        entry.totalTime = `${winnerMinutes}m ${winnerRemainingSec}s`
      } else {
        const exactGap = Math.max(0, (entry.accumulatedTimeSec || 0) - winnerAccTime).toFixed(3)
        entry.totalTime = `+${exactGap}s`
      }
    })

    const top10 = finalOrderedGrid.filter((g) => !g.dnf && g.position <= 10)
    if (top10.length > 0) {
      const flIndex = Math.floor(Math.random() * top10.length)
      top10[flIndex].fastestLap = true
      top10[flIndex].points += 1
    }

    // ==========================================
    // CICLO PÓS-CORRIDA DE MORAL E CONDIÇÃO FÍSICA
    // ==========================================
    // Circuitos fisicamente exigentes (Singapura, Malásia/Sepang, Interlagos ou calor/umidade proxy)
    const isDemandingCircuit = isDemandingTrackName(gpInfo.name, gpInfo.circuit)

    finalOrderedGrid.forEach((entry) => {
      const currentDriverMorale = entry.morale ?? 80
      const currentDriverPhysical = entry.physicalCondition ?? 90

      // 1. Moral por resultado
      let moraleDelta = 0
      if (entry.dnf) {
        moraleDelta = -6
      } else if (entry.position === 1) {
        moraleDelta = 8
      } else if (entry.position >= 2 && entry.position <= 3) {
        moraleDelta = 5
      } else if (entry.position >= 4 && entry.position <= 10) {
        moraleDelta = 2
      } else {
        moraleDelta = -3
      }

      // Penalidade adicional: respondeu "AGUENTE MAIS" e o carro caiu para fora da zona de pontos com pneu no cliff
      const respondedStayOut = driversRespondedStayOutRef.current.has(entry.driverId)
      const isOutsidePoints = entry.position > 10 || entry.dnf
      const isEndedInCliff =
        (entry.cliffStatus?.isCliffReached ?? 0) > 0 || (entry.tireWear ?? 0) >= 80
      if (entry.isPlayer && respondedStayOut && isOutsidePoints && isEndedInCliff) {
        moraleDelta -= 3
      }

      // Clampar moral entre 5 e 100
      const updatedMorale = Math.max(5, Math.min(100, currentDriverMorale + moraleDelta))

      // 2. Condição física dinâmica
      // Cada corrida custa forma física: -4 a -8, com custo extra (-3 adicional) em circuitos fisicamente exigentes
      const baseCost = Math.floor(Math.random() * 5) + 4 // 4 a 8
      const physicalCost = baseCost + (isDemandingCircuit ? 3 : 0)
      const physicalDelta = -physicalCost

      // Clampar entre 5 e 100
      const updatedPhysical = Math.max(5, Math.min(100, currentDriverPhysical + physicalDelta))

      // Atribuir para visualização e persistência
      entry.oldMorale = currentDriverMorale
      entry.newMorale = updatedMorale
      entry.moraleDelta = updatedMorale - currentDriverMorale
      entry.morale = updatedMorale

      entry.oldPhysical = currentDriverPhysical
      entry.newPhysical = updatedPhysical
      entry.physicalDelta = updatedPhysical - currentDriverPhysical
      entry.physicalCondition = updatedPhysical
    })

    // Persistência imediata de moral e física dos pilotos no banco (antes de avançar a rodada)
    // Garantir idempotência por rodada com season.last_processed_round
    if (season && team && season.last_processed_round !== currentRound) {
      const playerGridEntries = finalOrderedGrid.filter((g) => g.isPlayer)
      for (const entry of playerGridEntries) {
        try {
          const targetDriver = drivers.find((d) => d.id === entry.driverId)
          if (targetDriver) {
            await f1Service.updateDriver(targetDriver.id, {
              morale: entry.newMorale,
              physical_condition: entry.newPhysical,
            })

            const mDiff = (entry.newMorale ?? 80) - (entry.oldMorale ?? 80)
            const mSign = mDiff > 0 ? `+${mDiff}` : `${mDiff}`
            const reasonText = entry.dnf
              ? 'abandono'
              : entry.position === 1
                ? 'vitória'
                : entry.position <= 3
                  ? 'pódio'
                  : entry.position <= 10
                    ? `P${entry.position} na zona de pontos`
                    : `P${entry.position} fora dos pontos`

            await f1Service.addEvent(
              team.id,
              `📈 Moral de ${targetDriver.name}: ${entry.oldMorale} → ${entry.newMorale} (${mSign}) — ${reasonText} em ${gpInfo.name}.`,
              'resultado',
            )
          }
        } catch (postRaceErr) {
          console.warn(
            'Erro ao persistir moral/física pós-corrida do piloto:',
            entry.driverName,
            postRaceErr,
          )
        }
      }

      // Atualizar o estado local de drivers para refletir imediatamente a nova moral e condição física
      setDrivers((prev) =>
        prev.map((d) => {
          const matched = playerGridEntries.find((g) => g.driverId === d.id)
          if (matched && matched.newMorale !== undefined && matched.newPhysical !== undefined) {
            return {
              ...d,
              morale: matched.newMorale,
              physical_condition: matched.newPhysical,
            }
          }
          return d
        }),
      )
    }

    if (incidents.length > 0) {
      setSafetyCarActive(true)
    }
    setRaceIncidents(incidents)

    setIsSimulatingSession(false)
    setRaceResults(finalOrderedGrid)
    setCompletedSessions((prev) => [...new Set<WeekendSession>([...prev, 'race'])])
    if (liveRaceState) {
      setLiveRaceState((prev) =>
        prev ? { ...prev, inProgress: false, grid: finalOrderedGrid } : null,
      )
    }
  }

  // ADVANCE ROUND & PERSIST RESULTS ROBUSTLY
  const handleAdvanceRound = async () => {
    if (!raceResults || !team || !season) return
    setIsFinishing(true)

    try {
      await f1Service.deleteRaceResultsForRound(season.id, currentRound)

      const resultsToSave = raceResults
      let savedCount = 0
      for (const res of resultsToSave) {
        try {
          const driverCandidate = res.isPlayer ? res.driverId : undefined
          const teamCandidate = res.isPlayer ? res.teamId : undefined

          const { canonicalDriverId, canonicalTeamId } = await f1Service.ensureDriverAndTeam(
            res.driverName,
            driverCandidate,
            teamCandidate,
            { name: res.teamName, color: res.teamColor },
            { role: 'titular', nationality: res.flag ? undefined : undefined },
          )

          if (canonicalDriverId && canonicalTeamId) {
            const calculatedPoints =
              typeof res.points === 'number'
                ? res.points
                : (res.position <= 10 && !res.dnf
                    ? [25, 18, 15, 12, 10, 8, 6, 4, 2, 1][res.position - 1]
                    : 0) + (res.fastestLap && res.position <= 10 && !res.dnf ? 1 : 0)

            await f1Service.createRaceResult({
              season_id: season.id,
              round: currentRound,
              driver_id: canonicalDriverId,
              team_id: canonicalTeamId,
              position: res.position,
              points: calculatedPoints,
              fastest_lap: !!res.fastestLap,
            })
            savedCount++
          } else {
            console.warn(
              'Não foi possível resolver ID canônico para:',
              res.driverName,
              res.teamName,
              { canonicalDriverId, canonicalTeamId },
            )
          }
        } catch (resErr) {
          console.warn('Erro tolerado ao gravar resultado de um piloto:', res.driverName, resErr)
        }
      }

      // Process Finances
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

      // -------------------------------------------------------------
      // Atualização de Moral, Condição Física, Lesões e Recuperação ao Avançar Rodada
      // Garantir idempotência: verificar se a rodada já foi processada
      // -------------------------------------------------------------
      const alreadyProcessed = season.last_processed_round === currentRound
      const titulars = drivers.filter((d) => d.role !== 'reserva' && d.team_id === team.id)
      const reserve = drivers.find(
        (d) => d.role === 'reserva' || (d.reserve_team_id === team.id && d.team_id !== team.id),
      )

      if (!alreadyProcessed) {
        for (const t of titulars) {
          const resEntry = raceResults.find((r) => r.isPlayer && r.driverId === t.id)
          const baseMorale = resEntry?.newMorale ?? t.morale ?? 80
          const basePhysical = resEntry?.newPhysical ?? t.physical_condition ?? 90

          if (t.is_incapacitated) {
            const roundsLeft = (t.incapacitated_rounds_left || 1) - 1
            // Lesionados: recuperam física +8 por rodada afastado
            const recoveredPhysical = Math.max(5, Math.min(100, basePhysical + 8))

            if (roundsLeft <= 0) {
              await f1Service.updateDriver(t.id, {
                is_incapacitated: false,
                incapacitated_rounds_left: 0,
                incapacitated_reason: '',
                morale: baseMorale,
                physical_condition: recoveredPhysical,
              })
              await f1Service.addEvent(
                team.id,
                `Piloto ${t.name} foi liberado pelo departamento médico e retorna ao cockpit! (Física: ${recoveredPhysical}%)`,
                'resultado',
              )
            } else {
              await f1Service.updateDriver(t.id, {
                incapacitated_rounds_left: roundsLeft,
                morale: baseMorale,
                physical_condition: recoveredPhysical,
              })
            }
          } else {
            // Titulares que correram: recuperação de +2 entre rodadas
            const recoveredPhysical = Math.max(5, Math.min(100, basePhysical + 2))

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
                morale: baseMorale,
                physical_condition: recoveredPhysical,
              })
              await f1Service.addEvent(
                team.id,
                `ALERTA MÉDICO: ${t.name} sofreu "${reason}" e ficará fora da próxima etapa. O reserva ${reserve.name} assumirá o carro!`,
                'resultado',
              )
            } else {
              await f1Service.updateDriver(t.id, {
                morale: baseMorale,
                physical_condition: recoveredPhysical,
              })
            }
          }
        }

        // Recuperação de pilotos sem corrida no fim de semana (reservas sem corrida recuperam +6)
        if (reserve) {
          const currentResPhysical = reserve.physical_condition ?? 95
          const recoveredResPhysical = Math.max(5, Math.min(100, currentResPhysical + 6))
          await f1Service.updateDriver(reserve.id, {
            physical_condition: recoveredResPhysical,
          })
        }
      }

      // Apply wear to parts
      const aggressiveAero = (setups.race.wing_level || 5) > 7
      const aggressiveSuspension = (setups.race.suspension_stiffness || 5) > 7
      const aggressiveMGU = (setups.race.pu_electric_ratio || 50) > 65

      for (const p of parts) {
        let wearPercent = Math.floor(8 + Math.random() * 11)
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

      // Desgaste da Unidade de Potência (com redutor de 0.85 se usou modo preserve_car)
      const currentEngWear = team.active_engine_wear ?? 15
      let engineWearIncrement = Math.floor(18 + Math.random() * 8)
      if (aggressiveMGU) engineWearIncrement += 6
      if (hasUsedPreserveModeRef.current) {
        engineWearIncrement = Math.round(engineWearIncrement * 0.85)
      }
      const newEngWear = Math.min(100, currentEngWear + engineWearIncrement)

      await f1Service.updateTeam(team.id, {
        budget: updatedBudget,
        active_engine_wear: newEngWear,
      })

      // Register Event
      const playerWinner = raceResults.find((p) => p.isPlayer && p.position === 1)
      const bestPos = Math.min(...raceResults.filter((p) => p.isPlayer).map((p) => p.position))
      const eventMsg = playerWinner
        ? `VITÓRIA ESPETACULAR! ${playerWinner.driverName} venceu o ${gpInfo.name}!`
        : `Rodada ${currentRound} (${gpInfo.name}) concluída. Melhor posição da equipe: P${bestPos}. Fluxo financeiro: ${formatCurrency(netCashflow)}.`

      await f1Service.addEvent(team.id, eventMsg, 'resultado')

      // Advance season round & mark last_processed_round to prevent duplicate processing
      const nextRound = currentRound + 1
      await f1Service.updateSeason(season.id, {
        current_round: nextRound,
        last_processed_round: currentRound,
      })

      toast({
        title: `Rodada ${currentRound} Concluída com Sucesso!`,
        description: `${savedCount} classificações registradas no campeonato oficial.`,
      })

      await refreshTeamAndSeason()

      if (nextRound > totalRounds) {
        setSeasonCompleted(true)
        try {
          setIsProcessingSillySeason(true)
          const moves = await f1Service.processEndOfSeasonMarket(season.id, team.id)
          setMarketMoves(moves)
          setSillySeasonModalOpen(true)
        } catch (sillyErr) {
          console.warn('Erro ao disparar silly season automática:', sillyErr)
        } finally {
          setIsProcessingSillySeason(false)
        }
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
    <div className="relative space-y-8 animate-fade-in-up">
      <AmbientBackground />
      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-black tracking-widest text-[#E10600] uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E10600] shadow-[0_0_8px_#E10600] animate-pulse" />
            Fim de Semana de Grande Prêmio Oficial • Regulamento F1 2026
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white mt-1 drop-shadow-md">
            {gpInfo.name} • Rodada {currentRound}/{totalRounds}
          </h1>
          <p className="text-xs sm:text-sm font-mono text-cyan-400 mt-0.5">
            {gpInfo.circuit} • {gpInfo.country} {gpInfo.flag}
          </p>
        </div>

        {/* Global Weather & Abrasiveness Badge */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={`font-mono text-xs px-3 py-1 flex items-center gap-1.5 ${
              weather === 'chuva_forte'
                ? 'border-blue-500 text-blue-400 bg-blue-500/20 font-bold'
                : weather === 'chuva_fraca'
                  ? 'border-sky-400 text-sky-400 bg-sky-400/10'
                  : 'border-amber-400 text-amber-400 bg-amber-400/10'
            }`}
          >
            {weather !== 'seco' ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {weather === 'chuva_forte'
              ? '⛈️ Chuva Forte (Molhado Extremo)'
              : weather === 'chuva_fraca'
                ? '🌧️ Chuva Fraca (Intermediário)'
                : '☀️ Pista Seca'}
          </Badge>

          <Badge variant="outline" className="border-[#1F2733] text-[#8B95A7] font-mono text-xs">
            Abrasividade: {gpInfo.tireAbrasiveness || 6}/10
          </Badge>
        </div>
      </div>

      {/* PAINEL TÉCNICO DO CIRCUITO: IMAGEM HOMOLOGADA / BLUEPRINT + VOLTAS TOTAIS (EDIT 4) */}
      {(() => {
        const activeCircuitDb = circuits.find((c) => c.round === currentRound)
        const uploadedPhotoUrl = activeCircuitDb?.photo
          ? pb.files.getUrl(activeCircuitDb, activeCircuitDb.photo)
          : null
        const defaultAsset = currentRound === 1 ? defaultAustraliaMap : null
        const activeCircuitImage = uploadedPhotoUrl || defaultAsset

        return (
          <>
            {/* ITEM 5: BANNER DE POOL DE MOTORES COMPROMETIDO */}
            {puPoolStatus.isCompromised && (
              <div className="p-4 rounded-xl bg-amber-950/40 border-2 border-amber-500/70 shadow-lg space-y-2 animate-pulse">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <h4 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider">
                    ⚠️ ALERTA FIA: POOL DE MOTORES COMPROMETIDO
                  </h4>
                </div>
                <p className="text-xs text-amber-100 font-mono leading-relaxed">
                  ⚠️ Todos os motores estão comprometidos (&gt;65% de desgaste) e sua equipe não
                  possui margem financeira ou de teto de gastos para introduzir uma nova PU. Você
                  larga obrigatoriamente com o motor menos desgastado (PU #
                  {puPoolStatus.leastWornPu.id} com {puPoolStatus.leastWear}% de desgaste).
                  Desempenho reduzido: penalidade de ritmo de +
                  {puPoolStatus.pacePenaltySec.toFixed(2)}s/volta (+0,03s por % acima de 65%).
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="relative z-10 lg:col-span-1">
                {' '}
                <Card className="bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] overflow-hidden flex flex-col justify-between h-full shadow-xl">
                  <div className="relative w-full aspect-[16/9] max-h-72 bg-[#080B10] overflow-hidden border-b border-[#1F2733]/80 group flex items-center justify-center">
                    {activeCircuitImage ? (
                      <div className="w-full h-full relative bg-[#F5F7FA] overflow-hidden flex items-center justify-center">
                        <img
                          src={activeCircuitImage}
                          alt={`Traçado do ${gpInfo.circuit}`}
                          className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                        />
                        {/* Gradiente escuro para legibilidade */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0E14]/90 via-[#0B0E14]/40 to-black/30 pointer-events-none" />

                        {/* Badge superior com Rodada e Circuito */}
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <Badge className="bg-[#0B0E14]/85 text-[#F5F7FA] border border-[#1F2733] font-mono text-xs font-bold shadow-md">
                            R{currentRound}/24 • {gpInfo.circuit}
                          </Badge>
                        </div>

                        {/* Nome do GP sobreposto */}
                        <div className="absolute bottom-2.5 left-3 right-3 z-10">
                          <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase block drop-shadow">
                            {uploadedPhotoUrl ? 'Traçado Homologado' : 'Mapa Oficial FIA'}
                          </span>
                          <h4 className="text-sm font-extrabold text-white truncate drop-shadow-md">
                            {gpInfo.name}
                          </h4>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full relative">
                        <CircuitBlueprint
                          round={currentRound}
                          circuitName={gpInfo.circuit}
                          laps={gpInfo.laps}
                          lengthKm={gpInfo.circuitLengthKm}
                          className="h-full border-none rounded-none !p-3"
                        />
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <Badge className="bg-[#0B0E14]/85 text-[#F5F7FA] border border-[#1F2733] font-mono text-xs font-bold shadow-md">
                            R{currentRound}/24 • {gpInfo.circuit}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-[#080C14]/80 border-t border-[#1A2333] flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8B95A7]">Extensão:</span>
                    <span className="text-cyan-400 font-bold">{gpInfo.circuitLengthKm} km</span>
                    <span className="text-[#8B95A7] ml-2">Voltas:</span>
                    <span className="text-white font-bold">{gpInfo.laps}</span>
                  </div>
                </Card>
              </div>

              <div className="relative z-10 lg:col-span-2 space-y-4">
                <Card className="bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 h-full flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#1A2333] pb-2 mb-3">
                      <div>
                        <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                          DIRETRIZES DO AUTÓDROMO
                        </span>
                        <span className="text-xs font-mono font-black text-white uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                          <Flag className="w-4 h-4 text-[#E10600]" /> Parâmetros de Prova & Extensão
                          Oficial
                        </span>
                      </div>
                      <Badge className="bg-[#00A6FB]/20 text-[#00A6FB] border-[#00A6FB]/40 font-mono text-xs">
                        {gpInfo.laps} Voltas Programadas
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="p-3 rounded-lg bg-[#080C14]/80 border border-[#1A2333]">
                        <span className="text-[10px] text-[#8B95A7] block uppercase">
                          Total de Voltas
                        </span>
                        <strong className="text-base text-white font-bold">
                          {gpInfo.laps} voltas
                        </strong>
                        <span className="text-[10px] text-emerald-400 block mt-0.5">
                          Distância ~305 km
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-[#080C14]/80 border border-[#1A2333]">
                        <span className="text-[10px] text-[#8B95A7] block uppercase">
                          Comprimento da Pista
                        </span>
                        <strong className="text-base text-cyan-400 font-bold">
                          {gpInfo.circuitLengthKm} km
                        </strong>
                        <span className="text-[10px] text-[#8B95A7] block mt-0.5">Por volta</span>
                      </div>

                      <div className="p-3 rounded-lg bg-[#080C14]/80 border border-[#1A2333]">
                        <span className="text-[10px] text-[#8B95A7] block uppercase">
                          Carga Aerodinâmica
                        </span>
                        <strong className="text-base text-amber-400 font-bold">
                          {gpInfo.downforceIdeal}/10
                        </strong>
                        <span className="text-[10px] text-[#8B95A7] block mt-0.5">
                          Ideal recomendada
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-[#080C14]/80 border border-[#1A2333]">
                        <span className="text-[10px] text-[#8B95A7] block uppercase">
                          Rigidez Suspensão
                        </span>
                        <strong className="text-base text-emerald-400 font-bold">
                          {gpInfo.suspensionIdeal}/10
                        </strong>
                        <span className="text-[10px] text-[#8B95A7] block mt-0.5">
                          Trabalho de zebras
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-xs">
                      <span className="text-[#8B95A7] font-mono block text-[11px]">
                        Característica Central:
                      </span>
                      <p className="text-white font-medium mt-0.5 leading-relaxed">
                        {gpInfo.characteristic}
                      </p>
                    </div>
                  </div>

                  {(team?.engine_pool_used ?? 1) > 4 && (
                    <div className="mt-3 p-2.5 rounded-lg bg-red-950/40 border border-red-500/50 flex items-center gap-2 text-xs font-mono text-red-300">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>
                        Penalidade FIA no Grid: Equipe excedeu a cota de 4 motores da temporada (PU
                        #{team?.engine_pool_used}). Seus pilotos largarão com penalização de
                        posições!
                      </span>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )
      })()}

      {/* PAINEL DE PREVISÃO METEOROLÓGICA OFICIAL DA FIA 2026 */}
      <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 shadow-xl">
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
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400">
                  RADAR METEOROLÓGICO OFICIAL
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
              <h3 className="text-base font-black text-white mt-0.5">
                Previsão para o GP: {forecast.expectedCondition}
              </h3>
              <p className="text-xs text-[#8B95A7] font-mono">
                {forecast.probability >= 35 && forecast.rainLapStart
                  ? `Alerta de Radar: Nuvem densa se aproximando com chuva prevista por volta da volta ${forecast.rainLapStart}.`
                  : 'Condições meteorológicas estáveis previstas durante o evento.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
              <span className="text-[10px] text-[#8B95A7] block">Temp. Ar</span>
              <strong className="text-sm text-[#F5F7FA]">{forecast.airTemp}°C</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
              <span className="text-[10px] text-[#8B95A7] block">Temp. Asfalto</span>
              <strong className="text-sm text-amber-400">{forecast.trackTemp}°C</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
              <span className="text-[10px] text-[#8B95A7] block">Clima Atual</span>
              <strong
                className={`text-sm ${
                  weather === 'chuva_forte'
                    ? 'text-blue-400 font-bold'
                    : weather === 'chuva_fraca'
                      ? 'text-sky-400'
                      : 'text-emerald-400'
                }`}
              >
                {weather === 'chuva_forte'
                  ? '⛈️ Chuva Forte'
                  : weather === 'chuva_fraca'
                    ? '🌧️ Chuva Fraca'
                    : '☀️ Seco'}
              </strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Season Completed Banner if R24 */}
      {seasonCompleted && (
        <Card className="relative z-10 bg-gradient-to-r from-[#090D15]/95 via-[#131A26]/90 to-[#090D15]/95 backdrop-blur-md border-2 border-amber-500/60 p-6 shadow-2xl">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA]">
                Temporada {season?.year || 2026} Finalizada!
              </h2>
              <p className="text-sm text-[#8B95A7] max-w-lg mx-auto mt-1">
                Todas as 24 etapas foram concluídas! A "Silly Season" e a movimentação do mercado de
                pilotos já estão disponíveis.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <Button asChild className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
                <a href="/standings">Ver Classificação Final</a>
              </Button>
              <Button
                onClick={handleOpenSillySeason}
                disabled={isProcessingSillySeason}
                className="bg-[#00A6FB] hover:bg-[#0092DC] text-[#0B0E14] font-bold flex items-center gap-2"
              >
                Ver Mercado de Pilotos — Fim da Temporada
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* TIRE ALLOTMENT STATUS BAR (FIA 2026 Regulation) */}
      <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
              GERENCIAMENTO DE COMPOSTOS PIRELLI
            </span>
            <h3 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
              <Disc className="w-4 h-4 text-[#E10600]" />
              Estoque Oficial de Pneus do Piloto (Regulamento FIA 2026)
            </h3>
            <p className="text-xs text-[#8B95A7] font-mono mt-0.5">
              Alocação oficial: 2 Duros, 3 Médios, 3 Macios, 4 Intermediários, 3 Chuva Extrema.
              Paradas nos boxes reutilizam jogos usados com desgaste proporcional!
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
            {/* Hard */}
            <div className="p-2 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white ring-1 ring-slate-400" />
                <span className="text-[#8B95A7] text-[10px]">DURO (+0.60s)</span>
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
            <div className="p-2 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 ring-1 ring-yellow-500" />
                <span className="text-[#8B95A7] text-[10px]">MÉDIO (Ref 0.0s)</span>
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
            <div className="p-2 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-1 ring-red-600" />
                <span className="text-[#8B95A7] text-[10px]">MACIO (-0.75s)</span>
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
            <div className="p-2 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-emerald-600" />
                <span className="text-[#8B95A7] text-[10px]">INTERMEDIÁRIO</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.intermediario === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.intermediario} jogos
              </strong>
              <span className="text-[10px] text-sky-400 font-mono block mt-0.5">Chuva Fraca</span>
            </div>

            {/* Wet */}
            <div className="p-2 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-center col-span-2 sm:col-span-1">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-1 ring-blue-600" />
                <span className="text-[#8B95A7] text-[10px]">CHUVA EXT.</span>
              </div>
              <strong
                className={`text-sm block mt-0.5 ${tireStock.chuva_extrema === 0 ? 'text-red-400' : 'text-[#F5F7FA]'}`}
              >
                {tireStock.chuva_extrema} jogos
              </strong>
              <span className="text-[10px] text-blue-400 font-mono block mt-0.5">Chuva Forte</span>
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
        <TabsList className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] grid grid-cols-3 sm:grid-cols-6 h-auto p-1 gap-1">
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

        {(['tp1', 'tp2', 'q1', 'q2', 'q3', 'race'] as WeekendSession[]).map((sessKey) => {
          const currentSetup = setups[sessKey]
          const isRaceSession = sessKey === 'race'
          const isDone = completedSessions.includes(sessKey)

          return (
            <TabsContent key={sessKey} value={sessKey} className="space-y-6 mt-4">
              {/* Setup Configuration Panel for this session */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] lg:col-span-2 shadow-xl">
                  <CardHeader className="pb-3 border-b border-[#1A2333]">
                    <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                      OFICINA DE ENGENHARIA DE PISTA
                    </span>
                    <CardTitle className="text-base font-black text-white flex items-center justify-between mt-0.5">
                      <span className="flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-[#E10600]" />
                        Configuração do Carro — {sessKey.toUpperCase()}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveSetup}
                        className="border-[#1A2333] text-xs h-8 text-[#00A6FB] hover:bg-[#080C14]"
                      >
                        Salvar Setup
                      </Button>
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8B95A7] font-mono mt-0.5">
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
                        <span>20% (Conservador / poupa motor)</span>
                        <span>50% (Padrão Oficial FIA 2026)</span>
                        <span>80% (Pico elétrico agressivo / alto desgaste)</span>
                      </div>
                    </div>

                    {/* ITEM 1: Carga Inicial de Combustível (90% a 110%) */}
                    {isRaceSession && (
                      <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1E293B] space-y-2.5">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-white font-bold flex items-center gap-1.5">
                            <Fuel className="w-4 h-4 text-cyan-400" /> Carga Inicial de Combustível
                            (Briefing Pré-Corrida):
                          </span>
                          <Badge
                            className={`font-mono text-xs ${
                              raceInitialFuelPct < 100
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : raceInitialFuelPct > 100
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {raceInitialFuelPct}% Tanque (
                            {raceInitialFuelPct < 100
                              ? `${((100 - raceInitialFuelPct) * -0.025).toFixed(2)}s/volta (leve)`
                              : raceInitialFuelPct > 100
                                ? `+${((raceInitialFuelPct - 100) * 0.02).toFixed(2)}s/volta (pesado)`
                                : 'Carga Ideal 100%'}
                            )
                          </Badge>
                        </div>
                        <Slider
                          value={[raceInitialFuelPct]}
                          min={90}
                          max={110}
                          step={1}
                          onValueChange={(val) => {
                            setRaceInitialFuelPct(val[0])
                            updateCurrentSetup('initial_fuel_load', val[0])
                          }}
                          className="py-1"
                        />
                        <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                          <span className="text-amber-400">
                            90% (Carro mais leve até -0.25s/v, alto risco de falta)
                          </span>
                          <span className="text-emerald-400">100% (Padrão seguro)</span>
                          <span className="text-blue-400">110% (Pesado, folga total)</span>
                        </div>
                      </div>
                    )}

                    {/* Feedback de Engenharia */}
                    <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1E293B] space-y-3 font-mono">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B] pb-2">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Retorno da Engenharia // Telemetria de Setup
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs font-mono ${
                            setupFeedback.verdict === 'ideal'
                              ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                              : setupFeedback.verdict === 'bom'
                                ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                                : setupFeedback.verdict === 'desajustado'
                                  ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                                  : 'border-red-500/50 text-red-400 bg-red-500/10'
                          }`}
                        >
                          Índice de Acerto: {setupFeedback.overallScore}% • {setupFeedback.title}
                        </Badge>
                      </div>

                      <p className="text-xs text-[#8B95A7] leading-relaxed">
                        {setupFeedback.summary}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-[11px]">
                        <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733] space-y-1">
                          <span className="text-[#8B95A7] font-bold block uppercase text-[10px]">
                            Asa & Arrasto Aerodinâmico
                          </span>
                          <p className="text-slate-300 leading-normal">
                            {setupFeedback.wingFeedback.text}
                          </p>
                        </div>

                        <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733] space-y-1">
                          <span className="text-[#8B95A7] font-bold block uppercase text-[10px]">
                            Suspensão & Zebras
                          </span>
                          <p className="text-slate-300 leading-normal">
                            {setupFeedback.suspensionFeedback.text}
                          </p>
                        </div>

                        <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733] space-y-1">
                          <span className="text-[#8B95A7] font-bold block uppercase text-[10px]">
                            Trem de Força 50/50
                          </span>
                          <p className="text-slate-300 leading-normal">
                            {setupFeedback.puFeedback.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tire & Pit Stop Strategy Choice */}
                <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] flex flex-col justify-between shadow-xl">
                  <CardHeader className="pb-3 border-b border-[#1A2333]">
                    <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#00A6FB] block">
                      ESTRATÉGIA OPERACIONAL
                    </span>
                    <CardTitle className="text-base font-black text-white flex items-center justify-between mt-0.5">
                      <span className="flex items-center gap-2">
                        <Disc className="w-5 h-5 text-yellow-400" />
                        {isRaceSession
                          ? 'Estratégia de Corrida (Até 4 Pits por Piloto)'
                          : 'Pneu da Sessão'}
                      </span>
                      {isRaceSession && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono border-cyan-500/40 text-cyan-300"
                        >
                          FIA 2026 • Individual por Piloto
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs text-[#8B95A7]">
                      {isRaceSession
                        ? 'Defina o pneu de largada (seco ou chuva) e até 4 paradas programadas independentes para cada piloto da sua equipe.'
                        : 'Escolha o composto a ser utilizado durante esta sessão de testes.'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4">
                    <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] text-[11px] font-mono space-y-1">
                      <div className="flex items-center justify-between text-[#8B95A7]">
                        <span className="font-bold text-white flex items-center gap-1">
                          <Disc className="w-3.5 h-3.5 text-yellow-400" /> Deltas Oficiais (FIA
                          2026):
                        </span>
                        <span className="text-[10px] text-cyan-400">Ref: Médio</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 pt-1 text-[10px]">
                        <span className="text-red-400">🔴 Macio: -0.75s</span>
                        <span className="text-yellow-400">🟡 Médio: 0.00s</span>
                        <span className="text-slate-300">⚪ Duro: +0.60s</span>
                        <span className="text-emerald-400">🟢 Interm: +3.80s (seco)</span>
                        <span className="text-blue-400">🔵 Chuva: +6.50s (seco)</span>
                        <span className="text-emerald-300 font-bold">
                          ⚡ Clima:{' '}
                          {weather === 'seco'
                            ? 'Seco'
                            : weather === 'chuva_fraca'
                              ? 'Chuva Fraca'
                              : 'Chuva Forte'}
                        </span>
                      </div>
                    </div>

                    {!isRaceSession ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-mono text-[#8B95A7] block">
                          Composto da Sessão:
                        </label>
                        <select
                          value={currentSetup.tire_compound || 'medio'}
                          onChange={(e) =>
                            updateCurrentSetup('tire_compound', e.target.value as TireCompound)
                          }
                          className="w-full bg-[#0B0E14] border border-[#1F2733] rounded-lg px-3 py-2 text-xs font-mono text-[#F5F7FA] focus:outline-none focus:border-[#00A6FB]"
                        >
                          <option value="macio">
                            Macio (Vermelho) [-0.75s] — Estoque: {tireStock.macio}
                          </option>
                          <option value="medio">
                            Médio (Amarelo) [Ref 0.0s] — Estoque: {tireStock.medio}
                          </option>
                          <option value="duro">
                            Duro (Branco) [+0.60s] — Estoque: {tireStock.duro}
                          </option>
                          <option value="intermediario">
                            Intermediário (Verde) — Estoque: {tireStock.intermediario}
                          </option>
                          <option value="chuva_extrema">
                            Chuva Extrema (Azul) — Estoque: {tireStock.chuva_extrema}
                          </option>
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {drivers
                          .filter((d) => d.team_id === team?.id && d.role !== 'reserva')
                          .map((driver) => {
                            const strat = getStrategyForDriver(driver)
                            const wearProfile = calculateDriverTireWearProfile(driver)

                            return (
                              <div
                                key={driver.id}
                                className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-3 font-mono text-xs"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-[#1F2733] pb-2">
                                  <div className="flex items-center gap-2">
                                    <DriverHelmet
                                      driver={driver}
                                      teamColor={team?.color}
                                      size="sm"
                                    />
                                    <span className="font-bold text-[#F5F7FA] text-sm flex items-center gap-1.5">
                                      {driver.name}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] px-1.5 py-0 ${wearProfile.badgeColor}`}
                                    >
                                      Desgaste: {wearProfile.profileName} (x{wearProfile.multiplier}
                                      )
                                    </Badge>
                                  </div>
                                  <span className="text-[11px] text-[#8B95A7]">
                                    {strat.pitStops.length} parada(s) programada(s)
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] text-[#8B95A7] block font-bold">
                                    🟢 Pneu de Largada (Stint 1):
                                  </label>
                                  <select
                                    value={strat.startCompound}
                                    onChange={(e) =>
                                      updateDriverStartCompound(
                                        driver.id,
                                        e.target.value as TireCompound,
                                      )
                                    }
                                    className="w-full bg-[#11161F] border border-[#1F2733] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                                  >
                                    <option value="macio">
                                      🔴 Macio (Vermelho) — {tireStock.macio} jogos rest.
                                    </option>
                                    <option value="medio">
                                      🟡 Médio (Amarelo) — {tireStock.medio} jogos rest.
                                    </option>
                                    <option value="duro">
                                      ⚪ Duro (Branco) — {tireStock.duro} jogos rest.
                                    </option>
                                    <option value="intermediario">
                                      🟢 Intermediário (Chuva Fraca) — {tireStock.intermediario}{' '}
                                      rest.
                                    </option>
                                    <option value="chuva_extrema">
                                      🔵 Chuva Extrema (Chuva Forte) — {tireStock.chuva_extrema}{' '}
                                      rest.
                                    </option>
                                  </select>
                                </div>

                                <div className="space-y-2 pt-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-[#8B95A7] font-bold">
                                      Sequência de Paradas nos Boxes:
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={strat.pitStops.length >= 4}
                                      onClick={() => addDriverPitStop(driver.id)}
                                      className="h-6 text-[10px] px-2 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
                                    >
                                      + Adicionar Parada (Max 4)
                                    </Button>
                                  </div>

                                  {strat.pitStops.length === 0 ? (
                                    <p className="text-[11px] text-amber-400/90 italic bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                      ⚠️ Nenhuma parada planejada! Em pista seca, a FIA exige trocar
                                      de composto pelo menos uma vez.
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {strat.pitStops.map((pit, pIdx) => (
                                        <div
                                          key={pit.id}
                                          className="p-2 rounded-lg bg-[#11161F] border border-[#1F2733] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                        >
                                          <div className="flex items-center gap-2">
                                            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">
                                              Pit #{pIdx + 1}
                                            </Badge>
                                            <div className="flex items-center gap-1.5 text-xs text-white">
                                              <span>Volta</span>
                                              <input
                                                type="number"
                                                min={1}
                                                max={gpInfo.laps - 1}
                                                value={pit.lap}
                                                onChange={(e) =>
                                                  updateDriverPitStop(
                                                    driver.id,
                                                    pit.id,
                                                    'lap',
                                                    Math.max(
                                                      1,
                                                      Math.min(
                                                        gpInfo.laps - 1,
                                                        parseInt(e.target.value) || 1,
                                                      ),
                                                    ),
                                                  )
                                                }
                                                className="w-14 bg-[#0B0E14] border border-[#1F2733] rounded px-1.5 py-0.5 text-center font-bold text-cyan-300"
                                              />
                                              <span className="text-[#8B95A7]">/{gpInfo.laps}</span>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-[#8B95A7]">
                                              Calçar:
                                            </span>
                                            <select
                                              value={pit.compound}
                                              onChange={(e) =>
                                                updateDriverPitStop(
                                                  driver.id,
                                                  pit.id,
                                                  'compound',
                                                  e.target.value as TireCompound,
                                                )
                                              }
                                              className="bg-[#0B0E14] border border-[#1F2733] rounded px-2 py-1 text-xs text-white focus:outline-none font-mono"
                                            >
                                              <option value="duro">⚪ Duro (+0.60s)</option>
                                              <option value="medio">🟡 Médio (0.0s)</option>
                                              <option value="macio">🔴 Macio (-0.75s)</option>
                                              <option value="intermediario">
                                                🟢 Intermediário
                                              </option>
                                              <option value="chuva_extrema">
                                                🔵 Chuva Extrema
                                              </option>
                                            </select>

                                            <button
                                              type="button"
                                              onClick={() => removeDriverPitStop(driver.id, pit.id)}
                                              className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/10 text-xs"
                                              title="Remover parada"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}

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
                <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#00A6FB]/60 p-5 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#1F2733] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#00A6FB]/20 text-[#00A6FB] animate-spin">
                        <Gauge className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#F5F7FA]">{simText}</h3>
                        <p className="text-xs text-[#8B95A7] font-mono">
                          {isRaceSession && liveRaceState
                            ? `Progresso da Prova: Volta ${liveRaceState.currentLap}/${liveRaceState.totalLaps} (${Math.round((liveRaceState.currentLap / liveRaceState.totalLaps) * 100)}%)`
                            : 'Simulação e telemetria ativas em tempo real'}
                        </p>
                      </div>
                    </div>

                    {isRaceSession && liveRaceState && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 text-sm font-mono px-3 py-1 font-bold">
                          🏁 Volta {liveRaceState.currentLap}/{liveRaceState.totalLaps}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`font-mono text-xs ${
                            liveRaceState.weather === 'chuva_forte'
                              ? 'border-blue-500 text-blue-400 bg-blue-500/20 font-bold animate-pulse'
                              : liveRaceState.weather === 'chuva_fraca'
                                ? 'border-sky-400 text-sky-400 bg-sky-400/10'
                                : 'border-amber-400 text-amber-400 bg-amber-400/10'
                          }`}
                        >
                          {liveRaceState.weather === 'chuva_forte'
                            ? '⛈️ Chuva Forte'
                            : liveRaceState.weather === 'chuva_fraca'
                              ? '🌧️ Chuva Fraca'
                              : '☀️ Pista Seca'}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={handleOpenForcePitModal}
                          className="bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-xs uppercase px-3 shadow-md flex items-center gap-1.5"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          PARAR NOS BOXES
                        </Button>
                      </div>
                    )}
                  </div>

                  <Progress value={simProgress} className="h-2 w-full bg-[#0B0E14]" />
                </Card>
              )}

              {/* 1. Feed da corrida (Sub-componente desacoplado) */}
              {isRaceSession && (
                <LiveRaceFeed
                  events={liveEvents}
                  currentLap={liveRaceState?.currentLap}
                  totalLaps={liveRaceState?.totalLaps || gpInfo.laps}
                  isRaceSession={isRaceSession}
                  canForcePit={!raceResults && !!liveRaceState?.inProgress}
                  onOpenForcePit={handleOpenForcePitModal}
                />
              )}

              {/* 2. Tabela de telemetria completa (Sub-componente desacoplado) */}
              {isRaceSession &&
                liveRaceState &&
                liveRaceState.grid &&
                liveRaceState.grid.length > 0 && (
                  <LiveTelemetryTable
                    grid={liveRaceState.grid}
                    currentLap={liveRaceState.currentLap}
                    totalLaps={liveRaceState.totalLaps}
                    trackAbrasiveness={gpInfo.tireAbrasiveness || 6}
                  />
                )}

              {/* 3. Resultados de treinos/quali (Sub-componente desacoplado) */}
              {!isRaceSession && (
                <PracticeQualyResults
                  sessionKey={sessKey}
                  circuitName={gpInfo.circuit}
                  results={sessionResults[sessKey]}
                />
              )}

              {/* 4. Tabela de resultados oficiais do GP (Sub-componente desacoplado) */}
              {isRaceSession && raceResults && (
                <RaceResultsTable
                  gpName={gpInfo.name}
                  results={raceResults}
                  incidents={raceIncidents}
                  isFinishing={isFinishing}
                  onAdvanceRound={handleAdvanceRound}
                />
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      {/* 5. Modais de decisão tática de corrida (Sub-componente desacoplado) */}
      <DecisionModals
        rainDecisionOpen={rainDecisionOpen}
        liveRaceWeather={liveRaceState?.weather || weather}
        currentLap={liveRaceState?.currentLap || 1}
        totalLaps={liveRaceState?.totalLaps || gpInfo.laps}
        circuitName={gpInfo.circuit}
        rainActiveDriver={
          liveRaceState?.grid?.find((g) => g.driverId === rainActiveDriverId) || null
        }
        rainQueueLength={rainQueue.length}
        rainQueueTotal={rainQueueTotal}
        rainDecisionWaitLaps={rainDecisionWaitLaps}
        setRainDecisionWaitLaps={setRainDecisionWaitLaps}
        tireStock={tireStock}
        formatTireName={formatTireName}
        onConfirmRainDecision={handleConfirmRainDecision}
        wingDamageModalOpen={wingDamageModalOpen}
        setWingDamageModalOpen={setWingDamageModalOpen}
        wingDamageDriver={wingDamageDriver}
        wingDamageTireChoice={wingDamageTireChoice}
        setWingDamageTireChoice={setWingDamageTireChoice}
        onConfirmWingDamageDecision={handleConfirmWingDamageDecision}
        safetyCarModalOpen={safetyCarModalOpen}
        safetyCarReason={safetyCarReason}
        safetyCarActiveDriver={
          liveRaceState?.grid?.find((g) => g.driverId === safetyCarActiveDriverId) || null
        }
        safetyCarQueueLength={safetyCarQueue.length}
        safetyCarQueueTotal={safetyCarQueueTotal}
        safetyCarTireChoice={safetyCarTireChoice}
        setSafetyCarTireChoice={setSafetyCarTireChoice}
        onConfirmSafetyCarDecision={handleConfirmSafetyCarDecision}
        forcePitModalOpen={forcePitModalOpen}
        onCloseForcePitModal={handleCloseForcePitModal}
        activePlayerDrivers={
          liveRaceState?.grid ? liveRaceState.grid.filter((g) => g.isPlayer && !g.dnf) : []
        }
        forcePitSelectedDriverId={forcePitSelectedDriverId}
        setForcePitSelectedDriverId={setForcePitSelectedDriverId}
        availableForcePitSets={(
          driverTireInventories[forcePitSelectedDriverId] || playerTireSets
        ).filter((s) => !s.isFitted && s.wear < 90)}
        forcePitSelectedSetId={forcePitSelectedSetId}
        setForcePitSelectedSetId={setForcePitSelectedSetId}
        teamChassisLevel={team?.chassis_level || 75}
        onExecuteForcedPitStop={handleExecuteForcedPitStop}
      />

      {/* 6. Modal de Silly Season (Sub-componente desacoplado) */}
      <SillySeasonModal
        open={sillySeasonModalOpen}
        onOpenChange={setSillySeasonModalOpen}
        season={season}
        marketMoves={marketMoves}
        isStartingNewSeason={isStartingNewSeason}
        onStartNextSeason={handleStartNextSeason}
      />

      {/* 7. Modal de Rádio da Equipe (Team Radio System) */}
      {(() => {
        const activeRadioDriver = radioActiveMessage
          ? liveRaceState?.grid?.find((g) => g.driverId === radioActiveMessage.driverId)
          : null
        const activeDriverTireSets = radioActiveMessage
          ? (driverTireInventories[radioActiveMessage.driverId] || playerTireSets).filter(
              (s) => !s.isFitted && s.wear < 90,
            )
          : []
        return (
          <TeamRadioDialog
            open={!!radioActiveMessage}
            message={radioActiveMessage}
            queueIndex={radioQueueTotal - radioQueue.length}
            queueTotal={radioQueueTotal}
            availableTireSets={activeDriverTireSets}
            currentTireCompound={activeRadioDriver?.tireCompound || 'medio'}
            currentTireWear={activeRadioDriver?.tireWear ?? 50}
            onRespond={handleRadioResponse}
          />
        )
      })()}
    </div>
  )
}
