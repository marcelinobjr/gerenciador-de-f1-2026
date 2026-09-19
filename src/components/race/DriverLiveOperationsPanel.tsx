import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Wrench,
  Radio,
  Fuel,
  Disc,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Compass,
  Zap,
} from 'lucide-react'
import type { SimDriverEntry } from '@/pages/race/types'
import type { DriverModel } from '@/types/f1'
import { DriverPoster } from '@/components/DriverPoster'
import { TIRE_SPECS, selectCarTireDisplayState } from '@/lib/f1-tire-system'
import { getCountryFlag } from '@/lib/country-flags'
import type { LiveTacticalMode } from '@/pages/race/RaceOperationsCockpit'
import type { LivePaceOrder } from '@/components/race/LiveTelemetryTable'
import type { RacePendingDecision } from '@/types/race-session'
import type { PreparationInformedPackage } from '@/services/canonicalPreparationInformedService'

export interface DriverLiveOperationsPanelProps {
  slotNumber: 1 | 2
  driver: DriverModel | null
  car: SimDriverEntry | null
  totalLaps: number
  tacticalMode: LiveTacticalMode
  paceOrder: LivePaceOrder
  onChangeTacticalMode: (driverId: string, mode: LiveTacticalMode) => void
  onChangePaceOrder: (driverId: string, order: LivePaceOrder) => void
  onCallBox: (driverId: string) => void
  onOpenRadio: (driverId: string) => void
  mechanicalIssues?: Array<{
    driverId: string
    name: string
    severity: 'minor' | 'moderate' | 'severe'
    isDnf?: boolean
  }>
  partsCondition?: Array<{
    id: string
    name: string
    condition: number
  }>
  informedPackage?: PreparationInformedPackage | null
  pendingRecommendation?: RacePendingDecision | null
  puStatus?: {
    leastWear?: number
    wear?: number
    condition?: number
  } | null
}

export const DriverLiveOperationsPanel: React.FC<DriverLiveOperationsPanelProps> = ({
  slotNumber,
  driver,
  car,
  totalLaps,
  tacticalMode,
  paceOrder,
  onChangeTacticalMode,
  onChangePaceOrder,
  onCallBox,
  onOpenRadio,
  mechanicalIssues = [],
  partsCondition = [],
  informedPackage,
  pendingRecommendation,
  puStatus,
}) => {
  if (!car || !driver) {
    return (
      <Card className="bg-white border border-slate-200/90 shadow-xs rounded-xl p-6 text-center text-slate-500">
        <p className="font-semibold text-slate-800">Carro {slotNumber} — Não escalado</p>
        <p className="text-xs mt-1 text-slate-400">Nenhum piloto configurado para esta vaga.</p>
      </Card>
    )
  }

  // 1. TOPO: Identificação e Tempos do Piloto
  const driverNumber = (driver as any).driver_number || (slotNumber === 1 ? 16 : 55)
  const driverName = car.driverName || driver.name
  const countryFlag = getCountryFlag(driver.nationality || (car as any).nationality)
  const position = car.position || 0
  const gapFront = car.gapToFront || '—'
  const gapLeader = car.gapToLeader || '—'
  const lastLap =
    car.lastLapTime || (car.lastLapTimeSec ? `${car.lastLapTimeSec.toFixed(3)}s` : '—')
  const bestLap =
    (car as any).bestLapTime ||
    ((car as any).bestLapSec
      ? `${(car as any).bestLapSec.toFixed(3)}s`
      : lastLap !== '—'
        ? lastLap
        : '—')

  // 2. PNEUS: Consumo canônico sem recalcular e sem fallback 50%
  const tireDisplay = selectCarTireDisplayState(car)
  const compound = tireDisplay.compound
  const compSpec = compound ? TIRE_SPECS[compound] || TIRE_SPECS.medio : null
  const compoundName = tireDisplay.compoundName
  const lapsOnTire = tireDisplay.lapsOnTire
  const lapsOnTireText = tireDisplay.lapsOnTireText
  const tireWearPct = tireDisplay.tireWearPct
  const tireWearText = tireDisplay.tireWearText
  const tireConditionRemainingPct = tireDisplay.tireConditionPct
  const tireConditionRemainingText = tireDisplay.tireConditionText
  const isInCliff = tireDisplay.isInCliff

  // Janela restante estimada APENAS do conhecimento dos treinos (sem inventar física)
  const tyreInformedAnalysis =
    compound && informedPackage?.tyresAnalysis ? informedPackage.tyresAnalysis[compound] : null
  const windowRange = tyreInformedAnalysis?.usefulWindowRange
  const tyreConfidence =
    tyreInformedAnalysis?.confidence && tyreInformedAnalysis.confidence !== 'sem_dados'
      ? tyreInformedAnalysis.confidence
      : null
  let remainingWindowText: string | null = null
  if (windowRange && lapsOnTire !== null) {
    const remMin = Math.max(0, windowRange.minLaps - lapsOnTire)
    const remMax = Math.max(0, windowRange.maxLaps - lapsOnTire)
    remainingWindowText = `${remMin}–${remMax} voltas`
  }

  // 3. COMBUSTÍVEL: Sem nova física, projeção baseada nos dados existentes
  const fuelPct =
    car.fuelRemaining !== undefined && car.fuelRemaining !== null
      ? Math.max(0, Math.round(car.fuelRemaining))
      : null
  const fuelKg = fuelPct !== null ? ((fuelPct / 100) * 105).toFixed(1) : null
  const currentLap =
    car.lapsCompleted !== undefined
      ? car.lapsCompleted
      : car.lapsOnCurrentTire !== undefined
        ? car.lapsOnCurrentTire
        : 1
  const lapsRemaining = Math.max(0, totalLaps - currentLap)
  const fuelBurnRate =
    tacticalMode === 'attack' || paceOrder === 'empurrar'
      ? 2.15
      : tacticalMode === 'save_fuel' || paceOrder === 'segurar'
        ? 1.4
        : 1.75
  const projectedLaps =
    fuelPct !== null && fuelBurnRate > 0 ? Math.round(fuelPct / fuelBurnRate) : null
  const neededFuelPct = lapsRemaining * fuelBurnRate
  const fuelMarginPct = fuelPct !== null ? fuelPct - neededFuelPct : null
  const isFuelCritical = fuelMarginPct !== null && fuelMarginPct < -3.0

  const tacticalModeLabel =
    tacticalMode === 'attack' ? 'Ataque' : tacticalMode === 'save_fuel' ? 'Eco' : 'Padrão'

  // 4. CONDIÇÃO DO CARRO: Integridade geral, danos, falhas, estado resumido PU
  const driverIssues = mechanicalIssues.filter((iss) => iss.driverId === car.driverId && !iss.isDnf)
  const hasWingDmg = Boolean(car.hasWingDamage)
  const brokenParts = partsCondition.filter((p) => p.condition < 40)
  const avgPartCondition =
    partsCondition.length > 0
      ? Math.round(partsCondition.reduce((acc, p) => acc + p.condition, 0) / partsCondition.length)
      : null
  const puWear =
    puStatus?.wear ?? (puStatus?.leastWear !== undefined ? 100 - puStatus.leastWear : null)

  const hasCarProblems = hasWingDmg || driverIssues.length > 0 || brokenParts.length > 0

  // 5. ESTRATÉGIA: Próxima parada, composto previsto, recomendação de engenharia
  const driverStrategy = informedPackage?.strategyRecommendations?.[car.driverId] || null
  const nextPitWindow = driverStrategy?.suggestedPitWindows?.[0] || null
  const plannedPitLap = car.pitLap || nextPitWindow?.windowLapMin || null
  const plannedCompound = nextPitWindow?.recommendedCompound || car.secondCompound || null
  const strategyConfidence = driverStrategy?.confidence || null
  const headlineStrategy = driverStrategy?.strategyHeadline || null

  const pendingRecPayload = (pendingRecommendation?.payload || {}) as Record<string, any>
  const recProposedCompound = pendingRecPayload.proposedCompound as string | undefined
  const recConfidence = pendingRecPayload.confidence as string | undefined
  const recJustification = (pendingRecPayload.justification ||
    pendingRecommendation?.description) as string | undefined

  return (
    <Card className="bg-white border border-slate-200/90 shadow-xs rounded-xl overflow-hidden flex flex-col">
      {/* =========================================================================
          BLOCO 1 — TOPO DO COCKPIT OPERACIONAL
          Foto real, Carro 1/2, número, nome, bandeira, posição, gaps, tempos
         ========================================================================= */}
      <CardHeader className="py-2.5 px-3.5 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Foto/Pôster Real do Piloto */}
          <div className="w-11 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 shadow-xs relative">
            <DriverPoster
              name={driverName}
              driverId={car.driverId}
              className="w-full h-full object-cover object-top"
            />
            <span className="absolute bottom-0 right-0 bg-slate-950/90 text-white font-mono text-[9px] font-black px-1 rounded-tl">
              #{driverNumber}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                Carro {slotNumber}
              </span>
              <span className="font-mono text-xs text-slate-500 font-bold">#{driverNumber}</span>
              {countryFlag && (
                <span
                  className="text-sm select-none leading-none"
                  title={driver.nationality || 'País'}
                >
                  {countryFlag}
                </span>
              )}
              {car.isPlayer && (
                <Badge className="bg-[#E10600] text-white text-[9px] px-1 py-0 rounded font-black tracking-wider uppercase">
                  APEX
                </Badge>
              )}
            </div>

            <CardTitle className="text-sm sm:text-base font-black text-slate-950 mt-0.5 leading-tight tracking-tight truncate">
              {driverName}
            </CardTitle>
            <p className="text-[10px] text-slate-500 font-semibold truncate">{car.teamName}</p>
          </div>
        </div>

        {/* Posição, Gaps e Tempos com fonte monoespaçada */}
        <div className="text-right shrink-0">
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              POS
            </span>
            <span
              className={`font-mono text-base font-black px-2 py-0.5 rounded border ${
                car.dnf
                  ? 'bg-slate-200 text-slate-600 border-slate-300'
                  : position === 1
                    ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-2xs'
                    : 'bg-slate-100 text-slate-950 border-slate-200'
              }`}
            >
              {car.dnf ? 'DNF' : `P${position}`}
            </span>
          </div>

          <div className="text-[10px] font-mono text-slate-600 mt-1 flex flex-col items-end gap-0.5 tabular-nums">
            <div className="space-x-1.5">
              <span>
                Frente: <strong className="text-slate-900">{gapFront}</strong>
              </span>
              <span>·</span>
              <span>
                Líder: <strong className="text-slate-900">{gapLeader}</strong>
              </span>
            </div>
            <div className="space-x-1.5 text-slate-500">
              <span>
                Última: <strong className="text-slate-800">{lastLap}</strong>
              </span>
              <span>·</span>
              <span>
                Melhor: <strong className="text-slate-800">{bestLap}</strong>
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 space-y-3 flex-1 text-xs">
        {/* =========================================================================
            BLOCO 2 — PNEUS
            Composto, jogo, condição restante, desgaste, voltas, janela e confiança
           ========================================================================= */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/90 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
              <Disc className="w-3.5 h-3.5 text-amber-500" />
              Pneus: {compoundName} {compound ? `(${compound.toUpperCase()})` : ''}
            </span>
            <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 tabular-nums">
              {lapsOnTire !== null ? `${lapsOnTire} voltas de uso` : lapsOnTireText}
            </span>
          </div>

          {/* Condição Restante e Desgaste Acumulado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-600 font-medium">Condição Restante:</span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  tireConditionRemainingPct !== null && tireConditionRemainingPct < 25
                    ? 'text-red-600'
                    : tireConditionRemainingPct !== null && tireConditionRemainingPct < 50
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                }`}
              >
                {tireConditionRemainingText}
              </span>
            </div>

            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  tireConditionRemainingPct !== null && tireConditionRemainingPct < 25
                    ? 'bg-red-500'
                    : tireConditionRemainingPct !== null && tireConditionRemainingPct < 50
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${tireConditionRemainingPct ?? 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-600 pt-0.5">
              <span>
                Desgaste Acumulado:{' '}
                <strong className="font-mono text-slate-900 tabular-nums">{tireWearText}</strong>
              </span>
              {isInCliff ? (
                <Badge className="bg-red-600 text-white font-mono text-[9px] px-1.5 py-0 animate-pulse">
                  CLIFF ATINGIDO
                </Badge>
              ) : tireWearPct !== null && tireWearPct > 70 ? (
                <span className="text-amber-600 font-bold">Desgaste Elevado</span>
              ) : tireWearPct !== null ? (
                <span className="text-emerald-700 font-medium">Faixa Nominal</span>
              ) : null}
            </div>

            {/* Janela restante estimada com base no conhecimento de treinos se existente */}
            {(remainingWindowText || tyreConfidence) && (
              <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/60">
                <span>
                  Janela Restante Estimada:{' '}
                  <strong className="font-mono text-slate-800">{remainingWindowText || '—'}</strong>
                </span>
                {tyreConfidence && (
                  <span className="text-slate-400 capitalize">
                    Confiança: <strong className="text-slate-700">{tyreConfidence}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            BLOCO 3 — COMBUSTÍVEL
            kg restantes, projeção de voltas, margem estimada +/-, modo atual
           ========================================================================= */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/90 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
              <Fuel className="w-3.5 h-3.5 text-cyan-600" />
              Combustível a Bordo
            </span>
            <span className="font-mono text-[11px] font-bold text-slate-800 tabular-nums">
              {fuelKg !== null ? `${fuelKg} kg` : '—'}{' '}
              <span className="text-slate-500 font-normal">
                ({fuelPct !== null ? `${fuelPct}%` : '—'})
              </span>
            </span>
          </div>

          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                fuelPct !== null && fuelPct < 15
                  ? 'bg-red-500'
                  : fuelPct !== null && fuelPct < 35
                    ? 'bg-amber-500'
                    : 'bg-cyan-600'
              }`}
              style={{ width: `${fuelPct ?? 0}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-600 pt-0.5">
            <div className="flex items-center gap-2">
              <span>
                Projeção:{' '}
                <strong className="font-mono text-slate-900 tabular-nums">
                  {projectedLaps !== null ? `~${projectedLaps} voltas` : '—'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Modo: <strong className="text-slate-800">{tacticalModeLabel}</strong>
              </span>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help flex items-center gap-1 font-mono tabular-nums">
                    Margem:{' '}
                    <strong
                      className={
                        fuelMarginPct === null
                          ? 'text-slate-500'
                          : fuelMarginPct >= 0
                            ? 'text-emerald-700 font-bold'
                            : 'text-red-600 font-bold'
                      }
                    >
                      {fuelMarginPct !== null
                        ? `${fuelMarginPct >= 0 ? '+' : ''}${fuelMarginPct.toFixed(1)}%`
                        : '—'}
                    </strong>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-xs bg-slate-900 text-white max-w-[220px]">
                  Estimativa considerando consumo médio e voltas restantes para completar o GP.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {isFuelCritical && (
            <div className="pt-0.5">
              <Badge className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0 flex items-center gap-1 w-fit animate-pulse">
                <AlertTriangle className="w-3 h-3" /> ECONOMIZAR COMBUSTÍVEL
              </Badge>
            </div>
          )}
        </div>

        {/* =========================================================================
            BLOCO 4 — CONDIÇÃO DO CARRO
            Integridade geral, danos, falhas, problemas detectados, estado PU
           ========================================================================= */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/90 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
              Condição do Carro
            </span>
            <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-slate-700">
              {avgPartCondition !== null && <span>Integridade {avgPartCondition}%</span>}
              {puWear !== null && (
                <span className="text-[10px] text-slate-500 font-medium">
                  PU: <strong className="text-slate-800">{Math.round(puWear)}% desg.</strong>
                </span>
              )}
            </div>
          </div>

          {hasCarProblems ? (
            <div className="space-y-1.5 pt-0.5">
              {hasWingDmg && (
                <div className="p-1.5 rounded bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Asa Dianteira com Danos
                  </span>
                  <Badge className="bg-amber-600 text-white text-[9px] px-1 py-0">
                    Reparo no Box
                  </Badge>
                </div>
              )}

              {driverIssues.map((iss, iIdx) => (
                <div
                  key={iIdx}
                  className="p-1.5 rounded bg-red-50 border border-red-300 text-red-900 text-[11px] flex items-center justify-between"
                >
                  <span className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    {iss.name} ({iss.severity})
                  </span>
                  <span className="text-[10px] font-bold text-red-700">Falha Mecânica</span>
                </div>
              ))}

              {brokenParts.map((bp) => (
                <div
                  key={bp.id}
                  className="p-1.5 rounded bg-red-50 border border-red-200 text-red-700 text-[10px] flex items-center justify-between"
                >
                  <span>
                    Componente: <strong>{bp.name}</strong>
                  </span>
                  <span className="font-mono font-bold text-red-600">{bp.condition}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Sem problemas detectados.</span>
            </div>
          )}
        </div>

        {/* =========================================================================
            BLOCO 5 — ESTRATÉGIA
            Plano atual, próxima parada prevista, composto previsto, confiança,
            recomendação atual da engenharia se existente (destaque discreto)
           ========================================================================= */}
        {(headlineStrategy || plannedPitLap || pendingRecommendation) && (
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                <Compass className="w-3.5 h-3.5 text-blue-600" />
                Estratégia de Corrida
              </span>
              {strategyConfidence && (
                <span className="text-[10px] font-semibold text-slate-500 capitalize">
                  Confiança: <strong className="text-slate-800">{strategyConfidence}</strong>
                </span>
              )}
            </div>

            {headlineStrategy && (
              <p className="text-[11px] font-medium text-slate-700 leading-snug">
                {headlineStrategy}
              </p>
            )}

            {(plannedPitLap || plannedCompound) && (
              <div className="flex items-center justify-between text-[10px] text-slate-600 pt-0.5 border-t border-slate-200/60">
                <span>
                  Próxima parada prevista:{' '}
                  <strong className="font-mono text-slate-900">
                    {plannedPitLap ? `Volta ${plannedPitLap}` : '—'}
                  </strong>
                </span>
                {plannedCompound && (
                  <span>
                    Composto previsto:{' '}
                    <strong className="capitalize text-slate-900">{plannedCompound}</strong>
                  </span>
                )}
              </div>
            )}

            {/* Recomendação ativa da engenharia em destaque discreto */}
            {pendingRecommendation && (
              <div className="mt-1.5 p-2 rounded-md bg-amber-50/80 border border-amber-300 text-amber-950 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-black text-[10px] uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-600" />
                    Recomendação da Engenharia
                  </span>
                  {recConfidence && (
                    <span className="font-mono text-[9px] font-bold text-amber-800">
                      Confiança: {recConfidence}
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium leading-relaxed">
                  {recJustification || pendingRecommendation.title}
                </p>
                {recProposedCompound && (
                  <p className="text-[10px] font-mono text-amber-900 font-bold">
                    Sugerido: Instalar composto {recProposedCompound.toUpperCase()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            BLOCO 6 — CONTROLES TÁTICOS (RITMO & MODO DA POWER UNIT)
           ========================================================================= */}
        <div className="space-y-2 pt-1 border-t border-slate-200/70">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span title="Ritmo de pilotagem na pista (poupar, padrão ou empurrar)">
              Ordem de Ritmo{' '}
              <span className="text-[9px] text-slate-400 font-normal">(pneu/tempo)</span>:
            </span>
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => onChangePaceOrder(car.driverId, 'segurar')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  paceOrder === 'segurar'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Poupar
              </button>
              <button
                type="button"
                onClick={() => onChangePaceOrder(car.driverId, 'normal')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  paceOrder === 'normal'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => onChangePaceOrder(car.driverId, 'empurrar')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  paceOrder === 'empurrar'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Aumentar
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span title="Modo do trem de força e consumo de combustível (ataque, padrão ou economia)">
              Modo Tático{' '}
              <span className="text-[9px] text-slate-400 font-normal">(PU/combustível)</span>:
            </span>
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => onChangeTacticalMode(car.driverId, 'attack')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  tacticalMode === 'attack'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ataque
              </button>
              <button
                type="button"
                onClick={() => onChangeTacticalMode(car.driverId, 'normal')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  tacticalMode === 'normal'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Padrão
              </button>
              <button
                type="button"
                onClick={() => onChangeTacticalMode(car.driverId, 'save_fuel')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  tacticalMode === 'save_fuel'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Eco
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            BLOCO 7 — RODAPÉ DE AÇÕES OPERACIONAIS
            [Rádio Pit Wall] e [Box este giro] com handlers canônicos
           ========================================================================= */}
        <div className="pt-2 grid grid-cols-2 gap-2 border-t border-slate-200">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenRadio(car.driverId)}
            className="border-slate-300 text-slate-800 hover:bg-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 h-8.5 shadow-2xs"
          >
            <Radio className="w-3.5 h-3.5 text-indigo-600" />
            Rádio Pit Wall
          </Button>

          <Button
            size="sm"
            onClick={() => onCallBox(car.driverId)}
            disabled={car.dnf}
            className="bg-[#E10600] hover:bg-[#C10500] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 h-8.5 shadow-xs"
          >
            <Wrench className="w-3.5 h-3.5" />
            Box este giro
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
