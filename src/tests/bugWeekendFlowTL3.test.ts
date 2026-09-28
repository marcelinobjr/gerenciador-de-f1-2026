import { describe, it, expect } from 'vitest'
import {
  getRaceWeekendPipeline,
  resolveSessionVisualState,
  resolveInitialRaceSession,
} from '@/services/weekendScheduleConfig'

describe('BUG-WEEKEND-FLOW-TL3-01: Weekend Normal com TL3', () => {
  it('TL3-01 & TL3-02: weekend NORMAL exibe TL1 -> TL2 -> TL3 -> Q1 -> Q2 -> Q3 -> Corrida na ordem canônica', () => {
    const pipeline = getRaceWeekendPipeline()
    const ids = pipeline.map((s) => s.id)
    expect(ids).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])

    const labels = pipeline.map((s) => s.shortLabel)
    expect(labels).toEqual(['TL1', 'TL2', 'TL3', 'Q1', 'Q2', 'Q3', 'CORRIDA'])

    // TL3 aparece exatamente entre TL2 e Q1
    const idxTL2 = ids.indexOf('tp2')
    const idxTL3 = ids.indexOf('tp3')
    const idxQ1 = ids.indexOf('q1')
    expect(idxTL3).toBe(idxTL2 + 1)
    expect(idxQ1).toBe(idxTL3 + 1)
  })

  it('TL3-03: Q1 não fica disponível antes da conclusão de TL3 no weekend NORMAL (gating)', () => {
    // Apenas TL1 e TL2 concluídos -> Q1 deve estar locked e TL3 available
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

    // Após conclusão do TL3 -> Q1 deve ficar available
    const stateQ1AfterTL3 = resolveSessionVisualState({
      sessionId: 'q1',
      activeSessionId: 'q1',
      completedSessions: ['tp1', 'tp2', 'tp3'],
    })
    expect(stateQ1AfterTL3).toBe('active') // ou available se não active
  })

  it('TL3-04: TL3 usa definição canônica oficial do backend/pipeline existente', () => {
    const pipeline = getRaceWeekendPipeline()
    const tl3 = pipeline.find((s) => s.id === 'tp3')
    expect(tl3).toBeDefined()
    expect(tl3?.shortLabel).toBe('TL3')
    expect(tl3?.category).toBe('practice')
    expect(tl3?.isPlayableInV2).toBe(true)
  })

  it('TL3-05: weekend SPRINT não inclui TL2 nem TL3 na esteira', () => {
    const sprintPipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = sprintPipeline.map((s) => s.id)
    expect(ids).not.toContain('tp2')
    expect(ids).not.toContain('tp3')
    expect(ids).toEqual(['tp1', 'q1', 'q2', 'q3', 'race'])
  })

  it('TL3-09: resolveInitialRaceSession seleciona TL3 após conclusão do TL2', () => {
    const pipeline = getRaceWeekendPipeline()
    const nextSession = resolveInitialRaceSession({
      pipeline,
      completedSessions: ['tp1', 'tp2'],
    })
    expect(nextSession).toBe('tp3')
  })
})
