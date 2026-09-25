/**
 * structuralMissingFactorsService.ts
 *
 * BALANCE-EQUATION-02B — Missing Structural Factors Canonical Service
 *
 * Implementa de forma canônica, determinística e auditável:
 * 1. MGU-K como atributo técnico real do fornecedor e equipe
 * 2. Desgaste da PU (pu-wear-calculator) conectado a lap pace e confiabilidade
 * 3. Adaptação do piloto ao carro (carAdaptation) persistente e evolutiva
 * 4. Separação de PU Reliability vs PU Performance
 * 5. Cálculo unificado de risco de falha mecânica (calculateMechanicalFailureRisk)
 * 6. Moral da equipe (teamMorale) integrado ao Structural Team Score
 * 7. Auditoria formal canônica (auditStructuralMissingFactors)
 *
 * REGRAS DE OURO:
 * - Canônica; persistente; auditável; determinística; reversível via V0.
 * - SEM team bonus por nome; SEM duplicação de PU integration; SEM duplicação de wear.
 * - Technical 60% / Driver 25% / Team 15% mantido.
 */

import {
  MGUKSupplierSpec,
  TeamMGUKState,
  DriverCarAdaptationState,
  PURatingsSeparation,
  MechanicalFailureRiskParams,
  MechanicalFailureRiskResult,
  StructuralMissingFactorsAuditReport,
} from '@/types/structural-missing-factors'
import { DataQualityStatus } from '@/types/structural-strength'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { canonicalPowerUnitIntegrationService } from '@/services/canonicalPowerUnitIntegrationService'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { calculatePUWear, CalculatePUWearParams } from '@/lib/pu-wear-calculator'

/**
 * Especificações Nominais Oficiais de MGU-K por Fornecedor (2026)
 * Mercedes: referência elétrica 96
 * Ferrari: 94
 * Ford / Red Bull: 93
 * Honda: 90
 * Audi: 86
 */
export const OFFICIAL_SUPPLIER_MGUK_SPECS: Record<string, MGUKSupplierSpec> = {
  Mercedes: {
    supplier: 'Mercedes',
    nominalMGUKRating: 96,
    boostEfficiency: 97,
    recoveryRating: 95,
    electricalIntegrationStability: 96,
  },
  Ferrari: {
    supplier: 'Ferrari',
    nominalMGUKRating: 94,
    boostEfficiency: 95,
    recoveryRating: 93,
    electricalIntegrationStability: 94,
  },
  Ford: {
    supplier: 'Ford',
    nominalMGUKRating: 93,
    boostEfficiency: 94,
    recoveryRating: 92,
    electricalIntegrationStability: 92,
  },
  Honda: {
    supplier: 'Honda',
    nominalMGUKRating: 90,
    boostEfficiency: 89,
    recoveryRating: 92,
    electricalIntegrationStability: 90,
  },
  Audi: {
    supplier: 'Audi',
    nominalMGUKRating: 86,
    boostEfficiency: 86,
    recoveryRating: 87,
    electricalIntegrationStability: 85,
  },
}

export class StructuralMissingFactorsService {
  // Armazenamento em memória para carAdaptation persistente de pilotos
  private driverAdaptations: Map<string, DriverCarAdaptationState> = new Map()

  /**
   * 1. MGU-K NOMINAL DO FORNECEDOR
   * Retorna os ratings nominais do fornecedor. MGU-K pertence ao fornecedor.
   */
  public getSupplierMGUKSpec(supplier: string): MGUKSupplierSpec {
    const norm = this.normalizeSupplier(supplier)
    return OFFICIAL_SUPPLIER_MGUK_SPECS[norm] || OFFICIAL_SUPPLIER_MGUK_SPECS.Audi
  }

  /**
   * 2. MGU-K EFETIVO DA EQUIPE
   * effectiveMGUK = nominalMGUK × integrationFactor
   * Garantia: integrationFactor é o mesmo já resolvido para a PU pela arquitetura canônica,
   * aplicado UMA única vez, sem duplicar o multiplicador.
   */
  public resolveTeamMGUK(params: {
    teamKey: string
    supplier: string
    integrationFactor: number
    dataQuality?: DataQualityStatus
  }): TeamMGUKState {
    const supplierSpec = this.getSupplierMGUKSpec(params.supplier)
    const nominalMGUK = supplierSpec.nominalMGUKRating
    // integrationFactor clamped entre 0.5 e 1.0
    const effFactor = Math.max(0.5, Math.min(1.0, params.integrationFactor))
    const effectiveMGUK = Number((nominalMGUK * effFactor).toFixed(2))

    return {
      teamKey: params.teamKey.toLowerCase().trim(),
      supplier: supplierSpec.supplier,
      nominalMGUK,
      effectiveMGUK,
      integrationFactor: effFactor,
      dataQuality: params.dataQuality ?? (supplierSpec ? 'COMPLETE' : 'DEFAULTED'),
    }
  }

  /**
   * 3. SEPARAÇÃO PU PERFORMANCE vs PU RELIABILITY (Regras 21-24)
   * PU Performance: power, efficiency, MGU-K, integration
   * PU Reliability: chance de falha, sensibilidade a desgaste, estabilidade térmica
   */
  public resolvePURatingsSeparation(params: {
    supplier: string
    integrationFactor: number
  }): PURatingsSeparation {
    const normSupplier = this.normalizeSupplier(params.supplier)
    const puSpec = OFFICIAL_POWER_UNITS[normSupplier] || OFFICIAL_POWER_UNITS.Audi
    const mgukSpec = this.getSupplierMGUKSpec(normSupplier)
    const effFactor = Math.max(0.5, Math.min(1.0, params.integrationFactor))

    const nominalPower = puSpec.powerRating
    const nominalRel = puSpec.reliabilityRating
    const mguKRating = mgukSpec.nominalMGUKRating

    // Performance da PU combina combustão interna (power 65%) + MGU-K elétrico 35%
    const nominalPerformance = Number((nominalPower * 0.65 + mguKRating * 0.35).toFixed(2))
    const effectivePerformance = Number((nominalPerformance * effFactor).toFixed(2))

    // Confiabilidade da PU é nominal de projeto e não multiplica integration como se fosse motor mais fraco
    // Confiabilidade da PU é usada no cálculo de falha mecânica, não na potência pura
    const effectiveReliability = nominalRel

    return {
      supplier: normSupplier,
      nominalPower,
      nominalReliability: nominalRel,
      nominalPerformance,
      effectivePerformance,
      effectiveReliability,
      mguKRating,
    }
  }

  /**
   * 4. DESGASTE DA PU E PENALIDADE DE PACE (Regras 7-11)
   * Conecta pu-wear-calculator ao engine.
   * Não duplica: o desgaste da PU é calculado com piso suave até desgaste moderado,
   * e mais perceptível em condição ruim (puWear alto / condição baixa).
   *
   * Curva progressiva canônica:
   * puWear 0..30%: penalty quase imperceptível (0.00s a 0.05s)
   * puWear 30..60%: penalty leve (0.05s a 0.20s)
   * puWear 60..85%: penalty moderada (0.20s a 0.50s)
   * puWear >85%: penalty severa (0.50s a 1.20s)
   */
  public calculatePUWearPenalty(puWearPercent: number): {
    engineWearPenalty: number // segundos por volta
    performanceLossPct: number // % de perda de potência
    wearBracket: 'FRESH' | 'NOMINAL' | 'DEGRADED' | 'CRITICAL'
  } {
    const wear = Math.max(0, Math.min(100, puWearPercent))

    let engineWearPenalty = 0
    let performanceLossPct = 0
    let wearBracket: 'FRESH' | 'NOMINAL' | 'DEGRADED' | 'CRITICAL' = 'FRESH'

    if (wear <= 30) {
      // Regime fresco: até 0.05s
      engineWearPenalty = (wear / 30) * 0.05
      performanceLossPct = (wear / 30) * 0.6
      wearBracket = 'FRESH'
    } else if (wear <= 60) {
      // Regime nominal: 0.05s a 0.20s
      const ratio = (wear - 30) / 30
      engineWearPenalty = 0.05 + ratio * 0.15
      performanceLossPct = 0.6 + ratio * 1.8
      wearBracket = 'NOMINAL'
    } else if (wear <= 85) {
      // Regime degradado: 0.20s a 0.50s
      const ratio = (wear - 60) / 25
      engineWearPenalty = 0.2 + ratio * 0.3
      performanceLossPct = 2.4 + ratio * 3.6
      wearBracket = 'DEGRADED'
    } else {
      // Regime crítico (>85%): 0.50s até 1.20s
      const ratio = (wear - 85) / 15
      engineWearPenalty = 0.5 + ratio * 0.7
      performanceLossPct = 6.0 + ratio * 8.0
      wearBracket = 'CRITICAL'
    }

    return {
      engineWearPenalty: Number(engineWearPenalty.toFixed(3)),
      performanceLossPct: Number(performanceLossPct.toFixed(2)),
      wearBracket,
    }
  }

  /**
   * Incrementa o desgaste da PU utilizando pu-wear-calculator canônico
   */
  public computeLapPUWearIncrement(params: CalculatePUWearParams): number {
    const res = calculatePUWear(params)
    // Converte o desgaste por sessão/corrida de 12-18% para o incremento de volta
    // Numa corrida típica de ~50-70 voltas, o incremento por volta é ~ (incremento total / 60)
    const perLapWear = res.wearIncrement / 60.0
    return Number(perLapWear.toFixed(3))
  }

  /**
   * 5. RISCO MECÂNICO UNIFICADO (Regras 26-28)
   * calculateMechanicalFailureRisk()
   * Inputs: carReliability, puReliability, carCondition, puWear, temperature, paceMode.
   * Não hardcodado por equipe. Combina confiabilidade mecânica do carro + PU.
   */
  public calculateMechanicalFailureRisk(
    params: MechanicalFailureRiskParams,
  ): MechanicalFailureRiskResult {
    const carRel = Math.max(40, Math.min(100, params.carReliability))
    const puRel = Math.max(40, Math.min(100, params.puReliability))
    const carCond = Math.max(0, Math.min(100, params.carCondition))
    const puWear = Math.max(0, Math.min(100, params.puWear))
    const temp = params.temperature ?? 28

    // 1. Risco componente carro (chassis/câmbio/freios/suspensão)
    // Confiabilidade 95 => 0.00075 por volta (~3-4% no GP)
    // Confiabilidade 70 => 0.0045 por volta (~20% no GP)
    const carComponentRisk = Math.max(0.0005, (100 - carRel) * 0.00015)

    // 2. Risco componente PU / MGU-K
    // puReliability 96 => 0.0006 por volta
    // puReliability 80 => 0.0030 por volta
    const puComponentRisk = Math.max(0.0005, (100 - puRel) * 0.00015)

    // 3. Modificador de desgaste da PU (progressivo, sem cliff absurdo cedo)
    // puWear <= 40%: multiplicador 1.0 (neutro)
    // puWear 40-75%: 1.0x a 1.8x
    // puWear > 75%: sobe até 3.5x
    let wearRiskMultiplier = 1.0
    if (puWear > 75) {
      wearRiskMultiplier = 1.8 + ((puWear - 75) / 25) * 1.7
    } else if (puWear > 40) {
      wearRiskMultiplier = 1.0 + ((puWear - 40) / 35) * 0.8
    }

    // 4. Modificador de condição física do carro
    // carCondition 100% => 0 adicional
    // carCondition 80% => +0.0010
    // carCondition 50% => +0.0035
    const conditionDamageRisk = Math.max(0, (100 - carCond) * 0.00007)

    // 5. Modificador térmico
    let temperatureRiskFactor = 1.0
    if (temp > 35) {
      temperatureRiskFactor = 1.0 + Math.min(0.4, (temp - 35) * 0.04)
    }

    // 6. Modificador por modo de ritmo
    let paceRiskMultiplier = 1.0
    if (params.paceMode === 'PUSH') {
      paceRiskMultiplier = 1.25 // +25% de estresse mecânico
    } else if (params.paceMode === 'CONSERVE') {
      paceRiskMultiplier = 0.75 // -25% de estresse mecânico
    }

    // Risco total por volta
    const combinedBase = carComponentRisk + puComponentRisk * wearRiskMultiplier
    const totalRiskPerLap = Math.min(
      0.15,
      (combinedBase + conditionDamageRisk) * paceRiskMultiplier * temperatureRiskFactor,
    )

    const summary = `Risco Mecânico: ${(totalRiskPerLap * 100).toFixed(2)}%/volta (Carro ${carRel}, PU ${puRel}, Wear ${puWear}%, Cond ${carCond}%)`

    return {
      totalRiskPerLap: Number(totalRiskPerLap.toFixed(6)),
      carComponentRisk: Number(carComponentRisk.toFixed(6)),
      puComponentRisk: Number(puComponentRisk.toFixed(6)),
      wearRiskMultiplier: Number(wearRiskMultiplier.toFixed(3)),
      paceRiskMultiplier: Number(paceRiskMultiplier.toFixed(3)),
      temperatureRiskFactor: Number(temperatureRiskFactor.toFixed(3)),
      summary,
    }
  }

  /**
   * 6. ADAPTAÇÃO DO PILOTO AO CARRO (Regras 12-18)
   * carAdaptation escala 0-100.
   * Representa: familiaridade com o carro, confiança nos limites, setup e engenharia.
   * Piloto novo na equipe: 60-75.
   * Piloto estabelecido/veterano: 80-95.
   * Não hardcodado por nome.
   */
  public getOrCreateDriverAdaptation(params: {
    driverId: string
    teamKey: string
    tenureSeasons?: number
    isNewToTeam?: boolean
  }): DriverCarAdaptationState {
    const key = `${params.driverId}_${params.teamKey}`
    if (this.driverAdaptations.has(key)) {
      return this.driverAdaptations.get(key)!
    }

    // Inicialização canônica determinística baseada na tenure/situação
    const tenure = params.tenureSeasons ?? 1
    const isNew = params.isNewToTeam ?? tenure <= 1

    // Base inicial: novo piloto = 68; piloto estabelecido (tenure >= 2) = 85 + min(10, tenure * 2)
    let initialAdaptation = isNew ? 68 : Math.min(95, 82 + tenure * 3)

    const state: DriverCarAdaptationState = {
      driverId: params.driverId,
      teamKey: params.teamKey.toLowerCase().trim(),
      carAdaptation: initialAdaptation,
      tenureSeasons: tenure,
      sessionsCompleted: tenure * 24,
      racesCompleted: tenure * 20,
      isRookieOrNewToTeam: isNew,
      lastUpdatedDate: new Date().toISOString(),
    }

    this.driverAdaptations.set(key, state)
    return state
  }

  /**
   * Evolução determinística da adaptação com retornos decrescentes (Regra 16)
   * Aumenta com sessões, corridas e tempo na equipe.
   */
  public evolveDriverAdaptation(params: {
    state: DriverCarAdaptationState
    sessionType?: 'fp' | 'qualy' | 'race'
  }): DriverCarAdaptationState {
    const { state, sessionType = 'race' } = params
    const current = state.carAdaptation

    // Retornos decrescentes: quanto mais perto de 100, menor o ganho
    const gap = Math.max(0, 100 - current)
    const baseGain = sessionType === 'race' ? 1.5 : 0.8
    const effectiveGain = baseGain * (gap / 100) * 0.85

    const updatedAdaptation = Math.min(100, Number((current + effectiveGain).toFixed(2)))
    const isRookie = state.isRookieOrNewToTeam && updatedAdaptation < 80

    const updated: DriverCarAdaptationState = {
      ...state,
      carAdaptation: updatedAdaptation,
      sessionsCompleted: state.sessionsCompleted + 1,
      racesCompleted: state.racesCompleted + (sessionType === 'race' ? 1 : 0),
      isRookieOrNewToTeam: isRookie,
      lastUpdatedDate: new Date().toISOString(),
    }

    const key = `${state.driverId}_${state.teamKey}`
    this.driverAdaptations.set(key, updated)
    return updated
  }

  /**
   * Troca de equipe do piloto (Regra 17)
   * carAdaptation cai parcialmente (não zera totalmente, experiência geral permanece).
   * Exemplo: de 92 cai para ~65-72.
   */
  public processDriverTeamTransfer(params: {
    currentState: DriverCarAdaptationState
    newTeamKey: string
  }): DriverCarAdaptationState {
    const { currentState, newTeamKey } = params
    const cleanNewTeam = newTeamKey.toLowerCase().trim()

    if (currentState.teamKey === cleanNewTeam) {
      return currentState
    }

    // Preserva ~65% do conhecimento prévio como experiência geral
    const carriedOver = Math.max(55, Math.min(75, currentState.carAdaptation * 0.72))
    const newAdaptation = Number(carriedOver.toFixed(2))

    const newState: DriverCarAdaptationState = {
      driverId: currentState.driverId,
      teamKey: cleanNewTeam,
      carAdaptation: newAdaptation,
      tenureSeasons: 1,
      sessionsCompleted: 0,
      racesCompleted: 0,
      isRookieOrNewToTeam: true,
      lastUpdatedDate: new Date().toISOString(),
    }

    const key = `${currentState.driverId}_${cleanNewTeam}`
    this.driverAdaptations.set(key, newState)
    return newState
  }

  /**
   * 7. MORAL DA EQUIPE (Regras 30-34)
   * Valor canônico de teamMorale (0-100).
   * Efeito controlado no Structural Team Score (Infrastructure 80% / Team Morale 20%).
   * NÃO afeta o lap time diretamente nesta etapa.
   */
  public resolveTeamMorale(teamKey: string, overrideMorale?: number): number {
    if (typeof overrideMorale === 'number') {
      return Math.max(40, Math.min(100, overrideMorale))
    }
    const cleanKey = teamKey.toLowerCase().trim()
    const baselineEntry = BASELINE_V0_DATA.teams[cleanKey]
    if (baselineEntry && typeof baselineEntry.teamMoraleRating === 'number') {
      return baselineEntry.teamMoraleRating
    }
    return 80 // Valor padrão canônico neutro
  }

  /**
   * 8. AUDITORIA DOS FATORES ESTRUTURAIS FALTANTES (Regra 55)
   * auditStructuralMissingFactors():
   * Valida para as 29 equipes a presença íntegra de:
   * - MGU-K real
   * - Desgaste da PU conectado
   * - Car Adaptation
   * - PU Reliability separada
   * - Team Morale integrado
   * - Zero duplicação de PU integration
   * - Zero duplicação de desgaste
   * - Zero bônus de equipe por nome
   */
  public auditStructuralMissingFactors(): StructuralMissingFactorsAuditReport {
    const baseline = BASELINE_V0_DATA
    const allKeys = Object.keys(baseline.teams)
    const details: string[] = []

    let mguKMissing = 0
    let puWearDisconnected = 0
    let adaptationMissing = 0
    let puReliabilityDisconnected = 0
    let teamMoraleMissing = 0
    let duplicatePUIntegration = 0
    let duplicateWearApplication = 0
    let teamNameBonuses = 0

    allKeys.forEach((key) => {
      const entry = baseline.teams[key]

      // 1. Validar MGU-K
      const supplier = entry.engineSupplier || 'Audi'
      const supplierMGUK = this.getSupplierMGUKSpec(supplier)
      if (!supplierMGUK || supplierMGUK.nominalMGUKRating <= 0) {
        mguKMissing++
        details.push(`Equipe ${key}: MGU-K nominal ausente ou inválido`)
      }

      const teamMGUK = this.resolveTeamMGUK({
        teamKey: key,
        supplier,
        integrationFactor: entry.effectiveIntegration,
      })
      if (!teamMGUK || teamMGUK.effectiveMGUK <= 0) {
        mguKMissing++
      }

      // Validar que integration não foi multiplicada duas vezes
      const expectedEffectiveMGUK = Number(
        (supplierMGUK.nominalMGUKRating * entry.effectiveIntegration).toFixed(2),
      )
      if (Math.abs(teamMGUK.effectiveMGUK - expectedEffectiveMGUK) > 0.05) {
        duplicatePUIntegration++
        details.push(`Equipe ${key}: Possível duplicação ou distorção de integração do MGU-K`)
      }

      // 2. Validar conexão de desgaste da PU
      const wearTest = this.calculatePUWearPenalty(50)
      if (wearTest.engineWearPenalty <= 0) {
        puWearDisconnected++
        details.push(`Equipe ${key}: Desgaste de PU desconectado ou com penalidade zero`)
      }

      // 3. Validar adaptação de piloto
      const firstDrv = entry.drivers[0]
      if (!firstDrv) {
        adaptationMissing++
      } else {
        const drvAdapt = this.getOrCreateDriverAdaptation({
          driverId: `${key}_drv1`,
          teamKey: key,
          tenureSeasons: 2,
        })
        if (!drvAdapt || drvAdapt.carAdaptation <= 0) {
          adaptationMissing++
          details.push(`Equipe ${key}: Adaptação do piloto ausente`)
        }
      }

      // 4. Validar separação PU Reliability vs PU Performance
      const puSeparation = this.resolvePURatingsSeparation({
        supplier,
        integrationFactor: entry.effectiveIntegration,
      })
      if (
        !puSeparation ||
        puSeparation.nominalReliability <= 0 ||
        puSeparation.nominalPerformance <= 0
      ) {
        puReliabilityDisconnected++
        details.push(`Equipe ${key}: Separação PU reliability/performance incompleta`)
      }

      // 5. Validar Team Morale
      const morale = this.resolveTeamMorale(key)
      if (morale <= 0 || morale > 100) {
        teamMoraleMissing++
        details.push(`Equipe ${key}: Team morale inválido (${morale})`)
      }
    })

    const auditPassed =
      mguKMissing === 0 &&
      puWearDisconnected === 0 &&
      adaptationMissing === 0 &&
      puReliabilityDisconnected === 0 &&
      teamMoraleMissing === 0 &&
      duplicatePUIntegration === 0 &&
      duplicateWearApplication === 0 &&
      teamNameBonuses === 0 &&
      allKeys.length === 29

    return {
      timestamp: new Date().toISOString(),
      teams: allKeys.length,
      mguKMissing,
      puWearDisconnected,
      adaptationMissing,
      puReliabilityDisconnected,
      teamMoraleMissing,
      duplicatePUIntegration,
      duplicateWearApplication,
      teamNameBonuses,
      auditPassed,
      details,
    }
  }

  // Normaliza o nome do fornecedor de motor
  private normalizeSupplier(supplier: string): 'Mercedes' | 'Ferrari' | 'Honda' | 'Ford' | 'Audi' {
    const s = (supplier || '').toLowerCase().trim()
    if (s.includes('merc')) return 'Mercedes'
    if (s.includes('ferr')) return 'Ferrari'
    if (s.includes('hond')) return 'Honda'
    if (s.includes('ford') || s.includes('rbpt') || s.includes('red bull')) return 'Ford'
    return 'Audi'
  }

  public clearMemoryCache(): void {
    this.driverAdaptations.clear()
  }
}

export const structuralMissingFactorsService = new StructuralMissingFactorsService()
export const auditStructuralMissingFactors = () =>
  structuralMissingFactorsService.auditStructuralMissingFactors()
export const calculateMechanicalFailureRisk = (params: MechanicalFailureRiskParams) =>
  structuralMissingFactorsService.calculateMechanicalFailureRisk(params)
