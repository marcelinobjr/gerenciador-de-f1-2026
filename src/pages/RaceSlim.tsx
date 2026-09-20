// RaceSlim.tsx - Versão modular com componentes desacoplados
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { f1Service } from '@/services/f1Service'
import {
  rollMechanicalFailures,
  shouldTriggerRedFlag,
  evaluateFiaIncidents,
  applyPenaltiesToResults,
  type FiaPenalty,
  type MechanicalIssue,
  type RedFlagState,
  type IncidentEventInput,
  avaliarTeamOrder,
  aplicarTeamOrder,
  DRAMA_NARRATIVES,
  type TeamOrderProposal,
  type TeamOrderState,
  type DriverDramaContext,
} from '@/lib/raceDrama'
import { notificationService } from '@/services/notificationService'
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
  type TireCliffStatus,
  calculateTireCliffStatus,
  isTireInCliff,
  calculateLapPerformanceScoreDelta,
  formatTireName,
} from '@/lib/f1-tire-system'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { carTechnicalService } from '@/services/carTechnicalService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
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
  Gauge,
  Zap,
  Disc,
  CheckCircle2,
  AlertTriangle,
  Flag,
  Wrench,
  Fuel,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DriverHelmet } from '@/components/DriverHelmet'
import { PageHeader } from '@/components/PageHeader'

// Sub-componentes modulares da corrida
import { LiveRaceHUD } from '@/components/race/LiveRaceHUD'
import { PracticeQualyResults, SessionResultRow } from '@/components/race/PracticeQualyResults'
import { PracticePreparationView } from '@/components/race/PracticePreparationView'
import { PracticeLiveSessionView } from '@/components/race/PracticeLiveSessionView'
import type { PracticePreparation } from '@/types/practice-preparation'
import { RaceResultsTable, RaceResultEntry } from '@/components/race/RaceResultsTable'
import { DecisionModals } from '@/components/race/DecisionModals'
import { SillySeasonModal } from '@/components/race/SillySeasonModal'
import { TeamRadioDialog } from '@/components/TeamRadioDialog'
import { TireStockCard } from '@/pages/race/TireStockCard'
import { WeatherRadarCard } from '@/pages/race/WeatherRadarCard'
import { TrackInfoPanel } from '@/pages/race/TrackInfoPanel'
import { PreRaceDriverBriefingCard } from '@/components/race/PreRaceDriverBriefingCard'
import { PitWallRadioDialog } from '@/components/race/PitWallRadioDialog'
import { SimulateWeekendModal } from '@/components/race/SimulateWeekendModal'
import { SimulationStepTracker } from '@/components/race/SimulationStepTracker'
import { WeekendSummaryModal } from '@/components/race/WeekendSummaryModal'
import { weekendSimulationService } from '@/services/weekendSimulationService'
import type {
  WeekendSimulationStepProgress,
  WeekendSummaryReport,
} from '@/types/canonical-season-transition'
import { driverRaceInteractionService } from '@/services/driverRaceInteractionService'
import { getCountryFlag } from '@/lib/country-flags'
import type { LivePaceOrder } from '@/components/race/LiveTelemetryTable'
import {
  evaluateDriverRadioTriggers,
  DriverRadioMessage,
  DriverRadioCooldowns,
  BossResponseType,
  DRIVER_FEEDBACKS,
} from '@/lib/f1-radio-system'
import { generateLapNarratedEvents } from '@/pages/race/raceNarratedEvents'
import { advanceRound } from '@/pages/race/raceAdvance'
import { TrackEngineeringAndStrategySection } from '@/pages/race/TrackEngineeringAndStrategySection'
import { RaceOperationsCockpit } from '@/pages/race/RaceOperationsCockpit'
import { practiceSessionService } from '@/services/practiceSessionService'

export type { WeekendSession, LiveRaceEvent }

export interface SimDriverEntry extends RaceResultEntry {
  nationality?: string
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

export type SessionTimeResult = SessionResultRow & { lapTimeSec?: number }

// Initial tire allotment per weekend per driver (GP Padrão: 2/3/8/4/3 = 20 jogos)
const INITIAL_ALLOTMENT: TireAllotment = {
  duro: 2,
  medio: 3,
  macio: 8,
  intermediario: 4,
  chuva_extrema: 3,
}

// Estado ótimo inicial padrão sem cliff (conforme interface TireCliffStatus de f1-tire-system.ts)
const INITIAL_OPTIMAL_CLIFF: TireCliffStatus = {
  isCliffReached: 0,
  isCriticalWindow: false,
  extraLapTimeSec: 0,
  cliffWearEquivalent: 0,
  thermalLockupRisk: 0.1,
  isOverheating: false,
  overheatPenaltySec: 0,
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
  const { user, team, season, refreshTeamAndSeason } = useAuth()
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

  // Identificação do Circuito Atual e Previsão Meteorológica
  const currentRound = season?.current_round || 1
  const totalRounds = season?.total_rounds || 24

  // Selected driver for individual car setup & telemetry view in practice/qualy/race
  const [selectedDriverSetupId, setSelectedDriverSetupId] = useState<string>('')

  // Estado da sessão ao vivo de treino (Etapa 4B)
  const [activePracticeLivePreps, setActivePracticeLivePreps] = useState<
    Record<string, PracticePreparation | null>
  >({
    tp1: null,
    tp2: null,
  })

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

  // Recuperar ou inicializar inventário canônico individual persistente por piloto
  useEffect(() => {
    if (drivers.length > 0 && team?.id && season?.id) {
      const playerDrivers = drivers.filter((d) => d.team_id === team.id && d.role !== 'reserva')
      const primaryIds = playerDrivers.map((d) => d.id)
      const persistentInvs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId: season.id,
        round: currentRound,
        driverIds: primaryIds,
        primaryDriverIds: primaryIds,
      })
      setDriverTireInventories(persistentInvs)
    }
  }, [drivers, team?.id, season?.id, currentRound])

  // Estratégias de corrida personalizadas por piloto (até 4 paradas planejáveis)
  const [driverStrategies, setDriverStrategies] = useState<Record<string, DriverRaceStrategy>>({})

  // Force Pit Stop Modal state
  const [forcePitModalOpen, setForcePitModalOpen] = useState(false)
  const [pitWallRadioOpen, setPitWallRadioOpen] = useState(false)
  const [pitWallRadioDriverId, setPitWallRadioDriverId] = useState('')
  const [pendingDriverRequest, setPendingDriverRequest] = useState<any>(null)
  const [activeFollowUpState, setActiveFollowUpState] = useState<any>(null)
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

  // Simulation Weekend (8A Canonical Integration)
  const [simulateWeekendModalOpen, setSimulateWeekendModalOpen] = useState(false)
  const [weekendSummaryModalOpen, setWeekendSummaryModalOpen] = useState(false)
  const [weekendSimulationReport, setWeekendSummaryReport] = useState<WeekendSummaryReport | null>(
    null,
  )
  const [simulationSteps, setSimulationSteps] = useState<WeekendSimulationStepProgress[]>([])
  const [simulationStepMessage, setSimulationStepMessage] = useState('')
  const [isSimulatingWeekend, setIsSimulatingWeekend] = useState(false)

  // Race final results
  const [raceResults, setRaceResults] = useState<SimDriverEntry[] | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const [seasonCompleted, setSeasonCompleted] = useState(false)

  // Incidents log during race
  const [raceIncidents, setRaceIncidents] = useState<string[]>([])
  const [safetyCarActive, setSafetyCarActive] = useState(false)

  // FIA & Drama states (FIAÇÃO PARTE 1)
  const [penalties, setPenalties] = useState<FiaPenalty[]>([])
  const [mechanicalIssues, setMechanicalIssues] = useState<MechanicalIssue[]>([])
  const [redFlagState, setRedFlagState] = useState<RedFlagState>({
    active: false,
    ticksFrozen: 0,
    usedThisRace: false,
    safetyCarLapsRemaining: 0,
  })
  const redFlagStateRef = useRef<RedFlagState>({
    active: false,
    ticksFrozen: 0,
    usedThisRace: false,
    safetyCarLapsRemaining: 0,
  })
  const [teamOrders, setTeamOrders] = useState<TeamOrderState[]>([])
  const teamOrdersRef = useRef<TeamOrderState[]>([])
  const [teamOrderProposal, setTeamOrderProposal] = useState<TeamOrderProposal | null>(null)
  const teamOrderProposalRef = useRef<TeamOrderProposal | null>(null)
  const teamOrderPaceModifierRef = useRef<Map<string, { deltaSec: number; expiresAtLap: number }>>(
    new Map(),
  )

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
  // Estratégia ao vivo por carro do jogador (Record<string, 'attack' | 'normal' | 'save_fuel'>)
  const [playerCarTactics, setPlayerCarTactics] = useState<
    Record<string, 'attack' | 'normal' | 'save_fuel'>
  >({})
  const playerCarTacticsRef = useRef<Record<string, 'attack' | 'normal' | 'save_fuel'>>({})
  const activeCarTacticsInLoopRef = useRef<Record<string, 'attack' | 'normal' | 'save_fuel'>>({})

  // Ordem de ritmo ao vivo ('segurar' | 'normal' | 'empurrar')
  const [playerPaceOrders, setPlayerPaceOrders] = useState<Record<string, LivePaceOrder>>({})
  const playerPaceOrdersRef = useRef<Record<string, LivePaceOrder>>({})
  const activePaceOrdersInLoopRef = useRef<Record<string, LivePaceOrder>>({})

  // Rótulo textual das sessões restantes para o WeekendHeader
  const remainingSessionsList = (
    ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race'] as WeekendSession[]
  ).filter((s) => !completedSessions.includes(s))
  const remainingSessionsLabel = remainingSessionsList
    .map((s) => {
      const m: Record<WeekendSession, string> = {
        tp1: 'Treino 1',
        tp2: 'Treino 2',
        q1: 'Classificação (Q1)',
        q2: 'Q2',
        q3: 'Q3',
        race: 'Corrida',
      }
      return m[s] || s
    })
    .join(' · ')

  const handleStartSimulateWeekend = async () => {
    if (!team || !season) return
    setSimulateWeekendModalOpen(false)
    setIsSimulatingWeekend(true)
    setSimulationSteps([])
    setSimulationStepMessage('Iniciando simulação de fim de semana...')

    try {
      const res = await weekendSimulationService.simulateRemainingWeekend({
        team,
        season,
        drivers,
        parts,
        sponsors,
        currentRound,
        alreadyCompletedSessions: completedSessions,
        onStepProgress: (step) => {
          setSimulationSteps((prev) => [...prev, step])
          setSimulationStepMessage(step.message)
        },
      })

      if (res && res.report) {
        setWeekendSummaryReport(res.report)
        setWeekendSummaryModalOpen(true)
        await refreshTeamAndSeason()
      } else {
        toast({
          title: 'Erro na Simulação',
          description: 'Não foi possível completar a simulação do fim de semana.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Falha Crítica',
        description: err.message || 'Erro inesperado na simulação canônica.',
        variant: 'destructive',
      })
    } finally {
      setIsSimulatingWeekend(false)
    }
  }

  // Helper para abrir o modal de rádio via Pit Wall com piloto específico
  const handleOpenPitWallRadio = (driverId: string) => {
    setPitWallRadioDriverId(driverId)
    // Tenta encontrar uma solicitação pendente do piloto ou estado de follow-up
    setPendingDriverRequest(null)
    setActiveFollowUpState(null)
    setPitWallRadioOpen(true)
  }

  // Manipulador para alterar tática de um carro do jogador
  const handleChangeTacticalMode = (
    driverId: string,
    mode: 'attack' | 'normal' | 'save_fuel' | 'preserve',
  ) => {
    const validMode: 'attack' | 'normal' | 'save_fuel' = mode === 'preserve' ? 'save_fuel' : mode

    setPlayerCarTactics((prev) => {
      const updated = { ...prev, [driverId]: validMode }
      playerCarTacticsRef.current = updated
      return updated
    })

    const driverName =
      drivers.find((d) => d.id === driverId)?.name ||
      liveRaceState?.grid?.find((g) => g.driverId === driverId)?.driverName ||
      'Piloto'

    const modeLabels: Record<string, string> = {
      attack: '⚡ Modo Ataque (350kW + push)',
      normal: '⚖️ Modo Normal (Equilibrado)',
      save_fuel: '🌱 Economizar Combustível & Pneus',
    }

    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setLiveEvents((prev) => [
      {
        id: `ev_tactic_${Date.now()}_${driverId}`,
        lap: liveRaceState?.currentLap || 1,
        type: 'team_radio',
        message: `📻 PIT WALL ➔ ${driverName.toUpperCase()}: ${modeLabels[validMode]} acionado para a próxima volta.`,
        driverName: driverName,
        teamColor: team?.color || '#E10600',
        isPlayer: true,
        timestamp: nowStr,
      },
      ...prev,
    ])

    toast({
      title: `Tática Atualizada — ${driverName}`,
      description: `${modeLabels[validMode]} entrará em vigor na próxima volta.`,
    })
  }

  // Manipulador para alterar ordem de ritmo ao vivo do carro do jogador
  const handleChangePaceOrder = (driverId: string, order: LivePaceOrder) => {
    setPlayerPaceOrders((prev) => {
      const updated = { ...prev, [driverId]: order }
      playerPaceOrdersRef.current = updated
      return updated
    })

    const driverName =
      drivers.find((d) => d.id === driverId)?.name ||
      liveRaceState?.grid?.find((g) => g.driverId === driverId)?.driverName ||
      'Piloto'

    const orderLabels: Record<LivePaceOrder, string> = {
      segurar: '🛡️ SEGURAR RITMO (Poupar pneus e freios)',
      normal: '⚖️ RITMO NORMAL (Delta de referência)',
      empurrar: '🔥 EMPURRAR (Buscar tempo por volta)',
    }

    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setLiveEvents((prev) => [
      {
        id: `ev_pace_order_${Date.now()}_${driverId}`,
        lap: liveRaceState?.currentLap || 1,
        type: 'team_radio',
        message: `📻 PIT WALL ➔ ${driverName.toUpperCase()}: Ordem de ritmo alterada para "${orderLabels[order]}". Efeito a partir da próxima volta.`,
        driverName: driverName,
        teamColor: team?.color || '#E10600',
        isPlayer: true,
        timestamp: nowStr,
      },
      ...prev,
    ])

    toast({
      title: `Ritmo: ${driverName}`,
      description: `${orderLabels[order]} valendo a partir da próxima volta.`,
    })
  }

  // Ref para registrar se o jogador utilizou modo preserve_car durante a corrida
  const hasUsedPreserveModeRef = useRef<boolean>(false)

  // 3. Dynamic Rain decision modal & queue
  const [rainDecisionOpen, setRainDecisionOpen] = useState(false)
  const [rainDecisionWaitLaps, setRainDecisionWaitLaps] = useState<number>(0)
  const [rainQueue, setRainQueue] = useState<string[]>([])
  const [rainQueueTotal, setRainQueueTotal] = useState<number>(0)
  const [rainActiveDriverId, setRainActiveDriverId] = useState<string>('')
  const hasEverPromptedRainRef = useRef<boolean>(false)
  const waitLapsPerDriverRef = useRef<Map<string, number>>(new Map())

  // Estado ao vivo da corrida durante a simulação (Grid, volta, clima)
  const [liveRaceState, setLiveRaceState] = useState<{
    inProgress: boolean
    currentLap: number
    totalLaps: number
    weather: TrackWeatherState
    grid: SimDriverEntry[]
  } | null>(null)

  // 1. Carregar Dados Iniciais
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [d, p, s, c] = await Promise.all([
        f1Service.getDrivers(),
        team?.id ? f1Service.getTeamParts(team.id) : Promise.resolve([]),
        f1Service.getSponsors(),
        f1Service.getAllCircuits(),
      ])
      setDrivers(d)
      setParts(p)
      setSponsors(s)
      setCircuits(c)

      // Se há pilotos do jogador, selecionar o primeiro por padrão
      const playerDrivers = d.filter((drv) => drv.team_id === team?.id && drv.role !== 'reserva')
      if (playerDrivers.length > 0 && !selectedDriverSetupId) {
        setSelectedDriverSetupId(playerDrivers[0].id)
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados do fim de semana',
        description: err?.message || 'Tente recarregar a página.',
      })
    } finally {
      setLoading(false)
    }
  }

  const gpInfo = useMemo(() => {
    const calendarItem = F1_2026_CALENDAR.find((c) => c.round === currentRound)
    if (calendarItem) {
      return {
        name: calendarItem.name,
        country: calendarItem.country,
        flag: calendarItem.flag,
        circuit: calendarItem.circuit,
        laps: calendarItem.laps || 53,
        circuitLengthKm: calendarItem.circuitLengthKm || 5.2,
        characteristic: calendarItem.characteristic || 'Misto veloz com curvas técnicas',
        downforceIdeal: calendarItem.downforceIdeal ?? 6,
        suspensionIdeal: calendarItem.suspensionIdeal ?? 6,
        tireAbrasiveness: calendarItem.tireAbrasiveness ?? 6,
        lengthKm: calendarItem.circuitLengthKm || 5.2,
      }
    }
    return {
      name: `Grande Prêmio ${currentRound}`,
      country: 'Internacional',
      flag: '🏁',
      circuit: 'Autódromo Internacional',
      laps: 53,
      circuitLengthKm: 5.2,
      characteristic: 'Circuito misto de alta e média velocidade',
      downforceIdeal: 6,
      suspensionIdeal: 6,
      tireAbrasiveness: 6,
      lengthKm: 5.2,
    }
  }, [currentRound])

  // Gerador Procedural de Previsão do Tempo Dinâmica
  const forecast: WeatherForecast = useMemo(() => {
    const seed = currentRound * 17 + (season?.year || 2026)
    const prob = Math.round(((Math.sin(seed) + 1) / 2) * 100)
    let expectedCondition: WeatherForecast['expectedCondition'] = 'Ensolarado'
    let rainStart: number | undefined = undefined

    if (prob > 70) {
      expectedCondition = 'Tempestade'
      rainStart = Math.max(3, Math.floor(gpInfo.laps * 0.25))
    } else if (prob >= 50) {
      expectedCondition = 'Chuva Iminente'
      rainStart = Math.max(5, Math.floor(gpInfo.laps * 0.4))
    } else if (prob >= 35) {
      expectedCondition = 'Nublado com risco de chuva'
      rainStart = Math.max(8, Math.floor(gpInfo.laps * 0.5))
    } else if (prob >= 20) {
      expectedCondition = 'Parcialmente Nublado'
    }

    return {
      expectedCondition,
      probability: prob,
      airTemp: Math.round(21 + ((Math.cos(seed) + 1) / 2) * 12),
      trackTemp: Math.round(28 + ((Math.sin(seed * 2) + 1) / 2) * 18),
      rainLapStart: rainStart,
    }
  }, [currentRound, season?.year, gpInfo.laps])

  const weather: TrackWeatherState = useMemo(() => {
    if (forecast.probability > 70) return 'chuva_forte'
    if (forecast.probability >= 35) return 'chuva_fraca'
    return 'seco'
  }, [forecast.probability])

  // Status de Desgaste do Motor
  const currentEngine = useMemo(() => {
    const sup = team?.engine_supplier || 'Honda'
    return (
      ENGINE_SUPPLIERS.find((e) => e.name.toLowerCase() === sup.toLowerCase()) ||
      ENGINE_SUPPLIERS[0]
    )
  }, [team?.engine_supplier])

  const puPoolStatus = useMemo(() => {
    const wear = team?.active_engine_wear ?? 15
    const isCompromised = wear > 65
    const pacePenaltySec = isCompromised ? (wear - 65) * 0.03 : 0
    return {
      isCompromised,
      leastWornPu: { id: team?.engine_pool_used ?? 1, wear },
      leastWear: wear,
      pacePenaltySec,
      penaltyRisk: wear > 80,
    }
  }, [team?.active_engine_wear, team?.engine_pool_used])

  // Feedback do Conselheiro de Engenharia de Pista
  const setupFeedback = useMemo(() => {
    const cur = setups[activeSession]
    return analyzeSetupEngineering(cur, {
      round: currentRound,
      name: gpInfo.name,
      circuit: gpInfo.circuit,
      country: gpInfo.country,
      flag: gpInfo.flag,
      laps: gpInfo.laps,
      circuitLengthKm: gpInfo.lengthKm,
      characteristic: gpInfo.characteristic,
      downforceIdeal: gpInfo.downforceIdeal,
      suspensionIdeal: gpInfo.suspensionIdeal,
      tireAbrasiveness: gpInfo.tireAbrasiveness,
    })
  }, [setups, activeSession, gpInfo, currentRound])

  // Carga de combustível inicial na corrida (90% a 110%)
  const [raceInitialFuelPct, setRaceInitialFuelPct] = useState<number>(100)

  // Atualizar setup da sessão ativa
  const updateCurrentSetup = (field: keyof SessionSetupModel, value: any) => {
    setSetups((prev) => ({
      ...prev,
      [activeSession]: {
        ...prev[activeSession],
        [field]: value,
      },
    }))
  }

  // Salvar Setup no Banco
  const handleSaveSetup = async () => {
    if (!team || !season) return
    try {
      const cur = setups[activeSession]
      await f1Service.saveSessionSetup({
        team_id: team.id,
        season_id: season.id,
        round: currentRound,
        session: activeSession,
        wing_level: cur.wing_level,
        suspension_stiffness: cur.suspension_stiffness,
        pu_electric_ratio: cur.pu_electric_ratio,
        tire_compound: cur.tire_compound,
      })
      toast({
        title: 'Setup Salvo com Sucesso',
        description: `Configuração para ${activeSession.toUpperCase()} pronta para a pista.`,
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar setup',
        description: err?.message || 'Falha ao sincronizar com telemetria.',
      })
    }
  }

  // Funções de manipulação da Estratégia de Corrida por Piloto
  const getStrategyForDriver = (driver: DriverModel): DriverRaceStrategy => {
    if (driverStrategies[driver.id]) {
      return driverStrategies[driver.id]
    }
    // Estratégia padrão inicial: se clima for chuva, larga de intermediário, senão médio
    const defaultStartCompound: TireCompound =
      weather === 'chuva_forte'
        ? 'chuva_extrema'
        : weather === 'chuva_fraca'
          ? 'intermediario'
          : 'medio'
    const defaultSecondCompound: TireCompound =
      weather === 'chuva_forte'
        ? 'chuva_extrema'
        : weather === 'chuva_fraca'
          ? 'intermediario'
          : 'duro'
    const defaultPitLap = Math.max(12, Math.floor(gpInfo.laps * 0.45))

    return {
      driverId: driver.id,
      driverName: driver.name,
      startCompound: defaultStartCompound,
      pitStops: [
        {
          id: `pit_${driver.id}_1`,
          lap: defaultPitLap,
          compound: defaultSecondCompound,
        },
      ],
    }
  }

  const updateDriverStartCompound = (driverId: string, compound: TireCompound) => {
    setDriverStrategies((prev) => {
      const current =
        prev[driverId] || getStrategyForDriver(drivers.find((d) => d.id === driverId)!)
      return {
        ...prev,
        [driverId]: {
          ...current,
          startCompound: compound,
        },
      }
    })
  }

  const addDriverPitStop = (driverId: string) => {
    setDriverStrategies((prev) => {
      const current =
        prev[driverId] || getStrategyForDriver(drivers.find((d) => d.id === driverId)!)
      if (current.pitStops.length >= 4) {
        toast({
          title: 'Limite Atingido',
          description: 'A FIA permite programar até 4 paradas no plano tático de corrida.',
        })
        return prev
      }
      const lastLap =
        current.pitStops.length > 0
          ? current.pitStops[current.pitStops.length - 1].lap
          : Math.floor(gpInfo.laps * 0.3)
      const nextLap = Math.min(gpInfo.laps - 2, lastLap + 14)
      const nextPit = {
        id: `pit_${driverId}_${Date.now()}`,
        lap: nextLap,
        compound: 'duro' as TireCompound,
      }
      return {
        ...prev,
        [driverId]: {
          ...current,
          pitStops: [...current.pitStops, nextPit].sort((a, b) => a.lap - b.lap),
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
      const current =
        prev[driverId] || getStrategyForDriver(drivers.find((d) => d.id === driverId)!)
      const updatedPits = current.pitStops
        .map((p) => (p.id === pitId ? { ...p, [field]: value } : p))
        .sort((a, b) => a.lap - b.lap)
      return {
        ...prev,
        [driverId]: {
          ...current,
          pitStops: updatedPits,
        },
      }
    })
  }

  const removeDriverPitStop = (driverId: string, pitId: string) => {
    setDriverStrategies((prev) => {
      const current =
        prev[driverId] || getStrategyForDriver(drivers.find((d) => d.id === driverId)!)
      return {
        ...prev,
        [driverId]: {
          ...current,
          pitStops: current.pitStops.filter((p) => p.id !== pitId),
        },
      }
    })
  }

  // Estimativa de voltas sustentáveis por composto
  const calculateCompoundLaps = (compound: TireCompound) => {
    const spec = TIRE_SPECS[compound] || TIRE_SPECS.medio
    const baseWearPerLap = spec.wearFactor * ((gpInfo.tireAbrasiveness || 6) / 5)
    return Math.floor(80 / baseWearPerLap)
  }

  // Consumir jogo de pneu do estoque
  const consumeTireSet = (compound: TireCompound, targetDriverId?: string) => {
    setTireStock((prev) => ({
      ...prev,
      [compound]: Math.max(0, (prev[compound] || 0) - 1),
    }))

    // Atualiza também o inventário persistente do piloto correspondente
    if (season?.id && team?.id) {
      const dId =
        targetDriverId ||
        selectedDriverSetupId ||
        drivers.find((d) => d.team_id === team.id && d.role !== 'reserva')?.id
      if (dId && driverTireInventories[dId]) {
        const sets = driverTireInventories[dId]
        // Encontra o primeiro jogo livre com menos voltas/desgaste deste composto
        const freeSet = sets.find(
          (s) => s.compound === compound && !s.isFitted && (s.wear || 0) < 90,
        )
        if (freeSet) {
          const updatedSets = sets.map((s) => {
            if (s.id === freeSet.id) {
              const newWear = Math.min(100, (s.wear || 0) + 20)
              const newLaps = (s.lapsUsed || 0) + 8
              return {
                ...s,
                wear: newWear,
                condition: Math.max(0, 100 - newWear),
                lapsUsed: newLaps,
                status: 'usado' as const,
              }
            }
            return s
          })
          const nextInventories = {
            ...driverTireInventories,
            [dId]: updatedSets,
          }
          setDriverTireInventories(nextInventories)
          canonicalWeekendTyrePersistence.updateDriverInventory(
            season.id,
            currentRound,
            dId,
            updatedSets,
          )
        }
      }
    }
  }

  // Executar Sessão de Treino Livre (TP1, TP2) ou Quali (Q1, Q2, Q3)
  const handleRunSession = async (session: WeekendSession) => {
    if (!team) return
    setIsSimulatingSession(true)
    setSimProgress(10)

    const sessionNames: Record<WeekendSession, string> = {
      tp1: 'Treino Livre 1',
      tp2: 'Treino Livre 2',
      q1: 'Classificação - Q1 (Eliminação P16-P20)',
      q2: 'Classificação - Q2 (Eliminação P11-P15)',
      q3: 'Classificação - Q3 (Pole Position)',
      race: 'Grande Prêmio Oficial',
    }

    setSimText(`Iniciando telemetria: ${sessionNames[session]}...`)

    // Animação de progresso da simulação
    const timer = setInterval(() => {
      setSimProgress((prev) => {
        if (prev >= 90) {
          clearInterval(timer)
          return 95
        }
        return prev + 18
      })
    }, 180)

    setTimeout(async () => {
      clearInterval(timer)
      setSimProgress(100)

      // Simulação física da sessão
      const currentSetup = setups[session]
      const results = runPracticeQualySession(session, currentSetup)
      setSessionResults((prev) => ({ ...prev, [session]: results }))

      // Consumir pneu selecionado do estoque da equipe
      consumeTireSet(currentSetup.tire_compound || 'macio')

      // Marcar sessão como concluída
      setCompletedSessions((prev) => Array.from(new Set([...prev, session])))
      setIsSimulatingSession(false)

      toast({
        title: `${sessionNames[session]} Concluído`,
        description: `Melhor volta da equipe: ${results.find((r) => r.isPlayer)?.lapTime || '1:19.450'}.`,
      })

      // Transição automática de fluxo entre sessões
      if (session === 'tp1') setActiveSession('tp2')
      else if (session === 'tp2') setActiveSession('q1')
      else if (session === 'q1') setActiveSession('q2')
      else if (session === 'q2') setActiveSession('q3')
      else if (session === 'q3') setActiveSession('race')
    }, 1200)
  }

  // Motor Físico das Sessões de Treino Livre e Qualificação (Fase 1B.1 Canônica)
  const runPracticeQualySession = (
    session: WeekendSession,
    setup: SessionSetupModel,
  ): SessionTimeResult[] => {
    const competitors = getAICompetitors()
    const playerDrivers = drivers.filter((d) => d.team_id === team?.id && d.role !== 'reserva')
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const playerTeamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)
    const isQualifyingSession = session.startsWith('q')

    // 1. Resolução canônica de circuito para a rodada atual
    const circuitProfile = resolveCircuitProfile({ round: currentRound })

    // 2. Resolução canônica dos dados técnicos do carro do jogador
    const playerEnrichedTech = carTechnicalService.ensureTechnicalData(team)
    const playerTechAttributes = playerEnrichedTech.technical_attributes
    const playerChassisRating = playerEnrichedTech.calculated_overall || playerTeamStrength
    const playerPuSupplier = team?.engine_supplier || 'Audi'
    const playerPu = OFFICIAL_POWER_UNITS[playerPuSupplier] || OFFICIAL_POWER_UNITS.Audi
    const playerPuRating = Number(
      (playerPu.powerRating * 0.6 + playerPu.reliabilityRating * 0.4).toFixed(1),
    )
    const playerCarPerfRating = Number(
      (playerChassisRating * 0.7 + playerPuRating * 0.3).toFixed(1),
    )

    // Avaliar penalidade ou bônus de setup
    const downforcePenalty = Math.abs((setup.wing_level || 6) - (gpInfo.downforceIdeal || 6)) * 0.12
    const suspensionPenalty =
      Math.abs((setup.suspension_stiffness || 6) - (gpInfo.suspensionIdeal || 6)) * 0.1
    const setupDeltaSec = downforcePenalty + suspensionPenalty

    // Delta do composto
    const spec = TIRE_SPECS[setup.tire_compound || 'macio'] || TIRE_SPECS.macio
    const tirePaceDelta = spec.deltaPerLapSec

    // Base de tempo da volta no circuito
    const circuitBaseSec = gpInfo.lengthKm * 15.2

    // Competidores IA - contrato AICompetitor (strength, carLevel, driver1, driver2)
    const aiEntries: (SessionTimeResult & { lapTimeSec: number })[] = competitors.flatMap((ai) => {
      const driversInTeam = [
        { d: ai.driver1, slot: 1 },
        { d: ai.driver2, slot: 2 },
      ]

      // Resolução canônica dos atributos técnicos e PU de cada equipe rival IA
      const aiCleanKey = ai.id.replace('ai_', '')
      const aiTechData = carTechnicalService.getOrCreateTeamTechnicalData(
        aiCleanKey,
        ai.strengthRating || ai.strength || 75,
        ai.engine,
      )
      const aiChassisRating = aiTechData.calculatedOverall
      const aiSupplier = ai.engine || 'Ferrari'
      const aiPu = OFFICIAL_POWER_UNITS[aiSupplier] || OFFICIAL_POWER_UNITS.Ferrari
      const aiPuRating = Number((aiPu.powerRating * 0.6 + aiPu.reliabilityRating * 0.4).toFixed(1))
      const aiCarPerfRating = Number((aiChassisRating * 0.7 + aiPuRating * 0.3).toFixed(1))

      return driversInTeam.map(({ d, slot }) => {
        const paceResult = calculateCombinedPace({
          teamStrength: ai.strengthRating || ai.strength || 75,
          carLevel: ai.carLevel,
          driver: {
            speed: d.speed,
            consistency: d.consistency,
            defense: d.defense,
            rain: d.rain,
          },
          weather: 'seco',
          tireCompound: (isQualifyingSession ? 'macio' : 'medio') as TireCompound,
          trackAbrasiveness: gpInfo.tireAbrasiveness || 6,
          isQualifying: isQualifyingSession,
          technicalAttributes: aiTechData.attributes,
          circuit: circuitProfile,
          chassisRating: aiChassisRating,
          powerUnitRating: aiPuRating,
          carPerformanceRating: aiCarPerfRating,
        })
        const lapTimeSec =
          circuitBaseSec - (paceResult.lapScore / 100) * 3.5 + (Math.random() * 0.5 - 0.25)
        const tireUsed = (isQualifyingSession ? 'macio' : 'medio') as TireCompound
        return {
          position: 0,
          driverId: `${ai.id}_d${slot}`,
          driverName: d.name,
          teamName: ai.name,
          teamColor: ai.color,
          isPlayer: false,
          lapTime: formatLapTime(lapTimeSec),
          lapTimeSec,
          gap: '',
          tire: tireUsed,
        }
      })
    })

    // Pilotos do Jogador
    const playerEntries: (SessionTimeResult & { lapTimeSec: number })[] = playerDrivers.map(
      (pd) => {
        const paceResult = calculateCombinedPace({
          teamStrength: playerChassisRating,
          carLevel: team?.chassis_level ?? playerChassisRating,
          driver: {
            speed: pd.speed,
            consistency: pd.consistency,
            defense: pd.defense,
            morale: pd.morale,
            physicalCondition: pd.physical_condition,
          },
          weather: 'seco',
          tireCompound: (setup.tire_compound || 'macio') as TireCompound,
          trackAbrasiveness: gpInfo.tireAbrasiveness || 6,
          isQualifying: isQualifyingSession,
          technicalAttributes: playerTechAttributes,
          circuit: circuitProfile,
          chassisRating: playerChassisRating,
          powerUnitRating: playerPuRating,
          carPerformanceRating: playerCarPerfRating,
        })
        const lapTimeSec =
          circuitBaseSec -
          (paceResult.lapScore / 100) * 3.5 +
          setupDeltaSec +
          tirePaceDelta +
          (Math.random() * 0.3 - 0.15)
        const tireUsed = (setup.tire_compound || 'macio') as TireCompound
        return {
          position: 0,
          driverId: pd.id,
          driverName: pd.name,
          teamName: team?.name || 'Minha Escuderia',
          teamColor: team?.color || '#E10600',
          isPlayer: true,
          lapTime: formatLapTime(lapTimeSec),
          lapTimeSec,
          gap: '',
          tire: tireUsed,
        }
      },
    )

    const all = [...aiEntries, ...playerEntries].sort((a, b) => a.lapTimeSec - b.lapTimeSec)
    const leaderTime = all[0].lapTimeSec

    return all.map((entry, idx) => ({
      position: idx + 1,
      driverId: entry.driverId,
      driverName: entry.driverName,
      teamName: entry.teamName,
      teamColor: entry.teamColor,
      lapTime: entry.lapTime,
      gap: idx === 0 ? 'Líder' : formatGap(entry.lapTimeSec - leaderTime),
      tire: entry.tire,
      isPlayer: entry.isPlayer,
    }))
  }

  // INICIAR A CORRIDA (GRID OFICIAL FORMADO A PARTIR DO Q3 / Q1)
  const handleStartRace = () => {
    // Inicializa táticas dos carros do jogador
    const initialCarTactics: Record<string, 'attack' | 'normal' | 'save_fuel'> = {}
    const initialPaceOrders: Record<string, LivePaceOrder> = {}
    drivers
      .filter((d) => d.team_id === team?.id && d.role !== 'reserva')
      .forEach((d) => {
        initialCarTactics[d.id] = 'normal'
        initialPaceOrders[d.id] = 'normal'
      })
    setPlayerCarTactics(initialCarTactics)
    playerCarTacticsRef.current = initialCarTactics
    activeCarTacticsInLoopRef.current = initialCarTactics

    setPlayerPaceOrders(initialPaceOrders)
    playerPaceOrdersRef.current = initialPaceOrders
    activePaceOrdersInLoopRef.current = initialPaceOrders

    // Reinicia ref de uso do modo preserve_car para esta corrida
    hasUsedPreserveModeRef.current = false

    // Reseta estados FIA e Drama para o início da prova
    setPenalties([])
    setMechanicalIssues([])
    redFlagStateRef.current = {
      active: false,
      ticksFrozen: 0,
      usedThisRace: false,
      safetyCarLapsRemaining: 0,
    }
    setRedFlagState({ ...redFlagStateRef.current })
    teamOrdersRef.current = []
    setTeamOrders([])
    teamOrderProposalRef.current = null
    setTeamOrderProposal(null)
    teamOrderPaceModifierRef.current.clear()

    // Reseta controle de pausas e timers
    setIsRacePaused(false)
    isRacePausedRef.current = false
    if (liveRaceTimerRef.current) {
      clearInterval(liveRaceTimerRef.current)
      liveRaceTimerRef.current = null
    }

    // Se a corrida já estava em andamento mas pausada por incidente/SC, retoma do estado atual
    if (liveRaceState && liveRaceState.inProgress && liveRaceState.currentLap < gpInfo.laps) {
      setIsSimulatingSession(true)
      runLiveRaceLoop(liveRaceState.grid, liveRaceState.currentLap, liveRaceState.weather)
      return
    }

    // Formação inicial do Grid a partir dos resultados do Q3 (se existirem), senão grid simulado
    const qualyGrid = sessionResults['q3'] || sessionResults['q1']
    const competitors = getAICompetitors()
    const playerDrivers = drivers.filter((d) => d.team_id === team?.id && d.role !== 'reserva')
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const playerTeamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)

    let initialGrid: SimDriverEntry[] = []

    if (qualyGrid && qualyGrid.length > 0) {
      initialGrid = qualyGrid.map((q, idx) => {
        const isPlayer = !!q.isPlayer
        const playerDrv = isPlayer ? playerDrivers.find((pd) => pd.name === q.driverName) : null
        const playerStrat = playerDrv ? getStrategyForDriver(playerDrv) : null
        const startComp: TireCompound = isPlayer
          ? playerStrat?.startCompound || (weather !== 'seco' ? 'intermediario' : 'medio')
          : weather !== 'seco'
            ? 'intermediario'
            : idx % 2 === 0
              ? 'medio'
              : 'macio'
        const secondComp: TireCompound = isPlayer
          ? playerStrat?.pitStops[0]?.compound || 'duro'
          : weather !== 'seco'
            ? 'intermediario'
            : 'duro'
        const plannedPit = isPlayer
          ? playerStrat?.pitStops[0]?.lap || Math.round(gpInfo.laps * 0.45)
          : Math.round(gpInfo.laps * (0.38 + Math.random() * 0.2))

        const wearProfile = playerDrv
          ? calculateDriverTireWearProfile(playerDrv)
          : { multiplier: 1.0, profileName: 'Neutro' }

        const playerFlag = playerDrv ? getCountryFlag(playerDrv.nationality) || '🏁' : undefined

        const aiProfile = !isPlayer
          ? generateAIStrategyProfile({
              teamStrength: 75,
              driverSpeed: 82,
              driverConsistency: 82,
              totalLaps: gpInfo.laps,
              weather,
              gridPosition: idx + 1,
            })
          : undefined

        return {
          position: idx + 1,
          gridPosition: idx + 1,
          driverId: isPlayer ? playerDrv?.id || `drv_p_${idx}` : `drv_ai_${idx}`,
          driverName: q.driverName,
          teamId: isPlayer ? team?.id || 'team_player' : `team_ai_${idx}`,
          teamName: q.teamName,
          teamColor: q.teamColor,
          isPlayer,
          nationality: playerFlag,
          flag: playerFlag,
          score: 80,
          points: 0,
          fastestLap: false,
          usedOvertake: false,
          accumulatedTimeSec: 0,
          lastLapTimeSec: q.lapTimeSec,
          lastLapTime: q.lapTime,
          gapToLeader: idx === 0 ? 'Líder' : '+0.000s',
          gapToFront: '+0.000s',
          tireCompound: startComp,
          secondCompound: secondComp,
          pitLap: plannedPit,
          tireWear: 4,
          driverFatigue: 0,
          morale: isPlayer ? playerDrv?.morale || 85 : 80,
          physicalCondition: isPlayer ? playerDrv?.physical_condition || 90 : 85,
          pitStopsDone: 0,
          hasWingDamage: false,
          wearMultiplier: wearProfile.multiplier,
          wearProfileName: wearProfile.profileName,
          strategyPlan: playerStrat ? playerStrat.pitStops : undefined,
          lapsOnCurrentTire: 0,
          cliffStatus: INITIAL_OPTIMAL_CLIFF,
          fuelRemaining: raceInitialFuelPct,
          carPartsHealth: isPlayer
            ? parts.map((p) => ({
                id: p.id,
                name: p.name,
                condition: p.condition || 100,
              }))
            : undefined,
          aiStrategyProfile: aiProfile,
        }
      })
    } else {
      // Grid simulado rápido quando não jogou qualificação
      const aiList = competitors.flatMap((ai, aiIdx) => {
        const driversList = [
          { d: ai.driver1, slot: 1 },
          { d: ai.driver2, slot: 2 },
        ]
        return driversList.map(({ d, slot }, dIdx) => {
          const gridPos = aiIdx * 2 + dIdx + 1
          const aiProfile = generateAIStrategyProfile({
            teamStrength: ai.strengthRating || ai.strength || 75,
            driverSpeed: d.speed,
            driverConsistency: d.consistency,
            totalLaps: gpInfo.laps,
            weather,
            gridPosition: gridPos,
          })
          return {
            position: gridPos,
            gridPosition: gridPos,
            driverId: `${ai.id}_d${slot}`,
            driverName: d.name,
            teamId: ai.id,
            teamName: ai.name,
            teamColor: ai.color,
            isPlayer: false,
            score: 75,
            points: 0,
            fastestLap: false,
            usedOvertake: false,
            accumulatedTimeSec: 0,
            tireCompound: (weather !== 'seco'
              ? 'intermediario'
              : gridPos % 2 === 0
                ? 'medio'
                : 'macio') as TireCompound,
            secondCompound: (weather !== 'seco' ? 'intermediario' : 'duro') as TireCompound,
            pitLap: Math.round(gpInfo.laps * 0.45),
            tireWear: 4,
            driverFatigue: 0,
            pitStopsDone: 0,
            hasWingDamage: false,
            wearMultiplier: 1.0,
            wearProfileName: 'Neutro',
            lapsOnCurrentTire: 0,
            cliffStatus: INITIAL_OPTIMAL_CLIFF,
            fuelRemaining: 100,
            aiStrategyProfile: aiProfile,
          }
        })
      })

      const playerList = playerDrivers.map((pd, idx) => {
        const strat = getStrategyForDriver(pd)
        const wearProfile = calculateDriverTireWearProfile(pd)
        const flag = getCountryFlag(pd.nationality) || '🏁'

        return {
          position: 15 + idx,
          gridPosition: 15 + idx,
          driverId: pd.id,
          driverName: pd.name,
          teamId: team?.id || 'team_player',
          teamName: team?.name || 'Minha Escuderia',
          teamColor: team?.color || '#E10600',
          isPlayer: true,
          nationality: flag,
          flag,
          score: 75,
          points: 0,
          fastestLap: false,
          usedOvertake: false,
          accumulatedTimeSec: 0,
          tireCompound: strat.startCompound,
          secondCompound: strat.pitStops[0]?.compound || 'duro',
          pitLap: strat.pitStops[0]?.lap || Math.round(gpInfo.laps * 0.45),
          tireWear: 4,
          driverFatigue: 0,
          morale: pd.morale || 85,
          physicalCondition: pd.physical_condition || 90,
          pitStopsDone: 0,
          hasWingDamage: false,
          wearMultiplier: wearProfile.multiplier,
          wearProfileName: wearProfile.profileName,
          strategyPlan: strat.pitStops,
          lapsOnCurrentTire: 0,
          cliffStatus: INITIAL_OPTIMAL_CLIFF,
          fuelRemaining: raceInitialFuelPct,
          carPartsHealth: parts.map((p) => ({
            id: p.id,
            name: p.name,
            condition: p.condition || 100,
          })),
        }
      })

      initialGrid = [...aiList, ...playerList].sort((a, b) => a.position - b.position)
    }

    setLiveRaceState({
      inProgress: true,
      currentLap: 1,
      totalLaps: gpInfo.laps,
      weather: weather,
      grid: initialGrid,
    })
    setLiveEvents([
      {
        id: `ev_start_${Date.now()}`,
        lap: 1,
        type: 'overtake',
        message: `🟢 LARGADA AUTORIZADA! 20 carros aceleram rumo à curva 1 no ${gpInfo.name}!`,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
    ])
    setIsSimulatingSession(true)
    setActiveSession('race')
    runLiveRaceLoop(initialGrid, 1, weather)
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

    // 1. Resolução canônica de circuito para a corrida ao vivo (Fase 1B.2 Canônica)
    const circuitProfile = resolveCircuitProfile({ round: currentRound })

    // 2. Pré-computação técnica canônica única antes do loop de voltas:
    // Jogador:
    const playerEnrichedTech = carTechnicalService.ensureTechnicalData(team)
    const playerTechAttributes = playerEnrichedTech.technical_attributes
    const playerChassisRating = playerEnrichedTech.calculated_overall || playerTeamStrength
    const playerPuSupplier = team?.engine_supplier || 'Audi'
    const playerPu = OFFICIAL_POWER_UNITS[playerPuSupplier] || OFFICIAL_POWER_UNITS.Audi
    const playerPuRating = Number(
      (playerPu.powerRating * 0.6 + playerPu.reliabilityRating * 0.4).toFixed(1),
    )
    const playerCarPerfRating = Number(
      (playerChassisRating * 0.7 + playerPuRating * 0.3).toFixed(1),
    )

    // Rivais IA (mapa por teamId computado uma única vez fora do loop):
    const aiTechMap = new Map<
      string,
      {
        techAttributes: typeof playerTechAttributes
        chassisRating: number
        puRating: number
        carPerfRating: number
      }
    >()

    const competitorsList = getAICompetitors()
    competitorsList.forEach((ai) => {
      const aiCleanKey = ai.id.replace('ai_', '')
      const aiTechData = carTechnicalService.getOrCreateTeamTechnicalData(
        aiCleanKey,
        ai.strengthRating || ai.strength || 75,
        ai.engine,
      )
      const aiChassisRating = aiTechData.calculatedOverall
      const aiSupplier = ai.engine || 'Ferrari'
      const aiPu = OFFICIAL_POWER_UNITS[aiSupplier] || OFFICIAL_POWER_UNITS.Ferrari
      const aiPuRating = Number((aiPu.powerRating * 0.6 + aiPu.reliabilityRating * 0.4).toFixed(1))
      const aiCarPerfRating = Number((aiChassisRating * 0.7 + aiPuRating * 0.3).toFixed(1))

      const entry = {
        techAttributes: aiTechData.attributes,
        chassisRating: aiChassisRating,
        puRating: aiPuRating,
        carPerfRating: aiCarPerfRating,
      }
      aiTechMap.set(ai.id, entry)
      aiTechMap.set(aiCleanKey, entry)
    })

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
      liveRaceTimerRef.current = null
    }

    const timer = setInterval(() => {
      if (isRacePausedRef.current) {
        return
      }

      // FIAÇÃO PARTE 1 - a) Congelamento por Bandeira Vermelha
      if (redFlagStateRef.current.active && redFlagStateRef.current.ticksFrozen > 0) {
        const nextFrozen = redFlagStateRef.current.ticksFrozen - 1
        if (nextFrozen > 0) {
          redFlagStateRef.current = {
            ...redFlagStateRef.current,
            ticksFrozen: nextFrozen,
          }
          setRedFlagState({ ...redFlagStateRef.current })
          return // Mantém ordem congelada (pula cálculo de ritmo)
        } else {
          // Ao zerar: desativar bandeira, ativar safety car por 2 voltas, evento no feed
          redFlagStateRef.current = {
            active: false,
            ticksFrozen: 0,
            usedThisRace: true,
            safetyCarLapsRemaining: 2,
          }
          setRedFlagState({ ...redFlagStateRef.current })
          setSafetyCarActive(true)
          const nowStr = new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
          setLiveEvents((prev) => [
            {
              id: `ev_rf_restart_${Date.now()}`,
              lap: currentLap,
              type: 'safety_car',
              message: '🟢 Retomada atrás do SAFETY CAR',
              timestamp: nowStr,
            },
            ...prev,
          ])
          // Continua ou retorna este tick para retomar ritmo
        }
      }

      // Barreira de término síncrona: se já completou as voltas, encerra imediatamente
      if (currentLap >= totalLaps) {
        clearInterval(timer)
        liveRaceTimerRef.current = null
        finishRaceSimulation(currentGrid, currentWeather)
        return
      }

      // Incremento estritamente travado no total de voltas
      currentLap = Math.min(totalLaps, currentLap + 1)
      const pct = Math.min(99, Math.round((currentLap / totalLaps) * 100))
      setSimProgress(pct)
      setSimText(
        `Volta ${currentLap} de ${totalLaps} • ${gpInfo.circuit} • Velocidade ${simSpeed}x`,
      )

      // Sincroniza táticas e ordens de ritmo ativas no início da volta: as mudanças do jogador valem a partir da VOLTA SEGUINTE
      const currentActiveTactics = { ...activeCarTacticsInLoopRef.current }
      const currentActivePaceOrders = { ...activePaceOrdersInLoopRef.current }

      // Fator de facilidade de ultrapassagem do circuito atual
      const circuitOvertakeFactor = getCircuitOvertakeFactor(gpInfo.name, gpInfo.circuit)
      const currentTrackTemp = forecast.trackTemp || 35
      const overtakeEventsThisLap: LiveRaceEvent[] = []

      // FIAÇÃO PARTE 1 - b) & c) Quebras Mecânicas & Gatilho de Bandeira Vermelha
      const dramaContexts = currentGrid.map((entry) => {
        const tacticalMod = tacticalModifiersRef.current.get(entry.driverId)
        const isModActive = entry.isPlayer && tacticalMod && currentLap <= tacticalMod.expiresAtLap
        const playerTacticThisLap = entry.isPlayer
          ? currentActiveTactics[entry.driverId] || 'normal'
          : 'normal'
        const playerPaceOrderThisLap = entry.isPlayer
          ? currentActivePaceOrders[entry.driverId] || 'normal'
          : 'normal'
        const tacticalMode = isModActive ? tacticalMod.mode : playerTacticThisLap

        return {
          id: entry.driverId,
          name: entry.driverName,
          teamId: entry.teamId,
          position: entry.position || 99,
          accumulatedTimeSec: entry.accumulatedTimeSec || 0,
          gapToLeaderSec: 0,
          isPlayer: !!entry.isPlayer,
          dnf: !!entry.dnf,
          dnfReason: entry.dnfReason,
          carPartsHealth: entry.carPartsHealth,
          paceOrder: playerPaceOrderThisLap,
          tacticalMode: tacticalMode as any,
          hasWingDamage: !!entry.hasWingDamage,
        }
      })

      const mechRoll = rollMechanicalFailures(dramaContexts, currentLap, {
        isWet: currentWeather !== 'seco',
      })

      const newDnfsThisLap: { driverId: string; reason: string; driverName: string }[] = []

      // Processa novos DNFs de quebras graves
      if (mechRoll.newDnfs && mechRoll.newDnfs.length > 0) {
        mechRoll.newDnfs.forEach((nd) => {
          const gridCar = currentGrid.find((g) => g.driverId === nd.driverId)
          if (gridCar && !gridCar.dnf) {
            gridCar.dnf = true
            gridCar.dnfLap = currentLap
            gridCar.dnfReason = nd.reason
            newDnfsThisLap.push(nd)

            const nowStr = new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
            setLiveEvents((prev) => [
              {
                id: `ev_mech_dnf_${currentLap}_${nd.driverId}`,
                lap: currentLap,
                type: 'incident',
                message: `🚨 ${nd.reason} — ${nd.driverName}`,
                driverName: nd.driverName,
                teamColor: gridCar.teamColor,
                isPlayer: gridCar.isPlayer,
                timestamp: nowStr,
              },
              ...prev,
            ])
          }
        })
      }

      // Processa falhas mecânicas leves
      if (mechRoll.issues && mechRoll.issues.length > 0) {
        const lightIssues = mechRoll.issues.filter((iss) => !iss.isDnf)
        if (lightIssues.length > 0) {
          setMechanicalIssues((prev) => [...prev, ...lightIssues])
        }
      }

      // Mapa para consulta rápida de penalidades de ritmo por falha mecânica leve nesta volta
      const lightPenaltyMap = new Map<string, number>()
      mechRoll.issues.forEach((iss) => {
        if (!iss.isDnf && iss.pacePenaltySec) {
          lightPenaltyMap.set(
            iss.driverId,
            (lightPenaltyMap.get(iss.driverId) || 0) + iss.pacePenaltySec,
          )
        }
      })

      // c) Bandeira vermelha: em DNF grave novo, se !usedThisRace → shouldTriggerRedFlag
      if (newDnfsThisLap.length > 0 && !redFlagStateRef.current.usedThisRace) {
        const redFlagDecision = shouldTriggerRedFlag(newDnfsThisLap, redFlagStateRef.current)
        if (redFlagDecision.triggered) {
          redFlagStateRef.current = {
            active: true,
            ticksFrozen: 3,
            usedThisRace: true,
            safetyCarLapsRemaining: 0,
          }
          setRedFlagState({ ...redFlagStateRef.current })
          const nowStr = new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
          setLiveEvents((prev) => [
            {
              id: `ev_rf_trigger_${Date.now()}`,
              lap: currentLap,
              type: 'safety_car',
              message: '🟥 BANDEIRA VERMELHA — Corrida suspensa',
              timestamp: nowStr,
            },
            ...prev,
          ])
          // Interrompe o restante do loop nesta volta e mantém corrida congelada
          return
        }
      }

      // Ordenação anterior (ordem na pista antes da volta ser completada)
      const previousTrackOrder = [...currentGrid]
        .filter((c) => !c.dnf)
        .sort((a, b) => (a.position || 99) - (b.position || 99))

      // PASSO 1: Atualização de pneus, paradas planejadas/estratégicas e cálculo de ritmo livre
      const intermediateStates = currentGrid.map((entry) => {
        if (entry.dnf) return { entry, freeLapSec: 0, pitLossSec: 0, didPitThisLap: false }

        // Modificadores táticos do piloto: ordem de rádio temporária tem precedência, senão tática permanente do carro do jogador
        const tacticalMod = tacticalModifiersRef.current.get(entry.driverId)
        const isModActive = entry.isPlayer && tacticalMod && currentLap <= tacticalMod.expiresAtLap
        if (entry.isPlayer && tacticalMod && currentLap > tacticalMod.expiresAtLap) {
          tacticalModifiersRef.current.delete(entry.driverId)
        }

        // Tática ativa nesta volta para o carro do jogador (ataque, normal ou economizar combustível)
        const playerTacticThisLap: 'attack' | 'normal' | 'save_fuel' = entry.isPlayer
          ? currentActiveTactics[entry.driverId] || 'normal'
          : 'normal'

        const spec = TIRE_SPECS[entry.tireCompound || 'medio'] || TIRE_SPECS.medio
        const compoundWearRate = spec.wearFactor
        const driverMultiplier = entry.wearMultiplier ?? 1.0

        // Dirty air extra wear: +0.35% a +0.65%/volta a partir da 3ª volta seguida em dirty air
        const dirtyAirExtraWear = (entry.lapsInDirtyAir || 0) >= 3 ? 0.35 + Math.random() * 0.3 : 0

        // Modificador de desgaste de pneus:
        // - Ataque: +30% desgaste (1.30)
        // - Economizar: -25% desgaste (0.75)
        // - Ordem temporária 'preserve': 0.75
        // - Ordem de ritmo ao vivo: 'segurar' = desgaste ×0.65; 'empurrar' = desgaste ×1.25; 'normal' = neutro
        let tireWearMultiplier = 1.0
        const playerPaceOrderThisLap = entry.isPlayer
          ? currentActivePaceOrders[entry.driverId] || 'normal'
          : 'normal'

        if (entry.isPlayer) {
          if (isModActive && tacticalMod.mode === 'preserve') {
            tireWearMultiplier = 0.75
          } else if (playerTacticThisLap === 'attack') {
            tireWearMultiplier = 1.3
          } else if (playerTacticThisLap === 'save_fuel') {
            tireWearMultiplier = 0.75
          }

          if (playerPaceOrderThisLap === 'segurar') {
            tireWearMultiplier *= 0.65
          } else if (playerPaceOrderThisLap === 'empurrar') {
            tireWearMultiplier *= 1.25
          }
        }
        const inc =
          ((compoundWearRate * (abrasiveness / 5)) / 1.5) * driverMultiplier * tireWearMultiplier +
          dirtyAirExtraWear
        let currentWear = Math.min(100, Math.round((entry.tireWear || 5) + inc))

        // Consumo de combustível proporcional ao modo tático e ordem de ritmo:
        // - Normal: ~1.75% por volta
        // - Ataque / Empurrar: ~2.15% por volta (+23%)
        // - Economizar / Segurar: ~1.40% por volta (-20%)
        let fuelBurnRate = 1.75
        if (entry.isPlayer) {
          if (playerTacticThisLap === 'attack' || playerPaceOrderThisLap === 'empurrar') {
            fuelBurnRate = 2.15
          } else if (
            playerTacticThisLap === 'save_fuel' ||
            playerPaceOrderThisLap === 'segurar' ||
            (isModActive && tacticalMod.mode === 'save_fuel')
          ) {
            fuelBurnRate = 1.4
          }
        }
        const updatedFuelRemaining = Math.max(
          0,
          (entry.fuelRemaining !== undefined ? entry.fuelRemaining : 100) - fuelBurnRate,
        )

        // Cálculo de ritmo livre de volta via F1 Pace Model e Race Sim Engine
        const teamStrength = entry.isPlayer ? playerTeamStrength : 75

        // Verificação se deve parar nos boxes nesta volta
        let didPit = false
        let pitLoss = 0

        // Piloto jogador: verifica plano de paradas programadas
        if (entry.isPlayer && entry.strategyPlan && entry.strategyPlan.length > 0) {
          const plannedPit = entry.strategyPlan.find((p) => p.lap === currentLap)
          if (plannedPit) {
            didPit = true
            const pitResult = calculatePitStopDuration(
              entry.teamName,
              entry.driverName,
              true,
              teamStrength,
            )
            pitLoss = pitResult.durationSec
            entry.tireCompound = plannedPit.compound
            currentWear = 2
            entry.lapsOnCurrentTire = 0
            entry.pitStopsDone = (entry.pitStopsDone || 0) + 1

            // Consumir pneu do estoque
            consumeTireSet(plannedPit.compound)

            const nowStr = new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
            setLiveEvents((prev) => [
              {
                id: `ev_pit_plan_${currentLap}_${entry.driverId}`,
                lap: currentLap,
                type: 'pit_stop',
                message: `🔧 PIT STOP PROGRAMADO! ${entry.driverName} nos boxes: calçou pneus novos (${formatTireName(plannedPit.compound)}). Parada realizada em ${pitLoss.toFixed(2)}s.`,
                driverName: entry.driverName,
                teamColor: entry.teamColor,
                isPlayer: true,
                timestamp: nowStr,
              },
              ...prev,
            ])
          }
        } else if (!entry.isPlayer && entry.pitLap === currentLap && !didPit) {
          // IA parada prevista
          didPit = true
          pitLoss = 21.5 + Math.random() * 2.5
          entry.tireCompound = entry.secondCompound || 'duro'
          currentWear = 3
          entry.lapsOnCurrentTire = 0
          entry.pitStopsDone = (entry.pitStopsDone || 0) + 1
        }

        // Atualiza estado de desgaste e cliff
        const cliffStatus = calculateTireCliffStatus({
          compound: entry.tireCompound || 'medio',
          lapsOnTire: entry.lapsOnCurrentTire || 0,
          wearPercent: currentWear,
          wearMultiplier: entry.wearMultiplier || 1.0,
          trackAbrasiveness: abrasiveness,
          trackTemp: currentTrackTemp,
          isAttacking: playerTacticThisLap === 'attack',
        })
        const isCliffActive = isTireInCliff(
          entry.tireCompound || 'medio',
          entry.lapsOnCurrentTire || 0,
          entry.wearMultiplier || 1.0,
          abrasiveness,
        )

        entry.tireWear = currentWear
        entry.cliffStatus = cliffStatus
        entry.lapsOnCurrentTire = (entry.lapsOnCurrentTire || 0) + 1
        entry.fuelRemaining = updatedFuelRemaining

        // Modificador de ordem de equipe ativa (FIAÇÃO PARTE 1 - d)
        let teamOrderDeltaSec = 0
        const activeOrderMod = teamOrderPaceModifierRef.current.get(entry.driverId)
        if (activeOrderMod && currentLap <= activeOrderMod.expiresAtLap) {
          teamOrderDeltaSec = activeOrderMod.deltaSec
        } else if (activeOrderMod && currentLap > activeOrderMod.expiresAtLap) {
          teamOrderPaceModifierRef.current.delete(entry.driverId)
        }

        // Modificador de falha mecânica leve (FIAÇÃO PARTE 1 - b)
        const lightIssuePacePenalty = lightPenaltyMap.get(entry.driverId) || 0

        // Resolução técnica canônica para o participante (Jogador vs IA)
        const aiCleanKey = (entry.teamId || '').replace('team_ai_', '').replace('ai_', '')
        const aiResolved = aiTechMap.get(entry.teamId || '') ||
          aiTechMap.get(aiCleanKey) || {
            techAttributes: undefined,
            chassisRating: 75,
            puRating: 90,
            carPerfRating: 79.5,
          }

        const activeChassisRating = entry.isPlayer ? playerChassisRating : aiResolved.chassisRating
        const activePuRating = entry.isPlayer ? playerPuRating : aiResolved.puRating
        const activeCarPerfRating = entry.isPlayer ? playerCarPerfRating : aiResolved.carPerfRating
        const activeTechAttributes = entry.isPlayer
          ? playerTechAttributes
          : aiResolved.techAttributes

        const freeLapResult = calculateFreeLapPaceSec({
          teamStrength: activeChassisRating,
          carLevel: activeChassisRating,
          driver: {
            speed: entry.score,
            morale: entry.morale,
            physicalCondition: entry.physicalCondition,
          },
          weather: currentWeather,
          tireCompound: entry.tireCompound || 'medio',
          lapsOnTire: entry.lapsOnCurrentTire || 0,
          wearPercent: currentWear,
          wearMultiplier: entry.wearMultiplier || 1.0,
          trackAbrasiveness: abrasiveness,
          trackTemp: currentTrackTemp,
          hasWingDamage: !!entry.hasWingDamage,
          tacticalMode:
            playerTacticThisLap === 'attack'
              ? 'attack'
              : playerTacticThisLap === 'save_fuel'
                ? 'preserve'
                : undefined,
          technicalAttributes: activeTechAttributes,
          circuit: circuitProfile,
          chassisRating: activeChassisRating,
          powerUnitRating: activePuRating,
          carPerformanceRating: activeCarPerfRating,
        })

        const freeLapSec = freeLapResult.freeLapSec + teamOrderDeltaSec + lightIssuePacePenalty

        return {
          entry,
          freeLapSec,
          pitLossSec: pitLoss,
          didPitThisLap: didPit,
        }
      })

      // PASSO 2: Ordenação por tempo acumulado + tempo da volta livre
      // Determina disputas roda a roda, sucção de vácuo (dirty air) e tentativas de ultrapassagem
      const sortedByRawPace = [...intermediateStates]
        .filter((s) => !s.entry.dnf)
        .sort((a, b) => {
          const timeA = (a.entry.accumulatedTimeSec || 0) + a.freeLapSec + a.pitLossSec
          const timeB = (b.entry.accumulatedTimeSec || 0) + b.freeLapSec + b.pitLossSec
          return timeA - timeB
        })

      // Processamento de disputas de posição e avaliação de ultrapassagem (Dirty Air & DRS/Attack)
      for (let i = 1; i < sortedByRawPace.length; i++) {
        const chasing = sortedByRawPace[i].entry
        const defending = sortedByRawPace[i - 1].entry

        // Se o carro de trás estava atrás na pista na volta anterior, precisa de sucesso na ultrapassagem
        const wasBehind =
          (previousTrackOrder.find((c) => c.driverId === chasing.driverId)?.position || 99) >
          (previousTrackOrder.find((c) => c.driverId === defending.driverId)?.position || 0)

        if (wasBehind) {
          // Diferença de ritmo natural entre os dois
          const rawDeltaSec =
            defending.accumulatedTimeSec +
            sortedByRawPace[i - 1].freeLapSec +
            sortedByRawPace[i - 1].pitLossSec -
            (chasing.accumulatedTimeSec +
              sortedByRawPace[i].freeLapSec +
              sortedByRawPace[i].pitLossSec)

          const tacticalMod = tacticalModifiersRef.current.get(chasing.driverId)
          const isAttacking =
            (chasing.isPlayer && currentActiveTactics[chasing.driverId] === 'attack') ||
            (tacticalMod && tacticalMod.mode === 'attack') ||
            (!chasing.isPlayer && chasing.aiStrategyProfile?.type === 'agressiva')

          const attempt = evaluateOvertakeAttempt({
            attacker: {
              ...chasing,
              driverName:
                chasing.driverName ||
                drivers.find((d) => d.id === chasing.driverId)?.name ||
                'Piloto Atacante',
              teamId: chasing.teamId || chasing.teamName || 'team_unknown',
              teamName: chasing.teamName || 'Equipe',
              teamColor: chasing.teamColor || '#E10600',
              isPlayer: !!chasing.isPlayer,
              flag: chasing.flag || '🏁',
              position: chasing.position || i + 1,
              score: chasing.score || 75,
              accumulatedTimeSec: chasing.accumulatedTimeSec || 0,
              dnf: !!chasing.dnf,
            },
            target: {
              ...defending,
              driverName:
                defending.driverName ||
                drivers.find((d) => d.id === defending.driverId)?.name ||
                'Piloto Alvo',
              teamId: defending.teamId || defending.teamName || 'team_unknown',
              teamName: defending.teamName || 'Equipe',
              teamColor: defending.teamColor || '#8B95A7',
              isPlayer: !!defending.isPlayer,
              flag: defending.flag || '🏁',
              position: defending.position || i,
              score: defending.score || 75,
              accumulatedTimeSec: defending.accumulatedTimeSec || 0,
              dnf: !!defending.dnf,
            },
            attackerFreePaceSec: sortedByRawPace[i].freeLapSec,
            targetFreePaceSec: sortedByRawPace[i - 1].freeLapSec,
            circuitOvertakeFactor,
            currentLap,
            hasOvertakeEnergy: isAttacking,
          })

          if (!attempt.success) {
            // Ultrapassagem frustrada: carro de trás fica preso em dirty air
            sortedByRawPace[i].freeLapSec += attempt.attackerTimePenaltySec || 0.4
            chasing.lapsInDirtyAir = (chasing.lapsInDirtyAir || 0) + 1
          } else {
            // Ultrapassagem com sucesso: limpa contador de dirty air
            chasing.lapsInDirtyAir = 0

            // Evento no feed se envolve jogador ou Top 5
            if (chasing.isPlayer || defending.isPlayer || i <= 5) {
              const nowStr = new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
              overtakeEventsThisLap.push({
                id: `ev_otk_${currentLap}_${chasing.driverId}_${defending.driverId}`,
                lap: currentLap,
                type: 'overtake',
                message:
                  attempt.narrativeMessage ||
                  `🟢 ULTRAPASSAGEM! ${chasing.driverName} superou ${defending.driverName} na volta ${currentLap}!`,
                driverName: chasing.driverName,
                teamColor: chasing.teamColor,
                isPlayer: chasing.isPlayer,
                timestamp: nowStr,
              })
            }
          }
        } else {
          chasing.lapsInDirtyAir = 0
        }
      }

      // PASSO 3: Atualização final dos tempos acumulados nesta volta
      intermediateStates.forEach((state) => {
        if (!state.entry.dnf) {
          const lapTotalSec = state.freeLapSec + state.pitLossSec
          state.entry.accumulatedTimeSec = (state.entry.accumulatedTimeSec || 0) + lapTotalSec
          state.entry.lastLapTimeSec = lapTotalSec
          state.entry.lastLapTime = formatLapTime(lapTotalSec)
        }
      })

      // Ordena grid final da volta por tempo total acumulado
      const activeSortedGrid = intermediateStates
        .filter((s) => !s.entry.dnf)
        .sort((a, b) => a.entry.accumulatedTimeSec - b.entry.accumulatedTimeSec)

      const leaderAccumulated =
        activeSortedGrid.length > 0 ? activeSortedGrid[0].entry.accumulatedTimeSec : 0

      activeSortedGrid.forEach((item, idx) => {
        item.entry.position = idx + 1
        item.entry.gapToLeader =
          idx === 0 ? 'Líder' : formatGap(item.entry.accumulatedTimeSec - leaderAccumulated)

        if (idx > 0) {
          const frontAccumulated = activeSortedGrid[idx - 1].entry.accumulatedTimeSec
          item.entry.gapToFront = formatGap(item.entry.accumulatedTimeSec - frontAccumulated)
        } else {
          item.entry.gapToFront = '+0.000s'
        }
      })

      // Pilotos DNF vão para o fim do grid
      const dnfSortedGrid = intermediateStates.filter((s) => s.entry.dnf)
      dnfSortedGrid.forEach((item, idx) => {
        item.entry.position = activeSortedGrid.length + idx + 1
        item.entry.gapToLeader = 'ABANDONO'
        item.entry.gapToFront = '-'
      })

      const finalOrderedGrid = [
        ...activeSortedGrid.map((s) => s.entry),
        ...dnfSortedGrid.map((s) => s.entry),
      ]

      // Volta Mais Rápida: identifica o piloto com o menor tempo registrado até o momento
      let fastestTimeSec = 9999
      let fastestDriverId = ''
      finalOrderedGrid.forEach((car) => {
        car.fastestLap = false
        if (!car.dnf && car.lastLapTimeSec && car.lastLapTimeSec < fastestTimeSec) {
          fastestTimeSec = car.lastLapTimeSec
          fastestDriverId = car.driverId
        }
      })
      const flEntry = finalOrderedGrid.find((c) => c.driverId === fastestDriverId)
      if (flEntry) flEntry.fastestLap = true

      // Conclui volta: atualiza referências ativas para a próxima volta (mudanças feitas pelo jogador passam a valer)
      activeCarTacticsInLoopRef.current = { ...playerCarTacticsRef.current }
      activePaceOrdersInLoopRef.current = { ...playerPaceOrdersRef.current }

      // Eventos narrativos periódicos (desgastes, ultrapassagens na pista, pits de IA)
      const periodicEvents = generateLapNarratedEvents(currentLap, finalOrderedGrid, currentWeather)
      const allEventsThisLap = [...overtakeEventsThisLap, ...periodicEvents]

      if (allEventsThisLap.length > 0) {
        setLiveEvents((prev) => [...allEventsThisLap, ...prev])
      }

      // Sincroniza estado de volta ao vivo
      setLiveRaceState({
        inProgress: currentLap < totalLaps,
        currentLap,
        totalLaps,
        weather: currentWeather,
        grid: finalOrderedGrid,
      })

      // Atualiza ref da tela
      currentGrid = finalOrderedGrid

      // Safety Car Laps Remaining check (FIAÇÃO PARTE 1 - a)
      if (redFlagStateRef.current.safetyCarLapsRemaining > 0) {
        redFlagStateRef.current.safetyCarLapsRemaining -= 1
        if (redFlagStateRef.current.safetyCarLapsRemaining === 0) {
          setSafetyCarActive(false)
          const nowStr = new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
          setLiveEvents((prev) => [
            {
              id: `ev_sc_in_${Date.now()}`,
              lap: currentLap,
              type: 'safety_car',
              message: '🟢 SAFETY CAR IN THIS LAP — Corrida reiniciada em bandeira verde!',
              timestamp: nowStr,
            },
            ...prev,
          ])
        }
      }

      // FIAÇÃO PARTE 1 - e) Investigação e Penalidades FIA
      if (currentLap % 4 === 0) {
        const incidentCandidates: IncidentEventInput[] = []
        // Avalia pilotos com toques ou disputas próximas
        for (let i = 1; i < finalOrderedGrid.length; i++) {
          const c1 = finalOrderedGrid[i]
          const c2 = finalOrderedGrid[i - 1]
          if (
            !c1.dnf &&
            !c2.dnf &&
            c1.lastLapTimeSec &&
            c2.lastLapTimeSec &&
            Math.abs(c1.lastLapTimeSec - c2.lastLapTimeSec) < 0.25
          ) {
            incidentCandidates.push({
              driverId: c1.driverId,
              driverName: c1.driverName,
              kind: Math.random() < 0.3 ? 'collision_light' : 'chicane_cut',
              isPushing: playerPaceOrdersRef.current[c1.driverId] === 'empurrar',
            })
          }
        }

        if (incidentCandidates.length > 0) {
          const fiaEval = evaluateFiaIncidents(incidentCandidates, currentLap, penalties)
          if (fiaEval.newPenalties.length > 0) {
            setPenalties((prev) => [...prev, ...fiaEval.newPenalties])
          }
          if (fiaEval.narrativeEvents.length > 0) {
            const nowStr = new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
            const eventsToAdd: LiveRaceEvent[] = fiaEval.narrativeEvents.map((msg, eIdx) => ({
              id: `ev_fia_${currentLap}_${eIdx}_${Date.now()}`,
              lap: currentLap,
              type: 'incident',
              message: msg,
              timestamp: nowStr,
            }))
            setLiveEvents((prev) => [...eventsToAdd, ...prev])
          }
        }
      }

      // FIAÇÃO PARTE 1 - d) Propostas de Ordem de Equipe (Team Order)
      if (currentLap > 3 && currentLap < totalLaps - 3) {
        const playerCars = finalOrderedGrid.filter((g) => g.isPlayer && !g.dnf)
        if (playerCars.length === 2) {
          const carA = playerCars[0]
          const carB = playerCars[1]
          const driverA = drivers.find((d) => d.id === carA.driverId)
          const driverB = drivers.find((d) => d.id === carB.driverId)

          if (driverA && driverB) {
            const proposal = avaliarTeamOrder(
              [
                {
                  id: carA.driverId,
                  name: carA.driverName,
                  position: carA.position,
                  morale: carA.morale || driverA.morale || 80,
                  personality: driverA.psychology_data?.personality || 'equilibrado',
                  isPlayer: true,
                },
                {
                  id: carB.driverId,
                  name: carB.driverName,
                  position: carB.position,
                  morale: carB.morale || driverB.morale || 80,
                  personality: driverB.psychology_data?.personality || 'equilibrado',
                  isPlayer: true,
                },
              ],
              currentLap,
              teamOrdersRef.current.length > 0
                ? teamOrdersRef.current[teamOrdersRef.current.length - 1]
                : null,
            )

            if (proposal && !teamOrderProposalRef.current) {
              teamOrderProposalRef.current = proposal
              setTeamOrderProposal(proposal)
            }
          }
        }
      }

      // Verificação de Término de Prova
      if (currentLap >= totalLaps) {
        clearInterval(timer)
        liveRaceTimerRef.current = null
        finishRaceSimulation(finalOrderedGrid, currentWeather)
      }
    }, stepIntervalMs)

    liveRaceTimerRef.current = timer
  }

  // Manipulador para aplicar proposta de ordem de equipe
  const handleApplyTeamOrder = () => {
    if (!teamOrderProposalRef.current) return
    const proposal = teamOrderProposalRef.current
    const driverSlow = drivers.find((d) => d.id === proposal.slowDriverId)

    const currentState: TeamOrderState = {
      fastDriverId: proposal.fastDriverId,
      slowDriverId: proposal.slowDriverId,
      lapsPushed: proposal.lapsPushed,
      active: true,
      cooldownLaps: 0,
      refused: false,
    }

    const slowDramaContext: DriverDramaContext = {
      id: proposal.slowDriverId,
      name: proposal.slowDriverName,
      personality: driverSlow?.psychology_data?.personality || 'equilibrado',
      morale: driverSlow?.morale ?? 80,
      isPlayer: true,
    }

    const orderResult = aplicarTeamOrder(
      currentState,
      slowDramaContext,
      proposal.fastDriverName,
      proposal.gap,
    )

    teamOrdersRef.current.push(orderResult.state)
    setTeamOrders([...teamOrdersRef.current])

    // Aplica penalidade/bônus de ritmo via teamOrderPaceModifierRef
    if (orderResult.state.active && !orderResult.state.refused) {
      teamOrderPaceModifierRef.current.set(proposal.slowDriverId, {
        deltaSec: 0.8,
        expiresAtLap: (liveRaceState?.currentLap || 1) + 2,
      })
      teamOrderPaceModifierRef.current.set(proposal.fastDriverId, {
        deltaSec: -orderResult.paceModifierSec,
        expiresAtLap: (liveRaceState?.currentLap || 1) + 2,
      })
    }

    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setLiveEvents((prev) => [
      {
        id: `ev_to_applied_${Date.now()}`,
        lap: liveRaceState?.currentLap || 1,
        type: 'team_radio',
        message: orderResult.radioMessage,
        driverName: proposal.slowDriverName,
        teamColor: team?.color || '#E10600',
        isPlayer: true,
        timestamp: nowStr,
      },
      ...prev,
    ])

    // Limpa proposta atual
    teamOrderProposalRef.current = null
    setTeamOrderProposal(null)

    toast({
      title: 'Ordem de Equipe Transmitida',
      description: orderResult.refused
        ? `${proposal.slowDriverName} recusou ceder a posição!`
        : `${proposal.slowDriverName} acatou a ordem e abrirá passagem.`,
    })
  }

  // Finalização da Corrida & Distribuição de Pontos Oficiais
  const finishRaceSimulation = (grid: SimDriverEntry[], finalWeather: TrackWeatherState) => {
    setIsSimulatingSession(false)
    setSimProgress(100)
    setSimText('Bandeira Quadriculada! Corrida Concluída.')

    // Aplica penalidades da FIA pendentes aos resultados finais (FIAÇÃO PARTE 1 - e)
    const penalizedGrid = applyPenaltiesToResults(grid, penalties)

    // Tabela oficial de pontuação F1 (P1 a P10)
    const pointsMap = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    const finalGrid = penalizedGrid.map((entry) => {
      let pts = 0
      if (!entry.dnf && entry.position <= 10) {
        pts = pointsMap[entry.position - 1] || 0
      }
      if (!entry.dnf && entry.fastestLap && entry.position <= 10) {
        pts += 1
      }
      return {
        ...entry,
        points: pts,
      }
    })

    setRaceResults(finalGrid)
    setCompletedSessions((prev) => Array.from(new Set([...prev, 'race'])))
    setLiveRaceState((prev) => (prev ? { ...prev, inProgress: false, grid: finalGrid } : null))

    const winner = finalGrid[0]
    toast({
      title: '🏁 Bandeira Quadriculada!',
      description: `Vitória de ${winner.driverName} (${winner.teamName}) no ${gpInfo.name}!`,
    })
  }

  // Wrapper async do avanço de rodada chamando o módulo desacoplado raceAdvance.ts
  const handleAdvanceRound = async () => {
    await advanceRound({
      raceResults,
      team,
      season,
      currentRound,
      totalRounds,
      gpInfo,
      sponsors,
      drivers,
      parts,
      setups,
      currentEngine,
      user,
      hasUsedPreserveMode: hasUsedPreserveModeRef.current,
      toast,
      navigate,
      refreshTeamAndSeason,
      setSeasonCompleted,
      setIsProcessingSillySeason,
      setMarketMoves,
      setSillySeasonModalOpen,
      setIsFinishing,
    })
  }

  // Manipulador para abrir parada forçada nos boxes
  const handleOpenForcePitModal = () => {
    wasPausedBeforeForcePitRef.current = isRacePausedRef.current
    setIsRacePaused(true)
    const activeCars = liveRaceState?.grid?.filter((g) => g.isPlayer && !g.dnf) || []
    if (activeCars.length > 0) {
      setForcePitSelectedDriverId(activeCars[0].driverId)
      const sets = (driverTireInventories[activeCars[0].driverId] || playerTireSets).filter(
        (s) => !s.isFitted && s.wear < 90,
      )
      if (sets.length > 0) {
        setForcePitSelectedSetId(sets[0].id)
      }
    }
    setForcePitModalOpen(true)
  }

  const handleCloseForcePitModal = () => {
    setForcePitModalOpen(false)
    if (!wasPausedBeforeForcePitRef.current) {
      setIsRacePaused(false)
    }
  }

  // Executar Parada de Emergência Solicitada
  const handleExecuteForcedPitStop = () => {
    if (!forcePitSelectedDriverId || !liveRaceState) return
    const car = liveRaceState.grid.find((g) => g.driverId === forcePitSelectedDriverId)
    if (!car) return

    const driverInventory = driverTireInventories[forcePitSelectedDriverId] || playerTireSets
    const chosenSet = driverInventory.find((s) => s.id === forcePitSelectedSetId)
    const newCompound = chosenSet?.compound || 'duro'

    // Duração da parada
    const pitTiming = calculatePitStopDuration(
      car.teamName,
      car.driverName,
      car.isPlayer,
      team?.chassis_level || 75,
    )
    const pitDurationSec = pitTiming.durationSec

    // Atualiza piloto no grid
    car.tireCompound = newCompound
    car.tireWear = chosenSet ? chosenSet.wear : 4
    car.hasWingDamage = false
    car.lapsOnCurrentTire = 0
    car.pitStopsDone = (car.pitStopsDone || 0) + 1
    car.accumulatedTimeSec = (car.accumulatedTimeSec || 0) + pitDurationSec

    // Marca pneu no inventário como usado
    if (chosenSet) {
      chosenSet.isFitted = true
      chosenSet.wear += 3
    }

    const nowStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    setLiveEvents((prev) => [
      {
        id: `ev_force_pit_${Date.now()}_${car.driverId}`,
        lap: liveRaceState.currentLap,
        type: 'pit_stop',
        message: `🔧 PARADA DE EMERGÊNCIA! ${car.driverName} entrou nos boxes: substituição de pneus (${formatTireName(newCompound)}) realizada em ${pitDurationSec.toFixed(2)}s.`,
        driverName: car.driverName,
        teamColor: car.teamColor,
        isPlayer: true,
        timestamp: nowStr,
      },
      ...prev,
    ])

    handleCloseForcePitModal()
    toast({
      title: `Box Realizado — ${car.driverName}`,
      description: `Pneus ${formatTireName(newCompound)} instalados. Duração: ${pitDurationSec.toFixed(2)}s.`,
    })
  }

  // Decisões de Chuva
  const handleConfirmRainDecision = (
    decision: 'intermediario' | 'chuva_extrema' | 'macio' | 'medio' | 'duro' | 'aguardar',
  ) => {
    // Implementação direta das decisões de chuva no grid
    setRainDecisionOpen(false)
    setIsRacePaused(false)
  }

  // Decisões de Asa Quebrada
  const handleConfirmWingDamageDecision = (decision: 'pit_trocar' | 'continuar') => {
    setWingDamageModalOpen(false)
    setIsRacePaused(false)
  }

  // Decisões de Safety Car
  const handleConfirmSafetyCarDecision = (decision: 'pit_sc' | 'stay_out') => {
    setSafetyCarModalOpen(false)
    setIsRacePaused(false)
  }

  // Silly Season e Mercado de Pilotos
  const handleOpenSillySeason = async () => {
    if (!season || !team) return
    setIsProcessingSillySeason(true)
    try {
      const moves = await f1Service.processEndOfSeasonMarket(season.id, team.id)
      setMarketMoves(moves)
      setSillySeasonModalOpen(true)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao carregar Silly Season',
        description: err?.message || 'Tente novamente.',
      })
    } finally {
      setIsProcessingSillySeason(false)
    }
  }

  const handleStartNextSeason = async () => {
    setIsStartingNewSeason(true)
    try {
      // Inicia novo ano de campeonato oficial
      await refreshTeamAndSeason()
      setSillySeasonModalOpen(false)
      navigate('/calendar')
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao iniciar temporada',
        description: err?.message || 'Tente novamente.',
      })
    } finally {
      setIsStartingNewSeason(false)
    }
  }

  return (
    <div className="relative space-y-8 animate-fade-in-up">
      <AmbientBackground />
      {/* Header oficial da fundação Race Operations */}
      <PageHeader
        eyebrow="RACE OPERATIONS // FIM DE SEMANA"
        title={`${gpInfo.name} • ${gpInfo.country} ${gpInfo.flag}`}
        description={
          <span>
            {gpInfo.circuit} • Regulamento Oficial FIA 2026 • Sessões de Treino Livre (TP1, TP2),
            Classificação Tripla (Q1, Q2, Q3) e Corrida Principal com telemetria ao vivo.
          </span>
        }
        badge={
          <span className="px-2.5 py-1 rounded-md text-xs font-num font-semibold bg-[#11161F] border border-[#1F2733] text-[#00A6FB] flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-[#00A6FB]" />
            Rodada {currentRound}/{totalRounds}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`font-num text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${
                weather === 'chuva_forte'
                  ? 'border-blue-500/40 text-blue-400 bg-blue-500/10 font-bold'
                  : weather === 'chuva_fraca'
                    ? 'border-sky-400/40 text-sky-400 bg-sky-400/10'
                    : 'border-amber-400/40 text-amber-400 bg-amber-400/10'
              }`}
            >
              {weather !== 'seco' ? (
                <CloudRain className="w-3.5 h-3.5" />
              ) : (
                <Sun className="w-3.5 h-3.5" />
              )}
              {weather === 'chuva_forte'
                ? '⛈️ Chuva Forte'
                : weather === 'chuva_fraca'
                  ? '🌧️ Chuva Fraca'
                  : '☀️ Pista Seca'}
            </span>

            <span className="px-2.5 py-1 rounded-md text-xs font-num bg-[#11161F] border border-[#1F2733] text-[#8B95A7]">
              Abrasividade: {gpInfo.tireAbrasiveness || 6}/10
            </span>
          </div>
        }
      />

      <TrackInfoPanel
        currentRound={currentRound}
        gpInfo={gpInfo}
        circuits={circuits}
        defaultAustraliaMap={defaultAustraliaMap}
        puPoolStatus={puPoolStatus}
        team={team}
      />

      <WeatherRadarCard forecast={forecast} weather={weather} />

      <PreRaceDriverBriefingCard
        drivers={drivers}
        team={team}
        round={currentRound}
        seasonYear={season?.year || 2026}
        circuitName={gpInfo.name}
      />

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

      <TireStockCard
        tireStock={tireStock}
        calculateCompoundLaps={calculateCompoundLaps}
        driverTireInventories={driverTireInventories}
        drivers={drivers.filter((d) => d.team_id === team?.id && d.role !== 'reserva')}
        currentRound={currentRound}
      />

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
          const isPracticeSession = sessKey === 'tp1' || sessKey === 'tp2'

          return (
            <TabsContent key={sessKey} value={sessKey} className="space-y-6 mt-4">
              {/* PREPARAÇÃO E RUNNER CANÔNICO DE TREINOS LIVRES (TL1 / TL2) — ETAPA 4A / 4B */}
              {isPracticeSession && !isDone && !activePracticeLivePreps[sessKey] && (
                <PracticePreparationView
                  careerId={team?.id || ''}
                  seasonId={season?.id || ''}
                  round={currentRound}
                  sessionType={sessKey as 'tp1' | 'tp2'}
                  team={team!}
                  drivers={drivers}
                  allTiresByDriver={driverTireInventories}
                  onStartSessionHandoff={(readyPrep) => {
                    // Sincroniza parâmetros herdados do Carro 1 para manter retrocompatibilidade
                    const c1 = readyPrep.cars[0]
                    if (c1) {
                      updateCurrentSetup('wing_level', c1.setup.frontWing)
                      updateCurrentSetup('suspension_stiffness', c1.setup.suspension)
                      updateCurrentSetup('pu_electric_ratio', c1.setup.differential)
                      if (c1.tyreSelection?.compound) {
                        updateCurrentSetup('tire_compound', c1.tyreSelection.compound)
                      }
                    }
                    // Entra na sessão ao vivo de treino (Etapa 4B)
                    setActivePracticeLivePreps((prev) => ({
                      ...prev,
                      [sessKey]: readyPrep,
                    }))
                  }}
                  onNavigateToWeekendTab={(tab) => setActiveSession(tab as WeekendSession)}
                />
              )}

              {/* SESSÃO DE TREINO AO VIVO EM ANDAMENTO (ETAPA 4B) */}
              {isPracticeSession && !isDone && activePracticeLivePreps[sessKey] && (
                <PracticeLiveSessionView
                  careerId={team?.id || ''}
                  seasonId={season?.id || ''}
                  round={currentRound}
                  sessionType={sessKey as 'tp1' | 'tp2'}
                  preparation={activePracticeLivePreps[sessKey]!}
                  team={team!}
                  drivers={drivers}
                  gpInfo={gpInfo}
                  weather={weather}
                  onFinishSession={(finalPracticeState) => {
                    // Consumir pneus dos carros do jogador que participaram diretamente no piloto respectivo
                    const c1Compound = finalPracticeState.cars.car1.currentCompound
                    const c2Compound = finalPracticeState.cars.car2.currentCompound
                    const c1DriverId = finalPracticeState.cars.car1.driverId
                    const c2DriverId = finalPracticeState.cars.car2.driverId
                    consumeTireSet(c1Compound || 'medio', c1DriverId)
                    consumeTireSet(c2Compound || 'medio', c2DriverId)

                    // Converter tabela de tempos de treino para sessionResults oficial
                    const convertedResults: SessionTimeResult[] =
                      finalPracticeState.leaderboard.map((entry) => ({
                        position: entry.position,
                        driverId: entry.driverId,
                        driverName: entry.driverName,
                        teamName: entry.teamName,
                        teamColor: entry.teamColor,
                        lapTime: entry.bestLapTime,
                        lapTimeSec: entry.bestLapSec,
                        gap: entry.gap,
                        tire: entry.compound,
                        isPlayer: entry.isPlayer,
                      }))
                    setSessionResults((prev) => ({ ...prev, [sessKey]: convertedResults }))

                    // Marcar sessão como concluída
                    setCompletedSessions((prev) => Array.from(new Set([...prev, sessKey])))
                    setActivePracticeLivePreps((prev) => ({ ...prev, [sessKey]: null }))

                    const sessionTitle = sessKey === 'tp1' ? 'Treino Livre 1' : 'Treino Livre 2'
                    toast({
                      title: `${sessionTitle} Concluído`,
                      description: `Melhor volta registrada: ${
                        convertedResults.find((r) => r.isPlayer)?.lapTime || '1:19.450'
                      }.`,
                    })

                    // Transição de esteira de fim de semana após conclusão do treino
                    if (sessKey === 'tp1') setActiveSession('tp2')
                    else if (sessKey === 'tp2') setActiveSession('q1')
                  }}
                  onNavigateToWeekendTab={(tab) => setActiveSession(tab as WeekendSession)}
                />
              )}

              {/* Setup Configuration Panel for this session (Sub-componente desacoplado para Q1/Q2/Q3/Race ou após treino concluído) */}
              {(!isPracticeSession || isDone) &&
                (() => {
                  const careerKey = (season as any)?.career_id || user?.id || 'career_default'
                  const seasonKey = season?.id || 'season_default'

                  const inheritedWeekendKnowledge =
                    practiceSessionService.resolveInheritedWeekendKnowledge(
                      careerKey,
                      seasonKey,
                      currentRound,
                      sessKey === 'race'
                        ? 'tp2'
                        : sessKey === 'q1' || sessKey === 'q2' || sessKey === 'q3'
                          ? 'tp2'
                          : (sessKey as any),
                    )

                  // Recuperar feedbacks mais recentes do TL2 ou TL1
                  const tp2State = practiceSessionService.readFromLocalCache(
                    careerKey,
                    seasonKey,
                    currentRound,
                    'tp2',
                  )
                  const tp1State = practiceSessionService.readFromLocalCache(
                    careerKey,
                    seasonKey,
                    currentRound,
                    'tp1',
                  )
                  const practiceFeedbacks = tp2State?.feedbacks?.length
                    ? tp2State.feedbacks
                    : tp1State?.feedbacks || []

                  return (
                    <TrackEngineeringAndStrategySection
                      sessKey={sessKey}
                      isRaceSession={isRaceSession}
                      isDone={isDone}
                      isSimulatingSession={isSimulatingSession}
                      currentSetup={currentSetup}
                      updateCurrentSetup={updateCurrentSetup}
                      handleSaveSetup={handleSaveSetup}
                      gpInfo={gpInfo}
                      raceInitialFuelPct={raceInitialFuelPct}
                      setRaceInitialFuelPct={setRaceInitialFuelPct}
                      setupFeedback={setupFeedback}
                      weather={weather}
                      tireStock={tireStock}
                      drivers={drivers}
                      team={team}
                      setupKnowledge={inheritedWeekendKnowledge.setupKnowledge}
                      tyreKnowledge={inheritedWeekendKnowledge.tyreKnowledge}
                      practiceFeedbacks={practiceFeedbacks}
                      driverTireInventories={driverTireInventories}
                      getStrategyForDriver={getStrategyForDriver}
                      calculateDriverTireWearProfile={calculateDriverTireWearProfile}
                      updateDriverStartCompound={updateDriverStartCompound}
                      addDriverPitStop={addDriverPitStop}
                      updateDriverPitStop={updateDriverPitStop}
                      removeDriverPitStop={removeDriverPitStop}
                      handleStartRace={handleStartRace}
                      simSpeed={simSpeed}
                      setSimSpeed={setSimSpeed}
                      autoSimulateWithoutPause={autoSimulateWithoutPause}
                      setAutoSimulateWithoutPause={setAutoSimulateWithoutPause}
                      handleRunSession={handleRunSession}
                    />
                  )
                })()}

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

              {/* ESTRUTURAÇÃO DO COCKPIT EM 3 ZONAS (Sub-componente desacoplado) */}
              <RaceOperationsCockpit
                isRaceSession={isRaceSession}
                liveRaceState={liveRaceState}
                gpInfo={gpInfo}
                puPoolStatus={puPoolStatus}
                currentSetup={currentSetup}
                team={team}
                handleStartRace={handleStartRace}
                isSimulatingSession={isSimulatingSession}
                isDone={isDone}
                simSpeed={simSpeed}
                setSimSpeed={setSimSpeed}
                handleOpenForcePitModal={handleOpenForcePitModal}
                raceResults={raceResults}
                liveEvents={liveEvents}
                playerCarTactics={playerCarTactics}
                handleChangeTacticalMode={handleChangeTacticalMode}
                playerPaceOrders={playerPaceOrders}
                handleChangePaceOrder={handleChangePaceOrder}
                teamOrders={teamOrders}
                penalties={penalties}
                mechanicalIssues={mechanicalIssues}
                teamOrderProposal={teamOrderProposal}
                handleApplyTeamOrder={handleApplyTeamOrder}
                isRacePaused={isRacePaused}
                onTogglePause={() => setIsRacePaused((p) => !p)}
              />

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

      {/* HUD da Corrida ao Vivo (Pit Wall flutuante com dados consolidados dos pilotos do jogador) */}
      {activeSession === 'race' &&
        liveRaceState &&
        liveRaceState.grid &&
        liveRaceState.grid.length > 0 && (
          <LiveRaceHUD
            gpName={gpInfo.name}
            gpCountry={gpInfo.country}
            currentLap={liveRaceState.currentLap}
            totalLaps={liveRaceState.totalLaps || gpInfo.laps}
            playerDrivers={liveRaceState.grid.filter((g) => g.isPlayer)}
            tacticalModes={playerCarTactics}
            formatTireName={formatTireName}
            isRaceFinished={!liveRaceState.inProgress && !!raceResults}
            onChangeTacticalMode={handleChangeTacticalMode}
            teamOrderProposal={teamOrderProposal}
            onApplyTeamOrder={handleApplyTeamOrder}
            teamOrderActive={teamOrders.some((to) => to.active && !to.refused)}
          />
        )}

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
        availableForcePitSets={(() => {
          const rawSets = driverTireInventories[forcePitSelectedDriverId] || playerTireSets
          return rawSets.filter((s) => !s.isFitted && (s.wear || 0) < 90)
        })()}
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
            queueCount={radioQueue.length}
            queueTotal={radioQueueTotal}
            availableTireSets={activeDriverTireSets}
            currentTireCompound={activeRadioDriver?.tireCompound}
            currentTireWear={activeRadioDriver?.tireWear}
            onRespond={(
              type: BossResponseType,
              options?: { tireSetId?: string; chosenCompound?: TireCompound },
            ) => {
              if (!radioActiveMessage) return
              const targetDriverId = radioActiveMessage.driverId
              const targetDriverName = radioActiveMessage.driverName
              const currentLap = liveRaceState?.currentLap || 1

              let appliedTacticMod: 'attack' | 'preserve' | 'save_fuel' | 'stay_out' = 'stay_out'
              let expiresLap = currentLap + 3

              if (type === 'box_now') {
                const chosenSetId = options?.tireSetId
                const chosenSet = activeDriverTireSets.find((s) => s.id === chosenSetId)
                const targetCompound =
                  options?.chosenCompound || (chosenSet ? chosenSet.compound : 'duro')
                const gridCar = liveRaceState?.grid?.find((g) => g.driverId === targetDriverId)
                if (gridCar) {
                  gridCar.tireCompound = targetCompound
                  gridCar.tireWear = chosenSet ? chosenSet.wear : 4
                  gridCar.lapsOnCurrentTire = 0
                  gridCar.pitStopsDone = (gridCar.pitStopsDone || 0) + 1
                  const pitTiming = calculatePitStopDuration(
                    gridCar.teamName,
                    gridCar.driverName,
                    true,
                    team?.chassis_level || 75,
                  )
                  gridCar.accumulatedTimeSec =
                    (gridCar.accumulatedTimeSec || 0) + pitTiming.durationSec
                }
              } else if (type === 'attack_mode') {
                appliedTacticMod = 'attack'
              } else if (type === 'preserve_car') {
                appliedTacticMod = 'preserve'
              }

              if (appliedTacticMod !== 'stay_out') {
                tacticalModifiersRef.current.set(targetDriverId, {
                  mode: appliedTacticMod,
                  expiresAtLap: expiresLap,
                  startLap: currentLap,
                })
              }

              // Mensagem no feed
              const nowStr = new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
              setLiveEvents((prev) => [
                {
                  id: `ev_radio_resp_${Date.now()}_${targetDriverId}`,
                  lap: currentLap,
                  type: 'team_radio',
                  message: `📻 PIT WALL ➔ ${targetDriverName}: Resposta de rádio enviada [${type.toUpperCase()}]. Instruções acatadas.`,
                  driverName: targetDriverName,
                  teamColor: team?.color || '#E10600',
                  isPlayer: true,
                  timestamp: nowStr,
                },
                ...prev,
              ])

              // Processa próximo item da fila
              if (radioQueue.length > 0) {
                const nextMsg = radioQueue[0]
                setRadioQueue((q) => q.slice(1))
                setRadioActiveMessage(nextMsg)
              } else {
                setRadioActiveMessage(null)
                setIsRacePaused(false)
              }
            }}
          />
        )
      })()}

      {/* 8. Modal de Diálogo de Pit Wall Radio (Iniciado pelo Chefe) */}
      {(() => {
        const activeCar = liveRaceState?.grid?.find((g) => g.driverId === pitWallRadioDriverId)
        const teammateCar = liveRaceState?.grid?.find(
          (g) => g.isPlayer && g.driverId !== pitWallRadioDriverId,
        )
        const teammateDriver = teammateCar
          ? drivers.find((d) => d.id === teammateCar.driverId)
          : undefined
        const gapSec =
          activeCar && teammateCar
            ? Math.abs((activeCar.position || 0) - (teammateCar.position || 0)) * 1.5
            : undefined
        const isTeammateAhead =
          activeCar && teammateCar ? (teammateCar.position || 0) < (activeCar.position || 0) : false

        return (
          <PitWallRadioDialog
            open={pitWallRadioOpen}
            onClose={() => setPitWallRadioOpen(false)}
            driverId={pitWallRadioDriverId}
            driverName={
              drivers.find((d) => d.id === pitWallRadioDriverId)?.name ||
              activeCar?.driverName ||
              'Piloto'
            }
            currentLap={liveRaceState?.currentLap || 1}
            carNumber={(activeCar as any)?.driverNumber ?? (activeCar as any)?.carNumber}
            currentPosition={activeCar?.position}
            car={activeCar as any}
            teammateName={teammateDriver?.name || teammateCar?.driverName}
            teammateId={teammateCar?.driverId}
            teammateCar={teammateCar as any}
            gapToTeammateSec={gapSec}
            isTeammateAhead={isTeammateAhead}
            currentTireCompound={activeCar?.tireCompound}
            currentTireWear={activeCar?.tireWear}
            lapsOnTire={activeCar?.lapsOnCurrentTire}
            liveEvents={liveEvents}
            pendingRequest={pendingDriverRequest}
            activeFollowUp={activeFollowUpState}
            onCallBoxThisLap={() => {
              setPitWallRadioOpen(false)
              handleOpenForcePitModal()
            }}
            onStayOut={() => {
              setPitWallRadioOpen(false)
              setLiveEvents((prev) => [
                {
                  id: `ev_radio_${Date.now()}`,
                  lap: liveRaceState?.currentLap || 1,
                  type: 'team_radio',
                  message: `📻 PIT WALL: Ordem de permanecer na pista para ${activeCar?.driverName || 'o piloto'}.`,
                  timestamp: new Date().toLocaleTimeString('pt-BR'),
                },
                ...prev,
              ])
            }}
            onReviewPitStop={() => {
              setPitWallRadioOpen(false)
              handleOpenForcePitModal()
            }}
            onSendTeamOrder={(orderType, reason) => {
              const dName =
                drivers.find((d) => d.id === pitWallRadioDriverId)?.name ||
                liveRaceState?.grid?.find((g) => g.driverId === pitWallRadioDriverId)?.driverName ||
                'Piloto'

              const nowStr = new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
              setLiveEvents((prev) => [
                {
                  id: `ev_boss_inst_${Date.now()}_${pitWallRadioDriverId}`,
                  lap: liveRaceState?.currentLap || 1,
                  type: 'team_radio',
                  message: `📻 PIT WALL ➔ ${dName}: Ordem de equipe [${orderType} - ${reason}].`,
                  driverName: dName,
                  teamColor: team?.color || '#E10600',
                  isPlayer: true,
                  timestamp: nowStr,
                },
                ...prev,
              ])
              setPitWallRadioOpen(false)
            }}
            onRespondToRequest={() => {
              setPendingDriverRequest(null)
              setPitWallRadioOpen(false)
            }}
            onSendFollowUp={() => {
              setActiveFollowUpState(null)
              setPitWallRadioOpen(false)
            }}
          />
        )
      })()}

      {/* 9. Modal Canônico de Simulação Rápida do Fim de Semana (8A) */}
      <SimulateWeekendModal
        open={simulateWeekendModalOpen}
        onClose={() => setSimulateWeekendModalOpen(false)}
        onConfirm={handleStartSimulateWeekend}
        hasCompletedSessions={completedSessions.length > 0}
        isSimulating={isSimulatingWeekend}
      />

      {/* Rastreador de Progresso de Simulação por Etapas */}
      {isSimulatingWeekend && (
        <SimulationStepTracker steps={simulationSteps} currentStepMessage={simulationStepMessage} />
      )}

      {/* 10. Modal Resumo Canônico Pós-Fim de Semana Completo */}
      <WeekendSummaryModal
        open={weekendSummaryModalOpen}
        onClose={() => setWeekendSummaryModalOpen(false)}
        report={weekendSimulationReport}
        onAdvanceToNextRound={() => {
          setWeekendSummaryModalOpen(false)
          navigate('/')
        }}
      />
    </div>
  )
}
