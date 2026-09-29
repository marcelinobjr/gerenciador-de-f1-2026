import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CloudRain, Sun, Wrench, Shield, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import type {
  CanonicalRaceState,
  PendingWeatherDecisionState,
  DriverWeatherDecisionItem,
  WeatherDecisionAction,
} from '@/types/canonical-race-v2'
import type { TireCompound } from '@/types/f1'

export interface CanonicalWeatherDecisionModalProps {
  raceState: CanonicalRaceState
  onSubmitDecision?: (
    driverId: string,
    action: WeatherDecisionAction,
    selectedCompound?: TireCompound,
  ) =>
    | Promise<{ success: boolean; error?: string } | void>
    | { success: boolean; error?: string }
    | void
}

export const CanonicalWeatherDecisionModal: React.FC<CanonicalWeatherDecisionModalProps> = ({
  raceState,
  onSubmitDecision,
}) => {
  const pending = raceState.pendingWeatherDecision
  const isOpen =
    raceState.status === 'awaiting_player_weather_decision' &&
    !!pending &&
    pending.active === true &&
    pending.drivers.some((d) => d.status === 'pending')

  // Estado local por carro para seleção do composto antes do PIT_NOW
  const [selectedCompounds, setSelectedCompounds] = useState<Record<string, TireCompound>>({})
  // Controle de loading individual por carro para prevenir duplo clique
  const [submittingCar, setSubmittingCar] = useState<Record<string, boolean>>({})
  // Mensagem de erro local por carro
  const [carErrors, setCarErrors] = useState<Record<string, string | null>>({})

  if (!isOpen || !pending) {
    return null
  }

  const isDryToWet = pending.transition === 'DRY_TO_WET'

  // Compostos permitidos estritamente segundo as regras canônicas do backend E1A
  const availableCompounds: Array<{
    id: TireCompound
    name: string
    color: string
    border: string
    badgeColor: string
  }> = isDryToWet
    ? [
        {
          id: 'intermediario',
          name: 'Intermediário',
          color: 'bg-emerald-500/20 text-emerald-300',
          border: 'border-emerald-500/50',
          badgeColor: 'bg-emerald-600',
        },
        {
          id: 'chuva_extrema',
          name: 'Chuva Extrema',
          color: 'bg-blue-600/20 text-blue-300',
          border: 'border-blue-500/50',
          badgeColor: 'bg-blue-600',
        },
      ]
    : [
        {
          id: 'macio',
          name: 'Macio (C4)',
          color: 'bg-red-500/20 text-red-300',
          border: 'border-red-500/50',
          badgeColor: 'bg-red-600',
        },
        {
          id: 'medio',
          name: 'Médio (C3)',
          color: 'bg-yellow-500/20 text-yellow-300',
          border: 'border-yellow-500/50',
          badgeColor: 'bg-yellow-500 text-black',
        },
        {
          id: 'duro',
          name: 'Duro (C1)',
          color: 'bg-slate-200/20 text-slate-200',
          border: 'border-slate-400/50',
          badgeColor: 'bg-white text-black',
        },
      ]

  const formatConditionName = (cond: string | undefined): string => {
    if (!cond) return 'SECO'
    switch (cond) {
      case 'seco':
        return 'SECO'
      case 'chuva_fraca':
        return 'CHUVA FRACA'
      case 'chuva_forte':
        return 'CHUVA FORTE'
      case 'umido':
        return 'ÚMIDO'
      default:
        return cond.toUpperCase().replace('_', ' ')
    }
  }

  const weatherBeforeLabel = formatConditionName(pending.weatherBefore)
  const weatherAfterLabel = formatConditionName(pending.weatherAfter)

  const handleSelectCompound = (driverId: string, compound: TireCompound) => {
    setSelectedCompounds((prev) => ({
      ...prev,
      [driverId]: compound,
    }))
    setCarErrors((prev) => ({ ...prev, [driverId]: null }))
  }

  const handleSubmit = async (
    driverId: string,
    action: WeatherDecisionAction,
    compound?: TireCompound,
  ) => {
    if (!onSubmitDecision) return
    if (submittingCar[driverId]) return

    setSubmittingCar((prev) => ({ ...prev, [driverId]: true }))
    setCarErrors((prev) => ({ ...prev, [driverId]: null }))

    try {
      const res = await onSubmitDecision(driverId, action, compound)
      if (res && res.success === false && res.error) {
        setCarErrors((prev) => ({ ...prev, [driverId]: res.error || 'Falha ao aplicar decisão.' }))
      }
    } catch (err: any) {
      setCarErrors((prev) => ({
        ...prev,
        [driverId]: err?.message || 'Erro inesperado ao enviar decisão.',
      }))
    } finally {
      setSubmittingCar((prev) => ({ ...prev, [driverId]: false }))
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="bg-[#090D15]/98 backdrop-blur-md border border-cyan-500/60 text-white max-w-2xl sm:max-w-3xl p-6 shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* CABEÇALHO */}
        <DialogHeader className="space-y-2 border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-wider font-bold">
              {isDryToWet ? (
                <CloudRain className="w-5 h-5 text-sky-400 animate-bounce" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400 animate-spin" />
              )}
              MUDANÇA DE CLIMA
            </div>
            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/50 font-mono text-xs animate-pulse">
              ⏸️ CORRIDA PARALISADA • DECISÃO OBRIGATÓRIA
            </Badge>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-black text-white flex flex-wrap items-center justify-between gap-2">
            <span>Condições da pista mudaram</span>
            <Badge className="bg-slate-800 text-slate-200 border-slate-700 text-xs font-mono">
              Volta {raceState.currentLap} de {raceState.totalLaps}
            </Badge>
          </DialogTitle>

          <DialogDescription className="text-xs sm:text-sm text-slate-300">
            A pista teve uma alteração meteorológica em tempo real.{' '}
            <strong className="text-white">
              {weatherBeforeLabel} → {weatherAfterLabel}
            </strong>
            {pending.rainIntensity && (
              <span className="ml-1.5 font-mono text-cyan-300 text-xs">
                (Intensidade: {pending.rainIntensity})
              </span>
            )}
            . Defina a estratégia independente para cada um dos seus pilotos abaixo antes de retomar
            a corrida.
          </DialogDescription>
        </DialogHeader>

        {/* DECISÃO POR PILOTO */}
        <div className="space-y-4 pt-2">
          {pending.drivers.map((driverDecision, index) => {
            const driverObj = raceState.drivers.find((d) => d.driverId === driverDecision.driverId)
            const driverName =
              driverDecision.driverName || driverObj?.driverName || driverDecision.driverId
            const slotName =
              driverDecision.carSlot === 'car1'
                ? 'Carro 1'
                : driverDecision.carSlot === 'car2'
                  ? 'Carro 2'
                  : `Carro ${index + 1}`
            const currentPosition = driverObj?.currentPosition ?? '—'
            const currentCompound = driverDecision.currentCompound || driverObj?.tyreCompound || '—'
            const tyreAge = driverDecision.tyreAge ?? driverObj?.tyreAge ?? 0
            const isDecided = driverDecision.status === 'decided'
            const isSubmitting = !!submittingCar[driverDecision.driverId]
            const carError = carErrors[driverDecision.driverId]
            const selectedCompound = selectedCompounds[driverDecision.driverId]

            return (
              <div
                key={driverDecision.driverId}
                data-testid={`weather-decision-card-${driverDecision.driverId}`}
                className={`p-4 rounded-xl border transition-all ${
                  isDecided
                    ? 'bg-slate-950/60 border-slate-800 text-slate-300'
                    : 'bg-[#0F172A] border-slate-700 shadow-md text-white'
                }`}
              >
                {/* Informações do Piloto e Carro */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-[10px] font-black uppercase ${
                        isDecided ? 'bg-slate-800 text-slate-400' : 'bg-[#E10600] text-white'
                      }`}
                    >
                      {slotName}
                    </Badge>
                    <span className="font-extrabold text-sm text-white">{driverName}</span>
                    <Badge
                      variant="outline"
                      className="text-amber-400 border-amber-400/40 text-[10px] font-mono"
                    >
                      P{currentPosition}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 text-[11px]">Pneu Atual:</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold uppercase text-slate-200 border-slate-600"
                      >
                        {currentCompound}
                      </Badge>
                      <span className="text-slate-400 text-[11px]">({tyreAge}v)</span>
                    </div>
                    <div className="hidden sm:block text-slate-500">•</div>
                    <div className="hidden sm:block text-slate-300 text-[11px]">
                      Pista: <strong className="text-cyan-300">{weatherAfterLabel}</strong>
                    </div>
                  </div>
                </div>

                {/* Exibição se Já Decidido */}
                {isDecided ? (
                  <div className="pt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="font-bold text-xs text-emerald-400">
                        {driverDecision.action === 'PIT_NOW'
                          ? `Pit programado — ${(driverDecision.selectedCompound || 'NOVO').toUpperCase()}`
                          : 'Permanecerá na pista (Stay Out)'}
                      </span>
                    </div>
                    <Badge className="bg-emerald-950/40 text-emerald-300 border border-emerald-700/50 text-[10px]">
                      Decisão Concluída
                    </Badge>
                  </div>
                ) : (
                  /* Painel de Ações se Pendente */
                  <div className="pt-3 space-y-3">
                    {carError && (
                      <div className="p-2 rounded bg-red-950/60 border border-red-700/60 text-red-200 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{carError}</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-bold">
                          Escolha a estratégia deste carro:
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {isDryToWet ? 'Condição molhada' : 'Pista seca'}
                        </span>
                      </div>

                      {/* Botões de Ação Principal */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* CONTINUAR NA PISTA */}
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isSubmitting}
                          onClick={() => handleSubmit(driverDecision.driverId, 'STAY_OUT')}
                          className="h-10 text-xs font-bold bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 gap-1.5"
                          data-testid={`stay-out-btn-${driverDecision.driverId}`}
                        >
                          {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          ) : (
                            <Shield className="w-4 h-4 text-cyan-400" />
                          )}
                          CONTINUAR NA PISTA
                        </Button>

                        {/* PARAR AGORA - SELEÇÃO DO COMPOSTO */}
                        <div className="space-y-2">
                          <span className="block text-[11px] font-bold text-slate-400 sm:hidden">
                            Ou parar para trocar pneus:
                          </span>
                        </div>
                      </div>

                      {/* SELEÇÃO DE COMPOSTOS PARA PIT NOW */}
                      <div className="pt-2 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-bold flex items-center gap-1.5">
                            <Wrench className="w-3.5 h-3.5 text-amber-400" />
                            PARAR AGORA — Selecione o composto:
                          </span>
                          {selectedCompound && (
                            <span className="text-[11px] font-mono text-emerald-400">
                              Selecionado: {selectedCompound.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {availableCompounds.map((comp) => {
                            const isPicked = selectedCompound === comp.id
                            return (
                              <button
                                key={comp.id}
                                type="button"
                                disabled={isSubmitting}
                                onClick={() =>
                                  handleSelectCompound(driverDecision.driverId, comp.id)
                                }
                                data-testid={`compound-btn-${driverDecision.driverId}-${comp.id}`}
                                className={`p-2 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-2 ${
                                  isPicked
                                    ? `${comp.color} ${comp.border} ring-2 ring-white/30 shadow-md font-extrabold`
                                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                              >
                                <span className={`w-2.5 h-2.5 rounded-full ${comp.badgeColor}`} />
                                {comp.name}
                              </button>
                            )
                          })}
                        </div>

                        {/* Botão de Confirmação do PIT_NOW */}
                        <Button
                          type="button"
                          disabled={!selectedCompound || isSubmitting}
                          onClick={() =>
                            handleSubmit(driverDecision.driverId, 'PIT_NOW', selectedCompound)
                          }
                          data-testid={`confirm-pit-btn-${driverDecision.driverId}`}
                          className={`w-full h-9 text-xs font-black gap-1.5 uppercase transition-all ${
                            selectedCompound && !isSubmitting
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                          }`}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Confirmando Pit...
                            </>
                          ) : (
                            <>
                              <Wrench className="w-3.5 h-3.5" />
                              {selectedCompound
                                ? `PARAR AGORA COM ${selectedCompound.toUpperCase()}`
                                : 'Selecione um composto para PARAR AGORA'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* NOTA DE RODAPÉ DE REGRAS ESPORTIVAS */}
        <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800">
          <span>Decisões 100% canônicas via Race Engine</span>
          <span className="font-mono text-slate-500">
            Avanço da corrida liberado assim que todos os carros decidirem
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
