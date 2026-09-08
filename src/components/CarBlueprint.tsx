import React, { useState } from 'react'
import { PartModel, SponsorModel } from '@/types/f1'
import blueprintImg from '@/assets/image-36773.png'
import { Eye, Layers, Compass, CheckCircle2, AlertTriangle } from 'lucide-react'

export type BlueprintView = 'side' | 'top' | 'front-rear' | 'schematic'

interface CarBlueprintProps {
  teamColor?: string
  teamName?: string
  sponsors?: SponsorModel[]
  carLevel?: number
  parts: PartModel[]
  selectedPartId: string | null
  onSelectPart: (partId: string) => void
  className?: string
}

export const CarBlueprint: React.FC<CarBlueprintProps> = ({
  teamColor = '#E10600',
  teamName = 'Escuderia F1',
  sponsors = [],
  carLevel = 75,
  parts = [],
  selectedPartId,
  onSelectPart,
  className = '',
}) => {
  const [activeView, setActiveView] = useState<BlueprintView>('schematic')
  const [hoveredPartKey, setHoveredPartKey] = useState<string | null>(null)

  // Map parts by normalized name
  const findPart = (keyword: string): PartModel | undefined => {
    const kw = keyword.toLowerCase()
    return parts.find((p) => p.name.toLowerCase().includes(kw))
  }

  const chassiPart = findPart('chassi')
  const frontWingPart = findPart('asa dianteira')
  const rearWingPart = findPart('asa traseira')
  const floorPart = findPart('assoalho')
  const suspensionPart = findPart('suspensão') || findPart('suspensao')
  const activeAeroPart = findPart('aerodinâmica') || findPart('aerodinamica')

  // Helper condition badge color
  const getConditionColor = (cond: number = 100) => {
    if (cond >= 80) return '#10B981' // emerald
    if (cond >= 50) return '#F59E0B' // amber
    return '#EF4444' // red
  }

  // Active sponsors
  const activeSponsors = sponsors.filter((s) => s.status === 'ativo').map((s) => s.name)
  const mainSponsor = activeSponsors[0] || 'PETROBRAS'
  const sideSponsor = activeSponsors[1] || 'BANCO DO BRASIL'
  const wingSponsor = activeSponsors[2] || 'EMBRAER'

  // Hotspot helper to know if part is selected or hovered
  const isSelected = (part?: PartModel) => part && selectedPartId === part.id
  const isHovered = (partKey: string) => hoveredPartKey === partKey

  return (
    <div
      className={`relative w-full rounded-2xl bg-[#08101E] border border-[#1E293B] shadow-2xl overflow-hidden font-mono select-none ${className}`}
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(0, 166, 251, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0, 166, 251, 0.05) 1px, transparent 1px),
          radial-gradient(circle at 50% 30%, rgba(13, 25, 45, 0.7) 0%, rgba(8, 16, 30, 0.95) 100%)
        `,
        backgroundSize: '24px 24px, 24px 24px, 100% 100%',
      }}
    >
      {/* Blueprint Header / Technical Title Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 sm:p-5 border-b border-[#1E293B] bg-[#0A1324]/80 backdrop-blur gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span
              className="w-4 h-4 rounded-full inline-block ring-2 ring-cyan-400/50 shadow-[0_0_12px_rgba(0,166,251,0.5)]"
              style={{ backgroundColor: teamColor }}
            />
            <span className="absolute -inset-1 rounded-full border border-cyan-400/30 animate-ping opacity-40 pointer-events-none" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">
                DOC. TÉCNICO FIA // SPEC-2026
              </span>
              <span className="text-[10px] text-slate-500">REV. 04</span>
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-[#F8FAFC] tracking-wider uppercase">
              {teamName} • BLUEPRINT MONOPOSTO (768 KG)
            </h2>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0D192D] p-1 rounded-lg border border-[#1E293B]">
          <button
            type="button"
            onClick={() => setActiveView('schematic')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
              activeView === 'schematic'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,166,251,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Vista Interativa</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('side')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
              activeView === 'side'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,166,251,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Vista Lateral</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('top')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
              activeView === 'top'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,166,251,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Vista Superior</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('front-rear')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
              activeView === 'front-rear'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,166,251,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Frontal / Traseira</span>
          </button>
        </div>
      </div>

      {/* Technical Blueprint Info Bar & Scale Callouts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-2 border-b border-[#1E293B]/70 bg-[#070D18]/90 text-[11px] text-slate-400">
        <div>
          <span className="text-slate-500 block text-[9px] uppercase tracking-wider">
            Comprimento / Entre-eixos
          </span>
          <span className="text-cyan-300 font-bold">5.000 mm / 3.400 mm</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[9px] uppercase tracking-wider">
            Trem de Força
          </span>
          <span className="text-cyan-300 font-bold">V6 1.6T + MGU-K 350kW</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[9px] uppercase tracking-wider">
            Aero Regulamento
          </span>
          <span className="text-cyan-300 font-bold">Z-Mode / X-Mode (Ativa)</span>
        </div>
        <div className="text-right">
          <span className="text-slate-500 block text-[9px] uppercase tracking-wider">
            Índice Geral do Carro
          </span>
          <span className="text-cyan-400 font-bold text-xs">{carLevel}/100</span>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative p-4 sm:p-6 overflow-hidden">
        {/* Decorative blueprint measurement dimension lines / watermark */}
        <div className="pointer-events-none absolute top-3 left-4 text-[10px] text-cyan-500/30 font-mono tracking-widest">
          + CAD-SYS F1 // DWG-REF #36773-2026 // ESCALA 1:20
        </div>
        <div className="pointer-events-none absolute bottom-3 right-4 text-[10px] text-cyan-500/30 font-mono tracking-widest">
          FIA HOMOLOGATED • SPEC A
        </div>

        {/* 1. SCHEMATIC INTERACTIVE VIEW (Side + Quick Top Highlight) */}
        {activeView === 'schematic' && (
          <div className="space-y-4">
            {/* SVG Interactive Drawing */}
            <div className="relative w-full flex items-center justify-center py-2">
              <svg
                viewBox="0 0 960 340"
                className="w-full h-auto max-h-[360px] drop-shadow-[0_10px_30px_rgba(0,166,251,0.15)] select-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  {/* Technical Glow Filter */}
                  <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>

                  {/* Blueprint Carbon Grid */}
                  <pattern id="bpGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <line
                      x1="0"
                      y1="0"
                      x2="20"
                      y2="0"
                      stroke="rgba(0,166,251,0.08)"
                      strokeWidth="0.5"
                    />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="20"
                      stroke="rgba(0,166,251,0.08)"
                      strokeWidth="0.5"
                    />
                  </pattern>

                  {/* Gradients */}
                  <linearGradient id="chassisGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0F172A" />
                    <stop offset="35%" stopColor={teamColor} stopOpacity="0.85" />
                    <stop offset="75%" stopColor={teamColor} stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#0B132B" />
                  </linearGradient>
                </defs>

                {/* Grid Overlay inside SVG */}
                <rect x="20" y="20" width="920" height="300" fill="url(#bpGrid)" rx="8" />

                {/* Dimension Extension Lines (Cotas decorativas) */}
                {/* Horizontal Baseline */}
                <line
                  x1="40"
                  y1="305"
                  x2="920"
                  y2="305"
                  stroke="#00A6FB"
                  strokeWidth="0.75"
                  strokeDasharray="3 3"
                  opacity="0.6"
                />
                <line
                  x1="40"
                  y1="298"
                  x2="40"
                  y2="312"
                  stroke="#00A6FB"
                  strokeWidth="1"
                  opacity="0.7"
                />
                <line
                  x1="920"
                  y1="298"
                  x2="920"
                  y2="312"
                  stroke="#00A6FB"
                  strokeWidth="1"
                  opacity="0.7"
                />
                <text
                  x="480"
                  y="322"
                  fill="#00A6FB"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                  opacity="0.8"
                >
                  ◄—— COMPRIMENTO TOTAL MÁXIMO 5.000 mm ——►
                </text>

                {/* Entre-eixos Front-to-Rear Axle */}
                <line
                  x1="210"
                  y1="275"
                  x2="760"
                  y2="275"
                  stroke="#38BDF8"
                  strokeWidth="0.75"
                  strokeDasharray="2 2"
                  opacity="0.5"
                />
                <circle cx="210" cy="275" r="2.5" fill="#38BDF8" />
                <circle cx="760" cy="275" r="2.5" fill="#38BDF8" />
                <text
                  x="485"
                  y="271"
                  fill="#38BDF8"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                  opacity="0.75"
                >
                  ENTRE-EIXOS 3.400 mm
                </text>

                {/* Ground Shadow */}
                <ellipse cx="480" cy="265" rx="430" ry="10" fill="#000000" opacity="0.8" />

                {/* ======================================================== */}
                {/* HOTSPOT 1: ASSOALHO / DIFUSOR                            */}
                {/* ======================================================== */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => floorPart && onSelectPart(floorPart.id)}
                  onMouseEnter={() => setHoveredPartKey('assoalho')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <path
                    d="M 180 236 L 790 236 L 830 216 L 850 238 L 170 238 Z"
                    fill={isSelected(floorPart) ? 'rgba(0, 166, 251, 0.35)' : '#0F172A'}
                    stroke={
                      isSelected(floorPart)
                        ? '#00A6FB'
                        : isHovered('assoalho')
                          ? '#38BDF8'
                          : '#334155'
                    }
                    strokeWidth={isSelected(floorPart) || isHovered('assoalho') ? 2.5 : 1.2}
                    filter={isSelected(floorPart) ? 'url(#cyanGlow)' : undefined}
                  />
                  {/* Floor strakes / venturi channels */}
                  <line
                    x1="320"
                    y1="236"
                    x2="335"
                    y2="226"
                    stroke="#00A6FB"
                    strokeWidth="1"
                    opacity="0.6"
                  />
                  <line
                    x1="450"
                    y1="236"
                    x2="465"
                    y2="226"
                    stroke="#00A6FB"
                    strokeWidth="1"
                    opacity="0.6"
                  />
                  <line
                    x1="600"
                    y1="236"
                    x2="615"
                    y2="226"
                    stroke="#00A6FB"
                    strokeWidth="1"
                    opacity="0.6"
                  />
                  <line
                    x1="770"
                    y1="236"
                    x2="800"
                    y2="220"
                    stroke="#00A6FB"
                    strokeWidth="1"
                    opacity="0.7"
                  />
                </g>

                {/* ======================================================== */}
                {/* HOTSPOT 2: ASA TRASEIRA & ACTUATORS                     */}
                {/* ======================================================== */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => rearWingPart && onSelectPart(rearWingPart.id)}
                  onMouseEnter={() => setHoveredPartKey('asa traseira')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  {/* Endplate */}
                  <rect
                    x="795"
                    y="65"
                    width="18"
                    height="140"
                    rx="3"
                    fill={isSelected(rearWingPart) ? 'rgba(0, 166, 251, 0.4)' : '#1E293B'}
                    stroke={
                      isSelected(rearWingPart)
                        ? '#00A6FB'
                        : isHovered('asa traseira')
                          ? '#38BDF8'
                          : '#475569'
                    }
                    strokeWidth={isSelected(rearWingPart) || isHovered('asa traseira') ? 2.5 : 1.5}
                    filter={isSelected(rearWingPart) ? 'url(#cyanGlow)' : undefined}
                  />
                  {/* Main wing plane */}
                  <path
                    d="M 765 80 L 860 80 L 855 116 L 770 106 Z"
                    fill={teamColor}
                    stroke={isSelected(rearWingPart) ? '#00A6FB' : '#0B0F19'}
                    strokeWidth="1.5"
                  />
                  {/* Upper flap */}
                  <path
                    d="M 760 67 L 860 67 L 855 77 L 765 77 Z"
                    fill="#334155"
                    stroke="#00A6FB"
                    strokeWidth="0.8"
                  />
                  {/* Sponsor text on wing */}
                  <text
                    x="810"
                    y="98"
                    fill="#FFFFFF"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                    letterSpacing="1"
                    textAnchor="middle"
                  >
                    {wingSponsor.slice(0, 9).toUpperCase()}
                  </text>
                </g>

                {/* ======================================================== */}
                {/* HOTSPOT 3: CHASSI / MONOCOQUE & SIDEPODS                */}
                {/* ======================================================== */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => chassiPart && onSelectPart(chassiPart.id)}
                  onMouseEnter={() => setHoveredPartKey('chassi')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <path
                    d="M 120 200
                       C 160 190, 230 180, 300 170
                       C 340 165, 370 140, 410 130
                       C 440 123, 480 115, 520 115
                       C 560 115, 610 120, 660 140
                       C 700 155, 750 180, 790 190
                       L 790 230
                       L 260 230
                       C 210 230, 160 215, 120 200 Z"
                    fill="url(#chassisGrad)"
                    stroke={
                      isSelected(chassiPart)
                        ? '#00A6FB'
                        : isHovered('chassi')
                          ? '#38BDF8'
                          : 'rgba(255,255,255,0.4)'
                    }
                    strokeWidth={isSelected(chassiPart) || isHovered('chassi') ? 2.5 : 1.5}
                    filter={isSelected(chassiPart) ? 'url(#cyanGlow)' : undefined}
                  />

                  {/* Sidepod intake cutout */}
                  <path
                    d="M 330 180 L 360 160 L 375 160 L 355 205 L 330 205 Z"
                    fill="#050B14"
                    stroke="#38BDF8"
                    strokeWidth="1"
                  />

                  {/* Main Sponsor on Sidepod */}
                  <g transform="translate(420, 176)">
                    <rect
                      x="-10"
                      y="-12"
                      width="160"
                      height="24"
                      rx="4"
                      fill="#000000"
                      opacity="0.45"
                    />
                    <text
                      x="70"
                      y="5"
                      fill="#FFFFFF"
                      fontSize="13"
                      fontWeight="900"
                      fontFamily="monospace"
                      letterSpacing="2"
                      textAnchor="middle"
                    >
                      {mainSponsor.slice(0, 13).toUpperCase()}
                    </text>
                  </g>
                </g>

                {/* Cockpit, Halo & Driver */}
                <path
                  d="M 370 157 C 385 137, 420 127, 470 127 L 470 147 C 430 147, 400 153, 370 163 Z"
                  fill="#0A0F1D"
                />
                <path
                  d="M 390 160 Q 430 125 480 130 Q 460 140 420 155 Z"
                  fill="#1E293B"
                  stroke="#64748B"
                  strokeWidth="1.5"
                />
                {/* Driver Helmet */}
                <circle
                  cx="445"
                  cy="138"
                  r="12"
                  fill="#F59E0B"
                  stroke="#000000"
                  strokeWidth="1.5"
                />
                <path d="M 436 137 L 454 137 L 452 142 L 438 142 Z" fill="#0F172A" />

                {/* ======================================================== */}
                {/* HOTSPOT 4: AERODINÂMICA ATIVA (Shark Fin + Active Airbox)*/}
                {/* ======================================================== */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => activeAeroPart && onSelectPart(activeAeroPart.id)}
                  onMouseEnter={() => setHoveredPartKey('aerodinâmica ativa')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <path
                    d="M 470 119 L 490 80 L 540 80 L 690 140 L 520 119 Z"
                    fill={isSelected(activeAeroPart) ? 'rgba(0, 166, 251, 0.4)' : '#1E293B'}
                    stroke={
                      isSelected(activeAeroPart)
                        ? '#00A6FB'
                        : isHovered('aerodinâmica ativa')
                          ? '#38BDF8'
                          : '#475569'
                    }
                    strokeWidth={
                      isSelected(activeAeroPart) || isHovered('aerodinâmica ativa') ? 2.5 : 1.5
                    }
                    filter={isSelected(activeAeroPart) ? 'url(#cyanGlow)' : undefined}
                  />
                  {/* Air intake */}
                  <ellipse
                    cx="495"
                    cy="94"
                    rx="9"
                    ry="13"
                    fill="#050B14"
                    stroke="#00A6FB"
                    strokeWidth="1.2"
                  />
                  {/* Aero active wing tag */}
                  <text
                    x="590"
                    y="108"
                    fill="#38BDF8"
                    fontSize="8"
                    fontWeight="bold"
                    fontFamily="monospace"
                    letterSpacing="1"
                  >
                    X/Z-MODE AERO
                  </text>
                  {/* Side Sponsor 2 on Engine cover */}
                  <text
                    x="600"
                    y="126"
                    fill="#E2E8F0"
                    fontSize="9"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {sideSponsor.slice(0, 11).toUpperCase()}
                  </text>
                </g>

                {/* ======================================================== */}
                {/* HOTSPOT 5: ASA DIANTEIRA (BICO & ENDPLATES)              */}
                {/* ======================================================== */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => frontWingPart && onSelectPart(frontWingPart.id)}
                  onMouseEnter={() => setHoveredPartKey('asa dianteira')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  {/* Nosecone extension */}
                  <path
                    d="M 70 212 L 160 200 L 310 174 L 310 190 L 160 217 L 70 220 Z"
                    fill={teamColor}
                    stroke={
                      isSelected(frontWingPart)
                        ? '#00A6FB'
                        : isHovered('asa dianteira')
                          ? '#38BDF8'
                          : 'rgba(255,255,255,0.4)'
                    }
                    strokeWidth={isSelected(frontWingPart) || isHovered('asa dianteira') ? 2 : 1}
                  />
                  {/* Wing endplate */}
                  <rect
                    x="48"
                    y="206"
                    width="12"
                    height="40"
                    rx="2"
                    fill={isSelected(frontWingPart) ? 'rgba(0, 166, 251, 0.4)' : '#1E293B'}
                    stroke={
                      isSelected(frontWingPart)
                        ? '#00A6FB'
                        : isHovered('asa dianteira')
                          ? '#38BDF8'
                          : '#475569'
                    }
                    strokeWidth={
                      isSelected(frontWingPart) || isHovered('asa dianteira') ? 2.5 : 1.5
                    }
                    filter={isSelected(frontWingPart) ? 'url(#cyanGlow)' : undefined}
                  />
                  {/* Flaps */}
                  <path d="M 50 231 L 140 228 L 140 240 L 50 242 Z" fill={teamColor} />
                  <path
                    d="M 50 221 L 125 220 L 125 227 L 50 229 Z"
                    fill="#334155"
                    stroke="#38BDF8"
                    strokeWidth="0.8"
                  />
                  <circle cx="54" cy="215" r="3" fill="#E10600" />
                </g>

                {/* ======================================================== */}
                {/* HOTSPOT 6: SUSPENSÃO & RODAS 18"                         */}
                {/* ======================================================== */}
                <g
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => suspensionPart && onSelectPart(suspensionPart.id)}
                  onMouseEnter={() => setHoveredPartKey('suspensão')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  {/* Front wishbones */}
                  <line
                    x1="210"
                    y1="211"
                    x2="290"
                    y2="181"
                    stroke={
                      isSelected(suspensionPart)
                        ? '#00A6FB'
                        : isHovered('suspensão')
                          ? '#38BDF8'
                          : '#64748B'
                    }
                    strokeWidth={isSelected(suspensionPart) || isHovered('suspensão') ? 4 : 2.5}
                  />
                  <line
                    x1="210"
                    y1="226"
                    x2="280"
                    y2="214"
                    stroke={
                      isSelected(suspensionPart)
                        ? '#00A6FB'
                        : isHovered('suspensão')
                          ? '#38BDF8'
                          : '#475569'
                    }
                    strokeWidth={isSelected(suspensionPart) || isHovered('suspensão') ? 4 : 2.5}
                  />

                  {/* Rear wishbones */}
                  <line
                    x1="760"
                    y1="211"
                    x2="690"
                    y2="181"
                    stroke={
                      isSelected(suspensionPart)
                        ? '#00A6FB'
                        : isHovered('suspensão')
                          ? '#38BDF8'
                          : '#64748B'
                    }
                    strokeWidth={isSelected(suspensionPart) || isHovered('suspensão') ? 4 : 2.5}
                  />
                  <line
                    x1="760"
                    y1="226"
                    x2="700"
                    y2="214"
                    stroke={
                      isSelected(suspensionPart)
                        ? '#00A6FB'
                        : isHovered('suspensão')
                          ? '#38BDF8'
                          : '#475569'
                    }
                    strokeWidth={isSelected(suspensionPart) || isHovered('suspensão') ? 4 : 2.5}
                  />

                  {/* Front Wheel */}
                  <circle
                    cx="210"
                    cy="222"
                    r="46"
                    fill="#0A0E17"
                    stroke="#334155"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="210"
                    cy="222"
                    r="28"
                    fill="#1E293B"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="210"
                    cy="222"
                    r="41"
                    fill="none"
                    stroke={isSelected(suspensionPart) ? '#00A6FB' : '#F59E0B'}
                    strokeWidth={isSelected(suspensionPart) ? 3.5 : 2}
                  />
                  <circle cx="210" cy="222" r="8" fill="#E10600" />
                  <circle cx="210" cy="222" r="3" fill="#FFFFFF" />

                  {/* Rear Wheel */}
                  <circle
                    cx="760"
                    cy="222"
                    r="48"
                    fill="#0A0E17"
                    stroke="#334155"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="760"
                    cy="222"
                    r="30"
                    fill="#1E293B"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="760"
                    cy="222"
                    r="43"
                    fill="none"
                    stroke={isSelected(suspensionPart) ? '#00A6FB' : '#F59E0B'}
                    strokeWidth={isSelected(suspensionPart) ? 3.5 : 2}
                  />
                  <circle cx="760" cy="222" r="8" fill="#E10600" />
                  <circle cx="760" cy="222" r="3" fill="#FFFFFF" />
                </g>

                {/* Hotspot Target Markers (Pulsing tech circles with pointers) */}
                {/* 1. Asa Dianteira */}
                <g
                  className="cursor-pointer"
                  onClick={() => frontWingPart && onSelectPart(frontWingPart.id)}
                  onMouseEnter={() => setHoveredPartKey('asa dianteira')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <circle
                    cx="95"
                    cy="180"
                    r="14"
                    fill="#08101E"
                    stroke="#00A6FB"
                    strokeWidth="1.5"
                    opacity="0.9"
                  />
                  <circle
                    cx="95"
                    cy="180"
                    r="4"
                    fill={getConditionColor(frontWingPart?.condition)}
                  />
                  <line
                    x1="95"
                    y1="194"
                    x2="95"
                    y2="216"
                    stroke="#00A6FB"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="95"
                    y="158"
                    fill="#E2E8F0"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ASA DIANTEIRA
                  </text>
                  <text
                    x="95"
                    y="169"
                    fill={getConditionColor(frontWingPart?.condition)}
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    Nív.{frontWingPart?.level ?? 5} • {frontWingPart?.condition ?? 100}%
                  </text>
                </g>

                {/* 2. Suspensão Dianteira */}
                <g
                  className="cursor-pointer"
                  onClick={() => suspensionPart && onSelectPart(suspensionPart.id)}
                  onMouseEnter={() => setHoveredPartKey('suspensão')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <circle
                    cx="250"
                    cy="155"
                    r="14"
                    fill="#08101E"
                    stroke="#00A6FB"
                    strokeWidth="1.5"
                    opacity="0.9"
                  />
                  <circle
                    cx="250"
                    cy="155"
                    r="4"
                    fill={getConditionColor(suspensionPart?.condition)}
                  />
                  <line
                    x1="250"
                    y1="169"
                    x2="235"
                    y2="200"
                    stroke="#00A6FB"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="250"
                    y="133"
                    fill="#E2E8F0"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    SUSPENSÃO
                  </text>
                  <text
                    x="250"
                    y="144"
                    fill={getConditionColor(suspensionPart?.condition)}
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    Nív.{suspensionPart?.level ?? 5} • {suspensionPart?.condition ?? 100}%
                  </text>
                </g>

                {/* 3. Chassi / Monocoque */}
                <g
                  className="cursor-pointer"
                  onClick={() => chassiPart && onSelectPart(chassiPart.id)}
                  onMouseEnter={() => setHoveredPartKey('chassi')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <circle
                    cx="430"
                    cy="85"
                    r="14"
                    fill="#08101E"
                    stroke="#00A6FB"
                    strokeWidth="1.5"
                    opacity="0.9"
                  />
                  <circle cx="430" cy="85" r="4" fill={getConditionColor(chassiPart?.condition)} />
                  <line
                    x1="430"
                    y1="99"
                    x2="430"
                    y2="128"
                    stroke="#00A6FB"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="430"
                    y="63"
                    fill="#E2E8F0"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    CHASSI / MONOCOQUE
                  </text>
                  <text
                    x="430"
                    y="74"
                    fill={getConditionColor(chassiPart?.condition)}
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    Nív.{chassiPart?.level ?? 5} • {chassiPart?.condition ?? 100}%
                  </text>
                </g>

                {/* 4. Aerodinâmica Ativa */}
                <g
                  className="cursor-pointer"
                  onClick={() => activeAeroPart && onSelectPart(activeAeroPart.id)}
                  onMouseEnter={() => setHoveredPartKey('aerodinâmica ativa')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <circle
                    cx="610"
                    cy="55"
                    r="14"
                    fill="#08101E"
                    stroke="#00A6FB"
                    strokeWidth="1.5"
                    opacity="0.9"
                  />
                  <circle
                    cx="610"
                    cy="55"
                    r="4"
                    fill={getConditionColor(activeAeroPart?.condition)}
                  />
                  <line
                    x1="610"
                    y1="69"
                    x2="570"
                    y2="95"
                    stroke="#00A6FB"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="610"
                    y="33"
                    fill="#E2E8F0"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    AERO ATIVA
                  </text>
                  <text
                    x="610"
                    y="44"
                    fill={getConditionColor(activeAeroPart?.condition)}
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    Nív.{activeAeroPart?.level ?? 5} • {activeAeroPart?.condition ?? 100}%
                  </text>
                </g>

                {/* 5. Asa Traseira */}
                <g
                  className="cursor-pointer"
                  onClick={() => rearWingPart && onSelectPart(rearWingPart.id)}
                  onMouseEnter={() => setHoveredPartKey('asa traseira')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <circle
                    cx="830"
                    cy="40"
                    r="14"
                    fill="#08101E"
                    stroke="#00A6FB"
                    strokeWidth="1.5"
                    opacity="0.9"
                  />
                  <circle
                    cx="830"
                    cy="40"
                    r="4"
                    fill={getConditionColor(rearWingPart?.condition)}
                  />
                  <line
                    x1="830"
                    y1="54"
                    x2="815"
                    y2="70"
                    stroke="#00A6FB"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="830"
                    y="18"
                    fill="#E2E8F0"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ASA TRASEIRA
                  </text>
                  <text
                    x="830"
                    y="29"
                    fill={getConditionColor(rearWingPart?.condition)}
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    Nív.{rearWingPart?.level ?? 5} • {rearWingPart?.condition ?? 100}%
                  </text>
                </g>

                {/* 6. Assoalho (Difusor inferior) */}
                <g
                  className="cursor-pointer"
                  onClick={() => floorPart && onSelectPart(floorPart.id)}
                  onMouseEnter={() => setHoveredPartKey('assoalho')}
                  onMouseLeave={() => setHoveredPartKey(null)}
                >
                  <circle
                    cx="500"
                    cy="275"
                    r="14"
                    fill="#08101E"
                    stroke="#00A6FB"
                    strokeWidth="1.5"
                    opacity="0.9"
                  />
                  <circle cx="500" cy="275" r="4" fill={getConditionColor(floorPart?.condition)} />
                  <line
                    x1="500"
                    y1="261"
                    x2="500"
                    y2="240"
                    stroke="#00A6FB"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="500"
                    y="299"
                    fill="#E2E8F0"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ASSOALHO & DIFUSOR
                  </text>
                  <text
                    x="500"
                    y="310"
                    fill={getConditionColor(floorPart?.condition)}
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    Nív.{floorPart?.level ?? 5} • {floorPart?.condition ?? 100}%
                  </text>
                </g>
              </svg>
            </div>
          </div>
        )}

        {/* 2. SIDE VIEW DEDICATED (From original blueprint visual reference) */}
        {activeView === 'side' && (
          <div className="relative rounded-xl border border-cyan-500/20 bg-[#060C16] p-4 flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-xs text-cyan-400/80 mb-2">
              <span>PROJEÇÃO LATERAL // ELEVAÇÃO Z-AXIS</span>
              <span>FIA SPEC DIM: L=5000mm H=950mm</span>
            </div>
            {/* Cropped to the middle view of the blueprint image */}
            <div className="relative w-full overflow-hidden rounded-lg border border-[#1E293B] max-h-[300px] flex items-center justify-center bg-[#070e1c]">
              <img
                src={blueprintImg}
                alt="Vista Lateral Blueprint F1 2026"
                className="w-full object-cover max-h-[460px] opacity-90 filter contrast-125 brightness-110 -my-[32%]"
              />
              {/* Overlay clickable hotspots over the blueprint photo */}
              <button
                type="button"
                onClick={() => frontWingPart && onSelectPart(frontWingPart.id)}
                className="absolute left-[5%] bottom-[20%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Asa Dianteira ({frontWingPart?.condition ?? 100}%)
              </button>
              <button
                type="button"
                onClick={() => suspensionPart && onSelectPart(suspensionPart.id)}
                className="absolute left-[20%] bottom-[35%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Suspensão ({suspensionPart?.condition ?? 100}%)
              </button>
              <button
                type="button"
                onClick={() => chassiPart && onSelectPart(chassiPart.id)}
                className="absolute left-[45%] top-[35%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Chassi ({chassiPart?.condition ?? 100}%)
              </button>
              <button
                type="button"
                onClick={() => activeAeroPart && onSelectPart(activeAeroPart.id)}
                className="absolute left-[52%] top-[12%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Aero Ativa ({activeAeroPart?.condition ?? 100}%)
              </button>
              <button
                type="button"
                onClick={() => rearWingPart && onSelectPart(rearWingPart.id)}
                className="absolute right-[8%] top-[20%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Asa Traseira ({rearWingPart?.condition ?? 100}%)
              </button>
              <button
                type="button"
                onClick={() => floorPart && onSelectPart(floorPart.id)}
                className="absolute left-[42%] bottom-[12%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Assoalho ({floorPart?.condition ?? 100}%)
              </button>
            </div>
          </div>
        )}

        {/* 3. TOP VIEW DEDICATED */}
        {activeView === 'top' && (
          <div className="relative rounded-xl border border-cyan-500/20 bg-[#060C16] p-4 flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-xs text-cyan-400/80 mb-2">
              <span>PROJEÇÃO SUPERIOR // PLANTA BAIXA AERODINÂMICA</span>
              <span>LARGURA TOTAL MÁXIMA: 2.000 mm</span>
            </div>
            {/* Cropped to the top section of the blueprint reference */}
            <div className="relative w-full overflow-hidden rounded-lg border border-[#1E293B] max-h-[300px] flex items-center justify-center bg-[#070e1c]">
              <img
                src={blueprintImg}
                alt="Vista Superior Blueprint F1 2026"
                className="w-full object-cover max-h-[460px] opacity-90 filter contrast-125 brightness-110 -mt-2 -mb-[64%]"
              />
              <button
                type="button"
                onClick={() => frontWingPart && onSelectPart(frontWingPart.id)}
                className="absolute right-[8%] top-[45%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Asa Dianteira ({frontWingPart?.condition ?? 100}%)
              </button>
              <button
                type="button"
                onClick={() => chassiPart && onSelectPart(chassiPart.id)}
                className="absolute left-[45%] top-[45%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Cockpit & Sidepods ({chassiPart?.condition ?? 100}%)
              </button>
              <button
                type="button"
                onClick={() => rearWingPart && onSelectPart(rearWingPart.id)}
                className="absolute left-[10%] top-[45%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Asa Traseira ({rearWingPart?.condition ?? 100}%)
              </button>
            </div>
          </div>
        )}

        {/* 4. FRONT & REAR VIEW */}
        {activeView === 'front-rear' && (
          <div className="relative rounded-xl border border-cyan-500/20 bg-[#060C16] p-4 flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-xs text-cyan-400/80 mb-2">
              <span>PROJEÇÃO FRONTAL & TRASEIRA // DIFUSOR & CONDUTOS DE FREIO</span>
              <span>REGULAMENTO ATIVO F1 2026</span>
            </div>
            {/* Cropped to the bottom section of the blueprint reference */}
            <div className="relative w-full overflow-hidden rounded-lg border border-[#1E293B] max-h-[300px] flex items-center justify-center bg-[#070e1c]">
              <img
                src={blueprintImg}
                alt="Vista Frontal e Traseira Blueprint F1 2026"
                className="w-full object-cover max-h-[460px] opacity-90 filter contrast-125 brightness-110 -mt-[64%] mb-0"
              />
              <button
                type="button"
                onClick={() => frontWingPart && onSelectPart(frontWingPart.id)}
                className="absolute left-[20%] bottom-[12%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Asa Dianteira & Bico ({frontWingPart?.condition ?? 100}%)
              </button>
              <button
                type="button"
                onClick={() => floorPart && onSelectPart(floorPart.id)}
                className="absolute right-[22%] bottom-[12%] px-2 py-1 rounded bg-[#08101E]/90 border border-cyan-400 text-[10px] text-cyan-300 hover:scale-105 transition-all shadow-lg"
              >
                Difusor Traseiro ({floorPart?.condition ?? 100}%)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Part Hotspot Pills Selector underneath */}
      <div className="px-4 py-3 border-t border-[#1E293B] bg-[#070D18]/90 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">Peças Técnicas:</span>
          <span className="text-cyan-400 text-[10px]">(clique para inspecionar e revisar)</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {parts.map((part) => {
            const isSel = selectedPartId === part.id
            const cond = part.condition ?? 100
            const condColor = getConditionColor(cond)
            return (
              <button
                key={part.id}
                type="button"
                onClick={() => onSelectPart(part.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${
                  isSel
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_8px_rgba(0,166,251,0.3)]'
                    : 'bg-[#0E1626] border-[#1E293B] text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: condColor }} />
                <span>{part.name}</span>
                <span className="text-[10px] text-slate-400 font-normal">Nív.{part.level}</span>
                <span
                  className="text-[10px] font-mono px-1 rounded"
                  style={{
                    color: condColor,
                    backgroundColor: `${condColor}15`,
                  }}
                >
                  {cond}%
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
