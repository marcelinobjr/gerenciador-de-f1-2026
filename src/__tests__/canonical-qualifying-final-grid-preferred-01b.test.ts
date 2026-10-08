/**
 * canonical-qualifying-final-grid-preferred-01b.test.ts
 *
 * Suíte de testes para QGRID-PB-01B:
 * Leitura canônica backend-first do grid final de qualificação (P1–P24).
 *
 * Casos cobertos:
 * - QG-B1 — BACKEND FOUND: backend válido, local ausente. Resultado: backend.
 * - QG-B2 — BACKEND VENCE LOCAL: backend e local válidos, divergentes. Resultado: backend.
 * - QG-B3 — NOT_FOUND + LOCAL: backend NOT_FOUND, local válido. Resultado: local.
 * - QG-B4 — NOT_FOUND + SEM LOCAL: Resultado: none.
 * - QG-B5 — BACKEND ERROR + LOCAL: source local, backendError observável.
 * - QG-B6 — BACKEND ERROR + SEM LOCAL: source none, backendError observável.
 * - QG-B7 — PAYLOAD BACKEND INVÁLIDO: não tratar como NOT_FOUND.
 * - QG-B8 — RELOAD SEM CHAVE LOCAL: backend contém o grid; confirmar que o fluxo recupera o grid normalmente.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalQualifyingFinalGridBackendService } from '@/services/canonicalQualifyingFinalGridBackendService'
import type {
  CompleteQualifyingWeekendResult,
  FinalQualifyingGridEntry,
} from '@/types/canonical-qualifying-types'

function makeMockGridEntry(
  pos: number,
  driverId: string,
  driverName: string,
  lapTime: string,
): FinalQualifyingGridEntry {
  return {
    gridPosition: pos,
    driverId,
    driverName,
    teamId: 'team_mercedes',
    teamName: 'Mercedes-AMG PETRONAS',
    teamColor: '#00D2BE',
    isPlayer: false,
    carId: pos % 2 === 1 ? 'car1' : 'car2',
    eliminationStage: 'Q3',
    bestLapSec: 73.498 + pos * 0.1,
    bestLapTime: lapTime,
    bestLapCompound: 'macio',
    tyreSetId: `set_${pos}`,
  }
}

function makeMockCompleteResult(
  seasonId: string,
  round: number,
  poleDriverId: string,
  poleDriverName: string,
  poleLapTime: string,
): CompleteQualifyingWeekendResult {
  const entries: FinalQualifyingGridEntry[] = [
    makeMockGridEntry(1, poleDriverId, poleDriverName, poleLapTime),
    makeMockGridEntry(2, 'drv_verstappen', 'Max Verstappen', '1:13.550'),
    makeMockGridEntry(3, 'drv_norris', 'Lando Norris', '1:13.620'),
    makeMockGridEntry(4, 'drv_leclerc', 'Charles Leclerc', '1:13.700'),
  ]

  return {
    seasonId,
    round,
    completedAt: '2026-03-15T15:00:00.000Z',
    poleDriverId,
    poleDriverName,
    poleLapTime,
    q1Result: {
      stageId: 'q1',
      seasonId,
      round,
      completedAt: '2026-03-15T14:18:00.000Z',
      entries: [],
      eliminatedDriverIds: [],
      advancingDriverIds: [poleDriverId, 'drv_verstappen', 'drv_norris', 'drv_leclerc'],
    },
    q2Result: {
      stageId: 'q2',
      seasonId,
      round,
      completedAt: '2026-03-15T14:35:00.000Z',
      entries: [],
      eliminatedDriverIds: [],
      advancingDriverIds: [poleDriverId, 'drv_verstappen', 'drv_norris', 'drv_leclerc'],
    },
    q3Result: {
      stageId: 'q3',
      seasonId,
      round,
      completedAt: '2026-03-15T15:00:00.000Z',
      entries: [],
      eliminatedDriverIds: [],
      advancingDriverIds: [],
    },
    finalGrid: entries,
  }
}

describe('QGRID-PB-01B — Leitura canônica backend-first do grid final de qualificação', () => {
  const TEST_CAREER = 'uc5qbo5uosqcocs'
  const TEST_SEASON = 55
  const TEST_ROUND = 1

  beforeEach(() => {
    localStorage.clear()
    canonicalQualifyingPersistenceService.clearMemoryForTesting()
    canonicalQualifyingFinalGridBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  it('QG-B1 — BACKEND FOUND: backend válido, local ausente. Resultado: backend.', async () => {
    const backendGrid = makeMockCompleteResult(
      TEST_CAREER,
      TEST_ROUND,
      'drv_antonelli',
      'Andrea Kimi Antonelli',
      '1:13.498',
    )

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockResolvedValue(
      backendGrid,
    )

    // Local storage intencionalmente vazio
    const localKey = canonicalQualifyingPersistenceService.getFinalGridKey(TEST_CAREER, TEST_ROUND)
    expect(localStorage.getItem(localKey)).toBeNull()

    const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      TEST_CAREER,
      TEST_ROUND,
    )

    expect(outcome.source).toBe('backend')
    expect(outcome.data).not.toBeNull()
    expect(outcome.data?.poleDriverName).toBe('Andrea Kimi Antonelli')
    expect(outcome.data?.poleLapTime).toBe('1:13.498')
    expect(outcome.backendError).toBeUndefined()
  })

  it('QG-B2 — BACKEND VENCE LOCAL: backend e local válidos, divergentes. Resultado: backend.', async () => {
    // Prova real: backend tem Antonelli P1 1:13.498; local tem payload diferente (Verstappen P1 1:13.800)
    const backendGrid = makeMockCompleteResult(
      TEST_CAREER,
      TEST_ROUND,
      'drv_antonelli',
      'Andrea Kimi Antonelli',
      '1:13.498',
    )

    const localGrid = makeMockCompleteResult(
      TEST_CAREER,
      TEST_ROUND,
      'drv_verstappen',
      'Max Verstappen',
      '1:13.800',
    )

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockResolvedValue(
      backendGrid,
    )

    // Gravar local divergent
    const localKey = canonicalQualifyingPersistenceService.getFinalGridKey(TEST_CAREER, TEST_ROUND)
    localStorage.setItem(localKey, JSON.stringify(localGrid))

    const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      TEST_CAREER,
      TEST_ROUND,
    )

    // Backend vence divergência sem merge
    expect(outcome.source).toBe('backend')
    expect(outcome.data).not.toBeNull()
    expect(outcome.data?.poleDriverId).toBe('drv_antonelli')
    expect(outcome.data?.poleDriverName).toBe('Andrea Kimi Antonelli')
    expect(outcome.data?.poleLapTime).toBe('1:13.498')
    expect(outcome.data?.finalGrid[0].driverId).toBe('drv_antonelli')
    expect(outcome.backendError).toBeUndefined()
  })

  it('QG-B3 — NOT_FOUND + LOCAL: backend NOT_FOUND, local válido. Resultado: local.', async () => {
    // Backend retorna null (NOT_FOUND)
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockResolvedValue(null)

    const localGrid = makeMockCompleteResult(
      TEST_CAREER,
      TEST_ROUND,
      'drv_norris',
      'Lando Norris',
      '1:13.900',
    )

    const localKey = canonicalQualifyingPersistenceService.getFinalGridKey(TEST_CAREER, TEST_ROUND)
    localStorage.setItem(localKey, JSON.stringify(localGrid))

    const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      TEST_CAREER,
      TEST_ROUND,
    )

    expect(outcome.source).toBe('local')
    expect(outcome.data).not.toBeNull()
    expect(outcome.data?.poleDriverName).toBe('Lando Norris')
    expect(outcome.backendError).toBeUndefined()
  })

  it('QG-B4 — NOT_FOUND + SEM LOCAL: Resultado: none.', async () => {
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockResolvedValue(null)

    const localKey = canonicalQualifyingPersistenceService.getFinalGridKey(TEST_CAREER, TEST_ROUND)
    expect(localStorage.getItem(localKey)).toBeNull()

    const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      TEST_CAREER,
      TEST_ROUND,
    )

    expect(outcome.source).toBe('none')
    expect(outcome.data).toBeNull()
    expect(outcome.backendError).toBeUndefined()
  })

  it('QG-B5 — BACKEND ERROR + LOCAL: source local, backendError observável.', async () => {
    // Falha de conexão PocketBase / 500
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockRejectedValue(
      new Error('PocketBase network timeout 504 Gateway Timeout'),
    )

    const localGrid = makeMockCompleteResult(
      TEST_CAREER,
      TEST_ROUND,
      'drv_leclerc',
      'Charles Leclerc',
      '1:13.520',
    )

    const localKey = canonicalQualifyingPersistenceService.getFinalGridKey(TEST_CAREER, TEST_ROUND)
    localStorage.setItem(localKey, JSON.stringify(localGrid))

    const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      TEST_CAREER,
      TEST_ROUND,
    )

    expect(outcome.source).toBe('local')
    expect(outcome.data).not.toBeNull()
    expect(outcome.data?.poleDriverName).toBe('Charles Leclerc')
    // Erro do backend não foi mascarado como NOT_FOUND
    expect(outcome.backendError).toBeDefined()
    expect(outcome.backendError).toContain('PocketBase network timeout')
  })

  it('QG-B6 — BACKEND ERROR + SEM LOCAL: source none, backendError observável.', async () => {
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockRejectedValue(
      new Error('Unauthorized 401 client request'),
    )

    const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      TEST_CAREER,
      TEST_ROUND,
    )

    expect(outcome.source).toBe('none')
    expect(outcome.data).toBeNull()
    expect(outcome.backendError).toBeDefined()
    expect(outcome.backendError).toContain('Unauthorized 401')
  })

  it('QG-B7 — PAYLOAD BACKEND INVÁLIDO: não tratar como NOT_FOUND.', async () => {
    // Backend retorna objeto com estrutura inválida (ex: finalGrid vazio ou corrompido)
    const corruptedBackendGrid = {
      seasonId: TEST_CAREER,
      round: TEST_ROUND,
      finalGrid: [], // inválido! deve conter P1-P24
    } as unknown as CompleteQualifyingWeekendResult

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockResolvedValue(
      corruptedBackendGrid,
    )

    // Há um fallback local íntegro
    const localGrid = makeMockCompleteResult(
      TEST_CAREER,
      TEST_ROUND,
      'drv_piastri',
      'Oscar Piastri',
      '1:13.600',
    )
    const localKey = canonicalQualifyingPersistenceService.getFinalGridKey(TEST_CAREER, TEST_ROUND)
    localStorage.setItem(localKey, JSON.stringify(localGrid))

    const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      TEST_CAREER,
      TEST_ROUND,
    )

    // O fallback local é usado para continuidade, mas backendError NÃO é vazio
    expect(outcome.source).toBe('local')
    expect(outcome.data?.poleDriverName).toBe('Oscar Piastri')
    expect(outcome.backendError).toBeDefined()
    expect(outcome.backendError).toContain('inválido ou corrompido')
  })

  it('QG-B8 — RELOAD SEM CHAVE LOCAL: backend contém o grid; confirmar que o fluxo recupera o grid normalmente.', async () => {
    // Cenário de reload onde localStorage foi esvaziado, quota excedida ou purgado
    const backendGrid = makeMockCompleteResult(
      TEST_CAREER,
      TEST_ROUND,
      'drv_antonelli',
      'Andrea Kimi Antonelli',
      '1:13.498',
    )

    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'readFinalGrid').mockResolvedValue(
      backendGrid,
    )

    // Garantir que a chave local NÃO existe
    const localKey = canonicalQualifyingPersistenceService.getFinalGridKey(TEST_CAREER, TEST_ROUND)
    localStorage.removeItem(localKey)
    expect(localStorage.getItem(localKey)).toBeNull()

    // Leitura síncrona inicial retorna null (pois cache e localStorage estão vazios)
    const syncBefore = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      TEST_CAREER,
      TEST_ROUND,
    )
    expect(syncBefore).toBeNull()

    // Leitura preferencial (load/reidratação)
    const outcome = await canonicalQualifyingPersistenceService.readFinalGridPreferred(
      TEST_CAREER,
      TEST_ROUND,
    )

    expect(outcome.source).toBe('backend')
    expect(outcome.data).not.toBeNull()
    expect(outcome.data?.poleDriverName).toBe('Andrea Kimi Antonelli')
    expect(outcome.data?.poleLapTime).toBe('1:13.498')

    // Após a reidratação bem sucedida do backend, a memória ativa deve ter o grid disponível para leituras síncronas subsequentes
    const syncAfter = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      TEST_CAREER,
      TEST_ROUND,
    )
    expect(syncAfter).not.toBeNull()
    expect(syncAfter?.poleDriverName).toBe('Andrea Kimi Antonelli')
  })
})
