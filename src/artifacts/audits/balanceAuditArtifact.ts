/**
 * balanceAuditArtifact.ts
 *
 * Exporta o resultado da auditoria e persistência BALANCE-AUDIT-01.
 */
import { balanceAuditService } from '@/services/balanceAuditService'

export const BALANCE_AUDIT_01_ARTIFACT = balanceAuditService.runFullAudit()
export default BALANCE_AUDIT_01_ARTIFACT
