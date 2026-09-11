import React, { useState } from 'react'
import carLateralImg from '@/assets/image-36773.png'
import { PartModel, SponsorModel } from '@/types/f1'
import {
  Sparkles,
  Maximize2,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Zap,
  Shield,
  Eye,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RealisticCarHeroProps {
  teamColor?: string
  teamName?: string
  sponsors?: SponsorModel[]
  carLevel?: number
  parts: PartModel[]
  selectedPartId: string | null
  onSelectPart: (partId: string) => void
  onOpenBlueprint?: () => void
}

export const RealisticCarHero: React.FC<RealisticCarHeroProps> = ({
  teamColor = '#E10600',
  teamName = 'Escuderia F1',
  sponsors = [],
  carLevel = 75,
  parts = [],
  selectedPartId,
  onSelectPart,
  onOpenBlueprint,
}) => {
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null)
  const [colorBlendMode, setColorBlendMode] = useState<'multiply' | 'color-burn' | 'overlay'>(
    'multiply',
  )

  // Normalizador de peças
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

  // Patrocinadores ativos
  const activeSponsors = sponsors.filter((s) => s.status === 'ativo').map((s) => s.name)
  const mainSponsor = activeSponsors[0] || 'PETROBRAS'
  const sideSponsor1 = activeSponsors[1] || 'BANCO DO BRASIL'
  const sideSponsor2 = activeSponsors[2] || 'EMBRAER'
  const wingSponsor = activeSponsors[3] || 'VALE'

  // Hotspots mapeados em % na imagem do carro lateral
  // Imagem: Carro branco virado para a esquerda (frente à esquerda ~5% - 22%, traseira à direita ~78% - 94%)
  const hotspots = [
    {
      id: frontWingPart?.id,
      key: 'asa-dianteira',
      title: 'Asa Dianteira',
      part: frontWingPart,
      left: '10%',
      top: '74%',
      labelPos: 'bottom',
    },
    {
      id: suspensionPart?.id,
      key: 'suspensao',
      title: 'Suspensão Diant.',
      part: suspensionPart,
      left: '26%',
      top: '64%',
      labelPos: 'top',
    },
    {
      id: chassiPart?.id,
      key: 'chassi',
      title: 'Monocoque / Sidepod',
      part: chassiPart,
      left: '46%',
      top: '52%',
      labelPos: 'top',
    },
    {
      id: floorPart?.id,
      key: 'assoalho',
      title: 'Assoalho & Venturi',
      part: floorPart,
      left: '49%',
      top: '84%',
      labelPos: 'bottom',
    },
    {
      id: activeAeroPart?.id,
      key: 'aero-ativa',
      title: 'Tampa / Aero Ativa',
      part: activeAeroPart,
      left: '64%',
      top: '36%',
      labelPos: 'top',
    },
    {
      id: rearWingPart?.id,
      key: 'asa-traseira',
      title: 'Asa Traseira',
      part: rearWingPart,
      left: '88%',
      top: '32%',
      labelPos: 'top',
    },
  ]

  const getCondColor = (cond: number = 100) => {
    if (cond >= 80) return '#10B981'
    if (cond >= 50) return '#F59E0B'
    return '#EF4444'
  }

  return (
    <div className="relative w-full rounded-2xl bg-gradient-to-b from-[#090D15]/95 via-[#070B12]/95 to-[#05070D] border border-[#1E293B]/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden font-mono">
      {/* Luz ambiente superior com a cor da equipe */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-3/4 h-56 rounded-full blur-[100px] opacity-25"
        style={{ backgroundColor: teamColor }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#00a6fb_0.75px,transparent_0.75px)] [background-size:24px_24px] opacity-10" />

      {/* Barra superior de identificação */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between p-4 sm:p-5 border-b border-[#1A2333]/80 bg-[#080D17]/80 backdrop-blur-md gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span
              className="w-4 h-4 rounded-full inline-block shadow-md"
              style={{
                backgroundColor: teamColor,
                boxShadow: `0 0 16px ${teamColor}`,
              }}
            />
            <span
              className="absolute -inset-1 rounded-full border opacity-50 animate-ping pointer-events-none"
              style={{ borderColor: teamColor }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">
                VISUAL OFICIAL HOMOLOGADO // FIA 2026
              </span>
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1.5 border-cyan-500/30 text-cyan-300 bg-cyan-950/30"
              >
                768 KG • SPEC-A
              </Badge>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-wider uppercase drop-shadow-sm flex items-center gap-2">
              <span>{teamName}</span>
              <span className="text-slate-500 font-normal text-xs sm:text-sm">
                // Vista Lateral Realista
              </span>
            </h2>
          </div>
        </div>

        {/* Controles rápidos e status */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Indicador de Pintura */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0D1424] border border-[#1E293B] text-[11px] text-slate-300">
            <span className="text-slate-500 text-[10px] uppercase">Livery:</span>
            <div className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block border border-white/20"
                style={{ backgroundColor: teamColor }}
              />
              <span className="font-bold text-white uppercase text-[10px]">{teamColor}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0D1424] border border-[#1E293B] text-[11px]">
            <span className="text-slate-500 text-[10px] uppercase">Classificação:</span>
            <span className="font-bold text-cyan-400">{carLevel}/100</span>
          </div>

          {onOpenBlueprint && (
            <button
              type="button"
              onClick={onOpenBlueprint}
              className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,166,251,0.2)]"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Ver Blueprint Milimetrado</span>
            </button>
          )}
        </div>
      </div>

      {/* ÁREA CENTRAL: O CARRO LATERAL REALISTA INTEGRADO AO DARK */}
      <div className="relative w-full overflow-hidden select-none px-2 sm:px-6 py-6 sm:py-10 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[420px]">
        {/* Fundo de estúdio fotográfico escuro com iluminação radial suave */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(20,29,46,0.85)_0%,_rgba(6,9,16,0.98)_70%,_#030508_100%)] pointer-events-none" />

        {/* Linha de reflexo de solo (chão de oficina/estúdio com reflexo escuro) */}
        <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 w-[92%] h-1 bg-gradient-to-r from-transparent via-[#00A6FB]/20 to-transparent pointer-events-none" />
        <div className="absolute bottom-2 sm:bottom-5 left-1/2 -translate-x-1/2 w-[85%] h-8 bg-gradient-to-t from-black via-black/80 to-transparent blur-md pointer-events-none" />

        {/* Grade de medição milimétrica sutil no estúdio */}
        <div className="absolute inset-x-4 sm:inset-x-12 top-6 bottom-14 border-t border-b border-cyan-500/10 pointer-events-none flex flex-col justify-between opacity-40">
          <div className="flex justify-between text-[9px] text-cyan-500/40 px-2 font-mono">
            <span>+0.000m [FRONT WING]</span>
            <span>+1.700m [COCKPIT/HALO]</span>
            <span>+3.400m [WHEELBASE]</span>
            <span>+5.000m [REAR WING]</span>
          </div>
          <div className="w-full border-b border-cyan-500/5" />
          <div className="flex justify-between text-[9px] text-cyan-500/40 px-2 font-mono">
            <span>CHASSI FIA-2026 // GROUND-EFFECT TUNNELS</span>
            <span>768 KG REGULAMENTAR</span>
          </div>
        </div>

        {/* CONTAINER DO CARRO COM SOBREPOSIÇÃO DE COR E DECALQUES */}
        <div className="relative w-full max-w-[1100px] mx-auto aspect-[1000/320] flex items-center justify-center">
          {/* Sombra de contato do carro com o solo escuro */}
          <div className="absolute bottom-[2%] left-[4%] right-[4%] h-[12%] bg-black/90 blur-[10px] rounded-full pointer-events-none" />

          {/* 1. IMAGEM DO CARRO REALISTA COM TRATAMENTO DARK (Fundo cinza neutralizado via blend mode e máscara) */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Imagem do carro F1 branco com mix-blend-mode luminosity / multiply para integrar perfeitamente ao dark */}
            <img
              src={carLateralImg}
              alt={`${teamName} Carro de F1 2026`}
              className="w-full h-full object-contain pointer-events-none select-none relative z-10 brightness-[0.98] contrast-[1.08]"
              style={{
                // O fundo cinza original da imagem é naturalmente mesclado e escurecido pelo estúdio dark
                filter: 'drop-shadow(0 15px 25px rgba(0, 0, 0, 0.95))',
              }}
            />

            {/* Máscara de vinheta suave nas bordas para dissolver 100% de qualquer borda residual do fundo cinza original */}
            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                background:
                  'radial-gradient(ellipse 90% 75% at 50% 50%, transparent 60%, rgba(6, 10, 18, 0.7) 85%, #05070D 100%)',
              }}
            />

            {/* 2. CAMADA DE PINTURA / REALCE NA COR DA EQUIPE SOBRE A CARROCERIA BRANCA */}
            {/* SVG com formas anatômicas da carenagem lateral para colorir mantendo sombras e vincos originais */}
            <svg
              viewBox="0 0 1000 320"
              className="absolute inset-0 w-full h-full pointer-events-none z-20 select-none"
              style={{ mixBlendMode: 'multiply' }}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Gradiente da pintura da equipe: cor pura no centro, degradê metálico */}
                <linearGradient id="liveryTeamGrad" x1="10%" y1="50%" x2="90%" y2="50%">
                  <stop offset="0%" stopColor={teamColor} stopOpacity="0.85" />
                  <stop offset="35%" stopColor={teamColor} stopOpacity="0.9" />
                  <stop offset="65%" stopColor={teamColor} stopOpacity="0.95" />
                  <stop offset="95%" stopColor={teamColor} stopOpacity="0.8" />
                </linearGradient>

                <linearGradient id="sidepodStripe" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={teamColor} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={teamColor} stopOpacity="0.4" />
                </linearGradient>

                {/* Brilho da pintura metálica */}
                <linearGradient id="glossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
                </linearGradient>
              </defs>

              {/* Faixa / Pintura no Bico Frontal */}
              <path
                d="M 60 250 L 165 210 L 290 180 L 285 200 L 165 230 L 60 262 Z"
                fill="url(#liveryTeamGrad)"
                opacity="0.85"
              />

              {/* Pintura Principal no Sidepod / Carenagem Lateral do Monocoque */}
              <path
                d="M 330 185
                   C 365 160, 420 152, 500 152
                   C 570 152, 640 160, 710 185
                   C 730 195, 740 215, 740 230
                   L 330 230
                   C 320 210, 320 195, 330 185 Z"
                fill="url(#liveryTeamGrad)"
                opacity="0.82"
              />

              {/* Faixa aerodinâmica no Santo-Antônio / Tampa do Motor (Shark Fin) */}
              <path
                d="M 545 130
                   L 600 78
                   L 730 145
                   L 700 170
                   L 545 140 Z"
                fill={teamColor}
                opacity="0.88"
              />

              {/* Pintura da Asa Traseira (Placa Superior e Endplate) */}
              <path d="M 830 75 L 940 75 L 935 125 L 835 125 Z" fill={teamColor} opacity="0.85" />

              {/* Asa Dianteira Flap Superior na cor da equipe */}
              <path d="M 45 255 L 140 235 L 140 252 L 45 270 Z" fill={teamColor} opacity="0.88" />

              {/* Halo arco frontal na cor da equipe */}
              <path
                d="M 380 148 Q 440 105 490 120 Q 460 135 410 152 Z"
                fill={teamColor}
                opacity="0.75"
              />
            </svg>

            {/* Brilho adicional com blend overlay para textura realista */}
            <svg
              viewBox="0 0 1000 320"
              className="absolute inset-0 w-full h-full pointer-events-none z-20 select-none"
              style={{ mixBlendMode: 'overlay' }}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Realce de reflexo de estúdio sobre a carenagem */}
              <path
                d="M 330 185 C 420 160, 600 160, 710 185 L 700 195 C 600 170, 420 170, 335 195 Z"
                fill="#FFFFFF"
                opacity="0.6"
              />
            </svg>

            {/* 3. PROPAGANDAS ESCRITAS / PATROCINADORES COMO DECALQUES SOBRE A CARROCERIA */}
            <svg
              viewBox="0 0 1000 320"
              className="absolute inset-0 w-full h-full pointer-events-none z-30 select-none"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* DECALQUE 1: Patrocinador Principal no Sidepod (Grande, elegante com borda em relevo) */}
              <g transform="translate(480, 202)">
                <text
                  x="0"
                  y="0"
                  fill="#FFFFFF"
                  fontSize="22"
                  fontWeight="900"
                  fontFamily="'Montserrat', 'Arial Black', sans-serif"
                  letterSpacing="3"
                  textAnchor="middle"
                  stroke="#000000"
                  strokeWidth="2.5"
                  paintOrder="stroke fill"
                  opacity="0.95"
                >
                  {mainSponsor.toUpperCase()}
                </text>
              </g>

              {/* DECALQUE 2: Patrocinador Secundário no Shark Fin / Tampa do Motor */}
              <g transform="translate(640, 118) rotate(4)">
                <rect x="-75" y="-14" width="150" height="22" rx="3" fill="#000000" opacity="0.4" />
                <text
                  x="0"
                  y="2"
                  fill="#FFFFFF"
                  fontSize="12"
                  fontWeight="800"
                  fontFamily="'Montserrat', sans-serif"
                  letterSpacing="2"
                  textAnchor="middle"
                  stroke="#000000"
                  strokeWidth="1"
                  paintOrder="stroke fill"
                >
                  {sideSponsor1.toUpperCase()}
                </text>
              </g>

              {/* DECALQUE 3: Patrocinador na Asa Traseira (Rear Wing) */}
              <g transform="translate(885, 96)">
                <text
                  x="0"
                  y="0"
                  fill="#FFFFFF"
                  fontSize="13"
                  fontWeight="900"
                  fontFamily="'Montserrat', sans-serif"
                  letterSpacing="2.5"
                  textAnchor="middle"
                  stroke="#000000"
                  strokeWidth="1.5"
                  paintOrder="stroke fill"
                >
                  {wingSponsor.slice(0, 11).toUpperCase()}
                </text>
              </g>

              {/* DECALQUE 4: Patrocinador no Bico Frontal (Nosecone) */}
              <g transform="translate(180, 222) rotate(-14)">
                <text
                  x="0"
                  y="0"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="800"
                  fontFamily="'Montserrat', sans-serif"
                  letterSpacing="1.5"
                  textAnchor="middle"
                  stroke="#000000"
                  strokeWidth="1"
                  paintOrder="stroke fill"
                >
                  {sideSponsor2.toUpperCase()}
                </text>
              </g>

              {/* Logo Oficial F1 2026 discreto no chassi */}
              <g transform="translate(305, 196)">
                <rect x="-18" y="-9" width="36" height="15" rx="2" fill="#E10600" />
                <text
                  x="0"
                  y="2"
                  fill="#FFFFFF"
                  fontSize="9"
                  fontWeight="900"
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  F1
                </text>
              </g>

              {/* Número do Piloto no bico */}
              <g transform="translate(250, 198) rotate(-12)">
                <circle cx="0" cy="0" r="10" fill="#0A0E17" stroke={teamColor} strokeWidth="1.5" />
                <text
                  x="0"
                  y="4"
                  fill="#FFFFFF"
                  fontSize="11"
                  fontWeight="900"
                  fontFamily="'Arial Black', sans-serif"
                  textAnchor="middle"
                >
                  1
                </text>
              </g>
            </svg>

            {/* 4. HOTSPOTS CLICÁVEIS SOBRE O CARRO REALISTA (Peças interativas) */}
            <div className="absolute inset-0 pointer-events-auto z-40">
              {hotspots.map((hs) => {
                if (!hs.part) return null
                const isSel = selectedPartId === hs.part.id
                const isHov = hoveredHotspot === hs.key
                const cond = hs.part.condition ?? 100
                const condColor = getCondColor(cond)

                return (
                  <div
                    key={hs.key}
                    style={{ left: hs.left, top: hs.top }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer transition-transform"
                    onClick={() => hs.id && onSelectPart(hs.id)}
                    onMouseEnter={() => setHoveredHotspot(hs.key)}
                    onMouseLeave={() => setHoveredHotspot(null)}
                  >
                    {/* Anel pulsante de hotspot */}
                    <div className="relative flex items-center justify-center">
                      <span
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all duration-300 ${
                          isSel
                            ? 'bg-cyan-500/40 border-cyan-300 shadow-[0_0_16px_rgba(0,166,251,0.8)] scale-110'
                            : isHov
                              ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_12px_rgba(0,166,251,0.5)] scale-105'
                              : 'bg-[#08101E]/90 border-cyan-500/50 hover:border-cyan-300 shadow-md'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: condColor }}
                        />
                      </span>

                      {/* Ping animation se selecionado ou crítico */}
                      {(isSel || cond < 50) && (
                        <span
                          className="absolute -inset-1 rounded-full border animate-ping pointer-events-none opacity-60"
                          style={{ borderColor: cond < 50 ? '#EF4444' : '#00A6FB' }}
                        />
                      )}
                    </div>

                    {/* Tooltip / Badge de identificação da peça */}
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none transition-all duration-200 z-50 ${
                        hs.labelPos === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'
                      } ${
                        isSel || isHov
                          ? 'opacity-100 translate-y-0 scale-100'
                          : 'opacity-0 sm:opacity-75 scale-90'
                      }`}
                    >
                      <div
                        className={`px-2.5 py-1 rounded-lg border text-[10px] sm:text-[11px] font-mono shadow-xl backdrop-blur-md flex items-center gap-1.5 ${
                          isSel
                            ? 'bg-[#0A1628] border-cyan-400 text-cyan-200 ring-1 ring-cyan-400/40'
                            : 'bg-[#070D18]/95 border-[#1E293B] text-slate-200'
                        }`}
                      >
                        <span className="font-bold">{hs.title}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">Nív.{hs.part.level}</span>
                        <span
                          className="font-bold px-1 py-0.2 rounded text-[9px]"
                          style={{
                            color: condColor,
                            backgroundColor: `${condColor}20`,
                          }}
                        >
                          {cond}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Linha decorativa de entre-eixos e comprimento */}
        <div className="w-full max-w-[1000px] mt-4 flex items-center justify-between text-[10px] text-slate-500 font-mono px-4 border-t border-[#1E293B]/60 pt-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400/50" />
            <span>CLIQUE NOS PONTOS DO CARRO PARA INSPECIONAR CADA COMPONENTE</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-slate-400">
            <span>Comprimento: 5.000 mm</span>
            <span>Entre-eixos: 3.400 mm</span>
            <span>Aero: Z-Mode / X-Mode</span>
          </div>
        </div>
      </div>

      {/* SEÇÃO INFERIOR: PROPAGANDAS & PATROCINADORES NO CHASSI */}
      <div className="p-4 sm:p-5 border-t border-[#1E293B] bg-[#070D18]/95 backdrop-blur">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Patrocinadores Homologados na Carroceria:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeSponsors.length === 0 ? (
              <span className="text-xs text-amber-400/80 italic">
                Nenhum contrato ativo. Vá até a aba Patrocínios para assinar marcas.
              </span>
            ) : (
              activeSponsors.map((sp, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0D1526] border border-[#1E293B] text-xs font-mono text-slate-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="font-bold">{sp}</span>
                  <span className="text-[10px] text-slate-500">
                    {idx === 0
                      ? '(Sidepod)'
                      : idx === 1
                        ? '(Shark Fin)'
                        : idx === 2
                          ? '(Bico)'
                          : '(Asa Tras.)'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Seletor Rápido de Peças Clicáveis abaixo do carro */}
        <div className="mt-4 pt-3 border-t border-[#1E293B]/60 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 uppercase font-mono">
            Peças do Monoposto:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {parts.map((p) => {
              const isSel = selectedPartId === p.id
              const cond = p.condition ?? 100
              const condColor = getCondColor(cond)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPart(p.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-all ${
                    isSel
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,166,251,0.3)]'
                      : 'bg-[#0E1626] border-[#1E293B] text-slate-300 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: condColor }} />
                  <span>{p.name}</span>
                  <span className="text-[10px] text-slate-400 font-normal">Nív.{p.level}</span>
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
    </div>
  )
}

export default RealisticCarHero
