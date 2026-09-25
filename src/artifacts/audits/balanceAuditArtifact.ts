import { balanceAuditService } from '../services/balanceAuditService'

const report = balanceAuditService.runFullAudit()

export const BALANCE_AUDIT_01_ARTIFACT = report
export default report
