import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { SponsorModel } from '@/types/f1'
import { AVAILABLE_MARKET_SPONSORS, getAICompetitors } from '@/lib/f1-data'
import {
  simulateAiGridFiaStandings,
  getFiaPointsForPosition,
  normalizeEntityName,
} from '@/lib/f1-standings-calculator'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import { BadgePercent, TrendingUp, Handshake, DollarSign, AlertTriangle } from 'lucide-react'
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

export default function SponsorsPage() {
  const { team, season, refreshTeamAndSeason } = useAuth()

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

  // Determina a posição de construtores, vitórias e pódios da equipe para o multiplicador
  const performanceStats = useMemo(() => {
    const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
    const currentRound = season?.current_round || 1
    const pastRoundsToSimulate = raceResults.length > 0 ? 0 : Math.max(0, currentRound - 1)
    const { driverStandingsMap: aiDriverStats } = simulateAiGridFiaStandings(
      team?.team_key,
      isCustomTeam,
      pastRoundsToSimulate,
    )
    const aiGrid = getAICompetitors(team?.team_key, isCustomTeam)

    const tMap: Record<
      string,
      { points: number; wins: number; podiums: number; isPlayer: boolean }
    > = {}
    aiGrid.forEach((aiTeam) => {
      const d1 = aiDriverStats[`${aiTeam.id}_d1`] || { points: 0, wins: 0, podiums: 0 }
      const d2 = aiDriverStats[`${aiTeam.id}_d2`] || { points: 0, wins: 0, podiums: 0 }
      tMap[aiTeam.id] = {
        points: d1.points + d2.points,
        wins: d1.wins + d2.wins,
        podiums: d1.podiums + d2.podiums,
        isPlayer: false,
      }
    })

    const playerTeamId = team?.id || 'player'
    let playerPoints = 0
    let playerWins = 0
    let playerPodiums = 0

    raceResults.forEach((res) => {
      const isPlayerResult =
        res.team_id === team?.id ||
        res.expand?.team_id?.name === team?.name ||
        (team?.name && res.teamName === team.name)

      if (isPlayerResult) {
        const pts =
          typeof res.points === 'number' && res.points > 0
            ? res.points
            : getFiaPointsForPosition(res.position) +
              (res.fastest_lap && res.position <= 10 ? 1 : 0)
        playerPoints += pts
        if (res.position === 1) {
          playerWins += 1
          playerPodiums += 1
        } else if (res.position <= 3) {
          playerPodiums += 1
        }
      }
    })

    tMap[playerTeamId] = {
      points: playerPoints,
      wins: playerWins,
      podiums: playerPodiums,
      isPlayer: true,
    }

    const sortedTeams = Object.entries(tMap).sort((a, b) => {
      if (b[1].points !== a[1].points) return b[1].points - a[1].points
      if (b[1].wins !== a[1].wins) return b[1].wins - a[1].wins
      return b[1].podiums - a[1].podiums
    })

    const playerRankIdx = sortedTeams.findIndex((item) => item[1].isPlayer)
    const constructorPos = playerRankIdx !== -1 ? playerRankIdx + 1 : 6

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

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-[#E10600] uppercase">
            Marketing & Finanças
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA] mt-1">
            Gestão de Patrocínios & Receitas
          </h1>
          <p className="text-sm text-[#8B95A7] mt-0.5">
            Negocie cotas de patrocínio comercial. Atenda aos requisitos de desempenho esportivo
            para manter os repasses ativos em cada GP.
          </p>
        </div>
      </div>

      {/* Indicador de Desempenho e Multiplicador de Contratos */}
      <div className="p-4 rounded-2xl bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333]/90 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#00A6FB]" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#00A6FB]">
              Índice de Atratividade Comercial F1 2026
            </span>
          </div>
          <p className="text-sm font-semibold text-[#F5F7FA]">
            Multiplicador de Contrato Atual:{' '}
            <span
              className={`font-mono text-base ${
                performanceStats.multiplier >= 1 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              x{performanceStats.multiplier.toFixed(2)}
            </span>{' '}
            <span className="text-xs font-normal text-[#8B95A7]">
              ({performanceStats.explanation})
            </span>
          </p>
          <p className="text-xs text-[#8B95A7]">
            O valor oferecido pelos patrocinadores escala diretamente com a posição nos Construtores
            (P1 paga ~x1,40; lanterna ~x0,70) e conquistas de vitórias e pódios.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="outline"
            className="border-[#1F2733] bg-[#0B0E14] text-xs font-mono text-[#F5F7FA] px-3 py-1.5"
          >
            Cotas Ocupadas:{' '}
            <strong className="text-emerald-400 ml-1">{occupiedSlots.size}/6</strong>
          </Badge>
        </div>
      </div>

      {/* Receita Total Estimada Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333]/90 sm:col-span-2 shadow-xl">
          <CardHeader className="pb-2 border-b border-[#1F2733]/60">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-[#8B95A7] flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Receita Total Estimada por Rodada de GP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-400">
                {formatCurrency(totalRevenuePerRound)}
              </span>
              <span className="text-xs font-mono text-[#8B95A7]">/ rodada</span>
            </div>
            <p className="text-xs text-[#8B95A7] mt-1 font-mono">
              Pagamentos creditados no balanço financeiro logo após o término da simulação de cada
              corrida.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333]/90 shadow-xl">
          <CardHeader className="pb-2 border-b border-[#1F2733]/60">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-[#8B95A7]">
              Contratos em Vigor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold font-mono text-[#F5F7FA]">
              {activeSponsors.filter((s) => s.status === 'ativo').length}
              <span className="text-xs text-[#8B95A7] font-normal font-mono ml-2">ativos</span>
            </div>
            <p className="text-[11px] text-[#8B95A7] mt-1 font-mono">
              {activeSponsors.filter((s) => s.status === 'suspenso').length} suspenso(s) por meta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seção Contratos Ativos */}
      <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333]/90 shadow-xl">
        <CardHeader className="pb-3 border-b border-[#1F2733]/60">
          <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
            <Handshake className="w-5 h-5 text-[#00A6FB]" />
            Contratos Comerciais Ativos ({activeSponsors.length})
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7]">
            Avaliação automática a cada GP: se a meta de construtores ou moral não for cumprida, o
            repasse fica suspenso até a recuperação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full bg-[#1F2733]" />
              <Skeleton className="h-20 w-full bg-[#1F2733]" />
            </div>
          ) : activeSponsors.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[#1F2733] rounded-xl text-[#8B95A7]">
              <p>Nenhum contrato ativo no momento.</p>
              <p className="text-xs mt-1 text-[#00A6FB]">
                Assine novos patrocinadores no catálogo abaixo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSponsors.map((sp) => {
                const isSuspended = sp.status === 'suspenso'
                return (
                  <div
                    key={sp.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isSuspended
                        ? 'bg-amber-950/20 border-amber-500/40'
                        : 'bg-[#0B0E14] border-[#1F2733] hover:border-[#1F2733]/80'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-[#F5F7FA]">{sp.name}</h3>
                          {sp.slot && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-[#00A6FB]/40 text-[#00A6FB] bg-[#00A6FB]/10 uppercase"
                            >
                              Cota: {sp.slot}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-mono text-[#8B95A7] mt-0.5">
                          Exigência:{' '}
                          <strong className="text-[#F5F7FA]">
                            {sp.requirement || 'Sem exigência'}
                          </strong>
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs font-mono ${
                          isSuspended
                            ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                            : 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                        }`}
                      >
                        {isSuspended ? 'Suspenso por Meta' : 'Ativo'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-[#1F2733] text-xs font-mono">
                      <div>
                        <span className="text-[#8B95A7] block text-[10px]">Repasse / Rodada</span>
                        <strong className="text-emerald-400 text-sm">
                          {formatCurrency(sp.value_per_round)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#8B95A7] block text-[10px]">Duração Restante</span>
                        <span className="text-[#F5F7FA]">
                          {sp.rounds_remaining ?? '24'} rodadas
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#1F2733]/60 flex items-center justify-between">
                      <span className="text-[11px] text-[#8B95A7] font-mono">
                        {isSuspended
                          ? 'Aguardando recuperação no grid'
                          : 'Repasse regular garantido'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTerminatingSponsor(sp)}
                        className="text-xs h-7 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                      >
                        Encerrar Contrato
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção Patrocinadores Disponíveis com Cotas Exclusivas */}
      <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1A2333]/90 shadow-xl">
        <CardHeader className="pb-3 border-b border-[#1F2733]/60">
          <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
            <BadgePercent className="w-5 h-5 text-amber-400" />
            Cotas de Patrocínio Comercial F1 2026 (Exclusividade por Posição)
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7]">
            Cada local do carro (bico, laterais, asa traseira, halo, macacão, retrovisores) possui
            uma cota EXCLUSIVA. Fechar um contrato reserva a posição e encerra as outras ofertas
            para aquela cota.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketCatalogWithStatus.map((m) => {
              return (
                <div
                  key={m.name}
                  className={`p-4 rounded-xl border space-y-3 flex flex-col justify-between transition-all ${
                    m.isAlreadySigned
                      ? 'bg-[#0B0E14]/60 border-emerald-900/40 opacity-70'
                      : m.isSlotOccupied
                        ? 'bg-[#0B0E14]/40 border-dashed border-[#1F2733] opacity-60'
                        : 'bg-[#0B0E14] border-[#1F2733] hover:border-[#1F2733]/80'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm text-[#F5F7FA]">{m.name}</h3>
                        <Badge
                          variant="secondary"
                          className="mt-1 text-[10px] font-mono bg-[#161D29] text-[#00A6FB] border border-[#00A6FB]/30"
                        >
                          Cota: {m.slotLabel}
                        </Badge>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-[#00A6FB]/40 text-[#00A6FB] shrink-0"
                      >
                        {m.rounds} GPs
                      </Badge>
                    </div>

                    <p className="text-[11px] text-[#8B95A7] mt-2 leading-relaxed">
                      {m.description}
                    </p>

                    <div className="p-2.5 rounded-lg bg-[#11161F] border border-[#1F2733] mt-3 space-y-1 text-xs font-mono">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#8B95A7]">Valor base:</span>
                        <span className="text-[#8B95A7] line-through text-[11px]">
                          {formatCurrency(m.valuePerRound)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[#8B95A7] flex items-center gap-1">
                          Valor com bônus:
                          <span className="text-[10px] text-emerald-400">
                            (x{performanceStats.multiplier.toFixed(2)})
                          </span>
                        </span>
                        <strong className="text-emerald-400 font-bold text-sm">
                          {formatCurrency(m.scaledValue)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8B95A7]">Exigência:</span>
                        <strong className="text-amber-400">{m.requirement}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    {m.isAlreadySigned ? (
                      <div className="p-2 text-center rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                        ✓ Contrato em Vigor
                      </div>
                    ) : m.isSlotOccupied ? (
                      <div className="p-2 text-center rounded-lg bg-[#161D29] border border-[#1F2733] text-[#8B95A7] text-[11px] font-mono">
                        🔒 Cota ocupada ({m.occupantName || 'por outro patrocinador'})
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setSigningSponsor(m)}
                        className="w-full bg-[#E10600] hover:bg-[#FF2E25] text-white text-xs font-semibold h-8 shadow"
                      >
                        Fechar Contrato Exclusivo
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

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
