import { describe, it, expect } from 'vitest'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { calculateRequiredStartingFuelKg } from '@/services/canonicalFuelModel'
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
    ]
  }
  return inv
}

describe('PROVA DE INTEGRAÇÃO REAL: Madri preparação padrão -> confirmação -> inicialização', () => {
  it('Exercita o encadeamento real de Madri para verificar a carga que chega aos dois carros do jogador', () => {
    // Madri é Round 16, 66 voltas, circuitLengthKm = 5.474 km
    const madridRound = 16
    const madridGp = F1_2026_CALENDAR.find((g) => g.round === madridRound)!
    expect(madridGp).toBeDefined()
    const totalLaps = madridGp.laps // 66

    const requiredFuel = calculateRequiredStartingFuelKg(totalLaps, madridGp.circuitLengthKm, 1.0)
    expect(requiredFuel).toBeCloseTo(109.3852, 2)

    const playerTeamId = 'team_audi'
    const grid = build24Grid(playerTeamId)
    const inventories = buildInventories(grid)

    // 1. Criar preparação padrão para Madri (sem escolha manual de combustível)
    const prepSnapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId: 'test_career_madrid',
      seasonYear: 2026,
      round: madridRound,
      teamId: playerTeamId,
      totalLaps,
      grid,
      inventories,
    })

    const car1Prep = prepSnapshot.cars[0]
    const car2Prep = prepSnapshot.cars[1]

    // 2. Confirmar preparação (como na UI)
    car1Prep.confirmed = true
    car2Prep.confirmed = true
    prepSnapshot.allConfirmed = true

    // Map de preparações passado ao inicializador oficial
    const carPreparations: Record<string, PreparedCarState> = {
      [car1Prep.driverId]: car1Prep,
      [car2Prep.driverId]: car2Prep,
      [car1Prep.carId]: car1Prep,
      [car2Prep.carId]: car2Prep,
    }

    // 3. Inicializar a corrida pelo caminho oficial
    const raceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'test_career_madrid',
      season: 2026,
      round: madridRound,
      circuitName: madridGp.circuit,
      circuitCountry: madridGp.country,
      circuitLengthKm: madridGp.circuitLengthKm,
      totalLaps,
      playerTeamId,
      canonicalQualifyingGrid: grid,
      carPreparations,
      persistState: false,
    })

    const pCar1 = raceState.drivers.find((d) => d.driverId === car1Prep.driverId)!
    const pCar2 = raceState.drivers.find((d) => d.driverId === car2Prep.driverId)!

    expect(pCar1).toBeDefined()
    expect(pCar2).toBeDefined()

    // O teste verifica a carga que chega aos dois carros:
    // Se Cenário A: car1Prep.startingFuelKg era 100 kg e sobrescreveu com 100 kg
    // Se Cenário B: derivou via calculateRequiredStartingFuelKg (~109.39 kg)
    console.log('CAR1 PREP FUEL:', car1Prep.startingFuelKg)
    console.log('CAR2 PREP FUEL:', car2Prep.startingFuelKg)
    console.log('CAR1 INIT FUEL:', pCar1.fuel)
    console.log('CAR2 INIT FUEL:', pCar2.fuel)

    expect(car1Prep.startingFuelKg).toBeCloseTo(requiredFuel, 2)
    expect(car2Prep.startingFuelKg).toBeCloseTo(requiredFuel, 2)
    expect(pCar1.fuel).toBeCloseTo(requiredFuel, 2)
    expect(pCar2.fuel).toBeCloseTo(requiredFuel, 2)
  })
})
