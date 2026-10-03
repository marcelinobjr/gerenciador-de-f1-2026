import { describe, it, expect } from 'vitest'
import {
  getRaceWeekendPipeline,
  isSessionUnlocked,
  SPRINT_WEEKEND_SCHEDULE_CONFIG,
} from '@/services/weekendScheduleConfig'
import {
  getCanonicalWeekendSchedule,
  getNextRequiredWeekendSession,
  normalizeCompletedSessions,
} from '@/services/weekendProgressionService'

describe('SPT-FMT: Quali Sprint em 3 fases (SQ1..SQ3) e Esteira de 9 slots (Fix C)', () => {
  it('SPT-FMT-01: Esteira Sprint tem exatamente 9 slots: TL1 -> SQ1 -> SQ2 -> SQ3 -> SPRINT -> Q1 -> Q2 -> Q3 -> CORRIDA', () => {
    const pipeline = getRaceWeekendPipeline({ format: 'sprint' })
    expect(pipeline).toHaveLength(9)

    const ids = pipeline.map((p) => p.id)
    expect(ids).toEqual(['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2', 'q3', 'race'])

    expect(SPRINT_WEEKEND_SCHEDULE_CONFIG.sessionIds).toEqual([
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

    const schedule = getCanonicalWeekendSchedule(2) // China round 2 is sprint
    expect(schedule).toEqual(['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2', 'q3', 'race'])
  })

  it('SPT-FMT-02: Progressão sequencial SQ1 -> SQ2 -> SQ3 -> SPRINT', () => {
    // Apenas TL1 concluído: SQ1 desbloqueada, SQ2 bloqueada, SQ3 bloqueada, Sprint bloqueada
    let completed = normalizeCompletedSessions(['tp1'])
    expect(isSessionUnlocked('sq1', completed)).toBe(true)
    expect(isSessionUnlocked('sq2', completed)).toBe(false)
    expect(isSessionUnlocked('sq3', completed)).toBe(false)
    expect(isSessionUnlocked('sprint_race', completed)).toBe(false)

    // SQ1 concluído: SQ2 desbloqueada, SQ3 bloqueada, Sprint bloqueada
    completed = normalizeCompletedSessions(['tp1', 'sq1'])
    expect(isSessionUnlocked('sq2', completed)).toBe(true)
    expect(isSessionUnlocked('sq3', completed)).toBe(false)
    expect(isSessionUnlocked('sprint_race', completed)).toBe(false)

    // SQ2 concluído: SQ3 desbloqueada, Sprint bloqueada
    completed = normalizeCompletedSessions(['tp1', 'sq1', 'sq2'])
    expect(isSessionUnlocked('sq3', completed)).toBe(true)
    expect(isSessionUnlocked('sprint_race', completed)).toBe(false)

    // SQ3 concluído: Sprint Race desbloqueada!
    completed = normalizeCompletedSessions(['tp1', 'sq1', 'sq2', 'sq3'])
    expect(isSessionUnlocked('sprint_race', completed)).toBe(true)
    expect(isSessionUnlocked('q1', completed)).toBe(false)

    // Sprint Race concluída: Q1 desbloqueada!
    completed = normalizeCompletedSessions(['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race'])
    expect(isSessionUnlocked('q1', completed)).toBe(true)
  })

  it('SPT-FMT-03: getNextRequiredWeekendSession avança corretamente pelos 9 slots na China R2', () => {
    expect(getNextRequiredWeekendSession(2, [])).toBe('tp1')
    expect(getNextRequiredWeekendSession(2, ['tp1'])).toBe('sq1')
    expect(getNextRequiredWeekendSession(2, ['tp1', 'sq1'])).toBe('sq2')
    expect(getNextRequiredWeekendSession(2, ['tp1', 'sq1', 'sq2'])).toBe('sq3')
    expect(getNextRequiredWeekendSession(2, ['tp1', 'sq1', 'sq2', 'sq3'])).toBe('sprint_race')
    expect(getNextRequiredWeekendSession(2, ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race'])).toBe('q1')
    expect(
      getNextRequiredWeekendSession(2, ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1']),
    ).toBe('q2')
    expect(
      getNextRequiredWeekendSession(2, ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2']),
    ).toBe('q3')
    expect(
      getNextRequiredWeekendSession(2, [
        'tp1',
        'sq1',
        'sq2',
        'sq3',
        'sprint_race',
        'q1',
        'q2',
        'q3',
      ]),
    ).toBe('race')
  })
})
