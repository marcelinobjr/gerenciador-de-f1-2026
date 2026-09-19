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
import { advanceCanonicalRaceLap } from '@/services/canonicalRaceRunner'
import { f1Service } from '@/services/f1Service'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { toast } from '@/hooks/use-toast'
import type { SimDriverEntry } from '@/pages/race/types'
import type { LiveRaceEvent } from '@/types/race-events'
import type { LapRecord } from '@/components/race/LiveStandingsTable'
import type { TireCompound, TireAllotment } from '@/types/f1'
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
import { calculatePitStopDuration, formatTireName } from '@/lib/f1-tire-system'

export default function LiveRacePage() {
  const navigate = useNavigate()
  const { team, season } = useUnifiedSeason()
  const { user, refreshTeamAndSeason } = useAuth()
  const [drivers, setDrivers] = useState<any[]>([])
  const [parts, setParts] = useState<any[]>([])
  const [sponsors, setSponsors] = useState<any[]>([])

  useEffect(() => {
    if (!team?.id) return
    Promise.all([
      f1Service.getTeamDrivers(team.id),
      f1Service.getTeamParts(team.id),
      f1Service.getTeamSponsors(team.id),
    ])
      .then(([d, p, s]) => {
        setDrivers(d || [])
        setParts(p || [])
        setSponsors(s || [])
      })
      .catch(console.error)
  }, [team?.id])

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

  // 1. CARREGAMENTO INICIAL OU RETOMADA DA SESSÃO REAL
  useEffect(() => {
    if (!season?.id || !team?.id || !user?.id) return

    let isMounted = true

    async function initSession() {
      try {
        const { session, isResumed } = await raceSessionService.openOrResumeRaceSession({
          seasonId: season.id,
          teamId: team.id,
          userId: user.id,
          seasonYear: season.year || 2026,
          round: currentRound,
          sessionType: 'race',
          totalLaps: gpInfo.laps,
        })

        if (!isMounted) return
        setSessionRecord(session)
        setSessionStatus(session.status)
        setRevision(session.revision || 1)
        setTotalLaps(session.total_laps || gpInfo.laps)

        if (session.status === 'completed') {
          setIsRaceFinished(true)
          if (session.checkpoint_data?.grid) {
            setGrid(session.checkpoint_data.grid)
            setRaceResults(session.checkpoint_data.grid)
          }
          return
        }

        if (isResumed && session.checkpoint_data) {
          const cp = session.checkpoint_data
          setCurrentLap(session.current_lap || cp.currentLap || 1)
          setGrid(cp.grid || [])
          setWeather(cp.weather || 'seco')
          setLiveEvents(cp.liveEvents || [])
          setPlayerCarTactics(cp.playerCarTactics || {})
          setPlayerPaceOrders(cp.playerPaceOrders || {})
          setMechanicalIssues(cp.mechanicalIssues || [])
          setPenalties(cp.penalties || [])
          if (cp.redFlagState) setRedFlagState(cp.redFlagState)
          if (session.lap_history) setLapHistory(session.lap_history)
          if (cp.pendingDecisions) setPendingDecisions(cp.pendingDecisions)
          if (cp.resolvedDecisions) setResolvedDecisions(cp.resolvedDecisions)

          const hasBlockingDecisions = (cp.pendingDecisions?.length || 0) > 0
          setIsRacePaused(
            session.status === 'paused' ||
              session.status === 'awaiting_decision' ||
              hasBlockingDecisions,
          )
          setPauseReason(
            session.pause_reason || (hasBlockingDecisions ? 'Decisão Obrigatória Pendente' : null),
          )
          setSimSpeed(session.sim_speed || 1)

          toast({
            title: 'Sessão Retomada com Sucesso',
            description: `Corrida da Rodada ${currentRound} carregada a partir da volta ${session.current_lap}.`,
          })
        } else {
          // Inicializa Grid canônico a partir dos pilotos da carreira
          buildInitialGrid()
        }
      } catch (err: any) {
        console.error('[LiveRacePage] Erro ao abrir sessão:', err)
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
  }, [season?.id, team?.id, user?.id, currentRound])

  // Constrói grid canônico inicial
  const buildInitialGrid = () => {
    const playerDrivers = drivers.filter((d) => d.team_id === team?.id && d.role !== 'reserva')
    const initialTactics: Record<string, LiveTacticalMode> = {}
    const initialPace: Record<string, LivePaceOrder> = {}
    playerDrivers.forEach((d) => {
      initialTactics[d.id] = 'normal'
      initialPace[d.id] = 'normal'
    })
    setPlayerCarTactics(initialTactics)
    setPlayerPaceOrders(initialPace)

    // Grid padrão
    const initialGrid: SimDriverEntry[] = [
      {
        position: 1,
        gridPosition: 1,
        driverId: 'drv_nor',
        driverName: 'L. Norris',
        teamId: 'team_mclaren',
        teamName: 'McLaren',
        teamColor: '#FF8000',
        score: 88,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        accumulatedTimeSec: 0,
        tireCompound: 'medio',
        pitLap: Math.round(gpInfo.laps * 0.45),
        tireWear: 4,
        pitStopsDone: 0,
        gapToLeader: 'Líder',
        gapToFront: '+0.000s',
      },
      {
        position: 2,
        gridPosition: 2,
        driverId: 'drv_ver',
        driverName: 'M. Verstappen',
        teamId: 'team_redbull',
        teamName: 'Red Bull Racing',
        teamColor: '#3671C6',
        score: 92,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        accumulatedTimeSec: 0,
        tireCompound: 'medio',
        pitLap: Math.round(gpInfo.laps * 0.45),
        tireWear: 4,
        pitStopsDone: 0,
        gapToLeader: '+0.231s',
        gapToFront: '+0.231s',
      },
      {
        position: 3,
        gridPosition: 3,
        driverId: 'drv_lec',
        driverName: 'C. Leclerc',
        teamId: 'team_ferrari',
        teamName: 'Ferrari',
        teamColor: '#E80020',
        score: 89,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        accumulatedTimeSec: 0,
        tireCompound: 'duro',
        pitLap: Math.round(gpInfo.laps * 0.55),
        tireWear: 4,
        pitStopsDone: 0,
        gapToLeader: '+0.512s',
        gapToFront: '+0.281s',
      },
      ...playerDrivers.map((pd, idx) => ({
        position: 4 + idx,
        gridPosition: 4 + idx,
        driverId: pd.id,
        driverName: pd.name,
        teamId: team?.id || 'team_player',
        teamName: team?.name || 'Escuderia Audi',
        teamColor: team?.color || '#E10600',
        isPlayer: true,
        score: pd.speed || 80,
        points: 0,
        fastestLap: false,
        usedOvertake: false,
        accumulatedTimeSec: 0,
        tireCompound: 'medio' as TireCompound,
        pitLap: Math.round(gpInfo.laps * 0.45),
        tireWear: 4,
        driverFatigue: 0,
        morale: pd.morale || 85,
        physicalCondition: pd.physical_condition || 90,
        pitStopsDone: 0,
        hasWingDamage: false,
        fuelRemaining: 100,
        gapToLeader: `+${(0.8 + idx * 0.4).toFixed(3)}s`,
        gapToFront: '+0.320s',
      })),
    ]

    setGrid(initialGrid)
    setLiveEvents([
      {
        id: `ev_init_${Date.now()}`,
        lap: 1,
        type: 'overtake',
        message: `🟢 Grid oficial montado para o ${gpInfo.name}. Pilotos alinhados.`,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
    ])
  }

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

      // Executa avanço da volta pelo runner canônico com proteção anti-loop
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

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* 1. HERO SUPERIOR CLARO E MODERNO (Anexo A / B) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#E10600] text-white font-extrabold text-[10px] px-2 py-0.5 tracking-wider uppercase">
                CORRIDA AO VIVO — NOVA VERSÃO
              </Badge>
              <span className="font-mono text-xs text-slate-500 font-bold">
                TEMPORADA {season?.year || 2026} · RODADA {currentRound}/{totalRounds}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{gpInfo.name}</h1>
            <p className="text-xs text-slate-600">
              {gpInfo.circuit} • Sessão Oficial Persistente Compartilhada
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status discreto de salvamento */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-slate-50 text-xs font-mono font-medium">
              {syncState === 'saving' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span className="text-amber-700">SALVANDO...</span>
                </>
              )}
              {syncState === 'saved' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">SALVO (Rev {revision})</span>
                </>
              )}
              {syncState === 'error' && (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-red-700 font-bold">FALHA AO SALVAR</span>
                </>
              )}
              {syncState === 'idle' && (
                <>
                  <Save className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600">SINCRONIZADO</span>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50 font-bold"
            >
              <Link to="/race">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Acesso Legado (/race)
              </Link>
            </Button>
          </div>
        </div>

        {/* ALERTA DE CONFLITO DE EXECUTOR (Se houver outra aba aberta executando) */}
        {executorConflictMessage && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
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

        {/* ETAPA 2: BANNER PERSISTENTE DE DECISÃO BLOQUEANTE PENDENTE */}
        {pendingDecisions.length > 0 && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/60 shadow-md animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/30 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500 text-black font-extrabold text-xs">
                  ⏸️ CORRIDA PAUSADA AUTOMATICAMENTE
                </span>
                <Badge className="bg-amber-600 text-white font-mono text-xs">
                  Fila: {pendingDecisions.length} decisão(ões) pendente(s)
                </Badge>
              </div>
              <span className="text-xs font-mono text-amber-800 font-bold">
                Volta {pendingDecisions[0].lap} • ID: {pendingDecisions[0].id}
              </span>
            </div>

            {/* Conteúdo da Decisão em Destaque */}
            {(() => {
              const currentDec = pendingDecisions[0]
              const car = grid.find((g) => g.driverId === currentDec.driverId)
              return (
                <div className="pt-3 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{currentDec.title}</h3>
                      <p className="text-xs text-slate-700 mt-0.5 font-medium">
                        {currentDec.description}
                      </p>
                    </div>

                    {car && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs font-mono">
                        <span className="font-bold text-slate-800">{car.driverName}:</span>
                        <span className="text-slate-600">P{car.position}</span>
                        <span>•</span>
                        <span className="capitalize">
                          {car.tireCompound} ({car.tireWear}% desg.)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Seleção de composto caso opte por Box */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <span className="text-xs font-mono font-bold text-slate-700">
                      Caso escolha Box, instalar pneu:
                    </span>
                    <div className="flex items-center gap-1.5">
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
                              ? 'bg-slate-900 text-white ring-2 ring-amber-500'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {formatTireName(comp)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Botões de Decisão */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20">
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
                        className={`font-bold text-xs h-9 px-4 ${
                          opt.id === 'box_now'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                      >
                        {isResolvingDecision ? 'Gravando...' : opt.label}
                      </Button>
                    ))}
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
