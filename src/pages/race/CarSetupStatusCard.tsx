import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle } from 'lucide-react'
import type { TeamModel } from '@/types/f1'

export interface CarSetupStatusCardProps {
  team: TeamModel | null
  carParts: { id: string; name: string; condition: number }[]
  puWearEstimated: number
  puPoolStatus: {
    isCompromised: boolean
    leastWornPu: { id: number; wear: number }
    leastWear: number
    pacePenaltySec: number
  }
}

export function CarSetupStatusCard({
  team,
  carParts,
  puWearEstimated,
  puPoolStatus,
}: CarSetupStatusCardProps) {
  return (
    <Card className="relative z-10 bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] p-4 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400 block">
            ESTADO TÉCNICO DO MONOPOSTO
          </span>
          <h3 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
            Componentes & Integridade do Carro
          </h3>
          <p className="text-xs text-[#8B95A7] font-mono mt-0.5">
            O desgaste acumulado de motor, caixa de câmbio e asas afeta diretamente a velocidade de
            reta, desgaste de pneus e risco de falhas mecânicas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Cota PU */}
          <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] font-mono text-xs">
            <span className="text-[10px] text-[#8B95A7] block">PU Ativa</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-bold text-white">PU #{team?.engine_pool_used ?? 1}/4</span>
              {(team?.engine_pool_used ?? 1) > 4 ? (
                <Badge
                  variant="outline"
                  className="text-[9px] bg-red-500/10 border-red-500/40 text-red-400 py-0"
                >
                  Penalizado
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[9px] bg-emerald-500/10 border-emerald-500/40 text-emerald-400 py-0"
                >
                  Dentro da cota
                </Badge>
              )}
            </div>
          </div>

          {/* Desgaste PU */}
          <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] font-mono text-xs">
            <span className="text-[10px] text-[#8B95A7] block">Desgaste PU</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`font-bold ${
                  puWearEstimated > 70
                    ? 'text-red-400'
                    : puWearEstimated > 45
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                }`}
              >
                {puWearEstimated}%
              </span>
              {puWearEstimated > 70 ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </div>
          </div>

          {/* Peças críticas */}
          {carParts.length > 0 && (
            <div className="p-2.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] font-mono text-xs">
              <span className="text-[10px] text-[#8B95A7] block">Peças Monitoradas</span>
              <div className="flex items-center gap-2 mt-0.5">
                {carParts.slice(0, 3).map((p) => (
                  <span
                    key={p.id}
                    className={`text-[11px] font-bold ${
                      p.condition < 40
                        ? 'text-red-400'
                        : p.condition < 65
                          ? 'text-amber-400'
                          : 'text-[#8B95A7]'
                    }`}
                  >
                    {p.name.split(' ')[0]}: {Math.round(p.condition)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
