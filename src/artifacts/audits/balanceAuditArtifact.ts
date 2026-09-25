/**
 * balanceAuditArtifact.ts
 *
 * Exporta o resultado da auditoria e persistência BALANCE-AUDIT-01.
 */
import { balanceAuditService } from '@/services/balanceAuditService'
import { executeAndPersistBalanceAudit } from '@/scripts/dump-audit'

// Executa a persistência de src/artifacts/audits/balance-audit-01.json se necessário
executeAndPersistBalanceAudit()

export const BALANCE_AUDIT_01_ARTIFACT = balanceAuditService.runFullAudit()
export default BALANCE_AUDIT_01_ARTIFACT
