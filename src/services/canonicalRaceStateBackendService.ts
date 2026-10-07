/**
 * canonicalRaceStateBackendService.ts
 *
 * STORAGE-QUOTA-01B1-A — Adaptador PocketBase para Race State Canônico
 *
 * Objetivo:
 * Persistir e recuperar o estado canônico de corrida (CanonicalRaceState)
 * no PocketBase Skip Cloud por identidade canônica de sessão:
 * career_id + season + round + variant (MAIN_RACE vs SPRINT_RACE).
 *
 * Princípios e Contratos:
 * 1. Não toca em localStorage, não recalcula nem altera o payload.
 * 2. Isolamento estrito por sessionKey determinística:
 *    race_state_{careerId}_s{season}_r{round}_{variant}
 *    MAIN_RACE e SPRINT_RACE da mesma etapa nunca colidem ou se sobrescrevem.
 * 3. Upsert resiliente com controle de in-flight e cache em memória de record ID.
 * 4. readRaceState retorna CanonicalRaceState ou null quando não encontrado.
 * 5. Não conectado ao fluxo vivo nesta rodada (apenas infraestrutura desacoplada).
 */

import pb from '@/lib/pocketbase/client'
import type { CanonicalRaceState, RaceVariant } from '@/types/canonical-race-v2'

export interface CanonicalRaceBackendContext {
  careerId: string
  season: number
  round: number
  variant?: RaceVariant // Padrão: 'MAIN_RACE'
}

export interface CanonicalRaceStateBackendRecord {
  id: string
  session_key: string
  career_id: string
  season: number
  round: number
  variant: RaceVariant
  payload: CanonicalRaceState
  created: string
  updated: string
}

export class CanonicalRaceStateBackendService {
  private inFlightSaves = new Map<
    string,
    Promise<{ success: boolean; id?: string; error?: string }>
  >()
  private recordIdCache = new Map<string, string>()

  /**
   * Constrói a chave determinística única por identidade lógica de sessão.
   */
  public buildSessionKey(context: CanonicalRaceBackendContext): string {
    const variant: RaceVariant = context.variant || 'MAIN_RACE'
    return `race_state_${context.careerId}_s${context.season}_r${context.round}_${variant}`
  }

  /**
   * Salva o estado canônico de corrida no PocketBase (upsert pelo sessionKey).
   * Não recalcula nada e preserva integralmente o payload recebido.
   */
  public async saveRaceState(
    context: CanonicalRaceBackendContext,
    state: CanonicalRaceState,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const sessionKey = this.buildSessionKey(context)
    const existingInFlight = this.inFlightSaves.get(sessionKey)
    if (existingInFlight) {
      return existingInFlight
    }

    const savePromise = this.executeSave(sessionKey, context, state).finally(() => {
      this.inFlightSaves.delete(sessionKey)
    })

    this.inFlightSaves.set(sessionKey, savePromise)
    return savePromise
  }

  /**
   * Lê o estado canônico de corrida do PocketBase pela identidade de sessão.
   * Retorna CanonicalRaceState existente ou null se inexistente.
   * Não inicializa nova corrida.
   */
  public async readRaceState(
    context: CanonicalRaceBackendContext,
  ): Promise<CanonicalRaceState | null> {
    try {
      if (!pb?.collection) return null

      const sessionKey = this.buildSessionKey(context)
      const collection = pb.collection('canonical_race_states')

      // 1. Tentar por ID cacheado em memória se houver
      const cachedId = this.recordIdCache.get(sessionKey)
      if (cachedId) {
        try {
          const rec = await collection.getOne<CanonicalRaceStateBackendRecord>(cachedId)
          if (rec && rec.payload) {
            return rec.payload
          }
        } catch {
          this.recordIdCache.delete(sessionKey)
        }
      }

      // 2. Buscar por getFirstListItem com session_key
      try {
        const safeKey = sessionKey.replace(/"/g, '\\"')
        const rec = await collection.getFirstListItem<CanonicalRaceStateBackendRecord>(
          `session_key = "${safeKey}"`,
        )
        if (rec?.id) {
          this.recordIdCache.set(sessionKey, rec.id)
        }
        return rec?.payload || null
      } catch {
        // Not found
        return null
      }
    } catch {
      return null
    }
  }

  private async executeSave(
    sessionKey: string,
    context: CanonicalRaceBackendContext,
    state: CanonicalRaceState,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      if (!pb?.collection) {
        return { success: false, error: 'PocketBase client indisponível' }
      }

      const collection = pb.collection('canonical_race_states')
      const variant: RaceVariant = context.variant || 'MAIN_RACE'

      const pbPayload = {
        session_key: sessionKey,
        career_id: context.careerId,
        season: context.season,
        round: context.round,
        variant,
        payload: state,
      }

      // 1. Verificar se temos o ID em cache
      let existingId = this.recordIdCache.get(sessionKey)

      if (!existingId) {
        try {
          const safeKey = sessionKey.replace(/"/g, '\\"')
          const existingRecord = await collection.getFirstListItem<CanonicalRaceStateBackendRecord>(
            `session_key = "${safeKey}"`,
          )
          if (existingRecord?.id) {
            existingId = existingRecord.id
            this.recordIdCache.set(sessionKey, existingId)
          }
        } catch {
          // Registro não existe ainda
        }
      }

      // 2. Se já existe registro, atualiza (update)
      if (existingId) {
        try {
          const updated = await collection.update<CanonicalRaceStateBackendRecord>(
            existingId,
            pbPayload,
          )
          if (updated?.id) {
            this.recordIdCache.set(sessionKey, updated.id)
            return { success: true, id: updated.id }
          }
          return { success: true, id: existingId }
        } catch (updateErr: any) {
          this.recordIdCache.delete(sessionKey)
          console.warn(
            `[CanonicalRaceStateBackendService] Falha ao atualizar race_state (${existingId}), tentando re-criar:`,
            updateErr?.message || updateErr,
          )
        }
      }

      // 3. Se não existe ou update falhou, tenta criar (create)
      try {
        const created = await collection.create<CanonicalRaceStateBackendRecord>(pbPayload)
        if (created?.id) {
          this.recordIdCache.set(sessionKey, created.id)
          return { success: true, id: created.id }
        }
        return { success: true }
      } catch (createErr: any) {
        // 4. Tratar concorrência onde create falha por unicidade (validation_not_unique)
        const isUniqueError =
          createErr?.status === 400 &&
          (createErr?.response?.data?.session_key?.code === 'validation_not_unique' ||
            createErr?.data?.session_key?.code === 'validation_not_unique' ||
            createErr?.message?.includes('validation_not_unique') ||
            createErr?.message?.includes('Value must be unique'))

        if (isUniqueError) {
          try {
            const safeKey = sessionKey.replace(/"/g, '\\"')
            const raceRecord = await collection.getFirstListItem<CanonicalRaceStateBackendRecord>(
              `session_key = "${safeKey}"`,
            )
            if (raceRecord?.id) {
              this.recordIdCache.set(sessionKey, raceRecord.id)
              const updated = await collection.update<CanonicalRaceStateBackendRecord>(
                raceRecord.id,
                pbPayload,
              )
              return { success: true, id: updated?.id || raceRecord.id }
            }
          } catch (retryErr: any) {
            return {
              success: false,
              error: `Falha no retry pós-conflito: ${retryErr?.message || retryErr}`,
            }
          }
        }

        return {
          success: false,
          error: createErr?.message || 'Falha ao persistir estado de corrida no PocketBase',
        }
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erro inesperado ao salvar race state no PocketBase',
      }
    }
  }

  /**
   * Limpa caches em memória para isolamento e suítes de teste.
   */
  public clearCachesForTesting(): void {
    this.inFlightSaves.clear()
    this.recordIdCache.clear()
  }
}

export const canonicalRaceStateBackendService = new CanonicalRaceStateBackendService()
export default canonicalRaceStateBackendService
