import React from 'react'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

/**
 * PageHeader — Componente base visual Race Operations
 * - Eyebrow: caixa alta + tracking largo (11px, uma linha)
 * - Título: sentence case, 20–24px (até 28px no desktop), peso 700 (Inter)
 * - Subtítulo: texto de descrição claro em Inter
 * - Área de ação primária à direita (botões, filtros, badges)
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1F2733]',
        className,
      )}
    >
      <div className="space-y-1 min-w-0">
        {eyebrow && <div className="eyebrow text-[#8B95A7]">{eyebrow}</div>}

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F7FA]">{title}</h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>

        {description && (
          <p className="text-xs sm:text-sm text-[#8B95A7] leading-relaxed max-w-3xl">
            {description}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  )
}

export default PageHeader
