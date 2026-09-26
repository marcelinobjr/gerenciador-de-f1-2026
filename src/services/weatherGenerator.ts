import type { TrackWeatherState } from '@/lib/f1-tire-system'
import type {
  ClimateProfile,
  RaceCondition,
  RaceWeekendWeather,
  RainIntensity,
  WeatherTransition,
} from '@/types/climate'
import { getClimateProfile } from '@/data/canonicalClimateProfiles'

export interface GenerateWeatherOptions {
  careerId?: string
  seasonYear?: number
  round: number
  totalLaps?: number
  seedOverride?: number
  circuitId?: string
  circuitName?: string
  country?: string
}

/**
 * Converte string composta de semente em número de 32 bits determinístico.
 */
export function hashStringToSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Gerador pseudo-aleatório determinístico Mulberry32.
 * Garante reprodutibilidade idêntica em qualquer plataforma/runtime.
 */
export function createMulberry32(seed: number): () => number {
  let t = (seed += 0x6d2b79f5)
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * WeatherGenerator — Gerador determinístico de condições meteorológicas para o fim de semana / corrida (Camada B).
 *
 * Princípios e Invariantes:
 * 1. Fonte única de verdade: consome estritamente o ClimateProfile (Camada A).
 * 2. Determinismo rigoroso: mesma seed + mesma carreira + mesma temporada + mesmo GP -> exatamente o mesmo RaceWeekendWeather.
 * 3. Categorias: DRY, WET, VARIABLE.
 * 4. Transições consumíveis pelo motor de corrida: { lap, condition: TrackWeatherState, rainIntensity, description }.
 * 5. Não utiliza Math.random() descontrolado.
 */
export const weatherGenerator = {
  /**
   * Deriva a semente numérica final estável a partir de carreira, temporada e rodada.
   */
  deriveSeed(opts: {
    careerId?: string
    seasonYear?: number
    round: number
    seedOverride?: number
  }): number {
    if (typeof opts.seedOverride === 'number') {
      return opts.seedOverride >>> 0 || 123456
    }
    const cId = opts.careerId || 'canonical_career_default'
    const sYear = opts.seasonYear || 2026
    const r = opts.round
    const key = `weather_${cId}_s${sYear}_r${r}`
    return hashStringToSeed(key)
  },

  /**
   * Sorteia a intensidade da chuva a partir da distribuição do ClimateProfile.
   */
  sampleRainIntensity(
    dist: ClimateProfile['rainIntensityDistribution'],
    rng: () => number,
  ): RainIntensity {
    const roll = rng()
    const l = dist.light
    const m = dist.light + dist.medium
    if (roll < l) return 'LIGHT'
    if (roll < m) return 'MEDIUM'
    return 'HEAVY'
  },

  /**
   * Converte a intensidade de chuva para o tipo de pista consumido pelo motor (TrackWeatherState).
   */
  intensityToTrackWeather(intensity: RainIntensity): TrackWeatherState {
    switch (intensity) {
      case 'LIGHT':
      case 'MEDIUM':
        return 'chuva_fraca'
      case 'HEAVY':
        return 'chuva_forte'
      default:
        return 'chuva_fraca'
    }
  },

  /**
   * Gera o evento climático completo determinístico para um GP.
   */
  generateRaceWeekendWeather(opts: GenerateWeatherOptions): RaceWeekendWeather {
    const profile = getClimateProfile({
      circuitId: opts.circuitId,
      round: opts.round,
      circuitName: opts.circuitName,
      country: opts.country,
    })

    const seed = this.deriveSeed(opts)
    const rng = createMulberry32(seed)

    const totalLaps = Math.max(10, opts.totalLaps || 58)

    // 1. Sorteio de Temperatura
    // Variação gaussiana controlada em torno de avgAirTempC dentro de ±tempVariationC
    const u1 = Math.max(0.0001, rng())
    const u2 = rng()
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
    const deltaT = Math.round((z / 2.0) * profile.tempVariationC)
    const clampedDelta = Math.max(-profile.tempVariationC, Math.min(profile.tempVariationC, deltaT))
    const airTempC = profile.avgAirTempC + clampedDelta
    // Temperatura de pista: tipicamente +8°C a +15°C em dias ensolarados/secos, ou +2°C a +6°C na chuva
    const trackTempOffset = Math.round(8 + rng() * 6)
    const trackTempC = airTempC + trackTempOffset

    // 2. Sorteio se a edição do GP terá precipitação (rainRoll vs rainProbability)
    // Regra crítica do usuário: rainProbability determina se O EVENTO tem chuva naquela edição
    const rainRoll = rng()
    const hasRainEvent = rainRoll < profile.rainProbability

    let raceCondition: RaceCondition = 'DRY'
    let rainIntensity: RainIntensity | undefined = undefined
    let initialWeather: TrackWeatherState = 'seco'
    const transitions: WeatherTransition[] = []
    let summaryLabel = 'Seco e Estável'

    if (!hasRainEvent) {
      // Corrida totalmente seca (DRY)
      raceCondition = 'DRY'
      initialWeather = 'seco'
      summaryLabel = 'Seco e Estável'
    } else {
      // O evento sorteou chuva! Agora avalia se é chuva persistente (WET) ou condição VARIÁVEL
      const varRoll = rng()
      const isVariable = varRoll < profile.weatherVariability

      // Sorteia intensidade padrão da chuva para esta edição
      rainIntensity = this.sampleRainIntensity(profile.rainIntensityDistribution, rng)
      const wetWeatherState = this.intensityToTrackWeather(rainIntensity)

      if (!isVariable) {
        // Chuva constante durante toda a prova (WET)
        raceCondition = 'WET'
        initialWeather = wetWeatherState
        summaryLabel =
          rainIntensity === 'HEAVY'
            ? 'Chuva Forte (Pista Molhada)'
            : rainIntensity === 'MEDIUM'
              ? 'Chuva Moderada'
              : 'Chuva Leve Constante'
      } else {
        // Condição VARIÁVEL (VARIABLE) com transições dinâmicas ao longo da prova
        raceCondition = 'VARIABLE'

        // Sorteia padrão de variação:
        // Padrão 1: Seco -> Chuva (Dry -> Wet) [~45%]
        // Padrão 2: Chuva -> Seco (Wet -> Dry) [~35%]
        // Padrão 3: Seco -> Chuva -> Seco (Dry -> Wet -> Dry) [~20%]
        const patternRoll = rng()

        if (patternRoll < 0.45) {
          // Seco -> Chuva
          initialWeather = 'seco'
          const changeLap = Math.max(
            8,
            Math.min(totalLaps - 8, Math.round(totalLaps * (0.25 + rng() * 0.45))),
          )
          transitions.push({
            lap: changeLap,
            condition: wetWeatherState,
            rainIntensity,
            description: `A chuva chega à pista na volta ${changeLap}! Início de precipitação (${rainIntensity === 'HEAVY' ? 'forte' : 'leve/moderada'}).`,
          })
          summaryLabel = 'Variável (Seco → Chuva)'
        } else if (patternRoll < 0.8) {
          // Chuva -> Seco
          initialWeather = wetWeatherState
          const changeLap = Math.max(
            8,
            Math.min(totalLaps - 8, Math.round(totalLaps * (0.3 + rng() * 0.45))),
          )
          transitions.push({
            lap: changeLap,
            condition: 'seco',
            description: `A chuva cessa na volta ${changeLap}! Pista em processo de secagem.`,
          })
          summaryLabel = 'Variável (Chuva → Seco)'
        } else {
          // Seco -> Chuva -> Seco
          initialWeather = 'seco'
          const rainStartLap = Math.max(6, Math.round(totalLaps * (0.2 + rng() * 0.2)))
          const rainDuration = Math.max(6, Math.round(totalLaps * (0.2 + rng() * 0.2)))
          const rainEndLap = Math.min(totalLaps - 4, rainStartLap + rainDuration)

          transitions.push({
            lap: rainStartLap,
            condition: wetWeatherState,
            rainIntensity,
            description: `Início de chuva na volta ${rainStartLap}.`,
          })
          transitions.push({
            lap: rainEndLap,
            condition: 'seco',
            description: `Chuva cessa na volta ${rainEndLap}. Trilho seco reaparecendo.`,
          })
          summaryLabel = 'Variável (Seco → Chuva → Seco)'
        }
      }
    }

    return {
      circuitId: profile.circuitId,
      round: profile.round,
      airTempC,
      trackTempC,
      raceCondition,
      rainIntensity,
      initialWeather,
      transitions,
      summaryLabel,
      seed,
    }
  },
}
