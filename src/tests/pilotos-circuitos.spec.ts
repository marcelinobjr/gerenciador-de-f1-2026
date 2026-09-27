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
})

describe('CALENDARIO-CIRCUITOS-01: Mapeamento de imagens dos circuitos', () => {
  it('deve associar circuitos canônicos aos arquivos reais sem fallback silencioso para outro circuito', () => {
    expect(resolveCircuitImagePath('monza')).toBe('/circuitos/monza.png')
    expect(resolveCircuitImagePath('silverstone')).toBe('/circuitos/silverstone.png')
    expect(resolveCircuitImagePath('interlagos')).toBe('/circuitos/interlagos.png')
    expect(resolveCircuitImagePath('spa')).toBe('/circuitos/spa.png')
    expect(resolveCircuitImagePath('circuito_inexistente')).toBeNull()
  })

  it('o mapeamento é estável e explícito', () => {
    expect(CANONICAL_CIRCUIT_IMAGES['bahrain']).toBe('/circuitos/bahrain.png')
    expect(CANONICAL_CIRCUIT_IMAGES['monaco']).toBe('/circuitos/monaco.png')
  })
})
