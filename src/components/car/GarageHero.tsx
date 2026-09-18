import React from 'react'
import { CheckCircle2, TrendingUp } from 'lucide-react'
import { TeamModel } from '@/types/f1'
import { getTeamSideView } from '@/data/assets/teamAssets'
import { getCarroPorEquipeImage } from '@/assets/carroPorEquipe'
import { F1_2026_CALENDAR } from '@/lib/f1-data'

export interface GarageHeroProps {
  team: TeamModel | null
  currentRound?: number
  fleetOverall: number
  reliability: number
  averageWear: number
  partsAvailability: number
}

export const GarageHero: React.FC<GarageHeroProps> = ({
  team,
  currentRound = 1,
  fleetOverall,
  reliability,
  averageWear,
  partsAvailability,
}) => {
  const teamKey = team?.team_key || team?.id || 'audi'
  const isCustom = Boolean(team?.is_custom)

  // Sideview com fallback limpo centralizado
  const carImage = getTeamSideView(teamKey) || getCarroPorEquipeImage(teamKey, isCustom)

  // Próxima corrida a partir do calendário canônico
  const nextGp = F1_2026_CALENDAR.find((gp) => gp.round === currentRound) || F1_2026_CALENDAR[0]

  const teamName = team?.name || 'Audi Sport'
  const isAudi = teamName.toLowerCase().includes('audi')

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#070A0F] via-[#0E1524] to-[#070A0F] border border-white/10 shadow-2xl p-6 lg:p-8 text-white">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-600/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Identidade da Equipe */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center gap-2">
            {isAudi ? (
              <div className="flex items-center -space-x-1">
                <span className="w-4 h-4 rounded-full border-2 border-white/90" />
                <span className="w-4 h-4 rounded-full border-2 border-white/90" />
                <span className="w-4 h-4 rounded-full border-2 border-white/90" />
                <span className="w-4 h-4 rounded-full border-2 border-white/90" />
              </div>
            ) : (
              <div
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: team?.color || '#E10600' }}
              />
            )}
            <span className="text-xl font-black tracking-tight uppercase">{teamName}</span>
          </div>

          <div className="text-[11px] font-mono tracking-widest text-slate-400 uppercase">
            F1 TEAM // GARAGE OPERATIONS
          </div>

          <p className="text-xs text-slate-300 italic">Tecnologia. Performance. Pessoas.</p>

          <div className="pt-2 flex items-center gap-2 text-[11px] text-red-400 font-mono">
            <span className="w-1.5 h-3 bg-red-600 rounded-sm inline-block" />
            <span>Do asfalto para um futuro mais rápido.</span>
          </div>
        </div>

        {/* Monoposto SideView Central */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center relative">
          <div className="w-full max-w-xl h-44 sm:h-52 flex items-center justify-center relative px-2">
            <img
              src={carImage}
              alt={`${teamName} Monoposto 2026`}
              className="max-h-full max-w-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)] transition-transform duration-500 hover:scale-105"
            />
          </div>

          {/* Status da Garagem e Próxima Corrida */}
          <div className="flex flex-wrap items-center justify-between w-full max-w-xl px-2 pt-2 border-t border-white/10 text-xs gap-3">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Garagem pronta para {nextGp?.circuit || nextGp?.name || 'Suzuka'}</span>
              <span className="hidden sm:inline text-slate-400 font-normal">
                • Ambos os carros preparados e operacionais.
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300 shrink-0">
              <span className="text-slate-400">PRÓXIMA CORRIDA:</span>
              <span className="text-white font-bold">{nextGp?.name}</span>
              <span className="text-xs">{nextGp?.flag}</span>
            </div>
          </div>
        </div>

        {/* Métricas do Carro / Frota */}
        <div className="lg:col-span-3 grid grid-cols-2 gap-4 bg-black/40 backdrop-blur-md rounded-xl p-4 border border-white/10">
          {/* Overall */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Overall da frota</span>
              <span className="text-emerald-400 text-[10px] font-mono flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                +4
              </span>
            </div>
            <div className="text-2xl font-black text-white mt-0.5">{fleetOverall}</div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, fleetOverall)}%` }}
              />
            </div>
          </div>

          {/* Confiabilidade */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Confiabilidade</span>
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">{reliability}%</div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, reliability)}%` }}
              />
            </div>
          </div>

          {/* Desgaste Médio */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Desgaste médio</span>
            </div>
            <div className="text-2xl font-black text-amber-400 mt-0.5">{averageWear}%</div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, averageWear)}%` }}
              />
            </div>
          </div>

          {/* Disponibilidade de peças */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Disp. peças</span>
            </div>
            <div className="text-2xl font-black text-cyan-400 mt-0.5">{partsAvailability}%</div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, partsAvailability)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GarageHero
