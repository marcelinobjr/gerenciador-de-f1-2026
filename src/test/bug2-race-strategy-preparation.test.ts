import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import { raceStrategyService } from '@/services/raceStrategyService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { TireSetItem } from '@/types/f1'
import type { RacePreparationSnapshot } from '@/types/canonical-race-preparation'

describe('BUG-02 COMMIT C — Suíte de Preparação de Corrida e Estratégia Pré-Largada (BUG2-R01..12)', () => {
  const careerId = 'career_test_bug2_c'
  const seasonYear = 2026
  const round = 1
  const teamId = 'team_audi'
  const totalLaps = 57

  const driver1 = {
    id: 'drv_hulkenberg',
    name: 'Nico Hülkenberg',
    teamId,
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    carNumber: 27,
  }

  const driver2 = {
    id: 'drv_bortoleto',
    name: 'Gabriel Bortoleto',
    teamId,
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    carNumber: 5,
  }

  // 22 rivais para compor o grid P1..P24 do BUG-04
  const buildCanonicalGrid = (): FinalQualifyingGridEntry[] => {
    const grid: FinalQualifyingGridEntry[] = []

    // 22 rivais ocupam P1..P22
    for (let pos = 1; pos <= 22; pos++) {
      grid.push({
        gridPosition: pos,
        driverId: `drv_rival_${pos}`,
        driverName: `Rival Driver ${pos}`,
        teamId: `team_rival_${Math.ceil(pos / 2)}`,
        teamName: `Rival Team ${Math.ceil(pos / 2)}`,
        teamColor: '#64748B',
        isPlayer: false,
        eliminationStage: pos > 10 ? (pos > 18 ? 'Q1' : 'Q2') : 'Q3',
        bestLapSec: 80.0 + pos * 0.05,
        bestLapTime: `1:20.${pos.toString().padStart(3, '0')}`,
        bestLapCompound: 'macio',
      })
    }

    // Carro 1 em P23 e Carro 2 em P24 (Golden scenario do BUG-04)
    grid.push({
      gridPosition: 23,
      driverId: driver1.id,
      driverName: driver1.name,
      teamId,
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayer: true,
      carId: 'car1',
      eliminationStage: 'Q1',
      bestLapSec: 82.1,
      bestLapTime: '1:22.100',
      bestLapCompound: 'medio',
    })

    grid.push({
      gridPosition: 24,
      driverId: driver2.id,
      driverName: driver2.name,
      teamId,
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayer: true,
      carId: 'car2',
      eliminationStage: 'Q1',
      bestLapSec: 82.3,
      bestLapTime: '1:22.300',
      bestLapCompound: 'macio',
    })

    return grid
  }

  // Mock de inventário físico com desgaste real herdado
  const buildMockInventories = (): Record<string, TireSetItem[]> => {
    return {
      [driver1.id]: [
        {
          id: 'set_med_02_hulk',
          driverId: driver1.id,
          compound: 'medio',
          wear: 8,
          lapsUsed: 4,
          isFitted: true,
          status: 'usado',
        },
        {
          id: 'set_hard_01_hulk',
          driverId: driver1.id,
          compound: 'duro',
          wear: 0,
          lapsUsed: 0,
          isFitted: false,
          status: 'disponivel',
        },
      ],
      [driver2.id]: [
        {
          id: 'set_soft_05_bort',
          driverId: driver2.id,
          compound: 'macio',
          wear: 16, // Jogo com 84% restante (16% de desgaste)
          lapsUsed: 3,
          isFitted: true,
          status: 'usado',
        },
        {
          id: 'set_med_01_bort',
          driverId: driver2.id,
          compound: 'medio',
          wear: 0,
          lapsUsed: 0,
          isFitted: false,
          status: 'disponivel',
        },
        {
          id: 'set_hard_01_bort',
          driverId: driver2.id,
          compound: 'duro',
          wear: 0,
          lapsUsed: 0,
          isFitted: false,
          status: 'disponivel',
        },
      ],
    }
  }

  beforeEach(() => {
    localStorage.clear()
  })

  // BUG2-R01: jogador seleciona tyre set físico de largada -> set escolhido fica no estado pré-corrida.
  it('BUG2-R01: jogador seleciona tyre set físico de largada → set escolhido fica no estado pré-corrida', () => {
    const grid = buildCanonicalGrid()
    const inventories = buildMockInventories()

    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId,
      seasonYear,
      round,
      teamId,
      totalLaps,
      grid,
      inventories,
    })

    // Altera manualmente o pneu do Carro 1 para o set específico
    snapshot.cars[0].startingTyreSetId = 'set_hard_01_hulk'
    snapshot.cars[0].startingCompound = 'duro'
    snapshot.cars[0].initialTyreWear = 0
    snapshot.cars[0].initialTyreLapsUsed = 0

    canonicalRacePreparationService.saveSnapshot(snapshot)
    const reloaded = canonicalRacePreparationService.loadSnapshot(careerId, seasonYear, round)

    expect(reloaded).not.toBeNull()
    expect(reloaded?.cars[0].startingTyreSetId).toBe('set_hard_01_hulk')
    expect(reloaded?.cars[0].startingCompound).toBe('duro')
  })

  // BUG2-R02: set escolhido é exatamente o equipado na largada (tyreSetId + compound + desgaste correspondem).
  it('BUG2-R02: set escolhido é exatamente o equipado na largada (tyreSetId + compound + desgaste correspondem)', () => {
    const grid = buildCanonicalGrid()
    const targetTyreSetId = 'set_med_02_hulk'

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: seasonYear,
      round,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps,
      playerTeamId: teamId,
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: {
          startingTyreSetId: targetTyreSetId,
          startingCompound: 'medio',
          initialTyreWear: 8,
          initialTyreLapsUsed: 4,
          startingFuelKg: 96,
        },
      },
    })

    const car1State = raceState.drivers.find((d) => d.driverId === driver1.id)!
    expect(car1State.tyreSetId).toBe(targetTyreSetId)
    expect(car1State.tyreCompound).toBe('medio')
    expect(car1State.initialTyreWear).toBe(8)
    expect(car1State.initialTyreLapsUsed).toBe(4)
    expect(car1State.tyreAge).toBe(4)
  })

  // BUG2-R03: jogador seleciona fuel inicial -> valor permanece no estado.
  it('BUG2-R03: jogador seleciona fuel inicial → valor permanece no estado', () => {
    const grid = buildCanonicalGrid()
    const inventories = buildMockInventories()

    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId,
      seasonYear,
      round,
      teamId,
      totalLaps,
      grid,
      inventories,
    })

    snapshot.cars[0].startingFuelKg = 94
    snapshot.cars[1].startingFuelKg = 104
    canonicalRacePreparationService.saveSnapshot(snapshot)

    const reloaded = canonicalRacePreparationService.loadSnapshot(careerId, seasonYear, round)
    expect(reloaded?.cars[0].startingFuelKg).toBe(94)
    expect(reloaded?.cars[1].startingFuelKg).toBe(104)
  })

  // BUG2-R04: fuel escolhido chega ao Race Engine (97 kg selecionados -> 97 kg no carro na largada).
  it('BUG2-R04: fuel escolhido chega ao Race Engine (97 kg selecionados → 97 kg no carro na largada)', () => {
    const grid = buildCanonicalGrid()

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: seasonYear,
      round,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps,
      playerTeamId: teamId,
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: {
          startingFuelKg: 97,
        },
      },
    })

    const car1State = raceState.drivers.find((d) => d.driverId === driver1.id)!
    expect(car1State.fuel).toBe(97)
  })

  // BUG2-R05: Carro 1 e Carro 2 têm estratégias independentes; alterar Carro 1 não altera Carro 2.
  it('BUG2-R05: Carro 1 e Carro 2 têm estratégias independentes; alterar Carro 1 não altera Carro 2', () => {
    const grid = buildCanonicalGrid()
    const inventories = buildMockInventories()

    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId,
      seasonYear,
      round,
      teamId,
      totalLaps,
      grid,
      inventories,
    })

    // Altera Carro 1
    snapshot.cars[0].startingFuelKg = 92
    snapshot.cars[0].startingCompound = 'duro'
    snapshot.cars[0].strategyPlan.stints = [
      { stintNumber: 1, compound: 'duro', targetPitLap: 32 },
      { stintNumber: 2, compound: 'medio', targetPitLap: 57 },
    ]

    // Verifica que Carro 2 permanece inalterado
    expect(snapshot.cars[1].startingFuelKg).toBe(100)
    expect(snapshot.cars[1].startingCompound).not.toBe('duro')
    expect(snapshot.cars[1].strategyPlan.stints[0].targetPitLap).not.toBe(32)
  })

  // BUG2-R06: pit plan persiste antes da corrida (fechar painel/reload -> mesmo plano).
  it('BUG2-R06: pit plan persiste antes da corrida (fechar painel/reload → mesmo plano)', () => {
    const grid = buildCanonicalGrid()
    const inventories = buildMockInventories()

    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId,
      seasonYear,
      round,
      teamId,
      totalLaps,
      grid,
      inventories,
    })

    const customStints = [
      { stintNumber: 1, compound: 'medio' as const, targetPitLap: 28 },
      { stintNumber: 2, compound: 'duro' as const, targetPitLap: 57 },
    ]
    snapshot.cars[0].strategyPlan.stints = customStints
    canonicalRacePreparationService.saveSnapshot(snapshot)

    // Simula reload da página
    const reloaded = canonicalRacePreparationService.loadSnapshot(careerId, seasonYear, round)
    expect(reloaded?.cars[0].strategyPlan.stints).toEqual(customStints)
  })

  // BUG2-R07: pit plan pode ser alterado durante a corrida via sistema live existente, sem corromper o estado inicial.
  it('BUG2-R07: pit plan pode ser alterado durante a corrida via sistema live existente, sem corromper o estado inicial', () => {
    const grid = buildCanonicalGrid()

    const initialRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: seasonYear,
      round,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps,
      playerTeamId: teamId,
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: {
          startingCompound: 'medio',
          startingFuelKg: 95,
          strategyPlan: {
            carId: 'car1',
            stints: [
              { stintNumber: 1, compound: 'medio', targetPitLap: 25 },
              { stintNumber: 2, compound: 'duro', targetPitLap: 57 },
            ],
          },
        },
      },
    })

    // Altera composto alvo durante a corrida via raceStrategyService (live cockpit)
    const modifiedLive = raceStrategyService.setDriverTargetCompound(
      initialRace,
      driver1.id,
      'macio',
    )
    expect(modifiedLive.driverStrategies?.[driver1.id].targetCompound).toBe('macio')

    // O startingCompound da largada permanece 'medio'
    const car1InLive = modifiedLive.drivers.find((d) => d.driverId === driver1.id)!
    expect(car1InLive.tyreCompound).toBe('medio')
  })

  // BUG2-R08: save/reload preserva starting state, fuel atual, pneu atual e estratégia — starting state não é recriado.
  it('BUG2-R08: save/reload preserva starting state, fuel atual, pneu atual e estratégia — starting state não é recriado', () => {
    const grid = buildCanonicalGrid()

    const initialRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: seasonYear,
      round,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps,
      playerTeamId: teamId,
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: {
          startingTyreSetId: 'set_med_custom_01',
          startingCompound: 'medio',
          startingFuelKg: 98,
        },
        car2: {
          startingTyreSetId: 'set_soft_custom_02',
          startingCompound: 'macio',
          startingFuelKg: 105,
        },
      },
    })

    // Salva estado da corrida
    canonicalRaceSaveService.saveCanonicalRaceState(initialRace)

    // Recarrega
    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(careerId, seasonYear, round)
    expect(loaded.state).not.toBeNull()

    const car1Reloaded = loaded.state?.drivers.find((d) => d.driverId === driver1.id)!
    const car2Reloaded = loaded.state?.drivers.find((d) => d.driverId === driver2.id)!

    expect(car1Reloaded.fuel).toBe(98)
    expect(car1Reloaded.tyreSetId).toBe('set_med_custom_01')
    expect(car1Reloaded.tyreCompound).toBe('medio')

    expect(car2Reloaded.fuel).toBe(105)
    expect(car2Reloaded.tyreSetId).toBe('set_soft_custom_02')
    expect(car2Reloaded.tyreCompound).toBe('macio')
  })

  // BUG2-R09: set usado preserva desgaste real (Soft #3 82% restante = 18% wear -> larga com 18%, não 100%).
  it('BUG2-R09: set usado preserva desgaste real (Soft #3 com 18% wear → larga com 18%, não 0%)', () => {
    const grid = buildCanonicalGrid()

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: seasonYear,
      round,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps,
      playerTeamId: teamId,
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: {
          startingTyreSetId: 'set_soft_03_used',
          startingCompound: 'macio',
          initialTyreWear: 18,
          initialTyreLapsUsed: 5,
        },
      },
    })

    const car1 = raceState.drivers.find((d) => d.driverId === driver1.id)!
    expect(car1.initialTyreWear).toBe(18)
    expect(car1.initialTyreLapsUsed).toBe(5)
    expect(car1.tyreAge).toBe(5)
  })

  // BUG2-R10: gridPosition permanece o do BUG-04 (P23 -> mostra P23, BUG-04 intacto).
  it('BUG2-R10: gridPosition permanece estritamente o do BUG-04 (P23 e P24 intactos)', () => {
    const grid = buildCanonicalGrid()

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: seasonYear,
      round,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps,
      playerTeamId: teamId,
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: { startingFuelKg: 95 },
        car2: { startingFuelKg: 95 },
      },
    })

    const car1 = raceState.drivers.find((d) => d.driverId === driver1.id)!
    const car2 = raceState.drivers.find((d) => d.driverId === driver2.id)!

    expect(car1.gridPosition).toBe(23)
    expect(car1.currentPosition).toBe(23)
    expect(car2.gridPosition).toBe(24)
    expect(car2.currentPosition).toBe(24)
  })

  // BUG2-R11: default não sobrescreve preparação explícita.
  it('BUG2-R11: default não sobrescreve preparação explícita de combustível ou composto', () => {
    const grid = buildCanonicalGrid()

    // O default da inicialização antiga era 100 kg e pneu do qualy
    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: seasonYear,
      round,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps,
      playerTeamId: teamId,
      canonicalQualifyingGrid: grid,
      initialFuelKg: 100, // default geral
      carPreparations: {
        car1: {
          startingFuelKg: 85, // explícito do jogador
          startingCompound: 'duro',
        },
      },
    })

    const car1 = raceState.drivers.find((d) => d.driverId === driver1.id)!
    expect(car1.fuel).toBe(85) // Deve ser 85, não 100!
    expect(car1.tyreCompound).toBe('duro') // Deve ser duro, não o do qualy!
  })

  // BUG2-R12: não inicia corrida com preparação inválida.
  it('BUG2-R12: não inicia corrida com preparação inválida (fuel fora do range ou tyre set inexistente)', () => {
    const inventories = buildMockInventories()
    const inv1 = inventories[driver1.id]

    // Combustível 0 kg
    const checkFuelZero = canonicalRacePreparationService.validateStartingFuel(0)
    expect(checkFuelZero.valid).toBe(false)
    expect(checkFuelZero.error).toContain('Combustível insuficiente')

    // Combustível 120 kg
    const checkFuelHigh = canonicalRacePreparationService.validateStartingFuel(120)
    expect(checkFuelHigh.valid).toBe(false)
    expect(checkFuelHigh.error).toContain('excede capacidade')

    // Carro com tyreSet inexistente
    const invalidCarState = {
      carId: 'car1' as const,
      carNumber: 1,
      driverId: driver1.id,
      driverName: driver1.name,
      gridPosition: 23,
      startingTyreSetId: 'set_fantasma_inexistente',
      startingCompound: 'macio' as const,
      initialTyreWear: 0,
      initialTyreLapsUsed: 0,
      startingFuelKg: 100,
      strategyPlan: {
        carId: 'car1' as const,
        stints: [{ stintNumber: 1, compound: 'macio' as const, targetPitLap: 20 }],
      },
      confirmed: true,
    }

    const carVal = canonicalRacePreparationService.validateCarPreparation(
      invalidCarState,
      totalLaps,
      inv1,
    )
    expect(carVal.valid).toBe(false)
    expect(carVal.errors.some((e) => e.includes('não existe no inventário'))).toBe(true)
  })

  // GOLDEN TEST COMMIT C
  it('GOLDEN TEST DO COMMIT C: Qualificação final Carro 1 P23, Carro 2 P24 -> Pré-corrida Carro 1 Medium #2 96 kg 1 stop, Carro 2 Soft #5 102 kg 2 stops -> Salvar e Reload preservam', () => {
    const grid = buildCanonicalGrid()
    const inventories = buildMockInventories()

    // 1. Grid oficial
    const qCar1 = grid.find((e) => e.driverId === driver1.id)!
    const qCar2 = grid.find((e) => e.driverId === driver2.id)!
    expect(qCar1.gridPosition).toBe(23)
    expect(qCar2.gridPosition).toBe(24)

    // 2. Preparação pré-corrida dos 2 carros
    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId,
      seasonYear,
      round,
      teamId,
      totalLaps,
      grid,
      inventories,
    })

    // Configura Carro 1: Medium #2, 96 kg, 1 stop (Medium -> Hard na volta 28)
    snapshot.cars[0].startingTyreSetId = 'set_med_02_hulk'
    snapshot.cars[0].startingCompound = 'medio'
    snapshot.cars[0].initialTyreWear = 8
    snapshot.cars[0].initialTyreLapsUsed = 4
    snapshot.cars[0].startingFuelKg = 96
    snapshot.cars[0].strategyPlan = {
      carId: 'car1',
      stints: [
        { stintNumber: 1, compound: 'medio', targetPitLap: 28 },
        { stintNumber: 2, compound: 'duro', targetPitLap: 57 },
      ],
    }
    snapshot.cars[0].confirmed = true

    // Configura Carro 2: Soft #5, 102 kg, 2 stops (Soft -> Medium -> Hard nas voltas 18/42)
    snapshot.cars[1].startingTyreSetId = 'set_soft_05_bort'
    snapshot.cars[1].startingCompound = 'macio'
    snapshot.cars[1].initialTyreWear = 16
    snapshot.cars[1].initialTyreLapsUsed = 3
    snapshot.cars[1].startingFuelKg = 102
    snapshot.cars[1].strategyPlan = {
      carId: 'car2',
      stints: [
        { stintNumber: 1, compound: 'macio', targetPitLap: 18 },
        { stintNumber: 2, compound: 'medio', targetPitLap: 42 },
        { stintNumber: 3, compound: 'duro', targetPitLap: 57 },
      ],
    }
    snapshot.cars[1].confirmed = true

    // Salva snapshot race-prep-v1
    canonicalRacePreparationService.saveSnapshot(snapshot)

    // 3. Inicializa Race Engine consumindo a preparação explícita
    const carPreparations = {
      car1: {
        startingTyreSetId: snapshot.cars[0].startingTyreSetId,
        startingCompound: snapshot.cars[0].startingCompound,
        startingFuelKg: snapshot.cars[0].startingFuelKg,
        initialTyreWear: snapshot.cars[0].initialTyreWear,
        initialTyreLapsUsed: snapshot.cars[0].initialTyreLapsUsed,
        strategyPlan: snapshot.cars[0].strategyPlan,
      },
      car2: {
        startingTyreSetId: snapshot.cars[1].startingTyreSetId,
        startingCompound: snapshot.cars[1].startingCompound,
        startingFuelKg: snapshot.cars[1].startingFuelKg,
        initialTyreWear: snapshot.cars[1].initialTyreWear,
        initialTyreLapsUsed: snapshot.cars[1].initialTyreLapsUsed,
        strategyPlan: snapshot.cars[1].strategyPlan,
      },
    }

    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: seasonYear,
      round,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps,
      playerTeamId: teamId,
      canonicalQualifyingGrid: grid,
      carPreparations,
    })

    // Validações da largada
    const rCar1 = raceState.drivers.find((d) => d.driverId === driver1.id)!
    const rCar2 = raceState.drivers.find((d) => d.driverId === driver2.id)!

    expect(rCar1.gridPosition).toBe(23)
    expect(rCar1.tyreSetId).toBe('set_med_02_hulk')
    expect(rCar1.tyreCompound).toBe('medio')
    expect(rCar1.fuel).toBe(96)
    expect(rCar1.initialTyreWear).toBe(8)
    expect(rCar1.tyreAge).toBe(4)

    expect(rCar2.gridPosition).toBe(24)
    expect(rCar2.tyreSetId).toBe('set_soft_05_bort')
    expect(rCar2.tyreCompound).toBe('macio')
    expect(rCar2.fuel).toBe(102)
    expect(rCar2.initialTyreWear).toBe(16)
    expect(rCar2.tyreAge).toBe(3)

    // 4. Salvar corrida e recarregar (save/reload)
    canonicalRaceSaveService.saveCanonicalRaceState(raceState)
    const loadedRace = canonicalRaceSaveService.loadCanonicalRaceState(careerId, seasonYear, round)
    expect(loadedRace.state).not.toBeNull()

    const lCar1 = loadedRace.state?.drivers.find((d) => d.driverId === driver1.id)!
    const lCar2 = loadedRace.state?.drivers.find((d) => d.driverId === driver2.id)!

    expect(lCar1.gridPosition).toBe(23)
    expect(lCar1.tyreSetId).toBe('set_med_02_hulk')
    expect(lCar1.fuel).toBe(96)

    expect(lCar2.gridPosition).toBe(24)
    expect(lCar2.tyreSetId).toBe('set_soft_05_bort')
    expect(lCar2.fuel).toBe(102)
  })
})
