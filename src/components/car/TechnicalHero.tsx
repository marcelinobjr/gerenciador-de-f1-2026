import React from 'react'
import { TrendingUp } from 'lucide-react'
import { TeamModel } from '@/types/f1'
import { getTeamSideView } from '@/data/assets/teamAssets'
import { getCarroPorEquipeImage } from '@/assets/carroPorEquipe'

export interface TechnicalHeroProps {
  team: TeamModel | null
  technicalOverall: number
  competitivenessIndex: number
  structuralIntegrity: number
  globalReliability: number
}

export const TechnicalHero: React.FC<TechnicalHeroProps> = ({
  team,
  technicalOverall,
  competitivenessIndex,
  structuralIntegrity,
  globalReliability,
}) => {
  const teamKey = team?.team_key || team?.id || 'audi'
  const isCustom = Boolean(team?.is_custom)
  const carImage = getTeamSideView(teamKey) || getCarroPorEquipeImage(teamKey, isCustom)

  const teamName = team?.name || 'Audi Sport'
  const isAudi = teamName.toLowerCase().includes('audi')

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#070A0F] via-[#0E1524] to-[#070A0F] border border-white/10 shadow-2xl p-6 lg:p-8 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-600/10 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Identidade Técnica */}
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
            F1 TEAM // DRIVEN BY PROGRESS
          </div>

          <div className="pt-2">
            <span className="inline-block px-2.5 py-1 bg-red-600 text-white font-mono font-bold text-xs rounded">
              Área Técnica
            </span>
            <p className="text-xs text-slate-300 mt-2 font-mono">
              Dados, Engenharia, Performance real.
            </p>
          </div>
        </div>

        {/* Monoposto SideView Central */}
        <div className="lg:col-span-6 flex items-center justify-center relative">
          <div className="w-full max-w-xl h-44 sm:h-52 flex items-center justify-center relative px-2">
            <img
              src={carImage}
              alt={`${teamName} Monoposto Técnico`}
              className="max-h-full max-w-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)] transition-transform duration-500 hover:scale-105"
            />
          </div>
        </div>

        {/* 4 Métricas Canônicas da Área Técnica */}
        <div className="lg:col-span-3 grid grid-cols-2 gap-4 bg-black/40 backdrop-blur-md rounded-xl p-4 border border-white/10">
          {/* Overall Técnico */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Overall técnico</span>
              <span className="text-emerald-400 text-[10px] font-mono flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                +4
              </span>
            </div>
            <div className="text-2xl font-black text-white mt-0.5">{technicalOverall}</div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, technicalOverall)}%` }}
              />
            </div>
          </div>

          {/* Índice de Competitividade */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Índice competitividade</span>
              <span className="text-emerald-400 text-[10px] font-mono flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                +3
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">
              {competitivenessIndex}
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, competitivenessIndex)}%` }}
              />
            </div>
          </div>

          {/* Integridade Estrutural */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Integridade estrutural</span>
              <span className="text-emerald-400 text-[10px] font-mono flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                +2
              </span>
            </div>
            <div className="text-2xl font-black text-cyan-400 mt-0.5">{structuralIntegrity}</div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, structuralIntegrity)}%` }}
              />
            </div>
          </div>

          {/* Confiabilidade Global */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>Confiabilidade global</span>
              <span className="text-emerald-400 text-[10px] font-mono flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                +3
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">{globalReliability}</div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, globalReliability)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TechnicalHero
