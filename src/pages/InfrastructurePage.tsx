import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { f1Service } from '@/services/f1Service'
import { formatCurrency } from '@/lib/formatters'
import {
  Building2,
  Cpu,
  Gauge,
  GraduationCap,
  Sparkles,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Info,
  Clock,
  Coins,
  TrendingUp,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/PageHeader'
import { AmbientBackground } from '@/components/AmbientBackground'
import {
  FACILITIES_DEFINITIONS,
  FacilityDefinition,
  FACILITY_UPGRADE_COSTS,
} from '@/types/facilities'
import { TeamModel } from '@/types/f1'

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
  const [scoutingAcademyLoading, setScoutingAcademyLoading] = useState(false)

  // Status de instalações do time com fallback resiliente
  const facilityLevels = useMemo(() => {
    return f1Service.getFacilityLevels(team)
  }, [team])

  // Dados financeiros & Teto de Gastos
  const budget = team?.budget ?? 0
  const costCapLimit = f1Service.COST_CAP_LIMIT // R$ 215M
  const costCapSpent = team?.cost_cap_spent ?? 0
  const remainingCostCap = Math.max(0, costCapLimit - costCapSpent)
  const isOverCostCap = costCapSpent > costCapLimit

  // Nível médio da infraestrutura
  const averageLevel = useMemo(() => {
    const sum =
      facilityLevels.factory +
      facilityLevels.simulator +
      facilityLevels.pitstop_center +
      facilityLevels.youth_academy
    return (sum / 4).toFixed(1)
  }, [facilityLevels])

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
    setSelectedFacility(fac)
  }

  const handleConfirmUpgrade = async () => {
    if (!selectedFacility || !team) return
    const currentLvl = facilityLevels[selectedFacility.id]
    const nextLvl = currentLvl + 1
    const cost = FACILITY_UPGRADE_COSTS[nextLvl] || 15000000

    if (budget < cost) {
      toast({
        title: 'Orçamento Insuficiente',
        description: `Você precisa de ${formatCurrency(cost)} para esta expansão. Saldo em caixa: ${formatCurrency(budget)}.`,
        variant: 'destructive',
      })
      return
    }

    try {
      setIsUpgrading(true)
      const res = await f1Service.upgradeFacility(
        team,
        selectedFacility.teamField,
        selectedFacility.name,
        season?.current_round || 1,
        user?.id,
      )

      await refreshTeamAndSeason()

      if (res.overspendAmount > 0) {
        toast({
          title: '⚠️ INVESTIGAÇÃO FIA — TETO ULTRAPASSADO!',
          description: `${selectedFacility.name} evoluída para Nível ${res.newLevel}, porém a operação excedeu o Teto em ${formatCurrency(res.overspendAmount)}. A FIA aplicou penalidades regulamentares!`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Obra de Engenharia Concluída!',
          description: `${selectedFacility.name} expandida com sucesso para o Nível ${res.newLevel}/5!`,
        })
      }
      setSelectedFacility(null)
    } catch (err: any) {
      toast({
        title: 'Erro na Expansão',
        description: err.message || 'Falha ao processar expansão da instalação.',
        variant: 'destructive',
      })
    } finally {
      setIsUpgrading(false)
    }
  }

  // Scouting da Academia de Pilotos (Geração manual/sob demanda de prospectos F2)
  const handleTriggerAcademyScout = async () => {
    if (!team) return
    const academyLvl = facilityLevels.youth_academy
    try {
      setScoutingAcademyLoading(true)
      const newProspects = await f1Service.generateAcademyProspects(
        academyLvl,
        team.id,
        season?.current_round || 1,
      )
      if (newProspects.length > 0) {
        toast({
          title: 'Scouting da Academia Concluído!',
          description: `${newProspects.length} nova(s) promessa(s) contratável(eis) na F2: ${newProspects.map((p) => p.name).join(', ')}. Acesse o Mercado de Pilotos!`,
        })
      } else {
        toast({
          title: 'Scouting Atualizado',
          description:
            'A rede de olheiros vasculhou as categorias de base. Novos talentos surgirão nos próximos ciclos.',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro no Scouting',
        description: err.message || 'Não foi possível atualizar a base de prospectos.',
        variant: 'destructive',
      })
    } finally {
      setScoutingAcademyLoading(false)
    }
  }

  // Ícone por instalação
  const getFacilityIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2':
        return <Building2 className="w-5 h-5 text-[#E10600]" />
      case 'Cpu':
        return <Cpu className="w-5 h-5 text-[#38BDF8]" />
      case 'Gauge':
        return <Gauge className="w-5 h-5 text-[#F59E0B]" />
      case 'GraduationCap':
        return <GraduationCap className="w-5 h-5 text-[#10B981]" />
      default:
        return <Building2 className="w-5 h-5 text-[#E10600]" />
    }
  }

  return (
    <div className="relative min-h-screen bg-[#07090E] text-[#F1F5F9] pb-16">
      <AmbientBackground />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Cabeçalho da Página */}
        <PageHeader
          eyebrow="CENTRO OPERACIONAL F1 2026"
          title="INFRAESTRUTURA & INSTALAÇÕES"
          description={`Sede de Engenharia e Centros Operacionais da ${team?.name || 'Equipe Oficial'} • Temporada ${season?.year || 2026}`}
        />

        {/* Banner de Status Geral: Orçamento, Teto de Gastos e Média da Sede */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Orçamento Operacional */}
          <div className="p-4 rounded-xl bg-[#0D1118]/90 border border-[#1C2433] backdrop-blur-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between text-xs text-[#94A3B8] font-mono uppercase tracking-wider mb-1">
              <span>Orçamento Líquido</span>
              <Coins className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-white">
              {formatCurrency(budget)}
            </div>
            <div className="mt-2 text-[11px] text-[#64748B] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Recurso disponível para obras e expansões
            </div>
          </div>

          {/* Card 2: Teto de Gastos FIA (R$ 215M) */}
          <div className="p-4 rounded-xl bg-[#0D1118]/90 border border-[#1C2433] backdrop-blur-md relative overflow-hidden group">
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

          {/* Card 3: Nível Médio de Instalações */}
          <div className="p-4 rounded-xl bg-[#0D1118]/90 border border-[#1C2433] backdrop-blur-md relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-[#94A3B8] font-mono uppercase tracking-wider mb-1">
              <span>Nível Médio da Sede</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black font-mono tracking-tight text-white flex items-baseline gap-2">
              <span>NÍVEL {averageLevel}</span>
              <span className="text-xs font-mono text-[#64748B]">/ 5.0</span>
            </div>
            <div className="mt-2 text-[11px] text-[#94A3B8] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />4 Complexos operacionais de
              ponta
            </div>
          </div>

          {/* Card 4: Sede & Herança de Ratings */}
          <div className="p-4 rounded-xl bg-[#0D1118]/90 border border-[#1C2433] backdrop-blur-md relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-[#94A3B8] font-mono uppercase tracking-wider mb-1">
              <span>Homologação FIA</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-lg font-black font-mono tracking-wider text-white uppercase truncate">
              {team?.name || 'Europa'} HQ
            </div>
            <div className="mt-2 text-[11px] text-[#94A3B8] leading-tight">
              Regulamentação Técnica 2026 ativa. Upgrades debitam do orçamento operacional e entram
              no cômputo da FIA.
            </div>
          </div>
        </div>

        {/* Grade com as 4 Instalações */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {FACILITIES_DEFINITIONS.map((facility) => {
            const currentLevel = facilityLevels[facility.id]
            const isMax = currentLevel >= 5
            const nextLevel = currentLevel + 1
            const nextCost = isMax ? 0 : FACILITY_UPGRADE_COSTS[nextLevel] || 0
            const canAfford = budget >= nextCost
            const wouldBreachCostCap = !isMax && costCapSpent + nextCost > costCapLimit

            return (
              <Card
                key={facility.id}
                className="bg-[#0C1017]/95 border-[#1B2332] hover:border-[#2C384D] transition-all duration-200 shadow-xl overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* Cabeçalho do Card */}
                  <CardHeader className="pb-3 border-b border-[#161E2C] bg-[#0E131C]/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#141B26] border border-[#222E42] flex items-center justify-center shrink-0 shadow-inner">
                          {getFacilityIcon(facility.iconName)}
                        </div>
                        <div>
                          <CardTitle className="text-base font-black tracking-tight text-white uppercase font-mono flex items-center gap-2">
                            {facility.name}
                          </CardTitle>
                          <CardDescription className="text-xs text-[#8B98AD] font-medium">
                            {facility.subtitle}
                          </CardDescription>
                        </div>
                      </div>

                      {/* Badge do Nível Atual */}
                      <Badge
                        className={`font-mono text-xs font-black uppercase px-2.5 py-1 tracking-wider shrink-0 ${
                          isMax
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-red-600/20 text-red-400 border border-red-600/40'
                        }`}
                      >
                        {isMax ? 'NÍVEL MÁXIMO (5/5)' : `NÍVEL ${currentLevel} / 5`}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 pb-4 space-y-4 text-xs">
                    {/* Descrição contextual */}
                    <p className="text-[#94A3B8] leading-relaxed">{facility.description}</p>

                    {/* Barra de Progresso Visual dos 5 Níveis */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-[#090C12] border border-[#161F2E]">
                      <div className="flex justify-between items-center text-[10px] font-mono text-[#64748B] uppercase tracking-wider">
                        <span>Evolução do Complexo</span>
                        <span className="text-[#CBD5E1] font-bold">
                          {facility.levelLabels[currentLevel - 1]}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 h-2.5">
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
                      <div className="flex justify-between text-[9px] font-mono text-[#475569] pt-0.5">
                        <span>NÍVEL 1</span>
                        <span>NÍVEL 2</span>
                        <span>NÍVEL 3</span>
                        <span>NÍVEL 4</span>
                        <span>NÍVEL 5</span>
                      </div>
                    </div>

                    {/* Resumo de Benefícios */}
                    <div className="p-2.5 rounded-lg bg-[#111722]/80 border border-[#1C2638] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="text-xs text-[#CBD5E1]">
                        <span className="font-bold text-white font-mono uppercase mr-1">
                          BÔNUS ATUAL:
                        </span>
                        {facility.benefitsSummary}
                      </div>
                    </div>

                    {/* Detalhamento de Efeitos no Gameplay */}
                    <div className="space-y-2 pt-1">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                        MECÂNICAS & EFEITOS REAIS NO SAVE
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {facility.effects.map((eff, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg bg-[#0E131C] border border-[#182130] flex flex-col justify-between"
                          >
                            <div>
                              <div className="font-bold text-[#F1F5F9] text-[11px] font-mono uppercase tracking-tight mb-1 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{eff.title}</span>
                              </div>
                              <p className="text-[#8B98AD] text-[11px] leading-tight mb-1.5">
                                {eff.description}
                              </p>
                            </div>
                            <div className="pt-1.5 border-t border-[#161F2E] text-[10px] font-mono text-cyan-400/90 font-medium">
                              {eff.gameplayBonusDescription}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ação especial da Academia: Botão de Scouting */}
                    {facility.id === 'youth_academy' && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTriggerAcademyScout}
                          disabled={scoutingAcademyLoading}
                          className="w-full bg-[#10B981]/10 border-[#10B981]/30 text-emerald-300 hover:bg-[#10B981]/20 font-mono text-xs font-bold tracking-wider uppercase h-8"
                        >
                          <GraduationCap className="w-3.5 h-3.5 mr-2" />
                          {scoutingAcademyLoading
                            ? 'Vasculhando F2 & Karting...'
                            : `Acionar Olheiros da Academia (Nível ${currentLevel})`}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </div>

                {/* Rodapé da Instalação com Ação de Upgrade */}
                <div className="p-4 bg-[#0A0E15] border-t border-[#161E2C] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {isMax ? (
                      <div className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        INSTALAÇÃO EM PADRÃO MÁXIMO
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-mono text-[#8B98AD] uppercase">
                          Próxima Expansão:{' '}
                          <span className="text-white font-bold">Nível {nextLevel}</span>
                        </div>
                        <div className="text-sm font-black font-mono text-white tracking-tight flex items-baseline gap-2">
                          <span>{formatCurrency(nextCost)}</span>
                          {wouldBreachCostCap && (
                            <span className="text-[10px] text-red-400 font-bold font-sans flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> Atenção: Risco de Teto
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isMax && (
                    <Button
                      onClick={() => handleOpenUpgrade(facility)}
                      disabled={!canAfford}
                      className={`font-mono text-xs font-black uppercase tracking-wider h-9 px-4 shrink-0 transition-all ${
                        canAfford
                          ? 'bg-[#E10600] hover:bg-[#C00400] text-white shadow-[0_0_12px_rgba(225,6,0,0.35)]'
                          : 'bg-[#18202E] text-[#64748B] border border-[#222E42] cursor-not-allowed'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4 mr-1.5" />
                      Expandir para Nível {nextLevel}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>

        {/* Seção Explicativa: Como a Infraestrutura afeta a Temporada */}
        <div className="p-5 rounded-xl bg-[#0D121B] border border-[#192231] space-y-3">
          <div className="flex items-center gap-2 text-white font-mono font-bold text-sm uppercase tracking-wide">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>DIRETRIZES TÉCNICAS DE INFRAESTRUTURA & TETO DA FIA (2026)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#94A3B8] leading-relaxed">
            <div className="p-3 rounded-lg bg-[#090C12] border border-[#141B26]">
              <div className="font-bold text-[#E2E8F0] mb-1 font-mono uppercase text-[11px] text-[#E10600]">
                1. Impacto no Teto de R$ 215M
              </div>
              Toda verba alocada em expansão predial consome o orçamento da escuderia e é computada
              sob as regras financeiras da FIA. Ultrapassar o teto submeterá o time a investigação
              oficial e perda de pontos.
            </div>

            <div className="p-3 rounded-lg bg-[#090C12] border border-[#141B26]">
              <div className="font-bold text-[#E2E8F0] mb-1 font-mono uppercase text-[11px] text-cyan-400">
                2. Ganhos Conservadores de Corrida
              </div>
              O Centro de Pit Stop e o Simulador fornecem vantagens graduais e realistas: paradas
              ligeiramente mais consistentes e menor desgaste físico dos pilotos por corrida, sem
              desequilibrar o grid.
            </div>

            <div className="p-3 rounded-lg bg-[#090C12] border border-[#141B26]">
              <div className="font-bold text-[#E2E8F0] mb-1 font-mono uppercase text-[11px] text-emerald-400">
                3. Futuro & Categorias de Base
              </div>
              Uma Academia de nível superior garante um fluxo constante de promessas de 17 a 20 anos
              na F2 para renovar seus contratos e garantir o futuro da sua equipe a longo prazo.
            </div>
          </div>
        </div>
      </div>

      {/* Diálogo Modal de Confirmação de Expansão */}
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
                      Aprovar Obra: {selectedFacility.name}
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
                    <span className="text-[#8B98AD]">Investimento Necessário:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {formatCurrency(
                        FACILITY_UPGRADE_COSTS[facilityLevels[selectedFacility.id] + 1] || 0,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#8B98AD]">Orçamento Atual em Caixa:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {formatCurrency(budget)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-[#161F2E]">
                    <span className="text-[#8B98AD]">Saldo Pós-Expansão:</span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(
                        budget -
                          (FACILITY_UPGRADE_COSTS[facilityLevels[selectedFacility.id] + 1] || 0),
                      )}
                    </span>
                  </div>
                </div>

                {/* Aviso de Teto de Gastos se aplicável */}
                {costCapSpent +
                  (FACILITY_UPGRADE_COSTS[facilityLevels[selectedFacility.id] + 1] || 0) >
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
                    maquinários, sistemas integrados e bônus aplicados imediatamente ao fluxo do
                    save.
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
                  {isUpgrading ? 'Executando Obra...' : 'Confirmar e Iniciar Obras'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
