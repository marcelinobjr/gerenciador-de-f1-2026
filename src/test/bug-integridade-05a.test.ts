import { describe, it, expect, beforeEach } from 'vitest'
import {
  getActiveDriverTeamBinding,
  findCanonicalDriverMaster,
} from '@/lib/canonical-driver-database'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { standingsService } from '@/services/standingsService'
import { driverBase2026Service } from '@/services/driverBase2026Service'

describe('BUG-INTEGRIDADE-05A — Testes de integridade da cadeia de dados e resolução canônica', () => {
  const dummyDbTeams = [
    {
      id: 'n2tqsicdy7z6n9w',
      name: 'Oracle Red Bull Racing',
      team_key: 'red_bull',
      color: '#3671C6',
    },
    {
      id: '76vs00hy9hu24q1',
      name: 'McLaren Formula 1 Team',
      team_key: 'mclaren',
      color: '#FF8000',
    },
    {
      id: 'team_audi_2026',
      name: 'Audi Revolut F1 Team',
      team_key: 'audi',
      color: '#E10600',
    },
    {
      id: 'team_williams_2026',
      name: 'Williams Racing',
      team_key: 'williams',
      color: '#00A0DE',
    },
  ]

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // Teste 1: Palou não resolve para Red Bull quando o binding canônico aponta para outra equipe/agente livre
  it('1. Palou não resolve para Red Bull quando o binding canônico não tem equipe F1 (resolve como agente livre)', () => {
    // Alex Palou legado no PocketBase tinha team_id apontando para Red Bull (n2tqsicdy7z6n9w)
    const dbDrivers = [
      {
        id: 'c8vv4ox4mevgfxs',
        name: 'Alex Palou',
        team_id: 'n2tqsicdy7z6n9w',
        role: 'titular',
      },
    ]

    const binding = getActiveDriverTeamBinding(
      'c8vv4ox4mevgfxs',
      { season: 2026 } as any,
      dbDrivers,
      dummyDbTeams,
    )

    expect(binding.status).toBe('free_agent')
    expect(binding.teamId).toBeNull()
    expect(binding.teamName).toBeNull()
    expect(binding.isContracted).toBe(false)
  })

  // Teste 2: Binding canônico da temporada tem precedência sobre drivers.team_id
  it('2. Binding canônico da temporada tem precedência sobre drivers.team_id legado', () => {
    // Bortoleto mbj-020 é canonicamente da Audi. Se dbDrivers tiver um team_id legado de outra equipe sem canonical_contract,
    // o binding canônico da temporada (Audi) deve prevalecer.
    const dbDrivers = [
      {
        id: 'mbj-020',
        name: 'Gabriel Bortoleto',
        team_id: '76vs00hy9hu24q1', // Legado errado: McLaren
      },
    ]

    const binding = getActiveDriverTeamBinding(
      'mbj-020',
      { season: 2026 } as any,
      dbDrivers,
      dummyDbTeams,
    )

    expect(binding.teamName).toBe('Audi Revolut F1 Team')
    expect(binding.teamKey).toBe('audi')
    expect(binding.role).toBe('titular')
  })

  // Teste 3: Piloto sem binding canônico ainda usa fallback legado de drivers.team_id
  it('3. Piloto procedural sem binding canônico ainda usa fallback legado de drivers.team_id', () => {
    const proceduralId = 'drv_procedural_99999'
    const dbDrivers = [
      {
        id: proceduralId,
        name: 'Rookie Procedural',
        team_id: 'team_williams_2026',
        role: 'titular',
      },
    ]

    const binding = getActiveDriverTeamBinding(
      proceduralId,
      { season: 2026 } as any,
      dbDrivers,
      dummyDbTeams,
    )

    expect(binding.isContracted).toBe(true)
    expect(binding.teamId).toBe('team_williams_2026')
    expect(binding.teamName).toBe('Williams Racing')
  })

  // Teste 4: Save/reload preserva o vínculo correto através de canonical_contract ativo
  it('4. Save/reload preserva o vínculo correto quando há canonical_contract explícito', () => {
    // Se um save persistiu um contrato ativo para Alex Palou na Williams, canonical_contract prevalece
    const dbDriversWithSave = [
      {
        id: 'c8vv4ox4mevgfxs',
        name: 'Alex Palou',
        team_id: 'n2tqsicdy7z6n9w', // Legado
        canonical_contract: {
          teamId: 'team_williams_2026',
          status: 'active',
          role: 'titular',
        },
      },
    ]

    const binding = getActiveDriverTeamBinding(
      'c8vv4ox4mevgfxs',
      { season: 2026 } as any,
      dbDriversWithSave,
      dummyDbTeams,
    )

    expect(binding.teamId).toBe('team_williams_2026')
    expect(binding.teamName).toBe('Williams Racing')
    expect(binding.isContracted).toBe(true)
  })

  // Teste 5: Nenhum piloto é duplicado pela correção
  it('5. Nenhum piloto canônico é duplicado na busca ou tabela', () => {
    const palouMaster = findCanonicalDriverMaster('c8vv4ox4mevgfxs', null)
    expect(palouMaster).toBeDefined()
    expect(palouMaster?.fullName).toBe('Alex Palou')

    const palouByName = findCanonicalDriverMaster('mbj-042', 'Alex Palou')
    expect(palouByName?.driverId).toBe(palouMaster?.driverId)
  })

  // Teste 6: Standings não contém a string "Internacional" como fallback de nacionalidade
  it('6. Standings não contém a string "Internacional"', () => {
    const neutralGrid = canonicalChampionshipService.buildNeutralSeasonGrid()
    for (const d of neutralGrid.drivers) {
      expect(d.nationality).not.toBe('Internacional')
      expect(d.nationality.length).toBeGreaterThan(0)
    }
  })

  // Teste 7: Standings não contém "Piloto" ou "F1 Team" como nome de equipe
  it('7. Standings não contém "Piloto" ou "F1 Team" como nome de equipe', async () => {
    // Snapshot com um piloto sem equipe (agente livre)
    const mockSnap = {
      id: 'snap_test_1',
      careerId: 'car_test',
      season: 2026,
      throughRound: 1,
      sourceRaceResultIds: ['res_1'],
      sourceChecksums: ['chk_1'],
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1' as const,
      driverStandings: [
        {
          position: 1,
          driverId: 'drv_1',
          driverName: 'Test Driver',
          nationality: 'BRA',
          flag: '🇧🇷',
          points: 25,
          wins: 1,
          secondPlaces: 0,
          thirdPlaces: 0,
          fourthPlaces: 0,
          podiums: 1,
          raceStarts: 1,
          racesCounted: 1,
          finishCounts: { 1: 1 },
          gapToLeader: '—',
          currentTeamId: undefined,
          currentTeamName: undefined, // Sem equipe
        },
      ],
      constructorStandings: [],
    }

    canonicalChampionshipService.saveSnapshot(mockSnap)

    const standings = await standingsService.getStandings(
      { id: 'car_test' } as any,
      { id: 'season_1', year: 2026, current_round: 2, total_rounds: 24 } as any,
      [],
      [],
      1,
    )

    const driverRow = standings.driverStandings[0]
    expect(driverRow.teamName).not.toBe('Piloto')
    expect(driverRow.teamName).not.toBe('F1 Team')
    expect(driverRow.teamName).toBe('Sem Equipe')

    // driverBase2026Service getDriverContractState também não retorna 'Piloto'
    const contractState = driverBase2026Service.getDriverContractState(
      'c8vv4ox4mevgfxs',
      'car_test',
    )
    expect(contractState.teamName).not.toBe('Piloto')
  })

  // Teste 8: Gabriel Bortoleto (mbj-020) resolve nacionalidade Brasil e equipe Audi Revolut F1 Team
  it('8. Gabriel Bortoleto (mbj-020) resolve nacionalidade Brasil e equipe Audi Revolut F1 Team', () => {
    const bortoletoMaster = findCanonicalDriverMaster('mbj-020', 'Gabriel Bortoleto')
    expect(bortoletoMaster).toBeDefined()
    expect(bortoletoMaster?.nationality).toBe('BRA')

    const binding = getActiveDriverTeamBinding('mbj-020', { season: 2026 } as any, [], dummyDbTeams)

    expect(binding.teamName).toBe('Audi Revolut F1 Team')
    expect(binding.teamKey).toBe('audi')
  })

  // Teste 9: Carlos Sainz (mbj-014) resolve Espanha e Williams Racing
  it('9. Carlos Sainz (mbj-014) resolve Espanha e Williams Racing', () => {
    const sainzMaster = findCanonicalDriverMaster('mbj-014', 'Carlos Sainz')
    expect(sainzMaster).toBeDefined()
    expect(sainzMaster?.nationality).toBe('ESP')

    const binding = getActiveDriverTeamBinding('mbj-014', { season: 2026 } as any, [], dummyDbTeams)

    expect(binding.teamName).toBe('Williams Racing')
    expect(binding.teamKey).toBe('williams')
  })

  // Teste 10: Pontos/vitórias/pódios permanecem associados ao mesmo driverId; save/reload mantém vínculos
  it('10. Pontos/vitórias/pódios permanecem associados ao mesmo driverId no campeonato', () => {
    const mockSnap = {
      id: 'snap_test_10',
      careerId: 'car_test_10',
      season: 2026,
      throughRound: 2,
      sourceRaceResultIds: ['res_1', 'res_2'],
      sourceChecksums: ['chk_1', 'chk_2'],
      createdAt: new Date().toISOString(),
      schemaVersion: 'championship-snapshot-v1' as const,
      driverStandings: [
        {
          position: 1,
          driverId: 'mbj-020',
          driverName: 'Gabriel Bortoleto',
          nationality: 'BRA',
          flag: '🇧🇷',
          points: 50,
          wins: 2,
          secondPlaces: 0,
          thirdPlaces: 0,
          fourthPlaces: 0,
          podiums: 2,
          raceStarts: 2,
          racesCounted: 2,
          finishCounts: { 1: 2 },
          gapToLeader: '—',
          currentTeamId: 'team_audi_2026',
          currentTeamName: 'Audi Revolut F1 Team',
        },
      ],
      constructorStandings: [
        {
          position: 1,
          teamId: 'audi',
          teamName: 'Audi Revolut F1 Team',
          teamColor: '#E10600',
          points: 50,
          wins: 2,
          podiums: 2,
          racesCounted: 2,
          finishCounts: { 1: 2 },
          gapToLeader: '—',
        },
      ],
    }

    canonicalChampionshipService.saveSnapshot(mockSnap)
    const reloadedSnap = canonicalChampionshipService.getSnapshot('car_test_10', 2026, 2)

    expect(reloadedSnap).toBeDefined()
    expect(reloadedSnap?.driverStandings[0].driverId).toBe('mbj-020')
    expect(reloadedSnap?.driverStandings[0].points).toBe(50)
    expect(reloadedSnap?.driverStandings[0].wins).toBe(2)
    expect(reloadedSnap?.driverStandings[0].podiums).toBe(2)
    expect(reloadedSnap?.driverStandings[0].currentTeamName).toBe('Audi Revolut F1 Team')
  })
})
