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
import { MANAGER_DOMAINS } from '@/lib/manager-attribute-domains'
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

      // Registro Canônico no Financial Ledger (Multa Rescisória de Piloto)
      try {
        const { financialLedgerService } = await import('@/services/financialLedgerService')
        await financialLedgerService.postTransaction({
          teamId: team.id,
          seasonYear: season?.year || 2026,
          round: season?.current_round || 1,
          type: 'expense',
          category: 'penalties',
          subcategory: 'driver_contract_termination',
          direction: 'outflow',
          amount: penaltyCost,
          costCapClassification: 'excluded', // Multas rescisórias de pilotos são excluídas do Cost Cap
          sourceSystem: 'driver_termination',
          sourceEntityId: fireDriver.id,
          idempotencyKey: `fire_driver_${fireDriver.id}_${Date.now()}`,
          description: `Multa rescisória de 50% pela dispensa de ${fireDriver.name}`,
        })
      } catch (finErr) {
        console.warn('Erro ao lançar rescisão no FinancialLedger:', finErr)
      }

      const updatedBudget = team.budget - penaltyCost
      await f1Service.updateTeam(team.id, { budget: updatedBudget })
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
      refreshTeamAndSeason()
      loadData()
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

      {/* BARRA DE SUB-ABAS NO ESTILO DO MOCKUP */}
      <div className="flex items-center gap-1.5 border-b border-neutral-800/80 pb-2 overflow-x-auto no-scrollbar">
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
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#E10600] text-white shadow-md shadow-red-600/30 font-bold'
                  : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-neutral-800/50'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* HERO CARD DE IDENTIDADE DA EQUIPE (MOCKUP) */}
      <div className="relative rounded-2xl bg-[#0B0E14] border border-neutral-800/80 overflow-hidden shadow-2xl p-6 lg:p-7">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Logo e Info Institucional (col-span-8) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-4">
              {/* Logo da equipe */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black/60 border border-neutral-800 flex items-center justify-center p-3 shadow-inner shrink-0">
                <svg className="w-full h-auto text-white" viewBox="0 0 100 40" fill="currentColor">
                  {/* Audi 4 rings icon */}
                  <circle
                    cx="20"
                    cy="20"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <circle
                    cx="40"
                    cy="20"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <circle
                    cx="60"
                    cy="20"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <circle
                    cx="80"
                    cy="20"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                </svg>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                  {teamName}
                </h2>
                <div className="flex items-center gap-2 mt-1 text-xs font-mono text-neutral-400">
                  <span className="text-sm">{teamFlag}</span>
                  <span>{teamCountry}</span>
                  <span>•</span>
                  <span>Sede: {teamHq}</span>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-xl">
              {teamIntro}
            </p>
          </div>

          {/* Cards laterais de Team Principal, Cultura, Moral e Diretoria (col-span-5) */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3 font-mono">
            {/* Team Principal */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-neutral-800/80 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                Team Principal
              </span>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#E10600] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {teamPrincipalName.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-white truncate max-w-[80px]">
                    {teamPrincipalName}
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('staff')}
                  className="text-[10px] text-neutral-400 hover:text-white underline decoration-neutral-600 cursor-pointer"
                >
                  Ver perfil
                </button>
              </div>
            </div>

            {/* Moral Geral com anel % */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-neutral-800/80 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                Moral Geral
              </span>
              <div className="flex items-center gap-2.5 mt-2">
                <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                  <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="13" stroke="#1E293B" strokeWidth="2.5" fill="none" />
                    <circle
                      cx="16"
                      cy="16"
                      r="13"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 13}
                      strokeDashoffset={2 * Math.PI * 13 * (1 - overallMorale / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <Activity className="w-3.5 h-3.5 text-emerald-400 absolute" />
                </div>
                <span className="text-base font-black text-white">{overallMorale}%</span>
              </div>
            </div>

            {/* Cultura da Equipe */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-neutral-800/80 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                Cultura da Equipe
              </span>
              <div className="flex items-center gap-2 mt-2">
                <Award className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-xs font-bold text-white truncate">Alta Performance</span>
              </div>
            </div>

            {/* Confiança da Diretoria com Estrela */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-neutral-800/80 flex flex-col justify-between">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                Confiança da Diretoria
              </span>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-amber-400 text-base">★</span>
                <span className="text-base font-black text-white">{boardConfidence}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VISÃO GERAL (GRID DO MOCKUP) */}
      {activeTab === 'visao_geral' && (
        <div className="space-y-6">
          {/* LINHA SUPERIOR DO GRID (Pilotos / Membros Principais / Situação) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 1. PILOTOS DA EQUIPE (col-span-5) */}
            <div className="lg:col-span-5 rounded-2xl bg-[#0B0E14] border border-neutral-800/80 p-5 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800/60 mb-4">
                  <span className="text-xs font-black uppercase tracking-wider text-white font-mono flex items-center gap-2">
                    PILOTOS DA EQUIPE
                  </span>
                  <button
                    onClick={() => navigate('/pilotos')}
                    className="text-xs font-mono text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    Ver todos →
                  </button>
                </div>

                {/* Cards por piloto (#1, #2, Reserva) */}
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Piloto #1 */}
                  {(() => {
                    const d1 = titularDrivers[0] || {
                      name: 'Daniel Ricciardo',
                      nationality: 'Austrália',
                      speed: 87,
                      consistency: 85,
                      morale: 85,
                      physical_condition: 92,
                      fatigue: 28,
                      contract_end: 2027,
                      salary: 7500000,
                    }
                    const overall1 = Math.round(((d1.speed || 80) + (d1.consistency || 80)) / 2)
                    return (
                      <div className="p-2.5 rounded-xl bg-black/40 border border-neutral-800/70 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-neutral-400">
                            <span className="text-white">#1</span>
                            <span className="text-xs">{getCountryFlag(d1.nationality)}</span>
                          </div>

                          <div className="relative my-1.5 flex justify-center">
                            <DriverPhotoAvatar
                              name={d1.name}
                              teamColor="#E10600"
                              size="md"
                              className="border border-neutral-800 rounded-lg"
                            />
                          </div>

                          <div className="text-center">
                            <div className="text-[11px] font-bold text-white truncate">
                              {d1.name}
                            </div>
                            <div className="text-lg font-black text-white font-mono mt-0.5">
                              {overall1}{' '}
                              <span className="text-[9px] font-normal text-neutral-400">GER</span>
                            </div>
                          </div>
                        </div>

                        {/* Barras Forma / Moral / Fadiga */}
                        <div className="space-y-1 font-mono text-[9px]">
                          <div className="flex justify-between text-neutral-400">
                            <span>Forma</span>
                            <span className="text-emerald-400 font-bold">
                              {d1.physical_condition || 92}
                            </span>
                          </div>
                          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${d1.physical_condition || 92}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-neutral-400">
                            <span>Moral</span>
                            <span className="text-cyan-400 font-bold">{d1.morale || 85}</span>
                          </div>
                          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full"
                              style={{ width: `${d1.morale || 85}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-neutral-400">
                            <span>Fadiga</span>
                            <span className="text-amber-400 font-bold">{d1.fatigue || 28}</span>
                          </div>
                          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${d1.fatigue || 28}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-neutral-800/60 text-[9px] font-mono text-neutral-400">
                          <div>Contrato até {d1.contract_end || 2027}</div>
                          <div className="text-neutral-300 font-semibold truncate">
                            Salário: {formatCurrency(d1.salary || 7500000)}/ano
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Piloto #2 */}
                  {(() => {
                    const d2 = titularDrivers[1] || {
                      name: 'Gabriel Bortoleto',
                      nationality: 'Brasil',
                      speed: 83,
                      consistency: 82,
                      morale: 78,
                      physical_condition: 98,
                      fatigue: 32,
                      contract_end: 2028,
                      salary: 3800000,
                    }
                    const overall2 = Math.round(((d2.speed || 83) + (d2.consistency || 82)) / 2)
                    return (
                      <div className="p-2.5 rounded-xl bg-black/40 border border-neutral-800/70 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-neutral-400">
                            <span className="text-white">#2</span>
                            <span className="text-xs">{getCountryFlag(d2.nationality)}</span>
                          </div>

                          <div className="relative my-1.5 flex justify-center">
                            <DriverPhotoAvatar
                              name={d2.name}
                              teamColor="#E10600"
                              size="md"
                              className="border border-neutral-800 rounded-lg"
                            />
                          </div>

                          <div className="text-center">
                            <div className="text-[11px] font-bold text-white truncate">
                              {d2.name}
                            </div>
                            <div className="text-lg font-black text-white font-mono mt-0.5">
                              {overall2}{' '}
                              <span className="text-[9px] font-normal text-neutral-400">GER</span>
                            </div>
                          </div>
                        </div>

                        {/* Barras Forma / Moral / Fadiga */}
                        <div className="space-y-1 font-mono text-[9px]">
                          <div className="flex justify-between text-neutral-400">
                            <span>Forma</span>
                            <span className="text-emerald-400 font-bold">
                              {d2.physical_condition || 98}
                            </span>
                          </div>
                          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${d2.physical_condition || 98}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-neutral-400">
                            <span>Moral</span>
                            <span className="text-cyan-400 font-bold">{d2.morale || 78}</span>
                          </div>
                          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full"
                              style={{ width: `${d2.morale || 78}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-neutral-400">
                            <span>Fadiga</span>
                            <span className="text-amber-400 font-bold">{d2.fatigue || 32}</span>
                          </div>
                          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${d2.fatigue || 32}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-neutral-800/60 text-[9px] font-mono text-neutral-400">
                          <div>Contrato até {d2.contract_end || 2028}</div>
                          <div className="text-neutral-300 font-semibold truncate">
                            Salário: {formatCurrency(d2.salary || 3800000)}/ano
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Piloto Reserva */}
                  {(() => {
                    const dr = reserveDriver || {
                      id: 'fallback-reserve',
                      team_id: team?.id || '',
                      name: 'Zane Maloney',
                      nationality: 'Barbados',
                      speed: 78,
                      consistency: 77,
                      morale: 75,
                      physical_condition: 78,
                      fatigue: 18,
                      contract_end: 2026,
                      salary: 1200000,
                      age: 20,
                      superlicense_points: 38,
                      homologation_status: 'homologacao' as const,
                      homologation_sessions_done: 0,
                      f1_adaptation: 45,
                    }
                    const overallR = Math.round(((dr.speed || 78) + (dr.consistency || 77)) / 2)
                    return (
                      <div className="p-2.5 rounded-xl bg-black/40 border border-neutral-800/70 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-neutral-400">
                            <span className="text-amber-400">Reserva</span>
                            <span className="text-xs">{getCountryFlag(dr.nationality)}</span>
                          </div>

                          <div className="relative my-1.5 flex justify-center">
                            <DriverPhotoAvatar
                              name={dr.name}
                              teamColor="#D97706"
                              size="md"
                              className="border border-neutral-800 rounded-lg"
                            />
                          </div>

                          <div className="text-center">
                            <div className="text-[11px] font-bold text-white truncate">
                              {dr.name}
                            </div>
                            <div className="text-lg font-black text-white font-mono mt-0.5">
                              {overallR}{' '}
                              <span className="text-[9px] font-normal text-neutral-400">GER</span>
                            </div>
                          </div>
                        </div>

                        {/* Barras Forma / Moral / Fadiga */}
                        <div className="space-y-1 font-mono text-[9px]">
                          <div className="flex justify-between text-neutral-400">
                            <span>Forma</span>
                            <span className="text-emerald-400 font-bold">
                              {dr.physical_condition || 78}
                            </span>
                          </div>
                          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${dr.physical_condition || 78}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-neutral-400">
                            <span>Moral</span>
                            <span className="text-cyan-400 font-bold">{dr.morale || 75}</span>
                          </div>
                          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full"
                              style={{ width: `${dr.morale || 75}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-neutral-400">
                            <span>Fadiga</span>
                            <span className="text-amber-400 font-bold">{dr.fatigue || 18}</span>
                          </div>
                          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${dr.fatigue || 18}%` }}
                            />
                          </div>
                        </div>

                        {/* Status Regulamentar & Homologação FIA */}
                        {(() => {
                          const status =
                            ('homologation_status' in dr && dr.homologation_status) ||
                            calcularElegibilidade(
                              ('age' in dr && dr.age) || 20,
                              ('superlicense_points' in dr && dr.superlicense_points) || 0,
                              0,
                            )
                          const isHomologation = status === 'homologacao'
                          const sessionsDone =
                            ('homologation_sessions_done' in dr && dr.homologation_sessions_done) ??
                            0
                          const adaptation = ('f1_adaptation' in dr && dr.f1_adaptation) ?? 0

                          return (
                            <div className="pt-1.5 border-t border-neutral-800/60 space-y-1 font-mono text-[9px]">
                              <div className="flex items-center justify-between">
                                <span className="text-neutral-400">FIA:</span>
                                {status === 'formacao' && (
                                  <span className="text-purple-400 font-bold">Formação</span>
                                )}
                                {status === 'homologacao' && (
                                  <span className="text-amber-400 font-bold">Homologação</span>
                                )}
                                {status === 'elegivel' && (
                                  <span className="text-emerald-400 font-bold">Elegível</span>
                                )}
                              </div>

                              {isHomologation && (
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-[8px] text-amber-300">
                                    <span>TL1 FIA</span>
                                    <span>{sessionsDone}/2</span>
                                  </div>
                                  <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-amber-400 rounded-full"
                                      style={{
                                        width: `${Math.min(100, (sessionsDone / 2) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex justify-between text-neutral-400">
                                <span>Adaptação:</span>
                                <span className="text-cyan-400 font-bold">{adaptation}% / 80%</span>
                              </div>
                            </div>
                          )
                        })()}

                        <div className="pt-1.5 border-t border-neutral-800/60 text-[9px] font-mono text-neutral-400">
                          <div>Contrato até {dr.contract_end || 2026}</div>
                          <div className="text-neutral-300 font-semibold truncate">
                            Salário: {formatCurrency(dr.salary || 1200000)}/ano
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* SEÇÃO COMPACTA ACADEMIA & DESENVOLVIMENTO (Regra 2 do PDF) */}
                <div className="mt-4 pt-3.5 border-t border-neutral-800/80">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300 font-mono">
                        ACADEMIA & DESENVOLVIMENTO
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setDevManagerOpen(true)}
                      className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-mono px-2.5"
                    >
                      Gerenciar Desenvolvimento →
                    </Button>
                  </div>

                  {testDrivers.length === 0 && teamAcademyPilots.length === 0 ? (
                    <div className="p-2.5 rounded-lg bg-black/30 border border-dashed border-neutral-800 text-center text-xs text-neutral-400">
                      Nenhum piloto de testes ou jovem designado no momento.{' '}
                      <button
                        onClick={() => setDevManagerOpen(true)}
                        className="text-indigo-400 underline font-semibold ml-1 cursor-pointer"
                      >
                        Abrir Gestão
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        ...testDrivers,
                        ...teamAcademyPilots.filter((a) => !testDrivers.some((t) => t.id === a.id)),
                      ]
                        .slice(0, 3)
                        .map((driver) => {
                          const isTest = testDrivers.some((t) => t.id === driver.id)
                          const licenseLabel =
                            driver.license_status === 'nivel_a'
                              ? 'Super Licença'
                              : driver.license_status === 'nivel_b'
                                ? 'Licença B (Provisória)'
                                : 'Autorização Teste (Nível C)'
                          const ovr = Math.round(
                            ((driver.speed || 74) + (driver.consistency || 73)) / 2,
                          )
                          const prog = academyDevData.homologationPrograms[driver.id]

                          return (
                            <div
                              key={driver.id}
                              onClick={() => setDevManagerOpen(true)}
                              className="p-2 rounded-lg bg-neutral-900/70 border border-neutral-800 hover:border-indigo-600/60 transition-colors cursor-pointer text-left font-mono space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white truncate max-w-[85px]">
                                  {driver.name}
                                </span>
                                <span className="text-[10px]">
                                  {getCountryFlag(driver.nationality)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-neutral-400">
                                <span>{isTest ? 'Test Driver' : 'Academia'}</span>
                                <span className="text-amber-400 font-bold">{ovr} GER</span>
                              </div>
                              <div className="text-[8px] truncate text-indigo-300">
                                {prog
                                  ? `Homolog: ${prog.completedValidTests}/4 tests`
                                  : licenseLabel}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. MEMBROS PRINCIPAIS DA EQUIPE (col-span-4) */}
            <div className="lg:col-span-4 rounded-2xl bg-[#0B0E14] border border-neutral-800/80 p-5 flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800/60 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-white font-mono flex items-center gap-2">
                    MEMBROS PRINCIPAIS DA EQUIPE
                  </span>
                  <button
                    onClick={() => setActiveTab('staff')}
                    className="text-xs font-mono text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    Ver staff →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {staffMembers.map((st) => (
                    <div
                      key={st.role}
                      className="p-2.5 rounded-xl bg-black/40 border border-neutral-800/60 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={st.photo}
                          alt={st.name}
                          className="w-8 h-8 rounded-full object-cover border border-neutral-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] text-neutral-400 font-mono block truncate">
                            {st.role}
                          </span>
                          <span className="text-xs font-bold text-white block truncate">
                            {st.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 font-mono shrink-0">
                        <span className="text-xs">{st.flag}</span>
                        <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                          <span className="text-[10px] text-neutral-500">ıll</span>
                          {st.rating}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. SITUAÇÃO DA EQUIPE (col-span-3) */}
            <div className="lg:col-span-3 rounded-2xl bg-[#0B0E14] border border-neutral-800/80 p-5 flex flex-col justify-between shadow-lg font-mono">
              <div>
                <div className="pb-3 border-b border-neutral-800/60 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                    SITUAÇÃO DA EQUIPE
                  </span>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-neutral-500" /> Funcionários
                    </span>
                    <strong className="text-white text-sm">320</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-neutral-500" /> Folha Salarial Anual
                    </span>
                    <strong className="text-white text-xs">R$ 48,5 M</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" /> Eficiência Operacional
                    </span>
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      79%
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" /> Estabilidade
                    </span>
                    <strong className="text-emerald-400">85%</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Ambiente de Trabalho
                    </span>
                    <strong className="text-emerald-400">Muito Bom</strong>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
                    <span className="text-neutral-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-neutral-500" /> Risco de Rotatividade
                    </span>
                    <strong className="text-emerald-400">Baixo</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LINHA INFERIOR DO GRID (Contratos em Destaque / Academia / Atenção Necessária) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* CONTRATOS EM DESTAQUE (col-span-4) */}
            <div className="lg:col-span-4 rounded-2xl bg-[#0B0E14] border border-neutral-800/80 p-5 shadow-lg font-mono">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800/60 mb-3">
                <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  CONTRATOS EM DESTAQUE
                </span>
                <button
                  onClick={() => setActiveTab('contratos')}
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  Ver todos →
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  { name: 'D. Ricciardo', role: 'Piloto', end: 2027, left: '2 anos' },
                  { name: 'G. Bortoleto', role: 'Piloto', end: 2028, left: '3 anos' },
                  { name: 'Z. Maloney', role: 'Piloto', end: 2026, left: '1 ano' },
                  { name: 'J. Key', role: 'Diretor Técnico', end: 2027, left: '2 anos' },
                  { name: 'E. Cardile', role: 'Chefe de Aerodinâmica', end: 2026, left: '1 ano' },
                ].map((c) => (
                  <div
                    key={c.name}
                    className="p-2.5 rounded-xl bg-black/40 border border-neutral-800/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white block">{c.name}</span>
                      <span className="text-[10px] text-neutral-400">
                        {c.role} | Termina em {c.end}
                      </span>
                    </div>
                    <span className="text-neutral-400 text-[11px] font-semibold">{c.left}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ACADEMIA DE PILOTOS (col-span-4) */}
            <div className="lg:col-span-4 rounded-2xl bg-[#0B0E14] border border-neutral-800/80 p-5 shadow-lg flex flex-col justify-between font-mono">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800/60 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                    ACADEMIA DE PILOTOS
                  </span>
                  <button
                    onClick={() => setActiveTab('academia')}
                    className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    Ver academia →
                  </button>
                </div>

                <div className="space-y-3">
                  {academyDrivers.map((ac) => (
                    <div
                      key={ac.name}
                      className="p-3 rounded-xl bg-black/40 border border-neutral-800/60 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{ac.name}</span>
                            <span className="text-xs">{ac.flag}</span>
                            <Badge className="bg-neutral-800 text-neutral-300 text-[9px] px-1.5 py-0">
                              {ac.series}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-neutral-400">Idade: {ac.age} anos</span>
                        </div>

                        <div className="text-right">
                          <span className="text-base font-black text-white">{ac.current}</span>
                          <span className="text-[10px] text-cyan-400 block">
                            Potencial {ac.potential}
                          </span>
                        </div>
                      </div>

                      {/* Barra de progresso */}
                      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${(ac.current / ac.potential) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bloco inferior institucional da academia */}
              <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between gap-2">
                <span className="text-[11px] text-neutral-400 font-sans leading-tight">
                  Identificar e desenvolver talentos para o futuro da equipe.
                </span>
                <Button
                  size="sm"
                  onClick={() => setActiveTab('academia')}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs h-7 shrink-0 cursor-pointer"
                >
                  Ver Academia
                </Button>
              </div>
            </div>

            {/* ATENÇÃO NECESSÁRIA (col-span-4) */}
            <div className="lg:col-span-4 rounded-2xl bg-[#0B0E14] border border-neutral-800/80 p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800/60 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-white font-mono">
                      ATENÇÃO NECESSÁRIA
                    </span>
                    <span className="w-5 h-5 rounded-full bg-[#E10600] text-white text-[11px] font-bold flex items-center justify-center font-mono">
                      {attentionItems.length}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      toast({
                        title: 'Alertas',
                        description: 'Nenhum alerta crítico pendente no momento.',
                      })
                    }
                    className="text-xs font-mono text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    Ver todas →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {attentionItems.map((al) => {
                    const IconComp = al.icon
                    return (
                      <div
                        key={al.id}
                        className="p-2.5 rounded-xl bg-black/40 border border-neutral-800/60 flex items-start gap-2.5 text-xs"
                      >
                        <IconComp className={`w-4 h-4 ${al.iconColor} shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-white block truncate">{al.title}</span>
                          <p className="text-[11px] text-neutral-400 leading-tight line-clamp-2 mt-0.5">
                            {al.desc}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-500 shrink-0">
                          {al.time}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Bloco citação rodapé grid */}
              <div className="mt-4 pt-3 border-t border-neutral-800/60 text-right">
                <p className="text-[11px] font-serif italic text-neutral-400">
                  &ldquo;Grandes equipes não são formadas apenas por pilotos. São formadas por
                  pessoas que acreditam no mesmo destino.&rdquo;
                </p>
                <span className="text-[10px] font-bold tracking-widest text-[#E10600] uppercase font-mono mt-0.5 block">
                  Audi
                </span>
              </div>
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

                        <div className="flex items-center gap-3">
                          <DriverPhotoAvatar name={d.name} teamColor="#E10600" size="md" />
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-white truncate">{d.name}</h3>
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

                        <div className="flex items-center gap-3">
                          <DriverPhotoAvatar name={rd.name} teamColor="#D97706" size="md" />
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-white truncate">{rd.name}</h3>
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

      {/* SUB-ABA: STAFF */}
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

              {/* Engenheiros chefes e Corpo Técnico existente */}
              <Card className="bg-[#0B0E14] border-neutral-800/80">
                <CardHeader className="border-b border-neutral-800">
                  <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#E10600]" />
                    Corpo Técnico e Engenharia de Pista
                  </CardTitle>
                  <CardDescription className="text-xs text-neutral-400">
                    Engenheiros chefes e diretores responsáveis pelo projeto, estratégia de pit stop
                    e operações da equipe.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {staffMembers.map((st) => (
                      <div
                        key={st.name}
                        className="p-4 rounded-xl bg-black/40 border border-neutral-800 flex items-center justify-between gap-3 font-mono"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={st.photo}
                            alt={st.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-neutral-700"
                          />
                          <div>
                            <span className="text-xs text-neutral-400 block">{st.role}</span>
                            <strong className="text-sm text-white block">{st.name}</strong>
                            <span className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                              {st.flag} {st.country}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-emerald-400">{st.rating}</span>
                          <span className="text-[10px] text-neutral-500 block">RATING</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
    </div>
  )
}
