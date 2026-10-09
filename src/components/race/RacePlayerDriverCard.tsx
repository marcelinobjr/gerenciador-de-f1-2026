import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Fuel, Gauge, Zap, Wrench, ShieldAlert } from 'lucide-react'
import type { CanonicalRacePlayerDriver } from '@/services/canonicalRaceSessionLoader'
import type { PreparedCarState } from '@/types/canonical-race-preparation'

import type { CanonicalRaceDriverState } from '@/types/canonical-race-v2'

export interface RacePlayerDriverCardProps {
  driver: CanonicalRacePlayerDriver
  preparedCar?: PreparedCarState
  canonicalDriverState?: CanonicalRaceDriverState
  teamColor?: string
  onOpenStrategyModal?: (carId: 'car1' | 'car2', driverId: string) => void
}

function getTyreBadge(compound: string) {
  const c = (compound || 'medio').toLowerCase()
  if (c.includes('macio') || c === 'soft') {
    return { name: 'Macio', symbol: 'S', color: 'text-red-400 border-red-500/80 bg-red-950/40' }
  }
  if (c.includes('duro') || c === 'hard') {
    return {
      name: 'Duro',
      symbol: 'H',
      color: 'text-slate-200 border-slate-400/80 bg-slate-900/60',
    }
  }
  if (c.includes('inter') || c === 'intermediate') {
    return {
      name: 'Inter',
      symbol: 'I',
      color: 'text-emerald-400 border-emerald-500/80 bg-emerald-950/40',
    }
  }
  if (c.includes('chuva') || c === 'wet') {
    return { name: 'Chuva', symbol: 'W', color: 'text-blue-400 border-blue-500/80 bg-blue-950/40' }
  }
  return {
    name: 'Médio',
    symbol: 'M',
    color: 'text-yellow-400 border-yellow-500/80 bg-yellow-950/40',
  }
}

export const RacePlayerDriverCard: React.FC<RacePlayerDriverCardProps> = ({
  driver,
  preparedCar,
  canonicalDriverState,
  teamColor = '#E10600',
  onOpenStrategyModal,
}) => {
  const isLive = Boolean(canonicalDriverState)
  const compound = isLive
    ? canonicalDriverState?.tyreCompound || 'medio'
    : preparedCar?.startingCompound || driver.entry.bestLapCompound || 'medio'
  const tyreBadge = getTyreBadge(compound)

  // Estimativa / cálculo de desgaste
  const tyreWear = isLive
    ? Math.min(
        100,
        (canonicalDriverState?.initialTyreWear || 0) + (canonicalDriverState?.tyreAge || 0) * 2.8,
      )
    : preparedCar?.initialTyreWear || 0

  const tyreLaps = isLive
    ? canonicalDriverState?.tyreAge || 0
    : preparedCar?.initialTyreLapsUsed || 0
  const fuelKg = isLive ? (canonicalDriverState?.fuel ?? 100) : preparedCar?.startingFuelKg || 100
  const plannedStints = preparedCar?.strategyPlan?.stints || []
  const firstStopLap = plannedStints[0]?.targetPitLap || 18

  const currentPos = isLive ? canonicalDriverState?.currentPosition : driver.gridPosition
  const gapDisplay = isLive
    ? canonicalDriverState?.raceStatus === 'dnf' || canonicalDriverState?.isDnf
      ? 'ABANDONO'
      : canonicalDriverState?.currentPosition === 1
        ? 'LÍDER'
        : canonicalDriverState?.gap ||
          (canonicalDriverState?.gapToLeaderSec !== undefined
            ? `+${canonicalDriverState.gapToLeaderSec.toFixed(3)}s`
            : '-')
    : `Largada: P${driver.gridPosition}`

  return (
    <Card className="bg-[#0D1524] border border-[#1E293B] rounded-xl overflow-hidden shadow-lg flex-1">
      <CardHeader className="py-3 px-4 bg-[#090E1A] border-b border-[#1E293B] flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="w-1.5 h-6 rounded-full shrink-0"
            style={{ backgroundColor: teamColor }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-400">
                #{driver.carNumber}
              </span>
              <CardTitle className="text-sm font-black text-white tracking-wide">
                {driver.driverName}
              </CardTitle>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              {isLive
                ? `Posição Atual: P${currentPos} • Gap: ${gapDisplay}`
                : `Largada: P${driver.gridPosition} • ${driver.entry.eliminationStage}`}
            </p>
          </div>
        </div>

        <Badge className="bg-red-950/80 border border-red-700/60 text-red-300 text-[10px] font-black uppercase">
          CARRO {driver.carNumber}
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 text-xs font-mono">
        {/* LINHA 1: PNEU & DESGASTE */}
        <div className="p-2.5 rounded-lg bg-[#080E18] border border-[#1E293B] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full border text-[9px] font-black ${tyreBadge.color}`}
              >
                {tyreBadge.symbol}
              </span>
              {isLive ? `Pneu: ${tyreBadge.name}` : `Pneu Inicial: ${tyreBadge.name}`}
            </span>
            <span className="text-[11px] font-bold text-slate-200">
              Desgaste: {tyreWear.toFixed(1)}% ({tyreLaps}v)
            </span>
          </div>
          <Progress value={tyreWear} className="h-1.5 bg-slate-800" />
        </div>

        {/* LINHA 2: COMBUSTÍVEL & RITMO & ERS */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-[#080E18] border border-[#1E293B] text-center">
            <span className="text-[9px] text-slate-400 uppercase font-bold flex items-center justify-center gap-1">
              <Fuel className="w-3 h-3 text-amber-400" />
              Tanque
            </span>
            <span className="text-xs font-black text-white mt-0.5 block">
              {fuelKg.toFixed(1)} kg
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#080E18] border border-[#1E293B] text-center">
            <span className="text-[9px] text-slate-400 uppercase font-bold flex items-center justify-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-400" />
              Ritmo
            </span>
            <span className="text-xs font-black text-cyan-300 mt-0.5 block">
              {canonicalDriverState?.strategy?.paceMode || 'NORMAL'}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#080E18] border border-[#1E293B] text-center">
            <span className="text-[9px] text-slate-400 uppercase font-bold flex items-center justify-center gap-1">
              <Zap className="w-3 h-3 text-slate-500" />
              ERS
            </span>
            <span
              className="text-xs font-bold text-slate-500 mt-0.5 block"
              title="Não consumido pelo motor nesta fase"
            >
              Desab.
            </span>
          </div>
        </div>

        {/* LINHA 3: MAPA DO MOTOR & JANELA DE BOX */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded-lg bg-[#080E18] border border-[#1E293B]">
            <span className="text-[9px] text-slate-400 uppercase font-bold block">
              Mapa de Motor
            </span>
            <span
              className="font-bold text-slate-500 mt-0.5 block"
              title="Não consumido pelo motor nesta fase"
            >
              Desabilitado
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[#080E18] border border-[#1E293B]">
            <span className="text-[9px] text-slate-400 uppercase font-bold block">
              Janela de Box
            </span>
            <span className="font-bold text-amber-300 mt-0.5 block">
              {canonicalDriverState?.strategy?.nextPitWindow
                ? `Voltas ${canonicalDriverState.strategy.nextPitWindow.startLap}–${canonicalDriverState.strategy.nextPitWindow.endLap}`
                : `Voltas ${firstStopLap}–${firstStopLap + 3}`}
            </span>
          </div>
        </div>

        {/* LINHA 4: BOTÕES DE COMANDO DESABILITADOS EM PRÉ-CORRIDA */}
        <div className="pt-1 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled
            className="flex-1 h-8 text-[11px] font-bold bg-[#1E293B] text-slate-500 cursor-not-allowed border border-slate-700/50"
          >
            <Wrench className="w-3 h-3 mr-1" />
            Box (Pit)
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => onOpenStrategyModal?.(driver.carId, driver.driverId)}
            className="flex-1 h-8 text-[11px] font-bold bg-[#132238] hover:bg-[#1A2E4C] text-cyan-300 border border-cyan-800/40"
          >
            Ajustar Estratégia
          </Button>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-slate-500 italic justify-center">
          <ShieldAlert className="w-3 h-3 text-slate-600 shrink-0" />
          Comandos de rádio liberados após a largada.
        </div>
      </CardContent>
    </Card>
  )
}
