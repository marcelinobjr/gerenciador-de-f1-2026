import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Pause,
  RefreshCw,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Trophy,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { raceSessionService } from '@/services/raceSessionService'
import { practiceSessionService } from '@/services/practiceSessionService'
import {
  canonicalPreparationInformedService,
  type PreparationInformedPackage,
} from '@/services/canonicalPreparationInformedService'
import { advanceCanonicalRaceLap } from '@/services/canonicalRaceRunner'
import { f1Service } from '@/services/f1Service'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { toast } from '@/hooks/use-toast'
import type { SimDriverEntry } from '@/pages/race/types'
import type { LiveRaceEvent } from '@/types/race-events'
import type { LapRecord } from '@/components/race/LiveStandingsTable'
import type { TireCompound, TireAllotment, TireSetItem } from '@/types/f1'
import type { WeekendTyreKnowledge } from '@/types/practice-tyres'
import type { TrackWeatherState } from '@/lib/f1-tire-system'
import type {
  RaceSessionRecord,
  RaceSessionStatus,
  RaceSessionCheckpointData,
  RacePendingDecision,
  RaceResolvedDecision,
} from '@/types/race-session'
import { RaceOperationsCockpit, type LiveTacticalMode } from '@/pages/race/RaceOperationsCockpit'
import type { LivePaceOrder } from '@/components/race/LiveTelemetryTable'
import { DecisionModals } from '@/components/race/DecisionModals'
import { PitWallRadioDialog } from '@/components/race/PitWallRadioDialog'
import { RaceResultsTable } from '@/components/race/RaceResultsTable'
import { advanceRound } from '@/pages/race/raceAdvance'
import {
  calculatePitStopDuration,
  formatTireName,
  createInitialTireInventory,
} from '@/lib/f1-tire-system'
import { buildCanonicalEventGrid } from '@/lib/canonical-race-grid-resolver'

export default function LiveRacePage() {
  const navigate = useNavigate()
  const { team, season } = useUnifiedSeason()
  const { user, refreshTeamAndSeason } = useAuth()
  const [drivers, setDrivers] = useState<any[]>([])
  const [parts, setParts] = useState<any[]>([])
  const [sponsors, setSponsors] = useState<any[]>([])
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [inconsistentSession, setInconsistentSession] = useState<{
    sessionId: string
    participantsCount: number
    expectedParticipants: number
    currentLap: number
    status: string
  } | null>(null)
  const [retryCounter, setRetryCounter] = useState(0)

  // ETAPA 4D.2: Conhecimento herdado dos treinos livres e estoque canônico
  const [inheritedTyreKnowledge, setInheritedTyreKnowledge] = useState<WeekendTyreKnowledge | null>(
    null,
  )
  const [informedPackage, setInformedPackage] = useState<PreparationInformedPackage | null>(null)
  const [driverTireInventories, setDriverTireInventories] = useState<Record<string, TireSetItem[]>>(
    {},
  )

  useEffect(() => {
    if (!team?.id) return
    let isMounted = true

    Promise.all([
      f1Service.getTeamDrivers(team.id),
      f1Service.getTeamParts(team.id),
      f1Service.getTeamSponsors(team.id),
    ])
      .then(([d, p, s]) => {
        if (!isMounted) return
        setDrivers(d || [])
        setParts(p || [])
        setSponsors(s || [])
      })
      .catch((err) => {
        if (!isMounted) return
        console.error('[LiveRacePage] Erro ao carregar dados do time:', err)
        setInitError(err?.message || 'Falha ao carregar dados da equipe e pilotos.')
        setIsLoadingSession(false)
      })

    return () => {
      isMounted = false
    }
  }, [team?.id, retryCounter])

  const currentRound = season?.current_round || 1
  const totalRounds = season?.total_rounds || 24
  const gpInfo =
    F1_2026_CALENDAR[Math.min(currentRound - 1, F1_2026_CALENDAR.length - 1)] || F1_2026_CALENDAR[0]

  // Identificador exclusivo desta aba/executor (sobrevive a re-renders, diferente entre abas)
  const [executorId] = useState(
    () => `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  )

  // Estado da sessão compartilhada
  const [sessionRecord, setSessionRecord] = useState<RaceSessionRecord | null>(null)
  const [sessionStatus, setSessionStatus] = useState<RaceSessionStatus>('not_started')
  const [revision, setRevision] = useState(1)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executorConflictMessage, setExecutorConflictMessage] = useState<string | null>(null)

  // Status visual de sincronização
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)

  // Estado esportivo ao vivo
  const [currentLap, setCurrentLap] = useState(1)
  const [totalLaps, setTotalLaps] = useState(gpInfo.laps)
  const [weather, setWeather] = useState<TrackWeatherState>('seco')
  const [grid, setGrid] = useState<SimDriverEntry[]>([])
  const [lapHistory, setLapHistory] = useState<Record<string, LapRecord[]>>({})
  const [liveEvents, setLiveEvents] = useState<LiveRaceEvent[]>([])
  const [simSpeed, setSimSpeed] = useState<number>(1)
  const [isRacePaused, setIsRacePaused] = useState(true)
  const [pauseReason, setPauseReason] = useState<string | null>(null)

  // Táticas e ordens
  const [playerCarTactics, setPlayerCarTactics] = useState<Record<string, LiveTacticalMode>>({})
  const [playerPaceOrders, setPlayerPaceOrders] = useState<Record<string, LivePaceOrder>>({})
  const [mechanicalIssues, setMechanicalIssues] = useState<any[]>([])
  const [penalties, setPenalties] = useState<any[]>([])
  const [redFlagState, setRedFlagState] = useState({
    active: false,
    ticksFrozen: 0,
    usedThisRace: false,
    safetyCarLapsRemaining: 0,
  })

  // Finalização oficial
  const [isFinishing, setIsFinishing] = useState(false)
  const [isRaceFinished, setIsRaceFinished] = useState(false)
  const [raceResults, setRaceResults] = useState<SimDriverEntry[] | null>(null)

  // Etapa 2: Decisões persistentes, fila de decisões e histórico de resoluções
  const [pendingDecisions, setPendingDecisions] = useState<RacePendingDecision[]>([])
  const [resolvedDecisions, setResolvedDecisions] = useState<RaceResolvedDecision[]>([])
  const [isResolvingDecision, setIsResolvingDecision] = useState(false)
  const [selectedPitCompound, setSelectedPitCompound] = useState<TireCompound>('medio')

  // Modais de apoio
  const [forcePitModalOpen, setForcePitModalOpen] = useState(false)
  const [forcePitSelectedDriverId, setForcePitSelectedDriverId] = useState('')
  const [pitWallRadioOpen, setPitWallRadioOpen] = useState(false)
  const [pitWallRadioDriverId, setPitWallRadioDriverId] = useState('')

  // Refs de controle de loop e sincronização
  const timerRef = useRef<any>(null)
  const heartbeatTimerRef = useRef<any>(null)
  const isSavingRef = useRef(false)
  const pendingSaveRef = useRef<boolean>(false)

  // 1. GATE DE INICIALIZAÇÃO E RETOMADA DA SESSÃO CANÔNICA
  useEffect(() => {
    if (!season?.id || !team?.id || !user?.id) return

    // GATE: Não inicializar nem criar sessão se os dados essenciais da equipe ainda não resolveram
    if (drivers.length === 0) {
      return
    }

    let isMounted = true
    setIsLoadingSession(true)
    setInitError(null)

    async function initSession() {
      try {
        // 1.1 Validar pré-requisitos canônicos da equipe do jogador
        const titularDrivers = drivers.filter(
          (d) => d.team_id === team!.id && (d.role === 'titular' || !d.role),
        )

        if (titularDrivers.length < 2) {
          throw new Error(
            `A equipe ${team!.name} possui apenas ${titularDrivers.length} piloto(s) titular(es) inscrito(s). São obrigatórios 2 titulares para o grid do evento.`,
          )
        }

        // 1.1.b ETAPA 4D.2: Carregar conhecimento aprendido nos treinos livres e estoque de pneus
        try {
          const inherited = await practiceSessionService.resolveInheritedWeekendKnowledge(
            team!.id,
            season!.id,
            currentRound,
          )
          if (isMounted && inherited) {
            setInheritedTyreKnowledge(inherited.tyreKnowledge || null)
            const pkg = canonicalPreparationInformedService.buildPreparationInformedPackage({
              inheritedKnowledge: inherited,
              currentRound,
              circuitKey: gpInfo.circuit,
              sessionType: 'race',
            })
            setInformedPackage(pkg)
          }
        } catch (e) {
          console.warn('[LiveRacePage] Falha ao herdar conhecimento de treinos:', e)
        }

        // Inicializar inventários de pneus para os pilotos titulares
        const initialInventories: Record<string, TireSetItem[]> = {}
        titularDrivers.forEach((d) => {
          initialInventories[d.id] = createInitialTireInventory(d.id)
        })
        setDriverTireInventories(initialInventories)

        // 1.2 Verificar se já existe uma sessão persistida no PocketBase
        const existingSession = await raceSessionService.getSession({
          seasonId: season!.id,
          teamId: team!.id,
          round: currentRound,
          sessionType: 'race',
        })

        if (!isMounted) return

        if (existingSession) {
          // Validação de sessão salva: verificar se há consistência no grid
          const savedGrid = existingSession.checkpoint_data?.grid || []

          // DETECÇÃO DE SESSÃO INCONSISTENTE: sessão gravada com dados parciais (ex: fixture de 3 pilotos quando o evento exige 24)
          if (
            existingSession.status !== 'not_started' &&
            savedGrid.length > 0 &&
            savedGrid.length < 24
          ) {
            console.warn('[LiveRacePage] Sessão inconsistente detectada:', {
              sessionId: existingSession.id,
              participantsCount: savedGrid.length,
              expected: 24,
              currentLap: existingSession.current_lap,
              status: existingSession.status,
            })
            setInconsistentSession({
              sessionId: existingSession.id,
              participantsCount: savedGrid.length,
              expectedParticipants: 24,
              currentLap: existingSession.current_lap,
              status: existingSession.status,
            })
            setSessionRecord(existingSession)
            setIsLoadingSession(false)
            return
          }

          // Retomada válida de sessão persistida
          setSessionRecord(existingSession)
          setSessionStatus(existingSession.status)
          setRevision(existingSession.revision || 1)
          setTotalLaps(existingSession.total_laps || gpInfo.laps)

          if (existingSession.status === 'completed') {
            setIsRaceFinished(true)
            if (savedGrid.length > 0) {
              setGrid(savedGrid)
              setRaceResults(savedGrid)
            }
            setIsLoadingSession(false)
            return
          }

          if (existingSession.checkpoint_data && savedGrid.length >= 24) {
            const cp = existingSession.checkpoint_data
            setCurrentLap(existingSession.current_lap || cp.currentLap || 1)
            setGrid(savedGrid)
            setWeather(cp.weather || 'seco')
            setLiveEvents(cp.liveEvents || [])
            setPlayerCarTactics(cp.playerCarTactics || {})
            setPlayerPaceOrders(cp.playerPaceOrders || {})
            setMechanicalIssues(cp.mechanicalIssues || [])
            setPenalties(cp.penalties || [])
            if (cp.redFlagState) setRedFlagState(cp.redFlagState)
            if (existingSession.lap_history) setLapHistory(existingSession.lap_history)
            if (cp.pendingDecisions) setPendingDecisions(cp.pendingDecisions)
            if (cp.resolvedDecisions) setResolvedDecisions(cp.resolvedDecisions)

            const hasBlockingDecisions = (cp.pendingDecisions?.length || 0) > 0
            setIsRacePaused(
              existingSession.status === 'paused' ||
                existingSession.status === 'awaiting_decision' ||
                hasBlockingDecisions,
            )
            setPauseReason(
              existingSession.pause_reason ||
                (hasBlockingDecisions ? 'Decisão Obrigatória Pendente' : null),
            )
            setSimSpeed(existingSession.sim_speed || 1)

            toast({
              title: 'Sessão Retomada com Sucesso',
              description: `Corrida da Rodada ${currentRound} carregada a partir da volta ${existingSession.current_lap}. Grid preservado (${savedGrid.length} carros).`,
            })
            setIsLoadingSession(false)
            return
          }
        }

        // 1.3 Se a sessão não existe ou não tem checkpoint, construir o grid canônico de 24 inscritos
        const canonicalResult = buildCanonicalEventGrid({
          team: team!,
          playerDrivers: drivers,
          currentRound,
          totalLaps: gpInfo.laps,
          gpName: gpInfo.name,
          circuitName: gpInfo.circuit,
          tireAbrasiveness: gpInfo.tireAbrasiveness || 6,
        })

        if (!canonicalResult.success || canonicalResult.grid.length !== 24) {
          throw new Error(
            canonicalResult.missingRequirements?.join('; ') ||
              `Grid canônico incompleto: ${canonicalResult.grid.length} de 24 inscritos esperados.`,
          )
        }

        const initialGrid = canonicalResult.grid

        // Configurar táticas e ordens iniciais dos pilotos do jogador
        const initialTactics: Record<string, LiveTacticalMode> = {}
        const initialPace: Record<string, LivePaceOrder> = {}
        titularDrivers.forEach((d) => {
          initialTactics[d.id] = 'normal'
          initialPace[d.id] = 'normal'
        })
        setPlayerCarTactics(initialTactics)
        setPlayerPaceOrders(initialPace)
        setGrid(initialGrid)

        const initialEvents: LiveRaceEvent[] = [
          {
            id: `ev_init_${Date.now()}`,
            lap: 1,
            type: 'overtake',
            message: `🟢 Grid oficial homologado montado para o ${gpInfo.name}. 24 pilotos alinhados.`,
            timestamp: new Date().toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          },
        ]
        setLiveEvents(initialEvents)

        // 1.4 Criar ou retomar sessão no PocketBase passando o grid canônico completo nos dados iniciais
        const { session, isResumed } = await raceSessionService.openOrResumeRaceSession({
          seasonId: season!.id,
          teamId: team!.id,
          userId: user!.id,
          seasonYear: season!.year || 2026,
          round: currentRound,
          sessionType: 'race',
          totalLaps: gpInfo.laps,
          initialData: {
            grid: initialGrid,
            currentLap: 1,
            totalLaps: gpInfo.laps,
            weather: 'seco',
            liveEvents: initialEvents,
            playerCarTactics: initialTactics,
            playerPaceOrders: initialPace,
            mechanicalIssues: [],
            penalties: [],
            lastSavedAt: new Date().toISOString(),
          },
        })

        if (!isMounted) return
        setSessionRecord(session)
        setSessionStatus(session.status)
        setRevision(session.revision || 1)
        setTotalLaps(session.total_laps || gpInfo.laps)

        // Se porventura já existia checkpoint válido na sessão retomada
        if (
          isResumed &&
          session.checkpoint_data?.grid &&
          session.checkpoint_data.grid.length >= 24
        ) {
          setGrid(session.checkpoint_data.grid)
          setCurrentLap(session.current_lap || 1)
        }

        setIsLoadingSession(false)
      } catch (err: any) {
        if (!isMounted) return
        console.error('[LiveRacePage] Erro ao inicializar sessão:', err)
        setInitError(err?.message || 'Falha ao acessar os dados da corrida.')
        setIsLoadingSession(false)
        toast({
          variant: 'destructive',
          title: 'Erro ao inicializar sessão',
          description: err?.message || 'Falha ao acessar os dados da corrida.',
        })
      }
    }

    initSession()

    return () => {
      isMounted = false
    }
  }, [season?.id, team?.id, user?.id, currentRound, drivers, retryCounter])

  // 2. ADQUIRIR / RENOVAR TRAVA DE EXECUTOR ÚNICO
  const handleTryAcquireLock = async (): Promise<boolean> => {
    if (!sessionRecord) return false
    const res = await raceSessionService.acquireExecutionLock(sessionRecord.id, executorId)
    if (res.acquired) {
      setIsExecuting(true)
      setExecutorConflictMessage(null)
      return true
    } else {
      setIsExecuting(false)
      setExecutorConflictMessage(
        `Outra aba/dispositivo (${res.currentExecutorId || 'desconhecido'}) está executando esta sessão. Para evitar divergência de save, a execução está bloqueada nesta janela.`,
      )
      setIsRacePaused(true)
      return false
    }
  }

  // Heartbeat do lock
  useEffect(() => {
    if (!isExecuting || !sessionRecord) return
    heartbeatTimerRef.current = setInterval(() => {
      raceSessionService.renewExecutionLock(sessionRecord.id, executorId).then((ok) => {
        if (!ok) {
          setIsExecuting(false)
          setIsRacePaused(true)
          setExecutorConflictMessage(
            'A concessão de execução exclusiva expirou ou foi reivindicada.',
          )
        }
      })
    }, 10000)

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
    }
  }, [isExecuting, sessionRecord, executorId])

  // Libera lock ao desmontar
  useEffect(() => {
    return () => {
      if (sessionRecord?.id) {
        raceSessionService.releaseExecutionLock(sessionRecord.id, executorId)
      }
    }
  }, [sessionRecord?.id, executorId])

  // 3. PERSISTÊNCIA ATÔMICA DE CHECKPOINT
  const triggerSaveCheckpoint = useCallback(
    async (
      reasonStr?: string,
      forceStatus?: RaceSessionStatus,
      extraCheckpointPatch?: Partial<RaceSessionCheckpointData>,
    ) => {
      if (!sessionRecord || isSavingRef.current) {
        pendingSaveRef.current = true
        return
      }

      isSavingRef.current = true
      setSyncState('saving')
      setSyncError(null)

      try {
        const hasDecisions =
          (extraCheckpointPatch?.pendingDecisions?.length ?? pendingDecisions.length) > 0

        const statusToSave: RaceSessionStatus =
          forceStatus ||
          (isRaceFinished
            ? 'completed'
            : hasDecisions
              ? 'awaiting_decision'
              : isRacePaused
                ? 'paused'
                : 'in_progress')

        const res = await raceSessionService.saveCheckpoint({
          sessionId: sessionRecord.id,
          executorId,
          expectedRevision: revision,
          status: statusToSave,
          currentLap,
          simSpeed,
          pauseReason: reasonStr || pauseReason || undefined,
          checkpointData: {
            grid: extraCheckpointPatch?.grid || grid,
            currentLap: extraCheckpointPatch?.currentLap || currentLap,
            totalLaps,
            weather,
            liveEvents: (extraCheckpointPatch?.liveEvents || liveEvents).slice(0, 40),
            playerCarTactics,
            playerPaceOrders,
            mechanicalIssues,
            penalties,
            redFlagState,
            pendingDecisions:
              extraCheckpointPatch?.pendingDecisions !== undefined
                ? extraCheckpointPatch.pendingDecisions
                : pendingDecisions,
            resolvedDecisions:
              extraCheckpointPatch?.resolvedDecisions !== undefined
                ? extraCheckpointPatch.resolvedDecisions
                : resolvedDecisions,
            lastSavedAt: new Date().toISOString(),
          },
          lapHistory,
        })

        if (res.success) {
          setRevision(res.newRevision)
          setSyncState('saved')
          setSessionStatus(statusToSave)
        } else {
          setSyncState('error')
          setSyncError(res.error || 'Falha ao sincronizar checkpoint.')
          // Em falha de gravação: pausar corrida para evitar avanço desincronizado
          setIsRacePaused(true)
          toast({
            variant: 'destructive',
            title: 'Sincronização Pausada',
            description: res.error || 'Não foi possível gravar o checkpoint no PocketBase.',
          })
        }
      } catch (err: any) {
        setSyncState('error')
        setSyncError(err?.message || 'Erro de rede na persistência.')
        setIsRacePaused(true)
      } finally {
        isSavingRef.current = false
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false
          triggerSaveCheckpoint(reasonStr, forceStatus)
        }
      }
    },
    [
      sessionRecord,
      executorId,
      revision,
      isRaceFinished,
      isRacePaused,
      currentLap,
      simSpeed,
      pauseReason,
      grid,
      totalLaps,
      weather,
      liveEvents,
      playerCarTactics,
      playerPaceOrders,
      mechanicalIssues,
      penalties,
      redFlagState,
      lapHistory,
    ],
  )

  // 4. LOOP DE EXECUÇÃO DA CORRIDA COM PLAY/PAUSE/1x/2x/4x
  useEffect(() => {
    // REGRA 9 & 4: Se houver pendingDecision != null ou isRacePaused, não avança
    if (isRacePaused || !isExecuting || isRaceFinished || pendingDecisions.length > 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const intervalMs = Math.round(5000 / simSpeed)

    timerRef.current = setInterval(() => {
      if (currentLap >= totalLaps) {
        if (timerRef.current) clearInterval(timerRef.current)
        setIsRaceFinished(true)
        setIsRacePaused(true)
        handleFinishRace()
        return
      }

      // Executa avanço da volta pelo runner canônico com proteção anti-loop e conhecimento 4D.2
      const res = advanceCanonicalRaceLap({
        currentLap,
        totalLaps,
        grid,
        weather,
        round: currentRound,
        gpName: gpInfo.name,
        circuitName: gpInfo.circuit,
        tireAbrasiveness: gpInfo.tireAbrasiveness || 6,
        team,
        playerCarTactics,
        playerPaceOrders,
        mechanicalIssues,
        redFlagState,
        lapHistory,
        sessionId: sessionRecord?.id,
        existingPendingDecisions: pendingDecisions,
        resolvedDecisionIds: resolvedDecisions.map((r) => r.eventId),
        tyreKnowledge: inheritedTyreKnowledge,
        driverTireInventories,
      })

      setCurrentLap(res.nextLap)
      setGrid(res.nextGrid)
      setLapHistory(res.nextLapHistory)
      setMechanicalIssues(res.nextMechanicalIssues)
      setRedFlagState(res.nextRedFlagState)
      const combinedEvents =
        res.nextEvents.length > 0 ? [...res.nextEvents, ...liveEvents] : liveEvents
      if (res.nextEvents.length > 0) {
        setLiveEvents(combinedEvents)
      }

      // REGRA 4: Se o runner detectou eventos que exigem decisão:
      // 1) salva pendingDecision; 2) muda status para 'awaiting_decision'; 3) pausa; 4) interrompe avanço
      if (res.requiresPause && res.detectedDecisions.length > 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }

        const newPendingList = [...pendingDecisions, ...res.detectedDecisions]
        setPendingDecisions(newPendingList)
        setIsRacePaused(true)
        setPauseReason(res.pauseReason || 'Decisão Estratégica Obrigatória')

        // Persiste atomicamente no PocketBase com status awaiting_decision
        triggerSaveCheckpoint(res.pauseReason, 'awaiting_decision', {
          grid: res.nextGrid,
          currentLap: res.nextLap,
          liveEvents: combinedEvents,
          pendingDecisions: newPendingList,
        })

        toast({
          title: '⏸️ Corrida Pausada Automaticamente',
          description: `Decisão de pit stop/estratégia necessária na volta ${res.nextLap}.`,
        })

        return
      }

      // Persiste checkpoint a cada volta concluída
      triggerSaveCheckpoint(`Volta ${res.nextLap} concluída`, undefined, {
        grid: res.nextGrid,
        currentLap: res.nextLap,
        liveEvents: combinedEvents,
      })

      if (res.isCompleted) {
        if (timerRef.current) clearInterval(timerRef.current)
        setIsRaceFinished(true)
        setIsRacePaused(true)
        handleFinishRace(res.nextGrid)
      }
    }, intervalMs)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [
    isRacePaused,
    isExecuting,
    isRaceFinished,
    simSpeed,
    currentLap,
    totalLaps,
    grid,
    weather,
    currentRound,
    gpInfo,
    team,
    playerCarTactics,
    playerPaceOrders,
    mechanicalIssues,
    redFlagState,
    lapHistory,
    inheritedTyreKnowledge,
    driverTireInventories,
    triggerSaveCheckpoint,
  ])

  // REGRA 9: Controles de Play/Pause com bloqueio se houver pendingDecision
  const handleTogglePlayPause = async () => {
    if (isRaceFinished) return

    // Se houver decisão pendente, BLOQUEIA o Play
    if (pendingDecisions.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Execução Bloqueada',
        description:
          'Há decisões estratégicas pendentes para os pilotos. Resolva-as antes de retomar a prova.',
      })
      return
    }

    if (isRacePaused) {
      // Quer dar PLAY: precisa antes obter lock exclusivo
      const acquired = await handleTryAcquireLock()
      if (!acquired) return

      setIsRacePaused(false)
      setPauseReason(null)
      triggerSaveCheckpoint('Play acionado', 'in_progress')
    } else {
      // Quer dar PAUSE
      setIsRacePaused(true)
      setPauseReason('Pausado pelo usuário')
      triggerSaveCheckpoint('Pausado pelo usuário', 'paused')
    }
  }

  // ETAPA 2: Resolução Atômica da Decisão Atual na UI
  const handleResolvePendingDecision = async (decisionId: string, choice: string) => {
    if (!sessionRecord || isResolvingDecision) return
    setIsResolvingDecision(true)

    try {
      const res = await raceSessionService.resolveDecision({
        sessionId: sessionRecord.id,
        executorId,
        decisionId,
        choice,
        newCompoundChoice: choice === 'box_now' ? selectedPitCompound : undefined,
      })

      if (res.success && res.updatedSession) {
        setSessionRecord(res.updatedSession)
        setRevision(res.updatedSession.revision)
        setSessionStatus(res.updatedSession.status)
        setPauseReason(res.updatedSession.pause_reason || null)

        const updatedCp = res.updatedSession.checkpoint_data
        if (updatedCp) {
          if (updatedCp.grid) setGrid(updatedCp.grid)
          if (updatedCp.liveEvents) setLiveEvents(updatedCp.liveEvents)
          if (updatedCp.pendingDecisions) setPendingDecisions(updatedCp.pendingDecisions)
          else setPendingDecisions([])
          if (updatedCp.resolvedDecisions) setResolvedDecisions(updatedCp.resolvedDecisions)
        }

        // REGRA 9: Permanece pausada após a resolução para o jogador pressionar Play
        setIsRacePaused(true)

        toast({
          title: 'Decisão Registrada com Sucesso',
          description:
            res.remainingPendingDecisions && res.remainingPendingDecisions.length > 0
              ? 'Decisão gravada. Próxima decisão da fila apresentada.'
              : 'Decisão aplicada e salva. Pressione Play para continuar a prova.',
        })
      } else if (res.alreadyResolved) {
        // REGRA 8: Duplo clique ou outra aba já resolveu
        toast({
          variant: 'destructive',
          title: 'Decisão Já Processada',
          description: res.error || 'Esta ocorrência já foi resolvida anteriormente.',
        })
        setPendingDecisions((prev) => prev.filter((d) => d.id !== decisionId))
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao Resolver Decisão',
          description: res.error || 'Não foi possível gravar a decisão no servidor.',
        })
      }
    } catch (err: any) {
      console.error('[LiveRacePage] Falha ao resolver decisão:', err)
      toast({
        variant: 'destructive',
        title: 'Falha de Comunicação',
        description: err?.message || 'Erro ao processar resolução.',
      })
    } finally {
      setIsResolvingDecision(false)
    }
  }

  // Finalização oficial de prova idempotente
  const handleFinishRace = async (completedGrid?: SimDriverEntry[]) => {
    if (!sessionRecord) return
    const finalGrid = completedGrid || grid
    setRaceResults(finalGrid)
    setIsFinishing(true)

    try {
      await raceSessionService.markSessionCompleted(sessionRecord.id, executorId)
      await triggerSaveCheckpoint('Corrida Concluída', 'completed')
      toast({
        title: '🏁 Grande Prêmio Concluído!',
        description: `Resultado oficial consolidado para o ${gpInfo.name}.`,
      })
    } catch (err) {
      console.error('[LiveRacePage] Erro ao concluir sessão:', err)
    } finally {
      setIsFinishing(false)
    }
  }

  // Avançar Rodada e Contabilidade Oficial Canônica
  const handleAdvanceRound = async () => {
    if (!raceResults || !team || !season) return
    setIsFinishing(true)
    try {
      await advanceRound({
        raceResults,
        team,
        season,
        currentRound,
        totalRounds,
        gpInfo,
        sponsors: sponsors || [],
        drivers: drivers || [],
        parts: parts || [],
        setups: {
          tp1: {},
          tp2: {},
          q1: {},
          q2: {},
          q3: {},
          race: {},
        } as any,
        currentEngine: { costAnnual: 19000000 },
        user,
        hasUsedPreserveMode: false,
        toast,
        navigate,
        refreshTeamAndSeason,
        setSeasonCompleted: () => {},
        setIsProcessingSillySeason: () => {},
        setMarketMoves: () => {},
        setSillySeasonModalOpen: () => {},
        setIsFinishing,
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao avançar rodada',
        description: err?.message || 'Falha ao processar avanço oficial.',
      })
    } finally {
      setIsFinishing(false)
    }
  }

  // Telas de Gate: Carregando, Erro com Retry Seguro, ou Sessão Inconsistente Identificada
  if (isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
        <RefreshCw className="w-8 h-8 text-[#E10600] animate-spin" />
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900">Carregando participantes da sessão</h2>
          <p className="text-xs text-slate-500 max-w-md">
            Validando inscrições da temporada, pilotos titulares e configurações homologadas do grid
            de 24 competidores...
          </p>
        </div>
      </div>
    )
  }

  if (inconsistentSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-xl border border-amber-300 p-8 text-center space-y-4 shadow-sm">
        <AlertTriangle className="w-10 h-10 text-amber-600" />
        <div className="space-y-1 max-w-lg">
          <h2 className="text-lg font-black text-slate-900">
            Sessão inconsistente — composição do grid precisa de revisão.
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            A sessão persistida <code>{inconsistentSession.sessionId}</code> possui apenas{' '}
            <strong className="text-slate-900">
              {inconsistentSession.participantsCount} participantes
            </strong>{' '}
            registrados, quando o regulamento do evento exige 24 inscritos homologados.
          </p>
          <div className="mt-3 p-3 bg-amber-50 rounded-lg text-[11px] font-mono text-amber-900 text-left border border-amber-200">
            <p>
              <strong>ID da Sessão:</strong> {inconsistentSession.sessionId}
            </p>
            <p>
              <strong>Participantes salvos:</strong> {inconsistentSession.participantsCount}
            </p>
            <p>
              <strong>Inscrições esperadas:</strong> {inconsistentSession.expectedParticipants}
            </p>
            <p>
              <strong>Volta salva:</strong> {inconsistentSession.currentLap}
            </p>
            <p>
              <strong>Status:</strong> {inconsistentSession.status}
            </p>
          </div>
          <p className="text-[11px] text-slate-500 pt-2">
            Nenhuma modificação arbitrária foi realizada no save existente para garantir a
            integridade dos dados históricos.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="text-xs font-bold border-slate-300"
          >
            <Link to="/race">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar ao Painel
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => setRetryCounter((c) => c + 1)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    )
  }

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-white rounded-xl border border-red-200 p-8 text-center space-y-4 shadow-sm">
        <AlertTriangle className="w-10 h-10 text-red-600" />
        <div className="space-y-1 max-w-md">
          <h2 className="text-base font-black text-slate-900">Falha na Inicialização da Sessão</h2>
          <p className="text-xs text-red-700 font-medium leading-relaxed">{initError}</p>
          <p className="text-[11px] text-slate-500 pt-1">
            Nenhuma sessão parcial ou fictícia foi gerada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="text-xs font-bold border-slate-300"
          >
            <Link to="/race">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar ao Painel
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={() => setRetryCounter((c) => c + 1)}
            className="bg-[#E10600] hover:bg-[#C10500] text-white font-bold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* 1. CABEÇALHO COMPACTO DE CORRIDA — PIT WALL & RACE CONTROL (ANEXO A) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Lado Esquerdo: Identificação do GP, Circuito e Rodada */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-black text-[10px] tracking-wider uppercase bg-[#E10600] text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                CORRIDA AO VIVO
              </span>
              <span className="font-mono text-xs text-slate-500 font-bold">
                TEMPORADA {season?.year || 2026} · RODADA {currentRound}/{totalRounds}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-slate-300 text-slate-700 bg-slate-50"
              >
                {gpInfo.circuit}
              </Badge>
              {weather && (
                <span className="text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {weather === 'seco'
                    ? '☀️ Pista Seca'
                    : weather === 'chuva_fraca'
                      ? '🌦️ Chuva Fraca'
                      : weather === 'chuva_forte'
                        ? '🌧️ Chuva Forte'
                        : weather}
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                {gpInfo.name}
              </h1>
              <span className="text-xs font-mono font-semibold text-slate-500 hidden sm:inline">
                Volta {currentLap} de {totalLaps}
              </span>
            </div>
          </div>

          {/* Lado Direito: Sincronização e Acesso Auxiliar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status de Sincronização com o Backend */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-medium transition-colors ${
                syncState === 'saving'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : syncState === 'saved'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : syncState === 'error'
                      ? 'bg-red-50 border-red-200 text-red-800 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
              title={syncError ? `Erro: ${syncError}` : undefined}
            >
              {syncState === 'saving' && (
                <>
                  <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />
                  <span>Salvando...</span>
                </>
              )}
              {syncState === 'saved' && (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Sincronizado (v{revision})</span>
                </>
              )}
              {syncState === 'error' && (
                <>
                  <AlertTriangle className="w-3 h-3 text-red-600" />
                  <span>Falha ao salvar</span>
                </>
              )}
              {syncState === 'idle' && (
                <>
                  <Save className="w-3 h-3 text-slate-400" />
                  <span>Pronto</span>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs h-8 border-slate-300 text-slate-700 hover:bg-slate-50 font-bold"
            >
              <Link to="/race">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Painel /race
              </Link>
            </Button>
          </div>
        </div>

        {/* ALERTA DE CONFLITO DE EXECUTOR (Se houver outra aba aberta executando) */}
        {executorConflictMessage && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Execução Bloqueada nesta Janela</p>
              <p className="mt-0.5 text-amber-800 leading-relaxed">{executorConflictMessage}</p>
            </div>
            <Button
              size="sm"
              onClick={handleTryAcquireLock}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-7 px-2.5"
            >
              Reivindicar Controle
            </Button>
          </div>
        )}

        {/* ÁREA DE DECISÃO DE CORRIDA EM DESTAQUE PRIORITÁRIO (ANEXO A) */}
        {pendingDecisions.length > 0 && (
          <div className="mt-3.5 rounded-xl border-2 border-amber-500 bg-amber-500/10 shadow-md p-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/30 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider">
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  CORRIDA PAUSADA — DECISÃO OBRIGATÓRIA
                </span>
                {pendingDecisions.length > 1 && (
                  <Badge className="bg-amber-600 text-white font-mono text-xs">
                    Fila: {pendingDecisions.length} pendentes
                  </Badge>
                )}
              </div>
              <span className="text-xs font-mono font-bold text-amber-900">
                Volta {pendingDecisions[0].lap} · #{pendingDecisions[0].id.slice(-8)}
              </span>
            </div>

            {/* Conteúdo da Decisão em Destaque */}
            {(() => {
              const currentDec = pendingDecisions[0]
              const car = grid.find((g) => g.driverId === currentDec.driverId)
              return (
                <div className="pt-3 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
                        {currentDec.title}
                      </h3>
                      <p className="text-xs text-slate-800 leading-relaxed font-medium max-w-2xl">
                        {currentDec.description}
                      </p>
                    </div>

                    {car && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-amber-300 text-xs font-mono shadow-xs shrink-0">
                        <span className="font-bold text-slate-900">{car.driverName}:</span>
                        <Badge className="bg-slate-900 text-white font-mono text-[10px] px-1.5">
                          P{car.position}
                        </Badge>
                        <span className="text-slate-600 font-semibold capitalize">
                          {formatTireName(car.tireCompound)} ({car.tireWear}% desg.)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Seleção de composto caso opte por Box */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1.5 bg-white/70 p-2.5 rounded-lg border border-amber-200">
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      Se optar por Box, instalar:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          'macio',
                          'medio',
                          'duro',
                          'intermediario',
                          'chuva_extrema',
                        ] as TireCompound[]
                      ).map((comp) => (
                        <button
                          key={comp}
                          type="button"
                          onClick={() => setSelectedPitCompound(comp)}
                          className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                            selectedPitCompound === comp
                              ? 'bg-slate-950 text-white ring-2 ring-amber-500 shadow-xs'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {formatTireName(comp)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Botões de Ação da Decisão */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {(
                      currentDec.options || [
                        { id: 'box_now', label: 'Box nesta volta' },
                        { id: 'stay_out', label: 'Manter na pista' },
                      ]
                    ).map((opt) => (
                      <Button
                        key={opt.id}
                        disabled={isResolvingDecision}
                        onClick={() => handleResolvePendingDecision(currentDec.id, opt.id)}
                        className={`font-black text-xs h-9 px-5 shadow-sm transition-all ${
                          opt.id === 'box_now'
                            ? 'bg-[#E10600] hover:bg-[#C10500] text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        {isResolvingDecision ? 'Gravando...' : opt.label}
                      </Button>
                    ))}
                    <span className="text-[11px] font-mono text-amber-900 ml-1">
                      A corrida permanecerá em pausa para você revisar o grid após decidir.
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* 2. COCKPIT OPERACIONAL CANÔNICO (LiveStandingsTable, DriverLiveOperationsPanel, TeamActionsCard) */}
      <RaceOperationsCockpit
        isRaceSession={true}
        liveRaceState={{
          inProgress: !isRaceFinished && currentLap < totalLaps,
          currentLap,
          totalLaps,
          weather,
          grid,
        }}
        gpInfo={gpInfo}
        team={team}
        drivers={drivers}
        handleStartRace={() => {
          handleTryAcquireLock().then((acquired) => {
            if (acquired) {
              setIsRacePaused(false)
              triggerSaveCheckpoint('Largada autorizada', 'in_progress')
            }
          })
        }}
        isSimulatingSession={!isRacePaused && !isRaceFinished}
        isDone={isRaceFinished}
        simSpeed={simSpeed}
        setSimSpeed={(spd) => {
          setSimSpeed(spd)
          triggerSaveCheckpoint(`Velocidade alterada para ${spd}x`)
        }}
        isRacePaused={isRacePaused}
        onTogglePause={handleTogglePlayPause}
        handleOpenForcePitModal={(driverId) => {
          if (driverId) setForcePitSelectedDriverId(driverId)
          setForcePitModalOpen(true)
        }}
        onOpenPitWallRadio={(driverId) => {
          setPitWallRadioDriverId(driverId)
          setPitWallRadioOpen(true)
        }}
        raceResults={raceResults}
        liveEvents={liveEvents}
        playerCarTactics={playerCarTactics}
        handleChangeTacticalMode={(driverId, mode) => {
          setPlayerCarTactics((prev) => ({ ...prev, [driverId]: mode }))
          triggerSaveCheckpoint(`Modo tático ${mode} para piloto ${driverId}`)
        }}
        playerPaceOrders={playerPaceOrders}
        handleChangePaceOrder={(driverId, order) => {
          setPlayerPaceOrders((prev) => ({ ...prev, [driverId]: order }))
          triggerSaveCheckpoint(`Ordem de ritmo ${order} para piloto ${driverId}`)
        }}
        lapHistory={lapHistory}
        pauseReason={pauseReason}
        mechanicalIssues={mechanicalIssues}
      />

      {/* 3. RESULTADOS OFICIAIS DA CORRIDA QUANDO ENCERRADA */}
      {isRaceFinished && raceResults && (
        <div className="mt-8 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <RaceResultsTable
            gpName={gpInfo.name}
            results={raceResults}
            incidents={[]}
            isFinishing={isFinishing}
            onAdvanceRound={handleAdvanceRound}
          />
        </div>
      )}

      {/* 4. MODAL DE PARADA NOS BOXES */}
      <DecisionModals
        rainDecisionOpen={false}
        liveRaceWeather={weather}
        currentLap={currentLap}
        totalLaps={totalLaps}
        circuitName={gpInfo.circuit}
        rainActiveDriver={null}
        rainQueueLength={0}
        rainQueueTotal={0}
        rainDecisionWaitLaps={0}
        setRainDecisionWaitLaps={() => {}}
        tireStock={{
          duro: 2,
          medio: 3,
          macio: 3,
          intermediario: 4,
          chuva_extrema: 3,
        }}
        formatTireName={formatTireName}
        onConfirmRainDecision={() => {}}
        wingDamageModalOpen={false}
        setWingDamageModalOpen={() => {}}
        wingDamageDriver={null}
        wingDamageTireChoice={'duro' as any}
        setWingDamageTireChoice={() => {}}
        onConfirmWingDamageDecision={() => {}}
        safetyCarModalOpen={false}
        safetyCarReason=""
        safetyCarActiveDriver={null}
        safetyCarQueueLength={0}
        safetyCarQueueTotal={0}
        safetyCarTireChoice={'duro' as any}
        setSafetyCarTireChoice={() => {}}
        onConfirmSafetyCarDecision={() => {}}
        forcePitModalOpen={forcePitModalOpen}
        onCloseForcePitModal={() => setForcePitModalOpen(false)}
        activePlayerDrivers={grid.filter((g) => g.isPlayer && !g.dnf)}
        forcePitSelectedDriverId={forcePitSelectedDriverId}
        setForcePitSelectedDriverId={setForcePitSelectedDriverId}
        availableForcePitSets={[]}
        forcePitSelectedSetId=""
        setForcePitSelectedSetId={() => {}}
        teamChassisLevel={team?.chassis_level || 75}
        onExecuteForcedPitStop={() => {
          if (!forcePitSelectedDriverId) return
          const car = grid.find((g) => g.driverId === forcePitSelectedDriverId)
          if (car) {
            const pitDuration = calculatePitStopDuration(car.teamName, car.driverName, true, 80)
            car.tireWear = 4
            car.lapsOnCurrentTire = 0
            car.pitStopsDone = (car.pitStopsDone || 0) + 1
            car.accumulatedTimeSec = (car.accumulatedTimeSec || 0) + pitDuration.durationSec
            setForcePitModalOpen(false)
            triggerSaveCheckpoint(`Parada forçada nos boxes para ${car.driverName}`)
            toast({
              title: 'Parada nos Boxes Realizada',
              description: `${car.driverName} trocou de pneus em ${pitDuration.durationSec.toFixed(2)}s.`,
            })
          }
        }}
      />

      {/* 5. MODAL DE RÁDIO COM PILOTO */}
      <PitWallRadioDialog
        open={pitWallRadioOpen}
        onClose={() => setPitWallRadioOpen(false)}
        driverId={pitWallRadioDriverId}
        driverName={drivers.find((d) => d.id === pitWallRadioDriverId)?.name || 'Piloto'}
        currentLap={currentLap}
        onSendTeamOrder={(orderType, reason) => {
          setLiveEvents((prev) => [
            {
              id: `ev_radio_${Date.now()}`,
              lap: currentLap,
              type: 'team_radio',
              message: `📻 PIT WALL: Ordem transmitida: ${orderType} (${reason})`,
              timestamp: new Date().toLocaleTimeString('pt-BR'),
            },
            ...prev,
          ])
          setPitWallRadioOpen(false)
          triggerSaveCheckpoint('Ordem de rádio transmitida')
        }}
        onRespondToRequest={() => setPitWallRadioOpen(false)}
        onSendFollowUp={() => setPitWallRadioOpen(false)}
      />
    </div>
  )
}
