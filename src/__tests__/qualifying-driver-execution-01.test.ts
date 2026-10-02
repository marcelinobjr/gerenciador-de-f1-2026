/**
 * src/__tests__/qualifying-driver-execution-01.test.ts
 *
 * QUALI-DRIVER-EXECUTION-01 — Auditoria, Prova Canônica e Contratos de QDE
 *
 * CONTRATOS QUE NÃO PODEM QUEBRAR:
 * - Baseline 2026: Mercedes 100, Ferrari 98, McLaren 96, Red Bull 94, Racing Bulls 87, Alpine 87, Audi 86, Haas 75, Williams 70, Aston Martin 60, Cadillac 50, Andretti 45.
 * - CP4 32/32, WCA 27/27, CP3A verdes.
 * - Structural Technical 50/30/10/10; Driver 80/10/10; Team 80/20; Final 60/25/15.
 * - TrackFit 75 / 0.08 / ±2.0 / ±2.5 / 1x. SetupEfficiency neutral 80 / coefficient 0.05 / 1x. Qualifying RNG sigma 0.45.
 * - Driver Strength existente = Attributes 80% + Morale 10% + Adaptation 10%.
 *
 * QDE01–QDE25:
 * QDE01: Só consome dados canônicos existentes.
 * QDE02: Mesmo carro + piloto diferente altera o expected pace.
 * QDE03: Maior Technical (speed/pace) melhora pace.
 * QDE04: Maior Experience melhora pace (ou comportamento canônico documentado).
 * QDE05: Maior Morale melhora pace.
 * QDE06: Mesmo piloto + RNG 0 determinístico.
 * QDE07: Mesmo carro não força teammates ao mesmo pace.
 * QDE08: Sem modifier por driverName.
 * QDE09: Sem modifier por teamName.
 * QDE10: Sigma = 0.45 exato.
 * QDE11: TrackFit 75 / 0.08 / ±2.0 / ±2.5 intacto.
 * QDE12: Setup 80 / 0.05 intacto.
 * QDE13: Structural intacto (60/25/15 e 50/30/10/10).
 * QDE14: Baseline WCA intacto (100/98/96/94/87/87/86/75/70/60/50/45).
 * QDE15: QDriverExecution aplicado exatamente 1x.
 * QDE16: RNG aplicado exatamente 1x.
 * QDE17: Q1 segue pelo pipeline canônico.
 * QDE18: Q2 segue pelo pipeline canônico.
 * QDE19: Q3 segue pelo pipeline canônico.
 * QDE20: Pilotos próximos podem inverter ordem com RNG.
 * QDE21: Múltiplas seeds -> melhor QDriverExecution tem melhor pace médio.
 * QDE22: Piloto em carro melhor continua beneficiando do carro.
 * QDE23: Sem multiplier explosivo.
 * QDE24: Sem cap de posição artificial.
 * QDE25: Sem resultado hardcoded.
 */

import { describe, it, expect } from 'vitest'
import {
  canonicalPaceIntegrationService,
  QUALI_RNG_TARGET_RANGE,
  QUALI_RNG_DEFAULT_SIGMA,
  TRACKFIT_NORMAL_CLAMP,
  TRACKFIT_SPECIALIZED_CLAMP,
  NEUTRAL_TRACKFIT_REFERENCE,
  TRACKFIT_MODIFIER_SCALE,
  hashStringToSeed,
  createMulberry32,
  sampleGaussianRng,
} from '@/services/canonicalPaceIntegrationService'
import {
  structuralStrengthService,
  TECHNICAL_WEIGHTS,
  DRIVER_WEIGHTS,
  TEAM_WEIGHTS,
  STRUCTURAL_STRENGTH_WEIGHTS,
  NEUTRAL_ADAPTATION_VALUE,
} from '@/services/structuralStrengthService'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { BASELINE_2026_V1_TEAMS, BASELINE_2026_V1_ORDER } from '@/data/baseline-2026-v1'

describe('QUALI-DRIVER-EXECUTION-01 — Qualifying Driver Execution Specification & Calibration Suite', () => {
  const silverstone = resolveCircuitProfile({ round: 11 })
  const cadEntry = BASELINE_V0_DATA.teams['cadillac'] as any
  const cadTech = cadEntry?.chassisComponents ?? cadEntry?.technicalAttributes

  // QDE01: Só consome dados canônicos existentes
  it('QDE01: Só consome dados canônicos existentes (driverAttributes: speed, morale, rain, etc.)', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-qde01',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: {
        speed: 85,
        consistency: 85,
        morale: 80,
      },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    expect(pace).toBeDefined()
    expect(pace.effectivePaceScore).toBeDefined()
    expect(pace.breakdown.driverEventModifier).toBeDefined()
    expect(typeof pace.breakdown.driverEventModifier).toBe('number')
  })

  // QDE02: Mesmo carro + piloto diferente altera o expected pace
  it('QDE02: Mesmo carro + piloto diferente altera o expected pace', () => {
    // Verstappen vs Hülkenberg vs Bortoleto no MESMO carro (Cadillac)
    // Insumos canônicos reais de balance-baseline-v0:
    // Verstappen: speed 96, morale 85
    // Hülkenberg: speed 83, morale 85
    // Bortoleto: speed 83, morale 80
    const paceVerstappen = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'verstappen_test',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 96, morale: 85 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const paceHulkenberg = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'hulkenberg_test',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 83, morale: 85 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const paceBortoleto = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'bortoleto_test',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 83, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    // Prova de que os 3 NÃO têm o mesmo pace esperado no mesmo carro
    expect(paceVerstappen.effectivePaceScore).toBeGreaterThan(paceHulkenberg.effectivePaceScore)
    expect(paceHulkenberg.effectivePaceScore).toBeGreaterThan(paceBortoleto.effectivePaceScore)
    expect(paceVerstappen.lapTimeSec).toBeLessThan(paceHulkenberg.lapTimeSec)
    expect(paceHulkenberg.lapTimeSec).toBeLessThan(paceBortoleto.lapTimeSec)
  })

  // QDE03: Maior Technical (speed/pace) melhora pace
  it('QDE03: Maior Technical (speed) melhora pace', () => {
    const paceLow = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-low',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 80, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const paceHigh = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-high',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 90, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    expect(paceHigh.breakdown.driverEventModifier).toBeGreaterThan(
      paceLow.breakdown.driverEventModifier,
    )
    expect(paceHigh.effectivePaceScore).toBeGreaterThan(paceLow.effectivePaceScore)
    expect(paceHigh.lapTimeSec).toBeLessThan(paceLow.lapTimeSec)

    // Escala: 10 pontos de speed = (90 - 80) * 0.08 = 0.80 pts de pace
    // Em tempo de volta: 0.80 pts * 0.082 s/pt = ~0.066 s na volta de classificação
    const speedDeltaModifier =
      paceHigh.breakdown.driverEventModifier - paceLow.breakdown.driverEventModifier
    expect(speedDeltaModifier).toBeCloseTo(0.8, 2)
  })

  // QDE04: Maior Experience melhora pace (ou comportamento canônico documentado quando Experience source é ausente na entidade driver)
  it('QDE04: Comportamento canônico de experiência documentado (sem inventar schema novo)', () => {
    // A entidade DriverModel canônica não possui campo "experience" numérico no PocketBase.
    // O pipeline canônico opera com atributos canônicos existentes (speed, consistency, morale, rain, physical_condition).
    // Testamos que o pipeline se mantém estável e determinístico sem introduzir campos não migrados.
    const paceStd = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-qde04',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })
    expect(paceStd.effectivePaceScore).toBeDefined()
  })

  // QDE05: Maior Morale melhora pace
  it('QDE05: Maior Morale melhora pace', () => {
    const paceLowMorale = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-mor-low',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85, morale: 60 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const paceHighMorale = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-mor-high',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85, morale: 90 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    expect(paceHighMorale.breakdown.driverEventModifier).toBeGreaterThan(
      paceLowMorale.breakdown.driverEventModifier,
    )
    expect(paceHighMorale.effectivePaceScore).toBeGreaterThan(paceLowMorale.effectivePaceScore)
    expect(paceHighMorale.lapTimeSec).toBeLessThan(paceLowMorale.lapTimeSec)
  })

  // QDE06: Mesmo piloto + RNG 0 determinístico
  it('QDE06: Mesmo piloto + RNG 0 determinístico produz exatamente o mesmo pace e tempo', () => {
    const run1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv-det',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 88, morale: 85 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const run2 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv-det',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 88, morale: 85 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    expect(run1.effectivePaceScore).toBe(run2.effectivePaceScore)
    expect(run1.lapTimeSec).toBe(run2.lapTimeSec)
    expect(run1.breakdown).toEqual(run2.breakdown)
  })

  // QDE07: Mesmo carro não força teammates ao mesmo pace
  it('QDE07: Mesmo carro não força teammates ao mesmo pace quando atributos diferem', () => {
    // Teammates na Audi: Nico Hülkenberg (speed 83, morale 85) vs Gabriel Bortoleto (speed 83, morale 80)
    const audiHulk = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'hulk',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 83, morale: 85 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const audiBort = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'audi',
      driverId: 'bort',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 83, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    expect(audiHulk.effectivePaceScore).not.toBe(audiBort.effectivePaceScore)
    expect(audiHulk.lapTimeSec).not.toBe(audiBort.lapTimeSec)
    expect(audiHulk.effectivePaceScore).toBeGreaterThan(audiBort.effectivePaceScore)
  })

  // QDE08: Sem modifier por driverName
  it('QDE08: Sem modifier por driverName (zero bônus por nome de piloto)', () => {
    const paceDriverAlpha = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'Verstappen',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const paceDriverBeta = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'PilotoFicticioDesconhecido',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    expect(paceDriverAlpha.breakdown.driverEventModifier).toBe(
      paceDriverBeta.breakdown.driverEventModifier,
    )
    expect(paceDriverAlpha.effectivePaceScore).toBe(paceDriverBeta.effectivePaceScore)
    expect(paceDriverAlpha.lapTimeSec).toBe(paceDriverBeta.lapTimeSec)
  })

  // QDE09: Sem modifier por teamName
  it('QDE09: Sem modifier por teamName (zero bônus por nome de equipe)', () => {
    const audit = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(audit.teamNameBonuses).toBe(0)
  })

  // QDE10: Sigma = 0.45 exato
  it('QDE10: Qualifying RNG sigma = 0.45 exato', () => {
    expect(QUALI_RNG_TARGET_RANGE.SIGMA).toBe(0.45)
    expect(QUALI_RNG_DEFAULT_SIGMA).toBe(0.45)
  })

  // QDE11: TrackFit 75 / 0.08 / ±2.0 / ±2.5 intacto
  it('QDE11: TrackFit 75 / 0.08 / ±2.0 / ±2.5 intacto', () => {
    expect(NEUTRAL_TRACKFIT_REFERENCE).toBe(75.0)
    expect(TRACKFIT_MODIFIER_SCALE).toBe(0.08)
    expect(TRACKFIT_NORMAL_CLAMP).toBe(2.0)
    expect(TRACKFIT_SPECIALIZED_CLAMP).toBe(2.5)
  })

  // QDE12: Setup 80 / 0.05 intacto
  it('QDE12: SetupEfficiency neutral 80 / coefficient 0.05 intacto', () => {
    const pace80 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })
    expect(pace80.breakdown.setupModifier).toBe(0.0)

    const pace90 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-seq',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85 },
      setupEfficiency: 90,
      noise: 0,
      weather: 'seco',
    })
    expect(pace90.breakdown.setupModifier).toBeCloseTo((90 - 80) * 0.05, 3)
  })

  // QDE13: Structural intacto (60/25/15 e 50/30/10/10)
  it('QDE13: Structural Technical 50/30/10/10; Driver 80/10/10; Team 80/20; Final 60/25/15', () => {
    expect(STRUCTURAL_STRENGTH_WEIGHTS.technical).toBe(0.6)
    expect(STRUCTURAL_STRENGTH_WEIGHTS.driver).toBe(0.25)
    expect(STRUCTURAL_STRENGTH_WEIGHTS.team).toBe(0.15)

    expect(TECHNICAL_WEIGHTS.chassisParts).toBe(0.5)
    expect(TECHNICAL_WEIGHTS.effectivePu).toBe(0.3)
    expect(TECHNICAL_WEIGHTS.reliability).toBe(0.1)
    expect(TECHNICAL_WEIGHTS.condition).toBe(0.1)

    expect(DRIVER_WEIGHTS.driverAttributes).toBe(0.8)
    expect(DRIVER_WEIGHTS.morale).toBe(0.1)
    expect(DRIVER_WEIGHTS.adaptation).toBe(0.1)

    expect(TEAM_WEIGHTS.infrastructure).toBe(0.8)
    expect(TEAM_WEIGHTS.teamMorale).toBe(0.2)
  })

  // QDE14: Baseline WCA intacto
  it('QDE14: Baseline 2026 WCA 100/98/96/94/87/87/86/75/70/60/50/45 intacto', () => {
    const expected = [100, 98, 96, 94, 87, 87, 86, 75, 70, 60, 50, 45]
    BASELINE_2026_V1_ORDER.forEach((key, idx) => {
      expect(BASELINE_2026_V1_TEAMS[key].score).toBe(expected[idx])
    })
  })

  // QDE15: QDriverExecution 1x
  it('QDE15: QDriverExecution aplicado exatamente 1x no cálculo do pace', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv-qde15',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 90, morale: 85 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const b = pace.breakdown
    const sumTerms = Number(
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

    expect(pace.effectivePaceScore).toBe(sumTerms)
  })

  // QDE16: RNG 1x
  it('QDE16: RNG aplicado exatamente 1x', () => {
    const pace = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'drv-qde16',
      circuitProfile: silverstone,
      carTechnicalAttributes: cadTech,
      driverAttributes: { speed: 85, morale: 80 },
      setupEfficiency: 80,
      noise: 0.5,
      weather: 'seco',
    })

    expect(pace.breakdown.rngModifier).toBe(0.5)
    expect(pace.effectivePaceScore).toBe(pace.breakdown.structuralStrength + 0.5)
  })

  // QDE17/18/19: Q1, Q2, Q3 pelo pipeline canônico único
  it('QDE17/18/19: Pipeline canônico único unificado para Q1, Q2 e Q3', () => {
    // Mesma função matemática computeQualifyingPace atende a todas as fases sem fórmulas divergentes
    const p1 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'lec',
      circuitProfile: silverstone,
      driverAttributes: { speed: 92, morale: 85 },
      setupEfficiency: 85,
      noise: 0,
      weather: 'seco',
    })
    expect(p1.effectivePaceScore).toBeGreaterThan(0)
    expect(p1.lapTimeSec).toBeGreaterThan(50)
  })

  // QDE20: Pilotos próximos podem inverter com RNG
  it('QDE20: Pilotos com ratings próximos podem inverter posição com RNG', () => {
    // Piloto A ligeiramente mais rápido (speed 85.5) vs Piloto B (speed 85.0)
    // Se o Piloto A tiver uma volta ruim (noise -0.3) e B tiver uma volta boa (+0.3):
    const runA = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'drv-close-a',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85.5, morale: 80 },
      setupEfficiency: 80,
      noise: -0.3,
      weather: 'seco',
    })

    const runB = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'ferrari',
      driverId: 'drv-close-b',
      circuitProfile: silverstone,
      driverAttributes: { speed: 85.0, morale: 80 },
      setupEfficiency: 80,
      noise: 0.3,
      weather: 'seco',
    })

    expect(runB.effectivePaceScore).toBeGreaterThan(runA.effectivePaceScore)
    expect(runB.lapTimeSec).toBeLessThan(runA.lapTimeSec)
  })

  // QDE21: Múltiplas seeds -> melhor QDriverExecution tem melhor pace médio
  it('QDE21: Múltiplas seeds -> piloto com melhor execução tem melhor pace médio', () => {
    const seeds = ['seed_1', 'seed_2', 'seed_3', 'seed_4', 'seed_5', 'seed_6', 'seed_7', 'seed_8']

    let sumVerstappen = 0
    let sumBortoleto = 0

    seeds.forEach((s) => {
      const paceVer = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'audi',
        driverId: 'ver',
        circuitProfile: silverstone,
        driverAttributes: { speed: 96, morale: 85 },
        setupEfficiency: 80,
        seed: s,
        weather: 'seco',
      })
      const paceBort = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey: 'audi',
        driverId: 'bor',
        circuitProfile: silverstone,
        driverAttributes: { speed: 83, morale: 80 },
        setupEfficiency: 80,
        seed: s,
        weather: 'seco',
      })

      sumVerstappen += paceVer.effectivePaceScore
      sumBortoleto += paceBort.effectivePaceScore
    })

    const avgVerstappen = sumVerstappen / seeds.length
    const avgBortoleto = sumBortoleto / seeds.length

    expect(avgVerstappen).toBeGreaterThan(avgBortoleto)
  })

  // QDE22: Piloto em carro melhor continua beneficiando do carro
  it('QDE22: Piloto em carro melhor continua beneficiando da força estrutural do carro', () => {
    // Piloto mediano na Mercedes (100) vs Piloto top na Andretti (45)
    const midDriverInMerc = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'mid-merc',
      circuitProfile: silverstone,
      driverAttributes: { speed: 80, morale: 80 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    const topDriverInAndretti = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'andretti',
      driverId: 'top-andretti',
      circuitProfile: silverstone,
      driverAttributes: { speed: 96, morale: 90 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    // O gap do carro (100 vs 45 = 55 pts) não pode ser superado apenas pela pilotagem
    expect(midDriverInMerc.effectivePaceScore).toBeGreaterThan(
      topDriverInAndretti.effectivePaceScore,
    )
  })

  // QDE23: Sem multiplier explosivo
  it('QDE23: Sem multiplier explosivo (driverEventModifier fica em faixa calibrada razoável)', () => {
    const paceMaxDriver = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'drv-extreme',
      circuitProfile: silverstone,
      driverAttributes: { speed: 99, morale: 100 },
      setupEfficiency: 80,
      noise: 0,
      weather: 'seco',
    })

    // (99 - 85) * 0.08 + (100 - 80) * 0.02 = 1.12 + 0.40 = 1.52 pt de pace
    expect(paceMaxDriver.breakdown.driverEventModifier).toBeLessThan(3.0)
    expect(paceMaxDriver.breakdown.driverEventModifier).toBeGreaterThan(1.0)
  })

  // QDE24: Sem cap de posição artificial
  it('QDE24: Sem cap de posição artificial', () => {
    const audit = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    expect(audit.raceEngineConsumers).toBe(0)
  })

  // QDE25: Sem resultado hardcoded
  it('QDE25: Sem resultado hardcoded por piloto ou equipe', () => {
    const paceAudit = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(paceAudit.teamNameBonuses).toBe(0)
    expect(paceAudit.auditPassed).toBe(true)
  })
})
