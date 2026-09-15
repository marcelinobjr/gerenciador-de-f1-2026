import React, { useState } from 'react'
import {
  StaffMember,
  StaffRole,
  StaffSpecialty,
  ROLE_DISPLAY_NAMES,
  STAFF_SPECIALTY_LABELS,
  CANONICAL_STAFF_ROLES,
  TeamTechnicalOrganization,
} from '@/types/canonical-staff'
import { technicalOrganizationService } from '@/services/technicalOrganizationService'
import { staffMarketService } from '@/services/staffMarketService'
import { FREE_AGENT_STAFF_POOL } from '@/data/free-agent-staff'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users,
  ShieldAlert,
  Award,
  Zap,
  TrendingUp,
  Briefcase,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ArrowRightLeft,
  DollarSign,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { TeamModel } from '@/types/f1'

interface TechnicalOrganizationSectionProps {
  team: TeamModel
  onOrganizationUpdated?: (updatedOrg: TeamTechnicalOrganization) => void
}

export const TechnicalOrganizationSection: React.FC<TechnicalOrganizationSectionProps> = ({
  team,
  onOrganizationUpdated,
}) => {
  const { toast } = useToast()

  // Estado local da organização da equipe
  const initialOrg = React.useMemo(() => {
    const rawOrg = (team as unknown as { technical_organization?: TeamTechnicalOrganization })
      .technical_organization
    const teamKey = (team.team_key || team.id || 'audi').toLowerCase()
    return technicalOrganizationService.getOrCreateTeamOrganization(teamKey, rawOrg)
  }, [team])

  const [org, setOrg] = useState<TeamTechnicalOrganization>(initialOrg)
  const [activeSubTab, setActiveSubTab] = useState<'organogram' | 'capabilities' | 'market'>(
    'organogram',
  )
  const [selectedStaffForAction, setSelectedStaffForAction] = useState<{
    role: StaffRole
    member: StaffMember | null
  } | null>(null)
  const [negotiationModalCandidate, setNegotiationModalCandidate] = useState<StaffMember | null>(
    null,
  )
  const [offeredSalary, setOfferedSalary] = useState<number>(3000000)
  const [isSigningFuture, setIsSigningFuture] = useState<boolean>(false)

  // Facility Levels da equipe para capabilities
  const facilityLevels = React.useMemo(() => {
    return {
      factory: team.factory_level || 3,
      design_centre: team.design_centre_level || 3,
      cfd: team.cfd_level || 3,
      wind_tunnel: team.wind_tunnel_level || 3,
      manufacturing: team.manufacturing_level || 3,
      simulator: team.simulator_level || 3,
      operations_centre: team.operations_centre_level || 3,
      pitstop_center: team.pitstop_center_level || 3,
      youth_academy: team.youth_academy_level || 3,
    }
  }, [team])

  const capabilities = React.useMemo(() => {
    return technicalOrganizationService.computeCapabilities(facilityLevels, org)
  }, [facilityLevels, org])

  // Descriptors qualitativos de rating
  const getRatingDescriptor = (val: number): { label: string; color: string } => {
    if (val >= 90)
      return { label: 'Elite', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
    if (val >= 80)
      return {
        label: 'Excelente',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      }
    if (val >= 68) return { label: 'Forte', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' }
    if (val >= 50)
      return { label: 'Adequado', color: 'text-slate-300 bg-slate-500/10 border-slate-500/30' }
    return { label: 'Crítico', color: 'text-red-400 bg-red-500/10 border-red-500/30' }
  }

  // Ação de demissão/afastamento de staff
  const handleDepartStaff = (role: StaffRole) => {
    const { updatedOrg, departedStaff, knowledgeLossPercentage } =
      technicalOrganizationService.processStaffDeparture(org, role, 2026, 3)

    setOrg(updatedOrg)
    if (onOrganizationUpdated) onOrganizationUpdated(updatedOrg)
    setSelectedStaffForAction(null)

    toast({
      title: 'Afastamento Confirmado',
      description: `${departedStaff?.name || 'Membro'} deixou o cargo. Perda de retenção de conhecimento estimada em ${knowledgeLossPercentage}%.`,
      variant: 'default',
    })
  }

  // Ação de contratação no mercado
  const handleHireStaff = async () => {
    if (!negotiationModalCandidate || !selectedStaffForAction) return

    const role = selectedStaffForAction.role
    const candidate = negotiationModalCandidate

    const attractiveness = staffMarketService.evaluateStaffAttractiveness(
      candidate,
      team.id || 'audi',
      offeredSalary,
      role,
      82,
    )

    if (!attractiveness.willAccept) {
      toast({
        title: 'Proposta Recusada',
        description: attractiveness.feedback,
        variant: 'destructive',
      })
      return
    }

    const res = await staffMarketService.signContract(
      candidate,
      team.id || 'audi',
      role,
      offeredSalary,
      Math.round(offeredSalary * 0.1),
      isSigningFuture ? 2027 : 2026,
      isSigningFuture ? 2028 : 2027,
      isSigningFuture,
      2026,
      3,
    )

    if (res.success) {
      let nextOrg = org
      if (!isSigningFuture) {
        nextOrg = technicalOrganizationService.processStaffArrival(org, candidate, role, 2026, 3)
        setOrg(nextOrg)
        if (onOrganizationUpdated) onOrganizationUpdated(nextOrg)
      }

      toast({
        title: isSigningFuture ? 'Pré-Contrato Futuro Assinado' : 'Contratação Concluída!',
        description: res.message,
      })

      setNegotiationModalCandidate(null)
      setSelectedStaffForAction(null)
    }
  }

  // Render do Card de Membro de Staff
  const renderStaffCard = (role: StaffRole, isPrimary = false) => {
    const member = org.members[role]
    const interimInfo = org.interimAssignments[role]
    const title = ROLE_DISPLAY_NAMES[role]

    if (!member) {
      return (
        <Card
          key={role}
          className="border-dashed border-red-500/40 bg-red-950/10 p-4 transition-all hover:bg-red-950/20"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase text-red-400 font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> {title} (VAGO)
              </span>
              <p className="text-xs text-muted-foreground">
                {interimInfo
                  ? `Cobertura interina ativa por outro departamento.`
                  : `Nenhum titular nomeado. Penalidade severa de throughput.`}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/50 text-red-300 hover:bg-red-500/20 text-xs"
              onClick={() => {
                setSelectedStaffForAction({ role, member: null })
                setActiveSubTab('market')
              }}
            >
              Preencher Vaga
            </Button>
          </div>
        </Card>
      )
    }

    const eff = technicalOrganizationService.calculateStaffEffectiveness(member, role)
    const ratingDesc = getRatingDescriptor(eff)

    return (
      <Card
        key={role}
        className={`relative overflow-hidden transition-all ${
          isPrimary
            ? 'border-sky-500/40 bg-gradient-to-br from-sky-950/20 via-background to-card'
            : 'border-border/60 hover:border-border'
        }`}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base">{member.countryFlag}</span>
                <h4 className="font-bold text-sm tracking-tight text-foreground">{member.name}</h4>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground">{title}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] font-mono ${ratingDesc.color}`}>
              {ratingDesc.label}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-muted/30 p-2 rounded-lg">
            <div>
              <span className="text-muted-foreground block text-[10px]">Reputação:</span>
              <span className="font-semibold text-foreground">{member.reputation} / 100</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Adaptação:</span>
              <span className="font-semibold text-sky-400">{member.adaptation}%</span>
            </div>
          </div>

          {member.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {member.specialties.map((spec: StaffSpecialty) => (
                <Badge
                  key={spec}
                  variant="secondary"
                  className="text-[9px] py-0 px-1.5 bg-sky-500/10 text-sky-300 border-sky-500/20"
                >
                  {STAFF_SPECIALTY_LABELS[spec] || spec}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
            <span className="text-[11px] text-muted-foreground">
              Morale: <strong className="text-foreground">{member.morale}%</strong>
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedStaffForAction({ role, member })}
            >
              Gerenciar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner de Saúde Organizacional */}
      <div className="rounded-xl border border-border/60 bg-gradient-to-r from-background via-card to-muted/20 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-400" />
              <h3 className="text-lg font-bold tracking-tight text-foreground">
                Diretoria Técnica & Engenharia de Pista
              </h3>
              <Badge className="bg-sky-500/10 text-sky-300 border-sky-500/30 text-xs">
                F1 2026
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Equipe multidisciplinar de 9 funções canônicas. O corpo técnico não concede tempo de
              volta direto; ele potencializa a infraestrutura fabril e refina os processos de P&D,
              estratégia e pista.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-muted/40 p-3 rounded-lg border border-border/40 font-mono text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px]">Saúde Organizacional:</span>
              <strong className="text-base text-emerald-400">
                {org.organizationalHealthScore}%
              </strong>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <span className="text-muted-foreground block text-[10px]">Sinergia / Org Fit:</span>
              <strong className="text-base text-sky-400">{org.collaborationFit}%</strong>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div>
              <span className="text-muted-foreground block text-[10px]">Vacâncias:</span>
              <strong
                className={
                  org.vacancies.length > 0
                    ? 'text-amber-400 text-base'
                    : 'text-muted-foreground text-base'
                }
              >
                {org.vacancies.length}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Navegação Secundária da Seção */}
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as typeof activeSubTab)}>
        <TabsList className="bg-muted/40 border border-border/40">
          <TabsTrigger value="organogram" className="gap-2 text-xs">
            <Users className="h-4 w-4" /> Organograma (9 Cargos)
          </TabsTrigger>
          <TabsTrigger value="capabilities" className="gap-2 text-xs">
            <Activity className="h-4 w-4" /> Capabilities & Gargalos
          </TabsTrigger>
          <TabsTrigger value="market" className="gap-2 text-xs">
            <ArrowRightLeft className="h-4 w-4" /> Mercado de Talentos
          </TabsTrigger>
        </TabsList>

        {/* 1. ABA ORGANOGRAMA */}
        <TabsContent value="organogram" className="space-y-6 pt-4">
          {/* Liderança Técnica Central */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 font-semibold flex items-center gap-1.5">
              <Award className="h-4 w-4 text-sky-400" /> Liderança Executiva & Coordenação
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderStaffCard('TECHNICAL_DIRECTOR', true)}
              {renderStaffCard('SPORTING_DIRECTOR')}
            </div>
          </div>

          {/* Departamentos de P&D e Dinâmica */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 font-semibold flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-amber-400" /> P&D, Aerodinâmica & Veículo
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderStaffCard('HEAD_OF_AERODYNAMICS')}
              {renderStaffCard('CHIEF_DESIGNER')}
              {renderStaffCard('HEAD_OF_VEHICLE_PERFORMANCE')}
            </div>
          </div>

          {/* Operações de Corrida & Race Engineers */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-400" /> Operações de Pista & Engenharia de
              Corrida
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderStaffCard('HEAD_OF_STRATEGY')}
              {renderStaffCard('RACE_ENGINEER_1')}
              {renderStaffCard('RACE_ENGINEER_2')}
            </div>
          </div>

          {/* Desenvolvimento de Jovens */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 font-semibold flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-purple-400" /> Formação de Talentos & Juventude
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderStaffCard('ACADEMY_DIRECTOR')}
            </div>
          </div>
        </TabsContent>

        {/* 2. ABA CAPABILITIES & GARGALOS */}
        <TabsContent value="capabilities" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                { id: 'aeroCorrelation', title: 'Correlação Aerodinâmica', icon: Zap },
                { id: 'designCapacity', title: 'Capacidade de Projeto (Design)', icon: Award },
                { id: 'simulationAccuracy', title: 'Precisão do Simulador', icon: Activity },
                { id: 'developmentThroughput', title: 'Throughput de P&D', icon: TrendingUp },
                {
                  id: 'raceOperationsCapability',
                  title: 'Operações de Corrida & Estratégia',
                  icon: Users,
                },
                {
                  id: 'talentDevelopmentCapacity',
                  title: 'Lapidação de Jovens Pilotos',
                  icon: Briefcase,
                },
              ] as const
            ).map(({ id, title, icon: Icon }) => {
              const explanation = technicalOrganizationService.explainCapability(
                id,
                facilityLevels,
                org,
              )
              const score = capabilities[id]
              const desc = getRatingDescriptor(score)

              return (
                <Card key={id} className="border-border/60">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-sky-400" />
                        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                      </div>
                      <Badge variant="outline" className={`text-xs font-mono ${desc.color}`}>
                        {desc.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground font-mono">
                      <span>Nível Calculado:</span>
                      <strong className="text-foreground">{score} / 100</strong>
                    </div>

                    {explanation.bottleneckDetected?.isBottleneck ? (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                          <AlertTriangle className="h-3.5 w-3.5" /> Fator Limitante:{' '}
                          {explanation.bottleneckDetected.limitingElement}
                        </div>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          {explanation.bottleneckDetected.explanation}
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Staff e infraestrutura em
                        equilíbrio ideal.
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* 3. ABA MERCADO DE TALENTOS */}
        <TabsContent value="market" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-foreground">
                Agentes Livres e Disponíveis no Paddock
              </h4>
              <p className="text-xs text-muted-foreground">
                Profissionais renomados disponíveis para assinatura imediata ou pré-contrato para a
                próxima temporada.
              </p>
            </div>
            {selectedStaffForAction && (
              <Badge variant="outline" className="text-xs font-mono text-sky-400 border-sky-400/40">
                Alvo de Substituição: {ROLE_DISPLAY_NAMES[selectedStaffForAction.role]}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FREE_AGENT_STAFF_POOL.map((candidate) => {
              const fairSalary = staffMarketService.calculateFairMarketSalary(
                candidate,
                selectedStaffForAction?.role || candidate.role,
              )

              return (
                <Card
                  key={candidate.staffId}
                  className="border-border/60 hover:border-border transition-all"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>{candidate.countryFlag}</span>
                          <h5 className="font-bold text-sm text-foreground">{candidate.name}</h5>
                        </div>
                        <span className="text-[11px] text-muted-foreground block">
                          Função Primária: {ROLE_DISPLAY_NAMES[candidate.role]}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono text-amber-400 border-amber-500/30"
                      >
                        Rep: {candidate.reputation}
                      </Badge>
                    </div>

                    <div className="text-xs font-mono bg-muted/40 p-2 rounded space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Técnica:</span>
                        <strong className="text-foreground">
                          {candidate.attributes.technicalAbility}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Liderança:</span>
                        <strong className="text-foreground">
                          {candidate.attributes.leadership}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Salário Médio:</span>
                        <strong className="text-emerald-400">
                          ${(fairSalary / 1000000).toFixed(2)}M/ano
                        </strong>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="w-full text-xs bg-sky-600 hover:bg-sky-500 text-white"
                      onClick={() => {
                        setNegotiationModalCandidate(candidate)
                        setOfferedSalary(fairSalary)
                      }}
                    >
                      Iniciar Negociação
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Gestão Individual de Staff */}
      {selectedStaffForAction && selectedStaffForAction.member && (
        <Dialog
          open={!!selectedStaffForAction}
          onOpenChange={() => setSelectedStaffForAction(null)}
        >
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>{selectedStaffForAction.member.countryFlag}</span>
                {selectedStaffForAction.member.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {ROLE_DISPLAY_NAMES[selectedStaffForAction.role]} — Avaliação de Impacto e Gestão de
                Cargo
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="bg-muted/40 p-3 rounded-lg space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Adaptação Técnica:</span>
                  <span className="font-semibold text-foreground">
                    {selectedStaffForAction.member.adaptation}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nível de Satisfação:</span>
                  <span className="font-semibold text-foreground">
                    {selectedStaffForAction.member.morale}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status de Mercado:</span>
                  <span className="font-semibold text-sky-400 capitalize">
                    {selectedStaffForAction.member.status}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-lg text-red-300 space-y-1">
                <span className="font-semibold flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" /> Cláusula de Rescisão / Saída
                </span>
                <p className="text-[11px] text-red-200/80 leading-relaxed">
                  Afastar este membro abrirá vacância imediata. O cargo será preenchido
                  provisoriamente por um interino, e parte do conhecimento técnico deste domínio
                  será retido na documentação da fábrica.
                </p>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setSelectedStaffForAction(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="text-xs"
                onClick={() => handleDepartStaff(selectedStaffForAction.role)}
              >
                Afastar Profissional
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Negociação Contratual */}
      {negotiationModalCandidate && (
        <Dialog
          open={!!negotiationModalCandidate}
          onOpenChange={() => setNegotiationModalCandidate(null)}
        >
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                Negociação: {negotiationModalCandidate.name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Contratação para o cargo de{' '}
                <strong>
                  {
                    ROLE_DISPLAY_NAMES[
                      selectedStaffForAction?.role || negotiationModalCandidate.role
                    ]
                  }
                </strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="text-muted-foreground block text-[11px] mb-1">
                  Proposta de Salário Anual (USD):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1000000}
                    max={8000000}
                    step={100000}
                    value={offeredSalary}
                    onChange={(e) => setOfferedSalary(Number(e.target.value))}
                    className="w-full accent-sky-500"
                  />
                  <span className="font-mono font-bold text-foreground min-w-[80px] text-right">
                    ${(offeredSalary / 1000000).toFixed(2)}M
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                <div>
                  <span className="font-semibold block text-foreground">
                    Pré-Contrato Futuro (2027)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    O profissional assume somente na próxima temporada.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isSigningFuture}
                  onChange={(e) => setIsSigningFuture(e.target.checked)}
                  className="h-4 w-4 rounded accent-sky-500"
                />
              </div>

              <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-300 text-[11px] space-y-1">
                <strong>Cláusula Financeira:</strong>
                <p className="text-sky-200/90 leading-relaxed">
                  Bônus de assinatura estimado em ${((offeredSalary * 0.1) / 1000000).toFixed(2)}M a
                  ser debitado no Financial Ledger sob classificação permitida.
                </p>
              </div>
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setNegotiationModalCandidate(null)}
              >
                Recuar
              </Button>
              <Button
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={handleHireStaff}
              >
                Submeter Oferta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
