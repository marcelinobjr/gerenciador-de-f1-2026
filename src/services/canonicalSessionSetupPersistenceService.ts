/**
 * canonicalSessionSetupPersistenceService.ts
 *
 * Módulo Canônico de Persistência Resiliente e Idempotente para a collection `session_setups` do PocketBase.
 *
 * Resolve a condição de corrida em trocas de sessão e gravações paralelas:
 * 1. In-flight Lock por chave de sessão (teamId_seasonId_round_session).
 * 2. Cache de ID PocketBase em memória para pular `getList` em escritas subsequentes e ir direto a `update`.
 * 3. Fallback determinístico em caso de 400 (validation_not_unique / conflito concorrente).
 * 4. Blindagem não-bloqueante: erros técnicos e de rede são absorvidos silenciosamente (com aviso interno),
 *    mantendo o fluxo esportivo e a experiência de usuário 100% fluidos.
 */

import pb from '@/lib/pocketbase/client'

export interface SessionSetupUpsertOptions {
  teamId: string
  seasonId: string
  round: number
  session: string // 'tp1' | 'tp2' | 'tp3' | 'q1' | 'q2' | 'q3' | 'race' | string
  payload?: Record<string, any>
  /**
   * Função para mesclar/atualizar campos estruturados caso o registro já exista.
   * Recebe o registro existente encontrado no backend e retorna o payload mesclado para o update.
   */
  mergeWithExisting?: (existingRecord: any) => Record<string, any>
}

export interface SessionSetupUpsertResult {
  success: boolean
  id?: string
  isCreated: boolean
  isUpdated: boolean
}

export class CanonicalSessionSetupPersistenceService {
  /**
   * In-flight lock por quadrante de sessão
   */
  private inFlightUpserts = new Map<string, Promise<SessionSetupUpsertResult>>()

  /**
   * Cache de ID PocketBase por chave lógica de sessão
   */
  private recordIdCache = new Map<string, string>()

  public buildSlotKey(teamId: string, seasonId: string, round: number, session: string): string {
    return `session_setup_${teamId}_${seasonId}_r${round}_${session}`
  }

  /**
   * Executa upsert resiliente com trava de voo (in-flight lock)
   */
  public async upsertSessionSetup(
    options: SessionSetupUpsertOptions,
  ): Promise<SessionSetupUpsertResult> {
    const slotKey = this.buildSlotKey(
      options.teamId,
      options.seasonId,
      options.round,
      options.session,
    )

    const existingInFlight = this.inFlightUpserts.get(slotKey)
    if (existingInFlight) {
      return existingInFlight
    }

    const upsertPromise = this.executeUpsert(slotKey, options).finally(() => {
      this.inFlightUpserts.delete(slotKey)
    })

    this.inFlightUpserts.set(slotKey, upsertPromise)
    return upsertPromise
  }

  private async executeUpsert(
    slotKey: string,
    options: SessionSetupUpsertOptions,
  ): Promise<SessionSetupUpsertResult> {
    const { teamId, seasonId, round, session, payload = {}, mergeWithExisting } = options

    try {
      if (!pb?.collection) {
        return { success: false, isCreated: false, isUpdated: false }
      }
      const collection = pb.collection('session_setups')

      // 1. Tentar ler ID do cache
      let cachedId = this.recordIdCache.get(slotKey)
      let existingItem: any = null

      if (cachedId) {
        try {
          if (mergeWithExisting) {
            existingItem = await collection.getOne(cachedId)
          }
        } catch {
          // ID cacheado não existe mais no backend; descarta do cache
          this.recordIdCache.delete(slotKey)
          cachedId = undefined
          existingItem = null
        }
      }

      // Se não havia ID em cache ou foi invalidado, busca no PB
      if (!cachedId) {
        try {
          const filter = `team_id = "${teamId}" && season_id = "${seasonId}" && round = ${round} && session = "${session}"`
          const records = await collection.getList(1, 1, { filter })
          if (records?.items?.length > 0) {
            existingItem = records.items[0]
            cachedId = existingItem.id
            this.recordIdCache.set(slotKey, cachedId!)
          }
        } catch (lookupErr: any) {
          console.warn(
            `[CanonicalSessionSetupPersistence] Aviso ao consultar session_setups (${slotKey}):`,
            lookupErr?.message || lookupErr,
          )
        }
      }

      // 2. Se já existe o registro: executa UPDATE
      if (cachedId) {
        const updatePayload = mergeWithExisting
          ? mergeWithExisting(existingItem || { id: cachedId })
          : payload

        try {
          const updated = await collection.update(cachedId, updatePayload)
          if (updated?.id) {
            this.recordIdCache.set(slotKey, updated.id)
            return { success: true, id: updated.id, isCreated: false, isUpdated: true }
          }
          return { success: true, id: cachedId, isCreated: false, isUpdated: true }
        } catch (updateErr: any) {
          console.warn(
            `[CanonicalSessionSetupPersistence] Falha ao atualizar session_setup (${cachedId}), tentando fallback:`,
            updateErr?.message || updateErr,
          )
          this.recordIdCache.delete(slotKey)
          // Se falhou o update (ex: registro foi deletado), prossegue para tentativa de criação
        }
      }

      // 3. Se não existe: executa CREATE
      const createPayload = {
        team_id: teamId,
        season_id: seasonId,
        round,
        session,
        ...payload,
      }

      try {
        const created = await collection.create(createPayload)
        if (created?.id) {
          this.recordIdCache.set(slotKey, created.id)
          return { success: true, id: created.id, isCreated: true, isUpdated: false }
        }
        return { success: true, isCreated: true, isUpdated: false }
      } catch (createErr: any) {
        // 4. Tratamento de colisão concorrente / validation_not_unique
        const isConflictError =
          createErr?.status === 400 ||
          createErr?.message?.includes('validation_not_unique') ||
          createErr?.message?.includes('Value must be unique') ||
          createErr?.response?.data?.notes?.code === 'validation_not_unique'

        if (isConflictError) {
          try {
            const filter = `team_id = "${teamId}" && season_id = "${seasonId}" && round = ${round} && session = "${session}"`
            const retryRecords = await collection.getList(1, 1, { filter })
            if (retryRecords?.items?.length > 0) {
              const concurrentItem = retryRecords.items[0]
              this.recordIdCache.set(slotKey, concurrentItem.id)
              const retryUpdatePayload = mergeWithExisting
                ? mergeWithExisting(concurrentItem)
                : payload
              const updated = await collection.update(concurrentItem.id, retryUpdatePayload)
              return { success: true, id: updated.id, isCreated: false, isUpdated: true }
            }
          } catch (retryErr: any) {
            console.warn(
              `[CanonicalSessionSetupPersistence] Falha no fallback pós-conflito para ${slotKey}:`,
              retryErr?.message || retryErr,
            )
          }
        }

        console.warn(
          `[CanonicalSessionSetupPersistence] Falha não-bloqueante ao criar session_setup (${slotKey}):`,
          createErr?.message || createErr,
        )
        return { success: false, isCreated: false, isUpdated: false }
      }
    } catch (globalErr: any) {
      console.warn(
        `[CanonicalSessionSetupPersistence] Erro não-bloqueante de persistência (${slotKey}):`,
        globalErr?.message || globalErr,
      )
      return { success: false, isCreated: false, isUpdated: false }
    }
  }

  /**
   * Limpa caches em memória para isolamento e testes unitários.
   */
  public clearCachesForTesting(): void {
    this.inFlightUpserts.clear()
    this.recordIdCache.clear()
  }
}

export const canonicalSessionSetupPersistenceService = new CanonicalSessionSetupPersistenceService()
