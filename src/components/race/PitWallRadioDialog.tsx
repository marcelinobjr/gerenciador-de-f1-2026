/**
 * IMPLEMENTAÇÃO Nº 6B — DIÁLOGO DO PIT WALL & AÇÕES DE RÁDIO
 * PitWallRadioDialog (Checkpoint C2 + C3)
 *
 * Visual claro padrão APEX GP:
 * - Fundo branco (#FFFFFF / bg-white)
 * - Títulos escuros (slate-900 / slate-800)
 * - Bordas suaves (slate-200 / slate-300)
 * - Sombras discretas (shadow-xl / shadow-sm)
 * - Vermelho APEX (#E10600) para ação principal / destaque
 * - Backdrop escurecido atrás do modal (padrão Dialog shadcn)
 * - Tipografia legível, sem caixa alta excessiva, sem estética de terminal dominante
 * - Responsivo (desktop centralizado e adaptável em mobile com scroll interno)
 *
 * Integração Canônica:
 * - Telemetria canônica unificada via `selectCarTireDisplayState`
 * - Desgaste 0% válido; campos ausentes mostram "—"; nenhum fallback 50%
 * - CONVERSA REAL: lê as mensagens reais do canal daquele piloto dos liveEvents da corrida
 * - RECOMENDAÇÃO DA ENGENHARIA: exibe card rico se houver recomendação pendente para aquele carro
 * - RESPOSTAS À RECOMENDAÇÃO: [ Aceitar Recomendação ] (usa `resolveDecision` canônico), [ Manter Plano ], [ Revisar Parada ]
 * - ORDENS: Aumentar ritmo, Poupar pneus, Ritmo normal; Entrar nos boxes nesta volta, Permanecer na pista
 * - ORDENS DE EQUIPE: Ceder posição, Manter posição com destinatário explícito e motivos claros
 * - Sem auto-retomada de corrida: jogador usa PLAY
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
  CheckCircle2,
  HelpCircle,
  XCircle,
  TrendingUp,
  Cpu,
  Layers,
  Info,
} from 'lucide-react'
import {
  TeamOrderType,
  TeamOrderReason,
  RaceReactionType,
  DriverRequestPayload,
} from '@/types/race-interactions'
import { TireCompound } from '@/types/f1'
import { LiveRaceEvent } from '@/types/race-events'
import { RacePendingDecision } from '@/types/race-session'
import { selectCarTireDisplayState, CarTireDisplayState } from '@/lib/f1-tire-system'
import type { SimDriverEntry } from '@/pages/race/types'

export interface PitWallRadioDialogProps {
  open: boolean
  onClose: () => void
  currentLap: number
  driverName: string
  driverId: string
  carNumber?: number
  currentPosition?: number
  car?: SimDriverEntry | null
  teammateName?: string
  teammateId?: string
  teammateCar?: SimDriverEntry | null
  gapToTeammateSec?: number
  isTeammateAhead?: boolean
  currentTireCompound?: TireCompound
  currentTireWear?: number
  lapsOnTire?: number
  // Conversa real vinda do feed da prova
  liveEvents?: LiveRaceEvent[]
  // Recomendação informada da engenharia pendente (se houver)
  pendingRecommendation?: RacePendingDecision | null
  onAcceptRecommendation?: (decisionId: string) => void
  onDeclineRecommendation?: (decisionId: string) => void
  onReviewPitStop?: (driverId: string) => void
  // Pedidos e follow-ups psicológicos existentes
  pendingRequest?: DriverRequestPayload | null
  activeFollowUp?: {
    orderType: TeamOrderType
    originalReaction: RaceReactionType
    driverMessage: string
  } | null
  // Status da última ordem transmitida
  lastOrderState?: {
    orderType: TeamOrderType
    status:
      | 'sent'
      | 'waiting'
      | 'accepted'
      | 'reluctant'
      | 'questioned'
      | 'resisted'
      | 'refused'
      | 'executing'
      | 'executed'
    statusLabel: string
    driverResponse?: string
    timestamp?: string
  } | null
  // Disparadores canônicos
  onSendTeamOrder: (
    orderType: TeamOrderType,
    reason: TeamOrderReason,
    targetDriverId?: string,
  ) => void
  onCallBoxThisLap?: (driverId: string) => void
  onStayOut?: (driverId: string) => void
  onRespondToRequest: (action: 'ACCEPT_REQUEST' | 'DENY_REQUEST' | 'REQUEST_MORE_LAPS') => void
  onSendFollowUp: (reason: TeamOrderReason) => void
}

export function PitWallRadioDialog({
  open,
  onClose,
  currentLap,
  driverName,
  driverId,
  carNumber,
  currentPosition,
  car,
  teammateName,
  teammateId,
  teammateCar,
  gapToTeammateSec,
  isTeammateAhead,
  currentTireCompound,
  currentTireWear,
  lapsOnTire,
  liveEvents = [],
  pendingRecommendation,
  onAcceptRecommendation,
  onDeclineRecommendation,
  onReviewPitStop,
  pendingRequest,
  activeFollowUp,
  lastOrderState,
  onSendTeamOrder,
  onCallBoxThisLap,
  onStayOut,
  onRespondToRequest,
  onSendFollowUp,
}: PitWallRadioDialogProps) {
  const [confirmOrder, setConfirmOrder] = useState<{
    orderType: TeamOrderType
    reason: TeamOrderReason
    warningText: string
  } | null>(null)

  const [selectedReason, setSelectedReason] = useState<TeamOrderReason>('DIFFERENT_STRATEGY')

  // Telemetria canônica e unificada
  // Se 'car' estiver presente, usa-o diretamente. Caso contrário, monta objeto leve com os dados passados.
  const tireDisplay: CarTireDisplayState = selectCarTireDisplayState(
    car ||
      (driverId
        ? {
            tireCompound: currentTireCompound,
            tireWear: currentTireWear,
            lapsOnCurrentTire: lapsOnTire,
          }
        : null),
  )

  const effectivePos = currentPosition ?? car?.position
  const effectiveCarNumber = carNumber ?? (car as any)?.driverNumber ?? (car as any)?.carNumber

  // Filtragem da conversa real: eventos que mencionam este canal/piloto ou rádio da prova
  const driverChannelEvents = liveEvents
    .filter((ev) => {
      if (!ev) return false
      // Se o evento estiver explicitamente atribuído ao piloto
      if (ev.driverName && ev.driverName.toLowerCase().includes(driverName.toLowerCase())) {
        return true
      }
      // Mensagens de rádio que mencionam o nome do piloto
      if (
        ev.type === 'team_radio' &&
        ev.message &&
        ev.message.toLowerCase().includes(driverName.toLowerCase())
      ) {
        return true
      }
      return false
    })
    .slice(0, 8)

  // Validação de ordens com o companheiro
  const isCarDnf = Boolean(car?.dnf)
  const isTeammateDnf = Boolean(teammateCar?.dnf)
  const isTeammateClose = gapToTeammateSec !== undefined && gapToTeammateSec < 3.0
  const canOrderLetPass = Boolean(teammateId && !isCarDnf && !isTeammateDnf && isTeammateClose)
  const letPassDisabledReason = !teammateId
    ? 'Nenhum companheiro de equipe escalado.'
    : isCarDnf
      ? 'Carro não está apto a receber esta ordem.'
      : isTeammateDnf
        ? 'Companheiro abandonou a prova.'
        : !isTeammateClose
          ? 'Companheiro fora da janela para troca de posição.'
          : undefined

  // 1. Tela de Follow-up (quando piloto questionou ou resistiu)
  if (activeFollowUp) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="max-w-lg bg-white border border-slate-200 text-slate-900 p-0 overflow-hidden shadow-2xl rounded-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="bg-amber-50 p-4 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Follow-up · Resposta ao Piloto</span>
                  <Badge className="bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-mono">
                    {activeFollowUp.originalReaction}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-600">
                  {driverName} questionou a ordem de equipe. Justifique para obter aceitação.
                </DialogDescription>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              Volta {currentLap}
            </span>
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                Mensagem do Piloto no Rádio:
              </span>
              <div className="flex items-center gap-2 text-slate-800 italic font-medium">
                <Volume2 className="w-4 h-4 shrink-0 text-amber-600" />
                <span>"{activeFollowUp.driverMessage}"</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Escolha a justificativa da equipe:
              </label>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedReason('DIFFERENT_STRATEGY')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedReason === 'DIFFERENT_STRATEGY'
                      ? 'border-[#E10600] bg-red-50 text-slate-900 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="block font-bold text-slate-900">
                    Estratégia Diferente & Pneus Novos
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Informa que o companheiro tem pneus superiores e janela de pit diferente.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReason('CHAMPIONSHIP_PRIORITY')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedReason === 'CHAMPIONSHIP_PRIORITY'
                      ? 'border-[#E10600] bg-red-50 text-slate-900 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="block font-bold text-slate-900">
                    Prioridade na Disputa de Pontos
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Justifica pela tabela de construtores e foco esportivo da temporada.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReason('FASTER_TEAMMATE')}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedReason === 'FASTER_TEAMMATE'
                      ? 'border-[#E10600] bg-red-50 text-slate-900 font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="block font-bold text-slate-900">Delta de Ritmo Comprovado</span>
                  <span className="text-[11px] text-slate-500">
                    Apresenta os dados da telemetria de que o companheiro é mais rápido nesta fase.
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="ghost" onClick={onClose} className="text-xs">
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  onSendFollowUp(selectedReason)
                  onClose()
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
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

  // 2. Tela de Confirmação de Ordem Crítica (Regra de Ouro: qualitativa)
  if (confirmOrder) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && setConfirmOrder(null)}>
        <DialogContent className="max-w-md bg-white border border-slate-200 text-slate-900 p-5 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#E10600]" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900">
                Confirmar Ordem Crítica de Equipe
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {confirmOrder.orderType === 'LET_TEAMMATE_PASS'
                  ? 'Ordem de Inversão de Posição'
                  : 'Ordem de Equipe Estrita'}
              </DialogDescription>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2">
            <p className="text-amber-900 font-semibold leading-relaxed">
              ⚠️ {confirmOrder.warningText}
            </p>
            <p className="text-[11px] text-amber-800">
              Essa decisão será interpretada pela personalidade de {driverName} e pode gerar memória
              permanente de favorecimento e afetar a confiança no Team Principal.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => setConfirmOrder(null)}
              className="text-xs border-slate-300 text-slate-700"
            >
              Recuar
            </Button>
            <Button
              onClick={() => {
                onSendTeamOrder(confirmOrder.orderType, confirmOrder.reason, driverId)
                setConfirmOrder(null)
                onClose()
              }}
              className="bg-[#E10600] hover:bg-[#C10500] text-white font-bold text-xs shadow-sm"
            >
              Confirmar e Transmitir pelo Rádio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // 3. Resposta a Pedido Espontâneo do Piloto
  if (pendingRequest) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg bg-white border border-slate-200 text-slate-900 p-0 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold text-slate-900">
                  Solicitação do Piloto · Pit Wall
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {driverName} chamou pelo rádio
                </DialogDescription>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
              Volta {currentLap}
            </span>
          </div>

          <div className="p-4 space-y-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                Pedido / Alerta:
              </span>
              <p className="text-slate-900 italic font-bold">"{pendingRequest.perceivedIssue}"</p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                <span>Pneu: {tireDisplay.tireWearText} desgaste</span>
                <span>•</span>
                <span>Urgência: {pendingRequest.urgency.toUpperCase()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Resposta da Equipe:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  onClick={() => {
                    onRespondToRequest('ACCEPT_REQUEST')
                    onClose()
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm"
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
                  className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs"
                >
                  <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Negar / Ficar na pista
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // 4. DIÁLOGO PRINCIPAL DO RÁDIO PIT WALL (C2 + C3)
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl bg-white border border-slate-200 text-slate-900 p-0 rounded-2xl shadow-2xl overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* CABEÇALHO CLARO DO RÁDIO */}
        <div className="bg-slate-50 p-4 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-[#E10600] shrink-0">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>RÁDIO — {driverName.toUpperCase()}</span>
                  <Badge
                    variant="outline"
                    className="border-slate-300 text-slate-700 text-[10px] font-mono font-bold bg-white"
                  >
                    Canal Aberto
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-600 font-medium mt-0.5">
                  {effectiveCarNumber ? `Carro #${effectiveCarNumber}` : 'Carro'} · Volta{' '}
                  {currentLap} · Posição atual: {effectivePos ? `P${effectivePos}` : '—'}
                </DialogDescription>
              </div>
            </div>

            {/* Resumo compacto de pneus via selectCarTireDisplayState */}
            <div className="text-right text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs shrink-0">
              <div className="font-bold text-slate-900 flex items-center justify-end gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span>{tireDisplay.compoundName}</span>
              </div>
              <div className="text-[10px] font-mono text-slate-600 mt-0.5 space-x-1.5">
                <span>
                  Cond:{' '}
                  <strong className="text-emerald-700">{tireDisplay.tireConditionText}</strong>
                </span>
                <span>·</span>
                <span>
                  Desg: <strong className="text-slate-900">{tireDisplay.tireWearText}</strong>
                </span>
                <span>·</span>
                <span>{tireDisplay.lapsOnTireText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CORPO DO MODAL COM SCROLL INTERNO RESPONSIVO */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* SEÇÃO 1: CONVERSA REAL DO FEED */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                Conversa do Canal ({driverName})
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {driverChannelEvents.length} mensagem(ns) recente(s)
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 max-h-36 overflow-y-auto">
              {driverChannelEvents.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2 text-center">
                  Canal silencioso nas últimas voltas. Nenhuma transmissão recente registrada.
                </p>
              ) : (
                driverChannelEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2 rounded-lg bg-white border border-slate-200/80 text-xs shadow-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span className="font-bold text-slate-700">
                        {ev.type === 'team_radio' ? '📻 RÁDIO' : '📋 REGISTRO'}
                      </span>
                      <span>
                        Volta {ev.lap} · {ev.timestamp}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium leading-relaxed">{ev.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SEÇÃO 2: RECOMENDAÇÃO INFORMADA DA ENGENHARIA (SE PENDENTE) */}
          {pendingRecommendation && pendingRecommendation.payload && (
            <div className="p-4 rounded-xl bg-amber-50/70 border-2 border-amber-400 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block uppercase tracking-wide">
                      Recomendação da Engenharia
                    </span>
                    <span className="text-[10px] text-amber-800">
                      Baseada nos aprendizados de treinos livres e telemetria atual
                    </span>
                  </div>
                </div>
                <Badge className="bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold">
                  Confiança:{' '}
                  {String(pendingRecommendation.payload.confidence || 'Alta').toUpperCase()}
                </Badge>
              </div>

              {/* Detalhes da recomendação */}
              <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                  <span>
                    Composto Sugerido:{' '}
                    <strong className="text-slate-900 uppercase">
                      {String(pendingRecommendation.payload.proposedCompound || '—')}
                    </strong>
                  </span>
                  <span>
                    Janela Estimada:{' '}
                    <strong className="text-slate-900">
                      {String(
                        pendingRecommendation.payload.estimatedWindow || `Volta ${currentLap}`,
                      )}
                    </strong>
                  </span>
                </div>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  {String(
                    pendingRecommendation.description ||
                      pendingRecommendation.payload.justification ||
                      'Parada sugerida para troca de pneus antes da queda abrupta de rendimento.',
                  )}
                </p>
                {pendingRecommendation.payload.invalidationConditions && (
                  <p className="text-[10px] text-amber-800 font-medium pt-0.5">
                    ⚠️ Invalidação: {String(pendingRecommendation.payload.invalidationConditions)}
                  </p>
                )}
              </div>

              {/* Respostas canônicas à recomendação */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onAcceptRecommendation && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onAcceptRecommendation(pendingRecommendation.id)
                      onClose()
                    }}
                    className="bg-[#E10600] hover:bg-[#C10500] text-white font-bold text-xs h-8 px-3 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Aceitar Recomendação
                  </Button>
                )}

                {onDeclineRecommendation && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onDeclineRecommendation(pendingRecommendation.id)
                      onClose()
                    }}
                    className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs h-8 px-3"
                  >
                    Manter Plano
                  </Button>
                )}

                {onReviewPitStop && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onReviewPitStop(driverId)
                      onClose()
                    }}
                    className="text-slate-600 hover:text-slate-900 text-xs h-8 px-2.5"
                  >
                    Revisar Parada
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO 3: ORDENS DE RITMO */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
              Ordens de Ritmo
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  onSendTeamOrder('PUSH', 'PACE_MANAGEMENT', driverId)
                  onClose()
                }}
                className="bg-white border-slate-300 hover:border-orange-500 hover:bg-orange-50/50 text-slate-800 font-bold text-xs h-10 flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-orange-600" />
                Aumentar Ritmo
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onSendTeamOrder('HOLD_POSITION', 'PACE_MANAGEMENT', driverId)
                  onClose()
                }}
                className="bg-white border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-800 font-bold text-xs h-10 flex items-center justify-center gap-1.5"
              >
                <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
                Ritmo Normal
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onSendTeamOrder('MANAGE_TYRES', 'PACE_MANAGEMENT', driverId)
                  onClose()
                }}
                className="bg-white border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-800 font-bold text-xs h-10 flex items-center justify-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                Poupar Pneus
              </Button>
            </div>
          </div>

          {/* SEÇÃO 4: ORDENS DE BOXES (CONVERGEM PARA O MESMO FLUXO CANÔNICO) */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
              Ordens de Boxes
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  if (onCallBoxThisLap) {
                    onCallBoxThisLap(driverId)
                  } else {
                    onSendTeamOrder('BOX_THIS_LAP', 'TECHNICAL_PRESERVATION', driverId)
                  }
                  onClose()
                }}
                disabled={isCarDnf}
                className="bg-[#E10600] hover:bg-[#C10500] text-white font-extrabold text-xs h-10 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Wrench className="w-3.5 h-3.5" />
                Entrar nos boxes nesta volta
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (onStayOut) {
                    onStayOut(driverId)
                  } else {
                    onSendTeamOrder('STAY_OUT', 'PACE_MANAGEMENT', driverId)
                  }
                  onClose()
                }}
                disabled={isCarDnf}
                className="bg-white border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs h-10 flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Permanecer na pista
              </Button>
            </div>
            {isCarDnf && (
              <p className="text-[11px] text-red-600 font-medium">
                Carro não está apto a receber esta ordem (abandonou a corrida).
              </p>
            )}
          </div>

          {/* SEÇÃO 5: ORDENS DE EQUIPE (DESTINATÁRIOS EXPLÍCITOS & MOTIVOS CLAROS) */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                Ordens de Equipe
              </span>
              {teammateName && (
                <span className="text-[10px] text-slate-500 font-mono">
                  Companheiro: <strong>{teammateName}</strong>{' '}
                  {gapToTeammateSec !== undefined && `(${gapToTeammateSec.toFixed(1)}s)`}
                </span>
              )}
            </div>

            {/* Banner de Destinatário Explícito */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  DESTINATÁRIO:
                </span>
                <strong className="text-slate-900 text-xs">
                  {driverName} {effectiveCarNumber ? `(#${effectiveCarNumber})` : ''}
                </strong>
              </div>
              {teammateName && (
                <div className="text-right sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    COMPANHEIRO ENVOLVIDO:
                  </span>
                  <strong className="text-slate-700 text-xs">{teammateName}</strong>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* PEDIR PARA CEDER POSIÇÃO */}
              <div className="space-y-1">
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
                  disabled={!canOrderLetPass}
                  className="w-full h-auto p-3 bg-red-50 hover:bg-red-100 border border-red-200 text-left flex flex-col items-start gap-1 text-slate-900 shadow-xs"
                >
                  <span className="text-xs font-bold text-[#E10600]">
                    Ceder Posição ao Companheiro
                  </span>
                  <span className="text-[10px] text-slate-600 leading-tight">
                    Ordena {driverName} a ceder a posição para {teammateName || 'o companheiro'}.
                  </span>
                </Button>
                {letPassDisabledReason && (
                  <p className="text-[10px] text-amber-700 px-1 font-medium">
                    {letPassDisabledReason}
                  </p>
                )}
              </div>

              {/* MANTER POSIÇÃO / NÃO DISPUTAR */}
              <div className="space-y-1">
                <Button
                  type="button"
                  onClick={() => {
                    onSendTeamOrder('HOLD_POSITION', 'TEAM_RESULT', driverId)
                    onClose()
                  }}
                  disabled={isCarDnf}
                  className="w-full h-auto p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex flex-col items-start gap-1 text-slate-900 shadow-xs"
                >
                  <span className="text-xs font-bold text-slate-800">
                    Manter Posição / Não Disputar
                  </span>
                  <span className="text-[10px] text-slate-600 leading-tight">
                    DESTINATÁRIOS: AMBOS OS PILOTOS. Proíbe disputa interna entre os dois carros.
                  </span>
                </Button>
                {isCarDnf && (
                  <p className="text-[10px] text-red-600 px-1 font-medium">
                    Carro não está apto a receber esta ordem.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SEÇÃO 6: ESTADO REAL DA ÚLTIMA ORDEM (SE HOUVER) */}
          {lastOrderState && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Estado da Última Ordem:
                </span>
                <Badge
                  className={`text-[10px] font-mono ${
                    lastOrderState.status === 'accepted' || lastOrderState.status === 'executed'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : lastOrderState.status === 'refused'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {lastOrderState.statusLabel}
                </Badge>
              </div>
              {lastOrderState.driverResponse && (
                <p className="text-slate-800 italic pt-0.5">"{lastOrderState.driverResponse}"</p>
              )}
            </div>
          )}
        </div>

        {/* RODAPÉ DO DIÁLOGO */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            A corrida permanece pausada. O jogador retoma com Play.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-bold border-slate-300 text-slate-700 bg-white hover:bg-slate-100 h-8 px-4"
          >
            Fechar Rádio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
