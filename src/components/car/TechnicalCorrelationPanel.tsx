import React from 'react'
import { ArrowUpRight, CheckCircle2 } from 'lucide-react'

export interface CorrelationItem {
  label: string
  percentage: number
}

export interface TechnicalCorrelationPanelProps {
  windTunnelCorr?: number
  cfdCorr?: number
  trackCorr?: number
  lastUpdateName?: string
  lastUpdateStatus?: string
  qualiGain?: string
  raceGain?: string
  overallEfficiency?: number
  rdEfficiencyByArea?: { area: string; score: number }[]
  priorities?: string[]
}

const DEFAULT_RD_EFFICIENCY = [
  { area: 'Aerodinâmica', score: 82 },
  { area: 'Power Unit', score: 74 },
  { area: 'Chassi', score: 76 },
  { area: 'Suspensão', score: 71 },
  { area: 'Confiabilidade', score: 80 },
]

const DEFAULT_PRIORITIES = [
  'Reduzir arrasto nas seções de curva traseira (melhor acerto de asa e assoalho).',
  'Melhorar eficiência da asa dianteira (explorar nova geometria e flaps).',
  'Melhorar degradação de PU para Suzuka (ajustar mapa e estratégia de uso).',
]

export const TechnicalCorrelationPanel: React.FC<TechnicalCorrelationPanelProps> = ({
  windTunnelCorr = 85,
  cfdCorr = 82,
  trackCorr = 76,
  lastUpdateName = 'Pacote Aerodinâmico B',
  lastUpdateStatus = 'Positiva',
  qualiGain = '+0,450 s',
  raceGain = '+0,312 s',
  overallEfficiency = 69,
  rdEfficiencyByArea = DEFAULT_RD_EFFICIENCY,
  priorities = DEFAULT_PRIORITIES,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-900">
            📊 Correlação Técnica e Desenvolvimento
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Dados de correlação entre simulações e pista. Eficiência do programa de desenvolvimento.
        </p>
      </div>

      {/* Grid de 4 Colunas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3 pt-2">
        {/* Coluna 1: Correlação (Túnel / CFD / Pista) */}
        <div className="space-y-3 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
          <span className="text-[11px] font-bold text-slate-700 block">
            Correlação (Túnel / CFD / Pista)
          </span>

          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-600">Túnel de vento</span>
                <span className="font-bold font-mono text-slate-800">{windTunnelCorr}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${windTunnelCorr}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-600">CFD (Simulação)</span>
                <span className="font-bold font-mono text-slate-800">{cfdCorr}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${cfdCorr}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-600">Pista (Dados reais)</span>
                <span className="font-bold font-mono text-slate-800">{trackCorr}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{ width: `${trackCorr}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 2: Último pacote de atualizações */}
        <div className="space-y-2 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-slate-700 block">
            Último pacote de atualizações
          </span>

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-500 text-[11px]">{lastUpdateName}</span>
            <span className="flex items-center text-emerald-600 font-bold text-[10px]">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              {lastUpdateStatus}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
            <span className="text-slate-500 text-[11px]">Ganho em qualy:</span>
            <span className="font-mono font-bold text-emerald-600">{qualiGain}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">Ganho em corrida:</span>
            <span className="font-mono font-bold text-emerald-600">{raceGain}</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
            <span className="text-slate-500 text-[11px]">Eficiência:</span>
            <span className="font-mono font-bold text-slate-800">{overallEfficiency}%</span>
          </div>
        </div>

        {/* Coluna 3: Eficácia do P&D por área */}
        <div className="space-y-1.5 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-slate-700 block mb-1">
            Eficácia do P&D por área
          </span>

          {rdEfficiencyByArea.map((item) => (
            <div key={item.area} className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-600">{item.area}</span>
                <span className="font-bold font-mono text-slate-800">{item.score}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Coluna 4: Prioridades técnicas (próximas atualizações) */}
        <div className="space-y-2 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-slate-700 block">
            Prioridades técnicas (próximas atualizações)
          </span>

          <div className="space-y-2">
            {priorities.map((p, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-[11px]">
                <span className="w-4 h-4 rounded-full bg-slate-900 text-white font-mono text-[9px] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  {idx + 1}
                </span>
                <span className="text-slate-600 leading-tight">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TechnicalCorrelationPanel
