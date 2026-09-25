import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { POST_02C_AUDIT_DATA } from '@/artifacts/audits/balanceAuditPost02cArtifact'

describe('Dump Relatório CALIBRATION-01A', () => {
  it('imprime sumário formatado para relatório final', () => {
    const data = POST_02C_AUDIT_DATA
    console.log('=== METADATA ===')
    console.log(JSON.stringify(data.metadata, null, 2))
    console.log('=== GAPS ANALYSIS ===')
    console.log(JSON.stringify(data.gapsAnalysis, null, 2))
    console.log('=== CORRELATIONS ===')
    console.log(JSON.stringify(data.correlations, null, 2))
    console.log('=== INVERSIONS ===')
    console.log(JSON.stringify(data.inversionsAnalysis, null, 2))
    console.log('=== TRACKFIT SWING ===')
    console.log('Overall max swing:', data.trackFitAnalysis.overallMaxSwing)
    console.log('=== 12 GRID TEAMS CONSOLIDATED ===')
    console.table(data.grid2026Ranking12)
    console.log('=== OUTLIERS DIAGNOSIS ===')
    console.log(JSON.stringify(data.outliersDiagnosis, null, 2))
    expect(data.metadata.isV0Intact).toBe(true)

    // Escreve o relatório JSON diretamente para balance-audit-post02c.json
    const targetPath = path.resolve(
      process.cwd(),
      'src/artifacts/audits/balance-audit-post02c.json',
    )
    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8')
    expect(fs.existsSync(targetPath)).toBe(true)
  })
})
