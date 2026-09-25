import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import {
  Fuel,
  Disc,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { TireSetItem, TireCompound } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type {
  RacePreparationSnapshot,
  PreparedCarState,
  RaceStrategyPlan,
} from '@/types/canonical-race-preparation'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import { formatTireName } from '@/lib/f1-tire-system'
import {
  estimateCompoundLifespanLaps,
  calculateRecommendedPitWindow,
  formatCompoundLifespanBadge,
} from '@/lib/canonical-tire-strategy'
import { TireDegradationIndicator } from '@/components/race/TireDegradationIndicator'
import { getTyreImage, getTyreMeta } from '@/lib/tyre-assets'

export interface PreRaceStrategyPreparationPanelProps {
  careerId: string
  seasonYear: number
  round: number
  teamId: string
  teamColor?: string
  totalLaps: number
  canonicalGrid: FinalQualifyingGridEntry[]
  inventories: Record<string, TireSetItem[]>
  onConfirmAndStartRace: (snapshot: RacePreparationSnapshot) => void
  onCancelToGrid?: () => void
}

const COMPOUND_ORDER: TireCompound[] = ['macio', 'medio', 'duro', 'intermediario', 'chuva_extrema']

export const PreRaceStrategyPreparationPanel: React.FC<PreRaceStrategyPreparationPanelProps> = ({
  careerId,
  seasonYear,
  round,
  teamId,
  teamColor = '#E10600',
  totalLaps,
  canonicalGrid,
  inventories,
  onConfirmAndStartRace,
  onCancelToGrid,
}) => {
  // Inicializar estado a partir do snapshot salvo em localStorage ("race-prep-v1") ou criar novo
  const [snapshot, setSnapshot] = useState<RacePreparationSnapshot>(() => {
    const existing = canonicalRacePreparationService.loadSnapshot(careerId, seasonYear, round)
    if (existing && existing.cars && existing.cars.length === 2) {
      return existing
    }
    const fresh = canonicalRacePreparationService.createInitialSnapshot({
      careerId,
      seasonYear,
      round,
      teamId,
      totalLaps,
      grid: canonicalGrid,
      inventories,
    })
    canonicalRacePreparationService.saveSnapshot(fresh)
    return fresh
  })

  // Controles de visibilidade dos seletores de jogos por carro
  const [showTyresCar1, setShowTyresCar1] = useState(false)
  const [showTyresCar2, setShowTyresCar2] = useState(false)

  const car1 = snapshot.cars[0]
  const car2 = snapshot.cars[1]

  const invCar1 = inventories[car1.driverId] || []
  const invCar2 = inventories[car2.driverId] || []

  // Validação em tempo real de cada carro
  const val1 = canonicalRacePreparationService.validateCarPreparation(car1, totalLaps, invCar1)
  const val2 = canonicalRacePreparationService.validateCarPreparation(car2, totalLaps, invCar2)

  const canStartRace = val1.valid && val2.valid && car1.confirmed && car2.confirmed

  // Handlers Carro 1
  const updateCar1 = (patch: Partial<PreparedCarState>) => {
    setSnapshot((prev) => {
      const nextCar1: PreparedCarState = { ...prev.cars[0], ...patch, confirmed: false }
      const nextSnapshot: RacePreparationSnapshot = {
        ...prev,
        cars: [nextCar1, prev.cars[1]],
        allConfirmed: false,
      }
      canonicalRacePreparationService.saveSnapshot(nextSnapshot)
      return nextSnapshot
    })
  }

  // Handlers Carro 2
  const updateCar2 = (patch: Partial<PreparedCarState>) => {
    setSnapshot((prev) => {
      const nextCar2: PreparedCarState = { ...prev.cars[1], ...patch, confirmed: false }
      const nextSnapshot: RacePreparationSnapshot = {
        ...prev,
        cars: [prev.cars[0], nextCar2],
        allConfirmed: false,
      }
      canonicalRacePreparationService.saveSnapshot(nextSnapshot)
      return nextSnapshot
    })
  }

  const toggleConfirmCar1 = () => {
    if (!val1.valid) return
    setSnapshot((prev) => {
      const nextCar1: PreparedCarState = { ...prev.cars[0], confirmed: !prev.cars[0].confirmed }
      const nextSnapshot: RacePreparationSnapshot = {
        ...prev,
        cars: [nextCar1, prev.cars[1]],
        allConfirmed: nextCar1.confirmed && prev.cars[1].confirmed,
      }
      canonicalRacePreparationService.saveSnapshot(nextSnapshot)
      return nextSnapshot
    })
  }

  const toggleConfirmCar2 = () => {
    if (!val2.valid) return
    setSnapshot((prev) => {
      const nextCar2: PreparedCarState = { ...prev.cars[1], confirmed: !prev.cars[1].confirmed }
      const nextSnapshot: RacePreparationSnapshot = {
        ...prev,
        cars: [prev.cars[0], nextCar2],
        allConfirmed: prev.cars[0].confirmed && nextCar2.confirmed,
      }
      canonicalRacePreparationService.saveSnapshot(nextSnapshot)
      return nextSnapshot
    })
  }

  const handleSelectTyre = (carSlot: 'car1' | 'car2', tyre: TireSetItem) => {
    const updateFn = carSlot === 'car1' ? updateCar1 : updateCar2
    const currentCar = carSlot === 'car1' ? car1 : car2
    const currentStrat = currentCar.strategyPlan

    // Atualiza o primeiro stint da estratégia com o novo composto
    const updatedStints = currentStrat.stints.map((stint, idx) =>
      idx === 0 ? { ...stint, compound: tyre.compound, tyreSetId: tyre.id } : stint,
    )

    updateFn({
      startingTyreSetId: tyre.id,
      startingCompound: tyre.compound,
      initialTyreWear: tyre.wear || 0,
      initialTyreLapsUsed: tyre.lapsUsed || 0,
      strategyPlan: {
        ...currentStrat,
        stints: updatedStints,
      },
    })

    if (carSlot === 'car1') setShowTyresCar1(false)
    else setShowTyresCar2(false)
  }

  const handleApplyPresetStrategy = (carSlot: 'car1' | 'car2', type: '1stop' | '2stops') => {
    const car = carSlot === 'car1' ? car1 : car2
    const updateFn = carSlot === 'car1' ? updateCar1 : updateCar2
    const plan =
      type === '1stop'
        ? canonicalRacePreparationService.createDefaultStrategyPlan(
            carSlot,
            car.startingCompound,
            totalLaps,
          )
        : canonicalRacePreparationService.createTwoStopStrategyPlan(
            carSlot,
            car.startingCompound,
            totalLaps,
          )
    updateFn({ strategyPlan: plan })
  }

  const handleUpdatePitLap = (carSlot: 'car1' | 'car2', stintIndex: number, newPitLap: number) => {
    const car = carSlot === 'car1' ? car1 : car2
    const updateFn = carSlot === 'car1' ? updateCar1 : updateCar2
    const clamped = Math.max(1, Math.min(totalLaps, Math.round(newPitLap)))
    const nextStints = car.strategyPlan.stints.map((s, idx) =>
      idx === stintIndex ? { ...s, targetPitLap: clamped, targetEndLap: clamped } : s,
    )
    updateFn({ strategyPlan: { ...car.strategyPlan, stints: nextStints } })
  }

  const handleUpdateStintCompound = (
    carSlot: 'car1' | 'car2',
    stintIndex: number,
    compound: TireCompound,
  ) => {
    const car = carSlot === 'car1' ? car1 : car2
    const updateFn = carSlot === 'car1' ? updateCar1 : updateCar2
    const nextStints = car.strategyPlan.stints.map((s, idx) =>
      idx === stintIndex ? { ...s, compound } : s,
    )
    updateFn({ strategyPlan: { ...car.strategyPlan, stints: nextStints } })
  }

  const renderCarCard = (
    carSlot: 'car1' | 'car2',
    car: PreparedCarState,
    inv: TireSetItem[],
    val: { valid: boolean; errors: string[] },
    showTyres: boolean,
    setShowTyres: (v: boolean) => void,
    onToggleConfirm: () => void,
  ) => {
    const isCar1 = carSlot === 'car1'
    const updateFn = isCar1 ? updateCar1 : updateCar2
    const equippedSet = inv.find(
      (s) => s.id === car.startingTyreSetId || s.tyreSetId === car.startingTyreSetId,
    )
    const estimatedLaps = Math.max(0, Math.floor(car.startingFuelKg / 1.75))

    return (
      <Card className="p-5 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm space-y-5 font-sans">
        {/* CABEÇALHO DO CARRO */}
        <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
          <div className="flex items-center gap-3">
            <DriverPhotoAvatar
              name={car.driverName}
              driverId={car.driverId}
              teamColor={teamColor}
              size="lg"
            />
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: teamColor }}
                />
                <h3 className="text-base font-black text-[#0F172A]">{car.driverName}</h3>
                <Badge className="bg-[#0F172A] text-white text-[11px] font-black">
                  CARRO {car.carNumber}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-[#E10600]/10 text-[#E10600] border border-[#E10600]/30 font-black text-xs">
                  GRID: P{car.gridPosition}
                </Badge>
                <span className="text-[11px] text-[#64748B]">
                  #{car.driverNumber || car.carNumber}
                </span>
              </div>
            </div>
          </div>

          {/* STATUS: PRONTO / NÃO CONFIGURADO */}
          <div>
            {car.confirmed && val.valid ? (
              <Badge className="bg-emerald-600 text-white font-black text-xs px-2.5 py-1 flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-4 h-4" />
                PRONTO
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-400 bg-amber-50 text-amber-800 font-bold text-xs px-2.5 py-1 flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                NÃO CONFIGURADO
              </Badge>
            )}
          </div>
        </div>

        {/* 1. SELEÇÃO DE JOGO FÍSICO DE PNEUS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#64748B] uppercase">
            <span className="flex items-center gap-1.5">
              <Disc className="w-4 h-4 text-[#E10600]" />
              Pneu de Largada (Físico)
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowTyres(!showTyres)}
              className="h-6 text-[11px] text-[#E10600] font-bold hover:bg-red-50 p-1"
            >
              {showTyres ? '▲ Fechar Inventário' : '▼ Escolher Outro Jogo'}
            </Button>
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                  <img
                    src={getTyreImage(car.startingCompound)}
                    alt={getTyreMeta(car.startingCompound).name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#0F172A]">
                      {getTyreMeta(car.startingCompound).name} (
                      {getTyreMeta(car.startingCompound).code})
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono text-[#475569]">
                      ID: {car.startingTyreSetId}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {/* FC02C: Estimativa Canônica de Autonomia */}
                    <Badge className="bg-slate-900 text-white font-mono text-[10px] font-bold">
                      {formatCompoundLifespanBadge(car.startingCompound, {
                        initialWearPct: car.initialTyreWear,
                      })}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-mono font-black ${
                    car.initialTyreWear >= 60
                      ? 'text-rose-600'
                      : car.initialTyreWear >= 25
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                  }`}
                >
                  {car.initialTyreWear}% desgaste
                </span>
                <p className="text-[10px] text-[#64748B] font-mono">
                  {car.initialTyreLapsUsed} voltas rodadas
                </p>
              </div>
            </div>

            {/* FC02C: Indicador Visual de Degradação Canônico */}
            <TireDegradationIndicator
              wearPct={car.initialTyreWear}
              compound={car.startingCompound}
              lapsOnTire={car.initialTyreLapsUsed}
              compact
            />
          </div>

          {/* INVENTÁRIO FÍSICO EXPANSÍVEL */}
          {showTyres && (
            <div className="p-3 rounded-xl bg-[#090D15] border border-slate-800 text-white space-y-2 max-h-56 overflow-y-auto">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Jogos Disponíveis no Estoque ({inv.length})
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {inv.map((tyre) => {
                  const isSelected =
                    tyre.id === car.startingTyreSetId || tyre.tyreSetId === car.startingTyreSetId
                  return (
                    <button
                      key={tyre.id}
                      type="button"
                      onClick={() => handleSelectTyre(carSlot, tyre)}
                      className={`w-full p-2 rounded-lg text-left text-xs transition-colors flex items-center justify-between border ${
                        isSelected
                          ? 'border-[#E10600] bg-[#E10600]/20 text-white font-bold'
                          : 'border-slate-800 bg-[#0F172A] hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-slate-900 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                          <img
                            src={getTyreImage(tyre.compound)}
                            alt={formatTireName(tyre.compound)}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="capitalize font-black text-white">
                          {formatTireName(tyre.compound)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">#{tyre.id}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span
                          className={
                            tyre.wear >= 60
                              ? 'text-rose-400'
                              : tyre.wear >= 25
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }
                        >
                          {tyre.wear || 0}%
                        </span>
                        <span className="text-slate-500">({tyre.lapsUsed || 0}v)</span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 2. COMBUSTÍVEL INICIAL (1–110 kg) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#64748B] uppercase">
            <span className="flex items-center gap-1.5">
              <Fuel className="w-4 h-4 text-amber-500" />
              Combustível de Largada (1–110 kg)
            </span>
            <span className="font-mono font-black text-sm text-[#0F172A]">
              {car.startingFuelKg} kg
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center gap-3">
              <Slider
                min={1}
                max={110}
                step={1}
                value={[car.startingFuelKg]}
                onValueChange={(val) => updateFn({ startingFuelKg: val[0] })}
                className="flex-1"
              />
              <Input
                type="number"
                min={1}
                max={110}
                value={car.startingFuelKg}
                onChange={(e) => {
                  const num = Number(e.target.value)
                  updateFn({ startingFuelKg: num })
                }}
                className="w-16 h-8 text-center text-xs font-bold font-mono border-[#E2E8F0] bg-white text-[#0F172A]"
              />
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-[#475569]">
              <span>Autonomia estimada: ~{estimatedLaps} voltas</span>
              <span>Consumo base ~1.75 kg/volta</span>
            </div>
          </div>
        </div>

        {/* 3. PIT PLAN (INTENÇÃO DE ESTRATÉGIA) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#64748B] uppercase">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Plano de Pit Stop (Intenção Inicial)
            </span>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleApplyPresetStrategy(carSlot, '1stop')}
                className="h-6 text-[10px] font-bold px-2 border-[#CBD5E1]"
              >
                1 Parada
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleApplyPresetStrategy(carSlot, '2stops')}
                className="h-6 text-[10px] font-bold px-2 border-[#CBD5E1]"
              >
                2 Paradas
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
            {car.strategyPlan.stints.map((stint, idx) => {
              const isFirstStint = idx === 0
              const isLastStint = idx === car.strategyPlan.stints.length - 1

              // FC02C: Janela de pit recomendada canônica para o stint
              const recommendedWindow = calculateRecommendedPitWindow({
                currentStintCompound: stint.compound,
                totalRaceLaps: totalLaps,
                initialWearPct: isFirstStint ? car.initialTyreWear : 0,
                stintNumber: idx + 1,
                totalStintsPlanned: car.strategyPlan.stints.length,
              })

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-white border border-[#E2E8F0] flex flex-col gap-2 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#0F172A] w-14">
                        Stint {stint.stintNumber || idx + 1}:
                      </span>
                      {/* Composto */}
                      {isFirstStint ? (
                        <Badge className="bg-slate-100 text-[#0F172A] border border-slate-300 capitalize text-[11px] font-black">
                          {formatTireName(stint.compound)} (Largada)
                        </Badge>
                      ) : (
                        <select
                          value={stint.compound}
                          onChange={(e) =>
                            handleUpdateStintCompound(carSlot, idx, e.target.value as TireCompound)
                          }
                          className="h-7 text-xs font-bold bg-[#F8FAFC] border border-[#CBD5E1] rounded px-1.5 capitalize text-[#0F172A]"
                        >
                          {COMPOUND_ORDER.map((c) => (
                            <option key={c} value={c}>
                              {formatTireName(c)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      {isLastStint ? (
                        <span className="text-[#64748B] font-semibold">
                          Até a bandeirada (Volta {totalLaps})
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#64748B] font-bold">Pit na volta:</span>
                          <Input
                            type="number"
                            min={1}
                            max={totalLaps}
                            value={stint.targetPitLap}
                            onChange={(e) =>
                              handleUpdatePitLap(carSlot, idx, Number(e.target.value))
                            }
                            className="w-14 h-7 text-center font-bold font-mono text-xs border-[#CBD5E1] bg-white text-[#0F172A]"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* FC02C: Janela sugerida e autonomia por stint */}
                  {!isLastStint && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="font-mono text-cyan-700 font-bold">
                        Janela sugerida: {recommendedWindow.windowText.replace('Voltas', 'V')}{' '}
                        (Ideal: V{recommendedWindow.optimalLap})
                      </span>
                      <span className="font-mono text-slate-600">
                        Autonomia:{' '}
                        {formatCompoundLifespanBadge(stint.compound, {
                          initialWearPct: isFirstStint ? car.initialTyreWear : 0,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ERROS DE VALIDAÇÃO SE HOUVER */}
        {!val.valid && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-rose-800">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              Bloqueio de Preparação:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              {val.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* BOTÃO CONFIRMAR CARRO */}
        <Button
          type="button"
          disabled={!val.valid}
          onClick={onToggleConfirm}
          className={`w-full h-10 text-xs font-black tracking-wider uppercase transition-all ${
            car.confirmed && val.valid
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-[#0F172A] hover:bg-slate-800 text-white'
          }`}
        >
          {car.confirmed && val.valid ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Preparação Confirmada (Clique para reabrir)
            </>
          ) : (
            <>Confirmar Preparação do Carro {car.carNumber}</>
          )}
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      {/* TÍTULO E CABEÇALHO APEX */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-7 rounded-full bg-[#E10600]" />
            <h2 className="text-xl font-black text-[#0F172A] uppercase tracking-wide">
              Estratégia de Corrida — Pré-Largada
            </h2>
          </div>
          <p className="text-xs text-[#64748B] mt-1 pl-5">
            Configure pneus de largada, carga de combustível e o plano inicial de paradas para ambos
            os carros antes de liberar os pilotos para a corrida.
          </p>
        </div>

        {onCancelToGrid && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancelToGrid}
            className="text-xs font-bold border-[#CBD5E1]"
          >
            ← Voltar ao Grid
          </Button>
        )}
      </div>

      {/* DOIS CARDS LADO A LADO EM DESKTOP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderCarCard(
          'car1',
          car1,
          invCar1,
          val1,
          showTyresCar1,
          setShowTyresCar1,
          toggleConfirmCar1,
        )}
        {renderCarCard(
          'car2',
          car2,
          invCar2,
          val2,
          showTyresCar2,
          setShowTyresCar2,
          toggleConfirmCar2,
        )}
      </div>

      {/* BARRA INFERIOR DE CONFIRMAÇÃO GLOBAL E DISPARO DA CORRIDA */}
      <Card className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h4 className="text-sm font-black text-[#0F172A]">
              Confirmação Obrigatória dos 2 Carros
            </h4>
          </div>
          <p className="text-xs text-[#64748B]">
            Status:{' '}
            <strong className={car1.confirmed ? 'text-emerald-600' : 'text-amber-600'}>
              Carro 1: {car1.confirmed ? 'CONFIRMADO' : 'PENDENTE'}
            </strong>{' '}
            •{' '}
            <strong className={car2.confirmed ? 'text-emerald-600' : 'text-amber-600'}>
              Carro 2: {car2.confirmed ? 'CONFIRMADO' : 'PENDENTE'}
            </strong>
          </p>
        </div>

        <Button
          type="button"
          disabled={!canStartRace}
          onClick={() => {
            if (!canStartRace) return
            onConfirmAndStartRace(snapshot)
          }}
          className={`h-11 px-6 font-black text-xs uppercase tracking-wider transition-all gap-2 ${
            canStartRace
              ? 'bg-[#E10600] hover:bg-[#C00400] text-white shadow-md cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          Iniciar Corrida
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </Card>
    </div>
  )
}
