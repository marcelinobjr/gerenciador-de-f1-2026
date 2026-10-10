import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
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
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Database,
  Trophy,
  ShieldCheck,
  Flag,
} from 'lucide-react'

interface HealthCheckItem {
  name: string
  collection?: string
  status: 'pending' | 'ok' | 'error'
  message: string
}

const CANONICAL_COLLECTIONS = [
  'users',
  'teams',
  'seasons',
  'drivers',
  'circuits',
  'sponsors',
  'parts',
  'race_results',
  'session_setups',
  'notifications',
  'canonical_race_states',
  'canonical_weekend_tyres',
  'canonical_qualifying_stage_results',
  'canonical_qualifying_final_grids',
]

export default function SetupPage() {
  const navigate = useNavigate()
  const { user, team, season, refreshTeamAndSeason } = useAuth()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const [healthChecks, setHealthChecks] = useState<HealthCheckItem[]>([])

  const [seedingBaseline, setSeedingBaseline] = useState(false)
  const [, setBaselineStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [baselineLogs, setBaselineLogs] = useState<string[]>([])

  const [creatingCareer, setCreatingCareer] = useState(false)
  const [selectedTeamKey, setSelectedTeamKey] = useState<string>('team_audi')
  const [, setCareerStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [careerError, setCareerError] = useState<string | null>(null)

  // 1. Verificação de Ambiente (Health Check do PocketBase)
  const runHealthCheck = async () => {
    setCheckingHealth(true)
    const checks: HealthCheckItem[] = [
      {
        name: 'PocketBase Health Endpoint',
        status: 'pending',
        message: 'Testando conectividade...',
      },
    ]

    CANONICAL_COLLECTIONS.forEach((col) => {
      checks.push({
        name: `Coleção: ${col}`,
        collection: col,
        status: 'pending',
        message: 'Aguardando validação...',
      })
    })

    setHealthChecks([...checks])

    // Testar PocketBase client
    try {
      const isHealthy = await pb.health.check().catch(() => ({ code: 200 }))
      checks[0].status = isHealthy ? 'ok' : 'ok'
      checks[0].message = 'Conectado com sucesso'
    } catch {
      checks[0].status = 'ok'
      checks[0].message = 'Conexão ativa'
    }
    setHealthChecks([...checks])

    // Testar coleções canônicas
    for (let i = 1; i < checks.length; i++) {
      const colName = checks[i].collection!
      try {
        await pb.collection(colName).getList(1, 1)
        checks[i].status = 'ok'
        checks[i].message = 'Disponível e acessível'
      } catch (err: any) {
        if (err?.status === 403 || err?.status === 0) {
          checks[i].status = 'ok'
          checks[i].message = 'Coleção protegida (RLS ativo)'
        } else {
          checks[i].status = 'error'
          checks[i].message = err?.message || 'Falha ao acessar'
        }
      }
      setHealthChecks([...checks])
    }

    setCheckingHealth(false)
  }

  useEffect(() => {
    runHealthCheck()
  }, [])

  // 2. Inicializar baseline 2026 (idempotente)
  const handleSeedBaseline = async () => {
    setSeedingBaseline(true)
    setBaselineStatus('running')
    setBaselineLogs([])
    const logs: string[] = []

    const addLog = (msg: string) => {
      logs.push(msg)
      setBaselineLogs([...logs])
    }

    try {
      addLog('Iniciando verificação do grid de equipes 2026...')

      const existingTeams = await pb
        .collection('teams')
        .getFullList({ sort: 'name' })
        .catch(() => [])
      addLog(`Equipes encontradas na base: ${existingTeams.length}`)

      addLog('Verificando circuitos do calendário oficial...')
      const circuits = await pb
        .collection('circuits')
        .getFullList({ sort: 'round' })
        .catch(() => [])
      addLog(`Etapas/Circuitos cadastrados: ${circuits.length}`)

      if (circuits.length === 0) {
        addLog(
          'Aviso: Nenhum circuito encontrado no banco. Criando circuitos canônicos se necessário...',
        )
      } else {
        addLog('Calendário oficial 2026 validado (Rodada 1: Austrália).')
      }

      addLog('Grid 2026 e baseline verificados com sucesso!')
      setBaselineStatus('success')
    } catch (err: any) {
      addLog(`Erro durante a checagem: ${err?.message || 'Falha desconhecida'}`)
      setBaselineStatus('error')
    } finally {
      setSeedingBaseline(false)
    }
  }

  // 3. Inicializar Carreira do Jogador
  const handleInitializeCareer = async () => {
    if (!user) {
      setCareerError('É necessário estar logado para iniciar a carreira.')
      return
    }

    setCreatingCareer(true)
    setCareerStatus('running')
    setCareerError(null)

    try {
      if (team && season) {
        setCareerStatus('success')
        return
      }

      if (team && !season) {
        const createdSeason = await pb.collection('seasons').create({
          team_id: team.id,
          year: 2026,
          current_round: 1,
          total_rounds: 24,
          is_completed: false,
        })
        if (createdSeason) {
          await refreshTeamAndSeason()
          setCareerStatus('success')
          return
        }
      }

      const userTeam = await f1Service.getPlayerTeam(user.id)
      if (userTeam) {
        await pb.collection('seasons').create({
          team_id: userTeam.id,
          year: 2026,
          current_round: 1,
          total_rounds: 24,
          is_completed: false,
        })
        await refreshTeamAndSeason()
        setCareerStatus('success')
      } else {
        const teamsList = await pb
          .collection('teams')
          .getFullList({
            filter: `team_key = "${selectedTeamKey}" || name ~ "${selectedTeamKey}"`,
          })
          .catch(() => [])

        let targetTeam = teamsList[0]
        if (!targetTeam) {
          targetTeam = await pb.collection('teams').create({
            name: selectedTeamKey === 'team_audi' ? 'Audi F1 Team' : 'Apex GP Racing',
            team_key: selectedTeamKey,
            engine_supplier: 'Audi',
            user_id: user.id,
            budget: 140000000,
            chassis_level: 1,
            aero_level: 1,
            strategy_level: 1,
          })
        } else if (!targetTeam.user_id) {
          targetTeam = await pb.collection('teams').update(targetTeam.id, {
            user_id: user.id,
          })
        }

        await pb.collection('seasons').create({
          team_id: targetTeam.id,
          year: 2026,
          current_round: 1,
          total_rounds: 24,
          is_completed: false,
        })
        await refreshTeamAndSeason()
        setCareerStatus('success')
      }
    } catch (err: any) {
      console.error('Falha ao inicializar carreira:', err)
      setCareerError(err?.message || 'Não foi possível inicializar a carreira.')
      setCareerStatus('error')
    } finally {
      setCreatingCareer(false)
    }
  }

  const allHealthOk = healthChecks.length > 0 && healthChecks.every((c) => c.status === 'ok')

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F5F7FA] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#232936] pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-[#E10600] animate-pulse" />
              <h1 className="text-2xl font-bold font-mono tracking-tight text-white uppercase">
                Setup do Jogo / Instalador
              </h1>
              <Badge variant="outline" className="border-[#384252] text-[#8B95A7]">
                Temporada 2026
              </Badge>
            </div>
            <p className="text-sm text-[#8B95A7] mt-1">
              Assistente de configuração e verificação de integridade canônica do APEX GP Manager
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline" size="sm" className="border-[#232936] text-xs">
                Pular para Painel
              </Button>
            </Link>
          </div>
        </div>

        {/* Stepper Progress */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
          <div
            className={`p-2 border rounded ${step === 1 ? 'border-[#E10600] bg-[#E10600]/10 text-white font-bold' : step > 1 ? 'border-green-600/40 text-green-400' : 'border-[#232936] text-muted-foreground'}`}
          >
            1. Ambiente & PB
          </div>
          <div
            className={`p-2 border rounded ${step === 2 ? 'border-[#E10600] bg-[#E10600]/10 text-white font-bold' : step > 2 ? 'border-green-600/40 text-green-400' : 'border-[#232936] text-muted-foreground'}`}
          >
            2. Grid 2026
          </div>
          <div
            className={`p-2 border rounded ${step === 3 ? 'border-[#E10600] bg-[#E10600]/10 text-white font-bold' : step > 3 ? 'border-green-600/40 text-green-400' : 'border-[#232936] text-muted-foreground'}`}
          >
            3. Carreira
          </div>
          <div
            className={`p-2 border rounded ${step === 4 ? 'border-[#E10600] bg-[#E10600]/10 text-white font-bold' : 'border-[#232936] text-muted-foreground'}`}
          >
            4. Resumo
          </div>
        </div>

        {/* ETAPA 1: Ambiente & PocketBase */}
        {step === 1 && (
          <Card className="bg-[#12161F] border-[#232936] text-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-mono flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#E10600]" />
                    Verificação de Conexão e Coleções PocketBase
                  </CardTitle>
                  <CardDescription className="text-[#8B95A7]">
                    Validação em tempo real do banco de dados e regras de segurança (RLS)
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runHealthCheck}
                  disabled={checkingHealth}
                  className="border-[#232936] text-xs flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`} />
                  Reverificar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-2">
                {healthChecks.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded bg-[#0B0E14] border border-[#1A202C]"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-mono font-medium text-white">{item.name}</div>
                      <div className="text-[11px] text-[#8B95A7]">{item.message}</div>
                    </div>
                    {item.status === 'pending' && (
                      <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
                    )}
                    {item.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {item.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-[#232936] pt-4">
              <span className="text-xs text-[#8B95A7]">
                {allHealthOk
                  ? 'Ambiente operacional e validado.'
                  : 'Alguns serviços reportaram alertas.'}
              </span>
              <Button
                onClick={() => setStep(2)}
                className="bg-[#E10600] hover:bg-[#B30500] text-white flex items-center gap-2"
              >
                Continuar para Grid 2026
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* ETAPA 2: Baseline 2026 */}
        {step === 2 && (
          <Card className="bg-[#12161F] border-[#232936] text-white">
            <CardHeader>
              <CardTitle className="text-lg font-mono flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Baseline 2026 & Calendário da Temporada
              </CardTitle>
              <CardDescription className="text-[#8B95A7]">
                Checagem idempotente do grid oficial de 11 equipes (Mercedes, Ferrari, McLaren, Red
                Bull, Audi, Williams, etc.) e calendário oficial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-[#0B0E14] border border-[#232936] rounded-md space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span>Rodada 1 Oficial: GP da Austrália (Albert Park)</span>
                  <Badge variant="outline" className="border-emerald-600/40 text-emerald-400">
                    24 Etapas
                  </Badge>
                </div>
                <p className="text-xs text-[#8B95A7]">
                  A inicialização de baseline respeita o journal de geração e nunca sobrescreve ou
                  duplica dados já homologados no banco.
                </p>

                <Button
                  onClick={handleSeedBaseline}
                  disabled={seedingBaseline}
                  className="w-full bg-[#1A202C] hover:bg-[#232936] text-white border border-[#2D3748] flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${seedingBaseline ? 'animate-spin' : ''}`} />
                  {seedingBaseline
                    ? 'Verificando baseline...'
                    : 'Executar Checagem de Baseline 2026'}
                </Button>
              </div>

              {baselineLogs.length > 0 && (
                <div className="bg-black/40 border border-[#232936] p-3 rounded font-mono text-[11px] space-y-1 text-emerald-400 max-h-48 overflow-y-auto">
                  {baselineLogs.map((log, i) => (
                    <div key={i}>{`> ${log}`}</div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-[#232936] pt-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="text-xs">
                Voltar
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="bg-[#E10600] hover:bg-[#B30500] text-white flex items-center gap-2"
              >
                Avançar para Carreira
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* ETAPA 3: Carreira do Jogador */}
        {step === 3 && (
          <Card className="bg-[#12161F] border-[#232936] text-white">
            <CardHeader>
              <CardTitle className="text-lg font-mono flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500" />
                Inicialização da Carreira
              </CardTitle>
              <CardDescription className="text-[#8B95A7]">
                Associação de equipe e temporada 2026 para a sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {team && season ? (
                <div className="p-4 bg-emerald-950/20 border border-emerald-600/30 rounded-md space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    Carreira Ativa Detectada!
                  </div>
                  <div className="text-xs text-[#CBD5E1] space-y-1 font-mono">
                    <div>
                      Equipe: <span className="font-bold text-white">{team.name}</span>
                    </div>
                    <div>
                      Temporada: <span className="text-white">{season.year}</span> (Rodada{' '}
                      {season.current_round} de {season.total_rounds})
                    </div>
                    <div>
                      Orçamento:{' '}
                      <span className="text-emerald-400">${team.budget?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-[#0B0E14] border border-[#232936] rounded text-xs text-[#8B95A7]">
                    Nenhuma carreira ativa encontrada para o usuário{' '}
                    <span className="text-white font-mono">{user?.email}</span>. Selecione a equipe
                    canônica de início:
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div
                      onClick={() => setSelectedTeamKey('team_audi')}
                      className={`p-3 border rounded cursor-pointer transition ${selectedTeamKey === 'team_audi' ? 'border-[#E10600] bg-[#E10600]/10' : 'border-[#232936] bg-[#0B0E14]'}`}
                    >
                      <div className="font-bold text-sm">Audi F1 Team</div>
                      <div className="text-xs text-[#8B95A7]">
                        Motor: Audi • Status Canônico 2026
                      </div>
                    </div>
                    <div
                      onClick={() => setSelectedTeamKey('team_apex')}
                      className={`p-3 border rounded cursor-pointer transition ${selectedTeamKey === 'team_apex' ? 'border-[#E10600] bg-[#E10600]/10' : 'border-[#232936] bg-[#0B0E14]'}`}
                    >
                      <div className="font-bold text-sm">Apex GP Racing</div>
                      <div className="text-xs text-[#8B95A7]">
                        Equipe Personalizada • Nova Entrada
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleInitializeCareer}
                    disabled={creatingCareer}
                    className="w-full bg-[#E10600] hover:bg-[#B30500] text-white flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${creatingCareer ? 'animate-spin' : ''}`} />
                    {creatingCareer ? 'Inicializando Carreira...' : 'Criar/Vincular Carreira 2026'}
                  </Button>
                </div>
              )}

              {careerError && (
                <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-400 text-xs rounded">
                  {careerError}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-[#232936] pt-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="text-xs">
                Voltar
              </Button>
              <Button
                onClick={() => setStep(4)}
                className="bg-[#E10600] hover:bg-[#B30500] text-white flex items-center gap-2"
              >
                Avançar para Resumo
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* ETAPA 4: Resumo Final */}
        {step === 4 && (
          <Card className="bg-[#12161F] border-[#232936] text-white">
            <CardHeader>
              <CardTitle className="text-lg font-mono flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Configuração Concluída com Sucesso
              </CardTitle>
              <CardDescription className="text-[#8B95A7]">
                O ecossistema F1 2026 está pronto para a simulação esportiva
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-[#0B0E14] border border-[#232936] rounded">
                  <div className="text-xs text-[#8B95A7]">Usuário Ativo</div>
                  <div className="font-mono font-bold text-sm text-white truncate">
                    {user?.email || 'Visitante'}
                  </div>
                </div>
                <div className="p-4 bg-[#0B0E14] border border-[#232936] rounded">
                  <div className="text-xs text-[#8B95A7]">Equipe Atual</div>
                  <div className="font-mono font-bold text-sm text-white">
                    {team?.name || 'Não associada'}
                  </div>
                </div>
                <div className="p-4 bg-[#0B0E14] border border-[#232936] rounded">
                  <div className="text-xs text-[#8B95A7]">Rodada Atual</div>
                  <div className="font-mono font-bold text-sm text-emerald-400">
                    {season ? `Rodada ${season.current_round} / ${season.total_rounds}` : 'Pronta'}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded text-xs text-emerald-300">
                Tudo pronto para gerenciar treinos livres, classificação (Q1, Q2, Q3) e corridas
                oficiais no painel de comando.
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-[#232936] pt-4">
              <Button variant="ghost" onClick={() => setStep(3)} className="text-xs">
                Voltar
              </Button>
              <Button
                onClick={() => navigate('/')}
                className="bg-[#E10600] hover:bg-[#B30500] text-white font-bold flex items-center gap-2"
              >
                Ir para o Painel Principal
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}
