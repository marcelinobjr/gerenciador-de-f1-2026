import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { PartModel, SponsorModel } from '@/types/f1'
import { ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { CarBlueprint } from '@/components/CarBlueprint'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import {
  Wrench,
  Cpu,
  Zap,
  Gauge,
  CheckCircle,
  AlertTriangle,
  Info,
  Flame,
  Layers,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Sliders,
  Activity,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

export default function CarPage() {
  const { team, refreshTeamAndSeason } = useAuth()

  const [parts, setParts] = useState<PartModel[]>([])
  const [sponsors, setSponsors] = useState<SponsorModel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [upgradingPartId, setUpgradingPartId] = useState<string | null>(null)
  const [repairingPartId, setRepairingPartId] = useState<string | null>(null)

  const loadParts = async () => {
    if (!team) {
      setLoading(false)
      return
    }
    try {
      const [pList, spList] = await Promise.all([
        f1Service.getTeamParts(team.id),
        f1Service.getTeamSponsors(team.id),
      ])
      setParts(pList)
      setSponsors(spList)

      // Auto-select first part if none selected
      if (!selectedPartId && pList.length > 0) {
        setSelectedPartId(pList[0].id)
      }
    } catch (err) {
      console.error('Error loading parts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadParts()
  }, [team?.id])

  useRealtime('parts', () => {
    loadParts()
  })

  // Selected Part object
  const selectedPart = useMemo(() => {
    if (!selectedPartId) return parts[0] || null
    return parts.find((p) => p.id === selectedPartId) || parts[0] || null
  }, [parts, selectedPartId])

  // Current engine spec
  const currentEngine = useMemo(() => {
    const sName = team?.engine_supplier || 'Mercedes'
    return ENGINE_SUPPLIERS.find((s) => s.name === sName) || ENGINE_SUPPLIERS[1]
  }, [team?.engine_supplier])

  // Overall Car Rating calculation & Parts average condition
  const { overallLevel, partsAverage, averageCondition } = useMemo(() => {
    if (parts.length === 0) {
      return { overallLevel: 75, partsAverage: 5, averageCondition: 100 }
    }
    const sumLevel = parts.reduce((acc, p) => acc + p.level, 0)
    const sumCondition = parts.reduce((acc, p) => acc + (p.condition ?? 100), 0)
    const avg = sumLevel / parts.length // 0 to 10
    const avgCond = Math.round(sumCondition / parts.length)

    // Base performance score
    const partsScore = avg * 10
    const engineScore = currentEngine.power
    let overall = Math.round(partsScore * 0.6 + engineScore * 0.4)

    // If wear is below 60%, apply real-time penalty to the overall performance rating
    if (avgCond < 60) {
      const penalty = Math.round((60 - avgCond) * 0.25)
      overall = Math.max(20, overall - penalty)
    }

    return {
      overallLevel: overall,
      partsAverage: Number(avg.toFixed(1)),
      averageCondition: avgCond,
    }
  }, [parts, currentEngine])

  // Upgrade part cost calculation
  const getUpgradeCost = (currentLevel: number) => {
    return Math.round(4000000 + currentLevel * 1500000)
  }

  // Handle invest / upgrade part
  const handleUpgradePart = async (part: PartModel) => {
    if (!team) return
    if (part.level >= 10) {
      toast({
        title: 'Componente no Nível Máximo!',
        description: `${part.name} já atingiu o nível 10 permitido pelas regras FIA 2026.`,
      })
      return
    }

    const cost = getUpgradeCost(part.level)
    if (team.budget < cost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `Você precisa de ${formatCurrency(cost)} para investir em ${part.name}. Saldo: ${formatCurrency(team.budget)}.`,
      })
      return
    }

    setUpgradingPartId(part.id)
    try {
      const newLevel = part.level + 1
      const newBudget = team.budget - cost

      await Promise.all([
        f1Service.updatePart(part.id, { level: newLevel }),
        f1Service.updateTeam(team.id, { budget: newBudget }),
        f1Service.addEvent(
          team.id,
          `P&D: ${part.name} aprimorado para o Nível ${newLevel} por ${formatCurrency(cost)}.`,
          'desenvolvimento',
        ),
      ])

      toast({
        title: 'Aprimoramento Concluído!',
        description: `${part.name} subiu para o nível ${newLevel}/10. Desempenho aerodinâmico/mecânico melhorado.`,
      })

      refreshTeamAndSeason()
      loadParts()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro no Aprimoramento',
        description: err?.message || 'Falha ao processar upgrade de peça.',
      })
    } finally {
      setUpgradingPartId(null)
    }
  }

  // Handle repair / overhaul part
  const handleRepairPart = async (part: PartModel) => {
    if (!team) return
    const currentCond = part.condition ?? 100
    if (currentCond >= 100) {
      toast({
        title: 'Peça em Perfeitas Condições',
        description: `${part.name} já está com 100% de integridade estrutural. Nenhuma revisão necessária.`,
      })
      return
    }

    const cost = f1Service.getPartRepairCost(part)
    if (team.budget < cost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente para Oficina',
        description: `A revisão estrutural de ${part.name} exige ${formatCurrency(cost)}. Saldo atual: ${formatCurrency(team.budget)}.`,
      })
      return
    }

    setRepairingPartId(part.id)
    try {
      const newBudget = team.budget - cost
      await Promise.all([
        f1Service.repairPart(part.id),
        f1Service.updateTeam(team.id, { budget: newBudget }),
        f1Service.addEvent(
          team.id,
          `Oficina: ${part.name} passou por revisão completa e retornou a 100% de integridade (Custo: ${formatCurrency(cost)}).`,
          'desenvolvimento',
        ),
      ])

      toast({
        title: 'Revisão Concluída!',
        description: `${part.name} foi inspecionada por ultrassom e restaurada para 100% de integridade.`,
      })

      refreshTeamAndSeason()
      loadParts()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro no Reparo',
        description: err?.message || 'Falha ao reparar componente.',
      })
    } finally {
      setRepairingPartId(null)
    }
  }

  // Switch engine supplier handler
  const handleSwitchSupplier = async () => {
    if (!selectedSupplier || !team) return
    const penaltyFee = 15000000 // R$ 15M troca de motor
    if (team.budget < penaltyFee) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `A rescisão e adaptação de chassi exige ${formatCurrency(penaltyFee)}.`,
      })
      return
    }

    setIsProcessing(true)
    try {
      const newBudget = team.budget - penaltyFee
      await f1Service.updateTeam(team.id, {
        engine_supplier: selectedSupplier.name,
        budget: newBudget,
      })

      await f1Service.addEvent(
        team.id,
        `Fornecedor de unidade de potência trocado para ${selectedSupplier.name} (Custo: ${formatCurrency(penaltyFee)}).`,
        'desenvolvimento',
      )

      toast({
        title: 'Fornecedor de Motor Atualizado!',
        description: `A equipe agora é impulsionada pela unidade ${selectedSupplier.name} 50/50 Híbrida.`,
      })

      setSelectedSupplier(null)
      refreshTeamAndSeason()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na troca de motor',
        description: err?.message || 'Falha ao alterar fornecedor.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Helper condition color and badge text
  const getConditionInfo = (cond: number = 100) => {
    if (cond >= 80) {
      return {
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400',
        barColor: 'from-emerald-500 to-teal-400',
        status: 'Excelente / Operacional',
        risk: 'Risco de falha desprezível (<1%)',
      }
    }
    if (cond >= 50) {
      return {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/40 text-amber-400',
        barColor: 'from-amber-500 to-yellow-400',
        status: 'Desgaste Moderado',
        risk: 'Pequena perda de downforce / eficiência',
      }
    }
    return {
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/40 text-red-400',
      barColor: 'from-red-600 to-rose-400',
      status: 'Crítico / Fissura Estrutural',
      risk: 'Alto risco de quebra mecânica / DNF na corrida!',
    }
  }

  const selectedCondInfo = selectedPart ? getConditionInfo(selectedPart.condition ?? 100) : null
  const selectedRepairCost = selectedPart ? f1Service.getPartRepairCost(selectedPart) : 0
  const selectedUpgradeCost = selectedPart ? getUpgradeCost(selectedPart.level) : 0
  const isSelectedMax = selectedPart ? selectedPart.level >= 10 : false

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-[#00A6FB] uppercase flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-[#00A6FB]" />
            Engenharia & Blueprint Técnico Oficial
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA] mt-1">
            Monoposto 2026 // Arquitetura & Componentes
          </h1>
          <p className="text-sm text-[#8B95A7] mt-0.5">
            Interaja com o blueprint milimetrado, monitore o desgaste estrutural após cada GP e
            repare ou aprimore as 6 peças homologadas.
          </p>
        </div>

        {/* Global Condition Alert pill */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`font-mono text-xs px-3 py-1.5 flex items-center gap-2 ${
              averageCondition >= 80
                ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                : averageCondition >= 60
                  ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                  : 'border-red-500/50 text-red-400 bg-red-500/10 animate-pulse'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Integridade Média: {averageCondition}%</span>
          </Badge>
        </div>
      </div>

      {/* COMPONENTE BLUEPRINT TÉCNICO INTERATIVO */}
      <CarBlueprint
        teamColor={team?.color || '#E10600'}
        teamName={team?.name || 'Sua Escuderia'}
        sponsors={sponsors}
        carLevel={overallLevel}
        parts={parts}
        selectedPartId={selectedPartId}
        onSelectPart={(id) => setSelectedPartId(id)}
      />

      {/* PAINEL DE INSPEÇÃO DA PEÇA SELECIONADA + RESUMO DE PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card: Painel de Inspeção da Peça Clicada */}
        <Card className="lg:col-span-2 bg-[#11161F] border-[#1F2733] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-bl-full pointer-events-none" />

          <CardHeader className="pb-3 border-b border-[#1F2733]/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest">
                  Telemetria & Diagnóstico de Oficina
                </span>
                <CardTitle className="text-xl font-extrabold text-[#F5F7FA] flex items-center gap-2.5 mt-0.5">
                  <Wrench className="w-5 h-5 text-cyan-400" />
                  {selectedPart ? selectedPart.name : 'Selecione uma peça'}
                </CardTitle>
              </div>

              {selectedPart && selectedCondInfo && (
                <Badge variant="outline" className={`font-mono text-xs ${selectedCondInfo.bg}`}>
                  {selectedCondInfo.status}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-[#8B95A7]">
              Inspecione a fadiga metálica acumulada por voltas e decida entre desenvolver um novo
              nível ou revisar a peça na oficina.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-5 space-y-6">
            {selectedPart && selectedCondInfo ? (
              <>
                {/* Métricas: Nível + Condição */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bloco 1: Nível & Potencial Técnico */}
                  <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#8B95A7] font-mono uppercase">
                        Nível Homologado FIA
                      </span>
                      <span className="text-xs font-mono font-bold text-cyan-400">
                        NÍVEL {selectedPart.level} / 10
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="h-2.5 w-full bg-[#1F2733] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-[#E10600] transition-all duration-300"
                          style={{ width: `${(selectedPart.level / 10) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                        <span>0 (Padrão)</span>
                        <span>5 (Intermediário)</span>
                        <span>10 (Topo)</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#8B95A7] leading-relaxed">
                      Contribuição aerodinâmica/mecânica direta: cada nível adiciona{' '}
                      <strong className="text-[#F5F7FA]">+1,0 pt</strong> ao índice geral de
                      competitividade nas 24 etapas.
                    </p>
                  </div>

                  {/* Bloco 2: Condição / Desgaste Físico */}
                  <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#8B95A7] font-mono uppercase">
                        Integridade Estrutural
                      </span>
                      <span className={`text-xs font-mono font-bold ${selectedCondInfo.color}`}>
                        {selectedPart.condition ?? 100}% OPERACIONAL
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="h-2.5 w-full bg-[#1F2733] rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${selectedCondInfo.barColor} transition-all duration-300`}
                          style={{ width: `${selectedPart.condition ?? 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                        <span className="text-red-400">&lt;50% Crítico</span>
                        <span className="text-amber-400">50-79% Moderado</span>
                        <span className="text-emerald-400">80-100% Ótimo</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-[11px] font-mono">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                          (selectedPart.condition ?? 100) < 60 ? 'text-red-400' : 'text-slate-400'
                        }`}
                      />
                      <span className="text-[#8B95A7] leading-relaxed">
                        {selectedCondInfo.risk}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bloco de Ações: Desenvolver Nova Peça vs Reparar/Revisar */}
                <div className="p-4 rounded-xl bg-[#090D16] border border-cyan-500/20 space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Ações de Engenharia para {selectedPart.name}
                    </span>
                    <span className="text-[#8B95A7]">
                      Orçamento Disponível:{' '}
                      <strong className="text-emerald-400">
                        {formatCurrency(team?.budget ?? 0)}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Ação 1: Desenvolver Nova Peça (Subir Nível) */}
                    <div className="p-3.5 rounded-lg bg-[#11161F] border border-[#1F2733] flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#F5F7FA]">
                            Desenvolver Nova Peça
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono border-[#1F2733]"
                          >
                            {isSelectedMax ? 'Máx 10' : `Nív.${selectedPart.level + 1}`}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-[#8B95A7] mt-1">
                          Investimento em CFD, túnel de vento e fabricação de nova especificação.
                        </p>
                        <div className="mt-2 text-xs font-mono">
                          <span className="text-[#8B95A7] block text-[10px]">Custo de P&D:</span>
                          <strong className="text-[#F5F7FA] text-sm">
                            {isSelectedMax ? 'Homologado' : formatCurrency(selectedUpgradeCost)}
                          </strong>
                        </div>
                      </div>

                      <Button
                        disabled={isSelectedMax || upgradingPartId === selectedPart.id}
                        onClick={() => handleUpgradePart(selectedPart)}
                        className={`w-full font-semibold text-xs h-9 ${
                          isSelectedMax
                            ? 'bg-[#1F2733] text-[#8B95A7]'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20'
                        }`}
                      >
                        {upgradingPartId === selectedPart.id
                          ? 'Desenvolvendo...'
                          : isSelectedMax
                            ? 'Nível Máximo Homologado'
                            : `Desenvolver (+1 Nível)`}
                      </Button>
                    </div>

                    {/* Ação 2: Reparar / Revisar Peça (Restaurar para 100%) */}
                    <div className="p-3.5 rounded-lg bg-[#11161F] border border-[#1F2733] flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#F5F7FA]">
                            Revisar / Reparar Oficina
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono ${
                              (selectedPart.condition ?? 100) >= 100
                                ? 'border-emerald-500/40 text-emerald-400'
                                : 'border-amber-500/40 text-amber-400'
                            }`}
                          >
                            {(selectedPart.condition ?? 100) >= 100
                              ? '100% Ok'
                              : 'Necessita Oficina'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-[#8B95A7] mt-1">
                          Testes de ultrassom, substituição de fibras de carbono e revisão mecânica.
                        </p>
                        <div className="mt-2 text-xs font-mono">
                          <span className="text-[#8B95A7] block text-[10px]">
                            Custo da Oficina:
                          </span>
                          <strong className="text-emerald-400 text-sm">
                            {(selectedPart.condition ?? 100) >= 100
                              ? 'Sem Custo (100%)'
                              : formatCurrency(selectedRepairCost)}
                          </strong>
                        </div>
                      </div>

                      <Button
                        disabled={
                          (selectedPart.condition ?? 100) >= 100 ||
                          repairingPartId === selectedPart.id
                        }
                        onClick={() => handleRepairPart(selectedPart)}
                        className={`w-full font-semibold text-xs h-9 ${
                          (selectedPart.condition ?? 100) >= 100
                            ? 'bg-[#1F2733] text-[#8B95A7]'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        {repairingPartId === selectedPart.id
                          ? 'Revisando na Oficina...'
                          : (selectedPart.condition ?? 100) >= 100
                            ? 'Totalmente Revisada'
                            : 'Reparar para 100%'}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-slate-400 font-mono text-xs">
                Selecione um componente no blueprint para abrir o diagnóstico.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card Resumo: Nível Geral do Carro + Impacto de Desgaste */}
        <Card className="bg-[#11161F] border-[#1F2733] flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
              <Gauge className="w-5 h-5 text-[#00A6FB]" />
              Índice de Competitividade
            </CardTitle>
            <CardDescription className="text-xs text-[#8B95A7]">
              Média ponderada do pacote de peças (60%) + potência da UP (40%).
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-1">
            <div className="text-center p-5 rounded-2xl bg-[#0B0E14] border border-[#1F2733] relative overflow-hidden">
              <div className="text-5xl font-extrabold font-mono text-[#F5F7FA] tracking-tight">
                {overallLevel}
                <span className="text-xs text-[#8B95A7] font-normal block mt-1">
                  / 100 Índice de Ritmo
                </span>
              </div>
              <div className="mt-3 w-full bg-[#1F2733] h-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-[#E10600] transition-all duration-500"
                  style={{ width: `${overallLevel}%` }}
                />
              </div>

              {averageCondition < 60 && (
                <div className="mt-3 p-2 rounded bg-red-950/40 border border-red-500/40 text-[10px] font-mono text-red-300 flex items-center gap-1.5 justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>Penalidade ativa de ritmo devido a desgaste médio (&lt;60%)</span>
                </div>
              )}
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between text-[#8B95A7] pb-1 border-b border-[#1F2733]">
                <span>Média das 6 Peças:</span>
                <strong className="text-[#F5F7FA]">{partsAverage} / 10</strong>
              </div>
              <div className="flex justify-between text-[#8B95A7] pb-1 border-b border-[#1F2733]">
                <span>Integridade Estrutural:</span>
                <strong
                  className={
                    averageCondition >= 80
                      ? 'text-emerald-400'
                      : averageCondition >= 60
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }
                >
                  {averageCondition}%
                </strong>
              </div>
              <div className="flex justify-between text-[#8B95A7] pb-1 border-b border-[#1F2733]">
                <span>UP ({currentEngine.name}):</span>
                <strong className="text-cyan-400">{currentEngine.power} / 100</strong>
              </div>
              <div className="flex justify-between text-[#8B95A7]">
                <span>Confiabilidade da UP:</span>
                <strong className="text-emerald-400">{currentEngine.reliability}%</strong>
              </div>
            </div>

            {/* Quick explanation about wear impact */}
            <div className="p-3 rounded-xl bg-[#090D16] border border-[#1F2733] text-[11px] text-[#8B95A7] space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-300 font-bold font-mono text-[10px]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Impacto de Desgaste nas Corridas</span>
              </div>
              <p className="text-[10px] leading-relaxed">
                Após cada GP, as peças perdem de <strong>8% a 18%</strong> de integridade. Mantenha
                a média acima de 60% para não perder ritmo e repare peças críticas (&lt;30%) para
                evitar DNF.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BLOCO FIXO EXPLICATIVO: REGRAS TÉCNICAS F1 2026 */}
      <div className="rounded-2xl bg-[#11161F] border border-[#00A6FB]/40 p-5 shadow-xl relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#00A6FB]/10 text-[#00A6FB] flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
                Novo Regulamento Técnico FIA — Fórmula 1 2026
                <Badge className="bg-[#00A6FB] text-[#0B0E14] font-mono text-[10px] font-bold">
                  Oficial
                </Badge>
              </h2>
              <p className="text-xs text-[#8B95A7] mt-0.5">
                A temporada 2026 introduz a maior revolução na arquitetura veicular e no trem de
                força da história da F1:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#E10600]">
                  <Zap className="w-4 h-4" />
                  <span>Unidade de Potência 50/50</span>
                </div>
                <p className="text-[#8B95A7] text-[11px] leading-relaxed">
                  Eliminação do MGU-H. O motor elétrico MGU-K salta para{' '}
                  <strong>350 kW (~475 cv)</strong>, dividindo a tração de forma igual com o motor
                  V6 Turbo (100% combustível sustentável).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#00A6FB]">
                  <Layers className="w-4 h-4" />
                  <span>Aerodinâmica Ativa</span>
                </div>
                <p className="text-[#8B95A7] text-[11px] leading-relaxed">
                  O DRS foi extinto. As asas dianteira e traseira possuem 2 estados:{' '}
                  <strong>Z-Mode</strong> (alta sustentação em curvas) e{' '}
                  <strong>X-Mode / Straight Mode</strong> (baixo arrasto eletrônico em retas).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-400">
                  <Flame className="w-4 h-4" />
                  <span>Modo Overtake & 768 kg</span>
                </div>
                <p className="text-[#8B95A7] text-[11px] leading-relaxed">
                  Quando o carro está a &lt;1s do rival, o piloto aciona o{' '}
                  <strong>Modo Overtake</strong> com energia extra na bateria para manobras de
                  ultrapassagem. O peso mínimo caiu para <strong>768 kg</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fornecedores de Unidade de Potência 2026 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#00A6FB]" />
            Fornecedores de Unidade de Potência 2026
          </h2>
          <span className="text-xs font-mono text-[#8B95A7]">4 fabricantes homologados</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ENGINE_SUPPLIERS.map((sup) => {
            const isCurrent = team?.engine_supplier === sup.name
            return (
              <div
                key={sup.name}
                className={`p-4 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-[#161D29] border-[#00A6FB] shadow-md shadow-[#00A6FB]/10 ring-1 ring-[#00A6FB]'
                    : 'bg-[#11161F] border-[#1F2733] hover:border-[#1F2733]/80'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-[#F5F7FA]">{sup.name}</h3>
                      {isCurrent && (
                        <Badge className="bg-[#00A6FB] text-slate-900 text-[10px] font-mono font-bold">
                          Atual
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-[#00A6FB] mt-0.5">{sup.techBadge}</p>
                  </div>
                </div>

                <p className="text-[11px] text-[#8B95A7] mt-2 line-clamp-2 leading-relaxed">
                  {sup.description}
                </p>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-[#1F2733] text-xs font-mono">
                  <div>
                    <span className="text-[#8B95A7] block text-[10px]">Potência</span>
                    <strong className="text-[#F5F7FA]">{sup.power}/100</strong>
                  </div>
                  <div>
                    <span className="text-[#8B95A7] block text-[10px]">Confiabilidade</span>
                    <strong className="text-emerald-400">{sup.reliability}%</strong>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#1F2733]/60">
                  <span className="text-xs font-mono font-bold text-[#F5F7FA]">
                    {formatCurrency(sup.costAnnual)}
                    <span className="text-[10px] text-[#8B95A7] font-normal">/ano</span>
                  </span>

                  {isCurrent ? (
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Equipado
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedSupplier(sup)}
                      className="border-[#1F2733] text-xs h-7 px-3 text-[#00A6FB] hover:bg-[#1F2733]"
                    >
                      Trocar Fornecedor
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal: Confirmar Troca de Fornecedor de Motor */}
      <Dialog open={!!selectedSupplier} onOpenChange={(open) => !open && setSelectedSupplier(null)}>
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#00A6FB]" />
              Trocar Fornecedor de Unidade de Potência
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              A rescisão e readequação de fixações do chassi possuem um custo de adaptação de
              desenvolvimento.
            </DialogDescription>
          </DialogHeader>

          {selectedSupplier && (
            <div className="space-y-4 py-2 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Novo Fornecedor:</span>
                  <strong className="text-[#F5F7FA] text-sm">{selectedSupplier.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Potência / Confiabilidade:</span>
                  <span className="text-[#00A6FB]">
                    {selectedSupplier.power} pts / {selectedSupplier.reliability}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Custo de Rescisão & Integração:</span>
                  <strong className="text-red-400 text-sm">{formatCurrency(15000000)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Saldo Atual da Equipe:</span>
                  <span className="text-[#F5F7FA]">{formatCurrency(team?.budget ?? 0)}</span>
                </div>
              </div>

              {(team?.budget ?? 0) < 15000000 && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Saldo insuficiente para arcar com a rescisão de R$ 15,00 M.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedSupplier(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSwitchSupplier}
              disabled={isProcessing || (team?.budget ?? 0) < 15000000}
              className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-semibold"
            >
              {isProcessing ? 'Adaptando chassi...' : 'Confirmar Troca de Motor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
