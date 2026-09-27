import { describe, it, expect } from 'vitest'
import { getActiveDriverTeamBinding, findCanonicalDriverMaster } from '@/lib/canonical-driver-database'
import { resolveCircuitImagePath, CANONICAL_CIRCUIT_IMAGES } from '@/lib/circuit-assets'

describe('PILOTOS-LISTA-02: Resolução canônica de vínculo do Verstappen', () => {
  it('Verstappen tem registro mestre canônico e não deve degradar para agente livre por inconsistência', () => {
    const master = findCanonicalDriverMaster('de3isw3re1ji2wj', null)
    expect(master).toBeDefined()
    expect(master?.fullName).toBe('Max Verstappen')

    // Cenário onde o save tem um team_id que não bate diretamente com dbTeams
    const mockDbDriver = {
      id: 'de3isw3re1ji2wj',
      name: 'Max Verstappen',
      team_id: '76vs00hy9hu24q1', // ID divergente de runtime
      role: 'titular',
    }
    const mockDbTeams = [
      { id: 'team_red_bull', team_key: 'red_bull', name: 'Red Bull Racing', color: '#1E41FF' },
    ]

    const binding = getActiveDriverTeamBinding(
      mockDbDriver.id,
      { year: 2026 },
      [mockDbDriver],
      mockDbTeams,
    )

    // Não deve degradar silenciosamente para 'free_agent' quando o piloto tem vínculo no banco
    expect(binding.status).toBe('active')
    expect(binding.isContracted).toBe(true)
    expect(binding.teamKey).toBe('red_bull')
  })

  it('Piloto realmente livre permanece com status free_agent', () => {
    const binding = getActiveDriverTeamBinding(
      'unknown_free_agent_id',
      { year: 2026 },
      [],
      [],
    )
    expect(binding.status).toBe('free_agent')
    expect(binding.isContracted).toBe(false)
    expect(binding.teamId).toBeNull()
  })

  it('V01/V03: Piloto com vínculo persistido no banco e team_id órfão sem canonicalDriver NÃO degrada para free_agent silencioso', () => {
    const orphanDriver = {
      id: 'custom_driver_99',
      name: 'Piloto Teste Inconsistente',
      team_id: 'legacy_broken_team_xyz',
      role: 'titular',
    }
    const binding = getActiveDriverTeamBinding(
      orphanDriver.id,
      { year: 2026 },
      [orphanDriver],
      [], // sem equipes no banco
    )
    expect(binding.isContracted).toBe(true)
    expect(binding.status).not.toBe('free_agent')
    expect(binding.teamId).toBe('legacy_broken_team_xyz')
  })

  it('V04/V05: Max Verstappen e Charles Leclerc com legado McLaren resolvem suas equipes de contrato/canônicas', () => {
    const mockTeams = [
      { id: 'team_red_bull', team_key: 'red_bull', name: 'Red Bull Racing' },
      { id: 'team_ferrari', team_key: 'ferrari', name: 'Scuderia Ferrari' },
    ]
    const verstappenWithGlitch = {
      id: 'de3isw3re1ji2wj',
      name: 'Max Verstappen',
      team_id: '76vs00hy9hu24q1', // ID legado McLaren
      role: 'titular',
    }
    const leclercWithGlitch = {
      id: 'lc6cma46f01dgrj',
      name: 'Charles Leclerc',
      team_id: '76vs00hy9hu24q1', // ID legado McLaren
      role: 'titular',
    }
    const bindingVerstappen = getActiveDriverTeamBinding(
      verstappenWithGlitch.id,
      { year: 2026 },
      [verstappenWithGlitch],
      mockTeams,
    )
    expect(bindingVerstappen.isContracted).toBe(true)
    expect(bindingVerstappen.teamKey).toBe('red_bull')
    expect(bindingVerstappen.status).toBe('active')

    const bindingLeclerc = getActiveDriverTeamBinding(
      leclercWithGlitch.id,
      { year: 2026 },
      [leclercWithGlitch],
      mockTeams,
    )
    expect(bindingLeclerc.isContracted).toBe(true)
    expect(bindingLeclerc.teamKey).toBe('ferrari')
    expect(bindingLeclerc.status).toBe('active')
  })
})

describe('CALENDARIO-CIRCUITOS-01: Mapeamento de imagens dos circuitos', () => {
  it('deve associar circuitos canônicos aos 24 arquivos reais JPG de public/circuitos', () => {
    expect(resolveCircuitImagePath('australia')).toBe('/circuitos/01-Australia.jpg')
    expect(resolveCircuitImagePath('monza')).toBe('/circuitos/16-Monza.jpg')
    expect(resolveCircuitImagePath('silverstone')).toBe('/circuitos/12-Silverstone.jpg')
    expect(resolveCircuitImagePath('interlagos')).toBe('/circuitos/21-Brasil.jpg')
    expect(resolveCircuitImagePath('spa')).toBe('/circuitos/13-Belgica.jpg')
    expect(resolveCircuitImagePath('abu_dhabi')).toBe('/circuitos/24-Abu_Dhabi.jpg')
    expect(resolveCircuitImagePath('circuito_inexistente')).toBeNull()
  })

  it('o mapeamento é estável, explícito e cobre Australia e Abu Dhabi', () => {
    expect(CANONICAL_CIRCUIT_IMAGES['australia']).toBe('/circuitos/01-Australia.jpg')
    expect(CANONICAL_CIRCUIT_IMAGES['bahrain']).toBe('/circuitos/04-Bahrein.jpg')
    expect(CANONICAL_CIRCUIT_IMAGES['monaco']).toBe('/circuitos/08-Monaco.jpg')
    expect(CANONICAL_CIRCUIT_IMAGES['abu_dhabi']).toBe('/circuitos/24-Abu_Dhabi.jpg')
  })
})