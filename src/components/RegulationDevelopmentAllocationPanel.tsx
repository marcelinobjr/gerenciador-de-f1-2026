import React, { useState, useEffect } from 'react'
import {
  Sliders,
  Sparkles,
  Layers,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Coins,
  Shield,
  BarChart2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  DevelopmentStrategyPreset,
  NextRegulationResearchProject,
  RegulationDevelopmentAllocation,
  RegulationPreparation,
  ResearchTargetDomain,
  CANONICAL_RESEARCH_TARGETS,
  TechnicalRegulation,
  formatPreparationStatusLabel,
} from '@/types/canonical-regulations'
import { TeamModel } from '@/types/f1'
import { regulationService } from '@/services/regulationService'
import { formatCurrency } from '@/lib/formatters'

interface RegulationDevelopmentAllocationPanelProps {
  team: TeamModel
  currentRound: number
  seasonYear: number
  futureRegulation: TechnicalRegulation | null
  onAllocationChanged?: () => void
}

export const RegulationDevelopmentAllocationPanel: React.FC<
  RegulationDevelopmentAllocationPanelProps
> = ({ team, currentRound, seasonYear, futureRegulation, onAllocationChanged }) => {
  const { toast } = useToast()
  const [allocation, setAllocation] = useState<RegulationDevelopmentAllocation | null>(null)
  const [preparation, setPreparation] = useState<RegulationPreparation | null>(null)
  const [researchProjects, setResearchProjects] = useState<NextRegulationResearchProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedTargetModal, setSelectedTargetModal] = useState<ResearchTargetDomain | null>(null)
  const [isStartingProject, setIsStartingProject] = useState(false)

  // Custom slider state
  const [customCurrentShare, setCustomCurrentShare] = useState(50)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!team?.id) return
      setIsLoading(true)
      try {
        const regId = futureRegulation?.regulationId || ''
        const [alloc, prep, projects] = await Promise.all([
          regulationService.getAllocation(team.id, regId),
          regId ? regulationService.getPreparation(team.id, regId, seasonYear, currentRound) : null,
          regId ? regulationService.getResearchProjects(team.id, regId) : [],
        ])
        if (!mounted) return
        setAllocation(alloc)
        setCustomCurrentShare(alloc.currentCarShare)
        setPreparation(prep)
        setResearchProjects(projects)
      } catch (e) {
        console.warn('Erro ao carregar alocação e pesquisa:', e)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [team?.id, futureRegulation?.regulationId, currentRound, seasonYear])

  if (!futureRegulation) {
    return null
  }

  const handleApplyPreset = async (preset: DevelopmentStrategyPreset, customVal?: number) => {
    if (!team?.id || isUpdating) return
    setIsUpdating(true)
    try {
      const updated = await regulationService.setAllocation({
        teamId: team.id,
        regulationId: futureRegulation.regulationId,
        strategy: preset,
        currentCarShare: customVal,
        currentRound,
      })
      setAllocation(updated)
      toast({
        title: 'Alocação de Desenvolvimento Atualizada!',
        description: `Estratégia definida para ${updated.selectedStrategy} a partir do GP atual (Round ${currentRound}).`,
      })
      onAllocationChanged?.()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na alocação',
        description: err?.message || 'Falha ao atualizar parâmetros de alocação.',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStartResearch = async (targetDomain: ResearchTargetDomain) => {
    if (!team?.id || isStartingProject) return
    setIsStartingProject(true)
    try {
      const res = await regulationService.startResearchProject({
        team,
        regulation: futureRegulation,
        targetDomain,
        currentSeasonYear: seasonYear,
        currentRound,
      })

      if (res.created) {
        toast({
          title: 'Projeto de Pesquisa Iniciado!',
          description: `Estudo de "${res.project.targetName}" iniciado no pipeline de P&D futuro.`,
        })
        const updatedProjects = await regulationService.getResearchProjects(
          team.id,
          futureRegulation.regulationId,
        )
        setResearchProjects(updatedProjects)
        setSelectedTargetModal(null)
        onAllocationChanged?.()
      } else {
        toast({
          variant: 'destructive',
          title: 'Não foi possível iniciar',
          description: res.errorMessage || 'Projeto bloqueado.',
        })
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro de engenharia',
        description: err?.message || 'Falha ao despachar ordem de pesquisa.',
      })
    } finally {
      setIsStartingProject(false)
    }
  }

  const currentShare = allocation?.currentCarShare ?? 75
  const futureShare = allocation?.futureRegulationShare ?? 25
  const selectedStrategy = allocation?.selectedStrategy ?? 'CURRENT_FOCUS'
  const prepStatus = preparation?.status ?? 'MINIMAL'

  return (
    <Card className="bg-[#090D15]/90 border-amber-500/30 overflow-hidden shadow-xl mb-6">
      <CardHeader className="p-4 sm:p-5 bg-gradient-to-r from-amber-950/30 via-[#0B0F19] to-cyan-950/20 border-b border-amber-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono uppercase">
                DIRETRIZ FIA {futureRegulation.effectiveSeason}
              </Badge>
              <span className="text-[10px] font-mono text-zinc-400">
                Entrada: {futureRegulation.effectiveSeason} ({futureRegulation.severity})
              </span>
            </div>
            <CardTitle className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              Alocação de Desenvolvimento: Carro Atual vs Regulamento Futuro
            </CardTitle>
            <p className="text-xs text-[#94A3B8] max-w-2xl leading-relaxed">
              O tempo da fábrica e dos projetistas é finito. Direcionar recursos para o novo
              regulamento reduz o volume de novas peças para o carro atual, mas constrói o
              conhecimento essencial para evitar fracassos no próximo ciclo.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="p-2.5 rounded-lg bg-[#111622] border border-[#1E293B] text-right font-mono">
              <span className="text-[9px] text-[#8B98A5] block uppercase">Preparação Técnica</span>
              <strong className="text-amber-300 text-xs sm:text-sm">
                {formatPreparationStatusLabel(prepStatus)}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-[#111622] border border-[#1E293B] text-right font-mono">
              <span className="text-[9px] text-[#8B98A5] block uppercase">
                Pesquisas Concluídas
              </span>
              <strong className="text-cyan-300 text-xs sm:text-sm">
                {preparation?.completedProjects.length || 0} / 8
              </strong>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-6">
        {/* BARRA VISUAL DE DIVISÃO DE CAPACIDADE */}
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
              <span className="text-cyan-300 font-bold">CARRO ATUAL: {currentShare}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-300 font-bold">PRÓXIMO REGULAMENTO: {futureShare}%</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            </div>
          </div>

          <div className="h-4 w-full rounded-full bg-black/60 overflow-hidden border border-white/10 flex p-0.5 gap-0.5">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-l-full transition-all duration-300"
              style={{ width: `${currentShare}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-r-full transition-all duration-300"
              style={{ width: `${futureShare}%` }}
            />
          </div>

          {/* EFEITO QUALITATIVO DA DECISÃO */}
          <div className="p-3 rounded-xl bg-[#0D121D] border border-[#1C2638] text-xs text-[#CBD5E1] flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="leading-relaxed">
                {currentShare >= 70 ? (
                  <>
                    <strong className="text-cyan-300">Foco Prioritário no Carro Atual:</strong>{' '}
                    Maior throughput de engenharia para novas asas, assoalho e revisões mecânicas
                    imediatas no campeonato. A preparação para o regulamento de{' '}
                    {futureRegulation.effectiveSeason} será lenta e baseada em estudos mínimos.
                  </>
                ) : currentShare <= 35 ? (
                  <>
                    <strong className="text-amber-300">Foco Agressivo no Futuro:</strong> Parte
                    substancial da equipe técnica e dos clusters CFD foi transferida para o novo
                    conceito. O throughput de peças para as etapas restantes do ano atual será
                    severamente desacelerado.
                  </>
                ) : (
                  <>
                    <strong className="text-white">Divisão Equilibrada:</strong> Esforço técnico
                    compartilhado igualmente. Permite sustentar a competitividade média do monoposto
                    vigente enquanto mapeia com antecedência as diretrizes aeromecânicas da nova
                    era.
                  </>
                )}
              </p>
              <span className="text-[10px] font-mono text-[#8B98A5] block mt-1">
                Efeito ativo a partir do GP {allocation?.effectiveRound || currentRound}. Mudanças
                de alocação nunca alteram retrospectivamente pesquisas concluídas em rodadas
                anteriores.
              </span>
            </div>
          </div>
        </div>

        {/* BOTÕES DE PRESET */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleApplyPreset('CURRENT_FOCUS')}
            className={`p-3 h-auto flex flex-col items-center text-center font-mono transition-all border ${
              selectedStrategy === 'CURRENT_FOCUS'
                ? 'bg-cyan-500/20 border-cyan-400 text-white'
                : 'bg-[#101522] border-[#1E293B] text-[#94A3B8] hover:text-white'
            }`}
          >
            <span className="text-xs font-black">CURRENT FOCUS</span>
            <span className="text-[10px] text-cyan-300 mt-0.5">75% Carro / 25% Futuro</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleApplyPreset('BALANCED')}
            className={`p-3 h-auto flex flex-col items-center text-center font-mono transition-all border ${
              selectedStrategy === 'BALANCED'
                ? 'bg-emerald-500/20 border-emerald-400 text-white'
                : 'bg-[#101522] border-[#1E293B] text-[#94A3B8] hover:text-white'
            }`}
          >
            <span className="text-xs font-black">BALANCED</span>
            <span className="text-[10px] text-emerald-300 mt-0.5">50% / 50% Balanceado</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleApplyPreset('FUTURE_FOCUS')}
            className={`p-3 h-auto flex flex-col items-center text-center font-mono transition-all border ${
              selectedStrategy === 'FUTURE_FOCUS'
                ? 'bg-amber-500/20 border-amber-400 text-white'
                : 'bg-[#101522] border-[#1E293B] text-[#94A3B8] hover:text-white'
            }`}
          >
            <span className="text-xs font-black">FUTURE FOCUS</span>
            <span className="text-[10px] text-amber-300 mt-0.5">25% Carro / 75% Futuro</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isUpdating}
            onClick={() => handleApplyPreset('CUSTOM', customCurrentShare)}
            className={`p-3 h-auto flex flex-col items-center text-center font-mono transition-all border ${
              selectedStrategy === 'CUSTOM'
                ? 'bg-purple-500/20 border-purple-400 text-white'
                : 'bg-[#101522] border-[#1E293B] text-[#94A3B8] hover:text-white'
            }`}
          >
            <span className="text-xs font-black">CUSTOM</span>
            <span className="text-[10px] text-purple-300 mt-0.5">
              {customCurrentShare}% / {100 - customCurrentShare}%
            </span>
          </Button>
        </div>

        {/* MATRIZ DE PROJETOS DE PESQUISA (NEXT_REGULATION_RESEARCH) */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 font-mono uppercase">
              <FlaskConical className="w-4 h-4 text-amber-400" />
              Projetos de Pesquisa Regulatória (Conhecimento Preliminar)
            </h4>
            <span className="text-[11px] font-mono text-[#8B98A5]">
              Reduz incerteza conceitual • Sem ganho imediato de volta
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(CANONICAL_RESEARCH_TARGETS).map(([targetKey, meta]) => {
              const domainKey = targetKey as ResearchTargetDomain
              const existing = researchProjects.find((p) => p.targetDomain === domainKey)
              const isCompleted = existing?.status === 'completed'
              const isInProgress = existing?.status === 'in_progress'

              return (
                <div
                  key={domainKey}
                  className={`p-3 rounded-xl border flex flex-col justify-between space-y-2.5 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : isInProgress
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-[#0E131E] border-[#1E273A] hover:border-white/20'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase">
                        {meta.mappedDomain}
                      </span>
                      {isCompleted ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-mono">
                          CONCLUÍDO
                        </Badge>
                      ) : isInProgress ? (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-mono">
                          R{existing.roundCompletedTarget}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] font-mono text-zinc-400">
                          DISPONÍVEL
                        </Badge>
                      )}
                    </div>

                    <h5 className="font-bold text-xs text-white leading-tight">{meta.name}</h5>
                    <p className="text-[11px] text-[#8B98A5] line-clamp-2 leading-relaxed">
                      {meta.description}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/5 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-[#8B98A5]">
                      <span>Custo Pesquisa:</span>
                      <strong className="text-white">{formatCurrency(meta.baseCostUsd)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[#8B98A5]">
                      <span>Duração Estimada:</span>
                      <span className="text-zinc-200">{meta.baseDurationRounds} GPs</span>
                    </div>

                    {isCompleted ? (
                      <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px] text-center font-bold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Know-how Consolidado</span>
                      </div>
                    ) : isInProgress ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-amber-300">
                          <span>Progresso</span>
                          <span>{existing.progressPercent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${existing.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isStartingProject}
                        onClick={() => setSelectedTargetModal(domainKey)}
                        className="w-full text-xs h-7 bg-amber-600 hover:bg-amber-500 text-white font-bold"
                      >
                        Iniciar Pesquisa
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>

      {/* MODAL DE CONFIRMAÇÃO DE PESQUISA */}
      <Dialog
        open={!!selectedTargetModal}
        onOpenChange={(open) => !open && setSelectedTargetModal(null)}
      >
        <DialogContent className="max-w-md bg-[#0B0F19] border border-[#20293D] text-white p-5 rounded-2xl">
          {selectedTargetModal &&
            (() => {
              const meta = CANONICAL_RESEARCH_TARGETS[selectedTargetModal]
              return (
                <div className="space-y-4">
                  <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-mono">
                        NEXT REGULATION RESEARCH
                      </Badge>
                    </div>
                    <DialogTitle className="text-base font-bold text-white font-mono">
                      {meta.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-[#8B98A5]">
                      {meta.description}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-2 p-3 rounded-xl bg-[#111624] border border-[#1F293D] font-mono text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#8B98A5]">Custo do Estudo:</span>
                      <strong className="text-emerald-400">
                        {formatCurrency(meta.baseCostUsd)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8B98A5]">Enquadramento Cost Cap:</span>
                      <strong className="text-zinc-200">Included (Teto de P&D 5A)</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8B98A5]">Tempo de Simulação:</span>
                      <strong className="text-amber-300">{meta.baseDurationRounds} GPs</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8B98A5]">Staff Responsável:</span>
                      <span className="text-cyan-300">{meta.requiredStaffRole}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[11px] text-[#CBD5E1] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p>
                      Aviso Técnico: Esta pesquisa não adiciona pontos de velocidade ao carro de{' '}
                      {seasonYear}. Ela mitiga incertezas de projeto para o futuro regulamento de{' '}
                      {futureRegulation.effectiveSeason}.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTargetModal(null)}
                      className="bg-[#121826] border-[#20293D] text-white hover:bg-[#1A2234] text-xs font-mono"
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      disabled={isStartingProject}
                      onClick={() => handleStartResearch(selectedTargetModal)}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs font-mono"
                    >
                      {isStartingProject ? 'Processando...' : 'Confirmar e Iniciar'}
                    </Button>
                  </div>
                </div>
              )
            })()}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
