import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalQualifyingStageResultBackendService } from '@/services/canonicalQualifyingStageResultBackendService'
import { canonicalQualifyingStageStateBackendService } from '@/services/canonicalQualifyingStageStateBackendService'
import {
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '@/services/weekendProgressionService'
import { isSessionUnlocked } from '@/services/weekendScheduleConfig'

describe('SQ3-GUARD-PB-01A — Guards de fase de quali e reconciliação PocketBase', () => {
  const seasonId = '31b0p9k5ygw2sc8'
  const round = 2

  beforeEach(() => {
    localStorage.clear()
    canonicalQualifyingPersistenceService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  it('SQ2 concluída no backend com cache local purgado é recuperada via readStageResultPreferred e readStageStatePreferred', async () => {
    const mockSq2Result = {
      seasonId,
      round,
      stageId: 'sq2' as const,
      entries: [
        {
          position: 1,
          driverId: 'd1',
          bestLapMs: 80000,
          gapToLeaderMs: 0,
          completedLaps: 3,
          isEliminated: false,
          isPlayer: true,
        },
        {
          position: 10,
          driverId: 'd10',
          bestLapMs: 81000,
          gapToLeaderMs: 1000,
          completedLaps: 3,
          isEliminated: false,
          isPlayer: false,
        },
        {
          position: 11,
          driverId: 'd11',
          bestLapMs: 81500,
          gapToLeaderMs: 1500,
          completedLaps: 3,
          isEliminated: true,
          isPlayer: false,
        },
      ],
      advancingDriverIds: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10'],
      eliminatedDriverIds: ['d11', 'd12', 'd13', 'd14', 'd15'],
      completedAt: new Date().toISOString(),
    }

    const mockSq2State = {
      seasonId,
      round,
      stageId: 'sq2' as const,
      status: 'completed' as const,
      timeRemainingSec: 0,
      leaderboard: [],
      eliminationZone: [],
      safeZone: [],
      advancingDriverIds: mockSq2Result.advancingDriverIds,
      eliminatedDriverIds: mockSq2Result.eliminatedDriverIds,
    }

    vi.spyOn(canonicalQualifyingStageResultBackendService, 'readStageResult').mockResolvedValue(
      mockSq2Result,
    )
    vi.spyOn(canonicalQualifyingStageStateBackendService, 'readStageState').mockResolvedValue(
      mockSq2State,
    )

    // LocalStorage está vazio (simulando purge pós confirmação backend)
    expect(
      localStorage.getItem(`apex_qualifying_stage_result_v2_${seasonId}_r${round}_sq2`),
    ).toBeNull()
    expect(
      localStorage.getItem(`apex_qualifying_stage_state_v2_${seasonId}_r${round}_sq2`),
    ).toBeNull()

    // 1. Leitura preferencial deve buscar do PocketBase e popular cache em memória
    const resOutcome = await canonicalQualifyingPersistenceService.readStageResultPreferred(
      seasonId,
      round,
      'sq2',
    )
    const stateOutcome = await canonicalQualifyingPersistenceService.readStageStatePreferred(
      seasonId,
      round,
      'sq2',
    )

    expect(resOutcome.source).toBe('backend')
    expect(resOutcome.data?.advancingDriverIds).toHaveLength(10)
    expect(stateOutcome.source).toBe('backend')
    expect(stateOutcome.data?.status).toBe('completed')

    // 2. Com cache em memória populado a partir do PocketBase, leituras síncronas agora funcionam
    const inMemResult = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      round,
      'sq2',
    )
    const inMemState = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'sq2')
    expect(inMemResult).not.toBeNull()
    expect(inMemState).not.toBeNull()

    // 3. Reconciliação em readStoredCompletedSessions deve identificar 'sq2' como concluída
    // mesmo que localStorage esteja vazio ou apenas com 'sq1'
    writeStoredCompletedSessions(seasonId, round, ['sq1'])
    const completed = readStoredCompletedSessions(seasonId, round)
    expect(completed).toContain('sq2')

    // 4. isSessionUnlocked deve liberar 'sq3'
    const sq3Unlocked = isSessionUnlocked('sq3', completed, true)
    expect(sq3Unlocked).toBe(true)
  })

  it('readStoredCompletedSessions considera sq2 concluída quando canonicalQualifyingPersistenceService possui resultado oficial na memória', () => {
    // Configura apenas o cache em memória (sem localStorage de stage_state)
    const mockSq2Result = {
      seasonId,
      round,
      stageId: 'sq2' as const,
      entries: [
        {
          position: 1,
          driverId: 'd1',
          bestLapMs: 80000,
          gapToLeaderMs: 0,
          completedLaps: 3,
          isEliminated: false,
          isPlayer: true,
        },
      ],
      advancingDriverIds: ['d1'],
      eliminatedDriverIds: [],
      completedAt: new Date().toISOString(),
    }

    // Salva apenas no cache de memória do serviço
    const key = canonicalQualifyingPersistenceService.getStageResultKey(seasonId, round, 'sq2')
    canonicalQualifyingPersistenceService._memoryStageResults.set(key, mockSq2Result)

    const completed = readStoredCompletedSessions(seasonId, round)
    expect(completed).toContain('sq2')
  })
})
