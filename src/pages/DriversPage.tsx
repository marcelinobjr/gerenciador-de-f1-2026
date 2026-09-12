import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { DriverModel, TeamModel, RaceResultModel } from '@/types/f1'
import { formatCurrency } from '@/lib/formatters'
import { getCountryFlag } from '@/lib/country-flags'
import { getDriverPhotoSources } from '@/lib/driver-photos'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { AmbientBackground } from '@/components/AmbientBackground'
import { PageHeader } from '@/components/PageHeader'
import { ProgressBar } from '@/components/ProgressBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Users,
  Search,
  SlidersHorizontal,
  DollarSign,
  Trophy,
  Zap,
  Shield,
  Activity,
  HeartPulse,
  Calendar,
  Flame,
  Award,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  Lock,
  ArrowUpDown,
  Filter,
} from 'lucide-react'

// Situação do piloto normalizada
export type DriverSituation = 'titular' | 'reserva' | 'mercado' | 'aposentado'

export function getDriverSituation(driver: DriverModel): DriverSituation {
  if (driver.category === 'mercado' && !driver.team_id && !driver.reserve_team_id) {
    // Se o salário for 0 e categoria mercado, pode ser aposentado ou agente livre
    if (driver.salary === 0 && driver.age >= 40) {
      return 'aposentado'
    }
    return 'mercado'
  }
  if (driver.role === 'reserva' || (driver.reserve_team_id && !driver.team_id)) {
    return 'reserva'
  }
  if (driver.team_id || driver.role === 'titular') {
    return 'titular'
  }
  return 'mercado'
}

export function getSituationBadge(situation: DriverSituation) {
  switch (situation) {
    case 'titular':
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider">
          Titular
        </Badge>
      )
    case 'reserva':
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px] font-bold uppercase tracking-wider">
          Reserva
        </Badge>
      )
    case 'mercado':
      return (
        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40 text-[10px] font-bold uppercase tracking-wider">
          Mercado
        </Badge>
      )
    case 'aposentado':
      return (
        <Badge className="bg-zinc-700/40 text-zinc-400 border-zinc-600/40 text-[10px] font-bold uppercase tracking-wider">
          Aposentado
        </Badge>
      )
  }
}

export default function DriversPage() {
  const { team, season, refreshTeamAndSeason } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [drivers, setDrivers] = useState<DriverModel[]>([])
  const [teams, setTeams] = useState<TeamModel[]>([])
  const [raceResults, setRaceResults] = useState<RaceResultModel[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [teamFilter, setTeamFilter] = useState('todas')
  const [situationFilter, setSituationFilter] = useState<'todas' | DriverSituation>('todas')
  const [sortBy, setSortBy] = useState<'speed' | 'points' | 'salary'>('speed')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modal de Detalhes
  const [selectedDriver, setSelectedDriver] = useState<DriverModel | null>(null)
  const [isHiring, setIsHiring] = useState(false)
  const [hireRole, setHireRole] = useState<'titular' | 'reserva'>('titular')

  // Carregar dados
  const loadData = async () => {
    try {
      setLoading(true)
      const [allDrivers, allTeams, allResults] = await Promise.all([
        f1Service.getAllDrivers(),
        f1Service.getAllTeams(),
        season?.id ? f1Service.getSeasonRaceResults(season.id) : Promise.resolve([]),
      ])
      setDrivers(allDrivers)
      setTeams(allTeams)
      setRaceResults(allResults)
    } catch (err) {
      console.error('Erro ao carregar dados de pilotos:', err)
      toast({
        variant: 'destructive',
        title: 'Erro de conexão',
        description: 'Não foi possível carregar a lista de pilotos.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [season?.id])

  useRealtime('drivers', () => {
    loadData()
  })

  // Mapeamento de equipes por ID
  const teamsMap = useMemo(() => {
    const map = new Map<string, TeamModel>()
    teams.forEach((t) => map.set(t.id, t))
    return map
  }, [teams])

  // Estatísticas calculadas a partir de race_results para cada piloto
  const driverStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        points: number
        wins: number
        podiums: number
        races: number
        bestPos: number
        seasons: Set<string>
      }
    >()

    raceResults.forEach((r) => {
      const dId = r.driver_id
      if (!dId) return
      const current = map.get(dId) || {
        points: 0,
        wins: 0,
        podiums: 0,
        races: 0,
        bestPos: 99,
        seasons: new Set<string>(),
      }

      current.points += r.points || 0
      current.races += 1
      if (r.position === 1) current.wins += 1
      if (r.position >= 1 && r.position <= 3) current.podiums += 1
      if (r.position < current.bestPos) current.bestPos = r.position
      if (r.season_id) current.seasons.add(r.season_id)

      map.set(dId, current)
    })

    return map
  }, [raceResults])

  // Lista filtrada e ordenada
  const filteredDrivers = useMemo(() => {
    let list = drivers.slice()

    // 1. Busca por nome ou nacionalidade
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.nationality.toLowerCase().includes(q) ||
          (d.team_id && teamsMap.get(d.team_id)?.name.toLowerCase().includes(q)),
      )
    }

    // 2. Filtro por equipe
    if (teamFilter !== 'todas') {
      if (teamFilter === 'sem_equipe') {
        list = list.filter((d) => !d.team_id && !d.reserve_team_id)
      } else {
        list = list.filter((d) => d.team_id === teamFilter || d.reserve_team_id === teamFilter)
      }
    }

    // 3. Filtro por situação
    if (situationFilter !== 'todas') {
      list = list.filter((d) => getDriverSituation(d) === situationFilter)
    }

    // 4. Ordenação
    list.sort((a, b) => {
      let valA = 0
      let valB = 0

      if (sortBy === 'speed') {
        valA = a.speed || 0
        valB = b.speed || 0
      } else if (sortBy === 'salary') {
        valA = a.salary || 0
        valB = b.salary || 0
      } else if (sortBy === 'points') {
        valA = driverStatsMap.get(a.id)?.points || 0
        valB = driverStatsMap.get(b.id)?.points || 0
      }

      if (sortOrder === 'asc') {
        return valA - valB
      }
      return valB - valA
    })

    return list
  }, [
    drivers,
    searchTerm,
    teamFilter,
    situationFilter,
    sortBy,
    sortOrder,
    teamsMap,
    driverStatsMap,
  ])

  // Informações da Silly Season e Rodada
  const currentRound = season?.current_round || 1
  const isSillySeasonOpen = currentRound >= 12
  const nextSeasonYear = (season?.year || 2026) + 1

  // Contratação de piloto do mercado reusando f1Service
  const handleHireDriver = async (driver: DriverModel, role: 'titular' | 'reserva') => {
    if (!team) return
    setIsHiring(true)
    try {
      // Se a Silly Season estiver aberta, pode assinar para próxima temporada ou contratar imediato
      if (isSillySeasonOpen) {
        await f1Service.signNextSeasonDriver(driver.id, team.id, role, driver.salary)
        await f1Service.addEvent(
          team.id,
          `📝 PRÉ-CONTRATO ${nextSeasonYear}: ${driver.name} assina com a ${team.name} para a próxima temporada!`,
          'contrato',
        )
        toast({
          title: `Contrato para ${nextSeasonYear} assinado!`,
          description: `${driver.name} defenderá a ${team.name} como ${role === 'titular' ? 'titular' : 'piloto reserva'} em ${nextSeasonYear}.`,
        })
      } else {
        // Contratação direta imediata para vagas abertas
        await f1Service.hireDriver(driver.id, team.id, role)
        await f1Service.addEvent(
          team.id,
          `${driver.name} foi contratado como piloto ${role} da escuderia.`,
          'contrato',
        )
        toast({
          title: 'Piloto contratado com sucesso!',
          description: `${driver.name} agora é piloto ${role} da ${team.name}.`,
        })
      }

      setSelectedDriver(null)
      await refreshTeamAndSeason()
      await loadData()
    } catch (err: any) {
      console.error('Erro na contratação:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na contratação',
        description: err?.message || 'Não foi possível contratar o piloto.',
      })
    } finally {
      setIsHiring(false)
    }
  }

  return (
    <div className="relative space-y-6 animate-fade-in-up pb-12">
      <AmbientBackground />

      {/* Cabeçalho da Página */}
      <PageHeader
        eyebrow="RACE OPERATIONS // UNIVERSO DE PILOTOS"
        title="Pilotos da Temporada"
        description="Grid completo da Fórmula 1 2026/2027 e mercado global de talentos. Fotos de pilotos, fichas técnicas, contratos e histórico de pista."
        badge={
          <Badge
            variant="outline"
            className="border-[#1F2733] bg-[#161D29] text-[#F5F7FA] font-mono text-xs"
          >
            {filteredDrivers.length} Pilotos Registrados
          </Badge>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/team')}
            className="border-[#1F2733] bg-[#161D29] text-xs hover:bg-[#1F2733] text-[#F5F7FA]"
          >
            <Users className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
            Minha Equipe
          </Button>
        }
      />

      {/* Barra de Filtros e Busca */}
      <div className="p-4 rounded-xl bg-[#090D15]/80 backdrop-blur-md border border-[#1A2333] shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A7]" />
            <input
              type="text"
              placeholder="Buscar por nome, nacionalidade ou equipe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-sm text-[#F5F7FA] placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Filtros em Linha */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {/* Filtro de Equipe */}
            <div className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#1F2733] rounded-lg px-2.5 py-1.5">
              <span className="text-[#8B95A7]">Equipe:</span>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="bg-transparent text-[#F5F7FA] focus:outline-none cursor-pointer font-bold"
              >
                <option value="todas" className="bg-[#11161F]">
                  Todas as Equipes
                </option>
                <option value="sem_equipe" className="bg-[#11161F]">
                  Sem Equipe / Agentes Livres
                </option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#11161F]">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro de Situação */}
            <div className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#1F2733] rounded-lg px-2.5 py-1.5">
              <span className="text-[#8B95A7]">Situação:</span>
              <select
                value={situationFilter}
                onChange={(e) => setSituationFilter(e.target.value as any)}
                className="bg-transparent text-[#F5F7FA] focus:outline-none cursor-pointer font-bold"
              >
                <option value="todas" className="bg-[#11161F]">
                  Todas
                </option>
                <option value="titular" className="bg-[#11161F]">
                  Titulares
                </option>
                <option value="reserva" className="bg-[#11161F]">
                  Reservas
                </option>
                <option value="mercado" className="bg-[#11161F]">
                  Mercado
                </option>
                <option value="aposentado" className="bg-[#11161F]">
                  Aposentados
                </option>
              </select>
            </div>

            {/* Ordenação */}
            <div className="flex items-center gap-1.5 bg-[#0B0E14] border border-[#1F2733] rounded-lg px-2.5 py-1.5">
              <span className="text-[#8B95A7]">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-[#F5F7FA] focus:outline-none cursor-pointer font-bold"
              >
                <option value="speed" className="bg-[#11161F]">
                  Velocidade
                </option>
                <option value="points" className="bg-[#11161F]">
                  Pontos FIA
                </option>
                <option value="salary" className="bg-[#11161F]">
                  Salário
                </option>
              </select>

              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                title={sortOrder === 'desc' ? 'Maior para menor' : 'Menor para maior'}
                className="text-cyan-400 hover:text-cyan-300 font-bold px-1 ml-0.5"
              >
                {sortOrder === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Cards de Pilotos */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-[#090D15]/80 border border-[#1A2333] space-y-3"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="w-16 h-16 rounded-xl bg-[#161D29]" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4 bg-[#161D29]" />
                  <Skeleton className="h-3 w-1/2 bg-[#161D29]" />
                </div>
              </div>
              <Skeleton className="h-20 w-full bg-[#161D29]" />
            </div>
          ))}
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#090D15]/80 border border-[#1A2333] space-y-3">
          <p className="text-zinc-400 text-sm">Nenhum piloto encontrado com os filtros atuais.</p>
          {(searchTerm || teamFilter !== 'todas' || situationFilter !== 'todas') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('')
                setTeamFilter('todas')
                setSituationFilter('todas')
              }}
              className="border-[#1F2733] text-xs"
            >
              Limpar todos os filtros
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDrivers.map((driver) => {
            const currentTeam = driver.team_id
              ? teamsMap.get(driver.team_id)
              : driver.reserve_team_id
                ? teamsMap.get(driver.reserve_team_id)
                : null
            const isUserDriver =
              (team?.id && (driver.team_id === team.id || driver.reserve_team_id === team.id)) ||
              false
            const teamColor =
              currentTeam?.color || (isUserDriver ? team?.color : '#4A5568') || '#4A5568'
            const situation = getDriverSituation(driver)
            const stats = driverStatsMap.get(driver.id) || { points: 0, wins: 0, podiums: 0 }

            return (
              <div
                key={driver.id}
                onClick={() => setSelectedDriver(driver)}
                className={`group relative p-4 rounded-xl bg-[#090D15]/85 backdrop-blur-sm border transition-all duration-200 cursor-pointer flex flex-col justify-between hover:scale-[1.01] hover:shadow-xl ${
                  isUserDriver
                    ? 'border-cyan-500/50 hover:border-cyan-400 ring-1 ring-cyan-500/20'
                    : 'border-[#1A2333] hover:border-[#2A374D]'
                }`}
              >
                {/* Indicador de cor da equipe no topo */}
                <div
                  className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full transition-opacity opacity-70 group-hover:opacity-100"
                  style={{ backgroundColor: teamColor }}
                />

                <div className="space-y-3">
                  {/* Cabeçalho do Card: Foto + Nome + Situação */}
                  <div className="flex items-start gap-3 pt-1">
                    <DriverPhotoAvatar
                      name={driver.name}
                      teamColor={teamColor}
                      size="lg"
                      className="border-2 group-hover:border-white/40 transition-colors shrink-0"
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm shrink-0" title={driver.nationality}>
                            {getCountryFlag(driver.nationality)}
                          </span>
                          <h3 className="font-bold text-sm text-[#F5F7FA] truncate group-hover:text-cyan-300 transition-colors">
                            {driver.name}
                          </h3>
                        </div>
                      </div>

                      {/* Badge da Equipe Atual com Cor */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: teamColor }}
                        />
                        <span className="text-[11px] font-mono text-[#8B95A7] truncate">
                          {currentTeam ? currentTeam.name : 'Agente Livre'}
                        </span>
                      </div>

                      {/* Situação + Idade */}
                      <div className="flex items-center gap-2 pt-0.5">
                        {getSituationBadge(situation)}
                        <span className="text-[10px] font-mono text-[#8B95A7]">
                          {driver.age} anos
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Barras de Estatísticas */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <ProgressBar
                      value={driver.speed}
                      label="VELOCIDADE"
                      size="sm"
                      valueFormatter={(v) => `${v}`}
                    />
                    <ProgressBar
                      value={driver.consistency}
                      label="CONSISTÊNCIA"
                      size="sm"
                      valueFormatter={(v) => `${v}`}
                    />
                    <ProgressBar
                      value={driver.morale ?? 75}
                      label="MORAL"
                      size="sm"
                      valueFormatter={(v) => `${v}%`}
                    />
                    <ProgressBar
                      value={driver.physical_condition ?? 90}
                      label="COND. FÍSICA"
                      size="sm"
                      valueFormatter={(v) => `${v}%`}
                    />
                  </div>
                </div>

                {/* Rodapé do Card: Pontos + Salário */}
                <div className="mt-3 pt-2.5 border-t border-[#1F2733] flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1 text-[#8B95A7]">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      <strong className="text-white font-bold">{stats.points}</strong> pts
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[#8B95A7] text-[10px] block">Salário</span>
                    <strong className="text-[#F5F7FA] font-bold">
                      {driver.salary > 0 ? formatCurrency(driver.salary) : 'Sem contrato'}
                    </strong>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Detalhes do Piloto */}
      <Dialog open={!!selectedDriver} onOpenChange={(open) => !open && setSelectedDriver(null)}>
        {selectedDriver && (
          <DialogContent className="max-w-xl bg-[#0B0E14] border-[#1F2733] text-[#F5F7FA] p-6">
            {(() => {
              const currentTeam = selectedDriver.team_id
                ? teamsMap.get(selectedDriver.team_id)
                : selectedDriver.reserve_team_id
                  ? teamsMap.get(selectedDriver.reserve_team_id)
                  : null
              const isUserDriver =
                (team?.id &&
                  (selectedDriver.team_id === team.id ||
                    selectedDriver.reserve_team_id === team.id)) ||
                false
              const teamColor =
                currentTeam?.color || (isUserDriver ? team?.color : '#E10600') || '#E10600'
              const situation = getDriverSituation(selectedDriver)
              const stats = driverStatsMap.get(selectedDriver.id) || {
                points: 0,
                wins: 0,
                podiums: 0,
                races: 0,
                bestPos: 99,
                seasons: new Set<string>(),
              }
              const isFreeAgent = !selectedDriver.team_id && !selectedDriver.reserve_team_id
              const canHire = isFreeAgent || isSillySeasonOpen

              return (
                <div className="space-y-5">
                  <DialogHeader className="border-b border-[#1F2733] pb-4">
                    <div className="flex items-start gap-4">
                      <DriverPhotoAvatar
                        name={selectedDriver.name}
                        teamColor={teamColor}
                        size="xl"
                        className="border-2 border-[#1F2733] shrink-0"
                      />

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xl" title={selectedDriver.nationality}>
                            {getCountryFlag(selectedDriver.nationality)}
                          </span>
                          <DialogTitle className="text-xl font-black text-white truncate">
                            {selectedDriver.name}
                          </DialogTitle>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {getSituationBadge(situation)}
                          <Badge
                            variant="outline"
                            className="border-[#1F2733] text-[#8B95A7] text-[10px] font-mono"
                          >
                            {selectedDriver.age} anos • {selectedDriver.nationality}
                          </Badge>
                          {currentTeam && (
                            <Badge
                              className="text-[10px] font-mono border"
                              style={{
                                backgroundColor: `${teamColor}22`,
                                borderColor: `${teamColor}66`,
                                color: teamColor,
                              }}
                            >
                              {currentTeam.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </DialogHeader>

                  {/* Seção 1: Estatísticas Técnicas Completas */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8B95A7] block">
                      HABILIDADES TÉCNICAS E CONDICIONAMENTO
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-[#080C14] border border-[#1A2333] font-mono text-xs">
                      <ProgressBar
                        value={selectedDriver.speed}
                        label="VELOCIDADE PURA"
                        size="sm"
                        valueFormatter={(v) => `${v}`}
                      />
                      <ProgressBar
                        value={selectedDriver.consistency}
                        label="CONSISTÊNCIA"
                        size="sm"
                        valueFormatter={(v) => `${v}`}
                      />
                      <ProgressBar
                        value={selectedDriver.rain}
                        label="HABILIDADE CHUVA"
                        size="sm"
                        valueFormatter={(v) => `${v}`}
                      />
                      <ProgressBar
                        value={selectedDriver.defense}
                        label="DEFESA DE POSIÇÃO"
                        size="sm"
                        valueFormatter={(v) => `${v}`}
                      />
                      <ProgressBar
                        value={selectedDriver.morale ?? 75}
                        label="MORAL DO PILOTO"
                        size="sm"
                        valueFormatter={(v) => `${v}%`}
                      />
                      <ProgressBar
                        value={selectedDriver.physical_condition ?? 90}
                        label="CONDIÇÃO FÍSICA"
                        size="sm"
                        valueFormatter={(v) => `${v}%`}
                      />
                    </div>
                  </div>

                  {/* Seção 2: Contrato Atual */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8B95A7] block">
                      CONTRATO E VÍNCULO
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-[#080C14] border border-[#1A2333] font-mono text-xs">
                      <div>
                        <span className="text-[#8B95A7] text-[10px] block">Salário Anual</span>
                        <strong className="text-white text-sm">
                          {selectedDriver.salary > 0
                            ? formatCurrency(selectedDriver.salary)
                            : 'Sem contrato'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#8B95A7] text-[10px] block">Término do Vínculo</span>
                        <strong className="text-white text-sm">
                          {selectedDriver.contract_end || 'Imediato'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#8B95A7] text-[10px] block">Papel na Equipe</span>
                        <strong className="text-white text-sm capitalize">
                          {selectedDriver.role || (isFreeAgent ? 'Disponível' : '—')}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Seção 3: Histórico de Corridas (race_results) */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8B95A7] block">
                      HISTÓRICO NA FÓRMULA 1
                    </span>
                    <div className="grid grid-cols-4 gap-2 text-center font-mono">
                      <div className="p-2.5 rounded-lg bg-[#080C14] border border-[#1A2333]">
                        <span className="text-[#8B95A7] text-[10px] block">GPs Disputados</span>
                        <strong className="text-white text-base">{stats.races}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#080C14] border border-[#1A2333]">
                        <span className="text-[#8B95A7] text-[10px] block">Pontos FIA</span>
                        <strong className="text-white text-base">{stats.points}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#080C14] border border-[#1A2333]">
                        <span className="text-[#8B95A7] text-[10px] block">Vitórias</span>
                        <strong className="text-amber-400 text-base">{stats.wins}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-[#080C14] border border-[#1A2333]">
                        <span className="text-[#8B95A7] text-[10px] block">Pódios</span>
                        <strong className="text-cyan-400 text-base">{stats.podiums}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Seção 4: Ação de Contratação (se no mercado ou livre) */}
                  <DialogFooter className="pt-2 border-t border-[#1F2733] flex items-center justify-between sm:justify-between w-full">
                    <div className="text-left text-xs font-mono text-[#8B95A7]">
                      {isUserDriver ? (
                        <span className="text-cyan-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Piloto da sua escuderia
                        </span>
                      ) : isFreeAgent ? (
                        <span className="text-emerald-400">
                          Agente livre pronto para contratação
                        </span>
                      ) : isSillySeasonOpen ? (
                        <span className="text-amber-400">
                          Disponível para pré-contrato {nextSeasonYear}
                        </span>
                      ) : (
                        <span className="text-zinc-500">Sob contrato com outra equipe</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDriver(null)}
                        className="text-xs text-[#8B95A7] hover:text-white"
                      >
                        Fechar
                      </Button>

                      {!isUserDriver && canHire && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={isHiring}
                            onClick={() => handleHireDriver(selectedDriver, 'reserva')}
                            className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold font-mono"
                          >
                            Contratar Reserva
                          </Button>
                          <Button
                            size="sm"
                            disabled={isHiring}
                            onClick={() => handleHireDriver(selectedDriver, 'titular')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono"
                          >
                            Contratar Titular
                          </Button>
                        </div>
                      )}
                    </div>
                  </DialogFooter>
                </div>
              )
            })()}
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
