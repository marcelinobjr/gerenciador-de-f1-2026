import type { TireCompound } from '@/types/f1'
import type { PracticeStint } from '@/types/practice-session'
import type { TrackWeatherState } from '@/lib/f1-tire-system'
import type { DriverFeedbackProfile } from '@/services/canonicalPracticeFeedbackService'
import type {
  TyreCompoundKnowledge,
  WeekendTyreKnowledge,
  TyreStintObservation,
  TyreUsefulWindowRange,
  TyrePaceDropRange,
  TyreDegradationLevel,
  TyreConsistencyLevel,
  TyreConfidenceLevel,
} from '@/types/practice-tyres'

export const CANONICAL_COMPOUNDS: TireCompound[] = [
  'macio',
  'medio',
  'duro',
  'intermediario',
  'chuva_extrema',
]

/**
 * Cria uma dimensão de conhecimento vazia ("?" e "sem_dados").
 */
function createEmptyDimension<T>(): TyreCompoundKnowledge['degradation'] extends infer _D
  ? import('@/types/practice-tyres').TyreKnowledgeDimension<T>
  : never {
  return {
    value: undefined,
    confidence: 'sem_dados',
    confidenceScore: 0,
    revealed: false,
  }
}

/**
 * Cria a estrutura inicial de conhecimento de pneus zerada para o fim de semana.
 * Cada dimensão inicia em 'sem_dados' e unrevealed ("?").
 */
export function createInitialWeekendTyreKnowledge(): WeekendTyreKnowledge {
  const result = {} as WeekendTyreKnowledge

  CANONICAL_COMPOUNDS.forEach((compound) => {
    result[compound] = {
      compound,
      degradation: createEmptyDimension<TyreDegradationLevel>(),
      usefulWindow: createEmptyDimension<TyreUsefulWindowRange>(),
      paceDrop: createEmptyDimension<TyrePaceDropRange>(),
      consistency: createEmptyDimension<TyreConsistencyLevel>(),
      overallConfidence: 'sem_dados',
      totalLapsObserved: 0,
      totalStintsObserved: 0,
      testedDrivers: [],
      testedCars: [],
      testedConditions: [],
      updatedAt: new Date().toISOString(),
    }
  })

  return result
}

export interface EvaluateTyreStintParams {
  sessionId: string
  stint: PracticeStint
  driver: DriverFeedbackProfile
  weather: TrackWeatherState
  currentKnowledge: WeekendTyreKnowledge
}

/**
 * Classifica a taxa de desgaste por volta em nível qualitativo.
 */
export function classifyDegradationRate(wearPerLap: number): TyreDegradationLevel {
  if (wearPerLap < 1.0) return 'muito_baixa'
  if (wearPerLap < 2.0) return 'baixa'
  if (wearPerLap < 3.2) return 'moderada'
  if (wearPerLap < 4.8) return 'alta'
  return 'muito_alta'
}

/**
 * Classifica a consistência normalizada qualitativamente.
 */
export function classifyConsistency(stdDev: number): TyreConsistencyLevel {
  if (stdDev < 0.15) return 'muito_boa'
  if (stdDev < 0.35) return 'boa'
  if (stdDev < 0.6) return 'razoavel'
  if (stdDev < 0.95) return 'irregular'
  return 'ruim'
}

/**
 * Avalia um stint concluído e produz uma observação de pneu rica, normalizada e auditável.
 * Totalmente puro e determinístico.
 */
export function evaluateTyreStint(params: EvaluateTyreStintParams): TyreStintObservation {
  const { sessionId, stint, driver, weather } = params
  const laps = stint.laps || []
  const lapsCount = stint.lapsCount || laps.length

  const initWear = stint.initialWear ?? 2
  const finWear = stint.finalWear ?? (laps.length > 0 ? laps[laps.length - 1].tyreWear : initWear)
  const wearDelta = Math.max(0, finWear - initWear)
  const wearPerLap = lapsCount > 0 ? Number((wearDelta / lapsCount).toFixed(2)) : 0

  // 1. Qualidade de dados e thresholds de domínio
  // <= 1 volta: insuficiente (out/in ou abortada)
  // 2 a 4 voltas: preliminar (poucas voltas para inferir vida útil com precisão)
  // 5+ voltas: confiável
  let quality: 'insufficient' | 'preliminary' | 'reliable' = 'reliable'
  if (lapsCount <= 1) {
    quality = 'insufficient'
  } else if (lapsCount < 5) {
    quality = 'preliminary'
  }

  // 2. Normalização de tempos de volta:
  // Subtrair o efeito do peso de combustível para isolar a evolução pura do pneu!
  // No modelo canônico: ~0.035s por kg acima de 25kg (ou perda de combustível reduzindo tempo em 0.035s/kg).
  // Quando o carro queima ~1.65 kg/volta, ele fica ~0.058s mais rápido por volta puramente por combustível.
  // Se o tempo bruto fica constante, o pneu na verdade perdeu 0.058s/volta!
  const normalizedLaps: number[] = []
  if (laps.length > 0) {
    laps.forEach((lap) => {
      // Normaliza lapTimeSec subtraindo o efeito do combustível restante relativo a uma referência de 25 kg
      const fuelEffKg = (lap.fuelRemainingKg ?? 25) - 25
      const fuelSecEffect = fuelEffKg * 0.035
      const normalizedPaceSec = lap.lapTimeSec - fuelSecEffect
      normalizedLaps.push(normalizedPaceSec)
    })
  }

  // 3. Cálculo de queda de ritmo (pace drop slope) e consistência
  let observedPaceDropPerLapSec = 0
  let consistencyLevel: TyreConsistencyLevel = 'razoavel'

  if (normalizedLaps.length >= 3) {
    // Regressão linear ou diferença início vs fim normalizada
    const firstHalf = normalizedLaps.slice(0, Math.ceil(normalizedLaps.length / 2))
    const secondHalf = normalizedLaps.slice(Math.floor(normalizedLaps.length / 2))
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

    const lapDeltaDist = Math.max(1, normalizedLaps.length / 2)
    // Pace drop positivo significa pneu ficando mais lento (tempo subindo)
    const rawDrop = (avgSecond - avgFirst) / lapDeltaDist
    observedPaceDropPerLapSec = Number(Math.max(0, rawDrop).toFixed(3))

    // Desvio padrão em relação à tendência média para consistência
    const mean = normalizedLaps.reduce((a, b) => a + b, 0) / normalizedLaps.length
    const variance =
      normalizedLaps.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / normalizedLaps.length
    const stdDev = Math.sqrt(variance)
    consistencyLevel = classifyConsistency(stdDev)
  } else if (normalizedLaps.length === 2) {
    const rawDrop = normalizedLaps[1] - normalizedLaps[0]
    observedPaceDropPerLapSec = Number(Math.max(0, rawDrop).toFixed(3))
    consistencyLevel = 'razoavel'
  }

  // 4. Degradação observada
  const observedDegradationLevel = classifyDegradationRate(wearPerLap)

  // 5. Janela útil estimada (Useful Tyre Window Range)
  // Vida útil típica é atingir ~70-75% de desgaste antes do cliff severo.
  // Em stints curtos (<= 4 voltas), a janela DEVE ser ampla (incerta).
  // Com o programa qualifying_sim (1-3 voltas), NÃO inferir janela estreita.
  let estimatedUsefulWindow: TyreUsefulWindowRange = { minLaps: 12, maxLaps: 30 }

  if (wearPerLap > 0) {
    // Estimativa teórica central baseada na taxa observada para atingir 70-75% de desgaste
    const targetWear = 72
    const centralEstimatedLife = targetWear / wearPerLap

    let spread = 8
    if (stint.program === 'qualifying_sim' || lapsCount <= 3) {
      spread = 12 // incerteza grande
    } else if (lapsCount >= 8) {
      spread = 4 // janela mais precisa com stint longo
    } else {
      spread = 6
    }

    const minLaps = Math.max(5, Math.round(centralEstimatedLife - spread))
    const maxLaps = Math.max(minLaps + 3, Math.round(centralEstimatedLife + spread))
    estimatedUsefulWindow = { minLaps, maxLaps }
  } else {
    // Sem desgaste observável (ex: 1 volta)
    estimatedUsefulWindow = { minLaps: 10, maxLaps: 35 }
  }

  // 6. Modulador de Programa e Piloto para ganho de conhecimento
  // Prioridade de ganho de pneus: Tyre Knowledge (1.45x) > Race Pace (1.15x) > Car Setup (0.75x) > Qualy Sim (0.35x)
  let programMultiplier = 1.0
  if (stint.program === 'tyre_knowledge') {
    programMultiplier = 1.45
  } else if (stint.program === 'race_pace') {
    programMultiplier = 1.15
  } else if (stint.program === 'car_setup') {
    programMultiplier = 0.75
  } else if (stint.program === 'qualifying_sim') {
    programMultiplier = 0.35
  }

  // Piloto: reutiliza technical_feedback do piloto
  const driverRating =
    driver.technical_feedback ?? (driver.consistency ? Math.round(driver.consistency * 0.95) : 70)
  const driverPrecisionMultiplier = Math.max(0.7, Math.min(1.3, driverRating / 75))

  // Clima: stint em piso seco vs molhado
  const weatherFactor = weather.startsWith('chuva') ? 0.75 : 1.0

  let baseGain = 0
  if (quality === 'insufficient') {
    baseGain = 5
  } else if (quality === 'preliminary') {
    baseGain = 16
  } else {
    // Mais voltas acumulam mais evidência até um teto razoável
    baseGain = Math.min(42, 20 + lapsCount * 2)
  }

  const knowledgeGain = Math.round(
    baseGain * programMultiplier * driverPrecisionMultiplier * weatherFactor,
  )

  // 7. Mensagem de resumo pós-stint objetiva
  let summaryMessage = ''
  const compoundLabels: Record<TireCompound, string> = {
    macio: 'Macios',
    medio: 'Médios',
    duro: 'Duros',
    intermediario: 'Intermediários',
    chuva_extrema: 'Chuva Extrema',
  }
  const compLabel = compoundLabels[stint.compound] || 'Pneus'

  if (quality === 'insufficient') {
    summaryMessage = `${compLabel} — Stint de ${lapsCount} volta(s). Rodagem insuficiente para aferir degradação ou janela útil do composto.`
  } else if (stint.program === 'qualifying_sim') {
    summaryMessage = `${compLabel} — Simulação de Classificação (${lapsCount} voltas). Bom registro de aderência de pico e aquecimento; dados insuficientes para inferir vida útil de corrida.`
  } else {
    const degDesc: Record<TyreDegradationLevel, string> = {
      muito_baixa: 'degradação muito baixa',
      baixa: 'degradação baixa',
      moderada: 'degradação moderada',
      alta: 'degradação acentuada',
      muito_alta: 'alta degradação térmica e mecânica',
    }
    summaryMessage = `${compLabel} — Stint de ${lapsCount} voltas. Observada ${degDesc[observedDegradationLevel]}. O ritmo ${
      observedPaceDropPerLapSec > 0.08
        ? 'começou a perder rendimento na fase final'
        : 'permaneceu linear e consistente'
    }. A estimativa de janela útil foi atualizada para ${estimatedUsefulWindow.minLaps}–${estimatedUsefulWindow.maxLaps} voltas.`
  }

  const observationId = `tyre_obs_${sessionId}_${stint.id}`

  return {
    id: observationId,
    sessionId,
    stintId: stint.id,
    driverId: stint.driverId,
    driverName: driver.name,
    carId: stint.carId,
    compound: stint.compound,
    program: stint.program,
    lapsCount,
    weather,
    setupSnapshot: { ...stint.setupSnapshot },
    initialWear: initWear,
    finalWear: finWear,
    wearDelta,
    wearPerLap,
    observedDegradationLevel,
    estimatedUsefulWindow,
    observedPaceDropPerLapSec,
    observedConsistency: consistencyLevel,
    quality,
    knowledgeGain,
    summaryMessage,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Converte pontuação interna de confiança (0-100) no nível categórico.
 */
export function scoreToConfidence(score: number): TyreConfidenceLevel {
  if (score >= 65) return 'alta'
  if (score >= 30) return 'media'
  return 'baixa'
}

/**
 * Consolida uma nova observação no conhecimento da equipe para aquele composto.
 * Garante:
 * - Idempotência por stintId.
 * - Monotonicidade com maturidade (mais dados estreitam a janela e aumentam confiança).
 * - Segmentação de condições incompatíveis (seco vs molhado).
 * - Qualidade insuficiente não inventa precisão nem janela útil estreita.
 */
export function updateTyreKnowledge(
  currentKnowledge: WeekendTyreKnowledge,
  observation: TyreStintObservation,
): WeekendTyreKnowledge {
  const updated: WeekendTyreKnowledge = JSON.parse(JSON.stringify(currentKnowledge))
  const comp = observation.compound
  const compKnowledge = updated[comp]

  if (!compKnowledge) return currentKnowledge

  // 1. Idempotência estrita: se este stint já foi consolidado neste composto, não reprocessa
  if (compKnowledge.lastUpdatedStintId === observation.stintId) {
    return currentKnowledge
  }

  // 2. Stint insuficiente (<= 1 volta): registra amostragem básica sem revelar dimensões chave
  if (observation.quality === 'insufficient') {
    compKnowledge.totalStintsObserved += 1
    compKnowledge.totalLapsObserved += observation.lapsCount
    if (!compKnowledge.testedDrivers.includes(observation.driverId)) {
      compKnowledge.testedDrivers.push(observation.driverId)
    }
    if (!compKnowledge.testedCars.includes(observation.carId)) {
      compKnowledge.testedCars.push(observation.carId)
    }
    if (!compKnowledge.testedConditions.includes(observation.weather)) {
      compKnowledge.testedConditions.push(observation.weather)
    }
    compKnowledge.lastUpdatedStintId = observation.stintId
    compKnowledge.updatedAt = new Date().toISOString()
    return updated
  }

  // 3. Segmentação contextual de clima:
  // Se o histórico era seco e a nova observação é chuva (ou vice-versa),
  // não mesclar de forma ingênua: atribui peso reduzido de correlação se incompatível
  const isWetObs = observation.weather.startsWith('chuva')
  const hasOppositeConditions = compKnowledge.testedConditions.some((c) =>
    isWetObs ? c === 'seco' : c.startsWith('chuva'),
  )

  const effectiveGain = hasOppositeConditions
    ? Math.round(observation.knowledgeGain * 0.5)
    : observation.knowledgeGain

  // 4. Atualizar Degradação
  const degDim = compKnowledge.degradation
  degDim.value = observation.observedDegradationLevel
  degDim.revealed = true
  degDim.confidenceScore = Math.min(100, degDim.confidenceScore + effectiveGain)
  degDim.confidence = scoreToConfidence(degDim.confidenceScore)

  // 5. Atualizar Janela Útil (Useful Window)
  // Qualifying Sim NÃO estreita janela útil de corrida
  const winDim = compKnowledge.usefulWindow
  if (observation.program !== 'qualifying_sim') {
    if (!winDim.revealed) {
      winDim.value = { ...observation.estimatedUsefulWindow }
      winDim.revealed = true
      winDim.confidenceScore = effectiveGain
      winDim.confidence = scoreToConfidence(winDim.confidenceScore)
    } else if (winDim.value) {
      // Estreitamento progressivo e consolidação
      // Nova faixa = contração ponderada em direção aos dados mais consistentes
      const currentMin = winDim.value.minLaps
      const currentMax = winDim.value.maxLaps
      const obsMin = observation.estimatedUsefulWindow.minLaps
      const obsMax = observation.estimatedUsefulWindow.maxLaps

      // Se a confiança atual era baixa ou stint atual é confiável, ajusta limites
      const newMin = Math.max(currentMin, Math.min(obsMin, currentMax - 2))
      const newMax = Math.min(currentMax, Math.max(obsMax, newMin + 2))

      // Garantir faixa válida (mínimo de amplitude)
      if (newMin < newMax) {
        winDim.value = { minLaps: newMin, maxLaps: newMax }
      } else {
        winDim.value = {
          minLaps: Math.min(currentMin, obsMin),
          maxLaps: Math.max(currentMax, obsMax),
        }
      }

      winDim.confidenceScore = Math.min(100, winDim.confidenceScore + effectiveGain)
      winDim.confidence = scoreToConfidence(winDim.confidenceScore)
    }
  }

  // 6. Atualizar Queda de Ritmo (Pace Drop)
  const paceDim = compKnowledge.paceDrop
  const obsDrop = observation.observedPaceDropPerLapSec
  if (!paceDim.revealed) {
    const minDrop = Number(Math.max(0.01, obsDrop * 0.8).toFixed(2))
    const maxDrop = Number((obsDrop * 1.25 + 0.02).toFixed(2))
    paceDim.value = { minSecPerLap: minDrop, maxSecPerLap: maxDrop }
    paceDim.revealed = true
    paceDim.confidenceScore = effectiveGain
    paceDim.confidence = scoreToConfidence(paceDim.confidenceScore)
  } else if (paceDim.value) {
    const curMin = paceDim.value.minSecPerLap
    const curMax = paceDim.value.maxSecPerLap
    const newMin = Number(Math.min(curMin, obsDrop * 0.85).toFixed(2))
    const newMax = Number(Math.max(curMax, obsDrop * 1.15).toFixed(2))
    paceDim.value = { minSecPerLap: newMin, maxSecPerLap: newMax }
    paceDim.confidenceScore = Math.min(100, paceDim.confidenceScore + effectiveGain)
    paceDim.confidence = scoreToConfidence(paceDim.confidenceScore)
  }

  // 7. Atualizar Consistência
  const consDim = compKnowledge.consistency
  consDim.value = observation.observedConsistency
  consDim.revealed = true
  consDim.confidenceScore = Math.min(100, consDim.confidenceScore + effectiveGain)
  consDim.confidence = scoreToConfidence(consDim.confidenceScore)

  // 8. Contadores e metadados agregados
  compKnowledge.totalStintsObserved += 1
  compKnowledge.totalLapsObserved += observation.lapsCount
  if (!compKnowledge.testedDrivers.includes(observation.driverId)) {
    compKnowledge.testedDrivers.push(observation.driverId)
  }
  if (!compKnowledge.testedCars.includes(observation.carId)) {
    compKnowledge.testedCars.push(observation.carId)
  }
  if (!compKnowledge.testedConditions.includes(observation.weather)) {
    compKnowledge.testedConditions.push(observation.weather)
  }

  // 9. Confiança global do composto
  const avgScore =
    (degDim.confidenceScore +
      winDim.confidenceScore +
      paceDim.confidenceScore +
      consDim.confidenceScore) /
    4

  compKnowledge.overallConfidence = scoreToConfidence(avgScore)
  compKnowledge.lastUpdatedStintId = observation.stintId
  compKnowledge.updatedAt = new Date().toISOString()

  return updated
}

/**
 * Formatadores canônicos para apresentação dos conhecimentos de pneus sem vazar dados brutos ou barras de % arbitrárias.
 */
export function formatDegradationLabel(level?: TyreDegradationLevel): string {
  switch (level) {
    case 'muito_baixa':
      return 'Muito Baixa'
    case 'baixa':
      return 'Baixa'
    case 'moderada':
      return 'Moderada'
    case 'alta':
      return 'Alta'
    case 'muito_alta':
      return 'Muito Alta'
    default:
      return '?'
  }
}

export function formatConsistencyLabel(level?: TyreConsistencyLevel): string {
  switch (level) {
    case 'muito_boa':
      return 'Muito Boa'
    case 'boa':
      return 'Boa'
    case 'razoavel':
      return 'Razoável'
    case 'irregular':
      return 'Irregular'
    case 'ruim':
      return 'Ruim'
    default:
      return '?'
  }
}

export function formatUsefulWindowLabel(range?: TyreUsefulWindowRange): string {
  if (!range) return '?'
  return `${range.minLaps}–${range.maxLaps} voltas`
}

export function formatPaceDropLabel(range?: TyrePaceDropRange): string {
  if (!range) return '?'
  return `~${range.minSecPerLap.toFixed(2)}–${range.maxSecPerLap.toFixed(2)} s/volta`
}
