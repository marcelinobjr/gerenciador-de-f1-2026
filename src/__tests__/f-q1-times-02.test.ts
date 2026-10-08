/**
 * f-q1-times-02.test.ts
 *
 * Suíte F-Q1-TIMES-02 / STORAGE-QUOTA-STAGERESULT-01A:
 * Espelhamento e resiliência de Qualifying StageResult no PocketBase Skip Cloud.
 *
 * S1 — SAVE MIRRORS: saveStageResult / saveStageResultAsync espelha para o backend com payload equivalente.
 * S2 — LOCAL QUOTA FAILURE + BACKEND SUCCESS: local quota failure (QuotaExceededError) + backend success →
 *      outcome success (canonical result is persisted; local is just a cache), gate Q1→Q2 proceeds.
 * S3 — BACKEND + LOCAL BOTH FAIL: explicit failure (current F-Q1-TIMES-01A behavior preserved).
 * S4 — READ PREFERS BACKEND: readStageResultPreferred lê do backend quando local ausente ou divergente.
 * S5 — NOT_FOUND FALLBACK: backend NOT_FOUND → fallback para local limpo.
 * S6 — BACKEND ERROR: backend error → fallback local observável (com backendError reportado).
 * S7 — IDENTITY ISOLATION: outras carreiras, rodadas ou fases não são afetadas ou sobrescritas.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import {
  canonicalQualifyingStageResultBackendService,
  CanonicalQualifyingStageResultBackendContext,
} from '@/services/canonicalQualifyingStageResultBackendService'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import type { QualifyingStageResult } from '@/types/canonical-qualifying-types'

describe('F-Q1-TIMES-02: Espelhamento de StageResult no PocketBase e Resiliência à Cota', () => {
  const TEST_CAREER_ID = 'career_fq1_times_02'
  const TEST_ROUND = 1

  function createMockStageResult(
    careerId: string,
    round: number,
    stageId: 'q1' | 'q2' | 'q3' = 'q1',
  ): QualifyingStageResult {
    const entries = Array.from({ length: 24 }).map((_, i) => ({
      position: i + 1,
      driverId: `driver_${String(i + 1).padStart(2, '0')}`,
      driverName: `Piloto ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Equipe ${Math.floor(i / 2) + 1}`,
      teamColor: '#334155',
      bestLapSec: 78.5 + i * 0.1,
      bestLapTime: `1:18.${String(i * 100).padStart(3, '0')}`,
      bestLapRecordedAtSec: 120 + i,
      compound: 'macio' as const,
      lapsCount: 2,
      isPlayer: i < 2,
      carId: i === 0 ? ('car1' as const) : i === 1 ? ('car2' as const) : undefined,
      isEliminated: i >= 18,
      eliminatedInStage: i >= 18 ? stageId : undefined,
    }))

    return {
      stageId,
      seasonId: careerId,
      round,
      completedAt: '2026-03-29T14:30:00.000Z',
      entries,
      advancingDriverIds: entries.slice(0, 18).map((e) => e.driverId),
      eliminatedDriverIds: entries.slice(18).map((e) => e.driverId),
    }
  }

  beforeEach(() => {
    localStorage.clear()
    canonicalQualifyingPersistenceService.clearMemoryForTesting()
    canonicalQualifyingStageResultBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    canonicalQualifyingPersistenceService.clearMemoryForTesting()
    canonicalQualifyingStageResultBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // S1 — SAVE MIRRORS TO BACKEND WITH EQUIVALENT PAYLOAD
  // =========================================================================
  it('S1 — SAVE MIRRORS: saveStageResultAsync grava no localStorage e espelha no PocketBase com payload e chave equivalentes', async () => {
    const validResult = createMockStageResult(TEST_CAREER_ID, TEST_ROUND, 'q1')

    const saveBackendSpy = vi
      .spyOn(canonicalQualifyingStageResultBackendService, 'saveStageResult')
      .mockResolvedValueOnce({ success: true, id: 'rec_stage_q1_01' })

    const outcome = await canonicalQualifyingPersistenceService.saveStageResultAsync(validResult)

    expect(outcome.success).toBe(true)
    expect(outcome.persistedBackend).toBe(true)
    expect(outcome.persistedLocal).toBe(true)

    // Confirma chamada do backend com contexto e payload equivalente
    expect(saveBackendSpy).toHaveBeenCalledTimes(1)
    const [calledCtx, calledResult] = saveBackendSpy.mock.calls[0]

    expect(calledCtx.careerId).toBe(TEST_CAREER_ID)
    expect(calledCtx.round).toBe(TEST_ROUND)
    expect(calledCtx.stage).toBe('q1')

    expect(calledResult.stageId).toBe('q1')
    expect(calledResult.entries).toHaveLength(24)
    expect(calledResult.advancingDriverIds).toEqual(validResult.advancingDriverIds)

    // LocalStorage gravado com a chave canônica
    const key = canonicalQualifyingPersistenceService.getStageResultKey(
      TEST_CAREER_ID,
      TEST_ROUND,
      'q1',
    )
    expect(localStorage.getItem(key)).not.toBeNull()
  })

  // =========================================================================
  // S2 — LOCAL QUOTA FAILURE + BACKEND SUCCESS → OUTCOME SUCCESS, GATE PROCEEDS
  // =========================================================================
  it('S2 — LOCAL QUOTA FAILURE + BACKEND SUCCESS: falha de cota local com sucesso no PocketBase resulta em sucesso e permite avanço da barreira Q1→Q2', async () => {
    const validResult = createMockStageResult(TEST_CAREER_ID, TEST_ROUND, 'q1')

    // 1. Simular falha persistente de cota no localStorage
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error(
        "Failed to execute 'setItem' on 'Storage': Setting the value of 'apex_qualifying_stage_result_v2_uc5qbo5uosqcocs_r1_q1' exceeded the quota.",
      )
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    // 2. Simular sucesso no PocketBase
    vi.spyOn(canonicalQualifyingStageResultBackendService, 'saveStageResult').mockResolvedValueOnce(
      {
        success: true,
        id: 'pb_rec_quota_saved',
      },
    )

    const outcome = await canonicalQualifyingPersistenceService.saveStageResultAsync(validResult)

    // O retorno DEVE ser sucesso: a autoridade canônica está persistida no PocketBase!
    expect(outcome.success).toBe(true)
    expect(outcome.persistedBackend).toBe(true)
    expect(outcome.persistedLocal).toBe(false)

    // 3. O resultado pode ser lido imediatamente
    const readBack = canonicalQualifyingPersistenceService.readStageResult(
      TEST_CAREER_ID,
      TEST_ROUND,
      'q1',
    )
    expect(readBack).not.toBeNull()
    expect(readBack!.advancingDriverIds).toHaveLength(18)

    // 4. Barreira Q2FIX-01: Prova que a barreira Q1→Q2 é liberada com o resultado persistido
    const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES['q1'].advancingCount
    const advancingIds = readBack?.advancingDriverIds
    const isValidAdvancing =
      !!readBack &&
      Array.isArray(advancingIds) &&
      advancingIds.length === expectedAdvancingCount &&
      advancingIds.every((id) => typeof id === 'string' && id.trim().length > 0) &&
      new Set(advancingIds).size === expectedAdvancingCount

    expect(isValidAdvancing).toBe(true)
  })

  // =========================================================================
  // S3 — BACKEND + LOCAL BOTH FAIL → EXPLICIT FAILURE
  // =========================================================================
  it('S3 — BACKEND + LOCAL BOTH FAIL: quando ambos falham, retorna { success: false, reason: "QUOTA_EXCEEDED" } preservando comportamento observável', async () => {
    const validResult = createMockStageResult(TEST_CAREER_ID, TEST_ROUND, 'q1')

    // Local falha com cota
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error('Persistent QuotaExceededError')
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    // Backend falha com indisponibilidade de rede
    vi.spyOn(canonicalQualifyingStageResultBackendService, 'saveStageResult').mockResolvedValueOnce(
      {
        success: false,
        error: 'Network connection failed',
      },
    )

    const outcome = await canonicalQualifyingPersistenceService.saveStageResultAsync(validResult)

    expect(outcome.success).toBe(false)
    expect(outcome.reason).toBe('QUOTA_EXCEEDED')
    expect(outcome.persistedBackend).toBe(false)
    expect(outcome.persistedLocal).toBe(false)
    expect(outcome.error).toContain('Persistent QuotaExceededError')

    const readBack = canonicalQualifyingPersistenceService.readStageResult(
      TEST_CAREER_ID,
      TEST_ROUND,
      'q1',
    )
    expect(readBack).toBeNull()
  })

  // =========================================================================
  // S4 — READ PREFERS BACKEND WHEN LOCAL IS MISSING OR DIVERGENT
  // =========================================================================
  it('S4 — READ PREFERS BACKEND: readStageResultPreferred lê do PocketBase quando local ausente e vence divergência sem alterar dados', async () => {
    const backendResult = createMockStageResult(TEST_CAREER_ID, TEST_ROUND, 'q1')
    backendResult.entries[0].bestLapTime = '1:17.123'
    backendResult.entries[0].bestLapSec = 77.123

    vi.spyOn(canonicalQualifyingStageResultBackendService, 'readStageResult').mockResolvedValueOnce(
      backendResult,
    )

    // Local ausente
    const outcome = await canonicalQualifyingPersistenceService.readStageResultPreferred(
      TEST_CAREER_ID,
      TEST_ROUND,
      'q1',
    )

    expect(outcome.source).toBe('backend')
    expect(outcome.data).not.toBeNull()
    expect(outcome.data!.entries[0].bestLapTime).toBe('1:17.123')
    expect(outcome.backendError).toBeUndefined()

    // O resultado recuperado do backend agora fica disponível para readStageResult síncrono
    const syncRead = canonicalQualifyingPersistenceService.readStageResult(
      TEST_CAREER_ID,
      TEST_ROUND,
      'q1',
    )
    expect(syncRead).toEqual(backendResult)
  })

  // =========================================================================
  // S5 — NOT_FOUND → LOCAL FALLBACK
  // =========================================================================
  it('S5 — NOT_FOUND: backend retorna null (NOT_FOUND) → fallback limpo para local com source = "local"', async () => {
    const localResult = createMockStageResult(TEST_CAREER_ID, TEST_ROUND, 'q1')

    // Salvar no local
    const key = canonicalQualifyingPersistenceService.getStageResultKey(
      TEST_CAREER_ID,
      TEST_ROUND,
      'q1',
    )
    localStorage.setItem(key, JSON.stringify(localResult))

    // Backend retorna NOT_FOUND (null)
    vi.spyOn(canonicalQualifyingStageResultBackendService, 'readStageResult').mockResolvedValueOnce(
      null,
    )

    const outcome = await canonicalQualifyingPersistenceService.readStageResultPreferred(
      TEST_CAREER_ID,
      TEST_ROUND,
      'q1',
    )

    expect(outcome.source).toBe('local')
    expect(outcome.data).not.toBeNull()
    expect(outcome.data!.advancingDriverIds).toEqual(localResult.advancingDriverIds)
    expect(outcome.backendError).toBeUndefined()
  })

  // =========================================================================
  // S6 — BACKEND ERROR → LOCAL FALLBACK OBSERVABLE
  // =========================================================================
  it('S6 — BACKEND ERROR: backend lança erro de rede → fallback local com backendError observável', async () => {
    const localResult = createMockStageResult(TEST_CAREER_ID, TEST_ROUND, 'q1')
    const key = canonicalQualifyingPersistenceService.getStageResultKey(
      TEST_CAREER_ID,
      TEST_ROUND,
      'q1',
    )
    localStorage.setItem(key, JSON.stringify(localResult))

    vi.spyOn(canonicalQualifyingStageResultBackendService, 'readStageResult').mockRejectedValueOnce(
      new Error('Failed to fetch (PocketBase 503)'),
    )

    const outcome = await canonicalQualifyingPersistenceService.readStageResultPreferred(
      TEST_CAREER_ID,
      TEST_ROUND,
      'q1',
    )

    expect(outcome.source).toBe('local')
    expect(outcome.data).not.toBeNull()
    expect(outcome.backendError).toContain('PocketBase 503')
  })

  // =========================================================================
  // S7 — IDENTITY ISOLATION
  // =========================================================================
  it('S7 — IDENTITY ISOLATION: chaves e chamadas são estritamente isoladas por careerId, round e stage', async () => {
    const keyQ1 = canonicalQualifyingStageResultBackendService.buildResultKey({
      careerId: 'career_alpha',
      season: 2026,
      round: 1,
      stage: 'q1',
    })

    const keyQ2 = canonicalQualifyingStageResultBackendService.buildResultKey({
      careerId: 'career_alpha',
      season: 2026,
      round: 1,
      stage: 'q2',
    })

    const keyRound2 = canonicalQualifyingStageResultBackendService.buildResultKey({
      careerId: 'career_alpha',
      season: 2026,
      round: 2,
      stage: 'q1',
    })

    const keyCareerBeta = canonicalQualifyingStageResultBackendService.buildResultKey({
      careerId: 'career_beta',
      season: 2026,
      round: 1,
      stage: 'q1',
    })

    expect(keyQ1).not.toBe(keyQ2)
    expect(keyQ1).not.toBe(keyRound2)
    expect(keyQ1).not.toBe(keyCareerBeta)
    expect(keyQ1).toContain('career_alpha_r1_q1')
    expect(keyQ2).toContain('career_alpha_r1_q2')
    expect(keyRound2).toContain('career_alpha_r2_q1')
    expect(keyCareerBeta).toContain('career_beta_r1_q1')
  })
})
