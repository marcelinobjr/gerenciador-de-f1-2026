import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wind, Wrench, Flag, BarChart3, AlertTriangle, ChevronRight, FileText } from 'lucide-react'

export interface DepartmentCapacity {
  aerodynamics: number // ex: 85
  engineering: number // ex: 78
  trackOperations: number // ex: 82
  commercial: number // ex: 70
}

interface OrganizationalCapacityCardProps {
  capacities: DepartmentCapacity
  bottleneckText?: string
  bottleneckImpact?: string
  onOpenDetails?: () => void
}

export const OrganizationalCapacityCard: React.FC<OrganizationalCapacityCardProps> = ({
  capacities,
  bottleneckText,
  bottleneckImpact = 'Setor com menor índice relativo para os objetivos atuais. Considere novos investimentos ou contratações.',
  onOpenDetails,
}) => {
  const depts = [
    {
      name: 'Aerodinâmica',
      score: capacities.aerodynamics,
      icon: Wind,
      color: 'bg-emerald-500',
    },
    {
      name: 'Engenharia',
      score: capacities.engineering,
      icon: Wrench,
      color: 'bg-blue-500',
    },
    {
      name: 'Operações de pista',
      score: capacities.trackOperations,
      icon: Flag,
      color: 'bg-indigo-500',
    },
    {
      name: 'Comercial',
      score: capacities.commercial,
      icon: BarChart3,
      color: 'bg-sky-500',
    },
  ]

  return (
    <Card className="bg-white border-neutral-200/90 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full">
      <div>
        {/* Cabeçalho */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-neutral-900 font-sans block">
                Capacidade Organizacional
              </span>
              <span className="text-[11px] text-neutral-400 font-medium block">
                Nossa estrutura. Nosso diferencial.
              </span>
            </div>
          </div>
          {onOpenDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenDetails}
              className="text-[11px] text-[#E10600] hover:text-[#B00500] hover:bg-red-50/50 font-bold p-0 h-auto flex items-center gap-0.5 shrink-0"
            >
              Detalhes
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* 4 Barras de Capacidade */}
        <div className="space-y-3 py-3">
          {depts.map((d) => {
            const Icon = d.icon
            return (
              <div key={d.name} className="flex items-center gap-3 text-xs">
                <div className="w-4 text-neutral-400 flex justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5" />
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
                <span className="w-8 text-right font-mono font-bold text-neutral-900">
                  {d.score}%
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Caixa Ponto de Atenção (Gargalo real existente ou condicional preparado) */}
      {bottleneckText ? (
        <div
          onClick={onOpenDetails}
          className="mt-2 p-3 rounded-xl bg-red-50/70 border border-red-200/80 flex items-start gap-2.5 cursor-pointer hover:bg-red-50 transition-colors group"
        >
          <div className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-bold text-red-950 flex items-center justify-between">
              <span>Ponto de Atenção</span>
              <ChevronRight className="w-3.5 h-3.5 text-red-400 group-hover:text-red-700 transition-colors" />
            </div>
            <div className="text-red-800 text-[11px] leading-tight mt-0.5">
              Setor {bottleneckText} abaixo do ideal para os nossos objetivos. {bottleneckImpact}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 p-3 rounded-xl bg-neutral-50 border border-neutral-100 text-neutral-500 text-xs flex items-center justify-between">
          <span className="text-[11px]">Todos os departamentos operando dentro das metas.</span>
        </div>
      )}
    </Card>
  )
}
