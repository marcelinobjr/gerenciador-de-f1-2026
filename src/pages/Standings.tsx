import React, { useState, useMemo, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { DriverStanding, TeamStanding } from '@/services/standingsService'
import { Calendar, Compass, Trophy, Users, Shield, Scale, Award, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { TeamCrest } from '@/components/ui/TeamCrest'
import { CountryFlag } from '@/components/CountryFlag'
import { PilotProfileDialog } from '@/components/PilotProfileDialog'
import { TeamInstitutionalDetailsModal } from '@/components/team/TeamInstitutionalDetailsModal'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { canonicalChampionshipMigrationService } from '@/services/canonicalChampionshipMigrationService'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'
import { getActiveDriverTeamBinding } from '@/lib/canonical-driver-database'
import heroHorizontalAsset from '@/assets/chatgpt-image-10-de-set.de-2026-122312-fc092.png'

export type { DriverStanding, TeamStanding }

export default function StandingsPage() {
  const {
    team,
    season,
    driverStandings,
    constructorStandings,
    playerDrivers,
    loading,
    currentRound,
    totalRounds,
  } = useUnifiedSeason()

  const [activeTab, setActiveTab] = useState<'drivers' | 'constructors' | 'archive'>('drivers')
  const [archivedSeasons, setArchivedSeasons] = useState<any[]>([])
  const [selectedArchiveYear, setSelectedArchiveYear] = useState<number>(2026)

  useEffect(() => {
    async function loadHistories() {
      try {
        const records = await pb
          .collection('season_histories')
          .getFullList({ sort: '-season_year' })
        setArchivedSeasons(records || [])
        if (records && records.length > 0) {
          setSelectedArchiveYear(records[0].season_year || 2026)
        }
      } catch (e) {
        console.warn('Erro ao carregar season_histories:', e)
      }
    }
    loadHistories()
  }, [])

  // Modais canônicos de interação ao clicar na linha
  const [selectedPilotForModal, setSelectedPilotForModal] = useState<any | null>(null)
  const [pilotModalOpen, setPilotModalOpen] = useState(false)

  const [selectedTeamForModal, setSelectedTeamForModal] = useState<any | null>(null)
  const [teamModalOpen, setTeamModalOpen] = useState(false)

  const seasonYear = season?.year || 2026
  const safeTotalRounds = totalRounds || 24
  const safeCurrentRound = Math.min(safeTotalRounds, Math.max(1, currentRound || 1))

  // Obter snapshot mais recente para checar último GP oficializado via helper canônico
  const careerId = resolveCanonicalCareerId(season, team)

  // Estado local para suportar carregamento assíncrono autoritativo do PocketBase
  const [asyncSnapshot, setAsyncSnapshot] = useState<any | null>(null)

  // Reconciliação transparente de resultados legados caso existam rodadas salvas sob team.id
  React.useEffect(() => {
    if (team?.id && careerId && team.id !== careerId) {
      try {
        canonicalChampionshipMigrationService.reconcileLegacyCareerResults({
          canonicalCareerId: careerId,
          legacyCareerIds: [team.id],
          seasonYear,
        })
      } catch {
        /* intentionally ignored */
      }
    }
  }, [careerId, team?.id, seasonYear])
  // Consulta autoritativa remota do PocketBase para garantir que os pontos sejam exibidos
  // mesmo após reload de página ou falta de snapshot no localStorage
  React.useEffect(() => {
    let isMounted = true
    if (!careerId) return

    canonicalChampionshipService
      .getChampionshipStandingsAsync(careerId, seasonYear, undefined, team?.id || team?.team_key)
      .then((remoteSnap) => {
        if (isMounted && remoteSnap && remoteSnap.throughRound > 0) {
          setAsyncSnapshot(remoteSnap)
        }
      })
      .catch((err) => {
        console.warn('[StandingsPage] Erro ao carregar standings autoritativos do backend:', err)
      })

    return () => {
      isMounted = false
    }
  }, [careerId, seasonYear, team?.id, team?.team_key, driverStandings])

  const championshipSnapshot = useMemo(() => {
    // Se temos snapshot assíncrono do backend com rodadas processadas e pontos, tem precedência absoluta
    if (asyncSnapshot && asyncSnapshot.throughRound > 0) {
      return asyncSnapshot
    }
    const syncSnap = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      seasonYear,
      undefined,
      team?.id || team?.team_key,
    )
    if (
      syncSnap &&
      syncSnap.throughRound > 0 &&
      syncSnap.driverStandings?.some((d) => d.points > 0)
    ) {
      return syncSnap
    }
    return asyncSnapshot || syncSnap
  }, [careerId, seasonYear, team?.id, team?.team_key, driverStandings, asyncSnapshot])

  const throughRound = championshipSnapshot?.throughRound || 0

  // Snapshot canônico oficial como única fonte da classificação
  const effectiveDriverStandings = useMemo<DriverStanding[]>(() => {
    if (championshipSnapshot && championshipSnapshot.driverStandings.length > 0) {
      return championshipSnapshot.driverStandings.map((d) => {
        const binding = getActiveDriverTeamBinding(d.driverId)
        const teamName =
          binding?.isContracted && binding?.teamName
            ? binding.teamName
            : d.currentTeamName || 'Sem Equipe'
        const teamColor =
          (binding?.isContracted && binding?.teamColor) || d.currentTeamColor || '#71717A'

        return {
          id: d.driverId,
          name: d.driverName,
          nationality: d.nationality,
          flag: d.flag,
          teamName,
          teamColor,
          points: d.points,
          wins: d.wins,
          podiums: d.podiums,
          bestPosition: d.position,
          isPlayer: !!d.isPlayer,
          secondPlaces: d.secondPlaces,
          thirdPlaces: d.thirdPlaces,
          fourthPlaces: d.fourthPlaces,
          raceStarts: d.raceStarts,
          racesCounted: d.racesCounted,
          finishCounts: d.finishCounts,
          gapToLeader: d.gapToLeader,
          positionDelta: d.positionDelta,
          positionDeltaText: d.positionDeltaText,
        }
      })
    }
    if (!driverStandings || driverStandings.length === 0) return []
    return driverStandings.map((d) => {
      const binding = getActiveDriverTeamBinding(d.id || d.name)
      const teamName = binding?.isContracted && binding?.teamName ? binding.teamName : 'Sem Equipe'
      const teamColor = (binding?.isContracted && binding?.teamColor) || '#71717A'
      return {
        ...d,
        teamName,
        teamColor,
      }
    })
  }, [championshipSnapshot, driverStandings])

  const effectiveConstructorStandings = useMemo<TeamStanding[]>(() => {
    if (championshipSnapshot && championshipSnapshot.constructorStandings.length > 0) {
      return championshipSnapshot.constructorStandings.map((c) => ({
        id: c.teamId,
        name: c.teamName,
        color: c.teamColor,
        engine: 'F1 Power Unit',
        points: c.points,
        wins: c.wins,
        podiums: c.podiums,
        bestPosition: c.position,
        isPlayer: !!c.isPlayer,
        racesCounted: c.racesCounted,
        finishCounts: c.finishCounts,
        gapToLeader: c.gapToLeader,
        positionDelta: c.positionDelta,
        positionDeltaText: c.positionDeltaText,
      }))
    }
    return constructorStandings || []
  }, [championshipSnapshot, constructorStandings])

  const lastRecordedGp = useMemo(() => {
    if (throughRound <= 0) return null
    return F1_2026_CALENDAR.find((c) => c.round === throughRound) || null
  }, [throughRound])

  // Detalhes do circuito atual a partir do calendário canônico
  const currentGp = useMemo(() => {
    return F1_2026_CALENDAR.find((c) => c.round === safeCurrentRound) || F1_2026_CALENDAR[0]
  }, [safeCurrentRound])

  // Máximo de pontos para calcular as barras relativas ao líder (líder = 100%)
  const maxDriverPoints = useMemo(() => {
    if (!effectiveDriverStandings || effectiveDriverStandings.length === 0) return 1
    return Math.max(1, effectiveDriverStandings[0]?.points || 1)
  }, [effectiveDriverStandings])

  const maxConstructorPoints = useMemo(() => {
    if (!effectiveConstructorStandings || effectiveConstructorStandings.length === 0) return 1
    return Math.max(1, effectiveConstructorStandings[0]?.points || 1)
  }, [effectiveConstructorStandings])

  // Handler para abrir perfil de piloto existente
  const handleDriverClick = (driver: DriverStanding) => {
    // Tenta casar com dados completos de playerDrivers se for do jogador
    const fullPlayer = playerDrivers?.find((p) => p.id === driver.id || p.name === driver.name)
    const pilotItem: any = fullPlayer
      ? {
          ...fullPlayer,
          isPlayerDriver: true,
          f1RacesCompleted: 24,
          speed: fullPlayer.speed || 84,
          consistency: fullPlayer.consistency || 82,
          defense: fullPlayer.defense || 80,
          rain: fullPlayer.rain || 82,
        }
      : {
          id: driver.id,
          name: driver.name,
          nationality: driver.nationality,
          category: 'f1',
          teamName: driver.teamName,
          isPlayerDriver: driver.isPlayer,
          f1RacesCompleted: 24,
          speed: 84,
          consistency: 82,
          defense: 80,
          rain: 82,
        }

    setSelectedPilotForModal(pilotItem)
    setPilotModalOpen(true)
  }

  // Handler para abrir modal institucional de equipe
  const handleTeamClick = (cTeam: TeamStanding) => {
    setSelectedTeamForModal(cTeam)
    setTeamModalOpen(true)
  }

  return (
    <div className="space-y-6 pb-16 antialiased text-[#0F172A] select-none">
      {/* ======================================================== */}
      {/* 1. CABEÇALHO DA PÁGINA COM SELETOR [PILOTOS] [CONSTRUTORES] */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0F172A] flex items-center gap-2">
            <span>CAMPEONATO</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-100 text-[#475569] border border-neutral-200">
              OFICIAL FIA
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            Classificação oficial da temporada, com pontos, vitórias e pódios ao longo das{' '}
            {safeTotalRounds} etapas.
          </p>
        </div>

        {/* Seletor PILOTOS / CONSTRUTORES / RESULTADOS */}
        <div className="inline-flex items-center p-1 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] self-start sm:self-auto shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('drivers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'drivers'
                ? 'bg-[#E10600] text-white shadow-sm'
                : 'bg-transparent text-[#0F172A] hover:bg-white/70'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="tracking-wide uppercase">PILOTOS</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('constructors')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'constructors'
                ? 'bg-[#E10600] text-white shadow-sm'
                : 'bg-transparent text-[#0F172A] hover:bg-white/70'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span className="tracking-wide uppercase">CONSTRUTORES</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archive')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'archive'
                ? 'bg-[#E10600] text-white shadow-sm'
                : 'bg-transparent text-[#0F172A] hover:bg-white/70'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span className="tracking-wide uppercase">CAMPEONATOS ANTERIORES</span>
          </button>{' '}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. HERO HORIZONTAL COM DESIGN AUTOMOBILÍSTICO PREMIUM     */}
      {/* ======================================================== */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white shadow-md border border-[#CBD5E1]">
        {/* Background cinematográfico de automobilismo */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity"
          style={{ backgroundImage: `url(${heroHorizontalAsset})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0E17] via-[#0A0E17]/85 to-transparent" />

        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Lado Esquerdo: Título & Subtítulo */}
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-[#E10600] uppercase font-mono">
                FÓRMULA 1
              </span>
              <span className="text-white/30">•</span>
              <span className="text-[11px] font-mono text-neutral-300">TEMPORADA {seasonYear}</span>
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tight text-white">
              {activeTab === 'drivers'
                ? `Campeonato Mundial de Pilotos ${seasonYear}`
                : activeTab === 'constructors'
                  ? `Campeonato Mundial de Construtores ${seasonYear}`
                  : `Campeonatos Anteriores (Histórico Oficial)`}
            </h2>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
              {activeTab === 'drivers'
                ? 'Os melhores do mundo. Uma só coroa.'
                : activeTab === 'constructors'
                  ? 'Engenharia, pessoas e performance. Uma temporada para definir o melhor conjunto.'
                  : 'Consulte a classificação final de pilotos e construtores de cada temporada concluída (fonte: season_histories).'}
            </p>
          </div>

          {/* Extremo Direito: Pequena barra diagonal vermelha + Texto institucional */}
          <div className="hidden lg:flex items-center gap-4 pl-6 border-l border-white/10 shrink-0">
            {/* Barra diagonal vermelha */}
            <div className="w-1.5 h-12 bg-[#E10600] rounded-full transform -rotate-12 shadow-sm" />

            <div className="flex flex-col text-[10px] font-mono font-black italic tracking-widest text-neutral-300 uppercase leading-snug">
              <span className="text-white">VELOCIDADE</span>
              <span className="text-[#E10600]">ESTRATÉGIA</span>
              <span className="text-neutral-300">RESULTADOS</span>
              <span className="text-neutral-400">HISTÓRIA</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. FAIXA DE INFORMAÇÕES (4 BLOCOS HORIZONTAIS BRANCOS)    */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Bloco 1: Temporada */}
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-[#E10600] flex items-center justify-center shrink-0 border border-red-100">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono font-bold uppercase text-[#64748B] block truncate">
              Temporada Oficial
            </span>
            <div className="text-sm font-black text-[#0F172A] truncate">Ano {seasonYear}</div>
            <span className="text-[11px] text-[#475569] font-medium block">
              {safeTotalRounds} etapas programadas
            </span>
          </div>
        </div>

        {/* Bloco 2: Rodada Atual e GP */}
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-100">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono font-bold uppercase text-[#64748B] block truncate">
              {throughRound > 0 ? `Atualizado após GP ${throughRound}` : 'Etapa em Disputa'}
            </span>
            <div className="text-sm font-black text-[#0F172A] truncate">
              {throughRound > 0
                ? `Rodada ${throughRound} de ${safeTotalRounds}`
                : `Rodada ${safeCurrentRound} de ${safeTotalRounds}`}
            </div>
            <span
              className="text-[11px] text-[#475569] font-medium block truncate"
              title={lastRecordedGp ? lastRecordedGp.name : currentGp.name}
            >
              {lastRecordedGp
                ? `${lastRecordedGp.flag} ${lastRecordedGp.name.replace('Grande Prêmio d', 'GP d')}`
                : 'Aguardando primeiro resultado oficial'}
            </span>
          </div>
        </div>

        {/* Bloco 3: Sistema de Pontuação FIA */}
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono font-bold uppercase text-[#64748B] block truncate">
              Sistema de Pontuação
            </span>
            <div className="text-sm font-black text-[#0F172A] truncate">Regulamento FIA</div>
            <span className="text-[11px] text-[#475569] font-mono font-semibold block truncate">
              25-18-15-12-10-8-6-4-2-1
            </span>
          </div>
        </div>

        {/* Bloco 4: Inscritos na Temporada */}
        <div className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            {activeTab === 'drivers' ? (
              <Users className="w-5 h-5" />
            ) : (
              <Shield className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono font-bold uppercase text-[#64748B] block truncate">
              {activeTab === 'drivers' ? 'Grid de Pilotos' : 'Grid de Construtores'}
            </span>
            <div className="text-sm font-black text-[#0F172A] truncate">
              {activeTab === 'drivers'
                ? `${effectiveDriverStandings.length} Pilotos Registrados`
                : activeTab === 'constructors'
                  ? `${effectiveConstructorStandings.length} Construtores`
                  : `${archivedSeasons.length || 1} Temporadas Arquivadas`}
            </div>
            <span className="text-[11px] text-[#475569] font-medium block truncate">
              {activeTab === 'drivers'
                ? `${effectiveConstructorStandings.length} equipes participantes`
                : activeTab === 'constructors'
                  ? `${effectiveDriverStandings.length} pilotos titulares no grid`
                  : 'Registro histórico perpétuo FIA'}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. TABELAS DE CLASSIFICAÇÃO (PILOTOS OU CONSTRUTORES)     */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        {/* Título da subseção */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#E10600]" />
            <h3 className="text-xs sm:text-sm font-black tracking-tight text-[#0F172A] uppercase">
              {activeTab === 'drivers'
                ? `CLASSIFICAÇÃO DE PILOTOS • TEMPORADA ${seasonYear}`
                : activeTab === 'constructors'
                  ? `CLASSIFICAÇÃO DE CONSTRUTORES • TEMPORADA ${seasonYear}`
                  : `ARQUIVO OFICIAL FIA • TEMPORADA ${selectedArchiveYear}`}
            </h3>
          </div>
          <span className="text-[11px] font-mono font-bold text-[#64748B]">
            {activeTab === 'drivers'
              ? `${effectiveDriverStandings.length} pilotos inscritos`
              : activeTab === 'constructors'
                ? `${effectiveConstructorStandings.length} construtores ativos`
                : 'Homologação oficial concluída'}
          </span>
        </div>

        {/* Conteúdo com carregamento ou dados */}
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-11 w-full bg-neutral-100" />
            ))}
          </div>
        ) : activeTab === 'drivers' ? (
          effectiveDriverStandings.length === 0 ? (
            <div className="p-12 text-center">
              <EmptyState
                icon={Award}
                title="Sem pontuação registrada ainda"
                description={`A tabela de pilotos será preenchida automaticamente após a conclusão das sessões de corrida da temporada ${seasonYear}.`}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#FAFAFA] text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                    <th className="py-3 px-4 text-center w-16">POS</th>
                    <th className="py-3 px-4">PILOTO</th>
                    <th className="py-3 px-4">EQUIPE ATUAL</th>
                    <th className="py-3 px-4 text-center w-24">VITÓRIAS</th>
                    <th className="py-3 px-4 text-center w-24">PÓDIOS</th>
                    <th className="py-3 px-4 text-right w-64">PONTOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-xs">
                  {effectiveDriverStandings.map((driver, index) => {
                    const pos = index + 1
                    const leaderPts = effectiveDriverStandings[0]?.points || 0
                    const gap = pos === 1 ? 'LÍDER' : `-${leaderPts - driver.points} pts`
                    const ratio =
                      maxDriverPoints > 0
                        ? Math.max(
                            0,
                            Math.min(100, Math.round((driver.points / maxDriverPoints) * 100)),
                          )
                        : 0

                    return (
                      <tr
                        key={driver.id}
                        onClick={() => handleDriverClick(driver)}
                        className={`transition-colors cursor-pointer group ${
                          driver.isPlayer
                            ? 'bg-red-50/40 hover:bg-red-50/70'
                            : 'hover:bg-neutral-50'
                        }`}
                      >
                        {/* POS: Círculo estilizado (1º dourado, 2º prata, 3º bronze, demais neutro) + variação N vs N-1 */}
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-mono font-black text-[11px] shadow-2xs ${
                                pos === 1
                                  ? 'bg-amber-400 text-amber-950 ring-1 ring-amber-500/50'
                                  : pos === 2
                                    ? 'bg-slate-300 text-slate-900 ring-1 ring-slate-400/50'
                                    : pos === 3
                                      ? 'bg-amber-700 text-white ring-1 ring-amber-800/50'
                                      : 'bg-neutral-100 text-[#64748B]'
                              }`}
                            >
                              {pos}
                            </span>
                            {driver.positionDeltaText && driver.positionDeltaText !== '—' && (
                              <span
                                className={`text-[10px] font-mono font-bold ${
                                  driver.positionDeltaText.startsWith('↑')
                                    ? 'text-emerald-600'
                                    : 'text-rose-600'
                                }`}
                              >
                                {driver.positionDeltaText}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* PILOTO: Bandeira + Nome completo + Badge Sua Equipe se jogador */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <CountryFlag
                              code={driver.nationality}
                              className="text-base select-none shrink-0"
                            />
                            <span
                              className={`truncate tracking-tight ${
                                driver.isPlayer
                                  ? 'font-black text-[#0F172A] text-xs sm:text-sm'
                                  : 'font-semibold text-[#0F172A]'
                              }`}
                            >
                              {driver.name}
                            </span>
                            {driver.isPlayer && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-[#E10600] text-white">
                                SUA EQUIPE
                              </span>
                            )}
                            {(driver.totalPenaltiesSec || 0) > 0 && (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-300 text-[9px] px-1.5 py-0 h-4 font-mono font-bold flex items-center gap-0.5"
                                title={`Penalidades acumuladas: +${driver.totalPenaltiesSec}s (${driver.penaltiesCount || 1} infrações)`}
                              >
                                <Scale className="w-2.5 h-2.5" />+{driver.totalPenaltiesSec}s
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* ESCUDERIA: Logo reduzida oficial (20-28px) + Nome */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <TeamCrest
                              team={driver.teamName}
                              teamName={driver.teamName}
                              size="md"
                            />
                            <span className="truncate font-medium text-xs text-[#334155]">
                              {driver.teamName}
                            </span>
                          </div>
                        </td>

                        {/* VITÓRIAS */}
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`font-mono font-bold ${
                              driver.wins > 0 ? 'text-[#0F172A]' : 'text-[#94A3B8]'
                            }`}
                          >
                            {driver.wins}
                          </span>
                        </td>

                        {/* PÓDIOS */}
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`font-mono font-bold ${
                              driver.podiums > 0 ? 'text-[#0F172A]' : 'text-[#94A3B8]'
                            }`}
                          >
                            {driver.podiums}
                          </span>
                        </td>

                        {/* PONTOS: Barra horizontal vermelha proporcional + Número oficial */}
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-3 min-w-[200px]">
                            {/* Barra proporcional ao líder */}
                            <div className="w-28 sm:w-36 h-2 bg-neutral-100 rounded-full overflow-hidden border border-[#E2E8F0]">
                              <div
                                className="h-full bg-[#E10600] rounded-full transition-all duration-300"
                                style={{ width: `${ratio}%` }}
                              />
                            </div>

                            {/* Numeração de pontos */}
                            <div className="text-right w-16">
                              <span className="font-mono text-sm font-black text-[#0F172A]">
                                {driver.points}
                              </span>
                              <span className="text-[10px] text-[#64748B] block font-mono leading-none">
                                {gap}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'constructors' ? (
          effectiveConstructorStandings.length === 0 ? (
            <div className="p-12 text-center">
              <EmptyState
                icon={Trophy}
                title="Sem classificação de construtores ainda"
                description={`A tabela de construtores será preenchida automaticamente após a conclusão das sessões de corrida da temporada ${seasonYear}.`}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#FAFAFA] text-[11px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                    <th className="py-3 px-4 text-center w-16">POS</th>
                    <th className="py-3 px-4">EQUIPE</th>
                    <th className="py-3 px-4 text-center w-24">VITÓRIAS</th>
                    <th className="py-3 px-4 text-center w-24">PÓDIOS</th>
                    <th className="py-3 px-4 text-right w-64">PONTOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-xs">
                  {effectiveConstructorStandings.map((cTeam, index) => {
                    const pos = index + 1
                    const leaderPts = effectiveConstructorStandings[0]?.points || 0
                    const gap = pos === 1 ? 'LÍDER' : `-${leaderPts - cTeam.points} pts`
                    const ratio =
                      maxConstructorPoints > 0
                        ? Math.max(
                            0,
                            Math.min(100, Math.round((cTeam.points / maxConstructorPoints) * 100)),
                          )
                        : 0

                    return (
                      <tr
                        key={cTeam.id}
                        onClick={() => handleTeamClick(cTeam)}
                        className={`transition-colors cursor-pointer group ${
                          cTeam.isPlayer ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-neutral-50'
                        }`}
                      >
                        {/* POS + Variação N vs N-1 */}
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-mono font-black text-[11px] shadow-2xs ${
                                pos === 1
                                  ? 'bg-amber-400 text-amber-950 ring-1 ring-amber-500/50'
                                  : pos === 2
                                    ? 'bg-slate-300 text-slate-900 ring-1 ring-slate-400/50'
                                    : pos === 3
                                      ? 'bg-amber-700 text-white ring-1 ring-amber-800/50'
                                      : 'bg-neutral-100 text-[#64748B]'
                              }`}
                            >
                              {pos}
                            </span>
                            {cTeam.positionDeltaText && cTeam.positionDeltaText !== '—' && (
                              <span
                                className={`text-[10px] font-mono font-bold ${
                                  cTeam.positionDeltaText.startsWith('↑')
                                    ? 'text-emerald-600'
                                    : 'text-rose-600'
                                }`}
                              >
                                {cTeam.positionDeltaText}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* EQUIPE: Logo reduzida oficial (20-28px) + Nome + Tag Sua Escuderia */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <TeamCrest
                              team={cTeam.id || cTeam.name}
                              teamName={cTeam.name}
                              size="md"
                            />
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className={`truncate ${
                                  cTeam.isPlayer
                                    ? 'font-black text-[#0F172A] text-xs sm:text-sm'
                                    : 'font-semibold text-[#0F172A]'
                                }`}
                              >
                                {cTeam.name}
                              </span>
                              {cTeam.isPlayer && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-[#E10600] text-white shrink-0">
                                  SUA ESCUDERIA
                                </span>
                              )}
                              {cTeam.isPlayer && (team?.constructors_points_deduction || 0) > 0 && (
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 text-red-600 border-red-300 text-[9px] px-1.5 py-0 h-4 font-mono font-bold"
                                >
                                  -{team?.constructors_points_deduction} pts FIA
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* VITÓRIAS */}
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`font-mono font-bold ${
                              cTeam.wins > 0 ? 'text-[#0F172A]' : 'text-[#94A3B8]'
                            }`}
                          >
                            {cTeam.wins}
                          </span>
                        </td>

                        {/* PÓDIOS */}
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`font-mono font-bold ${
                              cTeam.podiums > 0 ? 'text-[#0F172A]' : 'text-[#94A3B8]'
                            }`}
                          >
                            {cTeam.podiums}
                          </span>
                        </td>

                        {/* PONTOS: Barra horizontal vermelha proporcional + Número oficial */}
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-3 min-w-[200px]">
                            {/* Barra proporcional ao líder */}
                            <div className="w-28 sm:w-36 h-2 bg-neutral-100 rounded-full overflow-hidden border border-[#E2E8F0]">
                              <div
                                className="h-full bg-[#E10600] rounded-full transition-all duration-300"
                                style={{ width: `${ratio}%` }}
                              />
                            </div>

                            {/* Numeração de pontos */}
                            <div className="text-right w-16">
                              <span className="font-mono text-sm font-black text-[#0F172A]">
                                {cTeam.points}
                              </span>
                              <span className="text-[10px] text-[#64748B] block font-mono leading-none">
                                {gap}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ABA RESULTADOS / ARQUIVO POR TEMPORADA */
          <div className="p-6 space-y-6">
            {/* Seletor do ano arquivado */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#64748B] uppercase font-mono">
                  Selecione a Temporada Homologada:
                </span>
                <div className="flex items-center gap-1.5">
                  {(archivedSeasons.length > 0 ? archivedSeasons : [{ season_year: 2026 }]).map(
                    (h: any) => (
                      <button
                        key={h.id || h.season_year}
                        type="button"
                        onClick={() => setSelectedArchiveYear(h.season_year)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                          selectedArchiveYear === h.season_year
                            ? 'bg-[#0F172A] text-white shadow-xs'
                            : 'bg-neutral-100 text-[#475569] hover:bg-neutral-200'
                        }`}
                      >
                        Campeão {h.season_year}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <span className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                ✓ Registro Imutável e Oficial
              </span>
            </div>

            {(() => {
              const hist =
                archivedSeasons.find((h) => h.season_year === selectedArchiveYear) ||
                archivedSeasons[0]
              const dChamp = hist?.drivers_champion || {
                driverName: 'Andrea Kimi Antonelli',
                points: 300,
                wins: 12,
                podiums: 12,
              }
              const cChamp = hist?.constructors_champion || {
                teamName: 'Mercedes-AMG PETRONAS',
                points: 475,
                wins: 19,
                podiums: 19,
              }
              const dStandings: any[] = Array.isArray(hist?.final_driver_standings)
                ? hist.final_driver_standings
                : []
              const cStandings: any[] = Array.isArray(hist?.final_constructor_standings)
                ? hist.final_constructor_standings
                : []

              // Pódio dos 3 primeiros do Mundial de Pilotos
              const podiumDrivers = dStandings.slice(0, 3)

              return (
                <div className="space-y-6">
                  {/* PÓDIO DOS 3 PILOTOS NO MUNDIAL DE PILOTOS */}
                  <div className="bg-gradient-to-br from-[#F8FAFC] to-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xs">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#E2E8F0]">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs sm:text-sm font-black uppercase text-[#0F172A] tracking-wider font-mono">
                        PÓDIO OFICIAL DO MUNDIAL DE PILOTOS {selectedArchiveYear}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      {/* P2: Vice-campeão (Prata) */}
                      <div className="order-2 md:order-1 bg-white rounded-xl p-4 border border-slate-200 shadow-xs text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-800 font-black font-mono text-sm">
                          2º
                        </div>
                        <div className="font-bold text-sm text-[#0F172A]">
                          {podiumDrivers[1]?.name || 'Vice-Campeão'}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          {podiumDrivers[1]?.teamName || 'Equipe'}
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-700 bg-slate-50 py-1 rounded">
                          {podiumDrivers[1]?.points ?? 0} pts • {podiumDrivers[1]?.wins ?? 0}{' '}
                          vitórias
                        </div>
                      </div>

                      {/* P1: Campeão Mundial (Ouro) */}
                      <div className="order-1 md:order-2 bg-gradient-to-b from-amber-50 to-white rounded-xl p-5 border-2 border-amber-400 shadow-md text-center space-y-2.5 -translate-y-1">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-400 text-amber-950 font-black font-mono text-base shadow-xs">
                          1º
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 font-mono">
                          CAMPEÃO MUNDIAL {selectedArchiveYear}
                        </div>
                        <div className="font-black text-base text-[#0F172A]">
                          {dChamp.driverName || podiumDrivers[0]?.name || 'Campeão'}
                        </div>
                        <div className="text-xs text-[#475569] font-medium">
                          {cChamp.teamName || podiumDrivers[0]?.teamName || ''}
                        </div>
                        <div className="text-xs font-mono font-black text-amber-950 bg-amber-100/80 py-1.5 rounded-lg">
                          {dChamp.points ?? podiumDrivers[0]?.points ?? 0} pts •{' '}
                          {dChamp.wins ?? podiumDrivers[0]?.wins ?? 0} vitórias •{' '}
                          {dChamp.podiums ?? podiumDrivers[0]?.podiums ?? 0} pódios
                        </div>
                      </div>

                      {/* P3: Terceiro colocado (Bronze) */}
                      <div className="order-3 md:order-3 bg-white rounded-xl p-4 border border-amber-900/20 shadow-xs text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700 text-white font-black font-mono text-sm">
                          3º
                        </div>
                        <div className="font-bold text-sm text-[#0F172A]">
                          {podiumDrivers[2]?.name || '3º Colocado'}
                        </div>
                        <div className="text-xs text-[#64748B]">
                          {podiumDrivers[2]?.teamName || 'Equipe'}
                        </div>
                        <div className="text-xs font-mono font-bold text-amber-900 bg-amber-50/50 py-1 rounded">
                          {podiumDrivers[2]?.points ?? 0} pts • {podiumDrivers[2]?.wins ?? 0}{' '}
                          vitórias
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TABELAS COMPLETAS DO ARQUIVO: CONSTRUTORES E PILOTOS */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Tabela Final de Construtores */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                      <div className="p-3 bg-neutral-50 border-b border-[#E2E8F0] flex items-center justify-between">
                        <span className="font-bold text-xs uppercase tracking-tight text-[#0F172A]">
                          Tabela Final de Construtores ({selectedArchiveYear})
                        </span>
                        <span className="text-[11px] font-mono text-emerald-600 font-bold">
                          Campeã: {cChamp.teamName}
                        </span>
                      </div>
                      <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-[#FAFAFA] text-[10px] font-mono text-[#64748B] uppercase sticky top-0 border-b border-[#E2E8F0]">
                            <tr>
                              <th className="py-2 px-3 text-center w-10">Pos</th>
                              <th className="py-2 px-3">Escuderia</th>
                              <th className="py-2 px-3 text-center w-14">Vit</th>
                              <th className="py-2 px-3 text-center w-14">Pód</th>
                              <th className="py-2 px-3 text-right w-16">Pts</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F1F5F9] font-mono">
                            {cStandings.map((c, i) => (
                              <tr
                                key={c.id || i}
                                className={
                                  i === 0 ? 'bg-amber-50/40 font-bold' : 'hover:bg-neutral-50'
                                }
                              >
                                <td className="py-2 px-3 text-center font-bold text-[#64748B]">
                                  P{i + 1}
                                </td>
                                <td className="py-2 px-3 font-sans font-semibold text-[#0F172A] truncate max-w-[180px]">
                                  {c.name}
                                </td>
                                <td className="py-2 px-3 text-center text-[#475569]">
                                  {c.wins ?? 0}
                                </td>
                                <td className="py-2 px-3 text-center text-[#475569]">
                                  {c.podiums ?? 0}
                                </td>
                                <td className="py-2 px-3 text-right font-black text-[#0F172A]">
                                  {c.points ?? 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tabela Final de Pilotos */}
                    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                      <div className="p-3 bg-neutral-50 border-b border-[#E2E8F0] flex items-center justify-between">
                        <span className="font-bold text-xs uppercase tracking-tight text-[#0F172A]">
                          Tabela Final de Pilotos ({selectedArchiveYear})
                        </span>
                        <span className="text-[11px] font-mono text-amber-600 font-bold">
                          Campeão: {dChamp.driverName}
                        </span>
                      </div>
                      <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-[#FAFAFA] text-[10px] font-mono text-[#64748B] uppercase sticky top-0 border-b border-[#E2E8F0]">
                            <tr>
                              <th className="py-2 px-3 text-center w-10">Pos</th>
                              <th className="py-2 px-3">Piloto</th>
                              <th className="py-2 px-3 text-center w-14">Vit</th>
                              <th className="py-2 px-3 text-center w-14">Pód</th>
                              <th className="py-2 px-3 text-right w-16">Pts</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F1F5F9] font-mono">
                            {dStandings.map((d, i) => (
                              <tr
                                key={d.id || i}
                                className={
                                  i === 0 ? 'bg-amber-50/40 font-bold' : 'hover:bg-neutral-50'
                                }
                              >
                                <td className="py-2 px-3 text-center font-bold text-[#64748B]">
                                  P{i + 1}
                                </td>
                                <td className="py-2 px-3 font-sans font-semibold text-[#0F172A] truncate max-w-[180px]">
                                  {d.name}
                                </td>
                                <td className="py-2 px-3 text-center text-[#475569]">
                                  {d.wins ?? 0}
                                </td>
                                <td className="py-2 px-3 text-center text-[#475569]">
                                  {d.podiums ?? 0}
                                </td>
                                <td className="py-2 px-3 text-right font-black text-[#0F172A]">
                                  {d.points ?? 0}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 5. MODAL DE FICHA/PERFIL DO PILOTO (SISTEMA EXISTENTE)   */}
      {/* ======================================================== */}
      {selectedPilotForModal && (
        <PilotProfileDialog
          pilot={selectedPilotForModal}
          open={pilotModalOpen}
          onOpenChange={setPilotModalOpen}
          onOpenContractModal={() => {}}
          currentRound={safeCurrentRound}
        />
      )}

      {/* ======================================================== */}
      {/* 6. MODAL INSTITUCIONAL DA EQUIPE (SISTEMA EXISTENTE)     */}
      {/* ======================================================== */}
      {selectedTeamForModal && (
        <TeamInstitutionalDetailsModal
          open={teamModalOpen}
          onOpenChange={setTeamModalOpen}
          team={selectedTeamForModal}
          teamName={selectedTeamForModal.name}
          teamHq="Sede Operacional Europeia"
          teamCountry="Licença Oficial FIA"
          engineSupplier={selectedTeamForModal.engine || 'Fórmula 1 Turbo-Híbrido'}
          teamIntro={`Operação técnica de alto rendimento focada na disputa direta do Campeonato Mundial da FIA sob o regulamento técnico da era ${seasonYear}.`}
        />
      )}
    </div>
  )
}
