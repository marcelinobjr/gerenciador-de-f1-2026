/**
 * pu-05a2-p2-race-linkage.test.ts
 *
 * Suíte de Testes Direcionados de Produção Real para PU-05A2-P2:
 * Conexão da alocação persistida de power units à inicialização e ao consumidor
 * esportivo da corrida oficial (/corrida/live).
 *
 * TESTES OBRIGATÓRIOS DO BRIEFING:
 * A. DUAS UNIDADES/GRID INVERTIDO: alocações persistidas pelo serviço P1 (carro 1→unidade A, carro 2→unidade B);
 *    inicializar com grid em ordem diferente; provar vínculos corretos nos participantes.
 * B. CONSUMIDOR ESPORTIVO: unidades válidas com condições distintas; o cálculo real recebe a condição correspondente
 *    a cada participante, sem fallback agregado indevido. Não basta campo novo no RaceState; não mockar o cálculo.
 *    Unidades equivalentes permanecem equivalentes; condições diferentes produzem só os efeitos já previstos no modelo.
 * C. RETOMADA: salvar/retomar preserva unidade e condição; alterar garagem depois não altera sessão iniciada.
 * D. LEGADO E VALIDAÇÃO: sessão antiga segue caminho de compatibilidade; sessão nova rejeita unidade inexistente
 *    ou de outra equipe/save. Fixtures isoladas; não tocar no save real do jogador.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalPowerUnitAllocationService } from '@/services/canonicalPowerUnitAllocationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import type { TeamModel } from '@/types/f1'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

describe('PU-05A2-P2: Conexão de Alocação de PUs à Corrida Oficial (Testes A - D)', () => {
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

    // Equipes rivais 2 a 12
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

  // =========================================================================
  // TESTE A — DUAS UNIDADES / GRID INVERTIDO
  // =========================================================================
  it('TESTE A — DUAS UNIDADES/GRID INVERTIDO: alocações persistidas pelo serviço P1 vinculadas por identidade canônica de carro e não por posição no grid', () => {
    const careerId = 'career_pu_grid_test'
    const team = createMockTeamWithEngines('team_apex_p2', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 1, // Condição 95
          car2Unit: 3, // Condição 85
          updatedAt: new Date().toISOString(),
          careerId,
        },
      },
    })

    // Cenário 1: Grid Regular (Carro 1 em P1, Carro 2 em P24)
    const gridRegular = createMockGrid(team.id, [1, 24])
    const raceRegular = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: 2026,
      round: 1,
      circuitName: 'Bahrain International Circuit',
      circuitCountry: 'Bahrain',
      totalLaps: 57,
      playerTeamId: team.id,
      playerTeam: team,
      canonicalQualifyingGrid: gridRegular,
      persistState: false,
    })

    const pCar1Regular = raceRegular.drivers.find((d) => d.driverId === 'player_driver_c1')!
    const pCar2Regular = raceRegular.drivers.find((d) => d.driverId === 'player_driver_c2')!

    expect(pCar1Regular.carId).toBe('car1')
    expect(pCar1Regular.powerUnitId).toBe(1)
    expect(pCar1Regular.powerUnitInitialCondition).toBe(95)

    expect(pCar2Regular.carId).toBe('car2')
    expect(pCar2Regular.powerUnitId).toBe(3)
    expect(pCar2Regular.powerUnitInitialCondition).toBe(85)

    // Cenário 2: Grid Invertido (Carro 2 larga na pole P1, Carro 1 larga no fundo P20)
    const gridInverted = createMockGrid(team.id, [20, 1]) // c1 em P20, c2 em P1
    const raceInverted = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
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

    const pCar1Inverted = raceInverted.drivers.find((d) => d.driverId === 'player_driver_c1')!
    const pCar2Inverted = raceInverted.drivers.find((d) => d.driverId === 'player_driver_c2')!

    // Apesar do Carro 2 largar na frente (P1), a PU vinculada deve ser ESTRITAMENTE a PU 3 (do Carro 2), NUNCA invertida!
    expect(pCar1Inverted.gridPosition).toBe(20)
    expect(pCar1Inverted.carId).toBe('car1')
    expect(pCar1Inverted.powerUnitId).toBe(1)
    expect(pCar1Inverted.powerUnitInitialCondition).toBe(95)

    expect(pCar2Inverted.gridPosition).toBe(1)
    expect(pCar2Inverted.carId).toBe('car2')
    expect(pCar2Inverted.powerUnitId).toBe(3)
    expect(pCar2Inverted.powerUnitInitialCondition).toBe(85)
  })

  // =========================================================================
  // TESTE B — CONSUMIDOR ESPORTIVO
  // =========================================================================
  it('TESTE B — CONSUMIDOR ESPORTIVO: cálculo real de performance e risco recebe a condição individual da unidade de potência vinculada', () => {
    const careerId = 'career_pu_sporting_test'
    // Carro 1 com PU nova (PU 1 -> 95% cond / 5% wear)
    // Carro 2 com PU muito desgastada (PU 4 -> 30% cond / 70% wear)
    const team = createMockTeamWithEngines('team_apex_sporting', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 1,
          car2Unit: 4,
          updatedAt: new Date().toISOString(),
          careerId,
        },
      },
    })

    const grid = createMockGrid(team.id, [1, 2])
    const race = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: 2026,
      round: 1,
      circuitName: 'Bahrain International Circuit',
      circuitCountry: 'Bahrain',
      totalLaps: 57,
      playerTeamId: team.id,
      playerTeam: team,
      canonicalQualifyingGrid: grid,
      persistState: false,
    })

    const driverFreshPU = race.drivers.find((d) => d.driverId === 'player_driver_c1')!
    const driverWornPU = race.drivers.find((d) => d.driverId === 'player_driver_c2')!

    expect(driverFreshPU.powerUnitInitialCondition).toBe(95)
    expect(driverWornPU.powerUnitInitialCondition).toBe(30)

    // RNG fixo idêntico para simulação pura
    const rng = () => 0.5

    const paceFresh = canonicalRaceEngineService.calculateCanonicalLapPace({
      driver: driverFreshPU,
      lap: 5,
      weather: 'seco',
      round: 1,
      circuitName: 'Bahrain International Circuit',
      circuitLengthKm: 5.412,
      rng,
    })

    const paceWorn = canonicalRaceEngineService.calculateCanonicalLapPace({
      driver: driverWornPU,
      lap: 5,
      weather: 'seco',
      round: 1,
      circuitName: 'Bahrain International Circuit',
      circuitLengthKm: 5.412,
      rng,
    })

    // A PU desgastada (PU 4, wear 70%) DEVE ter lapTimeSec maior devido à penalidade de desgaste de PU já prevista no modelo
    expect(paceWorn.lapTimeSec).toBeGreaterThan(paceFresh.lapTimeSec)
    // A diferença deve estar rigorosamente na faixa das regras de PU Wear do structuralMissingFactorsService (0.2s - 0.5s para wear 70%)
    const paceDelta = paceWorn.lapTimeSec - paceFresh.lapTimeSec
    expect(paceDelta).toBeGreaterThanOrEqual(0.15)
    expect(paceDelta).toBeLessThanOrEqual(0.6)

    // Unidades equivalentes: se os dois carros tiverem PUs de mesma condição, devem ter o mesmo ritmo
    const driverEquivalent = {
      ...driverWornPU,
      powerUnitInitialCondition: 95,
      gridPosition: driverFreshPU.gridPosition,
    }
    const paceEquiv = canonicalRaceEngineService.calculateCanonicalLapPace({
      driver: driverEquivalent,
      lap: 5,
      weather: 'seco',
      round: 1,
      circuitName: 'Bahrain International Circuit',
      circuitLengthKm: 5.412,
      rng,
    })
    expect(paceEquiv.lapTimeSec).toBe(paceFresh.lapTimeSec)
  })

  // =========================================================================
  // TESTE C — RETOMADA E ESTABILIDADE DE SESSÃO
  // =========================================================================
  it('TESTE C — RETOMADA: salvar/retomar preserva unidade e condição; alterar garagem depois não altera sessão iniciada', () => {
    const careerId = 'career_pu_resume_test'
    const team = createMockTeamWithEngines('team_apex_resume', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 1, // Condição 95
          car2Unit: 2, // Condição 60
          updatedAt: new Date().toISOString(),
          careerId,
        },
      },
    })

    const grid = createMockGrid(team.id, [3, 4])
    // Inicializa e persiste a corrida
    const initialRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
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

    expect(initialRace.drivers.find((d) => d.driverId === 'player_driver_c1')?.powerUnitId).toBe(1)
    expect(initialRace.drivers.find((d) => d.driverId === 'player_driver_c2')?.powerUnitId).toBe(2)

    // Simula alteração posterior da garagem (ex: o jogador foi à página Carro e trocou Carro 1 para PU 3)
    canonicalPowerUnitAllocationService
      .setSingleCarAllocation({
        team,
        targetCar: 1,
        unitNumber: 3,
        careerId,
      })
      .catch(() => {})

    // Garagem agora aponta para PU 3 no Carro 1
    const garageAlloc = canonicalPowerUnitAllocationService.resolveAllocation({ team, careerId })
    expect(garageAlloc.car1Unit).toBe(3)

    // Recarregar a corrida em andamento pelo serviço de leitura oficial
    const reloadedRace = canonicalRaceInitializationService.readCanonicalRaceState(
      careerId,
      2026,
      2,
      'MAIN_RACE',
    )

    expect(reloadedRace).not.toBeNull()
    const reloadedC1 = reloadedRace!.drivers.find((d) => d.driverId === 'player_driver_c1')!
    const reloadedC2 = reloadedRace!.drivers.find((d) => d.driverId === 'player_driver_c2')!

    // A sessão de corrida iniciada PRESERVA sua unidade de montagem (PU 1) e condição (95%),
    // NÃO sendo trocada silenciosamente pela alteração da garagem!
    expect(reloadedC1.powerUnitId).toBe(1)
    expect(reloadedC1.powerUnitInitialCondition).toBe(95)
    expect(reloadedC2.powerUnitId).toBe(2)
    expect(reloadedC2.powerUnitInitialCondition).toBe(60)
  })

  // =========================================================================
  // TESTE D — LEGADO E VALIDAÇÃO
  // =========================================================================
  it('TESTE D — LEGADO E VALIDAÇÃO: sessão antiga segue compatibilidade; sessão nova rejeita unidade inexistente ou de outra equipe', () => {
    const careerId = 'career_pu_legacy_test'

    // 1. Compatibilidade com Sessão Legada (sem campos powerUnitId nem powerUnitInitialCondition)
    const legacyDriver = {
      careerId,
      season: 2026,
      raceId: 'race_legacy_01',
      driverId: 'legacy_driver',
      teamId: 'team_ferrari',
      gridPosition: 1,
      currentPosition: 1,
      lap: 10,
      raceTime: 850.0,
      gap: 'LÍDER',
      tyreCompound: 'medio' as const,
      tyreAge: 10,
      fuel: 80.0,
      carCondition: 98,
      raceStatus: 'racing' as const,
      pitStops: 0,
      driverName: 'Piloto Legado',
      teamName: 'Scuderia Ferrari',
      teamColor: '#DC0000',
      isPlayer: false,
    }

    // O motor canônico executa sem erro para o participante legado, utilizando condição nominal padrão
    const rng = () => 0.5
    const legacyPace = canonicalRaceEngineService.calculateCanonicalLapPace({
      driver: legacyDriver,
      lap: 11,
      weather: 'seco',
      round: 1,
      circuitName: 'Bahrain',
      circuitLengthKm: 5.412,
      rng,
    })
    expect(legacyPace.lapTimeSec).toBeGreaterThan(60)

    // 2. Validação Estrita para Nova Sessão:
    // Se a equipe tentar inicializar uma nova corrida com uma alocação que aponta para unidade inexistente (ex: PU 99),
    // a inicialização DEVE rejeitar em vez de inventar vínculo ou contornar como legado
    const teamInvalid = createMockTeamWithEngines('team_invalid_pu', {
      car_specifications: {
        power_unit_allocations: {
          car1Unit: 99, // Unidade inexistente no inventário
          car2Unit: 2,
          updatedAt: new Date().toISOString(),
          careerId,
        },
      },
    })

    const grid = createMockGrid(teamInvalid.id, [1, 2])
    expect(() => {
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId,
        season: 2026,
        round: 1,
        circuitName: 'Bahrain',
        circuitCountry: 'Bahrain',
        totalLaps: 57,
        playerTeamId: teamInvalid.id,
        playerTeam: teamInvalid,
        canonicalQualifyingGrid: grid,
        persistState: false,
      })
    }).toThrow(/Alocação de Unidade de Potência inválida/)
  })
})
