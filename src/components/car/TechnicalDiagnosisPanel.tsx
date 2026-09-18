import React from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Sliders,
  Maximize2,
  Gauge,
  CornerDownRight,
  TrendingUp,
} from 'lucide-react'

export interface DiagnosisItem {
  id: string
  label: string
  description: string
  badgeText: string
  badgeColor: 'red' | 'emerald' | 'amber' | 'blue'
  icon: React.ReactNode
}

export interface TechnicalDiagnosisPanelProps {
  items?: DiagnosisItem[]
}

const DEFAULT_DIAGNOSIS: DiagnosisItem[] = [
  {
    id: 'gargalo',
    label: 'Gargalo atual',
    description: 'Desgaste de pneus acima do ideal, afetando o ritmo em stints longos.',
    badgeText: 'ALTO',
    badgeColor: 'red',
    icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
  },
  {
    id: 'pontoForte',
    label: 'Ponto forte atual',
    description: 'Boa eficiência aerodinâmica, gerando carga estável com baixo arrasto.',
    badgeText: 'FORTE',
    badgeColor: 'emerald',
    icon: <ArrowUpRight className="w-4 h-4 text-emerald-500" />,
  },
  {
    id: 'sensibilidade',
    label: 'Sensibilidade do carro',
    description:
      'Ainda de acerto otimizado. Performance varia mais com pequenas mudanças de setup.',
    badgeText: 'MÉDIA',
    badgeColor: 'amber',
    icon: <Sliders className="w-4 h-4 text-amber-500" />,
  },
  {
    id: 'janelaAcerto',
    label: 'Janela de acerto',
    description:
      'Melhor performance entre 2 e +2 de asa dianteira. Fora dessa faixa há perda de equilíbrio.',
    badgeText: 'ESTREITA',
    badgeColor: 'amber',
    icon: <Maximize2 className="w-4 h-4 text-amber-500" />,
  },
  {
    id: 'eficienciaReta',
    label: 'Eficiência em reta',
    description:
      'Velocidade competitiva, mas atrás de McLaren e Red Bull em circuitos de alta carga.',
    badgeText: 'MÉDIA',
    badgeColor: 'amber',
    icon: <Gauge className="w-4 h-4 text-amber-500" />,
  },
  {
    id: 'curvasLentas',
    label: 'Curvas lentas',
    description: 'Boa tração e estabilidade mecânica. Entre os melhores do pelotão.',
    badgeText: 'FORTE',
    badgeColor: 'emerald',
    icon: <CornerDownRight className="w-4 h-4 text-emerald-500" />,
  },
  {
    id: 'curvasMedias',
    label: 'Curvas médias',
    description: 'Desempenho sólido e consistente em mudanças rápidas de direção.',
    badgeText: 'BOM',
    badgeColor: 'emerald',
    icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
  },
]

export const TechnicalDiagnosisPanel: React.FC<TechnicalDiagnosisPanelProps> = ({
  items = DEFAULT_DIAGNOSIS,
}) => {
  const getBadgeClasses = (color: 'red' | 'emerald' | 'amber' | 'blue') => {
    switch (color) {
      case 'red':
        return 'bg-red-50 text-red-600 border-red-200'
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'blue':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200'
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-900">🔬 Diagnóstico Técnico</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1">
          Principais insights da equipe de engenharia sobre o desempenho atual.
        </p>
      </div>

      {/* Lista de Diagnósticos com badges canônicos */}
      <div className="divide-y divide-slate-100 mt-2 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="pt-2 flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">{item.icon}</div>
              <div>
                <span className="font-bold text-slate-800 block">{item.label}</span>
                <span className="text-slate-500 text-[11px] leading-relaxed">
                  {item.description}
                </span>
              </div>
            </div>

            <span
              className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getBadgeClasses(
                item.badgeColor,
              )}`}
            >
              {item.badgeText}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TechnicalDiagnosisPanel
