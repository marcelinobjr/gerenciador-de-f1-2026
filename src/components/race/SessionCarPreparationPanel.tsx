import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Play,
  RotateCcw,
  Fuel,
  Disc,
  Gauge,
  Activity,
  Wrench,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react'
import { DriverPhotoAvatar } from '@/components/DriverPhotoAvatar'
import type { TireSetItem, TireCompound } from '@/types/f1'
import type { StintFeedbackRecord, SetupKnowledgeModel } from '@/types/practice-session'
import { formatTireName } from '@/lib/f1-tire-system'
import { calculateInformedSetupRecommendation } from '@/services/canonicalPreparationInformedService'

export interface CarPreparationCarData {
  carId: 'car1' | 'car2'
  carNumber: 1 | 2
  driverId: string
  driverName: string
  driverNumber?: number
  isRookie?: boolean
  originalDriverName?: string
  status: 'garage' | 'out_lap' | 'flying_lap' | 'in_lap' | 'classified' | 'eliminated'
  isEliminated?: boolean
  fuelKg: number
  currentCompound: TireCompound
  currentTyreSetId?: string
  tyreWear: number
  setup: {
    frontWing: number
    rearWing: number
    suspension: number
    differential: number
  }
  bestLapTime?: string
  bestLapSec?: number
  lastLapTime?: string
  totalLaps: number
  lapsInStint?: number
  currentLapProgressPct?: number
  pitRequested?: boolean
}

export interface SessionCarPreparationPanelProps {
  sessionType: 'practice' | 'qualifying' | 'race_strategy'
  car: CarPreparationCarData
  teamColor?: string
  parcFermeActive?: boolean
  parcFermeReason?: string
  inventory: TireSetItem[]
  knowledge?: SetupKnowledgeModel
  latestFeedback?: StintFeedbackRecord
  hasUnreadFeedback?: boolean
  isSessionRunning?: boolean
  isSessionCompleted?: boolean
  // Callbacks
  onOrderExitTrack?: () => void
  onRequestBox?: () => void
  onUpdateSetup?: (newSetup: CarPreparationCarData['setup']) => void
  onUpdateFuel?: (kg: number) => void
  onSelectTyreSet?: (tyreSetId: string) => void
  onMarkFeedbackRead?: () => void
  // Rookie callbacks (TL1)
  canToggleRookie?: boolean
  onOpenRookieSelector?: () => void
  onRestoreTitular?: () => void
}

const COMPOUND_ORDER: TireCompound[] = ['macio', 'medio', 'duro', 'intermediario', 'chuva_extrema']

export const SessionCarPreparationPanel: React.FC<SessionCarPreparationPanelProps> = ({
  sessionType,
  car,
  teamColor = '#E10600',
  parcFermeActive = false,
  parcFermeReason,
  inventory,
  knowledge,
  latestFeedback,
  hasUnreadFeedback = false,
  isSessionRunning = false,
  isSessionCompleted = false,
  onOrderExitTrack,
  onRequestBox,
  onUpdateSetup,
  onUpdateFuel,
  onSelectTyreSet,
  onMarkFeedbackRead,
  canToggleRookie = false,
  onOpenRookieSelector,
  onRestoreTitular,
}) => {
  const [showSetupDetails, setShowSetupDetails] = useState<boolean>(false)
  const [showTyreSelector, setShowTyreSelector] = useState<boolean>(false)
  const [showFeedbackDetails, setShowFeedbackDetails] = useState<boolean>(true)

  // Estados locais de setup editáveis
  const [frontWing, setFrontWing] = useState<number>(car.setup?.frontWing || 6)
  const [rearWing, setRearWing] = useState<number>(car.setup?.rearWing || 6)
  const [suspension, setSuspension] = useState<number>(car.setup?.suspension || 6)
  const [differential, setDifferential] = useState<number>(car.setup?.differential || 50)

  // Sincronizar quando props externas mudam
  React.useEffect(() => {
    if (car.setup) {
      setFrontWing(car.setup.frontWing)
      setRearWing(car.setup.rearWing)
      setSuspension(car.setup.suspension)
      setDifferential(car.setup.differential)
    }
  }, [car.setup?.frontWing, car.setup?.rearWing, car.setup?.suspension, car.setup?.differential])

  // Estado local de combustível
  const [fuelInput, setFuelInput] = useState<number>(car.fuelKg || 15)
  React.useEffect(() => {
    setFuelInput(car.fuelKg)
  }, [car.fuelKg])

  const isInGarage = car.status === 'garage'
  const isCarOnTrack = !isInGarage && car.status !== 'eliminated'
  const isEliminated = car.isEliminated || car.status === 'eliminated'

  // Parc Fermé bloqueia alterações de setup
  const isSetupLocked = parcFermeActive || !isInGarage || isSessionCompleted

  // Recomendação de Engenharia Informada
  const informedRec = React.useMemo(() => {
    if (!knowledge) {
      return {
        headline: 'Aguardando telemetria inicial',
        observedBasisText: 'Complete stints para correlacionar o acerto.',
        frontWingTarget: 6,
        rearWingTarget: 6,
        suspensionTarget: 6,
        differentialTarget: 50,
      }
    }
    return calculateInformedSetupRecommendation({
      knowledge,
      currentSetup: { frontWing, rearWing, suspension, differential },
      round: 1,
    })
  }, [knowledge, frontWing, rearWing, suspension, differential])

  // Estimativa de voltas por combustível (modelo de consumo padrão F1 ~1.65-1.75 kg/volta)
  const estimatedLaps = Math.max(0, Math.floor(car.fuelKg / 1.7))

  // Jogo de pneus atualmente instalado
  const fittedTyreSet = inventory.find(
    (t) => t.id === car.currentTyreSetId || (t.isFitted && t.driverId === car.driverId),
  )

  const handleApplySetup = () => {
    if (isSetupLocked || !onUpdateSetup) return
    onUpdateSetup({
      frontWing,
      rearWing,
      suspension,
      differential,
    })
  }

  const handleApplyRecommendedSetup = () => {
    if (isSetupLocked || !onUpdateSetup || !knowledge) return
    const newF = knowledge.frontWing.revealed
      ? Math.round((knowledge.frontWing.minKnown + knowledge.frontWing.maxKnown) / 2)
      : frontWing
    const newR = knowledge.rearWing.revealed
      ? Math.round((knowledge.rearWing.minKnown + knowledge.rearWing.maxKnown) / 2)
      : rearWing
    const newS = knowledge.suspension.revealed
      ? Math.round((knowledge.suspension.minKnown + knowledge.suspension.maxKnown) / 2)
      : suspension
    const newD = knowledge.differential.revealed
      ? Math.round((knowledge.differential.minKnown + knowledge.differential.maxKnown) / 2)
      : differential

    const clampedF = Math.max(1, Math.min(10, newF))
    const clampedR = Math.max(1, Math.min(10, newR))
    const clampedS = Math.max(1, Math.min(10, newS))
    const clampedD = Math.max(20, Math.min(80, newD))

    setFrontWing(clampedF)
    setRearWing(clampedR)
    setSuspension(clampedS)
    setDifferential(clampedD)

    onUpdateSetup({
      frontWing: clampedF,
      rearWing: clampedR,
      suspension: clampedS,
      differential: clampedD,
    })
  }

  const handleFuelChange = (newVal: number) => {
    const clamped = Math.max(1, Math.min(110, Math.round(newVal)))
    setFuelInput(clamped)
    if (onUpdateFuel && isInGarage) {
      onUpdateFuel(clamped)
    }
  }

  return (
    <Card className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4 font-sans text-xs">
      {/* 1. TOPO DO CARRO: PILOTO, FOTO, NÚMERO, STATUS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9] pb-3">
        <div className="flex items-center gap-3">
          <DriverPhotoAvatar
            name={car.driverName}
            driverId={car.driverId}
            teamColor={teamColor}
            size="md"
          />
          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-6 rounded-full shrink-0"
                style={{ backgroundColor: teamColor }}
              />
              <h4 className="text-sm font-black text-[#0F172A]">{car.driverName}</h4>
              <Badge className="bg-[#0F172A] text-white text-[10px] font-black">
                CARRO {car.carNumber} • #{car.driverNumber || car.carNumber}
              </Badge>
              {car.isRookie && (
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-[9px] font-black">
                  ROOKIE TL1
                </Badge>
              )}
            </div>
            {car.isRookie && car.originalDriverName && (
              <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                Substituindo temporariamente {car.originalDriverName} no TL1
              </p>
            )}
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Total de voltas: <strong className="text-[#0F172A]">{car.totalLaps}</strong>
              {car.lapsInStint !== undefined && ` • ${car.lapsInStint} no stint atual`}
            </p>
          </div>
        </div>

        {/* STATUS VISUAL & CONTROLE ROOKIE */}
        <div className="flex flex-wrap items-center gap-2">
          {canToggleRookie &&
            !isSessionRunning &&
            !isSessionCompleted &&
            (car.isRookie ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRestoreTitular}
                className="h-7 text-[10px] font-bold border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
              >
                Restaurar Titular ({car.originalDriverName})
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onOpenRookieSelector}
                className="h-7 text-[10px] font-bold border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              >
                + Escalar Novato TL1
              </Button>
            ))}

          {isEliminated ? (
            <Badge className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black">
              ELIMINADO
            </Badge>
          ) : isInGarage ? (
            <Badge className="bg-slate-100 text-[#475569] text-[10px] font-bold">NA GARAGEM</Badge>
          ) : car.status === 'flying_lap' ? (
            <Badge className="bg-emerald-600 text-white text-[10px] font-black animate-pulse">
              EM PISTA (VOLTA RÁPIDA)
            </Badge>
          ) : car.status === 'out_lap' ? (
            <Badge className="bg-amber-500 text-white text-[10px] font-bold">OUT LAP</Badge>
          ) : car.status === 'in_lap' ? (
            <Badge className="bg-indigo-600 text-white text-[10px] font-bold">IN LAP</Badge>
          ) : (
            <Badge className="bg-slate-100 text-[#475569] text-[10px] font-bold">
              {car.status.toUpperCase()}
            </Badge>
          )}

          {car.pitRequested && isCarOnTrack && car.status !== 'in_lap' && (
            <Badge className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold animate-pulse">
              Box Solicitado
            </Badge>
          )}
        </div>
      </div>

      {/* 2. PROGRESSO EM PISTA SE ATIVO */}
      {isCarOnTrack && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-[#64748B]">
            <span className="flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-[#E10600]" />
              Progresso na Pista
            </span>
            <span className="text-[#0F172A] font-mono">
              {Math.round(car.currentLapProgressPct || 0)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E10600] transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, car.currentLapProgressPct || 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* 3. QUADRICULADO RESUMO: PNEUS, COMBUSTÍVEL, MELHOR TEMPO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* PNEU ATUAL */}
        <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#64748B] uppercase">
            <span className="flex items-center gap-1">
              <Disc className="w-3.5 h-3.5 text-[#E10600]" />
              Pneu Equipado
            </span>
            <span
              className={`font-mono font-bold ${
                car.tyreWear >= 70
                  ? 'text-rose-600'
                  : car.tyreWear >= 40
                    ? 'text-amber-600'
                    : 'text-emerald-600'
              }`}
            >
              {car.tyreWear}% uso
            </span>
          </div>
          <div className="text-xs font-black text-[#0F172A] flex items-center justify-between">
            <span className="capitalize">{formatTireName(car.currentCompound)}</span>
            {fittedTyreSet && (
              <span className="text-[10px] text-[#64748B] font-mono">
                {fittedTyreSet.lapsUsed || 0} voltas
              </span>
            )}
          </div>
          {isInGarage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowTyreSelector(!showTyreSelector)}
              className="w-full h-6 text-[10px] font-bold text-[#E10600] hover:text-[#C00400] hover:bg-red-50 p-0 justify-start"
            >
              {showTyreSelector ? '▲ Ocultar estoque de jogos' : '▼ Trocar jogo de pneus'}
            </Button>
          )}
        </div>

        {/* COMBUSTÍVEL */}
        <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#64748B] uppercase">
            <span className="flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-amber-500" />
              Combustível
            </span>
            <span className="font-mono font-black text-[#0F172A]">{car.fuelKg} kg</span>
          </div>
          <div className="text-[11px] font-bold text-[#475569]">
            ~{estimatedLaps} voltas estimadas
          </div>
          {isInGarage && (
            <div className="pt-1 flex items-center gap-2">
              <Slider
                min={1}
                max={110}
                step={1}
                value={[fuelInput]}
                onValueChange={(val) => handleFuelChange(val[0])}
                className="flex-1"
              />
              <Input
                type="number"
                min={1}
                max={110}
                value={fuelInput}
                onChange={(e) => handleFuelChange(Number(e.target.value))}
                className="w-14 h-6 text-[11px] font-mono font-bold text-center p-0.5"
              />
            </div>
          )}
        </div>

        {/* CRONOMETRAGEM */}
        <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
          <div className="text-[10px] font-bold text-[#64748B] uppercase flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-emerald-600" />
            Melhor Volta
          </div>
          <div className="text-xs font-black text-emerald-600 font-mono">
            {car.bestLapTime || '--:--.---'}
          </div>
          <div className="text-[10px] text-[#64748B]">
            Última:{' '}
            <span className="font-mono text-[#0F172A]">{car.lastLapTime || '--:--.---'}</span>
          </div>
        </div>
      </div>

      {/* 4. SELETOR DE JOGOS REAIS DO INVENTÁRIO (EXPANSÍVEL) */}
      {showTyreSelector && isInGarage && (
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase text-[#0F172A] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#E10600]" />
              Escolha do Jogo de Pneus (Inventário Persistente do Piloto)
            </span>
            <Badge variant="outline" className="text-[10px] text-[#64748B]">
              {inventory.length} jogos totais
            </Badge>
          </div>

          <div className="space-y-2">
            {COMPOUND_ORDER.map((comp) => {
              const sets = inventory.filter((t) => t.compound === comp)
              if (sets.length === 0) return null

              return (
                <div key={comp} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                    <span>{formatTireName(comp)}</span>
                    <span>{sets.length} jogo(s)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {sets.map((set, idx) => {
                      const isFitted =
                        set.id === car.currentTyreSetId ||
                        (set.isFitted && set.driverId === car.driverId)
                      const isExhausted = (set.wear || 0) >= 90
                      const isNew = (set.lapsUsed || 0) === 0

                      return (
                        <button
                          key={set.id}
                          type="button"
                          disabled={isFitted || isExhausted}
                          onClick={() => {
                            if (onSelectTyreSet) onSelectTyreSet(set.id)
                          }}
                          className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between gap-1 text-[10px] ${
                            isFitted
                              ? 'bg-red-50 border-[#E10600] ring-1 ring-[#E10600]'
                              : isExhausted
                                ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                                : 'bg-white border-[#CBD5E1] hover:border-[#E10600] cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] text-[#64748B]">
                              SET #{idx + 1}
                            </span>
                            {isFitted ? (
                              <Badge className="bg-[#E10600] text-white text-[8px] h-3.5 px-1 py-0">
                                INSTALADO
                              </Badge>
                            ) : isNew ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[8px] h-3.5 px-1 py-0">
                                NOVO
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-300 text-[8px] h-3.5 px-1 py-0">
                                USADO
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between font-bold text-[#0F172A]">
                            <span>{set.lapsUsed || 0}v</span>
                            <span
                              className={
                                (set.wear || 0) >= 70
                                  ? 'text-rose-600'
                                  : (set.wear || 0) >= 40
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                              }
                            >
                              {set.wear || 0}%
                            </span>
                          </div>
                          <Progress value={set.wear || 0} className="h-1 bg-slate-100" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 5. SETUP DO CARRO (COM PARC FERMÉ SE APLICÁVEL) */}
      <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#E10600]" />
            <span className="font-bold text-[#0F172A]">Configuração do Carro (Setup):</span>
            <span className="font-mono text-[#334155] text-[11px]">
              Asa D: <strong>{frontWing}</strong> • Asa T: <strong>{rearWing}</strong> • Susp:{' '}
              <strong>{suspension}</strong> • Dif: <strong>{differential}%</strong>
            </span>
          </div>

          {parcFermeActive ? (
            <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-700" />
              PARC FERMÉ
            </Badge>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSetupDetails(!showSetupDetails)}
              className="h-6 text-[10px] font-bold text-[#E10600] hover:bg-red-50 p-1"
            >
              {showSetupDetails ? 'Ocultar sliders' : 'Ajustar sliders de setup'}
            </Button>
          )}
        </div>

        {/* FEEDBACK EXPLÍCITO DE PARC FERMÉ SE ATIVO */}
        {parcFermeActive && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>PARC FERMÉ EM VIGOR:</strong>{' '}
              {parcFermeReason ||
                'Ajustes aerodinâmicos e mecânicos estão bloqueados pela FIA a partir do início da classificação.'}
            </span>
          </div>
        )}

        {/* SLIDERS EXPANSÍVEIS (SE PERMITIDO) */}
        {showSetupDetails && !parcFermeActive && (
          <div className="space-y-4 pt-2 border-t border-[#E2E8F0]">
            {/* Recomendação de Engenharia Informada */}
            {knowledge && (
              <div className="p-2.5 rounded-lg bg-white border border-[#CBD5E1] space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#0F172A] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                    Recomendação de Engenharia (Dados de TL)
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[9px] uppercase font-bold text-[#64748B]"
                  >
                    Confiança: {knowledge.overallConfidence || 'baixa'}
                  </Badge>
                </div>
                <p className="text-[10px] text-[#64748B]">
                  {informedRec.headline} — {informedRec.observedBasisText}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyRecommendedSetup}
                  disabled={isSetupLocked}
                  className="w-full h-7 text-[10px] font-bold border-cyan-400 text-cyan-800 hover:bg-cyan-50 flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-cyan-600" />
                  APLICAR RECOMENDAÇÃO RECOMENDADA
                </Button>
              </div>
            )}

            {/* Sliders manuais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Asa Dianteira */}
              <div className="p-2.5 rounded-lg bg-white border border-[#CBD5E1] space-y-1.5">
                <div className="flex justify-between font-bold text-[11px]">
                  <span className="text-[#475569]">Asa Dianteira</span>
                  <span className="font-mono text-[#0F172A]">{frontWing} / 10</span>
                </div>
                <Slider
                  disabled={isSetupLocked}
                  min={1}
                  max={10}
                  step={1}
                  value={[frontWing]}
                  onValueChange={(val) => setFrontWing(val[0])}
                />
                <div className="flex justify-between text-[9px] text-[#94A3B8]">
                  <span>1 (Mínimo)</span>
                  <span>
                    {knowledge?.frontWing.revealed
                      ? `Conhecido: [${knowledge.frontWing.minKnown}–${knowledge.frontWing.maxKnown}]`
                      : 'Faixa: ?'}
                  </span>
                  <span>10 (Máximo)</span>
                </div>
              </div>

              {/* Asa Traseira */}
              <div className="p-2.5 rounded-lg bg-white border border-[#CBD5E1] space-y-1.5">
                <div className="flex justify-between font-bold text-[11px]">
                  <span className="text-[#475569]">Asa Traseira</span>
                  <span className="font-mono text-[#0F172A]">{rearWing} / 10</span>
                </div>
                <Slider
                  disabled={isSetupLocked}
                  min={1}
                  max={10}
                  step={1}
                  value={[rearWing]}
                  onValueChange={(val) => setRearWing(val[0])}
                />
                <div className="flex justify-between text-[9px] text-[#94A3B8]">
                  <span>1 (Mínimo)</span>
                  <span>
                    {knowledge?.rearWing.revealed
                      ? `Conhecido: [${knowledge.rearWing.minKnown}–${knowledge.rearWing.maxKnown}]`
                      : 'Faixa: ?'}
                  </span>
                  <span>10 (Máximo)</span>
                </div>
              </div>

              {/* Suspensão */}
              <div className="p-2.5 rounded-lg bg-white border border-[#CBD5E1] space-y-1.5">
                <div className="flex justify-between font-bold text-[11px]">
                  <span className="text-[#475569]">Suspensão</span>
                  <span className="font-mono text-[#0F172A]">{suspension} / 10</span>
                </div>
                <Slider
                  disabled={isSetupLocked}
                  min={1}
                  max={10}
                  step={1}
                  value={[suspension]}
                  onValueChange={(val) => setSuspension(val[0])}
                />
                <div className="flex justify-between text-[9px] text-[#94A3B8]">
                  <span>1 (Macia)</span>
                  <span>
                    {knowledge?.suspension.revealed
                      ? `Conhecido: [${knowledge.suspension.minKnown}–${knowledge.suspension.maxKnown}]`
                      : 'Faixa: ?'}
                  </span>
                  <span>10 (Rígida)</span>
                </div>
              </div>

              {/* Diferencial */}
              <div className="p-2.5 rounded-lg bg-white border border-[#CBD5E1] space-y-1.5">
                <div className="flex justify-between font-bold text-[11px]">
                  <span className="text-[#475569]">Diferencial</span>
                  <span className="font-mono text-[#0F172A]">{differential}%</span>
                </div>
                <Slider
                  disabled={isSetupLocked}
                  min={20}
                  max={80}
                  step={1}
                  value={[differential]}
                  onValueChange={(val) => setDifferential(val[0])}
                />
                <div className="flex justify-between text-[9px] text-[#94A3B8]">
                  <span>20% (Aberto)</span>
                  <span>
                    {knowledge?.differential.revealed
                      ? `Conhecido: [${knowledge.differential.minKnown}%–${knowledge.differential.maxKnown}%]`
                      : 'Faixa: ?'}
                  </span>
                  <span>80% (Fechado)</span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              disabled={isSetupLocked}
              onClick={handleApplySetup}
              className="w-full h-8 text-xs font-black bg-[#E10600] hover:bg-[#C00400] text-white shadow-xs gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              CONFIRMAR ACERTO DO CARRO {car.carNumber}
            </Button>
          </div>
        )}
      </div>

      {/* 6. FEEDBACK DO PILOTO (SE EXISTIR) */}
      {latestFeedback && (
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-[#E10600]" />
              <span className="font-bold text-[#0F172A]">Feedback Técnico — {car.driverName}</span>
              {hasUnreadFeedback && (
                <Badge
                  onClick={onMarkFeedbackRead}
                  className="bg-red-100 text-[#E10600] border-red-200 text-[9px] font-black cursor-pointer animate-pulse"
                >
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
              className="h-6 w-6 p-0 text-[#64748B]"
            >
              {showFeedbackDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          <p className="text-[11px] text-[#475569] italic bg-white p-2 rounded-lg border border-[#E2E8F0]">
            "{latestFeedback.generalMessage}"
          </p>

          {showFeedbackDetails &&
            latestFeedback.axisFeedbacks &&
            latestFeedback.axisFeedbacks.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {latestFeedback.axisFeedbacks.map((fb) => (
                  <div
                    key={fb.axis}
                    className="p-1.5 rounded-md bg-white border border-[#E2E8F0] text-[10px] space-y-0.5"
                  >
                    <div className="flex justify-between font-bold">
                      <span className="text-[#0F172A]">{fb.axisLabel}</span>
                      <span
                        className={
                          fb.direction === 'ok'
                            ? 'text-emerald-600'
                            : fb.severity === 'alta'
                              ? 'text-rose-600'
                              : 'text-amber-600'
                        }
                      >
                        {fb.direction === 'increase'
                          ? 'Aumentar'
                          : fb.direction === 'decrease'
                            ? 'Diminuir'
                            : 'Ideal'}
                      </span>
                    </div>
                    <p className="text-[#64748B] text-[9px]">"{fb.message}"</p>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* 7. BOTÕES DE AÇÃO: LIBERAR / CHAMAR AOS BOXES */}
      <div className="pt-1">
        {isInGarage ? (
          <Button
            type="button"
            disabled={isSessionCompleted || isEliminated || car.fuelKg < 2}
            onClick={onOrderExitTrack}
            className="w-full text-xs font-black bg-[#E10600] hover:bg-[#C00400] text-white shadow-xs gap-2 h-9"
          >
            <Play className="w-4 h-4 fill-current" />
            LIBERAR CARRO {car.carNumber} PARA A PISTA
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={
              isSessionCompleted || isEliminated || car.pitRequested || car.status === 'in_lap'
            }
            onClick={onRequestBox}
            className={`w-full text-xs font-bold gap-2 h-9 border-[#CBD5E1] ${
              car.pitRequested
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-[#0F172A] hover:bg-[#F8FAFC]'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            {car.pitRequested ? 'BOX CONFIRMADO (RETORNANDO)' : 'CHAMAR AOS BOXES'}
          </Button>
        )}
      </div>
    </Card>
  )
}
