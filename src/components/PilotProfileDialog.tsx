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

  if (!pilot || !psychAudit) return null

  const ovr = getOverallRating(pilot)
  const eligibility = checkEligibility(pilot)
  const isUserTeam = pilot.isPlayerDriver
  const canPreContract = currentRound >= 12

  const canonicalTraits = psychAudit.personalityTraits
  const descriptors = getPersonalityDescriptors(canonicalTraits)

  // Sistema de Homologação FIA
  const rawHomologationStatus =
    (pilot as any).rawDbRecord?.homologation_status || pilot.eligibilityStatus
  const homologationSessions = (pilot as any).rawDbRecord?.homologation_sessions_done ?? 0
  const isHomologation =
    rawHomologationStatus === 'homologacao' ||
    eligibility.status === 'homologacao' ||
    ((pilot.f1RacesCompleted ?? 0) === 0 && (pilot.superlicensePoints ?? 0) < 40 && pilot.age >= 18)

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
  const contractTermDisplay =
    hasTeam && pilot.contractEnd && pilot.contractEnd >= 2026
      ? `Até o fim de ${pilot.contractEnd}`
      : 'Sem vínculo vigente'

  const canonicalContract =
    (pilot as any).rawDbRecord?.canonical_contract || (pilot as any).canonical_contract
  const careerIntentState = (pilot as any).rawDbRecord?.career_intent_state || 'CONTENT'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full bg-zinc-950 border border-zinc-800 text-zinc-100 p-0 overflow-hidden max-h-[88vh] flex flex-col shadow-2xl">
        {/* Cabeçalho de Perfil com Banner e Foto */}
        <div className="relative bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 p-4 sm:p-6 pb-4 sm:pb-5 border-b border-zinc-800 shrink-0">
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
                className="w-full shadow-2xl ring-2 ring-zinc-700/80 rounded-lg"
              />
            </div>

            {/* Informações V (Público - Valor Exato) */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mb-1">
                <Badge
                  variant="outline"
                  className="bg-zinc-900/80 border-zinc-700 text-zinc-300 font-mono text-[10px] sm:text-xs flex items-center gap-1"
                >
                  {getCountryFlag(pilot.nationality)} {pilot.nationality}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-zinc-900/80 border-zinc-700 text-zinc-300 text-[10px] sm:text-xs uppercase"
                >
                  {pilot.category.toUpperCase()}
                </Badge>
                {isUserTeam && (
                  <Badge className="bg-red-600/20 text-red-400 border border-red-500/40 text-[10px] sm:text-xs">
                    Sua Equipe
                  </Badge>
                )}
              </div>

              <DialogTitle className="text-xl sm:text-3xl font-black tracking-tight text-white truncate">
                {pilot.name}
              </DialogTitle>

              <DialogDescription className="text-zinc-400 text-xs mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                <span>{pilot.age} anos</span>
                <span>•</span>
                <span className="text-zinc-200 font-medium">{currentTeamDisplay}</span>
                {pilot.role && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] uppercase py-0 px-2 ${
                      String(pilot.role).toLowerCase().includes('titular')
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : 'bg-blue-950 text-blue-300 border border-blue-800'
                    }`}
                  >
                    {pilot.role}
                  </Badge>
                )}
              </DialogDescription>

              {/* Destaque OVR / Reputação e Salário de Referência V (Regra R03 sem OVR na F1 Academy) */}
              <div className="mt-3.5 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <div className="flex items-center gap-2 bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-zinc-800">
                  <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold">
                    {pilot.category === 'f1_academy' ? 'Perfil MBJ' : 'Overall'}
                  </span>
                  <span
                    className={`font-black font-mono text-sm px-1.5 py-0.5 rounded ${
                      pilot.category === 'f1_academy'
                        ? 'bg-pink-950/40 text-pink-300 border border-pink-700/50'
                        : ovr >= 90
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : ovr >= 82
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
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

                <div className="flex items-center gap-1.5 bg-emerald-950/30 border border-emerald-800/40 px-3 py-1.5 rounded-lg text-emerald-300">
                  <DollarSign className="w-3.5 h-3.5" />
                  <div className="text-left leading-tight">
                    <div className="text-[10px] uppercase font-mono text-emerald-400/80">
                      Salário de Referência (USD)
                    </div>
                    <div className="font-bold font-mono text-xs">
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
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                14 Atributos Esportivos{' '}
                {isUserTeam ? '(Valores Exatos da Sua Equipe)' : '(Faixas Projetadas MBJ)'}
              </h4>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-zinc-700 text-zinc-400"
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
                      <span className="text-zinc-400 flex items-center gap-1.5">
                        <IconComponent className={`w-3.5 h-3.5 ${attr.color}`} /> {attr.name}
                      </span>
                      <span className="font-mono font-bold text-white">{display.label}</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden flex">
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
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Potencial Projetado de Carreira:</span>
              <span className="font-mono font-bold text-amber-300">
                {pilot.potentialMin} – {pilot.potentialMax} pts
              </span>
            </div>
          </div>

          {/* Seção 2: Estado Físico & Mental (Qualitativo para fora / Exato para jogador) */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              Estado Atual & Adaptação{' '}
              {isUserTeam ? '(Telemetria Interna)' : '(Avaliação Qualitativa)'}
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block mb-0.5">
                  Moral
                </span>
                <span className="font-bold text-white">
                  {getQualitativeState(pilot.moraleState ?? 75, 'morale')}
                </span>
              </div>
              <div className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block mb-0.5">
                  Confiança
                </span>
                <span className="font-bold text-white">
                  {getQualitativeState(pilot.confidence ?? 75, 'confidence')}
                </span>
              </div>
              <div className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block mb-0.5">
                  Condição Física
                </span>
                <span className="font-bold text-emerald-400">
                  {getQualitativeState(pilot.physicalCondition ?? 100, 'condition')}
                </span>
              </div>
              <div className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block mb-0.5">
                  Nível de Estresse
                </span>
                <span className="font-bold text-amber-400">
                  {getQualitativeState(pilot.stress ?? 25, 'stress')}
                </span>
              </div>
            </div>

            {/* Adaptações F1, Carro e Equipe */}
            <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px] text-zinc-400">
                  <span>Adaptação F1</span>
                  <span className="font-mono text-zinc-200 font-semibold">
                    {(pilot.adaptationF1 ?? 0) > 0
                      ? `${pilot.adaptationF1}% / meta 80%`
                      : getAttrDisplay(pilot.adaptationF1 ?? 80).label}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{ width: `${Math.min(100, ((pilot.adaptationF1 ?? 80) / 80) * 100)}%` }}
                  />
                </div>
              </div>{' '}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Adaptação Carro</span>
                  <span className="font-mono text-zinc-200">
                    {getAttrDisplay(pilot.adaptationCar ?? 80).label}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${pilot.adaptationCar ?? 80}%` }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Adaptação Equipe</span>
                  <span className="font-mono text-zinc-200">
                    {getAttrDisplay(pilot.adaptationTeam ?? 80).label}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full"
                    style={{ width: `${pilot.adaptationTeam ?? 80}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 3: Personalidade Canônica, Relações e Memórias (Implementação Nº 6A) */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                Personalidade Canônica & Estado Psicológico
              </h4>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-purple-700/50 text-purple-300 bg-purple-950/30"
              >
                Trait ≠ State (6A)
              </Badge>
            </div>

            {/* Tags Qualitativas da Personalidade */}
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1.5 font-semibold">
                Perfil de Personalidade (Traits Canônicos)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {descriptors.map((desc) => (
                  <Badge
                    key={desc}
                    className="bg-purple-950/70 border border-purple-700 text-purple-200 text-xs py-0.5 px-2.5 font-medium"
                  >
                    {desc}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Estado Psicológico Atual (Qualitativo) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[10px] uppercase font-mono text-zinc-400 block">
                  Satisfação
                </span>
                <span className="font-semibold text-emerald-400">
                  {psychAudit.qualitativeState.satisfaction}
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[10px] uppercase font-mono text-zinc-400 block">
                  Confiança
                </span>
                <span className="font-semibold text-blue-400">
                  {psychAudit.qualitativeState.confidence}
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[10px] uppercase font-mono text-zinc-400 block">
                  Pressão Sentida
                </span>
                <span className="font-semibold text-amber-400">
                  {psychAudit.qualitativeState.pressure}
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-[10px] uppercase font-mono text-zinc-400 block">
                  Frustração
                </span>
                <span className="font-semibold text-rose-400">
                  {psychAudit.qualitativeState.frustration}
                </span>
              </div>
            </div>

            {/* Relações Tridimensionais (Team Principal, Equipe, Companheiro) */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-2">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block font-semibold flex items-center gap-1.5">
                <Handshake className="w-3 h-3 text-cyan-400" /> Vínculos & Relações Internas
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {/* Relação com Team Principal */}
                <div className="p-2.5 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-1">
                  <div className="font-semibold text-zinc-200 flex items-center justify-between">
                    <span>Team Principal</span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {isUserTeam
                        ? `${psychAudit.relationships.teamPrincipal.trust}% Confiança`
                        : 'Vínculo Ativo'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Confiança:{' '}
                    <strong className="text-white">
                      {formatQualitativeState(
                        psychAudit.relationships.teamPrincipal.trust,
                        'trust',
                      )}
                    </strong>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Respeito:{' '}
                    <strong className="text-zinc-300">
                      {formatQualitativeState(
                        psychAudit.relationships.teamPrincipal.respect,
                        'confidence',
                      )}
                    </strong>
                  </div>
                </div>

                {/* Relação com a Equipe / Fábrica */}
                <div className="p-2.5 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-1">
                  <div className="font-semibold text-zinc-200 flex items-center justify-between">
                    <span>Equipe / Fábrica</span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {isUserTeam
                        ? `${psychAudit.relationships.team.technicalTrust}% Técnico`
                        : 'Vínculo'}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Pertencimento:{' '}
                    <strong className="text-white">
                      {formatQualitativeState(
                        psychAudit.relationships.team.belonging,
                        'satisfaction',
                      )}
                    </strong>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Desejo de Ficar:{' '}
                    <strong className="text-amber-300">
                      {formatQualitativeState(psychAudit.derivedDesireToStay, 'trust')}
                    </strong>
                  </div>
                </div>

                {/* Relação com Companheiro */}
                <div className="p-2.5 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-1">
                  <div className="font-semibold text-zinc-200 flex items-center justify-between">
                    <span>Companheiro</span>
                    {psychAudit.relationships.teammate && (
                      <Badge
                        variant="outline"
                        className="text-[9px] py-0 border-zinc-700 text-zinc-300 font-mono"
                      >
                        {psychAudit.relationships.teammate.status}
                      </Badge>
                    )}
                  </div>
                  {psychAudit.relationships.teammate ? (
                    <>
                      <div className="text-[11px] text-zinc-400 truncate">
                        {psychAudit.relationships.teammate.teammateName}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Respeito Mútuo:{' '}
                        <strong className="text-white">
                          {formatQualitativeState(
                            psychAudit.relationships.teammate.respect,
                            'confidence',
                          )}
                        </strong>
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-zinc-500 italic">Sem disputa direta ativa</div>
                  )}
                </div>
              </div>
            </div>

            {/* Memórias Relevantes Ativas */}
            {psychAudit.topActiveMemories.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-zinc-400 block font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" /> Memórias Recentes Relevantes
                </span>
                <div className="space-y-1.5">
                  {psychAudit.topActiveMemories.map((mem) => (
                    <div
                      key={mem.memoryId}
                      className="text-xs p-2 rounded bg-zinc-950/50 border border-zinc-800/70 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="text-zinc-200 font-medium">{mem.description}</div>
                        <div className="text-[10px] text-zinc-400">{mem.contextExplanation}</div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[9px] uppercase shrink-0 py-0 ${
                          mem.polarity === 'positive'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : mem.polarity === 'negative'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-zinc-800 text-zinc-300'
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
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
            <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
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
            let stageBadgeClass = 'bg-blue-950/70 border-blue-700 text-blue-300'

            if (age <= 21) {
              stageLabel = 'Desenvolvimento Rápido (Jovem)'
              stageBadgeClass = 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
            } else if (age <= 26) {
              stageLabel = 'Em Ascensão Técnica'
              stageBadgeClass = 'bg-cyan-950/70 border-cyan-700 text-cyan-300'
            } else if (age <= 31) {
              stageLabel = 'No Ápice de Carreira (Prime)'
              stageBadgeClass = 'bg-purple-950/70 border-purple-700 text-purple-300'
            } else if (age <= 34) {
              stageLabel = 'Estável / Pós-Pico'
              stageBadgeClass = 'bg-indigo-950/70 border-indigo-700 text-indigo-300'
            } else if (age <= 37) {
              stageLabel = 'Declínio Inicial / Veterano'
              stageBadgeClass = 'bg-amber-950/70 border-amber-700 text-amber-300'
            } else {
              stageLabel = 'Veterano Experiente'
              stageBadgeClass = 'bg-rose-950/70 border-rose-700 text-rose-300'
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
              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    Carreira & Desenvolvimento (8B)
                  </h4>
                  <Badge variant="outline" className={`text-[10px] font-mono ${stageBadgeClass}`}>
                    {stageLabel}
                  </Badge>
                </div>

                {retirementAlert && (
                  <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-800/80 text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <span>{retirementAlert}</span>
                  </div>
                )}

                {/* Tendência dos atributos qualitativa (Regra 94) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-[10px] uppercase text-zinc-500 block">Ritmo Puro</span>
                    <span className="font-bold text-zinc-200">
                      {age <= 24
                        ? 'Pace ↑ (Em alta)'
                        : age <= 33
                          ? 'Pace → (Estável)'
                          : 'Pace ↘ (Declínio gradual)'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-[10px] uppercase text-zinc-500 block">Consistência</span>
                    <span className="font-bold text-zinc-200">
                      {age <= 30 ? 'Consistência ↑' : 'Consistência → (Forte)'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-[10px] uppercase text-zinc-500 block">
                      Feedback Técnico
                    </span>
                    <span className="font-bold text-emerald-400">
                      {age >= 32 ? 'Feedback ★ (Elite)' : 'Feedback ↑ (Em expansão)'}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-[10px] uppercase text-zinc-500 block">
                      Gestão de Pneus
                    </span>
                    <span className="font-bold text-cyan-400">
                      {age >= 26 ? 'Gestão ↑ (Maturidade)' : 'Gestão → (Aprendizado)'}
                    </span>
                  </div>
                </div>

                {/* Histórico recente de desenvolvimento se disponível */}
                {devHist.length > 0 && (
                  <div className="pt-1 text-[11px] text-zinc-400 space-y-1">
                    <div className="flex items-center gap-1 font-semibold text-zinc-300">
                      <History className="w-3 h-3 text-zinc-400" /> Evolução Recente Auditada:
                    </div>
                    <p className="italic text-zinc-300 leading-relaxed bg-zinc-950/40 p-2 rounded border border-zinc-800/60">
                      "{devHist[0]?.evolutionNarrative || 'Performance técnica consolidada.'}"
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Seção 4: Carreira & Histórico (V) — CARREIRA NA F1 */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              CARREIRA NA F1
            </h4>

            {/* Grid Canônico de Estatísticas de Carreira na F1 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-center">
                <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-400 block">
                  GPs
                </span>
                <strong className="text-lg font-black font-mono text-white">
                  {careerStats.races}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-center">
                <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-400 block">
                  Vitórias
                </span>
                <strong className="text-lg font-black font-mono text-emerald-400">
                  {careerStats.wins}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-center">
                <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-400 block">
                  Pole Positions
                </span>
                <strong className="text-lg font-black font-mono text-amber-400">
                  {careerStats.poles}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-center">
                <span className="text-[10px] uppercase tracking-wider font-mono text-zinc-400 block">
                  Títulos Mundiais
                </span>
                <strong className="text-lg font-black font-mono text-yellow-400">
                  {careerStats.championships}
                </strong>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed pt-1">{biography}</p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] font-mono text-zinc-400 border-t border-zinc-800/60">
              <span>
                Pontos Superlicença:{' '}
                <strong className="text-white">{pilot.superlicensePoints}</strong>
              </span>
              {pilot.preferredNumber && (
                <>
                  <span>•</span>
                  <span>
                    Número Preferido:{' '}
                    <strong className="text-amber-400 font-bold">#{pilot.preferredNumber}</strong>
                  </span>
                </>
              )}
              {pilot.operatingTeam && (
                <>
                  <span>•</span>
                  <span>
                    Equipe Operadora:{' '}
                    <strong className="text-pink-400">{pilot.operatingTeam}</strong>
                  </span>
                </>
              )}
              {pilot.supporterBrand && (
                <>
                  <span>•</span>
                  <span>
                    Apoiadora de Marca:{' '}
                    <strong className="text-purple-400">{pilot.supporterBrand}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
          {/* Seção 5: Situação Contratual & Elegibilidade MBJ */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
              Situação & Elegibilidade Contratual
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-1">
                <span className="text-zinc-400 text-[11px]">Vínculo Atual:</span>
                <div className="font-bold text-white">{currentTeamDisplay}</div>
                <div className="text-[11px] text-zinc-400">{contractTermDisplay}</div>
                <div className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/60 mt-1 flex justify-between items-center">
                  <span>Papel Contratual:</span>
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] border-zinc-700 text-zinc-300"
                  >
                    {canonicalContract?.role ||
                      (pilot.role === 'titular' ? 'EQUAL_STATUS' : 'RESERVE')}
                  </Badge>
                </div>
                {pilot.exitClauseUsd && (
                  <div className="text-[11px] text-zinc-400 flex justify-between">
                    <span>Multa Rescisória (P):</span>
                    <span className="font-mono font-bold text-zinc-300">
                      {formatUsdCurrency(
                        canonicalContract?.buyoutClause?.buyoutAmount || pilot.exitClauseUsd,
                        'full',
                      )}
                    </span>
                  </div>
                )}
                {pilot.winBonusUsd && (
                  <div className="text-[11px] text-zinc-400 flex justify-between">
                    <span>Bônus por Vitória (P):</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {formatUsdCurrency(pilot.winBonusUsd, 'full')}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-1.5">
                <span className="text-zinc-400 text-[11px]">
                  Status Regulamentar FIA / Elegibilidade MBJ:
                </span>
                <div className="flex items-center gap-1 font-bold text-white">
                  {isHomologation && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Exige Homologação FIA (TL1 100 km)
                    </span>
                  )}
                  {!isHomologation && (eligibility.status as string) === 'academia' && (
                    <span className="text-purple-400 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" />{' '}
                      {pilot.eligibilityStatus || eligibility.label}
                    </span>
                  )}
                  {!isHomologation && (eligibility.status as string) === 'homologacao' && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />{' '}
                      {pilot.eligibilityStatus || 'TESTE HOMOLOGAÇÃO MBJ'}
                    </span>
                  )}
                  {!isHomologation && (eligibility.status as string) === 'elegivel' && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />{' '}
                      {pilot.eligibilityStatus || 'Superlicença Válida FIA'}
                    </span>
                  )}
                </div>

                {/* CAMINHO PARA A F1 (Regra 15 do PDF):
                    Formato: "Homologação FIA: 3/4 testes — Quilometragem: 1.086/1.200 km — Avaliação atual: 81 — Status: Licença Provisória" */}
                <div className="p-2.5 bg-slate-950/70 border border-indigo-900/60 rounded-md space-y-1.5 my-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-indigo-300 font-semibold uppercase tracking-wider text-[10px]">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Caminho para a F1
                    </span>
                    <Badge
                      variant="outline"
                      className="border-indigo-700 text-indigo-200 text-[9px]"
                    >
                      {pilot.speed >= 85
                        ? 'Licença A (Super Licença)'
                        : pilot.speed >= 75
                          ? 'Licença B (Provisória)'
                          : 'Licença C (Autorização)'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-800">
                    <div>
                      <span className="text-slate-400 block">Homologação FIA:</span>
                      <strong className="text-white">
                        {isHomologation ? `${homologationSessions}/4 testes` : '4/4 testes'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Quilometragem:</span>
                      <strong className="text-white">
                        {isHomologation
                          ? `${homologationSessions * 310}/1.200 km`
                          : '1.200/1.200 km'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Avaliação FIA:</span>
                      <strong className="text-amber-400">{pilot.speed || 80}/100</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Status Regulamentar:</span>
                      <strong className="text-emerald-400">
                        {pilot.speed >= 85 ? 'Super Licença' : 'Licença Provisória'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400">{eligibility.description}</div>
              </div>
            </div>

            {pilot.nextTeamId && (
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Pré-contrato firmado para 2027 como piloto {pilot.nextContractRole || 'titular'}.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé Fixo com Botão de Ação e Ações Contextuais por Papel */}
        <div className="p-3 sm:p-4 bg-zinc-900 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs h-8"
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
                  className="border-amber-500/40 text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 text-xs h-8"
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
                  className="border-emerald-500/40 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 text-xs h-8"
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
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs h-8"
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
              className="bg-red-600 hover:bg-red-700 text-white font-medium flex items-center gap-1.5 shadow-lg text-xs h-8"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {canPreContract ? 'Propor Pré-contrato / Contrato' : 'Propor Contrato (US$)'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PilotProfileDialog
