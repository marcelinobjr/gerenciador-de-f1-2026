import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { OFFICIAL_GRID_TEAMS, OfficialGridTeam, ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import { formatTeamCreationError } from '@/lib/pocketbase/errors'
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
  const { user, refreshTeamAndSeason, team } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'existing' | 'custom'>('existing')

  // Estado local para equipe existente pré-carregada e estado de erro de verificação prévia
  const [existingUserTeam, setExistingUserTeam] = useState<any>(team || null)
  const [isCheckingTeam, setIsCheckingTeam] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  // Se o usuário autenticado já possui equipe (via useAuth().team ou consulta), atualiza estado e redireciona
  React.useEffect(() => {
    let isMounted = true

    async function checkExistingTeam() {
      if (team) {
        setExistingUserTeam(team)
        setCheckError(null)
        return
      }

      const effectiveUserId =
        user?.id || (await import('@/lib/pocketbase/client')).default.authStore.record?.id
      if (effectiveUserId) {
        setIsCheckingTeam(true)
        try {
          const existing = await f1Service.getPlayerTeam(effectiveUserId)
          if (isMounted) {
            setExistingUserTeam(existing)
            setCheckError(null)
            if (existing) {
              await refreshTeamAndSeason()
            }
          }
        } catch (e) {
          console.warn('[TeamSelectionPage] Erro ao verificar equipe existente:', e)
          if (isMounted) {
            setCheckError(
              'Instabilidade ao conectar com os servidores de carreira. Verifique sua conexão antes de criar uma equipe.',
            )
          }
        } finally {
          if (isMounted) {
            setIsCheckingTeam(false)
          }
        }
      }
    }

    checkExistingTeam()

    return () => {
      isMounted = false
    }
  }, [user?.id, team, refreshTeamAndSeason])

  // Função helper de navegação direta à carreira sem nenhum POST
  const handleLoadExistingCareer = async (targetTeam?: any) => {
    const t = targetTeam || existingUserTeam || team
    try {
      await refreshTeamAndSeason()
    } catch (_) {
      // ignore
    }
    toast({
      title: 'Carreira Carregada',
      description: t?.name
        ? `Acessando o comando da ${t.name}...`
        : 'Acessando a central de comando da sua carreira...',
    })
    navigate('/', { replace: true })
  }

  // Selected existing team for confirmation modal
  const [selectedOfficialTeam, setSelectedOfficialTeam] = useState<OfficialGridTeam | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Custom team form state
  const [customName, setCustomName] = useState('')
  const [customEngine, setCustomEngine] = useState<
    'Ferrari' | 'Mercedes' | 'Honda' | 'Ford' | 'Audi'
  >('Mercedes')
  const [customColor, setCustomColor] = useState('#E10600')
  const [customNameError, setCustomNameError] = useState('')

  // Handle selecting an official team
  const handleConfirmOfficial = async () => {
    if (!selectedOfficialTeam) return

    // Se o usuário já possui equipe ativa (via state ou auth), redireciona direto sem POST
    const activeKnownTeam = existingUserTeam || team
    if (activeKnownTeam) {
      handleLoadExistingCareer(activeKnownTeam)
      return
    }

    const effectiveUserId =
      user?.id || (await import('@/lib/pocketbase/client')).default.authStore.record?.id
    if (!effectiveUserId) return

    setIsSubmitting(true)

    // Guard fail-safe: verificação prévia explícita com tratamento de erro de consulta
    let preExisting = null
    try {
      preExisting = await f1Service.getPlayerTeam(effectiveUserId)
    } catch (queryErr) {
      // Falha na verificação prévia NÃO segue para criação! NUNCA chama create() após falha de consulta.
      setIsSubmitting(false)
      setCheckError(
        'Não foi possível verificar sua carreira existente devido a uma falha de conexão.',
      )
      toast({
        variant: 'destructive',
        title: 'Falha de Conexão',
        description:
          'Não foi possível verificar suas equipes existentes. Toque em "Tentar Novamente" ou "Carregar Carreira".',
      })
      return
    }

    if (preExisting) {
      setExistingUserTeam(preExisting)
      setIsSubmitting(false)
      handleLoadExistingCareer(preExisting)
      return
    }

    try {
      const activeTeam = await f1Service.initializeOfficialTeam(
        effectiveUserId,
        selectedOfficialTeam.key,
        {
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
          reserveDriver: {
            name: selectedOfficialTeam.reserveDriver.name,
            nationality: selectedOfficialTeam.reserveDriver.nationality,
            age: selectedOfficialTeam.reserveDriver.age,
            speed: selectedOfficialTeam.reserveDriver.speed,
            consistency: selectedOfficialTeam.reserveDriver.consistency,
            rain: selectedOfficialTeam.reserveDriver.rain,
            defense: selectedOfficialTeam.reserveDriver.defense,
            salary: selectedOfficialTeam.reserveDriver.salary,
          },
        },
      )

      await refreshTeamAndSeason()

      const isReused = activeTeam?.id && activeTeam.team_key !== selectedOfficialTeam.key
      toast({
        title: isReused
          ? `Carreira Ativa: ${activeTeam.name}`
          : `Você assumiu a ${selectedOfficialTeam.name}!`,
        description: isReused
          ? `Você já possui a equipe ${activeTeam.name} vinculada à sua conta. Acessando a central de comando...`
          : `Titulares: ${selectedOfficialTeam.driver1.name} e ${selectedOfficialTeam.driver2.name} | Reserva: ${selectedOfficialTeam.reserveDriver.name}`,
      })

      navigate('/', { replace: true })
    } catch (err: any) {
      // Fallback no catch: se um create() disparar e receber 400, reconsultar a equipe existente por user_id, reutilizá-la e redirecionar
      let fallbackTeam = null
      try {
        fallbackTeam = await f1Service.getPlayerTeam(effectiveUserId)
        if (fallbackTeam) {
          setExistingUserTeam(fallbackTeam)
          await refreshTeamAndSeason()
          toast({
            title: 'Carreira Recuperada',
            description: `Você já possui a equipe ${fallbackTeam.name} vinculada à sua conta. Redirecionando para o painel...`,
          })
          navigate('/', { replace: true })
          return
        }
      } catch (_) {
        // ignore
      }

      // Nunca exibir toast vermelho se a equipe já existe
      if (existingUserTeam || team) {
        handleLoadExistingCareer(existingUserTeam || team)
        return
      }

      toast({
        variant: 'destructive',
        title: 'Erro ao inicializar equipe',
        description: formatTeamCreationError(err, Boolean(fallbackTeam)),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle creating the 12th custom team
  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault()

    // Se o usuário já possui equipe ativa (via state ou auth), redireciona direto sem POST
    const activeKnownTeam = existingUserTeam || team
    if (activeKnownTeam) {
      handleLoadExistingCareer(activeKnownTeam)
      return
    }

    const effectiveUserId =
      user?.id || (await import('@/lib/pocketbase/client')).default.authStore.record?.id
    if (!effectiveUserId) return

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

    // Guard fail-safe: verificação prévia explícita com tratamento de erro de consulta
    let preExisting = null
    try {
      preExisting = await f1Service.getPlayerTeam(effectiveUserId)
    } catch (queryErr) {
      // Falha na verificação prévia NÃO segue para criação! NUNCA chama create() após falha de consulta.
      setIsSubmitting(false)
      setCheckError(
        'Não foi possível verificar sua carreira existente devido a uma falha de conexão.',
      )
      toast({
        variant: 'destructive',
        title: 'Falha de Conexão',
        description:
          'Não foi possível verificar suas equipes existentes. Toque em "Tentar Novamente" ou "Carregar Carreira".',
      })
      return
    }

    if (preExisting) {
      setExistingUserTeam(preExisting)
      setIsSubmitting(false)
      handleLoadExistingCareer(preExisting)
      return
    }

    try {
      const activeTeam = await f1Service.initializeCustomTeam(
        effectiveUserId,
        trimmed,
        customEngine,
        customColor,
      )
      await refreshTeamAndSeason()

      const isReused = activeTeam?.id && activeTeam.name !== trimmed
      toast({
        title: isReused ? `Carreira Ativa: ${activeTeam.name}` : 'Escuderia Criada com Sucesso!',
        description: isReused
          ? `Você já possui a equipe ${activeTeam.name} vinculada à sua conta. Redirecionando...`
          : `A ${trimmed} ingressou como a 12ª equipe do grid da F1 2026. Agora contrate seus pilotos no mercado!`,
      })

      navigate(isReused ? '/' : '/team', { replace: true })
    } catch (err: any) {
      // Fallback no catch: se um create() disparar e receber 400, reconsultar a equipe existente por user_id, reutilizá-la e redirecionar
      let fallbackTeam = null
      try {
        fallbackTeam = await f1Service.getPlayerTeam(effectiveUserId)
        if (fallbackTeam) {
          setExistingUserTeam(fallbackTeam)
          await refreshTeamAndSeason()
          toast({
            title: 'Carreira Recuperada',
            description: `Você já possui a equipe ${fallbackTeam.name} vinculada à sua conta. Redirecionando para o painel...`,
          })
          navigate('/', { replace: true })
          return
        }
      } catch (_) {
        // ignore
      }

      // Nunca exibir toast vermelho se a equipe já existe
      if (existingUserTeam || team) {
        handleLoadExistingCareer(existingUserTeam || team)
        return
      }

      toast({
        variant: 'destructive',
        title: 'Erro ao criar equipe',
        description: formatTeamCreationError(err, Boolean(fallbackTeam)),
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
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#F8FAFC] text-[#0F172A] py-8 sm:py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
        {/* Header */}
        <div className="text-center space-y-3 pb-4 border-b border-[#E2E8F0]">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[#E10600] text-xs font-mono font-bold uppercase tracking-widest shadow-xs">
            <Flag className="w-3.5 h-3.5" /> Temporada F1 2026 • Novo Regulamento Híbrido 50/50
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
            Escolha seu Destino na Fórmula 1
          </h1>
          <p className="text-sm sm:text-base text-[#64748B] max-w-2xl mx-auto">
            Você pode comandar uma das{' '}
            <strong className="text-[#0F172A]">11 escuderias oficiais</strong> já consagradas (com
            seus pilotos titulares reais) ou registrar a{' '}
            <strong className="text-[#00A6FB]">12ª equipe própria do grid</strong>, contratando
            talentos fora do grid e construindo seu legado do zero.
          </p>
        </div>

        {/* Banner de Carreira Existente */}
        {(existingUserTeam || team) && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-600 text-white font-bold">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] uppercase font-mono font-bold text-emerald-700 block">
                  Carreira Ativa Identificada
                </span>
                <h3 className="text-base font-extrabold text-[#0F172A]">
                  {(existingUserTeam || team).name}
                </h3>
                <p className="text-xs text-emerald-800">
                  Sua conta já possui uma escuderia vinculada para a temporada 2026.
                </p>
              </div>
            </div>
            <Button
              onClick={() => handleLoadExistingCareer(existingUserTeam || team)}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-5 shadow-sm"
            >
              Carregar Carreira — {(existingUserTeam || team).name}
              <ChevronRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        )}

        {/* Aviso de erro ou instabilidade na verificação prévia */}
        {checkError && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{checkError}</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setCheckError(null)
                  setIsCheckingTeam(true)
                  try {
                    const effectiveUserId =
                      user?.id ||
                      (await import('@/lib/pocketbase/client')).default.authStore.record?.id
                    if (effectiveUserId) {
                      const res = await f1Service.getPlayerTeam(effectiveUserId)
                      setExistingUserTeam(res)
                      if (res) await refreshTeamAndSeason()
                    }
                  } catch (e) {
                    setCheckError(
                      'Tentativa de conexão falhou. Verifique sua rede e tente novamente.',
                    )
                  } finally {
                    setIsCheckingTeam(false)
                  }
                }}
                disabled={isCheckingTeam}
                className="text-xs h-8 bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                {isCheckingTeam ? 'Conectando...' : 'Tentar Novamente'}
              </Button>
              {(existingUserTeam || team) && (
                <Button
                  size="sm"
                  onClick={() => handleLoadExistingCareer(existingUserTeam || team)}
                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Carregar Carreira
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Selection Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-100 border border-[#E2E8F0] h-13 p-1">
            <TabsTrigger
              value="existing"
              className="data-[state=active]:bg-white data-[state=active]:text-[#E10600] data-[state=active]:shadow-xs font-bold text-xs sm:text-sm flex items-center justify-center gap-2 py-2.5"
            >
              <Building2 className="w-4 h-4" />
              Operar Equipe Existente (11 Equipes Reais)
            </TabsTrigger>
            <TabsTrigger
              value="custom"
              className="data-[state=active]:bg-white data-[state=active]:text-[#00A6FB] data-[state=active]:shadow-xs font-bold text-xs sm:text-sm flex items-center justify-center gap-2 py-2.5"
            >
              <PlusCircle className="w-4 h-4" />
              Criar Equipe Própria (12ª do Grid)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: 11 EQUIPES REAIS */}
          <TabsContent value="existing" className="space-y-6 pt-4">
            <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#64748B] flex items-start gap-3 shadow-xs">
              <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#0F172A] block text-sm">
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
                    className="bg-white border-[#E2E8F0] hover:border-[#E10600] transition-all duration-200 flex flex-col justify-between shadow-xs"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                            style={{ backgroundColor: team.color }}
                          />
                          <div>
                            <CardTitle className="text-base sm:text-lg font-bold text-[#0F172A]">
                              {team.name}
                            </CardTitle>
                            <span className="text-xs font-mono text-[#64748B]">
                              Motor {team.engine} • 50/50 Híbrido
                            </span>
                          </div>
                        </div>

                        {/* Rating Badge */}
                        <div className="text-right shrink-0">
                          <div className="flex items-baseline justify-end gap-1 font-mono">
                            <span className="text-2xl font-black text-[#0F172A]">
                              {team.strength}
                            </span>
                            <span className="text-[10px] text-[#64748B]">/100</span>
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
                      <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                        <span className="text-[10px] uppercase font-mono font-bold text-cyan-700 block">
                          Situação no Campeonato & História:
                        </span>
                        <p className="text-[#334155] leading-relaxed font-sans">
                          {team.currentSituation}
                        </p>
                        <p className="text-[#64748B] text-[11px] font-sans italic">
                          {team.historySummary}
                        </p>
                      </div>

                      {/* Pilotos Titulares e Reserva */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] uppercase font-mono text-[#64748B]">
                          <span>Escalação 2026 (2 Titulares + 1 Reserva):</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-mono">
                          <div className="p-2 rounded bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                            <span className="text-[#0F172A] font-bold truncate text-[11px]">
                              {team.driver1.flag} {team.driver1.name}
                            </span>
                            <span className="text-cyan-700 text-[10px] ml-1 shrink-0 font-semibold">
                              {team.driver1.speed} VEL
                            </span>
                          </div>
                          <div className="p-2 rounded bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                            <span className="text-[#0F172A] font-bold truncate text-[11px]">
                              {team.driver2.flag} {team.driver2.name}
                            </span>
                            <span className="text-cyan-700 text-[10px] ml-1 shrink-0 font-semibold">
                              {team.driver2.speed} VEL
                            </span>
                          </div>
                        </div>
                        <div className="p-1.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between font-mono text-[11px]">
                          <span className="text-amber-700 font-bold truncate flex items-center gap-1">
                            <span className="text-[9px] uppercase px-1 py-0.2 bg-amber-50 text-amber-800 rounded border border-amber-200">
                              Reserva
                            </span>
                            {team.reserveDriver.flag} {team.reserveDriver.name}
                          </span>
                          <span className="text-[#64748B] text-[10px] shrink-0">
                            {team.reserveDriver.speed} VEL • 2 FPs/ano
                          </span>
                        </div>
                      </div>

                      {/* Budget */}
                      <div className="flex justify-between items-center pt-1 font-mono text-xs text-[#64748B]">
                        <span>Orçamento Base:</span>
                        <strong className="text-emerald-700">{formatCurrency(team.budget)}</strong>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-2 border-t border-[#E2E8F0]">
                      {existingUserTeam || team ? (
                        <Button
                          onClick={() => handleLoadExistingCareer(existingUserTeam || team)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 transition-colors shadow-xs"
                        >
                          Carregar Carreira — {(existingUserTeam || team).name}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setSelectedOfficialTeam(team)}
                          className="w-full bg-[#F8FAFC] hover:bg-[#E10600] text-[#0F172A] hover:text-white border border-[#CBD5E1] font-bold text-xs h-9 transition-colors"
                        >
                          Assumir {team.name}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* TAB 2: CRIAR PRÓPRIA EQUIPE (12ª DO GRID) */}
          <TabsContent value="custom" className="space-y-6 pt-4">
            <Card className="bg-white border-[#E2E8F0] max-w-2xl mx-auto shadow-md">
              <CardHeader>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-[#00A6FB] text-xs font-mono font-bold uppercase w-fit">
                  <Sparkles className="w-3.5 h-3.5" /> A 12ª Escuderia da F1 2026
                </div>
                <CardTitle className="text-xl font-bold text-[#0F172A]">
                  Crie sua Própria Equipe
                </CardTitle>
                <CardDescription className="text-xs text-[#64748B]">
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
                      className="bg-white border-[#CBD5E1] text-[#0F172A] text-sm focus-visible:ring-[#00A6FB]"
                    />
                    {customNameError && (
                      <p className="text-xs text-rose-600 font-mono">{customNameError}</p>
                    )}
                  </div>

                  {/* Cor da equipe */}
                  <div className="space-y-2">
                    <Label className="text-xs font-mono uppercase text-[#64748B]">
                      Cor Principal da Pintura (Livery)
                    </Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer bg-white border border-[#CBD5E1] p-1"
                      />
                      <span className="font-mono text-xs text-[#64748B]">{customColor}</span>
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
                    <Label className="text-xs font-mono uppercase text-[#64748B]">
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
                              ? 'border-[#00A6FB] bg-sky-50 text-[#0F172A]'
                              : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#CBD5E1]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-[#0F172A]">{eng.name}</span>
                            <RadioGroupItem value={eng.name} id={eng.name} />
                          </div>
                          <span className="text-[11px] font-mono text-cyan-700 block mt-1">
                            {eng.techBadge}
                          </span>
                          <div className="flex justify-between text-[10px] font-mono text-[#64748B] mt-2">
                            <span>
                              Potência: <strong className="text-[#0F172A]">{eng.power}</strong>
                            </span>
                            <span>
                              Confiabilidade:{' '}
                              <strong className="text-[#0F172A]">{eng.reliability}%</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Detalhes da Condição Inicial como 12ª equipe */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs font-mono">
                    <div className="text-amber-700 font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> Condições da Estreante 2026:
                    </div>
                    <ul className="space-y-1 text-[#64748B] list-disc list-inside">
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

                <CardFooter className="pt-2 border-t border-[#E2E8F0]">
                  {existingUserTeam || team ? (
                    <Button
                      type="button"
                      onClick={() => handleLoadExistingCareer(existingUserTeam || team)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 shadow-md"
                    >
                      Carregar Carreira — {(existingUserTeam || team).name}
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[#00A6FB] hover:bg-[#0090DA] text-white font-bold h-10 shadow-md shadow-sky-200"
                    >
                      {isSubmitting
                        ? 'Homologando nova escuderia...'
                        : 'Fundar Equipe e Ingressar na F1 2026'}
                    </Button>
                  )}
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
        <DialogContent className="bg-white border-[#E2E8F0] text-[#0F172A] shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[#0F172A]">
              <span
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: selectedOfficialTeam?.color }}
              />
              Confirmar Escolha de Escuderia
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              Você está prestes a se tornar o Chefe de Equipe da {selectedOfficialTeam?.name}.
            </DialogDescription>
          </DialogHeader>

          {selectedOfficialTeam && (
            <div className="space-y-3 py-2 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Escuderia:</span>
                  <strong className="text-[#0F172A] text-sm">{selectedOfficialTeam.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Força Atual (Rating):</span>
                  <strong className="text-amber-700 font-bold">
                    {selectedOfficialTeam.strength}/100
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Motor Regulamento 2026:</span>
                  <span className="text-cyan-700">
                    {selectedOfficialTeam.engine} (50/50 Híbrido)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Pilotos Titulares:</span>
                  <span className="text-[#0F172A]">
                    {selectedOfficialTeam.driver1.name} & {selectedOfficialTeam.driver2.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Piloto Reserva:</span>
                  <span className="text-amber-700 font-bold">
                    {selectedOfficialTeam.reserveDriver.name} (
                    {selectedOfficialTeam.reserveDriver.speed} VEL)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Orçamento Inicial:</span>
                  <strong className="text-emerald-700">
                    {formatCurrency(selectedOfficialTeam.budget)}
                  </strong>
                </div>
              </div>

              <p className="text-[11px] text-[#64748B] leading-relaxed">
                As outras 10 equipes continuarão no campeonato sendo controladas pela IA, competindo
                com seus respectivos atributos e pilotos oficiais.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedOfficialTeam(null)}
              className="border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F1F5F9]"
            >
              Voltar
            </Button>
            {existingUserTeam || team ? (
              <Button
                onClick={() => {
                  setSelectedOfficialTeam(null)
                  handleLoadExistingCareer(existingUserTeam || team)
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Carregar Carreira — {(existingUserTeam || team).name}
              </Button>
            ) : (
              <Button
                onClick={handleConfirmOfficial}
                disabled={isSubmitting}
                className="bg-[#E10600] hover:bg-[#C60500] text-white font-bold"
              >
                {isSubmitting ? 'Configurando...' : 'Confirmar e Assumir Escuderia'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
