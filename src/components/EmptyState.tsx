import React from 'react'
import { LucideIcon, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  compact?: boolean
}

/**
 * EmptyState elegante — Race Operations
 * - Ícone semântico centrado com moldura suave Camada 2
 * - Título em sentence case (Inter)
 * - Descrição explicativa discreta (#8B95A7)
 * - Ação primária/secundária opcional
 * - Substitui estados vazios ad-hoc com padrão limpo e consistente
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[#1F2733] bg-[#11161F]/60 text-[#8B95A7]',
        compact ? 'p-6 space-y-2.5' : 'p-10 sm:p-12 space-y-3',
        className,
      )}
    >
      <div className="p-3 rounded-xl bg-[#161D29] border border-[#1F2733] text-[#8B95A7]">
        <Icon className={compact ? 'w-5 h-5' : 'w-7 h-7'} />
      </div>

      <div className="space-y-1 max-w-sm">
        <h3 className="text-sm sm:text-base font-semibold text-[#F5F7FA]">{title}</h3>
        {description && <p className="text-xs text-[#8B95A7] leading-relaxed">{description}</p>}
      </div>

      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

export default EmptyState
