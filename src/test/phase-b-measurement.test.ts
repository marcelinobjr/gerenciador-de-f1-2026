import { describe, it, expect } from 'vitest'
import { generateBaselineAfterBArtifacts } from '@/scripts/generate-baseline-after-b'

describe('Probe After B', () => {
  it('measures 50 simulations', () => {
    const res = generateBaselineAfterBArtifacts({
      seed: 20260315,
      qualifyingIterations: 50,
      raceIterations: 50,
      totalRaceLaps: 30,
    })
    const audi = res.report.teamsStats.find((t) => t.teamKey === 'audi')!
    const haas = res.report.teamsStats.find((t) => t.teamKey === 'haas')!
    const alpine = res.report.teamsStats.find((t) => t.teamKey === 'alpine')!
    const rb = res.report.teamsStats.find((t) => t.teamKey === 'racingbulls')!
    const williams = res.report.teamsStats.find((t) => t.teamKey === 'williams')!

    // Probe output
    console.log(
      'PROBE_50_SIMS:',
      JSON.stringify({
        AUDI: {
          grid: audi.avgGridPosition,
          finish: audi.avgFinishPosition,
          carPerf: audi.carPerfRating,
        },
        HAAS: {
          grid: haas.avgGridPosition,
          finish: haas.avgFinishPosition,
          carPerf: haas.carPerfRating,
        },
        ALPINE: {
          grid: alpine.avgGridPosition,
          finish: alpine.avgFinishPosition,
          carPerf: alpine.carPerfRating,
        },
        RACING_BULLS: {
          grid: rb.avgGridPosition,
          finish: rb.avgFinishPosition,
          carPerf: rb.carPerfRating,
        },
        WILLIAMS: {
          grid: williams.avgGridPosition,
          finish: williams.avgFinishPosition,
          carPerf: williams.carPerfRating,
        },
        BALANCE: {
          audiAheadQualyRate: res.audiHaasBalance.audiAheadQualyRate,
          audiAheadRate: res.audiHaasBalance.audiAheadRate,
          qualyDistribution: res.audiHaasBalance.qualyDistribution,
          raceDistribution: res.audiHaasBalance.raceDistribution,
        },
      }),
    )
    const data = {
      AUDI: {
        grid: audi.avgGridPosition,
        finish: audi.avgFinishPosition,
        carPerf: audi.carPerfRating,
      },
      HAAS: {
        grid: haas.avgGridPosition,
        finish: haas.avgFinishPosition,
        carPerf: haas.carPerfRating,
      },
      ALPINE: {
        grid: alpine.avgGridPosition,
        finish: alpine.avgFinishPosition,
        carPerf: alpine.carPerfRating,
      },
      RACING_BULLS: {
        grid: rb.avgGridPosition,
        finish: rb.avgFinishPosition,
        carPerf: rb.carPerfRating,
      },
      WILLIAMS: {
        grid: williams.avgGridPosition,
        finish: williams.avgFinishPosition,
        carPerf: williams.carPerfRating,
      },
      BALANCE: {
        audiAheadQualyRate: res.audiHaasBalance.audiAheadQualyRate,
        audiAheadRate: res.audiHaasBalance.audiAheadRate,
        qualyDistribution: res.audiHaasBalance.qualyDistribution,
        raceDistribution: res.audiHaasBalance.raceDistribution,
      },
    }
    // Expect something that will fail vitest
    expect(data.AUDI.carPerf).toBe(-999)
  })
})
