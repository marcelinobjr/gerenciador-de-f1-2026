import { describe, it, expect } from 'vitest'
import { getActiveDriverTeamBinding } from '@/lib/canonical-driver-database'
import { resolveCountryFlag, countryName } from '@/lib/country-flag'

describe('PILOTOS-LISTA-01: Vínculos e Resolução Canônica', () => {
  const mockDbTeams = [
    {
      id: 'team-mclaren',
      team_key: 'mclaren',
      name: 'McLaren F1 Team',
      color: '#FF8000',
    },
    {
      id: 'team-redbull',
      team_key: 'red_bull',
      name: 'Red Bull Racing',
      color: '#0600EF',
    },
    {
      id: 'team-ferrari',
      team_key: 'ferrari',
      name: 'Scuderia Ferrari',
      color: '#E80020',
    },
  ]

  const mockDbDrivers = [
    {
      id: 'de3isw3re1ji2wj',
      name: 'Max Verstappen',
      nationality: 'Holanda',
      age: 28,
      team_id: 'team-redbull',
      role: 'titular',
      salary: 50000000,
      contract_end: 2029,
    },
    {
      id: 'palou-free',
      name: 'Alex Palou',
      nationality: 'Espanha',
      age: 28,
      team_id: null,
      role: null,
      salary: 4000000,
    },
  ]

  it('1. Max Verstappen com vínculo ativo no banco não é apresentado como agente livre', () => {
    // Consulta direta pelo runtime ID do Verstappen
    const binding = getActiveDriverTeamBinding(
      'de3isw3re1ji2wj',
      { year: 2026 },
      mockDbDrivers,
      mockDbTeams,
    )

    expect(binding.isContracted).toBe(true)
    expect(binding.status).toBe('active')
    expect(binding.teamId).toBe('team-redbull')
    expect(binding.teamName).toBe('Red Bull Racing')
    expect(binding.role).toBe('titular')
  })

  it('2. Max Verstappen consultado por ID canônico mbj-001 resolve o contrato do save', () => {
    const binding = getActiveDriverTeamBinding(
      'mbj-001',
      { year: 2026 },
      mockDbDrivers,
      mockDbTeams,
    )

    expect(binding.isContracted).toBe(true)
    expect(binding.teamId).toBe('team-redbull')
    expect(binding.teamName).toBe('Red Bull Racing')
  })

  it('3. Piloto legitimamente sem contrato continua como agente livre', () => {
    const binding = getActiveDriverTeamBinding(
      'palou-free',
      { year: 2026 },
      mockDbDrivers,
      mockDbTeams,
    )

    expect(binding.isContracted).toBe(false)
    expect(binding.status).toBe('free_agent')
    expect(binding.teamId).toBeNull()
    expect(binding.teamName).toBeNull()
  })

  it('4. Erro de resolução não vira liberdade contratual silenciosa', () => {
    // ID desconhecido sem vínculo no banco nem canônico
    const binding = getActiveDriverTeamBinding(
      'unknown-driver-id',
      { year: 2026 },
      mockDbDrivers,
      mockDbTeams,
    )

    expect(binding.teamId).toBeNull()
    expect(binding.isContracted).toBe(false)
    expect(binding.canonicalDriver).toBeNull()
  })

  it('5. Nacionalidade resolve bandeira emoji e nome amigável corretamente', () => {
    expect(resolveCountryFlag('Holanda')).toBe('🇳🇱')
    expect(countryName('Holanda')).toBe('Países Baixos')

    expect(resolveCountryFlag('Brasil')).toBe('🇧🇷')
    expect(countryName('BRA')).toBe('Brasil')

    expect(resolveCountryFlag('Mônaco')).toBe('🇲🇨')
    expect(countryName('MON')).toBe('Mônaco')
  })
})
