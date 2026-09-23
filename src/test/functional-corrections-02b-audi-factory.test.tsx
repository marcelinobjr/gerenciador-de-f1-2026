/**
 * functional-corrections-02b-audi-factory.test.tsx
 *
 * Suíte FC02B: AUDI / AUDI = FACTORY (FC02B-01..15)
 *
 * FC02B-01: Audi + Audi relationshipType = FACTORY.
 * FC02B-02: Audi + Audi maxIntegration = 1.00.
 * FC02B-03: Audi customer legado em save é reconciliado para factory.
 * FC02B-04: Reconciliation preserva knowledge, general knowledge, specific knowledge e supplier tenure.
 * FC02B-05: Reconciliation é idempotente.
 * FC02B-06: Audi UI mostra FÁBRICA.
 * FC02B-07: Audi UI mostra TETO 100%.
 * FC02B-08: Audi não recebe automaticamente integration = 100%.
 * FC02B-09: effectiveIntegration pode ultrapassar 90% se knowledge permitir, pois factory cap = 100%.
 * FC02B-10: Red Bull Ford continua FACTORY 100%.
 * FC02B-11: Racing Bulls Ford continua CUSTOMER 90%.
 * FC02B-12: Aston Martin Honda continua CUSTOMER 90%.
 * FC02B-13: McLaren/Williams Mercedes continuam CUSTOMER 90%.
 * FC02B-14: Ferrari factory / Cadillac customer continuam corretas.
 * FC02B-15: PU integration continua aplicada uma única vez no CarPerf.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import {
  canonicalPowerUnitIntegrationService,
  OFFICIAL_2026_PU_RELATIONSHIPS,
  FACTORY_MAX_INTEGRATION,
} from '@/services/canonicalPowerUnitIntegrationService'
import { PowerUnitIntegrationPanel } from '@/components/car/PowerUnitIntegrationPanel'
import { calculateCarPerformance } from '@/lib/car-session-performance-engine'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import type { PowerUnitIntegrationState } from '@/types/canonical-pu-integration'

describe('SUÍTE FC02B — AUDI / AUDI = FACTORY (FC02B-01..15)', () => {
  const careerId = 'career_fc02b_test'
  const seasonYear = 2026

  beforeEach(() => {
    canonicalPowerUnitIntegrationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // FC02B-01: Audi + Audi relationshipType = FACTORY.
  it('FC02B-01: Audi + Audi relationshipType = FACTORY', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('audi')
    expect(meta.supplierId).toBe('Audi')
    expect(meta.relationshipType).toBe('FACTORY')

    expect(OFFICIAL_2026_PU_RELATIONSHIPS.audi.relationshipType).toBe('FACTORY')
    expect(OFFICIAL_2026_PU_RELATIONSHIPS.audi.supplierId).toBe('Audi')
  })

  // FC02B-02: Audi + Audi maxIntegration = 1.00.
  it('FC02B-02: Audi + Audi maxIntegration = 1.00', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('audi')
    expect(meta.maxIntegration).toBe(1.0)
    expect(meta.maxIntegration).toBe(FACTORY_MAX_INTEGRATION)

    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'audi',
    })
    expect(state.maxIntegration).toBe(1.0)
  })

  // FC02B-03: Audi customer legado em save é reconciliado para factory.
  it('FC02B-03: Audi customer legado em save é reconciliado para factory', () => {
    // Simular save legado no localStorage onde Audi estava salva como CUSTOMER com maxIntegration 0.90
    const legacyKey = `pu_integration_${careerId}_${seasonYear}_audi`
    const legacySavedState: PowerUnitIntegrationState = {
      careerId,
      seasonYear,
      teamId: 'audi',
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 84,
      supplierSpecificKnowledge: 82,
      integrationKnowledge: 82.7,
      effectiveIntegration: 0.895, // clamped a < 0.90
      maxIntegration: 0.9,
      seasonsWithSupplier: 1,
      accumulatedExperience: 24,
      lastUpdatedSeason: 2026,
    }

    window.localStorage.setItem(legacyKey, JSON.stringify(legacySavedState))

    // Carregar via serviço
    const loaded = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'audi',
    })

    expect(loaded.relationshipType).toBe('FACTORY')
    expect(loaded.maxIntegration).toBe(1.0)
  })

  // FC02B-04: Reconciliation preserva knowledge, general knowledge, specific knowledge e supplier tenure.
  it('FC02B-04: Reconciliation preserva knowledge, general knowledge, specific knowledge e supplier tenure', () => {
    const legacySavedState: PowerUnitIntegrationState = {
      careerId: 'fc02b_k_test',
      seasonYear: 2026,
      teamId: 'audi',
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 77.5,
      supplierSpecificKnowledge: 81.2,
      integrationKnowledge: 79.9,
      effectiveIntegration: 0.88,
      maxIntegration: 0.9,
      seasonsWithSupplier: 3,
      accumulatedExperience: 72,
      lastUpdatedSeason: 2026,
    }

    const reconciled =
      canonicalPowerUnitIntegrationService.reconcileLegacyIntegrationState(legacySavedState)

    expect(reconciled.relationshipType).toBe('FACTORY')
    expect(reconciled.maxIntegration).toBe(1.0)
    // Preservação estrita
    expect(reconciled.generalIntegrationKnowledge).toBe(77.5)
    expect(reconciled.supplierSpecificKnowledge).toBe(81.2)
    expect(reconciled.integrationKnowledge).toBe(79.9)
    expect(reconciled.seasonsWithSupplier).toBe(3)
    expect(reconciled.accumulatedExperience).toBe(72)
  })

  // FC02B-05: Reconciliation é idempotente.
  it('FC02B-05: Reconciliation é idempotente', () => {
    const legacySavedState: PowerUnitIntegrationState = {
      careerId: 'fc02b_idemp_test',
      seasonYear: 2026,
      teamId: 'audi',
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 84,
      supplierSpecificKnowledge: 82,
      integrationKnowledge: 82.7,
      effectiveIntegration: 0.89,
      maxIntegration: 0.9,
      seasonsWithSupplier: 1,
      accumulatedExperience: 24,
      lastUpdatedSeason: 2026,
    }

    const run1 =
      canonicalPowerUnitIntegrationService.reconcileLegacyIntegrationState(legacySavedState)
    const run2 = canonicalPowerUnitIntegrationService.reconcileLegacyIntegrationState(run1)

    expect(run1).toEqual(run2)
    expect(run2.relationshipType).toBe('FACTORY')
    expect(run2.maxIntegration).toBe(1.0)
    expect(run2.integrationKnowledge).toBe(legacySavedState.integrationKnowledge)
    expect(run2.generalIntegrationKnowledge).toBe(legacySavedState.generalIntegrationKnowledge)
    expect(run2.supplierSpecificKnowledge).toBe(legacySavedState.supplierSpecificKnowledge)
  })

  // FC02B-06: Audi UI mostra FÁBRICA.
  it('FC02B-06: Audi UI mostra FÁBRICA', () => {
    render(<PowerUnitIntegrationPanel teamId="audi" careerId="fc02b_ui" seasonYear={2026} />)

    const badge = screen.getByTestId('pu-relationship-badge')
    expect(badge.textContent).toBe('FÁBRICA')
    expect(screen.getByTestId('pu-supplier-name').textContent).toBe('Audi')
  })

  // FC02B-07: Audi UI mostra TETO 100%.
  it('FC02B-07: Audi UI mostra TETO 100%', () => {
    render(<PowerUnitIntegrationPanel teamId="audi" careerId="fc02b_ui" seasonYear={2026} />)

    const capEl = screen.getByTestId('pu-max-cap')
    expect(capEl.textContent).toContain('100%')

    // Barra de progresso indica teto 100%
    expect(screen.getByText(/Progresso em direção ao teto \(100%\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Teto Fábrica: 100%/i)).toBeInTheDocument()
    // Não pode mostrar Teto Cliente
    expect(screen.queryByText(/Teto Cliente: 90%/i)).not.toBeInTheDocument()
  })

  // FC02B-08: Audi não recebe automaticamente integration = 100%.
  it('FC02B-08: Audi não recebe automaticamente integration = 100%', () => {
    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'audi',
    })

    // Teto é 1.00 (100%), mas a integração efetiva é baseada no knowledge inicial (~82.7)
    expect(state.maxIntegration).toBe(1.0)
    expect(state.effectiveIntegration).toBeLessThan(1.0)
    expect(state.effectiveIntegration).toBeGreaterThan(0.8)
    expect(state.effectiveIntegration).toBeCloseTo(0.98, 1) // ~0.978 para knowledge ~82.7
  })

  // FC02B-09: effectiveIntegration pode ultrapassar 90% se knowledge permitir, pois factory cap = 100%.
  it('FC02B-09: effectiveIntegration pode ultrapassar 90% se knowledge permitir, pois factory cap = 100%', () => {
    // Knowledge alto (ex: 95) para factory
    const res = canonicalPowerUnitIntegrationService.resolveEffectivePUIntegration({
      integrationKnowledge: 95,
      relationshipType: 'FACTORY',
      maxIntegrationOverride: 1.0,
    })

    expect(res.effectiveIntegration).toBeGreaterThan(0.9)
    expect(res.effectiveIntegration).toBeLessThanOrEqual(1.0)

    // Já para customer com mesmo knowledge 95, o teto trava em <= 0.90
    const resCustomer = canonicalPowerUnitIntegrationService.resolveEffectivePUIntegration({
      integrationKnowledge: 95,
      relationshipType: 'CUSTOMER',
      maxIntegrationOverride: 0.9,
    })
    expect(resCustomer.effectiveIntegration).toBeLessThanOrEqual(0.9)
  })

  // FC02B-10: Red Bull Ford continua FACTORY 100%.
  it('FC02B-10: Red Bull Ford continua FACTORY 100%', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('redbull')
    expect(meta.supplierId).toBe('Ford')
    expect(meta.relationshipType).toBe('FACTORY')
    expect(meta.maxIntegration).toBe(1.0)
  })

  // FC02B-11: Racing Bulls Ford continua CUSTOMER 90%.
  it('FC02B-11: Racing Bulls Ford continua CUSTOMER 90%', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('racingbulls')
    expect(meta.supplierId).toBe('Ford')
    expect(meta.relationshipType).toBe('CUSTOMER')
    expect(meta.maxIntegration).toBe(0.9)
  })

  // FC02B-12: Aston Martin Honda continua CUSTOMER 90%.
  it('FC02B-12: Aston Martin Honda continua CUSTOMER 90%', () => {
    const meta = canonicalPowerUnitIntegrationService.getRelationshipMetadata('astonmartin')
    expect(meta.supplierId).toBe('Honda')
    expect(meta.relationshipType).toBe('CUSTOMER')
    expect(meta.maxIntegration).toBe(0.9)
  })

  // FC02B-13: McLaren/Williams Mercedes continuam CUSTOMER 90%.
  it('FC02B-13: McLaren/Williams Mercedes continuam CUSTOMER 90%', () => {
    const mcl = canonicalPowerUnitIntegrationService.getRelationshipMetadata('mclaren')
    const wil = canonicalPowerUnitIntegrationService.getRelationshipMetadata('williams')
    expect(mcl.supplierId).toBe('Mercedes')
    expect(mcl.relationshipType).toBe('CUSTOMER')
    expect(mcl.maxIntegration).toBe(0.9)

    expect(wil.supplierId).toBe('Mercedes')
    expect(wil.relationshipType).toBe('CUSTOMER')
    expect(wil.maxIntegration).toBe(0.9)
  })

  // FC02B-14: Ferrari factory / Cadillac customer continuam corretas.
  it('FC02B-14: Ferrari factory / Cadillac customer continuam corretas', () => {
    const fer = canonicalPowerUnitIntegrationService.getRelationshipMetadata('ferrari')
    const cad = canonicalPowerUnitIntegrationService.getRelationshipMetadata('cadillac')

    expect(fer.supplierId).toBe('Ferrari')
    expect(fer.relationshipType).toBe('FACTORY')
    expect(fer.maxIntegration).toBe(1.0)

    expect(cad.supplierId).toBe('Ferrari')
    expect(cad.relationshipType).toBe('CUSTOMER')
    expect(cad.maxIntegration).toBe(0.9)
  })

  // FC02B-15: PU integration continua aplicada uma única vez no CarPerf.
  it('FC02B-15: PU integration continua aplicada uma única vez no CarPerf', () => {
    const nominalAudiPU = OFFICIAL_POWER_UNITS.Audi
    const nominalPU = Number(
      (nominalAudiPU.powerRating * 0.6 + nominalAudiPU.reliabilityRating * 0.4).toFixed(1),
    )

    const audiState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'audi',
    })

    const effPU = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: 'Audi',
      effectiveIntegration: audiState.effectiveIntegration,
      relationshipType: 'FACTORY',
    })

    // PU efetiva calculada uma única vez
    expect(effPU.effectivePuRating).toBe(
      Number((nominalPU * audiState.effectiveIntegration).toFixed(1)),
    )

    // calculateCarPerformance consome effectivePowerUnitRating sem aplicar novo multiplicador
    const chassisRating = 80
    const carPerf = calculateCarPerformance({
      chassisRating,
      effectivePowerUnitRating: effPU.effectivePuRating,
    })

    const expectedCarPerf = Number((chassisRating * 0.7 + effPU.effectivePuRating * 0.3).toFixed(2))
    expect(carPerf).toBe(expectedCarPerf)
  })
})
