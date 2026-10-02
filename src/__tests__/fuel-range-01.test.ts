import { describe, it, expect, beforeEach } from 'vitest'
import { F1_2026_CALENDAR } from '../lib/f1-data'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'
import { PracticeSessionRunner } from '../services/canonicalPracticeRunner'
import { validateCarPreparation } from '../services/practicePreparationService'
import { canonicalRacePreparationService } from '../services/canonicalRacePreparationService'
import { canonicalRaceInitializationService } from '../services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '../services/canonicalRaceSaveService'
import {
  TANK_CAPACITY_KG,
  BASE_FUEL_BURN_KG_PER_KM,
  START_FUEL_RESERVE_KG,
  calculateLapFuelBurnKg,
  calculateRaceDistanceKm,
  calculateRequiredStartingFuelKg,
} from '../services/canonicalFuelModel'
import { CANONICAL_DNF_REASON_OUT_OF_FUEL } from '../types/canonical-race-v2'
import type { CanonicalRaceState } from '../types/canonical-race-v2'
import type { FinalQualifyingGridEntry } from '../types/canonical-qualifying-types'

function createTestGrid(): FinalQualifyingGridEntry[] {
  const teams = [
    'team_audi',
    'team_ferrari',
    'team_mercedes',
    'team_mclaren',
    'team_redbull',
    'team_aston_martin',
    'team_alpine',
    'team_williams',
    'team_racing_bulls',
    'team_sauber',
    'team_haas',
    'team_cadillac',
  ]
  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (const teamId of teams) {
    for (let carIdx = 1; carIdx <= 2; carIdx++) {
      const isPlayer = teamId === 'team_audi'
      const driverId = `drv_${teamId}_${carIdx}`
      grid.push({
        gridPosition: pos,
        driverId,
        driverName: `Driver ${pos}`,
        teamId,
        teamName: `Team ${teamId}`,
        teamColor: '#ff0000',
        carId: isPlayer ? (carIdx === 1 ? 'car1' : 'car2') : undefined,
        isPlayer,
        eliminationStage: 'Q3',
        bestLapSec: 80.0,
        bestLapTime: '1:20.000',
        bestLapCompound: 'medio',
      })
      pos++
    }
  }
  return grid
}

function createMinimalMockRace(overrides: Partial<CanonicalRaceState> = {}): CanonicalRaceState {
  const grid = createTestGrid()
  const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId: 'career_fuel_test',
    season: 2026,
    round: overrides.round ?? 1,
    circuitName: overrides.circuitName ?? 'Circuito de Albert Park, Melbourne',
    circuitCountry: overrides.circuitCountry ?? 'Austrália',
    totalLaps: overrides.totalLaps ?? 58,
    playerTeamId: 'team_audi',
    canonicalQualifyingGrid: grid,
    persistState: false,
  })
  return {
    ...state,
    ...overrides,
  }
}

describe('FUEL-01B — Normalized Race Fuel Model by Distance', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // FUEL01 — RACE DISTANCE DERIVATION: laps × circuitLengthKm derives total race distance
  it('FUEL01 — RACE DISTANCE SOURCE: laps × circuitLengthKm derives total race distance in F1_2026_CALENDAR', () => {
    expect(F1_2026_CALENDAR.length).toBe(24)

    const monaco = F1_2026_CALENDAR.find((gp) => gp.round === 8 || gp.circuit.includes('Mônaco'))!
    const spa = F1_2026_CALENDAR.find((gp) => gp.round === 12 || gp.circuit.includes('Spa'))!

    expect(monaco).toBeDefined()
    expect(spa).toBeDefined()

    const monacoDistanceKm = calculateRaceDistanceKm(monaco.laps, monaco.circuitLengthKm)
    const spaDistanceKm = calculateRaceDistanceKm(spa.laps, spa.circuitLengthKm)

    expect(monacoDistanceKm).toBeCloseTo(78 * 3.337, 2)
    expect(spaDistanceKm).toBeCloseTo(44 * 7.004, 2)
    expect(monacoDistanceKm).not.toBe(spaDistanceKm)
  })

  // FUEL02 — NORMAL BURN PER DISTANCE: calculateLapFuelBurnKg = circuitLengthKm × 0.30 × multiplier
  it('FUEL02 — NORMAL BURN PER DISTANCE: consumes circuitLengthKm × 0.30 per lap under green flag and NORMAL pace', () => {
    // Monaco: 3.337 km -> 3.337 * 0.30 * 1.0 = 1.0011 kg/lap
    const monacoBurn = calculateLapFuelBurnKg(3.337, 1.0)
    expect(monacoBurn).toBeCloseTo(1.0011, 4)

    // Spa: 7.004 km -> 7.004 * 0.30 * 1.0 = 2.1012 kg/lap
    const spaBurn = calculateLapFuelBurnKg(7.004, 1.0)
    expect(spaBurn).toBeCloseTo(2.1012, 4)

    // Spa > Monaco intencional (pista maior consome mais por volta)
    expect(spaBurn).toBeGreaterThan(monacoBurn)

    // Provar no engine real para GP de Albert Park (5.278 km -> 5.278 * 0.3 = 1.5834 kg/lap)
    const raceState = createMinimalMockRace({
      round: 1,
      circuitName: 'Circuito de Albert Park, Melbourne',
      circuitCountry: 'Austrália',
      totalLaps: 58,
    })
    const p1Driver = raceState.drivers[0]
    expect(p1Driver.strategy?.paceMode).toBe('NORMAL')
    const initialFuel = p1Driver.fuel

    const nextState = canonicalRaceEngineService.advanceOneLap(raceState, {
      persistState: false,
    })
    const updatedDriver = nextState.drivers.find((d) => d.driverId === p1Driver.driverId)!
    const consumed = Number((initialFuel - updatedDriver.fuel).toFixed(2))

    // 5.278 * 0.30 = 1.5834 kg/lap -> arredondamento de fuelBurnEffective = 1.58 kg
    expect(consumed).toBeCloseTo(1.58, 1)
  })

  // FUEL03 — CURRENT TANK BOUNDS: centralização em TANK_CAPACITY_KG = 110
  it('FUEL03 — CURRENT TANK BOUNDS: TANK_CAPACITY_KG is 110, clamps at 110 kg and rejects > 110 kg', () => {
    expect(TANK_CAPACITY_KG).toBe(110)
    expect(BASE_FUEL_BURN_KG_PER_KM).toBe(0.3)
    expect(START_FUEL_RESERVE_KG).toBe(1.0)

    // 1. PracticeSessionRunner.refuelCarInGarage clamps up to TANK_CAPACITY_KG
    const practiceState: any = {
      cars: {
        car1: {
          status: 'garage',
          fuelKg: 20,
        },
      },
    }
    const refuelSuccess = PracticeSessionRunner.refuelCarInGarage(practiceState, 'car1', 150)
    expect(refuelSuccess).toBe(true)
    expect(practiceState.cars.car1.fuelKg).toBe(TANK_CAPACITY_KG)

    // 2. practicePreparationService validateCarPreparation rejects > 110 kg
    const invalidPrepCar: any = {
      driverId: 'drv_test',
      program: 'car_setup',
      tyreSelection: { setId: 'set_1', compound: 'medio' },
      fuelLoad: { kg: 120, estimatedLaps: 60 },
      setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
    }
    const valResult = validateCarPreparation(invalidPrepCar)
    expect(valResult.valid).toBe(false)
    expect(valResult.errors.fuel).toBeDefined()

    // 3. canonicalRacePreparationService.validateStartingFuel rejects > 110 kg
    const racePrepVal = canonicalRacePreparationService.validateStartingFuel(115)
    expect(racePrepVal.valid).toBe(false)
    expect(racePrepVal.error).toContain('110')
  })

  // FUEL04 — DEPLETION SAFETY: fuel never drops below zero and zero fuel triggers CANONICAL_DNF_REASON_OUT_OF_FUEL
  it('FUEL04 — DEPLETION SAFETY: fuel never drops below zero and zero fuel before finish triggers CANONICAL_DNF_REASON_OUT_OF_FUEL', () => {
    const state = createMinimalMockRace({ currentLap: 10, totalLaps: 50 })
    const targetDriverId = state.drivers[0].driverId
    state.drivers[0].fuel = 0.5 // menor que o burn da volta

    const nextState = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    const targetAfter = nextState.drivers.find((d) => d.driverId === targetDriverId)!

    expect(targetAfter.fuel).toBe(0)
    expect(targetAfter.isDnf).toBe(true)
    expect(targetAfter.raceStatus).toBe('dnf')
    expect(targetAfter.dnfReason).toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)
    expect(targetAfter.gap).toBe('ABANDONO')
  })

  // FUEL05 — RED FLAG ZERO BURN: under red flag / suspension no fuel is consumed
  it('FUEL05 — RED FLAG ZERO BURN: under red flag / suspension no fuel is consumed', () => {
    const runningState = createMinimalMockRace({ currentLap: 15 })
    const suspendedState = canonicalRaceEngineService.triggerRedFlag(runningState, {
      persistState: false,
    })

    expect(suspendedState.status).toBe('suspended')
    expect(suspendedState.redFlagActive).toBe(true)

    const fuelBefore = suspendedState.drivers[0].fuel
    const stateAfterTick = canonicalRaceEngineService.advanceOneLap(suspendedState, {
      persistState: false,
    })

    expect(stateAfterTick.drivers[0].fuel).toBe(fuelBefore)
  })

  // FUEL06 — AUTO STARTING FUEL & PERSISTENCE: auto calculated requiredFuel replaces legacy blind 100 kg
  it('FUEL06 — AUTO STARTING FUEL & PERSISTENCE: auto calculated requiredFuel replaces legacy default 100 kg', () => {
    // 1. Monaco (Round 8, 78 voltas, 3.337 km): required = 78 * 3.337 * 0.30 + 1.0 = 79.0858 kg
    const monacoRace = createMinimalMockRace({
      round: 8,
      circuitName: 'Circuito de Mônaco, Monte Carlo',
      circuitCountry: 'Mônaco',
      totalLaps: 78,
    })
    const expectedMonacoRequired = calculateRequiredStartingFuelKg(78, 3.337, 1.0)
    expect(expectedMonacoRequired).toBeCloseTo(79.0858, 3)

    for (const driver of monacoRace.drivers) {
      expect(driver.fuel).toBeCloseTo(expectedMonacoRequired, 3)
    }

    // 2. Persistência: simular alteração de fuel e garantir que save/reload preserva
    monacoRace.careerId = 'career_fuel_persist_test'
    monacoRace.season = 2026
    monacoRace.round = 8
    monacoRace.raceVariant = 'MAIN_RACE'
    monacoRace.drivers[0].fuel = 75.3
    monacoRace.drivers[1].fuel = 68.1

    const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(monacoRace)
    expect(saveRes.success).toBe(true)

    const reloaded = canonicalRaceSaveService.loadCanonicalRaceState(
      'career_fuel_persist_test',
      2026,
      8,
      'MAIN_RACE',
    )
    expect(reloaded.state).not.toBeNull()
    const d0 = reloaded.state!.drivers.find((d) => d.driverId === monacoRace.drivers[0].driverId)!
    const d1 = reloaded.state!.drivers.find((d) => d.driverId === monacoRace.drivers[1].driverId)!

    expect(d0.fuel).toBe(75.3)
    expect(d1.fuel).toBe(68.1)
  })

  // FUEL07 — CALENDAR MATRIX: 24/24 races have requiredFuelNormal <= 110 kg
  it('FUEL07 — CALENDAR MATRIX: all 24 races in F1_2026_CALENDAR have requiredFuelKg <= 110 kg under NORMAL strategy', () => {
    expect(F1_2026_CALENDAR.length).toBe(24)

    let maxRequired = 0
    let mostDemandingGp: any = null

    for (const gp of F1_2026_CALENDAR) {
      const requiredFuel = calculateRequiredStartingFuelKg(gp.laps, gp.circuitLengthKm, 1.0)
      expect(requiredFuel).toBeLessThanOrEqual(TANK_CAPACITY_KG)

      if (requiredFuel > maxRequired) {
        maxRequired = requiredFuel
        mostDemandingGp = gp
      }
    }

    // Provar cálculo de Mônaco: 78 laps * 3.337 km * 0.30 + 1.0 = ~79.0858 kg
    const monaco = F1_2026_CALENDAR.find((gp) => gp.round === 8)!
    const monacoRequired = calculateRequiredStartingFuelKg(monaco.laps, monaco.circuitLengthKm, 1.0)
    expect(monacoRequired).toBeCloseTo(79.0858, 3)
    expect(monacoRequired).toBeLessThanOrEqual(TANK_CAPACITY_KG)

    // Provar cálculo de Madri: 66 laps * 5.474 km * 0.30 + 1.0 = 109.3852 kg <= 110
    // Nota obrigatória do contrato: "calendar data remains independently suspect"
    const madrid = F1_2026_CALENDAR.find((gp) => gp.round === 16)!
    const madridRequired = calculateRequiredStartingFuelKg(madrid.laps, madrid.circuitLengthKm, 1.0)
    expect(madridRequired).toBeCloseTo(109.3852, 3)
    expect(madridRequired).toBeLessThanOrEqual(TANK_CAPACITY_KG)

    // A corrida mais exigente não deve exceder 110 kg
    expect(maxRequired).toBeLessThanOrEqual(110.0)
    expect(mostDemandingGp).toBeDefined()
  })

  // FUEL08 — PLAYER & AI PARITY: same calculator produces identical fuel for player and AI
  it('FUEL08 — PLAYER & AI PARITY: player and AI get identical auto starting fuel for same race', () => {
    const raceState = createMinimalMockRace({
      round: 3,
      circuitName: 'Circuito de Suzuka',
      circuitCountry: 'Japão',
      totalLaps: 53,
    })

    const playerDriver = raceState.drivers.find((d) => d.isPlayer)!
    const aiDriver = raceState.drivers.find((d) => !d.isPlayer)!

    expect(playerDriver).toBeDefined()
    expect(aiDriver).toBeDefined()

    const suzukaExpected = calculateRequiredStartingFuelKg(53, 5.807, 1.0)
    expect(playerDriver.fuel).toBe(suzukaExpected)
    expect(aiDriver.fuel).toBe(suzukaExpected)
    expect(playerDriver.fuel).toBe(aiDriver.fuel)
  })

  // FUEL09 — STRATEGY PACE MULTIPLIERS ORDER: ATTACK (1.15) > NORMAL (1.00) > ECONOMY (0.85)
  it('FUEL09 — STRATEGY PACE MULTIPLIERS ORDER: ATTACK > NORMAL > ECONOMY fuel consumption ordering', () => {
    const trackLength = 5.0
    const attackBurn = calculateLapFuelBurnKg(trackLength, 1.15)
    const normalBurn = calculateLapFuelBurnKg(trackLength, 1.0)
    const economyBurn = calculateLapFuelBurnKg(trackLength, 0.85)

    expect(attackBurn).toBeGreaterThan(normalBurn)
    expect(normalBurn).toBeGreaterThan(economyBurn)
    expect(attackBurn).toBeCloseTo(5.0 * 0.3 * 1.15, 4)
    expect(normalBurn).toBeCloseTo(5.0 * 0.3 * 1.0, 4)
    expect(economyBurn).toBeCloseTo(5.0 * 0.3 * 0.85, 4)
  })

  // FUEL10 — INTEGRATION: Monaco is fully completable in NORMAL pace without refueling
  it('FUEL10 — INTEGRATION: Monaco is completable in NORMAL pace without running out of fuel', () => {
    // Inicializar Monaco com suas 78 voltas oficiais
    let race = createMinimalMockRace({
      round: 8,
      circuitName: 'Circuito de Mônaco, Monte Carlo',
      circuitCountry: 'Mônaco',
      totalLaps: 78,
    })

    const initialFuel = race.drivers[0].fuel
    expect(initialFuel).toBeCloseTo(79.0858, 3)

    // Avançar as 78 voltas
    for (let lap = 1; lap <= 78; lap++) {
      race = canonicalRaceEngineService.advanceOneLap(race, { persistState: false })
      if (race.status === 'completed') break
    }

    const p1 = race.drivers[0]
    expect(p1.isDnf).toBe(false)
    expect(p1.dnfReason).toBeUndefined()
    expect(p1.fuel).toBeGreaterThanOrEqual(0)
    // Ao final de 78 voltas, deve restar aproximadamente a reserva de 1.0 kg
    expect(p1.fuel).toBeGreaterThan(0.5)
  })

  // FUEL11 — INTEGRATION: Most demanding race (Madrid) is completable in NORMAL pace
  it('FUEL11 — INTEGRATION: most demanding race (Madrid) is completable in NORMAL pace', () => {
    let race = createMinimalMockRace({
      round: 16,
      circuitName: 'Circuito Madring, Madrid',
      circuitCountry: 'Espanha',
      totalLaps: 66,
    })

    const initialFuel = race.drivers[0].fuel
    expect(initialFuel).toBeCloseTo(109.3852, 3)

    // Avançar 66 voltas
    for (let lap = 1; lap <= 66; lap++) {
      race = canonicalRaceEngineService.advanceOneLap(race, { persistState: false })
      if (race.status === 'completed') break
    }

    const p1 = race.drivers[0]
    expect(p1.isDnf).toBe(false)
    expect(p1.dnfReason).toBeUndefined()
    expect(p1.fuel).toBeGreaterThanOrEqual(0)
  })

  // FUEL12 — PLAYER OVERRIDE RULES: 0 < fuel <= 110 preserved, > 110 rejected
  it('FUEL12 — PLAYER OVERRIDE RULES: explicit startingFuelKg preserved if valid, rejected if > 110', () => {
    const grid = createTestGrid()

    // 1. Valid override: 60 kg (abaixo do required em Monaco, mas aceito com warning)
    const raceWithValidOverride =
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: 'career_override_test',
        season: 2026,
        round: 8,
        circuitName: 'Circuito de Mônaco, Monte Carlo',
        circuitCountry: 'Mônaco',
        totalLaps: 78,
        playerTeamId: 'team_audi',
        canonicalQualifyingGrid: grid,
        carPreparations: {
          car1: {
            startingFuelKg: 60.0,
          },
        },
        persistState: false,
      })

    const car1Driver = raceWithValidOverride.drivers.find((d) => d.carId === 'car1')!
    expect(car1Driver.fuel).toBe(60.0)

    // 2. Invalid override > 110 kg: rejeitado e fallback para auto calculated
    const raceWithInvalidOverride =
      canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
        careerId: 'career_override_invalid_test',
        season: 2026,
        round: 8,
        circuitName: 'Circuito de Mônaco, Monte Carlo',
        circuitCountry: 'Mônaco',
        totalLaps: 78,
        playerTeamId: 'team_audi',
        canonicalQualifyingGrid: grid,
        carPreparations: {
          car1: {
            startingFuelKg: 125.0,
          },
        },
        persistState: false,
      })

    const car1Fallback = raceWithInvalidOverride.drivers.find((d) => d.carId === 'car1')!
    const expectedMonaco = calculateRequiredStartingFuelKg(78, 3.337, 1.0)
    expect(car1Fallback.fuel).toBeCloseTo(expectedMonaco, 3)
  })
})
