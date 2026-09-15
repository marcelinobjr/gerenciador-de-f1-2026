/**
 * IMPLEMENTAÇÃO Nº 6B — DIÁLOGO DO PIT WALL & AÇÕES DE RÁDIO
 * PitWallRadioDialog
 *
 * Oferece ações contextuais:
 * - LET_TEAMMATE_PASS (com confirmação e aviso qualitativo de impacto relacional)
 * - HOLD_POSITION
 * - DO_NOT_FIGHT
 * - ATTACK / PUSH
 * - MANAGE_TYRES / EXTEND_STINT
 * - BOX_THIS_LAP / STAY_OUT
 * - Follow-up contextual (com justificativa estruturada)
 * - Resposta a pedidos de piloto (REQUEST_PIT, etc.)
 */

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
import {
  Radio,
  AlertTriangle,
  Shield,
  Zap,
  Wrench,
  Clock,
  Volume2,
  Sparkles,
  Send,
} from 'lucide-react'
import {
  TeamOrderType,
  TeamOrderReason,
  RaceReactionType,
  DriverRequestPayload,
} from '@/types/race-interactions'
import { TireCompound } from '@/types/f1'

export interface PitWallRadioDialogProps {
  open: boolean
  onClose: () => void
  currentLap: number
  driverName: string
  driverId: string
  teammateName?: string
  teammateId?: string
  gapToTeammateSec?: number
  isTeammateAhead?: boolean
  currentTireCompound?: TireCompound
  currentTireWear?: number
  pendingRequest?: DriverRequestPayload | null
  activeFollowUp?: {
    orderType: TeamOrderType
    originalReaction: RaceReactionType
    driverMessage: string
  } | null
  onSendTeamOrder: (orderType: TeamOrderType, reason: TeamOrderReason) => void
  onRespondToRequest: (action: 'ACCEPT_REQUEST' | 'DENY_REQUEST' | 'REQUEST_MORE_LAPS') => void
  onSendFollowUp: (reason: TeamOrderReason) => void
}

export function PitWallRadioDialog({
  open,
  onClose,
  currentLap,
  driverName,
  driverId,
  teammateName,
  teammateId,
  gapToTeammateSec,
  isTeammateAhead,
  currentTireCompound = 'medio',
  currentTireWear = 50,
  pendingRequest,
  activeFollowUp,
  onSendTeamOrder,
  onRespondToRequest,
  onSendFollowUp,
}: PitWallRadioDialogProps) {
  const [confirmOrder, setConfirmOrder] = useState<{
    orderType: TeamOrderType
    reason: TeamOrderReason
    warningText: string
  } | null>(null)

  const [selectedReason, setSelectedReason] = useState<TeamOrderReason>('DIFFERENT_STRATEGY')

  // Se estiver em follow-up (piloto questionou ou resistiu)
  if (activeFollowUp) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="max-w-lg bg-[#090D15]/95 backdrop-blur-md border border-amber-500/50 text-[#F5F7FA] p-0 overflow-hidden shadow-2xl rounded-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="bg-gradient-to-r from-amber-950/40 via-[#111622] to-[#090D15] p-4 border-b border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <span>FOLLOW-UP // RESPOSTA AO PILOTO</span>
                  <Badge className="bg-amber-500/20 text-amber-300 text-[10px]">
                    {activeFollowUp.originalReaction}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 font-mono">
                  {driverName} questionou a ordem de equipe. Justifique para obter aceitação.
                </DialogDescription>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">V{currentLap}</span>
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Mensagem do Piloto no Rádio:
              </span>
              <div className="flex items-center gap-2 text-amber-200 italic">
                <Volume2 className="w-4 h-4 shrink-0" />
                <span>"{activeFollowUp.driverMessage}"</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold font-mono text-slate-300 block">
                Escolha a justificativa da equipe:
              </label>
              <div className="grid grid-cols-1 gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedReason('DIFFERENT_STRATEGY')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedReason === 'DIFFERENT_STRATEGY'
                      ? 'border-cyan-400 bg-cyan-950/50 text-white font-bold'
                      : 'border-slate-800 bg-[#0d121c] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block font-bold">Estratégia Diferente & Pneus Novos</span>
                  <span className="text-[10px] text-slate-400">
                    Informa que o companheiro tem pneus superiores e janela de pit diferente.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReason('CHAMPIONSHIP_PRIORITY')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedReason === 'CHAMPIONSHIP_PRIORITY'
                      ? 'border-cyan-400 bg-cyan-950/50 text-white font-bold'
                      : 'border-slate-800 bg-[#0d121c] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block font-bold">Prioridade na Disputa de Pontos</span>
                  <span className="text-[10px] text-slate-400">
                    Justifica pela tabela de construtores e foco esportivo da temporada.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReason('FASTER_TEAMMATE')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedReason === 'FASTER_TEAMMATE'
                      ? 'border-cyan-400 bg-cyan-950/50 text-white font-bold'
                      : 'border-slate-800 bg-[#0d121c] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="block font-bold">Delta de Ritmo Comprovado</span>
                  <span className="text-[10px] text-slate-400">
                    Apresenta os dados da telemetria de que o companheiro é mais rápido nesta fase.
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="ghost" onClick={onClose} className="font-mono text-xs">
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  onSendFollowUp(selectedReason)
                  onClose()
                }}
                className="bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Justificativa (Follow-up Único)</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Se tiver confirmação de ordem sensível (Regra de Ouro: aviso qualitativo, sem % ou números)
  if (confirmOrder) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && setConfirmOrder(null)}>
        <DialogContent className="max-w-md bg-[#090D15]/95 border border-red-500/50 text-white p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold font-mono">
                CONFIRMAR ORDEM CRÍTICA
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-mono">
                {confirmOrder.orderType === 'LET_TEAMMATE_PASS'
                  ? 'Ordem de Inversão de Posição'
                  : 'Ordem de Equipe Estrita'}
              </DialogDescription>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0f1422] border border-red-500/30 text-xs font-mono space-y-2">
            <p className="text-amber-300 font-semibold leading-relaxed">
              ⚠️ {confirmOrder.warningText}
            </p>
            <p className="text-[11px] text-slate-300">
              Essa decisão será interpretada pela personalidade de {driverName} e pode gerar memória
              permanente de favorecimento e afetar a confiança no Team Principal.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmOrder(null)}
              className="font-mono text-xs border-slate-700"
            >
              Recuar
            </Button>
            <Button
              onClick={() => {
                onSendTeamOrder(confirmOrder.orderType, confirmOrder.reason)
                setConfirmOrder(null)
                onClose()
              }}
              className="bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs"
            >
              Confirmar e Transmitir pelo Rádio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Se tiver um pedido espontâneo do piloto para responder
  if (pendingRequest) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg bg-[#090D15]/95 border border-cyan-500/40 text-white p-0 rounded-2xl">
          <div className="bg-gradient-to-r from-cyan-950/40 via-[#111622] to-[#090D15] p-4 border-b border-cyan-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold font-mono">
                  SOLICITAÇÃO DO PILOTO // PIT WALL
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 font-mono">
                  {driverName} chamou pelo rádio
                </DialogDescription>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-400">V{currentLap}</span>
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-[#0B0F19] p-3 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Pedido / Alerta:
              </span>
              <p className="text-cyan-200 italic font-bold">"{pendingRequest.perceivedIssue}"</p>
              <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1">
                <span>Pneu: {currentTireWear}% desgaste</span>
                <span>•</span>
                <span>Urgência: {pendingRequest.urgency.toUpperCase()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono text-slate-300 block">Resposta da Equipe:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                <Button
                  onClick={() => {
                    onRespondToRequest('ACCEPT_REQUEST')
                    onClose()
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  <Wrench className="w-3.5 h-3.5 mr-1" />
                  Autorizar / Parar nesta volta
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    onRespondToRequest('DENY_REQUEST')
                    onClose()
                  }}
                  className="border-slate-700 bg-[#121927] hover:bg-[#1a2336] text-slate-200 font-bold text-xs"
                >
                  <Clock className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  Negar / Ficar na pista
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Visão geral das Ordens Rápidas Disponíveis
  const isTeammateClose = gapToTeammateSec !== undefined && gapToTeammateSec < 3.0

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl bg-[#090D15]/95 border border-[#1A2333] text-white p-0 rounded-2xl overflow-hidden font-mono">
        <div className="bg-[#101624] p-4 border-b border-[#1A2333] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white uppercase tracking-wider">
                Rádio Pit Wall • Ordens Disponíveis
              </DialogTitle>
              <DialogDescription className="text-[11px] text-slate-400">
                Canal exclusivo com {driverName} (Volta {currentLap})
              </DialogDescription>
            </div>
          </div>
          <Badge className="bg-slate-800 text-slate-300 text-[10px]">
            {currentTireCompound.toUpperCase()} • {currentTireWear}% desg.
          </Badge>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Quick Actions Principais */}
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Ordens de Ritmo e Pneus (Execução Imediata)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  onSendTeamOrder('PUSH', 'PACE_MANAGEMENT')
                  onClose()
                }}
                className="bg-[#0f1422] border-slate-700 hover:border-cyan-400 hover:text-white text-xs h-10"
              >
                <Zap className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                Push
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onSendTeamOrder('MANAGE_TYRES', 'PACE_MANAGEMENT')
                  onClose()
                }}
                className="bg-[#0f1422] border-slate-700 hover:border-emerald-400 hover:text-white text-xs h-10"
              >
                <Shield className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Poup. Pneus
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onSendTeamOrder('BOX_THIS_LAP', 'TECHNICAL_PRESERVATION')
                  onClose()
                }}
                className="bg-[#0f1422] border-slate-700 hover:border-amber-400 hover:text-white text-xs h-10"
              >
                <Wrench className="w-3.5 h-3.5 mr-1 text-amber-400" />
                Box Já
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onSendTeamOrder('STAY_OUT', 'PACE_MANAGEMENT')
                  onClose()
                }}
                className="bg-[#0f1422] border-slate-700 hover:border-slate-500 hover:text-white text-xs h-10"
              >
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Ficar Fora
              </Button>
            </div>
          </div>

          {/* Ordens entre Companheiros de Equipe */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Ordens com o Companheiro ({teammateName || 'Companheiro'})
              </span>
              {gapToTeammateSec !== undefined && (
                <span className="text-[10px] text-slate-400">
                  Gap: {gapToTeammateSec.toFixed(1)}s{' '}
                  {isTeammateAhead ? '(atrás dele)' : '(à frente)'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* LET_TEAMMATE_PASS (Sensível!) */}
              <Button
                type="button"
                onClick={() =>
                  setConfirmOrder({
                    orderType: 'LET_TEAMMATE_PASS',
                    reason: 'DIFFERENT_STRATEGY',
                    warningText:
                      'Essa ordem pode afetar a relação e gerar tensão de status com o piloto.',
                  })
                }
                disabled={!isTeammateClose}
                className="h-auto p-3 bg-red-950/30 hover:bg-red-900/40 border border-red-800/60 text-left flex flex-col items-start gap-1 text-red-200"
              >
                <span className="text-xs font-bold uppercase text-red-300">
                  Pedir para Ceder Posição
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  {isTeammateClose
                    ? `Ordena ${driverName} a abrir passagem para ${teammateName || 'o companheiro'}.`
                    : 'Disponível apenas quando próximos na pista.'}
                </span>
              </Button>

              {/* HOLD_POSITION */}
              <Button
                type="button"
                onClick={() => {
                  onSendTeamOrder('HOLD_POSITION', 'TEAM_RESULT')
                  onClose()
                }}
                className="h-auto p-3 bg-slate-900/60 hover:bg-slate-800 border border-slate-700 text-left flex flex-col items-start gap-1 text-slate-200"
              >
                <span className="text-xs font-bold uppercase text-cyan-300">
                  Manter Posição (Hold)
                </span>
                <span className="text-[10px] text-slate-400 leading-tight">
                  Proíbe disputa interna entre os dois carros.
                </span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
