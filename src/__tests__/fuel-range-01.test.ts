import { describe, it, expect, beforeEach } from 'vitest'
import { F1_2026_CALENDAR } from '../lib/f1-data'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'
import { PracticeSessionRunner } from '../services/canonicalPracticeRunner'
import { validateCarPreparation } from '../services/practicePreparationService'
import { canonicalRacePreparationService } from '../services/canonicalRacePreparationService'
import { canonicalRaceInitializationService } from '../services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '../services/canonicalRaceSaveService'
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
    round: 1,
    circuitName: 'Interlagos',
    circuitCountry: 'Brasil',
    totalLaps: 50,
    playerTeamId: 'team_audi',
    canonicalQualifyingGrid: grid,
    persistState: false,
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

  // FUEL02 — CANONICAL NORMAL BURN: provar comportamento ATUAL do engine: NORMAL multiplier = 1.0, burn nominal 1.75 kg por volta
  it('FUEL02 — CANONICAL NORMAL BURN: current engine consumes nominally 1.75 kg per lap under green flag and NORMAL pace', () => {
    const initialState = createMinimalMockRace()
    const p1Driver = initialState.drivers[0]
    expect(p1Driver.strategy?.paceMode).toBe('NORMAL')
    const initialFuel = p1Driver.fuel

    // Avançar 1 volta canônica sob bandeira verde
    const nextState = canonicalRaceEngineService.advanceOneLap(initialState, {
      persistState: false,
    })
    const updatedDriver = nextState.drivers.find((d) => d.driverId === p1Driver.driverId)!

    // Diferença deve ser nominalmente 1.75 kg (arredondado para 1 casa decimal no estado = 1.8 kg ou 1.75)
    // No código de canonicalRaceEngineService:
    // fuelBurn = Number((1.75 * 1.0).toFixed(2)) = 1.75
    // newFuel = Math.max(0, Number((drv.fuel - fuelBurnEffective).toFixed(1)))
    // 100 - 1.75 = 98.25 -> toFixed(1) = 98.3
    const consumed = Number((initialFuel - updatedDriver.fuel).toFixed(2))
    expect(consumed).toBeCloseTo(1.75, 1)
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

  // FUEL06 — INITIAL FUEL + PERSISTENCE: provar default initialFuelKg = 100.0 sem override e persistência save/reload
  it('FUEL06 — INITIAL FUEL + PERSISTENCE: default initialFuelKg is 100.0 and save/reload preserves current fuel', () => {
    // 1. Default initialFuelKg = 100.0
    const freshRace = createMinimalMockRace()
    for (const driver of freshRace.drivers) {
      expect(driver.fuel).toBe(100.0)
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
})
