import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { DriverModel } from '@/types/f1'
import { formatCurrency } from '@/lib/formatters'
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
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
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
  const { team, refreshTeamAndSeason } = useAuth()

  const [teamDrivers, setTeamDrivers] = useState<DriverModel[]>([])
  const [marketDrivers, setMarketDrivers] = useState<DriverModel[]>([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [renegotiateDriver, setRenegotiateDriver] = useState<DriverModel | null>(null)
  const [salaryMultiplier, setSalaryMultiplier] = useState<number>(100) // 80% to 120%
  const [contractYears, setContractYears] = useState<number>(1)

  const [fireDriver, setFireDriver] = useState<DriverModel | null>(null)
  const [hireDriver, setHireDriver] = useState<DriverModel | null>(null)
  const [driverToReplaceId, setDriverToReplaceId] = useState<string>('')

  const [isProcessing, setIsProcessing] = useState(false)

  // Team strength calculation / display
  const isCustomTeam = team?.is_custom ?? team?.name === 'Escuderia Brasil'
  const teamStrength = team?.strength ?? (isCustomTeam ? 58 : 75)

  const loadData = async () => {
    if (!team) return
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

  // Flag emoji helper
  const getFlag = (nat: string) => {
    switch (nat.toLowerCase()) {
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
        return '🇩🇪'
      case 'frança':
        return '🇫🇷'
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
      await f1Service.updateDriver(fireDriver.id, { team_id: null })

      await f1Service.addEvent(
        team.id,
        `${fireDriver.name} foi demitido. Multa rescisória de ${formatCurrency(penaltyCost)} paga.`,
        'contrato',
      )

      toast({
        title: 'Piloto Demitido',
        description: `${fireDriver.name} foi dispensado para o mercado. Multa paga: ${formatCurrency(penaltyCost)}.`,
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
    if (teamDrivers.length >= 2) {
      setDriverToReplaceId(teamDrivers[0]?.id || '')
    } else {
      setDriverToReplaceId('')
    }
  }

  // Hire driver handler
  const handleHire = async () => {
    if (!hireDriver || !team) return
    setIsProcessing(true)
    try {
      // Small random salary variation (-5% to +5%)
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

      // If team already has 2 drivers and one needs to be replaced
      if (teamDrivers.length >= 2 && driverToReplaceId) {
        const replacedDriver = teamDrivers.find((d) => d.id === driverToReplaceId)
        if (replacedDriver) {
          // Send replaced driver to market
          await f1Service.updateDriver(replacedDriver.id, { team_id: null })
        }
      }

      // Assign new driver to team
      await f1Service.updateDriver(hireDriver.id, {
        team_id: team.id,
        salary: finalSalary,
        contract_end: 2027,
      })

      await f1Service.addEvent(
        team.id,
        `${hireDriver.name} foi contratado pela equipe com salário de ${formatCurrency(finalSalary)}/ano!`,
        'contrato',
      )

      toast({
        title: 'Contratação Realizada!',
        description: `${hireDriver.name} é o novo titular da ${team.name}.`,
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

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1F2733]/80">
        <div>
          <span className="text-xs font-mono font-bold tracking-widest text-[#E10600] uppercase">
            Gestão Esportiva & Pessoal
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA] mt-1">
            Equipe & Mercado de Pilotos
          </h1>
          <p className="text-sm text-[#8B95A7] mt-0.5">
            Gerencie os contratos dos seus pilotos titulares, avalie a força da escuderia e negocie
            no mercado livre da F1 2026 (incluindo pilotos fora do grid).
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

      {/* Seção 1: Pilotos Titulares */}
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#E10600]" />
            Pilotos Titulares Contratados ({teamDrivers.length}/2)
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7]">
            Os atributos influenciam diretamente ritmo de corrida, estabilidade na chuva e
            ultrapassagens com o Modo Overtake 2026.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full bg-[#1F2733]" />
              <Skeleton className="h-28 w-full bg-[#1F2733]" />
            </div>
          ) : teamDrivers.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-[#1F2733] rounded-xl text-[#8B95A7]">
              <p>Você ainda não possui pilotos contratados.</p>
              <p className="text-xs mt-1 text-[#00A6FB]">
                Contrate dois pilotos no mercado abaixo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teamDrivers.map((driver, index) => (
                <div
                  key={driver.id}
                  className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-4 hover:border-[#1F2733]/80 transition-all"
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
                    <Badge
                      variant="outline"
                      className="border-[#22C55E]/40 text-[#22C55E] bg-[#22C55E]/5 text-xs font-mono"
                    >
                      Titular
                    </Badge>
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
                        Demitir
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 2: Equipe Técnica */}
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#00A6FB]" />
            Equipe Técnica & Departamento de Engenharia
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7]">
            Engenheiros de fábrica determinam o ritmo de upgrade de peças e acerto nos finais de
            semana de GP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#8B95A7]">Engenharia de Chassi</span>
                <span className="text-lg font-bold text-[#F5F7FA]">
                  {team?.chassis_level ?? 50}
                </span>
              </div>
              <div className="h-2 w-full bg-[#1F2733] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#E10600]"
                  style={{ width: `${team?.chassis_level ?? 50}%` }}
                />
              </div>
              <p className="text-[11px] text-[#8B95A7]">
                Rigidez torsional e distribuição do peso mínimo de 768kg.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#8B95A7]">Engenharia Aerodinâmica</span>
                <span className="text-lg font-bold text-[#F5F7FA]">{team?.aero_level ?? 50}</span>
              </div>
              <div className="h-2 w-full bg-[#1F2733] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00A6FB]"
                  style={{ width: `${team?.aero_level ?? 50}%` }}
                />
              </div>
              <p className="text-[11px] text-[#8B95A7]">
                Controle ativo do Straight Mode e downforce em curvas.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-[#8B95A7]">Estratégia de Pista</span>
                <span className="text-lg font-bold text-[#F5F7FA]">
                  {team?.strategy_level ?? 50}
                </span>
              </div>
              <div className="h-2 w-full bg-[#1F2733] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${team?.strategy_level ?? 50}%` }}
                />
              </div>
              <p className="text-[11px] text-[#8B95A7]">
                Janelas de pit-stop, gestão de bateria 350kW e clima.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3: Mercado de Pilotos Disponíveis */}
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-400" />
            Mercado de Pilotos Disponíveis (Agentes Livres F1)
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7]">
            Pilotos com contrato livre prontos para assinar. Substitua ou preencha vagas na sua
            escuderia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full bg-[#1F2733]" />
              <Skeleton className="h-16 w-full bg-[#1F2733]" />
              <Skeleton className="h-16 w-full bg-[#1F2733]" />
            </div>
          ) : marketDrivers.length === 0 ? (
            <p className="text-center py-6 text-xs text-[#8B95A7]">
              Nenhum piloto disponível no mercado no momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#1F2733] text-[#8B95A7] uppercase tracking-wider">
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
                  {marketDrivers.map((driver) => (
                    <tr key={driver.id} className="hover:bg-[#161D29]/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span>{getFlag(driver.nationality)}</span>
                          <span className="font-semibold text-sm text-[#F5F7FA]">
                            {driver.name}
                          </span>
                          <span className="text-[10px] text-[#8B95A7]">({driver.nationality})</span>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Modal: Demitir Piloto */}
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
                <strong className="text-white">{fireDriver.name}</strong>.
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
                O piloto será liberado imediatamente para o mercado de agentes livres e a vaga de
                titular ficará aberta.
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
              {isProcessing ? 'Processando...' : 'Pagar Multa e Demitir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Contratar Piloto */}
      <Dialog open={!!hireDriver} onOpenChange={(open) => !open && setHireDriver(null)}>
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#22C55E]" />
              Contratar {hireDriver?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              Defina a vaga na equipe e confira o impacto no orçamento anual.
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
                  <span className="text-[#8B95A7]">Duração Inicial:</span>
                  <span className="text-[#F5F7FA]">Até o fim de 2027</span>
                </div>
              </div>

              {teamDrivers.length >= 2 && (
                <div className="space-y-2">
                  <label className="text-[#8B95A7] block text-xs">
                    Sua equipe já possui 2 pilotos titulares. Selecione quem será substituído:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {teamDrivers.map((d) => (
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
