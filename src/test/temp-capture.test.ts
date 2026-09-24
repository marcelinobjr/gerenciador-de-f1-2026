import { describe, it, expect } from 'vitest'
import { generateBaselineAfterBArtifacts } from '@/scripts/generate-baseline-after-b'

describe('Capture Monte Carlo Phase B Output', () => {
  it('runs Monte Carlo 200 runs with seed 20260315', () => {
    const seed = 20260315
    const qIters = 200
    const rIters = 200
    const totalRaceLaps = 20

    const result = generateBaselineAfterBArtifacts({
      seed,
      qualifyingIterations: qIters,
      raceIterations: rIters,
      totalRaceLaps,
    })

    // Throw error containing JSON so QA output captures it
    throw new Error(`MC_JSON_BEGIN:${result.jsonString}:MC_JSON_END`)
  }, 120000)
})
