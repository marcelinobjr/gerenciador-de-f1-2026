import { describe, it } from 'vitest'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { BASELINE_2026_V1_TEAMS } from '@/data/baseline-2026-v1'

describe('temp debug', () => {
  it('debug ranking', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    const summary = grid2026
      .map((t) => `${t.rank}: ${t.teamKey} (${t.structuralStrengthScore})`)
      .join(', ')
    // We throw to see Vitest output in run_qa if run_qa shows test failure messages
    throw new Error(`DEBUG_GRID_2026: ${summary}`)
  })
})
