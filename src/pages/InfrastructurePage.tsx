import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { f1Service } from '@/services/f1Service'
import { infrastructureCapabilityService } from '@/services/infrastructureCapabilityService'
import { formatCurrency } from '@/lib/formatters'
import {
  Building2,
  PencilRuler,
  Cpu,
  Wind,
  Factory,
  Monitor,
  Radio,
  Gauge,
  GraduationCap,
  Sparkles,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Coins,
  TrendingUp,
  Hammer,
  Activity,
  Layers,
  Search,
  Award,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/PageHeader'
import { AmbientBackground } from '@/components/AmbientBackground'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { CANONICAL_FACILITIES_DEFINITIONS } from '@/types/canonical-facilities-data'
import { FacilityDefinition } from '@/types/canonical-facilities'

export default function InfrastructurePage() {
  const { team, season, user, refreshTeamAndSeason } = useAuth()
  const { toast } = useToast()

  // Realtime hook para manter time e temporada sempre sincronizados
  useRealtime(
    'teams',
    () => {
      refreshTeamAndSeason()
    },
    Boolean(team?.id),
  )

  // Diálogo de confirmação para expansão
  const [selectedFacility, setSelectedFacility] = useState<FacilityDefinition | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [filterDomain, setFilterDomain] = useState<'all' | 'pnd' | 'operations' | 'talent'>('all')

  // Auditoria canônica completa através do InfrastructureCapabilityService
  const audit = useMemo(() => {
    const calendarRounds = season?.total_rounds || F1_2026_CALENDAR.length || 24
    return infrastructureCapabilityService.auditInfrastructure(team, calendarRounds)
  }, [team, season?.total_rounds])

  const facilityLevels = audit.facilityLevels
  const capabilities = audit.capabilities
  const currentRound = season?.current_round || 1

  // Projetos de obra ativos
  const activeProjects = useMemo(() => {
    return f1Service.getFacilityProjects(team)
  }, [team])

  // Dados financeiros & Teto de Gastos
  const budget = team?.budget ?? 0
  const costCapLimit = f1Service.COST_CAP_LIMIT // R$ 215M
  const costCapSpent = team?.cost_cap_spent ?? 0
  const remainingCostCap = Math.max(0, costCapLimit - costCapSpent)
  const isOverCostCap = costCapSpent > costCapLimit

  // Handlers
  const handleOpenUpgrade = (fac: FacilityDefinition) => {
    const currentLevel = facilityLevels[fac.id]
    if (currentLevel >= 5) {
      toast({
        title: 'Nível Máximo Atingido',
        description: `${fac.name} já opera no patamar máximo de excelência (Nível 5/5).`,
      })
      return
    }

    if (f1Service.isFacilityUnderConstruction(team, fac.id)) {
      const proj = f1Service.getActiveFacilityProject(team, fac.id)
      toast({
        title: 'Obra Já em Andamento',
        description: `${fac.name} está em expansão para o Nível ${proj?.targetLevel}. Conclusão prevista para a Rodada ${proj?.completionRound}.`,
      })
      return
    }

    setSelectedFacility(fac)
  }

  const handleConfirmUpgrade = async () => {
    if (!selectedFacility || !team) return
    const currentLvl = facilityLevels[selectedFacility.id]
    const nextLvl = currentLvl + 1
    const cost = f1Service.getFacilityUpgradeCost(nextLvl)
    const duration = f1Service.getFacilityUpgradeDuration(nextLvl)

    if (budget < cost) {
      toast({
        title: 'Orçamento Insuficiente',
        description: `Você precisa de ${formatCurrency(cost)} em caixa. Saldo atual: ${formatCurrency(budget)}.`,
        variant: 'destructive',
      })
      return
    }

    try {
      setIsUpgrading(true)
      const res = await f1Service.startFacilityUpgrade(
        team,
        selectedFacility.id,
        selectedFacility.teamField,
        selectedFacility.name,
        currentRound,
        user?.id,
      )

      await refreshTeamAndSeason()

      if (res.overspendAmount > 0) {
        toast({
          title: '⚠️ INVESTIGAÇÃO FIA — TETO ULTRAPASSADO!',
          description: `Obras iniciadas em ${selectedFacility.name}, porém o investimento excedeu o Teto em ${formatCurrency(res.overspendAmount)}. A FIA aplicou penalidades regulamentares!`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Canteiro de Obras Instalado!',
          description: `Expansão de ${selectedFacility.name} para Nível ${res.targetLevel} em andamento. Entrega prevista: Rodada ${res.completionRound} (${duration} rodadas).`,
        })
      }
      setSelectedFacility(null)
    } catch (err: any) {
      toast({
        title: 'Erro na Expansão',
        description: err.message || 'Falha ao iniciar obras da instalação.',
        variant: 'destructive',
      })
    } finally {
      setIsUpgrading(false)
    }
  }

  // Ícones canônicos
  const getFacilityIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2':
        return <Building2 className="w-5 h-5 text-[#E10600]" />
      case 'PencilRuler':
        return <PencilRuler className="w-5 h-5 text-[#8B5CF6]" />
      case 'Cpu':
        return <Cpu className="w-5 h-5 text-[#06B6D4]" />
      case 'Wind':
        return <Wind className="w-5 h-5 text-[#3B82F6]" />
      case 'Factory':
        return <Factory className="w-5 h-5 text-[#F97316]" />
      case 'Monitor':
        return <Monitor className="w-5 h-5 text-[#38BDF8]" />
      case 'Radio':
        return <Radio className="w-5 h-5 text-[#EC4899]" />
      case 'Gauge':
        return <Gauge className="w-5 h-5 text-[#F59E0B]" />
      case 'GraduationCap':
        return <GraduationCap className="w-5 h-5 text-[#10B981]" />
      default:
        return <Building2 className="w-5 h-5 text-[#E10600]" />
    }
  }

  // Filtragem de instalações por domínio
  const displayedFacilities = useMemo(() => {
    return CANONICAL_FACILITIES_DEFINITIONS.filter((fac) => {
      if (filterDomain === 'pnd') {
        return ['factory', 'design_centre', 'cfd', 'wind_tunnel', 'manufacturing'].includes(fac.id)
      }
      if (filterDomain === 'operations') {
        return ['factory', 'simulator', 'operations_centre', 'pitstop_center'].includes(fac.id)
      }
      if (filterDomain === 'talent') {
        return ['youth_academy', 'simulator', 'factory'].includes(fac.id)
      }
      return true
    })
  }, [filterDomain])

  return (
    <div className="relative min-h-screen bg-[#07090E] text-[#F1F5F9] pb-16">
      <AmbientBackground />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Cabeçalho da Página */}
        <PageHeader
          eyebrow="CAMPUS TECNOLÓGICO & INFRAESTRUTURA F1 2026"
          title="INSTALAÇÕES TÉCNICAS & ORGANIZACIONAIS"
          description={`Centro Integrado de Engenharia, Operações e Desenvolvimento de Talentos da ${team?.name || 'Equipe Oficial'} • Temporada ${season?.year || 2026}`}
        />

        {/* Banner de Status Geral: Orçamento, Teto de Gastos, Nível Médio e OPEX */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Orçamento Operacional */}
          <div className="p-4 rounded-xl bg-[#0D1118]/90 border border-[#1C2433] backdrop-blur-md relative overflow-hidden group shadow-lg">
            <div className="flex items-center justify-between text-xs text-[#94A3B8] font-mono uppercase tracking-wider mb-1">
              <span>Orçamento Líquido</span>
              <Coins className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-white">
              {formatCurrency(budget)}
            </div>
            <div className="mt-2 text-[11px] text-[#64748B] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Recurso CAPEX disponível para expansão
            </div>
          </div>

          {/* Card 2: Teto de Gastos FIA (R$ 215M) */}
          <div className="p-4 rounded-xl bg-[#0D1118]/90 border border-[#1C2433] backdrop-blur-md relative overflow-hidden group shadow-lg">
            <div className="flex items-center justify-between text-xs text-[#94A3B8] font-mono uppercase tracking-wider mb-1">
              <span>Teto Financeiro FIA</span>
              <ShieldAlert
                className={`w-4 h-4 ${isOverCostCap ? 'text-red-500 animate-pulse' : 'text-amber-400'}`}
              />
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-white">
              {formatCurrency(costCapSpent)}{' '}
              <span className="text-xs font-normal text-[#64748B]">
                / {formatCurrency(costCapLimit)}
              </span>
            </div>
            <div className="mt-2 w-full bg-[#182130] h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isOverCostCap ? 'bg-red-500' : 'bg-gradient-to-r from-cyan-500 to-amber-500'
                }`}
                style={{
                  width: `${Math.min(100, (costCapSpent / costCapLimit) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-1.5 text-[10px] text-[#94A3B8] flex justify-between font-mono">
              <span>Gasto: {((costCapSpent / costCapLimit) * 100).toFixed(1)}%</span>
              <span className={isOverCostCap ? 'text-red-400 font-bold' : 'text-[#64748B]'}>
                {isOverCostCap
                  ? `Estouro: ${formatCurrency(costCapSpent - costCapLimit)}`
                  : `Margem: ${formatCurrency(remainingCostCap)}`}
              </span>
            </div>
          </div>

          {/* Card 3: Nível Médio das 9 Instalações */}
          <div className="p-4 rounded-xl bg-[#0D1118]/90 border border-[#1C2433] backdrop-blur-md relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between text-xs text-[#94A3B8] font-mono uppercase tracking-wider mb-1">
              <span>Média Geral das 9 Instalações</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-white flex items-baseline gap-2">
              <span>NÍVEL {audit.averageLevel}</span>
              <span className="text-xs font-mono text-[#64748B]">/ 5.0</span>
            </div>
            <div className="mt-2 text-[11px] text-[#94A3B8] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />9 Departamentos canônicos
              operando
            </div>
          </div>

          {/* Card 4: OPEX Recorrente */}
          <div className="p-4 rounded-xl bg-[#0D1118]/90 border border-[#1C2433] backdrop-blur-md relative overflow-hidden shadow-lg">
            <div className="flex items-center justify-between text-xs text-[#94A3B8] font-mono uppercase tracking-wider mb-1">
              <span>Custo Operacional (OPEX)</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-black font-mono tracking-tight text-white">
              {formatCurrency(audit.totalAnnualOpex)}/ano
            </div>
            <div className="mt-2 text-[11px] text-[#8B98AD] font-mono flex items-center justify-between">
              <span>Manutenção por Rodada:</span>
              <span className="text-amber-400 font-bold">{formatCurrency(audit.roundOpex)}</span>
            </div>
          </div>
        </div>

        {/* SEÇÃO DE AUDITORIA & TELEMETRIA DE INFRAESTRUTURA (Requisito 36) */}
        <div className="p-4 rounded-xl bg-[#0B0F17]/90 border border-[#1E293B] shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1A2538] pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-black font-mono uppercase tracking-wider text-white">
                Auditoria de Capacidade Técnica Derivada (Infraestrutura ≠ Performance Direta)
              </h3>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono text-cyan-400 border-cyan-500/30 w-fit"
            >
              Rodada {currentRound}/{season?.total_rounds || F1_2026_CALENDAR.length || 24}
            </Badge>
          </div>

          {/* Grid de Capabilities Canônicas Derivadas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="p-2.5 rounded-lg bg-[#0E141F] border border-[#172233]">
              <span className="text-[10px] font-mono text-[#8B98AD] block uppercase">
                Design Capacity
              </span>
              <div className="text-base font-black font-mono text-white mt-0.5">
                {capabilities.designCapacity}
                <span className="text-xs font-normal text-[#64748B]">/100</span>
              </div>
              <span className="text-[9px] text-purple-400 font-mono">P&D / Conceitos</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0E141F] border border-[#172233]">
              <span className="text-[10px] font-mono text-[#8B98AD] block uppercase">
                Simulation CFD
              </span>
              <div className="text-base font-black font-mono text-cyan-400 mt-0.5">
                {capabilities.simulationAccuracy}
                <span className="text-xs font-normal text-[#64748B]">/100</span>
              </div>
              <span className="text-[9px] text-[#8B98AD] font-mono">Precisão Virtual</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0E141F] border border-[#172233]">
              <span className="text-[10px] font-mono text-[#8B98AD] block uppercase">
                Aero Correlation
              </span>
              <div className="text-base font-black font-mono text-blue-400 mt-0.5">
                {capabilities.aeroCorrelation}
                <span className="text-xs font-normal text-[#64748B]">/100</span>
              </div>
              <span className="text-[9px] text-[#8B98AD] font-mono">Túnel vs Pista</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0E141F] border border-[#172233]">
              <span className="text-[10px] font-mono text-[#8B98AD] block uppercase">
                Manufacturing
              </span>
              <div className="text-base font-black font-mono text-orange-400 mt-0.5">
                {capabilities.manufacturingCapacity}
                <span className="text-xs font-normal text-[#64748B]">/100</span>
              </div>
              <span className="text-[9px] text-[#8B98AD] font-mono">Design -&gt; Part</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0E141F] border border-[#172233]">
              <span className="text-[10px] font-mono text-[#8B98AD] block uppercase">
                Race Operations
              </span>
              <div className="text-base font-black font-mono text-pink-400 mt-0.5">
                {capabilities.raceOperationsCapability}
                <span className="text-xs font-normal text-[#64748B]">/100</span>
              </div>
              <span className="text-[9px] text-[#8B98AD] font-mono">Pit Wall Remoto</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#0E141F] border border-[#172233]">
              <span className="text-[10px] font-mono text-[#8B98AD] block uppercase">
                Talent Dev & Scout
              </span>
              <div className="text-base font-black font-mono text-emerald-400 mt-0.5">
                {capabilities.talentDevelopmentCapacity}
                <span className="text-xs font-normal text-[#64748B]">/100</span>
              </div>
              <span className="text-[9px] text-[#8B98AD] font-mono">Academia / 4C</span>
            </div>
          </div>

          {/* Diagnóstico de Gargalos e Sinergias */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Gargalos Ativos */}
            <div className="p-3 rounded-lg bg-[#0E131C] border border-[#222E42] text-xs">
              <div className="flex items-center gap-2 mb-1.5 font-mono text-amber-400 font-bold uppercase text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Gargalos Estruturais Identificados:</span>
              </div>
              {audit.bottlenecks.length > 0 ? (
                <div className="space-y-2">
                  {audit.bottlenecks.map((b, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-[#CBD5E1] bg-[#0A0D14] p-2 rounded border border-[#1C2738]"
                    >
                      <strong className="text-red-400 font-mono block">
                        {b.title} ({b.penaltyPercent > 0 ? `-${b.penaltyPercent}%` : ''})
                      </strong>
                      {b.description}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[#8B98AD] text-[11px]">
                  Nenhum gargalo severo detectado. Instalações operam em equilíbrio relativo
                  harmonioso.
                </div>
              )}
            </div>

            {/* Sinergias Ativas e Modificadores do Manager */}
            <div className="p-3 rounded-lg bg-[#0E131C] border border-[#222E42] text-xs space-y-2">
              <div className="flex items-center gap-2 font-mono text-emerald-400 font-bold uppercase text-[11px]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sinergias & Influência do Team Principal:</span>
              </div>

              {audit.synergies.length > 0 ? (
                <div className="space-y-1">
                  {audit.synergies.map((s, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-[#CBD5E1] bg-[#0A0D14] p-1.5 rounded border border-[#1C2738]"
                    >
                      <strong className="text-emerald-300 font-mono">
                        +{s.bonusPercent}% {s.title}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[#8B98AD] text-[11px]">
                  Sem sinergias avançadas ativas. Alcance Nível 4+ em instalações correlatas para
                  desbloquear bônus integrados.
                </div>
              )}

              <div className="pt-2 border-t border-[#182130] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#8B98AD]">
                <span>
                  Manager Tech:{' '}
                  <strong
                    className={
                      audit.managerTechnicalModifier >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {(audit.managerTechnicalModifier * 100).toFixed(1)}%
                  </strong>
                </span>
                <span>
                  Manager Talent:{' '}
                  <strong
                    className={
                      audit.managerTalentModifier >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {(audit.managerTalentModifier * 100).toFixed(1)}%
                  </strong>
                </span>
                <span>
                  Diminishing Returns: <strong className="text-cyan-400">Ativo</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PROJETOS EM ANDAMENTO NO CANTEIRO DE OBRAS (Persistência no Save) */}
        {activeProjects.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-mono font-bold text-xs uppercase tracking-wider">
              <Hammer className="w-4 h-4 animate-bounce" />
              <span>Obras de Infraestrutura em Andamento ({activeProjects.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeProjects.map((p, idx) => {
                const roundsRemaining = Math.max(0, p.completionRound - currentRound)
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-[#0C1017] border border-amber-500/30 space-y-2 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-white uppercase font-bold">
                        {p.facilityId.replace('_', ' ')}
                      </strong>
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px]">
                        Nível {p.fromLevel} → {p.targetLevel}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-[#8B98AD]">
                      Conclusão prevista:{' '}
                      <span className="text-cyan-400 font-bold">Rodada {p.completionRound}</span>{' '}
                      (faltam {roundsRemaining} rodadas)
                    </div>
                    <div className="w-full bg-[#182130] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(10, ((currentRound - p.startedAtRound) / Math.max(1, p.completionRound - p.startedAtRound)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* FILTRO DE DOMÍNIOS DAS INSTALAÇÕES */}
        <div className="flex items-center justify-between border-b border-[#1A2538] pb-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Instalações da Sede ({displayedFacilities.length} de 9)
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={filterDomain === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterDomain('all')}
              className={`text-xs h-7 px-2.5 font-mono ${filterDomain === 'all' ? 'bg-cyan-600 text-white' : 'text-[#8B98AD]'}`}
            >
              Todas (9)
            </Button>
            <Button
              variant={filterDomain === 'pnd' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterDomain('pnd')}
              className={`text-xs h-7 px-2.5 font-mono ${filterDomain === 'pnd' ? 'bg-purple-600 text-white' : 'text-[#8B98AD]'}`}
            >
              P&D & Manufatura
            </Button>
            <Button
              variant={filterDomain === 'operations' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterDomain('operations')}
              className={`text-xs h-7 px-2.5 font-mono ${filterDomain === 'operations' ? 'bg-blue-600 text-white' : 'text-[#8B98AD]'}`}
            >
              Operações de Pista
            </Button>
            <Button
              variant={filterDomain === 'talent' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterDomain('talent')}
              className={`text-xs h-7 px-2.5 font-mono ${filterDomain === 'talent' ? 'bg-emerald-600 text-white' : 'text-[#8B98AD]'}`}
            >
              Academia / Talentos
            </Button>
          </div>
        </div>

        {/* GRADE COM AS INSTALAÇÕES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {displayedFacilities.map((facility) => {
            const currentLevel = facilityLevels[facility.id]
            const isMax = currentLevel >= 5
            const nextLevel = currentLevel + 1
            const nextCost = isMax ? 0 : f1Service.getFacilityUpgradeCost(nextLevel)
            const duration = isMax ? 0 : f1Service.getFacilityUpgradeDuration(nextLevel)
            const canAfford = budget >= nextCost
            const wouldBreachCostCap = !isMax && costCapSpent + nextCost > costCapLimit
            const isUnderConstruction = f1Service.isFacilityUnderConstruction(team, facility.id)
            const activeProject = f1Service.getActiveFacilityProject(team, facility.id)

            return (
              <Card
                key={facility.id}
                className="bg-[#0C1017]/95 border-[#1B2332] hover:border-[#2C384D] transition-all duration-200 shadow-xl overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* Cabeçalho do Card */}
                  <CardHeader className="pb-3 border-b border-[#161E2C] bg-[#0E131C]/60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#141B26] border border-[#222E42] flex items-center justify-center shrink-0 shadow-inner">
                          {getFacilityIcon(facility.iconName)}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-black tracking-tight text-white uppercase font-mono truncate">
                            {facility.shortName}
                          </CardTitle>
                          <CardDescription className="text-[11px] text-[#8B98AD] truncate">
                            {facility.subtitle}
                          </CardDescription>
                        </div>
                      </div>

                      {/* Badge de Status / Nível */}
                      {isUnderConstruction ? (
                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono shrink-0">
                          OBRA R{activeProject?.completionRound}
                        </Badge>
                      ) : (
                        <Badge
                          className={`font-mono text-[10px] font-black uppercase px-2 py-0.5 tracking-wider shrink-0 ${
                            isMax
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-red-600/20 text-red-400 border border-red-600/40'
                          }`}
                        >
                          {isMax ? 'NÍVEL 5 (MAX)' : `NÍVEL ${currentLevel} / 5`}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-3 pb-3 space-y-3 text-xs">
                    {/* Descrição resumida */}
                    <p className="text-[#94A3B8] text-[11px] leading-relaxed line-clamp-2">
                      {facility.description}
                    </p>

                    {/* Barra de Progresso Visual dos 5 Níveis */}
                    <div className="space-y-1 p-2 rounded-lg bg-[#090C12] border border-[#161F2E]">
                      <div className="flex justify-between items-center text-[9px] font-mono text-[#64748B] uppercase">
                        <span>Padrão Atual</span>
                        <span className="text-[#CBD5E1] font-bold truncate max-w-[170px]">
                          {facility.levelLabels[currentLevel - 1].split('—')[1] ||
                            facility.levelLabels[currentLevel - 1]}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1 h-2">
                        {[1, 2, 3, 4, 5].map((lvl) => {
                          const isDone = lvl <= currentLevel
                          const isCurrent = lvl === currentLevel
                          return (
                            <div
                              key={lvl}
                              className={`rounded-sm transition-all duration-300 ${
                                isDone
                                  ? isCurrent
                                    ? 'bg-[#E10600] shadow-[0_0_8px_rgba(225,6,0,0.6)]'
                                    : 'bg-[#991B1B]'
                                  : 'bg-[#18202E]'
                              }`}
                              title={`Nível ${lvl}: ${facility.levelLabels[lvl - 1]}`}
                            />
                          )
                        })}
                      </div>
                    </div>

                    {/* Capability Principal Derivada */}
                    <div className="p-2 rounded-lg bg-[#111722]/80 border border-[#1C2638] flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono text-[#8B98AD] uppercase text-[10px]">
                        Capacidade Central:
                      </span>
                      <span className="font-bold text-white font-mono">
                        {facility.primaryCapabilitiesText}
                      </span>
                    </div>

                    {/* Detalhamento de Efeitos Funcionais */}
                    <div className="space-y-1.5 pt-0.5">
                      {facility.effects.slice(0, 2).map((eff, i) => (
                        <div
                          key={i}
                          className="p-2 rounded bg-[#0E131C] border border-[#182130] flex items-start gap-1.5 text-[10px]"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-bold text-[#F1F5F9] font-mono block truncate">
                              {eff.title}
                            </span>
                            <span className="text-[#8B98AD] leading-tight block">
                              {eff.gameplayBonusDescription}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Destaque da Academia (Requisito 35) */}
                    {facility.id === 'youth_academy' && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-[10px] space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-300 font-mono font-bold uppercase">
                          <GraduationCap className="w-3.5 h-3.5" />
                          <span>Programa de Base (Preparação 4C)</span>
                        </div>
                        <p className="text-[#94A3B8] leading-tight">
                          Sustenta scouting de talentos, precisão na avaliação de potencial oculto e
                          retenção no programa de juniores.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </div>

                {/* Rodapé da Instalação com Ação de Upgrade / Canteiro de Obras */}
                <div className="p-3 bg-[#0A0E15] border-t border-[#161E2C] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {isMax ? (
                      <div className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        PADRÃO MÁXIMO
                      </div>
                    ) : isUnderConstruction ? (
                      <div className="space-y-0.5">
                        <div className="text-[9px] font-mono text-amber-400 uppercase font-bold flex items-center gap-1">
                          <Hammer className="w-3 h-3" /> EM OBRAS
                        </div>
                        <div className="text-[10px] font-mono text-[#8B98AD]">
                          Entrega: Rodada {activeProject?.completionRound}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-[9px] font-mono text-[#8B98AD] uppercase">
                          Nível {nextLevel} • {duration} rodadas
                        </div>
                        <div className="text-xs font-black font-mono text-white tracking-tight flex items-baseline gap-1.5">
                          <span>{formatCurrency(nextCost)}</span>
                          {wouldBreachCostCap && (
                            <span className="text-[9px] text-red-400 font-bold font-sans flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Teto
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isMax && !isUnderConstruction && (
                    <Button
                      onClick={() => handleOpenUpgrade(facility)}
                      disabled={!canAfford}
                      className={`font-mono text-[10px] font-black uppercase tracking-wider h-8 px-3 shrink-0 transition-all ${
                        canAfford
                          ? 'bg-[#E10600] hover:bg-[#C00400] text-white shadow-[0_0_8px_rgba(225,6,0,0.35)]'
                          : 'bg-[#18202E] text-[#64748B] border border-[#222E42] cursor-not-allowed'
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                      Expandir
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>

        {/* DIRETRIZES TÉCNICAS E REGULAMENTO FIA */}
        <div className="p-4 rounded-xl bg-[#0D121B] border border-[#192231] space-y-2.5">
          <div className="flex items-center gap-2 text-white font-mono font-bold text-xs uppercase tracking-wide">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>
              REGRA DE OURO: INFRAESTRUTURA DETERMINA CAPACIDADE E PRECISÃO, NÃO VELOCIDADE DIRETA
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-[#94A3B8] leading-relaxed">
            <div className="p-2.5 rounded-lg bg-[#090C12] border border-[#141B26]">
              <div className="font-bold text-[#E2E8F0] mb-0.5 font-mono uppercase text-[10px] text-[#E10600]">
                1. Retornos Decrescentes
              </div>
              A evolução 1→2 produz ganho relativo maior que 4→5. O Nível 5 segue como estado da
              arte, mas sem desequilibrar o ecossistema da categoria.
            </div>

            <div className="p-2.5 rounded-lg bg-[#090C12] border border-[#141B26]">
              <div className="font-bold text-[#E2E8F0] mb-0.5 font-mono uppercase text-[10px] text-cyan-400">
                2. Gargalos e Elo Fraco
              </div>
              Não basta ter CFD 5 se o Túnel de Vento for 1, ou Design 5 se a Manufatura for 1. O
              elo defasado penaliza a correlação física e a capacidade industrial.
            </div>

            <div className="p-2.5 rounded-lg bg-[#090C12] border border-[#141B26]">
              <div className="font-bold text-[#E2E8F0] mb-0.5 font-mono uppercase text-[10px] text-emerald-400">
                3. Obras no Tempo da Carreira
              </div>
              Upgrades não são instantâneos: levam de 2 a 5 rodadas da temporada. O efeito é
              homologado apenas quando a obra for concluída no calendário.
            </div>
          </div>
        </div>
      </div>

      {/* DIÁLOGO MODAL DE CONFIRMAÇÃO DE EXPANSÃO */}
      <Dialog
        open={!!selectedFacility}
        onOpenChange={(open) => {
          if (!open) setSelectedFacility(null)
        }}
      >
        <DialogContent className="bg-[#0C1017] border-[#1E293B] text-[#F1F5F9] max-w-lg">
          {selectedFacility && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-lg bg-[#141B26] border border-[#222E42] flex items-center justify-center">
                    {getFacilityIcon(selectedFacility.iconName)}
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-white font-mono uppercase tracking-tight">
                      Aprovar Canteiro de Obras: {selectedFacility.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-[#8B98AD]">
                      Evolução de infraestrutura para o{' '}
                      <strong className="text-white">
                        Nível {facilityLevels[selectedFacility.id] + 1} de 5
                      </strong>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                {/* Comparativo de Custo e Orçamento */}
                <div className="p-3 rounded-lg bg-[#090C12] border border-[#182130] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[#8B98AD]">Investimento CAPEX:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {formatCurrency(
                        f1Service.getFacilityUpgradeCost(facilityLevels[selectedFacility.id] + 1),
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#8B98AD]">Prazo de Construção:</span>
                    <span className="font-mono font-bold text-cyan-400">
                      {f1Service.getFacilityUpgradeDuration(
                        facilityLevels[selectedFacility.id] + 1,
                      )}{' '}
                      Rodadas (Entrega: Rodada{' '}
                      {currentRound +
                        f1Service.getFacilityUpgradeDuration(
                          facilityLevels[selectedFacility.id] + 1,
                        )}
                      )
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#8B98AD]">Orçamento Atual em Caixa:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {formatCurrency(budget)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-[#161F2E]">
                    <span className="text-[#8B98AD]">Saldo Pós-Investimento:</span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(
                        budget -
                          f1Service.getFacilityUpgradeCost(facilityLevels[selectedFacility.id] + 1),
                      )}
                    </span>
                  </div>
                </div>

                {/* Aviso de Teto de Gastos se aplicável */}
                {costCapSpent +
                  f1Service.getFacilityUpgradeCost(facilityLevels[selectedFacility.id] + 1) >
                  costCapLimit && (
                  <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-red-300 font-mono uppercase">
                        Alerta de Violação do Teto de Gastos FIA!
                      </strong>
                      Esta expansão fará sua equipe ultrapassar o limite de{' '}
                      {formatCurrency(costCapLimit)}. A FIA abrirá processo disciplinar com perda de
                      pontos de construtores e multa.
                    </div>
                  </div>
                )}

                {/* Benefícios que serão ativados */}
                <div className="p-3 rounded-lg bg-[#111722] border border-[#1C2638] space-y-1.5">
                  <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                    Ganhos Operacionais Deste Nível:
                  </div>
                  <p className="text-[#CBD5E1] text-xs">
                    {selectedFacility.levelLabels[facilityLevels[selectedFacility.id]]}: novos
                    maquinários e sistemas integrados elevam as capabilities derivadas sem alterar
                    velocidade do carro diretamente.
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#161E2C]">
                <Button
                  variant="outline"
                  onClick={() => setSelectedFacility(null)}
                  disabled={isUpgrading}
                  className="bg-[#141B26] border-[#222E42] text-[#94A3B8] hover:text-white font-mono text-xs uppercase"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmUpgrade}
                  disabled={isUpgrading}
                  className="bg-[#E10600] hover:bg-[#C00400] text-white font-mono text-xs font-black uppercase tracking-wider"
                >
                  {isUpgrading ? 'Instalando Canteiro...' : 'Confirmar e Iniciar Obras'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
