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
import { DRIVE_STORAGE_PHOTOS, getEngineSupplierLogo } from '@/lib/drive-storage-photos'
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
import { PowerUnitIntegrationPanel } from '@/components/car/PowerUnitIntegrationPanel'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'

// Imagem oficial de referência salva no projeto
import puHeroImg from '@/assets/motor-67601.jpg'
import puAttachedUnitImg from '@/assets/file0000000033a8820ebdd18c0df97ed4fb-f0e78.png'

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

  const careerId = resolveCanonicalCareerId(season, team)
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

  // Mapeamento canônico obrigatório de imagens das 9 instalações + Hero Campus da pasta oficial do Google Drive
  const campusHeroImg =
    DRIVE_STORAGE_PHOTOS['Fabrica.jpg'] ||
    'https://drive.google.com/thumbnail?id=1phyP1H8xzTbit9rblTUMzLrKg2jhy-f-&sz=w1600'

  const FACILITY_IMAGE_MAP: Record<string, string> = {
    factory:
      DRIVE_STORAGE_PHOTOS['Fabrica.jpg'] ||
      'https://drive.google.com/thumbnail?id=1phyP1H8xzTbit9rblTUMzLrKg2jhy-f-&sz=w1600',
    design_centre:
      DRIVE_STORAGE_PHOTOS['Centro_de_Design.jpg'] ||
      'https://drive.google.com/thumbnail?id=1qyYkUNjw46Za-cWqFgIkRIOkYBARjzNF&sz=w1600',
    cfd:
      DRIVE_STORAGE_PHOTOS['Cluster_CFD.jpg'] ||
      'https://drive.google.com/thumbnail?id=1dmYw9CxdM_73zqX10qmoVaWCNpJ1i7qt&sz=w1600',
    wind_tunnel:
      DRIVE_STORAGE_PHOTOS['Túnel_de_vento.jpg'] ||
      'https://drive.google.com/thumbnail?id=1lENvyCJa0fKVpttHVYl8N4Z11svoPy4y&sz=w1600',
    manufacturing:
      DRIVE_STORAGE_PHOTOS['Estrutura_industrial.jpg'] ||
      'https://drive.google.com/thumbnail?id=1iXyVw_enWLYp4G2FbAg5EsoMr5A7mKwS&sz=w1600',
    simulator:
      DRIVE_STORAGE_PHOTOS['Simulador.jpg'] ||
      'https://drive.google.com/thumbnail?id=16YZFSmFgLGdVhjAZbB5PhG9U5R0qHK1V&sz=w1600',
    operations_centre:
      DRIVE_STORAGE_PHOTOS['Centro_de_operações.jpg'] ||
      'https://drive.google.com/thumbnail?id=1VZwvNs4ENeCOwjZXap1Wkstc4NEp6WeG&sz=w1600',
    pitstop_center:
      DRIVE_STORAGE_PHOTOS['Centro_de_Pit_stop.jpg'] ||
      'https://drive.google.com/thumbnail?id=1cnzcYOvlipue238eftPktQf5AKAI-YHu&sz=w1600',
    youth_academy:
      DRIVE_STORAGE_PHOTOS['Academia_de_pilotos.jpg'] ||
      'https://drive.google.com/thumbnail?id=1bZajSpyxHJW5ZVr9QHGx-L4MuDNYbFva&sz=w1600',
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12 select-none text-[#1E293B] antialiased">
      {/* ======================================================== */}
      {/* 1. HERO COM LINGUAGEM VISUAL PADRÃO DO JOGO             */}
      {/* ======================================================== */}
      <div className="relative rounded-2xl overflow-hidden bg-white border border-[#E2E8F0] shadow-sm p-6 sm:p-7">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-[#E10600]">
                TECNOLOGIA & OPERAÇÕES
              </span>
              <span className="text-[#CBD5E1]">•</span>
              <span className="text-[11px] font-mono text-[#64748B]">
                TEMPORADA {season?.year || 2026}
              </span>
              <span className="text-[#CBD5E1]">•</span>
              <span className="text-[10px] font-mono text-[#475569] bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0]">
                {activeTab === 'pu' ? 'PROGRAMA DE POWER UNIT' : 'CAMPUS INTEGRADO'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F172A] uppercase font-sans">
              Infraestrutura & Instalações
            </h1>

            <p className="text-xs sm:text-sm text-[#475569] font-medium">
              Desenvolva o campus técnico, monitore a confiabilidade do conjunto propulsor e planeje
              acordos de longo prazo.
            </p>
          </div>

          {/* AS 2 SUBABAS OFICIAIS CANÔNICAS — NENHUMA TERCEIRA SUBABA */}
          <div className="inline-flex p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl self-start md:self-auto shrink-0 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('pu')}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'pu'
                  ? 'bg-[#E10600] text-white shadow-sm'
                  : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Power Unit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('facilities')}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'facilities'
                  ? 'bg-[#E10600] text-white shadow-sm'
                  : 'text-[#475569] hover:text-[#0F172A] hover:bg-white/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Infraestruturas</span>
            </button>
          </div>
        </div>

        {/* Linha de KPIs Rápidos no Rodapé do Cabeçalho */}
        <div className="mt-5 pt-4 border-t border-[#F1F5F9] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#64748B] block">
              Fornecedor Atual
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <strong className="text-sm font-bold text-[#0F172A] font-mono">
                {currentSupplierSpec.name}
              </strong>
              {getEngineSupplierLogo(currentSupplierSpec.name) && (
                <img
                  src={getEngineSupplierLogo(currentSupplierSpec.name)!}
                  alt={currentSupplierSpec.name}
                  className="w-4 h-4 rounded-full object-contain shrink-0 border border-[#CBD5E1] bg-white"
                />
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-[#64748B] block">Índice PU</span>
            <span className="text-sm font-black font-mono text-cyan-600">
              {puMetrics.overall} / 100
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-[#64748B] block">
              Unidade em Uso
            </span>
            <span className="text-sm font-bold font-mono text-[#0F172A]">
              Carro #1: PU{car1PuUnit} • Carro #2: PU{car2PuUnit}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-[#64748B] block">
              Integridade Média
            </span>
            <span className="text-sm font-black font-mono text-emerald-600">
              {activeFocusUnit.integrity}%
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-[#64748B] block">
              Nível do Campus
            </span>
            <span className="text-sm font-black font-mono text-[#0F172A]">
              {audit.averageLevel} <span className="text-xs font-normal text-[#64748B]">/ 5.0</span>
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-[#64748B] block">
              Obras Ativas
            </span>
            <span className="text-sm font-bold font-mono text-amber-600">
              {activeProjects.length > 0 ? `${activeProjects.length} instalação` : 'Em dia'}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SUBABA 1: POWER UNIT                                     */}
      {/* ======================================================== */}
      {activeTab === 'pu' && (
        <div className="space-y-6 animate-fade-in">
          {/* PAINEL DE INTEGRAÇÃO CANÔNICA (PU-INTEGRATION-UI-01) */}
          <PowerUnitIntegrationPanel
            teamId={team?.team_key || team?.id || 'audi'}
            careerId={careerId}
            seasonYear={season?.year || 2026}
            supplierName={currentSupplierName}
            facilityLevel={facilityLevels?.factory ?? 5}
            staffRating={75}
          />

          {/* CARD PRINCIPAL: PACOTE ATUAL DE MOTOR */}
          <div className="rounded-2xl bg-white border border-[#E2E8F0] p-6 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Lado Esquerdo: Identidade do Fornecedor e Contrato */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center p-2 shrink-0">
                    <Zap className="w-6 h-6 text-[#E10600]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-50 text-[#E10600] border border-red-200 text-[10px] font-mono uppercase font-bold tracking-wider">
                        FORNECEDOR HOMOLOGADO
                      </Badge>
                      {getEngineSupplierLogo(currentSupplierSpec.name) && (
                        <img
                          src={getEngineSupplierLogo(currentSupplierSpec.name)!}
                          alt={currentSupplierSpec.name}
                          className="w-5 h-5 rounded-full object-contain border border-[#CBD5E1] bg-white shadow-2xs"
                        />
                      )}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black font-sans tracking-tight text-[#0F172A] uppercase mt-1">
                      {currentSupplierSpec.name} Power Unit
                    </h2>
                    <p className="text-xs text-[#64748B] font-medium">
                      Pacote regulamentar V6 Turbo Híbrido 50/50 • MGU-K de alta regeneração
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#F1F5F9] text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[10px] text-[#64748B] block uppercase">Contrato</span>
                    <strong className="text-[#0F172A] text-xs font-bold block mt-0.5">
                      2026 - 2030
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[10px] text-[#64748B] block uppercase">Custo Anual</span>
                    <strong className="text-[#0F172A] text-xs font-bold block mt-0.5">
                      {formatCurrency(currentSupplierSpec.costAnnual)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[10px] text-[#64748B] block uppercase">
                      Integração Chassi
                    </span>
                    <strong className="text-emerald-600 text-xs font-bold block mt-0.5">
                      Excelente
                    </strong>
                  </div>
                </div>

                {/* Aviso de Contrato Futuro se existir */}
                {futurePuContract && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-900 flex items-center justify-between">
                    <span>
                      Contrato Futuro Homologado:{' '}
                      <strong className="text-[#0F172A] font-mono">
                        {futurePuContract.supplierName}
                      </strong>{' '}
                      (vigência a partir de {futurePuContract.startsSeason})
                    </span>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-[10px] font-mono font-bold">
                      FIA OK
                    </Badge>
                  </div>
                )}
              </div>

              {/* Centro: Imagem Real da PU com Moldura Limpa */}
              <div className="lg:col-span-3 flex justify-center">
                <div className="relative w-full max-w-[270px] h-40 sm:h-44 rounded-xl overflow-hidden border border-[#E2E8F0] shadow-sm bg-neutral-900 group">
                  <img
                    src={puHeroImg}
                    alt="F1 Power Unit 2026"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.opacity = '0.3'
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-white">
                    <span className="font-semibold tracking-wider">FIA REGULATION</span>
                    <span className="text-[#E10600] font-black bg-white/10 px-1.5 py-0.5 rounded">
                      50/50 V6 TURBO
                    </span>
                  </div>
                </div>
              </div>

              {/* Lado Direito: Indicadores de Desempenho em Cards Claros */}
              <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2">
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center shadow-xs">
                  <span className="text-[10px] font-mono text-[#64748B] uppercase block font-semibold">
                    Desempenho
                  </span>
                  <div className="text-2xl font-black font-mono text-cyan-700 mt-1">
                    {puMetrics.overall}
                    <span className="text-xs font-normal text-[#64748B]">/100</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center shadow-xs">
                  <span className="text-[10px] font-mono text-[#64748B] uppercase block font-semibold">
                    Confiabilidade
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-600 mt-1">
                    {puMetrics.reliability}%
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center shadow-xs">
                  <span className="text-[10px] font-mono text-[#64748B] uppercase block font-semibold">
                    Eficiência
                  </span>
                  <div className="text-2xl font-black font-mono text-amber-600 mt-1">
                    {puMetrics.efficiency}%
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center shadow-xs">
                  <span className="text-[10px] font-mono text-[#64748B] uppercase block font-semibold">
                    Potencial
                  </span>
                  <div className="text-2xl font-black font-mono text-purple-600 mt-1">
                    {puMetrics.potential}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO INTERMEDIÁRIA: POOL PU1-PU4 + INTEGRIDADE DA ATUAL + GESTÃO & AÇÕES */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* BLOCO 1: Motores da Temporada 2026 (Pool PU1 a PU4 com imagem anexada) */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-3.5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center">
                      <Gauge className="w-4 h-4 text-cyan-700" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-[#0F172A]">
                        Motores da Temporada {season?.year || 2026}
                      </h3>
                      <p className="text-[11px] text-[#64748B]">
                        Alocação do pool oficial (4 unidades sem penalização de grid FIA)
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-mono font-bold">
                    PU{car1PuUnit} & PU{car2PuUnit} em uso
                  </Badge>
                </div>

                {/* Grade das 4 Unidades — PU1 e PU2 com a imagem oficial anexada */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                  {poolUnits.map((pu) => {
                    const isInUse = pu.assignedCar !== null
                    return (
                      <div
                        key={pu.unitNumber}
                        className={`rounded-xl border p-2.5 flex flex-col justify-between transition-all ${
                          isInUse
                            ? 'bg-[#F0FDF4] border-emerald-400 shadow-xs ring-1 ring-emerald-300'
                            : pu.km > 0
                              ? 'bg-[#FFFBEB] border-amber-300 shadow-2xs'
                              : 'bg-[#F8FAFC] border-[#E2E8F0]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black font-mono text-[#0F172A]">
                            PU{pu.unitNumber}
                          </span>
                          <span
                            className={`text-[9px] font-bold font-mono px-1.5 py-0.2 rounded ${
                              isInUse
                                ? 'bg-emerald-600 text-white'
                                : pu.km > 0
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-neutral-200 text-[#475569]'
                            }`}
                          >
                            {isInUse ? `C#${pu.assignedCar}` : pu.km > 0 ? 'Reserva' : 'Novo'}
                          </span>
                        </div>

                        {/* Imagem Real do Motor anexada */}
                        <div className="my-2 h-14 w-full rounded-lg overflow-hidden border border-[#E2E8F0] bg-neutral-900 relative shadow-inner">
                          <img
                            src={puAttachedUnitImg}
                            alt={`Unidade PU${pu.unitNumber}`}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                          <span className="absolute bottom-1 right-1 text-[8px] font-mono font-black text-white px-1 rounded bg-black/60">
                            {pu.integrity}%
                          </span>
                        </div>

                        <div className="space-y-0.5 text-center font-mono">
                          <div className="text-[11px] font-bold text-[#0F172A]">
                            {pu.km > 0 ? `${pu.km} km` : '0 km'}
                          </div>
                          <div className="text-[9px] text-[#64748B]">
                            {pu.km > 0 ? `Desgaste: ${pu.wear}%` : 'Pronto p/ montar'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#475569] flex items-center justify-between">
                <span>
                  Alocação atual: Carro 1 → PU{car1PuUnit} | Carro 2 → PU{car2PuUnit}
                </span>
                <button
                  type="button"
                  onClick={() => setAllocationModalOpen(true)}
                  className="text-xs font-bold text-[#E10600] hover:underline cursor-pointer"
                >
                  Alterar alocação →
                </button>
              </div>
            </div>

            {/* BLOCO 2: Integridade da Unidade Atual (PU em foco no Carro 1) */}
            <div className="lg:col-span-4 p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-3.5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-[#0F172A]">
                        Integridade da Unidade (PU{activeFocusUnit.unitNumber})
                      </h3>
                      <p className="text-[11px] text-[#64748B]">
                        Montada no Carro #1 • Telemetria em tempo real
                      </p>
                    </div>
                  </div>
                  <span className="text-base font-black font-mono text-emerald-600">
                    {activeFocusUnit.integrity}%
                  </span>
                </div>

                {/* Barra Grande de Integridade Estilo Claro */}
                <div className="w-full bg-[#F1F5F9] h-3 rounded-full overflow-hidden p-0.5 border border-[#E2E8F0] mt-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeFocusUnit.integrity > 75
                        ? 'bg-emerald-500'
                        : activeFocusUnit.integrity > 50
                          ? 'bg-amber-500'
                          : 'bg-red-600'
                    }`}
                    style={{ width: `${activeFocusUnit.integrity}%` }}
                  />
                </div>

                {/* Parâmetros Derivados do Módulo de Desgaste */}
                <div className="space-y-2 text-xs font-mono pt-3">
                  <div className="flex justify-between items-center text-[#475569] pb-1.5 border-b border-[#F1F5F9]">
                    <span>Desgaste acumulado:</span>
                    <span className="text-[#0F172A] font-bold">{activeFocusUnit.wear}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[#475569] pb-1.5 border-b border-[#F1F5F9]">
                    <span>Quilometragem total:</span>
                    <span className="text-cyan-700 font-bold">{activeFocusUnit.km} km</span>
                  </div>
                  <div className="flex justify-between items-center text-[#475569] pb-1.5 border-b border-[#F1F5F9]">
                    <span>Grandes Prêmios completados:</span>
                    <span className="text-[#0F172A] font-bold">{currentRound} rodadas</span>
                  </div>
                  <div className="flex justify-between items-center text-[#475569] pb-1.5 border-b border-[#F1F5F9]">
                    <span>Vida útil estimada restante:</span>
                    <span className="text-emerald-700 font-bold">~ 2 a 3 GPs</span>
                  </div>
                  <div className="flex justify-between items-center text-[#475569] pt-0.5">
                    <span>Risco de pane mecânica:</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {activeFocusUnit.risk}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between">
                <span>Condição térmica e compressão conformes aos limites FIA.</span>
              </div>
            </div>

            {/* BLOCO 3: Gestão & Ações Operacionais */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-[#0F172A]">
                  Gestão & Ações
                </h3>
                <p className="text-xs text-[#64748B] mt-1">
                  Configure os motores por cockpit e abra negociações oficiais de fornecimento para
                  2027.
                </p>
              </div>

              <div className="space-y-2.5">
                <Button
                  onClick={() => setAllocationModalOpen(true)}
                  className="w-full h-10 bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-sans text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <RotateCw className="w-4 h-4 text-cyan-600" />
                  <span>Gerenciar Alocação</span>
                </Button>

                <Button
                  onClick={() => handleOpenNegotiation(currentSupplierSpec)}
                  className="w-full h-10 bg-[#E10600] hover:bg-[#C00400] text-white font-sans text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-white" />
                  <span>Negociar Fornecedor</span>
                </Button>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#475569] flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                <span className="leading-snug">
                  Unidades trocadas além do limite de 4 acarretam penalidades regulamentares de 10
                  posições no grid de largada.
                </span>
              </div>
            </div>
          </div>

          {/* SEÇÃO INFERIOR: COMPARATIVO DE FORNECEDORES + IMPACTO E RECOMENDAÇÃO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Comparativo dos 5 Principais Fornecedores (com Logos Reais ao lado direito do nome) */}
            <div className="lg:col-span-8 p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold font-sans uppercase tracking-wider text-[#0F172A]">
                    Comparativo de Fornecedores de Power Unit 2026
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Compare potência, confiabilidade, eficiência e custo anual dos 5 motores
                    homologados.
                  </p>
                </div>
              </div>

              {/* Grade dos 5 Fornecedores com Logos Oficiais da pasta do Drive */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                {ENGINE_SUPPLIERS.map((supplier) => {
                  const isCurrent =
                    supplier.name.toLowerCase() === currentSupplierName.toLowerCase()
                  const logoUrl = getEngineSupplierLogo(supplier.name)

                  return (
                    <div
                      key={supplier.name}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                        isCurrent
                          ? 'bg-[#FFF5F5] border-[#E10600] shadow-sm ring-1 ring-[#E10600]'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-white'
                      }`}
                    >
                      <div>
                        {/* Nome do Fornecedor + Logo Oficial à Direita */}
                        <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-[#E2E8F0]/70">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-sm text-[#0F172A] truncate">
                              {supplier.name}
                            </span>
                            {logoUrl && (
                              <img
                                src={logoUrl}
                                alt={`Logo ${supplier.name}`}
                                loading="lazy"
                                className="w-5 h-5 rounded-full object-contain shrink-0 border border-[#CBD5E1] bg-white shadow-2xs"
                              />
                            )}
                          </div>
                          {isCurrent && (
                            <Badge className="bg-[#E10600] text-white text-[8px] font-mono px-1 py-0 shrink-0">
                              ATUAL
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1.5 text-xs font-mono pt-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[#64748B]">Potência:</span>
                            <strong className="text-[#0F172A]">{supplier.power}</strong>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#64748B]">Confiabilidade:</span>
                            <strong className="text-emerald-600">{supplier.reliability}%</strong>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#64748B]">Eficiência:</span>
                            <strong className="text-amber-600">79%</strong>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#64748B]">Potencial:</span>
                            <strong className="text-purple-600">84</strong>
                          </div>
                          <div className="flex justify-between items-center pt-1.5 border-t border-[#E2E8F0] text-[10px]">
                            <span className="text-[#64748B]">Custo anual:</span>
                            <span className="text-[#0F172A] font-bold">
                              {formatCurrency(supplier.costAnnual)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3">
                        {isCurrent ? (
                          <div className="py-1.5 text-center rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Em Uso
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleOpenNegotiation(supplier)}
                            className="w-full h-8 bg-white hover:bg-[#E10600] hover:text-white border border-[#CBD5E1] text-[#0F172A] text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer"
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
              <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-3 shadow-sm">
                <h3 className="text-xs font-bold font-sans uppercase tracking-wider text-[#0F172A]">
                  Impacto da Troca de Fornecedor
                </h3>
                <p className="text-xs text-[#64748B]">
                  Efeitos práticos de uma eventual mudança de motor para a equipe.
                </p>

                <div className="space-y-2 text-xs font-mono pt-1">
                  <div className="flex justify-between items-center pb-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Esforço de integração:</span>
                    <span className="text-red-600 font-bold">Alto</span>
                  </div>
                  <div className="flex justify-between items-center pb-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Compatibilidade chassi:</span>
                    <span className="text-amber-600 font-bold">Média</span>
                  </div>
                  <div className="flex justify-between items-center pb-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Tempo de adaptação:</span>
                    <span className="text-cyan-700 font-bold">2 - 4 GPs</span>
                  </div>
                  <div className="flex justify-between items-center pb-1 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Risco de perda inicial:</span>
                    <span className="text-red-600 font-bold">Alto</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#64748B]">Potencial de ganho:</span>
                    <span className="text-emerald-600 font-bold">Alto</span>
                  </div>
                </div>
              </div>

              {/* Painel: Recomendação da Equipe */}
              <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-sans uppercase tracking-wider text-[#0F172A]">
                    Recomendação da Equipe
                  </span>
                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[9px] font-bold">
                    {teamRecommendation.badge}
                  </Badge>
                </div>
                <p className="text-xs text-[#334155] leading-relaxed">{teamRecommendation.text}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBABA 2: INFRAESTRUTURAS (Linguagem Clara e Elegante)   */}
      {/* ======================================================== */}
      {activeTab === 'facilities' && (
        <div className="space-y-6 animate-fade-in">
          {/* HERO DO CAMPUS COM A IMAGEM OFICIAL DO DRIVE */}
          <div className="relative rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-sm min-h-[180px] flex items-end">
            <img
              src={campusHeroImg}
              alt="Campus Tecnológico da Equipe"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.currentTarget
                target.style.opacity = '0.3'
              }}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent pointer-events-none" />

            <div className="relative w-full p-6 sm:p-7 flex flex-col md:flex-row md:items-end justify-between gap-5 z-10">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-md bg-[#E10600] flex items-center justify-center text-white">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-mono font-bold text-[#475569] uppercase tracking-wider">
                    Campus de Engenharia {team?.name || 'Audi F1 Team'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black font-sans tracking-tight text-[#0F172A] uppercase">
                  Tecnologia, Manufatura e Precisão Operacional
                </h2>
                <p className="text-xs text-[#64748B] mt-1">
                  9 instalações canônicas integradas. O nível do campus define a velocidade de
                  produção, acurácia da correlação túnel-CFD e tempo de pit stop.
                </p>
              </div>

              {/* 4 Indicadores Rápidos do Campus */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono shrink-0">
                <div className="p-3 rounded-xl bg-white/95 border border-[#E2E8F0] shadow-xs backdrop-blur-sm">
                  <span className="text-[9px] text-[#64748B] block uppercase font-semibold">
                    Nível Médio
                  </span>
                  <strong className="text-base text-emerald-600 font-black">
                    {audit.averageLevel}{' '}
                    <span className="text-xs text-[#64748B] font-normal">/ 5</span>
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-white/95 border border-[#E2E8F0] shadow-xs backdrop-blur-sm">
                  <span className="text-[9px] text-[#64748B] block uppercase font-semibold">
                    Eficiência
                  </span>
                  <strong className="text-base text-cyan-700 font-black">
                    {audit.capabilities.operationalEfficiency}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-white/95 border border-[#E2E8F0] shadow-xs backdrop-blur-sm">
                  <span className="text-[9px] text-[#64748B] block uppercase font-semibold">
                    Precisão
                  </span>
                  <strong className="text-base text-blue-700 font-black">
                    {audit.capabilities.simulationAccuracy}
                  </strong>
                </div>

                <div className="p-3 rounded-xl bg-white/95 border border-[#E2E8F0] shadow-xs backdrop-blur-sm">
                  <span className="text-[9px] text-[#64748B] block uppercase font-semibold">
                    OPEX Anual
                  </span>
                  <strong className="text-base text-amber-700 font-black">
                    {formatCurrency(audit.totalAnnualOpex)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* AS 9 INSTALAÇÕES CANÔNICAS (3 COLUNAS EM CARDS CLAROS E ELEGANTES) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CANONICAL_FACILITIES_DEFINITIONS.map((fac) => {
              const currentLvl = facilityLevels[fac.id]
              const isMax = currentLvl >= 5
              const imgUrl = FACILITY_IMAGE_MAP[fac.id] || campusHeroImg
              const isUnderConstruction = f1Service.isFacilityUnderConstruction(team, fac.id)
              const project = f1Service.getActiveFacilityProject(team, fac.id)

              return (
                <div
                  key={fac.id}
                  className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden flex flex-col justify-between shadow-sm group hover:shadow-md hover:border-[#CBD5E1] transition-all"
                >
                  <div>
                    {/* Imagem da Instalação */}
                    <div className="relative h-36 w-full overflow-hidden bg-neutral-900">
                      <img
                        src={imgUrl}
                        alt={fac.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget
                          target.style.opacity = '0.3'
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-white uppercase drop-shadow-md">
                          {fac.shortName}
                        </span>
                        {isUnderConstruction ? (
                          <Badge className="bg-amber-500 text-white border-none text-[9px] font-mono font-bold shadow-xs">
                            OBRA ATÉ R{project?.completionRound}
                          </Badge>
                        ) : (
                          <Badge
                            className={`font-mono text-[9px] font-bold uppercase px-2 py-0.5 shadow-xs ${
                              isMax
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-white/90 text-[#0F172A] border-[#E2E8F0]'
                            }`}
                          >
                            NÍVEL {currentLvl} / 5
                          </Badge>
                        )}
                      </div>

                      {/* Título sobreposto sutil */}
                      <div className="absolute bottom-2 left-2.5 right-2.5 text-white">
                        <h4 className="text-xs font-bold leading-tight drop-shadow-sm truncate">
                          {fac.name}
                        </h4>
                      </div>
                    </div>

                    {/* Conteúdo Técnico */}
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed">
                        {fac.subtitle}
                      </p>

                      {/* 2 Efeitos Centrais */}
                      <div className="space-y-1.5 pt-1">
                        {fac.effects.slice(0, 2).map((eff, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center gap-2 text-[11px] font-mono"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shrink-0" />
                            <span className="font-bold text-[#0F172A] truncate">{eff.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Botão Expandir com Estilo Limpo */}
                  <div className="p-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <Button
                      onClick={() => handleOpenExpandFacility(fac)}
                      disabled={isMax || isUnderConstruction}
                      className={`w-full h-9 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        isMax
                          ? 'bg-neutral-200 text-[#64748B] cursor-default'
                          : isUnderConstruction
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 cursor-default'
                            : 'bg-[#E10600] hover:bg-[#C00400] text-white shadow-xs'
                      }`}
                    >
                      {isMax
                        ? 'Padrão Máximo'
                        : isUnderConstruction
                          ? 'Em Obras'
                          : 'Expandir Instalação >'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* SEÇÃO INFERIOR: SINERGIAS-CHAVE + GARGALOS ATUAIS + OBRAS EM ANDAMENTO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Painel 1: Sinergias-chave */}
            <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-700 font-sans font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Sinergias do Campus</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#334155]">
                  <strong className="text-emerald-700 block mb-0.5">CFD + Túnel de Vento</strong>
                  Maior correlação dos pacotes aerodinâmicos e redução de incerteza em pista.
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#334155]">
                  <strong className="text-cyan-700 block mb-0.5">Design + Manufatura</strong>
                  Redução dos ciclos de produção para entrega rápida de atualizações.
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#334155]">
                  <strong className="text-purple-700 block mb-0.5">Simulador + Academia</strong>
                  Desenvolvimento contínuo de pilotos e aceleração de jovens talentos.
                </div>
              </div>
            </div>

            {/* Painel 2: Gargalos Atuais (Calculados Dinamicamente) */}
            <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-red-600 font-sans font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>Gargalos Operacionais</span>
              </div>

              {audit.bottlenecks.length > 0 ? (
                <div className="space-y-2">
                  {audit.bottlenecks.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-red-50 border border-red-200 text-[11px] text-[#334155]"
                    >
                      <strong className="text-red-700 font-mono block">
                        ● {b.title} ({b.penaltyPercent > 0 ? `-${b.penaltyPercent}%` : ''})
                      </strong>
                      <p className="text-[#64748B] mt-0.5 leading-snug">{b.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B]">
                  Nenhum gargalo severo detectado. Instalações operam em equilíbrio técnico
                  harmonioso.
                </div>
              )}
            </div>

            {/* Painel 3: Obras em Andamento */}
            <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600 font-sans font-bold text-xs uppercase tracking-wider">
                <Hammer className="w-4 h-4" />
                <span>Canteiro de Obras</span>
              </div>

              {activeProjects.length > 0 ? (
                <div className="space-y-3">
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
                        className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2 text-xs font-mono"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#0F172A] uppercase text-[11px]">
                            {p.facilityId.replace('_', ' ')}
                          </span>
                          <span className="text-cyan-700 text-[10px] font-bold">
                            Conclusão: R{p.completionRound}
                          </span>
                        </div>
                        <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-[#64748B] flex justify-between">
                          <span>Progresso: {Math.round(progressPct)}%</span>
                          <span>Faltam {roundsLeft} rodadas</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] text-center">
                  Nenhuma obra em andamento no momento.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
