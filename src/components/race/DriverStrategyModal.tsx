import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Flame, Shield, Gauge, Wrench, SlidersHorizontal, CheckCircle2 } from 'lucide-react'
import type { CanonicalRaceDriverState, DriverPaceMode } from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'

export interface DriverStrategyModalProps {
  driver: CanonicalRaceDriverState | null
  open: boolean
  onClose: () => void
  onRequestPit: (driverId: string, compound?: TireCompound) => void
  onCancelPit: (driverId: string) => void
  onSetPaceMode: (driverId: string, mode: DriverPaceMode) => void
  onSetTargetCompound: (driverId: string, compound: TireCompound) => void
  isRaceFinished?: boolean
  isRedFlagActive?: boolean
  onChangeSuspensionTyre?: (driverId: string, compound: TireCompound) => void
}

const AVAILABLE_COMPOUNDS: Array<{
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
  {
    value: 'intermediario',
    label: 'Intermediário (Verde)',
    color: 'bg-emerald-500/20 text-emerald-300',
    border: 'border-emerald-500/40',
  },
  {
    value: 'chuva_extrema',
    label: 'Chuva Extrema (Azul)',
    color: 'bg-blue-500/20 text-blue-300',
    border: 'border-blue-500/40',
  },
]

export const DriverStrategyModal: React.FC<DriverStrategyModalProps> = ({
  driver,
  open,
  onClose,
  onRequestPit,
  onCancelPit,
  onSetPaceMode,
  onSetTargetCompound,
  isRaceFinished = false,
  isRedFlagActive = false,
  onChangeSuspensionTyre,
}) => {
  if (!driver) return null

  const strat = driver.strategy
  const currentPace = strat?.paceMode || 'NORMAL'
  const targetCompound =
    strat?.targetCompound || (driver.tyreCompound === 'macio' ? 'medio' : 'duro')
  const isPitRequested = !!strat?.pitRequested || !!strat?.pitThisLap

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md bg-[#090d18] border border-slate-800 text-white shadow-2xl">
        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
            <DialogTitle className="text-base font-black tracking-wider uppercase text-white">
              Estratégia de Prova — {driver.driverName}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400">
            Ajuste o ritmo do piloto e selecione o composto alvo para a próxima parada nos boxes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* SEÇÃO 1: RITMO DE CORRIDA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wide">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Ritmo do Piloto:
              </span>
              <Badge className="bg-slate-800 text-slate-300 font-mono text-[10px]">
                Atual: {currentPace}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isRaceFinished}
                onClick={() => onSetPaceMode(driver.driverId, 'PUSH')}
                className={`h-9 text-xs font-black gap-1.5 transition-all ${
                  currentPace === 'PUSH'
                    ? 'bg-red-600 hover:bg-red-500 text-white ring-2 ring-red-400'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                Push
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={isRaceFinished}
                onClick={() => onSetPaceMode(driver.driverId, 'NORMAL')}
                className={`h-9 text-xs font-black gap-1.5 transition-all ${
                  currentPace === 'NORMAL'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Normal
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={isRaceFinished}
                onClick={() => onSetPaceMode(driver.driverId, 'CONSERVE')}
                className={`h-9 text-xs font-black gap-1.5 transition-all ${
                  currentPace === 'CONSERVE'
                    ? 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-400'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-cyan-300" />
                Poupar
              </Button>
            </div>
          </div>

          {/* SEÇÃO 2: COMPOSTO ALVO */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Wrench className="w-4 h-4 text-amber-400" />
              Composto Alvo para a Próxima Parada:
            </span>

            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_COMPOUNDS.map((comp) => {
                const isSelected = targetCompound === comp.value
                return (
                  <button
                    key={comp.value}
                    type="button"
                    disabled={isRaceFinished}
                    onClick={() => onSetTargetCompound(driver.driverId, comp.value)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                      isSelected
                        ? `${comp.color} ${comp.border} ring-2 ring-white/20 font-black`
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span>{comp.label}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* SEÇÃO 3: AÇÃO DE PIT STOP */}
          <div className="pt-2 border-t border-slate-800">
            {isRedFlagActive ? (
              <Button
                type="button"
                size="sm"
                disabled={isRaceFinished}
                onClick={() => {
                  if (onChangeSuspensionTyre) {
                    onChangeSuspensionTyre(driver.driverId, targetCompound)
                  } else {
                    onRequestPit(driver.driverId, targetCompound)
                  }
                  onClose()
                }}
                className="w-full h-10 text-xs font-black bg-purple-600 hover:bg-purple-500 text-white gap-2 shadow-md uppercase"
              >
                <Wrench className="w-4 h-4" />
                Trocar na Suspensão ({targetCompound.toUpperCase()})
              </Button>
            ) : isPitRequested ? (
              <Button
                type="button"
                size="sm"
                disabled={isRaceFinished}
                onClick={() => {
                  onCancelPit(driver.driverId)
                  onClose()
                }}
                className="w-full h-10 text-xs font-black bg-amber-600 hover:bg-amber-500 text-white animate-pulse gap-2 shadow-md uppercase"
              >
                Cancelar Chamada de Box
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={isRaceFinished}
                onClick={() => {
                  onRequestPit(driver.driverId, targetCompound)
                  onClose()
                }}
                className="w-full h-10 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-md uppercase"
              >
                <Wrench className="w-4 h-4" />
                Confirmar Chamada de Box
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
