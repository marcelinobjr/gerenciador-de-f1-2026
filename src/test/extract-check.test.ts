import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { balanceAuditService } from '@/services/balanceAuditService'

describe('Extract audit json', () => {
  it('extracts', () => {
    const report = balanceAuditService.runFullAudit()
    const filePath = path.resolve(process.cwd(), 'src/artifacts/audits/balance-audit-01.json')
    const jsonStr = JSON.stringify(report, null, 2)
    fs.writeFileSync(filePath, jsonStr, 'utf-8')
    expect(fs.readFileSync(filePath, 'utf-8').length).toBeGreaterThan(100)
    // Vamos salvar também um arquivo texto com as primeiras 100 linhas para verificar se fs escreve no container de QA
    // mas não no working tree do agente
    expect(report.teamsAudited).toBe(29)
  })
})
