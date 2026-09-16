import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wind, Wrench, Flag, BarChart3, AlertTriangle, ChevronRight } from 'lucide-react'

export interface DepartmentCapacity {
  aerodynamics: number // ex: 72
  engineering: number // ex: 84
  trackOperations: number // ex: 88
  commercial: number // ex: 79
}

interface OrganizationalCapacityCardProps {
  capacities: DepartmentCapacity
  bottleneckText?: string
  bottleneckImpact?: string
  onOpenDetails: () => void
}

export const OrganizationalCapacityCard: React.FC<OrganizationalCapacityCardProps> = ({
  capacities,
  bottleneckText = 'Aerodinâmica',
  bottleneckImpact = 'Impacto: atraso no desenvolvimento',
  onOpenDetails,
}) => {
  const depts = [
    {
      name: 'Aerodinâmica',
      score: capacities.aerodynamics,
      icon: Wind,
      isBottleneck: true,
      color: 'bg-red-500',
    },
    {
      name: 'Engenharia',
      score: capacities.engineering,
      icon: Wrench,
      isBottleneck: false,
      color: 'bg-emerald-500',
    },
    {
      name: 'Operações de pista',
      score: capacities.trackOperations,
      icon: Flag,
      isBottleneck: false,
      color: 'bg-emerald-500',
    },
    {
      name: 'Comercial',
      score: capacities.commercial,
      icon: BarChart3,
      isBottleneck: false,
      color: 'bg-emerald-500',
    },
  ]

  return (
    <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 font-sans flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neutral-900 inline-block" />
              CAPACIDADE ORGANIZACIONAL
            </span>
            <div className="text-[11px] text-neutral-400 font-medium">
              Gargalos e capacidade operacional
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDetails}
            className="text-[11px] text-neutral-500 hover:text-neutral-900 font-semibold p-0 h-auto flex items-center gap-0.5"
          >
            VER DETALHES
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* 4 Barras de Departamentos */}
        <div className="space-y-3 py-3">
          {depts.map((d) => {
            const Icon = d.icon
            return (
              <div key={d.name} className="flex items-center gap-3 text-xs">
                <div className="w-5 text-neutral-500 flex justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="w-32 shrink-0 font-medium text-neutral-700 truncate">
                  {d.name}
                </span>
                <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${d.color}`}
                    style={{ width: `${Math.min(100, Math.max(10, d.score))}%` }}
                  />
                </div>
                <span className="w-6 text-right font-mono font-bold text-neutral-800">
                  {d.score}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Caixa de Gargalo em Destaque */}
      <div className="mt-2 p-3 rounded-xl bg-red-50/80 border border-red-200/80 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="text-xs">
          <div className="font-bold text-red-900">Gargalo atual: {bottleneckText}</div>
          <div className="text-red-700 text-[11px]">{bottleneckImpact}</div>
        </div>
      </div>
    </Card>
  )
}
