import { describe, it, expect } from 'vitest'
import { generateBaselineAfterBArtifacts } from '@/scripts/generate-baseline-after-b'

describe('Probe After B', () => {
  it('measures 500 simulations with determinism check', () => {
    const run1 = generateBaselineAfterBArtifacts({
      seed: 20260315,
      qualifyingIterations: 500,
      raceIterations: 500,
      totalRaceLaps: 30,
    })

    const run2 = generateBaselineAfterBArtifacts({
      seed: 20260315,
      qualifyingIterations: 500,
      raceIterations: 500,
      totalRaceLaps: 30,
    })

    const json1 = { ...JSON.parse(run1.jsonString), generatedAt: 'constant' }
    const json2 = { ...JSON.parse(run2.jsonString), generatedAt: 'constant' }
    expect(JSON.stringify(json1)).toBe(JSON.stringify(json2))

    // Falha intencional capturando o summaryText e dados cruciais
    const audi = run1.report.teamsStats.find(t => t.teamKey === 'audi')!
    const haas = run1.report.teamsStats.find(t => t.teamKey === 'haas')!
    const msg = `AUDI_FINISH=${audi.avgFinishPosition} HAAS_FINISH=${haas.avgFinishPosition} AUDI_AHEAD_RATE=${run1.audiHaasBalance.audiAheadRate} HAAS_AHEAD_RATE=${run1.audiHaasBalance.haasAheadRate} AUDI_QUALY_AHEAD=${run1.audiHaasBalance.audiAheadQualyRate} AVG_RACE_DELTA=${run1.audiHaasBalance.avgRaceDeltaSec} AVG_QUALY_DELTA=${run1.audiHaasBalance.avgQualifyingDeltaSec}`
    expect(msg).toBe('PRINT_MSG')
  })
})
