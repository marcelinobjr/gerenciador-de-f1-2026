import { describe, it, expect } from 'vitest'
import {
  getRaceWeekendPipeline,
  CANONICAL_SESSION_DEFINITIONS,
  resolveSessionVisualState,
  resolveInitialRaceSession,
} from '@/services/weekendScheduleConfig'

/**
 * BUG-WEEKEND-FLOW-TL3-01A
 * Testes focados mínimos A01..A06
 *
 * REGRA CANÔNICA:
 * NORMAL: TL1 → TL2 → TL3 → Q1 → Q2 → Q3 → Corrida
 * SPRINT: TL1 → QUALI_SPRINT → SPRINT → Q1 → Q2 → Q3 → Corrida (sem TL2 / sem TL3)
 */

describe('BUG-WEEKEND-FLOW-TL3-01A: Micro-patch TL3 no Weekend Normal', () => {
  // BUG-TL3-A01: NORMAL produz TL1/TL2/TL3/Q1/Q2/Q3/RACE.
  it('BUG-TL3-A01: NORMAL produz TL1/TL2/TL3/Q1/Q2/Q3/RACE na esteira padrão', () => {
    const pipeline = getRaceWeekendPipeline()
    const ids = pipeline.map((s) => s.id)
    const labels = pipeline.map((s) => s.shortLabel)

    expect(ids).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])
    expect(labels).toEqual(['TL1', 'TL2', 'TL3', 'Q1', 'Q2', 'Q3', 'CORRIDA'])
  })

  // BUG-TL3-A02: TL3 está imediatamente após TL2.
  it('BUG-TL3-A02: TL3 está imediatamente após TL2', () => {
    const pipeline = getRaceWeekendPipeline()
    const ids = pipeline.map((s) => s.id)
    const idxTL2 = ids.indexOf('tp2')
    const idxTL3 = ids.indexOf('tp3')

    expect(idxTL2).toBeGreaterThanOrEqual(0)
    expect(idxTL3).toBe(idxTL2 + 1)
  })

  // BUG-TL3-A03: Q1 está imediatamente após TL3.
  it('BUG-TL3-A03: Q1 está imediatamente após TL3', () => {
    const pipeline = getRaceWeekendPipeline()
    const ids = pipeline.map((s) => s.id)
    const idxTL3 = ids.indexOf('tp3')
    const idxQ1 = ids.indexOf('q1')

    expect(idxTL3).toBeGreaterThanOrEqual(0)
    expect(idxQ1).toBe(idxTL3 + 1)
  })

  // BUG-TL3-A04: SPRINT não contém TL2.
  it('BUG-TL3-A04: SPRINT não contém TL2', () => {
    const sprintPipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = sprintPipeline.map((s) => s.id)

    expect(ids).not.toContain('tp2')
  })

  // BUG-TL3-A05: SPRINT não contém TL3.
  it('BUG-TL3-A05: SPRINT não contém TL3', () => {
    const sprintPipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = sprintPipeline.map((s) => s.id)

    expect(ids).not.toContain('tp3')
  })

  // BUG-TL3-A06: a alteração usa a estrutura/backend já existente de TL3.
  it('BUG-TL3-A06: a alteração usa a estrutura/backend já existente de TL3 (CANONICAL_SESSION_DEFINITIONS)', () => {
    const pipeline = getRaceWeekendPipeline()
    const tl3 = pipeline.find((s) => s.id === 'tp3')

    expect(tl3).toBeDefined()
    expect(tl3).toBe(CANONICAL_SESSION_DEFINITIONS['tp3'])
    expect(tl3?.shortLabel).toBe('TL3')
    expect(tl3?.fullName).toBe('Treino Livre 3')
    expect(tl3?.category).toBe('practice')
    expect(tl3?.order).toBe(3)
    expect(tl3?.isPlayableInV2).toBe(true)
  })
})
