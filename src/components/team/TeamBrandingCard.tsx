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
    <Card className="relative overflow-hidden bg-gradient-to-br from-[#121620] via-[#0D1017] to-[#080A0F] border border-neutral-800/90 shadow-sm rounded-2xl p-6 flex flex-col justify-between h-full text-white min-h-[220px]">
      {/* Detalhes de iluminação de fundo / grid sutil */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(225,6,0,0.12),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] opacity-40 pointer-events-none" />

      {/* Marca d'água / Vista Lateral no Branding (object-contain, região inferior/direita) */}
      {sideViewSrc && !sideViewError ? (
        <div className="absolute -right-6 -bottom-4 w-72 h-36 opacity-35 pointer-events-none select-none transition-opacity duration-300">
          <img
            src={sideViewSrc}
            alt={`${teamName} Vista Lateral`}
            className="w-full h-full object-contain filter contrast-125"
            onError={() => setSideViewError(true)}
          />
        </div>
      ) : isAudi ? (
        <div className="absolute -right-10 -bottom-6 w-64 h-36 opacity-20 pointer-events-none select-none">
          <img
            src={audiCarGaragePng}
            alt="Audi F1 Car silhouette"
            className="w-full h-full object-contain filter grayscale contrast-125"
          />
        </div>
      ) : (
        /* Fallback limpo e elegante sem imagem quebrada */
        <div className="absolute -right-6 -bottom-6 w-56 h-28 opacity-10 pointer-events-none select-none flex items-center justify-center font-mono font-black text-6xl text-white/20 tracking-tighter uppercase">
          {teamKey || 'F1'}
        </div>
      )}

      {/* Conteúdo Superior: Badge da Montadora & Tagline */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
              Identidade & Branding
            </span>
          </div>
          <h4 className="text-lg font-black tracking-tight text-white font-serif mt-1">
            {teamName}
          </h4>
        </div>

        {/* Emblema / Logo da equipe */}
        {effectiveLogo ? (
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 p-2 flex items-center justify-center backdrop-blur-sm shrink-0">
            <img
              src={effectiveLogo}
              alt={`${teamName} Logo`}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                // Fallback gracioso se a imagem local ainda não existir fisicamente
                ;(e.currentTarget as HTMLElement).style.display = 'none'
              }}
            />
          </div>
        ) : isAudi ? (
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm shrink-0 overflow-hidden">
            <img
              src={audiEmblemJpg}
              alt="Audi Sport"
              className="w-full h-full object-cover opacity-80"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-sm text-neutral-400 font-mono shrink-0">
            {(teamKey || teamName || 'F1').substring(0, 3).toUpperCase()}
          </div>
        )}
      </div>

      {/* Conteúdo Inferior: Composição Limpa de UI */}
      <div className="relative z-10 pt-6">
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
