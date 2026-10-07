/**
 * canonicalWeekendTyreBackendService.ts
 *
 * STORAGE-QUOTA-01B2-A — Adaptador PocketBase para Inventário Canônico de Pneus
 *
 * Objetivo:
 * Persistir e recuperar o inventário canônico de pneus do fim de semana
 * no PocketBase Skip Cloud pela identidade canônica:
 * career_id + season + round (+ opcional driver_id para granularidade individual).
 *
 * Princípios e Contratos:
 * 1. Não toca no fluxo vivo (leitura, escrita ou recordTyreUsage continuam locais).
 * 2. Não altera nem recalcula o payload recebido (preserva tyreSetId, wear, lapsUsed,
 *    condition, status, compound, etc.).
 * 3. Isolamento estrito por inventoryKey determinística:
 *    - Se driverId for fornecido: tyre_inv_{careerId}_s{season}_r{round}_drv_{driverId}
 *    - Se driverId não for fornecido: tyre_inv_{careerId}_s{season}_r{round}_all
 *    Carreiras, temporadas, rodadas e pilotos não colidem.
 * 4. Upsert idempotente e atômico com controle in-flight e cache em memória de record ID.
 * 5. readInventory retorna payload tipado ou null explicitamente se inexistente.
 *    Não cria nem inicializa inventário novo.
 */

import pb from '@/lib/pocketbase/client'
import type { StoredWeekendTireData } from '@/services/canonicalWeekendTyrePersistence'
import type { TireSetItem } from '@/types/f1'

export interface CanonicalWeekendTyreBackendContext {
  careerId: string
  season: number
  round: number
  driverId?: string
}

export type CanonicalWeekendTyrePayload = StoredWeekendTireData | TireSetItem[]

export interface CanonicalWeekendTyreBackendRecord<T = CanonicalWeekendTyrePayload> {
  id: string
  inventory_key: string
  career_id: string
  season: number
  round: number
  driver_id?: string
  payload: T
  created: string
  updated: string
}

export class CanonicalWeekendTyreBackendService {
  private inFlightSaves = new Map<
    string,
    Promise<{ success: boolean; id?: string; error?: string }>
  >()
  private recordIdCache = new Map<string, string>()

  /**
   * Constrói a chave determinística única por identidade lógica de inventário.
   */
  public buildInventoryKey(context: CanonicalWeekendTyreBackendContext): string {
    const driverSegment = context.driverId ? `_drv_${context.driverId}` : '_all'
    return `tyre_inv_${context.careerId}_s${context.season}_r${context.round}${driverSegment}`
  }

  /**
   * Salva o inventário canônico de pneus no PocketBase (upsert pelo inventoryKey).
   * Não recalcula wear/lapsUsed e preserva integralmente o payload recebido.
   */
  public async saveInventory<T extends CanonicalWeekendTyrePayload = CanonicalWeekendTyrePayload>(
    context: CanonicalWeekendTyreBackendContext,
    payload: T,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const inventoryKey = this.buildInventoryKey(context)
    const existingInFlight = this.inFlightSaves.get(inventoryKey)
    if (existingInFlight) {
      return existingInFlight
    }

    const savePromise = this.executeSave(inventoryKey, context, payload).finally(() => {
      this.inFlightSaves.delete(inventoryKey)
    })

    this.inFlightSaves.set(inventoryKey, savePromise)
    return savePromise
  }

  /**
   * Lê o inventário canônico de pneus do PocketBase pela identidade.
   * Retorna o payload tipado existente ou null se inexistente.
   * Não cria inventário novo.
   */
  public async readInventory<T extends CanonicalWeekendTyrePayload = CanonicalWeekendTyrePayload>(
    context: CanonicalWeekendTyreBackendContext,
  ): Promise<T | null> {
    try {
      if (!pb?.collection) return null

      const inventoryKey = this.buildInventoryKey(context)
      const collection = pb.collection('canonical_weekend_tyres')

      // 1. Tentar por ID cacheado em memória se houver
      const cachedId = this.recordIdCache.get(inventoryKey)
      if (cachedId) {
        try {
          const rec = await collection.getOne<CanonicalWeekendTyreBackendRecord<T>>(cachedId)
          if (rec && rec.payload) {
            return rec.payload
          }
        } catch {
          this.recordIdCache.delete(inventoryKey)
        }
      }

      // 2. Buscar por getFirstListItem com inventory_key
      try {
        const safeKey = inventoryKey.replace(/"/g, '\\"')
        const rec = await collection.getFirstListItem<CanonicalWeekendTyreBackendRecord<T>>(
          `inventory_key = "${safeKey}"`,
        )
        if (rec?.id) {
          this.recordIdCache.set(inventoryKey, rec.id)
        }
        return rec?.payload ?? null
      } catch {
        // Not found
        return null
      }
    } catch {
      return null
    }
  }

  private async executeSave<T extends CanonicalWeekendTyrePayload>(
    inventoryKey: string,
    context: CanonicalWeekendTyreBackendContext,
    payload: T,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      if (!pb?.collection) {
        return { success: false, error: 'PocketBase client indisponível' }
      }

      const collection = pb.collection('canonical_weekend_tyres')

      const pbPayload = {
        inventory_key: inventoryKey,
        career_id: context.careerId,
        season: context.season,
        round: context.round,
        driver_id: context.driverId || '',
        payload,
      }

      // 1. Verificar se temos o ID em cache
      let existingId = this.recordIdCache.get(inventoryKey)

      if (!existingId) {
        try {
          const safeKey = inventoryKey.replace(/"/g, '\\"')
          const existingRecord = await collection.getFirstListItem<
            CanonicalWeekendTyreBackendRecord<T>
          >(`inventory_key = "${safeKey}"`)
          if (existingRecord?.id) {
            existingId = existingRecord.id
            this.recordIdCache.set(inventoryKey, existingId)
          }
        } catch {
          // Registro não existe ainda
        }
      }

      // 2. Se já existe registro, atualiza (update)
      if (existingId) {
        try {
          const updated = await collection.update<CanonicalWeekendTyreBackendRecord<T>>(
            existingId,
            pbPayload,
          )
          if (updated?.id) {
            this.recordIdCache.set(inventoryKey, updated.id)
            return { success: true, id: updated.id }
          }
          return { success: true, id: existingId }
        } catch (updateErr: any) {
          this.recordIdCache.delete(inventoryKey)
          console.warn(
            `[CanonicalWeekendTyreBackendService] Falha ao atualizar inventário (${existingId}), tentando re-criar:`,
            updateErr?.message || updateErr,
          )
        }
      }

      // 3. Se não existe ou update falhou, tenta criar (create)
      try {
        const created = await collection.create<CanonicalWeekendTyreBackendRecord<T>>(pbPayload)
        if (created?.id) {
          this.recordIdCache.set(inventoryKey, created.id)
          return { success: true, id: created.id }
        }
        return { success: true }
      } catch (createErr: any) {
        // 4. Tratar concorrência onde create falha por unicidade (validation_not_unique)
        const isUniqueError =
          createErr?.status === 400 &&
          (createErr?.response?.data?.inventory_key?.code === 'validation_not_unique' ||
            createErr?.data?.inventory_key?.code === 'validation_not_unique' ||
            createErr?.message?.includes('validation_not_unique') ||
            createErr?.message?.includes('Value must be unique'))

        if (isUniqueError) {
          try {
            const safeKey = inventoryKey.replace(/"/g, '\\"')
            const invRecord = await collection.getFirstListItem<
              CanonicalWeekendTyreBackendRecord<T>
            >(`inventory_key = "${safeKey}"`)
            if (invRecord?.id) {
              this.recordIdCache.set(inventoryKey, invRecord.id)
              const updated = await collection.update<CanonicalWeekendTyreBackendRecord<T>>(
                invRecord.id,
                pbPayload,
              )
              return { success: true, id: updated?.id || invRecord.id }
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
          error: createErr?.message || 'Falha ao persistir inventário de pneus no PocketBase',
        }
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erro inesperado ao salvar inventário de pneus no PocketBase',
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

export const canonicalWeekendTyreBackendService = new CanonicalWeekendTyreBackendService()
export default canonicalWeekendTyreBackendService
