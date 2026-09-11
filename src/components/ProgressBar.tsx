import React from 'react'
import { cn } from '@/lib/utils'

export interface ProgressBarProps {
  value: number // 0 a 100
  max?: number
  label?: string
  showValue?: boolean
  valueFormatter?: (val: number, max: number) => string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  trackClassName?: string
}

/**
 * ProgressBar com semântica de cor FIXA — Race Operations
 * - Verde (≥70%): excelente / saudável (#10B981)
 * - Âmbar (40–69%): atenção / moderado (#F59E0B)
 * - Vermelho (<40%): crítico / baixo (#EF4444)
 * - Um único componente reutilizável em todo o sistema.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  valueFormatter,
  size = 'md',
  className,
  trackClassName,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / (max || 100)) * 100))

  // Semântica de cor fixa
  let colorClass = 'bg-emerald-500'
  let textColorClass = 'text-emerald-400'
  if (percentage < 40) {
    colorClass = 'bg-red-500'
    textColorClass = 'text-red-400'
  } else if (percentage < 70) {
    colorClass = 'bg-amber-500'
    textColorClass = 'text-amber-400'
  }

  const heightClass = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }[size]

  const displayValue = valueFormatter ? valueFormatter(value, max) : `${Math.round(percentage)}%`

  return (
    <div className={cn('w-full space-y-1', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs leading-none">
          {label && (
            <span className="text-[#8B95A7] font-medium text-[11px] truncate">{label}</span>
          )}
          {showValue && (
            <span className={cn('font-num tabular-nums font-semibold text-[11px]', textColorClass)}>
              {displayValue}
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          'w-full bg-[#161D29] border border-[#1F2733] rounded-full overflow-hidden',
          heightClass,
          trackClassName,
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
