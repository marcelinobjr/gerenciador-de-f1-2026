import { describe, it } from 'vitest'
import { generateBaselineAfterBArtifacts } from '../scripts/generate-baseline-after-b'

describe('temp runner', () => {
  it('sample run', () => {
    const res = generateBaselineAfterBArtifacts({
      qualifyingIterations: 10,
      raceIterations: 10,
      totalRaceLaps: 5,
    })
    console.log('Sample run audiAheadRate:', res.audiHaasBalance.audiAheadRate)
    console.log('Sample run haasAheadRate:', res.audiHaasBalance.haasAheadRate)
    console.log('Sample run carPerfDelta:', res.audiHaasBalance.carPerformanceDelta)
  })
})
