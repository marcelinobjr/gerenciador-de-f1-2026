import React, { useState, useMemo } from 'react'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { DriverStanding, TeamStanding } from '@/services/standingsService'
import { Calendar, Compass, Trophy, Users, Shield, Scale, Award, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { getTeamReducedLogoUrl } from '@/lib/team-reduced-logo-resolver'
import { CountryFlag } from '@/components/CountryFlag'
import { PilotProfileDialog } from '@/components/PilotProfileDialog'
import { TeamInstitutionalDetailsModal } from '@/components/team/TeamInstitutionalDetailsModal'
import { normalizeDriverSurname } from '@/lib/pilot-posters'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { canonicalChampionshipMigrationService } from '@/services/canonicalChampionshipMigrationService'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'
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

  const [activeTab, setActiveTab] = useState<'drivers' | 'constructors'>('drivers')

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

  // Reconciliação transparente de resultados legados caso existam rodadas salvas sob team.id
  React.useEffect(() => {
    if (team?.id && careerId && team.id !== careerId) {
      canonicalChampionshipMigrationService.reconcileLegacyCareerResults({
        canonicalCareerId: careerId,
        legacyCareerIds: [team.id],
        seasonYear,
      })
    }
  }, [careerId, team?.id, seasonYear])

  const championshipSnapshot = useMemo(() => {
    return canonicalChampionshipService.getChampionshipStandings(
      careerId,
      seasonYear,
      undefined,
      team?.id,
    )
  }, [careerId, seasonYear, team?.id, driverStandings])

  const throughRound = championshipSnapshot?.throughRound || 0

  // Se throughRound > 0 ou se houver resultados canônicos elegíveis, priorizar o snapshot canônico
  // convertendo-o para as interfaces DriverStanding e TeamStanding com pontos acumulados
  const effectiveDriverStandings = useMemo<DriverStanding[]>(() => {
    if (
      championshipSnapshot &&
      championshipSnapshot.throughRound > 0 &&
      championshipSnapshot.driverStandings.length > 0
    ) {
      return championshipSnapshot.driverStandings.map((d) => ({
        id: d.driverId,
        name: d.driverName,
        nationality: d.nationality,
        flag: d.flag,
        teamName: d.currentTeamName || 'Sem Equipe',
        teamColor: d.currentTeamColor || '#71717A',
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
      }))
    }
    return driverStandings || []
  }, [championshipSnapshot, driverStandings])

  const effectiveConstructorStandings = useMemo<TeamStanding[]>(() => {
    if (
      championshipSnapshot &&
      championshipSnapshot.throughRound > 0 &&
      championshipSnapshot.constructorStandings.length > 0
    ) {
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

  // Mapa de pilotos por equipe para listar os titulares compactos na aba Construtores ("Bortoleto · Ricciardo")
  const teamLineupMap = useMemo(() => {
    const map: Record<string, string[]> = {}

    // 1. Pilotos do jogador
    if (playerDrivers && playerDrivers.length > 0) {
      const pKey = team?.id || 'player'
      const pTeamName = team?.name || 'Escuderia Brasil'
      const starters = playerDrivers.filter(
        (d) => !d.role || d.role.toLowerCase().includes('titular'),
      )
      const list = starters.length > 0 ? starters : playerDrivers.slice(0, 2)
      const surnames = list.map((d) => normalizeDriverSurname(d.name))
      map[pKey] = surnames
      map[pTeamName] = surnames
    }

    // 2. Pilotos agrupados a partir do effectiveDriverStandings
    if (effectiveDriverStandings && effectiveDriverStandings.length > 0) {
      effectiveDriverStandings.forEach((d) => {
        if (!map[d.teamName]) {
          map[d.teamName] = []
        }
        const surname = normalizeDriverSurname(d.name)
        if (!map[d.teamName].includes(surname)) {
          map[d.teamName].push(surname)
        }
      })
    }

    return map
  }, [playerDrivers, team, effectiveDriverStandings])

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

        {/* Seletor PILOTOS / CONSTRUTORES */}
        <div className="inline-flex items-center p-1 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] self-start sm:self-auto shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('drivers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'constructors'
                ? 'bg-[#E10600] text-white shadow-sm'
                : 'bg-transparent text-[#0F172A] hover:bg-white/70'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span className="tracking-wide uppercase">CONSTRUTORES</span>
          </button>
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
                : `Campeonato Mundial de Construtores ${seasonYear}`}
            </h2>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans">
              {activeTab === 'drivers'
                ? 'Os melhores do mundo. Uma só coroa.'
                : 'Engenharia, pessoas e performance. Uma temporada para definir o melhor conjunto.'}
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
                : `${effectiveConstructorStandings.length} Construtores`}
            </div>
            <span className="text-[11px] text-[#475569] font-medium block truncate">
              {activeTab === 'drivers'
                ? `${effectiveConstructorStandings.length} equipes participantes`
                : `${effectiveDriverStandings.length} pilotos titulares no grid`}
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
                : `CLASSIFICAÇÃO DE CONSTRUTORES • TEMPORADA ${seasonYear}`}
            </h3>
          </div>
          <span className="text-[11px] font-mono font-bold text-[#64748B]">
            {activeTab === 'drivers'
              ? `${effectiveDriverStandings.length} pilotos inscritos`
              : `${effectiveConstructorStandings.length} construtores ativos`}
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
                    const logoUrl = getTeamReducedLogoUrl(driver.teamName)
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
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={driver.teamName}
                                className="w-6 h-6 object-contain shrink-0"
                                loading="lazy"
                              />
                            ) : (
                              <div
                                className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black text-white"
                                style={{ backgroundColor: driver.teamColor || '#E10600' }}
                              >
                                {driver.teamName.charAt(0)}
                              </div>
                            )}
                            <span
                              className="truncate font-medium text-xs text-[#334155]"
                              style={{
                                color: driver.teamColor ? undefined : undefined,
                              }}
                            >
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
        ) : effectiveConstructorStandings.length === 0 ? (
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
                  <th className="py-3 px-4">PILOTOS</th>
                  <th className="py-3 px-4 text-center w-24">VITÓRIAS</th>
                  <th className="py-3 px-4 text-center w-24">PÓDIOS</th>
                  <th className="py-3 px-4 text-right w-64">PONTOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-xs">
                {effectiveConstructorStandings.map((cTeam, index) => {
                  const pos = index + 1
                  const logoUrl = getTeamReducedLogoUrl(cTeam.name || cTeam.id)
                  const leaderPts = effectiveConstructorStandings[0]?.points || 0
                  const gap = pos === 1 ? 'LÍDER' : `-${leaderPts - cTeam.points} pts`
                  const ratio =
                    maxConstructorPoints > 0
                      ? Math.max(
                          0,
                          Math.min(100, Math.round((cTeam.points / maxConstructorPoints) * 100)),
                        )
                      : 0

                  // Lineup dos dois titulares de forma compacta (ex: "Bortoleto · Ricciardo")
                  const pilotsList = teamLineupMap[cTeam.id] || teamLineupMap[cTeam.name] || []
                  const pilotsDisplay =
                    pilotsList.length > 0 ? pilotsList.slice(0, 2).join(' · ') : '—'

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
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={cTeam.name}
                              className="w-6 h-6 object-contain shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-black text-white"
                              style={{ backgroundColor: cTeam.color || '#E10600' }}
                            >
                              {cTeam.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex items-center gap-2 truncate">
                            <CountryFlag code={cTeam.name} className="text-sm shrink-0" />
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

                      {/* PILOTOS: Sobrenomes dos dois titulares de forma compacta */}
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-[#475569] text-xs">{pilotsDisplay}</span>
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
          teamIntro="Operação técnica de alto rendimento focada na disputa direta do Campeonato Mundial da FIA sob o regulamento técnico da era 2026."
        />
      )}
    </div>
  )
}
