/**
 * Modal de Criação de Projeto de P&D de Componente
 * IMPLEMENTAÇÃO Nº 4B — P&D DO CARRO (F1 Manager 2026)
 *
 * Fluxo de Novo Projeto:
 * Componente -> Objetivo Principal -> Prioridades/Trade-offs -> Abordagem (Escopo) -> Estimativa Imperfeita -> Confirmar
 */

import React, { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  TechnicalAttributeId,
  TechnicalComponentId,
  TECHNICAL_COMPONENT_METAS,
  TECHNICAL_ATTRIBUTE_METAS,
} from '@/types/car-technical-model'
import { DevelopmentScope } from '@/types/car-development'
import { carDevelopmentService } from '@/services/carDevelopmentService'
import { formatCurrency } from '@/lib/formatters'
import { TeamModel, DriverModel } from '@/types/f1'
import {
  Sparkles,
  AlertTriangle,
  Layers,
  Compass,
  Gauge,
  TrendingUp,
  Cpu,
  Clock,
  DollarSign,
  ShieldAlert,
} from 'lucide-react'

interface NewDevelopmentProjectModalProps {
  isOpen: boolean
  onClose: () => void
  team: TeamModel
  currentRound: number
  seasonYear: number
  drivers?: DriverModel[]
  onProjectCreated: () => void
}

const ALL_COMPONENTS: TechnicalComponentId[] = [
  'frontWing',
  'rearWing',
  'floor',
  'diffuser',
  'sidepods',
  'chassis',
  'suspension',
  'brakes',
]

export const NewDevelopmentProjectModal: React.FC<NewDevelopmentProjectModalProps> = ({
  isOpen,
  onClose,
  team,
  currentRound,
  seasonYear,
  drivers = [],
  onProjectCreated,
}) => {
  const [selectedComponent, setSelectedComponent] = useState<TechnicalComponentId>('floor')
  const [primaryGoal, setPrimaryGoal] = useState<TechnicalAttributeId>('fastCorner')
  const [secondaryGoals, setSecondaryGoals] = useState<TechnicalAttributeId[]>([])
  const [scope, setScope] = useState<DevelopmentScope>('balanced')
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Atributos influenciados canonicamente por este componente
  const influencedAttributes = useMemo(() => {
    return carDevelopmentService.getInfluencedAttributes(selectedComponent)
  }, [selectedComponent])

  // Ajusta o primaryGoal caso mude o componente
  React.useEffect(() => {
    if (influencedAttributes.length > 0 && !influencedAttributes.includes(primaryGoal)) {
      setPrimaryGoal(influencedAttributes[0])
      setSecondaryGoals([])
    }
  }, [selectedComponent, influencedAttributes, primaryGoal])

  // Alterna objetivo secundário (máximo 2)
  const toggleSecondaryGoal = (attr: TechnicalAttributeId) => {
    if (attr === primaryGoal) return
    if (secondaryGoals.includes(attr)) {
      setSecondaryGoals(secondaryGoals.filter((g) => g !== attr))
    } else {
      if (secondaryGoals.length < 2) {
        setSecondaryGoals([...secondaryGoals, attr])
      }
    }
  }

  // Previsão gerada pela Engenharia (imperfeita)
  const prediction = useMemo(() => {
    return carDevelopmentService.calculateProjectPrediction({
      team,
      componentId: selectedComponent,
      primaryObjective: primaryGoal,
      secondaryObjectives: secondaryGoals,
      scope,
      priority,
      drivers,
    })
  }, [team, selectedComponent, primaryGoal, secondaryGoals, scope, priority, drivers])

  // Custo estimado do projeto de P&D
  const estimatedCost = useMemo(() => {
    let cost = 1_500_000
    if (selectedComponent === 'chassis') cost = 2_800_000
    if (selectedComponent === 'floor') cost = 2_200_000
    if (selectedComponent === 'frontWing') cost = 1_200_000
    if (selectedComponent === 'rearWing') cost = 1_100_000
    if (selectedComponent === 'sidepods') cost = 1_500_000
    if (selectedComponent === 'diffuser') cost = 1_400_000
    if (selectedComponent === 'suspension') cost = 1_300_000
    if (selectedComponent === 'brakes') cost = 900_000

    if (scope === 'conservative') cost *= 0.75
    if (scope === 'aggressive') cost *= 1.45
    if (priority === 'urgent') cost *= 1.4
    if (priority === 'high') cost *= 1.15
    return Math.round(cost)
  }, [selectedComponent, scope, priority])

  const canAfford = (team.budget || 0) >= estimatedCost

  const handleStartProject = async () => {
    if (!canAfford || isSubmitting) return
    setIsSubmitting(true)
    try {
      const newProj = carDevelopmentService.createProject({
        team,
        seasonYear,
        currentRound,
        componentId: selectedComponent,
        primaryObjective: primaryGoal,
        secondaryObjectives: secondaryGoals,
        scope,
        priority,
        drivers,
      })

      const currentProjects = team.development_projects || []
      const updatedProjects = [...currentProjects, newProj]
      const newBudget = (team.budget || 0) - estimatedCost
      const newSpentCap = (team.cost_cap_spent || 0) + estimatedCost

      const { pb } = await import('@/lib/pocketbase/client')
      const { f1Service } = await import('@/services/f1Service')
      const { financialLedgerService } = await import('@/services/financialLedgerService')

      // Registro Canônico no Financial Ledger
      await financialLedgerService.postTransaction({
        teamId: team.id,
        seasonYear: seasonYear || 2026,
        round: currentRound,
        type: 'expense',
        category: 'development',
        subcategory: `rd_${selectedComponent}`,
        direction: 'outflow',
        amount: estimatedCost,
        costCapClassification: 'included',
        sourceSystem: 'car_development',
        sourceEntityId: newProj.id,
        idempotencyKey: `dev_project_${newProj.id}`,
        description: `P&D: Desenvolvimento de ${TECHNICAL_COMPONENT_METAS[selectedComponent]?.name || selectedComponent} (${scope})`,
      })

      await pb.collection('teams').update(team.id, {
        development_projects: updatedProjects,
        budget: newBudget,
        cost_cap_spent: newSpentCap,
      })

      await f1Service.addEvent(
        team.id,
        `🔬 P&D INICIADO: Novo projeto de ${TECHNICAL_COMPONENT_METAS[selectedComponent]?.name} focado em ${TECHNICAL_ATTRIBUTE_METAS[primaryGoal]?.name}. Investimento: ${formatCurrency(estimatedCost)}. Conclusão prevista: Rodada ${newProj.roundCompletedTarget}.`,
        'desenvolvimento',
      )

      onProjectCreated()
      onClose()
    } catch (err) {
      console.error('Erro ao iniciar projeto de P&D:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#090D15] border-[#1F2733] text-white">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-cyan-400 font-black uppercase tracking-widest block">
              DEPARTAMENTO DE ENGENHARIA & AERODINÂMICA
            </span>
          </div>
          <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            Iniciar Novo Projeto de P&D (Fase 4B)
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8B95A7]">
            Defina o componente, a meta física de projeto, o escopo e os recursos de engenharia. A
            estimativa apresentada reflete a capacidade atual da sua infraestrutura e traz incerteza
            técnica residual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* PASSO 1: Seleção de Componente */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-white flex items-center gap-1.5 uppercase">
              <Layers className="w-4 h-4 text-cyan-400" />
              1. Selecionar Componente Canônico ({ALL_COMPONENTS.length})
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_COMPONENTS.map((compId) => {
                const meta = TECHNICAL_COMPONENT_METAS[compId]
                const isSelected = selectedComponent === compId
                return (
                  <button
                    key={compId}
                    type="button"
                    onClick={() => setSelectedComponent(compId)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-400'
                        : 'bg-[#11161F] border-[#1F2733] hover:border-[#2C3849]'
                    }`}
                  >
                    <span className="text-xs font-bold block text-white">
                      {meta?.name || compId}
                    </span>
                    <span className="text-[10px] font-mono text-[#8B95A7] block mt-0.5">
                      {meta?.category === 'aero' ? 'Aerodinâmica' : 'Chassi/Dinâmica'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* PASSO 2: Objetivos de Projeto (Matriz Canônica Componente x Atributo) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-white flex items-center gap-1.5 uppercase">
                <Gauge className="w-4 h-4 text-cyan-400" />
                2. Objetivo Principal & Secundários
              </label>
              <span className="text-[11px] font-mono text-[#8B95A7]">
                Atributos fisicamente influenciados pela peça
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-3">
              <div>
                <span className="text-[11px] font-mono text-[#8B95A7] block mb-1.5">
                  OBJETIVO PRINCIPAL (Foco Máximo de Carga/Mecânica):
                </span>
                <div className="flex flex-wrap gap-2">
                  {influencedAttributes.map((attr) => {
                    const isSelected = primaryGoal === attr
                    return (
                      <Badge
                        key={attr}
                        onClick={() => {
                          setPrimaryGoal(attr)
                          setSecondaryGoals(secondaryGoals.filter((g) => g !== attr))
                        }}
                        className={`cursor-pointer px-3 py-1.5 text-xs font-mono font-bold transition-all ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                            : 'bg-[#0B0E14] text-[#8B95A7] border border-[#1F2733] hover:text-white'
                        }`}
                      >
                        {TECHNICAL_ATTRIBUTE_METAS[attr]?.name || attr}
                      </Badge>
                    )
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-mono text-[#8B95A7] block mb-1.5">
                  OBJETIVOS SECUNDÁRIOS OPCIONAIS (Dispersam parte do ganho máximo — até 2):
                </span>
                <div className="flex flex-wrap gap-2">
                  {influencedAttributes
                    .filter((attr) => attr !== primaryGoal)
                    .map((attr) => {
                      const isSec = secondaryGoals.includes(attr)
                      return (
                        <Badge
                          key={attr}
                          onClick={() => toggleSecondaryGoal(attr)}
                          className={`cursor-pointer px-2.5 py-1 text-xs font-mono transition-all ${
                            isSec
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                              : 'bg-[#0B0E14] text-[#8B95A7] border border-[#1F2733] hover:text-white'
                          }`}
                        >
                          {isSec ? '✓ ' : '+ '}
                          {TECHNICAL_ATTRIBUTE_METAS[attr]?.name || attr}
                        </Badge>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>

          {/* PASSO 3: Escopo e Abordagem */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-white flex items-center gap-1.5 uppercase">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              3. Abordagem de Projeto (Escopo Técnico)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Conservative */}
              <button
                type="button"
                onClick={() => setScope('conservative')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  scope === 'conservative'
                    ? 'bg-emerald-500/15 border-emerald-400 shadow-sm ring-1 ring-emerald-400'
                    : 'bg-[#11161F] border-[#1F2733] hover:border-[#2C3849]'
                }`}
              >
                <span className="text-xs font-bold text-emerald-400 block">Conservador</span>
                <span className="text-[11px] text-[#8B95A7] block mt-1 leading-relaxed">
                  Menor custo, prazo curto e risco mínimo de efeito colateral. Ganho moderado.
                </span>
              </button>

              {/* Balanced */}
              <button
                type="button"
                onClick={() => setScope('balanced')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  scope === 'balanced'
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-sm ring-1 ring-cyan-400'
                    : 'bg-[#11161F] border-[#1F2733] hover:border-[#2C3849]'
                }`}
              >
                <span className="text-xs font-bold text-cyan-400 block">Balanceado</span>
                <span className="text-[11px] text-[#8B95A7] block mt-1 leading-relaxed">
                  Equilíbrio entre ganho aero, custo de validação e tolerância a trade-offs.
                </span>
              </button>

              {/* Aggressive */}
              <button
                type="button"
                onClick={() => setScope('aggressive')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  scope === 'aggressive'
                    ? 'bg-amber-500/15 border-amber-400 shadow-sm ring-1 ring-amber-400'
                    : 'bg-[#11161F] border-[#1F2733] hover:border-[#2C3849]'
                }`}
              >
                <span className="text-xs font-bold text-amber-400 block">Agressivo</span>
                <span className="text-[11px] text-[#8B95A7] block mt-1 leading-relaxed">
                  Potencial elevado, maior custo, maior prazo e risco de efeitos colaterais.
                </span>
              </button>
            </div>
          </div>

          {/* PASSO 4: Prioridade de Recursos */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#11161F] border border-[#1F2733]">
            <div>
              <span className="text-xs font-bold text-white block">Prioridade de Recursos</span>
              <span className="text-[11px] text-[#8B95A7]">
                Urgência acelera o prazo ocupando mais capacidade de engenharia (+40% custo).
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {(['normal', 'high', 'urgent'] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={priority === p ? 'default' : 'outline'}
                  onClick={() => setPriority(p)}
                  className={`text-xs h-7 px-2.5 font-mono ${
                    priority === p
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'border-[#1F2733] text-[#8B95A7]'
                  }`}
                >
                  {p === 'normal' ? 'Normal' : p === 'high' ? 'Alta' : 'Urgente'}
                </Button>
              ))}
            </div>
          </div>

          {/* PASSO 5: Relatório de Estimativa Imperfeita da Engenharia */}
          <Card className="p-4 rounded-xl bg-[#080C14] border-2 border-cyan-500/40 space-y-3">
            <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
              <span className="text-xs font-mono font-bold text-cyan-400 flex items-center gap-1.5 uppercase">
                <Cpu className="w-4 h-4" />
                Diagnóstico Imperfeito da Engenharia
              </span>
              <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono">
                Confiança Técnica: {prediction.confidencePercent}%
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733]">
                <span className="text-[10px] text-[#8B95A7] block">Faixa de Ganho Estimada</span>
                <strong className="text-sm text-emerald-400">
                  +{prediction.minGain.toFixed(1)} a +{prediction.maxGain.toFixed(1)} pts
                </strong>
                <span className="text-[10px] text-[#8B95A7] block mt-0.5">
                  Esperado: ~+{prediction.expectedGain.toFixed(1)}
                </span>
              </div>

              <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733]">
                <span className="text-[10px] text-[#8B95A7] block">Prazo Estimado</span>
                <strong className="text-sm text-white flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  {prediction.estimatedDurationRounds} Rodada(s)
                </strong>
                <span className="text-[10px] text-[#8B95A7] block mt-0.5">
                  Entrega na Rodada {currentRound + prediction.estimatedDurationRounds}
                </span>
              </div>

              <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733]">
                <span className="text-[10px] text-[#8B95A7] block">Custo de P&D</span>
                <strong className="text-sm text-amber-400">{formatCurrency(estimatedCost)}</strong>
                <span className="text-[10px] text-[#8B95A7] block mt-0.5">Sob Cost Cap da FIA</span>
              </div>

              <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733]">
                <span className="text-[10px] text-[#8B95A7] block">Usinagem por Unidade</span>
                <strong className="text-sm text-[#F5F7FA]">
                  {formatCurrency(
                    carDevelopmentService.createProject({
                      team,
                      seasonYear,
                      currentRound,
                      componentId: selectedComponent,
                      primaryObjective: primaryGoal,
                      scope,
                    }).manufacturingCostPerUnitUsd,
                  )}
                </strong>
                <span className="text-[10px] text-[#8B95A7] block mt-0.5">Custo pós-aprovação</span>
              </div>
            </div>

            {/* Alerta de Riscos de Trade-offs */}
            {prediction.potentialRisks.length > 0 && (
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-amber-300 block">
                    Trade-offs Físicos Detectados pela Simulação:
                  </span>
                  {prediction.potentialRisks.map((r, idx) => (
                    <p key={idx} className="text-[#8B95A7] text-[11px] leading-relaxed">
                      • {TECHNICAL_ATTRIBUTE_METAS[r.attribute]?.name}: {r.description} (Impacto de{' '}
                      {r.minImpact} a {r.maxImpact})
                    </p>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <DialogFooter className="border-t border-[#1F2733] pt-3 flex items-center justify-between">
          <div className="text-xs font-mono">
            <span className="text-[#8B95A7]">Saldo da Equipe: </span>
            <strong className={canAfford ? 'text-emerald-400' : 'text-red-400'}>
              {formatCurrency(team.budget || 0)}
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="text-xs">
              Cancelar
            </Button>
            <Button
              onClick={handleStartProject}
              disabled={!canAfford || isSubmitting}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
            >
              {isSubmitting ? 'Iniciando Projeto...' : 'Aprovar Ordem de P&D'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
