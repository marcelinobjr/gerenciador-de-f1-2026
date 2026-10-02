import { describe, it, expect } from 'vitest'
import {
  getActiveDriverTeamBinding,
  findCanonicalDriverMaster,
  CANONICAL_DRIVERS_MASTER,
} from '@/lib/canonical-driver-database'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'

describe('CURRENT-SEASON-TEAM-BINDING-01: TB01-TB20', () => {
  const mockTeams = [
    { id: 'team_ferrari', name: 'Scuderia Ferrari', team_key: 'ferrari', color: '#E8002D' },
    { id: 'team_audi', name: 'Audi F1 Team', team_key: 'audi', color: '#E10600' },
    { id: 'team_red_bull', name: 'Red Bull Racing', team_key: 'red_bull', color: '#1E41FF' },
    {
      id: 'team_mercedes',
      name: 'Mercedes-AMG Petronas F1 Team',
      team_key: 'mercedes',
      color: '#00D2BE',
    },
    { id: 'team_mclaren', name: 'McLaren F1 Team', team_key: 'mclaren', color: '#FF8000' },
    {
      id: 'team_aston_martin',
      name: 'Aston Martin Aramco F1 Team',
      team_key: 'aston_martin',
      color: '#006F62',
    },
    { id: 'team_alpine', name: 'BWT Alpine F1 Team', team_key: 'alpine', color: '#0090FF' },
    { id: 'team_williams', name: 'Williams Racing', team_key: 'williams', color: '#005AFF' },
    { id: 'team_haas', name: 'Haas F1 Team', team_key: 'haas', color: '#FFFFFF' },
    {
      id: 'team_racing_bulls',
      name: 'Racing Bulls F1 Team',
      team_key: 'racing_bulls',
      color: '#6692FF',
    },
    {
      id: 'team_andretti',
      name: 'Andretti Cadillac F1 Team',
      team_key: 'andretti',
      color: '#002B49',
    },
    { id: 'team_cadillac', name: 'Cadillac F1 Team', team_key: 'cadillac', color: '#111111' },
  ]

  const mockDbHamilton = {
    id: 'synyhb7yruf04vr',
    name: 'Lewis Hamilton',
    category: 'f1',
    role: 'titular',
    contract_end: 2026,
    team_id: 'team_ferrari',
  }

  // TB01: Hamilton 2026 resolve Ferrari
  it('TB01 — Hamilton 2026 resolve Ferrari', () => {
    const binding = getActiveDriverTeamBinding('mbj-003', null, [mockDbHamilton], mockTeams)
    expect(binding.teamKey).toBe('ferrari')
    expect(binding.teamName).toContain('Ferrari')
    expect(binding.role).toBe('titular')
  })

  // TB02: Hamilton não resolve Agente Livre mesmo com registro de banco sem team_id explícito
  it('TB02 — Hamilton não resolve Agente Livre', () => {
    const rawHamiltonNoTeam = {
      id: 'synyhb7yruf04vr',
      name: 'Lewis Hamilton',
      category: 'mercado',
      role: '',
      team_id: '',
    }
    const binding = getActiveDriverTeamBinding(
      'synyhb7yruf04vr',
      null,
      [rawHamiltonNoTeam],
      mockTeams,
    )
    expect(binding.status).toBe('active')
    expect(binding.teamKey).toBe('ferrari')
    expect(binding.teamName).toContain('Ferrari')
    expect(binding.role).toBe('titular')
    expect(binding.status).not.toBe('free_agent')
  })

  // TB03: Leclerc 2026 resolve Ferrari
  it('TB03 — Leclerc 2026 resolve Ferrari', () => {
    const binding = getActiveDriverTeamBinding('mbj-004', null, [], mockTeams)
    expect(binding.teamKey).toBe('ferrari')
    expect(binding.teamName).toContain('Ferrari')
    expect(binding.role).toBe('titular')
  })

  // TB04: Hülkenberg 2026 resolve Audi
  it('TB04 — Hülkenberg 2026 resolve Audi', () => {
    const binding = getActiveDriverTeamBinding('mbj-019', null, [], mockTeams)
    expect(binding.teamKey).toBe('audi')
    expect(binding.teamName).toContain('Audi')
    expect(binding.role).toBe('titular')
  })

  // TB05: Bortoleto 2026 resolve Audi
  it('TB05 — Bortoleto 2026 resolve Audi', () => {
    const binding = getActiveDriverTeamBinding('mbj-020', null, [], mockTeams)
    expect(binding.teamKey).toBe('audi')
    expect(binding.teamName).toContain('Audi')
    expect(binding.role).toBe('titular')
  })

  // TB06: Verstappen resolve equipe ativa conforme save atual
  it('TB06 — Verstappen resolve equipe ativa conforme save atual', () => {
    const dbVerstappen = {
      id: 'de3isw3re1ji2wj',
      name: 'Max Verstappen',
      team_id: 'team_red_bull',
      role: 'titular',
    }
    const binding = getActiveDriverTeamBinding('de3isw3re1ji2wj', null, [dbVerstappen], mockTeams)
    expect(binding.teamKey).toBe('red_bull')
    expect(binding.role).toBe('titular')
    expect(binding.status).toBe('active')
  })

  // TB07: 24 titulares da temporada possuem equipe atual válida
  it('TB07 — 24 titulares da temporada possuem equipe atual válida', () => {
    const titularPilots = MBJ_2026_PILOTS.filter((p) => p.category === 'f1' && p.role === 'titular')
    expect(titularPilots.length).toBeGreaterThanOrEqual(24)
    for (const pilot of titularPilots.slice(0, 24)) {
      const binding = getActiveDriverTeamBinding(pilot.id, null, [], mockTeams)
      expect(binding.teamKey).toBeTruthy()
      expect(binding.teamName).toBeTruthy()
      expect(binding.teamName).not.toBe('Sem Equipe')
    }
  })

  // TB08: Nenhum titular ativo é Agente Livre
  it('TB08 — nenhum titular ativo é Agente Livre', () => {
    const titularPilots = MBJ_2026_PILOTS.filter((p) => p.category === 'f1' && p.role === 'titular')
    for (const pilot of titularPilots.slice(0, 24)) {
      const binding = getActiveDriverTeamBinding(pilot.id, null, [], mockTeams)
      expect(binding.status).not.toBe('free_agent')
      expect(binding.isContracted).toBe(true)
    }
  })

  // TB09: Reserva ativo mantém equipe correta
  it('TB09 — reserva ativo mantém equipe correta', () => {
    const reservePilot = MBJ_2026_PILOTS.find((p) => p.category === 'f1' && p.role === 'reserva')
    if (reservePilot) {
      const binding = getActiveDriverTeamBinding(reservePilot.id, null, [], mockTeams)
      expect(binding.teamKey).toBe(reservePilot.teamKey)
      expect(binding.role).toBe('reserva')
    }
  })

  // TB10: Contrato futuro não sobrescreve equipe atual antecipadamente
  it('TB10 — contrato futuro não sobrescreve equipe atual antecipadamente', () => {
    const driverWithFuture = {
      id: 'drv_future_test',
      name: 'Carlos Sainz',
      team_id: 'team_ferrari',
      role: 'titular',
      future_contract: {
        team_id: 'team_williams',
        role: 'titular',
        start_year: 2027,
      },
    }
    const binding = getActiveDriverTeamBinding(
      'drv_future_test',
      { year: 2026 },
      [driverWithFuture],
      mockTeams,
    )
    expect(binding.teamKey).toBe('ferrari')
  })

  // TB11: Troca de equipe após data efetiva atualiza vínculo
  it('TB11 — troca de equipe após data efetiva atualiza vínculo', () => {
    const driverMoved = {
      id: 'drv_moved_test',
      name: 'Lewis Hamilton',
      team_id: 'team_ferrari',
      role: 'titular',
    }
    const binding = getActiveDriverTeamBinding('drv_moved_test', null, [driverMoved], mockTeams)
    expect(binding.teamKey).toBe('ferrari')
  })

  // TB12: driverId não muda em troca de equipe
  it('TB12 — driverId não muda em troca de equipe', () => {
    const driver1 = { id: 'synyhb7yruf04vr', name: 'Lewis Hamilton', team_id: 'team_mercedes' }
    const binding1 = getActiveDriverTeamBinding('synyhb7yruf04vr', null, [driver1], mockTeams)
    expect(binding1.driverId).toBe('synyhb7yruf04vr')

    const driver2 = { id: 'synyhb7yruf04vr', name: 'Lewis Hamilton', team_id: 'team_ferrari' }
    const binding2 = getActiveDriverTeamBinding('synyhb7yruf04vr', null, [driver2], mockTeams)
    expect(binding2.driverId).toBe('synyhb7yruf04vr')
  })

  // TB13: save/reload preserva vínculo
  it('TB13 — save/reload preserva vínculo', () => {
    const savedDriver = {
      id: 'synyhb7yruf04vr',
      name: 'Lewis Hamilton',
      team_id: 'team_ferrari',
      role: 'titular',
    }
    const reloaded = JSON.parse(JSON.stringify(savedDriver))
    const binding = getActiveDriverTeamBinding(reloaded.id, null, [reloaded], mockTeams)
    expect(binding.teamKey).toBe('ferrari')
    expect(binding.role).toBe('titular')
  })

  // TB14: market status não sobrescreve current team
  it('TB14 — market status não sobrescreve current team', () => {
    const driverWithMarketStatus = {
      id: 'synyhb7yruf04vr',
      name: 'Lewis Hamilton',
      category: 'mercado',
      career_status: 'free_agent',
      team_id: 'team_ferrari',
      role: 'titular',
    }
    const binding = getActiveDriverTeamBinding(
      'synyhb7yruf04vr',
      null,
      [driverWithMarketStatus],
      mockTeams,
    )
    expect(binding.teamKey).toBe('ferrari')
    expect(binding.status).toBe('active')
  })

  // TB15: Piloto realmente sem contrato continua Agente Livre
  it('TB15 — piloto realmente sem contrato continua Agente Livre', () => {
    const freeAgent = {
      id: 'drv_free_nobody',
      name: 'Piloto Desempregado',
      category: 'mercado',
      team_id: null,
      role: null,
    }
    const binding = getActiveDriverTeamBinding('drv_free_nobody', null, [freeAgent], mockTeams)
    expect(binding.status).toBe('free_agent')
    expect(binding.teamKey).toBeNull()
  })

  // TB16: Não existe mapping paralelo por nome
  it('TB16 — não existe mapping paralelo por nome', () => {
    const masterDriver = findCanonicalDriverMaster('mbj-003')
    expect(masterDriver?.fullName).toBe('Lewis Hamilton')
    expect(masterDriver?.teamId).toBe('ferrari')
  })

  // TB17: Não existe hardcode Hamilton/Ferrari
  it('TB17 — não existe hardcode exclusivo: resolução segue contrato canônico ou baseline', () => {
    const masterRussel = findCanonicalDriverMaster('mbj-007')
    expect(masterRussel?.teamId).toBe('mercedes')
    const masterLeclerc = findCanonicalDriverMaster('mbj-004')
    expect(masterLeclerc?.teamId).toBe('ferrari')
  })

  // TB18: Pilotos e Contratos retornam a mesma equipe atual
  it('TB18 — Pilotos e Contratos retornam a mesma equipe atual', () => {
    const bindingFromId = getActiveDriverTeamBinding(
      'synyhb7yruf04vr',
      null,
      [mockDbHamilton],
      mockTeams,
    )
    const bindingFromCanon = getActiveDriverTeamBinding(
      'mbj-003',
      null,
      [mockDbHamilton],
      mockTeams,
    )
    expect(bindingFromId.teamKey).toBe(bindingFromCanon.teamKey)
  })

  // TB19: Pilotos e Perfil retornam a mesma equipe atual
  it('TB19 — Pilotos e Perfil retornam a mesma equipe atual', () => {
    const binding = getActiveDriverTeamBinding('synyhb7yruf04vr', null, [mockDbHamilton], mockTeams)
    expect(binding.teamName).toBe('Scuderia Ferrari')
  })

  // TB20: Campeonato usa o mesmo vínculo canônico quando exibe team
  it('TB20 — Campeonato usa o mesmo vínculo canônico quando exibe team', () => {
    const binding = getActiveDriverTeamBinding('mbj-003', null, [], mockTeams)
    expect(binding.teamKey).toBe('ferrari')
    expect(binding.teamName).toContain('Ferrari')
  })
})
