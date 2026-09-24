import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { generateBaselineAfterBArtifacts } from '@/scripts/generate-baseline-after-b'

describe('FC02D Monte Carlo Runner and Persister', () => {
  it('executes Monte Carlo with seed 20260315 and persists baseline-2026-after-phase-b.json', () => {
    const seed = 20260315
    const qIters = 250
    const rIters = 250
    const laps = 25

    const run1 = generateBaselineAfterBArtifacts({
      seed,
      qualifyingIterations: qIters,
      raceIterations: rIters,
      totalRaceLaps: laps,
    })

    // Gravar baseline-2026-after-phase-b.json
    const targetPath = path.resolve(process.cwd(), 'src/data/baseline-2026-after-phase-b.json')
    fs.writeFileSync(targetPath, run1.jsonString, 'utf-8')

    // Verificar que o arquivo foi gravado e é parseável
    expect(fs.existsSync(targetPath)).toBe(true)
    const persisted = JSON.parse(fs.readFileSync(targetPath, 'utf-8'))
    expect(persisted.phase).toBe('FASE_B_AFTER')
    expect(persisted.seed).toBe(seed)
    expect(persisted.totalQualifyingSimulations).toBe(qIters)
    expect(persisted.totalRaceSimulations).toBe(rIters)
    expect(persisted.teamsStats).toHaveLength(12)
    expect(persisted.audiHaasDetailedAudit).toBeDefined()

    // Passo 4: Rodar a execução uma SEGUNDA vez com a mesma seed e confirmar determinismo
    const run2 = generateBaselineAfterBArtifacts({
      seed,
      qualifyingIterations: qIters,
      raceIterations: rIters,
      totalRaceLaps: laps,
    })

    const norm1 = { ...JSON.parse(run1.jsonString), generatedAt: 'SAME' }
    const norm2 = { ...JSON.parse(run2.jsonString), generatedAt: 'SAME' }
    expect(JSON.stringify(norm1)).toBe(JSON.stringify(norm2))

    const audi = run1.report.teamsStats.find((t) => t.teamKey === 'audi')!
    const haas = run1.report.teamsStats.find((t) => t.teamKey === 'haas')!
    const dump = JSON.stringify({
      qualiRuns: qIters,
      raceRuns: rIters,
      audiFinish: audi.avgFinishPosition,
      haasFinish: haas.avgFinishPosition,
      audiAheadRate: run1.audiHaasBalance.audiAheadRate,
      haasAheadRate: run1.audiHaasBalance.haasAheadRate,
      audiAheadQualyRate: run1.audiHaasBalance.audiAheadQualyRate,
      avgRaceDeltaSec: run1.audiHaasBalance.avgRaceDeltaSec,
      avgQualifyingDeltaSec: run1.audiHaasBalance.avgQualifyingDeltaSec,
      determinismConfirmed: true,
      jsonPath: targetPath,
      fullJson: JSON.parse(run1.jsonString),
    })

    throw new Error(`TRIGGER_INTENTIONAL_ERROR: ${dump}`)
  }, 180000)
})
