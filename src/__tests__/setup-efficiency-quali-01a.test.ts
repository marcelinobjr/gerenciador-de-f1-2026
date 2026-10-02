import { describe, it, expect } from 'vitest'
import {
  canonicalPaceIntegrationService,
  hashStringToSeed,
} from '@/services/canonicalPaceIntegrationService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'

describe('SETUP-EFFICIENCY-QUALI-01A — Investigação e Prova Canônica de setupEfficiency no Qualifying Pace', () => {
  const silverstone = resolveCircuitProfile({ round: 11 })
  const cadEntry = BASELINE_V0_DATA.teams['cadillac'] as any
  const cadTech = cadEntry?.technicalAttributes ?? cadEntry?.carAttributes
  const fixedDriverAttributes = {
    speed: 85,
    consistency: 85,
    rain: 85,
    morale: 85,
    physicalCondition: 85,
  }

  // SEQ01: Setup ruim pior que neutro (setupEfficiency < 80 gera pace menor e lap time maior)
  it('SEQ01: setup ruim pior que neutro', () => {
    const paceNeutral = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq01',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: fixedDriverAttributes,
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const paceBad = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq01',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: fixedDriverAttributes,
      setupEfficiency: 60,
      noise: 0,
      weather: 'seco',
    })

    expect(paceBad.breakdown.setupModifier).toBeLessThan(paceNeutral.breakdown.setupModifier)
    expect(paceBad.effectivePaceScore).toBeLessThan(paceNeutral.effectivePaceScore)
    expect(paceBad.lapTimeSec).toBeGreaterThan(paceNeutral.lapTimeSec)
    expect(paceBad.breakdown.setupModifier).toBeCloseTo((60 - 80) * 0.05, 3) // -1.0 pt
  })

  // SEQ02: Setup bom melhor que neutro (setupEfficiency > 80 gera pace maior e lap time menor)
  it('SEQ02: setup bom melhor que neutro', () => {
    const paceNeutral = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq02',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: fixedDriverAttributes,
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const paceGood = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq02',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: fixedDriverAttributes,
      setupEfficiency: 95,
      noise: 0,
      weather: 'seco',
    })

    expect(paceGood.breakdown.setupModifier).toBeGreaterThan(paceNeutral.breakdown.setupModifier)
    expect(paceGood.effectivePaceScore).toBeGreaterThan(paceNeutral.effectivePaceScore)
    expect(paceGood.lapTimeSec).toBeLessThan(paceNeutral.lapTimeSec)
    expect(paceGood.breakdown.setupModifier).toBeCloseTo((95 - 80) * 0.05, 3) // +0.75 pt
  })

  // SEQ03: Monotonicidade estrita em múltiplos níveis de setupEfficiency (50 < 70 < 80 < 90 < 100)
  it('SEQ03: monotonicidade', () => {
    const levels = [50, 70, 80, 90, 100]
    const runs = levels.map((eff) =>
      canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'cadillac',
        driverId: 'drv-seq03',
        circuitProfile: silverstone,
        carTechnicalAttributes: cadTech,
        driverAttributes: fixedDriverAttributes,
        setupEfficiency: eff,
        noise: 0,
        weather: 'seco',
      }),
    )

    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].breakdown.setupModifier).toBeGreaterThan(runs[i - 1].breakdown.setupModifier)
      expect(runs[i].effectivePaceScore).toBeGreaterThan(runs[i - 1].effectivePaceScore)
      expect(runs[i].lapTimeSec).toBeLessThan(runs[i - 1].lapTimeSec)
    }
  })

  // SEQ04: Neutro = delta 0 (setupEfficiency = 80 resulta em setupModifier estritamente 0.000)
  it('SEQ04: neutro = delta 0', () => {
    const paceNeutral = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq04',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: fixedDriverAttributes,
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    expect(paceNeutral.breakdown.setupModifier).toBe(0)
  })

  // SEQ05: Mesma seed determinístico (com semente fixa, a diferença de tempo advém puramente de setupEfficiency)
  it('SEQ05: mesma seed determinístico', () => {
    const testSeed = 'seed_seq05_mulberry_deterministic'

    const runNeutral = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq05',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: fixedDriverAttributes,
      setupEfficiency: 80,
      seed: testSeed,
      weather: 'seco',
    })

    const runGood = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq05',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: fixedDriverAttributes,
      setupEfficiency: 100,
      seed: testSeed,
      weather: 'seco',
    })

    // RNG modifier deve ser rigorosamente idêntico sob a mesma seed
    expect(runGood.breakdown.rngModifier).toBe(runNeutral.breakdown.rngModifier)

    // Diferença líquida no pace vem estritamente de setupModifier: (100 - 80) * 0.05 = 1.0 pt
    const paceDiff = runGood.effectivePaceScore - runNeutral.effectivePaceScore
    expect(paceDiff).toBeCloseTo(1.0, 2)
    expect(runGood.lapTimeSec).toBeLessThan(runNeutral.lapTimeSec)
  })

  // SEQ11: Aplicação única (falharia se setupEfficiency fosse duplicado na soma de effectivePaceScore)
  it('SEQ11: aplicação única (falharia se duplicado)', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq11',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: fixedDriverAttributes,
      setupEfficiency: 90,
      noise: 0,
      weather: 'seco',
    })

    const b = pace.breakdown
    expect(b.setupModifier).toBeCloseTo((90 - 80) * 0.05, 3) // 0.500 pt

    // Soma exata dos termos da decomposição canônica
    const expectedSum = Number(
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

    expect(pace.effectivePaceScore).toBe(expectedSum)

    // Se setupEfficiency estivesse aplicado 2x, o effectivePaceScore seria expectedSum + b.setupModifier
    const doubleAppliedPace = Number((expectedSum + b.setupModifier).toFixed(2))
    expect(pace.effectivePaceScore).not.toBe(doubleAppliedPace)
  })

  // SEQ15: Campo ausente = neutro seguro (se setupEfficiency for omitido/undefined, default é 80 = delta 0)
  it('SEQ15: campo ausente = neutro seguro', () => {
    const paceWithDefault = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq15',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: fixedDriverAttributes,
      noise: 0,
      weather: 'seco',
    })

    const paceExplicit80 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq15',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: fixedDriverAttributes,
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    expect(paceWithDefault.breakdown.setupModifier).toBe(0)
    expect(paceWithDefault.effectivePaceScore).toBe(paceExplicit80.effectivePaceScore)
    expect(paceWithDefault.lapTimeSec).toBe(paceExplicit80.lapTimeSec)
  })

  // SEQ16: Sem dependência de teamName/driverName (setupEfficiency produz o exato mesmo modifier independente de equipe ou piloto)
  it('SEQ16: sem dependência de teamName/driverName', () => {
    const teams = ['ferrari', 'mercedes', 'redbull', 'mclaren', 'williams', 'audi', 'cadillac']
    const drivers = ['drv_alpha', 'drv_beta', 'drv_gamma', 'Hamilton', 'Verstappen']

    for (const teamKey of teams) {
      for (const driverId of drivers) {
        const pace = canonicalPaceIntegrationService.computeQualifyingPace({
          teamKey,
          driverId,
          circuitProfile: silverstone,
          carTechnicalAttributes: cadTech,
          driverAttributes: fixedDriverAttributes,
          setupEfficiency: 92,
          noise: 0,
          weather: 'seco',
        })

        // O modificador de setup independe de equipe e de piloto
        expect(pace.breakdown.setupModifier).toBeCloseTo((92 - 80) * 0.05, 3)
      }
    }
  })
})
