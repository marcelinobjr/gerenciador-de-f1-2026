import type {
  TireCompound,
  DriverRaceStrategy,
  GrandPrixInfo,
  SessionSetupModel,
  TireSetItem,
} from '@/types/f1'
import type {
  SetupKnowledgeModel,
  StintFeedbackRecord,
  SetupConfidenceLevel,
} from '@/types/practice-session'
import type {
  WeekendTyreKnowledge,
  TyreKnowledgeConfidence,
  TyreDegradationLevel,
} from '@/types/practice-tyres'
import type { WeekendSession } from '@/types/race-events'
import { TIRE_SPECS, type TrackWeatherState } from '@/lib/f1-tire-system'
import {
  formatDegradationLabel,
  formatUsefulWindowLabel,
  formatPaceDropLabel,
  formatConsistencyLabel,
} from '@/services/canonicalPracticeTyreService'

export interface SetupAxisRecommendation {
  axis: 'frontWing' | 'rearWing' | 'suspension' | 'differential'
  axisLabel: string
  currentValue: number
  minKnown: number
  maxKnown: number
  confidence: SetupConfidenceLevel
  revealed: boolean
  direction: 'increase' | 'decrease' | 'ok' | 'unknown'
  suggestedTarget?: number // Apenas faixa/orientação calculada honestamente dentro da faixa conhecida
  recommendationText: string
}

export interface SetupInformedRecommendation {
  status: 'initial_estimate' | 'learning' | 'informed'
  headline: string
  observedBasisText: string
  overallConfidence: SetupConfidenceLevel
  axes: Record<'frontWing' | 'rearWing' | 'suspension' | 'differential', SetupAxisRecommendation>
  driverNotes: string[]
  primaryRisk: string
  actionableAdjustments: Partial<SessionSetupModel>
  hasActionableChanges: boolean
}

export interface CompoundInformedAnalysis {
  compound: TireCompound
  label: string
  availableSetsCount: number
  eligible: boolean
  confidence: TyreKnowledgeConfidence
  revealed: boolean
  degradationCategory: string
  degradationValue?: TyreDegradationLevel
  usefulWindowRange?: { minLaps: number; maxLaps: number }
  usefulWindowText: string
  paceDropText: string
  consistencyText: string
  testedLaps: number
  testedStints: number
  testedConditions: TrackWeatherState[]
  summaryMessage: string
  riskNotice?: string
}

export interface StrategyInformedRecommendation {
  driverId: string
  driverName: string
  recommendedStartCompound: TireCompound
  recommendedStartSetId?: string
  confidence: TyreKnowledgeConfidence
  observedBasisText: string
  estimatedStintLaps: { min: number; max: number }
  suggestedPitWindows: Array<{
    pitIndex: number
    windowLapMin: number
    windowLapMax: number
    recommendedCompound: TireCompound
    recommendedSetId?: string
    confidence: TyreKnowledgeConfidence
    reason: string
  }>
  primaryRisk: string
  strategyHeadline: string
}

export interface PreparationInformedPackage {
  hasPracticeEvidence: boolean
  evidenceBadgeText: string
  setupRecommendation: SetupInformedRecommendation
  tyresAnalysis: Record<TireCompound, CompoundInformedAnalysis>
  strategyRecommendations: Record<string, StrategyInformedRecommendation>
}

export interface GeneratePreparationInformedParams {
  sessionKey: WeekendSession
  currentSetup: SessionSetupModel
  gpInfo: {
    circuit: string
    laps: number
    downforceIdeal?: number
    suspensionIdeal?: number
  }
  weather: TrackWeatherState
  setupKnowledge?: SetupKnowledgeModel | null
  tyreKnowledge?: WeekendTyreKnowledge | null
  feedbacks?: StintFeedbackRecord[] | null
  tireStock?: Record<TireCompound, number> | null
  driverTireInventories?: Record<string, TireSetItem[]> | null
  drivers?: Array<{ id: string; name: string }>
  currentStrategies?: Record<string, DriverRaceStrategy>
}

const COMPOUND_DISPLAY_NAMES: Record<TireCompound, string> = {
  macio: 'Macio (Vermelho)',
  medio: 'Médio (Amarelo)',
  duro: 'Duro (Branco)',
  intermediario: 'Intermediário (Verde)',
  chuva_extrema: 'Chuva Extrema (Azul)',
}

/**
 * Produz a recomendação informada de SETUP baseando-se ESTRITAMENTE no modelo de conhecimento aprendido (4C1).
 * PROIBIDO: Consultar resolveInternalIdealSetup() ou valores ocultos da pista.
 */
export function analyzeSetupInformed(
  currentSetup: SessionSetupModel,
  setupKnowledge?: SetupKnowledgeModel | null,
  feedbacks?: StintFeedbackRecord[] | null,
): SetupInformedRecommendation {
  const isKnowledgePresent =
    setupKnowledge &&
    setupKnowledge.totalStintsAnalyzed > 0 &&
    (setupKnowledge.frontWing.revealed ||
      setupKnowledge.rearWing.revealed ||
      setupKnowledge.suspension.revealed ||
      setupKnowledge.differential.revealed)

  const defaultAxes: Array<{
    axis: 'frontWing' | 'rearWing' | 'suspension' | 'differential'
    label: string
    setupField: keyof SessionSetupModel
    minScale: number
    maxScale: number
  }> = [
    {
      axis: 'frontWing',
      label: 'Asa Dianteira',
      setupField: 'wing_level',
      minScale: 1,
      maxScale: 10,
    },
    {
      axis: 'rearWing',
      label: 'Asa Traseira',
      setupField: 'wing_level',
      minScale: 1,
      maxScale: 10,
    },
    {
      axis: 'suspension',
      label: 'Suspensão',
      setupField: 'suspension_stiffness',
      minScale: 1,
      maxScale: 10,
    },
    {
      axis: 'differential',
      label: 'Diferencial / MGU-K',
      setupField: 'pu_electric_ratio',
      minScale: 20,
      maxScale: 80,
    },
  ]

  // Caso 1: Sem dados de treino livre
  if (!isKnowledgePresent) {
    const axesRecord: any = {}
    defaultAxes.forEach((ax) => {
      const currentVal =
        (currentSetup[ax.setupField] as number) ?? (ax.axis === 'differential' ? 50 : 6)
      axesRecord[ax.axis] = {
        axis: ax.axis,
        axisLabel: ax.label,
        currentValue: currentVal,
        minKnown: ax.minScale,
        maxKnown: ax.maxScale,
        confidence: 'baixa',
        revealed: false,
        direction: 'unknown',
        recommendationText: 'Estimativa inicial — ainda não validada em pista.',
      }
    })

    return {
      status: 'initial_estimate',
      headline: 'Estimativa inicial — ainda não validada em pista',
      observedBasisText: 'Sem stints de treino realizados nesta rodada.',
      overallConfidence: 'baixa',
      axes: axesRecord,
      driverNotes: ['Nenhum feedback de telemetria coletado até o momento.'],
      primaryRisk:
        'Falta de amostragem em pista real. Comportamento aerodinâmico e mecânico baseado em predições de fábrica.',
      actionableAdjustments: {},
      hasActionableChanges: false,
    }
  }

  // Caso 2: Conhecimento real acumulado (4C1)
  const axesRecord: any = {}
  const actionable: Partial<SessionSetupModel> = {}
  let hasChanges = false
  const primaryRisks: string[] = []

  defaultAxes.forEach((ax) => {
    const kAxis = setupKnowledge[ax.axis]
    const currentVal =
      (currentSetup[ax.setupField] as number) ?? (ax.axis === 'differential' ? 50 : 6)
    const revealed = kAxis.revealed
    const minKnown = revealed ? kAxis.minKnown : ax.minScale
    const maxKnown = revealed ? kAxis.maxKnown : ax.maxScale
    const conf = kAxis.confidence

    let direction: 'increase' | 'decrease' | 'ok' | 'unknown' = 'unknown'
    let text = 'Estimativa de fábrica preliminar.'
    let suggestedTarget: number | undefined = undefined

    if (revealed) {
      if (currentVal < minKnown) {
        direction = 'increase'
        suggestedTarget = minKnown
        text = `Setup atual (${currentVal}) está abaixo da faixa validada pelos pilotos [${minKnown}–${maxKnown}]. Recomenda-se aumentar para entrar na janela observada.`
        if (conf === 'alta' || conf === 'media') {
          if (ax.setupField === 'wing_level' && !actionable.wing_level) {
            actionable.wing_level = minKnown
            hasChanges = true
          } else if (ax.setupField === 'suspension_stiffness') {
            actionable.suspension_stiffness = minKnown
            hasChanges = true
          } else if (ax.setupField === 'pu_electric_ratio') {
            actionable.pu_electric_ratio = minKnown
            hasChanges = true
          }
        }
        primaryRisks.push(`${ax.label} abaixo da faixa conhecida (${minKnown})`)
      } else if (currentVal > maxKnown) {
        direction = 'decrease'
        suggestedTarget = maxKnown
        text = `Setup atual (${currentVal}) está acima do teto validado [${minKnown}–${maxKnown}]. Sugestão: reduzir em direção à faixa conhecida.`
        if (conf === 'alta' || conf === 'media') {
          if (ax.setupField === 'wing_level' && !actionable.wing_level) {
            actionable.wing_level = maxKnown
            hasChanges = true
          } else if (ax.setupField === 'suspension_stiffness') {
            actionable.suspension_stiffness = maxKnown
            hasChanges = true
          } else if (ax.setupField === 'pu_electric_ratio') {
            actionable.pu_electric_ratio = maxKnown
            hasChanges = true
          }
        }
        primaryRisks.push(`${ax.label} acima do teto conhecido (${maxKnown})`)
      } else {
        direction = 'ok'
        suggestedTarget = currentVal
        text = `Configuração atual (${currentVal}) já está contida na faixa aprendida da equipe [${minKnown}–${maxKnown}] (confiança ${conf}).`
      }
    }

    axesRecord[ax.axis] = {
      axis: ax.axis,
      axisLabel: ax.label,
      currentValue: currentVal,
      minKnown,
      maxKnown,
      confidence: conf,
      revealed,
      direction,
      suggestedTarget,
      recommendationText: text,
    }
  })

  // Coleta as observações textuais reais mais recentes dos pilotos da 4C1
  const recentDriverNotes: string[] = []
  if (feedbacks && feedbacks.length > 0) {
    const valid = feedbacks.filter((f) => f.quality !== 'insufficient').slice(-3)
    valid.forEach((fb) => {
      recentDriverNotes.push(`${fb.driverName} (Stint ${fb.lapsCount}v): "${fb.generalMessage}"`)
      fb.axisFeedbacks.forEach((af) => {
        if (af.severity !== 'ideal' && recentDriverNotes.length < 5) {
          recentDriverNotes.push(`• [${af.axisLabel}]: ${af.message}`)
        }
      })
    })
  }

  if (recentDriverNotes.length === 0) {
    recentDriverNotes.push('Observações registradas durante os stints de treino validados.')
  }

  const primaryRisk =
    primaryRisks.length > 0
      ? `Ajuste fora das faixas validadas pelos pilotos: ${primaryRisks.join('; ')}.`
      : setupKnowledge.overallConfidence === 'alta'
        ? 'Balanço validado em pista. Risco concentrado em flutuações de temperatura do asfalto.'
        : 'Confiança moderada nas leituras aerodinâmicas. Pode haver desvio em condições extremas de aderência.'

  return {
    status: setupKnowledge.overallConfidence === 'alta' ? 'informed' : 'learning',
    headline:
      setupKnowledge.overallConfidence === 'alta'
        ? 'Recomendação Consolidada da Engenharia (Alta Confiança)'
        : 'Diagnóstico Técnico em Progresso (Confiança Média/Baixa)',
    observedBasisText: `Baseado em ${setupKnowledge.totalStintsAnalyzed} stint(s) de teste analisados na pista.`,
    overallConfidence: setupKnowledge.overallConfidence,
    axes: axesRecord,
    driverNotes: recentDriverNotes,
    primaryRisk,
    actionableAdjustments: actionable,
    hasActionableChanges: hasChanges,
  }
}

/**
 * Analisa os pneus disponíveis no estoque real e cruza com o conhecimento aprendido (4C2).
 * Dimensões independentes e sem consultar vida útil verdadeira oculta.
 */
export function analyzeTyresInformed(
  weather: TrackWeatherState,
  tyreKnowledge?: WeekendTyreKnowledge | null,
  tireStock?: Record<TireCompound, number> | null,
  driverTireInventories?: Record<string, TireSetItem[]> | null,
  driverId?: string,
): Record<TireCompound, CompoundInformedAnalysis> {
  const result = {} as Record<TireCompound, CompoundInformedAnalysis>
  const isWetWeather = weather.startsWith('chuva')

  const compounds: TireCompound[] = ['macio', 'medio', 'duro', 'intermediario', 'chuva_extrema']

  compounds.forEach((comp) => {
    const compKnowledge = tyreKnowledge ? tyreKnowledge[comp] : null
    const hasKnowledge = compKnowledge && compKnowledge.totalStintsObserved > 0

    // Contagem real no estoque (ou inventário do piloto específico)
    let availableCount = 0
    if (driverId && driverTireInventories && driverTireInventories[driverId]) {
      availableCount = driverTireInventories[driverId].filter(
        (t) => t.compound === comp && !t.isFitted && t.wear < 90,
      ).length
    } else if (tireStock && typeof tireStock[comp] === 'number') {
      availableCount = tireStock[comp]
    }

    // Elegibilidade pelas regras da FIA quanto ao clima
    let eligible = true
    if (isWetWeather && comp !== 'intermediario' && comp !== 'chuva_extrema') {
      eligible = false
    }

    if (!hasKnowledge || !compKnowledge) {
      // Estimativa inicial de fábrica (SEM DADOS DE PISTA)
      const spec = TIRE_SPECS[comp]
      result[comp] = {
        compound: comp,
        label: COMPOUND_DISPLAY_NAMES[comp],
        availableSetsCount: availableCount,
        eligible,
        confidence: 'sem_dados',
        revealed: false,
        degradationCategory: 'Estimativa inicial — ainda não validada em pista',
        degradationValue: undefined,
        usefulWindowRange: undefined,
        usefulWindowText: 'Estimativa de fábrica (~15–25 voltas)',
        paceDropText: `Referência teórica: ${spec ? spec.deltaPerLapSec.toFixed(2) : '0.00'}s/v`,
        consistencyText: 'Não testado',
        testedLaps: 0,
        testedStints: 0,
        testedConditions: [],
        summaryMessage: 'Composto ainda não rodou em treinos livres no fim de semana.',
        riskNotice: availableCount <= 0 ? 'Sem jogos disponíveis no estoque' : undefined,
      }
      return
    }

    // Composto com dados aprendidos em treinos (4C2)
    const degDim = compKnowledge.degradation
    const winDim = compKnowledge.usefulWindow
    const paceDim = compKnowledge.paceDrop
    const consDim = compKnowledge.consistency

    const degLabel = degDim.revealed
      ? formatDegradationLabel(degDim.value)
      : 'Estimativa inicial — ainda não validada em pista'

    const windowText = winDim.revealed
      ? formatUsefulWindowLabel(winDim.value)
      : 'Janela em aberto (stints insuficientes)'

    const paceText = paceDim.revealed ? formatPaceDropLabel(paceDim.value) : 'Queda não calculada'

    const consText = consDim.revealed ? formatConsistencyLabel(consDim.value) : 'Indeterminada'

    let riskNotice: string | undefined = undefined
    if (availableCount <= 0) {
      riskNotice = 'Estoque esgotado para este composto.'
    } else if (degDim.value === 'alta' || degDim.value === 'muito_alta') {
      riskNotice = 'Atenção: degradação acentuada registrada na telemetria dos treinos.'
    }

    result[comp] = {
      compound: comp,
      label: COMPOUND_DISPLAY_NAMES[comp],
      availableSetsCount: availableCount,
      eligible,
      confidence: compKnowledge.overallConfidence,
      revealed: true,
      degradationCategory: degLabel,
      degradationValue: degDim.value,
      usefulWindowRange: winDim.value,
      usefulWindowText: windowText,
      paceDropText: paceText,
      consistencyText: consText,
      testedLaps: compKnowledge.totalLapsObserved,
      testedStints: compKnowledge.totalStintsObserved,
      testedConditions: compKnowledge.testedConditions,
      summaryMessage: `Validado em ${compKnowledge.totalStintsObserved} stint(s) (${compKnowledge.totalLapsObserved} voltas). Confiança ${compKnowledge.overallConfidence}.`,
      riskNotice,
    }
  })

  return result
}

/**
 * Planejador tático de corrida informado:
 * Integra as janelas úteis aprendidas de pneus e estoque real disponível por piloto
 * sem bônus físicos ocultos e sem transformar faixas em pit stop forçado.
 */
export function generateRacePlannerRecommendations(
  params: GeneratePreparationInformedParams,
  tyresAnalysis: Record<TireCompound, CompoundInformedAnalysis>,
): Record<string, StrategyInformedRecommendation> {
  const result: Record<string, StrategyInformedRecommendation> = {}
  const totalLaps = params.gpInfo.laps || 53
  const isWet = params.weather.startsWith('chuva')

  const driversList = params.drivers || []

  driversList.forEach((drv) => {
    // 1. Inspecionar o estoque do piloto
    const driverInventory = params.driverTireInventories?.[drv.id] || []
    const availableDriverSets = driverInventory.filter((s) => !s.isFitted && s.wear < 90)

    // Determinar o composto de largada ideal baseado em evidência ou estoque
    let startComp: TireCompound = 'medio'
    if (isWet) {
      startComp = params.weather === 'chuva_forte' ? 'chuva_extrema' : 'intermediario'
    } else {
      // Em seco: prefere Médio se houver estoque; se não, Duro; se não, Macio
      const hasMedio = availableDriverSets.some((s) => s.compound === 'medio')
      const hasDuro = availableDriverSets.some((s) => s.compound === 'duro')
      const hasMacio = availableDriverSets.some((s) => s.compound === 'macio')

      if (hasMedio) startComp = 'medio'
      else if (hasDuro) startComp = 'duro'
      else if (hasMacio) startComp = 'macio'
    }

    const startAnalysis = tyresAnalysis[startComp]
    const chosenStartSet = availableDriverSets.find((s) => s.compound === startComp)

    // Determinar a janela útil aprendida do composto de largada
    let estimatedStintLaps = { min: 14, max: 24 }
    if (startAnalysis && startAnalysis.usefulWindowRange) {
      estimatedStintLaps = {
        min: startAnalysis.usefulWindowRange.minLaps,
        max: startAnalysis.usefulWindowRange.maxLaps,
      }
    } else {
      // Estimativa teórica base de fábrica
      if (startComp === 'macio') estimatedStintLaps = { min: 10, max: 18 }
      else if (startComp === 'medio') estimatedStintLaps = { min: 16, max: 28 }
      else if (startComp === 'duro') estimatedStintLaps = { min: 24, max: 38 }
      else estimatedStintLaps = { min: 15, max: 30 }
    }

    // Janela estimada da primeira parada (em voltas, derivada da janela útil)
    const pit1LapMin = Math.max(8, Math.min(totalLaps - 5, estimatedStintLaps.min))
    const pit1LapMax = Math.max(pit1LapMin + 2, Math.min(totalLaps - 3, estimatedStintLaps.max))

    // Escolha do segundo composto recomendada para a parada
    let secondComp: TireCompound = 'duro'
    if (isWet) {
      secondComp = startComp
    } else {
      // Regra FIA: deve usar composto diferente do de largada em pista seca
      const differentSets = availableDriverSets.filter(
        (s) => s.compound !== startComp && s.id !== chosenStartSet?.id,
      )
      if (differentSets.some((s) => s.compound === 'duro')) {
        secondComp = 'duro'
      } else if (differentSets.some((s) => s.compound === 'medio')) {
        secondComp = 'medio'
      } else if (differentSets.some((s) => s.compound === 'macio')) {
        secondComp = 'macio'
      } else {
        secondComp = 'duro'
      }
    }

    const chosenSecondSet = availableDriverSets.find(
      (s) => s.compound === secondComp && s.id !== chosenStartSet?.id,
    )

    const secondAnalysis = tyresAnalysis[secondComp]
    const primaryRisk =
      startAnalysis.confidence === 'sem_dados'
        ? 'Estimativas de vida útil baseadas apenas em modelo de fábrica. Janela de parada com alta margem de erro.'
        : startAnalysis.degradationValue === 'alta' ||
            startAnalysis.degradationValue === 'muito_alta'
          ? `Degradação acentuada observada no composto ${startComp}. Risco de cliff repentino antes da volta ${pit1LapMax}.`
          : availableDriverSets.length <= 2
            ? 'Estoque crítico de pneus para alternativas táticas.'
            : 'Risco de degradação térmica em caso de tráfego denso.'

    result[drv.id] = {
      driverId: drv.id,
      driverName: drv.name,
      recommendedStartCompound: startComp,
      recommendedStartSetId: chosenStartSet?.id,
      confidence: startAnalysis.confidence,
      observedBasisText:
        startAnalysis.confidence !== 'sem_dados'
          ? `Composto ${startComp} testado em ${startAnalysis.testedStints} stint(s) (${startAnalysis.testedLaps} voltas).`
          : 'Composto ainda não rodou em pista.',
      estimatedStintLaps,
      suggestedPitWindows: [
        {
          pitIndex: 1,
          windowLapMin: pit1LapMin,
          windowLapMax: pit1LapMax,
          recommendedCompound: secondComp,
          recommendedSetId: chosenSecondSet?.id,
          confidence: secondAnalysis?.confidence || 'sem_dados',
          reason: `Janela de parada entre as voltas ${pit1LapMin} e ${pit1LapMax} preserva o composto antes do desgaste crítico.`,
        },
      ],
      primaryRisk,
      strategyHeadline:
        startAnalysis.confidence !== 'sem_dados'
          ? `Estratégia Validada: Largada com ${startAnalysis.label} (Janela: Voltas ${pit1LapMin}–${pit1LapMax})`
          : `Estratégia Padrão: ${startAnalysis.label} (Estimativa inicial — ainda não validada)`,
    }
  })

  return result
}

/**
 * Pacote canônico completo de recomendação informada.
 * Ponto de entrada de domínio consumido pela UI e IA.
 */
export function buildPreparationInformedPackage(
  params: GeneratePreparationInformedParams,
): PreparationInformedPackage {
  const setupRec = analyzeSetupInformed(
    params.currentSetup,
    params.setupKnowledge,
    params.feedbacks,
  )
  const tyresAnalysis = analyzeTyresInformed(
    params.weather,
    params.tyreKnowledge,
    params.tireStock,
    params.driverTireInventories,
  )
  const strategyRecs = generateRacePlannerRecommendations(params, tyresAnalysis)

  const hasPracticeEvidence =
    setupRec.status !== 'initial_estimate' ||
    Object.values(tyresAnalysis).some((ta) => ta.confidence !== 'sem_dados')

  const evidenceBadgeText = hasPracticeEvidence
    ? 'Dados Validados em Pista (TL1/TL2)'
    : 'Estimativa inicial — ainda não validada em pista'

  return {
    hasPracticeEvidence,
    evidenceBadgeText,
    setupRecommendation: setupRec,
    tyresAnalysis,
    strategyRecommendations: strategyRecs,
  }
}
