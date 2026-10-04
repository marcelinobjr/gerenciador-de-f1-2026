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
  RotateCcw,
  Sparkles,
} from 'lucide-react'

export interface BottomControlBarProps {
  isSimulating: boolean
  isFinished: boolean
  isSuspended: boolean
  isRestartPending: boolean
  isAwaitingWeatherDecision: boolean
  currentSimSpeed: 1 | 2 | 4
  raceTimeFormatted: string
  fastestLap?: {
    driverName: string
    lapTimeFormatted: string
    lap: number
  }
  weatherCondition?: string
  trackWetness?: number
  onTogglePlayPause: () => void
  onStopOrReset?: () => void
  onChangeSpeed: (speed: 1 | 2 | 4) => void
  onAdvanceLaps: (count: number) => void
  onSimulateRest: () => void
}

export const BottomControlBar: React.FC<BottomControlBarProps> = ({
  isSimulating,
  isFinished,
  isSuspended,
  isRestartPending,
  isAwaitingWeatherDecision,
  currentSimSpeed,
  raceTimeFormatted,
  fastestLap,
  weatherCondition,
  trackWetness,
  onTogglePlayPause,
  onStopOrReset,
  onChangeSpeed,
  onAdvanceLaps,
  onSimulateRest,
}) => {
  const isWet =
    weatherCondition === 'wet' ||
    weatherCondition === 'chuva_extrema' ||
    (typeof trackWetness === 'number' && trackWetness > 20)

  const isBlocked = isFinished || isAwaitingWeatherDecision || isSuspended || isRestartPending

  return (
    <Card className="bg-[#080d1a] border border-slate-800/90 rounded-2xl shadow-2xl overflow-hidden text-white font-mono">
      <CardContent className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-4">
        {/* BLOCO DA ESQUERDA: CONTROLES DE REPRODUÇÃO E AVANÇO */}
        <div className="flex flex-wrap items-center gap-2">
          {/* PLAY / PAUSE */}
          <Button
            type="button"
            size="sm"
            disabled={isBlocked}
            onClick={onTogglePlayPause}
            className={`h-11 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 ${
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
                  : 'Iniciar / Avançar 1 volta'
            }
          >
            {isAwaitingWeatherDecision ? (
              <span className="text-xs font-black uppercase tracking-wider">
                Aguardando Decisão
              </span>
            ) : isSimulating ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span className="text-xs font-black uppercase">Pausar</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span className="text-xs font-black uppercase">Avançar 1 Volta</span>
              </>
            )}
          </Button>

          {/* STOP / RESET */}
          {onStopOrReset && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onStopOrReset}
              className="w-10 h-10 rounded-xl bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 p-0 flex items-center justify-center shadow-md"
              title="Reiniciar Corrida"
            >
              <Square className="w-4 h-4 fill-current text-slate-400" />
            </Button>
          )}

          {/* VELOCIDADES 1x / 2x / 4x */}
          <div className="flex items-center bg-[#0d1527] border border-slate-800 rounded-xl p-1 gap-1">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onChangeSpeed(spd)}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
                  currentSimSpeed === spd
                    ? 'bg-slate-800 text-white shadow-xs font-mono border border-slate-700/80 text-cyan-300'
                    : 'text-slate-400 hover:text-white'
                }`}
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
            className="h-10 px-3 rounded-xl bg-[#0d1527] border-slate-800 hover:bg-slate-800 text-slate-200 text-xs font-bold gap-1.5 shadow-md"
          >
            <FastForward className="w-3.5 h-3.5 text-cyan-400" />
            +5 VOLTAS
          </Button>

          {/* +10 VOLTAS */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isBlocked || isSimulating}
            onClick={() => onAdvanceLaps(10)}
            className="h-10 px-3 rounded-xl bg-[#0d1527] border-slate-800 hover:bg-slate-800 text-slate-200 text-xs font-bold gap-1.5 shadow-md"
          >
            <FastForward className="w-3.5 h-3.5 text-amber-400" />
            +10 VOLTAS
          </Button>

          {/* SIMULAR ATÉ O FIM */}
          <Button
            type="button"
            size="sm"
            disabled={isBlocked || isSimulating}
            onClick={onSimulateRest}
            className="h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white text-xs font-black gap-2 shadow-md uppercase"
          >
            <Flame className="w-4 h-4 text-amber-400 fill-current" />
            SIMULAR ATÉ O FIM
          </Button>
        </div>

        {/* BLOCO DA DIREITA: TELEMETRIA GERAL (TEMPO, VOLTA MAIS RÁPIDA, CONDIÇÕES) */}
        <div className="flex flex-wrap items-center gap-6 text-xs">
          {/* TEMPO DE CORRIDA */}
          <div>
            <span className="text-[10px] uppercase font-sans font-bold text-slate-400 block">
              TEMPO DE CORRIDA
            </span>
            <span className="text-base font-black text-white tracking-wider block mt-0.5">
              {raceTimeFormatted || '0:00:00'}
            </span>
          </div>

          {/* VOLTA MAIS RÁPIDA */}
          <div>
            <span className="text-[10px] uppercase font-sans font-bold text-slate-400 block">
              VOLTA MAIS RÁPIDA
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-black text-purple-400">
                {fastestLap?.lapTimeFormatted || '—'}
              </span>
              {fastestLap?.driverName && (
                <span className="text-xs text-slate-300 uppercase font-semibold">
                  {fastestLap.driverName} (V{fastestLap.lap})
                </span>
              )}
            </div>
          </div>

          {/* CONDIÇÕES DE PISTA */}
          <div>
            <span className="text-[10px] uppercase font-sans font-bold text-slate-400 block">
              CONDIÇÕES
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isWet ? (
                <>
                  <CloudRain className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-cyan-300">Pista Molhada</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">Pista Seca</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
