import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '../services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

describe('RACE-PROVENANCE-AUDIT-02A2-D0: Caminho Real do Combustível / Fuel = 0', () => {
  let baseState: CanonicalRaceState

  beforeEach(() => {
    localStorage.clear()
    const qualifyingGrid = Array.from({ length: 24 }, (_, i) => ({
      position: i + 1,
      driverId: `driver_${i + 1}`,
      driverName: `Driver ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Team ${Math.floor(i / 2) + 1}`,
      teamColor: '#ff0000',
      qBestMs: 80000 + i * 100,
    }))

    // Criar uma corrida determinística de 6 voltas com combustível reduzido (5.0 kg)
    baseState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'audit-d0-career',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 6,
      initialFuelKg: 5.0,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: qualifyingGrid as unknown as FinalQualifyingGridEntry[],
    })
  })

  it('D1..D4: prova consumo volta a volta e clamp em zero via Math.max(0, ...)', () => {
    // Verificar combustível inicial de 5.0 kg
    const p1 = baseState.drivers[0]
    expect(p1.fuel).toBe(5.0)

    // Volta 1: Consumo aproximado de 1.75 kg -> fuel deve reduzir para ~3.25 kg
    const stateLap1 = canonicalRaceEngineService.advanceOneLap(baseState, {
      seedOverride: 42,
      persistState: false,
    })
    const dLap1 = stateLap1.drivers.find((d) => d.driverId === p1.driverId)!
    expect(dLap1.fuel).toBeLessThan(5.0)
    expect(dLap1.fuel).toBeGreaterThan(0)
    expect(dLap1.raceStatus).toBe('racing')

    // Volta 2: Consumo adicional -> fuel deve reduzir ainda mais
    const stateLap2 = canonicalRaceEngineService.advanceOneLap(stateLap1, {
      seedOverride: 43,
      persistState: false,
    })
    const dLap2 = stateLap2.drivers.find((d) => d.driverId === p1.driverId)!
    expect(dLap2.fuel).toBeLessThan(dLap1.fuel)
    expect(dLap2.raceStatus).toBe('racing')

    // Volta 3: Combustível esgota (fuel era menor que consumo de ~1.75 kg) -> clampa em 0 e agora vira DNF
    const stateLap3 = canonicalRaceEngineService.advanceOneLap(stateLap2, {
      seedOverride: 44,
      persistState: false,
    })
    const dLap3 = stateLap3.drivers.find((d) => d.driverId === p1.driverId)!
    expect(dLap3.fuel).toBe(0)
    expect(dLap3.raceStatus).toBe('dnf') // D1: Agora abandona!
    expect(dLap3.isDnf).toBe(true)
    expect(dLap3.dnfReason).toBe('OUT_OF_FUEL')
  })

  it('D5..D7: prova que com fuel = 0 antes do fim da prova a volta termina em DNF OUT_OF_FUEL', () => {
    // Forçar piloto com fuel = 0 no estado inicial (corrida de 6 voltas)
    const stateWithZeroFuel: CanonicalRaceState = {
      ...baseState,
      drivers: baseState.drivers.map((d) => ({
        ...d,
        fuel: 0,
      })),
    }

    // Executar volta com fuel = 0: completa a volta 1, clampa em 0 e transiciona para DNF
    const nextState = canonicalRaceEngineService.advanceOneLap(stateWithZeroFuel, {
      seedOverride: 100,
      persistState: false,
    })

    const driver = nextState.drivers[0]

    // Completa a volta 1 mas abandona
    expect(driver.lap).toBe(1)
    expect(driver.raceStatus).toBe('dnf')
    expect(driver.isDnf).toBe(true)
    expect(driver.dnfReason).toBe('OUT_OF_FUEL')
    expect(driver.fuel).toBe(0)
  })

  it('Passo 7 (Teste de Limite): fuel restante > 0 mas < consumo da volta permite completar volta e transiciona para DNF', () => {
    // Configurar fuel para 0.5 kg (menor que consumo nominal de 1.75 kg em prova de 6 voltas)
    const stateLowFuel: CanonicalRaceState = {
      ...baseState,
      drivers: baseState.drivers.map((d) => ({
        ...d,
        fuel: 0.5,
      })),
    }

    const stateAfterLap = canonicalRaceEngineService.advanceOneLap(stateLowFuel, {
      seedOverride: 200,
      persistState: false,
    })

    const driver = stateAfterLap.drivers[0]
    // Comportamento canônico D1: permite completar a volta, clampa em 0 e marca DNF
    expect(driver.fuel).toBe(0)
    expect(driver.lap).toBe(1)
    expect(driver.raceStatus).toBe('dnf')
    expect(driver.isDnf).toBe(true)
    expect(driver.dnfReason).toBe('OUT_OF_FUEL')
  })

  it('D8..D9: prova save/reload preserva DNF e fuel zero', () => {
    // Gerar estado com fuel = 0 e status dnf
    const stateWithZeroFuel: CanonicalRaceState = {
      ...baseState,
      drivers: baseState.drivers.map((d) => ({
        ...d,
        fuel: 0,
        raceStatus: 'dnf',
        isDnf: true,
        dnfReason: 'OUT_OF_FUEL',
        dnfLap: 1,
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
    // D8: fuel restante persiste corretamente (0)
    expect(loadedDriver.fuel).toBe(0)
    // D9: reload mantém DNF
    expect(loadedDriver.raceStatus).toBe('dnf')
    expect(loadedDriver.isDnf).toBe(true)
    expect(loadedDriver.dnfReason).toBe('OUT_OF_FUEL')
  })

  it('Passo 5 (Evolução D1): antiga fixture determinística agora gera DNF na volta 3 e bloqueia voltas 4-6', () => {
    let currentState = baseState
    const lapLog: Array<{
      lap: number
      fuelBefore: number
      fuelAfter: number
      status: string
      isDnf: boolean
      dnfReason?: string
    }> = []

    for (let lap = 1; lap <= 6; lap++) {
      const fuelBefore = currentState.drivers[0].fuel
      currentState = canonicalRaceEngineService.advanceOneLap(currentState, {
        seedOverride: lap * 10,
        persistState: false,
      })
      const driver = currentState.drivers[0]
      lapLog.push({
        lap,
        fuelBefore,
        fuelAfter: driver.fuel,
        status: driver.raceStatus,
        isDnf: !!driver.isDnf,
        dnfReason: driver.dnfReason,
      })
    }

    // Lap 1: 5.00 -> ~3.25, racing
    expect(lapLog[0].fuelAfter).toBeLessThan(5.0)
    expect(lapLog[0].status).toBe('racing')
    expect(lapLog[0].isDnf).toBe(false)

    // Lap 2: 3.25 -> ~1.50, racing
    expect(lapLog[1].fuelAfter).toBeLessThan(lapLog[0].fuelAfter)
    expect(lapLog[1].status).toBe('racing')
    expect(lapLog[1].isDnf).toBe(false)

    // Lap 3: 1.50 -> 0.00 -> DNF OUT_OF_FUEL
    expect(lapLog[2].fuelAfter).toBe(0)
    expect(lapLog[2].status).toBe('dnf')
    expect(lapLog[2].isDnf).toBe(true)
    expect(lapLog[2].dnfReason).toBe('OUT_OF_FUEL')

    // Laps 4-6: NÃO executadas para esse carro (permanece congelado em DNF / 0 fuel / lap 3)
    expect(lapLog[3].status).toBe('dnf')
    expect(lapLog[3].isDnf).toBe(true)
    expect(lapLog[4].status).toBe('dnf')
    expect(lapLog[4].isDnf).toBe(true)
    expect(lapLog[5].status).toBe('dnf')
    expect(lapLog[5].isDnf).toBe(true)
    expect(currentState.drivers[0].lap).toBe(3)
  })
})
