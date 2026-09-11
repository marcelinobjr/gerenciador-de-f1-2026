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
  iconColor = 'text-[#8B95A7]',
  accentColor,
  className,
  onClick,
}: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'relative bg-[#11161F] border-[#1F2733] p-4 rounded-xl transition-all duration-150',
        onClick && 'cursor-pointer hover:bg-[#161D29] hover:border-[#2C3849]',
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
          <div className="eyebrow truncate text-[#8B95A7]">{eyebrow}</div>

          <div className="font-num text-2xl lg:text-3xl font-bold tracking-tight text-[#F5F7FA] tabular-nums truncate">
            {value}
          </div>

          {(delta || subtext) && (
            <div className="flex items-center gap-1.5 text-xs text-[#8B95A7] pt-0.5 truncate">
              {delta && (
                <span
                  className={cn(
                    'font-num font-semibold tabular-nums text-[11px] px-1.5 py-0.5 rounded',
                    delta.trend === 'up' && 'text-emerald-400 bg-emerald-500/10',
                    delta.trend === 'down' && 'text-red-400 bg-red-500/10',
                    (!delta.trend || delta.trend === 'neutral') && 'text-slate-300 bg-slate-800/40',
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
              'p-2.5 rounded-lg bg-[#161D29] border border-[#1F2733] shrink-0',
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
