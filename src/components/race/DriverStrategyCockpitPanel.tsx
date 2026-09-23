import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Wrench,
  Gauge,
  Flame,
  Shield,
  Clock,
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  AlertCircle,
  Layers,
} from 'lucide-react'
import type { CanonicalRaceDriverState, DriverPaceMode } from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'
import {
  calculateRecommendedPitWindow,
  selectCarTireDisplayState,
  getTireDegradationBand,
} from '@/lib/canonical-tire-strategy'
import { TireDegradationIndicator } from '@/components/race/TireDegradationIndicator'

interface DriverStrategyCockpitPanelProps {
  driver: CanonicalRaceDriverState
  carSlotName: string // 'Carro 1' ou 'Carro 2'
  onRequestPit: (driverId: string, compound?: TireCompound) => void
  onCancelPit: (driverId: string) => void
  onSetPaceMode: (driverId: string, mode: DriverPaceMode) => void
  onSetTargetCompound: (driverId: string, compound: TireCompound) => void
  isRaceFinished?: boolean
  isRedFlagActive?: boolean
}

export const DriverStrategyCockpitPanel: React.FC<DriverStrategyCockpitPanelProps> = ({
  driver,
  carSlotName,
  onRequestPit,
  onCancelPit,
  onSetPaceMode,
  onSetTargetCompound,
  isRaceFinished = false,
  isRedFlagActive = false,
}) => {
  const strat = driver.strategy
  const isDnf = driver.raceStatus === 'dnf' || driver.isDnf
  const isPitRequested = !!strat?.pitRequested || !!strat?.pitThisLap
  const currentPace = strat?.paceMode || 'NORMAL'
  const targetCompound =
    strat?.targetCompound || (driver.tyreCompound === 'macio' ? 'medio' : 'duro')

  // FC02C: Estado canônico de pneus
  const driverAny = driver as unknown as {
    tyreWear?: number
    cliffStatus?: { isCliffReached?: number }
  }
  const estimatedWearFromAge =
    typeof driverAny.tyreWear === 'number'
      ? driverAny.tyreWear
      : Math.min(100, Math.round((driver.initialTyreWear || 0) + (driver.tyreAge || 0) * 2.5))

  const tireState = selectCarTireDisplayState({
    tireCompound: driver.tyreCompound,
    tireWear: estimatedWearFromAge,
    lapsOnCurrentTire: driver.tyreAge,
    cliffStatus: driverAny.cliffStatus
      ? { isCliffReached: driverAny.cliffStatus.isCliffReached }
      : undefined,
  })

  // FC02C: Janela de pit recomendada canônica
  const recommendedPit = calculateRecommendedPitWindow({
    currentStintCompound: driver.tyreCompound || 'medio',
    totalRaceLaps: 57, // Respeitado dinamicamente
    currentLap: driver.tyreAge || 1,
    initialWearPct: driver.initialTyreWear || 0,
    nextCompoundPreference: targetCompound,
  })

  const pitWindowDisplay = strat?.nextPitWindow
    ? `V${strat.nextPitWindow.startLap}–${strat.nextPitWindow.endLap}`
    : recommendedPit.windowText.replace('Voltas', 'V')
  const pitOptimalDisplay = strat?.nextPitWindow?.optimalLap ?? recommendedPit.optimalLap

  const availableCompounds: Array<{
    value: TireCompound
    label: string
    color: string
    border: string
  }> = [
    {
      value: 'macio',
      label: 'Macio (C4)',
      color: 'bg-red-500/20 text-red-300',
      border: 'border-red-500/40',
    },
    {
      value: 'medio',
      label: 'Médio (C3)',
      color: 'bg-yellow-500/20 text-yellow-300',
      border: 'border-yellow-500/40',
    },
    {
      value: 'duro',
      label: 'Duro (C1)',
      color: 'bg-slate-200/20 text-slate-200',
      border: 'border-slate-400/40',
    },
  ]

  return (
    <Card className="bg-[#0B111E] border border-slate-800 shadow-lg rounded-2xl overflow-hidden text-white flex flex-col justify-between">
      {/* Header do Cockpit do Piloto */}
      <CardHeader className="py-3 px-4 bg-[#0F172A] border-b border-slate-800 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-[#E10600] text-white text-[10px] font-black uppercase tracking-wider">
            {carSlotName}
          </Badge>
          <span className="font-black text-sm text-white tracking-tight truncate max-w-[150px]">
            {driver.driverName}
          </span>
          <span className="text-[11px] font-bold text-amber-400">P{driver.currentPosition}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {strat?.undercutOpportunity && (
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold animate-pulse">
              ⚡ UNDERCUT
            </Badge>
          )}
          {strat?.overcutOpportunity && (
            <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] font-bold">
              🛡️ OVERCUT
            </Badge>
          )}
          {strat?.doubleStackWarning && (
            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[9px] font-bold">
              DOUBLE STACK
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Métricas Principais (Gap, Pneu, Idade, Janela) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-[#131C2E] p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Gap / Posição
            </span>
            <span className="font-black text-white text-sm">{isDnf ? 'DNF' : driver.gap}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              Frente: +
              {typeof driver.gapToFrontSec === 'number' ? driver.gapToFrontSec.toFixed(2) : '0.00'}s
            </span>
          </div>

          <div className="bg-[#131C2E] p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pneu Atual</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge
                variant="outline"
                className="text-[10px] font-black uppercase text-amber-400 border-amber-400/40"
              >
                {driver.tyreCompound}
              </Badge>
              <span className="font-mono text-slate-300 text-xs">{driver.tyreAge}v</span>
            </div>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              Paradas: {driver.pitStops}
            </span>
          </div>

          <div className="bg-[#131C2E] p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Janela de Pit
            </span>
            <span className="font-extrabold text-cyan-400 text-xs">{pitWindowDisplay}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              Ideal: V{pitOptimalDisplay}
            </span>
          </div>

          <div className="bg-[#131C2E] p-2 rounded-xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Tráfego / Pista
            </span>
            <span
              className={`font-bold text-[11px] block mt-0.5 ${
                strat?.trafficStatus === 'CLEAR_AIR'
                  ? 'text-emerald-400'
                  : strat?.trafficStatus === 'DIRTY_AIR'
                    ? 'text-red-400'
                    : 'text-amber-400'
              }`}
            >
              {strat?.trafficStatus === 'CLEAR_AIR' && '🟢 Ar Limpo'}
              {strat?.trafficStatus === 'IN_TRAFFIC' && '🟡 Em Tráfego'}
              {strat?.trafficStatus === 'DIRTY_AIR' && '🔴 Ar Sujo'}
            </span>
            <span className="text-[9px] text-slate-400 block">
              Trás: +{typeof strat?.gapBehind === 'number' ? strat.gapBehind.toFixed(1) : '—'}s
            </span>
          </div>
        </div>

        {/* FC02C: INDICADOR DE DEGRADAÇÃO CANÔNICO */}
        <div className="p-2.5 rounded-xl bg-[#131C2E] border border-slate-800/80">
          <TireDegradationIndicator
            carTireDisplayState={tireState}
            showBadge
            showLaps
            showNumericPct
          />
        </div>

        {/* CONTROLES DE RITMO INDEPENDENTES (PUSH / NORMAL / CONSERVE) */}
        <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              Ritmo de Corrida ({carSlotName}):
            </span>
            <Badge className="bg-slate-800 text-slate-300 text-[9px] font-mono">
              Modo Atual: {currentPace}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <Button
              type="button"
              size="sm"
              disabled={isDnf || isRaceFinished}
              onClick={() => onSetPaceMode(driver.driverId, 'PUSH')}
              className={`h-8 text-xs font-bold gap-1 transition-all ${
                currentPace === 'PUSH'
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-sm ring-1 ring-red-400 font-black'
                  : 'bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Flame className="w-3 h-3 text-amber-300" />
              Push
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isDnf || isRaceFinished}
              onClick={() => onSetPaceMode(driver.driverId, 'NORMAL')}
              className={`h-8 text-xs font-bold gap-1 transition-all ${
                currentPace === 'NORMAL'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-400 font-black'
                  : 'bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              Normal
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isDnf || isRaceFinished}
              onClick={() => onSetPaceMode(driver.driverId, 'CONSERVE')}
              className={`h-8 text-xs font-bold gap-1 transition-all ${
                currentPace === 'CONSERVE'
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm ring-1 ring-blue-400 font-black'
                  : 'bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Shield className="w-3 h-3 text-cyan-300" />
              Poupar
            </Button>
          </div>
        </div>

        {/* CONTROLES DE PIT STOP INDEPENDENTES */}
        <div className="space-y-2 pt-1 border-t border-slate-800/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              Composto Alvo para Próxima Parada:
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {availableCompounds.map((comp) => {
              const isSelected = targetCompound === comp.value
              return (
                <button
                  key={comp.value}
                  type="button"
                  disabled={isDnf || isRaceFinished}
                  onClick={() => onSetTargetCompound(driver.driverId, comp.value)}
                  className={`p-1.5 rounded-xl border text-[11px] font-bold transition-all text-center ${
                    isSelected
                      ? `${comp.color} ${comp.border} ring-2 ring-white/20 shadow-xs font-extrabold`
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {comp.label}
                </button>
              )
            })}
          </div>

          {/* Botão de Solicitação de Pit Stop do Carro */}
          <div className="pt-1">
            {isPitRequested ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isDnf || isRaceFinished}
                  onClick={() => onCancelPit(driver.driverId)}
                  className="w-full h-9 text-xs font-black bg-amber-600 hover:bg-amber-500 text-white animate-pulse gap-1.5"
                >
                  <AlertCircle className="w-4 h-4" />
                  Box Chamado ({targetCompound.toUpperCase()}) — Cancelar?
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={isDnf || isRaceFinished || isRedFlagActive}
                onClick={() => onRequestPit(driver.driverId, targetCompound)}
                className="w-full h-9 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-md"
              >
                <Wrench className="w-4 h-4" />
                Mandar {carSlotName} para o Box Nesta Volta
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
