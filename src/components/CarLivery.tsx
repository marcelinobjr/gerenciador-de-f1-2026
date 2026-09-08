import React from 'react'
import { SponsorModel } from '@/types/f1'

interface CarLiveryProps {
  teamColor?: string
  teamName?: string
  sponsors?: SponsorModel[]
  carLevel?: number
  className?: string
}

export const CarLivery: React.FC<CarLiveryProps> = ({
  teamColor = '#E10600',
  teamName = 'Escuderia F1',
  sponsors = [],
  carLevel = 75,
  className = '',
}) => {
  // Extract active sponsors
  const activeSponsors = sponsors.filter((s) => s.status === 'ativo').map((s) => s.name)
  const mainSponsor = activeSponsors[0] || 'PETROBRAS'
  const sideSponsor1 = activeSponsors[1] || 'BANCO DO BRASIL'
  const sideSponsor2 = activeSponsors[2] || 'VALE'
  const wingSponsor = activeSponsors[3] || 'EMBRAER'

  // Slightly darker shade for sidepod undercut / floor
  const darkAccent = '#0B0E14'
  const carbonDark = '#151A24'

  return (
    <div
      className={`relative w-full rounded-2xl bg-[#0B0E14] border border-[#1F2733] p-4 sm:p-6 overflow-hidden ${className}`}
    >
      {/* Decorative background grid */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      {/* Header with Team details */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-2 border-b border-[#1F2733]/60 gap-2">
        <div className="flex items-center gap-3">
          <span
            className="w-4 h-4 rounded-full ring-2 ring-white/20 shadow-md"
            style={{ backgroundColor: teamColor }}
          />
          <span className="font-extrabold text-sm sm:text-base text-[#F5F7FA] tracking-wide uppercase font-mono">
            {teamName} • Monoposto 2026 (768 kg)
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#8B95A7]">
          <span>
            Aero Ativa: <strong className="text-emerald-400">Z/X-Mode</strong>
          </span>
          <span>•</span>
          <span>
            Rating: <strong className="text-[#00A6FB]">{carLevel}/100</strong>
          </span>
        </div>
      </div>

      {/* SVG Car Side Profile */}
      <div className="relative w-full flex items-center justify-center py-2 sm:py-4">
        <svg
          viewBox="0 0 960 300"
          className="w-full h-auto max-h-[260px] drop-shadow-2xl select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Primary Livery Gradient */}
            <linearGradient id="liveryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#11161F" />
              <stop offset="25%" stopColor={teamColor} />
              <stop offset="75%" stopColor={teamColor} />
              <stop offset="100%" stopColor="#0B0E14" />
            </linearGradient>

            {/* Nose Gradient */}
            <linearGradient id="noseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={teamColor} />
              <stop offset="70%" stopColor={teamColor} />
              <stop offset="100%" stopColor="#222A38" />
            </linearGradient>

            {/* Wheel metallic rim gradient */}
            <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#555E6F" />
              <stop offset="70%" stopColor="#1E2738" />
              <stop offset="100%" stopColor="#0B0E14" />
            </radialGradient>

            {/* Wheel Tire rubber gradient */}
            <radialGradient id="tireGrad" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#15171C" />
              <stop offset="90%" stopColor="#0C0D10" />
              <stop offset="100%" stopColor="#252A34" />
            </radialGradient>
          </defs>

          {/* Ground shadow */}
          <ellipse
            cx="480"
            cy="275"
            rx="420"
            ry="14"
            fill="#000000"
            opacity="0.6"
            filter="blur(6px)"
          />

          {/* Underfloor / Diffuser / Plank (Carbon Fiber) */}
          <path
            d="M 190 240 L 780 240 L 820 220 L 840 242 L 180 242 Z"
            fill={carbonDark}
            stroke="#2A3445"
            strokeWidth="1.5"
          />

          {/* Rear Wing Endplate & Wing Profile (Active Aero 2026) */}
          <g id="rear-wing">
            <rect
              x="800"
              y="70"
              width="16"
              height="135"
              rx="3"
              fill="#1C2330"
              stroke="#374151"
              strokeWidth="1.5"
            />
            <path d="M 770 85 L 855 85 L 850 120 L 775 110 Z" fill={teamColor} />
            <path d="M 765 72 L 855 72 L 850 82 L 770 82 Z" fill="#2D3748" />
            {/* Wing sponsor */}
            <text
              x="812"
              y="102"
              fill="#FFFFFF"
              fontSize="9"
              fontWeight="900"
              fontFamily="monospace"
              letterSpacing="1"
              textAnchor="middle"
            >
              {wingSponsor.slice(0, 10).toUpperCase()}
            </text>
          </g>

          {/* Main Chassis / Monocoque & Sidepod */}
          <path
            d="M 120 205
               C 160 195, 230 185, 300 175
               C 340 170, 370 145, 410 135
               C 440 128, 480 120, 520 120
               C 560 120, 610 125, 660 145
               C 700 160, 750 185, 790 195
               L 790 235
               L 260 235
               C 210 235, 160 220, 120 205 Z"
            fill="url(#liveryGrad)"
            stroke="#1F2733"
            strokeWidth="2"
          />

          {/* Engine Airbox & Shark Fin */}
          <path
            d="M 470 124
               L 490 85
               L 540 85
               L 690 145
               L 520 124 Z"
            fill="#1E2738"
            stroke="#2E394D"
            strokeWidth="1.5"
          />
          {/* Engine Air Intake Hole */}
          <ellipse
            cx="495"
            cy="98"
            rx="10"
            ry="14"
            fill="#0A0D12"
            stroke="#4A5568"
            strokeWidth="1.5"
          />

          {/* Cockpit & Halo (FIA safety titanium structure) */}
          <path
            d="M 370 162
               C 385 142, 420 132, 470 132
               L 470 152
               C 430 152, 400 158, 370 168 Z"
            fill="#0E131C"
          />
          {/* Halo arch */}
          <path
            d="M 390 165
               Q 430 130 480 135
               Q 460 145 420 160 Z"
            fill="#334155"
            stroke="#64748B"
            strokeWidth="1.5"
          />
          {/* Driver Helmet */}
          <circle cx="445" cy="144" r="13" fill="#F59E0B" stroke="#000000" strokeWidth="1.5" />
          <path d="M 436 142 L 454 142 L 452 147 L 438 147 Z" fill="#111827" />

          {/* Nosecone (Extending to the front wing) */}
          <path
            d="M 70 216
               L 160 205
               L 310 178
               L 310 195
               L 160 222
               L 70 224 Z"
            fill="url(#noseGrad)"
            stroke="#2B3648"
            strokeWidth="1.5"
          />

          {/* Front Wing & Endplates (Active Aero flap) */}
          <g id="front-wing">
            <rect
              x="50"
              y="212"
              width="10"
              height="38"
              rx="2"
              fill="#1C2330"
              stroke="#374151"
              strokeWidth="1.5"
            />
            <path d="M 52 235 L 140 232 L 140 244 L 52 246 Z" fill={teamColor} />
            <path d="M 52 225 L 125 224 L 125 231 L 52 233 Z" fill="#2E384A" />
            <circle cx="55" cy="220" r="3" fill="#E10600" />
          </g>

          {/* Sidepod Air Intake (Radiators + 350kW MGU-K cooling) */}
          <path
            d="M 330 185
               L 360 165
               L 375 165
               L 355 210
               L 330 210 Z"
            fill="#090C12"
            stroke="#242E3E"
            strokeWidth="1.5"
          />

          {/* SPONSOR 1: Sidepod Big Logo */}
          <g transform="translate(420, 182)">
            <rect x="-10" y="-12" width="160" height="26" rx="4" fill="#000000" opacity="0.35" />
            <text
              x="70"
              y="6"
              fill="#FFFFFF"
              fontSize="14"
              fontWeight="900"
              fontFamily="monospace"
              letterSpacing="2"
              textAnchor="middle"
              stroke="#000000"
              strokeWidth="0.5"
            >
              {mainSponsor.slice(0, 14).toUpperCase()}
            </text>
          </g>

          {/* SPONSOR 2: Engine Cover / Shark Fin */}
          <g transform="translate(560, 126)">
            <text
              x="45"
              y="0"
              fill="#E2E8F0"
              fontSize="10"
              fontWeight="800"
              fontFamily="monospace"
              letterSpacing="1.5"
              textAnchor="middle"
            >
              {sideSponsor1.slice(0, 12).toUpperCase()}
            </text>
          </g>

          {/* SPONSOR 3: Nosecone Logo */}
          <g transform="translate(195, 204) rotate(-8)">
            <text
              x="0"
              y="0"
              fill="#FFFFFF"
              fontSize="9"
              fontWeight="800"
              fontFamily="monospace"
              letterSpacing="1"
            >
              {sideSponsor2.slice(0, 10).toUpperCase()}
            </text>
          </g>

          {/* Wheels / Tires (18-inch F1 Low-Profile) */}
          {/* Front Wheel */}
          <g id="front-wheel">
            {/* Tire Outer Rubber */}
            <circle
              cx="210"
              cy="226"
              r="46"
              fill="url(#tireGrad)"
              stroke="#394252"
              strokeWidth="2.5"
            />
            {/* Wheel Rim 18-inch cover */}
            <circle
              cx="210"
              cy="226"
              r="28"
              fill="url(#rimGrad)"
              stroke="#4A5568"
              strokeWidth="2"
            />
            {/* Pirelli / Tire Compound Color Ring */}
            <circle
              cx="210"
              cy="226"
              r="41"
              fill="none"
              stroke="#FFCC00"
              strokeWidth="3"
              opacity="0.9"
            />
            {/* Center Lock Nut */}
            <circle cx="210" cy="226" r="8" fill="#E10600" />
            <circle cx="210" cy="226" r="4" fill="#FFFFFF" />
          </g>

          {/* Rear Wheel */}
          <g id="rear-wheel">
            {/* Tire Outer Rubber */}
            <circle
              cx="760"
              cy="226"
              r="48"
              fill="url(#tireGrad)"
              stroke="#394252"
              strokeWidth="2.5"
            />
            {/* Wheel Rim 18-inch cover */}
            <circle
              cx="760"
              cy="226"
              r="30"
              fill="url(#rimGrad)"
              stroke="#4A5568"
              strokeWidth="2"
            />
            {/* Pirelli / Tire Compound Color Ring */}
            <circle
              cx="760"
              cy="226"
              r="43"
              fill="none"
              stroke="#FFCC00"
              strokeWidth="3"
              opacity="0.9"
            />
            {/* Center Lock Nut */}
            <circle cx="760" cy="226" r="8" fill="#E10600" />
            <circle cx="760" cy="226" r="4" fill="#FFFFFF" />
          </g>

          {/* Suspension Wishbones (Front and Rear) */}
          <line x1="210" y1="215" x2="290" y2="185" stroke="#4A5568" strokeWidth="3" />
          <line x1="210" y1="230" x2="280" y2="218" stroke="#334155" strokeWidth="3" />
          <line x1="760" y1="215" x2="690" y2="185" stroke="#4A5568" strokeWidth="3" />
          <line x1="760" y1="230" x2="700" y2="218" stroke="#334155" strokeWidth="3" />

          {/* Car Number #1 / #2 Badge */}
          <g transform="translate(245, 185) rotate(-5)">
            <rect x="-4" y="-12" width="22" height="18" rx="3" fill="#E10600" />
            <text
              x="7"
              y="1"
              fill="#FFFFFF"
              fontSize="12"
              fontWeight="900"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              1
            </text>
          </g>
        </svg>
      </div>

      {/* Active sponsors badge pill bar */}
      <div className="mt-3 pt-3 border-t border-[#1F2733]/60 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="text-[#8B95A7]">Patrocinadores no Chassi:</span>
        <div className="flex flex-wrap gap-1.5">
          {activeSponsors.length === 0 ? (
            <span className="text-amber-400/80 text-[11px]">
              Nenhum contrato ativo (assine na aba Patrocínios)
            </span>
          ) : (
            activeSponsors.map((sp, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#161D29] text-[#F5F7FA] border border-[#1F2733] text-[10px] font-bold"
              >
                {sp}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
export default CarLivery
