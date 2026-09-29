import { describe, it, expect } from 'vitest'
import { PracticeSessionRunner, type PracticeTickContext } from '@/services/canonicalPracticeRunner'
import type { PracticeSessionRecordState } from '@/types/practice-session'
import raceQualifyingOrchestratorService from '@/services/raceQualifyingOrchestratorService'
const { calculateQualifyingRatingDeltaMs } = raceQualifyingOrchestratorService

describe('RACE-PROVENANCE-AUDIT-02A1 Probes', () => {
  it('A. TL2 / Pneus: prova de desgaste e tyreAge em TL2 com composto MEDIUM', () => {
    const initialState: PracticeSessionRecordState = {
      careerId: 'test_career',
      seasonId: '2026',
      round: 1,
      sessionType: 'tp2',
      status: 'running',
      sessionDurationSec: 3600,
      elapsedTimeSec: 0,
      timeRemainingSec: 3600,
      simSpeed: 1,
      cars: {
        car1: {
          carId: 'car1',
          driverId: 'drv_1',
          driverName: 'Piloto Teste',
          status: 'flying_lap',
          pitRequested: false,
          program: 'car_setup',
          setup: {
            frontWing: 10,
            rearWing: 10,
            suspension: 10,
            differential: 10,
          },
          currentTyreSetId: 'drv_1_medio_1',
          currentCompound: 'medio',
          tyreWear: 0,
          fuelKg: 30,
          lapsInStint: 0,
          totalLaps: 0,
          currentLapProgressPct: 99.9,
        },
        car2: {
          carId: 'car2',
          driverId: 'drv_2',
          driverName: 'Piloto 2',
          status: 'garage',
          pitRequested: false,
          program: 'car_setup',
          setup: {
            frontWing: 10,
            rearWing: 10,
            suspension: 10,
            differential: 10,
          },
          currentTyreSetId: 'drv_2_medio_1',
          currentCompound: 'medio',
          tyreWear: 0,
          fuelKg: 30,
          lapsInStint: 0,
          totalLaps: 0,
          currentLapProgressPct: 0,
        },
      },
      stints: [
        {
          id: 'stint_car1_1',
          driverId: 'drv_1',
          carId: 'car1',
          program: 'car_setup',
          setupSnapshot: {
            frontWing: 10,
            rearWing: 10,
            suspension: 10,
            differential: 10,
          },
          tyreSetId: 'drv_1_medio_1',
          compound: 'medio',
          initialFuelKg: 30,
          initialWear: 0,
          lapsCount: 0,
          laps: [],
          startedAt: new Date().toISOString(),
          status: 'active',
        },
      ],
      lapHistory: {},
      leaderboard: [],
      radioFeed: [],
      feedbacks: [],
      knowledge: {
        frontWing: {
          minKnown: 0,
          maxKnown: 20,
          confidence: 'baixa',
          confidenceScore: 0,
          revealed: false,
        },
        rearWing: {
          minKnown: 0,
          maxKnown: 20,
          confidence: 'baixa',
          confidenceScore: 0,
          revealed: false,
        },
        suspension: {
          minKnown: 0,
          maxKnown: 20,
          confidence: 'baixa',
          confidenceScore: 0,
          revealed: false,
        },
        differential: {
          minKnown: 0,
          maxKnown: 20,
          confidence: 'baixa',
          confidenceScore: 0,
          revealed: false,
        },
        overallConfidence: 'baixa',
        totalStintsAnalyzed: 0,
        updatedAt: new Date().toISOString(),
      },
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    initialState.cars.car1.currentStintId = 'stint_car1_1'

    const context: PracticeTickContext = {
      round: 1,
      weather: 'dry',
      tireAbrasiveness: 3,
      trackEvolution: 50,
      lengthKm: 5.3,
      teamName: 'Audi Test Team',
      teamColor: '#C0C0C0',
      teamChassisRating: 80,
      teamEngineSupplier: 'Audi',
      drivers: [
        {
          id: 'drv_1',
          name: 'Piloto Teste',
          speed: 80,
          consistency: 80,
          defense: 80,
          morale: 80,
          physical_condition: 90,
          technical_feedback: 80,
        },
      ],
    }

    // Estado inicial
    const initialTyreWear = initialState.cars.car1.tyreWear
    const initialLaps = initialState.cars.car1.totalLaps

    // Tick que completa 1 volta rápida
    const tickResult1 = PracticeSessionRunner.tick(initialState, 2, context)
    const carAfterLap1 = tickResult1.nextState.cars.car1

    // Configura para completar mais 1 volta rápida (N voltas > 1)
    carAfterLap1.currentLapProgressPct = 99.9
    const tickResult2 = PracticeSessionRunner.tick(tickResult1.nextState, 2, context)
    const carAfterLap2 = tickResult2.nextState.cars.car1

    // Comprovando comportamento no modelo do runner vs tyreAge:
    // 1. PracticeCarLiveState possui tyreWear e lapsInStint/totalLaps, MAS NÃO possui campo 'tyreAge' (tyreAge só existe no modelo de corrida RaceDriverLiveState / canonicalRaceEngineService drv.tyreAge)
    expect((carAfterLap2 as any).tyreAge).toBeUndefined()
    expect(carAfterLap2.totalLaps).toBe(2)
    expect(carAfterLap2.tyreWear).toBeGreaterThan(initialTyreWear)

    // Log para fins de auditoria
    console.log('AUDIT_FIXTURE_A:', {
      sessionType: initialState.sessionType,
      compound: carAfterLap2.currentCompound,
      initialWear: initialTyreWear,
      wearAfterLap1: carAfterLap1.tyreWear,
      wearAfterLap2: carAfterLap2.tyreWear,
      initialLaps,
      finalLaps: carAfterLap2.totalLaps,
      hasTyreAgeField: 'tyreAge' in carAfterLap2,
    })
  })

  it('B. Spread 2500 ms: prova de fixture controlada sem ruído', () => {
    // Rating mínimo = 60, máximo = 100, spread estrutural = 2500 ms
    const minRating = 60
    const maxRating = 100
    const targetSpreadMs = 2500

    const bestDelta = calculateQualifyingRatingDeltaMs(100, minRating, maxRating, targetSpreadMs)
    const midDelta = calculateQualifyingRatingDeltaMs(80, minRating, maxRating, targetSpreadMs)
    const worstDelta = calculateQualifyingRatingDeltaMs(60, minRating, maxRating, targetSpreadMs)

    expect(bestDelta).toBe(0)
    expect(midDelta).toBe(1250)
    expect(worstDelta).toBe(2500)

    console.log('AUDIT_FIXTURE_B:', {
      targetSpreadMs,
      bestDelta,
      midDelta,
      worstDelta,
      isSpreadExact: worstDelta - bestDelta === 2500,
    })
  })
})
