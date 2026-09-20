import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Disc, Layers } from 'lucide-react'
import type { TireSetItem, TireCompound } from '@/types/f1'

interface TyreInventoryPanelProps {
  driverName: string
  driverId: string
  carNumber: 1 | 2
  tyres: TireSetItem[]
  currentTyreSetId?: string
  isSessionRunning: boolean
  isCarInGarage: boolean
  onSelectTyreSet: (tyreSetId: string) => void
}

const COMPOUND_ORDER: TireCompound[] = ['macio', 'medio', 'duro', 'intermediario', 'chuva_extrema']

const COMPOUND_CONFIG: Record<
  TireCompound,
  { label: string; badgeColor: string; textColor: string }
> = {
  macio: {
    label: 'Macios (Soft)',
    badgeColor: 'bg-red-500/20 border-red-500/40 text-red-400',
    textColor: 'text-red-400',
  },
  medio: {
    label: 'Médios (Medium)',
    badgeColor: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
    textColor: 'text-amber-400',
  },
  duro: {
    label: 'Duros (Hard)',
    badgeColor: 'bg-slate-500/20 border-slate-500/40 text-slate-300',
    textColor: 'text-slate-300',
  },
  intermediario: {
    label: 'Intermediários',
    badgeColor: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
    textColor: 'text-emerald-400',
  },
  chuva_extrema: {
    label: 'Chuva Extrema',
    badgeColor: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
    textColor: 'text-blue-400',
  },
}

export const TyreInventoryPanel: React.FC<TyreInventoryPanelProps> = ({
  driverName,
  carNumber,
  tyres,
  currentTyreSetId,
  isSessionRunning,
  isCarInGarage,
  onSelectTyreSet,
}) => {
  return (
    <Card className="p-4 bg-[#090D15]/90 border border-[#1F2733] rounded-2xl shadow-xl space-y-4 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1A2333] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">
              Estoque de Pneus — Carro #{carNumber} ({driverName})
            </h4>
            <p className="text-[10px] text-slate-400">
              Alocação oficial do evento (20 jogos por piloto). O mesmo inventário acompanha todas
              as sessões.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="bg-[#141B26] text-slate-300 border-[#222E42] text-[10px]"
        >
          Total: <strong className="text-white ml-1">{tyres.length} jogos</strong>
        </Badge>
      </div>

      <div className="space-y-3">
        {COMPOUND_ORDER.map((comp) => {
          const setsOfCompound = tyres.filter((t) => t.compound === comp)
          if (setsOfCompound.length === 0) return null

          const cfg = COMPOUND_CONFIG[comp]
          const newCount = setsOfCompound.filter((s) => (s.lapsUsed || 0) === 0).length
          const usedCount = setsOfCompound.filter(
            (s) => (s.lapsUsed || 0) > 0 && s.id !== currentTyreSetId,
          ).length
          const installedCount = setsOfCompound.filter((s) => s.id === currentTyreSetId).length

          return (
            <div
              key={comp}
              className="p-3 rounded-xl bg-[#0B1019] border border-[#162030] space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] font-black ${cfg.badgeColor}`}>
                    {cfg.label}
                  </Badge>
                  <span className="text-[11px] text-slate-400">
                    Total: <strong className="text-white">{setsOfCompound.length}</strong> (
                    <span className="text-emerald-400 font-bold">{newCount} novos</span>,{' '}
                    <span className="text-amber-400 font-bold">{usedCount} usados</span>
                    {installedCount > 0 ? (
                      <span className="text-cyan-400 font-bold">, 1 instalado</span>
                    ) : null}
                    )
                  </span>
                </div>
              </div>

              {/* Grid dos jogos deste composto */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                {setsOfCompound.map((set, idx) => {
                  const isCurrent = set.id === currentTyreSetId
                  const isExhausted = (set.wear || 0) >= 90
                  const isNew = (set.lapsUsed || 0) === 0

                  return (
                    <button
                      key={set.id}
                      type="button"
                      disabled={!isCarInGarage || isCurrent || isExhausted}
                      onClick={() => onSelectTyreSet(set.id)}
                      className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between gap-1 text-[10px] ${
                        isCurrent
                          ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500'
                          : isExhausted
                            ? 'bg-red-950/20 border-red-900/40 opacity-50 cursor-not-allowed'
                            : 'bg-[#0E1521] border-[#1C283B] hover:border-slate-400 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] text-slate-400">JOGO #{idx + 1}</span>
                        {isCurrent ? (
                          <span className="text-[9px] text-cyan-400 font-black">NO CARRO</span>
                        ) : isNew ? (
                          <span className="text-[9px] text-emerald-400 font-bold">NOVO</span>
                        ) : (
                          <span className="text-[9px] text-amber-400 font-bold">USADO</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-300">{set.lapsUsed || 0} voltas</span>
                        <span
                          className={
                            (set.wear || 0) >= 70
                              ? 'text-red-400 font-black'
                              : (set.wear || 0) >= 40
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }
                        >
                          {set.wear || 0}%
                        </span>
                      </div>

                      <Progress
                        value={set.wear || 0}
                        className={`h-1 bg-[#141B26] ${
                          (set.wear || 0) >= 70 ? '[&>div]:bg-red-500' : '[&>div]:bg-cyan-500'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
