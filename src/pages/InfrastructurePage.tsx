import React, { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { f1Service } from '@/services/f1Service'
import { infrastructureCapabilityService } from '@/services/infrastructureCapabilityService'
import { formatCurrency } from '@/lib/formatters'
import { ENGINE_SUPPLIERS, F1_2026_CALENDAR } from '@/lib/f1-data'
import { EngineSupplierSpec } from '@/types/f1'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { calculatePUWear } from '@/lib/pu-wear-calculator'
import { DRIVE_STORAGE_PHOTOS } from '@/lib/drive-storage-photos'
import { CANONICAL_FACILITIES_DEFINITIONS } from '@/types/canonical-facilities-data'
import { FacilityDefinition } from '@/types/canonical-facilities'
import { useToast } from '@/hooks/use-toast'
import { AmbientBackground } from '@/components/AmbientBackground'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Cpu,
  Building2,
  Zap,
  Activity,
  Layers,
  Sparkles,
  AlertTriangle,
  Hammer,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  RotateCw,
  Gauge,
  ShieldAlert,
  Info,
} from 'lucide-react'

// Modais dedicados
import {
  PowerUnitAllocationModal,
  AllocationUnitInfo,
} from '@/components/commercial/PowerUnitAllocationModal'
import { PowerUnitNegotiationModal } from '@/components/commercial/PowerUnitNegotiationModal'
import { FacilityExpandModal } from '@/components/commercial/FacilityExpandModal'

// Imagem oficial de referência salva no projeto
import puHeroImg from '@/assets/motor-67601.jpg'

export default function InfrastructurePage() {
  const { team, season, user, refreshTeamAndSeason } = useAuth()
  const { toast } = useToast()

  // Sincronização em tempo real com teams
  useRealtime(
    'teams',
    () => {
      refreshTeamAndSeason()
    },
    Boolean(team?.id),
  )

  // CONSOLIDAÇÃO EM EXATAMENTE 2 SUBABAS: [ POWER UNIT ] [ INFRAESTRUTURAS ]
  const [activeTab, setActiveTab] = useState<'pu' | 'facilities'>('pu')

  // Estado da Alocação de Motores (Carro #1 e Carro #2) com persistência local e save
  const [car1PuUnit, setCar1PuUnit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_car1_engine_unit')
      return saved ? parseInt(saved, 10) : 1
    } catch {
      return 1
    }
  })

  const [car2PuUnit, setCar2PuUnit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_car2_engine_unit')
      return saved ? parseInt(saved, 10) : 2
    } catch {
      return 2
    }
  })

  // Contrato Futuro de Motor salvo
  const [futurePuContract, setFuturePuContract] = useState<{
    supplierName: string
    startsSeason: number
    endsSeason: number
    annualCost: number
  } | null>(() => {
    try {
      const saved = localStorage.getItem('apex_gp_future_pu_contract')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // Modais
  const [allocationModalOpen, setAllocationModalOpen] = useState(false)
  const [negotiateModalOpen, setNegotiateModalOpen] = useState(false)
  const [selectedSupplierForNegotiation, setSelectedSupplierForNegotiation] =
    useState<EngineSupplierSpec | null>(null)
  const [selectedFacilityForExpand, setSelectedFacilityForExpand] =
    useState<FacilityDefinition | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  const currentRound = season?.current_round || 1
  const budget = team?.budget ?? 0
  const costCapSpent = team?.cost_cap_spent ?? 0
  const costCapLimit = f1Service.COST_CAP_LIMIT
  const activeEngineWear = team?.active_engine_wear ?? 21

  // Fornecedor de motor atual do time
  const currentSupplierName = team?.engine_supplier || 'Audi'
  const currentSupplierSpec = useMemo(() => {
    return (
      ENGINE_SUPPLIERS.find((s) => s.name.toLowerCase() === currentSupplierName.toLowerCase()) ||
      ENGINE_SUPPLIERS.find((s) => s.name === 'Audi') ||
      ENGINE_SUPPLIERS[0]
    )
  }, [currentSupplierName])

  // Desempenho e métricas oficiais da PU ativa
  const currentPuSubsystem =
    OFFICIAL_POWER_UNITS[currentSupplierSpec.name] || OFFICIAL_POWER_UNITS.Audi

  const puMetrics = useMemo(() => {
    const power = currentSupplierSpec.power || 91
    const reliability = currentSupplierSpec.reliability || 85
    const efficiency = 79 // Eficiência energética 50/50 híbrido
    const potential = 84
    const overall = Math.round(power * 0.5 + reliability * 0.3 + efficiency * 0.2)
    return { power, reliability, efficiency, potential, overall }
  }, [currentSupplierSpec])

  // Cálculo de Desgaste via pu-wear-calculator.ts
  const puWearResult = useMemo(() => {
    return calculatePUWear({
      trackTemp: 29,
      weather: 'seco',
      aggressiveMGU: false,
      aggressivePace: true,
      preserveCarUsed: false,
    })
  }, [])

  // Pool de 4 Motores (PU1 a PU4)
  const poolUnits: AllocationUnitInfo[] = useMemo(() => {
    const baseKm = [1482, 234, 0, 0]
    const baseWear = [activeEngineWear, 8, 0, 0]

    return [1, 2, 3, 4].map((num) => {
      const isC1 = car1PuUnit === num
      const isC2 = car2PuUnit === num
      const assignedCar = isC1 ? 1 : isC2 ? 2 : null
      const km = baseKm[num - 1] + (assignedCar ? (currentRound - 1) * 305 : 0)
      const wear = Math.min(100, baseWear[num - 1] + (assignedCar ? (currentRound - 1) * 4 : 0))
      const integrity = 100 - wear

      let status: AllocationUnitInfo['status'] = 'available'
      if (assignedCar) {
        status = 'in_use'
      } else if (km > 0) {
        status = 'reserve'
      }

      let risk: AllocationUnitInfo['risk'] = 'Baixo'
      if (integrity < 65) risk = 'Alto'
      else if (integrity < 80) risk = 'Médio'

      return {
        unitNumber: num,
        status,
        assignedCar,
        km,
        wear,
        integrity,
        risk,
      }
    })
  }, [car1PuUnit, car2PuUnit, activeEngineWear, currentRound])

  // Unidade ativa em foco no hero (Carro 1 por padrão)
  const activeFocusUnit = poolUnits.find((u) => u.unitNumber === car1PuUnit) || poolUnits[0]

  // Auditoria canônica de Infraestrutura
  const audit = useMemo(() => {
    const calendarRounds = season?.total_rounds || F1_2026_CALENDAR.length || 24
    return infrastructureCapabilityService.auditInfrastructure(team, calendarRounds)
  }, [team, season?.total_rounds])

  const facilityLevels = audit.facilityLevels
  const activeProjects = useMemo(() => {
    return f1Service.getFacilityProjects(team)
  }, [team])

  // Mapeamento canônico obrigatório de imagens das 9 instalações
  const campusHeroImg = DRIVE_STORAGE_PHOTOS['Fabrica.jpg'] || puHeroImg

  const FACILITY_IMAGE_MAP: Record<string, string> = {
    factory: DRIVE_STORAGE_PHOTOS['Fabrica.jpg'] || campusHeroImg,
    design_centre: DRIVE_STORAGE_PHOTOS['Centro_de_Design.jpg'] || campusHeroImg,
    cfd: DRIVE_STORAGE_PHOTOS['Cluster_CFD.jpg'] || campusHeroImg,
    wind_tunnel: DRIVE_STORAGE_PHOTOS['Túnel_de_vento.jpg'] || campusHeroImg,
    manufacturing: DRIVE_STORAGE_PHOTOS['Estrutura_industrial.jpg'] || campusHeroImg,
    simulator: DRIVE_STORAGE_PHOTOS['Simulador.jpg'] || campusHeroImg,
    operations_centre: DRIVE_STORAGE_PHOTOS['Centro_de_operações.jpg'] || campusHeroImg,
    pitstop_center: DRIVE_STORAGE_PHOTOS['Centro_de_Pit_stop.jpg'] || campusHeroImg,
    youth_academy: DRIVE_STORAGE_PHOTOS['Academia_de_pilotos.jpg'] || campusHeroImg,
  }

  // Handlers de Alocação de PU
  const handleConfirmAllocation = (newC1: number, newC2: number) => {
    setCar1PuUnit(newC1)
    setCar2PuUnit(newC2)
    localStorage.setItem('apex_gp_car1_engine_unit', newC1.toString())
    localStorage.setItem('apex_gp_car2_engine_unit', newC2.toString())

    toast({
      title: 'Alocação de Power Unit Atualizada!',
      description: `Carro #1 montado com PU${newC1} • Carro #2 montado com PU${newC2}. Telemetria sincronizada.`,
    })
  }

  // Handlers de Negociação de Fornecedor
  const handleOpenNegotiation = (supplier: EngineSupplierSpec) => {
    setSelectedSupplierForNegotiation(supplier)
    setNegotiateModalOpen(true)
  }

  const handleConfirmContract = async (
    targetSupplier: EngineSupplierSpec,
    contractDetails: any,
  ) => {
    setFuturePuContract({
      supplierName: targetSupplier.name,
      startsSeason: contractDetails.startsSeason,
      endsSeason: contractDetails.endsSeason,
      annualCost: contractDetails.annualCost,
    })
    localStorage.setItem(
      'apex_gp_future_pu_contract',
      JSON.stringify({
        supplierName: targetSupplier.name,
        startsSeason: contractDetails.startsSeason,
        endsSeason: contractDetails.endsSeason,
        annualCost: contractDetails.annualCost,
      }),
    )

    // Lançamento de despesas e notificação
    try {
      const { financialLedgerService } = await import('@/services/financialLedgerService')
      await financialLedgerService.postTransaction({
        teamId: team?.id || 'player',
        seasonYear: season?.year || 2026,
        round: currentRound,
        type: 'expense',
        category: 'otherExpense',
        subcategory: `contract_signing_${targetSupplier.name.toLowerCase()}`,
        direction: 'outflow',
        amount: contractDetails.totalInitialCost,
        costCapClassification: 'excluded',
        sourceSystem: 'engine_negotiation_desk',
        sourceEntityId: `pu_contract_${targetSupplier.name}`,
        idempotencyKey: `pu_sign_${team?.id || 'player'}_${targetSupplier.name}_${Date.now()}`,
        description: `Contrato Futuro: Assinatura com fornecedor de Power Unit ${targetSupplier.name} (${contractDetails.startsSeason})`,
      })
    } catch (e) {
      console.warn('Erro ao registrar transação no ledger:', e)
    }

    if (team?.id) {
      await f1Service.addEvent(
        team.id,
        `🤝 POWER UNIT: Acordo futuro firmado com a ${targetSupplier.name} para o fornecimento a partir de ${contractDetails.startsSeason}!`,
        'contrato',
      )
    }

    toast({
      title: 'Contrato Futuro Registrado na FIA!',
      description: `Fornecimento da ${targetSupplier.name} selado para ${contractDetails.startsSeason}. A equipe mantém a PU ${currentSupplierName} durante 2026.`,
    })
  }

  // Handlers de Expansão de Infraestrutura
  const handleOpenExpandFacility = (fac: FacilityDefinition) => {
    const lvl = facilityLevels[fac.id]
    if (lvl >= 5) {
      toast({
        title: 'Padrão Máximo Atingido',
        description: `${fac.name} já opera no limite técnico do regulamento (Nível 5/5).`,
      })
      return
    }

    if (f1Service.isFacilityUnderConstruction(team as any, fac.id)) {
      const proj = f1Service.getActiveFacilityProject(team as any, fac.id)
      toast({
        title: 'Obra Já em Execução',
        description: `${fac.name} está em expansão para o Nível ${proj?.targetLevel}. Conclusão: Rodada ${proj?.completionRound}.`,
      })
      return
    }

    setSelectedFacilityForExpand(fac)
  }

  const handleConfirmUpgrade = async (fac: FacilityDefinition) => {
    if (!team) return
    try {
      setIsUpgrading(true)
      const res = await f1Service.startFacilityUpgrade(
        team as any,
        fac.id,
        fac.teamField,
        fac.name,
        currentRound,
        user?.id,
      )

      await refreshTeamAndSeason()
      setSelectedFacilityForExpand(null)

      toast({
        title: 'Canteiro de Obras Instalado!',
        description: `Expansão de ${fac.name} para Nível ${res.targetLevel} em andamento. Conclusão prevista: Rodada ${res.completionRound} (${res.durationRounds} rodadas).`,
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na Expansão',
        description: err.message || 'Falha ao iniciar obras da instalação.',
      })
    } finally {
      setIsUpgrading(false)
    }
  }

  // Recomendação técnica dinâmica da equipe
  const teamRecommendation = useMemo(() => {
    if (puMetrics.overall >= 85) {
      return {
        badge: 'MANTER',
        color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        text: `Recomendamos manter a ${currentSupplierSpec.name}. O pacote atual oferece um bom equilíbrio entre performance, confiabilidade e custo. Reavaliar após as próximas atualizações.`,
      }
    }
    if (puMetrics.overall < 80) {
      return {
        badge: 'CONSIDERAR TROCA',
        color: 'bg-red-500/20 text-red-400 border-red-500/40',
        text: `O pacote da ${currentSupplierSpec.name} apresenta desvantagem em tração ou arrefecimento. Sugerimos avaliar os termos contratuais com Ferrari ou Mercedes para a próxima temporada.`,
      }
    }
    return {
      badge: 'NEGOCIAR',
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      text: `Pacote competitivo, mas com custos elevados. Recomendamos abrir conversas preliminares para obter melhores condições de fornecimento.`,
    }
  }, [puMetrics.overall, currentSupplierSpec.name])

  return (
    <div className="relative min-h-screen bg-[#07090E] text-[#F1F5F9] pb-16">
      <AmbientBackground />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Cabeçalho Oficial Canônico */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1A2538] gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white flex items-center gap-2">
              Infraestrutura
            </h1>
            <p className="text-xs text-[#8B98AD] mt-0.5">
              Tecnologia, instalações, operações e programa de Power Unit.
            </p>
          </div>

          {/* AS 2 SUBABAS OFICIAIS CANÔNICAS — NENHUMA TERCEIRA SUBABA */}
          <div className="inline-flex p-1 bg-[#0C1017] border border-[#1C2534] rounded-xl shadow-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('pu')}
              className={`px-6 py-2 text-xs font-mono font-black uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'pu'
                  ? 'bg-[#E10600] text-white shadow-[0_0_12px_rgba(225,6,0,0.5)]'
                  : 'text-[#8B98AD] hover:text-white hover:bg-[#141B26]'
              }`}
            >
              Power Unit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('facilities')}
              className={`px-6 py-2 text-xs font-mono font-black uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'facilities'
                  ? 'bg-[#E10600] text-white shadow-[0_0_12px_rgba(225,6,0,0.5)]'
                  : 'text-[#8B98AD] hover:text-white hover:bg-[#141B26]'
              }`}
            >
              Infraestruturas
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* SUBABA 1: POWER UNIT                                     */}
        {/* ======================================================== */}
        {activeTab === 'pu' && (
          <div className="space-y-6 animate-fade-in">
            {/* HERO ESCURO DA POWER UNIT (Visual Aprovado) */}
            <div className="relative rounded-2xl bg-[#090C12] border border-[#1C2536] p-5 sm:p-6 shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Lado Esquerdo: Identidade do Fornecedor e Contrato */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#121824] border border-[#1F293B] flex items-center justify-center p-2">
                      <Zap className="w-6 h-6 text-[#E10600]" />
                    </div>
                    <div>
                      <Badge className="bg-[#E10600]/20 text-[#E10600] border border-[#E10600]/40 text-[10px] font-mono uppercase font-bold tracking-wider">
                        FORNECEDOR ATUAL
                      </Badge>
                      <h2 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white uppercase mt-1">
                        {currentSupplierSpec.name} Power Unit
                      </h2>
                      <p className="text-xs text-[#8B98AD] font-mono">
                        Tecnologia. Performance. Pessoas.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#161F2E] text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#64748B] block uppercase">
                        Contrato Atual
                      </span>
                      <strong className="text-white">2026 - 2030</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#64748B] block uppercase">
                        Custo Anual
                      </span>
                      <strong className="text-white">
                        {formatCurrency(currentSupplierSpec.costAnnual)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#64748B] block uppercase">
                        Integração Chassi
                      </span>
                      <strong className="text-emerald-400">Excelente</strong>
                    </div>
                  </div>

                  {/* Aviso de Contrato Futuro se existir */}
                  {futurePuContract && (
                    <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-500/40 text-[11px] font-mono text-cyan-300 flex items-center justify-between">
                      <span>
                        Contrato Futuro: <strong>{futurePuContract.supplierName}</strong> (vigência{' '}
                        {futurePuContract.startsSeason})
                      </span>
                      <Badge className="bg-blue-600/20 text-cyan-400 border-none text-[9px]">
                        HOMOLOGADO
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Centro: Imagem Real da PU */}
                <div className="lg:col-span-3 flex justify-center">
                  <div className="relative w-full max-w-[260px] h-40 sm:h-44 rounded-xl overflow-hidden border border-[#1E293B] shadow-xl group">
                    <img
                      src={puHeroImg}
                      alt="F1 Power Unit 2026"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090C12] via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-mono text-neutral-300">
                      <span>DRIVEN BY PROGRESS</span>
                      <span className="text-[#E10600] font-bold">50/50 V6 TURBO</span>
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Indicadores de Desempenho x/100 */}
                <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2">
                  <div className="p-3 rounded-lg bg-[#0F1420] border border-[#1A2436] text-center">
                    <span className="text-[10px] font-mono text-[#8B98AD] uppercase block">
                      Desempenho
                    </span>
                    <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
                      {puMetrics.overall}
                      <span className="text-xs font-normal text-[#64748B]">/100</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0F1420] border border-[#1A2436] text-center">
                    <span className="text-[10px] font-mono text-[#8B98AD] uppercase block">
                      Confiabilidade
                    </span>
                    <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                      {puMetrics.reliability}%
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0F1420] border border-[#1A2436] text-center">
                    <span className="text-[10px] font-mono text-[#8B98AD] uppercase block">
                      Eficiência
                    </span>
                    <div className="text-2xl font-black font-mono text-amber-400 mt-1">
                      {puMetrics.efficiency}%
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0F1420] border border-[#1A2436] text-center">
                    <span className="text-[10px] font-mono text-[#8B98AD] uppercase block">
                      Potencial
                    </span>
                    <div className="text-2xl font-black font-mono text-purple-400 mt-1">
                      {puMetrics.potential}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO INTERMEDIÁRIA: POOL PU1-PU4 + INTEGRIDADE DA ATUAL + GESTÃO & AÇÕES */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* BLOCO 1: Motores da Temporada 2026 (Pool PU1 a PU4) */}
              <div className="lg:col-span-5 p-4 rounded-xl bg-[#0B0F17] border border-[#1A2538] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-black font-mono uppercase tracking-wider text-white">
                      Motores da Temporada {season?.year || 2026}
                    </h3>
                  </div>
                  <Badge className="bg-[#121A28] text-cyan-400 border border-cyan-500/30 text-[10px] font-mono">
                    PU {car1PuUnit} de 4
                  </Badge>
                </div>
                <p className="text-[11px] text-[#8B98AD]">
                  Você pode utilizar até 4 unidades sem punição de grid.
                </p>

                {/* Grade das 4 Unidades */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {poolUnits.map((pu) => {
                    const isInUse = pu.assignedCar !== null
                    return (
                      <div
                        key={pu.unitNumber}
                        className={`p-2.5 rounded-lg border text-center transition-all ${
                          isInUse
                            ? 'bg-[#101928] border-cyan-500/50 shadow-md'
                            : pu.km > 0
                              ? 'bg-[#0E1420] border-[#1C2738]'
                              : 'bg-[#0A0D14] border-[#141B26] opacity-75'
                        }`}
                      >
                        <div className="text-[11px] font-black font-mono text-white">
                          PU{pu.unitNumber}
                        </div>
                        <div className="my-1.5 flex justify-center">
                          <Cpu
                            className={`w-5 h-5 ${
                              isInUse
                                ? 'text-cyan-400 animate-pulse'
                                : pu.km > 0
                                  ? 'text-amber-400'
                                  : 'text-[#475569]'
                            }`}
                          />
                        </div>
                        <div className="text-[10px] font-mono text-[#CBD5E1]">
                          {pu.km > 0 ? `${pu.km} km` : 'Disponível'}
                        </div>
                        <Badge
                          className={`mt-1.5 text-[8px] font-mono uppercase px-1 py-0 ${
                            isInUse
                              ? 'bg-emerald-500/20 text-emerald-400 border-none'
                              : pu.km > 0
                                ? 'bg-amber-500/20 text-amber-300 border-none'
                                : 'bg-[#162030] text-[#64748B] border-none'
                          }`}
                        >
                          {isInUse ? `C#${pu.assignedCar}` : pu.km > 0 ? 'Reserva' : 'Não usado'}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* BLOCO 2: Integridade da Unidade Atual (Barra Grande + pu-wear-calculator) */}
              <div className="lg:col-span-4 p-4 rounded-xl bg-[#0B0F17] border border-[#1A2538] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-black font-mono uppercase tracking-wider text-white">
                      Integridade da Unidade Atual (PU{activeFocusUnit.unitNumber})
                    </h3>
                  </div>
                  <span className="text-base font-black font-mono text-emerald-400">
                    {activeFocusUnit.integrity}%
                  </span>
                </div>

                {/* Barra Grande de Integridade */}
                <div className="w-full bg-[#141C2B] h-3 rounded-full overflow-hidden p-0.5 border border-[#1E2C40]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeFocusUnit.integrity > 75
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                        : activeFocusUnit.integrity > 50
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          : 'bg-gradient-to-r from-red-600 to-rose-500'
                    }`}
                    style={{ width: `${activeFocusUnit.integrity}%` }}
                  />
                </div>

                {/* Parâmetros Derivados do Módulo de Desgaste */}
                <div className="space-y-1.5 text-xs font-mono pt-1">
                  <div className="flex justify-between items-center text-[#94A3B8]">
                    <span>Desgaste estimado (última sessão):</span>
                    <span className="text-white font-bold">{activeFocusUnit.wear}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[#94A3B8]">
                    <span>Quilometragem (acumulado):</span>
                    <span className="text-cyan-400 font-bold">{activeFocusUnit.km} km</span>
                  </div>
                  <div className="flex justify-between items-center text-[#94A3B8]">
                    <span>Ciclos de uso:</span>
                    <span className="text-amber-400 font-bold">{currentRound} corridas</span>
                  </div>
                  <div className="flex justify-between items-center text-[#94A3B8]">
                    <span>Vida útil estimada restante:</span>
                    <span className="text-white font-bold">~ 2 corridas</span>
                  </div>
                  <div className="flex justify-between items-center text-[#94A3B8] pt-1 border-t border-[#162030]">
                    <span>Risco de falha mecânica:</span>
                    <span className="text-emerald-400 font-bold">● {activeFocusUnit.risk}</span>
                  </div>
                </div>
              </div>

              {/* BLOCO 3: Gestão e Ações Operacionais */}
              <div className="lg:col-span-3 p-4 rounded-xl bg-[#0B0F17] border border-[#1A2538] flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-xs font-black font-mono uppercase tracking-wider text-white">
                    Gestão & Ações
                  </h3>
                  <p className="text-[11px] text-[#8B98AD] mt-1">
                    Gerencie sua alocação de motores e defina a estratégia para os dois cockpits.
                  </p>
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={() => setAllocationModalOpen(true)}
                    className="w-full h-9 bg-[#121824] hover:bg-[#1A2334] border border-[#233147] text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-md"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                    Gerenciar Alocação
                  </Button>

                  <Button
                    onClick={() => handleOpenNegotiation(currentSupplierSpec)}
                    className="w-full h-9 bg-[#E10600] hover:bg-[#C00400] text-white font-mono text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md"
                  >
                    <Zap className="w-3.5 h-3.5 text-white" />
                    Negociar Fornecedor
                  </Button>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0D121B] border border-[#162030] text-[10px] text-[#8B98AD] flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    Até 4 unidades de Power Unit podem ser utilizadas por temporada sem penalidade
                    esportiva.
                  </span>
                </div>
              </div>
            </div>

            {/* SEÇÃO INFERIOR: COMPARATIVO DE FORNECEDORES + IMPACTO E RECOMENDAÇÃO */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Comparativo dos 5 Principais Fornecedores */}
              <div className="lg:col-span-8 p-4 rounded-xl bg-[#0B0F17] border border-[#1A2538] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black font-mono uppercase tracking-wider text-white">
                      Comparativo de Fornecedores de Power Unit 2026
                    </h3>
                    <p className="text-[11px] text-[#8B98AD]">
                      Compare o desempenho, confiabilidade e custo dos 5 motores homologados.
                    </p>
                  </div>
                </div>

                {/* Grade dos 5 Fornecedores com scroll horizontal seguro */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                  {ENGINE_SUPPLIERS.map((supplier) => {
                    const isCurrent =
                      supplier.name.toLowerCase() === currentSupplierName.toLowerCase()

                    return (
                      <div
                        key={supplier.name}
                        className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                          isCurrent
                            ? 'bg-[#111A29] border-[#E10600] shadow-[0_0_12px_rgba(225,6,0,0.3)] ring-1 ring-[#E10600]'
                            : 'bg-[#0E131E] border-[#1B2536] hover:border-[#2A3952]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-sm text-white">
                              {supplier.name}
                            </span>
                            {isCurrent && (
                              <Badge className="bg-[#E10600] text-white text-[8px] font-mono px-1 py-0">
                                ATUAL
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-[#8B98AD] font-mono block mb-2">
                            Power Unit
                          </span>

                          <div className="space-y-1.5 text-[11px] font-mono">
                            <div className="flex justify-between">
                              <span className="text-[#8B98AD]">Potência:</span>
                              <strong className="text-white">{supplier.power}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#8B98AD]">Confiabilidade:</span>
                              <strong className="text-emerald-400">{supplier.reliability}%</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#8B98AD]">Eficiência:</span>
                              <strong className="text-amber-400">79%</strong>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#8B98AD]">Potencial:</span>
                              <strong className="text-purple-400">84</strong>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-[#1A2538] text-[10px]">
                              <span className="text-[#8B98AD]">Custo anual:</span>
                              <span className="text-white font-bold">
                                {formatCurrency(supplier.costAnnual)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3">
                          {isCurrent ? (
                            <div className="py-1.5 text-center rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Fornecedor atual
                            </div>
                          ) : (
                            <Button
                              onClick={() => handleOpenNegotiation(supplier)}
                              className="w-full h-7 bg-[#141B26] hover:bg-[#E10600] hover:text-white border border-[#233147] text-[#CBD5E1] text-[10px] font-mono font-bold uppercase"
                            >
                              Negociar
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Lado Direito: Impacto da Troca + Recomendação da Equipe */}
              <div className="lg:col-span-4 space-y-4">
                {/* Painel: Impacto da Troca de Fornecedor */}
                <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1A2538] space-y-3">
                  <h3 className="text-xs font-black font-mono uppercase tracking-wider text-white">
                    Impacto da Troca de Fornecedor
                  </h3>
                  <p className="text-[11px] text-[#8B98AD]">
                    Principais efeitos da mudança estrutural de motor.
                  </p>

                  <div className="space-y-2 text-xs font-mono pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[#94A3B8]">Esforço de integração:</span>
                      <span className="text-red-400 font-bold">Alto</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#94A3B8]">Compatibilidade chassi:</span>
                      <span className="text-amber-400 font-bold">Média</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#94A3B8]">Tempo de adaptação:</span>
                      <span className="text-cyan-400 font-bold">2 - 4 corridas</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#94A3B8]">Risco de perda inicial:</span>
                      <span className="text-red-400 font-bold">Alto</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#94A3B8]">Potencial de ganho:</span>
                      <span className="text-emerald-400 font-bold">Alto</span>
                    </div>
                  </div>
                </div>

                {/* Painel: Recomendação da Equipe */}
                <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1A2538] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black font-mono uppercase tracking-wider text-white">
                      Recomendação da Equipe
                    </span>
                    <Badge className={`font-mono text-[9px] font-bold ${teamRecommendation.color}`}>
                      {teamRecommendation.badge}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[#CBD5E1] leading-relaxed">
                    {teamRecommendation.text}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUBABA 2: INFRAESTRUTURAS (Visual Aprovado)              */}
        {/* ======================================================== */}
        {activeTab === 'facilities' && (
          <div className="space-y-6 animate-fade-in">
            {/* HERO CAMPUS COM IMAGEM EXISTENTE (Visual Aprovado) */}
            <div className="relative rounded-2xl overflow-hidden border border-[#1C2536] shadow-2xl min-h-[160px] sm:min-h-[180px] flex items-end">
              <img
                src={campusHeroImg}
                alt="Campus Tecnológico da Equipe"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#07090E] via-[#07090E]/85 to-transparent" />

              <div className="relative w-full p-5 sm:p-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-5 h-5 text-[#E10600]" />
                    <span className="text-xs font-mono font-bold text-[#CBD5E1] uppercase tracking-wider">
                      Campus Tecnológico {team?.name || 'Audi F1 Team'}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white uppercase">
                    Inovação. Performance. Pessoas. Um futuro mais rápido.
                  </h2>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#8B98AD] mt-1">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>9 instalações integradas em operação</span>
                  </div>
                </div>

                {/* 4 Indicadores Rápidos do Campus */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono shrink-0">
                  <div className="p-2.5 rounded-lg bg-[#070A10]/90 border border-[#1C2738] backdrop-blur-md">
                    <span className="text-[9px] text-[#8B98AD] block uppercase">Nível Médio</span>
                    <strong className="text-base text-emerald-400 font-black">
                      {audit.averageLevel}{' '}
                      <span className="text-xs text-[#64748B] font-normal">/ 5</span>
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#070A10]/90 border border-[#1C2738] backdrop-blur-md">
                    <span className="text-[9px] text-[#8B98AD] block uppercase">
                      Eficiência Operacional
                    </span>
                    <strong className="text-base text-cyan-400 font-black">
                      {audit.capabilities.operationalEfficiency}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#070A10]/90 border border-[#1C2738] backdrop-blur-md">
                    <span className="text-[9px] text-[#8B98AD] block uppercase">
                      Precisão Técnica
                    </span>
                    <strong className="text-base text-blue-400 font-black">
                      {audit.capabilities.simulationAccuracy}
                    </strong>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#070A10]/90 border border-[#1C2738] backdrop-blur-md">
                    <span className="text-[9px] text-[#8B98AD] block uppercase">OPEX Anual</span>
                    <strong className="text-base text-amber-400 font-black">
                      {formatCurrency(audit.totalAnnualOpex)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* AS 9 INSTALAÇÕES CANÔNICAS (3 COLUNAS) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {CANONICAL_FACILITIES_DEFINITIONS.map((fac) => {
                const currentLvl = facilityLevels[fac.id]
                const isMax = currentLvl >= 5
                const imgUrl = FACILITY_IMAGE_MAP[fac.id] || campusHeroImg
                const isUnderConstruction = f1Service.isFacilityUnderConstruction(team, fac.id)
                const project = f1Service.getActiveFacilityProject(team, fac.id)

                return (
                  <div
                    key={fac.id}
                    className="rounded-xl bg-[#0B0F17] border border-[#1B2434] overflow-hidden flex flex-col justify-between shadow-xl group hover:border-[#2C3B54] transition-all"
                  >
                    <div>
                      {/* Imagem do Departamento */}
                      <div className="relative h-32 w-full overflow-hidden">
                        <img
                          src={imgUrl}
                          alt={fac.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-transparent to-transparent" />
                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                          <span className="font-mono font-bold text-xs text-white uppercase drop-shadow">
                            {fac.shortName}
                          </span>
                          {isUnderConstruction ? (
                            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono">
                              OBRA R{project?.completionRound}
                            </Badge>
                          ) : (
                            <Badge
                              className={`font-mono text-[9px] font-bold uppercase px-2 py-0.5 ${
                                isMax
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              }`}
                            >
                              NÍVEL {currentLvl} / 5
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Conteúdo Técnico */}
                      <div className="p-3.5 space-y-2.5">
                        <p className="text-[11px] text-[#8B98AD] line-clamp-1">{fac.subtitle}</p>

                        {/* 2 Efeitos Centrais */}
                        <div className="space-y-1.5">
                          {fac.effects.slice(0, 2).map((eff, i) => (
                            <div
                              key={i}
                              className="p-1.5 rounded bg-[#090C12] border border-[#161F2E] flex items-center gap-2 text-[10px] font-mono"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                              <span className="font-bold text-white truncate">{eff.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Botão Expandir */}
                    <div className="p-3 bg-[#080B10] border-t border-[#141C28]">
                      <Button
                        onClick={() => handleOpenExpandFacility(fac)}
                        disabled={isMax || isUnderConstruction}
                        className={`w-full h-8 font-mono text-[10px] font-black uppercase tracking-wider ${
                          isMax
                            ? 'bg-[#121824] text-[#64748B] cursor-default'
                            : isUnderConstruction
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-default'
                              : 'bg-[#E10600] hover:bg-[#C00400] text-white shadow-md'
                        }`}
                      >
                        {isMax ? 'Padrão Máximo' : isUnderConstruction ? 'Em Obras' : 'Expandir >'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* SEÇÃO INFERIOR: SINERGIAS-CHAVE + GARGALOS ATUAIS + OBRAS EM ANDAMENTO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Painel 1: Sinergias-chave */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1A2538] space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Sinergias-chave</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-[#090D14] border border-[#162030] text-[11px] text-[#CBD5E1]">
                    <strong className="text-emerald-400 block">CFD + Túnel de Vento</strong>
                    Maior correlação de dados e redução de incerteza aerodinâmica.
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#090D14] border border-[#162030] text-[11px] text-[#CBD5E1]">
                    <strong className="text-cyan-400 block">Design + Manufatura</strong>
                    Ciclo de desenvolvimento mais rápido da prancheta à pista.
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#090D14] border border-[#162030] text-[11px] text-[#CBD5E1]">
                    <strong className="text-purple-400 block">Simulador + Academia</strong>
                    Evolução constante de jovens pilotos e retenção de talentos.
                  </div>
                </div>
              </div>

              {/* Painel 2: Gargalos Atuais (Calculados Dinamicamente) */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1A2538] space-y-3">
                <div className="flex items-center gap-2 text-red-400 font-mono font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Gargalos Atuais</span>
                </div>

                {audit.bottlenecks.length > 0 ? (
                  <div className="space-y-2">
                    {audit.bottlenecks.map((b, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-[#090D14] border border-red-500/30 text-[11px] text-[#CBD5E1]"
                      >
                        <strong className="text-red-400 font-mono block">
                          ● {b.title} ({b.penaltyPercent > 0 ? `-${b.penaltyPercent}%` : ''})
                        </strong>
                        <p className="text-[#8B98AD] mt-0.5">{b.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#090D14] border border-[#162030] text-xs text-[#8B98AD]">
                    Nenhum gargalo severo detectado. Instalações operam em equilíbrio relativo
                    harmonioso.
                  </div>
                )}
              </div>

              {/* Painel 3: Obras em Andamento */}
              <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1A2538] space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs uppercase tracking-wider">
                  <Hammer className="w-4 h-4" />
                  <span>Obras em Andamento</span>
                </div>

                {activeProjects.length > 0 ? (
                  <div className="space-y-2.5">
                    {activeProjects.map((p, idx) => {
                      const roundsLeft = Math.max(0, p.completionRound - currentRound)
                      const progressPct = Math.min(
                        100,
                        Math.max(
                          10,
                          ((currentRound - p.startedAtRound) /
                            Math.max(1, p.completionRound - p.startedAtRound)) *
                            100,
                        ),
                      )

                      return (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-[#090D14] border border-amber-500/30 space-y-1.5 text-xs font-mono"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white uppercase text-[11px]">
                              {p.facilityId.replace('_', ' ')}
                            </span>
                            <span className="text-cyan-400 text-[10px]">
                              Conclusão: R{p.completionRound}
                            </span>
                          </div>
                          <div className="w-full bg-[#141C2B] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-[#8B98AD] flex justify-between">
                            <span>Progresso: {Math.round(progressPct)}%</span>
                            <span>Faltam {roundsLeft} rodadas</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-[#090D14] border border-[#162030] text-xs text-[#8B98AD] text-center">
                    Nenhuma obra em andamento no momento.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAIS DEDICADOS FUNCIONAIS */}
      <PowerUnitAllocationModal
        open={allocationModalOpen}
        onOpenChange={setAllocationModalOpen}
        units={poolUnits}
        car1Unit={car1PuUnit}
        car2Unit={car2PuUnit}
        driver1Name="Piloto #1"
        driver2Name="Piloto #2"
        onConfirmAllocation={handleConfirmAllocation}
      />

      <PowerUnitNegotiationModal
        open={negotiateModalOpen}
        onOpenChange={setNegotiateModalOpen}
        targetSupplier={selectedSupplierForNegotiation}
        currentSupplierName={currentSupplierName}
        currentContractEndYear={2030}
        nextSeasonYear={(season?.year || 2026) + 1}
        budget={budget}
        onConfirmContract={handleConfirmContract}
      />

      <FacilityExpandModal
        open={!!selectedFacilityForExpand}
        onOpenChange={(open) => !open && setSelectedFacilityForExpand(null)}
        facility={selectedFacilityForExpand}
        currentLevel={selectedFacilityForExpand ? facilityLevels[selectedFacilityForExpand.id] : 1}
        budget={budget}
        costCapSpent={costCapSpent}
        costCapLimit={costCapLimit}
        currentRound={currentRound}
        isUpgrading={isUpgrading}
        facilityImageUrl={
          selectedFacilityForExpand
            ? FACILITY_IMAGE_MAP[selectedFacilityForExpand.id] || campusHeroImg
            : campusHeroImg
        }
        onConfirmUpgrade={handleConfirmUpgrade}
      />
    </div>
  )
}
