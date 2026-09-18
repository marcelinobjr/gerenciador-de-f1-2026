import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Cpu, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import puAttachedUnitImg from '@/assets/file0000000033a8820ebdd18c0df97ed4fb-f0e78.png'

export interface AllocationUnitInfo {
  unitNumber: number
  status: 'in_use' | 'reserve' | 'available' | 'penalty'
  assignedCar: 1 | 2 | null
  km: number
  wear: number
  integrity: number
  risk: 'Baixo' | 'Médio' | 'Alto'
}

interface PowerUnitAllocationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  units: AllocationUnitInfo[]
  car1Unit: number
  car2Unit: number
  driver1Name?: string
  driver2Name?: string
  onConfirmAllocation: (newCar1Unit: number, newCar2Unit: number) => void
}

export function PowerUnitAllocationModal({
  open,
  onOpenChange,
  units,
  car1Unit,
  car2Unit,
  driver1Name = 'Piloto #1',
  driver2Name = 'Piloto #2',
  onConfirmAllocation,
}: PowerUnitAllocationModalProps) {
  const [selectedC1, setSelectedC1] = useState<number>(car1Unit)
  const [selectedC2, setSelectedC2] = useState<number>(car2Unit)

  const isConflict = selectedC1 === selectedC2

  const handleSave = () => {
    if (isConflict) return
    onConfirmAllocation(selectedC1, selectedC2)
    onOpenChange(false)
  }

  const getRiskColor = (risk: string) => {
    if (risk === 'Baixo') return 'text-emerald-400'
    if (risk === 'Médio') return 'text-amber-400'
    return 'text-red-400'
  }

  const getRiskBadge = (risk: string) => {
    if (risk === 'Baixo') return 'bg-emerald-100 text-emerald-800'
    if (risk === 'Médio') return 'bg-amber-100 text-amber-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-[#E2E8F0] text-[#0F172A] max-w-xl shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-[#E10600] font-sans text-xs uppercase tracking-wider font-bold">
            <Cpu className="w-4 h-4" />
            <span>Engenharia de Pista // Alocação do Pool</span>
          </div>
          <DialogTitle className="text-lg font-bold font-sans tracking-tight text-[#0F172A]">
            Gerenciar Alocação de Unidades de Potência
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            Defina qual unidade física do pool de motores será montada no Carro #1 e Carro #2 para a
            próxima sessão de pista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Seletor Carro #1 */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0F172A] text-xs uppercase flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E10600]" />
                Carro #1 — {driver1Name}
              </span>
              <Badge className="bg-white text-cyan-800 border border-[#CBD5E1] text-[10px] font-mono font-bold">
                Atualmente: PU{car1Unit}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {units.map((u) => {
                const isSelected = selectedC1 === u.unitNumber
                const isUsedByOther = selectedC2 === u.unitNumber
                return (
                  <button
                    key={`c1-${u.unitNumber}`}
                    type="button"
                    onClick={() => setSelectedC1(u.unitNumber)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-red-50 border-[#E10600] shadow-xs ring-1 ring-[#E10600]'
                        : isUsedByOther
                          ? 'bg-neutral-100 border-[#CBD5E1] opacity-60 hover:opacity-100'
                          : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-black text-xs text-[#0F172A]">
                        PU{u.unitNumber}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#E10600]" />
                      ) : (
                        <span className="text-[9px] text-[#64748B] font-mono">#{u.unitNumber}</span>
                      )}
                    </div>

                    <div className="h-10 w-full rounded-md overflow-hidden bg-neutral-900 mb-1.5 relative">
                      <img
                        src={puAttachedUnitImg}
                        alt={`PU${u.unitNumber}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="text-[10px] font-mono space-y-0.5">
                      <div className="text-[#64748B]">{u.km} km</div>
                      <div className="font-bold text-[#0F172A]">{u.integrity}% integ.</div>
                      <span
                        className={`inline-block text-[8px] font-bold px-1 rounded ${getRiskBadge(u.risk)}`}
                      >
                        {u.risk}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Seletor Carro #2 */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0F172A] text-xs uppercase flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
                Carro #2 — {driver2Name}
              </span>
              <Badge className="bg-white text-cyan-800 border border-[#CBD5E1] text-[10px] font-mono font-bold">
                Atualmente: PU{car2Unit}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {units.map((u) => {
                const isSelected = selectedC2 === u.unitNumber
                const isUsedByOther = selectedC1 === u.unitNumber
                return (
                  <button
                    key={`c2-${u.unitNumber}`}
                    type="button"
                    onClick={() => setSelectedC2(u.unitNumber)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-50 border-cyan-600 shadow-xs ring-1 ring-cyan-600'
                        : isUsedByOther
                          ? 'bg-neutral-100 border-[#CBD5E1] opacity-60 hover:opacity-100'
                          : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-black text-xs text-[#0F172A]">
                        PU{u.unitNumber}
                      </span>
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" />
                      ) : (
                        <span className="text-[9px] text-[#64748B] font-mono">#{u.unitNumber}</span>
                      )}
                    </div>

                    <div className="h-10 w-full rounded-md overflow-hidden bg-neutral-900 mb-1.5 relative">
                      <img
                        src={puAttachedUnitImg}
                        alt={`PU${u.unitNumber}`}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="text-[10px] font-mono space-y-0.5">
                      <div className="text-[#64748B]">{u.km} km</div>
                      <div className="font-bold text-[#0F172A]">{u.integrity}% integ.</div>
                      <span
                        className={`inline-block text-[8px] font-bold px-1 rounded ${getRiskBadge(u.risk)}`}
                      >
                        {u.risk}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Validação de Conflito */}
          {isConflict && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-tight">
                <strong className="font-bold uppercase text-red-800 block">
                  Conflito Físico de Montagem:
                </strong>
                A mesma unidade física <strong>(PU{selectedC1})</strong> não pode ser montada
                simultaneamente no Carro #1 e Carro #2. Selecione unidades distintas para cada
                cockpit.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-[#F1F5F9]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-white border-[#CBD5E1] text-[#475569] hover:text-[#0F172A] font-sans text-xs cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isConflict}
            className={`font-sans text-xs font-bold uppercase tracking-wider cursor-pointer ${
              isConflict
                ? 'bg-neutral-200 text-[#64748B] cursor-not-allowed'
                : 'bg-[#E10600] hover:bg-[#C00400] text-white shadow-xs'
            }`}
          >
            Confirmar e Homologar Montagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
