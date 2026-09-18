import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CAR_PARTS_CATALOG } from './CarPartsCatalog'
import { Wrench, ChevronRight } from 'lucide-react'

export interface QuickSwapCarSelectorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  driver1Name?: string
  driver2Name?: string
  onSelectTarget: (targetCar: 1 | 2, partType: string) => void
}

export const QuickSwapCarSelectorModal: React.FC<QuickSwapCarSelectorModalProps> = ({
  open,
  onOpenChange,
  driver1Name = 'Piloto 1',
  driver2Name = 'Piloto 2',
  onSelectTarget,
}) => {
  const [selectedCar, setSelectedCar] = useState<1 | 2>(1)
  const [selectedPart, setSelectedPart] = useState<string>('frontWing')

  const handleProceed = () => {
    onOpenChange(false)
    onSelectTarget(selectedCar, selectedPart)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-slate-200 p-0 overflow-hidden shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-100 text-red-700">
              <Wrench className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Ação Rápida: Troca de Peça
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Selecione qual carro e qual componente deseja substituir no inventário.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 text-xs">
          {/* Passo 1: Seleção de Carro */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">1. Selecionar Carro Alvo:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedCar(1)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedCar === 1
                    ? 'border-red-600 bg-red-50/50 text-red-950 font-semibold ring-1 ring-red-500'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="text-xs font-black text-red-600">Carro #1</div>
                <div className="text-xs truncate">{driver1Name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Titular Principal</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCar(2)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedCar === 2
                    ? 'border-red-600 bg-red-50/50 text-red-950 font-semibold ring-1 ring-red-500'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="text-xs font-black text-red-600">Carro #2</div>
                <div className="text-xs truncate">{driver2Name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Segundo Piloto</div>
              </button>
            </div>
          </div>

          {/* Passo 2: Seleção de Componente */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="font-bold text-slate-700 block">2. Selecionar Componente:</label>
            <div className="grid grid-cols-2 gap-1.5">
              {CAR_PARTS_CATALOG.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => setSelectedPart(part.id)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                    selectedPart === part.id
                      ? 'bg-slate-900 text-white border-slate-900 font-bold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="truncate">{part.name}</div>
                  <div
                    className={`text-[10px] ${selectedPart === part.id ? 'text-slate-300' : 'text-slate-400'}`}
                  >
                    {part.defaultSpec}
                  </div>
                </button>
              ))}
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
            onClick={handleProceed}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 flex items-center gap-1.5"
          >
            <span>Configurar Peça</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
