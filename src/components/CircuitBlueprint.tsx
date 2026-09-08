import React from 'react'

/**
 * Biblioteca de traçados dos circuitos oficiais da Fórmula 1 2026.
 * Silhuetas estilizadas no estilo blueprint técnico (grid, cotas e iluminação neon/cyan).
 */

export interface CircuitTrackData {
  round: number
  code: string
  name: string
  svgPath: string
  viewBox: string
  startFinish: { x: number; y: number }
  drsZones?: Array<{ x1: number; y1: number; x2: number; y2: number }>
  sectorPoints?: Array<{ x: number; y: number; label: string }>
  antiClockwise?: boolean
  description: string
}

export const TRACK_LAYOUTS: Record<number, CircuitTrackData> = {
  // 1: Melbourne Albert Park
  1: {
    round: 1,
    code: 'ALB',
    name: 'Albert Park, Melbourne',
    viewBox: '0 0 320 220',
    svgPath:
      'M 75 160 C 65 140, 60 110, 75 80 C 95 40, 150 35, 190 45 C 230 55, 260 75, 275 110 C 285 140, 265 175, 230 185 C 190 195, 145 175, 125 155 C 110 140, 95 180, 75 160 Z',
    startFinish: { x: 75, y: 160 },
    antiClockwise: false,
    description: 'Circuito misto ao redor do lago de Albert Park, rápido com freadas pesadas.',
  },
  // 2: Shanghai
  2: {
    round: 2,
    code: 'SHA',
    name: 'Xangai',
    viewBox: '0 0 320 220',
    svgPath:
      'M 60 150 C 45 110, 70 70, 100 65 C 130 60, 145 95, 120 115 C 95 135, 140 145, 180 145 L 265 145 C 280 145, 285 125, 270 110 L 210 55 C 195 40, 175 40, 160 55 L 90 140 C 75 155, 65 165, 60 150 Z',
    startFinish: { x: 265, y: 145 },
    antiClockwise: false,
    description:
      'Formato do caractere chinês "shang", famosa curva em caracol 1-2 e reta de 1,2 km.',
  },
  // 3: Suzuka
  3: {
    round: 3,
    code: 'SUZ',
    name: 'Suzuka',
    viewBox: '0 0 320 220',
    svgPath:
      'M 70 170 C 50 145, 65 110, 85 95 C 105 80, 115 105, 135 110 C 160 115, 185 85, 210 65 C 240 45, 275 60, 270 95 C 265 130, 215 145, 185 130 C 155 115, 130 160, 100 175 C 85 180, 75 185, 70 170 Z',
    startFinish: { x: 70, y: 170 },
    antiClockwise: false,
    description: 'Lendário traçado em "oito" com curvas em S, Degner e a mítica 130R.',
  },
  // 4: Bahrein (Sakhir)
  4: {
    round: 4,
    code: 'BHR',
    name: 'Sakhir, Bahrein',
    viewBox: '0 0 320 220',
    svgPath:
      'M 70 180 L 70 60 C 70 45, 90 40, 105 55 L 140 95 C 150 105, 170 100, 180 85 L 215 45 C 230 35, 255 45, 255 65 L 255 150 C 255 170, 235 180, 210 170 L 165 150 C 145 140, 125 150, 115 165 L 85 185 C 75 190, 70 190, 70 180 Z',
    startFinish: { x: 70, y: 180 },
    antiClockwise: false,
    description: 'Stop-and-go no deserto de Sakhir com 4 longas retas e asfalto muito abrasivo.',
  },
  // 5: Jeddah
  5: {
    round: 5,
    code: 'JED',
    name: 'Corniche de Jeddah',
    viewBox: '0 0 320 220',
    svgPath:
      'M 60 190 C 50 160, 75 120, 85 90 C 95 60, 130 40, 160 40 C 200 40, 245 45, 275 65 C 290 80, 275 110, 245 125 C 215 140, 175 155, 140 170 C 105 185, 70 205, 60 190 Z',
    startFinish: { x: 60, y: 190 },
    antiClockwise: true,
    description: 'Circuito de rua mais veloz do mundo com 27 curvas cegas à beira do Mar Vermelho.',
  },
  // 6: Miami
  6: {
    round: 6,
    code: 'MIA',
    name: 'Miami International Autodrome',
    viewBox: '0 0 320 220',
    svgPath:
      'M 55 165 L 55 75 C 55 55, 75 45, 95 55 L 175 95 C 190 105, 220 100, 235 85 L 265 60 C 280 50, 290 60, 285 80 L 265 165 C 260 185, 235 190, 210 180 L 130 150 C 105 140, 75 150, 65 165 Z',
    startFinish: { x: 55, y: 165 },
    antiClockwise: true,
    description:
      'Contorno ao redor do Hard Rock Stadium, setor técnico da marina e retas de mais de 330 km/h.',
  },
  // 7: Imola
  7: {
    round: 7,
    code: 'IMO',
    name: 'Enzo e Dino Ferrari, Imola',
    viewBox: '0 0 320 220',
    svgPath:
      'M 80 180 C 60 150, 70 100, 95 70 C 120 40, 160 40, 190 55 C 220 70, 245 90, 265 80 C 285 70, 280 110, 260 140 C 240 170, 200 180, 165 165 C 135 150, 100 195, 80 180 Z',
    startFinish: { x: 80, y: 180 },
    antiClockwise: true,
    description:
      'Pista clássica italiana anti-horária com as icônicas Tamburello, Piratella e Acque Minerali.',
  },
  // 8: Monaco
  8: {
    round: 8,
    code: 'MCO',
    name: 'Monte Carlo, Mônaco',
    viewBox: '0 0 320 220',
    svgPath:
      'M 85 165 C 70 140, 80 110, 110 85 C 135 65, 165 60, 190 75 C 210 90, 205 110, 185 115 C 165 120, 175 140, 205 145 C 240 150, 265 130, 260 105 C 255 80, 280 90, 280 120 C 280 155, 245 185, 200 185 C 150 185, 115 175, 85 165 Z',
    startFinish: { x: 85, y: 165 },
    antiClockwise: false,
    description:
      'O circuito mais glamoroso e apertado: Sainte-Dévote, Cassino, Hairpin do Grand Hotel e Túnel.',
  },
  // 9: Barcelona-Catalunya
  9: {
    round: 9,
    code: 'BCN',
    name: 'Barcelona-Catalunha',
    viewBox: '0 0 320 220',
    svgPath:
      'M 60 175 L 60 70 C 60 50, 85 45, 110 60 C 135 75, 175 75, 200 55 C 225 35, 260 45, 270 75 C 280 105, 255 135, 225 140 C 195 145, 175 170, 140 175 L 60 175 Z',
    startFinish: { x: 60, y: 175 },
    antiClockwise: false,
    description: 'Balanço aerodinâmico perfeito exigido: Curva 3 de raio longo e freadas de apoio.',
  },
  // 10: Montreal (Gilles Villeneuve)
  10: {
    round: 10,
    code: 'MTL',
    name: 'Gilles Villeneuve, Montreal',
    viewBox: '0 0 320 220',
    svgPath:
      'M 50 110 C 50 85, 80 80, 120 85 L 240 85 C 275 85, 285 105, 270 120 L 245 135 C 230 145, 210 140, 195 130 L 105 130 C 75 130, 50 125, 50 110 Z',
    startFinish: { x: 50, y: 110 },
    antiClockwise: false,
    description:
      'Na Ilha de Notre-Dame: zebras altas, hairpin do cassino e o temido Muro dos Campeões.',
  },
  // 11: Red Bull Ring (Austria)
  11: {
    round: 11,
    code: 'RBR',
    name: 'Red Bull Ring, Spielberg',
    viewBox: '0 0 320 220',
    svgPath:
      'M 65 170 L 65 95 C 65 75, 80 65, 105 75 L 180 105 C 195 110, 235 60, 265 60 C 285 60, 285 90, 260 120 L 195 170 C 170 190, 130 185, 95 175 L 65 170 Z',
    startFinish: { x: 65, y: 170 },
    antiClockwise: false,
    description:
      'Volta mais rápida do ano em tempo (64s), fortes subidas e descidas nos Alpes austríacos.',
  },
  // 12: Silverstone
  12: {
    round: 12,
    code: 'SIL',
    name: 'Silverstone',
    viewBox: '0 0 320 220',
    svgPath:
      'M 80 170 C 60 135, 75 90, 105 70 C 135 50, 175 45, 205 65 C 235 85, 265 70, 275 95 C 285 125, 260 155, 225 165 C 190 175, 150 150, 120 160 C 95 170, 90 185, 80 170 Z',
    startFinish: { x: 80, y: 170 },
    antiClockwise: false,
    description: 'Berço da F1 com o lendário complexo veloz de Maggotts, Becketts e Chapel.',
  },
  // 13: Spa-Francorchamps
  13: {
    round: 13,
    code: 'SPA',
    name: 'Spa-Francorchamps',
    viewBox: '0 0 320 220',
    svgPath:
      'M 75 175 C 55 145, 70 105, 90 85 C 110 65, 140 45, 175 45 C 210 45, 255 55, 275 80 C 295 110, 270 145, 235 160 C 195 175, 170 145, 140 150 C 115 155, 90 195, 75 175 Z',
    startFinish: { x: 75, y: 175 },
    antiClockwise: false,
    description: 'O circuito mais longo (7 km) nas Ardenas com a mítica Eau Rouge e Raidillon.',
  },
  // 14: Hungaroring
  14: {
    round: 14,
    code: 'HUN',
    name: 'Hungaroring',
    viewBox: '0 0 320 220',
    svgPath:
      'M 70 175 L 70 85 C 70 65, 95 55, 125 70 C 150 85, 185 85, 210 65 C 235 45, 265 60, 265 90 C 265 125, 240 155, 210 165 C 175 175, 140 150, 110 165 L 70 175 Z',
    startFinish: { x: 70, y: 175 },
    antiClockwise: false,
    description:
      '"Mônaco sem muros", travado, sinuoso e sem descanso para os pilotos sob forte calor.',
  },
  // 15: Zandvoort
  15: {
    round: 15,
    code: 'ZAN',
    name: 'Zandvoort',
    viewBox: '0 0 320 220',
    svgPath:
      'M 70 160 C 50 130, 65 85, 95 65 C 125 45, 170 50, 200 70 C 230 90, 265 95, 270 125 C 275 155, 245 180, 210 180 C 170 180, 140 155, 110 155 C 85 155, 75 180, 70 160 Z',
    startFinish: { x: 70, y: 160 },
    antiClockwise: false,
    description:
      'Nas dunas holandesas com curvas inclinadas (banking) de 18 graus em Tarzan e Arie Luyendyk.',
  },
  // 16: Monza
  16: {
    round: 16,
    code: 'MNZ',
    name: 'Monza',
    viewBox: '0 0 320 220',
    svgPath:
      'M 60 175 L 60 70 C 60 50, 80 45, 110 55 C 140 65, 190 65, 220 50 C 245 35, 275 50, 275 80 L 275 145 C 275 175, 240 185, 200 175 L 120 175 L 60 175 Z',
    startFinish: { x: 60, y: 175 },
    antiClockwise: false,
    description:
      'O Templo da Velocidade: quase 80% da volta em aceleração plena, Variante del Rettifilo e Parabolica.',
  },
  // 17: Baku
  17: {
    round: 17,
    code: 'BAK',
    name: 'Baku City Circuit',
    viewBox: '0 0 320 220',
    svgPath:
      'M 55 180 L 55 65 C 55 50, 75 45, 100 55 L 170 85 C 190 95, 225 90, 245 75 L 275 55 C 290 45, 295 65, 280 85 L 235 150 C 215 180, 175 185, 130 180 L 55 180 Z',
    startFinish: { x: 55, y: 180 },
    antiClockwise: true,
    description:
      'Reta gigantesca de 2,2 km junto ao Mar Cáspio e a seção medieval do castelo com apenas 7,6 m de largura.',
  },
  // 18: Marina Bay (Singapura)
  18: {
    round: 18,
    code: 'SIN',
    name: 'Marina Bay, Singapura',
    viewBox: '0 0 320 220',
    svgPath:
      'M 65 170 C 50 140, 65 100, 90 80 C 115 60, 150 60, 180 75 C 210 90, 240 85, 265 105 C 285 125, 270 160, 235 175 C 200 190, 155 180, 120 165 C 95 155, 75 190, 65 170 Z',
    startFinish: { x: 65, y: 170 },
    antiClockwise: true,
    description:
      'GP noturno tropical mais desgastante do ano: calor de 32°C, 80% de umidade e mais de 60 voltas.',
  },
  // 19: COTA (Austin)
  19: {
    round: 19,
    code: 'COT',
    name: 'Circuit of the Americas, Austin',
    viewBox: '0 0 320 220',
    svgPath:
      'M 65 175 L 65 85 C 65 55, 95 45, 120 70 C 145 95, 185 95, 215 70 C 240 50, 275 65, 270 100 C 265 135, 230 165, 190 165 C 150 165, 115 185, 85 185 L 65 175 Z',
    startFinish: { x: 65, y: 175 },
    antiClockwise: true,
    description:
      'Subida íngreme para a Curva 1, esse veloz inspirado em Silverstone e ferradura quádrupla.',
  },
  // 20: Hermanos Rodríguez (México)
  20: {
    round: 20,
    code: 'MEX',
    name: 'Hermanos Rodríguez, México',
    viewBox: '0 0 320 220',
    svgPath:
      'M 60 175 L 60 65 C 60 45, 85 45, 115 60 L 210 110 C 235 120, 270 110, 275 85 C 280 60, 290 85, 280 115 L 255 165 C 240 185, 210 185, 180 170 L 110 170 L 60 175 Z',
    startFinish: { x: 60, y: 175 },
    antiClockwise: false,
    description:
      'Altitude extrema de 2.200 m com ar rarefeito e passagem apoteótica pelo Estádio Foro Sol.',
  },
  // 21: Interlagos (Brasil)
  21: {
    round: 21,
    code: 'INT',
    name: 'Interlagos, São Paulo',
    viewBox: '0 0 320 220',
    svgPath:
      'M 80 170 C 60 145, 65 105, 90 80 C 115 55, 155 45, 185 65 C 215 85, 255 75, 275 105 C 290 135, 265 175, 225 185 C 185 195, 145 170, 115 155 C 95 145, 85 185, 80 170 Z',
    startFinish: { x: 80, y: 170 },
    antiClockwise: true,
    description:
      'Anti-horário autêntico com o "S do Senna", Curva do Sol, Reta Oposta, Ferradura e Junção.',
  },
  // 22: Las Vegas Strip
  22: {
    round: 22,
    code: 'LVG',
    name: 'Las Vegas Strip Circuit',
    viewBox: '0 0 320 220',
    svgPath:
      'M 55 160 L 55 75 C 55 55, 80 50, 110 65 L 200 110 C 220 120, 260 115, 280 95 C 295 80, 295 105, 280 125 L 245 165 C 225 185, 185 180, 140 165 L 55 160 Z',
    startFinish: { x: 55, y: 160 },
    antiClockwise: true,
    description:
      'Frio noturno no coração de Las Vegas, reta de 1,9 km na Strip a mais de 345 km/h.',
  },
  // 23: Lusail (Catar)
  23: {
    round: 23,
    code: 'QAT',
    name: 'Lusail International Circuit',
    viewBox: '0 0 320 220',
    svgPath:
      'M 65 175 L 65 75 C 65 50, 95 45, 125 65 C 155 85, 195 85, 225 65 C 255 45, 280 60, 280 95 C 280 135, 250 165, 210 175 C 170 185, 125 175, 95 165 L 65 175 Z',
    startFinish: { x: 65, y: 175 },
    antiClockwise: false,
    description:
      'Circuito ultramoderno e ultraveloz sob holofotes com altíssimas forças G laterais.',
  },
  // 24: Yas Marina (Abu Dhabi)
  24: {
    round: 24,
    code: 'ABU',
    name: 'Yas Marina, Abu Dhabi',
    viewBox: '0 0 320 220',
    svgPath:
      'M 70 170 C 50 140, 65 95, 95 70 C 125 45, 175 45, 205 65 C 235 85, 270 85, 275 115 C 280 150, 250 180, 210 180 C 170 180, 135 155, 105 160 C 85 165, 75 185, 70 170 Z',
    startFinish: { x: 70, y: 170 },
    antiClockwise: true,
    description:
      'A grande final sob o pôr do sol no Golfo: marina, hotel iluminado por LEDs e setor técnico final.',
  },
}

interface CircuitBlueprintProps {
  round: number
  circuitName?: string
  laps?: number
  lengthKm?: number
  className?: string
  interactive?: boolean
}

export const CircuitBlueprint: React.FC<CircuitBlueprintProps> = ({
  round,
  circuitName,
  laps,
  lengthKm,
  className = '',
  interactive = true,
}) => {
  const track = TRACK_LAYOUTS[round] || TRACK_LAYOUTS[1]

  return (
    <div
      className={`relative rounded-xl bg-[#08101E] border border-[#1E293B] p-4 font-mono select-none overflow-hidden ${className}`}
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(0, 166, 251, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0, 166, 251, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '16px 16px',
      }}
    >
      {/* Blueprint Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1E293B]/70">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00A6FB] animate-pulse" />
          <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
            LAYOUT DO CIRCUITO FIA // {track.code}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>{track.antiClockwise ? '↺ Anti-horário' : '↻ Horário'}</span>
          {laps && <span className="text-white font-bold">• {laps} voltas</span>}
        </div>
      </div>

      {/* SVG Circuit Path Render */}
      <div className="relative flex items-center justify-center py-2">
        <svg
          viewBox={track.viewBox}
          className="w-full h-auto max-h-[170px] drop-shadow-[0_0_15px_rgba(0,166,251,0.25)]"
        >
          <defs>
            <filter id={`circuitGlow-${round}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id={`circuitGrad-${round}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00A6FB" />
              <stop offset="50%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#E10600" />
            </linearGradient>
          </defs>

          {/* Circuit track background shadow line */}
          <path
            d={track.svgPath}
            fill="none"
            stroke="#0B1628"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Circuit kerb/contour outline */}
          <path
            d={track.svgPath}
            fill="none"
            stroke="#1E293B"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Glowing racing line */}
          <path
            d={track.svgPath}
            fill="none"
            stroke={`url(#circuitGrad-${round})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#circuitGlow-${round})`}
          />

          {/* Start/Finish Line marker */}
          <g>
            <circle
              cx={track.startFinish.x}
              cy={track.startFinish.y}
              r="6"
              fill="#E10600"
              className="animate-pulse"
            />
            <circle cx={track.startFinish.x} cy={track.startFinish.y} r="2.5" fill="#FFFFFF" />
            {/* Checkerboard flag label */}
            <text
              x={track.startFinish.x + 8}
              y={track.startFinish.y + 4}
              fill="#F5F7FA"
              fontSize="8"
              fontFamily="monospace"
              fontWeight="bold"
            >
              LARGADA
            </text>
          </g>
        </svg>

        {/* Compass direction badge */}
        <div className="absolute bottom-1 left-2 text-[9px] text-slate-500 font-mono">NORTE ▲</div>
      </div>

      {/* Circuit Specs Footer */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1E293B]/70 text-[10px] text-center">
        <div>
          <span className="text-[#8B95A7] block text-[9px]">TOTAL VOLTAS</span>
          <strong className="text-white text-xs">{laps || 58} voltas</strong>
        </div>
        <div>
          <span className="text-[#8B95A7] block text-[9px]">EXTENSÃO</span>
          <strong className="text-cyan-400 text-xs">{lengthKm || 5.2} km</strong>
        </div>
        <div>
          <span className="text-[#8B95A7] block text-[9px]">DISTÂNCIA</span>
          <strong className="text-emerald-400 text-xs">
            {((laps || 58) * (lengthKm || 5.2)).toFixed(1)} km
          </strong>
        </div>
      </div>

      <p className="text-[10px] text-[#8B95A7] mt-2 line-clamp-1 italic">{track.description}</p>
    </div>
  )
}
