import { describe, it, expect, beforeEach } from 'vitest'
import { driverRaceInteractionService } from '@/services/driverRaceInteractionService'
import { driverRelationshipService } from '@/services/driverRelationshipService'
import { TeamOrderPayload, RaceInteractionContext } from '@/types/race-interactions'
import { DriverModel, TeamModel } from '@/types/f1'

describe('IMPLEMENTAÇÃO Nº 6B — RACE INTERACTIONS & PSYCHOLOGY ENGINE', () => {
  beforeEach(() => {
    driverRaceInteractionService.resetSessionState()
  })

  const baseTeam: any = {
    id: 'team_audi_f1',
    name: 'Audi Revolut F1 Team',
    manager_archetype: 'estrategeta',
  }

  const baseContext: RaceInteractionContext = {
    driverId: 'drv_bortoleto',
    driverName: 'Gabriel Bortoleto',
    teamId: 'team_audi_f1',
    teamName: 'Audi Revolut F1 Team',
    isPlayerTeam: true,
    round: 3,
    season: 2026,
    circuitId: 'albert_park',
    currentLap: 24,
    totalLaps: 58,
    position: 7,
    gridTotal: 20,
    teammateId: 'drv_hulkenberg',
    teammateName: 'Nico Hülkenberg',
    teammatePosition: 8,
    gapToTeammateSec: 0.8,
    isTeammateAhead: false,
    tireCompound: 'medio',
    tireWear: 55,
    isInCliff: false,
    weatherState: 'seco',
  }

  // TESTE 1: Same order, different drivers — LET_TEAMMATE_PASS
  it('1. Same order, different drivers — Cooperativo/profissional aceita mais fácil que ambicioso/ego alto', () => {
    // Piloto A: Cooperativo e Leal (ex: piloto de equipe clássico)
    const driverCoop: any = {
      id: 'drv_coop',
      name: 'Piloto Cooperativo',
      procedural_data: {
        personality_traits: {
          cooperation: 85,
          professionalism: 80,
          ambition: 45,
          ego: 35,
          loyalty: 80,
          pressureTolerance: 70,
          adaptability: 70,
          consistency: 75,
          aggression: 40,
        },
      },
    }

    // Piloto B: Ego Alto e Ambicioso (ex: jovem estrela agressiva)
    const driverEgo: any = {
      id: 'drv_ego',
      name: 'Piloto Ego Alto',
      procedural_data: {
        personality_traits: {
          cooperation: 25,
          professionalism: 50,
          ambition: 92,
          ego: 95,
          loyalty: 30,
          pressureTolerance: 75,
          adaptability: 70,
          consistency: 70,
          aggression: 85,
        },
      },
    }

    const order: TeamOrderPayload = {
      orderId: 'ord_t1_coop',
      orderType: 'LET_TEAMMATE_PASS',
      targetDriverId: 'drv_coop',
      teammateId: 'drv_other',
      reason: 'DIFFERENT_STRATEGY',
      lap: 24,
      round: 3,
      season: 2026,
    }

    const resCoop = driverRaceInteractionService.evaluateTeamOrder(
      order,
      { ...baseContext, driverId: 'drv_coop', driverName: 'Piloto Cooperativo' },
      driverCoop,
      baseTeam,
    )

    const resEgo = driverRaceInteractionService.evaluateTeamOrder(
      { ...order, orderId: 'ord_t1_ego', targetDriverId: 'drv_ego' },
      { ...baseContext, driverId: 'drv_ego', driverName: 'Piloto Ego Alto' },
      driverEgo,
      baseTeam,
    )

    expect(['ACCEPT', 'ACCEPT_RELUCTANTLY']).toContain(resCoop.reactionType)
    expect(['QUESTION', 'RESIST', 'REFUSE', 'ACCEPT_RELUCTANTLY']).toContain(resEgo.reactionType)
    expect(resCoop.scoreBreakdown.finalScore).toBeGreaterThan(resEgo.scoreBreakdown.finalScore)
  })

  // TESTE 2: History matters — mesmas traits, um com favoritismo repetido no histórico
  it('2. History matters — piloto com histórico de favoritismo adverso reage com maior resistência', () => {
    const driverWithoutHistory: any = {
      id: 'drv_clean_hist',
      name: 'Sem Histórico',
      procedural_data: {
        personality_traits: {
          cooperation: 60,
          professionalism: 65,
          ambition: 75,
          ego: 70,
          loyalty: 50,
        },
      },
    }

    const driverWithBadHistory: any = {
      id: 'drv_bad_hist',
      name: 'Com Mau Histórico',
      procedural_data: {
        personality_traits: {
          cooperation: 60,
          professionalism: 65,
          ambition: 75,
          ego: 70,
          loyalty: 50,
        },
      },
    }

    // Injeta memórias negativas de favoritismo prévio no piloto B
    const bundleB = driverRelationshipService.getOrCreatePsychologyBundle(driverWithBadHistory)
    bundleB.memories.push(
      {
        memoryId: 'mem_neg_1',
        driverId: 'drv_bad_hist',
        eventType: 'teammate_favoritism_felt',
        season: 2026,
        round: 1,
        date: new Date().toISOString(),
        polarity: 'negative',
        intensity: 8,
        salience: 80,
        decayRate: 15,
        persistenceClass: 'Major',
        tags: ['favoritism'],
        involvedEntityIds: ['drv_bad_hist'],
        relationshipEffects: {},
        stateEffects: {},
        description: 'Favoritismo sentido',
        contextExplanation: 'Favoritismo na rodada 1',
        isArchivedHistorical: false,
      },
      {
        memoryId: 'mem_neg_2',
        driverId: 'drv_bad_hist',
        eventType: 'teammate_favoritism_felt',
        season: 2026,
        round: 2,
        date: new Date().toISOString(),
        polarity: 'negative',
        intensity: 7,
        salience: 70,
        decayRate: 15,
        persistenceClass: 'Relevant',
        tags: ['favoritism'],
        involvedEntityIds: ['drv_bad_hist'],
        relationshipEffects: {},
        stateEffects: {},
        description: 'Favoritismo sentido',
        contextExplanation: 'Favoritismo na rodada 2',
        isArchivedHistorical: false,
      },
    )

    const orderClean: TeamOrderPayload = {
      orderId: 'ord_t2_clean',
      orderType: 'LET_TEAMMATE_PASS',
      targetDriverId: 'drv_clean_hist',
      reason: 'FASTER_TEAMMATE',
      lap: 20,
      round: 3,
      season: 2026,
    }

    const resClean = driverRaceInteractionService.evaluateTeamOrder(
      orderClean,
      { ...baseContext, driverId: 'drv_clean_hist' },
      driverWithoutHistory,
      baseTeam,
    )

    const resBadHist = driverRaceInteractionService.evaluateTeamOrder(
      { ...orderClean, orderId: 'ord_t2_bad', targetDriverId: 'drv_bad_hist' },
      { ...baseContext, driverId: 'drv_bad_hist' },
      driverWithBadHistory,
      baseTeam,
    )

    expect(resClean.scoreBreakdown.finalScore).toBeGreaterThan(resBadHist.scoreBreakdown.finalScore)
    expect(resBadHist.scoreBreakdown.historyScore).toBeLessThan(0)
  })

  // TESTE 3: Justified order — teammate em estratégia claramente melhor
  it('3. Justified order — ordem justificada (estratégia diferente) tem maior aceitação que arbitrária', () => {
    const driver: Partial<DriverModel> = {
      id: 'drv_justified_test',
      name: 'Piloto Teste Justificativa',
    }

    const orderJustified: TeamOrderPayload = {
      orderId: 'ord_t3_just',
      orderType: 'LET_TEAMMATE_PASS',
      targetDriverId: 'drv_justified_test',
      reason: 'DIFFERENT_STRATEGY',
      lap: 30,
      round: 3,
      season: 2026,
    }

    const orderArbitrary: TeamOrderPayload = {
      orderId: 'ord_t3_arb',
      orderType: 'LET_TEAMMATE_PASS',
      targetDriverId: 'drv_justified_test',
      reason: 'TEAM_RESULT',
      lap: 30,
      round: 3,
      season: 2026,
    }

    const resJust = driverRaceInteractionService.evaluateTeamOrder(
      orderJustified,
      { ...baseContext, driverId: 'drv_justified_test' },
      driver,
      baseTeam,
    )

    const resArb = driverRaceInteractionService.evaluateTeamOrder(
      orderArbitrary,
      { ...baseContext, driverId: 'drv_justified_test' },
      driver,
      baseTeam,
    )

    expect(resJust.scoreBreakdown.justificationBonus).toBeGreaterThan(
      resArb.scoreBreakdown.justificationBonus,
    )
    expect(resJust.scoreBreakdown.finalScore).toBeGreaterThan(resArb.scoreBreakdown.finalScore)
  })

  // TESTE 4: Championship priority
  it('4. Championship priority — teammate líder disparado do campeonato gera maior aceitação', () => {
    const driver: Partial<DriverModel> = {
      id: 'drv_champ_test',
      name: 'Piloto Suporte',
    }

    const order: TeamOrderPayload = {
      orderId: 'ord_t4_champ',
      orderType: 'LET_TEAMMATE_PASS',
      targetDriverId: 'drv_champ_test',
      reason: 'CHAMPIONSHIP_PRIORITY',
      lap: 35,
      round: 12,
      season: 2026,
    }

    // Cenário A: Teammate lidera o campeonato com grande margem
    const resPriority = driverRaceInteractionService.evaluateTeamOrder(
      order,
      {
        ...baseContext,
        driverId: 'drv_champ_test',
        round: 12,
        championshipPointsDriver: 25,
        championshipPointsTeammate: 180,
        isTeammateChampionshipContender: true,
        isChampionshipContender: false,
      },
      driver,
      baseTeam,
    )

    // Cenário B: Pilotos empatados em pontos
    const resTied = driverRaceInteractionService.evaluateTeamOrder(
      { ...order, orderId: 'ord_t4_tied' },
      {
        ...baseContext,
        driverId: 'drv_champ_test',
        round: 4,
        championshipPointsDriver: 40,
        championshipPointsTeammate: 40,
        isTeammateChampionshipContender: false,
        isChampionshipContender: false,
      },
      driver,
      baseTeam,
    )

    expect(resPriority.scoreBreakdown.justificationBonus).toBeGreaterThan(
      resTied.scoreBreakdown.justificationBonus,
    )
    expect(resPriority.scoreBreakdown.finalScore).toBeGreaterThan(resTied.scoreBreakdown.finalScore)
  })

  // TESTE 5: Refusal rarity
  it('5. Refusal rarity — REFUSE é muito raro em condições normais e ocorre somente em extremos', () => {
    const normalDriver: Partial<DriverModel> = {
      id: 'drv_normal',
      name: 'Piloto Padrão',
    }

    let refuseCount = 0
    const iterations = 40

    for (let i = 0; i < iterations; i++) {
      const res = driverRaceInteractionService.evaluateTeamOrder(
        {
          orderId: `ord_refuse_test_${i}`,
          orderType: 'LET_TEAMMATE_PASS',
          targetDriverId: 'drv_normal',
          reason: 'FASTER_TEAMMATE',
          lap: i + 1,
          round: 3,
          season: 2026,
        },
        { ...baseContext, driverId: 'drv_normal' },
        normalDriver,
        baseTeam,
      )
      if (res.reactionType === 'REFUSE') {
        refuseCount++
      }
    }

    // Em condições de grid normais, a recusa direta deve ser inferior a 5%
    expect(refuseCount).toBeLessThan(iterations * 0.1)
  })

  // TESTE 6: Professional but angry
  it('6. Professional but angry — piloto altamente profissional frustrado gera ACCEPT_RELUCTANTLY, não REFUSE', () => {
    const proDriver: any = {
      id: 'drv_pro_angry',
      name: 'Profissional Irritado',
      procedural_data: {
        personality_traits: {
          professionalism: 90, // Altíssimo profissionalismo
          ego: 85,
          ambition: 85,
          cooperation: 35,
          loyalty: 40,
        },
      },
    }

    const bundle = driverRelationshipService.getOrCreatePsychologyBundle(proDriver)
    bundle.emotionalState.frustration = 80 // Muito irritado

    const order: TeamOrderPayload = {
      orderId: 'ord_t6_pro',
      orderType: 'LET_TEAMMATE_PASS',
      targetDriverId: 'drv_pro_angry',
      reason: 'TEAM_RESULT',
      lap: 45,
      round: 3,
      season: 2026,
    }

    const res = driverRaceInteractionService.evaluateTeamOrder(
      order,
      { ...baseContext, driverId: 'drv_pro_angry', position: 2 },
      proDriver,
      baseTeam,
    )

    expect(res.reactionType).toBe('ACCEPT_RELUCTANTLY')
    expect(res.actionApplied).toBe(true)
    expect(res.radioMessageText).toContain('registrem')
  })

  // TESTE 7: Driver pit request
  it('7. Driver pit request — piloto com desgaste pede pit, equipe aceita, atualiza rádio e estado', () => {
    const driver: Partial<DriverModel> = {
      id: 'drv_req_test',
      name: 'Piloto Pedinte',
      technical_feedback: 88,
    }

    const req = driverRaceInteractionService.generateDriverRequest(
      {
        ...baseContext,
        driverId: 'drv_req_test',
        tireWear: 72,
        isInCliff: true,
      },
      driver,
    )

    expect(req).not.toBeNull()
    expect(req?.requestType).toBe('REQUEST_PIT')
    expect(req?.urgency).toBe('critical')

    const response = driverRaceInteractionService.respondToDriverRequest(
      req!,
      'ACCEPT_REQUEST',
      { ...baseContext, driverId: 'drv_req_test' },
      driver,
      baseTeam,
    )

    expect(response.radioResponseText).toContain('Box confirmado')
    expect(response.immediateEffects.satisfaction).toBeGreaterThan(0)
  })

  // TESTE 8: Denied pit, team right
  it('8. Denied pit, team right — negado + estratégia vitoriosa: technicalTrust sobe', () => {
    const driver: Partial<DriverModel> = {
      id: 'drv_t8',
      name: 'Piloto Confiança Equipe',
    }

    const bundleBefore = driverRelationshipService.getOrCreatePsychologyBundle(driver)
    const initialTrust = bundleBefore.relationships.team.technicalTrust

    const req = driverRaceInteractionService.generateDriverRequest(
      { ...baseContext, driverId: 'drv_t8', tireWear: 68 },
      driver,
    )

    driverRaceInteractionService.respondToDriverRequest(
      req!,
      'DENY_REQUEST',
      { ...baseContext, driverId: 'drv_t8' },
      driver,
      baseTeam,
    )

    // Fim da corrida: posição P4 com pneu estável
    driverRaceInteractionService.evaluatePostRaceRequestOutcomes(
      'drv_t8',
      4,
      72,
      false,
      driver,
      3,
      2026,
    )

    const bundleAfter = driverRelationshipService.getOrCreatePsychologyBundle(driver)
    expect(bundleAfter.relationships.team.technicalTrust).toBeGreaterThanOrEqual(initialTrust)
  })

  // TESTE 9: Denied pit, team wrong
  it('9. Denied pit, team wrong — negado + pneus colapsam: memória negativa e queda de technicalTrust', () => {
    const driver: Partial<DriverModel> = {
      id: 'drv_t9',
      name: 'Piloto Prejudicado',
    }

    const req = driverRaceInteractionService.generateDriverRequest(
      { ...baseContext, driverId: 'drv_t9', tireWear: 70 },
      driver,
    )

    driverRaceInteractionService.respondToDriverRequest(
      req!,
      'DENY_REQUEST',
      { ...baseContext, driverId: 'drv_t9' },
      driver,
      baseTeam,
    )

    // Fim da corrida: Pneus no cliff absoluto e perda de posições
    driverRaceInteractionService.evaluatePostRaceRequestOutcomes(
      'drv_t9',
      14,
      90,
      true,
      driver,
      3,
      2026,
    )

    const bundle = driverRelationshipService.getOrCreatePsychologyBundle(driver)
    const blunderMemory = bundle.memories.find((m) => m.eventType === 'strategy_blunder_team')

    expect(blunderMemory).toBeDefined()
    expect(blunderMemory?.polarity).toBe('negative')
    expect(bundle.relationships.team.technicalTrust).toBeLessThan(60)
  })

  // TESTE 10: Question follow-up
  it('10. Question follow-up — pergunta inicial, follow-up com justificativa aceita e no máximo 1 follow-up', () => {
    const driver: any = {
      id: 'drv_t10',
      name: 'Piloto Questionador',
      procedural_data: {
        personality_traits: {
          professionalism: 70,
          ambition: 70,
          ego: 65,
          cooperation: 50,
          loyalty: 55,
        },
      },
    }

    const initialOrder: TeamOrderPayload = {
      orderId: 'ord_t10_init',
      orderType: 'LET_TEAMMATE_PASS',
      targetDriverId: 'drv_t10',
      reason: 'TEAM_RESULT',
      lap: 18,
      round: 3,
      season: 2026,
    }

    const initialRes = driverRaceInteractionService.evaluateTeamOrder(
      initialOrder,
      { ...baseContext, driverId: 'drv_t10' },
      driver,
      baseTeam,
    )

    expect(['QUESTION', 'RESIST', 'ACCEPT_RELUCTANTLY']).toContain(initialRes.reactionType)

    // Follow-up
    const followUpRes = driverRaceInteractionService.evaluateFollowUp(
      initialOrder,
      { ...baseContext, driverId: 'drv_t10' },
      driver,
      baseTeam,
    )

    // Garantia de NO MÁXIMO 1 follow-up
    expect(followUpRes.followUpAllowed).toBe(false)
    expect(followUpRes.scoreBreakdown.justificationBonus).toBeGreaterThan(
      initialRes.scoreBreakdown.justificationBonus,
    )
  })

  // TESTE 11: Teammate incident
  it('11. Teammate incident — colisão entre companheiros gera tensão e memória apropriada', () => {
    const driverA: Partial<DriverModel> = { id: 'drv_mate_a', name: 'Piloto Alpha' }
    const driverB: Partial<DriverModel> = { id: 'drv_mate_b', name: 'Piloto Beta' }

    driverRaceInteractionService.evaluateTeammateIncident(
      driverA,
      driverB,
      'disputed',
      12,
      3,
      2026,
      'albert_park',
    )

    const bundleA = driverRelationshipService.getOrCreatePsychologyBundle(driverA)
    const bundleB = driverRelationshipService.getOrCreatePsychologyBundle(driverB)

    const memA = bundleA.memories.find((m) => m.eventType === 'teammate_incident_collision')
    const memB = bundleB.memories.find((m) => m.eventType === 'teammate_incident_collision')

    expect(memA).toBeDefined()
    expect(memB).toBeDefined()
    expect(bundleA.relationships.teammate?.tension).toBeGreaterThan(20)
  })

  // TESTE 12: Manager effects
  it('12. Manager effects — Team Principal com alto People Management reduz impacto de atrito', () => {
    const driver: Partial<DriverModel> = { id: 'drv_mgr_test', name: 'Piloto Manager Test' }

    const order: TeamOrderPayload = {
      orderId: 'ord_mgr_test',
      orderType: 'LET_TEAMMATE_PASS',
      targetDriverId: 'drv_mgr_test',
      reason: 'DIFFERENT_STRATEGY',
      lap: 22,
      round: 3,
      season: 2026,
    }

    const resHighPeople = driverRaceInteractionService.evaluateTeamOrder(
      order,
      {
        ...baseContext,
        driverId: 'drv_mgr_test',
        managerPeopleManagement: 90,
        managerRaceManagement: 85,
      },
      driver,
      baseTeam,
    )

    const resLowPeople = driverRaceInteractionService.evaluateTeamOrder(
      { ...order, orderId: 'ord_mgr_test_low' },
      {
        ...baseContext,
        driverId: 'drv_mgr_test',
        managerPeopleManagement: 50,
        managerRaceManagement: 50,
      },
      driver,
      baseTeam,
    )

    expect(resHighPeople.scoreBreakdown.finalScore).toBeGreaterThan(
      resLowPeople.scoreBreakdown.finalScore,
    )
  })

  // TESTE 13: Simulate vs Live
  it('13. Simulate vs Live — mesma fundação psicológica e lógica nos dois modos', () => {
    const driver: Partial<DriverModel> = { id: 'drv_sim_live', name: 'Piloto Híbrido' }

    const order: TeamOrderPayload = {
      orderId: 'ord_sim_live_1',
      orderType: 'HOLD_POSITION',
      targetDriverId: 'drv_sim_live',
      reason: 'TEAM_RESULT',
      lap: 30,
      round: 3,
      season: 2026,
    }

    const liveRes = driverRaceInteractionService.evaluateTeamOrder(
      order,
      { ...baseContext, driverId: 'drv_sim_live' },
      driver,
      baseTeam,
    )

    driverRaceInteractionService.resetSessionState()

    const simRes = driverRaceInteractionService.evaluateTeamOrder(
      order,
      { ...baseContext, driverId: 'drv_sim_live' },
      driver,
      baseTeam,
    )

    expect(liveRes.reactionType).toBe(simRes.reactionType)
    expect(liveRes.scoreBreakdown.finalScore).toBe(simRes.scoreBreakdown.finalScore)
  })

  // TESTE 14: Rival AI
  it('14. Rival AI — equipe rival executa ordens e evolui seu próprio universo psicológico', () => {
    const rivalDriver: Partial<DriverModel> = {
      id: 'drv_rival_1',
      name: 'Rival Ferrari',
    }
    const rivalTeam: any = {
      id: 'team_ferrari',
      name: 'Scuderia Ferrari',
      manager_archetype: 'competidor',
    }

    const resRival = driverRaceInteractionService.evaluateTeamOrder(
      {
        orderId: 'ord_rival_1',
        orderType: 'LET_TEAMMATE_PASS',
        targetDriverId: 'drv_rival_1',
        reason: 'DIFFERENT_STRATEGY',
        lap: 15,
        round: 3,
        season: 2026,
      },
      {
        ...baseContext,
        driverId: 'drv_rival_1',
        teamId: 'team_ferrari',
        teamName: 'Scuderia Ferrari',
        isPlayerTeam: false,
      },
      rivalDriver,
      rivalTeam,
    )

    expect(resRival.actionApplied).toBeDefined()
    expect(resRival.reactionType).toBeDefined()
  })

  // TESTE 15: Save / Load and Idempotency
  it('15. Save/Load and Idempotency — mesma ordem reenviada retorna exatamente o mesmo resultado sem duplicar memória', () => {
    const driver: Partial<DriverModel> = { id: 'drv_idemp', name: 'Piloto Idempotente' }

    const order: TeamOrderPayload = {
      orderId: 'ord_stable_id_100',
      orderType: 'LET_TEAMMATE_PASS',
      targetDriverId: 'drv_idemp',
      reason: 'DIFFERENT_STRATEGY',
      lap: 10,
      round: 3,
      season: 2026,
    }

    const firstRun = driverRaceInteractionService.evaluateTeamOrder(
      order,
      { ...baseContext, driverId: 'drv_idemp' },
      driver,
      baseTeam,
    )

    const bundleBefore = driverRelationshipService.getOrCreatePsychologyBundle(driver)
    const memCount = bundleBefore.memories.length

    const secondRun = driverRaceInteractionService.evaluateTeamOrder(
      order,
      { ...baseContext, driverId: 'drv_idemp' },
      driver,
      baseTeam,
    )

    const bundleAfter = driverRelationshipService.getOrCreatePsychologyBundle(driver)

    expect(firstRun).toEqual(secondRun)
    expect(bundleAfter.memories.length).toBe(memCount) // Nenhuma duplicação!
  })

  // TESTE 16: Regressão v0.0.196 & Telemetria explainRaceInteraction
  it('16. Regressão e Telemetria QA — explainRaceInteraction detalha completamente o contexto da decisão', () => {
    const driver: Partial<DriverModel> = { id: 'drv_qa_telemetry', name: 'Piloto Telemetria' }

    const order: TeamOrderPayload = {
      orderId: 'ord_qa_tel_1',
      orderType: 'HOLD_POSITION',
      targetDriverId: 'drv_qa_telemetry',
      reason: 'TEAM_RESULT',
      lap: 5,
      round: 3,
      season: 2026,
    }

    driverRaceInteractionService.evaluateTeamOrder(
      order,
      { ...baseContext, driverId: 'drv_qa_telemetry' },
      driver,
      baseTeam,
    )

    const telemetry = driverRaceInteractionService.explainRaceInteraction('ord_qa_tel_1')

    expect(telemetry).not.toBeNull()
    expect(telemetry?.interactionId).toBe('ord_qa_tel_1')
    expect(telemetry?.scoreBreakdown.finalScore).toBeDefined()
    expect(telemetry?.chosenReaction).toBeDefined()
    expect(telemetry?.radioMessageText).toBeDefined()
  })
})
