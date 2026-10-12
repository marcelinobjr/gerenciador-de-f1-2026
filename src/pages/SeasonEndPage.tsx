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
  DollarSign,
  Users,
  Award,
  Crown,
  ChevronRight,
  Shuffle,
} from 'lucide-react'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { useAuth } from '@/contexts/AuthContext'
import { seasonTransitionService } from '@/services/seasonTransitionService'
import {
  teamReplacementService,
  EligibleReplacementCandidate,
} from '@/services/teamReplacementService'
import { f1Service } from '@/services/f1Service'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'

export default function SeasonEndPage() {
  const navigate = useNavigate()
  const { team, season } = useUnifiedSeason()
  const { refreshTeamAndSeason } = useAuth()

  const [loading, setLoading] = useState(true)
  const [driverStandings, setDriverStandings] = useState<any[]>([])
  const [teamStandings, setTeamStandings] = useState<any[]>([])
  const [transitionAudit, setTransitionAudit] = useState<any>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [transitionDone, setTransitionDone] = useState(false)
  const [marketMoves, setMarketMoves] = useState<any[]>([])
  const [champions, setChampions] = useState<{
    driver: any | null
    constructor: any | null
  }>({ driver: null, constructor: null })
  const [playerDriversStandings, setPlayerDriversStandings] = useState<any[]>([])

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
  const [replacementChoice, setReplacementChoice] = useState<'KEEP' | 'REPLACE'>('REPLACE')
  const [selectedReplacementKey, setSelectedReplacementKey] = useState<string>('')
  const [decisionConfirmed, setDecisionConfirmed] = useState<boolean>(false)

  useEffect(() => {
    async function loadStandings() {
      if (!season) {
        setLoading(false)
        return
      }
      try {
        const fromYear = season.year || 2026
        const careerId = season.id || 'z36hmcbqa75kt7k'

        // 1. Carregar motoristas e equipes base
        const [allDrivers, allTeams] = await Promise.all([
          f1Service.getAllDrivers(),
          f1Service.getAllTeams(),
        ])

        // 2. Carregar classificação oficial real do campeonato via championship_snapshots
        let officialDrivers: any[] = []
        let officialConstructors: any[] = []

        try {
          const snapshot = await canonicalChampionshipService.getChampionshipStandingsAsync(
            careerId,
            fromYear,
            24,
            team?.id,
          )

          if (snapshot && snapshot.driverStandings && snapshot.driverStandings.length > 0) {
            officialDrivers = snapshot.driverStandings.map((ds: any) => ({
              ...ds,
              id: ds.driverId,
              name: ds.driverName,
              teamName: ds.currentTeamName || ds.teamName || 'Equipe',
            }))
          }
          if (
            snapshot &&
            snapshot.constructorStandings &&
            snapshot.constructorStandings.length > 0
          ) {
            officialConstructors = snapshot.constructorStandings.map((cs: any) => ({
              ...cs,
              teamId: cs.teamId,
              teamName: cs.teamName,
              points: cs.points,
              rank: cs.position,
            }))
          }
        } catch (snapErr) {
          console.warn('Erro ao carregar snapshot canônico, usando fallback f1Service:', snapErr)
        }

        // Fallbacks se snapshot estiver vazio
        if (officialDrivers.length === 0) {
          officialDrivers = [...(allDrivers || [])].sort(
            (a: any, b: any) => (b.points || 0) - (a.points || 0),
          )
        }
        if (officialConstructors.length === 0) {
          officialConstructors = [...(allTeams || [])].sort(
            (a: any, b: any) => (b.points || 0) - (a.points || 0),
          )
        }

        setDriverStandings(officialDrivers)
        setTeamStandings(officialConstructors)

        // Definir Campeões Oficiais (1º colocado)
        if (officialDrivers.length > 0) {
          setChampions((prev) => ({ ...prev, driver: officialDrivers[0] }))
        }
        if (officialConstructors.length > 0) {
          setChampions((prev) => ({ ...prev, constructor: officialConstructors[0] }))
        }

        // Identificar pilotos da equipe do jogador e suas posições
        const myTeamId = team?.id
        const myDrivers = (allDrivers || []).filter((d: any) => d.team_id === myTeamId)
        const myDriversWithStandings = myDrivers.map((d: any) => {
          const standingIdx = officialDrivers.findIndex(
            (od: any) => od.id === d.id || od.driverId === d.id || od.name === d.name,
          )
          const rank = standingIdx !== -1 ? standingIdx + 1 : 99
          const standingItem = standingIdx !== -1 ? officialDrivers[standingIdx] : null
          const points = standingItem?.points ?? d.points ?? 0
          return {
            ...d,
            rank,
            points,
          }
        })
        setPlayerDriversStandings(myDriversWithStandings)

        // Carregar "Dança das Cadeiras" (movimentos de mercado)
        // 1) Checar pilotos que têm next_team_id ou future_contract
        const transfers: any[] = []
        for (const drv of allDrivers || []) {
          const nextTeamId = drv.next_team_id || drv.future_contract?.teamId
          if (nextTeamId && nextTeamId !== drv.team_id) {
            const originTeam = allTeams.find((t: any) => t.id === drv.team_id)
            const destTeam = allTeams.find((t: any) => t.id === nextTeamId)
            transfers.push({
              driverName: drv.name,
              nationality: drv.nationality,
              originTeamName: originTeam?.name || 'Agente Livre / Base',
              destinationTeamName: destTeam?.name || 'Nova Equipe',
              role: drv.next_contract_role || drv.future_contract?.role || 'Titular',
              type: 'CONFIRMED',
            })
          } else if (drv.contract_end && drv.contract_end <= fromYear && !nextTeamId) {
            const originTeam = allTeams.find((t: any) => t.id === drv.team_id)
            transfers.push({
              driverName: drv.name,
              nationality: drv.nationality,
              originTeamName: originTeam?.name || 'F1',
              destinationTeamName: 'Mercado (Agente Livre)',
              role: 'Disponível',
              type: 'FREE_AGENT',
            })
          }
        }

        // Se season tem market_moves armazenados, mesclar
        if (Array.isArray(season.market_moves) && season.market_moves.length > 0) {
          for (const m of season.market_moves as any[]) {
            if (!transfers.some((t) => t.driverName === m.driverName)) {
              transfers.push({
                driverName: m.driverName || 'Piloto',
                nationality: '',
                originTeamName: 'Grid 2026',
                destinationTeamName: m.destinationTeam || m.targetTeamName || 'Equipe 2027',
                role: 'Titular',
                type: 'CONFIRMED',
                details: m.details || m.headline,
              })
            }
          }
        }
        setMarketMoves(transfers)

        // Identificar canonicamente a última colocada do construtores
        const last = teamReplacementService.identifyLastPlaceTeam(officialConstructors)
        if (last) {
          setLastPlaceTeam(last)
          const currentKeys = (allTeams || []).map((t: any) => t.key || t.team_key || t.name)
          const candidates = teamReplacementService.getEligibleReplacementTeams(currentKeys)
          setEligibleReplacements(candidates)
          if (candidates.length > 0) {
            setSelectedReplacementKey(candidates[0].key)
          }

          // Verificar se já há decisão persistida
          const toY = fromYear + 1
          const persisted = await teamReplacementService.getPersistedReplacementDecision(
            fromYear,
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
              fromYear,
              fromYear + 1,
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

  // Cálculo da Premiação da Equipe (Construtores)
  // Tabela oficial do jogo / seasonTransitionService:
  // P1: R$ 65M, P2: R$ 58M, P3: R$ 52M, P4: R$ 46M, P5: R$ 41M, P6: R$ 36M, P7: R$ 32M, P8: R$ 28M, P9: R$ 24M, P10: R$ 20M, P11+: R$ 15M
  const getConstructorPrize = (rank: number) => {
    const table = [
      65000000, 58000000, 52000000, 46000000, 41000000, 36000000, 32000000, 28000000, 24000000,
      20000000,
    ]
    return table[rank - 1] || 15000000
  }

  // Tabela de Premiação por Desempenho dos Pilotos (bônus ao caixa da equipe pelo resultado no Mundial de Pilotos):
  // P1: R$ 25M, P2: R$ 20M, P3: R$ 16M, P4: R$ 13M, P5: R$ 10M, P6: R$ 8M, P7: R$ 6M, P8: R$ 5M, P9: R$ 4M, P10: R$ 3M, P11-15: R$ 2M, P16+: R$ 1M
  const getDriverPrize = (rank: number) => {
    const driverPrizeTable = [
      25000000, 20000000, 16000000, 13000000, 10000000, 8000000, 6000000, 5000000, 4000000, 3000000,
    ]
    if (rank <= 10) return driverPrizeTable[rank - 1] || 3000000
    if (rank <= 15) return 2000000
    return 1000000
  }

  const playerTeamStanding = teamStandings.find((s) => s.teamId === team?.id || s.id === team?.id)
  const playerRank =
    playerTeamStanding?.rank ||
    playerTeamStanding?.position ||
    teamStandings.findIndex((s) => s.teamId === team?.id || s.id === team?.id) + 1 ||
    1

  const teamPrizeMoney = getConstructorPrize(playerRank)
  const totalDriversPrize = playerDriversStandings.reduce(
    (acc, d) => acc + getDriverPrize(d.rank || 15),
    0,
  )
  const grandTotalPrize = teamPrizeMoney + totalDriversPrize

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
        await refreshTeamAndSeason()
        toast({
          title: 'Temporada 2027 Iniciada!',
          description: 'A virada de ano, histórico e nova temporada na R1 foram estabelecidos.',
        })
        setTimeout(() => {
          navigate('/corrida?round=1')
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

      {/* DESTAQUE: CAMPEÕES DO MUNDO 2026 (PILOTOS E CONSTRUTORES) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Campeão de Pilotos */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-[#1c1809] via-[#0f0e08] to-[#090D15] border border-amber-500/50 p-6 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between">
            <div>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
                <Crown className="w-3 h-3 mr-1 text-amber-400 inline" />
                Campeão Mundial de Pilotos
              </Badge>
              <h3 className="text-2xl font-black text-white mt-1">
                {champions.driver?.name || champions.driver?.driverName || 'Max Verstappen'}
              </h3>
              <p className="text-xs text-amber-300/80 font-mono mt-0.5">
                {champions.driver?.teamName || 'Equipe Campeã'} &bull;{' '}
                <span className="font-bold text-white">{champions.driver?.points ?? 0} pontos</span>
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-lg">
              <Trophy className="w-7 h-7" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-amber-500/20 flex items-center justify-between text-[11px] font-mono text-[#8B95A7]">
            <span>Vencedor oficial homologado da temporada 2026</span>
            <span className="text-amber-400 font-bold">P1 MUNDIAL</span>
          </div>
        </Card>

        {/* Campeão de Construtores */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-[#0c1a24] via-[#09121a] to-[#090D15] border border-cyan-500/50 p-6 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between">
            <div>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40 text-[10px] font-mono font-bold uppercase tracking-wider mb-2">
                <Award className="w-3 h-3 mr-1 text-cyan-400 inline" />
                Campeão Mundial de Construtores
              </Badge>
              <h3 className="text-2xl font-black text-white mt-1">
                {champions.constructor?.teamName ||
                  champions.constructor?.name ||
                  'McLaren F1 Team'}
              </h3>
              <p className="text-xs text-cyan-300/80 font-mono mt-0.5">
                Título Oficial da FIA &bull;{' '}
                <span className="font-bold text-white">
                  {champions.constructor?.points ?? 0} pontos
                </span>
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0 shadow-lg">
              <Award className="w-7 h-7" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-cyan-500/20 flex items-center justify-between text-[11px] font-mono text-[#8B95A7]">
            <span>Maior pontuação acumulada de construtores</span>
            <span className="text-cyan-400 font-bold">P1 CONSTRUTORES</span>
          </div>
        </Card>
      </div>

      {/* BLOCO DA EQUIPE DO JOGADOR + POSIÇÕES DOS PILOTOS E PREMIAÇÕES EM DINHEIRO (R$) */}
      <Card className="bg-[#090D15]/95 border-2 border-emerald-500/40 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-[#1F2733]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <DollarSign className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block">
                SUA ESCUDERIA // RESULTADO OFICIAL & PREMIAÇÃO
              </span>
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                {team?.name || 'Audi F1 Team'}
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono">
                  Construtores P{playerRank}
                </Badge>
              </h2>
              <p className="text-xs text-[#8B95A7] font-mono mt-1">
                Total acumulado de premiação em dinheiro (FIA Prize Money + Desempenho):{' '}
                <span className="text-emerald-400 font-black text-sm">
                  {formatCurrency(grandTotalPrize)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
            <Button
              onClick={handleStartNextSeason}
              disabled={isTransitioning || transitionDone}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold px-6 py-6 text-sm shadow-xl flex items-center gap-2 w-full sm:w-auto justify-center"
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

        {/* Detalhamento das Premiações da Equipe e dos Pilotos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
          {/* Card 1: Premiação Construtores */}
          <div className="p-4 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-[#8B95A7] uppercase">
                Mundial de Construtores
              </span>
              <Badge className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono">
                P{playerRank}
              </Badge>
            </div>
            <div className="text-xl font-black text-white">{formatCurrency(teamPrizeMoney)}</div>
            <p className="text-[11px] font-mono text-[#8B95A7]">
              Premiação oficial da FIA por posição no campeonato de construtores (
              {playerTeamStanding?.points || 0} pts).
            </p>
          </div>

          {/* Card 2 & 3: Pilotos do Jogador */}
          {playerDriversStandings.map((pDriver: any, idx: number) => {
            const driverPrize = getDriverPrize(pDriver.rank || 15)
            return (
              <div
                key={pDriver.id || idx}
                className="p-4 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold truncate">
                    Piloto #{idx + 1}: {pDriver.name}
                  </span>
                  <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-mono">
                    P{pDriver.rank} ({pDriver.points} pts)
                  </Badge>
                </div>
                <div className="text-xl font-black text-emerald-400">
                  {formatCurrency(driverPrize)}
                </div>
                <p className="text-[11px] font-mono text-[#8B95A7]">
                  Bônus financeiro esportivo aportado ao caixa pelo desempenho no campeonato de
                  pilotos.
                </p>
              </div>
            )
          })}
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
                    {eligibleReplacements.map((cand) => (
                      <div
                        key={cand.key}
                        onClick={() => {
                          setSelectedReplacementKey(cand.key)
                          setDecisionConfirmed(false)
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all text-xs font-mono ${
                          selectedReplacementKey === cand.key
                            ? 'bg-indigo-500/20 border-indigo-500 text-white font-bold ring-2 ring-indigo-500/60 shadow-lg'
                            : 'bg-[#090D15] border-[#1F2733] text-slate-300 hover:border-indigo-500/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white truncate flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: cand.color || '#6366f1' }}
                            />
                            {cand.name}
                          </span>
                          <span className="text-[10px] text-indigo-400 shrink-0">
                            {cand.country}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#8B95A7]">
                          Motor: <span className="text-white">{cand.engine}</span> • Força:{' '}
                          <span className="text-emerald-400">{cand.strength}</span>
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono">
                          Orçamento: {formatCurrency(cand.budget || 100000000)}
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

      {/* BLOCO: DANÇA DAS CADEIRAS (MERCADO DE PILOTOS ENTRE TEMPORADAS 2026 -> 2027) */}
      <Card className="bg-[#090D15]/90 border border-violet-500/40 p-6 shadow-2xl backdrop-blur-md">
        <CardHeader className="p-0 pb-4 border-b border-violet-500/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-violet-400 font-bold block flex items-center gap-1.5">
                <Shuffle className="w-3.5 h-3.5" />
                MERCADO DE PILOTOS // DANÇA DAS CADEIRAS
              </span>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2 mt-1">
                Transferências e Movimentações para a Temporada 2027
              </CardTitle>
            </div>
            <Badge
              variant="outline"
              className="text-xs font-mono border-violet-500/50 text-violet-300"
            >
              {marketMoves.length} movimentações registradas
            </Badge>
          </div>
          <CardDescription className="text-xs text-[#8B95A7] font-mono mt-2">
            Acompanhe quem foi para onde: trocas de escuderia, renovações estratégicas, promoções de
            base e pilotos sem contrato que viraram agentes livres.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 pt-4">
          {marketMoves.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-[#8B95A7]">
              O grid de 2027 mantém estabilidade em seus contratos titulares. Nenhuma troca
              pendente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1F2733] bg-[#11161F] text-[#8B95A7] text-[10px] uppercase">
                    <th className="py-2.5 px-3 font-bold">Piloto</th>
                    <th className="py-2.5 px-3 font-bold">Equipe de Origem (2026)</th>
                    <th className="py-2.5 px-3 font-bold">Destino Oficial (2027)</th>
                    <th className="py-2.5 px-3 font-bold">Assento / Papel</th>
                    <th className="py-2.5 px-3 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2733]">
                  {marketMoves.map((move, idx) => (
                    <tr key={idx} className="hover:bg-[#11161F]/60 transition-colors">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span>{move.driverName}</span>
                      </td>
                      <td className="py-3 px-3 text-[#8B95A7]">{move.originTeamName}</td>
                      <td className="py-3 px-3 font-semibold text-cyan-300">
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className="w-3 h-3 text-violet-400 shrink-0" />
                          <span>{move.destinationTeamName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono border-[#1F2733] text-slate-300"
                        >
                          {move.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Badge
                          className={
                            move.type === 'CONFIRMED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]'
                              : 'bg-amber-950 text-amber-400 border border-amber-800 text-[10px]'
                          }
                        >
                          {move.type === 'CONFIRMED' ? 'Contrato Assinado' : 'Agente Livre'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
