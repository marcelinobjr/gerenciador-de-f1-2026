import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Play,
  FastForward,
  Flame,
  AlertTriangle,
  ShieldCheck,
  Trophy,
  RotateCcw,
} from 'lucide-react'
import type {
  CanonicalRaceState,
  DriverPaceMode,
  CanonicalRaceDriverState,
} from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'
import { resolveTrackFromCircuitName } from './tracks'
import { CanonicalWeatherDecisionModal } from './CanonicalWeatherDecisionModal'
import type { WeatherDecisionAction } from '@/types/canonical-race-v2'

// Novos subcomponentes modulares de apresentação do Race Control
import { RaceTopBar } from './RaceTopBar'
import { TimingTower } from './TimingTower'
import { RaceControlPanel } from './RaceControlPanel'
import { RecentEventsFeed } from './RecentEventsFeed'
import { PlayerCarCards } from './PlayerCarCards'
import { BottomControlBar } from './BottomControlBar'
import { DriverStrategyModal } from './DriverStrategyModal'

export interface CanonicalRaceInitializationPanelProps {
  raceState: CanonicalRaceState
  onResetGrid?: () => void
  onAdvanceOneLap?: (options?: {
    forceRaceControlStatus?: import('@/types/canonical-race-v2').RaceControlStatus
  }) => void
  onAdvanceMultipleLaps?: (count: number) => void
  onResetRace?: () => void
  onForceFlag?: (flag: import('@/types/canonical-race-v2').RaceControlStatus) => void
  onRequestPit?: (driverId: string, compound?: TireCompound) => void
  onCancelPit?: (driverId: string) => void
  onSetPaceMode?: (driverId: string, mode: DriverPaceMode) => void
  onSetTargetCompound?: (driverId: string, compound: TireCompound) => void
  onManualSave?: () => void
  onOfficializeRace?: () => void
  hasOfficialResult?: boolean
  onSubmitWeatherDecision?: (
    driverId: string,
    action: WeatherDecisionAction,
    selectedCompound?: TireCompound,
  ) =>
    | Promise<{ success: boolean; error?: string } | void>
    | { success: boolean; error?: string }
    | void
  onTriggerRedFlag?: () => void
  onPrepareRestart?: () => void
  onResumeRace?: () => void
  onChangeSuspensionTyre?: (driverId: string, compound: TireCompound) => void
}

export const CanonicalRaceInitializationPanel: React.FC<CanonicalRaceInitializationPanelProps> = ({
  raceState,
  onResetGrid,
  onAdvanceOneLap,
  onAdvanceMultipleLaps,
  onResetRace,
  onRequestPit,
  onCancelPit,
  onSetPaceMode,
  onSetTargetCompound,
  onManualSave,
  onOfficializeRace,
  hasOfficialResult = false,
  onSubmitWeatherDecision,
  onTriggerRedFlag,
  onPrepareRestart,
  onResumeRace,
  onChangeSuspensionTyre,
}) => {
  const [isSimulating, setIsSimulating] = useState(false)
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 4>(1)
  const [strategyModalDriver, setStrategyModalDriver] = useState<CanonicalRaceDriverState | null>(
    null,
  )

  const isAwaitingWeatherDecision = raceState.status === 'awaiting_player_weather_decision'
  const leaderDriver =
    raceState.drivers[0] || raceState.drivers.find((d) => d.currentPosition === 1)
  const playerDrivers = raceState.drivers.filter((d) => d.isPlayer)
  const isFinished = raceState.status === 'completed'
  const isNotStarted = raceState.status === 'not_started'
  const isSuspended = raceState.status === 'suspended' || raceState.status === 'red_flag'
  const isRestartPending = raceState.status === 'restart_pending'
  const rc = raceState.raceControl

  // Circuito resolvido a partir do fim de semana / raceState
  const resolvedTrack = resolveTrackFromCircuitName(
    raceState.circuitName || raceState.circuitCountry,
  )

  const currentFlag =
    rc?.currentFlag ||
    (raceState.safetyCarActive
      ? 'SAFETY_CAR'
      : raceState.vscActive
        ? 'VSC'
        : raceState.redFlagActive
          ? isRestartPending
            ? 'RESTART'
            : 'RED_FLAG'
          : raceState.status === 'completed'
            ? 'FINISHED'
            : 'GREEN')

  // Loop automático quando "Simulando" com velocidade 1x/2x/4x
  const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (
      !isSimulating ||
      isFinished ||
      isAwaitingWeatherDecision ||
      isSuspended ||
      isRestartPending ||
      !onAdvanceOneLap
    ) {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current)
        simulationIntervalRef.current = null
      }
      return
    }

    const intervalMs = Math.round(1000 / simSpeed)
    simulationIntervalRef.current = setInterval(() => {
      onAdvanceOneLap()
    }, intervalMs)

    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current)
        simulationIntervalRef.current = null
      }
    }
  }, [
    isSimulating,
    simSpeed,
    isFinished,
    isAwaitingWeatherDecision,
    isSuspended,
    isRestartPending,
    onAdvanceOneLap,
  ])

  // Desativa simulação se a corrida for pausada ou finalizada
  useEffect(() => {
    if (isFinished || isAwaitingWeatherDecision || isSuspended || isRestartPending) {
      setIsSimulating(false)
    }
  }, [isFinished, isAwaitingWeatherDecision, isSuspended, isRestartPending])

  const handleTogglePlayPause = () => {
    if (isFinished || isAwaitingWeatherDecision || isSuspended || isRestartPending) return

    if (isSimulating) {
      setIsSimulating(false)
    } else {
      // Se não estiver simulando, executa imediatamente 1 volta e liga autoplay
      if (onAdvanceOneLap) {
        onAdvanceOneLap()
      }
      setIsSimulating(true)
    }
  }

  const handleSimulateRest = () => {
    if (!onAdvanceMultipleLaps || isFinished) return
    setIsSimulating(false)
    const remainingLaps = Math.max(1, raceState.totalLaps - (leaderDriver?.lap ?? 0))
    onAdvanceMultipleLaps(remainingLaps)
  }

  // Formatação do tempo acumulado de corrida em HH:MM:SS ou MM:SS
  const formatRaceTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00:00'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <div className="space-y-4 font-sans text-white">
      {/* 1. TOP BAR OFICIAL DO GP / CIRCUITO / BANDEIRA / CLIMA */}
      <RaceTopBar
        circuitName={raceState.circuitName}
        circuitCountry={raceState.circuitCountry}
        round={raceState.round}
        currentLap={leaderDriver?.lap ?? raceState.currentLap ?? 0}
        totalLaps={raceState.totalLaps}
        currentFlag={currentFlag}
        weather={raceState.weather}
        weatherTransitions={raceState.weatherTransitions}
        activeSector={rc?.activeSector}
        isSuspended={isSuspended}
        isRestartPending={isRestartPending}
      />

      {/* BANNER DE RELARGADA / SUSPENSÃO (QUANDO HOUVER RED FLAG OU SUSPENSÃO) */}
      {(isSuspended || isRestartPending) && (
        <Card className="bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/80 border border-red-500/50 p-4 rounded-2xl shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Badge className="bg-red-600 text-white font-black text-[10px] uppercase tracking-wider">
                {isSuspended ? 'CORRIDA SUSPENSA • BANDEIRA VERMELHA' : 'RESTART PENDENTE'}
              </Badge>
              <p className="text-xs text-slate-300">
                {isSuspended
                  ? 'Os carros estão parados no pit lane. Trocas de pneus são autorizadas sem custo competitivo de parada.'
                  : 'O pelotão está ordenado para relargada em bandeira verde. Autorize a largada para retomar a prova.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSuspended && onPrepareRestart && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onPrepareRestart}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-black gap-1.5 h-9 px-3.5 shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Preparar Relargada
                </Button>
              )}
              {isRestartPending && onResumeRace && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onResumeRace}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black gap-1.5 h-9 px-3.5 shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Autorizar Relargada
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* 2. LAYOUT PRINCIPAL: TIMING TOWER À ESQUERDA + ÁREA CENTRAL COM CARDS E PAINÉIS LATERAIS */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* TIMING TOWER OFICIAL À ESQUERDA (P1..P24 COM LOGOS E GAPS) */}
        <TimingTower
          drivers={raceState.drivers}
          totalLaps={raceState.totalLaps}
          playerDriverIds={playerDrivers.map((d) => d.driverId)}
        />

        {/* ÁREA CENTRAL / DIREITA: CARDS DOS CARROS DO JOGADOR + RACE CONTROL + EVENTOS RECENTES */}
        <div className="flex-1 w-full space-y-4">
          {/* CARDS DOS PILOTOS DO JOGADOR (CARRO 1 E CARRO 2) */}
          {playerDrivers.length > 0 && (
            <PlayerCarCards
              playerDrivers={playerDrivers}
              currentLap={leaderDriver?.lap ?? raceState.currentLap ?? 0}
              onRequestPit={(driverId, compound) => {
                if (isSuspended && onChangeSuspensionTyre && compound) {
                  onChangeSuspensionTyre(driverId, compound)
                } else {
                  onRequestPit?.(driverId, compound)
                }
              }}
              onCancelPit={(driverId) => onCancelPit?.(driverId)}
              onSetPaceMode={(driverId, mode) => onSetPaceMode?.(driverId, mode)}
              onSetTargetCompound={(driverId, comp) => {
                if (isSuspended && onChangeSuspensionTyre) {
                  onChangeSuspensionTyre(driverId, comp)
                } else {
                  onSetTargetCompound?.(driverId, comp)
                }
              }}
              onOpenStrategyModal={(driver) => setStrategyModalDriver(driver)}
              isRaceFinished={isFinished}
              isRedFlagActive={currentFlag === 'RED_FLAG' || isSuspended}
              onChangeSuspensionTyre={onChangeSuspensionTyre}
            />
          )}

          {/* PAINÉIS LATERAIS DE CONTROLE E FEED DE EVENTOS RECENTES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RaceControlPanel
              currentFlag={currentFlag}
              safetyCarActive={raceState.safetyCarActive}
              vscActive={raceState.vscActive}
              redFlagActive={raceState.redFlagActive}
              isSuspended={isSuspended}
              currentLap={leaderDriver?.lap ?? raceState.currentLap ?? 0}
              weatherCondition={
                typeof raceState.weather === 'string'
                  ? raceState.weather
                  : (raceState.weather as any)?.condition
              }
            />

            <RecentEventsFeed events={raceState.events} maxItems={6} />
          </div>

          {/* PAINEL DE CONTROLES AVANÇADOS DE QA E FORÇAR BANDEIRAS */}
          <Card className="bg-[#090d18] border border-slate-800/80 rounded-2xl shadow-sm p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 font-mono">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Controles de QA (Forçar Race Control):
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'GREEN' })}
                  className="h-7 px-2 text-[10px] font-bold bg-emerald-950/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/60 font-mono"
                >
                  🟢 Green
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'YELLOW_LOCAL' })}
                  className="h-7 px-2 text-[10px] font-bold bg-yellow-950/40 text-yellow-300 border-yellow-700/50 hover:bg-yellow-900/60 font-mono"
                >
                  🟡 Yellow Local
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'YELLOW' })}
                  className="h-7 px-2 text-[10px] font-bold bg-amber-950/40 text-amber-300 border-amber-700/50 hover:bg-amber-900/60 font-mono"
                >
                  🟡 Yellow Geral
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'VSC' })}
                  className="h-7 px-2 text-[10px] font-bold bg-amber-950/40 text-amber-300 border-amber-600/50 hover:bg-amber-900/60 font-mono"
                >
                  🟡 VSC
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'SAFETY_CAR' })}
                  className="h-7 px-2 text-[10px] font-bold bg-orange-950/40 text-orange-300 border-orange-600/50 hover:bg-orange-900/60 font-mono"
                >
                  🚨 Safety Car
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'RESTART' })}
                  className="h-7 px-2 text-[10px] font-bold bg-emerald-950/40 text-cyan-300 border-cyan-600/50 hover:bg-cyan-900/60 font-mono"
                >
                  🟢 SC Restart
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision || isSuspended}
                  onClick={() => {
                    if (onTriggerRedFlag) {
                      onTriggerRedFlag()
                    } else {
                      onAdvanceOneLap?.({ forceRaceControlStatus: 'RED_FLAG' })
                    }
                  }}
                  className="h-7 px-2 text-[10px] font-bold bg-red-950/50 text-red-300 border-red-600/60 hover:bg-red-900/70 font-mono"
                >
                  🔴 Red Flag
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 3. BARRA DE CONTROLE INFERIOR FIXA (PLAY/PAUSE, 1x/2x/4x, +5/+10V, SIMULAR TUDO, TEMPO, VOLTA MAIS RÁPIDA) */}
      <BottomControlBar
        isSimulating={isSimulating}
        isFinished={isFinished}
        isSuspended={isSuspended}
        isRestartPending={isRestartPending}
        isAwaitingWeatherDecision={isAwaitingWeatherDecision}
        currentSimSpeed={simSpeed}
        raceTimeFormatted={formatRaceTime(leaderDriver?.raceTime ?? 0)}
        fastestLap={raceState.fastestLap}
        weatherCondition={
          typeof raceState.weather === 'string'
            ? raceState.weather
            : (raceState.weather as any)?.condition
        }
        trackWetness={
          typeof raceState.weather === 'object'
            ? (raceState.weather as any)?.trackWetness
            : undefined
        }
        onTogglePlayPause={handleTogglePlayPause}
        onStopOrReset={onResetRace}
        onChangeSpeed={(spd) => setSimSpeed(spd)}
        onAdvanceLaps={(cnt) => onAdvanceMultipleLaps?.(cnt)}
        onSimulateRest={handleSimulateRest}
      />

      {/* MODAL CANÔNICO DE DECISÃO CLIMÁTICA DO JOGADOR (E1A/E1B) */}
      <CanonicalWeatherDecisionModal
        raceState={raceState}
        onSubmitDecision={onSubmitWeatherDecision}
      />

      {/* MODAL DE ESTRATÉGIA DO PILOTO (ACIONADO PELO BOTÃO ESTRATÉGIA NO CARD DO CARRO) */}
      <DriverStrategyModal
        driver={strategyModalDriver}
        open={!!strategyModalDriver}
        onClose={() => setStrategyModalDriver(null)}
        onRequestPit={(driverId, comp) => {
          if (isSuspended && onChangeSuspensionTyre && comp) {
            onChangeSuspensionTyre(driverId, comp)
          } else {
            onRequestPit?.(driverId, comp)
          }
        }}
        onCancelPit={(driverId) => onCancelPit?.(driverId)}
        onSetPaceMode={(driverId, mode) => onSetPaceMode?.(driverId, mode)}
        onSetTargetCompound={(driverId, comp) => {
          if (isSuspended && onChangeSuspensionTyre) {
            onChangeSuspensionTyre(driverId, comp)
          } else {
            onSetTargetCompound?.(driverId, comp)
          }
        }}
        isRaceFinished={isFinished}
        isRedFlagActive={currentFlag === 'RED_FLAG' || isSuspended}
        onChangeSuspensionTyre={onChangeSuspensionTyre}
      />

      {/* BOTÃO PARA OFICIALIZAR RESULTADO AO FINAL DA PROVA */}
      {isFinished && onOfficializeRace && !hasOfficialResult && (
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            size="lg"
            onClick={onOfficializeRace}
            className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-black gap-2 px-6 shadow-xl"
          >
            <Trophy className="w-5 h-5 fill-current" />
            Oficializar Resultado da Corrida
          </Button>
        </div>
      )}
    </div>
  )
}
