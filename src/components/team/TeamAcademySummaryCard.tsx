import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GraduationCap, ChevronRight, Trophy, Star } from 'lucide-react'

export interface AcademyHighlightPilot {
  id?: string
  name: string
  nationality?: string
  series: string
  potential: number
  photoUrl?: string
}

interface TeamAcademySummaryCardProps {
  totalInAcademy: number
  f2Count: number
  f3Count: number
  highlightPilot?: AcademyHighlightPilot | null
  onOpenAcademy?: () => void
}

export const TeamAcademySummaryCard: React.FC<TeamAcademySummaryCardProps> = ({
  totalInAcademy,
  f2Count,
  f3Count,
  highlightPilot,
  onOpenAcademy,
}) => {
  return (
    <Card className="bg-white border-neutral-200/90 shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full">
      <div>
        {/* Cabeçalho */}
        <div className="flex items-start justify-between pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-neutral-900 font-sans block">
                Academia de Pilotos
              </span>
              <span className="text-[11px] text-neutral-400 font-medium block">
                O futuro da equipe nas categorias de base.
              </span>
            </div>
          </div>
          {onOpenAcademy && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenAcademy}
              className="text-[11px] text-[#E10600] hover:text-[#B00500] hover:bg-red-50/50 font-bold p-0 h-auto flex items-center gap-0.5 shrink-0"
            >
              Ver base
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Números da Academia */}
        <div className="grid grid-cols-3 gap-2.5 py-3 border-b border-neutral-100">
          <div className="p-2.5 rounded-xl bg-neutral-50/90 border border-neutral-100 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block font-mono">
              Total
            </span>
            <span className="font-mono font-black text-lg text-neutral-900 block leading-tight mt-0.5">
              {totalInAcademy}
            </span>
            <span className="text-[10px] text-neutral-500 font-medium">Jovens</span>
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-50/90 border border-neutral-100 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block font-mono">
              Fórmula 2
            </span>
            <span className="font-mono font-black text-lg text-blue-600 block leading-tight mt-0.5">
              {f2Count}
            </span>
            <span className="text-[10px] text-neutral-500 font-medium">Pilotos</span>
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-50/90 border border-neutral-100 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block font-mono">
              Fórmula 3
            </span>
            <span className="font-mono font-black text-lg text-amber-600 block leading-tight mt-0.5">
              {f3Count}
            </span>
            <span className="text-[10px] text-neutral-500 font-medium">Pilotos</span>
          </div>
        </div>

        {/* Piloto em Destaque */}
        {highlightPilot ? (
          <div
            onClick={onOpenAcademy}
            className="pt-3 flex items-center justify-between gap-3 cursor-pointer group hover:opacity-95 transition-opacity"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center shrink-0">
                {highlightPilot.photoUrl ? (
                  <img
                    src={highlightPilot.photoUrl}
                    alt={highlightPilot.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Trophy className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-red-50 text-[#E10600]">
                    {highlightPilot.series}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-medium">Destaque</span>
                </div>
                <div className="font-bold text-xs text-neutral-900 truncate group-hover:text-[#E10600] transition-colors mt-0.5">
                  {highlightPilot.name}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[9px] uppercase font-bold text-neutral-400 block font-mono leading-none">
                POTENCIAL
              </span>
              <span className="font-mono font-black text-sm text-emerald-600 leading-tight flex items-center justify-end gap-0.5">
                <Star className="w-3 h-3 fill-emerald-500 text-emerald-500 inline" />
                {highlightPilot.potential}
              </span>
            </div>
          </div>
        ) : (
          <div className="pt-4 text-center text-xs text-neutral-400 font-medium">
            Nenhum jovem talento vinculado atualmente.
          </div>
        )}
      </div>
    </Card>
  )
}
