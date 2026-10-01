import { describe, it, expect } from 'vitest'
import {
  canonicalPaceIntegrationService,
  hashStringToSeed,
} from '@/services/canonicalPaceIntegrationService'
import {
  CanonicalQualifyingRunner,
  type QualifyingDriverContext,
  type QualifyingTickContext,
} from '@/services/canonicalQualifyingRunner'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { calculateTrackFit } from '@/lib/car-session-performance-engine'

describe('SETUP-EFFICIENCY-QUALI-01 — Suíte QSE01 (setupEfficiency no Qualifying)', () => {
  const silverstone = resolveCircuitProfile({ round: 11 })
  const cadEntry = BASELINE_V0_DATA.teams['cadillac'] as any
  const cadTech = cadEntry?.technicalAttributes ?? cadEntry?.carAttributes

  // QSE01-01: setupEfficiency é consumido pelo runner REAL de qualifying
  it('QSE01-01: setupEfficiency é consumido pelo runner REAL de qualifying', () => {
    expect(silverstone).toBeDefined()

    // 1. Verificar computeQualifyingPace com setupEfficiency 80 vs 95
    const paceDefault = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv1',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85, consistency: 85 },
      setupEfficiency: 80,
      noise: 0,
    })

    const paceOptimized = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv1',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85, consistency: 85 },
      setupEfficiency: 95,
      noise: 0,
    })

    expect(paceDefault.breakdown.setupModifier).toBe(0)
    expect(paceOptimized.breakdown.setupModifier).toBeCloseTo((95 - 80) * 0.05, 3) // +0.75 pt
    expect(paceOptimized.effectivePaceScore).toBeGreaterThan(paceDefault.effectivePaceScore)
    expect(paceOptimized.lapTimeSec).toBeLessThan(paceDefault.lapTimeSec)
  })

  // QSE01-02: setup neutro não produz desvio indevido
  it('QSE01-02: setup neutro não produz desvio indevido', () => {
    const paceNeutral = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'lec',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0,
    })

    expect(paceNeutral.breakdown.setupModifier).toBe(0)
  })

  // QSE01-03: setup melhor melhora pace
  it('QSE01-03: setup melhor melhora pace', () => {
    const paceNeutral = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0,
    })

    const paceGood = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 100,
      noise: 0,
    })

    expect(paceGood.breakdown.setupModifier).toBe(1.0) // (100 - 80) * 0.05 = 1.0 pt
    expect(paceGood.effectivePaceScore).toBe(paceNeutral.effectivePaceScore + 1.0)
    expect(paceGood.lapTimeSec).toBeLessThan(paceNeutral.lapTimeSec)
  })

  // QSE01-04: setup pior piora pace
  it('QSE01-04: setup pior piora pace', () => {
    const paceNeutral = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mclaren',
      driverId: 'nor',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0,
    })

    const paceBad = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mclaren',
      driverId: 'nor',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 60,
      noise: 0,
    })

    expect(paceBad.breakdown.setupModifier).toBe(-1.0) // (60 - 80) * 0.05 = -1.0 pt
    expect(paceBad.effectivePaceScore).toBe(paceNeutral.effectivePaceScore - 1.0)
    expect(paceBad.lapTimeSec).toBeGreaterThan(paceNeutral.lapTimeSec)
  })

  // QSE01-05: mesma seed + setups diferentes → diferença de pace corresponde ao setup
  it('QSE01-05: mesma seed + setups diferentes -> diferença de pace corresponde ao setup', () => {
    const fixedSeed = 'seed_qse01_05_fixed_test'

    const runBad = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'redbull',
      driverId: 'ver',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 90 },
      setupEfficiency: 60,
      seed: fixedSeed,
    })

    const runNeutral = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'redbull',
      driverId: 'ver',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 90 },
      setupEfficiency: 80,
      seed: fixedSeed,
    })

    const runGood = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'redbull',
      driverId: 'ver',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 90 },
      setupEfficiency: 100,
      seed: fixedSeed,
    })

    // Com a mesma seed, o ruído RNG é IDÊNTICO nas 3 execuções
    expect(runBad.breakdown.rngModifier).toBe(runNeutral.breakdown.rngModifier)
    expect(runGood.breakdown.rngModifier).toBe(runNeutral.breakdown.rngModifier)

    // A diferença no pace final vem estritamente da diferença nos setups
    const deltaGoodVsNeutral = runGood.effectivePaceScore - runNeutral.effectivePaceScore
    const deltaBadVsNeutral = runBad.effectivePaceScore - runNeutral.effectivePaceScore

    expect(deltaGoodVsNeutral).toBeCloseTo(1.0, 2)
    expect(deltaBadVsNeutral).toBeCloseTo(-1.0, 2)

    // Tempos de volta: GOOD < NEUTRAL < BAD
    expect(runGood.lapTimeSec).toBeLessThan(runNeutral.lapTimeSec)
    expect(runNeutral.lapTimeSec).toBeLessThan(runBad.lapTimeSec)
  })

  // QSE01-06: Structural Strength não muda quando setup muda
  it('QSE01-06: Structural Strength não muda quando setup muda', () => {
    const teamKey = 'astonmartin'
    const initialStructural = structuralStrengthService.getTeamStructuralStrength(teamKey)

    const paceLowSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey,
      driverId: 'alo',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 88 },
      setupEfficiency: 50,
    })

    const paceHighSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey,
      driverId: 'alo',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 88 },
      setupEfficiency: 100,
    })

    const postStructural = structuralStrengthService.getTeamStructuralStrength(teamKey)

    // Força estrutural é imutável perante setup (camada dinâmica)
    expect(paceLowSetup.breakdown.structuralStrength).toBe(
      initialStructural.structuralStrengthScore,
    )
    expect(paceHighSetup.breakdown.structuralStrength).toBe(
      initialStructural.structuralStrengthScore,
    )
    expect(postStructural.structuralStrengthScore).toBe(initialStructural.structuralStrengthScore)
  })

  // QSE01-07: TrackFit não muda quando setup muda
  it('QSE01-07: TrackFit não muda quando setup muda', () => {
    const paceLowSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 50,
    })

    const paceHighSetup = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 100,
    })

    expect(paceLowSetup.breakdown.trackFitModifier).toBe(paceHighSetup.breakdown.trackFitModifier)
  })

  // QSE01-08: RNG não muda quando setup muda com a mesma seed
  it('QSE01-08: RNG não muda quando setup muda com a mesma seed', () => {
    const testSeed = 'seed_qse01_08_identical_rng'

    const pace1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'haas',
      driverId: 'haa-01',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 82 },
      setupEfficiency: 65,
      seed: testSeed,
    })

    const pace2 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'haas',
      driverId: 'haa-01',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 82 },
      setupEfficiency: 95,
      seed: testSeed,
    })

    expect(pace1.breakdown.rngModifier).toBe(pace2.breakdown.rngModifier)
  })

  // QSE01-09: setupEfficiency é aplicado uma única vez
  it('QSE01-09: setupEfficiency é aplicado uma única vez', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'hul',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 90,
      noise: 0,
    })

    const b = pace.breakdown
    expect(b.setupModifier).toBeCloseTo((90 - 80) * 0.05, 3) // 0.5 pt

    // Soma exata de todos os termos da decomposição
    const expectedFinal = Number(
      (
        b.structuralStrength +
        b.trackFitModifier +
        b.setupModifier +
        b.driverEventModifier +
        b.tyreModifier +
        b.fuelModifier +
        b.wearModifier +
        b.weatherModifier +
        b.rngModifier
      ).toFixed(2),
    )

    expect(pace.effectivePaceScore).toBe(expectedFinal)

    // Se setupModifier entrasse uma segunda vez, haveria discrepância
    const doubleSum = Number((expectedFinal + b.setupModifier).toFixed(2))
    expect(pace.effectivePaceScore).not.toBe(doubleSum)
  })

  // QSE01-10: qualifying runner real não ignora setupEfficiency
  it('QSE01-10: qualifying runner real não ignora setupEfficiency', () => {
    // Inicializa dois estágios Q1 com setups diferentes para o Carro 1 do jogador
    const driversList: QualifyingDriverContext[] = [
      { id: 'drv1', name: 'Player Driver 1', speed: 85, consistency: 85, teamId: 'cadillac' },
      { id: 'drv2', name: 'Player Driver 2', speed: 85, consistency: 85, teamId: 'cadillac' },
      { id: 'rival1', name: 'Rival 1', speed: 85, consistency: 85, teamId: 'haas' },
      { id: 'rival2', name: 'Rival 2', speed: 85, consistency: 85, teamId: 'haas' },
    ]

    const stageBad = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: 'season_test_qse10_bad',
      round: 11,
      playerCar1: {
        driverId: 'drv1',
        driverName: 'Player Driver 1',
        tyreSetId: 't1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 5, rearWing: 5, suspension: 5, differential: 50, efficiency: 60 },
      },
      playerCar2: {
        driverId: 'drv2',
        driverName: 'Player Driver 2',
        tyreSetId: 't2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 5, rearWing: 5, suspension: 5, differential: 50, efficiency: 80 },
      },
      eligibleParticipants: driversList,
      persistState: false,
    })

    const stageGood = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: 'season_test_qse10_good',
      round: 11,
      playerCar1: {
        driverId: 'drv1',
        driverName: 'Player Driver 1',
        tyreSetId: 't1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 5, rearWing: 5, suspension: 5, differential: 50, efficiency: 100 },
      },
      playerCar2: {
        driverId: 'drv2',
        driverName: 'Player Driver 2',
        tyreSetId: 't2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 5, rearWing: 5, suspension: 5, differential: 50, efficiency: 80 },
      },
      eligibleParticipants: driversList,
      persistState: false,
    })

    // Ambos os carros saem para a pista
    CanonicalQualifyingRunner.orderCarExitToTrack(stageBad, 'car1')
    CanonicalQualifyingRunner.orderCarExitToTrack(stageGood, 'car1')

    const context: QualifyingTickContext = {
      seasonId: 'season_test_qse10',
      round: 11,
      gpName: 'British Grand Prix',
      circuitName: 'Silverstone',
      lengthKm: 5.891,
      tireAbrasiveness: 3,
      weather: 'seco',
      teamChassisRating: 75,
      teamEngineSupplier: 'Ferrari',
      teamName: 'Cadillac F1 Team',
      teamColor: '#C0C0C0',
      teamId: 'cadillac',
      teamTechnicalAttributes: cadTech,
      drivers: driversList,
      rivalDrivers: driversList.slice(2),
    }

    // Avança simulação até completar voltas (out_lap -> flying_lap -> lap complete)
    // 300 segundos é suficiente para out lap + volta rápida
    stageBad.status = 'running'
    stageGood.status = 'running'

    CanonicalQualifyingRunner.advanceBySeconds(stageBad, 220, context, { persistState: false })
    CanonicalQualifyingRunner.advanceBySeconds(stageGood, 220, context, { persistState: false })

    const badCar1 = stageBad.cars.car1
    const goodCar1 = stageGood.cars.car1

    // Ambos completaram volta rápida
    expect(badCar1.flyingLapsDone).toBeGreaterThan(0)
    expect(goodCar1.flyingLapsDone).toBeGreaterThan(0)
    expect(badCar1.bestLapSec).toBeDefined()
    expect(goodCar1.bestLapSec).toBeDefined()

    // O setup 100 gera tempo significativamente melhor (menor) do que o setup 60
    // Diferença esperada no pace: (100 - 60) * 0.05 = 2.0 pts = ~0.164s
    // Devido ao ruído de ±0.075 * 1.0 pt no runner (±0.075 pt), o setup de 2.0 pts domina com folga
    expect((badCar1.bestLapSec as number) - (goodCar1.bestLapSec as number)).toBeGreaterThan(0.05)
  })
})
