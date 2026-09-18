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
import { Wrench, AlertCircle, CheckCircle2 } from 'lucide-react'
import { CAR_PARTS_CATALOG } from './CarPartsCatalog'
import { getCarPartPhoto } from '@/data/assets/carPartAssets'

export interface ComponentInstanceOption {
  serialId: string // ex: FW-E-01, RW-B-02
  specCode: string // ex: Spec B, Spec A
  condition: number
  wear: number
  performanceBonus: string
  installedCar?: 1 | 2 | null
  status: 'available' | 'installed' | 'retired'
}

export interface PartSwapModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetCar: 1 | 2
  driverName?: string
  partType: string // frontWing, rearWing, floor, sidepods, suspension
  currentPartSpec: string
  currentPartCondition: number
  otherCarPartInstanceSerial?: string
  onConfirmSwapPart: (
    targetCar: 1 | 2,
    partType: string,
    specCode: string,
    condition: number,
    serialId: string,
  ) => void
}

export const PartSwapModal: React.FC<PartSwapModalProps> = ({
  open,
  onOpenChange,
  targetCar,
  driverName,
  partType,
  currentPartSpec,
  currentPartCondition,
  otherCarPartInstanceSerial,
  onConfirmSwapPart,
}) => {
  const partCatalogItem = CAR_PARTS_CATALOG.find((p) => p.id === partType) || CAR_PARTS_CATALOG[0]
  const partName = partCatalogItem?.name || 'Componente'
  const realPhoto = getCarPartPhoto(partType)

  // Geramos instâncias físicas disponíveis no estoque da fábrica
  // Código prefixo: FW para frontWing, RW para rearWing, FL para floor, SP para sidepods, SU para suspension
  const prefixMap: Record<string, string> = {
    frontWing: 'FW',
    rearWing: 'RW',
    floor: 'FL',
    sidepods: 'SP',
    suspension: 'SU',
    engine: 'PU',
  }
  const prefix = prefixMap[partType] || 'PT'

  // Três instâncias físicas no estoque da fábrica
  const instances: ComponentInstanceOption[] = [
    {
      serialId: `${prefix}-E-01`,
      specCode: 'Spec E - Alta Carga Otimizada',
      condition: 100,
      wear: 0,
      performanceBonus: '+0.15s/volta',
      installedCar:
        otherCarPartInstanceSerial === `${prefix}-E-01` ? (targetCar === 1 ? 2 : 1) : null,
      status: otherCarPartInstanceSerial === `${prefix}-E-01` ? 'installed' : 'available',
    },
    {
      serialId: `${prefix}-E-02`,
      specCode: 'Spec E - Alta Carga Otimizada',
      condition: 96,
      wear: 4,
      performanceBonus: '+0.14s/volta',
      installedCar:
        otherCarPartInstanceSerial === `${prefix}-E-02` ? (targetCar === 1 ? 2 : 1) : null,
      status: otherCarPartInstanceSerial === `${prefix}-E-02` ? 'installed' : 'available',
    },
    {
      serialId: `${prefix}-D-01`,
      specCode: 'Spec D - Baixo Arrasto',
      condition: 88,
      wear: 12,
      performanceBonus: '+0.08s/volta',
      installedCar:
        otherCarPartInstanceSerial === `${prefix}-D-01` ? (targetCar === 1 ? 2 : 1) : null,
      status: otherCarPartInstanceSerial === `${prefix}-D-01` ? 'installed' : 'available',
    },
    {
      serialId: `${prefix}-C-03`,
      specCode: 'Spec C - Base de Homologação',
      condition: 75,
      wear: 25,
      performanceBonus: 'Neutro (Linha Base)',
      installedCar:
        otherCarPartInstanceSerial === `${prefix}-C-03` ? (targetCar === 1 ? 2 : 1) : null,
      status: otherCarPartInstanceSerial === `${prefix}-C-03` ? 'installed' : 'available',
    },
  ]

  const [selectedSerial, setSelectedSerial] = useState<string>(
    instances.find((i) => i.status === 'available')?.serialId || instances[0].serialId,
  )

  const selectedInst = instances.find((i) => i.serialId === selectedSerial)
  const isOccupiedByOtherCar = selectedInst?.installedCar && selectedInst.installedCar !== targetCar

  const handleApply = () => {
    if (!selectedInst || isOccupiedByOtherCar) return
    onConfirmSwapPart(
      targetCar,
      partType,
      selectedInst.specCode,
      selectedInst.condition,
      selectedInst.serialId,
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white border border-slate-200 p-0 overflow-hidden shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-100 text-red-700">
              <Wrench className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Trocar Peça: {partName} — Carro #{targetCar} {driverName ? `/ ${driverName}` : ''}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Troca exclusiva no Carro #{targetCar}. O outro carro mantém sua própria peça física
                instalada.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Peça atualmente instalada com foto real se existir */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Instalada atualmente no Carro #{targetCar}
              </div>
              <div className="font-bold text-slate-900 text-sm">{currentPartSpec}</div>
              <div className="text-[11px] text-slate-600 font-mono">
                Integridade mecânica:{' '}
                <span className="font-bold text-slate-900">{currentPartCondition}%</span> (Desgaste:{' '}
                {100 - currentPartCondition}%)
              </div>
            </div>

            {realPhoto && (
              <div className="h-16 w-24 bg-white rounded-lg p-1 border border-slate-200 flex items-center justify-center shrink-0">
                <img src={realPhoto} alt={partName} className="max-h-14 w-auto object-contain" />
              </div>
            )}
          </div>

          {/* Lista de instâncias físicas disponíveis no estoque */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Instâncias Físicas Disponíveis no Inventário:</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Custo operacional de montagem: Grátis (Save)
              </span>
            </div>

            <div className="space-y-2">
              {instances.map((inst) => {
                const isSelected = selectedSerial === inst.serialId
                const isInstalledOther = inst.installedCar && inst.installedCar !== targetCar

                return (
                  <div
                    key={inst.serialId}
                    onClick={() => {
                      if (!isInstalledOther) setSelectedSerial(inst.serialId)
                    }}
                    className={`p-3 rounded-xl border transition-all text-xs flex flex-col gap-2 ${
                      isInstalledOther
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
                          name="part-instance-select"
                          checked={isSelected}
                          disabled={Boolean(isInstalledOther)}
                          onChange={() => setSelectedSerial(inst.serialId)}
                          className="text-red-600 focus:ring-red-500"
                        />
                        <span className="font-bold text-slate-900 font-mono">{inst.serialId}</span>
                        <span className="text-slate-600 font-medium">{inst.specCode}</span>
                      </div>

                      {isInstalledOther ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-700 border-amber-300"
                        >
                          Instalado no Carro #{inst.installedCar}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          Disponível
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center font-mono text-[11px]">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">Condição</span>
                        <span className="font-bold text-slate-800">{inst.condition}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">Desgaste</span>
                        <span className="font-bold text-amber-600">{inst.wear}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">
                          Ganho Projetado
                        </span>
                        <span className="font-bold text-emerald-600">{inst.performanceBonus}</span>
                      </div>
                    </div>

                    {isInstalledOther && (
                      <div className="text-[10px] text-amber-700 flex items-center gap-1 font-sans">
                        <AlertCircle className="w-3 h-3" />
                        <span>
                          Peça física já montada no outro carro. Instância não compartilhável.
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
            disabled={Boolean(isOccupiedByOtherCar)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirmar Instalação no Carro #{targetCar}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
