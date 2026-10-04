/**
 * pu-05a2-p2b-consumer-condition.test.ts
 *
 * Suíte de testes PU-05A2-P2b:
 * Cálculo esportivo da corrida canônica consumindo a condição da unidade de potência
 * vinculada ao participante (powerUnitId e powerUnitInitialCondition / powerUnitCondition).
 *
 * A) UNIDADES DE IDS DISTINTOS E CONDIÇÕES EQUIVALENTES -> contribuição esportiva igual.
 * B) DUAS UNIDADES COM CONDIÇÕES DIFERENTES, INVERTER ATRIBUIÇÃO -> contribuição numérica
 *    coerente com a fórmula atual em cada participante.
 * C) SALVAR/RETOMAR PRESERVA UNIDADE E RESULTADO; montagem posterior na garagem não muda a sessão.
 * D) SESSÃO LEGADA MANTÉM RESULTADO ANTERIOR.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'
import { structuralMissingFactorsService } from '@/services/structuralMissingFactorsService'
import type { TeamModel } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceDriverState, CanonicalRaceState } from '@/types/canonical-race-v2'

describe('PU-05A2-P2b: Consumo da Condição da Unidade Vinculada no Cálculo Esportivo', () => {
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
        condition: 30, // Condição degradada (30% restante -> 70% desgaste)
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
    careerId: 'c_pu_p2b_test',
    season: 2026,
    raceId: 'r_pu_p2b_test',
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

  // =========================================================================
  // TESTE A: UNIDADES DE IDS DISTINTOS E CONDIÇÕES EQUIVALENTES -> CONTRIBUIÇÃO IGUAL
  // =========================================================================
  describe('A) UNIDADES DE IDS DISTINTOS E CONDIÇÕES EQUIVALENTES', () => {
    it('unidades com IDs distintos (PU 1 vs PU 3) e condições equivalentes (95%) produzem rigorosamente a mesma contribuição esportiva', () => {
      // Driver A com PU 1 (condição 95)
      const driverA = createDriverState({
        driverId: 'driver_a',
        powerUnitId: 1,
        powerUnitInitialCondition: 95,
      })

      // Driver B com PU 3 (condição 95, mesmo fornecedor e condição, ID distinto)
      const driverB = createDriverState({
        driverId: 'driver_b',
        powerUnitId: 3,
        powerUnitInitialCondition: 95,
      })

      // Geradores pseudo-aleatórios com mesma semente determinística
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

      // A contribuição esportiva (tempo de volta, desgaste, consumo) é idêntica
      expect(paceA.lapTimeSec).toBe(paceB.lapTimeSec)
      expect(paceA.tireWearIncrement).toBe(paceB.tireWearIncrement)
      expect(paceA.fuelBurnKg).toBe(paceB.fuelBurnKg)

      // Avaliação de risco mecânico / DNF idêntica
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

  // =========================================================================
  // TESTE B: DUAS UNIDADES COM CONDIÇÕES DIFERENTES, INVERTER ATRIBUIÇÃO
  // =========================================================================
  describe('B) DUAS UNIDADES COM CONDIÇÕES DIFERENTES, INVERTER ATRIBUIÇÃO', () => {
    it('unidades com condições diferentes (95% vs 30%) geram deltas esportivos numéricos coerentes com a fórmula oficial, e inversão inverte rigorosamente a contribuição em cada participante', () => {
      // PU Fresca: condição 95% -> desgaste 5%
      // PU Degradada: condição 30% -> desgaste 70%
      // Fórmula oficial: structuralMissingFactorsService.calculatePUWearPenalty
      const freshPenalty =
        structuralMissingFactorsService.calculatePUWearPenalty(5).engineWearPenalty
      const degradedPenalty =
        structuralMissingFactorsService.calculatePUWearPenalty(70).engineWearPenalty
      expect(degradedPenalty).toBeGreaterThan(freshPenalty)
      const expectedDelta = Number((degradedPenalty - freshPenalty).toFixed(3))

      // Configuração 1: Driver 1 com PU Fresca (95%), Driver 2 com PU Degradada (30%)
      const driver1Fresh = createDriverState({
        driverId: 'drv_1',
        carId: 'car1',
        powerUnitId: 1,
        powerUnitInitialCondition: 95,
      })
      const driver2Worn = createDriverState({
        driverId: 'drv_2',
        carId: 'car2',
        powerUnitId: 4,
        powerUnitInitialCondition: 30,
      })

      const pace1_Config1 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver1Fresh,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })
      const pace2_Config1 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver2Worn,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })

      // Driver 2 (PU degradada) perde tempo em relação a Driver 1
      expect(pace2_Config1.lapTimeSec).toBeGreaterThan(pace1_Config1.lapTimeSec)
      const deltaConfig1 = Number((pace2_Config1.lapTimeSec - pace1_Config1.lapTimeSec).toFixed(3))
      expect(Math.abs(deltaConfig1 - expectedDelta)).toBeLessThanOrEqual(0.005)

      // Configuração 2: INVERSÃO DAS ATRIBUIÇÕES
      // Driver 1 passa a usar a PU Degradada (30%), Driver 2 passa a usar a PU Fresca (95%)
      const driver1Worn = createDriverState({
        driverId: 'drv_1',
        carId: 'car1',
        powerUnitId: 4,
        powerUnitInitialCondition: 30,
      })
      const driver2Fresh = createDriverState({
        driverId: 'drv_2',
        carId: 'car2',
        powerUnitId: 1,
        powerUnitInitialCondition: 95,
      })

      const pace1_Config2 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver1Worn,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })
      const pace2_Config2 = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: driver2Fresh,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })

      // Driver 1 (agora PU degradada) perde o mesmo tempo em relação a Driver 2
      expect(pace1_Config2.lapTimeSec).toBeGreaterThan(pace2_Config2.lapTimeSec)
      const deltaConfig2 = Number((pace1_Config2.lapTimeSec - pace2_Config2.lapTimeSec).toFixed(3))
      expect(Math.abs(deltaConfig2 - expectedDelta)).toBeLessThanOrEqual(0.005)

      // Equivalência cruzada exata entre pilotos com a mesma unidade
      expect(pace1_Config1.lapTimeSec).toBe(pace2_Config2.lapTimeSec)
      expect(pace2_Config1.lapTimeSec).toBe(pace1_Config2.lapTimeSec)
    })
  })

  // =========================================================================
  // TESTE C: SALVAR/RETOMAR PRESERVA UNIDADE E RESULTADO; MONTAGEM NA GARAGEM NÃO AFETA
  // =========================================================================
  describe('C) SALVAR/RETOMAR E IMUTABILIDADE DA SESSÃO EM ANDAMENTO', () => {
    it('salvar e retomar preserva a unidade e o resultado do cálculo esportivo; montagem posterior na garagem não altera a sessão', async () => {
      const careerId = 'career_p2b_save_resume_test'
      const team = createMockTeam('team_apex_save_resume', {
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

      // Inicializa a sessão canônica persistindo no save
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

      // Calcula o pace inicial do participante
      const initialPace = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: c1Initial,
        lap: 1,
        weather: 'seco',
        round: 2,
        circuitLengthKm: 6.174,
        rng: () => 0.5,
      })

      // Simula alteração posterior da montagem na garagem (após a corrida já ter iniciado)
      // Gravando nova alocação na garagem / especificações
      await canonicalPowerUnitAllocationService.setAllocation({
        careerId,
        team,
        car1Unit: 2, // Garagem trocou Carro 1 para PU 2 (condição 60)
        car2Unit: 3,
      })

      // Carrega a sessão salva em andamento
      const loaded = canonicalRaceSaveService.loadCanonicalRaceState(careerId, 2026, 2)
      expect(loaded.state).not.toBeNull()
      const c1Loaded = loaded.state!.drivers.find((d) => d.driverId === 'player_driver_1')!

      // A unidade e a condição vinculadas à sessão em andamento permanecem INALTERADAS
      expect(c1Loaded.powerUnitId).toBe(1)
      expect(c1Loaded.powerUnitInitialCondition).toBe(95)
      expect(c1Loaded.powerUnitId).not.toBe(2)

      // O cálculo esportivo recalculado a partir do estado retomado é rigorosamente IDÊNTICO
      const resumedPace = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: c1Loaded,
        lap: 1,
        weather: 'seco',
        round: 2,
        circuitLengthKm: 6.174,
        rng: () => 0.5,
      })

      expect(resumedPace.lapTimeSec).toBe(initialPace.lapTimeSec)
      expect(resumedPace.tireWearIncrement).toBe(initialPace.tireWearIncrement)
      expect(resumedPace.fuelBurnKg).toBe(initialPace.fuelBurnKg)
    })
  })

  // =========================================================================
  // TESTE D: SESSÃO LEGADA MANTÉM RESULTADO ANTERIOR
  // =========================================================================
  describe('D) SESSÃO LEGADA MANTÉM RESULTADO ANTERIOR', () => {
    it('participante legado (sem powerUnitInitialCondition nem powerUnitCondition) mantém exatamente a fórmula e resultado do caminho anterior', () => {
      // Participante sem campos de unidade física (sessão legada anterior ao P2)
      const legacyDriver = createDriverState({
        driverId: 'legacy_driver',
        carCondition: 90, // Desgaste agregado do carro: (100 - 90) * 0.85 = 8.5%
        powerUnitId: undefined,
        powerUnitInitialCondition: undefined,
        powerUnitCondition: undefined,
      })

      // Cálculo no motor canônico
      const legacyPace = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: legacyDriver,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })

      // No caminho legado:
      // puWearPercent = (100 - legacyDriver.carCondition) * 0.85 = (100 - 90) * 0.85 = 8.5%
      // damagePenaltySec = (100 - 90) * 0.04 + puPenalty(8.5%)
      const expectedLegacyPuWear = (100 - 90) * 0.85
      const expectedLegacyPuPenalty =
        structuralMissingFactorsService.calculatePUWearPenalty(
          expectedLegacyPuWear,
        ).engineWearPenalty
      const expectedLegacyDamagePenalty = (100 - 90) * 0.04 + expectedLegacyPuPenalty

      // Se compararmos com um participante novo com powerUnitInitialCondition exatamente igual a (100 - 8.5) = 91.5%:
      const equivalentLinkedDriver = createDriverState({
        driverId: 'linked_equivalent',
        carCondition: 90,
        powerUnitId: 1,
        powerUnitInitialCondition: 100 - expectedLegacyPuWear,
      })

      const linkedPace = canonicalRaceEngineService.calculateCanonicalLapPace({
        driver: equivalentLinkedDriver,
        lap: 5,
        weather: 'seco',
        round: 1,
        circuitLengthKm: 5.412,
        rng: () => 0.5,
      })

      // Ambos devem convergir para o mesmo resultado exato, provando compatibilidade estrita
      expect(legacyPace.lapTimeSec).toBe(linkedPace.lapTimeSec)
      expect(legacyPace.tireWearIncrement).toBe(linkedPace.tireWearIncrement)
      expect(legacyPace.fuelBurnKg).toBe(linkedPace.fuelBurnKg)
    })
  })
})
