import { describe, it, expect } from 'vitest'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { getActiveDriverTeamBinding } from '@/lib/canonical-driver-database'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'

describe('CHAMPIONSHIP-TEAM-BINDING-01 probe', () => {
  it('Albon and Hadjar resolve to canonical teams and not Sem Equipe', () => {
    const albonBinding = getActiveDriverTeamBinding('mbj-013')
    expect(albonBinding.teamName).toBe('Williams Racing')

    const hadjarBinding = getActiveDriverTeamBinding('mbj-016')
    expect(hadjarBinding.teamName).toBeTruthy()
    expect(hadjarBinding.teamName).not.toBe('Sem Equipe')

    const bortoletoBinding = getActiveDriverTeamBinding('mbj-020')
    expect(bortoletoBinding.teamName).toContain('Audi')

    const hulkenbergBinding = getActiveDriverTeamBinding('mbj-019')
    expect(hulkenbergBinding.teamName).toContain('Audi')
  })
})
