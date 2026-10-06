import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
import {
  resetWeekendForRound,
  getActiveWeekendGeneration,
} from '@/services/weekendProgressionService'
import pb from '@/lib/pocketbase/client'
import type { CanonicalWeekendSlotState } from '@/types/weekend-slot-types'

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

describe('BUG-TL1-RELEASE-LOCK-01A2 — GENERATION GATE NO weekend_slot_state DO POCKETBASE', () => {
  const CAREER_A = 'career_audi_2026'
  const SEASON_ID = 'season_2026'
  const ROUND_7 = 7

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
    currentSlot: 4
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
   * A2.1 — estado PB de generation antiga
   * Preparar:
   * - generation antiga G1;
   * - salvar weekend_slot_state avançado no PB;
   * - reset criar/ativar generation G2;
   * - memória/localStorage limpos.
   * Ler novamente.
   * Esperado:
   * - estado G1 rejeitado;
   * - createInitialState;
   * - TL1 AVAILABLE;
   * - currentSlot = 1.
   */
  it('A2.1 — estado PB de generation antiga: rejeita estado G1 pós-reset e inicia TL1 AVAILABLE', async () => {
    // 1. Generation baseline G1 = 1
    const g1 = getActiveWeekendGeneration(SEASON_ID, ROUND_7, CAREER_A)
    expect(g1).toBe(1)

    // 2. Estado avançado (currentSlot = 4) registrado com generation G1 = 1 no PB
    const advancedG1 = createAdvancedSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
      currentSlot: 4,
      generation: g1,
    })

    mockSessionSetupsRecords = [
      {
        id: 'rec_slot_g1',
        team_id: CAREER_A,
        season_id: SEASON_ID,
        round: ROUND_7,
        session: 'weekend_slot_state',
        driver_strategies: {
          weekendSlotState: advancedG1,
        },
      },
    ]

    // 3. Reset cria/ativa generation G2 = 2
    const resetResult = resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(resetResult.success).toBe(true)
    const g2 = getActiveWeekendGeneration(SEASON_ID, ROUND_7, CAREER_A)
    expect(g2).toBe(2)

    // 4. Memória e localStorage limpos
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
    localStorage.removeItem(`apex_weekend_slot_state_v1_${CAREER_A}_${SEASON_ID}_r${ROUND_7}`)

    // 5. Ler novamente através de loadOrMigrateSlotState
    const state = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // Esperado: estado G1 rejeitado, createInitialState gerado
    expect(state.currentSlot).toBe(1)
    expect(state.slots[1].status).toBe('AVAILABLE')
    expect(state.slots[1].slotType).toBe('TL1')
    expect(state.slots[2].status).toBe('LOCKED')
    expect(state.completedSlots).toEqual([])
    expect(state.weekendGeneration).toBe(2)
  })

  /**
   * A2.2 — mesma generation
   * Persistir estado válido com generation G2.
   * Ler com G2 ativa.
   * Esperado:
   * - estado restaurado integralmente;
   * - não resetar indevidamente progresso legítimo.
   */
  it('A2.2 — mesma generation: estado válido restaurado integralmente sem descartar progresso', async () => {
    // 1. Reset para colocar na geração G2 = 2
    resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    const g2 = getActiveWeekendGeneration(SEASON_ID, ROUND_7, CAREER_A)
    expect(g2).toBe(2)

    // 2. Persistir estado com generation G2 no PocketBase
    const advancedG2 = createAdvancedSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
      currentSlot: 4,
      generation: g2,
    })

    mockSessionSetupsRecords = [
      {
        id: 'rec_slot_g2',
        team_id: CAREER_A,
        season_id: SEASON_ID,
        round: ROUND_7,
        session: 'weekend_slot_state',
        driver_strategies: {
          weekendSlotState: advancedG2,
        },
      },
    ]

    // Limpar cache em memória e localStorage para forçar busca exclusiva no PB
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
    localStorage.removeItem(`apex_weekend_slot_state_v1_${CAREER_A}_${SEASON_ID}_r${ROUND_7}`)

    // 3. Ler com G2 ativa
    const state = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // Esperado: estado restaurado integralmente
    expect(state.currentSlot).toBe(4)
    expect(state.slots[4].status).toBe('AVAILABLE')
    expect(state.completedSlots).toEqual([1, 2, 3])
    expect(state.weekendGeneration).toBe(2)
  })

  /**
   * A2.3 — reload pós-reset
   * Simular reset + reload completo, sem cache em memória.
   * PocketBase ainda contém o estado antigo.
   * Esperado:
   * - PB antigo não ressuscita o weekend;
   * - TL1 nasce AVAILABLE.
   */
  it('A2.3 — reload pós-reset: PB antigo não ressuscita o weekend, TL1 nasce AVAILABLE', async () => {
    // 1. PB possui registro antigo com generation 1 e currentSlot 5
    const oldPbState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
      weekendFormat: 'NORMAL',
    })
    oldPbState.currentSlot = 5
    oldPbState.completedSlots = [1, 2, 3, 4]
    oldPbState.generation = 1
    oldPbState.weekendGeneration = 1

    mockSessionSetupsRecords = [
      {
        id: 'rec_old_canada',
        team_id: CAREER_A,
        season_id: SEASON_ID,
        round: ROUND_7,
        session: 'weekend_slot_state',
        driver_strategies: {
          weekendSlotState: oldPbState,
        },
      },
    ]

    // 2. Executa reset da rodada
    resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // 3. Simula reload completo da página/browser (limpeza de memória e instâncias)
    canonicalWeekendSlotPersistenceService.clearMemoryCache()

    // 4. Carrega estado como aconteceria no mount de WeekendV2Page
    const reloadedState = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // PB antigo NÃO ressuscita o weekend, TL1 nasce AVAILABLE
    expect(reloadedState.currentSlot).toBe(1)
    expect(reloadedState.slots[1].status).toBe('AVAILABLE')
    expect(reloadedState.slots[1].slotType).toBe('TL1')
    expect(reloadedState.completedSlots).toEqual([])
  })

  /**
   * A2.4 — estado legítimo não é descartado
   * Weekend em andamento, sem reset, generation compatível.
   * Reload.
   * Esperado:
   * - slot atual/status preservados.
   */
  it('A2.4 — estado legítimo não é descartado: reload sem reset preserva slot atual e status', async () => {
    // 1. Generation ativa atual é baseline = 1
    const currentGen = getActiveWeekendGeneration(SEASON_ID, ROUND_7, CAREER_A)
    expect(currentGen).toBe(1)

    // 2. Criar estado em andamento (ex: TL1 e TL2 concluídos, TL3 AVAILABLE no slot 3)
    const inProgressState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
      weekendFormat: 'NORMAL',
    })
    inProgressState.currentSlot = 3
    inProgressState.slots[1].status = 'COMPLETED'
    inProgressState.slots[2].status = 'COMPLETED'
    inProgressState.slots[3].status = 'AVAILABLE'
    inProgressState.completedSlots = [1, 2]
    inProgressState.generation = currentGen
    inProgressState.weekendGeneration = currentGen

    mockSessionSetupsRecords = [
      {
        id: 'rec_in_progress',
        team_id: CAREER_A,
        season_id: SEASON_ID,
        round: ROUND_7,
        session: 'weekend_slot_state',
        driver_strategies: {
          weekendSlotState: inProgressState,
        },
      },
    ]

    // 3. Simular reload (limpar memória)
    canonicalWeekendSlotPersistenceService.clearMemoryCache()

    // 4. Carregar estado
    const loaded = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })

    // Esperado: preservado integralmente
    expect(loaded.currentSlot).toBe(3)
    expect(loaded.slots[3].status).toBe('AVAILABLE')
    expect(loaded.completedSlots).toEqual([1, 2])
    expect(loaded.weekendGeneration).toBe(1)
  })

  /**
   * A2.5 — Política aplicada a registro legado (sem generation explícita)
   * Se a rodada estiver na generation baseline (1), aceita.
   * Se a rodada já avançou generation por reset (> 1), rejeita e cria initial state.
   */
  it('A2.5 — registro legado sem generation: aceito em baseline 1, rejeitado após reset > 1', async () => {
    // Caso 1: Baseline 1 (sem reset) -> registro legado é aceito
    const legacyState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
      weekendFormat: 'NORMAL',
    })
    legacyState.currentSlot = 2
    legacyState.completedSlots = [1]
    delete (legacyState as any).generation
    delete (legacyState as any).weekendGeneration

    mockSessionSetupsRecords = [
      {
        id: 'rec_legacy',
        team_id: CAREER_A,
        season_id: SEASON_ID,
        round: ROUND_7,
        session: 'weekend_slot_state',
        driver_strategies: {
          weekendSlotState: legacyState,
        },
      },
    ]

    const baselineLoaded = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(baselineLoaded.currentSlot).toBe(2)
    expect(baselineLoaded.weekendGeneration).toBe(1)

    // Caso 2: Rodada avança por reset (gen = 2) -> mesmo registro legado no PB é rejeitado
    resetWeekendForRound({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
    localStorage.removeItem(`apex_weekend_slot_state_v1_${CAREER_A}_${SEASON_ID}_r${ROUND_7}`)

    const postResetLoaded = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: CAREER_A,
      seasonId: SEASON_ID,
      round: ROUND_7,
    })
    expect(postResetLoaded.currentSlot).toBe(1)
    expect(postResetLoaded.slots[1].status).toBe('AVAILABLE')
    expect(postResetLoaded.completedSlots).toEqual([])
    expect(postResetLoaded.weekendGeneration).toBe(2)
  })
})
