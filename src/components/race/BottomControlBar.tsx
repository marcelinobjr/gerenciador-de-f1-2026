import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Play,
  Pause,
  Square,
  FastForward,
  Flame,
  Sun,
  CloudRain,
  StepForward,
  Loader2,
} from 'lucide-react'

export interface BottomControlBarProps {
  isSimulating: boolean
  isFinished: boolean
  isSuspended: boolean
  isRestartPending: boolean
  isAwaitingWeatherDecision: boolean
  currentSimSpeed: 1 | 2 | 4
  raceTimeFormatted: string
  currentLap?: number
  totalLaps?: number
  isProcessingBatch?: boolean
  fastestLap?: {
    driverName: string
    lapTimeFormatted: string
    lap: number
  }
  weatherCondition?: string
  trackWetness?: number
  onTogglePlayPause: () => void
  onStepOneLap?: () => void
  onStopOrReset?: () => void
  onChangeSpeed: (speed: 1 | 2 | 4) => void
  onAdvanceLaps: (count: number) => void
  onSimulateRest: () => void
  compact?: boolean
}

export const BottomControlBar: React.FC<BottomControlBarProps> = ({
  isSimulating,
  isFinished,
  isSuspended,
  isRestartPending,
  isAwaitingWeatherDecision,
  currentSimSpeed,
  raceTimeFormatted,
  currentLap,
  totalLaps,
  isProcessingBatch = false,
  fastestLap,
  weatherCondition,
  trackWetness,
  onTogglePlayPause,
  onStepOneLap,
  onStopOrReset,
  onChangeSpeed,
  onAdvanceLaps,
  onSimulateRest,
  compact = false,
}) => {
  const isWet =
    weatherCondition === 'wet' ||
    weatherCondition === 'chuva_extrema' ||
    (typeof trackWetness === 'number' && trackWetness > 20)

  const isBlocked =
    isFinished || isAwaitingWeatherDecision || isSuspended || isRestartPending || isProcessingBatch

  return (
    <Card className="bg-[#080d1a] border border-slate-800/90 rounded-xl shadow-xl overflow-hidden text-white font-mono">
      <CardContent
        className={`${compact ? 'p-1.5 sm:p-2' : 'p-3 sm:p-4'} flex flex-wrap items-center justify-between gap-1.5 sm:gap-2.5`}
      >
        {/* BLOCO DA ESQUERDA: CONTROLES DE REPRODUÇÃO E AVANÇO */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
          {/* PLAY / PAUSE */}
          <Button
            type="button"
            size="sm"
            disabled={isBlocked && !isSimulating}
            onClick={onTogglePlayPause}
            className={`${compact ? 'h-7 px-2.5' : 'h-9 px-4'} rounded-lg flex items-center justify-center gap-1 shadow-md transition-transform active:scale-95 ${
              isBlocked && isAwaitingWeatherDecision
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : isSimulating
                  ? 'bg-amber-500 hover:bg-amber-400 text-black font-bold'
                  : 'bg-[#e10600] hover:bg-[#c00400] text-white font-bold'
            }`}
            title={
              isAwaitingWeatherDecision
                ? 'Aguardando Decisão Climática'
                : isSimulating
                  ? 'Pausar simulação'
                  : 'Iniciar reprodução (Play)'
            }
          >
            {isProcessingBatch ? (
              <>
                <Loader2 className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} animate-spin`} />
                <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-black uppercase`}>
                  Processando...
                </span>
              </>
            ) : isAwaitingWeatherDecision ? (
              <span
                className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-black uppercase tracking-wider`}
              >
                Aguardando Decisão
              </span>
            ) : isSimulating ? (
              <>
                <Pause className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill-current`} />
                <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-black uppercase`}>
                  ❚❚ PAUSE
                </span>
              </>
            ) : (
              <>
                <Play className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill-current`} />
                <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-black uppercase`}>
                  ▶ PLAY
                </span>
              </>
            )}
          </Button>

          {/* BOTÃO +1 VOLTA (STEP LAP CANÔNICO) */}
          {onStepOneLap && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isBlocked || isSimulating}
              onClick={onStepOneLap}
              className={`${compact ? 'h-7 px-2 text-[9px]' : 'h-9 px-3 text-[11px]'} rounded-lg bg-[#0d1527] border-slate-700 hover:bg-slate-800 text-cyan-300 font-black gap-1 shadow-sm transition-all hover:border-cyan-500/50`}
              title="Avança exatamente UMA volta canônica e permanece pausado"
            >
              <StepForward className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
              +1 VOLTA
            </Button>
          )}

          {/* STOP / RESET (SE FORNECIDO) */}
          {onStopOrReset && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isProcessingBatch}
              onClick={onStopOrReset}
              className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} rounded-lg bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 p-0 flex items-center justify-center shadow-sm`}
              title="Reiniciar Corrida"
            >
              <Square
                className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill-current text-slate-400`}
              />
            </Button>
          )}

          {/* VELOCIDADES 1x / 2x / 4x */}
          <div className="flex items-center bg-[#0d1527] border border-slate-800 rounded-lg p-0.5 gap-0.5">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                disabled={isProcessingBatch}
                onClick={() => onChangeSpeed(spd)}
                className={`${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[11px]'} font-black rounded transition-all ${
                  currentSimSpeed === spd
                    ? 'bg-slate-800 text-cyan-300 shadow-xs font-mono border border-slate-700/80'
                    : 'text-slate-400 hover:text-white'
                } ${isProcessingBatch ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={`Velocidade ${spd}x (${spd === 1 ? 'Base' : spd === 2 ? '2x' : '4x'})`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* +5 VOLTAS */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBlocked || isSimulating}
            onClick={() => onAdvanceLaps(5)}
            className={`${compact ? 'h-7 px-2 text-[9px]' : 'h-9 px-3 text-[11px]'} rounded-lg bg-[#0d1527] border-slate-800 hover:bg-slate-800 text-slate-200 font-bold gap-1 shadow-sm`}
            title="Avança 5 voltas canônicas sequenciais"
          >
            <FastForward className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-cyan-400`} />
            +5 VOLTAS
          </Button>

          {/* +10 VOLTAS */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBlocked || isSimulating}
            onClick={() => onAdvanceLaps(10)}
            className={`${compact ? 'h-7 px-2 text-[9px]' : 'h-9 px-3 text-[11px]'} rounded-lg bg-[#0d1527] border-slate-800 hover:bg-slate-800 text-slate-200 font-bold gap-1 shadow-sm`}
            title="Avança 10 voltas canônicas sequenciais"
          >
            <FastForward className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-amber-400`} />
            +10 VOLTAS
          </Button>

          {/* SIMULAR ATÉ O FIM */}
          <Button
            type="button"
            size="sm"
            disabled={isBlocked || isSimulating}
            onClick={onSimulateRest}
            className={`${compact ? 'h-7 px-2 text-[9px]' : 'h-9 px-3 text-[11px]'} rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white font-black gap-1 shadow-sm uppercase`}
            title="Simula todas as voltas restantes usando o motor canônico"
          >
            <Flame
              className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-400 fill-current`}
            />
            SIMULAR ATÉ O FIM
          </Button>
        </div>

        {/* BLOCO DA DIREITA: VOLTA ATUAL, TEMPO, VOLTA MAIS RÁPIDA, CONDIÇÕES */}
        <div
          className={`flex flex-wrap items-center ${compact ? 'gap-2 sm:gap-2.5 text-[10px]' : 'gap-3 sm:gap-4 text-xs'}`}
        >
          {/* VOLTA ATUAL */}
          {typeof currentLap === 'number' && (
            <div className={`border-r border-slate-800/80 ${compact ? 'pr-2' : 'pr-3'}`}>
              <span
                className={`${compact ? 'text-[8px]' : 'text-[9px]'} uppercase font-sans font-bold text-slate-400 block leading-tight`}
              >
                VOLTA
              </span>
              <span
                className={`${compact ? 'text-xs' : 'text-xs sm:text-sm'} font-black text-white tracking-wider block`}
              >
                {currentLap}
                {typeof totalLaps === 'number' && (
                  <span
                    className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-slate-500 font-normal`}
                  >
                    /{totalLaps}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* TEMPO DE CORRIDA */}
          <div>
            <span
              className={`${compact ? 'text-[8px]' : 'text-[9px]'} uppercase font-sans font-bold text-slate-400 block leading-tight`}
            >
              TEMPO DE CORRIDA
            </span>
            <span
              className={`${compact ? 'text-xs' : 'text-xs sm:text-sm'} font-black text-white tracking-wider block`}
            >
              {raceTimeFormatted || '0:00:00'}
            </span>
          </div>

          {/* VOLTA MAIS RÁPIDA */}
          <div className="hidden sm:block">
            <span
              className={`${compact ? 'text-[8px]' : 'text-[9px]'} uppercase font-sans font-bold text-slate-400 block leading-tight`}
            >
              VOLTA MAIS RÁPIDA
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-black text-purple-400`}>
                {fastestLap?.lapTimeFormatted || '—'}
              </span>
              {fastestLap?.driverName && (
                <span
                  className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-slate-300 uppercase font-semibold`}
                >
                  {fastestLap.driverName} (V{fastestLap.lap})
                </span>
              )}
            </div>
          </div>

          {/* CONDIÇÕES DE PISTA */}
          <div>
            <span
              className={`${compact ? 'text-[8px]' : 'text-[9px]'} uppercase font-sans font-bold text-slate-400 block leading-tight`}
            >
              CONDIÇÕES
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              {isWet ? (
                <>
                  <CloudRain className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-cyan-400`} />
                  <span
                    className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-bold text-cyan-300`}
                  >
                    Molhada
                  </span>
                </>
              ) : (
                <>
                  <Sun className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-400`} />
                  <span
                    className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-bold text-slate-200`}
                  >
                    Seca
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
