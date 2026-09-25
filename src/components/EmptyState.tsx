import React from 'react'
import { LucideIcon, Inbox, Activity as LucideActivity } from 'lucide-react'
import { cn } from '@/lib/utils'

declare global {
  var Activity: typeof LucideActivity
}
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).Activity = LucideActivity
}

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
        'flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[#CBD5E1] bg-white/70 text-[#64748B]',
        compact ? 'p-6 space-y-2.5' : 'p-10 sm:p-12 space-y-3',
        className,
      )}
    >
      <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B]">
        <Icon className={compact ? 'w-5 h-5' : 'w-7 h-7'} />
      </div>

      <div className="space-y-1 max-w-sm">
        <h3 className="text-sm sm:text-base font-semibold text-[#0F172A]">{title}</h3>
        {description && <p className="text-xs text-[#64748B] leading-relaxed">{description}</p>}
      </div>

      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

export default EmptyState
