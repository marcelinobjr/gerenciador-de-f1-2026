import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'

export interface BoardObjectiveItem {
  id: string
  area: 'Campeonato' | 'Financeiro' | 'Desenvolvimento do Carro' | 'Desenvolvimento dos Pilotos'
  description: string
  progressPct: number
  statusValue: string
  chipStatus: 'No caminho' | 'Atenção' | 'Adiantado' | 'Em risco'
}

interface BoardObjectivesCardProps {
  objectives: BoardObjectiveItem[]
  onOpenObjectives: () => void
}

export const BoardObjectivesCard: React.FC<BoardObjectivesCardProps> = ({
  objectives,
  onOpenObjectives,
}) => {
  const getChipStyle = (status: BoardObjectiveItem['chipStatus']) => {
    switch (status) {
      case 'Adiantado':
      case 'No caminho':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'Atenção':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'Em risco':
      default:
        return 'bg-red-50 text-red-700 border-red-200'
    }
  }

  const getProgressColor = (status: BoardObjectiveItem['chipStatus']) => {
    switch (status) {
      case 'Adiantado':
      case 'No caminho':
        return 'bg-emerald-500'
      case 'Atenção':
        return 'bg-amber-500'
      case 'Em risco':
      default:
        return 'bg-red-500'
    }
  }

  return (
    <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 font-sans">
            OBJETIVOS DA DIRETORIA
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenObjectives}
            className="text-[11px] text-neutral-500 hover:text-neutral-900 font-semibold p-0 h-auto flex items-center gap-0.5"
          >
            VER OBJETIVOS
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="space-y-4 py-3">
          {objectives.slice(0, 4).map((obj) => (
            <div key={obj.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-800">{obj.area}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0 font-medium ${getChipStyle(obj.chipStatus)}`}
                >
                  {obj.chipStatus}
                </Badge>
              </div>

              {/* Barra de Progresso */}
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(obj.chipStatus)}`}
                  style={{ width: `${Math.min(100, Math.max(5, obj.progressPct))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-500 font-sans">
                <span className="truncate max-w-[220px]">{obj.description}</span>
                <span className="font-mono font-medium text-neutral-700">{obj.statusValue}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
