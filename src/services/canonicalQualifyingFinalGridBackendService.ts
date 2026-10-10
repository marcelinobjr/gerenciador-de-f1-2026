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
        // Tentar recuperação sob demanda a partir dos resultados canônicos se disponíveis no PB
        const recovered = await this.recoverFinalGridFromStageResults(context)
        if (recovered) {
          return recovered
        }
        return null
      }
      throw err
    }
  }

  /**
   * GRID-R2-RECOVER-01A:
   * Reconstrói e auto-persiste o grid final oficial a partir dos resultados canônicos das sessões (SQ1/SQ2/SQ3 ou Q1/Q2/Q3).
   * P1–P10: Top 10 da SQ3/Q3
   * P11–P18: Eliminados da SQ2/Q2 (posições 11–18)
   * P19–P24: Eliminados da SQ1/Q1 (posições 19–24)
   * Lê do PocketBase os canonical_qualifying_stage_results sem alterar desempates ou tempos.
   */
  public async recoverFinalGridFromStageResults(
    context: CanonicalQualifyingFinalGridBackendContext,
  ): Promise<CompleteQualifyingWeekendResult | null> {
    try {
      if (!pb?.collection) return null
      const stageCol = pb.collection('canonical_qualifying_stage_results')

      const stagesSprint = ['sq1', 'sq2', 'sq3']
      const stagesStandard = ['q1', 'q2', 'q3']

      // Buscar SQ3 primeiro para verificar se é rodada sprint
      let isSprint = true
      let stage3Record: any = null

      try {
        stage3Record = await stageCol.getFirstListItem(
          `career_id = "${context.careerId}" && round = ${context.round} && stage = "sq3"`,
        )
      } catch {
        // Se SQ3 não existe, tentar Q3 padrão
        try {
          stage3Record = await stageCol.getFirstListItem(
            `career_id = "${context.careerId}" && round = ${context.round} && stage = "q3"`,
          )
          isSprint = false
        } catch {
          return null
        }
      }

      if (!stage3Record) return null

      const stagesToFetch = isSprint ? stagesSprint : stagesStandard

      const stage1Record = await stageCol
        .getFirstListItem(
          `career_id = "${context.careerId}" && round = ${context.round} && stage = "${stagesToFetch[0]}"`,
        )
        .catch(() => null)

      const stage2Record = await stageCol
        .getFirstListItem(
          `career_id = "${context.careerId}" && round = ${context.round} && stage = "${stagesToFetch[1]}"`,
        )
        .catch(() => null)

      if (!stage1Record || !stage2Record || !stage3Record) {
        return null
      }

      const parsePayload = (rec: any): any => {
        let p = rec.payload
        if (typeof p === 'string') {
          try {
            p = JSON.parse(p)
          } catch {
            return null
          }
        }
        return p
      }

      const p1 = parsePayload(stage1Record)
      const p2 = parsePayload(stage2Record)
      const p3 = parsePayload(stage3Record)

      if (!p1 || !p2 || !p3) return null

      // Obter listas de classificação de cada estágio
      const getList = (payload: any): any[] => {
        if (Array.isArray(payload.classification)) return payload.classification
        if (Array.isArray(payload.results)) return payload.results
        if (Array.isArray(payload.drivers)) return payload.drivers
        return []
      }

      const list1 = getList(p1)
      const list2 = getList(p2)
      const list3 = getList(p3)

      if (list1.length < 18 || list2.length < 10 || list3.length < 10) {
        return null
      }

      // P1–P10: SQ3 / Q3
      const top10 = list3.slice(0, 10).map((entry: any, idx: number) => ({
        driverId: entry.driverId || entry.id,
        driverName: entry.driverName || entry.name,
        teamId: entry.teamId || entry.team,
        teamName: entry.teamName || '',
        gridPosition: idx + 1,
        bestLapTime: entry.bestLapTime || entry.time || null,
        bestLapSec: typeof entry.bestLapSec === 'number' ? entry.bestLapSec : null,
        bestLapCompound: entry.bestLapCompound || entry.tyreCompound || 'macio',
        tyreCompound: entry.tyreCompound || entry.bestLapCompound || 'macio',
        gapToPoleSec:
          typeof entry.gapToPoleSec === 'number' ? entry.gapToPoleSec : idx === 0 ? 0 : null,
        eliminationStage: null,
        isPlayer: Boolean(entry.isPlayer),
        carId: entry.carId || undefined,
      }))

      // P11–P18: Eliminados SQ2 / Q2 (índices 10 a 17)
      const p11to18 = list2.slice(10, 18).map((entry: any, idx: number) => ({
        driverId: entry.driverId || entry.id,
        driverName: entry.driverName || entry.name,
        teamId: entry.teamId || entry.team,
        teamName: entry.teamName || '',
        gridPosition: 11 + idx,
        bestLapTime: entry.bestLapTime || entry.time || null,
        bestLapSec: typeof entry.bestLapSec === 'number' ? entry.bestLapSec : null,
        bestLapCompound: entry.bestLapCompound || entry.tyreCompound || 'macio',
        tyreCompound: entry.tyreCompound || entry.bestLapCompound || 'macio',
        gapToPoleSec: typeof entry.gapToPoleSec === 'number' ? entry.gapToPoleSec : null,
        eliminationStage: isSprint ? 'sq2' : 'q2',
        isPlayer: Boolean(entry.isPlayer),
        carId: entry.carId || undefined,
      }))

      // P19–P24: Eliminados SQ1 / Q1 (índices 18 a 23)
      const p19to24 = list1.slice(18, 24).map((entry: any, idx: number) => ({
        driverId: entry.driverId || entry.id,
        driverName: entry.driverName || entry.name,
        teamId: entry.teamId || entry.team,
        teamName: entry.teamName || '',
        gridPosition: 19 + idx,
        bestLapTime: entry.bestLapTime || entry.time || null,
        bestLapSec: typeof entry.bestLapSec === 'number' ? entry.bestLapSec : null,
        bestLapCompound: entry.bestLapCompound || entry.tyreCompound || 'macio',
        tyreCompound: entry.tyreCompound || entry.bestLapCompound || 'macio',
        gapToPoleSec: typeof entry.gapToPoleSec === 'number' ? entry.gapToPoleSec : null,
        eliminationStage: isSprint ? 'sq1' : 'q1',
        isPlayer: Boolean(entry.isPlayer),
        carId: entry.carId || undefined,
      }))

      const finalGrid = [...top10, ...p11to18, ...p19to24]

      if (finalGrid.length !== 24) {
        return null
      }

      const poleEntry = finalGrid[0]
      const seasonNum = Number(stage3Record.season) || context.season || 3109528

      const reconstructedResult: CompleteQualifyingWeekendResult = {
        seasonId: context.careerId,
        round: context.round,
        completedAt: p3.completedAt || new Date().toISOString(),
        poleDriverId: poleEntry.driverId,
        poleTime: poleEntry.bestLapTime || undefined,
        poleSec: poleEntry.bestLapSec || undefined,
        finalGrid: finalGrid as any,
        stageResults: {
          q1: p1,
          q2: p2,
          q3: p3,
        } as any,
      }

      // Persistir em canonical_qualifying_final_grids no PocketBase de forma assíncrona/segura
      await this.saveFinalGrid(context, reconstructedResult).catch((err) => {
        console.warn(
          '[CanonicalQualifyingFinalGridBackendService] Falha ao persistir grid recuperado:',
          err,
        )
      })

      return reconstructedResult
    } catch (recoverErr) {
      console.warn(
        '[CanonicalQualifyingFinalGridBackendService] Erro na recuperação do grid canônico:',
        recoverErr,
      )
      return null
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
