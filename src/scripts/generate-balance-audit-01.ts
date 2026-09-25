import fs from 'node:fs'
import path from 'node:path'
import { balanceAuditService } from '../services/balanceAuditService'

// Executa o audit completo
export function generateBalanceAudit01Artifact(): {
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

const { report, outFile } = generateBalanceAudit01Artifact()

console.log(`[BALANCE-AUDIT-01] Artefato salvo com sucesso em: ${outFile}`)
console.log(`- Equipes auditadas: ${report.teamsAudited}`)
console.log(`- Pistas auditadas: ${report.tracksAudited}`)
console.log(`- Inversões de grande gap: ${report.largeGapInversions.length}`)
console.log(
  `- Audi vs Haas: ${report.audiVsHaas.status} (Audi: ${report.audiVsHaas.audiHeadToHeadWinRate}% vs Haas: ${report.audiVsHaas.haasHeadToHeadWinRate}%)`,
)
console.log(`- Pace Breakdown Residual máximo: ${report.maxPaceBreakdownResidual}`)
