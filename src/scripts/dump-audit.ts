/**
 * src/scripts/dump-audit.ts
 *
 * Script canônico para execução e persistência do BALANCE-AUDIT-01.
 * Gera src/artifacts/audits/balance-audit-01.json a partir de balanceAuditService.runFullAudit().
 * READ-ONLY: não altera nenhum modelo ou dado.
 */

import fs from 'node:fs'
import path from 'node:path'
import { balanceAuditService } from '../services/balanceAuditService'

export function executeAndPersistBalanceAudit(): {
  report: ReturnType<typeof balanceAuditService.runFullAudit>
  outFile: string
} {
  const report = balanceAuditService.runFullAudit()

  const outDir = path.resolve(process.cwd(), 'src/artifacts/audits')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const outFile = path.join(outDir, 'balance-audit-01.json')
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf-8')

  return { report, outFile }
}

const { report, outFile } = executeAndPersistBalanceAudit()

console.log(`[BALANCE-AUDIT-01] Artefato salvo em: ${outFile}`)
console.log(`- Equipes: ${report.teamsAudited}`)
console.log(`- Pistas: ${report.tracksAudited}`)
console.log(`- Large Gap Inversions: ${report.largeGapInversions.length}`)
console.log(`- Audi vs Haas: ${report.audiVsHaas.status}`)
