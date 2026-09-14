import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/PageHeader'
import { AmbientBackground } from '@/components/AmbientBackground'
import { DriverPoster } from '@/components/DriverPoster'
import { PilotProfileDialog, formatUsdCurrency } from '@/components/PilotProfileDialog'
import { getCountryFlag } from '@/lib/country-flags'
import { MBJ_2026_PILOTS, checkEligibility, getOverallRating } from '@/lib/mbj-drivers-data'
import { ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from 'lucide-react'
import { DriverModel, TeamModel } from '@/types/f1'

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
  contractEnd: number
  teamId?: string | null
  teamKey?: string | null
  teamName?: string | null
  teamColor?: string | null
  role?: 'titular' | 'reserva' | null
  category: 'f1' | 'f2' | 'indycar' | 'indynxt' | 'formula_e' | 'nascar' | 'prototipos' | 'mercado'
  potentialMin: number
  potentialMax: number
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
}

export default function DriversPage() {
  const { team, season, refreshTeamAndSeason } = useAuth()
  const { toast } = useToast()

  const [dbDrivers, setDbDrivers] = useState<DriverModel[]>([])
  const [dbTeams, setDbTeams] = useState<TeamModel[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const [activeTab, setActiveTab] = useState<string>('grid')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all')
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<string>('all')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')

  // Modal de Perfil MBJ (V/P/O)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false)
  const [selectedPilotForProfile, setSelectedPilotForProfile] = useState<UnifiedDriverItem | null>(
    null,
  )

  // Modal de Contratação
  const [isContractingModalOpen, setIsContractingModalOpen] = useState<boolean>(false)
  const [selectedPilotForContract, setSelectedPilotForContract] =
    useState<UnifiedDriverItem | null>(null)
  const [contractRole, setContractRole] = useState<'titular' | 'reserva'>('titular')
  const [contractMode, setContractMode] = useState<'immediate' | 'precontract'>('immediate')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Carrega motoristas e equipes reais do banco
  const loadDatabaseData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [driversRes, teamsRes] = await Promise.all([
        pb.collection('drivers').getFullList<DriverModel>({
          sort: '-speed',
        }),
        pb.collection('teams').getFullList<TeamModel>({
          sort: 'name',
        }),
      ])
      setDbDrivers(driversRes)
      setDbTeams(teamsRes)
    } catch (err) {
      console.error('Erro ao carregar pilotos/equipes do banco:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDatabaseData()
  }, [loadDatabaseData])

  // Rodada atual do campeonato do save
  const currentRound = season?.current_round || 1
  const canPreContract = currentRound >= 12

  // Normalização unificada unindo banco PocketBase + dados catalogados do MBJ
  const unifiedDrivers: UnifiedDriverItem[] = useMemo(() => {
    // Mapa auxiliar do MBJ por nome normalizado
    const mbjMap = new Map<string, (typeof MBJ_2026_PILOTS)[number]>()
    for (const pilot of MBJ_2026_PILOTS) {
      mbjMap.set(pilot.name.toLowerCase().trim(), pilot)
    }

    // Mapa auxiliar de equipes do banco por ID e por team_key
    const teamById = new Map<string, TeamModel>()
    for (const t of dbTeams) {
      teamById.set(t.id, t)
    }

    const result: UnifiedDriverItem[] = []
    const visitedNames = new Set<string>()

    // 1. Processa todos os pilotos presentes no Banco de Dados
    for (const d of dbDrivers) {
      const normName = d.name.toLowerCase().trim()
      visitedNames.add(normName)

      const mbjInfo = mbjMap.get(normName)
      const associatedTeamId = d.team_id || d.reserve_team_id || null
      const associatedTeam = associatedTeamId ? teamById.get(associatedTeamId) : null

      const isPlayer = Boolean(team?.id && (d.team_id === team.id || d.reserve_team_id === team.id))

      // Salário sempre em US$
      // Se vier com valor inflado histórico (ex: > 100M que era em reais antigos), normaliza para US$
      const rawSalary = d.salary || (mbjInfo ? mbjInfo.salaryUsd : 3000000)
      const salaryUsd = rawSalary > 100000000 ? Math.round(rawSalary / 5.75) : rawSalary

      // Equipe
      const teamName =
        associatedTeam?.name || (mbjInfo?.teamName ?? (associatedTeamId ? 'Equipe F1' : null))
      const teamColor = associatedTeam?.color || '#E10600'
      const teamKey = associatedTeam?.team_key || mbjInfo?.teamKey || null

      // Categoria
      const cat = (d.category || mbjInfo?.category || 'f1') as UnifiedDriverItem['category']

      // Métricas operacionais
      const speed = d.speed || mbjInfo?.speed || 75
      const consistency = d.consistency || mbjInfo?.consistency || 75
      const rain = d.rain || mbjInfo?.rain || 75
      const defense = d.defense || mbjInfo?.defense || 75

      // Projeções P
      const potentialMin = mbjInfo?.potentialMin ?? Math.max(70, speed - 2)
      const potentialMax = mbjInfo?.potentialMax ?? Math.min(99, speed + 6)
      const f1Races = mbjInfo?.f1RacesCompleted ?? (cat === 'f1' ? 20 : 0)
      const superlicense = mbjInfo?.superlicensePoints ?? (cat === 'f1' ? 50 : 35)
      const isProspect = mbjInfo?.isAcademyProspect || cat === 'f2' || (d.age < 22 && f1Races === 0)

      result.push({
        id: d.id,
        name: d.name,
        nationality: d.nationality || mbjInfo?.nationality || 'Mundial',
        age: d.age || mbjInfo?.age || 25,
        speed,
        consistency,
        rain,
        defense,
        salaryUsd,
        contractEnd: d.contract_end || 2026,
        teamId: associatedTeamId,
        teamKey,
        teamName,
        teamColor,
        role: d.role || (d.reserve_team_id ? 'reserva' : d.team_id ? 'titular' : null),
        category: cat,
        potentialMin,
        potentialMax,
        f1RacesCompleted: f1Races,
        superlicensePoints: superlicense,
        isAcademyProspect: Boolean(isProspect),
        isPlayerDriver: isPlayer,
        nextTeamId: d.next_team_id,
        nextContractRole: d.next_contract_role,
        rawDbRecord: d,

        // Campos completos MBJ
        birthDate: mbjInfo?.birthDate,
        preferredNumber: mbjInfo?.preferredNumber,
        eligibilityStatus: mbjInfo?.eligibilityStatus,
        biography: mbjInfo?.biography,
        qualifying:
          mbjInfo?.qualifying ?? Math.min(99, Math.max(50, speed + (speed > 85 ? 1 : -1))),
        racePace:
          mbjInfo?.racePace ?? Math.min(99, Math.max(50, Math.round((speed + consistency) / 2))),
        start: mbjInfo?.start ?? Math.min(99, Math.max(50, defense - 2)),
        overtake: mbjInfo?.overtake ?? Math.min(99, Math.max(50, speed - 1)),
        tireManagement: mbjInfo?.tireManagement ?? Math.min(99, Math.max(50, consistency)),
        energyManagement: mbjInfo?.energyManagement ?? Math.min(99, Math.max(50, consistency - 1)),
        feedback: mbjInfo?.feedback ?? Math.min(99, Math.max(50, consistency + 2)),
        pressure: mbjInfo?.pressure ?? Math.min(99, Math.max(50, speed - 2)),
        concentration: mbjInfo?.concentration ?? Math.min(99, Math.max(50, consistency)),
        resilience: mbjInfo?.resilience ?? Math.min(99, Math.max(50, defense)),
        aggressiveness: mbjInfo?.aggressiveness ?? 70,
        ambition: mbjInfo?.ambition ?? 80,
        loyalty: mbjInfo?.loyalty ?? 75,
        professionalism: mbjInfo?.professionalism ?? 85,
        reputation: mbjInfo?.reputation ?? Math.min(99, Math.max(50, speed)),
        globalPopularity: mbjInfo?.globalPopularity ?? Math.min(99, Math.max(40, speed - 5)),
        localPopularity: mbjInfo?.localPopularity ?? Math.min(100, Math.max(60, speed + 10)),
        localMarket: mbjInfo?.localMarket,
        moraleState: d.morale || mbjInfo?.moraleState || 75,
        confidence: mbjInfo?.confidence ?? 75,
        physicalCondition: d.physical_condition || mbjInfo?.physicalCondition || 100,
        stress: mbjInfo?.stress ?? 25,
        adaptability: mbjInfo?.adaptability ?? 80,
        adaptationF1: mbjInfo?.adaptationF1 ?? (cat === 'f1' ? 90 : 60),
        adaptationCar: mbjInfo?.adaptationCar ?? 80,
        adaptationTeam: mbjInfo?.adaptationTeam ?? 80,
        revealedTraits: mbjInfo?.revealedTraits,
        exitClauseUsd: mbjInfo?.exitClauseUsd ?? Math.round(salaryUsd * 2.5),
        winBonusUsd: mbjInfo?.winBonusUsd ?? Math.round(salaryUsd * 0.08),
      })
    }

    // 2. Incorpora pilotos MBJ não cadastrados no banco para catálogo estático
    for (const pilot of MBJ_2026_PILOTS) {
      const normName = pilot.name.toLowerCase().trim()
      if (visitedNames.has(normName)) continue

      result.push({
        id: pilot.id,
        name: pilot.name,
        nationality: pilot.nationality,
        age: pilot.age,
        speed: pilot.speed,
        consistency: pilot.consistency,
        rain: pilot.rain,
        defense: pilot.defense,
        salaryUsd: pilot.salaryUsd,
        contractEnd: 2026 + (pilot.contractYears || 1),
        teamId: null,
        teamKey: pilot.teamKey || null,
        teamName: pilot.teamName || null,
        teamColor: '#E10600',
        role: pilot.role || null,
        category: pilot.category,
        potentialMin: pilot.potentialMin,
        potentialMax: pilot.potentialMax,
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
        moraleState: pilot.moraleState ?? 75,
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
  }, [dbDrivers, dbTeams, team])

  // Filtros combinados globais
  const filteredDrivers = useMemo(() => {
    return unifiedDrivers.filter((pilot) => {
      // Busca por nome ou nacionalidade
      const matchesSearch =
        pilot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pilot.nationality.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false

      // Filtro de equipe
      if (selectedTeamFilter !== 'all') {
        if (selectedTeamFilter === 'free_agents') {
          if (pilot.teamId || pilot.teamKey) return false
        } else {
          const matchKey = pilot.teamKey?.toLowerCase() === selectedTeamFilter.toLowerCase()
          const matchId = pilot.teamId === selectedTeamFilter
          if (!matchKey && !matchId) return false
        }
      }

      // Filtro de categoria
      if (selectedCategoryFilter !== 'all') {
        if (pilot.category !== selectedCategoryFilter) return false
      }

      // Filtro de faixa de overall
      const ovr = getOverallRating(pilot)
      if (selectedRatingFilter === '90+') {
        if (ovr < 90) return false
      } else if (selectedRatingFilter === '80-89') {
        if (ovr < 80 || ovr > 89) return false
      } else if (selectedRatingFilter === 'sub80') {
        if (ovr >= 80) return false
      }

      return true
    })
  }, [
    unifiedDrivers,
    searchQuery,
    selectedTeamFilter,
    selectedCategoryFilter,
    selectedRatingFilter,
  ])

  // Segmentação das 4 Abas Solicitadas:
  // 1. Grid F1: Pilotos titulares e reservas das 11 equipes de 2026 (incluindo Cadillac)
  const gridF1Pilots = useMemo(() => {
    return filteredDrivers.filter(
      (p) =>
        (p.category === 'f1' && (p.teamId || p.teamKey)) ||
        p.role === 'titular' ||
        p.role === 'reserva',
    )
  }, [filteredDrivers])

  // 2. Agentes Livres: Pilotos sem vínculo (team_id null e reserve_team_id null), disponíveis para contratação
  const freeAgentsPilots = useMemo(() => {
    return filteredDrivers.filter((p) => !p.teamId && !p.teamKey)
  }, [filteredDrivers])

  // 3. Mercado & Contratação: listagem geral com elegibilidade dinâmica, rodadas >= 12 pré-contrato
  const marketPilots = useMemo(() => {
    return filteredDrivers.filter((p) => !p.isPlayerDriver)
  }, [filteredDrivers])

  // 4. Prospectos & Academia: Jovens talentos (Fórmula 2 / Fórmula 3 / Indynxt) com potencial/overall, idade < 23
  const prospectPilots = useMemo(() => {
    return filteredDrivers.filter(
      (p) =>
        p.isAcademyProspect ||
        p.category === 'f2' ||
        p.category === 'indynxt' ||
        (p.age <= 22 && p.f1RacesCompleted === 0),
    )
  }, [filteredDrivers])

  // Abertura do perfil do piloto ao clicar no card
  const handleOpenPilotProfile = (pilot: UnifiedDriverItem) => {
    setSelectedPilotForProfile(pilot)
    setIsProfileModalOpen(true)
  }

  // Abertura do modal de contratação
  const handleOpenContractModal = (pilot: UnifiedDriverItem) => {
    setSelectedPilotForContract(pilot)
    const eligibility = checkEligibility(pilot)

    // Ajusta papel padrão
    if (!eligibility.canSignTitular && eligibility.canSignReserve) {
      setContractRole('reserva')
    } else {
      setContractRole('titular')
    }

    // Se estiver na rodada >= 12, permite escolher entre pré-contrato ou contratação imediata
    if (canPreContract) {
      setContractMode('precontract')
    } else {
      setContractMode('immediate')
    }

    setIsContractingModalOpen(true)
  }

  // Execução da Contratação com Mutação Segura e Desconto do Orçamento (em US$)
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

    // Custo salarial em US$ para desconto no orçamento do time do save
    const annualSalaryUsd = selectedPilotForContract.salaryUsd
    const proratedSigningFeeUsd =
      contractMode === 'immediate'
        ? Math.round(annualSalaryUsd * 0.25) // Taxa de luvas/transferência imediata (25% do anual)
        : Math.round(annualSalaryUsd * 0.1) // Taxa de pré-contrato (10%)

    if ((team.budget || 0) < proratedSigningFeeUsd) {
      toast({
        title: 'Orçamento Insuficiente',
        description: `Sua equipe precisa de ao menos ${formatUsdCurrency(proratedSigningFeeUsd, 'full')} para arcar com as luvas contratuais.`,
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Localizar ou criar o piloto no banco
      let targetDriverId = selectedPilotForContract.rawDbRecord?.id

      if (!targetDriverId) {
        // Busca por nome no banco caso não tenha id de banco mapeado
        try {
          const found = await pb
            .collection('drivers')
            .getFirstListItem(`name = "${selectedPilotForContract.name}"`)
          targetDriverId = found.id
        } catch {
          // Cria registro novo de piloto no catálogo do banco
          const created = await pb.collection('drivers').create({
            name: selectedPilotForContract.name,
            nationality: selectedPilotForContract.nationality,
            age: selectedPilotForContract.age,
            speed: selectedPilotForContract.speed,
            consistency: selectedPilotForContract.consistency,
            rain: selectedPilotForContract.rain,
            defense: selectedPilotForContract.defense,
            salary: selectedPilotForContract.salaryUsd,
            contract_end: 2027,
            role: contractRole,
            category: 'f1',
            morale: 80,
            physical_condition: 100,
          })
          targetDriverId = created.id
        }
      }

      // 2. Aplica a alteração contratual no piloto
      if (contractMode === 'precontract') {
        // Pré-contrato para a próxima temporada (rodada 12+)
        await pb.collection('drivers').update(targetDriverId, {
          next_team_id: team.id,
          next_contract_role: contractRole,
        })
      } else {
        // Contratação Imediata (substituindo ou preenchendo vaga)
        if (contractRole === 'titular') {
          await pb.collection('drivers').update(targetDriverId, {
            team_id: team.id,
            reserve_team_id: null,
            role: 'titular',
            category: 'f1',
            salary: selectedPilotForContract.salaryUsd,
          })
        } else {
          await pb.collection('drivers').update(targetDriverId, {
            reserve_team_id: team.id,
            team_id: null,
            role: 'reserva',
            category: 'f1',
            salary: selectedPilotForContract.salaryUsd,
          })
        }
      }

      // 3. Descontar as luvas do orçamento do save do usuário de forma segura (em US$)
      const updatedBudget = Math.max(0, (team.budget || 0) - proratedSigningFeeUsd)
      await pb.collection('teams').update(team.id, {
        budget: updatedBudget,
      })

      // 4. Registra evento financeiro/contratual na equipe
      try {
        await pb.collection('events').create({
          team_id: team.id,
          message:
            contractMode === 'precontract'
              ? `Pré-contrato assinado com ${selectedPilotForContract.name} para a próxima temporada (${contractRole}). Taxa de garantia: ${formatUsdCurrency(proratedSigningFeeUsd, 'compact')}.`
              : `Contratação de ${selectedPilotForContract.name} formalizada com sucesso como piloto ${contractRole}. Taxa de assinatura: ${formatUsdCurrency(proratedSigningFeeUsd, 'compact')}.`,
          type: 'contrato',
        })
      } catch (evErr) {
        console.warn('Falha ao gravar evento de contrato:', evErr)
      }

      toast({
        title: 'Operação Contratual Concluída!',
        description:
          contractMode === 'precontract'
            ? `Pré-contrato com ${selectedPilotForContract.name} registrado para a próxima temporada da ${team.name}.`
            : `${selectedPilotForContract.name} agora faz parte do plantel oficial da ${team.name} como ${contractRole}.`,
      })

      setIsContractingModalOpen(false)
      setSelectedPilotForContract(null)

      // Atualiza os dados locais e o contexto do usuário
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

  // Renderizador unificado do card do piloto
  const renderPilotCard = (pilot: UnifiedDriverItem, showContractButton = true) => {
    const ovr = getOverallRating(pilot)
    const eligibility = checkEligibility(pilot)

    // Formatação elegante do nome da equipe com espaçamento correto
    const formattedTeamName = pilot.teamName
      ? pilot.teamName.replace(/F1Team/i, 'F1 Team').trim()
      : 'Agente Livre'

    return (
      <Card
        key={pilot.id}
        onClick={() => handleOpenPilotProfile(pilot)}
        className="group overflow-hidden border-zinc-800 bg-zinc-900/90 hover:border-zinc-700 hover:bg-zinc-900 transition-all shadow-md flex flex-col justify-between cursor-pointer"
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex gap-3.5">
            {/* Foto / Pôster com proporção limpa */}
            <div className="w-20 sm:w-24 shrink-0">
              <DriverPoster
                name={pilot.name}
                aspectRatio="poster"
                className="w-full shadow-md rounded"
              />
            </div>

            {/* Dados do Piloto com Grid sem sobreposição e largura ampla */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              {/* Linha superior: País à esquerda, OVR sempre visível à direita */}
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <Badge
                  variant="outline"
                  title={pilot.nationality}
                  className="font-mono text-[11px] border-zinc-700 bg-zinc-800/80 text-zinc-300 shrink-0"
                >
                  <span className="mr-1">{getCountryFlag(pilot.nationality)}</span>
                  <span>{pilot.nationality}</span>
                </Badge>

                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  <span className="text-[10px] text-zinc-400 font-mono font-semibold uppercase">
                    OVR
                  </span>
                  <Badge
                    className={`font-mono font-bold text-xs px-1.5 py-0.5 ${
                      ovr >= 90
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : ovr >= 82
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    {ovr}
                  </Badge>
                </div>
              </div>

              {/* Nome completo com title para tooltip nativo no hover, sem corte precoce */}
              <CardTitle
                title={pilot.name}
                className="text-base font-bold text-white group-hover:text-red-400 transition-colors truncate"
              >
                {pilot.name}
              </CardTitle>

              {/* Idade e Papel na primeira linha */}
              <div className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <span>{pilot.age} anos</span>
                {pilot.role && (
                  <Badge
                    variant="secondary"
                    className={`text-[9px] uppercase py-0 px-1 ml-0.5 ${
                      pilot.role === 'titular'
                        ? 'bg-red-950/80 text-red-300 border border-red-800/60'
                        : 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                    }`}
                  >
                    {pilot.role}
                  </Badge>
                )}
              </div>

              {/* Equipe em linha própria com tooltip nativo, sem cortar palavra-chave */}
              <div
                title={formattedTeamName}
                className="text-xs text-zinc-300 font-medium truncate mt-0.5 block"
              >
                {formattedTeamName}
              </div>

              {/* Status de Elegibilidade FIA */}
              <div className="mt-2">
                {eligibility.status === 'academia' && (
                  <Badge
                    className="bg-purple-950/80 text-purple-300 border-purple-700/60 text-[10px] flex items-center gap-1 w-fit max-w-full truncate"
                    title={eligibility.label}
                  >
                    <GraduationCap className="w-3 h-3 shrink-0" />{' '}
                    <span className="truncate">{eligibility.label}</span>
                  </Badge>
                )}
                {eligibility.status === 'homologacao' && (
                  <Badge
                    className="bg-amber-950/80 text-amber-300 border-amber-700/60 text-[10px] flex items-center gap-1 w-fit max-w-full truncate"
                    title="Exige Homologação"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />{' '}
                    <span className="truncate">Exige Homologação</span>
                  </Badge>
                )}
                {eligibility.status === 'elegivel' && (
                  <Badge
                    className="bg-emerald-950/80 text-emerald-300 border-emerald-700/60 text-[10px] flex items-center gap-1 w-fit max-w-full truncate"
                    title="Superlicença Válida"
                  >
                    <CheckCircle2 className="w-3 h-3 shrink-0" />{' '}
                    <span className="truncate">Superlicença Válida</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-1 pb-2">
          {/* Métricas V/P (Simulação e Atributos de Pista) */}
          <div className="grid grid-cols-4 gap-1.5 text-center bg-zinc-950/60 p-2 rounded-md border border-zinc-800/80 mt-1">
            <div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-0.5 font-mono">
                <Zap className="w-2.5 h-2.5 text-amber-400" /> VEL
              </div>
              <div className="text-xs font-mono font-bold text-white">{pilot.speed}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-0.5 font-mono">
                <Activity className="w-2.5 h-2.5 text-blue-400" /> CON
              </div>
              <div className="text-xs font-mono font-bold text-white">{pilot.consistency}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-0.5 font-mono">
                <CloudRain className="w-2.5 h-2.5 text-cyan-400" /> CHU
              </div>
              <div className="text-xs font-mono font-bold text-white">{pilot.rain}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-0.5 font-mono">
                <Shield className="w-2.5 h-2.5 text-emerald-400" /> DEF
              </div>
              <div className="text-xs font-mono font-bold text-white">{pilot.defense}</div>
            </div>
          </div>

          {/* Dados Financeiros em US$ e Projeção */}
          <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-zinc-800">
            <span className="text-zinc-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Salário de Referência:
            </span>
            <span className="font-semibold font-mono text-emerald-300">
              {formatUsdCurrency(pilot.salaryUsd, 'compact')}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
            <span>Potencial Projetado:</span>
            <span className="text-zinc-200 font-mono font-semibold">
              {pilot.potentialMin} – {pilot.potentialMax}
            </span>
          </div>

          {pilot.nextTeamId && (
            <div className="mt-2 text-[10px] text-amber-300 bg-amber-950/40 p-1.5 rounded border border-amber-800/50 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Pré-contrato firmado para 2027 (
              {pilot.nextContractRole})
            </div>
          )}
        </CardContent>

        <CardFooter className="p-4 pt-2">
          {pilot.isPlayerDriver ? (
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                handleOpenPilotProfile(pilot)
              }}
              className="w-full bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center justify-center gap-1.5 text-xs"
            >
              <Eye className="w-3.5 h-3.5 text-red-400" />
              Sua Equipe • Ver Perfil Pleno
            </Button>
          ) : showContractButton ? (
            <div className="w-full flex items-center gap-2">
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenPilotProfile(pilot)
                }}
                className="flex-1 border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs flex items-center justify-center gap-1"
              >
                <Eye className="w-3.5 h-3.5 text-zinc-400" /> Perfil
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  handleOpenContractModal(pilot)
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium flex items-center justify-center gap-1 text-xs transition-colors shadow"
              >
                <UserPlus className="w-3.5 h-3.5" /> Contratar
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                handleOpenPilotProfile(pilot)
              }}
              className="w-full border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5 text-zinc-400" /> Ver Perfil Detalhado
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="min-h-screen relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <AmbientBackground />

      <PageHeader
        title="Hub de Pilotos & Universo MBJ 2026"
        description="Catálogo oficial do grid 2026, mercado global de transferências, prospectos da academia e contratações em US$ em tempo real."
      />

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 backdrop-blur-md shadow-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
          <Input
            placeholder="Buscar por nome do piloto ou país..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-950/60 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
            <SelectTrigger className="w-[170px] bg-zinc-950/60 border-zinc-700 text-zinc-200">
              <SelectValue placeholder="Filtrar Equipe" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200 max-h-60">
              <SelectItem value="all">Todas as Equipes</SelectItem>
              <SelectItem value="free_agents">Agentes Livres</SelectItem>
              {ALL_GRID_TEAMS_DATABASE.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
            <SelectTrigger className="w-[140px] bg-zinc-950/60 border-zinc-700 text-zinc-200">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
              <SelectItem value="all">Todas Categorias</SelectItem>
              <SelectItem value="f1">Fórmula 1</SelectItem>
              <SelectItem value="f2">Fórmula 2</SelectItem>
              <SelectItem value="indycar">IndyCar</SelectItem>
              <SelectItem value="formula_e">Fórmula E</SelectItem>
              <SelectItem value="prototipos">WEC / Protótipos</SelectItem>
              <SelectItem value="mercado">Mercado Geral</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedRatingFilter} onValueChange={setSelectedRatingFilter}>
            <SelectTrigger className="w-[130px] bg-zinc-950/60 border-zinc-700 text-zinc-200">
              <SelectValue placeholder="Rating OVR" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
              <SelectItem value="all">Todos OVR</SelectItem>
              <SelectItem value="90+">Elite (90+)</SelectItem>
              <SelectItem value="80-89">Titulares (80-89)</SelectItem>
              <SelectItem value="sub80">Jovens (&lt; 80)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Indicador de Carregamento */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-zinc-400 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          <p className="text-sm">Sincronizando banco de dados de pilotos...</p>
        </div>
      ) : (
        /* Abas Principais do Hub com Scroll Horizontal (Sem Sobreposição) */
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="w-full overflow-x-auto pb-1 scrollbar-none">
            <TabsList className="inline-flex w-auto min-w-full sm:w-full bg-zinc-900 border border-zinc-800 p-1 rounded-lg gap-1">
              <TabsTrigger
                value="grid"
                className="flex items-center gap-2 py-2 px-3 sm:px-4 shrink-0 whitespace-nowrap data-[state=active]:bg-red-600 data-[state=active]:text-white font-medium"
              >
                <Trophy className="w-4 h-4 shrink-0" />
                <span>Grid F1 ({gridF1Pilots.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="free_agents"
                className="flex items-center gap-2 py-2 px-3 sm:px-4 shrink-0 whitespace-nowrap data-[state=active]:bg-red-600 data-[state=active]:text-white font-medium"
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Agentes Livres ({freeAgentsPilots.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="market"
                className="flex items-center gap-2 py-2 px-3 sm:px-4 shrink-0 whitespace-nowrap data-[state=active]:bg-red-600 data-[state=active]:text-white font-medium"
              >
                <Briefcase className="w-4 h-4 shrink-0" />
                <span>Mercado & Contratação ({marketPilots.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="prospects"
                className="flex items-center gap-2 py-2 px-3 sm:px-4 shrink-0 whitespace-nowrap data-[state=active]:bg-red-600 data-[state=active]:text-white font-medium"
              >
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span>Prospectos & Academia ({prospectPilots.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ABA 1: GRID F1 2026 (11 EQUIPES INCLUINDO CADILLAC) */}
          <TabsContent value="grid" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-900/60 p-3 rounded-md border border-zinc-800 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-red-500" />
                Pilotos titulares e reservas das 11 construtoras oficiais da temporada 2026.
              </span>
              <span className="font-semibold text-zinc-300">
                Cadillac F1: Sergio Pérez & Valtteri Bottas
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gridF1Pilots.map((pilot) => renderPilotCard(pilot, true))}
            </div>
          </TabsContent>

          {/* ABA 2: AGENTES LIVRES (SEM VÍNCULO) */}
          <TabsContent value="free_agents" className="space-y-4">
            <div className="bg-zinc-900/60 p-3 rounded-md border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                Pilotos sem vínculo contratual ativo com nenhuma equipe. Estão imediatamente
                disponíveis para contratação sem taxa rescisória entre times.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {freeAgentsPilots.map((pilot) => renderPilotCard(pilot, true))}
            </div>
          </TabsContent>

          {/* ABA 3: MERCADO & CONTRATAÇÃO (ELEGIBILIDADE DINÂMICA) */}
          <TabsContent value="market" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-zinc-900/60 p-3 rounded-md border border-zinc-800 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-400" />
                Rodada atual: <strong className="text-white">R{currentRound}/24</strong>.
                {canPreContract ? (
                  <span className="text-emerald-400 ml-1 font-medium">
                    (Pré-contratos para a próxima temporada liberados)
                  </span>
                ) : (
                  <span className="text-zinc-400 ml-1">
                    (Pré-contratos liberados a partir da Rodada 12)
                  </span>
                )}
              </span>
              <span className="text-emerald-400 font-mono font-medium">
                Todas as transações e salários operam em Dólares (US$)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketPilots.map((pilot) => renderPilotCard(pilot, true))}
            </div>
          </TabsContent>

          {/* ABA 4: PROSPECTOS & ACADEMIA */}
          <TabsContent value="prospects" className="space-y-4">
            <div className="bg-zinc-900/60 p-3 rounded-md border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-purple-400" />
              <span>
                Jovens talentos e pilotos em formação da Fórmula 2, Fórmula 3 e Indy NXT. Atletas
                menores de 18 anos exigem evolução na academia antes de assumir titularidade.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {prospectPilots.map((pilot) => renderPilotCard(pilot, true))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* MODAL DE PERFIL DO PILOTO (V/P/O) */}
      <PilotProfileDialog
        pilot={selectedPilotForProfile}
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
        onOpenContractModal={(pilot) => handleOpenContractModal(pilot)}
        currentRound={currentRound}
      />

      {/* MODAL DE FORMALIZAÇÃO DE CONTRATO */}
      <Dialog open={isContractingModalOpen} onOpenChange={setIsContractingModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-red-500" />
              Formalizar Proposta Contratual
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Vincule o piloto à sua equipe ({team?.name || 'Sua Equipe'}). O registro será
              persistido no save com atualização direta do orçamento em US$.
            </DialogDescription>
          </DialogHeader>

          {selectedPilotForContract && (
            <div className="space-y-4 py-2">
              <div className="flex gap-4 p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                <div className="w-20 shrink-0">
                  <DriverPoster name={selectedPilotForContract.name} aspectRatio="poster" />
                </div>
                <div className="flex-1 text-xs space-y-1">
                  <div className="font-bold text-base text-white">
                    {selectedPilotForContract.name}
                  </div>
                  <div className="text-zinc-400">
                    {selectedPilotForContract.nationality} • {selectedPilotForContract.age} anos
                  </div>
                  <div className="text-emerald-400 font-semibold pt-1">
                    Salário anual de referência:{' '}
                    {formatUsdCurrency(selectedPilotForContract.salaryUsd, 'full')}
                  </div>
                  <div className="text-zinc-400 text-[11px]">
                    Orçamento disponível da equipe:{' '}
                    <span className="text-white font-mono font-medium">
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
                        ? 'p-3 rounded-md bg-purple-950/40 border border-purple-800/60 text-xs text-purple-200'
                        : el.status === 'homologacao'
                          ? 'p-3 rounded-md bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200'
                          : 'p-3 rounded-md bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200'
                    }
                  >
                    <div className="font-semibold flex items-center gap-1 mb-1">
                      {el.status === 'academia' && <GraduationCap className="w-4 h-4" />}
                      {el.status === 'homologacao' && <AlertTriangle className="w-4 h-4" />}
                      {el.status === 'elegivel' && <CheckCircle2 className="w-4 h-4" />}
                      {el.label}
                    </div>
                    <p className="text-[11px] opacity-90">{el.description}</p>
                  </div>
                )
              })()}

              {/* Escolha da Modalidade de Contrato (Imediato vs Pré-contrato) */}
              {canPreContract && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">
                    Vigência do Contrato (Rodada {currentRound}):
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setContractMode('immediate')}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        contractMode === 'immediate'
                          ? 'border-red-600 bg-red-600/10 text-white'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
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
                      className={`p-3 rounded-lg border text-left transition-all ${
                        contractMode === 'precontract'
                          ? 'border-red-600 bg-red-600/10 text-white'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
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
                <label className="text-xs font-semibold text-zinc-300">
                  Vaga Contratual na Equipe:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!checkEligibility(selectedPilotForContract).canSignTitular}
                    onClick={() => setContractRole('titular')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      contractRole === 'titular'
                        ? 'border-red-600 bg-red-600/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
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
                    className={`p-3 rounded-lg border text-left transition-all ${
                      contractRole === 'reserva'
                        ? 'border-red-600 bg-red-600/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-xs">Piloto Reserva / Academia</div>
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
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmContract}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
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
