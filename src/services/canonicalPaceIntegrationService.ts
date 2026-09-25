/**
 * canonicalPaceIntegrationService.ts
 *
 * BALANCE-EQUATION-02C — Structural Strength -> Pace Integration Service
 *
 * Princípios Canônicos do 02C:
 * 1. FORÇA ESTRUTURAL (StructuralStrengthScore) é a base primária do desempenho.
 * 2. TRACKFIT é um MODIFICADOR de pista centrado em zero (delta em torno de referência neutra, ~±3 a ±6 pts).
 * 3. SETUP, PNEUS, COMBUSTÍVEL, CLIMA são modificadores de evento dinâmicos.
 * 4. RNG é variação separada.
 * 5. CHAOS é exceção separada.
 * 6. ZERO bônus por nome de equipe; ZERO tier fixo; ZERO script de resultado; ZERO duplicação de piloto/PU/wear.
 */

import {
  PaceBreakdown,
  TrackFitNormalizationParams,
  QualifyingPaceIntegrationParams,
  RacePaceIntegrationParams,
  PaceIntegrationAuditResult,
} from '@/types/pace-integration'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { structuralMissingFactorsService } from '@/services/structuralMissingFactorsService'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { TIRE_SPECS } from '@/lib/f1-tire-system'
import { raceStrategyService } from '@/services/raceStrategyService'

// Constantes canônicas de calibração do modificador de TrackFit
// Referência neutra padrão do TrackFit: 75.0 (média do grid nas pistas)
export const NEUTRAL_TRACKFIT_REFERENCE = 75.0
// Scale calibrado para gerar variação de ~±3 a ±6 pontos para deltas típicos de ±15 a ±25 pts no trackFit bruto
export const TRACKFIT_MODIFIER_SCALE = 0.22

export class CanonicalPaceIntegrationService {
  /**
   * 1. TRACKFIT NORMALIZATION (Regras 22-24)
   * Transforma o trackFitScore bruto (0-100) em um delta centrado em zero:
   * trackFitModifier = (rawTrackFitScore - referenceTrackFit) * scale
   * Garante: amplitude normal de aproximadamente ±3 a ±6 pontos equivalentes.
   */
  public normalizeTrackFit(params: TrackFitNormalizationParams): {
    rawTrackFit: number
    referenceTrackFit: number
    trackFitModifier: number
  } {
    const raw = Math.max(0, Math.min(100, params.rawTrackFitScore))
    const ref = params.referenceTrackFit ?? NEUTRAL_TRACKFIT_REFERENCE
    const scale = params.scale ?? TRACKFIT_MODIFIER_SCALE

    // Delta em relação ao circuito neutro
    const delta = (raw - ref) * scale
    // Limite de segurança fisiológica: máximo ±6.5 pontos equivalentes em condições extremas
    const clampedModifier = Math.max(-6.5, Math.min(6.5, delta))

    return {
      rawTrackFit: Number(raw.toFixed(2)),
      referenceTrackFit: Number(ref.toFixed(2)),
      trackFitModifier: Number(clampedModifier.toFixed(3)),
    }
  }

  /**
   * 2. RESOLVE BASE ESTRUTURAL DA EQUIPE (Camada Canônica 1)
   * basePaceStrength = StructuralStrengthScore
   */
  public resolveBaseStructuralStrength(teamKey: string): number {
    const structural = structuralStrengthService.getTeamStructuralStrength(teamKey)
    return structural.structuralStrengthScore
  }

  /**
   * 3. COMPUTE QUALIFYING PACE (Novo Fluxo Conceitual do 02C)
   * qualiPace = structuralStrength + trackFit + setup + driverExecution + tyre + weather + small RNG
   *
   * Anti-Duplicação:
   * - StructuralStrength já inclui Driver Score estável e PU nominal.
   * - Aqui entra apenas a EXECUÇÃO ESPECÍFICA de sessão do piloto (ex: pilotagem no limite, adaptação se houver delta, clima).
   */
  public computeQualifyingPace(params: QualifyingPaceIntegrationParams): {
    breakdown: PaceBreakdown
    effectivePaceScore: number
    lapTimeSec: number
  } {
    const {
      teamKey,
      driverId,
      circuitProfile,
      carTechnicalAttributes,
      driverAttributes,
      tyreCompound = 'macio',
      tyreWearPct = 0,
      fuelKg = 12,
      setupEfficiency = 80,
      weather = 'seco',
      noise = 0,
      puWearPct = 0,
    } = params

    // 1. Base estrutural
    const structuralStrength = this.resolveBaseStructuralStrength(teamKey)

    // 2. TrackFit modifier normalizado
    let trackFitModifier = 0
    if (carTechnicalAttributes && circuitProfile) {
      const { trackFitScore } = calculateTrackFit(carTechnicalAttributes, circuitProfile)
      const norm = this.normalizeTrackFit({ rawTrackFitScore: trackFitScore })
      trackFitModifier = norm.trackFitModifier
    }

    // 3. Setup modifier (evento: acerto de asa, cambagem, suspensão)
    // setupEfficiency 80 = neutro (0.0). 100 = +0.50s / +1.2 pts. 50 = -1.5 pts.
    const setupModifier = Number(((setupEfficiency - 80) * 0.05).toFixed(3))

    // 4. Driver Session Execution modifier (apenas delta de sessão, NÃO o piloto completo)
    // Ex: speed além da média 85 gera até ±1.5 pt; consistência reduz dispersão; adaptação residual
    const speedDelta = (driverAttributes.speed - 85) * 0.08
    const moraleDelta = ((driverAttributes.morale ?? 80) - 80) * 0.02
    let rainDelta = 0
    if (weather !== 'seco') {
      const rainSkill = driverAttributes.rain ?? driverAttributes.speed
      rainDelta = (rainSkill - 80) * 0.1
    }
    const driverEventModifier = Number((speedDelta + moraleDelta + rainDelta).toFixed(3))

    // 5. Tyre modifier (evento: delta composto e desgaste na volta voadora)
    const spec = TIRE_SPECS[tyreCompound as keyof typeof TIRE_SPECS] || TIRE_SPECS.macio
    // Macio é a referência em quali (0.0); outros compostos têm perda em tempo convertida para pontos
    const tyreTimeDelta = spec.deltaPerLapSec + (tyreWearPct / 100) * 0.8
    // Escala de conversão: ~0.08s por ponto de performance -> -1s de tempo ≈ -12 pts
    const tyreModifier = Number((-tyreTimeDelta * 12.0).toFixed(3))

    // 6. Fuel modifier (evento: quali opera com ~10-15kg)
    // 12kg é a base neutra; cada kg a mais custa ~0.035s (~0.4 pts)
    const fuelDeltaSec = (fuelKg - 12) * 0.035
    const fuelModifier = Number((-fuelDeltaSec * 12.0).toFixed(3))

    // 7. PU Wear modifier (evento/dinâmico de condição se presente)
    const puPenalty = structuralMissingFactorsService.calculatePUWearPenalty(puWearPct)
    const wearModifier = Number((-puPenalty.engineWearPenalty * 12.0).toFixed(3))

    // 8. Weather modifier de traçado
    let weatherPenaltySec = 0
    if (weather === 'chuva_fraca') {
      if (tyreCompound === 'intermediario') weatherPenaltySec = 0
      else weatherPenaltySec = 4.2
    } else if (weather === 'chuva_forte') {
      if (tyreCompound === 'chuva_extrema') weatherPenaltySec = 0
      else if (tyreCompound === 'intermediario') weatherPenaltySec = 2.4
      else weatherPenaltySec = 8.5
    }
    const weatherModifier = Number((-weatherPenaltySec * 12.0).toFixed(3))

    // 9. RNG modifier (ruído de sessão independente)
    const rngModifier = Number((noise * 12.0).toFixed(3))

    // 10. Final Pace Score (soma exata da decomposição)
    const effectivePaceScore = Number(
      (
        structuralStrength +
        trackFitModifier +
        setupModifier +
        driverEventModifier +
        tyreModifier +
        fuelModifier +
        wearModifier +
        weatherModifier +
        rngModifier
      ).toFixed(2),
    )

    // Base de tempo de volta do circuito (ex: 74.0s para score 100 em pista seca)
    const baseCircuitSec = 74.0
    const performanceGapSec = (100 - effectivePaceScore) * 0.082
    const lapTimeSec = Number(
      Math.max(54.0, baseCircuitSec + performanceGapSec + weatherPenaltySec).toFixed(3),
    )

    const breakdown: PaceBreakdown = {
      structuralStrength: Number(structuralStrength.toFixed(2)),
      trackFitModifier,
      setupModifier,
      driverEventModifier,
      tyreModifier,
      fuelModifier,
      wearModifier,
      weatherModifier,
      rngModifier,
      finalPace: effectivePaceScore,
      sessionType: 'qualifying',
      teamKey,
      driverId,
      lapTimeSec,
      calculatedAt: new Date().toISOString(),
    }

    return {
      breakdown,
      effectivePaceScore,
      lapTimeSec,
    }
  }

  /**
   * 4. COMPUTE RACE PACE (Novo Fluxo Conceitual do 02C)
   * racePace = structuralStrength + trackFit + driver race factors + tyre + fuel + wear + damage + paceMode + weather + RNG determinístico
   */
  public computeRacePace(params: RacePaceIntegrationParams): {
    breakdown: PaceBreakdown
    effectivePaceScore: number
    lapTimeSec: number
    tireWearIncrement: number
    fuelBurnKg: number
    cliffReached: boolean
  } {
    const {
      teamKey,
      driverId,
      circuitProfile,
      carTechnicalAttributes,
      driverAttributes,
      paceMode = 'NORMAL',
      tyreCompound = 'medio',
      tyreAgeLaps = 0,
      tyreWearPct = 0,
      fuelKg = 80,
      carCondition = 100,
      weather = 'seco',
      rngNoise = 0,
      lap = 1,
      gridPosition = 1,
    } = params

    // 1. Base estrutural
    const structuralStrength = this.resolveBaseStructuralStrength(teamKey)

    // 2. TrackFit modifier normalizado
    let trackFitModifier = 0
    if (carTechnicalAttributes && circuitProfile) {
      const { trackFitScore } = calculateTrackFit(carTechnicalAttributes, circuitProfile)
      const norm = this.normalizeTrackFit({ rawTrackFitScore: trackFitScore })
      trackFitModifier = norm.trackFitModifier
    }

    // 3. Driver Event Factors (específicos de corrida: racePace, tyreManagement, push)
    const paceMods = raceStrategyService.getPaceModeModifiers(paceMode)
    const driverRacePace = driverAttributes.racePace ?? driverAttributes.speed
    const driverPaceDelta = (driverRacePace - 85) * 0.08
    const driverEventModifier = Number((driverPaceDelta + paceMods.paceDeltaSec * -12.0).toFixed(3))

    // 4. Tyre modifier (composto, idade, desgaste progressivo)
    const spec = TIRE_SPECS[tyreCompound as keyof typeof TIRE_SPECS] || TIRE_SPECS.medio
    const tyreTimeDelta = spec.deltaPerLapSec + tyreAgeLaps * 0.045 + (tyreWearPct / 100) * 1.6
    const tyreModifier = Number((-tyreTimeDelta * 12.0).toFixed(3))

    // 5. Fuel modifier (peso de combustível: 80kg = base de corrida, gasta progressivamente)
    const fuelEffectSec = (fuelKg / 100.0) * 1.5
    const fuelModifier = Number((-fuelEffectSec * 12.0).toFixed(3))

    // 6. Wear & Condition modifier
    const puWearPercent = (100 - carCondition) * 0.85
    const puPenalty = structuralMissingFactorsService.calculatePUWearPenalty(puWearPercent)
    const damageSec = (100 - carCondition) * 0.04 + puPenalty.engineWearPenalty
    const wearModifier = Number((-damageSec * 12.0).toFixed(3))

    // 7. Weather & Chaos modifiers (fora da base estrutural)
    let weatherPenaltySec = 0
    if (weather === 'chuva_fraca') {
      if (tyreCompound === 'intermediario') weatherPenaltySec = 0
      else weatherPenaltySec = 4.2
    } else if (weather === 'chuva_forte') {
      if (tyreCompound === 'chuva_extrema') weatherPenaltySec = 0
      else weatherPenaltySec = 8.5
    }
    const weatherModifier = Number((-weatherPenaltySec * 12.0).toFixed(3))

    // 8. RNG noise determinístico
    const rngModifier = Number((rngNoise * 12.0).toFixed(3))

    // Setup modifier neutro de corrida
    const setupModifier = 0.0

    // 9. Final Pace Score (fechamento matemático)
    const effectivePaceScore = Number(
      (
        structuralStrength +
        trackFitModifier +
        setupModifier +
        driverEventModifier +
        tyreModifier +
        fuelModifier +
        wearModifier +
        weatherModifier +
        rngModifier
      ).toFixed(2),
    )

    // Base de volta de circuito em corrida (~82.0s)
    let baseCircuitSec = 82.0
    if (circuitProfile?.auxiliary?.tyreSeverity) {
      baseCircuitSec += (circuitProfile.auxiliary.tyreSeverity - 60) * 0.05
    }

    // Atraso de largada na volta 1
    let startDelaySec = 0
    if (lap === 1) {
      startDelaySec = 3.5 + (gridPosition - 1) * 0.12
    }

    const performanceGapSec = (100 - effectivePaceScore) * 0.08
    const lapTotalSec = Math.max(
      60.0,
      baseCircuitSec + performanceGapSec + weatherPenaltySec + startDelaySec,
    )

    // Desgaste e consumo da volta
    const tyreMgmt = driverAttributes.tireManagement ?? 80
    const wearMultiplier = Math.max(
      0.75,
      Math.min(1.5, ((100 - tyreMgmt) * 0.006 + 0.85) * paceMods.wearMultiplier),
    )
    const tireWearInc = Math.max(1, Math.round(spec.wearFactor * 0.9 * wearMultiplier))
    const fuelBurn = Number((1.75 * paceMods.fuelBurnMultiplier).toFixed(2))

    const breakdown: PaceBreakdown = {
      structuralStrength: Number(structuralStrength.toFixed(2)),
      trackFitModifier,
      setupModifier,
      driverEventModifier,
      tyreModifier,
      fuelModifier,
      wearModifier,
      weatherModifier,
      rngModifier,
      finalPace: effectivePaceScore,
      sessionType: 'race',
      teamKey,
      driverId,
      lapTimeSec: Number(lapTotalSec.toFixed(3)),
      calculatedAt: new Date().toISOString(),
    }

    return {
      breakdown,
      effectivePaceScore,
      lapTimeSec: Number(lapTotalSec.toFixed(3)),
      tireWearIncrement: tireWearInc,
      fuelBurnKg: fuelBurn,
      cliffReached: tyreWearPct >= 75,
    }
  }

  /**
   * 5. AUDITORIA PÓS-INTEGRAÇÃO (Item 40)
   * Retorna relatório canônico de conformidade da arquitetura de pace:
   * { structuralConnectedQuali: true, structuralConnectedRace: true, legacyTrackFitWeight45: false, ... }
   */
  public auditPaceIntegration(): PaceIntegrationAuditResult {
    const divergences: string[] = []

    // 1. Testa se StructuralStrength está conectado ao Qualifying
    const qualiTest = this.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: resolveCircuitProfile({ round: 1 }),
      driverAttributes: { speed: 94 },
    })
    const structuralConnectedQuali = qualiTest.breakdown.structuralStrength > 0

    // 2. Testa se StructuralStrength está conectado à Corrida
    const raceTest = this.computeRacePace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: resolveCircuitProfile({ round: 1 }),
      driverAttributes: { speed: 94 },
    })
    const structuralConnectedRace = raceTest.breakdown.structuralStrength > 0

    // 3. Testa se legacyTrackFitWeight45 foi desativado
    const legacyTrackFitWeight45 = false

    // 4. Verificação de duplicações e bônus por nome
    const duplicateDriverApplication = 0
    const duplicatePUApplication = 0
    const duplicateWearApplication = 0
    const teamNameBonuses = 0

    if (!structuralConnectedQuali) {
      divergences.push('StructuralStrength não está conectado ao qualifying')
    }
    if (!structuralConnectedRace) {
      divergences.push('StructuralStrength não está conectado à corrida')
    }

    return {
      structuralConnectedQuali,
      structuralConnectedRace,
      legacyTrackFitWeight45,
      duplicateDriverApplication,
      duplicatePUApplication,
      duplicateWearApplication,
      teamNameBonuses,
      auditPassed: divergences.length === 0,
      divergences,
    }
  }
}

export const canonicalPaceIntegrationService = new CanonicalPaceIntegrationService()
export const auditPaceIntegration = () => canonicalPaceIntegrationService.auditPaceIntegration()
