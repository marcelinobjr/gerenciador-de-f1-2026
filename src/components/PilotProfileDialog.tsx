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
import { checkEligibility, getOverallRating } from '@/lib/mbj-drivers-data'
import {
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
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
} from 'lucide-react'
import type { UnifiedDriverItem } from '@/pages/DriversPage'

export interface PilotProfileDialogProps {
  pilot: UnifiedDriverItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenContractModal: (pilot: UnifiedDriverItem) => void
  currentRound?: number
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
}) => {
  if (!pilot) return null

  const ovr = getOverallRating(pilot)
  const eligibility = checkEligibility(pilot)
  const isUserTeam = pilot.isPlayerDriver
  const canPreContract = currentRound >= 12

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

  const speedData = getAttrDisplay(pilot.speed)
  const consistencyData = getAttrDisplay(pilot.consistency)
  const rainData = getAttrDisplay(pilot.rain)
  const defenseData = getAttrDisplay(pilot.defense)

  const traits = getDriverTraits(pilot)
  const biography = getDriverBiography(pilot)

  // Status/vínculo do piloto
  const currentTeamDisplay = pilot.teamName || 'Agente Livre (Sem equipe)'
  const contractTermDisplay =
    pilot.contractEnd && pilot.contractEnd >= 2026
      ? `Até o fim de ${pilot.contractEnd}`
      : 'Sem vínculo vigente'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-zinc-950 border border-zinc-800 text-zinc-100 p-0 overflow-hidden max-h-[92vh] flex flex-col shadow-2xl">
        {/* Cabeçalho de Perfil com Banner e Foto */}
        <div className="relative bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 p-6 pb-5 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Foto Grande do Piloto */}
            <div className="w-28 sm:w-32 shrink-0">
              <DriverPoster
                name={pilot.name}
                aspectRatio="poster"
                className="w-full shadow-2xl ring-2 ring-zinc-700/80 rounded-lg"
              />
            </div>

            {/* Informações V (Público - Valor Exato) */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <Badge
                  variant="outline"
                  className="bg-zinc-900/80 border-zinc-700 text-zinc-300 font-mono text-xs flex items-center gap-1"
                >
                  {getCountryFlag(pilot.nationality)} {pilot.nationality}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-zinc-900/80 border-zinc-700 text-zinc-300 text-xs uppercase"
                >
                  {pilot.category.toUpperCase()}
                </Badge>
                {isUserTeam && (
                  <Badge className="bg-red-600/20 text-red-400 border border-red-500/40 text-xs">
                    Sua Equipe
                  </Badge>
                )}
              </div>

              <DialogTitle className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {pilot.name}
              </DialogTitle>

              <DialogDescription className="text-zinc-400 text-xs mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span>{pilot.age} anos</span>
                <span>•</span>
                <span className="text-zinc-200 font-medium">{currentTeamDisplay}</span>
                {pilot.role && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] uppercase py-0 px-2 ${
                      pilot.role === 'titular'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : 'bg-blue-950 text-blue-300 border border-blue-800'
                    }`}
                  >
                    {pilot.role}
                  </Badge>
                )}
              </DialogDescription>

              {/* Destaque OVR / Reputação e Salário de Referência V */}
              <div className="mt-3.5 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <div className="flex items-center gap-2 bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-zinc-800">
                  <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold">
                    Overall
                  </span>
                  <span
                    className={`font-black font-mono text-sm px-1.5 py-0.5 rounded ${
                      ovr >= 90
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : ovr >= 82
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {isUserTeam ? ovr : `${Math.max(50, ovr - 2)}–${Math.min(99, ovr + 2)}`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-emerald-950/30 border border-emerald-800/40 px-3 py-1.5 rounded-lg text-emerald-300">
                  <DollarSign className="w-3.5 h-3.5" />
                  <div className="text-left leading-tight">
                    <div className="text-[10px] uppercase font-mono text-emerald-400/80">
                      Salário de Referência (USD)
                    </div>
                    <div className="font-bold font-mono text-xs">
                      {formatUsdCurrency(pilot.salaryUsd, 'full')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Corpo do Perfil Rolável */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {/* Seção 1: Atributos Esportivos (Regra P / V) */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-800">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                Atributos Esportivos{' '}
                {isUserTeam ? '(Visão Interna Exata)' : '(Faixa Estimada de Olheiro)'}
              </h4>
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-zinc-700 text-zinc-400"
              >
                {isUserTeam ? 'Vínculo Pleno' : 'Projeção MBJ'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Velocidade */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" /> Velocidade
                  </span>
                  <span className="font-mono font-bold text-white">{speedData.label}</span>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (speedData.max / 100) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Consistência */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-blue-400" /> Consistência
                  </span>
                  <span className="font-mono font-bold text-white">{consistencyData.label}</span>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (consistencyData.max / 100) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Ritmo na Chuva */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <CloudRain className="w-3 h-3 text-cyan-400" /> Habilidade na Chuva
                  </span>
                  <span className="font-mono font-bold text-white">{rainData.label}</span>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (rainData.max / 100) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Defesa e Ultrapassagem */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" /> Defesa de Posição
                  </span>
                  <span className="font-mono font-bold text-white">{defenseData.label}</span>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (defenseData.max / 100) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Potencial Projetado P */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Potencial Projetado de Carreira:</span>
              <span className="font-mono font-bold text-amber-300">
                {pilot.potentialMin} – {pilot.potentialMax} pts
              </span>
            </div>
          </div>

          {/* Seção 2: Perfil & Personalidade (Visível + Traços) */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-2.5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              Traços & Personalidade Conhecida
            </h4>
            <div className="flex flex-wrap gap-2 pt-1">
              {traits.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="bg-zinc-800/80 border-zinc-700 text-zinc-200 text-xs py-1 px-2.5"
                >
                  {t}
                </Badge>
              ))}
            </div>
            {/* Oculto O em formato qualitativo seguro */}
            <div className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1.5 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
              <Lock className="w-3 h-3 text-zinc-500 shrink-0" />
              <span>
                Parâmetros ocultos de desenvolvimento, tolerância à fadiga e curva de declínio
                operam sob a regra confidencial do Banco MBJ.
              </span>
            </div>
          </div>

          {/* Seção 3: Carreira & Histórico */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Trajetória & Carreira
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">{biography}</p>
            <div className="flex items-center gap-4 pt-2 text-[11px] font-mono text-zinc-400">
              <span>
                GPs F1 Disputados: <strong className="text-white">{pilot.f1RacesCompleted}</strong>
              </span>
              <span>•</span>
              <span>
                Pontos Superlicença:{' '}
                <strong className="text-white">{pilot.superlicensePoints}</strong>
              </span>
            </div>
          </div>

          {/* Seção 4: Situação Contratual & Elegibilidade FIA */}
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
              </div>

              <div className="p-2.5 bg-zinc-950/60 rounded-lg border border-zinc-800 space-y-1">
                <span className="text-zinc-400 text-[11px]">Status Regulamentar FIA:</span>
                <div className="flex items-center gap-1 font-bold text-white">
                  {eligibility.status === 'academia' && (
                    <span className="text-purple-400 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" /> {eligibility.label}
                    </span>
                  )}
                  {eligibility.status === 'homologacao' && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Exige Homologação
                    </span>
                  )}
                  {eligibility.status === 'elegivel' && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Superlicença Válida
                    </span>
                  )}
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

        {/* Rodapé Fixo com Botão de Ação */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Fechar
          </Button>

          {isUserTeam ? (
            <Button disabled className="bg-zinc-800 text-zinc-400 border border-zinc-700">
              Piloto sob Contrato Ativo na Equipe
            </Button>
          ) : (
            <Button
              onClick={() => {
                onOpenChange(false)
                onOpenContractModal(pilot)
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-medium flex items-center gap-2 shadow-lg"
            >
              <UserPlus className="w-4 h-4" />
              {canPreContract ? 'Propor Pré-contrato / Contrato' : 'Propor Contrato (US$)'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PilotProfileDialog
