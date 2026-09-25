import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { teamRosterService } from '@/services/teamRosterService'
import { useRealtime } from '@/hooks/use-realtime'
import { PartModel, DriverModel } from '@/types/f1'
import { ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { OFFICIAL_TEAMS_TECHNICAL_DATA } from '@/lib/car-technical-data'
import { toast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/formatters'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle } from 'lucide-react'

// Subcomponentes da Garagem
import { GarageHero } from '@/components/car/GarageHero'
import { TeamCarCard } from '@/components/car/TeamCarCard'
import { InstalledComponentsGrid } from '@/components/car/InstalledComponentsGrid'
import { StructuralIntegrityCard } from '@/components/car/StructuralIntegrityCard'
import { CompetitivenessCard } from '@/components/car/CompetitivenessCard'
import { QuickActionsCard } from '@/components/car/QuickActionsCard'

// Subcomponentes da Área Técnica
import { TechnicalHero } from '@/components/car/TechnicalHero'
import { PerformanceRadarMap, RadarMetric } from '@/components/car/PerformanceRadarMap'
import { TechnicalDiagnosisPanel } from '@/components/car/TechnicalDiagnosisPanel'
import { PowerUnitSystemsPanel } from '@/components/car/PowerUnitSystemsPanel'
import { TechnicalCorrelationPanel } from '@/components/car/TechnicalCorrelationPanel'
import { GridCompetitiveness, TeamTechnicalRow } from '@/components/car/GridCompetitiveness'
import { TechnicalFooterCards } from '@/components/car/TechnicalFooterCards'
import { EngineeringPlanModal } from '@/components/car/EngineeringPlanModal'
import { EngineSwapModal } from '@/components/car/EngineSwapModal'
import { PartSwapModal } from '@/components/car/PartSwapModal'
import { QuickSwapCarSelectorModal } from '@/components/car/QuickSwapCarSelectorModal'
import { useNavigate, useSearchParams } from 'react-router-dom'

export type CarSubTab = 'garagem' | 'tecnica'

export default function CarPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { team, season, refreshTeamAndSeason } = useAuth()
  const currentRound = season?.current_round || 1

  const initialSubTab: CarSubTab =
    searchParams.get('tab') === 'technical' ||
    searchParams.get('tab') === 'tecnica' ||
    searchParams.get('tab') === 'pd'
      ? 'tecnica'
      : 'garagem'
  const [activeSubTab, setActiveSubTab] = useState<CarSubTab>(initialSubTab)

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'technical' || tabParam === 'tecnica' || tabParam === 'pd') {
      setActiveSubTab('tecnica')
    } else if (tabParam === 'garagem' || tabParam === 'garage') {
      setActiveSubTab('garagem')
    }
  }, [searchParams])
  const [parts, setParts] = useState<PartModel[]>([])
  const [allDrivers, setAllDrivers] = useState<DriverModel[]>([])
  const [loading, setLoading] = useState(true)

  // Estados de ação de oficina e motor
  const [isRepairing, setIsRepairing] = useState(false)
  const [isChangingEngine, setIsChangingEngine] = useState(false)
  const [compareModalOpen, setCompareModalOpen] = useState(false)
  const [balanceModalOpen, setBalanceModalOpen] = useState(false)
  const [repairModalOpen, setRepairModalOpen] = useState(false)

  // Modais Funcionais do Micro-Patch
  const [engineeringModalOpen, setEngineeringModalOpen] = useState(false)
  const [engineSwapModalOpen, setEngineSwapModalOpen] = useState(false)
  const [partSwapModalOpen, setPartSwapModalOpen] = useState(false)
  const [quickSwapSelectorOpen, setQuickSwapSelectorOpen] = useState(false)

  // Configuração e Estado Canônico Individual por Carro (#1 e #2)
  const [engineUnitCar1, setEngineUnitCar1] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_car1_engine_unit')
      return saved ? parseInt(saved, 10) : 2
    } catch {
      return 2
    }
  })
  const [engineUnitCar2, setEngineUnitCar2] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_car2_engine_unit')
      return saved ? parseInt(saved, 10) : 1
    } catch {
      return 1
    }
  })

  // Specs e desgaste específicos por carro
  const [car1Specs, setCar1Specs] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_car1_specs')
      return saved
        ? JSON.parse(saved)
        : {
            frontWing: 'Spec B - Alta Carga',
            rearWing: 'Spec B - Baixo Arrasto DRS',
            floor: 'Spec A - Versão Base',
            sidepods: 'Spec B - Refrigeração Reduzida',
            engine: 'PU-2 (Mercedes)',
            suspension: 'Spec A - Pushrod Dinâmica',
          }
    } catch {
      return {
        frontWing: 'Spec B - Alta Carga',
        rearWing: 'Spec B - Baixo Arrasto DRS',
        floor: 'Spec A - Versão Base',
        sidepods: 'Spec B - Refrigeração Reduzida',
        engine: 'PU-2 (Mercedes)',
        suspension: 'Spec A - Pushrod Dinâmica',
      }
    }
  })

  const [car2Specs, setCar2Specs] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_car2_specs')
      return saved
        ? JSON.parse(saved)
        : {
            frontWing: 'Spec A - Base Homologação',
            rearWing: 'Spec A - Base Balanceada',
            floor: 'Spec A - Versão Base',
            sidepods: 'Spec A - Máximo Arrefecimento',
            engine: 'PU-1 (Mercedes)',
            suspension: 'Spec A - Pushrod Dinâmica',
          }
    } catch {
      return {
        frontWing: 'Spec A - Base Homologação',
        rearWing: 'Spec A - Base Balanceada',
        floor: 'Spec A - Versão Base',
        sidepods: 'Spec A - Máximo Arrefecimento',
        engine: 'PU-1 (Mercedes)',
        suspension: 'Spec A - Pushrod Dinâmica',
      }
    }
  })

  const [car1Conditions, setCar1Conditions] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_car1_conditions')
      return saved
        ? JSON.parse(saved)
        : {
            frontWing: 82,
            rearWing: 77,
            floor: 77,
            sidepods: 80,
            engine: 88,
            suspension: 83,
          }
    } catch {
      return {
        frontWing: 82,
        rearWing: 77,
        floor: 77,
        sidepods: 80,
        engine: 88,
        suspension: 83,
      }
    }
  })

  const [car2Conditions, setCar2Conditions] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_car2_conditions')
      return saved
        ? JSON.parse(saved)
        : {
            frontWing: 68,
            rearWing: 91,
            floor: 73,
            sidepods: 65,
            engine: 82,
            suspension: 72,
          }
    } catch {
      return {
        frontWing: 68,
        rearWing: 91,
        floor: 73,
        sidepods: 65,
        engine: 82,
        suspension: 72,
      }
    }
  })

  // Seriais físicos instalados para impedir instalação simultânea
  const [car1PartSerials, setCar1PartSerials] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_car1_part_serials')
      return saved
        ? JSON.parse(saved)
        : {
            frontWing: 'FW-E-01',
            rearWing: 'RW-E-01',
            floor: 'FL-E-01',
            sidepods: 'SP-E-01',
            suspension: 'SU-E-01',
          }
    } catch {
      return {
        frontWing: 'FW-E-01',
        rearWing: 'RW-E-01',
        floor: 'FL-E-01',
        sidepods: 'SP-E-01',
        suspension: 'SU-E-01',
      }
    }
  })

  const [car2PartSerials, setCar2PartSerials] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_car2_part_serials')
      return saved
        ? JSON.parse(saved)
        : {
            frontWing: 'FW-D-01',
            rearWing: 'RW-D-01',
            floor: 'FL-D-01',
            sidepods: 'SP-D-01',
            suspension: 'SU-D-01',
          }
    } catch {
      return {
        frontWing: 'FW-D-01',
        rearWing: 'RW-D-01',
        floor: 'FL-D-01',
        sidepods: 'SP-D-01',
        suspension: 'SU-D-01',
      }
    }
  })

  // Contexto selecionado para o modal de troca de peça / motor
  const [activeSwapTargetCar, setActiveSwapTargetCar] = useState<1 | 2>(1)
  const [activeSwapPartType, setActiveSwapPartType] = useState<string>('frontWing')
  const [technicalSelectedCarPU, setTechnicalSelectedCarPU] = useState<1 | 2>(1)

  // Salva no localStorage quando alterado para sobrevivência ao reload e navegação
  useEffect(() => {
    localStorage.setItem('apex_gp_car1_engine_unit', engineUnitCar1.toString())
    localStorage.setItem('apex_gp_car2_engine_unit', engineUnitCar2.toString())
    localStorage.setItem('apex_gp_car1_specs', JSON.stringify(car1Specs))
    localStorage.setItem('apex_gp_car2_specs', JSON.stringify(car2Specs))
    localStorage.setItem('apex_gp_car1_conditions', JSON.stringify(car1Conditions))
    localStorage.setItem('apex_gp_car2_conditions', JSON.stringify(car2Conditions))
    localStorage.setItem('apex_gp_car1_part_serials', JSON.stringify(car1PartSerials))
    localStorage.setItem('apex_gp_car2_part_serials', JSON.stringify(car2PartSerials))
  }, [
    engineUnitCar1,
    engineUnitCar2,
    car1Specs,
    car2Specs,
    car1Conditions,
    car2Conditions,
    car1PartSerials,
    car2PartSerials,
  ])

  // Handlers para troca de motor individual por carro
  const handleOpenEngineSwapModal = (targetCar: 1 | 2) => {
    setActiveSwapTargetCar(targetCar)
    setEngineSwapModalOpen(true)
  }

  const handleConfirmEngineSwap = (targetCar: 1 | 2, unitNumber: number) => {
    if (targetCar === 1) {
      if (unitNumber === engineUnitCar2) {
        toast({
          variant: 'destructive',
          title: 'Unidade Ocupada',
          description: `A PU-${unitNumber} já está instalada no Carro #2! Não é permitido compartilhar o mesmo motor.`,
        })
        return
      }
      setEngineUnitCar1(unitNumber)
      setCar1Specs((prev) => ({
        ...prev,
        engine: `PU-${unitNumber} (${team?.engine_supplier || 'Audi Sport'})`,
      }))
      toast({
        title: `Motor do Carro #1 Atualizado!`,
        description: `Unidade física PU-${unitNumber} montada com sucesso no carro de ${roster.starter1?.name || 'Piloto 1'}.`,
      })
    } else {
      if (unitNumber === engineUnitCar1) {
        toast({
          variant: 'destructive',
          title: 'Unidade Ocupada',
          description: `A PU-${unitNumber} já está instalada no Carro #1! Não é permitido compartilhar o mesmo motor.`,
        })
        return
      }
      setEngineUnitCar2(unitNumber)
      setCar2Specs((prev) => ({
        ...prev,
        engine: `PU-${unitNumber} (${team?.engine_supplier || 'Audi Sport'})`,
      }))
      toast({
        title: `Motor do Carro #2 Atualizado!`,
        description: `Unidade física PU-${unitNumber} montada com sucesso no carro de ${roster.starter2?.name || 'Piloto 2'}.`,
      })
    }
  }

  // Handlers para troca de peça individual por carro
  const handleOpenPartSwapModal = (carNum: 1 | 2, partType: string) => {
    setActiveSwapTargetCar(carNum)
    setActiveSwapPartType(partType)
    setPartSwapModalOpen(true)
  }

  const handleConfirmPartSwap = (
    targetCar: 1 | 2,
    partType: string,
    specCode: string,
    condition: number,
    serialId: string,
  ) => {
    if (targetCar === 1) {
      if (car2PartSerials[partType] === serialId) {
        toast({
          variant: 'destructive',
          title: 'Instância em Uso',
          description: `A peça física ${serialId} já está montada no Carro #2. Escolha outra unidade disponível.`,
        })
        return
      }
      setCar1Specs((prev) => ({ ...prev, [partType]: specCode }))
      setCar1Conditions((prev) => ({ ...prev, [partType]: condition }))
      setCar1PartSerials((prev) => ({ ...prev, [partType]: serialId }))
      toast({
        title: `Peça Atualizada no Carro #1!`,
        description: `${serialId} (${specCode}) montada no carro de ${roster.starter1?.name || 'Piloto 1'}. Integridade: ${condition}%.`,
      })
    } else {
      if (car1PartSerials[partType] === serialId) {
        toast({
          variant: 'destructive',
          title: 'Instância em Uso',
          description: `A peça física ${serialId} já está montada no Carro #1. Escolha outra unidade disponível.`,
        })
        return
      }
      setCar2Specs((prev) => ({ ...prev, [partType]: specCode }))
      setCar2Conditions((prev) => ({ ...prev, [partType]: condition }))
      setCar2PartSerials((prev) => ({ ...prev, [partType]: serialId }))
      toast({
        title: `Peça Atualizada no Carro #2!`,
        description: `${serialId} (${specCode}) montada no carro de ${roster.starter2?.name || 'Piloto 2'}. Integridade: ${condition}%.`,
      })
    }
  }

  // Modal para confirmação de estouro do teto
  const [costCapBreachDialog, setCostCapBreachDialog] = useState<{
    isOpen: boolean
    actionType: 'repair' | 'engine'
    cost: number
    partId?: string
    overspendAmount: number
    pointsDeduction: number
    rdPenaltyRounds: number
  }>({
    isOpen: false,
    actionType: 'repair',
    cost: 0,
    overspendAmount: 0,
    pointsDeduction: 0,
    rdPenaltyRounds: 0,
  })

  // Carrega dados necessários do save com resiliência a offline, erros e timeouts
  const loadCarData = async () => {
    try {
      if (!team?.id) {
        // Se ainda não há team ou em transição, carrega apenas lista de pilotos se possível
        const dList = await f1Service.getDrivers().catch(() => [])
        if (dList && dList.length > 0) {
          setAllDrivers(dList)
        }
        return
      }

      const [pList, dList] = await Promise.all([
        f1Service.getTeamParts(team.id).catch((err) => {
          console.warn('Aviso ao carregar peças do carro (fallback para array vazio):', err)
          return []
        }),
        f1Service.getDrivers().catch((err) => {
          console.warn('Aviso ao carregar pilotos (fallback para array vazio):', err)
          return []
        }),
      ])
      setParts(pList || [])
      setAllDrivers(dList || [])
    } catch (err) {
      console.error('Erro ao carregar dados do carro:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCarData()

    const handleFocus = () => {
      loadCarData()
    }
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [team?.id])

  // Timer de segurança para nunca deixar a tela travada no skeleton indefinidamente
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false)
    }, 1200)
    return () => clearTimeout(safetyTimer)
  }, [])

  useRealtime('parts', () => {
    loadCarData()
  })

  // Roster canônico: starter1 = Carro #1, starter2 = Carro #2
  // Reserva e academia NUNCA nos cockpits
  const roster = useMemo(() => {
    if (!team?.id) {
      return { starter1: null, starter2: null, reserve: null, academyDrivers: [] }
    }
    const fullRoster = teamRosterService.buildTeamRoster(team, allDrivers)
    return {
      starter1: fullRoster.driver1,
      starter2: fullRoster.driver2,
      reserve: fullRoster.reserve,
      academyDrivers: fullRoster.academyDrivers,
    }
  }, [team, allDrivers])

  // Dados do Motor e Teto
  const COST_CAP_LIMIT = f1Service.COST_CAP_LIMIT
  const currentCostCapSpent = team?.cost_cap_spent ?? 0
  const activeEngineWear = team?.active_engine_wear ?? 21
  const enginePoolUsed = Math.min(4, Math.max(1, team?.engine_pool_used ?? 2))

  // Fornecedor de motor
  const engineSupplier = useMemo(() => {
    const sName = team?.engine_supplier || 'Audi Sport'
    return ENGINE_SUPPLIERS.find((s) => s.name === sName) || ENGINE_SUPPLIERS[1]
  }, [team?.engine_supplier])

  // Overall da frota e condição média de peças
  const { fleetOverall, partsAverageCondition, partsAvailability } = useMemo(() => {
    if (parts.length === 0) {
      return { fleetOverall: 78, partsAverageCondition: 76, partsAvailability: 92 }
    }
    const sumLevel = parts.reduce((acc, p) => acc + (p.level || 5), 0)
    const sumCond = parts.reduce((acc, p) => acc + (p.condition ?? 100), 0)
    const avgLevel = sumLevel / parts.length
    const avgCond = Math.round(sumCond / parts.length)

    // Base performance score
    const partsScore = avgLevel * 10
    const enginePower = engineSupplier.power
    let overall = Math.round(partsScore * 0.6 + enginePower * 0.4)

    return {
      fleetOverall: overall,
      partsAverageCondition: avgCond,
      partsAvailability: Math.min(100, Math.round(85 + parts.length * 2)),
    }
  }, [parts, engineSupplier])

  // Desgaste médio
  const averageWear = 100 - partsAverageCondition

  // Competitividade e Radar derivados dos times reais do save / dados canônicos
  const { gridTeamsTechnical, ourTeamTech, radarMetrics } = useMemo(() => {
    const rawProfiles = Object.values(OFFICIAL_TEAMS_TECHNICAL_DATA)
    const teamColors: Record<string, string> = {
      mercedes: '#00D2BE',
      ferrari: '#E8002D',
      mclaren: '#FF8000',
      redbull: '#3671C6',
      racingbulls: '#6692FF',
      alpine: '#0093CC',
      audi: '#E10600',
      haas: '#B6BABD',
      williams: '#64C4FF',
      astonmartin: '#229971',
      andretti: '#002B49',
      cadillac: '#C49A45',
    }

    const teamsList: TeamTechnicalRow[] = rawProfiles.map((t) => {
      const isOur =
        team?.id === t.teamKey ||
        team?.team_key === t.teamKey ||
        team?.name?.toLowerCase().includes(t.teamKey) ||
        (team?.name?.toLowerCase().includes('audi') && t.teamKey === 'audi')

      const comps = t.initialComponents
      const aeroVal = Math.round((comps.frontWing + comps.rearWing + comps.floor) / 3)
      const topSpeedVal = Math.round((comps.diffuser + comps.sidepods + t.macroRating) / 3)
      const tractionVal = Math.round((comps.chassis + comps.suspension) / 2)
      const tiresVal = Math.round((comps.brakes + comps.suspension) / 2)
      const reliabilityVal = Math.round(t.macroRating * 0.4 + 55)

      return {
        id: t.teamKey,
        name: t.teamName,
        color: teamColors[t.teamKey] || '#94A3B8',
        overall: t.macroRating,
        aero: aeroVal,
        topSpeed: topSpeedVal,
        traction: tractionVal,
        tires: tiresVal,
        reliability: reliabilityVal,
        isOurTeam: isOur,
      }
    })

    // Garante que a equipe do jogador apareça com dados destacados
    const foundOur = teamsList.find((t) => t.isOurTeam) || {
      id: team?.id || 'audi',
      name: team?.name || 'Audi Sport F1 Team',
      color: team?.color || '#E10600',
      overall: 78,
      aero: 82,
      topSpeed: 76,
      traction: 78,
      tires: 68,
      reliability: 82,
      isOurTeam: true,
    }

    // Calcula a média do grid real de todas as equipes
    const totalTeams = teamsList.length || 1
    const avgAero = Math.round(teamsList.reduce((acc, t) => acc + t.aero, 0) / totalTeams)
    const avgSpeed = Math.round(teamsList.reduce((acc, t) => acc + t.topSpeed, 0) / totalTeams)
    const avgTrac = Math.round(teamsList.reduce((acc, t) => acc + t.traction, 0) / totalTeams)
    const avgTires = Math.round(teamsList.reduce((acc, t) => acc + t.tires, 0) / totalTeams)
    const avgRel = Math.round(teamsList.reduce((acc, t) => acc + t.reliability, 0) / totalTeams)
    const avgOverall = Math.round(teamsList.reduce((acc, t) => acc + t.overall, 0) / totalTeams)

    const rad: RadarMetric[] = [
      { key: 'aero', label: 'Aerodinâmica', ourValue: foundOur.aero, gridAverage: avgAero },
      {
        key: 'topSpeed',
        label: 'Velocidade Máxima',
        ourValue: foundOur.topSpeed,
        gridAverage: avgSpeed,
      },
      { key: 'traction', label: 'Tração', ourValue: foundOur.traction, gridAverage: avgTrac },
      {
        key: 'balance',
        label: 'Equilíbrio',
        ourValue: Math.round((foundOur.aero + foundOur.traction) / 2),
        gridAverage: Math.round((avgAero + avgTrac) / 2),
      },
      {
        key: 'tireWear',
        label: 'Desgaste de Pneus',
        ourValue: foundOur.tires,
        gridAverage: avgTires,
      },
      {
        key: 'reliability',
        label: 'Confiabilidade',
        ourValue: foundOur.reliability,
        gridAverage: avgRel,
      },
    ]

    return {
      gridTeamsTechnical: teamsList,
      ourTeamTech: foundOur,
      radarMetrics: rad,
    }
  }, [team?.id, team?.name])

  // Ação Real 1: Reparar Peça com pior condição
  const handleRepairWorstPart = async (breachCostCap: boolean = false) => {
    if (!team) return

    // Encontra peça com menor integridade
    const sortedParts = [...parts].sort((a, b) => (a.condition ?? 100) - (b.condition ?? 100))
    const worstPart = sortedParts[0]

    if (!worstPart) {
      toast({
        title: 'Nenhuma peça cadastrada',
        description: 'Não foram encontrados componentes na garagem para revisão.',
      })
      return
    }

    if ((worstPart.condition ?? 100) >= 100) {
      toast({
        title: 'Todas as peças estão 100%',
        description: 'A integridade mecânica de todos os componentes já está perfeita.',
      })
      return
    }

    const cost = f1Service.getPartRepairCost(worstPart)

    if (team.budget < cost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `A revisão estrutural de ${worstPart.name} exige ${formatCurrency(cost)}. Saldo: ${formatCurrency(team.budget)}.`,
      })
      return
    }

    // Cost cap check
    if (!breachCostCap && currentCostCapSpent + cost > COST_CAP_LIMIT) {
      const overspend = currentCostCapSpent + cost - COST_CAP_LIMIT
      const pointsDed = Math.max(10, Math.round(10 + (overspend / 5000000) * 5))
      const rdRounds = Math.min(6, Math.max(2, Math.round(2 + overspend / 10000000)))

      setCostCapBreachDialog({
        isOpen: true,
        actionType: 'repair',
        cost,
        partId: worstPart.id,
        overspendAmount: overspend,
        pointsDeduction: pointsDed,
        rdPenaltyRounds: rdRounds,
      })
      return
    }

    setIsRepairing(true)
    try {
      if (breachCostCap) {
        const breachResult = await f1Service.applyCostCapBreach(
          team,
          cost,
          `Revisão de oficina em ${worstPart.name}`,
        )
        await f1Service.repairPart(worstPart.id)
        toast({
          variant: 'destructive',
          title: '🚨 INVESTIGAÇÃO FIA DEFLAGRADA!',
          description: `Reparo efetuado violando o teto! Excedente: ${formatCurrency(breachResult.overspendAmount)}. Punição: -${breachResult.pointsDeducted} pontos nos construtores.`,
        })
      } else {
        const { financialLedgerService } = await import('@/services/financialLedgerService')
        await financialLedgerService.postTransaction({
          teamId: team.id,
          seasonYear: season?.year || 2026,
          round: currentRound || 1,
          type: 'expense',
          category: 'repairs',
          subcategory: `repair_${worstPart.id}`,
          direction: 'outflow',
          amount: cost,
          costCapClassification: 'included',
          sourceSystem: 'car_workshop_repair',
          sourceEntityId: worstPart.id,
          idempotencyKey: `workshop_repair_${team.id}_${worstPart.id}_${Date.now()}`,
          description: `Oficina: Revisão e restauração estrutural de ${worstPart.name} a 100%`,
        })

        await Promise.all([
          f1Service.repairPart(worstPart.id),
          f1Service.addEvent(
            team.id,
            `Oficina: ${worstPart.name} restaurada a 100% por ${formatCurrency(cost)}.`,
            'desenvolvimento',
          ),
        ])

        toast({
          title: 'Revisão Concluída!',
          description: `${worstPart.name} foi inspecionada e restaurada para 100% de integridade estrutural.`,
        })
      }

      await refreshTeamAndSeason()
      await loadCarData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro no reparo',
        description: err?.message || 'Falha ao reparar componente.',
      })
    } finally {
      setIsRepairing(false)
      setRepairModalOpen(false)
    }
  }

  // Ação Real 2: Trocar Motor (introduzir nova PU no pool)
  const handleIntroduceNewEngine = async (breachCostCap: boolean = false) => {
    if (!team) return
    const engineCost = 15000000

    if (team.budget < engineCost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `Você precisa de ${formatCurrency(engineCost)} para encomendar uma nova unidade de potência.`,
      })
      return
    }

    if (!breachCostCap && currentCostCapSpent + engineCost > COST_CAP_LIMIT) {
      const overspend = currentCostCapSpent + engineCost - COST_CAP_LIMIT
      const pointsDed = Math.max(10, Math.round(10 + (overspend / 5000000) * 5))
      const rdRounds = Math.min(6, Math.max(2, Math.round(2 + overspend / 10000000)))

      setCostCapBreachDialog({
        isOpen: true,
        actionType: 'engine',
        cost: engineCost,
        overspendAmount: overspend,
        pointsDeduction: pointsDed,
        rdPenaltyRounds: rdRounds,
      })
      return
    }

    setIsChangingEngine(true)
    try {
      if (breachCostCap) {
        const breachResult = await f1Service.applyCostCapBreach(
          team,
          engineCost,
          `Introdução da PU #${(team.engine_pool_used || 1) + 1}`,
        )
        const res = await f1Service.introduceNewEngine(breachResult.team, 0)
        toast({
          variant: 'destructive',
          title: '🚨 INVESTIGAÇÃO FIA DEFLAGRADA!',
          description: `Estouro consciente de ${formatCurrency(breachResult.overspendAmount)}! Punição: -${breachResult.pointsDeducted} pontos nos construtores e eficácia de P&D reduzida por ${breachResult.rdPenaltyRounds} corridas.`,
        })
        if (res.penaltyPositions > 0) {
          toast({
            variant: 'destructive',
            title: `Motor #${res.engineNumber} Ativado — Penalidade de Grid!`,
            description: `Você largará com ${res.penaltyPositions} posições de punição no próximo GP por ultrapassar a cota anual de motores.`,
          })
        }
      } else {
        const res = await f1Service.introduceNewEngine(team, engineCost)
        if (res.penaltyPositions > 0) {
          toast({
            variant: 'destructive',
            title: `Motor #${res.engineNumber} Ativado — Penalidade Aplicada!`,
            description: `Limite anual de 4 motores excedido! Você largará com ${res.penaltyPositions} posições de punição no próximo GP.`,
          })
        } else {
          toast({
            title: `Nova Unidade de Potência #${res.engineNumber} Instalada!`,
            description: `Motor zerado (0% desgaste) instalado com sucesso dentro da cota regulamentar (${res.engineNumber}/4).`,
          })
        }
      }

      await refreshTeamAndSeason()
      await loadCarData()
    } catch (err: any) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao introduzir motor',
        description: err?.message || 'Falha ao ativar nova PU.',
      })
    } finally {
      setIsChangingEngine(false)
    }
  }

  // Executa confirmação de estouro consciente do teto
  const handleConfirmCostCapBreach = async () => {
    const dialog = { ...costCapBreachDialog }
    setCostCapBreachDialog((prev) => ({ ...prev, isOpen: false }))

    if (dialog.actionType === 'repair') {
      await handleRepairWorstPart(true)
    } else if (dialog.actionType === 'engine') {
      await handleIntroduceNewEngine(true)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-44 w-full rounded-2xl bg-slate-200" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl bg-slate-200" />
          <Skeleton className="h-64 rounded-xl bg-slate-200" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Top Header com Título e Subabas Reais do Design System */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200/80 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              Meu Carro
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeSubTab === 'garagem'
                ? 'Garagem - componentes instalados, setup e gerenciamento dos dois carros.'
                : 'Análise técnica, desempenho e desenvolvimento do carro.'}
            </p>
          </div>

          {/* Duas Subabas Reais: Garagem | Análise Técnica */}
          <div className="inline-flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('garagem')}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                activeSubTab === 'garagem'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Garagem
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('tecnica')}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                activeSubTab === 'tecnica'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Área Técnica
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SUBABA 1: GARAGEM                                         */}
        {/* ======================================================== */}
        {activeSubTab === 'garagem' && (
          <div className="space-y-6 animate-fade-in">
            {/* Hero Escuro Cinematográfico da Garagem */}
            <GarageHero
              team={team}
              currentRound={currentRound}
              fleetOverall={fleetOverall}
              reliability={ourTeamTech.reliability}
              averageWear={averageWear}
              partsAvailability={partsAvailability}
            />

            {/* Grid dos Dois Monopostos: Carro #1 e Carro #2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CARRO #1 */}
              <div className="space-y-4">
                <TeamCarCard
                  carNumber={1}
                  driver={roster.starter1}
                  team={team}
                  aeroSpec={car1Specs.frontWing?.split('-')[0]?.trim() || 'Aero B'}
                  chassisSpec="Chassi A"
                  puInUse={`PU-${engineUnitCar1}`}
                  puCycleText={`Uso ${engineUnitCar1}/4`}
                  reliability={ourTeamTech.reliability}
                  totalWear={Math.round(
                    100 - Object.values(car1Conditions).reduce((a, b) => a + b, 0) / 6,
                  )}
                  setupOrientation="Equilibrado"
                />

                <InstalledComponentsGrid
                  carNumber={1}
                  parts={parts}
                  driverName={roster.starter1?.name}
                  carSpecificSpecs={car1Specs}
                  carSpecificConditions={car1Conditions}
                  activeEngineCondition={
                    car1Conditions.engine ?? Math.max(10, 100 - activeEngineWear)
                  }
                  engineSupplier={team?.engine_supplier}
                  onSwapPart={(partId) => {
                    if (partId === 'engine') {
                      handleOpenEngineSwapModal(1)
                    } else {
                      handleOpenPartSwapModal(1, partId)
                    }
                  }}
                />
              </div>

              {/* CARRO #2 */}
              <div className="space-y-4">
                <TeamCarCard
                  carNumber={2}
                  driver={roster.starter2}
                  team={team}
                  aeroSpec={car2Specs.frontWing?.split('-')[0]?.trim() || 'Aero A'}
                  chassisSpec="Chassi B"
                  puInUse={`PU-${engineUnitCar2}`}
                  puCycleText={`Uso ${engineUnitCar2}/4`}
                  reliability={Math.max(50, ourTeamTech.reliability - 4)}
                  totalWear={Math.round(
                    100 - Object.values(car2Conditions).reduce((a, b) => a + b, 0) / 6,
                  )}
                  setupOrientation="Mais ponta (baixa asa)"
                />

                <InstalledComponentsGrid
                  carNumber={2}
                  parts={parts}
                  driverName={roster.starter2?.name}
                  carSpecificSpecs={car2Specs}
                  carSpecificConditions={car2Conditions}
                  activeEngineCondition={
                    car2Conditions.engine ?? Math.max(10, 96 - activeEngineWear)
                  }
                  engineSupplier={team?.engine_supplier}
                  onSwapPart={(partId) => {
                    if (partId === 'engine') {
                      handleOpenEngineSwapModal(2)
                    } else {
                      handleOpenPartSwapModal(2, partId)
                    }
                  }}
                />
              </div>
            </div>

            {/* Três Cards Inferiores: Integridade Estrutural + Índice Competitividade + Ações Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Integridade Estrutural */}
              <StructuralIntegrityCard
                overallIntegrity={partsAverageCondition}
                chassisCondition={92}
                survivalCellCondition={88}
                fixingPointsCondition={81}
                generalStructureCondition={87}
              />

              {/* Índice de Competitividade */}
              <CompetitivenessCard
                score={ourTeamTech.overall}
                aerodynamics={ourTeamTech.aero}
                powerUnit={engineSupplier.power}
                mechanics={ourTeamTech.traction}
                evolutionPotential={79}
              />

              {/* Ações Rápidas com conexões reais */}
              <QuickActionsCard
                onRepairPart={() => setRepairModalOpen(true)}
                onOpenQuickSwap={() => setQuickSwapSelectorOpen(true)}
                onUpgradePart={() => {
                  navigate('/car?tab=technical')
                }}
                onCompareCars={() => setCompareModalOpen(true)}
                onBalanceSetup={() => setBalanceModalOpen(true)}
                isRepairing={isRepairing}
              />
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBABA 2: ÁREA TÉCNICA                                    */}
        {/* ======================================================== */}
        {activeSubTab === 'tecnica' && (
          <div className="space-y-6 animate-fade-in">
            {/* Hero Escuro Cinematográfico da Área Técnica */}
            <TechnicalHero
              team={team}
              technicalOverall={ourTeamTech.overall}
              competitivenessIndex={ourTeamTech.overall - 2}
              structuralIntegrity={partsAverageCondition}
              globalReliability={ourTeamTech.reliability}
            />

            {/* Grid 2 Colunas: Mapa de Performance Radar + Diagnóstico Técnico */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PerformanceRadarMap metrics={radarMetrics} />
              <TechnicalDiagnosisPanel />
            </div>

            {/* Grid 2 Colunas: Power Unit & Sistemas + Correlação Técnica P&D */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PowerUnitSystemsPanel
                supplierName={team?.engine_supplier || 'Audi Sport'}
                overallIntegrity={
                  technicalSelectedCarPU === 1
                    ? (car1Conditions.engine ?? 88)
                    : (car2Conditions.engine ?? 82)
                }
                activeUnitIndex={technicalSelectedCarPU === 1 ? engineUnitCar1 : engineUnitCar2}
                totalUnitsLimit={4}
                currentKm={1482 + currentRound * 305}
                usageCycles={currentRound}
                estimatedWear={
                  technicalSelectedCarPU === 1
                    ? 100 - (car1Conditions.engine ?? 88)
                    : 100 - (car2Conditions.engine ?? 82)
                }
                targetCar={technicalSelectedCarPU}
                driver1Name={roster.starter1?.name}
                driver2Name={roster.starter2?.name}
                onSelectCar={(carNum) => setTechnicalSelectedCarPU(carNum)}
                onIntroduceNewEngine={(targetCar) => handleOpenEngineSwapModal(targetCar)}
                isChangingEngine={isChangingEngine}
                costCapAvailable={Math.max(0, COST_CAP_LIMIT - currentCostCapSpent)}
              />

              <TechnicalCorrelationPanel
                windTunnelCorr={85}
                cfdCorr={82}
                trackCorr={76}
                lastUpdateName="Pacote Aerodinâmico B"
                lastUpdateStatus="Positiva"
                qualiGain="+0,450 s"
                raceGain="+0,312 s"
                overallEfficiency={69}
              />
            </div>

            {/* Tabela de Competitividade no Grid */}
            <GridCompetitiveness teams={gridTeamsTechnical} currentTeamId={team?.id} />

            {/* Três Cards de Rodapé: Impacto Regulamento 2026, Próxima Atualização e Recomendações */}
            <TechnicalFooterCards
              regulationYear={2026}
              nextTechnicalUpdateRound={Math.min(24, currentRound + 5)}
              nextTechnicalUpdateTrack="GP da Espanha"
              engineeringRecommendations="Focar na redução de arrasto nas curvas de alta velocidade e na melhoria da estabilidade traseira com novos flaps de assoalho."
              onOpenEngineeringRecommendations={() => setEngineeringModalOpen(true)}
            />
          </div>
        )}
      </div>

      {/* MODAL: REVISAR / TROCAR PEÇA DA OFICINA */}
      <Dialog open={repairModalOpen} onOpenChange={setRepairModalOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Oficina Mecânica // Revisão Estrutural
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Restaura a peça com maior fadiga mecânica para 100% de integridade operacional.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs space-y-2">
            <p className="text-slate-600">
              A oficina executará ensaios não destrutivos de ultrassom e substituição preventiva de
              elementos de carbono desgastados.
            </p>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Saldo da Equipe:</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(team?.budget || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gasto no Teto FIA:</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(currentCostCapSpent)} / {formatCurrency(COST_CAP_LIMIT)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRepairModalOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button
              onClick={() => handleRepairWorstPart(false)}
              disabled={isRepairing}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
            >
              {isRepairing ? 'Restaurando...' : 'Confirmar Revisão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: COMPARAR CARROS */}
      <Dialog open={compareModalOpen} onOpenChange={setCompareModalOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Comparativo de Telemetria // Carro #1 vs Carro #2
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Balanço técnico entre os dois cockpits para o próximo GP.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block border-b pb-1">
                Carro #1 ({roster.starter1?.name || 'Cockpit vago'})
              </span>
              <div>
                Aero: <strong>Spec B</strong>
              </div>
              <div>
                Chassi: <strong>Spec A</strong>
              </div>
              <div>
                Orientação: <strong>Equilibrado</strong>
              </div>
              <div>
                Desgaste: <strong className="text-emerald-600">28%</strong>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block border-b pb-1">
                Carro #2 ({roster.starter2?.name || 'Cockpit vago'})
              </span>
              <div>
                Aero: <strong>Spec A</strong>
              </div>
              <div>
                Chassi: <strong>Spec B</strong>
              </div>
              <div>
                Orientação: <strong>Mais ponta (baixa asa)</strong>
              </div>
              <div>
                Desgaste: <strong className="text-amber-600">34%</strong>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setCompareModalOpen(false)}
              className="bg-slate-900 text-white text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: EQUILIBRAR SETUP */}
      <Dialog open={balanceModalOpen} onOpenChange={setBalanceModalOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Equilibrar Setup dos Monopostos
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Equalizar distribuições de carga aerodinâmica e calibração de asas entre os dois
              carros.
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-slate-600 py-2 leading-relaxed">
            A equalização foi sincronizada pela equipe de telemetria. Os dois carros agora operam na
            janela ótima recomendada para o circuito atual.
          </p>

          <DialogFooter>
            <Button
              onClick={() => {
                setBalanceModalOpen(false)
                toast({
                  title: 'Setup Equilibrado!',
                  description: 'Ajustes aplicados aos parâmetros de asa dianteira e suspensão.',
                })
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              Aplicar ao Parque Fechado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: ESTOURO CONSCIENTE DO TETO DE GASTOS */}
      <Dialog
        open={costCapBreachDialog.isOpen}
        onOpenChange={(open) =>
          !open && setCostCapBreachDialog((prev) => ({ ...prev, isOpen: false }))
        }
      >
        <DialogContent className="bg-white border-red-200 text-slate-900 max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold text-red-700">
              ALERTA: Violação do Teto de Gastos FIA
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Esta operação ultrapassa o limite orçamentário anual de R$ 215,00 M.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs space-y-2 bg-red-50/60 p-3 rounded-lg border border-red-100 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Custo da Operação:</span>
              <strong className="text-slate-900">{formatCurrency(costCapBreachDialog.cost)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Excedente no Teto:</span>
              <strong className="text-red-700">
                {formatCurrency(costCapBreachDialog.overspendAmount)}
              </strong>
            </div>
            <div className="flex justify-between border-t border-red-200/60 pt-1 text-red-800">
              <span>Sanção Estimada:</span>
              <strong>-{costCapBreachDialog.pointsDeduction} pts (Construtores)</strong>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCostCapBreachDialog((prev) => ({ ...prev, isOpen: false }))}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCostCapBreach}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
            >
              Estourar Teto e Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL PONTO 3: RECOMENDAÇÕES DA ENGENHARIA (PLANO TÉCNICO DETALHADO) */}
      <EngineeringPlanModal
        open={engineeringModalOpen}
        onOpenChange={setEngineeringModalOpen}
        onNavigateToDevelopment={(targetArea) => {
          navigate('/car?tab=technical', { state: { targetArea } })
        }}
      />

      {/* MODAL PONTO 2: TROCA INDIVIDUAL DE MOTOR ENTRE CARRO #1 E CARRO #2 */}
      <EngineSwapModal
        open={engineSwapModalOpen}
        onOpenChange={setEngineSwapModalOpen}
        targetCar={activeSwapTargetCar}
        driverName={activeSwapTargetCar === 1 ? roster.starter1?.name : roster.starter2?.name}
        currentCar1EngineUnit={engineUnitCar1}
        currentCar2EngineUnit={engineUnitCar2}
        totalUnitsLimit={4}
        onConfirmSwap={handleConfirmEngineSwap}
      />

      {/* MODAL PONTO 2: TROCA INDIVIDUAL DE PEÇA POR CARRO */}
      <PartSwapModal
        open={partSwapModalOpen}
        onOpenChange={setPartSwapModalOpen}
        targetCar={activeSwapTargetCar}
        driverName={activeSwapTargetCar === 1 ? roster.starter1?.name : roster.starter2?.name}
        partType={activeSwapPartType}
        currentPartSpec={
          activeSwapTargetCar === 1
            ? car1Specs[activeSwapPartType] || 'Spec B'
            : car2Specs[activeSwapPartType] || 'Spec A'
        }
        currentPartCondition={
          activeSwapTargetCar === 1
            ? (car1Conditions[activeSwapPartType] ?? 80)
            : (car2Conditions[activeSwapPartType] ?? 75)
        }
        otherCarPartInstanceSerial={
          activeSwapTargetCar === 1
            ? car2PartSerials[activeSwapPartType]
            : car1PartSerials[activeSwapPartType]
        }
        onConfirmSwapPart={handleConfirmPartSwap}
      />

      {/* MODAL PONTO 2(L): AÇÕES RÁPIDAS - SELETOR DE CARRO E PEÇA */}
      <QuickSwapCarSelectorModal
        open={quickSwapSelectorOpen}
        onOpenChange={setQuickSwapSelectorOpen}
        driver1Name={roster.starter1?.name}
        driver2Name={roster.starter2?.name}
        onSelectTarget={(targetCar, partType) => {
          if (partType === 'engine') {
            handleOpenEngineSwapModal(targetCar)
          } else {
            handleOpenPartSwapModal(targetCar, partType)
          }
        }}
      />
    </div>
  )
}
