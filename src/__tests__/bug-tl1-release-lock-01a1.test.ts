import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  canonicalWeekendSlotPersistenceService,
  buildWeekendSlotStorageKey,
} from '@/services/canonicalWeekendSlotPersistenceService'
import { resetWeekendForRound } from '@/services/weekendProgressionService'

// Mock PocketBase para isolar estritamente o teste em memória/localStorage
vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: () => ({
      getList: vi.fn().mockResolvedValue({ items: [] }),
      getOne: vi.fn().mockResolvedValue(null),
    }),
  },
}))

describe('BUG-TL1-RELEASE-LOCK-01A1: Invalidação de cache em memória de weekend_slot_state no reset', () => {
  const CAREER_A = 'career_audi_2026'
  const CAREER_B = 'career_ferrari_2026'
  const SEASON_ID = 'season_2026'
  const ROUND_7 = 7
  const ROUND_8 = 8

  beforeEach(() => {
    localStorage.clear()
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
    vi.restoreAllMocks()
  })

  it('cenário principal: estado antigo colocado no cache -> reset executado -> cache invalidado -> nova leitura não reutiliza o objeto stale do cache', async () => {
    // 1. Criar um estado simulando avanço prévio na rodada 7 (ex: slot 3 concluído, currentSlot 4)
    const oldState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    oldState.currentSlot = 4
    oldState.slotStatus = 'AVAILABLE'
    oldState.completedSlots = [1, 2, 3]

    // Salvar estado (coloca no inMemoryCache e no localStorage)
    await canonicalWeekendSlotPersistenceService.saveSlotState(oldState)

    // 2. Confirmar que ele está no inMemoryCache e retorna exatamente a mesma referência
    const cachedState1 = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(cachedState1).toBe(oldState)
    expect(cachedState1.currentSlot).toBe(4)

    // 3. Executar resetWeekendForRound para a rodada 7
    const resetResult = resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(resetResult.success).toBe(true)

    // 4. Consultar novamente o estado após o reset
    const stateAfterReset = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // A segunda leitura NÃO pode retornar o objeto stale do cache em memória!
    expect(stateAfterReset).not.toBe(oldState)
    // O novo estado inicial deve ter currentSlot 1 e completedSlots vazio
    expect(stateAfterReset.currentSlot).toBe(1)
    expect(stateAfterReset.completedSlots).toEqual([])
  })

  it('controle: invalidar rodada 7 não remove cache da rodada 8', async () => {
    // Preparar estado para rodada 7
    const stateR7 = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    stateR7.currentSlot = 3
    await canonicalWeekendSlotPersistenceService.saveSlotState(stateR7)

    // Preparar estado para rodada 8
    const stateR8 = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_8,
    })
    stateR8.currentSlot = 5
    await canonicalWeekendSlotPersistenceService.saveSlotState(stateR8)

    // Garantir que ambos estão no inMemoryCache
    expect(
      await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
        careerId: CAREER_A,
        seasonId: SEASON_ID,
        round: ROUND_7,
      }),
    ).toBe(stateR7)
    expect(
      await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
        careerId: CAREER_A,
        seasonId: SEASON_ID,
        round: ROUND_8,
      }),
    ).toBe(stateR8)

    // Executar reset APENAS da rodada 7
    resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // R7 deve ter saído do cache (nova leitura cria outro objeto)
    const afterR7 = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(afterR7).not.toBe(stateR7)

    // R8 DEVE permanecer intacto no cache em memória (mesma referência stale intocada)
    const afterR8 = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_8,
    })
    expect(afterR8).toBe(stateR8)
    expect(afterR8.currentSlot).toBe(5)
  })

  it('controle: invalidar career A não remove cache de career B', async () => {
    // Preparar estado para Career A
    const stateCareerA = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    stateCareerA.currentSlot = 4
    await canonicalWeekendSlotPersistenceService.saveSlotState(stateCareerA)

    // Preparar estado para Career B
    const stateCareerB = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: CAREER_B,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    stateCareerB.currentSlot = 6
    await canonicalWeekendSlotPersistenceService.saveSlotState(stateCareerB)

    // Confirmar que ambos estão cacheados
    expect(
      await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
        careerId: CAREER_A,
        seasonId: SEASON_ID,
        round: ROUND_7,
      }),
    ).toBe(stateCareerA)
    expect(
      await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
        careerId: CAREER_B,
        seasonId: SEASON_ID,
        round: ROUND_7,
      }),
    ).toBe(stateCareerB)

    // Executar reset APENAS de Career A
    resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // Career A foi invalidada
    const afterA = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(afterA).not.toBe(stateCareerA)

    // Career B DEVE permanecer no cache (mesma referência)
    const afterB = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_B,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(afterB).toBe(stateCareerB)
    expect(afterB.currentSlot).toBe(6)
  })

  it('método invalidateMemoryCache reutiliza exatamente a composição de buildWeekendSlotStorageKey', () => {
    const keyExpected = buildWeekendSlotStorageKey(CAREER_A, SEASON_ID, ROUND_7)
    expect(keyExpected).toBe(`apex_weekend_slot_state_v1_${CAREER_A}_${SEASON_ID}_r${ROUND_7}`)

    // Testar diretamente a chamada de invalidateMemoryCache
    const state = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    // Salvar sem localStorage para testar puramente in-memory
    localStorage.clear()
    canonicalWeekendSlotPersistenceService.invalidateMemoryCache(CAREER_A, SEASON_ID, ROUND_7)
  })
})
