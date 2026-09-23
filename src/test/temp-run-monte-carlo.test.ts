import { describe, it } from 'vitest'
import { generateBaselineAfterBArtifacts } from '@/scripts/generate-baseline-after-b'

describe('temp-runner', () => {
  it('runs monte carlo 1000x1000', () => {
    console.log('Starting Monte Carlo 1000x1000...')
    const start = Date.now()
    const { report } = generateBaselineAfterBArtifacts({
      seed: 20260315,
      qualifyingIterations: 1000,
      raceIterations: 1000,
      totalRaceLaps: 30,
    })
    console.log('Completed in ms:', Date.now() - start)
    console.log(JSON.stringify(report, null, 2))
  })
})
