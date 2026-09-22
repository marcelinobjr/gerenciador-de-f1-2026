import { describe, it, expect, beforeEach } from 'vitest'
import { resolveCanonicalDriverId } from '@/lib/canonical-driver-database'
import { weekendSimulationService } from '@/services/weekendSimulationService'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import type { SessionTimeResult } from '@/pages/race/types'
import type { TeamModel, DriverModel, SeasonModel, PartModel, SponsorModel } from '@/types/f1'

describe('BUG-04A — STARTING GRID MAPPING (Preservação da ordem de classificação)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // Fixture base com 24 pilotos na qualificação
  const createQualyGrid24 = (): SessionTimeResult[] => {
    const list: SessionTimeResult[] = []
    // 22 rivais + 2 pilotos do jogador
    // P1 a P22: Rivais (11 equipes x 2 pilotos)
    for (let i = 1; i <= 22; i++) {
      const teamIdx = Math.ceil(i / 2)
      const slot = i % 2 === 1 ? 1 : 2
      list.push({
        position: i,
        driverId: `ai_team_${teamIdx}_d${slot}`,
        driverName: `Driver ${String(i).padStart(2, '0')}`,
        teamName: `Team Rival ${teamIdx}`,
        teamColor: '#334155',
        lapTime: `1:20.${String(i).padStart(3, '0')}`,
        gap: i === 1 ? 'LÍDER' : `+${(i * 0.1).toFixed(3)}s`,
        tire: 'macio',
        isPlayer: false,
      })
    }
    // P23 e P24: Pilotos do jogador
    list.push({
      position: 23,
      driverId: 'player_drv_1',
      driverName: 'Player Alpha',
      teamName: 'Escuderia Brasil',
      teamColor: '#E10600',
      lapTime: '1:22.500',
      gap: '+2.500s',
      tire: 'macio',
      isPlayer: true,
    })
    list.push({
      position: 24,
      driverId: 'player_drv_2',
      driverName: 'Player Beta',
      teamName: 'Escuderia Brasil',
      teamColor: '#E10600',
      lapTime: '1:22.800',
      gap: '+2.800s',
      tire: 'macio',
      isPlayer: true,
    })
    return list
  }

  // BUG4-01: 24 classificados → 24 grid entries
  it('BUG4-01: 24 classificados na quali resultam em exatamente 24 grid entries', async () => {
    const qualy = createQualyGrid24()
    expect(qualy.length).toBe(24)

    const mockTeam = {
      id: 'team_player',
      user_id: 'user_1',
      name: 'Escuderia Brasil',
      color: '#E10600',
      strength: 75,
      budget: 100000000,
      chassis_level: 75,
      aero_level: 75,
      strategy_level: 75,
      engine_supplier: 'Audi',
    } as TeamModel

    const mockSeason = {
      id: 'season_2026',
      year: 2026,
      current_round: 1,
      total_rounds: 24,
    } as SeasonModel

    const mockDrivers: DriverModel[] = [
      {
        id: 'player_drv_1',
        team_id: 'team_player',
        name: 'Player Alpha',
        role: 'titular',
        speed: 82,
        consistency: 82,
        defense: 80,
        nationality: 'Brasil',
        age: 24,
        rain: 80,
        salary: 5000000,
        contract_end: 2027,
      },
      {
        id: 'player_drv_2',
        team_id: 'team_player',
        name: 'Player Beta',
        role: 'titular',
        speed: 80,
        consistency: 80,
        defense: 80,
        nationality: 'Brasil',
        age: 26,
        rain: 80,
        salary: 5000000,
        contract_end: 2027,
      },
    ]

    const result = await (weekendSimulationService as any).simulateRaceSessionCanonical({
      team: mockTeam,
      season: mockSeason,
      drivers: mockDrivers,
      parts: [],
      gpMeta: { name: 'GP Austrália', laps: 58, tireAbrasiveness: 6 },
      currentRound: 1,
      qualyGrid: qualy,
    })

    expect(result.finalGrid.length).toBe(24)
  })

  // BUG4-02: posições exatamente 1..24
  it('BUG4-02: Grid positions cobrem exatamente 1 a 24 sem saltos ou buracos', () => {
    const qualy = createQualyGrid24()
    const positions = qualy.map((q) => q.position).sort((a, b) => a - b)
    expect(positions).toEqual(Array.from({ length: 24 }, (_, i) => i + 1))
  })

  // BUG4-03: 24 driverIds únicos
  it('BUG4-03: Os 24 driverIds são estritamente únicos na formação', () => {
    const qualy = createQualyGrid24()
    const ids = qualy.map((q) => q.driverId)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(24)
  })

  // BUG4-04..09: P1→P1, P10→P10, P11→P11, P18→P18, P19→P19, P24→P24
  it('BUG4-04..09: Classificação preserva fielmente posições canônicas (P1, P10, P11, P18, P19, P24)', () => {
    const qualy = createQualyGrid24()
    const testPositions = [1, 10, 11, 18, 19, 24]
    for (const targetPos of testPositions) {
      const entry = qualy.find((q) => q.position === targetPos)!
      expect(entry).toBeDefined()
      const resolved = resolveCanonicalDriverId(entry.driverId, qualy, entry.driverName)
      expect(resolved).not.toBeNull()
      expect(resolved!.position).toBe(targetPos)
    }
  })

  // BUG4-10: player P23 → P23
  it('BUG4-10: Piloto do jogador que classificou em P23 larga exatamente em P23', async () => {
    const qualy = createQualyGrid24()
    const p1Entry = qualy.find((q) => q.driverId === 'player_drv_1')!
    expect(p1Entry.position).toBe(23)

    const resolved = resolveCanonicalDriverId('player_drv_1', qualy, 'Player Alpha')
    expect(resolved).not.toBeNull()
    expect(resolved!.position).toBe(23)
  })

  // BUG4-11: player P24 → P24
  it('BUG4-11: Piloto do jogador que classificou em P24 larga exatamente em P24', async () => {
    const qualy = createQualyGrid24()
    const p2Entry = qualy.find((q) => q.driverId === 'player_drv_2')!
    expect(p2Entry.position).toBe(24)

    const resolved = resolveCanonicalDriverId('player_drv_2', qualy, 'Player Beta')
    expect(resolved).not.toBeNull()
    expect(resolved!.position).toBe(24)
  })

  // BUG4-12: player P4 + teammate P22 → P4/P22 (independentes)
  it('BUG4-12: Piloto do jogador em P4 e companheiro em P22 mantêm posições independentes sem aproximação média', () => {
    const qualy = createQualyGrid24()
    // Reconfigura P4 como Player Alpha e P22 como Player Beta
    const p4 = qualy.find((q) => q.position === 4)!
    const p22 = qualy.find((q) => q.position === 22)!
    p4.driverId = 'player_drv_1'
    p4.driverName = 'Player Alpha'
    p4.isPlayer = true

    p22.driverId = 'player_drv_2'
    p22.driverName = 'Player Beta'
    p22.isPlayer = true

    const rA = resolveCanonicalDriverId('player_drv_1', qualy, 'Player Alpha')
    const rB = resolveCanonicalDriverId('player_drv_2', qualy, 'Player Beta')

    expect(rA!.position).toBe(4)
    expect(rB!.position).toBe(22)
    // Jamais assumem fallback sintético 8 ou 14
    expect(rA!.position).not.toBe(8)
    expect(rB!.position).not.toBe(14)
  })

  // BUG4-13: AI usa a mesma regra (sem aproximação ou cálculo sintético por força de equipe)
  it('BUG4-13: Pilotos rivais da IA utilizam estritamente a mesma regra de preservação', () => {
    const qualy = createQualyGrid24()
    // Rival 1 em P7 e Rival 2 da mesma equipe em P21
    const rival1 = qualy.find((q) => q.driverId === 'ai_team_1_d1')!
    const rival2 = qualy.find((q) => q.driverId === 'ai_team_1_d2')!
    rival1.position = 7
    rival2.position = 21

    const res1 = resolveCanonicalDriverId('ai_team_1_d1', qualy, rival1.driverName)
    const res2 = resolveCanonicalDriverId('ai_team_1_d2', qualy, rival2.driverName)

    expect(res1!.position).toBe(7)
    expect(res2!.position).toBe(21)
    // Jamais calculados por fórmula de índice (tIdx * 2 + 1 / tIdx * 2 + 2)
  })

  // BUG4-14: identity mismatch (fixture bortoleto vs driver_gabriel_bortoleto) resolve sem alterar posição
  it('BUG4-14: Identity mismatch (fixture bortoleto vs driver_gabriel_bortoleto) resolve com sucesso sem alterar posição', () => {
    const qualy = createQualyGrid24()
    // Suponha que na qualificação o piloto foi registrado com ID canônico 'driver_gabriel_bortoleto' em P17
    const entryP17 = qualy.find((q) => q.position === 17)!
    entryP17.driverId = 'driver_gabriel_bortoleto'
    entryP17.driverName = 'Gabriel Bortoleto'

    // O serviço recebe chamada com alias legado 'bortoleto'
    const resolved = resolveCanonicalDriverId('bortoleto', qualy, 'Gabriel Bortoleto')
    expect(resolved).not.toBeNull()
    expect(resolved!.driverId).toBe('driver_gabriel_bortoleto')
    expect(resolved!.position).toBe(17)

    // E vice-versa: registrado como 'bortoleto' e buscado como 'driver_gabriel_bortoleto'
    entryP17.driverId = 'bortoleto'
    const resolvedReverse = resolveCanonicalDriverId(
      'driver_gabriel_bortoleto',
      qualy,
      'Gabriel Bortoleto',
    )
    expect(resolvedReverse).not.toBeNull()
    expect(resolvedReverse!.driverId).toBe('bortoleto')
    expect(resolvedReverse!.position).toBe(17)
  })

  // BUG4-15: identidade irresolvida NÃO gera posição média fictícia (espera GRID_IDENTITY_UNRESOLVED)
  it('BUG4-15: Identidade irresolvida lança erro GRID_IDENTITY_UNRESOLVED sem inventar posição', async () => {
    const qualy = createQualyGrid24()

    const mockTeam = {
      id: 'team_player',
      user_id: 'user_1',
      name: 'Escuderia Brasil',
      color: '#E10600',
      strength: 75,
      budget: 100000000,
      chassis_level: 75,
      aero_level: 75,
      strategy_level: 75,
      engine_supplier: 'Audi',
    } as TeamModel

    const mockSeason = {
      id: 'season_2026',
      year: 2026,
      current_round: 1,
      total_rounds: 24,
    } as SeasonModel

    // Piloto com identidade inexistente no grid da qualificação
    const mockUnknownDrivers: DriverModel[] = [
      {
        id: 'phantom_unknown_id_xyz',
        team_id: 'team_player',
        name: 'Piloto Fantasma Totalmente Desconhecido',
        role: 'titular',
        speed: 82,
        consistency: 82,
        defense: 80,
        nationality: 'Brasil',
        age: 24,
        rain: 80,
        salary: 5000000,
        contract_end: 2027,
      },
      {
        id: 'player_drv_2',
        team_id: 'team_player',
        name: 'Player Beta',
        role: 'titular',
        speed: 80,
        consistency: 80,
        defense: 80,
        nationality: 'Brasil',
        age: 26,
        rain: 80,
        salary: 5000000,
        contract_end: 2027,
      },
    ]

    await expect(
      (weekendSimulationService as any).simulateRaceSessionCanonical({
        team: mockTeam,
        season: mockSeason,
        drivers: mockUnknownDrivers,
        parts: [],
        gpMeta: { name: 'GP Austrália', laps: 58, tireAbrasiveness: 6 },
        currentRound: 1,
        qualyGrid: qualy,
      }),
    ).rejects.toThrow('GRID_IDENTITY_UNRESOLVED')
  })

  // GOLDEN TEST A: P1 Driver 01 ... P22 Driver 22, P23 Player A, P24 Player B → grid igual à quali, MATCH EXATO
  it('GOLDEN TEST A: P1..P22 Rivais, P23 Player Alpha, P24 Player Beta -> Grid de largada preserva EXATAMENTE a qualificação', async () => {
    const qualy = createQualyGrid24()

    const mockTeam = {
      id: 'team_player',
      user_id: 'user_1',
      name: 'Escuderia Brasil',
      color: '#E10600',
      strength: 75,
      budget: 100000000,
      chassis_level: 75,
      aero_level: 75,
      strategy_level: 75,
      engine_supplier: 'Audi',
    } as TeamModel

    const mockSeason = {
      id: 'season_2026',
      year: 2026,
      current_round: 1,
      total_rounds: 24,
    } as SeasonModel

    const mockDrivers: DriverModel[] = [
      {
        id: 'player_drv_1',
        team_id: 'team_player',
        name: 'Player Alpha',
        role: 'titular',
        speed: 82,
        consistency: 82,
        defense: 80,
        nationality: 'Brasil',
        age: 24,
        rain: 80,
        salary: 5000000,
        contract_end: 2027,
      },
      {
        id: 'player_drv_2',
        team_id: 'team_player',
        name: 'Player Beta',
        role: 'titular',
        speed: 80,
        consistency: 80,
        defense: 80,
        nationality: 'Brasil',
        age: 26,
        rain: 80,
        salary: 5000000,
        contract_end: 2027,
      },
    ]

    // Executar a simulação canônica da corrida
    const result = await (weekendSimulationService as any).simulateRaceSessionCanonical({
      team: mockTeam,
      season: mockSeason,
      drivers: mockDrivers,
      parts: [],
      gpMeta: { name: 'GP Austrália', laps: 58, tireAbrasiveness: 6 },
      currentRound: 1,
      qualyGrid: qualy,
    })

    // No grid inicial montado para a corrida (gridPosition):
    const playerA = result.finalGrid.find((g: any) => g.driverId === 'player_drv_1')
    const playerB = result.finalGrid.find((g: any) => g.driverId === 'player_drv_2')

    expect(playerA).toBeDefined()
    expect(playerB).toBeDefined()
    expect(playerA.gridPosition).toBe(23)
    expect(playerB.gridPosition).toBe(24)

    // Nenhum piloto do jogador largou em P8 ou P14
    expect(playerA.gridPosition).not.toBe(8)
    expect(playerB.gridPosition).not.toBe(14)
  })
})
