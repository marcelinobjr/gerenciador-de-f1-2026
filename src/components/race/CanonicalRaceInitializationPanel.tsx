import React, { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Play, AlertTriangle, Trophy } from 'lucide-react'
import type {
  CanonicalRaceState,
  DriverPaceMode,
  CanonicalRaceDriverState,
} from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'
import { CanonicalWeatherDecisionModal } from './CanonicalWeatherDecisionModal'
import type { WeatherDecisionAction } from '@/types/canonical-race-v2'

// Novos subcomponentes modulares de apresentação do Race Control
import { RaceTopBar } from './RaceTopBar'
import { TimingTower } from './TimingTower'
import { RaceControlPanel } from './RaceControlPanel'
import { RecentEventsFeed } from './RecentEventsFeed'
import { PlayerCarCards } from './PlayerCarCards'
import { CompactPlayerDriverStrips } from './CompactPlayerDriverStrips'
import { BottomControlBar } from './BottomControlBar'
import { DriverStrategyModal } from './DriverStrategyModal'
import { CircuitMiniMap } from './CircuitMiniMap'
import { RACE_PLAYBACK_CONFIG, type RacePlaybackSpeed } from '@/constants/racePlaybackConfig'

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
  /**
   * RACE-CONTROL-COMPACT-01: Quando true, ativa layout de alta densidade sem scroll
   * e substitui os cards grandes de piloto por faixas horizontais compactas.
   */
  compactMode?: boolean
}

export const CanonicalRaceInitializationPanel: React.FC<CanonicalRaceInitializationPanelProps> = ({
  raceState,
  onResetGrid: _onResetGrid,
  onAdvanceOneLap,
  onAdvanceMultipleLaps,
  onResetRace,
  onForceFlag: _onForceFlag,
  onRequestPit,
  onCancelPit,
  onSetPaceMode,
  onSetTargetCompound,
  onManualSave: _onManualSave,
  onOfficializeRace,
  hasOfficialResult = false,
  onSubmitWeatherDecision,
  onTriggerRedFlag,
  onPrepareRestart,
  onResumeRace,
  onChangeSuspensionTyre,
  compactMode = false,
}) => {
  const [isSimulating, setIsSimulating] = useState(false)
  const [simSpeed, setSimSpeed] = useState<RacePlaybackSpeed>(1)
  const [strategyModalDriver, setStrategyModalDriver] = useState<CanonicalRaceDriverState | null>(
    null,
  )
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)

  const isAwaitingWeatherDecision = raceState.status === 'awaiting_player_weather_decision'
  const leaderDriver =
    raceState.drivers[0] || raceState.drivers.find((d) => d.currentPosition === 1)
  const playerDrivers = raceState.drivers.filter((d) => d.isPlayer)
  const isFinished = raceState.status === 'completed'
  const isSuspended = raceState.status === 'suspended' || raceState.status === 'red_flag'
  const isRestartPending = raceState.status === 'restart_pending'
  const rc = raceState.raceControl

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
  // Cadência canônica configurada via RACE_PLAYBACK_CONFIG (50% mais lenta)
  const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (
      !isSimulating ||
      isFinished ||
      isAwaitingWeatherDecision ||
      isSuspended ||
      isRestartPending ||
      isProcessingBatch ||
      !onAdvanceOneLap
    ) {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current)
        simulationIntervalRef.current = null
      }
      return
    }

    const intervalMs = RACE_PLAYBACK_CONFIG.resolveIntervalMs(simSpeed)
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
    isProcessingBatch,
    onAdvanceOneLap,
  ])

  // Desativa simulação se a corrida for pausada ou finalizada
  useEffect(() => {
    if (isFinished || isAwaitingWeatherDecision || isSuspended || isRestartPending) {
      setIsSimulating(false)
    }
  }, [isFinished, isAwaitingWeatherDecision, isSuspended, isRestartPending])

  const handleTogglePlayPause = () => {
    if (
      isFinished ||
      isAwaitingWeatherDecision ||
      isSuspended ||
      isRestartPending ||
      isProcessingBatch
    ) {
      return
    }

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

  /**
   * RACE-CONTROL-COMPACT-01: STEP LAP (+1 VOLTA)
   * Garante pausa imediata, executa exatamente UMA volta canônica com o mesmo fluxo normal
   * e permanece pausado. Bloqueia comandos incompatíveis durante a execução.
   */
  const handleStepOneLap = () => {
    if (
      !onAdvanceOneLap ||
      isFinished ||
      isAwaitingWeatherDecision ||
      isSuspended ||
      isRestartPending ||
      isProcessingBatch
    ) {
      return
    }
    setIsSimulating(false)
    setIsProcessingBatch(true)
    try {
      onAdvanceOneLap()
    } finally {
      setIsProcessingBatch(false)
    }
  }

  /**
   * Avanço de múltiplas voltas (+5 / +10):
   * Pausa, ativa bloqueio de concorrência, invoca avanço sequencial e restaura estado.
   */
  const handleAdvanceLapsBatch = (count: number) => {
    if (
      !onAdvanceMultipleLaps ||
      isFinished ||
      isAwaitingWeatherDecision ||
      isSuspended ||
      isRestartPending ||
      isProcessingBatch
    ) {
      return
    }
    setIsSimulating(false)
    setIsProcessingBatch(true)
    try {
      onAdvanceMultipleLaps(count)
    } finally {
      setIsProcessingBatch(false)
    }
  }

  const handleSimulateRest = () => {
    if (!onAdvanceMultipleLaps || isFinished || isProcessingBatch) return
    setIsSimulating(false)
    setIsProcessingBatch(true)
    try {
      const remainingLaps = Math.max(1, raceState.totalLaps - (leaderDriver?.lap ?? 0))
      onAdvanceMultipleLaps(remainingLaps)
    } finally {
      setIsProcessingBatch(false)
    }
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
    <div className={`font-sans text-white ${compactMode ? 'space-y-1.5 text-xs' : 'space-y-4'}`}>
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
        compact={compactMode}
      />

      {/* BANNER DE RELARGADA / SUSPENSÃO (QUANDO HOUVER RED FLAG OU SUSPENSÃO) */}
      {(isSuspended || isRestartPending) && (
        <Card className="bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/80 border border-red-500/50 p-3 sm:p-4 rounded-xl shadow-xl">
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
                  className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-black gap-1.5 h-8 px-3 shadow-md"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Preparar Relargada
                </Button>
              )}
              {isRestartPending && onResumeRace && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onResumeRace}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black gap-1.5 h-8 px-3 shadow-md"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Autorizar Relargada
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* 2. LAYOUT PRINCIPAL: TIMING TOWER À ESQUERDA + ÁREA CENTRAL COM CARDS E PAINÉIS LATERAIS */}
      <div className={`flex flex-col lg:flex-row items-start ${compactMode ? 'gap-2' : 'gap-4'}`}>
        {/* TIMING TOWER OFICIAL À ESQUERDA (P1..P24 COM LOGOS E GAPS) */}
        <TimingTower
          drivers={raceState.drivers}
          totalLaps={raceState.totalLaps}
          playerDriverIds={playerDrivers.map((d) => d.driverId)}
          compact={compactMode}
        />

        {/* ÁREA CENTRAL / DIREITA: CARDS DOS CARROS DO JOGADOR + RACE CONTROL + EVENTOS RECENTES */}
        <div className={`flex-1 w-full ${compactMode ? 'space-y-2' : 'space-y-4'}`}>
          {/* CARROS DO JOGADOR: FAIXAS COMPACTAS (compactMode) OU CARDS COMPLETOS */}
          {playerDrivers.length > 0 &&
            (compactMode ? (
              <CompactPlayerDriverStrips
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
                isActionBlocked={isProcessingBatch}
              />
            ) : (
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
            ))}

          {/* PAINÉIS LATERAIS: CIRCUITO (PRIORIDADE 1) + ESTADO DA CORRIDA + EVENTOS RECENTES */}
          <div
            className={`grid grid-cols-1 ${compactMode ? 'md:grid-cols-3 gap-2' : 'md:grid-cols-2 gap-4'}`}
          >
            <CircuitMiniMap
              circuitName={raceState.circuitName}
              circuitCountry={raceState.circuitCountry}
              round={raceState.round}
              compact={compactMode}
            />

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
              compact={compactMode}
            />

            <RecentEventsFeed
              events={raceState.events}
              maxItems={compactMode ? 3 : 6}
              compact={compactMode}
            />
          </div>

          {/* PAINEL DE CONTROLES AVANÇADOS DE QA E FORÇAR BANDEIRAS */}
          <Card
            className={`bg-[#090d18] border border-slate-800/80 rounded-xl shadow-xs ${compactMode ? 'p-1.5' : 'p-2.5'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 font-mono">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Controles de QA (Forçar Race Control):
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision || isProcessingBatch}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'GREEN' })}
                  className="h-6 px-1.5 text-[9px] font-bold bg-emerald-950/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/60 font-mono"
                >
                  🟢 Green
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision || isProcessingBatch}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'YELLOW_LOCAL' })}
                  className="h-6 px-1.5 text-[9px] font-bold bg-yellow-950/40 text-yellow-300 border-yellow-700/50 hover:bg-yellow-900/60 font-mono"
                >
                  🟡 Yellow Local
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision || isProcessingBatch}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'YELLOW' })}
                  className="h-6 px-1.5 text-[9px] font-bold bg-amber-950/40 text-amber-300 border-amber-700/50 hover:bg-amber-900/60 font-mono"
                >
                  🟡 Yellow Geral
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision || isProcessingBatch}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'VSC' })}
                  className="h-6 px-1.5 text-[9px] font-bold bg-amber-950/40 text-amber-300 border-amber-600/50 hover:bg-amber-900/60 font-mono"
                >
                  🟡 VSC
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision || isProcessingBatch}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'SAFETY_CAR' })}
                  className="h-6 px-1.5 text-[9px] font-bold bg-orange-950/40 text-orange-300 border-orange-600/50 hover:bg-orange-900/60 font-mono"
                >
                  🚨 Safety Car
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isFinished || isAwaitingWeatherDecision || isProcessingBatch}
                  onClick={() => onAdvanceOneLap?.({ forceRaceControlStatus: 'RESTART' })}
                  className="h-6 px-1.5 text-[9px] font-bold bg-emerald-950/40 text-cyan-300 border-cyan-600/50 hover:bg-cyan-900/60 font-mono"
                >
                  🟢 SC Restart
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    isFinished || isAwaitingWeatherDecision || isSuspended || isProcessingBatch
                  }
                  onClick={() => {
                    if (onTriggerRedFlag) {
                      onTriggerRedFlag()
                    } else {
                      onAdvanceOneLap?.({ forceRaceControlStatus: 'RED_FLAG' })
                    }
                  }}
                  className="h-6 px-1.5 text-[9px] font-bold bg-red-950/50 text-red-300 border-red-600/60 hover:bg-red-900/70 font-mono"
                >
                  🔴 Red Flag
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 3. BARRA DE CONTROLE INFERIOR FIXA (PLAY/PAUSE, +1 VOLTA, 1x/2x/4x, +5/+10V, SIMULAR TUDO) */}
      <BottomControlBar
        isSimulating={isSimulating}
        isFinished={isFinished}
        isSuspended={isSuspended}
        isRestartPending={isRestartPending}
        isAwaitingWeatherDecision={isAwaitingWeatherDecision}
        currentSimSpeed={simSpeed}
        raceTimeFormatted={formatRaceTime(leaderDriver?.raceTime ?? 0)}
        currentLap={leaderDriver?.lap ?? raceState.currentLap ?? 0}
        totalLaps={raceState.totalLaps}
        isProcessingBatch={isProcessingBatch}
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
        onStepOneLap={handleStepOneLap}
        onStopOrReset={onResetRace}
        onChangeSpeed={(spd) => setSimSpeed(spd)}
        onAdvanceLaps={handleAdvanceLapsBatch}
        onSimulateRest={handleSimulateRest}
        compact={compactMode}
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
