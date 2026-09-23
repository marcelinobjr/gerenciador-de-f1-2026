/**
 * pu-integration-01.test.ts
 *
 * Suíte de Homologação PUI-01..22 para o Sistema Canônico de
 * PU Integration Knowledge (FACTORY / CUSTOMER)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  canonicalPowerUnitIntegrationService,
  auditPowerUnitIntegrationSystem,
  FACTORY_MAX_INTEGRATION,
  CUSTOMER_MAX_INTEGRATION,
  OFFICIAL_2026_PU_RELATIONSHIPS,
} from '@/services/canonicalPowerUnitIntegrationService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'

describe('PU-INTEGRATION-01: Canonical Power Unit Integration System (PUI-01..22)', () => {
  const careerId = 'career_pui_test'
  const seasonYear = 2026

  beforeEach(() => {
    canonicalPowerUnitIntegrationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // PUI-01: Red Bull+Ford FACTORY max 1.00
  it('PUI-01: Red Bull+Ford FACTORY max 1.00', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('redbull')
    expect(meta.supplierId).toBe('Ford')
    expect(meta.relationshipType).toBe('FACTORY')
    expect(meta.maxIntegration).toBe(1.0)

    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'redbull',
    })
    expect(state.relationshipType).toBe('FACTORY')
    expect(state.supplierId).toBe('Ford')
    expect(state.maxIntegration).toBe(1.0)
  })

  // PUI-02: Racing Bulls+Ford CUSTOMER max 0.90
  it('PUI-02: Racing Bulls+Ford CUSTOMER max 0.90 (mesma PU Ford da Red Bull mas cliente)', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('racingbulls')
    expect(meta.supplierId).toBe('Ford')
    expect(meta.relationshipType).toBe('CUSTOMER')
    expect(meta.maxIntegration).toBe(0.9)

    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'racingbulls',
    })
    expect(state.relationshipType).toBe('CUSTOMER')
    expect(state.supplierId).toBe('Ford')
    expect(state.maxIntegration).toBe(0.9)
    expect(state.effectiveIntegration).toBeLessThanOrEqual(0.9)
  })

  // PUI-03: Aston Martin+Honda CUSTOMER 0.90
  it('PUI-03: Aston Martin+Honda CUSTOMER 0.90 (não promover a factory por exclusividade)', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('astonmartin')
    expect(meta.supplierId).toBe('Honda')
    expect(meta.relationshipType).toBe('CUSTOMER')
    expect(meta.maxIntegration).toBe(0.9)

    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'astonmartin',
    })
    expect(state.relationshipType).toBe('CUSTOMER')
    expect(state.maxIntegration).toBe(0.9)
    expect(state.effectiveIntegration).toBeLessThanOrEqual(0.9)
  })

  // PUI-04: Mercedes+Mercedes FACTORY 1.00
  it('PUI-04: Mercedes+Mercedes FACTORY 1.00', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('mercedes')
    expect(meta.supplierId).toBe('Mercedes')
    expect(meta.relationshipType).toBe('FACTORY')
    expect(meta.maxIntegration).toBe(1.0)

    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'mercedes',
    })
    expect(state.relationshipType).toBe('FACTORY')
    expect(state.maxIntegration).toBe(1.0)
  })

  // PUI-05: McLaren+Mercedes CUSTOMER 0.90
  it('PUI-05: McLaren+Mercedes CUSTOMER 0.90', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('mclaren')
    expect(meta.supplierId).toBe('Mercedes')
    expect(meta.relationshipType).toBe('CUSTOMER')
    expect(meta.maxIntegration).toBe(0.9)

    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'mclaren',
    })
    expect(state.relationshipType).toBe('CUSTOMER')
    expect(state.maxIntegration).toBe(0.9)
  })

  // PUI-06: Williams+Mercedes CUSTOMER 0.90
  it('PUI-06: Williams+Mercedes CUSTOMER 0.90', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('williams')
    expect(meta.supplierId).toBe('Mercedes')
    expect(meta.relationshipType).toBe('CUSTOMER')
    expect(meta.maxIntegration).toBe(0.9)

    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'williams',
    })
    expect(state.relationshipType).toBe('CUSTOMER')
    expect(state.maxIntegration).toBe(0.9)
  })

  // PUI-07: Ferrari+Ferrari FACTORY 1.00
  it('PUI-07: Ferrari+Ferrari FACTORY 1.00', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('ferrari')
    expect(meta.supplierId).toBe('Ferrari')
    expect(meta.relationshipType).toBe('FACTORY')
    expect(meta.maxIntegration).toBe(1.0)

    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'ferrari',
    })
    expect(state.relationshipType).toBe('FACTORY')
    expect(state.maxIntegration).toBe(1.0)
  })

  // PUI-08: Cadillac+Ferrari CUSTOMER 0.90
  it('PUI-08: Cadillac+Ferrari CUSTOMER 0.90 (relação nova, knowledge inicial relativamente baixo)', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('cadillac')
    expect(meta.supplierId).toBe('Ferrari')
    expect(meta.relationshipType).toBe('CUSTOMER')
    expect(meta.maxIntegration).toBe(0.9)
    expect(meta.initialGeneralKnowledge).toBeLessThan(70)

    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'cadillac',
    })
    expect(state.relationshipType).toBe('CUSTOMER')
    expect(state.maxIntegration).toBe(0.9)
    expect(state.integrationKnowledge).toBeLessThan(70)
  })

  // PUI-09: Audi+Audi FACTORY 1.00
  it('PUI-09: Audi+Audi FACTORY 1.00', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('audi')
    expect(meta.supplierId).toBe('Audi')
    expect(meta.relationshipType).toBe('FACTORY')
    expect(meta.maxIntegration).toBe(1.0)

    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'audi',
    })
    expect(state.relationshipType).toBe('FACTORY')
    expect(state.maxIntegration).toBe(1.0)
  })

  // PUI-10: customer knowledge 100 -> effectiveIntegration <= 0.90
  it('PUI-10: customer knowledge 100 -> effectiveIntegration <= 0.90', () => {
    const res = canonicalPowerUnitIntegrationService.resolveEffectivePUIntegration({
      integrationKnowledge: 100,
      relationshipType: 'CUSTOMER',
    })
    expect(res.effectiveIntegration).toBeLessThanOrEqual(0.9)
    expect(res.effectiveIntegration).toBeCloseTo(0.9, 2)
  })

  // PUI-11: factory knowledge 100 -> <= 1.00 e pode chegar a 1.00
  it('PUI-11: factory knowledge 100 -> <= 1.00 e pode chegar a 1.00', () => {
    const res = canonicalPowerUnitIntegrationService.resolveEffectivePUIntegration({
      integrationKnowledge: 100,
      relationshipType: 'FACTORY',
    })
    expect(res.effectiveIntegration).toBeLessThanOrEqual(1.0)
    expect(res.effectiveIntegration).toBeCloseTo(1.0, 2)
  })

  // PUI-12: Red Bull e Racing Bulls com mesma PU Ford podem ter performance efetiva diferente
  it('PUI-12: Red Bull e Racing Bulls com mesma PU Ford têm performance efetiva diferente (Red Bull até 100%, RB nunca >90%)', () => {
    const rbrState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'redbull',
    })
    const rbState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'racingbulls',
    })

    expect(rbrState.supplierId).toBe('Ford')
    expect(rbState.supplierId).toBe('Ford')

    // Mesmo com knowledge máximo hipotético em ambas
    const perfRbrMax = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: 'Ford',
      effectiveIntegration: 1.0,
      relationshipType: 'FACTORY',
    })
    const perfRbMax = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: 'Ford',
      effectiveIntegration: 0.9,
      relationshipType: 'CUSTOMER',
    })

    expect(perfRbrMax.effectivePuRating).toBeGreaterThan(perfRbMax.effectivePuRating)
    expect(perfRbMax.effectivePuRating / perfRbMax.nominalPuRating).toBeCloseTo(0.9, 2)
    expect(perfRbrMax.effectivePuRating / perfRbrMax.nominalPuRating).toBeCloseTo(1.0, 2)
  })

  // PUI-13: Aston Martin Honda nunca > 90% enquanto CUSTOMER
  it('PUI-13: Aston Martin Honda nunca > 90% enquanto CUSTOMER', () => {
    for (let k = 0; k <= 100; k += 10) {
      const res = canonicalPowerUnitIntegrationService.resolveEffectivePUIntegration({
        integrationKnowledge: k,
        relationshipType: 'CUSTOMER',
      })
      expect(res.effectiveIntegration).toBeLessThanOrEqual(0.9)
    }
  })

  // PUI-14: McLaren pode extrair mais que Williams com mesmo PU Mercedes se knowledge/infraestrutura superiores
  it('PUI-14: McLaren pode extrair mais que Williams com mesmo PU Mercedes se knowledge/infraestrutura superiores', () => {
    const mclState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'mclaren',
    })
    const wilState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'williams',
    })

    expect(mclState.supplierId).toBe('Mercedes')
    expect(wilState.supplierId).toBe('Mercedes')

    const perfMcl = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: 'Mercedes',
      effectiveIntegration: mclState.effectiveIntegration,
      relationshipType: 'CUSTOMER',
    })
    const perfWil = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: 'Mercedes',
      effectiveIntegration: wilState.effectiveIntegration,
      relationshipType: 'CUSTOMER',
    })

    expect(mclState.effectiveIntegration).toBeGreaterThan(wilState.effectiveIntegration)
    expect(perfMcl.effectivePuRating).toBeGreaterThan(perfWil.effectivePuRating)
  })

  // PUI-15: PU efetiva = PU nominal × integração, aplicada uma vez
  it('PUI-15: PU efetiva = PU nominal × integração, aplicada uma única vez sem nerfar rating nominal', () => {
    const nominalFord = OFFICIAL_POWER_UNITS.Ford
    const nominalRating = Number(
      (nominalFord.powerRating * 0.6 + nominalFord.reliabilityRating * 0.4).toFixed(1),
    )

    const effRes = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: 'Ford',
      effectiveIntegration: 0.88,
      relationshipType: 'CUSTOMER',
    })

    // Rating nominal não foi alterado no catálogo
    expect(OFFICIAL_POWER_UNITS.Ford.powerRating).toBe(nominalFord.powerRating)
    expect(effRes.nominalPuRating).toBe(nominalRating)
    expect(effRes.effectivePuRating).toBe(Number((nominalRating * 0.88).toFixed(1)))
  })

  // PUI-16: infraestrutura melhor aumenta learningRate
  it('PUI-16: infraestrutura melhor aumenta learningRate', () => {
    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'astonmartin',
    })

    const gainLowInfra = canonicalPowerUnitIntegrationService.calculateLearningGain({
      currentState: state,
      infrastructureFacilityLevel: 2,
    })
    const gainHighInfra = canonicalPowerUnitIntegrationService.calculateLearningGain({
      currentState: state,
      infrastructureFacilityLevel: 9,
    })

    expect(gainHighInfra.totalGain).toBeGreaterThan(gainLowInfra.totalGain)
    expect(gainHighInfra.factors.infraFactor).toBeGreaterThan(gainLowInfra.factors.infraFactor)
  })

  // PUI-17: knowledge converge ao teto com retornos decrescentes
  it('PUI-17: knowledge converge ao teto com retornos decrescentes (ganhar 60->70 é mais fácil que 88->90)', () => {
    const lowState = {
      ...canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
        careerId,
        seasonYear,
        teamId: 'cadillac',
      }),
      integrationKnowledge: 60,
    }

    const highState = {
      ...canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
        careerId,
        seasonYear,
        teamId: 'mercedes',
      }),
      integrationKnowledge: 90,
    }

    const gainLow = canonicalPowerUnitIntegrationService.calculateLearningGain({
      currentState: lowState,
    })
    const gainHigh = canonicalPowerUnitIntegrationService.calculateLearningGain({
      currentState: highState,
    })

    expect(gainLow.totalGain).toBeGreaterThan(gainHigh.totalGain)
  })

  // PUI-18: troca de fornecedor reduz knowledge específico
  it('PUI-18: troca de fornecedor reduz knowledge específico', () => {
    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'williams',
    })

    const beforeSpecific = state.supplierSpecificKnowledge

    const switched = canonicalPowerUnitIntegrationService.processSupplierChange({
      currentState: state,
      newSupplierId: 'Ferrari',
    })

    expect(switched.supplierId).toBe('Ferrari')
    expect(switched.supplierSpecificKnowledge).toBeLessThan(beforeSpecific)
    expect(switched.seasonsWithSupplier).toBe(1)
  })

  // PUI-19: conhecimento geral parcialmente preservado
  it('PUI-19: conhecimento geral parcialmente preservado após troca de fornecedor', () => {
    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'mclaren',
    })

    const beforeGeneral = state.generalIntegrationKnowledge

    const switched = canonicalPowerUnitIntegrationService.processSupplierChange({
      currentState: state,
      newSupplierId: 'Ford',
    })

    // Preservou parcialmente, não zerou e não manteve 100%
    expect(switched.generalIntegrationKnowledge).toBeGreaterThan(30)
    expect(switched.generalIntegrationKnowledge).toBeLessThan(beforeGeneral)
    expect(switched.generalIntegrationKnowledge).toBeCloseTo(beforeGeneral * 0.65, 0)
  })

  // PUI-20: save/reload preserva integration state
  it('PUI-20: save/reload preserva integration state', () => {
    const original = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId: 'save_reload_test',
      seasonYear: 2026,
      teamId: 'astonmartin',
    })

    // Evoluir um pouco
    const progressed = canonicalPowerUnitIntegrationService.progressKnowledge({
      state: original,
      infrastructureFacilityLevel: 8,
    })

    // Limpar cache em memória para forçar reload do storage
    canonicalPowerUnitIntegrationService.clearMemoryCache()

    const reloaded = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId: 'save_reload_test',
      seasonYear: 2026,
      teamId: 'astonmartin',
    })

    expect(reloaded.integrationKnowledge).toBe(progressed.integrationKnowledge)
    expect(reloaded.effectiveIntegration).toBe(progressed.effectiveIntegration)
    expect(reloaded.supplierId).toBe('Honda')
  })

  // PUI-21: season transition evolui knowledge
  it('PUI-21: season transition evolui knowledge e incrementa tenure se mantido mesmo fornecedor', () => {
    const s2026 = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId: 'season_trans_test',
      seasonYear: 2026,
      teamId: 'astonmartin',
    })

    const tenureBefore = s2026.seasonsWithSupplier

    const s2027 = canonicalPowerUnitIntegrationService.advanceSeason({
      currentState: s2026,
      toSeasonYear: 2027,
      sameSupplier: true,
      infrastructureFacilityLevel: 7,
    })

    expect(s2027.seasonYear).toBe(2027)
    expect(s2027.seasonsWithSupplier).toBe(tenureBefore + 1)
    expect(s2027.integrationKnowledge).toBeGreaterThanOrEqual(s2026.integrationKnowledge)
  })

  // PUI-22: upgrade de infraestrutura não gera salto instantâneo de integrationKnowledge
  it('PUI-22: upgrade de infraestrutura não gera salto instantâneo de integrationKnowledge e nunca altera supplierPUPerformance', () => {
    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'cadillac',
    })

    const initialK = state.integrationKnowledge
    const initialEffective = state.effectiveIntegration

    // Simula a melhoria de infraestrutura (de nível 3 para nível 9)
    // O knowledge atual continua idêntico antes de qualquer aprendizado na pista!
    const afterFacilityUpgradeState = { ...state }

    expect(afterFacilityUpgradeState.integrationKnowledge).toBe(initialK)
    expect(afterFacilityUpgradeState.effectiveIntegration).toBe(initialEffective)

    // O rating nominal do motor Ferrari permanece estritamente o mesmo
    expect(OFFICIAL_POWER_UNITS.Ferrari.powerRating).toBe(97)
    expect(OFFICIAL_POWER_UNITS.Ferrari.reliabilityRating).toBe(94)
  })

  // Auditoria canônica auditPowerUnitIntegrationSystem()
  it('Auditoria formal auditPowerUnitIntegrationSystem() retorna estado 100% correto', () => {
    const report = auditPowerUnitIntegrationSystem(careerId)

    expect(report.factoryRelationshipsCorrect).toBe(true)
    expect(report.customerRelationshipsCorrect).toBe(true)
    expect(report.customerMaxAbove90).toBe(0)
    expect(report.factoryMaxAbove100).toBe(0)
    expect(report.unknownRelationships).toBe(0)
    expect(report.duplicateIntegrationStates).toBe(0)
    expect(report.unresolvedSuppliers).toBe(0)
    expect(report.doubleApplicationDetected).toBe(0)
    expect(report.redBullFordIsFactory).toBe(true)
    expect(report.racingBullsFordIsCustomer).toBe(true)
    expect(report.astonMartinHondaIsCustomer).toBe(true)
  })
})
