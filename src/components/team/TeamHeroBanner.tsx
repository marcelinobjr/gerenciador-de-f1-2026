import React from 'react'
import { TeamCrest } from '@/components/ui/TeamCrest'

interface TeamHeroBannerProps {
  teamName: string
  teamKey?: string
  subheading?: string
  bgImage: string
  constructorPosition: number | string
  constructorPoints: number
  reputation: number
  seasonTarget: string
  pointsProgress: { current: number; target: number }
  teamLogoUrl?: string
  isAudi?: boolean
}

export const TeamHeroBanner: React.FC<TeamHeroBannerProps> = ({
  teamName,
  subheading = 'Pessoas. Estrutura. Cultura. Performance.',
  bgImage,
  constructorPosition,
  constructorPoints,
  reputation,
  seasonTarget,
  pointsProgress,
  teamLogoUrl,
  isAudi = false,
}) => {
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((pointsProgress.current / Math.max(1, pointsProgress.target)) * 100)),
  )

  const formattedRank =
    typeof constructorPosition === 'number' && constructorPosition > 0
      ? `${constructorPosition}º`
      : constructorPosition || '—'

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-sm border border-[#E2E8F0] bg-white text-[#0F172A] min-h-[340px] flex flex-col justify-between p-6 sm:p-8 isolate">
      {/* Background Cinematográfico translúcido claro */}
      <img
        src={bgImage}
        alt={teamName}
        className="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-15 sm:opacity-20 pointer-events-none select-none transition-transform duration-700 hover:scale-105"
      />
      {/* Gradientes claros suaves preservando leitura e visual moderno */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-white via-white/85 to-transparent pointer-events-none" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-white via-transparent to-white/40 pointer-events-none" />

      {/* Topo do Hero: Linha vermelha de performance + Marca + Citação */}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          {/* Label superior com traço vermelho */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-[3px] bg-[#E10600] rounded-full inline-block" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#64748B] font-mono">
              {teamName}
            </span>
          </div>

          {/* Título Principal */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] tracking-tight font-sans uppercase">
            Minha Equipe
          </h1>

          {/* Subtítulo prescrito */}
          <p className="text-xs sm:text-sm text-[#475569] font-medium tracking-wide mt-1">
            {subheading}
          </p>
        </div>

        {/* Canto direito do hero: emblema da equipe ou 4 anéis Audi estilizados + citação esportiva */}
        <div className="hidden md:flex flex-col items-end text-right">
          <div className="flex items-center gap-2 mb-1.5 opacity-90">
            <TeamCrest
              team={teamKey || teamName}
              teamName={teamName}
              size="xl"
              className="h-10 w-auto min-w-[40px]"
            />
          </div>
          <p className="text-[11px] font-serif italic text-[#64748B] max-w-[260px] leading-tight">
            &ldquo;Mais do que uma equipe, uma mentalidade.&rdquo;
          </p>
          <span className="text-[10px] font-bold tracking-wider text-[#E10600] uppercase font-mono mt-0.5">
            {teamName}
          </span>
        </div>
      </div>

      {/* Base do Hero: Métricas Reais + Barra de Progresso da Meta */}
      <div className="relative z-10 space-y-4 pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6 items-end">
          {/* Posição no Campeonato de Construtores */}
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0F172A] font-mono tracking-tight">
                {formattedRank}
              </span>
              <span className="text-[11px] sm:text-xs text-[#64748B] font-medium leading-tight">
                no Campeonato de Construtores
              </span>
            </div>
          </div>

          {/* Pontos da Temporada */}
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0F172A] font-mono tracking-tight">
                {constructorPoints}
              </span>
              <span className="text-[11px] sm:text-xs text-[#64748B] font-medium">pontos</span>
            </div>
          </div>

          {/* Reputação */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#64748B] font-bold font-mono">
              Reputação
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0F172A] font-mono tracking-tight">
              {reputation}
            </div>
          </div>

          {/* Meta da Temporada */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#64748B] font-bold font-mono">
              Meta da temporada
            </div>
            <div
              className="text-sm sm:text-base lg:text-lg font-bold text-[#0F172A] font-sans truncate"
              title={seasonTarget}
            >
              {seasonTarget}
            </div>
          </div>
        </div>

        {/* Barra de Progresso: Objetivo da temporada */}
        <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#475569]">Objetivo da temporada</span>
            <span className="text-[#64748B] font-mono text-[11px]">
              {pointsProgress.current} / {pointsProgress.target} pontos
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden border border-[#E2E8F0]">
            <div
              className="h-full bg-[#E10600] rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
