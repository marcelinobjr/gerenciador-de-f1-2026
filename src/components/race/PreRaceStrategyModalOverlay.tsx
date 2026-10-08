import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Fuel, Check, Layers, AlertCircle, X, ChevronRight } from 'lucide-react'
import type { RacePreparationSnapshot, PreparedCarState } from '@/types/canonical-race-preparation'
import type { TireSetItem, TireCompound } from '@/types/f1'

export interface PreRaceStrategyModalOverlayProps {
  snapshot: RacePreparationSnapshot
  inventories: Record<string, TireSetItem[]>
  totalLaps: number
  onClose: () => void
  onUpdateSnapshot: (nextSnapshot: RacePreparationSnapshot) => void
}

function getTyreStyle(compound: TireCompound) {
  switch (compound) {
    case 'macio':
      return {
        label: 'Macio (Soft)',
        symbol: 'S',
        color: 'border-red-500 text-red-400 bg-red-950/40',
      }
    case 'duro':
      return {
        label: 'Duro (Hard)',
        symbol: 'H',
        color: 'border-slate-400 text-slate-200 bg-slate-900/60',
      }
    case 'intermediario':
      return {
        label: 'Intermediário (Inter)',
        symbol: 'I',
        color: 'border-emerald-500 text-emerald-400 bg-emerald-950/40',
      }
    case 'chuva_extrema':
      return {
        label: 'Chuva Extrema (Wet)',
        symbol: 'W',
        color: 'border-blue-500 text-blue-400 bg-blue-950/40',
      }
    case 'medio':
    default:
      return {
        label: 'Médio (Medium)',
        symbol: 'M',
        color: 'border-yellow-500 text-yellow-400 bg-yellow-950/40',
      }
  }
}

export const PreRaceStrategyModalOverlay: React.FC<PreRaceStrategyModalOverlayProps> = ({
  snapshot,
  inventories,
  totalLaps,
  onClose,
  onUpdateSnapshot,
}) => {
  const [activeCarTab, setActiveCarTab] = useState<'car1' | 'car2'>('car1')

  const carIndex = activeCarTab === 'car1' ? 0 : 1
  const currentCar = snapshot.cars[carIndex]
  const driverInventory = inventories[currentCar.driverId] || []

  // Troca de pneu de largada
  const handleSelectStartingTyre = (tyre: TireSetItem) => {
    const updatedStints = currentCar.strategyPlan.stints.map((stint, idx) =>
      idx === 0 ? { ...stint, compound: tyre.compound, tyreSetId: tyre.id } : stint,
    )

    const updatedCar: PreparedCarState = {
      ...currentCar,
      startingTyreSetId: tyre.id,
      startingCompound: tyre.compound,
      initialTyreWear: tyre.wear || 0,
      initialTyreLapsUsed: tyre.lapsUsed || 0,
      strategyPlan: {
        ...currentCar.strategyPlan,
        stints: updatedStints,
      },
    }

    const nextCars: [PreparedCarState, PreparedCarState] =
      activeCarTab === 'car1' ? [updatedCar, snapshot.cars[1]] : [snapshot.cars[0], updatedCar]

    onUpdateSnapshot({
      ...snapshot,
      cars: nextCars,
    })
  }

  // Ajuste de combustível
  const handleFuelChange = (delta: number) => {
    const newFuel = Math.min(110, Math.max(10, currentCar.startingFuelKg + delta))
    const updatedCar: PreparedCarState = {
      ...currentCar,
      startingFuelKg: newFuel,
    }
    const nextCars: [PreparedCarState, PreparedCarState] =
      activeCarTab === 'car1' ? [updatedCar, snapshot.cars[1]] : [snapshot.cars[0], updatedCar]

    onUpdateSnapshot({
      ...snapshot,
      cars: nextCars,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-mono">
      <Card className="w-full max-w-4xl bg-[#090F1C] border border-[#1E293B] shadow-2xl rounded-2xl overflow-hidden text-white my-auto max-h-[92vh] flex flex-col">
        {/* HEADER DO OVERLAY */}
        <CardHeader className="py-3 px-5 bg-[#060A14] border-b border-[#1E293B] flex flex-row items-center justify-between shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E10600]" />
              <CardTitle className="text-sm sm:text-base font-black tracking-wide uppercase text-white">
                Box de Estratégia Inicial — Pré-Corrida
              </CardTitle>
            </div>
            <p className="text-[11px] text-slate-400">
              Verifique posições de largada, jogos reais disponíveis, desgaste e abastecimento.
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        {/* CORPO DO OVERLAY */}
        <CardContent className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* ABAS DOS DOIS PILOTOS */}
          <Tabs
            value={activeCarTab}
            onValueChange={(val) => setActiveCarTab(val as 'car1' | 'car2')}
            className="w-full"
          >
            <TabsList className="w-full grid grid-cols-2 bg-[#060A14] border border-[#1E293B] p-1 h-auto rounded-xl">
              <TabsTrigger
                value="car1"
                className="py-2 text-xs font-bold data-[state=active]:bg-[#1E293B] data-[state=active]:text-white"
              >
                Carro 1 — {snapshot.cars[0].driverName} (P{snapshot.cars[0].gridPosition})
              </TabsTrigger>
              <TabsTrigger
                value="car2"
                className="py-2 text-xs font-bold data-[state=active]:bg-[#1E293B] data-[state=active]:text-white"
              >
                Carro 2 — {snapshot.cars[1].driverName} (P{snapshot.cars[1].gridPosition})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeCarTab} className="mt-4 space-y-4">
              {/* DADOS RESUMIDOS DO PILOTO */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg bg-[#060A14] border border-[#1E293B]">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">
                    Posição no Grid
                  </span>
                  <span className="text-base font-black text-amber-400 mt-0.5 block">
                    P{currentCar.gridPosition}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#060A14] border border-[#1E293B]">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">
                    Pneu de Largada
                  </span>
                  <span className="text-sm font-black text-white mt-0.5 block">
                    {getTyreStyle(currentCar.startingCompound).label}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#060A14] border border-[#1E293B]">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">
                    Desgaste do Jogo
                  </span>
                  <span className="text-sm font-black text-slate-200 mt-0.5 block">
                    {currentCar.initialTyreWear.toFixed(1)}% ({currentCar.initialTyreLapsUsed}{' '}
                    voltas)
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-[#060A14] border border-[#1E293B]">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">
                    Combustível Inicial
                  </span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-sm font-black text-cyan-300">
                      {currentCar.startingFuelKg.toFixed(1)} kg
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleFuelChange(-2)}
                        className="h-6 w-6 p-0 text-[10px] font-bold border-slate-700 bg-slate-900"
                      >
                        -
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleFuelChange(2)}
                        className="h-6 w-6 p-0 text-[10px] font-bold border-slate-700 bg-slate-900"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* JOGOS DE PNEUS DISPONÍVEIS DO INVENTÁRIO (NÃO REGENERADOS) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    Jogos de Pneus Disponíveis ({driverInventory.length} no inventário oficial)
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Clique em um jogo para selecionar para a largada
                  </span>
                </div>

                {driverInventory.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400">
                    Nenhum jogo listado no inventário deste piloto.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                    {driverInventory.map((tyre) => {
                      const style = getTyreStyle(tyre.compound)
                      const isSelected = tyre.id === currentCar.startingTyreSetId
                      const wear = tyre.wear || 0
                      const laps = tyre.lapsUsed || 0

                      return (
                        <button
                          key={tyre.id}
                          type="button"
                          onClick={() => handleSelectStartingTyre(tyre)}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500'
                              : 'bg-[#060A14] border-[#1E293B] hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-black ${style.color}`}
                            >
                              {style.symbol}
                            </span>
                            {isSelected && (
                              <Badge className="bg-cyan-600 text-white text-[8px] h-4 px-1 py-0">
                                LARGADA
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-slate-200 block truncate">
                            {style.label.split(' ')[0]}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Desgaste: {wear.toFixed(0)}% • {laps}v
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* PLANO DE STINTS DA ESTRATÉGIA */}
              <div className="p-3 rounded-xl bg-[#060A14] border border-[#1E293B] space-y-2">
                <span className="text-[11px] font-bold text-slate-300 block uppercase">
                  Plano de Paradas Planejado ({totalLaps} Voltas)
                </span>
                <div className="space-y-1.5">
                  {currentCar.strategyPlan.stints.map((stint, sIdx) => {
                    const style = getTyreStyle(stint.compound)
                    return (
                      <div
                        key={sIdx}
                        className="flex items-center justify-between p-2 rounded bg-[#090F1C] border border-[#1E293B] text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-black ${style.color}`}
                          >
                            {style.symbol}
                          </span>
                          <span className="text-slate-200 font-bold">
                            Stint {sIdx + 1}: {style.label}
                          </span>
                        </div>
                        <span className="text-slate-400">
                          {sIdx === 0
                            ? `Voltas 1 → ${stint.targetPitLap}`
                            : `Voltas ${stint.targetPitLap} → Fim`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* AVISO DO MOTOR DE CORRIDA */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3 text-xs text-slate-300">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              A preparação inicial está confirmada. O motor de simulação da corrida será conectado
              na próxima etapa (01B).
            </span>
          </div>
        </CardContent>

        {/* FOOTER */}
        <div className="p-4 bg-[#060A14] border-t border-[#1E293B] flex items-center justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-bold border-slate-700 bg-slate-900 text-slate-300"
          >
            Fechar Box de Estratégia
          </Button>

          <Button
            type="button"
            disabled
            className="text-xs font-black uppercase tracking-wider bg-[#1E293B] text-slate-500 cursor-not-allowed border border-slate-700"
            title="Motor de corrida será conectado na próxima etapa."
          >
            Confirmar e Preparar Corrida (Etapa 01B)
          </Button>
        </div>
      </Card>
    </div>
  )
}
