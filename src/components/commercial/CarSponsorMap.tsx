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
 *
 * LIGHT-UI-01C: container claro (branco). O desenho técnico do carro
 * permanece como superfície técnica localizada, sem shell escuro estrutural.
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
    <div className="rounded-xl bg-white border border-[#E2E8F0] p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
        <div>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
            MAPA VISUAL DA CARENAGEM // F1 2026
          </span>
          <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
            Disposição dos 5 Espaços Oficiais de Patrocínio
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[11px] font-mono border-cyan-200 text-cyan-700 bg-cyan-50"
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
                  ? 'border-[#E10600] bg-red-50/60 ring-2 ring-[#E10600]/25'
                  : isOccupied
                    ? 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#94A3B8]'
                    : 'border-dashed border-[#CBD5E1] bg-white hover:border-emerald-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-mono uppercase ${
                      isOccupied
                        ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                        : 'border-[#CBD5E1] text-[#64748B]'
                    }`}
                  >
                    {isOccupied ? 'OCUPADO' : 'VAGO (R$ 0)'}
                  </Badge>
                  <span className="text-[10px] font-mono text-[#64748B]">
                    Peso: {(meta.weight * 100).toFixed(0)}%
                  </span>
                </div>

                <h4 className="text-xs font-bold text-[#0F172A] mt-2 truncate">{meta.name}</h4>
                <p className="text-[10px] text-[#64748B] line-clamp-2 mt-0.5">{meta.description}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#F1F5F9]">
                {contract ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#0F172A] truncate max-w-[110px]">
                        {contract.sponsorName}
                      </span>
                      {contract.isTitleSponsor && (
                        <Badge
                          variant="outline"
                          className="text-[8px] font-mono border-amber-300 text-amber-700 bg-amber-50"
                        >
                          TITLE
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-600">
                      {formatCurrency(contract.fixedAnnualValue)}/ano
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-[#64748B] font-mono">
                      <span>Vigência até {contract.seasonEnd}</span>
                      <span
                        className={
                          (contract.satisfaction || 80) >= 75
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }
                      >
                        ★ {contract.satisfaction || 80}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center text-[10px] font-mono text-emerald-600">
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
