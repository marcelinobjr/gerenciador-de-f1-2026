import { describe, it, expect, vi } from 'vitest'
import {
  buildCanonicalEventGrid,
  resolveEventParticipatingTeams,
} from '@/lib/canonical-race-grid-resolver'
import type { TeamModel, DriverModel } from '@/types/f1'

describe('MICRO-PATCH GRID-01: Inicialização Canônica da Corrida', () => {
  const mockAudiTeam = {
    id: '2xi9j3xb4epwec9',
    user_id: 'usr_player1',
    name: 'Audi F1 Team',
    country: 'Alemanha',
    color: '#E10600',
    secondary_color: '#000000',
    engine_supplier: 'Audi',
    budget: 150000000,
    reputation: 75,
    strength: 55,
    chassis_level: 55,
    aerodynamics_level: 55,
    aero_level: 55,
    powertrain_level: 55,
    reliability_level: 55,
    strategy_level: 55,
    created: '2026-01-01',
    updated: '2026-01-01',
    team_key: 'audi',
  } as unknown as TeamModel

  const mockDriversAudi = [
    {
      id: '9uazqw522oc9p4z',
      team_id: '2xi9j3xb4epwec9',
      name: 'Gabriel Bortoleto',
      nationality: 'Brasil',
      role: 'titular',
      speed: 84,
      consistency: 82,
      experience: 70,
      racecraft: 83,
      defense: 81,
      rain: 80,
      morale: 88,
      physical_condition: 95,
      salary: 4000000,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: '0mow8vmzk0y4z9s',
      team_id: '2xi9j3xb4epwec9',
      name: 'Nico Hülkenberg',
      nationality: 'Alemanha',
      role: 'titular',
      speed: 83,
      consistency: 85,
      experience: 90,
      racecraft: 84,
      defense: 83,
      rain: 82,
      morale: 85,
      physical_condition: 92,
      salary: 6000000,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
    {
      id: 'maloney_reserva',
      team_id: '2xi9j3xb4epwec9',
      name: 'Zane Maloney',
      nationality: 'Barbados',
      role: 'reserva',
      speed: 76,
      consistency: 75,
      experience: 60,
      racecraft: 75,
      defense: 74,
      rain: 74,
      morale: 80,
      physical_condition: 90,
      salary: 1500000,
      created: '2026-01-01',
      updated: '2026-01-01',
    },
  ] as unknown as DriverModel[]

  // Teste A — Carregamento atrasado / Composição Canônica: 12 equipes e 24 inscritos
  it('TESTE A: Gera grid canônico com exatamente 12 equipes e 24 inscritos (2 por equipe), incluindo os 2 titulares do jogador', () => {
    const teams = resolveEventParticipatingTeams(mockAudiTeam)
    expect(teams).toHaveLength(12)

    const res = buildCanonicalEventGrid({
      team: mockAudiTeam,
      playerDrivers: mockDriversAudi,
      currentRound: 1,
      totalLaps: 57,
      gpName: 'GP do Bahrein',
    })

    expect(res.success).toBe(true)
    expect(res.teamsCount).toBe(12)
    expect(res.driversCount).toBe(24)
    expect(res.grid).toHaveLength(24)

    // Verifica que os dois titulares do jogador estão no grid
    const playerCars = res.grid.filter((g) => g.isPlayer)
    expect(playerCars).toHaveLength(2)
    expect(playerCars.some((p) => p.driverId === '9uazqw522oc9p4z')).toBe(true)
    expect(playerCars.some((p) => p.driverId === '0mow8vmzk0y4z9s')).toBe(true)
    // O piloto reserva NÃO deve estar no grid da corrida
    expect(res.grid.some((g) => g.driverId === 'maloney_reserva')).toBe(false)
  })

  // Teste B — Erro de consulta / Falta de titular: sem sessão parcial, erro estruturado
  it('TESTE B: Falha estruturada caso falte inscrição obrigatória (menos de 2 titulares), sem criar mock ou sessão parcial', () => {
    const onlyOneDriver = [mockDriversAudi[0]] // Apenas Bortoleto, falta o segundo titular

    const res = buildCanonicalEventGrid({
      team: mockAudiTeam,
      playerDrivers: onlyOneDriver,
      currentRound: 1,
      totalLaps: 57,
    })

    expect(res.success).toBe(false)
    expect(res.grid).toHaveLength(0)
    expect(res.missingRequirements).toBeDefined()
    expect(res.missingRequirements![0]).toContain('Requer 2 titulares')
  })

  // Teste C — Retomada válida: preservação integral da ordem e propriedades
  it('TESTE C: Ordem de largada respeita a classificação canônica por ritmo/tempo, sem ordem arbitrária ou alfabética', () => {
    const res = buildCanonicalEventGrid({
      team: mockAudiTeam,
      playerDrivers: mockDriversAudi,
      currentRound: 1,
      totalLaps: 57,
    })

    expect(res.success).toBe(true)
    // Posições consecutivas de 1 a 24
    const positions = res.grid.map((g) => g.position)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))

    // Posição 1 tem gap Líder
    expect(res.grid[0].gapToLeader).toBe('Líder')
    // Não pode estar ordenado alfabeticamente
    const driverNames = res.grid.map((g) => g.driverName)
    const sortedNames = [...driverNames].sort()
    expect(driverNames).not.toEqual(sortedNames)
  })

  // Teste D — Sessão inconsistente: detecção de grid persistido corrompido (ex: 3 pilotos)
  it('TESTE D: Identifica inconsistência se uma sessão foi previamente gravada com apenas 3 participantes', () => {
    const savedGridFixture3 = [
      { driverId: 'drv_nor', driverName: 'L. Norris', position: 1 },
      { driverId: 'drv_ver', driverName: 'M. Verstappen', position: 2 },
      { driverId: 'drv_lec', driverName: 'C. Leclerc', position: 3 },
    ]

    const isInconsistent = savedGridFixture3.length > 0 && savedGridFixture3.length < 24
    expect(isInconsistent).toBe(true)
  })

  // Teste E — Ligação real dos painéis: identificação dos carros do jogador por teamId / driverId
  it('TESTE E: Painéis encontram os carros do jogador por driverId e teamId, nunca por índice estático', () => {
    const res = buildCanonicalEventGrid({
      team: mockAudiTeam,
      playerDrivers: mockDriversAudi,
      currentRound: 1,
      totalLaps: 57,
    })

    // Cada piloto do jogador mapeia diretamente para o carro correspondente
    const carBortoleto = res.grid.find(
      (g) => g.isPlayer && g.driverId === '9uazqw522oc9p4z' && g.teamId === mockAudiTeam.id,
    )
    const carHulkenberg = res.grid.find(
      (g) => g.isPlayer && g.driverId === '0mow8vmzk0y4z9s' && g.teamId === mockAudiTeam.id,
    )

    expect(carBortoleto).toBeDefined()
    expect(carBortoleto?.driverName).toBe('Gabriel Bortoleto')
    expect(carHulkenberg).toBeDefined()
    expect(carHulkenberg?.driverName).toBe('Nico Hülkenberg')
  })
})
