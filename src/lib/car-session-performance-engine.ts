/**
 * MOTOR DE PERFORMANCE DE SESSÃO DO CARRO — F1 MANAGER 2026 (FASE 0B)
 *
 * Conceito Canônico:
 * CARRO + PISTA + PILOTO + PNEUS + ESTRATÉGIA + CONDIÇÕES + CONFIABILIDADE → PERFORMANCE
 *
 * FUNÇÕES CANÔNICAS SEPARADAS E EXPLICÁVEIS:
 * 1. calculateCarPerformance()         -> Indicador geral do carro (Chassis 70% + PU 30% provisório canônico da Fase 0A)
 * 2. calculateTrackFit()               -> Ponderação dos 12 atributos técnicos do carro pelos pesos do traçado (0-100)
 * 3. calculateDriverContribution()     -> Contribuição do piloto (habilidade, moral, físico, clima) com peso equilibrado
 * 4. calculateTyreEffect()             -> Modulação de ritmo e desgaste combinando tyreManagement do carro e composto
 * 5. calculatePhysicalConditionEffect()-> Efeito de desgaste/dano das peças físicas instaladas (sem alterar o Design/Spec)
 * 6. calculateReliabilityRisk()        -> Risco probabilístico e cumulativo de falha mecânica/abandono
 * 7. calculateSessionPerformance()     -> Integração dos fatores com pequena variabilidade controlada e telemetria
 *
 * TELEMETRIA DE AUDITORIA:
 * generatePerformanceAuditLog()       -> Emite relatório explicável para dev/QA de cada componente de cálculo.
 *
 * DOCUMENTAÇÃO DE EVITAÇÃO DE DUPLA CONTAGEM DA PU:
 * - Onde a PU entra:
 *     1) Na composição macro de `carPerformanceRating` (30% do overall do carro: 70% chassi + 30% PU).
 *     2) No cálculo contextual de velocidade máxima ou aceleração direta caso os atributos venham dos componentes
 *        brutos (mas quando `technical_attributes` já é fornecido, os 12 atributos são calculados puramente a partir
 *        dos 8 componentes aero-mecânicos do chassi, sem re-injetar potência arbitrariamente).
 * - Onde a PU NÃO entra:
 *     1) `calculateTrackFit` pondera estritamente os atributos técnicos do carro contra os pesos do circuito (100%).
 *        Não há bônus multiplicativo adicional de PU em retas se a nota do motor já estiver refletida.
 *     2) A PU não multiplica o `SessionPerformanceIndex` por fora nem adiciona bônus repetido de potência.
 */

import {
  TechnicalAttributeId,
  TechnicalAttributesMap,
  ComponentRatingsMap,
  TechnicalComponentId,
} from '@/types/car-technical-model'
import { CanonicalCarRatings } from '@/types/canonical-contracts'
import {
  CircuitPerformanceProfile,
  CircuitTechnicalWeights,
  resolveCircuitProfile,
} from '@/data/circuit-performance-profiles'
import { TireCompound } from '@/types/f1'
import { TrackWeatherState, TIRE_SPECS, calculateTireCliffStatus } from '@/lib/f1-tire-system'
import { DriverPaceAttributes, calculateDriverSkillScore } from '@/lib/f1-pace-model'

// ============================================================================
// CONTRATOS DO MOTOR DE SESSÃO
// ============================================================================

export interface CarTechnicalInput {
  attributes: TechnicalAttributesMap
  chassisRating?: number
  powerUnitRating?: number
  effectivePowerUnitRating?: number
  carPerformanceRating?: number
  legacyTeamStrength?: number
  /**
   * Condição física (0-100%) das peças físicas instaladas no monoposto nesta sessão.
   * Não altera o baseRating/design das especificações.
   */
  componentConditions?: Partial<Record<TechnicalComponentId, number>>
  hasFrontWingDamage?: boolean
  hasSuspensionDamage?: boolean
  hasFloorDamage?: boolean
}

export interface DriverSessionInput {
  id?: string
  name?: string
  speed: number
  consistency?: number
  defense?: number
  rain?: number
  morale?: number
  physicalCondition?: number
}

export interface TyreSessionInput {
  compound: TireCompound
  lapsOnTire: number
  wearPercent: number
  wearMultiplier?: number
  trackAbrasiveness?: number
  trackTemp?: number
  tacticalMode?: 'attack' | 'preserve' | 'stay_out' | 'normal'
}

export interface EnvironmentSessionInput {
  weather?: TrackWeatherState
  trackTemp?: number
  airTemp?: number
  isQualifying?: boolean
  sessionType?: 'tp1' | 'tp2' | 'q1' | 'q2' | 'q3' | 'race'
}

export interface ReliabilityAssessment {
  riskScore: number // 0-100 (maior = maior risco de problema mecânico)
  isTechnicalIssueTriggered: boolean
  isCriticalFailureTriggered: boolean
  issueSeverity: 'none' | 'light' | 'critical'
  explanation: string
}

export interface SessionPerformanceOutput {
  teamKey: string
  teamName: string
  driverName: string
  circuitId: string
  circuitName: string

  // Pilares Canônicos
  carPerformanceRating: number // 0-100 (geral do carro)
  trackFitScore: number // 0-100 (adequação ao traçado)
  driverContribution: number // 0-100 (score consolidado do piloto)
  tyreEffectDelta: number // Delta em segundos / pontuação
  physicalConditionDelta: number // Penalidade por desgaste de peças físicas (0 a -5)
  weatherDelta: number // Modulação climática
  tacticalDelta: number // Ataque / Conservação

  // Indicador consolidado de performance na sessão
  sessionPerformanceIndex: number // 0-100
  effectiveLapTimeSec: number // Tempo estimado de volta livre na pista (ex: 74.320s)
  lapScore: number // Score de ranking (100+ para topo)

  // Risco mecânico avaliado
  reliabilityAssessment: ReliabilityAssessment

  // Telemetria detalhada de auditoria
  auditLog: string
}

// ============================================================================
// 1. CAR PERFORMANCE (CANÔNICO FASE 0A)
// ============================================================================

/**
 * Calcula a qualidade geral intrínseca do carro (0-100).
 * Preserva estritamente a fórmula canônica da Fase 0A:
 * Car Performance = Chassis (70%) + PU (30%)
 */
export function calculateCarPerformance(ratings: {
  chassisRating?: number
  powerUnitRating?: number
  effectivePowerUnitRating?: number
  carPerformanceRating?: number
  legacyTeamStrength?: number
}): number {
  if (typeof ratings.carPerformanceRating === 'number' && ratings.carPerformanceRating > 0) {
    return Number(ratings.carPerformanceRating.toFixed(2))
  }

  const chassis = ratings.chassisRating ?? ratings.legacyTeamStrength ?? 75
  // O componente "motor" consome effectivePUPerformance, não a PU nominal bruta
  const pu = ratings.effectivePowerUnitRating ?? ratings.powerUnitRating ?? 85
  const result = chassis * 0.7 + pu * 0.3
  return Number(result.toFixed(2))
}

// ============================================================================
// 2. TRACK FIT (CANÔNICO)
// ============================================================================

/**
 * Calcula a adequação específica entre os atributos técnicos do carro e o circuito (0-100).
 * Pondera os 12 atributos técnicos com os pesos normalizados (soma 100%) da planilha canônica.
 *
 * Propriedade intencional de design:
 * Não é persistido como atributo fixo da equipe. Dois carros de 87 e 84 de overall
 * podem ter Track Fits de 82 e 91 em pistas diferentes, gerando alternância esportiva justificada.
 */
export function calculateTrackFit(
  carTechnicalAttributes: TechnicalAttributesMap,
  circuitProfile: CircuitPerformanceProfile,
): {
  trackFitScore: number
  topAttributeAdvantage: { attribute: TechnicalAttributeId; weight: number; value: number }
} {
  const w = circuitProfile.weights
  const a = carTechnicalAttributes

  // Média ponderada estrita dos 12 atributos segundo os pesos do circuito (soma dos pesos = 100)
  const weightedSum =
    (a.slowCorner ?? 50) * w.slowCorner +
    (a.mediumCorner ?? 50) * w.mediumCorner +
    (a.fastCorner ?? 50) * w.fastCorner +
    (a.topSpeed ?? 50) * w.topSpeed +
    (a.acceleration ?? 50) * w.acceleration +
    (a.braking ?? 50) * w.braking +
    (a.traction ?? 50) * w.traction +
    (a.tyreManagement ?? 50) * w.tyreManagement +
    (a.aeroEfficiency ?? 50) * w.aeroEfficiency +
    (a.cooling ?? 50) * w.cooling +
    (a.weight ?? 50) * w.weight +
    (a.reliability ?? 50) * w.reliability

  const trackFitScore = Number((weightedSum / 100).toFixed(2))

  // Identificar o atributo de maior peso na pista para telemetria
  let maxWeightAttr: TechnicalAttributeId = 'slowCorner'
  let maxWeightVal = -1
  for (const [key, val] of Object.entries(w)) {
    if (val > maxWeightVal) {
      maxWeightVal = val
      maxWeightAttr = key as TechnicalAttributeId
    }
  }

  return {
    trackFitScore,
    topAttributeAdvantage: {
      attribute: maxWeightAttr,
      weight: maxWeightVal,
      value: a[maxWeightAttr] ?? 50,
    },
  }
}

// ============================================================================
// 3. DRIVER CONTRIBUTION (CANÔNICO)
// ============================================================================

/**
 * Calcula a contribuição esportiva do piloto para a sessão.
 * Integra speed, consistency, defense, rain, moral e condicionamento físico.
 * Incorpora o parâmetro auxiliar do circuito `driverChallenge` (0-100):
 * em pistas muito exigentes ao piloto (Suzuka, Spa, Marina Bay, Silverstone), o piloto
 * tem maior peso relativo sobre o resultado final.
 */
export function calculateDriverContribution(
  driver: DriverSessionInput,
  weather: TrackWeatherState = 'seco',
  circuitAuxiliary?: CircuitPerformanceProfile['auxiliary'],
): {
  driverScore: number
  driverFactor: number
} {
  const baseDriverScore = calculateDriverSkillScore(driver as DriverPaceAttributes, weather)

  // Em circuitos com altíssimo driverChallenge (>70), o piloto diferenciado entrega mais margem
  const challenge = circuitAuxiliary?.driverChallenge ?? 55
  const challengeMultiplier = 1 + (challenge - 55) * 0.002 // ±3% de alavancagem
  const finalScore = Math.max(45, Math.min(100, baseDriverScore * challengeMultiplier))

  return {
    driverScore: Number(finalScore.toFixed(2)),
    driverFactor: Number(finalScore.toFixed(1)),
  }
}

// ============================================================================
// 4. TYRE EFFECT (CANÔNICO)
// ============================================================================

/**
 * Modula a perda de aderência e ritmo decorrente do pneu, integrando:
 * - O atributo canônico `tyreManagement` do carro (0-100)
 * - A severidade térmica/mecânica do traçado `tyreSeverity` (0-100)
 * - Desgaste do composto e proximidade do cliff
 *
 * Quanto MAIOR o tyreManagement do carro, menor a perda por desgaste ao longo do stint.
 */
export function calculateTyreEffect(
  carTyreManagement: number, // 0-100
  tyreInput: TyreSessionInput,
  circuitAuxiliary?: CircuitPerformanceProfile['auxiliary'],
): {
  timeDeltaSec: number
  cliffStatus: ReturnType<typeof calculateTireCliffStatus>
  stintDegradationFactor: number
} {
  const {
    compound,
    lapsOnTire,
    wearPercent,
    wearMultiplier = 1.0,
    trackAbrasiveness = 6,
    trackTemp = 35,
    tacticalMode,
  } = tyreInput

  const severity = circuitAuxiliary?.tyreSeverity ?? 65 // Padrão da planilha

  // Bônus/Atenuação do carro em função do atributo tyreManagement (base neutra = 70):
  // tyreManagement 90 reduz o desgaste e a perda de ritmo em ~15%;
  // tyreManagement 50 amplifica a perda em pistas severas.
  const tyreMgmtBonus = (carTyreManagement - 70) * 0.005 // ex: +10 pontos = +5% de retenção de vida
  const severityMultiplier = 1 + (severity - 60) * 0.006 // Pista severa desgasta mais
  const effectiveDegradationRate = Math.max(0.65, severityMultiplier * (1 - tyreMgmtBonus))

  // 1. Delta base do composto (macio = -0.4s vs médio; duro = +0.55s)
  const compoundSpec = TIRE_SPECS[compound] || TIRE_SPECS.medio
  const compoundDeltaSec = compoundSpec.deltaPerLapSec

  // 2. Perda linear por desgaste acumulado modulada pelo tyreManagement do carro
  const wearDeltaSec = (wearPercent / 100) * 1.6 * effectiveDegradationRate

  // 3. Cliff do pneu
  const isAttacking = tacticalMode === 'attack'
  const cliffStatus = calculateTireCliffStatus({
    compound,
    lapsOnTire,
    wearPercent,
    wearMultiplier: wearMultiplier * effectiveDegradationRate,
    trackAbrasiveness,
    trackTemp,
    isAttacking,
  })

  const totalDeltaSec = compoundDeltaSec + wearDeltaSec + cliffStatus.extraLapTimeSec

  return {
    timeDeltaSec: Number(totalDeltaSec.toFixed(3)),
    cliffStatus,
    stintDegradationFactor: Number(effectiveDegradationRate.toFixed(3)),
  }
}

// ============================================================================
// 5. PHYSICAL CONDITION EFFECT (BRIDGE FASE 0A)
// ============================================================================

/**
 * Avalia a penalidade esportiva na sessão decorrente de desgaste ou dano nas unidades
 * físicas instaladas nos 8 componentes.
 * REGRA CANÔNICA: designRating continua inalterado; apenas a unidade física entrega menos.
 */
export function calculatePhysicalConditionEffect(carInput: CarTechnicalInput): {
  performanceDelta: number // 0 a -4.5 pontos
  lapTimePenaltySec: number // 0 a +3.2s
  explanation: string
} {
  let penaltyPoints = 0
  let lapPenaltySec = 0
  const reasons: string[] = []

  // Asa dianteira quebrada / danificada
  if (carInput.hasFrontWingDamage) {
    penaltyPoints += 3.5
    lapPenaltySec += 2.6
    reasons.push('Dano severo na Asa Dianteira (+2.6s)')
  }

  // Assoalho danificado (perda crítica de efeito solo em 2026)
  if (carInput.hasFloorDamage) {
    penaltyPoints += 2.5
    lapPenaltySec += 1.8
    reasons.push('Dano estrutural no Assoalho (+1.8s)')
  }

  // Suspensão desalinhada/danificada
  if (carInput.hasSuspensionDamage) {
    penaltyPoints += 2.0
    lapPenaltySec += 1.4
    reasons.push('Avaria na Suspensão (+1.4s)')
  }

  // Desgaste médio das peças físicas instaladas (condição < 70% começa a gerar perda sutil)
  if (carInput.componentConditions) {
    const values = Object.values(carInput.componentConditions).filter(
      (c): c is number => typeof c === 'number',
    )
    if (values.length > 0) {
      const avgCondition = values.reduce((sum, v) => sum + v, 0) / values.length
      if (avgCondition < 70) {
        const wearDeficit = (70 - avgCondition) * 0.04
        penaltyPoints += wearDeficit
        lapPenaltySec += wearDeficit * 0.12
        reasons.push(`Fadiga mecânica média das peças físicas (${avgCondition.toFixed(0)}%)`)
      }
    }
  }

  return {
    performanceDelta: -Number(penaltyPoints.toFixed(2)),
    lapTimePenaltySec: Number(lapPenaltySec.toFixed(3)),
    explanation: reasons.length > 0 ? reasons.join('; ') : 'Peças físicas em excelente estado',
  }
}

// ============================================================================
// 6. RELIABILITY RISK (CANÔNICO)
// ============================================================================

/**
 * Avalia o risco cumulativo de falhas mecânicas na sessão.
 * - Confiabilidade maior do carro (0-100) REDUZ progressivamente a probabilidade de falha.
 * - O peso do circuito em `reliability` e a exigência de `cooling` modulam o estresse.
 * - Comportamento probabilístico não-agressivo: sem RNG violento isolado.
 */
export function calculateReliabilityRisk(
  carReliability: number, // 0-100
  carCooling: number, // 0-100
  circuitProfile: CircuitPerformanceProfile,
  engineWearPercent = 15,
): ReliabilityAssessment {
  const circuitReliabilityWeight = circuitProfile.weights.reliability // 7 a 9%
  const circuitCoolingWeight = circuitProfile.weights.cooling // 6 a 11%

  // Índice de estresse do traçado (0 a 100)
  const trackStress = circuitReliabilityWeight * 6 + circuitCoolingWeight * 4

  // Vulnerabilidade do carro: confiabilidade baixa + refrigeração fraca sob alto estresse térmico
  const carVulnerability =
    Math.max(0, 85 - carReliability) * 0.6 + Math.max(0, 85 - carCooling) * 0.4

  // Fator de desgaste do motor (0 a 100%)
  const engineWearRisk = (engineWearPercent / 100) * 20

  // Risk score normalizado (0-100): carros bem projetados ficam entre 5 e 18; carros frágeis podem chegar a 45+
  const rawRiskScore = (trackStress * 0.25 + carVulnerability * 0.5 + engineWearRisk) * 0.7
  const riskScore = Number(Math.max(2, Math.min(95, rawRiskScore)).toFixed(1))

  // Probabilidade estatística cumulativa por corrida (calibrada para média F1: 1 a 2 abandono técnicos por GP)
  // Carro com reliability 95 tem ~1.2% de chance; carro com 50 tem ~9%
  const failureProb = (riskScore / 100) * 0.12
  const criticalProb = failureProb * 0.35 // 35% das falhas resultam em DNF

  // Avaliação determinística / probabilística contida
  const roll = Math.random()
  const isTechnicalIssueTriggered = roll < failureProb
  const isCriticalFailureTriggered = roll < criticalProb

  let issueSeverity: ReliabilityAssessment['issueSeverity'] = 'none'
  if (isCriticalFailureTriggered) {
    issueSeverity = 'critical'
  } else if (isTechnicalIssueTriggered) {
    issueSeverity = 'light'
  }

  return {
    riskScore,
    isTechnicalIssueTriggered,
    isCriticalFailureTriggered,
    issueSeverity,
    explanation:
      issueSeverity === 'critical'
        ? `Falha mecânica crítica provocada por estresse no traçado de ${circuitProfile.circuitName} (Risco: ${riskScore}%)`
        : issueSeverity === 'light'
          ? `Alerta técnico de telemetria: perda intermitente de potência ou arrefecimento (Risco: ${riskScore}%)`
          : `Sistema mecânico operando dentro das margens seguras (Risco calculado: ${riskScore}%)`,
  }
}

// ============================================================================
// 7. SESSION PERFORMANCE INDEX & AUDITORIA TELEMÉTRICA
// ============================================================================

export interface CalculateSessionPerformanceParams {
  teamKey: string
  teamName: string
  driver: DriverSessionInput
  car: CarTechnicalInput
  circuit: CircuitPerformanceProfile | { round?: number; circuitId?: string; circuitName?: string }
  tyre?: Partial<TyreSessionInput>
  environment?: EnvironmentSessionInput
  noise?: number // Ruído determinístico ou aleatório pequeno (±0.15s)
}

/**
 * Função canônica principal da Fase 0B:
 * Integra CARRO + PISTA + PILOTO + PNEUS + ESTRATÉGIA + CONDIÇÕES + CONFIABILIDADE
 * de forma balanceada e explicável, produzindo o SessionPerformanceIndex e o tempo de volta.
 */
export function calculateSessionPerformance(
  params: CalculateSessionPerformanceParams,
): SessionPerformanceOutput {
  const {
    teamKey,
    teamName,
    driver,
    car,
    circuit: rawCircuit,
    tyre: rawTyre,
    environment = {},
    noise = (Math.random() - 0.5) * 0.2, // Pequena variabilidade controlada ±0.10s
  } = params

  // 1. Resolução do perfil de circuito
  const profile: CircuitPerformanceProfile =
    'weights' in rawCircuit
      ? rawCircuit
      : resolveCircuitProfile({
          circuitId: rawCircuit.circuitId,
          round: rawCircuit.round,
          circuitName: rawCircuit.circuitName,
        })

  // 2. Pilar 1: Car Performance (Chassi 70% + PU 30%)
  const carPerformance = calculateCarPerformance({
    chassisRating: car.chassisRating,
    powerUnitRating: car.powerUnitRating,
    effectivePowerUnitRating: car.effectivePowerUnitRating,
    carPerformanceRating: car.carPerformanceRating,
    legacyTeamStrength: car.legacyTeamStrength,
  })

  // 3. Pilar 2: Track Fit (12 atributos × pesos do circuito)
  const { trackFitScore } = calculateTrackFit(car.attributes, profile)

  // 4. Pilar 3: Contribuição do Piloto
  const weather = environment.weather || 'seco'
  const { driverScore } = calculateDriverContribution(driver, weather, profile.auxiliary)

  // 5. Pilar 4: Efeito de Pneus
  const tyreInput: TyreSessionInput = {
    compound: rawTyre?.compound || 'medio',
    lapsOnTire: rawTyre?.lapsOnTire ?? 0,
    wearPercent: rawTyre?.wearPercent ?? 0,
    wearMultiplier: rawTyre?.wearMultiplier ?? 1.0,
    trackAbrasiveness: rawTyre?.trackAbrasiveness ?? 6,
    trackTemp: environment.trackTemp ?? rawTyre?.trackTemp ?? 35,
    tacticalMode: rawTyre?.tacticalMode,
  }
  const tyreEffect = calculateTyreEffect(
    car.attributes.tyreManagement ?? 70,
    tyreInput,
    profile.auxiliary,
  )

  // 6. Pilar 5: Condição Física e Danos das Peças
  const physicalEffect = calculatePhysicalConditionEffect(car)

  // 7. Pilar 6: Confiabilidade e Risco Mecânico
  const reliabilityAssessment = calculateReliabilityRisk(
    car.attributes.reliability ?? 75,
    car.attributes.cooling ?? 75,
    profile,
  )

  // 8. Modulações de Contexto e Clima
  let weatherDeltaSec = 0
  if (weather === 'chuva_fraca') {
    if (tyreInput.compound === 'intermediario') weatherDeltaSec = -0.5
    else if (tyreInput.compound === 'chuva_extrema') weatherDeltaSec = 1.0
    else weatherDeltaSec = 4.2
  } else if (weather === 'chuva_forte') {
    if (tyreInput.compound === 'chuva_extrema') weatherDeltaSec = -0.8
    else if (tyreInput.compound === 'intermediario') weatherDeltaSec = 2.4
    else weatherDeltaSec = 9.0
  } else {
    if (tyreInput.compound === 'intermediario') weatherDeltaSec = 3.8
    if (tyreInput.compound === 'chuva_extrema') weatherDeltaSec = 6.5
  }

  // Modificador tático
  let tacticalDeltaSec = 0
  if (tyreInput.tacticalMode === 'attack') tacticalDeltaSec = -0.35
  else if (tyreInput.tacticalMode === 'preserve') tacticalDeltaSec = +0.45

  // 9. Combinação Não-Ingênua de Performance:
  // Base do Carro ponderada pelo Traçado:
  // effectiveCarScore = carPerformance * 0.55 + trackFitScore * 0.45
  // A união Carro × Piloto mantém o equilíbrio esportivo comprovado:
  // Carro efetivo (70%) + Piloto (30%)
  const effectiveCarScore =
    carPerformance * 0.55 + trackFitScore * 0.45 + physicalEffect.performanceDelta
  const rawSessionIndex = effectiveCarScore * 0.7 + driverScore * 0.3

  const sessionPerformanceIndex = Number(Math.max(30, Math.min(100, rawSessionIndex)).toFixed(1))

  // 10. Conversão para Tempo de Volta Realista (base padrão 74.0s para carro perfeito)
  const baseReferenceSec = 74.0
  const performanceGapSec = (100 - sessionPerformanceIndex) * 0.082

  const finalLapTimeSec =
    baseReferenceSec +
    performanceGapSec +
    tyreEffect.timeDeltaSec +
    physicalEffect.lapTimePenaltySec +
    weatherDeltaSec +
    tacticalDeltaSec +
    noise

  // Lap Score compatível com a escala do grid (para classificação e rankings)
  const lapScore = Number(
    (
      sessionPerformanceIndex * 1.15 -
      (tyreEffect.timeDeltaSec + physicalEffect.lapTimePenaltySec + weatherDeltaSec) * 12 -
      noise * 10
    ).toFixed(2),
  )

  // 11. Geração de Telemetria Formatada de Auditoria
  const auditLog = generatePerformanceAuditLog({
    teamName,
    driverName: driver.name || 'Piloto',
    circuitName: profile.circuitName,
    chassisRating: car.chassisRating ?? car.legacyTeamStrength ?? 75,
    powerUnitRating: car.powerUnitRating ?? 85,
    carPerformanceRating: carPerformance,
    trackFitScore,
    driverContribution: driverScore,
    tyreDelta: -tyreEffect.timeDeltaSec,
    physicalConditionDelta: physicalEffect.performanceDelta,
    weatherDelta: -weatherDeltaSec,
    finalSessionIndex: sessionPerformanceIndex,
  })

  return {
    teamKey,
    teamName,
    driverName: driver.name || 'Piloto',
    circuitId: profile.id,
    circuitName: profile.circuitName,
    carPerformanceRating: carPerformance,
    trackFitScore,
    driverContribution: driverScore,
    tyreEffectDelta: -tyreEffect.timeDeltaSec,
    physicalConditionDelta: physicalEffect.performanceDelta,
    weatherDelta: -weatherDeltaSec,
    tacticalDelta: -tacticalDeltaSec,
    sessionPerformanceIndex,
    effectiveLapTimeSec: Number(finalLapTimeSec.toFixed(3)),
    lapScore,
    reliabilityAssessment,
    auditLog,
  }
}

// ============================================================================
// TELEMETRIA DE DEBUG / AUDITORIA
// ============================================================================

export interface PerformanceAuditInput {
  teamName: string
  driverName?: string
  circuitName: string
  chassisRating: number
  powerUnitRating: number
  carPerformanceRating: number
  trackFitScore: number
  driverContribution: number
  tyreDelta: number
  physicalConditionDelta: number
  weatherDelta: number
  finalSessionIndex: number
}

/**
 * Gera string estruturada de telemetria para inspeção de dev e QA:
 * Ex: "AUDI — SUZUKA | Chassis: 83.4 | PU: 86.2 | Car Performance: 84.2 | Track Fit: 87.1 | Driver: +1.6 | Tyre: -0.7 | Physical Condition: -0.3 | Weather: +0.2 | Final Session Performance: 86.4"
 */
export function generatePerformanceAuditLog(data: PerformanceAuditInput): string {
  const driverDeltaStr =
    data.driverContribution >= 80
      ? `+${((data.driverContribution - 80) * 0.1).toFixed(1)}`
      : `${((data.driverContribution - 80) * 0.1).toFixed(1)}`
  const tyreDeltaStr =
    data.tyreDelta >= 0 ? `+${data.tyreDelta.toFixed(1)}` : `${data.tyreDelta.toFixed(1)}`
  const physDeltaStr =
    data.physicalConditionDelta >= 0
      ? `+${data.physicalConditionDelta.toFixed(1)}`
      : `${data.physicalConditionDelta.toFixed(1)}`
  const weatherDeltaStr =
    data.weatherDelta >= 0 ? `+${data.weatherDelta.toFixed(1)}` : `${data.weatherDelta.toFixed(1)}`

  return (
    `${data.teamName.toUpperCase()} — ${data.circuitName.toUpperCase()} | ` +
    `Chassis: ${data.chassisRating.toFixed(1)} | ` +
    `PU: ${data.powerUnitRating.toFixed(1)} | ` +
    `Car Performance: ${data.carPerformanceRating.toFixed(1)} | ` +
    `Track Fit: ${data.trackFitScore.toFixed(1)} | ` +
    `Driver: ${driverDeltaStr} | ` +
    `Tyre: ${tyreDeltaStr} | ` +
    `Physical Condition: ${physDeltaStr} | ` +
    `Weather: ${weatherDeltaStr} | ` +
    `Final Session Performance: ${data.finalSessionIndex.toFixed(1)}`
  )
}
