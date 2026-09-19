import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Users,
  Send,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Shield,
  ArrowRight,
  Info,
} from 'lucide-react'
import type { DriverModel, TeamModel } from '@/types/f1'
import type { SimDriverEntry } from '@/pages/race/types'
import type { TeamOrderType, TeamOrderReason, RaceReactionType } from '@/types/race-interactions'
import { driverRaceInteractionService } from '@/services/driverRaceInteractionService'

export interface TeamActionExecutionResult {
  orderId: string
  lap: number
  targetDriverId: string
  targetDriverName: string
  teammateId: string
  teammateName: string
  orderType: TeamOrderType
  reason: TeamOrderReason
  reactionType: RaceReactionType
  actionApplied: boolean
  radioMessageText: string
  timestamp: string
}

interface TeamActionsCardProps {
  drivers: DriverModel[]
  grid: SimDriverEntry[]
  currentLap: number
  round: number
  season: number
  team: TeamModel | null
  onExecuteOrder: (result: TeamActionExecutionResult) => void
  lastOrderResult?: TeamActionExecutionResult | null
}

export const TeamActionsCard: React.FC<TeamActionsCardProps> = ({
  drivers,
  grid,
  currentLap,
  round,
  season,
  team,
  onExecuteOrder,
  lastOrderResult,
}) => {
  const playerCars = grid.filter((g) => g.isPlayer)
  const d1 = playerCars[0] || null
  const d2 = playerCars[1] || null

  const [selectedTargetDriverId, setSelectedTargetDriverId] = useState<string>(d1?.driverId || '')
  const [selectedOrderType, setSelectedOrderType] = useState<TeamOrderType>('LET_TEAMMATE_PASS')
  const [selectedReason, setSelectedReason] = useState<TeamOrderReason>('FASTER_TEAMMATE')
  const [isSending, setIsSending] = useState(false)

  // Atualiza seleção se d1 mudar e target vazio
  React.useEffect(() => {
    if (!selectedTargetDriverId && d1) {
      setSelectedTargetDriverId(d1.driverId)
    }
  }, [d1, selectedTargetDriverId])

  const targetCar = playerCars.find((c) => c.driverId === selectedTargetDriverId) || d1
  const teammateCar = playerCars.find((c) => c.driverId !== targetCar?.driverId) || d2

  const targetDriverModel = drivers.find((d) => d.id === targetCar?.driverId) || null
  const teammateDriverModel = drivers.find((d) => d.id === teammateCar?.driverId) || null

  const handleSendOrder = () => {
    if (!targetCar || !teammateCar || !targetDriverModel) return
    setIsSending(true)

    try {
      const payload = {
        orderId: `to_action_${Date.now()}_${targetCar.driverId}`,
        orderType: selectedOrderType,
        targetDriverId: targetCar.driverId,
        teammateId: teammateCar.driverId,
        reason: selectedReason,
        lap: currentLap,
        round,
        season,
      }

      const evalResult = driverRaceInteractionService.evaluateTeamOrder(
        payload,
        {
          driverId: targetCar.driverId,
          driverName: targetCar.driverName,
          teamId: targetCar.teamId,
          teamName: targetCar.teamName,
          isPlayerTeam: true,
          round,
          season,
          circuitId: 'current',
          currentLap,
          totalLaps: 50,
          position: targetCar.position,
          gridTotal: grid.length,
          teammateId: teammateCar.driverId,
          teammateName: teammateCar.driverName,
          teammatePosition: teammateCar.position,
          gapToTeammateSec: 1.2,
          isTeammateAhead: teammateCar.position < targetCar.position,
          tireCompound: targetCar.tireCompound || 'medio',
          tireWear: targetCar.tireWear || 10,
          isInCliff: false,
          weatherState: 'seco',
        },
        targetDriverModel,
        team,
        teammateDriverModel,
      )

      const executionResult: TeamActionExecutionResult = {
        orderId: evalResult.interactionId,
        lap: currentLap,
        targetDriverId: targetCar.driverId,
        targetDriverName: targetCar.driverName,
        teammateId: teammateCar.driverId,
        teammateName: teammateCar.driverName,
        orderType: selectedOrderType,
        reason: selectedReason,
        reactionType: evalResult.reactionType,
        actionApplied: evalResult.actionApplied,
        radioMessageText: evalResult.radioMessageText,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      }

      onExecuteOrder(executionResult)
    } catch (err) {
      console.error('Erro ao emitir ordem de equipe:', err)
    } finally {
      setIsSending(false)
    }
  }

  const reactionLabels: Record<RaceReactionType, { label: string; badge: string; icon: any }> = {
    ACCEPT: {
      label: 'Ordem Aceita',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: CheckCircle,
    },
    ACCEPT_RELUCTANTLY: {
      label: 'Aceita com Relutância',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: HelpCircle,
    },
    QUESTION: {
      label: 'Ordem Questionada',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: HelpCircle,
    },
    RESIST: {
      label: 'Resistência ao Comando',
      badge: 'bg-orange-100 text-orange-800 border-orange-300',
      icon: AlertCircle,
    },
    REFUSE: {
      label: 'Ordem Recusada',
      badge: 'bg-red-100 text-red-800 border-red-300',
      icon: AlertCircle,
    },
  }

  return (
    <Card className="bg-white border border-slate-200/90 shadow-xs rounded-xl overflow-hidden">
      <CardHeader className="py-2.5 px-3.5 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-3.5 rounded-full bg-[#E10600]" />
          <div>
            <CardTitle className="text-xs font-black text-slate-900 tracking-wider uppercase">
              Ações de Equipe (Team Orders)
            </CardTitle>
            <p className="text-[10px] text-slate-500">
              Instruções táticas oficiais entre os dois carros da escuderia
            </p>
          </div>
        </div>
        <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-mono font-bold">
          Volta {currentLap}
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-3.5 text-xs">
        {/* 1. SELETOR DE DESTINATÁRIO EXPLÍCITO */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 block">
            Destinatário da Ordem:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {playerCars.map((car, idx) => {
              const isSelected = targetCar?.driverId === car.driverId
              const otherCar = playerCars.find((c) => c.driverId !== car.driverId)

              return (
                <button
                  key={car.driverId}
                  type="button"
                  onClick={() => setSelectedTargetDriverId(car.driverId)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-[#E10600] bg-red-50/60 shadow-xs'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      {car.driverName} (Carro {idx + 1})
                    </span>
                    <Badge variant="outline" className="text-[9px] border-slate-300 text-slate-600">
                      P{car.position}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Beneficiado: <strong>{otherCar?.driverName || 'Companheiro'}</strong>
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. TIPO DE ORDEM & JUSTIFICATIVA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block">Comando Canônico:</label>
            <select
              value={selectedOrderType}
              onChange={(e) => setSelectedOrderType(e.target.value as TeamOrderType)}
              className="w-full text-xs bg-white border border-slate-200 rounded-md p-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="LET_TEAMMATE_PASS">Deixar Companheiro Passar</option>
              <option value="HOLD_POSITION">Manter Posição Atual</option>
              <option value="DO_NOT_FIGHT">Não Disputar Entre Si</option>
              <option value="ATTACK">Modo de Ataque</option>
              <option value="PUSH">Empurrar Ritmo</option>
              <option value="MANAGE_TYRES">Gerenciar Pneus</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block">
              Justificativa Técnica:
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value as TeamOrderReason)}
              className="w-full text-xs bg-white border border-slate-200 rounded-md p-2 text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="FASTER_TEAMMATE">Companheiro Mais Rápido</option>
              <option value="DIFFERENT_STRATEGY">Estratégias Diferentes</option>
              <option value="TYRE_OFFSET">Diferença de Pneus/Desgaste</option>
              <option value="TEAM_RESULT">Resultado da Equipe</option>
              <option value="CHAMPIONSHIP_PRIORITY">Prioridade no Campeonato</option>
              <option value="TECHNICAL_PRESERVATION">Preservação do Carro</option>
            </select>
          </div>
        </div>

        {/* AVISO QUALITATIVO DE IMPACTO NA RELAÇÃO */}
        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold leading-tight">Impacto Psicológico & Relacionamento</p>
            <p className="text-[10px] text-amber-800 mt-0.5 leading-snug">
              A resposta do piloto dependerá de sua personalidade, moral atual e status contratual.
              Ordens desfavoráveis podem gerar atrito e questionamentos no rádio.
            </p>
          </div>
        </div>

        {/* BOTÃO DE TRANSMISSÃO */}
        <Button
          size="sm"
          onClick={handleSendOrder}
          disabled={isSending || !targetCar || targetCar.dnf}
          className="w-full bg-[#E10600] hover:bg-[#C10500] text-white font-bold text-xs flex items-center justify-center gap-1.5 h-9 shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          {isSending
            ? 'Transmitindo Ordem...'
            : `Transmitir Ordem a ${targetCar?.driverName || 'Piloto'}`}
        </Button>

        {/* ÚLTIMO RESULTADO REAL DA INTERAÇÃO DE RÁDIO */}
        {lastOrderResult && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-[11px]">
                Última Resposta de Rádio:
              </span>
              {(() => {
                const badgeInfo =
                  reactionLabels[lastOrderResult.reactionType] || reactionLabels.ACCEPT
                const IconComponent = badgeInfo.icon
                return (
                  <Badge
                    className={`text-[10px] font-semibold border flex items-center gap-1 ${badgeInfo.badge}`}
                  >
                    <IconComponent className="w-3 h-3" />
                    {badgeInfo.label}
                  </Badge>
                )
              })()}
            </div>

            <p className="text-xs text-slate-800 italic bg-white p-2 rounded border border-slate-200 font-mono">
              "{lastOrderResult.radioMessageText}"
            </p>

            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
              <span>
                Transmissão às {lastOrderResult.timestamp} (V{lastOrderResult.lap})
              </span>
              <span>
                Status:{' '}
                <strong
                  className={lastOrderResult.actionApplied ? 'text-emerald-600' : 'text-red-600'}
                >
                  {lastOrderResult.actionApplied ? 'Ordem em Execução' : 'Comando Rejeitado'}
                </strong>
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
