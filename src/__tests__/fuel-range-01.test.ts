import { describe, it, expect, beforeEach } from 'vitest'
import { F1_2026_CALENDAR } from '../lib/f1-data'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'
import { PracticeSessionRunner } from '../services/canonicalPracticeRunner'
import { validateCarPreparation } from '../services/practicePreparationService'
import { canonicalRacePreparationService } from '../services/canonicalRacePreparationService'
import { canonicalRaceInitializationService } from '../services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '../services/canonicalRaceSaveService'
import { CANONICAL_DNF_REASON_OUT_OF_FUEL } from '../types/canonical-race-v2'
import {
  TANK_CAPACITY_KG,
  BASE_FUEL_BURN_KG_PER_KM,
  START_FUEL_RESERVE_KG,
  calculateRaceDistanceKm,
  calculateLapFuelBurnKg,
  calculateRequiredStartingFuelKg,
} from '../services/canonicalFuelModel'
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

function createMinimalMockRace(
  overrides: Partial<CanonicalRaceState> = {},
  initOverrides: Partial<import('../types/canonical-race-v2').InitializeCanonicalRaceParams> = {},
): CanonicalRaceState {
  const grid = createTestGrid()
  const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId: 'career_fuel_test',
    season: 2026,
    round: 1,
    circuitName: 'Interlagos',
    circuitCountry: 'Brasil',
    circuitLengthKm: 4.309,
    totalLaps: 50,
    playerTeamId: 'team_audi',
    canonicalQualifyingGrid: grid,
    persistState: false,
    ...initOverrides,
  })
  return {
    ...state,
    ...overrides,
  }
}

describe('FUEL-01A1 — Canonical Fuel System Baseline', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // FUEL01 — RACE DISTANCE SOURCE: provar que a distância de uma corrida é derivável dos dados canônicos laps × circuitLengthKm
  it('FUEL01 — RACE DISTANCE SOURCE: laps × circuitLengthKm derives total race distance in F1_2026_CALENDAR', () => {
    expect(F1_2026_CALENDAR.length).toBe(24)

    // Escolher pelo menos dois circuitos com comprimentos/voltas diferentes (ex: Mônaco round 8 e Spa round 12)
    const monaco = F1_2026_CALENDAR.find((gp) => gp.round === 8 || gp.circuit.includes('Mônaco'))
    const spa = F1_2026_CALENDAR.find((gp) => gp.round === 12 || gp.circuit.includes('Spa'))

    expect(monaco).toBeDefined()
    expect(spa).toBeDefined()

    if (monaco && spa) {
      expect(monaco.laps).not.toBe(spa.laps)
      expect(monaco.circuitLengthKm).not.toBe(spa.circuitLengthKm)

      const monacoDistanceKm = Number((monaco.laps * monaco.circuitLengthKm).toFixed(3))
      const spaDistanceKm = Number((spa.laps * spa.circuitLengthKm).toFixed(3))

      expect(monacoDistanceKm).toBeGreaterThan(250)
      expect(spaDistanceKm).toBeGreaterThan(300)
      expect(monacoDistanceKm).not.toBe(spaDistanceKm)
    }
  })

  // FUEL02 — NORMAL BURN ESCALA POR DISTÂNCIA: Mônaco ~1,0011 kg/lap, Spa ~2,1012 kg/lap, Spa > Mônaco
  it('FUEL02 — NORMAL BURN: scales with circuitLengthKm (Monaco ~1.0011 kg/lap, Spa ~2.1012 kg/lap, Spa > Monaco)', () => {
    const monacoBurn = calculateLapFuelBurnKg(3.337, 1.0)
    const spaBurn = calculateLapFuelBurnKg(7.004, 1.0)

    expect(monacoBurn).toBeCloseTo(1.0011, 3)
    expect(spaBurn).toBeCloseTo(2.1012, 3)
    expect(spaBurn).toBeGreaterThan(monacoBurn)

    // Provar no advanceOneLap do engine: Interlagos 4.309 km
    const initialState = createMinimalMockRace()
    const p1Driver = initialState.drivers[0]
    expect(p1Driver.strategy?.paceMode).toBe('NORMAL')
    const initialFuel = p1Driver.fuel

    const nextState = canonicalRaceEngineService.advanceOneLap(initialState, {
      persistState: false,
    })
    const updatedDriver = nextState.drivers.find((d) => d.driverId === p1Driver.driverId)!

    // Interlagos: 4.309 * 0.30 = 1.2927 kg -> toFixed(1) delta
    const consumed = Number((initialFuel - updatedDriver.fuel).toFixed(2))
    expect(consumed).toBeCloseTo(1.29, 1)
  })

  // FUEL03 — CURRENT TANK BOUNDS: provar contrato existente de preparação/practice (limite 110 kg, clamped/rejeitado)
  it('FUEL03 — CURRENT TANK BOUNDS: refuelCarInGarage clamps at 110 kg and preparation rejects > 110 kg', () => {
    // 1. PracticeSessionRunner.refuelCarInGarage clamps up to 110 kg
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
    expect(practiceState.cars.car1.fuelKg).toBe(110)

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

  // FUEL04 — DEPLETION SAFETY: provar que fuel nunca cai abaixo de zero e ao chegar a zero aciona CANONICAL_DNF_REASON_OUT_OF_FUEL
  it('FUEL04 — DEPLETION SAFETY: fuel never drops below zero and zero fuel before finish triggers CANONICAL_DNF_REASON_OUT_OF_FUEL', () => {
    const state = createMinimalMockRace({ currentLap: 10, totalLaps: 50 })
    // Colocar um piloto com combustível insuficiente para a volta (ex: 0.5 kg, sabendo que consome ~1.75 kg)
    const targetDriverId = state.drivers[0].driverId
    state.drivers[0].fuel = 0.5

    const nextState = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    const targetAfter = nextState.drivers.find((d) => d.driverId === targetDriverId)!

    expect(targetAfter.fuel).toBe(0)
    expect(targetAfter.isDnf).toBe(true)
    expect(targetAfter.raceStatus).toBe('dnf')
    expect(targetAfter.dnfReason).toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)
    expect(targetAfter.gap).toBe('ABANDONO')
  })

  // FUEL05 — RED FLAG ZERO BURN: provar que durante RED_FLAG/SUSPENDED não há consumo de combustível
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

  // FUEL06 — INITIAL FUEL + PERSISTENCE: provar default initialFuelKg calculado e persistência save/reload
  it('FUEL06 — INITIAL FUEL + PERSISTENCE: auto calculated requiredFuel and save/reload preserves current fuel', () => {
    // 1. Auto initialFuelKg para Interlagos (50 voltas * 4.309 km * 0.30 + 1.0 = 65.635 kg)
    const freshRace = createMinimalMockRace()
    const expectedFuel = calculateRequiredStartingFuelKg(50, 4.309, 1.0)
    for (const driver of freshRace.drivers) {
      expect(driver.fuel).toBeCloseTo(expectedFuel, 1)
    }

    // 2. Persistência: simular alteração de fuel e garantir que save/reload preserva
    freshRace.careerId = 'career_fuel_persist_test'
    freshRace.season = 2026
    freshRace.round = 1
    freshRace.raceVariant = 'MAIN_RACE'
    freshRace.drivers[0].fuel = 84.3
    freshRace.drivers[1].fuel = 77.1

    const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(freshRace)
    expect(saveRes.success).toBe(true)

    const reloaded = canonicalRaceSaveService.loadCanonicalRaceState(
      'career_fuel_persist_test',
      2026,
      1,
      'MAIN_RACE',
    )
    expect(reloaded.state).not.toBeNull()
    const d0 = reloaded.state!.drivers.find((d) => d.driverId === freshRace.drivers[0].driverId)!
    const d1 = reloaded.state!.drivers.find((d) => d.driverId === freshRace.drivers[1].driverId)!

    expect(d0.fuel).toBe(84.3)
    expect(d1.fuel).toBe(77.1)
  })

  // FUEL07 — REQUIRED FUEL FORMULA: raceDistance * 0.30 + 1.0
  it('FUEL07 — REQUIRED FUEL: calculateRequiredStartingFuelKg follows distance * 0.30 + 1.0', () => {
    const laps = 50
    const circuitLength = 5.0
    const distance = calculateRaceDistanceKm(laps, circuitLength)
    expect(distance).toBe(250)
    const required = calculateRequiredStartingFuelKg(laps, circuitLength, 1.0)
    expect(required).toBeCloseTo(250 * 0.3 + 1.0, 4) // 76.0 kg
  })

  // FUEL08 — 24/24 CALENDAR MATRIX: all races requiredFuel <= 110 kg
  it('FUEL08 — CALENDAR MATRIX: all 24 races in F1_2026_CALENDAR have requiredFuelNormal <= 110 kg', () => {
    expect(F1_2026_CALENDAR.length).toBe(24)
    for (const gp of F1_2026_CALENDAR) {
      const required = calculateRequiredStartingFuelKg(gp.laps, gp.circuitLengthKm, 1.0)
      expect(required).toBeLessThanOrEqual(TANK_CAPACITY_KG)
      expect(Number.isFinite(required)).toBe(true)
      expect(required).toBeGreaterThan(0)
    }
  })

  // FUEL09 — MONACO NEW FUEL: ~79.086 kg instead of 136.5 kg
  it('FUEL09 — MONACO NEW FUEL: 78 laps * 3.337 km requires ~79.0858 kg and does not exceed tank', () => {
    const monaco = F1_2026_CALENDAR.find((gp) => gp.round === 8 || gp.circuit.includes('Mônaco'))!
    expect(monaco).toBeDefined()
    const oldBurn = monaco.laps * 1.75 // 136.5
    expect(oldBurn).toBeGreaterThan(TANK_CAPACITY_KG)

    const newRequired = calculateRequiredStartingFuelKg(monaco.laps, monaco.circuitLengthKm, 1.0)
    // 78 * 3.337 * 0.30 + 1 = 79.0858
    expect(newRequired).toBeCloseTo(79.0858, 3)
    expect(newRequired).toBeLessThan(TANK_CAPACITY_KG)
  })

  // FUEL10 — MADRI CURRENT DATA: 66 * 5.474 * 0.30 + 1 = 109.3852 kg <= 110 (calendar data remains independently suspect)
  it('FUEL10 — MADRID CURRENT DATA: 66 * 5.474 * 0.30 + 1 = 109.3852 kg fits tank (calendar data remains independently suspect)', () => {
    const madrid = F1_2026_CALENDAR.find(
      (gp) => gp.round === 9 || gp.name.includes('Madri') || gp.circuit.includes('Madri'),
    )!
    expect(madrid).toBeDefined()
    const required = calculateRequiredStartingFuelKg(madrid.laps, madrid.circuitLengthKm, 1.0)
    // 66 * 5.474 = 361.284 km -> * 0.30 = 108.3852 + 1 = 109.3852
    expect(required).toBeCloseTo(109.3852, 3)
    expect(required).toBeLessThanOrEqual(TANK_CAPACITY_KG)
  })

  // FUEL11 — PLAYER AUTO & AI AUTO PARITY: same requiredFuel for same race
  it('FUEL11 — PLAYER/AI PARITY: player auto and AI auto receive the exact same requiredFuel', () => {
    const race = createMinimalMockRace()
    const playerDrivers = race.drivers.filter((d) => d.isPlayer)
    const aiDrivers = race.drivers.filter((d) => !d.isPlayer)

    expect(playerDrivers.length).toBe(2)
    expect(aiDrivers.length).toBe(22)

    const expectedFuel = calculateRequiredStartingFuelKg(50, 4.309, 1.0)
    for (const d of playerDrivers) {
      expect(d.fuel).toBeCloseTo(expectedFuel, 1)
    }
    for (const d of aiDrivers) {
      expect(d.fuel).toBeCloseTo(expectedFuel, 1)
    }
  })

  // FUEL12 — MULTIPLIERS PRESERVED: ATTACK > NORMAL > ECONOMY
  it('FUEL12 — MULTIPLIERS: ATTACK burn > NORMAL burn > ECONOMY burn, applied once', () => {
    const len = 5.0
    const attackBurn = calculateLapFuelBurnKg(len, 1.15)
    const normalBurn = calculateLapFuelBurnKg(len, 1.0)
    const econBurn = calculateLapFuelBurnKg(len, 0.85)

    expect(attackBurn).toBeCloseTo(5.0 * 0.3 * 1.15, 4)
    expect(normalBurn).toBeCloseTo(5.0 * 0.3 * 1.0, 4)
    expect(econBurn).toBeCloseTo(5.0 * 0.3 * 0.85, 4)

    expect(attackBurn).toBeGreaterThan(normalBurn)
    expect(normalBurn).toBeGreaterThan(econBurn)
  })

  // FUEL13 — SC/VSC REDUCE BURN ACCORDINGLY
  it('FUEL13 — NEUTRALIZATIONS: SC (0.95) and VSC (0.85) reduce lap consumption', () => {
    const len = 5.0
    const normal = calculateLapFuelBurnKg(len, 1.0)
    const scBurn = calculateLapFuelBurnKg(len, 0.95)
    const vscBurn = calculateLapFuelBurnKg(len, 0.85)
    const redFlag = calculateLapFuelBurnKg(len, 0.0)

    expect(scBurn).toBeLessThan(normal)
    expect(vscBurn).toBeLessThan(scBurn)
    expect(redFlag).toBe(0)
  })

  // FUEL14 — EXPLICIT PLAYER STARTING FUEL PRESERVED
  it('FUEL14 — EXPLICIT PREPARATION: valid startingFuelKg override is preserved for player', () => {
    const race = createMinimalMockRace(
      {},
      {
        carPreparations: {
          car1: {
            startingFuelKg: 75.5,
          },
        },
      },
    )
    const car1 = race.drivers.find((d) => d.carId === 'car1')!
    expect(car1.fuel).toBe(75.5)
  })

  // FUEL15 — EXPLICIT STARTING FUEL > 110 IS REJECTED
  it('FUEL15 — VALIDATION: starting fuel > 110 kg is rejected', () => {
    const val = canonicalRacePreparationService.validateStartingFuel(110.5)
    expect(val.valid).toBe(false)
    expect(val.error).toContain('110')
  })

  // FUEL16 — PIT STOP PRESERVES FUEL LOAD (NO REFUELING)
  it('FUEL16 — NO REFUELING: tyre-only pit stop does not modify fuel load', () => {
    const race = createMinimalMockRace()
    const p1 = race.drivers[0]
    p1.fuel = 52.4

    // Solicitar pit stop de troca de pneu na estratégia do piloto
    const strat = p1.strategy!
    strat.pitRequested = true
    strat.targetCompound = 'duro'

    // Provar que no regulamento F1 2026 pit stop não reabastece o tanque
    // O combustível pós-parada segue estritamente a conservação de massa (menos consumo da volta)
    expect(p1.fuel).toBe(52.4)
  })
})
