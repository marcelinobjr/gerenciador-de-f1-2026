/**
 * SERVIÇO DE SILLY SEASON, MERCADO EM CASCATA & CONFIDENCIALIDADE (7A)
 * F1 Manager 2026 — Implementação Nº 7A
 *
 * Princípios e Regras de Ouro:
 * 1. O mercado é uma rede: contratação abre vaga que puxa outra em cascata (≥3 equipes reagem).
 * 2. Verdade do backend ≠ Informação do jogador (Contratos confidenciais não vazam no Paddock).
 * 3. A IA não tem acesso ao truePotential nem ao futuro (decide por perceivedPotential, confiança e budget).
 * 4. Nenhuma equipe contrata 3 titulares para 2 vagas (seat reservation interna).
 * 5. Intensidade progressiva conforme o andamento da temporada.
 */

import pb from '@/lib/pocketbase/client'
import { DriverModel, TeamModel, SeasonModel } from '@/types/f1'
import {
  GridSeatStatus,
  SillySeasonRumor,
  DriverMarketDomainEvent,
  DriverContractRole,
  DriverContract,
} from '@/types/canonical-driver-market'
import { driverContractService } from './driverContractService'
import { infrastructureCapabilityService } from './infrastructureCapabilityService'

export interface SillySeasonSimulationResult {
  round: number
  eventsTriggered: DriverMarketDomainEvent[]
  rumorsGenerated: SillySeasonRumor[]
  affectedTeamsCount: number
  cascadeChainLength: number
  gridSummary: GridSeatStatus[]
}

export class SillySeasonService {
  /**
   * Constrói o estado real do grid (verdade do backend) e a versão pública filtrada (Paddock)
   */
  public buildGridSeatStatus(
    allTeams: TeamModel[],
    allDrivers: DriverModel[],
    seasonYear = 2026,
    isPublicView = false,
  ): GridSeatStatus[] {
    const grid: GridSeatStatus[] = []

    for (const team of allTeams) {
      // Pilotos titulares associados atualmente
      const currentTitulars = allDrivers.filter(
        (d) => d.team_id === team.id && d.role === 'titular',
      )
      const currentReserve = allDrivers.find(
        (d) => d.reserve_team_id === team.id || (d.team_id === team.id && d.role === 'reserva'),
      )

      // Futuros contratos já assinados para a próxima temporada
      const futureTitulars = allDrivers.filter(
        (d) => d.next_team_id === team.id && d.next_contract_role !== 'reserva',
      )
      const futureReserve = allDrivers.find(
        (d) => d.next_team_id === team.id && d.next_contract_role === 'reserva',
      )

      const seat1Driver = futureTitulars[0] || currentTitulars[0]
      const seat2Driver = futureTitulars[1] || currentTitulars[1]

      // Avaliação de confidencialidade
      const isSeat1Confidential = Boolean(
        (seat1Driver as any)?.future_contract?.announcementStatus === 'SIGNED_CONFIDENTIAL',
      )
      const isSeat2Confidential = Boolean(
        (seat2Driver as any)?.future_contract?.announcementStatus === 'SIGNED_CONFIDENTIAL',
      )

      const seat1Display =
        isPublicView && isSeat1Confidential
          ? 'Assento sob negociação'
          : seat1Driver?.name || 'Vaga Aberta'

      const seat2Display =
        isPublicView && isSeat2Confidential
          ? 'Assento sob negociação'
          : seat2Driver?.name || 'Vaga Aberta'

      grid.push({
        teamId: team.id,
        teamName: team.name,
        teamColor: team.color || '#E10600',
        seasonYear,
        seat1: {
          driverId: isPublicView && isSeat1Confidential ? undefined : seat1Driver?.id,
          driverName: isPublicView && isSeat1Confidential ? undefined : seat1Driver?.name,
          status: seat1Driver
            ? seat1Driver.next_team_id === team.id
              ? 'confirmed'
              : (seat1Driver.contract_end || 2026) <= seasonYear
                ? 'expiring'
                : 'confirmed'
            : 'open',
          isConfidential: isSeat1Confidential,
          publicDisplay: seat1Display,
        },
        seat2: {
          driverId: isPublicView && isSeat2Confidential ? undefined : seat2Driver?.id,
          driverName: isPublicView && isSeat2Confidential ? undefined : seat2Driver?.name,
          status: seat2Driver
            ? seat2Driver.next_team_id === team.id
              ? 'confirmed'
              : (seat2Driver.contract_end || 2026) <= seasonYear
                ? 'expiring'
                : 'confirmed'
            : 'open',
          isConfidential: isSeat2Confidential,
          publicDisplay: seat2Display,
        },
        reserveSeat: {
          driverId: futureReserve?.id || currentReserve?.id,
          driverName: futureReserve?.name || currentReserve?.name,
          status: futureReserve || currentReserve ? 'confirmed' : 'open',
          publicDisplay: futureReserve?.name || currentReserve?.name || 'Vaga Aberta',
        },
      })
    }

    return grid
  }

  /**
   * Coordena a Silly Season com efeito cascata (≥3 equipes reagem sequencialmente)
   * A IA NUNCA consulta truePotential! Apenas perceivedPotential, confidence, idade, speed e orçamento.
   */
  public async simulateSillySeasonRound(
    currentRound: number,
    totalRounds = 24,
    allTeams: TeamModel[],
    allDrivers: DriverModel[],
    playerTeamId: string,
    currentSeasonYear = 2026,
  ): Promise<SillySeasonSimulationResult> {
    const seasonProgressRatio = currentRound / totalRounds
    const eventsTriggered: DriverMarketDomainEvent[] = []
    const rumorsGenerated: SillySeasonRumor[] = []

    // No início da temporada (progress < 0.25), mercado calmo
    // Meio da temporada (0.25 - 0.65), sondagens e primeiros acordos
    // Reta final (0.65 - 1.0), resolução agressiva de vagas e cascata
    if (seasonProgressRatio < 0.2) {
      return {
        round: currentRound,
        eventsTriggered: [],
        rumorsGenerated: [],
        affectedTeamsCount: 0,
        cascadeChainLength: 0,
        gridSummary: this.buildGridSeatStatus(allTeams, allDrivers, currentSeasonYear, false),
      }
    }

    // Identificar vagas em aberto para a próxima temporada entre equipes de IA
    const rivalTeams = allTeams.filter((t) => t.id !== playerTeamId)
    const affectedTeamIds = new Set<string>()

    // Seleciona uma equipe com vaga precisando contratar
    const teamsWithOpenFutureSeat = rivalTeams.filter((t) => {
      const assignedNext = allDrivers.filter(
        (d) => d.next_team_id === t.id && d.next_contract_role !== 'reserva',
      )
      return assignedNext.length < 2
    })

    if (teamsWithOpenFutureSeat.length === 0) {
      return {
        round: currentRound,
        eventsTriggered: [],
        rumorsGenerated: [],
        affectedTeamsCount: 0,
        cascadeChainLength: 0,
        gridSummary: this.buildGridSeatStatus(allTeams, allDrivers, currentSeasonYear, false),
      }
    }

    // Equipe 1 inicia a cascata
    const primaryTeam = teamsWithOpenFutureSeat[0]
    affectedTeamIds.add(primaryTeam.id)

    // Candidatos elegíveis (NÃO ler true_potential!)
    const eligibleDrivers = allDrivers.filter((d) => {
      // Não pode ser piloto já garantido para next_team_id
      if (d.next_team_id) return false
      // Se for titular do player, a IA só tenta se o contrato estiver no fim e o piloto estiver insatisfeito
      if (d.team_id === playerTeamId) {
        const intent = driverContractService.deriveCareerIntent(d, null, primaryTeam.strength || 70)
        return (d.contract_end || 2026) <= currentSeasonYear && intent.state !== 'COMMITTED'
      }
      return true
    })

    if (eligibleDrivers.length === 0) {
      return {
        round: currentRound,
        eventsTriggered: [],
        rumorsGenerated: [],
        affectedTeamsCount: 0,
        cascadeChainLength: 0,
        gridSummary: this.buildGridSeatStatus(allTeams, allDrivers, currentSeasonYear, false),
      }
    }

    // IA seleciona candidato usando perceived_potential e budget
    const targetDriver = this.selectBestFitDriverForAiTeam(primaryTeam, eligibleDrivers)
    if (!targetDriver) {
      return {
        round: currentRound,
        eventsTriggered: [],
        rumorsGenerated: [],
        affectedTeamsCount: 0,
        cascadeChainLength: 0,
        gridSummary: this.buildGridSeatStatus(allTeams, allDrivers, currentSeasonYear, false),
      }
    }

    // Efetiva assinatura contratual da Equipe 1 com targetDriver
    const previousTeamId = targetDriver.team_id
    const previousTeam = allTeams.find((t) => t.id === previousTeamId)
    const isConfidential = Math.random() < 0.45 // 45% de chance de sigilo inicial

    const primaryOffer = {
      offerId: `offer_ai_${primaryTeam.id}_${targetDriver.id}`,
      teamId: primaryTeam.id,
      teamName: primaryTeam.name,
      driverId: targetDriver.id,
      driverName: targetDriver.name,
      annualSalary: Math.round((targetDriver.salary || 3500000) * 1.15),
      durationYears: 2,
      role: 'EQUAL_STATUS' as DriverContractRole,
      signingBonus: Math.round((targetDriver.salary || 3500000) * 0.1),
      performanceBonuses: [],
      teamOptionIncluded: true,
      driverOptionIncluded: false,
      buyoutAmount: Math.round((targetDriver.salary || 3500000) * 1.8),
      offeredSeason: currentSeasonYear,
      startSeason: currentSeasonYear + 1,
      expirationRound: currentRound + 2,
      status: 'AGREEMENT' as const,
      isConfidential,
      roundsOfTalks: 1,
      driverPatienceRemaining: 4,
    }

    const signResult1 = await driverContractService.finalizeAndSignContract(
      primaryOffer,
      primaryTeam,
      targetDriver,
      currentRound,
      currentSeasonYear,
    )

    if (signResult1.success) {
      eventsTriggered.push(signResult1.domainEvent)
      if (isConfidential) {
        rumorsGenerated.push({
          id: `rumor_leak_${targetDriver.id}_${currentRound}`,
          driverName: targetDriver.name,
          targetTeamName: primaryTeam.name,
          credibility: 'credible',
          headline: `Fontes internas indicam conversas avançadas entre ${targetDriver.name} e a ${primaryTeam.name}`,
          details:
            'Representantes foram vistos na hospitalidade da equipe durante o fim de semana de corrida.',
          roundReported: currentRound,
          isConfidentialLeak: true,
        })
      }
    }

    // CASCATA: Se o piloto pertencia a outra equipe, aquela equipe agora tem uma vaga e reage!
    let cascadeChainLength = 1
    if (previousTeam && previousTeam.id !== playerTeamId) {
      affectedTeamIds.add(previousTeam.id)
      cascadeChainLength++

      // Equipe 2 busca reposição
      const remainingCandidates = eligibleDrivers.filter(
        (d) => d.id !== targetDriver.id && !d.next_team_id,
      )
      const replacementDriver = this.selectBestFitDriverForAiTeam(previousTeam, remainingCandidates)

      if (replacementDriver) {
        const secondaryPrevTeamId = replacementDriver.team_id
        const secondaryPrevTeam = allTeams.find((t) => t.id === secondaryPrevTeamId)

        const secondaryOffer = {
          offerId: `offer_cascade_${previousTeam.id}_${replacementDriver.id}`,
          teamId: previousTeam.id,
          teamName: previousTeam.name,
          driverId: replacementDriver.id,
          driverName: replacementDriver.name,
          annualSalary: Math.round((replacementDriver.salary || 3000000) * 1.1),
          durationYears: 1,
          role: 'EQUAL_STATUS' as DriverContractRole,
          signingBonus: 0,
          performanceBonuses: [],
          teamOptionIncluded: false,
          driverOptionIncluded: false,
          buyoutAmount: 0,
          offeredSeason: currentSeasonYear,
          startSeason: currentSeasonYear + 1,
          expirationRound: currentRound + 2,
          status: 'AGREEMENT' as const,
          isConfidential: false,
          roundsOfTalks: 1,
          driverPatienceRemaining: 4,
        }

        const signResult2 = await driverContractService.finalizeAndSignContract(
          secondaryOffer,
          previousTeam,
          replacementDriver,
          currentRound,
          currentSeasonYear,
        )

        if (signResult2.success) {
          eventsTriggered.push(signResult2.domainEvent)
        }

        // Equipe 3 da cascata: se o substituto também saiu de outra equipe rival!
        if (secondaryPrevTeam && secondaryPrevTeam.id !== playerTeamId) {
          affectedTeamIds.add(secondaryPrevTeam.id)
          cascadeChainLength++

          const thirdCandidates = remainingCandidates.filter((d) => d.id !== replacementDriver.id)
          const thirdDriver = this.selectBestFitDriverForAiTeam(secondaryPrevTeam, thirdCandidates)

          if (thirdDriver) {
            const thirdOffer = {
              offerId: `offer_cascade_3_${secondaryPrevTeam.id}_${thirdDriver.id}`,
              teamId: secondaryPrevTeam.id,
              teamName: secondaryPrevTeam.name,
              driverId: thirdDriver.id,
              driverName: thirdDriver.name,
              annualSalary: Math.round((thirdDriver.salary || 2500000) * 1.1),
              durationYears: 1,
              role: 'EQUAL_STATUS' as DriverContractRole,
              signingBonus: 0,
              performanceBonuses: [],
              teamOptionIncluded: false,
              driverOptionIncluded: false,
              buyoutAmount: 0,
              offeredSeason: currentSeasonYear,
              startSeason: currentSeasonYear + 1,
              expirationRound: currentRound + 2,
              status: 'AGREEMENT' as const,
              isConfidential: false,
              roundsOfTalks: 1,
              driverPatienceRemaining: 4,
            }

            const signResult3 = await driverContractService.finalizeAndSignContract(
              thirdOffer,
              secondaryPrevTeam,
              thirdDriver,
              currentRound,
              currentSeasonYear,
            )
            if (signResult3.success) {
              eventsTriggered.push(signResult3.domainEvent)
            }
          }
        }
      }
    }

    return {
      round: currentRound,
      eventsTriggered,
      rumorsGenerated,
      affectedTeamsCount: affectedTeamIds.size,
      cascadeChainLength,
      gridSummary: this.buildGridSeatStatus(allTeams, allDrivers, currentSeasonYear, false),
    }
  }

  /**
   * Seleciona o melhor piloto para a IA sem NUNCA tocar em truePotential!
   * IA consulta APENAS: speed, consistency, perceived_potential, evaluation_confidence, idade e salário.
   */
  public selectBestFitDriverForAiTeam(
    team: TeamModel,
    candidates: DriverModel[],
  ): DriverModel | null {
    if (candidates.length === 0) return null

    const teamBudget = team.budget || 50000000
    const teamStrength = team.strength || 70
    const isTopTeam = teamStrength >= 82

    let bestScore = -1
    let bestCandidate: DriverModel | null = null

    for (const d of candidates) {
      // INSTRUMENTAÇÃO ESTREITA: Garantir que true_potential NÃO é lido
      const perceived = (d as any).perceived_potential || 70
      const confidence = (d as any).evaluation_confidence || 40
      const speed = d.speed || 65
      const consistency = d.consistency || 65
      const age = d.age || 24
      const salary = d.salary || 3000000

      // Limite orçamentário da IA: não pode comprometer mais que 25% do saldo anual em 1 piloto
      if (salary > teamBudget * 0.35) continue

      let fitScore = 0
      if (isTopTeam) {
        // Equipes de ponta querem pilotos consolidados com alta velocidade percebida
        fitScore =
          speed * 0.6 +
          consistency * 0.2 +
          ((perceived * confidence) / 100) * 0.2 -
          (age > 35 ? 10 : 0)
      } else {
        // Equipes em reconstrução/médias valorizam custo-benefício e potencial percebido
        const costEfficiency = Math.max(0, 100 - (salary / 1000000) * 5)
        fitScore = ((perceived * confidence) / 100) * 0.45 + speed * 0.3 + costEfficiency * 0.25
      }

      if (fitScore > bestScore) {
        bestScore = fitScore
        bestCandidate = d
      }
    }

    return bestCandidate
  }

  /**
   * Auditoria de integridade do mercado de pilotos (auditDriverMarket)
   */
  public auditDriverMarket(
    allTeams: TeamModel[],
    allDrivers: DriverModel[],
    seasonYear = 2026,
  ): {
    isValid: boolean
    duplicateContractDrivers: string[]
    futureSeatConflicts: string[]
    teamsWithTooManyTitulars: string[]
    invalidSalaries: string[]
    freeAgentsCount: number
    confidentialVsPublicMismatches: string[]
    integrityLogs: string[]
  } {
    const duplicateContractDrivers: string[] = []
    const futureSeatConflicts: string[] = []
    const teamsWithTooManyTitulars: string[] = []
    const invalidSalaries: string[] = []
    const confidentialVsPublicMismatches: string[] = []
    const integrityLogs: string[] = []

    // 1. Verificar titulares por equipe (não pode ter >2 titulares simultâneos)
    for (const team of allTeams) {
      const titulares = allDrivers.filter((d) => d.team_id === team.id && d.role === 'titular')
      if (titulares.length > 2) {
        teamsWithTooManyTitulars.push(
          `${team.name} tem ${titulares.length} pilotos titulares registrados!`,
        )
      }

      const futureTitulares = allDrivers.filter(
        (d) => d.next_team_id === team.id && d.next_contract_role !== 'reserva',
      )
      if (futureTitulares.length > 2) {
        futureSeatConflicts.push(
          `${team.name} assinou com ${futureTitulares.length} pilotos titulares para a próxima temporada!`,
        )
      }
    }

    // 2. Verificar salários e contratos duplicados
    let freeAgentsCount = 0
    for (const d of allDrivers) {
      if (!d.team_id && !d.reserve_team_id) {
        freeAgentsCount++
      }

      if (d.salary !== undefined && d.salary < 0) {
        invalidSalaries.push(`${d.name} possui salário negativo: ${d.salary}`)
      }

      if (d.team_id && d.reserve_team_id && d.team_id === d.reserve_team_id) {
        duplicateContractDrivers.push(
          `${d.name} está simultaneamente como titular e reserva na mesma equipe.`,
        )
      }
    }

    const isValid =
      duplicateContractDrivers.length === 0 &&
      futureSeatConflicts.length === 0 &&
      teamsWithTooManyTitulars.length === 0 &&
      invalidSalaries.length === 0

    integrityLogs.push(
      `[MARKET AUDIT ${seasonYear}] Equipes: ${allTeams.length} / Pilotos: ${allDrivers.length} / Agentes Livres: ${freeAgentsCount} / Status: ${
        isValid ? 'OK' : 'INCONSISTENTE'
      }`,
    )

    return {
      isValid,
      duplicateContractDrivers,
      futureSeatConflicts,
      teamsWithTooManyTitulars,
      invalidSalaries,
      freeAgentsCount,
      confidentialVsPublicMismatches,
      integrityLogs,
    }
  }
}

export const sillySeasonService = new SillySeasonService()
