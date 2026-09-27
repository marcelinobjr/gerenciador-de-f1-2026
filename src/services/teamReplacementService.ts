/**
 * teamReplacementService.ts — Regra Canônica de Substituição Opcional da Última Colocada.
 *
 * REGRA DO USUÁRIO (APROVADA):
 * "No final da temporada, a equipe que ficar em último lugar poderá ser substituída
 * por outra equipe na próxima temporada, a critério do jogador."
 *
 * DIRETRIZES E REQUISITOS (FIN-SOURCE-01B):
 * 1. SOMENTE a última colocada do Campeonato de Construtores pode perder sua vaga por esta regra.
 * 2. Somente UMA substituição por encerramento de temporada (vale exclusivamente para a temporada seguinte).
 * 3. IDENTIFICAÇÃO CANÔNICA: Consumir classificação oficial e seus critérios de desempate (ex: desempate canônico FIA).
 *    Não fixar a última posição como 12º — usar o grid real do save.
 * 4. Não usar saldo financeiro para escolher a equipe; não permitir rebaixamento obrigatório;
 *    não implementar sorteio de exclusão ou substituição automática motivada por saldo negativo.
 * 5. ESCOLHER A ENTRANTE:
 *    - Listar equipes elegíveis do universo da carreira que NÃO estejam inscritas no grid da temporada seguinte.
 *    - Mantém o número total de equipes (uma sai, uma entra).
 *    - Exigir confirmação explícita antes da gravação definitiva. Cancelar não remove ninguém.
 * 6. PRESERVAÇÃO DE IDENTIDADE E HISTÓRICO:
 *    - A equipe que sai conserva identidade, resultados, pontos e posições anteriores, títulos, estatísticas e histórico financeiro.
 *    - Não transferir automaticamente para a entrante: caixa, dívidas, patrocinadores, contratos de pilotos ou staff, instalações.
 *    - A entrante é financiada uma única vez (sem recriar cadastro limpo para receber dinheiro de novo).
 * 7. EQUIPE DO JOGADOR:
 *    - Se a última colocada for a equipe humana, a regra também se aplica, oferecendo manter ou substituir.
 *    - Se substituída a equipe humana, registrar a pendência de gameplay/transição explícita.
 * 8. PERSISTÊNCIA E IDEMPOTÊNCIA:
 *    - Registro por carreira e transição: season encerrada, temporada destino, equipe que sai, equipe entrante, decisão.
 *    - Reload ou falha parcial é recuperável e não duplica a operação.
 */

import pb from '@/lib/pocketbase/client'
import { ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'
import { TeamModel } from '@/types/f1'

export type ReplacementDecisionType = 'KEEP' | 'REPLACE'

export interface ReplacementRecord {
  id?: string
  transitionKey: string
  fromSeasonYear: number
  toSeasonYear: number
  lastPlaceTeamId: string
  lastPlaceTeamName: string
  decision: ReplacementDecisionType
  replacementTeamKey?: string
  replacementTeamName?: string
  officialRankingReference: string
  confirmed: boolean
  applied: boolean
  createdAt: string
  appliedAt?: string
}

export interface EligibleReplacementCandidate {
  key: string
  name: string
  shortName: string
  country: string
  color: string
  engine: string
  strength: number
  budget: number
  historySummary: string
  currentSituation: string
}

export class TeamReplacementService {
  /**
   * Obtém chave estável de decisão da transição
   */
  public getReplacementKey(fromSeasonYear: number, toSeasonYear: number, teamId: string): string {
    return `replacement_${fromSeasonYear}->${toSeasonYear}_${teamId}`
  }

  /**
   * Identifica canonicamente a última colocada do campeonato de construtores
   */
  public identifyLastPlaceTeam(
    constructorStandings: Array<{
      id?: string
      teamId?: string
      name?: string
      teamName?: string
      points?: number
    }>,
  ): {
    teamId: string
    teamName: string
    rank: number
    points: number
  } | null {
    if (!constructorStandings || constructorStandings.length === 0) {
      return null
    }

    const total = constructorStandings.length
    const lastStanding = constructorStandings[total - 1]
    const id = lastStanding.id || lastStanding.teamId || ''
    const name = lastStanding.name || lastStanding.teamName || 'Equipe'

    return {
      teamId: id,
      teamName: name,
      rank: total,
      points: lastStanding.points || 0,
    }
  }

  /**
   * Retorna as equipes elegíveis do universo para entrar como substituta.
   * Filtra todas as que já estão no grid atual.
   */
  public getEligibleReplacementTeams(currentGridKeys: string[]): EligibleReplacementCandidate[] {
    const registeredSet = new Set(currentGridKeys.map((k) => k.toLowerCase().trim()))

    return ALL_GRID_TEAMS_DATABASE.filter(
      (candidate) => !registeredSet.has(candidate.key.toLowerCase().trim()),
    ).map((t) => ({
      key: t.key,
      name: t.name,
      shortName: t.shortName,
      country: t.country,
      color: t.color,
      engine: t.engine,
      strength: t.strength,
      budget: t.budget,
      historySummary: t.historySummary,
      currentSituation: t.currentSituation,
    }))
  }

  /**
   * Carrega decisão de substituição persistida se já existir
   */
  public async getPersistedReplacementDecision(
    fromSeasonYear: number,
    toSeasonYear: number,
    teamId: string,
  ): Promise<ReplacementRecord | null> {
    const transitionKey = this.getReplacementKey(fromSeasonYear, toSeasonYear, teamId)
    try {
      const existing = await pb
        .collection('season_transitions')
        .getFirstListItem(`transition_key="${transitionKey}"`)

      if (existing && existing.snapshot_data?.replacementDecision) {
        return existing.snapshot_data.replacementDecision as ReplacementRecord
      }
    } catch {
      // Nenhum registro encontrado no PocketBase
    }

    // Fallback de armazenamento local estruturado
    try {
      const localStr = localStorage.getItem(`apex_replacement_${transitionKey}`)
      if (localStr) {
        return JSON.parse(localStr) as ReplacementRecord
      }
    } catch {
      // tolerância
    }

    return null
  }

  /**
   * Persiste a decisão do jogador (Manter ou Escolher Substituta)
   */
  public async saveReplacementDecision(record: ReplacementRecord): Promise<void> {
    const transitionKey = record.transitionKey

    // Persistir em localStorage para resiliência local
    try {
      localStorage.setItem(`apex_replacement_${transitionKey}`, JSON.stringify(record))
    } catch {
      // tolerância
    }

    // Persistir na collection season_transitions
    try {
      let existingRecord: any = null
      try {
        existingRecord = await pb
          .collection('season_transitions')
          .getFirstListItem(`transition_key="${transitionKey}"`)
      } catch {
        existingRecord = null
      }

      const payload = {
        transition_key: transitionKey,
        from_season: record.fromSeasonYear,
        to_season: record.toSeasonYear,
        team_id: record.lastPlaceTeamId,
        status: record.applied ? 'APPLIED' : 'DECIDED',
        current_step: 'REPLACEMENT_DECISION',
        snapshot_data: {
          replacementDecision: record,
        },
      }

      if (existingRecord) {
        await pb.collection('season_transitions').update(existingRecord.id, payload)
      } else {
        await pb.collection('season_transitions').create(payload)
      }
    } catch (err) {
      console.warn(
        'Persistência remota da decisão de substituição em season_transitions (usando local fallback):',
        err,
      )
    }
  }

  /**
   * Aplica a transição de inscrição no grid da temporada seguinte.
   * Não altera equipes no grid histórico anterior; mantém conservado todo o histórico da equipe que sai.
   */
  public applyGridReplacement(params: {
    currentGridKeys: string[]
    lastPlaceTeamKey: string
    replacementTeamKey: string
  }): { updatedGridKeys: string[]; success: boolean; reason?: string } {
    const { currentGridKeys, lastPlaceTeamKey, replacementTeamKey } = params

    const targetKeyNorm = lastPlaceTeamKey.toLowerCase().trim()
    const entrantKeyNorm = replacementTeamKey.toLowerCase().trim()

    // 1. Validar se a entrante já não está inscrita
    if (currentGridKeys.some((k) => k.toLowerCase().trim() === entrantKeyNorm)) {
      return {
        updatedGridKeys: currentGridKeys,
        success: false,
        reason: `A equipe entrante '${replacementTeamKey}' já está inscrita no grid.`,
      }
    }

    // 2. Validar se a que sai está no grid
    const targetIdx = currentGridKeys.findIndex((k) => k.toLowerCase().trim() === targetKeyNorm)
    if (targetIdx === -1) {
      return {
        updatedGridKeys: currentGridKeys,
        success: false,
        reason: `A equipe última colocada '${lastPlaceTeamKey}' não foi localizada no grid.`,
      }
    }

    // 3. Substituição 1 por 1 mantendo a contagem de vagas
    const updatedGridKeys = [...currentGridKeys]
    updatedGridKeys[targetIdx] = entrantKeyNorm

    return {
      updatedGridKeys,
      success: true,
    }
  }
}

export const teamReplacementService = new TeamReplacementService()
export default teamReplacementService
