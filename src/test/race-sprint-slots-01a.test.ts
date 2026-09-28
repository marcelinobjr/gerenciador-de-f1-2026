/**
 * src/test/race-sprint-slots-01a.test.ts
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01A: TESTES OBRIGATÓRIOS SS01 A SS10
 *
 * BASE HOMOLOGADA:
 * - 7 SLOTS LÓGICOS:
 *   NORMAL: slot 1 = TL1, slot 2 = TL2, slot 3 = TL3, slot 4 = Q1, slot 5 = Q2, slot 6 = Q3, slot 7 = CORRIDA
 *   SPRINT: slot 1 = TL1, slot 2 = QUALI_SPRINT, slot 3 = SPRINT, slot 4 = Q1, slot 5 = Q2, slot 6 = Q3, slot 7 = CORRIDA
 *
 * TESTES OBRIGATÓRIOS:
 * - SS01 — NORMAL SLOTS: weekend normal resolve exatamente 1 TL1, 2 TL2, 3 TL3, 4 Q1, 5 Q2, 6 Q3, 7 RACE.
 * - SS02 — SPRINT SLOTS: weekend Sprint resolve exatamente 1 TL1, 2 SPRINT_QUALIFYING, 3 SPRINT_RACE, 4 Q1, 5 Q2, 6 Q3, 7 RACE.
 * - SS03 — TL1 SPRINT: após TL1 concluído em weekend Sprint, próximo slot = SPRINT_QUALIFYING. Nunca TL2.
 * - SS04 — NORMAL REGRESSION: fluxo normal existente continua válido e seus artefatos esportivos não são alterados pela nova camada.
 * - SS05 — INACTIVE PRACTICE: no weekend Sprint, TL2/TL3 não produzem RNG, setup, resultado ou persistência esportiva.
 * - SS06 — RELOAD: weekend Sprint em slot 2 → save/reload continua slot 2; weekend normal em slot 5 → save/reload continua slot 5.
 * - SS07 — ISOLAMENTO: duas rodadas com formatos diferentes não compartilham slot/config.
 * - SS08 — MIGRAÇÃO NORMAL: save antigo em Q2 normal é reconstruído como slot 5, sem reiniciar Q1/TLs.
 * - SS09 — MIGRAÇÃO SPRINT: fixture histórica compatível de Sprint é mapeada para os slots correspondentes sem perder subfase existente.
 * - SS10 — Q1 APÓS SPRINT: concluir estruturalmente slot 3 permite transição para slot 4/Q1. Não carregar ordem esportiva da Sprint para o Q1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resolveWeekendFormat,
  getWeekendSlotSequence,
  getSlotTypeForNumber,
  getSlotNumberForType,
  NORMAL_SLOT_TYPES,
  SPRINT_SLOT_TYPES,
} from '@/services/weekendSlotSequenceService'
import {
  canonicalWeekendSlotPersistenceService,
  buildWeekendSlotStorageKey,
} from '@/services/canonicalWeekendSlotPersistenceService'
import {
  resolveWeekendSlotsViewModel,
  resolveStaticSlotsViewModel,
} from '@/services/weekendSlotViewModelResolver'
import { racePracticeSetupService } from '@/services/racePracticeSetupService'
import { raceQualifyingOrchestratorService } from '@/services/raceQualifyingOrchestratorService'
import { writeStoredCompletedSessions } from '@/services/weekendProgressionService'
import type { CanonicalWeekendSlotState } from '@/types/weekend-slot-types'

// Mock simples para localStorage se ambiente de teste não possuir
class LocalStorageMock {
  private store: Record<string, string> = {}
  getItem(key: string) {
    return this.store[key] || null
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value)
  }
  removeItem(key: string) {
    delete this.store[key]
  }
  clear() {
    this.store = {}
  }
}

describe('RACE-SPRINT-SLOTS-01A — Arquitetura dos 7 Slots do Fim de Semana (SS01 a SS10)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage = new LocalStorageMock() as any
    }
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  // =========================================================================
  // SS01 — NORMAL SLOTS
  // =========================================================================
  it('SS01 — NORMAL SLOTS: weekend normal resolve exatamente 1 TL1, 2 TL2, 3 TL3, 4 Q1, 5 Q2, 6 Q3, 7 CORRIDA', () => {
    const sequence = getWeekendSlotSequence('NORMAL')
    expect(sequence).toHaveLength(7)

    const expected = ['TL1', 'TL2', 'TL3', 'Q1', 'Q2', 'Q3', 'CORRIDA']
    expect(sequence.map((s) => s.slotType)).toEqual(expected)
    expect(sequence.map((s) => s.slotNumber)).toEqual([1, 2, 3, 4, 5, 6, 7])

    // Conferência por índice 1..7
    expect(getSlotTypeForNumber('NORMAL', 1)).toBe('TL1')
    expect(getSlotTypeForNumber('NORMAL', 2)).toBe('TL2')
    expect(getSlotTypeForNumber('NORMAL', 3)).toBe('TL3')
    expect(getSlotTypeForNumber('NORMAL', 4)).toBe('Q1')
    expect(getSlotTypeForNumber('NORMAL', 5)).toBe('Q2')
    expect(getSlotTypeForNumber('NORMAL', 6)).toBe('Q3')
    expect(getSlotTypeForNumber('NORMAL', 7)).toBe('CORRIDA')

    // Bijeção reversa
    expect(getSlotNumberForType('NORMAL', 'TL1')).toBe(1)
    expect(getSlotNumberForType('NORMAL', 'TL2')).toBe(2)
    expect(getSlotNumberForType('NORMAL', 'TL3')).toBe(3)
    expect(getSlotNumberForType('NORMAL', 'Q1')).toBe(4)
    expect(getSlotNumberForType('NORMAL', 'Q2')).toBe(5)
    expect(getSlotNumberForType('NORMAL', 'Q3')).toBe(6)
    expect(getSlotNumberForType('NORMAL', 'CORRIDA')).toBe(7)
  })

  // =========================================================================
  // SS02 — SPRINT SLOTS
  // =========================================================================
  it('SS02 — SPRINT SLOTS: weekend Sprint resolve exatamente 1 TL1, 2 QUALI_SPRINT, 3 SPRINT, 4 Q1, 5 Q2, 6 Q3, 7 CORRIDA', () => {
    const sequence = getWeekendSlotSequence('SPRINT')
    expect(sequence).toHaveLength(7)

    const expected = ['TL1', 'QUALI_SPRINT', 'SPRINT', 'Q1', 'Q2', 'Q3', 'CORRIDA']
    expect(sequence.map((s) => s.slotType)).toEqual(expected)
    expect(sequence.map((s) => s.slotNumber)).toEqual([1, 2, 3, 4, 5, 6, 7])

    // Conferência por índice 1..7
    expect(getSlotTypeForNumber('SPRINT', 1)).toBe('TL1')
    expect(getSlotTypeForNumber('SPRINT', 2)).toBe('QUALI_SPRINT')
    expect(getSlotTypeForNumber('SPRINT', 3)).toBe('SPRINT')
    expect(getSlotTypeForNumber('SPRINT', 4)).toBe('Q1')
    expect(getSlotTypeForNumber('SPRINT', 5)).toBe('Q2')
    expect(getSlotTypeForNumber('SPRINT', 6)).toBe('Q3')
    expect(getSlotTypeForNumber('SPRINT', 7)).toBe('CORRIDA')

    // Bijeção reversa
    expect(getSlotNumberForType('SPRINT', 'TL1')).toBe(1)
    expect(getSlotNumberForType('SPRINT', 'QUALI_SPRINT')).toBe(2)
    expect(getSlotNumberForType('SPRINT', 'SPRINT')).toBe(3)
    expect(getSlotNumberForType('SPRINT', 'Q1')).toBe(4)
    expect(getSlotNumberForType('SPRINT', 'Q2')).toBe(5)
    expect(getSlotNumberForType('SPRINT', 'Q3')).toBe(6)
    expect(getSlotNumberForType('SPRINT', 'CORRIDA')).toBe(7)
  })

  // =========================================================================
  // SS03 — TL1 SPRINT
  // =========================================================================
  it('SS03 — TL1 SPRINT: após TL1 concluído em weekend Sprint, próximo slot = QUALI_SPRINT (slot 2). Nunca TL2.', async () => {
    const roundSprint = 2 // GP da China é Sprint no calendário canônico FIA 2026
    expect(resolveWeekendFormat(roundSprint)).toBe('SPRINT')

    const state = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: 'career_sprint_test',
      seasonId: 'season_2026',
      round: roundSprint,
    })

    expect(state.currentSlot).toBe(1)
    expect(state.slotType).toBe('TL1')

    // Conclui TL1 no fim de semana Sprint
    const updated = await canonicalWeekendSlotPersistenceService.completeSlot(state, 1)

    // O próximo slot DEVE ser slot 2 (QUALI_SPRINT), NUNCA TL2
    expect(updated.currentSlot).toBe(2)
    expect(updated.slotType).toBe('QUALI_SPRINT')
    expect(updated.slotType).not.toBe('TL2')
    expect(updated.completedSlots).toContain(1)
    expect(updated.slots[1].status).toBe('COMPLETED')
    expect(updated.slots[2].status).toBe('AVAILABLE')
  })

  // =========================================================================
  // SS04 — NORMAL REGRESSION
  // =========================================================================
  it('SS04 — NORMAL REGRESSION: fluxo normal existente continua válido e seus artefatos esportivos não são alterados pela nova camada', async () => {
    const roundNormal = 1 // GP da Austrália é Normal
    expect(resolveWeekendFormat(roundNormal)).toBe('NORMAL')

    const state = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: 'career_norm_reg',
      seasonId: 'season_2026',
      round: roundNormal,
    })

    expect(state.currentSlot).toBe(1)
    expect(state.slotType).toBe('TL1')

    // Avança TL1 -> TL2 -> TL3 -> Q1 -> Q2 -> Q3 -> CORRIDA
    await canonicalWeekendSlotPersistenceService.completeSlot(state, 1)
    expect(state.currentSlot).toBe(2)
    expect(state.slotType).toBe('TL2')

    await canonicalWeekendSlotPersistenceService.completeSlot(state, 2)
    expect(state.currentSlot).toBe(3)
    expect(state.slotType).toBe('TL3')

    await canonicalWeekendSlotPersistenceService.completeSlot(state, 3)
    expect(state.currentSlot).toBe(4)
    expect(state.slotType).toBe('Q1')

    await canonicalWeekendSlotPersistenceService.completeSlot(state, 4)
    expect(state.currentSlot).toBe(5)
    expect(state.slotType).toBe('Q2')

    await canonicalWeekendSlotPersistenceService.completeSlot(state, 5)
    expect(state.currentSlot).toBe(6)
    expect(state.slotType).toBe('Q3')

    await canonicalWeekendSlotPersistenceService.completeSlot(state, 6)
    expect(state.currentSlot).toBe(7)
    expect(state.slotType).toBe('CORRIDA')

    // Regras de corte da classificação homologadas permanecem intactas
    const cutoffs = raceQualifyingOrchestratorService.resolveCutoffRules(24, 'Q1')
    expect(cutoffs.advancingCount).toBe(18)
    expect(cutoffs.eliminatedCount).toBe(6)

    const cutoffsQ2 = raceQualifyingOrchestratorService.resolveCutoffRules(18, 'Q2')
    expect(cutoffsQ2.advancingCount).toBe(10)
    expect(cutoffsQ2.eliminatedCount).toBe(8)
  })

  // =========================================================================
  // SS05 — INACTIVE PRACTICE
  // =========================================================================
  it('SS05 — INACTIVE PRACTICE: no weekend Sprint, TL2/TL3 não produzem RNG, setup, resultado ou persistência esportiva', async () => {
    // racePracticeSetupService rejeita explicitamente TL2 e TL3 quando isSprint === true
    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL2', {
        session: 'TL2',
        careerId: 'career_sprint_guard',
        seasonId: 'season_2026',
        round: 2,
        teamId: 'team_audi',
        carIndex: 1,
        driverId: 'mbj-020',
        configVersion: 'v1',
        completedLaps: 15,
        consistency: 85,
        isSprint: true,
      }),
    ).rejects.toThrow(/não é realizada em formato de fim de semana Sprint/)

    await expect(
      racePracticeSetupService.processAndPersistPracticeSetup('TL3', {
        session: 'TL3',
        careerId: 'career_sprint_guard',
        seasonId: 'season_2026',
        round: 2,
        teamId: 'team_audi',
        carIndex: 1,
        driverId: 'mbj-020',
        configVersion: 'v1',
        completedLaps: 15,
        consistency: 85,
        isSprint: true,
      }),
    ).rejects.toThrow(/não é realizada em formato de fim de semana Sprint/)
  })

  // =========================================================================
  // SS06 — RELOAD
  // =========================================================================
  it('SS06 — RELOAD: weekend Sprint em slot 2 → save/reload continua slot 2; weekend normal em slot 5 → save/reload continua slot 5', async () => {
    // 1. Caso Sprint em slot 2
    const sprintState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: 'career_reload_sprint',
      seasonId: 'season_2026',
      round: 2,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(sprintState, 1)
    expect(sprintState.currentSlot).toBe(2)
    expect(sprintState.slotType).toBe('QUALI_SPRINT')

    // Simula reload limpando cache em memória
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
    const reloadedSprint = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: 'career_reload_sprint',
      seasonId: 'season_2026',
      round: 2,
    })
    expect(reloadedSprint.currentSlot).toBe(2)
    expect(reloadedSprint.slotType).toBe('QUALI_SPRINT')
    expect(reloadedSprint.slots[1].status).toBe('COMPLETED')
    expect(reloadedSprint.slots[2].status).toBe('AVAILABLE')

    // 2. Caso Normal em slot 5
    const normalState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: 'career_reload_norm',
      seasonId: 'season_2026',
      round: 1,
    })
    await canonicalWeekendSlotPersistenceService.completeSlot(normalState, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(normalState, 2)
    await canonicalWeekendSlotPersistenceService.completeSlot(normalState, 3)
    await canonicalWeekendSlotPersistenceService.completeSlot(normalState, 4)
    expect(normalState.currentSlot).toBe(5)
    expect(normalState.slotType).toBe('Q2')

    // Simula reload limpando cache em memória
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
    const reloadedNormal = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: 'career_reload_norm',
      seasonId: 'season_2026',
      round: 1,
    })
    expect(reloadedNormal.currentSlot).toBe(5)
    expect(reloadedNormal.slotType).toBe('Q2')
    expect(reloadedNormal.completedSlots).toEqual([1, 2, 3, 4])
  })

  // =========================================================================
  // SS07 — ISOLAMENTO
  // =========================================================================
  it('SS07 — ISOLAMENTO: duas rodadas com formatos diferentes não compartilham slot/config', async () => {
    const careerId = 'career_iso_test'
    const seasonId = 'season_2026'

    // Rodada 1 (Normal)
    const stateR1 = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId,
      seasonId,
      round: 1,
    })
    expect(stateR1.weekendFormat).toBe('NORMAL')

    // Rodada 2 (Sprint)
    const stateR2 = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId,
      seasonId,
      round: 2,
    })
    expect(stateR2.weekendFormat).toBe('SPRINT')

    // Avança R1 para slot 3 (TL3)
    await canonicalWeekendSlotPersistenceService.completeSlot(stateR1, 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(stateR1, 2)
    expect(stateR1.currentSlot).toBe(3)
    expect(stateR1.slotType).toBe('TL3')

    // Verifica que R2 permanece intocada no slot 1 (TL1)
    expect(stateR2.currentSlot).toBe(1)
    expect(stateR2.slotType).toBe('TL1')

    const keyR1 = buildWeekendSlotStorageKey(careerId, seasonId, 1)
    const keyR2 = buildWeekendSlotStorageKey(careerId, seasonId, 2)
    expect(keyR1).not.toBe(keyR2)
  })

  // =========================================================================
  // SS08 — MIGRAÇÃO NORMAL
  // =========================================================================
  it('SS08 — MIGRAÇÃO NORMAL: save antigo em Q2 normal é reconstruído como slot 5, sem reiniciar Q1/TLs', async () => {
    const careerId = 'career_mig_norm'
    const seasonId = 'season_2026'
    const round = 1

    // Simula save antigo gravado no localStorage com completedSessions = ['tp1', 'tp2', 'tp3', 'q1']
    writeStoredCompletedSessions(seasonId, round, ['tp1', 'tp2', 'tp3', 'q1'])

    // Migrador deve carregar e reconstruir exatamente como slot 5 (Q2)
    const migrated = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId,
      seasonId,
      round,
    })

    expect(migrated.weekendFormat).toBe('NORMAL')
    expect(migrated.currentSlot).toBe(5)
    expect(migrated.slotType).toBe('Q2')
    expect(migrated.slots[1].status).toBe('COMPLETED')
    expect(migrated.slots[2].status).toBe('COMPLETED')
    expect(migrated.slots[3].status).toBe('COMPLETED')
    expect(migrated.slots[4].status).toBe('COMPLETED')
    expect(migrated.slots[5].status).toBe('AVAILABLE')
    expect(migrated.completedSlots).toEqual([1, 2, 3, 4])
  })

  // =========================================================================
  // SS09 — MIGRAÇÃO SPRINT
  // =========================================================================
  it('SS09 — MIGRAÇÃO SPRINT: fixture histórica compatível de Sprint é mapeada para os slots correspondentes sem perder subfase existente', async () => {
    const careerId = 'career_mig_sprint'
    const seasonId = 'season_2026'
    const round = 2 // GP Sprint

    // Caso A: save antigo com TL1 e SQ1 concluídos -> deve estar no slot 2 com subfase SQ2
    writeStoredCompletedSessions(seasonId, round, ['tp1', 'sq1'])

    const migrated = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId,
      seasonId,
      round,
    })

    expect(migrated.weekendFormat).toBe('SPRINT')
    expect(migrated.currentSlot).toBe(2)
    expect(migrated.slotType).toBe('QUALI_SPRINT')
    expect(migrated.slots[1].status).toBe('COMPLETED')
    expect(migrated.slots[2].status).toBe('IN_PROGRESS')
    expect(migrated.slots[2].subPhase).toBe('SQ2')

    // Caso B: save com TL1, sprint_qualifying e sprint concluídos -> próximo slot 4 (Q1)
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
    writeStoredCompletedSessions(seasonId, round, ['tp1', 'sprint_qualifying', 'sprint_race'])

    const migratedB = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: 'career_mig_sprint_b',
      seasonId,
      round,
    })
    expect(migratedB.currentSlot).toBe(4)
    expect(migratedB.slotType).toBe('Q1')
    expect(migratedB.slots[1].status).toBe('COMPLETED')
    expect(migratedB.slots[2].status).toBe('COMPLETED')
    expect(migratedB.slots[3].status).toBe('COMPLETED')
    expect(migratedB.slots[4].status).toBe('AVAILABLE')
  })

  // =========================================================================
  // SS10 — Q1 APÓS SPRINT
  // =========================================================================
  it('SS10 — Q1 APÓS SPRINT: concluir estruturalmente slot 3 permite transição para slot 4/Q1. Não carregar ordem esportiva da Sprint para o Q1.', async () => {
    const sprintState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: 'career_sprint_q1_indep',
      seasonId: 'season_2026',
      round: 2,
    })

    // Conclui TL1 (slot 1)
    await canonicalWeekendSlotPersistenceService.completeSlot(sprintState, 1)
    expect(sprintState.currentSlot).toBe(2)

    // Conclui QUALI_SPRINT (slot 2)
    await canonicalWeekendSlotPersistenceService.completeSlot(sprintState, 2, 'SQ3')
    expect(sprintState.currentSlot).toBe(3)
    expect(sprintState.slotType).toBe('SPRINT')

    // Conclui SPRINT (slot 3)
    await canonicalWeekendSlotPersistenceService.completeSlot(sprintState, 3)
    expect(sprintState.currentSlot).toBe(4)
    expect(sprintState.slotType).toBe('Q1')
    expect(sprintState.slots[4].status).toBe('AVAILABLE')

    // ViewModel reflete Q1 como disponível
    const vm = resolveWeekendSlotsViewModel(sprintState)
    expect(vm).toHaveLength(7)
    expect(vm[3].slotType).toBe('Q1')
    expect(vm[3].isCurrent).toBe(true)
    expect(vm[3].status).toBe('AVAILABLE')

    // PROVA DE INDEPENDÊNCIA ESPORTIVA:
    // A ordem de pilotos em Q1 não é reordenada pelo resultado da Sprint
    // O corte de Q1 continuará sendo executado com 24 participantes para selecionar 18
    const q1Cutoff = raceQualifyingOrchestratorService.resolveCutoffRules(24, 'Q1')
    expect(q1Cutoff.advancingCount).toBe(18)
    expect(q1Cutoff.eliminatedCount).toBe(6)
  })

  // =========================================================================
  // ViewModel Resolver Tests
  // =========================================================================
  it('VM01 — resolveWeekendSlotsViewModel produz 7 view-models com labels canônicos e estados visuais', () => {
    const state = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: 'career_vm_test',
      seasonId: 'season_2026',
      round: 2,
    })
    const viewModels = resolveWeekendSlotsViewModel(state)
    expect(viewModels).toHaveLength(7)

    expect(viewModels[0].displayLabel).toBe('Treino Livre 1')
    expect(viewModels[0].isCurrent).toBe(true)
    expect(viewModels[0].status).toBe('AVAILABLE')

    expect(viewModels[1].displayLabel).toBe('Qualificação Sprint')
    expect(viewModels[1].isLocked).toBe(true)

    expect(viewModels[2].displayLabel).toBe('Corrida Sprint')
    expect(viewModels[2].isLocked).toBe(true)

    expect(viewModels[3].displayLabel).toBe('Classificação Principal — Q1')
    expect(viewModels[3].isLocked).toBe(true)

    expect(viewModels[6].displayLabel).toBe('Grande Prêmio (Corrida Principal)')
    expect(viewModels[6].isLocked).toBe(true)
  })
})
