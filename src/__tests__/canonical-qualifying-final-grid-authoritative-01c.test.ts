/**
 * QG-C1..C8: Testes do Backend Autoritativo na Gravação do Grid Final de Qualificação (QGRID-PB-01C)
 *
 * Valida que o PocketBase é a autoridade canônica na persistência do grid final de qualificação.
 * Se o backend salvar com sucesso, falha de quota (QUOTA_EXCEEDED) no localStorage NÃO bloqueia:
 * - Conclusão da qualificação
 * - Reconhecimento do grid oficial (hasValidPersistedFinalGrid)
 * - Avanço para preparação da corrida
 * - Recuperação do grid homologado via backend-first (readFinalGridPreferred)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalQualifyingFinalGridBackendService } from '@/services/canonicalQualifyingFinalGridBackendService'
import type {
  CompleteQualifyingWeekendResult,
  QualifyingStageResult,
} from '@/types/canonical-qualifying-types'

function buildMockStageResult(stageId: 'q1' | 'q2' | 'q3'): QualifyingStageResult {
  const driverCount = stageId === 'q1' ? 24 : stageId === 'q2' ? 18 : 10
  const entries = Array.from({ length: driverCount }, (_, i) => ({
    position: i + 1,
    driverId: `drv_${i + 1}`,
    driverName: `Driver ${i + 1}`,
    teamId: `team_${Math.floor(i / 2) + 1}`,
    teamName: `Team ${Math.floor(i / 2) + 1}`,
    teamColor: '#ff0000',
    carId: (i % 2 === 0 ? 'car1' : 'car2') as 'car1' | 'car2',
    isPlayer: i === 0,
    bestLapSec: 80 + i * 0.1,
    bestLapTime: `1:20.${String(i).padStart(3, '0')}`,
    bestLapRecordedAtSec: 500 + i,
    compound: 'macio' as const,
    tyreSetId: `set_${i + 1}`,
    lapsCompleted: 3,
    lapsCount: 3,
    isEliminated: stageId === 'q1' ? i >= 18 : stageId === 'q2' ? i >= 10 : false,
  }))

  const eliminatedDriverIds =
    stageId === 'q1'
      ? entries.slice(18).map((e) => e.driverId)
      : stageId === 'q2'
        ? entries.slice(10).map((e) => e.driverId)
        : []

  const advancingDriverIds =
    stageId === 'q1'
      ? entries.slice(0, 18).map((e) => e.driverId)
      : stageId === 'q2'
        ? entries.slice(0, 10).map((e) => e.driverId)
        : []

  return {
    stageId,
    seasonId: 'season_2026',
    round: 1,
    completedAt: '2026-03-15T14:00:00Z',
    entries,
    eliminatedDriverIds,
    advancingDriverIds,
  }
}

function buildMockCompleteResult(
  seasonId = 'season_2026',
  round = 1,
): CompleteQualifyingWeekendResult {
  const q1Result = buildMockStageResult('q1')
  const q2Result = buildMockStageResult('q2')
  const q3Result = buildMockStageResult('q3')

  return canonicalQualifyingPersistenceService.buildCombinedFinalGrid({
    seasonId,
    round,
    q1Result,
    q2Result,
    q3Result,
    persistResult: false,
  })
}

describe('QGRID-PB-01C — Backend Autoritativo no Grid Final de Qualificação (QG-C1..C8)', () => {
  let localStorageMock: Record<string, string> = {}
  let throwQuotaError = false

  beforeEach(() => {
    localStorageMock = {}
    throwQuotaError = false
    canonicalQualifyingPersistenceService.clearCachesForTesting()
    canonicalQualifyingFinalGridBackendService.clearCachesForTesting()
    vi.restoreAllMocks()

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          if (throwQuotaError) {
            const err = new Error('QuotaExceededError: DOM Exception 22')
            err.name = 'QuotaExceededError'
            ;(err as any).code = 22
            throw err
          }
          localStorageMock[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key]
        }),
        clear: vi.fn(() => {
          localStorageMock = {}
        }),
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    canonicalQualifyingPersistenceService.clearCachesForTesting()
  })

  it('QG-C1: backend success + local success => success (authority backend)', async () => {
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: true,
      id: 'rec_grid_123',
    })

    const sample = buildMockCompleteResult()
    const outcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(sample)

    expect(outcome.success).toBe(true)
    expect(outcome.authority).toBe('backend')
    expect(outcome.persistedBackend).toBe(true)
    expect(outcome.persistedLocal).toBe(true)
    expect(outcome.error).toBeUndefined()
  })

  it('QG-C2: backend success + local QUOTA_EXCEEDED => success, authority backend, persistedBackend true, persistedLocal false', async () => {
    throwQuotaError = true
    const purgeSpy = vi.spyOn(canonicalQualifyingPersistenceService, 'purgeLocalFinalGrid')

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: true,
      id: 'rec_grid_123',
    })

    const sample = buildMockCompleteResult()
    const outcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(sample)

    expect(outcome.success).toBe(true)
    expect(outcome.authority).toBe('backend')
    expect(outcome.persistedBackend).toBe(true)
    expect(outcome.persistedLocal).toBe(false)
    expect(purgeSpy).toHaveBeenCalledWith(sample.seasonId, sample.round)
  })

  it('QG-C3: backend success + local ausente => reload recupera via backend (01B intacto)', async () => {
    throwQuotaError = true
    const sample = buildMockCompleteResult()

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: true,
      id: 'rec_grid_123',
    })

    // Salva com quota local estourada
    const saveOutcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(sample)
    expect(saveOutcome.success).toBe(true)
    expect(saveOutcome.authority).toBe('backend')

    // Simula reload: limpa cache em memória e garante que localStorage está vazio
    canonicalQualifyingPersistenceService.clearCachesForTesting()
    expect(
      window.localStorage.getItem(
        `apex_qualifying_final_grid_v2_${sample.seasonId}_r${sample.round}`,
      ),
    ).toBeNull()

    // Configura backend para responder na leitura
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockResolvedValue(sample)

    // Leitura backend-first
    const readOutcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      sample.seasonId,
      sample.round,
    )
    expect(readOutcome.source).toBe('backend')
    expect(readOutcome.data).not.toBeNull()
    expect(readOutcome.data?.poleDriverId).toBe(sample.poleDriverId)
    expect(readOutcome.data?.finalGrid.length).toBe(24)
  })

  it('QG-C4: backend failure + local success => success, authority local, backendError observável', async () => {
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: false,
      error: 'PocketBase offline (503)',
    })

    const sample = buildMockCompleteResult()
    const outcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(sample)

    expect(outcome.success).toBe(true)
    expect(outcome.authority).toBe('local')
    expect(outcome.persistedBackend).toBe(false)
    expect(outcome.persistedLocal).toBe(true)
    expect(outcome.backendError).toBe('PocketBase offline (503)')
  })

  it('QG-C5: backend failure + local failure => failure real', async () => {
    throwQuotaError = true
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: false,
      error: 'Network Timeout',
    })

    const sample = buildMockCompleteResult()
    const outcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(sample)

    expect(outcome.success).toBe(false)
    expect(outcome.persistedBackend).toBe(false)
    expect(outcome.persistedLocal).toBe(false)
    expect(outcome.backendError).toBe('Network Timeout')
    expect(outcome.reason).toBe('QUOTA_EXCEEDED')
  })

  it('QG-C6: payload enviado ao backend é exatamente o mesmo final grid já calculado, sem reconstrução', async () => {
    let capturedPayload: CompleteQualifyingWeekendResult | null = null

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockImplementation(
      async (_ctx, payload) => {
        capturedPayload = payload
        return { success: true, id: 'grid_rec_c6' }
      },
    )

    const q1Result = buildMockStageResult('q1')
    const q2Result = buildMockStageResult('q2')
    const q3Result = buildMockStageResult('q3')

    const { result, outcome } =
      await canonicalQualifyingPersistenceService.buildCombinedFinalGridAsync({
        seasonId: 'season_2026',
        round: 1,
        q1Result,
        q2Result,
        q3Result,
      })

    expect(outcome?.success).toBe(true)
    expect(outcome?.authority).toBe('backend')
    expect(capturedPayload).not.toBeNull()
    // Identidade estrita e mesmas instâncias/posições
    expect(capturedPayload).toBe(result)
    expect(capturedPayload!.finalGrid).toBe(result.finalGrid)
    expect(capturedPayload!.poleDriverId).toBe(result.poleDriverId)
    expect(capturedPayload!.finalGrid.length).toBe(24)
  })

  it('QG-C7: backend success + local quota => validação estrutural do grid persistido é válida e desbloqueia avanço', async () => {
    throwQuotaError = true

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: true,
      id: 'rec_grid_c7',
    })

    const sample = buildMockCompleteResult()
    const outcome =
      await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(sample)

    expect(outcome.success).toBe(true)
    expect(outcome.authority).toBe('backend')

    // Validar que o grid construído é considerado válido para homologação e avanço
    const isValid = canonicalQualifyingPersistenceService.isValidFinalQualifyingGrid(sample)
    expect(isValid).toBe(true)
    expect(sample.finalGrid.length).toBe(24)
    expect(sample.poleDriverId).toBeDefined()
  })

  it('QG-C8: backend success + local quota => preparação da corrida consome o grid homologado após reload', async () => {
    throwQuotaError = true
    const sample = buildMockCompleteResult('season_2026', 2)

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: true,
      id: 'rec_grid_c8',
    })

    await canonicalQualifyingPersistenceService.saveCompleteQualifyingResultAsync(sample)

    // Simula reload de página e perda de cache em memória
    canonicalQualifyingPersistenceService.clearCachesForTesting()
    expect(window.localStorage.getItem(`apex_qualifying_final_grid_v2_season_2026_r2`)).toBeNull()

    // Backend retorna o grid homologado no boot / preparação de corrida
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockResolvedValue(sample)

    const preferred = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      'season_2026',
      2,
    )
    expect(preferred.source).toBe('backend')
    expect(preferred.data).not.toBeNull()
    expect(preferred.data?.finalGrid[0].driverId).toBe(sample.finalGrid[0].driverId)
    expect(preferred.data?.finalGrid[0].gridPosition).toBe(1)
  })
})
