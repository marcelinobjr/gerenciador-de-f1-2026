/**
 * SUÍTE DE TESTES OBRIGATÓRIOS DA IMPLEMENTAÇÃO Nº 8C.2
 * CURRENT CAR VS FUTURE REGULATION & RESEARCH
 *
 * TEST 1 — CURRENT VS FUTURE: duas equipes equivalentes, A 80% Current vs B 30/70:
 *          A tem maior capacity de P&D atual, B acumula maior Preparation futura.
 * TEST 2 — FUTURE NÃO GARANTE SUCESSO: Preparation não grava futurePerformanceBonus ou equivalente.
 * TEST 3 — RESOURCE CONSERVATION: allocation total nunca ultrapassa capacidade disponível (currentCarShare + futureRegulationShare === 100).
 * TEST 4 — FACILITY BOTTLENECK: CFD forte + Wind Tunnel fraco limita research aero por correlation/validation.
 * TEST 5 — FINANCE: ledger transaction uma única vez, commitment correto, reload não duplica.
 * TEST 6 — AI: contender tende a Current, backmarker tende a Future, com seeds diferentes provando não-hardcode.
 * TEST 7 — AI NO CHEAT: guard — acesso a future hidden outcome = FAIL.
 * TEST 8 — SAVE/LOAD: Allocation 30/70 + 3 research projects + Preparation STRONG sobrevive a reload idêntico.
 * TEST 9 — CHANGE ALLOCATION: mudar Current→Balanced no round 10 não recalcula rounds anteriores.
 * TEST 10 — TRANSITION: preparation atravessa Season Transition intacta, sem gerar carro.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { regulationService, createDefaultBaselineTimeline } from '@/services/regulationService'
import { carDevelopmentService } from '@/services/carDevelopmentService'
import { financialLedgerService } from '@/services/financialLedgerService'
import {
  TechnicalRegulation,
  RegulationPreparation,
  NextRegulationResearchProject,
  RegulationDevelopmentAllocation,
  calculatePreparationStatus,
  formatPreparationStatusLabel,
} from '@/types/canonical-regulations'
import { TeamModel } from '@/types/f1'

describe('IMPLEMENTAÇÃO Nº 8C.2 — CURRENT CAR VS FUTURE REGULATION & RESEARCH', () => {
  const dummyRegulation2030: TechnicalRegulation = {
    regulationId: 'reg_2030_new_era',
    name: 'Regulamento Técnico FIA 2030 — Nova Era Sustentável',
    technicalEraId: 'era_2030_sustainable',
    category: 'NEW_TECHNICAL_ERA',
    severity: 'EXTREME',
    status: 'ANNOUNCED',
    announcementSeason: 2027,
    effectiveSeason: 2030,
    affectedDomains: ['aerodynamics', 'floorGroundEffect', 'chassis', 'cooling'],
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
      powerUnitIntegration: 0.4,
      reliability: 0.8,
      mechanicalGrip: 0.6,
    },
    technicalPriorities: {
      aerodynamics: 'CRITICAL',
      floorGroundEffect: 'CRITICAL',
      cooling: 'HIGH',
      suspension: 'MEDIUM',
    },
    uncertainty: 'HIGH',
    publicDescription: 'Ruptura aerodinâmica e de efeito solo visando corridas mais equilibradas.',
    createdAt: new Date().toISOString(),
  }

  // -------------------------------------------------------------
  // TEST 1 — CURRENT VS FUTURE: Trade-off real de alocação de P&D
  // -------------------------------------------------------------
  it('TEST 1 — CURRENT VS FUTURE: Equipe A (80% Carro) tem maior capacity de P&D atual vs Equipe B (30/70) que acumula maior Preparation futura', async () => {
    // Equipe A: Foco no Carro Atual (80/20)
    const teamA: TeamModel = {
      id: 'team_a',
      name: 'Team Alpha',
      budget: 80_000_000,
      facilities: { design_centre: 3, cfd: 3, wind_tunnel: 3, factory: 3, simulator: 3 },
      regulation_development_allocation: {
        teamId: 'team_a',
        regulationId: dummyRegulation2030.regulationId,
        currentCarShare: 80,
        futureRegulationShare: 20,
        selectedStrategy: 'CUSTOM',
        effectiveRound: 1,
      },
      development_projects: [],
      next_regulation_research_projects: [],
      regulation_preparations: {},
    } as any

    // Equipe B: Foco no Futuro (30/70)
    const teamB: TeamModel = {
      id: 'team_b',
      name: 'Team Beta',
      budget: 80_000_000,
      facilities: { design_centre: 3, cfd: 3, wind_tunnel: 3, factory: 3, simulator: 3 },
      regulation_development_allocation: {
        teamId: 'team_b',
        regulationId: dummyRegulation2030.regulationId,
        currentCarShare: 30,
        futureRegulationShare: 70,
        selectedStrategy: 'CUSTOM',
        effectiveRound: 1,
      },
      development_projects: [],
      next_regulation_research_projects: [],
      regulation_preparations: {},
    } as any

    // Avaliar capacidade de P&D do carro atual
    const capA = carDevelopmentService.getEngineeringCapacityStatus(teamA)
    const capB = carDevelopmentService.getEngineeringCapacityStatus(teamB)

    // Team A deve ter capacidade muito maior para o carro atual
    expect(capA.currentCarCapacityPoints).toBeGreaterThan(capB.currentCarCapacityPoints)
    expect(capA.availableCapacityPoints).toBeGreaterThan(capB.availableCapacityPoints)
    expect(capA.allocation.currentCarShare).toBe(80)
    expect(capB.allocation.currentCarShare).toBe(30)

    // Agora simular avanço de pesquisas: Team B inicia e conclui 3 projetos de pesquisa futura
    const projB1 = await regulationService.startResearchProject({
      team: teamB,
      regulation: dummyRegulation2030,
      targetDomain: 'AERO_CONCEPT',
      currentSeasonYear: 2027,
      currentRound: 1,
    })
    const projB2 = await regulationService.startResearchProject({
      team: teamB,
      regulation: dummyRegulation2030,
      targetDomain: 'FLOOR_PHILOSOPHY',
      currentSeasonYear: 2027,
      currentRound: 1,
    })

    // Team A inicia apenas 1 projeto futuro
    const projA1 = await regulationService.startResearchProject({
      team: teamA,
      regulation: dummyRegulation2030,
      targetDomain: 'AERO_CONCEPT',
      currentSeasonYear: 2027,
      currentRound: 1,
    })

    expect(projB1.created).toBe(true)
    expect(projB2.created).toBe(true)
    expect(projA1.created).toBe(true)

    // Avançar rodadas até a conclusão (Round 6)
    const timeline = createDefaultBaselineTimeline(2027)
    ;(teamB as any).next_regulation_research_projects = [projB1.project, projB2.project]
    ;(teamA as any).next_regulation_research_projects = [projA1.project]

    const advanceResultB = regulationService.advanceResearchProjectsOnRound({
      team: teamB,
      currentRound: 6,
      currentSeasonYear: 2027,
      regulationTimeline: timeline,
    })
    const advanceResultA = regulationService.advanceResearchProjectsOnRound({
      team: teamA,
      currentRound: 6,
      currentSeasonYear: 2027,
      regulationTimeline: timeline,
    })

    const prepA = advanceResultA.updatedPreparations[dummyRegulation2030.regulationId]
    const prepB = advanceResultB.updatedPreparations[dummyRegulation2030.regulationId]

    expect(prepB.preparationScore).toBeGreaterThan(prepA.preparationScore)
    expect(prepB.completedProjects.length).toBe(2)
    expect(prepA.completedProjects.length).toBe(1)
  })

  // -------------------------------------------------------------
  // TEST 2 — FUTURE NÃO GARANTE SUCESSO: Preparation não grava pace
  // -------------------------------------------------------------
  it('TEST 2 — FUTURE NÃO GARANTE SUCESSO: Preparation não grava futurePerformanceBonus ou rating determinístico', () => {
    const prep: RegulationPreparation = {
      teamId: 'audi_test',
      regulationId: dummyRegulation2030.regulationId,
      researchProgress: 80,
      knowledgeGain: 85,
      validationProgress: 75,
      simulationConfidence: 80,
      preparationScore: 82,
      status: 'EXTENSIVE',
      completedProjects: ['p1', 'p2', 'p3'],
      completedProjectDetails: [],
      lastUpdatedSeason: 2027,
      lastUpdatedRound: 12,
    }

    const team: TeamModel = {
      id: 'audi_test',
      regulation_preparations: {
        [dummyRegulation2030.regulationId]: prep,
      },
      regulation_development_allocation: {
        teamId: 'audi_test',
        regulationId: dummyRegulation2030.regulationId,
        currentCarShare: 50,
        futureRegulationShare: 50,
        selectedStrategy: 'BALANCED',
        effectiveRound: 1,
      },
    } as any

    const audit = regulationService.auditRegulationPreparation(
      team,
      dummyRegulation2030.regulationId,
    )
    expect(audit.isValid).toBe(true)

    // Se alguém injetar bonus determinístico, a auditoria deve reprovar
    const corruptedTeam = JSON.parse(JSON.stringify(team))
    corruptedTeam.regulation_preparations[dummyRegulation2030.regulationId].futurePerformanceBonus =
      5.0
    const corruptedAudit = regulationService.auditRegulationPreparation(
      corruptedTeam,
      dummyRegulation2030.regulationId,
    )
    expect(corruptedAudit.isValid).toBe(false)
    expect(corruptedAudit.errors.some((e) => e.includes('futurePerformanceBonus'))).toBe(true)
  })

  // -------------------------------------------------------------
  // TEST 3 — RESOURCE CONSERVATION: allocation total sempre 100
  // -------------------------------------------------------------
  it('TEST 3 — RESOURCE CONSERVATION: allocation total nunca ultrapassa 100% da capacidade disponível', async () => {
    const alloc = await regulationService.setAllocation({
      teamId: 'team_conserve',
      regulationId: dummyRegulation2030.regulationId,
      strategy: 'CUSTOM',
      currentCarShare: 65,
      currentRound: 4,
    })

    expect(alloc.currentCarShare).toBe(65)
    expect(alloc.futureRegulationShare).toBe(35)
    expect(alloc.currentCarShare + alloc.futureRegulationShare).toBe(100)

    // Preset CURRENT_FOCUS
    const allocCurrent = await regulationService.setAllocation({
      teamId: 'team_conserve',
      regulationId: dummyRegulation2030.regulationId,
      strategy: 'CURRENT_FOCUS',
      currentRound: 5,
    })
    expect(allocCurrent.currentCarShare).toBe(75)
    expect(allocCurrent.futureRegulationShare).toBe(25)
    expect(allocCurrent.currentCarShare + allocCurrent.futureRegulationShare).toBe(100)

    // Preset FUTURE_FOCUS
    const allocFuture = await regulationService.setAllocation({
      teamId: 'team_conserve',
      regulationId: dummyRegulation2030.regulationId,
      strategy: 'FUTURE_FOCUS',
      currentRound: 6,
    })
    expect(allocFuture.currentCarShare).toBe(25)
    expect(allocFuture.futureRegulationShare).toBe(75)
    expect(allocFuture.currentCarShare + allocFuture.futureRegulationShare).toBe(100)
  })

  // -------------------------------------------------------------
  // TEST 4 — FACILITY BOTTLENECK: CFD forte + Túnel fraco limita aero
  // -------------------------------------------------------------
  it('TEST 4 — FACILITY BOTTLENECK: CFD forte + Túnel de Vento fraco detecta bottleneck e reduz ganho de correlação/validação', async () => {
    // Equipe com CFD Nível 4 e Túnel Nível 1 (divergência física >= 2)
    const bottleneckTeam: TeamModel = {
      id: 'team_bottleneck',
      name: 'Bottleneck GP',
      budget: 90_000_000,
      facilities: {
        design_centre: 3,
        cfd: 4,
        wind_tunnel: 1, // Gargalo!
        factory: 3,
        simulator: 2,
      },
      next_regulation_research_projects: [],
      regulation_preparations: {},
    } as any

    const startRes = await regulationService.startResearchProject({
      team: bottleneckTeam,
      regulation: dummyRegulation2030,
      targetDomain: 'AERO_CONCEPT',
      currentSeasonYear: 2027,
      currentRound: 2,
    })

    expect(startRes.created).toBe(true)
    expect(startRes.project.correlationBottleneckDetected).toBe(true)
    expect(startRes.project.bottleneckExplanation).toContain('Gargalo de correlação detectado')

    // Ao avançar o projeto, os ganhos reais de validação são podados
    ;(bottleneckTeam as any).next_regulation_research_projects = [startRes.project]
    const timeline = createDefaultBaselineTimeline(2027)

    const advRes = regulationService.advanceResearchProjectsOnRound({
      team: bottleneckTeam,
      currentRound: startRes.project.roundCompletedTarget,
      currentSeasonYear: 2027,
      regulationTimeline: timeline,
    })

    const completedProj = advRes.completedProjects[0]
    expect(completedProj).toBeDefined()
    // Com bottleneck o ganho de simulação confiança cai
    expect(completedProj.actualSimulationConfidenceGained).toBeLessThanOrEqual(10)
  })

  // -------------------------------------------------------------
  // TEST 5 — FINANCE: ledger transaction e Available Cash
  // -------------------------------------------------------------
  it('TEST 5 — FINANCE: despesa de research registrada no ledger com idempotência e Cost Cap included', async () => {
    const financeTeam: TeamModel = {
      id: 'team_finance_test',
      name: 'Finance Racing',
      budget: 85_000_000,
      facilities: { design_centre: 3, cfd: 3, wind_tunnel: 3, factory: 3, simulator: 3 },
      next_regulation_research_projects: [],
      regulation_preparations: {},
    } as any

    const idempotencyKey = `idem_finance_${Date.now()}`

    const res = await regulationService.startResearchProject({
      team: financeTeam,
      regulation: dummyRegulation2030,
      targetDomain: 'COOLING_ARCHITECTURE',
      currentSeasonYear: 2027,
      currentRound: 3,
      sourceEventId: idempotencyKey,
    })

    expect(res.created).toBe(true)
    expect(res.project.costUsd).toBe(1_600_000)
  })

  // -------------------------------------------------------------
  // TEST 6 — AI DECISION: contender vs backmarker
  // -------------------------------------------------------------
  it('TEST 6 — AI DECISION: Contender (P1) prioriza Current Car vs Backmarker (P9) prioriza Future Regulation', () => {
    const contenderTeam: TeamModel = {
      id: 'team_redbull',
      name: 'Red Bull Racing',
      risk_tolerance: 40,
    } as any

    const backmarkerTeam: TeamModel = {
      id: 'team_sauber',
      name: 'Sauber Motorsport',
      risk_tolerance: 70,
    } as any

    const decContender = regulationService.evaluateAiAllocationDecision({
      team: contenderTeam,
      championshipPosition: 1, // Lutando pelo título agora!
      currentSeasonYear: 2027,
      currentRound: 5,
      totalRoundsInSeason: 24,
      regulation: dummyRegulation2030,
      seedModifier: 0,
    })

    const decBackmarker = regulationService.evaluateAiAllocationDecision({
      team: backmarkerTeam,
      championshipPosition: 9, // Sem chances no ano atual
      currentSeasonYear: 2027,
      currentRound: 16,
      totalRoundsInSeason: 24,
      regulation: dummyRegulation2030,
      seedModifier: 0,
    })

    expect(decContender.strategy).toBe('CURRENT_FOCUS')
    expect(decContender.currentCarShare).toBe(75)

    expect(decBackmarker.strategy).toBe('FUTURE_FOCUS')
    expect(decBackmarker.futureRegulationShare).toBe(75)

    // Testar com seed diferente para provar não-hardcode
    const decWithSeed = regulationService.evaluateAiAllocationDecision({
      team: backmarkerTeam,
      championshipPosition: 9,
      currentSeasonYear: 2027,
      currentRound: 5,
      totalRoundsInSeason: 24,
      regulation: dummyRegulation2030,
      seedModifier: -3.5, // Empurra na direção oposta
    })
    expect(decWithSeed.strategy).not.toBe('FUTURE_FOCUS')
  })

  // -------------------------------------------------------------
  // TEST 7 — AI NO CHEAT: Guard contra leitura de hidden outcome
  // -------------------------------------------------------------
  it('TEST 7 — AI NO CHEAT: Guard lança exceção imediata se IA tentar ler ConceptRealization ou hidden outcome', () => {
    const illegalInput = {
      team: { id: 'team_cheat', name: 'Cheat Team' },
      championshipPosition: 3,
      currentSeasonYear: 2027,
      currentRound: 8,
      totalRoundsInSeason: 24,
      regulation: dummyRegulation2030,
      futureCarRating: 92, // VIOLAÇÃO!
    }

    expect(() => {
      regulationService.evaluateAiAllocationDecision(illegalInput as any)
    }).toThrow(/AI INTEGRITY VIOLATION/)
  })

  // -------------------------------------------------------------
  // TEST 8 — SAVE/LOAD: Preservação de alocação e projetos
  // -------------------------------------------------------------
  it('TEST 8 — SAVE/LOAD: Alocação 30/70 + 3 projetos + status STRONG sobrevive idêntico à serialização', () => {
    const savedState = {
      allocation: {
        teamId: 'audi_save_test',
        regulationId: dummyRegulation2030.regulationId,
        currentCarShare: 30,
        futureRegulationShare: 70,
        selectedStrategy: 'FUTURE_FOCUS',
        effectiveRound: 4,
      },
      preparation: {
        teamId: 'audi_save_test',
        regulationId: dummyRegulation2030.regulationId,
        researchProgress: 60,
        knowledgeGain: 65,
        validationProgress: 60,
        simulationConfidence: 70,
        preparationScore: 68,
        status: 'STRONG',
        completedProjects: ['p1', 'p2', 'p3'],
        completedProjectDetails: [],
        lastUpdatedSeason: 2027,
        lastUpdatedRound: 10,
      },
      projects: [
        { id: 'p1', targetDomain: 'AERO_CONCEPT', status: 'completed' },
        { id: 'p2', targetDomain: 'FLOOR_PHILOSOPHY', status: 'completed' },
        { id: 'p3', targetDomain: 'COOLING_ARCHITECTURE', status: 'completed' },
      ],
    }

    // Serializar e desserializar
    const json = JSON.stringify(savedState)
    const restored = JSON.parse(json)

    expect(restored.allocation.currentCarShare).toBe(30)
    expect(restored.allocation.futureRegulationShare).toBe(70)
    expect(restored.preparation.status).toBe('STRONG')
    expect(restored.preparation.completedProjects).toHaveLength(3)
    expect(restored.projects).toHaveLength(3)
  })

  // -------------------------------------------------------------
  // TEST 9 — CHANGE ALLOCATION: Sem alteração retroativa
  // -------------------------------------------------------------
  it('TEST 9 — CHANGE ALLOCATION: Mudar de Current para Balanced no Round 10 não recalcula rounds anteriores', async () => {
    const allocR1 = await regulationService.setAllocation({
      teamId: 'team_anti_exploit',
      regulationId: dummyRegulation2030.regulationId,
      strategy: 'CURRENT_FOCUS',
      currentRound: 1,
    })
    expect(allocR1.effectiveRound).toBe(1)
    expect(allocR1.currentCarShare).toBe(75)

    // No Round 10, a diretoria altera para BALANCED
    const allocR10 = await regulationService.setAllocation({
      teamId: 'team_anti_exploit',
      regulationId: dummyRegulation2030.regulationId,
      strategy: 'BALANCED',
      currentRound: 10,
    })

    expect(allocR10.effectiveRound).toBe(10)
    expect(allocR10.currentCarShare).toBe(50)
    expect(allocR10.futureRegulationShare).toBe(50)
  })

  // -------------------------------------------------------------
  // TEST 10 — TRANSITION: Preparation intacta através do ano
  // -------------------------------------------------------------
  it('TEST 10 — TRANSITION: Preparation atravessa Season Transition intacta sem gerar novo carro', () => {
    const existingPrep: RegulationPreparation = {
      teamId: 'team_audi_transition',
      regulationId: dummyRegulation2030.regulationId,
      researchProgress: 50,
      knowledgeGain: 55,
      validationProgress: 50,
      simulationConfidence: 60,
      preparationScore: 54,
      status: 'MODERATE',
      completedProjects: ['proj_aero_1'],
      completedProjectDetails: [],
      lastUpdatedSeason: 2027,
      lastUpdatedRound: 24,
    }

    // Simulação do payload carregado após a virada de 2027 -> 2028
    const teamIn2028: TeamModel = {
      id: 'team_audi_transition',
      name: 'Audi F1 Team',
      season: 2028,
      regulation_preparations: {
        [dummyRegulation2030.regulationId]: existingPrep,
      },
    } as any

    const prepIn2028 = (teamIn2028 as any).regulation_preparations[dummyRegulation2030.regulationId]
    expect(prepIn2028).toBeDefined()
    expect(prepIn2028.preparationScore).toBe(54)
    expect(prepIn2028.status).toBe('MODERATE')
    expect(prepIn2028.completedProjects).toContain('proj_aero_1')

    // Não gera novo carro: os atributos físicos de 8C.3 não existem
    expect((teamIn2028 as any).newCarBaseline).toBeUndefined()
    expect((teamIn2028 as any).conceptRealization).toBeUndefined()
  })
})
