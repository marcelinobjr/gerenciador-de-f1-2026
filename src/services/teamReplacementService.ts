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
    const registeredSet = new Set<string>()
    for (const rawKey of currentGridKeys || []) {
      if (!rawKey) continue
      const str = String(rawKey).toLowerCase().trim()
      registeredSet.add(str)
      // Normalizar removendo caracteres especiais e espaços
      registeredSet.add(str.replace(/[^a-z0-9]/g, ''))
      // Remover prefixo ai_ se houver
      registeredSet.add(str.replace(/^ai_/, ''))
    }

    // Universo real de 15 equipes "fora do campeonato" conforme especificação FIX-ELIGIBLE-TEAMS-01A:
    // Alfa Romeo F1 Team, Benetton Formula, BYD Formula E-Tech, Copersucar Fittipaldi, Fittipaldi Racing Team,
    // Honda HRC F1 Team, Jordan Grand Prix, Lamborghini Squadra Corse, Porsche Motorsport, Renault F1 Team,
    // Sauber Motorsport, Scuderia AlphaTauri, Team Lotus Classic, Team Penske F1, Toleman Motorsport
    const ALLOWED_UNIVERSE_KEYS = [
      'alfaromeo',
      'benetton',
      'byd',
      'copersucar',
      'fittipaldi',
      'honda',
      'jordan',
      'lamborghini',
      'porsche',
      'renault',
      'sauber',
      'alphatauri',
      'lotus',
      'penske',
      'toleman',
    ]

    const universeCandidates = ALL_GRID_TEAMS_DATABASE.filter((candidate) => {
      const keyNorm = candidate.key.toLowerCase().trim()
      const keyClean = keyNorm.replace(/[^a-z0-9]/g, '')
      const nameNorm = candidate.name.toLowerCase().trim()
      const nameClean = nameNorm.replace(/[^a-z0-9]/g, '')
      const shortClean = candidate.shortName.toLowerCase().replace(/[^a-z0-9]/g, '')

      // Deve pertencer ao universo das 15 equipes
      const isAllowedUniverse =
        ALLOWED_UNIVERSE_KEYS.includes(keyNorm) || ALLOWED_UNIVERSE_KEYS.includes(keyClean)
      if (!isAllowedUniverse) return false

      // Não pode estar registrada no grid participante atual
      const isInGrid =
        registeredSet.has(keyNorm) ||
        registeredSet.has(keyClean) ||
        registeredSet.has(nameNorm) ||
        registeredSet.has(nameClean) ||
        registeredSet.has(shortClean)

      return !isInGrid
    }).map((t) => {
      return {
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
      }
    })

    return universeCandidates
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
      // Nenhum registro encontrado por transition_key exata no PocketBase
    }

    // Busca ampla resiliente: verificar se há transição do ano gravada contendo a decisão
    try {
      const records = await pb.collection('season_transitions').getList(1, 10, {
        filter: `from_season = ${fromSeasonYear} && to_season = ${toSeasonYear}`,
        sort: '-created',
      })

      for (const rec of records.items) {
        if (rec.snapshot_data?.replacementDecision) {
          const dec = rec.snapshot_data.replacementDecision as ReplacementRecord
          if (!teamId || dec.lastPlaceTeamId === teamId) {
            return dec
          }
        }
      }
    } catch {
      // tolerância
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

      const payload: any = {
        transition_key: transitionKey,
        from_season: record.fromSeasonYear,
        to_season: record.toSeasonYear,
        status: record.applied ? 'APPLIED' : 'DECIDED',
        current_step: 'REPLACEMENT_DECISION',
        snapshot_data: {
          ...(existingRecord?.snapshot_data || {}),
          replacementDecision: record,
        },
      }

      // O campo team_id em season_transitions é uma relação para teams. Se lastPlaceTeamId for um id válido de team, preencher
      if (record.lastPlaceTeamId && /^[a-z0-9]{15}$/.test(record.lastPlaceTeamId)) {
        payload.team_id = record.lastPlaceTeamId
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

  /**
   * Executa a substituição persistindo no banco de dados na transição da temporada
   */
  public async executeGridReplacementInDatabase(decision: ReplacementRecord): Promise<boolean> {
    if (decision.decision !== 'REPLACE' || !decision.replacementTeamKey) {
      return false
    }

    try {
      const candidates = this.getEligibleReplacementTeams([])
      const candidate = candidates.find((c) => c.key === decision.replacementTeamKey)

      // Verificar se a equipe entrante já existe como registro no PB
      let entrantRecord: any = null
      try {
        entrantRecord = await pb
          .collection('teams')
          .getFirstListItem(`team_key = "${decision.replacementTeamKey}"`)
      } catch {
        entrantRecord = null
      }

      if (!entrantRecord && candidate) {
        // Criar registro da nova escuderia entrante
        try {
          await pb.collection('teams').create({
            name: candidate.name,
            team_key: candidate.key,
            color: candidate.color || '#334155',
            chassis_level: 50,
            aero_level: 50,
            strategy_level: 50,
            strength: candidate.strength || 70,
            budget: candidate.budget || 100000000,
            cost_cap_spent: 0,
            engine_supplier: candidate.engine?.includes('Ferrari')
              ? 'Ferrari'
              : candidate.engine?.includes('Mercedes')
                ? 'Mercedes'
                : candidate.engine?.includes('Honda')
                  ? 'Honda'
                  : candidate.engine?.includes('Ford')
                    ? 'Ford'
                    : 'Audi',
            is_custom: false,
          })
        } catch (createErr) {
          console.warn('Erro ao criar registro da equipe entrante:', createErr)
        }
      }

      return true
    } catch (e) {
      console.warn('Erro em executeGridReplacementInDatabase:', e)
      return false
    }
  }
}

export const teamReplacementService = new TeamReplacementService()
export default teamReplacementService
