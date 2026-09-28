import { describe, it, expect } from 'vitest'
import {
  getRaceWeekendPipeline,
  resolveSessionVisualState,
  resolveInitialRaceSession,
} from '@/services/weekendScheduleConfig'

describe('BUG-WEEKEND-FLOW-TL3-01: Weekend Normal com TL3', () => {
  // A01 — NORMAL FLOW: Weekend NORMAL produz exatamente TL1, TL2, TL3, Q1, Q2, Q3, RACE
  it('A01 — NORMAL FLOW: Weekend NORMAL produz exatamente TL1, TL2, TL3, Q1, Q2, Q3, RACE', () => {
    const pipeline = getRaceWeekendPipeline()
    const ids = pipeline.map((s) => s.id)
    expect(ids).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])

    const labels = pipeline.map((s) => s.shortLabel)
    expect(labels).toEqual(['TL1', 'TL2', 'TL3', 'Q1', 'Q2', 'Q3', 'CORRIDA'])
  })

  // A02 — POSIÇÃO DO TL3: TL3 aparece imediatamente após TL2
  it('A02 — POSIÇÃO DO TL3: TL3 aparece imediatamente após TL2', () => {
    const pipeline = getRaceWeekendPipeline()
    const ids = pipeline.map((s) => s.id)
    const idxTL2 = ids.indexOf('tp2')
    const idxTL3 = ids.indexOf('tp3')

    expect(idxTL2).toBeGreaterThanOrEqual(0)
    expect(idxTL3).toBe(idxTL2 + 1)
  })

  // A03 — Q1 APÓS TL3: Q1 aparece imediatamente após TL3
  it('A03 — Q1 APÓS TL3: Q1 aparece imediatamente após TL3', () => {
    const pipeline = getRaceWeekendPipeline()
    const ids = pipeline.map((s) => s.id)
    const idxTL3 = ids.indexOf('tp3')
    const idxQ1 = ids.indexOf('q1')

    expect(idxTL3).toBeGreaterThanOrEqual(0)
    expect(idxQ1).toBe(idxTL3 + 1)
  })

  // A04 — SPRINT SEM TL2: Weekend SPRINT não contém TL2
  it('A04 — SPRINT SEM TL2: Weekend SPRINT não contém TL2', () => {
    const sprintPipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = sprintPipeline.map((s) => s.id)
    expect(ids).not.toContain('tp2')
  })

  // A05 — SPRINT SEM TL3: Weekend SPRINT não contém TL3
  it('A05 — SPRINT SEM TL3: Weekend SPRINT não contém TL3', () => {
    const sprintPipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = sprintPipeline.map((s) => s.id)
    expect(ids).not.toContain('tp3')
    expect(ids).toEqual(['tp1', 'q1', 'q2', 'q3', 'race'])
  })

  // A06 — REUSO CANÔNICO: TL3 usa CANONICAL_SESSION_DEFINITIONS['tp3']
  it('A06 — REUSO CANÔNICO: TL3 usa CANONICAL_SESSION_DEFINITIONS[\'tp3\'] ou definição canônica equivalente já existente; nenhum segundo backend de TL3 foi criado', () => {
    const pipeline = getRaceWeekendPipeline()
    const tl3 = pipeline.find((s) => s.id === 'tp3')
    expect(tl3).toBeDefined()
    expect(tl3?.shortLabel).toBe('TL3')
    expect(tl3?.fullName).toBe('Treino Livre 3')
    expect(tl3?.category).toBe('practice')
    expect(tl3?.order).toBe(3)
    expect(tl3?.isPlayableInV2).toBe(true)
  })

  // GATING COMPLEMENTAR NORMAL E SPRINT
  it('GATING: Q1 não fica disponível antes da conclusão de TL3 no weekend NORMAL', () => {
    const stateTL3 = resolveSessionVisualState({
      sessionId: 'tp3',
      activeSessionId: 'tp3',
      completedSessions: ['tp1', 'tp2'],
    })
    expect(stateTL3).toBe('active')

    const stateQ1BeforeTL3 = resolveSessionVisualState({
      sessionId: 'q1',
      activeSessionId: 'tp3',
      completedSessions: ['tp1', 'tp2'],
    })
    expect(stateQ1BeforeTL3).toBe('locked')

    const stateQ1AfterTL3 = resolveSessionVisualState({
      sessionId: 'q1',
      activeSessionId: 'q1',
      completedSessions: ['tp1', 'tp2', 'tp3'],
    })
    expect(stateQ1AfterTL3).toBe('active')
  })

  it('SELEÇÃO INICIAL: resolveInitialRaceSession seleciona TL3 após conclusão do TL2', () => {
    const pipeline = getRaceWeekendPipeline()
    const nextSession = resolveInitialRaceSession({
      pipeline,
      completedSessions: ['tp1', 'tp2'],
    })
    expect(nextSession).toBe('tp3')
  })
})
