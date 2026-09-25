/**
 * src/artifacts/audits/generateAuditPayload.ts
 *
 * Módulo de geração e persistência do payload canônico de BALANCE-AUDIT-01.
 * Executa balanceAuditService.runFullAudit() + diagnosticExtractionService.extractFullDiagnosis()
 * e salva em src/artifacts/audits/balance-audit-01.json.
 */

import { executeAndPersistBalanceAudit } from '@/scripts/dump-audit'

export function generateAuditPayload() {
  return executeAndPersistBalanceAudit()
}

export default generateAuditPayload
