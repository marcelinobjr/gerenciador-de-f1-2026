/**
 * Painel Canônico de Engenharia e P&D do Carro (Fase 4B)
 * F1 Manager 2026
 *
 * Seções:
 * 1. Indicador de Capacidade de Engenharia & Throughput (ocupado vs disponível)
 * 2. Pipeline de Projetos Ativos de P&D (Concept, Simulation, Validation, Design, Approved)
 * 3. Catálogo Histórico de Design / Specs de Peças (Spec A, Spec B, Spec C...)
 * 4. Ordens de Manufatura de Peças Físicas & Instalação por Carro (Carro 1 / Carro 2)
 */

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ProgressBar'
import {
  DevelopmentProject,
  CanonicalComponentSpec,
  ManufacturingOrder,
} from '@/types/car-development'
import {
  TECHNICAL_COMPONENT_METAS,
  TECHNICAL_ATTRIBUTE_METAS,
  TechnicalComponentId,
  TechnicalAttributeId,
} from '@/types/car-technical-model'
import { carDevelopmentService } from '@/services/carDevelopmentService'
import { formatCurrency } from '@/lib/formatters'
import { TeamModel, DriverModel, PartModel } from '@/types/f1'
import pb from '@/lib/pocketbase/client'
import { f1Service } from '@/services/f1Service'
import { useToast } from '@/hooks/use-toast'
import {
  FlaskConical,
  Layers,
  Wrench,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  Cpu,
  Car,
} from 'lucide-react'
import { NewDevelopmentProjectModal } from './NewDevelopmentProjectModal'
import { RegulationDevelopmentAllocationPanel } from '@/components/RegulationDevelopmentAllocationPanel'

interface CarDevelopmentSectionProps {
  team: TeamModel
  currentRound: number
  seasonYear: number
  parts: PartModel[]
  drivers?: DriverModel[]
  onRefresh: () => void
}

export const CarDevelopmentSection: React.FC<CarDevelopmentSectionProps> = ({
  team,
  currentRound,
  seasonYear,
  parts,
  drivers = [],
  onRefresh,
}) => {
  const { toast } = useToast()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Status de capacidade de engenharia da equipe
  // Carregamento de regulamento futuro para alocação 8C.2
  const [futureRegulation, setFutureRegulation] = React.useState<any | null>(null)
  React.useEffect(() => {
    let mounted = true
    const checkRegs = async () => {
      try {
        const { regulationTimelineService } = await import('@/services/regulationService')
        const tState = await regulationTimelineService.getTimeline(team.id, seasonYear)
        const futureRegs = regulationTimelineService.getFutureRegulations(tState, seasonYear)
        if (mounted && futureRegs.length > 0) {
          setFutureRegulation(futureRegs[0])
        }
      } catch {
        // tolerância
      }
    }
    checkRegs()
    return () => {
      mounted = false
    }
  }, [team.id, seasonYear])

  const capacityStatus = carDevelopmentService.getEngineeringCapacityStatus(team)

  const projects: DevelopmentProject[] = team.development_projects || []
  const activeProjects = projects.filter((p) => p.status === 'in_progress')
  const completedProjects = projects.filter(
    (p) => p.status === 'completed' || p.status === 'ready_for_manufacturing',
  )

  const specs: CanonicalComponentSpec[] = team.component_specs || []
  const orders: ManufacturingOrder[] = team.manufacturing_orders || []

  // Helper para rótulo legível de estágio
  const getStageBadge = (stage: DevelopmentProject['stage']) => {
    switch (stage) {
      case 'concept':
        return (
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
            1. Conceito
          </Badge>
        )
      case 'simulation':
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">2. CFD Cluster</Badge>
        )
      case 'validation':
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
            3. Túnel de Vento
          </Badge>
        )
      case 'design':
        return (
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">4. Desenho CAD</Badge>
        )
      case 'approved':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
            5. Spec Aprovada
          </Badge>
        )
      default:
        return <Badge variant="outline">{stage}</Badge>
    }
  }

  // 1. Criar Ordem de Fabricação de Peça Física a partir de uma Spec aprovada
  const handleOrderManufacturing = async (
    spec: CanonicalComponentSpec,
    quantity: number,
    targetCar: 'car1' | 'car2' | 'both_split' | 'stock',
  ) => {
    const totalCost = spec.manufacturingCostUsd * quantity
    if ((team.budget || 0) < totalCost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `A manufatura de ${quantity} unidade(s) de ${spec.specName} exige ${formatCurrency(totalCost)}.`,
      })
      return
    }

    setIsProcessing(true)
    try {
      const order = carDevelopmentService.createManufacturingOrder({
        team,
        spec,
        quantity,
        currentRound,
        targetCarAssignment: targetCar,
      })

      const updatedOrders = [...(team.manufacturing_orders || []), order]

      // Registro Canônico no Financial Ledger (Idempotência e rastreabilidade — syncTeamBudgetCache atualiza o cache)
      const { financialLedgerService } = await import('@/services/financialLedgerService')
      await financialLedgerService.postTransaction({
        teamId: team.id,
        seasonYear: seasonYear || 2026,
        round: currentRound,
        type: 'expense',
        category: 'manufacturing',
        subcategory: `manufacture_${spec.componentId}`,
        direction: 'outflow',
        amount: totalCost,
        costCapClassification: 'included',
        sourceSystem: 'manufacturing_order',
        sourceEntityId: order.orderId,
        idempotencyKey: `mfg_order_${order.orderId}`,
        description: `Manufatura de ${quantity}x ${spec.specName} (${targetCar})`,
      })

      // Atualiza ordens de manufatura na equipe (o budget e cost_cap_spent foram sincronizados canonicamente pelo ledger)
      await pb.collection('teams').update(team.id, {
        manufacturing_orders: updatedOrders,
      })

      await f1Service.addEvent(
        team.id,
        `🏭 MANUFATURA: Ordem aberta para ${quantity} unidade(s) de ${spec.specName}. Entrega prevista para Rodada ${order.roundTarget}. Investimento: ${formatCurrency(totalCost)}.`,
        'desenvolvimento',
      )

      toast({
        title: 'Ordem de Manufatura Aberta',
        description: `${quantity} unidade(s) física(s) encomendadas para a fábrica. Conclusão na Rodada ${order.roundTarget}.`,
      })

      onRefresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao abrir manufatura',
        description: err?.message || 'Falha na comunicação com o backend.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // 2. Instalar Spec Física no Carro 1 ou Carro 2
  const handleInstallSpecOnCar = async (
    spec: CanonicalComponentSpec,
    carTarget: 'car1' | 'car2' | 'both',
  ) => {
    setIsProcessing(true)
    try {
      // 1. Atualiza as peças físicas na coleção `parts`
      const currentParts = await f1Service.getTeamParts(team.id)
      const updatedParts = carDevelopmentService.generatePartsFromSpecInstall({
        teamId: team.id,
        spec,
        targetCar: carTarget,
        existingParts: currentParts,
      })

      // Salva cada peça física modificada
      for (const part of updatedParts) {
        if (part.id && !part.id.startsWith('part_')) {
          await pb.collection('parts').update(part.id, part)
        } else {
          // Cria caso seja nova
          await pb.collection('parts').create(part)
        }
      }

      // 2. Atualiza o rating do componente e os 12 atributos no time (recalculados canonicamente)
      const existingRatings = { ...(team.component_ratings || {}) }
      existingRatings[spec.componentId] = spec.baseRating

      const { carTechnicalService } = await import('@/services/carTechnicalService')
      const newAttributes = carTechnicalService.calculateAttributesFromComponents(
        existingRatings as any,
        (team.engine_supplier || 'Audi') as any,
      )
      const newOverall = carTechnicalService.calculateCarOverall(newAttributes)

      // Atualiza o time
      await pb.collection('teams').update(team.id, {
        component_ratings: existingRatings,
        technical_attributes: newAttributes,
        calculated_overall: newOverall,
      })

      await f1Service.addEvent(
        team.id,
        `🏎️ PEÇA INSTALADA: ${spec.specName} instalada fisicamente em ${carTarget === 'both' ? 'ambos os monopostos' : carTarget === 'car1' ? 'Carro #1' : 'Carro #2'}. Rating do componente: ${spec.baseRating}. Novo Chassis Rating: ${newOverall}.`,
        'desenvolvimento',
      )

      toast({
        title: 'Instalação Física Homologada!',
        description: `${spec.specName} instalada no ${carTarget === 'both' ? 'Carro 1 e Carro 2' : carTarget === 'car1' ? 'Carro 1' : 'Carro 2'}. O desempenho na pista já reflete a nova Spec!`,
      })

      onRefresh()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na Instalação',
        description: err?.message || 'Falha ao instalar nova Spec.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* PAINEL DE ALOCAÇÃO DE DESENVOLVIMENTO 8C.2 (CARRO ATUAL VS PRÓXIMO REGULAMENTO) */}
      {futureRegulation && (
        <RegulationDevelopmentAllocationPanel
          team={team}
          currentRound={currentRound}
          seasonYear={seasonYear}
          futureRegulation={futureRegulation}
          onAllocationChanged={onRefresh}
        />
      )}

      {/* HEADER DA SEÇÃO & CONTROLE DE CAPACIDADE DE ENGENHARIA */}
      <div className="p-4 rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400">
              CICLO CANÔNICO DE P&D DO CARRO // FASE 4B
            </span>
          </div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-cyan-400" />
            Engenharia, Simulação CFD, Validação & Manufatura
          </h3>
          <p className="text-xs text-[#8B95A7] max-w-2xl">
            {capacityStatus.explanation} Investir compra recursos e tentativas — não compra
            resultado garantido. Um projeto só altera o carro após a fabricação da peça física e sua
            instalação.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono text-xs hidden sm:block">
            <span className="text-[10px] text-[#8B95A7] block">Slots de Projeto</span>
            <strong className="text-white text-sm">
              {capacityStatus.activeProjectsCount} / {capacityStatus.maxConcurrentProjects} Ativos
            </strong>
          </div>

          <Button
            onClick={() => setIsModalOpen(true)}
            disabled={!capacityStatus.canStartNewProject}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs h-9 px-4 flex items-center gap-2 shadow-md shadow-cyan-600/20"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto de P&D
          </Button>
        </div>
      </div>

      {/* BLOCO DE PROJETOS ATIVOS NO PIPELINE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#1F2733] pb-1.5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Projetos Ativos no Pipeline de P&D ({activeProjects.length})
          </h4>
          <span className="text-xs font-mono text-[#8B95A7]">
            Avanço automático a cada rodada concluída no calendário
          </span>
        </div>

        {activeProjects.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#090D15]/60 border border-[#1F2733] text-center space-y-2">
            <FlaskConical className="w-8 h-8 text-[#8B95A7] mx-auto opacity-50" />
            <h5 className="text-sm font-bold text-[#F5F7FA]">Nenhum Projeto de P&D em Andamento</h5>
            <p className="text-xs text-[#8B95A7] max-w-md mx-auto">
              Sua equipe de engenharia e os túneis de vento estão ociosos. Clique em "Novo Projeto
              de P&D" para conceber e simular novas peças para os 8 componentes canônicos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeProjects.map((p) => {
              const compMeta = TECHNICAL_COMPONENT_METAS[p.componentId]
              const primMeta = TECHNICAL_ATTRIBUTE_METAS[p.primaryObjective]
              return (
                <Card
                  key={p.id}
                  className="bg-[#090D15]/85 border-[#1F2733] p-4 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-sm text-white">
                            {compMeta?.name || p.componentId}
                          </h5>
                          {getStageBadge(p.stage)}
                        </div>
                        <span className="text-[10px] font-mono text-[#8B95A7]">
                          Foco: <strong className="text-cyan-400">{primMeta?.name}</strong> •
                          Abordagem: {p.scope}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono text-[#8B95A7]">
                        Entrega: R{p.roundCompletedTarget}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <ProgressBar
                        value={p.progressPercent}
                        max={100}
                        label="PROGRESSO DO CICLO"
                        size="sm"
                        valueFormatter={(v) => `${v}%`}
                      />
                    </div>

                    {/* Previsão Imperfeita Exibida */}
                    <div className="p-2.5 rounded-lg bg-[#11161F] border border-[#1F2733] grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-[#8B95A7] block">Faixa Estimada</span>
                        <strong className="text-emerald-400">
                          +{p.prediction.minGain} a +{p.prediction.maxGain} pts
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#8B95A7] block">Confiança Técnica</span>
                        <strong className="text-cyan-400">{p.prediction.confidencePercent}%</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#1F2733] flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8B95A7]">
                      Custo: <strong className="text-white">{formatCurrency(p.costUsd)}</strong>
                    </span>
                    <span className="text-[10px] text-[#8B95A7]">
                      {p.roundCompletedTarget - currentRound > 0
                        ? `Restam ${p.roundCompletedTarget - currentRound} rodada(s)`
                        : 'Finalizando simulação na próxima etapa'}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* BLOCO DE ORDENS DE MANUFATURA & PEÇAS PRONTAS */}
      {orders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[#1F2733] pb-1.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-cyan-400" />
              Ordens de Manufatura de Peças Físicas ({orders.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orders.map((ord) => {
              const compMeta = TECHNICAL_COMPONENT_METAS[ord.componentId]
              const isCompleted = ord.status === 'completed'
              return (
                <div
                  key={ord.orderId}
                  className="p-3.5 rounded-xl bg-[#090D15]/85 border border-[#1F2733] flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">
                        {compMeta?.name || ord.componentId}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          isCompleted
                            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                            : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                        }
                      >
                        {isCompleted ? 'Peça Pronta' : 'Em Usinagem'}
                      </Badge>
                    </div>
                    <span className="text-[11px] font-mono text-[#8B95A7] block">
                      Quantidade: {ord.quantity} unidade(s) física(s)
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#1F2733] flex items-center justify-between text-xs font-mono">
                    <span className="text-[#8B95A7]">
                      {isCompleted ? 'Disponível no Estoque' : `Entrega: R${ord.roundTarget}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* BLOCO DE ESPECIFICAÇÕES APROVADAS (DESIGN / SPECS A, B, C...) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#1F2733] pb-1.5">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Catálogo Histórico de Design / Especificações de Peças ({specs.length})
          </h4>
          <span className="text-xs font-mono text-[#8B95A7]">
            Todas as gerações homologadas são preservadas para rollback ou comparação
          </span>
        </div>

        {specs.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#090D15]/60 border border-[#1F2733] text-center space-y-1">
            <span className="text-xs text-[#8B95A7]">
              Nenhuma nova Spec projetada ainda nesta temporada. Conclua um projeto de P&D para
              homologar uma Spec B ou C.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {specs.map((s) => {
              const compMeta = TECHNICAL_COMPONENT_METAS[s.componentId]
              return (
                <Card
                  key={s.specId}
                  className="bg-[#090D15]/85 border-[#1F2733] p-4 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-bold text-sm text-white">{s.specName}</h5>
                          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] font-mono">
                            Gen {s.generation}
                          </Badge>
                        </div>
                        <span className="text-[10px] font-mono text-[#8B95A7]">
                          Rating Intrínseco do Componente:{' '}
                          <strong className="text-white">{s.baseRating}</strong>
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-emerald-500/40 text-emerald-400"
                      >
                        Homologada FIA
                      </Badge>
                    </div>

                    <p className="text-xs text-[#8B95A7] leading-relaxed">
                      Trade-offs & Balanço: {s.tradeOffsSummary}
                    </p>

                    <div className="p-2 rounded-lg bg-[#11161F] border border-[#1F2733] flex items-center justify-between text-xs font-mono">
                      <span className="text-[#8B95A7]">Usinagem por unidade:</span>
                      <strong className="text-white">
                        {formatCurrency(s.manufacturingCostUsd)}
                      </strong>
                    </div>
                  </div>

                  {/* Ações: Fabricar Unidades e Instalar nos Carros */}
                  <div className="pt-2 border-t border-[#1F2733] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => handleOrderManufacturing(s, 1, 'stock')}
                        className="text-xs h-7 px-2 border-[#1F2733] text-cyan-400 hover:bg-cyan-500/10"
                      >
                        Fabricar 1 Peça
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => handleOrderManufacturing(s, 2, 'both_split')}
                        className="text-xs h-7 px-2 border-[#1F2733] text-cyan-400 hover:bg-cyan-500/10"
                      >
                        Fabricar Par (2x)
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleInstallSpecOnCar(s, 'car1')}
                        className="text-xs h-7 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                      >
                        Instalar no Carro 1
                      </Button>
                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleInstallSpecOnCar(s, 'both')}
                        className="text-xs h-7 px-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold"
                      >
                        Instalar nos 2
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Criação de Projeto */}
      <NewDevelopmentProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        team={team}
        currentRound={currentRound}
        seasonYear={seasonYear}
        drivers={drivers}
        onProjectCreated={() => {
          onRefresh()
        }}
      />
    </div>
  )
}
