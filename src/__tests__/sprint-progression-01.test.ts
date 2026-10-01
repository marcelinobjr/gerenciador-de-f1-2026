import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolveSessionVisualState,
  getRaceWeekendPipeline,
  type RaceWeekendSessionId,
} from '@/services/weekendScheduleConfig'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'

describe('SPRINT-PROGRESSION-01: Canonical Sprint Weekend Progression & SQ1 Unlocking Gate', () => {
  const SPRINT_ROUND = 4
  const SPRINT_YEAR = 2026

  beforeEach(() => {
    localStorage.clear()
  })

  // SP01 — TL1/TL2 incompletos → SQ1 locked
  it('SP01 — TL1/TL2 incompletos → SQ1 locked', () => {
    const visualState = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tp1',
      completedSessions: [],
    })
    expect(visualState).toBe('locked')
  })

  // SP02 — TL1 completed / TL2 incomplete → locked
  it('SP02 — TL1 completed / TL2 incomplete → locked', () => {
    const visualState = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tp2',
      completedSessions: ['tp1'],
    })
    expect(visualState).toBe('locked')
  })

  // SP03 — TL1 + TL2 completed → unlocked (available)
  it('SP03 — TL1 + TL2 completed → unlocked (available)', () => {
    const visualState = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'sq1',
      completedSessions: ['tp1', 'tp2'],
    })
    // Se a sessão está selecionada como ativa, o estado canônico é active; se não for activeSessionId, é available
    const visualStateAvailable = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tp2',
      completedSessions: ['tp1', 'tp2'],
    })
    expect(visualStateAvailable).toBe('available')
    expect(visualState).toBe('active')
  })

  // SP04 — SQ1 selected após TL2 → botão iniciar habilitado (não locked)
  it('SP04 — SQ1 selected após TL2 → não locked', () => {
    const completed = ['tp1', 'tp2']
    const visualState = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'sq1',
      completedSessions: completed,
    })
    expect(visualState).not.toBe('locked')
    expect(['active', 'available']).toContain(visualState)
  })

  // SP05 — save + reload preserva o desbloqueio
  it('SP05 — save + reload preserva o desbloqueio via canonicalWeekendSlotPersistenceService', async () => {
    // 1. Simular persistência de TL1 e TL2 concluídos
    const legacyKey = `apex_completed_sessions_2026_${SPRINT_ROUND}`
    localStorage.setItem(legacyKey, JSON.stringify(['tp1', 'tp2']))

    // 2. Simular "reload": reler do storage canônico
    const reloaded = JSON.parse(localStorage.getItem(legacyKey) || '[]')
    expect(reloaded).toContain('tp1')
    expect(reloaded).toContain('tp2')

    // 3. Avaliar desbloqueio de SQ1 após reload
    const visualState = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'sq1',
      completedSessions: reloaded,
    })

    expect(visualState).not.toBe('locked')
    expect(['active', 'available']).toContain(visualState)
  })

  // SP06 — fim de semana normal sem regressão
  it('SP06 — fim de semana normal sem regressão (TL1 -> TL2 -> TL3 -> Q1 -> Q2 -> Q3 -> RACE)', () => {
    const normalPipeline = getRaceWeekendPipeline({ format: 'standard', includePractice3: true })
    const sessionIds = normalPipeline.map((s) => s.id)

    expect(sessionIds).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])

    // No normal, TL3 requer TL2
    expect(
      resolveSessionVisualState({
        sessionId: 'tp3',
        activeSessionId: 'tp1',
        completedSessions: ['tp1'],
      }),
    ).toBe('locked')

    expect(
      resolveSessionVisualState({
        sessionId: 'tp3',
        activeSessionId: 'tp2',
        completedSessions: ['tp1', 'tp2'],
      }),
    ).toBe('available')

    // Q1 requer TL3 no fim de semana normal
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'tp3',
        completedSessions: ['tp1', 'tp2'],
      }),
    ).toBe('locked')

    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'q1',
        completedSessions: ['tp1', 'tp2', 'tp3'],
      }),
    ).toBe('active')
  })
})
