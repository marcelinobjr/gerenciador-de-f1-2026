import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Flag,
  CloudRain,
  Sun,
  Timer,
  ShieldAlert,
  ArrowRight,
  Layers,
  Wrench,
  Gauge,
  CheckCircle2,
} from 'lucide-react'
import type { PracticePreparation } from '@/types/practice-preparation'
import type { PracticeSessionRecordState, PracticeRadioFeedEvent } from '@/types/practice-session'
import { CANONICAL_PRACTICE_DURATION_SEC } from '@/types/practice-session'
import { practiceSessionService } from '@/services/practiceSessionService'
import { PracticeSessionRunner, type PracticeTickContext } from '@/services/canonicalPracticeRunner'
import { PracticeLeaderboardTable } from '@/components/race/PracticeLeaderboardTable'
import { PracticeCarCockpitCard } from '@/components/race/PracticeCarCockpitCard'
import { PracticeRadioFeed } from '@/components/race/PracticeRadioFeed'
import { PracticeTyreKnowledgeCard } from '@/components/race/PracticeTyreKnowledgeCard'
import { useToast } from '@/hooks/use-toast'
import type { TeamModel, DriverModel } from '@/types/f1'
import type { TrackWeatherState } from '@/lib/f1-tire-system'
import { formatLapTime } from '@/lib/f1-race-sim-engine'

interface PracticeLiveSessionViewProps {
  careerId: string
  seasonId: string
  round: number
  sessionType: 'tp1' | 'tp2' | 'tp3'
  preparation: PracticePreparation
  team: TeamModel
  drivers: DriverModel[]
  gpInfo: {
    name: string
    circuit: string
    country: string
    flag?: string
    lengthKm: number
    laps: number
    downforceIdeal?: number
    suspensionIdeal?: number
    tireAbrasiveness?: number
  }
  weather: TrackWeatherState
  onFinishSession?: (finalState: PracticeSessionRecordState) => void
  onNavigateToWeekendTab?: (tab: string) => void
}

export const PracticeLiveSessionView: React.FC<PracticeLiveSessionViewProps> = ({
  careerId,
  seasonId,
  round,
  sessionType,
  preparation,
  team,
  drivers,
  gpInfo,
  weather,
  onFinishSession,
  onNavigateToWeekendTab,
}) => {
  const { toast } = useToast()

  const [sessionState, setSessionState] = useState<PracticeSessionRecordState | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [executorAuthorized, setExecutorAuthorized] = useState<boolean>(true)
  const [executorWarning, setExecutorWarning] = useState<string | null>(null)

  // Identificador único da aba para o padrão de lease do executor
  const executorIdRef = useRef<string>(
    `tab_practice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  )
  const sessionStateRef = useRef<PracticeSessionRecordState | null>(null)
  sessionStateRef.current = sessionState

  // 1. Inicializar / Reidratar sessão ao vivo
  useEffect(() => {
    let isMounted = true

    async function initSession() {
      setLoading(true)
      const d1 = drivers.find((d) => d.id === preparation.cars[0]?.driverId)
      const d2 = drivers.find((d) => d.id === preparation.cars[1]?.driverId)

      try {
        const result = await practiceSessionService.openOrResumePracticeSession({
          careerId,
          seasonId,
          round,
          sessionType,
          preparation,
          driverNames: {
            car1: d1?.name || 'Piloto 1',
            driver1Id: d1?.id || 'drv_c1',
            car2: d2?.name || 'Piloto 2',
            driver2Id: d2?.id || 'drv_c2',
          },
          teamName: team?.name || 'Minha Escuderia',
          teamColor: team?.color || '#00A6FB',
          teamChassisRating: team?.strength || 75,
          engineSupplier: team?.engine_supplier || 'Audi',
        })

        if (!isMounted) return
        setSessionState(result.session)

        // Adquirir trava de executor exclusivo
        const lockRes = await practiceSessionService.acquireExecutionLock(
          result.session,
          executorIdRef.current,
        )

        if (!lockRes.acquired) {
          setExecutorAuthorized(false)
          setExecutorWarning(
            'Outra aba já está executando esta sessão de treino. Esta aba permanecerá em modo visualizador.',
          )
        } else {
          setExecutorAuthorized(true)
          setExecutorWarning(null)
        }
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar sessão de treino',
          description: err?.message || 'Falha ao reidratar estado.',
        })
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initSession()

    return () => {
      isMounted = false
      if (sessionStateRef.current && executorAuthorized) {
        practiceSessionService.releaseExecutionLock(sessionStateRef.current, executorIdRef.current)
      }
    }
  }, [careerId, seasonId, round, sessionType, preparation, team, drivers])

  // Contexto canônico compartilhado
  const tickContext: PracticeTickContext = {
    round,
    gpName: gpInfo.name,
    circuitName: gpInfo.circuit,
    lengthKm: gpInfo.lengthKm,
    tireAbrasiveness: gpInfo.tireAbrasiveness || 6,
    weather,
    teamChassisRating: team?.strength || 75,
    teamEngineSupplier: team?.engine_supplier || 'Audi',
    teamName: team?.name || 'Minha Escuderia',
    teamColor: team?.color || '#00A6FB',
    drivers: drivers.map((d) => ({
      id: d.id,
      name: d.name,
      speed: d.speed,
      consistency: d.consistency,
      defense: d.defense,
      morale: d.morale,
      physical_condition: d.physical_condition,
      technical_feedback: d.technical_feedback,
    })),
  }

  // 2. Loop de Avanço de Tempo / Simulação (Respeitando Cadência simSpeed)
  useEffect(() => {
    if (!sessionState || sessionState.status !== 'running' || !executorAuthorized) {
      return
    }

    // Intervalo de 1000ms de tempo real
    // Avança 1s * simSpeed de tempo simulado da sessão
    const timer = setInterval(() => {
      setSessionState((prev) => {
        if (!prev || prev.status !== 'running') return prev

        const deltaSimSec = prev.simSpeed // 1x = 1s, 2x = 2s, 4x = 4s simulados por segundo real
        const tickRes = PracticeSessionRunner.tick(prev, deltaSimSec, tickContext)

        // Salva periodicamente a cada 10s simulados ou quando uma volta for concluída
        if (
          tickRes.lapsCompletedThisTick.length > 0 ||
          tickRes.nextState.elapsedTimeSec % 10 === 0 ||
          tickRes.nextState.status === 'completed'
        ) {
          practiceSessionService.saveSessionState(tickRes.nextState)
        }

        // Se a sessão completou
        if (tickRes.nextState.status === 'completed' && (prev.status as string) !== 'completed') {
          practiceSessionService.markPracticeCompleted(tickRes.nextState)
          if (onFinishSession) {
            onFinishSession(tickRes.nextState)
          }
        }

        return tickRes.nextState
      })
    }, 1000)

    // Heartbeat periódico da autorização do executor a cada 10s
    const heartbeatTimer = setInterval(() => {
      if (sessionStateRef.current && executorAuthorized) {
        practiceSessionService.renewExecutionLock(sessionStateRef.current, executorIdRef.current)
      }
    }, 10000)

    return () => {
      clearInterval(timer)
      clearInterval(heartbeatTimer)
    }
  }, [
    sessionState?.status,
    sessionState?.simSpeed,
    executorAuthorized,
    tickContext,
    onFinishSession,
  ])

  // Controles de Sessão: Play / Pause
  const handleTogglePlayPause = useCallback(async () => {
    if (!sessionState || !executorAuthorized) return
    const nextStatus = sessionState.status === 'running' ? 'paused' : 'running'
    const updated: PracticeSessionRecordState = {
      ...sessionState,
      status: nextStatus,
    }
    setSessionState(updated)
    await practiceSessionService.saveSessionState(updated)
  }, [sessionState, executorAuthorized])

  // Controles de Velocidade: 1x, 2x, 4x (Altera cadência, nunca a física)
  const handleChangeSpeed = useCallback(
    async (speed: 1 | 2 | 4) => {
      if (!sessionState) return
      const updated: PracticeSessionRecordState = {
        ...sessionState,
        simSpeed: speed,
      }
      setSessionState(updated)
      await practiceSessionService.saveSessionState(updated)
    },
    [sessionState],
  )

  // Ordem de saída para a pista por carro
  const handleOrderExitTrack = useCallback(
    async (carId: 'car1' | 'car2') => {
      if (!sessionState) return
      const cloned = JSON.parse(JSON.stringify(sessionState)) as PracticeSessionRecordState
      const res = PracticeSessionRunner.orderCarExitToTrack(cloned, carId)
      if (!res.success) {
        toast({
          variant: 'destructive',
          title: 'Não foi possível sair para a pista',
          description: res.error,
        })
        return
      }

      setSessionState(cloned)
      await practiceSessionService.saveSessionState(cloned)
    },
    [sessionState, toast],
  )

  // Ordem de retorno aos boxes (pitRequested)
  const handleRequestBox = useCallback(
    async (carId: 'car1' | 'car2') => {
      if (!sessionState) return
      const cloned = JSON.parse(JSON.stringify(sessionState)) as PracticeSessionRecordState
      const res = PracticeSessionRunner.requestCarBox(cloned, carId)
      if (!res.success) {
        toast({
          variant: 'destructive',
          title: 'Chamada aos boxes recusada',
          description: res.error,
        })
        return
      }

      setSessionState(cloned)
      await practiceSessionService.saveSessionState(cloned)
    },
    [sessionState, toast],
  )

  // Finalização forçada / Concluir Treino
  const handleManualFinish = useCallback(async () => {
    if (!sessionState) return
    const completed = await practiceSessionService.markPracticeCompleted(sessionState)
    setSessionState(completed)
    toast({
      title: 'Treino Livre Concluído',
      description: 'Resultados oficiais e telemetria persistidos com sucesso!',
    })
    if (onFinishSession) {
      onFinishSession(completed)
    }
  }, [sessionState, onFinishSession, toast])

  if (loading || !sessionState) {
    return (
      <div className="p-12 text-center font-mono text-xs text-[#8B95A7] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        Carregando sessão de treino e conectando ao Pit Wall oficial...
      </div>
    )
  }

  // Formatação do tempo restante (MM:SS)
  const remMinutes = Math.floor(sessionState.timeRemainingSec / 60)
  const remSec = sessionState.timeRemainingSec % 60
  const formattedTimeRemaining = `${remMinutes.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`

  const isCompleted = sessionState.status === 'completed'
  const isRunning = sessionState.status === 'running'
  const isPaused = sessionState.status === 'paused'

  const sessionNameMap: Record<string, string> = {
    tp1: 'Treino Livre 1 (TL1)',
    tp2: 'Treino Livre 2 (TL2)',
    tp3: 'Treino Livre 3 (TL3)',
  }

  return (
    <div className="space-y-6">
      {/* ALERTA DE EXECUTOR BLOQUEADO (DUAS ABAS) */}
      {!executorAuthorized && executorWarning && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{executorWarning}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const res = await practiceSessionService.acquireExecutionLock(
                sessionState,
                executorIdRef.current,
              )
              if (res.acquired) {
                setExecutorAuthorized(true)
                setExecutorWarning(null)
              }
            }}
            className="border-amber-500/40 text-amber-300 text-[10px] h-7"
          >
            Assumir Controle Desta Aba
          </Button>
        </div>
      )}

      {/* 1. TOPO: GP, CIRCUITO, SESSÃO TL1, CLIMA, TEMPO RESTANTE */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-[#1F2733] bg-[#090D15]/90 backdrop-blur-md shadow-2xl">
        <div className="space-y-1.5 font-mono">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#E10600]">
              FIA F1 WORLD CHAMPIONSHIP // SESSÃO OFICIAL
            </span>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px] font-bold">
              {sessionNameMap[sessionType] || sessionType.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-[#222E42] text-[#8B95A7]">
              RODADA {round}/24 • TEMPORADA 2026
            </Badge>
            {isCompleted ? (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-black">
                🏁 CONCLUÍDO
              </Badge>
            ) : isPaused ? (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                ⏸ PAUSADO
              </Badge>
            ) : (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-black animate-pulse">
                ● EM ANDAMENTO
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <span className="text-2xl leading-none">{gpInfo.flag || '🏁'}</span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {gpInfo.name}
              </h2>
              <p className="text-xs text-[#8B95A7]">
                {gpInfo.circuit} • {gpInfo.country} • Extensão: {gpInfo.lengthKm} km
              </p>
            </div>
          </div>
        </div>

        {/* Bloco de Tempo Restante da Sessão + Clima */}
        <div className="flex items-center gap-3">
          {/* Relógio Oficial da Sessão (Contagem Regressiva de 60 min) */}
          <div className="p-3.5 rounded-xl bg-[#0E1521] border border-[#1F2B3E] font-mono text-center min-w-[150px]">
            <span className="text-[10px] uppercase font-bold text-[#8B95A7] flex items-center justify-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-cyan-400" />
              Tempo Restante
            </span>
            <div
              className={`text-2xl font-black tracking-tight ${
                sessionState.timeRemainingSec <= 300 ? 'text-red-400 animate-pulse' : 'text-white'
              }`}
            >
              {formattedTimeRemaining}
            </div>
            <span className="text-[9px] text-[#525E75]">
              Sessão de {CANONICAL_PRACTICE_DURATION_SEC / 60} minutos
            </span>
          </div>

          {/* Condição de Pista / Clima */}
          <div className="p-3.5 rounded-xl bg-[#0E1521] border border-[#1F2B3E] font-mono text-xs flex flex-col justify-between gap-1 min-w-[150px]">
            <span className="text-[10px] uppercase font-bold text-[#8B95A7] flex items-center gap-1.5">
              {weather.startsWith('chuva') ? (
                <CloudRain className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              )}
              Condição da Pista
            </span>
            <div className="text-xs font-bold text-white capitalize">
              {weather.replace('_', ' ')}
            </div>
            <div className="text-[10px] text-[#8B95A7]">
              Abrasividade: {gpInfo.tireAbrasiveness || 6}/10
            </div>
          </div>
        </div>
      </div>

      {/* 2. CENTRO: TABELA DE TEMPOS (ESQUERDA) + PAINÉIS DOS CARROS (DIREITA) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Lado Esquerdo (xl:col-span-7): Tabela de Tempos */}
        <div className="xl:col-span-7 space-y-4">
          <PracticeLeaderboardTable
            entries={sessionState.leaderboard}
            playerTeamName={team?.name}
            playerTeamColor={team?.color}
          />
        </div>

        {/* Lado Direito (xl:col-span-5): Painéis Carro 1 e Carro 2 + Conhecimento de Pneus */}
        <div className="xl:col-span-5 space-y-4">
          {/* Card Compacto: Conhecimento de Pneus & Compostos (Etapa 4C2) */}
          <PracticeTyreKnowledgeCard
            tyreKnowledge={sessionState.tyreKnowledge}
            latestObservation={
              sessionState.tyreObservations && sessionState.tyreObservations.length > 0
                ? sessionState.tyreObservations[sessionState.tyreObservations.length - 1]
                : undefined
            }
          />
          {/* Painel do Carro 1 */}
          <PracticeCarCockpitCard
            car={sessionState.cars.car1}
            carNumber={1}
            teamColor={team?.color}
            latestFeedback={
              sessionState.feedbacks
                ? [...sessionState.feedbacks].reverse().find((f) => f.carId === 'car1')
                : undefined
            }
            hasUnreadFeedback={sessionState.unreadFeedbackCarIds?.includes('car1')}
            knowledge={sessionState.knowledge}
            isSessionRunning={isRunning}
            isSessionCompleted={isCompleted}
            onOrderExitTrack={() => handleOrderExitTrack('car1')}
            onRequestBox={() => handleRequestBox('car1')}
            onMarkFeedbackRead={async () => {
              if (sessionState.unreadFeedbackCarIds?.includes('car1')) {
                const next = {
                  ...sessionState,
                  unreadFeedbackCarIds: sessionState.unreadFeedbackCarIds.filter(
                    (c) => c !== 'car1',
                  ),
                }
                setSessionState(next)
                await practiceSessionService.saveSessionState(next)
              }
            }}
          />

          {/* Painel do Carro 2 */}
          <PracticeCarCockpitCard
            car={sessionState.cars.car2}
            carNumber={2}
            teamColor={team?.color}
            latestFeedback={
              sessionState.feedbacks
                ? [...sessionState.feedbacks].reverse().find((f) => f.carId === 'car2')
                : undefined
            }
            hasUnreadFeedback={sessionState.unreadFeedbackCarIds?.includes('car2')}
            knowledge={sessionState.knowledge}
            isSessionRunning={isRunning}
            isSessionCompleted={isCompleted}
            onOrderExitTrack={() => handleOrderExitTrack('car2')}
            onRequestBox={() => handleRequestBox('car2')}
            onMarkFeedbackRead={async () => {
              if (sessionState.unreadFeedbackCarIds?.includes('car2')) {
                const next = {
                  ...sessionState,
                  unreadFeedbackCarIds: sessionState.unreadFeedbackCarIds.filter(
                    (c) => c !== 'car2',
                  ),
                }
                setSessionState(next)
                await practiceSessionService.saveSessionState(next)
              }
            }}
          />
        </div>
      </div>

      {/* 3. PARTE INFERIOR: CONTROLES DA SESSÃO + RÁDIO E FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel de Controles do Chefe de Equipe (lg:col-span-5) */}
        <Card className="lg:col-span-5 p-4 bg-[#090D15]/90 border border-[#1F2733] rounded-2xl shadow-xl space-y-4 font-mono">
          <div className="flex items-center justify-between border-b border-[#1A2333] pb-2.5">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Controles do Treino Livre
            </h4>
            <span className="text-[10px] text-[#8B95A7]">Comandos de Pista</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Play / Pause */}
            <Button
              type="button"
              disabled={isCompleted || !executorAuthorized}
              onClick={handleTogglePlayPause}
              className={`h-11 px-5 font-black text-xs uppercase flex items-center gap-2 shadow-lg ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-400 text-black'
                  : 'bg-[#00A6FB] hover:bg-[#0092DC] text-[#090D15]'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  PAUSAR TREINO
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  RETOMAR TREINO
                </>
              )}
            </Button>

            {/* Velocidade de Execução (1x, 2x, 4x) */}
            <div className="flex items-center gap-1 bg-[#0E1521] p-1 rounded-xl border border-[#1A2333]">
              {([1, 2, 4] as const).map((spd) => (
                <Button
                  key={spd}
                  size="sm"
                  variant="ghost"
                  disabled={!isRunning || !executorAuthorized}
                  onClick={() => handleChangeSpeed(spd)}
                  className={`h-8 px-2.5 text-xs font-black ${
                    sessionState.simSpeed === spd
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50'
                      : 'text-[#8B95A7] hover:text-white'
                  }`}
                >
                  {spd}x
                </Button>
              ))}
            </div>

            {/* Finalizar Sessão */}
            {!isCompleted ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleManualFinish}
                className="h-11 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold"
              >
                <Flag className="w-3.5 h-3.5 mr-1" />
                CONCLUIR TREINO
              </Button>
            ) : (
              onNavigateToWeekendTab && (
                <Button
                  type="button"
                  onClick={() => onNavigateToWeekendTab('race')}
                  className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  AVANÇAR NO FIM DE SEMANA
                </Button>
              )
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-[#0E1521] border border-[#1A2333] text-[11px] text-[#8B95A7] space-y-1">
            <div className="flex justify-between">
              <span>Status do Executor:</span>
              <span
                className={
                  executorAuthorized ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'
                }
              >
                {executorAuthorized ? 'Aba Principal Autorizada' : 'Modo Visualizador'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Revisão do Estado:</span>
              <span className="text-white font-bold">rev #{sessionState.revision}</span>
            </div>
          </div>
        </Card>

        {/* Rádio & Feed de Eventos (lg:col-span-7) */}
        <div className="lg:col-span-7">
          <PracticeRadioFeed events={sessionState.radioFeed} />
        </div>
      </div>
    </div>
  )
}
