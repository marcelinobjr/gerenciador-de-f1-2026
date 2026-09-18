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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0B0F17] border-[#1C2638] text-[#F1F5F9] max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold">
            <Cpu className="w-4 h-4" />
            <span>Engenharia de Pista // Alocação do Pool</span>
          </div>
          <DialogTitle className="text-lg font-black font-mono tracking-tight text-white">
            Gerenciar Alocação de Unidades de Potência
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8B98AD]">
            Defina qual unidade física do pool de motores será montada no Carro #1 e Carro #2 para a
            próxima sessão de pista.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Seletor Carro #1 */}
          <div className="p-3.5 rounded-lg bg-[#0F1622] border border-[#1C2738] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-white text-xs uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#E10600]" />
                Carro #1 — {driver1Name}
              </span>
              <Badge className="bg-[#141C29] text-cyan-400 border border-cyan-500/30 text-[10px] font-mono">
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
                    className={`p-2.5 rounded-md border text-left transition-all ${
                      isSelected
                        ? 'bg-[#E10600]/20 border-[#E10600] text-white shadow-sm ring-1 ring-[#E10600]'
                        : isUsedByOther
                          ? 'bg-[#10141D] border-[#1C2330] text-[#64748B] hover:border-amber-500/40'
                          : 'bg-[#121926] border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-black text-xs text-white">
                        PU{u.unitNumber}
                      </span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#E10600]" />}
                    </div>
                    <div className="text-[10px] font-mono space-y-0.5">
                      <div className="text-[#8B98AD]">{u.km} km</div>
                      <div className="font-semibold text-white">{u.integrity}% integ.</div>
                      <div className={getRiskColor(u.risk)}>Risco {u.risk}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Seletor Carro #2 */}
          <div className="p-3.5 rounded-lg bg-[#0F1622] border border-[#1C2738] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-white text-xs uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Carro #2 — {driver2Name}
              </span>
              <Badge className="bg-[#141C29] text-cyan-400 border border-cyan-500/30 text-[10px] font-mono">
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
                    className={`p-2.5 rounded-md border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-sm ring-1 ring-cyan-400'
                        : isUsedByOther
                          ? 'bg-[#10141D] border-[#1C2330] text-[#64748B] hover:border-amber-500/40'
                          : 'bg-[#121926] border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-black text-xs text-white">
                        PU{u.unitNumber}
                      </span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <div className="text-[10px] font-mono space-y-0.5">
                      <div className="text-[#8B98AD]">{u.km} km</div>
                      <div className="font-semibold text-white">{u.integrity}% integ.</div>
                      <div className={getRiskColor(u.risk)}>Risco {u.risk}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Validação de Conflito */}
          {isConflict && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/50 text-red-200 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-tight">
                <strong className="font-mono uppercase text-red-300 block">
                  Conflito Físico de Montagem:
                </strong>
                A mesma unidade física <strong>(PU{selectedC1})</strong> não pode ser montada
                simultaneamente no Carro #1 e Carro #2. Selecione unidades distintas para cada
                cockpit.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[#161F2E]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-[#121926] border-[#1F2A3C] text-[#8B98AD] hover:text-white font-mono text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isConflict}
            className={`font-mono text-xs font-black uppercase tracking-wider ${
              isConflict
                ? 'bg-[#1C2533] text-[#64748B] cursor-not-allowed'
                : 'bg-[#E10600] hover:bg-[#C00400] text-white shadow-md'
            }`}
          >
            Confirmar e Homologar Montagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
