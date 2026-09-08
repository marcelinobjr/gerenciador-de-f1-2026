import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { DriverModel } from '@/types/f1'
import { formatCurrency } from '@/lib/formatters'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { toast } from '@/hooks/use-toast'
import {
  Users,
  Briefcase,
  AlertTriangle,
  Sliders,
  DollarSign,
  TrendingUp,
  Shield,
  CloudRain,
  Flame,
  CheckCircle2,
  Wrench,
  XCircle,
  Calendar,
  Sparkles,
  ArrowRightLeft,
  UserCheck,
  Award,
  Activity,
  HeartPulse,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

export default function TeamPage() {
  const { team, season, refreshTeamAndSeason } = useAuth()

  const [teamDrivers, setTeamDrivers] = useState<DriverModel[]>([])
  const [marketDrivers, setMarketDrivers] = useState<DriverModel[]>([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [renegotiateDriver, setRenegotiateDriver] = useState<DriverModel | null>(null)
  const [salaryMultiplier, setSalaryMultiplier] = useState<number>(100) // 80% to 120%
  const [contractYears, setContractYears] = useState<number>(1)

  const [fireDriver, setFireDriver] = useState<DriverModel | null>(null)
  const [hireDriver, setHireDriver] = useState<DriverModel | null>(null)
  const [hireRole, setHireRole] = useState<'titular' | 'reserva'>('titular')
  const [driverToReplaceId, setDriverToReplaceId] = useState<string>('')

  // FP practice modal
  const [fpModalOpen, setFpModalOpen] = useState(false)
  const [selectedFpRounds, setSelectedFpRounds] = useState<number[]>([7, 13])

  const [isProcessing, setIsProcessing] = useState(false)
  const [marketTab, setMarketTab] = useState<'todos' | 'f2' | 'mercado'>('todos')

  // Team strength calculation / display
  const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
  const teamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)

  const loadData = async () => {
    if (!team) {
      setLoading(false)
      return
    }
    try {
      const [tDrivers, mDrivers] = await Promise.all([
        f1Service.getTeamDrivers(team.id),
        f1Service.getMarketDrivers(),
      ])
      setTeamDrivers(tDrivers)
      setMarketDrivers(mDrivers)
    } catch (err) {
      console.error('Error loading team page data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [team?.id])

  useRealtime('drivers', () => {
    loadData()
  })

  // Separate starters and reserve
  const titularDrivers = useMemo(
    () => teamDrivers.filter((d) => d.role !== 'reserva' && d.team_id === team?.id),
    [teamDrivers, team?.id],
  )

  const reserveDriver = useMemo(
    () =>
      teamDrivers.find(
        (d) => d.role === 'reserva' || (d.reserve_team_id === team?.id && d.team_id !== team?.id),
      ),
    [teamDrivers, team?.id],
  )

  // Current incapacitated driver (if any)
  const incapacitatedDriver = useMemo(
    () => titularDrivers.find((d) => d.is_incapacitated),
    [titularDrivers],
  )

  // Filtered market drivers based on tab
  const filteredMarket = useMemo(() => {
    if (marketTab === 'f2') return marketDrivers.filter((d) => d.category === 'f2')
    if (marketTab === 'mercado')
      return marketDrivers.filter((d) => d.category === 'mercado' || !d.category)
    return marketDrivers
  }, [marketDrivers, marketTab])

  // Flag emoji helper
  const getFlag = (nat: string) => {
    switch (nat?.toLowerCase()) {
      case 'brasil':
      case 'bra':
        return '🇧🇷'
      case 'reino unido':
      case 'gbr':
        return '🇬🇧'
      case 'holanda':
      case 'ned':
        return '🇳🇱'
      case 'mônaco':
      case 'mon':
        return '🇲🇨'
      case 'austrália':
      case 'aus':
        return '🇦🇺'
      case 'espanha':
      case 'esp':
        return '🇪🇸'
      case 'argentina':
      case 'arg':
        return '🇦🇷'
      case 'japão':
      case 'jpn':
        return '🇯🇵'
      case 'alemanha':
      case 'ger':
        return '🇩🇪'
      case 'frança':
      case 'fra':
        return '🇫🇷'
      case 'itália':
      case 'ita':
        return '🇮🇹'
      case 'estados unidos':
      case 'usa':
        return '🇺🇸'
      case 'dinamarca':
        return '🇩🇰'
      case 'finlândia':
        return '🇫🇮'
      case 'méxico':
        return '🇲🇽'
      case 'suécia':
        return '🇸🇪'
      case 'colômbia':
        return '🇨🇴'
      case 'estônia':
        return '🇪🇪'
      case 'barbados':
        return '🇧🇧'
      case 'china':
        return '🇨🇳'
      case 'noruega':
        return '🇳🇴'
      case 'paraguai':
        return '🇵🇾'
      case 'índia':
        return '🇮🇳'
      case 'polônia':
        return '🇵🇱'
      case 'irlanda':
        return '🇮🇪'
      case 'república tcheca':
        return '🇨🇿'
      case 'bélgica':
        return '🇧🇪'
      default:
        return '🏁'
    }
  }

  // Renegotiate contract handler
  const handleRenegotiate = async () => {
    if (!renegotiateDriver || !team) return
    setIsProcessing(true)
    try {
      const newSalary = Math.round(renegotiateDriver.salary * (salaryMultiplier / 100))
      const newContractEnd = 2026 + contractYears

      await f1Service.updateDriver(renegotiateDriver.id, {
        salary: newSalary,
        contract_end: newContractEnd,
      })

      await f1Service.addEvent(
        team.id,
        `Contrato de ${renegotiateDriver.name} renovado até ${newContractEnd} por ${formatCurrency(newSalary)}/ano.`,
        'contrato',
      )

      toast({
        title: 'Contrato Renegociado!',
        description: `${renegotiateDriver.name} assinou até ${newContractEnd} com salário de ${formatCurrency(newSalary)}.`,
      })

      setRenegotiateDriver(null)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na renegociação',
        description: err?.message || 'Não foi possível renegociar o contrato.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Fire driver handler
  const handleFire = async () => {
    if (!fireDriver || !team) return
    setIsProcessing(true)
    try {
      const penaltyCost = Math.round(fireDriver.salary * 0.5)
      if (team.budget < penaltyCost) {
        toast({
          variant: 'destructive',
          title: 'Orçamento Insuficiente',
          description: `Você precisa de ${formatCurrency(penaltyCost)} para pagar a multa rescisória de 50%.`,
        })
        setIsProcessing(false)
        return
      }

      // Deduct budget
      const updatedBudget = team.budget - penaltyCost
      await f1Service.updateTeam(team.id, { budget: updatedBudget })

      // Release driver to market
      await f1Service.fireDriver(fireDriver.id)

      await f1Service.addEvent(
        team.id,
        `${fireDriver.name} foi dispensado. Multa rescisória de ${formatCurrency(penaltyCost)} paga.`,
        'contrato',
      )

      toast({
        title: 'Piloto Dispensado',
        description: `${fireDriver.name} liberado para o mercado. Multa paga: ${formatCurrency(penaltyCost)}.`,
      })

      setFireDriver(null)
      refreshTeamAndSeason()
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao demitir piloto',
        description: err?.message || 'Falha ao processar rescisão.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Open Hire dialog
  const openHireDialog = (driver: DriverModel) => {
    setHireDriver(driver)
    setHireRole('titular')
    if (titularDrivers.length >= 2) {
      setDriverToReplaceId(titularDrivers[0]?.id || '')
    } else {
      setDriverToReplaceId('')
    }
  }

  // Hire driver handler
  const handleHire = async () => {
    if (!hireDriver || !team) return
    setIsProcessing(true)
    try {
      const variation = 0.95 + Math.random() * 0.1
      const finalSalary = Math.round(hireDriver.salary * variation)

      if (team.budget < finalSalary) {
        toast({
          variant: 'destructive',
          title: 'Orçamento Insuficiente',
          description: `Orçamento insuficiente para bancar o salário de ${formatCurrency(finalSalary)}.`,
        })
        setIsProcessing(false)
        return
      }

      if (hireRole === 'titular') {
        if (titularDrivers.length >= 2 && driverToReplaceId) {
          const replacedDriver = titularDrivers.find((d) => d.id === driverToReplaceId)
          if (replacedDriver) {
            await f1Service.fireDriver(replacedDriver.id)
          }
        }
        await f1Service.hireDriver(hireDriver.id, team.id, 'titular')
      } else {
        if (reserveDriver) {
          await f1Service.fireDriver(reserveDriver.id)
        }
        await f1Service.hireDriver(hireDriver.id, team.id, 'reserva')
      }

      await f1Service.addEvent(
        team.id,
        `${hireDriver.name} contratado como ${hireRole === 'titular' ? 'titular' : 'piloto reserva'} com salário de ${formatCurrency(finalSalary)}/ano!`,
        'contrato',
      )

      toast({
        title: 'Contratação Realizada!',
        description: `${hireDriver.name} é o novo ${hireRole === 'titular' ? 'titular' : 'piloto reserva'} da ${team.name}.`,
      })

      setHireDriver(null)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na contratação',
        description: err?.message || 'Não foi possível contratar o piloto.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Save FP Schedule handler
  const handleSaveFpSchedule = async () => {
    if (!reserveDriver || !team) return
    if (selectedFpRounds.length !== 2) {
      toast({
        variant: 'destructive',
        title: 'Seleção Inválida',
        description:
          'Você deve selecionar exatamente 2 Grandes Prêmios para os treinos livres do reserva.',
      })
      return
    }

    setIsProcessing(true)
    try {
      await f1Service.scheduleReserveFP(reserveDriver.id, selectedFpRounds)
      await f1Service.addEvent(
        team.id,
        `Piloto reserva ${reserveDriver.name} escalado para os treinos livres dos GPs: ${selectedFpRounds.map((r) => F1_2026_CALENDAR[r - 1]?.name || `GP ${r}`).join(' e ')}.`,
        'desenvolvimento',
      )

      toast({
        title: 'Treinos Livres Agendados!',
        description: `${reserveDriver.name} participará do FP1 nos GPs ${selectedFpRounds.join(' e ')}. Isso gerará dados e bônus de setup!`,
      })

      setFpModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao agendar treinos livres',
        description: err?.message || 'Não foi possível agendar.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const toggleFpRound = (roundNumber: number) => {
    if (selectedFpRounds.includes(roundNumber)) {
      setSelectedFpRounds(selectedFpRounds.filter((r) => r !== roundNumber))
    } else {
      if (selectedFpRounds.length >= 2) {
        // replace oldest
        setSelectedFpRounds([selectedFpRounds[1], roundNumber])
      } else {
        setSelectedFpRounds([...selectedFpRounds, roundNumber])
      }
    }
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-[#E10600] uppercase">
            Gestão Esportiva & Elenco 2026
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA] mt-1">
            Equipe & Mercado de Pilotos
          </h1>
          <p className="text-sm text-[#8B95A7] mt-0.5">
            Estrutura oficial de 2 titulares + 1 piloto reserva com 2 sessões de treino livre/ano,
            substituição por incapacidade e mercado com revelações da F2.
          </p>
        </div>

        {/* Indicador de Força da Equipe */}
        <div className="bg-[#11161F] border border-[#1F2733] px-4 py-2.5 rounded-xl flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-mono text-[#8B95A7] uppercase block">
              Força da Escuderia
            </span>
            <span className="text-xl font-mono font-black text-amber-400">{teamStrength}/100</span>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-amber-500/40 text-amber-400 bg-amber-500/10"
          >
            {isCustomTeam ? '12ª Equipe Própria' : 'Equipe Oficial 2026'}
          </Badge>
        </div>
      </div>

      {/* Alerta de Piloto Incapacitado (se houver) */}
      {incapacitatedDriver && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3">
          <HeartPulse className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
              Afastamento Médico Ativo: {incapacitatedDriver.name}
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                {incapacitatedDriver.incapacitated_rounds_left} corrida(s) restante(s)
              </Badge>
            </div>
            <p className="text-zinc-300">
              Motivo:{' '}
              <strong className="text-white">
                {incapacitatedDriver.incapacitated_reason || 'Lesão em treino físico'}
              </strong>
              . Durante o afastamento, o piloto reserva{' '}
              <strong className="text-amber-400">
                {reserveDriver?.name || 'seu reserva oficial'}
              </strong>{' '}
              assume automaticamente o cockpit na corrida!
            </p>
          </div>
        </div>
      )}

      {/* Seção 1: Pilotos Titulares (2 titulares) */}
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#E10600]" />
                Pilotos Titulares ({titularDrivers.length}/2)
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                Disputam a pontuação do mundial de pilotos e construtores. Influenciam ritmo, Modo
                Overtake e estabilidade na chuva.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full bg-[#1F2733]" />
              <Skeleton className="h-28 w-full bg-[#1F2733]" />
            </div>
          ) : titularDrivers.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[#1F2733] rounded-xl text-[#8B95A7]">
              <p>Você ainda não possui pilotos titulares contratados.</p>
              <p className="text-xs mt-1 text-[#00A6FB]">
                Contrate pilotos titulares no mercado de agentes livres abaixo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {titularDrivers.map((driver, index) => {
                const isIncapacitated = !!driver.is_incapacitated
                return (
                  <div
                    key={driver.id}
                    className={`p-4 rounded-xl bg-[#0B0E14] border space-y-4 transition-all ${
                      isIncapacitated
                        ? 'border-amber-500/60 bg-amber-950/10'
                        : 'border-[#1F2733] hover:border-[#1F2733]/80'
                    }`}
                  >
                    {/* Driver Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1F2733] border border-[#1F2733] flex items-center justify-center font-mono font-bold text-sm text-[#F5F7FA]">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-base text-[#F5F7FA]">{driver.name}</h3>
                            <span className="text-sm" title={driver.nationality}>
                              {getFlag(driver.nationality)}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-[#8B95A7]">
                            {driver.age} anos • Fim de Contrato:{' '}
                            <strong className="text-[#F5F7FA]">{driver.contract_end}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isIncapacitated ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-400 bg-amber-500/10 text-xs font-mono flex items-center gap-1"
                          >
                            <HeartPulse className="w-3 h-3" /> Incapacitado (
                            {driver.incapacitated_rounds_left}r)
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/5 text-xs font-mono"
                          >
                            Titular Ativo
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Attributes Bars */}
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[#8B95A7]">
                          <span className="flex items-center gap-1">
                            <Flame className="w-3 h-3 text-[#E10600]" /> Velocidade
                          </span>
                          <span className="text-[#F5F7FA] font-bold">{driver.speed}</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#1F2733] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#E10600]"
                            style={{ width: `${driver.speed}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[#8B95A7]">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-[#00A6FB]" /> Consistência
                          </span>
                          <span className="text-[#F5F7FA] font-bold">{driver.consistency}</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#1F2733] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#00A6FB]"
                            style={{ width: `${driver.consistency}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[#8B95A7]">
                          <span className="flex items-center gap-1">
                            <CloudRain className="w-3 h-3 text-sky-400" /> Chuva
                          </span>
                          <span className="text-[#F5F7FA] font-bold">{driver.rain}</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#1F2733] rounded-full overflow-hidden">
                          <div className="h-full bg-sky-400" style={{ width: `${driver.rain}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[#8B95A7]">
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3 text-amber-400" /> Defesa
                          </span>
                          <span className="text-[#F5F7FA] font-bold">{driver.defense}</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#1F2733] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${driver.defense}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Salary & Action Buttons */}
                    <div className="pt-2 border-t border-[#1F2733] flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-[#8B95A7] block text-[10px]">Salário Anual</span>
                        <strong className="text-[#F5F7FA] text-sm">
                          {formatCurrency(driver.salary)}
                        </strong>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRenegotiateDriver(driver)
                            setSalaryMultiplier(100)
                            setContractYears(1)
                          }}
                          className="border-[#1F2733] text-xs h-8 hover:bg-[#1F2733] text-[#F5F7FA]"
                        >
                          <Sliders className="w-3.5 h-3.5 mr-1" />
                          Renegociar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFireDriver(driver)}
                          className="text-xs h-8 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Dispensar
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 2: Piloto Reserva (1 Piloto Reserva Oficial) */}
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                Piloto Reserva Oficial (1 Piloto)
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                Cumpre as 2 sessões obrigatórias de Treino Livre (FP1) no ano e substitui qualquer
                titular incapacitado.
              </CardDescription>
            </div>

            {reserveDriver && (
              <Button
                onClick={() => {
                  const currentScheduled = reserveDriver.fp_scheduled_rounds || [7, 13]
                  setSelectedFpRounds(currentScheduled)
                  setFpModalOpen(true)
                }}
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs h-8 shadow"
              >
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                Agendar 2 Treinos Livres (FP1)
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!reserveDriver ? (
            <div className="p-6 text-center border border-dashed border-[#1F2733] rounded-xl text-[#8B95A7] space-y-2">
              <p className="text-sm text-foreground">
                Sua equipe não possui piloto reserva no momento.
              </p>
              <p className="text-xs text-muted-foreground">
                Contrate um piloto reserva no mercado livre abaixo para cumprir os 2 treinos livres
                do ano e proteger seu time contra lesões.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-mono font-bold text-sm text-amber-400">
                    FP
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-[#F5F7FA]">{reserveDriver.name}</h3>
                      <span className="text-sm" title={reserveDriver.nationality}>
                        {getFlag(reserveDriver.nationality)}
                      </span>
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] font-mono">
                        Reserva Oficial
                      </Badge>
                    </div>
                    <p className="text-xs font-mono text-[#8B95A7]">
                      {reserveDriver.age} anos • Salário Anual:{' '}
                      <strong className="text-foreground">
                        {formatCurrency(reserveDriver.salary)}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Status / Ação do Reserva */}
                <div className="flex items-center gap-2">
                  {incapacitatedDriver ? (
                    <Badge className="bg-amber-500 text-black font-bold text-xs px-2.5 py-1 flex items-center gap-1.5 animate-pulse">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Substituindo {incapacitatedDriver.name} no próximo GP!
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs font-mono"
                    >
                      Pronto para pilotar
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFireDriver(reserveDriver)}
                    className="text-xs h-8 text-red-400 hover:text-red-300 hover:bg-red-950/20"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Dispensar
                  </Button>
                </div>
              </div>

              {/* Informações dos 2 Treinos Livres */}
              <div className="p-3 rounded-lg bg-[#11161F] border border-[#1F2733] space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-muted-foreground font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Participação Obrigatória em Treinos Livres da Temporada:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-foreground font-semibold">
                      Completados: {reserveDriver.fp_sessions_completed || 0}/2
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-muted-foreground font-mono">GPs Escalados:</span>
                  {(reserveDriver.fp_scheduled_rounds || [7, 13]).map((roundNum) => {
                    const gp = F1_2026_CALENDAR[roundNum - 1]
                    const currentRd = season?.current_round || 1
                    const isDone = roundNum < currentRd
                    const isCurrent = roundNum === currentRd
                    return (
                      <Badge
                        key={roundNum}
                        variant="outline"
                        className={`font-mono text-xs px-2.5 py-0.5 ${
                          isDone
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                            : isCurrent
                              ? 'border-amber-500 bg-amber-500/20 text-amber-300 animate-pulse'
                              : 'border-border bg-background/50 text-foreground'
                        }`}
                      >
                        {gp ? `${gp.flag} ${gp.name} (R${roundNum})` : `GP ${roundNum}`}
                        {isDone ? ' ✓ Feito' : isCurrent ? ' (Este GP!)' : ''}
                      </Badge>
                    )
                  })}
                </div>

                <p className="text-[11px] text-muted-foreground italic">
                  💡 Benefício do treino do reserva: coletar dados no FP1 concede +2pts de acerto
                  (setup) para a corrida seguinte e melhora os atributos do reserva ao longo do ano.
                </p>
              </div>

              {/* Atributos do Reserva */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-1">
                <div className="p-2 rounded bg-[#11161F] border border-[#1F2733] flex justify-between">
                  <span className="text-[#8B95A7]">Velocidade:</span>
                  <strong className="text-[#E10600]">{reserveDriver.speed}</strong>
                </div>
                <div className="p-2 rounded bg-[#11161F] border border-[#1F2733] flex justify-between">
                  <span className="text-[#8B95A7]">Consistência:</span>
                  <strong className="text-[#00A6FB]">{reserveDriver.consistency}</strong>
                </div>
                <div className="p-2 rounded bg-[#11161F] border border-[#1F2733] flex justify-between">
                  <span className="text-[#8B95A7]">Chuva:</span>
                  <strong className="text-sky-400">{reserveDriver.rain}</strong>
                </div>
                <div className="p-2 rounded bg-[#11161F] border border-[#1F2733] flex justify-between">
                  <span className="text-[#8B95A7]">Defesa:</span>
                  <strong className="text-amber-400">{reserveDriver.defense}</strong>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 3: Mercado de Pilotos Disponíveis (F2 + Mercado) */}
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-amber-400" />
                Mercado de Pilotos Disponíveis ({filteredMarket.length} pilotos)
              </CardTitle>
              <CardDescription className="text-xs text-[#8B95A7]">
                Garimpe jovens promessas do grid atual da F2 ou veteranos livres no mercado sem
                assento em 2026.
              </CardDescription>
            </div>

            {/* Filter Tabs */}
            <Tabs
              value={marketTab}
              onValueChange={(v) => setMarketTab(v as any)}
              className="w-full sm:w-auto"
            >
              <TabsList className="bg-[#0B0E14] border border-[#1F2733] h-8 p-0.5">
                <TabsTrigger
                  value="todos"
                  className="text-xs px-2.5 py-1 data-[state=active]:bg-[#1F2733] data-[state=active]:text-white"
                >
                  Todos ({marketDrivers.length})
                </TabsTrigger>
                <TabsTrigger
                  value="f2"
                  className="text-xs px-2.5 py-1 data-[state=active]:bg-[#00A6FB] data-[state=active]:text-white font-semibold"
                >
                  Grid F2 ({marketDrivers.filter((d) => d.category === 'f2').length})
                </TabsTrigger>
                <TabsTrigger
                  value="mercado"
                  className="text-xs px-2.5 py-1 data-[state=active]:bg-amber-500 data-[state=active]:text-black font-semibold"
                >
                  Mercado F1 (
                  {marketDrivers.filter((d) => d.category === 'mercado' || !d.category).length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full bg-[#1F2733]" />
              <Skeleton className="h-16 w-full bg-[#1F2733]" />
              <Skeleton className="h-16 w-full bg-[#1F2733]" />
            </div>
          ) : filteredMarket.length === 0 ? (
            <p className="text-center py-6 text-xs text-[#8B95A7]">
              Nenhum piloto nesta categoria no momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#1F2733] text-[#8B95A7] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Origem</th>
                    <th className="py-2.5 px-3">Piloto</th>
                    <th className="py-2.5 px-2">Idade</th>
                    <th className="py-2.5 px-2 text-center">Vel</th>
                    <th className="py-2.5 px-2 text-center">Cons</th>
                    <th className="py-2.5 px-2 text-center">Chuva</th>
                    <th className="py-2.5 px-2 text-center">Def</th>
                    <th className="py-2.5 px-3">Salário Pedido</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2733]/60">
                  {filteredMarket.map((driver) => {
                    const isF2 = driver.category === 'f2'
                    return (
                      <tr key={driver.id} className="hover:bg-[#161D29]/40 transition-colors">
                        <td className="py-3 px-3">
                          {isF2 ? (
                            <Badge className="bg-[#00A6FB]/20 text-[#00A6FB] border-[#00A6FB]/30 font-bold text-[10px]">
                              F2
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-bold text-[10px]">
                              MERCADO
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span>{getFlag(driver.nationality)}</span>
                            <span className="font-semibold text-sm text-[#F5F7FA]">
                              {driver.name}
                            </span>
                            <span className="text-[10px] text-[#8B95A7]">
                              ({driver.nationality})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-[#8B95A7]">{driver.age}</td>
                        <td className="py-3 px-2 text-center font-bold text-[#E10600]">
                          {driver.speed}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-[#00A6FB]">
                          {driver.consistency}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-sky-400">
                          {driver.rain}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-amber-400">
                          {driver.defense}
                        </td>
                        <td className="py-3 px-3 text-[#F5F7FA] font-bold">
                          {formatCurrency(driver.salary)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Button
                            size="sm"
                            onClick={() => openHireDialog(driver)}
                            className="bg-[#E10600] hover:bg-[#FF2E25] text-white text-xs h-7 px-3 shadow"
                          >
                            Contratar
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Agendar Treinos Livres do Reserva */}
      <Dialog open={fpModalOpen} onOpenChange={setFpModalOpen}>
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA] max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              Escalar Reserva para 2 Treinos Livres (FP1)
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Selecione em quais 2 Grandes Prêmios da temporada 2026 o piloto{' '}
              <strong className="text-white">{reserveDriver?.name}</strong> participará do primeiro
              treino livre oficial (FP1).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-1">
              <div className="flex justify-between font-mono">
                <span className="text-[#8B95A7]">Treinos selecionados:</span>
                <strong className="text-amber-400 font-bold">
                  {selectedFpRounds.length} de 2 permitidos
                </strong>
              </div>
              <p className="text-[11px] text-[#8B95A7]">
                Durante o GP escolhido, o piloto reserva coleta telemetria avançada, garantindo um
                bônus de setup no fim de semana e evoluindo seus próprios atributos.
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {F1_2026_CALENDAR.map((gp, idx) => {
                const roundNum = idx + 1
                const isSelected = selectedFpRounds.includes(roundNum)
                const currentRd = season?.current_round || 1
                const isPast = roundNum < currentRd

                return (
                  <div
                    key={gp.round}
                    onClick={() => !isPast && toggleFpRound(roundNum)}
                    className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                      isPast
                        ? 'opacity-40 cursor-not-allowed border-[#1F2733] bg-[#0B0E14]'
                        : isSelected
                          ? 'border-amber-500 bg-amber-500/10 cursor-pointer text-white font-bold'
                          : 'border-[#1F2733] bg-[#0B0E14] hover:border-amber-500/40 cursor-pointer text-[#8B95A7]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{gp.flag}</span>
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          R{roundNum}. {gp.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {gp.circuit} • {gp.laps} voltas
                        </div>
                      </div>
                    </div>

                    <div className="font-mono text-xs">
                      {isPast ? (
                        <span className="text-zinc-500">Já encerrado</span>
                      ) : isSelected ? (
                        <Badge className="bg-amber-500 text-black font-bold text-[10px]">
                          ✓ Escalado
                        </Badge>
                      ) : (
                        <span className="text-zinc-500 hover:text-white">Selecionar</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setFpModalOpen(false)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveFpSchedule}
              disabled={isProcessing || selectedFpRounds.length !== 2}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
            >
              {isProcessing ? 'Salvando...' : 'Confirmar Escalação (2 FPs)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Renegociar Contrato */}
      <Dialog
        open={!!renegotiateDriver}
        onOpenChange={(open) => !open && setRenegotiateDriver(null)}
      >
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#E10600]" />
              Renegociar Contrato — {renegotiateDriver?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Ajuste a oferta salarial (variação de ±20%) e a duração de extensão do vínculo.
            </DialogDescription>
          </DialogHeader>

          {renegotiateDriver && (
            <div className="space-y-5 py-3">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#8B95A7]">
                    Proposta Salarial ({salaryMultiplier}% do atual):
                  </span>
                  <strong className="text-base text-[#00A6FB]">
                    {formatCurrency(
                      Math.round(renegotiateDriver.salary * (salaryMultiplier / 100)),
                    )}
                    /ano
                  </strong>
                </div>
                <Slider
                  value={[salaryMultiplier]}
                  onValueChange={(val) => setSalaryMultiplier(val[0])}
                  min={80}
                  max={120}
                  step={1}
                  className="py-2"
                />
                <div className="flex justify-between text-[11px] text-[#8B95A7] font-mono">
                  <span>-20% ({formatCurrency(Math.round(renegotiateDriver.salary * 0.8))})</span>
                  <span>Atual: {formatCurrency(renegotiateDriver.salary)}</span>
                  <span>+20% ({formatCurrency(Math.round(renegotiateDriver.salary * 1.2))})</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono text-[#8B95A7]">Duração da Renovação:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((yrs) => (
                    <Button
                      key={yrs}
                      type="button"
                      variant={contractYears === yrs ? 'default' : 'outline'}
                      onClick={() => setContractYears(yrs)}
                      className={`text-xs font-mono ${
                        contractYears === yrs
                          ? 'bg-[#E10600] text-white hover:bg-[#FF2E25]'
                          : 'border-[#1F2733] text-[#F5F7FA] hover:bg-[#1F2733]'
                      }`}
                    >
                      {yrs} {yrs === 1 ? 'ano' : 'anos'} ({2026 + yrs})
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRenegotiateDriver(null)}
              className="border-[#1F2733] text-[#8B95A7] hover:text-[#F5F7FA]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRenegotiate}
              disabled={isProcessing}
              className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-semibold"
            >
              {isProcessing ? 'Enviando proposta...' : 'Confirmar Novo Contrato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Dispensar Piloto */}
      <Dialog open={!!fireDriver} onOpenChange={(open) => !open && setFireDriver(null)}>
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Rescisão Unilateral de Contrato
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Aviso de multa rescisória obrigatória conforme regulamento FIA 2026.
            </DialogDescription>
          </DialogHeader>

          {fireDriver && (
            <div className="space-y-4 py-2 text-xs">
              <p className="text-[#F5F7FA]">
                Você está prestes a rescindir o contrato de{' '}
                <strong className="text-white">{fireDriver.name}</strong> (
                {fireDriver.role === 'reserva' ? 'Piloto Reserva' : 'Titular'}).
              </p>
              <div className="p-3.5 rounded-lg bg-red-950/30 border border-red-500/30 font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Multa Rescisória (50% do salário anual):</span>
                  <strong className="text-red-400 text-sm">
                    {formatCurrency(Math.round(fireDriver.salary * 0.5))}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Seu Orçamento Atual:</span>
                  <span className="text-[#F5F7FA]">{formatCurrency(team?.budget ?? 0)}</span>
                </div>
              </div>
              <p className="text-[#8B95A7] text-[11px]">
                O piloto será liberado imediatamente para o mercado e a vaga ficará aberta.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFireDriver(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleFire}
              disabled={isProcessing}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {isProcessing ? 'Processando...' : 'Pagar Multa e Dispensar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Contratar Piloto (escolhendo Titular ou Reserva) */}
      <Dialog open={!!hireDriver} onOpenChange={(open) => !open && setHireDriver(null)}>
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
              Contratar {hireDriver?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Defina o papel do piloto na escuderia (Titular ou Reserva).
            </DialogDescription>
          </DialogHeader>

          {hireDriver && (
            <div className="space-y-4 py-2 text-xs font-mono">
              <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Salário Pedido:</span>
                  <strong className="text-[#00A6FB]">
                    {formatCurrency(hireDriver.salary)}/ano
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Orçamento Disponível:</span>
                  <span className="text-[#F5F7FA]">{formatCurrency(team?.budget ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Categoria de Origem:</span>
                  <span className="text-amber-400 font-bold uppercase">
                    {hireDriver.category === 'f2' ? 'Fórmula 2' : 'Mercado F1'}
                  </span>
                </div>
              </div>

              {/* Papel do piloto */}
              <div className="space-y-2">
                <label className="text-[#8B95A7] block text-xs">Papel a assumir na equipe:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHireRole('titular')}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      hireRole === 'titular'
                        ? 'border-[#E10600] bg-[#E10600]/15 text-white font-bold'
                        : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7]'
                    }`}
                  >
                    <div>Piloto Titular</div>
                    <div className="text-[10px] text-[#8B95A7] mt-0.5">Disputa as 24 corridas</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHireRole('reserva')}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      hireRole === 'reserva'
                        ? 'border-amber-500 bg-amber-500/15 text-amber-300 font-bold'
                        : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7]'
                    }`}
                  >
                    <div>Piloto Reserva</div>
                    <div className="text-[10px] text-[#8B95A7] mt-0.5">
                      2 Treinos Livres + Reserva
                    </div>
                  </button>
                </div>
              </div>

              {hireRole === 'titular' && titularDrivers.length >= 2 && (
                <div className="space-y-2 pt-1">
                  <label className="text-[#8B95A7] block text-xs">
                    Sua equipe já possui 2 titulares. Quem será substituído?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {titularDrivers.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDriverToReplaceId(d.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          driverToReplaceId === d.id
                            ? 'border-[#E10600] bg-[#E10600]/10 text-white'
                            : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7] hover:border-[#8B95A7]'
                        }`}
                      >
                        <div className="font-bold text-xs">{d.name}</div>
                        <div className="text-[10px] text-[#8B95A7]">
                          Salário: {formatCurrency(d.salary)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hireRole === 'reserva' && reserveDriver && (
                <div className="p-2.5 rounded bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-300">
                  O atual piloto reserva <strong>{reserveDriver.name}</strong> será liberado para o
                  mercado para dar vaga ao novo contratado.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHireDriver(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleHire}
              disabled={isProcessing}
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-semibold"
            >
              {isProcessing ? 'Assinando contrato...' : 'Concluir Contratação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
