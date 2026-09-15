import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { DriverModel, TeamModel } from '@/types/f1'
import {
  DriverTestType,
  DRIVER_TEST_TYPES_CONFIG,
  HOMOLOGATION_CONFIG,
  DriverHomologationProgram,
  DriverTestResult,
} from '@/types/driver-development'
import driverDevelopmentService from '@/services/driverDevelopmentService'
import { formatCurrency } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'
import {
  GraduationCap,
  ShieldCheck,
  Award,
  Gauge,
  Flag,
  FileCheck2,
  AlertTriangle,
  History,
  XCircle,
  TrendingUp,
} from 'lucide-react'

interface DevelopmentManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team: TeamModel
  titularDrivers: DriverModel[]
  reserveDriver?: DriverModel
  testDrivers: DriverModel[]
  academyDrivers: DriverModel[]
  availableTalents: DriverModel[] // Pilotos livres ou de categorias de base elegíveis
  onDataChanged: () => void
}

export const DevelopmentManagerModal: React.FC<DevelopmentManagerModalProps> = ({
  open,
  onOpenChange,
  team,
  titularDrivers,
  reserveDriver,
  testDrivers,
  academyDrivers,
  availableTalents,
  onDataChanged,
}) => {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'tests' | 'homologation' | 'academy' | 'history'>(
    'tests',
  )
  const [selectedDriverId, setSelectedDriverId] = useState<string>(
    testDrivers[0]?.id || academyDrivers[0]?.id || titularDrivers[0]?.id || '',
  )
  const [selectedTestType, setSelectedTestType] = useState<DriverTestType>('homologacao')
  const [selectedCircuit, setSelectedCircuit] = useState<string>('Silverstone')
  const [selectedSecondDriverId, setSelectedSecondDriverId] = useState<string>(
    titularDrivers[0]?.id || '',
  )
  const [isRunningTest, setIsRunningTest] = useState(false)
  const [isStartingHomologation, setIsStartingHomologation] = useState(false)
  const [lastTestOutcome, setLastTestOutcome] = useState<any>(null)

  const academyData = driverDevelopmentService.getAcademyData(team)
  const testResultsHistory: DriverTestResult[] = academyData.testResults || []

  // Piloto selecionado para testes/homologação
  const allTeamDevelopmentPilots = [
    ...testDrivers,
    ...academyDrivers.filter((a) => !testDrivers.some((t) => t.id === a.id)),
    ...(reserveDriver ? [reserveDriver] : []),
    ...titularDrivers,
  ]

  const activeDriver =
    allTeamDevelopmentPilots.find((d) => d.id === selectedDriverId) || allTeamDevelopmentPilots[0]
  const currentProgram: DriverHomologationProgram | undefined = activeDriver
    ? academyData.homologationPrograms[activeDriver.id]
    : undefined

  const circuits = [
    'Silverstone',
    'Barcelona-Catalunya',
    'Spa-Francorchamps',
    'Monza',
    'Red Bull Ring',
    'Interlagos',
    'Suzuka',
  ]

  // Ação: Iniciar Homologação FIA
  const handleStartHomologation = async () => {
    if (!activeDriver) return
    setIsStartingHomologation(true)
    try {
      const res = await driverDevelopmentService.startHomologationProgram(team, activeDriver)
      if (res.success) {
        toast({
          title: 'Programa FIA Aberto!',
          description: res.message,
        })
        onDataChanged()
      } else {
        toast({
          title: 'Não foi possível iniciar',
          description: res.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro operacional',
        description: err.message || 'Falha ao registrar programa na FIA.',
        variant: 'destructive',
      })
    } finally {
      setIsStartingHomologation(false)
    }
  }

  // Ação: Executar Teste Privado
  const handleRunTest = async () => {
    if (!activeDriver) return
    setIsRunningTest(true)
    setLastTestOutcome(null)

    try {
      const outcome = await driverDevelopmentService.executeTest(
        team,
        activeDriver,
        {
          teamId: team.id,
          driverId: activeDriver.id,
          testType: selectedTestType,
          circuit: selectedCircuit,
          secondDriverId: selectedTestType === 'comparativo' ? selectedSecondDriverId : undefined,
        },
        titularDrivers,
      )

      setLastTestOutcome(outcome)
      toast({
        title: 'Sessão Concluída!',
        description: `Nota consolidada: ${outcome.testResult.finalScore}/100 em ${selectedCircuit}.`,
      })
      onDataChanged()
    } catch (err: any) {
      toast({
        title: 'Falha no Teste',
        description: err.message || 'Erro ao processar sessão de pista.',
        variant: 'destructive',
      })
    } finally {
      setIsRunningTest(false)
    }
  }

  // Ação: Promover Acadêmico a Test Driver (bloqueia 3º)
  const handlePromoteToTestDriver = async (driver: DriverModel) => {
    try {
      const res = await driverDevelopmentService.assignTestDriver(team, driver)
      if (res.success) {
        toast({
          title: 'Designado com Sucesso',
          description: res.message,
        })
        onDataChanged()
      } else {
        toast({
          title: 'Promoção Bloqueada',
          description: res.message,
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Ação: Dispensar Test Driver
  const handleDismissTestDriver = async (driverId: string) => {
    try {
      const res = await driverDevelopmentService.removeTestDriver(team, driverId)
      toast({
        title: 'Vaga de Test Driver Liberada',
        description: res.message,
      })
      onDataChanged()
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Ação: Reconfirmar titular publicamente (Regra 10: Seat Security+, moral+)
  const handleConfirmTitular = async (titular: DriverModel) => {
    try {
      const res = await driverDevelopmentService.confirmTitularPublicly(team, titular, activeDriver)
      toast({
        title: 'Declaração Pública Oficial',
        description: res.message,
      })
      onDataChanged()
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const selectedTestConfig = DRIVER_TEST_TYPES_CONFIG[selectedTestType]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-400" />
            <DialogTitle className="text-xl font-bold tracking-tight">
              Gerenciar Desenvolvimento & Homologação FIA
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-400">
            Supervisão de Academia, Pilotos de Teste, Sessões Privadas de Pista e Homologação de
            Super Licença.
          </DialogDescription>
        </DialogHeader>

        {/* Barra superior de status do orçamento & vagas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-900/80 rounded-lg border border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-400 block">Orçamento Disponível</span>
            <span className="text-emerald-400 font-bold text-sm">
              {formatCurrency(team.budget || 0)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Vagas de Piloto de Testes</span>
            <span className="font-semibold text-sm">
              {testDrivers.length} / {HOMOLOGATION_CONFIG.maxTestDriversPerTeam}
              {testDrivers.length >= HOMOLOGATION_CONFIG.maxTestDriversPerTeam ? (
                <Badge
                  variant="outline"
                  className="ml-2 bg-red-950/60 text-red-300 border-red-800 text-[10px]"
                >
                  Lotado (Max 2)
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="ml-2 bg-emerald-950/60 text-emerald-300 border-emerald-800 text-[10px]"
                >
                  1 Vaga Livre
                </Badge>
              )}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Jovens na Academia</span>
            <span className="text-cyan-400 font-bold text-sm">
              {academyDrivers.length} vinculados
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Testes Privados Totais</span>
            <span className="text-indigo-400 font-bold text-sm">
              {testResultsHistory.length} executados
            </span>
          </div>
        </div>

        {/* Abas funcionais */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-4 bg-slate-900 border border-slate-800">
            <TabsTrigger value="tests" className="text-xs data-[state=active]:bg-indigo-600">
              <Gauge className="w-3.5 h-3.5 mr-1.5" />
              Testes Privados
            </TabsTrigger>
            <TabsTrigger value="homologation" className="text-xs data-[state=active]:bg-indigo-600">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              Homologação FIA
            </TabsTrigger>
            <TabsTrigger value="academy" className="text-xs data-[state=active]:bg-indigo-600">
              <GraduationCap className="w-3.5 h-3.5 mr-1.5" />
              Academia & Contratos
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs data-[state=active]:bg-indigo-600">
              <History className="w-3.5 h-3.5 mr-1.5" />
              Histórico de Pista
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: TESTES PRIVADOS */}
          <TabsContent value="tests" className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Coluna 1: Seleção de piloto e circuito */}
              <div className="space-y-3 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 block">
                  1. Piloto a Testar
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {allTeamDevelopmentPilots.map((p) => {
                    const isSelected = p.id === selectedDriverId
                    const roleLabel = testDrivers.some((t) => t.id === p.id)
                      ? 'Test Driver'
                      : academyDrivers.some((a) => a.id === p.id)
                        ? 'Academia'
                        : titularDrivers.some((t) => t.id === p.id)
                          ? 'Titular'
                          : 'Reserva'

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedDriverId(p.id)}
                        className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-600/30 border border-indigo-500 text-white'
                            : 'bg-slate-800/40 hover:bg-slate-800 border border-transparent text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {roleLabel} • OVR {p.speed || 75}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-slate-700">
                          {p.license_status === 'nivel_a'
                            ? 'Licença A'
                            : p.license_status === 'nivel_b'
                              ? 'Licença B'
                              : 'Licença C'}
                        </Badge>
                      </button>
                    )
                  })}
                </div>

                <div className="pt-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Circuito do Teste
                  </label>
                  <select
                    value={selectedCircuit}
                    onChange={(e) => setSelectedCircuit(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-2 text-slate-200"
                  >
                    {circuits.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Coluna 2: Escolha do Tipo de Teste (6 tipos) */}
              <div className="space-y-2 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 block">
                  2. Tipo de Teste (6 Tipos)
                </label>
                <div className="space-y-1.5">
                  {(Object.keys(DRIVER_TEST_TYPES_CONFIG) as DriverTestType[]).map((typeKey) => {
                    const cfg = DRIVER_TEST_TYPES_CONFIG[typeKey]
                    const isSelected = selectedTestType === typeKey
                    return (
                      <button
                        key={typeKey}
                        type="button"
                        onClick={() => setSelectedTestType(typeKey)}
                        className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'bg-slate-800/40 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <span>{cfg.name}</span>
                        <span className="text-[10px] opacity-80">
                          {formatCurrency(cfg.baseCost)}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {selectedTestType === 'comparativo' && (
                  <div className="pt-2 border-t border-slate-800 mt-2">
                    <label className="text-[11px] font-semibold text-amber-300 block mb-1">
                      Segundo Piloto (Referência de Comparativo)
                    </label>
                    <select
                      value={selectedSecondDriverId}
                      onChange={(e) => setSelectedSecondDriverId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-2 text-slate-200"
                    >
                      {titularDrivers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (Titular • OVR {t.speed || 84})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Coluna 3: Detalhes do Teste & Execução */}
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex flex-col justify-between">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <span className="font-semibold text-slate-200">{selectedTestConfig.name}</span>
                    <Badge variant="outline" className="border-indigo-500 text-indigo-300">
                      ~{selectedTestConfig.standardKm} km
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-[11px]">{selectedTestConfig.description}</p>

                  <div className="p-2 bg-slate-800/50 rounded border border-slate-700/50 space-y-1">
                    <div className="text-[11px] text-slate-300 font-semibold">
                      Benefícios Esperados:
                    </div>
                    <div className="text-[11px] text-indigo-300">
                      {selectedTestConfig.possibleBenefits}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-400">Custo da Sessão:</span>
                    <span className="font-bold text-amber-400">
                      {formatCurrency(selectedTestConfig.baseCost)}
                    </span>
                  </div>

                  {selectedTestConfig.standardKm >= 300 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Válido para Homologação FIA (≥ 300 km)
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleRunTest}
                  disabled={isRunningTest || (team.budget || 0) < selectedTestConfig.baseCost}
                  className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  {isRunningTest ? 'Executando Telemetria...' : 'Iniciar Teste Privado'}
                </Button>
              </div>
            </div>

            {/* Resultado do Teste Imediato */}
            {lastTestOutcome && (
              <Card className="bg-slate-900 border-indigo-800/50">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                      <FileCheck2 className="w-4 h-4" />
                      Relatório Oficial da Sessão: {lastTestOutcome.testResult.driver_name}
                    </CardTitle>
                    <Badge className="bg-indigo-600 text-white text-xs">
                      Nota Consolidada: {lastTestOutcome.testResult.finalScore}/100
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs pt-0">
                  <div className="grid grid-cols-5 gap-2 text-center p-2 bg-slate-950/60 rounded">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Ritmo (30%)</span>
                      <span className="font-bold text-slate-200">
                        {lastTestOutcome.testResult.scorePace}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Consistência (25%)</span>
                      <span className="font-bold text-slate-200">
                        {lastTestOutcome.testResult.scoreConsistency}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Controle (20%)</span>
                      <span className="font-bold text-slate-200">
                        {lastTestOutcome.testResult.scoreCarControl}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        Feedback Técnico (15%)
                      </span>
                      <span className="font-bold text-cyan-300">
                        {lastTestOutcome.testResult.scoreTechnicalFeedback}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Disciplina (10%)</span>
                      <span className="font-bold text-slate-200">
                        {lastTestOutcome.testResult.scoreDisciplineSafety}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300 pt-1">
                    <div>
                      Melhor Volta:{' '}
                      <span className="text-amber-400 font-mono font-bold">
                        {lastTestOutcome.testResult.bestLapTime}
                      </span>
                    </div>
                    <div>
                      Quilometragem:{' '}
                      <span className="font-bold">{lastTestOutcome.testResult.km} km</span>
                    </div>
                    <div>
                      Ganho Feedback Técnico:{' '}
                      <span className="text-emerald-400 font-bold">
                        +{lastTestOutcome.testResult.technicalFeedbackGain}
                      </span>
                    </div>
                  </div>

                  {lastTestOutcome.testResult.comparisonSummary && (
                    <div className="p-2 bg-amber-950/40 border border-amber-800/60 rounded text-amber-200">
                      <span className="font-semibold block text-[11px]">
                        Confronto Comparativo:
                      </span>
                      {lastTestOutcome.testResult.comparisonSummary} (Volta:{' '}
                      {lastTestOutcome.testResult.bestLapTime} vs{' '}
                      {lastTestOutcome.testResult.secondDriverBestLapTime})
                    </div>
                  )}

                  {lastTestOutcome.updatedTitularContext && (
                    <div className="p-2 bg-red-950/40 border border-red-800/60 rounded text-red-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold">Pressão Interna no Assento:</div>
                        <div>{lastTestOutcome.updatedTitularContext.reactionMessage}</div>
                        <div className="text-[10px] text-red-300">
                          Nova Seat Security:{' '}
                          {lastTestOutcome.updatedTitularContext.newSeatSecurity}% • Moral:{' '}
                          {lastTestOutcome.updatedTitularContext.newMorale}%
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ABA 2: PROGRAMA DE HOMOLOGAÇÃO FIA */}
          <TabsContent value="homologation" className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span>Status Regulamentar FIA</span>
                    {activeDriver && (
                      <Badge className="bg-slate-800 text-slate-200 border-slate-700">
                        {activeDriver.name}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {currentProgram ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Fase Atual:</span>
                        <Badge
                          className={
                            currentProgram.phase === 'superlicenca_concedida'
                              ? 'bg-emerald-600 text-white'
                              : currentProgram.phase === 'aprovado_provisoria'
                                ? 'bg-blue-600 text-white'
                                : currentProgram.phase === 'teste_adicional'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-indigo-600 text-white'
                          }
                        >
                          {currentProgram.phase === 'superlicenca_concedida'
                            ? 'Super Licença Concedida (Nível A)'
                            : currentProgram.phase === 'aprovado_provisoria'
                              ? 'Licença Provisória Aprovada (Nível B)'
                              : currentProgram.phase === 'teste_adicional'
                                ? 'Teste Adicional Obrigatório (Nota 65-74)'
                                : 'Em Homologação'}
                        </Badge>
                      </div>

                      {/* Progresso de Testes Válidos */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Testes Válidos Mínimos:</span>
                          <span className="font-bold text-slate-200">
                            {currentProgram.completedValidTests} /{' '}
                            {HOMOLOGATION_CONFIG.minValidTests} sessões
                          </span>
                        </div>
                        <Progress
                          value={
                            (currentProgram.completedValidTests /
                              HOMOLOGATION_CONFIG.minValidTests) *
                            100
                          }
                          className="h-2 bg-slate-800"
                        />
                      </div>

                      {/* Progresso de Quilometragem */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Quilometragem Homologada:</span>
                          <span className="font-bold text-slate-200">
                            {currentProgram.accumulatedHomologatedKm} / 1.200 km
                          </span>
                        </div>
                        <Progress
                          value={Math.min(
                            100,
                            (currentProgram.accumulatedHomologatedKm / 1200) * 100,
                          )}
                          className="h-2 bg-slate-800"
                        />
                      </div>

                      {/* Média de Notas */}
                      <div className="flex justify-between items-center p-2 bg-slate-950/60 rounded">
                        <span className="text-slate-400">Média Consolidada das Sessões:</span>
                        <span className="text-sm font-bold text-indigo-400">
                          {currentProgram.averageScore || 'Aguardando testes'}/100
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 pt-1">
                        Total Investido no Programa:{' '}
                        <span className="text-amber-400 font-semibold">
                          {formatCurrency(currentProgram.totalSpent)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-slate-400">
                        {activeDriver?.name || 'O piloto selecionado'} ainda não possui um Programa
                        de Homologação FIA aberto.
                      </p>
                      <Button
                        onClick={handleStartHomologation}
                        disabled={
                          isStartingHomologation ||
                          (team.budget || 0) < HOMOLOGATION_CONFIG.openingFee
                        }
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                      >
                        {isStartingHomologation
                          ? 'Registrando...'
                          : `Iniciar Programa FIA (${formatCurrency(HOMOLOGATION_CONFIG.openingFee)})`}
                      </Button>
                      <div className="text-[10px] text-slate-500">
                        Exige 4 testes válidos (≥300 km) e avaliação consolidada do comitê.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabela de Critérios Oficiais da FIA (PDF pág 5) */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" />
                    Critérios e Escalas de Homologação
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="space-y-1.5 border-b border-slate-800 pb-2">
                    <div className="flex justify-between font-medium text-slate-300">
                      <span>Ritmo de Pista (Velocidade Pura)</span>
                      <span className="text-indigo-400">Peso 30%</span>
                    </div>
                    <div className="flex justify-between font-medium text-slate-300">
                      <span>Consistência em Long Runs</span>
                      <span className="text-indigo-400">Peso 25%</span>
                    </div>
                    <div className="flex justify-between font-medium text-slate-300">
                      <span>Controle do Carro & Estabilidade</span>
                      <span className="text-indigo-400">Peso 20%</span>
                    </div>
                    <div className="flex justify-between font-medium text-slate-300">
                      <span>Feedback Técnico para Engenharia</span>
                      <span className="text-indigo-400">Peso 15%</span>
                    </div>
                    <div className="flex justify-between font-medium text-slate-300">
                      <span>Disciplina & Tomada de Risco</span>
                      <span className="text-indigo-400">Peso 10%</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <div className="font-semibold text-slate-200">Faixas de Nota Final:</div>
                    <div className="flex justify-between text-emerald-400">
                      <span>85 – 100 pontos</span>
                      <span>Super Licença (Nível A)</span>
                    </div>
                    <div className="flex justify-between text-blue-400">
                      <span>75 – 84 pontos</span>
                      <span>Licença Provisória (Nível B)</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>65 – 74 pontos</span>
                      <span>Teste Adicional Obrigatório</span>
                    </div>
                    <div className="flex justify-between text-red-400">
                      <span>&lt; 65 pontos</span>
                      <span>Programa Não Aprovado</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ABA 3: ACADEMIA & CONTRATOS */}
          <TabsContent value="academy" className="space-y-4 pt-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase text-slate-400">
                  Pilotos Vinculados à Equipe ({allTeamDevelopmentPilots.length})
                </h4>
                <span className="text-[11px] text-slate-400">
                  Pilotos de Teste: {testDrivers.length} / 2 permitidos
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allTeamDevelopmentPilots.map((pilot) => {
                  const isTestDriver = testDrivers.some((t) => t.id === pilot.id)
                  const isAcademy = academyDrivers.some((a) => a.id === pilot.id)
                  const isTitular = titularDrivers.some((t) => t.id === pilot.id)
                  const isReserve = reserveDriver?.id === pilot.id

                  return (
                    <Card key={pilot.id} className="bg-slate-900/60 border-slate-800 p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                            {pilot.name}
                            <span className="text-xs text-slate-400 font-normal">
                              ({pilot.age} anos)
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {pilot.nationality} • {pilot.category || 'F2'}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            variant="outline"
                            className="border-indigo-600 text-indigo-300 text-[10px]"
                          >
                            {pilot.license_status === 'nivel_a'
                              ? 'Super Licença'
                              : pilot.license_status === 'nivel_b'
                                ? 'Licença B (Provisória)'
                                : 'Autorização Teste (Nível C)'}
                          </Badge>
                          {isTestDriver && (
                            <Badge className="bg-amber-600 text-white text-[10px]">
                              Test Driver Oficial
                            </Badge>
                          )}
                          {isAcademy && (
                            <Badge className="bg-cyan-700 text-white text-[10px]">Academia</Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs py-1 bg-slate-950/40 rounded">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Ritmo OVR</span>
                          <span className="font-bold">{pilot.speed || 75}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Feedback Técnico</span>
                          <span className="font-bold text-cyan-300">
                            {pilot.technical_feedback || 70}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Adaptação F1</span>
                          <span className="font-bold text-indigo-300">
                            {pilot.f1_adaptation || 60}%
                          </span>
                        </div>
                      </div>

                      {/* Gestão de Assento & Função */}
                      {isTitular && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">
                              Seat Security (Segurança do Assento):
                            </span>
                            <span className="font-bold text-emerald-400">
                              {pilot.seat_security ?? 80}%
                            </span>
                          </div>
                          <Progress
                            value={pilot.seat_security ?? 80}
                            className="h-1.5 bg-slate-800"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfirmTitular(pilot)}
                            className="w-full text-[10px] h-7 border-slate-700 hover:bg-slate-800"
                          >
                            Reconfirmar Titular Publicamente (Seat Security +12)
                          </Button>
                        </div>
                      )}

                      {!isTitular && !isReserve && (
                        <div className="flex gap-2 pt-1">
                          {!isTestDriver ? (
                            <Button
                              size="sm"
                              disabled={
                                testDrivers.length >= HOMOLOGATION_CONFIG.maxTestDriversPerTeam
                              }
                              onClick={() => handlePromoteToTestDriver(pilot)}
                              className="w-full text-xs h-7 bg-amber-600 hover:bg-amber-500 text-white"
                            >
                              Designar Test Driver
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDismissTestDriver(pilot.id)}
                              className="w-full text-xs h-7 border-red-800 text-red-400 hover:bg-red-950/50"
                            >
                              Dispensar Test Driver
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>

              {/* Pilotas da F1 Academy & Jovens Talentos Elegíveis para Recrutamento */}
              {availableTalents && availableTalents.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase">
                    Pilotos Livres e F1 Academy Elegíveis ({availableTalents.length})
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {availableTalents.slice(0, 10).map((talent) => (
                      <div
                        key={talent.id}
                        className="flex items-center justify-between p-2 bg-slate-900/40 rounded border border-slate-800 text-xs"
                      >
                        <div>
                          <span className="font-semibold">{talent.name}</span>
                          <span className="text-slate-400 ml-2">
                            {talent.category === 'f1_academy'
                              ? 'F1 Academy'
                              : talent.category || 'Base'}{' '}
                            • {talent.age} anos • OVR {talent.speed || 70}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[10px] bg-indigo-600/60 hover:bg-indigo-600 text-white"
                          onClick={async () => {
                            const res = await driverDevelopmentService.addDriverToAcademy(
                              team,
                              talent,
                            )
                            if (res.success) {
                              toast({ title: 'Adicionado à Academia', description: res.message })
                              onDataChanged()
                            } else {
                              toast({
                                title: 'Não foi possível',
                                description: res.message,
                                variant: 'destructive',
                              })
                            }
                          }}
                        >
                          Adicionar à Academia
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ABA 4: HISTÓRICO DE TESTES PRIVADOS */}
          <TabsContent value="history" className="space-y-3 pt-2">
            {testResultsHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                Nenhum teste privado registrado nesta temporada. Utilize a aba de Testes para
                agendar sessões de pista.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {testResultsHistory.map((t) => (
                  <Card key={t.id} className="bg-slate-900/60 border-slate-800 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flag className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-bold text-slate-200">{t.circuit}</span>
                        <Badge variant="outline" className="text-[10px] border-slate-700">
                          {t.test_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{t.date}</span>
                        <Badge className="bg-indigo-600 text-white text-[10px]">
                          Nota: {t.finalScore}/100
                        </Badge>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-slate-300 pt-1 text-[11px]">
                      <span>
                        Piloto: <strong className="text-white">{t.driver_name}</strong>
                      </span>
                      <span>
                        Quilometragem: <strong>{t.km} km</strong>
                      </span>
                      <span>
                        Custo: <strong className="text-amber-400">{formatCurrency(t.cost)}</strong>
                      </span>
                      <span>
                        Melhor Tempo:{' '}
                        <strong className="font-mono text-cyan-300">{t.bestLapTime}</strong>
                      </span>
                    </div>

                    {t.isValidForHomologation && (
                      <div className="text-[10px] text-emerald-400 pt-0.5">
                        ✓ Sessão homologada pela FIA para Super Licença
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
export default DevelopmentManagerModal
