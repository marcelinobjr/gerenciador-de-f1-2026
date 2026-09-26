import React, { useState } from 'react'
import { UnifiedDriverItem } from '@/pages/DriversPage'
import { DriverPoster } from '@/components/DriverPoster'
import { CountryFlag } from '@/components/CountryFlag'
import { getOverallRating } from '@/lib/mbj-drivers-data'
import { formatUsdCurrency } from '@/components/PilotProfileDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { GitCompare, Trophy, Zap, Activity, CloudRain, Shield } from 'lucide-react'

interface DriverComparisonModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  primaryDriver: UnifiedDriverItem | null
  allDrivers: UnifiedDriverItem[]
}

export const DriverComparisonModal: React.FC<DriverComparisonModalProps> = ({
  open,
  onOpenChange,
  primaryDriver,
  allDrivers,
}) => {
  const [secondaryDriverId, setSecondaryDriverId] = useState<string>('')

  // Piloto secundário
  const secondaryDriver = allDrivers.find((d) => d.id === secondaryDriverId) || null

  if (!primaryDriver) return null

  const ovr1 = getOverallRating(primaryDriver)
  const ovr2 = secondaryDriver ? getOverallRating(secondaryDriver) : null

  const renderComparisonBar = (label: string, val1: number, val2?: number | null) => {
    const v2 = val2 ?? 0
    const diff = val2 !== undefined && val2 !== null ? val1 - val2 : 0

    return (
      <div className="space-y-1 py-1 border-b border-slate-100 last:border-b-0">
        <div className="flex items-center justify-between text-xs">
          <span
            className={`font-mono font-bold ${
              diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-slate-500' : 'text-slate-700'
            }`}
          >
            {val1}
          </span>
          <span className="text-slate-600 font-medium text-[11px] uppercase tracking-wider">
            {label}
          </span>
          <span
            className={`font-mono font-bold ${
              diff < 0 ? 'text-emerald-600' : diff > 0 ? 'text-slate-500' : 'text-slate-700'
            }`}
          >
            {secondaryDriver ? v2 : '—'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="flex justify-end bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${
                diff > 0 ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
              style={{ width: `${Math.min(100, val1)}%` }}
            />
          </div>
          <div className="bg-slate-100">
            {secondaryDriver && (
              <div
                className={`h-full rounded-full transition-all ${
                  diff < 0 ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                style={{ width: `${Math.min(100, v2)}%` }}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border-slate-200 text-slate-900 p-6 rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-[#E10600]" />
            Comparar Pilotos
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Compare métricas de velocidade, consistência, adaptabilidade e dados de contrato lado a
            lado.
          </DialogDescription>
        </DialogHeader>

        {/* Pilotos em comparação lado a lado */}
        <div className="grid grid-cols-2 gap-4 pt-3">
          {/* Piloto 1 (Fixo inicial) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center text-center">
            <div className="w-20 aspect-[3/4] rounded-lg overflow-hidden border border-slate-200 bg-slate-900 shadow-xs mb-2">
              <DriverPoster name={primaryDriver.name} driverId={primaryDriver.id} />
            </div>
            <div className="flex items-center gap-1 font-bold text-sm text-slate-900">
              <CountryFlag code={primaryDriver.nationality} />
              <span className="truncate">{primaryDriver.name}</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              {primaryDriver.teamName || 'Livre no mercado'}
            </div>
            <div className="mt-2 flex items-center gap-1">
              <Badge className="bg-slate-900 text-white font-mono text-xs px-2 py-0.5">
                OVR {ovr1}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-slate-300">
                {primaryDriver.age} anos
              </Badge>
            </div>
          </div>

          {/* Piloto 2 (Seletor) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center text-center">
            {secondaryDriver ? (
              <>
                <div className="w-20 aspect-[3/4] rounded-lg overflow-hidden border border-slate-200 bg-slate-900 shadow-xs mb-2">
                  <DriverPoster name={secondaryDriver.name} driverId={secondaryDriver.id} />
                </div>
                <div className="flex items-center gap-1 font-bold text-sm text-slate-900">
                  <CountryFlag code={secondaryDriver.nationality} />
                  <span className="truncate">{secondaryDriver.name}</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {secondaryDriver.teamName || 'Livre no mercado'}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <Badge className="bg-slate-900 text-white font-mono text-xs px-2 py-0.5">
                    OVR {ovr2}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-slate-300">
                    {secondaryDriver.age} anos
                  </Badge>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-2 text-slate-400">
                <GitCompare className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-xs font-medium">Selecione outro piloto</span>
              </div>
            )}

            {/* Select de piloto */}
            <div className="w-full mt-3">
              <Select value={secondaryDriverId} onValueChange={setSecondaryDriverId}>
                <SelectTrigger className="w-full h-8 text-xs bg-white border-slate-200">
                  <SelectValue placeholder="Escolher piloto..." />
                </SelectTrigger>
                <SelectContent className="max-h-60 bg-white">
                  {allDrivers
                    .filter((d) => d.id !== primaryDriver.id)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        {d.name} ({d.teamName || 'Livre'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Métricas Comparadas */}
        <div className="bg-slate-50/60 border border-slate-200/80 rounded-xl p-4 mt-2 space-y-2">
          {renderComparisonBar('Velocidade', primaryDriver.speed, secondaryDriver?.speed)}
          {renderComparisonBar(
            'Consistência',
            primaryDriver.consistency,
            secondaryDriver?.consistency,
          )}
          {renderComparisonBar('Chuva', primaryDriver.rain, secondaryDriver?.rain)}
          {renderComparisonBar('Defesa', primaryDriver.defense, secondaryDriver?.defense)}
          {renderComparisonBar(
            'Ritmo',
            primaryDriver.racePace ??
              Math.round((primaryDriver.speed + primaryDriver.consistency) / 2),
            secondaryDriver
              ? (secondaryDriver.racePace ??
                  Math.round((secondaryDriver.speed + secondaryDriver.consistency) / 2))
              : null,
          )}
          {renderComparisonBar(
            'Feedback',
            primaryDriver.feedback ?? primaryDriver.consistency,
            secondaryDriver ? (secondaryDriver.feedback ?? secondaryDriver.consistency) : null,
          )}
        </div>

        {/* Informações Financeiras */}
        <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-mono block">
              Salário / Mercado
            </span>
            <span className="font-mono font-bold text-slate-900">
              {formatUsdCurrency(primaryDriver.salaryUsd, 'full')}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[10px] text-slate-500 uppercase font-mono block">
              Salário / Mercado
            </span>
            <span className="font-mono font-bold text-slate-900">
              {secondaryDriver ? formatUsdCurrency(secondaryDriver.salaryUsd, 'full') : '—'}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
export default DriverComparisonModal
