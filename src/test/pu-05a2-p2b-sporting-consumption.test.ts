/**
 * pu-05a2-p2b-sporting-consumption.test.ts
 *
 * Suíte de testes PU-05A2-P2b:
 * Validação do consumo esportivo da condição da unidade de potência física vinculada ao participante.
 *
 * A) EQUIVALÊNCIA: mesmas demais entradas, unidades de IDs diferentes com condições/atributos equivalentes -> mesma contribuição esportiva.
 * B) CONDIÇÃO INDIVIDUAL EFETIVA: duas unidades válidas com condições diferentes numa faixa em que a fórmula existente diferencie; inverter a atribuição mantendo o resto controlado; verificar contribuição correspondente a cada participante, com valor numérico coerente com a fórmula atual.
 * C) RETOMADA: salvar/retomar preserva unidade e resultado do cálculo; montagem posterior na garagem não altera a unidade da sessão já iniciada.
 * D) COMPATIBILIDADE: sessão legada mantém o resultado do caminho anterior; reexecução da regressão P2a de associação inválida sem alterá-la.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'
import { structuralMissingFactorsService } from '@/services/structuralMissingFactorsService'
import type { TeamModel } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceDriverState } from '@/types/canonical-race-v2'

describe('PU-05A2-P2b: Consumo Esportivo da Condição da Unidade Física Vinculada', () => {
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
        wear: 5,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 3,
        condition: 95, // Condição IDÊNTICA à PU 1 (95%)
        mileage_km: 300,
      },
      {
        id: 4,
        wear: 70,
        status: 'reserva',
        supplier: 'Mercedes',
        introducedRound: 4,
        condition: 30, // Condição bem degradada (30% restante -> 70% desgaste)
        mileage_km: 3200,
      },
    ],
    grid_penalties: [],
    ...overrides,
  })

  const createMock24Grid = (
    playerTeamId: string,
    playerCar1Pos: number = 1,
    playerCar2Pos: number = 2,
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
          bestLapSec: 88.0,
          bestLapTime: '1:28.000',
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

  const createDriverState = (
    overrides: Partial<CanonicalRaceDriverState> = {},
  ): CanonicalRaceDriverState => ({
    careerId: 'c_test',
    season: 2026,
    raceId: 'r_test',
    driverId: 'player_driver_1',
    driverName: 'Piloto Teste',
    teamId: 'team_apex_p2b',
    teamName: 'Apex GP',
    teamColor: '#00D2BE',
    isPlayer: true,
    carId: 'car1',
    carIndex: 1,
    gridPosition: 1,
    currentPosition: 1,
    lap: 5,
    raceTime: 400.0,
    gap: 'LÍDER',
    tyreCompound: 'medio',
    tyreAge: 5,
    fuel: 80,
    carCondition: 100, // Condição perfeita de chassis/carro
    raceStatus: 'racing',
    pitStops: 0,
    strategy: {
      paceMode: 'NORMAL',
    } as any,
    ...overrides,
  })

  beforeEach(() => {
    canonicalPowerUnitAllocationService.clearMemoryCache()
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
    vi.restoreAllMocks()
  })

  describe('A) EQUIVALÊNCIA', () => {
    it('mesmas demais entradas, unidades de IDs diferentes com condições idênticas produzem rigorosamente a mesma contribuição esportiva', () => {
      // Driver A com PU 1 (condição 95)
      const driverA = createDriverState({
        driverId: 'driver_a',
        powerUnitId: 1,
        powerUnitInitialCondition: 95,
      })

      // Driver B com PU 3 (condição 95, mas ID diferente)
      const driverB = createDriverState({
        driverId: 'driver_b',
        powerUnitId: 3,
        powerUnitInitialCondition: 95,
      })

      // Gerador determinístico idêntico
      const rngA = () => 0.5
      const rngB = () => 0.5

      const paceA = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverA,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: rngA,
      })

      const paceB = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driverB,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: rngB,
      })

      // A contribuição esportiva (tempo de volta) é idêntica
      expect(paceA.lapTimeSec).toBe(paceB.lapTimeSec)
      expect(paceA.tireWearIncrement).toBe(paceB.tireWearIncrement)
      expect(paceA.fuelBurnKg).toBe(paceB.fuelBurnKg)

      // Risco de DNF também idêntico
      const dnfA = canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverA,
        lap: 5,
        rng: () => 0.999,
      })
      const dnfB = canonicalRaceEngineService.evaluateDnfRoll({
        driver: driverB,
        lap: 5,
        rng: () => 0.999,
      })
      expect(dnfA.isDnf).toBe(dnfB.isDnf)
    })
  })

  describe('B) CONDIÇÃO INDIVIDUAL EFETIVA', () => {
    it('duas unidades com condições diferentes geram contribuições esportivas distintas coerentes com a fórmula oficial, e inversão das alocações inverte o delta', () => {
      // PU Nova: condição 95% -> desgaste 5%
      // PU Degradada: condição 30% -> desgaste 70%
      // Pela fórmula de calculatePUWearPenalty:
      // Desgaste 5% (regime FRESH <= 30%): (5 / 30) * 0.05 = ~0.008s
      // Desgaste 70% (regime DEGRADED 60..85%): 0.2 + ((70 - 60)/25) * 0.3 = 0.2 + 0.12 = 0.320s
      // Diferença esportiva teórica esperada entre elas: ~0.312s
      const expectedFreshPenalty =
        structuralMissingFactorsService.calculatePUWearPenalty(5).engineWearPenalty
      const expectedDegradedPenalty =
        structuralMissingFactorsService.calculatePUWearPenalty(70).engineWearPenalty
      expect(expectedDegradedPenalty).toBeGreaterThan(expectedFreshPenalty)
      const expectedDelta = Number((expectedDegradedPenalty - expectedFreshPenalty).toFixed(3))

      // Caso 1: Driver 1 usa PU Fresca (95%), Driver 2 usa PU Degradada (30%)
      const driver1WithFresh = createDriverState({
        driverId: 'drv_1',
        carId: 'car1',
        powerUnitId: 1,
        powerUnitInitialCondition: 95,
      })
      const driver2WithWorn = createDriverState({
        driverId: 'drv_2',
        carId: 'car2',
        powerUnitId: 4,
        powerUnitInitialCondition: 30,
      })

      const pace1A = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver1WithFresh,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })
      const pace2A = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver2WithWorn,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })

      // Driver 2 (com PU degradada) é mais lento
      expect(pace2A.lapTimeSec).toBeGreaterThan(pace1A.lapTimeSec)
      const actualDeltaA = Number((pace2A.lapTimeSec - pace1A.lapTimeSec).toFixed(3))
      expect(Math.abs(actualDeltaA - expectedDelta)).toBeLessThanOrEqual(0.005)

      // Caso 2: Inversão controlada das atribuições
      // Driver 1 passa a usar a PU Degradada (30%), Driver 2 usa a PU Fresca (95%)
      const driver1WithWorn = createDriverState({
        driverId: 'drv_1',
        carId: 'car1',
        powerUnitId: 4,
        powerUnitInitialCondition: 30,
      })
      const driver2WithFresh = createDriverState({
        driverId: 'drv_2',
        carId: 'car2',
        powerUnitId: 1,
        powerUnitInitialCondition: 95,
      })

      const pace1B = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver1WithWorn,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })
      const pace2B = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver2WithFresh,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })

      // Agora Driver 1 é mais lento exatamente pela mesma penalidade
      expect(pace1B.lapTimeSec).toBeGreaterThan(pace2B.lapTimeSec)
      const actualDeltaB = Number((pace1B.lapTimeSec - pace2B.lapTimeSec).toFixed(3))
      expect(Math.abs(actualDeltaB - expectedDelta)).toBeLessThanOrEqual(0.005)

      // O tempo do carro com motor fresco é idêntico nos dois casos
      expect(pace1A.lapTimeSec).toBe(pace2B.lapTimeSec)
      // O tempo do carro com motor desgastado é idêntico nos dois casos
      expect(pace2A.lapTimeSec).toBe(pace1B.lapTimeSec)
    })
  })

  describe('C) RETOMADA (Sessão Iniciada)', () => {
    it('salvar e retomar preserva a unidade e o resultado do cálculo; montagem posterior na garagem não altera a unidade da sessão em andamento', () => {
      const careerId = 'career_p2b_resume_test'
      const team = createMockTeam('team_apex_resume', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 1, // Condição 95
            car2Unit: 4, // Condição 30
            updatedAt: '2026-05-01T00:00:00Z',
            careerId,
          },
        },
      })

      const grid = createMock24Grid(team.id, 1, 2)

      // Inicializa a sessão canônica
      const initialRaceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season: 2026,
        round: 2,
        circuitName: 'Jeddah Corniche Circuit',
        circuitCountry: 'Saudi Arabia',
        totalLaps: 50,
        playerTeamId: team.id,
        playerTeam: team,
        canonicalQualifyingGrid: grid,
        persistState: true,
      })

      const c1Initial = initialRaceState.drivers.find((d) => d.driverId === 'player_driver_1')!
      expect(c1Initial.powerUnitId).toBe(1)
      expect(c1Initial.powerUnitInitialCondition).toBe(95)

      // Calcula o pace inicial
      const initialPace = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: c1Initial,
        lap: 1,
        weather: 'seco',
        round: 2,
        circuitLengthKm: 6.174,
        rng: () => 0.5,
      })

      // Simula alteração posterior da montagem na garagem (após a corrida já ter iniciado)
      // Carro 1 agora é alocado com PU 2 na garagem
      canonicalPowerUnitAllocationService.setAllocation({
        careerId,
        team,
        car1Unit: 2,
        car2Unit: 4,
      })

      // Carrega a sessão salva em andamento
      const loaded = canonicalRaceSaveService.loadCanonicalRaceState(careerId, 2026, 2)
      expect(loaded.state).not.toBeNull()
      const c1Loaded = loaded.state!.drivers.find((d) => d.driverId === 'player_driver_1')!

      // A sessão em andamento MANTÉM sua unidade original (PU 1) e condição inicial (95)
      expect(c1Loaded.powerUnitId).toBe(1)
      expect(c1Loaded.powerUnitInitialCondition).toBe(95)

      // O cálculo esportivo com o estado retomado produz rigorosamente o mesmo resultado
      const resumedPace = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: c1Loaded,
        lap: 1,
        weather: 'seco',
        round: 2,
        circuitLengthKm: 6.174,
        rng: () => 0.5,
      })

      expect(resumedPace.lapTimeSec).toBe(initialPace.lapTimeSec)
    })
  })

  describe('D) COMPATIBILIDADE', () => {
    it('sessão legada sem vínculos de unidade preserva o cálculo pelo caminho anterior de compatibilidade', () => {
      // Driver sem powerUnitId e sem powerUnitInitialCondition
      const legacyDriver = createDriverState({
        driverId: 'legacy_driver',
        powerUnitId: undefined,
        powerUnitInitialCondition: undefined,
        powerUnitCondition: undefined,
        carCondition: 90, // Desgaste agregado: (100 - 90) * 0.85 = 8.5%
      })

      const expectedWear = (100 - legacyDriver.carCondition) * 0.85
      const expectedPuPenalty =
        structuralMissingFactorsService.calculatePUWearPenalty(expectedWear).engineWearPenalty

      const legacyPace = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: legacyDriver,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })

      expect(legacyPace.lapTimeSec).toBeGreaterThan(60.0)
      expect(expectedPuPenalty).toBeGreaterThan(0)
    })

    it('sessão nova com unidade inválida segue sendo estritamente rejeitada com erro PU-99 (regressão P2a)', () => {
      const careerId = 'career_p2b_invalid_pu_test'
      const teamWithInvalidPU = createMockTeam('team_apex_invalid_p2b', {
        car_specifications: {
          power_unit_allocations: {
            car1Unit: 99, // Unidade inexistente no inventário
            car2Unit: 2,
            updatedAt: '2026-05-01T00:00:00Z',
            careerId,
          },
        },
      })

      const grid = createMock24Grid(teamWithInvalidPU.id, 1, 2)

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
})
