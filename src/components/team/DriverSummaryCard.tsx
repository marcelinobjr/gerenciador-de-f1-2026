import React from 'react'
import { Card } from '@/components/ui/card'
import { ChevronRight } from 'lucide-react'
import { getCountryFlag } from '@/lib/country-flags'
import { getDriverPhotoSources } from '@/lib/driver-photos'

interface DriverSummaryCardProps {
  slotNumber: 1 | 2
  driverName: string
  driverNumber: number | string
  nationality: string
  overallRating: number
  moral: number
  forma: number
  consistency: number
  contractEndYear: number
  bundledImg?: string
  driverId?: string
  onOpenDriver: () => void
}

export const DriverSummaryCard: React.FC<DriverSummaryCardProps> = ({
  slotNumber,
  driverName,
  driverNumber,
  nationality,
  overallRating,
  moral,
  forma,
  consistency,
  contractEndYear,
  bundledImg,
  driverId,
  onOpenDriver,
}) => {
  const photoUrl =
    bundledImg ||
    getDriverPhotoSources(driverName).bundledImg ||
    getDriverPhotoSources(driverName).localCandidates[0] ||
    getDriverPhotoSources(driverName).localPath

  return (
    <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl p-5 overflow-hidden flex flex-col justify-between">
      <div>
        {/* Topo: PILOTO #1 ou #2 + VER PILOTO */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-800 font-sans">
            PILOTO #{slotNumber}
          </span>
          <button
            type="button"
            onClick={onOpenDriver}
            className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 flex items-center gap-0.5 cursor-pointer transition-colors"
          >
            VER PILOTO
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Corpo: Foto à esquerda, detalhes à direita */}
        <div className="grid grid-cols-12 gap-3.5 py-3.5 items-center">
          {/* Foto do Piloto */}
          <div className="col-span-5 flex justify-center">
            <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 shadow-sm relative shrink-0">
              <img
                src={photoUrl}
                alt={driverName}
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>

          {/* Nome, Número, GER e Barras */}
          <div className="col-span-7 space-y-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs">
                <span>{getCountryFlag(nationality)}</span>
                <span className="text-[10px] uppercase font-bold text-neutral-400 font-sans">
                  {nationality}
                </span>
              </div>

              <div className="flex items-start justify-between gap-1 mt-0.5">
                <div>
                  <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight leading-tight">
                    {driverName}
                  </h3>
                  <span className="text-xs font-extrabold text-[#E10600] font-mono">
                    #{driverNumber}
                  </span>
                </div>

                <div className="bg-neutral-900 text-white px-2 py-0.5 rounded-md text-center shrink-0">
                  <div className="text-[9px] uppercase font-medium text-neutral-400 leading-none">
                    GER
                  </div>
                  <div className="text-sm font-black font-mono leading-tight">{overallRating}</div>
                </div>
              </div>
            </div>

            {/* Barras: Moral, Forma, Consistência */}
            <div className="space-y-1.5 pt-1 font-sans text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500 w-20 shrink-0">Moral</span>
                <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(10, moral))}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-neutral-700 w-5 text-right">
                  {moral}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500 w-20 shrink-0">Forma</span>
                <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(10, forma))}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-neutral-700 w-5 text-right">
                  {forma}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500 w-20 shrink-0">Consistência</span>
                <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(10, consistency))}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-neutral-700 w-5 text-right">
                  {consistency}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Linha de Contrato */}
      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
        <span className="text-xs text-neutral-500 font-medium">Contrato até {contractEndYear}</span>
      </div>
    </Card>
  )
}
