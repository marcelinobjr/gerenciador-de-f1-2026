/**
 * structural-strength.ts
 *
 * Definições de Tipos para a Fundação da Equação de Força Estrutural (BALANCE-EQUATION-02A)
 * Sistema de medição e auditoria da hierarquia técnica, humana e organizacional
 * das 29 equipes jogáveis/selecionáveis da F1 2026.
 */

export type DataQualityStatus = 'COMPLETE' | 'PARTIAL' | 'DEFAULTED' | 'MISSING'

export interface TechnicalScoreWeights {
  parts: number // 0.50
  effectivePu: number // 0.30
  reliability: number // 0.10
  condition: number // 0.10
}

export interface DriverScoreWeights {
  driverAttributes: number // 0.80
  morale: number // 0.10
  adaptation: number // 0.10
}

export interface TeamScoreWeights {
  infrastructure: number // 0.80
  teamMorale: number // 0.20
}

export interface StructuralStrengthWeights {
  technical: number // 0.60
  driver: number // 0.25
  team: number // 0.15
}

export interface DriverDetailSummary {
  name: string
  role: 'driver1' | 'driver2' | 'reserve'
  overallRating: number
  speed: number
  consistency: number
  rain: number
  defense: number
  morale: number
}

export interface TechnicalScoreBreakdown {
  partsScore: number
  effectivePuScore: number
  reliabilityScore: number
  conditionScore: number
  technicalScore: number
  weights: TechnicalScoreWeights
  componentsMap: Record<string, number>
  puSupplier: string
  effectiveIntegration: number
  nominalPuRating: number
  notes?: string
}

export interface DriverScoreBreakdown {
  driverAttributesScore: number
  moraleScore: number
  adaptationScore: number
  driverScore: number
  isAdaptationNeutral: boolean
  adaptationStatus: 'NEUTRAL_PLACEHOLDER' | 'ACTIVE'
  weights: DriverScoreWeights
  drivers: DriverDetailSummary[]
  notes?: string
}

export interface TeamScoreBreakdown {
  infrastructureScore: number
  teamMoraleScore: number
  teamScore: number
  weights: TeamScoreWeights
  facilitiesLevels: Record<string, number>
  averageFacilityLevel: number
  notes?: string
}

export interface StructuralStrengthBreakdown {
  teamKey: string
  teamName: string
  structuralStrengthScore: number
  technicalScore: number
  driverScore: number
  teamScore: number
  weights: StructuralStrengthWeights
  technicalBreakdown: TechnicalScoreBreakdown
  driverBreakdown: DriverScoreBreakdown
  teamBreakdown: TeamScoreBreakdown
  dataQuality: DataQualityStatus
  dataQualityNotes: string
  calculatedAt: string
}

export interface TeamRankingEntry {
  rank: number
  teamKey: string
  teamName: string
  structuralStrengthScore: number
  technicalScore: number
  driverScore: number
  teamScore: number
  dataQuality: DataQualityStatus
}

export interface StructuralStrengthAuditReport {
  timestamp: string
  baselineVersion: string
  totalTeams: number
  qualityCounts: {
    COMPLETE: number
    PARTIAL: number
    DEFAULTED: number
    MISSING: number
  }
  duplicateFactors: number
  teamNameBonuses: number
  rngDependencies: number
  eventDependencies: number
  raceEngineConsumers: number
  rankings: TeamRankingEntry[]
  allTeams: StructuralStrengthBreakdown[]
  auditPassed: boolean
  divergences: string[]
  notes: string[]
}

export interface BalanceBaselineTeamEntry {
  teamKey: string
  teamName: string
  country?: string
  engineSupplier: string
  relationshipType: 'FACTORY' | 'CUSTOMER'
  maxIntegration: number
  effectiveIntegration: number
  nominalPuPower: number
  nominalPuReliability: number
  nominalPuRating: number
  effectivePuRating: number
  chassisComponents: Record<string, number>
  carReliabilityRating: number
  initialCondition: number
  drivers: DriverDetailSummary[]
  driverAttributesAverage: number
  driverMoraleAverage: number
  driverAdaptationValue: number
  isAdaptationNeutral: boolean
  facilities: Record<string, number>
  infrastructureRating100: number
  teamMoraleRating: number
  dataQuality: DataQualityStatus
  dataQualityReason: string
  technicalScore: number
  driverScore: number
  teamScore: number
  structuralStrengthScore: number
}

export interface BalanceBaselineV0 {
  schemaVersion: 'v0' | string
  baselineId: string
  baselineName: string
  generatedAt: string
  checksum: string
  immutable: boolean
  totalTeamsCount: number
  formulas: {
    technical: string
    driver: string
    team: string
    structuralStrength: string
    weights: {
      technicalSub: TechnicalScoreWeights
      driverSub: DriverScoreWeights
      teamSub: TeamScoreWeights
      structuralOverall: StructuralStrengthWeights
    }
  }
  rngConfiguration: {
    deterministicSeed: number
    hasRuntimeRng: boolean
    rngNotes: string
  }
  prohibitedRulesEnforced: string[]
  teams: Record<string, BalanceBaselineTeamEntry>
}
