import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalQualifyingPersistenceService } from '../services/canonicalQualifyingPersistenceService'
import { canonicalQualifyingFinalGridBackendService } from '../services/canonicalQualifyingFinalGridBackendService'
import * as storageQuotaService from '../services/storageQuotaService'
import type { CompleteQualifyingWeekendResult } from '../types/canonical-qualifying-types'

describe('f-grid-quota-02: Cadeia de persistência de grid final resiliente à quota do localStorage', () => {
  const seasonId = 'test_season_quota_02'
  const round = 1

  const mockCompleteResult: CompleteQualifyingWeekendResult = {
    seasonId,
    round,
    completedAt: '2026-03-29T15:00:00.000Z',
    poleDriverId: 'driver_1',
    poleDriverName: 'Max Verstappen',
    poleLapTime: '1:20.000',
    q1Result: {
      seasonId,
      round,
      stageId: 'q1',
      completedAt: '2026-03-29T14:20:00.000Z',
      entries: [
        {
          position: 1,
          driverId: 'driver_1',
          driverName: 'Max Verstappen',
          teamId: 'red_bull',
          teamName: 'Red Bull Racing',
          teamColor: '#0600EF',
          isPlayer: false,
          carId: 'car1',
          bestLapSec: 80.0,
          bestLapTime: '1:20.000',
          bestLapRecordedAtSec: 80.0,
          compound: 'macio',
          tyreSetId: 't1',
          lapsCount: 3,
          isEliminated: false,
        },
        {
          position: 2,
          driverId: 'driver_2',
          driverName: 'Lewis Hamilton',
          teamId: 'ferrari',
          teamName: 'Ferrari',
          teamColor: '#E80020',
          isPlayer: false,
          carId: 'car2',
          bestLapSec: 81.0,
          bestLapTime: '1:21.000',
          bestLapRecordedAtSec: 81.0,
          compound: 'macio',
          tyreSetId: 't2',
          lapsCount: 3,
          isEliminated: true,
        },
      ],      eliminatedDriverIds: ['driver_2'],
      advancingDriverIds: ['driver_1'],
    },
    q2Result: {
      seasonId,
      round,
      stageId: 'q2',
      completedAt: '2026-03-29T14:40:00.000Z',
      entries: [
        {
          position: 1,
          driverId: 'driver_1',
          driverName: 'Max Verstappen',
          teamId: 'red_bull',
          teamName: 'Red Bull Racing',
          teamColor: '#0600EF',
          isPlayer: false,
          carId: 'car1',
          bestLapSec: 79.5,
          bestLapTime: '1:19.500',
          bestLapRecordedAtSec: 79.5,
          compound: 'macio',
          tyreSetId: 't1',
          lapsCount: 3,
          isEliminated: false,
        },
      ],      eliminatedDriverIds: [],
      advancingDriverIds: ['driver_1'],
    },
    q3Result: {
      seasonId,
      round,
      stageId: 'q3',
      completedAt: '2026-03-29T15:00:00.000Z',
      entries: [
        {
          position: 1,
          driverId: 'driver_1',
          driverName: 'Max Verstappen',
          teamId: 'red_bull',
          teamName: 'Red Bull Racing',
          teamColor: '#0600EF',
          isPlayer: false,
          carId: 'car1',
          bestLapSec: 79.0,
          bestLapTime: '1:19.000',
          bestLapRecordedAtSec: 79.0,
          compound: 'macio',
          tyreSetId: 't1',
          lapsCount: 3,
          isEliminated: false,
        },
      ],      eliminatedDriverIds: [],
      advancingDriverIds: [],
    },
    finalGrid: [
      {
        gridPosition: 1,
        driverId: 'driver_1',
        driverName: 'Max Verstappen',
        teamId: 'red_bull',
        teamName: 'Red Bull Racing',
        teamColor: '#0600EF',
        isPlayer: false,
        carId: 'car1',
        eliminationStage: 'Q3',
        bestLapSec: 79.0,
        bestLapTime: '1:19.000',
        bestLapCompound: 'macio',
      },
      {
        gridPosition: 2,
        driverId: 'driver_2',
        driverName: 'Lewis Hamilton',
        teamId: 'ferrari',
        teamName: 'Ferrari',
        teamColor: '#E80020',
        isPlayer: false,
        carId: 'car2',
        eliminationStage: 'Q1',
        bestLapSec: 81.0,
        bestLapTime: '1:21.000',
        bestLapCompound: 'macio',
      },
    ],
  }

  beforeEach(() => {
    localStorage.clear()
    canonicalQualifyingPersistenceService.clearMemoryForTesting()
    vi.restoreAllMocks()
  })

  it('1. saveCompleteQualifyingResult síncrono com safeLocalStorageSetItem estourando cota não lança exceção', () => {
    const quotaErr = new DOMException(
      "Failed to execute 'setItem' on 'Storage': Setting the value of 'apex_qualifying_final_grid_v2_uc5qbo5uosqcocs_r1' exceeded the quota.",
      'QuotaExceededError',
    )
    vi.spyOn(storageQuotaService, 'safeLocalStorageSetItem').mockImplementation(() => {
      throw quotaErr
    })
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: true,
      id: 'rec_pb_123',
    })

    let outcome: any
    expect(() => {
      outcome =
        canonicalQualifyingPersistenceService.saveCompleteQualifyingResult(mockCompleteResult)
    }).not.toThrow()

    expect(outcome.persistedLocal).toBe(false)
    expect(outcome.reason).toBe('QUOTA_EXCEEDED')

    // Deve estar no cache de memória para leitura síncrona imediata
    const inMemory = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      seasonId,
      round,
    )
    expect(inMemory).not.toBeNull()
    expect(inMemory?.poleDriverId).toBe('driver_1')
  })

  it('2. saveCompleteQualifyingResultAsync com quota estourada no localStorage e sucesso backend retorna sucesso e expurga local', async () => {
    const quotaErr = new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    vi.spyOn(storageQuotaService, 'safeLocalStorageSetItem').mockImplementation(() => {
      throw quotaErr
    })
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: true,
      id: 'rec_grid_async_01',
    })

    const purgeSpy = vi.spyOn(canonicalQualifyingPersistenceService, 'purgeLocalFinalGrid')

    const outcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(
        mockCompleteResult,
      )

    expect(outcome.success).toBe(true)
    expect(outcome.persistedBackend).toBe(true)
    expect(outcome.persistedLocal).toBe(false)
    expect(purgeSpy).toHaveBeenCalledWith(seasonId, round)

    // O cache de memória continua intacto e responde com os dados oficiais
    const read = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(seasonId, round)
    expect(read).not.toBeNull()
    expect(read?.finalGrid).toHaveLength(2)
  })

  it('3. buildCombinedFinalGrid com quota estourada no localStorage não lança exceção e retorna o grid montado', () => {
    const quotaErr = new DOMException(
      "Failed to execute 'setItem' on 'Storage': Setting the value of 'apex_qualifying_final_grid_v2_test_season_quota_02_r1' exceeded the quota.",
      'QuotaExceededError',
    )

    // Simula as fases salvas em memória
    canonicalQualifyingPersistenceService.saveStageResult(mockCompleteResult.q1Result)
    canonicalQualifyingPersistenceService.saveStageResult(mockCompleteResult.q2Result)
    canonicalQualifyingPersistenceService.saveStageResult(mockCompleteResult.q3Result)

    vi.spyOn(storageQuotaService, 'safeLocalStorageSetItem').mockImplementation(() => {
      throw quotaErr
    })

    let result: CompleteQualifyingWeekendResult | null = null
    expect(() => {
      result = canonicalQualifyingPersistenceService.buildCombinedFinalGrid(seasonId, round)
    }).not.toThrow()
    expect(result).not.toBeNull()
    expect(result?.finalGrid).toBeDefined()
    expect(result?.finalGrid.length).toBeGreaterThan(0)
  })

  it('4. saveCompleteQualifyingResultAsync com falha dupla (local cota + backend erro) retorna erro explícito sem falso sucesso', async () => {
    const quotaErr = new DOMException('Storage quota exceeded', 'QuotaExceededError')
    vi.spyOn(storageQuotaService, 'safeLocalStorageSetItem').mockImplementation(() => {
      throw quotaErr
    })
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: false,
      error: 'Backend network unreachable',
    })

    const outcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(
        mockCompleteResult,
      )

    expect(outcome.success).toBe(false)
    expect(outcome.persistedBackend).toBe(false)
    expect(outcome.persistedLocal).toBe(false)
    expect(outcome.reason).toBe('QUOTA_EXCEEDED')
  })

  it('5. Caminho feliz com localStorage e PocketBase disponíveis persiste ambos normalmente', async () => {
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: true,
      id: 'rec_ok_01',
    })

    const outcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(
        mockCompleteResult,
      )

    expect(outcome.success).toBe(true)
    expect(outcome.persistedBackend).toBe(true)
  })
})
