import React, { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ProgressBar'
import {
  Swords,
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  Trophy,
  Users,
  Target,
  Sparkles,
} from 'lucide-react'
import type { GridDisplayTeam } from '@/pages/Teams'
import type { TeamModel } from '@/types/f1'

interface RivalComparisonSectionProps {
  allTeams: GridDisplayTeam[]
  playerTeam: TeamModel | null
}

export function RivalComparisonSection({ allTeams, playerTeam }: RivalComparisonSectionProps) {
  // Encontrar a equipe do jogador no grid
  const userTeam = useMemo(() => {
    return allTeams.find((t) => t.isUserTeam) || null
  }, [allTeams])

  // Calcular métricas médias do grid
  const gridAverages = useMemo(() => {
    if (allTeams.length === 0) {
      return { avgStrength: 7.5, avgPoints: 0, avgPace: 80, avgDriverPace: 80 }
    }
    const totalStrength = allTeams.reduce((acc, t) => acc + t.strengthRating, 0)
    const totalPoints = allTeams.reduce((acc, t) => acc + t.points, 0)
    const totalPace = allTeams.reduce((acc, t) => acc + t.paceCombined, 0)
    const totalDriver = allTeams.reduce(
      (acc, t) => acc + (t.driver1.speed + t.driver2.speed) / 2,
      0,
    )

    return {
      avgStrength: Number((totalStrength / allTeams.length).toFixed(1)),
      avgPoints: Math.round(totalPoints / allTeams.length),
      avgPace: Math.round(totalPace / allTeams.length),
      avgDriverPace: Math.round(totalDriver / allTeams.length),
    }
  }, [allTeams])

  // Encontrar o RIVAL DIRETO: a equipe imediatamente acima na classificação
  const directRival = useMemo(() => {
    if (!userTeam || allTeams.length <= 1) return null
    // Ordena por posição ascendente (1º, 2º, 3º...)
    const sorted = [...allTeams].sort((a, b) => a.position - b.position)
    const userIndex = sorted.findIndex((t) => t.isUserTeam)

    if (userIndex > 0) {
      // Rival diretamente acima
      return {
        team: sorted[userIndex - 1],
        isLeader: userIndex === 1,
        gapPoints: sorted[userIndex - 1].points - userTeam.points,
        relationship: 'ahead' as const,
      }
    } else if (userIndex === 0 && sorted.length > 1) {
      // Jogador é o líder (P1): o rival direto é o P2 que persegue
      return {
        team: sorted[1],
        isLeader: true,
        gapPoints: userTeam.points - sorted[1].points,
        relationship: 'chasing' as const,
      }
    }
    return null
  }, [allTeams, userTeam])

  if (!userTeam) return null

  const playerDriverAvgSpeed = Math.round((userTeam.driver1.speed + userTeam.driver2.speed) / 2)
  const rivalDriverAvgSpeed = directRival
    ? Math.round((directRival.team.driver1.speed + directRival.team.driver2.speed) / 2)
    : 0

  return (
    <div className="rounded-xl bg-[#11161F] border border-[#1F2733] p-5 space-y-6 shadow-xl relative overflow-hidden">
      {/* Luz ambiente discreta */}
      <div
        className="absolute -top-16 -right-16 w-60 h-60 opacity-10 rounded-full blur-3xl pointer-events-none"
        style={{ backgroundColor: userTeam.color }}
      />

      {/* Header da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F2733] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow text-[#00A6FB] text-[10px] tracking-wider uppercase">
              RACE OPERATIONS // BENCHMARKING DE PERFORMANCE
            </span>
            <Badge className="bg-[#161D29] border border-[#1F2733] text-white text-[10px] font-mono px-1.5 py-0">
              Dados Homologados FIA
            </Badge>
          </div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2 mt-1">
            <Swords className="w-4 h-4 text-amber-400" />
            Comparativo com Rivais Diretos & Média do Grid
          </h3>
        </div>
        <div className="text-xs text-[#8B95A7] font-num">
          Sua Posição:{' '}
          <span className="font-bold text-white">
            {userTeam.position > 0 ? `P${userTeam.position}` : 'P12'}
          </span>{' '}
          ({userTeam.points} pts)
        </div>
      </div>

      {/* CARD DESTAQUE: RIVAL DIRETO NO MUNDIAL */}
      {directRival ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#161D29] via-[#11161F] to-[#161D29] border border-amber-500/40 relative shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base text-white shrink-0 shadow-md border border-white/20"
                style={{ backgroundColor: directRival.team.color }}
              >
                {directRival.team.name.substring(0, 2).toUpperCase()}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    RIVAL DIRETO NO CAMPEONATO
                  </span>
                  <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] px-1.5 py-0 font-num">
                    {directRival.relationship === 'ahead'
                      ? `Imediatamente Acima (P${directRival.team.position})`
                      : 'Perseguidor Direto (P2)'}
                  </Badge>
                </div>
                <h4 className="text-base font-black text-white flex items-center gap-2">
                  <span>{directRival.team.name}</span>
                  <span className="text-xs text-[#8B95A7] font-normal font-num">
                    ({directRival.team.engine})
                  </span>
                </h4>
                <p className="text-xs text-[#8B95A7] font-num">
                  {directRival.relationship === 'ahead'
                    ? `Diferença de ${directRival.gapPoints} pts para alcançar o ${directRival.team.position}º lugar`
                    : `Você lidera o campeonato com vantagem de ${directRival.gapPoints} pts sobre o 2º`}
                </p>
              </div>
            </div>

            {/* Comparação Rápida Direta */}
            <div className="flex items-center gap-3 sm:gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-[#1F2733]">
              <div className="text-center">
                <span className="text-[10px] text-[#8B95A7] uppercase font-mono block">
                  Força do Carro
                </span>
                <div className="flex items-center justify-center gap-1 font-num text-sm font-bold mt-0.5">
                  <span className="text-white">{userTeam.strengthRating.toFixed(1)}</span>
                  <span className="text-xs text-[#8B95A7]">vs</span>
                  <span className="text-amber-400">
                    {directRival.team.strengthRating.toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-[#8B95A7] uppercase font-mono block">
                  Ritmo Combinado
                </span>
                <div className="flex items-center justify-center gap-1 font-num text-sm font-bold mt-0.5">
                  <span className="text-white">{userTeam.paceCombined}</span>
                  <span className="text-xs text-[#8B95A7]">vs</span>
                  <span className="text-amber-400">{directRival.team.paceCombined}</span>
                </div>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-[#8B95A7] uppercase font-mono block">
                  Pontos FIA
                </span>
                <div className="flex items-center justify-center gap-1 font-num text-sm font-bold mt-0.5">
                  <span className="text-white">{userTeam.points}</span>
                  <span className="text-xs text-[#8B95A7]">vs</span>
                  <span className="text-cyan-400">{directRival.team.points}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* TABELA DE COMPARAÇÃO DE 3 EIXOS: CARRO, PILOTOS, PONTOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. EIXO RITMO DO CARRO */}
        <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-3">
          <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Ritmo & Força do Carro
            </span>
            <span className="text-[10px] text-[#8B95A7] font-num">Escala 0-10</span>
          </div>

          <div className="space-y-2.5 text-xs font-num">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-white font-bold">{userTeam.name} (Você)</span>
                <span className="font-bold text-[#00A6FB]">
                  {userTeam.strengthRating.toFixed(1)}/10
                </span>
              </div>
              <ProgressBar
                value={Math.round(userTeam.strengthRating * 10)}
                max={100}
                showValue={false}
                size="sm"
                trackClassName="bg-[#161D29]"
              />
            </div>

            {directRival && (
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-amber-400 font-semibold">
                    {directRival.team.name} (Rival)
                  </span>
                  <span className="font-bold text-amber-400">
                    {directRival.team.strengthRating.toFixed(1)}/10
                  </span>
                </div>
                <ProgressBar
                  value={Math.round(directRival.team.strengthRating * 10)}
                  max={100}
                  showValue={false}
                  size="sm"
                  trackClassName="bg-[#161D29]"
                />
              </div>
            )}

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#8B95A7]">Média do Grid F1</span>
                <span className="text-[#8B95A7]">{gridAverages.avgStrength.toFixed(1)}/10</span>
              </div>
              <ProgressBar
                value={Math.round(gridAverages.avgStrength * 10)}
                max={100}
                showValue={false}
                size="sm"
                trackClassName="bg-[#161D29]"
              />
            </div>
          </div>
        </div>

        {/* 2. EIXO PERFORMANCE DOS PILOTOS */}
        <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-3">
          <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" /> Habilidade dos Pilotos
            </span>
            <span className="text-[10px] text-[#8B95A7] font-num">Velocidade Média</span>
          </div>

          <div className="space-y-2.5 text-xs font-num">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-white font-bold">{userTeam.name}</span>
                <span className="font-bold text-[#22C55E]">{playerDriverAvgSpeed} pts</span>
              </div>
              <ProgressBar
                value={playerDriverAvgSpeed}
                max={100}
                showValue={false}
                size="sm"
                trackClassName="bg-[#161D29]"
              />
            </div>

            {directRival && (
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-amber-400 font-semibold">{directRival.team.name}</span>
                  <span className="font-bold text-amber-400">{rivalDriverAvgSpeed} pts</span>
                </div>
                <ProgressBar
                  value={rivalDriverAvgSpeed}
                  max={100}
                  showValue={false}
                  size="sm"
                  trackClassName="bg-[#161D29]"
                />
              </div>
            )}

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#8B95A7]">Média de Pilotos do Grid</span>
                <span className="text-[#8B95A7]">{gridAverages.avgDriverPace} pts</span>
              </div>
              <ProgressBar
                value={gridAverages.avgDriverPace}
                max={100}
                showValue={false}
                size="sm"
                trackClassName="bg-[#161D29]"
              />
            </div>
          </div>
        </div>

        {/* 3. EIXO PONTUAÇÃO FIA */}
        <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-3">
          <div className="flex items-center justify-between border-b border-[#1F2733] pb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" /> Eficiência de Pontos
            </span>
            <span className="text-[10px] text-[#8B95A7] font-num">Temporada 2026</span>
          </div>

          <div className="space-y-2.5 text-xs font-num">
            <div className="flex items-center justify-between p-2 rounded bg-[#11161F] border border-[#1F2733]">
              <span className="text-white font-bold truncate max-w-[120px]">{userTeam.name}</span>
              <span className="text-sm font-extrabold text-[#00A6FB]">
                {userTeam.points} <span className="text-[10px] text-[#8B95A7]">pts</span>
              </span>
            </div>

            {directRival && (
              <div className="flex items-center justify-between p-2 rounded bg-[#11161F] border border-[#1F2733]">
                <span className="text-amber-400 font-semibold truncate max-w-[120px]">
                  {directRival.team.name}
                </span>
                <span className="text-sm font-extrabold text-amber-400">
                  {directRival.team.points} <span className="text-[10px] text-[#8B95A7]">pts</span>
                </span>
              </div>
            )}

            <div className="flex items-center justify-between p-2 rounded bg-[#11161F] border border-[#1F2733]">
              <span className="text-[#8B95A7]">Média Construtores</span>
              <span className="text-sm font-bold text-[#8B95A7]">
                {gridAverages.avgPoints} <span className="text-[10px]">pts</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
