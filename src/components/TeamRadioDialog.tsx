import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Radio, Wrench, Shield, Zap, Leaf, Volume2, Clock, Sparkles } from 'lucide-react'
import { TireCompound, TireSetItem } from '@/types/f1'
import { TIRE_SPECS } from '@/lib/f1-tire-system'
import { DriverRadioMessage, BossResponseType, DRIVER_FEEDBACKS } from '@/lib/f1-radio-system'

interface TeamRadioDialogProps {
  open: boolean
  message: DriverRadioMessage | null
  queueCount?: number
  queueTotal?: number
  availableTireSets: TireSetItem[]
  currentTireCompound?: TireCompound
  currentTireWear?: number
  onRespond: (
    responseType: BossResponseType,
    options?: {
      tireSetId?: string
      chosenCompound?: TireCompound
      driverFeedbackText?: string
    },
  ) => void
}

export function TeamRadioDialog({
  open,
  message,
  queueCount = 1,
  queueTotal = 1,
  availableTireSets,
  currentTireCompound = 'medio',
  currentTireWear = 50,
  onRespond,
}: TeamRadioDialogProps) {
  const [selectedSetId, setSelectedSetId] = useState<string>('')
  const [feedbackPreview, setFeedbackPreview] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<BossResponseType | null>(null)

  // Determina primeiro jogo de pneus selecionado por padrão
  const usableSets = availableTireSets.filter((s) => !s.isFitted && s.wear < 90)
  const activeSelectedSet = usableSets.find((s) => s.id === selectedSetId) || usableSets[0]

  if (!message) return null

  const formatTireName = (c?: TireCompound) => {
    switch (c) {
      case 'duro':
        return 'Duro (C2/Branco)'
      case 'medio':
        return 'Médio (C3/Amarelo)'
      case 'macio':
        return 'Macio (C4/Vermelho)'
      case 'intermediario':
        return 'Intermediário (Verde)'
      case 'chuva_extrema':
        return 'Chuva Extrema (Azul)'
      default:
        return 'Médio'
    }
  }

  const handleChooseAction = (action: BossResponseType) => {
    const feedbacks = DRIVER_FEEDBACKS[action] || ['Entendido!']
    const chosenFeedback = feedbacks[Math.floor(Math.random() * feedbacks.length)]
    setFeedbackPreview(chosenFeedback)
    setPendingAction(action)

    // Pequeno delay para o jogador ver a resposta de confirmação do piloto no painel
    setTimeout(() => {
      onRespond(action, {
        tireSetId: action === 'box_now' ? activeSelectedSet?.id || usableSets[0]?.id : undefined,
        chosenCompound: action === 'box_now' ? activeSelectedSet?.compound || 'medio' : undefined,
        driverFeedbackText: chosenFeedback,
      })
      setFeedbackPreview(null)
      setPendingAction(null)
    }, 700)
  }

  const isCliffOrCrit = message.category === 'cliff' || message.category === 'tire_critical'

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-xl bg-[#0d121c] border-2 border-[#1f293d] text-[#F5F7FA] p-0 overflow-hidden shadow-2xl rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header estilo Pit Wall / Rádio da Equipe */}
        <div className="bg-gradient-to-r from-[#151c2c] via-[#0f172a] to-[#151c2c] p-4 border-b border-[#1f293d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-500 shadow-inner">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-black font-mono tracking-wider uppercase text-white flex items-center gap-2">
                  <span>RÁDIO DA EQUIPE // PIT WALL</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </DialogTitle>
                {queueTotal > 1 && (
                  <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono">
                    Conversa {queueCount} de {queueTotal}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-[11px] text-[#8B95A7] font-mono">
                {message.isUrgent
                  ? '🛑 CORRIDA CONGELADA — Decisão tática obrigatória solicitada pelo piloto'
                  : 'Rádio em andamento com o cockpit'}
              </DialogDescription>
            </div>
          </div>

          <div className="text-right font-mono">
            <span className="text-[11px] font-bold text-cyan-400 block">VOLTA {message.lap}</span>
            <span className="text-[10px] text-slate-400">{message.timestamp}</span>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Caixa de diálogo da mensagem do Piloto */}
          <div className="bg-[#090d15] border border-[#1f2733] rounded-xl p-4 shadow-inner relative overflow-hidden">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center font-black text-white shrink-0 text-sm shadow">
                {message.driverName.slice(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{message.driverName}</span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 border-slate-700 text-slate-300 uppercase font-mono"
                    >
                      {message.personalityTag || 'Piloto'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="text-slate-400">Pneu:</span>
                    <Badge
                      className={`text-[10px] px-1.5 py-0 font-bold ${
                        message.category === 'cliff'
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      }`}
                    >
                      {formatTireName(currentTireCompound)} ({currentTireWear}% desg.)
                    </Badge>
                  </div>
                </div>

                <div className="text-xs sm:text-sm text-slate-100 font-mono bg-[#111723] p-3 rounded-lg border border-slate-800/80 leading-relaxed flex items-start gap-2 shadow">
                  <Volume2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="italic">"{message.message}"</span>
                </div>
              </div>
            </div>

            {/* Feedback animado pós-resposta */}
            {feedbackPreview && (
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2 text-xs font-mono text-emerald-400 animate-fade-in bg-emerald-950/30 p-2 rounded-lg">
                <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="font-bold">{message.driverName}:</span>
                <span className="italic">"{feedbackPreview}"</span>
              </div>
            )}
          </div>

          {/* Seletor de pneus para caso escolha "BOX AGORA" */}
          <div className="bg-[#111724] border border-[#1e2736] rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-slate-200 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                Composto para próximo stint (se optar por box agora):
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {usableSets.length} jogos disponíveis
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {usableSets.slice(0, 4).map((set) => {
                const isSelected = (activeSelectedSet?.id || usableSets[0]?.id) === set.id
                const spec = TIRE_SPECS[set.compound] || TIRE_SPECS.medio
                return (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => setSelectedSetId(set.id)}
                    className={`p-2 rounded-lg border text-left transition-all font-mono ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_10px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400'
                        : 'border-[#1e2736] bg-[#0c1017] hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white capitalize">
                        {spec.name}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {set.lapsUsed === 0 ? 'NOVO' : `${set.wear}% desg`}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Delta:{' '}
                      {spec.deltaPerLapSec > 0
                        ? `+${spec.deltaPerLapSec}s`
                        : `${spec.deltaPerLapSec}s`}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Botões de Decisão Tática do Chefe de Equipe */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
              Ordens do Pit Wall (Selecione a resposta):
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Opção 1: BOX AGORA */}
              <Button
                type="button"
                disabled={!!pendingAction}
                onClick={() => handleChooseAction('box_now')}
                className={`h-auto py-3 px-3 font-mono font-bold text-left flex flex-col items-start justify-start gap-1 transition-all ${
                  isCliffOrCrit
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg ring-2 ring-red-400 animate-pulse'
                    : 'bg-amber-600 hover:bg-amber-500 text-black'
                }`}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <Wrench className="w-4 h-4 shrink-0" />
                  <span className="text-xs uppercase font-black tracking-wide">
                    BOX AGORA (Parar Nesta Volta)
                  </span>
                </div>
                <span className="text-[10px] font-normal opacity-90 leading-tight">
                  Chama aos boxes imediatamente. Calça{' '}
                  {formatTireName(activeSelectedSet?.compound || 'medio')}.
                </span>
              </Button>

              {/* Opção 2: AGUENTE MAIS */}
              <Button
                type="button"
                variant="outline"
                disabled={!!pendingAction}
                onClick={() => handleChooseAction('stay_out')}
                className="h-auto py-3 px-3 font-mono text-left flex flex-col items-start justify-start gap-1 border-slate-700 bg-[#121927] hover:bg-[#1a2336] text-slate-200 hover:text-white"
              >
                <div className="flex items-center gap-1.5 w-full">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs uppercase font-bold tracking-wide">
                    AGUENTE MAIS (Ficar na Pista)
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal leading-tight">
                  Permanece na pista. Pequena perda de moral, reavisa só se piorar.
                </span>
              </Button>

              {/* Opção 3: MODO ATAQUE */}
              <Button
                type="button"
                variant="outline"
                disabled={!!pendingAction}
                onClick={() => handleChooseAction('attack_mode')}
                className="h-auto py-3 px-3 font-mono text-left flex flex-col items-start justify-start gap-1 border-purple-800/60 bg-purple-950/20 hover:bg-purple-900/40 text-purple-200 hover:text-white"
              >
                <div className="flex items-center gap-1.5 w-full">
                  <Zap className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-xs uppercase font-bold tracking-wide">
                    MODO ATAQUE (+Ritmo / +Moral)
                  </span>
                </div>
                <span className="text-[10px] text-purple-300/80 font-normal leading-tight">
                  Ritmo agressivo na pista em troca de maior desgaste de pneus.
                </span>
              </Button>

              {/* Opção 4: PRESERVE O CARRO */}
              <Button
                type="button"
                variant="outline"
                disabled={!!pendingAction}
                onClick={() => handleChooseAction('preserve_car')}
                className="h-auto py-3 px-3 font-mono text-left flex flex-col items-start justify-start gap-1 border-emerald-800/60 bg-emerald-950/20 hover:bg-emerald-900/40 text-emerald-200 hover:text-white"
              >
                <div className="flex items-center gap-1.5 w-full">
                  <Leaf className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs uppercase font-bold tracking-wide">
                    PRESERVE O CARRO (-Desgaste)
                  </span>
                </div>
                <span className="text-[10px] text-emerald-300/80 font-normal leading-tight">
                  Poupa pneus e unidade motriz, gerenciando temperatura e ritmo.
                </span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
