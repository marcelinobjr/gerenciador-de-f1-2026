import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertCircle, Check, ShieldAlert, Cpu } from 'lucide-react'

export interface EngineSwapOption {
  id: string
  unitNumber: number
  label: string
  condition: number
  wear: number
  usageCycles: number
  kmUsed: number
  reliability: number
  isCurrentCar1: boolean
  isCurrentCar2: boolean
  isExceededLimit: boolean
  isRetired: boolean
}

export interface EngineSwapModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetCar: 1 | 2
  driverName?: string
  currentCar1EngineUnit: number
  currentCar2EngineUnit: number
  totalUnitsLimit?: number
  onConfirmSwap: (targetCar: 1 | 2, unitNumber: number) => void
}

export const EngineSwapModal: React.FC<EngineSwapModalProps> = ({
  open,
  onOpenChange,
  targetCar,
  driverName,
  currentCar1EngineUnit,
  currentCar2EngineUnit,
  totalUnitsLimit = 4,
  onConfirmSwap,
}) => {
  const currentAssignedUnit = targetCar === 1 ? currentCar1EngineUnit : currentCar2EngineUnit
  const otherCarUnit = targetCar === 1 ? currentCar2EngineUnit : currentCar1EngineUnit
  const [selectedUnit, setSelectedUnit] = useState<number>(currentAssignedUnit)

  // Geramos o conjunto de 6 unidades disponíveis no inventário da temporada
  const engineUnits: EngineSwapOption[] = Array.from({ length: 6 }).map((_, idx) => {
    const unitNumber = idx + 1
    const isCurrentCar1 = currentCar1EngineUnit === unitNumber
    const isCurrentCar2 = currentCar2EngineUnit === unitNumber
    const isExceededLimit = unitNumber > totalUnitsLimit

    // Simulação coerente com a física de vida útil das PUs
    let wear = 0
    let km = 0
    let cycles = 0
    if (unitNumber === 1) {
      wear = 34
      km = 2120
      cycles = 5
    } else if (unitNumber === 2) {
      wear = 21
      km = 1482
      cycles = 4
    } else if (unitNumber === 3) {
      wear = 12
      km = 810
      cycles = 2
    } else if (unitNumber === 4) {
      wear = 0
      km = 0
      cycles = 0
    } else {
      wear = 0
      km = 0
      cycles = 0
    }

    const condition = Math.max(10, 100 - wear)
    const reliability = Math.max(65, Math.round(96 - wear * 0.45))

    return {
      id: `PU-${unitNumber}`,
      unitNumber,
      label: `PU-${unitNumber} (Unidade #${unitNumber})`,
      condition,
      wear,
      usageCycles: cycles,
      kmUsed: km,
      reliability,
      isCurrentCar1,
      isCurrentCar2,
      isExceededLimit,
      isRetired: wear >= 80,
    }
  })

  const currentUnitObj = engineUnits.find((u) => u.unitNumber === currentAssignedUnit)
  const isOccupiedByOtherCar = selectedUnit === otherCarUnit

  const handleSelect = (uNum: number) => {
    // Não permitir selecionar a unidade que já está no outro carro
    if (uNum === otherCarUnit) return
    setSelectedUnit(uNum)
  }

  const handleApply = () => {
    if (isOccupiedByOtherCar) return
    onConfirmSwap(targetCar, selectedUnit)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white border border-slate-200 p-0 overflow-hidden shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-100 text-red-700">
              <Cpu className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Trocar motor — Carro #{targetCar} {driverName ? `/ ${driverName}` : ''}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Regulamento FIA 2026: cada unidade é física e exclusiva de um carro. Troca
                individual.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Unidade atualmente instalada */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <span className="font-bold text-slate-600">
                Unidade Atual Instalada no Carro #{targetCar}:
              </span>
              <Badge className="bg-slate-800 text-white font-mono text-[10px]">
                PU-{currentAssignedUnit}
              </Badge>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-2 text-center font-mono">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Condição</span>
                <span className="font-bold text-slate-800">{currentUnitObj?.condition ?? 80}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Desgaste</span>
                <span className="font-bold text-amber-600">{currentUnitObj?.wear ?? 20}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Uso / Ciclos</span>
                <span className="font-bold text-slate-800">
                  {currentUnitObj?.usageCycles ?? 3} GPs
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">Confiabilidade</span>
                <span className="font-bold text-slate-800">
                  {currentUnitObj?.reliability ?? 90}%
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Unidades Disponíveis */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Inventário de Unidades de Potência (Temporada 2026):</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Limite sem punição: {totalUnitsLimit} unidades
              </span>
            </div>

            <div className="space-y-2">
              {engineUnits.map((pu) => {
                const isSelected = selectedUnit === pu.unitNumber
                const isInstalledThisCar = pu.unitNumber === currentAssignedUnit
                const isInstalledOtherCar = pu.unitNumber === otherCarUnit

                let statusBadge = (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    Disponível
                  </Badge>
                )

                if (isInstalledThisCar) {
                  statusBadge = (
                    <Badge className="text-[10px] bg-red-600 text-white">
                      Instalado Carro #{targetCar}
                    </Badge>
                  )
                } else if (isInstalledOtherCar) {
                  statusBadge = (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-700 border-amber-300"
                    >
                      Instalado no Carro #{targetCar === 1 ? 2 : 1}
                    </Badge>
                  )
                } else if (pu.isRetired) {
                  statusBadge = (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-slate-100 text-slate-400 border-slate-200"
                    >
                      Inutilizável
                    </Badge>
                  )
                }

                return (
                  <div
                    key={pu.id}
                    onClick={() => handleSelect(pu.unitNumber)}
                    className={`p-3 rounded-xl border transition-all text-xs flex flex-col gap-2 ${
                      isInstalledOtherCar
                        ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                        : isSelected
                          ? 'border-red-500 bg-red-50/30 shadow-xs cursor-pointer'
                          : 'border-slate-200 hover:border-slate-300 bg-white cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="engine-select"
                          checked={isSelected}
                          disabled={isInstalledOtherCar}
                          onChange={() => handleSelect(pu.unitNumber)}
                          className="text-red-600 focus:ring-red-500"
                        />
                        <span className="font-bold text-slate-900 font-mono">{pu.label}</span>
                        {pu.isExceededLimit && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 flex items-center gap-0.5">
                            <ShieldAlert className="w-3 h-3" />
                            Penalidade (+10 posições)
                          </span>
                        )}
                      </div>
                      {statusBadge}
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-center font-mono text-[11px]">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">Condição</span>
                        <span className="font-bold text-slate-700">{pu.condition}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">Desgaste</span>
                        <span className="font-bold text-amber-600">{pu.wear}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">
                          Quilometragem
                        </span>
                        <span className="font-semibold text-slate-700">{pu.kmUsed} km</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">
                          Confiabilidade
                        </span>
                        <span className="font-bold text-emerald-700">{pu.reliability}%</span>
                      </div>
                    </div>

                    {isInstalledOtherCar && (
                      <div className="text-[10px] text-amber-700 flex items-center gap-1 font-sans">
                        <AlertCircle className="w-3 h-3" />
                        <span>
                          Esta unidade física já está montada no outro carro e não pode ser
                          compartilhada.
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleApply}
            disabled={isOccupiedByOtherCar}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4"
          >
            Confirmar Troca no Carro #{targetCar}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
