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

  // =========================================================================
  // BUG-SPRINT-CHINA-02: UNIFICAÇÃO DA ESTEIRA SPRINT (GATES DE UNLOCK)
  // =========================================================================

  // CFT06: no formato SPRINT, isSessionUnlocked('sq1') / resolveSessionVisualState('sq1') = available/active com apenas TL1 concluído (sem TL2 no pipeline).
  it('CFT06: no formato SPRINT, SQ1 está liberada com apenas TL1 concluído (sem TL2 no pipeline)', async () => {
    const { resolveSessionVisualState, isSessionUnlocked } =
      await import('@/services/weekendScheduleConfig')

    // Com apenas 'tp1' completado:
    const visualState = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'sq1',
      completedSessions: ['tp1'],
    })
    expect(visualState).toBe('active')

    // isSessionUnlocked('sq1') com ['tp1'] deve ser true
    expect(isSessionUnlocked('sq1', ['tp1'])).toBe(true)
  })

  // CFT07: progressão completa TL1 -> SQ -> Sprint -> Q1 -> Q2 -> Q3 -> Corrida sem slot travado/inexistente.
  it('CFT07: progressão completa TL1 -> SQ -> Sprint -> Q1 -> Q2 -> Q3 -> Corrida sem slot travado/inexistente', async () => {
    const { getRaceWeekendPipeline, isSessionUnlocked } =
      await import('@/services/weekendScheduleConfig')

    const pipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = pipeline.map((s) => s.id)

    // Pipeline Sprint canônico de 7 slots
    expect(ids).toEqual(['tp1', 'sq1', 'sprint_race', 'q1', 'q2', 'q3', 'race'])

    // Início: apenas tp1 liberado
    expect(isSessionUnlocked('tp1', [])).toBe(true)
    expect(isSessionUnlocked('sq1', [])).toBe(false)

    // Após tp1 concluído: sq1 liberada (sem TL2)
    const afterTp1 = ['tp1']
    expect(isSessionUnlocked('sq1', afterTp1)).toBe(true)
    expect(isSessionUnlocked('sprint_race', afterTp1)).toBe(false)

    // Após sq1 concluído (ou sq3/sprint_qualifying): sprint_race liberada
    const afterSq = ['tp1', 'sq1']
    expect(isSessionUnlocked('sprint_race', afterSq)).toBe(true)
    expect(isSessionUnlocked('q1', afterSq)).toBe(false)

    // Após sprint_race concluída: Q1 liberada
    const afterSprint = ['tp1', 'sq1', 'sprint_race']
    expect(isSessionUnlocked('q1', afterSprint)).toBe(true)
    expect(isSessionUnlocked('q2', afterSprint)).toBe(false)

    // Após Q1 concluída: Q2 liberada
    const afterQ1 = ['tp1', 'sq1', 'sprint_race', 'q1']
    expect(isSessionUnlocked('q2', afterQ1)).toBe(true)
    expect(isSessionUnlocked('q3', afterQ1)).toBe(false)

    // Após Q2 concluída: Q3 liberada
    const afterQ2 = ['tp1', 'sq1', 'sprint_race', 'q1', 'q2']
    expect(isSessionUnlocked('q3', afterQ2)).toBe(true)
    expect(isSessionUnlocked('race', afterQ2)).toBe(false)

    // Após Q3 concluída: race liberada
    const afterQ3 = ['tp1', 'sq1', 'sprint_race', 'q1', 'q2', 'q3']
    expect(isSessionUnlocked('race', afterQ3)).toBe(true)
  })

  // CFT08: formato MAIN preserva gates atuais (TL2 exigido onde já era exigido — não regredir).
  it('CFT08: formato MAIN preserva gates atuais (TL2 exige TL1, TL3 exige TL2, Q1 exige TL3)', async () => {
    const { getRaceWeekendPipeline, isSessionUnlocked } =
      await import('@/services/weekendScheduleConfig')

    const pipeline = getRaceWeekendPipeline({ format: 'standard' })
    const ids = pipeline.map((s) => s.id)
    expect(ids).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])

    // No formato MAIN:
    // tp2 requer tp1
    expect(isSessionUnlocked('tp2', [])).toBe(false)
    expect(isSessionUnlocked('tp2', ['tp1'])).toBe(true)

    // tp3 requer tp2
    expect(isSessionUnlocked('tp3', ['tp1'])).toBe(false)
    expect(isSessionUnlocked('tp3', ['tp1', 'tp2'])).toBe(true)

    // Q1 no MAIN requer tp3
    expect(isSessionUnlocked('q1', ['tp1', 'tp2'])).toBe(false)
    expect(isSessionUnlocked('q1', ['tp1', 'tp2', 'tp3'])).toBe(true)

    // Q2 requer Q1, Q3 requer Q2, Race requer Q3
    expect(isSessionUnlocked('q2', ['tp1', 'tp2', 'tp3', 'q1'])).toBe(true)
    expect(isSessionUnlocked('q3', ['tp1', 'tp2', 'tp3', 'q1', 'q2'])).toBe(true)
    expect(isSessionUnlocked('race', ['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3'])).toBe(true)
  })

  // CFT09: os 6 circuitos Sprint de 2026 resolvem pipeline sem undefined
  it('CFT09: os 6 circuitos Sprint de 2026 resolvem pipeline sem undefined', async () => {
    const { getRaceWeekendPipeline } = await import('@/services/weekendScheduleConfig')
    const { hasSprintWeekend } = await import('@/services/weekendProgressionService')

    const sprintCircuits = CIRCUIT_PERFORMANCE_PROFILES.filter((c) => c.hasSprint)
    expect(sprintCircuits).toHaveLength(6)

    for (const circuit of sprintCircuits) {
      expect(hasSprintWeekend(circuit.round)).toBe(true)
      const pipeline = getRaceWeekendPipeline({ format: 'sprint' })
      expect(pipeline).toHaveLength(7)
      expect(pipeline.every((sess) => sess !== undefined && sess !== null)).toBe(true)
      expect(pipeline.every((sess) => typeof sess.id === 'string')).toBe(true)
      expect(pipeline.every((sess) => typeof sess.shortLabel === 'string')).toBe(true)
      expect(pipeline.every((sess) => typeof sess.fullName === 'string')).toBe(true)
      const ids = pipeline.map((s) => s.id)
      expect(ids).toEqual(['tp1', 'sq1', 'sprint_race', 'q1', 'q2', 'q3', 'race'])
    }
  })

  // CFT09: os 6 circuitos Sprint de 2026 (China R2, Miami, Canadá, Silverstone + os demais do calendário) resolvem pipeline de 7 slots sem undefined.
  it('CFT09: os 6 circuitos Sprint de 2026 (China R2, Miami, Canadá, Silverstone + os demais do calendário) resolvem pipeline de 7 slots sem undefined', async () => {
    const { getRaceWeekendPipeline } = await import('@/services/weekendScheduleConfig')
    const sprintCircuits = CIRCUIT_PERFORMANCE_PROFILES.filter((c) => c.hasSprint)
    expect(sprintCircuits.length).toBe(6)

    for (const circuit of sprintCircuits) {
      const pipeline = getRaceWeekendPipeline({ format: 'sprint' })
      expect(pipeline).toHaveLength(7)
      expect(pipeline.every((sess) => sess !== undefined && sess !== null)).toBe(true)
      const ids = pipeline.map((s) => s.id)
      expect(ids).toEqual(['tp1', 'sq1', 'sprint_race', 'q1', 'q2', 'q3', 'race'])
    }
  })

  // =========================================================================
  // BUG-SQ1-NO-OP: TICK, SIMULATE REMAINING E HANDLERS DE QUALIFICAÇÃO SPRINT (SQ1-SQ3)
  // =========================================================================

  // CFT10: tick avança SQ1 (tempo diminui e voltas computadas)
  it('CFT10: tick avança SQ1 com delta temporal e computa voltas na qualificação Sprint', async () => {
    const { CanonicalQualifyingRunner } = await import('@/services/canonicalQualifyingRunner')
    const { CANONICAL_QUALIFYING_RULES } = await import('@/types/canonical-qualifying-types')

    const seasonId = 'season_cft10_test'
    const round = 2 // GP da China

    // Participantes simulados para SQ1
    const eligibleParticipants = Array.from({ length: 24 }, (_, idx) => ({
      id: `drv_${idx + 1}`,
      name: `Piloto ${idx + 1}`,
      speed: 80,
      consistency: 80,
      defense: 75,
      teamId: `team_${Math.floor(idx / 2) + 1}`,
      teamName: `Equipe ${Math.floor(idx / 2) + 1}`,
      teamColor: '#E10600',
      carNumber: idx + 1,
    }))

    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants,
      persistState: false,
    })

    expect(sq1Initial.stageId).toBe('sq1')
    expect(sq1Initial.timeRemainingSec).toBe(CANONICAL_QUALIFYING_RULES.sq1.durationSec)
    expect(sq1Initial.sessionDurationSec).toBe(12 * 60) // 720s

    // Coloca sessão em execução e libera carro 1 para a pista
    sq1Initial.status = 'running'
    const exitRes = CanonicalQualifyingRunner.orderCarExitToTrack(sq1Initial, 'car1')
    expect(exitRes.success).toBe(true)
    expect(sq1Initial.cars.car1.status).toBe('out_lap')

    const tickContext = {
      seasonId,
      round,
      gpName: 'Grande Prêmio da China',
      circuitName: 'Circuito Internacional de Xangai',
      lengthKm: 5.451,
      tireAbrasiveness: 3,
      weather: 'seco' as const,
      teamChassisRating: 80,
      teamEngineSupplier: 'Audi',
      teamName: 'Apex Racing',
      teamColor: '#E10600',
      drivers: [
        { id: 'drv_1', name: 'Piloto 1', speed: 85, consistency: 85, defense: 80 },
        { id: 'drv_2', name: 'Piloto 2', speed: 82, consistency: 82, defense: 78 },
      ],
      rivalDrivers: eligibleParticipants.slice(2),
    }

    // Avança vários ticks de delta 10s
    let state = sq1Initial
    for (let i = 0; i < 20; i++) {
      const tickRes = CanonicalQualifyingRunner.tick(state, 10, tickContext)
      state = tickRes.nextState
    }

    // O tempo restante deve ter diminuído
    expect(state.timeRemainingSec).toBeLessThan(CANONICAL_QUALIFYING_RULES.sq1.durationSec)
    expect(state.elapsedTimeSec).toBe(200)

    // O carro 1 progrediu de out_lap para flying_lap ou completou volta
    expect(['flying_lap', 'in_lap', 'garage']).toContain(state.cars.car1.status)
  })

  // CFT11: simulateRemaining completa SQ1 e registra stage
  it('CFT11: simulateRemainingSession completa SQ1, gera resultado oficial e salva stage', async () => {
    const { CanonicalQualifyingRunner } = await import('@/services/canonicalQualifyingRunner')
    const { canonicalQualifyingPersistenceService } =
      await import('@/services/canonicalQualifyingPersistenceService')

    const seasonId = 'season_cft11_test'
    const round = 2

    const eligibleParticipants = Array.from({ length: 24 }, (_, idx) => ({
      id: `drv_${idx + 1}`,
      name: `Piloto ${idx + 1}`,
      speed: 80,
      consistency: 80,
      defense: 75,
      teamId: `team_${Math.floor(idx / 2) + 1}`,
      teamName: `Equipe ${Math.floor(idx / 2) + 1}`,
      teamColor: '#E10600',
      carNumber: idx + 1,
    }))

    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants,
      persistState: true,
    })

    const tickContext = {
      seasonId,
      round,
      gpName: 'Grande Prêmio da China',
      circuitName: 'Circuito Internacional de Xangai',
      lengthKm: 5.451,
      tireAbrasiveness: 3,
      weather: 'seco' as const,
      teamChassisRating: 80,
      teamEngineSupplier: 'Audi',
      teamName: 'Apex Racing',
      teamColor: '#E10600',
      drivers: [
        { id: 'drv_1', name: 'Piloto 1', speed: 85, consistency: 85, defense: 80 },
        { id: 'drv_2', name: 'Piloto 2', speed: 82, consistency: 82, defense: 78 },
      ],
      rivalDrivers: eligibleParticipants.slice(2),
    }

    const res = CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    expect(res.nextState.status).toBe('completed')
    expect(res.nextState.timeRemainingSec).toBe(0)

    // Verifica persistência de estado e resultado
    const savedState = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'sq1')
    expect(savedState).not.toBeNull()
    expect(savedState?.status).toBe('completed')

    const savedResult = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      round,
      'sq1',
    )
    expect(savedResult).not.toBeNull()
    expect(savedResult?.stageId).toBe('sq1')
    expect(savedResult?.advancingDriverIds).toHaveLength(18) // 18 avançam no SQ1
    expect(savedResult?.eliminatedDriverIds).toHaveLength(6) // 6 eliminados no SQ1
  })

  // CFT13: com sq1 concluída, resolveSessionVisualState('sprint_race') ≠ 'locked' e a UI expõe ação de início
  it('CFT13: com sq1 concluída, resolveSessionVisualState("sprint_race") != "locked" e definição canônica é jogável', async () => {
    const { resolveSessionVisualState, isSessionUnlocked, CANONICAL_SESSION_DEFINITIONS } =
      await import('@/services/weekendScheduleConfig')

    const completed = ['tp1', 'sq1']
    const visualState = resolveSessionVisualState({
      sessionId: 'sprint_race',
      activeSessionId: 'sprint_race',
      completedSessions: completed,
    })

    // Deve estar disponível/ativo, não bloqueado
    expect(visualState).not.toBe('locked')
    expect(['available', 'active']).toContain(visualState)
    expect(isSessionUnlocked('sprint_race', completed)).toBe(true)

    // A definição canônica de sprint_race deve ser jogável no V2 e blockedMessage atualizada
    const sprintDef = CANONICAL_SESSION_DEFINITIONS['sprint_race']
    expect(sprintDef.isPlayableInV2).toBe(true)
    expect(sprintDef.blockedMessage).toBe('Disponível após conclusão da Qualificação Sprint (SQ1).')
  })

  it('CFT14_INNER', async () => {
    const { resolveSessionVisualState, isSessionUnlocked } =
      await import('@/services/weekendScheduleConfig')

    // 1. Sprint não abre antes da condição correta (apenas TL1 não libera Sprint)
    expect(isSessionUnlocked('sprint_race', ['tp1'])).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'sprint_race',
        completedSessions: ['tp1'],
      }),
    ).toBe('locked')

    // 2. Q1 não abre antes da conclusão da Sprint no fim de semana Sprint
    const beforeSprint = ['tp1', 'sq1']
    expect(isSessionUnlocked('q1', beforeSprint)).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'q1',
        completedSessions: beforeSprint,
      }),
    ).toBe('locked')

    // 3. Ao concluir a Sprint, Q1 é liberada pelo pipeline canônico
    const afterSprint = ['tp1', 'sq1', 'sprint_race']
    expect(isSessionUnlocked('q1', afterSprint)).toBe(true)
    const visualAfter = resolveSessionVisualState({
      sessionId: 'q1',
      activeSessionId: 'q1',
      completedSessions: afterSprint,
    })
    expect(visualAfter).not.toBe('locked')
    expect(['available', 'active']).toContain(visualAfter)

    // 4. Sessão concluída não volta ao estado locked e permanece concluída
    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'q1',
        completedSessions: afterSprint,
      }),
    ).toBe('completed')
  })

  // CFT12: SQ2 e SQ3 leem e consomem stages anteriores
  it('CFT12: SQ2 consome resultado de SQ1 (18 pilotos) e SQ3 consome de SQ2 (10 pilotos)', async () => {
    const { CanonicalQualifyingRunner } = await import('@/services/canonicalQualifyingRunner')
    const { canonicalQualifyingPersistenceService } =
      await import('@/services/canonicalQualifyingPersistenceService')

    const seasonId = 'season_cft12_test'
    const round = 2

    const all24Drivers = Array.from({ length: 24 }, (_, idx) => ({
      id: `drv_${idx + 1}`,
      name: `Piloto ${idx + 1}`,
      speed: 80,
      consistency: 80,
      defense: 75,
      teamId: `team_${Math.floor(idx / 2) + 1}`,
      teamName: `Equipe ${Math.floor(idx / 2) + 1}`,
      teamColor: '#E10600',
      carNumber: idx + 1,
    }))

    const tickContext = {
      seasonId,
      round,
      gpName: 'Grande Prêmio da China',
      circuitName: 'Circuito Internacional de Xangai',
      lengthKm: 5.451,
      tireAbrasiveness: 3,
      weather: 'seco' as const,
      teamChassisRating: 80,
      teamEngineSupplier: 'Audi',
      teamName: 'Apex Racing',
      teamColor: '#E10600',
      drivers: [
        { id: 'drv_1', name: 'Piloto 1', speed: 85, consistency: 85, defense: 80 },
        { id: 'drv_2', name: 'Piloto 2', speed: 82, consistency: 82, defense: 78 },
      ],
      rivalDrivers: all24Drivers.slice(2),
    }

    // 1. Executa e finaliza SQ1
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })

    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })

    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    expect(sq1Result).not.toBeNull()
    expect(sq1Result?.advancingDriverIds).toHaveLength(18)

    // Filtra participantes de SQ2 a partir dos aprovados em SQ1
    const sq2Participants = all24Drivers.filter((p) => sq1Result!.advancingDriverIds.includes(p.id))
    expect(sq2Participants).toHaveLength(18)

    // 2. Inicializa e finaliza SQ2
    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })

    expect(sq2State.stageId).toBe('sq2')
    expect(sq2State.leaderboard).toHaveLength(18)

    CanonicalQualifyingRunner.simulateRemainingSession(sq2State, tickContext, {
      persistState: true,
    })

    const sq2Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')
    expect(sq2Result).not.toBeNull()
    expect(sq2Result?.advancingDriverIds).toHaveLength(10) // 10 avançam no SQ2 para o SQ3

    // Filtra participantes de SQ3 a partir dos aprovados em SQ2
    const sq3Participants = all24Drivers.filter((p) => sq2Result!.advancingDriverIds.includes(p.id))
    expect(sq3Participants).toHaveLength(10)

    // 3. Inicializa SQ3
    const sq3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: true,
    })

    expect(sq3State.stageId).toBe('sq3')
    expect(sq3State.leaderboard).toHaveLength(10)
  })
})
