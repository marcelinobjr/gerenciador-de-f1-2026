/**
 * canonicalRaceWeatherService.ts
 *
 * RACE-PAGE-01A — Serviço Determinístico de Clima Inicial e Condições de Pista.
 *
 * Requisito 7:
 * Condições iniciais geradas de forma ALEATÓRIA MAS DETERMINÍSTICA,
 * com seed persistente ligada a career/season/round (F5 NÃO muda o clima).
 * Campos:
 * - temperatura ambiente (airTempC)
 * - temperatura de pista (trackTempC)
 * - pista seca/molhada (trackCondition / isWet)
 * - chance de chuva (rainProbabilityPct)
 * - vento (windSpeedKmh, windDirection)
 * - aderência (trackGripPct, trackGripLabel)
 */

import { weatherGenerator } from '@/services/weatherGenerator'
import type { TrackWeatherState } from '@/lib/f1-tire-system'
import type { RaceCondition } from '@/types/climate'

export interface CanonicalRaceInitialWeather {
  careerId: string
  seasonYear: number
  round: number
  seed: number
  airTempC: number
  trackTempC: number
  isWet: boolean
  trackStatus: 'Pista Seca' | 'Pista Úmida' | 'Pista Molhada'
  trackWeatherState: TrackWeatherState
  raceCondition: RaceCondition
  rainProbabilityPct: number
  windSpeedKmh: number
  windDirection: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'
  trackGripPct: number
  trackGripLabel: 'Normal' | 'Ótima' | 'Baixa' | 'Muito Baixa'
  summaryLabel: string
}

export function resolveDeterministicRaceWeather(params: {
  careerId: string
  seasonYear: number
  round: number
  circuitId?: string
  circuitName?: string
  country?: string
  totalLaps?: number
}): CanonicalRaceInitialWeather {
  const { careerId, seasonYear, round, circuitId, circuitName, country, totalLaps = 57 } = params

  const seed = weatherGenerator.deriveSeed({
    careerId,
    seasonYear,
    round,
  })

  const weatherEvent = weatherGenerator.generateRaceWeekendWeather({
    careerId,
    seasonYear,
    round,
    circuitId,
    circuitName,
    country,
    totalLaps,
  })

  // Gerador Mulberry32 baseado na mesma seed para campos derivados adicionais
  const rng = weatherGenerator.sampleRainIntensity
    ? () => {
        // sub-rng determinístico usando seed
        let t = (seed + 777) >>> 0
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    : () => 0.5

  const rollVento = rng()
  const windSpeedKmh = Math.round(8 + rollVento * 22) // 8 a 30 km/h
  const directions: CanonicalRaceInitialWeather['windDirection'][] = [
    'N',
    'NE',
    'E',
    'SE',
    'S',
    'SW',
    'W',
    'NW',
  ]
  const windDirection = directions[Math.floor(rollVento * directions.length)] || 'NE'

  const isWet =
    weatherEvent.initialWeather === 'chuva_fraca' || weatherEvent.initialWeather === 'chuva_forte'
  const trackStatus = isWet
    ? weatherEvent.initialWeather === 'chuva_forte'
      ? 'Pista Molhada'
      : 'Pista Úmida'
    : 'Pista Seca'

  // Aderência calculada a partir de pista seca/molhada e temperatura
  let trackGripPct: number
  let trackGripLabel: CanonicalRaceInitialWeather['trackGripLabel']

  if (weatherEvent.initialWeather === 'chuva_forte') {
    trackGripPct = 58
    trackGripLabel = 'Muito Baixa'
  } else if (weatherEvent.initialWeather === 'chuva_fraca') {
    trackGripPct = 72
    trackGripLabel = 'Baixa'
  } else {
    // Pista seca
    trackGripPct = Math.min(
      100,
      Math.max(88, Math.round(92 + (weatherEvent.trackTempC - 25) * 0.3)),
    )
    trackGripLabel = trackGripPct >= 95 ? 'Ótima' : 'Normal'
  }

  // Chance de chuva aparente para a rodada
  let rainProbabilityPct = 10
  if (weatherEvent.raceCondition === 'WET') {
    rainProbabilityPct = 95
  } else if (weatherEvent.raceCondition === 'VARIABLE') {
    rainProbabilityPct = 70
  } else {
    // Corrida seca
    rainProbabilityPct = Math.round(5 + rng() * 15)
  }

  return {
    careerId,
    seasonYear,
    round,
    seed,
    airTempC: weatherEvent.airTempC,
    trackTempC: weatherEvent.trackTempC,
    isWet,
    trackStatus,
    trackWeatherState: weatherEvent.initialWeather,
    raceCondition: weatherEvent.raceCondition,
    rainProbabilityPct,
    windSpeedKmh,
    windDirection,
    trackGripPct,
    trackGripLabel,
    summaryLabel: weatherEvent.summaryLabel,
  }
}
