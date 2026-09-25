import fs from 'node:fs'
import path from 'node:path'
import { balanceAuditService } from '../../services/balanceAuditService'

const report = balanceAuditService.runFullAudit()

try {
  const dir = path.resolve(process.cwd(), 'src/artifacts/audits')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const filePath = path.join(dir, 'balance-audit-01.json')
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8')
} catch (_e) {
  // Ignora se estiver em ambiente sem acesso direto ao fs
}

export const BALANCE_AUDIT_01_ARTIFACT = report
export default report
