import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { OFFICIAL_GRID_TEAMS, OfficialGridTeam, ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import {
  Flag,
  Shield,
  Sparkles,
  Zap,
  Users,
  Check,
  Building2,
  PlusCircle,
  HelpCircle,
  ChevronRight,
  TrendingUp,
  Award,
  AlertCircle,
  Gauge,
  Layers,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

export default function TeamSelectionPage() {
  const { user, team, isLoading, refreshTeamAndSeason } = useAuth()
  const navigate = useNavigate()

  // If user is not logged in, send to auth
  React.useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth', { replace: true })
    } else if (!isLoading && team) {
      // If user already has a team, send to dashboard
      navigate('/', { replace: true })
    }
  }, [user, team, isLoading, navigate])

  const [activeTab, setActiveTab] = useState<'existing' | 'custom'>('existing')

  // Selected existing team for confirmation modal
  const [selectedOfficialTeam, setSelectedOfficialTeam] = useState<OfficialGridTeam | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Custom team form state
  const [customName, setCustomName] = useState('')
  const [customEngine, setCustomEngine] = useState<'Ferrari' | 'Mercedes' | 'Honda' | 'Ford'>(
    'Mercedes',
  )
  const [customColor, setCustomColor] = useState('#E10600')
  const [customNameError, setCustomNameError] = useState('')

  // Handle selecting an official team
  const handleConfirmOfficial = async () => {
    if (!selectedOfficialTeam || !user) return
    setIsSubmitting(true)
    try {
      await f1Service.initializeOfficialTeam(user.id, selectedOfficialTeam.key, {
        name: selectedOfficialTeam.name,
        color: selectedOfficialTeam.color,
        engine: selectedOfficialTeam.engine,
        strength: selectedOfficialTeam.strength,
        carLevel: selectedOfficialTeam.carLevel,
        budget: selectedOfficialTeam.budget,
        driver1: {
          name: selectedOfficialTeam.driver1.name,
          nationality: selectedOfficialTeam.driver1.nationality,
          age: selectedOfficialTeam.driver1.age,
          speed: selectedOfficialTeam.driver1.speed,
          consistency: selectedOfficialTeam.driver1.consistency,
          rain: selectedOfficialTeam.driver1.rain,
          defense: selectedOfficialTeam.driver1.defense,
          salary: selectedOfficialTeam.driver1.salary,
        },
        driver2: {
          name: selectedOfficialTeam.driver2.name,
          nationality: selectedOfficialTeam.driver2.nationality,
          age: selectedOfficialTeam.driver2.age,
          speed: selectedOfficialTeam.driver2.speed,
          consistency: selectedOfficialTeam.driver2.consistency,
          rain: selectedOfficialTeam.driver2.rain,
          defense: selectedOfficialTeam.driver2.defense,
          salary: selectedOfficialTeam.driver2.salary,
        },
      })

      await refreshTeamAndSeason()

      toast({
        title: `Você assumiu a ${selectedOfficialTeam.name}!`,
        description: `Os pilotos titulares ${selectedOfficialTeam.driver1.name} e ${selectedOfficialTeam.driver2.name} estão à sua disposição.`,
      })

      navigate('/')
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao inicializar equipe',
        description: err?.message || 'Falha ao associar a equipe.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle creating the 12th custom team
  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const trimmed = customName.trim()
    if (!trimmed) {
      setCustomNameError('Por favor, informe o nome da sua escuderia.')
      return
    }
    if (trimmed.length < 3) {
      setCustomNameError('O nome deve ter no mínimo 3 caracteres.')
      return
    }
    if (trimmed.length > 35) {
      setCustomNameError('O nome deve ter no máximo 35 caracteres.')
      return
    }

    // Check if name conflicts with existing teams
    const conflict = OFFICIAL_GRID_TEAMS.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    if (conflict) {
      setCustomNameError('Já existe uma equipe oficial com esse nome.')
      return
    }

    setCustomNameError('')
    setIsSubmitting(true)
    try {
      await f1Service.initializeCustomTeam(user.id, trimmed, customEngine, customColor)
      await refreshTeamAndSeason()

      toast({
        title: 'Escuderia Criada com Sucesso!',
        description: `A ${trimmed} ingressou como a 12ª equipe do grid da F1 2026. Agora contrate seus pilotos no mercado!`,
      })

      navigate('/team')
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar equipe',
        description: err?.message || 'Falha ao registrar nova escuderia.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helper for strength badge styling
  const getStrengthBadge = (strength: number) => {
    if (strength >= 88) {
      return {
        label: 'Dominante (Tier 1)',
        color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
      }
    }
    if (strength >= 80) {
      return {
        label: 'Ponta (Tier 2)',
        color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
      }
    }
    if (strength >= 70) {
      return {
        label: 'Pelotão Intermediário (Tier 3)',
        color: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
      }
    }
    return {
      label: 'Em Desenvolvimento / Estreante (Tier 4)',
      color: 'text-zinc-400 border-zinc-500/40 bg-zinc-500/10',
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F5F7FA] py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
        {/* Header */}
        <div className="text-center space-y-3 pb-4 border-b border-[#1F2733]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E10600]/10 border border-[#E10600]/30 text-[#E10600] text-xs font-mono font-bold uppercase tracking-widest">
            <Flag className="w-3.5 h-3.5" /> Temporada F1 2026 • Novo Regulamento Híbrido 50/50
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F5F7FA]">
            Escolha seu Destino na Fórmula 1
          </h1>
          <p className="text-sm sm:text-base text-[#8B95A7] max-w-2xl mx-auto">
            Você pode comandar uma das{' '}
            <strong className="text-[#F5F7FA]">11 escuderias oficiais</strong> já consagradas (com
            seus pilotos titulares reais) ou registrar a{' '}
            <strong className="text-[#00A6FB]">12ª equipe própria do grid</strong>, contratando
            talentos fora do grid e construindo seu legado do zero.
          </p>
        </div>

        {/* Selection Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#11161F] border border-[#1F2733] h-13 p-1">
            <TabsTrigger
              value="existing"
              className="data-[state=active]:bg-[#E10600] data-[state=active]:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 py-2.5"
            >
              <Building2 className="w-4 h-4" />
              Operar Equipe Existente (11 Equipes Reais)
            </TabsTrigger>
            <TabsTrigger
              value="custom"
              className="data-[state=active]:bg-[#00A6FB] data-[state=active]:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 py-2.5"
            >
              <PlusCircle className="w-4 h-4" />
              Criar Equipe Própria (12ª do Grid)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: 11 EQUIPES REAIS */}
          <TabsContent value="existing" className="space-y-6 pt-4">
            <div className="p-4 rounded-xl bg-[#11161F] border border-[#1F2733] text-xs text-[#8B95A7] flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#F5F7FA] block text-sm">
                  Sistema de Força & Situação 2026:
                </strong>
                A força de cada equipe (rating 0-100) é calibrada combinando o momento recente das
                temporadas 2024-2025 com o prestígio e infraestrutura histórica. Ao escolher uma
                equipe, você herda seus pilotos titulares, peças calibradas e orçamento inicial.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {OFFICIAL_GRID_TEAMS.map((team) => {
                const tierInfo = getStrengthBadge(team.strength)
                return (
                  <Card
                    key={team.key}
                    className="bg-[#11161F] border-[#1F2733] hover:border-[#E10600]/60 transition-all duration-200 flex flex-col justify-between"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full shrink-0 shadow"
                            style={{ backgroundColor: team.color }}
                          />
                          <div>
                            <CardTitle className="text-base sm:text-lg font-bold text-[#F5F7FA]">
                              {team.name}
                            </CardTitle>
                            <span className="text-xs font-mono text-[#8B95A7]">
                              Motor {team.engine} • 50/50 Híbrido
                            </span>
                          </div>
                        </div>

                        {/* Rating Badge */}
                        <div className="text-right shrink-0">
                          <div className="flex items-baseline justify-end gap-1 font-mono">
                            <span className="text-2xl font-black text-[#F5F7FA]">
                              {team.strength}
                            </span>
                            <span className="text-[10px] text-[#8B95A7]">/100</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-mono px-1.5 py-0 h-4 ${tierInfo.color}`}
                          >
                            Força {team.strength}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3.5 text-xs">
                      {/* Situação Atual */}
                      <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#1F2733]/80 space-y-1">
                        <span className="text-[10px] uppercase font-mono font-bold text-[#00A6FB] block">
                          Situação no Campeonato & História:
                        </span>
                        <p className="text-[#F5F7FA] leading-relaxed font-sans">
                          {team.currentSituation}
                        </p>
                        <p className="text-[#8B95A7] text-[11px] font-sans italic">
                          {team.historySummary}
                        </p>
                      </div>

                      {/* Pilotos Titulares */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono text-[#8B95A7] block">
                          Dupla Titular Inclusa:
                        </span>
                        <div className="grid grid-cols-2 gap-2 font-mono">
                          <div className="p-2 rounded bg-[#161D29]/70 border border-[#1F2733] flex items-center justify-between">
                            <span className="text-[#F5F7FA] font-bold truncate">
                              {team.driver1.flag} {team.driver1.name}
                            </span>
                            <span className="text-[#00A6FB] text-[11px] ml-1">
                              {team.driver1.speed} VEL
                            </span>
                          </div>
                          <div className="p-2 rounded bg-[#161D29]/70 border border-[#1F2733] flex items-center justify-between">
                            <span className="text-[#F5F7FA] font-bold truncate">
                              {team.driver2.flag} {team.driver2.name}
                            </span>
                            <span className="text-[#00A6FB] text-[11px] ml-1">
                              {team.driver2.speed} VEL
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Budget */}
                      <div className="flex justify-between items-center pt-1 font-mono text-xs text-[#8B95A7]">
                        <span>Orçamento Base:</span>
                        <strong className="text-[#22C55E]">{formatCurrency(team.budget)}</strong>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-2 border-t border-[#1F2733]/60">
                      <Button
                        onClick={() => setSelectedOfficialTeam(team)}
                        className="w-full bg-[#161D29] hover:bg-[#E10600] text-[#F5F7FA] hover:text-white border border-[#1F2733] font-bold text-xs h-9 transition-colors"
                      >
                        Assumir {team.name}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* TAB 2: CRIAR PRÓPRIA EQUIPE (12ª DO GRID) */}
          <TabsContent value="custom" className="space-y-6 pt-4">
            <Card className="bg-[#11161F] border-[#1F2733] max-w-2xl mx-auto shadow-2xl">
              <CardHeader>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#00A6FB]/10 border border-[#00A6FB]/30 text-[#00A6FB] text-xs font-mono font-bold uppercase w-fit">
                  <Sparkles className="w-3.5 h-3.5" /> A 12ª Escuderia da F1 2026
                </div>
                <CardTitle className="text-xl font-bold text-[#F5F7FA]">
                  Crie sua Própria Equipe
                </CardTitle>
                <CardDescription className="text-xs text-[#8B95A7]">
                  Como nova equipe estreante, você começa sem pilotos titulares e com força inicial
                  modesta (~55), devendo garimpar talentos disponíveis e evoluir seu carro no P&D.
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleCreateCustom}>
                <CardContent className="space-y-6">
                  {/* Nome da equipe */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="customName"
                      className="text-xs font-mono uppercase text-[#8B95A7]"
                    >
                      Nome Oficial da Escuderia *
                    </Label>
                    <Input
                      id="customName"
                      placeholder="Ex: Escuderia Brasil, Andretti Global, Puma Racing..."
                      value={customName}
                      onChange={(e) => {
                        setCustomName(e.target.value)
                        setCustomNameError('')
                      }}
                      className="bg-[#0B0E14] border-[#1F2733] text-[#F5F7FA] text-sm focus-visible:ring-[#00A6FB]"
                    />
                    {customNameError && (
                      <p className="text-xs text-red-400 font-mono">{customNameError}</p>
                    )}
                  </div>

                  {/* Cor da equipe */}
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase text-[#8B95A7]">
                      Cor Principal da Pintura (Livery)
                    </Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer bg-transparent border border-[#1F2733] p-1"
                      />
                      <span className="font-mono text-xs text-[#8B95A7]">{customColor}</span>
                      <div
                        className="px-3 py-1 rounded text-xs font-bold text-white shadow"
                        style={{ backgroundColor: customColor }}
                      >
                        {customName || 'Sua Equipe'}
                      </div>
                    </div>
                  </div>

                  {/* Fornecedor de Motor 50/50 */}
                  <div className="space-y-3">
                    <Label className="text-xs font-mono uppercase text-[#8B95A7]">
                      Fornecedor de Unidade de Potência 50/50 *
                    </Label>
                    <RadioGroup
                      value={customEngine}
                      onValueChange={(val) => setCustomEngine(val as any)}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    >
                      {ENGINE_SUPPLIERS.map((eng) => (
                        <div
                          key={eng.name}
                          onClick={() => setCustomEngine(eng.name)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            customEngine === eng.name
                              ? 'border-[#00A6FB] bg-[#00A6FB]/10 text-white'
                              : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7] hover:border-[#1F2733]/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-[#F5F7FA]">{eng.name}</span>
                            <RadioGroupItem value={eng.name} id={eng.name} />
                          </div>
                          <span className="text-[11px] font-mono text-[#00A6FB] block mt-1">
                            {eng.techBadge}
                          </span>
                          <div className="flex justify-between text-[10px] font-mono text-[#8B95A7] mt-2">
                            <span>
                              Potência: <strong className="text-[#F5F7FA]">{eng.power}</strong>
                            </span>
                            <span>
                              Confiabilidade:{' '}
                              <strong className="text-[#F5F7FA]">{eng.reliability}%</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Detalhes da Condição Inicial como 12ª equipe */}
                  <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-2 text-xs font-mono">
                    <div className="text-amber-400 font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> Condições da Estreante 2026:
                    </div>
                    <ul className="space-y-1 text-[#8B95A7] list-disc list-inside">
                      <li>
                        Força base inicial de <strong>55/100</strong> (Pelotão de fundo para
                        evoluir).
                      </li>
                      <li>
                        Orçamento inicial de <strong>{formatCurrency(130000000)}</strong>.
                      </li>
                      <li>
                        <strong>Sem pilotos titulares iniciais</strong>: ao entrar, você acessa o
                        mercado para contratar 2 pilotos livres (como Drugovich, Bottas, Schumacher,
                        Maloney, Aron...).
                      </li>
                      <li>Peças nível 4 em desenvolvimento de chassi e aerodinâmica ativa.</li>
                    </ul>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t border-[#1F2733]">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#00A6FB] hover:bg-[#0090DA] text-white font-bold h-10 shadow-lg shadow-[#00A6FB]/25"
                  >
                    {isSubmitting
                      ? 'Homologando nova escuderia...'
                      : 'Fundar Equipe e Ingressar na F1 2026'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirmation Modal for Official Team */}
      <Dialog
        open={!!selectedOfficialTeam}
        onOpenChange={(open) => !open && setSelectedOfficialTeam(null)}
      >
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: selectedOfficialTeam?.color }}
              />
              Confirmar Escolha de Escuderia
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Você está prestes a se tornar o Chefe de Equipe da {selectedOfficialTeam?.name}.
            </DialogDescription>
          </DialogHeader>

          {selectedOfficialTeam && (
            <div className="space-y-3 py-2 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Escuderia:</span>
                  <strong className="text-[#F5F7FA] text-sm">{selectedOfficialTeam.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Força Atual (Rating):</span>
                  <strong className="text-amber-400 font-bold">
                    {selectedOfficialTeam.strength}/100
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Motor Regulamento 2026:</span>
                  <span className="text-[#00A6FB]">
                    {selectedOfficialTeam.engine} (50/50 Híbrido)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Pilotos Titulares:</span>
                  <span className="text-[#F5F7FA]">
                    {selectedOfficialTeam.driver1.name} & {selectedOfficialTeam.driver2.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Orçamento Inicial:</span>
                  <strong className="text-[#22C55E]">
                    {formatCurrency(selectedOfficialTeam.budget)}
                  </strong>
                </div>
              </div>

              <p className="text-[11px] text-[#8B95A7] leading-relaxed">
                As outras 10 equipes continuarão no campeonato sendo controladas pela IA, competindo
                com seus respectivos atributos e pilotos oficiais.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedOfficialTeam(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirmOfficial}
              disabled={isSubmitting}
              className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-bold"
            >
              {isSubmitting ? 'Configurando...' : 'Confirmar e Assumir Escuderia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
