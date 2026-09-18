import React from 'react'
import { ShieldCheck } from 'lucide-react'

export interface StructuralIntegrityCardProps {
  overallIntegrity: number
  chassisCondition?: number
  survivalCellCondition?: number
  fixingPointsCondition?: number
  generalStructureCondition?: number
}

export const StructuralIntegrityCard: React.FC<StructuralIntegrityCardProps> = ({
  overallIntegrity,
  chassisCondition = 92,
  survivalCellCondition = 88,
  fixingPointsCondition = 81,
  generalStructureCondition = 87,
}) => {
  // Cores dinâmicas para o anel de status
  const ringColor =
    overallIntegrity >= 80 ? '#10B981' : overallIntegrity >= 60 ? '#F59E0B' : '#EF4444'

  const statusText =
    overallIntegrity >= 80 ? 'Estrutura OK' : overallIntegrity >= 60 ? 'Atenção' : 'Crítico'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <h3 className="text-sm font-bold text-slate-900">Integridade estrutural</h3>
      </div>

      <p className="text-[11px] text-slate-500 mt-2 mb-4">
        Condição do chassi, célula de sobrevivência e pontos de fixação.
      </p>

      {/* Conteúdo: Radial Gauge + Detalhamento */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        {/* Radial Circle */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* SVG Donut */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                stroke={ringColor}
                strokeWidth="3.5"
                strokeDasharray={`${overallIntegrity}, 100`}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-slate-900">{overallIntegrity}%</span>
              <span className="text-[9px] font-semibold text-emerald-600 font-mono -mt-0.5">
                {statusText}
              </span>
            </div>
          </div>
        </div>

        {/* Lista de subcomponentes */}
        <div className="sm:col-span-7 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600">Chassi</span>
            </div>
            <span className="font-bold font-mono text-slate-800">{chassisCondition}%</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600">Célula de sobrevivência</span>
            </div>
            <span className="font-bold font-mono text-slate-800">{survivalCellCondition}%</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-600">Pontos de fixação</span>
            </div>
            <span className="font-bold font-mono text-slate-800">{fixingPointsCondition}%</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600">Estrutura geral</span>
            </div>
            <span className="font-bold font-mono text-slate-800">{generalStructureCondition}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StructuralIntegrityCard
