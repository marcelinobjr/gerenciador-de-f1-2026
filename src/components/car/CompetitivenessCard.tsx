import React from 'react'
import { BarChart3 } from 'lucide-react'

export interface CompetitivenessCardProps {
  score: number
  aerodynamics: number
  powerUnit: number
  mechanics: number
  evolutionPotential: number
}

export const CompetitivenessCard: React.FC<CompetitivenessCardProps> = ({
  score,
  aerodynamics,
  powerUnit,
  mechanics,
  evolutionPotential,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
        <h3 className="text-sm font-bold text-slate-900">Índice de competitividade</h3>
      </div>

      <p className="text-[11px] text-slate-500 mt-2 mb-4">
        Desempenho geral em relação ao grid com base no pacote atual dos dois carros.
      </p>

      {/* Conteúdo: Radial Gauge + Detalhamento */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        {/* Radial Circle */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                stroke="#10B981"
                strokeWidth="3.5"
                strokeDasharray={`${score}, 100`}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-slate-900">{score}</span>
              <span className="text-[9px] font-semibold text-slate-500 font-mono -mt-0.5">
                de 100
              </span>
            </div>
          </div>
        </div>

        {/* Lista de índices reais */}
        <div className="sm:col-span-7 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600">Aerodinâmica</span>
            </div>
            <span className="font-bold font-mono text-slate-800">{aerodynamics}%</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-600">Unidade de potência</span>
            </div>
            <span className="font-bold font-mono text-slate-800">{powerUnit}%</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-600">Mecânica</span>
            </div>
            <span className="font-bold font-mono text-slate-800">{mechanics}%</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600">Potencial de evolução</span>
            </div>
            <span className="font-bold font-mono text-slate-800">{evolutionPotential}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompetitivenessCard
