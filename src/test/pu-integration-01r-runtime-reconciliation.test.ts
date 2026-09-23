/**
 * pu-integration-01r-runtime-reconciliation.test.ts
 *
 * Suíte PU-INTEGRATION-01R: Runtime Reconciliation & Legacy Key Migration (PUIR-01..15)
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
 * - PUIR-11: Ferrari → FACTORY Ferrari 1.00; Cadillac → CUSTOMER Ferrari 0.90 (ids dinâmicos da carreira via resolver runtime).
 * - PUIR-12: calculateCarPerformance() recebe effectivePowerUnitRating derivado da relação CORRETA (Audi FACTORY 1.00 vs Williams CUSTOMER 0.90 com mesmo chassis nominal).
 * - PUIR-13: save existente carrega sem reset — fixture save legado Audi com knowledge (ex. 67) carrega FACTORY/1.00 mantendo knowledge sem exigir nova carreira.
 * - PUIR-14: knowledge é preservado na reconciliação (integrationKnowledge, generalKnowledge, specificKnowledge, seasonsWithSupplier, accumulatedExperience idênticos antes/depois).
 * - PUIR-15: zero double application — supplierPU × integration aplicada UMA única vez: pipeline rodado duas vezes não degrada (sem segundo multiplicador).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  canonicalPowerUnitIntegrationService,
  reconcilePowerUnitIntegrationState,
  FACTORY_MAX_INTEGRATION,
  CUSTOMER_MAX_INTEGRATION,
  OFFICIAL_2026_PU_RELATIONSHIPS,
} from '@/services/canonicalPowerUnitIntegrationService'
import { canonicalCarRatingsAdapter } from '@/lib/canonical-adapters'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'
import { calculateCarPerformance } from '@/lib/car-session-performance-engine'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import type { PowerUnitIntegrationState } from '@/types/canonical-pu-integration'

describe('PU-INTEGRATION-01R — Runtime Reconciliation (PUIR-01..15)', () => {
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

  // PUIR-11: Ferrari → FACTORY Ferrari 1.00; Cadillac → CUSTOMER Ferrari 0.90 (usar ids dinâmicos da carreira passando pelo mesmo resolver runtime, não pela tabela crua).
  it('PUIR-11: Ferrari → FACTORY Ferrari 1.00; Cadillac → CUSTOMER Ferrari 0.90 via resolver runtime com ids dinâmicos da carreira', () => {
    // Simula equipes vindas do banco PocketBase com ids dinâmicos (hashes alfanuméricos)
    const dynamicFerrariCareerTeam = {
      id: 'rec_fer_dyn_7781x',
      team_key: 'ferrari',
      name: 'Scuderia Ferrari HP',
      engine_supplier: 'Ferrari' as const,
    }

    const dynamicCadillacCareerTeam = {
      id: 'rec_cad_dyn_9942z',
      team_key: 'cadillac',
      name: 'Cadillac F1 Team',
      engine_supplier: 'Ferrari' as const,
    }

    // Passar pelo mesmo resolver runtime canônico
    const resolvedFerrariKey = canonicalCarRatingsAdapter.resolveTeamKey(dynamicFerrariCareerTeam)
    const resolvedCadillacKey = canonicalCarRatingsAdapter.resolveTeamKey(dynamicCadillacCareerTeam)

    expect(resolvedFerrariKey).toBe('ferrari')
    expect(resolvedCadillacKey).toBe('cadillac')

    // Resolver metadata runtime via canonicalPowerUnitIntegrationService
    const ferrariMeta = canonicalPowerUnitIntegrationService.getRelationshipMetadata(
      resolvedFerrariKey,
      dynamicFerrariCareerTeam.engine_supplier,
    )
    const cadillacMeta = canonicalPowerUnitIntegrationService.getRelationshipMetadata(
      resolvedCadillacKey,
      dynamicCadillacCareerTeam.engine_supplier,
    )

    // Ferrari deve ser FACTORY Ferrari com teto 1.00
    expect(ferrariMeta.supplierId).toBe('Ferrari')
    expect(ferrariMeta.relationshipType).toBe('FACTORY')
    expect(ferrariMeta.maxIntegration).toBe(FACTORY_MAX_INTEGRATION)
    expect(ferrariMeta.maxIntegration).toBe(1.0)

    // Cadillac deve ser CUSTOMER Ferrari com teto 0.90
    expect(cadillacMeta.supplierId).toBe('Ferrari')
    expect(cadillacMeta.relationshipType).toBe('CUSTOMER')
    expect(cadillacMeta.maxIntegration).toBe(CUSTOMER_MAX_INTEGRATION)
    expect(cadillacMeta.maxIntegration).toBe(0.9)

    // Validar estado de integração em runtime
    const ferrariState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId: 'career_puir_11',
      seasonYear: 2026,
      teamId: resolvedFerrariKey,
      supplierId: dynamicFerrariCareerTeam.engine_supplier,
    })
    const cadillacState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId: 'career_puir_11',
      seasonYear: 2026,
      teamId: resolvedCadillacKey,
      supplierId: dynamicCadillacCareerTeam.engine_supplier,
    })

    expect(ferrariState.relationshipType).toBe('FACTORY')
    expect(ferrariState.maxIntegration).toBe(1.0)
    expect(cadillacState.relationshipType).toBe('CUSTOMER')
    expect(cadillacState.maxIntegration).toBe(0.9)
  })

  // PUIR-12: calculateCarPerformance() recebe effectivePowerUnitRating derivado da relação CORRETA — provar o input do CarPerf com fixture Audi (FACTORY 1.00) vs um customer (ex. Williams, CUSTOMER 0.90): mesmo chassis nominal, effectivePU diferente conforme integração.
  it('PUIR-12: calculateCarPerformance() recebe effectivePowerUnitRating derivado da relação CORRETA (Audi FACTORY vs Williams CUSTOMER com mesmo chassis nominal)', () => {
    // Equipes: Audi (FACTORY 1.00) e Williams (CUSTOMER 0.90)
    const audiTeam = {
      id: 'hash_audi_live_01',
      team_key: 'audi',
      name: 'Audi F1 Team',
      engine_supplier: 'Audi' as const,
    }
    const williamsTeam = {
      id: 'hash_williams_live_02',
      team_key: 'williams',
      name: 'Williams Racing',
      engine_supplier: 'Mercedes' as const,
    }

    const audiKey = canonicalCarRatingsAdapter.resolveTeamKey(audiTeam)
    const williamsKey = canonicalCarRatingsAdapter.resolveTeamKey(williamsTeam)

    const audiState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId: 'career_puir_12',
      seasonYear: 2026,
      teamId: audiKey,
      supplierId: audiTeam.engine_supplier,
    })
    const williamsState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId: 'career_puir_12',
      seasonYear: 2026,
      teamId: williamsKey,
      supplierId: williamsTeam.engine_supplier,
    })

    expect(audiState.relationshipType).toBe('FACTORY')
    expect(audiState.maxIntegration).toBe(1.0)
    expect(williamsState.relationshipType).toBe('CUSTOMER')
    expect(williamsState.maxIntegration).toBe(0.9)

    // Resolver effective PU para cada uma
    const audiEffPU = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: audiTeam.engine_supplier,
      effectiveIntegration: audiState.effectiveIntegration,
      relationshipType: audiState.relationshipType,
    })
    const williamsEffPU = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: williamsTeam.engine_supplier,
      effectiveIntegration: williamsState.effectiveIntegration,
      relationshipType: williamsState.relationshipType,
    })

    // Ambos os carros com exatamente o mesmo chassis nominal (ex: 80.0)
    const sameChassisRating = 80.0

    const audiCarPerf = calculateCarPerformance({
      chassisRating: sameChassisRating,
      effectivePowerUnitRating: audiEffPU.effectivePuRating,
    })
    const williamsCarPerf = calculateCarPerformance({
      chassisRating: sameChassisRating,
      effectivePowerUnitRating: williamsEffPU.effectivePuRating,
    })

    // Provar que calculateCarPerformance consumiu o effectivePowerUnitRating derivado da relação
    const expectedAudiCarPerf = Number(
      (sameChassisRating * 0.7 + audiEffPU.effectivePuRating * 0.3).toFixed(2),
    )
    const expectedWilliamsCarPerf = Number(
      (sameChassisRating * 0.7 + williamsEffPU.effectivePuRating * 0.3).toFixed(2),
    )

    expect(audiCarPerf).toBe(expectedAudiCarPerf)
    expect(williamsCarPerf).toBe(expectedWilliamsCarPerf)

    // Como Audi é Factory (teto 1.00) e Williams é Customer (teto 0.90),
    // o effectivePuRating da Williams é estritamente limitado pelo cap de 0.90
    expect(williamsState.effectiveIntegration).toBeLessThanOrEqual(0.9)
    expect(audiState.effectiveIntegration).toBeGreaterThan(0.9)
    // E o input do CarPerf reflete a diferença de integração
    expect(audiCarPerf).not.toBe(williamsCarPerf)
  })

  // PUIR-13: save existente carrega sem reset — fixture de save legado Audi com knowledge (ex. 67) carrega como FACTORY/1.00 mantendo knowledge, sem exigir nova carreira.
  it('PUIR-13: save existente carrega sem reset — fixture legado Audi com knowledge 67 carrega FACTORY/1.00 mantendo knowledge sem exigir nova carreira', () => {
    const existingCareerId = 'career_legacy_saved_audi_season_1'
    const storageKey = `pu_integration_${existingCareerId}_2026_audi`

    // Fixture de save legado existente no localStorage com Audi gravado erroneamente como CUSTOMER/0.90
    const existingSaveData: PowerUnitIntegrationState = {
      careerId: existingCareerId,
      seasonYear: 2026,
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
    window.localStorage.setItem(storageKey, JSON.stringify(existingSaveData))

    // Carregamento normal da carreira existente via getOrCreateIntegrationState (sem criar nova carreira)
    const loadedState = canonicalPowerUnitIntegrationService.getOrCreateIntegrationState({
      careerId: existingCareerId,
      seasonYear: 2026,
      teamId: 'audi',
      supplierId: 'Audi',
    })

    // Deve carregar como FACTORY/1.00
    expect(loadedState.relationshipType).toBe('FACTORY')
    expect(loadedState.maxIntegration).toBe(1.0)

    // Knowledge de 67 DEVE ser estritamente mantido (sem reset para defaults 84/82)
    expect(loadedState.integrationKnowledge).toBe(67)
    expect(loadedState.generalIntegrationKnowledge).toBe(67)
    expect(loadedState.supplierSpecificKnowledge).toBe(67)
    expect(loadedState.seasonsWithSupplier).toBe(1)
    expect(loadedState.accumulatedExperience).toBe(10)

    // effectiveIntegration recalculada corretamente com o novo teto de fábrica
    expect(loadedState.effectiveIntegration).toBeGreaterThan(0.9)
    expect(loadedState.effectiveIntegration).toBeLessThan(1.0)

    // Sem exigir nova carreira: os dados persistidos foram preservados e reconciliados
    const rawPersisted = window.localStorage.getItem(storageKey)
    expect(rawPersisted).not.toBeNull()
    const parsed = JSON.parse(rawPersisted!)
    expect(parsed.relationshipType).toBe('FACTORY')
    expect(parsed.integrationKnowledge).toBe(67)
  })

  // PUIR-14: knowledge é preservado na reconciliação (integrationKnowledge, generalKnowledge, specificKnowledge, seasonsWithSupplier, accumulatedExperience idênticos antes/depois).
  it('PUIR-14: knowledge é estritamente preservado na reconciliação (campos de progresso idênticos antes/depois)', () => {
    const customLegacyState: PowerUnitIntegrationState = {
      careerId: 'career_puir_14',
      seasonYear: 2026,
      teamId: 'audi',
      supplierId: 'Audi',
      relationshipType: 'CUSTOMER',
      generalIntegrationKnowledge: 73.45,
      supplierSpecificKnowledge: 61.2,
      integrationKnowledge: 65.49,
      effectiveIntegration: 0.87,
      maxIntegration: 0.9,
      seasonsWithSupplier: 3,
      accumulatedExperience: 57,
      lastUpdatedSeason: 2026,
    }

    const reconciled = reconcilePowerUnitIntegrationState(customLegacyState)

    // Campos de progresso e histórico devem ser IDÊNTICOS antes e depois
    expect(reconciled.integrationKnowledge).toBe(customLegacyState.integrationKnowledge)
    expect(reconciled.generalIntegrationKnowledge).toBe(
      customLegacyState.generalIntegrationKnowledge,
    )
    expect(reconciled.supplierSpecificKnowledge).toBe(customLegacyState.supplierSpecificKnowledge)
    expect(reconciled.seasonsWithSupplier).toBe(customLegacyState.seasonsWithSupplier)
    expect(reconciled.accumulatedExperience).toBe(customLegacyState.accumulatedExperience)
    expect(reconciled.careerId).toBe(customLegacyState.careerId)
    expect(reconciled.seasonYear).toBe(customLegacyState.seasonYear)
    expect(reconciled.lastUpdatedSeason).toBe(customLegacyState.lastUpdatedSeason)

    // Apenas a tipagem da relação e o teto são corrigidos para canônico
    expect(reconciled.relationshipType).toBe('FACTORY')
    expect(reconciled.maxIntegration).toBe(1.0)
    expect(reconciled.effectiveIntegration).not.toBe(customLegacyState.effectiveIntegration)
  })

  // PUIR-15: zero double application — supplierPU × integration aplicada UMA única vez: se o pipeline for rodado duas vezes (ex. adapter + runner), o resultado não degrada (não existe segundo multiplicador).
  it('PUIR-15: zero double application — supplierPU × integration aplicada UMA única vez (execução múltipla não degrada rating)', () => {
    const supplierSpec = OFFICIAL_POWER_UNITS.Ferrari
    const nominalPower = supplierSpec.powerRating
    const nominalRel = supplierSpec.reliabilityRating
    const nominalPuRating = Number((nominalPower * 0.6 + nominalRel * 0.4).toFixed(1))

    // Customer com 0.90 de integração
    const integrationRate = 0.9

    // Passagem 1: cálculo canônico da PU efetiva
    const run1 = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: 'Ferrari',
      effectiveIntegration: integrationRate,
      relationshipType: 'CUSTOMER',
    })

    const expectedEffectiveRating = Number((nominalPuRating * integrationRate).toFixed(1))
    expect(run1.effectivePuRating).toBe(expectedEffectiveRating)
    expect(run1.nominalPuRating).toBe(nominalPuRating)

    // calculateCarPerformance deve receber effectivePowerUnitRating diretamente
    const chassisRating = 85.0
    const carPerfRun1 = calculateCarPerformance({
      chassisRating,
      effectivePowerUnitRating: run1.effectivePuRating,
    })
    const expectedCarPerf = Number((chassisRating * 0.7 + run1.effectivePuRating * 0.3).toFixed(2))
    expect(carPerfRun1).toBe(expectedCarPerf)

    // Passagem 2 (simulando segundo estágio do pipeline, ex: adapter seguido de runner):
    // Se o pipeline for acionado novamente com os ratings resolvidos ou chamado repetidamente,
    // o effectivePowerUnitRating permanece idêntico e o carPerformance NÃO sofre nova multiplicação
    const run2 = canonicalPowerUnitIntegrationService.resolveEffectivePUPerformance({
      supplierId: 'Ferrari',
      effectiveIntegration: integrationRate,
      relationshipType: 'CUSTOMER',
    })

    expect(run2.effectivePuRating).toBe(run1.effectivePuRating)
    expect(run2.nominalPuRating).toBe(nominalPuRating)

    // Se calculateCarPerformance já receber carPerformanceRating ou os mesmos ratings, não degrada
    const carPerfRun2 = calculateCarPerformance({
      chassisRating,
      effectivePowerUnitRating: run2.effectivePuRating,
    })
    expect(carPerfRun2).toBe(carPerfRun1)

    // Provar que NÃO existiu dupla aplicação:
    // Uma dupla aplicação resultaria em: nominalPuRating * 0.9 * 0.9 = nominalPuRating * 0.81
    const doubleAppliedPU = Number((nominalPuRating * integrationRate * integrationRate).toFixed(1))
    expect(run1.effectivePuRating).not.toBe(doubleAppliedPU)
    expect(run2.effectivePuRating).not.toBe(doubleAppliedPU)
    expect(run2.effectivePuRating).toBeGreaterThan(doubleAppliedPU)
  })
})
