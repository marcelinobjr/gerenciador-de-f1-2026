/**
 * calibration-wca-01r.test.ts
 *
 * PROJETO: APEX GP MANAGER — rodada CALIBRATION-WCA-01R
 *
 * Suíte de homologação e prova da Força Estrutural inicial 2026 para as 12 equipes:
 * P1 Mercedes 100 / P2 Ferrari 98 / P3 McLaren 96 / P4 Red Bull 94 / P5 Racing Bulls 87 /
 * P6 Alpine 87 / P7 Audi 86 / P8 Haas 75 / P9 Williams 70 / P10 Aston Martin 60 /
 * P11 Cadillac 50 / P12 Andretti 45.
 *
 * TESTES CANÔNICOS WCA01..WCA27:
 * WCA01: 12 equipes presentes
 * WCA02: targets exatamente conforme tabela aprovada
 * WCA03: fixture neutra determinística
 * WCA04: piloto neutro igual para todos
 * WCA05: setup 80
 * WCA06: TrackFit 75 no estrutural puro
 * WCA07: RNG 0
 * WCA08: Mercedes converge 100±1
 * WCA09: Ferrari converge 98±1
 * WCA10: McLaren converge 96±1
 * WCA11: Red Bull converge 94±1
 * WCA12: Racing Bulls converge 87±1
 * WCA13: Alpine converge 87±1
 * WCA14: Audi converge 86±1
 * WCA15: Haas converge 75±1
 * WCA16: Williams converge 70±1
 * WCA17: Aston Martin converge 60±1
 * WCA18: Cadillac converge 50±1
 * WCA19: Andretti converge 45±1
 * WCA20: nenhuma regra de produção usa teamName para bônus/penalidade
 * WCA21: nenhum result cap criado
 * WCA22: TrackFit continua homologado (clamp normal ±2.0, clamp especializado ±2.5, neutro 75, scale 0.08, aplicação única)
 * WCA23: setupEfficiency continua homologado (neutro 80, delta (eff-80)*0.05, aplicação única)
 * WCA24: RNG continua sigma 0.45 (Mulberry32 + Box-Muller determinístico, clamp ±1.0)
 * WCA25: Structural formula permanece intacta (Tech 60%, Driver 25%, Team 15%; Tech = Parts 50% + PU 30% + Rel 10% + Cond 10%)
 * WCA26: pilotos reais não alteram Structural Strength (camada separada de sessão/evento)
 * WCA27: desenvolvimento futuro continua capaz de ultrapassar a baseline inicial (equipes não presas ao valor inicial)
 */

import { describe, it, expect } from 'vitest'
import {
  structuralStrengthService,
  TECHNICAL_WEIGHTS,
  DRIVER_WEIGHTS,
  TEAM_WEIGHTS,
  STRUCTURAL_STRENGTH_WEIGHTS,
  NEUTRAL_ADAPTATION_VALUE,
} from '@/services/structuralStrengthService'
import {
  canonicalPaceIntegrationService,
  TRACKFIT_NORMAL_CLAMP,
  TRACKFIT_SPECIALIZED_CLAMP,
  TRACKFIT_MAX_CLAMP,
  NEUTRAL_TRACKFIT_REFERENCE,
  TRACKFIT_MODIFIER_SCALE,
  QUALI_RNG_TARGET_RANGE,
  QUALI_RNG_DEFAULT_SIGMA,
} from '@/services/canonicalPaceIntegrationService'
import {
  BASELINE_2026_V1_TEAMS,
  BASELINE_2026_V1_ORDER,
  BASELINE_2026_V1_METADATA,
} from '@/data/baseline-2026-v1'
import { BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'

describe('CALIBRATION-WCA-01R: 2026 Initial Structural Strength Benchmark Suite', () => {
  // Targets oficiais homologados para as 12 equipes
  const TARGET_MAP: Record<string, number> = {
    mercedes: 100,
    ferrari: 98,
    mclaren: 96,
    redbull: 94,
    racingbulls: 87,
    alpine: 87,
    audi: 86,
    haas: 75,
    williams: 70,
    astonmartin: 60,
    cadillac: 50,
    andretti: 45,
  }

  // WCA01: 12 equipes presentes
  it('WCA01: 12 equipes presentes na baseline 2026', () => {
    const keys = Object.keys(BASELINE_2026_V1_TEAMS)
    expect(keys).toHaveLength(12)
    expect(BASELINE_2026_V1_ORDER).toHaveLength(12)
    for (const key of Object.keys(TARGET_MAP)) {
      expect(BASELINE_2026_V1_TEAMS[key]).toBeDefined()
      expect(BASELINE_2026_V1_ORDER).toContain(key)
    }
  })

  // WCA02: targets exatamente conforme tabela aprovada
  it('WCA02: targets exatamente conforme tabela aprovada (100, 98, 96, 94, 87, 87, 86, 75, 70, 60, 50, 45)', () => {
    const expectedScores = [100, 98, 96, 94, 87, 87, 86, 75, 70, 60, 50, 45]
    BASELINE_2026_V1_ORDER.forEach((key, idx) => {
      expect(BASELINE_2026_V1_TEAMS[key].score).toBe(expectedScores[idx])
      expect(BASELINE_2026_V1_TEAMS[key].score).toBe(TARGET_MAP[key])
    })
  })

  // WCA03: fixture neutra determinística
  it('WCA03: fixture neutra determinística — execuções idênticas produzem exatamente o mesmo resultado bit a bit', () => {
    const run1 = BASELINE_2026_V1_ORDER.map((teamKey) => {
      const breakdown = structuralStrengthService.getTeamStructuralStrength(teamKey, {
        seasonYear: 2026,
      })
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: 'neutral_test',
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: { speed: 85, consistency: 85, morale: 80 },
        setupEfficiency: 80,
        weather: 'seco',
        tyreCompound: 'macio',
        fuelKg: 12,
        noise: 0,
      })
      return {
        structural: breakdown.structuralStrengthScore,
        pace: pace.effectivePaceScore,
        lapTime: pace.lapTimeSec,
      }
    })

    const run2 = BASELINE_2026_V1_ORDER.map((teamKey) => {
      const breakdown = structuralStrengthService.getTeamStructuralStrength(teamKey, {
        seasonYear: 2026,
      })
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: 'neutral_test',
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: { speed: 85, consistency: 85, morale: 80 },
        setupEfficiency: 80,
        weather: 'seco',
        tyreCompound: 'macio',
        fuelKg: 12,
        noise: 0,
      })
      return {
        structural: breakdown.structuralStrengthScore,
        pace: pace.effectivePaceScore,
        lapTime: pace.lapTimeSec,
      }
    })

    expect(run1).toEqual(run2)
  })

  // WCA04: piloto neutro igual para todos
  it('WCA04: piloto neutro igual para todos (speed 85, morale 80) resulta em driverEventModifier rigorosamente 0.000', () => {
    for (const teamKey of BASELINE_2026_V1_ORDER) {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: 'neutral_drv',
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: { speed: 85, consistency: 85, morale: 80 },
        setupEfficiency: 80,
        weather: 'seco',
        noise: 0,
      })
      expect(pace.breakdown.driverEventModifier).toBe(0.0)
    }
  })

  // WCA05: setup 80
  it('WCA05: setup 80 resulta em setupModifier rigorosamente 0.000', () => {
    for (const teamKey of BASELINE_2026_V1_ORDER) {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: 'neutral_drv',
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: { speed: 85 },
        setupEfficiency: 80,
        noise: 0,
      })
      expect(pace.breakdown.setupModifier).toBe(0.0)
    }
  })

  // WCA06: TrackFit 75 no estrutural puro
  it('WCA06: TrackFit 75 no estrutural puro resulta em trackFitModifier rigorosamente 0.000', () => {
    const tfNorm = canonicalPaceIntegrationService.normalizeTrackFit({
      rawTrackFitScore: 75.0,
      referenceTrackFit: 75.0,
    })
    expect(tfNorm.trackFitModifier).toBe(0.0)

    for (const teamKey of BASELINE_2026_V1_ORDER) {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: 'neutral_drv',
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: { speed: 85 },
        setupEfficiency: 80,
        noise: 0,
      })
      expect(pace.breakdown.trackFitModifier).toBe(0.0)
      expect(pace.effectivePaceScore).toBe(pace.breakdown.structuralStrength)
    }
  })

  // WCA07: RNG 0
  it('WCA07: RNG 0 resulta em rngModifier rigorosamente 0.000', () => {
    for (const teamKey of BASELINE_2026_V1_ORDER) {
      const pace = canonicalPaceIntegrationService.computeQualifyingPace({
        teamKey,
        driverId: 'neutral_drv',
        circuitProfile: null,
        carTechnicalAttributes: null,
        driverAttributes: { speed: 85 },
        setupEfficiency: 80,
        noise: 0,
      })
      expect(pace.breakdown.rngModifier).toBe(0.0)
    }
  })

  // WCA08: Mercedes converge 100±1
  it('WCA08: Mercedes converge 100±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('mercedes', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 100)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(100)
  })

  // WCA09: Ferrari converge 98±1
  it('WCA09: Ferrari converge 98±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('ferrari', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 98)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(98)
  })

  // WCA10: McLaren converge 96±1
  it('WCA10: McLaren converge 96±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('mclaren', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 96)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(96)
  })

  // WCA11: Red Bull converge 94±1
  it('WCA11: Red Bull converge 94±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('redbull', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 94)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(94)
  })

  // WCA12: Racing Bulls converge 87±1
  it('WCA12: Racing Bulls converge 87±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('racingbulls', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 87)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(87)
  })

  // WCA13: Alpine converge 87±1
  it('WCA13: Alpine converge 87±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('alpine', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 87)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(87)
  })

  // WCA14: Audi converge 86±1
  it('WCA14: Audi converge 86±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('audi', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 86)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(86)
  })

  // WCA15: Haas converge 75±1
  it('WCA15: Haas converge 75±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('haas', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 75)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(75)
  })

  // WCA16: Williams converge 70±1
  it('WCA16: Williams converge 70±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('williams', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 70)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(70)
  })

  // WCA17: Aston Martin converge 60±1
  it('WCA17: Aston Martin converge 60±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('astonmartin', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 60)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(60)
  })

  // WCA18: Cadillac converge 50±1
  it('WCA18: Cadillac converge 50±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 50)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(50)
  })

  // WCA19: Andretti converge 45±1
  it('WCA19: Andretti converge 45±1', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('andretti', {
      seasonYear: 2026,
    })
    expect(Math.abs(breakdown.structuralStrengthScore - 45)).toBeLessThanOrEqual(1.0)
    expect(breakdown.structuralStrengthScore).toBe(45)
  })

  // WCA20: nenhuma regra de produção usa teamName para bônus/penalidade
  it('WCA20: nenhuma regra de produção usa teamName para bônus/penalidade (zero team name bonuses)', () => {
    const auditReport = structuralStrengthService.auditStructuralStrengthSystem({
      seasonYear: 2026,
    })
    expect(auditReport.teamNameBonuses).toBe(0)

    const paceAudit = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(paceAudit.teamNameBonuses).toBe(0)

    // Prova direta: duas equipes fictícias com parâmetros idênticos recebem score idêntico
    const mockComponents = { frontWing: 80, rearWing: 80, floor: 80 }
    const mockDrivers = [
      {
        name: 'Piloto Teste 1',
        role: 'driver1' as const,
        overallRating: 82,
        speed: 82,
        consistency: 82,
        rain: 82,
        defense: 82,
        morale: 80,
      },
    ]
    const mockFacilities = { factory: 3 }

    const sA = structuralStrengthService.calculateStructuralStrength({
      teamKey: 'team_alpha_bonus_check',
      teamName: 'Mercedes Fictícia',
      components: mockComponents,
      effectivePuRating: 80,
      drivers: mockDrivers,
      facilities: mockFacilities,
    })

    const sB = structuralStrengthService.calculateStructuralStrength({
      teamKey: 'team_beta_bonus_check',
      teamName: 'Andretti Fictícia',
      components: mockComponents,
      effectivePuRating: 80,
      drivers: mockDrivers,
      facilities: mockFacilities,
    })

    expect(sA.structuralStrengthScore).toBe(sB.structuralStrengthScore)
  })

  // WCA21: nenhum result cap criado
  it('WCA21: nenhum result cap criado (sem artificial position caps ou vitória travada)', () => {
    const audit = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    expect(audit.raceEngineConsumers).toBe(0)
    expect(audit.eventDependencies).toBe(0)
    expect(audit.rngDependencies).toBe(0)
  })

  // WCA22: TrackFit continua homologado
  it('WCA22: TrackFit continua homologado (clamp normal ±2.0, clamp especializado ±2.5, neutro 75, scale 0.08, aplicação única)', () => {
    expect(TRACKFIT_NORMAL_CLAMP).toBe(2.0)
    expect(TRACKFIT_SPECIALIZED_CLAMP).toBe(2.5)
    expect(TRACKFIT_MAX_CLAMP).toBe(2.5)
    expect(NEUTRAL_TRACKFIT_REFERENCE).toBe(75.0)
    expect(TRACKFIT_MODIFIER_SCALE).toBe(0.08)

    // Linearidade exata antes do clamp
    const tfMid = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 85.0 })
    expect(tfMid.trackFitModifier).toBeCloseTo((85.0 - 75.0) * 0.08, 3)

    // Clamps extremos respeitados
    const tfMax = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 100.0 })
    expect(tfMax.trackFitModifier).toBe(2.0)
    const tfMin = canonicalPaceIntegrationService.normalizeTrackFit({ rawTrackFitScore: 0.0 })
    expect(tfMin.trackFitModifier).toBe(-2.0)

    // Aplicação única no PaceIntegration (legado 45% desativado e auditPassed)
    const paceAudit = canonicalPaceIntegrationService.auditPaceIntegration()
    expect(paceAudit.legacyTrackFitWeight45).toBe(false)
    expect(paceAudit.auditPassed).toBe(true)
  })

  // WCA23: setupEfficiency continua homologado
  it('WCA23: setupEfficiency continua homologado (neutro 80, delta (efficiency - 80) * 0.05, aplicação única)', () => {
    const pace80 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 80,
      noise: 0,
    })
    const pace100 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 100,
      noise: 0,
    })
    const pace50 = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'cadillac',
      driverId: 'cad-01',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      setupEfficiency: 50,
      noise: 0,
    })

    expect(pace80.breakdown.setupModifier).toBe(0.0)
    expect(pace100.breakdown.setupModifier).toBeCloseTo((100 - 80) * 0.05, 3) // +1.000
    expect(pace50.breakdown.setupModifier).toBeCloseTo((50 - 80) * 0.05, 3) // -1.500
  })

  // WCA24: RNG continua sigma 0.45
  it('WCA24: RNG continua sigma 0.45 (Mulberry32 + Box-Muller determinístico, clamp ±1.0)', () => {
    expect(QUALI_RNG_TARGET_RANGE.SIGMA).toBe(0.45)
    expect(QUALI_RNG_DEFAULT_SIGMA).toBe(0.45)
    expect(QUALI_RNG_TARGET_RANGE.MIN).toBe(-1.0)
    expect(QUALI_RNG_TARGET_RANGE.MAX).toBe(1.0)

    // Clamp de segurança estrito
    const noiseMax = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      noise: 10.0,
    })
    expect(noiseMax.breakdown.rngModifier).toBe(1.0)

    const noiseMin = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 85 },
      noise: -10.0,
    })
    expect(noiseMin.breakdown.rngModifier).toBe(-1.0)
  })

  // WCA25: Structural formula permanece intacta
  it('WCA25: Structural formula permanece intacta (Tech 60%, Driver 25%, Team 15%; Tech = Parts 50% + PU 30% + Rel 10% + Cond 10%)', () => {
    expect(STRUCTURAL_STRENGTH_WEIGHTS.technical).toBe(0.6)
    expect(STRUCTURAL_STRENGTH_WEIGHTS.driver).toBe(0.25)
    expect(STRUCTURAL_STRENGTH_WEIGHTS.team).toBe(0.15)

    expect(TECHNICAL_WEIGHTS.parts).toBe(0.5)
    expect(TECHNICAL_WEIGHTS.effectivePu).toBe(0.3)
    expect(TECHNICAL_WEIGHTS.reliability).toBe(0.1)
    expect(TECHNICAL_WEIGHTS.condition).toBe(0.1)

    expect(DRIVER_WEIGHTS.driverAttributes).toBe(0.8)
    expect(DRIVER_WEIGHTS.morale).toBe(0.1)
    expect(DRIVER_WEIGHTS.adaptation).toBe(0.1)
    expect(NEUTRAL_ADAPTATION_VALUE).toBe(75)

    expect(TEAM_WEIGHTS.infrastructure).toBe(0.8)
    expect(TEAM_WEIGHTS.teamMorale).toBe(0.2)

    // Validação matemática em uma equipe arbitrária
    for (const teamKey of BASELINE_2026_V1_ORDER) {
      const breakdown = structuralStrengthService.getTeamStructuralStrength(teamKey, {
        seasonYear: 2026,
      })
      const expectedSum =
        breakdown.technicalScore * 0.6 + breakdown.driverScore * 0.25 + breakdown.teamScore * 0.15
      expect(Math.abs(expectedSum - breakdown.structuralStrengthScore)).toBeLessThanOrEqual(0.05)
    }
  })

  // WCA26: pilotos reais não alteram Structural Strength
  it('WCA26: pilotos reais não alteram Structural Strength (camada separada de sessão/evento)', () => {
    // A Força Estrutural é calculada no nível do construtor/carro da baseline
    const baseMerc = structuralStrengthService.getTeamStructuralStrength('mercedes', {
      seasonYear: 2026,
    })
    expect(baseMerc.structuralStrengthScore).toBe(100)

    // Na simulação de qualifying com piloto real, o structuralStrengthScore da breakdown
    // permanece exatamente idêntico ao structuralStrengthScore puro
    const mercWithRealDriver = canonicalPaceIntegrationService.computeQualifyingPace({
      teamKey: 'mercedes',
      driverId: 'rus',
      circuitProfile: null,
      carTechnicalAttributes: null,
      driverAttributes: { speed: 94, consistency: 92, morale: 85 },
      setupEfficiency: 80,
      noise: 0,
    })

    expect(mercWithRealDriver.breakdown.structuralStrength).toBe(100)
    // O impacto do piloto é isolado no driverEventModifier: (94 - 85)*0.08 + (85 - 80)*0.02 = 0.72 + 0.10 = 0.82
    expect(mercWithRealDriver.breakdown.driverEventModifier).toBe(0.82)
    // O pace final combina a estrutura intacta com o evento de piloto
    expect(mercWithRealDriver.effectivePaceScore).toBe(100.82)
  })

  // WCA27: desenvolvimento futuro continua capaz de ultrapassar a baseline inicial
  it('WCA27: desenvolvimento futuro continua capaz de ultrapassar a baseline inicial (equipes não presas à baseline)', () => {
    // Equipes do pelotão inferior e intermediário (Andretti, Cadillac, Aston Martin, Williams)
    // podem evoluir através de melhoria técnica de componentes e PU
    const testKeys = ['andretti', 'cadillac', 'astonmartin', 'williams', 'haas', 'audi'] as const

    for (const key of testKeys) {
      const initial = structuralStrengthService.getTeamStructuralStrength(key, {
        seasonYear: 2026,
      })
      const initialComponents = initial.technicalBreakdown.componentsMap
      const upgradedComponents: Record<string, number> = {}
      for (const [part, val] of Object.entries(initialComponents)) {
        upgradedComponents[part] = val + 25 // +25 pontos em desenvolvimento de peças
      }

      const upgraded = structuralStrengthService.calculateStructuralStrength({
        teamKey: key,
        teamName: initial.teamName,
        components: upgradedComponents,
        effectivePuRating: initial.technicalBreakdown.effectivePuScore + 15, // +15 na PU
        reliability: initial.technicalBreakdown.reliabilityScore,
        condition: initial.technicalBreakdown.conditionScore,
        puSupplier: initial.technicalBreakdown.puSupplier,
        effectiveIntegration: initial.technicalBreakdown.effectiveIntegration,
        nominalPuRating: initial.technicalBreakdown.nominalPuRating,
        drivers: initial.driverBreakdown.drivers,
        facilities: initial.teamBreakdown.facilitiesLevels,
        teamMorale: initial.teamBreakdown.teamMoraleScore,
      })

      expect(upgraded.structuralStrengthScore).toBeGreaterThan(initial.structuralStrengthScore)
      expect(upgraded.technicalScore).toBeGreaterThan(initial.technicalScore)
    }
  })
})
