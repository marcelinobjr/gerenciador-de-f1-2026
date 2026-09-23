/**
 * canonical-tire-strategy.ts
 *
 * Módulo Canônico FC02C — PNEUS
 * Centraliza cálculos de vida útil de pneus, estimativas de autonomia,
 * janelas recomendadas de pit stop e faixas canônicas de degradação.
 *
 * Regras FC02C:
 * - A UI NUNCA calcula lógica de pneu — apenas consome este módulo canônico.
 * - Baseia-se em TIRE_SPECS de src/lib/f1-tire-system.ts como fonte canônica.
 */

import {
  TIRE_SPECS,
  type TireCliffStatus,
  type CarTireDisplayState,
  selectCarTireDisplayState,
  calculateDriverTireWearProfile,
} from './f1-tire-system'
import type { TireCompound } from '@/types/f1'

export interface EstimateCompoundLifespanParams {
  driverWearMultiplier?: number
  trackAbrasiveness?: number // 1-10 (padrão 6)
  initialWearPct?: number // 0-100% de desgaste inicial (ex: jogo usado)
}

export interface CompoundLifespanEstimate {
  compound: TireCompound
  usefulLaps: number
  maximumLaps: number
  wearFactor: number
  cliffLap: number
  driverFactor: number
  trackFactor: number
  priorLifeDiscount: number
}

/**
 * 1. estimateCompoundLifespanLaps
 *
 * Fórmula canônica FC02C:
 * fatorPiloto = clamp(driverWearMultiplier ?? 1.0, 0.75, 1.35);
 * fatorPista = 1 + ((trackAbrasiveness ?? 6) - 5) * 0.07;
 * descontoVidaPrevia = max(0, 1 - (initialWearPct ?? 0) / 100);
 * usefulLaps = max(1, round((spec.cliffLapThreshold / (fatorPiloto * fatorPista)) * descontoVidaPrevia));
 * maximumLaps = max(1, round((spec.baseLapsLife / (fatorPiloto * fatorPista)) * descontoVidaPrevia));
 */
export function estimateCompoundLifespanLaps(
  compound: TireCompound,
  params: EstimateCompoundLifespanParams = {},
): CompoundLifespanEstimate {
  const spec = TIRE_SPECS[compound] || TIRE_SPECS.medio

  const driverWearMultiplier = params.driverWearMultiplier ?? 1.0
  const trackAbrasiveness = params.trackAbrasiveness ?? 6
  const initialWearPct = params.initialWearPct ?? 0

  const driverFactor = Math.max(0.75, Math.min(1.35, driverWearMultiplier))
  const trackFactor = 1 + (trackAbrasiveness - 5) * 0.07
  const priorLifeDiscount = Math.max(0, 1 - initialWearPct / 100)

  const effectiveDivisor = driverFactor * trackFactor

  const usefulLaps = Math.max(
    1,
    Math.round((spec.cliffLapThreshold / effectiveDivisor) * priorLifeDiscount),
  )

  const maximumLaps = Math.max(
    1,
    Math.round((spec.baseLapsLife / effectiveDivisor) * priorLifeDiscount),
  )

  return {
    compound,
    usefulLaps,
    maximumLaps,
    wearFactor: spec.wearFactor,
    cliffLap: usefulLaps,
    driverFactor,
    trackFactor,
    priorLifeDiscount,
  }
}

export interface CalculateRecommendedPitWindowParams {
  currentStintCompound: TireCompound
  totalRaceLaps: number
  currentLap?: number
  driverWearMultiplier?: number
  trackAbrasiveness?: number
  initialWearPct?: number
  stintNumber?: number
  totalStintsPlanned?: number
  nextCompoundPreference?: TireCompound
}

export interface RecommendedPitWindowResult {
  optimalLap: number
  windowStart: number
  windowEnd: number
  stintNumber: number
  compound: TireCompound
  recommendedNextCompound: TireCompound
  windowText: string // "Voltas 18–22"
}

/**
 * 2. calculateRecommendedPitWindow
 *
 * Calcula a janela ótima e recomendada de pit stop:
 * - A janela nunca excede o cliff do composto atual.
 * - Respeita rigorosamente totalRaceLaps.
 * - Suporta múltiplas paradas coerentemente.
 */
export function calculateRecommendedPitWindow(
  params: CalculateRecommendedPitWindowParams,
): RecommendedPitWindowResult {
  const {
    currentStintCompound,
    totalRaceLaps,
    currentLap = 1,
    driverWearMultiplier,
    trackAbrasiveness,
    initialWearPct,
    stintNumber = 1,
    totalStintsPlanned = 2,
    nextCompoundPreference,
  } = params

  const safeTotalLaps = Math.max(1, totalRaceLaps)
  const lifespan = estimateCompoundLifespanLaps(currentStintCompound, {
    driverWearMultiplier,
    trackAbrasiveness,
    initialWearPct,
  })

  // Cliff do composto limita a vida útil máxima do stint
  const stintMaxUsable = lifespan.usefulLaps

  // Próximo composto recomendado caso não especificado
  let recommendedNextCompound: TireCompound = nextCompoundPreference || 'duro'
  if (!nextCompoundPreference) {
    if (currentStintCompound === 'macio') {
      recommendedNextCompound = 'medio'
    } else if (currentStintCompound === 'medio') {
      recommendedNextCompound = 'duro'
    } else if (currentStintCompound === 'duro') {
      recommendedNextCompound = 'medio'
    } else if (currentStintCompound === 'intermediario') {
      recommendedNextCompound = 'intermediario'
    } else if (currentStintCompound === 'chuva_extrema') {
      recommendedNextCompound = 'intermediario'
    }
  }

  // Divisão de paradas se for stint 1 de múltiplas paradas ou stint intermediário
  let rawOptimal: number
  if (totalStintsPlanned >= 3 && stintNumber === 1) {
    // 2 paradas: 1º stint ~28-35% da corrida, mas nunca excedendo o cliff do composto
    rawOptimal = Math.round(safeTotalLaps * 0.3)
  } else if (totalStintsPlanned >= 3 && stintNumber === 2) {
    // 2 paradas: 2º stint ~65% da corrida
    rawOptimal = Math.round(safeTotalLaps * 0.65)
  } else {
    // 1 parada padrão (2 stints): ~40-48% da corrida
    rawOptimal = Math.round(safeTotalLaps * 0.44)
  }

  // O pit stop deve ocorrer dentro da vida útil do composto (antes do cliff)
  // Mas pelo menos na volta 2 ou currentLap se estivermos correndo
  const effectiveMaxPitLap = Math.min(safeTotalLaps - 1, stintMaxUsable)
  let optimalLap = Math.max(2, Math.min(effectiveMaxPitLap, rawOptimal))

  // Se totalRaceLaps for muito curto (ex: sprint ou corrida curta), garantir limites consistentes
  if (optimalLap >= safeTotalLaps) {
    optimalLap = Math.max(1, safeTotalLaps - 1)
  }

  // Janela recomendada: tipicamente ±2 voltas da volta ótima, sem passar do cliff nem de totalRaceLaps
  const windowStart = Math.max(1, optimalLap - 2)
  const windowEnd = Math.min(stintMaxUsable, Math.min(safeTotalLaps - 1, optimalLap + 2))

  // Garantir windowStart <= windowEnd
  const finalStart = Math.min(windowStart, windowEnd)
  const finalEnd = Math.max(finalStart, windowEnd)

  const windowText = `Voltas ${finalStart}–${finalEnd}`

  return {
    optimalLap,
    windowStart: finalStart,
    windowEnd: finalEnd,
    stintNumber,
    compound: currentStintCompound,
    recommendedNextCompound,
    windowText,
  }
}

export type TireDegradationBandKey = 'nominal' | 'moderada' | 'alerta' | 'critica'

export interface TireDegradationBandInfo {
  key: TireDegradationBandKey
  label: 'Nominal' | 'Moderada' | 'Alerta' | 'Cliff/Janela Crítica'
  colorClass: string // ex: "bg-emerald-500", "bg-amber-500", etc.
  textColorClass: string
  borderColorClass: string
  animatePulse: boolean
  wearPct: number
  conditionPct: number
  isCritical: boolean
}

/**
 * 3. getTireDegradationBand
 *
 * Faixas canônicas FC02C:
 * - 0–25% verde (bg-emerald-500, Nominal)
 * - 26–59% âmbar (bg-amber-500, Moderada)
 * - 60–79% laranja (bg-orange-500, Alerta)
 * - ≥80% ou cliff vermelho pulsante (bg-rose-600 animate-pulse, Cliff/Janela Crítica)
 */
export function getTireDegradationBand(
  wearPct: number | null | undefined,
  isInCliff: boolean = false,
): TireDegradationBandInfo {
  const safeWear =
    typeof wearPct === 'number' && !Number.isNaN(wearPct)
      ? Math.max(0, Math.min(100, Math.round(wearPct)))
      : 0

  const conditionPct = Math.max(0, 100 - safeWear)

  if (isInCliff || safeWear >= 80) {
    return {
      key: 'critica',
      label: 'Cliff/Janela Crítica',
      colorClass: 'bg-rose-600 animate-pulse',
      textColorClass: 'text-rose-500',
      borderColorClass: 'border-rose-600/40',
      animatePulse: true,
      wearPct: safeWear,
      conditionPct,
      isCritical: true,
    }
  }

  if (safeWear >= 60) {
    return {
      key: 'alerta',
      label: 'Alerta',
      colorClass: 'bg-orange-500',
      textColorClass: 'text-orange-500',
      borderColorClass: 'border-orange-500/40',
      animatePulse: false,
      wearPct: safeWear,
      conditionPct,
      isCritical: false,
    }
  }

  if (safeWear >= 26) {
    return {
      key: 'moderada',
      label: 'Moderada',
      colorClass: 'bg-amber-500',
      textColorClass: 'text-amber-500',
      borderColorClass: 'border-amber-500/40',
      animatePulse: false,
      wearPct: safeWear,
      conditionPct,
      isCritical: false,
    }
  }

  return {
    key: 'nominal',
    label: 'Nominal',
    colorClass: 'bg-emerald-500',
    textColorClass: 'text-emerald-500',
    borderColorClass: 'border-emerald-500/40',
    animatePulse: false,
    wearPct: safeWear,
    conditionPct,
    isCritical: false,
  }
}

/**
 * Formata texto resumido de autonomia do composto para a UI pré-corrida.
 * Ex: "Macio: ~11-13v", "Médio: ~24-26v", "Duro: ~38-40v"
 */
export function formatCompoundLifespanBadge(
  compound: TireCompound,
  params: EstimateCompoundLifespanParams = {},
): string {
  const estimate = estimateCompoundLifespanLaps(compound, params)
  const spec = TIRE_SPECS[compound] || TIRE_SPECS.medio
  return `${spec.label}: ~${estimate.usefulLaps}-${estimate.maximumLaps}v`
}

export {
  TIRE_SPECS,
  type TireCliffStatus,
  type CarTireDisplayState,
  selectCarTireDisplayState,
  calculateDriverTireWearProfile,
}
