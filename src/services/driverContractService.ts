/**
 * SERVIÇO CANÔNICO DE CONTRATOS, VALOR DE MERCADO & NEGOCIAÇÃO DE PILOTOS (7A)
 * F1 Manager 2026 — Implementação Nº 7A
 *
 * Princípios e Regras de Ouro:
 * 1. Nenhum piloto escolhe equipe apenas pelo maior salário.
 * 2. Personalidade (6A) e histórico afetam o mercado (maus tratos por 2 temporadas importam).
 * 3. Contrato assinado ≠ Contrato anunciado.
 * 4. A IA não tem acesso ao truePotential nem ao futuro.
 * 5. Consequência financeira real passa pelo Financial Ledger (5A).
 * 6. Pilotos têm agência: aceitar, negociar, recusar, buscar outro projeto.
 */

import pb from '@/lib/pocketbase/client'
import { DriverModel, TeamModel } from '@/types/f1'
import {
  DriverContract,
  DriverContractRole,
  DriverContractOffer,
  CareerIntentState,
  CareerIntentBreakdown,
  TeamCareerAttractivenessBreakdown,
  EstimatedMarketValueRange,
  CounterofferTerms,
  NegotiationOfferAssessment,
  DriverMarketDomainEvent,
} from '@/types/canonical-driver-market'
import { getDriverPersonalityTraits } from '@/lib/driver-psychology-utils'
import { driverRelationshipService } from './driverRelationshipService'
import { managerEffectService } from './managerEffectService'
import { financialLedgerService } from './financialLedgerService'
import { formatCurrency } from '@/lib/formatters'

export class DriverContractService {
  /**
   * Constrói ou converte um contrato legado em DriverContract canônico
   */
  public getOrInitializeContract(
    driver: Partial<DriverModel> & { id: string; name: string },
    team?: Partial<TeamModel> | null,
    currentSeasonYear = 2026,
  ): DriverContract {
    const existing = (driver as any).canonical_contract as DriverContract | undefined
    if (existing && existing.contractId) {
      return existing
    }

    const startSeason = currentSeasonYear
    const endSeason = driver.contract_end || currentSeasonYear + 1
    const annualSalary = driver.salary || 4000000
    const role: DriverContractRole =
      (driver as any).contract_role ||
      (driver.role === 'reserva'
        ? 'RESERVE'
        : (driver as any).is_test_driver
          ? 'TEST_DEVELOPMENT'
          : driver.speed && driver.speed >= 88
            ? 'LEAD_DRIVER'
            : 'EQUAL_STATUS')

    const initialContract: DriverContract = {
      contractId: `contract_${driver.id}_${startSeason}`,
      driverId: driver.id,
      driverName: driver.name,
      teamId: driver.team_id || driver.reserve_team_id || team?.id || '',
      teamName: team?.name || 'Equipe',
      role,
      startSeason,
      endSeason,
      annualSalary,
      signingBonus: Math.round(annualSalary * 0.1),
      performanceBonuses: [
        { type: 'podium', amount: Math.round(annualSalary * 0.03), description: 'Bônus por Pódio' },
        { type: 'win', amount: Math.round(annualSalary * 0.08), description: 'Bônus por Vitória' },
      ],
      teamOption: {
        available: false,
        exercised: false,
        expired: false,
        deadlineRound: 18,
        extensionYears: 1,
        salaryIncreasePct: 10,
      },
      driverOption: {
        available: false,
        exercised: false,
        expired: false,
        deadlineRound: 18,
        extensionYears: 1,
        salaryIncreasePct: 10,
      },
      buyoutClause: {
        hasBuyout: true,
        buyoutAmount: Math.round(annualSalary * 1.5),
      },
      status: 'active',
      signedDate: new Date().toISOString(),
      announcementStatus: 'ANNOUNCED',
      writtenPromises: [],
      equipmentStatus: role === 'LEAD_DRIVER' ? 'priority' : 'equal',
    }

    return initialContract
  }

  /**
   * Calcula o Career Intent (derivado, dinâmico, NUNCA expor % exato na UI)
   */
  public deriveCareerIntent(
    driver: Partial<DriverModel> & { id: string; name: string },
    team?: Partial<TeamModel> | null,
    carStrength = 70,
  ): CareerIntentBreakdown {
    const traits = getDriverPersonalityTraits({ id: driver.id, name: driver.name })
    const desireToStay = driverRelationshipService.deriveDesireToStay(driver.id, carStrength)
    const auditReport = driverRelationshipService.auditDriverPsychology(driver)

    const brokenPromises = auditReport.promises.filter((p) => p.status === 'broken').length
    const negativeMemories = auditReport.topActiveMemories.filter(
      (m) => m.polarity === 'negative',
    ).length

    // Idade e ambição
    const age = driver.age || 25
    const ambition = traits.ambition || 75
    const loyalty = traits.loyalty || 75

    // Satisfações componentes
    const financialSatisfaction = Math.min(
      100,
      Math.max(10, Math.round(50 + (driver.salary || 3000000) / 300000)),
    )
    const treatmentSatisfaction = Math.max(
      10,
      Math.min(
        100,
        Math.round(auditReport.perceivedFairness - brokenPromises * 15 - negativeMemories * 5),
      ),
    )
    const competitivenessSatisfaction = Math.max(
      10,
      Math.min(100, Math.round(carStrength * 1.1 - (ambition > 85 && carStrength < 75 ? 20 : 0))),
    )

    let intentScore =
      desireToStay * 0.4 +
      treatmentSatisfaction * 0.25 +
      competitivenessSatisfaction * 0.2 +
      loyalty * 0.15 -
      brokenPromises * 12 -
      (ambition > 85 && carStrength < 70 ? 15 : 0)

    intentScore = Math.max(5, Math.min(100, Math.round(intentScore)))

    let state: CareerIntentState = 'CONTENT'
    let qualitativeReason =
      'Satisfeito com o ambiente atual e com a trajetória esportiva da equipe.'

    if (brokenPromises >= 2 || (treatmentSatisfaction < 35 && intentScore < 30)) {
      state = 'DETERMINED_TO_LEAVE'
      qualitativeReason =
        'Relação irreparável devido a promessas não cumpridas e insatisfação profunda com o tratamento interno.'
    } else if (intentScore < 40) {
      state = 'LOOKING_TO_LEAVE'
      qualitativeReason =
        'Buscando ativamente assento em escuderias mais competitivas para a próxima temporada.'
    } else if (intentScore < 55) {
      state = 'EXPLORING_OPTIONS'
      qualitativeReason =
        'Aberto a avaliar projetos alternativos caso surja oportunidade superior no grid.'
    } else if (intentScore < 72) {
      state = 'OPEN_TO_TALKS'
      qualitativeReason =
        'Estável na equipe, mas disponível para ouvir sondagens de projetos consolidados.'
    } else if (intentScore >= 88) {
      state = 'COMMITTED'
      qualitativeReason = 'Totalmente leal e comprometido com os objetivos de longo prazo do time.'
    }

    return {
      state,
      qualitativeReason,
      desireToStayScore: intentScore,
      marketScarcityImpact: 1.0,
      financialSatisfaction,
      competitivenessSatisfaction,
      treatmentSatisfaction,
      loyaltyAnchor: loyalty,
      ambitionDrive: ambition,
    }
  }

  /**
   * Avalia a Team Career Attractiveness sob a perspectiva do piloto específico
   * Dois pilotos diferentes avaliam o mesmo time de maneiras divergentes.
   */
  public evaluateTeamCareerAttractiveness(
    driver: Partial<DriverModel> & { id: string; name: string },
    targetTeam: Partial<TeamModel> & { id: string; name: string },
    offeredRole: DriverContractRole = 'EQUAL_STATUS',
  ): TeamCareerAttractivenessBreakdown {
    const traits = getDriverPersonalityTraits({ id: driver.id, name: driver.name })
    const carPace = targetTeam.strength || targetTeam.calculated_overall || 70
    const infraScore = Math.min(
      100,
      ((targetTeam.factory_level || 3) +
        (targetTeam.simulator_level || 3) +
        (targetTeam.wind_tunnel_level || 3) +
        (targetTeam.cfd_level || 3)) *
        6.25,
    )
    const financialPower = Math.min(
      100,
      Math.max(30, Math.round(((targetTeam.budget || 50000000) / 150000000) * 100)),
    )

    // Piloto ambicioso prioriza título e competitividade
    const ambitionWeight = (traits.ambition || 75) / 100
    const competitiveness = Math.round(carPace * 1.1)

    // Papel oferecido
    let seatOpportunity = 70
    if (offeredRole === 'LEAD_DRIVER') {
      seatOpportunity = traits.ego > 80 ? 95 : 85
    } else if (offeredRole === 'SUPPORT_DRIVER') {
      seatOpportunity = traits.ambition > 80 ? 40 : 65
    } else if (offeredRole === 'RESERVE') {
      seatOpportunity = 35
    }

    // Team Principal Impact via managerEffectService
    const managerEval = managerEffectService.evaluateManager(targetTeam)
    const teamPrincipalPrestige = managerEval.domainScores.peopleManagement || 75

    // Prospecto de título
    const titleContentionProspect =
      carPace >= 85 ? 90 : carPace >= 78 ? 65 : carPace >= 70 ? 40 : 20

    // Cálculo ponderado
    const overallScore = Math.min(
      100,
      Math.max(
        20,
        Math.round(
          competitiveness * 0.35 * (1 + ambitionWeight * 0.2) +
            infraScore * 0.15 +
            financialPower * 0.15 +
            seatOpportunity * 0.2 +
            teamPrincipalPrestige * 0.15,
        ),
      ),
    )

    let qualitativeSummary = 'Projeto equilibrado no pelotão intermediário.'
    if (overallScore >= 85)
      qualitativeSummary =
        'Projeto de ponta com capacidade imediata de vitória e disputa de títulos.'
    else if (overallScore >= 70)
      qualitativeSummary = 'Estrutura sólida e projeto esportivo atraente em ascensão.'
    else if (overallScore < 50)
      qualitativeSummary = 'Projeto considerado arriscado ou pouco atrativo no momento.'

    return {
      teamId: targetTeam.id,
      teamName: targetTeam.name,
      overallScore,
      factors: {
        competitiveness,
        recentTrajectory: carPace >= 75 ? 80 : 60,
        infrastructureScore: infraScore,
        financialPower,
        seatOpportunity,
        teammatePairingFit: 75,
        teamPrincipalPrestige,
        historicalRelationship: 75,
        titleContentionProspect,
        commercialSecondary: 65,
      },
      qualitativeSummary,
    }
  }

  /**
   * Estima faixa salarial de mercado (FAIXA, nunca valor único mágico)
   */
  public estimateMarketValueRange(
    driver: Partial<DriverModel> & { id: string; name: string },
    marketDemandFactor = 1.0,
  ): EstimatedMarketValueRange {
    const speed = driver.speed || 70
    const consistency = driver.consistency || 70
    const age = driver.age || 25
    const basePace = speed * 0.65 + consistency * 0.35

    // Escala salarial não linear (anti-inflação)
    let baseAnnual = 3000000
    if (basePace >= 90) baseAnnual = 28000000
    else if (basePace >= 85) baseAnnual = 18000000
    else if (basePace >= 80) baseAnnual = 10000000
    else if (basePace >= 75) baseAnnual = 6000000
    else baseAnnual = 3500000

    // Ajuste por idade (veteranos experientes vs jovens em ascensão)
    if (age > 34) baseAnnual = Math.round(baseAnnual * 0.9)
    else if (age < 23) baseAnnual = Math.round(baseAnnual * 0.8)

    // Ajuste moderado por escassez de mercado (sem espiral infinita)
    const demandMultiplier = Math.max(0.85, Math.min(1.25, marketDemandFactor))
    const centerSalary = Math.round(baseAnnual * demandMultiplier)

    const minAnnualSalary = Math.round(centerSalary * 0.85)
    const maxAnnualSalary = Math.round(centerSalary * 1.15)

    const displayRange = `${formatCurrency(minAnnualSalary)} — ${formatCurrency(maxAnnualSalary)} / ano`

    const perceivedDemandLevel =
      demandMultiplier >= 1.15
        ? 'very_high'
        : demandMultiplier >= 1.05
          ? 'high'
          : demandMultiplier >= 0.95
            ? 'moderate'
            : 'low'

    return {
      minAnnualSalary,
      maxAnnualSalary,
      displayRange,
      perceivedDemandLevel,
    }
  }

  /**
   * Avalia a proposta e formula contraproposta ou aceitação
   */
  public evaluateContractOffer(
    offer: DriverContractOffer,
    driver: Partial<DriverModel> & { id: string; name: string },
    targetTeam: Partial<TeamModel> & { id: string; name: string },
    currentSeasonYear = 2026,
  ): {
    assessment: NegotiationOfferAssessment
    isAccepted: boolean
    counteroffer?: CounterofferTerms
    explanationText: string
  } {
    const traits = getDriverPersonalityTraits({ id: driver.id, name: driver.name })
    const careerIntent = this.deriveCareerIntent(driver, null, targetTeam.strength || 70)
    const teamAttractiveness = this.evaluateTeamCareerAttractiveness(driver, targetTeam, offer.role)
    const marketRange = this.estimateMarketValueRange(driver)

    // Manager bonus da equipe que está negociando
    const managerCommercialBonus = managerEffectService.getSponsorModifier(targetTeam) // -0.04 a +0.08
    const managerPeopleBonus = managerEffectService.getMoraleRecoveryModifier(targetTeam)

    // Relação da oferta com o valor de mercado
    const salaryRatio = offer.annualSalary / Math.max(1, marketRange.minAnnualSalary)
    const signingBonusRatio = offer.signingBonus / Math.max(1, offer.annualSalary * 0.1)

    // Piloto ambicioso valoriza competitividade e papel, piloto leal valoriza permanência
    const roleSatisfaction =
      offer.role === 'LEAD_DRIVER'
        ? 1.15
        : offer.role === 'EQUAL_STATUS'
          ? 1.0
          : traits.ambition > 80
            ? 0.7
            : 0.9

    // Se o piloto estiver DETERMINED_TO_LEAVE da equipe atual, ele facilita acordos com rivais competitivos
    const intentDampener = careerIntent.state === 'DETERMINED_TO_LEAVE' ? 0.9 : 1.0

    // Score de aceitação
    let acceptanceScore =
      (salaryRatio * 40 + (teamAttractiveness.overallScore / 100) * 35 + signingBonusRatio * 15) *
      roleSatisfaction *
      (1 + managerCommercialBonus * 0.5 + managerPeopleBonus * 0.5)

    acceptanceScore = acceptanceScore / intentDampener

    // Tolerância de paciência: se estourar 4 rodadas, piloto cansa
    if (offer.driverPatienceRemaining <= 0) {
      return {
        assessment: 'unacceptable',
        isAccepted: false,
        explanationText:
          'O piloto e seus agentes esgotaram a paciência com sucessivas propostas divergentes e encerraram as conversas.',
      }
    }

    if (acceptanceScore >= 95) {
      return {
        assessment: 'strong',
        isAccepted: true,
        explanationText:
          'O projeto esportivo e os termos financeiros superaram as expectativas. Acordo aceito!',
      }
    } else if (acceptanceScore >= 78) {
      return {
        assessment: 'competitive',
        isAccepted: true,
        explanationText:
          'Termos competitivos e equilibrados com a ambição do piloto. Proposta aceita.',
      }
    } else if (acceptanceScore >= 55) {
      // Contraproposta
      const requestedSalary = Math.round(
        Math.max(
          offer.annualSalary * 1.12,
          (marketRange.minAnnualSalary + marketRange.maxAnnualSalary) / 2,
        ),
      )
      const requestedSigning = Math.round(requestedSalary * 0.12)
      return {
        assessment: 'uncertain',
        isAccepted: false,
        counteroffer: {
          requestedSalary,
          requestedDurationYears: offer.durationYears > 1 ? offer.durationYears : 2,
          requestedRole:
            traits.ambition > 80 && offer.role === 'SUPPORT_DRIVER' ? 'EQUAL_STATUS' : offer.role,
          requestedSigningBonus: requestedSigning,
          requestedOption: 'team',
          assessment: 'uncertain',
          driverMessage:
            'Gostamos das linhas gerais do projeto, mas solicitamos revisão salarial e garantia de paridade esportiva.',
        },
        explanationText:
          'O piloto avalia o projeto positivamente, mas solicitou ajustes nos termos financeiros e contratuais.',
      }
    } else if (acceptanceScore >= 35) {
      return {
        assessment: 'weak',
        isAccepted: false,
        counteroffer: {
          requestedSalary: Math.round(marketRange.maxAnnualSalary * 1.05),
          requestedDurationYears: 2,
          requestedRole: 'LEAD_DRIVER',
          requestedSigningBonus: Math.round(marketRange.maxAnnualSalary * 0.15),
          requestedOption: 'driver',
          assessment: 'weak',
          driverMessage:
            'A oferta está abaixo do patamar de mercado que outros projetos oferecem ao nosso piloto.',
        },
        explanationText: 'Proposta considerada fraca pelos representantes do piloto.',
      }
    } else {
      return {
        assessment: 'unacceptable',
        isAccepted: false,
        explanationText:
          'A proposta foi recusada sumariamente por não atender aos requisitos mínimos esportivos e financeiros.',
      }
    }
  }

  /**
   * Finaliza e assina o contrato com integração estrita ao Financial Ledger (5A)
   */
  public async finalizeAndSignContract(
    offer: DriverContractOffer,
    signingTeam: TeamModel,
    driver: DriverModel,
    currentRound = 1,
    currentSeasonYear = 2026,
  ): Promise<{
    success: boolean
    contract: DriverContract
    domainEvent: DriverMarketDomainEvent
    error?: string
  }> {
    const isFutureContract = offer.startSeason > currentSeasonYear
    const signingBonus = offer.signingBonus || 0

    // 1. Verificação orçamentária do signing bonus
    if (signingBonus > 0 && (signingTeam.budget || 0) < signingBonus) {
      return {
        success: false,
        contract: null as any,
        domainEvent: null as any,
        error: `Orçamento insuficiente para pagar luvas contratuais de ${formatCurrency(signingBonus)}.`,
      }
    }

    // 2. Registro no Financial Ledger (5A) com Idempotência Estrita
    if (signingBonus > 0) {
      try {
        await financialLedgerService.postTransaction({
          teamId: signingTeam.id,
          seasonYear: currentSeasonYear,
          round: currentRound,
          type: 'expense',
          category: 'driverSalaries',
          subcategory: 'driver_signing_bonus',
          direction: 'outflow',
          amount: signingBonus,
          costCapClassification: 'excluded', // Salários e luvas de pilotos são excluídos da regra de teto FIA
          sourceSystem: 'driver_contract_signing',
          sourceEntityId: driver.id,
          idempotencyKey: `signing_bonus_${driver.id}_${offer.startSeason}_${signingTeam.id}`,
          description: `Luvas de assinatura de contrato: ${driver.name} (${offer.role}) para ${offer.startSeason}`,
        })
      } catch (err: any) {
        console.warn('Aviso no FinancialLedger ao postar signing bonus:', err)
      }
    }

    // 3. Montar objeto DriverContract canônico
    const contract: DriverContract = {
      contractId: `contract_${driver.id}_${offer.startSeason}_${Date.now()}`,
      driverId: driver.id,
      driverName: driver.name,
      teamId: signingTeam.id,
      teamName: signingTeam.name,
      role: offer.role,
      startSeason: offer.startSeason,
      endSeason: offer.startSeason + offer.durationYears - 1,
      annualSalary: offer.annualSalary,
      signingBonus,
      performanceBonuses: offer.performanceBonuses || [],
      teamOption: {
        available: offer.teamOptionIncluded,
        exercised: false,
        expired: false,
        deadlineRound: 18,
        extensionYears: 1,
        salaryIncreasePct: 10,
      },
      driverOption: {
        available: offer.driverOptionIncluded,
        exercised: false,
        expired: false,
        deadlineRound: 18,
        extensionYears: 1,
        salaryIncreasePct: 10,
      },
      buyoutClause: {
        hasBuyout: offer.buyoutAmount > 0,
        buyoutAmount: offer.buyoutAmount || Math.round(offer.annualSalary * 1.5),
      },
      status: isFutureContract ? 'future_pending' : 'active',
      signedDate: new Date().toISOString(),
      announcementStatus: offer.isConfidential ? 'SIGNED_CONFIDENTIAL' : 'ANNOUNCED',
      writtenPromises: offer.importantPromise ? [offer.importantPromise] : [],
      equipmentStatus: offer.role === 'LEAD_DRIVER' ? 'priority' : 'equal',
    }

    // 4. Atualização no banco de dados
    const updatePayload: Record<string, any> = {}
    if (isFutureContract) {
      updatePayload.next_team_id = signingTeam.id
      updatePayload.next_contract_role = offer.role === 'RESERVE' ? 'reserva' : 'titular'
      updatePayload.future_contract = contract
    } else {
      updatePayload.team_id = offer.role === 'RESERVE' ? null : signingTeam.id
      updatePayload.reserve_team_id = offer.role === 'RESERVE' ? signingTeam.id : null
      updatePayload.role = offer.role === 'RESERVE' ? 'reserva' : 'titular'
      updatePayload.salary = offer.annualSalary
      updatePayload.contract_end = contract.endSeason
      updatePayload.canonical_contract = contract
    }

    try {
      await pb.collection('drivers').update(driver.id, updatePayload)
      if (signingBonus > 0) {
        const newBudget = Math.max(0, (signingTeam.budget || 0) - signingBonus)
        await pb.collection('teams').update(signingTeam.id, { budget: newBudget })
      }
    } catch (err: any) {
      console.error('Falha ao atualizar registro de driver na assinatura:', err)
    }

    // 5. Domain Event
    const domainEvent: DriverMarketDomainEvent = {
      id: `event_market_${driver.id}_${Date.now()}`,
      type: isFutureContract ? 'DriverSignedForFutureSeason' : 'DriverContractSigned',
      driverId: driver.id,
      driverName: driver.name,
      teamId: signingTeam.id,
      teamName: signingTeam.name,
      priorTeamId: driver.team_id || driver.reserve_team_id,
      seasonYear: offer.startSeason,
      round: currentRound,
      isConfidential: offer.isConfidential,
      announcementText: offer.isConfidential
        ? `Acordo confidencial firmado entre ${driver.name} e ${signingTeam.name}.`
        : `OFICIAL: ${driver.name} assina contrato com ${signingTeam.name} como ${offer.role}!`,
      financialImpact: {
        salary: offer.annualSalary,
        signingBonus,
      },
    }

    return {
      success: true,
      contract,
      domainEvent,
    }
  }

  /**
   * Executa a rescisão de contrato com pagamento de Buyout pelo Financial Ledger
   */
  public async executeDriverBuyout(
    buyerTeam: TeamModel,
    driver: DriverModel,
    currentTeam: TeamModel,
    seasonYear = 2026,
    round = 1,
  ): Promise<{ success: boolean; buyoutAmount: number; error?: string }> {
    const contract = this.getOrInitializeContract(driver, currentTeam, seasonYear)
    const buyoutAmount =
      contract.buyoutClause?.buyoutAmount || Math.round((driver.salary || 4000000) * 1.5)

    if ((buyerTeam.budget || 0) < buyoutAmount) {
      return {
        success: false,
        buyoutAmount,
        error: `Orçamento insuficiente para pagar multa rescisória de ${formatCurrency(buyoutAmount)}.`,
      }
    }

    // Lança saída no time comprador
    await financialLedgerService.postTransaction({
      teamId: buyerTeam.id,
      seasonYear,
      round,
      type: 'expense',
      category: 'driverSalaries',
      subcategory: 'driver_buyout_fee',
      direction: 'outflow',
      amount: buyoutAmount,
      costCapClassification: 'excluded',
      sourceSystem: 'driver_buyout',
      sourceEntityId: driver.id,
      idempotencyKey: `buyout_outflow_${driver.id}_${buyerTeam.id}_${seasonYear}_${round}`,
      description: `Pagamento de cláusula rescisória (buyout) de ${driver.name} junto à ${currentTeam.name}`,
    })

    // Lança entrada como compensação no time vendedor
    await financialLedgerService.postTransaction({
      teamId: currentTeam.id,
      seasonYear,
      round,
      type: 'revenue',
      category: 'driverRelated',
      subcategory: 'driver_buyout_received',
      direction: 'inflow',
      amount: buyoutAmount,
      costCapClassification: 'excluded',
      sourceSystem: 'driver_buyout',
      sourceEntityId: driver.id,
      idempotencyKey: `buyout_inflow_${driver.id}_${currentTeam.id}_${seasonYear}_${round}`,
      description: `Compensação de cláusula rescisória recebida pela liberação de ${driver.name} para a ${buyerTeam.name}`,
    })

    // Atualiza saldo das equipes
    await pb
      .collection('teams')
      .update(buyerTeam.id, { budget: (buyerTeam.budget || 0) - buyoutAmount })
    await pb
      .collection('teams')
      .update(currentTeam.id, { budget: (currentTeam.budget || 0) + buyoutAmount })

    return {
      success: true,
      buyoutAmount,
    }
  }

  /**
   * Explicação didática de decisão contratual para auditoria e QA
   */
  public explainDriverContractDecision(
    driverName: string,
    teamA: {
      name: string
      salary: number
      role: string
      competitiveness: number
      trust: number
      promisesKept: number
    },
    teamB: {
      name: string
      salary: number
      role: string
      competitiveness: number
      trust: number
      promisesKept: number
    },
  ): string {
    const salaryDeltaPct = Math.round(((teamB.salary - teamA.salary) / teamA.salary) * 100)
    const compDelta = teamB.competitiveness - teamA.competitiveness
    const pref =
      teamB.salary * (teamB.competitiveness / 70) > teamA.salary * (teamA.competitiveness / 70)
        ? teamB.name
        : teamA.name

    return `DECISION AUDIT: ${driverName.toUpperCase()} — ${teamA.name.toUpperCase()} vs ${teamB.name.toUpperCase()}; ${teamB.name}: Salary ${salaryDeltaPct >= 0 ? '+' : ''}${salaryDeltaPct}%, Role: ${teamB.role}, Competitiveness: ${compDelta >= 0 ? '+' : ''}${compDelta}; ${teamA.name}: Team Trust: ${teamA.trust}, Promises: ${teamA.promisesKept}; Result: ${pref.toUpperCase()} PREFERRED; Confidence: High`
  }
}

export const driverContractService = new DriverContractService()
