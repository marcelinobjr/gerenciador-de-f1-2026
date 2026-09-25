import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DriverPoster } from '@/components/DriverPoster'
import { getCountryFlag } from '@/lib/country-flags'
import { checkEligibility, getOverallRating, getDriverCareerStats } from '@/lib/mbj-drivers-data'
import { canonicalHomologationAdapter } from '@/lib/canonical-adapters'
import pb from '@/lib/pocketbase/client'
import {
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Activity,
  CloudRain,
  Shield,
  DollarSign,
  UserPlus,
  Briefcase,
  Trophy,
  Award,
  Lock,
  Eye,
  Flame,
  Target,
  Gauge,
  Heart,
  Smile,
  Compass,
  Sparkles,
  Brain,
  Handshake,
  Clock,
  HelpCircle,
  TrendingUp,
  History,
} from 'lucide-react'
import type { UnifiedDriverItem } from '@/pages/DriversPage'
import { driverRelationshipService } from '@/services/driverRelationshipService'
import {
  getDriverPersonalityTraits,
  getPersonalityDescriptors,
  formatQualitativeState,
} from '@/lib/driver-psychology-utils'

export interface PilotProfileDialogProps {
  pilot: UnifiedDriverItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenContractModal: (pilot: UnifiedDriverItem) => void
  currentRound?: number
  onPromoteToStarter?: (pilot: UnifiedDriverItem) => void
  onRelegateToReserve?: (pilot: UnifiedDriverItem) => void
  onDismissDriver?: (pilot: UnifiedDriverItem) => void
  canPromoteToStarter?: boolean
  canRelegateToReserve?: boolean
}

// Helper para formatar em moeda US$
export function formatUsdCurrency(value: number, format: 'compact' | 'full' = 'compact'): string {
  if (format === 'compact') {
    const millions = (value / 1_000_000).toFixed(1).replace('.', ',')
    return `US$ ${millions} M/ano`
  }
  const formatted = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  }).format(value)
  return `US$ ${formatted}/ano`
}

// Determina biografia sintética de carreira baseada na trajetória do piloto
function getDriverBiography(pilot: UnifiedDriverItem): string {
  const catNames: Record<string, string> = {
    f1: 'Fórmula 1',
    f2: 'Fórmula 2',
    indycar: 'IndyCar Series',
    indynxt: 'Indy NXT',
    formula_e: 'Fórmula E Mundial',
    nascar: 'NASCAR Cup Series',
    prototipos: 'Mundial de Endurance (WEC)',
    mercado: 'Mercado Internacional',
    f1_academy: 'F1 Academy',
  }
  const cat = catNames[pilot.category] || 'Monomarcas Internacionais'

  if (pilot.f1RacesCompleted > 100) {
    return `Veterano consagrado do automobilismo mundial com ${pilot.f1RacesCompleted} grandes prêmios de F1 disputados. Piloto com vasta experiência em gestão de pneus sob pressão, feedback técnico refinado de telemetria e liderança de garagem comprovada nas pistas.`
  }
  if (pilot.f1RacesCompleted > 0) {
    return `Piloto de Fórmula 1 consolidado com ${pilot.f1RacesCompleted} largadas na categoria rainha. Demonstrou ritmo veloz no pelotão e adaptação contínua às exigências aerodinâmicas do regulamento 2026.`
  }
  if (pilot.isAcademyProspect || pilot.age < 23) {
    return `Jovem promessa internacional oriunda de ${cat}. Desenvolvido nas categorias de base com destaque para velocidade pura em volta lançada e alto teto de aprendizado nos simuladores de ponta.`
  }
  return `Atleta com passagens consistentes por ${cat}. Possui histórico de corridas de alto nível, controle de tração refinado e prontidão imediata para funções competitivas no grid mundial.`
}

// Traços qualitativos (regras MBJ)
function getDriverTraits(pilot: UnifiedDriverItem): string[] {
  const traits: string[] = []
  if (pilot.rain >= 88) traits.push('Especialista em Chuva')
  if (pilot.defense >= 88) traits.push('Defesa Implacável')
  if (pilot.speed >= 90) traits.push('Mestre do Qualy')
  if (pilot.consistency >= 88) traits.push('Ritmo Metronômico')
  if (pilot.age <= 21) traits.push('Teto Exponencial')
  if (pilot.age >= 35) traits.push('Liderança Experiente')
  if (pilot.f1RacesCompleted > 50) traits.push('Maturidade de Paddock')
  if (traits.length === 0) {
    traits.push('Piloto Técnico', 'Adaptação Progressiva')
  }
  return traits
}

export const PilotProfileDialog: React.FC<PilotProfileDialogProps> = ({
  pilot,
  open,
  onOpenChange,
  onOpenContractModal,
  currentRound = 1,
  onPromoteToStarter,
  onRelegateToReserve,
  onDismissDriver,
  canPromoteToStarter,
  canRelegateToReserve,
}) => {
  // Carrega resultados de corrida e históricos de temporada do save para cálculo canônico de carreira
  const [saveRaceResults, setSaveRaceResults] = React.useState<any[] | null>(null)
  const [saveSeasonHistories, setSaveSeasonHistories] = React.useState<any[] | null>(null)

  React.useEffect(() => {
    let isMounted = true
    if (!open || !pilot) return

    async function loadSaveCareerData() {
      try {
        const [rr, sh] = await Promise.allSettled([
          pb.collection('race_results').getFullList({
            filter: `driver_id = "${pilot?.id}"`,
            fields: 'id,driver_id,position,season_id',
          }),
          pb.collection('season_histories').getFullList({
            fields: 'id,season_year,drivers_champion',
          }),
        ])

        if (!isMounted) return

        if (rr.status === 'fulfilled') {
          setSaveRaceResults(rr.value as any[])
        }
        if (sh.status === 'fulfilled') {
          setSaveSeasonHistories(sh.value as any[])
        }
      } catch (err) {
        console.warn('Erro ao carregar dados de carreira do save para PilotProfileDialog:', err)
      }
    }

    loadSaveCareerData()

    return () => {
      isMounted = false
    }
  }, [open, pilot?.id])

  // Estatísticas canônicas de carreira derivadas: baseline + resultados do save
  const careerStats = React.useMemo(() => {
    return getDriverCareerStats({
      pilot: pilot as any,
      raceResults: saveRaceResults,
      seasonHistories: saveSeasonHistories,
    })
  }, [pilot, saveRaceResults, saveSeasonHistories])

  // Implementação Nº 6A — Recupera Auditoria e Bundle Psicológico (incondicional no topo)
  const psychAudit = React.useMemo(() => {
    if (!pilot) return null
    return driverRelationshipService.auditDriverPsychology({
      id: pilot.id,
      name: pilot.name,
      morale: pilot.moraleState ?? 75,
      speed: pilot.speed,
      consistency: pilot.consistency,
      seat_security: (pilot as any).rawDbRecord?.seat_security ?? (pilot as any).seatSecurity ?? 80,
    })
  }, [pilot])

  // Canonical homologation view do adapter unificado (incondicional no topo)
  const canonicalView = React.useMemo(() => {
    return canonicalHomologationAdapter.toCanonicalView(pilot as any)
  }, [pilot])

  if (!pilot || !psychAudit) return null

  const ovr = getOverallRating(pilot)
  const eligibility = checkEligibility(pilot)
  const isUserTeam = pilot.isPlayerDriver
  const canPreContract = currentRound >= 12

  const canonicalTraits = psychAudit.personalityTraits
  const descriptors = getPersonalityDescriptors(canonicalTraits)

  // Sistema de Homologação FIA: titular oficial do grid F1 2026 nunca está em homologação pendente
  const rawHomologationStatus =
    (pilot as any).rawDbRecord?.homologation_status || pilot.eligibilityStatus
  const homologationSessions = (pilot as any).rawDbRecord?.homologation_sessions_done ?? 0
  const isStarterF1 =
    canonicalView.isEligibleForF1Seat ||
    ((pilot.role ?? '').toLowerCase() === 'titular' &&
      ((pilot.category ?? '').toLowerCase() === 'f1' || !pilot.category))
  const isHomologation =
    !isStarterF1 &&
    (rawHomologationStatus === 'homologacao' ||
      eligibility.status === 'homologacao' ||
      ((pilot.f1RacesCompleted ?? 0) === 0 &&
        (pilot.superlicensePoints ?? 0) < 40 &&
        pilot.age >= 18))

  // Atributos P: Faixas parciais (ex.: 92-95) a menos que seja da equipe do usuário (V)
  const getAttrDisplay = (value: number) => {
    if (isUserTeam) {
      return { label: `${value}`, min: value, max: value, percent: value }
    }
    const minVal = Math.max(50, value - 2)
    const maxVal = Math.min(99, value + 2)
    return {
      label: `${minVal}–${maxVal}`,
      min: minVal,
      max: maxVal,
      percent: value,
    }
  }

  // Faixas qualitativas para estado mental/físico para pilotos de fora (V exato só para equipe do jogador)
  const getQualitativeState = (
    val: number,
    kind: 'morale' | 'confidence' | 'condition' | 'stress',
  ) => {
    if (isUserTeam) return `${val}%`
    if (kind === 'stress') {
      if (val <= 20) return 'Baixo / Sob Controle'
      if (val <= 40) return 'Moderado'
      return 'Elevado'
    }
    if (val >= 85) return 'Muito Alta'
    if (val >= 70) return 'Alta'
    if (val >= 50) return 'Estável'
    return 'Em Recuperação'
  }

  // 14 Atributos Esportivos MBJ
  const sportAttrs = [
    {
      name: 'Velocidade',
      val: pilot.speed,
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-500',
    },
    {
      name: 'Classificação',
      val: pilot.qualifying ?? pilot.speed,
      icon: Target,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500',
    },
    {
      name: 'Ritmo de Corrida',
      val: pilot.racePace ?? Math.round((pilot.speed + pilot.consistency) / 2),
      icon: Gauge,
      color: 'text-orange-400',
      bg: 'bg-orange-500',
    },
    {
      name: 'Consistência',
      val: pilot.consistency,
      icon: Activity,
      color: 'text-blue-400',
      bg: 'bg-blue-500',
    },
    {
      name: 'Largada',
      val: pilot.start ?? pilot.defense - 2,
      icon: Flame,
      color: 'text-red-400',
      bg: 'bg-red-500',
    },
    {
      name: 'Ultrapassagem',
      val: pilot.overtake ?? pilot.speed - 1,
      icon: Compass,
      color: 'text-purple-400',
      bg: 'bg-purple-500',
    },
    {
      name: 'Defesa',
      val: pilot.defense,
      icon: Shield,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500',
    },
    { name: 'Chuva', val: pilot.rain, icon: CloudRain, color: 'text-cyan-400', bg: 'bg-cyan-500' },
    {
      name: 'Gestão de Pneus',
      val: pilot.tireManagement ?? pilot.consistency,
      icon: Gauge,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500',
    },
    {
      name: 'Energia / ERS',
      val: pilot.energyManagement ?? pilot.consistency - 1,
      icon: Zap,
      color: 'text-teal-400',
      bg: 'bg-teal-500',
    },
    {
      name: 'Feedback Técnico',
      val: pilot.feedback ?? pilot.consistency + 2,
      icon: Activity,
      color: 'text-emerald-300',
      bg: 'bg-emerald-400',
    },
    {
      name: 'Gestão de Pressão',
      val: pilot.pressure ?? pilot.speed - 2,
      icon: Heart,
      color: 'text-rose-400',
      bg: 'bg-rose-500',
    },
    {
      name: 'Concentração',
      val: pilot.concentration ?? pilot.consistency,
      icon: Target,
      color: 'text-sky-400',
      bg: 'bg-sky-500',
    },
    {
      name: 'Resiliência',
      val: pilot.resilience ?? pilot.defense,
      icon: Shield,
      color: 'text-lime-400',
      bg: 'bg-lime-500',
    },
  ]

  // Personalidade P (faixas) & V (exatos)
  const personalityP = [
    { label: 'Agressividade', val: pilot.aggressiveness ?? 70 },
    { label: 'Ambição', val: pilot.ambition ?? 80 },
    { label: 'Lealdade', val: pilot.loyalty ?? 75 },
    { label: 'Profissionalismo', val: pilot.professionalism ?? 85 },
  ]

  const traits =
    pilot.revealedTraits && pilot.revealedTraits.length > 0
      ? pilot.revealedTraits
      : getDriverTraits(pilot)
  const biography = pilot.biography || getDriverBiography(pilot)

  // Status/vínculo do piloto
  const hasTeam = Boolean(
    pilot.teamName &&
    pilot.teamName !== 'Sem equipe' &&
    pilot.teamName !== 'Agente Livre' &&
    pilot.teamName !== 'Agente Livre (Sem equipe)',
  )
  const currentTeamDisplay = hasTeam ? pilot.teamName : 'Agente Livre'
  const effectiveContractEnd = pilot.contractEnd ?? (pilot as any).contract_end
  const contractTermDisplay =
    hasTeam && effectiveContractEnd && effectiveContractEnd >= 2026
      ? `Até o fim de ${effectiveContractEnd}`
      : 'Sem vínculo vigente'

  const canonicalContract =
    (pilot as any).rawDbRecord?.canonical_contract || (pilot as any).canonical_contract
  const careerIntentState = (pilot as any).rawDbRecord?.career_intent_state || 'CONTENT'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full bg-white border border-[#E2E8F0] text-[#0F172A] p-0 overflow-hidden max-h-[88vh] flex flex-col shadow-2xl">
        {/* Cabeçalho de Perfil com Banner e Foto */}
        <div className="relative bg-[#F8FAFC] p-4 sm:p-6 pb-4 sm:pb-5 border-b border-[#E2E8F0] shrink-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-5">
            {/* Foto Grande do Piloto */}
            <div className="w-20 sm:w-32 shrink-0">
              <DriverPoster
                name={pilot?.name || ''}
                driverId={pilot?.id}
                visualIdentity={
                  (pilot as any)?.procedural_data?.visualIdentity ||
                  (pilot as any)?.visualIdentity ||
                  (pilot as any)?.rawDbRecord?.procedural_data?.visualIdentity ||
                  null
                }
                aspectRatio="poster"
                className="w-full shadow-md ring-1 ring-[#CBD5E1] rounded-lg"
              />
            </div>

            {/* Informações V (Público - Valor Exato) */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mb-1">
                <Badge
                  variant="outline"
                  className="bg-white border-[#CBD5E1] text-[#0F172A] font-mono text-[10px] sm:text-xs flex items-center gap-1 shadow-xs"
                >
                  {getCountryFlag(pilot.nationality)} {pilot.nationality}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-white border-[#CBD5E1] text-[#64748B] text-[10px] sm:text-xs uppercase shadow-xs"
                >
                  {pilot.category.toUpperCase()}
                </Badge>
                {isUserTeam && (
                  <Badge className="bg-[#E10600]/10 text-[#E10600] border border-[#E10600]/30 text-[10px] sm:text-xs font-bold">
                    Sua Equipe
                  </Badge>
                )}
              </div>

              <DialogTitle className="text-xl sm:text-3xl font-black tracking-tight text-[#0F172A] truncate">
                {pilot.name}
              </DialogTitle>

              <DialogDescription className="text-[#64748B] text-xs mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                <span>{pilot.age} anos</span>
                <span>•</span>
                <span className="text-[#334155] font-semibold">{currentTeamDisplay}</span>
                {pilot.role && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] uppercase py-0 px-2 ${
                      String(pilot.role).toLowerCase().includes('titular')
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {pilot.role}
                  </Badge>
                )}
              </DialogDescription>

              {/* Destaque OVR / Reputação e Salário de Referência V (Regra R03 sem OVR na F1 Academy) */}
              <div className="mt-3.5 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[#E2E8F0] shadow-xs">
                  <span className="text-[11px] font-mono uppercase text-[#64748B] font-semibold">
                    {pilot.category === 'f1_academy' ? 'Perfil MBJ' : 'Overall'}
                  </span>
                  <span
                    className={`font-black font-mono text-sm px-1.5 py-0.5 rounded ${
                      pilot.category === 'f1_academy'
                        ? 'bg-pink-100 text-pink-800 border border-pink-200'
                        : ovr >= 90
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : ovr >= 82
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-neutral-100 text-[#0F172A] border border-neutral-200'
                    }`}
                    title={
                      pilot.category === 'f1_academy'
                        ? 'Regra MBJ R03: Sem overall derivado nem média universal para F1 Academy'
                        : undefined
                    }
                  >
                    {pilot.category === 'f1_academy'
                      ? 'Faixas P'
                      : isUserTeam
                        ? ovr
                        : `${Math.max(50, ovr - 2)}–${Math.min(99, ovr + 2)}`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-emerald-800 shadow-xs">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <div className="text-left leading-tight">
                    <div className="text-[10px] uppercase font-mono text-emerald-700">
                      Salário de Referência (USD)
                    </div>
                    <div className="font-bold font-mono text-xs text-emerald-900">
                      {(() => {
                        const rawSal =
                          pilot.salaryUsd ??
                          (pilot as any).salary ??
                          (pilot as any).rawDbRecord?.salary ??
                          (pilot as any).canonical_contract?.baseSalaryUsd
                        if (
                          rawSal === null ||
                          rawSal === undefined ||
                          rawSal === '' ||
                          isNaN(Number(rawSal)) ||
                          Number(rawSal) <= 0
                        ) {
                          return '—'
                        }
                        return formatUsdCurrency(Number(rawSal), 'full')
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Corpo do Perfil Rolável */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {/* Seção 1: 14 Atributos Esportivos MBJ (Regra P / V) */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                14 Atributos Esportivos{' '}
                {isUserTeam ? '(Valores Exatos da Sua Equipe)' : '(Faixas Projetadas MBJ)'}
              </h4>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-[#CBD5E1] text-[#64748B] bg-white"
              >
                {isUserTeam ? 'Vínculo Pleno' : 'Regra P/V'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 pt-1">
              {sportAttrs.map((attr) => {
                const display = getAttrDisplay(attr.val)
                const IconComponent = attr.icon
                return (
                  <div key={attr.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B] flex items-center gap-1.5">
                        <IconComponent className={`w-3.5 h-3.5 ${attr.color}`} /> {attr.name}
                      </span>
                      <span className="font-mono font-bold text-[#0F172A]">{display.label}</span>
                    </div>
                    <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden flex">
                      <div
                        className={`${attr.bg} h-full rounded-full transition-all`}
                        style={{ width: `${Math.min(100, (display.max / 100) * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Potencial Projetado P */}
            <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
              <span className="text-[#64748B]">Potencial Projetado de Carreira:</span>
              <span className="font-mono font-bold text-amber-600">
                {pilot.potentialMin} – {pilot.potentialMax} pts
              </span>
            </div>
          </div>

          {/* Seção 2: Estado Físico & Mental (Qualitativo para fora / Exato para jogador) */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              Estado Atual & Adaptação{' '}
              {isUserTeam ? '(Telemetria Interna)' : '(Avaliação Qualitativa)'}
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0] shadow-xs">
                <span className="text-[10px] text-[#64748B] uppercase font-mono block mb-0.5">
                  Moral
                </span>
                <span className="font-bold text-[#0F172A]">
                  {getQualitativeState(pilot.moraleState ?? 75, 'morale')}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0] shadow-xs">
                <span className="text-[10px] text-[#64748B] uppercase font-mono block mb-0.5">
                  Confiança
                </span>
                <span className="font-bold text-[#0F172A]">
                  {getQualitativeState(pilot.confidence ?? 75, 'confidence')}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0] shadow-xs">
                <span className="text-[10px] text-[#64748B] uppercase font-mono block mb-0.5">
                  Condição Física
                </span>
                <span className="font-bold text-emerald-600">
                  {getQualitativeState(pilot.physicalCondition ?? 100, 'condition')}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0] shadow-xs">
                <span className="text-[10px] text-[#64748B] uppercase font-mono block mb-0.5">
                  Nível de Estresse
                </span>
                <span className="font-bold text-amber-600">
                  {getQualitativeState(pilot.stress ?? 25, 'stress')}
                </span>
              </div>
            </div>

            {/* Adaptações F1, Carro e Equipe */}
            <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px] text-[#64748B]">
                  <span>Adaptação F1</span>
                  <span className="font-mono text-[#0F172A] font-semibold">
                    {(pilot.adaptationF1 ?? 0) > 0
                      ? `${pilot.adaptationF1}% / meta 80%`
                      : getAttrDisplay(pilot.adaptationF1 ?? 80).label}
                  </span>
                </div>
                <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{ width: `${Math.min(100, ((pilot.adaptationF1 ?? 80) / 80) * 100)}%` }}
                  />
                </div>
              </div>{' '}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-[#64748B]">
                  <span>Adaptação Carro</span>
                  <span className="font-mono text-[#0F172A]">
                    {getAttrDisplay(pilot.adaptationCar ?? 80).label}
                  </span>
                </div>
                <div className="w-full bg-neutral-200 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${pilot.adaptationCar ?? 80}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-[#64748B]">
                  <span>Adaptação Equipe</span>
                  <span className="font-mono text-[#0F172A]">
                    {getAttrDisplay(pilot.adaptationTeam ?? 80).label}
                  </span>
                </div>
                <div className="w-full bg-neutral-200 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full"
                    style={{ width: `${pilot.adaptationTeam ?? 80}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 3: Personalidade Canônica, Relações e Memórias (Implementação Nº 6A) */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-purple-600" />
                Personalidade Canônica & Estado Psicológico
              </h4>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-purple-200 text-purple-800 bg-purple-50"
              >
                Trait ≠ State (6A)
              </Badge>
            </div>

            {/* Tags Qualitativas da Personalidade */}
            <div>
              <span className="text-[10px] font-mono uppercase text-[#64748B] block mb-1.5 font-semibold">
                Perfil de Personalidade (Traits Canônicos)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {descriptors.map((desc) => (
                  <Badge
                    key={desc}
                    className="bg-purple-100 border border-purple-200 text-purple-800 text-xs py-0.5 px-2.5 font-medium"
                  >
                    {desc}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Estado Psicológico Atual (Qualitativo) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-white border border-[#E2E8F0] shadow-xs">
                <span className="text-[10px] uppercase font-mono text-[#64748B] block">
                  Satisfação
                </span>
                <span className="font-semibold text-emerald-600">
                  {psychAudit.qualitativeState.satisfaction}
                </span>
              </div>
              <div className="p-2 rounded bg-white border border-[#E2E8F0] shadow-xs">
                <span className="text-[10px] uppercase font-mono text-[#64748B] block">
                  Confiança
                </span>
                <span className="font-semibold text-blue-600">
                  {psychAudit.qualitativeState.confidence}
                </span>
              </div>
              <div className="p-2 rounded bg-white border border-[#E2E8F0] shadow-xs">
                <span className="text-[10px] uppercase font-mono text-[#64748B] block">
                  Pressão Sentida
                </span>
                <span className="font-semibold text-amber-600">
                  {psychAudit.qualitativeState.pressure}
                </span>
              </div>
              <div className="p-2 rounded bg-white border border-[#E2E8F0] shadow-xs">
                <span className="text-[10px] uppercase font-mono text-[#64748B] block">
                  Frustração
                </span>
                <span className="font-semibold text-rose-600">
                  {psychAudit.qualitativeState.frustration}
                </span>
              </div>
            </div>

            {/* Relações Tridimensionais (Team Principal, Equipe, Companheiro) */}
            <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
              <span className="text-[10px] font-mono uppercase text-[#64748B] block font-semibold flex items-center gap-1.5">
                <Handshake className="w-3.5 h-3.5 text-cyan-600" /> Vínculos & Relações Internas
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {/* Relação com Team Principal */}
                <div className="p-2.5 bg-white border border-[#E2E8F0] rounded-lg space-y-1 shadow-xs">
                  <div className="font-semibold text-[#0F172A] flex items-center justify-between">
                    <span>Team Principal</span>
                    <span className="font-mono text-[10px] text-[#64748B]">
                      {isUserTeam
                        ? `${psychAudit.relationships.teamPrincipal.trust}% Confiança`
                        : 'Vínculo Ativo'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    Confiança:{' '}
                    <strong className="text-[#0F172A]">
                      {formatQualitativeState(
                        psychAudit.relationships.teamPrincipal.trust,
                        'trust',
                      )}
                    </strong>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    Respeito:{' '}
                    <strong className="text-[#334155]">
                      {formatQualitativeState(
                        psychAudit.relationships.teamPrincipal.respect,
                        'confidence',
                      )}
                    </strong>
                  </div>
                </div>

                {/* Relação com a Equipe / Fábrica */}
                <div className="p-2.5 bg-white border border-[#E2E8F0] rounded-lg space-y-1 shadow-xs">
                  <div className="font-semibold text-[#0F172A] flex items-center justify-between">
                    <span>Equipe / Fábrica</span>
                    <span className="font-mono text-[10px] text-[#64748B]">
                      {isUserTeam
                        ? `${psychAudit.relationships.team.technicalTrust}% Técnico`
                        : 'Vínculo'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    Pertencimento:{' '}
                    <strong className="text-[#0F172A]">
                      {formatQualitativeState(
                        psychAudit.relationships.team.belonging,
                        'satisfaction',
                      )}
                    </strong>
                  </div>
                  <div className="text-[11px] text-[#64748B]">
                    Desejo de Ficar:{' '}
                    <strong className="text-amber-600 font-bold">
                      {formatQualitativeState(psychAudit.derivedDesireToStay, 'trust')}
                    </strong>
                  </div>
                </div>

                {/* Relação com Companheiro */}
                <div className="p-2.5 bg-white border border-[#E2E8F0] rounded-lg space-y-1 shadow-xs">
                  <div className="font-semibold text-[#0F172A] flex items-center justify-between">
                    <span>Companheiro</span>
                    {psychAudit.relationships.teammate && (
                      <Badge
                        variant="outline"
                        className="text-[9px] py-0 border-[#CBD5E1] text-[#334155] font-mono bg-white"
                      >
                        {psychAudit.relationships.teammate.status}
                      </Badge>
                    )}
                  </div>
                  {psychAudit.relationships.teammate ? (
                    <>
                      <div className="text-[11px] text-[#64748B] truncate">
                        {psychAudit.relationships.teammate.teammateName}
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        Respeito Mútuo:{' '}
                        <strong className="text-[#0F172A]">
                          {formatQualitativeState(
                            psychAudit.relationships.teammate.respect,
                            'confidence',
                          )}
                        </strong>
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-[#64748B] italic">
                      Sem disputa direta ativa
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Memórias Relevantes Ativas */}
            {psychAudit.topActiveMemories.length > 0 && (
              <div className="pt-2 border-t border-[#E2E8F0] space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-[#64748B] block font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" /> Memórias Recentes Relevantes
                </span>
                <div className="space-y-1.5">
                  {psychAudit.topActiveMemories.map((mem) => (
                    <div
                      key={mem.memoryId}
                      className="text-xs p-2 rounded bg-white border border-[#E2E8F0] flex items-start justify-between gap-2 shadow-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="text-[#0F172A] font-medium">{mem.description}</div>
                        <div className="text-[10px] text-[#64748B]">{mem.contextExplanation}</div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] uppercase shrink-0 py-0 ${
                          mem.polarity === 'positive'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : mem.polarity === 'negative'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-neutral-100 text-[#0F172A]'
                        }`}
                      >
                        {mem.persistenceClass}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Parâmetros Ocultos O (sem números, apenas regra descritiva) */}
          <div className="text-[11px] text-[#64748B] flex items-center gap-1.5 bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
            <Lock className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
            <span>
              Parâmetros Ocultos MBJ (Temperamento, 14 Tetos de Habilidade, Curva de Declínio,
              Horizonte de Aposentadoria e Pesos Negociais) operam restritos à simulação interna.
            </span>
          </div>

          {/* Seção 3.5: CARREIRA & DESENVOLVIMENTO (Implementação Nº 8B - Regras 93, 94, 95, 96) */}
          {(() => {
            const rawDev =
              (pilot as any).rawDbRecord?.development_profile || (pilot as any).development_profile
            const devHist =
              (pilot as any).rawDbRecord?.development_history ||
              (pilot as any).development_history ||
              []
            const retIntent =
              (pilot as any).rawDbRecord?.retirement_intent ||
              (pilot as any).retirement_intent ||
              'NO_THOUGHTS'
            const age = pilot.age || 25

            let stageLabel = 'Desenvolvendo'
            let stageBadgeClass = 'bg-blue-50 border-blue-200 text-blue-800'

            if (age <= 21) {
              stageLabel = 'Desenvolvimento Rápido (Jovem)'
              stageBadgeClass = 'bg-emerald-50 border-emerald-200 text-emerald-800'
            } else if (age <= 26) {
              stageLabel = 'Em Ascensão Técnica'
              stageBadgeClass = 'bg-cyan-50 border-cyan-200 text-cyan-800'
            } else if (age <= 31) {
              stageLabel = 'No Ápice de Carreira (Prime)'
              stageBadgeClass = 'bg-purple-50 border-purple-200 text-purple-800'
            } else if (age <= 34) {
              stageLabel = 'Estável / Pós-Pico'
              stageBadgeClass = 'bg-indigo-50 border-indigo-200 text-indigo-800'
            } else if (age <= 37) {
              stageLabel = 'Declínio Inicial / Veterano'
              stageBadgeClass = 'bg-amber-50 border-amber-200 text-amber-800'
            } else {
              stageLabel = 'Veterano Experiente'
              stageBadgeClass = 'bg-rose-50 border-rose-200 text-rose-800'
            }

            // Exibir Retirement Intent qualitativo somente se houver sinais (Regra 96)
            let retirementAlert: string | null = null
            if (retIntent === 'ANNOUNCED') {
              retirementAlert =
                '🏁 Aposentadoria oficial anunciada: última temporada como piloto profissional.'
            } else if (retIntent === 'LIKELY') {
              retirementAlert =
                '⚠️ Sinais de transição: piloto avalia que o ciclo profissional se aproxima da conclusão.'
            } else if (retIntent === 'CONSIDERING' && age >= 35) {
              retirementAlert =
                '⏳ Reflexão sobre o futuro: avaliando mercado e planos pós-automobilismo.'
            }

            return (
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />
                    Carreira & Desenvolvimento (8B)
                  </h4>
                  <Badge variant="outline" className={`text-[10px] font-mono ${stageBadgeClass}`}>
                    {stageLabel}
                  </Badge>
                </div>

                {retirementAlert && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>{retirementAlert}</span>
                  </div>
                )}

                {/* Tendência dos atributos qualitativa (Regra 94) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-white border border-[#E2E8F0] shadow-xs">
                    <span className="text-[10px] uppercase text-[#64748B] block">Ritmo Puro</span>
                    <span className="font-bold text-[#0F172A]">
                      {age <= 24
                        ? 'Pace ↑ (Em alta)'
                        : age <= 33
                          ? 'Pace → (Estável)'
                          : 'Pace ↘ (Declínio gradual)'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E2E8F0] shadow-xs">
                    <span className="text-[10px] uppercase text-[#64748B] block">Consistência</span>
                    <span className="font-bold text-[#0F172A]">
                      {age <= 30 ? 'Consistência ↑' : 'Consistência → (Forte)'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E2E8F0] shadow-xs">
                    <span className="text-[10px] uppercase text-[#64748B] block">
                      Feedback Técnico
                    </span>
                    <span className="font-bold text-emerald-600">
                      {age >= 32 ? 'Feedback ★ (Elite)' : 'Feedback ↑ (Em expansão)'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E2E8F0] shadow-xs">
                    <span className="text-[10px] uppercase text-[#64748B] block">
                      Gestão de Pneus
                    </span>
                    <span className="font-bold text-cyan-600">
                      {age >= 26 ? 'Gestão ↑ (Maturidade)' : 'Gestão → (Aprendizado)'}
                    </span>
                  </div>
                </div>

                {/* Histórico recente de desenvolvimento se disponível */}
                {devHist.length > 0 && (
                  <div className="pt-1 text-[11px] text-[#64748B] space-y-1">
                    <div className="flex items-center gap-1 font-semibold text-[#0F172A]">
                      <History className="w-3 h-3 text-[#64748B]" /> Evolução Recente Auditada:
                    </div>
                    <p className="italic text-[#334155] leading-relaxed bg-white p-2 rounded border border-[#E2E8F0]">
                      "{devHist[0]?.evolutionNarrative || 'Performance técnica consolidada.'}"
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Seção 4: Carreira & Histórico (V) — CARREIRA NA F1 */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              CARREIRA NA F1
            </h4>

            {/* Grid Canônico de Estatísticas de Carreira na F1 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] text-center shadow-xs">
                <span className="text-[10px] uppercase tracking-wider font-mono text-[#64748B] block">
                  GPs
                </span>
                <strong className="text-lg font-black font-mono text-[#0F172A]">
                  {careerStats.races}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] text-center shadow-xs">
                <span className="text-[10px] uppercase tracking-wider font-mono text-[#64748B] block">
                  Vitórias
                </span>
                <strong className="text-lg font-black font-mono text-emerald-600">
                  {careerStats.wins}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] text-center shadow-xs">
                <span className="text-[10px] uppercase tracking-wider font-mono text-[#64748B] block">
                  Pole Positions
                </span>
                <strong className="text-lg font-black font-mono text-amber-600">
                  {careerStats.poles}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] text-center shadow-xs">
                <span className="text-[10px] uppercase tracking-wider font-mono text-[#64748B] block">
                  Títulos Mundiais
                </span>
                <strong className="text-lg font-black font-mono text-amber-500">
                  {careerStats.championships}
                </strong>
              </div>
            </div>

            <p className="text-xs text-[#334155] leading-relaxed pt-1">{biography}</p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] font-mono text-[#64748B] border-t border-[#E2E8F0]">
              <span>
                Pontos Superlicença:{' '}
                <strong className="text-[#0F172A]">{pilot.superlicensePoints}</strong>
              </span>
              {pilot.preferredNumber && (
                <>
                  <span>•</span>
                  <span>
                    Número Preferido:{' '}
                    <strong className="text-amber-600 font-bold">#{pilot.preferredNumber}</strong>
                  </span>
                </>
              )}
              {pilot.operatingTeam && (
                <>
                  <span>•</span>
                  <span>
                    Equipe Operadora:{' '}
                    <strong className="text-pink-600 font-semibold">{pilot.operatingTeam}</strong>
                  </span>
                </>
              )}
              {pilot.supporterBrand && (
                <>
                  <span>•</span>
                  <span>
                    Apoiadora de Marca:{' '}
                    <strong className="text-purple-600 font-semibold">
                      {pilot.supporterBrand}
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>
          {/* Seção 5: Situação Contratual & Elegibilidade MBJ */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
              Situação & Elegibilidade Contratual
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0] space-y-1 shadow-xs">
                <span className="text-[#64748B] text-[11px]">Vínculo Atual:</span>
                <div className="font-bold text-[#0F172A]">{currentTeamDisplay}</div>
                <div className="text-[11px] text-[#64748B]">{contractTermDisplay}</div>
                <div className="text-[11px] text-[#64748B] pt-1 border-t border-[#E2E8F0] mt-1 flex justify-between items-center">
                  <span>Papel Contratual:</span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] border-[#CBD5E1] text-[#0F172A] bg-white"
                  >
                    {canonicalContract?.role ||
                      ((pilot.role ?? '').toLowerCase() === 'titular' ? 'EQUAL_STATUS' : 'RESERVE')}
                  </Badge>
                </div>
                {pilot.exitClauseUsd && (
                  <div className="text-[11px] text-[#64748B] flex justify-between">
                    <span>Multa Rescisória (P):</span>
                    <span className="font-mono font-bold text-[#0F172A]">
                      {formatUsdCurrency(
                        canonicalContract?.buyoutClause?.buyoutAmount || pilot.exitClauseUsd,
                        'full',
                      )}
                    </span>
                  </div>
                )}
                {pilot.winBonusUsd && (
                  <div className="text-[11px] text-[#64748B] flex justify-between">
                    <span>Bônus por Vitória (P):</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {formatUsdCurrency(pilot.winBonusUsd, 'full')}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0] space-y-1.5 shadow-xs">
                <span className="text-[#64748B] text-[11px]">
                  Status Regulamentar FIA / Elegibilidade MBJ:
                </span>
                <div className="flex items-center gap-1 font-bold text-[#0F172A]">
                  {isHomologation && (
                    <span className="text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Exige Homologação FIA (TL1 100 km)
                    </span>
                  )}
                  {!isHomologation && (eligibility.status as string) === 'academia' && (
                    <span className="text-purple-600 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" />{' '}
                      {pilot.eligibilityStatus || eligibility.label}
                    </span>
                  )}
                  {!isHomologation && (eligibility.status as string) === 'homologacao' && (
                    <span className="text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />{' '}
                      {pilot.eligibilityStatus || 'TESTE HOMOLOGAÇÃO MBJ'}
                    </span>
                  )}
                  {!isHomologation && (eligibility.status as string) === 'elegivel' && (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                      {pilot.eligibilityStatus || 'Superlicença Válida FIA'}
                    </span>
                  )}
                </div>

                {/* CAMINHO PARA A F1 (Regra 15 do PDF):
                    Formato: "Homologação FIA: 3/4 testes — Quilometragem: 1.086/1.200 km — Avaliação atual: 81 — Status: Licença Provisória" */}
                <div className="p-2.5 bg-[#F1F5F9] border border-[#CBD5E1] rounded-md space-y-1.5 my-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-[#1E293B] font-semibold uppercase tracking-wider text-[10px]">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Caminho para a F1
                    </span>
                    <Badge
                      variant="outline"
                      className="border-[#CBD5E1] text-[#0F172A] bg-white text-[9px]"
                    >
                      {canonicalView.licenseStatus === 'nivel_a'
                        ? 'Licença A (Super Licença)'
                        : canonicalView.licenseStatus === 'nivel_b'
                          ? 'Licença B'
                          : 'Licença C'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-[#CBD5E1]">
                    <div>
                      <span className="text-[#64748B] block">Homologação FIA:</span>
                      <strong className="text-[#0F172A]">
                        {isHomologation ? `${homologationSessions}/4 testes` : '4/4 testes'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Quilometragem:</span>
                      <strong className="text-[#0F172A]">
                        {isHomologation
                          ? `${homologationSessions * 310}/1.200 km`
                          : '1.200/1.200 km'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Avaliação FIA:</span>
                      <strong className="text-amber-600">{pilot.speed || 80}/100</strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Status Regulamentar:</span>
                      <strong className="text-emerald-600">
                        {canonicalView.licenseStatus === 'nivel_a'
                          ? 'Super Licença'
                          : canonicalView.licenseStatus === 'nivel_b'
                            ? 'Licença Provisória'
                            : 'Licença em Formação'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-[#64748B]">{eligibility.description}</div>
              </div>
            </div>

            {pilot.nextTeamId && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Pré-contrato firmado para 2027 como piloto {pilot.nextContractRole || 'titular'}.
                </span>
              </div>
            )}
          </div>
        </div>
        {/* Rodapé Fixo com Botão de Ação e Ações Contextuais por Papel */}
        <div className="p-3 sm:p-4 bg-white border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="border-[#CBD5E1] text-[#64748B] hover:bg-[#F1F5F9] text-xs h-8"
          >
            Fechar
          </Button>

          {isUserTeam ? (
            <div className="flex flex-wrap items-center gap-2">
              {onRelegateToReserve && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canRelegateToReserve}
                  onClick={() => {
                    onOpenChange(false)
                    onRelegateToReserve(pilot)
                  }}
                  className="border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 text-xs h-8"
                >
                  Rebaixar p/ Reserva
                </Button>
              )}

              {onPromoteToStarter && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canPromoteToStarter}
                  onClick={() => {
                    onOpenChange(false)
                    onPromoteToStarter(pilot)
                  }}
                  className="border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 text-xs h-8"
                >
                  Promover a Titular
                </Button>
              )}

              {onDismissDriver && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    onOpenChange(false)
                    onDismissDriver(pilot)
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium text-xs h-8"
                >
                  Dispensar Piloto
                </Button>
              )}

              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onOpenContractModal(pilot)
                }}
                className="bg-[#0F172A] hover:bg-[#1E293B] text-white border border-[#0F172A] text-xs h-8"
              >
                Renegociar Contrato
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onOpenContractModal(pilot)
              }}
              className="bg-[#E10600] hover:bg-[#C50500] text-white font-medium flex items-center gap-1.5 shadow-sm text-xs h-8"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {canPreContract ? 'Propor Pré-contrato / Contrato' : 'Propor Contrato (US$)'}
            </Button>
          )}
        </div>{' '}
      </DialogContent>
    </Dialog>
  )
}

export default PilotProfileDialog
