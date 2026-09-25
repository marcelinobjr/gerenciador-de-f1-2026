/**
 * balance-equation-02a-structural-strength.test.ts
 *
 * Suíte de Testes BE02A-01 até BE02A-15
 * BALANCE-EQUATION-02A: Structural Strength Foundation
 *
 * Especificações validadas:
 * 01: score estrutural determinístico
 * 02: PU efetiva usa integração canônica
 * 03: CUSTOMER cap = 90%
 * 04: FACTORY cap = 100%
 * 05: TechnicalScore usa dados reais
 * 06: DriverScore usa ratings reais
 * 07: TeamScore usa infraestrutura real
 * 08: fórmula 60/25/15 correta
 * 09: RNG fora do structural score
 * 10: trackFit fora
 * 11: setup/pneus/fuel fora
 * 12: chaos fora
 * 13: 29/29 equipes recebem breakdown
 * 14: dados faltantes marcados e não inventados (dataQuality COMPLETE/PARTIAL/DEFAULTED/MISSING explícito)
 * 15: zero team bonus por nome
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
import { canonicalPowerUnitIntegrationService } from '@/services/canonicalPowerUnitIntegrationService'
import { ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'

describe('BE02A-01 a BE02A-15: Structural Strength Foundation & Formulas', () => {
  // BE02A-01: score estrutural determinístico
  it('BE02A-01: score estrutural determinístico — múltiplas chamadas produzem exatamente o mesmo resultado idêntico', () => {
    const scoresMercedes: number[] = []
    const scoresFerrari: number[] = []
    for (let i = 0; i < 30; i++) {
      scoresMercedes.push(
        structuralStrengthService.getTeamStructuralStrength('mercedes').structuralStrengthScore,
      )
      scoresFerrari.push(
        structuralStrengthService.getTeamStructuralStrength('ferrari').structuralStrengthScore,
      )
    }
    expect(new Set(scoresMercedes).size).toBe(1)
    expect(new Set(scoresFerrari).size).toBe(1)
    expect(scoresMercedes[0]).toBeGreaterThan(0)
    expect(scoresFerrari[0]).toBeGreaterThan(0)
  })

  // BE02A-02: PU efetiva usa integração canônica
  it('BE02A-02: PU efetiva usa integração canônica — respeita canonicalPowerUnitIntegrationService sem valores inventados', () => {
    const baseline = structuralStrengthService.getBaselineV0()
    // Equipes cliente e fábrica usam cálculo do serviço canônico
    for (const teamKey of ['mercedes', 'mclaren', 'audi', 'williams', 'haas']) {
      const entry = baseline.teams[teamKey]
      expect(entry).toBeDefined()
      expect(entry.effectivePuRating).toBeGreaterThanOrEqual(50)
      expect(entry.effectivePuRating).toBeLessThanOrEqual(100)
      expect(entry.effectiveIntegration).toBeGreaterThan(0)
      expect(entry.effectiveIntegration).toBeLessThanOrEqual(entry.maxIntegration)
    }
    // Proibido MGU-K inventado
    const techBreakdown = structuralStrengthService.calculateTechnicalScore({
      components: { frontWing: 85, floor: 85 },
      effectivePuRating: 88,
      puSupplier: 'Mercedes',
      effectiveIntegration: 1.0,
      nominalPuRating: 88,
    })
    const serialized = JSON.stringify(techBreakdown)
    expect(serialized).not.toContain('mgukRating')
    expect(serialized).not.toContain('mguKRating')
  })

  // BE02A-03: CUSTOMER cap = 90%
  it('BE02A-03: CUSTOMER cap = 90% — integração efetiva e teto de equipes cliente nunca excedem 0.90 (90%)', () => {
    const baseline = structuralStrengthService.getBaselineV0()
    const customerTeams = Object.values(baseline.teams).filter(
      (t) => t.relationshipType === 'CUSTOMER',
    )
    expect(customerTeams.length).toBeGreaterThan(0)
    for (const team of customerTeams) {
      expect(team.maxIntegration).toBeLessThanOrEqual(0.90001)
      expect(team.effectiveIntegration).toBeLessThanOrEqual(0.90001)
    }
    // Verificação cruzada com canonicalPowerUnitIntegrationService metadata
    const mclarenMeta = canonicalPowerUnitIntegrationService.getRelationshipMetadata(
      'mclaren',
      'Mercedes',
    )
    expect(mclarenMeta.relationshipType).toBe('CUSTOMER')
    expect(mclarenMeta.maxIntegration).toBeLessThanOrEqual(0.90001)
  })

  // BE02A-04: FACTORY cap = 100%
  it('BE02A-04: FACTORY cap = 100% — equipes fábrica (incluindo Audi e Ferrari/Mercedes/RedBull) possuem teto de 1.00 (100%)', () => {
    const baseline = structuralStrengthService.getBaselineV0()
    const factoryTeams = Object.values(baseline.teams).filter(
      (t) => t.relationshipType === 'FACTORY',
    )
    expect(factoryTeams.length).toBeGreaterThanOrEqual(4)
    for (const team of factoryTeams) {
      expect(team.maxIntegration).toBe(1.0)
    }
    // Audi é fábrica e tem teto 1.0
    expect(baseline.teams['audi'].relationshipType).toBe('FACTORY')
    expect(baseline.teams['audi'].maxIntegration).toBe(1.0)
  })

  // BE02A-05: TechnicalScore usa dados reais
  it('BE02A-05: TechnicalScore usa dados reais — fórmula exata PARTS 50% + EFFECTIVE_PU 30% + RELIABILITY 10% + CONDITION 10%', () => {
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
    expect(TECHNICAL_WEIGHTS.parts).toBe(0.5)
    expect(TECHNICAL_WEIGHTS.effectivePu).toBe(0.3)
    expect(TECHNICAL_WEIGHTS.reliability).toBe(0.1)
    expect(TECHNICAL_WEIGHTS.condition).toBe(0.1)
  })

  // BE02A-06: DriverScore usa ratings reais
  it('BE02A-06: DriverScore usa ratings reais — fórmula exata ATTRIBUTES 80% + MORALE 10% + ADAPTATION 10% (adaptation NEUTRAL_PLACEHOLDER)', () => {
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
    expect(DRIVER_WEIGHTS.driverAttributes).toBe(0.8)
    expect(DRIVER_WEIGHTS.morale).toBe(0.1)
    expect(DRIVER_WEIGHTS.adaptation).toBe(0.1)

    // Sem override: usa NEUTRAL_ADAPTATION_VALUE e status NEUTRAL_PLACEHOLDER
    const neutralBreakdown = structuralStrengthService.calculateDriverScore({
      drivers: [
        {
          name: 'Piloto Teste',
          role: 'driver1',
          overallRating: 85,
          speed: 85,
          consistency: 85,
          rain: 85,
          defense: 85,
          morale: 80,
        },
      ],
    })
    expect(neutralBreakdown.adaptationScore).toBe(NEUTRAL_ADAPTATION_VALUE)
    expect(neutralBreakdown.isAdaptationNeutral).toBe(true)
    expect(neutralBreakdown.adaptationStatus).toBe('NEUTRAL_PLACEHOLDER')
  })

  // BE02A-07: TeamScore usa infraestrutura real
  it('BE02A-07: TeamScore usa infraestrutura real — fórmula exata INFRASTRUCTURE 80% + TEAM_MORALE 20%', () => {
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
    expect(TEAM_WEIGHTS.infrastructure).toBe(0.8)
    expect(TEAM_WEIGHTS.teamMorale).toBe(0.2)
  })

  // BE02A-08: fórmula 60/25/15 correta
  it('BE02A-08: fórmula 60/25/15 correta — STRUCTURAL_STRENGTH = TECHNICAL × 0.60 + DRIVER × 0.25 + TEAM × 0.15', () => {
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
    expect(result.technicalScore).toBe(100)
    expect(result.driverScore).toBe(100)
    expect(result.teamScore).toBe(100)
    expect(result.structuralStrengthScore).toBe(100)
    expect(result.weights).toEqual(STRUCTURAL_STRENGTH_WEIGHTS)
    expect(STRUCTURAL_STRENGTH_WEIGHTS.technical).toBe(0.6)
    expect(STRUCTURAL_STRENGTH_WEIGHTS.driver).toBe(0.25)
    expect(STRUCTURAL_STRENGTH_WEIGHTS.team).toBe(0.15)
  })

  // BE02A-09: RNG fora do structural score
  it('BE02A-09: RNG fora do structural score — determinismo estrito sem Math.random ou ruído probabilístico', () => {
    const scores: number[] = []
    for (let i = 0; i < 50; i++) {
      const breakdown = structuralStrengthService.getTeamStructuralStrength('mercedes')
      scores.push(breakdown.structuralStrengthScore)
    }
    const unique = new Set(scores)
    expect(unique.size).toBe(1)
    const audit = structuralStrengthService.auditStructuralStrengthSystem()
    expect(audit.rngDependencies).toBe(0)
  })

  // BE02A-10: trackFit fora
  it('BE02A-10: trackFit fora — Força estrutural é regime de fábrica/base estática e não aceita circuito ou traçado', () => {
    const baseline = structuralStrengthService.getBaselineV0()
    expect(JSON.stringify(baseline.formulas)).not.toContain('trackFit')
    expect(JSON.stringify(baseline.formulas)).not.toContain('circuit')
    const breakdown = structuralStrengthService.getTeamStructuralStrength('ferrari')
    const serialized = JSON.stringify(breakdown)
    expect(serialized).not.toContain('trackFit')
    expect(serialized).not.toContain('circuitCharacteristics')
  })

  // BE02A-11: setup/pneus/fuel fora
  it('BE02A-11: setup/pneus/fuel fora — zero dependência de carga de combustível, desgaste de pneu ou acerto de asa', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('audi')
    const json = JSON.stringify(breakdown)
    expect(json).not.toContain('tireWear')
    expect(json).not.toContain('fuelLoad')
    expect(json).not.toContain('wingAngleSetup')
    expect(json).not.toContain('tireCompound')
  })

  // BE02A-12: chaos fora
  it('BE02A-12: chaos fora — sem variáveis de clima dinâmico, safety car, incidentes ou chaosFactor', () => {
    const breakdown = structuralStrengthService.getTeamStructuralStrength('redbull')
    const json = JSON.stringify(breakdown)
    expect(json).not.toContain('chaosFactor')
    expect(json).not.toContain('safetyCar')
    expect(json).not.toContain('weatherVariation')
    expect(json).not.toContain('incidentRisk')
  })

  // BE02A-13: 29/29 equipes recebem breakdown
  it('BE02A-13: 29/29 equipes recebem breakdown — totalTeams = 29 e todas geram cálculo completo', () => {
    const audit = structuralStrengthService.auditStructuralStrengthSystem()
    expect(audit.totalTeams).toBe(29)
    expect(audit.allTeams.length).toBe(29)
    expect(audit.rankings.length).toBe(29)
    const teamKeys = audit.allTeams.map((t) => t.teamKey)
    expect(new Set(teamKeys).size).toBe(29)
    // 28 do catálogo + custom_team
    for (const gridTeam of ALL_GRID_TEAMS_DATABASE) {
      expect(teamKeys).toContain(gridTeam.key)
    }
    expect(teamKeys).toContain('custom_team')
  })

  // BE02A-14: dados faltantes marcados e não inventados (dataQuality COMPLETE/PARTIAL/DEFAULTED/MISSING explícito)
  it('BE02A-14: dados faltantes marcados e não inventados — dataQuality COMPLETE/PARTIAL/DEFAULTED/MISSING explícito', () => {
    const audit = structuralStrengthService.auditStructuralStrengthSystem()
    expect(audit.qualityCounts.COMPLETE).toBeGreaterThan(0)
    expect(audit.qualityCounts.PARTIAL).toBeGreaterThan(0)
    expect(audit.qualityCounts.DEFAULTED).toBeGreaterThan(0)
    expect(
      audit.qualityCounts.COMPLETE +
        audit.qualityCounts.PARTIAL +
        audit.qualityCounts.DEFAULTED +
        audit.qualityCounts.MISSING,
    ).toBe(29)

    for (const team of audit.allTeams) {
      expect(['COMPLETE', 'PARTIAL', 'DEFAULTED', 'MISSING']).toContain(team.dataQuality)
      expect(team.dataQualityNotes).toBeDefined()
      expect(team.dataQualityNotes.length).toBeGreaterThan(5)
    }
  })

  // BE02A-15: zero team bonus por nome
  it('BE02A-15: zero team bonus por nome — duas equipes com parâmetros técnicos e humanos idênticos recebem score rigorosamente idêntico', () => {
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

    const audit = structuralStrengthService.auditStructuralStrengthSystem()
    expect(audit.teamNameBonuses).toBe(0)
    expect(audit.duplicateFactors).toBe(0)
    expect(audit.eventDependencies).toBe(0)
    expect(audit.raceEngineConsumers).toBe(0)
  })
})
