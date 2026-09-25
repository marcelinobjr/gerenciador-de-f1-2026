import { describe, it, expect } from 'vitest'
import { calibration01aBaselineService } from '@/services/calibration01aBaselineService'
import * as fs from 'fs'
import * as path from 'path'

describe('Gerador do Artefato CALIBRATION-01A', () => {
  it('gera e persiste balance-audit-post02c.json com 200 runs de quali e 100 de race', () => {
    const payload = calibration01aBaselineService.runFullMeasurement({
      qualiIterations: 200,
      raceIterations: 100,
      deterministicSeed: 20260315,
    })

    const targetPath = path.resolve(__dirname, '../artifacts/audits/balance-audit-post02c.json')
    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf-8')

    expect(fs.existsSync(targetPath)).toBe(true)
    const content = JSON.parse(fs.readFileSync(targetPath, 'utf-8'))
    expect(content.metadata.auditPhase).toBe('CALIBRATION-01A')
    expect(content.structuralRanking29.length).toBe(29)
    expect(content.grid2026Qualifying.length).toBe(12)
    expect(content.grid2026Race.length).toBe(12)
  })
})
