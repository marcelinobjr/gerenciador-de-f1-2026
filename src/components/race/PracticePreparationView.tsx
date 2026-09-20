import React, { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/PageHeader'
import { PracticeCarPanel } from './PracticeCarPanel'
import {
  practicePreparationService,
  validateOverallPractice,
  copyCarSetup,
  calculateEstimatedLaps,
} from '@/services/practicePreparationService'
import { practiceSessionService } from '@/services/practiceSessionService'
import type {
  PracticePreparation,
  PracticeSessionType,
  PracticeProgramType,
  PracticeCarSetup,
} from '@/types/practice-preparation'
import { PRACTICE_PROGRAMS, DEFAULT_PRACTICE_SETUP } from '@/types/practice-preparation'
import { createInitialTireInventory, formatTireName } from '@/lib/f1-tire-system'
import { canonicalWeekendTyrePersistence } from '@/services/canonicalWeekendTyrePersistence'
import { hasSprintWeekend } from '@/services/weekendProgressionService'
import type { DriverModel, TeamModel, TireSetItem, TireCompound } from '@/types/f1'
import { getCountryFlag } from '@/lib/country-flags'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { getTeamCarPhotoUrl } from '@/lib/team-car-photo-resolver'
import { toast } from '@/hooks/use-toast'
import {
  Flag,
  CloudRain,
  Sun,
  CloudSun,
  Play,
  RotateCcw,
  CheckCircle2,
  Lock,
  ChevronRight,
  Sparkles,
  Info,
  Disc,
  Layers,
  ArrowRight,
} from 'lucide-react'

interface PracticePreparationViewProps {
  careerId: string
  seasonId: string
  round: number
  sessionType?: PracticeSessionType
  team: TeamModel
  drivers: DriverModel[]
  allTiresByDriver?: Record<string, TireSetItem[]>
  onStartSessionHandoff: (prep: PracticePreparation) => void
  onNavigateToWeekendTab?: (tab: string) => void
}

export function PracticePreparationView({
  careerId,
  seasonId,
  round,
  sessionType = 'tp1',
  team,
  drivers,
  allTiresByDriver,
  onStartSessionHandoff,
  onNavigateToWeekendTab,
}: PracticePreparationViewProps) {
  // Pilotos titulares reais
  const primaryDrivers = useMemo(() => {
    return drivers.filter((d) => d.role !== 'reserva').slice(0, 2)
  }, [drivers])

  const driver1 = primaryDrivers[0]
  const driver2 = primaryDrivers[1]

  // Inventário canônico real e persistente por piloto (20 jogos GP padrão / 19 jogos Sprint)
  const persistentInventories = useMemo(() => {
    if (!driver1 || !driver2) return null
    return canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId,
      round,
      driverIds: [driver1.id, driver2.id],
      primaryDriverIds: [driver1.id, driver2.id],
    })
  }, [seasonId, round, driver1, driver2])

  const isSprint = useMemo(() => hasSprintWeekend(round), [round])

  const car1Tires = useMemo(() => {
    if (driver1 && allTiresByDriver && allTiresByDriver[driver1.id]) {
      return allTiresByDriver[driver1.id]
    }
    if (driver1 && persistentInventories && persistentInventories[driver1.id]) {
      return persistentInventories[driver1.id]
    }
    return createInitialTireInventory(driver1?.id || 'd1', { isSprint, round })
  }, [driver1, allTiresByDriver, persistentInventories, isSprint, round])

  const car2Tires = useMemo(() => {
    if (driver2 && allTiresByDriver && allTiresByDriver[driver2.id]) {
      return allTiresByDriver[driver2.id]
    }
    if (driver2 && persistentInventories && persistentInventories[driver2.id]) {
      return persistentInventories[driver2.id]
    }
    return createInitialTireInventory(driver2?.id || 'd2', { isSprint, round })
  }, [driver2, allTiresByDriver, persistentInventories, isSprint, round])

  // Foto do carro da equipe
  const carImageUrl = useMemo(() => {
    return (
      (team as any)?.carImage ||
      (team as any)?.photo ||
      getTeamCarPhotoUrl(team?.name || team?.team_key)
    )
  }, [team])

  // Perfil Canônico do Circuito e Calendário
  const gpCalendarInfo = useMemo(() => {
    return F1_2026_CALENDAR.find((gp) => gp.round === round) || F1_2026_CALENDAR[0]
  }, [round])

  const circuitProfile = useMemo(() => {
    return resolveCircuitProfile({ round })
  }, [round])

  // Clima canônico procedural da rodada
  const weatherState = useMemo(() => {
    const seed = round * 17 + 2026
    const prob = Math.round(((Math.sin(seed) + 1) / 2) * 100)
    let condition = 'Seco e Ensolarado'
    let icon = <Sun className="w-4 h-4 text-amber-400" />
    let isRain = false

    if (prob > 70) {
      condition = 'Chuva Forte / Pista Molhada'
      icon = <CloudRain className="w-4 h-4 text-blue-400 animate-pulse" />
      isRain = true
    } else if (prob >= 35) {
      condition = 'Nublado com risco de chuva leve'
      icon = <CloudSun className="w-4 h-4 text-sky-400" />
      isRain = true
    }

    const airTemp = Math.round(21 + ((Math.cos(seed) + 1) / 2) * 12)
    const trackTemp = Math.round(28 + ((Math.sin(seed * 2) + 1) / 2) * 18)

    return { condition, icon, isRain, prob, airTemp, trackTemp }
  }, [round])

  // Estado da Preparação (DOIS carros)
  const [prep, setPrep] = useState<PracticePreparation | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Resolução do conhecimento herdado (Etapa 4D.1): se for TL2/TL3, herda faixas do TL1/TL2
  const inheritedKnowledgeData = useMemo(() => {
    return practiceSessionService.resolveInheritedWeekendKnowledge(
      careerId,
      seasonId,
      round,
      sessionType,
    )
  }, [careerId, seasonId, round, sessionType])

  // Carga inicial persistente de `session_setups`
  useEffect(() => {
    let active = true
    setLoading(true)

    practicePreparationService
      .loadPreparation({
        careerId,
        seasonId,
        round,
        sessionType,
        driver1Id: driver1?.id,
        driver2Id: driver2?.id,
        defaultSetup: DEFAULT_PRACTICE_SETUP,
      })
      .then((loaded) => {
        if (!active) return

        // Auto-seleciona primeiro jogo de pneu disponível caso ainda não haja reserva
        const updatedCars = [...loaded.cars] as [any, any]

        // Carro 1 auto-seleciona pneu disponível se ainda nulo
        if (!updatedCars[0].tyreSelection && car1Tires.length > 0) {
          const preferred = weatherState.isRain
            ? car1Tires.find((t) => t.compound === 'intermediario') || car1Tires[0]
            : car1Tires.find((t) => t.compound === 'medio') || car1Tires[0]
          if (preferred) {
            updatedCars[0].tyreSelection = {
              setId: preferred.id,
              compound: preferred.compound,
              isReserved: true,
            }
          }
        }

        // Carro 2 auto-seleciona pneu disponível se ainda nulo
        if (!updatedCars[1].tyreSelection && car2Tires.length > 0) {
          const preferred = weatherState.isRain
            ? car2Tires.find((t) => t.compound === 'intermediario') || car2Tires[0]
            : car2Tires.find((t) => t.compound === 'medio') || car2Tires[0]
          if (preferred) {
            updatedCars[1].tyreSelection = {
              setId: preferred.id,
              compound: preferred.compound,
              isReserved: true,
            }
          }
        }

        const nextPrep: PracticePreparation = {
          ...loaded,
          cars: updatedCars,
        }

        setPrep(nextPrep)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Erro ao carregar preparação TL:', err)
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [
    careerId,
    seasonId,
    round,
    sessionType,
    driver1?.id,
    driver2?.id,
    car1Tires,
    car2Tires,
    weatherState.isRain,
  ])

  // Validação geral em tempo real
  const overallValidation = useMemo(() => {
    if (!prep)
      return {
        canStart: false,
        car1: { valid: false, errors: {} },
        car2: { valid: false, errors: {} },
      }
    return validateOverallPractice(prep, car1Tires, car2Tires)
  }, [prep, car1Tires, car2Tires])

  // Handlers para Carro 1
  const updateCar1Program = (program: PracticeProgramType) => {
    if (!prep) return
    const next: PracticePreparation = {
      ...prep,
      cars: [
        {
          ...prep.cars[0],
          program,
          objective: PRACTICE_PROGRAMS[program].objective,
        },
        prep.cars[1],
      ],
    }
    setPrep(next)
    practicePreparationService.savePreparation(next)
  }

  const selectCar1Tyre = (tire: TireSetItem) => {
    if (!prep) return
    const next: PracticePreparation = {
      ...prep,
      cars: [
        {
          ...prep.cars[0],
          tyreSelection: {
            setId: tire.id,
            compound: tire.compound,
            isReserved: true,
          },
        },
        prep.cars[1],
      ],
    }
    setPrep(next)
    practicePreparationService.savePreparation(next)
  }

  const updateCar1FuelKg = (kg: number) => {
    if (!prep) return
    const next: PracticePreparation = {
      ...prep,
      cars: [
        {
          ...prep.cars[0],
          fuelLoad: {
            kg,
            estimatedLaps: calculateEstimatedLaps(kg),
          },
        },
        prep.cars[1],
      ],
    }
    setPrep(next)
    practicePreparationService.savePreparation(next)
  }

  const updateCar1SetupParam = (param: keyof PracticeCarSetup, value: number) => {
    if (!prep) return
    const next: PracticePreparation = {
      ...prep,
      cars: [
        {
          ...prep.cars[0],
          setup: {
            ...prep.cars[0].setup,
            [param]: value,
          },
        },
        prep.cars[1],
      ],
    }
    setPrep(next)
    practicePreparationService.savePreparation(next)
  }

  // Handlers para Carro 2
  const updateCar2Program = (program: PracticeProgramType) => {
    if (!prep) return
    const next: PracticePreparation = {
      ...prep,
      cars: [
        prep.cars[0],
        {
          ...prep.cars[1],
          program,
          objective: PRACTICE_PROGRAMS[program].objective,
        },
      ],
    }
    setPrep(next)
    practicePreparationService.savePreparation(next)
  }

  const selectCar2Tyre = (tire: TireSetItem) => {
    if (!prep) return
    const next: PracticePreparation = {
      ...prep,
      cars: [
        prep.cars[0],
        {
          ...prep.cars[1],
          tyreSelection: {
            setId: tire.id,
            compound: tire.compound,
            isReserved: true,
          },
        },
      ],
    }
    setPrep(next)
    practicePreparationService.savePreparation(next)
  }

  const updateCar2FuelKg = (kg: number) => {
    if (!prep) return
    const next: PracticePreparation = {
      ...prep,
      cars: [
        prep.cars[0],
        {
          ...prep.cars[1],
          fuelLoad: {
            kg,
            estimatedLaps: calculateEstimatedLaps(kg),
          },
        },
      ],
    }
    setPrep(next)
    practicePreparationService.savePreparation(next)
  }

  const updateCar2SetupParam = (param: keyof PracticeCarSetup, value: number) => {
    if (!prep) return
    const next: PracticePreparation = {
      ...prep,
      cars: [
        prep.cars[0],
        {
          ...prep.cars[1],
          setup: {
            ...prep.cars[1].setup,
            [param]: value,
          },
        },
      ],
    }
    setPrep(next)
    practicePreparationService.savePreparation(next)
  }

  // Copiar Setup Carro 1 → Carro 2
  const handleCopySetupCar1ToCar2 = () => {
    if (!prep) return
    const copied = copyCarSetup(prep.cars[0], prep.cars[1])
    const next: PracticePreparation = {
      ...prep,
      cars: [prep.cars[0], copied],
    }
    setPrep(next)
    practicePreparationService.savePreparation(next)
    toast({
      title: 'Setup Copiado com Sucesso',
      description: 'Parâmetros mecânicos e aerodinâmicos do Carro 1 transferidos para o Carro 2.',
    })
  }

  // Copiar Setup Carro 2 → Carro 1
  const handleCopySetupCar2ToCar1 = () => {
    if (!prep) return
    const copied = copyCarSetup(prep.cars[1], prep.cars[0])
    const next: PracticePreparation = {
      ...prep,
      cars: [copied, prep.cars[1]],
    }
    setPrep(next)
    practicePreparationService.savePreparation(next)
    toast({
      title: 'Setup Copiado com Sucesso',
      description: 'Parâmetros mecânicos e aerodinâmicos do Carro 2 transferidos para o Carro 1.',
    })
  }

  // Ação canônica "INICIAR TL1" (ou TL2 / TL3)
  const handleStartSession = async () => {
    if (!prep || !overallValidation.canStart) {
      toast({
        variant: 'destructive',
        title: 'Configuração Incompleta',
        description: 'Revise os painéis dos dois carros antes de liberar a saída para a pista.',
      })
      return
    }

    setIsSaving(true)
    try {
      const readyPrep: PracticePreparation = {
        ...prep,
        status: 'ready',
        cars: [
          { ...prep.cars[0], status: 'ready' },
          { ...prep.cars[1], status: 'ready' },
        ],
        updatedAt: new Date().toISOString(),
      }

      await practicePreparationService.savePreparation(readyPrep)
      setPrep(readyPrep)

      toast({
        title: `Preparação do ${sessionType.toUpperCase()} Concluída`,
        description: 'Ambos os carros configurados e autorizados. Preparando handoff da sessão!',
      })

      // Handoff para o fluxo
      onStartSessionHandoff(readyPrep)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao persistir preparação',
        description: err?.message || 'Falha ao salvar setup no PocketBase.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading || !prep) {
    return (
      <div className="p-12 text-center font-mono text-xs text-[#8B95A7] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        Carregando parâmetros técnicos e estoque oficial de pneus...
      </div>
    )
  }

  const sessionLabelMap: Record<PracticeSessionType, string> = {
    tp1: 'Treino Livre 1 (TL1)',
    tp2: 'Treino Livre 2 (TL2)',
    tp3: 'Treino Livre 3 (TL3)',
  }

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO DO GP COM DADOS REAIS */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-[#1F2733] bg-[#090D15]/90 backdrop-blur-md shadow-2xl">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#E10600]">
              FIA F1 WORLD CHAMPIONSHIP // PREPARAÇÃO DE SESSÃO
            </span>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 font-mono text-[10px] font-bold">
              {sessionLabelMap[sessionType]}
            </Badge>
            <Badge
              variant="outline"
              className="font-mono text-[10px] border-[#222E42] text-[#8B95A7]"
            >
              RODADA {round}/24 • TEMPORADA 2026
            </Badge>
            {circuitProfile?.hasSprint && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 font-mono text-[10px] font-bold">
                ⚡ FIM DE SEMANA COM SPRINT
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">{gpCalendarInfo.flag || '🏁'}</span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
                {gpCalendarInfo.name}
              </h2>
              <p className="text-xs text-[#8B95A7] font-mono">
                {gpCalendarInfo.circuit} • {gpCalendarInfo.country} • Extensão:{' '}
                {gpCalendarInfo.circuitLengthKm} km • {gpCalendarInfo.laps} voltas
              </p>
            </div>
          </div>
        </div>

        {/* Bloco de Previsão do Tempo Oficial */}
        <div className="p-3.5 rounded-xl bg-[#0E1521] border border-[#1F2B3E] font-mono text-xs flex flex-col justify-between gap-1.5 min-w-[240px]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-[#8B95A7] flex items-center gap-1.5">
              {weatherState.icon} Previsão do Tempo
            </span>
            <span className="text-[10px] text-cyan-400 font-bold">Risco {weatherState.prob}%</span>
          </div>
          <div className="text-xs font-extrabold text-white">{weatherState.condition}</div>
          <div className="flex justify-between text-[10px] text-[#8B95A7]">
            <span>Ar: {weatherState.airTemp}°C</span>
            <span>Pista: {weatherState.trackTemp}°C</span>
            <span>Abrasividade: {gpCalendarInfo.tireAbrasiveness || 6}/10</span>
          </div>
        </div>
      </div>

      {/* 2. NAVEGAÇÃO DO FIM DE SEMANA COM SESSÕES FUTURAS BLOQUEADAS */}
      <div className="p-3 rounded-xl bg-[#090D15]/80 border border-[#1A2333] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#8B95A7]">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Esteira do Fim de Semana:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* TL1 (Ativa / Liberada) */}
          <div className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>TL1 (Atual)</span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-[#324056]" />

          {/* TL2 (Bloqueado nesta etapa) */}
          <div
            title="Sessão futura bloqueada: complete o TL1 primeiro"
            className="px-3 py-1.5 rounded-lg bg-[#0E1521] border border-[#1A2333] text-[#525E75] font-mono text-xs font-bold flex items-center gap-1.5 cursor-not-allowed opacity-75"
          >
            <Lock className="w-3 h-3 text-[#525E75]" />
            <span>TL2</span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-[#324056]" />

          {/* TL3 (Bloqueado nesta etapa) */}
          <div
            title="Sessão futura bloqueada: complete as anteriores primeiro"
            className="px-3 py-1.5 rounded-lg bg-[#0E1521] border border-[#1A2333] text-[#525E75] font-mono text-xs font-bold flex items-center gap-1.5 cursor-not-allowed opacity-75"
          >
            <Lock className="w-3 h-3 text-[#525E75]" />
            <span>TL3</span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-[#324056]" />

          {/* Classificação (Bloqueada) */}
          <div
            title="Classificação oficial bloqueada"
            className="px-3 py-1.5 rounded-lg bg-[#0E1521] border border-[#1A2333] text-[#525E75] font-mono text-xs font-bold flex items-center gap-1.5 cursor-not-allowed opacity-75"
          >
            <Lock className="w-3 h-3 text-[#525E75]" />
            <span>Classificação</span>
          </div>

          <ArrowRight className="w-3.5 h-3.5 text-[#324056]" />

          {/* Corrida (Bloqueada) */}
          <div
            title="Grande Prêmio oficial bloqueado"
            className="px-3 py-1.5 rounded-lg bg-[#0E1521] border border-[#1A2333] text-[#525E75] font-mono text-xs font-bold flex items-center gap-1.5 cursor-not-allowed opacity-75"
          >
            <Lock className="w-3 h-3 text-[#525E75]" />
            <span>Corrida</span>
          </div>
        </div>

        {onNavigateToWeekendTab && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigateToWeekendTab('race')}
            className="text-xs font-mono text-[#8B95A7] hover:text-white"
          >
            Voltar ao Painel Geral
          </Button>
        )}
      </div>

      {/* 3. DOIS PAINÉIS INDEPENDENTES: CARRO 1 E CARRO 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Painel do Carro 1 */}
        <PracticeCarPanel
          carNumber={1}
          carPrep={prep.cars[0]}
          driver={driver1}
          teamName={team?.name || 'Equipe'}
          teamColor={team?.color || '#E10600'}
          carImageUrl={carImageUrl}
          availableTires={car1Tires}
          validation={overallValidation.car1}
          inheritedKnowledge={inheritedKnowledgeData.setupKnowledge}
          onUpdateProgram={updateCar1Program}
          onSelectTyre={selectCar1Tyre}
          onUpdateFuelKg={updateCar1FuelKg}
          onUpdateSetupParam={updateCar1SetupParam}
          onCopySetupFromOtherCar={handleCopySetupCar2ToCar1}
          otherCarNumber={2}
        />

        {/* Painel do Carro 2 */}
        <PracticeCarPanel
          carNumber={2}
          carPrep={prep.cars[1]}
          driver={driver2}
          teamName={team?.name || 'Equipe'}
          teamColor={team?.color || '#E10600'}
          carImageUrl={carImageUrl}
          availableTires={car2Tires}
          validation={overallValidation.car2}
          inheritedKnowledge={inheritedKnowledgeData.setupKnowledge}
          onUpdateProgram={updateCar2Program}
          onSelectTyre={selectCar2Tyre}
          onUpdateFuelKg={updateCar2FuelKg}
          onUpdateSetupParam={updateCar2SetupParam}
          onCopySetupFromOtherCar={handleCopySetupCar1ToCar2}
          otherCarNumber={1}
        />
      </div>

      {/* 4. RODAPÉ: ESTOQUE REAL DE PNEUS DISPONÍVEIS NO FIM DE SEMANA POR PILOTO */}
      <Card className="p-5 bg-[#090D15]/80 border border-[#1A2333] rounded-2xl font-mono text-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#1A2333] pb-3">
          <div className="flex items-center gap-2">
            <Disc className="w-4 h-4 text-amber-400" />
            <h4 className="font-extrabold text-white text-sm">
              Estoque Oficial de Pneus do Fim de Semana (FIA Allocation 2026)
            </h4>
          </div>
          <span className="text-[10px] text-[#8B95A7]">
            13 jogos por piloto • Reserva sem débito antecipado
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Piloto 1 */}
          <div className="space-y-2 p-3 rounded-xl bg-[#0E1521] border border-[#1A2436]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                {getCountryFlag(driver1?.nationality)} {driver1?.name || 'Piloto 1'} (Carro 1)
              </span>
              <span className="text-[10px] text-[#00A6FB]">{car1Tires.length} jogos totais</span>
            </div>
            <div className="space-y-1.5 pt-1">
              {(['macio', 'medio', 'duro', 'intermediario', 'chuva_extrema'] as TireCompound[]).map(
                (comp) => {
                  const setsOfComp = car1Tires.filter((t) => t.compound === comp)
                  const total = setsOfComp.length
                  const novos = setsOfComp.filter(
                    (s) => (s.wear || 0) === 0 && (s.lapsUsed || 0) === 0 && !s.isFitted,
                  ).length
                  const usados = setsOfComp.filter(
                    (s) =>
                      ((s.wear || 0) > 0 || (s.lapsUsed || 0) > 0) &&
                      !s.isFitted &&
                      (s.wear || 0) < 90,
                  ).length
                  const instalados = setsOfComp.filter((s) => s.isFitted).length
                  const indisp = setsOfComp.filter((s) => (s.wear || 0) >= 90).length

                  return (
                    <div
                      key={comp}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-[#090D15] border border-[#1E293B] text-[11px]"
                    >
                      <span className="text-white font-bold uppercase w-28">
                        {comp === 'chuva_extrema' ? 'CHUVA' : comp.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-[#8B95A7]">
                          Total: <strong className="text-white">{total}</strong>
                        </span>
                        <span className="text-emerald-400 font-semibold">{novos} novos</span>
                        <span className="text-amber-400 font-semibold">{usados} usados</span>
                        {instalados > 0 && (
                          <span className="text-cyan-400 font-semibold">{instalados} inst.</span>
                        )}
                        {indisp > 0 && (
                          <span className="text-rose-400 font-semibold">{indisp} indisp.</span>
                        )}
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          </div>

          {/* Piloto 2 */}
          <div className="space-y-2 p-3 rounded-xl bg-[#0E1521] border border-[#1A2436]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                {getCountryFlag(driver2?.nationality)} {driver2?.name || 'Piloto 2'} (Carro 2)
              </span>
              <span className="text-[10px] text-[#00A6FB]">{car2Tires.length} jogos totais</span>
            </div>
            <div className="space-y-1.5 pt-1">
              {(['macio', 'medio', 'duro', 'intermediario', 'chuva_extrema'] as TireCompound[]).map(
                (comp) => {
                  const setsOfComp = car2Tires.filter((t) => t.compound === comp)
                  const total = setsOfComp.length
                  const novos = setsOfComp.filter(
                    (s) => (s.wear || 0) === 0 && (s.lapsUsed || 0) === 0 && !s.isFitted,
                  ).length
                  const usados = setsOfComp.filter(
                    (s) =>
                      ((s.wear || 0) > 0 || (s.lapsUsed || 0) > 0) &&
                      !s.isFitted &&
                      (s.wear || 0) < 90,
                  ).length
                  const instalados = setsOfComp.filter((s) => s.isFitted).length
                  const indisp = setsOfComp.filter((s) => (s.wear || 0) >= 90).length

                  return (
                    <div
                      key={comp}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-[#090D15] border border-[#1E293B] text-[11px]"
                    >
                      <span className="text-white font-bold uppercase w-28">
                        {comp === 'chuva_extrema' ? 'CHUVA' : comp.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-[#8B95A7]">
                          Total: <strong className="text-white">{total}</strong>
                        </span>
                        <span className="text-emerald-400 font-semibold">{novos} novos</span>
                        <span className="text-amber-400 font-semibold">{usados} usados</span>
                        {instalados > 0 && (
                          <span className="text-cyan-400 font-semibold">{instalados} inst.</span>
                        )}
                        {indisp > 0 && (
                          <span className="text-rose-400 font-semibold">{indisp} indisp.</span>
                        )}
                      </div>
                    </div>
                  )
                },
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 5. BARRA INFERIOR DE CONFIRMAÇÃO: BOTÃO "INICIAR TL1" */}
      <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-[#090D15]/95 border border-[#232F42] backdrop-blur-md shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-0.5 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white uppercase tracking-wider">
              Status da Preparação:
            </span>
            <Badge
              className={`font-mono text-[10px] font-bold ${
                overallValidation.canStart
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}
            >
              {overallValidation.canStart
                ? '✓ AMBOS OS MONOPOSTOS HOMOLOGADOS'
                : '⚠ PENDÊNCIAS A CORRIGIR'}
            </Badge>
          </div>
          <p className="text-[#8B95A7] text-[11px]">
            {overallValidation.canStart
              ? 'Configuração validada contra os regulamentos da FIA. Pronto para autorizar a abertura do pit lane.'
              : 'Verifique piloto, programa de treino, reserva de pneus e carga de combustível nos dois carros.'}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Botão Simular TL1 desabilitado/oculto conforme especificação */}
          <Button
            type="button"
            variant="outline"
            disabled
            title="Simulação simplificada não disponível — sessão em pista é a Etapa 4B"
            className="hidden sm:inline-flex border-[#1A2333] text-[#525E75] font-mono text-xs cursor-not-allowed opacity-50"
          >
            Simular TL1
          </Button>

          <Button
            type="button"
            disabled={!overallValidation.canStart || isSaving}
            onClick={handleStartSession}
            className={`font-mono font-black text-sm px-6 h-11 w-full sm:w-auto shadow-xl flex items-center justify-center gap-2 ${
              overallValidation.canStart
                ? 'bg-[#00A6FB] hover:bg-[#0092DC] text-[#090D15] shadow-cyan-950/50'
                : 'bg-[#162133] text-[#525E75] cursor-not-allowed border border-[#232F42]'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            {isSaving ? 'PERSISTINDO SETUP...' : `INICIAR ${sessionType.toUpperCase()}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
