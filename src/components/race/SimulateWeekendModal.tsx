import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, FastForward } from 'lucide-react'

interface SimulateWeekendModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  hasCompletedSessions: boolean
  isSimulating: boolean
}

export const SimulateWeekendModal: React.FC<SimulateWeekendModalProps> = ({
  open,
  onClose,
  onConfirm,
  hasCompletedSessions,
  isSimulating,
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#090D15] border border-[#1F2733] text-[#F5F7FA] p-6 space-y-4">
        <DialogHeader className="space-y-2">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold text-white">
            {hasCompletedSessions
              ? 'Simular restante do fim de semana?'
              : 'Simular restante do fim de semana?'}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8B95A7] leading-relaxed">
            Todas as sessões restantes serão simuladas utilizando as decisões automáticas da equipe.
            Resultados, danos, custos, relações e consequências serão permanentes.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 rounded-lg bg-[#11161F] border border-[#1F2733] text-[11px] font-mono text-[#8B95A7] space-y-1">
          <span className="font-bold text-white block">Regras de Simulação FIA 2026:</span>
          <p>• Sessões já concluídas não serão repetidas.</p>
          <p>• O Pit Wall decidirá táticas de pneus e paradas de box de forma autônoma.</p>
          <p>
            • Ao término, você verá o Resumo do Fim de Semana completo com telemetria e finanças.
          </p>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSimulating}
            className="border-[#1F2733] text-[#8B95A7] hover:text-white hover:bg-[#11161F]"
          >
            CANCELAR
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSimulating}
            className="bg-[#00A6FB] hover:bg-[#0092DC] text-[#0B0E14] font-extrabold flex items-center gap-2"
          >
            <FastForward className="w-4 h-4" />
            {isSimulating ? 'SIMULANDO...' : 'SIMULAR'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
