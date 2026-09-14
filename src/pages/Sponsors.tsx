import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { SponsorModel } from '@/types/f1'
import { AVAILABLE_MARKET_SPONSORS } from '@/lib/f1-data'
import { standingsService } from '@/services/standingsService'
import { formatCurrency } from '@/lib/formatters'
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
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { StatCard } from '@/components/StatCard'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'

export default function SponsorsPage() {
  const { user, team, season, refreshTeamAndSeason } = useAuth()

  const [sponsors, setSponsors] = useState<SponsorModel[]>([])
  const [raceResults, setRaceResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [signingSponsor, setSigningSponsor] = useState<any | null>(null)
  const [terminatingSponsor, setTerminatingSponsor] = useState<SponsorModel | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const loadSponsors = async () => {
    if (!team) {
      setLoading(false)
      return
    }
    try {
      const sp = await f1Service.getTeamSponsors(team.id)
      setSponsors(sp)
      if (season?.id) {
        const rr = await f1Service.getSeasonRaceResults(season.id)
        setRaceResults(rr)
      }
    } catch (err) {
      console.error('Error loading sponsors:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSponsors()
  }, [team?.id, season?.id])

  useRealtime('sponsors', () => {
    loadSponsors()
  })

  // Determina a posição de construtores, vitórias e pódios da equipe para o multiplicador via standingsService
  const performanceStats = useMemo(() => {
    const standings = standingsService.calculateStandings({
      raceResults,
      team,
      season,
    })

    const constructorPos = standings.playerConstructorRank || 6
    const playerWins = standings.playerWins || 0
    const playerPodiums = standings.playerPodiums || 0

    const scale = f1Service.calculateSponsorMultiplier({
      constructorPos,
      wins: playerWins,
      podiums: playerPodiums,
    })

    return {
      constructorPos,
      wins: playerWins,
      podiums: playerPodiums,
      multiplier: scale.multiplier,
      explanation: scale.explanation,
    }
  }, [team, season, raceResults])

  // Total active revenue per round calculation
  const totalRevenuePerRound = useMemo(() => {
    return sponsors
      .filter((s) => s.status === 'ativo')
      .reduce((acc, curr) => acc + (curr.value_per_round || 0), 0)
  }, [sponsors])

  // Sign sponsor contract (com multiplicador de desempenho e exclusividade de cota)
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

      await f1Service.addEvent(
        team.id,
        `Contrato exclusivo de cota [${signingSponsor.slotLabel || signingSponsor.slot}] firmado com ${signingSponsor.name}: receita de ${formatCurrency(finalValuePerRound)}/rodada (multiplicador x${performanceStats.multiplier.toFixed(2)}) por ${signingSponsor.rounds} etapas!`,
        'patrocinio',
      )

      toast({
        title: 'Patrocínio Fechado!',
        description: `Contrato exclusivo assinado com ${signingSponsor.name} para a cota ${signingSponsor.slotLabel || signingSponsor.slot}.`,
      })

      if (user?.id) {
        notificationService
          .createNotification(user.id, {
            type: 'patrocinio',
            title: `💰 Contrato Assinado: ${signingSponsor.name}`,
            message: `Contrato exclusivo assinado para a cota [${signingSponsor.slotLabel || signingSponsor.slot}]! Pagamento de ${formatCurrency(signingSponsor.value_per_round)} por GP.`,
            round: season?.current_round || 1,
            link: '/sponsors',
          })
          .catch(() => null)
      }

      setSigningSponsor(null)
      loadSponsors()
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

  // Terminate sponsor contract
  const handleTerminateContract = async () => {
    if (!terminatingSponsor || !team) return
    setIsProcessing(true)
    try {
      await f1Service.updateSponsor(terminatingSponsor.id, {
        status: 'encerrado',
      })

      await f1Service.addEvent(
        team.id,
        `Contrato com o patrocinador ${terminatingSponsor.name} foi encerrado amigavelmente.`,
        'patrocinio',
      )

      toast({
        title: 'Contrato Encerrado',
        description: `O vínculo com ${terminatingSponsor.name} foi finalizado sem multas.`,
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

  // Active or suspended contracts
  const activeSponsors = sponsors.filter((s) => s.status === 'ativo' || s.status === 'suspenso')
  const endedSponsors = sponsors.filter((s) => s.status === 'encerrado')

  // Mapeamento de cotas atualmente ocupadas por contratos ativos
  const occupiedSlots = useMemo(() => {
    const slots = new Set<string>()
    activeSponsors.forEach((s) => {
      if (s.slot) {
        slots.add(s.slot)
      } else {
        // Fallback para patrocinadores antigos: mapeia pelo nome conhecido ou default
        const match = AVAILABLE_MARKET_SPONSORS.find((m) => m.name === s.name)
        if (match?.slot) {
          slots.add(match.slot)
        }
      }
    })
    return slots
  }, [activeSponsors])

  const signedSponsorNames = useMemo(() => {
    return new Set(activeSponsors.map((s) => s.name))
  }, [activeSponsors])

  // Sponsors no mercado: excludentes por cota e por patrocinador
  // Um patrocinador que já assinou cota não pode assinar outra.
  // Uma cota já ocupada torna indisponíveis outras propostas para aquela cota.
  const marketCatalogWithStatus = useMemo(() => {
    return AVAILABLE_MARKET_SPONSORS.map((m) => {
      const isAlreadySigned = signedSponsorNames.has(m.name)
      const isSlotOccupied = occupiedSlots.has(m.slot)
      const occupant = activeSponsors.find((s) => {
        if (s.slot === m.slot) return true
        const match = AVAILABLE_MARKET_SPONSORS.find((cat) => cat.name === s.name)
        return match?.slot === m.slot
      })

      // Multiplicador do valor pelo desempenho esportivo atual
      const scaledValue = Math.round(m.valuePerRound * performanceStats.multiplier)

      return {
        ...m,
        scaledValue,
        isAlreadySigned,
        isSlotOccupied,
        occupantName: occupant?.name,
        isUnavailable: isAlreadySigned || isSlotOccupied,
      }
    })
  }, [signedSponsorNames, occupiedSlots, activeSponsors, performanceStats.multiplier])

  // Estimativas de receitas e despesas com dados reais do save
  const estPrizePerRound = useMemo(() => {
    // Estimativa por GP com base na posição atual de construtores
    const rank = performanceStats.constructorPos
    if (rank === 1) return 2200000
    if (rank === 2) return 1800000
    if (rank === 3) return 1500000
    if (rank <= 5) return 1100000
    if (rank <= 8) return 800000
    return 550000
  }, [performanceStats.constructorPos])

  const estDriverSalariesPerRound = 750000 // R$ 750k / GP para os 2 pilotos titulares
  const estOperationalCostsPerRound = 450000 // Logística, pneus, hospitalidade por GP
  const totalExpensesPerRound = estDriverSalariesPerRound + estOperationalCostsPerRound
  const netCashFlowPerRound = totalRevenuePerRound + estPrizePerRound - totalExpensesPerRound

  return (
    <div className="relative space-y-8 animate-fade-in-up text-[#F5F7FA]">
      <AmbientBackground />
      {/* PageHeader Race Operations */}
      <PageHeader
        eyebrow="RACE OPERATIONS // MARKETING & FINANÇAS"
        title="Gestão Comercial & Finanças"
        description="Balanço financeiro em tempo real, orçamento disponível, cotas de patrocínio no monoposto e projeção de receitas por GP."
        badge={
          <Badge
            variant="outline"
            className="border-[#1F2733] bg-[#090D15] text-[#F5F7FA] font-mono text-xs"
          >
            Cotas Ocupadas: {occupiedSlots.size}/6
          </Badge>
        }
      />

      {/* CARDS PRINCIPAIS: BALANÇO FINANCEIRO & ORÇAMENTO DO SAVE */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600]">
              SALDO EM CAIXA
            </span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-[#F5F7FA] tracking-tight">
            {formatCurrency(team?.budget ?? 0)}
          </div>
          <p className="text-[11px] text-[#8B95A7] font-mono">
            Orçamento líquido disponível da escuderia {team?.name || ''}
          </p>
        </div>

        <div className="rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-400">
              RECEITA ESTIMADA / GP
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            +{formatCurrency(totalRevenuePerRound + estPrizePerRound)}
          </div>
          <p className="text-[11px] text-[#8B95A7] font-mono">
            {formatCurrency(totalRevenuePerRound)} (patrocínios) +{' '}
            {formatCurrency(estPrizePerRound)} (FIA)
          </p>
        </div>

        <div className="rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-red-400">
              CUSTOS OPERACIONAIS / GP
            </span>
            <TrendingDown className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-black font-mono text-red-400 tracking-tight">
            -{formatCurrency(totalExpensesPerRound)}
          </div>
          <p className="text-[11px] text-[#8B95A7] font-mono">
            Salários pilotos ({formatCurrency(estDriverSalariesPerRound)}) + logística/box
          </p>
        </div>

        <div className="rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-4 shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-400">
              FLUXO LÍQUIDO / GP
            </span>
            <BadgePercent className="w-4 h-4 text-cyan-400" />
          </div>
          <div
            className={`text-2xl font-black font-mono tracking-tight ${
              netCashFlowPerRound >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {netCashFlowPerRound >= 0 ? '+' : ''}
            {formatCurrency(netCashFlowPerRound)}
          </div>
          <p className="text-[11px] text-[#8B95A7] font-mono">
            Índice comercial:{' '}
            <strong className="text-white">x{performanceStats.multiplier.toFixed(2)}</strong> (P
            {performanceStats.constructorPos} Construtores)
          </p>
        </div>
      </div>

      {/* PAINEL ELEVADO: QUADRO DE FLUXO DE CAIXA DETALHADO */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card Receitas */}
        <div className="rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#1F2733]">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-400">
              FONTES DE RECEITA // GP
            </span>
            <span className="font-num text-xs font-bold text-emerald-400">
              +{formatCurrency(totalRevenuePerRound + estPrizePerRound)}
            </span>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center text-[#8B95A7]">
              <span>Contratos de Patrocínio ({activeSponsors.length}):</span>
              <strong className="text-emerald-400 font-num">
                +{formatCurrency(totalRevenuePerRound)}
              </strong>
            </div>
            <div className="flex justify-between items-center text-[#8B95A7]">
              <span>Premiação FIA por GP (estimada):</span>
              <strong className="text-emerald-400 font-num">
                +{formatCurrency(estPrizePerRound)}
              </strong>
            </div>
            <div className="flex justify-between items-center text-[#8B95A7] pt-1 border-t border-[#1F2733]">
              <span>Bônus por Vitórias ({performanceStats.wins}):</span>
              <strong className="text-white font-num">
                {performanceStats.wins > 0
                  ? `+${formatCurrency(performanceStats.wins * 1500000)}`
                  : 'R$ 0'}
              </strong>
            </div>
          </div>
        </div>

        {/* Card Despesas Operacionais */}
        <div className="rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#1F2733]">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-red-400">
              DESPESAS OPERACIONAIS // GP
            </span>
            <span className="font-num text-xs font-bold text-red-400">
              -{formatCurrency(totalExpensesPerRound)}
            </span>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center text-[#8B95A7]">
              <span>Folha Salarial dos Pilotos:</span>
              <strong className="text-red-400 font-num">
                -{formatCurrency(estDriverSalariesPerRound)}
              </strong>
            </div>
            <div className="flex justify-between items-center text-[#8B95A7]">
              <span>Logística, Box & Viagens:</span>
              <strong className="text-red-400 font-num">
                -{formatCurrency(estOperationalCostsPerRound)}
              </strong>
            </div>
            <div className="flex justify-between items-center text-[#8B95A7] pt-1 border-t border-[#1F2733]">
              <span>Desenvolvimento de Peças (P&D):</span>
              <strong className="text-white font-num">Por demanda (/car)</strong>
            </div>
          </div>
        </div>

        {/* Card Status do Teto FIA */}
        <div className="rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#1F2733]">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600]">
              TETO DE GASTOS FIA (COST CAP)
            </span>
            <span className="font-mono text-xs font-bold text-[#F5F7FA]">R$ 215M Limite</span>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center text-[#8B95A7]">
              <span>Posição Atual Construtores:</span>
              <strong className="text-[#F5F7FA]">P{performanceStats.constructorPos}</strong>
            </div>
            <div className="flex justify-between items-center text-[#8B95A7]">
              <span>Cotas Livres no Monoposto:</span>
              <strong className="text-amber-400">{Math.max(0, 6 - occupiedSlots.size)} de 6</strong>
            </div>
            <div className="flex justify-between items-center text-[#8B95A7] pt-1 border-t border-[#1F2733]">
              <span>Regulamento Financeiro:</span>
              <span className="text-emerald-400 font-bold">100% Homologado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção Contratos Ativos */}
      <div className="relative z-10 rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-5 shadow-xl space-y-4">
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
            Repasses vinculados ao cumprimento da meta após cada GP
          </p>
        </div>

        <div>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full bg-[#161D29]" />
              <Skeleton className="h-16 w-full bg-[#161D29]" />
            </div>
          ) : activeSponsors.length === 0 ? (
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
                  key: 'status',
                  header: 'Status',
                  render: (sp) => {
                    const isSuspended = sp.status === 'suspenso'
                    return (
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          isSuspended
                            ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                            : 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                        }`}
                      >
                        {isSuspended ? 'Suspenso por Meta' : 'Repasse Regular'}
                      </Badge>
                    )
                  },
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

      {/* Seção Patrocinadores Disponíveis com Cotas Exclusivas */}
      <div className="relative z-10 rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-5 shadow-xl space-y-4">
        <div className="pb-3 border-b border-[#1F2733]">
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
            PORTFÓLIO DE OFERTAS // MERCADO COMERCIAL
          </span>
          <h3 className="text-base font-black text-[#F5F7FA] flex items-center gap-2 mt-0.5">
            <BadgePercent className="w-4 h-4 text-amber-400" />
            Cotas de Patrocínio Comercial (Exclusividade por Posição no Monoposto)
          </h3>
          <p className="text-xs text-[#8B95A7] font-mono mt-0.5">
            Cada local do carro (bico, laterais, asa traseira, halo, macacão, retrovisores) possui
            uma cota exclusiva. Fechar um contrato reserva a posição e encerra ofertas concorrentes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketCatalogWithStatus.map((m) => {
            return (
              <div
                key={m.name}
                className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between transition-all ${
                  m.isAlreadySigned
                    ? 'bg-[#0B0E14]/70 border-emerald-900/40 opacity-70'
                    : m.isSlotOccupied
                      ? 'bg-[#0B0E14]/50 border-dashed border-[#1F2733] opacity-60'
                      : 'bg-[#0B0E14] border-[#1F2733] hover:border-[#2C3849]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-[#F5F7FA]">{m.name}</h4>
                      <Badge
                        variant="secondary"
                        className="mt-1 text-[10px] font-mono bg-[#161D29] text-[#F5F7FA] border border-[#1F2733]"
                      >
                        Cota: {m.slotLabel}
                      </Badge>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-[#1F2733] bg-[#161D29] text-[#8B95A7] font-mono shrink-0"
                    >
                      {m.rounds} GPs
                    </Badge>
                  </div>

                  <p className="text-[11px] text-[#8B95A7] mt-2 leading-relaxed">{m.description}</p>

                  <div className="p-2.5 rounded-lg bg-[#090D15] border border-[#1F2733] mt-3 space-y-1 text-xs font-mono">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#8B95A7]">Valor base:</span>
                      <span className="text-[#8B95A7] line-through text-[11px] font-num">
                        {formatCurrency(m.valuePerRound)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[#8B95A7] flex items-center gap-1">
                        Com bônus:
                        <span className="text-[10px] text-emerald-400 font-num">
                          (x{performanceStats.multiplier.toFixed(2)})
                        </span>
                      </span>
                      <strong className="text-emerald-400 font-bold text-sm font-num">
                        {formatCurrency(m.scaledValue)}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8B95A7]">Exigência:</span>
                      <strong className="text-[#F5F7FA]">{m.requirement}</strong>
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
                      className="w-full bg-[#E10600] hover:bg-[#b80500] text-white text-xs font-bold h-8 shadow uppercase tracking-wider"
                    >
                      Fechar Contrato Exclusivo
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal: Fechar Contrato */}
      <Dialog open={!!signingSponsor} onOpenChange={(open) => !open && setSigningSponsor(null)}>
        <DialogContent className="bg-[#090D15]/95 backdrop-blur-md border border-[#1A2333]/90 text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <Handshake className="w-5 h-5 text-[#E10600]" />
              Assinar Acordo Comercial — {signingSponsor?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Confirme os termos e repasses por cada rodada concluída da temporada 2026.
            </DialogDescription>
          </DialogHeader>

          {signingSponsor && (
            <div className="space-y-4 py-2 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Empresa Parceira:</span>
                  <strong className="text-[#F5F7FA]">{signingSponsor.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Cota Alocada:</span>
                  <strong className="text-[#00A6FB]">
                    {signingSponsor.slotLabel || signingSponsor.slot}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Repasse por GP:</span>
                  <div className="text-right">
                    <strong className="text-emerald-400 text-sm block">
                      {formatCurrency(signingSponsor.scaledValue || signingSponsor.valuePerRound)}
                    </strong>
                    <span className="text-[10px] text-[#8B95A7]">
                      Multiplicador de resultados: x{performanceStats.multiplier.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Duração Contratual:</span>
                  <span className="text-[#F5F7FA]">{signingSponsor.rounds} rodadas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Exigência de Desempenho:</span>
                  <span className="text-amber-400 font-bold">{signingSponsor.requirement}</span>
                </div>
              </div>
              <p className="text-[#8B95A7] text-[11px]">
                Caso o rendimento do time caia abaixo do exigido, o repasse daquela rodada fica
                suspenso até a recuperação das metas.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSigningSponsor(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSignContract}
              disabled={isProcessing}
              className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-semibold shadow-md"
            >
              {isProcessing ? 'Firmando contrato...' : 'Confirmar Parceria'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Encerrar Contrato */}
      <Dialog
        open={!!terminatingSponsor}
        onOpenChange={(open) => !open && setTerminatingSponsor(null)}
      >
        <DialogContent className="bg-[#090D15]/95 backdrop-blur-md border border-[#1A2333]/90 text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Rescindir Patrocínio Comercial
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              O encerramento amigável cancela os repasses das próximas corridas sem aplicação de
              multas.
            </DialogDescription>
          </DialogHeader>

          {terminatingSponsor && (
            <div className="space-y-4 py-2 text-xs">
              <p className="text-[#F5F7FA]">
                Deseja realmente encerrar a parceria com{' '}
                <strong className="text-white">{terminatingSponsor.name}</strong>?
              </p>
              <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Perda de Receita Futura:</span>
                  <span className="text-red-400 font-bold">
                    {formatCurrency(terminatingSponsor.value_per_round)}/GP
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Multa Rescisória:</span>
                  <span className="text-emerald-400">R$ 0,00 (Isento)</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTerminatingSponsor(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Manter Contrato
            </Button>
            <Button
              onClick={handleTerminateContract}
              disabled={isProcessing}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {isProcessing ? 'Cancelando...' : 'Encerrar Vínculo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
