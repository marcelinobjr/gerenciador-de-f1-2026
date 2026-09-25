/**
 * dumpExtractionData.test.ts
 *
 * Teste para gerar o JSON do relatório completo e persistir o artefato balance-audit-01.json
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { balanceAuditService } from '@/services/balanceAuditService'
import { diagnosticExtractionService } from '@/services/diagnosticExtractionService'

describe('Persist Artifact and Dump Extraction Data', () => {
  it('generates balance-audit-01.json and extraction data', () => {
    const report = balanceAuditService.runFullAudit()
    const outDir = path.resolve(process.cwd(), 'src/artifacts/audits')
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }
    const outFile = path.join(outDir, 'balance-audit-01.json')
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf-8')

    const diagnosis = diagnosticExtractionService.extractFullDiagnosis()
    const diagOutFile = path.join(outDir, 'diagnostic-extraction-data.json')
    fs.writeFileSync(diagOutFile, JSON.stringify(diagnosis, null, 2), 'utf-8')

    expect(fs.existsSync(outFile)).toBe(true)
    expect(fs.existsSync(diagOutFile)).toBe(true)
    expect(report.teamsAudited).toBe(29)
    expect(report.tracksAudited).toBe(24)
  })
})
