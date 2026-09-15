import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { financialLedgerService } from '@/services/financialLedgerService'
import { commercialService } from '@/services/commercialService'
import { managerEffectService } from '@/services/managerEffectService'
import { standingsService } from '@/services/standingsService'
import { SponsorModel, RaceResultModel } from '@/types/f1'
import { FinancialTransaction, CashSummary, CostCapSummary } from '@/types/canonical-finances'
import {
  CanonicalSponsorSlot,
  CANONICAL_SLOT_METAS,
  SponsorshipContract,
  NegotiationState,
  CommercialIntegrityReport,
  CanonicalSponsor,
} from '@/types/canonical-commercial'
import { formatCurrency } from '@/lib/formatters'
import { PageHeader } from '@/components/PageHeader'
import { AmbientBackground } from '@/components/AmbientBackground'
import { EmptyState } from '@/components/EmptyState'
import { CarSponsorMap } from '@/components/commercial/CarSponsorMap'
import { NegotiationModal } from '@/components/commercial/NegotiationModal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  DollarSign,
  Handshake,
  ShieldAlert,
  Scale,
  FileText,
  Sliders,
  Filter,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Search,
  CheckCircle2,
} from 'lucide-react'

export function SponsorsPage() {
  const { team, season, refreshTeamAndSeason } = useAuth()
  const { toast } = useToast()

  // Navegação por abas canônicas da Fase 5B:
  // 1. FINANÇAS & COST CAP (5A)
  // 2. PATROCINADORES (Contratos atuais nos 5 slots)
  // 3. MERCADO (Oportunidades & Prospecção)
  // 4. NEGOCIAÇÕES (Processos ativos)
  const [activeTab, setActiveTab] = useState<
    'financas' | 'patrocinadores' | 'mercado' | 'negociacoes'
  >('patrocinadores')

  const [loadingFinances, setLoadingFinances] = useState(true)
  const [loadingSponsors, setLoadingSponsors] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  // Dados do Ledger (5A)
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [cashSummary, setCashSummary] = useState<CashSummary>({
    cashBalance: 0,
    committedCash: 0,
    availableCash: 0,
    projectedEndCash: 0,
    seasonRevenue: 0,
    seasonExpenses: 0,
    netCashFlow: 0,
    burnRatePerRound: 0,
  })
  const [costCapSummary, setCostCapSummary] = useState<CostCapSummary>({
    annualLimit: 215_000_000,
    used: 0,
    remaining: 215_000_000,
    committed: 0,
    projected: 0,
    projectedRemaining: 215_000_000,
    status: 'confortavel',
    pctUsed: 0,
    pctProjected: 0,
  })
  const [financialAlerts, setFinancialAlerts] = useState<any[]>([])
  const [categoryExpenses, setCategoryExpenses] = useState<Record<string, number>>({})
  const [categoryRevenues, setCategoryRevenues] = useState<Record<string, number>>({})

  // Dados Comerciais (5B)
  const [sponsorsList, setSponsorsList] = useState<SponsorModel[]>([])
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [selectedSlotForFilter, setSelectedSlotForFilter] = useState<CanonicalSponsorSlot | null>(
    null,
  )
  const [activeNegotiations, setActiveNegotiations] = useState<NegotiationState[]>([])
  const [currentNegotiationModal, setCurrentNegotiationModal] = useState<NegotiationState | null>(
    null,
  )
  const [negotiationFeedback, setNegotiationFeedback] = useState<string | null>(null)
  const [prospectSector, setProspectSector] = useState<string>('todos')
  const [prospectSlot, setProspectSlot] = useState<CanonicalSponsorSlot>('sidepod')

  // Modais 5A
  const [selectedTxDetail, setSelectedTxDetail] = useState<FinancialTransaction | null>(null)
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false)
  const [whatIfCost, setWhatIfCost] = useState('5000000')
  const [whatIfCategory, setWhatIfCategory] = useState('development')
  const [whatIfDesc, setWhatIfDesc] = useState('Novo pacote aerodinâmico')
  const [simResult, setSimResult] = useState<any>(null)
  const [reversingTx, setReversingTx] = useState<FinancialTransaction | null>(null)
  const [reversalReason, setReversalReason] = useState('')
  const [isProcessingReversal, setIsProcessingReversal] = useState(false)
  const [isAllocationOpen, setIsAllocationOpen] = useState(false)
  const [allocations, setAllocations] = useState<Record<string, number>>({})
  const [filterDirection, setFilterDirection] = useState<'all' | 'inflow' | 'outflow'>('all')
  const [filterCostCap, setFilterCostCap] = useState<'all' | 'included' | 'excluded'>('all')

  // Relatório de Auditoria Comercial Canônica
  const [commercialAudit, setCommercialAudit] = useState<CommercialIntegrityReport | null>(null)

  // 1. Carregar Finanças do Ledger
  const loadFinancialData = useCallback(async () => {
    if (!team) return
    setLoadingFinances(true)
    try {
      const year = season?.year || 2026
      const round = season?.current_round || 1
      const commitments = ((team as any).financial_commitments || []) as any[]
      const txs = await financialLedgerService.getTeamTransactions(team.id, year)
      const cash = financialLedgerService.calculateCashSummary(txs, commitments, 24, round)
      const cap = financialLedgerService.calculateCostCapSummary(
        txs,
        commitments,
        215_000_000,
        24 - round,
      )
      setCashSummary(cash)
      setCostCapSummary(cap)
      setTransactions(txs)
      const alerts = financialLedgerService.generateFinancialAlerts(cash, cap)
      setFinancialAlerts(alerts)

      const expBreakdown: Record<string, number> = {}
      const revBreakdown: Record<string, number> = {}
      txs.forEach((tx) => {
        if (tx.status === 'effective') {
          if (tx.direction === 'outflow') {
            expBreakdown[tx.category] = (expBreakdown[tx.category] || 0) + tx.amount
          } else if (tx.direction === 'inflow') {
            revBreakdown[tx.category] = (revBreakdown[tx.category] || 0) + tx.amount
          }
        }
      })
      setCategoryExpenses(expBreakdown)
      setCategoryRevenues(revBreakdown)
    } catch (err) {
      console.error('Erro ao carregar dados do ledger:', err)
    } finally {
      setLoadingFinances(false)
    }
  }, [team, season])

  // 2. Carregar Patrocinadores e Resultados Esportivos
  const loadSponsors = useCallback(async () => {
    if (!team) return
    setLoadingSponsors(true)
    try {
      const [sps, results] = await Promise.all([
        f1Service.getTeamSponsors(team.id),
        f1Service.getSeasonRaceResults(season?.id || ''),
      ])
      setSponsorsList(sps)
      setRaceResults(results)

      // Carregar propostas ou negociações salvas na equipe
      const savedNegotiations = (team as any).active_negotiations || []
      setActiveNegotiations(savedNegotiations)
    } catch (err) {
      console.error('Erro ao buscar patrocinadores:', err)
    } finally {
      setLoadingSponsors(false)
    }
  }, [team, season])

  useEffect(() => {
    loadFinancialData()
    loadSponsors()
  }, [loadFinancialData, loadSponsors])

  // Converter sponsors para contratos canônicos 5B
  const canonicalContracts: SponsorshipContract[] = useMemo(() => {
    return sponsorsList.map((s) => {
      const fixedAnnual = s.fixed_annual_value || (s.value_per_round ? s.value_per_round * 24 : 0)
      let canonicalSlot = (s.slot || 'sidepod') as CanonicalSponsorSlot
      if (!CANONICAL_SLOT_METAS[canonicalSlot]) {
        if (canonicalSlot === ('laterais' as any)) canonicalSlot = 'sidepod'
        else if (canonicalSlot === ('asa_traseira' as any)) canonicalSlot = 'rear_wing'
        else if (canonicalSlot === ('bico' as any)) canonicalSlot = 'nose'
        else canonicalSlot = 'sidepod'
      }

      return {
        contractId: s.contract_id || s.id,
        sponsorId: s.sponsor_key || s.id,
        sponsorName: s.name,
        teamId: s.team_id,
        seasonStart: s.contract_start_year || season?.year || 2026,
        seasonEnd: s.contract_end_year || (season?.year || 2026) + 1,
        slot: canonicalSlot,
        packageSlots: (s.package_slots as any) || undefined,
        fixedAnnualValue: fixedAnnual,
        valuePerRound: s.value_per_round || Math.round(fixedAnnual / 24),
        paymentSchedule: 'per_round',
        bonuses: s.bonuses || [],
        objectives: s.objectives || [],
        exclusivitySector: s.exclusivity_sector as any,
        partnershipType:
          (s.partnership_type as any) || (s.is_title_sponsor ? 'title_sponsor' : 'main_partner'),
        isTitleSponsor: !!s.is_title_sponsor,
        titleNameSuffix: s.title_name_suffix,
        satisfaction: s.satisfaction ?? 80,
        renewalInterest: s.renewal_interest ?? 70,
        status: s.status === 'ativo' ? 'ativo' : 'encerrado',
        signingDate: s.created || '2026-03-01',
      }
    })
  }, [sponsorsList, season])

  // Desempenho esportivo & Commercial Attractiveness Canônica (0 a 100)
  const commercialAttractiveness = useMemo(() => {
    if (!team) return null
    const standings = standingsService.calculateStandings({
      raceResults,
      team,
      season,
    })
    return commercialService.calculateCommercialAttractiveness({
      team,
      constructorRank: standings.playerConstructorRank || 6,
      recentPodiumsCount: standings.playerPodiums || 0,
      recentWinsCount: standings.playerWins || 0,
    })
  }, [team, season, raceResults])

  // Executar auditoria de integridade comercial
  useEffect(() => {
    if (team && canonicalContracts) {
      const report = commercialService.auditCommercialIntegrity(
        team,
        canonicalContracts,
        season?.year || 2026,
        transactions,
      )
      setCommercialAudit(report)
      // Log do Debug Canônico no Console (item da especificação)
      console.log(report.debugTelemetryString)
    }
  }, [team, canonicalContracts, season, transactions])

  // Catálogo de Mercado de Patrocinadores
  const marketCatalog = useMemo(() => {
    return commercialService.getMarketCatalog()
  }, [])

  // Filtragem do mercado para prospecção ativa
  const filteredCatalog = useMemo(() => {
    return marketCatalog.filter((sp) => {
      if (prospectSector !== 'todos' && sp.sector !== prospectSector) return false
      return true
    })
  }, [marketCatalog, prospectSector])

  // Iniciar Negociação com Patrocinador do Mercado
  const handleStartNegotiation = (sponsor: CanonicalSponsor, isTitle = false) => {
    if (!team) return
    const targetSlot = prospectSlot || 'sidepod'

    // Verifica se slot já está ocupado
    const isOccupied = canonicalContracts.some(
      (c) =>
        c.status === 'ativo' &&
        (c.slot === targetSlot || (c.packageSlots && c.packageSlots.includes(targetSlot))),
    )
    if (isOccupied) {
      toast({
        variant: 'destructive',
        title: 'Espaço Ocupado',
        description: `O espaço ${CANONICAL_SLOT_METAS[targetSlot].name} já possui contrato ativo. Encerre o vínculo atual ou selecione outro slot.`,
      })
      return
    }

    // Verifica exclusividade setorial concorrente
    const sectorConflict = canonicalContracts.find(
      (c) => c.status === 'ativo' && c.exclusivitySector === sponsor.sector,
    )
    if (sectorConflict) {
      toast({
        variant: 'destructive',
        title: 'Conflito de Exclusividade Setorial',
        description: `A marca ${sectorConflict.sponsorName} possui exclusividade contratual no setor "${sponsor.sector}". Uma nova parceria é proibida.`,
      })
      return
    }

    const offer = commercialService.generateSponsorOffer({
      sponsor,
      slot: targetSlot,
      team,
      seasonYear: season?.year || 2026,
      currentRound: season?.current_round || 1,
      isTitleSponsor: isTitle,
    })

    const updatedNegs = [offer, ...activeNegotiations]
    setActiveNegotiations(updatedNegs)
    setCurrentNegotiationModal(offer)
    setNegotiationFeedback(null)

    toast({
      title: 'Proposta Comercial Recebida',
      description: `A ${sponsor.name} enviou uma oferta inicial para ${CANONICAL_SLOT_METAS[targetSlot].name}.`,
    })
  }

  // Avaliar Contraproposta do Jogador
  const handleCounterOffer = (counter: {
    fixedAnnualValue: number
    durationYears: number
    exclusivity: boolean
  }) => {
    if (!currentNegotiationModal || !team) return
    setIsProcessing(true)
    try {
      const evaluation = commercialService.evaluateCounterOffer(
        currentNegotiationModal,
        counter,
        team,
      )

      setCurrentNegotiationModal(evaluation.updatedNegotiation)
      setNegotiationFeedback(evaluation.feedbackMessage)

      // Atualiza lista de negociações
      setActiveNegotiations((prev) =>
        prev.map((n) =>
          n.id === evaluation.updatedNegotiation.id ? evaluation.updatedNegotiation : n,
        ),
      )

      if (evaluation.outcome === 'accepted') {
        toast({
          title: 'Contraproposta Aceita!',
          description: evaluation.feedbackMessage,
        })
      } else if (evaluation.outcome === 'compromise') {
        toast({
          title: 'Contraoferta da Marca',
          description: evaluation.feedbackMessage,
        })
      } else if (evaluation.outcome === 'walked_away') {
        toast({
          variant: 'destructive',
          title: 'Negociação Fracassada',
          description: evaluation.feedbackMessage,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Proposta Recusada',
          description: evaluation.feedbackMessage,
        })
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Assinar Contrato e Integrar ao Ledger Canônico
  const handleAcceptAndSignContract = async () => {
    if (!currentNegotiationModal || !team) return
    setIsProcessing(true)
    try {
      const newContract = commercialService.finalizeContract(
        currentNegotiationModal,
        team.id,
        season?.year || 2026,
      )

      // 1. Gravar registro em PocketBase 'sponsors' com campos canônicos 5B
      await f1Service.createSponsor({
        name: newContract.sponsorName,
        slot: newContract.slot,
        value_per_round: newContract.valuePerRound,
        requirement: newContract.objectives?.[0]?.description || 'Cumprimento de metas contratuais',
        status: 'ativo',
        rounds_remaining: 24,
        team_id: team.id,
        sponsor_key: newContract.sponsorId,
        sector: currentNegotiationModal.sector,
        country: currentNegotiationModal.country,
        fixed_annual_value: newContract.fixedAnnualValue,
        contract_start_year: newContract.seasonStart,
        contract_end_year: newContract.seasonEnd,
        satisfaction: newContract.satisfaction,
        renewal_interest: newContract.renewalInterest,
        is_title_sponsor: newContract.isTitleSponsor,
        title_name_suffix: newContract.titleNameSuffix,
        exclusivity_sector: newContract.exclusivitySector,
        partnership_type: newContract.partnershipType,
        package_slots: newContract.packageSlots,
        bonuses: newContract.bonuses,
        objectives: newContract.objectives,
        contract_id: newContract.contractId,
      })

      // 2. Registrar Compromisso Financeiro no Financial Ledger 5A (Idempotente)
      await financialLedgerService.postTransaction({
        teamId: team.id,
        seasonYear: season?.year || 2026,
        round: season?.current_round || 1,
        type: 'revenue',
        category: 'sponsorship',
        subcategory: `sponsor_signed_${newContract.slot}`,
        direction: 'neutral', // Compromisso plurianual de receita futura
        amount: newContract.fixedAnnualValue,
        costCapClassification: 'excluded',
        sourceSystem: 'sponsor_contract',
        sourceEntityId: newContract.contractId,
        idempotencyKey: `sponsor_signed_${team.id}_${newContract.contractId}`,
        description: `Contrato Comercial Canônico firmado com ${newContract.sponsorName} (${CANONICAL_SLOT_METAS[newContract.slot].name}): ${formatCurrency(newContract.fixedAnnualValue)}/ano até ${newContract.seasonEnd}`,
      })

      toast({
        title: 'Contrato de Patrocínio Assinado!',
        description: `Vínculo oficializado com ${newContract.sponsorName} por ${formatCurrency(newContract.fixedAnnualValue)}/ano.`,
      })

      // Remover negociação ativa
      setActiveNegotiations((prev) => prev.filter((n) => n.id !== currentNegotiationModal.id))
      setCurrentNegotiationModal(null)
      loadSponsors()
      loadFinancialData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao Assinar Contrato',
        description: err?.message || 'Falha ao registrar contrato comercial.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Encerrar Negociação Ativa
  const handleRejectNegotiation = () => {
    if (!currentNegotiationModal) return
    setActiveNegotiations((prev) => prev.filter((n) => n.id !== currentNegotiationModal.id))
    setCurrentNegotiationModal(null)
    toast({
      title: 'Negociação Encerrada',
      description: 'A proposta comercial foi descartada.',
    })
  }

  // Encerrar Contrato Ativo Antecipadamente
  const handleTerminateActiveContract = async (contract: SponsorshipContract) => {
    if (!team) return
    if (
      !confirm(
        `Deseja realmente rescindir a parceria com a ${contract.sponsorName}? O espaço ${contract.slot} ficará vago e a receita será cancelada.`,
      )
    )
      return

    setIsProcessing(true)
    try {
      // Localiza sponsor correspondente
      const target = sponsorsList.find(
        (s) => s.id === contract.contractId || s.name === contract.sponsorName,
      )
      if (target) {
        await f1Service.updateSponsor(target.id, { status: 'encerrado' })
      }

      toast({
        title: 'Contrato Rescindido',
        description: `O espaço ${contract.slot} agora está liberado para novas propostas.`,
      })
      loadSponsors()
      loadFinancialData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao Rescindir',
        description: err?.message || 'Falha ao encerrar patrocínio.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Simulador What-If 5A
  const handleRunSimulation = () => {
    if (!cashSummary || !costCapSummary || !team) return
    const cost = parseFloat(whatIfCost) || 0
    const res = financialLedgerService.simulateFinancialImpact({
      team: team as any,
      actionDescription: whatIfDesc,
      costAmount: cost,
      category: whatIfCategory as any,
      currentTransactions: transactions,
      currentRound: season?.current_round || 1,
      totalRounds: 24,
    })
    setSimResult(res)
  }

  // Estorno Contábil 5A
  const handleConfirmReversal = async () => {
    if (!reversingTx || !reversalReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Justificativa Obrigatória',
        description: 'Informe uma justificativa contábil para o estorno.',
      })
      return
    }

    setIsProcessingReversal(true)
    try {
      await financialLedgerService.reverseTransaction(reversingTx.id, reversalReason.trim())
      toast({
        title: 'Transação Estornada com Sucesso',
        description: 'Lançamento compensatório registrado e saldos recalculados.',
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

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterDirection === 'inflow' && tx.direction !== 'inflow') return false
      if (filterDirection === 'outflow' && tx.direction !== 'outflow') return false
      if (filterCostCap === 'included' && tx.cost_cap_classification !== 'included') return false
      if (filterCostCap === 'excluded' && tx.cost_cap_classification !== 'excluded') return false
      return true
    })
  }, [transactions, filterDirection, filterCostCap])

  const totalActiveFixedAnnual = useMemo(() => {
    return canonicalContracts
      .filter((c) => c.status === 'ativo')
      .reduce((sum, c) => sum + c.fixedAnnualValue, 0)
  }, [canonicalContracts])

  return (
    <div className="relative space-y-6 animate-fade-in-up text-[#F5F7FA]">
      <AmbientBackground />

      {/* Header Centralizado */}
      <PageHeader
        eyebrow="CENTRO DE OPERAÇÕES COMERCIAIS & FINANCEIRAS // F1 2026"
        title="Comercial, Patrocinadores & Contratos"
        description="Gestão integrada dos 5 espaços de patrocínio, negociações estratégicas, satisfação de marcas e integração ao Livro Razão canônico."
        badge={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="font-mono text-xs border-emerald-500 text-emerald-400 bg-emerald-950/40"
            >
              Receita Comercial Fixa: {formatCurrency(totalActiveFixedAnnual)}/ano
            </Badge>
          </div>
        }
      />

      {/* Navegação entre as 4 Abas Canônicas */}
      <div className="flex flex-wrap items-center justify-between border-b border-[#1F2733] pb-2 gap-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={activeTab === 'patrocinadores' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('patrocinadores')}
            className={`text-xs font-bold gap-2 ${
              activeTab === 'patrocinadores'
                ? 'bg-[#E10600] text-white hover:bg-[#b80500]'
                : 'text-[#8B95A7] hover:text-white'
            }`}
          >
            <Handshake className="w-4 h-4" />
            Patrocinadores Atuais ({canonicalContracts.filter((c) => c.status === 'ativo').length}
            /5)
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'mercado' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('mercado')}
            className={`text-xs font-bold gap-2 ${
              activeTab === 'mercado'
                ? 'bg-[#E10600] text-white hover:bg-[#b80500]'
                : 'text-[#8B95A7] hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
            Mercado & Oportunidades
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'negociacoes' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('negociacoes')}
            className={`text-xs font-bold gap-2 ${
              activeTab === 'negociacoes'
                ? 'bg-[#E10600] text-white hover:bg-[#b80500]'
                : 'text-[#8B95A7] hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Mesa de Negociações ({activeNegotiations.length})
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'financas' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('financas')}
            className={`text-xs font-bold gap-2 ${
              activeTab === 'financas'
                ? 'bg-[#E10600] text-white hover:bg-[#b80500]'
                : 'text-[#8B95A7] hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Finanças & Cost Cap (5A)
          </Button>
        </div>

        {/* Auditoria Rápida */}
        {commercialAudit && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <Badge
              variant="outline"
              className={
                commercialAudit.financialLedgerIntegrity === 'PASS'
                  ? 'border-emerald-500/50 text-emerald-400 bg-emerald-950/20'
                  : 'border-amber-500/50 text-amber-400 bg-amber-950/20'
              }
            >
              Auditoria Comercial: {commercialAudit.financialLedgerIntegrity}
            </Badge>
          </div>
        )}
      </div>

      {/* CONTEÚDO DA ABA 1: PATROCINADORES ATUAIS */}
      {activeTab === 'patrocinadores' && (
        <div className="space-y-6">
          {/* Mapa Visual dos 5 Espaços do Carro */}
          <CarSponsorMap
            contracts={canonicalContracts}
            selectedSlot={selectedSlotForFilter}
            onSelectSlot={(s) => setSelectedSlotForFilter(s === selectedSlotForFilter ? null : s)}
            commercialAttractivenessScore={commercialAttractiveness?.score || 75}
          />

          {/* Cards dos 5 Slots com Market Value Estimado e Detalhamento */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
              <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                Status das 5 Cotas Oficiais
              </span>
              <span className="text-xs text-[#8B95A7] font-mono">
                Receita Fixa Total:{' '}
                <strong className="text-emerald-400">
                  {formatCurrency(totalActiveFixedAnnual)}/ano
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(
                [
                  'sidepod',
                  'engine_cover',
                  'rear_wing',
                  'nose',
                  'front_wing',
                ] as CanonicalSponsorSlot[]
              ).map((slotKey) => {
                const meta = CANONICAL_SLOT_METAS[slotKey]
                const activeContract = canonicalContracts.find(
                  (c) =>
                    c.status === 'ativo' &&
                    (c.slot === slotKey || (c.packageSlots && c.packageSlots.includes(slotKey))),
                )

                // Faixa de Market Value Estimada pelo Tier
                const tier = commercialAttractiveness?.tier || 'intermediaria'
                const range =
                  tier === 'fundo'
                    ? meta.baseAnchors.backmarker
                    : tier === 'ponta'
                      ? meta.baseAnchors.topTeam
                      : meta.baseAnchors.midfield

                return (
                  <div
                    key={slotKey}
                    className="rounded-xl border border-[#1F2733] bg-[#0B0E14] p-4 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#8B95A7] uppercase">
                          Cota: {meta.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] font-mono uppercase ${
                            activeContract
                              ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                              : 'border-neutral-700 text-neutral-400'
                          }`}
                        >
                          {activeContract ? 'OCUPADO' : 'VAGO (R$ 0)'}
                        </Badge>
                      </div>

                      {activeContract ? (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-base text-white truncate">
                              {activeContract.sponsorName}
                            </h4>
                            {activeContract.isTitleSponsor && (
                              <Badge className="text-[8px] bg-amber-950 text-amber-300 border-amber-500">
                                TITLE SPONSOR
                              </Badge>
                            )}
                          </div>
                          <div className="text-lg font-black font-mono text-emerald-400">
                            {formatCurrency(activeContract.fixedAnnualValue)}/ano
                          </div>
                          <p className="text-[11px] text-[#8B95A7]">
                            {formatCurrency(activeContract.valuePerRound)}/GP • Vigência até{' '}
                            {activeContract.seasonEnd}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 p-3 rounded-lg bg-[#0E131F] border border-dashed border-[#1F2733] text-center space-y-1">
                          <span className="text-xs text-neutral-400 block font-mono">
                            Espaço sem patrocinador
                          </span>
                          <span className="text-[11px] font-bold text-white block">
                            Receita Atual: R$ 0,00
                          </span>
                          <span className="text-[10px] text-[#8B95A7] block font-mono">
                            Nenhum fallback oculto
                          </span>
                        </div>
                      )}

                      <div className="mt-3 pt-2 border-t border-[#1F2733]/60 space-y-1 text-xs font-mono">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#8B95A7]">Market Value Estimado:</span>
                          <span className="text-cyan-400 font-bold">
                            R$ {(range.min / 1_000_000).toFixed(0)}M – R${' '}
                            {(range.max / 1_000_000).toFixed(0)}M
                          </span>
                        </div>

                        {activeContract && (
                          <>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-[#8B95A7]">Satisfação da Marca:</span>
                              <span
                                className={
                                  activeContract.satisfaction >= 75
                                    ? 'text-emerald-400 font-bold'
                                    : 'text-amber-400 font-bold'
                                }
                              >
                                {activeContract.satisfaction}% (Estável)
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-[#8B95A7]">Interesse em Renovar:</span>
                              <span className="text-white font-bold">
                                {activeContract.renewalInterest}%
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      {activeContract ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTerminateActiveContract(activeContract)}
                          className="w-full text-xs h-7 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                        >
                          Rescindir Contrato
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setProspectSlot(slotKey)
                            setActiveTab('mercado')
                          }}
                          className="w-full text-xs h-8 bg-[#E10600] hover:bg-[#b80500] text-white font-bold"
                        >
                          Procurar Patrocinador
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: MERCADO & OPORTUNIDADES */}
      {activeTab === 'mercado' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-[#0B0E14] border border-[#1F2733] p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2733] pb-3">
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                  PROSPECÇÃO ATIVA DE PATROCÍNIO
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                  <Search className="w-4 h-4 text-cyan-400" />
                  Catálogo de Empresas Interessadas
                </h3>
              </div>

              {/* Filtros de Prospecção */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-[#0E131F] border border-[#1F2733] rounded-lg p-1 text-xs">
                  <span className="text-[#8B95A7] px-1 font-mono">Espaço Alvo:</span>
                  <select
                    value={prospectSlot}
                    onChange={(e: any) => setProspectSlot(e.target.value)}
                    className="bg-transparent text-white font-mono border-none focus:outline-none"
                  >
                    <option value="sidepod" className="bg-[#0B0E14]">
                      Lateral / Sidepod
                    </option>
                    <option value="engine_cover" className="bg-[#0B0E14]">
                      Tampa do Motor / Engine Cover
                    </option>
                    <option value="rear_wing" className="bg-[#0B0E14]">
                      Asa Traseira / Rear Wing
                    </option>
                    <option value="nose" className="bg-[#0B0E14]">
                      Bico / Nose
                    </option>
                    <option value="front_wing" className="bg-[#0B0E14]">
                      Asa Dianteira / Front Wing
                    </option>
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-[#0E131F] border border-[#1F2733] rounded-lg p-1 text-xs">
                  <span className="text-[#8B95A7] px-1 font-mono">Setor:</span>
                  <select
                    value={prospectSector}
                    onChange={(e: any) => setProspectSector(e.target.value)}
                    className="bg-transparent text-white font-mono border-none focus:outline-none"
                  >
                    <option value="todos" className="bg-[#0B0E14]">
                      Todos os Setores
                    </option>
                    <option value="bancos" className="bg-[#0B0E14]">
                      Bancos & Financeiro
                    </option>
                    <option value="fintech" className="bg-[#0B0E14]">
                      Fintechs
                    </option>
                    <option value="tecnologia" className="bg-[#0B0E14]">
                      Tecnologia & IA
                    </option>
                    <option value="energia" className="bg-[#0B0E14]">
                      Energia & Combustíveis
                    </option>
                    <option value="automotivo" className="bg-[#0B0E14]">
                      Automotivo
                    </option>
                    <option value="logistica" className="bg-[#0B0E14]">
                      Logística & Aviação
                    </option>
                    <option value="industrial" className="bg-[#0B0E14]">
                      Industrial
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Grid de Marcas do Mercado */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCatalog.map((sp) => {
                const fit = commercialService.calculateSponsorFit(sp, team || {})
                const evaluated = commercialService.generateContractOfferValue({
                  slot: prospectSlot,
                  team: team || {},
                  sponsor: sp,
                })

                const isAlreadySigned = canonicalContracts.some(
                  (c) => c.status === 'ativo' && c.sponsorId === sp.sponsorId,
                )

                return (
                  <div
                    key={sp.sponsorId}
                    className="p-4 rounded-xl border border-[#1F2733] bg-[#0E131F] flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-white">{sp.name}</h4>
                          <span className="text-[11px] text-[#8B95A7]">
                            {sp.country} • Setor:{' '}
                            <strong className="text-white capitalize">{sp.sector}</strong>
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono border-neutral-700 text-neutral-300 uppercase"
                        >
                          {sp.budgetTier}
                        </Badge>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#090D15] border border-[#1F2733] mt-3 space-y-1 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-[#8B95A7]">Oferta Estimada ({prospectSlot}):</span>
                          <strong className="text-emerald-400 font-bold">
                            {formatCurrency(evaluated.annualValue)}/ano
                          </strong>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#8B95A7]">Sponsor Fit:</span>
                          <span className="text-cyan-400 font-bold">
                            {(fit.fitMultiplier * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#8B95A7]">Exigência Esportiva:</span>
                          <span className="text-white uppercase">{sp.performanceExpectation}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      {isAlreadySigned ? (
                        <div className="p-2 text-center rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                          ✓ Patrocinador já Ativo
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleStartNegotiation(sp, false)}
                            className="flex-1 bg-[#E10600] hover:bg-[#b80500] text-white text-xs font-bold h-8"
                          >
                            Abrir Negociação
                          </Button>
                          {(prospectSlot === 'sidepod' || prospectSlot === 'engine_cover') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartNegotiation(sp, true)}
                              className="text-[11px] h-8 border-amber-500/40 text-amber-400 hover:bg-amber-950/30"
                              title="Negociar como Title Sponsor (+25% premium)"
                            >
                              Title Sponsor
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: MESA DE NEGOCIAÇÕES */}
      {activeTab === 'negociacoes' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-[#0B0E14] border border-[#1F2733] p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F2733] pb-3">
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                  PROCESSOS EM ANDAMENTO
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  Mesa de Negociações Comerciais Ativas ({activeNegotiations.length})
                </h3>
              </div>
            </div>

            {activeNegotiations.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Nenhuma negociação em andamento"
                description="Explore a aba de Mercado para iniciar conversas com empresas interessadas em patrocinar sua equipe."
                compact
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeNegotiations.map((neg) => {
                  return (
                    <div
                      key={neg.id}
                      className="p-4 rounded-xl border border-[#1F2733] bg-[#0E131F] space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-base text-white">{neg.sponsorName}</h4>
                            <span className="text-xs text-[#8B95A7]">
                              Cota: <strong className="text-white uppercase">{neg.slot}</strong> •{' '}
                              {neg.country}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono border-amber-500 text-amber-400"
                          >
                            Rodada {neg.roundsCount}/{neg.maxRounds}
                          </Badge>
                        </div>

                        <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] mt-3 space-y-1 text-xs font-mono">
                          <div className="flex justify-between">
                            <span className="text-[#8B95A7]">Oferta Atual:</span>
                            <strong className="text-emerald-400 text-sm">
                              {formatCurrency(neg.currentSponsorOffer.fixedAnnualValue)}/ano
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8B95A7]">Duração:</span>
                            <span className="text-white">
                              {neg.currentSponsorOffer.durationYears} temporadas
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8B95A7]">Risco de Rejeição:</span>
                            <span className="text-amber-400 uppercase">{neg.rejectionRisk}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setCurrentNegotiationModal(neg)
                            setNegotiationFeedback(null)
                          }}
                          className="flex-1 bg-[#E10600] hover:bg-[#b80500] text-white text-xs font-bold h-8"
                        >
                          Entrar na Mesa de Reunião
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setActiveNegotiations((prev) => prev.filter((n) => n.id !== neg.id))
                          }}
                          className="text-xs h-8 text-neutral-400 hover:text-red-400"
                        >
                          Descartar
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 4: FINANÇAS & COST CAP (5A) */}
      {activeTab === 'financas' && (
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

          {/* SEÇÃO 2: CAIXA REAL VS COST CAP FIA (5A) */}
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
                    Espaço até atingir o teto regulatório
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

          {/* SEÇÃO 3: LIVRO RAZÃO CANÔNICO */}
          <div className="rounded-xl bg-[#0B0E14] border border-[#1F2733] p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1F2733] pb-3">
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-[#E10600] block">
                  LIVRO RAZÃO CANÔNICO
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#E10600]" />
                  Transações Contábeis Auditáveis ({transactions.length} registros)
                </h3>
              </div>

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
                  What-If Simulador
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={loadFinancialData}
                  className="text-xs text-[#8B95A7] hover:text-white h-8 w-8 p-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {loadingFinances ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full bg-[#161D29]" />
                <Skeleton className="h-10 w-full bg-[#161D29]" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhuma transação encontrada"
                description="Os lançamentos financeiros gerados por P&D, Salários e Patrocínios aparecerão aqui."
                compact
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1F2733] text-[#8B95A7] text-[11px]">
                      <th className="py-2 px-3">GP / Data</th>
                      <th className="py-2 px-3">Descrição & Origem</th>
                      <th className="py-2 px-3">Categoria</th>
                      <th className="py-2 px-3 text-right">Impacto Caixa</th>
                      <th className="py-2 px-3 text-right">Cost Cap FIA</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2733]/50">
                    {filteredTransactions.map((tx) => {
                      const isInflow = tx.direction === 'inflow'
                      return (
                        <tr key={tx.id} className="hover:bg-[#121824] transition-colors">
                          <td className="py-2 px-3 text-[#8B95A7] whitespace-nowrap">
                            {tx.date_display || `R${tx.round || 1}`}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-white block truncate max-w-sm">
                              {tx.description}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant="outline"
                              className="text-[10px] border-[#1F2733] bg-[#0E131F] text-[#F5F7FA] uppercase"
                            >
                              {tx.category}
                            </Badge>
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-bold whitespace-nowrap ${
                              isInflow ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isInflow ? '+' : ''}
                            {formatCurrency(tx.cash_impact)}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            {tx.cost_cap_impact > 0 ? (
                              <span className="text-amber-400 font-bold">
                                {formatCurrency(tx.cost_cap_impact)}
                              </span>
                            ) : (
                              <span className="text-[#8B95A7]">Isento</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase border-emerald-500/40 text-emerald-400 bg-emerald-950/20"
                            >
                              {tx.status}
                            </Badge>
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
      )}

      {/* MODAL DE NEGOCIAÇÃO COMERCIAL (Fase 5B) */}
      <NegotiationModal
        isOpen={!!currentNegotiationModal}
        negotiation={currentNegotiationModal}
        onClose={() => setCurrentNegotiationModal(null)}
        onCounterOffer={handleCounterOffer}
        onAcceptSponsorOffer={handleAcceptAndSignContract}
        onRejectOffer={handleRejectNegotiation}
        isProcessing={isProcessing}
        feedbackMessage={negotiationFeedback}
      />

      {/* MODAL SIMULADOR WHAT-IF (5A) */}
      <Dialog open={isWhatIfOpen} onOpenChange={setIsWhatIfOpen}>
        <DialogContent className="bg-[#0B0E14] border border-[#1F2733] text-[#F5F7FA] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Scale className="w-4 h-4 text-cyan-400" />
              Simulador de Impacto Financeiro (What-If)
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Avalie como um novo investimento afetará o caixa e o Cost Cap regulatório antes de
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
    </div>
  )
}
export default SponsorsPage
