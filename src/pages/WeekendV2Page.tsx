import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
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
import { GPRegistrationScreen } from '@/pages/race/GPRegistrationScreen'

// Serviços canônicos da F1 2026
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { practiceSessionService } from '@/services/practiceSessionService'
import { PracticeSessionRunner } from '@/services/canonicalPracticeRunner'
import {
  CanonicalPracticeV2Runner,
  type AdvanceStepResult,
} from '@/services/canonicalPracticeV2Runner'
import { RookieFP1ManagementCard } from '@/components/race/RookieFP1ManagementCard'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
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
} from '@/services/weekendProgressionService'
import {
  getRaceWeekendPipeline,
  resolveInitialRaceSession,
  CANONICAL_SESSION_DEFINITIONS,
  type RaceWeekendSessionId,
  type WeekendSessionDefinition,
} from '@/services/weekendScheduleConfig'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { F1_2026_CALENDAR } from '@/lib/f1-data'

// Subcomponentes operacionais
import { PracticeCarCockpitCard } from '@/components/race/PracticeCarCockpitCard'
import { TyreInventoryPanel } from '@/components/race/TyreInventoryPanel'
import { PracticeLeaderboardTable } from '@/components/race/PracticeLeaderboardTable'
import { CarSetupModal } from '@/components/race/CarSetupModal'
import { QualifyingCarCockpitCard } from '@/components/race/QualifyingCarCockpitCard'
import { QualifyingLeaderboardTable } from '@/components/race/QualifyingLeaderboardTable'
import { CompleteQualifyingGridSummary } from '@/components/race/CompleteQualifyingGridSummary'
import { CanonicalRaceInitializationPanel } from '@/components/race/CanonicalRaceInitializationPanel'
import { OfficialRaceResultPanel } from '@/components/race/OfficialRaceResultPanel'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
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
import type {
  QualifyingStageId,
  QualifyingStageState,
  QualifyingStageResult,
  CompleteQualifyingWeekendResult,
} from '@/types/canonical-qualifying-types'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import type { PracticeSessionRecordState, PracticeCarLiveState } from '@/types/practice-session'
import type { PracticeSessionType } from '@/types/practice-preparation'
import type { TireSetItem } from '@/types/f1'

export default function WeekendV2Page() {
  const { user, team, season, isLoading: isAuthLoading } = useAuth()
  const { currentRound, playerDrivers } = useUnifiedSeason()
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

  // Esteira canônica do fim de semana (TL1 -> TL2 -> Q1 -> Q2 -> Q3 -> CORRIDA)
  // TL3 está tecnicamente preservado e pode ser habilitado via config `includePractice3`
  const pipeline = useMemo(() => {
    return getRaceWeekendPipeline({
      format: isSprint ? 'sprint' : 'standard',
      includePractice3: false,
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

  // Sessão atualmente selecionada na esteira
  const [selectedSessionId, setSelectedSessionId] = useState<RaceWeekendSessionId>('tp1')

  // Estado em memória e no storage da sessão de treino em andamento
  const [sessionState, setSessionState] = useState<PracticeSessionRecordState | null>(null)

  // Estado em memória da sessão de qualificação em andamento (Q1, Q2 ou Q3)
  const [qualifyingState, setQualifyingState] = useState<QualifyingStageState | null>(null)
  const [completeQualifyingResult, setCompleteQualifyingResult] =
    useState<CompleteQualifyingWeekendResult | null>(null)
  const [canonicalRaceState, setCanonicalRaceState] = useState<CanonicalRaceState | null>(null)
  const [officialRaceResult, setOfficialRaceResult] = useState<OfficialRaceResult | null>(null)
  const [careerPersistenceStatus, setCareerPersistenceStatus] =
    useState<CareerApplicationStatus>('PENDING')
  const [isPersistingCareer, setIsPersistingCareer] = useState(false)
  const [careerPersistenceError, setCareerPersistenceError] = useState<string | undefined>(
    undefined,
  )
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

        // 3.4. Determinar sessão canônica inicial
        const initialSessionId = resolveInitialRaceSession({
          pipeline,
          completedSessions: stored,
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
          initialSessionId === 'q3'
        ) {
          initializeQualifyingSession(initialSessionId as QualifyingStageId, reg, invs)
        } else if (initialSessionId === 'race') {
          const fullGrid = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
            season.id,
            currentRound,
          )
          setCompleteQualifyingResult(fullGrid)
          const savedRace = canonicalRaceInitializationService.readCanonicalRaceState(
            team.id,
            season.year || 2026,
            currentRound,
          )
          setCanonicalRaceState(savedRace)
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
    const car1Tire =
      inventories[pCar1.driverId]?.find((t) => (t.wear || 0) < 100) ||
      inventories[pCar1.driverId]?.[0]
    const car2Tire =
      inventories[pCar2.driverId]?.find((t) => (t.wear || 0) < 100) ||
      inventories[pCar2.driverId]?.[0]

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
          tyreSelection: {
            setId: car1Tire?.id || `${season.id}_c1_init_tire`,
            compound: car1Tire?.compound || ('medio' as const),
          },
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
          tyreSelection: {
            setId: car2Tire?.id || `${season.id}_c2_init_tire`,
            compound: car2Tire?.compound || ('medio' as const),
          },
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
      teamColor: team.color,
      teamChassisRating: team.strength || 75,
      engineSupplier: team.engine_supplier || 'Audi',
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
    const stored = refreshCompletedSessions()

    // Validações canônicas de bloqueio:
    if (sess === 'tp2' && !stored.includes('tp1')) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description: 'Você precisa concluir o TL1 antes de iniciar o TL2.',
      })
      return
    }

    if (sess === 'tp3' && !stored.includes('tp2')) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description: 'Você precisa concluir o TL2 antes de iniciar o TL3.',
      })
      return
    }

    if (sess === 'q1' && !stored.includes('tp2')) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description: 'Você precisa concluir o TL2 antes de iniciar a Qualificação (Q1).',
      })
      return
    }

    if (sess === 'q2' && !stored.includes('q1')) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description: 'Você precisa concluir o Q1 antes de iniciar o Q2.',
      })
      return
    }

    if (sess === 'q3' && !stored.includes('q2')) {
      toast({
        variant: 'destructive',
        title: 'Sessão Bloqueada',
        description: 'Você precisa concluir o Q2 antes de iniciar o Q3.',
      })
      return
    }

    if (sess === 'race' && !stored.includes('q3') && !stored.includes('qualifying')) {
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
    const invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId: season.id,
      round: currentRound,
      driverIds,
      primaryDriverIds: driverIds,
    })
    setTyreInventories(invs)

    // Se for TL1, TL2 ou TL3: carrega/resume o runner de treino
    if (sess === 'tp1' || sess === 'tp2' || sess === 'tp3') {
      await initializePracticeSession(sess, registration, invs)
      setQualifyingState(null)
    } else if (sess === 'q1' || sess === 'q2' || sess === 'q3') {
      // Q1, Q2 ou Q3: inicializa ou carrega a sessão de qualificação canônica
      setSelectedSessionId(sess)
      setSessionState(null)
      await initializeQualifyingSession(sess as QualifyingStageId, registration, invs)
    } else {
      // CORRIDA: se Q3 concluído, exibe o grid final P1-P24 ou placeholder
      setSelectedSessionId(sess)
      setSessionState(null)
      setQualifyingState(null)
      if (season?.id && team?.id) {
        const fullGrid = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
          season.id,
          currentRound,
        )
        setCompleteQualifyingResult(fullGrid)
        const savedRace = canonicalRaceInitializationService.readCanonicalRaceState(
          team.id,
          season.year || 2026,
          currentRound,
        )
        setCanonicalRaceState(savedRace)

        // FW2.1E-F: Verificar resultado oficial
        const official = canonicalRaceResultService.getOfficialRaceResult(
          team.id,
          season.year || 2026,
          currentRound,
        )
        if (official) {
          setOfficialRaceResult(official)
          const journal = canonicalCareerPersistenceService.getApplicationJournal(
            team.id,
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

  // Helper para resolver os 24 pilotos oficiais do grid para a qualificação
  const resolveEligibleQualifyingParticipants = (
    stageId: QualifyingStageId,
    reg: RegistrationValidationResult,
  ): QualifyingDriverContext[] => {
    if (!season?.id || !reg.snapshot) return []
    const allSnapshotEntries = reg.snapshot.entries || []

    // Constrói os participantes diretamente a partir das entradas canônicas do snapshot
    // sem reinjetar ou duplicar pilotos do jogador.
    const playerDriverIds = new Set(
      [
        reg.snapshot.entriesByCar?.playerCar1?.driverId,
        reg.snapshot.entriesByCar?.playerCar2?.driverId,
      ].filter(Boolean) as string[],
    )

    const all24: QualifyingDriverContext[] = []
    const seenDriverIds = new Set<string>()

    allSnapshotEntries.forEach((e, idx) => {
      if (!e.driverId || seenDriverIds.has(e.driverId)) return
      seenDriverIds.add(e.driverId)

      const isPlayer = e.isPlayerTeam || playerDriverIds.has(e.driverId)
      all24.push({
        id: e.driverId,
        name: e.driverName,
        speed: isPlayer ? (e.carId === 'car1' ? 84 : 82) : 78 + (idx % 8),
        consistency: isPlayer ? (e.carId === 'car1' ? 82 : 81) : 79,
        defense: isPlayer ? (e.carId === 'car1' ? 80 : 78) : 76,
        teamId: isPlayer ? team?.id || e.teamId : e.teamId || `rival_${idx}`,
        teamName: isPlayer ? team?.name || e.teamName : e.teamName || `Equipe ${idx + 1}`,
        teamColor: isPlayer ? team?.color || e.teamColor || '#E10600' : e.teamColor || '#64748B',
        carNumber: e.driverNumber || (isPlayer ? (e.carId === 'car1' ? 1 : 2) : idx + 3),
      })
    })

    if (stageId === 'q1') {
      return all24.slice(0, 24)
    }

    if (stageId === 'q2') {
      const q1Res = canonicalQualifyingPersistenceService.readStageResult(
        season.id,
        currentRound,
        'q1',
      )
      if (q1Res && q1Res.advancingDriverIds) {
        return all24.filter((p) => q1Res.advancingDriverIds.includes(p.id))
      }
      return all24.slice(0, 18)
    }

    if (stageId === 'q3') {
      const q2Res = canonicalQualifyingPersistenceService.readStageResult(
        season.id,
        currentRound,
        'q2',
      )
      if (q2Res && q2Res.advancingDriverIds) {
        return all24.filter((p) => q2Res.advancingDriverIds.includes(p.id))
      }
      return all24.slice(0, 10)
    }

    return all24
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

    const pCar1 = reg.snapshot.entriesByCar.playerCar1
    const pCar2 = reg.snapshot.entriesByCar.playerCar2
    if (!pCar1 || !pCar2) return

    const eligible = resolveEligibleQualifyingParticipants(stageId, reg)

    // Buscar pneus disponíveis no mesmo inventário compartilhado de 20 jogos
    const car1Tire =
      inventories[pCar1.driverId]?.find((t) => (t.wear || 0) < 100) ||
      inventories[pCar1.driverId]?.[0]
    const car2Tire =
      inventories[pCar2.driverId]?.find((t) => (t.wear || 0) < 100) ||
      inventories[pCar2.driverId]?.[0]

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
        tyreSetId: car1Tire?.id || `${season.id}_c1_init_tire`,
        compound: car1Tire?.compound || 'macio',
        wear: car1Tire?.wear || 0,
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
        tyreSetId: car2Tire?.id || `${season.id}_c2_init_tire`,
        compound: car2Tire?.compound || 'macio',
        wear: car2Tire?.wear || 0,
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
    setIsAutoAdvancing(false)

    // Se Q3 já estiver concluído, verificar se já temos o grid final
    if (stageId === 'q3' && qState.status === 'completed') {
      const fullGrid = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
        season.id,
        currentRound,
      )
      setCompleteQualifyingResult(fullGrid)
      // Carregar resultado oficial caso já tenha sido homologado
      const official = canonicalRaceResultService.getOfficialRaceResult(
        team.id,
        season.year || 2026,
        currentRound,
      )
      if (official) {
        setOfficialRaceResult(official)
      }
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

  // Carregar catálogo de pilotos para o modal de novatos e assignments salvos
  useEffect(() => {
    if (!season?.id || !team?.id) return
    const a1 = RookiePracticeRequirementService.getTemporaryFP1Assignment(
      season.id,
      currentRound,
      team.id,
      'car1',
    )
    const a2 = RookiePracticeRequirementService.getTemporaryFP1Assignment(
      season.id,
      currentRound,
      team.id,
      'car2',
    )
    setActiveRookieCar1(a1)
    setActiveRookieCar2(a2)

    f1Service
      .getMarketDrivers()
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setAllDriversCatalog(res)
        }
      })
      .catch(() => {})
  }, [season?.id, team?.id, currentRound])

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
  const handleTogglePlay = () => {
    const isQuali =
      selectedSessionId === 'q1' || selectedSessionId === 'q2' || selectedSessionId === 'q3'

    if (isQuali) {
      if (!qualifyingState) return
      const stored = refreshCompletedSessions()
      if (qualifyingState.status === 'completed' || stored.includes(qualifyingState.stageId)) {
        toast({
          variant: 'destructive',
          title: 'Sessão Concluída',
          description: 'Não é permitido executar novamente uma fase oficialmente concluída.',
        })
        return
      }

      if (isAutoAdvancing) {
        setIsAutoAdvancing(false)
        qualifyingState.status = 'paused'
        if (season?.id) {
          canonicalQualifyingPersistenceService.saveStageState(
            season.id,
            currentRound,
            qualifyingState,
          )
        }
      } else {
        setIsAutoAdvancing(true)
        qualifyingState.status = 'running'
        if (season?.id) {
          canonicalQualifyingPersistenceService.saveStageState(
            season.id,
            currentRound,
            qualifyingState,
          )
        }
      }
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
    const isQuali =
      selectedSessionId === 'q1' || selectedSessionId === 'q2' || selectedSessionId === 'q3'

    if (!isAutoAdvancing) {
      if (autoAdvanceIntervalRef.current) {
        clearInterval(autoAdvanceIntervalRef.current)
      }
      return
    }

    const intervalMs = Math.round(1000 / selectedSpeed)

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
            handleQualifyingStageCompleted(res.nextState.stageId)
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

  // Conclusão oficial de fase de qualificação
  const handleQualifyingStageCompleted = (stageId: QualifyingStageId) => {
    if (!season?.id) return
    const currentStored = readStoredCompletedSessions(season.id, currentRound)
    let updated = currentStored
    if (!currentStored.includes(stageId)) {
      updated = [...currentStored, stageId]
      writeStoredCompletedSessions(season.id, currentRound, updated)
      setCompletedSessions(updated)
    }

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
        const fullGrid = canonicalQualifyingPersistenceService.buildCombinedFinalGrid({
          seasonId: season.id,
          round: currentRound,
          q1Result: q1Res,
          q2Result: q2Res,
          q3Result: q3Res,
        })
        setCompleteQualifyingResult(fullGrid)
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
    } else {
      toast({
        title: `Fase ${stageId.toUpperCase()} Concluída`,
        description: `Eliminações e classificação oficial registradas. Próxima etapa disponível.`,
      })
    }
  }

  // Controles: +1 MIN / +5 MIN (Treino Livre ou Qualificação)
  const handleAdvanceStep = (minutes: 1 | 5) => {
    const isQuali =
      selectedSessionId === 'q1' || selectedSessionId === 'q2' || selectedSessionId === 'q3'

    if (isQuali) {
      if (!qualifyingState || !qualifyingTickContext) return
      const stored = refreshCompletedSessions()
      if (qualifyingState.status === 'completed' || stored.includes(qualifyingState.stageId)) {
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
        qualifyingState,
        seconds,
        qualifyingTickContext,
      )
      setQualifyingState(res.nextState)

      if (season?.id) {
        const refreshed = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
          seasonId: season.id,
          round: currentRound,
          driverIds: [qualifyingState.cars.car1.driverId, qualifyingState.cars.car2.driverId],
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
  const handleSimulateRemaining = () => {
    const isQuali =
      selectedSessionId === 'q1' || selectedSessionId === 'q2' || selectedSessionId === 'q3'

    if (isQuali) {
      if (!qualifyingState || !qualifyingTickContext) return
      const stored = refreshCompletedSessions()
      if (qualifyingState.status === 'completed' || stored.includes(qualifyingState.stageId)) {
        toast({
          variant: 'destructive',
          title: 'Sessão Concluída',
          description: 'Não é permitido executar novamente uma fase oficialmente concluída.',
        })
        return
      }
      setIsAutoAdvancing(false)

      const res = CanonicalQualifyingRunner.simulateRemainingSession(
        qualifyingState,
        qualifyingTickContext,
      )
      setQualifyingState(res.nextState)

      if (season?.id) {
        const refreshed = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
          seasonId: season.id,
          round: currentRound,
          driverIds: [qualifyingState.cars.car1.driverId, qualifyingState.cars.car2.driverId],
        })
        setTyreInventories(refreshed)
      }

      handleQualifyingStageCompleted(res.nextState.stageId)

      toast({
        title: `Restante do ${qualifyingState.stageId.toUpperCase()} Simulado com Sucesso!`,
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
    const isQuali =
      selectedSessionId === 'q1' || selectedSessionId === 'q2' || selectedSessionId === 'q3'

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
    const isQuali =
      selectedSessionId === 'q1' || selectedSessionId === 'q2' || selectedSessionId === 'q3'

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

  // Reacerto de Carro na garagem
  const handleApplyCarSetup = (carId: 'car1' | 'car2', newSetup: PracticeCarLiveState['setup']) => {
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

  // Troca de Pneus na Garagem (Treino ou Qualificação)
  const handleSelectTyreSet = (carId: 'car1' | 'car2', tyreSetId: string) => {
    const isQuali =
      selectedSessionId === 'q1' || selectedSessionId === 'q2' || selectedSessionId === 'q3'

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

    targetCar.currentTyreSetId = selectedSet.id
    targetCar.currentCompound = selectedSet.compound
    targetCar.tyreWear = selectedSet.wear || 0

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
        initialSessionId === 'q3'
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
            <Link to="/race">Voltar ao painel anterior</Link>
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

  const isQualifyingSession =
    selectedSessionDef.id === 'q1' ||
    selectedSessionDef.id === 'q2' ||
    selectedSessionDef.id === 'q3'

  const isRaceSession = selectedSessionDef.id === 'race'

  return (
    <div className="space-y-6 pb-12">
      {/* 1. CABEÇALHO PADRÃO APEX GP MANAGER */}
      <PageHeader
        title="CORRIDA"
        description="Gestão completa do fim de semana de Grande Prêmio: treinos, classificação e corrida."
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
      <RaceWeekendPipelineBar
        sessions={pipeline}
        selectedSessionId={selectedSessionId}
        completedSessions={completedSessions}
        isSessionRunning={isAutoAdvancing}
        isSessionPaused={
          isQualifyingSession
            ? qualifyingState?.status === 'paused'
            : sessionState?.status === 'paused'
        }
        onSelectSession={handleSelectSessionFromSchedule}
      />

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

            {/* CARDS DOS DOIS CARROS (CARRO 1 E CARRO 2) */}
            {pCar1 && pCar2 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PracticeCarCockpitCard
                  car={sessionState.cars.car1}
                  carNumber={1}
                  teamColor={team?.color || '#E10600'}
                  knowledge={sessionState.knowledge}
                  latestFeedback={
                    sessionState.feedbacks?.filter((f) => f.carId === 'car1').slice(-1)[0]
                  }
                  hasUnreadFeedback={sessionState.unreadFeedbackCarIds?.includes('car1')}
                  isSessionRunning={sessionState.status === 'running' || isAutoAdvancing}
                  isSessionCompleted={sessionState.status === 'completed'}
                  onOrderExitTrack={() => handleOrderExit('car1')}
                  onRequestBox={() => handleRequestBox('car1')}
                  onMarkFeedbackRead={() => {
                    sessionState.unreadFeedbackCarIds = (
                      sessionState.unreadFeedbackCarIds || []
                    ).filter((id) => id !== 'car1')
                    setSessionState({ ...sessionState })
                  }}
                  isRookie={selectedSessionId === 'tp1' && !!activeRookieCar1}
                  originalDriverName={pCar1?.driverName}
                  canToggleRookie={selectedSessionId === 'tp1'}
                  onOpenRookieSelector={() => setRookieSelectorModalCarId('car1')}
                  onRestoreTitular={() => handleClearRookieAssignment('car1')}
                />

                <PracticeCarCockpitCard
                  car={sessionState.cars.car2}
                  carNumber={2}
                  teamColor={team?.color || '#E10600'}
                  knowledge={sessionState.knowledge}
                  latestFeedback={
                    sessionState.feedbacks?.filter((f) => f.carId === 'car2').slice(-1)[0]
                  }
                  hasUnreadFeedback={sessionState.unreadFeedbackCarIds?.includes('car2')}
                  isSessionRunning={sessionState.status === 'running' || isAutoAdvancing}
                  isSessionCompleted={sessionState.status === 'completed'}
                  onOrderExitTrack={() => handleOrderExit('car2')}
                  onRequestBox={() => handleRequestBox('car2')}
                  onMarkFeedbackRead={() => {
                    sessionState.unreadFeedbackCarIds = (
                      sessionState.unreadFeedbackCarIds || []
                    ).filter((id) => id !== 'car2')
                    setSessionState({ ...sessionState })
                  }}
                  isRookie={selectedSessionId === 'tp1' && !!activeRookieCar2}
                  originalDriverName={pCar2?.driverName}
                  canToggleRookie={selectedSessionId === 'tp1'}
                  onOpenRookieSelector={() => setRookieSelectorModalCarId('car2')}
                  onRestoreTitular={() => handleClearRookieAssignment('car2')}
                />
              </div>
            )}

            {/* ESTOQUE DE PNEUS DO FIM DE SEMANA */}
            {activeCarForTyres && (
              <TyreInventoryPanel
                carNumber={activeTyresCarId === 'car1' ? 1 : 2}
                driverName={activeCarForTyres.driverName}
                driverId={activeCarForTyres.driverId}
                tyres={activeTyresList}
                currentTyreSetId={sessionState.cars[activeTyresCarId].currentTyreSetId}
                isSessionRunning={sessionState.status === 'running' || isAutoAdvancing}
                isCarInGarage={sessionState.cars[activeTyresCarId].status === 'garage'}
                onSelectTyreSet={(setId) => handleSelectTyreSet(activeTyresCarId, setId)}
              />
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
        // RENDERIZAÇÃO CANÔNICA DE QUALIFICAÇÃO (Q1, Q2, Q3)
        // Sessão real com carros na pista, consumo de pneus, desempate e eliminação
        !completedSessions.includes('tp2') ? (
          <SessionPlaceholderCard
            session={selectedSessionDef}
            isLocked={true}
            isPendingDevelopment={false}
          />
        ) : selectedSessionDef.id === 'q2' && !completedSessions.includes('q1') ? (
          <SessionPlaceholderCard
            session={selectedSessionDef}
            isLocked={true}
            isPendingDevelopment={false}
          />
        ) : selectedSessionDef.id === 'q3' && !completedSessions.includes('q2') ? (
          <SessionPlaceholderCard
            session={selectedSessionDef}
            isLocked={true}
            isPendingDevelopment={false}
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

            {/* COCKPIT DOS DOIS CARROS DO JOGADOR (CARRO 1 E CARRO 2) */}
            {pCar1 && pCar2 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <QualifyingCarCockpitCard
                  car={qualifyingState.cars.car1}
                  carNumber={1}
                  teamColor={team?.color || '#E10600'}
                  isSessionRunning={qualifyingState.status === 'running' || isAutoAdvancing}
                  isSessionCompleted={qualifyingState.status === 'completed'}
                  onOrderExitTrack={() => handleOrderExit('car1')}
                  onRequestBox={() => handleRequestBox('car1')}
                />

                <QualifyingCarCockpitCard
                  car={qualifyingState.cars.car2}
                  carNumber={2}
                  teamColor={team?.color || '#E10600'}
                  isSessionRunning={qualifyingState.status === 'running' || isAutoAdvancing}
                  isSessionCompleted={qualifyingState.status === 'completed'}
                  onOrderExitTrack={() => handleOrderExit('car2')}
                  onRequestBox={() => handleRequestBox('car2')}
                />
              </div>
            )}

            {/* ESTOQUE REAL DE PNEUS DO FIM DE SEMANA (MESMO INVENTÁRIO HERDADO) */}
            {activeCarForTyres && (
              <TyreInventoryPanel
                carNumber={activeTyresCarId === 'car1' ? 1 : 2}
                driverName={activeCarForTyres.driverName}
                driverId={activeCarForTyres.driverId}
                tyres={activeTyresList}
                currentTyreSetId={qualifyingState.cars[activeTyresCarId].currentTyreSetId}
                isSessionRunning={qualifyingState.status === 'running' || isAutoAdvancing}
                isCarInGarage={qualifyingState.cars[activeTyresCarId].status === 'garage'}
                onSelectTyreSet={(setId) => handleSelectTyreSet(activeTyresCarId, setId)}
              />
            )}

            {/* TABELA DE CLASSIFICAÇÃO AO VIVO COM LINHA DE CORTE E LOGOS REDUZIDOS */}
            <QualifyingLeaderboardTable
              stageId={qualifyingState.stageId}
              entries={qualifyingState.leaderboard}
              playerTeamName={team?.name}
              playerTeamColor={team?.color}
            />
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
                  const res =
                    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(
                      officialRaceResult,
                    )
                  setCareerPersistenceStatus(res.journal.status)
                  setIsPersistingCareer(false)
                  if (res.success) {
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
            />
          </div>
        ) : canonicalRaceState ? (
          <CanonicalRaceInitializationPanel
            raceState={canonicalRaceState}
            hasOfficialResult={!!officialRaceResult}
            onResetGrid={() => setCanonicalRaceState(null)}
            onOfficializeRace={() => {
              try {
                const official = canonicalRaceResultService.officializeRace(canonicalRaceState)
                setOfficialRaceResult(official)
                toast({
                  title: 'Corrida Oficializada com Sucesso',
                  description:
                    'O resultado oficial imutável foi homologado. Registrando na carreira...',
                })
                // Persistência automática pós-oficialização canônica e idempotente
                try {
                  setIsPersistingCareer(true)
                  setCareerPersistenceStatus('APPLYING')
                  const res =
                    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
                  setCareerPersistenceStatus(res.journal.status)
                  setIsPersistingCareer(false)
                  if (res.success) {
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
                const nextState = raceStrategyService.cancelPitRequest(canonicalRaceState, driverId)
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
            onAdvanceOneLap={(opts) => {
              try {
                const nextState = canonicalRaceEngineService.advanceOneLap(canonicalRaceState, opts)
                setCanonicalRaceState(nextState)
              } catch (e: any) {
                toast({
                  variant: 'destructive',
                  title: 'Erro ao avançar volta',
                  description: e?.message || 'Falha na execução do Race Engine.',
                })
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
                if (
                  canonicalRaceResultService.hasOfficialRaceResult(
                    team.id,
                    season.year || 2026,
                    currentRound,
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
                  team.id,
                  season.year || 2026,
                  currentRound,
                )
                if (!clearRes.success) {
                  toast({
                    variant: 'destructive',
                    title: 'Não é possível reiniciar',
                    description: clearRes.blockedReason,
                  })
                  return
                }
                const freshRace =
                  canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
                    careerId: team.id,
                    season: season.year || 2026,
                    round: currentRound,
                    circuitName: gpInfo.circuit,
                    circuitCountry: gpInfo.country,
                    totalLaps: gpInfo.laps || 57,
                    playerTeamId: team.id,
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
        ) : (
          <CompleteQualifyingGridSummary
            result={completeQualifyingResult}
            onGoToRace={() => {
              try {
                if (!team?.id || !season?.id) return
                const initialRace =
                  canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
                    careerId: team.id,
                    season: season.year || 2026,
                    round: currentRound,
                    circuitName: gpInfo.circuit,
                    circuitCountry: gpInfo.country,
                    totalLaps: gpInfo.laps || 57,
                    playerTeamId: team.id,
                    canonicalQualifyingGrid: completeQualifyingResult.finalGrid,
                  })
                setCanonicalRaceState(initialRace)
                toast({
                  title: 'Corrida V2 Inicializada',
                  description:
                    'Grid oficial P1–P24 consumido. Estado canônico da prova homologado com sucesso.',
                })
              } catch (e: any) {
                toast({
                  variant: 'destructive',
                  title: 'Falha na Inicialização da Corrida',
                  description: e?.message || 'Erro ao inicializar estado canônico da corrida.',
                })
              }
            }}
          />
        )
      ) : (
        // RENDERIZAÇÃO DOS PLACEHOLDERS (CORRIDA BLOQUEADA ATÉ Q3)
        <SessionPlaceholderCard
          session={selectedSessionDef}
          isLocked={
            selectedSessionDef.id === 'race'
              ? !completedSessions.includes('q3') && !completedSessions.includes('qualifying')
              : selectedSessionDef.id === 'q1'
                ? !completedSessions.includes('tp2')
                : !completedSessions.includes(selectedSessionDef.id)
          }
          isPendingDevelopment={false}
        />
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
                    {options.eligible.map((rk) => (
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
                            {rk.reason}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (targetOriginal) {
                              handleAssignRookie(rookieSelectorModalCarId, rk, targetOriginal)
                            }
                            setRookieSelectorModalCarId(null)
                          }}
                          className="h-8 px-3 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Escalar
                        </Button>
                      </div>
                    ))}
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
