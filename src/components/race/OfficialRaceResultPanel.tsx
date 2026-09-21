import React, { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import {
  Trophy,
  Award,
  CheckCircle2,
  ShieldCheck,
  Timer,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  Flag,
  RotateCcw,
  Activity,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import type { OfficialRaceResult, OfficialRaceResultEntry } from '@/types/canonical-race-v2'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { driverBase2026Service, type CareerDriverRecord } from '@/services/driverBase2026Service'
import {
  canonicalChampionshipService,
  type ChampionshipSnapshot,
} from '@/services/canonicalChampionshipService'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { F1_2026_CALENDAR } from '@/lib/f1-data'

export interface OfficialRaceResultPanelProps {
  result: OfficialRaceResult
  careerPersistenceStatus?: 'PENDING' | 'APPLYING' | 'COMPLETE' | 'FAILED'
  isPersisting?: boolean
  persistenceError?: string
  onRegisterInCareer?: () => void
  onContinue?: () => void
  onViewChampionship?: () => void
  isContinuing?: boolean
}

export const OfficialRaceResultPanel: React.FC<OfficialRaceResultPanelProps> = ({
  result,
  careerPersistenceStatus = 'PENDING',
  isPersisting = false,
  persistenceError,
  onRegisterInCareer,
  onContinue,
  onViewChampionship,
  isContinuing = false,
}) => {
  const [tableExpanded, setTableExpanded] = useState(false)
  const [continueClicked, setContinueClicked] = useState(false)

  // 1. Integridade canônica do resultado (sem recalcular nada)
  const isChecksumVerified = useMemo(() => {
    return canonicalRaceResultService.verifyResultIntegrity(result)
  }, [result])

  // Vencedor, Pole e Volta mais rápida estritamente do OfficialRaceResult
  const winner = useMemo(() => {
    return (
      result.entries.find((e) => e.driverId === result.winnerDriverId) ||
      result.entries.find((e) => e.finalPosition === 1) ||
      result.entries[0]
    )
  }, [result])

  const pole = useMemo(() => {
    return (
      result.entries.find((e) => e.driverId === result.poleDriverId) ||
      result.entries.find((e) => e.gridPosition === 1)
    )
  }, [result])

  const fastest = useMemo(() => {
    if (!result.fastestLapDriverId) return null
    return (
      result.entries.find((e) => e.driverId === result.fastestLapDriverId) ||
      result.entries.find((e) => e.fastestLap) ||
      null
    )
  }, [result])

  // Pódio oficial P1, P2, P3
  const podiumEntries = useMemo(() => {
    const p1 =
      result.entries.find((e) => e.driverId === result.podium[0]) ||
      result.entries.find((e) => e.finalPosition === 1)
    const p2 =
      result.entries.find((e) => e.driverId === result.podium[1]) ||
      result.entries.find((e) => e.finalPosition === 2)
    const p3 =
      result.entries.find((e) => e.driverId === result.podium[2]) ||
      result.entries.find((e) => e.finalPosition === 3)
    return [p1, p2, p3].filter(Boolean) as OfficialRaceResultEntry[]
  }, [result])

  // Os dois carros do jogador independentes (RE-04)
  const playerCars = useMemo(() => {
    if (result.playerEntries && result.playerEntries.length >= 2) {
      return result.playerEntries
    }
    return result.entries.filter((e) => e.isPlayer)
  }, [result])

  // Stats acumuladas de carreira (consumindo career_drivers via driverBase2026Service)
  const careerRecords = useMemo(() => {
    const map: Record<string, CareerDriverRecord | null> = {}
    for (const car of playerCars) {
      map[car.driverId] = driverBase2026Service.getCareerDriver(result.careerId, car.driverId)
    }
    return map
  }, [result.careerId, playerCars])

  // Pontos somados dos dois carros nesta prova (apenas apresentação, nunca escrita)
  const teamTotalPointsThisGP = useMemo(() => {
    return playerCars.reduce((sum, c) => sum + (c.pointsAwarded || 0), 0)
  }, [playerCars])

  // Snapshots de campeonato N e N-1
  const championshipCurrent = useMemo<ChampionshipSnapshot | null>(() => {
    return canonicalChampionshipService.getChampionshipStandings(
      result.careerId,
      result.season,
      result.round,
      result.playerTeamId,
    )
  }, [result.careerId, result.season, result.round, result.playerTeamId])

  const championshipPrevious = useMemo<ChampionshipSnapshot | null>(() => {
    if (result.round <= 1) return null
    return canonicalChampionshipService.getSnapshot(
      result.careerId,
      result.season,
      result.round - 1,
    )
  }, [result.careerId, result.season, result.round])

  // Mudança de líder detectada estritamente entre snapshots
  const leaderDriverChange = useMemo(() => {
    if (!championshipPrevious || !championshipCurrent) return null
    const prevLeader = championshipPrevious.driverStandings.find((d) => d.position === 1)
    const currLeader = championshipCurrent.driverStandings.find((d) => d.position === 1)
    if (prevLeader && currLeader && prevLeader.driverId !== currLeader.driverId) {
      return {
        previousLeader: prevLeader.driverName,
        newLeader: currLeader.driverName,
      }
    }
    return null
  }, [championshipPrevious, championshipCurrent])

  const leaderConstructorChange = useMemo(() => {
    if (!championshipPrevious || !championshipCurrent) return null
    const prevLeader = championshipPrevious.constructorStandings.find((c) => c.position === 1)
    const currLeader = championshipCurrent.constructorStandings.find((c) => c.position === 1)
    if (prevLeader && currLeader && prevLeader.teamId !== currLeader.teamId) {
      return {
        previousLeader: prevLeader.teamName,
        newLeader: currLeader.teamName,
      }
    }
    return null
  }, [championshipPrevious, championshipCurrent])

  // Próximo evento canônico do calendário
  const nextEvent = useMemo(() => {
    const nextRound = result.round + 1
    return F1_2026_CALENDAR.find((c) => c.round === nextRound) || null
  }, [result.round])

  // Handler de avanço com guarda contra clique duplo
  const handleContinueClick = () => {
    if (continueClicked || isContinuing) return
    setContinueClicked(true)
    if (onContinue) {
      onContinue()
    }
  }

  const isComplete = careerPersistenceStatus === 'COMPLETE'

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className="space-y-6 max-w-6xl mx-auto pb-12 font-sans text-slate-900"
        data-testid="official-race-result-panel"
      >
        {/* ========================================================= */}
        {/* P3: 1. HERO — RESULTADO OFICIAL FIA (DESIGN CLARO PREMIUM) */}
        {/* ========================================================= */}
        <Card className="bg-white border border-slate-200/80 shadow-sm rounded-2xl overflow-hidden relative">
          <div className="h-1.5 w-full bg-[#E10600]" />
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Top Bar: Selos oficiais, checksum e data */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className="bg-[#E10600] hover:bg-[#E10600] text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 shadow-xs"
                  data-testid="badge-official-result"
                >
                  RESULTADO OFICIAL
                </Badge>

                {isChecksumVerified ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1.5 px-3 py-1 cursor-help"
                        data-testid="badge-verified-checksum"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        RESULTADO OFICIAL VERIFICADO
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs font-mono text-xs bg-slate-900 text-white p-2">
                      <p className="font-bold text-emerald-400">Checksum de integridade:</p>
                      <p className="break-all">{result.resultHash}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Snapshot imutável e homologado pela FIA.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Badge
                    variant="destructive"
                    className="text-[11px] font-bold flex items-center gap-1.5 px-3 py-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    INTEGRIDADE NÃO VERIFICADA
                  </Badge>
                )}

                <Badge
                  variant="outline"
                  className="bg-slate-50 text-slate-600 border-slate-200 text-[11px] font-mono"
                >
                  R{result.round} • {result.season}
                </Badge>
              </div>

              <div className="text-right text-xs font-mono text-slate-500">
                Oficializado em:{' '}
                <span className="text-slate-800 font-semibold">
                  {new Date(result.officializedAt).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            {/* Cabeçalho do GP */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E10600] flex items-center gap-1.5">
                  <Flag className="w-3.5 h-3.5" />
                  Grande Prêmio de F1 • Rodada {result.round}
                </span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  {result.circuitName}
                </h1>
                <p className="text-sm text-slate-600 font-medium">
                  {result.circuitCountry} • {result.totalLaps} Voltas Concluídas
                </p>
              </div>

              {/* Status de Persistência Canônica (P3 Requisito 8) */}
              <div
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/80"
                data-testid="persistence-pipeline-tracker"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  RESULTADO OFICIAL ✓
                </div>
                <span className="text-slate-300">→</span>
                {careerPersistenceStatus === 'COMPLETE' ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    CARREIRA REGISTRADA ✓
                  </div>
                ) : isPersisting || careerPersistenceStatus === 'APPLYING' ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 animate-pulse">
                    <Timer className="w-4 h-4 text-amber-600" />
                    REGISTRANDO...
                  </div>
                ) : careerPersistenceStatus === 'FAILED' ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    FALHA NO REGISTRO
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-slate-400">PENDENTE</div>
                )}
                <span className="text-slate-300">→</span>
                <div
                  className={`flex items-center gap-1.5 text-xs font-bold ${
                    isComplete ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {isComplete ? 'CAMPEONATO ATUALIZADO ✓' : 'CAMPEONATO PENDENTE'}
                </div>
              </div>
            </div>

            {/* Aviso de erro e Retry caso a persistência tenha falhado */}
            {careerPersistenceStatus === 'FAILED' && onRegisterInCareer && (
              <div
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-3 text-red-800"
                data-testid="persistence-failure-alert"
              >
                <div className="flex items-center gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    Falha ao registrar na carreira:{' '}
                    <strong>{persistenceError || 'Erro de processamento.'}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRegisterInCareer}
                  disabled={isPersisting}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  data-testid="retry-persistence-btn"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  TENTAR NOVAMENTE
                </button>
              </div>
            )}

            {/* Destaques Esportivos Principais: VENCEDOR, PÓDIO, POLE, VOLTA MAIS RÁPIDA */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              {/* Card Vencedor em Super Destaque */}
              <div
                className="md:col-span-2 p-5 rounded-xl bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 border-2 border-amber-300 shadow-xs flex items-center gap-4 relative overflow-hidden"
                data-testid="hero-winner-card"
              >
                <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-amber-200/30 rounded-full blur-xl pointer-events-none" />
                <div className="relative">
                  <DriverPhotoAvatar
                    name={winner.driverName}
                    driverId={winner.driverId}
                    teamColor={winner.teamColor || '#E10600'}
                    size="xl"
                    className="border-2 border-amber-400 shadow-md"
                  />
                  <div className="absolute -bottom-2 -right-1 bg-amber-400 text-slate-900 rounded-full p-1 shadow">
                    <Trophy className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider px-2 py-0">
                      VENCEDOR DO GP
                    </Badge>
                    <span className="text-xs font-mono text-slate-500 font-semibold">P1</span>
                  </div>
                  <h3
                    className="text-xl font-black text-slate-900 truncate"
                    data-testid="winner-driver-name"
                  >
                    {winner.driverName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-600 font-medium truncate">
                    {getTeamReducedLogoUrl(winner.teamName || winner.teamId) && (
                      <img
                        src={getTeamReducedLogoUrl(winner.teamName || winner.teamId)!}
                        alt={winner.teamName}
                        className="w-4 h-4 object-contain"
                      />
                    )}
                    <span className="truncate">{winner.teamName}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-500 pt-1">
                    Tempo:{' '}
                    <span className="font-bold text-slate-800">
                      {winner.raceTimeFormatted || '1h 28m 34s'}
                    </span>{' '}
                    • {winner.lapsCompleted} voltas
                  </div>
                </div>
              </div>

              {/* Pole Position */}
              <div
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2"
                data-testid="hero-pole-card"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5 text-slate-600" />
                    Pole Position (Qualifying)
                  </span>
                  <div
                    className="font-black text-base text-slate-900 truncate"
                    data-testid="pole-driver-name"
                  >
                    {pole?.driverName || 'N/A'}
                  </div>
                  <p className="text-xs text-slate-600 truncate">{pole?.teamName || '—'}</p>
                </div>
                <div className="text-[11px] font-mono text-slate-500 bg-white p-2 rounded-lg border border-slate-200/80">
                  Largou em: <strong className="text-slate-800">P1 no Grid</strong>
                </div>
              </div>

              {/* Volta Mais Rápida */}
              <div
                className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 flex flex-col justify-between space-y-2"
                data-testid="hero-fastest-lap-card"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    Volta Mais Rápida
                  </span>
                  <div
                    className="font-black text-base text-slate-900 truncate"
                    data-testid="fastest-lap-driver-name"
                  >
                    {fastest ? fastest.driverName : 'N/A'}
                  </div>
                  <p className="text-xs text-slate-600 truncate">{fastest?.teamName || '—'}</p>
                </div>
                <div className="text-[11px] font-mono text-purple-900 bg-white p-2 rounded-lg border border-purple-100 flex items-center justify-between">
                  <span>{result.fastestLapFormatted || fastest?.bestLapFormatted || '—'}</span>
                  <Badge className="bg-purple-600 text-white text-[9px] px-1 py-0">
                    Volta {result.fastestLapNumber || '—'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Pódio Oficial P1, P2, P3 Visual */}
            <div className="pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                Pódio Homologado FIA
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="podium-grid">
                {podiumEntries.map((pEntry, idx) => {
                  const place = idx + 1
                  const isP1 = place === 1
                  const isP2 = place === 2
                  const isP3 = place === 3

                  return (
                    <div
                      key={`podium_${pEntry.driverId}`}
                      className={`p-3.5 rounded-xl border flex items-center gap-3 transition-shadow ${
                        isP1
                          ? 'bg-amber-50/80 border-amber-300 shadow-xs'
                          : isP2
                            ? 'bg-slate-50/90 border-slate-300'
                            : 'bg-amber-900/5 border-amber-200'
                      }`}
                      data-testid={`podium-card-p${place}`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                          isP1
                            ? 'bg-amber-400 text-black'
                            : isP2
                              ? 'bg-slate-300 text-slate-800'
                              : 'bg-amber-600 text-white'
                        }`}
                      >
                        P{place}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-extrabold text-sm text-slate-900 truncate">
                          {pEntry.driverName}
                        </div>
                        <div className="text-xs text-slate-600 truncate">{pEntry.teamName}</div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black font-mono text-emerald-700">
                          +{pEntry.pointsAwarded} pts
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========================================================= */}
        {/* P3: 2. SEUS DOIS CARROS (CARDS GRANDES INDEPENDENTES)     */}
        {/* ========================================================= */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#E10600]" />
                Seus Dois Carros no GP
              </h2>
              <p className="text-xs text-slate-500">
                Histórias individuais e desempenho dos dois pilotos da sua equipe nesta prova.
              </p>
            </div>

            {/* P3: 3. Resumo secundário Pontos da Equipe neste GP */}
            <div
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-2 text-xs"
              data-testid="team-total-points-card"
            >
              <span className="text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                Pontos da Equipe neste GP:
              </span>
              <span className="font-black text-sm font-mono text-emerald-700">
                +{teamTotalPointsThisGP} pts
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playerCars.map((car, idx) => {
              const carSlotLabel = car.carSlot === 'car1' || idx === 0 ? 'Carro 1' : 'Carro 2'
              const delta = car.positionsGainedLost
              const cStats = careerRecords[car.driverId]?.stats

              // Badge especial: primeira conquista na carreira
              const isFirstWin = car.finalPosition === 1 && (cStats?.careerWins || 0) <= 1
              const isFirstPodium =
                car.finalPosition <= 3 && (cStats?.careerPodiums || 0) <= 1 && !isFirstWin
              const isFirstPole =
                result.poleDriverId === car.driverId && (cStats?.careerPoles || 0) <= 1
              const isFirstFL = car.fastestLap && (cStats?.careerFastestLaps || 0) <= 1

              return (
                <Card
                  key={`player_car_card_${car.driverId}`}
                  className="bg-white border border-slate-200/90 shadow-sm rounded-2xl overflow-hidden hover:border-slate-300 transition-all"
                  data-testid={`player-car-card-${idx + 1}`}
                >
                  <CardHeader className="py-3 px-5 bg-slate-50/80 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-[#E10600]">
                        {carSlotLabel}
                      </span>
                      {car.fastestLap && (
                        <Badge className="bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0">
                          VOLTA MAIS RÁPIDA
                        </Badge>
                      )}
                      {isFirstWin && (
                        <Badge className="bg-amber-500 text-black text-[9px] font-black px-1.5 py-0">
                          PRIMEIRA VITÓRIA!
                        </Badge>
                      )}
                      {isFirstPodium && (
                        <Badge className="bg-slate-300 text-slate-900 text-[9px] font-black px-1.5 py-0">
                          PRIMEIRO PÓDIO!
                        </Badge>
                      )}
                      {isFirstPole && (
                        <Badge className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0">
                          PRIMEIRA POLE!
                        </Badge>
                      )}
                      {isFirstFL && (
                        <Badge className="bg-purple-600 text-white text-[9px] font-black px-1.5 py-0">
                          PRIMEIRA VOLTA RÁPIDA!
                        </Badge>
                      )}
                    </div>

                    <span className="text-xs font-mono font-bold text-slate-500">
                      {car.teamName}
                    </span>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    {/* Linha superior: Piloto + Posição Final */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <DriverPhotoAvatar
                          name={car.driverName}
                          driverId={car.driverId}
                          teamColor={car.teamColor || '#E10600'}
                          size="lg"
                          className="border border-slate-200 shadow-xs"
                        />
                        <div>
                          <h4 className="text-base font-black text-slate-900">{car.driverName}</h4>
                          <p className="text-xs text-slate-500">
                            Largou em:{' '}
                            <strong className="text-slate-800">P{car.gridPosition}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`inline-flex items-center justify-center w-12 h-12 rounded-xl font-black text-lg shadow-xs ${
                            car.dnf
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : car.finalPosition === 1
                                ? 'bg-amber-400 text-black shadow'
                                : car.finalPosition <= 3
                                  ? 'bg-slate-200 text-slate-900'
                                  : car.finalPosition <= 10
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {car.dnf ? 'DNF' : `P${car.finalPosition}`}
                        </div>
                      </div>
                    </div>

                    {/* Variação de Posição e Pontos */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                          Variação no Grid
                        </span>
                        <span className="font-bold font-mono text-sm">
                          {delta > 0 ? (
                            <span className="text-emerald-600">↑ {delta} posições</span>
                          ) : delta < 0 ? (
                            <span className="text-red-500">↓ {Math.abs(delta)} posições</span>
                          ) : (
                            <span className="text-slate-500">— manteve posição</span>
                          )}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px] font-semibold uppercase">
                          Pontos Conquistados
                        </span>
                        <span className="font-mono text-sm font-black text-emerald-700">
                          {car.pointsAwarded > 0 ? `+${car.pointsAwarded} pts` : '0 pts'}
                        </span>
                      </div>
                    </div>

                    {/* Detalhes de Prova (Pit stops, melhor volta, status/motivo DNF) */}
                    <div className="text-xs space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Pit Stops:</span>
                        <strong className="text-slate-900 font-mono">
                          {car.pitStops} {car.pitStops === 1 ? 'parada' : 'paradas'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Melhor Volta:</span>
                        <strong className="text-slate-900 font-mono">
                          {car.bestLapFormatted || '—'}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Status de Chegada:</span>
                        {car.dnf ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            DNF: {car.dnfReason || 'Abandono'}
                            {car.dnfLap ? ` (Volta ${car.dnfLap})` : ''}
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                            Classificado ({car.lapsCompleted} voltas)
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Estatísticas Acumuladas de Carreira (P3 Requisito 2) */}
                    {cStats && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Carreira Acumulada (Histórico Completo)
                        </span>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-xs font-mono">
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-[9px] text-slate-500 block">GPs</span>
                            <strong className="text-slate-900">{cStats.careerGps || 0}</strong>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-[9px] text-slate-500 block">Vitórias</span>
                            <strong className="text-amber-600">{cStats.careerWins || 0}</strong>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-[9px] text-slate-500 block">Pódios</span>
                            <strong className="text-slate-800">{cStats.careerPodiums || 0}</strong>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-[9px] text-slate-500 block">Poles</span>
                            <strong className="text-slate-800">{cStats.careerPoles || 0}</strong>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-[9px] text-purple-600 block">V. Rápidas</span>
                            <strong className="text-purple-700">
                              {cStats.careerFastestLaps || 0}
                            </strong>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100">
                            <span className="text-[9px] text-emerald-600 block">Pontos</span>
                            <strong className="text-emerald-700">{cStats.careerPoints || 0}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* P4: 6 & 7. IMPACTO NO CAMPEONATO (SNAPSHOTS N-1 VS N)     */}
        {/* ========================================================= */}
        <Card
          className="bg-white border border-slate-200/90 shadow-sm rounded-2xl overflow-hidden"
          data-testid="championship-impact-panel"
        >
          <CardHeader className="py-4 px-6 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#E10600]" />
                Impacto no Campeonato
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparação oficial do estado da tabela antes (N-1) e após este Grande Prêmio (N).
              </p>
            </div>

            {/* Badges de Novo Líder (P4 Requisito 7) */}
            <div className="flex flex-wrap items-center gap-2">
              {leaderDriverChange && (
                <Badge
                  className="bg-amber-500 text-black font-black text-xs px-3 py-1 animate-pulse"
                  data-testid="badge-new-driver-leader"
                >
                  👑 NOVO LÍDER DO CAMPEONATO: {leaderDriverChange.newLeader}
                </Badge>
              )}
              {leaderConstructorChange && (
                <Badge
                  className="bg-slate-900 text-white font-black text-xs px-3 py-1"
                  data-testid="badge-new-constructor-leader"
                >
                  🛡️ NOVO LÍDER DOS CONSTRUTORES: {leaderConstructorChange.newLeader}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Piloto 1 no Campeonato */}
              {playerCars[0] &&
                (() => {
                  const p1Id = playerCars[0].driverId
                  const currStanding = championshipCurrent?.driverStandings.find(
                    (d) => d.driverId === p1Id,
                  )
                  const prevStanding = championshipPrevious?.driverStandings.find(
                    (d) => d.driverId === p1Id,
                  )

                  const prevPos = prevStanding?.position
                  const currPos = currStanding?.position
                  const deltaPos =
                    prevPos && currPos ? prevPos - currPos : currStanding?.positionDelta || 0

                  return (
                    <div
                      className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3"
                      data-testid="driver1-championship-card"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Piloto 1 • Campeonato
                        </span>
                        {deltaPos > 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-black">
                            ↑ {deltaPos} pos
                          </Badge>
                        ) : deltaPos < 0 ? (
                          <Badge className="bg-red-100 text-red-800 text-[10px] font-black">
                            ↓ {Math.abs(deltaPos)} pos
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold text-slate-500">
                            = manteve
                          </Badge>
                        )}
                      </div>

                      <div>
                        <h4 className="text-base font-black text-slate-900">
                          {playerCars[0].driverName}
                        </h4>
                        <p className="text-xs font-mono text-slate-500">
                          Gap para o líder:{' '}
                          <strong className="text-slate-800">
                            {currStanding?.gapToLeader || '—'}
                          </strong>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-sans">
                            Antes (R{result.round - 1})
                          </span>
                          <strong className="text-slate-700">
                            {prevStanding
                              ? `P${prevStanding.position} • ${prevStanding.points} pts`
                              : '—'}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-sans">
                            Depois (R{result.round})
                          </span>
                          <strong className="text-emerald-700">
                            {currStanding
                              ? `P${currStanding.position} • ${currStanding.points} pts`
                              : '—'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )
                })()}

              {/* Piloto 2 no Campeonato */}
              {playerCars[1] &&
                (() => {
                  const p2Id = playerCars[1].driverId
                  const currStanding = championshipCurrent?.driverStandings.find(
                    (d) => d.driverId === p2Id,
                  )
                  const prevStanding = championshipPrevious?.driverStandings.find(
                    (d) => d.driverId === p2Id,
                  )

                  const prevPos = prevStanding?.position
                  const currPos = currStanding?.position
                  const deltaPos =
                    prevPos && currPos ? prevPos - currPos : currStanding?.positionDelta || 0

                  return (
                    <div
                      className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3"
                      data-testid="driver2-championship-card"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Piloto 2 • Campeonato
                        </span>
                        {deltaPos > 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-black">
                            ↑ {deltaPos} pos
                          </Badge>
                        ) : deltaPos < 0 ? (
                          <Badge className="bg-red-100 text-red-800 text-[10px] font-black">
                            ↓ {Math.abs(deltaPos)} pos
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold text-slate-500">
                            = manteve
                          </Badge>
                        )}
                      </div>

                      <div>
                        <h4 className="text-base font-black text-slate-900">
                          {playerCars[1].driverName}
                        </h4>
                        <p className="text-xs font-mono text-slate-500">
                          Gap para o líder:{' '}
                          <strong className="text-slate-800">
                            {currStanding?.gapToLeader || '—'}
                          </strong>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-sans">
                            Antes (R{result.round - 1})
                          </span>
                          <strong className="text-slate-700">
                            {prevStanding
                              ? `P${prevStanding.position} • ${prevStanding.points} pts`
                              : '—'}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-sans">
                            Depois (R{result.round})
                          </span>
                          <strong className="text-emerald-700">
                            {currStanding
                              ? `P${currStanding.position} • ${currStanding.points} pts`
                              : '—'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )
                })()}

              {/* Equipe / Construtores */}
              {(() => {
                const teamKey = result.playerTeamId
                const currTeam = championshipCurrent?.constructorStandings.find(
                  (c) => c.teamId === teamKey || c.isPlayer,
                )
                const prevTeam = championshipPrevious?.constructorStandings.find(
                  (c) => c.teamId === teamKey || c.isPlayer,
                )

                const prevPos = prevTeam?.position
                const currPos = currTeam?.position
                const deltaPos =
                  prevPos && currPos ? prevPos - currPos : currTeam?.positionDelta || 0

                return (
                  <div
                    className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3"
                    data-testid="team-championship-card"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Sua Equipe • Construtores
                      </span>
                      {deltaPos > 0 ? (
                        <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          ↑ {deltaPos} pos
                        </Badge>
                      ) : deltaPos < 0 ? (
                        <Badge className="bg-red-100 text-red-800 text-[10px] font-black">
                          ↓ {Math.abs(deltaPos)} pos
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-bold text-slate-500">
                          = manteve
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h4 className="text-base font-black text-slate-900 truncate">
                        {currTeam?.teamName || playerCars[0]?.teamName || result.playerTeamId}
                      </h4>
                      <p className="text-xs font-mono text-slate-500">
                        Gap para o líder:{' '}
                        <strong className="text-slate-800">{currTeam?.gapToLeader || '—'}</strong>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-sans">
                          Antes (R{result.round - 1})
                        </span>
                        <strong className="text-slate-700">
                          {prevTeam ? `P${prevTeam.position} • ${prevTeam.points} pts` : '—'}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-sans">
                          Depois (R{result.round})
                        </span>
                        <strong className="text-emerald-700">
                          {currTeam ? `P${currTeam.position} • ${currTeam.points} pts` : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </CardContent>
        </Card>

        {/* ========================================================= */}
        {/* P3: 4. MOMENTOS DA PROVA (CONSUMIR eventsSummary REAL)     */}
        {/* ========================================================= */}
        {result.eventsSummary && (
          <Card
            className="bg-white border border-slate-200/90 shadow-sm rounded-2xl overflow-hidden"
            data-testid="race-moments-card"
          >
            <CardHeader className="py-3.5 px-6 bg-slate-50/70 border-b border-slate-100">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#E10600]" />
                Momentos da Prova
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-sans block">Safety Car</span>
                  <strong className="text-slate-800 text-sm">
                    {result.eventsSummary.safetyCarPeriods} período
                    {result.eventsSummary.safetyCarPeriods === 1 ? '' : 's'} (
                    {result.eventsSummary.safetyCarLaps} voltas)
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-sans block">VSC</span>
                  <strong className="text-slate-800 text-sm">
                    {result.eventsSummary.vscPeriods} período
                    {result.eventsSummary.vscPeriods === 1 ? '' : 's'}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-sans block">
                    Bandeira Vermelha
                  </span>
                  <strong className="text-slate-800 text-sm">
                    {result.eventsSummary.redFlagPeriods} interrupç
                    {result.eventsSummary.redFlagPeriods === 1 ? 'ão' : 'ões'}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-sans block">
                    Abandonos (DNF)
                  </span>
                  <strong className="text-red-600 text-sm">
                    {result.eventsSummary.dnfCount} piloto
                    {result.eventsSummary.dnfCount === 1 ? '' : 's'}
                  </strong>
                </div>
              </div>

              {result.eventsSummary.significantIncidents &&
                result.eventsSummary.significantIncidents.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Incidentes Relevantes Homologados
                    </span>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {result.eventsSummary.significantIncidents.map((inc, iIdx) => (
                        <div
                          key={`incident_${iIdx}`}
                          className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={inc.type === 'dnf' ? 'destructive' : 'secondary'}
                              className="text-[9px] uppercase font-mono px-1.5 py-0"
                            >
                              Volta {inc.lap}
                            </Badge>
                            <span className="text-slate-700">{inc.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        )}

        {/* ========================================================= */}
        {/* P3: 5. CLASSIFICAÇÃO COMPLETA P1–P24 (SEÇÃO EXPANSÍVEL)  */}
        {/* ========================================================= */}
        <Card
          className="bg-white border border-slate-200/90 shadow-sm rounded-2xl overflow-hidden"
          data-testid="complete-classification-card"
        >
          <CardHeader
            className="py-3.5 px-6 bg-slate-50/80 border-b border-slate-100 flex flex-row items-center justify-between cursor-pointer select-none"
            onClick={() => setTableExpanded(!tableExpanded)}
          >
            <div>
              <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Classificação Completa Homologada (P1–P24)
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Clique para {tableExpanded ? 'recolher' : 'expandir'} a tabela técnica oficial.
              </p>
            </div>

            <button
              type="button"
              className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-600 transition-colors"
              aria-label={tableExpanded ? 'Recolher tabela' : 'Expandir tabela'}
            >
              {tableExpanded ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </CardHeader>

          {tableExpanded && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wider bg-slate-50/60 text-[10px]">
                      <th className="py-2.5 px-3 w-12 text-center">Pos</th>
                      <th className="py-2.5 px-3">Piloto</th>
                      <th className="py-2.5 px-3">Equipe</th>
                      <th className="py-2.5 px-3 text-center w-12">Grid</th>
                      <th className="py-2.5 px-3 text-center w-12">Δ Pos</th>
                      <th className="py-2.5 px-3 text-center">Pits</th>
                      <th className="py-2.5 px-3 text-center">Melhor Volta</th>
                      <th className="py-2.5 px-3 text-center">Tempo / Gap</th>
                      <th className="py-2.5 px-3 text-center">Pontos FIA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.entries.map((entry) => {
                      const logoUrl = getTeamReducedLogoUrl(entry.teamName || entry.teamId)
                      const delta = entry.positionsGainedLost
                      const isP1 = entry.finalPosition === 1
                      const isPlayer = entry.isPlayer

                      return (
                        <tr
                          key={`table_entry_${entry.driverId}`}
                          className={`transition-colors ${
                            entry.dnf
                              ? 'bg-slate-50/60 text-slate-400 opacity-75'
                              : isPlayer
                                ? 'bg-red-50/70 hover:bg-red-50 font-bold border-l-4 border-l-[#E10600]'
                                : isP1
                                  ? 'bg-amber-50/50 hover:bg-amber-50'
                                  : 'hover:bg-slate-50/80 text-slate-900'
                          }`}
                          data-testid={`table-row-pos-${entry.finalPosition}`}
                        >
                          {/* Posição */}
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-[11px] ${
                                entry.dnf
                                  ? 'bg-slate-200 text-slate-600'
                                  : isP1
                                    ? 'bg-amber-400 text-black shadow-xs font-black'
                                    : entry.finalPosition <= 3
                                      ? 'bg-slate-200 text-slate-800'
                                      : entry.finalPosition <= 10
                                        ? 'bg-slate-100 text-slate-700'
                                        : 'bg-transparent text-slate-500'
                              }`}
                            >
                              P{entry.finalPosition}
                            </span>
                          </td>

                          {/* Piloto */}
                          <td className="py-2 px-3 font-sans">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={
                                  isPlayer
                                    ? 'text-slate-900 font-extrabold'
                                    : 'text-slate-800 font-medium'
                                }
                              >
                                {entry.driverName}
                              </span>
                              {entry.fastestLap && (
                                <Badge className="bg-purple-600 text-white font-mono text-[9px] px-1 py-0 h-3.5">
                                  FL
                                </Badge>
                              )}
                              {isPlayer && (
                                <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 h-3.5 uppercase font-black">
                                  Sua Equipe
                                </Badge>
                              )}
                            </div>
                          </td>

                          {/* Equipe com Logo Reduzido */}
                          <td className="py-2 px-3 font-sans">
                            <div className="flex items-center gap-1.5">
                              {logoUrl ? (
                                <img
                                  src={logoUrl}
                                  alt={entry.teamName}
                                  className="w-4 h-4 object-contain shrink-0"
                                />
                              ) : (
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: entry.teamColor || '#94A3B8' }}
                                />
                              )}
                              <span className="truncate max-w-[120px] text-xs text-slate-700">
                                {entry.teamName}
                              </span>
                            </div>
                          </td>

                          {/* Grid */}
                          <td className="py-2 px-3 text-center text-slate-500 text-[11px]">
                            P{entry.gridPosition}
                          </td>

                          {/* Delta Pos */}
                          <td className="py-2 px-3 text-center font-bold text-[11px]">
                            {delta > 0 ? (
                              <span className="text-emerald-600">+{delta}</span>
                            ) : delta < 0 ? (
                              <span className="text-red-500">{delta}</span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>

                          {/* Pits */}
                          <td className="py-2 px-3 text-center text-slate-700">{entry.pitStops}</td>

                          {/* Melhor Volta */}
                          <td className="py-2 px-3 text-center text-slate-600 text-[11px]">
                            {entry.bestLapFormatted || '—'}
                          </td>

                          {/* Tempo / Gap */}
                          <td className="py-2 px-3 text-center">
                            {entry.dnf ? (
                              <span className="text-red-500 font-bold text-[10px]">
                                DNF ({entry.dnfReason || 'Abandono'})
                              </span>
                            ) : entry.finalPosition === 1 ? (
                              <span className="text-amber-700 font-black">
                                {entry.raceTimeFormatted || '1h 28m 34s'}
                              </span>
                            ) : (
                              <span className="text-slate-600">{entry.gapToWinner}</span>
                            )}
                          </td>

                          {/* Pontos FIA */}
                          <td className="py-2 px-3 text-center font-bold">
                            {entry.pointsAwarded > 0 ? (
                              <span className="text-emerald-700 font-black">
                                +{entry.pointsAwarded}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ========================================================= */}
        {/* NAVEGAÇÃO & PRÓXIMO EVENTO (P3/P4 Requisito 9)            */}
        {/* ========================================================= */}
        <Card
          className="bg-slate-900 text-white border border-slate-800 shadow-lg rounded-2xl overflow-hidden"
          data-testid="post-race-navigation-bar"
        >
          <CardContent className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Próximo Evento Canônico do Calendário
              </span>
              {nextEvent ? (
                <div className="space-y-0.5" data-testid="next-event-info">
                  <div className="font-black text-base text-white">
                    {nextEvent.name} — Rodada {nextEvent.round}
                  </div>
                  <div className="text-xs text-slate-400">
                    {nextEvent.circuit} • {nextEvent.country} • {nextEvent.laps} voltas
                  </div>
                </div>
              ) : (
                <div className="text-sm font-bold text-slate-300">
                  Fim de Temporada • Todas as 24 rodadas concluídas.
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {onViewChampionship && (
                <button
                  type="button"
                  onClick={onViewChampionship}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-2 transition-colors shadow-xs"
                  data-testid="view-championship-btn"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  VER CAMPEONATO
                </button>
              )}

              {onContinue && (
                <button
                  type="button"
                  disabled={continueClicked || isContinuing}
                  onClick={handleContinueClick}
                  className="px-5 py-2.5 rounded-xl bg-[#E10600] hover:bg-red-600 text-white text-xs font-black flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                  data-testid="continue-to-next-round-btn"
                >
                  {continueClicked || isContinuing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      PROCESSANDO...
                    </>
                  ) : (
                    <>
                      <span>CONTINUAR</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

export default OfficialRaceResultPanel
