import React from 'react'
import { Card } from '@/components/ui/card'
import audiCarGaragePng from '@/assets/audi-13288.png'
import audiLiveryCarPng from '@/assets/audi-a0460.png'
import audiEmblemJpg from '@/assets/audi-e9cff.jpg'
import { getTeamSideView, getTeamLogo } from '@/data/assets/teamAssets'

interface TeamBrandingCardProps {
  teamKey?: string
  teamName: string
  logoUrl?: string
  tagline?: string
}

export const TeamBrandingCard: React.FC<TeamBrandingCardProps> = ({
  teamKey,
  teamName,
  logoUrl,
  tagline = 'DRIVEN BY PROGRESS',
}) => {
  const isAudi =
    (teamKey || '').toLowerCase().includes('audi') || teamName.toLowerCase().includes('audi')

  // Resolução genérica de SideView e Logo para qualquer equipe do grid 2026
  const sideViewSrc = getTeamSideView(teamKey || teamName)
  const canonicalLogo = getTeamLogo(teamKey || teamName)
  const effectiveLogo = logoUrl || canonicalLogo

  // Estado para fallback seguro de imagem ausente
  const [sideViewError, setSideViewError] = React.useState(false)

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-[#121620] via-[#0D1017] to-[#080A0F] border border-neutral-800/90 shadow-sm rounded-2xl p-6 flex flex-col justify-between h-full text-white min-h-[260px] group">
      {/* Detalhes de iluminação de fundo / grid sutil */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(225,6,0,0.12),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] opacity-40 pointer-events-none" />

      {/* Conteúdo Superior: Badge da Montadora & Nome da Equipe */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
              Identidade & Branding
            </span>
          </div>
          <h4 className="text-xl font-black tracking-tight text-white font-serif mt-1">
            {teamName}
          </h4>
        </div>

        {/* Emblema / Logo da equipe */}
        {effectiveLogo ? (
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center backdrop-blur-sm shrink-0">
            <img
              src={effectiveLogo}
              alt={`${teamName} Logo`}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                ;(e.currentTarget as HTMLElement).style.display = 'none'
              }}
            />
          </div>
        ) : isAudi ? (
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm shrink-0 overflow-hidden">
            <img
              src={audiEmblemJpg}
              alt="Audi Sport"
              className="w-full h-full object-cover opacity-80"
            />
          </div>
        ) : (
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-sm text-neutral-400 font-mono shrink-0">
            {(teamKey || teamName || 'F1').substring(0, 3).toUpperCase()}
          </div>
        )}
      </div>

      {/* Área Central Principal: Vista Lateral Completa e Destaque Visual */}
      <div className="relative z-10 my-3 w-full rounded-xl bg-black/40 border border-white/5 p-3 flex items-center justify-center min-h-[110px] overflow-hidden backdrop-blur-sm">
        {sideViewSrc && !sideViewError ? (
          <div className="relative w-full flex items-center justify-center">
            <img
              src={sideViewSrc}
              alt={`Vista Lateral ${teamName}`}
              className="w-full h-auto max-h-28 object-contain filter contrast-110 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] transition-transform duration-500 group-hover:scale-[1.02]"
              onError={() => setSideViewError(true)}
            />
            <span className="absolute right-1 bottom-0 text-[8px] font-mono tracking-widest text-neutral-400/60 uppercase select-none bg-black/60 px-1 py-0.5 rounded border border-white/5">
              OFICIAL 2026
            </span>
          </div>
        ) : isAudi ? (
          <div className="relative w-full flex items-center justify-center">
            <img
              src={audiCarGaragePng}
              alt="Audi F1 Livery Silhouette"
              className="w-full h-auto max-h-24 object-contain filter grayscale contrast-125 opacity-40"
            />
            <span className="absolute right-1 bottom-0 text-[8px] font-mono tracking-widest text-neutral-500 uppercase select-none">
              SILHOUETTE
            </span>
          </div>
        ) : (
          /* Fallback limpo quando a equipe não possui sideView física ainda */
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-500 uppercase">
              VISTA LATERAL EM DESENVOLVIMENTO
            </span>
            <span className="text-[9px] font-mono text-neutral-600 mt-0.5">
              F1 2026 SPECIFICATION
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo Inferior: Composição Limpa de UI & Slogan Oficial */}
      <div className="relative z-10">
        <div className="border-t border-white/10 pt-3 flex items-end justify-between gap-2">
          <div>
            <span className="text-[9px] font-mono uppercase tracking-widest text-[#E10600] font-black block">
              Official Heritage
            </span>
            <p className="text-xs font-semibold text-neutral-300 tracking-wider uppercase font-mono mt-0.5">
              {tagline}
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
            F1 2026 Grid
          </span>
        </div>
      </div>
    </Card>
  )
}
