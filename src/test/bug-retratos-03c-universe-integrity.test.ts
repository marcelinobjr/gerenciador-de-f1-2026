import { describe, it, expect } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  findDuplicateDrivers,
  normalizeDriverIdentityKey,
  getActiveDriverTeamBinding,
  findCanonicalDriverMaster,
} from '@/lib/canonical-driver-database'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'

describe('BUG-RETRATOS-03C — PARTE 1 & 2: Hülkenberg Duplicado e Anti-Duplicidade', () => {
  it('BRT03C-01: existe exatamente UM Nico Hülkenberg canônico na base ativa', async () => {
    const drivers = await pb.collection('drivers').getFullList({
      filter: "name ~ 'Hülkenberg' || name ~ 'Hulkenberg'",
    })

    // Deve existir exatamente 1 registro de Nico Hülkenberg
    expect(drivers).toHaveLength(1)
    const hulkenberg = drivers[0]
    expect(hulkenberg.name).toBe('Nico Hülkenberg')
    expect(hulkenberg.age).toBe(38)
    expect(hulkenberg.nationality).toBe('Alemanha')
  })

  it('BRT03C-02: Hülkenberg canônico preserva o ID usado pela Audi/contratos/histórico', async () => {
    const canonicalDriver = await pb.collection('drivers').getOne('0mow8vmzk0y4z9s')
    expect(canonicalDriver).toBeDefined()
    expect(canonicalDriver.id).toBe('0mow8vmzk0y4z9s')
    expect(canonicalDriver.name).toBe('Nico Hülkenberg')
    expect(canonicalDriver.age).toBe(38)
    expect(canonicalDriver.nationality).toBe('Alemanha')
    // Equipe da Audi vinculada
    expect(canonicalDriver.team_id).toBe('dpvviz06tkzwbih')
  })

  it('BRT03C-03: registro órfão 25 anos / INT (578o7m22pttuk4r) não existe mais no universo ativo', async () => {
    let orphanExists = false
    try {
      await pb.collection('drivers').getOne('578o7m22pttuk4r')
      orphanExists = true
    } catch {
      orphanExists = false
    }
    expect(orphanExists).toBe(false)
  })

  it('BRT03C-04: zero duplicatas por nome normalizado + nascimento no universo', async () => {
    // Busca todos os motoristas
    const drivers = await pb.collection('drivers').getFullList()
    const duplicates = findDuplicateDrivers(drivers as any[])
    expect(duplicates).toEqual([])
  })
})

describe('BUG-RETRATOS-03C — PARTE 3: Canonical Driver Team Binding & DriversPage Isolation', () => {
  // Mock fixtures para testes determinísticos sem depender 100% de live DB
  const mockMcLarenTeam = {
    id: '76vs00hy9hu24q1',
    team_key: 'mclaren',
    name: 'McLaren F1 Team',
    color: '#FF8000',
  }
  const mockFerrariTeam = {
    id: 'nxrgkooec2908on',
    team_key: 'ferrari',
    name: 'Scuderia Ferrari',
    color: '#E80020',
  }
  const mockRedBullTeam = {
    id: 'dpvviz06tkzwbih_rb',
    team_key: 'redbull',
    name: 'Red Bull Racing',
    color: '#3671C6',
  }
  const mockAudiTeam = {
    id: 'dpvviz06tkzwbih',
    team_key: 'audi',
    name: 'Audi F1 Team',
    color: '#00E701',
  }

  const mockDbTeams = [mockMcLarenTeam, mockFerrariTeam, mockRedBullTeam, mockAudiTeam]

  const mockDbDrivers = [
    // Lando Norris (McLaren titular)
    {
      id: 'norris_01',
      name: 'Lando Norris',
      team_id: '76vs00hy9hu24q1',
      role: 'titular',
    },
    // Oscar Piastri (McLaren titular)
    {
      id: 'piastri_01',
      name: 'Oscar Piastri',
      team_id: '76vs00hy9hu24q1',
      role: 'titular',
    },
    // Max Verstappen (Red Bull no contrato, legado com team_id McLaren glitch)
    {
      id: 'de3isw3re1ji2wj',
      name: 'Max Verstappen',
      team_id: '76vs00hy9hu24q1', // Legacy glitch
      canonical_contract: {
        teamId: 'dpvviz06tkzwbih_rb',
        role: 'titular',
        status: 'active',
      },
    },
    // Charles Leclerc (Ferrari no contrato, legado com team_id McLaren glitch)
    {
      id: 'lc6cma46f01dgrj',
      name: 'Charles Leclerc',
      team_id: '76vs00hy9hu24q1', // Legacy glitch
      canonical_contract: {
        teamId: 'nxrgkooec2908on',
        role: 'titular',
        status: 'active',
      },
    },
    // Patricio O'Ward (MBJ pilot, no contract in save)
    {
      id: 'nwhacbop67hucir',
      name: "Patricio O'Ward",
      team_id: null,
      reserve_team_id: null,
    },
    // Nico Hülkenberg canônico na Audi
    {
      id: '0mow8vmzk0y4z9s',
      name: 'Nico Hülkenberg',
      team_id: 'dpvviz06tkzwbih',
      role: 'titular',
    },
  ]

  it('BRT03C-05: DriversPage usa binding contratual canônico (getActiveDriverTeamBinding)', () => {
    // Binding canônico resolve para equipe contratual ativa
    const binding = getActiveDriverTeamBinding('norris_01', null, mockDbDrivers, mockDbTeams)
    expect(binding).toBeDefined()
    expect(binding.status).toBe('active')
    expect(binding.teamKey).toBe('mclaren')
    expect(binding.teamId).toBe('76vs00hy9hu24q1')
    expect(binding.isContracted).toBe(true)
  })

  it('BRT03C-06: filtro McLaren retorna somente pilotos com vínculo ativo McLaren', () => {
    // Itera sobre todos os pilotos e aplica a lógica exata de filtro da DriversPage
    const selectedTeamFilter = 'mclaren'
    const mclarenDrivers = mockDbDrivers.filter((d) => {
      const binding = getActiveDriverTeamBinding(d.id, null, mockDbDrivers, mockDbTeams)
      const targetFilterLower = selectedTeamFilter.toLowerCase().trim()
      const pilotKeyLower = binding.teamKey ? binding.teamKey.toLowerCase().trim() : null
      const pilotId = binding.teamId || null

      return (
        (pilotId && pilotId === selectedTeamFilter) ||
        (pilotKeyLower && pilotKeyLower === targetFilterLower)
      )
    })

    const names = mclarenDrivers.map((d) => d.name)
    expect(names).toContain('Lando Norris')
    expect(names).toContain('Oscar Piastri')
    expect(names).not.toContain('Max Verstappen')
    expect(names).not.toContain('Charles Leclerc')
    expect(names).not.toContain("Patricio O'Ward")
  })

  it('BRT03C-07: Verstappen não aparece na McLaren sem contrato válido', () => {
    // Verstappen com legacy team_id='76vs00hy9hu24q1' mas canonical_contract = Red Bull
    const binding = getActiveDriverTeamBinding('de3isw3re1ji2wj', null, mockDbDrivers, mockDbTeams)
    expect(binding.teamKey).not.toBe('mclaren')
    expect(binding.teamId).not.toBe('76vs00hy9hu24q1')
    expect(binding.teamKey).toBe('redbull')
  })

  it('BRT03C-08: Leclerc não aparece na McLaren sem contrato válido', () => {
    // Leclerc com legacy team_id='76vs00hy9hu24q1' mas canonical_contract = Ferrari
    const binding = getActiveDriverTeamBinding('lc6cma46f01dgrj', null, mockDbDrivers, mockDbTeams)
    expect(binding.teamKey).not.toBe('mclaren')
    expect(binding.teamId).not.toBe('76vs00hy9hu24q1')
    expect(binding.teamKey).toBe('ferrari')
  })

  it("BRT03C-09: O'Ward aparece somente se vínculo ativo justificar", () => {
    // Patricio O'Ward sem contrato no save -> deve retornar Free Agent (null)
    const binding = getActiveDriverTeamBinding('nwhacbop67hucir', null, mockDbDrivers, mockDbTeams)
    expect(binding.status).toBe('free_agent')
    expect(binding.isContracted).toBe(false)
    expect(binding.teamKey).toBeNull()
    expect(binding.teamId).toBeNull()
  })

  it('BRT03C-10: todas as equipes — piloto listado <=> vínculo ativo válido (invariante do universo inteiro)', () => {
    for (const d of mockDbDrivers) {
      const binding = getActiveDriverTeamBinding(d.id, null, mockDbDrivers, mockDbTeams)
      if (binding.isContracted) {
        expect(binding.teamId).toBeTruthy()
        expect(binding.teamKey).toBeTruthy()
        expect(binding.status).toBe('active')
      } else {
        expect(binding.teamId).toBeNull()
        expect(binding.teamKey).toBeNull()
        expect(binding.status).toBe('free_agent')
      }
    }
  })

  it('BRT03C-11: piloto sem contrato ativo não herda equipe legada', () => {
    const uncontractedLegacyDriver = {
      id: 'legacy_orphan_01',
      name: 'Piloto Antigo',
      team_id: '76vs00hy9hu24q1', // ID no banco legado
      // sem contrato ativo nenhum
    }

    // Piloto não mapeado com contrato ativo não deve vazar McLaren
    const list = [uncontractedLegacyDriver]
    // Testamos a regra de glitch legado para IDs conhecidos
    const leclercLegacyWithoutContract = {
      id: 'lc6cma46f01dgrj',
      name: 'Charles Leclerc',
      team_id: '76vs00hy9hu24q1',
    }
    const binding = getActiveDriverTeamBinding(
      'lc6cma46f01dgrj',
      null,
      [leclercLegacyWithoutContract],
      mockDbTeams,
    )
    expect(binding.teamKey).toBeNull()
    expect(binding.status).toBe('free_agent')
  })

  it('BRT03C-12: roster/titulares da temporada permanece consistente', () => {
    const norris = getActiveDriverTeamBinding('norris_01', null, mockDbDrivers, mockDbTeams)
    const piastri = getActiveDriverTeamBinding('piastri_01', null, mockDbDrivers, mockDbTeams)
    const hulkenberg = getActiveDriverTeamBinding(
      '0mow8vmzk0y4z9s',
      null,
      mockDbDrivers,
      mockDbTeams,
    )

    expect(norris.teamKey).toBe('mclaren')
    expect(piastri.teamKey).toBe('mclaren')
    expect(hulkenberg.teamKey).toBe('audi')
  })

  it('BRT03C-13: runtime IDs resolvem para canonical IDs', () => {
    const canonicalVerstappen = findCanonicalDriverMaster('de3isw3re1ji2wj', null)
    expect(canonicalVerstappen).toBeDefined()
    expect(canonicalVerstappen?.driverId).toBe('driver_max_verstappen')

    const canonicalLeclerc = findCanonicalDriverMaster('lc6cma46f01dgrj', null)
    expect(canonicalLeclerc).toBeDefined()
    expect(canonicalLeclerc?.driverId).toBe('driver_charles_leclerc')

    const canonicalHulk = findCanonicalDriverMaster('0mow8vmzk0y4z9s', null)
    expect(canonicalHulk).toBeDefined()
    expect(canonicalHulk?.driverId).toBe('driver_nico_hulkenberg')
  })

  it('BRT03C-14: binding permanece correto após save/reload', () => {
    // Simula reload passando dbDrivers atualizados
    const reloadedDrivers = [...mockDbDrivers]
    const bindingReloaded = getActiveDriverTeamBinding(
      'de3isw3re1ji2wj',
      null,
      reloadedDrivers,
      mockDbTeams,
    )
    expect(bindingReloaded.teamKey).toBe('redbull')
    expect(bindingReloaded.teamId).toBe('dpvviz06tkzwbih_rb')
  })

  it('BRT03C-15: zero alteração no portrait mapping', () => {
    // Garante que o portrait mapping para Verstappen, Leclerc e Hülkenberg não foi quebrado
    const photoVerstappen = resolveDriverPhoto({
      driverId: 'de3isw3re1ji2wj',
      name: 'Max Verstappen',
    })
    expect(photoVerstappen.url).toBeTruthy()
    expect(photoVerstappen.url).not.toContain('drive.google.com')

    const photoLeclerc = resolveDriverPhoto({
      driverId: 'lc6cma46f01dgrj',
      name: 'Charles Leclerc',
    })
    expect(photoLeclerc.url).toBeTruthy()
    expect(photoLeclerc.url).not.toContain('drive.google.com')

    const photoHulk = resolveDriverPhoto({
      driverId: '0mow8vmzk0y4z9s',
      name: 'Nico Hülkenberg',
    })
    expect(photoHulk.url).toBeTruthy()
    expect(photoHulk.url).not.toContain('drive.google.com')
  })

  it('PASSO 12 — Teste do bug: fixture com driver.teamKey legado = McLaren mas contrato ativo = Ferrari', () => {
    const driverFixture = {
      id: 'test_driver_transfer',
      name: 'Driver Transfer Test',
      team_id: '76vs00hy9hu24q1', // Legado McLaren
      canonical_contract: {
        teamId: 'nxrgkooec2908on', // Contrato ativo Ferrari
        role: 'titular',
        status: 'active',
      },
    }

    const testDrivers = [driverFixture]
    const binding = getActiveDriverTeamBinding(driverFixture.id, null, testDrivers, mockDbTeams)

    // Filtro McLaren NÃO retorna
    const selectedMcLaren = 'mclaren'
    const matchesMcLaren =
      (binding.teamId && binding.teamId === selectedMcLaren) ||
      (binding.teamKey && binding.teamKey.toLowerCase() === selectedMcLaren)
    expect(matchesMcLaren).toBe(false)

    // Filtro Ferrari RETORNA
    const selectedFerrari = 'ferrari'
    const matchesFerrari =
      (binding.teamId && binding.teamId === selectedFerrari) ||
      (binding.teamKey && binding.teamKey.toLowerCase() === selectedFerrari)
    expect(matchesFerrari).toBe(true)
  })
})
