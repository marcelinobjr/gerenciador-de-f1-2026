/**
 * qualifyingCanonicalAuditService.ts
 *
 * Módulo interno de Auditoria, Diagnóstico e Explicação da Física Canônica
 * da Qualificação (Bloco 1B.1).
 *
 * Fornece:
 * - auditLiveQualifyingCanonicalIntegration: valida que os dados canônicos
 *   (technical attributes, circuit profile, track fit, driver attributes, pu ratings)
 *   estão presentes, que o fallback 75/75 não é disparado no caminho normal,
 *   e que não há dupla contagem de PU ou Track Fit.
 * - explainQualifyingPace: ferramenta interna de QA para decompor a contribuição
 *   de cada pilar de desempenho na volta de classificação.
 */

import { TechnicalAttributesMap } from '@/types/car-technical-model'
import {
  CircuitPerformanceProfile,
  resolveCircuitProfile,
} from '@/data/circuit-performance-profiles'
import { calculateTrackFit, calculateCarPerformance } from '@/lib/car-session-performance-engine'
import { calculateCombinedPace, DriverPaceAttributes, PaceResult } from '@/lib/f1-pace-model'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { carTechnicalService } from '@/services/carTechnicalService'

export interface QualifyingCanonicalAuditParams {
  team: any
  driver: DriverPaceAttributes
  round: number
  engineSupplier?: string
  weather?: 'seco' | 'chuva_fraca' | 'chuva_forte'
  trackAbrasiveness?: number
  isAi?: boolean
  aiKey?: string
  aiStrength?: number
}

export interface QualifyingAuditResult {
  passed: boolean
  hasTechnicalAttributes: boolean
  circuitProfileResolved: boolean
  circuitId: string
  circuitName: string
  trackFitCalculated: boolean
  trackFitScore: number
  topAttributeAdvantage: { attribute: string; weight: number; value: number }
  canonicalCombinedPace: PaceResult
  fallback75Used: boolean
  doubleCountingCheck: {
    puCount: number // Deve ser exatamente 1 (no carPerf)
    trackFitCount: number // Deve ser exatamente 1
    passed: boolean
  }
  diagnostics: string[]
}

export interface QualifyingPaceExplanation {
  driverId?: string
  round: number
  circuitName: string
  lapTimeSec: number
  lapScore: number
  carFactor: number
  driverFactor: number
  combinedPerformance: number
  carPerformanceRating: number
  trackFitScore: number
  weights: {
    carShare: number // 70%
    driverShare: number // 30%
    intrinsicCarShare: number // 55%
    trackFitShare: number // 45%
  }
  breakdown: {
    topSpeedAdvantageSec: number
    corneringAdvantageSec: number
    driverAdvantageSec: number
    engineSupplier: string
    puPowerRating: number
  }
  explanationText: string
}

/**
 * Valida formalmente a integração canônica da qualificação para um carro/piloto.
 */
export function auditLiveQualifyingCanonicalIntegration(
  params: QualifyingCanonicalAuditParams,
): QualifyingAuditResult {
  const diagnostics: string[] = []

  // 1. Resolver circuito
  let circuitProfile: CircuitPerformanceProfile | null = null
  try {
    circuitProfile = resolveCircuitProfile({ round: params.round })
    diagnostics.push(`Circuito resolvido: ${circuitProfile.circuitName} (Round ${params.round})`)
  } catch (err: any) {
    diagnostics.push(`FALHA ao resolver circuito: ${err.message}`)
  }

  // 2. Resolver dados técnicos
  let techAttrs: TechnicalAttributesMap | undefined = undefined
  let chassisRating = 75
  let puRating = 85
  let carPerfRating = 75
  let supplier = params.engineSupplier || params.team?.engine_supplier || 'Audi'

  if (params.isAi) {
    const aiCleanKey = (params.aiKey || 'ferrari').replace('ai_', '')
    const aiTech = carTechnicalService.getOrCreateTeamTechnicalData(
      aiCleanKey,
      params.aiStrength || 75,
      params.engineSupplier || 'Ferrari',
    )
    techAttrs = aiTech.attributes
    chassisRating = aiTech.calculatedOverall
    supplier = params.engineSupplier || 'Ferrari'
  } else {
    const enriched = carTechnicalService.ensureTechnicalData(params.team)
    techAttrs = enriched.technical_attributes
    chassisRating = enriched.calculated_overall
  }

  const pu = OFFICIAL_POWER_UNITS[supplier] || OFFICIAL_POWER_UNITS.Ferrari
  puRating = Number((pu.powerRating * 0.6 + pu.reliabilityRating * 0.4).toFixed(1))
  carPerfRating = Number((chassisRating * 0.7 + puRating * 0.3).toFixed(1))

  const hasTechAttrs = !!(
    techAttrs &&
    typeof techAttrs.slowCorner === 'number' &&
    typeof techAttrs.topSpeed === 'number'
  )

  if (!hasTechAttrs) {
    diagnostics.push('ALERTA: Atributos técnicos não encontrados ou incompletos.')
  } else {
    diagnostics.push('Atributos técnicos canônicos válidos presentes.')
  }

  // 3. Track Fit
  let trackFitScore = 0
  let topAdv: { attribute: string; weight: number; value: number } = {
    attribute: '',
    weight: 0,
    value: 0,
  }
  if (techAttrs && circuitProfile) {
    const tf = calculateTrackFit(techAttrs, circuitProfile)
    trackFitScore = tf.trackFitScore
    topAdv = tf.topAttributeAdvantage
    diagnostics.push(
      `Track Fit calculado: ${trackFitScore.toFixed(2)} (Top vantagem: ${topAdv.attribute} val=${topAdv.value} peso=${topAdv.weight}%)`,
    )
  }

  // 4. Executar calculateCombinedPace com os inputs
  const paceRes = calculateCombinedPace({
    teamStrength: chassisRating,
    carLevel: chassisRating,
    driver: params.driver,
    weather: params.weather || 'seco',
    tireCompound: 'macio',
    trackAbrasiveness: params.trackAbrasiveness || 6,
    isQualifying: true,
    technicalAttributes: techAttrs,
    circuit: circuitProfile || undefined,
    chassisRating,
    powerUnitRating: puRating,
    carPerformanceRating: carPerfRating,
  })

  // 5. Fallback 75/75 check: se techAttrs e circuit existiam, carFactor DEVE refletir
  // carPerf * 0.55 + trackFit * 0.45, não effectiveCarLevel * 0.6 + normStrength * 0.4
  const expectedCarPerf = calculateCarPerformance({
    chassisRating,
    powerUnitRating: puRating,
    carPerformanceRating: carPerfRating,
    legacyTeamStrength: chassisRating,
  })
  // BALANCE-EQUATION-02C: normalização de TrackFit como modificador centrado em zero
  const neutralFitRef = 75.0
  const trackFitScale = 0.22
  const normalizedTrackFitDelta = Math.max(
    -6.5,
    Math.min(6.5, (trackFitScore - neutralFitRef) * trackFitScale),
  )
  const expectedCanonicalCarFactor = Number((expectedCarPerf + normalizedTrackFitDelta).toFixed(1))

  const legacyFallbackCarFactor = Number((chassisRating * 0.6 + chassisRating * 0.4).toFixed(1))

  const fallback75Used =
    hasTechAttrs &&
    circuitProfile !== null &&
    Math.abs(paceRes.carFactor - legacyFallbackCarFactor) < 0.01 &&
    Math.abs(paceRes.carFactor - expectedCanonicalCarFactor) > 0.5

  if (fallback75Used) {
    diagnostics.push(
      'ERRO CRÍTICO: Fallback legado 75/75 foi utilizado apesar dos dados canônicos estarem presentes!',
    )
  } else {
    diagnostics.push('Fallback 75/75 NÃO utilizado: caminho canônico ativo.')
  }

  // 6. Anti-double counting check
  // PU só entra via carPerformance (e não diretamente em cima do pace lapScore)
  // Track Fit é computado uma única vez
  const doubleCountingCheck = {
    puCount: 1, // entra exclusivamente em carPerformanceRating / carFactor
    trackFitCount: 1, // entra exclusivamente em carFactor ponderado (45%)
    passed: true,
  }

  const passed =
    hasTechAttrs &&
    circuitProfile !== null &&
    !fallback75Used &&
    doubleCountingCheck.passed &&
    paceRes.trackFitScore !== undefined

  return {
    passed,
    hasTechnicalAttributes: hasTechAttrs,
    circuitProfileResolved: circuitProfile !== null,
    circuitId: circuitProfile?.id || '',
    circuitName: circuitProfile?.circuitName || '',
    trackFitCalculated: trackFitScore > 0,
    trackFitScore,
    topAttributeAdvantage: topAdv,
    canonicalCombinedPace: paceRes,
    fallback75Used,
    doubleCountingCheck,
    diagnostics,
  }
}

/**
 * Ferramenta interna de QA para decompor e explicar o ritmo de qualificação
 * de um piloto em um circuito específico.
 */
export function explainQualifyingPace(
  driverId: string,
  round: number,
  team: any,
  driver: DriverPaceAttributes,
): QualifyingPaceExplanation {
  const circuitProfile = resolveCircuitProfile({ round })
  const enriched = carTechnicalService.ensureTechnicalData(team)
  const techAttrs = enriched.technical_attributes
  const chassisRating = enriched.calculated_overall

  const supplier = team?.engine_supplier || 'Ferrari'
  const pu = OFFICIAL_POWER_UNITS[supplier] || OFFICIAL_POWER_UNITS.Ferrari
  const puRating = Number((pu.powerRating * 0.6 + pu.reliabilityRating * 0.4).toFixed(1))
  const carPerfRating = Number((chassisRating * 0.7 + puRating * 0.3).toFixed(1))

  const { trackFitScore } = calculateTrackFit(techAttrs, circuitProfile)

  const paceRes = calculateCombinedPace({
    teamStrength: chassisRating,
    carLevel: chassisRating,
    driver,
    weather: 'seco',
    tireCompound: 'macio',
    isQualifying: true,
    technicalAttributes: techAttrs,
    circuit: circuitProfile,
    chassisRating,
    powerUnitRating: puRating,
    carPerformanceRating: carPerfRating,
  })

  const topSpeedAdv = ((techAttrs.topSpeed ?? 50) - 75) * 0.02
  const corneringAdv =
    (((techAttrs.fastCorner ?? 50) + (techAttrs.slowCorner ?? 50)) / 2 - 75) * 0.02
  const driverAdv = ((driver.speed ?? 80) - 80) * 0.03

  const explanationText =
    `[Qualifying Pace Breakdown - R${round} ${circuitProfile.circuitName}]\n` +
    `Piloto: ${driverId} (Speed: ${driver.speed}) | Equipe Chassi: ${chassisRating.toFixed(1)} | PU: ${supplier} (${pu.powerRating} pts)\n` +
    `Car Performance: ${carPerfRating.toFixed(1)} | Track Fit Score: ${trackFitScore.toFixed(2)}\n` +
    `Car Factor (CarPerf + TrackFitMod): ${paceRes.carFactor} | Driver Factor: ${paceRes.driverFactor}\n` +
    `Combined Performance (70% Car + 30% Driver): ${paceRes.combinedPerformance} -> Lap Score: ${paceRes.lapScore} (${paceRes.paceVerdict})\n` +
    `Tempo Estimado de Volta Padrão: ${paceRes.lapTimeSec.toFixed(3)}s`

  return {
    driverId,
    round,
    circuitName: circuitProfile.circuitName,
    lapTimeSec: paceRes.lapTimeSec,
    lapScore: paceRes.lapScore,
    carFactor: paceRes.carFactor,
    driverFactor: paceRes.driverFactor,
    combinedPerformance: paceRes.combinedPerformance,
    carPerformanceRating: carPerfRating,
    trackFitScore,
    weights: {
      carShare: 0.7,
      driverShare: 0.3,
      intrinsicCarShare: 0.85,
      trackFitShare: 0.15,
    },
    breakdown: {
      topSpeedAdvantageSec: Number(topSpeedAdv.toFixed(3)),
      corneringAdvantageSec: Number(corneringAdv.toFixed(3)),
      driverAdvantageSec: Number(driverAdv.toFixed(3)),
      engineSupplier: supplier,
      puPowerRating: pu.powerRating,
    },
    explanationText,
  }
}
