import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { SponsorshipContract } from '@/types/canonical-commercial'
import { getCarroPorEquipeImage } from '@/assets/carroPorEquipe'
import { getTeamSideView } from '@/data/assets/teamAssets'
import {
  SponsorSlotKey,
  OFFICIAL_SPONSOR_SLOTS,
  getTeamHotspots,
  SponsorHotspotCoord,
} from '@/data/assets/teamSponsorHotspots'
import { formatMoneyM } from '@/lib/formatters'

export interface CarSideViewHotspotsProps {
  teamId?: string | null
  teamKey?: string | null
  teamName?: string
  contracts: SponsorshipContract[]
  selectedSlot: SponsorSlotKey | null
  onSelectSlot: (slot: SponsorSlotKey) => void
  onExploreMarket?: (slot: SponsorSlotKey) => void
}

interface Point {
  x: number
  y: number
}

interface ConnectorLine {
  slotKey: SponsorSlotKey
  start: Point
  end: Point
  color: string
  isActive: boolean
  isHovered: boolean
  isOccupied: boolean
}

export const CarSideViewHotspots: React.FC<CarSideViewHotspotsProps> = ({
  teamId,
  teamKey,
  teamName,
  contracts,
  selectedSlot,
  onSelectSlot,
  onExploreMarket,
}) => {
  const resolvedKey = teamKey || teamId
  const sideViewFromAssets = getTeamSideView(resolvedKey)
  const legacyImage = getCarroPorEquipeImage(resolvedKey)
  const isVirtualPath = legacyImage?.startsWith('/equipes/') || legacyImage?.startsWith('/carros/')
  const validLegacyImage = isVirtualPath ? null : legacyImage

  const sideViewImage = sideViewFromAssets || validLegacyImage
  const hotspotsConfig = getTeamHotspots(resolvedKey)

  // Hover state
  const [hoveredSlot, setHoveredSlot] = useState<SponsorSlotKey | null>(null)

  // Refs for coordinate measurement
  const stageRef = useRef<HTMLDivElement>(null)
  const carAreaRef = useRef<HTMLDivElement>(null)
  const boxRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const hotspotRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // SVG lines state
  const [lines, setLines] = useState<ConnectorLine[]>([])

  const getContractForSlot = useCallback(
    (slotKey: SponsorSlotKey) => {
      return contracts.find(
        (c) =>
          c.status === 'ativo' &&
          (c.slot === slotKey || (c.packageSlots && c.packageSlots.includes(slotKey as any))),
      )
    },
    [contracts],
  )

  // Re-calculate SVG connector lines based on actual DOM bounding rects relative to stageRef
  const updateConnectorLines = useCallback(() => {
    if (!stageRef.current) return
    const stageRect = stageRef.current.getBoundingClientRect()
    if (stageRect.width === 0 || stageRect.height === 0) return

    const newLines: ConnectorLine[] = []

    OFFICIAL_SPONSOR_SLOTS.forEach((slotMeta) => {
      const slotKey = slotMeta.key
      const boxEl = boxRefs.current[slotKey]
      const spotEl = hotspotRefs.current[slotKey]

      if (!boxEl || !spotEl) return

      const boxRect = boxEl.getBoundingClientRect()
      const spotRect = spotEl.getBoundingClientRect()

      const spotCenter: Point = {
        x: spotRect.left + spotRect.width / 2 - stageRect.left,
        y: spotRect.top + spotRect.height / 2 - stageRect.top,
      }

      const coord = hotspotsConfig.slots[slotKey]
      const isTopBand = coord.boxBand === 'top'

      let startPoint: Point
      if (isTopBand) {
        // Line exits bottom of the box, slightly biased toward the hotspot's X
        const clampedX = Math.max(
          boxRect.left + 16,
          Math.min(boxRect.right - 16, spotRect.left + spotRect.width / 2),
        )
        startPoint = {
          x: clampedX - stageRect.left,
          y: boxRect.bottom - stageRect.top,
        }
      } else {
        // Line exits top of the box
        const clampedX = Math.max(
          boxRect.left + 16,
          Math.min(boxRect.right - 16, spotRect.left + spotRect.width / 2),
        )
        startPoint = {
          x: clampedX - stageRect.left,
          y: boxRect.top - stageRect.top,
        }
      }

      const contract = getContractForSlot(slotKey)
      const isOccupied = !!contract
      const isActive = selectedSlot === slotKey
      const isHovered = hoveredSlot === slotKey

      newLines.push({
        slotKey,
        start: startPoint,
        end: spotCenter,
        color: isActive || isHovered ? '#EF4444' : 'rgba(239, 68, 68, 0.65)',
        isActive,
        isHovered,
        isOccupied,
      })
    })

    setLines(newLines)
  }, [hotspotsConfig, selectedSlot, hoveredSlot, getContractForSlot])

  // Recalculate on mount, resize, contract change, selection
  useLayoutEffect(() => {
    updateConnectorLines()
  }, [updateConnectorLines])

  useEffect(() => {
    const handleResize = () => {
      updateConnectorLines()
    }
    window.addEventListener('resize', handleResize)
    const ro = new ResizeObserver(() => {
      updateConnectorLines()
    })
    if (stageRef.current) ro.observe(stageRef.current)
    if (carAreaRef.current) ro.observe(carAreaRef.current)

    return () => {
      window.removeEventListener('resize', handleResize)
      ro.disconnect()
    }
  }, [updateConnectorLines])

  // Top band slots in order: Nose, Sidepod, Engine Cover, Rear Wing
  const topSlotKeys: SponsorSlotKey[] = ['nose', 'sidepod', 'engine_cover', 'rear_wing']
  // Bottom band slots in order: Front Wing
  const bottomSlotKeys: SponsorSlotKey[] = ['front_wing']

  // Render info box helper
  const renderInfoBox = (slotKey: SponsorSlotKey) => {
    const slotMeta = OFFICIAL_SPONSOR_SLOTS.find((s) => s.key === slotKey)!
    const coord: SponsorHotspotCoord = hotspotsConfig.slots[slotKey]
    const contract = getContractForSlot(slotKey)
    const isOccupied = !!contract
    const isSelected = selectedSlot === slotKey
    const isHovered = hoveredSlot === slotKey

    return (
      <div
        key={slotKey}
        ref={(el) => {
          boxRefs.current[slotKey] = el
        }}
        onClick={() => onSelectSlot(slotKey)}
        onMouseEnter={() => setHoveredSlot(slotKey)}
        onMouseLeave={() => setHoveredSlot(null)}
        className={`cursor-pointer transition-all duration-200 select-none rounded-xl px-3.5 py-2 sm:px-4 sm:py-2.5 backdrop-blur-md border shadow-lg flex flex-col justify-center ${
          isSelected
            ? isOccupied
              ? 'bg-[#0B1512]/95 border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-950/40'
              : 'bg-[#180B0D]/95 border-red-500 ring-2 ring-red-500/40 shadow-red-950/40'
            : isHovered
              ? isOccupied
                ? 'bg-[#0B1311]/90 border-emerald-400/80 -translate-y-0.5'
                : 'bg-[#140D10]/90 border-red-400/80 -translate-y-0.5'
              : isOccupied
                ? 'bg-[#090D12]/80 border-emerald-500/30 hover:border-emerald-400/60'
                : 'bg-[#090D12]/80 border-[#2A3442] hover:border-red-400/60'
        }`}
      >
        {/* Header: Label + Badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs sm:text-[13px] font-bold text-white tracking-tight">
            {coord.name}
          </span>
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-black tracking-wider uppercase border ${
              isOccupied
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-red-500/20 text-red-300 border-red-500/40'
            }`}
          >
            {isOccupied ? 'OCUPADO' : 'VAGO'}
          </span>
        </div>

        {/* Content line */}
        <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
          {isOccupied ? (
            <>
              <span className="text-[11px] font-semibold text-neutral-200 truncate max-w-[130px]">
                {contract.sponsorName}
              </span>
              <span className="font-mono font-bold text-emerald-400 whitespace-nowrap text-xs">
                {formatMoneyM(contract.fixedAnnualValue, true)}/ano
              </span>
            </>
          ) : (
            <span className="text-[10px] sm:text-[11px] font-mono text-neutral-400 whitespace-nowrap">
              Est. {formatMoneyM(slotMeta.defaultMarketValueMin, false, 0)} –{' '}
              {formatMoneyM(slotMeta.defaultMarketValueMax, false, 0)}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#0A0D14] border border-[#1F2733] shadow-2xl p-4 sm:p-6 select-none">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 via-transparent to-red-600/15 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[65%] bg-red-950/20 blur-3xl pointer-events-none" />

      {/* Header com identificação da equipe */}
      <div className="relative z-20 flex items-center justify-between pb-3 border-b border-white/10 mb-3 sm:mb-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#E10600] animate-pulse" />
          <span className="text-[11px] font-mono tracking-widest text-[#8B95A7] uppercase font-bold">
            ESPAÇOS OFICIAIS // MONOPOSTO F1 2026
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold text-white tracking-wide">
            {teamName || 'Audi F1 Team'}
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DESKTOP / TABLET: STAGE COM FAIXAS PRETAS E CARRO LIMPO   */}
      {/* ========================================================= */}
      <div
        ref={stageRef}
        className="relative z-10 w-full rounded-xl overflow-hidden bg-[#05070B] border border-white/10 flex flex-col hidden md:flex"
      >
        {/* SVG OVERLAY RESPONSIVO PARA LINHAS DE CONEXÃO */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            <filter id="red-line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="2"
                floodColor="#EF4444"
                floodOpacity="0.8"
              />
            </filter>
            <filter id="red-line-glow-active" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="3.5"
                floodColor="#EF4444"
                floodOpacity="1"
              />
            </filter>
          </defs>
          {lines.map((line) => {
            const isHighlight = line.isActive || line.isHovered
            return (
              <g key={`connector-${line.slotKey}`}>
                {/* Outer soft glow line */}
                <line
                  x1={line.start.x}
                  y1={line.start.y}
                  x2={line.end.x}
                  y2={line.end.y}
                  stroke="#E10600"
                  strokeWidth={isHighlight ? 3.5 : 2}
                  strokeOpacity={isHighlight ? 0.45 : 0.25}
                  strokeLinecap="round"
                />
                {/* Crisp red line */}
                <line
                  x1={line.start.x}
                  y1={line.start.y}
                  x2={line.end.x}
                  y2={line.end.y}
                  stroke={isHighlight ? '#FF2A2A' : '#E10600'}
                  strokeWidth={isHighlight ? 1.75 : 1.25}
                  strokeOpacity={isHighlight ? 1 : 0.85}
                  strokeLinecap="round"
                  filter={isHighlight ? 'url(#red-line-glow-active)' : 'url(#red-line-glow)'}
                />
                {/* Tiny junction circle at box anchor */}
                <circle
                  cx={line.start.x}
                  cy={line.start.y}
                  r={isHighlight ? 2.5 : 2}
                  fill={isHighlight ? '#FF4444' : '#E10600'}
                />
              </g>
            )
          })}
        </svg>

        {/* 1. FAIXA PRETA SUPERIOR (Bico, Lateral, Tampa do Motor, Asa Traseira) */}
        <div className="relative z-30 w-full px-5 pt-4 pb-3 bg-[#06080D]/95 border-b border-white/5">
          <div className="grid grid-cols-4 gap-3.5 lg:gap-5 items-stretch">
            {topSlotKeys.map((key) => renderInfoBox(key))}
          </div>
        </div>

        {/* 2. ÁREA CENTRAL DO CARRO (CARRO LIMPO + HOTSPOTS PRECISOS) */}
        <div
          ref={carAreaRef}
          className="relative w-full aspect-[21/9] max-h-[460px] flex items-center justify-center bg-black/60 overflow-hidden"
        >
          {/* Imagem lateral real da equipe (Audi F1 2026 limpa, proporção preservada) */}
          {sideViewImage ? (
            <img
              src={sideViewImage}
              alt={teamName || 'Monoposto F1 2026'}
              className="w-full h-full object-contain filter drop-shadow-[0_15px_35px_rgba(0,0,0,0.95)]"
              loading="eager"
            />
          ) : (
            <div className="text-center p-8 text-neutral-400 font-mono text-sm">
              Imagem lateral do carro não disponível
            </div>
          )}

          {/* 5 HOTSPOTS CALIBRADOS SOBRE O MONOPOSTO */}
          {OFFICIAL_SPONSOR_SLOTS.map((slotMeta) => {
            const coord: SponsorHotspotCoord = hotspotsConfig.slots[slotMeta.key]
            const contract = getContractForSlot(slotMeta.key)
            const isSelected = selectedSlot === slotMeta.key
            const isHovered = hoveredSlot === slotMeta.key
            const isOccupied = !!contract

            const style: React.CSSProperties = {
              position: 'absolute',
              left: `${coord.x}%`,
              top: `${coord.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: isSelected ? 40 : isHovered ? 35 : 25,
            }

            return (
              <div
                key={slotMeta.key}
                ref={(el) => {
                  hotspotRefs.current[slotMeta.key] = el
                }}
                style={style}
                className="cursor-pointer group select-none flex items-center justify-center p-2"
                onClick={() => onSelectSlot(slotMeta.key)}
                onMouseEnter={() => setHoveredSlot(slotMeta.key)}
                onMouseLeave={() => setHoveredSlot(null)}
                aria-label={`Hotspot ${coord.name}`}
              >
                {/* Ping pulsante quando selecionado */}
                {isSelected && (
                  <div
                    className={`absolute w-8 h-8 rounded-full animate-ping pointer-events-none ${
                      isOccupied ? 'bg-emerald-400/50' : 'bg-red-500/50'
                    }`}
                  />
                )}

                {/* Glow estático de fundo */}
                <div
                  className={`absolute w-6 h-6 rounded-full blur-sm transition-opacity duration-200 pointer-events-none ${
                    isOccupied ? 'bg-emerald-400' : 'bg-red-500'
                  } ${isSelected || isHovered ? 'opacity-80 scale-125' : 'opacity-40'}`}
                />

                {/* Círculo externo vermelho com anel branco e núcleo central */}
                <div
                  className={`relative rounded-full border-2 border-white transition-all duration-200 flex items-center justify-center shadow-lg ${
                    isSelected || isHovered
                      ? 'w-5 h-5 scale-125 ' +
                        (isOccupied
                          ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)]'
                          : 'bg-[#E10600] shadow-[0_0_12px_rgba(225,6,0,0.9)]')
                      : 'w-4 h-4 ' +
                        (isOccupied
                          ? 'bg-emerald-500/90 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                          : 'bg-[#E10600] shadow-[0_0_8px_rgba(225,6,0,0.7)]')
                  }`}
                >
                  {/* Núcleo central branco ou vermelho conforme ocupação */}
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              </div>
            )
          })}
        </div>

        {/* 3. FAIXA PRETA INFERIOR (Asa Dianteira) */}
        <div className="relative z-30 w-full px-5 py-3.5 bg-[#06080D]/95 border-t border-white/5 flex items-center justify-between">
          <div className="w-full max-w-[260px] lg:max-w-[280px]">
            {bottomSlotKeys.map((key) => renderInfoBox(key))}
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
              Espaço Ocupado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E10600] border border-white" />
              Espaço Disponível
            </span>
            {onExploreMarket && (
              <button
                onClick={() => selectedSlot && onExploreMarket(selectedSlot)}
                className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono transition-colors"
              >
                Abrir Mercado &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE (< md): CARRO EM LARGURA TOTAL + LISTA/CARDS ABAIXO */}
      {/* ========================================================= */}
      <div className="md:hidden space-y-4">
        {/* Carro com hotspots tocáveis */}
        <div className="relative w-full aspect-[16/8] flex items-center justify-center bg-black/60 rounded-xl overflow-hidden border border-white/10">
          {sideViewImage ? (
            <img
              src={sideViewImage}
              alt={teamName || 'Monoposto F1 2026'}
              className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]"
            />
          ) : (
            <div className="text-center p-4 text-neutral-400 font-mono text-xs">
              Imagem lateral indisponível
            </div>
          )}

          {/* 5 Hotspots visíveis sobre o carro no mobile */}
          {OFFICIAL_SPONSOR_SLOTS.map((slotMeta) => {
            const coord = hotspotsConfig.slots[slotMeta.key]
            const contract = getContractForSlot(slotMeta.key)
            const isSelected = selectedSlot === slotMeta.key
            const isOccupied = !!contract

            return (
              <div
                key={slotMeta.key}
                style={{
                  position: 'absolute',
                  left: `${coord.x}%`,
                  top: `${coord.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isSelected ? 30 : 20,
                }}
                onClick={() => onSelectSlot(slotMeta.key)}
                className="p-3 cursor-pointer"
              >
                {isSelected && (
                  <div
                    className={`absolute inset-0 rounded-full animate-ping ${
                      isOccupied ? 'bg-emerald-400/40' : 'bg-red-500/40'
                    }`}
                  />
                )}
                <div
                  className={`w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-lg ${
                    isSelected ? 'scale-125 ' : ''
                  }${isOccupied ? 'bg-emerald-500' : 'bg-[#E10600]'}`}
                >
                  <div className="w-1 h-1 bg-white rounded-full" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Lista de cards interativos dos 5 espaços no celular */}
        <div className="space-y-2">
          {OFFICIAL_SPONSOR_SLOTS.map((slotMeta) => {
            const slotKey = slotMeta.key
            const coord = hotspotsConfig.slots[slotKey]
            const contract = getContractForSlot(slotKey)
            const isSelected = selectedSlot === slotKey
            const isOccupied = !!contract

            return (
              <div
                key={slotKey}
                onClick={() => onSelectSlot(slotKey)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? isOccupied
                      ? 'bg-emerald-950/40 border-emerald-400 ring-1 ring-emerald-500/40'
                      : 'bg-red-950/40 border-red-500 ring-1 ring-red-500/40'
                    : 'bg-[#0B0E14] border-[#1F2733]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-3 h-3 rounded-full border border-white shrink-0 ${
                      isOccupied ? 'bg-emerald-500' : 'bg-[#E10600]'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{coord.name}</div>
                    <div className="text-[10px] text-neutral-400 truncate">
                      {isOccupied ? contract.sponsorName : 'Disponível para Captação'}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`text-xs font-mono font-bold ${
                      isOccupied ? 'text-emerald-400' : 'text-neutral-300'
                    }`}
                  >
                    {isOccupied
                      ? `${formatMoneyM(contract.fixedAnnualValue, true)}/ano`
                      : `${formatMoneyM(slotMeta.defaultMarketValueMin, false, 0)} – ${formatMoneyM(slotMeta.defaultMarketValueMax, false, 0)}`}
                  </div>
                  <span
                    className={`inline-block text-[8px] font-mono px-1 rounded font-black tracking-wider uppercase border ${
                      isOccupied
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                    }`}
                  >
                    {isOccupied ? 'OCUPADO' : 'VAGO'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
