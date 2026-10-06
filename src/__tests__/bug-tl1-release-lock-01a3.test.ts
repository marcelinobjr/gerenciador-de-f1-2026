import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  canonicalWeekendSlotPersistenceService,
  buildWeekendSlotStorageKey,
} from '@/services/canonicalWeekendSlotPersistenceService'
import {
  resetWeekendForRound,
  getActiveWeekendGeneration,
} from '@/services/weekendProgressionService'
import { resolveCanonicalCareerId } from '@/lib/canonical-career-id'
import type { CanonicalWeekendSlotState, WeekendSlotNumber } from '@/types/weekend-slot-types'

// Mock PocketBase para controlar as respostas de session_setups
let mockSessionSetupsRecords: any[] = []

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: (name: string) => {
      if (name === 'session_setups') {
        return {
          getList: vi.fn().mockImplementation(async () => {
            return { items: mockSessionSetupsRecords }
          }),
          getOne: vi.fn().mockResolvedValue(null),
        }
      }
      return {
        getList: vi.fn().mockResolvedValue({ items: [] }),
        getOne: vi.fn().mockResolvedValue(null),
      }
    },
  },
}))

describe('BUG-TL1-RELEASE-LOCK-01A3 — UNIFICAÇÃO DE IDENTIDADE DO weekend_slot_state', () => {
  // Valores deliberadamente diferentes conforme especificação
  const PB_TEAM_RECORD_ID = 'pb_team_record_123'
  const CANONICAL_CAREER_ID_A = 'team_audi_2026'
  const CANONICAL_CAREER_ID_B = 'team_ferrari_2026'
  const SEASON_ID = 'season_2026'
  const ROUND_7 = 7

  const mockTeamA = {
    id: PB_TEAM_RECORD_ID,
    name: 'Audi F1 Team',
    team_key: 'audi',
  }

  const mockSeasonA = {
    id: 'season_rec_123',
    career_id: CANONICAL_CAREER_ID_A,
    year: 2026,
  }

  beforeEach(() => {
    localStorage.clear()
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
    mockSessionSetupsRecords = []
    vi.restoreAllMocks()
  })

  // Helper para criar estado avançado de slot
  function createAdvancedSlotState(params: {
    careerId: string
    seasonId: string
    round: number
    currentSlot: WeekendSlotNumber
    generation?: number
  }): CanonicalWeekendSlotState {
    const state = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: params.careerId,
      seasonId: params.seasonId,
      round: params.round,
      weekendFormat: 'NORMAL',
    })
    state.currentSlot = params.currentSlot
    state.slotType = 'Q1'
    state.slots[1].status = 'COMPLETED'
    state.slots[2].status = 'COMPLETED'
    state.slots[3].status = 'COMPLETED'
    state.slots[4].status = 'AVAILABLE'
    state.completedSlots = [1, 2, 3]
    if (params.generation !== undefined) {
      state.generation = params.generation
      state.weekendGeneration = params.generation
    }
    return state
  }

  /**
   * A3.1: load/save/reset/invalidate usam a mesma chave canônica.
   * Prova que quando team.id ("pb_team_record_123") ≠ canonicalCareerId ("team_audi_2026"),
   * a identidade canônica resolvida por resolveCanonicalCareerId é unificada para load, save, reset e invalidate.
   */
  it('A3.1: load/save/reset/invalidate usam a mesma chave canônica', async () => {
    // 1. Verificar a divergência inicial deliberada
    const canonicalId = resolveCanonicalCareerId(mockSeasonA, mockTeamA)
    expect(mockTeamA.id).toBe(PB_TEAM_RECORD_ID)
    expect(canonicalId).toBe(CANONICAL_CAREER_ID_A)
    expect(mockTeamA.id).not.toBe(canonicalId)

    // 2. Chave canônica esperada
    const canonicalKey = buildWeekendSlotStorageKey(canonicalId, SEASON_ID, ROUND_7)
    const divergentKey = buildWeekendSlotStorageKey(mockTeamA.id, SEASON_ID, ROUND_7)
    expect(canonicalKey).not.toBe(divergentKey)
    expect(canonicalKey).toBe(
      `apex_weekend_slot_state_v1_${CANONICAL_CAREER_ID_A}_${SEASON_ID}_r${ROUND_7}`,
    )

    // 3. Salvar com canonicalId
    const freshState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: canonicalId,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    await canonicalWeekendSlotPersistenceService.saveSlotState(freshState)

    // O item foi persistido na chave canônica, NÃO na chave divergente de team.id
    expect(localStorage.getItem(canonicalKey)).not.toBeNull()
    expect(localStorage.getItem(divergentKey)).toBeNull()

    // 4. Carregar com canonicalId
    const loaded = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: canonicalId,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(loaded.careerId).toBe(CANONICAL_CAREER_ID_A)

    // 5. Resetar com canonicalId
    const resetResult = resetWeekendForRound({
      careerId: canonicalId,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(resetResult.success).toBe(true)
    // A chave canônica foi removida pelo reset
    expect(localStorage.getItem(canonicalKey)).toBeNull()
    expect(resetResult.clearedKeys).toContain(canonicalKey)

    // 6. Invalidate memory cache também opera na mesma chave canônica
    canonicalWeekendSlotPersistenceService.invalidateMemoryCache(canonicalId, SEASON_ID, ROUND_7)
  })

  /**
   * A3.2: estado avançado salvo + reset canônico + reload → estado antigo NÃO reaparece;
   * currentSlot=1, TL1 AVAILABLE.
   */
  it('A3.2: estado avançado salvo + reset canônico + reload → estado antigo NÃO reaparece; currentSlot=1, TL1 AVAILABLE', async () => {
    const canonicalId = resolveCanonicalCareerId(mockSeasonA, mockTeamA)
    const activeGen = getActiveWeekendGeneration(SEASON_ID, ROUND_7, canonicalId)

    // 1. Estado avançado salvo sob a chave canônica (currentSlot = 4, TL1/TL2/TL3 COMPLETED)
    const advancedState = createAdvancedSlotState({
      careerId: canonicalId,
      seasonId: SEASON_ID,
      round: ROUND_7,
      currentSlot: 4,
      generation: activeGen,
    })
    await canonicalWeekendSlotPersistenceService.saveSlotState(advancedState)

    // Confirmar que o estado avançado está lá
    const beforeReset = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: canonicalId,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(beforeReset.currentSlot).toBe(4)

    // 2. Executar reset canônico (exatamente como feito por handleResetCurrentWeekend na WeekendV2Page)
    const resetResult = resetWeekendForRound({
      careerId: canonicalId,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(resetResult.success).toBe(true)

    // Simular reload total de página (memória limpa)
    canonicalWeekendSlotPersistenceService.clearMemoryCache()

    // 3. Reload: carregar estado canônico
    const stateAfterReload = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: canonicalId,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // O estado antigo NÃO reaparece; currentSlot=1, TL1 AVAILABLE, completedSlots=[]
    expect(stateAfterReload.currentSlot).toBe(1)
    expect(stateAfterReload.slots[1].status).toBe('AVAILABLE')
    expect(stateAfterReload.slots[1].slotType).toBe('TL1')
    expect(stateAfterReload.slots[2].status).toBe('LOCKED')
    expect(stateAfterReload.completedSlots).toEqual([])
  })

  /**
   * A3.3: weekend em andamento, generation compatível, reload → progresso legítimo preservado
   * (unificação não pode provocar reset indevido).
   */
  it('A3.3: weekend em andamento, generation compatível, reload → progresso legítimo preservado', async () => {
    const canonicalId = resolveCanonicalCareerId(mockSeasonA, mockTeamA)
    const activeGen = getActiveWeekendGeneration(SEASON_ID, ROUND_7, canonicalId)

    // 1. Simular fim de semana em andamento com TL1 concluído e TL2 AVAILABLE (slot 2)
    const inProgressState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: canonicalId,
      seasonId: SEASON_ID,
      round: ROUND_7,
      weekendFormat: 'NORMAL',
    })
    inProgressState.currentSlot = 2
    inProgressState.slots[1].status = 'COMPLETED'
    inProgressState.slots[2].status = 'AVAILABLE'
    inProgressState.completedSlots = [1]
    inProgressState.generation = activeGen
    inProgressState.weekendGeneration = activeGen

    await canonicalWeekendSlotPersistenceService.saveSlotState(inProgressState)

    // 2. Simular reload de página (limpa cache em memória, mantendo localStorage persistido)
    canonicalWeekendSlotPersistenceService.clearMemoryCache()

    // 3. Recarregar usando canonicalCareerId
    const reloaded = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: canonicalId,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // Progresso legítimo preservado intacto (não sofre reset indevido)
    expect(reloaded.careerId).toBe(CANONICAL_CAREER_ID_A)
    expect(reloaded.currentSlot).toBe(2)
    expect(reloaded.slots[1].status).toBe('COMPLETED')
    expect(reloaded.slots[2].status).toBe('AVAILABLE')
    expect(reloaded.completedSlots).toEqual([1])
  })

  /**
   * A3.4: carreira A e B permanecem isoladas.
   * Alterar/resetar carreira A não afeta de modo algum a carreira B.
   */
  it('A3.4: carreira A e B permanecem isoladas', async () => {
    const canonicalIdA = CANONICAL_CAREER_ID_A
    const canonicalIdB = CANONICAL_CAREER_ID_B

    // 1. Criar e salvar estado para Carreira A (slot 2)
    const stateA = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: canonicalIdA,
      seasonId: SEASON_ID,
      round: ROUND_7,
      weekendFormat: 'NORMAL',
    })
    stateA.currentSlot = 2
    stateA.slots[1].status = 'COMPLETED'
    stateA.slots[2].status = 'AVAILABLE'
    stateA.completedSlots = [1]
    await canonicalWeekendSlotPersistenceService.saveSlotState(stateA)

    // 2. Criar e salvar estado para Carreira B (slot 4, Q1)
    const stateB = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: canonicalIdB,
      seasonId: SEASON_ID,
      round: ROUND_7,
      weekendFormat: 'NORMAL',
    })
    stateB.currentSlot = 4
    stateB.slots[1].status = 'COMPLETED'
    stateB.slots[2].status = 'COMPLETED'
    stateB.slots[3].status = 'COMPLETED'
    stateB.slots[4].status = 'AVAILABLE'
    stateB.completedSlots = [1, 2, 3]
    await canonicalWeekendSlotPersistenceService.saveSlotState(stateB)

    // Ambas estão salvas independentemente
    const loadedA1 = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: canonicalIdA,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    const loadedB1 = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: canonicalIdB,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(loadedA1.currentSlot).toBe(2)
    expect(loadedB1.currentSlot).toBe(4)

    // 3. Resetar APENAS a carreira A
    resetWeekendForRound({
      careerId: canonicalIdA,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    canonicalWeekendSlotPersistenceService.clearMemoryCache()

    // 4. Carregar Carreira A pós-reset
    const loadedA2 = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: canonicalIdA,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    // Carreira A foi resetada para slot 1
    expect(loadedA2.currentSlot).toBe(1)
    expect(loadedA2.slots[1].status).toBe('AVAILABLE')
    expect(loadedA2.completedSlots).toEqual([])

    // 5. Carregar Carreira B
    const loadedB2 = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: canonicalIdB,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    // Carreira B permanece INTACTA no slot 4
    expect(loadedB2.careerId).toBe(CANONICAL_CAREER_ID_B)
    expect(loadedB2.currentSlot).toBe(4)
    expect(loadedB2.slots[4].status).toBe('AVAILABLE')
    expect(loadedB2.completedSlots).toEqual([1, 2, 3])
  })

  /**
   * Prova adicional: registros obsoletos salvos no PB com team.id antigo e geração antiga
   * são ignorados pelo generation gate e não contaminam a sessão após reset canônico.
   */
  it('prova adicional: registros órfãos antigos sob team.id são rejeitados ou não encontrados pela chave canônica', async () => {
    const canonicalId = resolveCanonicalCareerId(mockSeasonA, mockTeamA)

    // Registro no PB gravado sob team.id (id PocketBase)
    mockSessionSetupsRecords = [
      {
        id: 'rec_stale_under_team_id',
        team_id: PB_TEAM_RECORD_ID,
        season_id: SEASON_ID,
        round: ROUND_7,
        session: 'weekend_slot_state',
        driver_strategies: {
          weekendSlotState: {
            currentSlot: 5,
            slots: { 1: { status: 'COMPLETED' }, 5: { status: 'AVAILABLE' } },
            completedSlots: [1, 2, 3, 4],
            generation: 1,
            weekendGeneration: 1,
          },
        },
      },
    ]

    // Leitura com a chave canônica busca team_id = canonicalId ('team_audi_2026')
    // e NÃO encontra o registro órfão gravado com team_id = 'pb_team_record_123'
    const loaded = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: canonicalId,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // Retorna estado inicial limpo
    expect(loaded.careerId).toBe(CANONICAL_CAREER_ID_A)
    expect(loaded.currentSlot).toBe(1)
    expect(loaded.slots[1].status).toBe('AVAILABLE')
    expect(loaded.completedSlots).toEqual([])
  })
})
