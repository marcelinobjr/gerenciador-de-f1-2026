import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'

export interface PendingDecisionItem {
  id: string
  title: string
  priority: 'ALTA' | 'MÉDIA' | 'BAIXA'
  actionTab?: string
  actionPayload?: any
}

interface PendingDecisionsCardProps {
  decisions: PendingDecisionItem[]
  onOpenAll: () => void
  onSelectDecision?: (decision: PendingDecisionItem) => void
}

export const PendingDecisionsCard: React.FC<PendingDecisionsCardProps> = ({
  decisions,
  onOpenAll,
  onSelectDecision,
}) => {
  const getBadgeClass = (priority: PendingDecisionItem['priority']) => {
    switch (priority) {
      case 'ALTA':
        return 'bg-[#E10600] text-white hover:bg-[#E10600]'
      case 'MÉDIA':
        return 'bg-[#E5A000] text-white hover:bg-[#E5A000]'
      case 'BAIXA':
      default:
        return 'bg-neutral-500 text-white hover:bg-neutral-500'
    }
  }

  return (
    <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 font-sans">
            DECISÕES PENDENTES
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenAll}
            className="text-[11px] text-neutral-500 hover:text-neutral-900 font-semibold p-0 h-auto flex items-center gap-0.5"
          >
            VER TODAS
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Lista de decisões (máximo 3 visíveis) */}
        <div className="divide-y divide-neutral-100 mt-1">
          {decisions.slice(0, 3).map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectDecision && onSelectDecision(item)}
              className="py-3 flex items-center justify-between gap-3 hover:bg-neutral-50/80 px-1 rounded-lg cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${getBadgeClass(
                    item.priority,
                  )}`}
                >
                  {item.priority}
                </Badge>
                <span className="text-xs font-medium text-neutral-800 truncate group-hover:text-[#E10600] transition-colors leading-snug">
                  {item.title}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-700 transition-colors shrink-0" />
            </div>
          ))}

          {decisions.length === 0 && (
            <div className="py-6 text-center text-xs text-neutral-400">
              Nenhuma decisão organizacional pendente no momento.
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
