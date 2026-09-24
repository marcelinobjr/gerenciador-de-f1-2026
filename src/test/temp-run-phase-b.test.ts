import { describe, it, expect } from 'vitest'
import { runFC02DPhaseB } from '@/scripts/run-fc02d-phase-b'
import * as fs from 'fs'

describe('Run Monte Carlo FC02D Phase B', () => {
  it('executa 100 runs e persiste baseline-2026-after-phase-b.json', () => {
    const res = runFC02DPhaseB({
      seed: 20260315,
      runs: 100,
      totalLaps: 20,
      persist: true,
    })

    expect(res.filePath).toBeDefined()
    expect(fs.existsSync(res.filePath!)).toBe(true)
    expect(res.artifact.teamsCount).toBe(12)
    expect(res.artifact.specialChecks).toBeDefined()
  }, 180000)
})
