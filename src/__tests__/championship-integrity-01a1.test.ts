import { describe, it, expect } from 'vitest'
import {
  getActiveDriverTeamBinding,
  findCanonicalDriverMaster,
} from '@/lib/canonical-driver-database'
import { standingsService } from '@/services/standingsService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'

describe('CHAMPIONSHIP-INTEGRITY-01A1: Standings team binding resolution', () => {
  // CI01A1-01 Albon resolve Williams
  it('CI01A1-01: Alexander Albon resolves to Williams', () => {
    const bindingById = getActiveDriverTeamBinding('mbj-013')
    expect(bindingById.isContracted).toBe(true)
    expect(bindingById.teamName).toContain('Williams')

    const bindingByName = getActiveDriverTeamBinding('Alexander Albon')
    expect(bindingByName.isContracted).toBe(true)
    expect(bindingByName.teamName).toContain('Williams')
  })

  // CI01A1-02 Hadjar Red Bull Racing
  it('CI01A1-02: Isack Hadjar resolves to Red Bull Racing', () => {
    const bindingById = getActiveDriverTeamBinding('mbj-016')
    expect(bindingById.isContracted).toBe(true)
    expect(bindingById.teamName).toContain('Red Bull')

    const bindingByName = getActiveDriverTeamBinding('Isack Hadjar')
    expect(bindingByName.isContracted).toBe(true)
    expect(bindingByName.teamName).toContain('Red Bull')
  })

  // CI01A1-03 Bortoleto Audi
  it('CI01A1-03: Gabriel Bortoleto resolves to Audi F1 Team', () => {
    const bindingById = getActiveDriverTeamBinding('mbj-020')
    expect(bindingById.isContracted).toBe(true)
    expect(bindingById.teamName).toContain('Audi')

    const bindingByName = getActiveDriverTeamBinding('Gabriel Bortoleto')
    expect(bindingByName.isContracted).toBe(true)
    expect(bindingByName.teamName).toContain('Audi')
  })

  // CI01A1-04 Hülkenberg Audi
  it('CI01A1-04: Nico Hülkenberg resolves to Audi F1 Team', () => {
    const bindingById = getActiveDriverTeamBinding('mbj-019')
    expect(bindingById.isContracted).toBe(true)
    expect(bindingById.teamName).toContain('Audi')

    const bindingByName = getActiveDriverTeamBinding('Nico Hülkenberg')
    expect(bindingByName.isContracted).toBe(true)
    expect(bindingByName.teamName).toContain('Audi')

    const bindingByNameAscii = getActiveDriverTeamBinding('Nico Hulkenberg')
    expect(bindingByNameAscii.isContracted).toBe(true)
    expect(bindingByNameAscii.teamName).toContain('Audi')
  })

  // CI01A1-05 Norris/Piastri McLaren
  it('CI01A1-05: Lando Norris and Oscar Piastri resolve to McLaren F1 Team', () => {
    const norris = getActiveDriverTeamBinding('mbj-007')
    expect(norris.isContracted).toBe(true)
    expect(norris.teamName).toContain('McLaren')

    const piastri = getActiveDriverTeamBinding('mbj-008')
    expect(piastri.isContracted).toBe(true)
    expect(piastri.teamName).toContain('McLaren')
  })

  // CI01A1-06 Leclerc Ferrari
  it('CI01A1-06: Charles Leclerc resolves to Ferrari', () => {
    const leclerc = getActiveDriverTeamBinding('mbj-003')
    expect(leclerc.isContracted).toBe(true)
    expect(leclerc.teamName).toContain('Ferrari')
  })

  // CI01A1-07 Verstappen Red Bull
  it('CI01A1-07: Max Verstappen resolves to Red Bull Racing', () => {
    const verstappen = getActiveDriverTeamBinding('mbj-001')
    expect(verstappen.isContracted).toBe(true)
    expect(verstappen.teamName).toContain('Red Bull')
  })

  // CI01A1-08 free agent sem equipe
  it('CI01A1-08: Free agent resolves without team / not contracted', () => {
    // Non-contracted canonical driver (e.g., free agent or outside F1)
    const fa1 = getActiveDriverTeamBinding('driver_free_agent_unknown_123')
    expect(fa1.isContracted).toBe(false)
    expect(fa1.teamName).toBeNull()
    expect(fa1.status).toBe('free_agent')

    const fa2 = getActiveDriverTeamBinding(null)
    expect(fa2.isContracted).toBe(false)
    expect(fa2.teamName).toBeNull()
    expect(fa2.status).toBe('free_agent')
  })

  // CI01A1-09 mbj/DRV/runtime ID convergem para a mesma identidade
  it('CI01A1-09: mbj, DRV, and runtime ID converge to the same canonical identity', () => {
    // Albon: mbj-013 vs DRV_0013 vs 0mow8vmzk0y4z9s
    const albonMbj = findCanonicalDriverMaster('mbj-013')
    const albonDrv = findCanonicalDriverMaster('DRV_0013')
    const albonRuntime = findCanonicalDriverMaster('0mow8vmzk0y4z9s')

    expect(albonMbj).toBeDefined()
    expect(albonDrv).toBeDefined()
    expect(albonRuntime).toBeDefined()
    expect(albonMbj?.fullName).toBe('Alexander Albon')
    expect(albonDrv?.fullName).toBe('Alexander Albon')
    expect(albonRuntime?.fullName).toBe('Alexander Albon')

    // Bortoleto: mbj-020 vs 9uazqw522oc9p4z
    const bortoletoMbj = findCanonicalDriverMaster('mbj-020')
    const bortoletoRuntime = findCanonicalDriverMaster('9uazqw522oc9p4z')
    expect(bortoletoMbj?.fullName).toBe('Gabriel Bortoleto')
    expect(bortoletoRuntime?.fullName).toBe('Gabriel Bortoleto')
  })

  // CI01A1-10 standings usa getActiveDriverTeamBinding() e não teamName legado
  it('CI01A1-10: standings computes contracted driver teams via getActiveDriverTeamBinding and never masks them as Sem Equipe', () => {
    // Test calculateStandings
    const res = standingsService.calculateStandings({
      raceResults: [],
      playerDrivers: [],
      season: { id: 's2026', year: 2026 } as any,
      team: { id: 'audi', team_key: 'audi', name: 'Audi F1 Team' } as any,
    })

    expect(res.driverStandings.length).toBeGreaterThan(0)
    // Find Albon in standings
    const albonStanding = res.driverStandings.find((d) => d.name.toLowerCase().includes('albon'))
    expect(albonStanding).toBeDefined()
    expect(albonStanding?.teamName).toContain('Williams')
    expect(albonStanding?.teamName).not.toBe('Sem Equipe')

    // Find Hadjar
    const hadjarStanding = res.driverStandings.find((d) => d.name.toLowerCase().includes('hadjar'))
    if (hadjarStanding) {
      expect(hadjarStanding.teamName).toContain('Red Bull')
      expect(hadjarStanding.teamName).not.toBe('Sem Equipe')
    }

    // Find Bortoleto
    const bortoletoStanding = res.driverStandings.find((d) =>
      d.name.toLowerCase().includes('bortoleto'),
    )
    if (bortoletoStanding) {
      expect(bortoletoStanding.teamName).toContain('Audi')
      expect(bortoletoStanding.teamName).not.toBe('Sem Equipe')
    }
  })
})
