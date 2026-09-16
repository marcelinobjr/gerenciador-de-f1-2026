import React from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Trophy, Award, Target, Flag } from 'lucide-react'

interface TeamHeroBannerProps {
  teamName: string
  tagline?: string
  bgImage: string
  constructorPosition: number
  constructorPoints: number
  reputation: number
  seasonTarget: string
  pointsProgress: { current: number; target: number }
  onOpenDetails?: () => void
}

export const TeamHeroBanner: React.FC<TeamHeroBannerProps> = ({
  teamName,
  tagline = 'Tecnologia. Pessoas. Performance.',
  bgImage,
  constructorPosition,
  constructorPoints,
  reputation,
  seasonTarget,
  pointsProgress,
  onOpenDetails,
}) => {
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((pointsProgress.current / Math.max(1, pointsProgress.target)) * 100)),
  )

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-sm border border-neutral-250 bg-black min-h-[220px] flex flex-col justify-end">
      {/* Background Image com overlay gradiente escuro profissional para leitura */}
      <img
        src={bgImage}
        alt={teamName}
        className="absolute inset-0 w-full h-full object-cover object-center opacity-85"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/30" />

      {/* Conteúdo sobreposto */}
      <div className="relative z-10 p-6 sm:p-7 flex flex-col justify-between h-full gap-5">
        <div>
          <div className="inline-block w-8 h-1 bg-[#E10600] rounded-full mb-2" />
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight uppercase font-sans">
            {teamName}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 font-medium tracking-wide mt-1">
            {tagline}
          </p>
        </div>

        {/* Métricas e Barra de Progresso */}
        <div className="space-y-3 max-w-2xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 items-end">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black text-white font-mono">
                  {constructorPosition}º
                </span>
                <span className="text-[11px] text-neutral-300 font-sans leading-tight">
                  no Campeonato de Construtores
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl sm:text-2xl font-black text-white font-mono">
                  {constructorPoints}
                </span>
                <span className="text-[11px] text-neutral-300 font-sans">pontos</span>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
                Reputação
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {reputation}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">
                Meta da temporada
              </div>
              <div className="text-base sm:text-lg font-bold text-white font-sans truncate">
                {seasonTarget}
              </div>
            </div>
          </div>

          {/* Barra de Progresso do Objetivo */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-neutral-200">Objetivo da temporada</span>
              <span className="text-neutral-300 font-mono text-[11px]">
                {pointsProgress.current} / {pointsProgress.target} pontos
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-neutral-800/80 overflow-hidden">
              <div
                className="h-full bg-[#E10600] rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
