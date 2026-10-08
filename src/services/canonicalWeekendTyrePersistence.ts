/**
 * CANONICAL WEEKEND TYRE PERSISTENCE SERVICE
 *
 * Gerencia o inventário individual persistente de pneus por piloto para o fim de semana.
 *
 * Semântica Canônica:
 * 1. Cada PILOTO tem seu próprio inventário — não existe estoque genérico de equipe.
 * 2. Criado UMA ÚNICA VEZ por evento (seasonId + round): reload, troca de tela,
 *    entrar em TL, Quali ou Corrida NÃO recria pneus nem zera desgaste.
 * 3. Identidade de cada jogo: { id, driverId, compound, wear, lapsUsed, isFitted, ... }
 * 4. Pneus de chuva (4 Intermediários + 3 Chuva Extrema no padrão) são finitos e persistentes.
 * 5. Substituição de titular por reserva elegível (17G):
 *    A alocação pertence à ENTRADA/CARRO do piloto titular. Ao trocar de piloto,
 *    o substituto assume o inventário restante do carro/piloto substituído;
 *    jogos já usados permanecem usados e nenhuma segunda alocação de 20 jogos é gerada.
 */

import type { TireSetItem, TireAllotment } from '@/types/f1'
import { createInitialTireInventory } from '@/lib/f1-tire-system'
import {
  getCanonicalTyreAllocation,
  getCanonicalTireAllotment,
  type CanonicalTyreAllocationRules,
} from '@/services/canonicalTyreAllocationService'
import { hasSprintWeekend } from '@/services/weekendProgressionService'
import { safeLocalStorageSetItem } from '@/services/storageQuotaService'
import { canonicalWeekendTyreBackendService } from '@/services/canonicalWeekendTyreBackendService'

export function getWeekendTireStorageKey(seasonId: string, round: number): string {
  return `apex_gp_tires_${seasonId}_r${round}`
}

/** Cache em memória para resiliência quando o localStorage estiver com QuotaExceeded */
const _memoryWeekendTireData = new Map<string, StoredWeekendTireData>()

export type RecordTyreUsageStatusCode =
  | 'APPLIED'
  | 'INVENTORY_NOT_FOUND'
  | 'SET_NOT_FOUND'
  | 'PERSISTENCE_FAILED'

export interface RecordTyreUsageResult {
  success: boolean
  status: RecordTyreUsageStatusCode
  updatedSet?: TireSetItem
  error?: string
  context?: {
    seasonId: string
    round: number
    driverId: string
    tyreSetId: string
  }
}

export interface StoredWeekendTireData {
  seasonId: string
  round: number
  isSprint: boolean
  allotmentRules: CanonicalTyreAllocationRules
  inventoriesByDriver: Record<string, TireSetItem[]>
  // Mapeamento de herança para pilotos reservas: reserveDriverId -> originalDriverId
  driverAliases?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface ReadWeekendTyresResult {
  data: StoredWeekendTireData | null
  source: 'backend' | 'local' | 'local_migrated' | 'local_migration_failed' | 'none'
  backendError?: string
  migrationError?: string
}

export function validateStoredWeekendTireData(
  payload: any,
  expectedContext?: { seasonId?: string; round?: number },
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!payload || typeof payload !== 'object') {
    errors.push('Payload não é um objeto válido')
    return { valid: false, errors }
  }

  if (typeof payload.seasonId !== 'string' || !payload.seasonId) {
    errors.push('seasonId ausente ou inválido no payload')
  } else if (expectedContext?.seasonId && payload.seasonId !== expectedContext.seasonId) {
    errors.push(
      `Incompatibilidade de temporada: seasonId '${payload.seasonId}', esperado '${expectedContext.seasonId}'`,
    )
  }

  if (typeof payload.round !== 'number' || isNaN(payload.round)) {
    errors.push('round ausente ou inválido no payload')
  } else if (expectedContext?.round !== undefined && payload.round !== expectedContext.round) {
    errors.push(
      `Incompatibilidade de rodada: round '${payload.round}', esperado '${expectedContext.round}'`,
    )
  }

  if (!payload.inventoriesByDriver || typeof payload.inventoriesByDriver !== 'object') {
    errors.push('inventoriesByDriver ausente ou inválido')
  } else {
    for (const [driverId, sets] of Object.entries(payload.inventoriesByDriver)) {
      if (!Array.isArray(sets)) {
        errors.push(`inventoriesByDriver['${driverId}'] não é um array de jogos`)
        break
      }
      for (let i = 0; i < sets.length; i++) {
        const s = sets[i] as any
        if (!s || typeof s !== 'object') {
          errors.push(`Jogo de pneus inválido para piloto '${driverId}' no índice ${i}`)
          break
        }
        if (!s.id && !s.tyreSetId) {
          errors.push(`id/tyreSetId ausente em jogo para piloto '${driverId}' no índice ${i}`)
          break
        }
        if (typeof s.wear === 'number' && (s.wear < 0 || s.wear > 100)) {
          errors.push(`Desgaste fora do intervalo válido [0..100] no piloto '${driverId}'`)
          break
        }
      }
      if (errors.length > 0) break
    }
  }

  return { valid: errors.length === 0, errors }
}

export const canonicalWeekendTyrePersistence = {
  /**
   * STORAGE-QUOTA-01B2-C-MICRO: Leitura preferindo PocketBase com fallback local explícito.
   *
   * Ordem:
   * 1. Consulta primeiro o PocketBase via canonicalWeekendTyreBackendService.readInventory(...)
   * 2. Se houver payload válido no backend, usa esse inventário (backend vence divergência) -> source: backend
   * 3. Se backend responder NOT_FOUND (null), cai para a leitura local atual -> source: local ou none
   * 4. Se backend falhar (ERROR ou payload inválido), erro observável e fallback local explícito -> source: local ou none
   *
   * Regras estritas:
   * - LOAD NÃO ESCREVE: não chama saveInventory, não regravar localStorage, não apaga dados, não regenera.
   * - BACKEND VENCE EM DIVERGÊNCIA: se backend e local existirem e forem diferentes, backend vence sem merge.
   */
  async readWeekendTyresPreferred(
    seasonId: string,
    round: number,
  ): Promise<ReadWeekendTyresResult> {
    const seasonNum = parseInt(String(seasonId).replace(/\D/g, ''), 10) || 1
    const backendContext = {
      careerId: seasonId,
      season: seasonNum,
      round,
      driverId: undefined, // _all para agregado por rodada
    }

    let backendData: StoredWeekendTireData | null = null
    let backendError: string | undefined = undefined

    // 1. Consultar primeiro o PocketBase
    try {
      backendData =
        await canonicalWeekendTyreBackendService.readInventory<StoredWeekendTireData>(
          backendContext,
        )
    } catch (err: any) {
      backendError = err?.message || 'Erro de rede ou indisponibilidade ao consultar PocketBase'
      console.warn(
        `[canonicalWeekendTyrePersistence] Falha ao consultar PocketBase para inventário (${seasonId}, r${round}):`,
        err,
      )
    }

    // 2. Se backend retornou payload, validar
    if (backendData) {
      const validation = validateStoredWeekendTireData(backendData, { seasonId, round })
      if (validation.valid) {
        // Backend válido: backend vence sem merge e sem regravação
        return {
          data: backendData,
          source: 'backend',
        }
      } else {
        const errorMsg = `Payload inválido no PocketBase: ${validation.errors.join('; ')}`
        console.warn('[canonicalWeekendTyrePersistence]', errorMsg)
        backendError = errorMsg
      }
    }

    // 3. Fallback para localStorage local
    const localData = this.readWeekendTireData(seasonId, round)

    let isLocalValid = false
    if (localData) {
      const localValidation = validateStoredWeekendTireData(localData, { seasonId, round })
      if (localValidation.valid) {
        isLocalValid = true
      } else {
        console.warn(
          `[canonicalWeekendTyrePersistence] Local storage contém dados inválidos para (${seasonId}, r${round}): ${localValidation.errors.join('; ')}`,
        )
      }
    }

    // STORAGE-QUOTA-01B2-D: LAZY MIGRATION DO INVENTÁRIO DE PNEUS LOCAL PARA BACKEND
    // Condições estritas para promoção:
    // 1. Backend respondeu NOT_FOUND: backendData === null E NÃO ocorreu erro de rede/backend (backendError === undefined)
    // 2. Local possui inventário válido: isLocalValid === true && localData !== null
    // 3. Se houve erro do backend (backendError definido), NÃO tenta migrar (retorna local normal com fallback explícito)
    const isBackendNotFound = !backendData && !backendError

    if (isLocalValid && localData && isBackendNotFound) {
      try {
        const saveRes = await canonicalWeekendTyreBackendService.saveInventory(
          backendContext,
          localData,
        )

        if (saveRes.success) {
          // STORAGE-QUOTA-01B2-E: Expurgar inventário pesado local somente após confirmação backend
          this.purgeLocalWeekendTires(seasonId, round)
          return {
            data: localData,
            source: 'local_migrated',
          }
        } else {
          const migrationError =
            saveRes.error || 'Falha ao promover inventário de pneus ao PocketBase'
          console.warn(
            `[canonicalWeekendTyrePersistence] Lazy migration falhou ao salvar no backend: ${migrationError}`,
          )
          return {
            data: localData,
            source: 'local_migration_failed',
            backendError: migrationError,
            migrationError,
          }
        }
      } catch (migrationEx: any) {
        const migrationError =
          migrationEx?.message || 'Exceção ao executar lazy migration para o PocketBase'
        console.warn(
          `[canonicalWeekendTyrePersistence] Exceção durante lazy migration: ${migrationError}`,
        )
        return {
          data: localData,
          source: 'local_migration_failed',
          backendError: migrationError,
          migrationError,
        }
      }
    }

    // Se local existe e é válido (mas backend teve erro prévio, ex: BACKEND_ERROR ou payload corrompido)
    if (isLocalValid && localData) {
      return {
        data: localData,
        source: 'local',
        backendError,
      }
    }

    // 4. Nenhum dado válido encontrado (ambos ausentes ou inválidos)
    return {
      data: null,
      source: 'none',
      backendError,
    }
  },

  /**
   * Lê o armazenamento persistente do fim de semana.
   */
  readWeekendTireData(seasonId: string, round: number): StoredWeekendTireData | null {
    const key = getWeekendTireStorageKey(seasonId, round)

    // 1. Se estiver no cache de memória (ex: gravado nesta sessão ou salvo enquanto cota estava cheia)
    const mem = _memoryWeekendTireData.get(key)
    if (mem && mem.inventoriesByDriver && Object.keys(mem.inventoriesByDriver).length > 0) {
      return mem
    }

    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as StoredWeekendTireData
      if (parsed) {
        _memoryWeekendTireData.set(key, parsed)
      }
      return parsed
    } catch (e) {
      console.warn('[canonicalWeekendTyrePersistence] Falha ao ler armazenamento de pneus:', e)
      return null
    }
  },

  /**
   * Limpa o cache em memória (utilizado em testes).
   */
  clearMemoryForTesting(): void {
    _memoryWeekendTireData.clear()
  },

  /**
   * Grava o armazenamento persistente do fim de semana.
   * Resiliente a QuotaExceededError: falha de cota local é capturada e observável,
   * permitindo que o espelhamento no PocketBase prossiga como autoridade canônica.
   * Se o backend confirmar com sucesso real, expurga a cópia pesada local liberando cota.
   */
  writeWeekendTireData(data: StoredWeekendTireData): void {
    const key = getWeekendTireStorageKey(data.seasonId, data.round)
    // Manter sempre disponível em cache de memória ativo
    _memoryWeekendTireData.set(key, data)

    let localSuccess = false
    let isQuotaError = false

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        data.updatedAt = new Date().toISOString()
        safeLocalStorageSetItem(key, JSON.stringify(data), {
          seasonId: data.seasonId,
          currentRound: data.round,
        })
        localSuccess = true
      } catch (e: any) {
        isQuotaError =
          e?.name === 'QuotaExceededError' ||
          e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          e?.code === 22 ||
          e?.code === 1014 ||
          (typeof e?.message === 'string' &&
            (e.message.includes('quota') || e.message.includes('Quota')))

        console.warn(
          `[WeekendTirePersistence] Falha local (${isQuotaError ? 'QUOTA_EXCEEDED' : 'STORAGE_ERROR'}) ao salvar pneus (${data.seasonId}, r${data.round}):`,
          e,
        )
      }
    }

    // 01B2-B / 01B2-E: Espelhamento de escrita viva no PocketBase com expurgo local pós-confirmação.
    // DEVE ser tentado mesmo quando o save local falha por QuotaExceededError.
    try {
      const seasonNum = parseInt(String(data.seasonId).replace(/\D/g, ''), 10) || 1
      canonicalWeekendTyreBackendService
        .saveInventory(
          {
            careerId: data.seasonId,
            season: seasonNum,
            round: data.round,
            driverId: undefined, // _all para agregado por rodada
          },
          data,
        )
        .then((res) => {
          if (res?.success) {
            // STORAGE-QUOTA-01B2-E: Expurgar cópia pesada local somente após sucesso real do backend
            this.purgeLocalWeekendTires(data.seasonId, data.round)
          } else {
            if (!localSuccess) {
              console.error(
                `[WeekendTirePersistence] Ambos local e backend falharam ao salvar pneus para (${data.seasonId}, r${data.round}). Backend error: ${res?.error || 'sem sucesso'}. Operando em modo memória degradado.`,
              )
            } else {
              console.warn(
                `[WeekendTirePersistence] Backend não confirmou save (${res?.error || 'sem sucesso'}), preservando cópia local para (${data.seasonId}, r${data.round})`,
              )
            }
          }
        })
        .catch((err) => {
          if (!localSuccess) {
            console.error(
              `[WeekendTirePersistence] Ambos local e backend falharam ao salvar pneus para (${data.seasonId}, r${data.round}). Exceção backend:`,
              err,
            )
          } else {
            console.warn(
              '[WeekendTirePersistence] Falha assíncrona ao espelhar pneus no PocketBase:',
              err,
            )
          }
        })
    } catch (mirrorErr) {
      if (!localSuccess) {
        console.error(
          `[WeekendTirePersistence] Falha ao disparar espelho PocketBase e escrita local havia falhado:`,
          mirrorErr,
        )
      } else {
        console.warn('[WeekendTirePersistence] Falha ao disparar espelho PocketBase:', mirrorErr)
      }
    }
  },

  /**
   * STORAGE-QUOTA-01B2-E: Expurgar o inventário pesado do localStorage para a mesma identidade lógica.
   * Chamado estritamente após confirmação real (success === true) do backend (saveInventory).
   * Não afeta outras carreiras, temporadas ou rodadas.
   */
  purgeLocalWeekendTires(seasonId: string, round: number): void {
    const key = getWeekendTireStorageKey(seasonId, round)
    // Manter o cache de memória íntegro caso a UI precise de leitura síncrona imediata
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.removeItem(key)
    } catch (e) {
      console.warn(
        `[canonicalWeekendTyrePersistence] Falha ao expurgar cópia pesada local de pneus (${seasonId}, r${round}):`,
        e,
      )
    }
  },

  /**
   * Inicializa ou recupera o inventário para os pilotos inscritos.
   * Cria UMA ÚNICA VEZ por evento: se já existir inventário para um driverId, mantém intacto.
   * Se um piloto titular for substituído por reserva, o reserva herda o inventário existente.
   */
  getOrCreateWeekendInventories(params: {
    seasonId: string
    round: number
    driverIds: string[]
    primaryDriverIds?: string[] // Pilotos titulares da vaga
  }): Record<string, TireSetItem[]> {
    const { seasonId, round, driverIds, primaryDriverIds = [] } = params
    const isSprint = hasSprintWeekend(round)
    const rules = getCanonicalTyreAllocation(round, isSprint)

    let stored = this.readWeekendTireData(seasonId, round)

    if (!stored) {
      stored = {
        seasonId,
        round,
        isSprint,
        allotmentRules: rules,
        inventoriesByDriver: {},
        driverAliases: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    let modified = false

    for (let i = 0; i < driverIds.length; i++) {
      const dId = driverIds[i]
      if (!dId) continue

      // Se o piloto já possui inventário gravado, nunca regera
      if (stored.inventoriesByDriver[dId] && stored.inventoriesByDriver[dId].length > 0) {
        continue
      }

      // Regra 17G (Substituição de titular por reserva):
      // A alocação de 20 jogos (ou 19 no Sprint) pertence à inscrição do carro/assento na etapa,
      // e NUNCA à pessoa física do piloto individualmente como um bônus.
      // Se um piloto titular for substituído pelo piloto reserva (por lesão, decisão técnica,
      // FP1 de novato ou substituição de contrato), o reserva herda integralmente o inventário
      // restante daquele carro/assento. Todos os jogos já rodados, com desgaste e voltas acumuladas,
      // permanecem inalterados. Nunca é criada uma segunda alocação de 20 jogos para o carro,
      // e a troca de piloto nunca reseta pneus nem reverte jogos gastos para 100%.
      const correspondingPrimaryId = primaryDriverIds[i]
      if (
        correspondingPrimaryId &&
        correspondingPrimaryId !== dId &&
        stored.inventoriesByDriver[correspondingPrimaryId] &&
        stored.inventoriesByDriver[correspondingPrimaryId].length > 0
      ) {
        // O reserva assume o inventário restante do carro/titular substituído (sem criar nova alocação!)
        stored.inventoriesByDriver[dId] = stored.inventoriesByDriver[correspondingPrimaryId].map(
          (t) => ({
            ...t,
            driverId: dId, // aponta para o piloto ativo mas preserva id físico, tyreSetId, desgaste e voltas
          }),
        )
        stored.driverAliases = stored.driverAliases || {}
        stored.driverAliases[dId] = correspondingPrimaryId
        modified = true
        continue
      }

      // Se for primeira alocação deste piloto neste GP:
      // Cria exatamente a distribuição canônica (20 jogos no normal, 19 no sprint)
      stored.inventoriesByDriver[dId] = createInitialTireInventory(dId, { isSprint, round })
      modified = true
    }

    if (modified) {
      try {
        this.writeWeekendTireData(stored)
      } catch (writeErr) {
        console.warn(
          `[canonicalWeekendTyrePersistence] Exceção inesperada capturada em writeWeekendTireData durante getOrCreateWeekendInventories (${seasonId}, r${round}):`,
          writeErr,
        )
      }
    }

    return stored.inventoriesByDriver
  },

  /**
   * Atualiza o inventário de um piloto específico após uso em TL, Quali ou Corrida.
   */
  updateDriverInventory(
    seasonId: string,
    round: number,
    driverId: string,
    updatedSets: TireSetItem[],
  ): void {
    let stored = this.readWeekendTireData(seasonId, round)
    if (!stored) {
      const isSprint = hasSprintWeekend(round)
      stored = {
        seasonId,
        round,
        isSprint,
        allotmentRules: getCanonicalTyreAllocation(round, isSprint),
        inventoriesByDriver: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    stored.inventoriesByDriver[driverId] = updatedSets
    try {
      this.writeWeekendTireData(stored)
    } catch (writeErr) {
      console.warn(
        `[canonicalWeekendTyrePersistence] Exceção inesperada capturada em writeWeekendTireData durante updateDriverInventory (${seasonId}, r${round}, ${driverId}):`,
        writeErr,
      )
    }
  },

  /**
   * Atualiza múltiplos inventários de uma vez (ex: após sessão completa).
   */
  updateAllInventories(
    seasonId: string,
    round: number,
    inventories: Record<string, TireSetItem[]>,
  ): void {
    let stored = this.readWeekendTireData(seasonId, round)
    if (!stored) {
      const isSprint = hasSprintWeekend(round)
      stored = {
        seasonId,
        round,
        isSprint,
        allotmentRules: getCanonicalTyreAllocation(round, isSprint),
        inventoriesByDriver: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    stored.inventoriesByDriver = {
      ...stored.inventoriesByDriver,
      ...inventories,
    }
    try {
      this.writeWeekendTireData(stored)
    } catch (writeErr) {
      console.warn(
        `[canonicalWeekendTyrePersistence] Exceção inesperada capturada em writeWeekendTireData durante updateAllInventories (${seasonId}, r${round}):`,
        writeErr,
      )
    }
  },

  /**
   * Registra voltas e desgaste em um jogo de pneus específico e persiste.
   * Retorna resultado discriminado e tipado RecordTyreUsageResult.
   */
  recordTyreUsage(params: {
    seasonId: string
    round: number
    driverId: string
    tyreSetId: string
    lapsAdded: number
    finalWearPct: number
  }): RecordTyreUsageResult {
    const { seasonId, round, driverId, tyreSetId, lapsAdded, finalWearPct } = params
    const context = { seasonId, round, driverId, tyreSetId }

    const stored = this.readWeekendTireData(seasonId, round)
    if (!stored || !stored.inventoriesByDriver || !stored.inventoriesByDriver[driverId]) {
      console.warn(
        `[canonicalWeekendTyrePersistence] recordTyreUsage: inventário não encontrado para piloto ${driverId} na rodada ${round} (seasonId=${seasonId}, tyreSetId=${tyreSetId})`,
      )
      return {
        success: false,
        status: 'INVENTORY_NOT_FOUND',
        error: `Inventário de pneus não encontrado para o piloto ${driverId} (seasonId=${seasonId}, round=${round})`,
        context,
      }
    }

    const sets = stored.inventoriesByDriver[driverId]
    const targetSet = sets.find((s) => s.id === tyreSetId || s.tyreSetId === tyreSetId)
    if (!targetSet) {
      console.warn(
        `[canonicalWeekendTyrePersistence] recordTyreUsage: jogo de pneus ${tyreSetId} não encontrado no inventário do piloto ${driverId} na rodada ${round}`,
      )
      return {
        success: false,
        status: 'SET_NOT_FOUND',
        error: `Jogo de pneus ${tyreSetId} não encontrado no inventário do piloto ${driverId}`,
        context,
      }
    }

    targetSet.lapsUsed = (targetSet.lapsUsed || 0) + lapsAdded
    targetSet.wear = Math.min(100, Math.max(targetSet.wear || 0, Math.round(finalWearPct)))
    targetSet.condition = Math.max(0, 100 - targetSet.wear)
    if (targetSet.wear >= 90) {
      targetSet.status = 'usado'
    } else if (targetSet.lapsUsed > 0) {
      targetSet.status = targetSet.isFitted ? 'instalado' : 'usado'
    }

    try {
      this.writeWeekendTireData(stored)
    } catch (e: any) {
      console.warn(
        `[canonicalWeekendTyrePersistence] recordTyreUsage: falha ao persistir inventário após uso do jogo ${tyreSetId}:`,
        e,
      )
      return {
        success: false,
        status: 'PERSISTENCE_FAILED',
        error: `Falha ao persistir dados do inventário: ${e?.message || String(e)}`,
        context,
      }
    }

    return {
      success: true,
      status: 'APPLIED',
      updatedSet: targetSet,
      context,
    }
  },
}
