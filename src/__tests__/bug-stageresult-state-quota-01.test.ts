import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalQualifyingStageStateBackendService } from '@/services/canonicalQualifyingStageStateBackendService'
import type { QualifyingStageState } from '@/types/canonical-qualifying-types'

describe('bug-stageresult-state-quota-01 — Resiliência a QuotaExceededError em saveStageState e Espelhamento PocketBase', () => {
  const TEST_CAREER_ID = 'uc5qbo5uosqcocs'
  const TEST_ROUND = 1
  const TEST_STAGE = 'q1'

  const createMockStageState = (
    careerId: string,
    round: number,
    stageId: 'q1' | 'q2' | 'q3' = 'q1',
  ): QualifyingStageState => {
    return {
      stageId,
      sessionDurationSec: 1080,
      timeRemainingSec: 0,
      status: 'completed',
      cars: {
        car1: {
          carId: 'car1',
          driverId: 'd1',
          driverName: 'Driver 1',
          status: 'garage',
          pitRequested: false,
          currentTyreSetId: 't1',
          currentCompound: 'macio',
          tyreWear: 15,
          fuelKg: 10,
          outLapsDone: 1,
          flyingLapsDone: 3,
          inLapsDone: 1,
          totalLaps: 5,
          currentLapProgressPct: 0,
          isEliminated: false,
          setup: {
            frontWing: 5,
            rearWing: 5,
            suspension: 5,
            differential: 50,
          },
        },
        car2: {
          carId: 'car2',
          driverId: 'd2',
          driverName: 'Driver 2',
          status: 'garage',
          pitRequested: false,
          currentTyreSetId: 't2',
          currentCompound: 'macio',
          tyreWear: 18,
          fuelKg: 10,
          outLapsDone: 1,
          flyingLapsDone: 4,
          inLapsDone: 1,
          totalLaps: 6,
          currentLapProgressPct: 0,
          isEliminated: false,
          setup: {
            frontWing: 5,
            rearWing: 5,
            suspension: 5,
            differential: 50,
          },
        },
      },
      leaderboard: [
        {
          position: 1,
          driverId: 'd1',
          driverName: 'Driver 1',
          teamId: 't1',
          teamName: 'Team 1',
          teamColor: '#ff0000',
          bestLapSec: 76.5,
          bestLapTime: '1:16.500',
          gap: '+0.000',
          compound: 'macio',
          tyreSetId: 't1',
          laps: 5,
          status: 'garage',
          carId: 'car1',
          isPlayer: true,
        },
        {
          position: 2,
          driverId: 'd2',
          driverName: 'Driver 2',
          teamId: 't1',
          teamName: 'Team 1',
          teamColor: '#ff0000',
          bestLapSec: 76.8,
          bestLapTime: '1:16.800',
          gap: '+0.300',
          compound: 'macio',
          tyreSetId: 't2',
          laps: 6,
          status: 'garage',
          carId: 'car2',
          isPlayer: true,
        },
      ],
      elapsedTimeSec: 1080,
      simSpeed: 1,
      lapHistory: {},
      radioFeed: [],
      parcFermeActive: true,
      createdAt: new Date().toISOString(),
      weekendGeneration: 1,
      generation: 1,
      revision: 1,
      updatedAt: new Date().toISOString(),
    }
  }

  beforeEach(() => {
    localStorage.clear()
    canonicalQualifyingPersistenceService.clearMemoryForTesting()
    canonicalQualifyingStageStateBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    canonicalQualifyingPersistenceService.clearMemoryForTesting()
    canonicalQualifyingStageStateBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // S1 — saveStageState persists and returns success normally
  // =========================================================================
  it('S1: saveStageState persiste e retorna sucesso normalmente', async () => {
    const validState = createMockStageState(TEST_CAREER_ID, TEST_ROUND, TEST_STAGE)

    const saveBackendSpy = vi
      .spyOn(canonicalQualifyingStageStateBackendService, 'saveStageState')
      .mockResolvedValueOnce({ success: true, id: 'pb_rec_state_01' })

    const outcome = canonicalQualifyingPersistenceService.saveStageState(
      TEST_CAREER_ID,
      TEST_ROUND,
      validState,
    )

    expect(outcome.success).toBe(true)
    expect(outcome.persistedLocal).toBe(true)
    expect(outcome.error).toBeUndefined()

    // Confirma que a tentativa de espelhamento ao PocketBase foi disparada
    expect(saveBackendSpy).toHaveBeenCalledTimes(1)
    const [calledCtx, calledState] = saveBackendSpy.mock.calls[0]
    expect(calledCtx.careerId).toBe(TEST_CAREER_ID)
    expect(calledCtx.round).toBe(TEST_ROUND)
    expect(calledCtx.stage).toBe(TEST_STAGE)
    expect(calledState.stageId).toBe(TEST_STAGE)
    expect(calledState.leaderboard).toHaveLength(2)

    // Confirma que a versão assíncrona também funciona
    const asyncOutcome = await canonicalQualifyingPersistenceService.saveStageStateAsync(
      TEST_CAREER_ID,
      TEST_ROUND,
      validState,
    )
    expect(asyncOutcome.success).toBe(true)
    expect(asyncOutcome.persistedBackend).toBe(true)
  })

  // =========================================================================
  // S2 — Quota error thrown by storage → no exception escapes, explicit failure, mirroring attempted
  // =========================================================================
  it('S2: quota error lançado pelo storage → nenhuma exceção escapa, outcome é falha observável e espelhamento é disparado', () => {
    const validState = createMockStageState(TEST_CAREER_ID, TEST_ROUND, TEST_STAGE)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error(
        `Failed to execute 'setItem' on 'Storage': Setting the value of 'apex_qualifying_stage_state_v2_${TEST_CAREER_ID}_r1_q1' exceeded the quota.`,
      )
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    const saveBackendSpy = vi
      .spyOn(canonicalQualifyingStageStateBackendService, 'saveStageState')
      .mockResolvedValueOnce({ success: true, id: 'pb_rec_saved' })

    let outcome: any
    expect(() => {
      outcome = canonicalQualifyingPersistenceService.saveStageState(
        TEST_CAREER_ID,
        TEST_ROUND,
        validState,
      )
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
  // S3 — Local fail + backend confirm → success, local heavy key purged for that identity only
  // =========================================================================
  it('S3: local fail + backend confirm → sucesso, e cópia pesada local é expurgada para a identidade lógica', async () => {
    const validState = createMockStageState(TEST_CAREER_ID, TEST_ROUND, TEST_STAGE)
    const key = canonicalQualifyingPersistenceService.getStageStateKey(
      TEST_CAREER_ID,
      TEST_ROUND,
      TEST_STAGE,
    )

    // Local falha com cota
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error('QuotaExceededError')
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    // Backend confirma com sucesso
    vi.spyOn(canonicalQualifyingStageStateBackendService, 'saveStageState').mockResolvedValueOnce({
      success: true,
      id: 'pb_rec_confirmed',
    })

    const purgeSpy = vi.spyOn(canonicalQualifyingPersistenceService, 'purgeLocalStageState')

    const outcome = await canonicalQualifyingPersistenceService.saveStageStateAsync(
      TEST_CAREER_ID,
      TEST_ROUND,
      validState,
    )

    expect(outcome.success).toBe(true)
    expect(outcome.persistedBackend).toBe(true)
    expect(outcome.persistedLocal).toBe(false)

    // Purge chamado para esta identidade
    expect(purgeSpy).toHaveBeenCalledWith(TEST_CAREER_ID, TEST_ROUND, TEST_STAGE)

    // Estado permanece legível via readStageState através do cache em memória
    const readImmediate = canonicalQualifyingPersistenceService.readStageState(
      TEST_CAREER_ID,
      TEST_ROUND,
      TEST_STAGE,
    )
    expect(readImmediate).not.toBeNull()
    expect(readImmediate?.leaderboard).toHaveLength(2)
  })

  // =========================================================================
  // S4 — Local fail + backend fail → explicit failure, no false success, no crash
  // =========================================================================
  it('S4: local fail + backend fail → falha explícita, sem falso sucesso e sem crash', async () => {
    const validState = createMockStageState(TEST_CAREER_ID, TEST_ROUND, TEST_STAGE)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error('QuotaExceededError')
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    vi.spyOn(canonicalQualifyingStageStateBackendService, 'saveStageState').mockResolvedValueOnce({
      success: false,
      error: 'PocketBase offline (503)',
    })

    let outcome: any
    expect(async () => {
      outcome = await canonicalQualifyingPersistenceService.saveStageStateAsync(
        TEST_CAREER_ID,
        TEST_ROUND,
        validState,
      )
    }).not.toThrow()

    outcome = await canonicalQualifyingPersistenceService.saveStageStateAsync(
      TEST_CAREER_ID,
      TEST_ROUND,
      validState,
    )

    expect(outcome.success).toBe(false)
    expect(outcome.reason).toBe('QUOTA_EXCEEDED')
    expect(outcome.persistedBackend).toBe(false)
    expect(outcome.persistedLocal).toBe(false)
    expect(outcome.error).toContain('PocketBase offline (503)')

    // Como ambos falharam, a memória é limpa para não deixar estado fantasma
    const readBack = canonicalQualifyingPersistenceService.readStageState(
      TEST_CAREER_ID,
      TEST_ROUND,
      TEST_STAGE,
    )
    expect(readBack).toBeNull()
  })

  // =========================================================================
  // S5 — Reload prefers backend when local missing
  // =========================================================================
  it('S5: reload prefere backend quando local está ausente', async () => {
    const backendState = createMockStageState(TEST_CAREER_ID, TEST_ROUND, TEST_STAGE)
    backendState.leaderboard[0].bestLapTime = '1:15.999'

    vi.spyOn(canonicalQualifyingStageStateBackendService, 'readStageState').mockResolvedValueOnce(
      backendState,
    )

    // Local ausente (limpo)
    const outcome = await canonicalQualifyingPersistenceService.readStageStatePreferred(
      TEST_CAREER_ID,
      TEST_ROUND,
      TEST_STAGE,
    )

    expect(outcome.source).toBe('backend')
    expect(outcome.data).not.toBeNull()
    expect(outcome.data?.leaderboard[0].bestLapTime).toBe('1:15.999')
    expect(outcome.backendError).toBeUndefined()

    // O estado recuperado fica disponível para leituras síncronas subsequentes
    const syncRead = canonicalQualifyingPersistenceService.readStageState(
      TEST_CAREER_ID,
      TEST_ROUND,
      TEST_STAGE,
    )
    expect(syncRead).toEqual(backendState)
  })

  // =========================================================================
  // S6 — Isolation: other career/season/round keys untouched
  // =========================================================================
  it('S6: isolamento estrito — chaves de outras carreiras/temporadas/rodadas permanecem intactas', () => {
    const stateCareerA = createMockStageState('career_a', 1, 'q1')
    const stateCareerB = createMockStageState('career_b', 1, 'q1')
    const stateRound2 = createMockStageState('career_a', 2, 'q1')

    const keyA = canonicalQualifyingPersistenceService.getStageStateKey('career_a', 1, 'q1')
    const keyB = canonicalQualifyingPersistenceService.getStageStateKey('career_b', 1, 'q1')
    const keyR2 = canonicalQualifyingPersistenceService.getStageStateKey('career_a', 2, 'q1')

    localStorage.setItem(keyA, JSON.stringify(stateCareerA))
    localStorage.setItem(keyB, JSON.stringify(stateCareerB))
    localStorage.setItem(keyR2, JSON.stringify(stateRound2))

    // Expurga apenas career_a r1 q1
    canonicalQualifyingPersistenceService.purgeLocalStageState('career_a', 1, 'q1')

    expect(localStorage.getItem(keyA)).toBeNull()
    expect(localStorage.getItem(keyB)).not.toBeNull()
    expect(localStorage.getItem(keyR2)).not.toBeNull()

    const parsedB = JSON.parse(localStorage.getItem(keyB)!)
    expect(parsedB.cars.car1.driverId).toBe('d1')

    // Chaves geradas pelo backend service também são isoladas
    const pbKeyA = canonicalQualifyingStageStateBackendService.buildStateKey({
      careerId: 'career_a',
      season: 2026,
      round: 1,
      stage: 'q1',
    })
    const pbKeyB = canonicalQualifyingStageStateBackendService.buildStateKey({
      careerId: 'career_b',
      season: 2026,
      round: 1,
      stage: 'q1',
    })
    expect(pbKeyA).not.toBe(pbKeyB)
    expect(pbKeyA).toContain('career_a_r1_q1')
    expect(pbKeyB).toContain('career_b_r1_q1')
  })
})
