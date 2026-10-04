/**
 * pu-05a2-p2a-initialization-linkage.test.ts
 *
 * PU-05A2-P2a: Teste único confirmando que a inicialização da corrida canônica
 * preenche os vínculos com unidades distintas por carro em ordem de grid invertida,
 * pela identidade canônica de carreira/equipe/carro, e trata associações inválidas.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import type { TeamModel } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

describe('PU-05A2-P2a: Vínculo da unidade montada ao participante na inicialização', () => {
  const createMockTeamWithEngines = (
    id: string,
    overrides: Partial<TeamModel> = {},
  ): TeamModel => ({
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
        wear: 5,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 1,
        condition: 95,
        mileage_km: 300,
      },
      {
        id: 2,
        wear: 40,
        status: 'instalado',
        supplier: 'Mercedes',
        introducedRound: 2,
        condition: 60,
        mileage_km: 1800,
      },
      {
        id: 3,
        wear: 15,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 4,
        condition: 85,
        mileage_km: 500,
      },
      {
        id: 4,
        wear: 70,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 5,
        condition: 30,
        mileage_km: 3200,
      },
    ],
    grid_penalties: [],
    ...overrides,
  })

  const createMockGrid = (
    playerTeamId: string,
    playerPositions: [number, number] = [1, 2],
  ): FinalQualifyingGridEntry[] => {
    const grid: FinalQualifyingGridEntry[] = []
    let driverCount = 0

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

    for (let p = 1; p <= 24; p++) {
      if (p === playerPositions[0]) {
        grid.push({
          gridPosition: p,
          driverId: 'player_driver_c1',
          driverName: 'Piloto Carro 1',
          teamId: playerTeamId,
          teamName: 'Apex Grand Prix Team',
          teamColor: '#00D2BE',
          carId: 'car1',
          isPlayer: true,
          bestLapCompound: 'medio',
          eliminationStage: 'Q3',
          bestLapSec: 88.5,
          bestLapTime: '1:28.500',
        })
      } else if (p === playerPositions[1]) {
        grid.push({
          gridPosition: p,
          driverId: 'player_driver_c2',
          driverName: 'Piloto Carro 2',
          teamId: playerTeamId,
          teamName: 'Apex Grand Prix Team',
          teamColor: '#00D2BE',
          carId: 'car2',
          isPlayer: true,
          bestLapCompound: 'medio',
          eliminationStage: 'Q3',
          bestLapSec: 88.7,
          bestLapTime: '1:28.700',
        })
      } else {
        const rivalIndex = Math.floor(driverCount / 2) % rivalTeams.length
        const rTeam = rivalTeams[rivalIndex]
        const seat = (driverCount % 2) + 1
        driverCount++
        grid.push({
          gridPosition: p,
          driverId: `rival_drv_${p}`,
          driverName: `Rival ${p}`,
          teamId: rTeam,
          teamName: `Equipe ${rTeam}`,
          teamColor: '#777777',
          carId: seat === 1 ? 'car1' : 'car2',
          isPlayer: false,
          bestLapCompound: 'medio',
          eliminationStage: p <= 10 ? 'Q3' : p <= 16 ? 'Q2' : 'Q1',
          bestLapSec: 88.0 + p * 0.1,
          bestLapTime: `1:${(28 + p * 0.1).toFixed(3)}`,
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

  it('preenche vínculos com unidades distintas por carro em ordem de grid invertida pela identidade real de carro', () => {
    const careerId = 'career_p2a_grid_invert_test'
    // Carro 1 alocado com PU 1 (condição 95)
    // Carro 2 alocado com PU 3 (condição 85)
    const team = createMockTeamWithEngines('team_apex_p2a', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 1,
          car2Unit: 3,
          updatedAt: new Date().toISOString(),
          careerId,
        },
      },
    })

    // Grid invertido: Carro 2 larga em P1 (pole) e Carro 1 larga em P20 (fundo)
    const gridInverted = createMockGrid(team.id, [20, 1])

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: 2026,
      round: 1,
      circuitName: 'Bahrain International Circuit',
      circuitCountry: 'Bahrain',
      totalLaps: 57,
      playerTeamId: team.id,
      playerTeam: team,
      canonicalQualifyingGrid: gridInverted,
      persistState: false,
    })

    const driverCar1 = raceState.drivers.find((d) => d.driverId === 'player_driver_c1')
    const driverCar2 = raceState.drivers.find((d) => d.driverId === 'player_driver_c2')

    expect(driverCar1).toBeDefined()
    expect(driverCar2).toBeDefined()

    // Carro 1 (P20) deve receber rigorosamente a PU 1 (condição 95) associada ao Carro 1
    expect(driverCar1!.gridPosition).toBe(20)
    expect(driverCar1!.carId).toBe('car1')
    expect(driverCar1!.powerUnitId).toBe(1)
    expect(driverCar1!.powerUnitInitialCondition).toBe(95)

    // Carro 2 (P1) deve receber rigorosamente a PU 3 (condição 85) associada ao Carro 2
    expect(driverCar2!.gridPosition).toBe(1)
    expect(driverCar2!.carId).toBe('car2')
    expect(driverCar2!.powerUnitId).toBe(3)
    expect(driverCar2!.powerUnitInitialCondition).toBe(85)

    // Unidades são distintas entre os dois carros
    expect(driverCar1!.powerUnitId).not.toBe(driverCar2!.powerUnitId)
  })

  it('rejeita com exceção quando a unidade alocada não existir no inventário da equipe (PU-99)', () => {
    const careerId = 'career_p2a_invalid_test'
    // Alocação com unidade 99 inexistente no inventário
    const teamWithInvalidPU = createMockTeamWithEngines('team_apex_p2a_invalid', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 99, // inexistente
          car2Unit: 2,
          updatedAt: new Date().toISOString(),
          careerId,
        },
      },
    })

    const grid = createMockGrid(teamWithInvalidPU.id, [1, 2])

    expect(() => {
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season: 2026,
        round: 1,
        circuitName: 'Bahrain International Circuit',
        circuitCountry: 'Bahrain',
        totalLaps: 57,
        playerTeamId: teamWithInvalidPU.id,
        playerTeam: teamWithInvalidPU,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })
    }).toThrow(/PU-99/)
  })
})
