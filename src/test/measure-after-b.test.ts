import { describe, it } from 'vitest'
import { generateBaselineAfterBArtifacts } from '@/scripts/generate-baseline-after-b'

describe('measure-after-b', () => {
  it('computes baseline report with seed 20260315', () => {
    const { report } = generateBaselineAfterBArtifacts({
      seed: 20260315,
      qualifyingIterations: 1000,
      raceIterations: 1000,
      totalRaceLaps: 30,
    })
    console.log('--- TEAMS STATS SUMMARY ---')
    console.log(JSON.stringify(report.teamsStats, null, 2))
    console.log('--- FINDINGS ---')
    console.log(JSON.stringify(report.findings, null, 2))
  })
})
