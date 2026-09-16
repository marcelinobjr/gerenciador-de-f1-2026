import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { f1Service } from '@/services/f1Service'
import { raceReportService } from '@/services/raceReportService'
import { standingsService } from '@/services/standingsService'
import { eraHistoryService } from '@/services/eraHistoryService'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { formatCurrency } from '@/lib/formatters'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { EmptyState } from '@/components/EmptyState'
import { AmbientBackground } from '@/components/AmbientBackground'
import { RaceReportModal } from '@/components/race/RaceReportModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  History,
  FileText,
  TrendingUp,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { RaceResultModel, DriverModel, RaceReportModel, RaceReportData } from '@/types/f1'

interface RoundHistoryItem {
  round: number
  gpName: string
  circuitName: string
  country: string
  flag: string
  date: string
  isCompleted: boolean
  playerPoints: number
  playerBestPos: number | null
  playerDriversResults: {
    driverName: string
    position: number
    points: number
    dnf?: boolean
  }[]
  hasReport: boolean
  reportData: RaceReportData | null
  teamRankAfter: number | null
  teamPointsAccum: number
  rivalPointsAccum: number
}

export default function HistoryPage() {
  const { team, season } = useAuth()

  const [loading, setLoading] = useState(true)
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [playerDrivers, setPlayerDrivers] = useState<DriverModel[]>([])
  const [reports, setReports] = useState<RaceReportModel[]>([])
  const [selectedReport, setSelectedReport] = useState<RaceReportData | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const [archivedHistories, setArchivedHistories] = useState<any[]>([])

  // Carregar dados
  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!season || !team) {
        setLoading(false)
        return
      }
      try {
        const [rList, dList, repList, histRecords] = await Promise.all([
          f1Service.getSeasonRaceResults(season.id),
          f1Service.getTeamDrivers(team.id),
          raceReportService.getSeasonReports(season.id),
          pb
            .collection('season_histories')
            .getFullList({ sort: 'season_year' })
            .catch(() => []),
        ])
        if (mounted) {
          setRaceResults(rList)
          setPlayerDrivers(dList)
          setReports(repList)
          setArchivedHistories(histRecords || [])
        }
      } catch (err) {
        console.error('Erro ao carregar histórico da temporada:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [season?.id, team?.id])

  // Classificação atual unificada para encontrar o rival direto (imediatamente acima)
  const standings = useMemo(() => {
    return standingsService.calculateStandings({
      raceResults,
      playerDrivers,
      team,
      season,
    })
  }, [raceResults, playerDrivers, team, season])

  // Identificar Rival Direto (imediatamente acima na tabela de construtores)
  const rivalInfo = useMemo(() => {
    const list = standings.constructorStandings || []
    const playerIdx = list.findIndex((t) => t.isPlayer)
    if (playerIdx > 0) {
      // Existe equipe acima: é o rival direto!
      const rival = list[playerIdx - 1]
      return {
        id: rival.id,
        name: rival.name,
        color: rival.color || '#3B82F6',
        points: rival.points,
        rank: playerIdx, // 1-based é playerIdx
        gap: rival.points - (list[playerIdx]?.points || 0),
        isLeader: playerIdx === 1,
      }
    } else if (playerIdx === 0 && list.length > 1) {
      // Jogador é o líder P1: o rival direto é o 2º colocado que o persegue
      const rival = list[1]
      return {
        id: rival.id,
        name: rival.name,
        color: rival.color || '#F59E0B',
        points: rival.points,
        rank: 2,
        gap: (list[0]?.points || 0) - rival.points,
        isLeader: true,
      }
    }
    return {
      id: 'ferrari',
      name: 'Scuderia Ferrari',
      color: '#E80020',
      points: 0,
      rank: 1,
      gap: 0,
      isLeader: false,
    }
  }, [standings])

  // Mapear rodadas disputadas e criar histórico consolidado GP a GP
  const { historyList, chartData, statsSummary } = useMemo(() => {
    const completedRoundsSet = new Set<number>()
    raceResults.forEach((r) => {
      if (typeof r.round === 'number') completedRoundsSet.add(r.round)
    })

    const reportsMap = new Map<number, RaceReportModel>()
    reports.forEach((rep) => reportsMap.set(rep.round, rep))

    const list: RoundHistoryItem[] = []
    const chart: {
      round: number
      gp: string
      teamPoints: number
      rivalPoints: number
    }[] = []

    let accumTeamPts = 0
    let accumRivalPts = 0
    let totalWins = 0
    let totalPodiums = 0
    let totalPoints = 0

    const currentSeasonRound = season?.current_round || 1
    const totalCalendarRounds = season?.total_rounds || 24

    for (let r = 1; r <= totalCalendarRounds; r++) {
      const cal = F1_2026_CALENDAR.find((c) => c.round === r) || {
        round: r,
        name: `GP da Rodada ${r}`,
        circuit: 'Circuito Oficial FIA',
        country: 'Mundial',
        flag: '🏁',
        date: '2026',
      }

      const isCompleted =
        completedRoundsSet.has(r) || (r < currentSeasonRound && completedRoundsSet.size > 0)
      const roundResults = raceResults.filter((res) => res.round === r)

      // Resultados dos pilotos do jogador
      const playerResultsInRound = roundResults.filter(
        (res) => res.team_id === team?.id || playerDrivers.some((d) => d.id === res.driver_id),
      )

      let roundPts = 0
      let bestPos: number | null = null
      const driverItems: {
        driverName: string
        position: number
        points: number
        dnf?: boolean
      }[] = []

      playerResultsInRound.forEach((pr) => {
        const pts = typeof pr.points === 'number' ? pr.points : 0
        roundPts += pts
        if (bestPos === null || pr.position < bestPos) {
          bestPos = pr.position
        }
        if (pr.position === 1) totalWins++
        if (pr.position <= 3) totalPodiums++

        const matchedDriver = playerDrivers.find((d) => d.id === pr.driver_id)
        driverItems.push({
          driverName: pr.expand?.driver_id?.name || matchedDriver?.name || 'Piloto',
          position: pr.position,
          points: pts,
        })
      })

      // Pontos do rival na rodada (para gráfico acumulado)
      const rivalResultsInRound = roundResults.filter(
        (res) =>
          res.team_id === rivalInfo.id ||
          res.expand?.team_id?.name?.toLowerCase() === rivalInfo.name.toLowerCase(),
      )
      let rivalRoundPts = 0
      rivalResultsInRound.forEach((rr) => {
        rivalRoundPts += typeof rr.points === 'number' ? rr.points : 0
      })

      // Se não há dados do rival na rodada mas a etapa foi concluída, simulamos a média de pontos FIA para a curva
      if (rivalRoundPts === 0 && isCompleted) {
        rivalRoundPts = Math.round(rivalInfo.points / Math.max(1, completedRoundsSet.size))
      }

      accumTeamPts += roundPts
      accumRivalPts += rivalRoundPts
      totalPoints += roundPts

      // Relatório salvo ou sintetizado
      const reportModel = reportsMap.get(r)
      let reportData: RaceReportData | null = reportModel ? reportModel.data : null

      // Se rodada foi completada e não tem relatório no DB, sintetizamos a partir dos dados existentes
      if (!reportData && isCompleted) {
        const prevResults = raceResults.filter((res) => res.round < r)
        const currResults = raceResults.filter((res) => res.round <= r)
        try {
          reportData = raceReportService.generateReportData({
            round: r,
            gpInfo: {
              name: cal.name,
              circuit: (cal as any).circuit || 'Circuito Homologado FIA',
              country: cal.country,
              flag: cal.flag,
              laps: (cal as any).laps || 55,
            },
            finalGrid: roundResults.map((res) => ({
              driverId: res.driver_id,
              driverName: res.expand?.driver_id?.name || 'Piloto',
              teamId: res.team_id,
              teamName: res.expand?.team_id?.name || '',
              teamColor: res.expand?.team_id?.color || '#E10600',
              isPlayer: res.team_id === team?.id,
              flag: (res.expand?.driver_id as any)?.flag || '🏁',
              position: res.position,
              points: res.points,
              fastestLap: res.fastest_lap,
              dnf: false,
              totalTime: res.position === 1 ? 'Vencedor' : `+${res.position * 2.1}s`,
            })),
            raceIncidents: [],
            liveEvents: [],
            team: team!,
            season: season!,
            drivers: playerDrivers,
            previousRaceResults: prevResults,
            currentRaceResults: currResults,
          })
        } catch {
          reportData = null
        }
      }

      const item: RoundHistoryItem = {
        round: r,
        gpName: cal.name,
        circuitName: (cal as any).circuit || 'Circuito Oficial',
        country: cal.country || 'Mundial',
        flag: cal.flag || '🏁',
        date: (cal as any).date || `Etapa ${r}`,
        isCompleted,
        playerPoints: roundPts,
        playerBestPos: bestPos,
        playerDriversResults: driverItems,
        hasReport: !!reportData,
        reportData,
        teamRankAfter: reportData?.constructorDelta?.rankAfter || null,
        teamPointsAccum: accumTeamPts,
        rivalPointsAccum: accumRivalPts,
      }

      list.push(item)

      if (isCompleted) {
        chart.push({
          round: r,
          gp: `R${r}`,
          teamPoints: accumTeamPts,
          rivalPoints: accumRivalPts,
        })
      }
    }

    return {
      historyList: list,
      chartData: chart,
      statsSummary: {
        completedCount: completedRoundsSet.size,
        totalPoints,
        totalWins,
        totalPodiums,
        currentRank: standings.playerConstructorRank,
      },
    }
  }, [raceResults, playerDrivers, reports, team, season, standings, rivalInfo])

  const handleOpenReport = (reportData: RaceReportData | null) => {
    if (!reportData) return
    setSelectedReport(reportData)
    setModalOpen(true)
  }

  const teamColor = team?.color || '#E10600'
  const rivalColor = rivalInfo.color || '#3B82F6'

  return (
    <div className="relative space-y-8 animate-fade-in-up">
      <AmbientBackground />

      {/* PageHeader padrão Race Operations */}
      <PageHeader
        eyebrow="RACE OPERATIONS // HISTÓRICO"
        title={`Histórico da Temporada ${season?.year || 2026}`}
        description={
          <span>
            Arquivo GP a GP da temporada oficial FIA • Evolução de pontos acumulados, relatórios de
            debriefing por rodada e linha do tempo de desempenho da {team?.name || 'sua escuderia'}.
          </span>
        }
        badge={
          <span className="px-2.5 py-1 rounded-md text-xs font-num font-semibold bg-[#11161F] border border-[#1F2733] text-cyan-400 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            {statsSummary.completedCount} de {season?.total_rounds || 24} GPs Disputados
          </span>
        }
      />

      {/* KPIs do Histórico */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          eyebrow="PONTOS ACUMULADOS"
          value={`${statsSummary.totalPoints} pts`}
          subtext={`${statsSummary.completedCount} etapas disputadas`}
          delta={
            statsSummary.totalPoints > 0
              ? {
                  value: `${(statsSummary.totalPoints / Math.max(1, statsSummary.completedCount)).toFixed(1)}/GP`,
                  trend: 'up',
                  label: 'média',
                }
              : undefined
          }
          accentColor="#00A6FB"
        />
        <StatCard
          eyebrow="POSIÇÃO NO MUNDIAL"
          value={`P${statsSummary.currentRank}`}
          subtext="De 12 construtores oficiais"
          accentColor="#22C55E"
        />
        <StatCard
          eyebrow="VITÓRIAS & PÓDIOS"
          value={`${statsSummary.totalWins}V • ${statsSummary.totalPodiums}P`}
          subtext="Celebrações de troféu"
          accentColor="#F59E0B"
        />
        <StatCard
          eyebrow="RIVAL DIRETO NO MUNDIAL"
          value={rivalInfo.name.split(' ')[0]}
          subtext={
            rivalInfo.isLeader
              ? `Você lidera por ${rivalInfo.gap} pts`
              : `Diferença de ${rivalInfo.gap} pts`
          }
          delta={{
            value: rivalInfo.isLeader ? 'Líder' : `P${rivalInfo.rank}`,
            trend: rivalInfo.isLeader ? 'up' : 'neutral',
          }}
          accentColor="#EC4899"
        />
      </div>

      {/* GRÁFICO SIMPLES E DISCRETO DE EVOLUÇÃO DE PONTOS (Equipe vs Rival Direto) */}
      <div className="p-5 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F2733] pb-3">
          <div>
            <span className="eyebrow text-[#00A6FB] text-[10px] tracking-wider uppercase block">
              TRAJETÓRIA DO CAMPEONATO // EVOLUÇÃO DE PONTOS
            </span>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
              <TrendingUp className="w-4 h-4 text-[#00A6FB]" />
              Pontuação Acumulada: {team?.name || 'Sua Equipe'} vs. {rivalInfo.name}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-num">
            <span className="flex items-center gap-1.5 text-white">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: teamColor }} />
              {team?.name || 'Sua Equipe'}
            </span>
            <span className="flex items-center gap-1.5 text-[#8B95A7]">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: rivalColor }} />
              {rivalInfo.name} (Rival Direto)
            </span>
          </div>
        </div>

        {chartData.length > 0 ? (
          <div className="w-full h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#1F2733" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="gp"
                  stroke="#6A768A"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1F2733' }}
                />
                <YAxis
                  stroke="#6A768A"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1F2733' }}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B0E14',
                    borderColor: '#1F2733',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  formatter={(value: any, name: any) => [
                    `${value} pts`,
                    name === 'teamPoints' ? team?.name || 'Sua Equipe' : rivalInfo.name,
                  ]}
                  labelFormatter={(label) => `Rodada: ${label}`}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ display: 'none' }} />
                <Line
                  type="monotone"
                  dataKey="teamPoints"
                  name="teamPoints"
                  stroke={teamColor}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: teamColor }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="rivalPoints"
                  name="rivalPoints"
                  stroke={rivalColor}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: rivalColor }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-[#8B95A7] font-mono">
            Gráfico de evolução será exibido após a conclusão da 1ª corrida da temporada.
          </div>
        )}
      </div>

      {/* ARQUIVO GP A GP: LINHA DO TEMPO DA TEMPORADA */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="eyebrow text-[#8B95A7] text-[10px] tracking-wider uppercase block">
              CALENDÁRIO & RESULTADOS CONSOLIDADOS
            </span>
            <h3 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Arquivo Etapa por Etapa (24 Grandes Prêmios)
            </h3>
          </div>
          <span className="text-xs text-[#8B95A7] font-num">
            {statsSummary.completedCount}/24 concluídos
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton
                key={i}
                className="h-20 w-full bg-[#11161F] rounded-xl border border-[#1F2733]"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {historyList.map((item) => {
              return (
                <div
                  key={item.round}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    item.isCompleted
                      ? 'bg-[#11161F] border-[#1F2733] hover:border-[#2A3649]'
                      : 'bg-[#0B0E14]/60 border-[#1F2733]/50 opacity-60'
                  }`}
                >
                  {/* Info da Corrida */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center font-num font-bold text-xs shrink-0 ${
                        item.isCompleted
                          ? 'bg-[#161D29] text-white border border-[#1F2733]'
                          : 'bg-[#0E131B] text-[#6A768A]'
                      }`}
                    >
                      <span className="text-[10px] text-[#8B95A7] font-mono leading-none">R</span>
                      <span className="text-sm font-bold leading-tight">{item.round}</span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{item.flag}</span>
                        <h4 className="text-sm font-bold text-white tracking-wide">
                          {item.gpName}
                        </h4>
                        {item.isCompleted ? (
                          <Badge className="bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 text-[9px] px-1.5 py-0 font-num">
                            Concluído
                          </Badge>
                        ) : (
                          <Badge className="bg-[#161D29] text-[#8B95A7] border border-[#1F2733] text-[9px] px-1.5 py-0 font-num">
                            Pendente
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[#8B95A7] font-num">
                        {item.circuitName} • {item.country} • {item.date}
                      </p>
                    </div>
                  </div>

                  {/* Resultados ou EmptyState da Rodada */}
                  {item.isCompleted ? (
                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-between md:justify-end">
                      {/* Posição no Campeonato após a rodada */}
                      {item.teamRankAfter && (
                        <div className="text-left sm:text-center">
                          <span className="text-[10px] text-[#8B95A7] uppercase font-mono block">
                            Posição Pós-GP
                          </span>
                          <span className="font-num text-sm font-bold text-white">
                            P{item.teamRankAfter}
                          </span>
                        </div>
                      )}

                      {/* Desempenho dos pilotos */}
                      <div className="text-left sm:text-center">
                        <span className="text-[10px] text-[#8B95A7] uppercase font-mono block">
                          Pilotos no GP
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-num text-[#F5F7FA]">
                          {item.playerDriversResults.length > 0 ? (
                            item.playerDriversResults.map((dr, idx) => (
                              <span
                                key={idx}
                                className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                  dr.position === 1
                                    ? 'bg-amber-400 text-black'
                                    : dr.position <= 3
                                      ? 'bg-amber-700 text-white'
                                      : dr.position <= 10
                                        ? 'bg-[#161D29] text-[#22C55E] border border-[#22C55E]/30'
                                        : 'bg-[#161D29] text-[#8B95A7]'
                                }`}
                              >
                                P{dr.position}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[#8B95A7]">
                              {item.playerBestPos ? `Melhor P${item.playerBestPos}` : 'Sem dados'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pontos Marcados */}
                      <div className="text-right">
                        <span className="text-[10px] text-[#8B95A7] uppercase font-mono block">
                          Pontos FIA
                        </span>
                        <span className="font-num text-sm font-extrabold text-[#22C55E]">
                          +{item.playerPoints} pts
                        </span>
                      </div>

                      {/* Botão Ver Relatório do GP */}
                      <div>
                        <Button
                          size="sm"
                          onClick={() => handleOpenReport(item.reportData)}
                          disabled={!item.hasReport && !item.reportData}
                          className="bg-[#161D29] hover:bg-[#1f2937] text-cyan-400 border border-cyan-500/30 text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Ver Relatório</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-[#6A768A] font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Etapa aguardando realização no calendário oficial</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 8C.4: ERA SUMMARY & ARQUIVO HISTÓRICO DE ERAS TÉCNICAS */}
      {archivedHistories.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[#1C2330]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Resumo Histórico de Eras Técnicas
              </h2>
              <p className="text-xs text-[#8B95A7]">
                Linha do tempo oficial de campeões mundiais, dinastias e evolução das gerações de
                monopostos.
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-mono"
            >
              {archivedHistories.length} Temporadas Concluídas
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eraHistoryService
              .buildEraSummaries(
                archivedHistories.map((h) => ({
                  id: h.id,
                  season: h.season_year,
                  technicalEraId: h.technical_era_id || 'era_2026_baseline',
                  driversChampion: h.drivers_champion,
                  constructorsChampion: h.constructors_champion,
                  finalStandings: {
                    drivers: h.final_driver_standings || [],
                    constructors: h.final_constructor_standings || [],
                  },
                  teamSummary: h.team_summary || {},
                  majorRecords: h.major_records || { totalRaces: 24, mostWinsDriver: '' },
                  archivedAt: h.archived_at || h.created,
                })),
              )
              .map((eraSummary) => (
                <div
                  key={eraSummary.eraId}
                  className="p-4 rounded-xl bg-[#0F141C] border border-[#1C2330] space-y-3 font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase">
                      {eraSummary.name}
                    </span>
                    <span className="text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded">
                      {eraSummary.durationSeasons}{' '}
                      {eraSummary.durationSeasons === 1 ? 'temporada' : 'temporadas'}
                    </span>
                  </div>

                  {eraSummary.dominantTeam && (
                    <div className="p-2.5 rounded-lg bg-[#090D14] border border-[#1A222F] text-xs">
                      <span className="text-[10px] text-zinc-400 block uppercase">
                        Força Dominante da Era:
                      </span>
                      <strong className="text-amber-400 text-sm font-bold block">
                        {eraSummary.dominantTeam.teamName} ({eraSummary.dominantTeam.titlesCount}{' '}
                        títulos)
                      </strong>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs">
                    <span className="text-[10px] text-zinc-400 block uppercase font-bold">
                      Campeões Homologados:
                    </span>
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                      {eraSummary.constructorsChampions.map((c, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] bg-[#141B26]/60 p-1.5 rounded"
                        >
                          <span className="text-zinc-400">{c.season}</span>
                          <strong className="text-white truncate max-w-[140px]">
                            {c.teamName}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* MODAL DE RELATÓRIO PÓS-CORRIDA */}
      <RaceReportModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        report={selectedReport}
        teamColor={teamColor}
      />
    </div>
  )
}
