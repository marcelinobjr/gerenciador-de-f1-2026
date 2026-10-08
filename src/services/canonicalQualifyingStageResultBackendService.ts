/**
 * canonicalQualifyingStageResultBackendService.ts
 *
 * Adaptador PocketBase para Qualifying StageResult Canônico (Q1, Q2, Q3, SQ1, SQ2, SQ3).
 *
 * Objetivo:
 * Persistir e recuperar o resultado oficial homologado de fases de qualificação
 * no PocketBase Skip Cloud por identidade canônica:
 * career_id + season + round + stage (q1, q2, q3, sq1, sq2, sq3).
 *
 * Princípios e Contratos:
 * 1. Não toca no localStorage diretamente; não altera nem recalcula o payload recebido.
 * 2. Isolamento estrito por resultKey determinística:
 *    apex_qualifying_stage_result_v2_{careerId}_r{round}_{stage}
 *    ou quali_stage_{careerId}_s{season}_r{round}_{stage}
 * 3. Upsert resiliente com controle de in-flight e cache em memória de record ID.
 * 4. readStageResultBackend retorna QualifyingStageResult existente ou null se inexistente.
 *    Distingue NOT_FOUND (null) de BACKEND_ERROR (lançado ou envelopado).
 */

import pb from '@/lib/pocketbase/client'
import type { QualifyingStageId, QualifyingStageResult } from '@/types/canonical-qualifying-types'

export interface CanonicalQualifyingStageResultBackendContext {
  careerId: string
  season: number
  round: number
  stage: QualifyingStageId
}

export interface CanonicalQualifyingStageResultBackendRecord {
  id: string
  result_key: string
  career_id: string
  season: number
  round: number
  stage: QualifyingStageId
  payload: QualifyingStageResult
  created: string
  updated: string
}

export class CanonicalQualifyingStageResultBackendService {
  private inFlightSaves = new Map<
    string,
    Promise<{ success: boolean; id?: string; error?: string }>
  >()
  private recordIdCache = new Map<string, string>()

  /**
   * Constrói a chave determinística única por identidade lógica de resultado de fase.
   * Utiliza o padrão canônico correspondente à chave do storage:
   * apex_qualifying_stage_result_v2_{careerId}_r{round}_{stage}
   */
  public buildResultKey(context: CanonicalQualifyingStageResultBackendContext): string {
    return `apex_qualifying_stage_result_v2_${context.careerId}_r${context.round}_${context.stage}`
  }

  /**
   * Salva o resultado oficial de qualificação no PocketBase (upsert pelo resultKey).
   * Não altera classificação, tempos ou advancingDriverIds.
   */
  public async saveStageResult(
    context: CanonicalQualifyingStageResultBackendContext,
    result: QualifyingStageResult,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const resultKey = this.buildResultKey(context)
    const existingInFlight = this.inFlightSaves.get(resultKey)
    if (existingInFlight) {
      return existingInFlight
    }

    const savePromise = this.executeSave(resultKey, context, result).finally(() => {
      this.inFlightSaves.delete(resultKey)
    })

    this.inFlightSaves.set(resultKey, savePromise)
    return savePromise
  }

  /**
   * Lê o resultado oficial de qualificação do PocketBase pela identidade canônica.
   * Retorna QualifyingStageResult existente ou null se não encontrado.
   * Lança exceção em caso de erro de conexão/backend para permitir distinção explícita
   * entre NOT_FOUND e BACKEND_ERROR pelo chamador.
   */
  public async readStageResult(
    context: CanonicalQualifyingStageResultBackendContext,
  ): Promise<QualifyingStageResult | null> {
    if (!pb?.collection) return null

    const resultKey = this.buildResultKey(context)
    const collection = pb.collection('canonical_qualifying_stage_results')

    // 1. Tentar por ID cacheado em memória se houver
    const cachedId = this.recordIdCache.get(resultKey)
    if (cachedId) {
      try {
        const rec = await collection.getOne<CanonicalQualifyingStageResultBackendRecord>(cachedId)
        if (rec && rec.payload) {
          return rec.payload
        }
      } catch (err: any) {
        this.recordIdCache.delete(resultKey)
        // Se for 404, cai para a busca por chave; se for erro severo, deixa prosseguir para query
        if (err?.status && err.status !== 404) {
          throw err
        }
      }
    }

    // 2. Buscar por getFirstListItem com result_key
    try {
      const safeKey = resultKey.replace(/"/g, '\\"')
      const rec = await collection.getFirstListItem<CanonicalQualifyingStageResultBackendRecord>(
        `result_key = "${safeKey}"`,
      )
      if (rec?.id) {
        this.recordIdCache.set(resultKey, rec.id)
      }
      return rec?.payload || null
    } catch (err: any) {
      if (err?.status === 404 || err?.message?.includes('autocancelled')) {
        return null
      }
      // Re-lança para que o chamador observe explicitamente o backend error
      throw err
    }
  }

  private async executeSave(
    resultKey: string,
    context: CanonicalQualifyingStageResultBackendContext,
    result: QualifyingStageResult,
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      if (!pb?.collection) {
        return { success: false, error: 'PocketBase client indisponível' }
      }

      const collection = pb.collection('canonical_qualifying_stage_results')

      const pbPayload = {
        result_key: resultKey,
        career_id: context.careerId,
        season: context.season,
        round: context.round,
        stage: context.stage,
        payload: result,
      }

      // 1. Verificar se temos o ID em cache
      let existingId = this.recordIdCache.get(resultKey)

      if (!existingId) {
        try {
          const safeKey = resultKey.replace(/"/g, '\\"')
          const existingRecord =
            await collection.getFirstListItem<CanonicalQualifyingStageResultBackendRecord>(
              `result_key = "${safeKey}"`,
            )
          if (existingRecord?.id) {
            existingId = existingRecord.id
            this.recordIdCache.set(resultKey, existingId)
          }
        } catch {
          // Registro não existe ainda
        }
      }

      // 2. Se já existe registro, atualiza (update)
      if (existingId) {
        try {
          const updated = await collection.update<CanonicalQualifyingStageResultBackendRecord>(
            existingId,
            pbPayload,
          )
          if (updated?.id) {
            this.recordIdCache.set(resultKey, updated.id)
            return { success: true, id: updated.id }
          }
          return { success: true, id: existingId }
        } catch (updateErr: any) {
          this.recordIdCache.delete(resultKey)
          console.warn(
            `[CanonicalQualifyingStageResultBackendService] Falha ao atualizar (${existingId}), tentando re-criar:`,
            updateErr?.message || updateErr,
          )
        }
      }

      // 3. Se não existe ou update falhou, tenta criar (create)
      try {
        const created =
          await collection.create<CanonicalQualifyingStageResultBackendRecord>(pbPayload)
        if (created?.id) {
          this.recordIdCache.set(resultKey, created.id)
          return { success: true, id: created.id }
        }
        return { success: true }
      } catch (createErr: any) {
        // 4. Tratar concorrência onde create falha por unicidade (validation_not_unique)
        const isUniqueError =
          createErr?.status === 400 &&
          (createErr?.response?.data?.result_key?.code === 'validation_not_unique' ||
            createErr?.data?.result_key?.code === 'validation_not_unique' ||
            createErr?.message?.includes('validation_not_unique') ||
            createErr?.message?.includes('Value must be unique'))

        if (isUniqueError) {
          try {
            const safeKey = resultKey.replace(/"/g, '\\"')
            const existingRecord =
              await collection.getFirstListItem<CanonicalQualifyingStageResultBackendRecord>(
                `result_key = "${safeKey}"`,
              )
            if (existingRecord?.id) {
              this.recordIdCache.set(resultKey, existingRecord.id)
              const updated = await collection.update<CanonicalQualifyingStageResultBackendRecord>(
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
          error: createErr?.message || 'Falha ao persistir resultado de qualificação no PocketBase',
        }
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erro inesperado ao salvar resultado de qualificação no PocketBase',
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

export const canonicalQualifyingStageResultBackendService =
  new CanonicalQualifyingStageResultBackendService()
export default canonicalQualifyingStageResultBackendService
