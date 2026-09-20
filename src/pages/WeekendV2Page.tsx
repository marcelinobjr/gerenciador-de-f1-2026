import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Clock,
  ArrowLeft,
  Sparkles,
  Layers,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Flag,
  Calendar,
  CloudRain,
  Sun,
  ShieldCheck,
  Disc,
} from 'lucide-react'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { f1Service } from '@/services/f1Service'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import {
  hasSprintWeekend,
  getCanonicalWeekendSchedule,
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
  type CanonicalWeekendSession,
} from '@/services/weekendProgressionService'
import {
  canonicalEventRegistrationService,
  type EventRegistrationSnapshot,
  type EventDriverEntrySnapshot,
} from '@/services/canonicalEventRegistrationService'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { practiceSessionService } from '@/services/practiceSessionService'
import {
  CanonicalPracticeV2Runner,
  type AdvanceStepResult,
} from '@/services/canonicalPracticeV2Runner'
import { PracticeSessionRunner } from '@/services/canonicalPracticeRunner'
import type {
  PracticeSessionRecordState,
  PracticeCarLiveState,
  PracticeRadioFeedEvent,
} from '@/types/practice-session'
import type { TireSetItem } from '@/types/f1'
import { PracticeLeaderboardTable } from '@/components/race/PracticeLeaderboardTable'
import { PracticeCarCockpitCard } from '@/components/race/PracticeCarCockpitCard'
import { CarSetupModal } from '@/components/race/CarSetupModal'
import { TyreInventoryPanel } from '@/components/race/TyreInventoryPanel'
import { toast } from '@/hooks/use-toast'

export default function WeekendV2Page() {
  const navigate = useNavigate()
  const { team, season, loading: isAuthLoading } = useUnifiedSeason()

  const currentRound = season?.current_round || 1
  const gpInfo =
    F1_2026_CALENDAR[Math.min(currentRound - 1, F1_2026_CALENDAR.length - 1)] || F1_2026_CALENDAR[0]
  const circuitProfile = resolveCircuitProfile({ round: currentRound })
  const isSprint = useMemo(() => hasSprintWeekend(currentRound), [currentRound])

  // Esteira de sessões
  const schedule: CanonicalWeekendSession[] = useMemo(() => {
    return getCanonicalWeekendSchedule(currentRound)
  }, [currentRound])

  // Estado das inscrições do evento
  const [registration, setRegistration] = useState<EventRegistrationSnapshot | null>(null)
  const [registrationErrors, setRegistrationErrors] = useState<string[]>([])
  const [isInitializingRegistration, setIsInitializingRegistration] = useState(true)

  // Estado do TL1
  const [sessionState, setSessionState] = useState<PracticeSessionRecordState | null>(null)
  const [selectedSpeed, setSelectedSpeed] = useState<1 | 2 | 4>(1)
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false)
  const autoAdvanceIntervalRef = useRef<any>(null)

  // Modais de Reacerto
  const [setupModalCarId, setSetupModalCarId] = useState<'car1' | 'car2' | null>(null)

  // Visualização de Pneus
  const [activeTyresCarId, setActiveTyresCarId] = useState<'car1' | 'car2'>('car1')

  // Inventário de Pneus persistente
  const [tyreInventories, setTyreInventories] = useState<Record<string, TireSetItem[]>>({})

  // Sessão atualmente selecionada/ativa na esteira do fim de semana
  const [activeSessionType, setActiveSessionType] = useState<CanonicalWeekendSession>('tp1')
  // Sessões oficialmente concluídas lidas do armazenamento canônico
  const [completedSessions, setCompletedSessions] = useState<string[]>([])

  // Função para sincronizar as sessões concluídas do backend/localStorage
  const refreshCompletedSessions = useCallback(() => {
    if (!season?.id) return []
    const stored = readStoredCompletedSessions(season.id, currentRound)
    setCompletedSessions(stored)
    return stored
  }, [season?.id, currentRound])

  // 1. Inicializar inscrições canônicas (exatamente 2 assentos por equipe, 12 equipes, 24 pilotos)
  useEffect(() => {
    if (!team || !season) return

    let isMounted = true
    setIsInitializingRegistration(true)

    f1Service
      .getDrivers()
      .then((allDrivers) => {
        if (!isMounted) return

        const regRes = canonicalEventRegistrationService.resolveOrLoadEventRegistration({
          seasonId: season.id,
          round: currentRound,
          gpName: gpInfo.name,
          playerTeam: team,
          allDrivers,
          forceRecalculate: false,
        })

        if (!regRes.valid) {
          setRegistrationErrors(regRes.errors)
        } else if (regRes.snapshot) {
          setRegistration(regRes.snapshot)
          setRegistrationErrors([])

          // Carregar ou gerar inventário de pneus para os 2 pilotos do jogador (mesmo inventário para o fim de semana inteiro)
          const pCar1 = regRes.snapshot.entriesByCar.playerCar1
          const pCar2 = regRes.snapshot.entriesByCar.playerCar2
          const driverIds = [pCar1?.driverId, pCar2?.driverId].filter(Boolean) as string[]

          const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
            seasonId: season.id,
            round: currentRound,
            driverIds,
            primaryDriverIds: driverIds,
          })
          setTyreInventories(inventories)

          const stored = readStoredCompletedSessions(season.id, currentRound)
          setCompletedSessions(stored)

          // Determinar qual sessão inicializar com base no progresso canônico
          let targetSession: CanonicalWeekendSession = 'tp1'
          if (stored.includes('tp1')) {
            if (stored.includes('tp2')) {
              targetSession = isSprint ? 'sprint_qualifying' : 'tp3'
            } else {
              targetSession = 'tp2'
            }
          }

          // Se a sessão for de Treino Livre (TL1, TL2 ou TL3)
          if (['tp1', 'tp2', 'tp3'].includes(targetSession)) {
            setActiveSessionType(targetSession)
            initializePracticeSession(
              targetSession as 'tp1' | 'tp2' | 'tp3',
              regRes.snapshot,
              inventories,
            )
          } else {
            setActiveSessionType(targetSession)
          }
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar pilotos para inscrição:', err)
        if (isMounted) {
          setRegistrationErrors(['Falha ao carregar elenco oficial de pilotos.'])
        }
      })
      .finally(() => {
        if (isMounted) setIsInitializingRegistration(false)
      })

    return () => {
      isMounted = false
    }
  }, [team?.id, season?.id, currentRound, isSprint])

  // 2. Inicializar ou retomar sessão de Treino Livre (TL1, TL2 ou TL3) com herança canônica
  const initializePracticeSession = async (
    targetType: 'tp1' | 'tp2' | 'tp3',
    snapshot: EventRegistrationSnapshot,
    inventories: Record<string, TireSetItem[]>,
  ) => {
    if (!team || !season) return

    const pCar1 = snapshot.entriesByCar.playerCar1
    const pCar2 = snapshot.entriesByCar.playerCar2
    if (!pCar1 || !pCar2) return

    // Buscar pneus disponíveis no mesmo inventário (20 jogos/piloto)
    const car1Tire =
      inventories[pCar1.driverId]?.find((t) => (t.wear || 0) < 100) ||
      inventories[pCar1.driverId]?.[0]
    const car2Tire =
      inventories[pCar2.driverId]?.find((t) => (t.wear || 0) < 100) ||
      inventories[pCar2.driverId]?.[0]

    // Resolver herança de setup e conhecimento da sessão anterior
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
          driverId: pCar1.driverId,
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
          driverId: pCar2.driverId,
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
      overallObjective: `Homologação e validação canônica de fim de semana (${targetType.toUpperCase()})`,
      confirmedAt: new Date().toISOString(),
    }

    const { session } = await practiceSessionService.openOrResumePracticeSession({
      careerId: team.id,
      seasonId: season.id,
      round: currentRound,
      sessionType: targetType,
      preparation: prep as any,
      driverNames: {
        car1: pCar1.driverName,
        driver1Id: pCar1.driverId,
        car2: pCar2.driverName,
        driver2Id: pCar2.driverId,
      },
      teamName: team.name,
      teamColor: team.color,
      teamChassisRating: team.strength || 75,
      engineSupplier: team.engine_supplier || 'Audi',
    })

    setSessionState(session)
    setActiveSessionType(targetType)
    setIsAutoAdvancing(false)
  }

  // Mudar sessão na esteira
  const handleSelectSessionFromSchedule = async (sess: CanonicalWeekendSession) => {
    if (!registration || !team || !season) return

    // Sessões de TL1, TL2 e TL3
    if (sess === 'tp1' || sess === 'tp2' || sess === 'tp3') {
      const stored = refreshCompletedSessions()

      // Verificar se pode abrir:
      // TL1: sempre disponível
      // TL2: requer TL1 concluído
      // TL3: requer TL2 concluído (ou TL1 no sprint, embora sprint não tenha TL3)
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

      // Parar auto-avanço da sessão anterior
      setIsAutoAdvancing(false)
      if (autoAdvanceIntervalRef.current) {
        clearInterval(autoAdvanceIntervalRef.current)
      }

      // Recarregar inventário persistente atualizado
      const pCar1 = registration.entriesByCar.playerCar1
      const pCar2 = registration.entriesByCar.playerCar2
      const driverIds = [pCar1?.driverId, pCar2?.driverId].filter(Boolean) as string[]
      const invs = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId: season.id,
        round: currentRound,
        driverIds,
        primaryDriverIds: driverIds,
      })
      setTyreInventories(invs)

      await initializePracticeSession(sess, registration, invs)
    } else {
      toast({
        title: 'Sessão Bloqueada',
        description:
          'Qualificação e Corrida estarão disponíveis nas próximas etapas (FW2.1D e FW2.1E).',
      })
    }
  }

  // Contexto para o runner
  const runnerContext = useMemo(() => {
    if (!team || !registration) return null

    const pCar1 = registration.entriesByCar.playerCar1
    const pCar2 = registration.entriesByCar.playerCar2

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
          id: pCar1?.driverId || 'drv_c1',
          name: pCar1?.driverName || 'Piloto 1',
          speed: 82,
          consistency: 80,
          defense: 78,
          technical_feedback: 75,
        },
        {
          id: pCar2?.driverId || 'drv_c2',
          name: pCar2?.driverName || 'Piloto 2',
          speed: 80,
          consistency: 79,
          defense: 76,
          technical_feedback: 72,
        },
      ],
    }
  }, [team, registration, currentRound, gpInfo, circuitProfile])

  // Controles do Treino Livre: PLAY / PAUSE
  const handleTogglePlay = () => {
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

  // Loop de execução contínua quando Play está ativo
  useEffect(() => {
    if (!isAutoAdvancing || !sessionState || !runnerContext) {
      if (autoAdvanceIntervalRef.current) {
        clearInterval(autoAdvanceIntervalRef.current)
      }
      return
    }

    const intervalMs = Math.round(1000 / selectedSpeed)
    autoAdvanceIntervalRef.current = setInterval(() => {
      setSessionState((prev) => {
        if (!prev || prev.status !== 'running' || prev.timeRemainingSec <= 0) {
          setIsAutoAdvancing(false)
          return prev
        }

        const deltaSec = 2 * selectedSpeed
        const res = PracticeSessionRunner.tick(prev, deltaSec, runnerContext)

        // Sincronizar pneus
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

        // Se ocorreu decisão obrigatória, interrompe
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
          // Atualizar sessões concluídas
          if (season?.id) {
            const currentStored = readStoredCompletedSessions(season.id, currentRound)
            if (!currentStored.includes(res.nextState.sessionType)) {
              const updated = [...currentStored, res.nextState.sessionType]
              writeStoredCompletedSessions(season.id, currentRound, updated)
              setCompletedSessions(updated)
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
  }, [isAutoAdvancing, selectedSpeed, runnerContext])

  // Controles: +1 MIN / +5 MIN
  const handleAdvanceStep = (minutes: 1 | 5) => {
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

    // Atualizar inventário de pneus na tela
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

  // Controle: SIMULAR RESTANTE DO TL
  const handleSimulateRemaining = () => {
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

    // Atualizar sessões concluídas
    if (season?.id && res.nextState.status === 'completed') {
      const currentStored = readStoredCompletedSessions(season.id, currentRound)
      if (!currentStored.includes(res.nextState.sessionType)) {
        const updated = [...currentStored, res.nextState.sessionType]
        writeStoredCompletedSessions(season.id, currentRound, updated)
        setCompletedSessions(updated)
      }
    }

    const targetTypeUpper = res.nextState.sessionType.toUpperCase()
    toast({
      title: `Restante do ${targetTypeUpper} Simulado com Sucesso!`,
      description: `Foram computadas todas as voltas, desgaste e aprendizados de setup da sessão.`,
    })
  }

  // Ações de Carro: Sair para a pista
  const handleOrderExit = (carId: 'car1' | 'car2') => {
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

  // Ações de Carro: Chamar aos boxes
  const handleRequestBox = (carId: 'car1' | 'car2') => {
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

  // Reacerto de Carro
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

  // Troca de Jogo de Pneus na Garagem
  const handleSelectTyreSet = (carId: 'car1' | 'car2', tyreSetId: string) => {
    if (!sessionState) return
    const car = sessionState.cars[carId]
    if (car.status !== 'garage') {
      toast({
        variant: 'destructive',
        title: 'Carro em pista',
        description: 'Troca de pneus só permitida com o carro na garagem.',
      })
      return
    }

    const driverInventory = tyreInventories[car.driverId] || []
    const selectedSet = driverInventory.find((s) => s.id === tyreSetId)
    if (!selectedSet) return

    car.currentTyreSetId = selectedSet.id
    car.currentCompound = selectedSet.compound
    car.tyreWear = selectedSet.wear || 0

    // Atualizar status isFitted no armazenamento
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
        car.driverId,
        updatedInventory,
      )
      setTyreInventories((prev) => ({
        ...prev,
        [car.driverId]: updatedInventory,
      }))
    }

    practiceSessionService.saveSessionState(sessionState)
    setSessionState({ ...sessionState })
    toast({
      title: 'Jogo de Pneus Instalado',
      description: `Carro #${carId === 'car1' ? 1 : 2} equipado com ${selectedSet.compound.toUpperCase()} (${selectedSet.wear || 0}% desgaste).`,
    })
  }

  // Formatação do timer da sessão
  const formatSessionTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  if (isAuthLoading || isInitializingRegistration) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-mono text-white space-y-4">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-400">
          Carregando Nova Experiência de Fim de Semana (FW2.1)...
        </p>
      </div>
    )
  }

  if (registrationErrors.length > 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto font-mono text-white space-y-4">
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 space-y-2">
          <div className="flex items-center gap-2 font-black text-sm">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            PENDÊNCIA REGULAMENTAR DE INSCRIÇÃO FIA (EVENTO BLOQUEADO)
          </div>
          <ul className="list-disc pl-5 text-xs space-y-1">
            {registrationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
        <Button asChild variant="outline" className="border-slate-700 text-xs">
          <Link to="/race">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao painel atual
          </Link>
        </Button>
      </div>
    )
  }

  const pCar1 = registration?.entriesByCar.playerCar1
  const pCar2 = registration?.entriesByCar.playerCar2
  const activeCarForTyres = activeTyresCarId === 'car1' ? pCar1 : pCar2
  const activeTyresList = activeCarForTyres ? tyreInventories[activeCarForTyres.driverId] || [] : []

  return (
    <div className="space-y-6 font-mono text-white pb-12">
      {/* 1. BARRA SUPERIOR DE HOMOLOGAÇÃO & NAVEGAÇÃO COMPARATIVA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#090D15] border border-[#1A2333] shadow-lg">
        <div className="flex items-center gap-3">
          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-400/40 text-xs font-black uppercase px-2.5 py-1">
            NOVA EXPERIÊNCIA — BETA (FW2.1)
          </Badge>
          <span className="text-xs text-slate-400 hidden md:inline">
            Fluxo paralelo homologado. Dados canônicos compartilhados com a carreira.
          </span>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold h-8"
        >
          <Link to="/race">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Voltar ao painel atual
          </Link>
        </Button>
      </div>

      {/* 2. TOPO DO GP (CIRCUITO, METEOROLOGIA, EXTENSÃO E FORMATO) */}
      <div className="p-5 rounded-2xl bg-[#090D15]/90 border border-[#1F2733] shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1A2333] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
                RODADA {currentRound} DE 24
              </span>
              <Badge className="bg-[#141B26] text-slate-300 border-[#222E42] text-[10px] font-bold">
                {isSprint ? 'FORMATO SPRINT' : 'GP PADRÃO'}
              </Badge>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              {gpInfo.name}
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>{gpInfo.circuit}</span>
              <span>•</span>
              <span>{gpInfo.country}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-[#0B1019] border border-[#162030]">
              <span className="text-[10px] text-slate-500 block">Condição da Pista</span>
              <div className="flex items-center gap-1.5 font-bold text-emerald-400 mt-0.5">
                <Sun className="w-3.5 h-3.5" />
                Seco / 28°C
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0B1019] border border-[#162030]">
              <span className="text-[10px] text-slate-500 block">Extensão</span>
              <span className="font-bold text-white mt-0.5 block">
                {gpInfo.circuitLengthKm || 5.8} km
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0B1019] border border-[#162030]">
              <span className="text-[10px] text-slate-500 block">Voltas Previstas</span>
              <span className="font-bold text-white mt-0.5 block">{gpInfo.laps || 53} voltas</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0B1019] border border-[#162030]">
              <span className="text-[10px] text-slate-500 block">Inscrições FIA</span>
              <div className="flex items-center gap-1 font-bold text-cyan-400 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                24 Pilotos (12 Eq.)
              </div>
            </div>
          </div>
        </div>

        {/* 3. ESTEIRA DO FIM DE SEMANA (PROGRESSÃO OFICIAL FIA) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300">
              Cronograma Oficial do Evento
            </span>
            <span className="text-[10px]">
              Etapa ativa:{' '}
              <strong className="text-cyan-400 font-black">
                {activeSessionType === 'tp1'
                  ? 'TL1 (TREINO LIVRE 1)'
                  : activeSessionType === 'tp2'
                    ? 'TL2 (TREINO LIVRE 2)'
                    : activeSessionType === 'tp3'
                      ? 'TL3 (TREINO LIVRE 3)'
                      : activeSessionType.toUpperCase()}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-7 gap-2">
            {schedule.map((sess, idx) => {
              const isCurrentActive = sess === activeSessionType
              const isCompleted =
                completedSessions.includes(sess) ||
                (isCurrentActive && sessionState?.status === 'completed')

              // Determinar se está bloqueado ou disponível
              let isLocked = false
              if (sess === 'tp2') {
                isLocked = !completedSessions.includes('tp1') && activeSessionType !== 'tp1'
              } else if (sess === 'tp3') {
                isLocked = !completedSessions.includes('tp2') && activeSessionType !== 'tp2'
              } else if (sess !== 'tp1') {
                isLocked = true
              }

              const isAvailable = !isLocked && !isCompleted && !isCurrentActive

              const labelMap: Record<string, string> = {
                tp1: 'TL1',
                tp2: 'TL2',
                tp3: 'TL3',
                sprint_qualifying: 'Quali Sprint',
                sprint_race: 'Sprint',
                qualifying: 'Classificação',
                race: 'Corrida',
              }

              const isClickable = ['tp1', 'tp2', 'tp3'].includes(sess) && (!isLocked || isCompleted)

              return (
                <button
                  key={sess}
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleSelectSessionFromSchedule(sess)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    isCurrentActive
                      ? 'bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500 text-cyan-300 font-black shadow-md cursor-pointer'
                      : isCompleted
                        ? 'bg-emerald-950/20 border-emerald-600/40 text-emerald-400 font-bold hover:bg-emerald-950/40 cursor-pointer'
                        : isAvailable
                          ? 'bg-[#101726] border-cyan-800/60 text-slate-200 font-bold hover:border-cyan-400 cursor-pointer'
                          : 'bg-[#0B1019] border-[#182333] text-slate-500 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-[10px] font-mono text-slate-400 uppercase">
                    Etapa {idx + 1}
                  </div>
                  <div className="text-xs font-black mt-0.5">{labelMap[sess] || sess}</div>
                  <div className="text-[9px] mt-1 font-bold">
                    {isCurrentActive ? (
                      sessionState?.status === 'completed' ? (
                        <span className="text-emerald-400">CONCLUÍDO</span>
                      ) : (
                        <span className="text-cyan-400 animate-pulse">EM ANDAMENTO</span>
                      )
                    ) : isCompleted ? (
                      <span className="text-emerald-400">CONCLUÍDO</span>
                    ) : isAvailable ? (
                      <span className="text-cyan-300">DISPONÍVEL</span>
                    ) : (
                      <span>BLOQUEADO</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 4. CONTROLES OPERACIONAIS DO TL & CRONÔMETRO */}
      {sessionState && (
        <Card className="p-4 bg-[#090D15]/90 border border-[#1F2733] rounded-2xl shadow-xl space-y-4 font-mono">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1A2333] pb-3">
            {/* Relógio da sessão */}
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Tempo Restante — {sessionState.sessionType.toUpperCase()}
                </span>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-wider flex items-center gap-2">
                  <span>{formatSessionTime(sessionState.timeRemainingSec)} RESTANTES</span>
                  <span className="text-xs text-slate-400 font-normal">
                    / {formatSessionTime(sessionState.sessionDurationSec)}
                  </span>
                </div>
              </div>
            </div>

            {/* Controles: Play/Pause, Velocidades, +1m, +5m, Simular Restante */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Play / Pause */}
              <Button
                type="button"
                disabled={sessionState.status === 'completed'}
                onClick={handleTogglePlay}
                className={`h-9 px-4 text-xs font-black gap-2 shadow-md ${
                  isAutoAdvancing
                    ? 'bg-amber-600 hover:bg-amber-500 text-black'
                    : 'bg-[#00A6FB] hover:bg-[#0092DC] text-black'
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
              <div className="flex items-center bg-[#0B1019] border border-[#182333] rounded-lg p-0.5">
                {([1, 2, 4] as const).map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSelectedSpeed(spd)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                      selectedSpeed === spd
                        ? 'bg-cyan-500/30 text-cyan-300 font-black'
                        : 'text-slate-400 hover:text-white'
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
                className="h-9 px-3 text-xs font-bold border-slate-700 bg-[#0B1019] text-slate-200 hover:bg-slate-800"
              >
                +1 MIN
              </Button>

              {/* +5 MIN */}
              <Button
                type="button"
                variant="outline"
                disabled={sessionState.status === 'completed'}
                onClick={() => handleAdvanceStep(5)}
                className="h-9 px-3 text-xs font-bold border-slate-700 bg-[#0B1019] text-slate-200 hover:bg-slate-800"
              >
                +5 MIN
              </Button>

              {/* SIMULAR RESTANTE DO TL */}
              <Button
                type="button"
                variant="destructive"
                disabled={sessionState.status === 'completed'}
                onClick={handleSimulateRemaining}
                className="h-9 px-3.5 text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md gap-1.5"
              >
                <FastForward className="w-4 h-4" />
                SIMULAR RESTANTE ({sessionState.sessionType.toUpperCase()})
              </Button>
            </div>
          </div>

          {/* Estado dos Carros do Jogador & Ações de Reacerto */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-300">Ações Rápidas de Garagem:</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSetupModalCarId('car1')}
                className="h-7 text-[11px] font-bold border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40 gap-1.5"
              >
                <Wrench className="w-3.5 h-3.5" />
                Reacertar Carro 1 ({pCar1?.driverName})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSetupModalCarId('car2')}
                className="h-7 text-[11px] font-bold border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40 gap-1.5"
              >
                <Wrench className="w-3.5 h-3.5" />
                Reacertar Carro 2 ({pCar2?.driverName})
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Ver Estoque:</span>
              <button
                type="button"
                onClick={() => setActiveTyresCarId('car1')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  activeTyresCarId === 'car1'
                    ? 'bg-cyan-500/30 text-cyan-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Carro 1
              </button>
              <button
                type="button"
                onClick={() => setActiveTyresCarId('car2')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  activeTyresCarId === 'car2'
                    ? 'bg-cyan-500/30 text-cyan-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Carro 2
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* 5. OPERAÇÃO DOS DOIS CARROS (CARRO 1 E CARRO 2) */}
      {sessionState && pCar1 && pCar2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CARRO 1 */}
          <div className="space-y-2">
            <PracticeCarCockpitCard
              car={sessionState.cars.car1}
              carNumber={1}
              teamColor={team?.color || '#00A6FB'}
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
            />
          </div>

          {/* CARRO 2 */}
          <div className="space-y-2">
            <PracticeCarCockpitCard
              car={sessionState.cars.car2}
              carNumber={2}
              teamColor={team?.color || '#00A6FB'}
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
            />
          </div>
        </div>
      )}

      {/* 6. ESTOQUE DE PNEUS DO FIM DE SEMANA (CANONICAL 20 JOGOS) */}
      {activeCarForTyres && sessionState && (
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

      {/* 7. TABELA DE TEMPOS OFICIAL DO TREINO LIVRE (24 PILOTOS) */}
      {sessionState && (
        <PracticeLeaderboardTable
          entries={sessionState.leaderboard}
          playerTeamName={team?.name}
          playerTeamColor={team?.color}
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
    </div>
  )
}
