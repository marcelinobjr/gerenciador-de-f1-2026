import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/PageHeader'
import { AmbientBackground } from '@/components/AmbientBackground'
import {
  Trophy,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { seasonTransitionService } from '@/services/seasonTransitionService'
import {
  teamReplacementService,
  EligibleReplacementCandidate,
} from '@/services/teamReplacementService'
import { f1Service } from '@/services/f1Service'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'

export default function SeasonEndPage() {
  const navigate = useNavigate()
  const { team, season } = useUnifiedSeason()

  const [loading, setLoading] = useState(true)
  const [driverStandings, setDriverStandings] = useState<any[]>([])
  const [teamStandings, setTeamStandings] = useState<any[]>([])
  const [transitionAudit, setTransitionAudit] = useState<any>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionDone, setTransitionDone] = useState(false)

  // Estados de Substituição Opcional da Última Colocada (FIN-SOURCE-01B)
  const [lastPlaceTeam, setLastPlaceTeam] = useState<{
    teamId: string
    teamName: string
    rank: number
    points: number
  } | null>(null)
  const [eligibleReplacements, setEligibleReplacements] = useState<EligibleReplacementCandidate[]>(
    [],
  )
  const [replacementChoice, setReplacementChoice] = useState<'KEEP' | 'REPLACE'>('KEEP')
  const [selectedReplacementKey, setSelectedReplacementKey] = useState<string>('')
  const [decisionConfirmed, setDecisionConfirmed] = useState<boolean>(false)

  useEffect(() => {
    async function loadStandings() {
      if (!season) {
        setLoading(false)
        return
      }
      try {
        const [allDrivers, allTeams] = await Promise.all([
          f1Service.getAllDrivers(),
          f1Service.getAllTeams(),
        ])
        setDriverStandings(allDrivers || [])
        setTeamStandings(allTeams || [])

        // Identificar canonicamente a última colocada do construtores
        const last = teamReplacementService.identifyLastPlaceTeam(allTeams || [])
        if (last) {
          setLastPlaceTeam(last)
          const currentKeys = (allTeams || []).map((t: any) => t.key || t.name)
          const candidates = teamReplacementService.getEligibleReplacementTeams(currentKeys)
          setEligibleReplacements(candidates)
          if (candidates.length > 0) {
            setSelectedReplacementKey(candidates[0].key)
          }

          // Verificar se já há decisão persistida
          const fromY = season.year || 2026
          const toY = fromY + 1
          const persisted = await teamReplacementService.getPersistedReplacementDecision(
            fromY,
            toY,
            last.teamId,
          )
          if (persisted) {
            setReplacementChoice(persisted.decision)
            if (persisted.replacementTeamKey) {
              setSelectedReplacementKey(persisted.replacementTeamKey)
            }
            setDecisionConfirmed(persisted.confirmed)
          }
        }

        // Run validation audit for 2026 -> 2027 transition readiness
        if (team) {
          try {
            const auditRes = await seasonTransitionService.auditSeasonTransition(
              season.year || 2026,
              (season.year || 2026) + 1,
              team.id,
            )
            setTransitionAudit(auditRes)
          } catch (e) {
            console.warn('Audit transition notice:', e)
          }
        }
      } catch (err) {
        console.error('Error loading season end data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadStandings()
  }, [season, team])

  const playerTeamStanding = teamStandings.find((s) => s.teamId === team?.id)
  const playerRank =
    playerTeamStanding?.rank || teamStandings.findIndex((s) => s.teamId === team?.id) + 1 || 1

  const handleStartNextSeason = async () => {
    if (!team || !season || isTransitioning) return
    setIsTransitioning(true)
    try {
      // Gravar persistência da decisão de substituição antes de executar a transição
      if (lastPlaceTeam) {
        const fromYear = season.year || 2026
        const toYear = fromYear + 1
        const chosenCandidate = eligibleReplacements.find((c) => c.key === selectedReplacementKey)
        await teamReplacementService.saveReplacementDecision({
          transitionKey: teamReplacementService.getReplacementKey(
            fromYear,
            toYear,
            lastPlaceTeam.teamId,
          ),
          fromSeasonYear: fromYear,
          toSeasonYear: toYear,
          lastPlaceTeamId: lastPlaceTeam.teamId,
          lastPlaceTeamName: lastPlaceTeam.teamName,
          decision: replacementChoice,
          replacementTeamKey: replacementChoice === 'REPLACE' ? selectedReplacementKey : undefined,
          replacementTeamName: replacementChoice === 'REPLACE' ? chosenCandidate?.name : undefined,
          officialRankingReference: `Mundial de Construtores ${fromYear} - P${lastPlaceTeam.rank}`,
          confirmed: true,
          applied: false,
          createdAt: new Date().toISOString(),
        })
      }

      const result = await seasonTransitionService.executeSeasonTransition({
        teamId: team.id,
        fromSeasonYear: season.year || 2026,
        toSeasonYear: (season.year || 2026) + 1,
      })

      if (result.success) {
        setTransitionDone(true)
        toast({
          title: 'Temporada 2027 Iniciada!',
          description: 'A virada de ano e o novo regulamento técnico foram aplicados.',
        })
        setTimeout(() => {
          navigate('/corrida')
        }, 1200)
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha na Transição',
          description: 'Erro ao processar virada de temporada.',
        })
      }
    } catch (err: any) {
      console.error('Erro na transição:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na Virada de Temporada',
        description: err?.message || 'Falha na transição.',
      })
    } finally {
      setIsTransitioning(false)
    }
  }

  return (
    <div className="relative space-y-8 animate-fade-in-up pb-12">
      <AmbientBackground />

      <PageHeader
        eyebrow="FIA FORMULA 1 WORLD CHAMPIONSHIP // CONCLUSÃO"
        title={`Fim da Temporada ${season?.year || 2026}`}
        description="Encerramento oficial do campeonato mundial. Confira os resultados finais e inicie o ciclo para a temporada seguinte."
        badge={
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 font-mono text-xs px-3 py-1 font-bold">
            <Trophy className="w-3.5 h-3.5 mr-1 text-amber-400" />
            Campeonato Oficial Concluído
          </Badge>
        }
      />

      {/* Hero: Resumo da Equipe do Jogador */}
      <Card className="bg-[#090D15]/90 border border-amber-500/40 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
                ESCUDERIA DO JOGADOR // POSIÇÃO MUNDIAL
              </span>
              <h2 className="text-2xl font-black text-white">{team?.name || 'Sua Equipe'}</h2>
              <p className="text-xs text-[#8B95A7] font-mono mt-1">
                Concluiu o Campeonato Mundial de Construtores em{' '}
                <span className="text-white font-bold">P{playerRank}</span> com{' '}
                <span className="text-emerald-400 font-bold">
                  {playerTeamStanding?.points || 0} pts
                </span>
                .
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleStartNextSeason}
              disabled={isTransitioning || transitionDone}
              className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold px-6 py-6 text-sm shadow-xl flex items-center gap-2"
            >
              {isTransitioning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  PROCESSANDO TRANSIÇÃO 2027...
                </>
              ) : transitionDone ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  TEMPORADA 2027 INICIADA!
                </>
              ) : (
                <>
                  INICIAR TEMPORADA 2027
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* BLOCO: SUBSTITUIÇÃO OPCIONAL DA ÚLTIMA COLOCADA (FIN-SOURCE-01B) */}
      {lastPlaceTeam && (
        <Card className="bg-[#090D15]/90 border border-indigo-500/40 p-6 shadow-2xl backdrop-blur-md">
          <CardHeader className="p-0 pb-4 border-b border-indigo-500/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold block">
                  REGULAMENTO FIA // SUBSTITUIÇÃO OPCIONAL DE VAGA
                </span>
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2 mt-1">
                  Decisão de Grid para a Próxima Temporada
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className="text-xs font-mono border-indigo-500/50 text-indigo-300"
              >
                Última Colocada: {lastPlaceTeam.teamName} (P{lastPlaceTeam.rank} •{' '}
                {lastPlaceTeam.points} pts)
              </Badge>
            </div>
            <CardDescription className="text-xs text-[#8B95A7] font-mono mt-2">
              No final da temporada, a equipe que ficar em último lugar poderá ser substituída por
              outra equipe na próxima temporada, a critério do jogador. A equipe que sai conserva
              seu histórico e premiações.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 pt-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant={replacementChoice === 'KEEP' ? 'default' : 'outline'}
                onClick={() => {
                  setReplacementChoice('KEEP')
                  setDecisionConfirmed(true)
                }}
                className={
                  replacementChoice === 'KEEP'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
                    : 'border-[#1F2733] text-slate-300'
                }
              >
                Manter {lastPlaceTeam.teamName} no Campeonato
              </Button>

              <Button
                type="button"
                variant={replacementChoice === 'REPLACE' ? 'default' : 'outline'}
                onClick={() => {
                  setReplacementChoice('REPLACE')
                  setDecisionConfirmed(false)
                }}
                className={
                  replacementChoice === 'REPLACE'
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold'
                    : 'border-[#1F2733] text-slate-300'
                }
              >
                Substituir por Outra Equipe Elegível
              </Button>
            </div>

            {replacementChoice === 'REPLACE' && (
              <div className="p-4 rounded-xl bg-[#11161F] border border-indigo-500/30 space-y-3">
                <div className="text-xs font-mono font-bold text-indigo-300">
                  Selecione a Escuderia Entrante (Universo de Equipes Disponíveis):
                </div>

                {eligibleReplacements.length === 0 ? (
                  <p className="text-xs text-amber-400 font-mono">
                    Nenhuma escuderia elegível fora do grid atual encontrada. A última colocada será
                    mantida no grid.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {eligibleReplacements.slice(0, 6).map((cand) => (
                      <div
                        key={cand.key}
                        onClick={() => setSelectedReplacementKey(cand.key)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all text-xs font-mono ${
                          selectedReplacementKey === cand.key
                            ? 'bg-indigo-500/20 border-indigo-500 text-white font-bold ring-1 ring-indigo-500'
                            : 'bg-[#090D15] border-[#1F2733] text-slate-300 hover:border-indigo-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white truncate">{cand.name}</span>
                          <span className="text-[10px] text-indigo-400">{cand.country}</span>
                        </div>
                        <div className="text-[11px] text-[#8B95A7]">
                          Motor: <span className="text-white">{cand.engine}</span> • Força:{' '}
                          <span className="text-emerald-400">{cand.strength}</span>
                        </div>
                        <div className="text-[10px] text-[#8B95A7] truncate mt-1">
                          {cand.currentSituation || cand.historySummary}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-[#1F2733]">
                  <span className="text-xs font-mono text-[#8B95A7]">
                    Confirmação explícita requerida para aplicar na nova temporada.
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      setDecisionConfirmed(true)
                      toast({
                        title: 'Decisão Registrada',
                        description: `A equipe ${eligibleReplacements.find((c) => c.key === selectedReplacementKey)?.name || 'selecionada'} substituirá ${lastPlaceTeam.teamName} na temporada seguinte.`,
                      })
                    }}
                    className={
                      decisionConfirmed
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold'
                    }
                  >
                    {decisionConfirmed ? '✓ Decisão Confirmada' : 'Confirmar Seleção'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grid: Classificação Final Pilotos e Construtores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Construtores */}
        <Card className="bg-[#090D15]/80 border border-[#1F2733]">
          <CardHeader className="pb-3 border-b border-[#1F2733]">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#00A6FB]" />
              Mundial de Construtores — Classificação Final
            </CardTitle>
            <CardDescription className="text-xs text-[#8B95A7] font-mono">
              Pontuação consolidada das 24 etapas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {teamStandings.length === 0 ? (
              <div className="text-xs text-[#8B95A7] font-mono p-4 text-center">
                Carregando classificação de equipes...
              </div>
            ) : (
              teamStandings.slice(0, 10).map((st, idx) => {
                const isPlayer = st.teamId === team?.id
                return (
                  <div
                    key={st.teamId || idx}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-mono ${
                      isPlayer
                        ? 'bg-[#00A6FB]/10 border-[#00A6FB]/50 text-white font-bold'
                        : 'bg-[#11161F] border-[#1F2733] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 text-center font-bold ${
                          idx === 0
                            ? 'text-amber-400'
                            : idx <= 2
                              ? 'text-slate-200'
                              : 'text-[#8B95A7]'
                        }`}
                      >
                        P{idx + 1}
                      </span>
                      <span className="truncate max-w-[200px]">
                        {st.teamName || `Equipe ${idx + 1}`}
                      </span>
                      {isPlayer && (
                        <Badge className="bg-[#00A6FB]/20 text-[#00A6FB] border-[#00A6FB]/30 text-[10px] px-1.5 py-0">
                          Sua Equipe
                        </Badge>
                      )}
                    </div>
                    <span className="font-bold text-emerald-400">{st.points || 0} pts</span>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Pilotos */}
        <Card className="bg-[#090D15]/80 border border-[#1F2733]">
          <CardHeader className="pb-3 border-b border-[#1F2733]">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Mundial de Pilotos — Top 10
            </CardTitle>
            <CardDescription className="text-xs text-[#8B95A7] font-mono">
              Classificação geral de pilotos da temporada
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {driverStandings.length === 0 ? (
              <div className="text-xs text-[#8B95A7] font-mono p-4 text-center">
                Carregando classificação de pilotos...
              </div>
            ) : (
              driverStandings.slice(0, 10).map((dr, idx) => (
                <div
                  key={dr.driverId || idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#11161F] border border-[#1F2733] text-xs font-mono text-slate-300"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 text-center font-bold ${
                        idx === 0
                          ? 'text-amber-400'
                          : idx <= 2
                            ? 'text-slate-200'
                            : 'text-[#8B95A7]'
                      }`}
                    >
                      P{idx + 1}
                    </span>
                    <span className="truncate max-w-[200px] text-white font-medium">
                      {dr.driverName || dr.name || `Piloto ${idx + 1}`}
                    </span>
                  </div>
                  <span className="font-bold text-[#00A6FB]">{dr.points || 0} pts</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* BLOCO: DESENVOLVIMENTO & DECLÍNIO DE PILOTOS (8B - Regra 99) */}
      <Card className="bg-[#090D15]/80 border border-[#1F2733] p-5">
        <div className="flex items-center justify-between mb-3 border-b border-[#1F2733] pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Relatório Anual de Desenvolvimento & Declínio de Pilotos (8B)
            </h3>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-cyan-700/60 text-cyan-300"
          >
            Evolução Consolidada
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Gabriel Bortoleto (Audi F1)</span>
              <Badge className="bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px]">
                Evoluindo Acelerado
              </Badge>
            </div>
            <p className="text-[11px] text-slate-300">
              Evolução notável em consistência de corrida, feedback técnico e maturidade no
              gerenciamento de compostos.
            </p>
            <div className="text-[10px] text-emerald-400 font-semibold">
              Consistência ↑ | Ritmo ↑ | Feedback Técnico ↑
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Daniel Ricciardo (Audi F1)</span>
              <Badge className="bg-amber-950 text-amber-300 border border-amber-700 text-[10px]">
                Veterano Estável
              </Badge>
            </div>
            <p className="text-[11px] text-slate-300">
              Maturidade no setup e telemetria permanecem de elite; ritmo de classificação em platô
              natural da carreira.
            </p>
            <div className="text-[10px] text-amber-300 font-semibold">
              Feedback Técnico ★ | Consistência → | Ritmo Puro ↘
            </div>
          </div>
        </div>
      </Card>

      {/* BLOCO: NOVA GERAÇÃO DE PILOTOS DE BASE (8B - Regra 100) */}
      <Card className="bg-[#090D15]/80 border border-[#1F2733] p-5">
        <div className="flex items-center justify-between mb-3 border-b border-[#1F2733] pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-purple-300">
              Nova Classe de Pilotos de Base (New Generation 8B)
            </h3>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-purple-700/60 text-purple-300"
          >
            Scouting Pool Aberto
          </Badge>
        </div>

        <div className="p-3 rounded-lg bg-[#11161F] border border-[#1F2733] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="space-y-1 text-center sm:text-left">
            <span className="font-bold text-white block">
              12 Novos Prospectos Internacionais Disponíveis
            </span>
            <p className="text-[11px] text-[#8B95A7]">
              Jovens pilotos de karting, Fórmula 4 e F3 Regional integraram o radar de olheiros para
              a nova temporada.
            </p>
          </div>
          <Badge className="bg-purple-900/40 text-purple-300 border border-purple-600 shrink-0 text-xs py-1 px-3">
            Avaliação na Academia Disponível
          </Badge>
        </div>
      </Card>

      {/* Auditoria FIA de Transição de Temporada */}
      {transitionAudit && (
        <Card className="bg-[#090D15]/80 border border-[#1F2733] p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              Auditoria de Transição Canônica FIA (7 Dimensões)
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733]">
              <span className="text-[#8B95A7] block text-[10px]">Status Geral</span>
              <span className="font-bold text-emerald-400">
                {transitionAudit.valid ? '✓ Em Conformidade' : 'Atenção'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733]">
              <span className="text-[#8B95A7] block text-[10px]">Regulamento</span>
              <span className="font-bold text-white">FIA 2027 Ready</span>
            </div>
            <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733]">
              <span className="text-[#8B95A7] block text-[10px]">Contratos</span>
              <span className="font-bold text-cyan-300">Preservados</span>
            </div>
            <div className="p-2.5 rounded bg-[#11161F] border border-[#1F2733]">
              <span className="text-[#8B95A7] block text-[10px]">Orçamento & Teto</span>
              <span className="font-bold text-emerald-400">Verificado</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
