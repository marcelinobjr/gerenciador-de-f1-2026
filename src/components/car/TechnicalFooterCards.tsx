import React from 'react'
import { ArrowUpRight, Calendar, Info, ShieldCheck } from 'lucide-react'

export interface TechnicalFooterCardsProps {
  regulationYear?: number
  nextTechnicalUpdateRound?: number
  nextTechnicalUpdateTrack?: string
  engineeringRecommendations?: string
}

export const TechnicalFooterCards: React.FC<TechnicalFooterCardsProps> = ({
  regulationYear = 2026,
  nextTechnicalUpdateRound = 8,
  nextTechnicalUpdateTrack = 'GP da Espanha',
  engineeringRecommendations = 'Focar na redução de arrasto nas curvas de alta velocidade e na melhoria da estabilidade traseira com novos flaps de assoalho.',
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1: Impacto do Regulamento 2026 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
          <h4 className="text-xs font-bold text-slate-900">
            Impacto do Regulamento {regulationYear}
          </h4>
        </div>

        <p className="text-[11px] text-slate-500 mt-2 mb-3">
          Análise da preparação do carro para nova regulamentação e oportunidades de
          desenvolvimento.
        </p>

        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50/80 p-2 rounded-lg border border-emerald-100">
          <ArrowUpRight className="w-4 h-4 shrink-0 text-emerald-600" />
          <div>
            <span className="font-bold block">Estabilidade regulatória</span>
            <span className="text-[10px] text-emerald-800">
              Regulamento estável para a temporada. Foco total em performance.
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Próxima atualização técnica */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Calendar className="w-4 h-4 text-slate-700 shrink-0" />
          <h4 className="text-xs font-bold text-slate-900">Próxima atualização técnica</h4>
        </div>

        <p className="text-[11px] text-slate-500 mt-2 mb-3">
          Previsão de entrega do próximo pacote aerodinâmico na fábrica.
        </p>

        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
          <div className="font-bold text-slate-900">
            {nextTechnicalUpdateTrack} (Rodada {nextTechnicalUpdateRound})
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Novos componentes previstos: Revisão de assoalho e dutos de freio.
          </div>
        </div>
      </div>

      {/* Card 3: Recomendações da Engenharia */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Info className="w-4 h-4 text-red-600 shrink-0" />
          <h4 className="text-xs font-bold text-slate-900">Recomendações da Engenharia</h4>
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed mt-2 mb-2">
          {engineeringRecommendations}
        </p>

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <span className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer flex items-center">
            Ver plano detalhado →
          </span>
        </div>
      </div>
    </div>
  )
}

export default TechnicalFooterCards
