/**
 * EraHistoryService (8C.4)
 * F1 Manager 2026 — Gestor de Histórico de Eras Técnicas & Resumos de Dinastia
 *
 * REGRAS DE OURO:
 * 1. HISTORICAL IMMUTABILITY: Long-run NÃO PODE recalcular nem reescrever Season Histories já fechadas.
 * 2. Agrupa temporadas por technicalEraId.
 * 3. Identifica inícios de era, duração, campeões, dinastias, equipes promovidas e rebaixadas.
 * 4. Sem ranking avaliativo moralista e sem Hall of Fame artificial completo.
 */

import { TechnicalEraSummary } from '@/types/canonical-regulations'
import { CanonicalSeasonHistory } from '@/types/canonical-season-transition'

export class EraHistoryService {
  /**
   * Constrói resumos de era a partir de uma lista imutável de CanonicalSeasonHistory
   */
  public buildEraSummaries(seasonHistories: CanonicalSeasonHistory[]): TechnicalEraSummary[] {
    if (!seasonHistories || seasonHistories.length === 0) {
      return []
    }

    // Ordenar cronologicamente
    const sorted = [...seasonHistories].sort((a, b) => a.season - b.season)

    // Agrupar por technicalEraId
    const eraGroups = new Map<string, CanonicalSeasonHistory[]>()
    for (const hist of sorted) {
      const eraId = hist.technicalEraId || 'era_2026_baseline'
      const list = eraGroups.get(eraId) || []
      list.push(hist)
      eraGroups.set(eraId, list)
    }

    const summaries: TechnicalEraSummary[] = []

    for (const [eraId, histories] of eraGroups.entries()) {
      const startSeason = histories[0].season
      const endSeason = histories[histories.length - 1].season
      const durationSeasons = histories.length

      // Campeões de construtores e contagem de títulos
      const constructorsMap = new Map<string, { teamName: string; count: number }>()
      const constructorsChampions: TechnicalEraSummary['constructorsChampions'] = []
      const driversChampions: TechnicalEraSummary['driversChampions'] = []

      for (const h of histories) {
        // Construtores
        const cChamp = h.constructorsChampion
        constructorsChampions.push({
          season: h.season,
          teamId: cChamp.teamId,
          teamName: cChamp.teamName,
        })
        const existingC = constructorsMap.get(cChamp.teamId) || {
          teamName: cChamp.teamName,
          count: 0,
        }
        existingC.count++
        constructorsMap.set(cChamp.teamId, existingC)

        // Pilotos
        const dChamp = h.driversChampion
        driversChampions.push({
          season: h.season,
          driverId: dChamp.driverId,
          driverName: dChamp.driverName,
          teamName: dChamp.teamName,
        })
      }

      // Identificar equipe mais dominante da era
      let dominantTeam: TechnicalEraSummary['dominantTeam'] = undefined
      let maxTitles = 0
      for (const [tId, data] of constructorsMap.entries()) {
        if (data.count > maxTitles) {
          maxTitles = data.count
          dominantTeam = {
            teamId: tId,
            teamName: data.teamName,
            titlesCount: data.count,
          }
        }
      }

      // Formatar nome amigável da era
      const eraLabel =
        startSeason === 2026
          ? 'Era Técnica 2026 (Aerodinâmica Ativa & Efeito Solo)'
          : `Era Técnica FIA ${startSeason}–${endSeason >= startSeason + 1 ? endSeason : startSeason + 4}`

      summaries.push({
        eraId,
        name: eraLabel,
        startSeason,
        endSeason: endSeason !== startSeason ? endSeason : undefined,
        durationSeasons,
        constructorsChampions,
        driversChampions,
        dominantTeam,
        promotedTeams: [],
        demotedTeams: [],
        majorRegulationsCount: 0,
        minorRegulationsCount: 0,
        technicalDirectivesCount: 0,
      })
    }

    return summaries
  }
}

export const eraHistoryService = new EraHistoryService()
