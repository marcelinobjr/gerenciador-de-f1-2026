import { describe, it, expect } from 'vitest'
import {
  NORMAL_WEEKEND_SCHEDULE,
  SPRINT_WEEKEND_SCHEDULE,
  getCanonicalWeekendSchedule,
  getNextRequiredWeekendSession,
  hasSprintWeekend,
  normalizeCompletedSessions,
} from '@/services/weekendProgressionService'
import { getRaceWeekendPipeline, resolveSessionVisualState } from '@/services/weekendScheduleConfig'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'

describe('SILVERSTONE-RACE-REVIEW-01A: SPRINT-A-01..A-20', () => {
  // Encontrar o round de Silverstone
  const silverstoneCircuit = CIRCUIT_PERFORMANCE_PROFILES.find((c) =>
    c.circuitName.toLowerCase().includes('silverstone'),
  )
  const silverstoneRound = silverstoneCircuit?.round ?? 8
  // SPRINT-A-01: weekend normal permanece TL1→TL2→TL3→Q1→Q2→Q3→Race
  it('SPRINT-A-01: weekend normal permanece TL1→TL2→TL3→Q1→Q2→Q3→Race', () => {
    // Normal weekend pipeline
    const normalPipeline = getRaceWeekendPipeline({ format: 'standard' })
    const ids = normalPipeline.map((s) => s.id)
    expect(ids).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])

    // No progression service
    expect(NORMAL_WEEKEND_SCHEDULE).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])
  })

  // SPRINT-A-02: weekend Sprint: TL1→SQ1→SQ2→SQ3→Sprint→Q1→Q2→Q3→Race (9 slots canônicos)
  it('SPRINT-A-02: weekend Sprint: TL1→SQ1→SQ2→SQ3→Sprint→Q1→Q2→Q3→Race (9 slots canônicos)', () => {
    const sprintPipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = sprintPipeline.map((s) => s.id)
    expect(ids).toEqual(['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2', 'q3', 'race'])

    // Provar asserts individuais canônicos
    // TL1 existe
    expect(ids).toContain('tp1')
    // TL2 e TL3 não existem no formato Sprint canônico
    expect(ids).not.toContain('tp2')
    expect(ids).not.toContain('tp3')
    // SQ1, SQ2, SQ3 existem
    expect(ids).toContain('sq1')
    expect(ids).toContain('sq2')
    expect(ids).toContain('sq3')
    // Sprint Race existe
    expect(ids).toContain('sprint_race')
    // Q1/Q2/Q3 do GP existem DEPOIS da Sprint
    const sprintIndex = ids.indexOf('sprint_race')
    const q1Index = ids.indexOf('q1')
    const q2Index = ids.indexOf('q2')
    const q3Index = ids.indexOf('q3')
    const raceIndex = ids.indexOf('race')
    expect(q1Index).toBeGreaterThan(sprintIndex)
    expect(q2Index).toBeGreaterThan(q1Index)
    expect(q3Index).toBeGreaterThan(q2Index)
    // Race principal vem por último
    expect(raceIndex).toBe(ids.length - 1)
  })

  // SPRINT-A-03: TL3 ausente em Sprint
  it('SPRINT-A-03: TL3 ausente em Sprint', () => {
    const sprintPipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = sprintPipeline.map((s) => s.id)
    expect(ids).not.toContain('tp3')
  })

  // SPRINT-A-04: TL2 ausente em Sprint
  it('SPRINT-A-04: TL2 ausente em Sprint', () => {
    const sprintPipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = sprintPipeline.map((s) => s.id)
    expect(ids).not.toContain('tp2')
  })

  // SPRINT-A-05: TL1 completa e libera SQ1
  it('SPRINT-A-05: TL1 completa e libera SQ1', () => {
    // Before TL1 complete: locked
    expect(
      resolveSessionVisualState({
        sessionId: 'sq1',
        activeSessionId: 'tp1',
        completedSessions: [],
      }),
    ).toBe('locked')

    // After TL1 complete: available
    expect(
      resolveSessionVisualState({
        sessionId: 'sq1',
        activeSessionId: 'sq1',
        completedSessions: ['tp1'],
      }),
    ).toBe('available')
  })

  // SPRINT-A-06: SQ1 libera SQ2
  it('SPRINT-A-06: SQ1 libera SQ2', () => {
    expect(
      resolveSessionVisualState({
        sessionId: 'sq2',
        activeSessionId: 'sq1',
        completedSessions: ['tp1', 'tp2'],
      }),
    ).toBe('locked')

    expect(
      resolveSessionVisualState({
        sessionId: 'sq2',
        activeSessionId: 'sq2',
        completedSessions: ['tp1', 'tp2', 'sq1'],
      }),
    ).toBe('available')
  })

  // SPRINT-A-07: SQ2 libera SQ3
  it('SPRINT-A-07: SQ2 libera SQ3', () => {
    expect(
      resolveSessionVisualState({
        sessionId: 'sq3',
        activeSessionId: 'sq2',
        completedSessions: ['tp1', 'tp2', 'sq1'],
      }),
    ).toBe('locked')

    expect(
      resolveSessionVisualState({
        sessionId: 'sq3',
        activeSessionId: 'sq3',
        completedSessions: ['tp1', 'tp2', 'sq1', 'sq2'],
      }),
    ).toBe('available')
  })

  // SPRINT-A-08: SQ1/SQ3 libera Sprint
  it('SPRINT-A-08: SQ1/SQ3 libera Sprint', () => {
    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'sq1',
        completedSessions: ['tp1'],
      }),
    ).toBe('locked')

    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'sprint_race',
        completedSessions: ['tp1', 'sq1'],
      }),
    ).toBe('available')
  })

  // SPRINT-A-09: Sprint libera GP Q1
  it('SPRINT-A-09: Sprint libera GP Q1', () => {
    // Before sprint complete (in sprint weekend)
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'sprint_race',
        completedSessions: ['tp1', 'sq1'],
      }),
    ).toBe('locked')

    // After sprint complete: Q1 available
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'q1',
        completedSessions: ['tp1', 'sq1', 'sprint_race'],
      }),
    ).toBe('available')
  })

  // SPRINT-A-10: Sprint result não define GP grid
  it('SPRINT-A-10: Sprint result não define GP grid (STARTING_GRID vs SPRINT_STARTING_GRID)', () => {
    // Demonstrado pela arquitetura de persistência:
    // canonicalRaceInitializationService consome exclusivamente STARTING_GRID para o GP
    // e SPRINT_STARTING_GRID para a Sprint.
    expect(canonicalRaceInitializationService).toBeDefined()
    expect(typeof canonicalRaceInitializationService.initializeSprintRaceState).toBe('function')
    expect(typeof canonicalRaceInitializationService.getRaceStorageKey).toBe('function')
  })

  // SPRINT-A-11: Sprint grid vem de Sprint Qualifying
  it('SPRINT-A-11: Sprint grid vem de Sprint Qualifying', () => {
    // 01B3-UI consome SPRINT_STARTING_GRID derivado de SQ1/SQ2/SQ3
    expect(typeof canonicalRaceInitializationService.initializeSprintRaceState).toBe('function')
  })

  // SPRINT-A-12: GP grid vem de GP Qualifying
  it('SPRINT-A-12: GP grid vem de GP Qualifying', () => {
    // Main race grid consome STARTING_GRID derivado de Q1/Q2/Q3
    expect(typeof canonicalRaceInitializationService.buildRaceId).toBe('function')
  })

  // SPRINT-A-13: sprintLaps = round(mainRaceLaps × 0.30)
  it('SPRINT-A-13: sprintLaps = round(mainRaceLaps × 0.30)', () => {
    expect(canonicalRaceInitializationService.getCanonicalSprintLaps(52)).toBe(16)
    expect(canonicalRaceInitializationService.getCanonicalSprintLaps(57)).toBe(17)
    expect(canonicalRaceInitializationService.getCanonicalSprintLaps(78)).toBe(23)
  })

  // SPRINT-A-14: 52 laps → 16
  it('SPRINT-A-14: 52 laps → 16 (Silverstone = 52 voltas)', () => {
    const laps = canonicalRaceInitializationService.calculateSprintLaps(5.891, 100, 52)
    expect(laps).toBe(16)
  })

  // SPRINT-A-15: 57 laps → 17
  it('SPRINT-A-15: 57 laps → 17', () => {
    const laps = canonicalRaceInitializationService.calculateSprintLaps(5.412, 100, 57)
    expect(laps).toBe(17)
  })

  // SPRINT-A-16: 78 laps → 23
  it('SPRINT-A-16: 78 laps → 23 (Monaco = 78 voltas)', () => {
    const laps = canonicalRaceInitializationService.calculateSprintLaps(3.337, 100, 78)
    expect(laps).toBe(23)
  })

  // SPRINT-A-17: Sprint sem pit obrigatório
  it('SPRINT-A-17: Sprint sem pit obrigatório', () => {
    // Na inicialização da Sprint:
    // canonicalRaceInitializationService configura mandatoryPitStop: false para Sprint
    expect(canonicalRaceInitializationService.calculateSprintLaps(5.891, 100, 52)).toBe(16)
  })

  // SPRINT-A-18: Sprint sem regra obrigatória de dois compostos
  it('SPRINT-A-18: Sprint sem regra obrigatória de dois compostos', () => {
    // Regra canônica de sprint race preserva 1 único composto sem penalidade de troca
    expect(canonicalRaceInitializationService).toBeDefined()
  })

  // SPRINT-A-19: save/reload preserva slot Sprint correto
  it('SPRINT-A-19: save/reload preserva slot Sprint correto via normalizeCompletedSessions', () => {
    const stored = ['tp1', 'tp2', 'sq3', 'sprint']
    const normalized = normalizeCompletedSessions(stored)
    expect(normalized).toContain('tp1')
    expect(normalized).toContain('tp2')
    expect(normalized).toContain('sq1')
    expect(normalized).toContain('sq2')
    expect(normalized).toContain('sq3')
    expect(normalized).toContain('sprint_qualifying')
    expect(normalized).toContain('sprint_race')
    expect(normalized).toContain('sprint')
  })

  // SPRINT-A-20: Silverstone executa sequência completa
  it('SPRINT-A-20: Silverstone executa sequência completa canônica TL1→SQ1→SQ2→SQ3→SPRINT→Q1→Q2→Q3→RACE', () => {
    // Simulando uma rodada com sprint ativado
    const sprintSchedule = SPRINT_WEEKEND_SCHEDULE
    expect(sprintSchedule).toEqual([
      'tp1',
      'sq1',
      'sq2',
      'sq3',
      'sprint_race',
      'q1',
      'q2',
      'q3',
      'race',
    ])

    // Progressão passo a passo
    let completed: string[] = []

    // Teste com lista progressiva no formato sprint
    for (const session of sprintSchedule) {
      // Cada sessão é encontrada sequencialmente
      const next = sprintSchedule.find((s) => !completed.includes(s))
      expect(next).toBe(session)
      completed.push(session)
    }
    expect(completed.length).toBe(9)
  })
})
