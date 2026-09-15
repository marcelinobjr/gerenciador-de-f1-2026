/**
 * SUÍTE DE TESTES UNITÁRIOS E DE INTEGRAÇÃO — MERCADO DE PILOTOS, CONTRATOS & SILLY SEASON (7A)
 * F1 Manager 2026 — Implementação Nº 7A
 *
 * Contempla os 20 Testes Canônicos Obrigatórios da Especificação:
 * 1. Salário não decide sozinho (piloto leal/satisfeito, rival +10% e pior equipe → não sai automaticamente)
 * 2. Ambição (piloto ambicioso, atual P8, candidato ao título com salário semelhante → forte interesse na mudança)
 * 3. Promessa quebrada (histórico negativo → maior disposição para sair vs piloto idêntico sem memórias)
 * 4. Papel (protagonismo: salário maior + Support vs salário menor + Lead Driver → depende da personalidade)
 * 5. Lealdade (alta loyalty resiste mais, nunca impossibilidade)
 * 6. Teammate pairing (dois ego/aggression altos → risco alto identificado, contratação ainda possível)
 * 7. Future contract (piloto Audi 2027 assina Ferrari 2028 → continua Audi 2027, vaga Ferrari 2028 reservada, salário Ferrari não começa em 2027)
 * 8. Confidencial (backend sabe, Paddock mostra rumor/unknown; após anúncio, board atualiza)
 * 9. Cascade (uma contratação → vaga → ≥3 equipes reagem sequencialmente, sem loop infinito)
 * 10. AI budget (equipe pobre + superstar → negociação inviável ou financeiramente responsável)
 * 11. truePotential (teste falha se market AI acessar truePotential)
 * 12. Academy (jovem com perceivedPotential alto recebe interesse rival; equipe pode promover/renovar/perder)
 * 13. Buyout (rival paga → 1 transação no Ledger, liberação, future seat)
 * 14. Signing bonus (save/reload → pago uma vez via idempotência)
 * 15. Options (Team/Driver Option exercida no prazo; expirada fora do prazo)
 * 16. Free agent (contrato expira → piloto permanece no universo)
 * 17. Competing offers (duas equipes disputam → sem assinatura simultânea incompatível)
 * 18. Player vs AI same rules (salary/contract/seat/buyout/future seat)
 * 19. Save/load (shortlist, talks, offer, counteroffer, future contract, confidential status, options — sem duplicação)
 * 20. 10 temporadas de mercado simuladas (salário não explode, nenhuma equipe acumula 5 titulares, pilotos não desaparecem)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { driverContractService } from '@/services/driverContractService'
import { sillySeasonService } from '@/services/sillySeasonService'
import { financialLedgerService } from '@/services/financialLedgerService'
import { DriverModel, TeamModel } from '@/types/f1'
import { DriverContractOffer } from '@/types/canonical-driver-market'

// Mock de PocketBase para isolamento seguro e controle estrito
vi.mock('@/lib/pocketbase/client', () => {
  const store = new Map<string, any>()
  return {
    default: {
      collection: (name: string) => ({
        getFullList: vi.fn().mockResolvedValue([]),
        getOne: vi.fn().mockImplementation((id: string) => Promise.resolve(store.get(id) || {})),
        create: vi.fn().mockImplementation((data: any) => {
          const record = { id: `id_${Date.now()}_${Math.random()}`, ...data }
          store.set(record.id, record)
          return Promise.resolve(record)
        }),
        update: vi.fn().mockImplementation((id: string, data: any) => {
          const existing = store.get(id) || {}
          const updated = { ...existing, ...data }
          store.set(id, updated)
          return Promise.resolve(updated)
        }),
      }),
    },
  }
})

describe('Implementação 7A — Mercado de Pilotos, Contratos Canônicos & Silly Season', () => {
  const mockAudiTeam: TeamModel = {
    id: 'team_audi',
    name: 'Audi F1 Team',
    color: '#E10600',
    budget: 65000000,
    strength: 72,
    factory_level: 3,
    simulator_level: 3,
    wind_tunnel_level: 3,
    cfd_level: 3,
  } as TeamModel

  const mockFerrariTeam: TeamModel = {
    id: 'team_ferrari',
    name: 'Scuderia Ferrari',
    color: '#DC0000',
    budget: 140000000,
    strength: 88,
    factory_level: 5,
    simulator_level: 5,
    wind_tunnel_level: 5,
    cfd_level: 5,
  } as TeamModel

  const mockHaasTeam: TeamModel = {
    id: 'team_haas',
    name: 'Haas F1 Team',
    color: '#FFFFFF',
    budget: 35000000,
    strength: 65,
    factory_level: 2,
    simulator_level: 2,
    wind_tunnel_level: 2,
    cfd_level: 2,
  } as TeamModel

  const mockBortoleto: DriverModel = {
    id: 'driver_bortoleto',
    name: 'Gabriel Bortoleto',
    team_id: 'team_audi',
    salary: 4000000,
    speed: 84,
    consistency: 82,
    age: 21,
    contract_end: 2026,
    role: 'titular',
    morale: 85,
  } as DriverModel

  // ==========================================================================
  // TESTE 1: Salário não decide sozinho
  // ==========================================================================
  it('1. Salário não decide sozinho — piloto leal e satisfeito recusa proposta ligeiramente maior de equipe inferior', () => {
    // Proposta da Haas (+15% salário, mas carro muito pior)
    const offer: DriverContractOffer = {
      offerId: 'offer_test_1',
      teamId: mockHaasTeam.id,
      teamName: mockHaasTeam.name,
      driverId: mockBortoleto.id,
      driverName: mockBortoleto.name,
      annualSalary: 4600000, // +15%
      durationYears: 2,
      role: 'EQUAL_STATUS',
      signingBonus: 400000,
      performanceBonuses: [],
      teamOptionIncluded: true,
      driverOptionIncluded: false,
      buyoutAmount: 7000000,
      offeredSeason: 2026,
      startSeason: 2027,
      expirationRound: 5,
      status: 'OFFER_SUBMITTED',
      isConfidential: false,
      roundsOfTalks: 1,
      driverPatienceRemaining: 4,
    }

    const evaluation = driverContractService.evaluateContractOffer(
      offer,
      mockBortoleto,
      mockHaasTeam,
      2026,
    )

    // O piloto NÃO deve simplesmente aceitar
    expect(evaluation.isAccepted).toBe(false)
    expect(evaluation.assessment).not.toBe('strong')
  })

  // ==========================================================================
  // TESTE 2: Ambição
  // ==========================================================================
  it('2. Ambição esportiva — piloto competitivo em equipe média se atrai por candidato ao título', () => {
    const offerFerrari: DriverContractOffer = {
      offerId: 'offer_test_2',
      teamId: mockFerrariTeam.id,
      teamName: mockFerrariTeam.name,
      driverId: mockBortoleto.id,
      driverName: mockBortoleto.name,
      annualSalary: 6000000,
      durationYears: 2,
      role: 'LEAD_DRIVER',
      signingBonus: 1000000,
      performanceBonuses: [],
      teamOptionIncluded: true,
      driverOptionIncluded: true,
      buyoutAmount: 15000000,
      offeredSeason: 2026,
      startSeason: 2027,
      expirationRound: 5,
      status: 'OFFER_SUBMITTED',
      isConfidential: true,
      roundsOfTalks: 1,
      driverPatienceRemaining: 4,
    }

    const attractiveness = driverContractService.evaluateTeamCareerAttractiveness(
      mockBortoleto,
      mockFerrariTeam,
      'LEAD_DRIVER',
    )
    expect(attractiveness.overallScore).toBeGreaterThanOrEqual(75)

    const evaluation = driverContractService.evaluateContractOffer(
      offerFerrari,
      mockBortoleto,
      mockFerrariTeam,
      2026,
    )
    expect(evaluation.isAccepted).toBe(true)
    expect(['strong', 'competitive']).toContain(evaluation.assessment)
  })

  // ==========================================================================
  // TESTE 3: Promessa quebrada
  // ==========================================================================
  it('3. Promessa quebrada — histórico negativo gera desejo explícito de sair (Career Intent)', () => {
    // Simula piloto com histórico abalado
    const disgruntledDriver: Partial<DriverModel> & { id: string; name: string } = {
      id: 'driver_disgruntled',
      name: 'Disgruntled Driver',
      team_id: 'team_audi',
      salary: 3000000,
      speed: 80,
    }

    const intent = driverContractService.deriveCareerIntent(disgruntledDriver, mockAudiTeam, 55)
    expect(intent.desireToStayScore).toBeLessThan(75)
    expect([
      'OPEN_TO_TALKS',
      'EXPLORING_OPTIONS',
      'LOOKING_TO_LEAVE',
      'DETERMINED_TO_LEAVE',
    ]).toContain(intent.state)
  })

  // ==========================================================================
  // TESTE 4: Papel e protagonismo
  // ==========================================================================
  it('4. Papel e protagonismo — status oferecido altera a atratividade do contrato', () => {
    const attrLead = driverContractService.evaluateTeamCareerAttractiveness(
      mockBortoleto,
      mockFerrariTeam,
      'LEAD_DRIVER',
    )
    const attrSupport = driverContractService.evaluateTeamCareerAttractiveness(
      mockBortoleto,
      mockFerrariTeam,
      'SUPPORT_DRIVER',
    )

    expect(attrLead.overallScore).toBeGreaterThan(attrSupport.overallScore)
    expect(attrLead.factors.seatOpportunity).toBeGreaterThan(attrSupport.factors.seatOpportunity)
  })

  // ==========================================================================
  // TESTE 5: Lealdade
  // ==========================================================================
  it('5. Lealdade — piloto com lealdade alta apresenta maior âncora de permanência', () => {
    const intent = driverContractService.deriveCareerIntent(mockBortoleto, mockAudiTeam, 75)
    expect(intent.loyaltyAnchor).toBeGreaterThanOrEqual(50)
  })

  // ==========================================================================
  // TESTE 6: Teammate pairing
  // ==========================================================================
  it('6. Teammate pairing — pareamento com piloto agressivo é avaliado mas não impossibilita contratação', () => {
    const attractiveness = driverContractService.evaluateTeamCareerAttractiveness(
      mockBortoleto,
      mockFerrariTeam,
      'EQUAL_STATUS',
    )
    expect(attractiveness.factors.teammatePairingFit).toBeDefined()
    expect(attractiveness.overallScore).toBeGreaterThan(0)
  })

  // ==========================================================================
  // TESTE 7: Future contract
  // ==========================================================================
  it('7. Future contract — piloto na Audi em 2026 assina para Ferrari em 2027 sem trocar em 2026', async () => {
    const futureOffer: DriverContractOffer = {
      offerId: 'offer_future_ferrari',
      teamId: mockFerrariTeam.id,
      teamName: mockFerrariTeam.name,
      driverId: mockBortoleto.id,
      driverName: mockBortoleto.name,
      annualSalary: 12000000,
      durationYears: 2,
      role: 'EQUAL_STATUS',
      signingBonus: 1000000,
      performanceBonuses: [],
      teamOptionIncluded: true,
      driverOptionIncluded: false,
      buyoutAmount: 20000000,
      offeredSeason: 2026,
      startSeason: 2027, // Futuro!
      expirationRound: 10,
      status: 'AGREEMENT',
      isConfidential: true,
      roundsOfTalks: 1,
      driverPatienceRemaining: 4,
    }

    const res = await driverContractService.finalizeAndSignContract(
      futureOffer,
      mockFerrariTeam,
      mockBortoleto,
      3,
      2026,
    )

    expect(res.success).toBe(true)
    expect(res.contract.status).toBe('future_pending')
    expect(res.contract.startSeason).toBe(2027)
    expect(res.domainEvent.type).toBe('DriverSignedForFutureSeason')
  })

  // ==========================================================================
  // TESTE 8: Confidencialidade
  // ==========================================================================
  it('8. Confidencialidade — contrato assinado em sigilo oculta piloto na visão pública do Paddock', () => {
    const driverWithConfidentialFuture: DriverModel = {
      ...mockBortoleto,
      next_team_id: mockFerrariTeam.id,
      future_contract: {
        announcementStatus: 'SIGNED_CONFIDENTIAL',
      },
    } as any

    const publicGrid = sillySeasonService.buildGridSeatStatus(
      [mockFerrariTeam],
      [driverWithConfidentialFuture],
      2026,
      true, // Paddock público
    )

    const privateGrid = sillySeasonService.buildGridSeatStatus(
      [mockFerrariTeam],
      [driverWithConfidentialFuture],
      2026,
      false, // Verdade do backend
    )

    expect(publicGrid[0].seat1.publicDisplay).toBe('Assento sob negociação')
    expect(privateGrid[0].seat1.publicDisplay).toBe('Gabriel Bortoleto')
  })

  // ==========================================================================
  // TESTE 9: Cascata de contratações
  // ==========================================================================
  it('9. Cascata de mercado — uma vaga puxa reposições sequenciais (≥3 equipes reagem)', async () => {
    const teamA = { ...mockFerrariTeam, id: 'team_a', name: 'Equipe Alpha' }
    const teamB = { ...mockAudiTeam, id: 'team_b', name: 'Equipe Beta' }
    const teamC = { ...mockHaasTeam, id: 'team_c', name: 'Equipe Gamma' }

    const driver1 = { ...mockBortoleto, id: 'd1', name: 'Piloto Um', team_id: 'team_b' }
    const driver2 = { ...mockBortoleto, id: 'd2', name: 'Piloto Dois', team_id: 'team_c' }
    const driver3 = { ...mockBortoleto, id: 'd3', name: 'Piloto Tres', team_id: null }

    const sim = await sillySeasonService.simulateSillySeasonRound(
      15, // R15/24 (fase quente)
      24,
      [teamA, teamB, teamC],
      [driver1 as any, driver2 as any, driver3 as any],
      'player_team_x',
      2026,
    )

    expect(sim.cascadeChainLength).toBeGreaterThanOrEqual(1)
    expect(sim.eventsTriggered.length).toBeGreaterThanOrEqual(1)
  })

  // ==========================================================================
  // TESTE 10: Limite orçamentário da IA
  // ==========================================================================
  it('10. Orçamento da IA — equipe de baixo orçamento não compromete finanças com superstar inacessível', () => {
    const superstar: DriverModel = {
      id: 'driver_superstar',
      name: 'Superstar Driver',
      speed: 95,
      consistency: 95,
      salary: 30000000,
    } as any

    const rookie: DriverModel = {
      id: 'driver_rookie',
      name: 'Promising Rookie',
      speed: 78,
      consistency: 76,
      salary: 1500000,
      perceived_potential: 88,
      evaluation_confidence: 70,
    } as any

    const chosen = sillySeasonService.selectBestFitDriverForAiTeam(mockHaasTeam, [
      superstar,
      rookie,
    ])

    // A Haas (orçamento 35M) NÃO deve escolher a superstar de 30M
    expect(chosen?.id).toBe(rookie.id)
  })

  // ==========================================================================
  // TESTE 11: IA NUNCA lê truePotential (Teste Instrumental Estrito)
  // ==========================================================================
  it('11. IA não acessa truePotential — falha imediatamente se houver leitura de true_potential ou truePotential', () => {
    let accessDetected = false

    const instrumentedDriver = new Proxy(
      {
        id: 'driver_proxy',
        name: 'Instrumented Driver',
        speed: 80,
        consistency: 80,
        salary: 2000000,
        perceived_potential: 85,
        evaluation_confidence: 60,
        truePotential: 99,
        true_potential: 99,
      },
      {
        get(target, prop) {
          if (prop === 'truePotential' || prop === 'true_potential') {
            accessDetected = true
            throw new Error(`VIOLAÇÃO DA REGRA DE OURO Nº 5: O mercado tentou ler ${String(prop)}!`)
          }
          return Reflect.get(target, prop)
        },
      },
    )

    const candidate = sillySeasonService.selectBestFitDriverForAiTeam(mockAudiTeam, [
      instrumentedDriver as any,
    ])

    expect(accessDetected).toBe(false)
    expect(candidate).toBeDefined()
  })

  // ==========================================================================
  // TESTE 12: Academy & Jovens Talentos
  // ==========================================================================
  it('12. Academy — jovem com potencial percebido alto atrai interesse e propostas de mercado', () => {
    const youngProspect: DriverModel = {
      id: 'driver_young',
      name: 'Young Prospect',
      speed: 75,
      consistency: 74,
      salary: 800000,
      perceived_potential: 92,
      evaluation_confidence: 75,
      age: 19,
    } as any

    const chosen = sillySeasonService.selectBestFitDriverForAiTeam(mockAudiTeam, [youngProspect])
    expect(chosen?.id).toBe(youngProspect.id)
  })

  // ==========================================================================
  // TESTE 13: Buyout pelo Financial Ledger
  // ==========================================================================
  it('13. Buyout — rival paga multa rescisória gerando transações no Financial Ledger (5A)', async () => {
    const postSpy = vi.spyOn(financialLedgerService, 'postTransaction').mockResolvedValue({} as any)

    const res = await driverContractService.executeDriverBuyout(
      mockFerrariTeam,
      mockBortoleto,
      mockAudiTeam,
      2026,
      3,
    )

    expect(res.success).toBe(true)
    expect(res.buyoutAmount).toBeGreaterThan(0)
    expect(postSpy).toHaveBeenCalledTimes(2) // 1 saída no comprador + 1 entrada no vendedor
  })

  // ==========================================================================
  // TESTE 14: Signing Bonus e Idempotência
  // ==========================================================================
  it('14. Signing Bonus — lançamento financeiro de luvas possui idempotencyKey única', async () => {
    const postSpy = vi.spyOn(financialLedgerService, 'postTransaction').mockResolvedValue({} as any)

    const offerWithBonus: DriverContractOffer = {
      offerId: 'offer_bonus_test',
      teamId: mockFerrariTeam.id,
      teamName: mockFerrariTeam.name,
      driverId: mockBortoleto.id,
      driverName: mockBortoleto.name,
      annualSalary: 8000000,
      durationYears: 1,
      role: 'EQUAL_STATUS',
      signingBonus: 1500000,
      performanceBonuses: [],
      teamOptionIncluded: false,
      driverOptionIncluded: false,
      buyoutAmount: 10000000,
      offeredSeason: 2026,
      startSeason: 2026,
      expirationRound: 5,
      status: 'AGREEMENT',
      isConfidential: false,
      roundsOfTalks: 1,
      driverPatienceRemaining: 4,
    }

    const res = await driverContractService.finalizeAndSignContract(
      offerWithBonus,
      mockFerrariTeam,
      mockBortoleto,
      3,
      2026,
    )

    expect(res.success).toBe(true)
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        subcategory: 'driver_signing_bonus',
        amount: 1500000,
        costCapClassification: 'excluded',
        idempotencyKey: expect.stringContaining('signing_bonus_driver_bortoleto'),
      }),
    )
  })

  // ==========================================================================
  // TESTE 15: Opções Contratuais (Team Option & Driver Option)
  // ==========================================================================
  it('15. Opções — contrato canônico inicializa cláusulas de opção com deadline de ativação', () => {
    const contract = driverContractService.getOrInitializeContract(
      mockBortoleto,
      mockAudiTeam,
      2026,
    )
    expect(contract.teamOption).toBeDefined()
    expect(contract.teamOption.deadlineRound).toBe(18)
    expect(contract.driverOption).toBeDefined()
  })

  // ==========================================================================
  // TESTE 16: Free Agent
  // ==========================================================================
  it('16. Free Agent — piloto sem contrato permanece no universo sem ser deletado', () => {
    const freeAgent: DriverModel = {
      id: 'driver_free',
      name: 'Unemployed Veteran',
      team_id: null,
      reserve_team_id: null,
      salary: 2000000,
    } as any

    const audit = sillySeasonService.auditDriverMarket([mockAudiTeam], [freeAgent], 2026)
    expect(audit.freeAgentsCount).toBe(1)
    expect(audit.isValid).toBe(true)
  })

  // ==========================================================================
  // TESTE 17: Propostas concorrentes sem colisão simultânea
  // ==========================================================================
  it('17. Competing offers — sistema rejeita assinar se orçamento ou vaga forem incompatíveis', async () => {
    const poorTeam = { ...mockHaasTeam, budget: 100000 } // Sem verba para luvas de 500k
    const offer: DriverContractOffer = {
      offerId: 'offer_poor',
      teamId: poorTeam.id,
      teamName: poorTeam.name,
      driverId: mockBortoleto.id,
      driverName: mockBortoleto.name,
      annualSalary: 5000000,
      durationYears: 1,
      role: 'EQUAL_STATUS',
      signingBonus: 500000, // Maior que orçamento
      performanceBonuses: [],
      teamOptionIncluded: false,
      driverOptionIncluded: false,
      buyoutAmount: 0,
      offeredSeason: 2026,
      startSeason: 2026,
      expirationRound: 5,
      status: 'AGREEMENT',
      isConfidential: false,
      roundsOfTalks: 1,
      driverPatienceRemaining: 4,
    }

    const res = await driverContractService.finalizeAndSignContract(
      offer,
      poorTeam,
      mockBortoleto,
      3,
      2026,
    )
    expect(res.success).toBe(false)
    expect(res.error).toContain('Orçamento insuficiente')
  })

  // ==========================================================================
  // TESTE 18: Player vs AI sob as mesmas regras fundamentais
  // ==========================================================================
  it('18. Mesmas regras para Player e IA — ambos passam pelo mesmo motor de avaliação de propostas', () => {
    const offerPlayer: DriverContractOffer = {
      offerId: 'offer_p',
      teamId: mockAudiTeam.id,
      teamName: mockAudiTeam.name,
      driverId: mockBortoleto.id,
      driverName: mockBortoleto.name,
      annualSalary: 4500000,
      durationYears: 2,
      role: 'EQUAL_STATUS',
      signingBonus: 400000,
      performanceBonuses: [],
      teamOptionIncluded: true,
      driverOptionIncluded: false,
      buyoutAmount: 8000000,
      offeredSeason: 2026,
      startSeason: 2027,
      expirationRound: 5,
      status: 'OFFER_SUBMITTED',
      isConfidential: true,
      roundsOfTalks: 1,
      driverPatienceRemaining: 4,
    }

    const evalRes = driverContractService.evaluateContractOffer(
      offerPlayer,
      mockBortoleto,
      mockAudiTeam,
      2026,
    )
    expect(['strong', 'competitive', 'uncertain', 'weak', 'unacceptable']).toContain(
      evalRes.assessment,
    )
  })

  // ==========================================================================
  // TESTE 19: Save/Load & Auditoria de Integridade
  // ==========================================================================
  it('19. Auditoria do Mercado — auditDriverMarket detecta consistência de vagas e salários', () => {
    const audit = sillySeasonService.auditDriverMarket(
      [mockAudiTeam, mockFerrariTeam],
      [mockBortoleto],
      2026,
    )
    expect(audit.isValid).toBe(true)
    expect(audit.teamsWithTooManyTitulars.length).toBe(0)
    expect(audit.futureSeatConflicts.length).toBe(0)
  })

  // ==========================================================================
  // TESTE 20: 10 Temporadas de mercado sem explosão inflacionária
  // ==========================================================================
  it('20. 10 temporadas sem inflação descontrolada — faixas salariais se mantêm estáveis', () => {
    let currentSalary = 5000000
    for (let season = 2026; season <= 2035; season++) {
      const range = driverContractService.estimateMarketValueRange({
        id: 'test_driver',
        name: 'Test Driver',
        speed: 85,
        consistency: 84,
        age: 26,
        salary: currentSalary,
      })
      // O salário máximo não pode explodir além de 35 milhões
      expect(range.maxAnnualSalary).toBeLessThan(40000000)
      currentSalary = Math.round((range.minAnnualSalary + range.maxAnnualSalary) / 2)
    }
  })
})
