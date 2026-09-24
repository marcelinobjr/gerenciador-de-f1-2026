import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { f1Service } from '@/services/f1Service'
import { raceReportService } from '@/services/raceReportService'
import { standingsService } from '@/services/standingsService'
import { eraHistoryService } from '@/services/eraHistoryService'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { RaceReportModal } from '@/components/race/RaceReportModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
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
  Trophy,
  Swords,
  ChevronRight,
  Flag,
  Target,
  BarChart3,
  ListFilter,
  ShieldAlert,
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

// Custom tooltip para gráfico claro
function CustomChartTooltip({ active, payload, label, teamName, rivalName }: any) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-[#E2E8F0] shadow-lg rounded-xl p-3 text-xs space-y-1.5 min-w-[190px]">
      <div className="font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-1 flex items-center justify-between">
        <span className="font-mono text-[11px] text-[#64748B]">RODADA</span>
        <span className="font-mono font-black text-[#0F172A]">{label}</span>
      </div>
      {payload.map((entry: any, index: number) => {
        const isTeam = entry.dataKey === 'teamPoints'
        const labelName = isTeam ? teamName : rivalName
        return (
          <div key={index} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-[#475569] font-medium truncate max-w-[120px]">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="truncate">{labelName}</span>
            </span>
            <span className="font-mono font-bold text-[#0F172A] shrink-0">
              {entry.value} <span className="text-[10px] text-[#94A3B8] font-normal">pts</span>
            </span>
          </div>
        )
      })}
    </div>
  )
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

  // Estado de controle das abas do bloco de 2º nível
  const [activeTab, setActiveTab] = useState<'timeline' | 'rounds' | 'highlights'>('timeline')
  const [chartRange, setChartRange] = useState<'all' | 'last5'>('all')

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

  // Classificação atual unificada para encontrar o rival direto
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
        color: rival.color || '#2563EB',
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

  // Filtragem de dados para o gráfico com base no filtro selecionado
  const displayedChartData = useMemo(() => {
    if (chartRange === 'last5' && chartData.length > 5) {
      return chartData.slice(-5)
    }
    return chartData
  }, [chartData, chartRange])

  // Destaques analíticos da temporada (Opção C)
  const seasonHighlights = useMemo(() => {
    const completedItems = historyList.filter((item) => item.isCompleted)
    if (completedItems.length === 0) {
      return {
        bestResult: null,
        worstResult: null,
        biggestPoints: null,
        avgPointsPerCompletedGp: 0,
        podiumRate: '0%',
        pointsScoredRounds: 0,
      }
    }

    let bestResItem: RoundHistoryItem | null = null
    let worstResItem: RoundHistoryItem | null = null
    let maxPtsItem: RoundHistoryItem | null = null
    let roundsWithPoints = 0

    completedItems.forEach((item) => {
      if (item.playerPoints > 0) roundsWithPoints++

      if (item.playerBestPos !== null) {
        if (
          !bestResItem ||
          (bestResItem.playerBestPos !== null && item.playerBestPos < bestResItem.playerBestPos)
        ) {
          bestResItem = item
        }
        if (
          !worstResItem ||
          (worstResItem.playerBestPos !== null && item.playerBestPos > worstResItem.playerBestPos)
        ) {
          worstResItem = item
        }
      }

      if (!maxPtsItem || item.playerPoints > maxPtsItem.playerPoints) {
        maxPtsItem = item
      }
    })

    const avg = statsSummary.totalPoints / Math.max(1, completedItems.length)
    const podRate = Math.round(
      (statsSummary.totalPodiums / Math.max(1, completedItems.length * 2)) * 100,
    )

    return {
      bestResult: bestResItem,
      worstResult: worstResItem,
      biggestPoints: maxPtsItem,
      avgPointsPerCompletedGp: avg,
      podiumRate: `${podRate}%`,
      pointsScoredRounds: roundsWithPoints,
    }
  }, [historyList, statsSummary])

  const handleOpenReport = (reportData: RaceReportData | null) => {
    if (!reportData) return
    setSelectedReport(reportData)
    setModalOpen(true)
  }

  const teamName = team?.name || 'Sua Equipe'
  const teamColor = team?.color || '#E10600'
  const rivalColor = rivalInfo.color || '#2563EB'
  const completedGPs = statsSummary.completedCount
  const totalGPs = season?.total_rounds || 24
  const progressPercent = Math.min(100, Math.round((completedGPs / Math.max(1, totalGPs)) * 100))

  return (
    <div className="space-y-6 pb-16 antialiased text-[#0F172A] select-none">
      {/* ======================================================== */}
      {/* 1. HEADER DA PÁGINA COM IDENTIDADE CLARA E REFINADA      */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Título & Contexto Editorial */}
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-wider text-[#E10600] uppercase bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                RACE OPERATIONS
              </span>
              <span className="text-[#CBD5E1]">•</span>
              <span className="text-[11px] font-mono text-[#64748B] uppercase">
                ARQUIVO OFICIAL DA TEMPORADA {season?.year || 2026}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A] flex items-center gap-3">
              <span>Histórico da Temporada {season?.year || 2026}</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              Acompanhe a trajetória completa da{' '}
              <strong className="text-[#0F172A] font-semibold">{teamName}</strong> ao longo do
              campeonato mundial da FIA. Registro GP a GP de pontuação, debriefings oficiais e
              comparativo de performance contra o rival direto.
            </p>
          </div>

          {/* Badge / Resumo de Progresso do Calendário */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2 bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-xl shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-[#0F172A]">
                {completedGPs} de {totalGPs} GPs disputados
              </span>
            </div>

            <div className="w-full sm:w-44 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#E10600] to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <span className="text-[10px] text-[#64748B] font-mono">
              {progressPercent}% do calendário concluído
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. CARDS DE KPI (FUNDO BRANCO, BORDAS SUTIS, DETALHE TOPO) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pontos Acumulados */}
        <div className="relative bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs overflow-hidden transition-all hover:shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#2563EB]" />
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block truncate">
                PONTOS ACUMULADOS
              </span>
              <div className="font-mono text-2xl lg:text-3xl font-black text-[#0F172A] tracking-tight truncate">
                {statsSummary.totalPoints}{' '}
                <span className="text-xs text-[#64748B] font-normal font-sans">pts</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#475569] pt-0.5">
                {statsSummary.totalPoints > 0 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-[#2563EB] border border-blue-100">
                    <TrendingUp className="w-3 h-3" />
                    {(statsSummary.totalPoints / Math.max(1, statsSummary.completedCount)).toFixed(
                      1,
                    )}
                    /GP
                  </span>
                ) : (
                  <span className="text-[11px] text-[#94A3B8] font-mono">0.0/GP</span>
                )}
                <span className="text-[11px] text-[#64748B] truncate">
                  {statsSummary.completedCount} etapas disputadas
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 border border-blue-100">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI 2: Posição no Mundial */}
        <div className="relative bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs overflow-hidden transition-all hover:shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block truncate">
                POSIÇÃO NO MUNDIAL
              </span>
              <div className="font-mono text-2xl lg:text-3xl font-black text-[#0F172A] tracking-tight truncate">
                P{statsSummary.currentRank}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#475569] pt-0.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  {statsSummary.currentRank === 1 ? 'Líder' : `Top ${statsSummary.currentRank}`}
                </span>
                <span className="text-[11px] text-[#64748B] truncate">De 12 construtores</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI 3: Vitórias & Pódios */}
        <div className="relative bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs overflow-hidden transition-all hover:shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block truncate">
                VITÓRIAS & PÓDIOS
              </span>
              <div className="font-mono text-2xl lg:text-3xl font-black text-[#0F172A] tracking-tight truncate">
                {statsSummary.totalWins}V • {statsSummary.totalPodiums}P
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#475569] pt-0.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-100">
                  <Award className="w-3 h-3" />
                  {statsSummary.totalWins + statsSummary.totalPodiums} troféus
                </span>
                <span className="text-[11px] text-[#64748B] truncate">Celebrações de pódio</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <Award className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* KPI 4: Rival Direto */}
        <div className="relative bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs overflow-hidden transition-all hover:shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#E10600]" />
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider block truncate">
                RIVAL DIRETO
              </span>
              <div className="text-xl lg:text-2xl font-black text-[#0F172A] tracking-tight truncate">
                {rivalInfo.name}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#475569] pt-0.5">
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                    rivalInfo.isLeader
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}
                >
                  {rivalInfo.isLeader
                    ? `+${rivalInfo.gap} pts à frente`
                    : `-${rivalInfo.gap} pts atrás`}
                </span>
                <span className="text-[11px] text-[#64748B] truncate">
                  {rivalInfo.isLeader ? 'Você lidera' : `Oponente em P${rivalInfo.rank}`}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-50 text-[#E10600] flex items-center justify-center shrink-0 border border-red-100">
              <Swords className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CARD GRANDE DO GRÁFICO (CLARO, CONTRASTE ALTO, LIMPO)   */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-7 space-y-5">
        {/* Header do Gráfico com Seletor e Legenda */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F5F9] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#E10600]" />
              <span className="text-[10px] font-mono font-bold text-[#64748B] uppercase tracking-wider">
                TRAJETÓRIA DO CAMPEONATO // EVOLUÇÃO DE PONTOS
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-[#0F172A] flex items-center gap-2">
              <span>Pontuação Acumulada:</span>
              <span className="text-[#E10600]">{teamName}</span>
              <span className="text-[#94A3B8] font-normal">vs.</span>
              <span className="text-[#2563EB]">{rivalInfo.name}</span>
            </h3>
            <p className="text-xs text-[#64748B]">
              Curva oficial de pontuação rodada a rodada comparando o rendimento da sua equipe com a
              ameaça direta no Mundial de Construtores.
            </p>
          </div>

          {/* Legenda & Seletor de Período */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Legenda visual elegante */}
            <div className="flex items-center gap-4 text-xs font-mono bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 rounded-lg">
              <span className="flex items-center gap-1.5 font-bold text-[#0F172A]">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: teamColor }}
                />
                <span>{teamName}</span>
              </span>
              <span className="text-[#CBD5E1]">|</span>
              <span className="flex items-center gap-1.5 font-medium text-[#475569]">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: rivalColor }}
                />
                <span>{rivalInfo.name}</span>
              </span>
            </div>

            {/* Seletor de período */}
            {chartData.length > 5 && (
              <div className="inline-flex items-center p-0.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setChartRange('all')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    chartRange === 'all'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Todas ({chartData.length})
                </button>
                <button
                  type="button"
                  onClick={() => setChartRange('last5')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    chartRange === 'last5'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Últimas 5
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Área do Gráfico */}
        {displayedChartData.length > 0 ? (
          <div className="w-full h-72 sm:h-80 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={displayedChartData}
                margin={{ top: 12, right: 24, left: -6, bottom: 4 }}
              >
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="gp"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  fontFamily="JetBrains Mono, monospace"
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                  fontFamily="JetBrains Mono, monospace"
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  content={<CustomChartTooltip teamName={teamName} rivalName={rivalInfo.name} />}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ display: 'none' }} />
                <Line
                  type="monotone"
                  dataKey="teamPoints"
                  name="teamPoints"
                  stroke={teamColor}
                  strokeWidth={3}
                  dot={{ r: 4, fill: teamColor, stroke: '#FFFFFF', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: teamColor, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="rivalPoints"
                  name="rivalPoints"
                  stroke={rivalColor}
                  strokeWidth={2.2}
                  strokeDasharray="4 4"
                  dot={{ r: 3.5, fill: rivalColor, stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: rivalColor, stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-14 text-center bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBD5E1] p-6 space-y-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto border border-blue-100">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-[#0F172A]">
              Aguardando primeira corrida concluída
            </h4>
            <p className="text-xs text-[#64748B] max-w-md mx-auto">
              O gráfico de evolução e comparação contra {rivalInfo.name} será renderizado
              automaticamente após a oficialização do primeiro Grande Prêmio da temporada.
            </p>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. BLOCO DE SEGUNDO NÍVEL COM SELEÇÃO DE ABAS             */}
      {/*   [A. Linha do Tempo] [B. Resumo por Rodada] [C. Destaques] */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        {/* Cabeçalho da Seção com Seletor de Visualização */}
        <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-neutral-50/80 via-white to-neutral-50/80">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#E10600]" />
              <h3 className="text-sm sm:text-base font-black tracking-tight text-[#0F172A] uppercase">
                DETALHAMENTO GP A GP DA TEMPORADA {season?.year || 2026}
              </h3>
            </div>
            <p className="text-xs text-[#64748B]">
              Consulte a linha do tempo, tabela de resultados por rodada ou os destaques
              consolidados.
            </p>
          </div>

          {/* Abas de Navegação */}
          <div className="inline-flex items-center p-1 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] self-start md:self-auto shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'timeline'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'bg-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Linha do Tempo</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rounds')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'rounds'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'bg-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Resumo por Rodada</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('highlights')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'highlights'
                  ? 'bg-white text-[#0F172A] shadow-xs'
                  : 'bg-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Destaques da Temporada</span>
            </button>
          </div>
        </div>

        {/* Conteúdo: Carregamento */}
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full bg-neutral-100 rounded-xl" />
            ))}
          </div>
        ) : (
          <div>
            {/* ---------------------------------------------------- */}
            {/* OPÇÃO A: LINHA DO TEMPO CRONOLÓGICA DE GPS           */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'timeline' && (
              <div className="p-5 sm:p-6 space-y-3">
                {historyList.map((item) => {
                  return (
                    <div
                      key={item.round}
                      className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        item.isCompleted
                          ? 'bg-white border-[#E2E8F0] shadow-xs hover:border-[#CBD5E1] hover:shadow-sm'
                          : 'bg-[#FAFAFA] border-[#E2E8F0]/70 opacity-60'
                      }`}
                    >
                      {/* Identificação da Rodada e GP */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono shrink-0 border ${
                            item.isCompleted
                              ? 'bg-neutral-50 text-[#0F172A] border-[#E2E8F0]'
                              : 'bg-neutral-100 text-[#94A3B8] border-neutral-200'
                          }`}
                        >
                          <span className="text-[10px] text-[#64748B] font-bold leading-none">
                            R
                          </span>
                          <span className="text-sm font-black leading-tight">{item.round}</span>
                        </div>

                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base select-none shrink-0" title={item.country}>
                              {item.flag}
                            </span>
                            <h4 className="text-sm font-bold text-[#0F172A] tracking-tight truncate">
                              {item.gpName}
                            </h4>
                            {item.isCompleted ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-2 py-0 font-mono font-bold">
                                Concluído
                              </Badge>
                            ) : (
                              <Badge className="bg-neutral-100 text-[#64748B] border-neutral-200 text-[10px] px-2 py-0 font-mono font-medium">
                                Pendente
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-[#64748B] truncate">
                            {item.circuitName} • {item.country} • {item.date}
                          </p>
                        </div>
                      </div>

                      {/* Dados da Rodada Concluída ou Estado Aguardando */}
                      {item.isCompleted ? (
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-between md:justify-end">
                          {/* Posição no Campeonato após a rodada */}
                          {item.teamRankAfter && (
                            <div className="text-left sm:text-center">
                              <span className="text-[10px] text-[#64748B] uppercase font-mono block">
                                Posição Pós-GP
                              </span>
                              <span className="font-mono text-sm font-bold text-[#0F172A]">
                                P{item.teamRankAfter}
                              </span>
                            </div>
                          )}

                          {/* Desempenho dos pilotos da equipe */}
                          <div className="text-left sm:text-center">
                            <span className="text-[10px] text-[#64748B] uppercase font-mono block">
                              Pilotos na Etapa
                            </span>
                            <div className="flex items-center gap-1.5 text-xs font-mono">
                              {item.playerDriversResults.length > 0 ? (
                                item.playerDriversResults.map((dr, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                      dr.position === 1
                                        ? 'bg-amber-400 text-amber-950 border border-amber-500/30'
                                        : dr.position <= 3
                                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                          : dr.position <= 10
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-neutral-100 text-[#64748B] border border-neutral-200'
                                    }`}
                                  >
                                    P{dr.position}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-[#64748B]">
                                  {item.playerBestPos
                                    ? `Melhor P${item.playerBestPos}`
                                    : 'Sem dados'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Pontos Marcados no GP */}
                          <div className="text-right">
                            <span className="text-[10px] text-[#64748B] uppercase font-mono block">
                              Pontos FIA
                            </span>
                            <span className="font-mono text-sm font-black text-emerald-600">
                              +{item.playerPoints} pts
                            </span>
                          </div>

                          {/* Botão Ver Relatório do GP */}
                          <div>
                            <Button
                              size="sm"
                              onClick={() => handleOpenReport(item.reportData)}
                              disabled={!item.hasReport && !item.reportData}
                              className="bg-white hover:bg-neutral-50 text-[#0F172A] border border-[#CBD5E1] text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
                              <span>Ver Relatório</span>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-[#94A3B8] font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Etapa aguardando realização no calendário oficial</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* OPÇÃO B: RESUMO POR RODADA (TABELA EDITORIAL COMPLETA) */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'rounds' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[780px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#FAFAFA] text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                      <th className="py-3 px-4 text-center w-16">RODADA</th>
                      <th className="py-3 px-4">GRANDE PRÊMIO</th>
                      <th className="py-3 px-4 text-center">STATUS</th>
                      <th className="py-3 px-4 text-center">RESULTADO PILOTOS</th>
                      <th className="py-3 px-4 text-right">PONTOS GP</th>
                      <th className="py-3 px-4 text-right">TOTAL ACUM.</th>
                      <th className="py-3 px-4 text-center">POS. PÓS-GP</th>
                      <th className="py-3 px-4 text-center w-32">RELATÓRIO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] text-xs">
                    {historyList.map((item) => (
                      <tr
                        key={item.round}
                        className={`transition-colors ${
                          item.isCompleted ? 'hover:bg-neutral-50' : 'opacity-60 bg-neutral-50/40'
                        }`}
                      >
                        {/* Rodada */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-[#64748B]">
                          R{item.round}
                        </td>

                        {/* GP */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm select-none">{item.flag}</span>
                            <span className="font-bold text-[#0F172A]">{item.gpName}</span>
                          </div>
                          <span className="text-[11px] text-[#64748B] block">
                            {item.circuitName}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {item.isCompleted ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-mono font-bold px-2 py-0">
                              Oficializado
                            </Badge>
                          ) : (
                            <Badge className="bg-neutral-100 text-[#64748B] border-neutral-200 text-[10px] font-mono px-2 py-0">
                              Aguardando
                            </Badge>
                          )}
                        </td>

                        {/* Pilotos */}
                        <td className="py-3 px-4 text-center">
                          {item.isCompleted ? (
                            <div className="inline-flex items-center gap-1.5 font-mono text-xs">
                              {item.playerDriversResults.map((dr, idx) => (
                                <span
                                  key={idx}
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                    dr.position === 1
                                      ? 'bg-amber-400 text-amber-950'
                                      : dr.position <= 3
                                        ? 'bg-amber-100 text-amber-900'
                                        : dr.position <= 10
                                          ? 'bg-emerald-50 text-emerald-700'
                                          : 'bg-neutral-100 text-[#64748B]'
                                  }`}
                                  title={`${dr.driverName}: P${dr.position} (${dr.points} pts)`}
                                >
                                  P{dr.position}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#94A3B8] font-mono">—</span>
                          )}
                        </td>

                        {/* Pontos no GP */}
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {item.isCompleted ? (
                            <span className="text-emerald-600">+{item.playerPoints}</span>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>

                        {/* Total Acumulado */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#0F172A]">
                          {item.isCompleted ? `${item.teamPointsAccum} pts` : '—'}
                        </td>

                        {/* Posição Pós-GP */}
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          {item.teamRankAfter ? (
                            <span className="text-[#0F172A]">P{item.teamRankAfter}</span>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>

                        {/* Botão Relatório */}
                        <td className="py-3 px-4 text-center">
                          {item.isCompleted && (item.hasReport || item.reportData) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenReport(item.reportData)}
                              className="text-xs h-7 px-2.5 font-mono font-semibold text-[#2563EB] border-[#CBD5E1] hover:bg-blue-50"
                            >
                              Relatório
                            </Button>
                          ) : (
                            <span className="text-[#94A3B8] font-mono text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* OPÇÃO C: DESTAQUES ANALÍTICOS DA TEMPORADA           */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'highlights' && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Melhor Resultado */}
                  <div className="p-5 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase">
                        MELHOR RESULTADO
                      </span>
                      <Trophy className="w-4 h-4 text-emerald-600" />
                    </div>
                    {seasonHighlights.bestResult ? (
                      <div>
                        <div className="text-2xl font-mono font-black text-emerald-900">
                          P{seasonHighlights.bestResult.playerBestPos}
                        </div>
                        <p className="text-xs text-emerald-800 mt-0.5">
                          {seasonHighlights.bestResult.flag} {seasonHighlights.bestResult.gpName} (R
                          {seasonHighlights.bestResult.round})
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-[#94A3B8] font-mono">Aguardando corrida oficial</p>
                    )}
                  </div>

                  {/* Maior Pontuação em um GP */}
                  <div className="p-5 rounded-xl bg-blue-50/50 border border-blue-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-blue-800 uppercase">
                        MAIOR PONTUAÇÃO EM UM GP
                      </span>
                      <TrendingUp className="w-4 h-4 text-[#2563EB]" />
                    </div>
                    {seasonHighlights.biggestPoints ? (
                      <div>
                        <div className="text-2xl font-mono font-black text-blue-900">
                          +{seasonHighlights.biggestPoints.playerPoints} pts
                        </div>
                        <p className="text-xs text-blue-800 mt-0.5">
                          {seasonHighlights.biggestPoints.flag}{' '}
                          {seasonHighlights.biggestPoints.gpName} (R
                          {seasonHighlights.biggestPoints.round})
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-[#94A3B8] font-mono">Aguardando corrida oficial</p>
                    )}
                  </div>

                  {/* Frequência na Zona de Pontos */}
                  <div className="p-5 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-purple-800 uppercase">
                        EFICIÊNCIA DE PONTUAÇÃO
                      </span>
                      <Target className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-mono font-black text-purple-900">
                        {seasonHighlights.pointsScoredRounds} /{' '}
                        {Math.max(1, statsSummary.completedCount)} GPs
                      </div>
                      <p className="text-xs text-purple-800 mt-0.5">
                        Corridas com pelo menos 1 carro pontuando na zona oficial da FIA.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resumo de Rivalidade Direta */}
                <div className="p-5 rounded-xl bg-neutral-50 border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Swords className="w-4 h-4 text-[#E10600]" />
                      <h4 className="text-sm font-bold text-[#0F172A] uppercase">
                        Status do Duelo Direto: {teamName} vs {rivalInfo.name}
                      </h4>
                    </div>
                    <Badge className="bg-white text-[#0F172A] border-[#CBD5E1] text-xs font-mono">
                      Mundial de Construtores
                    </Badge>
                  </div>

                  <p className="text-xs text-[#475569] leading-relaxed">
                    {rivalInfo.isLeader
                      ? `Sua equipe detém a vantagem no campeonato com uma frente de ${rivalInfo.gap} pontos sobre a ${rivalInfo.name}. A consistência em todas as sessões será determinante para blindar a liderança.`
                      : `A diferença atual para a ${rivalInfo.name} é de ${rivalInfo.gap} pontos. A equipe rival ocupa o posto imediatamente superior e é o alvo prioritário de desenvolvimento e estratégia de corrida.`}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#64748B] font-mono uppercase block">
                        Seus Pontos
                      </span>
                      <span className="text-base font-mono font-black text-[#0F172A]">
                        {statsSummary.totalPoints}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#64748B] font-mono uppercase block">
                        Pontos do Rival
                      </span>
                      <span className="text-base font-mono font-black text-[#0F172A]">
                        {rivalInfo.points}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#64748B] font-mono uppercase block">
                        Diferença
                      </span>
                      <span
                        className={`text-base font-mono font-black ${
                          rivalInfo.isLeader ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {rivalInfo.isLeader ? `+${rivalInfo.gap}` : `-${rivalInfo.gap}`}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#64748B] font-mono uppercase block">
                        Sua Posição
                      </span>
                      <span className="text-base font-mono font-black text-[#0F172A]">
                        P{statsSummary.currentRank}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 5. RESUMO HISTÓRICO DE ERAS TÉCNICAS (ARQUIVO MULTI-ANO)  */}
      {/* ======================================================== */}
      {archivedHistories.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9] pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#0F172A] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Resumo Histórico de Eras Técnicas
              </h2>
              <p className="text-xs text-[#64748B]">
                Linha do tempo oficial de campeões mundiais, dinastias e evolução das gerações de
                monopostos.
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-800 text-xs font-mono self-start sm:self-auto"
            >
              {archivedHistories.length}{' '}
              {archivedHistories.length === 1 ? 'Temporada Concluída' : 'Temporadas Concluídas'}
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
                  className="p-4 rounded-xl bg-neutral-50 border border-[#E2E8F0] space-y-3 font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A] uppercase">
                      {eraSummary.name}
                    </span>
                    <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold">
                      {eraSummary.durationSeasons}{' '}
                      {eraSummary.durationSeasons === 1 ? 'temporada' : 'temporadas'}
                    </span>
                  </div>

                  {eraSummary.dominantTeam && (
                    <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] text-xs">
                      <span className="text-[10px] text-[#64748B] block uppercase">
                        Força Dominante da Era:
                      </span>
                      <strong className="text-amber-700 text-sm font-bold block">
                        {eraSummary.dominantTeam.teamName} ({eraSummary.dominantTeam.titlesCount}{' '}
                        títulos)
                      </strong>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs">
                    <span className="text-[10px] text-[#64748B] block uppercase font-bold">
                      Campeões Homologados:
                    </span>
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                      {eraSummary.constructorsChampions.map((c, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px] bg-white p-2 rounded border border-[#E2E8F0]"
                        >
                          <span className="text-[#64748B] font-bold">{c.season}</span>
                          <strong className="text-[#0F172A] truncate max-w-[140px]">
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

      {/* ======================================================== */}
      {/* 6. MODAL DE RELATÓRIO PÓS-CORRIDA (PRESERVADO)            */}
      {/* ======================================================== */}
      <RaceReportModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        report={selectedReport}
        teamColor={teamColor}
      />
    </div>
  )
}
