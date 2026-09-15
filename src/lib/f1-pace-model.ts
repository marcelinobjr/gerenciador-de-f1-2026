import { TireCompound } from '@/types/f1'
import { TIRE_SPECS, calculateTireCliffStatus, TrackWeatherState } from './f1-tire-system'

export interface DriverPaceAttributes {
  speed: number // 75-96
  consistency?: number
  defense?: number
  rain?: number
  morale?: number
  physicalCondition?: number
}

import { TechnicalAttributesMap, TechnicalComponentId } from '@/types/car-technical-model'
import {
  CircuitPerformanceProfile,
  resolveCircuitProfile,
} from '@/data/circuit-performance-profiles'
import { calculateTrackFit, calculateCarPerformance } from './car-session-performance-engine'

export interface PaceCalculationParams {
  teamStrength: number // 3.0 a 10.0 (ou 30 a 100) - Fallback de compatibilidade
  carLevel?: number // 0 a 100
  driver: DriverPaceAttributes
  weather?: TrackWeatherState
  tireCompound?: TireCompound
  lapsOnTire?: number
  wearPercent?: number
  wearMultiplier?: number
  trackAbrasiveness?: number
  setupPenalty?: number
  engineWearPenalty?: number
  poolPenalty?: number
  noise?: number // ruído aleatório ±0.3 a ±0.6s
  isQualifying?: boolean
  // Integração Canônica Fase 0B:
  technicalAttributes?: TechnicalAttributesMap
  circuit?: CircuitPerformanceProfile | { round?: number; circuitId?: string; circuitName?: string }
  chassisRating?: number
  powerUnitRating?: number
  carPerformanceRating?: number
  componentConditions?: Partial<Record<TechnicalComponentId, number>>
  hasFrontWingDamage?: boolean
}

export interface PaceResult {
  lapTimeSec: number // Tempo de volta em segundos
  lapScore: number // Lap score compatível com o ranking do jogo
  cliffStatus: ReturnType<typeof calculateTireCliffStatus>
  carFactor: number // Contribuição do carro (0-100)
  driverFactor: number // Contribuição do piloto (0-100)
  combinedPerformance: number // 0-100 (65-75% carro + 25-35% piloto)
  paceVerdict: string
  trackFitScore?: number
  auditLog?: string
}

/**
 * Normaliza o valor de força da equipe para a escala 0-100.
 * Aceita tanto 3.0-10.0 quanto 30-100.
 */
export function normalizeCarStrength(strength: number): number {
  if (strength <= 10) {
    return Math.max(0, Math.min(100, strength * 10))
  }
  return Math.max(0, Math.min(100, strength))
}

/**
 * Converte a nota do piloto (75 a 96) em score ponderado considerando clima e consistência.
 */
export function calculateDriverSkillScore(
  driver: DriverPaceAttributes,
  weather: TrackWeatherState = 'seco',
): number {
  const speed = driver.speed ?? 80
  const consistency = driver.consistency ?? 80
  const defense = driver.defense ?? 80
  const rain = driver.rain ?? speed
  const morale = driver.morale ?? 80
  const fitness = driver.physicalCondition ?? 90

  const moraleBonus = (morale - 80) * 0.12
  const fitnessBonus = (fitness - 85) * 0.1

  let baseSkill = speed * 0.5 + consistency * 0.35 + defense * 0.15

  if (weather === 'chuva_fraca') {
    baseSkill = speed * 0.3 + rain * 0.45 + consistency * 0.25
  } else if (weather === 'chuva_forte') {
    baseSkill = speed * 0.2 + rain * 0.6 + consistency * 0.2
  }

  return Math.max(50, Math.min(100, baseSkill + moraleBonus + fitnessBonus))
}

/**
 * Calcula o ritmo combinado de um carro + piloto.
 * Calibração:
 * - Carro tem peso de 70%
 * - Piloto tem peso de 30%
 * - Em pista seca, a diferença entre o melhor carro (Mercedes 10.0) e o pior (Cadillac 3.0)
 *   é de ~2.8 a 3.2 segundos.
 * - A diferença entre o melhor piloto (Verstappen 96) e um mediano (80) no mesmo carro
 *   é de ~0.6 a 0.85s por volta.
 * - Isso garante:
 *   1. Verstappen (96) num carro médio (Audi/Haas ~5.0) supera o companheiro por ampla margem,
 *      mas não vence Mercedes (10.0) com piloto decente.
 *   2. Piloto nota 82 na Mercedes (10.0) é competitivo e vence corridas.
 *   3. Cadillac (3.0) não pontua/vence em condições normais.
 */
export function calculateCombinedPace(params: PaceCalculationParams): PaceResult {
  const {
    teamStrength,
    carLevel,
    driver,
    weather = 'seco',
    tireCompound = 'medio',
    lapsOnTire = 0,
    wearPercent = 0,
    wearMultiplier = 1.0,
    trackAbrasiveness = 6,
    setupPenalty = 0,
    engineWearPenalty = 0,
    poolPenalty = 0,
    noise = 0,
  } = params

  const normCarStrength = normalizeCarStrength(teamStrength)
  const effectiveCarLevel = carLevel !== undefined ? carLevel : normCarStrength

  // INTEGRAÇÃO FASE 0B: Se atributos técnicos e perfil de circuito forem providos,
  // consome o Modelo Técnico do Carro (Track Fit + Car Performance).
  // Caso contrário, usa o carFactor legado como fallback seguro de compatibilidade.
  let carFactor: number
  let calculatedTrackFit: number | undefined

  if (params.technicalAttributes && params.circuit) {
    const profile =
      'weights' in params.circuit
        ? params.circuit
        : resolveCircuitProfile({
            circuitId: (params.circuit as any).circuitId,
            round: (params.circuit as any).round,
            circuitName: (params.circuit as any).circuitName,
          })

    const { trackFitScore } = calculateTrackFit(params.technicalAttributes, profile)
    calculatedTrackFit = trackFitScore

    const carPerf = calculateCarPerformance({
      chassisRating: params.chassisRating ?? effectiveCarLevel,
      powerUnitRating: params.powerUnitRating ?? 85,
      carPerformanceRating: params.carPerformanceRating,
      legacyTeamStrength: normCarStrength,
    })

    // Carro efetivo na pista = 55% qualidade intrínseca + 45% adequação ao traçado
    carFactor = carPerf * 0.55 + trackFitScore * 0.45

    // Penalidade física de danos/fadiga se especificada
    if (params.hasFrontWingDamage) {
      carFactor -= 3.5
    }
  } else {
    // Fallback legado seguro
    carFactor = effectiveCarLevel * 0.6 + normCarStrength * 0.4
  }

  const driverFactor = calculateDriverSkillScore(driver, weather)

  // Combinação Carro (70%) + Piloto (30%)
  const combinedPerformance = Math.max(25, Math.min(100, carFactor * 0.7 + driverFactor * 0.3))

  // Base de tempo por volta em circuito padrão (ex: 74.0s para carro/piloto perfeitos 100)
  // Escala de tempo:
  // Carro 100 + Piloto 96 => combined ~98.8 => ~74.2s
  // Carro 50 + Piloto 96 => combined ~63.8 => ~76.8s (+2.6s)
  // Carro 30 + Piloto 79 => combined ~44.7 => ~78.8s (+4.6s)
  const baseReferenceSec = 74.0
  const performanceGapSec = (100 - combinedPerformance) * 0.082

  // Moduladores adicionais:
  // 1. Pneus (delta do composto vs Médio)
  const compoundSpec = TIRE_SPECS[tireCompound] || TIRE_SPECS.medio
  const compoundDeltaSec = compoundSpec.deltaPerLapSec

  // 2. Desgaste percentual padrão do pneu
  const wearDeltaSec = (wearPercent / 100) * 1.6

  // 3. Cliff do pneu
  const cliffStatus = calculateTireCliffStatus({
    compound: tireCompound,
    lapsOnTire,
    wearPercent,
    wearMultiplier,
    trackAbrasiveness,
  })
  const cliffPenaltySec = cliffStatus.extraLapTimeSec

  // 4. Clima x Adequação do pneu
  let weatherDeltaSec = 0
  if (weather === 'seco') {
    if (tireCompound === 'intermediario') weatherDeltaSec = 3.8
    if (tireCompound === 'chuva_extrema') weatherDeltaSec = 6.5
  } else if (weather === 'chuva_fraca') {
    if (tireCompound === 'duro' || tireCompound === 'medio' || tireCompound === 'macio') {
      weatherDeltaSec = 4.2
    } else if (tireCompound === 'intermediario') {
      weatherDeltaSec = -0.5
    } else if (tireCompound === 'chuva_extrema') {
      weatherDeltaSec = 1.0
    }
  } else if (weather === 'chuva_forte') {
    if (tireCompound === 'duro' || tireCompound === 'medio' || tireCompound === 'macio') {
      weatherDeltaSec = 9.0
    } else if (tireCompound === 'intermediario') {
      weatherDeltaSec = 2.4
    } else if (tireCompound === 'chuva_extrema') {
      weatherDeltaSec = -0.8
    }
  }

  // 5. Penalidades mecânicas e de setup
  const mechanicalPenaltySec = (setupPenalty + engineWearPenalty + poolPenalty) * 0.08

  const finalLapTimeSec =
    baseReferenceSec +
    performanceGapSec +
    compoundDeltaSec +
    wearDeltaSec +
    cliffPenaltySec +
    weatherDeltaSec +
    mechanicalPenaltySec +
    noise

  // Lap Score (quanto maior melhor, base ~100 para Top car + top driver)
  const lapScore =
    combinedPerformance * 1.15 -
    (compoundDeltaSec + wearDeltaSec + cliffPenaltySec + weatherDeltaSec + mechanicalPenaltySec) *
      12 -
    noise * 10

  let paceVerdict = 'Médio'
  if (combinedPerformance >= 90) {
    paceVerdict = 'Ritmo de Ponta / Vitória'
  } else if (combinedPerformance >= 80) {
    paceVerdict = 'Briga por Pódio'
  } else if (combinedPerformance >= 70) {
    paceVerdict = 'Zona de Pontos Regular'
  } else if (combinedPerformance >= 58) {
    paceVerdict = 'Pelotão Intermediário'
  } else {
    paceVerdict = 'Fundo de Grid'
  }

  return {
    lapTimeSec: Number(finalLapTimeSec.toFixed(3)),
    lapScore: Number(lapScore.toFixed(2)),
    cliffStatus,
    carFactor: Number(carFactor.toFixed(1)),
    driverFactor: Number(driverFactor.toFixed(1)),
    combinedPerformance: Number(combinedPerformance.toFixed(1)),
    paceVerdict,
    trackFitScore: calculatedTrackFit,
  }
}
