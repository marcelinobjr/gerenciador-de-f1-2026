/**
 * pu-05a2-p2a-linkage-unit-participant.test.ts
 *
 * Suíte Oficial Dedicada para PU-05A2-P2a:
 * VINCULAR A UNIDADE AO PARTICIPANTE NA INICIALIZAÇÃO
 *
 * CENÁRIOS OBRIGATÓRIOS DO BRIEFING:
 * - TESTE 1: Dois carros, grid em ordem diferente:
 *   Persistir pelo P1 (carro 1 → unidade A; carro 2 → unidade B), inicializar pelo caminho oficial
 *   com ordem dos participantes diferente da ordem dos carros; verificar que cada participante
 *   recebe o ID correto e a condição inicial da unidade correspondente.
 *   Não injetar manualmente os vínculos esperados no estado final; não mockar o resolvedor.
 * - TESTE 2: Associação inválida:
 *   Exercitar associação inválida conforme contrato real; confirmar que não há seleção silenciosa
 *   de outra unidade nem vínculo com equipamento de outra equipe/save.
 * - TESTE 3: Compatibilidade:
 *   Carregamento existente de sessão legada sem vínculo continua aceito, sem reconstruir montagem.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import type { TeamModel } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

describe('PU-05A2-P2a: Vincular a Unidade ao Participante na Inicialização', () => {
  const createMockTeam = (id: string, overrides: Partial<TeamModel> = {}): TeamModel => ({
    id,
    name: 'Apex Grand Prix Team',
    color: '#00D2BE',
    chassis_level: 85,
    aero_level: 82,
    strategy_level: 80,
    budget: 120000000,
    cost_cap_spent: 35000000,
    engine_pool_used: 4,
    engine_supplier: 'Mercedes',
    active_engine_wear: 15,
    engine_history: [
      {
        id: 1,
        wear: 10,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 1,
        condition: 90,
        mileage_km: 450,
      },
      {
        id: 2,
        wear: 35,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 2,
        condition: 65,
        mileage_km: 1950,
      },
      {
        id: 3,
        wear: 20,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 3,
        condition: 80,
        mileage_km: 800,
      },
      {
        id: 4,
        wear: 60,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 4,
        condition: 40,
        mileage_km: 2900,
      },
    ],
    grid_penalties: [],
    ...overrides,
  })

  const createMock24Grid = (
    playerTeamId: string,
    playerAssignments: Array<{ driverId: string; carId: 'car1' | 'car2'; gridPos: number }>,
  ): FinalQualifyingGridEntry[] => {
    const grid: FinalQualifyingGridEntry[] = []
    const rivalTeams = [
      'team_ferrari',
      'team_mclaren',
      'team_redbull',
      'team_mercedes',
      'team_aston',
      'team_alpine',
      'team_williams',
      'team_haas',
      'team_sauber',
      'team_rb',
      'team_cadillac',
    ]

    for (let pos = 1; pos <= 24; pos++) {
      const pAssign = playerAssignments.find((a) => a.gridPos === pos)
      if (pAssign) {
        grid.push({
          gridPosition: pos,
          driverId: pAssign.driverId,
          driverName: `Player Driver (${pAssign.carId})`,
          teamId: playerTeamId,
          teamName: 'Apex Grand Prix Team',
          teamColor: '#00D2BE',
          carId: pAssign.carId,
          isPlayer: true,
          bestLapCompound: 'medio',
          eliminationStage: 'Q3',
          bestLapSec: 88.0 + pos * 0.1,
          bestLapTime: `1:${(28 + pos * 0.1).toFixed(3)}`,
        })
      } else {
        const rivalIdx = (pos - 1) % rivalTeams.length
        const rTeam = rivalTeams[rivalIdx]
        grid.push({
          gridPosition: pos,
          driverId: `rival_driver_${pos}`,
          driverName: `Rival Driver ${pos}`,
          teamId: rTeam,
          teamName: `Team ${rTeam}`,
          teamColor: '#555555',
          carId: pos % 2 === 1 ? 'car1' : 'car2',
          isPlayer: false,
          bestLapCompound: 'medio',
          eliminationStage: pos <= 10 ? 'Q3' : pos <= 16 ? 'Q2' : 'Q1',
          bestLapSec: 89.0 + pos * 0.1,
          bestLapTime: `1:${(29 + pos * 0.1).toFixed(3)}`,
        })
      }
    }

    return grid
  }

  beforeEach(() => {
    canonicalPowerUnitAllocationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  // =========================================================================
  // TESTE 1 — Dois carros, grid em ordem diferente
  // =========================================================================
  it('TESTE 1 — Dois carros, grid em ordem diferente: persistir pelo P1 (carro 1 → unidade A; carro 2 → unidade B), inicializar pelo caminho oficial com participantes invertidos no grid', () => {
    const careerId = 'career_p2a_test_01'
    const unitA = 1 // Condição 90
    const unitB = 4 // Condição 40

    // Persistir montagem canônica pelo serviço do P1 no TeamModel
    const team = createMockTeam('team_apex_p2a', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: unitA,
          car2Unit: unitB,
          updatedAt: new Date().toISOString(),
          careerId,
        },
      },
    })

    // Confirmar que o resolvedor do P1 extrai sem mock
    const resolvedAlloc = canonicalPowerUnitAllocationService.resolveAllocation({
      team,
      careerId,
    })
    expect(resolvedAlloc.car1Unit).toBe(unitA)
    expect(resolvedAlloc.car2Unit).toBe(unitB)

    // ORDEM INVERTIDA NO GRID:
    // Carro 2 (Piloto B) larga em P2 (frente)
    // Carro 1 (Piloto A) larga em P19 (fundo)
    const invertedGrid = createMock24Grid(team.id, [
      { driverId: 'drv_car2_player', carId: 'car2', gridPos: 2 },
      { driverId: 'drv_car1_player', carId: 'car1', gridPos: 19 },
    ])

    // Inicialização pelo caminho oficial utilizado por /corrida/live
    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: 2026,
      round: 1,
      circuitName: 'Bahrain International Circuit',
      circuitCountry: 'Bahrain',
      totalLaps: 57,
      playerTeamId: team.id,
      playerTeam: team,
      canonicalQualifyingGrid: invertedGrid,
      persistState: false,
    })

    // Localizar ambos os participantes no CanonicalRaceState
    const participantCar1 = raceState.drivers.find((d) => d.driverId === 'drv_car1_player')
    const participantCar2 = raceState.drivers.find((d) => d.driverId === 'drv_car2_player')

    expect(participantCar1).toBeDefined()
    expect(participantCar2).toBeDefined()

    // 1. Carro 1 em P19 deve ter Unidade A (ID 1) e condição inicial 90
    expect(participantCar1!.gridPosition).toBe(19)
    expect(participantCar1!.carId).toBe('car1')
    expect(participantCar1!.powerUnitId).toBe(unitA)
    expect(participantCar1!.powerUnitInitialCondition).toBe(90)

    // 2. Carro 2 em P2 deve ter Unidade B (ID 4) e condição inicial 40
    expect(participantCar2!.gridPosition).toBe(2)
    expect(participantCar2!.carId).toBe('car2')
    expect(participantCar2!.powerUnitId).toBe(unitB)
    expect(participantCar2!.powerUnitInitialCondition).toBe(40)

    // 3. O estado serializável contém os campos e não referências mutáveis
    expect(typeof raceState.drivers[0].powerUnitId).toBe('number')
    expect(typeof raceState.drivers[0].powerUnitInitialCondition).toBe('number')
  })

  // =========================================================================
  // TESTE 2 — Associação inválida
  // =========================================================================
  it('TESTE 2 — Associação inválida: exercitar associação inválida conforme contrato real; confirmar que não há seleção silenciosa de outra unidade nem vínculo com equipamento de outra equipe/save', () => {
    const careerId = 'career_p2a_test_02'

    // Cenário 2.1: Unidade inexistente no inventário (PU-99)
    const teamWithInvalidUnit = createMockTeam('team_apex_invalid_pu', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 99, // Unidade inexistente (inventário só tem 1..4)
          car2Unit: 2,
          updatedAt: new Date().toISOString(),
          careerId,
        },
      },
    })

    const grid = createMock24Grid(teamWithInvalidUnit.id, [
      { driverId: 'drv_c1', carId: 'car1', gridPos: 1 },
      { driverId: 'drv_c2', carId: 'car2', gridPos: 2 },
    ])

    // DEVE lançar exceção explícita e NÃO escolher a primeira unidade do inventário
    expect(() => {
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season: 2026,
        round: 1,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrain',
        totalLaps: 57,
        playerTeamId: teamWithInvalidUnit.id,
        playerTeam: teamWithInvalidUnit,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })
    }).toThrow(/Alocação de Unidade de Potência inválida/)

    // Cenário 2.2: Associação com unidade duplicada entre carros (carro 1 = PU 2, carro 2 = PU 2)
    const teamWithDuplicatePU = createMockTeam('team_apex_duplicate_pu', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 2,
          car2Unit: 2, // Conflito/duplicação
          updatedAt: new Date().toISOString(),
          careerId,
        },
      },
    })

    expect(() => {
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season: 2026,
        round: 1,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrain',
        totalLaps: 57,
        playerTeamId: teamWithDuplicatePU.id,
        playerTeam: teamWithDuplicatePU,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })
    }).toThrow(/Alocação de Unidade de Potência inválida/)

    // Cenário 2.3: Alocação de outro save/carreira
    const teamOtherCareer = createMockTeam('team_apex_other_career', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 1,
          car2Unit: 2,
          updatedAt: new Date().toISOString(),
          careerId: 'OTHER_CAREER_XYZ',
        },
      },
    })

    expect(() => {
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: 'CURRENT_CAREER_ABC',
        season: 2026,
        round: 1,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrain',
        totalLaps: 57,
        playerTeamId: teamOtherCareer.id,
        playerTeam: teamOtherCareer,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })
    }).toThrow(/Alocação pertence a outro save\/carreira/)
  })

  // =========================================================================
  // TESTE 3 — Compatibilidade com sessões legadas
  // =========================================================================
  it('TESTE 3 — Compatibilidade: carregamento existente de sessão legada sem vínculo continua aceito, sem reconstruir montagem', () => {
    const careerId = 'career_p2a_legacy_03'

    // Simulação de sessão legada persistida anteriormente ao P2a (sem campos de PU no estado)
    const legacySavedRaceState: CanonicalRaceState = {
      version: '2.0',
      saveSchemaVersion: 'race-save-v1',
      raceVariant: 'MAIN_RACE',
      careerId,
      season: 2026,
      round: 3,
      raceId: 'race_legacy_career_p2a_legacy_03_2026_3_main',
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      circuitLengthKm: 5.278,
      totalLaps: 58,
      currentLap: 15,
      status: 'running',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      playerTeamId: 'team_apex_legacy',
      tactics: {},
      paceOrders: {},
      revision: 15,
      updatedAt: '2026-03-01T12:00:00.000Z',
      driverLookup: {},
      drivers: [
        {
          careerId,
          season: 2026,
          raceId: 'race_legacy_career_p2a_legacy_03_2026_3_main',
          driverId: 'legacy_p1',
          teamId: 'team_apex_legacy',
          gridPosition: 1,
          currentPosition: 1,
          lap: 15,
          raceTime: 1240.5,
          gap: 'LÍDER',
          tyreCompound: 'duro',
          tyreAge: 15,
          fuel: 65.0,
          carCondition: 92,
          raceStatus: 'racing',
          pitStops: 0,
          driverName: 'Legacy Driver 1',
          teamName: 'Apex Grand Prix Team',
          teamColor: '#00D2BE',
          isPlayer: true,
          carId: 'car1',
          // Note: sem powerUnitId nem powerUnitInitialCondition (sessão legada)
        },
        {
          careerId,
          season: 2026,
          raceId: 'race_legacy_career_p2a_legacy_03_2026_3_main',
          driverId: 'legacy_p2',
          teamId: 'team_apex_legacy',
          gridPosition: 5,
          currentPosition: 4,
          lap: 15,
          raceTime: 1245.2,
          gap: '+4.700s',
          tyreCompound: 'medio',
          tyreAge: 15,
          fuel: 64.5,
          carCondition: 90,
          raceStatus: 'racing',
          pitStops: 0,
          driverName: 'Legacy Driver 2',
          teamName: 'Apex Grand Prix Team',
          teamColor: '#00D2BE',
          isPlayer: true,
          carId: 'car2',
          // Note: sem powerUnitId nem powerUnitInitialCondition (sessão legada)
        },
      ],
    }

    // Persistir o estado legado diretamente no serviço de save canônico
    canonicalRaceInitializationService.saveCanonicalRaceState(legacySavedRaceState)

    // Modificar a garagem no serviço P1 para verificar que a sessão legada NÃO é retroativamente alterada nem tenta reconstruir
    const teamCurrent = createMockTeam('team_apex_legacy', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 3,
          car2Unit: 4,
          updatedAt: new Date().toISOString(),
          careerId,
        },
      },
    })
    const currentAlloc = canonicalPowerUnitAllocationService.resolveAllocation({
      team: teamCurrent,
      careerId,
    })
    expect(currentAlloc.car1Unit).toBe(3)
    expect(currentAlloc.car2Unit).toBe(4)

    // Ler a sessão legada em andamento
    const loadedState = canonicalRaceInitializationService.readCanonicalRaceState(
      careerId,
      2026,
      3,
      'MAIN_RACE',
    )

    expect(loadedState).not.toBeNull()
    expect(loadedState!.currentLap).toBe(15)
    expect(loadedState!.status).toBe('running')

    const d1 = loadedState!.drivers.find((d) => d.driverId === 'legacy_p1')!
    const d2 = loadedState!.drivers.find((d) => d.driverId === 'legacy_p2')!

    // Os dados da sessão legada em andamento continuam funcionando perfeitamente sem reconstruir retroativamente montagem
    expect(d1.powerUnitId).toBeUndefined()
    expect(d1.powerUnitInitialCondition).toBeUndefined()
    expect(d2.powerUnitId).toBeUndefined()
    expect(d2.powerUnitInitialCondition).toBeUndefined()
    expect(d1.carCondition).toBe(92)
    expect(d2.carCondition).toBe(90)
  })
})
