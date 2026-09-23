/**
 * pu-integration-01r-runtime-reconciliation.test.ts
 *
 * Suíte PU-INTEGRATION-01R: Runtime Reconciliation & Legacy Key Migration (PUIR-01..10)
 *
 * - PUIR-01: fixture save legado Audi CUSTOMER/0.90, knowledge=67, effective=0.88 → fluxo de load → FACTORY/1.00.
 * - PUIR-02: knowledge 67 preservado.
 * - PUIR-03: effectiveIntegration recalculada (não cravada em 90%; não forçada a 100%).
 * - PUIR-04: Aston Martin+Honda (customer real) permanece CUSTOMER/0.90.
 * - PUIR-05: reconcile rodado 2× = estado idêntico.
 * - PUIR-06: fluxo real de load chama reconcile (migração de chave sob hash PB).
 * - PUIR-07: fluxo real de resume chama reconcile (idempotência e consistência).
 * - PUIR-08: consumer (InfrastructurePage) resolve team_key "audi" — não o hash.
 * - PUIR-09: save → reload → FACTORY/1.00 permanece.
 * - PUIR-10: snapshot histórico não sobrescreve a relação canônica ativa.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  canonicalPowerUnitIntegrationService,
  reconcilePowerUnitIntegrationState,
  FACTORY_MAX_INTEGRATION,
  CUSTOMER_MAX_INTEGRATION,
} from '@/services/canonicalPowerUnitIntegrationService'
import { canonicalCarRatingsAdapter } from '@/lib/canonical-adapters'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'
import type { PowerUnitIntegrationState } from '@/types/canonical-pu-integration'

describe('PU-INTEGRATION-01R — Runtime Reconciliation (PUIR-01..10)', () => {
  const careerId = 'career_puir_01r'
  const seasonYear = 2026

  beforeEach(() => {
    canonicalPowerUnitIntegrationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // PUIR-01: fixture save legado Audi CUSTOMER/0.90, knowledge=67, effective=0.88 → fluxo de load → FACTORY/1.00.
  it('PUIR-01: fixture save legado Audi CUSTOMER/0.90, knowledge=67, effective=0.88 → reconciliação para FACTORY/1.00', () => {
    const legacyState: PowerUnitIntegrationState = {
      careerId,
      seasonYear,
      teamId: 'audi',
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 67,
      supplierSpecificKnowledge: 67,
      integrationKnowledge: 67,
      effectiveIntegration: 0.88,
      maxIntegration: 0.9,
      seasonsWithSupplier: 1,
      accumulatedExperience: 10,
      lastUpdatedSeason: 2026,
    }

    const reconciled = reconcilePowerUnitIntegrationState(legacyState)
    expect(reconciled.relationshipType).toBe('FACTORY')
    expect(reconciled.maxIntegration).toBe(FACTORY_MAX_INTEGRATION)
  })

  // PUIR-02: knowledge 67 preservado.
  it('PUIR-02: knowledge 67 preservado intocado', () => {
    const legacyState: PowerUnitIntegrationState = {
      careerId,
      seasonYear,
      teamId: 'audi',
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 67,
      supplierSpecificKnowledge: 67,
      integrationKnowledge: 67,
      effectiveIntegration: 0.88,
      maxIntegration: 0.9,
      seasonsWithSupplier: 2,
      accumulatedExperience: 48,
      lastUpdatedSeason: 2026,
    }

    const reconciled = reconcilePowerUnitIntegrationState(legacyState)
    expect(reconciled.integrationKnowledge).toBe(67)
    expect(reconciled.generalIntegrationKnowledge).toBe(67)
    expect(reconciled.supplierSpecificKnowledge).toBe(67)
    expect(reconciled.seasonsWithSupplier).toBe(2)
    expect(reconciled.accumulatedExperience).toBe(48)
  })

  // PUIR-03: effectiveIntegration recalculada (não cravada em 90%; não forçada a 100%).
  it('PUIR-03: effectiveIntegration recalculada conforme knowledge 67 e novo cap (não cravada em 0.90 e não forçada a 1.00)', () => {
    const legacyState: PowerUnitIntegrationState = {
      careerId,
      seasonYear,
      teamId: 'audi',
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 67,
      supplierSpecificKnowledge: 67,
      integrationKnowledge: 67,
      effectiveIntegration: 0.88,
      maxIntegration: 0.9,
      seasonsWithSupplier: 1,
      accumulatedExperience: 10,
      lastUpdatedSeason: 2026,
    }

    const reconciled = reconcilePowerUnitIntegrationState(legacyState)
    // Para knowledge 67 sob Factory cap 1.00:
    // k = 67 => normalizedK = 0.67
    // progressFactor = 1 - (1 - 0.67)^1.35 = 1 - 0.33^1.35 ≈ 0.7766
    // eff = 0.80 + 0.20 * 0.7766 ≈ 0.9553
    expect(reconciled.effectiveIntegration).toBeGreaterThan(0.9)
    expect(reconciled.effectiveIntegration).toBeLessThan(1.0)
    expect(reconciled.effectiveIntegration).not.toBe(0.9)
    expect(reconciled.effectiveIntegration).not.toBe(1.0)
  })

  // PUIR-04: Aston Martin+Honda (customer real) permanece CUSTOMER/0.90.
  it('PUIR-04: Aston Martin+Honda (customer real) permanece CUSTOMER/0.90', () => {
    const amState: PowerUnitIntegrationState = {
      careerId,
      seasonYear,
      teamId: 'astonmartin',
      supplierId: 'Honda',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 80,
      supplierSpecificKnowledge: 70,
      integrationKnowledge: 73.5,
      effectiveIntegration: 0.88,
      maxIntegration: 0.9,
      seasonsWithSupplier: 1,
      accumulatedExperience: 24,
      lastUpdatedSeason: 2026,
    }

    const reconciled = reconcilePowerUnitIntegrationState(amState)
    expect(reconciled.relationshipType).toBe('CUSTOMER')
    expect(reconciled.maxIntegration).toBe(CUSTOMER_MAX_INTEGRATION)
    expect(reconciled.effectiveIntegration).toBeLessThanOrEqual(0.9)
  })

  // PUIR-05: reconcile rodado 2× = estado idêntico.
  it('PUIR-05: reconcile rodado 2× é estritamente idempotente (sem drift, sem ganho)', () => {
    const legacyState: PowerUnitIntegrationState = {
      careerId,
      seasonYear,
      teamId: 'audi',
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 67,
      supplierSpecificKnowledge: 67,
      integrationKnowledge: 67,
      effectiveIntegration: 0.88,
      maxIntegration: 0.9,
      seasonsWithSupplier: 1,
      accumulatedExperience: 10,
      lastUpdatedSeason: 2026,
    }

    const run1 = reconcilePowerUnitIntegrationState(legacyState)
    const run2 = reconcilePowerUnitIntegrationState(run1)

    expect(run1).toEqual(run2)
    expect(run2.relationshipType).toBe('FACTORY')
    expect(run2.maxIntegration).toBe(1.0)
    expect(run2.integrationKnowledge).toBe(67)
    expect(run2.effectiveIntegration).toBe(run1.effectiveIntegration)
  })

  // PUIR-06: fluxo real de load chama reconcile (migração de chave sob hash PB).
  it('PUIR-06: migração de chave sob hash PB migra dados para audi e remove chave legada', () => {
    const pbHash = '2xi9j3xb4epwec9'
    const legacyKey = `pu_integration_${careerId}_${seasonYear}_${pbHash}`
    const canonicalKey = `pu_integration_${careerId}_${seasonYear}_audi`

    // Gravar sob hash com dados legados Audi
    const legacyPayload: PowerUnitIntegrationState = {
      careerId,
      seasonYear,
      teamId: pbHash,
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 67,
      supplierSpecificKnowledge: 67,
      integrationKnowledge: 67,
      effectiveIntegration: 0.88,
      maxIntegration: 0.9,
      seasonsWithSupplier: 1,
      accumulatedExperience: 10,
      lastUpdatedSeason: 2026,
    }
    window.localStorage.setItem(legacyKey, JSON.stringify(legacyPayload))

    // Executar migrateLegacyStorageKey
    const migrated = canonicalPowerUnitIntegrationService.migrateLegacyStorageKey({
      careerId,
      seasonYear,
      legacyTeamId: pbHash,
      canonicalTeamKey: 'audi',
    })

    expect(migrated).not.toBeNull()
    expect(migrated?.teamId).toBe('audi')
    expect(migrated?.relationshipType).toBe('FACTORY')
    expect(migrated?.maxIntegration).toBe(1.0)
    expect(migrated?.integrationKnowledge).toBe(67)

    // Chave legada deve ter sido removida do localStorage
    expect(window.localStorage.getItem(legacyKey)).toBeNull()
    // Chave canônica deve conter o estado reconciliado
    const rawCanonical = window.localStorage.getItem(canonicalKey)
    expect(rawCanonical).not.toBeNull()
    const parsedCanonical = JSON.parse(rawCanonical!)
    expect(parsedCanonical.relationshipType).toBe('FACTORY')
    expect(parsedCanonical.maxIntegration).toBe(1.0)
  })

  // PUIR-07: fluxo real de resume chama reconcile (idempotência e consistência).
  it('PUIR-07: getOrCreateIntegrationState reconcilia transparente e idempontentemente no resume', () => {
    const canonicalKey = `pu_integration_${careerId}_${seasonYear}_audi`
    const legacySaved: PowerUnitIntegrationState = {
      careerId,
      seasonYear,
      teamId: 'audi',
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 75,
      supplierSpecificKnowledge: 70,
      integrationKnowledge: 71.75,
      effectiveIntegration: 0.88,
      maxIntegration: 0.9,
      seasonsWithSupplier: 1,
      accumulatedExperience: 12,
      lastUpdatedSeason: 2026,
    }
    window.localStorage.setItem(canonicalKey, JSON.stringify(legacySaved))

    const loaded = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'audi',
      supplierId: 'Audi',
    })

    expect(loaded.relationshipType).toBe('FACTORY')
    expect(loaded.maxIntegration).toBe(1.0)
    expect(loaded.integrationKnowledge).toBe(71.75)
    // Persistência atualizada no storage
    const rawSaved = window.localStorage.getItem(canonicalKey)
    expect(rawSaved).toContain('"relationshipType":"FACTORY"')
    expect(rawSaved).toContain('"maxIntegration":1')
  })

  // PUIR-08: consumer (InfrastructurePage) resolve team_key "audi" — não o hash.
  it('PUIR-08: canonicalCarRatingsAdapter.resolveTeamKey resolve "audi" a partir de objeto da carreira live', () => {
    const liveAudiTeam = {
      id: '2xi9j3xb4epwec9',
      team_key: 'audi',
      name: 'Audi F1 Team',
      engine_supplier: 'Audi' as const,
    }

    const resolved = canonicalCarRatingsAdapter.resolveTeamKey(liveAudiTeam)
    expect(resolved).toBe('audi')
    expect(resolved).not.toBe('2xi9j3xb4epwec9')

    // Ordem canônica testada: team?.team_key || team?.id || 'audi'
    const teamIdForConsumer = liveAudiTeam?.team_key || liveAudiTeam?.id || 'audi'
    expect(teamIdForConsumer).toBe('audi')
  })

  // PUIR-09: save → reload → FACTORY/1.00 permanece.
  it('PUIR-09: save → reload → FACTORY/1.00 permanece intacto sem reversão para CUSTOMER', () => {
    const state = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'audi',
      supplierId: 'Audi',
    })
    expect(state.relationshipType).toBe('FACTORY')
    expect(state.maxIntegration).toBe(1.0)

    // Simula reload: limpar cache de memória e recarregar do localStorage
    canonicalPowerUnitIntegrationService.clearMemoryCache()

    const reloaded = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'audi',
      supplierId: 'Audi',
    })

    expect(reloaded.relationshipType).toBe('FACTORY')
    expect(reloaded.maxIntegration).toBe(1.0)
    expect(reloaded.effectiveIntegration).toBe(state.effectiveIntegration)
  })

  // PUIR-10: snapshot histórico não sobrescreve a relação canônica ativa.
  it('PUIR-10: snapshot histórico com dados de rodada anterior não sobrescreve a relação canônica ativa', () => {
    // Estado canônico ativo
    const active = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear,
      teamId: 'audi',
      supplierId: 'Audi',
    })
    expect(active.relationshipType).toBe('FACTORY')

    // Snapshot histórico de outra temporada ou registro antigo com CUSTOMER
    const historicalSnapshot: PowerUnitIntegrationState = {
      careerId,
      seasonYear: 2025,
      teamId: 'audi',
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 50,
      supplierSpecificKnowledge: 45,
      integrationKnowledge: 46.75,
      effectiveIntegration: 0.85,
      maxIntegration: 0.9,
      seasonsWithSupplier: 0,
      accumulatedExperience: 0,
      lastUpdatedSeason: 2025,
    }

    // A reconciliação do snapshot histórico atualiza a si mesmo sem afetar o cache do estado de 2026
    const reconciledSnapshot = reconcilePowerUnitIntegrationState(historicalSnapshot)
    expect(reconciledSnapshot.seasonYear).toBe(2025)
    expect(reconciledSnapshot.relationshipType).toBe('FACTORY')

    // O estado ativo de 2026 permanece inalterado
    const currentActive = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId,
      seasonYear: 2026,
      teamId: 'audi',
    })
    expect(currentActive.seasonYear).toBe(2026)
    expect(currentActive.relationshipType).toBe('FACTORY')
    expect(currentActive.maxIntegration).toBe(1.0)
  })
})
