import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  Cpu,
  Wind,
  Layers,
  Wrench,
  CheckCircle2,
} from 'lucide-react'

export interface EngineeringPriorityItem {
  id: string
  priorityNumber: 1 | 2 | 3
  priorityLabel: string
  title: string
  area: 'Aerodinâmica' | 'Unidade de Potência' | 'Chassis & Dinâmica' | 'Confiabilidade'
  impactLevel: 'Alto' | 'Médio' | 'Baixo'
  impactDescription: string
  rootCause: string
  suggestedAction: string
  developmentAreaTarget: string
}

export interface EngineeringPlanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigateToDevelopment?: (targetArea?: string) => void
  priorities?: EngineeringPriorityItem[]
}

const DEFAULT_PRIORITIES: EngineeringPriorityItem[] = [
  {
    id: 'p1',
    priorityNumber: 1,
    priorityLabel: 'Prioridade 1 — Maior Gargalo Técnico',
    title: 'Déficit de Eficiência em Alta Velocidade e Arrasto Aerodinâmico',
    area: 'Aerodinâmica',
    impactLevel: 'Alto',
    impactDescription:
      'Gargalo primário de tempo de volta nos setores de reta e curvas rápidas (perda estimada de ritmo em pistas de média-baixa carga).',
    rootCause:
      'Vórtices instáveis no bordo de ataque da asa dianteira combinados com túnel de venturi subdimensionado no assoalho.',
    suggestedAction:
      'Desenvolver pacote aerodinâmico focado em Assoalho Spec B e refinamento do flap da Asa Dianteira para estabilização de fluxo.',
    developmentAreaTarget: 'aerodynamics',
  },
  {
    id: 'p2',
    priorityNumber: 2,
    priorityLabel: 'Prioridade 2 — Segundo Maior Déficit',
    title: 'Curva de Degradação Térmica e Tração em Saída Lenta',
    area: 'Chassis & Dinâmica',
    impactLevel: 'Médio',
    impactDescription:
      'Aceleração comprometida na tração após freadas fortes, sobrecarregando o trem traseiro e elevando desgaste de pneus.',
    rootCause:
      'Geometria de suspensão traseira com rigidez excessiva no anti-squat e balanceamento de amortecimento assimétrico.',
    suggestedAction:
      'Projetar revisão estrutural da Suspensão Traseira e otimizar alocação de carga mecânica no túnel de vento.',
    developmentAreaTarget: 'chassis',
  },
  {
    id: 'p3',
    priorityNumber: 3,
    priorityLabel: 'Prioridade 3 — Oportunidade de Melhoria',
    title: 'Recuperação de Energia ERS & Eficiência do Turbo Híbrido',
    area: 'Unidade de Potência',
    impactLevel: 'Médio',
    impactDescription:
      'Clipping precoce de bateria no final de retas longas, deixando os pilotos vulneráveis a ultrapassagens.',
    rootCause:
      'Mapeamento de recuperação MGU-K conservador para preservar temperatura de célula na unidade de potência em uso.',
    suggestedAction:
      'Alocar ciclo de P&D em Gerenciamento Térmico de PU e introduzir unidade de potência fresca em rodadas de alto estresse térmico.',
    developmentAreaTarget: 'powertrain',
  },
]

export const EngineeringPlanModal: React.FC<EngineeringPlanModalProps> = ({
  open,
  onOpenChange,
  onNavigateToDevelopment,
  priorities = DEFAULT_PRIORITIES,
}) => {
  const getAreaIcon = (area: string) => {
    switch (area) {
      case 'Aerodinâmica':
        return <Wind className="w-4 h-4 text-sky-500" />
      case 'Unidade de Potência':
        return <Cpu className="w-4 h-4 text-red-500" />
      case 'Chassis & Dinâmica':
        return <Layers className="w-4 h-4 text-emerald-500" />
      default:
        return <Wrench className="w-4 h-4 text-amber-500" />
    }
  }

  const getImpactBadge = (level: 'Alto' | 'Médio' | 'Baixo') => {
    if (level === 'Alto') {
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-mono font-bold">
          Impacto Alto
        </Badge>
      )
    }
    if (level === 'Médio') {
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-mono font-bold">
          Impacto Médio
        </Badge>
      )
    }
    return (
      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-mono font-bold">
        Impacto Baixo
      </Badge>
    )
  }

  const hasPriorities = priorities && priorities.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border border-slate-200 p-0 overflow-hidden shadow-2xl rounded-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-100 text-red-700">
              <Lightbulb className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Recomendações da Engenharia — Plano Técnico Detalhado
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Diagnóstico gerado pela equipe de engenharia e operações de pista com base nas
                métricas atuais.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          {!hasPriorities ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-800">
                Nenhuma prioridade técnica crítica identificada no momento.
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                O carro apresenta equilíbrio aerodinâmico, mecânico e de trem de força dentro das
                tolerâncias projetadas.
              </p>
            </div>
          ) : (
            priorities.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all p-4.5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black font-mono text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                      P{item.priorityNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                      {getAreaIcon(item.area)}
                      <span>{item.area}</span>
                    </div>
                    {getImpactBadge(item.impactLevel)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-100 space-y-1">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span>Origem do Problema</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">{item.rootCause}</p>
                  </div>

                  <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-100 space-y-1">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-emerald-500" />
                      <span>Impacto Técnico Esperado</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      {item.impactDescription}
                    </p>
                  </div>
                </div>

                <div className="bg-red-50/40 p-3 rounded-lg border border-red-100/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 text-xs">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-red-700">
                      Ação Sugerida pela Engenharia:
                    </span>
                    <p className="text-slate-800 text-[11px] font-medium">{item.suggestedAction}</p>
                  </div>

                  {onNavigateToDevelopment && (
                    <Button
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        onNavigateToDevelopment(item.developmentAreaTarget)
                      }}
                      className="shrink-0 h-8 px-3 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <span>Ir para Desenvolvimento</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            * As recomendações orientam a fábrica; o ganho de tempo respeita o regulamento e custo
            limite.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
