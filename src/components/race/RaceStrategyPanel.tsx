import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Layers } from 'lucide-react'
import { computeStintIntervals } from '@/lib/canonical-stint-intervals'
import type { PreparedCarState } from '@/types/canonical-race-preparation'

export interface RaceStrategyPanelProps {
  preparedCars: [PreparedCarState?, PreparedCarState?]
  totalLaps: number
}

function getCompoundLabel(c: string) {
  const norm = (c || 'medio').toLowerCase()
  if (norm.includes('macio') || norm === 'soft') return 'Macio (S)'
  if (norm.includes('duro') || norm === 'hard') return 'Duro (H)'
  if (norm.includes('inter')) return 'Intermediário (I)'
  if (norm.includes('chuva')) return 'Chuva Extrema (W)'
  return 'Médio (M)'
}

export const RaceStrategyPanel: React.FC<RaceStrategyPanelProps> = ({
  preparedCars,
  totalLaps,
}) => {
  return (
    <Card className="bg-[#0D1524] border border-[#1E293B] rounded-xl overflow-hidden shadow-lg">
      <CardHeader className="py-2.5 px-3.5 bg-[#090E1A] border-b border-[#1E293B] flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          Estratégia da Corrida — Plano Inicial
        </CardTitle>
        <Badge className="bg-[#1E293B] text-slate-300 border border-slate-700 text-[10px] font-mono">
          {totalLaps} Voltas
        </Badge>
      </CardHeader>

      <CardContent className="p-3.5 space-y-3 font-mono text-xs">
        {preparedCars.map((car, idx) => {
          if (!car) return null
          const stints = car.strategyPlan?.stints || []
          const stopsCount = Math.max(0, stints.length - 1)

          return (
            <div
              key={car.carId || idx}
              className="p-3 rounded-lg bg-[#080E18] border border-[#1E293B] space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="font-bold text-white text-xs">{car.driverName}</span>
                  <span className="text-[10px] text-slate-400">
                    ({car.carId === 'car1' ? 'Carro 1' : 'Carro 2'})
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-cyan-300 border-cyan-800/60 bg-cyan-950/20 text-[10px]"
                >
                  {stopsCount === 1 ? '1 Parada Planejada' : `${stopsCount} Paradas Planejadas`}
                </Badge>
              </div>

              {/* STINTS VISUAIS */}
              <div className="space-y-1.5 pt-1">
                {(() => {
                  const intervals = computeStintIntervals(stints, totalLaps)
                  return stints.map((stint, sIdx) => {
                    const interval = intervals[sIdx]
                    return (
                      <div
                        key={sIdx}
                        className="flex items-center justify-between text-[11px] p-1.5 rounded bg-[#0D1524] border border-[#1E293B]/70"
                      >
                        <span className="text-slate-300 font-bold">
                          Stint {sIdx + 1}: {getCompoundLabel(stint.compound)}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {interval ? interval.formattedLabel : `Stint ${sIdx + 1}`}
                        </span>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
