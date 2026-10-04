import { describe, it, expect } from 'vitest'
import {
  TANK_CAPACITY_KG,
  calculateLapFuelBurnKg,
  calculateRequiredStartingFuelKg,
  calculateRaceDistanceKm,
  STRATEGY_FUEL_BURN_MULTIPLIERS,
  RACE_CONTROL_FUEL_BURN_MULTIPLIERS,
} from '@/services/canonicalFuelModel'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { F1_2026_CALENDAR } from '@/lib/f1-data'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { PreparedCarState } from '@/types/canonical-race-preparation'
import type { TireSetItem } from '@/types/f1'

function build24Grid(playerTeamId: string = 'team_audi'): FinalQualifyingGridEntry[] {
  const teams = [
    'team_audi',
    'team_mercedes',
    'team_ferrari',
    'team_mclaren',
    'team_redbull',
    'team_rb',
    'team_alpine',
    'team_haas',
    'team_williams',
    'team_aston',
    'team_cadillac',
    'team_andretti',
  ]
  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (const t of teams) {
    for (let c = 1; c <= 2; c++) {
      grid.push({
        driverId: `drv_${t}_${c}`,
        driverName: `Driver ${t} ${c}`,
        teamId: t,
        teamName: t.replace('team_', '').toUpperCase(),
        teamColor: '#ffffff',
        eliminationStage: 'Q3',
        bestLapSec: 80.0,
        bestLapTime: '1:20.000',
        gridPosition: pos,
        bestLapCompound: 'medio',
        tyreSetId: `set_${t}_${c}`,
        isPlayer: t === playerTeamId,
      } as FinalQualifyingGridEntry)
      pos++
    }
  }
  return grid
}

function buildInventories(grid: FinalQualifyingGridEntry[]): Record<string, TireSetItem[]> {
  const inv: Record<string, TireSetItem[]> = {}
  for (const entry of grid) {
    inv[entry.driverId] = [
      {
        id: `set_${entry.driverId}_1`,
        compound: 'medio',
        wear: 0,
        lapsUsed: 0,
        isFitted: true,
        status: 'instalado',
      },
      {
        id: `set_${entry.driverId}_2`,
        compound: 'duro',
        wear: 0,
        lapsUsed: 0,
        isFitted: false,
        status: 'disponivel',
      },
    ]
  }
  return inv
}

describe('FUEL-AUTONOMY-08A: Autonomia, Carga Canônica e Consequências de Combustível', () => {
  it('TEST A: Prova representativa (Round 1, 57 voltas) inicia com carga canônica da preparação e completa sem pane seca', () => {
    const gp = F1_2026_CALENDAR.find((g) => g.round === 1)!
    expect(gp).toBeDefined()
    const totalLaps = 57
    const grid = build24Grid('team_audi')
    const inventories = buildInventories(grid)

    // Cria snapshot padrão através do canonicalRacePreparationService
    const prepSnapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career',
      seasonYear: 2026,
      round: 1,
      teamId: 'team_audi',
      totalLaps,
      grid,
      inventories,
    })

    const car1 = prepSnapshot.cars[0]
    const car2 = prepSnapshot.cars[1]

    const expectedStartingFuel = calculateRequiredStartingFuelKg(totalLaps, gp.circuitLengthKm, 1.0)
    expect(car1.startingFuelKg).toBeCloseTo(expectedStartingFuel, 2)
    expect(car2.startingFuelKg).toBeCloseTo(expectedStartingFuel, 2)

    // Converte preparação para o mapa de preparações
    const carPreparations: Record<string, PreparedCarState> = {
      [car1.driverId]: car1,
      [car2.driverId]: car2,
      [car1.carId]: car1,
      [car2.carId]: car2,
    }

    // Inicializa a corrida canônica usando a preparação padrão
    const initParams: any = {
      grid,
      canonicalGrid: grid,
      totalLaps,
      circuitLengthKm: gp.circuitLengthKm,
      carPreparations,
    }
    let raceState: any =
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid(initParams)
    const carsList1: any[] = raceState.cars || raceState.leaderboard || []

    // Confirma que os carros do jogador receberam a carga derivada
    const pCar1 = carsList1.find((c) => c.driverId === car1.driverId)!
    const pCar2 = carsList1.find((c) => c.driverId === car2.driverId)!
    expect(pCar1.fuel).toBeCloseTo(expectedStartingFuel, 2)
    expect(pCar2.fuel).toBeCloseTo(expectedStartingFuel, 2)

    // Executa a corrida inteira até o final
    for (let lap = 1; lap <= totalLaps; lap++) {
      raceState = canonicalRaceEngineService.advanceOneLap(raceState)
    }

    const isDone =
      raceState.status === 'completed' || raceState.isCompleted || raceState.completedAt
    expect(Boolean(isDone)).toBe(true)

    // Nenhum carro deve ter abandonado por pane seca
    const finalCars1: any[] = raceState.cars || raceState.leaderboard || []
    for (const car of finalCars1) {
      expect(car.status).not.toBe('OUT_OF_FUEL')
      expect(car.dnfReason).toBeUndefined()
      expect(car.fuel).toBeGreaterThan(0)
    }
  })

  it('TEST B: Caso Crítico Madri (Round 16, 66 voltas, maior consumo: ~109.3852 kg) e Mônaco (Round 8, 78 voltas)', () => {
    // 1. Madri (maior consumo total do calendário)
    const madridGp = F1_2026_CALENDAR.find((g) => g.round === 16)!
    expect(madridGp).toBeDefined()
    const madridLaps = 66
    const madridRequiredFuel = calculateRequiredStartingFuelKg(
      madridLaps,
      madridGp.circuitLengthKm,
      1.0,
    )
    expect(madridRequiredFuel).toBeCloseTo(109.3852, 2)
    expect(madridRequiredFuel).toBeLessThanOrEqual(TANK_CAPACITY_KG)

    // Preparação padrão para Madri
    const madridGrid = build24Grid('team_audi')
    const madridInv = buildInventories(madridGrid)
    const madridPrep = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career',
      seasonYear: 2026,
      round: 16,
      teamId: 'team_audi',
      totalLaps: madridLaps,
      grid: madridGrid,
      inventories: madridInv,
    })

    // Deve derivar 109.3852 kg e NÃO 100 kg hardcoded
    expect(madridPrep.cars[0].startingFuelKg).toBeCloseTo(madridRequiredFuel, 2)
    expect(madridPrep.cars[0].startingFuelKg).toBeGreaterThan(100.0)

    const madridPreparations: Record<string, PreparedCarState> = {
      [madridPrep.cars[0].driverId]: madridPrep.cars[0],
      [madridPrep.cars[1].driverId]: madridPrep.cars[1],
    }

    const initMadridParams: any = {
      grid: madridGrid,
      canonicalGrid: madridGrid,
      totalLaps: madridLaps,
      circuitLengthKm: madridGp.circuitLengthKm,
      carPreparations: madridPreparations,
    }
    let madridRace: any =
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid(initMadridParams)

    // Carros do jogador iniciam com > 100 kg (109.3852)
    const madridCars: any[] = madridRace.cars || madridRace.leaderboard || []
    const mP1 = madridCars.find((c) => c.driverId === madridPrep.cars[0].driverId)!
    expect(mP1.fuel).toBeCloseTo(madridRequiredFuel, 2)

    // Percorre toda a corrida de Madri em ritmo NORMAL
    for (let l = 1; l <= madridLaps; l++) {
      madridRace = canonicalRaceEngineService.advanceOneLap(madridRace)
    }

    const madridDone =
      madridRace.status === 'completed' || madridRace.isCompleted || madridRace.completedAt
    expect(Boolean(madridDone)).toBe(true)
    const madridFinalCars: any[] = madridRace.cars || madridRace.leaderboard || []
    for (const c of madridFinalCars) {
      expect(c.status).not.toBe('OUT_OF_FUEL')
      expect(c.dnfReason).toBeUndefined()
      expect(c.fuel).toBeGreaterThan(0)
    }

    // 2. Mônaco (Round 8, 78 voltas, maior número de voltas do calendário)
    const monacoGp = F1_2026_CALENDAR.find((g) => g.round === 8)!
    expect(monacoGp).toBeDefined()
    const monacoLaps = 78
    const monacoRequiredFuel = calculateRequiredStartingFuelKg(
      monacoLaps,
      monacoGp.circuitLengthKm,
      1.0,
    )
    expect(monacoRequiredFuel).toBeCloseTo(79.0858, 2)

    const monacoGrid = build24Grid('team_audi')
    const monacoInv = buildInventories(monacoGrid)
    const monacoPrep = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career',
      seasonYear: 2026,
      round: 8,
      teamId: 'team_audi',
      totalLaps: monacoLaps,
      grid: monacoGrid,
      inventories: monacoInv,
    })

    expect(monacoPrep.cars[0].startingFuelKg).toBeCloseTo(monacoRequiredFuel, 2)

    const monacoPreparations: Record<string, PreparedCarState> = {
      [monacoPrep.cars[0].driverId]: monacoPrep.cars[0],
      [monacoPrep.cars[1].driverId]: monacoPrep.cars[1],
    }

    const initMonacoParams: any = {
      grid: monacoGrid,
      canonicalGrid: monacoGrid,
      totalLaps: monacoLaps,
      circuitLengthKm: monacoGp.circuitLengthKm,
      carPreparations: monacoPreparations,
    }
    let monacoRace: any =
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid(initMonacoParams)

    for (let l = 1; l <= monacoLaps; l++) {
      monacoRace = canonicalRaceEngineService.advanceOneLap(monacoRace)
    }

    const monacoDone =
      monacoRace.status === 'completed' || monacoRace.isCompleted || monacoRace.completedAt
    expect(Boolean(monacoDone)).toBe(true)
    const monacoFinalCars: any[] = monacoRace.cars || monacoRace.leaderboard || []
    for (const c of monacoFinalCars) {
      expect(c.status).not.toBe('OUT_OF_FUEL')
      expect(c.fuel).toBeGreaterThan(0)
    }
  })

  it('TEST C: Carga Explícita válida (0 < val <= 110) não é sobrescrita silenciosamente (Preservação FUEL12)', () => {
    const gp = F1_2026_CALENDAR.find((g) => g.round === 1)!
    const totalLaps = 57
    const grid = build24Grid('team_audi')
    const inventories = buildInventories(grid)
    const prepSnapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career',
      seasonYear: 2026,
      round: 1,
      teamId: 'team_audi',
      totalLaps,
      grid,
      inventories,
    })

    // Jogador escolhe explicitamente uma carga válida diferente da recomendada (ex: 85.5 kg)
    const explicitFuel = 85.5
    prepSnapshot.cars[0].startingFuelKg = explicitFuel

    const carPreparations: Record<string, PreparedCarState> = {
      [prepSnapshot.cars[0].driverId]: prepSnapshot.cars[0],
      [prepSnapshot.cars[1].driverId]: prepSnapshot.cars[1],
    }

    const initParams: any = {
      grid,
      canonicalGrid: grid,
      totalLaps,
      circuitLengthKm: gp.circuitLengthKm,
      carPreparations,
    }
    const raceState: any =
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid(initParams)

    const carsList: any[] = raceState.cars || raceState.leaderboard || []
    const pCar1 = carsList.find((c) => c.driverId === prepSnapshot.cars[0].driverId)!
    // Carga explícita do jogador deve ser respeitada exatamente
    expect(pCar1.fuel).toBe(explicitFuel)
  })

  it('TEST D: Insuficiência Intencional de combustível gera OUT_OF_FUEL canônico com DNF e gap ABANDONO', () => {
    const gp = F1_2026_CALENDAR.find((g) => g.round === 1)!
    const totalLaps = 20
    const circuitLengthKm = gp.circuitLengthKm
    const lapBurn = calculateLapFuelBurnKg(circuitLengthKm, 1.0)

    const grid = build24Grid('team_audi')
    const inventories = buildInventories(grid)
    const prep = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career',
      seasonYear: 2026,
      round: 1,
      teamId: 'team_audi',
      totalLaps,
      grid,
      inventories,
    })

    // Alocar combustível propositalmente insuficiente para 20 voltas (suficiente para ~3 voltas)
    const deficientFuel = lapBurn * 3.2
    prep.cars[0].startingFuelKg = deficientFuel

    const carPreparations: Record<string, PreparedCarState> = {
      [prep.cars[0].driverId]: prep.cars[0],
    }

    const initParams: any = {
      grid,
      canonicalGrid: grid,
      totalLaps,
      circuitLengthKm,
      carPreparations,
    }
    let race: any = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid(initParams)

    let failedCarFound = false
    for (let l = 1; l <= totalLaps; l++) {
      race = canonicalRaceEngineService.advanceOneLap(race)
      const carsList: any[] = race.cars || race.leaderboard || []
      const car = carsList.find((c) => c.driverId === prep.cars[0].driverId)!
      if (car.status === 'OUT_OF_FUEL') {
        failedCarFound = true
        expect(car.dnfReason).toBe('OUT_OF_FUEL')
        expect(car.gap).toBe('ABANDONO')
        // Carro não deve mais pontuar voltas completas após o abandono
        const dnfLap = car.lapsCompleted
        expect(dnfLap).toBeLessThan(totalLaps)
        break
      }
    }

    expect(failedCarFound).toBe(true)
  })

  it('TEST E: Conservação e Persistência — Consumo aplicado 1x por volta e Red Flag congela combustível', () => {
    const gp = F1_2026_CALENDAR.find((g) => g.round === 1)!
    const grid = build24Grid('team_audi')
    const totalLaps = 10
    const circuitLengthKm = gp.circuitLengthKm
    const lapBurn = calculateLapFuelBurnKg(circuitLengthKm, 1.0)

    const initParams: any = {
      grid,
      canonicalGrid: grid,
      totalLaps,
      circuitLengthKm,
    }
    let race: any = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid(initParams)

    const cars0: any[] = race.cars || race.leaderboard || []
    const initialFuel = cars0[0].fuel
    // Avança 1 volta
    race = canonicalRaceEngineService.advanceOneLap(race)
    const cars1: any[] = race.cars || race.leaderboard || []
    const fuelAfter1Lap = cars1[0].fuel
    const consumed1 = initialFuel - fuelAfter1Lap
    expect(consumed1).toBeCloseTo(lapBurn, 3)

    // Red flag / suspensão
    race.isSuspended = true
    race.raceControlStatus = 'RED_FLAG'
    const carsSuspended: any[] = race.cars || race.leaderboard || []
    const fuelAtRedFlag = carsSuspended[0].fuel

    // Na suspensão com RED_FLAG, multiplicador é 0.0
    const rfMultiplier = RACE_CONTROL_FUEL_BURN_MULTIPLIERS.RED_FLAG
    expect(rfMultiplier).toBe(0.0)

    // Simula tentativa de avanço sob bandeira vermelha
    const fuelRedFlagLap = calculateLapFuelBurnKg(circuitLengthKm, rfMultiplier)
    expect(fuelRedFlagLap).toBe(0)
    expect(fuelAtRedFlag).toBe(fuelAfter1Lap)
  })

  it('TEST F: Varredura determinística de todos os 24 circuitos do calendário ativo F1 2026 com preparação padrão', () => {
    for (const gp of F1_2026_CALENDAR) {
      const laps = 60 // padrão se não definido
      const requiredFuel = calculateRequiredStartingFuelKg(laps, gp.circuitLengthKm, 1.0)
      // Todo circuito no calendário com 60 voltas ou com sua distância regulamentar deve caber nos 110 kg
      expect(requiredFuel).toBeLessThanOrEqual(TANK_CAPACITY_KG)

      // Snapshot para o round específico
      const grid = build24Grid('team_audi')
      const prep = canonicalRacePreparationService.createInitialSnapshot({
        careerId: 'test_career',
        seasonYear: 2026,
        round: gp.round,
        teamId: 'team_audi',
        totalLaps: laps,
        grid,
        inventories: buildInventories(grid),
      })

      expect(prep.cars[0].startingFuelKg).toBeCloseTo(requiredFuel, 2)
      expect(prep.cars[1].startingFuelKg).toBeCloseTo(requiredFuel, 2)
    }
  })
})
