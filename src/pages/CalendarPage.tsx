import React, { useState, useEffect, useMemo } from 'react'
import { useUnifiedSeason } from '@/hooks/use-unified-season'
import { useToast } from '@/hooks/use-toast'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import {
  resolveCircuitProfile,
  CIRCUIT_PERFORMANCE_PROFILES,
} from '@/data/circuit-performance-profiles'
import { hasSprintWeekend } from '@/services/weekendProgressionService'
import { RookiePracticeRequirementService } from '@/services/rookiePracticeRequirementService'
import {
  RookieTl1PlanningService,
  type RookieRecommendationInfo,
} from '@/services/rookieTl1PlanningService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { OfficialRaceResultPanel } from '@/components/race/OfficialRaceResultPanel'
import { CircuitBlueprint } from '@/components/CircuitBlueprint'
import { CircuitTrackImage } from '@/components/CircuitTrackImage'
import { getCircuitImage } from '@/data/assets/circuitAssets'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { resolveCountryFlag } from '@/lib/country-flag'
import type { DriverModel, GrandPrixInfo, RaceResultModel } from '@/types/f1'
import type { RookieTl1Plan, RookieEligibilityCheck } from '@/types/rookie-practice'
import type { OfficialRaceResult } from '@/types/canonical-race-v2'

import {
  Calendar as CalendarIcon,
  Search,
  Flag,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  UserCheck,
  AlertTriangle,
  X,
  ChevronRight,
  Info,
  Car,
  Trophy,
  History,
  FileText,
  HelpCircle,
  RotateCcw,
  ShieldCheck,
  Award,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import defaultAustraliaMap from '@/assets/01-australia-aeace.jpg'

type FilterChip =
  | 'TODOS'
  | 'SPRINT'
  | 'JA_DISPUTADAS'
  | 'PROXIMAS'
  | 'PLANEJADO_ROOKIE'
  | 'SEM_PLANEJAMENTO'
  | 'OPORTUNIDADES_ROOKIE'

export default function CalendarPage() {
  const {
    team,
    season,
    raceResults,
    playerDrivers,
    currentRound,
    totalRounds,
    loading: seasonLoading,
  } = useUnifiedSeason()

  const { toast } = useToast()

  const careerId = (season as any)?.career_id || (season as any)?.careerId || 'default_career'
  const seasonId = season?.id || '2026'
  const teamId = team?.id || 'audi'

  // Estado de seleção da rodada ativa no painel lateral (padrão: rodada atual do jogo)
  const [selectedRound, setSelectedRound] = useState<number>(() => currentRound || 1)

  // Quando currentRound mudar na carreira, sincroniza seleção se aplicável
  useEffect(() => {
    if (currentRound && currentRound >= 1 && currentRound <= 24) {
      setSelectedRound((prev) => (prev ? prev : currentRound))
    }
  }, [currentRound])

  // Tab ativa no painel lateral: 'visao-geral' | 'resultados' | 'historico'
  const [activeTab, setActiveTab] = useState<'visao-geral' | 'resultados' | 'historico'>(
    'visao-geral',
  )

  // Filtro chip e busca por texto
  const [activeFilter, setActiveFilter] = useState<FilterChip>('TODOS')
  const [searchQuery, setSearchQuery] = useState('')

  // Catálogo completo de pilotos para modal de novatos
  const [allDriversCatalog, setAllDriversCatalog] = useState<DriverModel[]>([])

  // Planos de TL1 persistidos
  const [plans, setPlans] = useState<RookieTl1Plan[]>(() => {
    return RookieTl1PlanningService.getPlans(careerId, seasonId, teamId)
  })

  // Recarrega planos quando mudar carreira, temporada ou time
  const reloadPlans = () => {
    const loaded = RookieTl1PlanningService.getPlans(careerId, seasonId, teamId)
    setPlans(loaded)
  }

  useEffect(() => {
    reloadPlans()
  }, [careerId, seasonId, teamId])

  // Modal de escalação de novato no TL1
  const [modalState, setModalState] = useState<{
    open: boolean
    round: number
    carId: 'car1' | 'car2'
  }>({
    open: false,
    round: 1,
    carId: 'car1',
  })

  // Modal de visualização do Resultado Oficial Histórico homologado
  const [officialResultModal, setOfficialResultModal] = useState<{
    open: boolean
    result: OfficialRaceResult | null
  }>({
    open: false,
    result: null,
  })

  // Status de obrigações regulamentares de novatos (serviço existente)
  const teamRequirement = useMemo(() => {
    return RookiePracticeRequirementService.getTeamRequirement(seasonId, teamId)
  }, [seasonId, teamId, plans])

  // Contadores do resumo
  const totalCalendarRounds = totalRounds || F1_2026_CALENDAR.length || 24

  // Contagem canônica de fins de semana Sprint
  const sprintStats = useMemo(() => {
    const sprintCount = F1_2026_CALENDAR.filter((gp) => hasSprintWeekend(gp.round)).length
    const sprintPercent = Math.round((sprintCount / totalCalendarRounds) * 100)
    return { count: sprintCount, percent: sprintPercent }
  }, [totalCalendarRounds])

  // GP atual no calendário
  const currentGpMeta = useMemo(() => {
    return F1_2026_CALENDAR.find((gp) => gp.round === currentRound) || F1_2026_CALENDAR[0]
  }, [currentRound])

  // GP selecionado no painel lateral
  const selectedGp = useMemo(() => {
    return F1_2026_CALENDAR.find((gp) => gp.round === selectedRound) || F1_2026_CALENDAR[0]
  }, [selectedRound])

  const selectedProfile = useMemo(() => {
    try {
      return resolveCircuitProfile({ round: selectedRound })
    } catch {
      return null
    }
  }, [selectedRound])

  // Recomendações por rodada memoizadas
  const recommendationsMap = useMemo(() => {
    const map = new Map<number, RookieRecommendationInfo>()
    F1_2026_CALENDAR.forEach((gp) => {
      const rec = RookieTl1PlanningService.getRecommendationForRound({
        round: gp.round,
        seasonId,
        teamId,
        currentRound,
      })
      map.set(gp.round, rec)
    })
    return map
  }, [seasonId, teamId, currentRound])

  // Opções de novatos elegíveis e inelegíveis para o modal
  const rookieOptions = useMemo(() => {
    return RookiePracticeRequirementService.getRosterRookieOptions(
      playerDrivers,
      allDriversCatalog,
      teamId,
    )
  }, [playerDrivers, allDriversCatalog, teamId])

  // Carrega motoristas disponíveis para o modal
  useEffect(() => {
    import('@/services/f1Service').then(({ f1Service }) => {
      f1Service
        .getMarketDrivers()
        .then((drivers) => {
          if (Array.isArray(drivers) && drivers.length > 0) {
            setAllDriversCatalog(drivers)
          }
        })
        .catch(() => {})
    })
  }, [])

  // Mapa de resultados oficiais por rodada para consulta rápida
  const officialResultsMap = useMemo(() => {
    const map = new Map<number, OfficialRaceResult>()
    for (let r = 1; r <= 24; r++) {
      const res = canonicalRaceResultService.getOfficialRaceResult(
        careerId,
        season?.year || 2026,
        r,
      )
      if (res) {
        map.set(r, res)
      }
    }
    return map
  }, [careerId, season?.year, raceResults])

  // Filtragem dos GPs
  const filteredGps = useMemo(() => {
    return F1_2026_CALENDAR.filter((gp) => {
      const isSprint = hasSprintWeekend(gp.round)
      const isCompleted = gp.round < currentRound || officialResultsMap.has(gp.round)
      const isUpcoming = !isCompleted

      const planC1 = plans.find(
        (p) => p.round === gp.round && p.carId === 'car1' && p.status !== 'CANCELLED',
      )
      const planC2 = plans.find(
        (p) => p.round === gp.round && p.carId === 'car2' && p.status !== 'CANCELLED',
      )
      const hasRookiePlan = !!planC1 || !!planC2

      const rec = recommendationsMap.get(gp.round)
      const isOpportunity = rec?.isRecommended ?? false

      // Filtro por chip
      let matchChip = true
      if (activeFilter === 'SPRINT') matchChip = isSprint
      else if (activeFilter === 'JA_DISPUTADAS') matchChip = isCompleted
      else if (activeFilter === 'PROXIMAS') matchChip = isUpcoming
      else if (activeFilter === 'PLANEJADO_ROOKIE') matchChip = hasRookiePlan
      else if (activeFilter === 'SEM_PLANEJAMENTO') matchChip = !hasRookiePlan && isUpcoming
      else if (activeFilter === 'OPORTUNIDADES_ROOKIE') matchChip = isOpportunity

      if (!matchChip) return false

      // Busca por país, circuito ou rodada
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const roundStr = `r${gp.round}`
        const matchText =
          gp.country.toLowerCase().includes(q) ||
          gp.name.toLowerCase().includes(q) ||
          gp.circuit.toLowerCase().includes(q) ||
          roundStr.includes(q) ||
          String(gp.round) === q
        if (!matchText) return false
      }

      return true
    })
  }, [activeFilter, searchQuery, currentRound, officialResultsMap, plans, recommendationsMap])

  // Contagens para os chips de filtros
  const filterCounts = useMemo(() => {
    let sprint = 0
    let disputadas = 0
    let proximas = 0
    let planejadoRookie = 0
    let semPlanejamento = 0
    let oportunidades = 0

    F1_2026_CALENDAR.forEach((gp) => {
      const isSprint = hasSprintWeekend(gp.round)
      const isCompleted = gp.round < currentRound || officialResultsMap.has(gp.round)
      const isUpcoming = !isCompleted
      const planC1 = plans.find(
        (p) => p.round === gp.round && p.carId === 'car1' && p.status !== 'CANCELLED',
      )
      const planC2 = plans.find(
        (p) => p.round === gp.round && p.carId === 'car2' && p.status !== 'CANCELLED',
      )
      const hasPlan = !!planC1 || !!planC2
      const rec = recommendationsMap.get(gp.round)

      if (isSprint) sprint++
      if (isCompleted) disputadas++
      if (isUpcoming) proximas++
      if (hasPlan) planejadoRookie++
      if (!hasPlan && isUpcoming) semPlanejamento++
      if (rec?.isRecommended) oportunidades++
    })

    return {
      todos: F1_2026_CALENDAR.length,
      sprint,
      disputadas,
      proximas,
      planejadoRookie,
      semPlanejamento,
      oportunidades,
    }
  }, [currentRound, officialResultsMap, plans, recommendationsMap])

  // Próximas oportunidades recomendadas para exibir no painel lateral
  const nextRecommendedGps = useMemo(() => {
    return F1_2026_CALENDAR.filter((gp) => {
      if (gp.round < currentRound) return false
      const rec = recommendationsMap.get(gp.round)
      return rec?.isRecommended
    }).slice(0, 3)
  }, [currentRound, recommendationsMap])

  // Handlers de planejamento
  const handleOpenAssignModal = (round: number, carId: 'car1' | 'car2') => {
    setModalState({ open: true, round, carId })
  }

  const handleSelectRookieForSeat = (rookieCheck: RookieEligibilityCheck) => {
    const { round, carId } = modalState
    const targetDriver =
      allDriversCatalog.find((d) => d.id === rookieCheck.driverId) ||
      playerDrivers.find((d) => d.id === rookieCheck.driverId) ||
      ({
        id: rookieCheck.driverId,
        name: rookieCheck.driverName,
        role: rookieCheck.role,
        category: rookieCheck.category,
      } as any)

    const result = RookieTl1PlanningService.setSeatPlan({
      careerId,
      seasonId,
      teamId,
      round,
      carId,
      driver: targetDriver,
      raceResults,
    })

    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Planejamento Não Permitido',
        description: result.message,
      })
      return
    }

    toast({
      title: 'Novato Planejado no TL1',
      description: `${rookieCheck.driverName} planejado para o Carro ${carId === 'car1' ? 1 : 2} no GP de ${F1_2026_CALENDAR.find((g) => g.round === round)?.name || `R${round}`}. O crédito só será concedido quando o treino for concluído com voltas válidas.`,
    })

    setModalState({ open: false, round: 1, carId: 'car1' })
    reloadPlans()
  }

  const handleClearSeatPlan = (round: number, carId: 'car1' | 'car2') => {
    RookieTl1PlanningService.clearSeatPlan(careerId, seasonId, teamId, round, carId)
    toast({
      title: 'Plano Removido',
      description: `Piloto titular restaurado para o Carro ${carId === 'car1' ? 1 : 2} no TL1 da rodada ${round}.`,
    })
    reloadPlans()
  }

  // Alerta regulamentar
  const isUrgentCar1 = teamRequirement.car1.remaining > 0 && Math.max(0, 24 - currentRound + 1) <= 6
  const isUrgentCar2 = teamRequirement.car2.remaining > 0 && Math.max(0, 24 - currentRound + 1) <= 6

  // Formatação de data do GP
  const formatGpDate = (round: number) => {
    const prof = CIRCUIT_PERFORMANCE_PROFILES.find((c) => c.round === round)
    if (prof?.endDate) {
      const parts = prof.endDate.split('/')
      if (parts.length === 3) {
        const day = parts[0]
        const months = [
          'JAN',
          'FEV',
          'MAR',
          'ABR',
          'MAI',
          'JUN',
          'JUL',
          'AGO',
          'SET',
          'OUT',
          'NOV',
          'DEZ',
        ]
        const mIdx = parseInt(parts[1], 10) - 1
        return `${day} ${months[mIdx] || ''}`
      }
    }
    return `R${round}`
  }

  // Próximo GP e data canônica
  const nextGp = F1_2026_CALENDAR.find((gp) => gp.round === currentRound) || F1_2026_CALENDAR[0]
  const nextGpDateFormatted = formatGpDate(nextGp.round)

  return (
    <div
      className="space-y-6 pb-12 font-sans text-[#1E293B] animate-fade-in"
      data-testid="calendar-page"
    >
      {/* ========================================================= */}
      {/* 1. CABEÇALHO CLARO CONFORME MOCKUP */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div className="space-y-1">
          <h1
            className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A]"
            data-testid="calendar-title"
          >
            Calendário
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] font-medium">
            Temporada completa com 24 corridas, fins de semana Sprint, circuitos e planejamento de
            TL1 para novatos.
          </p>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-medium">
            Planeje as sessões de TL1 de novatos para cumprir as obrigações da temporada.
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. 5 CARDS DE RESUMO (DADOS CANÔNICOS REAIS) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4" data-testid="summary-cards">
        {/* Card 1: Corridas / Temporada */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-red-50 text-[#E10600] shrink-0">
            <Flag className="w-5 h-5" />
          </div>
          <div>
            <div
              className="text-xl font-black text-[#0F172A] leading-tight"
              data-testid="stat-total-rounds"
            >
              {totalCalendarRounds}
            </div>
            <div className="text-[11px] text-[#64748B] font-medium">
              corridas <br />
              <span className="text-[10px] text-[#94A3B8]">Temporada {season?.year || 2026}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Sprint e percentual */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div
              className="text-xl font-black text-[#0F172A] leading-tight"
              data-testid="stat-sprint-count"
            >
              {sprintStats.count}
            </div>
            <div className="text-[11px] text-[#64748B] font-medium">
              fins de semana Sprint <br />
              <span className="text-[10px] text-[#94A3B8]">
                {sprintStats.percent}% da temporada
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Rodada Atual */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-[#64748B] font-semibold uppercase">Rodada atual</div>
            <div
              className="text-lg font-black text-[#0F172A] leading-tight"
              data-testid="stat-current-round"
            >
              {currentRound} / {totalCalendarRounds}
            </div>
            <div className="text-[10px] text-[#64748B] truncate" title={currentGpMeta.name}>
              {currentGpMeta.name}
            </div>
          </div>
        </div>

        {/* Card 4: Obrigações TL1 Novatos */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-[#64748B] font-semibold uppercase">
              Obrigações TL1 Novatos
            </div>
            <div
              className="text-lg font-black text-[#0F172A] leading-tight"
              data-testid="stat-rookie-total"
            >
              {teamRequirement.completedTotal} / 4{' '}
              <span className="text-xs font-normal text-[#64748B]">cumpridas</span>
            </div>
            <div className="text-[10px] text-[#64748B]">
              {teamRequirement.remainingTotal} sessões restantes
            </div>
          </div>
        </div>

        {/* Card 5: Carro 1 e Carro 2 */}
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="p-2.5 rounded-lg bg-slate-100 text-[#475569] shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <div className="flex items-center gap-1.5" data-testid="stat-car1-credits">
              <span className="font-semibold text-[#64748B]">Carro 1:</span>
              <strong className="text-[#0F172A]">{teamRequirement.car1.completed} / 2</strong>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5" data-testid="stat-car2-credits">
              <span className="font-semibold text-[#64748B]">Carro 2:</span>
              <strong className="text-[#0F172A]">{teamRequirement.car2.completed} / 2</strong>
            </div>
            <span className="text-[9px] text-[#94A3B8] block mt-0.5">
              Cada carro precisa de 2 TL1
            </span>
          </div>
        </div>
      </div>

      {/* Alerta regulamentar caso faltem poucas rodadas */}
      {(isUrgentCar1 || isUrgentCar2) && (
        <div
          className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-3"
          data-testid="rookie-urgency-alert"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong className="block font-bold">
              Risco de não cumprimento regulamentar de TL1:
            </strong>
            <span className="text-amber-800">
              Restam poucas rodadas e sua equipe ainda precisa ceder sessões de TL1 para novatos
              {isUrgentCar1 ? ` (Carro 1 pendente: ${teamRequirement.car1.remaining})` : ''}
              {isUrgentCar2 ? ` (Carro 2 pendente: ${teamRequirement.car2.remaining})` : ''}.
            </span>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. FILTROS CHIPS + BARRA DE BUSCA */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white border border-[#E2E8F0] p-3 rounded-xl">
        <div
          className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0"
          data-testid="filter-chips"
        >
          {[
            { id: 'TODOS', label: `Todos (${filterCounts.todos})` },
            { id: 'SPRINT', label: `Sprint (${filterCounts.sprint})` },
            { id: 'JA_DISPUTADAS', label: `Já disputadas (${filterCounts.disputadas})` },
            { id: 'PROXIMAS', label: `Próximas (${filterCounts.proximas})` },
            {
              id: 'OPORTUNIDADES_ROOKIE',
              label: `Favoráveis a novatos (${filterCounts.oportunidades})`,
            },
            { id: 'PLANEJADO_ROOKIE', label: `Planejado Rookie (${filterCounts.planejadoRookie})` },
            { id: 'SEM_PLANEJAMENTO', label: `Sem Planejamento (${filterCounts.semPlanejamento})` },
          ].map((chip) => {
            const isActive = activeFilter === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveFilter(chip.id as FilterChip)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#E10600] text-white shadow-xs'
                    : 'bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9] border border-[#E2E8F0]'
                }`}
                data-testid={`filter-${chip.id.toLowerCase()}`}
              >
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Input de Busca */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Buscar por país, circuito ou rodada..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-9 pr-8 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#E10600] placeholder:text-[#94A3B8]"
            data-testid="search-calendar-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. LAYOUT PRINCIPAL: GRID 6 COLUNAS (ESQUERDA) + PAINEL (DIREITA) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* GRID DAS RODADAS: 8 colunas no desktop */}
        <div className="lg:col-span-8">
          {filteredGps.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-[#E2E8F0] space-y-3">
              <CalendarIcon className="w-8 h-8 text-[#94A3B8] mx-auto" />
              <div className="text-sm font-bold text-[#0F172A]">Nenhuma rodada encontrada</div>
              <p className="text-xs text-[#64748B]">
                Tente ajustar a busca ou os filtros de visualização.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveFilter('TODOS')
                  setSearchQuery('')
                }}
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3"
              data-testid="calendar-grid"
            >
              {filteredGps.map((gp) => {
                const isSelected = selectedRound === gp.round
                const isSprint = hasSprintWeekend(gp.round)
                const isCompleted = gp.round < currentRound || officialResultsMap.has(gp.round)
                const isCurrent = gp.round === currentRound
                const isFuture = !isCompleted && !isCurrent

                // Status da rodada
                let roundStatusText = 'Futura'
                let roundStatusColor = 'bg-slate-100 text-slate-600 border-slate-200'
                if (isCompleted) {
                  roundStatusText = 'Concluída'
                  roundStatusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                } else if (isCurrent) {
                  roundStatusText = 'Atual'
                  roundStatusColor = 'bg-red-50 text-[#E10600] border-red-200 font-bold'
                } else if (gp.round === currentRound + 1) {
                  roundStatusText = 'Próxima'
                  roundStatusColor = 'bg-blue-50 text-blue-700 border-blue-200'
                }

                // Status de Rookie
                const planC1 = plans.find((p) => p.round === gp.round && p.carId === 'car1')
                const planC2 = plans.find((p) => p.round === gp.round && p.carId === 'car2')
                const hasPlan =
                  (planC1 && planC1.status !== 'CANCELLED') ||
                  (planC2 && planC2.status !== 'CANCELLED')
                const hasNeedsReview =
                  planC1?.status === 'NEEDS_REVIEW' || planC2?.status === 'NEEDS_REVIEW'

                const isCreditFulfilled =
                  teamRequirement.car1.completedRounds.includes(gp.round) ||
                  teamRequirement.car2.completedRounds.includes(gp.round)

                // Recomendação
                const rec = recommendationsMap.get(gp.round)
                const dateText = formatGpDate(gp.round)

                return (
                  <div
                    key={gp.round}
                    onClick={() => setSelectedRound(gp.round)}
                    className={`relative p-3 rounded-xl bg-white border cursor-pointer transition-all flex flex-col justify-between min-h-[178px] text-left select-none ${
                      isSelected
                        ? 'border-[#E10600] ring-2 ring-[#E10600]/30 shadow-md'
                        : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-xs'
                    }`}
                    data-testid={`gp-card-${gp.round}`}
                  >
                    {/* Topo: Rodada + Bandeira + Data */}
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-[#0F172A]">R{gp.round}</span>
                        <span className="text-base leading-none" role="img" aria-label={gp.country}>
                          {resolveCountryFlag(gp.country)}
                        </span>
                        <span className="text-[10px] font-mono text-[#64748B]">{dateText}</span>
                      </div>

                      {/* Nome do País/GP */}
                      <div className="mt-1.5">
                        <div className="text-xs font-bold text-[#0F172A] truncate" title={gp.name}>
                          {gp.country}
                        </div>
                        <div className="text-[10px] text-[#64748B] truncate" title={gp.circuit}>
                          {gp.circuit.split(',')[0]}
                        </div>
                      </div>

                      {/* Miniatura do Traçado por circuitId */}
                      <div className="w-full h-12 my-1 flex items-center justify-center overflow-hidden">
                        <CircuitBlueprint
                          round={gp.round}
                          circuitName={gp.name}
                          laps={gp.laps}
                          lengthKm={gp.circuitLengthKm}
                          className="h-full w-full border-none !p-0 bg-transparent"
                        />
                      </div>
                    </div>

                    {/* Rodapé do Card: Badges (GP/Sprint) + Status Rodada + Status Rookie */}
                    <div className="space-y-1 pt-1 border-t border-[#F1F5F9]">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            isSprint
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isSprint ? 'Sprint' : 'GP'}
                        </span>

                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded border ${roundStatusColor}`}
                          data-testid={`round-status-${gp.round}`}
                        >
                          {roundStatusText}
                        </span>
                      </div>

                      {/* Status Rookie ou Recomendação */}
                      {isCreditFulfilled ? (
                        <div className="text-[9px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>ROOKIE CUMPRIDO</span>
                        </div>
                      ) : hasNeedsReview ? (
                        <div className="text-[9px] font-bold text-amber-700 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>REVISÃO TL1</span>
                        </div>
                      ) : hasPlan ? (
                        <div className="text-[9px] font-bold text-blue-700 flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          <UserCheck className="w-3 h-3 text-blue-600" />
                          <span>ROOKIE PLANEJADO</span>
                        </div>
                      ) : rec?.label === 'Oportunidade para rookie' ? (
                        <div
                          className="text-[9px] font-semibold text-emerald-700 flex items-center gap-1 truncate"
                          title={rec.reason}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="truncate">Bom para novato</span>
                        </div>
                      ) : rec?.label === 'Evitar' ? (
                        <div
                          className="text-[9px] font-semibold text-rose-700 flex items-center gap-1 truncate"
                          title={rec.reason}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          <span className="truncate">Evitar</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* PAINEL LATERAL DIREITO (4 colunas no desktop) */}
        {/* ========================================================= */}
        <div
          className="lg:col-span-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden sticky top-6"
          data-testid="calendar-side-panel"
        >
          {/* HERO DO GP SELECIONADO */}
          <div className="p-4 sm:p-5 border-b border-[#E2E8F0] bg-gradient-to-b from-[#F8FAFC] to-white relative">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-md bg-white border border-[#E2E8F0] shadow-2xs">
                R{selectedGp.round}
              </span>
              <div className="flex items-center gap-1.5">
                {hasSprintWeekend(selectedGp.round) && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                    FIM DE SEMANA SPRINT
                  </Badge>
                )}
                {selectedGp.round < currentRound || officialResultsMap.has(selectedGp.round) ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                    CONCLUÍDA
                  </Badge>
                ) : selectedGp.round === currentRound ? (
                  <Badge className="bg-red-100 text-[#E10600] border-red-300 text-[10px] font-bold">
                    RODADA ATUAL
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    A DISPUTAR
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none" role="img" aria-label={selectedGp.country}>
                {resolveCountryFlag(selectedGp.country)}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-[#0F172A] leading-tight truncate">
                  {selectedGp.name}
                </h2>
                <p className="text-xs text-[#64748B] truncate mt-0.5">{selectedGp.circuit}</p>
                <p className="text-[11px] font-mono text-[#94A3B8] mt-1">
                  📅 {formatGpDate(selectedGp.round)} • 2026
                </p>
              </div>
            </div>
          </div>

          {/* TABS DO PAINEL LATERAL */}
          <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC]">
            {[
              { id: 'visao-geral', label: 'Visão Geral' },
              { id: 'resultados', label: 'Resultados' },
              { id: 'historico', label: 'Histórico' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-[#E10600] text-[#E10600] bg-white'
                    : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                }`}
                data-testid={`side-tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5 space-y-5 max-h-[calc(100vh-280px)] overflow-y-auto">
            {/* CONTEÚDO DA TAB VISÃO GERAL */}
            {activeTab === 'visao-geral' && (
              <div className="space-y-4">
                {/* Visual do Mapa com Blueprint técnico */}
                <div className="flex items-center gap-4 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div className="w-32 h-24 relative shrink-0 overflow-hidden flex items-center justify-center">
                    <CircuitBlueprint
                      round={selectedGp.round}
                      circuitName={selectedGp.name}
                      laps={selectedGp.laps}
                      lengthKm={selectedGp.circuitLengthKm}
                      className="h-full w-full border-none !p-0 bg-transparent"
                    />
                  </div>

                  <div className="flex-1 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Comprimento:</span>
                      <strong className="text-[#0F172A]">
                        {selectedGp.circuitLengthKm.toFixed(3)} km
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Voltas:</span>
                      <strong className="text-[#0F172A]">{selectedGp.laps}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Abrasividade:</span>
                      <strong className="text-[#0F172A]">
                        {selectedGp.tireAbrasiveness >= 8
                          ? 'Alta'
                          : selectedGp.tireAbrasiveness >= 5
                            ? 'Média'
                            : 'Baixa'}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Tipo:</span>
                      <strong className="text-[#0F172A]">
                        {selectedProfile?.trackType === 'urbana' ? 'Circuito de rua' : 'Permanente'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* BLOCO: PLANEJAMENTO TL1 DE NOVATOS (CORAÇÃO FUNCIONAL) */}
                <div
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  data-testid="rookie-tl1-planning-block"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <h4 className="text-xs font-black uppercase text-[#0F172A]">
                        Planejamento TL1 de Novatos
                      </h4>
                      <p className="text-[10px] text-[#64748B]">
                        Obrigações da temporada: 4 sessões (2 por carro)
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#E10600]">
                      {teamRequirement.completedTotal} / 4
                    </span>
                  </div>

                  {/* CARRO 1 */}
                  {(() => {
                    const planC1 = plans.find(
                      (p) =>
                        p.round === selectedRound && p.carId === 'car1' && p.status !== 'CANCELLED',
                    )
                    const isCreditCar1 =
                      teamRequirement.car1.completedRounds.includes(selectedRound)
                    const isPast = selectedRound < currentRound

                    return (
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <strong className="text-[#0F172A]">Carro 1</strong>
                            <span className="text-[11px] text-[#64748B]">
                              ({teamRequirement.car1.completed}/2 cumpridas)
                            </span>
                          </div>
                          <div className="mt-1 text-[11px]">
                            {isCreditCar1 ? (
                              <span className="text-emerald-600 font-semibold">
                                ✓ Crédito homologado no TL1
                              </span>
                            ) : planC1 ? (
                              <div className="flex items-center gap-1 text-blue-700">
                                <span className="font-bold">{planC1.driverName}</span>
                                {planC1.status === 'NEEDS_REVIEW' && (
                                  <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0">
                                    Revisão
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#94A3B8]">Piloto Titular Homologado</span>
                            )}
                          </div>
                        </div>

                        {!isPast && (
                          <div className="flex items-center gap-1.5">
                            {planC1 ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleClearSeatPlan(selectedRound, 'car1')}
                                className="h-7 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              >
                                Usar Titular
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAssignModal(selectedRound, 'car1')}
                                className="h-7 text-[11px] border-blue-200 text-blue-700 hover:bg-blue-50"
                              >
                                Planejar Rookie
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* CARRO 2 */}
                  {(() => {
                    const planC2 = plans.find(
                      (p) =>
                        p.round === selectedRound && p.carId === 'car2' && p.status !== 'CANCELLED',
                    )
                    const isCreditCar2 =
                      teamRequirement.car2.completedRounds.includes(selectedRound)
                    const isPast = selectedRound < currentRound

                    return (
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <strong className="text-[#0F172A]">Carro 2</strong>
                            <span className="text-[11px] text-[#64748B]">
                              ({teamRequirement.car2.completed}/2 cumpridas)
                            </span>
                          </div>
                          <div className="mt-1 text-[11px]">
                            {isCreditCar2 ? (
                              <span className="text-emerald-600 font-semibold">
                                ✓ Crédito homologado no TL1
                              </span>
                            ) : planC2 ? (
                              <div className="flex items-center gap-1 text-blue-700">
                                <span className="font-bold">{planC2.driverName}</span>
                                {planC2.status === 'NEEDS_REVIEW' && (
                                  <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0">
                                    Revisão
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#94A3B8]">Piloto Titular Homologado</span>
                            )}
                          </div>
                        </div>

                        {!isPast && (
                          <div className="flex items-center gap-1.5">
                            {planC2 ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleClearSeatPlan(selectedRound, 'car2')}
                                className="h-7 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              >
                                Usar Titular
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenAssignModal(selectedRound, 'car2')}
                                className="h-7 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                Planejar Rookie
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      Melhor usar novato em fins de semana sem Sprint, onde há mais tempo de pista e
                      menor pressão.
                    </span>
                  </div>
                </div>

                {/* PRÓXIMAS OPORTUNIDADES RECOMENDADAS */}
                {nextRecommendedGps.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                      Próximas oportunidades recomendadas:
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {nextRecommendedGps.map((gp) => (
                        <div
                          key={gp.round}
                          onClick={() => setSelectedRound(gp.round)}
                          className="p-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-between text-xs cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span>{resolveCountryFlag(gp.country)}</span>
                            <span className="font-bold text-[#0F172A]">{gp.country}</span>
                            <span className="text-[10px] text-[#64748B] font-mono">
                              R{gp.round} • {formatGpDate(gp.round)}
                            </span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8]" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CONTEÚDO DA TAB RESULTADOS (PARA RODADAS CONCLUÍDAS) */}
            {activeTab === 'resultados' && (
              <div className="space-y-4">
                {officialResultsMap.has(selectedRound) ? (
                  (() => {
                    const res = officialResultsMap.get(selectedRound)!
                    const winner =
                      res.entries.find((e) => e.driverId === res.winnerDriverId) ||
                      res.entries.find((e) => e.finalPosition === 1) ||
                      res.entries[0]
                    const pole =
                      res.entries.find((e) => e.driverId === res.poleDriverId) ||
                      res.entries.find((e) => e.gridPosition === 1)
                    const fastest = res.fastestLapDriverId
                      ? res.entries.find((e) => e.driverId === res.fastestLapDriverId)
                      : null
                    const playerEntries = res.playerEntries || res.entries.filter((e) => e.isPlayer)

                    return (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-600" />
                            <div>
                              <span className="text-[10px] uppercase font-bold text-amber-800 block">
                                Vencedor da Corrida
                              </span>
                              <strong className="text-xs text-[#0F172A]">
                                {winner?.driverName}
                              </strong>
                            </div>
                          </div>
                          <Badge className="bg-amber-500 text-black text-[10px] font-black">
                            P1
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-[10px] text-[#64748B] block font-semibold">
                              Pole Position
                            </span>
                            <strong className="text-[#0F172A] truncate block mt-0.5">
                              {pole?.driverName || '—'}
                            </strong>
                          </div>
                          <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200">
                            <span className="text-[10px] text-purple-700 block font-semibold">
                              Volta Mais Rápida
                            </span>
                            <strong className="text-[#0F172A] truncate block mt-0.5">
                              {fastest?.driverName || '—'}
                            </strong>
                          </div>
                        </div>

                        {/* Carros do Jogador */}
                        {playerEntries.length > 0 && (
                          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                            <span className="text-[10px] font-bold text-[#64748B] uppercase block">
                              Sua Escuderia no GP:
                            </span>
                            <div className="space-y-1">
                              {playerEntries.map((p, idx) => (
                                <div
                                  key={p.driverId || idx}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-[#0F172A] font-semibold">
                                    {p.driverName}
                                  </span>
                                  <span className="font-mono text-[#64748B]">
                                    P{p.finalPosition} •{' '}
                                    <strong className="text-emerald-600 font-bold">
                                      +{p.pointsAwarded || 0} pts
                                    </strong>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Botão Ver Resultado Oficial (Abre modo histórico) */}
                        <Button
                          type="button"
                          onClick={() => setOfficialResultModal({ open: true, result: res })}
                          className="w-full bg-[#E10600] hover:bg-[#c20500] text-white text-xs font-bold gap-2 py-2 shadow-xs"
                          data-testid="view-official-result-btn"
                        >
                          <FileText className="w-4 h-4" />
                          VER RESULTADO OFICIAL
                        </Button>
                      </div>
                    )
                  })()
                ) : selectedRound < currentRound ? (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-[#64748B] space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                    <p className="font-bold text-[#0F172A]">Etapa Concluída</p>
                    <p>
                      Os arquivos históricos desta rodada já foram arquivados nos registros da
                      carreira.
                    </p>
                  </div>
                ) : (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-[#64748B] space-y-1">
                    <Clock className="w-6 h-6 text-blue-600 mx-auto" />
                    <p className="font-bold text-[#0F172A]">Etapa Futura</p>
                    <p>Os resultados oficiais estarão disponíveis após a disputa da corrida.</p>
                  </div>
                )}
              </div>
            )}

            {/* CONTEÚDO DA TAB HISTÓRICO (PREPARADA) */}
            {activeTab === 'historico' && (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-[#64748B] space-y-2">
                <History className="w-6 h-6 text-[#94A3B8] mx-auto" />
                <p className="font-bold text-[#0F172A]">Histórico do Grande Prêmio</p>
                <p>
                  Estatísticas de edições anteriores, recordes de volta e retrospecto de pilotos e
                  construtores.
                </p>
                <Button variant="outline" size="sm" disabled className="text-xs">
                  Módulo Histórico (HIST-01)
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. RODAPÉ COM BARRA DE PROGRESSO DA TEMPORADA */}
      {/* ========================================================= */}
      <div
        className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono"
        data-testid="calendar-footer"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#0F172A]">TEMPORADA {season?.year || 2026}</span>
          <span className="text-[#64748B]" data-testid="footer-progress-text">
            {Math.max(0, currentRound - 1)} / {totalCalendarRounds} rodadas
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="flex-1 max-w-md mx-auto w-full">
          <div className="w-full bg-[#E2E8F0] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#E10600] h-2 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (Math.max(0, currentRound - 1) / totalCalendarRounds) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-right">
          <span className="text-[#64748B]">
            {Math.max(0, totalCalendarRounds - currentRound + 1)} corridas restantes
          </span>
          <span className="text-[#0F172A] font-bold">
            • Próximo: {nextGp.country} ({nextGpDateFormatted})
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL: SELECIONAR PILOTO PARA O TL1 */}
      {/* ========================================================= */}
      {modalState.open && (
        <Dialog
          open={modalState.open}
          onOpenChange={(open) => {
            if (!open) setModalState((prev) => ({ ...prev, open: false }))
          }}
        >
          <DialogContent className="max-w-xl bg-white border-[#E2E8F0] text-[#0F172A] font-sans">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2 text-[#0F172A]">
                <UserCheck className="w-5 h-5 text-[#E10600]" />
                Selecionar Piloto para o TL1 — {modalState.carId === 'car1' ? 'Carro 1' : 'Carro 2'}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#64748B]">
                Regulamento Esportivo FIA: apenas pilotos com no máximo 2 Grandes Prêmios de F1
                disputados na carreira (≤ 2 GPs) são elegíveis para cumprir a cota de novatos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* ELEGÍVEIS */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 uppercase">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Pilotos Elegíveis ({rookieOptions.eligible.length})
                </span>

                {rookieOptions.eligible.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-[#64748B]">
                    Nenhum piloto novato elegível disponível no momento.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rookieOptions.eligible.map((item) => {
                      // Verifica se já está no outro carro nesta mesma rodada
                      const otherCarId = modalState.carId === 'car1' ? 'car2' : 'car1'
                      const otherPlan = plans.find(
                        (p) =>
                          p.round === modalState.round &&
                          p.carId === otherCarId &&
                          p.status !== 'CANCELLED',
                      )
                      const isOccupiedInOtherCar = otherPlan?.driverId === item.driverId

                      return (
                        <div
                          key={item.driverId}
                          className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between hover:border-emerald-400 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <DriverPhotoAvatar
                              name={item.driverName}
                              driverId={item.driverId}
                              teamColor="#E10600"
                              size="md"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-[#0F172A]">
                                  {item.driverName}
                                </span>
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">
                                  {item.careerGPs} GP{item.careerGPs === 1 ? '' : 's'}
                                </Badge>
                                {item.role && (
                                  <span className="text-[10px] text-[#64748B] uppercase">
                                    ({item.role})
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-emerald-600 mt-0.5">{item.reason}</p>
                              {isOccupiedInOtherCar && (
                                <p className="text-[10px] text-rose-600 font-bold mt-0.5">
                                  Este piloto já está planejado para o outro carro neste TL1.
                                </p>
                              )}
                            </div>
                          </div>

                          <Button
                            size="sm"
                            disabled={isOccupiedInOtherCar}
                            onClick={() => handleSelectRookieForSeat(item)}
                            className={`text-xs font-bold ${
                              isOccupiedInOtherCar
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : 'bg-[#E10600] hover:bg-[#c20500] text-white'
                            }`}
                          >
                            {isOccupiedInOtherCar ? 'Em uso no outro carro' : 'Planejar no TL1'}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* INELEGÍVEIS COM MOTIVO */}
              {rookieOptions.ineligible.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-[#E2E8F0]">
                  <span className="text-xs font-bold text-[#64748B] flex items-center gap-1.5 uppercase">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Pilotos Inelegíveis ({rookieOptions.ineligible.length})
                  </span>
                  <div className="space-y-1.5">
                    {rookieOptions.ineligible.map((item) => (
                      <div
                        key={item.driverId}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs opacity-60"
                      >
                        <div>
                          <span className="font-bold text-[#0F172A]">{item.driverName}</span>
                          <span className="text-[10px] text-[#64748B] ml-2">
                            ({item.careerGPs} GPs disputados)
                          </span>
                          <p className="text-[10px] text-rose-600">{item.reason}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] text-rose-600 border-rose-200"
                        >
                          Inelegível
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalState({ open: false, round: 1, carId: 'car1' })}
              >
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================= */}
      {/* MODAL: MODO HISTÓRICO DO RESULTADO OFICIAL (RACE-END-01) */}
      {/* ========================================================= */}
      {officialResultModal.open && officialResultModal.result && (
        <Dialog
          open={officialResultModal.open}
          onOpenChange={(open) => {
            if (!open) setOfficialResultModal({ open: false, result: null })
          }}
        >
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-slate-50 border-[#E2E8F0] p-4 sm:p-6 text-[#0F172A]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <DialogTitle className="text-base font-black">
                Arquivo Homologado FIA — {officialResultModal.result.circuitName}
              </DialogTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOfficialResultModal({ open: false, result: null })}
              >
                Fechar
              </Button>
            </div>

            <OfficialRaceResultPanel
              result={officialResultModal.result}
              careerPersistenceStatus="COMPLETE"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
