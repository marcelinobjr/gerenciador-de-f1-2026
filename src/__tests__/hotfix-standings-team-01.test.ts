import { describe, it, expect } from 'vitest'
import { getActiveDriverTeamBinding } from '@/lib/canonical-driver-database'

describe('HOTFIX-STANDINGS-TEAM-01', () => {
  it('HOT-ST-01: Albon resolves to Williams', () => {
    const binding = getActiveDriverTeamBinding('mbj-013')
    expect(binding.isContracted).toBe(true)
    expect(binding.teamName).toContain('Williams')
  })

  it('HOT-ST-02: Hadjar resolves to Red Bull Racing', () => {
    const binding = getActiveDriverTeamBinding('mbj-016')
    expect(binding.isContracted).toBe(true)
    expect(binding.teamName).toContain('Red Bull')
  })

  it('HOT-ST-03: Real free agent resolves to Sem Equipe', () => {
    // Non-contracted driver / free agent
    const binding = getActiveDriverTeamBinding('free_agent_test_driver')
    const teamDisplay = binding?.isContracted && binding?.teamName ? binding.teamName : 'Sem Equipe'
    expect(binding.isContracted).toBe(false)
    expect(teamDisplay).toBe('Sem Equipe')
  })
})
