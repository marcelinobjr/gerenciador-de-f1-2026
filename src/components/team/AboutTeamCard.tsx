import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Cpu, Flag, TrendingUp, ChevronRight } from 'lucide-react'

interface AboutTeamCardProps {
  baseLocation: string
  engineSupplier: string
  nationality: string
  status: string
  quote?: string
  onOpenDetails: () => void
}

export const AboutTeamCard: React.FC<AboutTeamCardProps> = ({
  baseLocation,
  engineSupplier,
  nationality,
  status,
  quote = '“Mais que uma equipe. Um futuro em movimento.”',
  onOpenDetails,
}) => {
  return (
    <Card className="bg-white border-neutral-200/80 shadow-sm rounded-2xl flex flex-col justify-between p-5 h-full">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 font-sans">
            Sobre a Equipe
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDetails}
            className="text-[11px] text-neutral-500 hover:text-neutral-900 font-semibold p-0 h-auto flex items-center gap-0.5"
          >
            VER DETALHES
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="space-y-3.5 py-3.5">
          {/* Base */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-neutral-400">Base</div>
              <div className="text-xs font-bold text-neutral-800 truncate">{baseLocation}</div>
            </div>
          </div>

          {/* Motor */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-neutral-400">Motor</div>
              <div className="text-xs font-bold text-neutral-800 truncate">{engineSupplier}</div>
            </div>
          </div>

          {/* Nacionalidade */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-neutral-400">
                Nacionalidade
              </div>
              <div className="text-xs font-bold text-neutral-800 truncate">{nationality}</div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-semibold text-neutral-400">Status</div>
              <div className="text-xs font-bold text-neutral-800 truncate">{status}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-neutral-100">
        <p className="text-xs italic text-neutral-500 font-serif leading-relaxed">{quote}</p>
      </div>
    </Card>
  )
}
