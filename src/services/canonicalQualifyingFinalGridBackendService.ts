/**
 * canonicalQualifyingFinalGridBackendService.ts
 *
 * Adaptador PocketBase para Grid Final Combinado Canônico (P1–P24).
 *
 * Objetivo:
 * Persistir e recuperar o resultado final oficial da qualificação
 * no PocketBase Skip Cloud por identidade canônica:
 * career_id + season + round.
 *
 * Princípios e Contratos:
 * 1. Não toca no localStorage diretamente; não altera nem recalcula o payload recebido.
 * 2. Isolamento estrito por gridKey determinística:
 *    apex_qualifying_final_grid_v2_{careerId}_r{round}
 * 3. Upsert resiliente com controle de in-flight e cache em memória de record ID.
 * 4. readFinalGridBackend retorna CompleteQualifyingWeekendResult existente ou null se inexistente.
 *    Distingue NOT_FOUND (null) de BACKEND_ERROR (lançado ou envelopado).
 */

import pb from '@/lib/pocketbase/client'
import type { CompleteQualifyingWeekendResult } from '@/types/canonical-qualifying-types'

export interface CanonicalQualifyingFinalGridBackendContext {
  careerId: string
  season: number
  round: number
}

export interface CanonicalQualifyingFinalGridBackendRecord {
  id: string
  grid_key: string
  career_id: string
  season: number
  round: number
  payload: CompleteQualifyingWeekendResult
  created: string
  updated: string
}

export class CanonicalQualifyingFinalGridBackendService {
  private inFlightSaves = new Map<
    string,
    Promise<{ success: boolean; id?: string; error?: string }>
  >()
  private recordIdCache = new Map<string, string>()

  /**
   * Constrói a chave determinística única por identidade lógica de grid final.
   * Utiliza o padrão canônico correspondente à chave do storage:
   * apex_qualifying_final_grid_v2_{careerId}_r{round}
   */
  public buildGridKey(context: CanonicalQualifyingFinalGridBackendContext): string {
    return `apex_qualifying_final_grid_v2_${context.careerId}_r${context.round}`
  }

  /**
   * Salva o grid final oficial de qualificação no PocketBase (upsert pelo gridKey).
   * Não altera posições, tempos ou pilotos.
   */
  public async saveFinalGrid(
    context: CanonicalQualifyingFinalGridBackendContext,
    result: CompleteQualifyingWeekendResult,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const gridKey = this.buildGridKey(context)
    const existingInFlight = this.inFlightSaves.get(gridKey)
    if (existingInFlight) {
      return existingInFlight
    }

    const savePromise = this.executeSave(gridKey, context, result).finally(() => {
      this.inFlightSaves.delete(gridKey)
    })

    this.inFlightSaves.set(gridKey, savePromise)
    return savePromise
  }

  /**
   * Lê o grid final oficial de qualificação do PocketBase pela identidade canônica.
   * Retorna CompleteQualifyingWeekendResult existente ou null se não encontrado.
   * Lança exceção em caso de erro de conexão/backend para permitir distinção explícita
   * entre NOT_FOUND e BACKEND_ERROR pelo chamador.
   */
  public async readFinalGrid(
    context: CanonicalQualifyingFinalGridBackendContext,
  ): Promise<CompleteQualifyingWeekendResult | null> {
    if (!pb?.collection) return null

    const gridKey = this.buildGridKey(context)
    const collection = pb.collection('canonical_qualifying_final_grids')

    // 1. Tentar por ID cacheado em memória se houver
    const cachedId = this.recordIdCache.get(gridKey)
    if (cachedId) {
      try {
        const rec = await collection.getOne<CanonicalQualifyingFinalGridBackendRecord>(cachedId)
        if (rec && rec.payload) {
          return rec.payload
        }
      } catch (err: any) {
        this.recordIdCache.delete(gridKey)
        if (err?.status && err.status !== 404) {
          throw err
        }
      }
    }

    // 2. Buscar por getFirstListItem com grid_key
    try {
      const safeKey = gridKey.replace(/"/g, '\\"')
      const rec = await collection.getFirstListItem<CanonicalQualifyingFinalGridBackendRecord>(
        `grid_key = "${safeKey}"`,
      )
      if (rec?.id) {
        this.recordIdCache.set(gridKey, rec.id)
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
    gridKey: string,
    context: CanonicalQualifyingFinalGridBackendContext,
    result: CompleteQualifyingWeekendResult,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      if (!pb?.collection) {
        return { success: false, error: 'PocketBase client indisponível' }
      }

      const collection = pb.collection('canonical_qualifying_final_grids')

      const pbPayload = {
        grid_key: gridKey,
        career_id: context.careerId,
        season: context.season,
        round: context.round,
        payload: result,
      }

      // 1. Verificar se temos o ID em cache
      let existingId = this.recordIdCache.get(gridKey)

      if (!existingId) {
        try {
          const safeKey = gridKey.replace(/"/g, '\\"')
          const existingRecord =
            await collection.getFirstListItem<CanonicalQualifyingFinalGridBackendRecord>(
              `grid_key = "${safeKey}"`,
            )
          if (existingRecord?.id) {
            existingId = existingRecord.id
            this.recordIdCache.set(gridKey, existingId)
          }
        } catch {
          // Registro não existe ainda
        }
      }

      // 2. Se já existe registro, atualiza (update)
      if (existingId) {
        try {
          const updated = await collection.update<CanonicalQualifyingFinalGridBackendRecord>(
            existingId,
            pbPayload,
          )
          if (updated?.id) {
            this.recordIdCache.set(gridKey, updated.id)
            return { success: true, id: updated.id }
          }
          return { success: true, id: existingId }
        } catch (updateErr: any) {
          this.recordIdCache.delete(gridKey)
          console.warn(
            `[CanonicalQualifyingFinalGridBackendService] Falha ao atualizar (${existingId}), tentando re-criar:`,
            updateErr?.message || updateErr,
          )
        }
      }

      // 3. Se não existe ou update falhou, tenta criar (create)
      try {
        const created =
          await collection.create<CanonicalQualifyingFinalGridBackendRecord>(pbPayload)
        if (created?.id) {
          this.recordIdCache.set(gridKey, created.id)
          return { success: true, id: created.id }
        }
        return { success: true }
      } catch (createErr: any) {
        // 4. Tratar concorrência onde create falha por unicidade (validation_not_unique)
        const isUniqueError =
          createErr?.status === 400 &&
          (createErr?.response?.data?.grid_key?.code === 'validation_not_unique' ||
            createErr?.data?.grid_key?.code === 'validation_not_unique' ||
            createErr?.message?.includes('validation_not_unique') ||
            createErr?.message?.includes('Value must be unique'))

        if (isUniqueError) {
          try {
            const safeKey = gridKey.replace(/"/g, '\\"')
            const existingRecord =
              await collection.getFirstListItem<CanonicalQualifyingFinalGridBackendRecord>(
                `grid_key = "${safeKey}"`,
              )
            if (existingRecord?.id) {
              this.recordIdCache.set(gridKey, existingRecord.id)
              const updated = await collection.update<CanonicalQualifyingFinalGridBackendRecord>(
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
          error:
            createErr?.message || 'Falha ao persistir grid final de qualificação no PocketBase',
        }
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erro inesperado ao salvar grid final de qualificação no PocketBase',
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

export const canonicalQualifyingFinalGridBackendService =
  new CanonicalQualifyingFinalGridBackendService()
export default canonicalQualifyingFinalGridBackendService
