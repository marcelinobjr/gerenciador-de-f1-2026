import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  RotateCcw,
  Fuel,
  Disc,
  Gauge,
  Activity,
  Layers,
  Wrench,
  CheckCircle2,
} from 'lucide-react'
import type {
  PracticeCarLiveState,
  PracticeStint,
  StintFeedbackRecord,
  SetupKnowledgeModel,
} from '@/types/practice-session'
import { PRACTICE_PROGRAMS } from '@/types/practice-preparation'
import { formatTireName } from '@/lib/f1-tire-system'
import { MessageSquare, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

interface PracticeCarCockpitCardProps {
  car: PracticeCarLiveState
  carNumber: 1 | 2
  teamColor?: string
  carImageUrl?: string
  currentStint?: PracticeStint
  latestFeedback?: StintFeedbackRecord
  hasUnreadFeedback?: boolean
  knowledge?: SetupKnowledgeModel
  isSessionRunning: boolean
  isSessionCompleted: boolean
  onOrderExitTrack: () => void
  onRequestBox: () => void
  onMarkFeedbackRead?: () => void
  isRookie?: boolean
  originalDriverName?: string
  canToggleRookie?: boolean
  onOpenRookieSelector?: () => void
  onRestoreTitular?: () => void
}

const TRACK_STATUS_LABELS: Record<
  PracticeCarLiveState['status'],
  { label: string; badgeClass: string }
> = {
  garage: {
    label: 'NA GARAGEM',
    badgeClass: 'bg-slate-700/30 text-slate-300 border-slate-600/40',
  },
  out_lap: {
    label: 'SAINDO DOS BOXES (OUT LAP)',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse',
  },
  flying_lap: {
    label: 'EM PISTA (VOLTA RÁPIDA)',
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-black',
  },
  in_lap: {
    label: 'ENTRANDO NOS BOXES (IN LAP)',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/40 animate-pulse',
  },
}

export const PracticeCarCockpitCard: React.FC<PracticeCarCockpitCardProps> = ({
  car,
  carNumber,
  teamColor = '#00A6FB',
  carImageUrl,
  currentStint,
  latestFeedback,
  hasUnreadFeedback = false,
  knowledge,
  isSessionRunning,
  isSessionCompleted,
  onOrderExitTrack,
  onRequestBox,
  onMarkFeedbackRead,
  isRookie = false,
  originalDriverName,
  canToggleRookie = false,
  onOpenRookieSelector,
  onRestoreTitular,
}) => {
  const [showFeedbackDetails, setShowFeedbackDetails] = React.useState<boolean>(true)
  const statusConfig = TRACK_STATUS_LABELS[car.status]
  const programMeta = PRACTICE_PROGRAMS[car.program] || PRACTICE_PROGRAMS.car_setup

  const isCarInGarage = car.status === 'garage'
  const isCarOnTrack = !isCarInGarage

  // Formatação segura de confiança por eixo
  const formatConfidenceBadge = (level: string) => {
    if (level === 'alta') {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px]">
          Alta
        </Badge>
      )
    }
    if (level === 'media') {
      return (
        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px]">
          Média
        </Badge>
      )
    }
    return (
      <Badge className="bg-slate-700/40 text-slate-400 border-slate-600/30 text-[9px]">Baixa</Badge>
    )
  }

  return (
    <Card className="p-4 bg-[#090D15]/90 border border-[#1F2733] rounded-2xl shadow-xl space-y-4 font-mono">
      {/* 1. TOPO DO CARRO: PILOTO, NÚMERO, CARRO E STATUS ATUAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1A2333] pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-black"
            style={{ backgroundColor: teamColor }}
          >
            #{carNumber}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-black text-white">{car.driverName}</h4>
              <Badge className="bg-[#141B26] text-[#BAC4D6] border-[#222E42] text-[10px] py-0 px-1.5 font-bold">
                Carro {carNumber}
              </Badge>
              {isRookie && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] px-1.5 py-0 font-black tracking-wider">
                  ROOKIE
                </Badge>
              )}
            </div>
            {isRookie && originalDriverName && (
              <p className="text-[10px] text-amber-400/90 font-medium">
                Substituindo temporariamente {originalDriverName} no TL1
              </p>
            )}{' '}
            <p className="text-[11px] text-[#8B95A7]">
              Programa ativo: <span className="text-white font-bold">{programMeta.title}</span>
            </p>
          </div>
        </div>

        {/* STATUS ATUAL E BOTÃO DE ESCALAÇÃO DO RESERVA (TL1) */}
        <div className="flex flex-wrap items-center gap-2">
          {canToggleRookie &&
            !isSessionRunning &&
            !isSessionCompleted &&
            (isRookie ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRestoreTitular}
                className="h-7 text-[10px] font-bold border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              >
                Restaurar Titular ({originalDriverName})
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onOpenRookieSelector}
                className="h-7 text-[10px] font-bold border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              >
                + Escalar Reserva no TL1
              </Button>
            ))}
          <Badge
            className={`text-[10px] font-bold px-2.5 py-1 tracking-wider ${statusConfig.badgeClass}`}
          >
            {statusConfig.label}
          </Badge>
          {car.pitRequested && isCarOnTrack && car.status !== 'in_lap' && (
            <Badge className="bg-amber-600/30 text-amber-300 border-amber-500/50 text-[9px] font-bold animate-pulse">
              Box Solicitado
            </Badge>
          )}
        </div>
      </div>

      {/* 2. BARRA DE PROGRESSO DA FASE DA VOLTA */}
      {isCarOnTrack && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#8B95A7]">
            <span>Progresso no trecho</span>
            <span className="text-cyan-400 font-bold">
              {Math.round(car.currentLapProgressPct || 0)}%
            </span>
          </div>
          <Progress value={car.currentLapProgressPct || 0} className="h-1.5 bg-[#141B26]" />
        </div>
      )}

      {/* 3. QUADRICULADO DE TELEMETRIA BÁSICA E CONSUMO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        {/* Pneu & Desgaste */}
        <div className="p-2.5 rounded-xl bg-[#0E1521] border border-[#1A2436] space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[#8B95A7]">
            <span className="flex items-center gap-1">
              <Disc className="w-3 h-3 text-amber-400" />
              Pneu
            </span>
            <span
              className={`font-bold ${
                car.tyreWear >= 70
                  ? 'text-red-400'
                  : car.tyreWear >= 45
                    ? 'text-amber-400'
                    : 'text-emerald-400'
              }`}
            >
              {car.tyreWear}%
            </span>
          </div>
          <div className="text-xs font-bold text-white capitalize">
            {formatTireName(car.currentCompound).split(' ')[0]}
          </div>
          <Progress
            value={car.tyreWear}
            className={`h-1 bg-[#141B26] ${
              car.tyreWear >= 70 ? '[&>div]:bg-red-500' : '[&>div]:bg-cyan-500'
            }`}
          />
        </div>

        {/* Combustível */}
        <div className="p-2.5 rounded-xl bg-[#0E1521] border border-[#1A2436] space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[#8B95A7]">
            <span className="flex items-center gap-1">
              <Fuel className="w-3 h-3 text-cyan-400" />
              Combustível
            </span>
            <span className="text-white font-bold">{car.fuelKg} kg</span>
          </div>
          <div className="text-[11px] font-bold text-cyan-300">
            ~{Math.max(0, Math.round(car.fuelKg / 1.65))} voltas
          </div>
          <Progress
            value={Math.min(100, (car.fuelKg / 100) * 100)}
            className="h-1 bg-[#141B26] [&>div]:bg-cyan-400"
          />
        </div>

        {/* Voltas no Stint / Totais */}
        <div className="p-2.5 rounded-xl bg-[#0E1521] border border-[#1A2436] space-y-1">
          <div className="text-[10px] text-[#8B95A7] flex items-center gap-1">
            <Activity className="w-3 h-3 text-purple-400" />
            Voltas
          </div>
          <div className="text-xs font-black text-white">
            {car.lapsInStint}{' '}
            <span className="text-[10px] text-[#8B95A7] font-normal">no stint</span>
          </div>
          <div className="text-[10px] text-[#8B95A7]">
            Total: <span className="text-white font-bold">{car.totalLaps}</span>
          </div>
        </div>

        {/* Melhor / Última Volta */}
        <div className="p-2.5 rounded-xl bg-[#0E1521] border border-[#1A2436] space-y-1">
          <div className="text-[10px] text-[#8B95A7] flex items-center gap-1">
            <Gauge className="w-3 h-3 text-emerald-400" />
            Melhor Marca
          </div>
          <div className="text-xs font-black text-emerald-400">
            {car.bestLapTime || '--:--.---'}
          </div>
          <div className="text-[10px] text-[#8B95A7]">
            Última: <span className="text-white font-mono">{car.lastLapTime || '--:--.---'}</span>
          </div>
        </div>
      </div>

      {/* 4. SETUP DO CARRO & CONHECIMENTO CONSOLIDADO DA EQUIPE */}
      <div className="p-3 rounded-xl bg-[#0E1521]/60 border border-[#1A2436] space-y-2 text-[11px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[#8B95A7]">
            <Wrench className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-white">Setup Atual:</span>
            <span>Asa D: {car.setup.frontWing}</span>
            <span>• Asa T: {car.setup.rearWing}</span>
            <span>• Susp: {car.setup.suspension}</span>
            <span>• Dif: {car.setup.differential}%</span>
          </div>
          <div className="text-[10px] text-[#8B95A7] flex items-center gap-1">
            <span>Confiança global:</span>
            {formatConfidenceBadge(knowledge?.overallConfidence || 'baixa')}
          </div>
        </div>

        {/* Faixas Conhecidas Aprendidas Progressivamente */}
        <div className="pt-1.5 border-t border-[#141B26] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          {/* Asa Dianteira */}
          <div className="bg-[#141B26]/60 p-2 rounded-lg border border-[#1A2436]/60 flex flex-col justify-between">
            <span className="text-[#8B95A7]">Asa Dianteira</span>
            <div className="font-bold text-white mt-0.5">
              {knowledge?.frontWing.revealed ? (
                <span className="text-cyan-300 font-mono">
                  {knowledge.frontWing.minKnown} – {knowledge.frontWing.maxKnown}
                </span>
              ) : (
                <span className="text-slate-500 font-mono">Faixa: ?</span>
              )}
            </div>
          </div>

          {/* Asa Traseira */}
          <div className="bg-[#141B26]/60 p-2 rounded-lg border border-[#1A2436]/60 flex flex-col justify-between">
            <span className="text-[#8B95A7]">Asa Traseira</span>
            <div className="font-bold text-white mt-0.5">
              {knowledge?.rearWing.revealed ? (
                <span className="text-cyan-300 font-mono">
                  {knowledge.rearWing.minKnown} – {knowledge.rearWing.maxKnown}
                </span>
              ) : (
                <span className="text-slate-500 font-mono">Faixa: ?</span>
              )}
            </div>
          </div>

          {/* Suspensão */}
          <div className="bg-[#141B26]/60 p-2 rounded-lg border border-[#1A2436]/60 flex flex-col justify-between">
            <span className="text-[#8B95A7]">Suspensão</span>
            <div className="font-bold text-white mt-0.5">
              {knowledge?.suspension.revealed ? (
                <span className="text-cyan-300 font-mono">
                  {knowledge.suspension.minKnown} – {knowledge.suspension.maxKnown}
                </span>
              ) : (
                <span className="text-slate-500 font-mono">Faixa: ?</span>
              )}
            </div>
          </div>

          {/* Diferencial */}
          <div className="bg-[#141B26]/60 p-2 rounded-lg border border-[#1A2436]/60 flex flex-col justify-between">
            <span className="text-[#8B95A7]">Diferencial</span>
            <div className="font-bold text-white mt-0.5">
              {knowledge?.differential.revealed ? (
                <span className="text-cyan-300 font-mono">
                  {knowledge.differential.minKnown}% – {knowledge.differential.maxKnown}%
                </span>
              ) : (
                <span className="text-slate-500 font-mono">Faixa: ?</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4.1 PAINEL DE FEEDBACK TÉCNICO DO PILOTO (AO RETORNAR DOS BOXES) */}
      {latestFeedback && (
        <div className="p-3.5 rounded-xl bg-[#0B111C] border border-[#1E293B] space-y-2.5 font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                Feedback Técnico — {car.driverName}
              </span>
              {hasUnreadFeedback && (
                <Badge
                  onClick={onMarkFeedbackRead}
                  className="bg-cyan-500/20 text-cyan-300 border-cyan-400/40 text-[9px] font-black uppercase tracking-wider animate-pulse cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  NOVO FEEDBACK
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowFeedbackDetails(!showFeedbackDetails)
                if (hasUnreadFeedback && onMarkFeedbackRead) onMarkFeedbackRead()
              }}
              className="h-6 w-6 p-0 text-[#8B95A7] hover:text-white"
            >
              {showFeedbackDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          <p className="text-[11px] text-[#BAC4D6] italic bg-[#080C14] p-2.5 rounded-lg border border-[#141C2A]">
            {latestFeedback.generalMessage}
          </p>

          {showFeedbackDetails &&
            latestFeedback.axisFeedbacks &&
            latestFeedback.axisFeedbacks.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {latestFeedback.axisFeedbacks.map((fb) => (
                  <div
                    key={fb.axis}
                    className="p-2 rounded-lg bg-[#0E1521] border border-[#1A2436] flex flex-col gap-1 text-[10px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            fb.direction === 'ok'
                              ? 'bg-emerald-400'
                              : fb.severity === 'alta'
                                ? 'bg-rose-400'
                                : 'bg-amber-400'
                          }`}
                        />
                        {fb.axisLabel}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-[#8B95A7]">
                          Direção:{' '}
                          <strong className="text-white uppercase">
                            {fb.direction === 'increase'
                              ? 'Aumentar'
                              : fb.direction === 'decrease'
                                ? 'Diminuir'
                                : 'Ideal'}
                          </strong>
                        </span>
                        {formatConfidenceBadge(fb.confidence)}
                      </div>
                    </div>
                    <p className="text-[#8B95A7] text-[10px] pl-3">"{fb.message}"</p>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* 5. AÇÕES TÁTICAS DO CARRO («SAIR PARA A PISTA» OU «CHAMAR AOS BOXES») */}
      <div className="flex items-center justify-between gap-3 pt-1">
        {isCarInGarage ? (
          <Button
            type="button"
            disabled={!isSessionRunning || isSessionCompleted || car.fuelKg < 2}
            onClick={onOrderExitTrack}
            className="w-full bg-[#00A6FB] hover:bg-[#0092DC] text-[#090D15] font-black text-xs h-10 shadow-lg flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            SAIR PARA A PISTA
          </Button>
        ) : (
          <Button
            type="button"
            disabled={
              !isSessionRunning || isSessionCompleted || car.pitRequested || car.status === 'in_lap'
            }
            onClick={onRequestBox}
            className="w-full bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-xs h-10 shadow-lg flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {car.pitRequested ? 'BOX SOLICITADO...' : 'CHAMAR AOS BOXES'}
          </Button>
        )}
      </div>
    </Card>
  )
}
