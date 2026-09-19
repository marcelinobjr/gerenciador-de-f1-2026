import React from 'react'
import { Card } from '@/components/ui/card'
import { getCountryFlag } from '@/lib/country-flags'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'

interface DriverSummaryCardProps {
  slotNumber: 1 | 2
  driverName: string
  driverNumber: number
  nationality: string
  overallRating: number
  moral: number
  forma: number
  consistency: number
  contractEndYear: number
  driverId: string
  bundledImg?: string
  teamLogoUrl?: string
  isAudi?: boolean
  quote?: string
  visualIdentity?: any
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
  driverId,
  bundledImg,
  teamLogoUrl,
  isAudi = false,
  quote,
  visualIdentity,
  onOpenDriver,
}) => {
  const defaultQuote =
    slotNumber === 1
      ? '“Experiência, carisma e velocidade quando mais importa.”'
      : '“Talento brasileiro. Um grande futuro em construção.”'

  const displayQuote = quote || defaultQuote

  return (
    <Card
      onClick={onOpenDriver}
      className="bg-white border-neutral-200/90 shadow-sm hover:shadow-md transition-all duration-200 rounded-2xl p-5 cursor-pointer flex flex-col justify-between group overflow-hidden"
    >
      <div>
        {/* Topo do Card: Piloto #1/#2, Bandeira, Nome e Número + Logo */}
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-neutral-100">
          <div>
            <div className="text-[10px] uppercase font-bold text-neutral-400 font-mono tracking-wider">
              Piloto #{slotNumber}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-base leading-none drop-shadow-sm">
                {getCountryFlag(nationality)}
              </span>
              <h3 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight font-sans truncate group-hover:text-[#E10600] transition-colors">
                {driverName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono font-black text-2xl sm:text-3xl text-neutral-900 leading-none">
              {driverNumber}
            </span>
            {isAudi ? (
              <div className="flex items-center -space-x-1 opacity-70">
                <span className="w-3 h-3 rounded-full border border-neutral-800 inline-block" />
                <span className="w-3 h-3 rounded-full border border-neutral-800 inline-block" />
                <span className="w-3 h-3 rounded-full border border-neutral-800 inline-block" />
                <span className="w-3 h-3 rounded-full border border-neutral-800 inline-block" />
              </div>
            ) : teamLogoUrl ? (
              <img
                src={teamLogoUrl}
                alt="Logo"
                className="h-4 max-w-[45px] object-contain opacity-70"
              />
            ) : null}
          </div>
        </div>

        {/* Corpo: Imagem do piloto + GER + Contrato + Barras de Moral, Forma, Consistência */}
        <div className="flex gap-4 pt-3.5 items-start">
          {/* Foto do Piloto */}
          <div className="relative w-24 sm:w-28 h-36 sm:h-40 rounded-xl overflow-hidden bg-neutral-100 shrink-0 border border-neutral-200/70 shadow-inner">
            {bundledImg ? (
              <img
                src={bundledImg}
                alt={driverName}
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <DriverPhotoAvatar
                  name={driverName}
                  driverId={driverId}
                  visualIdentity={visualIdentity}
                  size="lg"
                />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Dados & Barras */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* GER e Contrato */}
            <div className="flex items-center justify-between gap-2">
              <div className="bg-neutral-900 text-white rounded-lg px-2.5 py-1 text-center shrink-0">
                <div className="text-[9px] uppercase font-bold text-neutral-400 font-mono leading-none">
                  GER
                </div>
                <div className="text-base font-black font-mono leading-tight">{overallRating}</div>
              </div>

              <div className="text-right min-w-0">
                <div className="text-[10px] uppercase font-bold text-neutral-400 leading-none font-mono">
                  Contrato até
                </div>
                <div className="text-xs sm:text-sm font-black text-neutral-900 mt-0.5 truncate">
                  Fim de {contractEndYear}
                </div>
              </div>
            </div>

            {/* Barras de Estatísticas Reais */}
            <div className="space-y-2 pt-1">
              {/* Moral */}
              <div>
                <div className="flex justify-between text-[11px] font-medium text-neutral-600 mb-0.5">
                  <span>Moral</span>
                  <span className="font-mono font-bold text-neutral-900">{moral}%</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, moral))}%` }}
                  />
                </div>
              </div>

              {/* Forma */}
              <div>
                <div className="flex justify-between text-[11px] font-medium text-neutral-600 mb-0.5">
                  <span>Forma</span>
                  <span className="font-mono font-bold text-neutral-900">{forma}%</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, forma))}%` }}
                  />
                </div>
              </div>

              {/* Consistência */}
              <div>
                <div className="flex justify-between text-[11px] font-medium text-neutral-600 mb-0.5">
                  <span>Consistência</span>
                  <span className="font-mono font-bold text-neutral-900">{consistency}%</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(5, consistency))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Citação Inferior */}
      <div className="mt-3 pt-2.5 border-t border-neutral-100">
        <p className="text-[11px] italic text-neutral-400 font-serif text-right truncate">
          {displayQuote}
        </p>
      </div>
    </Card>
  )
}
