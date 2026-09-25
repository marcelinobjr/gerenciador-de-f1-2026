import React from 'react'
import { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  eyebrow: string
  value: React.ReactNode
  delta?: {
    value: string | number
    trend?: 'up' | 'down' | 'neutral'
    label?: string
  }
  subtext?: React.ReactNode
  icon?: LucideIcon
  iconColor?: string
  accentColor?: string
  className?: string
  onClick?: () => void
}

/**
 * StatCard — Componente base visual Race Operations
 * - Eyebrow: uppercase 11px com tracking largo em linha única
 * - Valor grande: fonte JetBrains Mono tabular (tabular-nums font-num)
 * - Legenda / Delta opcional
 * - Ícone semântico à direita ou no topo
 * - Superfície Camada 1 (#11161F) com borda #1F2733
 */
export function StatCard({
  eyebrow,
  value,
  delta,
  subtext,
  icon: Icon,
  iconColor = 'text-[#64748B]',
  accentColor,
  className,
  onClick,
}: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'relative bg-white border-[#E2E8F0] shadow-xs p-4 rounded-xl transition-all duration-150',
        onClick && 'cursor-pointer hover:bg-neutral-50/80 hover:border-[#CBD5E1]',
        className,
      )}
    >
      {/* Barra de acento opcional no topo */}
      {accentColor && (
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
          style={{ backgroundColor: accentColor }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="eyebrow truncate text-[#64748B]">{eyebrow}</div>

          <div className="font-num text-2xl lg:text-3xl font-bold tracking-tight text-[#0F172A] tabular-nums truncate">
            {value}
          </div>

          {(delta || subtext) && (
            <div className="flex items-center gap-1.5 text-xs text-[#64748B] pt-0.5 truncate">
              {delta && (
                <span
                  className={cn(
                    'font-num font-semibold tabular-nums text-[11px] px-1.5 py-0.5 rounded',
                    delta.trend === 'up' &&
                      'text-emerald-700 bg-emerald-50 border border-emerald-100',
                    delta.trend === 'down' && 'text-rose-700 bg-rose-50 border border-rose-100',
                    (!delta.trend || delta.trend === 'neutral') &&
                      'text-slate-600 bg-slate-100 border border-slate-200',
                  )}
                >
                  {delta.trend === 'up' && '+'}
                  {delta.value}
                </span>
              )}
              {delta?.label && <span className="truncate">{delta.label}</span>}
              {subtext && !delta && <span className="truncate">{subtext}</span>}
            </div>
          )}
        </div>

        {Icon && (
          <div
            className={cn(
              'p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] shrink-0',
              iconColor,
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  )
}

export default StatCard
