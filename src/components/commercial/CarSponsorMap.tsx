import React from 'react'
import {
  CanonicalSponsorSlot,
  CANONICAL_SLOT_METAS,
  SponsorshipContract,
} from '@/types/canonical-commercial'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'

interface CarSponsorMapProps {
  contracts: SponsorshipContract[]
  onSelectSlot?: (slot: CanonicalSponsorSlot) => void
  selectedSlot?: CanonicalSponsorSlot | null
  commercialAttractivenessScore?: number
}

/**
 * Diagrama do Carro F1 2026 com os 5 espaços canônicos de patrocínio
 * Sidepod, Engine Cover, Rear Wing, Nose, Front Wing
 */
export const CarSponsorMap: React.FC<CarSponsorMapProps> = ({
  contracts,
  onSelectSlot,
  selectedSlot,
  commercialAttractivenessScore = 75,
}) => {
  const getContractForSlot = (slot: CanonicalSponsorSlot) => {
    return contracts.find(
      (c) =>
        c.status === 'ativo' &&
        (c.slot === slot || (c.packageSlots && c.packageSlots.includes(slot))),
    )
  }

  const slotsOrder: CanonicalSponsorSlot[] = [
    'front_wing',
    'nose',
    'sidepod',
    'engine_cover',
    'rear_wing',
  ]

  return (
    <div className="rounded-xl bg-[#0B0E14] border border-[#1F2733] p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F2733] pb-3">
        <div>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
            MAPA VISUAL DA CARENAGEM // F1 2026
          </span>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            Disposição dos 5 Espaços Oficiais de Patrocínio
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[11px] font-mono border-cyan-500/40 text-cyan-400 bg-cyan-950/20"
          >
            Atratividade Comercial: {commercialAttractivenessScore}/100
          </Badge>
        </div>
      </div>

      {/* Grid Interativo dos 5 Slots */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {slotsOrder.map((slot) => {
          const meta = CANONICAL_SLOT_METAS[slot]
          const contract = getContractForSlot(slot)
          const isSelected = selectedSlot === slot
          const isOccupied = !!contract

          return (
            <div
              key={slot}
              onClick={() => onSelectSlot?.(slot)}
              className={`cursor-pointer rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-[#E10600] bg-[#161D29] ring-2 ring-[#E10600]/40'
                  : isOccupied
                    ? 'border-[#1F2733] bg-[#0E131F] hover:border-[#2D384D]'
                    : 'border-dashed border-[#1F2733] bg-[#0B0E14] hover:border-emerald-500/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-mono uppercase ${
                      isOccupied
                        ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                        : 'border-neutral-700 text-neutral-400'
                    }`}
                  >
                    {isOccupied ? 'OCUPADO' : 'VAGO (R$ 0)'}
                  </Badge>
                  <span className="text-[10px] font-mono text-[#8B95A7]">
                    Peso: {(meta.weight * 100).toFixed(0)}%
                  </span>
                </div>

                <h4 className="text-xs font-bold text-white mt-2 truncate">{meta.name}</h4>
                <p className="text-[10px] text-[#8B95A7] line-clamp-2 mt-0.5">{meta.description}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#1F2733]/60">
                {contract ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white truncate max-w-[110px]">
                        {contract.sponsorName}
                      </span>
                      {contract.isTitleSponsor && (
                        <Badge
                          variant="outline"
                          className="text-[8px] font-mono border-amber-500 text-amber-400 bg-amber-950/30"
                        >
                          TITLE
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-400">
                      {formatCurrency(contract.fixedAnnualValue)}/ano
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-[#8B95A7] font-mono">
                      <span>Vigência até {contract.seasonEnd}</span>
                      <span
                        className={
                          (contract.satisfaction || 80) >= 75
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
                        ★ {contract.satisfaction || 80}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center text-[10px] font-mono text-emerald-400/80">
                    + Disponível para Ofertas
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
