import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceInitializationService } from '../services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'
import { CANONICAL_DNF_REASON_OUT_OF_FUEL } from '@/types/canonical-race-v2'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'

describe('RACE-PROVENANCE-AUDIT-02A2-D1: Micro-Patch Abandono por Falta de Combustível', () => {
  let baseGrid: FinalQualifyingGridEntry[]

  beforeEach(() => {
    localStorage.clear()
    baseGrid = Array.from({ length: 24 }, (_, i) => ({
      position: i + 1,
      driverId: `driver_${i + 1}`,
      driverName: `Driver ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Team ${Math.floor(i / 2) + 1}`,
      teamColor: '#ff0000',
      qBestMs: 80000 + i * 100,
    })) as unknown as FinalQualifyingGridEntry[]
  })

  // D1-01: fuel suficiente -> corrida normal
  it('D1-01: fuel suficiente -> corrida normal sem nenhum DNF por combustível', () => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c1',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 5,
      initialFuelKg: 100.0,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
    })

    const finalState = canonicalRaceEngineService.advanceMultipleLaps(state, 5, {
      seedOverride: 42,
      persistState: false,
    })

    expect(finalState.status).toBe('completed')
    finalState.drivers.forEach((d) => {
      expect(d.fuel).toBeGreaterThan(0)
      if (!d.isDnf) {
        expect(d.raceStatus).toBe('finished')
        expect(d.lap).toBe(5)
      }
    })
  })

  // D1-02: fuel chega a 0 antes do fim -> DNF OUT_OF_FUEL
  it('D1-02: fuel chega a 0 antes do fim -> DNF OUT_OF_FUEL', () => {
    // 5.0 kg para 6 voltas (consumo ~1.75 kg/volta => acaba na volta 3)
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c2',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 6,
      initialFuelKg: 5.0,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
    })

    const lap1 = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 1,
      persistState: false,
    })
    expect(lap1.drivers[0].raceStatus).toBe('racing')

    const lap2 = canonicalRaceEngineService.advanceOneLap(lap1, {
      seedOverride: 2,
      persistState: false,
    })
    expect(lap2.drivers[0].raceStatus).toBe('racing')

    const lap3 = canonicalRaceEngineService.advanceOneLap(lap2, {
      seedOverride: 3,
      persistState: false,
    })
    const d3 = lap3.drivers.find((d) => d.driverId === baseGrid[0].driverId)!

    expect(d3.fuel).toBe(0)
    expect(d3.raceStatus).toBe('dnf')
    expect(d3.isDnf).toBe(true)
    expect(d3.dnfReason).toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)
    expect(d3.dnfLap).toBe(3)
  })

  // D1-03: após DNF, nenhuma volta adicional é executada
  it('D1-03: após DNF, nenhuma volta adicional é executada para o carro abandonado', () => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c3',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 6,
      initialFuelKg: 5.0,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
    })

    const lap3 = canonicalRaceEngineService.advanceMultipleLaps(state, 3, {
      seedOverride: 10,
      persistState: false,
    })
    const d3 = lap3.drivers.find((d) => d.driverId === baseGrid[0].driverId)!
    expect(d3.raceStatus).toBe('dnf')
    const completedLapsAtDnf = d3.lap

    const lap4 = canonicalRaceEngineService.advanceOneLap(lap3, {
      seedOverride: 11,
      persistState: false,
    })
    const d4 = lap4.drivers.find((d) => d.driverId === baseGrid[0].driverId)!

    expect(d4.raceStatus).toBe('dnf')
    expect(d4.lap).toBe(completedLapsAtDnf)
    expect(d4.fuel).toBe(0)
  })

  // D1-04: completedLaps para no valor correto
  it('D1-04: completedLaps para no valor correto da volta em que o combustível acabou', () => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c4',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 6,
      initialFuelKg: 5.0,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
    })

    const lap6 = canonicalRaceEngineService.advanceMultipleLaps(state, 6, {
      seedOverride: 20,
      persistState: false,
    })
    const d6 = lap6.drivers.find((d) => d.driverId === baseGrid[0].driverId)!

    expect(d6.isDnf).toBe(true)
    expect(d6.dnfReason).toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)
    expect(d6.lap).toBe(3) // completou volta 3 e parou
    expect(d6.dnfLap).toBe(3)
  })

  // D1-05: accumulatedTime permanece congelado após abandono
  it('D1-05: accumulatedTime permanece congelado após abandono', () => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c5',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 6,
      initialFuelKg: 5.0,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
    })

    const lap3 = canonicalRaceEngineService.advanceMultipleLaps(state, 3, {
      seedOverride: 30,
      persistState: false,
    })
    const d3 = lap3.drivers.find((d) => d.driverId === baseGrid[0].driverId)!
    const frozenRaceTime = d3.raceTime
    expect(frozenRaceTime).toBeGreaterThan(0)

    const lap4 = canonicalRaceEngineService.advanceOneLap(lap3, {
      seedOverride: 31,
      persistState: false,
    })
    const d4 = lap4.drivers.find((d) => d.driverId === baseGrid[0].driverId)!
    expect(d4.raceTime).toBe(frozenRaceTime)

    const lap5 = canonicalRaceEngineService.advanceOneLap(lap4, {
      seedOverride: 32,
      persistState: false,
    })
    const d5 = lap5.drivers.find((d) => d.driverId === baseGrid[0].driverId)!
    expect(d5.raceTime).toBe(frozenRaceTime)
  })

  // D1-06: fuel nunca fica negativo
  it('D1-06: fuel nunca fica negativo', () => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c6',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 4,
      initialFuelKg: 0.8, // Menor que o consumo da volta (~1.75 kg)
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
    })

    const lap1 = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 40,
      persistState: false,
    })
    lap1.drivers.forEach((d) => {
      expect(d.fuel).toBeGreaterThanOrEqual(0)
      expect(d.fuel).toBe(0)
    })
  })

  // D1-07: fuel menor que consumo da volta -> clampa em 0 e DNF antes da próxima
  it('D1-07: fuel menor que consumo da volta -> clampa em 0 e DNF antes da próxima volta', () => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c7',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 5,
      initialFuelKg: 0.5, // menor que consumo nominal de ~1.75 kg
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
    })

    const lap1 = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 50,
      persistState: false,
    })
    const driver = lap1.drivers[0]

    expect(driver.lap).toBe(1)
    expect(driver.fuel).toBe(0)
    expect(driver.raceStatus).toBe('dnf')
    expect(driver.isDnf).toBe(true)
    expect(driver.dnfReason).toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)
    expect(driver.dnfLap).toBe(1)

    // Ao avançar para a volta 2, o piloto não corre
    const lap2 = canonicalRaceEngineService.advanceOneLap(lap1, {
      seedOverride: 51,
      persistState: false,
    })
    const driverLap2 = lap2.drivers.find((d) => d.driverId === driver.driverId)!
    expect(driverLap2.lap).toBe(1)
    expect(driverLap2.raceStatus).toBe('dnf')
  })

  // D1-08: fuel chega a 0 exatamente após última volta -> FINISHED, não DNF
  it('D1-08: fuel chega a 0 exatamente após última volta -> FINISHED, não DNF', () => {
    // Corrida de 1 volta onde o combustível esgota na própria volta 1
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c8',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 1,
      initialFuelKg: 1.0, // Consome até 0 na volta 1 (que é a última volta totalLaps=1)
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
    })

    const lap1 = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 60,
      persistState: false,
    })
    const driver = lap1.drivers[0]

    expect(driver.lap).toBe(1)
    expect(driver.fuel).toBe(0)
    // Como era a última volta (1 de 1), cruzou a bandeirada: FINISHED, não DNF!
    expect(driver.raceStatus).toBe('finished')
    expect(driver.isDnf).toBeFalsy()
    expect(driver.dnfReason).toBeUndefined()
  })

  // D1-09: save/reload preserva OUT_OF_FUEL
  it('D1-09: save/reload preserva OUT_OF_FUEL, completedLaps, accumulatedTime e fuel=0', () => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c9',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 6,
      initialFuelKg: 5.0,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
      persistState: false,
    })

    const lap3 = canonicalRaceEngineService.advanceMultipleLaps(state, 3, {
      seedOverride: 70,
      persistState: false,
    })

    // Salvar explicitamente
    canonicalRaceInitializationService.saveCanonicalRaceState(lap3)

    // Recarregar via readCanonicalRaceState
    const reloaded = canonicalRaceInitializationService.readCanonicalRaceState('d1-c9', 2026, 1)
    expect(reloaded).not.toBeNull()

    const dReloaded = reloaded!.drivers.find((d) => d.driverId === baseGrid[0].driverId)!
    expect(dReloaded.fuel).toBe(0)
    expect(dReloaded.raceStatus).toBe('dnf')
    expect(dReloaded.isDnf).toBe(true)
    expect(dReloaded.dnfReason).toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)
    expect(dReloaded.dnfLap).toBe(3)
    expect(dReloaded.lap).toBe(3)
    expect(dReloaded.raceTime).toBe(
      lap3.drivers.find((d) => d.driverId === baseGrid[0].driverId)!.raceTime,
    )
  })

  // D1-10: reload não ressuscita carro
  it('D1-10: reload não ressuscita carro (continua DNF e não executa novas voltas)', () => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c10',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 6,
      initialFuelKg: 5.0,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
      persistState: false,
    })

    const lap3 = canonicalRaceEngineService.advanceMultipleLaps(state, 3, {
      seedOverride: 80,
      persistState: false,
    })

    canonicalRaceInitializationService.saveCanonicalRaceState(lap3)

    const reloaded = canonicalRaceInitializationService.readCanonicalRaceState('d1-c10', 2026, 1)!
    expect(reloaded.drivers[0].raceStatus).toBe('dnf')

    // Avançar volta a partir do estado recarregado
    const lap4AfterReload = canonicalRaceEngineService.advanceOneLap(reloaded, {
      seedOverride: 81,
      persistState: false,
    })

    const driverAfter = lap4AfterReload.drivers.find((d) => d.driverId === baseGrid[0].driverId)!
    expect(driverAfter.raceStatus).toBe('dnf')
    expect(driverAfter.isDnf).toBe(true)
    expect(driverAfter.lap).toBe(3)
  })

  // D1-11: classificação de abandono usa regra já existente
  it('D1-11: classificação de abandono usa regra já existente (laps desc, raceTime asc)', () => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c11',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 6,
      initialFuelKg: 100.0,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
    })

    // Piloto 0 com pouco combustível para abandonar na volta 2
    // Piloto 1 com combustível para abandonar na volta 3
    state.drivers[0].fuel = 2.0
    state.drivers[1].fuel = 4.0

    const lap2 = canonicalRaceEngineService.advanceMultipleLaps(state, 2, {
      seedOverride: 90,
      persistState: false,
    })
    const d0Lap2 = lap2.drivers.find((d) => d.driverId === baseGrid[0].driverId)!
    expect(d0Lap2.raceStatus).toBe('dnf') // Abandonou na volta 2
    expect(d0Lap2.lap).toBe(2)

    const lap3 = canonicalRaceEngineService.advanceOneLap(lap2, {
      seedOverride: 91,
      persistState: false,
    })
    const d1Lap3 = lap3.drivers.find((d) => d.driverId === baseGrid[1].driverId)!
    expect(d1Lap3.raceStatus).toBe('dnf') // Abandonou na volta 3
    expect(d1Lap3.lap).toBe(3)

    // O piloto que completou mais voltas antes de abandonar (d1 com 3 laps) deve estar à frente
    // do piloto que abandonou antes (d0 com 2 laps) entre os abandonos.
    const posD1 = d1Lap3.currentPosition
    const posD0 = lap3.drivers.find((d) => d.driverId === baseGrid[0].driverId)!.currentPosition

    expect(posD1).toBeLessThan(posD0)
  })

  // D1-12: outros motivos de DNF permanecem intactos
  it('D1-12: outros motivos de DNF permanecem intactos (falha mecânica forçada)', () => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'd1-c12',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park Circuit',
      circuitCountry: 'Australia',
      totalLaps: 6,
      initialFuelKg: 100.0,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: baseGrid,
    })

    const lap1 = canonicalRaceEngineService.advanceOneLap(state, {
      seedOverride: 110,
      persistState: false,
      forceIncident: {
        type: 'dnf',
        driverId: baseGrid[5].driverId,
      },
    })

    const dnfDriver = lap1.drivers.find((d) => d.driverId === baseGrid[5].driverId)!
    expect(dnfDriver.raceStatus).toBe('dnf')
    expect(dnfDriver.isDnf).toBe(true)
    expect(dnfDriver.dnfReason).toContain('Falha Crítica')
    expect(dnfDriver.dnfReason).not.toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)
    expect(dnfDriver.fuel).toBe(100.0) // Não consumiu a volta pois quebrou no início
  })
})
