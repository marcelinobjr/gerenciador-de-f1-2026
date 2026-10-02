import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { DriverPoster } from '@/components/DriverPoster'
import { DriverSidePanel } from '@/components/DriverSidePanel'
import { DriverComparisonModal } from '@/components/DriverComparisonModal'
import { PilotProfileDialog, formatUsdCurrency } from '@/components/PilotProfileDialog'
import { CountryFlag } from '@/components/CountryFlag'
import { resolveCountryFlag, countryName } from '@/lib/country-flag'
import { getTeamLogoUrl } from '@/lib/lobby-assets'
import { DriverNegotiationModal } from '@/components/commercial/DriverNegotiationModal'
import { SillySeasonBoard } from '@/components/commercial/SillySeasonBoard'
import { sillySeasonService } from '@/services/sillySeasonService'
import { driverContractService } from '@/services/driverContractService'
import { financialLedgerService } from '@/services/financialLedgerService'
import {
  MBJ_2026_PILOTS,
  checkEligibility,
  getOverallRating,
  getDriverCareerStats,
} from '@/lib/mbj-drivers-data'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import { OFFICIAL_F1_ACADEMY_MBJ_2026 } from '@/lib/f1-academy-official-data'
import { ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search,
  Users,
  Briefcase,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trophy,
  Activity,
  Zap,
  Shield,
  CloudRain,
  DollarSign,
  UserPlus,
  Calendar,
  Building2,
  Loader2,
  Eye,
  Radio,
  ArrowUpDown,
  RotateCcw,
  Info,
  ChevronDown,
  Layers,
} from 'lucide-react'
import { DriverModel, TeamModel } from '@/types/f1'
import { getActiveDriverTeamBinding } from '@/lib/canonical-driver-database'
import { calculateDriverTotalTestMileage } from '@/services/driverMileageResolverService'
import {
  getCanonicalDisplayName,
  getDriverCanonicalKey,
  normalizeDriverNameToken,
} from '@/lib/driver-canonical-service'

export function getDriverCanonicalPotential(
  pilot: Partial<UnifiedDriverItem>,
  rawDbRecord?: any,
): number | undefined {
  const raw = rawDbRecord || pilot.rawDbRecord
  if (
    raw?.perceived_potential !== undefined &&
    raw?.perceived_potential !== null &&
    !isNaN(Number(raw.perceived_potential))
  ) {
    return Number(raw.perceived_potential)
  }
  if (
    raw?.true_potential !== undefined &&
    raw?.true_potential !== null &&
    !isNaN(Number(raw.true_potential))
  ) {
    return Number(raw.true_potential)
  }
  if (
    raw?.procedural_data?.perceivedPotential !== undefined &&
    raw?.procedural_data?.perceivedPotential !== null &&
    !isNaN(Number(raw.procedural_data.perceivedPotential))
  ) {
    return Number(raw.procedural_data.perceivedPotential)
  }
  if (
    pilot.potential !== undefined &&
    pilot.potential !== null &&
    !isNaN(Number(pilot.potential))
  ) {
    return Number(pilot.potential)
  }
  if (pilot.potentialMin !== undefined && pilot.potentialMax !== undefined) {
    const avg = Math.round((pilot.potentialMin + pilot.potentialMax) / 2)
    if (!isNaN(avg)) return avg
  }
  return undefined
}

export function filterByPotential(
  pilot: Partial<UnifiedDriverItem>,
  filterOption: string,
): boolean {
  if (filterOption === 'all') return true
  const potential = getDriverCanonicalPotential(pilot)
  if (potential === undefined || potential === null || isNaN(potential)) {
    return false
  }
  if (filterOption === '90_100') {
    return potential >= 90 && potential <= 100
  }
  if (filterOption === '80_89') {
    return potential >= 80 && potential < 90
  }
  if (filterOption === '70_79') {
    return potential >= 70 && potential < 80
  }
  if (filterOption === '60_69') {
    return potential >= 60 && potential < 70
  }
  if (filterOption === 'below_60') {
    return potential < 60
  }
  return true
}

// DriversPage inspection test
export interface UnifiedDriverItem {
  id: string
  name: string
  nationality: string
  age: number
  speed: number
  consistency: number
  rain: number
  defense: number
  salaryUsd: number
  calculatedAge?: number
  isFreeAgent?: boolean
  contractEnd: number
  teamId?: string | null
  teamKey?: string | null
  teamName?: string | null
  teamColor?: string | null
  role?: 'titular' | 'reserva' | null
  category:
    | 'f1'
    | 'f2'
    | 'f3'
    | 'indycar'
    | 'indynxt'
    | 'formula_e'
    | 'nascar'
    | 'prototipos'
    | 'wec'
    | 'mercado'
    | 'f1_academy'
  potentialMin: number
  potentialMax: number
  potential?: number
  f1RacesCompleted: number
  superlicensePoints: number
  isAcademyProspect: boolean
  isPlayerDriver: boolean
  nextTeamId?: string | null
  nextContractRole?: 'titular' | 'reserva' | null
  rawDbRecord?: DriverModel

  // Propriedades expandidas MBJ para perfil completo (45 campos)
  birthDate?: string
  preferredNumber?: number
  eligibilityStatus?: string
  biography?: string
  operatingTeam?: string
  supporterBrand?: string
  qualifying?: number
  racePace?: number
  start?: number
  overtake?: number
  tireManagement?: number
  energyManagement?: number
  feedback?: number
  pressure?: number
  concentration?: number
  resilience?: number
  aggressiveness?: number
  ambition?: number
  loyalty?: number
  professionalism?: number
  reputation?: number
  globalPopularity?: number
  localPopularity?: number
  localMarket?: string
  morale?: number
  moraleState?: number
  confidence?: number
  physicalCondition?: number
  stress?: number
  adaptability?: number
  adaptationF1?: number
  adaptationCar?: number
  adaptationTeam?: number
  revealedTraits?: string[]
  exitClauseUsd?: number
  winBonusUsd?: number
  totalTestMileageKm?: number
}

type QuickFilterType = 'all' | 'contracted' | 'market' | 'superlicense_yes' | 'superlicense_no'
type SortFieldType =
  | 'default'
  | 'name'
  | 'age'
  | 'overall'
  | 'market_value'
  | 'category'
  | 'availability'
  | 'superlicense'

export default function DriversPage() {
  const { team, season, refreshTeamAndSeason } = useAuth()
  const { toast } = useToast()

  const [dbDrivers, setDbDrivers] = useState<DriverModel[]>([])
  const [dbTeams, setDbTeams] = useState<TeamModel[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Filtros principais rápidos da barra de topo (mockup de referência)
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('all')

  // Filtros adicionais detalhados
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all')
  const [selectedAvailabilityFilter, setSelectedAvailabilityFilter] = useState<string>('all')
  const [selectedSuperlicenseFilter, setSelectedSuperlicenseFilter] = useState<string>('all')
  const [selectedPotentialFilter, setSelectedPotentialFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortFieldType>('default')
  const [sortAsc, setSortAsc] = useState<boolean>(true)

  // Piloto selecionado no painel lateral
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)

  // Modal de Perfil Completo (PilotProfileDialog MBJ existente)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false)
  const [selectedPilotForProfile, setSelectedPilotForProfile] = useState<UnifiedDriverItem | null>(
    null,
  )

  // Modal de Comparação de Pilotos
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState<boolean>(false)

  // Modal de Contratação e Negociação
  const [isContractingModalOpen, setIsContractingModalOpen] = useState<boolean>(false)
  const [selectedPilotForContract, setSelectedPilotForContract] =
    useState<UnifiedDriverItem | null>(null)
  const [isNegotiationModalOpen, setIsNegotiationModalOpen] = useState<boolean>(false)
  const [selectedPilotForNegotiation, setSelectedPilotForNegotiation] =
    useState<UnifiedDriverItem | null>(null)
  const [contractRole, setContractRole] = useState<'titular' | 'reserva'>('titular')
  const [contractMode, setContractMode] = useState<'immediate' | 'precontract'>('immediate')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Modal mobile para o painel lateral
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState<boolean>(false)

  // Carrega motoristas e equipes reais do banco
  const [driverTests, setDriverTests] = useState<any[]>([])

  const loadDatabaseData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [driversRes, teamsRes, testsRes] = await Promise.all([
        pb.collection('drivers').getFullList<DriverModel>({
          sort: '-speed',
        }),
        pb.collection('teams').getFullList<TeamModel>({
          sort: 'name',
        }),
        pb
          .collection('driver_tests')
          .getFullList({
            sort: '-created',
          })
          .catch(() => []),
      ])
      setDbDrivers(driversRes)
      setDbTeams(teamsRes)
      setDriverTests(testsRes)
    } catch (err) {
      console.error('Erro ao carregar pilotos/equipes do banco:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDatabaseData()
  }, [loadDatabaseData])

  // Rodada atual e ano da temporada do save
  const currentRound = season?.current_round || 1
  const seasonYear = season?.year || 2026
  const canPreContract = currentRound >= 12

  // Normalização unificada unindo banco PocketBase + dados catalogados do MBJ
  const unifiedDrivers: UnifiedDriverItem[] = useMemo(() => {
    // DRIVER-MORALE-01: Buscar dados canônicos da carreira se disponíveis
    const careerDriversMap = team?.id ? driverBase2026Service.getCareerDrivers(team.id) : null
    const mbjMap = new Map<string, (typeof MBJ_2026_PILOTS)[number]>()
    for (const pilot of MBJ_2026_PILOTS) {
      const canKey = getDriverCanonicalKey(pilot.name)
      if (!mbjMap.has(canKey)) {
        mbjMap.set(canKey, pilot)
      }
      mbjMap.set(pilot.name.toLowerCase().trim(), pilot)
    }

    const f1AcademyMap = new Map<string, (typeof OFFICIAL_F1_ACADEMY_MBJ_2026)[number]>()
    for (const pilot of OFFICIAL_F1_ACADEMY_MBJ_2026) {
      const canKey = getDriverCanonicalKey(pilot.name)
      if (!f1AcademyMap.has(canKey)) {
        f1AcademyMap.set(canKey, pilot)
      }
      f1AcademyMap.set(pilot.name.toLowerCase().trim(), pilot)
    }

    const teamById = new Map<string, TeamModel>()
    for (const t of dbTeams) {
      teamById.set(t.id, t)
    }

    const result: UnifiedDriverItem[] = []
    const visitedCanonicalKeys = new Set<string>()

    // 1. Processa todos os pilotos presentes no Banco de Dados
    for (const d of dbDrivers) {
      // Regra de exclusão estrita: "Robin Frijns WEC" deve ser ignorado
      if (
        d.name.toLowerCase().trim() === 'robin frijns wec' ||
        normalizeDriverNameToken(d.name) === 'robinfrijnswec'
      ) {
        continue
      }

      const canKey = getDriverCanonicalKey(d.name)

      if (visitedCanonicalKeys.has(canKey)) {
        continue
      }
      visitedCanonicalKeys.add(canKey)

      const mbjInfo = mbjMap.get(canKey) || mbjMap.get(d.name.toLowerCase().trim())
      const f1aInfo = f1AcademyMap.get(canKey) || f1AcademyMap.get(d.name.toLowerCase().trim())

      // BUG-INTEGRIDADE-05A: Consumo exclusivo via getActiveDriverTeamBinding
      const binding = getActiveDriverTeamBinding(d.id, season, dbDrivers, dbTeams)
      const teamId = binding.teamId
      const teamKey = binding.teamKey
      const teamName =
        binding.teamName ||
        (f1aInfo ? `${f1aInfo.operatingTeam} (${f1aInfo.supporterBrand})` : null)
      const teamColor = binding.teamColor || (f1aInfo ? '#EC4899' : '#E10600')

      const isPlayer = Boolean(
        team?.id &&
        (teamId === team.id ||
          (teamKey && team?.team_key && teamKey.toLowerCase() === team.team_key.toLowerCase())),
      )

      const cat = (d.category ||
        (f1aInfo ? 'f1_academy' : mbjInfo?.category || 'f1')) as UnifiedDriverItem['category']

      // Salário real vigente ou pretensão salarial para agentes livres
      const isContracted = Boolean((teamId || teamKey) && binding.role !== null)
      const rawSalary =
        d.salary || (f1aInfo ? f1aInfo.referenceAnnualUsd : mbjInfo ? mbjInfo.salaryUsd : 0)
      const salaryUsd = rawSalary > 100000000 ? Math.round(rawSalary / 5.75) : rawSalary

      // Cálculo de idade estritamente alinhado com o ano da temporada/save
      const seasonYear = season?.year || 2026
      let calculatedAge = d.age
      const birthDateStr = f1aInfo?.birthDate || mbjInfo?.birthDate
      if (birthDateStr) {
        const birthYear = parseInt(birthDateStr.split('-')[0], 10)
        if (!isNaN(birthYear)) {
          calculatedAge = seasonYear - birthYear
        }
      } else if (d.age && season?.year && season.year > 2026) {
        calculatedAge = d.age + (season.year - 2026)
      } else if (mbjInfo?.baseAge2026) {
        calculatedAge = mbjInfo.baseAge2026 + (seasonYear - 2026)
      }

      const speed = d.speed || f1aInfo?.speed || mbjInfo?.speed || 75
      const consistency = d.consistency || f1aInfo?.consistency || mbjInfo?.consistency || 75
      const rain = d.rain || f1aInfo?.rain || mbjInfo?.rain || 75
      const defense = d.defense || f1aInfo?.defense || mbjInfo?.defense || 75

      // Potencial canônico do piloto (perceived_potential do banco ou média min/max)
      const rawPotential =
        (d as any).perceived_potential ??
        (d as any).true_potential ??
        (d as any)?.procedural_data?.perceivedPotential
      const potentialMin = f1aInfo
        ? Math.round((f1aInfo.ceilings.speed + f1aInfo.ceilings.racePace) / 2) - 4
        : rawPotential !== undefined
          ? rawPotential
          : (mbjInfo?.potentialMin ?? Math.max(70, speed - 2))
      const potentialMax = f1aInfo
        ? Math.round((f1aInfo.ceilings.speed + f1aInfo.ceilings.racePace) / 2) + 3
        : rawPotential !== undefined
          ? rawPotential
          : (mbjInfo?.potentialMax ?? Math.min(99, speed + 6))
      const f1Races = mbjInfo?.f1RacesCompleted ?? (cat === 'f1' ? 20 : 0)
      const superlicense =
        mbjInfo?.superlicensePoints ?? (cat === 'f1' ? 50 : cat === 'f1_academy' ? 10 : 35)
      const isProspect =
        mbjInfo?.isAcademyProspect ||
        cat === 'f2' ||
        cat === 'f1_academy' ||
        d.is_academy ||
        (d.age < 22 && f1Races === 0)

      const canonicalDisplayName = getCanonicalDisplayName(d.name)
      const isAcademyDriver = Boolean(
        d.is_academy ||
        d.career_status === 'academy' ||
        (d as any)?.procedural_data?.careerStatus === 'academy',
      )
      const effectiveRole =
        (binding.role as any) || (isAcademyDriver ? ('academia' as const) : null)
      const effectiveTeamName =
        binding.teamName ||
        (isAcademyDriver && teamId && teamById.get(teamId) ? teamById.get(teamId)!.name : null)

      result.push({
        id: d.id,
        name: canonicalDisplayName,
        nationality: d.nationality || mbjInfo?.nationality || 'Mundial',
        age: calculatedAge,
        calculatedAge,
        isFreeAgent: !teamId && !teamKey && binding.status === 'free_agent' && !isAcademyDriver,
        speed,
        consistency,
        rain,
        defense,
        salaryUsd,
        contractEnd: d.contract_end || 2026,
        teamId,
        teamKey,
        teamName: effectiveTeamName,
        teamColor,
        role: (effectiveRole as any) || null,
        category: cat,
        potentialMin,
        potentialMax,
        potential:
          rawPotential !== undefined ? rawPotential : Math.round((potentialMin + potentialMax) / 2),
        f1RacesCompleted: f1Races,
        superlicensePoints: d.superlicense_points ?? superlicense,
        isAcademyProspect: Boolean(isProspect),
        isPlayerDriver: isPlayer,
        nextTeamId: d.next_team_id,
        nextContractRole: d.next_contract_role,
        rawDbRecord: d,
        adaptationF1:
          d.f1_adaptation ??
          f1aInfo?.adaptationF1 ??
          mbjInfo?.adaptationF1 ??
          (cat === 'f1' ? 90 : 60),

        birthDate: f1aInfo?.birthDate || mbjInfo?.birthDate,
        preferredNumber: f1aInfo?.academyNumber || mbjInfo?.preferredNumber,
        eligibilityStatus: f1aInfo
          ? 'F1 ACADEMY — BOLSA DE DESENVOLVIMENTO'
          : mbjInfo?.eligibilityStatus,
        biography: f1aInfo?.biography || mbjInfo?.biography,
        operatingTeam: f1aInfo?.operatingTeam,
        supporterBrand: f1aInfo?.supporterBrand,
        qualifying:
          f1aInfo?.qualifying ??
          mbjInfo?.qualifying ??
          Math.min(99, Math.max(50, speed + (speed > 85 ? 1 : -1))),
        racePace:
          f1aInfo?.racePace ??
          mbjInfo?.racePace ??
          Math.min(99, Math.max(50, Math.round((speed + consistency) / 2))),
        start: f1aInfo?.start ?? mbjInfo?.start ?? Math.min(99, Math.max(50, defense - 2)),
        overtake: f1aInfo?.overtake ?? mbjInfo?.overtake ?? Math.min(99, Math.max(50, speed - 1)),
        tireManagement:
          f1aInfo?.tires ?? mbjInfo?.tireManagement ?? Math.min(99, Math.max(50, consistency)),
        energyManagement:
          f1aInfo?.energy ??
          mbjInfo?.energyManagement ??
          Math.min(99, Math.max(50, consistency - 1)),
        feedback:
          f1aInfo?.feedback ?? mbjInfo?.feedback ?? Math.min(99, Math.max(50, consistency + 2)),
        pressure: f1aInfo?.pressure ?? mbjInfo?.pressure ?? Math.min(99, Math.max(50, speed - 2)),
        concentration:
          f1aInfo?.concentration ??
          mbjInfo?.concentration ??
          Math.min(99, Math.max(50, consistency)),
        resilience:
          f1aInfo?.resilience ?? mbjInfo?.resilience ?? Math.min(99, Math.max(50, defense)),
        aggressiveness: f1aInfo?.aggressiveness ?? mbjInfo?.aggressiveness ?? 70,
        ambition: f1aInfo?.ambition ?? mbjInfo?.ambition ?? 80,
        loyalty: f1aInfo?.loyalty ?? mbjInfo?.loyalty ?? 75,
        professionalism: f1aInfo?.professionalism ?? mbjInfo?.professionalism ?? 85,
        reputation: f1aInfo?.reputation ?? mbjInfo?.reputation ?? Math.min(99, Math.max(50, speed)),
        globalPopularity:
          f1aInfo?.globalPopularity ??
          mbjInfo?.globalPopularity ??
          Math.min(99, Math.max(40, speed - 5)),
        localPopularity:
          f1aInfo?.localPopularity ??
          mbjInfo?.localPopularity ??
          Math.min(100, Math.max(60, speed + 10)),
        localMarket: f1aInfo?.localMarket || mbjInfo?.localMarket,
        morale:
          careerDriversMap?.[d.id]?.morale ??
          d.morale ??
          f1aInfo?.morale ??
          mbjInfo?.moraleState ??
          75,
        moraleState:
          careerDriversMap?.[d.id]?.morale ??
          d.morale ??
          f1aInfo?.morale ??
          mbjInfo?.moraleState ??
          75,
        confidence: f1aInfo?.confidence ?? mbjInfo?.confidence ?? 75,
        physicalCondition:
          d.physical_condition || f1aInfo?.condition || mbjInfo?.physicalCondition || 100,
        stress: f1aInfo?.stress ?? mbjInfo?.stress ?? 25,
        adaptability: f1aInfo?.adaptability ?? mbjInfo?.adaptability ?? 80,
        adaptationCar: f1aInfo?.carAdaptation ?? mbjInfo?.adaptationCar ?? 80,
        adaptationTeam: f1aInfo?.teamAdaptation ?? mbjInfo?.adaptationTeam ?? 80,
        revealedTraits: f1aInfo
          ? f1aInfo.traits.map((t) => `${t.name} (${t.code}) - ${t.revealedStatus}`)
          : mbjInfo?.revealedTraits,
        exitClauseUsd: mbjInfo?.exitClauseUsd ?? Math.round(salaryUsd * 2.5),
        winBonusUsd: mbjInfo?.winBonusUsd ?? Math.round(salaryUsd * 0.08),
      })
    }

    // 2. Incorpora pilotos MBJ não cadastrados no banco para catálogo estático
    const currentSeasonYear = season?.year || 2026
    for (const pilot of MBJ_2026_PILOTS) {
      // Regra de exclusão estrita: "Robin Frijns WEC" deve ser ignorado
      if (
        pilot.name.toLowerCase().trim() === 'robin frijns wec' ||
        normalizeDriverNameToken(pilot.name) === 'robinfrijnswec'
      ) {
        continue
      }

      const canKey = getDriverCanonicalKey(pilot.name)
      const normName = pilot.name.toLowerCase().trim()
      const normCanKey = normalizeDriverNameToken(getCanonicalDisplayName(pilot.name))
      if (
        visitedCanonicalKeys.has(canKey) ||
        visitedCanonicalKeys.has(normName) ||
        visitedCanonicalKeys.has(normCanKey)
      ) {
        continue
      }
      visitedCanonicalKeys.add(canKey)

      // BUG-RETRATOS-03C2: Pilotos MBJ estáticos não vinculados a contrato ativo -> Free Agent estrito
      const mbjBinding = getActiveDriverTeamBinding(pilot.id, season, dbDrivers, dbTeams)
      const calculatedMbjAge = pilot.baseAge2026
        ? pilot.baseAge2026 + (currentSeasonYear - 2026)
        : pilot.age

      const canonicalDisplayName = getCanonicalDisplayName(pilot.name)
      result.push({
        id: pilot.id,
        name: canonicalDisplayName,
        nationality: pilot.nationality,
        age: calculatedMbjAge,
        calculatedAge: calculatedMbjAge,
        isFreeAgent: Boolean(
          !mbjBinding.teamId && !mbjBinding.teamKey && mbjBinding.status === 'free_agent',
        ),
        speed: pilot.speed,
        consistency: pilot.consistency,
        rain: pilot.rain,
        defense: pilot.defense,
        salaryUsd: pilot.salaryUsd,
        contractEnd: 2026 + (pilot.contractYears || 1),
        teamId: mbjBinding.teamId,
        teamKey: mbjBinding.teamKey,
        teamName: mbjBinding.teamName,
        teamColor: mbjBinding.teamColor || '#E10600',
        role: (mbjBinding.role as any) || null,
        category: pilot.category,
        potentialMin: pilot.potentialMin,
        potentialMax: pilot.potentialMax,
        potential:
          pilot.potentialMin !== undefined && pilot.potentialMax !== undefined
            ? Math.round((pilot.potentialMin + pilot.potentialMax) / 2)
            : undefined,
        f1RacesCompleted: pilot.f1RacesCompleted,
        superlicensePoints: pilot.superlicensePoints,
        isAcademyProspect: Boolean(pilot.isAcademyProspect || pilot.category === 'f2'),
        isPlayerDriver: false,

        birthDate: pilot.birthDate,
        preferredNumber: pilot.preferredNumber,
        eligibilityStatus: pilot.eligibilityStatus,
        biography: pilot.biography,
        qualifying: pilot.qualifying ?? pilot.speed,
        racePace: pilot.racePace ?? Math.round((pilot.speed + pilot.consistency) / 2),
        start: pilot.start ?? pilot.defense - 2,
        overtake: pilot.overtake ?? pilot.speed - 1,
        tireManagement: pilot.tireManagement ?? pilot.consistency,
        energyManagement: pilot.energyManagement ?? pilot.consistency - 1,
        feedback: pilot.feedback ?? pilot.consistency + 2,
        pressure: pilot.pressure ?? pilot.speed - 2,
        concentration: pilot.concentration ?? pilot.consistency,
        resilience: pilot.resilience ?? pilot.defense,
        aggressiveness: pilot.aggressiveness ?? 70,
        ambition: pilot.ambition ?? 80,
        loyalty: pilot.loyalty ?? 75,
        professionalism: pilot.professionalism ?? 85,
        reputation: pilot.reputation ?? pilot.speed,
        globalPopularity: pilot.globalPopularity ?? Math.max(30, pilot.speed - 10),
        localPopularity: pilot.localPopularity ?? Math.min(100, pilot.speed + 10),
        localMarket: pilot.localMarket,
        moraleState: careerDriversMap?.[pilot.id]?.morale ?? pilot.moraleState ?? 75,
        confidence: pilot.confidence ?? 75,
        physicalCondition: pilot.physicalCondition ?? 100,
        stress: pilot.stress ?? 25,
        adaptability: pilot.adaptability ?? 80,
        adaptationF1: pilot.adaptationF1 ?? (pilot.category === 'f1' ? 90 : 60),
        adaptationCar: pilot.adaptationCar ?? 80,
        adaptationTeam: pilot.adaptationTeam ?? 80,
        revealedTraits: pilot.revealedTraits,
        exitClauseUsd: pilot.exitClauseUsd ?? Math.round(pilot.salaryUsd * 2.5),
        winBonusUsd: pilot.winBonusUsd ?? Math.round(pilot.salaryUsd * 0.08),
      })
    }

    return result
  }, [dbDrivers, dbTeams, team, season])

  // Helper canônico de Superlicença
  const checkDriverSuperlicense = useCallback((pilot: UnifiedDriverItem): boolean => {
    if ((pilot.rawDbRecord as any)?.has_superlicense !== undefined) {
      return Boolean((pilot.rawDbRecord as any).has_superlicense)
    }
    if (pilot.category === 'f1' && (pilot.teamId || pilot.teamKey || pilot.f1RacesCompleted > 0)) {
      return true
    }
    return (pilot.superlicensePoints ?? 0) >= 40
  }, [])

  // Helper de categoria amigável
  const formatCategoryLabel = useCallback((category: string): string => {
    switch (category) {
      case 'f1':
        return 'F1'
      case 'f2':
        return 'F2'
      case 'f3':
        return 'F3'
      case 'indycar':
        return 'IndyCar'
      case 'indynxt':
        return 'Indy NXT'
      case 'formula_e':
        return 'Formula E'
      case 'nascar':
        return 'NASCAR'
      case 'prototipos':
      case 'wec':
        return 'WEC'
      case 'f1_academy':
        return 'Academy'
      case 'mercado':
      default:
        return 'Livre'
    }
  }, [])

  // Contadores dinâmicos do topo
  const dynamicCounts = useMemo(() => {
    let contractedCount = 0
    let marketCount = 0
    let superlicenseCount = 0
    let noSuperlicenseCount = 0

    for (const p of unifiedDrivers) {
      const isProfContracted = Boolean(
        (p.teamId || p.teamKey) && p.role !== null && (p.role as string) !== 'academia',
      )
      if (isProfContracted) {
        contractedCount++
      } else {
        marketCount++
      }

      if (checkDriverSuperlicense(p)) {
        superlicenseCount++
      } else {
        noSuperlicenseCount++
      }
    }

    return {
      total: unifiedDrivers.length,
      contracted: contractedCount,
      market: marketCount,
      superlicense: superlicenseCount,
      noSuperlicense: noSuperlicenseCount,
    }
  }, [unifiedDrivers, checkDriverSuperlicense])

  // Lista Filtrada
  const filteredDrivers = useMemo(() => {
    let list = unifiedDrivers.filter((pilot) => {
      const hasSl = checkDriverSuperlicense(pilot)
      const isProfContracted = Boolean(
        (pilot.teamId || pilot.teamKey) &&
        pilot.role !== null &&
        (pilot.role as string) !== 'academia',
      )

      // 1. Filtro rápido do topo
      if (quickFilter === 'contracted' && !isProfContracted) return false
      if (quickFilter === 'market' && isProfContracted) return false
      if (quickFilter === 'superlicense_yes' && !hasSl) return false
      if (quickFilter === 'superlicense_no' && hasSl) return false

      // 2. Busca por nome, nacionalidade ou aliases conhecidos
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const normQuery = normalizeDriverNameToken(query)
        const normPilotName = normalizeDriverNameToken(pilot.name)
        const matchesName =
          pilot.name.toLowerCase().includes(query) ||
          (normQuery.length >= 3 && normPilotName.includes(normQuery))
        const matchesNat = pilot.nationality.toLowerCase().includes(query)

        // Suporte a alias de busca: se query normalizada bater com variante de nome
        const aliasCanonicalName = getCanonicalDisplayName(query)
        const matchesAlias =
          aliasCanonicalName && pilot.name.toLowerCase() === aliasCanonicalName.toLowerCase()

        if (!matchesName && !matchesNat && !matchesAlias) return false
      }
      // 3. Filtro de Categoria
      if (selectedCategoryFilter !== 'all') {
        if (selectedCategoryFilter === 'wec' || selectedCategoryFilter === 'prototipos') {
          if (pilot.category !== 'wec' && pilot.category !== 'prototipos') return false
        } else if (pilot.category !== selectedCategoryFilter) {
          return false
        }
      }

      // 4. Filtro de Equipe (BUG-RETRATOS-03C2: checagem estrita contra binding canônico)
      if (selectedTeamFilter !== 'all') {
        if (selectedTeamFilter === 'free_agents') {
          if (pilot.teamId || pilot.teamKey) return false
        } else {
          const targetFilterLower = selectedTeamFilter.toLowerCase().trim()
          const pilotKeyLower = pilot.teamKey ? pilot.teamKey.toLowerCase().trim() : null
          const pilotId = pilot.teamId || null

          // Match estrito por runtime ID ou team_key canônica
          const rawRec = pilot.rawDbRecord as any
          const matchesTeam =
            (pilotId && pilotId === selectedTeamFilter) ||
            (pilotKeyLower && pilotKeyLower === targetFilterLower) ||
            (rawRec?.academy_origin_team_id &&
              rawRec.academy_origin_team_id === selectedTeamFilter) ||
            (rawRec?.procedural_data?.currentAcademyTeamId &&
              rawRec.procedural_data.currentAcademyTeamId === selectedTeamFilter)

          if (!matchesTeam) return false
        }
      }

      // 5. Filtro de Disponibilidade
      if (selectedAvailabilityFilter !== 'all') {
        const isContracted = isProfContracted
        if (selectedAvailabilityFilter === 'available' && isContracted) return false
        if (selectedAvailabilityFilter === 'unavailable' && !isContracted) return false
      }

      // 6. Filtro de Superlicença
      if (selectedSuperlicenseFilter !== 'all') {
        if (selectedSuperlicenseFilter === 'yes' && !hasSl) return false
        if (selectedSuperlicenseFilter === 'no' && hasSl) return false
      }

      // 7. Filtro de Potencial canônico (DRIVERS-POTENTIAL-FILTER-01)
      if (!filterByPotential(pilot, selectedPotentialFilter)) {
        return false
      }

      return true
    })

    // Ordenação canônica
    list.sort((a, b) => {
      let comp = 0
      if (sortField === 'name') {
        comp = a.name.localeCompare(b.name)
      } else if (sortField === 'age') {
        comp = a.age - b.age
      } else if (sortField === 'overall') {
        comp = getOverallRating(b) - getOverallRating(a)
      } else if (sortField === 'market_value') {
        comp = b.salaryUsd - a.salaryUsd
      } else if (sortField === 'category') {
        comp = a.category.localeCompare(b.category)
      } else if (sortField === 'availability') {
        const aFree = !a.teamId && !a.teamKey ? 1 : 0
        const bFree = !b.teamId && !b.teamKey ? 1 : 0
        comp = bFree - aFree
      } else if (sortField === 'superlicense') {
        const aSl = checkDriverSuperlicense(a) ? 1 : 0
        const bSl = checkDriverSuperlicense(b) ? 1 : 0
        comp = bSl - aSl
      } else {
        // Padrão: Sob contrato primeiro (por OVR desc), depois mercado livre por OVR desc
        const aContracted = Boolean((a.teamId || a.teamKey) && a.role !== null)
        const bContracted = Boolean((b.teamId || b.teamKey) && b.role !== null)
        if (aContracted !== bContracted) {
          return aContracted ? -1 : 1
        }
        return getOverallRating(b) - getOverallRating(a)
      }

      return sortAsc ? comp : -comp
    })

    return list
  }, [
    unifiedDrivers,
    quickFilter,
    searchQuery,
    selectedCategoryFilter,
    selectedTeamFilter,
    selectedAvailabilityFilter,
    selectedSuperlicenseFilter,
    selectedPotentialFilter,
    sortField,
    sortAsc,
    checkDriverSuperlicense,
  ])

  // Seleciona o primeiro piloto por padrão se nenhum estiver selecionado
  useEffect(() => {
    if (!selectedDriverId && filteredDrivers.length > 0) {
      setSelectedDriverId(filteredDrivers[0].id)
    }
  }, [filteredDrivers, selectedDriverId])

  // Piloto atualmente ativo no painel lateral
  const activeSideDriver = useMemo(() => {
    if (!selectedDriverId) return filteredDrivers[0] || null
    return (
      filteredDrivers.find((d) => d.id === selectedDriverId) ||
      unifiedDrivers.find((d) => d.id === selectedDriverId) ||
      null
    )
  }, [selectedDriverId, filteredDrivers, unifiedDrivers])

  // Estatísticas de F1 canônicas do piloto ativo (SOMENTE FÓRMULA 1)
  const activeDriverTestKm = useMemo(() => {
    if (!activeSideDriver) return 0
    return calculateDriverTotalTestMileage(activeSideDriver.id, driverTests)
  }, [activeSideDriver, driverTests])

  const activeF1Stats = useMemo(() => {
    if (!activeSideDriver) {
      return { races: 0, wins: 0, poles: 0, championships: 0 }
    }
    const mbjPilot = MBJ_2026_PILOTS.find(
      (p) =>
        p.id === activeSideDriver.id ||
        p.name.toLowerCase().trim() === activeSideDriver.name.toLowerCase().trim(),
    )
    const mbjStats = getDriverCareerStats({ pilot: mbjPilot || (activeSideDriver as any) })
    const raw = activeSideDriver.rawDbRecord as any

    const races =
      raw?.f1_career_starts ??
      mbjStats.races ??
      (activeSideDriver.category === 'f1' ? activeSideDriver.f1RacesCompleted : 0)

    const wins = raw?.f1_career_wins ?? mbjStats.wins ?? 0
    const poles = raw?.f1_career_poles ?? mbjStats.poles ?? 0
    const championships = raw?.f1_career_titles ?? mbjStats.championships ?? 0

    return { races, wins, poles, championships }
  }, [activeSideDriver])

  const selectedPilotVisualIdentity = useMemo(() => {
    if (!selectedPilotForContract) return null
    return (
      (selectedPilotForContract as any)?.procedural_data?.visualIdentity ||
      (selectedPilotForContract as any)?.visualIdentity ||
      null
    )
  }, [selectedPilotForContract])

  // Faixa de mercado e status do piloto ativo
  const activeMarketRange = useMemo(() => {
    if (!activeSideDriver) {
      return {
        displayRange: 'US$ 1,0 M – US$ 3,0 M',
        minAnnualSalary: 1000000,
        maxAnnualSalary: 3000000,
      }
    }
    return driverContractService.estimateMarketValueRange(activeSideDriver as any)
  }, [activeSideDriver])

  const activeDriverHasSl = useMemo(() => {
    if (!activeSideDriver) return false
    return checkDriverSuperlicense(activeSideDriver)
  }, [activeSideDriver, checkDriverSuperlicense])

  const activeContractStatusInfo = useMemo(() => {
    if (!activeSideDriver) {
      return { label: 'Indisponível', type: 'contracted' as const }
    }
    const rawRec = activeSideDriver.rawDbRecord as any
    const isAcademy = Boolean(
      rawRec?.is_academy ||
      rawRec?.career_status === 'academy' ||
      rawRec?.procedural_data?.careerStatus === 'academy' ||
      (activeSideDriver.role as string) === 'academia',
    )
    const hasProfessionalContract = Boolean(
      rawRec?.canonical_contract?.status === 'active' ||
      rawRec?.role === 'titular' ||
      rawRec?.role === 'reserva',
    )
    if (
      isAcademy &&
      !hasProfessionalContract &&
      ((activeSideDriver.role as string) === 'academia' || !activeSideDriver.role)
    ) {
      return { label: 'Academia', type: 'reserve' as const }
    }
    const hasCurrentTeam = Boolean(
      activeSideDriver.teamId || activeSideDriver.teamKey || activeSideDriver.teamName,
    )
    const isContracted = Boolean(hasCurrentTeam && activeSideDriver.role !== null)
    if (activeSideDriver.role === 'reserva') {
      return { label: 'Reserva', type: 'reserve' as const }
    }
    if ((activeSideDriver.role as string) === 'academia') {
      return { label: 'Academia', type: 'reserve' as const }
    }
    if (isContracted || hasCurrentTeam) {
      return { label: 'Sob contrato', type: 'contracted' as const }
    }
    return { label: 'Agente livre', type: 'free' as const }
  }, [activeSideDriver])

  // Limpa todos os filtros
  const handleClearFilters = () => {
    setQuickFilter('all')
    setSearchQuery('')
    setSelectedCategoryFilter('all')
    setSelectedTeamFilter('all')
    setSelectedAvailabilityFilter('all')
    setSelectedSuperlicenseFilter('all')
    setSelectedPotentialFilter('all')
    setSortField('default')
    setSortAsc(true)
  }

  // Abertura do perfil do piloto ao clicar
  const handleOpenPilotProfile = (pilot: UnifiedDriverItem) => {
    const pilotTestKm = calculateDriverTotalTestMileage(pilot.id, driverTests)
    setSelectedPilotForProfile({
      ...pilot,
      totalTestMileageKm: pilotTestKm,
    })
    setIsProfileModalOpen(true)
  }

  // Abertura do modal de contratação
  const handleOpenContractModal = (pilot: UnifiedDriverItem) => {
    setSelectedPilotForContract(pilot)
    const eligibility = checkEligibility(pilot)
    if (!eligibility.canSignTitular && eligibility.canSignReserve) {
      setContractRole('reserva')
    } else {
      setContractRole('titular')
    }
    if (canPreContract) {
      setContractMode('precontract')
    } else {
      setContractMode('immediate')
    }
    setIsContractingModalOpen(true)
  }

  // Confirmação de contrato
  const handleConfirmContract = async () => {
    if (!selectedPilotForContract || !team) {
      toast({
        title: 'Erro na contratação',
        description: 'Equipe ou piloto não identificado.',
        variant: 'destructive',
      })
      return
    }

    const eligibility = checkEligibility(selectedPilotForContract)
    if (contractRole === 'titular' && !eligibility.canSignTitular) {
      toast({
        title: 'Contratação titular não permitida',
        description:
          'Pilotos menores de 18 anos só podem assumir posições de desenvolvimento ou reserva na academia.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const { driverHiringService } = await import('@/services/driverHiringService')
      await driverHiringService.executeDriverHire({
        driver: selectedPilotForContract,
        team,
        contractRole,
        contractMode,
        seasonYear,
        currentRound,
        durationYears: 1,
        customSalaryUsd: selectedPilotForContract.salaryUsd,
      })

      toast({
        title: 'Operação Contratual Concluída!',
        description:
          contractMode === 'precontract'
            ? `Pré-contrato com ${selectedPilotForContract.name} registrado para a próxima temporada da ${team.name}.`
            : `${selectedPilotForContract.name} agora faz parte do plantel oficial da ${team.name} como ${contractRole}.`,
      })

      setIsContractingModalOpen(false)
      setSelectedPilotForContract(null)
      await Promise.all([loadDatabaseData(), refreshTeamAndSeason?.()])
    } catch (err: any) {
      toast({
        title: 'Falha ao processar contrato',
        description: err?.message || 'Não foi possível registrar o piloto.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Pilotos
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Mercado, contratos, superlicença e comparação de talentos.
          </p>
        </div>

        {/* Card de dica contextual limpo */}
        <div className="flex items-center gap-2.5 bg-sky-50 border border-sky-100 px-3.5 py-2 rounded-xl text-sky-800 text-xs shadow-2xs">
          <Info className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            Clique em um piloto para ver seus detalhes, estatísticas e opções de negociação.
          </span>
        </div>
      </div>

      {/* INDICADORES DINÂMICOS DO TOPO / FILTROS RÁPIDOS */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* TODOS */}
        <Button
          type="button"
          onClick={() => setQuickFilter('all')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
            quickFilter === 'all'
              ? 'bg-[#E10600] text-white hover:bg-[#c00500]'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5 mr-1.5" />
          Todos ({dynamicCounts.total})
        </Button>

        {/* SOB CONTRATO */}
        <Button
          type="button"
          onClick={() => setQuickFilter('contracted')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
            quickFilter === 'contracted'
              ? 'bg-[#E10600] text-white hover:bg-[#c00500]'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
          Sob contrato ({dynamicCounts.contracted})
        </Button>

        {/* MERCADO */}
        <Button
          type="button"
          onClick={() => setQuickFilter('market')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
            quickFilter === 'market'
              ? 'bg-[#E10600] text-white hover:bg-[#c00500]'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Search className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
          Mercado ({dynamicCounts.market})
        </Button>

        {/* COM SUPERLICENÇA */}
        <Button
          type="button"
          onClick={() => setQuickFilter('superlicense_yes')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
            quickFilter === 'superlicense_yes'
              ? 'bg-[#E10600] text-white hover:bg-[#c00500]'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
          Com superlicença ({dynamicCounts.superlicense})
        </Button>

        {/* SEM SUPERLICENÇA */}
        <Button
          type="button"
          onClick={() => setQuickFilter('superlicense_no')}
          className={`h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
            quickFilter === 'superlicense_no'
              ? 'bg-[#E10600] text-white hover:bg-[#c00500]'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
          Sem superlicença ({dynamicCounts.noSuperlicense})
        </Button>
      </div>

      {/* BARRA DE FILTROS ADICIONAIS & BUSCA */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        {/* Campo de Busca por Nome */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Buscar piloto por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl text-xs"
          />
        </div>

        {/* Dropdowns de Filtro */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-2">
          {/* Categoria */}
          <div className="w-full lg:w-44">
            <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
              <SelectTrigger className="h-10 text-xs bg-slate-50/70 border-slate-200 text-slate-700 rounded-xl">
                <SelectValue placeholder="Categoria atual" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-800">
                <SelectItem value="all">Todas Categorias</SelectItem>
                <SelectItem value="f1">Fórmula 1</SelectItem>
                <SelectItem value="f2">Fórmula 2</SelectItem>
                <SelectItem value="f3">Fórmula 3</SelectItem>
                <SelectItem value="indycar">IndyCar</SelectItem>
                <SelectItem value="formula_e">Formula E</SelectItem>
                <SelectItem value="wec">WEC / Protótipos</SelectItem>
                <SelectItem value="f1_academy">Academy / Desenvolvimento</SelectItem>
                <SelectItem value="mercado">Livre / Sem cat.</SelectItem>
              </SelectContent>{' '}
            </Select>
          </div>

          {/* Equipe */}
          <div className="w-full lg:w-44">
            <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
              <SelectTrigger className="h-10 text-xs bg-slate-50/70 border-slate-200 text-slate-700 rounded-xl">
                <SelectValue placeholder="Equipe" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-800 max-h-60">
                <SelectItem value="all">Todas as Equipes</SelectItem>
                <SelectItem value="free_agents">Agentes Livres</SelectItem>
                {ALL_GRID_TEAMS_DATABASE.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Disponibilidade */}
          <div className="w-full lg:w-36">
            <Select
              value={selectedAvailabilityFilter}
              onValueChange={setSelectedAvailabilityFilter}
            >
              <SelectTrigger className="h-10 text-xs bg-slate-50/70 border-slate-200 text-slate-700 rounded-xl">
                <SelectValue placeholder="Disponibilidade" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-800">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="available">Disponível</SelectItem>
                <SelectItem value="unavailable">Indisponível</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Superlicença */}
          <div className="w-full lg:w-36">
            <Select
              value={selectedSuperlicenseFilter}
              onValueChange={setSelectedSuperlicenseFilter}
            >
              <SelectTrigger className="h-10 text-xs bg-slate-50/70 border-slate-200 text-slate-700 rounded-xl">
                <SelectValue placeholder="Superlicença" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-800">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="yes">Com licença (Sim)</SelectItem>
                <SelectItem value="no">Sem licença (Não)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Potencial */}
          <div className="w-full lg:w-36">
            <Select value={selectedPotentialFilter} onValueChange={setSelectedPotentialFilter}>
              <SelectTrigger className="h-10 text-xs bg-slate-50/70 border-slate-200 text-slate-700 rounded-xl">
                <SelectValue placeholder="Potencial" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-800">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="90_100">90–100</SelectItem>
                <SelectItem value="80_89">80–89</SelectItem>
                <SelectItem value="70_79">70–79</SelectItem>
                <SelectItem value="60_69">60–69</SelectItem>
                <SelectItem value="below_60">Abaixo de 60</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botão Limpar filtros */}
          <Button
            type="button"
            variant="ghost"
            onClick={handleClearFilters}
            className="h-10 px-3 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl font-medium shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar filtros</span>
          </Button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL: LISTA COMPACTA À ESQUERDA + PAINEL LATERAL À DIREITA */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400 space-y-3 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-[#E10600]" />
          <p className="text-sm font-medium">Carregando catálogo de pilotos...</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row items-start gap-5">
          {/* COLUNA ESQUERDA: LISTA / TABELA COMPACTA */}
          <div className="w-full lg:flex-1 bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
            {/* Header da Tabela com exatamente quatro colunas canônicas */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    {/* Coluna 1: Nome do piloto */}
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-slate-900 transition-colors"
                      onClick={() => {
                        if (sortField === 'name') setSortAsc(!sortAsc)
                        else {
                          setSortField('name')
                          setSortAsc(true)
                        }
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Nome do piloto</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </div>
                    </th>

                    {/* Coluna 2: Nacionalidade */}
                    <th className="py-3 px-3">
                      <span>Nacionalidade</span>
                    </th>

                    {/* Coluna 3: Idade */}
                    <th
                      className="py-3 px-3 text-center w-20 cursor-pointer hover:text-slate-900 transition-colors"
                      onClick={() => {
                        if (sortField === 'age') setSortAsc(!sortAsc)
                        else {
                          setSortField('age')
                          setSortAsc(true)
                        }
                      }}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Idade</span>
                        <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                      </div>
                    </th>

                    {/* Coluna 4: Salário anual */}
                    <th
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors"
                      onClick={() => {
                        if (sortField === 'market_value') setSortAsc(!sortAsc)
                        else {
                          setSortField('market_value')
                          setSortAsc(false)
                        }
                      }}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Salário anual</span>
                        <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDrivers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        Nenhum piloto encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredDrivers.map((pilot) => {
                      const isSelected = selectedDriverId === pilot.id
                      const isContracted = Boolean(
                        (pilot.teamId || pilot.teamKey) && pilot.role !== null,
                      )
                      const flagEmoji = resolveCountryFlag(pilot.nationality)
                      const countryLabel = countryName(pilot.nationality) || pilot.nationality

                      return (
                        <tr
                          key={pilot.id}
                          data-driver-id={pilot.id}
                          data-driver-name={pilot.name}
                          onClick={() => {
                            setSelectedDriverId(pilot.id)
                            if (window.innerWidth < 1024) {
                              setIsMobilePanelOpen(true)
                            }
                          }}
                          className={`cursor-pointer transition-colors group select-none ${
                            isSelected
                              ? 'bg-red-50/80 font-medium'
                              : 'hover:bg-slate-50/80 bg-white'
                          }`}
                        >
                          {/* 1. Nome do piloto (clicável para abrir a ficha completa) */}
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedDriverId(pilot.id)
                                handleOpenPilotProfile(pilot)
                              }}
                              className="text-left font-bold text-slate-900 hover:text-[#E10600] transition-colors underline-offset-2 hover:underline focus:outline-none"
                            >
                              {pilot.name}
                            </button>
                          </td>

                          {/* 2. Nacionalidade: bandeira emoji + identificação do país */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              <CountryFlag
                                code={(pilot as any).nationalities || pilot.nationality}
                                className="text-base leading-none select-none"
                              />
                              <span className="text-slate-700 text-xs font-medium truncate">
                                {countryLabel}
                              </span>
                            </div>
                          </td>

                          {/* 3. Idade (calculada pela data da carreira/save) */}
                          <td className="py-3 px-3 text-center text-slate-600 font-mono text-xs">
                            {pilot.age}
                          </td>

                          {/* 4. Salário anual: moeda e periodicidade */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {pilot.salaryUsd > 0 ? (
                              <div className="flex flex-col items-end">
                                <span className="font-mono font-bold text-slate-900 text-xs">
                                  {formatUsdCurrency(pilot.salaryUsd, 'full')} / ano
                                </span>
                                {!isContracted && (
                                  <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-1 rounded border border-amber-200 mt-0.5">
                                    pretensão
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Rodapé da tabela com contagem */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>
                Mostrando <strong>{filteredDrivers.length}</strong> de{' '}
                <strong>{unifiedDrivers.length}</strong> pilotos no universo
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Clique na linha para fixar no painel lateral
              </span>
            </div>
          </div>

          {/* COLUNA DIREITA: PAINEL LATERAL EM DESKTOP (~35-42% da largura) */}
          <div className="hidden lg:block w-[380px] xl:w-[420px] shrink-0 sticky top-6">
            <DriverSidePanel
              driver={activeSideDriver}
              f1CareerStats={activeF1Stats}
              marketRange={activeMarketRange}
              hasSuperlicense={activeDriverHasSl}
              contractStatusLabel={activeContractStatusInfo.label}
              contractStatusType={activeContractStatusInfo.type}
              categoryLabel={formatCategoryLabel(activeSideDriver?.category || 'f1')}
              isPlayerDriverTeam={activeSideDriver?.isPlayerDriver}
              totalTestMileageKm={activeDriverTestKm}
              visualIdentity={
                (activeSideDriver as any)?.procedural_data?.visualIdentity ||
                (activeSideDriver as any)?.visualIdentity ||
                null
              }
              onOpenFullProfile={(d) => handleOpenPilotProfile(d)}
              onCompareDriver={() => setIsComparisonModalOpen(true)}
              onOpenContract={(d) => handleOpenContractModal(d)}
              onOpenNegotiation={(d) => {
                setSelectedPilotForNegotiation(d)
                setIsNegotiationModalOpen(true)
              }}
            />
          </div>
        </div>
      )}

      {/* PAINEL LATERAL NO MOBILE (Modal / Sheet Drawer) */}
      <Dialog open={isMobilePanelOpen} onOpenChange={setIsMobilePanelOpen}>
        <DialogContent className="max-w-md w-[95vw] p-0 bg-transparent border-none shadow-none max-h-[90vh]">
          <DriverSidePanel
            driver={activeSideDriver}
            f1CareerStats={activeF1Stats}
            marketRange={activeMarketRange}
            hasSuperlicense={activeDriverHasSl}
            contractStatusLabel={activeContractStatusInfo.label}
            contractStatusType={activeContractStatusInfo.type}
            categoryLabel={formatCategoryLabel(activeSideDriver?.category || 'f1')}
            isPlayerDriverTeam={activeSideDriver?.isPlayerDriver}
            totalTestMileageKm={activeDriverTestKm}
            visualIdentity={
              (activeSideDriver as any)?.procedural_data?.visualIdentity ||
              (activeSideDriver as any)?.visualIdentity ||
              null
            }
            isMobileModal={true}
            onClose={() => setIsMobilePanelOpen(false)}
            onOpenFullProfile={(d) => {
              setIsMobilePanelOpen(false)
              handleOpenPilotProfile(d)
            }}
            onCompareDriver={() => {
              setIsMobilePanelOpen(false)
              setIsComparisonModalOpen(true)
            }}
            onOpenContract={(d) => {
              setIsMobilePanelOpen(false)
              handleOpenContractModal(d)
            }}
            onOpenNegotiation={(d) => {
              setIsMobilePanelOpen(false)
              setSelectedPilotForNegotiation(d)
              setIsNegotiationModalOpen(true)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* MODAL DE COMPARAÇÃO DE PILOTOS */}
      <DriverComparisonModal
        open={isComparisonModalOpen}
        onOpenChange={setIsComparisonModalOpen}
        primaryDriver={activeSideDriver}
        allDrivers={unifiedDrivers}
      />

      {/* MODAL DE PERFIL COMPLETO DO PILOTO (V/P/O — Ficha Completa já existente) */}
      <PilotProfileDialog
        pilot={selectedPilotForProfile}
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
        onOpenContractModal={(pilot) => handleOpenContractModal(pilot)}
        currentRound={currentRound}
      />

      {/* MODAL CANÔNICO DE NEGOCIAÇÃO DE CONTRATO */}
      {selectedPilotForNegotiation && team && (
        <DriverNegotiationModal
          open={isNegotiationModalOpen}
          onOpenChange={setIsNegotiationModalOpen}
          driver={selectedPilotForNegotiation as any}
          playerTeam={team}
          currentRound={currentRound}
          seasonYear={season?.year || 2026}
          onContractSigned={async () => {
            await Promise.all([loadDatabaseData(), refreshTeamAndSeason?.()])
          }}
        />
      )}

      {/* MODAL DE FORMALIZAÇÃO DE CONTRATO */}
      <Dialog open={isContractingModalOpen} onOpenChange={setIsContractingModalOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-lg rounded-2xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#E10600]" />
              Formalizar Proposta Contratual
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Vincule o piloto à sua equipe ({team?.name || 'Sua Equipe'}). O registro será
              persistido no save com atualização direta do orçamento em US$.
            </DialogDescription>
          </DialogHeader>

          {selectedPilotForContract && (
            <div className="space-y-4 py-2">
              <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-20 aspect-[3/4] rounded-lg overflow-hidden shrink-0 bg-slate-900">
                  <DriverPoster
                    name={selectedPilotForContract.name}
                    driverId={selectedPilotForContract.id}
                    visualIdentity={selectedPilotVisualIdentity}
                    aspectRatio="tall"
                  />
                </div>
                <div className="flex-1 text-xs space-y-1">
                  <div className="font-bold text-base text-slate-900">
                    {selectedPilotForContract.name}
                  </div>
                  <div className="text-slate-500 flex items-center gap-1.5">
                    <CountryFlag code={selectedPilotForContract.nationality} />
                    <span>
                      {selectedPilotForContract.nationality} • {selectedPilotForContract.age} anos
                    </span>
                  </div>
                  <div className="text-emerald-600 font-semibold pt-1">
                    Salário anual de referência:{' '}
                    {formatUsdCurrency(selectedPilotForContract.salaryUsd, 'full')}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Orçamento disponível da equipe:{' '}
                    <span className="text-slate-900 font-mono font-medium">
                      {formatUsdCurrency(team?.budget || 0, 'full')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status de Elegibilidade FIA */}
              {(() => {
                const el = checkEligibility(selectedPilotForContract)
                return (
                  <div
                    className={
                      el.status === 'academia'
                        ? 'p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900'
                        : el.status === 'homologacao'
                          ? 'p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900'
                          : 'p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900'
                    }
                  >
                    <div className="font-semibold flex items-center gap-1 mb-1">
                      {el.status === 'academia' && (
                        <GraduationCap className="w-4 h-4 text-purple-600" />
                      )}
                      {el.status === 'homologacao' && (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                      {el.status === 'elegivel' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                      {el.label}
                    </div>
                    <p className="text-[11px] opacity-90">{el.description}</p>
                  </div>
                )
              })()}

              {/* Escolha da Modalidade de Contrato */}
              {canPreContract && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Vigência do Contrato (Rodada {currentRound}):
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setContractMode('immediate')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        contractMode === 'immediate'
                          ? 'border-[#E10600] bg-red-50 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs">Contratação Imediata</div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        Assume vaga na temporada atual
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setContractMode('precontract')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        contractMode === 'precontract'
                          ? 'border-[#E10600] bg-red-50 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs">Pré-contrato 2027</div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        Garante vaga para a próxima temporada
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Escolha da Vaga */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">
                  Vaga Contratual na Equipe:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!checkEligibility(selectedPilotForContract).canSignTitular}
                    onClick={() => setContractRole('titular')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      contractRole === 'titular'
                        ? 'border-[#E10600] bg-red-50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    } ${
                      !checkEligibility(selectedPilotForContract).canSignTitular
                        ? 'opacity-40 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    <div className="font-bold text-xs">Piloto Titular</div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      Disputa as corridas e pontua
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContractRole('reserva')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      contractRole === 'reserva'
                        ? 'border-[#E10600] bg-red-50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs">Piloto Reserva / Desenvolvimento</div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      Treinos livres e desenvolvimento
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsContractingModalOpen(false)}
              className="border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmContract}
              disabled={isSubmitting}
              className="bg-[#E10600] hover:bg-[#c00500] text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Registrando Contrato...
                </>
              ) : contractMode === 'precontract' ? (
                'Firmar Pré-contrato'
              ) : (
                'Assinar Contrato'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
