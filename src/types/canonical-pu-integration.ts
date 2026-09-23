/**
 * canonical-pu-integration.ts
 *
 * Tipos canônicos para o sistema "PU Integration Knowledge":
 * Eficiência de extração da Unidade de Potência pertencente à relação EQUIPE × FORNECEDOR.
 * - FACTORY: maxIntegration 1.00
 * - CUSTOMER: maxIntegration 0.90
 *
 * Fórmula canônica:
 * PU efetiva = PU nominal × integração efetiva (aplicada uma única vez)
 */

export type PURelationshipType = 'FACTORY' | 'CUSTOMER'

export type PUSupplierId = 'Mercedes' | 'Ferrari' | 'Honda' | 'Ford' | 'Audi'

export interface PowerUnitRelationshipMetadata {
  teamId: string
  supplierId: PUSupplierId
  relationshipType: PURelationshipType
  maxIntegration: number // 1.00 para FACTORY, 0.90 para CUSTOMER
  initialGeneralKnowledge: number // 0-100
  initialSupplierKnowledge: number // 0-100
  initialTenureSeasons: number
}

export interface PowerUnitIntegrationState {
  careerId: string
  seasonYear: number
  teamId: string
  supplierId: PUSupplierId
  relationshipType: PURelationshipType
  generalIntegrationKnowledge: number // 0-100: conhecimento geral de packaging/híbrido
  supplierSpecificKnowledge: number // 0-100: conhecimento específico do motor do fornecedor
  integrationKnowledge: number // 0-100: média ponderada canônica (ex: 35% geral + 65% específico)
  effectiveIntegration: number // 0.00 a maxIntegration (ex: 0.85 a 1.00)
  maxIntegration: number // 1.00 (FACTORY) ou 0.90 (CUSTOMER)
  seasonsWithSupplier: number // Anos consecutivos de parceria
  accumulatedExperience: number // Total de experiência acumulada
  lastUpdatedSeason: number
}

export interface ResolveEffectivePUIntegrationParams {
  integrationKnowledge: number // 0-100
  relationshipType: PURelationshipType
  maxIntegrationOverride?: number
}

export interface ResolveEffectivePUIntegrationResult {
  rawEfficiency: number
  cappedEfficiency: number
  effectiveIntegration: number
  maxAllowed: number
}

export interface EffectivePUPerformanceResult {
  nominalPowerRating: number
  nominalReliabilityRating: number
  nominalPuRating: number // powerRating * 0.6 + reliabilityRating * 0.4
  effectivePuRating: number // nominalPuRating * effectiveIntegration
  effectivePowerRating: number
  effectiveReliabilityRating: number
  effectiveIntegration: number
  relationshipType: PURelationshipType
  supplierId: PUSupplierId
}

export interface PUIntegrationAuditReport {
  factoryRelationshipsCorrect: boolean
  customerRelationshipsCorrect: boolean
  customerMaxAbove90: number
  factoryMaxAbove100: number
  unknownRelationships: number
  duplicateIntegrationStates: number
  unresolvedSuppliers: number
  doubleApplicationDetected: number
  redBullFordIsFactory: boolean
  racingBullsFordIsCustomer: boolean
  astonMartinHondaIsCustomer: boolean
  details: string[]
}
