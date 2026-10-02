import { describe, it, expect } from 'vitest'
import {
  resolveCurrentDriverTeam,
  getActiveDriverTeamBinding,
  findCanonicalDriverMaster,
  CANONICAL_DRIVERS_MASTER,
} from '@/lib/canonical-driver-database'
import { ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'

describe('CURRENT-SEASON-TEAM-BINDING-01 (TB01-TB20)', () => {
  // Mock DB Teams representing the 2026 grid (12 teams)
  const mockDbTeams = ALL_GRID_TEAMS_DATABASE.map((t) => ({
    id: `team_${t.key}`,
    team_key: t.key,
    name: t.name,
    color: t.color || '#E10600',
  }))

  const mockDbDrivers = [
    {
      id: 'synyhb7yruf04vr',
      name: 'Lewis Hamilton',
      nationality: 'Reino Unido',
      category: 'mercado', // PocketBase legacy row had 'mercado' / empty team_id
      team_id: '',
      role: '',
    },
    {
      id: 'lc6cma46f01dgrj',
      name: 'Charles Leclerc',
      category: 'f1',
      team_id: 'team_ferrari',
      role: 'titular',
    },
    {
      id: '0mow8vmzk0y4z9s',
      name: 'Nico Hülkenberg',
      category: 'f1',
      team_id: 'team_audi',
      role: 'titular',
    },
    {
      id: '9uazqw522oc9p4z',
      name: 'Gabriel Bortoleto',
      category: 'f1',
      team_id: 'team_audi',
      role: 'titular',
    },
    {
      id: 'de3isw3re1ji2wj',
      name: 'Max Verstappen',
      category: 'f1',
      team_id: 'team_red_bull',
      role: 'titular',
    },
  ]

  // TB01: Lewis Hamilton resolve para Ferrari e Titular
  it('TB01: Lewis Hamilton resolves to Ferrari / Titular', () => {
    const binding = resolveCurrentDriverTeam(
      'synyhb7yruf04vr',
      { year: 2026 },
      2026,
      mockDbDrivers,
      mockDbTeams,
    )
    expect(binding.teamName).toContain('Ferrari')
    expect(binding.role).toBe('titular')
    expect(binding.isContracted).toBe(true)
    expect(binding.status).toBe('active')
  })

  // TB02: Lewis Hamilton NUNCA aparece como "Agente livre"
  it('TB02: Lewis Hamilton never resolves to free_agent when active contract/baseline exists', () => {
    const binding = resolveCurrentDriverTeam('mbj-003', { year: 2026 }, 2026, [], mockDbTeams)
    expect(binding.status).not.toBe('free_agent')
    expect(binding.isContracted).toBe(true)
    expect(binding.teamName).toContain('Ferrari')
  })

  // TB03: Charles Leclerc resolve para Ferrari
  it('TB03: Charles Leclerc resolves to Ferrari / Titular', () => {
    const binding = resolveCurrentDriverTeam(
      'lc6cma46f01dgrj',
      { year: 2026 },
      2026,
      mockDbDrivers,
      mockDbTeams,
    )
    expect(binding.teamName).toContain('Ferrari')
    expect(binding.role).toBe('titular')
  })

  // TB04: Nico Hülkenberg resolve para Audi
  it('TB04: Nico Hülkenberg resolves to Audi', () => {
    const binding = resolveCurrentDriverTeam(
      '0mow8vmzk0y4z9s',
      { year: 2026 },
      2026,
      mockDbDrivers,
      mockDbTeams,
    )
    expect(binding.teamName).toContain('Audi')
    expect(binding.role).toBe('titular')
  })

  // TB05: Gabriel Bortoleto resolve para Audi
  it('TB05: Gabriel Bortoleto resolves to Audi', () => {
    const binding = resolveCurrentDriverTeam(
      '9uazqw522oc9p4z',
      { year: 2026 },
      2026,
      mockDbDrivers,
      mockDbTeams,
    )
    expect(binding.teamName).toContain('Audi')
    expect(binding.role).toBe('titular')
  })

  // TB06: Max Verstappen resolve conforme save / Red Bull
  it('TB06: Max Verstappen resolves to Red Bull Racing as in save', () => {
    const binding = resolveCurrentDriverTeam(
      'de3isw3re1ji2wj',
      { year: 2026 },
      2026,
      mockDbDrivers,
      mockDbTeams,
    )
    expect(binding.teamName).toContain('Red Bull')
    expect(binding.role).toBe('titular')
  })

  // TB07: 24/24 titulares de 2026 possuem equipe válida resolvida
  it('TB07: 24/24 titular drivers across 12 teams have a valid resolved team', () => {
    const titularDrivers = CANONICAL_DRIVERS_MASTER.filter(
      (d) => d.role === 'titular' && d.sourceMbjData.category === 'f1',
    )
    expect(titularDrivers.length).toBeGreaterThanOrEqual(24)

    const resolvedTeams = new Set<string>()
    for (const d of titularDrivers.slice(0, 24)) {
      const b = resolveCurrentDriverTeam(d.driverId, { year: 2026 }, 2026, [], mockDbTeams)
      expect(b.teamName).toBeTruthy()
      expect(b.teamName).not.toBe('Agente livre')
      expect(b.teamName).not.toBe('Sem equipe')
      expect(b.isContracted).toBe(true)
      resolvedTeams.add(b.teamName!)
    }
    expect(resolvedTeams.size).toBe(12)
  })

  // TB08: Nenhum titular do grid oficial é classificado como agente livre
  it('TB08: No official 2026 titular driver is classified as free_agent', () => {
    const titularDrivers = CANONICAL_DRIVERS_MASTER.filter(
      (d) => d.role === 'titular' && d.sourceMbjData.category === 'f1',
    )
    for (const d of titularDrivers) {
      const b = resolveCurrentDriverTeam(d.driverId, { year: 2026 }, 2026, [], mockDbTeams)
      expect(b.status).not.toBe('free_agent')
    }
  })

  // TB09: Reserva oficial mantém equipe vinculada
  it('TB09: Official reserve driver retains assigned team', () => {
    const doohan = CANONICAL_DRIVERS_MASTER.find((d) => d.fullName === 'Jack Doohan')
    expect(doohan).toBeDefined()
    const b = resolveCurrentDriverTeam(doohan!.driverId, { year: 2026 }, 2026, [], mockDbTeams)
    expect(b.teamName).toBeTruthy()
    expect(b.teamName).not.toBe('Agente livre')
    expect(b.role).toBe('reserva')
  })

  // TB10: Contrato futuro não antecipa a equipe atual
  it('TB10: Future contract does not prematurely overwrite current season team', () => {
    const driverWithFutureContract = {
      id: 'driver_future_move',
      name: 'Future Mover',
      team_id: 'team_ferrari',
      role: 'titular',
      next_team_id: 'team_audi',
      next_contract_role: 'titular',
    }
    const b = resolveCurrentDriverTeam(
      'driver_future_move',
      { year: 2026 },
      2026,
      [driverWithFutureContract],
      mockDbTeams,
    )
    expect(b.teamName).toContain('Ferrari')
    expect(b.teamName).not.toContain('Audi')
  })

  // TB11: Troca após data efetiva (temporada seguinte) atualiza a equipe
  it('TB11: Transfer updates team in the new active season', () => {
    const driverIn2027 = {
      id: 'driver_moved_2027',
      name: 'Moved Driver',
      team_id: 'team_audi', // updated in 2027
      role: 'titular',
    }
    const b = resolveCurrentDriverTeam(
      'driver_moved_2027',
      { year: 2027 },
      2027,
      [driverIn2027],
      mockDbTeams,
    )
    expect(b.teamName).toContain('Audi')
  })

  // TB12: driverId permanece imutável após resolução
  it('TB12: Canonical driverId is preserved and never mutated', () => {
    const b = resolveCurrentDriverTeam('mbj-003', { year: 2026 }, 2026, [], mockDbTeams)
    expect(b.driverId).toBe('mbj-003')
  })

  // TB13: Save/reload preserva vínculo do piloto
  it('TB13: Save/reload persistence preserves driver binding', () => {
    const persisted = {
      id: 'persisted_drv',
      name: 'Persistent Driver',
      team_id: 'team_mclaren',
      role: 'titular',
    }
    const b1 = resolveCurrentDriverTeam(
      'persisted_drv',
      { year: 2026 },
      2026,
      [persisted],
      mockDbTeams,
    )
    const reloaded = JSON.parse(JSON.stringify(persisted))
    const b2 = resolveCurrentDriverTeam(
      'persisted_drv',
      { year: 2026 },
      2026,
      [reloaded],
      mockDbTeams,
    )
    expect(b1.teamName).toBe(b2.teamName)
    expect(b1.role).toBe(b2.role)
    expect(b2.teamName).toContain('McLaren')
  })

  // TB14: Market status não sobrescreve equipe sob contrato ativo
  it('TB14: Market status does not override contracted driver team', () => {
    const b = resolveCurrentDriverTeam(
      'synyhb7yruf04vr',
      { year: 2026 },
      2026,
      mockDbDrivers,
      mockDbTeams,
    )
    expect(b.status).toBe('active')
    expect(b.teamName).toContain('Ferrari')
  })

  // TB15: Piloto verdadeiramente sem contrato é Agente livre
  it('TB15: Genuinely uncontracted driver resolves strictly to free_agent', () => {
    const b = resolveCurrentDriverTeam(
      'uncontracted_random_driver_99',
      { year: 2026 },
      2026,
      [],
      mockDbTeams,
    )
    expect(b.status).toBe('free_agent')
    expect(b.teamName).toBeNull()
    expect(b.isContracted).toBe(false)
  })

  // TB16: Sem mapping manual por nome estrito (usa id canônico / token identity)
  it('TB16: Uses canonical identity and token normalization without raw name mapping', () => {
    const b = resolveCurrentDriverTeam(
      'driver_lewis_hamilton',
      { year: 2026 },
      2026,
      [],
      mockDbTeams,
    )
    expect(b.teamName).toContain('Ferrari')
  })

  // TB17: Sem hardcode de Hamilton/Ferrari fora dos metadados estruturais
  it('TB17: Logic is generic and works for other top drivers identically', () => {
    const norris = resolveCurrentDriverTeam('mbj-005', { year: 2026 }, 2026, [], mockDbTeams)
    expect(norris.teamName).toContain('McLaren')
    const verstappen = resolveCurrentDriverTeam('mbj-001', { year: 2026 }, 2026, [], mockDbTeams)
    expect(verstappen.teamName).toContain('Red Bull')
  })

  // TB18: PilotosPage e getActiveDriverTeamBinding são consistentes
  it('TB18: resolveCurrentDriverTeam matches getActiveDriverTeamBinding', () => {
    const b1 = resolveCurrentDriverTeam('mbj-003', { year: 2026 }, 2026, [], mockDbTeams)
    const b2 = getActiveDriverTeamBinding('mbj-003', { year: 2026 }, [], mockDbTeams)
    expect(b1.teamName).toBe(b2.teamName)
    expect(b1.role).toBe(b2.role)
    expect(b1.status).toBe(b2.status)
  })

  // TB19: Perfil/Pilotos/Campeonato consomem o mesmo resolver
  it('TB19: Profile, DriversPage and Championship surfaces resolve consistent team', () => {
    const bPilotos = resolveCurrentDriverTeam(
      'synyhb7yruf04vr',
      { year: 2026 },
      2026,
      mockDbDrivers,
      mockDbTeams,
    )
    const bPerfil = resolveCurrentDriverTeam(
      'mbj-003',
      { year: 2026 },
      2026,
      mockDbDrivers,
      mockDbTeams,
    )
    expect(bPilotos.teamName).toBe(bPerfil.teamName)
    expect(bPilotos.role).toBe(bPerfil.role)
  })

  // TB20: Resolução para nulo/indefinido é graciosa e segura
  it('TB20: Graceful resolution for null or undefined driverId', () => {
    const bNull = resolveCurrentDriverTeam(null, { year: 2026 }, 2026, [], mockDbTeams)
    expect(bNull.status).toBe('free_agent')
    expect(bNull.teamName).toBeNull()

    const bUndef = resolveCurrentDriverTeam(undefined, { year: 2026 }, 2026, [], mockDbTeams)
    expect(bUndef.status).toBe('free_agent')
  })
})
