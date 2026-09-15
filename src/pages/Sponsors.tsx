import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { financialLedgerService, COST_CAP_ANNUAL_LIMIT } from '@/services/financialLedgerService'
import { useRealtime } from '@/hooks/use-realtime'
import { SponsorModel } from '@/types/f1'
import {
  FinancialTransaction,
  FinancialCommitment,
  InternalBudgetAllocation,
  CashSummary,
  CostCapSummary,
  FinancialAlert,
  FinancialImpactSimulation,
  ExpenseCategory,
} from '@/types/canonical-finances'
import { AVAILABLE_MARKET_SPONSORS } from '@/lib/f1-data'
import { standingsService } from '@/services/standingsService'
import { formatCurrency } from '@/lib/formatters'
import { managerEffectService } from '@/services/managerEffectService'
import { AmbientBackground } from '@/components/AmbientBackground'
import { toast } from '@/hooks/use-toast'
import {
  BadgePercent,
  TrendingUp,
  TrendingDown,
  Handshake,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Lock,
  ShieldAlert,
  Sliders,
  Scale,
  FileText,
  Filter,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  HelpCircle,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { notificationService } from '@/services/notificationService'
import { PageHeader } from '@/components/PageHeader'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'

export default function SponsorsPage() {
  const { user, team, season, refreshTeamAndSeason } = useAuth()

  // Abas do Módulo: 'financas' (Foco 5A) e 'patrocinios' (Comercial 5A/5B)
  const [activeMainTab, setActiveMainTab] = useState<'financas' | 'patrocinios'>('financas')

  // Estado Financeiro Canônico
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [loadingFinances, setLoadingFinances] = useState(true)
  const [selectedTxDetail, setSelectedTxDetail] = useState<FinancialTransaction | null>(null)
  const [reversingTx, setReversingTx] = useState<FinancialTransaction | null>(null)
  const [reversalReason, setReversalReason] = useState('')
  const [isProcessingReversal, setIsProcessingReversal] = useState(false)

  // Filtros do Ledger
  const [filterDirection, setFilterDirection] = useState<'all' | 'inflow' | 'outflow'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterCostCap, setFilterCostCap] = useState<'all' | 'included' | 'excluded'>('all')

  // Simulador What-If (Item 23)
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false)
  const [whatIfDesc, setWhatIfDesc] = useState('Novo Projeto de Assoalho (Spec C)')
  const [whatIfCost, setWhatIfCost] = useState('7500000')
  const [whatIfCategory, setWhatIfCategory] = useState<ExpenseCategory>('development')
  const [simResult, setSimResult] = useState<FinancialImpactSimulation | null>(null)

  // Orçamento Interno (Item 44 - Budget Allocation)
  const [isAllocationOpen, setIsAllocationOpen] = useState(false)
  const [allocations, setAllocations] = useState<Record<string, number>>({
    development: 65_000_000,
    manufacturing: 25_000_000,
    infrastructureCapex: 20_000_000,
    academy: 8_000_000,
    testing: 6_000_000,
  })

  // Patrocínios
  const [sponsors, setSponsors] = useState<SponsorModel[]>([])
  const [raceResults, setRaceResults] = useState<any[]>([])
  const [signingSponsor, setSigningSponsor] = useState<any | null>(null)
  const [terminatingSponsor, setTerminatingSponsor] = useState<SponsorModel | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Carrega e assegura dados do Ledger Canônico
  const loadFinancialData = async () => {
    if (!team) return
    setLoadingFinances(true)
    try {
      const seasonYear = season?.year || 2026
      // Assegura Saldo de Abertura se for save pré-existente
      await financialLedgerService.ensureOpeningBalance(team, seasonYear)
      const txs = await financialLedgerService.getTeamTransactions(team.id, seasonYear)
      setTransactions(txs)
    } catch (err) {
      console.error('Erro ao carregar dados do FinancialLedger:', err)
    } finally {
      setLoadingFinances(false)
    }
  }

  const loadSponsors = async () => {
    if (!team) return
    try {
      const sp = await f1Service.getTeamSponsors(team.id)
      setSponsors(sp)
      if (season?.id) {
        const rr = await f1Service.getSeasonRaceResults(season.id)
        setRaceResults(rr)
      }
    } catch (err) {
      console.error('Error loading sponsors:', err)
    }
  }

  useEffect(() => {
    loadFinancialData()
    loadSponsors()
  }, [team?.id, season?.id])

  useRealtime('financial_ledger', () => {
    loadFinancialData()
  })

  useRealtime('sponsors', () => {
    loadSponsors()
  })

  // Cálculos Canônicos de Caixa e Cost Cap
  const commitments = useMemo(() => {
    return (team?.financial_commitments || []) as FinancialCommitment[]
  }, [team?.financial_commitments])

  const totalRevenuePerRound = useMemo(() => {
    return sponsors
      .filter((s) => s.status === 'ativo')
      .reduce((acc, curr) => acc + (curr.value_per_round || 0), 0)
  }, [sponsors])

  const estPrizePerRound = 1_100_000
  const estDriverSalariesPerRound = 750_000
  const estOperationalCostsPerRound = 450_000

  const cashSummary: CashSummary = useMemo(() => {
    return financialLedgerService.calculateCashSummary(
      transactions,
      commitments,
      24,
      season?.current_round || 1,
      totalRevenuePerRound + estPrizePerRound,
      estDriverSalariesPerRound + estOperationalCostsPerRound,
    )
  }, [transactions, commitments, season?.current_round, totalRevenuePerRound])

  const costCapSummary: CostCapSummary = useMemo(() => {
    const remainingRounds = Math.max(0, 24 - (season?.current_round || 1) + 1)
    return financialLedgerService.calculateCostCapSummary(
      transactions,
      commitments,
      COST_CAP_ANNUAL_LIMIT,
      remainingRounds,
      350_000, // OPEX médio por GP sujeito a teto
    )
  }, [transactions, commitments, season?.current_round])

  // Alertas Inteligentes
  const financialAlerts: FinancialAlert[] = useMemo(() => {
    return financialLedgerService.generateFinancialAlerts(cashSummary, costCapSummary)
  }, [cashSummary, costCapSummary])

  // Despesas Realizadas por Categoria
  const categoryExpenses = useMemo(() => {
    const cats: Record<string, number> = {}
    transactions
      .filter((t) => t.status === 'effective' && t.direction === 'outflow')
      .forEach((t) => {
        cats[t.category] = (cats[t.category] || 0) + t.amount
      })
    return cats
  }, [transactions])

  // Receitas Realizadas por Categoria
  const categoryRevenues = useMemo(() => {
    const cats: Record<string, number> = {}
    transactions
      .filter((t) => t.status === 'effective' && t.direction === 'inflow')
      .forEach((t) => {
        cats[t.category] = (cats[t.category] || 0) + t.amount
      })
    return cats
  }, [transactions])

  // Transações Filtradas
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterDirection === 'inflow' && tx.direction !== 'inflow') return false
      if (filterDirection === 'outflow' && tx.direction !== 'outflow') return false
      if (filterCategory !== 'all' && tx.category !== filterCategory) return false
      if (filterCostCap === 'included' && tx.cost_cap_classification !== 'included') return false
      if (filterCostCap === 'excluded' && tx.cost_cap_classification !== 'excluded') return false
      return true
    })
  }, [transactions, filterDirection, filterCategory, filterCostCap])

  // Executa Simulação What-If
  const handleRunSimulation = () => {
    if (!team) return
    const amt = parseFloat(whatIfCost) || 0
    const res = financialLedgerService.simulateFinancialImpact({
      team,
      actionDescription: whatIfDesc,
      costAmount: amt,
      category: whatIfCategory,
      currentTransactions: transactions,
      currentCommitments: commitments,
      totalRounds: 24,
      currentRound: season?.current_round || 1,
    })
    setSimResult(res)
  }

  // Executa Reversão Contábil Canônica
  const handleConfirmReversal = async () => {
    if (!reversingTx) return
    if (!reversalReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Motivo Obrigatório',
        description: 'Informe uma justificativa contábil para o estorno.',
      })
      return
    }

    setIsProcessingReversal(true)
    try {
      await financialLedgerService.reverseTransaction(reversingTx.id, reversalReason.trim())
      toast({
        title: 'Transação Estornada com Sucesso',
        description: `O lançamento compensatório foi registrado e os saldos foram recalculados.`,
      })
      setReversingTx(null)
      setReversalReason('')
      await loadFinancialData()
      await refreshTeamAndSeason?.()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao Estornar',
        description: err?.message || 'Falha na reversão contábil.',
      })
    } finally {
      setIsProcessingReversal(false)
    }
  }

  // Desempenho esportivo para multiplicador comercial
  const performanceStats = useMemo(() => {
    const standings = standingsService.calculateStandings({
      raceResults,
      team,
      season,
    })
    const constructorPos = standings.playerConstructorRank || 6
    const playerWins = standings.playerWins || 0
    const playerPodiums = standings.playerPodiums || 0
    const managerCommercialBonus = managerEffectService.getSponsorModifier(team)
    const scale = f1Service.calculateSponsorMultiplier({
      constructorPos,
      wins: playerWins,
      podiums: playerPodiums,
      managerCommercialBonus,
    })
    return {
      constructorPos,
      wins: playerWins,
      podiums: playerPodiums,
      multiplier: scale.multiplier,
      explanation: scale.explanation,
    }
  }, [team, season, raceResults])

  const activeSponsors = sponsors.filter((s) => s.status === 'ativo' || s.status === 'suspenso')
  const occupiedSlots = useMemo(() => {
    const slots = new Set<string>()
    activeSponsors.forEach((s) => {
      if (s.slot) slots.add(s.slot)
    })
    return slots
  }, [activeSponsors])

  const signedSponsorNames = useMemo(() => {
    return new Set(activeSponsors.map((s) => s.name))
  }, [activeSponsors])

  const marketCatalogWithStatus = useMemo(() => {
    return AVAILABLE_MARKET_SPONSORS.map((m) => {
      const isAlreadySigned = signedSponsorNames.has(m.name)
      const isSlotOccupied = occupiedSlots.has(m.slot)
      const occupant = activeSponsors.find((s) => s.slot === m.slot)
      const scaledValue = Math.round(m.valuePerRound * performanceStats.multiplier)
      return {
        ...m,
        scaledValue,
        isAlreadySigned,
        isSlotOccupied,
        occupantName: occupant?.name,
      }
    })
  }, [signedSponsorNames, occupiedSlots, activeSponsors, performanceStats.multiplier])

  const handleSignContract = async () => {
    if (!signingSponsor || !team) return
    setIsProcessing(true)
    try {
      const finalValuePerRound = Math.round(
        signingSponsor.valuePerRound * performanceStats.multiplier,
      )
      await f1Service.createSponsor({
        name: signingSponsor.name,
        slot: signingSponsor.slot,
        value_per_round: finalValuePerRound,
        requirement: signingSponsor.requirement,
        status: 'ativo',
        rounds_remaining: signingSponsor.rounds,
        team_id: team.id,
      })

      // Registro do contrato no ledger
      await financialLedgerService.postTransaction({
        teamId: team.id,
        seasonYear: season?.year || 2026,
        round: season?.current_round || 1,
        type: 'revenue',
        category: 'sponsorship',
        subcategory: `sponsor_signed_${signingSponsor.slot}`,
        direction: 'neutral', // Compromisso comercial futuro
        amount: finalValuePerRound * signingSponsor.rounds,
        costCapClassification: 'excluded',
        sourceSystem: 'sponsor_contract',
        sourceEntityId: signingSponsor.name,
        idempotencyKey: `sponsor_contract_${team.id}_${signingSponsor.name}_${Date.now()}`,
        description: `Contrato firmado com ${signingSponsor.name} (${signingSponsor.slotLabel}): ${formatCurrency(finalValuePerRound)}/GP por ${signingSponsor.rounds} GPs`,
      })

      toast({
        title: 'Patrocínio Fechado!',
        description: `Contrato assinado com ${signingSponsor.name}.`,
      })
      setSigningSponsor(null)
      loadSponsors()
      loadFinancialData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao assinar contrato',
        description: err?.message || 'Falha ao firmar patrocínio.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTerminateContract = async () => {
    if (!terminatingSponsor || !team) return
    setIsProcessing(true)
    try {
      await f1Service.updateSponsor(terminatingSponsor.id, { status: 'encerrado' })
      toast({
        title: 'Contrato Encerrado',
        description: `O vínculo com ${terminatingSponsor.name} foi finalizado.`,
      })
      setTerminatingSponsor(null)
      loadSponsors()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao encerrar contrato',
        description: err?.message || 'Falha ao cancelar patrocínio.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="relative space-y-6 animate-fade-in-up text-[#F5F7FA]">
      <AmbientBackground />

      {/* Header Unificado */}
      <PageHeader
        eyebrow="CENTRO DE OPERAÇÕES FINANCEIRAS & COMERCIAL"
        title="Finanças & Gestão do Cost Cap"
        description="Fundação financeira auditável, controle independente de Liquidez de Caixa vs. Teto Regulatório da FIA e Livro Razão Canônico."
        badge={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`font-mono text-xs ${
                costCapSummary.status === 'breach'
                  ? 'border-red-500 text-red-400 bg-red-950/40'
                  : costCapSummary.status === 'critico'
                    ? 'border-amber-500 text-amber-400 bg-amber-950/40'
                    : 'border-emerald-500 text-emerald-400 bg-emerald-950/40'
              }`}
            >
              FIA Cost Cap: {costCapSummary.pctUsed}% Realizado (
              {costCapSummary.status.toUpperCase()})
            </Badge>
          </div>
        }
      />

      {/* Navegação entre Finanças Canônicas e Comercial/Sponsors */}
      <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={activeMainTab === 'financas' ? 'default' : 'ghost'}
            onClick={() => setActiveMainTab('financas')}
            className={`text-xs font-bold gap-2 ${
              activeMainTab === 'financas'
                ? 'bg-[#E10600] text-white hover:bg-[#b80500]'
                : 'text-[#8B95A7] hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Finanças & Cost Cap (Fase 5A)
          </Button>
          <Button
            size="sm"
            variant={activeMainTab === 'patrocinios' ? 'default' : 'ghost'}
            onClick={() => setActiveMainTab('patrocinios')}
            className={`text-xs font-bold gap-2 ${
              activeMainTab === 'patrocinios'
                ? 'bg-[#E10600] text-white hover:bg-[#b80500]'
                : 'text-[#8B95A7] hover:text-white'
            }`}
          >
            <Handshake className="w-4 h-4" />
            Comercial & Patrocínios
          </Button>
        </div>

        {activeMainTab === 'financas' && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsWhatIfOpen(true)
                handleRunSimulation()
              }}
              className="text-xs border-[#1F2733] bg-[#0E131F] text-[#F5F7FA] hover:bg-[#161D29] gap-1.5"
            >
              <Scale className="w-3.5 h-3.5 text-cyan-400" />
              Simular Decisão (What-If)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAllocationOpen(true)}
              className="text-xs border-[#1F2733] bg-[#0E131F] text-[#F5F7FA] hover:bg-[#161D29] gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Planejamento Interno
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadFinancialData}
              className="text-xs text-[#8B95A7] hover:text-white h-8 w-8 p-0"
              title="Recarregar Livro Razão"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {activeMainTab === 'financas' ? (
        <div className="space-y-6">
          {/* SEÇÃO 1: ALERTAS FINANCEIROS ATIVOS */}
          {financialAlerts.length > 0 && (
            <div className="space-y-2">
              {financialAlerts.map((alt) => (
                <div
                  key={alt.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                    alt.severity === 'danger'
                      ? 'bg-red-950/40 border-red-500/50 text-red-200'
                      : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <strong className="font-bold block text-sm">{alt.title}</strong>
                    <p className="mt-0.5 leading-relaxed">{alt.message}</p>
                    {alt.recommendation && (
                      <span className="block mt-1 font-mono text-[11px] opacity-90">
                        💡 Ação Recomendada: {alt.recommendation}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SEÇÃO 2: BLOCOS VISUAIS SEPARADOS OBRIGATÓRIOS (REGRA DE OURO #1) */}
          {/* Caixa (Dinheiro Real) vs Cost Cap (Regulação FIA) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* BLOCO DE CAIXA & LIQUIDEZ */}
            <div className="rounded-xl bg-[#0B0E14] border border-[#1F2733] p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#1F2733] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-[#8B95A7] block">
                      POSIÇÃO DE TESOURARIA
                    </span>
                    <h3 className="text-base font-bold text-white">Caixa Real & Disponibilidade</h3>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-emerald-500/40 text-emerald-400 bg-emerald-950/30"
                >
                  Liquidez Ativa
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#0E131F] border border-[#1F2733]">
                  <span className="text-[10px] font-mono text-[#8B95A7] block">
                    SALDO TOTAL EM CAIXA
                  </span>
                  <div className="text-xl font-black font-mono text-emerald-400 mt-0.5">
                    {formatCurrency(cashSummary.cashBalance)}
                  </div>
                  <span className="text-[10px] text-[#8B95A7]">Dinheiro efetivamente na conta</span>
                </div>

                <div className="p-3 rounded-lg bg-[#0E131F] border border-[#1F2733]">
                  <span className="text-[10px] font-mono text-[#8B95A7] block">
                    CAIXA DISPONÍVEL (LIVRE)
                  </span>
                  <div className="text-xl font-black font-mono text-cyan-400 mt-0.5">
                    {formatCurrency(cashSummary.availableCash)}
                  </div>
                  <span className="text-[10px] text-[#8B95A7]">
                    Descontados compromissos assumidos
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#0E131F] border border-[#1F2733]">
                  <span className="text-[10px] font-mono text-[#8B95A7] block">
                    COMPROMISSOS FUTUROS
                  </span>
                  <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                    {formatCurrency(cashSummary.committedCash)}
                  </div>
                  <span className="text-[10px] text-[#8B95A7]">Obras, ordens ativas e folha</span>
                </div>

                <div className="p-3 rounded-lg bg-[#0E131F] border border-[#1F2733]">
                  <span className="text-[10px] font-mono text-[#8B95A7] block">
                    PROJEÇÃO FIM DE ANO
                  </span>
                  <div
                    className={`text-lg font-bold font-mono mt-0.5 ${
                      cashSummary.projectedEndCash >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {formatCurrency(cashSummary.projectedEndCash)}
                  </div>
                  <span className="text-[10px] text-[#8B95A7]">Receitas contratadas vs custos</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#1F2733]/60 flex items-center justify-between text-xs font-mono text-[#8B95A7]">
                <span>Burn Rate Médio / GP: {formatCurrency(cashSummary.burnRatePerRound)}</span>
                <span className="text-cyan-400">
                  Fluxo Líquido Realizado:{' '}
                  {cashSummary.netCashFlow >= 0
                    ? `+${formatCurrency(cashSummary.netCashFlow)}`
                    : formatCurrency(cashSummary.netCashFlow)}
                </span>
              </div>
            </div>

            {/* BLOCO DO COST CAP FIA */}
            <div className="rounded-xl bg-[#0B0E14] border border-[#1F2733] p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#1F2733] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-[#8B95A7] block">
                      REGULAMENTO FINANCEIRO FIA
                    </span>
                    <h3 className="text-base font-bold text-white">
                      Teto de Gastos (Cost Cap 2026/2027)
                    </h3>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`font-mono text-xs uppercase ${
                    costCapSummary.status === 'breach'
                      ? 'border-red-500 text-red-400'
                      : costCapSummary.status === 'critico'
                        ? 'border-amber-500 text-amber-400'
                        : 'border-emerald-500 text-emerald-400'
                  }`}
                >
                  Status: {costCapSummary.status}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-baseline text-xs font-mono">
                  <span className="text-[#8B95A7]">Consumo Atual vs Limite Regulatório:</span>
                  <span className="text-white font-bold">
                    {formatCurrency(costCapSummary.used)} /{' '}
                    {formatCurrency(costCapSummary.annualLimit)} ({costCapSummary.pctUsed}%)
                  </span>
                </div>
                <Progress
                  value={costCapSummary.pctUsed}
                  className={`h-2.5 bg-[#161D29] ${
                    costCapSummary.pctUsed >= 95
                      ? '[&>div]:bg-red-500'
                      : costCapSummary.pctUsed >= 85
                        ? '[&>div]:bg-amber-500'
                        : '[&>div]:bg-emerald-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#0E131F] border border-[#1F2733]">
                  <span className="text-[10px] font-mono text-[#8B95A7] block">
                    MARGEM RESTANTE REAL
                  </span>
                  <div className="text-xl font-black font-mono text-white mt-0.5">
                    {formatCurrency(costCapSummary.remaining)}
                  </div>
                  <span className="text-[10px] text-[#8B95A7]">
                    Espaço até atingir o teto de gastos
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#0E131F] border border-[#1F2733]">
                  <span className="text-[10px] font-mono text-[#8B95A7] block">
                    PROJEÇÃO FIM DE TEMPORADA
                  </span>
                  <div
                    className={`text-xl font-black font-mono mt-0.5 ${
                      costCapSummary.projected > costCapSummary.annualLimit
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {formatCurrency(costCapSummary.projected)}
                  </div>
                  <span className="text-[10px] text-[#8B95A7]">
                    {costCapSummary.pctProjected}% do teto projetado
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#1F2733]/60 flex items-center justify-between text-xs font-mono text-[#8B95A7]">
                <span>Comprometido sujeito a teto: {formatCurrency(costCapSummary.committed)}</span>
                <span
                  className={
                    costCapSummary.projectedRemaining >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400 font-bold'
                  }
                >
                  Margem Projetada Final: {formatCurrency(costCapSummary.projectedRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: DISTRIBUIÇÃO POR CATEGORIAS (REALIZADO / COMPOSIÇÃO) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Composição de Despesas */}
            <div className="rounded-xl bg-[#0B0E14] border border-[#1F2733] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
                <span className="text-xs font-bold font-mono text-red-400 uppercase tracking-wide">
                  Despesas da Temporada por Categoria
                </span>
                <span className="text-xs font-bold font-mono text-red-400">
                  Total: {formatCurrency(cashSummary.seasonExpenses)}
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                {Object.keys(categoryExpenses).length === 0 ? (
                  <p className="text-[#8B95A7] py-2">Nenhuma despesa lançada nesta temporada.</p>
                ) : (
                  Object.entries(categoryExpenses).map(([cat, amt]) => {
                    const pct = Math.round((amt / (cashSummary.seasonExpenses || 1)) * 100)
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-[#8B95A7]">
                          <span className="capitalize">{cat}</span>
                          <span className="text-white font-bold">
                            {formatCurrency(amt)} ({pct}%)
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className="h-1.5 bg-[#161D29] [&>div]:bg-red-500/80"
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Composição de Receitas */}
            <div className="rounded-xl bg-[#0B0E14] border border-[#1F2733] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
                <span className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wide">
                  Receitas da Temporada por Categoria
                </span>
                <span className="text-xs font-bold font-mono text-emerald-400">
                  Total: {formatCurrency(cashSummary.seasonRevenue)}
                </span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                {Object.keys(categoryRevenues).length === 0 ? (
                  <p className="text-[#8B95A7] py-2">Nenhuma receita lançada nesta temporada.</p>
                ) : (
                  Object.entries(categoryRevenues).map(([cat, amt]) => {
                    const pct = Math.round((amt / (cashSummary.seasonRevenue || 1)) * 100)
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-[#8B95A7]">
                          <span className="capitalize">{cat}</span>
                          <span className="text-white font-bold">
                            {formatCurrency(amt)} ({pct}%)
                          </span>
                        </div>
                        <Progress
                          value={pct}
                          className="h-1.5 bg-[#161D29] [&>div]:bg-emerald-500/80"
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: LIVRO RAZÃO CANÔNICO (LEDGER COMPLETO COM ORIGEM E AUDITORIA) */}
          <div className="rounded-xl bg-[#0B0E14] border border-[#1F2733] p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2733] pb-3">
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-[#E10600] block">
                  FONTE CANÔNICA AUDITÁVEL
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#E10600]" />
                  Livro Razão Financeiro ({transactions.length} registros)
                </h3>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex items-center gap-1 bg-[#0E131F] border border-[#1F2733] rounded-lg p-1">
                  <Filter className="w-3.5 h-3.5 text-[#8B95A7] ml-1" />
                  <select
                    value={filterDirection}
                    onChange={(e: any) => setFilterDirection(e.target.value)}
                    className="bg-transparent text-[#F5F7FA] text-xs font-mono border-none focus:outline-none"
                  >
                    <option value="all" className="bg-[#0B0E14]">
                      Todos Fluxos
                    </option>
                    <option value="inflow" className="bg-[#0B0E14]">
                      Receitas (+)
                    </option>
                    <option value="outflow" className="bg-[#0B0E14]">
                      Despesas (-)
                    </option>
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-[#0E131F] border border-[#1F2733] rounded-lg p-1">
                  <select
                    value={filterCostCap}
                    onChange={(e: any) => setFilterCostCap(e.target.value)}
                    className="bg-transparent text-[#F5F7FA] text-xs font-mono border-none focus:outline-none"
                  >
                    <option value="all" className="bg-[#0B0E14]">
                      Cost Cap: Todos
                    </option>
                    <option value="included" className="bg-[#0B0E14]">
                      No Teto (Included)
                    </option>
                    <option value="excluded" className="bg-[#0B0E14]">
                      Fora do Teto (Excluded)
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {loadingFinances ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full bg-[#161D29]" />
                <Skeleton className="h-10 w-full bg-[#161D29]" />
                <Skeleton className="h-10 w-full bg-[#161D29]" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhuma transação encontrada"
                description="Os lançamentos financeiros gerados por P&D, Manufatura, Salários e Patrocínios aparecerão aqui."
                compact
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1F2733] text-[#8B95A7] text-[11px]">
                      <th className="py-2.5 px-3">Data / GP</th>
                      <th className="py-2.5 px-3">Descrição & Origem</th>
                      <th className="py-2.5 px-3">Categoria</th>
                      <th className="py-2.5 px-3 text-right">Impacto Caixa</th>
                      <th className="py-2.5 px-3 text-right">Cost Cap FIA</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2733]/50">
                    {filteredTransactions.map((tx) => {
                      const isInflow = tx.direction === 'inflow'
                      const isReversed = tx.status === 'reversed'
                      return (
                        <tr
                          key={tx.id}
                          className={`hover:bg-[#121824] transition-colors ${
                            isReversed ? 'opacity-50 line-through' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-[#8B95A7] whitespace-nowrap">
                            {tx.date_display || `R${tx.round || 1}`}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-white block truncate max-w-xs sm:max-w-md">
                              {tx.description}
                            </span>
                            <span className="text-[10px] text-[#8B95A7]">
                              Fonte: {tx.source_system}{' '}
                              {tx.source_entity_id ? `• Ref: ${tx.source_entity_id}` : ''}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className="text-[10px] border-[#1F2733] bg-[#0E131F] text-[#F5F7FA] uppercase"
                            >
                              {tx.category}
                            </Badge>
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                              isInflow ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isInflow ? '+' : ''}
                            {formatCurrency(tx.cash_impact)}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {tx.cost_cap_impact > 0 ? (
                              <span className="text-amber-400 font-bold">
                                {formatCurrency(tx.cost_cap_impact)}
                              </span>
                            ) : (
                              <span className="text-[#8B95A7]">Isento</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[9px] uppercase ${
                                isReversed
                                  ? 'border-neutral-600 text-neutral-400 bg-neutral-900'
                                  : tx.status === 'effective'
                                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                                    : 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20'
                              }`}
                            >
                              {tx.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedTxDetail(tx)}
                                className="h-6 px-2 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/20"
                              >
                                Detalhes
                              </Button>
                              {tx.status === 'effective' && tx.type !== 'opening_balance' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setReversingTx(tx)}
                                  className="h-6 px-2 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-950/20"
                                >
                                  Estornar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ABA PATROCÍNIOS & COMERCIAL (Preservada da versão anterior) */
        <div className="space-y-6">
          {/* Seção Contratos Ativos */}
          <div className="rounded-xl bg-[#090D15]/85 border border-[#1F2733] p-5 shadow-xl space-y-4">
            <div className="pb-3 border-b border-[#1F2733] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                  PARCERIAS ESTABELECIDAS
                </span>
                <h3 className="text-base font-black text-[#F5F7FA] flex items-center gap-2 mt-0.5">
                  <Handshake className="w-4 h-4 text-emerald-400" />
                  Contratos Comerciais em Vigor ({activeSponsors.length})
                </h3>
              </div>
              <p className="text-xs text-[#8B95A7] font-mono">
                Receita total ativa:{' '}
                <strong className="text-emerald-400">
                  {formatCurrency(totalRevenuePerRound)}/GP
                </strong>
              </p>
            </div>

            <div>
              {activeSponsors.length === 0 ? (
                <EmptyState
                  icon={Handshake}
                  title="Nenhum contrato ativo"
                  description="Assine novas parcerias no catálogo de cotas abaixo para gerar fluxo de caixa."
                  compact
                />
              ) : (
                <DataTable
                  keyExtractor={(sp) => sp.id}
                  data={activeSponsors}
                  playerRowPredicate={() => true}
                  playerRowTeamColor={team?.color || '#E10600'}
                  playerBadgeLabel="ATIVO"
                  columns={[
                    {
                      key: 'name',
                      header: 'Patrocinador',
                      render: (sp) => (
                        <div>
                          <span className="font-bold text-[#F5F7FA] text-sm block">{sp.name}</span>
                          <span className="text-[11px] text-[#8B95A7] font-mono">
                            Meta: {sp.requirement || 'Sem exigência'}
                          </span>
                        </div>
                      ),
                    },
                    {
                      key: 'slot',
                      header: 'Cota Reservada',
                      render: (sp) => (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono border-[#1F2733] bg-[#0B0E14] text-[#F5F7FA] uppercase"
                        >
                          {sp.slot || 'Geral'}
                        </Badge>
                      ),
                    },
                    {
                      key: 'value_per_round',
                      header: 'Repasse / GP',
                      align: 'right',
                      isNumeric: true,
                      render: (sp) => (
                        <span className="font-num font-bold text-emerald-400 text-sm">
                          {formatCurrency(sp.value_per_round)}
                        </span>
                      ),
                    },
                    {
                      key: 'rounds_remaining',
                      header: 'Duração',
                      align: 'center',
                      render: (sp) => (
                        <span className="font-num text-[#8B95A7]">
                          {sp.rounds_remaining ?? 24} rodadas
                        </span>
                      ),
                    },
                    {
                      key: 'actions',
                      header: 'Ação',
                      align: 'right',
                      render: (sp) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTerminatingSponsor(sp)}
                          className="text-xs h-7 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                        >
                          Encerrar
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </div>

          {/* Catálogo de Cotas do Monoposto */}
          <div className="rounded-xl bg-[#090D15]/85 border border-[#1F2733] p-5 shadow-xl space-y-4">
            <div className="pb-3 border-b border-[#1F2733]">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                PORTFÓLIO DE OFERTAS // MERCADO COMERCIAL
              </span>
              <h3 className="text-base font-black text-[#F5F7FA] flex items-center gap-2 mt-0.5">
                <BadgePercent className="w-4 h-4 text-amber-400" />
                Cotas de Patrocínio Comercial (Exclusividade no Carro)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketCatalogWithStatus.map((m) => (
                <div
                  key={m.name}
                  className="p-4 rounded-xl border border-[#1F2733] bg-[#0B0E14] space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-sm text-white">{m.name}</h4>
                      <Badge variant="outline" className="text-[10px] font-mono border-[#1F2733]">
                        {m.rounds} GPs
                      </Badge>
                    </div>
                    <Badge variant="secondary" className="mt-1 text-[10px] font-mono">
                      Cota: {m.slotLabel}
                    </Badge>
                    <p className="text-[11px] text-[#8B95A7] mt-2">{m.description}</p>
                    <div className="p-2.5 rounded-lg bg-[#090D15] border border-[#1F2733] mt-3 space-y-1 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-[#8B95A7]">Repasse por GP:</span>
                        <strong className="text-emerald-400 font-bold">
                          {formatCurrency(m.scaledValue)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8B95A7]">Meta:</span>
                        <strong className="text-white">{m.requirement}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    {m.isAlreadySigned ? (
                      <div className="p-2 text-center rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                        ✓ Contrato em Vigor
                      </div>
                    ) : m.isSlotOccupied ? (
                      <div className="p-2 text-center rounded-lg bg-[#090D15] border border-[#1F2733] text-[#8B95A7] text-[11px] font-mono">
                        🔒 Cota ocupada ({m.occupantName || 'por outro patrocinador'})
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setSigningSponsor(m)}
                        className="w-full bg-[#E10600] hover:bg-[#b80500] text-white text-xs font-bold h-8"
                      >
                        Fechar Contrato Exclusivo
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: DETALHES DA TRANSAÇÃO AUDITÁVEL (ITEM 56) */}
      <Dialog open={!!selectedTxDetail} onOpenChange={(open) => !open && setSelectedTxDetail(null)}>
        <DialogContent className="bg-[#0B0E14] border border-[#1F2733] text-[#F5F7FA] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Auditoria de Transação Contábil
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Registro imutável no Livro Razão canônico da temporada.
            </DialogDescription>
          </DialogHeader>

          {selectedTxDetail && (
            <div className="space-y-3 py-2 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1F2733] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">ID da Transação:</span>
                  <span className="text-white">{selectedTxDetail.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Idempotency Key:</span>
                  <span className="text-amber-400 text-[11px] break-all">
                    {selectedTxDetail.idempotency_key}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Sistema de Origem:</span>
                  <span className="text-cyan-400">{selectedTxDetail.source_system}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Entidade Referenciada:</span>
                  <span className="text-white">{selectedTxDetail.source_entity_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Data Efetiva:</span>
                  <span className="text-white">{selectedTxDetail.effective_date}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1F2733] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Impacto em Caixa:</span>
                  <strong
                    className={
                      selectedTxDetail.cash_impact >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {formatCurrency(selectedTxDetail.cash_impact)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Classificação Cost Cap:</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {selectedTxDetail.cost_cap_classification}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Impacto no Teto FIA:</span>
                  <strong className="text-amber-400">
                    {formatCurrency(selectedTxDetail.cost_cap_impact)}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedTxDetail(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: SIMULADOR WHAT-IF (ITEM 23) */}
      <Dialog open={isWhatIfOpen} onOpenChange={setIsWhatIfOpen}>
        <DialogContent className="bg-[#0B0E14] border border-[#1F2733] text-[#F5F7FA] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Scale className="w-4 h-4 text-cyan-400" />
              Simulador de Impacto Financeiro (What-If)
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Avalie como um investimento afetará a liquidez do caixa e o teto da FIA antes de
              executá-lo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs font-mono">
            <div className="space-y-2">
              <label className="text-[#8B95A7]">Descrição da Ação / Projeto:</label>
              <Input
                value={whatIfDesc}
                onChange={(e) => setWhatIfDesc(e.target.value)}
                className="bg-[#0E131F] border-[#1F2733] text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[#8B95A7]">Custo Estimado (R$):</label>
                <Input
                  type="number"
                  value={whatIfCost}
                  onChange={(e) => setWhatIfCost(e.target.value)}
                  className="bg-[#0E131F] border-[#1F2733] text-white text-xs font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[#8B95A7]">Categoria:</label>
                <select
                  value={whatIfCategory}
                  onChange={(e: any) => setWhatIfCategory(e.target.value)}
                  className="w-full h-9 rounded-md bg-[#0E131F] border border-[#1F2733] text-white text-xs px-2"
                >
                  <option value="development">P&D de Peças (Development)</option>
                  <option value="manufacturing">Fabricação (Manufacturing)</option>
                  <option value="infrastructureCapex">Infraestrutura (CAPEX)</option>
                  <option value="academy">Academia de Pilotos</option>
                  <option value="testing">Testes & Homologação</option>
                </select>
              </div>
            </div>

            <Button
              onClick={handleRunSimulation}
              className="w-full bg-[#161D29] hover:bg-[#20293A] text-cyan-400 border border-[#1F2733] text-xs"
            >
              Calcular Projeções
            </Button>

            {simResult && (
              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1F2733] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Caixa Após Ação:</span>
                  <strong
                    className={simResult.isAffordableCash ? 'text-emerald-400' : 'text-red-400'}
                  >
                    {formatCurrency(simResult.projectedCashAfter)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Cost Cap Utilizado Após:</span>
                  <strong className={simResult.isWithinCostCap ? 'text-white' : 'text-red-400'}>
                    {formatCurrency(simResult.projectedCostCapAfter)} (
                    {simResult.projectedCostCapPctAfter}%)
                  </strong>
                </div>
                {simResult.warning && (
                  <div className="p-2 rounded bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[11px]">
                    ⚠️ {simResult.warning}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsWhatIfOpen(false)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Fechar Simulador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: ESTORNO / REVERSÃO CONTÁBIL (ITEM 5 & 69) */}
      <Dialog open={!!reversingTx} onOpenChange={(open) => !open && setReversingTx(null)}>
        <DialogContent className="bg-[#0B0E14] border border-[#1F2733] text-[#F5F7FA] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Estorno Contábil Canônico
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              A transação original permanecerá registrada no histórico. Uma nova transação
              compensatória será gerada para reverter os saldos de caixa e teto de gastos.
            </DialogDescription>
          </DialogHeader>

          {reversingTx && (
            <div className="space-y-3 py-2 text-xs font-mono">
              <div className="p-3 rounded-lg bg-[#0E131F] border border-[#1F2733] space-y-1">
                <span className="text-[#8B95A7] block">Transação a Reverter:</span>
                <strong className="text-white block">{reversingTx.description}</strong>
                <span className="text-red-400 block font-bold">
                  {formatCurrency(reversingTx.amount)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[#8B95A7]">Justificativa do Estorno (Obrigatória):</label>
                <Input
                  placeholder="Ex: Cancelamento de pedido, ajuste regulatório..."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="bg-[#0E131F] border-[#1F2733] text-white text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReversingTx(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmReversal}
              disabled={isProcessingReversal}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {isProcessingReversal ? 'Estornando...' : 'Confirmar Estorno'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: PLANEJAMENTO INTERNO / ORÇAMENTO (ITEM 44 & 45) */}
      <Dialog open={isAllocationOpen} onOpenChange={setIsAllocationOpen}>
        <DialogContent className="bg-[#0B0E14] border border-[#1F2733] text-[#F5F7FA] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Planejamento Orçamentário Interno
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Defina as metas internas de alocação de recursos por departamento. Realocar orçamento
              não cria nem destrói caixa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs font-mono">
            {Object.entries(allocations).map(([cat, amt]) => (
              <div
                key={cat}
                className="flex items-center justify-between gap-3 p-2 rounded bg-[#0E131F] border border-[#1F2733]"
              >
                <span className="capitalize text-[#8B95A7]">{cat}:</span>
                <span className="text-white font-bold">{formatCurrency(amt)}</span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setIsAllocationOpen(false)
                toast({
                  title: 'Alocações Salvas',
                  description: 'Planejamento orçamentário interno atualizado para a temporada.',
                })
              }}
              className="bg-[#E10600] text-white text-xs font-bold"
            >
              Salvar Planejamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
