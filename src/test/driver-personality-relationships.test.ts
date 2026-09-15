import { describe, it, expect, beforeEach } from 'vitest'
import { driverRelationshipService } from '@/services/driverRelationshipService'
import {
  getDriverPersonalityTraits,
  deriveTeammateStatus,
  formatQualitativeState,
} from '@/lib/driver-psychology-utils'
import { DriverModel, TeamModel } from '@/types/f1'

describe('IMPLEMENTAÇÃO Nº 6A — PERSONALIDADE, RELAÇÕES & MEMÓRIA (Testes Canônicos 73-87)', () => {
  let mockTeam: TeamModel
  let driverHulk: DriverModel
  let driverBortoleto: DriverModel

  beforeEach(() => {
    mockTeam = {
      id: 'team_audi_2026',
      name: 'Audi Revolut F1 Team',
      color: '#FF2A00',
      chassis_level: 50,
      aero_level: 50,
      strategy_level: 50,
      budget: 85_000_000,
      engine_supplier: 'Audi',
      user_id: 'user_player',
      team_key: 'audi',
      manager_name: 'Mattia Binotto',
      manager_profile: {
        id: 'gestor',
        title: 'O Gestor',
        baseAttributes: {
          peopleManagement: 82,
        },
      },
    }

    driverHulk = {
      id: 'mbj-019',
      name: 'Nico Hülkenberg',
      nationality: 'Alemanha',
      age: 38,
      speed: 88,
      consistency: 89,
      rain: 91,
      defense: 88,
      salary: 7_000_000,
      contract_end: 2027,
      team_id: 'team_audi_2026',
      role: 'titular',
      seat_security: 85,
      morale: 84,
    }

    driverBortoleto = {
      id: 'mbj-020',
      name: 'Gabriel Bortoleto',
      nationality: 'Brasil',
      age: 21,
      speed: 86,
      consistency: 85,
      rain: 86,
      defense: 87,
      salary: 3_500_000,
      contract_end: 2027,
      team_id: 'team_audi_2026',
      role: 'titular',
      seat_security: 80,
      morale: 89,
    }
  })

  // Teste 73: Mesmo evento, personalidades diferentes -> reações diferentes
  it('73. Mesmo evento (upgrade preterido) com personalidades diferentes resulta em reações e intensidades distintas', () => {
    // Hülkenberg: Mais maduro, cooperação mais alta (88), ego moderado
    // Piloto hipotético com Ambição 99, Ego 99, Cooperação 40
    const primaDonnaDriver: DriverModel & { procedural_data?: any } = {
      id: 'test_primadonna',
      name: 'Super Ego Driver',
      nationality: 'Internacional',
      age: 26,
      speed: 95,
      consistency: 90,
      rain: 90,
      defense: 90,
      salary: 20_000_000,
      contract_end: 2026,
      team_id: 'team_audi_2026',
      role: 'titular',
      seat_security: 80,
      morale: 80,
      procedural_data: {
        psychology: {
          ambition: 99,
          ego: 99,
          cooperation: 35,
          loyalty: 40,
          pressureTolerance: 70,
          professionalism: 60,
          adaptability: 75,
          dominantTrait: 'ambicioso',
        },
      },
    }

    const resHulk = driverRelationshipService.processDomainEvent({
      driver: driverHulk,
      eventType: 'upgrade_denied_priority',
      season: 2026,
      round: 3,
      sourceEventId: 'test_upg_denied_hulk_r3',
      description: 'Companheiro recebeu novo assoalho primeiro',
      teammate: driverBortoleto,
      team: mockTeam,
    })

    const resPrimaDonna = driverRelationshipService.processDomainEvent({
      driver: primaDonnaDriver,
      eventType: 'upgrade_denied_priority',
      season: 2026,
      round: 3,
      sourceEventId: 'test_upg_denied_prima_r3',
      description: 'Companheiro recebeu novo assoalho primeiro',
      teammate: driverBortoleto,
      team: mockTeam,
    })

    // O piloto com Ego 99 e baixa cooperação deve ter um salto de frustração muito maior
    const frustHulk = resHulk.auditLog.finalStateDeltas.frustration || 0
    const frustPrima = resPrimaDonna.auditLog.finalStateDeltas.frustration || 0

    expect(frustPrima).toBeGreaterThan(frustHulk)
    expect(resPrimaDonna.auditLog.finalRelationshipDeltas.trust).toBeLessThan(
      resHulk.auditLog.finalRelationshipDeltas.trust,
    )
  })

  // Teste 74: Mesma personalidade, históricos diferentes -> reação mais forte em quem tem histórico de favorecimento adverso
  it('74. Histórico acumulado modula a reação: preterido pela 3ª vez tem reação mais severa que na 1ª vez', () => {
    const testDriver: DriverModel = {
      id: 'test_history_driver',
      name: 'Regular Driver',
      nationality: 'Alemanha',
      age: 28,
      speed: 85,
      consistency: 85,
      rain: 85,
      defense: 85,
      salary: 5_000_000,
      contract_end: 2027,
      team_id: 'team_audi_2026',
      role: 'titular',
      morale: 75,
    }

    // 1ª vez
    const res1 = driverRelationshipService.processDomainEvent({
      driver: testDriver,
      eventType: 'upgrade_denied_priority',
      season: 2026,
      round: 1,
      sourceEventId: 'upg_denied_1',
      description: '1º caso de upgrade negado',
      team: mockTeam,
    })

    // 2ª vez
    driverRelationshipService.processDomainEvent({
      driver: testDriver,
      eventType: 'upgrade_denied_priority',
      season: 2026,
      round: 2,
      sourceEventId: 'upg_denied_2',
      description: '2º caso de upgrade negado',
      team: mockTeam,
    })

    // 3ª vez
    const res3 = driverRelationshipService.processDomainEvent({
      driver: testDriver,
      eventType: 'upgrade_denied_priority',
      season: 2026,
      round: 3,
      sourceEventId: 'upg_denied_3',
      description: '3º caso de upgrade negado',
      team: mockTeam,
    })

    const frustDelta1 = res1.auditLog.finalStateDeltas.frustration || 0
    const frustDelta3 = res3.auditLog.finalStateDeltas.frustration || 0

    expect(frustDelta3).toBeGreaterThan(frustDelta1)
    expect(res3.memoryCreated?.persistenceClass).toBe('Major')
  })

  // Teste 75: Memory decay: Minor perde influência rápido, Career-defining persiste, histórico não desaparece
  it('75. Memory decay reduz saliência ativa mantendo integridade histórica no log', () => {
    const decayDriver: DriverModel = {
      id: 'test_decay_driver',
      name: 'Decay Driver',
      nationality: 'Itália',
      age: 25,
      speed: 80,
      consistency: 80,
      rain: 80,
      defense: 80,
      salary: 2_000_000,
      contract_end: 2026,
      role: 'titular',
    }

    const { memoryCreated } = driverRelationshipService.processDomainEvent({
      driver: decayDriver,
      eventType: 'upgrade_equal',
      season: 2026,
      round: 1,
      sourceEventId: 'minor_mem_1',
      description: 'Equipamento igualitário distribuído',
    })

    expect(memoryCreated?.persistenceClass).toBe('Minor')
    const initialSalience = memoryCreated?.salience ?? 30

    // Avança 2 rodadas
    driverRelationshipService.processRoundDecayAndBaselineRegression(decayDriver.id)
    driverRelationshipService.processRoundDecayAndBaselineRegression(decayDriver.id)

    const bundle = driverRelationshipService.getOrCreatePsychologyBundle(decayDriver)
    const memAfter = bundle.memories.find((m) => m.sourceEventId === 'minor_mem_1')

    expect(memAfter).toBeDefined()
    expect(memAfter!.salience).toBeLessThan(initialSalience)
    // O histórico NUNCA é apagado (permanece no array)
    expect(bundle.memories.length).toBeGreaterThan(0)
  })

  // Teste 76: Resiliência: alta -> recuperação mais rápida
  it('76. Piloto resiliente se recupera mais depressa da frustração do que um piloto não-resiliente', () => {
    const resilientDriver: DriverModel & { procedural_data?: any } = {
      id: 'resilient_drv',
      name: 'Resilient Man',
      nationality: 'Brasil',
      age: 30,
      speed: 85,
      consistency: 85,
      rain: 85,
      defense: 85,
      salary: 5_000_000,
      contract_end: 2027,
      procedural_data: {
        psychology: {
          resilience: 95,
          pressureTolerance: 85,
          ambition: 75,
          loyalty: 75,
          cooperation: 80,
          aggression: 60,
          professionalism: 85,
          adaptability: 80,
          dominantTrait: 'resiliente',
        },
      },
    }

    const nonResilientDriver: DriverModel & { procedural_data?: any } = {
      id: 'fragile_drv',
      name: 'Fragile Mind',
      nationality: 'França',
      age: 22,
      speed: 85,
      consistency: 85,
      rain: 85,
      defense: 85,
      salary: 5_000_000,
      contract_end: 2027,
      procedural_data: {
        psychology: {
          resilience: 35,
          pressureTolerance: 40,
          ambition: 75,
          loyalty: 75,
          cooperation: 80,
          aggression: 60,
          professionalism: 85,
          adaptability: 80,
          dominantTrait: 'impulsivo',
        },
      },
    }

    // Aplica choque negativo idêntico aos dois
    driverRelationshipService.processDomainEvent({
      driver: resilientDriver,
      eventType: 'race_dnf_mechanical',
      season: 2026,
      round: 4,
      sourceEventId: 'dnf_resilient',
      description: 'Quebra de motor no fim da prova',
    })
    driverRelationshipService.processDomainEvent({
      driver: nonResilientDriver,
      eventType: 'race_dnf_mechanical',
      season: 2026,
      round: 4,
      sourceEventId: 'dnf_fragile',
      description: 'Quebra de motor no fim da prova',
    })

    const frustResInitial =
      driverRelationshipService.getOrCreatePsychologyBundle(resilientDriver).emotionalState
        .frustration
    const frustFragInitial =
      driverRelationshipService.getOrCreatePsychologyBundle(nonResilientDriver).emotionalState
        .frustration

    // Passam-se 2 rodadas de recuperação
    driverRelationshipService.processRoundDecayAndBaselineRegression(resilientDriver.id)
    driverRelationshipService.processRoundDecayAndBaselineRegression(resilientDriver.id)
    driverRelationshipService.processRoundDecayAndBaselineRegression(nonResilientDriver.id)
    driverRelationshipService.processRoundDecayAndBaselineRegression(nonResilientDriver.id)

    const frustResAfter =
      driverRelationshipService.getOrCreatePsychologyBundle(resilientDriver).emotionalState
        .frustration
    const frustFragAfter =
      driverRelationshipService.getOrCreatePsychologyBundle(nonResilientDriver).emotionalState
        .frustration

    const dropRes = frustResInitial - frustResAfter
    const dropFrag = frustFragInitial - frustFragAfter

    expect(dropRes).toBeGreaterThan(dropFrag)
  })

  // Teste 77: Pressure tolerance: seat security baixo + alta tolerance -> estável; baixa -> pressão sobe mais
  it('77. Seat security baixo com alta tolerância à pressão não colapsa o estado emocional', () => {
    const toughDriver: DriverModel & { procedural_data?: any } = {
      id: 'tough_drv',
      name: 'Cold Blood',
      nationality: 'Finlândia',
      age: 32,
      speed: 84,
      consistency: 86,
      rain: 85,
      defense: 86,
      salary: 6_000_000,
      contract_end: 2026,
      seat_security: 35, // Baixo!
      procedural_data: {
        psychology: {
          pressureTolerance: 94,
          ambition: 80,
          loyalty: 80,
          cooperation: 80,
          aggression: 60,
          professionalism: 90,
          adaptability: 80,
          dominantTrait: 'metodico',
        },
      },
    }

    const panickyDriver: DriverModel & { procedural_data?: any } = {
      id: 'panicky_drv',
      name: 'Nervous Pilot',
      nationality: 'Espanha',
      age: 23,
      speed: 84,
      consistency: 86,
      rain: 85,
      defense: 86,
      salary: 6_000_000,
      contract_end: 2026,
      seat_security: 35, // Baixo!
      procedural_data: {
        psychology: {
          pressureTolerance: 38,
          ambition: 80,
          loyalty: 80,
          cooperation: 80,
          aggression: 60,
          professionalism: 90,
          adaptability: 80,
          dominantTrait: 'impulsivo',
        },
      },
    }

    const resTough = driverRelationshipService.processDomainEvent({
      driver: toughDriver,
      eventType: 'contract_threat_academy',
      season: 2026,
      round: 5,
      sourceEventId: 'threat_tough_1',
      description: 'Academia prepara substituto em testes',
    })

    const resPanicky = driverRelationshipService.processDomainEvent({
      driver: panickyDriver,
      eventType: 'contract_threat_academy',
      season: 2026,
      round: 5,
      sourceEventId: 'threat_panicky_1',
      description: 'Academia prepara substituto em testes',
    })

    const pressDeltaTough = resTough.auditLog.finalStateDeltas.pressure || 0
    const pressDeltaPanicky = resPanicky.auditLog.finalStateDeltas.pressure || 0

    expect(pressDeltaPanicky).toBeGreaterThan(pressDeltaTough)
  })

  // Teste 78 & 79: Promessas cumpridas e quebradas
  it('78 & 79. Promessa de igualdade de equipamento cumprida eleva confiança; quebra contínua transforma em Promessa Quebrada', () => {
    const promiseDriver: DriverModel = {
      id: 'promise_tester',
      name: 'Promise Receiver',
      nationality: 'Alemanha',
      age: 29,
      speed: 86,
      consistency: 85,
      rain: 85,
      defense: 85,
      salary: 4_000_000,
      contract_end: 2027,
    }

    // Registra promessa de igualdade
    const promise = driverRelationshipService.createPromise(
      promiseDriver.id,
      'equalEquipment',
      2026,
      1,
      'Garantia de igualdade de especificações entre os carros',
    )
    expect(promise.status).toBe('active')

    // 1º upgrade negado: em observação (não quebra imediatamente)
    driverRelationshipService.processDomainEvent({
      driver: promiseDriver,
      eventType: 'upgrade_denied_priority',
      season: 2026,
      round: 2,
      sourceEventId: 'prom_upg_1',
      description: '1ª peça única entregue ao parceiro',
    })
    expect(promise.status).toBe('active')

    // 2º upgrade negado
    driverRelationshipService.processDomainEvent({
      driver: promiseDriver,
      eventType: 'upgrade_denied_priority',
      season: 2026,
      round: 4,
      sourceEventId: 'prom_upg_2',
      description: '2ª peça única entregue ao parceiro',
    })

    // 3º upgrade consecutivo negado: Promessa quebrada!
    driverRelationshipService.processDomainEvent({
      driver: promiseDriver,
      eventType: 'upgrade_denied_priority',
      season: 2026,
      round: 6,
      sourceEventId: 'prom_upg_3',
      description: '3ª peça única entregue ao parceiro',
    })

    expect(promise.status).toBe('broken')

    // Avalia o fairness subjetivo
    const fairness = driverRelationshipService.calculatePerceivedFairness(promiseDriver.id)
    expect(fairness).toBeLessThan(50)
  })

  // Teste 80: Academy threat: contrato longo + alta segurança -> quase imune a pânico
  it('80. Titular com contrato longo e alta segurança de assento não entra em crise por teste da academia', () => {
    const secureVeteran: DriverModel = {
      id: 'secure_vet',
      name: 'Safe Veteran',
      nationality: 'Reino Unido',
      age: 33,
      speed: 90,
      consistency: 90,
      rain: 90,
      defense: 90,
      salary: 15_000_000,
      contract_end: 2029, // Contrato de longo prazo!
      seat_security: 95,
      role: 'titular',
    }

    const res = driverRelationshipService.processDomainEvent({
      driver: secureVeteran,
      eventType: 'contract_threat_academy',
      season: 2026,
      round: 3,
      sourceEventId: 'vet_academy_test_1',
      description: 'Piloto jovem participou de teste livre',
    })

    expect(res.memoryCreated?.persistenceClass).toBe('Minor')
    expect(res.auditLog.finalStateDeltas.pressure).toBeLessThanOrEqual(2)
  })

  // Teste 81: Teammate rivalry: rivalidade cresce e respeito coexiste
  it('81. Status derivado do companheiro permite coexistência de Respeito e Rivalidade sem ódio', () => {
    // Alta rivalidade + alto respeito = Competitive ou Rivals
    const status1 = deriveTeammateStatus(85, 70, 75, 20)
    expect(['Competitive', 'Rivals']).toContain(status1)

    // Baixa cooperação + alta tensão = Tense ou Hostile
    const status2 = deriveTeammateStatus(40, 30, 85, 80)
    expect(status2).toBe('Hostile')
  })

  // Teste 82: Manager: Gestor com peopleManagement amortece danos
  it('82. Team Principal com peopleManagement amortece frustrações sem zerar as consequências', () => {
    const leaderTeam: TeamModel = {
      ...mockTeam,
      manager_profile: {
        id: 'lider',
        title: 'O Líder',
        baseAttributes: { peopleManagement: 90 },
      },
    }

    const coldTeam: TeamModel = {
      ...mockTeam,
      manager_profile: {
        id: 'estrategista',
        title: 'O Estrategista',
        baseAttributes: { peopleManagement: 50 },
      },
    }

    const resLeader = driverRelationshipService.processDomainEvent({
      driver: driverHulk,
      eventType: 'upgrade_denied_priority',
      season: 2026,
      round: 8,
      sourceEventId: 'mgr_test_leader',
      description: 'Peça nova para Bortoleto',
      team: leaderTeam,
    })

    const resCold = driverRelationshipService.processDomainEvent({
      driver: driverHulk,
      eventType: 'upgrade_denied_priority',
      season: 2026,
      round: 8,
      sourceEventId: 'mgr_test_cold',
      description: 'Peça nova para Bortoleto',
      team: coldTeam,
    })

    const frustLeader = resLeader.auditLog.finalStateDeltas.frustration || 0
    const frustCold = resCold.auditLog.finalStateDeltas.frustration || 0

    expect(frustLeader).toBeLessThanOrEqual(frustCold)
    // O impacto NUNCA é zerado automaticamente
    expect(frustLeader).toBeGreaterThan(0)
  })

  // Teste 83: Troca de equipe preserva identidade e memórias históricas
  it('83. Transferência de equipe arquiva a relação antiga como histórica e cria nova relação limpa', () => {
    const driverToTransfer: DriverModel = {
      id: 'transfer_driver_1',
      name: 'Carlos Sainz',
      nationality: 'Espanha',
      age: 31,
      speed: 89,
      consistency: 88,
      rain: 87,
      defense: 89,
      salary: 10_000_000,
      contract_end: 2026,
      team_id: 'team_audi_2026',
      role: 'titular',
    }

    driverRelationshipService.processDomainEvent({
      driver: driverToTransfer,
      eventType: 'race_podium',
      season: 2026,
      round: 10,
      sourceEventId: 'podium_audi_sainz',
      description: 'Pódio conquistado pela Audi em Spa',
    })

    // Troca para a Ferrari
    driverRelationshipService.handleTeamTransfer(
      driverToTransfer.id,
      'team_audi_2026',
      'team_ferrari',
    )

    const bundle = driverRelationshipService.getOrCreatePsychologyBundle(driverToTransfer)
    expect(bundle.relationships.historicalTeams).toBeDefined()
    expect(bundle.relationships.historicalTeams!['team_audi_2026']).toBeDefined()
    // As memórias permanecem
    expect(bundle.memories.length).toBeGreaterThan(0)
  })

  // Teste 84: Piloto procedural usa exatamente o mesmo sistema
  it('84. Piloto procedural da Academia 4C é processado pelo mesmo serviço idêntico sem código paralelo', () => {
    const proceduralPilot: DriverModel & { procedural_data?: any } = {
      id: 'proc_cadet_99',
      name: 'Arthur Leclerc Jr',
      nationality: 'Mônaco',
      age: 18,
      speed: 78,
      consistency: 76,
      rain: 79,
      defense: 77,
      salary: 500_000,
      contract_end: 2028,
      role: 'reserva',
      procedural_data: {
        psychology: {
          ambition: 85,
          loyalty: 88,
          aggression: 75,
          cooperation: 82,
          pressureTolerance: 78,
          professionalism: 80,
          adaptability: 84,
          ego: 70,
          resilience: 80,
          dominantTrait: 'adaptavel',
        },
      },
    }

    const audit = driverRelationshipService.auditDriverPsychology(proceduralPilot)
    expect(audit.personalityTraits.ambition).toBe(85)
    expect(audit.personalityTraits.loyalty).toBe(88)
    expect(audit.integrityProblems.length).toBe(0)
  })

  // Teste 85: Idempotência de eventos de domínio (sem duplicação ao processar novamente)
  it('85. Processar o mesmo sourceEventId duas vezes é 100% idempotente e não duplica efeitos', () => {
    const sourceId = 'idempotent_test_event_99'
    const bundleBefore = driverRelationshipService.getOrCreatePsychologyBundle(driverBortoleto)
    const initialMemCount = bundleBefore.memories.length
    const initialTrust = bundleBefore.relationships.teamPrincipal.trust

    // 1ª execução
    driverRelationshipService.processDomainEvent({
      driver: driverBortoleto,
      eventType: 'race_podium',
      season: 2026,
      round: 3,
      sourceEventId: sourceId,
      description: 'Pódio em Melbourne',
    })

    const countAfterFirst = bundleBefore.memories.length
    const trustAfterFirst = bundleBefore.relationships.teamPrincipal.trust

    expect(countAfterFirst).toBe(initialMemCount + 1)
    expect(trustAfterFirst).toBeGreaterThan(initialTrust)

    // 2ª execução (mesmo sourceEventId)
    const secondCall = driverRelationshipService.processDomainEvent({
      driver: driverBortoleto,
      eventType: 'race_podium',
      season: 2026,
      round: 3,
      sourceEventId: sourceId,
      description: 'Pódio em Melbourne (Duplicado)',
    })

    const countAfterSecond = bundleBefore.memories.length
    const trustAfterSecond = bundleBefore.relationships.teamPrincipal.trust

    // Não alterou nada!
    expect(countAfterSecond).toBe(countAfterFirst)
    expect(trustAfterSecond).toBe(trustAfterFirst)
    expect(secondCall.auditLog.baseImpact).toBe(0)
  })
})
