import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { DriverModel, EngineSupplierSpec } from '@/types/f1'
import { formatCurrency } from '@/lib/formatters'
import { calculateDriverTireWearProfile } from '@/lib/f1-tire-system'
import { F1_2026_CALENDAR, ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { getCountryFlag } from '@/lib/country-flags'
import { calcularElegibilidade } from '@/lib/superlicense'
import { toast } from '@/hooks/use-toast'
import { getDriverActiveNumber, MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import {
  Users,
  AlertTriangle,
  Sliders,
  Shield,
  CheckCircle,
  CheckCircle2,
  GraduationCap,
  XCircle,
  Calendar,
  Sparkles,
  ArrowRightLeft,
  UserCheck,
  Activity,
  HeartPulse,
  Disc,
  Cpu,
  Zap,
  ChevronRight,
  TrendingUp,
  Building,
  Briefcase,
  Award,
  Clock,
  ArrowUpRight,
  AlertCircle,
  Info,
  Flame,
  Search,
  Gauge,
  RefreshCw,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { DriverHelmet } from '@/components/DriverHelmet'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import { AmbientBackground } from '@/components/AmbientBackground'
import { ProgressBar } from '@/components/ProgressBar'
import { DevelopmentManagerModal } from '@/components/DevelopmentManagerModal'
import { ProspectCard } from '@/components/ProspectCard'
import { ProspectDebugAuditModal } from '@/components/ProspectDebugAuditModal'
import { driverScoutingService } from '@/services/driverScoutingService'
import { proceduralDriverProgressService } from '@/services/proceduralDriverProgressService'
import { infrastructureCapabilityService } from '@/services/infrastructureCapabilityService'
import driverDevelopmentService from '@/services/driverDevelopmentService'
import { managerEffectService } from '@/services/managerEffectService'
import { financialLedgerService } from '@/services/financialLedgerService'
import { TechnicalOrganizationSection } from '@/components/TechnicalOrganizationSection'
import { MANAGER_DOMAINS } from '@/lib/manager-attribute-domains'
import { standingsService } from '@/services/standingsService'
import audiGarageHeroImg from '@/assets/audi-e9cff.jpg'
import ricciardoBundledImg from '@/assets/3-danielricciardo-4d208.jpg'
import bortoletoBundledImg from '@/assets/05-gabrielbortoleto-ed602.png'
import { TeamHeroBanner } from '@/components/team/TeamHeroBanner'
import { AboutTeamCard } from '@/components/team/AboutTeamCard'
import { ManagerExecutiveCard } from '@/components/team/ManagerExecutiveCard'
import { DriverSummaryCard } from '@/components/team/DriverSummaryCard'
import {
  TechnicalStaffSummaryCard,
  KeyStaffMemberItem,
} from '@/components/team/TechnicalStaffSummaryCard'
import { BoardObjectivesCard, BoardObjectiveItem } from '@/components/team/BoardObjectivesCard'
import { OrganizationHealthCard } from '@/components/team/OrganizationHealthCard'
import {
  OrganizationalCapacityCard,
  DepartmentCapacity,
} from '@/components/team/OrganizationalCapacityCard'
import { PendingDecisionsCard, PendingDecisionItem } from '@/components/team/PendingDecisionsCard'
import { TeamInstitutionalDetailsModal } from '@/components/team/TeamInstitutionalDetailsModal'
import { ManagerProfileDetailsModal } from '@/components/team/ManagerProfileDetailsModal'
import { PilotProfileDialog } from '@/components/PilotProfileDialog'
import { getManagerOfficialPortrait } from '@/lib/manager-official-assets'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

type TeamSubTab = 'visao_geral' | 'pilotos' | 'staff' | 'contratos' | 'academia' | 'cultura_moral'

export default function TeamPage() {
  const navigate = useNavigate()
  const { team, season, refreshTeamAndSeason } = useAuth()

  const [activeTab, setActiveTab] = useState<TeamSubTab>('visao_geral')
  const [teamDrivers, setTeamDrivers] = useState<DriverModel[]>([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [renegotiateDriver, setRenegotiateDriver] = useState<DriverModel | null>(null)
  const [salaryMultiplier, setSalaryMultiplier] = useState<number>(100)
  const [contractYears, setContractYears] = useState<number>(1)
  const [fireDriver, setFireDriver] = useState<DriverModel | null>(null)

  // Engine switch state
  const [selectedSupplier, setSelectedSupplier] = useState<EngineSupplierSpec | null>(null)
  const [isSwitchingEngine, setIsSwitchingEngine] = useState(false)

  // FP practice modal
  const [fpModalOpen, setFpModalOpen] = useState(false)
  const [selectedFpRounds, setSelectedFpRounds] = useState<number[]>([7, 13])
  const [isProcessing, setIsProcessing] = useState(false)

  // Sistema de Homologação, Academia e Test Drivers (FASE DESENVOLVIMENTO & 4C)
  const [devManagerOpen, setDevManagerOpen] = useState(false)
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false)
  const [academySubArea, setAcademySubArea] = useState<
    'programa' | 'scouting' | 'desenvolvimento' | 'caminho_f1' | 'historico'
  >('programa')
  const [allGridDrivers, setAllGridDrivers] = useState<DriverModel[]>([])
  const [scoutingCandidates, setScoutingCandidates] = useState<DriverModel[]>([])
  const [isGeneratingScout, setIsGeneratingScout] = useState(false)
  const [reigningChampionId, setReigningChampionId] = useState<string | null>(null)

  const isCustomTeam = team?.is_custom ?? false
  const teamStrength = team?.strength ?? 52

  const currentEngine = useMemo(() => {
    const sName = team?.engine_supplier || 'Audi'
    return ENGINE_SUPPLIERS.find((s) => s.name === sName) || ENGINE_SUPPLIERS[1]
  }, [team?.engine_supplier])

  const COST_CAP_LIMIT = f1Service.COST_CAP_LIMIT
  const currentCostCapSpent = team?.cost_cap_spent ?? 0
  const remainingCostCap = Math.max(0, COST_CAP_LIMIT - currentCostCapSpent)
  const ENGINE_SWITCH_FEE = 15000000

  const loadData = async () => {
    if (!team) {
      setLoading(false)
      return
    }
    try {
      const tDrivers = await f1Service.getTeamDrivers(team.id)
      setTeamDrivers(tDrivers)
      // Carrega pilotos livres e categorias para gestão de talentos
      const allD = await f1Service.getAllDrivers()
      setAllGridDrivers(allD || [])

      // Campeão vigente a partir do histórico de temporadas (season_histories) ou fallback para o último campeão registrado
      try {
        const histRecords = await pb.collection('season_histories').getFullList({
          sort: '-season_year',
        })
        if (histRecords && histRecords.length > 0) {
          const latest = histRecords[0]
          const champDriver = latest.drivers_champion
          if (champDriver?.driverId) {
            setReigningChampionId(champDriver.driverId)
          } else if (champDriver?.driverName) {
            const found = (allD || []).find((d) =>
              d.name.toLowerCase().includes(champDriver.driverName.toLowerCase()),
            )
            setReigningChampionId(found?.id || null)
          }
        } else {
          // Se ainda não há season_histories (ex: início de temporada 2026/2027 sem histórico persistido),
          // localiza o campeão mundial de referência (Verstappen) no banco/catálogo
          const champDriver = (allD || []).find((d) => d.name.toLowerCase().includes('verstappen'))
          setReigningChampionId(champDriver?.id || null)
        }
      } catch (histErr) {
        console.warn('Não foi possível carregar season_histories para reigningChampion:', histErr)
        const champDriver = (allD || []).find((d) => d.name.toLowerCase().includes('verstappen'))
        setReigningChampionId(champDriver?.id || null)
      }
    } catch (err) {
      console.error('Error loading team page data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [team?.id])

  useRealtime('drivers', () => {
    loadData()
  })

  // Starters and reserve
  const titularDrivers = useMemo(
    () => teamDrivers.filter((d) => d.role !== 'reserva' && d.team_id === team?.id),
    [teamDrivers, team?.id],
  )

  const reserveDriver = useMemo(
    () =>
      teamDrivers.find(
        (d) => d.role === 'reserva' || (d.reserve_team_id === team?.id && d.team_id !== team?.id),
      ),
    [teamDrivers, team?.id],
  )

  const incapacitatedDriver = useMemo(
    () => titularDrivers.find((d) => d.is_incapacitated),
    [titularDrivers],
  )

  // Pilotos de Teste e Academia vinculados à equipe
  const academyDevData = useMemo(() => driverDevelopmentService.getAcademyData(team), [team])

  const testDrivers = useMemo(() => {
    return allGridDrivers.filter(
      (d) => academyDevData.testDrivers.includes(d.id) || d.is_test_driver,
    )
  }, [allGridDrivers, academyDevData.testDrivers])

  const teamAcademyPilots = useMemo(() => {
    return allGridDrivers.filter(
      (d) => academyDevData.academyDrivers.includes(d.id) || d.is_academy,
    )
  }, [allGridDrivers, academyDevData.academyDrivers])

  // Candidatos externos (sem time ou F1 Academy)
  const availableTalents = useMemo(() => {
    return allGridDrivers.filter(
      (d) =>
        (!d.team_id || d.team_id === '') &&
        !academyDevData.academyDrivers.includes(d.id) &&
        !academyDevData.testDrivers.includes(d.id) &&
        d.id !== reserveDriver?.id,
    )
  }, [allGridDrivers, academyDevData, reserveDriver])

  // Team identity details
  const teamName = team?.name || 'Audi F1 Team'
  const isAudi = teamName.toLowerCase().includes('audi')
  const teamCountry = isAudi ? 'Alemanha' : 'Brasil'
  const teamFlag = isAudi ? '🇩🇪' : '🇧🇷'
  const teamHq = isAudi ? 'Neuburg an der Donau' : 'Interlagos, São Paulo'
  const teamIntro = isAudi
    ? 'Unindo a tradição alemã em engenharia com uma mentalidade moderna de alta performance. Nosso foco é construir um legado duradouro na Fórmula 1.'
    : 'Desenvolvendo tecnologia e performance para colocar a equipe no topo do automobilismo mundial com paixão e precisão.'

  const teamPrincipalName = team?.manager_name || 'Jogador'
  const boardConfidence = (team as any)?.board_confidence ?? 93
  const overallMorale = 82 // Morale index %

  // Staff members
  const staffMembers = [
    {
      role: 'Diretor Técnico',
      name: 'James Key',
      country: 'Reino Unido',
      flag: '🇬🇧',
      rating: 88,
      photo: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=44',
    },
    {
      role: 'Chefe de Aerodinâmica',
      name: 'Enrico Cardile',
      country: 'Itália',
      flag: '🇮🇹',
      rating: 86,
      photo: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=88',
    },
    {
      role: 'Chefe de Engenharia',
      name: 'Adam Baker',
      country: 'Reino Unido',
      flag: '🇬🇧',
      rating: 82,
      photo: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=62',
    },
    {
      role: 'Chefe de Estratégia',
      name: 'Hannah Schmitz',
      country: 'Alemanha',
      flag: '🇩🇪',
      rating: 85,
      photo: 'https://img.usecurling.com/ppl/thumbnail?gender=female&seed=91',
    },
    {
      role: 'Diretor Esportivo',
      name: 'Allan McNish',
      country: 'Reino Unido',
      flag: '🇬🇧',
      rating: 80,
      photo: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=33',
    },
  ]

  // Academy young drivers
  const academyDrivers = [
    {
      name: 'Tim Tramnitz',
      country: 'Alemanha',
      flag: '🇩🇪',
      series: 'F2',
      age: 18,
      potential: 82,
      current: 68,
    },
    {
      name: 'Luke Browning',
      country: 'Reino Unido',
      flag: '🇬🇧',
      series: 'F3',
      age: 17,
      potential: 78,
      current: 65,
    },
  ]

  // Histórico de ex-pilotos que passaram pela academia
  const academyAlumni = useMemo(() => {
    return allGridDrivers.filter((d) => {
      const p = (d as any).procedural_data
      const isAlumni =
        p?.academyOriginTeamId === team?.id || (d as any).academy_origin_team_id === team?.id
      const isNotCurrentlyInAcademy = !teamAcademyPilots.some((tp) => tp.id === d.id)
      return isAlumni && isNotCurrentlyInAcademy
    })
  }, [allGridDrivers, team?.id, teamAcademyPilots])

  // Gerar novos candidatos de scouting conforme capacidade da equipe
  const handleGenerateScoutBatch = async () => {
    if (!team) return
    setIsGeneratingScout(true)
    try {
      const existingIds = allGridDrivers.map((d) => d.id)
      const newBatch = driverScoutingService.generateScoutingBatch(team, existingIds, 4)
      const newDrivers = newBatch.map((b) => b.driver)
      setScoutingCandidates((prev) => [...newDrivers, ...prev])
      toast({
        title: 'Nova Janela de Scouting Concluída',
        description: `${newDrivers.length} novos prospectos foram catalogados pelo departamento de base.`,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de Scouting',
        description: 'Não foi possível gerar novos relatórios de prospecção.',
      })
    } finally {
      setIsGeneratingScout(false)
    }
  }

  // Contratar prospect para a academia (cria registro no PocketBase se ainda não salvo)
  const handleHireProspectToAcademy = async (prospectDriverId: string) => {
    if (!team) return
    const candidate = scoutingCandidates.find((c) => c.id === prospectDriverId)
    setIsProcessing(true)
    try {
      let driverInDb: DriverModel | undefined = allGridDrivers.find(
        (d) => d.id === prospectDriverId,
      )
      if (!driverInDb && candidate) {
        // Persiste a entidade permanentemente no banco
        driverInDb = await pb.collection('drivers').create({
          name: candidate.name,
          nationality: candidate.nationality,
          age: candidate.age,
          speed: candidate.speed,
          consistency: candidate.consistency,
          rain: candidate.rain,
          defense: candidate.defense,
          salary: candidate.salary,
          contract_end: 2027,
          team_id: team.id,
          role: null,
          category: candidate.category || 'mercado',
          superlicense_points: candidate.superlicense_points || 5,
          homologation_status: 'formacao',
          f1_adaptation: candidate.f1_adaptation || 50,
          license_status: 'nivel_c',
          is_academy: true,
          is_test_driver: false,
          technical_feedback: candidate.technical_feedback || 60,
          seat_security: 80,
          origin_type: 'procedural',
          true_potential: (candidate as any).true_potential,
          perceived_potential: (candidate as any).perceived_potential,
          evaluation_confidence: (candidate as any).evaluation_confidence,
          academy_origin_team_id: team.id,
          career_status: 'academy',
          procedural_data: (candidate as any).procedural_data,
        })
      }

      if (driverInDb) {
        await driverDevelopmentService.addDriverToAcademy(team, driverInDb)
        toast({
          title: 'Novo Talento Contratado!',
          description: `${driverInDb.name} ingressou na Academia de Pilotos da ${team.name}.`,
        })
        setScoutingCandidates((prev) => prev.filter((c) => c.id !== prospectDriverId))
        await refreshTeamAndSeason()
        await loadData()
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao contratar prospect',
        description: err?.message || 'Falha ao vincular jovem à academia.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Reavaliar um prospect (eleva confiança e reduz erro sem alterar o piloto)
  const handleReevaluateProspect = (driverId: string) => {
    if (!team) return
    const candidate =
      scoutingCandidates.find((c) => c.id === driverId) ||
      allGridDrivers.find((d) => d.id === driverId)
    if (!candidate) return

    const { updatedDriver, evaluationGainText } = driverScoutingService.evaluateProspectAgain(
      candidate,
      team,
    )
    setScoutingCandidates((prev) => prev.map((c) => (c.id === driverId ? updatedDriver : c)))
    toast({
      title: 'Scouting Aprofundado',
      description: evaluationGainText,
    })
  }

  // Liberar piloto da Academia (LIBERAR ≠ DELETAR: permanece livre no mercado)
  const handleReleaseAcademyDriver = async (driver: DriverModel) => {
    if (!team) return
    setIsProcessing(true)
    try {
      const res = await driverDevelopmentService.releaseDriverFromAcademy(team, driver)

      // Regra 72: Liberar piloto não devolve custos históricos nem gera receita fictícia
      toast({
        title: 'Piloto Liberado da Academia',
        description: `${res.message} (Custos históricos de formação permanecem registrados no livro contábil).`,
      })
      await refreshTeamAndSeason()
      await loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao liberar piloto',
        description: err?.message || 'Falha ao processar rescisão da academia.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Simular avanço de temporada para desenvolvimento da base
  const handleAdvanceAcademySeason = async () => {
    if (!team || teamAcademyPilots.length === 0) {
      toast({
        title: 'Nenhum Piloto na Academia',
        description: 'Contrate jovens talentos antes de avançar a temporada de desenvolvimento.',
      })
      return
    }

    setIsProcessing(true)
    try {
      for (const d of teamAcademyPilots) {
        const prog = proceduralDriverProgressService.advanceSeasonForJuniorDriver(d, team, 2026)
        await pb.collection('drivers').update(d.id, {
          age: prog.updatedDriver.age,
          speed: prog.updatedDriver.speed,
          consistency: prog.updatedDriver.consistency,
          rain: prog.updatedDriver.rain,
          defense: prog.updatedDriver.defense,
          technical_feedback: prog.updatedDriver.technical_feedback,
          superlicense_points: prog.updatedDriver.superlicense_points,
          category: prog.updatedDriver.category,
          procedural_data: prog.updatedMetadata,
        })
      }

      toast({
        title: 'Ciclo de Desenvolvimento da Academia Concluído!',
        description: `${teamAcademyPilots.length} jovens evoluíram tecnicamente com base no suporte e testes da equipe.`,
      })
      await refreshTeamAndSeason()
      await loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro no avanço',
        description: err?.message || 'Falha ao simular desenvolvimento.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Action needed alerts
  const attentionItems = [
    {
      id: 'alert-1',
      icon: Flame,
      iconColor: 'text-rose-500',
      title: 'Contrato próximo do fim',
      desc: 'Z. Maloney - contrato expira em 2026',
      time: '1 ano',
    },
    {
      id: 'alert-2',
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      title: 'Acompanhar moral do piloto',
      desc: 'G. Bortoleto tem demonstrado insatisfação com ritmo de desenvolvimento do carro',
      time: '2 dias',
    },
    {
      id: 'alert-3',
      icon: Info,
      iconColor: 'text-cyan-400',
      title: 'Avaliar renovação de staff',
      desc: 'E. Cardile - interesse de outras equipes',
      time: '3 dias',
    },
  ]

  // Modais de detalhes da nova camada UX
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [isManagerModalOpen, setIsManagerModalOpen] = useState(false)
  const [selectedPilotForProfile, setSelectedPilotForProfile] = useState<any>(null)
  const [isPilotProfileModalOpen, setIsPilotProfileModalOpen] = useState(false)

  // Metadados do retrato oficial do Manager selecionado
  const managerOfficialPortrait = useMemo(() => {
    return getManagerOfficialPortrait(team)
  }, [team])

  // Avaliação do Manager canônico (para atributos detalhados)
  const managerEvaluation = useMemo(() => {
    return managerEffectService.evaluateManager(team)
  }, [team])

  // Cálculo da pontuação e ranking de construtores vindo da tabela/serviço unificado
  const { constructorRank, constructorTotalPoints } = useMemo(() => {
    try {
      const standingsResult = standingsService.calculateStandings({
        raceResults: [],
        playerDrivers: titularDrivers,
        team,
        season,
      })
      if (standingsResult) {
        return {
          constructorRank: standingsResult.playerConstructorRank ?? 3,
          constructorTotalPoints: standingsResult.teamPoints ?? 65,
        }
      }
    } catch {
      // fallback gracioso
    }
    return {
      constructorRank: 3,
      constructorTotalPoints: 65,
    }
  }, [titularDrivers, team, season])

  // Capacidade Organizacional departamental (Aerodinâmica 72, Engenharia 84, Operações 88, Comercial 79)
  const orgCapacities: DepartmentCapacity = useMemo(() => {
    const aero = Math.round((team as any)?.aero_level ?? 72)
    const eng = Math.round(teamStrength ? Math.min(95, teamStrength + 32) : 84)
    const ops = Math.round((team as any)?.operations_rating || 88)
    const com = Math.round((team as any)?.commercial_rating || 79)
    return {
      aerodynamics: aero || 72,
      engineering: eng || 84,
      trackOperations: ops || 88,
      commercial: com || 79,
    }
  }, [team, teamStrength])

  // Gargalo departamental dinâmico (departamento de menor score)
  const bottleneckInfo = useMemo(() => {
    const list = [
      {
        name: 'Aerodinâmica',
        score: orgCapacities.aerodynamics,
        impact: 'Impacto: atraso no desenvolvimento aerodinâmico',
      },
      {
        name: 'Engenharia',
        score: orgCapacities.engineering,
        impact: 'Impacto: menor eficiência em peças e upgrades',
      },
      {
        name: 'Operações de pista',
        score: orgCapacities.trackOperations,
        impact: 'Impacto: risco em paradas e acerto do carro',
      },
      {
        name: 'Comercial',
        score: orgCapacities.commercial,
        impact: 'Impacto: atratividade reduzida para patrocinadores',
      },
    ]
    list.sort((a, b) => a.score - b.score)
    return {
      name: list[0].name,
      impact: list[0].impact,
    }
  }, [orgCapacities])

  // KPIs de Saúde Organizacional
  const orgHealthKpis = useMemo(() => {
    const teamMorale = Math.round(overallMorale || 82)
    const operationalEfficiency = 78
    const cohesion = 85
    const internalPressure = Math.max(10, Math.min(90, Math.round(100 - (boardConfidence || 64))))
    return {
      teamMorale,
      operationalEfficiency,
      cohesion,
      internalPressure,
    }
  }, [overallMorale, boardConfidence])

  // Objetivos da Diretoria derivados de board_confidence e metas da equipe
  const boardObjectivesList: BoardObjectiveItem[] = useMemo(() => {
    return [
      {
        id: 'obj-1',
        area: 'Campeonato',
        description: 'Terminar a temporada no Top 4 de Construtores',
        progressPct: Math.min(100, Math.round((constructorTotalPoints / 120) * 100)),
        statusValue: `${constructorTotalPoints}/120 pts (3º lugar)`,
        chipStatus: 'No caminho',
      },
      {
        id: 'obj-2',
        area: 'Financeiro',
        description: 'Manter margem sob o teto de gastos de 135M',
        progressPct: Math.min(100, Math.round((currentCostCapSpent / COST_CAP_LIMIT) * 100)),
        statusValue: `${formatCurrency(remainingCostCap)} livres`,
        chipStatus: remainingCostCap > 20000000 ? 'No caminho' : 'Atenção',
      },
      {
        id: 'obj-3',
        area: 'Desenvolvimento do Carro',
        description: 'Superar o gargalo aerodinâmico antes da rodada 8',
        progressPct: orgCapacities.aerodynamics,
        statusValue: `${orgCapacities.aerodynamics}/100 índice`,
        chipStatus: orgCapacities.aerodynamics < 75 ? 'Atenção' : 'Adiantado',
      },
      {
        id: 'obj-4',
        area: 'Desenvolvimento dos Pilotos',
        description: 'Consolidar Bortoleto na zona de pontos frequente',
        progressPct: 80,
        statusValue: 'Meta 80% cumprida',
        chipStatus: 'No caminho',
      },
    ]
  }, [
    constructorTotalPoints,
    currentCostCapSpent,
    COST_CAP_LIMIT,
    remainingCostCap,
    orgCapacities.aerodynamics,
  ])

  // Decisões pendentes organizacionais (máx 3 na tela principal)
  const pendingDecisionsList: PendingDecisionItem[] = useMemo(() => {
    return [
      {
        id: 'dec-1',
        title: 'Renovar contrato do chefe de aerodinâmica',
        priority: 'ALTA',
        actionTab: 'staff',
      },
      {
        id: 'dec-2',
        title: 'Resolver atrito entre piloto e engenharia',
        priority: 'ALTA',
        actionTab: 'cultura_moral',
      },
      {
        id: 'dec-3',
        title: 'Aprovar contratação para o departamento técnico',
        priority: 'MÉDIA',
        actionTab: 'staff',
      },
    ]
  }, [])

  // Staff técnico chave formatado
  const keyStaffSummaryList: KeyStaffMemberItem[] = useMemo(() => {
    return [
      {
        id: 'staff-1',
        name: 'James Key',
        role: 'Diretor Técnico',
        overallRating: 89,
        moralStatus: 'Alta',
        photoUrl: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=44',
      },
      {
        id: 'staff-2',
        name: 'Sophie Keller',
        role: 'Chefe de Aerodinâmica',
        overallRating: 86,
        moralStatus: 'Alta',
        photoUrl: 'https://img.usecurling.com/ppl/thumbnail?gender=female&seed=88',
      },
      {
        id: 'staff-3',
        name: 'Thomas Weber',
        role: 'Diretor de Engenharia',
        overallRating: 84,
        moralStatus: 'Estável',
        photoUrl: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=62',
      },
      {
        id: 'staff-4',
        name: 'Elena Moretti',
        role: 'Chefe de Estratégia',
        overallRating: 82,
        moralStatus: 'Alta',
        photoUrl: 'https://img.usecurling.com/ppl/thumbnail?gender=female&seed=91',
      },
      {
        id: 'staff-5',
        name: 'Markus Steiner',
        role: 'Diretor Comercial',
        overallRating: 80,
        moralStatus: 'Estável',
        photoUrl: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=33',
      },
    ]
  }, [])

  // Handlers for engine switch
  const handleSwitchSupplier = async () => {
    if (!selectedSupplier || !team) return

    if (currentCostCapSpent + ENGINE_SWITCH_FEE > COST_CAP_LIMIT) {
      toast({
        variant: 'destructive',
        title: 'Bloqueio FIA: Teto de Gastos Atingido!',
        description: `A taxa de rescisão e readequação de chassi de ${formatCurrency(ENGINE_SWITCH_FEE)} excede o limite (${formatCurrency(COST_CAP_LIMIT)}).`,
      })
      return
    }

    if (team.budget < ENGINE_SWITCH_FEE) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `A rescisão e adaptação de chassi exige ${formatCurrency(ENGINE_SWITCH_FEE)}.`,
      })
      return
    }

    setIsSwitchingEngine(true)
    try {
      const newBudget = team.budget - ENGINE_SWITCH_FEE
      const newSpentCap = currentCostCapSpent + ENGINE_SWITCH_FEE

      // Registro Canônico no Financial Ledger (Troca de Fornecedor de Motor)
      try {
        const { financialLedgerService } = await import('@/services/financialLedgerService')
        await financialLedgerService.postTransaction({
          teamId: team.id,
          seasonYear: season?.year || 2026,
          round: season?.current_round || 1,
          type: 'expense',
          category: 'development',
          subcategory: 'engine_switch_fee',
          direction: 'outflow',
          amount: ENGINE_SWITCH_FEE,
          costCapClassification: 'included',
          sourceSystem: 'engine_supplier_switch',
          sourceEntityId: `switch_to_${selectedSupplier.name}`,
          idempotencyKey: `engine_switch_${team.id}_${selectedSupplier.name}_${Date.now()}`,
          description: `Taxa de rescisão e adaptação de chassi para unidade ${selectedSupplier.name}`,
        })
      } catch (finErr) {
        console.warn('Erro ao lançar troca de motor no FinancialLedger:', finErr)
      }

      await f1Service.updateTeam(team.id, {
        engine_supplier: selectedSupplier.name,
        budget: newBudget,
        cost_cap_spent: newSpentCap,
      })

      await f1Service.addEvent(
        team.id,
        `Fornecedor de unidade de potência trocado para ${selectedSupplier.name}.`,
        'desenvolvimento',
      )

      toast({
        title: 'Fornecedor de Motor Atualizado!',
        description: `A equipe agora é impulsionada pela unidade ${selectedSupplier.name} 50/50 Híbrida.`,
      })

      setSelectedSupplier(null)
      await refreshTeamAndSeason()
      await loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na troca de motor',
        description: err?.message || 'Falha ao alterar fornecedor de motor.',
      })
    } finally {
      setIsSwitchingEngine(false)
    }
  }

  // Renegotiate contract handler
  const handleRenegotiate = async () => {
    if (!renegotiateDriver || !team) return
    setIsProcessing(true)
    try {
      const newSalary = Math.round(renegotiateDriver.salary * (salaryMultiplier / 100))
      const newContractEnd = 2026 + contractYears

      await f1Service.updateDriver(renegotiateDriver.id, {
        salary: newSalary,
        contract_end: newContractEnd,
      })

      await f1Service.addEvent(
        team.id,
        `Contrato de ${renegotiateDriver.name} renovado até ${newContractEnd} por ${formatCurrency(newSalary)}/ano.`,
        'contrato',
      )

      toast({
        title: 'Contrato Renegociado!',
        description: `${renegotiateDriver.name} assinou até ${newContractEnd}.`,
      })

      setRenegotiateDriver(null)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na renegociação',
        description: err?.message || 'Não foi possível renegociar o contrato.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Fire driver handler
  const handleFire = async () => {
    if (!fireDriver || !team) return
    setIsProcessing(true)
    try {
      const penaltyCost = Math.round(fireDriver.salary * 0.5)
      if (team.budget < penaltyCost) {
        toast({
          variant: 'destructive',
          title: 'Orçamento Insuficiente',
          description: `Você precisa de ${formatCurrency(penaltyCost)} para pagar a multa rescisória de 50%.`,
        })
        setIsProcessing(false)
        return
      }

      const seasonYear = season?.year || 2026
      const currentRound = season?.current_round || 1

      // 1. Registro Canônico no Financial Ledger (Multa Rescisória de Piloto)
      // O Ledger é a única fonte de verdade contábil.
      // A chave idempotente é determinística por equipe, piloto, temporada e rodada.
      // O syncTeamBudgetCache reconcilia o espelho/cache team.budget canonicamente — sem escrita direta.
      if (penaltyCost > 0) {
        try {
          await financialLedgerService.postTransaction({
            teamId: team.id,
            seasonYear,
            round: currentRound,
            type: 'expense',
            category: 'penalties',
            subcategory: 'driver_contract_termination',
            direction: 'outflow',
            amount: penaltyCost,
            costCapClassification: 'excluded', // Multas rescisórias de pilotos são excluídas do Cost Cap FIA
            sourceSystem: 'driver_termination',
            sourceEntityId: fireDriver.id,
            idempotencyKey: `driver_termination_fee_${team.id}_${fireDriver.id}_${seasonYear}_r${currentRound}`,
            description: `Multa rescisória de 50% pela dispensa de ${fireDriver.name}`,
          })
        } catch (finErr) {
          console.warn('Erro ao lançar rescisão no FinancialLedger:', finErr)
        }
      }

      // Reconciliação canônica do espelho de caixa em team.budget a partir do Ledger (sem escrita direta)
      await financialLedgerService.syncTeamBudgetCache(team.id, seasonYear)
      await f1Service.fireDriver(fireDriver.id)

      await f1Service.addEvent(
        team.id,
        `${fireDriver.name} foi dispensado. Multa rescisória de ${formatCurrency(penaltyCost)} paga.`,
        'contrato',
      )

      toast({
        title: 'Piloto Dispensado',
        description: `${fireDriver.name} liberado para o mercado.`,
      })

      setFireDriver(null)
      await refreshTeamAndSeason()
      await loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao demitir piloto',
        description: err?.message || 'Falha ao processar rescisão.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Save FP Schedule handler
  const handleSaveFpSchedule = async () => {
    if (!reserveDriver || !team) return
    if (selectedFpRounds.length !== 2) {
      toast({
        variant: 'destructive',
        title: 'Seleção Inválida',
        description: 'Você deve selecionar exatamente 2 Grandes Prêmios.',
      })
      return
    }

    setIsProcessing(true)
    try {
      await f1Service.scheduleReserveFP(reserveDriver.id, selectedFpRounds)
      toast({
        title: 'Treinos Livres Agendados!',
        description: `${reserveDriver.name} participará do FP1 nos GPs ${selectedFpRounds.join(' e ')}.`,
      })
      setFpModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao agendar treinos livres',
        description: err?.message || 'Não foi possível agendar.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleFpRound = (roundNumber: number) => {
    if (selectedFpRounds.includes(roundNumber)) {
      setSelectedFpRounds(selectedFpRounds.filter((r) => r !== roundNumber))
    } else {
      if (selectedFpRounds.length >= 2) {
        setSelectedFpRounds([selectedFpRounds[1], roundNumber])
      } else {
        setSelectedFpRounds([...selectedFpRounds, roundNumber])
      }
    }
  }

  return (
    <div className="relative space-y-6 pb-12 animate-fade-in-up">
      <AmbientBackground />

      {/* HEADER PRINCIPAL CONFORME MOCKUP */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black italic tracking-tight text-white font-serif">
            Equipe
          </h1>
          <p className="text-xs sm:text-sm font-medium tracking-wide text-neutral-400 mt-1">
            Pessoas. Estrutura. Cultura. Performance.
          </p>
        </div>

        {/* CITAÇÃO NO TOPO DIREITO */}
        <div className="hidden lg:block text-right">
          <p className="text-xs font-serif italic text-neutral-300">
            &ldquo;Pessoas constroem performance.&rdquo;
          </p>
          <span className="text-[11px] font-bold tracking-widest text-[#E10600] uppercase font-mono">
            Audi
          </span>
        </div>
      </div>

      {/* BARRA DE SUB-ABAS NO DESIGN SYSTEM APEX */}
      <div className="flex items-center gap-1.5 border-b border-neutral-200/80 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'visao_geral', label: 'Visão Geral' },
          { id: 'pilotos', label: 'Pilotos & Homologação' },
          { id: 'staff', label: 'Staff' },
          { id: 'contratos', label: 'Contratos' },
          { id: 'academia', label: 'Academia' },
          { id: 'cultura_moral', label: 'Cultura & Moral' },
        ].map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as TeamSubTab)
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#E10600] text-white shadow-sm font-bold'
                  : 'bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ABA PRINCIPAL: VISÃO GERAL REESTRUTURADA CONFORME MOCKUP */}
      {activeTab === 'visao_geral' && (
        <div className="space-y-6">
          {/* 1. LINHA HERO DA EQUIPE + SOBRE A EQUIPE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* HERO HORIZONTAL DA EQUIPE (8 colunas) */}
            <div className="lg:col-span-8 flex flex-col">
              <TeamHeroBanner
                teamName={teamName}
                tagline="Tecnologia. Pessoas. Performance."
                bgImage={audiGarageHeroImg}
                constructorPosition={constructorRank}
                constructorPoints={constructorTotalPoints}
                reputation={(team as any)?.prestige_rating || (team as any)?.strength || 88}
                seasonTarget="Top 4"
                pointsProgress={{ current: constructorTotalPoints, target: 120 }}
                onOpenDetails={() => setIsAboutModalOpen(true)}
              />
            </div>

            {/* SOBRE A EQUIPE LATERAL (4 colunas) */}
            <div className="lg:col-span-4 flex flex-col">
              <AboutTeamCard
                baseLocation={teamHq}
                engineSupplier={team?.engine_supplier || 'Audi'}
                nationality={teamCountry}
                status="Projeto em ascensão"
                quote="“Mais que uma equipe. Um futuro em movimento.”"
                onOpenDetails={() => setIsAboutModalOpen(true)}
              />
            </div>
          </div>

          {/* 2. SEGUNDA LINHA: MANAGER + PILOTO 1 + PILOTO 2 (3 cards no mesmo nível) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
            {/* CARD DO MANAGER COM FOTO OFICIAL DO ARQUÉTIPO (col-span-5) */}
            <div className="lg:col-span-5 flex flex-col">
              <ManagerExecutiveCard
                managerName={teamPrincipalName}
                roleTitle="Team Principal"
                archetypeTitle={managerOfficialPortrait.archetypeTitle}
                portraitUrl={managerOfficialPortrait.imageUrl}
                attributes={managerOfficialPortrait.topAttributes}
                boardConfidenceText={
                  boardConfidence >= 80
                    ? 'Muito alta'
                    : boardConfidence >= 60
                      ? 'Alta'
                      : 'Em atenção'
                }
                onOpenProfile={() => setIsManagerModalOpen(true)}
              />
            </div>

            {/* PILOTO #1 (col-span-3.5 aprox -> col-span-4/col-span-3.5) */}
            <div className="lg:col-span-3.5 flex flex-col">
              {(() => {
                const d1 = titularDrivers[0] || {
                  id: 'ricciardo-fallback',
                  name: 'Daniel Ricciardo',
                  nationality: 'Austrália',
                  speed: 87,
                  consistency: 82,
                  morale: 78,
                  physical_condition: 85,
                  contract_end: 2026,
                }
                const ovr1 = Math.round(((d1.speed || 87) + (d1.consistency || 82)) / 2)
                const isRicciardo = d1.name.toLowerCase().includes('ricciardo')
                const photoSrc = isRicciardo ? ricciardoBundledImg : undefined
                const mbj1 = MBJ_2026_PILOTS.find(
                  (p) =>
                    p.id === d1.id ||
                    p.name.toLowerCase().trim() === (d1.name || '').toLowerCase().trim(),
                )
                const driverObj1 = {
                  id: d1.id,
                  permanentNumber:
                    (d1 as any).permanentNumber ??
                    (d1 as any).permanent_number ??
                    mbj1?.permanentNumber ??
                    null,
                  preferredNumber: (d1 as any).preferredNumber ?? mbj1?.preferredNumber ?? null,
                }
                const activeNum1 = getDriverActiveNumber(driverObj1, reigningChampionId) ?? 1

                return (
                  <DriverSummaryCard
                    slotNumber={1}
                    driverName={d1.name}
                    driverNumber={activeNum1}
                    nationality={d1.nationality || 'Austrália'}
                    overallRating={ovr1 || 87}
                    moral={d1.morale || 78}
                    forma={d1.physical_condition || 85}
                    consistency={d1.consistency || 82}
                    contractEndYear={d1.contract_end || 2026}
                    bundledImg={photoSrc}
                    driverId={d1.id}
                    onOpenDriver={() => {
                      setSelectedPilotForProfile({
                        ...d1,
                        teamName,
                        role: 'Titular',
                        isPlayerDriver: true,
                        salaryUsd: (d1 as any).salary ?? (d1 as any).salaryUsd,
                      })
                      setIsPilotProfileModalOpen(true)
                    }}
                  />
                )
              })()}
            </div>

            {/* PILOTO #2 (col-span-3.5) */}
            <div className="lg:col-span-3.5 flex flex-col">
              {(() => {
                const d2 = titularDrivers[1] || {
                  id: 'bortoleto-fallback',
                  name: 'Gabriel Bortoleto',
                  nationality: 'Brasil',
                  speed: 82,
                  consistency: 78,
                  morale: 75,
                  physical_condition: 80,
                  contract_end: 2028,
                }
                const ovr2 = Math.round(((d2.speed || 82) + (d2.consistency || 78)) / 2)
                const isBortoleto = d2.name.toLowerCase().includes('bortoleto')
                const photoSrc = isBortoleto ? bortoletoBundledImg : undefined
                const mbj2 = MBJ_2026_PILOTS.find(
                  (p) =>
                    p.id === d2.id ||
                    p.name.toLowerCase().trim() === (d2.name || '').toLowerCase().trim(),
                )
                const driverObj2 = {
                  id: d2.id,
                  permanentNumber:
                    (d2 as any).permanentNumber ??
                    (d2 as any).permanent_number ??
                    mbj2?.permanentNumber ??
                    null,
                  preferredNumber: (d2 as any).preferredNumber ?? mbj2?.preferredNumber ?? null,
                }
                const activeNum2 = getDriverActiveNumber(driverObj2, reigningChampionId) ?? 2

                return (
                  <DriverSummaryCard
                    slotNumber={2}
                    driverName={d2.name}
                    driverNumber={activeNum2}
                    nationality={d2.nationality || 'Brasil'}
                    overallRating={ovr2 || 81}
                    moral={d2.morale || 75}
                    forma={d2.physical_condition || 80}
                    consistency={d2.consistency || 78}
                    contractEndYear={d2.contract_end || 2028}
                    bundledImg={photoSrc}
                    driverId={d2.id}
                    onOpenDriver={() => {
                      setSelectedPilotForProfile({
                        ...d2,
                        teamName,
                        role: 'Titular',
                        isPlayerDriver: true,
                        salaryUsd: (d2 as any).salary ?? (d2 as any).salaryUsd,
                      })
                      setIsPilotProfileModalOpen(true)
                    }}
                  />
                )
              })()}
            </div>
          </div>

          {/* 3. TERCEIRA LINHA: EQUIPE TÉCNICA + CAPACIDADE ORGANIZACIONAL + DECISÕES PENDENTES */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* EQUIPE TÉCNICA (col-span-5) */}
            <div className="lg:col-span-5 flex flex-col">
              <TechnicalStaffSummaryCard
                staffList={keyStaffSummaryList}
                onOpenFullStaff={() => setActiveTab('staff')}
                onSelectMember={(_m) => setActiveTab('staff')}
              />
            </div>

            {/* CAPACIDADE ORGANIZACIONAL (Gargalos e Operações) (col-span-4) */}
            <div className="lg:col-span-4 flex flex-col">
              <OrganizationalCapacityCard
                capacities={orgCapacities}
                bottleneckText={bottleneckInfo.name}
                bottleneckImpact={bottleneckInfo.impact}
                onOpenDetails={() => setActiveTab('staff')}
              />
            </div>

            {/* DECISÕES PENDENTES (col-span-3) */}
            <div className="lg:col-span-3 flex flex-col">
              <PendingDecisionsCard
                decisions={pendingDecisionsList}
                onOpenAll={() => setActiveTab('staff')}
                onSelectDecision={(d) => {
                  if (d.actionTab) {
                    setActiveTab(d.actionTab as TeamSubTab)
                  }
                }}
              />
            </div>
          </div>

          {/* 4. QUARTA LINHA: SAÚDE DA ORGANIZAÇÃO + OBJETIVOS DA DIRETORIA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* SAÚDE DA ORGANIZAÇÃO (col-span-5) */}
            <div className="lg:col-span-5 flex flex-col">
              <OrganizationHealthCard kpis={orgHealthKpis} />
            </div>

            {/* OBJETIVOS DA DIRETORIA (col-span-7) */}
            <div className="lg:col-span-7 flex flex-col">
              <BoardObjectivesCard
                objectives={boardObjectivesList}
                onOpenObjectives={() => {
                  toast({
                    title: 'Objetivos da Diretoria',
                    description: `Meta anual: Top 4. Confiança do conselho em ${boardConfidence}%.`,
                  })
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA: PILOTOS & HOMOLOGAÇÃO */}
      {activeTab === 'pilotos' && (
        <div className="space-y-6">
          <Card className="bg-[#0B0E14] border-neutral-800/80">
            <CardHeader className="border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#E10600]" />
                  Quadro de Pilotos, Homologação & Adaptação F1
                </CardTitle>
                <CardDescription className="text-xs text-neutral-400">
                  Gerenciamento de pilotos titulares, reservas e cumprimento das exigências de
                  Superlicença FIA e Treinos Livres.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/pilotos')}
                className="border-neutral-700 text-neutral-300 hover:text-white shrink-0"
              >
                Mercado Completo FIA →
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 font-mono">
                {/* Pilotos Titulares */}
                {titularDrivers.map((d, idx) => {
                  const ovr = Math.round(((d.speed || 80) + (d.consistency || 80)) / 2)
                  const adaptation = d.f1_adaptation ?? 80
                  const status = d.homologation_status || 'elegivel'

                  return (
                    <div
                      key={d.id}
                      className="p-4 rounded-xl bg-black/40 border border-neutral-800 flex flex-col justify-between space-y-4 shadow-lg"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                          <span className="font-bold text-white uppercase">Titular #{idx + 1}</span>
                          <span className="text-sm">{getCountryFlag(d.nationality)}</span>
                        </div>

                        <div
                          className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            setSelectedPilotForProfile({
                              ...d,
                              teamName,
                              role: 'Titular',
                              isPlayerDriver: true,
                              salaryUsd: d.salary,
                            })
                            setIsPilotProfileModalOpen(true)
                          }}
                        >
                          <DriverPhotoAvatar name={d.name} teamColor="#E10600" size="md" />
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-white truncate hover:underline">
                              {d.name}
                            </h3>
                            <div className="text-xs text-neutral-400">
                              Idade: {d.age || 25} anos • OVR:{' '}
                              <strong className="text-white">{ovr}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Status FIA & Adaptação F1 */}
                      <div className="space-y-2 pt-2 border-t border-neutral-800/80 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Status FIA:</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Superlicença Válida
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-neutral-400">
                            <span>Adaptação à F1</span>
                            <span className="text-cyan-400 font-bold">
                              {adaptation}% / meta 80%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (adaptation / 80) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-neutral-500 block">
                            Ritmo em corrida F1 e adaptação aerodinâmica
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-800/60 text-[11px] text-neutral-400 flex justify-between">
                        <span>Contrato até {d.contract_end || 2027}</span>
                        <span className="text-white font-semibold">
                          {formatCurrency(d.salary || 5000000)}/ano
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* Piloto Reserva */}
                {(() => {
                  const rd = reserveDriver
                  if (!rd) return null
                  const ovrR = Math.round(((rd.speed || 78) + (rd.consistency || 77)) / 2)
                  const status =
                    rd.homologation_status ||
                    calcularElegibilidade(rd.age || 21, rd.superlicense_points || 0, 0)
                  const sessionsDone = rd.homologation_sessions_done ?? 0
                  const adaptation = rd.f1_adaptation ?? 0
                  const isHomologation = status === 'homologacao'

                  return (
                    <div className="p-4 rounded-xl bg-black/40 border border-amber-500/30 flex flex-col justify-between space-y-4 shadow-lg">
                      <div>
                        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                          <span className="font-bold text-amber-400 uppercase">Piloto Reserva</span>
                          <span className="text-sm">{getCountryFlag(rd.nationality)}</span>
                        </div>

                        <div
                          className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            setSelectedPilotForProfile({
                              ...rd,
                              teamName,
                              role: 'Reserva',
                              isPlayerDriver: true,
                              salaryUsd: rd.salary,
                            })
                            setIsPilotProfileModalOpen(true)
                          }}
                        >
                          <DriverPhotoAvatar
                            name={rd.name}
                            driverId={rd.id}
                            teamColor="#D97706"
                            size="md"
                          />
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-white truncate hover:underline">
                              {rd.name}
                            </h3>
                            <div className="text-xs text-neutral-400">
                              Idade: {rd.age || 22} anos • OVR:{' '}
                              <strong className="text-white">{ovrR}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Status FIA & Homologação */}
                      <div className="space-y-2.5 pt-2 border-t border-neutral-800/80 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400">Status Regulamentar:</span>
                          {status === 'formacao' && (
                            <span className="text-purple-400 font-bold flex items-center gap-1">
                              <GraduationCap className="w-3.5 h-3.5" /> Formação
                            </span>
                          )}
                          {status === 'homologacao' && (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Em Homologação
                            </span>
                          )}
                          {status === 'elegivel' && (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Elegível FIA
                            </span>
                          )}
                        </div>

                        {/* Progresso de Homologação TL1 */}
                        {isHomologation && (
                          <div className="p-2.5 bg-amber-950/30 border border-amber-500/40 rounded-lg space-y-1.5">
                            <div className="flex justify-between text-[11px] text-amber-300 font-bold">
                              <span>Sessões TL1 (100 km):</span>
                              <span>{sessionsDone}/2 sessões</span>
                            </div>
                            <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (sessionsDone / 2) * 100)}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-amber-200/80 leading-tight">
                              Escale o piloto em treinos livres (TL1) para homologá-lo como titular
                              da F1.
                            </p>
                          </div>
                        )}

                        {/* Adaptação à F1 */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-neutral-400">
                            <span>Adaptação à F1:</span>
                            <span className="text-cyan-400 font-bold">
                              {adaptation}% / meta 80%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, (adaptation / 80) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-neutral-500 block">
                            +8% por sessão TL1 disputada • +3,5% de bancada
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-800/60 text-[11px] text-neutral-400 flex justify-between">
                        <span>Contrato até {rd.contract_end || 2026}</span>
                        <span className="text-white font-semibold">
                          {formatCurrency(rd.salary || 1200000)}/ano
                        </span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-ABA: STAFF & ORGANIZAÇÃO TÉCNICA (IMPLEMENTAÇÃO 7B) */}
      {activeTab === 'staff' &&
        (() => {
          const managerEval = managerEffectService.evaluateManager(team)
          return (
            <div className="space-y-6">
              {/* Bloco Canônico do Team Principal e seus 6 Domínios Operacionais */}
              <Card className="bg-[#0B0E14] border-neutral-800/80">
                <CardHeader className="border-b border-neutral-800 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-amber-500" />
                        Team Principal & Liderança: {managerEval.managerName}
                      </CardTitle>
                      <CardDescription className="text-xs text-neutral-400 mt-1">
                        Arquétipo:{' '}
                        <strong className="text-amber-400 font-bold">
                          {managerEval.archetypeTitle}
                        </strong>{' '}
                        — {managerEval.specialty}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className="self-start sm:self-auto border-amber-500/40 text-amber-400 bg-amber-500/10 font-mono text-xs uppercase"
                    >
                      Atributos Derivados (Anti-Stacking Ativo)
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  {/* Grade dos 6 Domínios Canônicos */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
                    {Object.entries(MANAGER_DOMAINS).map(([domKey, domMeta]) => {
                      const score =
                        managerEval.domainScores[domKey as keyof typeof managerEval.domainScores]
                      const delta = score - 75
                      return (
                        <div
                          key={domKey}
                          className="p-3.5 rounded-xl bg-black/40 border border-neutral-800 flex flex-col justify-between"
                        >
                          <div>
                            <span className="text-[10px] text-neutral-400 uppercase block tracking-wider truncate">
                              {domMeta.name}
                            </span>
                            <span className="text-2xl font-black text-white block mt-1">
                              {score}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[10px]">
                            <span className="text-neutral-500">Base 75</span>
                            <span
                              className={`font-bold ${
                                delta > 0
                                  ? 'text-emerald-400'
                                  : delta < 0
                                    ? 'text-rose-400'
                                    : 'text-neutral-400'
                              }`}
                            >
                              {delta > 0 ? `+${delta}` : `${delta}`}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Resumo de Efeitos Ativos e Balanceados */}
                  <div className="p-4 rounded-xl bg-black/30 border border-neutral-800 text-xs font-mono space-y-2">
                    <div className="text-[#8B95A7] font-bold uppercase text-[11px] flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-cyan-400" />
                      Impactos Aplicados na Operação da Escuderia (Sem Alterar Física do Monoposto):
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-neutral-300 pt-1">
                      <div className="p-2 rounded bg-neutral-900/40 border border-neutral-800/80">
                        <span className="text-neutral-500 block text-[10px]">Estratégia & SC:</span>
                        <strong className="text-amber-400">
                          {managerEval.modifiers.strategyDecisionBonus >= 0 ? '+' : ''}
                          {(managerEval.modifiers.strategyDecisionBonus * 100).toFixed(1)}%
                          confiança
                        </strong>
                      </div>
                      <div className="p-2 rounded bg-neutral-900/40 border border-neutral-800/80">
                        <span className="text-neutral-500 block text-[10px]">
                          Retenção de Moral:
                        </span>
                        <strong className="text-emerald-400">
                          {managerEval.modifiers.moraleRecoveryBonus >= 0 ? '+' : ''}
                          {(managerEval.modifiers.moraleRecoveryBonus * 100).toFixed(1)}%
                          amortecimento
                        </strong>
                      </div>
                      <div className="p-2 rounded bg-neutral-900/40 border border-neutral-800/80">
                        <span className="text-neutral-500 block text-[10px]">
                          Captação Comercial:
                        </span>
                        <strong className="text-purple-400">
                          {managerEval.modifiers.sponsorValueBonus >= 0 ? '+' : ''}
                          {(managerEval.modifiers.sponsorValueBonus * 100).toFixed(1)}% receita
                        </strong>
                      </div>
                      <div className="p-2 rounded bg-neutral-900/40 border border-neutral-800/80">
                        <span className="text-neutral-500 block text-[10px]">
                          Lapidação na Academia:
                        </span>
                        <strong className="text-pink-400">
                          {managerEval.modifiers.academyDevelopmentBonus >= 0 ? '+' : ''}
                          {(managerEval.modifiers.academyDevelopmentBonus * 100).toFixed(1)}%
                          aprendizado
                        </strong>
                      </div>
                      <div className="p-2 rounded bg-neutral-900/40 border border-neutral-800/80">
                        <span className="text-neutral-500 block text-[10px]">
                          Oficina & Revisões:
                        </span>
                        <strong className="text-cyan-400">
                          {managerEval.modifiers.workshopEfficiencyBonus >= 0 ? '+' : ''}
                          {(managerEval.modifiers.workshopEfficiencyBonus * 100).toFixed(1)}%
                          eficiência
                        </strong>
                      </div>
                      <div className="p-2 rounded bg-neutral-900/40 border border-neutral-800/80">
                        <span className="text-neutral-500 block text-[10px]">
                          Confiança do Conselho:
                        </span>
                        <strong className="text-blue-400">
                          {managerEval.modifiers.boardTrustBonus >= 0 ? '+' : ''}
                          {(managerEval.modifiers.boardTrustBonus * 100).toFixed(1)}% suporte
                        </strong>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Seção Canônica Completa de Staff e Organização Técnica (7B) */}
              <TechnicalOrganizationSection
                team={team}
                onOrganizationUpdated={(_updatedOrg) => {
                  if (refreshTeamAndSeason) refreshTeamAndSeason()
                }}
              />
            </div>
          )
        })()}

      {/* SUB-ABA: CONTRATOS */}
      {activeTab === 'contratos' && (
        <div className="space-y-6">
          <Card className="bg-[#0B0E14] border-neutral-800/80">
            <CardHeader className="border-b border-neutral-800">
              <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#E10600]" />
                Gestão de Vínculos Contratuais
              </CardTitle>
              <CardDescription className="text-xs text-neutral-400">
                Acompanhe o vencimento de contratos, salários vigentes e planeje renovações
                antecipadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3 font-mono text-xs">
                {titularDrivers.concat(reserveDriver ? [reserveDriver] : []).map((d) => (
                  <div
                    key={d.id}
                    className="p-4 rounded-xl bg-black/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <DriverPhotoAvatar name={d.name} teamColor="#E10600" size="sm" />
                      <div>
                        <span className="font-bold text-white text-sm block">{d.name}</span>
                        <span className="text-[11px] text-neutral-400">
                          Função: {d.role === 'reserva' ? 'Piloto Reserva' : 'Piloto Titular'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-[10px] text-neutral-400 block">Salário Anual</span>
                        <strong className="text-white">{formatCurrency(d.salary)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-400 block">Término</span>
                        <strong className="text-emerald-400">{d.contract_end || 2026}</strong>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setRenegotiateDriver(d)
                          setSalaryMultiplier(100)
                          setContractYears(1)
                        }}
                        className="bg-[#E10600] hover:bg-red-700 text-white text-xs h-7 font-bold"
                      >
                        Renovar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-ABA: ACADEMIA (EVOLUÇÃO 4C COM SUB-ÁREAS E FOG-OF-WAR) */}
      {activeTab === 'academia' && (
        <div className="space-y-6">
          {/* Subnavegação da Academia */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
            <div className="flex flex-wrap gap-1 bg-neutral-900/60 p-1 rounded-xl border border-neutral-800">
              <Button
                size="sm"
                variant={academySubArea === 'programa' ? 'default' : 'ghost'}
                onClick={() => setAcademySubArea('programa')}
                className={`text-xs ${
                  academySubArea === 'programa'
                    ? 'bg-cyan-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 mr-1.5" />
                Programa ({teamAcademyPilots.length})
              </Button>

              <Button
                size="sm"
                variant={academySubArea === 'scouting' ? 'default' : 'ghost'}
                onClick={() => setAcademySubArea('scouting')}
                className={`text-xs ${
                  academySubArea === 'scouting'
                    ? 'bg-cyan-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Search className="w-3.5 h-3.5 mr-1.5" />
                Scouting ({scoutingCandidates.length})
              </Button>

              <Button
                size="sm"
                variant={academySubArea === 'desenvolvimento' ? 'default' : 'ghost'}
                onClick={() => setAcademySubArea('desenvolvimento')}
                className={`text-xs ${
                  academySubArea === 'desenvolvimento'
                    ? 'bg-cyan-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                Desenvolvimento
              </Button>

              <Button
                size="sm"
                variant={academySubArea === 'caminho_f1' ? 'default' : 'ghost'}
                onClick={() => setAcademySubArea('caminho_f1')}
                className={`text-xs ${
                  academySubArea === 'caminho_f1'
                    ? 'bg-cyan-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Gauge className="w-3.5 h-3.5 mr-1.5" />
                Caminho F1 & Testes
              </Button>

              <Button
                size="sm"
                variant={academySubArea === 'historico' ? 'default' : 'ghost'}
                onClick={() => setAcademySubArea('historico')}
                className={`text-xs ${
                  academySubArea === 'historico'
                    ? 'bg-cyan-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5 mr-1.5" />
                Histórico & Ex-Pilotos ({academyAlumni.length})
              </Button>
            </div>

            {/* Ferramenta de Auditoria Técnica e Debug */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsDebugModalOpen(true)}
              className="text-xs border-amber-800/60 bg-amber-950/20 text-amber-300 hover:bg-amber-900/40"
            >
              <Cpu className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Prospect Debug (Engenharia)
            </Button>
          </div>

          {/* 1. SUB-ÁREA: PROGRAMA DE JOVENS ATUAIS */}
          {academySubArea === 'programa' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-neutral-900/40 p-3 rounded-xl border border-neutral-800">
                <div className="text-xs text-neutral-300">
                  <span className="font-bold text-white">Pilotos Vinculados:</span>{' '}
                  {teamAcademyPilots.length} de{' '}
                  {Math.max(3, Math.min(6, (team?.youth_academy_level || 3) + 1))} vagas suportadas
                  com máxima atenção técnica.
                </div>
                <Button
                  size="sm"
                  onClick={() => setDevManagerOpen(true)}
                  className="text-xs bg-red-600 hover:bg-red-500 text-white"
                >
                  <Sliders className="w-3.5 h-3.5 mr-1.5" />
                  Gerenciar Pistas & Licenças
                </Button>
              </div>

              {teamAcademyPilots.length === 0 ? (
                <div className="p-8 text-center bg-black/40 border border-neutral-800 rounded-2xl space-y-3">
                  <Sparkles className="w-8 h-8 text-cyan-400 mx-auto" />
                  <h3 className="text-sm font-bold text-white">
                    Nenhum piloto no programa no momento
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto">
                    Inicie uma janela de observação na aba{' '}
                    <strong className="text-white">Scouting</strong> para descobrir candidatos
                    internacionais e convidá-los para a academia.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setAcademySubArea('scouting')
                      if (scoutingCandidates.length === 0) handleGenerateScoutBatch()
                    }}
                    className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                    Abrir Janela de Prospecção
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamAcademyPilots.map((pilot) => {
                    const scoutView = driverScoutingService.createScoutingViewModel(pilot, team?.id)
                    return (
                      <div key={pilot.id} className="relative">
                        <ProspectCard
                          prospect={scoutView}
                          onRunTest={() => setDevManagerOpen(true)}
                          onEvaluateAgain={handleReevaluateProspect}
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReleaseAcademyDriver(pilot)}
                            disabled={isProcessing}
                            className="w-full text-[11px] h-7 bg-red-950 hover:bg-red-900 text-red-200 border border-red-800/60"
                          >
                            Liberar da Academia (Agente Livre)
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. SUB-ÁREA: SCOUTING & CANDIDATOS */}
          {academySubArea === 'scouting' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-neutral-900/40 p-4 rounded-xl border border-neutral-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Search className="w-4 h-4 text-cyan-400" />
                    Janela Ativa de Prospecção de Base
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Prospectos identificados pelas capacidades de scouting e rede da equipe.
                    Informação parcial coberta por Fog of War.
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={handleGenerateScoutBatch}
                  disabled={isGeneratingScout || isProcessing}
                  className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${isGeneratingScout ? 'animate-spin' : ''}`}
                  />
                  {isGeneratingScout ? 'Buscando Jovens...' : 'Nova Janela de Scouting'}
                </Button>
              </div>

              {scoutingCandidates.length === 0 ? (
                <div className="p-8 text-center bg-black/40 border border-neutral-800 rounded-2xl space-y-3">
                  <Search className="w-8 h-8 text-neutral-500 mx-auto" />
                  <h3 className="text-sm font-bold text-white">
                    Nenhum candidato na janela no momento
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    Envie os olheiros para observar campeonatos de F4, Fórmula Regional e Karting
                    internacional.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleGenerateScoutBatch}
                    className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
                  >
                    Iniciar Varredura de Base
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scoutingCandidates.map((c) => {
                    const scoutView = driverScoutingService.createScoutingViewModel(c, team?.id)
                    return (
                      <ProspectCard
                        key={c.id}
                        prospect={scoutView}
                        onEvaluateAgain={handleReevaluateProspect}
                        onInviteToAcademy={handleHireProspectToAcademy}
                        onRunTest={() => setDevManagerOpen(true)}
                        isProcessing={isProcessing}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. SUB-ÁREA: DESENVOLVIMENTO & PLANOS ANUAIS */}
          {academySubArea === 'desenvolvimento' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Plano de Progressão e Temporadas de Base
                  </h3>
                  <p className="text-xs text-neutral-400">
                    O desenvolvimento não é fixo (+1 por nível é proibido): depende de idade, testes
                    em pista, teto real e infraestrutura.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleAdvanceAcademySeason}
                  disabled={isProcessing}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  Simular Temporada Júnior
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamAcademyPilots.map((pilot) => {
                  const meta = (pilot as any).procedural_data as any
                  const latestHistory = meta?.seasonsHistory?.[0]
                  return (
                    <div
                      key={pilot.id}
                      className="p-4 rounded-xl bg-black/40 border border-neutral-800 space-y-3 font-mono"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-sm font-bold text-white">{pilot.name}</h4>
                          <span className="text-xs text-neutral-400">
                            {pilot.age} anos • {meta?.juniorCategory?.toUpperCase() || 'F4'} •{' '}
                            {pilot.nationality}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs border-cyan-800 text-cyan-300">
                          Ritmo Atual: {pilot.speed}
                        </Badge>
                      </div>

                      {latestHistory && (
                        <div className="p-2.5 rounded bg-neutral-900/70 border border-neutral-800 text-xs space-y-1">
                          <span className="text-neutral-400 block font-bold">
                            Última Temporada Júnior:
                          </span>
                          <div className="text-neutral-200">
                            Posição: <strong>{latestHistory.championshipPosition}º lugar</strong> (
                            {latestHistory.wins} vitórias, {latestHistory.podiums} pódios)
                          </div>
                          <div className="text-[11px] text-neutral-400 italic">
                            "{latestHistory.notes}"
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDevManagerOpen(true)}
                          className="flex-1 text-xs border-neutral-700 hover:bg-neutral-800 text-cyan-300"
                        >
                          Designar Testes em Pista
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. SUB-ÁREA: CAMINHO F1 & HOMOLOGAÇÃO */}
          {academySubArea === 'caminho_f1' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-cyan-400" />
                    Trilha Oficial de Acesso à Fórmula 1
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Academia → Piloto de Desenvolvimento → Homologação FIA (C/B/A) → Reserva →
                    Titular.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setDevManagerOpen(true)}
                  className="text-xs bg-red-600 hover:bg-red-500 text-white"
                >
                  Abrir Central de Homologação FIA
                </Button>
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-neutral-800 text-xs space-y-3 font-mono text-neutral-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded bg-neutral-900/60 border border-neutral-800">
                    <strong className="text-white block mb-1">1. Test Drivers Atuais</strong>
                    <div className="text-neutral-400">
                      {testDrivers.length > 0
                        ? testDrivers.map((t) => t.name).join(', ')
                        : 'Nenhum piloto de testes ativo.'}
                    </div>
                  </div>
                  <div className="p-3 rounded bg-neutral-900/60 border border-neutral-800">
                    <strong className="text-white block mb-1">2. Piloto Reserva</strong>
                    <div className="text-neutral-400">
                      {reserveDriver ? reserveDriver.name : 'Vaga de reserva em aberto.'}
                    </div>
                  </div>
                  <div className="p-3 rounded bg-neutral-900/60 border border-neutral-800">
                    <strong className="text-white block mb-1">3. Titulares Atuais</strong>
                    <div className="text-neutral-400">
                      {titularDrivers.map((t) => t.name).join(' & ')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. SUB-ÁREA: HISTÓRICO & EX-PILOTOS (ALUMNI) */}
          {academySubArea === 'historico' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Legado da Academia: Ex-Pilotos e Carreira no Paddock
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Pilotos que foram descobertos ou formados pela academia e hoje competem no grid,
                  em equipes rivais ou como agentes livres.
                </p>
              </div>

              {academyAlumni.length === 0 ? (
                <div className="p-8 text-center bg-black/40 border border-neutral-800 rounded-2xl">
                  <p className="text-xs text-neutral-400">
                    Nenhum ex-piloto registrado ainda. Conforme jovens forem promovidos ou liberados
                    para o mercado, seu legado será registrado aqui permanentemente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {academyAlumni.map((alumnus) => (
                    <div
                      key={alumnus.id}
                      className="p-4 rounded-xl bg-black/40 border border-neutral-800 font-mono text-xs space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white text-sm">{alumnus.name}</h4>
                          <span className="text-neutral-400 text-[11px]">
                            {alumnus.nationality} • {alumnus.age} anos
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-800 text-amber-300"
                        >
                          {alumnus.team_id ? 'Contratado por Rival' : 'Agente Livre'}
                        </Badge>
                      </div>

                      <div className="text-[11px] text-neutral-300">
                        Situação Atual:{' '}
                        <strong className="text-white">
                          {alumnus.team_id
                            ? `Titular/Piloto da Equipe ${alumnus.team_id}`
                            : 'Disponível no Mercado'}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-ABA: CULTURA & MORAL */}
      {activeTab === 'cultura_moral' && (
        <div className="space-y-6">
          <Card className="bg-[#0B0E14] border-neutral-800/80">
            <CardHeader className="border-b border-neutral-800">
              <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-rose-500" />
                Cultura Organizacional e Moral da Fábrica
              </CardTitle>
              <CardDescription className="text-xs text-neutral-400">
                O ambiente humano reflete diretamente na agilidade de fabricação e confiabilidade
                das peças de corrida.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                <div className="p-4 rounded-xl bg-black/40 border border-neutral-800 text-center">
                  <span className="text-xs text-neutral-400 uppercase block">Moral Geral</span>
                  <span className="text-3xl font-black text-emerald-400 block mt-2">82%</span>
                  <span className="text-[11px] text-neutral-500 mt-1 block">
                    Ambiente Excelente
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-neutral-800 text-center">
                  <span className="text-xs text-neutral-400 uppercase block">
                    Confiança Diretoria
                  </span>
                  <span className="text-3xl font-black text-amber-400 block mt-2">
                    {boardConfidence}%
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-1 block">Apoio Irrestrito</span>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-neutral-800 text-center">
                  <span className="text-xs text-neutral-400 uppercase block">Estabilidade</span>
                  <span className="text-3xl font-black text-cyan-400 block mt-2">85%</span>
                  <span className="text-[11px] text-neutral-500 mt-1 block">
                    Baixa Rotatividade
                  </span>
                </div>
              </div>

              {/* PAINEL PSICOLÓGICO DOS PILOTOS (Implementação Nº 6A) */}
              <div className="pt-4 border-t border-neutral-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" /> Clima Interno dos Pilotos & Tensão
                    entre Teammates
                  </h4>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-purple-700/50 text-purple-300"
                  >
                    6A Personalidade & Relações
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {titularDrivers.map((drv) => {
                    return (
                      <div
                        key={drv.id}
                        className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">{drv.name}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-neutral-700 text-neutral-300 font-mono"
                          >
                            Segurança: {drv.seat_security ?? 80}%
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                          <div>
                            Confiança no TP: <strong className="text-emerald-400">Alta</strong>
                          </div>
                          <div>
                            Pertencimento: <strong className="text-blue-400">Satisfeito</strong>
                          </div>
                          <div>
                            Desejo de Ficar: <strong className="text-amber-300">Positivo</strong>
                          </div>
                          <div>
                            Risco de Conflito: <strong className="text-neutral-300">Baixo</strong>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL: RENEGOCIAR CONTRATO */}
      <Dialog
        open={!!renegotiateDriver}
        onOpenChange={(open) => !open && setRenegotiateDriver(null)}
      >
        <DialogContent className="bg-[#090D15]/95 backdrop-blur-md border border-[#1A2333] text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#E10600]" />
              Renegociar Contrato — {renegotiateDriver?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Ajuste a oferta salarial (variação de ±20%) e a duração de extensão do vínculo.
            </DialogDescription>
          </DialogHeader>

          {renegotiateDriver && (
            <div className="space-y-5 py-3">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#8B95A7]">
                    Proposta Salarial ({salaryMultiplier}% do atual):
                  </span>
                  <strong className="text-base text-[#00A6FB]">
                    {formatCurrency(
                      Math.round(renegotiateDriver.salary * (salaryMultiplier / 100)),
                    )}
                    /ano
                  </strong>
                </div>
                <Slider
                  value={[salaryMultiplier]}
                  onValueChange={(val) => setSalaryMultiplier(val[0])}
                  min={80}
                  max={120}
                  step={1}
                  className="py-2"
                />
                <div className="flex justify-between text-[11px] text-[#8B95A7] font-mono">
                  <span>-20% ({formatCurrency(Math.round(renegotiateDriver.salary * 0.8))})</span>
                  <span>Atual: {formatCurrency(renegotiateDriver.salary)}</span>
                  <span>+20% ({formatCurrency(Math.round(renegotiateDriver.salary * 1.2))})</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono text-[#8B95A7]">Duração da Renovação:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((yrs) => (
                    <Button
                      key={yrs}
                      type="button"
                      variant={contractYears === yrs ? 'default' : 'outline'}
                      onClick={() => setContractYears(yrs)}
                      className={`text-xs font-mono ${
                        contractYears === yrs
                          ? 'bg-[#E10600] text-white hover:bg-[#FF2E25]'
                          : 'border-[#1F2733] text-[#F5F7FA] hover:bg-[#1F2733]'
                      }`}
                    >
                      {yrs} {yrs === 1 ? 'ano' : 'anos'} ({2026 + yrs})
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRenegotiateDriver(null)}
              className="border-[#1F2733] text-[#8B95A7] hover:text-[#F5F7FA]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRenegotiate}
              disabled={isProcessing}
              className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-semibold"
            >
              {isProcessing ? 'Enviando proposta...' : 'Confirmar Novo Contrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: DISPENSAR PILOTO */}
      <Dialog open={!!fireDriver} onOpenChange={(open) => !open && setFireDriver(null)}>
        <DialogContent className="bg-[#090D15]/95 backdrop-blur-md border border-[#1A2333] text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Rescisão Unilateral de Contrato
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Aviso de multa rescisória obrigatória conforme regulamento FIA 2026.
            </DialogDescription>
          </DialogHeader>

          {fireDriver && (
            <div className="space-y-4 py-2 text-xs">
              <p className="text-[#F5F7FA]">
                Você está prestes a rescindir o contrato de{' '}
                <strong className="text-white">{fireDriver.name}</strong> (
                {fireDriver.role === 'reserva' ? 'Piloto Reserva' : 'Titular'}).
              </p>
              <div className="p-3.5 rounded-lg bg-red-950/30 border border-red-500/30 font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Multa Rescisória (50% do salário anual):</span>
                  <strong className="text-red-400 text-sm">
                    {formatCurrency(Math.round(fireDriver.salary * 0.5))}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Seu Orçamento Atual:</span>
                  <span className="text-[#F5F7FA]">{formatCurrency(team?.budget ?? 0)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFireDriver(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleFire}
              disabled={isProcessing}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {isProcessing ? 'Processando...' : 'Pagar Multa e Dispensar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL OFICIAL: GERENCIAR DESENVOLVIMENTO, TESTES E HOMOLOGAÇÃO FIA */}
      {team && (
        <DevelopmentManagerModal
          open={devManagerOpen}
          onOpenChange={setDevManagerOpen}
          team={team}
          titularDrivers={titularDrivers}
          reserveDriver={reserveDriver}
          testDrivers={testDrivers}
          academyDrivers={teamAcademyPilots}
          availableTalents={availableTalents}
          onDataChanged={async () => {
            await refreshTeamAndSeason()
            await loadData()
          }}
        />
      )}

      {/* MODAL INTERNO DE AUDITORIA & DEBUG PROSPECT (4C) */}
      {team && (
        <ProspectDebugAuditModal
          open={isDebugModalOpen}
          onOpenChange={setIsDebugModalOpen}
          team={team}
          drivers={[
            ...teamAcademyPilots,
            ...scoutingCandidates,
            ...titularDrivers,
            ...allGridDrivers,
          ].filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i)}
        />
      )}

      {/* MODAIS DA NOVA EXPERIÊNCIA EXECUTIVA DA ABA EQUIPE */}
      <TeamInstitutionalDetailsModal
        open={isAboutModalOpen}
        onOpenChange={setIsAboutModalOpen}
        team={team}
        teamName={teamName}
        teamHq={teamHq}
        teamCountry={teamCountry}
        engineSupplier={team?.engine_supplier || 'Audi'}
        teamIntro={teamIntro}
      />

      <ManagerProfileDetailsModal
        open={isManagerModalOpen}
        onOpenChange={setIsManagerModalOpen}
        managerName={teamPrincipalName}
        roleTitle="Team Principal"
        portraitMeta={managerOfficialPortrait}
        boardConfidence={boardConfidence}
      />

      {selectedPilotForProfile && (
        <PilotProfileDialog
          pilot={selectedPilotForProfile}
          open={isPilotProfileModalOpen}
          onOpenChange={(open) => {
            setIsPilotProfileModalOpen(open)
            if (!open) setSelectedPilotForProfile(null)
          }}
          onOpenContractModal={(_pilot) => {
            setIsPilotProfileModalOpen(false)
            navigate('/pilotos')
          }}
          currentRound={season?.current_round || 1}
        />
      )}
    </div>
  )
}
