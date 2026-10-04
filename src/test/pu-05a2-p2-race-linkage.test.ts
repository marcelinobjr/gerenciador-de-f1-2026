/**
 * pu-05a2-p2-race-linkage.test.ts
 *
 * PU-05A2-P2: Teste de integração do vínculo de Power Unit na corrida canônica
 * Cobre os requisitos de PU-05A2-P2a:
 * A. Obtém a montagem pelo serviço canônico entregue no P1 (canonicalPowerUnitAllocationService)
 * B. Registra no participante o identificador da unidade e os dados de sua condição inicial
 * C. Mantém esse vínculo no estado serializável da sessão (CanonicalRaceState / CanonicalRaceDriverState)
 * D. Não associa unidades pela posição no grid, nome do piloto ou índice incidental de um array
 * E. Não usa chaves globais antigas de localStorage como fonte autoritativa nem escolhe silenciosamente outra unidade quando inválida
 * F. Preserva o carregamento de sessões legadas sem reconstruir retroativamente sua montagem
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import type { TeamModel } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

describe('PU-05A2-P2: Vínculo Canônico Unidade -> Participante na Sessão de Corrida', () => {
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
    active_engine_wear: 18,
    engine_history: [
      {
        id: 1,
        wear: 10,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 1,
        condition: 90,
        mileage_km: 400,
      },
      {
        id: 2,
        wear: 30,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 2,
        condition: 70,
        mileage_km: 1200,
      },
      {
        id: 3,
        wear: 50,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 3,
        condition: 50,
        mileage_km: 2100,
      },
      {
        id: 4,
        wear: 5,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 4,
        condition: 95,
        mileage_km: 200,
      },
    ],
    grid_penalties: [],
    ...overrides,
  })

  const createMock24Grid = (
    playerTeamId: string,
    playerCar1Pos: number,
    playerCar2Pos: number,
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

    let rivalIndex = 0
    for (let p = 1; p <= 24; p++) {
      if (p === playerCar1Pos) {
        grid.push({
          gridPosition: p,
          driverId: 'player_driver_1',
          driverName: 'Piloto Um',
          teamId: playerTeamId,
          teamName: 'Apex Grand Prix Team',
          teamColor: '#00D2BE',
          carId: 'car1',
          isPlayer: true,
          bestLapCompound: 'medio',
          eliminationStage: 'Q3',
          bestLapSec: 88.0,
          bestLapTime: '1:28.000',
        })
      } else if (p === playerCar2Pos) {
        grid.push({
          gridPosition: p,
          driverId: 'player_driver_2',
          driverName: 'Piloto Dois',
          teamId: playerTeamId,
          teamName: 'Apex Grand Prix Team',
          teamColor: '#00D2BE',
          carId: 'car2',
          isPlayer: true,
          bestLapCompound: 'medio',
          eliminationStage: 'Q3',
          bestLapSec: 88.2,
          bestLapTime: '1:28.200',
        })
      } else {
        const team = rivalTeams[Math.floor(rivalIndex / 2) % rivalTeams.length]
        const seat = (rivalIndex % 2) + 1
        rivalIndex++
        grid.push({
          gridPosition: p,
          driverId: `rival_driver_${p}`,
          driverName: `Rival ${p}`,
          teamId: team,
          teamName: `Equipe ${team}`,
          teamColor: '#555555',
          carId: seat === 1 ? 'car1' : 'car2',
          isPlayer: false,
          bestLapCompound: 'medio',
          eliminationStage: p <= 10 ? 'Q3' : p <= 16 ? 'Q2' : 'Q1',
          bestLapSec: 89.0 + p * 0.1,
          bestLapTime: `1:${(29 + p * 0.1).toFixed(3)}`,
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

  it('A & B & D: Obtém montagem canônica pelo serviço P1 e vincula unidade e condição inicial ao participante pelo carId independente de ordem de grid', () => {
    const careerId = 'career_pu_linkage_test'
    // Carro 1 montado com PU 2 (condição 70)
    // Carro 2 montado com PU 4 (condição 95)
    const team = createMockTeam('team_apex_p2', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 2,
          car2Unit: 4,
          updatedAt: '2026-05-01T00:00:00Z',
          careerId,
        },
      },
    })

    // Grid: Carro 2 larga em P3, Carro 1 larga em P17 (grid invertido em relação aos índices)
    const grid = createMock24Grid(team.id, 17, 3)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: 2026,
      round: 3,
      circuitName: 'Silverstone Circuit',
      circuitCountry: 'Great Britain',
      totalLaps: 52,
      playerTeamId: team.id,
      playerTeam: team,
      canonicalQualifyingGrid: grid,
      persistState: false,
    })

    const driverCar1 = raceState.drivers.find((d) => d.driverId === 'player_driver_1')
    const driverCar2 = raceState.drivers.find((d) => d.driverId === 'player_driver_2')

    expect(driverCar1).toBeDefined()
    expect(driverCar2).toBeDefined()

    // Carro 1 está em P17, carId 'car1' -> PU 2 (condição 70)
    expect(driverCar1!.gridPosition).toBe(17)
    expect(driverCar1!.carId).toBe('car1')
    expect(driverCar1!.powerUnitId).toBe(2)
    expect(driverCar1!.powerUnitInitialCondition).toBe(70)

    // Carro 2 está em P3, carId 'car2' -> PU 4 (condição 95)
    expect(driverCar2!.gridPosition).toBe(3)
    expect(driverCar2!.carId).toBe('car2')
    expect(driverCar2!.powerUnitId).toBe(4)
    expect(driverCar2!.powerUnitInitialCondition).toBe(95)

    // Unidades não foram associadas pela posição no grid
    expect(driverCar1!.powerUnitId).not.toBe(driverCar2!.powerUnitId)
  })

  it('C: Mantém o vínculo no estado serializável da sessão e suporta save/reload sem perda', () => {
    const careerId = 'career_session_persist_test'
    const team = createMockTeam('team_apex_persist', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 1,
          car2Unit: 3,
          updatedAt: '2026-05-01T00:00:00Z',
          careerId,
        },
      },
    })

    const grid = createMock24Grid(team.id, 1, 2)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: 2026,
      round: 4,
      circuitName: 'Circuit de Barcelona-Catalunya',
      circuitCountry: 'Spain',
      totalLaps: 66,
      playerTeamId: team.id,
      playerTeam: team,
      canonicalQualifyingGrid: grid,
      persistState: true, // Salva via canonicalRaceSaveService
    })

    // Carrega o estado persistido
    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(careerId, 2026, 4)
    expect(loaded.state).not.toBeNull()
    const loadedCar1 = loaded.state!.drivers.find((d) => d.driverId === 'player_driver_1')
    const loadedCar2 = loaded.state!.drivers.find((d) => d.driverId === 'player_driver_2')

    expect(loadedCar1?.powerUnitId).toBe(1)
    expect(loadedCar1?.powerUnitInitialCondition).toBe(90)
    expect(loadedCar2?.powerUnitId).toBe(3)
    expect(loadedCar2?.powerUnitInitialCondition).toBe(50)
  })

  it('E: Não usa chaves globais legadas de localStorage como fonte e não escolhe silenciosamente outra unidade quando inválida', () => {
    // Configura chave legada global no localStorage (que não deve ser consumida pela inicialização)
    window.localStorage.setItem('apex_gp_car1_engine_unit', '4')
    window.localStorage.setItem('apex_gp_car2_engine_unit', '1')

    const careerId = 'career_legacy_keys_test'
    // Time sem car_specifications e com engine_history onde unidades 1 e 2 existem
    const team = createMockTeam('team_apex_no_specs', {
      car_specifications: undefined,
    })

    const grid = createMock24Grid(team.id, 5, 6)

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: 2026,
      round: 5,
      circuitName: 'Monaco',
      circuitCountry: 'Monaco',
      totalLaps: 78,
      playerTeamId: team.id,
      playerTeam: team,
      canonicalQualifyingGrid: grid,
      persistState: false,
    })

    const c1 = raceState.drivers.find((d) => d.driverId === 'player_driver_1')
    const c2 = raceState.drivers.find((d) => d.driverId === 'player_driver_2')

    // canonicalPowerUnitAllocationService faz fallback para PU1 e PU2 (as primeiras do histórico da equipe),
    // NUNCA para as chaves globais legadas '4' e '1'
    expect(c1?.powerUnitId).toBe(1)
    expect(c2?.powerUnitId).toBe(2)
    expect(c1?.powerUnitId).not.toBe(4)
  })

  it('F: Preserva carregamento de sessões legadas sem reconstruir retroativamente sua montagem a partir da garagem atual', () => {
    const careerId = 'career_legacy_session_test'
    // Simula uma sessão legada salva antes da introdução dos campos powerUnitId (undefined)
    const legacySession: CanonicalRaceState = {
      version: '2.0',
      saveSchemaVersion: 'race-save-v1',
      raceVariant: 'MAIN_RACE',
      careerId,
      season: 2026,
      round: 2,
      raceId: `race_${careerId}_s2026_r2`,
      circuitName: 'Jeddah Corniche Circuit',
      circuitCountry: 'Saudi Arabia',
      totalLaps: 50,
      currentLap: 10,
      status: 'running',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      playerTeamId: 'team_apex_legacy',
      tactics: {},
      paceOrders: {},
      revision: 10,
      updatedAt: '2026-03-15T15:00:00Z',
      drivers: [
        {
          careerId,
          season: 2026,
          raceId: `race_${careerId}_s2026_r2`,
          driverId: 'player_drv_legacy_1',
          teamId: 'team_apex_legacy',
          gridPosition: 1,
          currentPosition: 1,
          lap: 10,
          raceTime: 900.5,
          gap: 'LÍDER',
          tyreCompound: 'medio',
          tyreAge: 10,
          fuel: 85,
          carCondition: 98,
          raceStatus: 'racing',
          pitStops: 0,
          driverName: 'Piloto Legado 1',
          teamName: 'Apex GP',
          teamColor: '#00D2BE',
          isPlayer: true,
          carId: 'car1',
          // powerUnitId ausente (sessão legada)
        },
        {
          careerId,
          season: 2026,
          raceId: `race_${careerId}_s2026_r2`,
          driverId: 'player_drv_legacy_2',
          teamId: 'team_apex_legacy',
          gridPosition: 2,
          currentPosition: 2,
          lap: 10,
          raceTime: 901.5,
          gap: '+1.000s',
          tyreCompound: 'medio',
          tyreAge: 10,
          fuel: 85,
          carCondition: 97,
          raceStatus: 'racing',
          pitStops: 0,
          driverName: 'Piloto Legado 2',
          teamName: 'Apex GP',
          teamColor: '#00D2BE',
          isPlayer: true,
          carId: 'car2',
          // powerUnitId ausente (sessão legada)
        },
      ],
      driverLookup: {},
    }

    // Completa os outros 22 pilotos para satisfazer validação de 24 entradas do save
    for (let p = 3; p <= 24; p++) {
      legacySession.drivers.push({
        careerId,
        season: 2026,
        raceId: legacySession.raceId,
        driverId: `rival_drv_${p}`,
        teamId: `team_rival_${p}`,
        gridPosition: p,
        currentPosition: p,
        lap: 10,
        raceTime: 905.0 + p,
        gap: `+${(5 + p).toFixed(3)}s`,
        tyreCompound: 'duro',
        tyreAge: 10,
        fuel: 80,
        carCondition: 95,
        raceStatus: 'racing',
        pitStops: 0,
        driverName: `Rival ${p}`,
        teamName: `Rival Team ${p}`,
        teamColor: '#444444',
        isPlayer: false,
        carId: 'car1',
      })
    }

    // Salva a sessão legada
    canonicalRaceSaveService.saveCanonicalRaceState(legacySession)

    // Carrega a sessão legada:
    // canonicalRaceSaveService não deve re-derivar montagens da garagem atual
    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(careerId, 2026, 2)
    expect(loaded.state).not.toBeNull()

    const d1 = loaded.state!.drivers.find((d) => d.driverId === 'player_drv_legacy_1')
    const d2 = loaded.state!.drivers.find((d) => d.driverId === 'player_drv_legacy_2')

    // Preserva exatamente o estado gravado (sem reconstrução retroativa)
    expect(d1?.powerUnitId).toBeUndefined()
    expect(d1?.powerUnitInitialCondition).toBeUndefined()
    expect(d2?.powerUnitId).toBeUndefined()
    expect(d2?.powerUnitInitialCondition).toBeUndefined()
  })
})
