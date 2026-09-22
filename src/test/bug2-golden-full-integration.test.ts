import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRacePreparationService } from '@/services/canonicalRacePreparationService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import { raceStrategyService } from '@/services/raceStrategyService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { TireSetItem } from '@/types/f1'

describe('BUG-02 GOLDEN FULL INTEGRATION — Ponta a Ponta: TL -> Qualificação -> Estratégia de Corrida -> Race Start -> Save/Reload', () => {
  const careerId = 'career_golden_full_bug2'
  const seasonYear = 2026
  const round = 1
  const teamId = 'team_audi'
  const totalLaps = 57

  const driver1 = {
    id: 'drv_audi_1',
    name: 'Nico Hülkenberg',
    teamId,
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    carNumber: 27,
  }

  const driver2 = {
    id: 'drv_audi_2',
    name: 'Gabriel Bortoleto',
    teamId,
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    carNumber: 5,
  }

  beforeEach(() => {
    localStorage.clear()
  })

  it('Executa o ciclo completo de um fim de semana garantindo a passagem obrigatória pela Estratégia de Corrida pré-largada', () => {
    // 1. Inventário Físico do fim de semana
    const inventories: Record<string, TireSetItem[]> = {
      [driver1.id]: [
        {
          id: 'set_hulk_m2',
          driverId: driver1.id,
          compound: 'medio',
          wear: 10,
          lapsUsed: 5,
          isFitted: true,
          status: 'usado',
        },
        {
          id: 'set_hulk_h1',
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
          id: 'set_bort_s4',
          driverId: driver2.id,
          compound: 'macio',
          wear: 15,
          lapsUsed: 4,
          isFitted: true,
          status: 'usado',
        },
        {
          id: 'set_bort_m2',
          driverId: driver2.id,
          compound: 'medio',
          wear: 0,
          lapsUsed: 0,
          isFitted: false,
          status: 'disponivel',
        },
        {
          id: 'set_bort_h1',
          driverId: driver2.id,
          compound: 'duro',
          wear: 0,
          lapsUsed: 0,
          isFitted: false,
          status: 'disponivel',
        },
      ],
    }

    // 2. Simulação de Qualificação e Grid Oficial P1..P24 do BUG-04
    const canonicalGrid: FinalQualifyingGridEntry[] = []
    for (let pos = 1; pos <= 22; pos++) {
      canonicalGrid.push({
        gridPosition: pos,
        driverId: `drv_rival_${pos}`,
        driverName: `Rival ${pos}`,
        teamId: `team_${Math.ceil(pos / 2)}`,
        teamName: `Team ${Math.ceil(pos / 2)}`,
        teamColor: '#475569',
        isPlayer: false,
        eliminationStage: pos > 10 ? (pos > 18 ? 'Q1' : 'Q2') : 'Q3',
        bestLapSec: 81.0 + pos * 0.05,
        bestLapTime: `1:21.${pos.toString().padStart(3, '0')}`,
        bestLapCompound: 'macio',
      })
    }

    canonicalGrid.push({
      gridPosition: 23,
      driverId: driver1.id,
      driverName: driver1.name,
      teamId,
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayer: true,
      carId: 'car1',
      eliminationStage: 'Q1',
      bestLapSec: 82.2,
      bestLapTime: '1:22.200',
      bestLapCompound: 'medio',
    })

    canonicalGrid.push({
      gridPosition: 24,
      driverId: driver2.id,
      driverName: driver2.name,
      teamId,
      teamName: 'Audi F1 Team',
      teamColor: '#E10600',
      isPlayer: true,
      carId: 'car2',
      eliminationStage: 'Q1',
      bestLapSec: 82.5,
      bestLapTime: '1:22.500',
      bestLapCompound: 'macio',
    })

    // 3. ETAPA DE ESTRATÉGIA PRÉ-CORRIDA
    // Cria snapshot inicial
    const prepSnapshot = canonicalRacePreparationService.createInitialSnapshot({
      careerId,
      seasonYear,
      round,
      teamId,
      totalLaps,
      grid: canonicalGrid,
      inventories,
    })

    expect(prepSnapshot.schemaVersion).toBe('race-prep-v1')
    expect(prepSnapshot.allConfirmed).toBe(false)

    // Configura Carro 1 com Medium #2 (10% de desgaste), 95 kg, 1 parada
    prepSnapshot.cars[0].startingTyreSetId = 'set_hulk_m2'
    prepSnapshot.cars[0].startingCompound = 'medio'
    prepSnapshot.cars[0].initialTyreWear = 10
    prepSnapshot.cars[0].initialTyreLapsUsed = 5
    prepSnapshot.cars[0].startingFuelKg = 95
    prepSnapshot.cars[0].strategyPlan = {
      carId: 'car1',
      stints: [
        { stintNumber: 1, compound: 'medio', targetPitLap: 27 },
        { stintNumber: 2, compound: 'duro', targetPitLap: 57 },
      ],
    }
    prepSnapshot.cars[0].confirmed = true

    // Configura Carro 2 com Soft #4 (15% de desgaste), 101 kg, 2 paradas
    prepSnapshot.cars[1].startingTyreSetId = 'set_bort_s4'
    prepSnapshot.cars[1].startingCompound = 'macio'
    prepSnapshot.cars[1].initialTyreWear = 15
    prepSnapshot.cars[1].initialTyreLapsUsed = 4
    prepSnapshot.cars[1].startingFuelKg = 101
    prepSnapshot.cars[1].strategyPlan = {
      carId: 'car2',
      stints: [
        { stintNumber: 1, compound: 'macio', targetPitLap: 16 },
        { stintNumber: 2, compound: 'medio', targetPitLap: 38 },
        { stintNumber: 3, compound: 'duro', targetPitLap: 57 },
      ],
    }
    prepSnapshot.cars[1].confirmed = true

    // Persiste preparação
    canonicalRacePreparationService.saveSnapshot(prepSnapshot)

    // Validação de persistência e sobrevivência a reload
    const reloadedPrep = canonicalRacePreparationService.loadSnapshot(careerId, seasonYear, round)
    expect(reloadedPrep?.allConfirmed).toBe(true)
    expect(reloadedPrep?.cars[0].startingFuelKg).toBe(95)
    expect(reloadedPrep?.cars[1].startingFuelKg).toBe(101)

    // 4. INICIALIZAÇÃO DA CORRIDA CANÔNICA
    const carPreparations = {
      car1: {
        startingTyreSetId: reloadedPrep!.cars[0].startingTyreSetId,
        startingCompound: reloadedPrep!.cars[0].startingCompound,
        startingFuelKg: reloadedPrep!.cars[0].startingFuelKg,
        initialTyreWear: reloadedPrep!.cars[0].initialTyreWear,
        initialTyreLapsUsed: reloadedPrep!.cars[0].initialTyreLapsUsed,
        strategyPlan: reloadedPrep!.cars[0].strategyPlan,
      },
      car2: {
        startingTyreSetId: reloadedPrep!.cars[1].startingTyreSetId,
        startingCompound: reloadedPrep!.cars[1].startingCompound,
        startingFuelKg: reloadedPrep!.cars[1].startingFuelKg,
        initialTyreWear: reloadedPrep!.cars[1].initialTyreWear,
        initialTyreLapsUsed: reloadedPrep!.cars[1].initialTyreLapsUsed,
        strategyPlan: reloadedPrep!.cars[1].strategyPlan,
      },
    }

    const liveRace = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId,
      season: seasonYear,
      round,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps,
      playerTeamId: teamId,
      canonicalQualifyingGrid: canonicalGrid,
      carPreparations,
    })

    const rCar1 = liveRace.drivers.find((d) => d.driverId === driver1.id)!
    const rCar2 = liveRace.drivers.find((d) => d.driverId === driver2.id)!

    // Conferência exata de largada
    expect(rCar1.gridPosition).toBe(23)
    expect(rCar1.fuel).toBe(95)
    expect(rCar1.tyreCompound).toBe('medio')
    expect(rCar1.tyreSetId).toBe('set_hulk_m2')
    expect(rCar1.initialTyreWear).toBe(10)
    expect(rCar1.tyreAge).toBe(5)

    expect(rCar2.gridPosition).toBe(24)
    expect(rCar2.fuel).toBe(101)
    expect(rCar2.tyreCompound).toBe('macio')
    expect(rCar2.tyreSetId).toBe('set_bort_s4')
    expect(rCar2.initialTyreWear).toBe(15)
    expect(rCar2.tyreAge).toBe(4)

    // 5. SALVAR E RELOAD DA CORRIDA EM ANDAMENTO
    canonicalRaceSaveService.saveCanonicalRaceState(liveRace)
    const reloadedRace = canonicalRaceSaveService.loadCanonicalRaceState(
      careerId,
      seasonYear,
      round,
    )
    expect(reloadedRace.state).not.toBeNull()

    const relCar1 = reloadedRace.state?.drivers.find((d) => d.driverId === driver1.id)!
    const relCar2 = reloadedRace.state?.drivers.find((d) => d.driverId === driver2.id)!

    expect(relCar1.gridPosition).toBe(23)
    expect(relCar1.fuel).toBe(95)
    expect(relCar1.tyreSetId).toBe('set_hulk_m2')

    expect(relCar2.gridPosition).toBe(24)
    expect(relCar2.fuel).toBe(101)
    expect(relCar2.tyreSetId).toBe('set_bort_s4')
  })
})
