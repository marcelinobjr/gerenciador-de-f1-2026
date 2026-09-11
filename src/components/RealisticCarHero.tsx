import React, { useState, useRef } from 'react'
import { getCarroPorEquipeImage, IMAGEM_CARRO_PADRAO_FALLBACK } from '@/assets/carroPorEquipe'
import { PartModel, SponsorModel } from '@/types/f1'
import { Sparkles, Maximize2, Camera, RotateCcw, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RealisticCarHeroProps {
  teamColor?: string
  teamName?: string
  teamKey?: string | null
  isCustomTeam?: boolean
  sponsors?: SponsorModel[]
  carLevel?: number
  parts: PartModel[]
  selectedPartId: string | null
  customCarImage?: string | null
  isUploadingImage?: boolean
  onUploadCarImage?: (file: File) => void | Promise<void>
  onResetCarImage?: () => void | Promise<void>
  onSelectPart: (partId: string) => void
  onOpenBlueprint?: () => void
}

export const RealisticCarHero: React.FC<RealisticCarHeroProps> = ({
  teamColor = '#E10600',
  teamName = 'Escuderia F1',
  teamKey,
  isCustomTeam = false,
  sponsors = [],
  carLevel = 75,
  parts = [],
  selectedPartId,
  customCarImage,
  isUploadingImage = false,
  onUploadCarImage,
  onResetCarImage,
  onSelectPart,
  onOpenBlueprint,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null)

  // Imagem base do carro por equipe exclusiva da aba Carro
  const resolvedBaseCarImage = getCarroPorEquipeImage(teamKey, isCustomTeam)

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

  // Hotspots mapeados em % anatômicos na foto limpa do carro lateral
  // O monoposto está virado para a esquerda:
  // - Asa dianteira: ponta dianteira esquerda (~11%, ~78%)
  // - Suspensão dianteira: eixo dianteiro (~25%, ~66%)
  // - Monocoque / Sidepod: centro da carroceria / entrada do radiador (~52%, ~62%)
  // - Tampa / Shark Fin: barbatana superior do motor (~66%, ~38%)
  // - Asa Traseira: aerofólio superior traseiro à direita (~88%, ~34%)
  // - Assoalho & Venturi: fundo plano e assoalho inferior (~50%, ~88%)
  const hotspots = [
    {
      id: frontWingPart?.id,
      key: 'asa-dianteira',
      title: 'Asa Dianteira',
      part: frontWingPart,
      left: '11%',
      top: '78%',
      labelPos: 'bottom',
    },
    {
      id: suspensionPart?.id,
      key: 'suspensao',
      title: 'Suspensão Diant.',
      part: suspensionPart,
      left: '25%',
      top: '66%',
      labelPos: 'top',
    },
    {
      id: chassiPart?.id,
      key: 'chassi',
      title: 'Monocoque / Sidepod',
      part: chassiPart,
      left: '52%',
      top: '62%',
      labelPos: 'top',
    },
    {
      id: floorPart?.id,
      key: 'assoalho',
      title: 'Assoalho & Venturi',
      part: floorPart,
      left: '50%',
      top: '88%',
      labelPos: 'bottom',
    },
    {
      id: activeAeroPart?.id,
      key: 'aero-ativa',
      title: 'Tampa / Shark Fin',
      part: activeAeroPart,
      left: '66%',
      top: '38%',
      labelPos: 'top',
    },
    {
      id: rearWingPart?.id,
      key: 'asa-traseira',
      title: 'Asa Traseira',
      part: rearWingPart,
      left: '88%',
      top: '34%',
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

          {/* Input oculto para carregar imagem do carro */}
          {onUploadCarImage && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  onUploadCarImage(file)
                }
                if (e.target) e.target.value = ''
              }}
            />
          )}

          {/* Botão de Trocar Imagem do Carro */}
          {onUploadCarImage && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              title="Carregue qualquer imagem própria para substituir a foto lateral"
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isUploadingImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Salvando imagem...</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Trocar imagem do carro</span>
                </>
              )}
            </button>
          )}

          {/* Botão discreto para restaurar imagem padrão se customCarImage estiver ativa */}
          {customCarImage && onResetCarImage && (
            <button
              type="button"
              onClick={onResetCarImage}
              disabled={isUploadingImage}
              title="Restaurar a foto homologada padrão"
              className="px-2.5 py-1 rounded-lg bg-[#0D1424] hover:bg-[#152037] border border-[#1E293B] hover:border-slate-500 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Restaurar padrão</span>
            </button>
          )}

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

        {/* Marcadores discretos de cota de estúdio fotográfico */}
        <div className="absolute inset-x-4 sm:inset-x-12 top-6 bottom-14 pointer-events-none flex flex-col justify-between opacity-35">
          <div className="flex justify-between text-[9px] text-slate-400/50 px-2 font-mono">
            <span>+0.000m [FRONT WING]</span>
            <span className="hidden sm:inline">+1.700m [COCKPIT/HALO]</span>
            <span className="hidden sm:inline">+3.400m [WHEELBASE]</span>
            <span>+5.000m [REAR WING]</span>
          </div>
          <div className="flex justify-between text-[9px] text-slate-400/50 px-2 font-mono">
            <span>FIA SPEC-2026</span>
            <span>768 KG</span>
          </div>
        </div>

        {/* CONTAINER DO CARRO COM SOBREPOSIÇÃO DE COR E DECALQUES */}
        <div className="relative w-full max-w-[1100px] mx-auto aspect-[1000/320] flex items-center justify-center">
          {/* Sombra de contato do carro com o solo escuro */}
          <div className="absolute bottom-[2%] left-[4%] right-[4%] h-[12%] bg-black/90 blur-[10px] rounded-full pointer-events-none" />

          {/* 1. IMAGEM DO CARRO REALISTA LIMPA COM INTEGRAÇÃO AO FUNDO DARK (VINHETA E SOMBRA DE ESTÚDIO) */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Foto original limpa do carro F1, sem sobreposições decorativas coloridas */}
            <img
              src={customCarImage || resolvedBaseCarImage}
              alt={`${teamName} Carro de F1 2026`}
              className="w-full h-full object-contain pointer-events-none select-none relative z-10 brightness-[0.98] contrast-[1.05]"
              style={{
                // Fundo cinza suavemente mesclado com o estúdio escuro
                filter: 'drop-shadow(0 14px 24px rgba(0, 0, 0, 0.9))',
              }}
              onError={(e) => {
                // Fallback gracioso para a imagem homologada de fallback caso a URL falhe
                const target = e.currentTarget
                if (target.src !== IMAGEM_CARRO_PADRAO_FALLBACK) {
                  target.src = IMAGEM_CARRO_PADRAO_FALLBACK
                }
              }}
            />

            {/* Máscara e vinheta periférica suave para dissolver 100% as bordas da foto no estúdio escuro */}
            <div
              className="absolute inset-0 pointer-events-none z-10 rounded-xl"
              style={{
                background:
                  'radial-gradient(ellipse 88% 70% at 50% 50%, transparent 55%, rgba(6, 10, 18, 0.5) 78%, rgba(5, 7, 13, 0.95) 95%, #05070D 100%)',
              }}
            />

            {/* 2. DECALQUES DE PATROCINADORES SOBRE A CARROCERIA (SOMENTE PARA EQUIPES PERSONALIZADAS) */}
            {isCustomTeam && (
              <svg
                viewBox="0 0 1000 320"
                className="absolute inset-0 w-full h-full pointer-events-none z-30 select-none"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* DECALQUE 1: Patrocinador Principal no Sidepod */}
                <g transform="translate(560, 206) skewX(-8)">
                  <rect
                    x="-90"
                    y="-12"
                    width="180"
                    height="22"
                    rx="3"
                    fill="#000000"
                    opacity="0.3"
                  />
                  <text
                    x="0"
                    y="4"
                    fill="#FFFFFF"
                    fontSize="11"
                    fontWeight="900"
                    fontFamily="'Montserrat', 'Arial Black', sans-serif"
                    letterSpacing="1.5"
                    textAnchor="middle"
                    stroke="#000000"
                    strokeWidth="1.5"
                    paintOrder="stroke fill"
                    opacity="0.95"
                    lengthAdjust="spacingAndGlyphs"
                    textLength={mainSponsor.length > 14 ? '170' : undefined}
                  >
                    {mainSponsor.toUpperCase()}
                  </text>
                </g>

                {/* DECALQUE 2: Patrocinador Secundário no Shark Fin / Tampa do Motor */}
                <g transform="translate(660, 136) rotate(-2)">
                  <rect
                    x="-65"
                    y="-10"
                    width="130"
                    height="18"
                    rx="3"
                    fill="#000000"
                    opacity="0.35"
                  />
                  <text
                    x="0"
                    y="3"
                    fill="#FFFFFF"
                    fontSize="9"
                    fontWeight="800"
                    fontFamily="'Montserrat', sans-serif"
                    letterSpacing="1.2"
                    textAnchor="middle"
                    stroke="#000000"
                    strokeWidth="1"
                    paintOrder="stroke fill"
                    lengthAdjust="spacingAndGlyphs"
                    textLength={sideSponsor1.length > 12 ? '120' : undefined}
                  >
                    {sideSponsor1.toUpperCase()}
                  </text>
                </g>

                {/* DECALQUE 3: Patrocinador na Asa Traseira (Placa vertical da asa traseira / Endplate) */}
                <g transform="translate(885, 120)">
                  <rect
                    x="-45"
                    y="-11"
                    width="90"
                    height="20"
                    rx="2"
                    fill="#000000"
                    opacity="0.5"
                  />
                  <text
                    x="0"
                    y="3"
                    fill="#FFFFFF"
                    fontSize="9"
                    fontWeight="900"
                    fontFamily="'Montserrat', sans-serif"
                    letterSpacing="1.2"
                    textAnchor="middle"
                    stroke="#000000"
                    strokeWidth="1"
                    paintOrder="stroke fill"
                    lengthAdjust="spacingAndGlyphs"
                    textLength={wingSponsor.length > 8 ? '80' : undefined}
                  >
                    {wingSponsor.slice(0, 16).toUpperCase()}
                  </text>
                </g>

                {/* DECALQUE 4: Patrocinador no Bico Frontal (Nosecone) */}
                <g transform="translate(200, 222) rotate(-9)">
                  <rect x="-42" y="-8" width="84" height="16" rx="2" fill="#000000" opacity="0.3" />
                  <text
                    x="0"
                    y="3"
                    fill="#FFFFFF"
                    fontSize="7.5"
                    fontWeight="800"
                    fontFamily="'Montserrat', sans-serif"
                    letterSpacing="1"
                    textAnchor="middle"
                    stroke="#000000"
                    strokeWidth="0.8"
                    paintOrder="stroke fill"
                    lengthAdjust="spacingAndGlyphs"
                    textLength={sideSponsor2.length > 10 ? '76' : undefined}
                  >
                    {sideSponsor2.toUpperCase()}
                  </text>
                </g>

                {/* Logo Oficial F1 2026 discreto no chassi */}
                <g transform="translate(340, 202)">
                  <rect x="-14" y="-7" width="28" height="13" rx="2" fill="#E10600" />
                  <text
                    x="0"
                    y="2.5"
                    fill="#FFFFFF"
                    fontSize="8"
                    fontWeight="900"
                    fontFamily="sans-serif"
                    textAnchor="middle"
                  >
                    F1
                  </text>
                </g>

                {/* Número do Piloto no bico */}
                <g transform="translate(270, 206) rotate(-7)">
                  <circle cx="0" cy="0" r="9" fill="#0A0E17" stroke={teamColor} strokeWidth="1.5" />
                  <text
                    x="0"
                    y="3.5"
                    fill="#FFFFFF"
                    fontSize="9.5"
                    fontWeight="900"
                    fontFamily="'Arial Black', sans-serif"
                    textAnchor="middle"
                  >
                    1
                  </text>
                </g>
              </svg>
            )}

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
