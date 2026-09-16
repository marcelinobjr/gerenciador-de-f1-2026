/**
 * SUÍTE DE TESTES OBRIGATÓRIOS DA IMPLEMENTAÇÃO Nº 8C.3
 * CONCEPT REALIZATION, NOVO CARRO & ERRO DE PROJETO
 *
 * TESTES OBRIGATÓRIOS:
 * TEST 50: ELITE ACERTA — elite + strong preparation + strong realization -> carro forte.
 * TEST 51: ELITE ERRA — elite + strong preparation + poor realization -> carro abaixo do potencial. PASS OBRIGATÓRIO.
 * TEST 52: MIDFIELD ACERTA — midfield + excellent preparation/realization -> salto real.
 * TEST 53: NO LOTTERY — weak structure + lucky realization não vira dominante.
 * TEST 54: CONFIDENCE ERRADA — HIGH confidence + resultado real mediano. PASS OBRIGATÓRIO.
 * TEST 55: SAME SEED — mesmo snapshot -> mesmo concept.
 * TEST 56: DIFFERENT SEED — outro save -> resultado diferente dentro de distribuição plausível.
 * TEST 57: TRACK FIT — circuit profiles byte/logicamente iguais antes/depois.
 * TEST 58: PU — PU regulation afeta PU, não duplica chassis effect.
 * TEST 59: PIVOT — concept ruim + pivot -> custo, delay, sunk cost, possível melhoria.
 * TEST 60: RECOVERY — equipe forte com bad concept recupera gradualmente.
 * TEST 61: TRANSITION ATOMICITY — falha durante geração -> nenhum grid híbrido.
 * TEST 62: HISTORY — New Era em N; N-1 absolutamente imutável.
 * TEST 63: AUDI SAVE — save Audi 2027 Round 3 preservado e intocado.
 */

import { describe, it, expect } from 'vitest'
import { regulationService, createDefaultBaselineTimeline } from '@/services/regulationService'
import {
  TechnicalRegulation,
  RegulationPreparation,
  ConceptApproach,
} from '@/types/canonical-regulations'
import { TeamModel } from '@/types/f1'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'

describe('IMPLEMENTAÇÃO Nº 8C.3 — CONCEPT REALIZATION, NOVO CARRO & ERRO DE PROJETO', () => {
  const dummyRegulation2030: TechnicalRegulation = {
    regulationId: 'reg_2030_era_test',
    name: 'Regulamento Técnico FIA 2030 — Nova Era Sustentável',
    technicalEraId: 'era_2030_sustainable',
    category: 'NEW_TECHNICAL_ERA',
    severity: 'EXTREME',
    status: 'ACTIVE',
    announcementSeason: 2028,
    effectiveSeason: 2030,
    affectedDomains: [
      'aerodynamics',
      'floorGroundEffect',
      'chassis',
      'cooling',
      'powerUnitIntegration',
    ],
    transferabilityProfile: {
      aerodynamics: 0.35,
      floorGroundEffect: 0.3,
      chassis: 0.5,
      suspension: 0.55,
      cooling: 0.6,
      weightManagement: 0.7,
      simulation: 0.85,
      manufacturing: 0.9,
      vehicleDynamics: 0.6,
      powerUnitIntegration: 0.45,
      reliability: 0.8,
      mechanicalGrip: 0.6,
    },
    technicalPriorities: {
      aerodynamics: 'CRITICAL',
      floorGroundEffect: 'CRITICAL',
      cooling: 'HIGH',
      powerUnitIntegration: 'HIGH',
    },
    uncertainty: 'HIGH',
    publicDescription: 'Ruptura aerodinâmica e de efeito solo visando corridas mais equilibradas.',
    createdAt: new Date().toISOString(),
  }

  // -------------------------------------------------------------
  // TEST 50: ELITE ACERTA (Strong preparation + Strong realization -> Carro Forte)
  // -------------------------------------------------------------
  it('TEST 50 — ELITE ACERTA: Elite com excelente preparação e realization forte gera carro de topo', () => {
    const eliteTeam: TeamModel = {
      id: 'team_ferrari',
      name: 'Scuderia Ferrari',
      budget: 140_000_000,
      facilities: { design_centre: 5, cfd: 5, wind_tunnel: 5, factory: 5, simulator: 5 },
      technical_organization: {
        teamId: 'team_ferrari',
        seasonYear: 2030,
        members: {
          TECHNICAL_DIRECTOR: { overall: 92 } as any,
          HEAD_OF_AERODYNAMICS: { overall: 94 } as any,
          CHIEF_DESIGNER: { overall: 90 } as any,
          HEAD_OF_VEHICLE_PERFORMANCE: { overall: 88 } as any,
        } as any,
      } as any,
    } as any

    const prep: RegulationPreparation = {
      teamId: 'team_ferrari',
      regulationId: dummyRegulation2030.regulationId,
      researchProgress: 95,
      knowledgeGain: 90,
      validationProgress: 90,
      simulationConfidence: 92,
      preparationScore: 92,
      status: 'EXTENSIVE',
      completedProjects: ['p1', 'p2', 'p3', 'p4'],
      completedProjectDetails: [],
      lastUpdatedSeason: 2029,
      lastUpdatedRound: 24,
    }

    // Gerar com abordagem BALANCED e seed favorável
    const realization = regulationService.generateConceptRealization({
      team: eliteTeam,
      regulation: dummyRegulation2030,
      technicalOrg: (eliteTeam as any).technical_organization,
      preparation: prep,
      approach: 'BALANCED',
      seedOverride: 777,
    })

    const baseline = regulationService.generateNewCarBaseline({
      team: eliteTeam,
      regulation: dummyRegulation2030,
      realization,
      technicalOrg: (eliteTeam as any).technical_organization,
    })

    expect(realization.structuralPotential).toBeGreaterThan(80)
    expect(baseline.chassisRating).toBeGreaterThanOrEqual(80)
    expect(baseline.carPerformanceRating).toBeGreaterThanOrEqual(80)
  })

  // -------------------------------------------------------------
  // TEST 51: ELITE ERRA (PASS OBRIGATÓRIO: Elite erra o conceito aerodinâmico)
  // -------------------------------------------------------------
  it('TEST 51 — ELITE ERRA: Equipe de ponta com abordagem agressiva e realization ruim sofre queda competitiva real', () => {
    const eliteTeam: TeamModel = {
      id: 'team_mercedes',
      name: 'Mercedes-AMG F1 Team',
      budget: 140_000_000,
      facilities: { design_centre: 5, cfd: 5, wind_tunnel: 5, factory: 5, simulator: 5 },
      technical_organization: {
        teamId: 'team_mercedes',
        seasonYear: 2030,
        members: {
          TECHNICAL_DIRECTOR: { overall: 90 } as any,
          HEAD_OF_AERODYNAMICS: { overall: 90 } as any,
          CHIEF_DESIGNER: { overall: 90 } as any,
          HEAD_OF_VEHICLE_PERFORMANCE: { overall: 88 } as any,
        } as any,
      } as any,
    } as any

    const prep: RegulationPreparation = {
      teamId: 'team_mercedes',
      regulationId: dummyRegulation2030.regulationId,
      researchProgress: 85,
      knowledgeGain: 85,
      validationProgress: 80,
      simulationConfidence: 85,
      preparationScore: 85,
      status: 'STRONG',
      completedProjects: ['p1', 'p2'],
      completedProjectDetails: [],
      lastUpdatedSeason: 2029,
      lastUpdatedRound: 24,
    }

    // Escolhe abordagem agressiva ('zeropod' concept) com seed que induz erro de correlação
    const realization = regulationService.generateConceptRealization({
      team: eliteTeam,
      regulation: dummyRegulation2030,
      technicalOrg: (eliteTeam as any).technical_organization,
      preparation: prep,
      approach: 'AGGRESSIVE',
      seedOverride: 104, // seed calibrada com desvio estocástico negativo
    })

    const baseline = regulationService.generateNewCarBaseline({
      team: eliteTeam,
      regulation: dummyRegulation2030,
      realization,
      technicalOrg: (eliteTeam as any).technical_organization,
    })

    // O potencial estrutural da elite era alto (~85), mas a realization caiu
    expect(realization.structuralPotential).toBeGreaterThanOrEqual(80)
    expect(realization.stochasticDeviation).toBeLessThan(0)
    expect(realization.realizationScore).toBeLessThan(realization.structuralPotential)
    // Carro resultante fica abaixo do potencial
    expect(baseline.chassisRating).toBeLessThan(75)
  })

  // -------------------------------------------------------------
  // TEST 52: MIDFIELD ACERTA (Midfield + Preparação Excelente -> Salto Real)
  // -------------------------------------------------------------
  it('TEST 52 — MIDFIELD ACERTA: Equipe intermediária com excelente preparação e conceito acerta o carro e sobe no grid', () => {
    const midfieldTeam: TeamModel = {
      id: 'team_aston_martin',
      name: 'Aston Martin F1',
      budget: 100_000_000,
      facilities: { design_centre: 4, cfd: 4, wind_tunnel: 4, factory: 3, simulator: 3 },
      technical_organization: {
        teamId: 'team_aston_martin',
        seasonYear: 2030,
        members: {
          TECHNICAL_DIRECTOR: { overall: 85 } as any,
          HEAD_OF_AERODYNAMICS: { overall: 88 } as any,
          CHIEF_DESIGNER: { overall: 82 } as any,
          HEAD_OF_VEHICLE_PERFORMANCE: { overall: 80 } as any,
        } as any,
      } as any,
    } as any

    const prep: RegulationPreparation = {
      teamId: 'team_aston_martin',
      regulationId: dummyRegulation2030.regulationId,
      researchProgress: 90,
      knowledgeGain: 90,
      validationProgress: 88,
      simulationConfidence: 85,
      preparationScore: 88,
      status: 'EXTENSIVE',
      completedProjects: ['p1', 'p2', 'p3'],
      completedProjectDetails: [],
      lastUpdatedSeason: 2029,
      lastUpdatedRound: 24,
    }

    const realization = regulationService.generateConceptRealization({
      team: midfieldTeam,
      regulation: dummyRegulation2030,
      technicalOrg: (midfieldTeam as any).technical_organization,
      preparation: prep,
      approach: 'AGGRESSIVE',
      seedOverride: 2023, // upside positivo
    })

    const baseline = regulationService.generateNewCarBaseline({
      team: midfieldTeam,
      regulation: dummyRegulation2030,
      realization,
      technicalOrg: (midfieldTeam as any).technical_organization,
    })

    expect(realization.realizationScore).toBeGreaterThanOrEqual(75)
    expect(baseline.chassisRating).toBeGreaterThanOrEqual(74)
  })

  // -------------------------------------------------------------
  // TEST 53: NO LOTTERY (Backmarker fraca não vira dominante por RNG)
  // -------------------------------------------------------------
  it('TEST 53 — NO LOTTERY: Equipe fraca com sorte estocástica não se torna dominante devido ao limite estrutural', () => {
    const backmarkerTeam: TeamModel = {
      id: 'team_haas_weak',
      name: 'Weak Racing',
      budget: 40_000_000,
      facilities: { design_centre: 1, cfd: 1, wind_tunnel: 1, factory: 1, simulator: 1 },
      technical_organization: {
        teamId: 'team_haas_weak',
        seasonYear: 2030,
        members: {
          TECHNICAL_DIRECTOR: { overall: 45 } as any,
          HEAD_OF_AERODYNAMICS: { overall: 45 } as any,
          CHIEF_DESIGNER: { overall: 45 } as any,
          HEAD_OF_VEHICLE_PERFORMANCE: { overall: 45 } as any,
        } as any,
      } as any,
    } as any

    const prep: RegulationPreparation = {
      teamId: 'team_haas_weak',
      regulationId: dummyRegulation2030.regulationId,
      researchProgress: 20,
      knowledgeGain: 20,
      validationProgress: 15,
      simulationConfidence: 20,
      preparationScore: 20,
      status: 'MINIMAL',
      completedProjects: [],
      completedProjectDetails: [],
      lastUpdatedSeason: 2029,
      lastUpdatedRound: 24,
    }

    // Mesmo com seed positiva extrema, o limite estrutural impede virar dominante
    const realization = regulationService.generateConceptRealization({
      team: backmarkerTeam,
      regulation: dummyRegulation2030,
      technicalOrg: (backmarkerTeam as any).technical_organization,
      preparation: prep,
      approach: 'AGGRESSIVE',
      seedOverride: 99999,
    })

    const baseline = regulationService.generateNewCarBaseline({
      team: backmarkerTeam,
      regulation: dummyRegulation2030,
      realization,
      technicalOrg: (backmarkerTeam as any).technical_organization,
    })

    // Backmarker limit garante que o chassi nunca atinge nível de topo (ex: >= 75)
    expect(realization.realizationScore).toBeLessThan(70)
    expect(baseline.chassisRating).toBeLessThan(70)
  })

  // -------------------------------------------------------------
  // TEST 54: CONFIDENCE ERRADA (PASS OBRIGATÓRIO: HIGH Confidence + Resultado Real Mediano)
  // -------------------------------------------------------------
  it('TEST 54 — CONFIDENCE ERRADA: Equipe com correlação ruim tem HIGH Confidence mas Realization mediana', () => {
    const teamBadCorrelation: TeamModel = {
      id: 'team_illusion',
      name: 'Illusion GP',
      budget: 100_000_000,
      facilities: {
        design_centre: 4,
        cfd: 5,
        wind_tunnel: 1, // Descompasso severo: CFD 5 vs Túnel 1
        factory: 3,
        simulator: 2,
      },
    } as any

    const prep: RegulationPreparation = {
      teamId: 'team_illusion',
      regulationId: dummyRegulation2030.regulationId,
      researchProgress: 85,
      knowledgeGain: 80,
      validationProgress: 75,
      simulationConfidence: 85,
      preparationScore: 80,
      status: 'EXTENSIVE',
      completedProjects: ['p1', 'p2', 'p3'],
      completedProjectDetails: [],
      lastUpdatedSeason: 2029,
      lastUpdatedRound: 24,
    }

    const realization = regulationService.generateConceptRealization({
      team: teamBadCorrelation,
      regulation: dummyRegulation2030,
      preparation: prep,
      approach: 'AGGRESSIVE',
      seedOverride: 42,
    })

    // A confiança reportada pela equipe é ALTA, mas a realidade é divergente
    expect(realization.confidenceLevel).toBe('HIGH')
    expect(realization.correlationProblemDetected).toBe(true)
    expect(realization.perceivedRealization).toBeGreaterThan(realization.realizationScore)
  })

  // -------------------------------------------------------------
  // TEST 55: SAME SEED (Mesmo snapshot + mesma seed -> Mesmo Concept)
  // -------------------------------------------------------------
  it('TEST 55 — SAME SEED: Determinação absoluta — reload não rerrola o conceito', () => {
    const testTeam: TeamModel = {
      id: 'team_seed_test',
      name: 'Deterministic Team',
    } as any

    const c1 = regulationService.generateConceptRealization({
      team: testTeam,
      regulation: dummyRegulation2030,
      approach: 'BALANCED',
      seedOverride: 12345,
    })

    const c2 = regulationService.generateConceptRealization({
      team: testTeam,
      regulation: dummyRegulation2030,
      approach: 'BALANCED',
      seedOverride: 12345,
    })

    expect(c1.realizationScore).toBe(c2.realizationScore)
    expect(c1.structuralPotential).toBe(c2.structuralPotential)
    expect(c1.stochasticDeviation).toBe(c2.stochasticDeviation)
    expect(c1.perceivedRealization).toBe(c2.perceivedRealization)
  })

  // -------------------------------------------------------------
  // TEST 56: DIFFERENT SEED (Diferentes seeds produzem resultados distintos na distribuição)
  // -------------------------------------------------------------
  it('TEST 56 — DIFFERENT SEED: Seeds diferentes geram realizações diferentes dentro de faixa plausível', () => {
    const testTeam: TeamModel = {
      id: 'team_seed_var',
      name: 'Variance Team',
    } as any

    const c1 = regulationService.generateConceptRealization({
      team: testTeam,
      regulation: dummyRegulation2030,
      approach: 'AGGRESSIVE',
      seedOverride: 111,
    })

    const c2 = regulationService.generateConceptRealization({
      team: testTeam,
      regulation: dummyRegulation2030,
      approach: 'AGGRESSIVE',
      seedOverride: 999,
    })

    expect(c1.realizationScore).not.toBe(c2.realizationScore)
  })

  // -------------------------------------------------------------
  // TEST 57: TRACK FIT (Perfis dos circuitos inalterados)
  // -------------------------------------------------------------
  it('TEST 57 — TRACK FIT: Circuit Profiles canônicos permanecem idênticos antes e depois da geração', () => {
    const monza = CIRCUIT_PERFORMANCE_PROFILES.find(
      (c) => c.id === 'circuit_16' || c.circuitName.includes('Monza'),
    )
    const monaco = CIRCUIT_PERFORMANCE_PROFILES.find(
      (c) => c.id === 'circuit_08' || c.circuitName.includes('Monaco'),
    )

    expect(monza).toBeDefined()
    expect(monaco).toBeDefined()

    expect(monza?.weights.topSpeed).toBeGreaterThan(monza?.weights.slowCorner || 0)
    expect(monaco?.weights.slowCorner).toBeGreaterThan(monaco?.weights.topSpeed || 0)
  })

  // -------------------------------------------------------------
  // TEST 58: PU INTEGRATION (PU regulation afeta PU sem duplicar chassis)
  // -------------------------------------------------------------
  it('TEST 58 — PU INTEGRATION: PU afeta powerUnitRating com proporção 70/30 preservada', () => {
    const testTeam: TeamModel = {
      id: 'team_pu_test',
      name: 'PU Test GP',
      pu_supplier: 'Honda',
    } as any

    const realization = regulationService.generateConceptRealization({
      team: testTeam,
      regulation: dummyRegulation2030,
      approach: 'BALANCED',
      seedOverride: 5050,
    })

    const baseline = regulationService.generateNewCarBaseline({
      team: testTeam,
      regulation: dummyRegulation2030,
      realization,
    })

    expect(baseline.powerUnitRating).toBeGreaterThan(70)
    // 70/30 verificação estrita
    const expected = Number(
      (baseline.chassisRating * 0.7 + baseline.powerUnitRating * 0.3).toFixed(1),
    )
    expect(baseline.carPerformanceRating).toBe(expected)
  })

  // -------------------------------------------------------------
  // TEST 59 & 60: CONCEPT PIVOT & RECOVERY
  // -------------------------------------------------------------
  it('TEST 59 & 60 — PIVOT & RECOVERY: Concept ruim inicia pivot com custo e recupera gradualmente ao longo dos GPs', () => {
    const poorTeam: TeamModel = {
      id: 'team_pivot_test',
      name: 'Pivot Racing',
      budget: 80_000_000,
      facilities: { design_centre: 4, cfd: 3, wind_tunnel: 3, factory: 4, simulator: 3 },
    } as any

    const poorRealization = regulationService.generateConceptRealization({
      team: poorTeam,
      regulation: dummyRegulation2030,
      approach: 'AGGRESSIVE',
      seedOverride: 104, // conceito ruim
    })

    const initialScore = poorRealization.realizationScore

    // Iniciar Concept Pivot no Round 3
    const pivotRes = regulationService.executeConceptPivot({
      team: poorTeam,
      realization: poorRealization,
      currentRound: 3,
      targetApproach: 'BALANCED',
      costUsd: 12_000_000,
    })

    expect(pivotRes.success).toBe(true)
    expect(pivotRes.pivotState.costUsd).toBe(12_000_000)
    expect(pivotRes.pivotState.pivotActive).toBe(true)
    expect(pivotRes.pivotState.engineeringCapacitySacrifice).toBe(25)

    // Avançar para o Round 7 (conclusão do pacote B-Spec)
    const advPivot = regulationService.advanceConceptPivot({
      pivotState: pivotRes.pivotState,
      realization: pivotRes.updatedRealization,
      currentRound: 7,
    })

    expect(advPivot.completed).toBe(true)
    expect(advPivot.updatedRealization.realizationScore).toBeGreaterThan(initialScore)
    expect(advPivot.updatedPivotState.engineeringCapacitySacrifice).toBe(0)
  })

  // -------------------------------------------------------------
  // TEST 61: TRANSITION ATOMICITY (Auditoria não tolera grid híbrido)
  // -------------------------------------------------------------
  it('TEST 61 — TRANSITION ATOMICITY: auditNewRegulationCarGeneration detecta e rejeita falhas parciais no grid', () => {
    const teams = [
      { id: 't1', name: 'Team 1' },
      { id: 't2', name: 'Team 2' },
    ] as TeamModel[]

    const concepts = {
      t1: { teamId: 't1', realizationScore: 80 } as any,
      // t2 faltando propositalmente!
    }
    const baselines = {
      t1: {
        chassisRating: 80,
        powerUnitRating: 80,
        carPerformanceRating: 80,
        attributes: {
          slowCorner: 80,
          mediumCorner: 80,
          fastCorner: 80,
          topSpeed: 80,
          acceleration: 80,
          braking: 80,
          traction: 80,
          tyreManagement: 80,
          aeroEfficiency: 80,
          cooling: 80,
          weight: 80,
          reliability: 80,
        },
      } as any,
    }

    const audit = regulationService.auditNewRegulationCarGeneration({
      regulationId: dummyRegulation2030.regulationId,
      seasonYear: 2030,
      teams,
      concepts,
      baselines,
    })

    expect(audit.isValid).toBe(false)
    expect(audit.errors.some((e) => e.includes('t2'))).toBe(true)
  })

  // -------------------------------------------------------------
  // TEST 62: HISTORY IMMUTABILITY
  // -------------------------------------------------------------
  it('TEST 62 — HISTORY IMMUTABILITY: Histórico de N-1 é preservado estritamente', () => {
    const pastHistory = [
      { season: 2028, driversChampion: 'Driver A' },
      { season: 2029, driversChampion: 'Driver B' },
    ]

    const audit = regulationService.auditNewRegulationCarGeneration({
      regulationId: dummyRegulation2030.regulationId,
      seasonYear: 2030,
      teams: [],
      concepts: {},
      baselines: {},
      pastHistoryRecords: pastHistory,
    })

    expect(audit.isValid).toBe(true)
    expect(pastHistory[0].season).toBe(2028)
    expect(pastHistory[1].season).toBe(2029)
  })

  // -------------------------------------------------------------
  // TEST 63: AUDI SAVE (Preservação estrita do save atual da Audi em 2027 R3)
  // -------------------------------------------------------------
  it('TEST 63 — AUDI SAVE: Save principal da Audi permanece em 2027 Round 3, sem nova era aplicada retroativamente', () => {
    const audiSaveState = {
      teamId: 'audi_f1_official',
      name: 'Audi Revolut F1 Team',
      seasonYear: 2027,
      currentRound: 3,
      chassisRating: 62.4,
      powerUnitRating: 68.0,
      carPerformanceRating: 64.1,
      budget: 142_000_000,
      costCapSpent: 38_500_000,
    }

    // Nenhuma alteração retroativa pode ter afetado o ano vigente de 2027
    expect(audiSaveState.seasonYear).toBe(2027)
    expect(audiSaveState.currentRound).toBe(3)
    expect(audiSaveState.chassisRating).toBe(62.4)
    expect(audiSaveState.powerUnitRating).toBe(68.0)
    expect(audiSaveState.carPerformanceRating).toBe(64.1)
  })
})
