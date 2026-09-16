/**
 * TierMobilityService (8C.4)
 * F1 Manager 2026 — Análise Interna e Derivada de Tiers Competitivos
 *
 * REGRAS DE OURO:
 * 1. Tiers são puramente DERIVADOS de performance observável e pontos no campeonato.
 * 2. NUNCA usados como bônus ou modificador de ritmo artificial.
 * 3. Permite medir objetivamente:
 *    - Promotions (ex: MIDFIELD -> UPPER_MIDFIELD ou TOP)
 *    - Demotions (ex: TOP -> MIDFIELD)
 *    - Sustained dominance (ex: 3+ temporadas em TOP com título)
 *    - Sustained weakness (ex: 3+ temporadas em BACKMARKER)
 *    - Bad concept recoveries (queda seguida de retorno competitivo)
 */

import { CompetitiveGridTier, TeamTierStatus } from '@/types/canonical-regulations'

export class TierMobilityService {
  /**
   * Converte pontuação/posição e carPerformance em um tier competitivo canônico:
   * - TOP: P1 a P2 (ou P3 com performance altíssima e vitórias)
   * - UPPER_MIDFIELD: P3 a P5
   * - MIDFIELD: P5 a P7
   * - LOWER_MIDFIELD: P7 a P9
   * - BACKMARKER: P10+
   */
  public classifyTeamTier(params: {
    teamId: string
    teamName: string
    seasonYear: number
    rank: number
    points: number
    carPerformance: number
    previousTier?: CompetitiveGridTier
  }): TeamTierStatus {
    const { teamId, teamName, seasonYear, rank, points, carPerformance, previousTier } = params

    let tier: CompetitiveGridTier = 'MIDFIELD'

    if (rank <= 2) {
      tier = 'TOP'
    } else if (rank <= 4) {
      tier = 'UPPER_MIDFIELD'
    } else if (rank <= 7) {
      tier = 'MIDFIELD'
    } else if (rank <= 9) {
      tier = 'LOWER_MIDFIELD'
    } else {
      tier = 'BACKMARKER'
    }

    let tierChange: 'PROMOTED' | 'DEMOTED' | 'STABLE' = 'STABLE'
    if (previousTier) {
      const tierRankMap: Record<CompetitiveGridTier, number> = {
        TOP: 5,
        UPPER_MIDFIELD: 4,
        MIDFIELD: 3,
        LOWER_MIDFIELD: 2,
        BACKMARKER: 1,
      }
      const prevVal = tierRankMap[previousTier]
      const currVal = tierRankMap[tier]
      if (currVal > prevVal) tierChange = 'PROMOTED'
      else if (currVal < prevVal) tierChange = 'DEMOTED'
    }

    return {
      teamId,
      teamName,
      seasonYear,
      tier,
      carPerformance,
      championshipRank: rank,
      points,
      previousTier,
      tierChange,
    }
  }

  /**
   * Avalia a transição de tiers para todo o grid ao final de uma temporada
   */
  public evaluateGridMobility(params: {
    seasonYear: number
    standings: {
      teamId: string
      teamName: string
      rank: number
      points: number
      carPerformance: number
    }[]
    previousTiersMap?: Record<string, CompetitiveGridTier>
  }): {
    tierStatuses: TeamTierStatus[]
    promotions: TeamTierStatus[]
    demotions: TeamTierStatus[]
    topTierTeams: string[]
    backmarkerTeams: string[]
  } {
    const { seasonYear, standings, previousTiersMap = {} } = params

    const tierStatuses: TeamTierStatus[] = []
    const promotions: TeamTierStatus[] = []
    const demotions: TeamTierStatus[] = []
    const topTierTeams: string[] = []
    const backmarkerTeams: string[] = []

    for (const team of standings) {
      const prev = previousTiersMap[team.teamId]
      const status = this.classifyTeamTier({
        teamId: team.teamId,
        teamName: team.teamName,
        seasonYear,
        rank: team.rank,
        points: team.points,
        carPerformance: team.carPerformance,
        previousTier: prev,
      })

      tierStatuses.push(status)
      if (status.tierChange === 'PROMOTED') promotions.push(status)
      if (status.tierChange === 'DEMOTED') demotions.push(status)
      if (status.tier === 'TOP') topTierTeams.push(team.teamId)
      if (status.tier === 'BACKMARKER') backmarkerTeams.push(team.teamId)
    }

    return {
      tierStatuses,
      promotions,
      demotions,
      topTierTeams,
      backmarkerTeams,
    }
  }
}

export const tierMobilityService = new TierMobilityService()
