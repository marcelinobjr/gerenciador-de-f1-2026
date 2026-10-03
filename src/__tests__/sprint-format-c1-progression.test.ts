import { describe, it, expect } from 'vitest'
import {
  SPRINT_WEEKEND_SCHEDULE,
  getCanonicalWeekendSchedule,
  getNextRequiredWeekendSession,
  hasSprintWeekend,
} from '@/services/weekendProgressionService'
import {
  getRaceWeekendPipeline,
  isSessionUnlocked,
  resolveSessionVisualState,
} from '@/services/weekendScheduleConfig'

describe('SPRINT-FDS-01-R4C1B: Sprint Format Progression Tests (C1-01..C1-09)', () => {
  const roundSprint = 2 // China (Sprint)
  const roundNormal = 1 // Bahrein (Normal)

  // C1-01: Sprint Weekend possui exatamente 9 slots tp1, sq1, sq2, sq3, sprint_race, q1, q2, q3, race.
  it('C1-01: Sprint Weekend possui exatamente 9 slots tp1, sq1, sq2, sq3, sprint_race, q1, q2, q3, race', () => {
    expect(hasSprintWeekend(roundSprint)).toBe(true)
    const schedule = getCanonicalWeekendSchedule(roundSprint)
    const expectedSessions = ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2', 'q3', 'race']

    expect(schedule).toHaveLength(9)
    expect(schedule).toEqual(expectedSessions)
    expect(SPRINT_WEEKEND_SCHEDULE).toEqual(expectedSessions)

    const pipeline = getRaceWeekendPipeline({ format: 'sprint' })
    expect(pipeline).toHaveLength(9)
    expect(pipeline.map((p) => p.id)).toEqual(expectedSessions)
  })

  // C1-02: TL1 concluída → SQ1 available.
  it('C1-02: TL1 concluída -> SQ1 available', () => {
    const completed = ['tp1']
    const nextSession = getNextRequiredWeekendSession(roundSprint, completed)
    expect(nextSession).toBe('sq1')

    const unlocked = isSessionUnlocked('sq1', completed, true)
    expect(unlocked).toBe(true)

    const visualState = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'sq1',
      completedSessions: completed,
      isSprintRound: true,
    })
    expect(visualState).toBe('active')

    const visualStateOther = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tp1',
      completedSessions: completed,
      isSprintRound: true,
    })
    expect(visualStateOther).toBe('available')
  })

  // C1-03: SQ1 concluída → SQ2 available.
  it('C1-03: SQ1 concluída -> SQ2 available', () => {
    const completed = ['tp1', 'sq1']
    const nextSession = getNextRequiredWeekendSession(roundSprint, completed)
    expect(nextSession).toBe('sq2')

    const unlocked = isSessionUnlocked('sq2', completed, true)
    expect(unlocked).toBe(true)

    const visualState = resolveSessionVisualState({
      sessionId: 'sq2',
      activeSessionId: 'tp1',
      completedSessions: completed,
      isSprintRound: true,
    })
    expect(visualState).toBe('available')
  })

  // C1-04: somente SQ1 concluída → Sprint NOT available.
  it('C1-04: somente SQ1 concluída -> Sprint NOT available', () => {
    const completed = ['tp1', 'sq1']
    const unlocked = isSessionUnlocked('sprint_race', completed, true)
    expect(unlocked).toBe(false)

    const visualState = resolveSessionVisualState({
      sessionId: 'sprint_race',
      activeSessionId: 'tp1',
      completedSessions: completed,
      isSprintRound: true,
    })
    expect(visualState).toBe('locked')
  })

  // C1-05: SQ2 concluída → SQ3 available.
  it('C1-05: SQ2 concluída -> SQ3 available', () => {
    const completed = ['tp1', 'sq1', 'sq2']
    const nextSession = getNextRequiredWeekendSession(roundSprint, completed)
    expect(nextSession).toBe('sq3')

    const unlocked = isSessionUnlocked('sq3', completed, true)
    expect(unlocked).toBe(true)

    const visualState = resolveSessionVisualState({
      sessionId: 'sq3',
      activeSessionId: 'tp1',
      completedSessions: completed,
      isSprintRound: true,
    })
    expect(visualState).toBe('available')
  })

  // C1-06: somente até SQ2 concluída → Sprint NOT available.
  it('C1-06: somente até SQ2 concluída -> Sprint NOT available', () => {
    const completed = ['tp1', 'sq1', 'sq2']
    const unlocked = isSessionUnlocked('sprint_race', completed, true)
    expect(unlocked).toBe(false)

    const visualState = resolveSessionVisualState({
      sessionId: 'sprint_race',
      activeSessionId: 'tp1',
      completedSessions: completed,
      isSprintRound: true,
    })
    expect(visualState).toBe('locked')
  })

  // C1-07: SQ3 concluída → Sprint available.
  it('C1-07: SQ3 concluída -> Sprint available', () => {
    const completed = ['tp1', 'sq1', 'sq2', 'sq3']
    const nextSession = getNextRequiredWeekendSession(roundSprint, completed)
    expect(nextSession).toBe('sprint_race')

    const unlocked = isSessionUnlocked('sprint_race', completed, true)
    expect(unlocked).toBe(true)

    const visualState = resolveSessionVisualState({
      sessionId: 'sprint_race',
      activeSessionId: 'tp1',
      completedSessions: completed,
      isSprintRound: true,
    })
    expect(visualState).toBe('available')
  })

  // C1-08: Sprint concluída → Q1 available em Sprint Weekend — prova que resolveSessionVisualState usa isSprintRound=true e NÃO exige tp2/tp3.
  it('C1-08: Sprint concluída -> Q1 available em Sprint Weekend sem exigir tp2/tp3', () => {
    const completed = ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race']
    // tp2 e tp3 estritamente ausentes
    expect(completed.includes('tp2')).toBe(false)
    expect(completed.includes('tp3')).toBe(false)

    const nextSession = getNextRequiredWeekendSession(roundSprint, completed)
    expect(nextSession).toBe('q1')

    const unlocked = isSessionUnlocked('q1', completed, true)
    expect(unlocked).toBe(true)

    // Prova especificamente que resolveSessionVisualState com isSprintRound=true retorna available (e não locked por falta de tp2/tp3)
    const visualState = resolveSessionVisualState({
      sessionId: 'q1',
      activeSessionId: 'tp1',
      completedSessions: completed,
      isSprintRound: true,
    })
    expect(visualState).toBe('available')

    // Sem isSprintRound explícito, o auto-detect de sprint por completedSessions (sprint_race/sq1..sq3) também funciona
    const visualStateAuto = resolveSessionVisualState({
      sessionId: 'q1',
      activeSessionId: 'tp1',
      completedSessions: completed,
    })
    expect(visualStateAuto).toBe('available')
  })

  // C1-09: weekend normal permanece tp1, tp2, tp3, q1, q2, q3, race, sem regressão.
  it('C1-09: weekend normal permanece tp1, tp2, tp3, q1, q2, q3, race, sem regressão', () => {
    expect(hasSprintWeekend(roundNormal)).toBe(false)
    const schedule = getCanonicalWeekendSchedule(roundNormal)
    const expectedNormalSessions = ['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race']
    expect(schedule).toHaveLength(7)
    expect(schedule).toEqual(expectedNormalSessions)

    const pipeline = getRaceWeekendPipeline({ format: 'standard' })
    expect(pipeline).toHaveLength(7)
    expect(pipeline.map((p) => p.id)).toEqual(expectedNormalSessions)

    // No normal, Q1 requer tp3 concluído
    const onlyTp1 = ['tp1']
    expect(isSessionUnlocked('q1', onlyTp1, false)).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'tp1',
        completedSessions: onlyTp1,
        isSprintRound: false,
      }),
    ).toBe('locked')

    const afterTp3 = ['tp1', 'tp2', 'tp3']
    expect(isSessionUnlocked('q1', afterTp3, false)).toBe(true)
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'tp1',
        completedSessions: afterTp3,
        isSprintRound: false,
      }),
    ).toBe('available')
  })

  // Teste adicional: SQ3 sem SQ2 bloqueada logicamente
  it('C1-EXTRA: SQ3 sem SQ2 permanece bloqueada logicamente', () => {
    const onlySq1 = ['tp1', 'sq1']
    expect(isSessionUnlocked('sq3', onlySq1, true)).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'sq3',
        activeSessionId: 'tp1',
        completedSessions: onlySq1,
        isSprintRound: true,
      }),
    ).toBe('locked')
  })
})
