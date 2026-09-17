import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, ArrowRight, AlertCircle } from 'lucide-react'

export interface PendingDecisionItem {
  id: string
  title: string
  priority: 'ALTA' | 'MÉDIA' | 'BAIXA'
  actionTab?: string
  actionPayload?: any
  description?: string
  contextText?: string
  actionLabel?: string // "Decidir →" | "Avaliar →" | "Analisar →"
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
  const getBadgeStyle = (priority: PendingDecisionItem['priority']) => {
    switch (priority) {
      case 'ALTA':
        return 'bg-red-50 text-[#E10600] border-red-200 font-bold'
      case 'MÉDIA':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-bold'
      case 'BAIXA':
      default:
        return 'bg-neutral-100 text-neutral-700 border-neutral-200 font-medium'
    }
  }

  const getPriorityDot = (priority: PendingDecisionItem['priority']) => {
    switch (priority) {
      case 'ALTA':
        return 'bg-[#E10600]'
      case 'MÉDIA':
        return 'bg-amber-500'
      case 'BAIXA':
      default:
        return 'bg-neutral-400'
    }
  }

  const getDefaultActionLabel = (priority: PendingDecisionItem['priority']) => {
    switch (priority) {
      case 'ALTA':
        return 'Decidir →'
      case 'MÉDIA':
        return 'Avaliar →'
      case 'BAIXA':
      default:
        return 'Analisar →'
    }
  }

  return (
    <Card className="bg-white border-neutral-200/90 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full">
      <div>
        {/* Cabeçalho */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-50 text-[#E10600] flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-neutral-900 font-sans block">
                Decisões Pendentes
              </span>
              <span className="text-[11px] text-neutral-400 font-medium block">
                Itens prioritários que demandam ação da diretoria.
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenAll}
            className="text-[11px] text-[#E10600] hover:text-[#B00500] hover:bg-red-50/50 font-bold p-0 h-auto flex items-center gap-0.5 shrink-0"
          >
            Ver todas
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Lista de decisões (máximo 3 visíveis na Visão Geral conforme escopo) */}
        <div className="divide-y divide-neutral-100 mt-1">
          {decisions.slice(0, 3).map((item) => {
            const actionText = item.actionLabel || getDefaultActionLabel(item.priority)
            const contextShort = item.contextText || item.description || ''

            return (
              <div
                key={item.id}
                onClick={() => onSelectDecision && onSelectDecision(item)}
                className="py-3 flex flex-col gap-1.5 hover:bg-neutral-50/80 px-2 rounded-xl cursor-pointer transition-colors group text-xs"
              >
                {/* Linha 1: Prioridade + Título */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full ${getPriorityDot(item.priority)} shrink-0`}
                    />
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 rounded uppercase tracking-wider shrink-0 font-mono ${getBadgeStyle(
                        item.priority,
                      )}`}
                    >
                      {item.priority}
                    </Badge>
                    <span className="font-bold text-neutral-900 truncate group-hover:text-[#E10600] transition-colors leading-tight">
                      {item.title}
                    </span>
                  </div>

                  {/* Ação interativa no padrão solicitado */}
                  <span className="text-[11px] font-bold text-[#E10600] shrink-0 group-hover:underline flex items-center gap-0.5">
                    {actionText}
                  </span>
                </div>

                {/* Linha 2: Contexto curto */}
                {contextShort && (
                  <p className="text-[11px] text-neutral-500 leading-snug line-clamp-1 pl-4">
                    {contextShort}
                  </p>
                )}
              </div>
            )
          })}

          {decisions.length === 0 && (
            <div className="py-8 text-center text-xs text-neutral-400 font-medium">
              Nenhuma decisão organizacional pendente no momento.
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
