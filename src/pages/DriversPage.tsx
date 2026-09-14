import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { PageHeader } from '@/components/PageHeader'
import { AmbientBackground } from '@/components/AmbientBackground'
import { DriverPoster } from '@/components/DriverPoster'
import { getCountryFlag } from '@/lib/country-flags'
import {
  MBJ_2026_PILOTS,
  MBJPilotData,
  checkEligibility,
  getOverallRating,
  USD_TO_BRL_RATE,
} from '@/lib/mbj-drivers-data'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search,
  Users,
  Briefcase,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Activity,
  Zap,
  Shield,
  CloudRain,
  DollarSign,
  UserPlus,
} from 'lucide-react'

export default function DriversPage() {
  const { user, team, refreshUserTeam } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<string>('grid')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all')
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<string>('all')
  const [isContractingModalOpen, setIsContractingModalOpen] = useState<boolean>(false)
  const [selectedPilotForContract, setSelectedPilotForContract] = useState<MBJPilotData | null>(
    null,
  )
  const [contractRole, setContractRole] = useState<'titular' | 'reserva'>('titular')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Filtros combinados
  const filteredPilots = useMemo(() => {
    return MBJ_2026_PILOTS.filter((pilot) => {
      // Busca por nome ou nacionalidade
      const matchesSearch =
        pilot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pilot.nationality.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false

      // Filtro de equipe
      if (selectedTeamFilter !== 'all') {
        if (selectedTeamFilter === 'free_agents') {
          if (pilot.teamKey) return false
        } else if (pilot.teamKey !== selectedTeamFilter) {
          return false
        }
      }

      // Filtro de faixa de overall
      const ovr = getOverallRating(pilot)
      if (selectedRatingFilter === '90+') {
        if (ovr < 90) return false
      } else if (selectedRatingFilter === '80-89') {
        if (ovr < 80 || ovr > 89) return false
      } else if (selectedRatingFilter === 'sub80') {
        if (ovr >= 80) return false
      }

      return true
    })
  }, [searchQuery, selectedTeamFilter, selectedRatingFilter])

  // Segmentação por aba
  const gridF1Pilots = useMemo(() => {
    return filteredPilots.filter(
      (p) => (p.category === 'f1' && p.teamKey) || p.role === 'titular' || p.role === 'reserva',
    )
  }, [filteredPilots])

  const freeAgentsPilots = useMemo(() => {
    return filteredPilots.filter((p) => !p.teamKey || p.category === 'mercado')
  }, [filteredPilots])

  const marketPilots = useMemo(() => {
    // Todos disponíveis para negociação ou agentes livres + categorias alternativas
    return filteredPilots.filter((p) => p.category !== 'f1' || !p.teamKey || p.role === 'reserva')
  }, [filteredPilots])

  const prospectPilots = useMemo(() => {
    return filteredPilots.filter((p) => p.isAcademyProspect || p.category === 'f2' || p.age < 22)
  }, [filteredPilots])

  // Formatação de valores em Real (BRL)
  const formatBrlCurrency = (usd: number) => {
    const brl = usd * USD_TO_BRL_RATE
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(brl)
  }

  const handleOpenContractModal = (pilot: MBJPilotData) => {
    setSelectedPilotForContract(pilot)
    const eligibility = checkEligibility(pilot)
    if (!eligibility.canSignTitular && eligibility.canSignReserve) {
      setContractRole('reserva')
    } else {
      setContractRole('titular')
    }
    setIsContractingModalOpen(true)
  }

  const handleConfirmContract = async () => {
    if (!selectedPilotForContract || !team) {
      toast({
        title: 'Erro na contratação',
        description: 'Equipe ou piloto não identificado.',
        variant: 'destructive',
      })
      return
    }

    const eligibility = checkEligibility(selectedPilotForContract)
    if (contractRole === 'titular' && !eligibility.canSignTitular) {
      toast({
        title: 'Contratação não permitida',
        description:
          'Pilotos menores de 18 anos só podem assumir posições de desenvolvimento ou reserva.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Verificar se o piloto já existe na coleção drivers do backend
      let existingDriver = null
      try {
        existingDriver = await pb
          .collection('drivers')
          .getFirstListItem(`name ~ "${selectedPilotForContract.name.split(' ').pop()}"`)
      } catch {
        existingDriver = null
      }

      if (existingDriver) {
        // Atualiza vínculo com o time do usuário
        await pb.collection('drivers').update(existingDriver.id, {
          team_id: team.id,
          role: contractRole,
          salary: selectedPilotForContract.salaryUsd,
          category: 'f1',
        })
      } else {
        // Cria registro novo vinculado à equipe do usuário
        await pb.collection('drivers').create({
          name: selectedPilotForContract.name,
          nationality: selectedPilotForContract.nationality,
          age: selectedPilotForContract.age,
          speed: selectedPilotForContract.speed,
          consistency: selectedPilotForContract.consistency,
          rain: selectedPilotForContract.rain,
          defense: selectedPilotForContract.defense,
          salary: selectedPilotForContract.salaryUsd,
          contract_end: 2027,
          role: contractRole,
          category: 'f1',
          team_id: team.id,
        })
      }

      // Notificação e atualização de estado
      toast({
        title: 'Contratação Concluída com Sucesso!',
        description: `${selectedPilotForContract.name} agora é piloto ${contractRole} da ${team.name}.`,
      })

      setIsContractingModalOpen(false)
      setSelectedPilotForContract(null)
      if (refreshUserTeam) {
        await refreshUserTeam()
      }
    } catch (err: any) {
      toast({
        title: 'Falha ao formalizar contrato',
        description: err?.message || 'Não foi possível registrar o piloto no seu save.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderPilotCard = (pilot: MBJPilotData, showContractButton = true) => {
    const ovr = getOverallRating(pilot)
    const eligibility = checkEligibility(pilot)
    const isPlayerDriver =
      pilot.teamKey === team?.team_key || (team?.id && pilot.teamKey === team.id)

    return (
      <Card
        key={pilot.id}
        className="overflow-hidden border-zinc-800 bg-zinc-900/90 hover:border-zinc-700 transition-all shadow-md flex flex-col justify-between"
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex gap-4">
            <div className="w-24 shrink-0">
              <DriverPoster name={pilot.name} aspectRatio="poster" className="w-full shadow" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-zinc-700 bg-zinc-800/80 text-zinc-300"
                >
                  {getCountryFlag(pilot.nationality)} {pilot.nationality}
                </Badge>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-zinc-400 font-semibold">OVR</span>
                  <Badge
                    className={
                      ovr >= 90
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : ovr >= 82
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                    }
                  >
                    {ovr}
                  </Badge>
                </div>
              </div>

              <CardTitle className="text-base sm:text-lg font-bold text-white truncate">
                {pilot.name}
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <span>{pilot.age} anos</span>
                <span>•</span>
                <span className="text-zinc-300 font-medium">
                  {pilot.teamName || 'Agente Livre'}
                </span>
                {pilot.role && (
                  <Badge variant="secondary" className="text-[10px] uppercase py-0 px-1.5 ml-1">
                    {pilot.role}
                  </Badge>
                )}
              </CardDescription>

              {/* Status de Elegibilidade */}
              <div className="mt-2.5">
                {eligibility.status === 'academia' && (
                  <Badge className="bg-purple-950/80 text-purple-300 border-purple-700/60 text-[10px] flex items-center gap-1 w-fit">
                    <GraduationCap className="w-3 h-3" /> {eligibility.label}
                  </Badge>
                )}
                {eligibility.status === 'homologacao' && (
                  <Badge className="bg-amber-950/80 text-amber-300 border-amber-700/60 text-[10px] flex items-center gap-1 w-fit">
                    <AlertTriangle className="w-3 h-3" /> Exige Homologação
                  </Badge>
                )}
                {eligibility.status === 'elegivel' && (
                  <Badge className="bg-emerald-950/80 text-emerald-300 border-emerald-700/60 text-[10px] flex items-center gap-1 w-fit">
                    <CheckCircle2 className="w-3 h-3" /> Superlicença Válida
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2 pb-2">
          {/* Métricas O (Simulação) */}
          <div className="grid grid-cols-4 gap-2 text-center bg-zinc-950/50 p-2 rounded-md border border-zinc-800/80 mt-1">
            <div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-0.5">
                <Zap className="w-2.5 h-2.5 text-amber-400" /> VEL
              </div>
              <div className="text-xs font-bold text-white">{pilot.speed}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-0.5">
                <Activity className="w-2.5 h-2.5 text-blue-400" /> CON
              </div>
              <div className="text-xs font-bold text-white">{pilot.consistency}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-0.5">
                <CloudRain className="w-2.5 h-2.5 text-cyan-400" /> CHU
              </div>
              <div className="text-xs font-bold text-white">{pilot.rain}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-400 flex items-center justify-center gap-0.5">
                <Shield className="w-2.5 h-2.5 text-emerald-400" /> DEF
              </div>
              <div className="text-xs font-bold text-white">{pilot.defense}</div>
            </div>
          </div>

          {/* Dados Financeiros e Projeção */}
          <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-zinc-800">
            <span className="text-zinc-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Salário Estimado:
            </span>
            <span className="font-semibold text-emerald-300">
              {formatBrlCurrency(pilot.salaryUsd)}/ano
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
            <span>Potencial Projetado:</span>
            <span className="text-zinc-200 font-mono">
              {pilot.potentialMin} - {pilot.potentialMax}
            </span>
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-2">
          {isPlayerDriver ? (
            <Button disabled className="w-full bg-zinc-800 text-zinc-400 border border-zinc-700">
              Piloto da sua Equipe
            </Button>
          ) : showContractButton ? (
            <Button
              onClick={() => handleOpenContractModal(pilot)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium flex items-center justify-center gap-1.5 transition-colors shadow"
            >
              <UserPlus className="w-4 h-4" /> Propor Contrato
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => handleOpenContractModal(pilot)}
              className="w-full border-zinc-700 hover:bg-zinc-800 text-zinc-200"
            >
              Ver Detalhes do Piloto
            </Button>
          )}
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="min-h-screen relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <AmbientBackground />

      <PageHeader
        title="Hub de Pilotos & Universo MBJ 2026"
        description="Catálogo oficial de pilotos F1 2026, mercado global de transferências, prospectos da academia e contratações em tempo real."
      />

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 backdrop-blur-md shadow-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
          <Input
            placeholder="Buscar por nome do piloto ou país..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-950/60 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>

        <div className="flex gap-2">
          <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
            <SelectTrigger className="w-[180px] bg-zinc-950/60 border-zinc-700 text-zinc-200">
              <SelectValue placeholder="Filtrar Equipe" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
              <SelectItem value="all">Todas as Equipes</SelectItem>
              <SelectItem value="free_agents">Agentes Livres</SelectItem>
              <SelectItem value="cadillac">Cadillac F1 Team</SelectItem>
              <SelectItem value="audi">Audi Revolut F1</SelectItem>
              <SelectItem value="ferrari">Ferrari</SelectItem>
              <SelectItem value="red_bull">Red Bull</SelectItem>
              <SelectItem value="mclaren">McLaren</SelectItem>
              <SelectItem value="mercedes">Mercedes</SelectItem>
              <SelectItem value="aston_martin">Aston Martin</SelectItem>
              <SelectItem value="alpine">Alpine</SelectItem>
              <SelectItem value="williams">Williams</SelectItem>
              <SelectItem value="haas">Haas F1</SelectItem>
              <SelectItem value="rb">RB F1 Team</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedRatingFilter} onValueChange={setSelectedRatingFilter}>
            <SelectTrigger className="w-[140px] bg-zinc-950/60 border-zinc-700 text-zinc-200">
              <SelectValue placeholder="Rating OVR" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-200">
              <SelectItem value="all">Todos os Níveis</SelectItem>
              <SelectItem value="90+">Elite (90+)</SelectItem>
              <SelectItem value="80-89">Titulares (80-89)</SelectItem>
              <SelectItem value="sub80">Jovens (&lt; 80)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Abas Principais do Hub */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800 p-1 rounded-lg grid grid-cols-2 sm:grid-cols-4 w-full h-auto">
          <TabsTrigger
            value="grid"
            className="flex items-center gap-2 py-2.5 data-[state=active]:bg-red-600 data-[state=active]:text-white font-medium"
          >
            <Trophy className="w-4 h-4" />
            <span>Grid F1 2026 ({gridF1Pilots.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="free_agents"
            className="flex items-center gap-2 py-2.5 data-[state=active]:bg-red-600 data-[state=active]:text-white font-medium"
          >
            <Users className="w-4 h-4" />
            <span>Agentes Livres ({freeAgentsPilots.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="market"
            className="flex items-center gap-2 py-2.5 data-[state=active]:bg-red-600 data-[state=active]:text-white font-medium"
          >
            <Briefcase className="w-4 h-4" />
            <span>Mercado & Contratação ({marketPilots.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="prospects"
            className="flex items-center gap-2 py-2.5 data-[state=active]:bg-red-600 data-[state=active]:text-white font-medium"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Prospectos & Academia ({prospectPilots.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: GRID F1 2026 (11 EQUIPES INCLUINDO CADILLAC) */}
        <TabsContent value="grid" className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-900/60 p-3 rounded-md border border-zinc-800 text-xs text-zinc-400">
            <span>
              Mostrando os 22 titulares e reservas oficiais das 11 construtoras da temporada 2026.
            </span>
            <span className="font-semibold text-zinc-300">
              Cadillac F1: Sergio Pérez & Valtteri Bottas
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gridF1Pilots.map((pilot) => renderPilotCard(pilot, true))}
          </div>
        </TabsContent>

        {/* ABA 2: AGENTES LIVRES (SEM VÍNCULO) */}
        <TabsContent value="free_agents" className="space-y-4">
          <div className="bg-zinc-900/60 p-3 rounded-md border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>
              Pilotos experientes sem contrato ativo. Podem ser contratados de imediato sem
              pagamento de multa rescisória a outras equipes.
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {freeAgentsPilots.map((pilot) => renderPilotCard(pilot, true))}
          </div>
        </TabsContent>

        {/* ABA 3: MERCADO & CONTRATAÇÃO (ELEGIBILIDADE FUNCIONAL) */}
        <TabsContent value="market" className="space-y-4">
          <div className="bg-zinc-900/60 p-3 rounded-md border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
            <span>
              Mercado Global com critérios de Elegibilidade da FIA. Valores convertidos para Reais
              (R$).
            </span>
            <span className="text-zinc-300 font-mono">
              Cotação: US$ 1,00 = R$ {USD_TO_BRL_RATE.toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketPilots.map((pilot) => renderPilotCard(pilot, true))}
          </div>
        </TabsContent>

        {/* ABA 4: PROSPECTOS & ACADEMIA */}
        <TabsContent value="prospects" className="space-y-4">
          <div className="bg-zinc-900/60 p-3 rounded-md border border-zinc-800 text-xs text-zinc-400">
            <span>
              Jovens pilotos da Fórmula 2, Fórmula 3 e programas juniores. Pilotos menores de 18
              anos exigem desenvolvimento e homologação restrita.
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prospectPilots.map((pilot) => renderPilotCard(pilot, true))}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL DE FORMALIZAÇÃO DE CONTRATO */}
      <Dialog open={isContractingModalOpen} onOpenChange={setIsContractingModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-red-500" />
              Formalizar Contrato de Piloto
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Vincule o piloto à sua equipe ({team?.name || 'Sua Equipe'}). O registro será
              persistido no seu save sem afetar o grid global.
            </DialogDescription>
          </DialogHeader>

          {selectedPilotForContract && (
            <div className="space-y-4 py-2">
              <div className="flex gap-4 p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                <div className="w-20">
                  <DriverPoster name={selectedPilotForContract.name} aspectRatio="poster" />
                </div>
                <div className="flex-1 text-xs space-y-1">
                  <div className="font-bold text-base text-white">
                    {selectedPilotForContract.name}
                  </div>
                  <div className="text-zinc-400">
                    {selectedPilotForContract.nationality} • {selectedPilotForContract.age} anos
                  </div>
                  <div className="text-emerald-400 font-semibold pt-1">
                    Salário anual: {formatBrlCurrency(selectedPilotForContract.salaryUsd)} (R$)
                  </div>
                </div>
              </div>

              {/* Status de Elegibilidade FIA */}
              {(() => {
                const el = checkEligibility(selectedPilotForContract)
                return (
                  <div
                    className={
                      el.status === 'academia'
                        ? 'p-3 rounded-md bg-purple-950/40 border border-purple-800/60 text-xs text-purple-200'
                        : el.status === 'homologacao'
                          ? 'p-3 rounded-md bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200'
                          : 'p-3 rounded-md bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200'
                    }
                  >
                    <div className="font-semibold flex items-center gap-1 mb-1">
                      {el.status === 'academia' && <GraduationCap className="w-4 h-4" />}
                      {el.status === 'homologacao' && <AlertTriangle className="w-4 h-4" />}
                      {el.status === 'elegivel' && <CheckCircle2 className="w-4 h-4" />}
                      {el.label}
                    </div>
                    <p className="text-[11px] opacity-90">{el.description}</p>
                  </div>
                )
              })()}

              {/* Escolha da Vaga */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">
                  Vaga Contratual na Equipe:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!checkEligibility(selectedPilotForContract).canSignTitular}
                    onClick={() => setContractRole('titular')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      contractRole === 'titular'
                        ? 'border-red-600 bg-red-600/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    } ${
                      !checkEligibility(selectedPilotForContract).canSignTitular
                        ? 'opacity-40 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    <div className="font-bold text-xs">Piloto Titular</div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      Disputa as corridas e pontua
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContractRole('reserva')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      contractRole === 'reserva'
                        ? 'border-red-600 bg-red-600/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-xs">Piloto Reserva / Academia</div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      Treinos livres e desenvolvimento
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsContractingModalOpen(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmContract}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {isSubmitting ? 'Registrando Contrato...' : 'Assinar Contrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
