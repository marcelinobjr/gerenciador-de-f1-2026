/**
 * structural-missing-factors.ts
 *
 * BALANCE-EQUATION-02B — Missing Structural Factors Type Definitions & Contracts
 *
 * Contratos para:
 * 1. MGU-K Rating (0-100) — Atributo técnico real do fornecedor de PU e equipe
 * 2. PU Wear & Penalty — Desgaste real persistente da PU e penalidade no Pace
 * 3. Driver Car Adaptation (0-100) — Familiaridade persistente com o carro
 * 4. PU Reliability vs PU Performance — Separação estrita de potência vs risco de quebra
 * 5. Mechanical Failure Risk — Risco mecânico unificado (Car + PU + Condição + Desgaste)
 * 6. Team Morale — Moral institucional canônico no Structural Team Score
 */

import { DataQualityStatus } from '@/types/structural-strength'

/**
 * Ratings nominais de MGU-K por fornecedor canônico de 2026 (0-100)
 * Representa: eficiência de recuperação, entrega elétrica, estabilidade, capacidade de boost.
 */
export interface MGUKSupplierSpec {
  supplier: 'Mercedes' | 'Ferrari' | 'Honda' | 'Ford' | 'Audi'
  nominalMGUKRating: number // 0 a 100
  boostEfficiency: number // 0 a 100
  recoveryRating: number // 0 a 100
  electricalIntegrationStability: number // 0 a 100
}

/**
 * Atributo real de MGU-K de uma equipe
 */
export interface TeamMGUKState {
  teamKey: string
  supplier: string
  nominalMGUK: number // 0-100
  effectiveMGUK: number // nominalMGUK × integrationFactor (uma única vez)
  integrationFactor: number // Mesmo da PU, sem duplicar
  dataQuality: DataQualityStatus
}

/**
 * Estado persistente de adaptação do piloto ao carro (0-100)
 */
export interface DriverCarAdaptationState {
  driverId: string
  teamKey: string
  carAdaptation: number // 0 a 100
  tenureSeasons: number // Temporadas na equipe
  sessionsCompleted: number // Sessões completadas
  racesCompleted: number // Corridas completadas
  isRookieOrNewToTeam: boolean
  lastUpdatedDate?: string
}

/**
 * Separação de PU Performance e PU Reliability
 */
export interface PURatingsSeparation {
  supplier: string
  nominalPower: number // 0 a 100
  nominalReliability: number // 0 a 100 (puReliabilityRating)
  nominalPerformance: number // 0 a 100 (puPerformanceRating - power, mgu-k, efficiency)
  effectivePerformance: number // performance × integration
  effectiveReliability: number // reliability preservada sem duplicar integration
  mguKRating: number // 0 a 100
}

/**
 * Parâmetros de cálculo do Risco de Falha Mecânica Unificado (Regra 28)
 */
export interface MechanicalFailureRiskParams {
  carReliability: number // Chassis, freios, suspensão (0-100)
  puReliability: number // PU reliability separada (0-100)
  carCondition: number // Condição mecânica do monoposto (0-100)
  puWear: number // Desgaste acumulado da PU (0-100)
  temperature?: number // Temperatura de pista (°C)
  paceMode?: 'PUSH' | 'NORMAL' | 'CONSERVE' | string
}

/**
 * Resultado do cálculo de risco mecânico
 */
export interface MechanicalFailureRiskResult {
  totalRiskPerLap: number // Probabilidade [0, 1] de falha mecânica por volta
  carComponentRisk: number // Contribuição do chassis/carro
  puComponentRisk: number // Contribuição do motor/MGU-K
  wearRiskMultiplier: number // Multiplicador progressivo de desgaste
  paceRiskMultiplier: number // Multiplicador pelo modo de ritmo
  temperatureRiskFactor: number // Fator térmico
  summary: string
}

/**
 * Breakdown técnico 02B com MGU-K e PU Reliability separados
 */
export interface TechnicalScoreBreakdown02B {
  partsScore: number
  effectivePuScore: number
  mguKScore: number
  puReliabilityScore: number
  carReliabilityScore: number
  conditionScore: number
  technicalScore: number
  weights: {
    parts: number
    effectivePu: number
    mguK: number
    reliability: number
    condition: number
  }
}

/**
 * Relatório de auditoria de fatores estruturais faltantes (Regra 55)
 */
export interface StructuralMissingFactorsAuditReport {
  timestamp: string
  teams: number
  mguKMissing: number
  puWearDisconnected: number
  adaptationMissing: number
  puReliabilityDisconnected: number
  teamMoraleMissing: number
  duplicatePUIntegration: number
  duplicateWearApplication: number
  teamNameBonuses: number
  auditPassed: boolean
  details: string[]
}
