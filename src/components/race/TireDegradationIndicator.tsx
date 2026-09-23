import React from 'react'
import { Badge } from '@/components/ui/badge'
import {
  getTireDegradationBand,
  type TireDegradationBandInfo,
  type CarTireDisplayState,
  selectCarTireDisplayState,
} from '@/lib/canonical-tire-strategy'
import type { TireCompound } from '@/types/f1'

export interface TireDegradationIndicatorProps {
  wearPct?: number | null
  conditionPct?: number | null
  isInCliff?: boolean
  compound?: TireCompound | null
  lapsOnTire?: number | null
  compact?: boolean
  showBadge?: boolean
  showLaps?: boolean
  showNumericPct?: boolean
  className?: string
  carTireDisplayState?: CarTireDisplayState
}

/**
 * TireDegradationIndicator
 *
 * FC02C — Indicador visual de degradação:
 * - Barra de integridade com faixas:
 *     0–25% desgaste verde (bg-emerald-500, Nominal)
 *     26–59% desgaste âmbar (bg-amber-500, Moderada)
 *     60–79% desgaste laranja (bg-orange-500, Alerta)
 *     ≥80% ou cliff vermelho pulsante (bg-rose-600 animate-pulse, Cliff/Janela Crítica)
 * - Badge de status coerente com selectCarTireDisplayState
 * - UI nunca calcula lógica — consome getTireDegradationBand e selectCarTireDisplayState
 */
export const TireDegradationIndicator: React.FC<TireDegradationIndicatorProps> = ({
  wearPct,
  conditionPct,
  isInCliff = false,
  compound,
  lapsOnTire,
  compact = false,
  showBadge = true,
  showLaps = false,
  showNumericPct = true,
  className = '',
  carTireDisplayState,
}) => {
  // Se receber carTireDisplayState completo, dá preferência a ele
  const effectiveWearPct = carTireDisplayState?.tireWearPct ?? wearPct ?? 0
  const effectiveIsInCliff = carTireDisplayState?.isInCliff ?? isInCliff
  const effectiveConditionPct =
    carTireDisplayState?.tireConditionPct ??
    conditionPct ??
    Math.max(0, 100 - (effectiveWearPct ?? 0))
  const effectiveLaps = carTireDisplayState?.lapsOnTire ?? lapsOnTire

  const band: TireDegradationBandInfo = getTireDegradationBand(effectiveWearPct, effectiveIsInCliff)

  const isDarkContainer = true // Cockpit e painéis Apex são fundo escuro ou adaptáveis

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Linha de cabeçalho: Nome do Composto / Status / Desgaste % */}
      <div className="flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {showBadge && (
            <Badge
              variant="outline"
              className={`text-[10px] font-black uppercase px-1.5 py-0 border ${band.borderColorClass} ${band.textColorClass} ${
                band.animatePulse ? 'animate-pulse' : ''
              }`}
            >
              {band.label}
            </Badge>
          )}

          {showLaps && typeof effectiveLaps === 'number' && (
            <span className="text-[10px] font-mono text-slate-400">{effectiveLaps}v de uso</span>
          )}
        </div>

        {showNumericPct && (
          <div className="text-right text-[11px] font-mono shrink-0">
            <span className={`font-black ${band.textColorClass}`}>{effectiveWearPct}% desg.</span>
            {!compact && (
              <span className="text-slate-400 ml-1">({effectiveConditionPct}% vida)</span>
            )}
          </div>
        )}
      </div>

      {/* Barra de Integridade */}
      <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
        <div
          role="progressbar"
          aria-valuenow={effectiveConditionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`h-full rounded-full transition-all duration-300 ${band.colorClass}`}
          style={{ width: `${effectiveConditionPct}%` }}
        />
      </div>
    </div>
  )
}
