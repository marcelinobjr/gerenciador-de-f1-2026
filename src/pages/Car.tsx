import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import { PartModel, SponsorModel, DriverModel } from '@/types/f1'
import { ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { managerEffectService } from '@/services/managerEffectService'
import { CarBlueprint } from '@/components/CarBlueprint'
import { RealisticCarHero } from '@/components/RealisticCarHero'
import { AmbientBackground } from '@/components/AmbientBackground'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import {
  Wrench,
  Cpu,
  Zap,
  Gauge,
  CheckCircle,
  AlertTriangle,
  Info,
  Flame,
  Layers,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Sliders,
  Activity,
  DollarSign,
  FlaskConical,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { notificationService } from '@/services/notificationService'
import { PageHeader } from '@/components/PageHeader'
import { ProgressBar } from '@/components/ProgressBar'
import { StatCard } from '@/components/StatCard'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CarDevelopmentSection } from '@/components/CarDevelopmentSection'
import { RegulationSection } from '@/components/RegulationSection'
import { regulationTimelineService } from '@/services/regulationService'
import type { RegulationTimelineState } from '@/types/canonical-regulations'

export default function CarPage() {
  const { user, team, season, refreshTeamAndSeason } = useAuth()

  const [parts, setParts] = useState<PartModel[]>([])
  const [sponsors, setSponsors] = useState<SponsorModel[]>([])
  const [drivers, setDrivers] = useState<DriverModel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [upgradingPartId, setUpgradingPartId] = useState<string | null>(null)
  const [repairingPartId, setRepairingPartId] = useState<string | null>(null)
  const [activeCarDisplay, setActiveCarDisplay] = useState<'realistic' | 'blueprint'>('realistic')
  const [isUploadingCarImage, setIsUploadingCarImage] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'development' | 'regulations'>('overview')
  const [timelineState, setTimelineState] = useState<RegulationTimelineState | null>(null)

  const loadParts = async () => {
    if (!team) {
      setLoading(false)
      return
    }
    try {
      const [pList, spList, drList] = await Promise.all([
        f1Service.getTeamParts(team.id),
        f1Service.getTeamSponsors(team.id),
        f1Service.getTeamDrivers(team.id),
      ])
      setParts(pList)
      setSponsors(spList)
      setDrivers(drList)

      // Auto-select first part if none selected
      if (!selectedPartId && pList.length > 0) {
        setSelectedPartId(pList[0].id)
      }

      try {
        const tState = await regulationTimelineService.getTimeline(team.id, season?.year || 2026)
        setTimelineState(tState)
      } catch {
        // tolerância
      }
    } catch (err) {
      console.error('Error loading parts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadParts()

    // Recarrega quando a janela/aba volta ao foco
    const handleFocus = () => {
      loadParts()
    }
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [team?.id])

  useRealtime('parts', () => {
    loadParts()
  })

  // Selected Part object
  const selectedPart = useMemo(() => {
    if (!selectedPartId) return parts[0] || null
    return parts.find((p) => p.id === selectedPartId) || parts[0] || null
  }, [parts, selectedPartId])

  // Current engine spec
  const currentEngine = useMemo(() => {
    const sName = team?.engine_supplier || 'Mercedes'
    return ENGINE_SUPPLIERS.find((s) => s.name === sName) || ENGINE_SUPPLIERS[1]
  }, [team?.engine_supplier])

  // Overall Car Rating calculation & Parts average condition
  const { overallLevel, partsAverage, averageCondition } = useMemo(() => {
    if (parts.length === 0) {
      return { overallLevel: 75, partsAverage: 5, averageCondition: 100 }
    }
    const sumLevel = parts.reduce((acc, p) => acc + p.level, 0)
    const sumCondition = parts.reduce((acc, p) => acc + (p.condition ?? 100), 0)
    const avg = sumLevel / parts.length // 0 to 10
    const avgCond = Math.round(sumCondition / parts.length)

    // Base performance score
    const partsScore = avg * 10
    const engineScore = currentEngine.power
    let overall = Math.round(partsScore * 0.6 + engineScore * 0.4)

    // If wear is below 60%, apply real-time penalty to the overall performance rating
    if (avgCond < 60) {
      const penalty = Math.round((60 - avgCond) * 0.25)
      overall = Math.max(20, overall - penalty)
    }

    return {
      overallLevel: overall,
      partsAverage: Number(avg.toFixed(1)),
      averageCondition: avgCond,
    }
  }, [parts, currentEngine])

  // Car custom image URL from PocketBase record
  const customCarImageUrl = useMemo(() => {
    if (!team) return null
    if (team.carImage) {
      return pb.files.getUrl(team, team.carImage)
    }
    return null
  }, [team])

  // Verificação de equipe personalizada vs oficial
  const isCustomTeam = useMemo(() => {
    return Boolean(team?.is_custom ?? team?.name === 'Escuderia Brasil')
  }, [team])

  // Handlers para upload e restauração da imagem do carro
  const handleUploadCarImage = async (file: File) => {
    if (!team) return
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo de imagem (PNG, JPG ou WEBP).',
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo da imagem é de 5MB.',
      })
      return
    }

    setIsUploadingCarImage(true)
    try {
      await f1Service.uploadTeamCarImage(team.id, file)
      await refreshTeamAndSeason()
      toast({
        title: 'Imagem do carro atualizada!',
        description: 'A nova foto do monoposto foi salva e integrada com sucesso ao chassi.',
      })
    } catch (err: any) {
      console.error('Erro ao atualizar imagem do carro:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao trocar imagem',
        description: err?.message || 'Falha ao fazer upload da imagem no servidor.',
      })
    } finally {
      setIsUploadingCarImage(false)
    }
  }

  const handleResetCarImage = async () => {
    if (!team) return
    setIsUploadingCarImage(true)
    try {
      await f1Service.resetTeamCarImage(team.id)
      await refreshTeamAndSeason()
      toast({
        title: 'Imagem padrão restaurada',
        description: 'A vista lateral voltou para o monoposto oficial homologado da FIA.',
      })
    } catch (err: any) {
      console.error('Erro ao restaurar imagem do carro:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao restaurar imagem',
        description: err?.message || 'Falha ao restaurar imagem padrão.',
      })
    } finally {
      setIsUploadingCarImage(false)
    }
  }

  // Cost cap limit FIA (R$ 215M)
  const COST_CAP_LIMIT = f1Service.COST_CAP_LIMIT
  const currentCostCapSpent = team?.cost_cap_spent ?? 0
  const remainingCostCap = Math.max(0, COST_CAP_LIMIT - currentCostCapSpent)
  const isCostCapBreached = currentCostCapSpent >= COST_CAP_LIMIT

  // Engine pool & wear
  const enginePoolUsed = team?.engine_pool_used ?? 1
  const activeEngineWear = team?.active_engine_wear ?? 15
  const remainingEnginesInQuota = Math.max(0, f1Service.MAX_ALLOWED_ENGINES - enginePoolUsed)
  const isOverEngineQuota = enginePoolUsed >= f1Service.MAX_ALLOWED_ENGINES

  // Upgrade part cost calculation — com bônus conservador de Fábrica P&D (até -12%)
  // e bônus de technicalManagement do Manager (workshopEfficiencyBonus: 1% a 6%)
  const factoryDiscount = f1Service.getFactoryDiscountRate(team?.factory_level || 3)
  const managerTechBonus = managerEffectService.getWorkshopDiscountModifier(team)
  const getUpgradeCost = (currentLevel: number) => {
    const raw = 4000000 + currentLevel * 1500000
    return Math.round(raw * (1 - factoryDiscount) * (1 - managerTechBonus * 0.5))
  }

  // Estado para diálogo de estouro consciente do Teto de Gastos (Investigação FIA)
  const [costCapBreachDialog, setCostCapBreachDialog] = useState<{
    isOpen: boolean
    actionType: 'upgrade' | 'repair' | 'engine' | 'supplier'
    cost: number
    part?: PartModel
    supplier?: any
    itemName: string
    overspendAmount: number
    pointsDeduction: number
    rdPenaltyRounds: number
  }>({
    isOpen: false,
    actionType: 'upgrade',
    cost: 0,
    itemName: '',
    overspendAmount: 0,
    pointsDeduction: 0,
    rdPenaltyRounds: 0,
  })

  // Executa o aprimoramento da peça (com ou sem estouro)
  const executeUpgradePart = async (part: PartModel, breachCostCap: boolean = false) => {
    if (!team) return
    const cost = getUpgradeCost(part.level)

    if (team.budget < cost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `Você precisa de ${formatCurrency(cost)} para investir em ${part.name}. Saldo: ${formatCurrency(team.budget)}.`,
      })
      return
    }

    // Se estiver sob penalidade de P&D pela FIA, avisa sobre eficácia reduzida
    const hasRdPenalty = (team.rd_penalty_rounds_left || 0) > 0

    setUpgradingPartId(part.id)
    try {
      const newLevel = part.level + 1

      if (breachCostCap) {
        const breachResult = await f1Service.applyCostCapBreach(
          team,
          cost,
          `Desenvolvimento da peça ${part.name} (Nível ${newLevel})`,
        )
        await f1Service.updatePart(part.id, { level: newLevel })

        toast({
          variant: 'destructive',
          title: '🚨 INVESTIGAÇÃO FIA DEFLAGRADA!',
          description: `Estouro de ${formatCurrency(breachResult.overspendAmount)} no teto! Punição: -${breachResult.pointsDeducted} pts de construtores e ${breachResult.rdPenaltyRounds} corridas com P&D reduzido.`,
        })
      } else {
        const newBudget = team.budget - cost
        const newSpentCap = currentCostCapSpent + cost

        await Promise.all([
          f1Service.updatePart(part.id, { level: newLevel }),
          f1Service.updateTeam(team.id, { budget: newBudget, cost_cap_spent: newSpentCap }),
          f1Service.addEvent(
            team.id,
            `P&D: ${part.name} aprimorado para o Nível ${newLevel} por ${formatCurrency(cost)} (Cost Cap: ${formatCurrency(newSpentCap)}/${formatCurrency(COST_CAP_LIMIT)}).`,
            'desenvolvimento',
          ),
        ])

        toast({
          title: 'Aprimoramento Concluído!',
          description: `${part.name} subiu para o nível ${newLevel}/10.${hasRdPenalty ? ' ⚠️ Eficácia de P&D reduzida por sanção FIA.' : ''}`,
        })
      }

      refreshTeamAndSeason()
      loadParts()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro no Aprimoramento',
        description: err?.message || 'Falha ao processar upgrade de peça.',
      })
    } finally {
      setUpgradingPartId(null)
    }
  }

  // Handle invest / upgrade part with Cost Cap check
  const handleUpgradePart = async (part: PartModel) => {
    if (!team) return
    if (part.level >= 10) {
      toast({
        title: 'Componente no Nível Máximo!',
        description: `${part.name} já atingiu o nível 10 permitido pelas regras FIA 2026.`,
      })
      return
    }

    const cost = getUpgradeCost(part.level)

    // Cost Cap Check: Oferece escolha consciente de estourar o teto
    if (currentCostCapSpent + cost > COST_CAP_LIMIT) {
      const overspend = currentCostCapSpent + cost - COST_CAP_LIMIT
      const pointsDed = Math.max(10, Math.round(10 + (overspend / 5000000) * 5))
      const rdRounds = Math.min(6, Math.max(2, Math.round(2 + overspend / 10000000)))

      setCostCapBreachDialog({
        isOpen: true,
        actionType: 'upgrade',
        cost,
        part,
        itemName: `${part.name} (Nível ${part.level + 1})`,
        overspendAmount: overspend,
        pointsDeduction: pointsDed,
        rdPenaltyRounds: rdRounds,
      })
      return
    }

    await executeUpgradePart(part, false)
  }

  // Executa o reparo de oficina (com ou sem estouro)
  const executeRepairPart = async (part: PartModel, breachCostCap: boolean = false) => {
    if (!team) return
    const rawCost = f1Service.getPartRepairCost(part, managerTechBonus)
    const cost = Math.round(rawCost * (1 - factoryDiscount))

    if (team.budget < cost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente para Oficina',
        description: `A revisão estrutural de ${part.name} exige ${formatCurrency(cost)}. Saldo atual: ${formatCurrency(team.budget)}.`,
      })
      return
    }

    setRepairingPartId(part.id)
    try {
      if (breachCostCap) {
        const breachResult = await f1Service.applyCostCapBreach(
          team,
          cost,
          `Revisão de oficina em ${part.name}`,
        )
        await f1Service.repairPart(part.id)

        toast({
          variant: 'destructive',
          title: '🚨 INVESTIGAÇÃO FIA DEFLAGRADA!',
          description: `Reparo efetuado violando o teto! Excedente: ${formatCurrency(breachResult.overspendAmount)}. Punição: -${breachResult.pointsDeducted} pontos nos construtores.`,
        })
      } else {
        const newBudget = team.budget - cost
        const newSpentCap = currentCostCapSpent + cost

        await Promise.all([
          f1Service.repairPart(part.id),
          f1Service.updateTeam(team.id, { budget: newBudget, cost_cap_spent: newSpentCap }),
          f1Service.addEvent(
            team.id,
            `Oficina: ${part.name} restaurada a 100% (Custo: ${formatCurrency(cost)} | Cost Cap: ${formatCurrency(newSpentCap)}/${formatCurrency(COST_CAP_LIMIT)}).`,
            'desenvolvimento',
          ),
        ])

        toast({
          title: 'Revisão Concluída!',
          description: `${part.name} foi inspecionada por ultrassom e restaurada para 100% de integridade.`,
        })
      }

      refreshTeamAndSeason()
      loadParts()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro no Reparo',
        description: err?.message || 'Falha ao reparar componente.',
      })
    } finally {
      setRepairingPartId(null)
    }
  }

  // Handle repair / overhaul part with Cost Cap check
  const handleRepairPart = async (part: PartModel) => {
    if (!team) return
    const currentCond = part.condition ?? 100
    if (currentCond >= 100) {
      toast({
        title: 'Peça em Perfeitas Condições',
        description: `${part.name} já está com 100% de integridade estrutural. Nenhuma revisão necessária.`,
      })
      return
    }

    const rawCost = f1Service.getPartRepairCost(part, managerTechBonus)
    const cost = Math.round(rawCost * (1 - factoryDiscount))

    // Cost Cap check: Opção de estourar teto conscientemente
    if (currentCostCapSpent + cost > COST_CAP_LIMIT) {
      const overspend = currentCostCapSpent + cost - COST_CAP_LIMIT
      const pointsDed = Math.max(10, Math.round(10 + (overspend / 5000000) * 5))
      const rdRounds = Math.min(6, Math.max(2, Math.round(2 + overspend / 10000000)))

      setCostCapBreachDialog({
        isOpen: true,
        actionType: 'repair',
        cost,
        part,
        itemName: `Revisão de ${part.name}`,
        overspendAmount: overspend,
        pointsDeduction: pointsDed,
        rdPenaltyRounds: rdRounds,
      })
      return
    }

    await executeRepairPart(part, false)
  }

  // Introduce new engine into pool (com opção de estourar teto conscientemente)
  const [introducingEngine, setIntroducingEngine] = useState(false)
  const executeIntroduceNewEngine = async (breachCostCap: boolean = false) => {
    if (!team) return
    const engineCost = 15000000 // R$ 15M por nova PU

    if (team.budget < engineCost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `Você precisa de ${formatCurrency(engineCost)} para encomendar uma nova unidade de potência.`,
      })
      return
    }

    setIntroducingEngine(true)
    try {
      if (breachCostCap) {
        const breachResult = await f1Service.applyCostCapBreach(
          team,
          engineCost,
          `Introdução da PU #${(team.engine_pool_used || 1) + 1}`,
        )
        // Atualiza a equipe com o novo motor
        const res = await f1Service.introduceNewEngine(breachResult.team, 0)
        toast({
          variant: 'destructive',
          title: '🚨 INVESTIGAÇÃO FIA DEFLAGRADA!',
          description: `Estouro consciente de ${formatCurrency(breachResult.overspendAmount)}! Punição: -${breachResult.pointsDeducted} pontos nos construtores e eficácia reduzida por ${breachResult.rdPenaltyRounds} corridas.`,
        })
        if (res.penaltyPositions > 0) {
          toast({
            variant: 'destructive',
            title: `Motor #${res.engineNumber} Ativado — Penalidade de Grid!`,
            description: `Você largará com ${res.penaltyPositions} posições de punição no próximo GP por ultrapassar a cota de motores.`,
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
            description: `Motor zerado (0% desgaste) instalado com sucesso dentro da cota permitida (${res.engineNumber}/4).`,
          })
        }
      }
      refreshTeamAndSeason()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao introduzir motor',
        description: err?.message || 'Falha ao ativar nova PU.',
      })
    } finally {
      setIntroducingEngine(false)
    }
  }

  const handleIntroduceNewEngine = async () => {
    if (!team) return
    const engineCost = 15000000 // R$ 15M por nova PU

    if (currentCostCapSpent + engineCost > COST_CAP_LIMIT) {
      const overspend = currentCostCapSpent + engineCost - COST_CAP_LIMIT
      const pointsDed = Math.max(10, Math.round(10 + (overspend / 5000000) * 5))
      const rdRounds = Math.min(6, Math.max(2, Math.round(2 + overspend / 10000000)))

      setCostCapBreachDialog({
        isOpen: true,
        actionType: 'engine',
        cost: engineCost,
        itemName: `Nova Unidade de Potência #${(team.engine_pool_used || 1) + 1}`,
        overspendAmount: overspend,
        pointsDeduction: pointsDed,
        rdPenaltyRounds: rdRounds,
      })
      return
    }

    await executeIntroduceNewEngine(false)
  }

  // Switch engine supplier handler with Cost Cap check
  const executeSwitchSupplier = async (supplier: any, breachCostCap: boolean = false) => {
    if (!supplier || !team) return
    const penaltyFee = 15000000 // R$ 15M troca de motor

    if (team.budget < penaltyFee) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `A rescisão e adaptação de chassi exige ${formatCurrency(penaltyFee)}.`,
      })
      return
    }

    setIsProcessing(true)
    try {
      if (breachCostCap) {
        const breachResult = await f1Service.applyCostCapBreach(
          team,
          penaltyFee,
          `Troca de fornecedor de motor para ${supplier.name}`,
        )
        await f1Service.updateTeam(team.id, {
          engine_supplier: supplier.name,
        })
        toast({
          variant: 'destructive',
          title: '🚨 INVESTIGAÇÃO FIA DEFLAGRADA!',
          description: `Troca de fornecedor acima do teto! Excedente: ${formatCurrency(breachResult.overspendAmount)}. Punição: -${breachResult.pointsDeducted} pontos nos construtores e restrição de P&D por ${breachResult.rdPenaltyRounds} corridas.`,
        })
      } else {
        const newBudget = team.budget - penaltyFee
        const newSpentCap = currentCostCapSpent + penaltyFee

        await f1Service.updateTeam(team.id, {
          engine_supplier: supplier.name,
          budget: newBudget,
          cost_cap_spent: newSpentCap,
        })

        await f1Service.addEvent(
          team.id,
          `Fornecedor de unidade de potência trocado para ${supplier.name} (Custo: ${formatCurrency(penaltyFee)} | Cost Cap: ${formatCurrency(newSpentCap)}/${formatCurrency(COST_CAP_LIMIT)}).`,
          'desenvolvimento',
        )

        toast({
          title: 'Fornecedor de Motor Atualizado!',
          description: `A equipe agora é impulsionada pela unidade ${supplier.name} 50/50 Híbrida.`,
        })
      }

      setSelectedSupplier(null)
      refreshTeamAndSeason()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na troca de motor',
        description: err?.message || 'Falha ao alterar fornecedor.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSwitchSupplier = async () => {
    if (!selectedSupplier || !team) return
    const penaltyFee = 15000000 // R$ 15M troca de motor

    if (currentCostCapSpent + penaltyFee > COST_CAP_LIMIT) {
      const overspend = currentCostCapSpent + penaltyFee - COST_CAP_LIMIT
      const pointsDed = Math.max(10, Math.round(10 + (overspend / 5000000) * 5))
      const rdRounds = Math.min(6, Math.max(2, Math.round(2 + overspend / 10000000)))

      setCostCapBreachDialog({
        isOpen: true,
        actionType: 'supplier',
        cost: penaltyFee,
        supplier: selectedSupplier,
        itemName: `Troca para Motor ${selectedSupplier.name}`,
        overspendAmount: overspend,
        pointsDeduction: pointsDed,
        rdPenaltyRounds: rdRounds,
      })
      return
    }

    await executeSwitchSupplier(selectedSupplier, false)
  }

  // Confirmação do estouro consciente
  const handleConfirmCostCapBreach = async () => {
    const dialog = { ...costCapBreachDialog }
    setCostCapBreachDialog((prev) => ({ ...prev, isOpen: false }))

    if (dialog.actionType === 'upgrade' && dialog.part) {
      await executeUpgradePart(dialog.part, true)
    } else if (dialog.actionType === 'repair' && dialog.part) {
      await executeRepairPart(dialog.part, true)
    } else if (dialog.actionType === 'engine') {
      await executeIntroduceNewEngine(true)
    } else if (dialog.actionType === 'supplier' && dialog.supplier) {
      await executeSwitchSupplier(dialog.supplier, true)
    }
  }

  // Helper condition color and badge text
  const getConditionInfo = (cond: number = 100) => {
    if (cond >= 80) {
      return {
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400',
        barColor: 'from-emerald-500 to-teal-400',
        status: 'Excelente / Operacional',
        risk: 'Risco de falha desprezível (<1%)',
      }
    }
    if (cond >= 50) {
      return {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/40 text-amber-400',
        barColor: 'from-amber-500 to-yellow-400',
        status: 'Desgaste Moderado',
        risk: 'Pequena perda de downforce / eficiência',
      }
    }
    return {
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/40 text-red-400',
      barColor: 'from-red-600 to-rose-400',
      status: 'Crítico / Fissura Estrutural',
      risk: 'Alto risco de quebra mecânica / DNF na corrida!',
    }
  }

  const selectedCondInfo = selectedPart ? getConditionInfo(selectedPart.condition ?? 100) : null
  const selectedRepairCost = selectedPart ? f1Service.getPartRepairCost(selectedPart) : 0
  const selectedUpgradeCost = selectedPart ? getUpgradeCost(selectedPart.level) : 0
  const isSelectedMax = selectedPart ? selectedPart.level >= 10 : false

  return (
    <div className="relative space-y-8 animate-fade-in-up">
      <AmbientBackground />
      {/* PageHeader Race Operations */}
      <PageHeader
        eyebrow="RACE OPERATIONS // ENGENHARIA & P&D"
        title="Monoposto 2026 // Arquitetura & Componentes"
        description="Blueprint milimetrado, telemetria de fadiga mecânica após cada GP e gestão das 6 peças homologadas sob o teto da FIA."
        badge={
          <Badge
            variant="outline"
            className="border-[#1F2733] bg-[#090D15] text-[#F5F7FA] font-mono text-xs"
          >
            Nível Geral: {overallLevel}/10
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`font-mono text-xs px-3 py-1.5 flex items-center gap-2 ${
                averageCondition >= 80
                  ? 'border-emerald-500/40 text-emerald-400 bg-[#11161F]'
                  : averageCondition >= 60
                    ? 'border-amber-500/40 text-amber-400 bg-[#11161F]'
                    : 'border-red-500/50 text-red-400 bg-[#11161F]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Integridade: {averageCondition}%</span>
            </Badge>

            <Badge
              variant="outline"
              className={`font-mono text-xs px-3 py-1.5 flex items-center gap-2 ${
                isCostCapBreached
                  ? 'border-red-500 text-red-400 bg-[#11161F]'
                  : currentCostCapSpent / COST_CAP_LIMIT > 0.8
                    ? 'border-amber-500 text-amber-400 bg-[#11161F]'
                    : 'border-emerald-500/40 text-emerald-400 bg-[#11161F]'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Teto FIA: {formatCurrency(currentCostCapSpent)}</span>
            </Badge>

            <Badge
              variant="outline"
              className="font-mono text-xs px-3 py-1.5 flex items-center gap-2 border-[#1F2733] bg-[#11161F] text-[#F5F7FA]"
            >
              <Flame className="w-3.5 h-3.5 text-[#E10600]" />
              <span>
                PU #{enginePoolUsed}/4 ({activeEngineWear}% desgaste)
              </span>
            </Badge>
          </div>
        }
      />

      {/* ABAS: VISÃO GERAL / OFICINA VS P&D / ENGENHARIA VS REGULAMENTOS FIA */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'overview' | 'development' | 'regulations')}
        className="relative z-10 space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3 bg-[#090D15]/85 border border-[#1F2733] p-1 h-12 rounded-xl">
          <TabsTrigger
            value="overview"
            className="font-mono text-xs font-bold data-[state=active]:bg-[#161D29] data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center gap-2"
          >
            <Wrench className="w-4 h-4 text-cyan-400" />
            <span>Visão Geral & Oficina</span>
          </TabsTrigger>
          <TabsTrigger
            value="development"
            className="font-mono text-xs font-bold data-[state=active]:bg-[#161D29] data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center gap-2"
          >
            <FlaskConical className="w-4 h-4 text-[#E10600]" />
            <span>P&D do Carro & Engenharia</span>
            {team?.development_projects &&
              team.development_projects.filter((p) => p.status === 'in_progress').length > 0 && (
                <Badge className="ml-1.5 bg-[#E10600] text-white text-[10px] h-4 px-1.5 font-mono">
                  {team.development_projects.filter((p) => p.status === 'in_progress').length}
                </Badge>
              )}
          </TabsTrigger>
          <TabsTrigger
            value="regulations"
            className="font-mono text-xs font-bold data-[state=active]:bg-[#161D29] data-[state=active]:text-white data-[state=active]:shadow-md flex items-center justify-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Regulamentos Técnicos FIA</span>
            {timelineState &&
              regulationTimelineService.getAnnouncedRegulations(timelineState).length > 0 && (
                <Badge className="ml-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] h-4 px-1.5 font-mono">
                  {regulationTimelineService.getAnnouncedRegulations(timelineState).length}
                </Badge>
              )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regulations" className="space-y-6 mt-0">
          {timelineState && (
            <RegulationSection
              timeline={timelineState}
              currentSeasonYear={season?.year ?? 2026}
              team={team || undefined}
              onTimelineChange={(updated) => setTimelineState(updated)}
            />
          )}
        </TabsContent>

        <TabsContent value="development" className="space-y-6 mt-0">
          {team && (
            <CarDevelopmentSection
              team={team}
              currentRound={season?.current_round ?? 1}
              seasonYear={season?.year ?? 2026}
              parts={parts}
              drivers={drivers}
              onRefresh={() => {
                refreshTeamAndSeason()
                loadParts()
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="overview" className="space-y-8 mt-0">
          {/* PAINEL ELEVADO: TETO DE GASTOS (COST CAP) & POOL DE MOTORES */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card Cost Cap */}
            <div className="rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#1F2733]">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600]">
                    TETO DE GASTOS FIA (COST CAP 2026)
                  </span>
                </div>
                <span className="font-num text-xs font-bold text-[#F5F7FA]">
                  {Math.min(100, Math.round((currentCostCapSpent / COST_CAP_LIMIT) * 100))}%
                </span>
              </div>

              <div className="space-y-2 mt-2">
                <ProgressBar
                  value={Math.min(100, Math.round((currentCostCapSpent / COST_CAP_LIMIT) * 100))}
                  size="md"
                />
                <div className="flex items-center justify-between text-xs font-mono text-[#8B95A7]">
                  <span>
                    Gasto em P&D / Reparos:{' '}
                    <strong className="text-white font-num">
                      {formatCurrency(currentCostCapSpent)}
                    </strong>
                  </span>
                  <span>
                    Limite:{' '}
                    <strong className="text-white font-num">
                      {formatCurrency(COST_CAP_LIMIT)}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-[#1F2733]">
                  <span className="text-[#8B95A7]">Margem Restante no Teto:</span>
                  <strong
                    className={`font-num font-bold ${remainingCostCap < 20000000 ? 'text-amber-400' : 'text-emerald-400'}`}
                  >
                    {formatCurrency(remainingCostCap)}
                  </strong>
                </div>
                <p className="text-[10px] text-[#8B95A7] leading-relaxed">
                  Regulamento Financeiro FIA: limite de R$ 215M. Violações ativam investigação com
                  perda de pontos.
                </p>
              </div>
            </div>

            {/* Card Pool de Motores & Desgaste */}
            <div className="rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#1F2733]">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#E10600]" />
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600]">
                    SAÚDE DA UNIDADE DE POTÊNCIA
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`font-mono text-xs ${
                    enginePoolUsed > 4
                      ? 'border-red-500 text-red-400 bg-red-500/10'
                      : 'border-[#1F2733] bg-[#0B0E14] text-[#F5F7FA]'
                  }`}
                >
                  PU #{enginePoolUsed} de 4
                </Badge>
              </div>

              <div className="space-y-3 mt-1 text-xs font-mono">
                <div>
                  <ProgressBar
                    value={Math.max(0, 100 - activeEngineWear)}
                    label="CONDIÇÃO MECÂNICA DA PU"
                    size="md"
                    valueFormatter={(val) =>
                      `${Math.round(val)}% integridade (${activeEngineWear}% uso)`
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#1F2733]">
                  <div>
                    <span className="text-[#8B95A7] block text-[10px]">Cota Sem Penalidade</span>
                    <strong className="text-white font-num">
                      {remainingEnginesInQuota > 0
                        ? `${remainingEnginesInQuota} unidade(s) livre(s)`
                        : 'COTA ESGOTADA!'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8B95A7] block text-[10px]">
                      Próxima Troca Excedente
                    </span>
                    <span
                      className={enginePoolUsed >= 4 ? 'text-red-400 font-bold' : 'text-[#8B95A7]'}
                    >
                      {enginePoolUsed < 4
                        ? 'Sem punição'
                        : enginePoolUsed === 4
                          ? '-10 posições grid'
                          : '-5 posições grid'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#1F2733]">
                  <span className="text-[10px] text-[#8B95A7]">
                    {activeEngineWear >= 60
                      ? 'Alta degradação térmica e risco de quebra.'
                      : 'Unidade em faixa térmica estável.'}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleIntroduceNewEngine}
                    disabled={
                      introducingEngine ||
                      team?.budget! < 15000000 ||
                      currentCostCapSpent + 15000000 > COST_CAP_LIMIT
                    }
                    className="bg-[#0B0E14] hover:bg-[#161D29] text-[#F5F7FA] border border-[#1F2733] font-bold text-xs h-7 px-3 shrink-0"
                  >
                    {introducingEngine ? 'Ativando...' : 'Introduzir Nova PU (R$ 15M)'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* SELETOR DE MODO DE APRESENTAÇÃO DO MONOPOSTO */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 rounded-xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733]">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveCarDisplay('realistic')}
                className={`font-mono text-xs px-3 py-1.5 h-8 rounded-lg transition-all ${
                  activeCarDisplay === 'realistic'
                    ? 'bg-[#E10600] text-white font-bold shadow-[0_0_12px_rgba(225,6,0,0.4)]'
                    : 'text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                <span>Monoposto 2026 (Foto Lateral Oficial)</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveCarDisplay('blueprint')}
                className={`font-mono text-xs px-3 py-1.5 h-8 rounded-lg transition-all ${
                  activeCarDisplay === 'blueprint'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,166,251,0.3)] font-bold'
                    : 'text-[#8B95A7] hover:text-[#F5F7FA] hover:bg-[#161D29]'
                }`}
              >
                <Layers className="w-3.5 h-3.5 mr-1.5" />
                <span>Blueprint Técnico FIA (CAD 2D)</span>
              </Button>
            </div>

            <span className="text-[11px] font-mono text-[#8B95A7] hidden sm:inline px-2">
              {activeCarDisplay === 'realistic'
                ? 'Visual lateral com pintura da equipe, patrocinadores e hotspots'
                : 'Vistas técnica, lateral e superior com cotas milimétricas'}
            </span>
          </div>

          {/* RENDERIZAÇÃO DO CARRO: REALISTA OU BLUEPRINT */}
          {activeCarDisplay === 'realistic' ? (
            <RealisticCarHero
              teamColor={team?.color || '#E10600'}
              teamName={team?.name || 'Sua Escuderia'}
              teamKey={team?.team_key}
              isCustomTeam={isCustomTeam}
              sponsors={sponsors}
              carLevel={overallLevel}
              parts={parts}
              selectedPartId={selectedPartId}
              customCarImage={customCarImageUrl}
              isUploadingImage={isUploadingCarImage}
              onUploadCarImage={handleUploadCarImage}
              onResetCarImage={handleResetCarImage}
              onSelectPart={(id) => setSelectedPartId(id)}
              onOpenBlueprint={() => setActiveCarDisplay('blueprint')}
            />
          ) : (
            <CarBlueprint
              teamColor={team?.color || '#E10600'}
              teamName={team?.name || 'Sua Escuderia'}
              sponsors={sponsors}
              carLevel={overallLevel}
              parts={parts}
              selectedPartId={selectedPartId}
              onSelectPart={(id) => setSelectedPartId(id)}
            />
          )}

          {/* GRID DENSO: CARDS DAS 6 PEÇAS HOMOLOGADAS FIA */}
          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#1F2733]">
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                  COMPONENTES DO MONOPOSTO // ESPECIFICAÇÃO 2026
                </span>
                <h3 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Peças Homologadas & Níveis de P&D ({parts.length}/6)
                </h3>
              </div>
              <span className="text-xs font-mono text-[#8B95A7]">
                Clique em qualquer peça para selecionar e inspecionar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {parts.map((p) => {
                const isSelected = selectedPartId === p.id
                const cond = p.condition ?? 100
                const condInfo = getConditionInfo(cond)
                const upCost = getUpgradeCost(p.level)
                const repCost = f1Service.getPartRepairCost(p)
                const isMax = p.level >= 10

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPartId(p.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-[#161D29] border-cyan-500 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500'
                        : 'bg-[#090D15]/85 backdrop-blur-md border-[#1F2733] hover:border-[#2C3849]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-sm text-[#F5F7FA]">{p.name}</h4>
                            {isSelected && (
                              <Badge className="bg-cyan-500 text-slate-950 text-[9px] font-mono font-bold h-4 px-1.5">
                                Ativa
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-[#8B95A7]">
                            FIA Spec 2026 • Componente #{p.id.slice(-4).toUpperCase()}
                          </span>
                        </div>

                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono font-bold shrink-0 ${condInfo.bg}`}
                        >
                          {cond}%
                        </Badge>
                      </div>

                      {/* Barras de Nível e Condição */}
                      <div className="space-y-2 pt-1 font-mono text-xs">
                        <ProgressBar
                          value={p.level}
                          max={10}
                          label="NÍVEL"
                          size="sm"
                          valueFormatter={(v) => `${v}/10`}
                        />
                        <ProgressBar
                          value={cond}
                          max={100}
                          label="INTEGRIDADE"
                          size="sm"
                          valueFormatter={(v) => `${v}%`}
                        />
                      </div>
                    </div>

                    {/* Rodapé do Card com Valores e Ações Rápidas */}
                    <div className="pt-2 border-t border-[#1F2733] flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-[#8B95A7] text-[10px] block">
                          Upgrade N{p.level + 1}
                        </span>
                        <strong className="text-[#F5F7FA] text-xs">
                          {isMax ? 'Máx FIA' : formatCurrency(upCost)}
                        </strong>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {cond < 100 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRepairPart(p)
                            }}
                            disabled={repairingPartId === p.id}
                            className="h-6 text-[10px] px-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
                          >
                            {repairingPartId === p.id ? 'Revisando...' : 'Oficina'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUpgradePart(p)
                          }}
                          disabled={isMax || upgradingPartId === p.id}
                          className="h-6 text-[10px] px-2 border-[#1F2733] text-cyan-400 hover:bg-cyan-500/20"
                        >
                          {upgradingPartId === p.id ? '...' : isMax ? 'Máx' : '+1 Nível'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* PAINEL DE INSPEÇÃO DA PEÇA SELECIONADA + RESUMO DE PERFORMANCE */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card: Painel de Inspeção da Peça Clicada */}
            <Card className="lg:col-span-2 bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-bl-full pointer-events-none" />

              <CardHeader className="pb-3 border-b border-[#1F2733]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-[#E10600] font-black uppercase tracking-widest block">
                      TELEMETRIA & DIAGNÓSTICO DE OFICINA
                    </span>
                    <CardTitle className="text-xl font-black text-white flex items-center gap-2.5 mt-0.5">
                      <Wrench className="w-5 h-5 text-[#E10600]" />
                      {selectedPart ? selectedPart.name : 'Selecione uma peça'}
                    </CardTitle>
                  </div>

                  {selectedPart && selectedCondInfo && (
                    <Badge variant="outline" className={`font-mono text-xs ${selectedCondInfo.bg}`}>
                      {selectedCondInfo.status}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs text-[#8B95A7] font-mono mt-0.5">
                  Inspecione a fadiga metálica acumulada após as corridas e decida entre desenvolver
                  um novo nível ou revisar a peça na oficina.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-5 space-y-6">
                {selectedPart && selectedCondInfo ? (
                  <>
                    {/* Métricas: Nível + Condição */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Bloco 1: Nível & Potencial Técnico via ProgressBar */}
                      <div className="p-4 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-3">
                        <ProgressBar
                          value={selectedPart.level}
                          max={10}
                          label="NÍVEL HOMOLOGADO FIA"
                          size="md"
                          valueFormatter={(v, m) => `NÍVEL ${v} / ${m}`}
                        />

                        <p className="text-[11px] text-[#8B95A7] leading-relaxed">
                          Contribuição aerodinâmica/mecânica direta: cada nível adiciona{' '}
                          <strong className="text-[#F5F7FA] font-num">+1,0 pt</strong> ao índice
                          geral de competitividade nas 24 etapas.
                        </p>
                      </div>

                      {/* Bloco 2: Condição / Desgaste Físico via ProgressBar */}
                      <div className="p-4 rounded-xl bg-[#11161F] border border-[#1F2733] space-y-3">
                        <ProgressBar
                          value={selectedPart.condition ?? 100}
                          max={100}
                          label="INTEGRIDADE ESTRUTURAL"
                          size="md"
                        />

                        <div className="flex items-start gap-1.5 text-[11px] font-mono">
                          <AlertTriangle
                            className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                              (selectedPart.condition ?? 100) < 60
                                ? 'text-red-400'
                                : 'text-[#8B95A7]'
                            }`}
                          />
                          <span className="text-[#8B95A7] leading-relaxed">
                            {selectedCondInfo.risk}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bloco de Ações: Desenvolver Nova Peça vs Reparar/Revisar */}
                    <div className="p-4 rounded-xl bg-[#080C14]/90 border border-cyan-500/20 space-y-4">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          Ações de Engenharia para {selectedPart.name}
                        </span>
                        <span className="text-[#8B95A7]">
                          Orçamento Disponível:{' '}
                          <strong className="text-emerald-400">
                            {formatCurrency(team?.budget ?? 0)}
                          </strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Ação 1: Desenvolver Nova Peça (Subir Nível) */}
                        <div className="p-3.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-[#F5F7FA]">
                                Desenvolver Nova Peça
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono border-[#1F2733]"
                              >
                                {isSelectedMax ? 'Máx 10' : `Nív.${selectedPart.level + 1}`}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-[#8B95A7] mt-1">
                              Investimento em CFD, túnel de vento e fabricação de nova
                              especificação.
                            </p>
                            <div className="mt-2 text-xs font-mono">
                              <span className="text-[#8B95A7] block text-[10px]">
                                Custo de P&D:
                              </span>
                              <strong className="text-[#F5F7FA] text-sm">
                                {isSelectedMax ? 'Homologado' : formatCurrency(selectedUpgradeCost)}
                              </strong>
                            </div>
                          </div>

                          <Button
                            disabled={isSelectedMax || upgradingPartId === selectedPart.id}
                            onClick={() => handleUpgradePart(selectedPart)}
                            className={`w-full font-semibold text-xs h-9 ${
                              isSelectedMax
                                ? 'bg-[#1F2733] text-[#8B95A7]'
                                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20'
                            }`}
                          >
                            {upgradingPartId === selectedPart.id
                              ? 'Desenvolvendo...'
                              : isSelectedMax
                                ? 'Nível Máximo Homologado'
                                : `Desenvolver (+1 Nível)`}
                          </Button>
                        </div>

                        {/* Ação 2: Reparar / Revisar Peça (Restaurar para 100%) */}
                        <div className="p-3.5 rounded-lg bg-[#080C14]/80 border border-[#1A2333] flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-[#F5F7FA]">
                                Revisar / Reparar Oficina
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-mono ${
                                  (selectedPart.condition ?? 100) >= 100
                                    ? 'border-emerald-500/40 text-emerald-400'
                                    : 'border-amber-500/40 text-amber-400'
                                }`}
                              >
                                {(selectedPart.condition ?? 100) >= 100
                                  ? '100% Ok'
                                  : 'Necessita Oficina'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-[#8B95A7] mt-1">
                              Testes de ultrassom, substituição de fibras de carbono e revisão
                              mecânica.
                            </p>
                            <div className="mt-2 text-xs font-mono">
                              <span className="text-[#8B95A7] block text-[10px]">
                                Custo da Oficina:
                              </span>
                              <strong className="text-emerald-400 text-sm">
                                {(selectedPart.condition ?? 100) >= 100
                                  ? 'Sem Custo (100%)'
                                  : formatCurrency(selectedRepairCost)}
                              </strong>
                            </div>
                          </div>

                          <Button
                            disabled={
                              (selectedPart.condition ?? 100) >= 100 ||
                              repairingPartId === selectedPart.id
                            }
                            onClick={() => handleRepairPart(selectedPart)}
                            className={`w-full font-semibold text-xs h-9 ${
                              (selectedPart.condition ?? 100) >= 100
                                ? 'bg-[#1F2733] text-[#8B95A7]'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                            }`}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            {repairingPartId === selectedPart.id
                              ? 'Revisando na Oficina...'
                              : (selectedPart.condition ?? 100) >= 100
                                ? 'Totalmente Revisada'
                                : 'Reparar para 100%'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-slate-400 font-mono text-xs">
                    Selecione um componente no blueprint para abrir o diagnóstico.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card Resumo: Nível Geral do Carro + Impacto de Desgaste */}
            <Card className="bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] flex flex-col justify-between shadow-xl">
              <CardHeader className="pb-2 border-b border-[#1F2733]">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                  PERFORMANCE GERAL
                </span>
                <CardTitle className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                  <Gauge className="w-5 h-5 text-[#E10600]" />
                  Índice de Competitividade
                </CardTitle>
                <CardDescription className="text-xs text-[#8B95A7] font-mono mt-0.5">
                  Média ponderada do pacote de peças (60%) + potência da UP (40%).
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 pt-4">
                <div className="text-center p-5 rounded-2xl bg-[#0B0E14] border border-[#1F2733] relative overflow-hidden">
                  <div className="text-5xl font-extrabold font-mono text-[#F5F7FA] tracking-tight">
                    {overallLevel}
                    <span className="text-xs text-[#8B95A7] font-normal block mt-1">
                      / 100 Índice de Ritmo
                    </span>
                  </div>
                  <div className="mt-3 w-full bg-[#161D29] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-[#E10600] transition-all duration-500"
                      style={{ width: `${overallLevel}%` }}
                    />
                  </div>

                  {averageCondition < 60 && (
                    <div className="mt-3 p-2 rounded bg-red-950/40 border border-red-500/40 text-[10px] font-mono text-red-300 flex items-center gap-1.5 justify-center">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>Penalidade ativa de ritmo devido a desgaste médio (&lt;60%)</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between text-[#8B95A7] pb-1 border-b border-[#1F2733]">
                    <span>Média das 6 Peças:</span>
                    <strong className="text-[#F5F7FA]">{partsAverage} / 10</strong>
                  </div>
                  <div className="flex justify-between text-[#8B95A7] pb-1 border-b border-[#1F2733]">
                    <span>Integridade Estrutural:</span>
                    <strong
                      className={
                        averageCondition >= 80
                          ? 'text-emerald-400'
                          : averageCondition >= 60
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }
                    >
                      {averageCondition}%
                    </strong>
                  </div>
                  <div className="flex justify-between text-[#8B95A7] pb-1 border-b border-[#1F2733]">
                    <span>UP ({currentEngine.name}):</span>
                    <strong className="text-cyan-400">{currentEngine.power} / 100</strong>
                  </div>
                  <div className="flex justify-between text-[#8B95A7]">
                    <span>Confiabilidade da UP:</span>
                    <strong className="text-emerald-400">{currentEngine.reliability}%</strong>
                  </div>
                </div>

                {/* Quick explanation about wear impact */}
                <div className="p-3 rounded-xl bg-[#090D16] border border-[#1F2733] text-[11px] text-[#8B95A7] space-y-1">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-bold font-mono text-[10px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Impacto de Desgaste nas Corridas</span>
                  </div>
                  <p className="text-[10px] leading-relaxed">
                    Após cada GP, as peças perdem de <strong>8% a 18%</strong> de integridade.
                    Mantenha a média acima de 60% para não perder ritmo e repare peças críticas
                    (&lt;30%) para evitar DNF.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* BLOCO FIXO EXPLICATIVO: REGRAS TÉCNICAS F1 2026 */}
          <div className="relative z-10 rounded-2xl bg-[#090D15]/85 backdrop-blur-md border border-[#1F2733] p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E10600]/10 text-[#E10600] flex items-center justify-center shrink-0 mt-0.5 border border-[#E10600]/30">
                <Info className="w-5 h-5" />
              </div>
              <div className="space-y-3 flex-1">
                <div>
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                    DIRETRIZES TÉCNICAS HOMOLOGADAS
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2 mt-0.5">
                    Novo Regulamento Técnico FIA — Fórmula 1 2026
                    <Badge className="bg-[#E10600] text-white font-mono text-[10px] font-bold">
                      Oficial
                    </Badge>
                  </h2>
                  <p className="text-xs text-[#8B95A7] font-mono mt-0.5">
                    A temporada 2026 introduz a maior revolução na arquitetura veicular e no trem de
                    força da história da F1:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-[#E10600]">
                      <Zap className="w-4 h-4" />
                      <span>Unidade de Potência 50/50</span>
                    </div>
                    <p className="text-[#8B95A7] text-[11px] leading-relaxed">
                      Eliminação do MGU-H. O motor elétrico MGU-K salta para{' '}
                      <strong className="text-[#F5F7FA]">350 kW (~475 cv)</strong>, dividindo a
                      tração de forma igual com o motor V6 Turbo (100% combustível sustentável).
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                      <Layers className="w-4 h-4" />
                      <span>Aerodinâmica Ativa</span>
                    </div>
                    <p className="text-[#8B95A7] text-[11px] leading-relaxed">
                      O DRS foi extinto. As asas dianteira e traseira possuem 2 estados:{' '}
                      <strong className="text-[#F5F7FA]">Z-Mode</strong> (alta sustentação em
                      curvas) e <strong className="text-[#F5F7FA]">X-Mode / Straight Mode</strong>{' '}
                      (baixo arrasto em retas).
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400">
                      <Flame className="w-4 h-4" />
                      <span>Modo Overtake & 768 kg</span>
                    </div>
                    <p className="text-[#8B95A7] text-[11px] leading-relaxed">
                      Quando o carro está a &lt;1s do rival, o piloto aciona o{' '}
                      <strong className="text-[#F5F7FA]">Modo Overtake</strong> com energia extra na
                      bateria para ultrapassagem. O peso mínimo caiu para{' '}
                      <strong className="text-[#F5F7FA]">768 kg</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fornecedores de Unidade de Potência 2026 */}
          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600] block">
                  MERCADO DE FORNECEDORES
                </span>
                <h2 className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                  <Cpu className="w-5 h-5 text-[#00A6FB]" />
                  Fornecedores de Unidade de Potência 2026
                </h2>
              </div>
              <span className="text-xs font-mono text-[#8B95A7]">5 fabricantes homologados</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {ENGINE_SUPPLIERS.map((sup) => {
                const isCurrent = (team?.engine_supplier || 'Mercedes') === sup.name
                return (
                  <div
                    key={sup.name}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      isCurrent
                        ? 'bg-[#161D29] border-cyan-500 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-500'
                        : 'bg-[#090D15]/85 backdrop-blur-md border-[#1F2733] hover:border-[#2C3849]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-[#F5F7FA]">{sup.name}</h3>
                            {isCurrent && (
                              <Badge className="bg-cyan-500 text-slate-950 text-[10px] font-mono font-bold">
                                Atual
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-cyan-400 mt-0.5">
                            {sup.techBadge}
                          </p>
                        </div>
                      </div>

                      <p className="text-[11px] text-[#8B95A7] mt-2 line-clamp-2 leading-relaxed">
                        {sup.description}
                      </p>

                      <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-[#1F2733] text-xs font-mono">
                        <div className="p-1.5 rounded bg-[#0B0E14] border border-[#1F2733]">
                          <span className="text-[#8B95A7] block text-[10px] flex items-center gap-1">
                            <Zap className="w-3 h-3 text-cyan-400" /> Potência
                          </span>
                          <strong className="text-[#F5F7FA] text-sm">{sup.power}/100</strong>
                        </div>
                        <div className="p-1.5 rounded bg-[#0B0E14] border border-[#1F2733]">
                          <span className="text-[#8B95A7] block text-[10px] flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Confiab.
                          </span>
                          <strong className="text-emerald-400 text-sm">{sup.reliability}%</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#1F2733]">
                      <div>
                        <span className="text-[10px] text-[#8B95A7] block font-mono">
                          Custo anual
                        </span>
                        <strong className="text-xs font-mono text-[#F5F7FA]">
                          {formatCurrency(sup.costAnnual)}
                        </strong>
                      </div>

                      {isCurrent ? (
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Equipado
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedSupplier(sup)}
                          className="border-[#1F2733] text-xs h-7 px-3 text-cyan-400 hover:text-white hover:bg-cyan-600/20"
                        >
                          Trocar Fornecedor
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DE CONFIRMAÇÃO: ESTOURO CONSCIENTE DO TETO DE GASTOS (INVESTIGAÇÃO FIA) */}
      <Dialog
        open={costCapBreachDialog.isOpen}
        onOpenChange={(open) =>
          !open && setCostCapBreachDialog((prev) => ({ ...prev, isOpen: false }))
        }
      >
        <DialogContent className="bg-[#090D15]/95 backdrop-blur-md border border-red-500/60 text-[#F5F7FA] sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
              INVESTIGAÇÃO FIA: VIOLAÇÃO DO TETO DE GASTOS
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              O custo desta operação excede o limite orçamentário anual regulamentar de R$ 215M.
              Você pode optar por cancelar ou estourar o teto deliberadamente assumindo as punições
              federativas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 font-mono text-xs">
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#8B95A7]">Ação solicitada:</span>
                <strong className="text-white">{costCapBreachDialog.itemName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B95A7]">Custo da operação:</span>
                <strong className="text-white">{formatCurrency(costCapBreachDialog.cost)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B95A7]">Margem atual no teto:</span>
                <strong className="text-amber-400">{formatCurrency(remainingCostCap)}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-red-500/20">
                <span className="text-red-400 font-bold">Excedente sujeito a punição:</span>
                <strong className="text-red-400 font-black">
                  +{formatCurrency(costCapBreachDialog.overspendAmount)}
                </strong>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#0F172A] border border-amber-500/40 space-y-2">
              <span className="text-amber-400 font-bold flex items-center gap-1.5 text-xs">
                ⚖️ SANÇÕES REGULAMENTARES IMEDIATAS:
              </span>
              <ul className="space-y-1.5 text-[11px] text-[#CBD5E1]">
                <li className="flex items-start gap-1.5">
                  <span className="text-red-400 font-bold">•</span>
                  <span>
                    Dedução de{' '}
                    <strong className="text-red-400">
                      -{costCapBreachDialog.pointsDeduction} pontos
                    </strong>{' '}
                    no Campeonato Mundial de Construtores FIA.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-red-400 font-bold">•</span>
                  <span>
                    Eficácia e tempo de túnel de vento / P&D / oficina reduzidos pelas próximas{' '}
                    <strong className="text-amber-300">
                      {costCapBreachDialog.rdPenaltyRounds} corridas
                    </strong>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-red-400 font-bold">•</span>
                  <span>
                    Comunicado de escândalo financeiro publicado nos feeds mundiais de
                    automobilismo.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-[#1F2733]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCostCapBreachDialog((prev) => ({ ...prev, isOpen: false }))}
              className="border-[#1F2733] hover:bg-[#1A2333] text-xs font-mono"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmCostCapBreach}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs font-mono shadow-[0_0_12px_rgba(225,6,0,0.5)]"
            >
              Estourar o teto e arcar com as consequências
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar Troca de Fornecedor de Motor */}
      <Dialog open={!!selectedSupplier} onOpenChange={(open) => !open && setSelectedSupplier(null)}>
        <DialogContent className="bg-[#090D15]/95 backdrop-blur-md border border-[#1A2333]/90 text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#00A6FB]" />
              Trocar Fornecedor de Unidade de Potência
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              A rescisão e readequação de fixações do chassi possuem um custo de adaptação de
              desenvolvimento.
            </DialogDescription>
          </DialogHeader>

          {selectedSupplier && (
            <div className="space-y-4 py-2 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Novo Fornecedor:</span>
                  <strong className="text-[#F5F7FA] text-sm">{selectedSupplier.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Potência / Confiabilidade:</span>
                  <span className="text-[#00A6FB]">
                    {selectedSupplier.power} pts / {selectedSupplier.reliability}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Custo de Rescisão & Integração:</span>
                  <strong className="text-red-400 text-sm">{formatCurrency(15000000)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Saldo Atual da Equipe:</span>
                  <span className="text-[#F5F7FA]">{formatCurrency(team?.budget ?? 0)}</span>
                </div>
              </div>

              {(team?.budget ?? 0) < 15000000 && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Saldo insuficiente para arcar com a rescisão de R$ 15,00 M.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedSupplier(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSwitchSupplier}
              disabled={isProcessing || (team?.budget ?? 0) < 15000000}
              className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-semibold"
            >
              {isProcessing ? 'Adaptando chassi...' : 'Confirmar Troca de Motor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
