import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { SponsorModel } from '@/types/f1'
import { AVAILABLE_MARKET_SPONSORS } from '@/lib/f1-data'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import {
  BadgePercent,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  XCircle,
  Handshake,
  DollarSign,
  AlertTriangle,
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

export default function SponsorsPage() {
  const { team, season, refreshTeamAndSeason } = useAuth()

  const [sponsors, setSponsors] = useState<SponsorModel[]>([])
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
    } catch (err) {
      console.error('Error loading sponsors:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSponsors()
  }, [team?.id])

  useRealtime('sponsors', () => {
    loadSponsors()
  })

  // Total active revenue per round calculation
  const totalRevenuePerRound = useMemo(() => {
    return sponsors
      .filter((s) => s.status === 'ativo')
      .reduce((acc, curr) => acc + (curr.value_per_round || 0), 0)
  }, [sponsors])

  // Sign sponsor contract
  const handleSignContract = async () => {
    if (!signingSponsor || !team) return
    setIsProcessing(true)
    try {
      await f1Service.createSponsor({
        name: signingSponsor.name,
        value_per_round: signingSponsor.valuePerRound,
        requirement: signingSponsor.requirement,
        status: 'ativo',
        rounds_remaining: signingSponsor.rounds,
        team_id: team.id,
      })

      await f1Service.addEvent(
        team.id,
        `Contrato firmado com ${signingSponsor.name}: receita de ${formatCurrency(signingSponsor.valuePerRound)}/rodada por ${signingSponsor.rounds} etapas!`,
        'patrocinio',
      )

      toast({
        title: 'Patrocínio Fechado!',
        description: `Contrato assinado com ${signingSponsor.name}. Receita adicionada às rodadas.`,
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

  // Available sponsors in market not already signed
  const availableMarket = AVAILABLE_MARKET_SPONSORS.filter(
    (m) => !sponsors.some((s) => s.name === m.name && s.status !== 'encerrado'),
  )

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

      {/* Receita Total Estimada Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#11161F] border-[#1F2733] sm:col-span-2">
          <CardHeader className="pb-2">
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

        <Card className="bg-[#11161F] border-[#1F2733]">
          <CardHeader className="pb-2">
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
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardHeader className="pb-3">
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
                        <h3 className="font-bold text-base text-[#F5F7FA]">{sp.name}</h3>
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

      {/* Seção Patrocinadores Disponíveis */}
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
            <BadgePercent className="w-5 h-5 text-amber-400" />
            Patrocinadores Disponíveis no Mercado F1 2026
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7]">
            Empresas globais prontas para investir na sua escuderia. Verifique as exigências antes
            de firmar compromisso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availableMarket.length === 0 ? (
            <p className="text-center py-6 text-xs text-[#8B95A7]">
              Todos os contratos do catálogo já foram assinados ou estão em andamento.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableMarket.map((m) => (
                <div
                  key={m.name}
                  className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-3 flex flex-col justify-between hover:border-[#1F2733]/80 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-sm text-[#F5F7FA]">{m.name}</h3>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-[#00A6FB]/40 text-[#00A6FB]"
                      >
                        {m.rounds} GPs
                      </Badge>
                    </div>

                    <p className="text-[11px] text-[#8B95A7] mt-1.5 leading-relaxed">
                      {m.description}
                    </p>

                    <div className="p-2.5 rounded-lg bg-[#11161F] border border-[#1F2733] mt-3 space-y-1 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-[#8B95A7]">Valor por GP:</span>
                        <strong className="text-emerald-400 font-bold">
                          {formatCurrency(m.valuePerRound)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8B95A7]">Exigência:</span>
                        <strong className="text-amber-400">{m.requirement}</strong>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => setSigningSponsor(m)}
                    className="w-full mt-2 bg-[#E10600] hover:bg-[#FF2E25] text-white text-xs font-semibold h-8 shadow"
                  >
                    Fechar Contrato
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Fechar Contrato */}
      <Dialog open={!!signingSponsor} onOpenChange={(open) => !open && setSigningSponsor(null)}>
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <Handshake className="w-5 h-5 text-[#22C55E]" />
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
                  <span className="text-[#8B95A7]">Repasse por GP:</span>
                  <strong className="text-emerald-400 text-sm">
                    {formatCurrency(signingSponsor.valuePerRound)}
                  </strong>
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
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-semibold"
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
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA]">
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
