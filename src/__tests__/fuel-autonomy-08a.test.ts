/**
 * fuel-autonomy-08a.test.ts
 *
 * Suíte de testes de validação FUEL-AUTONOMY-08A:
 * Valida a compatibilidade da preparação padrão de corrida e dimensionamento de combustível
 * com a demanda da prova no Apex GP Manager, inclusive no cenário de maior consumo do calendário ativo.
 *
 * Cobre os testes mínimos:
 * A. PREPARAÇÃO PADRÃO: prova representativa inicia com a carga produzida pela preparação e completa sem pane seca.
 * B. CASO CRÍTICO: cenário de maior demanda (Madri, maior distância/consumo), maior número de voltas (Mônaco) e maior distância total.
 * C. CARGA EXPLÍCITA: startingFuelKg válido preservado sem sobrescrita silenciosa; rejeição de > 110 kg.
 * D. INSUFICIÊNCIA INTENCIONAL: carga insuficiente aciona CANONICAL_DNF_REASON_OUT_OF_FUEL, sem reabastecimento mágico.
 * E. CONSERVAÇÃO E PERSISTÊNCIA: consumo 1x por volta; save/reload preserva; suspensão por bandeira vermelha congela consumo.
 * F. LIMITE DA CHEGADA: ordem canônica de consumo, encerramento de corrida e preservação do resultado final.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { F1_2026_CALENDAR } from '../lib/f1-data'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'
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
import type { FinalQualifyingGridEntry } from '../types/canonical-qualifying-types'
import type { TireSetItem } from '../types/f1'

function createFullTestGrid(): FinalQualifyingGridEntry[] {
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
        driverName: `Driver ${pos} (${teamId})`,
        teamId,
        teamName: `Team ${teamId}`,
        teamColor: '#ff1801',
        carId: isPlayer ? (carIdx === 1 ? 'car1' : 'car2') : undefined,
        isPlayer,
        eliminationStage: 'Q3',
        bestLapSec: 78.5,
        bestLapTime: '1:18.500',
        bestLapCompound: 'medio',
      })
      pos++
    }
  }
  return grid
}

function createDummyInventory(driverId: string): TireSetItem[] {
  return [
    {
      id: `set_soft_${driverId}`,
      tyreSetId: `set_soft_${driverId}`,
      compound: 'macio',
      wear: 10,
      lapsUsed: 2,
      isFitted: false,
      status: 'disponivel',
    },
    {
      id: `set_med_${driverId}`,
      tyreSetId: `set_med_${driverId}`,
      compound: 'medio',
      wear: 5,
      lapsUsed: 1,
      isFitted: true,
      status: 'instalado',
    },
    {
      id: `set_hard_${driverId}`,
      tyreSetId: `set_hard_${driverId}`,
      compound: 'duro',
      wear: 0,
      lapsUsed: 0,
      isFitted: false,
      status: 'disponivel',
    },
  ]
}

describe('FUEL-AUTONOMY-08A — Validação de Autonomia e Preparação de Combustível', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // =========================================================================
  // 1. ANÁLISE DO CALENDÁRIO ATIVO & IDENTIFICAÇÃO DO CASO CRÍTICO
  // =========================================================================
  it('08A-CALENDAR: Identifica casos críticos de voltas, extensão e demanda no calendário 2026', () => {
    expect(F1_2026_CALENDAR.length).toBe(24)

    let maxLapsGp = F1_2026_CALENDAR[0]
    let maxDistanceGp = F1_2026_CALENDAR[0]
    let maxFuelDemandGp = F1_2026_CALENDAR[0]
    let maxFuelDemand = 0
    let maxDistanceKm = 0

    for (const gp of F1_2026_CALENDAR) {
      const distance = calculateRaceDistanceKm(gp.laps, gp.circuitLengthKm)
      const fuelRequired = calculateRequiredStartingFuelKg(gp.laps, gp.circuitLengthKm, 1.0)

      if (gp.laps > maxLapsGp.laps) {
        maxLapsGp = gp
      }
      if (distance > maxDistanceKm) {
        maxDistanceKm = distance
        maxDistanceGp = gp
      }
      if (fuelRequired > maxFuelDemand) {
        maxFuelDemand = fuelRequired
        maxFuelDemandGp = gp
      }
    }

    // Prova 1: Prova de maior número de voltas é Mônaco (78 voltas)
    expect(maxLapsGp.circuit).toContain('Mônaco')
    expect(maxLapsGp.laps).toBe(78)

    // Prova 2: Prova de maior demanda e maior distância no calendário ativo é Madri (Round 16, 66 laps * 5.474 km = 361.284 km)
    expect(maxDistanceGp.round).toBe(16)
    expect(maxFuelDemandGp.round).toBe(16)
    expect(maxFuelDemand).toBeCloseTo(109.3852, 3)

    // Todas as 24 etapas exigem carga <= 110 kg
    expect(maxFuelDemand).toBeLessThanOrEqual(TANK_CAPACITY_KG)
  })

  // =========================================================================
  // TESTE A: PREPARAÇÃO PADRÃO (PROVA REPRESENTATIVA)
  // =========================================================================
  it('08A-TEST-A: Prova representativa inicia via canonicalRacePreparationService e completa sem pane seca', () => {
    const round = 1 // Albert Park, Austrália (58 voltas, 5.278 km)
    const calGp = F1_2026_CALENDAR.find((g) => g.round === round)!
    const grid = createFullTestGrid()
    const inventories = {
      drv_team_audi_1: createDummyInventory('drv_team_audi_1'),
      drv_team_audi_2: createDummyInventory('drv_team_audi_2'),
    }

    // 1. Preparação padrão criada pelo serviço
    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'career_fuel_08a_a',
      seasonYear: 2026,
      round,
      teamId: 'team_audi',
      totalLaps: calGp.laps,
      grid,
      inventories,
    })

    // Confirmar que a preparação padrão produz combustível compatível com a demanda da prova
    const expectedRequired = calculateRequiredStartingFuelKg(calGp.laps, calGp.circuitLengthKm, 1.0)
    expect(snapshot.cars[0].startingFuelKg).toBeCloseTo(expectedRequired, 3)
    expect(snapshot.cars[1].startingFuelKg).toBeCloseTo(expectedRequired, 3)

    // 2. Inicialização canônica oficial
    let raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_fuel_08a_a',
      season: 2026,
      round,
      circuitName: calGp.circuit,
      circuitCountry: calGp.country,
      circuitLengthKm: calGp.circuitLengthKm,
      totalLaps: calGp.laps,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: {
          startingFuelKg: snapshot.cars[0].startingFuelKg,
          startingCompound: snapshot.cars[0].startingCompound,
        },
        car2: {
          startingFuelKg: snapshot.cars[1].startingFuelKg,
          startingCompound: snapshot.cars[1].startingCompound,
        },
      },
      persistState: false,
    })

    const initialFuelCar1 = raceState.drivers.find((d) => d.carId === 'car1')!.fuel
    const initialFuelCar2 = raceState.drivers.find((d) => d.carId === 'car2')!.fuel
    const initialFuelAi = raceState.drivers.find((d) => !d.isPlayer)!.fuel

    expect(initialFuelCar1).toBeCloseTo(expectedRequired, 3)
    expect(initialFuelCar2).toBeCloseTo(expectedRequired, 3)
    expect(initialFuelAi).toBeCloseTo(expectedRequired, 3)

    // 3. Avançar a prova completa
    for (let lap = 1; lap <= calGp.laps; lap++) {
      raceState = canonicalRaceEngineService.advanceOneLap(raceState, { persistState: false })
      if (raceState.status === 'completed') break
    }

    expect(raceState.status).toBe('completed')

    // Verificar se nenhum carro teve DNF por OUT_OF_FUEL
    const car1 = raceState.drivers.find((d) => d.carId === 'car1')!
    const car2 = raceState.drivers.find((d) => d.carId === 'car2')!

    expect(car1.raceStatus).not.toBe('dnf')
    expect(car1.dnfReason).not.toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)
    expect(car1.fuel).toBeGreaterThanOrEqual(0.5) // reserva mínima preservada

    expect(car2.raceStatus).not.toBe('dnf')
    expect(car2.dnfReason).not.toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)
    expect(car2.fuel).toBeGreaterThanOrEqual(0.5)

    // Todos os pilotos que completaram tiveram combustível positivo
    for (const d of raceState.drivers) {
      if (d.raceStatus === 'finished') {
        expect(d.fuel).toBeGreaterThanOrEqual(0)
      }
    }
  })

  // =========================================================================
  // TESTE B: CASO CRÍTICO (MADRI — MAIOR DISTÂNCIA E DEMANDA)
  // =========================================================================
  it('08A-TEST-B: Caso crítico (Madri, R16) inicia com a preparação padrão e completa a prova', () => {
    const round = 16 // Madri: 66 voltas, 5.474 km
    const calGp = F1_2026_CALENDAR.find((g) => g.round === round)!
    const grid = createFullTestGrid()
    const inventories = {
      drv_team_audi_1: createDummyInventory('drv_team_audi_1'),
      drv_team_audi_2: createDummyInventory('drv_team_audi_2'),
    }

    const snapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'career_fuel_08a_b',
      seasonYear: 2026,
      round,
      teamId: 'team_audi',
      totalLaps: calGp.laps,
      grid,
      inventories,
    })

    const criticalRequired = calculateRequiredStartingFuelKg(calGp.laps, calGp.circuitLengthKm, 1.0)
    expect(snapshot.cars[0].startingFuelKg).toBeCloseTo(criticalRequired, 3)
    expect(snapshot.cars[0].startingFuelKg).toBeLessThanOrEqual(TANK_CAPACITY_KG)

    let raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_fuel_08a_b',
      season: 2026,
      round,
      circuitName: calGp.circuit,
      circuitCountry: calGp.country,
      circuitLengthKm: calGp.circuitLengthKm,
      totalLaps: calGp.laps,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: { startingFuelKg: snapshot.cars[0].startingFuelKg },
        car2: { startingFuelKg: snapshot.cars[1].startingFuelKg },
      },
      persistState: false,
    })

    const initialFuel = raceState.drivers[0].fuel
    expect(initialFuel).toBeCloseTo(109.3852, 3)

    // Simular as 66 voltas completas
    for (let lap = 1; lap <= calGp.laps; lap++) {
      raceState = canonicalRaceEngineService.advanceOneLap(raceState, { persistState: false })
      if (raceState.status === 'completed') break
    }

    expect(raceState.status).toBe('completed')

    const pCar1 = raceState.drivers.find((d) => d.carId === 'car1')!
    expect(pCar1.isDnf).toBe(false)
    expect(pCar1.dnfReason).toBeUndefined()
    expect(pCar1.fuel).toBeGreaterThanOrEqual(0.5) // reserva
  })

  // =========================================================================
  // TESTE C: CARGA EXPLÍCITA (PRESERVAÇÃO E LIMITES)
  // =========================================================================
  it('08A-TEST-C: Carga explícita válida é preservada e valores > 110 kg sofrem fallback seguro', () => {
    const round = 8 // Mônaco (78 voltas, 3.337 km, required = ~79.08 kg)
    const calGp = F1_2026_CALENDAR.find((g) => g.round === round)!
    const grid = createFullTestGrid()

    // 1. Carga explícita válida (ex: 85 kg)
    const raceExplicit = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_fuel_08a_c1',
      season: 2026,
      round,
      circuitName: calGp.circuit,
      circuitCountry: calGp.country,
      circuitLengthKm: calGp.circuitLengthKm,
      totalLaps: calGp.laps,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: { startingFuelKg: 85.0 },
      },
      persistState: false,
    })

    const c1 = raceExplicit.drivers.find((d) => d.carId === 'car1')!
    expect(c1.fuel).toBe(85.0)

    // 2. Carga explícita excessiva (> 110 kg) deve sofrer fallback para a demanda calculada
    const raceExcessive = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_fuel_08a_c2',
      season: 2026,
      round,
      circuitName: calGp.circuit,
      circuitCountry: calGp.country,
      circuitLengthKm: calGp.circuitLengthKm,
      totalLaps: calGp.laps,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: { startingFuelKg: 130.0 }, // Ilegal (> 110)
      },
      persistState: false,
    })

    const c1Excessive = raceExcessive.drivers.find((d) => d.carId === 'car1')!
    const expectedMonaco = calculateRequiredStartingFuelKg(78, 3.337, 1.0)
    expect(c1Excessive.fuel).toBeCloseTo(expectedMonaco, 3)
    expect(c1Excessive.fuel).not.toBe(130.0)
  })

  // =========================================================================
  // TESTE D: INSUFICIÊNCIA INTENCIONAL & OUT_OF_FUEL CANÔNICO
  // =========================================================================
  it('08A-TEST-D: Carga insuficiente deliberada resulta em DNF OUT_OF_FUEL sem combustível mágico', () => {
    const round = 1
    const calGp = F1_2026_CALENDAR.find((g) => g.round === round)!
    const grid = createFullTestGrid()

    // Carga intencionalmente minúscula: 3 kg em prova de 58 voltas (Albert Park consome ~1.58 kg/volta)
    let raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_fuel_08a_d',
      season: 2026,
      round,
      circuitName: calGp.circuit,
      circuitCountry: calGp.country,
      circuitLengthKm: calGp.circuitLengthKm,
      totalLaps: calGp.laps,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: { startingFuelKg: 3.0 },
      },
      persistState: false,
    })

    const car1Before = raceState.drivers.find((d) => d.carId === 'car1')!
    expect(car1Before.fuel).toBe(3.0)

    // Volta 1: consome ~1.58 kg -> resta ~1.42 kg
    raceState = canonicalRaceEngineService.advanceOneLap(raceState, { persistState: false })
    const car1Lap1 = raceState.drivers.find((d) => d.carId === 'car1')!
    expect(car1Lap1.raceStatus).toBe('racing')
    expect(car1Lap1.fuel).toBeLessThan(3.0)
    expect(car1Lap1.fuel).toBeGreaterThan(0)

    // Volta 2: restante (~1.42 kg) é menor que o consumo (~1.58 kg) -> combustível esgota (0) e DNF OUT_OF_FUEL
    raceState = canonicalRaceEngineService.advanceOneLap(raceState, { persistState: false })
    const car1Lap2 = raceState.drivers.find((d) => d.carId === 'car1')!

    expect(car1Lap2.fuel).toBe(0)
    expect(car1Lap2.raceStatus).toBe('dnf')
    expect(car1Lap2.isDnf).toBe(true)
    expect(car1Lap2.dnfReason).toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)

    // Volta 3: Avançar mais uma volta não pode ressuscitar o carro nem reabastecê-lo silenciosamente
    raceState = canonicalRaceEngineService.advanceOneLap(raceState, { persistState: false })
    const car1Lap3 = raceState.drivers.find((d) => d.carId === 'car1')!

    expect(car1Lap3.fuel).toBe(0)
    expect(car1Lap3.raceStatus).toBe('dnf')
    expect(car1Lap3.dnfReason).toBe(CANONICAL_DNF_REASON_OUT_OF_FUEL)
    expect(car1Lap3.lap).toBe(car1Lap2.lap) // Carro parado na pista
  })

  // =========================================================================
  // TESTE E: CONSERVAÇÃO, PERSISTÊNCIA E SUSPENSÃO (BANDEIRA VERMELHA)
  // =========================================================================
  it('08A-TEST-E: Consumo é aplicado 1x por avanço, save/reload preserva combustível e suspensão congela queima', () => {
    const round = 10 // Silverstone
    const calGp = F1_2026_CALENDAR.find((g) => g.round === round)!
    const grid = createFullTestGrid()

    let raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_fuel_08a_e',
      season: 2026,
      round,
      circuitName: calGp.circuit,
      circuitCountry: calGp.country,
      circuitLengthKm: calGp.circuitLengthKm,
      totalLaps: calGp.laps,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid,
      persistState: false,
    })

    const initialFuel = raceState.drivers[0].fuel
    const lapBurnExpected = calculateLapFuelBurnKg(calGp.circuitLengthKm, 1.0)

    // 1. Avançar exatamente 1 volta
    raceState = canonicalRaceEngineService.advanceOneLap(raceState, { persistState: false })
    const fuelAfter1Lap = raceState.drivers[0].fuel
    const burnObserved = initialFuel - fuelAfter1Lap
    expect(burnObserved).toBeCloseTo(lapBurnExpected, 1)

    // 2. Persistência: salvar e carregar preserva o combustível exato
    raceState.careerId = 'career_fuel_08a_e'
    raceState.season = 2026
    raceState.round = round
    raceState.raceVariant = 'MAIN_RACE'
    const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(raceState)
    expect(saveRes.success).toBe(true)

    const reloaded = canonicalRaceSaveService.loadCanonicalRaceState(
      'career_fuel_08a_e',
      2026,
      round,
      'MAIN_RACE',
    )
    expect(reloaded.state).not.toBeNull()
    const reloadedFuel = reloaded.state!.drivers[0].fuel
    expect(reloadedFuel).toBe(fuelAfter1Lap)

    // 3. Suspensão / Red Flag: consumo congelado
    const redFlagState = canonicalRaceEngineService.triggerRedFlag(raceState, {
      persistState: false,
    })
    expect(redFlagState.status).toBe('suspended')

    const fuelBeforeTick = redFlagState.drivers[0].fuel
    const suspendedTicked = canonicalRaceEngineService.advanceOneLap(redFlagState, {
      persistState: false,
    })
    expect(suspendedTicked.drivers[0].fuel).toBe(fuelBeforeTick)
  })

  // =========================================================================
  // TESTE F: LIMITE DA CHEGADA E ORDEM CANÔNICA DE CONCLUSÃO
  // =========================================================================
  it('08A-TEST-F: Preserva a ordem canônica entre consumo, conclusão e encerramento sem duplo consumo', () => {
    const round = 1
    const calGp = F1_2026_CALENDAR.find((g) => g.round === round)!
    const grid = createFullTestGrid()

    // Configurar uma corrida de 3 voltas para testar a chegada na linha final
    let raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'career_fuel_08a_f',
      season: 2026,
      round,
      circuitName: calGp.circuit,
      circuitCountry: calGp.country,
      circuitLengthKm: calGp.circuitLengthKm,
      totalLaps: 3,
      playerTeamId: 'team_audi',
      canonicalQualifyingGrid: grid,
      carPreparations: {
        car1: { startingFuelKg: 10.0 },
      },
      persistState: false,
    })

    // Volta 1
    raceState = canonicalRaceEngineService.advanceOneLap(raceState, { persistState: false })
    expect(raceState.status).toBe('in_progress')

    // Volta 2
    raceState = canonicalRaceEngineService.advanceOneLap(raceState, { persistState: false })
    expect(raceState.status).toBe('in_progress')

    // Volta 3 (bandeirada final)
    raceState = canonicalRaceEngineService.advanceOneLap(raceState, { persistState: false })
    expect(raceState.status).toBe('completed')

    const finishedCar1 = raceState.drivers.find((d) => d.carId === 'car1')!
    expect(finishedCar1.raceStatus).toBe('finished')
    expect(finishedCar1.lap).toBe(3)
    const finalFuel = finishedCar1.fuel

    // Tentar avançar além da prova concluída não pode re-consumir combustível nem mudar status
    raceState = canonicalRaceEngineService.advanceOneLap(raceState, { persistState: false })
    const car1AfterExtra = raceState.drivers.find((d) => d.carId === 'car1')!
    expect(car1AfterExtra.fuel).toBe(finalFuel)
    expect(car1AfterExtra.raceStatus).toBe('finished')
    expect(car1AfterExtra.isDnf).toBe(false)
  })
})
