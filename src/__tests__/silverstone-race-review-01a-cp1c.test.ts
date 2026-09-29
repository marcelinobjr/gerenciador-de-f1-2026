import { describe, it, expect } from 'vitest'
import {
  NORMAL_WEEKEND_SCHEDULE,
  SPRINT_WEEKEND_SCHEDULE,
  getCanonicalWeekendSchedule,
  getNextRequiredWeekendSession,
  checkWeekendRaceAccess,
  hasSprintWeekend,
  normalizeCompletedSessions,
} from '@/services/weekendProgressionService'
import { resolveSessionVisualState } from '@/services/weekendScheduleConfig'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'

/**
 * APEX GP MANAGER — SILVERSTONE-RACE-REVIEW-01A-CP1C
 * TESTES CANÔNICOS DE PROGRESSÃO SPRINT + ISOLAMENTO SQ x Q + GATES CP1C
 */
describe('SILVERSTONE-RACE-REVIEW-01A-CP1C: Canonical Sprint Weekend Progression & Session Isolation', () => {
  // Localizar rodada Sprint canônica (Round 2 Shanghai ou Silverstone)
  const sprintCircuit = CIRCUIT_PERFORMANCE_PROFILES.find((c) => c.hasSprint)
  const roundSprint = sprintCircuit?.round ?? 2

  // Localizar rodada Normal canônica (Round 1 Albert Park)
  const normalCircuit = CIRCUIT_PERFORMANCE_PROFILES.find((c) => !c.hasSprint)
  const roundNormal = normalCircuit?.round ?? 1

  // -------------------------------------------------------------------------
  // TESTES CP1C-01..10
  // -------------------------------------------------------------------------

  it('CP1C-01: TL1 complete → TL2 ready', () => {
    // Inicial: TL1 é a próxima necessária
    expect(getNextRequiredWeekendSession(roundSprint, [])).toBe('tp1')
    // Com TL1 concluído: TL2 fica pronta / próxima necessária
    expect(getNextRequiredWeekendSession(roundSprint, ['tp1'])).toBe('tp2')
  })

  it('CP1C-02: TL2 complete → SQ1 ready', () => {
    // Com TL1 e TL2 concluídos: SQ1 fica pronta / próxima necessária
    expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2'])).toBe('sq1')
  })

  it('CP1C-03: SQ1 complete → SQ2 ready', () => {
    // Com TL1, TL2 e SQ1 concluídos: SQ2 fica pronta / próxima necessária
    expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2', 'sq1'])).toBe('sq2')
  })

  it('CP1C-04: SQ2 complete → SQ3 ready', () => {
    // Com TL1, TL2, SQ1 e SQ2 concluídos: SQ3 fica pronta / próxima necessária
    expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2', 'sq1', 'sq2'])).toBe('sq3')
  })

  it('CP1C-05: SQ3 complete → SPRINT ready', () => {
    // Com SQ3 concluído: Sprint Race fica pronta / próxima necessária
    expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2', 'sq1', 'sq2', 'sq3'])).toBe(
      'sprint_race',
    )
  })

  it('CP1C-06: SPRINT complete → GP Q1 ready', () => {
    // Com Sprint Race concluída: GP Q1 fica pronta / próxima necessária
    expect(
      getNextRequiredWeekendSession(roundSprint, [
        'tp1',
        'tp2',
        'sq1',
        'sq2',
        'sq3',
        'sprint_race',
      ]),
    ).toBe('q1')
  })

  it('CP1C-07: GP Q1 complete → GP Q2 ready', () => {
    // Com GP Q1 concluído: GP Q2 fica pronta / próxima necessária
    expect(
      getNextRequiredWeekendSession(roundSprint, [
        'tp1',
        'tp2',
        'sq1',
        'sq2',
        'sq3',
        'sprint_race',
        'q1',
      ]),
    ).toBe('q2')
  })

  it('CP1C-08: GP Q2 complete → GP Q3 ready', () => {
    // Com GP Q2 concluído: GP Q3 fica pronta / próxima necessária
    expect(
      getNextRequiredWeekendSession(roundSprint, [
        'tp1',
        'tp2',
        'sq1',
        'sq2',
        'sq3',
        'sprint_race',
        'q1',
        'q2',
      ]),
    ).toBe('q3')
  })

  it('CP1C-09: GP Q3 complete → MAIN RACE ready', () => {
    // Com GP Q3 concluído: Corrida Principal fica pronta / liberada
    const completedBeforeRace = ['tp1', 'tp2', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2', 'q3']
    expect(getNextRequiredWeekendSession(roundSprint, completedBeforeRace)).toBe('race')

    const gate = checkWeekendRaceAccess(roundSprint, completedBeforeRace)
    expect(gate.allowed).toBe(true)
    expect(gate.nextRequiredSession).toBe('race')
    expect(gate.blockingReason).toBeNull()
  })

  it('CP1C-10: MAIN RACE complete → weekend complete', () => {
    const allDone = ['tp1', 'tp2', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2', 'q3', 'race']
    expect(getNextRequiredWeekendSession(roundSprint, allDone)).toBeNull()
    const gate = checkWeekendRaceAccess(roundSprint, allDone)
    expect(gate.allowed).toBe(true)
    expect(gate.nextRequiredSession).toBeNull()
  })

  // -------------------------------------------------------------------------
  // GATE PRINCIPAL: SPRINT-A-09
  // -------------------------------------------------------------------------

  it('SPRINT-A-09: Sprint complete → GP Q1 ready (gate principal do CP1C)', () => {
    // Antes da Sprint estar completa: GP Q1 deve estar travado
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'sprint_race',
        completedSessions: ['tp1', 'tp2', 'sq1', 'sq2', 'sq3'],
      }),
    ).toBe('locked')

    // Após Sprint completa: GP Q1 fica disponível
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'q1',
        completedSessions: ['tp1', 'tp2', 'sq1', 'sq2', 'sq3', 'sprint_race'],
      }),
    ).toBe('available')

    // Pelo serviço de progressão:
    expect(
      getNextRequiredWeekendSession(roundSprint, [
        'tp1',
        'tp2',
        'sq1',
        'sq2',
        'sq3',
        'sprint_race',
      ]),
    ).toBe('q1')
  })

  // -------------------------------------------------------------------------
  // ASSERTS ADICIONAIS OBRIGATÓRIOS
  // -------------------------------------------------------------------------

  it('Assert adicional 1: TL3 não aparece no Sprint weekend', () => {
    const sprintSchedule = getCanonicalWeekendSchedule(roundSprint)
    expect(sprintSchedule).not.toContain('tp3')
    expect(SPRINT_WEEKEND_SCHEDULE).not.toContain('tp3')
  })

  it('Assert adicional 2: SQ3 NÃO marca Q1/Q2/Q3 como concluídos', () => {
    const normalized = normalizeCompletedSessions(['sq1', 'sq2', 'sq3'])
    expect(normalized).toContain('sq1')
    expect(normalized).toContain('sq2')
    expect(normalized).toContain('sq3')
    expect(normalized).toContain('sprint_qualifying')
    // SQ3 NUNCA deve expandir ou marcar Q1, Q2, Q3 ou qualifying
    expect(normalized).not.toContain('q1')
    expect(normalized).not.toContain('q2')
    expect(normalized).not.toContain('q3')
    expect(normalized).not.toContain('qualifying')
  })

  it('Assert adicional 3: Q1 NÃO marca SQ1/SQ2/SQ3 como concluídos', () => {
    const normalized = normalizeCompletedSessions(['q1'])
    expect(normalized).toContain('q1')
    expect(normalized).not.toContain('sq1')
    expect(normalized).not.toContain('sq2')
    expect(normalized).not.toContain('sq3')
    expect(normalized).not.toContain('sprint_qualifying')

    // Também testando q3 / qualifying:
    const normalizedQ3 = normalizeCompletedSessions(['q3'])
    expect(normalizedQ3).toContain('q1')
    expect(normalizedQ3).toContain('q2')
    expect(normalizedQ3).toContain('q3')
    expect(normalizedQ3).toContain('qualifying')
    expect(normalizedQ3).not.toContain('sq1')
    expect(normalizedQ3).not.toContain('sq2')
    expect(normalizedQ3).not.toContain('sq3')
    expect(normalizedQ3).not.toContain('sprint_qualifying')
  })

  it('Assert adicional 4: Sprint Race NÃO é pulada após qualificação sprint', () => {
    // Mesmo com SQ1, SQ2, SQ3 completos, a próxima DEVE ser sprint_race e NUNCA q1 ou race
    const nextSession = getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2', 'sq3'])
    expect(nextSession).toBe('sprint_race')

    const gate = checkWeekendRaceAccess(roundSprint, ['tp1', 'tp2', 'sq3'])
    expect(gate.allowed).toBe(false)
    expect(gate.nextRequiredSession).toBe('sprint_race')
  })

  it('Assert adicional 5: Main Qualifying só começa após Sprint complete', () => {
    // Sem sprint_race concluída: próxima sessão obrigatória é sprint_race, não q1
    expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2', 'sq1', 'sq2', 'sq3'])).toBe(
      'sprint_race',
    )

    // Somente com sprint_race: próxima é q1
    expect(
      getNextRequiredWeekendSession(roundSprint, [
        'tp1',
        'tp2',
        'sq1',
        'sq2',
        'sq3',
        'sprint_race',
      ]),
    ).toBe('q1')
  })

  it('Assert adicional 6: Main Race só libera após GP Q3 complete', () => {
    // Com tudo completo até Q2, Main Race ainda bloqueada
    const beforeQ3 = ['tp1', 'tp2', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2']
    const gateBefore = checkWeekendRaceAccess(roundSprint, beforeQ3)
    expect(gateBefore.allowed).toBe(false)
    expect(gateBefore.nextRequiredSession).toBe('q3')

    // Com Q3 completo: Main Race finalmente liberada
    const withQ3 = [...beforeQ3, 'q3']
    const gateAfter = checkWeekendRaceAccess(roundSprint, withQ3)
    expect(gateAfter.allowed).toBe(true)
    expect(gateAfter.nextRequiredSession).toBe('race')
  })

  // -------------------------------------------------------------------------
  // PRESERVAÇÃO DO FLUXO NORMAL
  // -------------------------------------------------------------------------

  it('Preservação: weekend normal preserva rigorosamente TL1 → TL2 → TL3 → Q1 → Q2 → Q3 → RACE', () => {
    const normalSchedule = getCanonicalWeekendSchedule(roundNormal)
    expect(normalSchedule).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])
    expect(NORMAL_WEEKEND_SCHEDULE).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])
    expect(normalSchedule).toContain('tp3')
    expect(normalSchedule).not.toContain('sq1')
    expect(normalSchedule).not.toContain('sprint_race')
  })
})
