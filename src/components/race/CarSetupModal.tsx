import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Wrench, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { PracticeCarLiveState, SetupKnowledgeModel } from '@/types/practice-session'
import type { SetupInformedRecommendation } from '@/services/canonicalPreparationInformedService'
import { analyzeSetupInformed } from '@/services/canonicalPreparationInformedService'

interface CarSetupModalProps {
  open: boolean
  onClose: () => void
  car: PracticeCarLiveState
  carId: 'car1' | 'car2'
  carNumber: 1 | 2
  driverName: string
  knowledge?: SetupKnowledgeModel
  onApplySetup: (carId: 'car1' | 'car2', newSetup: PracticeCarLiveState['setup']) => void
}

export const CarSetupModal: React.FC<CarSetupModalProps> = ({
  open,
  onClose,
  car,
  carId,
  carNumber,
  driverName,
  knowledge,
  onApplySetup,
}) => {
  const [frontWing, setFrontWing] = useState<number>(car.setup.frontWing)
  const [rearWing, setRearWing] = useState<number>(car.setup.rearWing)
  const [suspension, setSuspension] = useState<number>(car.setup.suspension)
  const [differential, setDifferential] = useState<number>(car.setup.differential)

  // Sincronizar quando o carro ou modal abrir
  React.useEffect(() => {
    if (open) {
      setFrontWing(car.setup.frontWing)
      setRearWing(car.setup.rearWing)
      setSuspension(car.setup.suspension)
      setDifferential(car.setup.differential)
    }
  }, [open, car])

  // Obter recomendação informada com base no conhecimento consolidado da 4C1 (sem ler ideal oculto)
  const informedRec: SetupInformedRecommendation = React.useMemo(() => {
    return analyzeSetupInformed(
      {
        wing_level: frontWing,
        suspension_stiffness: suspension,
        pu_electric_ratio: differential,
      } as any,
      knowledge,
    )
  }, [frontWing, suspension, differential, knowledge])

  const handleApplyEngineeringRecommendation = () => {
    if (!knowledge) return

    // Ajusta os valores para a faixa conhecida aprendida pela equipe
    if (knowledge.frontWing.revealed) {
      const target = Math.round((knowledge.frontWing.minKnown + knowledge.frontWing.maxKnown) / 2)
      setFrontWing(Math.max(1, Math.min(10, target)))
    }
    if (knowledge.rearWing.revealed) {
      const target = Math.round((knowledge.rearWing.minKnown + knowledge.rearWing.maxKnown) / 2)
      setRearWing(Math.max(1, Math.min(10, target)))
    }
    if (knowledge.suspension.revealed) {
      const target = Math.round((knowledge.suspension.minKnown + knowledge.suspension.maxKnown) / 2)
      setSuspension(Math.max(1, Math.min(10, target)))
    }
    if (knowledge.differential.revealed) {
      const target = Math.round(
        (knowledge.differential.minKnown + knowledge.differential.maxKnown) / 2,
      )
      setDifferential(Math.max(20, Math.min(80, target)))
    }
  }

  const handleSave = () => {
    onApplySetup(carId, {
      frontWing,
      rearWing,
      suspension,
      differential,
    })
    onClose()
  }

  const canEdit = car.status === 'garage'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-[#090D15] border border-[#1F2733] text-white font-mono p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black">
                  REACERTAR CARRO #{carNumber} — {driverName}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Ajuste aerodinâmico e mecânico na garagem para a próxima saída de treino livre.
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                canEdit
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px]'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/40 text-[10px]'
              }
            >
              {canEdit ? 'CARRO NA GARAGEM (EDITÁVEL)' : 'EM PISTA (BLOQUEADO)'}
            </Badge>
          </div>
        </DialogHeader>

        {!canEdit && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              O carro está em pista ou em transição. Chame o carro aos boxes para que os mecânicos
              possam alterar o acerto.
            </span>
          </div>
        )}

        <div className="space-y-5 py-2">
          {/* Card de Conhecimento Aprendido & Botão de Recomendação */}
          <div className="p-3.5 rounded-xl bg-[#0E1521] border border-[#1F293D] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white">Engenharia de Pista (Dados de TL)</span>
              </div>
              <Badge className="bg-[#141C2A] text-slate-300 border-[#222E42] text-[10px]">
                Confiança:{' '}
                <strong className="text-cyan-300 ml-1">
                  {knowledge?.overallConfidence?.toUpperCase() || 'BAIXA'}
                </strong>
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              {informedRec.headline} — {informedRec.observedBasisText}
            </p>
            <Button
              type="button"
              disabled={!canEdit || !knowledge || knowledge.totalStintsAnalyzed === 0}
              onClick={handleApplyEngineeringRecommendation}
              variant="outline"
              className="w-full h-8 text-xs font-bold border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/40 flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              APLICAR RECOMENDAÇÃO DA ENGENHARIA (CONHECIMENTO ADQUIRIDO)
            </Button>
          </div>

          {/* Sliders de Ajuste Manual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Asa Dianteira */}
            <div className="p-3 rounded-xl bg-[#0B1019] border border-[#182233] space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-300">Asa Dianteira</span>
                <span className="text-cyan-400 text-sm font-black">{frontWing} / 10</span>
              </div>
              <Slider
                disabled={!canEdit}
                min={1}
                max={10}
                step={1}
                value={[frontWing]}
                onValueChange={(val) => setFrontWing(val[0])}
              />
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>1 (Mínima carga)</span>
                <span>
                  {knowledge?.frontWing.revealed
                    ? `Faixa TL: [${knowledge.frontWing.minKnown}–${knowledge.frontWing.maxKnown}]`
                    : 'Faixa: ?'}
                </span>
                <span>10 (Máxima carga)</span>
              </div>
            </div>

            {/* Asa Traseira */}
            <div className="p-3 rounded-xl bg-[#0B1019] border border-[#182233] space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-300">Asa Traseira</span>
                <span className="text-cyan-400 text-sm font-black">{rearWing} / 10</span>
              </div>
              <Slider
                disabled={!canEdit}
                min={1}
                max={10}
                step={1}
                value={[rearWing]}
                onValueChange={(val) => setRearWing(val[0])}
              />
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>1 (Alta velocidade)</span>
                <span>
                  {knowledge?.rearWing.revealed
                    ? `Faixa TL: [${knowledge.rearWing.minKnown}–${knowledge.rearWing.maxKnown}]`
                    : 'Faixa: ?'}
                </span>
                <span>10 (Downforce alto)</span>
              </div>
            </div>

            {/* Suspensão */}
            <div className="p-3 rounded-xl bg-[#0B1019] border border-[#182233] space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-300">Rigidez da Suspensão</span>
                <span className="text-cyan-400 text-sm font-black">{suspension} / 10</span>
              </div>
              <Slider
                disabled={!canEdit}
                min={1}
                max={10}
                step={1}
                value={[suspension]}
                onValueChange={(val) => setSuspension(val[0])}
              />
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>1 (Macia / Zebras)</span>
                <span>
                  {knowledge?.suspension.revealed
                    ? `Faixa TL: [${knowledge.suspension.minKnown}–${knowledge.suspension.maxKnown}]`
                    : 'Faixa: ?'}
                </span>
                <span>10 (Rígida / Asfalto liso)</span>
              </div>
            </div>

            {/* Diferencial */}
            <div className="p-3 rounded-xl bg-[#0B1019] border border-[#182233] space-y-2">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-300">Bloqueio do Diferencial</span>
                <span className="text-cyan-400 text-sm font-black">{differential}%</span>
              </div>
              <Slider
                disabled={!canEdit}
                min={20}
                max={80}
                step={1}
                value={[differential]}
                onValueChange={(val) => setDifferential(val[0])}
              />
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>20% (Aberto / Curva)</span>
                <span>
                  {knowledge?.differential.revealed
                    ? `Faixa TL: [${knowledge.differential.minKnown}%–${knowledge.differential.maxKnown}%]`
                    : 'Faixa: ?'}
                </span>
                <span>80% (Fechado / Tração)</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t border-[#1F2733] pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs h-9"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!canEdit}
            onClick={handleSave}
            className="bg-[#00A6FB] hover:bg-[#0092DC] text-black font-black text-xs h-9 px-5 shadow-md flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            CONFIRMAR REACERTO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
