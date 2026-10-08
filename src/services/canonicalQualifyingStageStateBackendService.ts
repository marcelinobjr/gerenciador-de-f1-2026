/**
 * canonicalQualifyingStageStateBackendService.ts
 *
 * Serviço de sincronização e espelhamento autoritativo de estados de fase
 * de qualificação (QualifyingStageState) no PocketBase (Skip Cloud).
 *
 * Coleção: canonical_qualifying_stage_states
 * Estrutura:
 * - state_key: string (UNIQUE) - "apex_qualifying_stage_state_v2_{careerId}_r{round}_{stage}"
 * - career_id: string
 * - season: number
 * - round: number
 * - stage: 'q1' | 'q2' | 'q3' | 'sq1' | 'sq2' | 'sq3'
 * - payload: JSON (QualifyingStageState completo)
 */

import pb from '@/lib/pocketbase/client'
import type { QualifyingStageId, QualifyingStageState } from '@/types/canonical-qualifying-types'

export interface CanonicalQualifyingStageStateBackendContext {
  careerId: string
  season: number
  round: number
  stage: QualifyingStageId
}

export interface CanonicalQualifyingStageStateBackendRecord {
  id: string
  state_key: string
  career_id: string
  season: number
  round: number
  stage: QualifyingStageId
  payload: QualifyingStageState
  created?: string
  updated?: string
}

export class CanonicalQualifyingStageStateBackendService {
  private inFlightSaves = new Map<
    string,
    Promise<{ success: boolean; id?: string; error?: string }>
  >()
  private recordIdCache = new Map<string, string>()

  /**
   * Constrói a chave determinística única por identidade lógica de estado de fase.
   * Utiliza o padrão canônico correspondente à chave do storage:
   * apex_qualifying_stage_state_v2_{careerId}_r{round}_{stage}
   */
  public buildStateKey(context: CanonicalQualifyingStageStateBackendContext): string {
    return `apex_qualifying_stage_state_v2_${context.careerId}_r${context.round}_${context.stage}`
  }

  /**
   * Salva o estado ao vivo de qualificação no PocketBase (upsert pelo stateKey).
   */
  public async saveStageState(
    context: CanonicalQualifyingStageStateBackendContext,
    state: QualifyingStageState,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const stateKey = this.buildStateKey(context)
    const existingInFlight = this.inFlightSaves.get(stateKey)
    if (existingInFlight) {
      return existingInFlight
    }

    const savePromise = this.executeSave(stateKey, context, state).finally(() => {
      this.inFlightSaves.delete(stateKey)
    })

    this.inFlightSaves.set(stateKey, savePromise)
    return savePromise
  }

  /**
   * Lê o estado ao vivo de qualificação do PocketBase pela identidade canônica.
   * Retorna QualifyingStageState existente ou null se não encontrado.
   * Lança exceção em caso de erro de conexão/backend para permitir distinção explícita
   * entre NOT_FOUND e BACKEND_ERROR pelo chamador.
   */
  public async readStageState(
    context: CanonicalQualifyingStageStateBackendContext,
  ): Promise<QualifyingStageState | null> {
    if (!pb?.collection) return null

    const stateKey = this.buildStateKey(context)
    const collection = pb.collection('canonical_qualifying_stage_states')

    // 1. Tentar por ID cacheado em memória se houver
    const cachedId = this.recordIdCache.get(stateKey)
    if (cachedId) {
      try {
        const rec = await collection.getOne<CanonicalQualifyingStageStateBackendRecord>(cachedId)
        if (rec && rec.payload) {
          return rec.payload
        }
      } catch (err: any) {
        this.recordIdCache.delete(stateKey)
        if (err?.status && err.status !== 404) {
          throw err
        }
      }
    }

    // 2. Buscar por getFirstListItem com state_key
    try {
      const safeKey = stateKey.replace(/"/g, '\\"')
      const rec = await collection.getFirstListItem<CanonicalQualifyingStageStateBackendRecord>(
        `state_key = "${safeKey}"`,
      )
      if (rec?.id) {
        this.recordIdCache.set(stateKey, rec.id)
      }
      return rec?.payload || null
    } catch (err: any) {
      if (err?.status === 404 || err?.message?.includes('autocancelled')) {
        return null
      }
      throw err
    }
  }

  private async executeSave(
    stateKey: string,
    context: CanonicalQualifyingStageStateBackendContext,
    state: QualifyingStageState,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      if (!pb?.collection) {
        return { success: false, error: 'PocketBase client indisponível' }
      }

      const collection = pb.collection('canonical_qualifying_stage_states')

      const pbPayload = {
        state_key: stateKey,
        career_id: context.careerId,
        season: context.season,
        round: context.round,
        stage: context.stage,
        payload: state,
      }

      // 1. Verificar se temos o ID em cache
      let existingId = this.recordIdCache.get(stateKey)

      if (!existingId) {
        try {
          const safeKey = stateKey.replace(/"/g, '\\"')
          const existingRecord =
            await collection.getFirstListItem<CanonicalQualifyingStageStateBackendRecord>(
              `state_key = "${safeKey}"`,
            )
          if (existingRecord?.id) {
            existingId = existingRecord.id
            this.recordIdCache.set(stateKey, existingId)
          }
        } catch {
          // Registro não existe ainda
        }
      }

      // 2. Se já existe registro, atualiza (update)
      if (existingId) {
        try {
          const updated = await collection.update<CanonicalQualifyingStageStateBackendRecord>(
            existingId,
            pbPayload,
          )
          if (updated?.id) {
            this.recordIdCache.set(stateKey, updated.id)
            return { success: true, id: updated.id }
          }
          return { success: true, id: existingId }
        } catch (updateErr: any) {
          this.recordIdCache.delete(stateKey)
          console.warn(
            `[CanonicalQualifyingStageStateBackendService] Falha ao atualizar (${existingId}), tentando re-criar:`,
            updateErr?.message || updateErr,
          )
        }
      }

      // 3. Se não existe ou update falhou, tenta criar (create)
      try {
        const created =
          await collection.create<CanonicalQualifyingStageStateBackendRecord>(pbPayload)
        if (created?.id) {
          this.recordIdCache.set(stateKey, created.id)
          return { success: true, id: created.id }
        }
        return { success: true }
      } catch (createErr: any) {
        const isUniqueError =
          createErr?.status === 400 &&
          (createErr?.response?.data?.state_key?.code === 'validation_not_unique' ||
            createErr?.data?.state_key?.code === 'validation_not_unique' ||
            createErr?.message?.includes('validation_not_unique') ||
            createErr?.message?.includes('Value must be unique'))

        if (isUniqueError) {
          try {
            const safeKey = stateKey.replace(/"/g, '\\"')
            const existingRecord =
              await collection.getFirstListItem<CanonicalQualifyingStageStateBackendRecord>(
                `state_key = "${safeKey}"`,
              )
            if (existingRecord?.id) {
              this.recordIdCache.set(stateKey, existingRecord.id)
              const updated = await collection.update<CanonicalQualifyingStageStateBackendRecord>(
                existingRecord.id,
                pbPayload,
              )
              return { success: true, id: updated?.id || existingRecord.id }
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
          error: createErr?.message || 'Falha ao persistir estado de qualificação no PocketBase',
        }
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erro inesperado ao salvar estado de qualificação no PocketBase',
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

export const canonicalQualifyingStageStateBackendService =
  new CanonicalQualifyingStageStateBackendService()
export default canonicalQualifyingStageStateBackendService
