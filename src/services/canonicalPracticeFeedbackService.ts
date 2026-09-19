import type { PracticeCarSetup, PracticeProgramType } from '@/types/practice-preparation'
import type {
  PracticeStint,
  SetupConfidenceLevel,
  SetupAxisDirection,
  SetupAxisSeverity,
  SetupKnowledgeAxis,
  SetupKnowledgeModel,
  StintAxisFeedback,
  StintFeedbackRecord,
} from '@/types/practice-session'
import type { TrackWeatherState } from '@/lib/f1-tire-system'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'

export interface DriverFeedbackProfile {
  id: string
  name: string
  technical_feedback?: number
  consistency?: number
  speed?: number
}

export interface IdealSetupInternal {
  frontWing: number // 1 a 10
  rearWing: number // 1 a 10
  suspension: number // 1 a 10
  differential: number // 20 a 80 (%)
}

/**
 * Cria o modelo inicial de conhecimento da equipe: Faixas abertas com status unrevealed ("?").
 */
export function createInitialSetupKnowledge(): SetupKnowledgeModel {
  return {
    frontWing: {
      minKnown: 1,
      maxKnown: 10,
      confidence: 'baixa',
      confidenceScore: 0,
      revealed: false,
    },
    rearWing: {
      minKnown: 1,
      maxKnown: 10,
      confidence: 'baixa',
      confidenceScore: 0,
      revealed: false,
    },
    suspension: {
      minKnown: 1,
      maxKnown: 10,
      confidence: 'baixa',
      confidenceScore: 0,
      revealed: false,
    },
    differential: {
      minKnown: 20,
      maxKnown: 80,
      confidence: 'baixa',
      confidenceScore: 0,
      revealed: false,
    },
    overallConfidence: 'baixa',
    totalStintsAnalyzed: 0,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Resolve o setup ideal interno estritamente no modelo matemático/físico,
 * baseado no circuito canônico (F1_2026_CALENDAR e resolveCircuitProfile).
 * ATENÇÃO: NUNCA expor este valor diretamente para a UI!
 */
export function resolveInternalIdealSetup(round: number): IdealSetupInternal {
  const gp = F1_2026_CALENDAR.find((g) => g.round === round)
  let baseWing = gp?.downforceIdeal ?? 6
  let baseSusp = gp?.suspensionIdeal ?? 6

  // Usar circuito se existir para enriquecer diferencial e asas
  try {
    const profile = resolveCircuitProfile({ round })
    if (profile) {
      // Pistas de alta velocidade de reta tendem a diferencial mais aberto ou bloqueado dependendo da tração
      const tractionWeight = profile.weights.traction || 8
      const slowCornerWeight = profile.weights.slowCorner || 8

      // Diferencial ideal: pistas com muitas curvas lentas exigem diferencial mais aberto (~45-50%), pistas com retas e aceleração forte exigem mais bloqueio (~60-70%)
      const idealDiff = Math.min(
        75,
        Math.max(35, Math.round(50 + (tractionWeight - slowCornerWeight) * 3)),
      )

      // Asa dianteira vs traseira: em circuitos de alta eficiência de reta, a traseira pode ser ligeiramente menor
      const rearWing = Math.min(10, Math.max(1, baseWing))
      const frontWing = Math.min(
        10,
        Math.max(1, profile.weights.topSpeed > 10 ? rearWing : Math.min(10, rearWing + 1)),
      )

      return {
        frontWing,
        rearWing,
        suspension: Math.min(10, Math.max(1, baseSusp)),
        differential: idealDiff,
      }
    }
  } catch {
    // fallback seguro
  }

  return {
    frontWing: Math.min(10, Math.max(1, baseWing)),
    rearWing: Math.min(10, Math.max(1, baseWing)),
    suspension: Math.min(10, Math.max(1, baseSusp)),
    differential: 52,
  }
}

/**
 * Biblioteca variada mas determinística de mensagens de rádio/engenharia técnica.
 * Determinismo garantido por semente baseada em (stintId + axis + direction).
 */
const FEEDBACK_MESSAGES: Record<
  'frontWing' | 'rearWing' | 'suspension' | 'differential',
  Record<SetupAxisDirection, string[]>
> = {
  frontWing: {
    increase: [
      'Falta frente nas entradas de curva de média e alta. O carro subesterça e demora para apontar.',
      'Subesterço acentuado nas curvas rápidas. Precisamos de mais carga na asa dianteira para equilibrar.',
      'A frente escorrega muito no ápice. Vale testar mais asa dianteira para dar rotação.',
      'Pouco apoio dianteiro. Estou perdendo tempo esperando a frente assentar antes de reacelerar.',
    ],
    decrease: [
      'A frente está muito agressiva e mordendo demais na entrada. Risco constante de traseirada.',
      'Excesso de asa dianteira. O carro fica instável e hiperativo nas mudanças rápidas de direção.',
      'Muita frente, a direção responde brusca demais e solta a traseira nas frenagens.',
      'Frente excessivamente pregada. Estamos arrastando asa desnecessária nas retas.',
    ],
    ok: [
      'A resposta da frente está no ponto. O carro aponta com precisão e obedece na entrada.',
      'Balanço dianteiro muito bom. Consigo atacar o ápice com total confiança sem subesterço.',
      'A asa dianteira está bem casada com o circuito. Aderência consistente na frente.',
    ],
  },
  rearWing: {
    increase: [
      'A traseira está muito solta nas curvas de alta velocidade. Falta pressão aerodinâmica atrás.',
      'Traseira instável e pouca confiança em alta. O carro flutua nas saídas de curva velozes.',
      'Estamos perdendo a traseira ao reacelerar cedo. Seria prudente carregar mais a asa traseira.',
      'Muita correção de volante nas retas e curvas rápidas. Precisamos de mais sustentação atrás.',
    ],
    decrease: [
      'Sentindo arrasto excessivo na reta. A velocidade final está comprometida pela asa traseira.',
      'Muito arrasto aerodinâmico traseiro. O carro está preso nas retas sem ganho de curva proporcional.',
      'Podemos tirar um pouco de asa traseira para ganhar velocidade máxima sem perder estabilidade.',
      'Carro com sustentação traseira acima do necessário para esse traçado. Falta velocidade de ponta.',
    ],
    ok: [
      'A estabilidade traseira está excelente em alta sem segurar o carro nas retas.',
      'Apoio traseiro impecável. Carro muito estável nas curvas rápidas e com bom arrasto.',
      'Traseira firme e plantada no asfalto. Nível de asa traseira muito competitivo.',
    ],
  },
  suspension: {
    increase: [
      'O carro está rolando muito lateralmente nas curvas. A suspensão está macia demais.',
      'Muita rolagem de carroceria e atraso de resposta nas transições rápidas. Vale endurecer o conjunto.',
      'Suspensão excessivamente complacente. O assoalho oscila e perde pressão em alta velocidade.',
      'Falta rigidez para manter a plataforma aerodinâmica estável. Recomendo endurecer a suspensão.',
    ],
    decrease: [
      'O carro está quicando violentamente nas zebras. A suspensão está rígida demais para a pista.',
      'Batendo muito no assoalho e quicando nas ondulações. Precisamos amolecer um pouco.',
      'Muito dura nas frenagens, os pneus estão travando fácil sobre as imperfeições do asfalto.',
      'Suspensão intransigente nas zebras, o carro pula e perde tração mecânica.',
    ],
    ok: [
      'O amortecimento absorve bem as zebras sem perder a plataforma aerodinâmica estável.',
      'Excelente equilíbrio mecânico. O carro ataca as zebras sem quicar e mantém tração constante.',
      'Rigidez na medida certa. Plataforma selada e transições de peso imediatas.',
    ],
  },
  differential: {
    increase: [
      'Roda interna patinando na reaceleração de curvas lentas. Vale fechar mais o diferencial.',
      'Falta tração longitudinal na saída das chicanes. O diferencial aberto está dissipando torque.',
      'Estamos destracionando fácil na saída de curva. Um pouco mais de bloqueio melhorará a tração.',
      'Muita patinagem na reaceleração. Fechar o diferencial vai ajudar a empurrar o carro em linha reta.',
    ],
    decrease: [
      'O carro está amarrado no contorno das curvas lentas. Diferencial muito bloqueado.',
      'Empurrando de frente na fase neutra da curva. O diferencial travado não deixa o carro rotacionar.',
      'Diferencial muito fechado, gerando subesterço de potência no meio da curva. Vale abrir um pouco.',
      'Excesso de bloqueio no diferencial. O carro fica relutante em girar nos trechos mais travados.',
    ],
    ok: [
      'O diferencial está entregando tração limpa na saída sem travar a rotação no contorno.',
      'Tração sólida na reaceleração e rotação suave nas curvas. Balanço do diferencial aprovado.',
      'Diferencial calibrado com perfeição entre tração de saída e agilidade de entrada.',
    ],
  },
}

/**
 * Hash determinístico de string para número.
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Seleciona frase determinística para uma dada chave e lista de opções.
 */
function pickDeterministicMessage(key: string, options: string[]): string {
  if (!options || options.length === 0) return ''
  const index = hashString(key) % options.length
  return options[index]
}

export interface EvaluateStintParams {
  sessionId: string
  stint: PracticeStint
  driver: DriverFeedbackProfile
  round: number
  weather: TrackWeatherState
  currentKnowledge: SetupKnowledgeModel
}

/**
 * Avalia o feedback técnico pós-stint de acordo com os dados coletados, programa, piloto, voltas e clima.
 * Totalmente puro e determinístico.
 */
export function evaluateStintFeedback(params: EvaluateStintParams): StintFeedbackRecord {
  const { sessionId, stint, driver, round, weather, currentKnowledge } = params
  const laps = stint.lapsCount || (stint.laps ? stint.laps.length : 0)
  const ideal = resolveInternalIdealSetup(round)

  // 1. Verificar volume de voltas (Requisito 1)
  // Stint com 1 volta ou menos -> feedback insuficiente
  // Stint com 2 a 3 voltas -> preliminar
  // Stint com 4+ voltas -> confiável
  let quality: 'insufficient' | 'preliminary' | 'reliable' = 'reliable'
  if (laps <= 1) {
    quality = 'insufficient'
  } else if (laps < 4) {
    quality = 'preliminary'
  }

  // 2. Modulador de precisão do piloto (Requisito 6)
  // Usa technical_feedback do piloto (padrão 70 se ausente, ou derivado de consistency)
  const techFeedbackRating =
    driver.technical_feedback ?? (driver.consistency ? Math.round(driver.consistency * 0.95) : 70)
  const driverPrecisionMultiplier = Math.max(0.65, Math.min(1.35, techFeedbackRating / 75))

  // 3. Modulador de programa (Requisito 7)
  // car_setup: 1.35x eficiência
  // race_pace: 0.95x eficiência
  // qualifying_sim: 0.70x eficiência
  // tyre_knowledge: 0.75x eficiência
  let programEfficiency = 1.0
  if (stint.program === 'car_setup') {
    programEfficiency = 1.35
  } else if (stint.program === 'race_pace') {
    programEfficiency = 0.95
  } else if (stint.program === 'qualifying_sim') {
    programEfficiency = 0.7
  } else if (stint.program === 'tyre_knowledge') {
    programEfficiency = 0.75
  }

  // 4. Modulador de clima e circuito (Requisito 8)
  // Pista molhada ou chuva reduz confiabilidade do feedback de setup seco
  let weatherFactor = 1.0
  if (weather.startsWith('chuva') || weather.includes('molhada')) {
    weatherFactor = 0.65
  }

  // 5. Se o stint for insuficiente (<= 1 volta)
  if (quality === 'insufficient') {
    return {
      id: `feedback_${sessionId}_${stint.id}`,
      sessionId,
      stintId: stint.id,
      driverId: stint.driverId,
      driverName: driver.name,
      carId: stint.carId,
      setupSnapshot: { ...stint.setupSnapshot },
      lapsCount: laps,
      program: stint.program,
      timestamp: new Date().toISOString(),
      quality: 'insufficient',
      generalMessage: `${driver.name}: "Volta de instalação apenas. Dados insuficientes para avaliar o comportamento do acerto."`,
      axisFeedbacks: [],
      knowledgeDelta: undefined,
    }
  }

  // Calcular desvios por eixo
  const axes: Array<{
    axis: 'frontWing' | 'rearWing' | 'suspension' | 'differential'
    label: string
    currentVal: number
    idealVal: number
    minScale: number
    maxScale: number
    tolerance: number
  }> = [
    {
      axis: 'frontWing',
      label: 'Asa Dianteira',
      currentVal: stint.setupSnapshot.frontWing,
      idealVal: ideal.frontWing,
      minScale: 1,
      maxScale: 10,
      tolerance: 0,
    },
    {
      axis: 'rearWing',
      label: 'Asa Traseira',
      currentVal: stint.setupSnapshot.rearWing,
      idealVal: ideal.rearWing,
      minScale: 1,
      maxScale: 10,
      tolerance: 0,
    },
    {
      axis: 'suspension',
      label: 'Suspensão',
      currentVal: stint.setupSnapshot.suspension,
      idealVal: ideal.suspension,
      minScale: 1,
      maxScale: 10,
      tolerance: 0,
    },
    {
      axis: 'differential',
      label: 'Diferencial',
      currentVal: stint.setupSnapshot.differential,
      idealVal: ideal.differential,
      minScale: 20,
      maxScale: 80,
      tolerance: 2, // 2% de tolerância para diferencial
    },
  ]

  // Pontuação base de confiança adquirida neste stint
  const baseConfidenceGain =
    (quality === 'reliable' ? 32 : 18) *
    programEfficiency *
    driverPrecisionMultiplier *
    weatherFactor

  const axisFeedbacks: StintAxisFeedback[] = []
  const knowledgeDelta: StintFeedbackRecord['knowledgeDelta'] = {}

  axes.forEach((ax) => {
    const diff = ax.currentVal - ax.idealVal
    let direction: SetupAxisDirection = 'ok'
    let severity: SetupAxisSeverity = 'ideal'

    if (Math.abs(diff) <= ax.tolerance) {
      direction = 'ok'
      severity = 'ideal'
    } else if (diff < 0) {
      direction = 'increase'
      severity = Math.abs(diff) >= 3 ? 'alta' : 'moderada'
    } else {
      direction = 'decrease'
      severity = Math.abs(diff) >= 3 ? 'alta' : 'moderada'
    }

    // Nível de confiança por eixo
    let axisConfLevel: SetupConfidenceLevel = 'baixa'
    if (baseConfidenceGain >= 35) {
      axisConfLevel = 'alta'
    } else if (baseConfidenceGain >= 20) {
      axisConfLevel = 'media'
    }

    // Seleção de mensagem técnica
    const seed = `${stint.id}_${ax.axis}_${direction}_${severity}`
    const msgList = FEEDBACK_MESSAGES[ax.axis][direction]
    const chosenMessage = pickDeterministicMessage(seed, msgList)

    axisFeedbacks.push({
      axis: ax.axis,
      axisLabel: ax.label,
      direction,
      severity,
      confidence: axisConfLevel,
      message: chosenMessage,
    })

    // Calcular faixa aprendida preliminar para este eixo
    // Piloto mais preciso gera faixa mais estreita em torno do ideal
    // IMPORTANTE: A faixa nunca revela o número exato, aponta a direção ou faixa que contém o ideal
    const currentAxisKnowledge = currentKnowledge[ax.axis]
    const currentMin = currentAxisKnowledge.revealed ? currentAxisKnowledge.minKnown : ax.minScale
    const currentMax = currentAxisKnowledge.revealed ? currentAxisKnowledge.maxKnown : ax.maxScale

    // Amplitude de incerteza da nova observação
    // Quanto maior a precisão do piloto e mais voltas, menor o spread
    const maxSpread = ax.axis === 'differential' ? 24 : 4
    const minSpread = ax.axis === 'differential' ? 8 : 1
    const spreadFraction = Math.max(
      0.2,
      Math.min(1.0, 1.2 - (techFeedbackRating / 100) * 0.4 - (laps / 12) * 0.3),
    )
    const activeSpread = Math.max(
      minSpread,
      Math.round(minSpread + (maxSpread - minSpread) * spreadFraction),
    )

    let candidateMin = ax.minScale
    let candidateMax = ax.maxScale

    if (direction === 'increase') {
      // Setup atual está ABAIXO do ideal -> ideal é >= currentVal
      // O piso passa a ser no mínimo currentVal
      candidateMin = Math.max(currentMin, ax.currentVal)
      candidateMax = Math.min(
        currentMax,
        Math.max(candidateMin + activeSpread, ax.idealVal + Math.ceil(activeSpread / 2)),
      )
    } else if (direction === 'decrease') {
      // Setup atual está ACIMA do ideal -> ideal é <= currentVal
      // O teto passa a ser no máximo currentVal
      candidateMax = Math.min(currentMax, ax.currentVal)
      candidateMin = Math.max(
        currentMin,
        Math.min(candidateMax - activeSpread, ax.idealVal - Math.ceil(activeSpread / 2)),
      )
    } else {
      // OK -> o ideal está muito próximo de currentVal
      candidateMin = Math.max(currentMin, ax.currentVal - Math.floor(activeSpread / 2))
      candidateMax = Math.min(currentMax, ax.currentVal + Math.ceil(activeSpread / 2))
    }

    // Travar nos limites da escala
    candidateMin = Math.max(ax.minScale, Math.min(candidateMin, ax.maxScale))
    candidateMax = Math.max(candidateMin, Math.min(candidateMax, ax.maxScale))

    knowledgeDelta[ax.axis] = {
      min: candidateMin,
      max: candidateMax,
    }
  })

  // Mensagem geral resumida
  const generalSummary =
    quality === 'preliminary'
      ? `${driver.name}: "Stint curto (${laps} voltas). Temos uma leitura preliminar, mas precisamos de mais rodagem para confirmar."`
      : `${driver.name}: "Stint consistente (${laps} voltas). O comportamento do carro ficou claro e a telemetria bateu com o feeling."`

  return {
    id: `feedback_${sessionId}_${stint.id}`,
    sessionId,
    stintId: stint.id,
    driverId: stint.driverId,
    driverName: driver.name,
    carId: stint.carId,
    setupSnapshot: { ...stint.setupSnapshot },
    lapsCount: laps,
    program: stint.program,
    timestamp: new Date().toISOString(),
    quality,
    generalMessage: generalSummary,
    axisFeedbacks,
    knowledgeDelta,
  }
}

/**
 * Atualização MONOTÔNICA do conhecimento da equipe (Requisito 5).
 * Mais dados válidos mantêm ou estreitam a faixa [minKnown, maxKnown].
 * A faixa NUNCA expande sem justificativa ou dados corrompidos.
 */
export function updateSetupKnowledge(
  currentKnowledge: SetupKnowledgeModel,
  newFeedback: StintFeedbackRecord,
): SetupKnowledgeModel {
  // Stints com dados insuficientes não alteram faixas
  if (newFeedback.quality === 'insufficient' || !newFeedback.knowledgeDelta) {
    return currentKnowledge
  }

  // Idempotência: não processar o mesmo stint duas vezes
  if (currentKnowledge.lastUpdatedStintId === newFeedback.stintId) {
    return currentKnowledge
  }

  const updated: SetupKnowledgeModel = JSON.parse(JSON.stringify(currentKnowledge))

  const axes: Array<'frontWing' | 'rearWing' | 'suspension' | 'differential'> = [
    'frontWing',
    'rearWing',
    'suspension',
    'differential',
  ]

  let totalConfidenceScore = 0

  axes.forEach((axis) => {
    const currentAxis = updated[axis]
    const delta = newFeedback.knowledgeDelta?.[axis]

    if (delta) {
      if (!currentAxis.revealed) {
        // Primeira descoberta do eixo
        currentAxis.minKnown = delta.min
        currentAxis.maxKnown = delta.max
        currentAxis.revealed = true
      } else {
        // Atualização estritamente MONOTÔNICA: min não pode diminuir, max não pode aumentar
        // Nova faixa = interseção ou contração lógica
        const newMin = Math.max(currentAxis.minKnown, delta.min)
        const newMax = Math.min(currentAxis.maxKnown, delta.max)

        // Se a interseção for válida (newMin <= newMax), estreita; caso contrário mantém o conhecido
        if (newMin <= newMax) {
          currentAxis.minKnown = newMin
          currentAxis.maxKnown = newMax
        } else {
          // Em caso extremo de ruído de leitura, preserva a faixa mais confiável anterior
          currentAxis.minKnown = Math.min(currentAxis.minKnown, delta.min)
          currentAxis.maxKnown = Math.max(currentAxis.maxKnown, delta.max)
        }
      }

      // Ganho progressivo de score de confiança (0 a 100)
      const gain = newFeedback.quality === 'reliable' ? 25 : 12
      currentAxis.confidenceScore = Math.min(100, (currentAxis.confidenceScore || 0) + gain)

      if (currentAxis.confidenceScore >= 65) {
        currentAxis.confidence = 'alta'
      } else if (currentAxis.confidenceScore >= 30) {
        currentAxis.confidence = 'media'
      } else {
        currentAxis.confidence = 'baixa'
      }
    }

    totalConfidenceScore += currentAxis.confidenceScore
  })

  updated.totalStintsAnalyzed = (updated.totalStintsAnalyzed || 0) + 1
  updated.lastUpdatedStintId = newFeedback.stintId
  updated.updatedAt = new Date().toISOString()

  const avgConfidence = totalConfidenceScore / 4
  if (avgConfidence >= 65) {
    updated.overallConfidence = 'alta'
  } else if (avgConfidence >= 30) {
    updated.overallConfidence = 'media'
  } else {
    updated.overallConfidence = 'baixa'
  }

  return updated
}
