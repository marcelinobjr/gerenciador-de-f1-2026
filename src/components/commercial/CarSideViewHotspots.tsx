import React from 'react'
import { SponsorshipContract } from '@/types/canonical-commercial'
import { getCarroPorEquipeImage } from '@/assets/carroPorEquipe'
import { getTeamSideView } from '@/data/assets/teamAssets'
import {
  SponsorSlotKey,
  OFFICIAL_SPONSOR_SLOTS,
  getTeamHotspots,
  SponsorHotspotCoord,
} from '@/data/assets/teamSponsorHotspots'
import { formatMoneyM, formatNumber } from '@/lib/formatters'

export interface CarSideViewHotspotsProps {
  teamId?: string | null
  teamKey?: string | null
  teamName?: string
  contracts: SponsorshipContract[]
  selectedSlot: SponsorSlotKey | null
  onSelectSlot: (slot: SponsorSlotKey) => void
  onExploreMarket?: (slot: SponsorSlotKey) => void
}

export const CarSideViewHotspots: React.FC<CarSideViewHotspotsProps> = ({
  teamId,
  teamKey,
  teamName,
  contracts,
  selectedSlot,
  onSelectSlot,
}) => {
  // Resolução canônica F1 2026:
  // 1. Autoridade primária é getTeamSideView usando a teamKey (ou fallback teamId se for a key)
  // 2. Fallback para getCarroPorEquipeImage, mas sem permitir que paths virtuais (/equipes/...) bloqueiem o fallback
  const resolvedKey = teamKey || teamId
  const sideViewFromAssets = getTeamSideView(resolvedKey)
  const legacyImage = getCarroPorEquipeImage(resolvedKey)
  // Ignora paths virtuais inexistentes que não são do bundle Vite
  const isVirtualPath = legacyImage?.startsWith('/equipes/') || legacyImage?.startsWith('/carros/')
  const validLegacyImage = isVirtualPath ? null : legacyImage

  const sideViewImage = sideViewFromAssets || validLegacyImage
  const hotspotsConfig = getTeamHotspots(resolvedKey)

  const getContractForSlot = (slotKey: SponsorSlotKey) => {
    return contracts.find(
      (c) =>
        c.status === 'ativo' &&
        (c.slot === slotKey || (c.packageSlots && c.packageSlots.includes(slotKey as any))),
    )
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#0A0D14] border border-[#1F2733] shadow-2xl p-4 sm:p-6 select-none">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 via-transparent to-red-600/15 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] bg-red-950/20 blur-3xl pointer-events-none" />

      {/* Header rápido com identificação da equipe */}
      <div className="relative z-10 flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#E10600] animate-pulse" />
          <span className="text-[11px] font-mono tracking-widest text-[#8B95A7] uppercase font-bold">
            ESPAÇOS OFICIAIS // MONOPOSTO F1 2026
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold text-white tracking-wide">
            {teamName || 'Equipe Oficial'}
          </span>
        </div>
      </div>

      {/* CONTAINER DO CARRO LATERAL REAL COM OS 5 HOTSPOTS HTML/CSS */}
      <div className="relative w-full aspect-[16/7] max-h-[460px] flex items-center justify-center overflow-hidden rounded-xl bg-black/40 border border-white/5">
        {/* Imagem lateral real da equipe (NÃO desenha SVG, NÃO recria geometria, NÃO altera imagem) */}
        {sideViewImage ? (
          <img
            src={sideViewImage}
            alt={teamName || 'Monoposto F1 2026'}
            className="w-full h-full object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)]"
            loading="eager"
          />
        ) : (
          <div className="text-center p-8 text-neutral-400 font-mono text-sm">
            Imagem lateral do carro não disponível
          </div>
        )}

        {/* 5 HOTSPOTS CALIBRADOS COM BASE NAS COORDENADAS (% X, Y) */}
        {OFFICIAL_SPONSOR_SLOTS.map((slotMeta) => {
          const coord: SponsorHotspotCoord = hotspotsConfig.slots[slotMeta.key]
          const contract = getContractForSlot(slotMeta.key)
          const isSelected = selectedSlot === slotMeta.key
          const isOccupied = !!contract

          // Posições em porcentagem
          const style: React.CSSProperties = {
            position: 'absolute',
            left: `${coord.x}%`,
            top: `${coord.y}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: isSelected ? 30 : 20,
          }

          return (
            <div
              key={slotMeta.key}
              style={style}
              className="cursor-pointer group flex items-center gap-2"
              onClick={() => onSelectSlot(slotMeta.key)}
            >
              {/* Hotspot Pin Circular com Pulso */}
              <div className="relative flex items-center justify-center">
                {isSelected && (
                  <div
                    className={`absolute w-7 h-7 rounded-full animate-ping ${
                      isOccupied ? 'bg-emerald-500/40' : 'bg-red-500/40'
                    }`}
                  />
                )}
                <div
                  className={`w-4 h-4 rounded-full border-2 transition-transform duration-200 group-hover:scale-125 flex items-center justify-center shadow-lg ${
                    isSelected
                      ? 'border-white scale-110 ' +
                        (isOccupied
                          ? 'bg-emerald-500 shadow-emerald-500/50'
                          : 'bg-[#E10600] shadow-red-500/50')
                      : isOccupied
                        ? 'border-emerald-300 bg-emerald-500 shadow-emerald-500/40'
                        : 'border-red-400 bg-red-600 shadow-red-600/40'
                  }`}
                >
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              </div>

              {/* Card Flutuante do Hotspot */}
              <div
                className={`transition-all duration-200 backdrop-blur-md px-2.5 py-1.5 rounded-lg border shadow-xl flex flex-col whitespace-nowrap ${
                  isSelected
                    ? isOccupied
                      ? 'bg-emerald-950/90 border-emerald-400 text-white ring-2 ring-emerald-500/30'
                      : 'bg-red-950/90 border-red-400 text-white ring-2 ring-red-500/30'
                    : isOccupied
                      ? 'bg-[#0B0E14]/85 border-emerald-500/40 text-neutral-200 group-hover:border-emerald-400'
                      : 'bg-[#0B0E14]/85 border-white/20 text-neutral-300 group-hover:border-red-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold tracking-tight">{coord.name}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-black tracking-wider uppercase ${
                      isOccupied
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {isOccupied ? 'OCUPADO' : 'VAGO'}
                  </span>
                </div>

                {isOccupied ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-white font-medium truncate max-w-[120px]">
                      {contract.sponsorName}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400">
                      {formatMoneyM(contract.fixedAnnualValue, true)}/ano
                    </span>
                  </div>
                ) : (
                  <span className="text-[9px] font-mono text-neutral-400 mt-0.5">
                    Est. {formatMoneyM(slotMeta.defaultMarketValueMin, false, 0)} –{' '}
                    {formatMoneyM(slotMeta.defaultMarketValueMax, false, 0)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
