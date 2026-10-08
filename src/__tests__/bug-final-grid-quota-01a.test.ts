import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalQualifyingFinalGridBackendService } from '@/services/canonicalQualifyingFinalGridBackendService'
import type {
  CompleteQualifyingWeekendResult,
  QualifyingStageResult,
  FinalQualifyingGridEntry,
} from '@/types/canonical-qualifying-types'

describe('bug-final-grid-quota-01a — Resiliência a QuotaExceededError em saveCompleteQualifyingResult e Espelhamento PocketBase', () => {
  const TEST_CAREER_ID = 'uc5qbo5uosqcocs'
  const TEST_ROUND = 1

  const createMockStageResult = (stageId: 'q1' | 'q2' | 'q3'): QualifyingStageResult => {
    return {
      stageId,
      seasonId: TEST_CAREER_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: Array.from({ length: 24 }).map((_, i) => ({
        position: i + 1,
        driverId: `drv_${i + 1}`,
        driverName: `Driver ${i + 1}`,
        teamId: `team_${Math.floor(i / 2) + 1}`,
        teamName: `Team ${Math.floor(i / 2) + 1}`,
        teamColor: '#00ff00',
        bestLapSec: 75 + i * 0.1,
        bestLapTime: `1:15.${String(i * 100).padStart(3, '0')}`,
        bestLapRecordedAtSec: 600,
        compound: 'macio' as const,
        tyreSetId: `tyre_${i + 1}`,
        lapsCount: 8,
        isPlayer: i === 0,
        isEliminated: stageId === 'q1' ? i >= 18 : stageId === 'q2' ? i >= 10 : false,
        eliminatedInStage:
          stageId === 'q1' && i >= 18 ? 'q1' : stageId === 'q2' && i >= 10 ? 'q2' : undefined,
      })),
      advancingDriverIds:
        stageId === 'q1'
          ? Array.from({ length: 18 }).map((_, i) => `drv_${i + 1}`)
          : stageId === 'q2'
            ? Array.from({ length: 10 }).map((_, i) => `drv_${i + 1}`)
            : [],
      eliminatedDriverIds:
        stageId === 'q1'
          ? Array.from({ length: 6 }).map((_, i) => `drv_${i + 19}`)
          : stageId === 'q2'
            ? Array.from({ length: 8 }).map((_, i) => `drv_${i + 11}`)
            : [],
    }
  }

  const createMockCompleteResult = (
    careerId: string,
    round: number,
  ): CompleteQualifyingWeekendResult => {
    const q1Result = createMockStageResult('q1')
    const q2Result = createMockStageResult('q2')
    const q3Result = createMockStageResult('q3')

    const finalGrid: FinalQualifyingGridEntry[] = Array.from({ length: 24 }).map((_, i) => ({
      gridPosition: i + 1,
      driverId: `drv_${i + 1}`,
      driverName: `Driver ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Team ${Math.floor(i / 2) + 1}`,
      teamColor: '#00ff00',
      isPlayer: i === 0,
      carId: i % 2 === 0 ? 'car1' : 'car2',
      eliminationStage: i < 10 ? 'Q3' : i < 18 ? 'Q2' : 'Q1',
      bestLapSec: 75 + i * 0.1,
      bestLapTime: `1:15.${String(i * 100).padStart(3, '0')}`,
      bestLapCompound: 'macio',
      tyreSetId: `tyre_${i + 1}`,
      q1LapTime: `1:15.${String(i * 100).padStart(3, '0')}`,
      q2LapTime: i < 18 ? `1:15.${String(i * 100).padStart(3, '0')}` : undefined,
      q3LapTime: i < 10 ? `1:15.${String(i * 100).padStart(3, '0')}` : undefined,
    }))

    return {
      seasonId: careerId,
      round,
      completedAt: new Date().toISOString(),
      poleDriverId: 'drv_1',
      poleDriverName: 'Driver 1',
      poleLapTime: '1:15.000',
      q1Result,
      q2Result,
      q3Result,
      finalGrid,
    }
  }

  beforeEach(() => {
    localStorage.clear()
    canonicalQualifyingPersistenceService.clearMemoryForTesting()
    canonicalQualifyingFinalGridBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    canonicalQualifyingPersistenceService.clearMemoryForTesting()
    canonicalQualifyingFinalGridBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // T1 — saveCompleteQualifyingResult persists and returns success normally
  // =========================================================================
  it('T1: saveCompleteQualifyingResult persiste e retorna sucesso normalmente quando cota OK', async () => {
    const validResult = createMockCompleteResult(TEST_CAREER_ID, TEST_ROUND)

    const saveBackendSpy = vi
      .spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid')
      .mockResolvedValueOnce({ success: true, id: 'pb_rec_grid_01' })

    const outcome = canonicalQualifyingPersistenceService.saveCompleteQualifyingResult(validResult)

    expect(outcome.success).toBe(true)
    expect(outcome.persistedLocal).toBe(true)
    expect(outcome.error).toBeUndefined()

    // Confirma que a tentativa de espelhamento ao PocketBase foi disparada
    expect(saveBackendSpy).toHaveBeenCalledTimes(1)
    const [calledCtx, calledResult] = saveBackendSpy.mock.calls[0]
    expect(calledCtx.careerId).toBe(TEST_CAREER_ID)
    expect(calledCtx.round).toBe(TEST_ROUND)
    expect(calledResult.finalGrid).toHaveLength(24)
    expect(calledResult.poleDriverId).toBe('drv_1')

    // Confirma que a versão assíncrona também funciona com sucesso
    const asyncOutcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(validResult)
    expect(asyncOutcome.success).toBe(true)
    expect(asyncOutcome.persistedBackend).toBe(true)
  })

  // =========================================================================
  // T2 — Quota error thrown by storage → no exception escapes, explicit failure, mirroring attempted
  // =========================================================================
  it('T2: QuotaExceededError lançado pelo storage → nenhuma exceção escapa, outcome é falha observável e espelhamento PocketBase é disparado', () => {
    const validResult = createMockCompleteResult(TEST_CAREER_ID, TEST_ROUND)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error(
        `Failed to execute 'setItem' on 'Storage': Setting the value of 'apex_qualifying_final_grid_v2_${TEST_CAREER_ID}_r1' exceeded the quota.`,
      )
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    const saveBackendSpy = vi
      .spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid')
      .mockResolvedValueOnce({ success: true, id: 'pb_rec_grid_saved' })

    let outcome: any
    expect(() => {
      outcome = canonicalQualifyingPersistenceService.saveCompleteQualifyingResult(validResult)
    }).not.toThrow()

    expect(outcome).toBeDefined()
    expect(outcome.success).toBe(false)
    expect(outcome.reason).toBe('QUOTA_EXCEEDED')
    expect(outcome.persistedLocal).toBe(false)
    expect(outcome.error).toContain('exceeded the quota')

    // Espelho no PocketBase DEVE ter sido disparado
    expect(saveBackendSpy).toHaveBeenCalledTimes(1)
  })

  // =========================================================================
  // T3 — Local fail + backend confirm → success, local heavy key purged for that identity only
  // =========================================================================
  it('T3: local fail (cota) + backend confirm → sucesso, e cópia pesada local é expurgada para a identidade lógica', async () => {
    const validResult = createMockCompleteResult(TEST_CAREER_ID, TEST_ROUND)
    const key = canonicalQualifyingPersistenceService.getFinalGridKey(TEST_CAREER_ID, TEST_ROUND)

    // Simula erro de cota no localStorage
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error('QuotaExceededError')
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    // Backend confirma gravação com sucesso
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValueOnce({
      success: true,
      id: 'pb_rec_grid_confirmed',
    })

    const purgeSpy = vi.spyOn(canonicalQualifyingPersistenceService, 'purgeLocalFinalGrid')

    const outcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(validResult)

    expect(outcome.success).toBe(true)
    expect(outcome.persistedBackend).toBe(true)
    expect(outcome.persistedLocal).toBe(false)

    // Purge chamado para esta identidade (careerId + round)
    expect(purgeSpy).toHaveBeenCalledWith(TEST_CAREER_ID, TEST_ROUND)

    // Resultado permanece legível de forma síncrona via readCompleteQualifyingResult (pelo cache em memória)
    const readImmediate = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      TEST_CAREER_ID,
      TEST_ROUND,
    )
    expect(readImmediate).not.toBeNull()
    expect(readImmediate?.finalGrid).toHaveLength(24)
    expect(readImmediate?.poleDriverId).toBe('drv_1')
  })

  // =========================================================================
  // T4 — Local fail + backend fail → explicit failure, no false success, no crash
  // =========================================================================
  it('T4: local fail + backend fail → falha discriminada explícita, sem falso sucesso e sem crash', async () => {
    const validResult = createMockCompleteResult(TEST_CAREER_ID, TEST_ROUND)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error('QuotaExceededError')
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValueOnce({
      success: false,
      error: 'PocketBase offline (503)',
    })

    let outcome: any
    expect(async () => {
      outcome =
        await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(validResult)
    }).not.toThrow()

    outcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(validResult)

    expect(outcome.success).toBe(false)
    expect(outcome.reason).toBe('QUOTA_EXCEEDED')
    expect(outcome.persistedBackend).toBe(false)
    expect(outcome.persistedLocal).toBe(false)
    expect(outcome.error).toContain('PocketBase offline (503)')

    // Como ambos falharam, a memória não deve manter um estado falso
    const readBack = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      TEST_CAREER_ID,
      TEST_ROUND,
    )
    expect(readBack).toBeNull()
  })

  // =========================================================================
  // T5 — Reload prefers backend when local missing or purged
  // =========================================================================
  it('T5: readCompleteQualifyingResultPreferred prefere backend e reidrata memória quando local está ausente', async () => {
    const backendResult = createMockCompleteResult(TEST_CAREER_ID, TEST_ROUND)
    backendResult.poleLapTime = '1:14.888'

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockResolvedValueOnce(
      backendResult,
    )

    // Local ausente (limpo)
    const outcome =
      await canonicalQualifyingPersistenceService.readCompleteQualifyingResultPreferred(
        TEST_CAREER_ID,
        TEST_ROUND,
      )

    expect(outcome.source).toBe('backend')
    expect(outcome.data).not.toBeNull()
    expect(outcome.data?.poleLapTime).toBe('1:14.888')
    expect(outcome.backendError).toBeUndefined()

    // O grid recuperado fica disponível para leituras síncronas subsequentes
    const syncRead = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      TEST_CAREER_ID,
      TEST_ROUND,
    )
    expect(syncRead).toEqual(backendResult)
  })

  // =========================================================================
  // T6 — Isolation: other career/season/round keys untouched
  // =========================================================================
  it('T6: isolamento estrito — chaves de outras carreiras e rodadas permanecem intactas ao expurgar', () => {
    const resultCareerA = createMockCompleteResult('career_a', 1)
    const resultCareerB = createMockCompleteResult('career_b', 1)
    const resultRound2 = createMockCompleteResult('career_a', 2)

    const keyA = canonicalQualifyingPersistenceService.getFinalGridKey('career_a', 1)
    const keyB = canonicalQualifyingPersistenceService.getFinalGridKey('career_b', 1)
    const keyR2 = canonicalQualifyingPersistenceService.getFinalGridKey('career_a', 2)

    localStorage.setItem(keyA, JSON.stringify(resultCareerA))
    localStorage.setItem(keyB, JSON.stringify(resultCareerB))
    localStorage.setItem(keyR2, JSON.stringify(resultRound2))

    // Expurga apenas career_a r1
    canonicalQualifyingPersistenceService.purgeLocalFinalGrid('career_a', 1)

    expect(localStorage.getItem(keyA)).toBeNull()
    expect(localStorage.getItem(keyB)).not.toBeNull()
    expect(localStorage.getItem(keyR2)).not.toBeNull()

    const parsedB = JSON.parse(localStorage.getItem(keyB)!)
    expect(parsedB.poleDriverId).toBe('drv_1')

    // Chaves determinísticas no backend service também são isoladas
    const pbKeyA = canonicalQualifyingFinalGridBackendService.buildGridKey({
      careerId: 'career_a',
      season: 2026,
      round: 1,
    })
    const pbKeyB = canonicalQualifyingFinalGridBackendService.buildGridKey({
      careerId: 'career_b',
      season: 2026,
      round: 1,
    })
    expect(pbKeyA).not.toBe(pbKeyB)
    expect(pbKeyA).toContain('career_a_r1')
    expect(pbKeyB).toContain('career_b_r1')
  })

  // =========================================================================
  // T7 — buildCombinedFinalGrid does not throw even if localStorage quota fails
  // =========================================================================
  it('T7: buildCombinedFinalGrid não explode quando localStorage lança QuotaExceededError', () => {
    const q1Res = createMockStageResult('q1')
    const q2Res = createMockStageResult('q2')
    const q3Res = createMockStageResult('q3')

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error('QuotaExceededError: Setting final grid exceeded quota.')
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    const saveBackendSpy = vi
      .spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid')
      .mockResolvedValueOnce({ success: true, id: 'pb_rec_saved' })

    let combined: CompleteQualifyingWeekendResult | null = null
    expect(() => {
      combined = canonicalQualifyingPersistenceService.buildCombinedFinalGrid({
        seasonId: TEST_CAREER_ID,
        round: TEST_ROUND,
        q1Result: q1Res,
        q2Result: q2Res,
        q3Result: q3Res,
      })
    }).not.toThrow()

    expect(combined).not.toBeNull()
    expect(combined!.finalGrid).toHaveLength(24)
    expect(saveBackendSpy).toHaveBeenCalledTimes(1)
  })
})
