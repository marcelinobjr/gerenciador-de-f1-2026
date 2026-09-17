import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Cpu, Flag, Star, Target, ChevronRight } from 'lucide-react'

interface AboutTeamCardProps {
  baseLocation: string
  engineSupplier: string
  nationality: string
  status: string
  seasonTarget?: string
  teamLogoUrl?: string
  isAudi?: boolean
  onOpenDetails: () => void
}

export const AboutTeamCard: React.FC<AboutTeamCardProps> = ({
  baseLocation,
  engineSupplier,
  nationality,
  status,
  seasonTarget = 'Lutar por pódios',
  teamLogoUrl,
  isAudi = false,
  onOpenDetails,
}) => {
  return (
    <Card className="bg-[#10141C] border border-neutral-800 text-white rounded-2xl flex flex-col justify-between p-6 h-full shadow-lg">
      <div>
        {/* Header integrado com estilo da referência */}
        <div className="flex items-center justify-between pb-3.5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#E10600] rounded-sm inline-block" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-sans">
              Sobre a Equipe
            </h3>
          </div>

          {/* Emblema sutil no topo do card */}
          {isAudi ? (
            <div className="flex items-center -space-x-1 opacity-70">
              <span className="w-3.5 h-3.5 rounded-full border border-white/80 inline-block" />
              <span className="w-3.5 h-3.5 rounded-full border border-white/80 inline-block" />
              <span className="w-3.5 h-3.5 rounded-full border border-white/80 inline-block" />
              <span className="w-3.5 h-3.5 rounded-full border border-white/80 inline-block" />
            </div>
          ) : teamLogoUrl ? (
            <img
              src={teamLogoUrl}
              alt="Logo"
              className="h-4 max-w-[60px] object-contain opacity-70"
            />
          ) : null}
        </div>

        {/* Lista com ícones e valores conforme referência */}
        <div className="divide-y divide-neutral-800/80">
          {/* Base */}
          <div className="flex items-center justify-between py-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-400 font-medium">
              <MapPin className="w-3.5 h-3.5 text-neutral-400" />
              <span>Base</span>
            </div>
            <span
              className="font-semibold text-white text-right truncate max-w-[170px]"
              title={baseLocation}
            >
              {baseLocation}
            </span>
          </div>

          {/* Motor */}
          <div className="flex items-center justify-between py-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-400 font-medium">
              <Cpu className="w-3.5 h-3.5 text-neutral-400" />
              <span>Motor</span>
            </div>
            <span
              className="font-semibold text-white text-right truncate max-w-[170px]"
              title={engineSupplier}
            >
              {engineSupplier}
            </span>
          </div>

          {/* Nacionalidade */}
          <div className="flex items-center justify-between py-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-400 font-medium">
              <Flag className="w-3.5 h-3.5 text-neutral-400" />
              <span>Nacionalidade</span>
            </div>
            <span className="font-semibold text-white text-right truncate max-w-[170px]">
              {nationality}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between py-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-400 font-medium">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Status</span>
            </div>
            <span className="font-semibold text-neutral-200 text-right truncate max-w-[170px]">
              {status}
            </span>
          </div>

          {/* Objetivo da Temporada */}
          <div className="flex items-center justify-between py-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-400 font-medium">
              <Target className="w-3.5 h-3.5 text-neutral-400" />
              <span>Objetivo da Temporada</span>
            </div>
            <span
              className="font-semibold text-white text-right truncate max-w-[170px]"
              title={seasonTarget}
            >
              {seasonTarget}
            </span>
          </div>
        </div>
      </div>

      {/* Botão Editar Informações / Ver Detalhes */}
      <div className="pt-3 border-t border-neutral-800 mt-2 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenDetails}
          className="border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800 text-xs font-semibold text-white hover:text-white flex items-center gap-1.5 px-3 py-1.5 h-auto transition-colors"
        >
          <span>Editar Informações</span>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
        </Button>
      </div>
    </Card>
  )
}
