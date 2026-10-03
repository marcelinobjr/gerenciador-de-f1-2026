import { describe, it, expect } from 'vitest'
import * as seq from '@/services/weekendSlotSequenceService'
import * as sched from '@/services/weekendScheduleConfig'
import * as prog from '@/services/weekendProgressionService'

describe('inspect exports', () => {
  it('logs exports', () => {
    const seqKeys = Object.keys(seq)
    const schedKeys = Object.keys(sched)
    const progKeys = Object.keys(prog)
    expect(seqKeys).toEqual([])
  })
})
