import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { f1Service } from '@/services/f1Service'
import { useRealtime } from '@/hooks/use-realtime'
import { PartModel, SponsorModel } from '@/types/f1'
import { ENGINE_SUPPLIERS } from '@/lib/f1-data'
import { CarLivery } from '@/components/CarLivery'
import { formatCurrency } from '@/lib/formatters'
import { toast } from '@/hooks/use-toast'
import {
  Wrench,
  Cpu,
  Zap,
  Gauge,
  ArrowUpRight,
  CheckCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  Flame,
  Layers,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

export default function CarPage() {
  const { team, refreshTeamAndSeason } = useAuth()

  const [parts, setParts] = useState<PartModel[]>([])
  const [sponsors, setSponsors] = useState<SponsorModel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [upgradingPartId, setUpgradingPartId] = useState<string | null>(null)

  const loadParts = async () => {
    if (!team) {
      setLoading(false)
      return
    }
    try {
      const [pList, spList] = await Promise.all([
        f1Service.getTeamParts(team.id),
        f1Service.getTeamSponsors(team.id),
      ])
      setParts(pList)
      setSponsors(spList)
    } catch (err) {
      console.error('Error loading parts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadParts()
  }, [team?.id])

  useRealtime('parts', () => {
    loadParts()
  })

  // Current engine spec
  const currentEngine = useMemo(() => {
    const sName = team?.engine_supplier || 'Mercedes'
    return ENGINE_SUPPLIERS.find((s) => s.name === sName) || ENGINE_SUPPLIERS[1]
  }, [team?.engine_supplier])

  // Overall Car Rating calculation
  // Weighted: Parts average (60%) + Engine power (40%)
  const { overallLevel, partsAverage } = useMemo(() => {
    if (parts.length === 0) return { overallLevel: 75, partsAverage: 5 }
    const sum = parts.reduce((acc, p) => acc + p.level, 0)
    const avg = sum / parts.length // 0 to 10
    // Normalize avg to 0-100: avg * 10
    const partsScore = avg * 10
    const engineScore = currentEngine.power
    const overall = Math.round(partsScore * 0.6 + engineScore * 0.4)
    return {
      overallLevel: overall,
      partsAverage: Number(avg.toFixed(1)),
    }
  }, [parts, currentEngine])

  // Upgrade part cost calculation
  const getUpgradeCost = (currentLevel: number) => {
    // Level 5 -> 6: R$ 8.000.000
    // Level 9 -> 10: R$ 18.000.000
    return Math.round(4000000 + currentLevel * 1500000)
  }

  // Handle invest / upgrade part
  const handleUpgradePart = async (part: PartModel) => {
    if (!team) return
    if (part.level >= 10) {
      toast({
        title: 'Componente no Nível Máximo!',
        description: `${part.name} já atingiu o nível 10 permitido pelas regras FIA 2026.`,
      })
      return
    }

    const cost = getUpgradeCost(part.level)
    if (team.budget < cost) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `Você precisa de ${formatCurrency(cost)} para investir em ${part.name}. Saldo: ${formatCurrency(team.budget)}.`,
      })
      return
    }

    setUpgradingPartId(part.id)
    try {
      const newLevel = part.level + 1
      const newBudget = team.budget - cost

      await Promise.all([
        f1Service.updatePart(part.id, { level: newLevel }),
        f1Service.updateTeam(team.id, { budget: newBudget }),
        f1Service.addEvent(
          team.id,
          `P&D: ${part.name} aprimorado para o Nível ${newLevel} por ${formatCurrency(cost)}.`,
          'desenvolvimento',
        ),
      ])

      toast({
        title: 'Aprimoramento Concluído!',
        description: `${part.name} subiu para o nível ${newLevel}/10. Desempenho aerodinâmico/mecânico melhorado.`,
      })

      refreshTeamAndSeason()
      loadParts()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro no Aprimoramento',
        description: err?.message || 'Falha ao processar upgrade de peça.',
      })
    } finally {
      setUpgradingPartId(null)
    }
  }

  // Switch engine supplier handler
  const handleSwitchSupplier = async () => {
    if (!selectedSupplier || !team) return
    const penaltyFee = 15000000 // R$ 15M troca de motor
    if (team.budget < penaltyFee) {
      toast({
        variant: 'destructive',
        title: 'Orçamento Insuficiente',
        description: `A rescisão e adaptação de chassi exige ${formatCurrency(penaltyFee)}.`,
      })
      return
    }

    setIsProcessing(true)
    try {
      const newBudget = team.budget - penaltyFee
      await f1Service.updateTeam(team.id, {
        engine_supplier: selectedSupplier.name,
        budget: newBudget,
      })

      await f1Service.addEvent(
        team.id,
        `Fornecedor de unidade de potência trocado para ${selectedSupplier.name} (Custo: ${formatCurrency(penaltyFee)}).`,
        'desenvolvimento',
      )

      toast({
        title: 'Fornecedor de Motor Atualizado!',
        description: `A equipe agora é impulsionada pela unidade ${selectedSupplier.name} 50/50 Híbrida.`,
      })

      setSelectedSupplier(null)
      refreshTeamAndSeason()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na troca de motor',
        description: err?.message || 'Falha ao alterar fornecedor.',
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
            Engenharia & Desenvolvimento Técnico
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA] mt-1">
            Carro & Unidade de Potência 2026
          </h1>
          <p className="text-sm text-[#8B95A7] mt-0.5">
            Configure o fornecedor do trem de força híbrido e aprimore as 6 peças homologadas sob o
            regulamento 2026.
          </p>
        </div>
      </div>

      {/* Visual Livery do Carro 2026 com Patrocinadores */}
      <CarLivery
        teamColor={team?.color || '#E10600'}
        teamName={team?.name || 'Sua Escuderia'}
        sponsors={sponsors}
        carLevel={overallLevel}
      />

      {/* BLOCO FIXO EXPLICATIVO: REGRAS TÉCNICAS F1 2026 */}
      <div className="rounded-2xl bg-[#11161F] border border-[#00A6FB]/40 p-5 shadow-xl relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#00A6FB]/10 text-[#00A6FB] flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
                Novo Regulamento Técnico FIA — Fórmula 1 2026
                <Badge className="bg-[#00A6FB] text-[#0B0E14] font-mono text-[10px] font-bold">
                  Oficial
                </Badge>
              </h2>
              <p className="text-xs text-[#8B95A7] mt-0.5">
                A temporada 2026 introduz a maior revolução na arquitetura veicular e no trem de
                força da história da F1:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Regra 1 */}
              <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#E10600]">
                  <Zap className="w-4 h-4" />
                  <span>Unidade de Potência 50/50</span>
                </div>
                <p className="text-[#8B95A7] text-[11px] leading-relaxed">
                  Eliminação do MGU-H. O motor elétrico MGU-K salta para{' '}
                  <strong>350 kW (~475 cv)</strong>, dividindo a tração de forma igual com o motor
                  V6 Turbo (100% combustível sustentável).
                </p>
              </div>

              {/* Regra 2 */}
              <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#00A6FB]">
                  <Layers className="w-4 h-4" />
                  <span>Aerodinâmica Ativa</span>
                </div>
                <p className="text-[#8B95A7] text-[11px] leading-relaxed">
                  O DRS foi extinto. As asas dianteira e traseira possuem 2 estados:{' '}
                  <strong>Z-Mode</strong> (alta sustentação em curvas) e{' '}
                  <strong>X-Mode / Straight Mode</strong> (baixo arrasto eletrônico em retas).
                </p>
              </div>

              {/* Regra 3 */}
              <div className="p-3 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-400">
                  <Flame className="w-4 h-4" />
                  <span>Modo Overtake & 768 kg</span>
                </div>
                <p className="text-[#8B95A7] text-[11px] leading-relaxed">
                  Quando o carro está a &lt;1s do rival, o piloto aciona o{' '}
                  <strong>Modo Overtake</strong> com energia extra na bateria para manobras de
                  ultrapassagem. O peso mínimo caiu para <strong>768 kg</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Nível Geral do Carro + Fornecedor de Motor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Destaque: Nível Geral do Carro */}
        <Card className="bg-[#11161F] border-[#1F2733] flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
              <Gauge className="w-5 h-5 text-[#E10600]" />
              Nível Geral do Carro
            </CardTitle>
            <CardDescription className="text-xs text-[#8B95A7]">
              Média ponderada do pacote aero/chassi (60%) + potência do motor (40%).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="text-center p-6 rounded-2xl bg-[#0B0E14] border border-[#1F2733]">
              <div className="text-5xl font-extrabold font-mono text-[#F5F7FA] tracking-tight">
                {overallLevel}
                <span className="text-sm text-[#8B95A7] font-normal block mt-1">
                  / 100 Índice de Competitividade
                </span>
              </div>
              <div className="mt-4 w-full bg-[#1F2733] h-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E10600] to-[#FF6B35] transition-all duration-500"
                  style={{ width: `${overallLevel}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between text-[#8B95A7]">
                <span>Média das 6 Peças:</span>
                <strong className="text-[#F5F7FA]">{partsAverage} / 10</strong>
              </div>
              <div className="flex justify-between text-[#8B95A7]">
                <span>Potência do Motor ({currentEngine.name}):</span>
                <strong className="text-[#00A6FB]">{currentEngine.power} / 100</strong>
              </div>
              <div className="flex justify-between text-[#8B95A7]">
                <span>Confiabilidade do Motor:</span>
                <strong className="text-emerald-400">{currentEngine.reliability}%</strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4 Fornecedores de Motor em grade */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#F5F7FA] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#00A6FB]" />
              Fornecedores de Unidade de Potência 2026
            </h2>
            <span className="text-xs font-mono text-[#8B95A7]">4 fabricantes homologados</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ENGINE_SUPPLIERS.map((sup) => {
              const isCurrent = team?.engine_supplier === sup.name
              return (
                <div
                  key={sup.name}
                  className={`p-4 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-[#161D29] border-[#E10600] shadow-md shadow-[#E10600]/10 ring-1 ring-[#E10600]'
                      : 'bg-[#11161F] border-[#1F2733] hover:border-[#1F2733]/80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-[#F5F7FA]">{sup.name}</h3>
                        {isCurrent && (
                          <Badge className="bg-[#E10600] text-white text-[10px] font-mono">
                            Atual
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-[#00A6FB] mt-0.5">{sup.techBadge}</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#8B95A7] mt-2 line-clamp-2 leading-relaxed">
                    {sup.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-[#1F2733] text-xs font-mono">
                    <div>
                      <span className="text-[#8B95A7] block text-[10px]">Potência</span>
                      <strong className="text-[#F5F7FA]">{sup.power}/100</strong>
                    </div>
                    <div>
                      <span className="text-[#8B95A7] block text-[10px]">Confiabilidade</span>
                      <strong className="text-emerald-400">{sup.reliability}%</strong>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#1F2733]/60">
                    <span className="text-xs font-mono font-bold text-[#F5F7FA]">
                      {formatCurrency(sup.costAnnual)}
                      <span className="text-[10px] text-[#8B95A7] font-normal">/ano</span>
                    </span>

                    {isCurrent ? (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Equipado
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSupplier(sup)}
                        className="border-[#1F2733] text-xs h-7 px-3 text-[#00A6FB] hover:bg-[#1F2733]"
                      >
                        Trocar Fornecedor
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Seção Desenvolvimento do Carro: 6 Peças */}
      <Card className="bg-[#11161F] border-[#1F2733]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#E10600]" />
            Desenvolvimento de Componentes (Nível 0 a 10)
          </CardTitle>
          <CardDescription className="text-xs text-[#8B95A7]">
            Invista o orçamento da escuderia para fabricar upgrades em túnel de vento e CFD. Cada
            nível aprimorado eleva o ritmo e o desempenho nas 24 etapas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-36 w-full bg-[#1F2733]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {parts.map((part) => {
                const isMax = part.level >= 10
                const cost = getUpgradeCost(part.level)
                const isUpgrading = upgradingPartId === part.id

                return (
                  <div
                    key={part.id}
                    className="p-4 rounded-xl bg-[#0B0E14] border border-[#1F2733] space-y-3 flex flex-col justify-between hover:border-[#1F2733]/80 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-sm text-[#F5F7FA]">{part.name}</h3>
                        <Badge
                          variant="outline"
                          className={`font-mono text-xs ${
                            isMax
                              ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                              : 'border-[#1F2733] text-[#F5F7FA]'
                          }`}
                        >
                          Nível {part.level}/10
                        </Badge>
                      </div>

                      {/* Level Progress Bar */}
                      <div className="mt-2 space-y-1">
                        <div className="h-2 w-full bg-[#1F2733] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#00A6FB] to-[#E10600] transition-all duration-300"
                            style={{ width: `${(part.level / 10) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-[#8B95A7]">
                          <span>0</span>
                          <span>5 (Padrão)</span>
                          <span>10 (Máx)</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#1F2733] flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-[#8B95A7] block text-[10px]">Custo Upgrade</span>
                        <strong className="text-[#F5F7FA]">
                          {isMax ? 'Homologado' : formatCurrency(cost)}
                        </strong>
                      </div>

                      <Button
                        size="sm"
                        disabled={isMax || isUpgrading}
                        onClick={() => handleUpgradePart(part)}
                        className={`text-xs h-8 px-3 font-semibold ${
                          isMax
                            ? 'bg-[#1F2733] text-[#8B95A7]'
                            : 'bg-[#E10600] hover:bg-[#FF2E25] text-white shadow'
                        }`}
                      >
                        {isUpgrading ? 'Desenvolvendo...' : isMax ? 'Nível Máximo' : 'Investir'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Confirmar Troca de Fornecedor de Motor */}
      <Dialog open={!!selectedSupplier} onOpenChange={(open) => !open && setSelectedSupplier(null)}>
        <DialogContent className="bg-[#11161F] border-[#1F2733] text-[#F5F7FA]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#F5F7FA] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#00A6FB]" />
              Trocar Fornecedor de Unidade de Potência
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8B95A7]">
              A rescisão e readequação de fixações do chassi possuem um custo de adaptação de
              desenvolvimento.
            </DialogDescription>
          </DialogHeader>

          {selectedSupplier && (
            <div className="space-y-4 py-2 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-[#1F2733] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Novo Fornecedor:</span>
                  <strong className="text-[#F5F7FA] text-sm">{selectedSupplier.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Potência / Confiabilidade:</span>
                  <span className="text-[#00A6FB]">
                    {selectedSupplier.power} pts / {selectedSupplier.reliability}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Custo de Rescisão & Integração:</span>
                  <strong className="text-red-400 text-sm">{formatCurrency(15000000)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B95A7]">Saldo Atual da Equipe:</span>
                  <span className="text-[#F5F7FA]">{formatCurrency(team?.budget ?? 0)}</span>
                </div>
              </div>

              {(team?.budget ?? 0) < 15000000 && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Saldo insuficiente para arcar com a rescisão de R$ 15,00 M.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedSupplier(null)}
              className="border-[#1F2733] text-[#8B95A7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSwitchSupplier}
              disabled={isProcessing || (team?.budget ?? 0) < 15000000}
              className="bg-[#E10600] hover:bg-[#FF2E25] text-white font-semibold"
            >
              {isProcessing ? 'Adaptando chassi...' : 'Confirmar Troca de Motor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
