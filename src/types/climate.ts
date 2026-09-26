import type { TrackWeatherState } from '@/lib/f1-tire-system'

/**
 * Intensidade de precipitação quando há chuva.
 */
export type RainIntensity = 'LIGHT' | 'MEDIUM' | 'HEAVY'

/**
 * Condição macro geral sorteada para a edição do GP.
 */
export type RaceCondition = 'DRY' | 'WET' | 'VARIABLE'

/**
 * CAMADA A — Climatologia do GP (ClimateProfile)
 * Características médias/típicas de cada circuito no período do GP.
 * Regra crítica: rainProbability NÃO é % de voltas com chuva, mas sim a probabilidade
 * do evento de ocorrer chuva naquela edição do GP.
 */
export interface ClimateProfile {
  circuitId: string // ex: 'circuit_01'
  round: number // 1 a 24
  gpName: string
  circuitName: string
  country: string
  avgAirTempC: number // ex: 23°C
  tempVariationC: number // ex: ±4°C
  rainProbability: number // 0.00 a 1.00 (probabilidade de a edição ter chuva)
  weatherVariability: number // 0.00 a 1.00 (propensão a transições de clima durante a corrida)
  rainIntensityDistribution: {
    light: number // ex: 0.50
    medium: number // ex: 0.35
    heavy: number // ex: 0.15 (soma ~ 1.00)
  }
  transitionProbability: number // probabilidade de ocorrência de mudança intra-sessão
}

/**
 * Transição climática específica na corrida
 */
export interface WeatherTransition {
  lap: number
  condition: TrackWeatherState // 'seco' | 'chuva_fraca' | 'chuva_forte'
  rainIntensity?: RainIntensity
  description?: string
}

/**
 * CAMADA B — Weather Event (RaceWeekendWeather)
 * Condições sorteadas determinística e estavelmente para uma edição específica do GP.
 */
export interface RaceWeekendWeather {
  circuitId: string
  round: number
  airTempC: number
  trackTempC: number
  raceCondition: RaceCondition // 'DRY' | 'WET' | 'VARIABLE'
  rainIntensity?: RainIntensity
  initialWeather: TrackWeatherState // 'seco' | 'chuva_fraca' | 'chuva_forte'
  transitions: WeatherTransition[]
  summaryLabel: string // 'Seco', 'Chuva Leve', 'Variável (Seco → Chuva)', etc.
  seed: number
}
