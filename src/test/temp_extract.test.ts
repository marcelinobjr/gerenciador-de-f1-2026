import { describe, it, expect } from 'vitest'
import { balanceAuditService } from '@/services/balanceAuditService'

describe('temp extract', () => {
  it('extracts audit data', () => {
    const report = balanceAuditService.runFullAudit()
    expect(report.teamsAudited).toBe(29)
    // Throw error containing JSON so QA logs it
    throw new Error('AUDIT_JSON_START:' + JSON.stringify(report) + ':AUDIT_JSON_END')
  })
})
