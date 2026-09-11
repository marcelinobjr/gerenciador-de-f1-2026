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
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  CloudRain,
  AlertTriangle,
  ShieldAlert,
  Wrench,
  Clock,
  Flag,
  ArrowDownCircle,
  AlertCircle,
} from 'lucide-react'
import { TireCompound, TireAllotment, TireSetItem } from '@/types/f1'
import { TrackWeatherState, TIRE_SPECS } from '@/lib/f1-tire-system'

export interface DecisionDriverContext {
  driverId: string
  driverName?: string
  teamName?: string
  teamColor?: string
  isPlayer?: boolean
  position: number
  tireCompound?: TireCompound
  tireWear?: number
  pitStopsDone?: number
  hasWingDamage?: boolean
  brokenPartsCount?: number
  brokenPartsNames?: string[]
}

export interface DecisionModalsProps {
  // 1. Chuva
  rainDecisionOpen: boolean
  liveRaceWeather?: TrackWeatherState
  weather?: TrackWeatherState
  currentLap?: number
  totalLaps?: number
  circuitName?: string
  rainActiveDriver?: DecisionDriverContext | null
  rainQueueLength?: number
  rainQueueTotal?: number
  rainQueue?: any[]
  rainDecisionWaitLaps: number
  setRainDecisionWaitLaps: (laps: number) => void
  tireStock: TireAllotment
  formatTireName: (c?: TireCompound) => string
  onConfirmRainDecision: (
    decision: 'intermediario' | 'chuva_extrema' | 'macio' | 'medio' | 'duro' | 'aguardar',
  ) => void

  // 2. Dano de asa
  wingDamageModalOpen: boolean
  setWingDamageModalOpen: (open: boolean) => void
  wingDamageDriver: DecisionDriverContext | null
  wingDamageTireChoice: TireCompound
  setWingDamageTireChoice: (c: TireCompound) => void
  onConfirmWingDamageDecision: (decision: 'pit_trocar' | 'continuar') => void

  // 3. Safety Car
  safetyCarModalOpen: boolean
  safetyCarReason: string
  safetyCarActiveDriver?: DecisionDriverContext | null
  safetyCarQueueLength?: number
  safetyCarQueueTotal?: number
  safetyCarQueue?: any[]
  safetyCarTireChoice: TireCompound
  setSafetyCarTireChoice: (c: TireCompound) => void
  onConfirmSafetyCarDecision: (decision: 'pit_sc' | 'stay_out') => void

  // 4. Box manual
  forcePitModalOpen: boolean
  onCloseForcePitModal: () => void
  activePlayerDrivers: DecisionDriverContext[]
  forcePitSelectedDriverId: string
  setForcePitSelectedDriverId: (id: string) => void
  availableForcePitSets: TireSetItem[]
  forcePitSelectedSetId: string
  setForcePitSelectedSetId: (id: string) => void
  repairWingOption?: boolean
  setRepairWingOption?: (val: boolean) => void
  repairPartsOption?: boolean
  setRepairPartsOption?: (val: boolean) => void
  teamChassisLevel?: number
  onExecuteForcedPitStop: () => void
}

export function DecisionModals({
  rainDecisionOpen,
  liveRaceWeather,
  weather,
  currentLap = 1,
  totalLaps = 50,
  circuitName = 'Circuito',
  rainActiveDriver,
  rainQueueLength,
  rainQueueTotal,
  rainQueue,
  rainDecisionWaitLaps,
  setRainDecisionWaitLaps,
  tireStock,
  formatTireName,
  onConfirmRainDecision,

  wingDamageModalOpen,
  setWingDamageModalOpen,
  wingDamageDriver,
  wingDamageTireChoice,
  setWingDamageTireChoice,
  onConfirmWingDamageDecision,

  safetyCarModalOpen,
  safetyCarReason,
  safetyCarActiveDriver,
  safetyCarQueueLength,
  safetyCarQueueTotal,
  safetyCarQueue,
  safetyCarTireChoice,
  setSafetyCarTireChoice,
  onConfirmSafetyCarDecision,

  forcePitModalOpen,
  onCloseForcePitModal,
  activePlayerDrivers,
  forcePitSelectedDriverId,
  setForcePitSelectedDriverId,
  availableForcePitSets,
  forcePitSelectedSetId,
  setForcePitSelectedSetId,
  repairWingOption = false,
  setRepairWingOption,
  repairPartsOption = false,
  setRepairPartsOption,
  teamChassisLevel = 75,
  onExecuteForcedPitStop,
}: DecisionModalsProps) {
  const effectiveWeather = liveRaceWeather || weather || 'seco'
  const effectiveRainTotal = rainQueueTotal ?? (rainQueue ? rainQueue.length : 1)
  const effectiveRainLength = rainQueueLength ?? (rainQueue ? rainQueue.length : 1)
  const rainStep = Math.max(1, effectiveRainTotal - effectiveRainLength + 1)

  const effectiveScTotal = safetyCarQueueTotal ?? (safetyCarQueue ? safetyCarQueue.length : 1)
  const effectiveScLength = safetyCarQueueLength ?? (safetyCarQueue ? safetyCarQueue.length : 1)
  const scStep = Math.max(1, effectiveScTotal - effectiveScLength + 1)

  const compoundColorMap: Record<TireCompound, string> = {
    macio: '#E10600',
    medio: '#FACC15',
    duro: '#FFFFFF',
    intermediario: '#10B981',
    chuva_extrema: '#3B82F6',
  }

  return (
    <>
      {/* 1. DIÁLOGO / MODAL DE DECISÃO ESTRATÉGICA DE CHUVA */}
      <Dialog open={rainDecisionOpen} onOpenChange={() => {}}>
        <DialogContent
          className="bg-[#090D15]/95 backdrop-blur-md border border-sky-500/70 text-[#F5F7FA] max-w-xl sm:max-w-2xl p-6 shadow-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-2 border-b border-[#1F2733] pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-400 font-mono text-xs uppercase tracking-wider font-bold">
                <CloudRain className="w-5 h-5 animate-bounce" />
                Alerta Meteorológico FIA • Decisão de Chuva
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-xs animate-pulse">
                ⏸️ CORRIDA CONGELADA
              </Badge>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-[#F5F7FA] flex items-center justify-between">
              <span>
                {effectiveWeather === 'chuva_forte'
                  ? '⛈️ Tempestade / Chuva Forte na Corrida!'
                  : effectiveWeather === 'chuva_fraca'
                    ? '🌧️ Chuva Fraca / Moderada na Pista!'
                    : '☀️ Pista Secando / Sol na Pista!'}
              </span>
              <Badge className="bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-mono">
                Volta {currentLap} de {totalLaps}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-[#8B95A7]">
              Condição avaliada em <strong>{circuitName}</strong>:{' '}
              {effectiveWeather === 'chuva_forte' ? (
                <span className="text-blue-400 font-bold">
                  CHUVA FORTE (Lâmina d'água espessa — pneus de Chuva Extrema obrigatórios para
                  evitar aquaplanagem).
                </span>
              ) : effectiveWeather === 'chuva_fraca' ? (
                <span className="text-emerald-400 font-bold">
                  CHUVA FRACA / INTERMEDIÁRIA (Asfalto úmido — pneu Intermediário é a escolha
                  ideal).
                </span>
              ) : (
                <span className="text-amber-400 font-bold">
                  PISTA SECA (A chuva cessou — hora de calçar pneus Slicks Macio/Médio/Duro).
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Destaque do Carro / Piloto Ativo na Fila */}
          {rainActiveDriver && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-950/40 via-[#0B0E14] to-[#161D29] border border-sky-500/40 space-y-2 font-mono">
              <div className="flex items-center justify-between">
                <Badge className="bg-sky-500/20 text-sky-300 border border-sky-400/40 text-[11px] font-bold">
                  DECISÃO {rainStep} DE {effectiveRainTotal}
                </Badge>
                <span className="text-xs text-[#8B95A7]">
                  Decisão 100% individual para este carro
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div>
                  <span className="text-[#8B95A7] block text-[10px]">Piloto:</span>
                  <strong className="text-white text-sm">
                    {rainActiveDriver.driverName || 'Piloto'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#8B95A7] block text-[10px]">Posição Atual:</span>
                  <strong className="text-amber-400">P{rainActiveDriver.position}</strong>
                </div>
                <div>
                  <span className="text-[#8B95A7] block text-[10px]">Pneu Atual:</span>
                  <strong className="text-cyan-300 capitalize">
                    {formatTireName(rainActiveDriver.tireCompound)}
                  </strong>
                </div>
                <div>
                  <span className="text-[#8B95A7] block text-[10px]">Desgaste:</span>
                  <strong className="text-amber-300">{rainActiveDriver.tireWear || 0}%</strong>
                </div>
              </div>
            </div>
          )}

          {/* Context Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-xs font-mono">
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Intensidade Climática:</span>
              <strong className="text-sky-400 font-semibold flex items-center gap-1.5 mt-0.5">
                <CloudRain className="w-4 h-4" />{' '}
                {effectiveWeather === 'chuva_forte'
                  ? 'Tempestade / Chuva Forte'
                  : effectiveWeather === 'chuva_fraca'
                    ? 'Chuva Fraca / Moderada'
                    : 'Pista Seca'}
              </strong>
            </div>
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Recomendação da Engenharia:</span>
              <strong className="text-amber-400 font-semibold block mt-0.5">
                {effectiveWeather === 'chuva_forte'
                  ? 'Colocar Chuva Extrema (Intermediário aquaplana +32% risco)'
                  : effectiveWeather === 'chuva_fraca'
                    ? 'Colocar Intermediários (Extrema sobreaquece e perde 2.7s)'
                    : 'Colocar Pneus Slicks (Médio / Duro)'}
              </strong>
            </div>
          </div>

          {/* Options Grid */}
          <div className="space-y-3 pt-1">
            {effectiveWeather === 'seco' ? (
              <>
                {/* Médio */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    tireStock.medio > 0
                      ? 'bg-[#161D29]/60 border-amber-500/40 hover:border-amber-500 hover:bg-[#161D29]'
                      : 'bg-[#161D29]/20 border-red-900/40 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-yellow-400 ring-2 ring-yellow-500 inline-block" />
                        <h4 className="font-bold text-sm text-[#F5F7FA]">
                          Trocar para MÉDIO (Amarelo) — Equilíbrio Perfeito
                        </h4>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono border-yellow-500/40 text-yellow-400"
                        >
                          Estoque: {tireStock.medio} jogo(s)
                        </Badge>
                      </div>
                      <p className="text-xs text-[#8B95A7]">
                        Composto de pista seca ideal para ritmo consistente e boa durabilidade
                        pós-chuva.
                      </p>
                    </div>
                    <Button
                      onClick={() => onConfirmRainDecision('medio')}
                      disabled={tireStock.medio <= 0}
                      className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs h-9 px-4 shrink-0"
                    >
                      {tireStock.medio > 0 ? 'Colocar Médios' : 'Esgotado'}
                    </Button>
                  </div>
                </div>

                {/* Duro */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    tireStock.duro > 0
                      ? 'bg-[#161D29]/60 border-slate-400/40 hover:border-slate-300 hover:bg-[#161D29]'
                      : 'bg-[#161D29]/20 border-red-900/40 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-200 ring-2 ring-slate-400 inline-block" />
                        <h4 className="font-bold text-sm text-[#F5F7FA]">
                          Trocar para DURO (Branco) — Durabilidade Máxima
                        </h4>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono border-slate-500/40 text-slate-300"
                        >
                          Estoque: {tireStock.duro} jogo(s)
                        </Badge>
                      </div>
                      <p className="text-xs text-[#8B95A7]">
                        Ir até o final da corrida sem novas paradas em pista seca.
                      </p>
                    </div>
                    <Button
                      onClick={() => onConfirmRainDecision('duro')}
                      disabled={tireStock.duro <= 0}
                      className="bg-slate-200 hover:bg-white text-black font-bold text-xs h-9 px-4 shrink-0"
                    >
                      {tireStock.duro > 0 ? 'Colocar Duros' : 'Esgotado'}
                    </Button>
                  </div>
                </div>

                {/* Macio */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    tireStock.macio > 0
                      ? 'bg-[#161D29]/60 border-red-500/40 hover:border-red-500 hover:bg-[#161D29]'
                      : 'bg-[#161D29]/20 border-red-900/40 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-600 ring-2 ring-red-700 inline-block" />
                        <h4 className="font-bold text-sm text-[#F5F7FA]">
                          Trocar para MACIO (Vermelho) — Ataque Imediato
                        </h4>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono border-red-500/40 text-red-400"
                        >
                          Estoque: {tireStock.macio} jogo(s)
                        </Badge>
                      </div>
                      <p className="text-xs text-[#8B95A7]">
                        Máxima aderência no pico inicial, mas sensível a superaquecimento no asfalto
                        quente e cliff severo após ~11 voltas.
                      </p>
                    </div>
                    <Button
                      onClick={() => onConfirmRainDecision('macio')}
                      disabled={tireStock.macio <= 0}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs h-9 px-4 shrink-0"
                    >
                      {tireStock.macio > 0 ? 'Colocar Macios' : 'Esgotado'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Intermediários */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    tireStock.intermediario > 0
                      ? 'bg-[#161D29]/60 border-emerald-500/40 hover:border-emerald-500 hover:bg-[#161D29]'
                      : 'bg-[#161D29]/20 border-red-900/40 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-600 inline-block" />
                        <h4 className="font-bold text-sm text-[#F5F7FA]">
                          Opção 1: Trocar para INTERMEDIÁRIOS (Verde)
                        </h4>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            tireStock.intermediario > 0
                              ? 'border-emerald-500/40 text-emerald-400'
                              : 'border-red-500/40 text-red-400'
                          }`}
                        >
                          Estoque: {tireStock.intermediario} jogo(s)
                        </Badge>
                      </div>
                      <p className="text-xs text-[#8B95A7]">
                        Ideal para asfalto molhado moderado ou chuva contínua padrão.
                      </p>
                    </div>
                    <Button
                      onClick={() => onConfirmRainDecision('intermediario')}
                      disabled={tireStock.intermediario <= 0}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 shrink-0"
                    >
                      {tireStock.intermediario > 0 ? 'Colocar Intermediários' : 'Esgotado'}
                    </Button>
                  </div>
                </div>

                {/* Chuva Extrema */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    tireStock.chuva_extrema > 0
                      ? 'bg-[#161D29]/60 border-blue-500/40 hover:border-blue-500 hover:bg-[#161D29]'
                      : 'bg-[#161D29]/20 border-red-900/40 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-600 inline-block" />
                        <h4 className="font-bold text-sm text-[#F5F7FA]">
                          Opção 2: Trocar para CHUVA EXTREMA (Azul)
                        </h4>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            tireStock.chuva_extrema > 0
                              ? 'border-blue-500/40 text-blue-400'
                              : 'border-red-500/40 text-red-400'
                          }`}
                        >
                          Estoque: {tireStock.chuva_extrema} jogo(s)
                        </Badge>
                      </div>
                      <p className="text-xs text-[#8B95A7]">
                        Máxima drenagem de água (85L/segundo). Essencial para tempestades ou poças
                        profundas.
                      </p>
                    </div>
                    <Button
                      onClick={() => onConfirmRainDecision('chuva_extrema')}
                      disabled={tireStock.chuva_extrema <= 0}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs h-9 px-4 shrink-0"
                    >
                      {tireStock.chuva_extrema > 0 ? 'Colocar Chuva Extrema' : 'Esgotado'}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Aguardar */}
            <div className="p-4 rounded-xl border border-amber-500/40 bg-[#161D29]/60 hover:bg-[#161D29] transition-all space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h4 className="font-bold text-sm text-[#F5F7FA]">
                    Opção 3: AGUARDAR X voltas no pneu atual
                  </h4>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-amber-500/40 text-amber-400"
                  >
                    Alto Risco
                  </Badge>
                </div>
                <p className="text-xs text-[#8B95A7]">
                  Manter o carro na pista com os pneus atuais esperando a chuva passar ou SC.
                </p>
              </div>

              <div className="pt-2 border-t border-[#1F2733] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#8B95A7]">Voltas a aguardar na pista:</span>
                    <strong className="text-amber-400 text-sm">
                      {rainDecisionWaitLaps} {rainDecisionWaitLaps === 1 ? 'volta' : 'voltas'}
                    </strong>
                  </div>
                  <Slider
                    value={[rainDecisionWaitLaps]}
                    min={1}
                    max={6}
                    step={1}
                    onValueChange={(val) => setRainDecisionWaitLaps(val[0])}
                    className="py-1"
                  />
                </div>

                <Button
                  onClick={() => onConfirmRainDecision('aguardar')}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs h-9 px-4 shrink-0 sm:self-center"
                >
                  Aguardar {rainDecisionWaitLaps} volta(s)
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. DIÁLOGO DE DECISÃO: TOQUE COM DANO / ASA QUEBRADA */}
      <Dialog open={wingDamageModalOpen} onOpenChange={setWingDamageModalOpen}>
        <DialogContent
          className="bg-[#090D15]/95 backdrop-blur-md border border-red-500/80 text-[#F5F7FA] max-w-xl sm:max-w-2xl p-6 shadow-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-2 border-b border-[#1F2733] pb-4">
            <div className="flex items-center gap-2 text-red-400 font-mono text-xs uppercase tracking-wider font-bold">
              <AlertTriangle className="w-5 h-5 animate-pulse text-red-500" />
              Incidente na Pista • Danos no Monoposto
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-[#F5F7FA] flex items-center justify-between">
              <span>💥 Toque com Dano — Asa Quebrada!</span>
              <Badge className="bg-red-500/20 text-red-300 border border-red-400/40 text-xs font-mono">
                Volta {currentLap} de {totalLaps}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-[#8B95A7]">
              O piloto <strong>{wingDamageDriver?.driverName || 'Piloto'}</strong> sofreu contato
              direto com um adversário e quebrou a placa terminal da asa dianteira.
            </DialogDescription>
          </DialogHeader>

          {/* Context box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-xs font-mono">
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Piloto Afetado:</span>
              <strong className="text-white block mt-0.5">
                {wingDamageDriver?.driverName || 'Piloto'}
              </strong>
            </div>
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Pneu Atual:</span>
              <strong className="text-amber-400 block mt-0.5">
                {formatTireName(wingDamageDriver?.tireCompound)} ({wingDamageDriver?.tireWear}%
                desgaste)
              </strong>
            </div>
            <div>
              <span className="text-[#8B95A7] block text-[11px]">Diagnóstico FIA:</span>
              <strong className="text-red-400 block mt-0.5">
                Perda de ~40% de downforce dianteiro
              </strong>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-[#161D29]/60 hover:bg-[#161D29] transition-all space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-sm text-[#F5F7FA]">
                    Opção 1: BOX IMEDIATO — Trocar Bico e Asa Dianteira
                  </h4>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-emerald-500/40 text-emerald-400"
                  >
                    Recomendado
                  </Badge>
                </div>
                <p className="text-xs text-[#8B95A7]">
                  Chamar o piloto para os boxes imediatamente. Os mecânicos trocam todo o bico
                  dianteiro em ~13.8 segundos e colocam um novo jogo de pneus.
                </p>
              </div>

              <div className="pt-2 border-t border-[#1F2733] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#8B95A7]">Novo jogo de pneus:</span>
                  <select
                    value={wingDamageTireChoice}
                    onChange={(e) => setWingDamageTireChoice(e.target.value as TireCompound)}
                    className="bg-[#0B0E14] border border-[#1F2733] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  >
                    <option value="duro" disabled={tireStock.duro <= 0}>
                      Duro ({tireStock.duro} rest.)
                    </option>
                    <option value="medio" disabled={tireStock.medio <= 0}>
                      Médio ({tireStock.medio} rest.)
                    </option>
                    <option value="macio" disabled={tireStock.macio <= 0}>
                      Macio ({tireStock.macio} rest.)
                    </option>
                    <option value="intermediario" disabled={tireStock.intermediario <= 0}>
                      Intermediário ({tireStock.intermediario} rest.)
                    </option>
                    <option value="chuva_extrema" disabled={tireStock.chuva_extrema <= 0}>
                      Chuva Extrema ({tireStock.chuva_extrema} rest.)
                    </option>
                  </select>
                </div>

                <Button
                  onClick={() => onConfirmWingDamageDecision('pit_trocar')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 shrink-0"
                >
                  Confirmar Pit Stop e Troca de Asa
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-red-500/40 bg-[#161D29]/60 hover:bg-[#161D29] transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-red-400" />
                    <h4 className="font-bold text-sm text-[#F5F7FA]">
                      Opção 2: CONTINUAR NA PISTA — Não parar agora
                    </h4>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-red-500/40 text-red-400"
                    >
                      Extremo Perigo
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8B95A7]">
                    Não para agora, mas perde ~2.5s por volta e risco de abandono (DNF).
                  </p>
                </div>
                <Button
                  onClick={() => onConfirmWingDamageDecision('continuar')}
                  variant="outline"
                  className="border-red-500/60 text-red-300 hover:bg-red-500/20 font-bold text-xs h-9 px-4 shrink-0"
                >
                  Assumir Risco e Ficar na Pista
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. DIÁLOGO DE DECISÃO: SAFETY CAR NA PISTA */}
      <Dialog open={safetyCarModalOpen} onOpenChange={() => {}}>
        <DialogContent
          className="bg-[#090D15]/95 backdrop-blur-md border border-amber-500/80 text-[#F5F7FA] max-w-xl sm:max-w-2xl p-6 shadow-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="space-y-2 border-b border-[#1F2733] pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider font-bold">
                <ShieldAlert className="w-5 h-5 text-amber-400 animate-pulse" />
                Direção de Prova da FIA • Intervenção do Safety Car
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-xs animate-pulse">
                ⏸️ CORRIDA CONGELADA
              </Badge>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-[#F5F7FA] flex items-center justify-between">
              <span>🟡 SAFETY CAR NA PISTA!</span>
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-mono">
                Volta {currentLap} de {totalLaps}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-[#8B95A7]">
              Motivo do SC: <strong>{safetyCarReason || 'Acidente e detritos na pista'}</strong>.
            </DialogDescription>
          </DialogHeader>

          {safetyCarActiveDriver && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-[#0B0E14] to-[#161D29] border border-amber-500/40 space-y-2 font-mono">
              <div className="flex items-center justify-between">
                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[11px] font-bold">
                  DECISÃO {scStep} DE {effectiveScTotal}
                </Badge>
                <span className="text-xs text-[#8B95A7]">
                  Decisão 100% individual para este carro
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div>
                  <span className="text-[#8B95A7] block text-[10px]">Piloto:</span>
                  <strong className="text-white text-sm">
                    {safetyCarActiveDriver.driverName || 'Piloto'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#8B95A7] block text-[10px]">Posição Atual:</span>
                  <strong className="text-amber-400">P{safetyCarActiveDriver.position}</strong>
                </div>
                <div>
                  <span className="text-[#8B95A7] block text-[10px]">Pneu Atual:</span>
                  <strong className="text-cyan-300 capitalize">
                    {formatTireName(safetyCarActiveDriver.tireCompound)}
                  </strong>
                </div>
                <div>
                  <span className="text-[#8B95A7] block text-[10px]">Desgaste:</span>
                  <strong className="text-amber-300">{safetyCarActiveDriver.tireWear || 0}%</strong>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-1">
            <div className="p-4 rounded-xl border border-emerald-500/40 bg-[#161D29]/60 hover:bg-[#161D29] transition-all space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-sm text-[#F5F7FA]">
                    Opção 1: ENTRAR NOS BOXES (Parada Barata sob SC)
                  </h4>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-emerald-500/40 text-emerald-400"
                  >
                    Tática Clássica de F1
                  </Badge>
                </div>
                <p className="text-xs text-[#8B95A7]">
                  Perde apenas ~11s de tempo de volta em vez de ~24s! Relargará com pneus novos.
                </p>
              </div>

              <div className="pt-2 border-t border-[#1F2733] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#8B95A7]">Composto de pneu:</span>
                  <select
                    value={safetyCarTireChoice}
                    onChange={(e) => setSafetyCarTireChoice(e.target.value as TireCompound)}
                    className="bg-[#0B0E14] border border-[#1F2733] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                  >
                    <option value="duro" disabled={tireStock.duro <= 0}>
                      Duro ({tireStock.duro} rest.)
                    </option>
                    <option value="medio" disabled={tireStock.medio <= 0}>
                      Médio ({tireStock.medio} rest.)
                    </option>
                    <option value="macio" disabled={tireStock.macio <= 0}>
                      Macio ({tireStock.macio} rest.)
                    </option>
                    <option value="intermediario" disabled={tireStock.intermediario <= 0}>
                      Intermediário ({tireStock.intermediario} rest.)
                    </option>
                    <option value="chuva_extrema" disabled={tireStock.chuva_extrema <= 0}>
                      Chuva Extrema ({tireStock.chuva_extrema} rest.)
                    </option>
                  </select>
                </div>

                <Button
                  onClick={() => onConfirmSafetyCarDecision('pit_sc')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-4 shrink-0"
                >
                  Fazer Pit Stop sob SC
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-cyan-500/40 bg-[#161D29]/60 hover:bg-[#161D29] transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-bold text-sm text-[#F5F7FA]">
                      Opção 2: FICAR NA PISTA (Priorizar Posição de Pista)
                    </h4>
                  </div>
                  <p className="text-xs text-[#8B95A7]">
                    Não para agora, ganha posições caso rivais à frente entrem nos boxes.
                  </p>
                </div>
                <Button
                  onClick={() => onConfirmSafetyCarDecision('stay_out')}
                  variant="outline"
                  className="border-cyan-500/60 text-cyan-300 hover:bg-cyan-500/20 font-bold text-xs h-9 px-4 shrink-0"
                >
                  Ficar na Pista (Track Position)
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. MODAL DE FORÇAR PIT STOP (PARAR NOS BOXES) */}
      <Dialog
        open={forcePitModalOpen}
        onOpenChange={(open) => {
          if (!open) onCloseForcePitModal()
        }}
      >
        <DialogContent className="bg-[#090D15]/95 backdrop-blur-md border border-amber-500/70 text-[#F5F7FA] max-w-xl sm:max-w-2xl p-6 shadow-2xl">
          <DialogHeader className="space-y-2 border-b border-[#1F2733] pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider font-bold">
                <Wrench className="w-5 h-5 text-amber-400" />
                Comando Imediato do Pit Wall • Parada Manual (BOX)
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-xs animate-pulse">
                ⏸️ CORRIDA CONGELADA
              </Badge>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-[#F5F7FA] flex items-center justify-between">
              <span>🔧 CHAMAR CARRO PARA OS BOXES</span>
              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-mono">
                Volta {currentLap} de {totalLaps}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-[#8B95A7]">
              Ordene a entrada imediata nos boxes nesta volta. Escolha o piloto e o jogo de pneus
              individual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Driver selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-[#8B95A7] block font-bold">
                Selecione o Piloto da Equipe:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activePlayerDrivers.map((driver) => {
                  const isSelected = forcePitSelectedDriverId === driver.driverId
                  return (
                    <button
                      key={driver.driverId}
                      type="button"
                      onClick={() => setForcePitSelectedDriverId(driver.driverId)}
                      className={`p-3 rounded-lg border text-left font-mono transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/15 shadow-sm'
                          : 'border-[#1F2733] bg-[#0B0E14] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-white text-xs">
                          {driver.driverName || 'Piloto'}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-slate-700 text-slate-300 capitalize"
                        >
                          P{driver.position}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[#8B95A7]">
                        <span>Pneu: {formatTireName(driver.tireCompound)}</span>
                        <span
                          className={`font-bold ${
                            (driver.tireWear || 0) > 80
                              ? 'text-red-400'
                              : (driver.tireWear || 0) > 60
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }`}
                        >
                          {driver.tireWear || 10}% desg.
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tire Set Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#8B95A7] font-bold">
                  Escolha o Jogo de Pneus (Estoque do Piloto):
                </span>
                <span className="text-[11px] text-cyan-400">
                  {availableForcePitSets.length} jogos disponíveis
                </span>
              </div>

              <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1 border border-[#1F2733] rounded-lg p-2 bg-[#0B0E14] scrollbar-thin">
                {availableForcePitSets.map((set) => {
                  const isSelected = forcePitSelectedSetId === set.id
                  const spec = TIRE_SPECS[set.compound] || TIRE_SPECS.medio
                  const isUsed = set.wear > 0

                  return (
                    <button
                      key={set.id}
                      type="button"
                      onClick={() => setForcePitSelectedSetId(set.id)}
                      className={`w-full p-2.5 rounded-md border text-left font-mono text-xs transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/20'
                          : 'border-[#1F2733] bg-[#11161F] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: compoundColorMap[set.compound] || '#FFFFFF',
                          }}
                        />
                        <div>
                          <span className="font-bold text-white capitalize">
                            {spec.name} ({set.id.toUpperCase()})
                          </span>
                          <span className="text-[10px] text-[#8B95A7] block">
                            Delta estimado:{' '}
                            {spec.deltaPerLapSec > 0
                              ? `+${spec.deltaPerLapSec}s`
                              : `${spec.deltaPerLapSec}s`}{' '}
                            vs Médio
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge
                          className={`text-[10px] font-mono ${
                            !isUsed
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : set.wear > 50
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          {!isUsed ? 'NOVO 0%' : `USADO (${set.wear}% desg.)`}
                        </Badge>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {set.lapsUsed} voltas rodadas
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Opções de Reparo Mecânico e Estrutural */}
            {(() => {
              const selectedDriver = activePlayerDrivers.find(
                (d) => d.driverId === forcePitSelectedDriverId,
              )
              const hasWingDmg = !!selectedDriver?.hasWingDamage
              const zeroParts = selectedDriver?.brokenPartsCount ?? 0
              const zeroNames = selectedDriver?.brokenPartsNames ?? []

              return (
                <div className="p-3 rounded-lg bg-[#101522] border border-amber-500/40 space-y-2.5 font-mono text-xs">
                  <span className="text-amber-400 font-bold block uppercase text-[11px] flex items-center gap-1.5">
                    <Wrench className="w-4 h-4" /> Serviços Extras de Box & Reparo no Carro:
                  </span>

                  {/* 1. Troca de asa/bico danificado (+8s) */}
                  <label
                    className={`flex items-start gap-2.5 p-2 rounded-md border cursor-pointer transition-all ${
                      repairWingOption
                        ? 'border-amber-400 bg-amber-500/20 text-white'
                        : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7] hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={repairWingOption}
                      onChange={(e) => setRepairWingOption?.(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">
                          Substituir Asa Dianteira / Bico Danificado
                        </span>
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                          +8.0s na parada
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {hasWingDmg
                          ? '⚠️ Asa com danos detectados na corrida! Repara a aerodinâmica e elimina perda de ritmo.'
                          : 'Troca preventiva de bico/asa dianteira.'}
                      </p>
                    </div>
                  </label>

                  {/* 2. Reparar peças com 0% (+4.5s por peça para 60%) */}
                  <label
                    className={`flex items-start gap-2.5 p-2 rounded-md border cursor-pointer transition-all ${
                      repairPartsOption
                        ? 'border-cyan-400 bg-cyan-500/20 text-white'
                        : 'border-[#1F2733] bg-[#0B0E14] text-[#8B95A7] hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={repairPartsOption}
                      onChange={(e) => setRepairPartsOption?.(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs">
                          Reparar Peças em Colapso (0% Condição)
                        </span>
                        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">
                          {zeroParts > 0 ? `+${(zeroParts * 4.5).toFixed(1)}s` : '+4.5s por peça'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {zeroParts > 0
                          ? `Restaurará ${zeroParts} peça(s) zerada(s) (${zeroNames.join(', ')}) para 60% de integridade, eliminando o risco iminente de abandono (DNF).`
                          : 'Restaura para 60% de condição qualquer componente que tenha zerado durante a prova (+4.5s cada).'}
                      </p>
                    </div>
                  </label>

                  <div className="flex items-center justify-between text-[11px] text-[#8B95A7] pt-1 border-t border-[#1F2733]">
                    <span>Tempo de serviço adicional previsto:</span>
                    <strong className="text-amber-400">
                      +
                      {(
                        (repairWingOption ? 8.0 : 0) +
                        (repairPartsOption ? Math.max(1, zeroParts) * 4.5 : 0)
                      ).toFixed(1)}
                      s
                    </strong>
                  </div>
                </div>
              )
            })()}

            {/* Crew note */}
            <div className="p-3 rounded-lg bg-[#0B0E14] border border-[#1F2733] text-[11px] font-mono space-y-1">
              <div className="flex items-center justify-between text-[#8B95A7]">
                <span>Equipe de Mecânicos / Chassis da Escuderia:</span>
                <span className="text-emerald-400 font-bold">Nível {teamChassisLevel}/100</span>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-[#1F2733] pt-3 flex flex-col sm:flex-row gap-2 justify-end">
            <Button
              variant="outline"
              onClick={onCloseForcePitModal}
              className="border-slate-700 text-slate-300 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={onExecuteForcedPitStop}
              className="bg-amber-600 hover:bg-amber-500 text-black font-extrabold text-xs uppercase px-5 shadow-lg"
            >
              Confirmar Parada Imediata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
