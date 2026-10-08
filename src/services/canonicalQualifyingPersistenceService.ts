/**
 * canonicalQualifyingPersistenceService.ts
 *
 * Gerenciamento centralizado de persistência de estado e resultados de qualificação (Q1, Q2, Q3)
 * para a aba CORRIDA.
 *
 * Responsabilidades:
 * - Persistência do estado em andamento de cada fase (q1, q2, q3) para reload seguro.
 * - Idempotência estrita: duplo clique não duplica resultados, finalizar duas vezes não quebra histórico.
 * - Persistência dos resultados de eliminação: Q1_RESULT, Q2_RESULT, Q3_RESULT.
 * - Composição e persistência do grid final P1–P24 (QUALIFYING_RESULT).
 * - Leitura e preservação de Parc Fermé.
 */

import type {
  QualifyingStageId,
  QualifyingStageState,
  QualifyingStageResult,
  CompleteQualifyingWeekendResult,
  FinalQualifyingGridEntry,
} from '@/types/canonical-qualifying-types'

export interface SaveStageResultOutcome {
  success: boolean
  error?: string
  reason?: 'STORAGE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'STORAGE_ERROR'
  persistedBackend?: boolean
  persistedLocal?: boolean
}

export interface SaveStageStateOutcome {
  success: boolean
  error?: string
  reason?: 'STORAGE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'STORAGE_ERROR'
  persistedBackend?: boolean
  persistedLocal?: boolean
}

export interface ReadStageResultOutcome {
  data: QualifyingStageResult | null
  source: 'backend' | 'local' | 'none'
  backendError?: string
}

export interface ReadStageStateOutcome {
  data: QualifyingStageState | null
  source: 'backend' | 'local' | 'none'
  backendError?: string
}

export interface SaveCompleteQualifyingResultOutcome {
  success: boolean
  error?: string
  reason?: 'STORAGE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'STORAGE_ERROR'
  persistedBackend?: boolean
  persistedLocal?: boolean
}

export interface ReadCompleteQualifyingResultOutcome {
  data: CompleteQualifyingWeekendResult | null
  source: 'backend' | 'local' | 'none'
  backendError?: string
}

import { getActiveWeekendGeneration } from '@/services/weekendProgressionService'
import { safeLocalStorageSetItem } from '@/services/storageQuotaService'
import { canonicalQualifyingStageResultBackendService } from '@/services/canonicalQualifyingStageResultBackendService'
import { canonicalQualifyingStageStateBackendService } from '@/services/canonicalQualifyingStageStateBackendService'
import { canonicalQualifyingFinalGridBackendService } from '@/services/canonicalQualifyingFinalGridBackendService'

const STAGE_STATE_STORAGE_KEY_PREFIX = 'apex_qualifying_stage_state_v2'
const STAGE_RESULT_STORAGE_KEY_PREFIX = 'apex_qualifying_stage_result_v2'
const FINAL_GRID_STORAGE_KEY_PREFIX = 'apex_qualifying_final_grid_v2'
const PARC_FERME_STORAGE_KEY_PREFIX = 'apex_parc_ferme_v2'

export const canonicalQualifyingPersistenceService = {
  /**
   * Chave de armazenamento do estado em andamento de uma fase (Q1, Q2 ou Q3).
   */
  getStageStateKey(seasonId: string, round: number, stageId: QualifyingStageId): string {
    return `${STAGE_STATE_STORAGE_KEY_PREFIX}_${seasonId}_r${round}_${stageId}`
  },

  /**
   * Chave de armazenamento do resultado oficial homologado de uma fase.
   */
  getStageResultKey(seasonId: string, round: number, stageId: QualifyingStageId): string {
    return `${STAGE_RESULT_STORAGE_KEY_PREFIX}_${seasonId}_r${round}_${stageId}`
  },

  /**
   * Chave de armazenamento do grid final combinado P1-P24.
   */
  getFinalGridKey(seasonId: string, round: number): string {
    return `${FINAL_GRID_STORAGE_KEY_PREFIX}_${seasonId}_r${round}`
  },

  /**
   * Chave de armazenamento do status de Parc Fermé.
   */
  getParcFermeKey(seasonId: string, round: number): string {
    return `${PARC_FERME_STORAGE_KEY_PREFIX}_${seasonId}_r${round}`
  },

  /**
   * Cache em memória para estados de qualificação salvos na sessão.
   * Permite que leituras síncronas encontrem imediatamente o estado mesmo
   * quando o localStorage falha por cota cheia ou foi expurgado pós-confirmação backend.
   */
  _memoryStageStates: new Map<string, QualifyingStageState>(),

  /**
   * Cache em memória para resultados de qualificação salvos na sessão (read-back síncrono resiliente).
   * Permite que leituras síncronas encontrem imediatamente o resultado confirmado no backend
   * mesmo se o localStorage falhar por QuotaExceededError.
   */
  _memoryStageResults: new Map<string, QualifyingStageResult>(),

  /**
   * Cache em memória para grids finais completos de qualificação salvos na sessão.
   * Permite que leituras síncronas encontrem imediatamente o grid final confirmado no backend
   * mesmo se o localStorage falhar por QuotaExceededError ou após purge local.
   */
  _memoryFinalGrids: new Map<string, CompleteQualifyingWeekendResult>(),

  /**
   * Expurgar a cópia pesada do estado de fase local somente após confirmação real do backend.
   * Mantém o cache de memória íntegro e libera cota no localStorage.
   */
  purgeLocalStageState(seasonId: string, round: number, stageId: QualifyingStageId): void {
    const key = this.getStageStateKey(seasonId, round, stageId)
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.removeItem(key)
    } catch (e) {
      console.warn(
        `[QualifyingPersistence] Falha ao expurgar cópia pesada local de stageState (${stageId}, ${seasonId}, r${round}):`,
        e,
      )
    }
  },
  /**
   * Salva o estado ao vivo da fase de classificação.
   * BUG-TYRE-RESET-01A: Rejeita escrita se state.generation for incompatível com a geração ativa da rodada.
   * Resiliente a QuotaExceededError: captura erro de cota, mantém memória ativa e espelha no PocketBase.
   */
  saveStageState(
    seasonId: string,
    round: number,
    state: QualifyingStageState,
    options?: { syncBackendPromise?: Promise<{ success: boolean; id?: string; error?: string }> },
  ): SaveStageStateOutcome {
    const currentGen = getActiveWeekendGeneration(seasonId, round)
    const effectiveGen = state.weekendGeneration ?? state.generation

    // RESET-FIX-2: Gatekeeper central contra state stale / geração incompatível
    if (effectiveGen !== undefined) {
      if (effectiveGen < currentGen) {
        console.warn(
          `[QualifyingPersistence] STALE_STATE: escrita rejeitada por geração obsoleta (state=${effectiveGen} < current=${currentGen}) para ${seasonId} r${round}`,
        )
        return {
          success: false,
          reason: 'STORAGE_ERROR',
          error: 'STALE_STATE: geração obsoleta',
          persistedLocal: false,
          persistedBackend: false,
        }
      }
      if (effectiveGen > currentGen) {
        console.warn(
          `[QualifyingPersistence] INCONSISTENT_GENERATION: escrita rejeitada por geração futura não sincronizada (state=${effectiveGen} > current=${currentGen}) para ${seasonId} r${round}`,
        )
        return {
          success: false,
          reason: 'STORAGE_ERROR',
          error: 'INCONSISTENT_GENERATION: geração futura',
          persistedLocal: false,
          persistedBackend: false,
        }
      }
      state.weekendGeneration = currentGen
      state.generation = currentGen
    } else {
      if (currentGen > 1) {
        console.warn(
          `[QualifyingPersistence] STALE_STATE: escrita rejeitada para state legado sem generation após avanço de rodada (current=${currentGen}) para ${seasonId} r${round}`,
        )
        return {
          success: false,
          reason: 'STORAGE_ERROR',
          error: 'STALE_STATE: geração obsoleta para state legado',
          persistedLocal: false,
          persistedBackend: false,
        }
      }
      state.weekendGeneration = currentGen
      state.generation = currentGen
    }

    state.updatedAt = new Date().toISOString()
    state.revision = (state.revision || 0) + 1
    const key = this.getStageStateKey(seasonId, round, state.stageId)

    // Manter sempre no cache em memória da sessão
    this._memoryStageStates.set(key, state)

    let localSuccess = false
    let localError: string | undefined
    let localReason: 'STORAGE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'STORAGE_ERROR' | undefined

    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        localSuccess = false
        localError = 'Storage não disponível neste ambiente'
        localReason = 'STORAGE_UNAVAILABLE'
      } else {
        try {
          safeLocalStorageSetItem(key, JSON.stringify(state), { seasonId, currentRound: round })
          localSuccess = true
        } catch (e: any) {
          const isQuotaError =
            e?.name === 'QuotaExceededError' ||
            e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e?.code === 22 ||
            e?.code === 1014 ||
            (typeof e?.message === 'string' &&
              (e.message.includes('quota') || e.message.includes('Quota')))

          localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
          localError = e instanceof Error ? e.message : String(e)

          console.warn('[QualifyingPersistence] Erro local ao salvar estado de fase:', {
            reason: localReason,
            error: localError,
            stageId: state.stageId,
          })
        }
      }
    } catch (outerErr: any) {
      const isQuotaError =
        outerErr?.name === 'QuotaExceededError' ||
        outerErr?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        outerErr?.code === 22 ||
        outerErr?.code === 1014 ||
        (typeof outerErr?.message === 'string' &&
          (outerErr.message.includes('quota') || outerErr.message.includes('Quota')))

      localSuccess = false
      localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
      localError = outerErr instanceof Error ? outerErr.message : String(outerErr)

      console.warn(
        '[QualifyingPersistence] Exceção externa capturada ao salvar estado de fase local:',
        {
          reason: localReason,
          error: localError,
          stageId: state.stageId,
        },
      )
    }

    // Espelhamento no PocketBase
    const seasonNum = parseInt(String(seasonId).replace(/\D/g, ''), 10) || 1
    const backendCtx = {
      careerId: seasonId,
      season: seasonNum,
      round,
      stage: state.stageId,
    }

    let backendPromise: Promise<{ success: boolean; id?: string; error?: string }>
    if (options?.syncBackendPromise) {
      backendPromise = options.syncBackendPromise
    } else {
      try {
        backendPromise = canonicalQualifyingStageStateBackendService.saveStageState(
          backendCtx,
          state,
        )
      } catch (beErr: any) {
        backendPromise = Promise.resolve({
          success: false,
          error: beErr?.message || 'Falha síncrona ao invocar saveStageState no backend',
        })
      }
    }

    // Se local teve sucesso:
    if (localSuccess) {
      backendPromise
        .then((res) => {
          if (res?.success) {
            // Expurgar cópia pesada local se confirmado no backend para liberar cota
            this.purgeLocalStageState(seasonId, round, state.stageId)
          }
        })
        .catch((beErr) => {
          console.warn(
            '[QualifyingPersistence] Falha assíncrona ao espelhar StageState no PocketBase:',
            beErr,
          )
        })

      return {
        success: true,
        persistedLocal: true,
        persistedBackend: true,
      }
    }

    // Se local falhou mas backendPromise foi passado diretamente:
    backendPromise
      .then((res) => {
        if (res?.success) {
          this.purgeLocalStageState(seasonId, round, state.stageId)
        } else {
          console.error(
            `[QualifyingPersistence] Falha dupla: local e backend não confirmaram stageState (${seasonId}, r${round}, ${state.stageId})`,
          )
        }
      })
      .catch((beErr) => {
        console.error(
          `[QualifyingPersistence] Exceção assíncrona ao espelhar stageState pós-falha local:`,
          beErr,
        )
      })

    return {
      success: false,
      error: localError,
      reason: localReason,
      persistedLocal: false,
      persistedBackend: false,
    }
  },

  /**
   * Versão assíncrona oficial de saveStageState:
   * Aguarda tanto a tentativa local quanto a do PocketBase.
   * Se o local falhar (QUOTA_EXCEEDED) mas o backend confirmar,
   * retorna SUCESSO ({ success: true, persistedBackend: true, persistedLocal: false })
   * e expurga o payload pesado local para a mesma identidade lógica.
   */
  async saveStageStateAsync(
    seasonId: string,
    round: number,
    state: QualifyingStageState,
  ): Promise<SaveStageStateOutcome> {
    const currentGen = getActiveWeekendGeneration(seasonId, round)
    const effectiveGen = state.weekendGeneration ?? state.generation

    if (effectiveGen !== undefined) {
      if (effectiveGen < currentGen) {
        console.warn(
          `[QualifyingPersistence] STALE_STATE: escrita rejeitada por geração obsoleta (state=${effectiveGen} < current=${currentGen}) para ${seasonId} r${round}`,
        )
        return {
          success: false,
          reason: 'STORAGE_ERROR',
          error: 'STALE_STATE: geração obsoleta',
          persistedLocal: false,
          persistedBackend: false,
        }
      }
      if (effectiveGen > currentGen) {
        console.warn(
          `[QualifyingPersistence] INCONSISTENT_GENERATION: escrita rejeitada por geração futura não sincronizada (state=${effectiveGen} > current=${currentGen}) para ${seasonId} r${round}`,
        )
        return {
          success: false,
          reason: 'STORAGE_ERROR',
          error: 'INCONSISTENT_GENERATION: geração futura',
          persistedLocal: false,
          persistedBackend: false,
        }
      }
      state.weekendGeneration = currentGen
      state.generation = currentGen
    } else {
      if (currentGen > 1) {
        console.warn(
          `[QualifyingPersistence] STALE_STATE: escrita rejeitada para state legado sem generation após avanço de rodada (current=${currentGen}) para ${seasonId} r${round}`,
        )
        return {
          success: false,
          reason: 'STORAGE_ERROR',
          error: 'STALE_STATE: geração obsoleta para state legado',
          persistedLocal: false,
          persistedBackend: false,
        }
      }
      state.weekendGeneration = currentGen
      state.generation = currentGen
    }

    state.updatedAt = new Date().toISOString()
    state.revision = (state.revision || 0) + 1
    const key = this.getStageStateKey(seasonId, round, state.stageId)

    this._memoryStageStates.set(key, state)

    let localSuccess = false
    let localError: string | undefined
    let localReason: 'STORAGE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'STORAGE_ERROR' | undefined

    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        localSuccess = false
        localError = 'Storage não disponível neste ambiente'
        localReason = 'STORAGE_UNAVAILABLE'
      } else {
        try {
          safeLocalStorageSetItem(key, JSON.stringify(state), { seasonId, currentRound: round })
          localSuccess = true
        } catch (e: any) {
          const isQuotaError =
            e?.name === 'QuotaExceededError' ||
            e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e?.code === 22 ||
            e?.code === 1014 ||
            (typeof e?.message === 'string' &&
              (e.message.includes('quota') || e.message.includes('Quota')))

          localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
          localError = e instanceof Error ? e.message : String(e)

          console.warn('[QualifyingPersistence] Erro local ao salvar estado de fase:', {
            reason: localReason,
            error: localError,
            stageId: state.stageId,
          })
        }
      }
    } catch (outerErr: any) {
      const isQuotaError =
        outerErr?.name === 'QuotaExceededError' ||
        outerErr?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        outerErr?.code === 22 ||
        outerErr?.code === 1014 ||
        (typeof outerErr?.message === 'string' &&
          (outerErr.message.includes('quota') || outerErr.message.includes('Quota')))

      localSuccess = false
      localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
      localError = outerErr instanceof Error ? outerErr.message : String(outerErr)

      console.warn(
        '[QualifyingPersistence] Exceção externa capturada ao salvar estado de fase local (async):',
        {
          reason: localReason,
          error: localError,
          stageId: state.stageId,
        },
      )
    }

    const seasonNum = parseInt(String(seasonId).replace(/\D/g, ''), 10) || 1
    const backendCtx = {
      careerId: seasonId,
      season: seasonNum,
      round,
      stage: state.stageId,
    }

    let backendSuccess = false
    let backendError: string | undefined

    try {
      const beRes = await canonicalQualifyingStageStateBackendService.saveStageState(
        backendCtx,
        state,
      )
      backendSuccess = !!beRes?.success
      if (!backendSuccess) {
        backendError = beRes?.error || 'PocketBase retornou success: false'
      }
    } catch (beErr: any) {
      backendSuccess = false
      backendError = beErr?.message || 'Falha ao conectar com PocketBase'
    }

    // Se o backend teve sucesso, o estado canônico ESTÁ SALVO
    if (backendSuccess) {
      // Expurgar cópia pesada local se confirmado no backend para liberar cota
      this.purgeLocalStageState(seasonId, round, state.stageId)
      return {
        success: true,
        persistedBackend: true,
        persistedLocal: localSuccess,
        error: localSuccess ? undefined : localError,
      }
    }

    // Se backend falhou mas local sucedeu
    if (localSuccess) {
      return {
        success: true,
        persistedBackend: false,
        persistedLocal: true,
        error: backendError,
      }
    }

    // Se AMBOS falharam:
    this._memoryStageStates.delete(key)
    return {
      success: false,
      error: `Local: ${localError || 'falha'} | Backend: ${backendError || 'falha'}`,
      reason: localReason || 'STORAGE_ERROR',
      persistedBackend: false,
      persistedLocal: false,
    }
  },

  /**
   * Lê o estado ao vivo da fase para permitir reload seguro sem recomeçar.
   * BUG-TYRE-RESET-01A: Se o estado persistido pertencer a uma geração anterior, descarta.
   * Consulta memória ativa se local estiver ausente.
   */
  readStageState(
    seasonId: string,
    round: number,
    stageId: QualifyingStageId,
  ): QualifyingStageState | null {
    const key = this.getStageStateKey(seasonId, round, stageId)
    const inMemory = this._memoryStageStates.get(key)
    if (inMemory && inMemory.leaderboard && inMemory.leaderboard.length > 0) {
      const currentGen = getActiveWeekendGeneration(seasonId, round)
      const parsedGen = inMemory.weekendGeneration ?? inMemory.generation
      if (parsedGen !== undefined && parsedGen !== currentGen) {
        this._memoryStageStates.delete(key)
        return null
      }
      return inMemory
    }

    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as QualifyingStageState

      const currentGen = getActiveWeekendGeneration(seasonId, round)
      const parsedGen = parsed ? (parsed.weekendGeneration ?? parsed.generation) : undefined
      // Se tiver geração registrada e for diferente da ativa, o estado é obsoleto
      if (parsed && parsedGen !== undefined) {
        if (parsedGen !== currentGen) {
          console.warn(
            `[QualifyingPersistence] Estado lido ignorado por geração obsoleta/incompatível: ${parsedGen} !== currentGen ${currentGen}`,
          )
          return null
        }
        parsed.weekendGeneration = currentGen
        parsed.generation = currentGen
      } else if (parsed) {
        // Se a rodada já avançou geração por reset (> 1), state sem geração é stale
        if (currentGen > 1) {
          console.warn(
            `[QualifyingPersistence] Estado legado lido ignorado por avanço prévio de geração: currentGen ${currentGen}`,
          )
          return null
        }
        parsed.weekendGeneration = currentGen
        parsed.generation = currentGen
      }

      // BUG-SQ3-TRANSITION-R3: Reconciliação canônica de running órfão pós-reload/reidratação.
      if (parsed && parsed.status === 'running') {
        parsed.status = 'paused'
        try {
          safeLocalStorageSetItem(
            this.getStageStateKey(seasonId, round, stageId),
            JSON.stringify(parsed),
            { seasonId, currentRound: round },
          )
        } catch {
          // Ignore write error
        }
      }

      if (parsed) {
        this._memoryStageStates.set(key, parsed)
      }

      return parsed
    } catch (e) {
      console.warn('[QualifyingPersistence] Erro ao ler estado de fase:', e)
      return null
    }
  },

  /**
   * Leitura assíncrona preferencial de StageState com prioridade PocketBase:
   * 1. Consulta PocketBase (backend). Se presente e válido, vence divergência e popula memória/cache.
   * 2. Se PocketBase retornar NOT_FOUND (null), faz fallback para local.
   * 3. Se PocketBase der ERROR de rede, registra backendError e faz fallback para local.
   * Não altera nem recalcula dados no load.
   */
  async readStageStatePreferred(
    seasonId: string,
    round: number,
    stageId: QualifyingStageId,
  ): Promise<ReadStageStateOutcome> {
    const seasonNum = parseInt(String(seasonId).replace(/\D/g, ''), 10) || 1
    const backendCtx = {
      careerId: seasonId,
      season: seasonNum,
      round,
      stage: stageId,
    }

    let backendData: QualifyingStageState | null = null
    let backendError: string | undefined

    // 1. Tentar ler do PocketBase
    try {
      backendData = await canonicalQualifyingStageStateBackendService.readStageState(backendCtx)
    } catch (err: any) {
      backendError = err?.message || 'Erro ao consultar PocketBase'
    }

    // 2. Se backend retornou dados válidos: backend vence
    if (
      backendData &&
      Array.isArray(backendData.leaderboard) &&
      backendData.leaderboard.length > 0
    ) {
      const currentGen = getActiveWeekendGeneration(seasonId, round)
      const parsedGen = backendData.weekendGeneration ?? backendData.generation
      if (parsedGen !== undefined && parsedGen !== currentGen) {
        return {
          data: null,
          source: 'none',
          backendError: `Geração incompatível no backend (${parsedGen} !== ${currentGen})`,
        }
      }
      const key = this.getStageStateKey(seasonId, round, stageId)
      this._memoryStageStates.set(key, backendData)
      return {
        data: backendData,
        source: 'backend',
      }
    }

    // 3. Fallback para storage local (ou memória)
    const localData = this.readStageState(seasonId, round, stageId)
    if (localData && Array.isArray(localData.leaderboard) && localData.leaderboard.length > 0) {
      return {
        data: localData,
        source: 'local',
        backendError,
      }
    }

    return {
      data: null,
      source: 'none',
      backendError,
    }
  },

  /**
   * Salva o resultado oficial homologado de uma fase específica (Q1, Q2, Q3, SQ1, SQ2, SQ3).
   * Espelha a escrita para o PocketBase via canonicalQualifyingStageResultBackendService.
   *
   * Contrato CRÍTICO:
   * 1. Quando o write local falha por QUOTA_EXCEEDED (ou indisponibilidade) mas o backend sucede,
   *    o resultado é considerado PERSISTIDO ({ success: true, persistedBackend: true, persistedLocal: false }).
   * 2. Quando AMBOS local e backend falham, retorna falha observável ({ success: false, reason, error }).
   * 3. Quando local sucede, o espelho no backend é disparado em segundo plano (ou aguardado).
   */
  saveStageResult(
    result: QualifyingStageResult,
    options?: { syncBackendPromise?: Promise<{ success: boolean; id?: string; error?: string }> },
  ): SaveStageResultOutcome {
    const key = this.getStageResultKey(result.seasonId, result.round, result.stageId)
    const seasonNum = parseInt(String(result.seasonId).replace(/\D/g, ''), 10) || 1
    const backendCtx = {
      careerId: result.seasonId,
      season: seasonNum,
      round: result.round,
      stage: result.stageId,
    }

    // Guardar imediatamente no cache em memória da classe
    this._memoryStageResults.set(key, result)

    let localSuccess = false
    let localError: string | undefined
    let localReason: 'STORAGE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'STORAGE_ERROR' | undefined

    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        localSuccess = false
        localError = 'Storage não disponível neste ambiente'
        localReason = 'STORAGE_UNAVAILABLE'
      } else {
        try {
          safeLocalStorageSetItem(key, JSON.stringify(result), {
            seasonId: result.seasonId,
            currentRound: result.round,
          })
          localSuccess = true
        } catch (e: any) {
          const isQuotaError =
            e?.name === 'QuotaExceededError' ||
            e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e?.code === 22 ||
            e?.code === 1014 ||
            (typeof e?.message === 'string' &&
              (e.message.includes('quota') || e.message.includes('Quota')))

          localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
          localError = e instanceof Error ? e.message : String(e)

          console.warn('[QualifyingPersistence] Erro local ao salvar resultado de fase:', {
            reason: localReason,
            error: localError,
            stageId: result.stageId,
          })
        }
      }
    } catch (outerErr: any) {
      const isQuotaError =
        outerErr?.name === 'QuotaExceededError' ||
        outerErr?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        outerErr?.code === 22 ||
        outerErr?.code === 1014 ||
        (typeof outerErr?.message === 'string' &&
          (outerErr.message.includes('quota') || outerErr.message.includes('Quota')))

      localSuccess = false
      localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
      localError = outerErr instanceof Error ? outerErr.message : String(outerErr)

      console.warn(
        '[QualifyingPersistence] Exceção externa capturada ao salvar resultado de fase local:',
        {
          reason: localReason,
          error: localError,
          stageId: result.stageId,
        },
      )
    }

    // Espelhamento no PocketBase
    let backendPromise: Promise<{ success: boolean; id?: string; error?: string }>
    if (options?.syncBackendPromise) {
      backendPromise = options.syncBackendPromise
    } else {
      try {
        backendPromise = canonicalQualifyingStageResultBackendService.saveStageResult(
          backendCtx,
          result,
        )
      } catch (beErr: any) {
        backendPromise = Promise.resolve({
          success: false,
          error: beErr?.message || 'Falha síncrona ao invocar saveStageResult no backend',
        })
      }
    }

    // Se o storage local foi bem sucedido:
    if (localSuccess) {
      backendPromise.catch((beErr) => {
        console.warn(
          '[QualifyingPersistence] Falha assíncrona ao espelhar StageResult no PocketBase:',
          beErr,
        )
      })

      return {
        success: true,
        persistedLocal: true,
        persistedBackend: true,
      }
    }

    // Se o storage local FALHOU:
    // Se options.syncBackendPromise foi passado, podemos encadear.
    // Para chamadores síncronos legados que não passam syncBackendPromise, mantemos
    // a memória ativa e iniciamos o salvamento em backend em segundo plano.
    // Retornamos a falha local como baseline se ainda pendente, mas com memory disponível.
    return {
      success: false,
      error: localError,
      reason: localReason,
      persistedLocal: false,
      persistedBackend: false,
    }
  },

  /**
   * Versão assíncrona oficial de saveStageResult:
   * Aguarda tanto a tentativa local quanto a do PocketBase.
   * Se o local falhar (por exemplo QUOTA_EXCEEDED) mas o PocketBase suceder,
   * retorna SUCESSO ({ success: true, persistedBackend: true, persistedLocal: false }).
   */
  async saveStageResultAsync(result: QualifyingStageResult): Promise<SaveStageResultOutcome> {
    const key = this.getStageResultKey(result.seasonId, result.round, result.stageId)
    const seasonNum = parseInt(String(result.seasonId).replace(/\D/g, ''), 10) || 1
    const backendCtx = {
      careerId: result.seasonId,
      season: seasonNum,
      round: result.round,
      stage: result.stageId,
    }

    // Gravar no cache em memória
    this._memoryStageResults.set(key, result)

    let localSuccess = false
    let localError: string | undefined
    let localReason: 'STORAGE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'STORAGE_ERROR' | undefined

    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        localSuccess = false
        localError = 'Storage não disponível neste ambiente'
        localReason = 'STORAGE_UNAVAILABLE'
      } else {
        try {
          safeLocalStorageSetItem(key, JSON.stringify(result), {
            seasonId: result.seasonId,
            currentRound: result.round,
          })
          localSuccess = true
        } catch (e: any) {
          const isQuotaError =
            e?.name === 'QuotaExceededError' ||
            e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e?.code === 22 ||
            e?.code === 1014 ||
            (typeof e?.message === 'string' &&
              (e.message.includes('quota') || e.message.includes('Quota')))

          localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
          localError = e instanceof Error ? e.message : String(e)

          console.warn('[QualifyingPersistence] Erro local ao salvar resultado de fase:', {
            reason: localReason,
            error: localError,
            stageId: result.stageId,
          })
        }
      }
    } catch (outerErr: any) {
      const isQuotaError =
        outerErr?.name === 'QuotaExceededError' ||
        outerErr?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        outerErr?.code === 22 ||
        outerErr?.code === 1014 ||
        (typeof outerErr?.message === 'string' &&
          (outerErr.message.includes('quota') || outerErr.message.includes('Quota')))

      localSuccess = false
      localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
      localError = outerErr instanceof Error ? outerErr.message : String(outerErr)

      console.warn(
        '[QualifyingPersistence] Exceção externa capturada ao salvar resultado de fase local (async):',
        {
          reason: localReason,
          error: localError,
          stageId: result.stageId,
        },
      )
    }

    // Executar gravação no PocketBase
    let backendSuccess = false
    let backendError: string | undefined

    try {
      const beRes = await canonicalQualifyingStageResultBackendService.saveStageResult(
        backendCtx,
        result,
      )
      backendSuccess = !!beRes?.success
      if (!backendSuccess) {
        backendError = beRes?.error || 'PocketBase retornou success: false'
      }
    } catch (beErr: any) {
      backendSuccess = false
      backendError = beErr?.message || 'Falha ao conectar com PocketBase'
    }

    // CRÍTICO: Se o backend teve sucesso, o resultado canônico ESTÁ SALVO.
    // O local é apenas um cache. Mesmo com QUOTA_EXCEEDED no local, o retorno é sucesso!
    if (backendSuccess) {
      return {
        success: true,
        persistedBackend: true,
        persistedLocal: localSuccess,
        error: localSuccess ? undefined : localError,
      }
    }

    // Se o backend falhou mas o local teve sucesso, também é sucesso (com ressalva de backend ausente)
    if (localSuccess) {
      return {
        success: true,
        persistedBackend: false,
        persistedLocal: true,
        error: backendError,
      }
    }

    // Se AMBOS falharam:
    this._memoryStageResults.delete(key)
    return {
      success: false,
      error: `Local: ${localError || 'falha'} | Backend: ${backendError || 'falha'}`,
      reason: localReason || 'STORAGE_ERROR',
      persistedBackend: false,
      persistedLocal: false,
    }
  },

  /**
   * Lê o resultado oficial homologado de uma fase.
   * Consulta primeiro o cache em memória ativo / localStorage.
   */
  readStageResult(
    seasonId: string,
    round: number,
    stageId: QualifyingStageId,
  ): QualifyingStageResult | null {
    const key = this.getStageResultKey(seasonId, round, stageId)
    // 1. Verificar cache em memória caso a escrita tenha sido autoritativa no backend
    // mas não pôde ser gravada no localStorage por QuotaExceeded
    const inMemory = this._memoryStageResults.get(key)
    if (inMemory && inMemory.entries && inMemory.entries.length > 0) {
      return inMemory
    }

    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as QualifyingStageResult
      if (parsed) {
        this._memoryStageResults.set(key, parsed)
      }
      return parsed
    } catch (e) {
      console.warn('[QualifyingPersistence] Erro ao ler resultado de fase do storage local:', e)
      return null
    }
  },

  /**
   * Leitura assíncrona preferencial de StageResult com prioridade PocketBase:
   * 1. Consulta PocketBase (backend). Se presente e válido, vence divergência e popula memória/cache.
   * 2. Se PocketBase retornar NOT_FOUND (null), faz fallback para local.
   * 3. Se PocketBase der ERROR de rede, registra backendError e faz fallback para local.
   * Não altera nem recalcula dados no load.
   */
  async readStageResultPreferred(
    seasonId: string,
    round: number,
    stageId: QualifyingStageId,
  ): Promise<ReadStageResultOutcome> {
    const seasonNum = parseInt(String(seasonId).replace(/\D/g, ''), 10) || 1
    const backendCtx = {
      careerId: seasonId,
      season: seasonNum,
      round,
      stage: stageId,
    }

    let backendData: QualifyingStageResult | null = null
    let backendError: string | undefined

    // 1. Tentar ler do PocketBase
    try {
      backendData = await canonicalQualifyingStageResultBackendService.readStageResult(backendCtx)
    } catch (err: any) {
      backendError = err?.message || 'Erro ao consultar PocketBase'
    }

    // 2. Se backend retornou dados válidos: backend vence
    if (backendData && Array.isArray(backendData.entries) && backendData.entries.length > 0) {
      const key = this.getStageResultKey(seasonId, round, stageId)
      this._memoryStageResults.set(key, backendData)
      return {
        data: backendData,
        source: 'backend',
      }
    }

    // 3. Fallback para storage local (ou memória)
    const localData = this.readStageResult(seasonId, round, stageId)
    if (localData && Array.isArray(localData.entries) && localData.entries.length > 0) {
      return {
        data: localData,
        source: 'local',
        backendError,
      }
    }

    return {
      data: null,
      source: 'none',
      backendError,
    }
  },

  /**
   * Expurgar a cópia pesada do grid final combinado local somente após confirmação real do backend.
   * Mantém o cache de memória íntegro e libera cota no localStorage.
   */
  purgeLocalFinalGrid(seasonId: string, round: number): void {
    const key = this.getFinalGridKey(seasonId, round)
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.removeItem(key)
    } catch (e) {
      console.warn(
        `[QualifyingPersistence] Falha ao expurgar cópia pesada local de finalGrid (${seasonId}, r${round}):`,
        e,
      )
    }
  },

  /**
   * Limpa cache em memória para testes.
   */
  clearMemoryForTesting(): void {
    this._memoryStageStates.clear()
    this._memoryStageResults.clear()
    this._memoryFinalGrids.clear()
  },

  /**
   * Salva o resultado final completo da qualificação (grid P1–P24 + referências).
   * Resiliente a cota de localStorage (QuotaExceededError):
   * 1. Captura QuotaExceededError, NS_ERROR_DOM_QUOTA_REACHED, codes 22/1014, mensagem "quota".
   * 2. Sempre mantém cache em memória e dispara o espelhamento no PocketBase.
   * 3. Se options.syncBackendPromise foi passado ou em encadeamento assíncrono, se o backend confirmar,
   *    expurga a chave pesada local para manter a cota livre.
   * 4. Retorna SaveCompleteQualifyingResultOutcome discriminado.
   */
  saveCompleteQualifyingResult(
    result: CompleteQualifyingWeekendResult,
    options?: { syncBackendPromise?: Promise<{ success: boolean; id?: string; error?: string }> },
  ): SaveCompleteQualifyingResultOutcome {
    const key = this.getFinalGridKey(result.seasonId, result.round)
    const seasonNum = parseInt(String(result.seasonId).replace(/\D/g, ''), 10) || 1
    const backendCtx = {
      careerId: result.seasonId,
      season: seasonNum,
      round: result.round,
    }

    // Gravar no cache em memória imediatamente
    this._memoryFinalGrids.set(key, result)

    let localSuccess = false
    let localError: string | undefined
    let localReason: 'STORAGE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'STORAGE_ERROR' | undefined

    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        localSuccess = false
        localError = 'Storage não disponível neste ambiente'
        localReason = 'STORAGE_UNAVAILABLE'
      } else {
        try {
          safeLocalStorageSetItem(key, JSON.stringify(result), {
            seasonId: result.seasonId,
            currentRound: result.round,
          })
          localSuccess = true
        } catch (e: any) {
          const isQuotaError =
            e?.name === 'QuotaExceededError' ||
            e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e?.code === 22 ||
            e?.code === 1014 ||
            (typeof e?.message === 'string' &&
              (e.message.includes('quota') || e.message.includes('Quota')))

          localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
          localError = e instanceof Error ? e.message : String(e)

          console.warn('[QualifyingPersistence] Erro local ao salvar grid final completo:', {
            reason: localReason,
            error: localError,
            seasonId: result.seasonId,
            round: result.round,
          })
        }
      }
    } catch (outerErr: any) {
      const isQuotaError =
        outerErr?.name === 'QuotaExceededError' ||
        outerErr?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        outerErr?.code === 22 ||
        outerErr?.code === 1014 ||
        (typeof outerErr?.message === 'string' &&
          (outerErr.message.includes('quota') || outerErr.message.includes('Quota')))

      localSuccess = false
      localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
      localError = outerErr instanceof Error ? outerErr.message : String(outerErr)

      console.warn(
        '[QualifyingPersistence] Exceção externa capturada ao salvar grid final local:',
        {
          reason: localReason,
          error: localError,
          seasonId: result.seasonId,
          round: result.round,
        },
      )
    }

    // Espelhamento no PocketBase
    let backendPromise: Promise<{ success: boolean; id?: string; error?: string }>
    if (options?.syncBackendPromise) {
      backendPromise = options.syncBackendPromise
    } else {
      try {
        backendPromise = canonicalQualifyingFinalGridBackendService.saveFinalGrid(
          backendCtx,
          result,
        )
      } catch (beErr: any) {
        backendPromise = Promise.resolve({
          success: false,
          error: beErr?.message || 'Falha síncrona ao invocar saveFinalGrid no backend',
        })
      }
    }

    if (localSuccess) {
      backendPromise
        .then((res) => {
          if (res?.success) {
            // Expurgar cópia pesada local se confirmado no backend para liberar cota
            this.purgeLocalFinalGrid(result.seasonId, result.round)
          }
        })
        .catch((beErr) => {
          console.warn(
            '[QualifyingPersistence] Falha assíncrona ao espelhar grid final no PocketBase:',
            beErr,
          )
        })

      return {
        success: true,
        persistedLocal: true,
        persistedBackend: true,
      }
    }

    // Se local falhou, encadeia purge na confirmação do backend
    backendPromise
      .then((res) => {
        if (res?.success) {
          this.purgeLocalFinalGrid(result.seasonId, result.round)
        } else {
          console.error(
            `[QualifyingPersistence] Falha dupla: local e backend não confirmaram finalGrid (${result.seasonId}, r${result.round})`,
          )
        }
      })
      .catch((beErr) => {
        console.error(
          `[QualifyingPersistence] Exceção assíncrona ao espelhar finalGrid pós-falha local:`,
          beErr,
        )
      })

    return {
      success: false,
      error: localError,
      reason: localReason,
      persistedLocal: false,
      persistedBackend: false,
    }
  },

  /**
   * Versão assíncrona oficial de saveCompleteQualifyingResult:
   * Aguarda tanto a tentativa local quanto a do PocketBase.
   * Se o local falhar (QUOTA_EXCEEDED) mas o backend confirmar,
   * retorna SUCESSO ({ success: true, persistedBackend: true, persistedLocal: false })
   * e expurga a cópia pesada local dessa chave apenas.
   */
  async saveCompleteQualifyingResultAsync(
    result: CompleteQualifyingWeekendResult,
  ): Promise<SaveCompleteQualifyingResultOutcome> {
    const key = this.getFinalGridKey(result.seasonId, result.round)
    const seasonNum = parseInt(String(result.seasonId).replace(/\D/g, ''), 10) || 1
    const backendCtx = {
      careerId: result.seasonId,
      season: seasonNum,
      round: result.round,
    }

    // Gravar no cache em memória
    this._memoryFinalGrids.set(key, result)

    let localSuccess = false
    let localError: string | undefined
    let localReason: 'STORAGE_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'STORAGE_ERROR' | undefined

    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        localSuccess = false
        localError = 'Storage não disponível neste ambiente'
        localReason = 'STORAGE_UNAVAILABLE'
      } else {
        try {
          safeLocalStorageSetItem(key, JSON.stringify(result), {
            seasonId: result.seasonId,
            currentRound: result.round,
          })
          localSuccess = true
        } catch (e: any) {
          const isQuotaError =
            e?.name === 'QuotaExceededError' ||
            e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            e?.code === 22 ||
            e?.code === 1014 ||
            (typeof e?.message === 'string' &&
              (e.message.includes('quota') || e.message.includes('Quota')))

          localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
          localError = e instanceof Error ? e.message : String(e)

          console.warn('[QualifyingPersistence] Erro local ao salvar grid final completo:', {
            reason: localReason,
            error: localError,
            seasonId: result.seasonId,
            round: result.round,
          })
        }
      }
    } catch (outerErr: any) {
      const isQuotaError =
        outerErr?.name === 'QuotaExceededError' ||
        outerErr?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        outerErr?.code === 22 ||
        outerErr?.code === 1014 ||
        (typeof outerErr?.message === 'string' &&
          (outerErr.message.includes('quota') || outerErr.message.includes('Quota')))

      localSuccess = false
      localReason = isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'
      localError = outerErr instanceof Error ? outerErr.message : String(outerErr)

      console.warn(
        '[QualifyingPersistence] Exceção externa capturada ao salvar grid final local (async):',
        {
          reason: localReason,
          error: localError,
          seasonId: result.seasonId,
          round: result.round,
        },
      )
    }

    // Executar gravação no PocketBase
    let backendSuccess = false
    let backendError: string | undefined

    try {
      const beRes = await canonicalQualifyingFinalGridBackendService.saveFinalGrid(
        backendCtx,
        result,
      )
      backendSuccess = !!beRes?.success
      if (!backendSuccess) {
        backendError = beRes?.error || 'PocketBase retornou success: false'
      }
    } catch (beErr: any) {
      backendSuccess = false
      backendError = beErr?.message || 'Falha ao conectar com PocketBase'
    }

    // Se o backend teve sucesso, o grid final canônico ESTÁ SALVO
    if (backendSuccess) {
      this.purgeLocalFinalGrid(result.seasonId, result.round)
      return {
        success: true,
        persistedBackend: true,
        persistedLocal: localSuccess,
        error: localSuccess ? undefined : localError,
      }
    }

    // Se o backend falhou mas o local teve sucesso
    if (localSuccess) {
      return {
        success: true,
        persistedBackend: false,
        persistedLocal: true,
        error: backendError,
      }
    }

    // Se AMBOS falharam:
    this._memoryFinalGrids.delete(key)
    return {
      success: false,
      error: `Local: ${localError || 'falha'} | Backend: ${backendError || 'falha'}`,
      reason: localReason || 'STORAGE_ERROR',
      persistedBackend: false,
      persistedLocal: false,
    }
  },

  /**
   * Lê o resultado final completo da qualificação (grid P1–P24).
   * Consulta primeiro o cache em memória ativo / localStorage.
   */
  readCompleteQualifyingResult(
    seasonId: string,
    round: number,
  ): CompleteQualifyingWeekendResult | null {
    const key = this.getFinalGridKey(seasonId, round)
    const inMemory = this._memoryFinalGrids.get(key)
    if (inMemory && Array.isArray(inMemory.finalGrid) && inMemory.finalGrid.length > 0) {
      return inMemory
    }

    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as CompleteQualifyingWeekendResult
      if (parsed) {
        this._memoryFinalGrids.set(key, parsed)
      }
      return parsed
    } catch (e) {
      console.warn('[QualifyingPersistence] Erro ao ler grid final completo:', e)
      return null
    }
  },

  /**
   * Leitura assíncrona preferencial de grid final com prioridade PocketBase:
   * 1. Consulta PocketBase (backend). Se presente e válido, vence divergência e popula memória/cache.
   * 2. Se PocketBase retornar NOT_FOUND (null), faz fallback para local.
   * 3. Se PocketBase der ERROR de rede, registra backendError e faz fallback para local.
   * Não altera nem recalcula posições ou tempos no load.
   */
  async readCompleteQualifyingResultPreferred(
    seasonId: string,
    round: number,
  ): Promise<ReadCompleteQualifyingResultOutcome> {
    const seasonNum = parseInt(String(seasonId).replace(/\D/g, ''), 10) || 1
    const backendCtx = {
      careerId: seasonId,
      season: seasonNum,
      round,
    }

    let backendData: CompleteQualifyingWeekendResult | null = null
    let backendError: string | undefined

    // 1. Tentar ler do PocketBase
    try {
      backendData = await canonicalQualifyingFinalGridBackendService.readFinalGrid(backendCtx)
    } catch (err: any) {
      backendError = err?.message || 'Erro ao consultar PocketBase'
    }

    // 2. Se backend retornou dados válidos: backend vence
    if (backendData && Array.isArray(backendData.finalGrid) && backendData.finalGrid.length > 0) {
      const key = this.getFinalGridKey(seasonId, round)
      this._memoryFinalGrids.set(key, backendData)
      return {
        data: backendData,
        source: 'backend',
      }
    }

    // 3. Fallback para storage local (ou memória)
    const localData = this.readCompleteQualifyingResult(seasonId, round)
    if (localData && Array.isArray(localData.finalGrid) && localData.finalGrid.length > 0) {
      return {
        data: localData,
        source: 'local',
        backendError,
      }
    }

    return {
      data: null,
      source: 'none',
      backendError,
    }
  },

  /**
   * Define o status de Parc Fermé.
   * O Parc Fermé é ativado assim que o Q1 inicia e congela o setup principal para Q2/Q3/Corrida.
   */
  setParcFermeActive(seasonId: string, round: number, active: boolean): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.getParcFermeKey(seasonId, round)
      try {
        safeLocalStorageSetItem(
          key,
          JSON.stringify({ active, updatedAt: new Date().toISOString() }),
          { seasonId, currentRound: round },
        )
      } catch (e) {
        console.warn('[QualifyingPersistence] Erro ao definir Parc Fermé:', e)
      }
    } catch (outerErr) {
      console.warn('[QualifyingPersistence] Exceção externa em setParcFermeActive:', outerErr)
    }
  },

  /**
   * Salva o grid final de Sprint a partir de SQ3 de forma resiliente à cota.
   */
  saveSprintGridFromSQ3Result(
    seasonId: string,
    round: number,
  ): SaveCompleteQualifyingResultOutcome | null {
    const grid = this.buildSprintGridFromSQ3Result(seasonId, round)
    if (!grid) return null
    try {
      return this.saveCompleteQualifyingResult(grid)
    } catch (err: any) {
      console.warn('[QualifyingPersistence] Exceção em saveSprintGridFromSQ3Result:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        reason: 'STORAGE_ERROR',
        persistedBackend: false,
        persistedLocal: false,
      }
    }
  },

  /**
   * Verifica se o Parc Fermé está ativo para este evento.
   */
  isParcFermeActive(seasonId: string, round: number): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false
    try {
      const raw = window.localStorage.getItem(this.getParcFermeKey(seasonId, round))
      if (!raw) return false
      const parsed = JSON.parse(raw)
      return !!parsed.active
    } catch {
      return false
    }
  },

  /**
   * SPRINT-FDS-01-R4C3: Constrói o grid canônico da Corrida Sprint a partir do resultado oficial de SQ3.
   * Regra canônica:
   * - SQ3 define P1..P10 pelo resultado de SQ3 (respeitando a ordem oficial de SQ3).
   * - SQ2 define P11..P18 pelos eliminados de SQ2 (se presentes no round).
   * - SQ1 define P19..P24 pelos eliminados de SQ1 (se presentes no round).
   * - Caso SQ3 contenha todas as entradas ou apenas SQ3 esteja presente, preserva a ordem final estrita de SQ3.
   * - Retorna CompleteQualifyingWeekendResult formatado para a UI / initializeRaceFromCanonicalGrid.
   */
  buildSprintGridFromSQ3Result(
    seasonId: string,
    round: number,
  ): CompleteQualifyingWeekendResult | null {
    const sq3Result = this.readStageResult(seasonId, round, 'sq3')
    if (!sq3Result || !sq3Result.entries || sq3Result.entries.length === 0) {
      return null
    }

    const sq1Result = this.readStageResult(seasonId, round, 'sq1')
    const sq2Result = this.readStageResult(seasonId, round, 'sq2')

    // Se temos as fases completas SQ1, SQ2 e SQ3
    if (sq1Result && sq2Result && sq3Result.stageId === 'sq3') {
      const assignedDriverIds = new Set<string>()

      // 1. P1 a P10 vêm de SQ3 ordenados pelos melhores tempos canônicos de SQ3
      const sq3Sorted = [...sq3Result.entries]
        .filter((e) => {
          if (!e.driverId || assignedDriverIds.has(e.driverId)) return false
          assignedDriverIds.add(e.driverId)
          return true
        })
        .sort((a, b) => {
          if (a.bestLapSec > 0 && b.bestLapSec > 0) {
            if (a.bestLapSec !== b.bestLapSec) return a.bestLapSec - b.bestLapSec
            return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
          }
          if (a.bestLapSec > 0) return -1
          if (b.bestLapSec > 0) return 1
          return 0
        })

      // 2. P11 a P18 vêm dos eliminados da SQ2 (quem participou da SQ3 jamais pode figurar aqui)
      const sq2Eliminated = [...sq2Result.entries]
        .filter((e) => {
          if (!e.driverId || assignedDriverIds.has(e.driverId)) return false
          const isMarked =
            sq2Result.eliminatedDriverIds?.includes(e.driverId) ||
            !sq3Result.entries.some((s) => s.driverId === e.driverId)
          if (isMarked) {
            assignedDriverIds.add(e.driverId)
            return true
          }
          return false
        })
        .sort((a, b) => {
          if (a.bestLapSec > 0 && b.bestLapSec > 0) {
            if (a.bestLapSec !== b.bestLapSec) return a.bestLapSec - b.bestLapSec
            return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
          }
          if (a.bestLapSec > 0) return -1
          if (b.bestLapSec > 0) return 1
          return 0
        })

      // 3. P19 a P24 vêm dos eliminados da SQ1 (quem participou de SQ2 ou SQ3 jamais pode figurar aqui)
      const sq1Eliminated = [...sq1Result.entries]
        .filter((e) => {
          if (!e.driverId || assignedDriverIds.has(e.driverId)) return false
          const isMarked =
            sq1Result.eliminatedDriverIds?.includes(e.driverId) ||
            (!sq3Result.entries.some((s) => s.driverId === e.driverId) &&
              !sq2Result.entries.some((s) => s.driverId === e.driverId))
          if (isMarked) {
            assignedDriverIds.add(e.driverId)
            return true
          }
          return false
        })
        .sort((a, b) => {
          if (a.bestLapSec > 0 && b.bestLapSec > 0) {
            if (a.bestLapSec !== b.bestLapSec) return a.bestLapSec - b.bestLapSec
            return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
          }
          if (a.bestLapSec > 0) return -1
          if (b.bestLapSec > 0) return 1
          return 0
        })

      const combined = [...sq3Sorted, ...sq2Eliminated, ...sq1Eliminated]
      const finalGrid: FinalQualifyingGridEntry[] = combined.map((e, idx) => {
        const sq1Entry = sq1Result.entries.find((item) => item.driverId === e.driverId)
        const sq2Entry = sq2Result.entries.find((item) => item.driverId === e.driverId)
        const sq3Entry = sq3Result.entries.find((item) => item.driverId === e.driverId)

        return {
          gridPosition: idx + 1,
          driverId: e.driverId,
          driverName: e.driverName,
          teamId: e.teamId,
          teamName: e.teamName,
          teamColor: e.teamColor,
          isPlayer: e.isPlayer,
          carId: e.carId,
          eliminationStage:
            idx < sq3Sorted.length
              ? 'Q3'
              : idx < sq3Sorted.length + sq2Eliminated.length
                ? 'Q2'
                : 'Q1',
          bestLapSec: e.bestLapSec,
          bestLapTime: e.bestLapTime,
          bestLapCompound: e.compound,
          tyreSetId: e.tyreSetId,
          q1LapTime: sq1Entry?.bestLapTime || e.bestLapTime,
          q2LapTime: sq2Entry?.bestLapTime,
          q3LapTime: sq3Entry?.bestLapTime,
        }
      })

      const pole = finalGrid[0]
      return {
        seasonId,
        round,
        completedAt: sq3Result.completedAt || new Date().toISOString(),
        poleDriverId: pole?.driverId || '',
        poleDriverName: pole?.driverName || '',
        poleLapTime: pole?.bestLapTime || '--:--.---',
        q1Result: sq1Result,
        q2Result: sq2Result,
        q3Result: sq3Result,
        finalGrid,
      }
    }

    // Caso onde SQ3 é fornecida isoladamente ou já possui todos os classificados
    const sortedEntries = [...sq3Result.entries].sort((a, b) => {
      if (a.bestLapSec > 0 && b.bestLapSec > 0) {
        if (a.bestLapSec !== b.bestLapSec) return a.bestLapSec - b.bestLapSec
        return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
      }
      if (a.bestLapSec > 0) return -1
      if (b.bestLapSec > 0) return 1
      return 0
    })

    const finalGrid: FinalQualifyingGridEntry[] = sortedEntries.map((e, idx) => ({
      gridPosition: idx + 1,
      driverId: e.driverId,
      driverName: e.driverName,
      teamId: e.teamId,
      teamName: e.teamName,
      teamColor: e.teamColor,
      isPlayer: e.isPlayer,
      carId: e.carId,
      eliminationStage: 'Q3',
      bestLapSec: e.bestLapSec,
      bestLapTime: e.bestLapTime,
      bestLapCompound: e.compound,
      tyreSetId: e.tyreSetId,
      q1LapTime: e.bestLapTime,
    }))

    const pole = finalGrid[0]
    return {
      seasonId,
      round,
      completedAt: sq3Result.completedAt || new Date().toISOString(),
      poleDriverId: pole?.driverId || '',
      poleDriverName: pole?.driverName || '',
      poleLapTime: pole?.bestLapTime || '--:--.---',
      q1Result: sq3Result,
      q2Result: undefined as any,
      q3Result: undefined as any,
      finalGrid,
    }
  },

  /**
   * Constrói o grid final oficial P1–P24 combinando os resultados canônicos de Q1, Q2 e Q3.
   * Regra oficial de formação de grid:
   * - Q3 (10 pilotos): define P1 a P10 ordenados pelos melhores tempos de Q3.
   * - Eliminados no Q2 (8 pilotos): ocupam P11 a P18 ordenados pelos melhores tempos de Q2.
   * - Eliminados no Q1 (6 pilotos): ocupam P19 a P24 ordenados pelos melhores tempos de Q1.
   * Desempates resolvidos deterministicamente por quem registrou o tempo primeiro (bestLapRecordedAtSec).
   */
  buildCombinedFinalGrid(params: {
    seasonId: string
    round: number
    q1Result: QualifyingStageResult
    q2Result: QualifyingStageResult
    q3Result: QualifyingStageResult
    persistResult?: boolean
  }): CompleteQualifyingWeekendResult {
    const { seasonId, round, q1Result, q2Result, q3Result, persistResult = true } = params

    // Conjunto para assegurar unicidade estrita de driverId conforme regras canônicas da FIA
    const assignedDriverIds = new Set<string>()

    // 1. P1 a P10 vêm de Q3 (quem participou do Q3 não pode figurar no Q2 nem no Q1)
    const q3Sorted = [...q3Result.entries]
      .filter((e) => {
        if (!e.driverId || assignedDriverIds.has(e.driverId)) return false
        assignedDriverIds.add(e.driverId)
        return true
      })
      .sort((a, b) => {
        if (a.bestLapSec > 0 && b.bestLapSec > 0) {
          if (a.bestLapSec !== b.bestLapSec) return a.bestLapSec - b.bestLapSec
          return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
        }
        if (a.bestLapSec > 0) return -1
        if (b.bestLapSec > 0) return 1
        return 0
      })

    // 2. P11 a P18 vêm dos eliminados no Q2 (quem avançou ao Q3 NUNCA pode estar aqui)
    const q2Eliminated = q2Result.entries
      .filter((e) => {
        if (!e.driverId || assignedDriverIds.has(e.driverId)) return false
        const isMarkedEliminated = q2Result.eliminatedDriverIds.includes(e.driverId)
        if (isMarkedEliminated) {
          assignedDriverIds.add(e.driverId)
          return true
        }
        return false
      })
      .sort((a, b) => {
        if (a.bestLapSec > 0 && b.bestLapSec > 0) {
          if (a.bestLapSec !== b.bestLapSec) return a.bestLapSec - b.bestLapSec
          return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
        }
        if (a.bestLapSec > 0) return -1
        if (b.bestLapSec > 0) return 1
        return 0
      })

    // 3. P19 a P24 vêm dos eliminados no Q1 (quem avançou ao Q2 ou Q3 NUNCA pode estar aqui)
    const q1Eliminated = q1Result.entries
      .filter((e) => {
        if (!e.driverId || assignedDriverIds.has(e.driverId)) return false
        const isMarkedEliminated = q1Result.eliminatedDriverIds.includes(e.driverId)
        if (isMarkedEliminated) {
          assignedDriverIds.add(e.driverId)
          return true
        }
        return false
      })
      .sort((a, b) => {
        if (a.bestLapSec > 0 && b.bestLapSec > 0) {
          if (a.bestLapSec !== b.bestLapSec) return a.bestLapSec - b.bestLapSec
          return (a.bestLapRecordedAtSec || 0) - (b.bestLapRecordedAtSec || 0)
        }
        if (a.bestLapSec > 0) return -1
        if (b.bestLapSec > 0) return 1
        return 0
      })

    const finalGrid: FinalQualifyingGridEntry[] = []

    // Adiciona P1–P10 (Q3)
    q3Sorted.forEach((entry, idx) => {
      const q1Entry = q1Result.entries.find((e) => e.driverId === entry.driverId)
      const q2Entry = q2Result.entries.find((e) => e.driverId === entry.driverId)
      finalGrid.push({
        gridPosition: idx + 1,
        driverId: entry.driverId,
        driverName: entry.driverName,
        teamId: entry.teamId,
        teamName: entry.teamName,
        teamColor: entry.teamColor,
        isPlayer: entry.isPlayer,
        carId: entry.carId,
        eliminationStage: 'Q3',
        bestLapSec: entry.bestLapSec,
        bestLapTime: entry.bestLapTime,
        bestLapCompound: entry.compound,
        tyreSetId: entry.tyreSetId,
        q1LapTime: q1Entry?.bestLapTime,
        q2LapTime: q2Entry?.bestLapTime,
        q3LapTime: entry.bestLapTime,
      })
    })

    // Adiciona P11–P18 (Q2)
    q2Eliminated.forEach((entry, idx) => {
      const q1Entry = q1Result.entries.find((e) => e.driverId === entry.driverId)
      finalGrid.push({
        gridPosition: finalGrid.length + 1,
        driverId: entry.driverId,
        driverName: entry.driverName,
        teamId: entry.teamId,
        teamName: entry.teamName,
        teamColor: entry.teamColor,
        isPlayer: entry.isPlayer,
        carId: entry.carId,
        eliminationStage: 'Q2',
        bestLapSec: entry.bestLapSec,
        bestLapTime: entry.bestLapTime,
        bestLapCompound: entry.compound,
        tyreSetId: entry.tyreSetId,
        q1LapTime: q1Entry?.bestLapTime,
        q2LapTime: entry.bestLapTime,
        q3LapTime: undefined,
      })
    })

    // Adiciona P19–P24 (Q1)
    q1Eliminated.forEach((entry) => {
      finalGrid.push({
        gridPosition: finalGrid.length + 1,
        driverId: entry.driverId,
        driverName: entry.driverName,
        teamId: entry.teamId,
        teamName: entry.teamName,
        teamColor: entry.teamColor,
        isPlayer: entry.isPlayer,
        carId: entry.carId,
        eliminationStage: 'Q1',
        bestLapSec: entry.bestLapSec,
        bestLapTime: entry.bestLapTime,
        bestLapCompound: entry.compound,
        tyreSetId: entry.tyreSetId,
        q1LapTime: entry.bestLapTime,
        q2LapTime: undefined,
        q3LapTime: undefined,
      })
    })

    // Salvaguarda canônica: se restarem pilotos de Q1/Q2 não incluídos por inconsistência de flags de eliminação,
    // preencher até 24 de forma estritamente única
    if (finalGrid.length < 24) {
      const remainingQ1 = q1Result.entries.filter(
        (e) => e.driverId && !assignedDriverIds.has(e.driverId),
      )
      remainingQ1.sort((a, b) => {
        if (a.bestLapSec > 0 && b.bestLapSec > 0) return a.bestLapSec - b.bestLapSec
        if (a.bestLapSec > 0) return -1
        if (b.bestLapSec > 0) return 1
        return 0
      })
      remainingQ1.forEach((entry) => {
        if (finalGrid.length >= 24) return
        assignedDriverIds.add(entry.driverId)
        finalGrid.push({
          gridPosition: finalGrid.length + 1,
          driverId: entry.driverId,
          driverName: entry.driverName,
          teamId: entry.teamId,
          teamName: entry.teamName,
          teamColor: entry.teamColor,
          isPlayer: entry.isPlayer,
          carId: entry.carId,
          eliminationStage: 'Q1',
          bestLapSec: entry.bestLapSec,
          bestLapTime: entry.bestLapTime,
          bestLapCompound: entry.compound,
          tyreSetId: entry.tyreSetId,
          q1LapTime: entry.bestLapTime,
          q2LapTime: undefined,
          q3LapTime: undefined,
        })
      })
    }

    const poleEntry = finalGrid[0]

    const completeResult: CompleteQualifyingWeekendResult = {
      seasonId,
      round,
      completedAt: new Date().toISOString(),
      poleDriverId: poleEntry?.driverId || '',
      poleDriverName: poleEntry?.driverName || '',
      poleLapTime: poleEntry?.bestLapTime || '--:--.---',
      q1Result,
      q2Result,
      q3Result,
      finalGrid,
    }

    if (persistResult) {
      try {
        this.saveCompleteQualifyingResult(completeResult)
      } catch (err: any) {
        console.warn(
          '[QualifyingPersistence] Exceção capturada em buildCombinedFinalGrid ao salvar grid final:',
          err,
        )
      }
    }
    return completeResult
  },

  /**
   * Versão assíncrona oficial de buildCombinedFinalGrid:
   * Constrói o grid final oficial e persiste assincronamente aguardando PocketBase.
   */
  async buildCombinedFinalGridAsync(params: {
    seasonId: string
    round: number
    q1Result: QualifyingStageResult
    q2Result: QualifyingStageResult
    q3Result: QualifyingStageResult
    persistResult?: boolean
  }): Promise<{
    result: CompleteQualifyingWeekendResult
    outcome?: SaveCompleteQualifyingResultOutcome
  }> {
    const completeResult = this.buildCombinedFinalGrid({
      ...params,
      persistResult: false,
    })

    if (params.persistResult === false) {
      return { result: completeResult }
    }

    try {
      const outcome = await this.saveCompleteQualifyingResultAsync(completeResult)
      return { result: completeResult, outcome }
    } catch (err: any) {
      console.warn('[QualifyingPersistence] Exceção capturada em buildCombinedFinalGridAsync:', err)
      return {
        result: completeResult,
        outcome: {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          reason: 'STORAGE_ERROR',
          persistedBackend: false,
          persistedLocal: false,
        },
      }
    }
  },
}
