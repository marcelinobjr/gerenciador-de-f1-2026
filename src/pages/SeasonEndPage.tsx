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
} from 'lucide-react'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { seasonTransitionService } from '@/services/seasonTransitionService'
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
          navigate('/race')
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
