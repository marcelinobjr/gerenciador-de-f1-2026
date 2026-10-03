import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolveWeekendFormat,
  getWeekendSlotSequence,
  getWeekendSlotDefinition,
  getSlotTypeForNumber,
  getSlotNumberForType,
  NORMAL_SLOT_TYPES,
  SPRINT_SLOT_TYPES,
  CANONICAL_SPRINT_SLOT_DEFINITIONS,
  CANONICAL_NORMAL_SLOT_DEFINITIONS,
} from '@/services/weekendSlotSequenceService'
import {
  canonicalWeekendSlotPersistenceService,
  buildWeekendSlotStorageKey,
} from '@/services/canonicalWeekendSlotPersistenceService'
import {
  resolveWeekendSlotsViewModel,
  resolveStaticSlotsViewModel,
} from '@/services/weekendSlotViewModelResolver'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'
import type { WeekendSlotNumber, WeekendSlotType } from '@/types/weekend-slot-types'

// Mock para localStorage caso o ambiente de teste exija isolamento limpo
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

describe('BUG-SPRINT-CHINA: Sequência canônica de 7 slots para fim de semana Sprint', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).localStorage = new LocalStorageMock()
    }
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  // 1. A sequência do formato SPRINT tem exatamente 7 slots e TODOS têm definição canônica válida (nenhum undefined).
  it('1. A sequência do formato SPRINT tem exatamente 7 slots e NENHUM slot é undefined', () => {
    const sprintSequence = getWeekendSlotSequence('SPRINT')
    expect(sprintSequence).toHaveLength(7)

    // Todos os 7 elementos devem ser definidos e válidos
    sprintSequence.forEach((slotDef, index) => {
      expect(slotDef).toBeDefined()
      expect(slotDef.slotNumber).toBe((index + 1) as WeekendSlotNumber)
      expect(typeof slotDef.slotType).toBe('string')
      expect(typeof slotDef.displayLabel).toBe('string')
      expect(typeof slotDef.shortLabel).toBe('string')
    })

    // Garante que CANONICAL_SPRINT_SLOT_DEFINITIONS só possui 1..7 e nenhum undefined
    for (let slotNum = 1; slotNum <= 7; slotNum++) {
      const def = CANONICAL_SPRINT_SLOT_DEFINITIONS[slotNum as WeekendSlotNumber]
      expect(def).toBeDefined()
      expect(def.slotNumber).toBe(slotNum)
    }

    // Não existe slot 8
    expect((CANONICAL_SPRINT_SLOT_DEFINITIONS as any)[8]).toBeUndefined()
  })

  // 2. A sequência SPRINT é TL1, QUALI_SPRINT, SPRINT, Q1, Q2, Q3, CORRIDA — sem TL2.
  it('2. A sequência SPRINT é TL1, QUALI_SPRINT, SPRINT, Q1, Q2, Q3, CORRIDA — sem TL2', () => {
    const expectedSprintTypes: WeekendSlotType[] = [
      'TL1',
      'QUALI_SPRINT',
      'SPRINT',
      'Q1',
      'Q2',
      'Q3',
      'CORRIDA',
    ]

    expect([...SPRINT_SLOT_TYPES]).toEqual(expectedSprintTypes)
    expect(SPRINT_SLOT_TYPES).not.toContain('TL2')
    expect(SPRINT_SLOT_TYPES).not.toContain('TL3')

    const sprintSequence = getWeekendSlotSequence('SPRINT')
    const actualTypes = sprintSequence.map((s) => s.slotType)
    expect(actualTypes).toEqual(expectedSprintTypes)

    // Conferência direta por getSlotTypeForNumber
    expect(getSlotTypeForNumber('SPRINT', 1)).toBe('TL1')
    expect(getSlotTypeForNumber('SPRINT', 2)).toBe('QUALI_SPRINT')
    expect(getSlotTypeForNumber('SPRINT', 3)).toBe('SPRINT')
    expect(getSlotTypeForNumber('SPRINT', 4)).toBe('Q1')
    expect(getSlotTypeForNumber('SPRINT', 5)).toBe('Q2')
    expect(getSlotTypeForNumber('SPRINT', 6)).toBe('Q3')
    expect(getSlotTypeForNumber('SPRINT', 7)).toBe('CORRIDA')

    // Bijeção reversa por getSlotNumberForType
    expect(getSlotNumberForType('SPRINT', 'TL1')).toBe(1)
    expect(getSlotNumberForType('SPRINT', 'QUALI_SPRINT')).toBe(2)
    expect(getSlotNumberForType('SPRINT', 'SPRINT')).toBe(3)
    expect(getSlotNumberForType('SPRINT', 'Q1')).toBe(4)
    expect(getSlotNumberForType('SPRINT', 'Q2')).toBe(5)
    expect(getSlotNumberForType('SPRINT', 'Q3')).toBe(6)
    expect(getSlotNumberForType('SPRINT', 'CORRIDA')).toBe(7)
    expect(getSlotNumberForType('SPRINT', 'TL2')).toBeNull()
  })

  // 3. O fluxo de avanço do fim de semana sprint atravessa as 7 sessões sem slot indefinido, do TL1 até a corrida.
  it('3. Fluxo de avanço no GP da China (R2) percorre exatamente do TL1 até a CORRIDA sem crash', async () => {
    const roundChina = 2
    expect(resolveWeekendFormat(roundChina)).toBe('SPRINT')

    const state = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: 'china_career_test',
      seasonId: 'season_2026',
      round: roundChina,
    })

    expect(state.weekendFormat).toBe('SPRINT')
    expect(state.currentSlot).toBe(1)
    expect(state.slotType).toBe('TL1')
    expect(state.slotStatus).toBe('AVAILABLE')

    // ViewModel inicial
    const vm1 = resolveWeekendSlotsViewModel(state)
    expect(vm1).toHaveLength(7)
    expect(vm1[0].slotType).toBe('TL1')
    expect(vm1[0].isCurrent).toBe(true)
    expect(vm1[0].status).toBe('AVAILABLE')
    expect(vm1[1].slotType).toBe('QUALI_SPRINT')
    expect(vm1[1].isLocked).toBe(true)

    // Avança 1: Conclui TL1 (slot 1) -> deve ir para QUALI_SPRINT (slot 2)
    const afterTL1 = await canonicalWeekendSlotPersistenceService.completeSlot(state, 1)
    expect(afterTL1.currentSlot).toBe(2)
    expect(afterTL1.slotType).toBe('QUALI_SPRINT')
    expect(afterTL1.slotStatus).toBe('AVAILABLE')
    expect(afterTL1.slots[1].status).toBe('COMPLETED')
    expect(afterTL1.slots[2].status).toBe('AVAILABLE')

    // Avança 2: Conclui QUALI_SPRINT (slot 2) -> deve ir para SPRINT (slot 3)
    const afterQualiSprint = await canonicalWeekendSlotPersistenceService.completeSlot(state, 2)
    expect(afterQualiSprint.currentSlot).toBe(3)
    expect(afterQualiSprint.slotType).toBe('SPRINT')
    expect(afterQualiSprint.slotStatus).toBe('AVAILABLE')
    expect(afterQualiSprint.slots[2].status).toBe('COMPLETED')
    expect(afterQualiSprint.slots[3].status).toBe('AVAILABLE')

    // Avança 3: Conclui SPRINT (slot 3) -> deve ir para Q1 (slot 4)
    const afterSprint = await canonicalWeekendSlotPersistenceService.completeSlot(state, 3)
    expect(afterSprint.currentSlot).toBe(4)
    expect(afterSprint.slotType).toBe('Q1')
    expect(afterSprint.slotStatus).toBe('AVAILABLE')
    expect(afterSprint.slots[3].status).toBe('COMPLETED')
    expect(afterSprint.slots[4].status).toBe('AVAILABLE')

    // Avança 4: Conclui Q1 (slot 4) -> deve ir para Q2 (slot 5)
    const afterQ1 = await canonicalWeekendSlotPersistenceService.completeSlot(state, 4)
    expect(afterQ1.currentSlot).toBe(5)
    expect(afterQ1.slotType).toBe('Q2')
    expect(afterQ1.slotStatus).toBe('AVAILABLE')

    // Avança 5: Conclui Q2 (slot 5) -> deve ir para Q3 (slot 6)
    const afterQ2 = await canonicalWeekendSlotPersistenceService.completeSlot(state, 5)
    expect(afterQ2.currentSlot).toBe(6)
    expect(afterQ2.slotType).toBe('Q3')
    expect(afterQ2.slotStatus).toBe('AVAILABLE')

    // Avança 6: Conclui Q3 (slot 6) -> deve ir para CORRIDA (slot 7)
    const afterQ3 = await canonicalWeekendSlotPersistenceService.completeSlot(state, 6)
    expect(afterQ3.currentSlot).toBe(7)
    expect(afterQ3.slotType).toBe('CORRIDA')
    expect(afterQ3.slotStatus).toBe('AVAILABLE')

    // Avança 7: Conclui CORRIDA (slot 7) -> encerra fim de semana
    const afterRace = await canonicalWeekendSlotPersistenceService.completeSlot(state, 7)
    expect(afterRace.currentSlot).toBe(7)
    expect(afterRace.slotStatus).toBe('COMPLETED')
    expect(afterRace.completedSlots).toEqual([1, 2, 3, 4, 5, 6, 7])

    // ViewModel final íntegro com todos os 7 slots
    const vmFinal = resolveWeekendSlotsViewModel(afterRace)
    expect(vmFinal).toHaveLength(7)
    expect(vmFinal.every((s) => s.isCompleted)).toBe(true)
  })

  // 4. O formato MAIN (não-sprint) continua intacto (práticas TL1/TL2/TL3, quali Q1-Q3, corrida).
  it('4. O formato MAIN/NORMAL continua 100% intacto com 7 slots (TL1, TL2, TL3, Q1, Q2, Q3, CORRIDA)', () => {
    const expectedNormalTypes: WeekendSlotType[] = [
      'TL1',
      'TL2',
      'TL3',
      'Q1',
      'Q2',
      'Q3',
      'CORRIDA',
    ]

    expect([...NORMAL_SLOT_TYPES]).toEqual(expectedNormalTypes)

    const normalSequence = getWeekendSlotSequence('NORMAL')
    expect(normalSequence).toHaveLength(7)
    expect(normalSequence.map((s) => s.slotType)).toEqual(expectedNormalTypes)

    for (let i = 1; i <= 7; i++) {
      expect(getSlotTypeForNumber('NORMAL', i as WeekendSlotNumber)).toBe(
        expectedNormalTypes[i - 1],
      )
      expect(getSlotNumberForType('NORMAL', expectedNormalTypes[i - 1])).toBe(i)
    }
  })

  // 5. Os outros sprint weekends do calendário 2026 resolvem sequência válida.
  it('5. Todos os GPs Sprint do calendário 2026 resolvem formato SPRINT e sequência de 7 slots válidos', () => {
    const sprintCircuits = CIRCUIT_PERFORMANCE_PROFILES.filter((c) => c.hasSprint)

    // Calendário 2026 tem 6 sprints: China (R2), Miami (R6), Canadá (R7), Silverstone (R11), Holanda (R14), Cingapura (R18)
    expect(sprintCircuits.length).toBe(6)

    for (const circuit of sprintCircuits) {
      const format = resolveWeekendFormat(circuit.round)
      expect(format).toBe('SPRINT')

      const seqDefs = getWeekendSlotSequence(format)
      expect(seqDefs).toHaveLength(7)
      expect(seqDefs.every((def) => def !== undefined && def !== null)).toBe(true)

      const types = seqDefs.map((d) => d.slotType)
      expect(types).toEqual(['TL1', 'QUALI_SPRINT', 'SPRINT', 'Q1', 'Q2', 'Q3', 'CORRIDA'])
    }
  })
})
