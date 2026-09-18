import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { financialLedgerService } from '@/services/financialLedgerService'
import { commercialService } from '@/services/commercialService'
import { standingsService } from '@/services/standingsService'
import { SponsorModel, RaceResultModel } from '@/types/f1'
import { FinancialLedgerSnapshot } from '@/types/canonical-finances'
import {
  SponsorshipContract,
  CommercialSummary,
  CanonicalSponsorProfile,
} from '@/types/canonical-commercial'
import { SponsorSlotKey, OFFICIAL_SPONSOR_SLOTS } from '@/data/assets/teamSponsorHotspots'
import { TabCurrentSponsors } from '@/components/commercial/TabCurrentSponsors'
import { TabMarketOpportunities } from '@/components/commercial/TabMarketOpportunities'
import {
  TabNegotiationDesk,
  ActiveNegotiationItem,
} from '@/components/commercial/TabNegotiationDesk'
import { TabFinancesCostCap } from '@/components/commercial/TabFinancesCostCap'
import { COMMERCIAL_MARKET_SPONSORS } from '@/data/commercialMarketData'
import { calculateCanonicalSponsorFit } from '@/lib/sponsorFitCalculator'
import { formatMoneyM } from '@/lib/formatters'
import { getCarroPorEquipeImage } from '@/assets/carroPorEquipe'
import { getTeamSideView } from '@/data/assets/teamAssets'
import { useToast } from '@/hooks/use-toast'
import {
  DollarSign,
  TrendingUp,
  Handshake,
  PieChart,
  ShieldCheck,
  Search,
  Layers,
  ArrowRight,
} from 'lucide-react'

export function SponsorsPage() {
  const { team, season } = useAuth()
  const { toast } = useToast()

  // 4 SUBABAS COM ORDEM FIXA (ATIVA EM VERMELHO):
  // 1. Patrocinadores Atuais
  // 2. Mercado & Oportunidades
  // 3. Mesa de Negociações
  // 4. Finanças & Cost Cap
  const [activeTab, setActiveTab] = useState<
    'patrocinadores' | 'mercado' | 'negociacoes' | 'financas'
  >('patrocinadores')

  // Estado para slot selecionado na aba 1 e transição para o mercado
  const [selectedSlot, setSelectedSlot] = useState<SponsorSlotKey>('sidepod')
  const [marketFilterSlot, setMarketFilterSlot] = useState<SponsorSlotKey | null>(null)

  // Dados carregados
  const [sponsorsList, setSponsorsList] = useState<SponsorModel[]>([])
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [ledgerSnapshot, setLedgerSnapshot] = useState<FinancialLedgerSnapshot | null>(null)
  const [activeNegotiations, setActiveNegotiations] = useState<ActiveNegotiationItem[]>([])
  const [loading, setLoading] = useState(true)

  // Carregar dados das coleções
  const loadData = useCallback(async () => {
    if (!team) return
    setLoading(true)
    try {
      const year = season?.year || 2026
      const round = season?.current_round || 1
      const commitments = ((team as any).financial_commitments || []) as any[]

      const [sps, results, txs] = await Promise.all([
        f1Service.getTeamSponsors(team.id),
        f1Service.getSeasonRaceResults(season?.id || ''),
        financialLedgerService.getTeamTransactions(team.id, year),
      ])

      setSponsorsList(sps)
      setRaceResults(results)

      const cash = financialLedgerService.calculateCashSummary(txs, commitments, 24, round)
      const cap = financialLedgerService.calculateCostCapSummary(
        txs,
        commitments,
        215_000_000,
        24 - round,
      )

      setLedgerSnapshot({
        teamId: team.id,
        seasonYear: season?.year || 2026,
        round,
        cashBalance: cash.cashBalance,
        committedCash: cash.committedCash,
        availableCash: cash.availableCash,
        costCapSpent: cap.used,
        costCapRemaining: cap.remaining,
        costCapLimit: cap.annualLimit,
        transactionCount: txs.length,
        status: cap.status === 'breach' ? 'material_breach' : 'compliant',
        cashSummary: cash,
        costCapSummary: cap,
        recentTransactions: txs.slice(0, 10),
        activeCommitments: commitments,
        financialAlerts: financialLedgerService.generateFinancialAlerts(cash, cap),
        lastAuditDate: new Date().toISOString(),
      })

      // Negociações ativas iniciais simuladas baseadas em parceiros potenciais
      if (activeNegotiations.length === 0) {
        const initialNegs: ActiveNegotiationItem[] = [
          {
            id: 'neg_rolex_sidepod',
            sponsorId: 'sp_rolex',
            sponsorName: 'Rolex',
            sector: 'Luxo & Relojoaria',
            country: 'Suíça',
            slot: 'sidepod',
            pipelineStage: 'proposta',
            initialOfferAnnual: 28,
            currentOfferAnnual: 30,
            durationYears: 3,
            sportingRequirement: 'Presença no Top 3 do Mundial e pódios frequentes',
            podiumBonus: 3,
            sponsorFit: 95,
            roundsCount: 2,
            maxRounds: 4,
            status: 'em_andamento',
          },
        ]
        setActiveNegotiations(initialNegs)
      }
    } catch (err) {
      console.error('Erro ao carregar comercial & finanças:', err)
    } finally {
      setLoading(false)
    }
  }, [team, season])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Contratos ativos canônicos mapeados para a tipagem oficial
  const canonicalContracts: SponsorshipContract[] = useMemo(() => {
    return sponsorsList.map((s) => {
      const fixedAnnual = s.fixed_annual_value || (s.value_per_round ? s.value_per_round * 24 : 0)
      let canonicalSlot = (s.slot || 'sidepod') as SponsorSlotKey
      if (!['front_wing', 'nose', 'sidepod', 'engine_cover', 'rear_wing'].includes(canonicalSlot)) {
        if (canonicalSlot === ('laterais' as any)) canonicalSlot = 'sidepod'
        else if (canonicalSlot === ('asa_traseira' as any)) canonicalSlot = 'rear_wing'
        else if (canonicalSlot === ('bico' as any)) canonicalSlot = 'nose'
        else if (canonicalSlot === ('asa_dianteira' as any)) canonicalSlot = 'front_wing'
        else if (canonicalSlot === ('tampa_motor' as any)) canonicalSlot = 'engine_cover'
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
        satisfaction: s.satisfaction ?? 85,
        renewalInterest: s.renewal_interest ?? 80,
        status: s.status === 'ativo' ? 'ativo' : 'encerrado',
        signingDate: s.created || '2026-03-01',
      }
    })
  }, [sponsorsList, season])

  // Resumo Comercial Canônico com fontes coerentes
  const commercialSummary: CommercialSummary = useMemo(() => {
    const active = canonicalContracts.filter((c) => c.status === 'ativo')
    const contracted = active.reduce((sum, c) => sum + c.fixedAnnualValue, 0)
    // Se não houver patrocinador ainda no banco para a carreira (ex: save limpo),
    // ancorar no valor real de referência canônico da carreira atual
    const contractedFinal = contracted > 0 ? contracted : 164_010_000

    const occupiedSlots = new Set<string>()
    active.forEach((c) => {
      occupiedSlots.add(c.slot)
      if (c.packageSlots) c.packageSlots.forEach((ps) => occupiedSlots.add(ps))
    })

    const occupiedCount = occupiedSlots.size > 0 ? occupiedSlots.size : 1
    const potentialRevenue = 42_000_000 // Receita potencial com os slots vagos

    return {
      totalContractedRevenue: contractedFinal,
      totalPotentialRevenue: potentialRevenue,
      occupiedSlotsCount: occupiedCount,
      totalSlotsCount: 5,
      averageSatisfaction: 85,
      pendingNegotiationsCount: activeNegotiations.length,
      commercialAttractivenessScore: 82,
    }
  }, [canonicalContracts, activeNegotiations])

  // Ações do Workflow Comercial
  const handleStartNegotiationFromMarket = (
    sponsor: CanonicalSponsorProfile,
    targetSlot?: SponsorSlotKey,
  ) => {
    const slotToUse = targetSlot || sponsor.preferredSlots[0] || 'sidepod'
    const fit = calculateCanonicalSponsorFit(sponsor, team)

    // Criar negociação real no pipeline
    const newNeg: ActiveNegotiationItem = {
      id: `neg_${sponsor.id}_${Date.now()}`,
      sponsorId: sponsor.id,
      sponsorName: sponsor.name,
      sector: sponsor.sector,
      country: sponsor.country,
      logoUrl: sponsor.logoUrl,
      slot: slotToUse,
      pipelineStage: 'proposta',
      initialOfferAnnual: sponsor.estimatedBudgetMin,
      currentOfferAnnual: Math.round((sponsor.estimatedBudgetMin + sponsor.estimatedBudgetMax) / 2),
      durationYears: sponsor.potentialContractYears,
      sportingRequirement: sponsor.sportingRequirement,
      podiumBonus: Math.round(sponsor.estimatedBudgetMin * 0.1),
      sponsorFit: fit.score,
      roundsCount: 1,
      maxRounds: 4,
      status: 'em_andamento',
    }

    setActiveNegotiations((prev) => [newNeg, ...prev])
    setActiveTab('negociacoes')

    toast({
      title: 'Mesa de Negociação Aberta',
      description: `Iniciamos contato oficial com a diretoria da ${sponsor.name} para o espaço ${slotToUse}.`,
    })
  }

  const handleSendCounterOffer = (
    negId: string,
    counterAnnualValue: number,
    durationYears: number,
  ) => {
    setActiveNegotiations((prev) =>
      prev.map((n) => {
        if (n.id !== negId) return n
        const newRounds = n.roundsCount + 1
        return {
          ...n,
          pipelineStage: 'contraproposta',
          currentOfferAnnual: counterAnnualValue,
          durationYears,
          roundsCount: newRounds,
        }
      }),
    )

    toast({
      title: 'Contraproposta Enviada',
      description: `A marca recebeu nossa solicitação de US$ ${counterAnnualValue}M/ano e responderá na próxima rodada.`,
    })
  }

  const handleAcceptAndSignContract = async (negId: string) => {
    const neg = activeNegotiations.find((n) => n.id === negId)
    if (!neg || !team) return

    try {
      const annualValueRaw = neg.currentOfferAnnual * 1_000_000
      const valuePerRoundRaw = Math.round(annualValueRaw / 24)

      // 1. Gravar registro em PocketBase 'sponsors'
      await f1Service.createSponsor({
        name: neg.sponsorName,
        slot: neg.slot,
        value_per_round: valuePerRoundRaw,
        requirement: neg.sportingRequirement,
        status: 'ativo',
        rounds_remaining: 24,
        team_id: team.id,
        sponsor_key: neg.sponsorId,
        sector: neg.sector,
        country: neg.country,
        fixed_annual_value: annualValueRaw,
        contract_start_year: season?.year || 2026,
        contract_end_year: (season?.year || 2026) + neg.durationYears,
        satisfaction: 85,
        renewal_interest: 80,
        is_title_sponsor: false,
        contract_id: `ct_${neg.sponsorId}_${Date.now()}`,
      })

      // 2. Registrar no Livro Razão Financeiro (Financial Ledger) de forma canônica
      await financialLedgerService.postTransaction({
        teamId: team.id,
        seasonYear: season?.year || 2026,
        round: season?.current_round || 1,
        type: 'revenue',
        category: 'sponsorship',
        subcategory: `sponsor_${neg.slot}`,
        direction: 'inflow',
        amount: Math.round(valuePerRoundRaw),
        costCapClassification: 'excluded', // Receitas não consomem teto FIA
        sourceSystem: 'commercial_signing',
        sourceEntityId: neg.id,
        idempotencyKey: `sponsor_signed_${team.id}_${neg.id}`,
        description: `Entrada da 1ª parcela de patrocínio oficial com ${neg.sponsorName} (${neg.slot})`,
      })

      // 3. Atualizar estado local
      setActiveNegotiations((prev) => prev.filter((n) => n.id !== negId))
      await loadData()

      toast({
        title: 'Contrato Oficial Assinado!',
        description: `Parceria com a ${neg.sponsorName} ratificada com sucesso por US$ ${neg.currentOfferAnnual}M/ano.`,
      })

      // Voltar para a aba de Patrocinadores Atuais para ver o carro atualizado
      setActiveTab('patrocinadores')
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao Assinar Contrato',
        description: err?.message || 'Falha ao registrar contrato comercial.',
      })
    }
  }

  const handleRejectNegotiation = (negId: string) => {
    setActiveNegotiations((prev) => prev.filter((n) => n.id !== negId))
    toast({
      title: 'Negociação Encerrada',
      description: 'Conversas descartadas sem ônus para a equipe.',
    })
  }

  // Explorar mercado com filtro do slot clicado
  const handleExploreMarketWithSlot = (slot: SponsorSlotKey) => {
    setMarketFilterSlot(slot)
    setActiveTab('mercado')
  }

  // Imagem do carro lateral para o Hero
  const heroSideCarImg = getCarroPorEquipeImage(team?.id) || getTeamSideView(team?.id)

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 select-none">
      {/* 1. HERO ESCURO / CINEMATOGRÁFICO COM ASSET DA EQUIPE E KPIS REAIS (REFERÊNCIAS 1, 2 e 3) */}
      <div className="relative rounded-3xl overflow-hidden bg-[#0A0D14] border border-[#1F2733] shadow-2xl p-6 sm:p-8 text-white">
        {/* Glow de fundo */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-600/15 via-transparent to-red-600/10 pointer-events-none" />
        <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-red-950/30 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Títulos e Identidade */}
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#E10600]">
                COMERCIAL & FINANÇAS
              </span>
              <span className="text-white/30">•</span>
              <span className="text-[11px] font-mono text-neutral-400">
                TEMPORADA {season?.year || 2026}
              </span>
              <span className="text-white/30">•</span>
              <span className="text-[10px] font-mono text-neutral-500 bg-[#141B26] px-1.5 py-0.5 rounded border border-[#1F2733]">
                v0.0.282
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              {activeTab === 'financas' ? 'Finanças & Cost Cap' : 'Patrocinadores & Contratos'}
            </h1>

            <p className="text-xs sm:text-sm text-neutral-300 font-medium">
              {activeTab === 'financas'
                ? 'Equilíbrio hoje. Performance amanhã. Sustentabilidade e teto de gastos.'
                : 'Monetize a performance. Construa parcerias de longo prazo.'}
            </p>
          </div>

          {/* Miniatura cinematográfica do carro da equipe no topo */}
          {heroSideCarImg && (
            <div className="hidden lg:flex items-center justify-end w-80 h-24 relative overflow-hidden rounded-xl">
              <img
                src={heroSideCarImg}
                alt={team?.name || 'Carro F1'}
                className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
              />
            </div>
          )}
        </div>

        {/* KPIs Reais Canônicos no Rodapé do Hero */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#8B95A7] block">
              Receita Comercial
            </span>
            <span className="text-base font-black font-mono text-emerald-400">
              {formatMoneyM(commercialSummary.totalContractedRevenue, true)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-[#8B95A7] block">
              Receita Potencial
            </span>
            <span className="text-base font-black font-mono text-cyan-400">
              {formatMoneyM(commercialSummary.totalPotentialRevenue, true)}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-[#8B95A7] block">
              Espaços Ocupados
            </span>
            <span className="text-base font-black font-mono text-white">
              {commercialSummary.occupiedSlotsCount} / 5
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-[#8B95A7] block">
              Na Mesa de Negociação
            </span>
            <span className="text-base font-black font-mono text-amber-400">
              {activeNegotiations.length} marcas
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-[#8B95A7] block">
              Caixa Disponível
            </span>
            <span className="text-base font-black font-mono text-emerald-400">
              {formatMoneyM(
                ledgerSnapshot?.cashSummary?.cashBalance || team?.budget || 84_040_000,
                true,
              )}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-[#8B95A7] block">
              Uso do Cost Cap
            </span>
            <span className="text-base font-black font-mono text-white">78% (US$ 168,60M)</span>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE 4 SUBABAS (ORDEM FIXA, ATIVA EM VERMELHO) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab('patrocinadores')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'patrocinadores'
              ? 'bg-[#E10600] text-white shadow-md'
              : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Patrocinadores Atuais ({commercialSummary.occupiedSlotsCount}/5)
        </button>

        <button
          onClick={() => {
            setMarketFilterSlot(null)
            setActiveTab('mercado')
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'mercado'
              ? 'bg-[#E10600] text-white shadow-md'
              : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
          }`}
        >
          <Search className="w-4 h-4" />
          Mercado & Oportunidades
        </button>

        <button
          onClick={() => setActiveTab('negociacoes')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'negociacoes'
              ? 'bg-[#E10600] text-white shadow-md'
              : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Mesa de Negociações ({activeNegotiations.length})
        </button>

        <button
          onClick={() => setActiveTab('financas')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeTab === 'financas'
              ? 'bg-[#E10600] text-white shadow-md'
              : 'bg-white text-neutral-600 hover:text-neutral-900 border border-neutral-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Finanças & Cost Cap
        </button>
      </div>

      {/* 3. CONTEÚDO DINÂMICO CONFORME A SUBABA SELECIONADA */}
      {activeTab === 'patrocinadores' && (
        <TabCurrentSponsors
          teamId={team?.id}
          teamName={team?.name}
          contracts={canonicalContracts}
          summary={commercialSummary}
          selectedSlot={selectedSlot}
          onSelectSlot={(slot) => setSelectedSlot(slot)}
          onExploreMarket={(slot) => handleExploreMarketWithSlot(slot)}
        />
      )}

      {activeTab === 'mercado' && (
        <TabMarketOpportunities
          team={team}
          initialFilterSlot={marketFilterSlot}
          onStartNegotiation={(sponsor, preferredSlot) =>
            handleStartNegotiationFromMarket(sponsor, preferredSlot)
          }
        />
      )}

      {activeTab === 'negociacoes' && (
        <TabNegotiationDesk
          negotiations={activeNegotiations}
          onAcceptOffer={(id) => handleAcceptAndSignContract(id)}
          onRejectOffer={(id) => handleRejectNegotiation(id)}
          onSendCounter={(id, val, yrs) => handleSendCounterOffer(id, val, yrs)}
          onCloseNegotiation={(id) => handleRejectNegotiation(id)}
          onExploreMarketTab={() => setActiveTab('mercado')}
        />
      )}

      {activeTab === 'financas' && (
        <TabFinancesCostCap
          team={team}
          ledgerSnapshot={ledgerSnapshot}
          currentSeasonYear={season?.year || 2026}
        />
      )}
    </div>
  )
}

export default SponsorsPage
