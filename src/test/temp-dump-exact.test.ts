import { describe, it } from 'vitest'
import { computeAfterBReport } from '@/data/baseline-phase-b-data'

describe('temp-dump-exact', () => {
  it('dumps exact team stats', () => {
    const report = computeAfterBReport()
    // dump 3 teams at a time
    const t = report.teamsStats.slice(0, 3)
    throw new Error('TEAMS_0_3:' + JSON.stringify(t))
  })
})
