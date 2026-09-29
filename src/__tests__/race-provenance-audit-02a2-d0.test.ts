import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '../services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'
import type { CanonicalRaceState } from '../services/canonicalRaceEngineService'

describe('RACE-PROVENANCE-AUDIT-02A2-D0: Caminho Real do Combustível / Fuel = 0', () => {
  let baseState: CanonicalRaceState

  beforeEach(() => {
    localStorage.clear()
    // Criar uma corrida determinística de 6 voltas com combustível reduzido (5.0 kg)
    baseState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      round: 1,
      circuitName: 'Albert Park Circuit',
      totalLaps: 6,
      initialFuelKg: 5.0,
      weatherCondition: 'seco',
    })
  })

  it('D1..D4: prova consumo volta a volta e clamp em zero via Math.max(0, ...)', () => {
    // Verificar combustível inicial de 5.0 kg
    const p1 = baseState.drivers[0]
    expect(p1.fuel).toBe(5.0)

    // Volta 1: Consumo aproximado de 1.75 kg -> fuel deve reduzir para ~3.25 kg
    const stateLap1 = canonicalRaceEngineService.advanceOneLap(baseState, {
      rng: () => 0.5,
      persistState: false,
    })
    const dLap1 = stateLap1.drivers.find((d) => d.driverId === p1.driverId)!
    expect(dLap1.fuel).toBeLessThan(5.0)
    expect(dLap1.fuel).toBeGreaterThan(0)
    expect(dLap1.raceStatus).toBe('racing')

    // Volta 2: Consumo adicional -> fuel deve reduzir ainda mais
    const stateLap2 = canonicalRaceEngineService.advanceOneLap(stateLap1, {
      rng: () => 0.5,
      persistState: false,
    })
    const dLap2 = stateLap2.drivers.find((d) => d.driverId === p1.driverId)!
    expect(dLap2.fuel).toBeLessThan(dLap1.fuel)
    expect(dLap2.raceStatus).toBe('racing')

    // Volta 3: Combustível esgota (fuel era menor que consumo de ~1.75 kg) -> clampa exatamente em 0
    const stateLap3 = canonicalRaceEngineService.advanceOneLap(stateLap2, {
      rng: () => 0.5,
      persistState: false,
    })
    const dLap3 = stateLap3.drivers.find((d) => d.driverId === p1.driverId)!
    expect(dLap3.fuel).toBe(0)
    expect(dLap3.raceStatus).toBe('racing') // Prova D5: Não abandona!
  })

  it('D5..D7: prova que com fuel = 0 o carro continua recebendo simulação, tempos e voltas sem DNF', () => {
    // Forçar piloto com fuel = 0 no estado inicial
    const stateWithZeroFuel: CanonicalRaceState = {
      ...baseState,
      drivers: baseState.drivers.map((d) => ({
        ...d,
        fuel: 0,
      })),
    }

    // Executar volta com fuel = 0
    const nextState = canonicalRaceEngineService.advanceOneLap(stateWithZeroFuel, {
      rng: () => 0.5,
      persistState: false,
    })

    const driver = nextState.drivers[0]

    // A. carro continua recebendo lap simulation? SIM.
    expect(driver.lap).toBe(1)
    // B. tempo de volta continua sendo calculado? SIM.
    expect(driver.lastLapTimeSec).toBeGreaterThan(0)
    expect(driver.raceTime).toBeGreaterThan(0)
    // C. posição continua sendo atualizada? SIM.
    expect(driver.currentPosition).toBeGreaterThanOrEqual(1)
    // D. completedLaps continua subindo? SIM.
    expect(driver.lap).toBe(1)
    // E. status continua RUNNING/ACTIVE? SIM (racing).
    expect(driver.raceStatus).toBe('racing')
    // F. algum DNF é disparado? NÃO.
    expect(driver.isDnf).toBeFalsy()
    expect(driver.dnfReason).toBeUndefined()
    expect(driver.fuel).toBe(0) // Clamped em 0
  })

  it('Passo 7 (Teste de Limite): fuel restante > 0 mas < consumo da volta permite iniciar volta e clampa em 0', () => {
    // Configurar fuel para 0.5 kg (menor que consumo nominal de 1.75 kg)
    const stateLowFuel: CanonicalRaceState = {
      ...baseState,
      drivers: baseState.drivers.map((d) => ({
        ...d,
        fuel: 0.5,
      })),
    }

    const stateAfterLap = canonicalRaceEngineService.advanceOneLap(stateLowFuel, {
      rng: () => 0.5,
      persistState: false,
    })

    const driver = stateAfterLap.drivers[0]
    // Comportamento comprovado: (1) permite iniciar a volta e clampa depois em 0
    expect(driver.fuel).toBe(0)
    expect(driver.lap).toBe(1)
    expect(driver.raceStatus).toBe('racing')
    expect(driver.isDnf).toBeFalsy()
  })

  it('D8..D9: prova save/reload com fuel = 0 preserva estado ativo e fuel zero', () => {
    // Gerar estado com fuel = 0
    const stateWithZeroFuel: CanonicalRaceState = {
      ...baseState,
      drivers: baseState.drivers.map((d) => ({
        ...d,
        fuel: 0,
      })),
    }

    // Salvar no storage
    canonicalRaceInitializationService.saveCanonicalRaceState(stateWithZeroFuel)

    // Recarregar via readCanonicalRaceState
    const loadedState = canonicalRaceInitializationService.readCanonicalRaceState(
      stateWithZeroFuel.careerId,
      stateWithZeroFuel.season,
      stateWithZeroFuel.round,
    )
    expect(loadedState).not.toBeNull()

    const loadedDriver = loadedState!.drivers[0]
    // D8: fuel restante persiste corretamente? SIM (0).
    expect(loadedDriver.fuel).toBe(0)
    // D9: se carro continua ativo com fuel zero, reload mantém esse estado? SIM.
    expect(loadedDriver.raceStatus).toBe('racing')
    expect(loadedDriver.isDnf).toBeFalsy()
  })

  it('Passo 5: executa fixture determinística completa de 6 voltas e valida comportamento', () => {
    let currentState = baseState
    const lapLog: Array<{
      lap: number
      fuelBefore: number
      fuelAfter: number
      status: string
      isDnf: boolean
    }> = []

    for (let lap = 1; lap <= 6; lap++) {
      const fuelBefore = currentState.drivers[0].fuel
      currentState = canonicalRaceEngineService.advanceOneLap(currentState, {
        rng: () => 0.5,
        persistState: false,
      })
      const driver = currentState.drivers[0]
      lapLog.push({
        lap,
        fuelBefore,
        fuelAfter: driver.fuel,
        status: driver.raceStatus,
        isDnf: !!driver.isDnf,
      })
    }

    // Verificar que na volta 3 ou 4 o combustível zera e permanece 0
    expect(lapLog[0].fuelAfter).toBeLessThan(5.0)
    expect(lapLog[2].fuelAfter).toBe(0)
    expect(lapLog[3].fuelAfter).toBe(0)
    expect(lapLog[4].fuelAfter).toBe(0)
    expect(lapLog[5].fuelAfter).toBe(0)

    // Verificar que em nenhuma volta houve DNF
    lapLog.forEach((log) => {
      expect(log.isDnf).toBe(false)
    })

    // Na volta 6, por ser a última volta da corrida (totalLaps = 6), status vira 'finished'
    expect(lapLog[5].status).toBe('finished')
  })
})
