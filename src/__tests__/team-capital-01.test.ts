import { describe, it, expect } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { financialLedgerService } from '@/services/financialLedgerService'

describe('TEAM-CAPITAL-01: Injeção de Capital de US$ 150M nas Equipes Ativas', () => {
  it('garante que o serviço e o teste estão devidamente configurados', async () => {
    expect(financialLedgerService).toBeDefined()
    expect(pb).toBeDefined()
  })
})
