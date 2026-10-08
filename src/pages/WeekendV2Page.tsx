import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { useToast } from '@/hooks/use-toast'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/PageHeader'
import { RaceHeroCompact } from '@/components/race/RaceHeroCompact'
import { RaceWeekendPipelineBar } from '@/components/race/RaceWeekendPipelineBar'
import { SessionPlaceholderCard } from '@/components/race/SessionPlaceholderCard'
import {
  Play,
  Pause,
  FastForward,
  Clock,
  Wrench,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Users2,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { GPRegistrationScreen } from '@/pages/race/GPRegistrationScreen'

// Serviços canônicos da F1 2026
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { CanonicalPracticeIntegrationAdapter } from '@/services/canonicalPracticeIntegrationAdapter'
import { practiceSessionService } from '@/services/practiceSessionService'
import { PracticeSessionRunner } from '@/services/canonicalPracticeRunner'
import {
  CanonicalPracticeV2Runner,
  type AdvanceStepResult,
} from '@/services/canonicalPracticeV2Runner'
import { RookieFP1ManagementCard } from '@/components/race/RookieFP1ManagementCard'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import { RookieTl1PlanningService } from '@/services/rookieTl1PlanningService'
import type { RookieTemporaryFP1Assignment, RookieEligibilityCheck } from '@/types/rookie-practice'
import type { DriverModel } from '@/types/f1'
import { f1Service } from '@/services/f1Service'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import {
  canonicalEventRegistrationService,
  type RegistrationValidationResult,
} from '@/services/canonicalEventRegistrationService'
import {
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
  hasSprintWeekend,
  resetWeekendForRound,
} from '@/services/weekendProgressionService'
import {
  getRaceWeekendPipeline,
  resolveInitialRaceSession,
  CANONICAL_SESSION_DEFINITIONS,
  type RaceWeekendSessionId,
  type WeekendSessionDefinition,
  resolveSessionVisualState,
  isQualifyingStage,
} from '@/services/weekendScheduleConfig'
import { normalizeCompletedSessions } from '@/services/weekendProgressionService'
import {
  resolveWeekendFormat,
  getWeekendSlotSequence,
  NORMAL_SLOT_TYPES,
  SPRINT_SLOT_TYPES,
} from '@/services/weekendSlotSequenceService'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
import { resolveWeekendSlotsViewModel } from '@/services/weekendSlotViewModelResolver'
import type {
  WeekendFormat,
  WeekendSlotNumber,
  WeekendSlotType,
  CanonicalWeekendSlotState,
  WeekendSlotViewModel,
} from '@/types/weekend-slot-types'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { F1_2026_CALENDAR } from '@/lib/f1-data'

// Subcomponentes operacionais
import { SessionCarPreparationPanel } from '@/components/race/SessionCarPreparationPanel'
import { PracticeCarCockpitCard } from '@/components/race/PracticeCarCockpitCard'

import { PracticeLeaderboardTable } from '@/components/race/PracticeLeaderboardTable'
import { CarSetupModal } from '@/components/race/CarSetupModal'
import { QualifyingCarCockpitCard } from '@/components/race/QualifyingCarCockpitCard'
import { QualifyingLeaderboardTable } from '@/components/race/QualifyingLeaderboardTable'
import { CompleteQualifyingGridSummary } from '@/components/race/CompleteQualifyingGridSummary'
import { CanonicalRaceInitializationPanel } from '@/components/race/CanonicalRaceInitializationPanel'
import { PreRaceStrategyPreparationPanel } from '@/components/race/PreRaceStrategyPreparationPanel'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import type { RacePreparationSnapshot } from '@/types/canonical-race-preparation'
import { OfficialRaceResultPanel } from '@/components/race/OfficialRaceResultPanel'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { canonicalChampionshipMigrationService } from '@/services/canonicalChampionshipMigrationService'
import { advanceWeekendRound } from '@/services/canonicalRoundAdvanceHelper'
import {
  canonicalCareerPersistenceService,
  type CareerApplicationStatus,
} from '@/services/canonicalCareerPersistenceService'
import { raceStrategyService } from '@/services/raceStrategyService'
import type { CanonicalRaceState, OfficialRaceResult } from '@/types/canonical-race-v2'
import {
  CanonicalQualifyingRunner,
  type QualifyingDriverContext,
  type QualifyingTickContext,
} from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import {
  resolveEligibleQualifyingDrivers,
  QualifyingPrerequisiteError,
} from '@/services/qualifyingParticipantResolver'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import type {
  QualifyingStageId,
  QualifyingStageState,
  QualifyingStageResult,
  CompleteQualifyingWeekendResult,
  FinalQualifyingGridEntry,
} from '@/types/canonical-qualifying-types'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import type { PracticeSessionRecordState, PracticeCarLiveState } from '@/types/practice-session'
import type { PracticeSessionType } from '@/types/practice-preparation'
import type { TireSetItem } from '@/types/f1'

export default function WeekendV2Page() {
  const navigate = useNavigate()
  const { user, team, season, refreshTeamAndSeason, isLoading: isAuthLoading } = useAuth()
  const { currentRound, playerDrivers } = useUnifiedSeason()
  const career = (team?.career_settings as any) || (season as any)?.career || null
  const { toast } = useToast()

  // 1. Definição do Grande Prêmio atual
  const gpInfo = useMemo(() => {
    const calendarItem = F1_2026_CALENDAR.find((c) => c.round === currentRound)
    return (
      calendarItem || {
        round: currentRound || 1,
        name: 'Grande Prêmio de Abertura',
        circuit: 'Circuito Internacional',
        country: 'Bahrain',
        laps: 57,
        circuitLengthKm: 5.412,
      }
    )
  }, [currentRound])

  const circuitProfile = useMemo(() => {
    try {
      return resolveCircuitProfile({ round: currentRound })
    } catch {
      return null
    }
  }, [currentRound])

  const isSprint = useMemo(() => hasSprintWeekend(currentRound), [currentRound])

  // Esteira canônica do fim de semana:
  // NORMAL: TL1 -> TL2 -> TL3 -> Q1 -> Q2 -> Q3 -> CORRIDA
  // SPRINT: TL1 -> QUALI_SPRINT -> SPRINT -> Q1 -> Q2 -> Q3 -> CORRIDA (sem TL2 / sem TL3)
  const pipeline = useMemo(() => {
    return getRaceWeekendPipeline({
      format: isSprint ? 'sprint' : 'standard',
      includePractice3: !isSprint,
    })
  }, [isSprint])

  // 2. Estados principais da página CORRIDA
  const [registration, setRegistration] = useState<RegistrationValidationResult | null>(null)
  const [registrationErrors, setRegistrationErrors] = useState<string[]>([])
  const [isInitializingRegistration, setIsInitializingRegistration] = useState(true)
  const [showRegistrationScreen, setShowRegistrationScreen] = useState(false)
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false)

  // Inventário de pneus persistente (20 jogos por piloto)
  const [tyreInventories, setTyreInventories] = useState<Record<string, TireSetItem[]>>({})

  // Sessões concluídas salvas no armazenamento
  const [completedSessions, setCompletedSessions] = useState<string[]>([])

  // Estado canônico de 7 slots do fim de semana (RACE-SPRINT-SLOTS-01A)
  const [weekendSlotState, setWeekendSlotState] = useState<CanonicalWeekendSlotState | null>(null)

  // Sessão atualmente selecionada na esteira
  const [selectedSessionId, setSelectedSessionId] = useState<RaceWeekendSessionId>('tp1')

  // Estado em memória e no storage da sessão de treino em andamento
  const [sessionState, setSessionState] = useState<PracticeSessionRecordState | null>(null)

  // Estado em memória da sessão de qualificação em andamento (Q1, Q2 ou Q3)
  const [qualifyingState, setQualifyingState] = useState<QualifyingStageState | null>(null)
  const [isInitializingQualifying, setIsInitializingQualifying] = useState<boolean>(false)
  const [qualifyingInitializationError, setQualifyingInitializationError] =
    useState<QualifyingPrerequisiteError | null>(null)
  const completedQualiStagesHandledRef = useRef<Set<string>>(new Set())
  const [completeQualifyingResult, setCompleteQualifyingResult] =
    useState<CompleteQualifyingWeekendResult | null>(null)
  const [canonicalRaceState, setCanonicalRaceState] = useState<CanonicalRaceState | null>(null)
  const [officialRaceResult, setOfficialRaceResult] = useState<OfficialRaceResult | null>(null)
  // BUG-02 COMMIT C: Estado de navegação interna entre Grid Oficial e Estratégia Pré-Corrida
  const [showPreRacePreparation, setShowPreRacePreparation] = useState<boolean>(false)
  const [careerPersistenceStatus, setCareerPersistenceStatus] =
    useState<CareerApplicationStatus>('PENDING')
  const [isPersistingCareer, setIsPersistingCareer] = useState(false)
  const [careerPersistenceError, setCareerPersistenceError] = useState<string | undefined>(
    undefined,
  )
  const [isAdvancingRound, setIsAdvancingRound] = useState(false)
  // Controles de execução da sessão
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false)
  const [selectedSpeed, setSelectedSpeed] = useState<1 | 2 | 4>(1)
  const autoAdvanceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Modais de garagem e seleção direta de novato
  const [setupModalCarId, setSetupModalCarId] = useState<'car1' | 'car2' | null>(null)
  const [activeTyresCarId, setActiveTyresCarId] = useState<'car1' | 'car2'>('car1')
  const [rookieSelectorModalCarId, setRookieSelectorModalCarId] = useState<'car1' | 'car2' | null>(
    null,
  )

  // Helper para atualizar lista de concluídas
  const refreshCompletedSessions = (): string[] => {
    if (!season?.id) return []
    const stored = readStoredCompletedSessions(season.id, currentRound)
    setCompletedSessions(stored)
    return stored
  }

  // Handler para reiniciar o fim de semana da rodada atual
  const handleResetCurrentWeekend = async () => {
    if (!season?.id) return

    // 1. Cancelar ticks/intervalos ativos
    setIsAutoAdvancing(false)
    if (autoAdvanceIntervalRef.current) {
      clearInterval(autoAdvanceIntervalRef.current)
      autoAdvanceIntervalRef.current = null
    }

    const canonicalCareerId = team ? resolveCanonicalCareerId(season, team) : undefined

    // 2. Chamar serviço canônico de reset
    resetWeekendForRound({
      careerId: canonicalCareerId,
      seasonId: season.id,
      round: currentRound,
    })

    // 3. Limpar estados locais da página
    setCompletedSessions([])
    setQualifyingState(null)
    setQualifyingInitializationError(null)
    setSessionState(null)
    setCanonicalRaceState(null)
    setOfficialRaceResult(null)
    setCompleteQualifyingResult(null)
    setShowPreRacePreparation(false)

    // 4. Reidratar inventário e slots do zero
    const pCar1 = registration?.snapshot?.entriesByCar.playerCar1
    const pCar2 = registration?.snapshot?.entriesByCar.playerCar2
    const driverIds = [pCar1?.driverId, pCar2?.driverId].filter(Boolean) as string[]

    const freshInvs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId: season.id,
      round: currentRound,
      driverIds,
      primaryDriverIds: driverIds,
    })
    setTyreInventories(freshInvs)

    if (canonicalCareerId) {
      try {
        const freshSlots = canonicalWeekendSlotPersistenceService.createInitialState({
          careerId: canonicalCareerId,
          seasonId: season.id,
          round: currentRound,
        })
        await canonicalWeekendSlotPersistenceService.saveSlotState(freshSlots)
        setWeekendSlotState(freshSlots)
      } catch (err) {
        console.warn('[WeekendV2Page] Erro ao resetar slotState:', err)
      }
    }

    // 5. Selecionar e inicializar a primeira fase da esteira
    const initialSessionId = resolveInitialRaceSession({
      pipeline,
      completedSessions: [],
    })
    setSelectedSessionId(initialSessionId)

    if (initialSessionId === 'tp1' || initialSessionId === 'tp2' || initialSessionId === 'tp3') {
      if (registration) {
        await initializePracticeSession(initialSessionId, registration, freshInvs)
      }
    } else if (isQualifyingStage(initialSessionId)) {
      if (registration) {
        await initializeQualifyingSession(
          initialSessionId as QualifyingStageId,
          registration,
          freshInvs,
        )
      }
    }

    toast({
      title: 'Fim de semana reiniciado',
      description: `Todas as sessões da Rodada ${currentRound} voltaram ao status pendente.`,
    })
  }

  // 3. Inicialização e Inscrição Canônica FIA (24 pilotos, 2 carros por equipe)
  useEffect(() => {
    if (isAuthLoading || !team || !season) return

    let isMounted = true
    setIsInitializingRegistration(true)

    try {
      // 3.1. Verificar se já existe snapshot persistido para este GP
      const existingSnapshot = canonicalEventRegistrationService.readRegistrationSnapshot(
        season.id,
        currentRound,
      )

      if (!existingSnapshot) {
        // Sem snapshot gravado: abrir tela formal de inscrição do GP
        if (isMounted) {
          setShowRegistrationScreen(true)
          setIsInitializingRegistration(false)
        }
        return
      }

      // Snapshot existente: carrega e valida
      const reg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
        seasonId: season.id,
        round: currentRound,
        gpName: gpInfo.name,
        playerTeam: team,
        allDrivers: playerDrivers,
      })

      if (!reg.valid) {
        if (isMounted) {
          setRegistrationErrors(reg.errors)
          setIsInitializingRegistration(false)
        }
        return
      }

      if (isMounted) {
        setRegistration(reg)
        setRegistrationErrors([])
        setShowRegistrationScreen(false)

        // 3.2. Carregar inventário persistente de pneus do evento (20 jogos por piloto)
        const pCar1 = reg.snapshot?.entriesByCar.playerCar1
        const pCar2 = reg.snapshot?.entriesByCar.playerCar2
        const driverIds = [pCar1?.driverId, pCar2?.driverId].filter(Boolean) as string[]

        const invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
          seasonId: season.id,
          round: currentRound,
          driverIds,
          primaryDriverIds: driverIds,
        })
        setTyreInventories(invs)

        // 3.3. Carregar sessões concluídas
        const stored = readStoredCompletedSessions(season.id, currentRound)
        setCompletedSessions(stored)

        // 3.3.1. Carregar ou migrar estado canônico dos 7 slots (RACE-SPRINT-SLOTS-01A)
        const canonicalCareerId = resolveCanonicalCareerId(season, team)
        canonicalWeekendSlotPersistenceService
          .loadOrMigrateSlotState({
            careerId: canonicalCareerId,
            seasonId: season.id,
            round: currentRound,
          })
          .then((slotState) => {
            if (slotState) {
              setWeekendSlotState(slotState)
            }
          })
          .catch((err) => {
            console.warn('[WeekendV2Page] Erro ao carregar slotState:', err)
          })
        // 3.4. Determinar sessão canônica inicial
        // BUG-SQ3-TRANSITION-R3: Se uma sessão estiver em running ou paused, ela tem prioridade de retomada
        let resumableSessionId: RaceWeekendSessionId | null = null
        const qualiStagesToCheck = ['sq3', 'sq2', 'sq1', 'q3', 'q2', 'q1'] as const
        for (const stg of qualiStagesToCheck) {
          const stgState = canonicalQualifyingPersistenceService.readStageState(
            season.id,
            currentRound,
            stg,
          )
          if (stgState && (stgState.status === 'paused' || stgState.status === 'running')) {
            resumableSessionId = stg
            break
          }
        }

        const initialSessionId = resolveInitialRaceSession({
          pipeline,
          completedSessions: stored,
          lastActiveSessionId: resumableSessionId,
        })
        setSelectedSessionId(initialSessionId)

        // 3.5. Se for sessão de treino (TL1/TL2/TL3), carregar ou inicializar
        if (
          initialSessionId === 'tp1' ||
          initialSessionId === 'tp2' ||
          initialSessionId === 'tp3'
        ) {
          initializePracticeSession(initialSessionId, reg, invs)
        } else if (
          initialSessionId === 'q1' ||
          initialSessionId === 'q2' ||
          initialSessionId === 'q3' ||
          initialSessionId === 'sq1' ||
          initialSessionId === 'sq2' ||
          initialSessionId === 'sq3'
        ) {
          initializeQualifyingSession(initialSessionId as QualifyingStageId, reg, invs)
        } else if (initialSessionId === 'race' || initialSessionId === 'sprint_race') {
          const isSprintTarget = initialSessionId === 'sprint_race'
          const gridResult = resolveRaceOrSprintGrid(season.id, currentRound, isSprintTarget)
          setCompleteQualifyingResult(gridResult)
          const canonicalCareerId = resolveCanonicalCareerId(season, team)
          canonicalRaceInitializationService
            .readCanonicalRaceStatePreferred(
              canonicalCareerId,
              season.year || 2026,
              currentRound,
              isSprintTarget ? 'SPRINT_RACE' : 'MAIN_RACE',
            )
            .then((savedRace) => {
              if (isMounted) {
                setCanonicalRaceState(savedRace)
              }
            })
            .catch((err) => {
              console.warn('[WeekendV2Page] Falha ao ler race state inicial preferencial:', err)
              if (isMounted) {
                const fallback = canonicalRaceInitializationService.readCanonicalRaceState(
                  canonicalCareerId,
                  season.year || 2026,
                  currentRound,
                  isSprintTarget ? 'SPRINT_RACE' : 'MAIN_RACE',
                )
                setCanonicalRaceState(fallback)
              }
            })
        }

        setIsInitializingRegistration(false)
      }
    } catch (err: any) {
      if (isMounted) {
        setRegistrationErrors([err?.message || 'Falha ao inicializar inscrição do fim de semana.'])
        setIsInitializingRegistration(false)
      }
    }

    return () => {
      isMounted = false
    }
  }, [team, season?.id, currentRound, isAuthLoading, gpInfo.name, playerDrivers])

  // Helper unificado canônico para obter o grid da Corrida (Principal ou Sprint)
  const resolveRaceOrSprintGrid = (
    seasonId: string,
    round: number,
    isSprint: boolean,
  ): CompleteQualifyingWeekendResult | null => {
    if (isSprint) {
      // SPRINT_RACE: usa estritamente o resultado canônico da SQ3 para formar o grid de largada da Sprint
      return canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(seasonId, round)
    }

    // MAIN RACE: continua usando readCompleteQualifyingResult com a classificação principal Q1-Q3
    return canonicalQualifyingPersistenceService.readCompleteQualifyingResult(seasonId, round)
  }

  // 4. Inicializador de Sessão de Treino Livre (TL1/TL2/TL3)
  const initializePracticeSession = async (
    targetType: PracticeSessionType,
    currentReg?: RegistrationValidationResult | null,
    currentInvs?: Record<string, TireSetItem[]>,
  ) => {
    const reg = currentReg || registration
    const inventories = currentInvs || tyreInventories
    if (!team || !season || !reg?.snapshot) return

    const pCar1 = reg.snapshot.entriesByCar.playerCar1
    const pCar2 = reg.snapshot.entriesByCar.playerCar2
    if (!pCar1 || !pCar2) return

    // No TL1, carregar novatos temporários se escalados; em TL2/TL3 restaurar sempre os titulares
    const isTL1 = targetType === 'tp1'
    const savedRookieC1 = isTL1
      ? RookiePracticeRequirementService.getTemporaryFP1Assignment(
          season.id,
          currentRound,
          team.id,
          'car1',
        )
      : null
    const savedRookieC2 = isTL1
      ? RookiePracticeRequirementService.getTemporaryFP1Assignment(
          season.id,
          currentRound,
          team.id,
          'car2',
        )
      : null

    const activeC1DriverId = savedRookieC1 ? savedRookieC1.rookieDriverId : pCar1.driverId
    const activeC1DriverName = savedRookieC1 ? savedRookieC1.rookieDriverName : pCar1.driverName
    const activeC2DriverId = savedRookieC2 ? savedRookieC2.rookieDriverId : pCar2.driverId
    const activeC2DriverName = savedRookieC2 ? savedRookieC2.rookieDriverName : pCar2.driverName

    // Buscar pneus disponíveis no mesmo inventário compartilhado do assento/titular (20 jogos/piloto)
    // BUG-TYRE-SYNC-01A: Garantir inventário canônico materializado e selecionar APENAS jogo real elegível (wear < 100)
    let activeInvs = inventories
    if (
      !activeInvs[pCar1.driverId] ||
      activeInvs[pCar1.driverId].length === 0 ||
      !activeInvs[pCar2.driverId] ||
      activeInvs[pCar2.driverId].length === 0
    ) {
      activeInvs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId: season.id,
        round: currentRound,
        driverIds: [pCar1.driverId, pCar2.driverId],
        primaryDriverIds: [pCar1.driverId, pCar2.driverId],
      })
      setTyreInventories(activeInvs)
    }

    const car1Tire = activeInvs[pCar1.driverId]?.find((t) => (t.wear || 0) < 100)
    const car2Tire = activeInvs[pCar2.driverId]?.find((t) => (t.wear || 0) < 100)

    // Resolver herança de setup e conhecimento da sessão anterior (setup pertence ao CARRO)
    const inherited = practiceSessionService.resolveInheritedWeekendKnowledge(
      team.id,
      season.id,
      currentRound,
      targetType,
    )

    const prep = {
      round: currentRound,
      weatherForecast: 'seco' as const,
      cars: [
        {
          carId: 'car1' as const,
          driverId: activeC1DriverId,
          program: 'car_setup' as const,
          setup: inherited.car1Setup || {
            frontWing: 6,
            rearWing: 6,
            suspension: 6,
            differential: 50,
          },
          fuelLoad: { mode: 'medium' as const, kg: 30, estimatedLaps: 18 },
          tyreSelection: car1Tire
            ? {
                setId: car1Tire.id,
                compound: car1Tire.compound || ('medio' as const),
              }
            : null,
        },
        {
          carId: 'car2' as const,
          driverId: activeC2DriverId,
          program: 'race_pace' as const,
          setup: inherited.car2Setup || {
            frontWing: 6,
            rearWing: 6,
            suspension: 6,
            differential: 50,
          },
          fuelLoad: { mode: 'medium' as const, kg: 30, estimatedLaps: 18 },
          tyreSelection: car2Tire
            ? {
                setId: car2Tire.id,
                compound: car2Tire.compound || ('medio' as const),
              }
            : null,
        },
      ],
      overallObjective: `Gestão e validação canônica da sessão ${targetType.toUpperCase()}`,
      confirmedAt: new Date().toISOString(),
    }

    const { session } = await practiceSessionService.openOrResumePracticeSession({
      careerId: team.id,
      seasonId: season.id,
      round: currentRound,
      sessionType: targetType,
      preparation: prep as any,
      driverNames: {
        car1: activeC1DriverName,
        driver1Id: activeC1DriverId,
        car2: activeC2DriverName,
        driver2Id: activeC2DriverId,
      },
      teamName: team.name,
      teamColor: team.color || '#e10600',
      teamChassisRating: team.chassis_level || 75,
      engineSupplier: team.engine_supplier || 'Ferrari',
    })
    // Se estiver entrando no TL2 ou TL3, garante restauração dos nomes dos titulares no estado
    if (!isTL1) {
      session.cars.car1.driverId = pCar1.driverId
      session.cars.car1.driverName = pCar1.driverName
      session.cars.car2.driverId = pCar2.driverId
      session.cars.car2.driverName = pCar2.driverName
    }

    setSessionState(session)
    setSelectedSessionId(targetType)
    setIsAutoAdvancing(false)
  }

  // 5. Selecionar Sessão na Esteira Canônica
  const handleSelectSessionFromSchedule = async (sessDef: WeekendSessionDefinition) => {
    if (!registration || !team || !season) return

    const sess = sessDef.id

    // BUG-SQ3-TRANSITION-R3: Se o usuário está clicando para selecionar/retomar a própria sessão atual,
    // não bloquear com guards de transição para a próxima sessão.
    if (sess === selectedSessionId) {
      if (sess === 'tp1' || sess === 'tp2' || sess === 'tp3') {
        if (!sessionState) {
          await initializePracticeSession(sess, registration, tyreInventories)
        }
      } else if (isQualifyingStage(sess)) {
        if (!qualifyingState) {
          const persisted = canonicalQualifyingPersistenceService.readStageState(
            season.id,
            currentRound,
            sess as QualifyingStageId,
          )
          if (persisted && persisted.status === 'completed') {
            setQualifyingState(persisted)
            setQualifyingInitializationError(null)
            setIsAutoAdvancing(false)
            return
          }
          setQualifyingInitializationError(null)
          await initializeQualifyingSession(
            sess as QualifyingStageId,
            registration,
            tyreInventories,
          )
        }
      }
      return
    }

    const stored = refreshCompletedSessions()

    // Normalização canônica via normalizeCompletedSessions para tratar todos os aliases de forma única e centralizada
    const normalizedStored = normalizeCompletedSessions(stored)
    const hasTl1 =
      normalizedStored.includes('tp1') || stored.includes('tl1') || stored.includes('fp1')
    const hasTl2 =
      normalizedStored.includes('tp2') || stored.includes('tl2') || stored.includes('fp2')
    const hasSq1 = normalizedStored.includes('sq1') || stored.includes('sprint_q1')
    const hasSq2 = normalizedStored.includes('sq2') || stored.includes('sprint_q2')

    if (sess === 'tp2' && !hasTl1) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description: 'Você precisa concluir o TL1 antes de iniciar o TL2.',
      })
      return
    }

    if (sess === 'tp3' && !hasTl2) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description: 'Você precisa concluir o TL2 antes de iniciar o TL3.',
      })
      return
    }

    if (sess === 'sq1' && !hasTl1) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description: 'Você precisa concluir o TL1 antes de iniciar a Qualificação Sprint (SQ1).',
      })
      return
    }

    if (sess === 'sq2' && !hasSq1) {
      // Reconciliação com estado canônico de SQ1
      const sq1State = season?.id
        ? canonicalQualifyingPersistenceService.readStageState(season.id, currentRound, 'sq1')
        : null
      const sq1Result = season?.id
        ? canonicalQualifyingPersistenceService.readStageResult(season.id, currentRound, 'sq1')
        : null
      const isSq1Completed =
        Boolean(
          sq1Result && sq1Result.advancingDriverIds && sq1Result.advancingDriverIds.length > 0,
        ) || Boolean(sq1State && sq1State.status === 'completed')

      if (!isSq1Completed) {
        toast({
          variant: 'destructive',
          title: 'Sessão Bloqueada',
          description: 'Você precisa concluir o SQ1 antes de iniciar o SQ2.',
        })
        return
      }
    }

    if (sess === 'sq3') {
      // BUG-SQ3-TRANSITION-R2 / BUG-SQ3-TRANSITION-R3: Distinguir explicitamente:
      // - SQ2 nunca iniciada: não permitir SQ3.
      // - SQ2 paused ou running órfão: não considerar concluída, não abrir SQ3, redirecionar/retomar a SQ2.
      // - SQ2 completed: permitir SQ3 (tanto com piloto participante quanto como espectador).
      const sq2State = season?.id
        ? canonicalQualifyingPersistenceService.readStageState(season.id, currentRound, 'sq2')
        : null
      const sq2Result = season?.id
        ? canonicalQualifyingPersistenceService.readStageResult(season.id, currentRound, 'sq2')
        : null

      const isSq2CanonicalCompleted =
        (sq2Result && sq2Result.advancingDriverIds && sq2Result.advancingDriverIds.length > 0) ||
        (sq2State && sq2State.status === 'completed')

      const isSq2Resumable =
        sq2State && (sq2State.status === 'paused' || sq2State.status === 'running')

      if (isSq2Resumable && !isSq2CanonicalCompleted) {
        toast({
          variant: 'destructive',
          title: 'SQ2 em Andamento (Retomável)',
          description:
            'A Qualificação Sprint (SQ2) está em andamento e não foi concluída. Retome a SQ2 para finalizá-la antes do SQ3.',
        })
        setSelectedSessionId('sq2')
        setSessionState(null)
        await initializeQualifyingSession('sq2', registration)
        return
      }

      if (!hasSq2 && !isSq2CanonicalCompleted) {
        toast({
          variant: 'destructive',
          title: 'Sessão Bloqueada',
          description: 'Você precisa concluir o SQ2 antes de iniciar o SQ3.',
        })
        return
      }
    }

    if (
      sess === 'sprint_race' &&
      !normalizedStored.includes('sq3') &&
      !normalizedStored.includes('sprint_qualifying')
    ) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description:
          'Você precisa concluir a Qualificação Sprint (SQ3) antes de iniciar a Corrida Sprint.',
      })
      return
    }

    if (
      sess === 'q1' &&
      !normalizedStored.includes('tp2') &&
      !normalizedStored.includes('tp3') &&
      !normalizedStored.includes('sprint_race') &&
      !normalizedStored.includes('sprint')
    ) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description:
          'Você precisa concluir os treinos livres antes de iniciar a Qualificação (Q1).',
      })
      return
    }

    if (sess === 'q2' && !normalizedStored.includes('q1')) {
      const q1State = season?.id
        ? canonicalQualifyingPersistenceService.readStageState(season.id, currentRound, 'q1')
        : null
      const q1Result = season?.id
        ? canonicalQualifyingPersistenceService.readStageResult(season.id, currentRound, 'q1')
        : null
      const isQ1Completed =
        Boolean(
          q1Result && q1Result.advancingDriverIds && q1Result.advancingDriverIds.length > 0,
        ) || Boolean(q1State && q1State.status === 'completed')

      if (!isQ1Completed) {
        toast({
          variant: 'destructive',
          title: 'Sessão Bloqueada',
          description: 'Você precisa concluir o Q1 antes de iniciar o Q2.',
        })
        return
      }
    }

    if (sess === 'q3') {
      const q2State = season?.id
        ? canonicalQualifyingPersistenceService.readStageState(season.id, currentRound, 'q2')
        : null
      const q2Result = season?.id
        ? canonicalQualifyingPersistenceService.readStageResult(season.id, currentRound, 'q2')
        : null
      const isQ2Completed =
        Boolean(
          q2Result && q2Result.advancingDriverIds && q2Result.advancingDriverIds.length > 0,
        ) || Boolean(q2State && q2State.status === 'completed')

      const isQ2Resumable = q2State && (q2State.status === 'paused' || q2State.status === 'running')

      if (isQ2Resumable && !isQ2Completed) {
        toast({
          variant: 'destructive',
          title: 'Q2 em Andamento (Retomável)',
          description:
            'A Qualificação (Q2) está em andamento e não foi concluída. Retome a Q2 para finalizá-la antes do Q3.',
        })
        setSelectedSessionId('q2')
        setSessionState(null)
        await initializeQualifyingSession('q2', registration)
        return
      }

      if (!normalizedStored.includes('q2') && !isQ2Completed) {
        toast({
          variant: 'destructive',
          title: 'Sessão Bloqueada',
          description: 'Você precisa concluir o Q2 antes de iniciar o Q3.',
        })
        return
      }
    }

    if (
      sess === 'race' &&
      !normalizedStored.includes('q3') &&
      !normalizedStored.includes('qualifying')
    ) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description: 'Você precisa concluir o Q3 para definir o grid antes de ir para a Corrida.',
      })
      return
    }

    // Parar avanço automático anterior
    setIsAutoAdvancing(false)
    if (autoAdvanceIntervalRef.current) {
      clearInterval(autoAdvanceIntervalRef.current)
    }

    // Atualizar inventário de pneus para o contexto
    const pCar1 = registration.snapshot?.entriesByCar.playerCar1
    const pCar2 = registration.snapshot?.entriesByCar.playerCar2
    const driverIds = [pCar1?.driverId, pCar2?.driverId].filter(Boolean) as string[]
    let invs: Record<string, TireSetItem[]> = {}
    try {
      invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId: season.id,
        round: currentRound,
        driverIds,
        primaryDriverIds: driverIds,
      })
    } catch (tyreErr) {
      console.warn(
        '[WeekendV2Page] Erro ao obter inventário de pneus na seleção de sessão:',
        tyreErr,
      )
      invs = tyreInventories || {}
    }
    setTyreInventories(invs)

    // Se for TL1, TL2 ou TL3: carrega/resume o runner de treino
    if (sess === 'tp1' || sess === 'tp2' || sess === 'tp3') {
      setSelectedSessionId(sess)
      setQualifyingState(null)
      setQualifyingInitializationError(null)
      await initializePracticeSession(sess, registration, invs)
    } else if (sess === 'q1' || sess === 'q2' || sess === 'q3') {
      // Q1, Q2 ou Q3: inicializa ou carrega a sessão de qualificação canônica
      // Q1FIX-01: Guard antes de initializeQualifyingSession.
      // Ler o estado persistido da fase selecionada usando o mecanismo já existente.
      // Se o estado persistido existir e status === 'completed', reutilizar esse estado na UI,
      // selecionar a fase normalmente, não chamar initializeQualifyingSession/initializeStage e retornar imediatamente.
      const existingState = canonicalQualifyingPersistenceService.readStageState(
        season.id,
        currentRound,
        sess as QualifyingStageId,
      )
      if (existingState && existingState.status === 'completed') {
        setSelectedSessionId(sess)
        setSessionState(null)
        setQualifyingState(existingState)
        setQualifyingInitializationError(null)
        setIsAutoAdvancing(false)
        return
      }
      setSelectedSessionId(sess)
      setSessionState(null)
      // CORREÇÃO 2: resetar sincronamente setQualifyingState(null) antes de qualquer await para desvincular snapshot anterior
      setQualifyingState(null)
      setQualifyingInitializationError(null)
      if (existingState) {
        setQualifyingState(existingState)
      }
      await initializeQualifyingSession(sess as QualifyingStageId, registration, invs)
    } else if (sess === 'sq1' || sess === 'sq2' || sess === 'sq3') {
      // SQ1, SQ2 ou SQ3: inicializa ou carrega a sessão de qualificação sprint canônica
      // Q1FIX-01: Guard antes de initializeQualifyingSession para sessões sprint também.
      const existingState = canonicalQualifyingPersistenceService.readStageState(
        season.id,
        currentRound,
        sess as QualifyingStageId,
      )
      if (existingState && existingState.status === 'completed') {
        setSelectedSessionId(sess)
        setSessionState(null)
        setQualifyingState(existingState)
        setQualifyingInitializationError(null)
        setIsAutoAdvancing(false)
        return
      }
      setSelectedSessionId(sess)
      setSessionState(null)
      // CORREÇÃO 2: resetar sincronamente setQualifyingState(null) antes de qualquer await para desvincular snapshot anterior
      setQualifyingState(null)
      setQualifyingInitializationError(null)
      if (existingState) {
        setQualifyingState(existingState)
      }
      await initializeQualifyingSession(sess as QualifyingStageId, registration, invs)
    } else {
      // CORRIDA (Principal ou Sprint): se qualificação concluída, exibe o grid final P1-P24 ou placeholder
      const isSprintTarget = sess === 'sprint_race'
      setSelectedSessionId(sess)
      setSessionState(null)
      setQualifyingState(null)
      if (season?.id && team?.id) {
        const canonicalCareerId = resolveCanonicalCareerId(season, team)

        // Reconciliação legada automática se team.id diferir do canonicalCareerId
        if (team.id !== canonicalCareerId) {
          try {
            canonicalChampionshipMigrationService.reconcileLegacyCareerResults({
              canonicalCareerId,
              legacyCareerIds: [team.id],
              seasonYear: season.year || 2026,
            })
          } catch {
            // Reconciliação tolerante a falhas
          }
        }

        const fullGrid = resolveRaceOrSprintGrid(season.id, currentRound, isSprintTarget)
        setCompleteQualifyingResult(fullGrid)
        // STORAGE-QUOTA-01B1-C: Carregamento assíncrono preferindo PocketBase com fallback local
        canonicalRaceInitializationService
          .readCanonicalRaceStatePreferred(
            canonicalCareerId,
            season.year || 2026,
            currentRound,
            isSprintTarget ? 'SPRINT_RACE' : 'MAIN_RACE',
          )
          .then((savedRace) => {
            setCanonicalRaceState(savedRace)
          })
          .catch((err) => {
            console.warn('[WeekendV2Page] Falha ao carregar estado preferencial de corrida:', err)
            const fallbackRace = canonicalRaceInitializationService.readCanonicalRaceState(
              canonicalCareerId,
              season.year || 2026,
              currentRound,
              isSprintTarget ? 'SPRINT_RACE' : 'MAIN_RACE',
            )
            setCanonicalRaceState(fallbackRace)
          })

        // FW2.1E-F: Verificar resultado oficial
        const official = canonicalRaceResultService.getOfficialRaceResult(
          canonicalCareerId,
          season.year || 2026,
          currentRound,
        )
        if (official) {
          setOfficialRaceResult(official)
          const journal = canonicalCareerPersistenceService.getApplicationJournal(
            canonicalCareerId,
            season.year || 2026,
            currentRound,
          )
          if (journal) {
            setCareerPersistenceStatus(journal.status)
            setCareerPersistenceError(journal.lastError)
          }
        }
      }
    }
  }

  // Helper para resolver os participantes oficiais do grid para a qualificação (Q1-Q3 / SQ1-SQ3)
  const resolveEligibleQualifyingParticipants = (
    stageId: QualifyingStageId,
    reg: RegistrationValidationResult,
  ): QualifyingDriverContext[] => {
    if (!season?.id || !reg.snapshot) return []
    return resolveEligibleQualifyingDrivers({
      stageId,
      seasonId: season.id,
      round: currentRound,
      allEntries: reg.snapshot.entries || [],
      playerDriverIds: [
        reg.snapshot.entriesByCar?.playerCar1?.driverId,
        reg.snapshot.entriesByCar?.playerCar2?.driverId,
      ].filter(Boolean) as string[],
      playerTeam: team || undefined,
    })
  }

  // Inicializador de sessão de qualificação (Q1, Q2 ou Q3)
  const initializeQualifyingSession = async (
    stageId: QualifyingStageId,
    currentReg?: RegistrationValidationResult | null,
    currentInvs?: Record<string, TireSetItem[]>,
  ) => {
    const reg = currentReg || registration
    const inventories = currentInvs || tyreInventories
    if (!team || !season || !reg?.snapshot) return

    // BUG-Q1-Q2-TRANSITION-01A1: Se a fase já possui estado persistido com status === 'completed',
    // reutilizar o estado persistido e não chamar initializeStage para proteger os dados esportivos.
    const persistedStage = canonicalQualifyingPersistenceService.readStageState(
      season.id,
      currentRound,
      stageId,
    )
    if (persistedStage && persistedStage.status === 'completed') {
      setQualifyingState(persistedStage)
      setQualifyingInitializationError(null)
      setIsInitializingQualifying(false)
      setIsAutoAdvancing(false)
      return
    }

    const pCar1 = reg.snapshot.entriesByCar.playerCar1
    const pCar2 = reg.snapshot.entriesByCar.playerCar2
    if (!pCar1 || !pCar2) return

    setIsInitializingQualifying(true)

    try {
      const eligible = resolveEligibleQualifyingParticipants(stageId, reg)

      // BUG-SQ3-TRANSITION-R3: Se a fase não tem participantes elegíveis porque a fase anterior
      // não foi concluída, não inicializar, não marcar pilotos como eliminados e não persistir estado vazio.
      if (stageId !== 'q1' && stageId !== 'sq1' && eligible.length === 0) {
        const parentStage =
          stageId === 'sq2' ? 'sq1' : stageId === 'sq3' ? 'sq2' : stageId === 'q2' ? 'q1' : 'q2'
        const pRes = canonicalQualifyingPersistenceService.readStageResult(
          season.id,
          currentRound,
          parentStage as any,
        )
        const pState = canonicalQualifyingPersistenceService.readStageState(
          season.id,
          currentRound,
          parentStage as any,
        )
        const hasParentCompleted = Boolean(
          (pRes && pRes.advancingDriverIds && pRes.advancingDriverIds.length > 0) ||
          (pState && pState.status === 'completed'),
        )
        if (!hasParentCompleted) {
          setIsAutoAdvancing(false)
          setIsInitializingQualifying(false)
          return
        }
      }

      // Se estiver reidratando uma sessão que estava salva como 'running' (órfão) ou 'paused',
      // normalizar para 'paused' ao reabrir sem ticker ativo, garantindo que o usuário precise dar PLAY
      // e que a sessão seja retomável sem ser considerada running fantasma.
      const savedState = canonicalQualifyingPersistenceService.readStageState(
        season.id,
        currentRound,
        stageId,
      )
      if (savedState && savedState.status === 'running' && !isAutoAdvancing) {
        savedState.status = 'paused'
        canonicalQualifyingPersistenceService.saveStageState(season.id, currentRound, savedState)
      }

      // BUG-TYRE-SYNC-01A: Garantir inventário canônico materializado e selecionar APENAS jogo real elegível (wear < 100)
      let activeInvs = inventories
      if (
        !activeInvs[pCar1.driverId] ||
        activeInvs[pCar1.driverId].length === 0 ||
        !activeInvs[pCar2.driverId] ||
        activeInvs[pCar2.driverId].length === 0
      ) {
        activeInvs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
          seasonId: season.id,
          round: currentRound,
          driverIds: [pCar1.driverId, pCar2.driverId],
          primaryDriverIds: [pCar1.driverId, pCar2.driverId],
        })
        setTyreInventories(activeInvs)
      }

      const car1Tire = activeInvs[pCar1.driverId]?.find((t) => (t.wear || 0) < 100)
      const car2Tire = activeInvs[pCar2.driverId]?.find((t) => (t.wear || 0) < 100)

      // Parc Fermé: setup herdado de TL2
      const inherited = practiceSessionService.resolveInheritedWeekendKnowledge(
        team.id,
        season.id,
        currentRound,
        'tp2',
      )

      const qState = CanonicalQualifyingRunner.initializeStage({
        stageId,
        seasonId: season.id,
        round: currentRound,
        playerCar1: {
          driverId: pCar1.driverId,
          driverName: pCar1.driverName,
          driverNumber: 1,
          tyreSetId: car1Tire?.id || '',
          compound: car1Tire?.compound || 'macio',
          wear: car1Tire?.wear ?? 100,
          setup: inherited.car1Setup || {
            frontWing: 6,
            rearWing: 6,
            suspension: 6,
            differential: 50,
          },
        },
        playerCar2: {
          driverId: pCar2.driverId,
          driverName: pCar2.driverName,
          driverNumber: 2,
          tyreSetId: car2Tire?.id || '',
          compound: car2Tire?.compound || 'macio',
          wear: car2Tire?.wear ?? 100,
          setup: inherited.car2Setup || {
            frontWing: 6,
            rearWing: 6,
            suspension: 6,
            differential: 50,
          },
        },
        eligibleParticipants: eligible,
      })

      setQualifyingState(qState)
      setQualifyingInitializationError(null)
      setIsInitializingQualifying(false)
      setIsAutoAdvancing(false)

      // Se Q3 já estiver concluído, verificar se já temos o grid final
      if (stageId === 'q3' && qState.status === 'completed') {
        const fullGrid = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
          season.id,
          currentRound,
        )
        setCompleteQualifyingResult(fullGrid)
        // Carregar resultado oficial caso já tenha sido homologado
        const canonicalCareerId = resolveCanonicalCareerId(season, team)
        const official = canonicalRaceResultService.getOfficialRaceResult(
          canonicalCareerId,
          season.year || 2026,
          currentRound,
        )
        if (official) {
          setOfficialRaceResult(official)
        }
      }
    } catch (err: unknown) {
      if (err instanceof QualifyingPrerequisiteError) {
        setQualifyingInitializationError(err)
        setIsInitializingQualifying(false)
        return
      }
      console.error('[initializeQualifyingSession] Erro inesperado:', err)
      setIsInitializingQualifying(false)
      throw err
    }
  }

  // Escalações temporárias de novatos para TL1
  const [activeRookieCar1, setActiveRookieCar1] = useState<RookieTemporaryFP1Assignment | null>(
    null,
  )
  const [activeRookieCar2, setActiveRookieCar2] = useState<RookieTemporaryFP1Assignment | null>(
    null,
  )
  const [allDriversCatalog, setAllDriversCatalog] = useState<DriverModel[]>(() => {
    return (MBJ_2026_PILOTS as unknown as DriverModel[]) || []
  })

  // Ref para guardar avisos pendentes de revisão de plano de rookie
  const [pendingRookieReviewToasts, setPendingRookieReviewToasts] = useState<
    Array<{ carId: 'car1' | 'car2'; title: string; description: string }>
  >([])
  const rookieReviewToastedRef = useRef<Set<string>>(new Set())

  // Carregar catálogo de pilotos para o modal de novatos e assignments salvos
  useEffect(() => {
    if (!season?.id || !team?.id) return
    let a1 = RookiePracticeRequirementService.getTemporaryFP1Assignment(
      season.id,
      currentRound,
      team.id,
      'car1',
    )
    let a2 = RookiePracticeRequirementService.getTemporaryFP1Assignment(
      season.id,
      currentRound,
      team.id,
      'car2',
    )

    // Se não há assignment ativo em memória/storage imediato, verifica se existe plano prévio no Calendário
    const careerId = resolveCanonicalCareerId(season, team)
    const planC1 = RookieTl1PlanningService.getPlanForSeat(
      careerId,
      season.id,
      team.id,
      currentRound,
      'car1',
    )
    const planC2 = RookieTl1PlanningService.getPlanForSeat(
      careerId,
      season.id,
      team.id,
      currentRound,
      'car2',
    )

    f1Service
      .getMarketDrivers()
      .then((res) => {
        const driversList = Array.isArray(res) && res.length > 0 ? res : allDriversCatalog
        if (Array.isArray(res) && res.length > 0) {
          setAllDriversCatalog(res)
        }

        const newPendingToasts: Array<{
          carId: 'car1' | 'car2'
          title: string
          description: string
        }> = []

        // Revalidação do plano Carro 1
        if (planC1 && !a1) {
          const val1 = RookieTl1PlanningService.validateSeatPlan({
            plan: planC1,
            availableDrivers: driversList,
            raceResults: undefined,
          })
          if (val1.isValid) {
            const originalC1 = registration?.snapshot?.entriesByCar?.playerCar1
            const newAssignment1: RookieTemporaryFP1Assignment = {
              seasonId: season.id,
              round: currentRound,
              teamId: team.id,
              carId: 'car1',
              rookieDriverId: planC1.driverId,
              rookieDriverName: planC1.driverName || 'Piloto Novato',
              originalDriverId: originalC1?.driverId || 'drv_c1',
              originalDriverName: originalC1?.driverName || 'Piloto 1',
              rookieSpeed: 78,
              rookieConsistency: 77,
              rookieTechnicalFeedback: 70,
            }
            RookiePracticeRequirementService.setTemporaryFP1Assignment(newAssignment1)
            a1 = newAssignment1
            setActiveRookieCar1(newAssignment1)
          } else {
            // Salva status como NEEDS_REVIEW e NÃO substitui automaticamente
            const allPlans = RookieTl1PlanningService.getPlans(careerId, season.id, team.id)
            const updated = allPlans.map((p) =>
              p.round === currentRound && p.carId === 'car1' ? val1.updatedPlan : p,
            )
            RookieTl1PlanningService.savePlans(careerId, season.id, team.id, updated)
            newPendingToasts.push({
              carId: 'car1',
              title: 'PLANEJAMENTO DE ROOKIE PRECISA DE REVISÃO (Carro 1)',
              description: val1.reason || 'Piloto não elegível. Escolha um novo novato.',
            })
          }
        }

        // Revalidação do plano Carro 2
        if (planC2 && !a2) {
          const val2 = RookieTl1PlanningService.validateSeatPlan({
            plan: planC2,
            availableDrivers: driversList,
            raceResults: undefined,
          })
          if (val2.isValid) {
            const originalC2 = registration?.snapshot?.entriesByCar?.playerCar2
            const newAssignment2: RookieTemporaryFP1Assignment = {
              seasonId: season.id,
              round: currentRound,
              teamId: team.id,
              carId: 'car2',
              rookieDriverId: planC2.driverId,
              rookieDriverName: planC2.driverName || 'Piloto Novato',
              originalDriverId: originalC2?.driverId || 'drv_c2',
              originalDriverName: originalC2?.driverName || 'Piloto 2',
              rookieSpeed: 77,
              rookieConsistency: 76,
              rookieTechnicalFeedback: 68,
            }
            RookiePracticeRequirementService.setTemporaryFP1Assignment(newAssignment2)
            a2 = newAssignment2
            setActiveRookieCar2(newAssignment2)
          } else {
            // Salva status como NEEDS_REVIEW e NÃO substitui automaticamente
            const allPlans = RookieTl1PlanningService.getPlans(careerId, season.id, team.id)
            const updated = allPlans.map((p) =>
              p.round === currentRound && p.carId === 'car2' ? val2.updatedPlan : p,
            )
            RookieTl1PlanningService.savePlans(careerId, season.id, team.id, updated)
            newPendingToasts.push({
              carId: 'car2',
              title: 'PLANEJAMENTO DE ROOKIE PRECISA DE REVISÃO (Carro 2)',
              description: val2.reason || 'Piloto não elegível. Escolha um novo novato.',
            })
          }
        }

        if (newPendingToasts.length > 0) {
          setPendingRookieReviewToasts(newPendingToasts)
        }
      })
      .catch(() => {})

    setActiveRookieCar1(a1)
    setActiveRookieCar2(a2)
  }, [season?.id, team?.id, currentRound, registration?.snapshot])

  // Efeito dedicado para disparar avisos de revisão pós-render de forma idempotente por carro/rodada
  useEffect(() => {
    if (!pendingRookieReviewToasts.length || !season?.id) return

    pendingRookieReviewToasts.forEach((item) => {
      const guardKey = `${season.id}_r${currentRound}_${item.carId}`
      if (!rookieReviewToastedRef.current.has(guardKey)) {
        rookieReviewToastedRef.current.add(guardKey)
        toast({
          variant: 'destructive',
          title: item.title,
          description: item.description,
        })
      }
    })
  }, [pendingRookieReviewToasts, season?.id, currentRound, toast])

  // Handlers para atribuir ou limpar novato no TL1
  const handleAssignRookie = (
    carId: 'car1' | 'car2',
    rookie: RookieEligibilityCheck,
    originalDriver: DriverModel,
  ) => {
    if (!season?.id || !team?.id) return
    const assignment: RookieTemporaryFP1Assignment = {
      seasonId: season.id,
      round: currentRound,
      teamId: team.id,
      carId,
      rookieDriverId: rookie.driverId,
      rookieDriverName: rookie.driverName,
      originalDriverId: originalDriver.id,
      originalDriverName: originalDriver.name,
      rookieSpeed: 78,
      rookieConsistency: 77,
      rookieTechnicalFeedback: 70,
    }
    RookiePracticeRequirementService.setTemporaryFP1Assignment(assignment)
    if (carId === 'car1') {
      setActiveRookieCar1(assignment)
    } else {
      setActiveRookieCar2(assignment)
    }
    toast({
      title: 'Novato Escalado para o TL1',
      description: `${rookie.driverName} assumirá o ${carId === 'car1' ? 'Carro 1' : 'Carro 2'} exclusivamente no TL1.`,
    })

    // Se estiver em TL1 e sessão aberta, atualiza o carro na sessão
    if (selectedSessionId === 'tp1' && sessionState) {
      sessionState.cars[carId].driverId = rookie.driverId
      sessionState.cars[carId].driverName = rookie.driverName
      practiceSessionService.saveSessionState(sessionState)
      setSessionState({ ...sessionState })
    }
  }

  const handleClearRookieAssignment = (carId: 'car1' | 'car2') => {
    if (!season?.id || !team?.id || !registration?.snapshot) return
    RookiePracticeRequirementService.clearTemporaryFP1Assignment(
      season.id,
      currentRound,
      team.id,
      carId,
    )
    if (carId === 'car1') {
      setActiveRookieCar1(null)
    } else {
      setActiveRookieCar2(null)
    }

    const original =
      carId === 'car1'
        ? registration.snapshot.entriesByCar.playerCar1
        : registration.snapshot.entriesByCar.playerCar2

    if (original && selectedSessionId === 'tp1' && sessionState) {
      sessionState.cars[carId].driverId = original.driverId
      sessionState.cars[carId].driverName = original.driverName
      practiceSessionService.saveSessionState(sessionState)
      setSessionState({ ...sessionState })
    }

    toast({
      title: 'Piloto Titular Restaurado',
      description: `O titular oficial ${original?.driverName || ''} reassumiu o cockpit.`,
    })
  }

  // 6. Contexto de simulação do runner (no TL1, usa o novato temporário se escalado)
  const runnerContext = useMemo(() => {
    if (!team || !registration?.snapshot) return null

    const pCar1 = registration.snapshot.entriesByCar.playerCar1
    const pCar2 = registration.snapshot.entriesByCar.playerCar2

    // Substituição temporária restrita ao TL1
    const isTL1 = selectedSessionId === 'tp1'
    const c1DriverId =
      isTL1 && activeRookieCar1 ? activeRookieCar1.rookieDriverId : pCar1?.driverId || 'drv_c1'
    const c1DriverName =
      isTL1 && activeRookieCar1
        ? activeRookieCar1.rookieDriverName
        : pCar1?.driverName || 'Piloto 1'
    const c1IsRookie = isTL1 && !!activeRookieCar1

    const c2DriverId =
      isTL1 && activeRookieCar2 ? activeRookieCar2.rookieDriverId : pCar2?.driverId || 'drv_c2'
    const c2DriverName =
      isTL1 && activeRookieCar2
        ? activeRookieCar2.rookieDriverName
        : pCar2?.driverName || 'Piloto 2'
    const c2IsRookie = isTL1 && !!activeRookieCar2

    return {
      round: currentRound,
      gpName: gpInfo.name,
      circuitName: gpInfo.circuit,
      lengthKm: gpInfo.circuitLengthKm || 5.8,
      tireAbrasiveness: circuitProfile?.auxiliary?.tyreSeverity
        ? Math.round(circuitProfile.auxiliary.tyreSeverity / 15)
        : 6,
      weather: 'seco' as const,
      teamChassisRating: team.strength || 75,
      teamEngineSupplier: team.engine_supplier || 'Audi',
      teamName: team.name,
      teamColor: team.color || '#00A6FB',
      drivers: [
        {
          id: c1DriverId,
          name: c1DriverName,
          speed: c1IsRookie ? 78 : 82,
          consistency: c1IsRookie ? 77 : 80,
          defense: c1IsRookie ? 75 : 78,
          technical_feedback: c1IsRookie ? 70 : 75,
          isRookie: c1IsRookie,
        },
        {
          id: c2DriverId,
          name: c2DriverName,
          speed: c2IsRookie ? 77 : 80,
          consistency: c2IsRookie ? 76 : 79,
          defense: c2IsRookie ? 74 : 76,
          technical_feedback: c2IsRookie ? 68 : 72,
          isRookie: c2IsRookie,
        },
      ],
    }
  }, [
    team,
    registration,
    currentRound,
    gpInfo,
    circuitProfile,
    selectedSessionId,
    activeRookieCar1,
    activeRookieCar2,
  ])

  // Contexto completo para o motor de qualificação (inclui rivais e clima)
  const qualifyingTickContext = useMemo<QualifyingTickContext | null>(() => {
    if (!runnerContext || !season?.id || !registration?.snapshot) return null

    const allSnapshotEntries = registration.snapshot.entries || []
    const playerDriverIds = new Set(
      [
        registration.snapshot.entriesByCar?.playerCar1?.driverId,
        registration.snapshot.entriesByCar?.playerCar2?.driverId,
      ].filter(Boolean) as string[],
    )
    const rivalEntries = allSnapshotEntries.filter(
      (e) => !e.isPlayerTeam && !playerDriverIds.has(e.driverId),
    )
    const rivalDrivers: QualifyingDriverContext[] = rivalEntries.map((r, idx) => ({
      id: r.driverId,
      name: r.driverName,
      speed: 78 + (idx % 8),
      consistency: 80,
      defense: 76,
      teamId: r.teamId || `rival_${idx}`,
      teamName: r.teamName || `Equipe ${idx + 1}`,
      teamColor: r.teamColor || '#64748B',
      carNumber: r.driverNumber || idx + 3,
    }))

    return {
      seasonId: season.id,
      round: currentRound,
      gpName: runnerContext.gpName,
      circuitName: runnerContext.circuitName,
      lengthKm: runnerContext.lengthKm,
      tireAbrasiveness: runnerContext.tireAbrasiveness,
      weather: runnerContext.weather,
      teamChassisRating: runnerContext.teamChassisRating,
      teamEngineSupplier: runnerContext.teamEngineSupplier,
      teamName: runnerContext.teamName,
      teamColor: runnerContext.teamColor,
      drivers: runnerContext.drivers,
      rivalDrivers,
    }
  }, [runnerContext, season?.id, currentRound, registration])

  // 7. Controles de Play / Pause (Treino Livre ou Qualificação)
  const handleTogglePlay = async () => {
    const isQuali = isQualifyingStage(selectedSessionId)

    if (isQuali) {
      // Se não há qualifyingState em memória ou se o qualifyingState em memória não corresponde à sessão selecionada,
      // reidrata do storage canônico ou reinicializa para a sessão ativa
      let currentQuali = qualifyingState
      if (!currentQuali || currentQuali.stageId !== selectedSessionId) {
        if (season?.id) {
          const storedState = canonicalQualifyingPersistenceService.readStageState(
            season.id,
            currentRound,
            selectedSessionId as QualifyingStageId,
          )
          if (storedState) {
            currentQuali = storedState
            setQualifyingState(storedState)
          } else {
            await initializeQualifyingSession(selectedSessionId as QualifyingStageId)
            const freshState = canonicalQualifyingPersistenceService.readStageState(
              season.id,
              currentRound,
              selectedSessionId as QualifyingStageId,
            )
            if (freshState) {
              currentQuali = freshState
              setQualifyingState(freshState)
            } else {
              return
            }
          }
        }
      }
      if (!currentQuali) return

      let activeState = currentQuali

      // Se a simulação já está rodando (running ativo), o clique pausa a sessão
      if (isAutoAdvancing) {
        setIsAutoAdvancing(false)
        activeState.status = 'paused'
        if (season?.id) {
          canonicalQualifyingPersistenceService.saveStageState(season.id, currentRound, activeState)
        }
        setQualifyingState({ ...activeState })
        return
      }

      // Se não está rodando (isAutoAdvancing === false), estamos INICIANDO ou RETOMANDO:
      // Pode ser status === 'paused', 'not_started', ou 'running' órfão vindo de reload.
      // Em todos esses casos, running órfão/paused é retomável.
      if (activeState.leaderboard.length === 0) {
        const stageId = activeState.stageId
        const parentStage =
          stageId === 'sq2'
            ? 'sq1'
            : stageId === 'sq3'
              ? 'sq2'
              : stageId === 'q2'
                ? 'q1'
                : stageId === 'q3'
                  ? 'q2'
                  : null

        let hasCanonicalPrevious = false
        let isParentIncomplete = false
        let parentIncompleteState = ''
        if (parentStage && season?.id) {
          const pRes = canonicalQualifyingPersistenceService.readStageResult(
            season.id,
            currentRound,
            parentStage as any,
          )
          const pState = canonicalQualifyingPersistenceService.readStageState(
            season.id,
            currentRound,
            parentStage as any,
          )
          if (
            pState &&
            (pState.status === 'paused' || (pState.status === 'running' && !isAutoAdvancing))
          ) {
            isParentIncomplete = true
            parentIncompleteState = pState.status === 'paused' ? 'Pausada' : 'Em Andamento'
          }
          if (
            (pRes && pRes.advancingDriverIds && pRes.advancingDriverIds.length > 0) ||
            (pState && pState.status === 'completed')
          ) {
            hasCanonicalPrevious = true
          }
        }

        if (!hasCanonicalPrevious && stageId !== 'q1' && stageId !== 'sq1') {
          if (isParentIncomplete) {
            toast({
              variant: 'destructive',
              title: `Fase ${parentStage?.toUpperCase()} ${parentIncompleteState || 'Em Andamento'}`,
              description: `A fase anterior (${parentStage?.toUpperCase()}) ainda está em andamento. Retome e conclua a fase anterior primeiro.`,
            })
          } else {
            toast({
              variant: 'destructive',
              title: 'Sessão Sem Participantes',
              description: 'A fase de classificação anterior precisa ser concluída e confirmada.',
            })
          }
          return
        }

        // Reidratação automática
        await initializeQualifyingSession(stageId)
        const reloaded = season?.id
          ? canonicalQualifyingPersistenceService.readStageState(season.id, currentRound, stageId)
          : null
        if (reloaded && reloaded.leaderboard.length > 0) {
          activeState = reloaded
        } else {
          toast({
            variant: 'destructive',
            title: 'Sessão Sem Participantes',
            description: 'A fase de classificação anterior precisa ser concluída e confirmada.',
          })
          return
        }
      }

      // CORREÇÃO 3: a checagem de "Sessão Concluída" deve validar a sessão SELECIONADA (selectedSessionId),
      // não activeState.stageId residual da fase anterior. Se activeState.stageId !== selectedSessionId,
      // concluir a reidratação/inicialização da sessão selecionada antes de avaliar o guard.
      if (activeState.stageId !== selectedSessionId) {
        await initializeQualifyingSession(selectedSessionId as QualifyingStageId)
        const fresh = season?.id
          ? canonicalQualifyingPersistenceService.readStageState(
              season.id,
              currentRound,
              selectedSessionId as QualifyingStageId,
            )
          : null
        if (fresh) {
          activeState = fresh
          setQualifyingState(fresh)
        }
      }

      const stored = refreshCompletedSessions()
      if (
        selectedSessionId === activeState.stageId &&
        (activeState.status === 'completed' || stored.includes(selectedSessionId))
      ) {
        toast({
          variant: 'destructive',
          title: 'Sessão Concluída',
          description: 'Não é permitido executar novamente uma fase oficialmente concluída.',
        })
        return
      }

      // Retomar ou iniciar execução da sessão
      setIsAutoAdvancing(true)
      activeState.status = 'running'
      if (season?.id) {
        canonicalQualifyingPersistenceService.saveStageState(season.id, currentRound, activeState)
      }
      setQualifyingState({ ...activeState })
      return
    }

    if (!sessionState) return
    const stored = refreshCompletedSessions()
    if (sessionState.status === 'completed' || stored.includes(sessionState.sessionType)) {
      toast({
        variant: 'destructive',
        title: 'Sessão Concluída',
        description: 'Não é permitido executar novamente uma sessão oficialmente concluída.',
      })
      return
    }

    if (isAutoAdvancing) {
      setIsAutoAdvancing(false)
      sessionState.status = 'paused'
      practiceSessionService.saveSessionState(sessionState)
    } else {
      setIsAutoAdvancing(true)
      sessionState.status = 'running'
      practiceSessionService.saveSessionState(sessionState)
    }
  }

  // Loop contínuo de simulação (TL ou Qualificação)
  useEffect(() => {
    const isQuali = isQualifyingStage(selectedSessionId)

    if (!isAutoAdvancing) {
      if (autoAdvanceIntervalRef.current) {
        clearInterval(autoAdvanceIntervalRef.current)
      }
      return
    }

    const intervalMs = Math.round(1000 / selectedSpeed)

    // SQ2/SQ3/Q2/Q3: Diferenciar ausência real de classificados da fase anterior vs leaderboard vazio reidratável
    if (isQuali && qualifyingState && qualifyingState.leaderboard.length === 0) {
      const stageId = qualifyingState.stageId
      const parentStage =
        stageId === 'sq2'
          ? 'sq1'
          : stageId === 'sq3'
            ? 'sq2'
            : stageId === 'q2'
              ? 'q1'
              : stageId === 'q3'
                ? 'q2'
                : null
      let hasPreviousAdvancing = false
      let isParentIncomplete = false
      if (parentStage && season?.id) {
        const pRes = canonicalQualifyingPersistenceService.readStageResult(
          season.id,
          currentRound,
          parentStage as any,
        )
        const pState = canonicalQualifyingPersistenceService.readStageState(
          season.id,
          currentRound,
          parentStage as any,
        )
        if (
          pState &&
          (pState.status === 'paused' || (pState.status === 'running' && !isAutoAdvancing))
        ) {
          isParentIncomplete = true
        }
        if (
          (pRes && pRes.advancingDriverIds && pRes.advancingDriverIds.length > 0) ||
          (pState && pState.status === 'completed')
        ) {
          hasPreviousAdvancing = true
        }
      }
      if (hasPreviousAdvancing) {
        // Reidrata a sessão automaticamente em vez de bloquear
        initializeQualifyingSession(stageId)
      } else {
        setIsAutoAdvancing(false)
        if (isParentIncomplete) {
          toast({
            variant: 'destructive',
            title: `Fase ${parentStage?.toUpperCase()} Em Andamento`,
            description: `A fase anterior (${parentStage?.toUpperCase()}) ainda está em andamento. Retome e conclua a fase anterior primeiro.`,
          })
        }
      }
      return
    }

    if (isQuali && qualifyingTickContext) {
      autoAdvanceIntervalRef.current = setInterval(() => {
        setQualifyingState((prev) => {
          if (!prev || prev.status !== 'running' || prev.timeRemainingSec <= 0) {
            setIsAutoAdvancing(false)
            return prev
          }

          const deltaSec = 2 * selectedSpeed
          const res = CanonicalQualifyingRunner.tick(prev, deltaSec, qualifyingTickContext)

          // Sincronizar pneus
          res.lapsCompletedThisTick.forEach((lapItem) => {
            if (lapItem.carId) {
              const car = res.nextState.cars[lapItem.carId]
              if (car.currentTyreSetId && season?.id) {
                canonicalWeekendTyrePersistence.recordTyreUsage({
                  seasonId: season.id,
                  round: currentRound,
                  driverId: car.driverId,
                  tyreSetId: car.currentTyreSetId,
                  lapsAdded: 1,
                  finalWearPct: car.tyreWear,
                })
              }
            }
          })

          if (res.nextState.status === 'completed') {
            setIsAutoAdvancing(false)
          }

          if (season?.id) {
            canonicalQualifyingPersistenceService.saveStageState(
              season.id,
              currentRound,
              res.nextState,
            )
          }
          return res.nextState
        })
      }, intervalMs)

      return () => {
        if (autoAdvanceIntervalRef.current) {
          clearInterval(autoAdvanceIntervalRef.current)
        }
      }
    }

    if (!sessionState || !runnerContext) {
      return
    }

    autoAdvanceIntervalRef.current = setInterval(() => {
      setSessionState((prev) => {
        if (!prev || prev.status !== 'running' || prev.timeRemainingSec <= 0) {
          setIsAutoAdvancing(false)
          return prev
        }

        const deltaSec = 2 * selectedSpeed
        const res = PracticeSessionRunner.tick(prev, deltaSec, runnerContext)

        // Sincronizar pneus consumidos
        res.lapsCompletedThisTick.forEach((lapItem) => {
          const car = res.nextState.cars[lapItem.carId]
          if (car.currentTyreSetId) {
            canonicalWeekendTyrePersistence.recordTyreUsage({
              seasonId: prev.seasonId,
              round: prev.round,
              driverId: car.driverId,
              tyreSetId: car.currentTyreSetId,
              lapsAdded: 1,
              finalWearPct: car.tyreWear,
            })
          }
        })

        // Decisão obrigatória
        const decision = CanonicalPracticeV2Runner.checkMandatoryDecisionEvent(
          prev,
          res.nextState,
          res.events,
        )

        if (decision.hasDecision) {
          setIsAutoAdvancing(false)
          res.nextState.status = 'paused'
          toast({
            title: 'Interrupção de Treino (Decisão Obrigatória)',
            description: decision.reason,
          })
        }

        if (res.nextState.status === 'completed') {
          setIsAutoAdvancing(false)
          const targetTypeUpper = res.nextState.sessionType.toUpperCase()
          if (season?.id && team?.id) {
            const currentStored = readStoredCompletedSessions(season.id, currentRound)
            if (!currentStored.includes(res.nextState.sessionType)) {
              const updated = [...currentStored, res.nextState.sessionType]
              writeStoredCompletedSessions(season.id, currentRound, updated)
              setCompletedSessions(updated)
            }

            // Sincronização Canônica de Acerto (RACE-TL-01B):
            // Apura e persiste o ganho real apurado na sessão para os monopostos em carreira habilitada
            const activeCareerConfigVersion =
              (career as any)?.config_version || (season as any)?.config_version
            if (
              activeCareerConfigVersion &&
              (res.nextState.sessionType === 'tp1' ||
                res.nextState.sessionType === 'tp2' ||
                res.nextState.sessionType === 'tp3')
            ) {
              try {
                const c1 = res.nextState.cars.car1
                const c2 = res.nextState.cars.car2
                const isSprintRound = hasSprintWeekend(currentRound)

                if (c1 && c1.totalLaps > 0) {
                  CanonicalPracticeIntegrationAdapter.persistSessionCarSetup({
                    careerId: career?.id || season.id,
                    seasonId: season.id,
                    round: currentRound,
                    sessionType: res.nextState.sessionType,
                    teamId: team.id,
                    carIndex: 1,
                    driverId: c1.driverId,
                    configVersion: activeCareerConfigVersion,
                    completedLaps: c1.totalLaps,
                    consistency: 85,
                    isSprint: isSprintRound,
                  }).catch((err) =>
                    console.warn('[WeekendV2Page] Erro ao sincronizar acerto C1:', err),
                  )
                }

                if (c2 && c2.totalLaps > 0) {
                  CanonicalPracticeIntegrationAdapter.persistSessionCarSetup({
                    careerId: career?.id || season.id,
                    seasonId: season.id,
                    round: currentRound,
                    sessionType: res.nextState.sessionType,
                    teamId: team.id,
                    carIndex: 2,
                    driverId: c2.driverId,
                    configVersion: activeCareerConfigVersion,
                    completedLaps: c2.totalLaps,
                    consistency: 85,
                    isSprint: isSprintRound,
                  }).catch((err) =>
                    console.warn('[WeekendV2Page] Erro ao sincronizar acerto C2:', err),
                  )
                }
              } catch (e) {
                console.warn('[WeekendV2Page] Falha na integração de acerto canônico:', e)
              }
            }

            // FW2.1C.1: Se a sessão for TL1, homologar créditos de novato para carros que cumpriram >= 1 volta
            if (res.nextState.sessionType === 'tp1') {
              const c1 = res.nextState.cars.car1
              const c2 = res.nextState.cars.car2

              if (activeRookieCar1 && c1.totalLaps >= 1) {
                RookiePracticeRequirementService.grantRookieFP1Credit({
                  seasonId: season.id,
                  round: currentRound,
                  teamId: team.id,
                  carId: 'car1',
                  driverId: activeRookieCar1.rookieDriverId,
                  driverName: activeRookieCar1.rookieDriverName,
                  lapsCompleted: c1.totalLaps,
                  isRookieEligible: true,
                })
              }

              if (activeRookieCar2 && c2.totalLaps >= 1) {
                RookiePracticeRequirementService.grantRookieFP1Credit({
                  seasonId: season.id,
                  round: currentRound,
                  teamId: team.id,
                  carId: 'car2',
                  driverId: activeRookieCar2.rookieDriverId,
                  driverName: activeRookieCar2.rookieDriverName,
                  lapsCompleted: c2.totalLaps,
                  isRookieEligible: true,
                })
              }

              // Homologação real das equipes rivais no encerramento contínuo do TL1
              try {
                const rivalEntries =
                  registration?.snapshot?.entries?.filter((e) => !e.isPlayerTeam) || []
                const rivalsMap = new Map<string, any>()
                rivalEntries.forEach((r, idx) => {
                  const rTeamId = r.teamId || `rival_${idx}`
                  if (!rivalsMap.has(rTeamId)) {
                    rivalsMap.set(rTeamId, {
                      id: rTeamId,
                      name: r.teamName || `Equipe ${idx + 1}`,
                      team_key: (r as any).teamKey || rTeamId,
                    })
                  }
                })
                const rivalTeamsList = Array.from(rivalsMap.values())
                RookiePracticeRequirementService.simulateRivalAICreditsForRound(
                  season.id,
                  currentRound,
                  rivalTeamsList,
                  allDriversCatalog,
                  res.nextState.leaderboard,
                )
              } catch (e) {
                console.warn('[WeekendV2Page] Erro ao homologar créditos TL1 dos rivais (tick):', e)
              }
            }
          }
          toast({
            title: 'Sessão Concluída',
            description: `${targetTypeUpper} finalizado oficialmente pela bandeira quadriculada.`,
          })
        }

        practiceSessionService.saveSessionState(res.nextState)
        return res.nextState
      })
    }, intervalMs)

    return () => {
      if (autoAdvanceIntervalRef.current) {
        clearInterval(autoAdvanceIntervalRef.current)
      }
    }
  }, [isAutoAdvancing, selectedSpeed, runnerContext, qualifyingTickContext, selectedSessionId])

  // BUG-SQ1-RESULT-INTEGRITY-01 & BUG-Q1-RESULT-01B: Detecção de conclusão via useEffect observando qualifyingState.status === 'completed'.
  // Guard robusto: completedQualiStagesHandledRef só marca após confirmar que o StageResult persistido existe e foi processado com sucesso.
  // Se o resultado canônico ainda não foi persistido ou não foi lido com sucesso, não marca como handled para permitir retry no próximo ciclo.
  useEffect(() => {
    if (!qualifyingState || qualifyingState.status !== 'completed' || !season?.id) {
      return
    }

    const stageId = qualifyingState.stageId
    const roundKey = `${season.id}_r${currentRound}_${stageId}`

    if (completedQualiStagesHandledRef.current.has(roundKey)) {
      return
    }

    const success = handleQualifyingStageCompleted(stageId)
    if (success) {
      completedQualiStagesHandledRef.current.add(roundKey)
    }
  }, [qualifyingState?.status, qualifyingState?.stageId, season?.id, currentRound])

  // Conclusão oficial de fase de qualificação
  // Retorna boolean indicando se o processamento foi concluído com sucesso (StageResult válido confirmado)
  const handleQualifyingStageCompleted = (stageId: QualifyingStageId): boolean => {
    if (!season?.id) return false

    // BUG-Q1-RESULT-01B (Item 3): Fonte primária é readStageResult.
    // Se o resultado canônico já existir e estiver válido, consumi-lo diretamente
    // SEM reconstruir classificação, recalcular advancingDriverIds ou sobrescrever o resultado salvo.
    let stageResult = canonicalQualifyingPersistenceService.readStageResult(
      season.id,
      currentRound,
      stageId,
    )

    // Assegurar que o stageState persistido canônico tenha status 'completed'
    let stgState = canonicalQualifyingPersistenceService.readStageState(
      season.id,
      currentRound,
      stageId,
    )

    // Se o estado não estava no storage, tentar pegar do state em memória se for o mesmo stage
    if (!stgState && qualifyingState && qualifyingState.stageId === stageId) {
      stgState = qualifyingState
    }

    if (stgState && stgState.status !== 'completed') {
      stgState.status = 'completed'
      try {
        const stateSaveOutcome = canonicalQualifyingPersistenceService.saveStageState(
          season.id,
          currentRound,
          stgState,
        )
        if (!stateSaveOutcome.success) {
          console.warn(
            `[WeekendV2Page] Falha observável ao salvar estado concluído da fase ${stageId}:`,
            stateSaveOutcome,
          )
        }
      } catch (err: any) {
        console.warn(`[WeekendV2Page] Exceção capturada ao salvar estado da fase ${stageId}:`, err)
      }
    }

    // Fallback legado para sessões antigas que porventura não tenham persistido o StageResult pelo runner
    if (
      (!stageResult || !Array.isArray(stageResult.entries) || stageResult.entries.length === 0) &&
      stgState &&
      Array.isArray(stgState.leaderboard) &&
      stgState.leaderboard.length > 0
    ) {
      CanonicalQualifyingRunner.sortLeaderboard(stgState.leaderboard)
      const rules = CANONICAL_QUALIFYING_RULES[stageId]
      const advancingDriverIds: string[] = []
      const eliminatedDriverIds: string[] = []

      stgState.leaderboard.forEach((entry, idx) => {
        const position = idx + 1
        if (position <= rules.advancingCount) {
          advancingDriverIds.push(entry.driverId)
          entry.isEliminated = false
        } else {
          eliminatedDriverIds.push(entry.driverId)
          entry.isEliminated = true
          entry.eliminatedInStage = stageId
        }
      })

      const reconstructedResult: QualifyingStageResult = {
        stageId,
        seasonId: season.id,
        round: currentRound,
        completedAt: new Date().toISOString(),
        entries: stgState.leaderboard.map((e) => ({
          position: e.position,
          driverId: e.driverId,
          driverName: e.driverName,
          teamId: e.teamId,
          teamName: e.teamName,
          teamColor: e.teamColor,
          bestLapSec: e.bestLapSec,
          bestLapTime: e.bestLapTime,
          bestLapRecordedAtSec: e.bestLapRecordedAtSec || 0,
          compound: e.compound,
          tyreSetId: e.tyreSetId,
          lapsCount: e.laps,
          isPlayer: e.isPlayer,
          carId: e.carId,
          isEliminated: !!e.isEliminated,
          eliminatedInStage: e.eliminatedInStage,
        })),
        advancingDriverIds,
        eliminatedDriverIds,
      }

      const saveOutcome = canonicalQualifyingPersistenceService.saveStageResult(reconstructedResult)
      if (!saveOutcome.success) {
        console.warn(
          `[WeekendV2Page] Falha ao persistir resultado reconstruído da fase ${stageId}:`,
          saveOutcome,
        )
      } else {
        stageResult = reconstructedResult
      }
      try {
        const stateSaveOutcome = canonicalQualifyingPersistenceService.saveStageState(
          season.id,
          currentRound,
          stgState,
        )
        if (!stateSaveOutcome.success) {
          console.warn(
            `[WeekendV2Page] Falha ao persistir stageState reconstruído da fase ${stageId}:`,
            stateSaveOutcome,
          )
        }
      } catch (err: any) {
        console.warn(
          `[WeekendV2Page] Exceção capturada ao salvar stageState reconstruído da fase ${stageId}:`,
          err,
        )
      }
    }

    // F-Q1-TIMES-01A: Reconfirmar a presença real e íntegra do StageResult no storage
    const persistedResultCheck = canonicalQualifyingPersistenceService.readStageResult(
      season.id,
      currentRound,
      stageId,
    )

    // Validar se temos um StageResult válido e persistido com entradas
    // (o readStageResult consulta o cache em memória ativo / backend / localStorage)
    let effectivePersistedResult = persistedResultCheck
    if (
      (!effectivePersistedResult ||
        !Array.isArray(effectivePersistedResult.entries) ||
        effectivePersistedResult.entries.length === 0) &&
      stageResult &&
      Array.isArray(stageResult.entries) &&
      stageResult.entries.length > 0
    ) {
      effectivePersistedResult = stageResult
    }

    const hasValidPersistedResult =
      !!effectivePersistedResult &&
      Array.isArray(effectivePersistedResult.entries) &&
      effectivePersistedResult.entries.length > 0

    if (!hasValidPersistedResult) {
      // F-Q1-TIMES-01A: Falha observável ao usuário.
      // Não marca como handled para permitir retry controlado no próximo ciclo.
      const stageName = stageId.toUpperCase()
      toast({
        variant: 'destructive',
        title: `Erro ao Salvar Resultado do ${stageName}`,
        description: `Não foi possível salvar o resultado do ${stageName}. Tente novamente.`,
      })
      return false
    }

    stageResult = effectivePersistedResult

    // Q2FIX-01: Barreira de integridade obrigatória para a transição Q1 → Q2.
    // Prova por read-back que o consumidor Q2 conseguirá ler aquilo que o produtor Q1 persistiu.
    if (stageId === 'q1') {
      const persistedQ1Result = canonicalQualifyingPersistenceService.readStageResult(
        season.id,
        currentRound,
        'q1',
      )

      const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES['q1'].advancingCount
      const advancingIds = persistedQ1Result?.advancingDriverIds

      const isValidAdvancing =
        !!persistedQ1Result &&
        Array.isArray(advancingIds) &&
        advancingIds.length === expectedAdvancingCount &&
        advancingIds.every((id) => typeof id === 'string' && id.trim().length > 0) &&
        new Set(advancingIds).size === expectedAdvancingCount

      if (!isValidAdvancing) {
        console.warn(
          '[Q2FIX-01] Barreira de integridade Q1→Q2 bloqueou a transição: advancingDriverIds inválidos ou ausentes no StageResult persistido de Q1.',
          { persistedQ1Result, expectedAdvancingCount },
        )
        toast({
          variant: 'destructive',
          title: 'Transição Q1 → Q2 Bloqueada',
          description:
            'O resultado oficial do Q1 ainda não possui os classificados canônicos necessários para o Q2.',
        })
        return false
      }
    }

    const currentStored = readStoredCompletedSessions(season.id, currentRound)
    let updated = currentStored
    const isStageAlreadyStored = currentStored.includes(stageId)
    if (!isStageAlreadyStored) {
      updated = [...currentStored, stageId]
      writeStoredCompletedSessions(season.id, currentRound, updated)
      setCompletedSessions(updated)
    }

    // Avançar o weekend_slot_state canônico caso esteja no slot correspondente
    const canonicalCareerId = resolveCanonicalCareerId(season, team)
    canonicalWeekendSlotPersistenceService
      .loadOrMigrateSlotState({
        careerId: canonicalCareerId,
        seasonId: season.id,
        round: currentRound,
      })
      .then(async (slotState) => {
        if (!slotState) return
        // Mapear stageId para slotNumber
        let targetSlotNum: WeekendSlotNumber | null = null
        if (slotState.weekendFormat === 'SPRINT') {
          // No formato Sprint dos 7 slots canônicos:
          // Slot 1: TL1, Slot 2: QUALI_SPRINT (com subfases SQ1 -> SQ2 -> SQ3), Slot 3: SPRINT...
          // Se o slot 2 for o QUALI_SPRINT, a subfase é atualizada.
          if (stageId === 'sq1') {
            await canonicalWeekendSlotPersistenceService.updateSubPhase({
              careerId: canonicalCareerId,
              seasonId: season.id,
              round: currentRound,
              slotNumber: 2,
              subPhase: 'SQ2',
            })
            targetSlotNum = 2
          } else if (stageId === 'sq2') {
            // SQ2 concluída: avança subPhase para SQ3 e marca o próximo slot/fase correspondente à SQ3 como DISPONÍVEL (AVAILABLE)
            const currentSlotState =
              await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
                careerId: canonicalCareerId,
                seasonId: season.id,
                round: currentRound,
              })
            if (currentSlotState) {
              if (currentSlotState.slots[2]) {
                currentSlotState.slots[2].subPhase = 'SQ3'
                currentSlotState.slots[2].status = 'AVAILABLE'
              }
              currentSlotState.subPhase = 'SQ3'
              currentSlotState.slotStatus = 'AVAILABLE'
              // Se existir slot 3 ou slot específico configurado para SQ3, promove para AVAILABLE
              if (
                currentSlotState.slots[3] &&
                currentSlotState.slots[3].slotType === 'QUALI_SPRINT'
              ) {
                currentSlotState.slots[3].status = 'AVAILABLE'
                currentSlotState.slots[3].subPhase = 'SQ3'
              }
              await canonicalWeekendSlotPersistenceService.saveSlotState(currentSlotState)
            } else {
              await canonicalWeekendSlotPersistenceService.updateSubPhase({
                careerId: canonicalCareerId,
                seasonId: season.id,
                round: currentRound,
                slotNumber: 2,
                subPhase: 'SQ3',
              })
            }
            targetSlotNum = 2
          } else if (stageId === 'sq3') {
            // SQ3 conclui o Slot 2 (QUALI_SPRINT) e promove o Slot 3 (SPRINT)
            targetSlotNum = 2
          } else if (stageId === 'q1') {
            targetSlotNum = 4
          } else if (stageId === 'q2') {
            targetSlotNum = 5
          } else if (stageId === 'q3') {
            targetSlotNum = 6
          }
        } else {
          // Normal sequence: 1: TL1, 2: TL2, 3: TL3, 4: Q1, 5: Q2, 6: Q3, 7: RACE
          if (stageId === 'q1') targetSlotNum = 4
          else if (stageId === 'q2') targetSlotNum = 5
          else if (stageId === 'q3') targetSlotNum = 6
        }

        // BUG-Q1-RESULT-01B (Item 5): Promoção do slot correspondente
        // No Q1, a conclusão confirmada deve sincronizar o slot 4 mesmo quando slotState.currentSlot estiver divergente.
        if (stageId === 'q1') {
          const updatedSlotState = await canonicalWeekendSlotPersistenceService.syncSlotCompleted(
            slotState,
            4,
          )
          setWeekendSlotState(updatedSlotState)
        } else if (targetSlotNum && (stageId === 'sq3' || stageId === 'q2' || stageId === 'q3')) {
          if (slotState.currentSlot === targetSlotNum) {
            const updatedSlotState = await canonicalWeekendSlotPersistenceService.completeSlot(
              slotState,
              targetSlotNum,
            )
            setWeekendSlotState(updatedSlotState)
          }
        } else {
          // Recarregar o slotState atualizado para refletir a nova subfase (ex: SQ3 disponível)
          const reloadedSlot = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
            careerId: canonicalCareerId,
            seasonId: season.id,
            round: currentRound,
          })
          setWeekendSlotState(reloadedSlot)
        }
      })
      .catch((err) => {
        console.warn('[handleQualifyingStageCompleted] Erro ao avançar weekend_slot_state:', err)
      })

    // Efeitos colaterais que só devem acontecer uma vez por estágio
    if (!isStageAlreadyStored) {
      if (stageId === 'q3') {
        // Conclusão de Q3: compõe e homologa o grid completo P1-P24
        const q1Res = canonicalQualifyingPersistenceService.readStageResult(
          season.id,
          currentRound,
          'q1',
        )
        const q2Res = canonicalQualifyingPersistenceService.readStageResult(
          season.id,
          currentRound,
          'q2',
        )
        const q3Res = canonicalQualifyingPersistenceService.readStageResult(
          season.id,
          currentRound,
          'q3',
        )

        if (q1Res && q2Res && q3Res) {
          let fullGrid: CompleteQualifyingWeekendResult | null = null
          try {
            fullGrid = canonicalQualifyingPersistenceService.buildCombinedFinalGrid({
              seasonId: season.id,
              round: currentRound,
              q1Result: q1Res,
              q2Result: q2Res,
              q3Result: q3Res,
            })
          } catch (gridErr: any) {
            console.error(
              '[handleQualifyingStageCompleted] Exceção ao construir/salvar grid final combinado:',
              gridErr,
            )
          }

          const effectiveGrid =
            fullGrid ||
            canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
              season.id,
              currentRound,
            )

          if (
            !effectiveGrid ||
            !Array.isArray(effectiveGrid.finalGrid) ||
            effectiveGrid.finalGrid.length === 0
          ) {
            toast({
              variant: 'destructive',
              title: 'Erro ao Salvar Grid Final de Qualificação',
              description: 'Não foi possível salvar o grid final combinado. Tente novamente.',
            })
            return false
          }

          setCompleteQualifyingResult(effectiveGrid)
        }

        // Desbloqueia CORRIDA
        if (!updated.includes('qualifying')) {
          updated = [...updated, 'qualifying']
          writeStoredCompletedSessions(season.id, currentRound, updated)
          setCompletedSessions(updated)
        }

        toast({
          title: 'Classificação Concluída — Grid Formado!',
          description: 'Q1, Q2 e Q3 finalizados. A etapa de Corrida Principal está desbloqueada.',
        })
      } else if (stageId === 'sq3') {
        // Desbloqueia sprint_race ao concluir SQ3 (Qualificação Sprint final)
        toast({
          title: 'Fase SQ3 Concluída',
          description: 'Qualificação Sprint finalizada. A Corrida Sprint está disponível!',
        })
      } else {
        toast({
          title: `Fase ${stageId.toUpperCase()} Concluída`,
          description: `Eliminações e classificação oficial registradas. Próxima etapa disponível.`,
        })
      }
    }

    // Promover a fase seguinte apenas se a tela ainda não estiver selecionando ela
    const nextStageMap: Record<string, QualifyingStageId> = {
      sq1: 'sq2',
      sq2: 'sq3',
      q1: 'q2',
      q2: 'q3',
    }
    const nextStage = nextStageMap[stageId]
    if (nextStage && selectedSessionId !== nextStage) {
      setSelectedSessionId(nextStage)
      setQualifyingState(null)
      initializeQualifyingSession(nextStage).catch((err) => {
        console.warn(
          `[handleQualifyingStageCompleted] Falha ao inicializar próxima fase ${nextStage}:`,
          err,
        )
      })
    }

    return true
  }

  // Controles: +1 MIN / +5 MIN (Treino Livre ou Qualificação)
  const handleAdvanceStep = async (minutes: 1 | 5) => {
    const isQuali = isQualifyingStage(selectedSessionId)

    if (isQuali) {
      if (
        qualifyingInitializationError ||
        !qualifyingState ||
        qualifyingState.leaderboard.length === 0
      ) {
        toast({
          variant: 'destructive',
          title: 'Classificação Indisponível',
          description:
            qualifyingInitializationError?.message ||
            'Aguarde a conclusão e validação da fase anterior.',
        })
        return
      }

      let currentQuali = qualifyingState
      if (!currentQuali || currentQuali.stageId !== selectedSessionId) {
        if (season?.id) {
          const storedState = canonicalQualifyingPersistenceService.readStageState(
            season.id,
            currentRound,
            selectedSessionId as QualifyingStageId,
          )
          if (storedState) {
            currentQuali = storedState
            setQualifyingState(storedState)
          } else {
            await initializeQualifyingSession(selectedSessionId as QualifyingStageId)
            const freshState = canonicalQualifyingPersistenceService.readStageState(
              season.id,
              currentRound,
              selectedSessionId as QualifyingStageId,
            )
            if (freshState) {
              currentQuali = freshState
              setQualifyingState(freshState)
            } else {
              return
            }
          }
        }
      }
      if (!currentQuali || !qualifyingTickContext) return

      let activeState = currentQuali

      // Se estivesse em auto-avanço contínuo, para o loop contínuo ao dar passo manual
      if (isAutoAdvancing) {
        setIsAutoAdvancing(false)
      }
      if (activeState.leaderboard.length === 0) {
        const stageId = activeState.stageId
        const parentStage =
          stageId === 'sq2'
            ? 'sq1'
            : stageId === 'sq3'
              ? 'sq2'
              : stageId === 'q2'
                ? 'q1'
                : stageId === 'q3'
                  ? 'q2'
                  : null

        let hasCanonicalPrevious = false
        let isParentIncomplete = false
        let parentIncompleteState = ''
        if (parentStage && season?.id) {
          const pRes = canonicalQualifyingPersistenceService.readStageResult(
            season.id,
            currentRound,
            parentStage as any,
          )
          const pState = canonicalQualifyingPersistenceService.readStageState(
            season.id,
            currentRound,
            parentStage as any,
          )
          if (
            pState &&
            (pState.status === 'paused' || (pState.status === 'running' && !isAutoAdvancing))
          ) {
            isParentIncomplete = true
            parentIncompleteState = pState.status === 'paused' ? 'Pausada' : 'Em Andamento'
          }
          if (
            (pRes && pRes.advancingDriverIds && pRes.advancingDriverIds.length > 0) ||
            (pState && pState.status === 'completed')
          ) {
            hasCanonicalPrevious = true
          }
        }

        if (!hasCanonicalPrevious && stageId !== 'q1' && stageId !== 'sq1') {
          if (isParentIncomplete) {
            toast({
              variant: 'destructive',
              title: `Fase ${parentStage?.toUpperCase()} ${parentIncompleteState || 'Em Andamento'}`,
              description: `A fase anterior (${parentStage?.toUpperCase()}) ainda está em andamento. Retome e conclua a fase anterior primeiro.`,
            })
          } else {
            toast({
              variant: 'destructive',
              title: 'Sessão Sem Participantes',
              description: 'A fase de classificação anterior precisa ser concluída e confirmada.',
            })
          }
          return
        }

        // Reidratação automática
        await initializeQualifyingSession(stageId)
        const reloaded = season?.id
          ? canonicalQualifyingPersistenceService.readStageState(season.id, currentRound, stageId)
          : null
        if (reloaded && reloaded.leaderboard.length > 0) {
          activeState = reloaded
        } else {
          toast({
            variant: 'destructive',
            title: 'Sessão Sem Participantes',
            description: 'A fase de classificação anterior precisa ser concluída e confirmada.',
          })
          return
        }
      }

      // CORREÇÃO 3: a checagem de "Sessão Concluída" deve validar a sessão SELECIONADA (selectedSessionId),
      // não activeState.stageId residual da fase anterior. Se activeState.stageId !== selectedSessionId,
      // concluir a reidratação/inicialização da sessão selecionada antes de avaliar o guard.
      if (activeState.stageId !== selectedSessionId) {
        await initializeQualifyingSession(selectedSessionId as QualifyingStageId)
        const fresh = season?.id
          ? canonicalQualifyingPersistenceService.readStageState(
              season.id,
              currentRound,
              selectedSessionId as QualifyingStageId,
            )
          : null
        if (fresh) {
          activeState = fresh
          setQualifyingState(fresh)
        }
      }

      const stored = refreshCompletedSessions()
      if (
        selectedSessionId === activeState.stageId &&
        (activeState.status === 'completed' || stored.includes(selectedSessionId))
      ) {
        toast({
          variant: 'destructive',
          title: 'Sessão Concluída',
          description: 'Não é permitido executar novamente uma fase oficialmente concluída.',
        })
        return
      }
      setIsAutoAdvancing(false)

      const seconds = minutes * 60
      const res = CanonicalQualifyingRunner.advanceBySeconds(
        activeState,
        seconds,
        qualifyingTickContext,
      )
      setQualifyingState(res.nextState)

      if (season?.id) {
        const refreshed = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
          seasonId: season.id,
          round: currentRound,
          driverIds: [activeState.cars.car1.driverId, activeState.cars.car2.driverId],
        })
        setTyreInventories(refreshed)
      }

      if (res.nextState.status === 'completed') {
        handleQualifyingStageCompleted(res.nextState.stageId)
      }

      toast({
        title: `+${minutes} Minuto(s) de Qualificação Simulado(s)`,
        description: `Executados ${res.secondsSimulated}s reais de sessão (${res.lapsCount} volta(s) completada(s)).`,
      })
      return
    }

    if (!sessionState || !runnerContext) return
    const stored = refreshCompletedSessions()
    if (sessionState.status === 'completed' || stored.includes(sessionState.sessionType)) {
      toast({
        variant: 'destructive',
        title: 'Sessão Concluída',
        description: 'Não é permitido executar novamente uma sessão oficialmente concluída.',
      })
      return
    }
    setIsAutoAdvancing(false)

    const seconds = minutes * 60
    const res: AdvanceStepResult = CanonicalPracticeV2Runner.advanceBySeconds(
      sessionState,
      seconds,
      runnerContext,
    )

    setSessionState(res.nextState)

    // Atualizar pneus na tela
    if (season?.id) {
      const refreshed = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId: season.id,
        round: currentRound,
        driverIds: [sessionState.cars.car1.driverId, sessionState.cars.car2.driverId],
      })
      setTyreInventories(refreshed)
    }

    if (res.interruptedByDecision) {
      toast({
        title: 'Avanço Interrompido por Evento Obrigatório',
        description: res.interruptReason || 'Decisão de box ou feedback necessária.',
      })
    } else {
      toast({
        title: `+${minutes} Minuto(s) Simulado(s)`,
        description: `Executados ${res.secondsSimulated}s reais de sessão (${res.lapsCount} volta(s) completada(s)).`,
      })
    }
  }

  // Controle: SIMULAR RESTANTE (Treino Livre ou Qualificação)
  const handleSimulateRemaining = async () => {
    const isQuali = isQualifyingStage(selectedSessionId)

    if (isQuali) {
      if (
        qualifyingInitializationError ||
        !qualifyingState ||
        qualifyingState.leaderboard.length === 0
      ) {
        toast({
          variant: 'destructive',
          title: 'Classificação Indisponível',
          description:
            qualifyingInitializationError?.message ||
            'Aguarde a conclusão e validação da fase anterior.',
        })
        return
      }

      let currentQuali = qualifyingState
      if (!currentQuali || currentQuali.stageId !== selectedSessionId) {
        if (season?.id) {
          const storedState = canonicalQualifyingPersistenceService.readStageState(
            season.id,
            currentRound,
            selectedSessionId as QualifyingStageId,
          )
          if (storedState) {
            currentQuali = storedState
            setQualifyingState(storedState)
          } else {
            await initializeQualifyingSession(selectedSessionId as QualifyingStageId)
            const freshState = canonicalQualifyingPersistenceService.readStageState(
              season.id,
              currentRound,
              selectedSessionId as QualifyingStageId,
            )
            if (freshState) {
              currentQuali = freshState
              setQualifyingState(freshState)
            } else {
              return
            }
          }
        }
      }
      if (!currentQuali || !qualifyingTickContext) return

      let activeState = currentQuali

      // Se estivesse em auto-avanço contínuo, para o loop contínuo para simular o restante
      if (isAutoAdvancing) {
        setIsAutoAdvancing(false)
      }
      if (activeState.leaderboard.length === 0) {
        const stageId = activeState.stageId
        const parentStage =
          stageId === 'sq2'
            ? 'sq1'
            : stageId === 'sq3'
              ? 'sq2'
              : stageId === 'q2'
                ? 'q1'
                : stageId === 'q3'
                  ? 'q2'
                  : null

        let hasCanonicalPrevious = false
        let isParentIncomplete = false
        let parentIncompleteState = ''
        if (parentStage && season?.id) {
          const pRes = canonicalQualifyingPersistenceService.readStageResult(
            season.id,
            currentRound,
            parentStage as any,
          )
          const pState = canonicalQualifyingPersistenceService.readStageState(
            season.id,
            currentRound,
            parentStage as any,
          )
          if (
            pState &&
            (pState.status === 'paused' || (pState.status === 'running' && !isAutoAdvancing))
          ) {
            isParentIncomplete = true
            parentIncompleteState = pState.status === 'paused' ? 'Pausada' : 'Em Andamento'
          }
          if (
            (pRes && pRes.advancingDriverIds && pRes.advancingDriverIds.length > 0) ||
            (pState && pState.status === 'completed')
          ) {
            hasCanonicalPrevious = true
          }
        }

        if (!hasCanonicalPrevious && stageId !== 'q1' && stageId !== 'sq1') {
          if (isParentIncomplete) {
            toast({
              variant: 'destructive',
              title: `Fase ${parentStage?.toUpperCase()} ${parentIncompleteState || 'Em Andamento'}`,
              description: `A fase anterior (${parentStage?.toUpperCase()}) ainda está em andamento. Retome e conclua a fase anterior primeiro.`,
            })
          } else {
            toast({
              variant: 'destructive',
              title: 'Sessão Sem Participantes',
              description: 'A fase de classificação anterior precisa ser concluída e confirmada.',
            })
          }
          return
        }

        // Reidratação automática
        await initializeQualifyingSession(stageId)
        const reloaded = season?.id
          ? canonicalQualifyingPersistenceService.readStageState(season.id, currentRound, stageId)
          : null
        if (reloaded && reloaded.leaderboard.length > 0) {
          activeState = reloaded
        } else {
          toast({
            variant: 'destructive',
            title: 'Sessão Sem Participantes',
            description: 'A fase de classificação anterior precisa ser concluída e confirmada.',
          })
          return
        }
      }

      // CORREÇÃO 3: a checagem de "Sessão Concluída" deve validar a sessão SELECIONADA (selectedSessionId),
      // não activeState.stageId residual da fase anterior. Se activeState.stageId !== selectedSessionId,
      // concluir a reidratação/inicialização da sessão selecionada antes de avaliar o guard.
      if (activeState.stageId !== selectedSessionId) {
        await initializeQualifyingSession(selectedSessionId as QualifyingStageId)
        const fresh = season?.id
          ? canonicalQualifyingPersistenceService.readStageState(
              season.id,
              currentRound,
              selectedSessionId as QualifyingStageId,
            )
          : null
        if (fresh) {
          activeState = fresh
          setQualifyingState(fresh)
        }
      }

      const stored = refreshCompletedSessions()
      if (
        selectedSessionId === activeState.stageId &&
        (activeState.status === 'completed' || stored.includes(selectedSessionId))
      ) {
        toast({
          variant: 'destructive',
          title: 'Sessão Concluída',
          description: 'Não é permitido executar novamente uma fase oficialmente concluída.',
        })
        return
      }
      setIsAutoAdvancing(false)

      const res = CanonicalQualifyingRunner.simulateRemainingSession(
        activeState,
        qualifyingTickContext,
      )
      setQualifyingState(res.nextState)

      if (season?.id) {
        const refreshed = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
          seasonId: season.id,
          round: currentRound,
          driverIds: [activeState.cars.car1.driverId, activeState.cars.car2.driverId],
        })
        setTyreInventories(refreshed)
      }

      handleQualifyingStageCompleted(res.nextState.stageId)

      toast({
        title: `Restante do ${activeState.stageId.toUpperCase()} Simulado com Sucesso!`,
        description: `Foram computadas todas as tentativas, voltas e desempates da fase de classificação.`,
      })
      return
    }

    if (!sessionState || !runnerContext) return
    const stored = refreshCompletedSessions()
    if (sessionState.status === 'completed' || stored.includes(sessionState.sessionType)) {
      toast({
        variant: 'destructive',
        title: 'Sessão Concluída',
        description: 'Não é permitido executar novamente uma sessão oficialmente concluída.',
      })
      return
    }
    setIsAutoAdvancing(false)

    const res: AdvanceStepResult = CanonicalPracticeV2Runner.simulateRemainingSession(
      sessionState,
      runnerContext,
    )

    setSessionState(res.nextState)

    // Atualizar pneus
    if (season?.id) {
      const refreshed = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId: season.id,
        round: currentRound,
        driverIds: [sessionState.cars.car1.driverId, sessionState.cars.car2.driverId],
      })
      setTyreInventories(refreshed)
    }

    // Atualizar sessões concluídas e homologar créditos de novato no TL1
    if (season?.id && res.nextState.status === 'completed') {
      const currentStored = readStoredCompletedSessions(season.id, currentRound)
      if (!currentStored.includes(res.nextState.sessionType)) {
        const updated = [...currentStored, res.nextState.sessionType]
        writeStoredCompletedSessions(season.id, currentRound, updated)
        setCompletedSessions(updated)
      }

      // Sincronização Canônica de Acerto no SimulateRemaining (RACE-TL-01B)
      const activeCareerConfigVersion =
        (career as any)?.config_version || (season as any)?.config_version
      if (
        team?.id &&
        activeCareerConfigVersion &&
        (res.nextState.sessionType === 'tp1' ||
          res.nextState.sessionType === 'tp2' ||
          res.nextState.sessionType === 'tp3')
      ) {
        try {
          const c1 = res.nextState.cars.car1
          const c2 = res.nextState.cars.car2
          const isSprintRound = hasSprintWeekend(currentRound)

          if (c1 && c1.totalLaps > 0) {
            CanonicalPracticeIntegrationAdapter.persistSessionCarSetup({
              careerId: career?.id || season.id,
              seasonId: season.id,
              round: currentRound,
              sessionType: res.nextState.sessionType,
              teamId: team.id,
              carIndex: 1,
              driverId: c1.driverId,
              configVersion: activeCareerConfigVersion,
              completedLaps: c1.totalLaps,
              consistency: 85,
              isSprint: isSprintRound,
            }).catch((err) =>
              console.warn('[WeekendV2Page] Erro ao sincronizar acerto C1 simulateRemaining:', err),
            )
          }

          if (c2 && c2.totalLaps > 0) {
            CanonicalPracticeIntegrationAdapter.persistSessionCarSetup({
              careerId: career?.id || season.id,
              seasonId: season.id,
              round: currentRound,
              sessionType: res.nextState.sessionType,
              teamId: team.id,
              carIndex: 2,
              driverId: c2.driverId,
              configVersion: activeCareerConfigVersion,
              completedLaps: c2.totalLaps,
              consistency: 85,
              isSprint: isSprintRound,
            }).catch((err) =>
              console.warn('[WeekendV2Page] Erro ao sincronizar acerto C2 simulateRemaining:', err),
            )
          }
        } catch (e) {
          console.warn(
            '[WeekendV2Page] Falha na integração de acerto canônico simulateRemaining:',
            e,
          )
        }
      }

      if (res.nextState.sessionType === 'tp1' && team?.id) {
        const c1 = res.nextState.cars.car1
        const c2 = res.nextState.cars.car2

        if (activeRookieCar1 && c1.totalLaps >= 1) {
          RookiePracticeRequirementService.grantRookieFP1Credit({
            seasonId: season.id,
            round: currentRound,
            teamId: team.id,
            carId: 'car1',
            driverId: activeRookieCar1.rookieDriverId,
            driverName: activeRookieCar1.rookieDriverName,
            lapsCompleted: c1.totalLaps,
            isRookieEligible: true,
          })
        }

        if (activeRookieCar2 && c2.totalLaps >= 1) {
          RookiePracticeRequirementService.grantRookieFP1Credit({
            seasonId: season.id,
            round: currentRound,
            teamId: team.id,
            carId: 'car2',
            driverId: activeRookieCar2.rookieDriverId,
            driverName: activeRookieCar2.rookieDriverName,
            lapsCompleted: c2.totalLaps,
            isRookieEligible: true,
          })
        }

        // Homologação real das equipes rivais ao simular o restante do TL1
        try {
          const rivalEntries = registration?.snapshot?.entries?.filter((e) => !e.isPlayerTeam) || []
          const rivalsMap = new Map<string, any>()
          rivalEntries.forEach((r, idx) => {
            const rTeamId = r.teamId || `rival_${idx}`
            if (!rivalsMap.has(rTeamId)) {
              rivalsMap.set(rTeamId, {
                id: rTeamId,
                name: r.teamName || `Equipe ${idx + 1}`,
                team_key: (r as any).teamKey || rTeamId,
              })
            }
          })
          const rivalTeamsList = Array.from(rivalsMap.values())
          RookiePracticeRequirementService.simulateRivalAICreditsForRound(
            season.id,
            currentRound,
            rivalTeamsList,
            allDriversCatalog,
            res.nextState.leaderboard,
          )
        } catch (e) {
          console.warn(
            '[WeekendV2Page] Erro ao homologar créditos TL1 dos rivais (simulateRemaining):',
            e,
          )
        }
      }
    }

    const targetTypeUpper = res.nextState.sessionType.toUpperCase()
    toast({
      title: `Restante do ${targetTypeUpper} Simulado com Sucesso!`,
      description: `Foram computadas todas as voltas, desgaste e aprendizados de setup da sessão.`,
    })
  }

  // Ações de Carro: Sair para a pista (Treino ou Qualificação)
  const handleOrderExit = (carId: 'car1' | 'car2') => {
    const isQuali = isQualifyingStage(selectedSessionId)

    if (isQuali) {
      if (!qualifyingState) return
      const res = CanonicalQualifyingRunner.orderCarExitToTrack(qualifyingState, carId)
      if (res.success) {
        if (season?.id) {
          canonicalQualifyingPersistenceService.saveStageState(
            season.id,
            currentRound,
            qualifyingState,
          )
        }
        setQualifyingState({ ...qualifyingState })
        toast({
          title: 'Carro Liberado para a Pista',
          description: `${qualifyingState.cars[carId].driverName} saiu em volta de preparação para tentativa rápida.`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Não é possível sair',
          description: res.error,
        })
      }
      return
    }

    if (!sessionState) return
    const res = PracticeSessionRunner.orderCarExitToTrack(sessionState, carId)
    if (res.success) {
      practiceSessionService.saveSessionState(sessionState)
      setSessionState({ ...sessionState })
    } else {
      toast({
        variant: 'destructive',
        title: 'Não é possível sair',
        description: res.error,
      })
    }
  }

  // Ações de Carro: Chamar aos boxes (Treino ou Qualificação)
  const handleRequestBox = (carId: 'car1' | 'car2') => {
    const isQuali = isQualifyingStage(selectedSessionId)

    if (isQuali) {
      if (!qualifyingState) return
      const res = CanonicalQualifyingRunner.requestCarBox(qualifyingState, carId)
      if (res.success) {
        if (season?.id) {
          canonicalQualifyingPersistenceService.saveStageState(
            season.id,
            currentRound,
            qualifyingState,
          )
        }
        setQualifyingState({ ...qualifyingState })
        toast({
          title: 'Chamada de Box Confirmada',
          description:
            'O piloto retornará à garagem ao final da volta para ajustes e nova tentativa.',
        })
      }
      return
    }

    if (!sessionState) return
    const res = PracticeSessionRunner.requestCarBox(sessionState, carId)
    if (res.success) {
      practiceSessionService.saveSessionState(sessionState)
      setSessionState({ ...sessionState })
      toast({
        title: 'Chamada de Box Confirmada',
        description: 'O piloto entrará na garagem ao final desta volta.',
      })
    }
  }

  // Reacerto de Carro na garagem (Treino ou Qualificação)
  const handleApplyCarSetup = (carId: 'car1' | 'car2', newSetup: PracticeCarLiveState['setup']) => {
    const isQuali = isQualifyingStage(selectedSessionId)

    if (isQuali) {
      if (!qualifyingState) return
      const isPFActive = canonicalQualifyingPersistenceService.isParcFermeActive(
        season?.id || 'default',
        currentRound,
      )
      const res = CanonicalQualifyingRunner.updateCarGarageSetup(qualifyingState, carId, newSetup, {
        parcFermeActive: isPFActive,
      })
      if (res.success) {
        if (season?.id) {
          canonicalQualifyingPersistenceService.saveStageState(
            season.id,
            currentRound,
            qualifyingState,
          )
        }
        setQualifyingState({ ...qualifyingState })
        toast({
          title: 'Acerto Atualizado com Sucesso!',
          description: `Novo setup aplicado no ${carId === 'car1' ? 'Carro 1' : 'Carro 2'}.`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Não é possível reacertar',
          description:
            res.error || 'Ajuste bloqueado por regime de Parc Fermé ou carro fora da garagem.',
        })
      }
      return
    }

    if (!sessionState) return
    const ok = PracticeSessionRunner.updateCarGarageSetup(sessionState, carId, newSetup)
    if (ok) {
      practiceSessionService.saveSessionState(sessionState)
      setSessionState({ ...sessionState })
      toast({
        title: 'Acerto Atualizado com Sucesso!',
        description: `Novo setup aplicado no ${carId === 'car1' ? 'Carro 1' : 'Carro 2'}.`,
      })
    } else {
      toast({
        variant: 'destructive',
        title: 'Não é possível reacertar',
        description: 'O carro precisa estar parado na garagem para ajustes mecânicos.',
      })
    }
  }

  // Reabastecimento na garagem durante treino livre ou qualificação
  const handleUpdateFuelInPractice = (carId: 'car1' | 'car2', kg: number) => {
    const isQuali = isQualifyingStage(selectedSessionId)

    if (isQuali) {
      if (!qualifyingState) return
      const ok = CanonicalQualifyingRunner.refuelCarInGarage(qualifyingState, carId, kg)
      if (ok) {
        if (season?.id) {
          canonicalQualifyingPersistenceService.saveStageState(
            season.id,
            currentRound,
            qualifyingState,
          )
        }
        setQualifyingState({ ...qualifyingState })
      }
      return
    }

    if (!sessionState) return
    const ok = PracticeSessionRunner.refuelCarInGarage(sessionState, carId, kg)
    if (ok) {
      practiceSessionService.saveSessionState(sessionState)
      setSessionState({ ...sessionState })
    }
  }

  // Troca de Pneus na Garagem (Treino ou Qualificação)
  const handleSelectTyreSet = (carId: 'car1' | 'car2', tyreSetId: string) => {
    const isQuali = isQualifyingStage(selectedSessionId)

    const targetCar = isQuali ? qualifyingState?.cars[carId] : sessionState?.cars[carId]
    if (!targetCar) return

    if (targetCar.status !== 'garage') {
      toast({
        variant: 'destructive',
        title: 'Carro em pista',
        description: 'Troca de pneus só permitida com o carro na garagem.',
      })
      return
    }

    const driverInventory = tyreInventories[targetCar.driverId] || []
    const selectedSet = driverInventory.find((s) => s.id === tyreSetId)
    if (!selectedSet) return

    if (isQuali && qualifyingState) {
      CanonicalQualifyingRunner.fitTyreSetInGarage(qualifyingState, carId, {
        id: selectedSet.id,
        compound: selectedSet.compound,
        wear: selectedSet.wear || 0,
      })
    } else if (sessionState) {
      PracticeSessionRunner.fitTyreSetInGarage(sessionState, carId, {
        id: selectedSet.id,
        compound: selectedSet.compound,
        wear: selectedSet.wear || 0,
      })
    }

    const updatedInventory: TireSetItem[] = driverInventory.map((s) => ({
      ...s,
      isFitted: s.id === tyreSetId,
      status:
        s.id === tyreSetId
          ? ('instalado' as const)
          : (s.wear || 0) > 0
            ? ('usado' as const)
            : ('disponivel' as const),
    }))

    if (season?.id) {
      canonicalWeekendTyrePersistence.updateDriverInventory(
        season.id,
        currentRound,
        targetCar.driverId,
        updatedInventory,
      )
      setTyreInventories((prev) => ({
        ...prev,
        [targetCar.driverId]: updatedInventory,
      }))
    }

    if (isQuali && qualifyingState) {
      if (season?.id) {
        canonicalQualifyingPersistenceService.saveStageState(
          season.id,
          currentRound,
          qualifyingState,
        )
      }
      setQualifyingState({ ...qualifyingState })
    } else if (sessionState) {
      practiceSessionService.saveSessionState(sessionState)
      setSessionState({ ...sessionState })
    }

    toast({
      title: 'Jogo de Pneus Instalado',
      description: `Carro #${carId === 'car1' ? 1 : 2} equipado com ${selectedSet.compound.toUpperCase()} (${selectedSet.wear || 0}% desgaste).`,
    })
  }

  // Formatação de cronômetro
  const formatSessionTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  if (isAuthLoading || isInitializingRegistration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-[#E10600] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-[#64748B]">Carregando módulo oficial de Corrida...</p>
      </div>
    )
  }

  // Callback de confirmação formal da inscrição pelo jogador
  const handleConfirmGPRegistration = (car1DriverId: string, car2DriverId: string) => {
    if (!team || !season) return
    setIsSubmittingRegistration(true)

    try {
      const reg = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
        seasonId: season.id,
        round: currentRound,
        gpName: gpInfo.name,
        playerTeam: team,
        allDrivers: playerDrivers,
        playerSeatOverrides: {
          car1DriverId,
          car2DriverId,
        },
        forceRecalculate: true,
      })

      if (!reg.valid) {
        setRegistrationErrors(reg.errors)
        setIsSubmittingRegistration(false)
        return
      }

      setRegistration(reg)
      setRegistrationErrors([])
      setShowRegistrationScreen(false)
      setIsSubmittingRegistration(false)

      // Carregar inventário e inicializar sessão
      const pCar1 = reg.snapshot?.entriesByCar.playerCar1
      const pCar2 = reg.snapshot?.entriesByCar.playerCar2
      const driverIds = [pCar1?.driverId, pCar2?.driverId].filter(Boolean) as string[]

      const invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId: season.id,
        round: currentRound,
        driverIds,
        primaryDriverIds: driverIds,
      })
      setTyreInventories(invs)

      const stored = readStoredCompletedSessions(season.id, currentRound)
      setCompletedSessions(stored)

      const initialSessionId = resolveInitialRaceSession({
        pipeline,
        completedSessions: stored,
      })
      setSelectedSessionId(initialSessionId)

      if (initialSessionId === 'tp1' || initialSessionId === 'tp2' || initialSessionId === 'tp3') {
        initializePracticeSession(initialSessionId, reg, invs)
      } else if (
        initialSessionId === 'q1' ||
        initialSessionId === 'q2' ||
        initialSessionId === 'q3' ||
        initialSessionId === 'sq1' ||
        initialSessionId === 'sq2' ||
        initialSessionId === 'sq3'
      ) {
        initializeQualifyingSession(initialSessionId as QualifyingStageId, reg, invs)
      }

      toast({
        title: 'Inscrição Confirmada',
        description: `Pilotos oficialmente homologados pela FIA para o ${gpInfo.name}.`,
      })
    } catch (err: any) {
      setRegistrationErrors([err?.message || 'Falha ao processar inscrição formal do GP.'])
      setIsSubmittingRegistration(false)
    }
  }

  // Se a tela formal de inscrição do GP estiver ativa
  if (showRegistrationScreen && team && season) {
    return (
      <div className="space-y-6 pb-12">
        <PageHeader
          title="INSCRIÇÃO OFICIAL DO GP"
          description={`Homologação formal de pilotos FIA para a Rodada ${currentRound} de 24 — ${gpInfo.name}`}
        />
        <GPRegistrationScreen
          round={currentRound}
          totalRounds={24}
          gpName={gpInfo.name}
          circuitName={gpInfo.circuit}
          team={team}
          allDrivers={playerDrivers}
          onConfirmRegistration={handleConfirmGPRegistration}
          onCancel={() => setShowRegistrationScreen(false)}
          isSubmitting={isSubmittingRegistration}
        />
      </div>
    )
  }

  if (registrationErrors.length > 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3">
          <div className="flex items-center gap-2 font-black text-sm text-[#0F172A]">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            PENDÊNCIA DE INSCRIÇÃO FORMAL FIA
          </div>
          <p className="text-xs text-[#475569]">
            A inscrição dos pilotos da equipe para este Grande Prêmio precisa de resolução ou
            seleção de substituto elegível:
          </p>
          <ul className="list-disc pl-5 text-xs space-y-1 font-semibold text-rose-700">
            {registrationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => {
              setRegistrationErrors([])
              setShowRegistrationScreen(true)
            }}
            className="text-xs font-black bg-[#E10600] hover:bg-[#C00400] text-white gap-2 shadow-xs"
          >
            <UserCheck className="w-4 h-4" />
            SELECIONAR PILOTOS PARA O GP
          </Button>
          <Button
            asChild
            variant="outline"
            className="text-xs font-bold border-[#CBD5E1] text-[#0F172A]"
          >
            <Link to="/corrida">Voltar ao painel anterior</Link>
          </Button>
        </div>
      </div>
    )
  }

  const pCar1 = registration?.snapshot?.entriesByCar.playerCar1
  const pCar2 = registration?.snapshot?.entriesByCar.playerCar2
  const activeCarForTyres = activeTyresCarId === 'car1' ? pCar1 : pCar2
  const activeTyresList = activeCarForTyres ? tyreInventories[activeCarForTyres.driverId] || [] : []

  // Sessão atual selecionada na esteira
  const selectedSessionDef =
    pipeline.find((s) => s.id === selectedSessionId) ||
    CANONICAL_SESSION_DEFINITIONS[selectedSessionId] ||
    pipeline[0]

  const isPlayablePracticeSession =
    selectedSessionDef.id === 'tp1' ||
    selectedSessionDef.id === 'tp2' ||
    selectedSessionDef.id === 'tp3'

  const isQualifyingSession = isQualifyingStage(selectedSessionDef.id)

  const isSprintRaceSession = selectedSessionDef.id === 'sprint_race'

  const isRaceSession = selectedSessionDef.id === 'race' || isSprintRaceSession

  return (
    <div className="space-y-6 pb-12">
      {/* 1. CABEÇALHO PADRÃO APEX GP MANAGER */}
      <PageHeader
        title="CORRIDA"
        description="Gestão completa do fim de semana de Grande Prêmio: treinos, classificação e corrida."
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold border-[#CBD5E1] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#64748B]" />
                Reiniciar fim de semana
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Reiniciar fim de semana da Rodada {currentRound}?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2 text-xs">
                  <span className="block">
                    Todas as fases da rodada atual ({gpInfo.name}) — treinos livres, sessões de
                    qualificação (SQ1/SQ2/SQ3 ou Q1/Q2/Q3), corrida Sprint e corrida principal —
                    voltarão ao status <strong>Pendente</strong>.
                  </span>
                  <span className="block text-[#475569]">
                    Pontos do campeonato, moral de pilotos, finanças, contratos, desenvolvimento do
                    carro e histórico de rodadas anteriores ficam{' '}
                    <strong>completamente intactos</strong>.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetCurrentWeekend}
                  className="bg-[#E10600] hover:bg-[#C00400] text-white font-bold"
                >
                  Confirmar Reinício
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      {/* 2. HERO COMPACTO DO GP ATUAL */}
      <RaceHeroCompact
        round={currentRound}
        totalRounds={24}
        gpName={gpInfo.name}
        circuitName={gpInfo.circuit}
        country={gpInfo.country}
        circuitProfile={circuitProfile}
        isSprint={isSprint}
        dateRange={
          circuitProfile ? `${circuitProfile.startDate} — ${circuitProfile.endDate}` : undefined
        }
        currentCondition="Pista Seca / 28°C"
        weatherForecast="Estável (Risco de chuva < 15%)"
        laps={gpInfo.laps || 53}
        circuitLengthKm={gpInfo.circuitLengthKm || 5.8}
      />

      {/* 3. CONTEXTO DOS DOIS CARROS INSCRITOS */}
      {pCar1 && pCar2 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-bold text-[#64748B] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Users2 className="w-4 h-4 text-[#E10600]" />
              Pilotos Inscritos ({team?.name}):
            </span>
            <div className="flex items-center gap-2">
              <Badge className="bg-[#0F172A] text-white hover:bg-[#0F172A] text-[10px] font-black">
                CARRO 1
              </Badge>
              <strong className="text-[#0F172A]">{pCar1.driverName}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-[#0F172A] text-white hover:bg-[#0F172A] text-[10px] font-black">
                CARRO 2
              </Badge>
              <strong className="text-[#0F172A]">{pCar2.driverName}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[#64748B]">
            <ShieldCheck className="w-4 h-4 text-[#059669]" />
            <span>
              Inventário FIA Compartilhado: <strong>20 jogos/piloto</strong>
            </span>
          </div>
        </div>
      )}

      {/* 4. ESTEIRA PRINCIPAL DO FIM DE SEMANA */}
      {(() => {
        // Coleta os status canônicos das sessões para alimentar a esteira visual
        const sessionStatuses: Record<string, 'not_started' | 'running' | 'paused' | 'completed'> =
          {}
        if (season?.id) {
          const qualiStages = ['sq1', 'sq2', 'sq3', 'q1', 'q2', 'q3'] as const
          for (const stg of qualiStages) {
            const stgRes = canonicalQualifyingPersistenceService.readStageResult(
              season.id,
              currentRound,
              stg,
            )
            const stgState = canonicalQualifyingPersistenceService.readStageState(
              season.id,
              currentRound,
              stg,
            )
            if (stgRes && stgRes.advancingDriverIds && stgRes.advancingDriverIds.length > 0) {
              sessionStatuses[stg] = 'completed'
            } else if (stgState) {
              sessionStatuses[stg] = stgState.status
            }
          }

          // Se a sessão selecionada estiver em memória, ela é a fonte mais viva
          if (isQualifyingSession && qualifyingState) {
            if (qualifyingState.status === 'completed') {
              sessionStatuses[qualifyingState.stageId] = 'completed'
            } else if (qualifyingState.status === 'running') {
              sessionStatuses[qualifyingState.stageId] = 'running'
            } else if (qualifyingState.status === 'paused') {
              sessionStatuses[qualifyingState.stageId] = 'paused'
            }
          }
        }

        return (
          <RaceWeekendPipelineBar
            sessions={pipeline}
            selectedSessionId={selectedSessionId}
            completedSessions={completedSessions}
            sessionStatuses={sessionStatuses}
            isSessionRunning={isAutoAdvancing}
            isSessionPaused={
              isQualifyingSession
                ? qualifyingState?.status === 'paused'
                : sessionState?.status === 'paused'
            }
            onSelectSession={handleSelectSessionFromSchedule}
          />
        )
      })()}

      {/* 5. ÁREA DE CONTEÚDO ÚNICA: RENDERIZA SOMENTE A SESSÃO SELECIONADA */}
      {isPlayablePracticeSession ? (
        // RENDERIZAÇÃO DE TL1 / TL2 / TL3
        sessionState ? (
          <div className="space-y-6">
            {/* BLOCO REGULAMENTAR DE OBRIGAÇÃO DE NOVATOS (TL1) */}
            {selectedSessionId === 'tp1' && season?.id && team?.id && (
              <RookieFP1ManagementCard
                seasonId={season.id}
                round={currentRound}
                teamId={team.id}
                teamDrivers={playerDrivers}
                allDriversCatalog={allDriversCatalog}
                activeAssignmentCar1={activeRookieCar1}
                activeAssignmentCar2={activeRookieCar2}
                onAssignRookie={handleAssignRookie}
                onClearAssignment={handleClearRookieAssignment}
                isSessionRunning={sessionState.status === 'running' || isAutoAdvancing}
                isSessionCompleted={sessionState.status === 'completed'}
              />
            )}
            {/* CONTROLES OPERACIONAIS DO TREINO LIVRE */}
            <Card className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#F1F5F9] pb-3">
                {/* Relógio da sessão */}
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#E10600]/10 border border-[#E10600]/20 text-[#E10600]">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                      Tempo Restante — {sessionState.sessionType.toUpperCase()}
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight flex items-center gap-2">
                      <span>{formatSessionTime(sessionState.timeRemainingSec)} RESTANTES</span>
                      <span className="text-xs text-[#94A3B8] font-medium">
                        / {formatSessionTime(sessionState.sessionDurationSec)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controles de Play/Pause, Velocidades, +1m, +5m, Simular Restante */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={sessionState.status === 'completed'}
                    onClick={handleTogglePlay}
                    className={`h-9 px-4 text-xs font-black gap-2 shadow-xs ${
                      isAutoAdvancing
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-[#E10600] hover:bg-[#C00400] text-white'
                    }`}
                  >
                    {isAutoAdvancing ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        PAUSAR
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        PLAY
                      </>
                    )}
                  </Button>

                  {/* Multiplicadores 1x, 2x, 4x */}
                  <div className="flex items-center bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg p-0.5">
                    {([1, 2, 4] as const).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setSelectedSpeed(spd)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                          selectedSpeed === spd
                            ? 'bg-white text-[#0F172A] shadow-xs font-black'
                            : 'text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* +1 MIN */}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sessionState.status === 'completed'}
                    onClick={() => handleAdvanceStep(1)}
                    className="h-9 px-3 text-xs font-bold border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    +1 MIN
                  </Button>

                  {/* +5 MIN */}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sessionState.status === 'completed'}
                    onClick={() => handleAdvanceStep(5)}
                    className="h-9 px-3 text-xs font-bold border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    +5 MIN
                  </Button>

                  {/* SIMULAR RESTANTE */}
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={sessionState.status === 'completed'}
                    onClick={handleSimulateRemaining}
                    className="h-9 px-3.5 text-xs font-black bg-[#E10600] hover:bg-[#C00400] text-white shadow-xs gap-1.5"
                  >
                    <FastForward className="w-4 h-4" />
                    SIMULAR RESTANTE ({sessionState.sessionType.toUpperCase()})
                  </Button>
                </div>
              </div>

              {/* Ações de Reacerto na Garagem */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[#334155]">Reacerto na Garagem:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSetupModalCarId('car1')}
                    className="h-7 text-[11px] font-bold border-[#CBD5E1] text-[#0F172A] hover:bg-slate-50 gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5 text-[#E10600]" />
                    Carro 1 ({pCar1?.driverName})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSetupModalCarId('car2')}
                    className="h-7 text-[11px] font-bold border-[#CBD5E1] text-[#0F172A] hover:bg-slate-50 gap-1.5"
                  >
                    <Wrench className="w-3.5 h-3.5 text-[#E10600]" />
                    Carro 2 ({pCar2?.driverName})
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#64748B]">Estoque de Pneus:</span>
                  <button
                    type="button"
                    onClick={() => setActiveTyresCarId('car1')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      activeTyresCarId === 'car1'
                        ? 'bg-[#E10600] text-white'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    Carro 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTyresCarId('car2')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      activeTyresCarId === 'car2'
                        ? 'bg-[#E10600] text-white'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    Carro 2
                  </button>
                </div>
              </div>
            </Card>

            {/* CARDS DOS DOIS CARROS (CARRO 1 E CARRO 2) — SessionCarPreparationPanel INDEPENDENTES */}
            {pCar1 && pCar2 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SessionCarPreparationPanel
                  sessionType="practice"
                  car={{
                    carId: 'car1',
                    carNumber: 1,
                    driverId: sessionState.cars.car1.driverId,
                    driverName: sessionState.cars.car1.driverName,
                    isRookie: selectedSessionId === 'tp1' && !!activeRookieCar1,
                    originalDriverName: pCar1.driverName,
                    status: sessionState.cars.car1.status,
                    fuelKg: sessionState.cars.car1.fuelKg,
                    currentCompound: sessionState.cars.car1.currentCompound,
                    currentTyreSetId: sessionState.cars.car1.currentTyreSetId,
                    tyreWear: sessionState.cars.car1.tyreWear,
                    setup: sessionState.cars.car1.setup,
                    bestLapTime: sessionState.cars.car1.bestLapTime,
                    bestLapSec: sessionState.cars.car1.bestLapSec,
                    lastLapTime: sessionState.cars.car1.lastLapTime,
                    totalLaps: sessionState.cars.car1.totalLaps,
                    lapsInStint: sessionState.cars.car1.lapsInStint,
                    currentLapProgressPct: sessionState.cars.car1.currentLapProgressPct,
                    pitRequested: sessionState.cars.car1.pitRequested,
                  }}
                  teamColor={team?.color || '#E10600'}
                  parcFermeActive={false}
                  inventory={tyreInventories[pCar1.driverId] || []}
                  knowledge={sessionState.knowledge}
                  latestFeedback={
                    sessionState.feedbacks?.filter((f) => f.carId === 'car1').slice(-1)[0]
                  }
                  hasUnreadFeedback={sessionState.unreadFeedbackCarIds?.includes('car1')}
                  isSessionRunning={sessionState.status === 'running' || isAutoAdvancing}
                  isSessionCompleted={sessionState.status === 'completed'}
                  careerId={team?.id || 'default'}
                  seasonId={season?.id || 'default'}
                  round={currentRound}
                  onOrderExitTrack={() => handleOrderExit('car1')}
                  onRequestBox={() => handleRequestBox('car1')}
                  onUpdateSetup={(newSetup) => handleApplyCarSetup('car1', newSetup)}
                  onUpdateFuel={(kg) => handleUpdateFuelInPractice('car1', kg)}
                  onSelectTyreSet={(tyreSetId) => handleSelectTyreSet('car1', tyreSetId)}
                  onMarkFeedbackRead={() => {
                    sessionState.unreadFeedbackCarIds = (
                      sessionState.unreadFeedbackCarIds || []
                    ).filter((id) => id !== 'car1')
                    setSessionState({ ...sessionState })
                  }}
                  canToggleRookie={selectedSessionId === 'tp1'}
                  onOpenRookieSelector={() => setRookieSelectorModalCarId('car1')}
                  onRestoreTitular={() => handleClearRookieAssignment('car1')}
                />

                <SessionCarPreparationPanel
                  sessionType="practice"
                  car={{
                    carId: 'car2',
                    carNumber: 2,
                    driverId: sessionState.cars.car2.driverId,
                    driverName: sessionState.cars.car2.driverName,
                    isRookie: selectedSessionId === 'tp1' && !!activeRookieCar2,
                    originalDriverName: pCar2.driverName,
                    status: sessionState.cars.car2.status,
                    fuelKg: sessionState.cars.car2.fuelKg,
                    currentCompound: sessionState.cars.car2.currentCompound,
                    currentTyreSetId: sessionState.cars.car2.currentTyreSetId,
                    tyreWear: sessionState.cars.car2.tyreWear,
                    setup: sessionState.cars.car2.setup,
                    bestLapTime: sessionState.cars.car2.bestLapTime,
                    bestLapSec: sessionState.cars.car2.bestLapSec,
                    lastLapTime: sessionState.cars.car2.lastLapTime,
                    totalLaps: sessionState.cars.car2.totalLaps,
                    lapsInStint: sessionState.cars.car2.lapsInStint,
                    currentLapProgressPct: sessionState.cars.car2.currentLapProgressPct,
                    pitRequested: sessionState.cars.car2.pitRequested,
                  }}
                  teamColor={team?.color || '#E10600'}
                  parcFermeActive={false}
                  inventory={tyreInventories[pCar2.driverId] || []}
                  knowledge={sessionState.knowledge}
                  latestFeedback={
                    sessionState.feedbacks?.filter((f) => f.carId === 'car2').slice(-1)[0]
                  }
                  hasUnreadFeedback={sessionState.unreadFeedbackCarIds?.includes('car2')}
                  isSessionRunning={sessionState.status === 'running' || isAutoAdvancing}
                  isSessionCompleted={sessionState.status === 'completed'}
                  careerId={team?.id || 'default'}
                  seasonId={season?.id || 'default'}
                  round={currentRound}
                  onOrderExitTrack={() => handleOrderExit('car2')}
                  onRequestBox={() => handleRequestBox('car2')}
                  onUpdateSetup={(newSetup) => handleApplyCarSetup('car2', newSetup)}
                  onUpdateFuel={(kg) => handleUpdateFuelInPractice('car2', kg)}
                  onSelectTyreSet={(tyreSetId) => handleSelectTyreSet('car2', tyreSetId)}
                  onMarkFeedbackRead={() => {
                    sessionState.unreadFeedbackCarIds = (
                      sessionState.unreadFeedbackCarIds || []
                    ).filter((id) => id !== 'car2')
                    setSessionState({ ...sessionState })
                  }}
                  canToggleRookie={selectedSessionId === 'tp1'}
                  onOpenRookieSelector={() => setRookieSelectorModalCarId('car2')}
                  onRestoreTitular={() => handleClearRookieAssignment('car2')}
                />
              </div>
            )}

            {/* TABELA DE TEMPOS OFICIAL DO TREINO LIVRE */}
            <PracticeLeaderboardTable
              entries={sessionState.leaderboard}
              playerTeamName={team?.name}
              playerTeamColor={team?.color}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[30vh] space-y-3">
            <div className="w-8 h-8 border-4 border-[#E10600] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-[#64748B]">Carregando sessão...</p>
          </div>
        )
      ) : isQualifyingSession ? (
        // RENDERIZAÇÃO CANÔNICA DE QUALIFICAÇÃO (Q1, Q2, Q3 e SQ1, SQ2, SQ3)
        // Sessão real com carros na pista, consumo de pneus, desempate e eliminação
        resolveSessionVisualState({
          sessionId: selectedSessionDef.id,
          activeSessionId: selectedSessionId,
          completedSessions,
        }) === 'locked' ? (
          <SessionPlaceholderCard
            session={selectedSessionDef}
            isLocked={true}
            isPendingDevelopment={false}
            gpName={gpInfo.name}
            circuitName={gpInfo.circuit}
            statusVariant="locked"
          />
        ) : qualifyingState ? (
          <div className="space-y-6">
            {/* CONTROLES OPERACIONAIS DA QUALIFICAÇÃO */}
            <Card className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#F1F5F9] pb-3">
                {/* Relógio regressivo oficial da fase */}
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-[#E10600]/10 border border-[#E10600]/20 text-[#E10600]">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                      Cronômetro Oficial — {qualifyingState.stageId.toUpperCase()} (
                      {CANONICAL_QUALIFYING_RULES[qualifyingState.stageId].durationSec / 60}m)
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight flex items-center gap-2">
                      <span>{formatSessionTime(qualifyingState.timeRemainingSec)} RESTANTES</span>
                      <span className="text-xs text-[#94A3B8] font-medium">
                        / {formatSessionTime(qualifyingState.sessionDurationSec)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controles: Play/Pause, Velocidades 1x/2x/4x, +1m, +5m, Simular Restante */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={qualifyingState.status === 'completed'}
                    onClick={handleTogglePlay}
                    className={`h-9 px-4 text-xs font-black gap-2 shadow-xs ${
                      isAutoAdvancing
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-[#E10600] hover:bg-[#C00400] text-white'
                    }`}
                  >
                    {isAutoAdvancing ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        PAUSAR
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        PLAY
                      </>
                    )}
                  </Button>

                  {/* Multiplicadores 1x, 2x, 4x */}
                  <div className="flex items-center bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg p-0.5">
                    {([1, 2, 4] as const).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setSelectedSpeed(spd)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                          selectedSpeed === spd
                            ? 'bg-white text-[#0F172A] shadow-xs font-black'
                            : 'text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* +1 MIN */}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={qualifyingState.status === 'completed'}
                    onClick={() => handleAdvanceStep(1)}
                    className="h-9 px-3 text-xs font-bold border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    +1 MIN
                  </Button>

                  {/* +5 MIN */}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={qualifyingState.status === 'completed'}
                    onClick={() => handleAdvanceStep(5)}
                    className="h-9 px-3 text-xs font-bold border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    +5 MIN
                  </Button>

                  {/* SIMULAR RESTANTE */}
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={qualifyingState.status === 'completed'}
                    onClick={handleSimulateRemaining}
                    className="h-9 px-3.5 text-xs font-black bg-[#E10600] hover:bg-[#C00400] text-white shadow-xs gap-1.5"
                  >
                    <FastForward className="w-4 h-4" />
                    SIMULAR RESTANTE ({qualifyingState.stageId.toUpperCase()})
                  </Button>
                </div>
              </div>

              {/* Informações de Parc Fermé e Seleção de Pneus da Qualificação */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#059669]" />
                    Parc Fermé Ativo:
                  </span>
                  <span className="text-[11px] text-[#475569]">
                    Configurações aerodinâmicas e mecânicas congeladas a partir do Q1 pela FIA.
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#64748B]">Visualizar Estoque:</span>
                  <button
                    type="button"
                    onClick={() => setActiveTyresCarId('car1')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      activeTyresCarId === 'car1'
                        ? 'bg-[#E10600] text-white'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    Carro 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTyresCarId('car2')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      activeTyresCarId === 'car2'
                        ? 'bg-[#E10600] text-white'
                        : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    Carro 2
                  </button>
                </div>
              </div>
            </Card>

            {/* PAINEL DE PREPARAÇÃO DOS DOIS CARROS (SESSÃO QUALIFYING) */}
            {pCar1 && pCar2 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SessionCarPreparationPanel
                  sessionType="qualifying"
                  car={{
                    carId: 'car1',
                    carNumber: 1,
                    driverId: qualifyingState.cars.car1.driverId,
                    driverName: qualifyingState.cars.car1.driverName,
                    isRookie: false,
                    status: qualifyingState.cars.car1.status,
                    isEliminated: qualifyingState.cars.car1.isEliminated,
                    fuelKg: qualifyingState.cars.car1.fuelKg,
                    currentCompound: qualifyingState.cars.car1.currentCompound,
                    currentTyreSetId: qualifyingState.cars.car1.currentTyreSetId,
                    tyreWear: qualifyingState.cars.car1.tyreWear,
                    setup: qualifyingState.cars.car1.setup,
                    bestLapTime: qualifyingState.cars.car1.bestLapTime,
                    bestLapSec: qualifyingState.cars.car1.bestLapSec,
                    lastLapTime: qualifyingState.cars.car1.lastLapTime,
                    totalLaps: qualifyingState.cars.car1.totalLaps,
                    currentLapProgressPct: qualifyingState.cars.car1.currentLapProgressPct,
                    pitRequested: qualifyingState.cars.car1.pitRequested,
                  }}
                  teamColor={team?.color || '#E10600'}
                  parcFermeActive={canonicalQualifyingPersistenceService.isParcFermeActive(
                    season?.id || 'default',
                    currentRound,
                  )}
                  inventory={tyreInventories[pCar1.driverId] || []}
                  isSessionRunning={qualifyingState.status === 'running' || isAutoAdvancing}
                  isSessionCompleted={qualifyingState.status === 'completed'}
                  careerId={team?.id || 'default'}
                  seasonId={season?.id || 'default'}
                  round={currentRound}
                  onOrderExitTrack={() => handleOrderExit('car1')}
                  onRequestBox={() => handleRequestBox('car1')}
                  onUpdateSetup={(newSetup) => handleApplyCarSetup('car1', newSetup)}
                  onUpdateFuel={(kg) => handleUpdateFuelInPractice('car1', kg)}
                  onSelectTyreSet={(tyreSetId) => handleSelectTyreSet('car1', tyreSetId)}
                />

                <SessionCarPreparationPanel
                  sessionType="qualifying"
                  car={{
                    carId: 'car2',
                    carNumber: 2,
                    driverId: qualifyingState.cars.car2.driverId,
                    driverName: qualifyingState.cars.car2.driverName,
                    isRookie: false,
                    status: qualifyingState.cars.car2.status,
                    isEliminated: qualifyingState.cars.car2.isEliminated,
                    fuelKg: qualifyingState.cars.car2.fuelKg,
                    currentCompound: qualifyingState.cars.car2.currentCompound,
                    currentTyreSetId: qualifyingState.cars.car2.currentTyreSetId,
                    tyreWear: qualifyingState.cars.car2.tyreWear,
                    setup: qualifyingState.cars.car2.setup,
                    bestLapTime: qualifyingState.cars.car2.bestLapTime,
                    bestLapSec: qualifyingState.cars.car2.bestLapSec,
                    lastLapTime: qualifyingState.cars.car2.lastLapTime,
                    totalLaps: qualifyingState.cars.car2.totalLaps,
                    currentLapProgressPct: qualifyingState.cars.car2.currentLapProgressPct,
                    pitRequested: qualifyingState.cars.car2.pitRequested,
                  }}
                  teamColor={team?.color || '#E10600'}
                  parcFermeActive={canonicalQualifyingPersistenceService.isParcFermeActive(
                    season?.id || 'default',
                    currentRound,
                  )}
                  inventory={tyreInventories[pCar2.driverId] || []}
                  isSessionRunning={qualifyingState.status === 'running' || isAutoAdvancing}
                  isSessionCompleted={qualifyingState.status === 'completed'}
                  careerId={team?.id || 'default'}
                  seasonId={season?.id || 'default'}
                  round={currentRound}
                  onOrderExitTrack={() => handleOrderExit('car2')}
                  onRequestBox={() => handleRequestBox('car2')}
                  onUpdateSetup={(newSetup) => handleApplyCarSetup('car2', newSetup)}
                  onUpdateFuel={(kg) => handleUpdateFuelInPractice('car2', kg)}
                  onSelectTyreSet={(tyreSetId) => handleSelectTyreSet('car2', tyreSetId)}
                />
              </div>
            )}

            {/* TABELA DE CLASSIFICAÇÃO AO VIVO COM LINHA DE CORTE E LOGOS REDUZIDOS */}
            <QualifyingLeaderboardTable
              stageId={qualifyingState.stageId}
              entries={qualifyingState.leaderboard}
              playerTeamName={team?.name}
              playerTeamColor={team?.color}
            />
          </div>
        ) : qualifyingInitializationError ? (
          <div className="max-w-xl mx-auto my-8 p-4">
            <Alert variant="destructive" className="bg-[#1a0f14] border-red-900/60 text-slate-100">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div className="ml-2">
                <AlertTitle className="text-sm font-bold text-red-400">
                  Pré-requisito da Classificação Pendente
                </AlertTitle>
                <AlertDescription className="text-xs text-slate-300 mt-1 mb-4 leading-relaxed">
                  {qualifyingInitializationError.message ||
                    'Não foi possível iniciar a fase de classificação porque o resultado válido da fase anterior não está disponível.'}
                </AlertDescription>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-red-500/40 text-red-200 hover:bg-red-950/50 hover:text-white text-xs font-bold"
                  onClick={() => {
                    setQualifyingInitializationError(null)
                    initializeQualifyingSession(selectedSessionId as QualifyingStageId)
                  }}
                >
                  Tentar novamente
                </Button>
              </div>
            </Alert>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[30vh] space-y-3">
            <div className="w-8 h-8 border-4 border-[#E10600] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-[#64748B]">
              Preparando sessão de classificação...
            </p>
          </div>
        )
      ) : isRaceSession && completeQualifyingResult ? (
        // RENDERIZAÇÃO DA CORRIDA V2 (FW2.1E-A / FW2.1E-F: ESTADO CANÔNICO OU RESULTADO OFICIAL)
        officialRaceResult ? (
          <div className="space-y-4">
            <OfficialRaceResultPanel
              result={officialRaceResult}
              careerPersistenceStatus={careerPersistenceStatus}
              isPersisting={isPersistingCareer}
              persistenceError={careerPersistenceError}
              onRegisterInCareer={() => {
                try {
                  setIsPersistingCareer(true)
                  setCareerPersistenceStatus('APPLYING')
                  const canonicalCareerId = resolveCanonicalCareerId(season, team)
                  const res =
                    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
                      officialRaceResult,
                    )
                  setCareerPersistenceStatus(res.journal.status)
                  setIsPersistingCareer(false)
                  if (res.success) {
                    canonicalChampionshipService.processAndPersistRoundChampionship(
                      canonicalCareerId,
                      season?.year || 2026,
                      currentRound,
                    )
                    toast({
                      title: 'Resultado Registrado na Carreira',
                      description:
                        'Os dados esportivos oficiais foram persistidos e as estatísticas dos pilotos acumuladas.',
                    })
                  } else {
                    setCareerPersistenceError(res.error)
                    toast({
                      variant: 'destructive',
                      title: 'Falha ao registrar na carreira',
                      description: res.error || 'Erro durante a persistência.',
                    })
                  }
                } catch (e: any) {
                  setIsPersistingCareer(false)
                  setCareerPersistenceStatus('FAILED')
                  setCareerPersistenceError(e?.message)
                  toast({
                    variant: 'destructive',
                    title: 'Erro inesperado',
                    description: e?.message || 'Falha ao aplicar resultado na carreira.',
                  })
                }
              }}
              onViewChampionship={() => {
                navigate('/standings')
              }}
              onContinue={async () => {
                // Se for Corrida Sprint, continuar não avança a rodada do GP, mas avança para Q1 na esteira
                if (isSprintRaceSession) {
                  const stored = refreshCompletedSessions()
                  if (!stored.includes('sprint_race')) {
                    const updated = [...stored, 'sprint_race']
                    if (season?.id) {
                      writeStoredCompletedSessions(season.id, currentRound, updated)
                    }
                    setCompletedSessions(updated)
                  }
                  setOfficialRaceResult(null)
                  setCanonicalRaceState(null)
                  // Selecionar Q1 na esteira
                  const q1Def = pipeline.find((s) => s.id === 'q1')
                  if (q1Def) {
                    handleSelectSessionFromSchedule(q1Def)
                  } else {
                    setSelectedSessionId('q1')
                  }
                  toast({
                    title: 'Corrida Sprint Concluída!',
                    description: 'A Classificação Principal (Q1) está liberada.',
                  })
                  return
                }

                // BUG-01 PARTE C: Esteira canônica obrigatória de avanço de rodada na Corrida Principal
                if (isAdvancingRound) return
                if (!season?.id) {
                  navigate('/calendario')
                  return
                }

                setIsAdvancingRound(true)
                try {
                  const advanceRes = await advanceWeekendRound({
                    officialResult: officialRaceResult,
                    season,
                    team,
                    currentRound,
                    refreshTeamAndSeason,
                    onError: (err) => {
                      toast({
                        variant: 'destructive',
                        title: 'Falha ao avançar rodada',
                        description: err.message || 'Erro durante avanço de rodada.',
                      })
                    },
                  })

                  if (advanceRes.success) {
                    toast({
                      title: `Rodada ${currentRound} Concluída com Sucesso!`,
                      description: `Temporada avançada para a rodada ${advanceRes.nextRound}.`,
                    })
                    navigate('/calendario')
                  }
                } catch (advanceErr: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Falha no avanço do campeonato',
                    description: advanceErr?.message || 'Erro inesperado.',
                  })
                } finally {
                  setIsAdvancingRound(false)
                }
              }}
            />
          </div>
        ) : canonicalRaceState ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-[#0d1627] to-[#080d1a] border border-cyan-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-200 font-bold font-mono">
                  Visualização dedicada disponível: modo compacto de alta densidade sem scroll
                </span>
              </div>
              <Button
                asChild
                size="sm"
                className="h-8 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs gap-1.5 shadow-md"
              >
                <Link
                  to={`/corrida/live?variant=${isSprintRaceSession ? 'SPRINT_RACE' : 'MAIN_RACE'}&round=${currentRound}`}
                >
                  Abrir Race Control Dedicado →
                </Link>
              </Button>{' '}
            </div>
            <CanonicalRaceInitializationPanel
              raceState={canonicalRaceState}
              hasOfficialResult={!!officialRaceResult}
              onResetGrid={() => setCanonicalRaceState(null)}
              onOfficializeRace={() => {
                try {
                  const canonicalCareerId = resolveCanonicalCareerId(season, team)
                  const stateWithCanonicalId = {
                    ...canonicalRaceState,
                    careerId: canonicalCareerId,
                  }
                  const official = canonicalRaceResultService.officializeRace(stateWithCanonicalId)
                  setOfficialRaceResult(official)
                  toast({
                    title: 'Corrida Oficializada com Sucesso',
                    description:
                      'O resultado oficial imutável foi homologado. Registrando na carreira...',
                  })

                  // Se for Corrida Sprint, marcar sprint_race como completed nas sessões
                  if (isSprintRaceSession && season?.id) {
                    const currentStored = readStoredCompletedSessions(season.id, currentRound)
                    if (!currentStored.includes('sprint_race')) {
                      const updated = [...currentStored, 'sprint_race']
                      writeStoredCompletedSessions(season.id, currentRound, updated)
                      setCompletedSessions(updated)
                    }
                  }

                  // Persistência automática pós-oficialização canônica e idempotente
                  try {
                    setIsPersistingCareer(true)
                    setCareerPersistenceStatus('APPLYING')
                    const res =
                      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
                    setCareerPersistenceStatus(res.journal.status)
                    setIsPersistingCareer(false)
                    if (res.success) {
                      // Processar e persistir imediatamente o campeonato canônico desta rodada
                      canonicalChampionshipService.processAndPersistRoundChampionship(
                        canonicalCareerId,
                        season?.year || 2026,
                        currentRound,
                      )
                      toast({
                        title: 'Registrado na Carreira',
                        description: 'Estatísticas acumuladas com sucesso.',
                      })
                    } else {
                      setCareerPersistenceError(res.error)
                    }
                  } catch (applyErr: any) {
                    setIsPersistingCareer(false)
                    setCareerPersistenceStatus('FAILED')
                    setCareerPersistenceError(applyErr?.message)
                  }
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Falha ao oficializar corrida',
                    description: e?.message || 'A prova ainda não pode ser oficializada.',
                  })
                }
              }}
              onRequestPit={(driverId, compound) => {
                try {
                  const nextState = raceStrategyService.requestPitStop(
                    canonicalRaceState,
                    driverId,
                    compound,
                  )
                  canonicalRaceInitializationService.saveCanonicalRaceState(nextState)
                  setCanonicalRaceState(nextState)
                  toast({
                    title: 'Pit Stop Solicitado',
                    description: `Box chamado para o piloto nesta volta com composto ${compound || 'alvo'}.`,
                  })
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Falha ao solicitar pit stop',
                    description: e?.message,
                  })
                }
              }}
              onCancelPit={(driverId) => {
                try {
                  const nextState = raceStrategyService.cancelPitRequest(
                    canonicalRaceState,
                    driverId,
                  )
                  canonicalRaceInitializationService.saveCanonicalRaceState(nextState)
                  setCanonicalRaceState(nextState)
                  toast({
                    title: 'Pit Stop Cancelado',
                    description:
                      'A chamada para os boxes foi cancelada. O piloto permanece na pista.',
                  })
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Falha ao cancelar pit stop',
                    description: e?.message,
                  })
                }
              }}
              onSetPaceMode={(driverId, mode) => {
                try {
                  const nextState = raceStrategyService.setDriverPaceMode(
                    canonicalRaceState,
                    driverId,
                    mode,
                  )
                  canonicalRaceInitializationService.saveCanonicalRaceState(nextState)
                  setCanonicalRaceState(nextState)
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Falha ao alterar ritmo',
                    description: e?.message,
                  })
                }
              }}
              onSetTargetCompound={(driverId, comp) => {
                try {
                  const nextState = raceStrategyService.setDriverTargetCompound(
                    canonicalRaceState,
                    driverId,
                    comp,
                  )
                  canonicalRaceInitializationService.saveCanonicalRaceState(nextState)
                  setCanonicalRaceState(nextState)
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Falha ao alterar composto',
                    description: e?.message,
                  })
                }
              }}
              onTriggerRedFlag={() => {
                try {
                  const nextState = canonicalRaceEngineService.triggerRedFlag(canonicalRaceState, {
                    reason: 'Bandeira Vermelha — Corrida Suspensa pela Direção de Prova',
                  })
                  setCanonicalRaceState(nextState)
                  toast({
                    variant: 'destructive',
                    title: '🔴 Bandeira Vermelha Acionada',
                    description:
                      'A corrida foi suspensa. Os carros retornaram aos boxes e a classificação foi congelada.',
                  })
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Falha ao acionar Bandeira Vermelha',
                    description: e?.message,
                  })
                }
              }}
              onPrepareRestart={() => {
                try {
                  const nextState =
                    canonicalRaceEngineService.prepareRedFlagRestart(canonicalRaceState)
                  setCanonicalRaceState(nextState)
                  toast({
                    title: '🟢 Procedimento de Relargada Ativado',
                    description:
                      'Grid alinhado na ordem congelada da bandeira vermelha. Pronto para relargar.',
                  })
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Falha ao preparar relargada',
                    description: e?.message,
                  })
                }
              }}
              onResumeRace={() => {
                try {
                  const nextState =
                    canonicalRaceEngineService.resumeRaceAfterRedFlag(canonicalRaceState)
                  setCanonicalRaceState(nextState)
                  toast({
                    title: '🟢 Corrida Reiniciada!',
                    description: 'Bandeira verde! A prova recomeçou com o grid congelado mantido.',
                  })
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Falha ao reiniciar corrida',
                    description: e?.message,
                  })
                }
              }}
              onChangeSuspensionTyre={(driverId: string, compound: any) => {
                try {
                  const res = canonicalRaceEngineService.changeTyresDuringSuspension({
                    raceState: canonicalRaceState,
                    driverId,
                    newCompound: compound,
                  })
                  if (res.success) {
                    setCanonicalRaceState(res.updatedState)
                    toast({
                      title: 'Pneu Trocado na Suspensão',
                      description: `Composto ${compound.toUpperCase()} instalado no carro sem custo competitivo de pit stop.`,
                    })
                  } else {
                    toast({
                      variant: 'destructive',
                      title: 'Falha na Troca de Pneus',
                      description: res.error,
                    })
                  }
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Erro ao trocar pneus',
                    description: e?.message,
                  })
                }
              }}
              onAdvanceOneLap={(opts) => {
                try {
                  const nextState = canonicalRaceEngineService.advanceOneLap(
                    canonicalRaceState,
                    opts,
                  )
                  setCanonicalRaceState(nextState)
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Erro ao avançar volta',
                    description: e?.message || 'Falha na execução do Race Engine.',
                  })
                }
              }}
              onSubmitWeatherDecision={(driverId, action, selectedCompound) => {
                try {
                  const res = raceStrategyService.submitWeatherDecision({
                    raceState: canonicalRaceState,
                    driverId,
                    action,
                    selectedCompound,
                  })
                  if (res.success) {
                    canonicalRaceInitializationService.saveCanonicalRaceState(res.updatedState)
                    setCanonicalRaceState(res.updatedState)
                    const drvName =
                      res.updatedState.drivers.find((d) => d.driverId === driverId)?.driverName ||
                      driverId
                    toast({
                      title: 'Decisão Climática Confirmada',
                      description:
                        action === 'PIT_NOW'
                          ? `${drvName}: Box chamado com pneus ${selectedCompound?.toUpperCase()}.`
                          : `${drvName}: Permanecerá na pista (Stay Out).`,
                    })
                    return { success: true }
                  } else {
                    toast({
                      variant: 'destructive',
                      title: 'Falha ao aplicar decisão',
                      description: res.error || 'Erro na validação da decisão.',
                    })
                    return { success: false, error: res.error }
                  }
                } catch (err: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Erro ao registrar decisão',
                    description: err?.message || 'Falha inesperada.',
                  })
                  return { success: false, error: err?.message }
                }
              }}
              onAdvanceMultipleLaps={(count) => {
                try {
                  const nextState = canonicalRaceEngineService.advanceMultipleLaps(
                    canonicalRaceState,
                    count,
                  )
                  setCanonicalRaceState(nextState)
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Erro ao simular voltas',
                    description: e?.message || 'Falha na execução do Race Engine.',
                  })
                }
              }}
              onManualSave={() => {
                try {
                  canonicalRaceInitializationService.saveCanonicalRaceState(canonicalRaceState)
                  toast({
                    title: 'Corrida Salva',
                    description: `Snapshot canônico v1 salvo com sucesso (Volta ${canonicalRaceState.currentLap}).`,
                  })
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Erro ao salvar corrida',
                    description: e?.message,
                  })
                }
              }}
              onResetRace={() => {
                try {
                  if (!completeQualifyingResult || !team?.id || !season?.id) return
                  // FW2.1E-F Requisito 18: Se já foi oficializada, bloquear reinício
                  const canonicalCareerId = resolveCanonicalCareerId(season, team)
                  if (
                    canonicalRaceResultService.hasOfficialRaceResult(
                      canonicalCareerId,
                      season.year || 2026,
                      currentRound,
                      isSprintRaceSession ? 'SPRINT_RACE' : 'MAIN_RACE',
                    )
                  ) {
                    toast({
                      variant: 'destructive',
                      title: 'Ação Bloqueada',
                      description:
                        'Esta corrida já foi oficializada e homologada. O histórico da temporada é imutável.',
                    })
                    return
                  }

                  // Descartar save da corrida atual (Requisito 13)
                  const clearRes = canonicalRaceInitializationService.clearCanonicalRaceState(
                    canonicalCareerId,
                    season.year || 2026,
                    currentRound,
                    { raceVariant: isSprintRaceSession ? 'SPRINT_RACE' : 'MAIN_RACE' },
                  )
                  if (!clearRes.success) {
                    toast({
                      variant: 'destructive',
                      title: 'Não é possível reiniciar',
                      description: clearRes.blockedReason,
                    })
                    return
                  }
                  const totalLaps = isSprintRaceSession
                    ? canonicalRaceInitializationService.calculateSprintLaps(
                        gpInfo.circuitLengthKm || 5.8,
                        100,
                        gpInfo.laps || 57,
                      )
                    : gpInfo.laps || 57

                  const freshRace =
                    canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
                      raceVariant: isSprintRaceSession ? 'SPRINT_RACE' : 'MAIN_RACE',
                      careerId: canonicalCareerId,
                      season: season.year || 2026,
                      round: currentRound,
                      circuitName: gpInfo.circuit,
                      circuitCountry: gpInfo.country,
                      totalLaps,
                      playerTeamId: team.id,
                      playerTeam: team,
                      canonicalQualifyingGrid: completeQualifyingResult.finalGrid,
                    })
                  setCanonicalRaceState(freshRace)
                  toast({
                    title: 'Corrida Reiniciada',
                    description:
                      'O save anterior foi descartado e a corrida re-inicializada a partir do grid oficial.',
                  })
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Erro ao reiniciar corrida',
                    description: e?.message || 'Falha ao redefinir estado inicial.',
                  })
                }
              }}
            />
            ) : showPreRacePreparation ? ( /* BUG-02 COMMIT C: ETAPA OBRIGATÓRIA "ESTRATÉGIA DE
            CORRIDA" PRÉ-LARGADA */
            <PreRaceStrategyPreparationPanel
              careerId={resolveCanonicalCareerId(season, team)}
              seasonYear={season?.year || 2026}
              round={currentRound}
              teamId={team?.id || 'default_team'}
              teamColor={team?.color || '#E10600'}
              totalLaps={gpInfo.laps || 57}
              canonicalGrid={completeQualifyingResult.finalGrid}
              inventories={tyreInventories}
              onCancelToGrid={() => setShowPreRacePreparation(false)}
              onConfirmAndStartRace={(prepSnapshot: RacePreparationSnapshot) => {
                try {
                  if (!team?.id || !season?.id) return
                  const canonicalCareerId = resolveCanonicalCareerId(season, team)

                  // Persistir snapshot race-prep-v1
                  canonicalRacePreparationService.saveSnapshot(prepSnapshot)

                  // Mapear preparações por piloto/carro para o canonicalRaceInitializationService
                  const carPreparations: Record<string, any> = {}
                  prepSnapshot.cars.forEach((car) => {
                    carPreparations[car.driverId] = {
                      startingTyreSetId: car.startingTyreSetId,
                      startingCompound: car.startingCompound,
                      startingFuelKg: car.startingFuelKg,
                      initialTyreWear: car.initialTyreWear,
                      initialTyreLapsUsed: car.initialTyreLapsUsed,
                      startingPaceMode: (car as any).startingPaceMode,
                    }
                    carPreparations[car.carId] = carPreparations[car.driverId]
                  })

                  // Inicializar Race Engine com exatamente as escolhas feitas pelo jogador
                  const totalLaps = isSprintRaceSession
                    ? canonicalRaceInitializationService.calculateSprintLaps(
                        gpInfo.circuitLengthKm || 5.8,
                        100,
                        gpInfo.laps || 57,
                      )
                    : gpInfo.laps || 57
                  const initialRace =
                    canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
                      raceVariant: isSprintRaceSession ? 'SPRINT_RACE' : 'MAIN_RACE',
                      careerId: canonicalCareerId,
                      season: season.year || 2026,
                      round: currentRound,
                      circuitName: gpInfo.circuit,
                      circuitCountry: gpInfo.country,
                      totalLaps,
                      playerTeamId: team.id,
                      playerTeam: team,
                      canonicalQualifyingGrid: completeQualifyingResult.finalGrid,
                      carPreparations,
                    })

                  setCanonicalRaceState(initialRace)
                  setShowPreRacePreparation(false)
                  toast({
                    title: 'Corrida Iniciada',
                    description: 'Estratégia aplicada com sucesso. Boa sorte!',
                  })
                } catch (e: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Erro ao iniciar corrida',
                    description: e?.message,
                  })
                }
              }}
            />
          </div>
        ) : (
          <CompleteQualifyingGridSummary
            result={completeQualifyingResult}
            onGoToRace={() => {
              // BUG-02 COMMIT C: Transição obrigatória passa pela etapa de Estratégia de Corrida
              setShowPreRacePreparation(true)
            }}
          />
        )
      ) : (
        // RENDERIZAÇÃO DOS PLACEHOLDERS (CORRIDA OU QUALIFICAÇÃO BLOQUEADA OU SEM DADOS)
        (() => {
          const visualState = resolveSessionVisualState({
            sessionId: selectedSessionDef.id,
            activeSessionId: selectedSessionId,
            completedSessions,
          })
          return (
            <SessionPlaceholderCard
              session={selectedSessionDef}
              isLocked={visualState === 'locked'}
              isPendingDevelopment={false}
              gpName={gpInfo.name}
              circuitName={gpInfo.circuit}
              statusVariant={visualState}
            />
          )
        })()
      )}

      {/* MODAL DE REACERTO DO CARRO */}
      {setupModalCarId && sessionState && (
        <CarSetupModal
          open={!!setupModalCarId}
          onClose={() => setSetupModalCarId(null)}
          car={sessionState.cars[setupModalCarId]}
          carId={setupModalCarId}
          carNumber={setupModalCarId === 'car1' ? 1 : 2}
          driverName={sessionState.cars[setupModalCarId].driverName}
          knowledge={sessionState.knowledge}
          onApplySetup={handleApplyCarSetup}
        />
      )}

      {/* MODAL DIRETO DE SELEÇÃO DE RESERVA NO COCKPIT (TL1) */}
      {rookieSelectorModalCarId && (
        <Dialog
          open={!!rookieSelectorModalCarId}
          onOpenChange={(open) => !open && setRookieSelectorModalCarId(null)}
        >
          <DialogContent className="max-w-xl bg-[#090D15] border border-[#1F2733] text-white">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-white flex items-center gap-2">
                <Users2 className="w-5 h-5 text-emerald-400" />
                Escalar Piloto Reserva / Novato no TL1 —{' '}
                {rookieSelectorModalCarId === 'car1' ? 'Carro 1' : 'Carro 2'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Titular atual:{' '}
                <strong className="text-white">
                  {rookieSelectorModalCarId === 'car1'
                    ? registration?.snapshot?.entriesByCar.playerCar1?.driverName
                    : registration?.snapshot?.entriesByCar.playerCar2?.driverName}
                </strong>
                . A FIA exige pilotos com no máximo 2 Grandes Prêmios na carreira.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {(() => {
                const options = RookiePracticeRequirementService.getRosterRookieOptions(
                  playerDrivers,
                  allDriversCatalog,
                  team?.id,
                )
                const targetOriginal =
                  rookieSelectorModalCarId === 'car1'
                    ? playerDrivers[0]
                    : playerDrivers[1] || playerDrivers[0]

                if (options.eligible.length === 0) {
                  return (
                    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                      Nenhum novato elegível disponível no momento.
                    </div>
                  )
                }

                return (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Pilotos Elegíveis Disponíveis ({options.eligible.length})
                    </p>
                    {options.eligible.map((rk) => {
                      const isOccupyingOtherCar =
                        (rookieSelectorModalCarId === 'car1' &&
                          activeRookieCar2?.rookieDriverId === rk.driverId) ||
                        (rookieSelectorModalCarId === 'car2' &&
                          activeRookieCar1?.rookieDriverId === rk.driverId)

                      return (
                        <div
                          key={rk.driverId}
                          className="p-3 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-emerald-500/50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-white">{rk.driverName}</span>
                              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px]">
                                {rk.careerGPs} GP{rk.careerGPs === 1 ? '' : 's'}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {rk.role ? `Função: ${rk.role} • ` : ''}
                              {isOccupyingOtherCar ? 'Já escalado no outro carro.' : rk.reason}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isOccupyingOtherCar}
                            onClick={() => {
                              if (targetOriginal) {
                                handleAssignRookie(rookieSelectorModalCarId, rk, targetOriginal)
                              }
                              setRookieSelectorModalCarId(null)
                            }}
                            className={`h-8 px-3 text-xs font-black gap-1.5 ${
                              isOccupyingOtherCar
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isOccupyingOtherCar ? 'Em uso no outro carro' : 'Escalar'}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {/* CANDIDATOS INELEGÍVEIS COM MOTIVO EXPLÍCITO */}
              {(() => {
                const options = RookiePracticeRequirementService.getRosterRookieOptions(
                  playerDrivers,
                  allDriversCatalog,
                  team?.id,
                )
                if (options.ineligible.length === 0) return null

                return (
                  <div className="space-y-2 pt-3 border-t border-slate-800/80">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Pilotos Inelegíveis ({options.ineligible.length})
                    </p>
                    <div className="space-y-1.5">
                      {options.ineligible.map((item) => (
                        <div
                          key={item.driverId}
                          className="p-2.5 rounded-lg bg-[#080C14] border border-[#141C2A] flex items-center justify-between text-xs opacity-75"
                        >
                          <div>
                            <span className="font-bold text-slate-300">{item.driverName}</span>
                            <span className="text-[10px] text-slate-500 ml-2">
                              ({item.careerGPs} GPs disputados)
                            </span>
                            <p className="text-[10px] text-rose-400">{item.reason}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-rose-900/40 text-rose-400 text-[9px]"
                          >
                            Inelegível
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
