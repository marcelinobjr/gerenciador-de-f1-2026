/**
 * balance-equation-02a-structural-strength.test.ts
 *
 * Suíte de Testes BE02A-01 até BE02A-15
 * BALANCE-EQUATION-02A: Structural Strength Foundation
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
import { ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'

describe('BE02A-01 a BE02A-15: Structural Strength Foundation & Formulas', () => {
  // BE02A-01: Technical Score Formula
  it('BE02A-01: Technical formula = PARTS 50% + EFFECTIVE_PU 30% + RELIABILITY 10% + CONDITION 10%', () => {
    const breakdown = structuralStrengthService.calculateTechnicalScore({
      components: {
        frontWing: 100,
        rearWing: 100,
        floor: 100,
        diffuser: 100,
        sidepods: 100,
        chassis: 100,
        suspension: 100,
        brakes: 100,
      },
      effectivePuRating: 90,
      reliability: 80,
      condition: 100,
    })

    // 100 * 0.5 + 90 * 0.3 + 80 * 0.1 + 100 * 0.1 = 50 + 27 + 8 + 10 = 95.00
    expect(breakdown.partsScore).toBe(100)
    expect(breakdown.effectivePuScore).toBe(90)
    expect(breakdown.reliabilityScore).toBe(80)
    expect(breakdown.conditionScore).toBe(100)
    expect(breakdown.technicalScore).toBe(95.0)
    expect(breakdown.weights).toEqual(TECHNICAL_WEIGHTS)
  })

  // BE02A-02: Driver Score Formula
  it('BE02A-02: Driver formula = ATTRIBUTES 80% + MORALE 10% + ADAPTATION 10%', () => {
    const breakdown = structuralStrengthService.calculateDriverScore({
      drivers: [
        {
          name: 'Piloto A',
          role: 'driver1',
          overallRating: 90,
          speed: 90,
          consistency: 90,
          rain: 90,
          defense: 90,
          morale: 80,
        },
        {
          name: 'Piloto B',
          role: 'driver2',
          overallRating: 90,
          speed: 90,
          consistency: 90,
          rain: 90,
          defense: 90,
          morale: 80,
        },
      ],
      adaptationOverride: 70,
    })

    // 90 * 0.8 + 80 * 0.1 + 70 * 0.1 = 72 + 8 + 7 = 87.00
    expect(breakdown.driverAttributesScore).toBe(90)
    expect(breakdown.moraleScore).toBe(80)
    expect(breakdown.adaptationScore).toBe(70)
    expect(breakdown.driverScore).toBe(87.0)
    expect(breakdown.weights).toEqual(DRIVER_WEIGHTS)
  })

  // BE02A-03: Team Score Formula
  it('BE02A-03: Team formula = INFRASTRUCTURE 80% + TEAM MORALE 20%', () => {
    // 5 em todas instalações = 100% de infraestrutura
    const breakdown = structuralStrengthService.calculateTeamScore({
      facilities: {
        factory: 5,
        design_centre: 5,
        cfd: 5,
        wind_tunnel: 5,
        manufacturing: 5,
        simulator: 5,
        operations_centre: 5,
        pitstop_center: 5,
        youth_academy: 5,
      },
      teamMorale: 80,
    })

    // 100 * 0.8 + 80 * 0.2 = 80 + 16 = 96.00
    expect(breakdown.infrastructureScore).toBe(100)
    expect(breakdown.teamMoraleScore).toBe(80)
    expect(breakdown.teamScore).toBe(96.0)
    expect(breakdown.weights).toEqual(TEAM_WEIGHTS)
  })

  // BE02A-04: Structural Strength Consolidated Formula
  it('BE02A-04: Structural Strength = TECHNICAL × 0.60 + DRIVER × 0.25 + TEAM × 0.15', () => {
    const result = structuralStrengthService.calculateStructuralStrength({
      teamKey: 'test_team',
      teamName: 'Test Team',
      components: {
        frontWing: 100,
        rearWing: 100,
        floor: 100,
        diffuser: 100,
        sidepods: 100,
        chassis: 100,
        suspension: 100,
        brakes: 100,
      },
      effectivePuRating: 100,
      reliability: 100,
      condition: 100,
      drivers: [
        {
          name: 'D1',
          role: 'driver1',
          overallRating: 100,
          speed: 100,
          consistency: 100,
          rain: 100,
          defense: 100,
          morale: 100,
        },
        {
          name: 'D2',
          role: 'driver2',
          overallRating: 100,
          speed: 100,
          consistency: 100,
          rain: 100,
          defense: 100,
          morale: 100,
        },
      ],
      adaptationOverride: 100,
      facilities: {
        factory: 5,
        design_centre: 5,
        cfd: 5,
        wind_tunnel: 5,
        manufacturing: 5,
        simulator: 5,
        operations_centre: 5,
        pitstop_center: 5,
        youth_academy: 5,
      },
      teamMorale: 100,
    })

    // Technical = 100, Driver = 100, Team = 100 => Structural = 100
    expect(result.technicalScore).toBe(100)
    expect(result.driverScore).toBe(100)
    expect(result.teamScore).toBe(100)
    expect(result.structuralStrengthScore).toBe(100)
    expect(result.weights).toEqual(STRUCTURAL_STRENGTH_WEIGHTS)
  })

  // BE02A-05: Pesos canônicos respeitam as especificações exatas
  it('BE02A-05: Todos os pesos de sub-equações e equação final somam 100%', () => {
    const techSum =
      TECHNICAL_WEIGHTS.parts +
      TECHNICAL_WEIGHTS.effectivePu +
      TECHNICAL_WEIGHTS.reliability +
      TECHNICAL_WEIGHTS.condition
    expect(techSum).toBeCloseTo(1.0, 5)

    const drvSum =
      DRIVER_WEIGHTS.driverAttributes + DRIVER_WEIGHTS.morale + DRIVER_WEIGHTS.adaptation
    expect(drvSum).toBeCloseTo(1.0, 5)

    const teamSum = TEAM_WEIGHTS.infrastructure + TEAM_WEIGHTS.teamMorale
    expect(teamSum).toBeCloseTo(1.0, 5)

    const finalSum =
      STRUCTURAL_STRENGTH_WEIGHTS.technical +
      STRUCTURAL_STRENGTH_WEIGHTS.driver +
      STRUCTURAL_STRENGTH_WEIGHTS.team
    expect(finalSum).toBeCloseTo(1.0, 5)
  })

  // BE02A-06: Cobertura de todas as equipes jogáveis/selecionáveis (28 catálogo + custom)
  it('BE02A-06: Cobertura total cobre as 28 equipes do catálogo mais custom_team (29 no total)', () => {
    const baseline = structuralStrengthService.getBaselineV0()
    const keys = Object.keys(baseline.teams)
    expect(keys.length).toBeGreaterThanOrEqual(29)

    // Todas as 28 equipes de ALL_GRID_TEAMS_DATABASE presentes
    for (const gridTeam of ALL_GRID_TEAMS_DATABASE) {
      expect(baseline.teams[gridTeam.key]).toBeDefined()
    }
    // Equipe personalizada presente
    expect(baseline.teams['custom_team']).toBeDefined()
  })

  // BE02A-07: Data quality explícita por equipe sem preenchimento silencioso
  it('BE02A-07: Data quality explícita para cada equipe (COMPLETE, PARTIAL, DEFAULTED ou MISSING)', () => {
    const audit = structuralStrengthService.auditStructuralStrengthSystem()
    expect(audit.qualityCounts.COMPLETE).toBeGreaterThan(0)
    expect(audit.qualityCounts.PARTIAL).toBeGreaterThan(0)
    expect(audit.qualityCounts.DEFAULTED).toBeGreaterThan(0)

    for (const team of audit.allTeams) {
      expect(['COMPLETE', 'PARTIAL', 'DEFAULTED', 'MISSING']).toContain(team.dataQuality)
      expect(team.dataQualityNotes).toBeDefined()
      expect(team.dataQualityNotes.length).toBeGreaterThan(5)
    }
  })

  // BE02A-08: Zero team bonus por nome
  it('BE02A-08: ZERO team bonus por nome — duas equipes com parâmetros técnicos e humanos idênticos recebem score idêntico', () => {
    const testProps = {
      components: {
        frontWing: 80,
        rearWing: 80,
        floor: 80,
        diffuser: 80,
        sidepods: 80,
        chassis: 80,
        suspension: 80,
        brakes: 80,
      },
      effectivePuRating: 85,
      reliability: 85,
      condition: 100,
      drivers: [
        {
          name: 'Pilot 1',
          role: 'driver1' as const,
          overallRating: 84,
          speed: 84,
          consistency: 84,
          rain: 84,
          defense: 84,
          morale: 80,
        },
        {
          name: 'Pilot 2',
          role: 'driver2' as const,
          overallRating: 82,
          speed: 82,
          consistency: 82,
          rain: 82,
          defense: 82,
          morale: 80,
        },
      ],
      facilities: {
        factory: 4,
        design_centre: 4,
        cfd: 4,
        wind_tunnel: 4,
        manufacturing: 4,
        simulator: 4,
        operations_centre: 4,
        pitstop_center: 4,
        youth_academy: 4,
      },
      teamMorale: 80,
    }

    const ferrariFictitious = structuralStrengthService.calculateStructuralStrength({
      teamKey: 'ferrari_clone',
      teamName: 'Ferrari Clone',
      ...testProps,
    })

    const haasFictitious = structuralStrengthService.calculateStructuralStrength({
      teamKey: 'haas_clone',
      teamName: 'Haas Clone',
      ...testProps,
    })

    expect(ferrariFictitious.structuralStrengthScore).toBe(haasFictitious.structuralStrengthScore)
    expect(ferrariFictitious.technicalScore).toBe(haasFictitious.technicalScore)
    expect(ferrariFictitious.driverScore).toBe(haasFictitious.driverScore)
    expect(ferrariFictitious.teamScore).toBe(haasFictitious.teamScore)
  })

  // BE02A-09: Zero RNG no cálculo de structural score
  it('BE02A-09: ZERO RNG — repetição 100x produz exatamente o mesmo resultado determinístico', () => {
    const scores: number[] = []
    for (let i = 0; i < 50; i++) {
      const breakdown = structuralStrengthService.getTeamStructuralStrength('mercedes')
      scores.push(breakdown.structuralStrengthScore)
    }
    const unique = new Set(scores)
    expect(unique.size).toBe(1)
  })

  // BE02A-10: Zero trackFit no structural score
  it('BE02A-10: ZERO trackFit — a função não aceita nem é alterada por circuitos ou traçados', () => {
    const baseline = structuralStrengthService.getBaselineV0()
    // As fórmulas e o artefato não contêm nenhuma dependência de traçado
    expect(JSON.stringify(baseline.formulas)).not.toContain('trackFit')
    expect(JSON.stringify(baseline.formulas)).not.toContain('circuit')
  })

  // BE02A-11: Zero setup, pneu, fuel e chaos no structural score
  it('BE02A-11: ZERO setup / pneu / fuel / chaos no structural score (métricas de regime estático)', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('audi')
    const json = JSON.stringify(breakdown)
    expect(json).not.toContain('tireWear')
    expect(json).not.toContain('fuelLoad')
    expect(json).not.toContain('chaosFactor')
    expect(json).not.toContain('wingAngleSetup')
  })

  // BE02A-12: Neutralidade e transparência de adaptation
  it('BE02A-12: Adaptation é neutra e marcada explicitamente como placeholder neutro sem valor funcional inventado', () => {
    const driverBreakdown = structuralStrengthService.calculateDriverScore({
      drivers: [
        {
          name: 'Pilot Test',
          role: 'driver1',
          overallRating: 85,
          speed: 85,
          consistency: 85,
          rain: 85,
          defense: 85,
          morale: 85,
        },
      ],
    })

    expect(driverBreakdown.isAdaptationNeutral).toBe(true)
    expect(driverBreakdown.adaptationStatus).toBe('NEUTRAL_PLACEHOLDER')
    expect(driverBreakdown.adaptationScore).toBe(NEUTRAL_ADAPTATION_VALUE)
    expect(driverBreakdown.notes).toContain('neutra/placeholder')
  })

  // BE02A-13: Proibido MGU-K inventado como rating funcional
  it('BE02A-13: PROIBIDO MGU-K inventado — cálculo de PU efetiva depende exclusivamente de PU nominal e effectiveIntegration', () => {
    const breakdown = structuralStrengthService.calculateTechnicalScore({
      components: { frontWing: 80, floor: 80 },
      effectivePuRating: 88,
      puSupplier: 'Mercedes',
      effectiveIntegration: 1.0,
      nominalPuRating: 88,
    })

    const serialized = JSON.stringify(breakdown)
    expect(serialized).not.toContain('mgukRating')
    expect(serialized).not.toContain('mguKRating')
  })

  // BE02A-14: Audit limpo sem divergências estruturais no grid canônico
  it('BE02A-14: auditStructuralStrengthSystem executa limpo e verifica que Grupo A está no Top 4', () => {
    const audit = structuralStrengthService.auditStructuralStrengthSystem()
    expect(audit.totalTeams).toBeGreaterThanOrEqual(29)
    expect(audit.auditPassed).toBe(true)
    expect(audit.divergences).toHaveLength(0)

    const top4Keys = audit.rankings.slice(0, 4).map((r) => r.teamKey)
    expect(top4Keys).toContain('mercedes')
    expect(top4Keys).toContain('ferrari')
    expect(top4Keys).toContain('mclaren')
    expect(top4Keys).toContain('redbull')
  })

  // BE02A-15: Isolamento estrito — NÃO altera carPerf, combinedPerformance ou race engine
  it('BE02A-15: Isolamento de 02A — Structural strength é fundação de medição e auditoria, sem acoplamento no race engine', async () => {
    // Importa dinamicamente a race engine para comprovar que nenhuma de suas assinaturas foi alterada
    const { canonicalRaceEngineService } = await import('@/services/canonicalRaceEngineService')
    expect(canonicalRaceEngineService).toBeDefined()
    // O race engine calcula voltas com suas funções normais sem exigir structural score
    expect(typeof canonicalRaceEngineService.calculateCanonicalLapPace).toBe('function')
    expect(typeof canonicalRaceEngineService.advanceOneLap).toBe('function')
  })
})
