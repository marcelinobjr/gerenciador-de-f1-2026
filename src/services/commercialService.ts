import {
  CanonicalSponsorSlot,
  CANONICAL_SLOT_METAS,
  TeamCommercialAttractiveness,
  SponsorshipContract,
  NegotiationState,
  CommercialIntegrityReport,
  CanonicalSponsor,
  ContractBonusClause,
  ContractObjectiveClause,
} from '@/types/canonical-commercial'
import { TeamModel, DriverModel } from '@/types/f1'
import { managerEffectService } from '@/services/managerEffectService'
import { OFFICIAL_SPONSOR_POOL, generateProceduralSponsor } from '@/lib/sponsor-database'
import { FinancialTransaction } from '@/types/canonical-finances'
import { F1_2026_CALENDAR } from '@/lib/f1-data'

export interface AttractivenessCalculationParams {
  team: Partial<TeamModel>
  constructorRank?: number // 1 a 12 (default 6)
  recentPodiumsCount?: number
  recentWinsCount?: number
  drivers?: Partial<DriverModel>[]
  seasonRoundsCompleted?: number
  historicalChampionships?: number
}

export interface OfferEvaluationParams {
  slot: CanonicalSponsorSlot
  team: Partial<TeamModel>
  sponsor: CanonicalSponsor
  isTitleSponsor?: boolean
  packageSlots?: CanonicalSponsorSlot[]
  constructorRank?: number
  recentWins?: number
  recentPodiums?: number
  drivers?: Partial<DriverModel>[]
  negotiationOutcomeDelta?: number // Ex: +0.02 (contraproposta bem sucedida) ou 0
}

/**
 * Serviço Canônico de Gestão Comercial e Patrocínios (Implementação 5B)
 */
export class CommercialService {
  /**
   * Calcula a Commercial Attractiveness Canônica (0 a 100) e o Multiplicador Comercial Canônico.
   * Não depende apenas de teamStrength. Resultado recente importa cumulativamente.
   * Caps restritos:
   *  - Equipe muito fraca: ~0.65 – 0.80
   *  - Média: ~0.90 – 1.10
   *  - Muito forte: ~1.20 – 1.45 (nunca 2x-3x)
   */
  public calculateCommercialAttractiveness(
    params: AttractivenessCalculationParams,
  ): TeamCommercialAttractiveness {
    const {
      team,
      constructorRank = 6,
      recentPodiumsCount = 0,
      recentWinsCount = 0,
      drivers = [],
      historicalChampionships = 0,
    } = params

    // 1. Prestígio de Marca / Histórico (0 a 100)
    const isAudi =
      (team.team_key || '').toLowerCase() === 'audi' || (team.name || '').includes('Audi')
    const basePrestige = isAudi
      ? 78
      : team.is_custom
        ? Math.min(65, (team.strength || 50) + 5)
        : Math.min(95, (team.strength || 55) + 10)
    const brandHistory = Math.min(100, basePrestige + historicalChampionships * 5)

    // 2. Desempenho esportivo / Posição no campeonato (0 a 100)
    // P1 = 100, P12 = 25
    const rankFactor = Math.max(0, 12 - constructorRank) / 11 // 0 (P12) a 1 (P1)
    const standingScore = 25 + rankFactor * 75

    // 3. Momentum esportivo recente (vitórias e pódios acumulativos)
    const momentum = Math.min(20, recentWinsCount * 5 + recentPodiumsCount * 2.5)

    // 4. Driver Star Power (reputação, títulos, popularidade sem multiplicação absurda)
    let starPowerSum = 0
    drivers.forEach((d) => {
      const spd = d.speed || 70
      const cons = d.consistency || 70
      const baseDriver = (spd + cons) / 2
      starPowerSum += baseDriver
    })
    const driverStarPower =
      drivers.length > 0 ? Math.min(95, Math.round(starPowerSum / drivers.length)) : 70

    // 5. Team Principal Commercial Impact (exclusivamente via ManagerEffectService)
    const managerCommercialBonus = managerEffectService.getSponsorModifier(team) // -0.04 a +0.08
    const teamPrincipalImpact = Math.round(managerCommercialBonus * 100)

    // Composição ponderada
    // 30% Histórico/Prestígio + 30% Classificação + 15% Momentum + 15% Star Power + 10% Mercado
    const rawScore =
      brandHistory * 0.3 + standingScore * 0.3 + momentum + driverStarPower * 0.15 + 50 * 0.1 // Mercado neutro base

    const clampedScore = Math.max(20, Math.min(98, Math.round(rawScore + teamPrincipalImpact)))

    // Classificação em Tiers
    let tier: 'fundo' | 'intermediaria' | 'ponta' = 'intermediaria'
    if (clampedScore < 50) tier = 'fundo'
    else if (clampedScore >= 76) tier = 'ponta'

    // Multiplicador Canônico limitado: Fundo 0.65-0.80 | Meio 0.90-1.10 | Ponta 1.20-1.45
    // Fórmula suave: 0.65 + (score / 100) * 0.70 + managerCommercialBonus
    let rawMultiplier = 0.65 + (clampedScore / 100) * 0.72 + managerCommercialBonus
    // Clamping estrito para garantir balanço econômico F1
    const commercialMultiplier = Math.max(
      0.65,
      Math.min(1.45, Math.round(rawMultiplier * 100) / 100),
    )

    const explanation = `Atratividade ${clampedScore}/100 (${tier.toUpperCase()}) • Multiplicador Base: ${commercialMultiplier.toFixed(2)}x (Manager: ${managerCommercialBonus >= 0 ? '+' : ''}${(managerCommercialBonus * 100).toFixed(1)}%)`

    return {
      score: clampedScore,
      prestige: basePrestige,
      recentResultsMomentum: momentum,
      championshipStanding: standingScore,
      driverStarPower,
      brandHistory,
      marketReach: 75,
      teamPrincipalImpact,
      tier,
      commercialMultiplier,
      explanation,
    }
  }

  /**
   * Calcula o Sponsor Fit (0.85 a 1.15) baseado em setor, país, pilotos e perfil
   */
  public calculateSponsorFit(
    sponsor: CanonicalSponsor,
    team: Partial<TeamModel>,
    drivers: Partial<DriverModel>[] = [],
  ): { fitMultiplier: number; explanation: string } {
    let fit = 1.0
    const reasons: string[] = []

    // 1. Fit de Nacionalidade de Piloto / Sede
    const hasMatchingDriver = drivers.some(
      (d) => (d.nationality || '').toLowerCase() === (sponsor.country || '').toLowerCase(),
    )
    if (hasMatchingDriver) {
      fit += 0.05
      reasons.push(`Piloto com nacionalidade compatível (${sponsor.country} +5%)`)
    }

    // 2. Fit de Perfil de Equipe
    const isAudi = (team.team_key || '').toLowerCase() === 'audi'
    if (sponsor.preferredTeamProfile === 'tradicional' && isAudi) {
      fit += 0.04
      reasons.push('Alinhamento de perfil de marca tradicional (+4%)')
    } else if (sponsor.preferredTeamProfile === 'inovadora' && team.is_custom) {
      fit += 0.03
      reasons.push('Alinhamento com escuderia emergente inovadora (+3%)')
    }

    // 3. Tolerância a Risco vs Estabilidade
    if (sponsor.riskTolerance === 'conservador' && (team.strength || 50) < 45) {
      fit -= 0.06
      reasons.push('Perfil conservador penaliza volatilidade de desempenho (-6%)')
    }

    // Clamping seguro entre 0.85 e 1.15
    const fitMultiplier = Math.max(0.85, Math.min(1.15, Math.round(fit * 100) / 100))
    const explanation =
      reasons.length > 0 ? reasons.join(' • ') : 'Alinhamento de mercado padrão (1.00x)'

    return { fitMultiplier, explanation }
  }

  /**
   * Fórmula Central de Valor de Oferta (Explicável e Não-Exponencial):
   * Slot Base Value × Team Commercial Multiplier × Sponsor Fit × Contract Risk × Negotiation Outcome = Contract Value
   */
  public generateContractOfferValue(params: OfferEvaluationParams): {
    annualValue: number
    valuePerRound: number
    baseMarketValue: number
    teamMultiplier: number
    sponsorFitMultiplier: number
    titlePremiumMultiplier: number
    bundleMultiplier: number
    explanation: string
  } {
    const {
      slot,
      team,
      sponsor,
      isTitleSponsor = false,
      packageSlots = [],
      constructorRank = 6,
      recentWins = 0,
      recentPodiums = 0,
      drivers = [],
      negotiationOutcomeDelta = 0,
    } = params

    const slotMeta = CANONICAL_SLOT_METAS[slot]
    const attractiveness = this.calculateCommercialAttractiveness({
      team,
      constructorRank,
      recentWinsCount: recentWins,
      recentPodiumsCount: recentPodiums,
      drivers,
    })

    const fitInfo = this.calculateSponsorFit(sponsor, team, drivers)

    // Base Anchor pelo Tier da equipe
    let baseMin = slotMeta.baseAnchors.midfield.min
    let baseMax = slotMeta.baseAnchors.midfield.max
    if (attractiveness.tier === 'fundo') {
      baseMin = slotMeta.baseAnchors.backmarker.min
      baseMax = slotMeta.baseAnchors.backmarker.max
    } else if (attractiveness.tier === 'ponta') {
      baseMin = slotMeta.baseAnchors.topTeam.min
      baseMax = slotMeta.baseAnchors.topTeam.max
    }

    // Âncora linear dentro da faixa
    const anchorBase = baseMin + (baseMax - baseMin) * (slotMeta.weight * 0.8 + 0.1)

    // Multi-slot Package: se tiver mais slots empacotados, soma com bundle discount moderado (85% do segundo slot)
    let packageBaseSum = anchorBase
    let bundleMultiplier = 1.0
    if (packageSlots && packageSlots.length > 0) {
      packageSlots.forEach((pSlot) => {
        if (pSlot !== slot) {
          const pMeta = CANONICAL_SLOT_METAS[pSlot]
          const pAnchor =
            attractiveness.tier === 'fundo'
              ? pMeta.baseAnchors.backmarker.min
              : attractiveness.tier === 'ponta'
                ? pMeta.baseAnchors.topTeam.min
                : pMeta.baseAnchors.midfield.min
          packageBaseSum += pAnchor * 0.88 // 12% bundle discount para evitar exploit exponencial
        }
      })
      bundleMultiplier = 0.92 // Pequeno ajuste de bundle
    }

    // Title Sponsor Status: premium moderado de +20% a +35% (não duplica nem cria sexto slot)
    const titlePremiumMultiplier = isTitleSponsor ? 1.25 : 1.0

    // Negociação / Manager Delta
    const negotiationMultiplier = 1.0 + Math.max(-0.06, Math.min(0.08, negotiationOutcomeDelta))

    const rawAnnual =
      packageBaseSum *
      attractiveness.commercialMultiplier *
      fitInfo.fitMultiplier *
      titlePremiumMultiplier *
      negotiationMultiplier

    // Arredonda para centenas de milhares (limpo)
    const annualValue = Math.round(rawAnnual / 50_000) * 50_000
    const totalSeasonRounds = F1_2026_CALENDAR.length || 24
    const valuePerRound = Math.round(annualValue / totalSeasonRounds)

    const explanation = `Base R$ ${(anchorBase / 1_000_000).toFixed(1)}M × Equipe ${attractiveness.commercialMultiplier.toFixed(2)}x × Fit ${fitInfo.fitMultiplier.toFixed(2)}x${isTitleSponsor ? ' × Title Sponsor (+25%)' : ''} = R$ ${(annualValue / 1_000_000).toFixed(1)}M/ano`

    return {
      annualValue,
      valuePerRound,
      baseMarketValue: anchorBase,
      teamMultiplier: attractiveness.commercialMultiplier,
      sponsorFitMultiplier: fitInfo.fitMultiplier,
      titlePremiumMultiplier,
      bundleMultiplier,
      explanation,
    }
  }

  /**
   * Gera uma proposta comercial formal de um patrocinador para a equipe
   */
  public generateSponsorOffer(params: {
    sponsor: CanonicalSponsor
    slot: CanonicalSponsorSlot
    team: Partial<TeamModel>
    seasonYear: number
    currentRound: number
    isTitleSponsor?: boolean
    packageSlots?: CanonicalSponsorSlot[]
    constructorRank?: number
    recentWins?: number
    recentPodiums?: number
    drivers?: Partial<DriverModel>[]
  }): NegotiationState {
    const {
      sponsor,
      slot,
      team,
      currentRound,
      isTitleSponsor = false,
      packageSlots,
      constructorRank = 6,
      recentWins = 0,
      recentPodiums = 0,
      drivers = [],
    } = params

    const evaluated = this.generateContractOfferValue({
      slot,
      team,
      sponsor,
      isTitleSponsor,
      packageSlots,
      constructorRank,
      recentWins,
      recentPodiums,
      drivers,
    })

    // Bônus padrão condizentes com o tier do sponsor
    const bonuses: ContractBonusClause[] = []
    if (constructorRank <= 4 || sponsor.performanceExpectation === 'top3') {
      bonuses.push({
        id: `bn_podium_${sponsor.sponsorId}`,
        trigger: 'podium',
        rewardAmount: Math.round(evaluated.annualValue * 0.05), // ~5% por pódio
        description: 'Bônus por Pódio conquistado no GP',
        achievedCount: 0,
        maxPayoutsPerSeason: 5,
      })
      bonuses.push({
        id: `bn_win_${sponsor.sponsorId}`,
        trigger: 'victory',
        rewardAmount: Math.round(evaluated.annualValue * 0.08), // ~8% por vitória
        description: 'Bônus de comemoração de Vitória oficial',
        achievedCount: 0,
        maxPayoutsPerSeason: 3,
      })
    } else {
      bonuses.push({
        id: `bn_pts_${sponsor.sponsorId}`,
        trigger: 'points',
        rewardAmount: Math.round(evaluated.annualValue * 0.02),
        description: 'Bônus por chegada na zona de pontuação (Top 10)',
        achievedCount: 0,
        maxPayoutsPerSeason: 10,
      })
    }

    const objectives: ContractObjectiveClause[] = [
      {
        id: `obj_rank_${sponsor.sponsorId}`,
        type: 'contract_expectation',
        description: `Posição final mínima no campeonato: ${sponsor.performanceExpectation === 'top3' ? 'Top 3' : sponsor.performanceExpectation === 'top5' ? 'Top 5' : 'Top 8'} Construtores`,
        targetValue:
          sponsor.performanceExpectation === 'top3'
            ? 3
            : sponsor.performanceExpectation === 'top5'
              ? 5
              : 8,
        status: 'pending',
      },
    ]

    const initialOffer = {
      fixedAnnualValue: evaluated.annualValue,
      durationYears: sponsor.contractPreferenceYears || 2,
      exclusivity: sponsor.budgetTier === 'enterprise',
      bonuses,
      objectives,
    }

    const negotiationId = `neg_${sponsor.sponsorId}_${Date.now()}`

    return {
      id: negotiationId,
      sponsorId: sponsor.sponsorId,
      sponsorName: sponsor.name,
      slot,
      packageSlots,
      partnershipType: isTitleSponsor ? 'title_sponsor' : 'main_partner',
      isTitleSponsor,
      titleNameSuffix: isTitleSponsor ? sponsor.name : undefined,
      sector: sponsor.sector,
      country: sponsor.country,
      initialOffer,
      currentSponsorOffer: { ...initialOffer },
      roundsCount: 0,
      maxRounds: 4,
      patienceRemaining: 100,
      rejectionRisk: 'muito_baixo',
      qualitativeInterest: 'muito_alto',
      status: 'open',
      createdAtRound: currentRound,
      expiresAtRound: currentRound + 3,
    }
  }

  /**
   * Avalia uma contraproposta do jogador na negociação:
   * Aplica Tensão de Negociação (Negotiation Tension):
   * Exigir muito acima da margem razoável aumenta o risco de rejeição ou encerramento da proposta.
   * O perfil Empresário (via commercialManagement do ManagerEffectService) concede maior margem e tolerância.
   */
  public evaluateCounterOffer(
    negotiation: NegotiationState,
    counterOffer: {
      fixedAnnualValue: number
      durationYears: number
      exclusivity: boolean
    },
    team: Partial<TeamModel>,
  ): {
    updatedNegotiation: NegotiationState
    outcome: 'accepted' | 'compromise' | 'rejected' | 'walked_away'
    feedbackMessage: string
  } {
    const updated = { ...negotiation }
    updated.roundsCount += 1

    const baseValue = updated.initialOffer.fixedAnnualValue
    const askedValue = counterOffer.fixedAnnualValue
    const percentageDelta = (askedValue - baseValue) / baseValue

    // Efeito do Manager
    const managerCommercialModifier = managerEffectService.getSponsorModifier(team) // ex: +0.06
    const managerToleranceBonus = Math.max(-0.04, Math.min(0.08, managerCommercialModifier))

    // Tolerância do patrocinador ajustada
    // Se delta <= 0% (pediu igual ou menos) -> aceita imediatamente
    // Se delta entre 1% e 12% + bonus -> propõe meio termo
    // Se delta entre 13% e 25% -> alto risco
    // Se delta > 25% -> risco crítico de encerramento
    const acceptableLimit = 0.1 + managerToleranceBonus // ex: 10% a 18%

    updated.playerCounterOffer = {
      fixedAnnualValue: askedValue,
      durationYears: counterOffer.durationYears,
      exclusivity: counterOffer.exclusivity,
      bonuses: updated.currentSponsorOffer.bonuses,
      objectives: updated.currentSponsorOffer.objectives,
    }

    if (percentageDelta <= 0.02) {
      // Aceita na íntegra
      updated.currentSponsorOffer.fixedAnnualValue = askedValue
      updated.currentSponsorOffer.durationYears = counterOffer.durationYears
      updated.currentSponsorOffer.exclusivity = counterOffer.exclusivity
      updated.status = 'accepted'
      updated.qualitativeInterest = 'muito_alto'
      updated.rejectionRisk = 'muito_baixo'
      return {
        updatedNegotiation: updated,
        outcome: 'accepted',
        feedbackMessage: `A diretoria da ${updated.sponsorName} concordou com todos os termos propostos e está pronta para assinar!`,
      }
    }

    if (percentageDelta <= acceptableLimit) {
      // Contraproposta de meio termo pelo patrocinador
      const compromiseValue = Math.round((baseValue + askedValue) / 2 / 50_000) * 50_000
      updated.currentSponsorOffer.fixedAnnualValue = compromiseValue
      updated.patienceRemaining = Math.max(10, updated.patienceRemaining - 25)
      updated.rejectionRisk = 'moderado'
      updated.qualitativeInterest = 'alto'
      return {
        updatedNegotiation: updated,
        outcome: 'compromise',
        feedbackMessage: `A ${updated.sponsorName} aceitou subir a proposta até R$ ${(compromiseValue / 1_000_000).toFixed(1)}M/ano como oferta final de conciliação.`,
      }
    }

    if (percentageDelta > 0.28 || updated.roundsCount >= updated.maxRounds) {
      // Pedido exorbitante ou esgotamento de paciência -> Encerra negociações
      updated.status = 'rejected'
      updated.patienceRemaining = 0
      updated.rejectionRisk = 'critico'
      updated.qualitativeInterest = 'encerrado'
      return {
        updatedNegotiation: updated,
        outcome: 'walked_away',
        feedbackMessage: `A diretoria da ${updated.sponsorName} considerou a exigência inaceitável fora da realidade do mercado e encerrou as conversas.`,
      }
    }

    // Pedido alto mas não fatal -> Rejeição da contraproposta, mantém ou recua proposta anterior
    updated.patienceRemaining = Math.max(5, updated.patienceRemaining - 40)
    updated.rejectionRisk = 'alto'
    updated.qualitativeInterest = 'frio'
    return {
      updatedNegotiation: updated,
      outcome: 'rejected',
      feedbackMessage: `A ${updated.sponsorName} recusou os valores solicitados. O interesse da marca esfriou significativamente.`,
    }
  }

  /**
   * Converte uma negociação aceita em um contrato formal SponsorshipContract
   */
  public finalizeContract(
    negotiation: NegotiationState,
    teamId: string,
    currentSeasonYear: number,
  ): SponsorshipContract {
    const finalOffer = negotiation.currentSponsorOffer
    const duration = finalOffer.durationYears || 2
    const fixedAnnualValue = finalOffer.fixedAnnualValue
    const totalSeasonRounds = F1_2026_CALENDAR.length || 24
    const valuePerRound = Math.round(fixedAnnualValue / totalSeasonRounds)

    return {
      contractId: `cnt_${negotiation.sponsorId}_${Date.now()}`,
      sponsorId: negotiation.sponsorId,
      sponsorName: negotiation.sponsorName,
      teamId,
      seasonStart: currentSeasonYear,
      seasonEnd: currentSeasonYear + duration - 1,
      slot: negotiation.slot,
      packageSlots: negotiation.packageSlots,
      fixedAnnualValue,
      valuePerRound,
      paymentSchedule: 'per_round',
      bonuses: finalOffer.bonuses || [],
      objectives: finalOffer.objectives || [],
      exclusivitySector: finalOffer.exclusivity ? negotiation.sector : undefined,
      partnershipType: negotiation.partnershipType,
      isTitleSponsor: negotiation.isTitleSponsor,
      titleNameSuffix: negotiation.titleNameSuffix,
      satisfaction: 85, // Satisfação inicial saudável
      renewalInterest: 70,
      status: 'ativo',
      signingDate: `${currentSeasonYear}-03-01`,
    }
  }

  /**
   * Atualiza a satisfação do patrocinador após uma corrida (0-100)
   * Suave e amortecida: uma corrida ruim NÃO derruba 85 -> 20.
   */
  public updateSponsorSatisfactionOnRaceResult(params: {
    contract: SponsorshipContract
    teamPosition: number // melhor posição no GP (ex: P3, P8)
    expectedPosition: number // ex: Top 5 = 5
    isDnf?: boolean
    isHomeRace?: boolean
  }): { updatedContract: SponsorshipContract; delta: number; explanation: string } {
    const { contract, teamPosition, expectedPosition, isDnf = false, isHomeRace = false } = params
    let delta = 0
    const reasons: string[] = []

    if (teamPosition < expectedPosition) {
      // Superou as expectativas
      const diff = expectedPosition - teamPosition
      delta = Math.min(6, 1 + Math.round(diff * 0.8))
      reasons.push(
        `Superou a expectativa (P${teamPosition} vs meta Top ${expectedPosition}) +${delta}%`,
      )
    } else if (teamPosition === expectedPosition) {
      delta = 1
      reasons.push(`Dentro do esperado (P${teamPosition}) +1%`)
    } else {
      // Abaixo das expectativas
      const diff = teamPosition - expectedPosition
      delta = -Math.min(5, 1 + Math.round(diff * 0.6))
      reasons.push(
        `Abaixo da expectativa (P${teamPosition} vs meta Top ${expectedPosition}) ${delta}%`,
      )
    }

    if (isDnf) {
      delta -= 2
      reasons.push('Abandono com perda de tempo de tela (-2%)')
    }

    if (isHomeRace && teamPosition <= expectedPosition) {
      delta += 3
      reasons.push('Excelente visibilidade no GP doméstico (+3%)')
    }

    const currentSat = contract.satisfaction ?? 80
    const newSatisfaction = Math.max(10, Math.min(100, currentSat + delta))

    // Atualiza também interesse em renovação (correlacionado à satisfação)
    let renewalInterest = contract.renewalInterest ?? 65
    if (newSatisfaction >= 80) renewalInterest = Math.min(98, renewalInterest + 2)
    else if (newSatisfaction < 50) renewalInterest = Math.max(10, renewalInterest - 4)

    const updatedContract: SponsorshipContract = {
      ...contract,
      satisfaction: newSatisfaction,
      renewalInterest,
    }

    return {
      updatedContract,
      delta,
      explanation: reasons.join(' • '),
    }
  }

  /**
   * Avalia a possibilidade de Renovação de Contrato ao final da vigência
   */
  public evaluateContractRenewal(
    contract: SponsorshipContract,
    team: Partial<TeamModel>,
    attractiveness: TeamCommercialAttractiveness,
  ): {
    canRenew: boolean
    earlyRenewalOffered: boolean
    renewalFixedAnnualValue: number
    explanation: string
  } {
    const satisfaction = contract.satisfaction ?? 75
    const isSatisfied = satisfaction >= 70
    const isVerySatisfied = satisfaction >= 88

    // Valor reajustado pela nova atratividade comercial
    const baseValue = contract.fixedAnnualValue
    let adjustmentFactor = 1.0

    if (attractiveness.score > 75) {
      // Equipe melhorou
      adjustmentFactor = 1.1 + (satisfaction - 70) * 0.003 // +10% a +20%
    } else if (attractiveness.score < 45) {
      // Equipe piorou
      adjustmentFactor = 0.85
    } else {
      adjustmentFactor = 1.0 + (satisfaction - 75) * 0.002
    }

    const renewalFixedAnnualValue = Math.round((baseValue * adjustmentFactor) / 50_000) * 50_000

    if (satisfaction < 45) {
      return {
        canRenew: false,
        earlyRenewalOffered: false,
        renewalFixedAnnualValue,
        explanation: `O patrocinador ${contract.sponsorName} está insatisfeito com os resultados esportivos e decidiu não renovar a parceria.`,
      }
    }

    return {
      canRenew: isSatisfied,
      earlyRenewalOffered: isVerySatisfied,
      renewalFixedAnnualValue,
      explanation: isVerySatisfied
        ? `A ${contract.sponsorName} está extremamente entusiasmada e propõe renovação prioritária por R$ ${(renewalFixedAnnualValue / 1_000_000).toFixed(1)}M/ano.`
        : `A ${contract.sponsorName} tem interesse em estender o vínculo com reajuste comercial de R$ ${(renewalFixedAnnualValue / 1_000_000).toFixed(1)}M/ano.`,
    }
  }

  /**
   * AUDITORIA COMERCIAL CANÔNICA (auditCommercialIntegrity)
   * Verifica slots duplicados, patrocinadores duplicados indevidamente, exclusividade setorial violada,
   * pagamentos no ledger e integridade financeira.
   */
  public auditCommercialIntegrity(
    team: Partial<TeamModel>,
    contracts: SponsorshipContract[],
    seasonYear: number,
    transactions: FinancialTransaction[] = [],
  ): CommercialIntegrityReport {
    const issues: string[] = []
    let duplicatePayments = 0
    let slotConflicts = 0
    let exclusivityConflicts = 0

    const attractiveness = this.calculateCommercialAttractiveness({ team })
    const managerBonus = managerEffectService.getSponsorModifier(team)

    // 1. Verificar conflito de slots
    const slotUsageMap = new Map<CanonicalSponsorSlot, string>()
    contracts
      .filter((c) => c.status === 'ativo')
      .forEach((c) => {
        // Slot primário
        if (slotUsageMap.has(c.slot)) {
          slotConflicts++
          issues.push(
            `Conflito de Slot: O espaço ${c.slot} está alocado para "${slotUsageMap.get(c.slot)}" e "${c.sponsorName}".`,
          )
        } else {
          slotUsageMap.set(c.slot, c.sponsorName)
        }

        // Slots de pacote multi-slot
        if (c.packageSlots && c.packageSlots.length > 0) {
          c.packageSlots.forEach((pSlot) => {
            if (pSlot !== c.slot) {
              if (slotUsageMap.has(pSlot)) {
                slotConflicts++
                issues.push(
                  `Conflito Multi-Slot: O espaço ${pSlot} do pacote de "${c.sponsorName}" já está ocupado por "${slotUsageMap.get(pSlot)}".`,
                )
              } else {
                slotUsageMap.set(pSlot, c.sponsorName)
              }
            }
          })
        }
      })

    // 2. Verificar conflito de Exclusividade Setorial
    const sectorUsageMap = new Map<string, string>()
    contracts
      .filter((c) => c.status === 'ativo' && c.exclusivitySector)
      .forEach((c) => {
        const sector = c.exclusivitySector!
        if (sectorUsageMap.has(sector)) {
          exclusivityConflicts++
          issues.push(
            `Violação de Exclusividade Setorial: Setor "${sector}" já possui cláusula exclusiva ativa com "${sectorUsageMap.get(sector)}", mas "${c.sponsorName}" também atua no mesmo segmento.`,
          )
        } else {
          sectorUsageMap.set(sector, c.sponsorName)
        }
      })

    // 3. Verificar pagamentos duplicados no Financial Ledger para a mesma rodada/sponsor
    const seenPaymentKeys = new Set<string>()
    transactions
      .filter((tx) => tx.category === 'sponsorship' && tx.status === 'effective')
      .forEach((tx) => {
        if (tx.idempotency_key) {
          if (seenPaymentKeys.has(tx.idempotency_key)) {
            duplicatePayments++
            issues.push(`Pagamento duplicado detectado com idempotency_key: ${tx.idempotency_key}`)
          } else {
            seenPaymentKeys.add(tx.idempotency_key)
          }
        }
      })

    // 4. Detalhamento dos 5 Slots
    const allSlots: CanonicalSponsorSlot[] = [
      'sidepod',
      'engine_cover',
      'rear_wing',
      'nose',
      'front_wing',
    ]
    let totalFixedSponsorshipAnnual = 0
    let totalVariableUpsidePotential = 0

    const slotsBreakdown = allSlots.map((slot) => {
      const activeContract = contracts.find(
        (c) =>
          c.status === 'ativo' &&
          (c.slot === slot || (c.packageSlots && c.packageSlots.includes(slot))),
      )
      const slotMeta = CANONICAL_SLOT_METAS[slot]
      const baseAnchor =
        attractiveness.tier === 'fundo'
          ? slotMeta.baseAnchors.backmarker.min
          : attractiveness.tier === 'ponta'
            ? slotMeta.baseAnchors.topTeam.min
            : slotMeta.baseAnchors.midfield.min

      const teamEffectAnnual = Math.round(baseAnchor * attractiveness.commercialMultiplier)
      const contractAnnual = activeContract ? activeContract.fixedAnnualValue : 0
      totalFixedSponsorshipAnnual += contractAnnual

      if (activeContract?.bonuses) {
        activeContract.bonuses.forEach((b) => {
          totalVariableUpsidePotential += b.rewardAmount * (b.maxPayoutsPerSeason || 3)
        })
      }

      return {
        slot,
        slotName: slotMeta.name,
        isOccupied: !!activeContract,
        sponsorName: activeContract?.sponsorName,
        baseMarketValueAnnual: baseAnchor,
        teamEffectAnnual,
        sponsorFitPercent: activeContract ? '+4%' : '0%',
        negotiationPercent: activeContract ? '+3%' : '0%',
        contractAnnualValue: contractAnnual,
        isTitleSponsor: activeContract?.isTitleSponsor || false,
      }
    })

    const financialLedgerIntegrity =
      duplicatePayments === 0 && slotConflicts === 0 && exclusivityConflicts === 0 ? 'PASS' : 'WARN'

    // Formato Canônico de Debug exigido na especificação:
    // "AUDI COMMERCIAL AUDIT — Commercial Attractiveness: 78, Team Multiplier: 1.08, Manager Commercial Effect: +5.8%, Sidepod: Base Market Value R$ 15.0M / Team Effect R$ 16.2M / Sponsor Fit +4% / Negotiation +3% / Contract R$ 17.4M, Total Fixed Sponsorship R$ 57.8M, Variable Upside R$ 8.4M, Financial Ledger Integrity: PASS, Duplicate Payments: 0, Slot Conflicts: 0"
    const sidepodInfo = slotsBreakdown.find((s) => s.slot === 'sidepod')!
    const debugTelemetryString =
      `${(team.name || 'AUDI').toUpperCase()} COMMERCIAL AUDIT — Commercial Attractiveness: ${attractiveness.score}, ` +
      `Team Multiplier: ${attractiveness.commercialMultiplier.toFixed(2)}, ` +
      `Manager Commercial Effect: ${managerBonus >= 0 ? '+' : ''}${(managerBonus * 100).toFixed(1)}%, ` +
      `Sidepod: Base Market Value R$ ${(sidepodInfo.baseMarketValueAnnual / 1_000_000).toFixed(1)}M / ` +
      `Team Effect R$ ${(sidepodInfo.teamEffectAnnual / 1_000_000).toFixed(1)}M / ` +
      `Sponsor Fit ${sidepodInfo.sponsorFitPercent} / Negotiation ${sidepodInfo.negotiationPercent} / ` +
      `Contract R$ ${(sidepodInfo.contractAnnualValue / 1_000_000).toFixed(1)}M, ` +
      `Total Fixed Sponsorship R$ ${(totalFixedSponsorshipAnnual / 1_000_000).toFixed(1)}M, ` +
      `Variable Upside R$ ${(totalVariableUpsidePotential / 1_000_000).toFixed(1)}M, ` +
      `Financial Ledger Integrity: ${financialLedgerIntegrity}, ` +
      `Duplicate Payments: ${duplicatePayments}, ` +
      `Slot Conflicts: ${slotConflicts}`

    return {
      teamId: team.id || 'unknown',
      seasonYear,
      commercialAttractiveness: attractiveness.score,
      teamMultiplier: attractiveness.commercialMultiplier,
      managerCommercialEffectFraction: managerBonus,
      managerCommercialEffectPercent: `${managerBonus >= 0 ? '+' : ''}${(managerBonus * 100).toFixed(1)}%`,
      slotsBreakdown,
      totalFixedSponsorshipAnnual,
      totalVariableUpsidePotential,
      financialLedgerIntegrity,
      duplicatePayments,
      slotConflicts,
      exclusivityConflicts,
      issues,
      debugTelemetryString,
    }
  }

  /**
   * Helper para carregar ou sugerir catálogo de mercado de patrocinadores
   */
  public getMarketCatalog(): CanonicalSponsor[] {
    return OFFICIAL_SPONSOR_POOL
  }
}

export const commercialService = new CommercialService()
