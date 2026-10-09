/**
 * canonicalCareerPersistenceService.ts
 *
 * FW2.1E-G — PERSISTÊNCIA DE CARREIRA APÓS RESULTADO OFICIAL
 * (race_results + estatísticas acumuladas de pilotos + idempotência + journal)
 *
 * PRINCÍPIO DE OURO (verbatim):
 * "O fluxo deve ser: CORRIDA TERMINA → OFICIALIZAR RESULTADO → OfficialRaceResult congelado →
 *  PERSISTIR NA CARREIRA → ATUALIZAR ACUMULADOS.
 *  Nunca: estado vivo da corrida → atualizar carreira diretamente.
 *  A carreira só é atualizada a partir de um OfficialRaceResult válido."
 * "O RESULTADO OFICIAL É O FATO. A PERSISTÊNCIA DE CARREIRA APENAS REGISTRA E ACUMULA ESSE FATO.
 *  ELA NUNCA RECALCULA O QUE ACONTECEU NA PISTA."
 */

import type { OfficialRaceResult, OfficialRaceResultEntry } from '@/types/canonical-race-v2'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { driverBase2026Service } from '@/services/driverBase2026Service'
import { driverMoraleService } from '@/services/driverMoraleService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import pb from '@/lib/pocketbase/client'

export const CANONICAL_CAREER_RACE_RESULT_PREFIX = 'race_result'
export const CANONICAL_CAREER_APPLY_JOURNAL_PREFIX = 'career_apply_result'

export type CareerApplicationStatus = 'PENDING' | 'APPLYING' | 'COMPLETE' | 'FAILED'

/**
 * Registro individual de race_result persistido na carreira.
 */
export interface CanonicalPersistedRaceResult {
  id: string
  careerId: string
  seasonId: string
  season: number
  round: number
  eventId: string
  circuitId: string
  officialRaceResultId: string
  checksum: string
  winnerDriverId: string
  poleDriverId: string
  fastestLapDriverId?: string
  officializedAt: string
  createdAt: string
  entries: OfficialRaceResultEntry[]
  playerEntries: [OfficialRaceResultEntry, OfficialRaceResultEntry]
  snapshot: OfficialRaceResult
}

/**
 * Journal de controle de transação e atomicidade / idempotência.
 */
export interface CareerApplicationJournal {
  key: string
  careerId: string
  season: number
  round: number
  officialRaceResultId: string
  checksum: string
  status: CareerApplicationStatus
  appliedDriverIds: string[]
  totalEntries: number
  version?: number
  startedAt: string
  completedAt?: string
  lastError?: string
}

/**
 * Relatório da auditoria de persistência de carreira.
 */
export interface CareerPersistenceAuditReport {
  isValid: boolean
  careerId: string
  season: number
  round: number
  raceResultFound: boolean
  raceResultKey: string
  checksumValid: boolean
  expectedEntries: number
  foundEntries: number
  uniqueDriverIds: boolean
  duplicateIncrementsDetected: boolean
  applicationStatus: CareerApplicationStatus
  allDriversProcessed: boolean
  errors: string[]
}

export class CanonicalCareerPersistenceService {
  /**
   * Constrói a chave lógica única canônica para o race_result da carreira:
   * race_result_{careerId}_{seasonId}_{round}
   */
  public buildRaceResultKey(
    careerId: string,
    season: number | string,
    round: number,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): string {
    const sId = typeof season === 'number' ? `s${season}` : season
    const variantTag =
      raceVariant === 'SPRINT_RACE' ? '_sprint' : raceVariant === 'MAIN_RACE' ? '_main' : ''
    return `${CANONICAL_CAREER_RACE_RESULT_PREFIX}_${careerId}_${sId}_${round}${variantTag}`
  }

  /**
   * Constrói a chave canônica do Journal de Aplicação:
   * career_apply_result_{careerId}_{seasonId}_{round}[_sprint|_main]
   */
  public buildApplyJournalKey(
    careerId: string,
    season: number | string,
    round: number,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): string {
    const sId = typeof season === 'number' ? `s${season}` : season
    const variantTag =
      raceVariant === 'SPRINT_RACE' ? '_sprint' : raceVariant === 'MAIN_RACE' ? '_main' : ''
    return `${CANONICAL_CAREER_APPLY_JOURNAL_PREFIX}_${careerId}_${sId}_${round}${variantTag}`
  }

  /**
   * Obtém o Journal de Aplicação para uma carreira, temporada, rodada e variante opcional.
   * Suporta fallback para a chave legada única para não quebrar saves antigos.
   */
  public getApplicationJournal(
    careerId: string,
    season: number | string,
    round: number,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): CareerApplicationJournal | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    // 1. Tenta a chave específica da variante
    const key = this.buildApplyJournalKey(careerId, season, round, raceVariant)
    let raw = window.localStorage.getItem(key)
    // 2. Se não encontrar e raceVariant não for especificada ou for MAIN_RACE, tenta chave legada
    if (!raw && raceVariant === 'MAIN_RACE') {
      const legacyKey = this.buildApplyJournalKey(careerId, season, round)
      raw = window.localStorage.getItem(legacyKey)
    }
    if (!raw) return null
    try {
      return JSON.parse(raw) as CareerApplicationJournal
    } catch {
      return null
    }
  }

  /**
   * Salva o Journal de Aplicação em cache local (opcional / tolerante a cota).
   */
  public saveApplicationJournal(
    journal: CareerApplicationJournal,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): void {
    const key = this.buildApplyJournalKey(
      journal.careerId,
      journal.season,
      journal.round,
      raceVariant,
    )
    const slimJournal: CareerApplicationJournal = {
      key: journal.key || key,
      careerId: journal.careerId,
      season: journal.season,
      round: journal.round,
      officialRaceResultId: journal.officialRaceResultId,
      checksum: journal.checksum,
      status: journal.status,
      appliedDriverIds: journal.appliedDriverIds || [],
      totalEntries: journal.totalEntries || 0,
      version: journal.version || 1,
      startedAt: journal.startedAt,
      completedAt: journal.completedAt,
      lastError: journal.lastError,
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(slimJournal))
      } catch (quotaErr) {
        console.warn(
          `[CareerPersistence] Falha de cota no localStorage ao salvar journal (cache local: ${key}):`,
          quotaErr,
        )
      }
    }
  }

  /**
   * Busca o journal de aplicação de forma autoritativa no backend PocketBase.
   * Lança erro caso a conexão ou consulta falhe (NÃO trata erro como ausência).
   * Retorna explicitamente null quando o registro está ausente no backend.
   * O localStorage funciona estritamente como cache opcional, NUNCA como autoridade ou substituto.
   */
  public async getApplicationJournalFromBackend(
    careerId: string,
    season: number | string,
    round: number,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): Promise<CareerApplicationJournal | null> {
    const key = this.buildApplyJournalKey(careerId, season, round, raceVariant)
    const legacyKey =
      raceVariant === 'MAIN_RACE' ? this.buildApplyJournalKey(careerId, season, round) : null

    if (!pb?.collection) {
      throw new Error(
        `[CareerPersistence] Cliente PocketBase indisponível para consulta remota do journal: ${key}`,
      )
    }

    try {
      const filter = legacyKey
        ? `journal_key = "${key}" || journal_key = "${legacyKey}" || (career_id = "${careerId}" && round = ${round})`
        : `journal_key = "${key}" || (career_id = "${careerId}" && round = ${round})`

      const records = await pb.collection('canonical_career_apply_journals').getFullList({
        filter,
        sort: '-created',
      })

      if (records && records.length > 0) {
        const matched =
          records.find((r: any) => {
            if (raceVariant === 'SPRINT_RACE') {
              return r.journal_key?.endsWith('_sprint') || r.race_variant === 'SPRINT_RACE'
            }
            if (raceVariant === 'MAIN_RACE') {
              return !r.journal_key?.endsWith('_sprint')
            }
            return true
          }) || records[0]

        if (matched) {
          const backendJournal: CareerApplicationJournal = {
            key: matched.journal_key || key,
            careerId: matched.career_id,
            season: matched.season,
            round: matched.round,
            officialRaceResultId: matched.official_race_result_id,
            checksum: matched.result_hash,
            status: matched.status as CareerApplicationStatus,
            appliedDriverIds: Array.isArray(matched.applied_driver_ids)
              ? matched.applied_driver_ids
              : [],
            totalEntries: matched.total_entries || 0,
            version: matched.version || 1,
            startedAt: matched.started_at,
            completedAt: matched.completed_at || undefined,
            lastError: matched.last_error || undefined,
          }
          // Atualizar cache local silenciosamente como cache passivo (falhas de localStorage são ignoradas)
          try {
            this.saveApplicationJournal(backendJournal, raceVariant)
          } catch {
            /* ignore cache write fail */
          }
          return backendJournal
        }
      }
      // Registro não encontrado no backend: retornar ausência de forma explícita
      return null
    } catch (err: any) {
      if (err?.status === 404) {
        return null
      }
      // Se der erro no backend, relançar; NUNCA mascarar falha remota como ausência ou retornar cache local
      throw err
    }
  }

  /**
   * Salva o journal de aplicação de forma autoritativa e aguardada no backend PocketBase.
   * Protege contra sobrescrita por versão desatualizada e previne regressão de progresso já confirmado.
   * Conflitos de hash ou officialRaceResultId disparam exceção explícita.
   * Propaga falhas de gravação remota; atualizações de cache local são puramente secundárias.
   */
  public async saveApplicationJournalToBackend(
    journal: CareerApplicationJournal,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): Promise<{ success: boolean; recordId?: string; error?: string }> {
    if (!journal) {
      throw new Error('[CareerPersistence] Journal nulo para salvar no backend.')
    }

    const key =
      journal.key ||
      this.buildApplyJournalKey(journal.careerId, journal.season, journal.round, raceVariant)

    if (!pb?.collection) {
      throw new Error(
        `[CareerPersistence] Cliente PocketBase indisponível para gravação remota do journal: ${key}`,
      )
    }

    // Tentativa de cache local preventivo antes da chamada remota (falhas de cache JAMAIS impedem a gravação remota)
    try {
      this.saveApplicationJournal(journal, raceVariant)
    } catch {
      /* ignore cache write fail */
    }

    // 1. Buscar registro existente pelo journal_key
    let existingRecord: any = null
    try {
      const found = await pb
        .collection('canonical_career_apply_journals')
        .getFirstListItem(`journal_key = "${key}"`)
      if (found?.id) {
        existingRecord = found
      }
    } catch (err: any) {
      if (err?.status !== 404) {
        // Se foi erro que não 404, propagar
        throw err
      }
    }

    // 2. Detecção rigorosa de conflito com resultado/hash incompatível
    if (existingRecord) {
      if (
        existingRecord.official_race_result_id &&
        existingRecord.official_race_result_id !== journal.officialRaceResultId
      ) {
        const conflictMsg = `Conflito de journal no backend para '${key}': resultado existente possui ID '${existingRecord.official_race_result_id}', mas nova tentativa enviou '${journal.officialRaceResultId}'. Sobrescrita bloqueada.`
        throw new Error(conflictMsg)
      }

      if (
        existingRecord.result_hash &&
        journal.checksum &&
        existingRecord.result_hash !== journal.checksum
      ) {
        const conflictMsg = `Conflito de checksum de resultado no journal backend para '${key}': hash existente '${existingRecord.result_hash}' diverge do novo '${journal.checksum}'. Sobrescrita bloqueada.`
        throw new Error(conflictMsg)
      }

      // Proteção contra sobrescrita por versão desatualizada (Optimistic concurrency / version check)
      const existingVersion = Number(existingRecord.version || 1)
      const incomingVersion = Number(journal.version || 1)
      if (incomingVersion < existingVersion) {
        throw new Error(
          `Conflito de versão desatualizada no journal '${key}': versão do banco (${existingVersion}) é superior à versão enviada (${incomingVersion}). Atualização rejeitada para proteger o progresso.`,
        )
      }

      // Proteção contra regressão de progresso já confirmado:
      // Se o banco já tinha pilotos aplicados, a atualização NÃO pode perder os que já foram confirmados
      const existingApplied: string[] = Array.isArray(existingRecord.applied_driver_ids)
        ? existingRecord.applied_driver_ids
        : []
      const incomingApplied: string[] = Array.isArray(journal.appliedDriverIds)
        ? journal.appliedDriverIds
        : []

      // Combinar para garantir que nunca há perda de pilotos já aplicados
      const mergedApplied = Array.from(new Set([...existingApplied, ...incomingApplied]))
      journal.appliedDriverIds = mergedApplied

      // Se o banco já estava COMPLETE, não permitir regredir para PENDING/APPLYING
      if (existingRecord.status === 'COMPLETE' && journal.status !== 'COMPLETE') {
        journal.status = 'COMPLETE'
      }

      const nextVersion = Math.max(existingVersion + 1, incomingVersion)

      const payload = {
        journal_key: key,
        career_id: journal.careerId,
        season: journal.season,
        round: journal.round,
        race_variant: raceVariant || (key.endsWith('_sprint') ? 'SPRINT_RACE' : 'MAIN_RACE'),
        official_race_result_id: journal.officialRaceResultId,
        result_hash: journal.checksum,
        status: journal.status,
        applied_driver_ids: journal.appliedDriverIds,
        total_entries: journal.totalEntries || 0,
        version: nextVersion,
        started_at: journal.startedAt || existingRecord.started_at,
        completed_at: journal.completedAt || existingRecord.completed_at || '',
        last_error: journal.lastError || '',
      }

      try {
        const updated = await pb
          .collection('canonical_career_apply_journals')
          .update(existingRecord.id, payload)
        journal.version = nextVersion
        // Sincronizar cache local após sucesso remoto; eventual falha de cache JAMAIS transforma o sucesso em erro
        try {
          this.saveApplicationJournal(journal, raceVariant)
        } catch {
          /* ignore cache write fail */
        }
        return { success: true, recordId: updated.id }
      } catch (updateErr: any) {
        console.error('[CareerPersistence] Falha ao atualizar journal no PB:', updateErr)
        throw updateErr
      }
    }

    // 3. Criar novo registro
    const initialVersion = journal.version || 1
    const createPayload = {
      journal_key: key,
      career_id: journal.careerId,
      season: journal.season,
      round: journal.round,
      race_variant: raceVariant || (key.endsWith('_sprint') ? 'SPRINT_RACE' : 'MAIN_RACE'),
      official_race_result_id: journal.officialRaceResultId,
      result_hash: journal.checksum,
      status: journal.status,
      applied_driver_ids: journal.appliedDriverIds || [],
      total_entries: journal.totalEntries || 0,
      version: initialVersion,
      started_at: journal.startedAt || new Date().toISOString(),
      completed_at: journal.completedAt || '',
      last_error: journal.lastError || '',
    }

    try {
      const created = await pb.collection('canonical_career_apply_journals').create(createPayload)
      journal.version = initialVersion
      // Sincronizar cache local após sucesso remoto; eventual falha de cache JAMAIS transforma o sucesso em erro
      try {
        this.saveApplicationJournal(journal, raceVariant)
      } catch {
        /* ignore cache write fail */
      }
      return { success: true, recordId: created.id }
    } catch (createErr: any) {
      if (createErr?.status === 400 || createErr?.message?.includes('validation_not_unique')) {
        // Tentar obter o registro concorrente
        try {
          const rec = await pb
            .collection('canonical_career_apply_journals')
            .getFirstListItem(`journal_key = "${key}"`)
          if (rec?.id) {
            return { success: true, recordId: rec.id }
          }
        } catch {
          /* intentionally ignored */
        }
      }
      console.error('[CareerPersistence] Falha ao criar journal no PB:', createErr)
      throw createErr
    }
  }

  /**
   * Lê o race_result persistido na carreira.
   * Suporta compatibilidade legada: se MAIN_RACE e chave específica não existir, lê chave única legada.
   */
  public getPersistedRaceResult(
    careerId: string,
    season: number | string,
    round: number,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): CanonicalPersistedRaceResult | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const key = this.buildRaceResultKey(careerId, season, round, raceVariant)
    let raw = window.localStorage.getItem(key)
    if (!raw && (raceVariant === 'MAIN_RACE' || raceVariant === undefined)) {
      const legacyKey = this.buildRaceResultKey(careerId, season, round)
      raw = window.localStorage.getItem(legacyKey)
    }
    if (!raw) {
      // Se não estiver no localStorage por cota, mas tivermos o OfficialRaceResult no canonicalRaceResultService
      const off = canonicalRaceResultService.getOfficialRaceResult(
        careerId,
        season,
        round,
        raceVariant,
      )
      if (off) {
        return {
          id: key,
          careerId,
          seasonId: typeof season === 'number' ? `s${season}` : season,
          season:
            typeof season === 'number'
              ? season
              : parseInt(String(season).replace(/\D/g, ''), 10) || 2026,
          round,
          eventId: `event_${careerId}_s${season}_r${round}${raceVariant === 'SPRINT_RACE' ? '_sprint' : ''}`,
          circuitId: off.circuitId,
          officialRaceResultId: off.officialResultId,
          checksum: off.resultHash,
          winnerDriverId: off.winnerDriverId,
          poleDriverId: off.poleDriverId,
          fastestLapDriverId: off.fastestLapDriverId,
          officializedAt: off.officializedAt,
          createdAt: off.officializedAt,
          entries: off.entries,
          playerEntries: off.playerEntries,
          snapshot: off,
        }
      }
      return null
    }
    try {
      return JSON.parse(raw) as CanonicalPersistedRaceResult
    } catch {
      return null
    }
  }

  /**
   * Salva o race_result canônico.
   */
  public savePersistedRaceResult(
    record: CanonicalPersistedRaceResult,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    const variant = raceVariant || record.snapshot?.raceVariant
    const key = this.buildRaceResultKey(record.careerId, record.season, record.round, variant)
    try {
      window.localStorage.setItem(key, JSON.stringify(record))
    } catch (e) {
      console.warn(
        '[CareerPersistence] Falha de cota no localStorage ao salvar race_result (cache local):',
        e,
      )
    }
  }

  /**
   * Verifica se o resultado já está completamente persistido e registrado na carreira (versão síncrona / cache local).
   */
  public isResultRegistered(
    careerId: string,
    season: number | string,
    round: number,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): boolean {
    const journal = this.getApplicationJournal(careerId, season, round, raceVariant)
    if (!journal || journal.status !== 'COMPLETE') return false
    const res = this.getPersistedRaceResult(careerId, season, round, raceVariant)
    // Se o journal está completo, mesmo que o resultado em localStorage tenha sofrido eviction de cota,
    // o registro é considerado concluído se journal estiver COMPLETE
    return res !== null || journal.status === 'COMPLETE'
  }

  /**
   * Verifica de forma assíncrona e autoritativa no backend se o resultado e o journal estão COMPLETE.
   * Não confia exclusivamente no localStorage; consulta o PocketBase.
   * Se a consulta falhar (erro de rede/servidor), propaga o erro para o chamador (não assume falso silenciosamente).
   */
  public async isResultRegisteredAsync(
    careerId: string,
    season: number | string,
    round: number,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): Promise<boolean> {
    const journal = await this.getApplicationJournalFromBackend(
      careerId,
      season,
      round,
      raceVariant,
    )
    if (!journal || journal.status !== 'COMPLETE') {
      return false
    }
    // Requisito 3: Para COMPLETE ser válido, deve haver progresso confirmado de todos os pilotos (ou entries esperadas)
    if (journal.totalEntries > 0 && journal.appliedDriverIds.length < journal.totalEntries) {
      return false
    }
    return true
  }

  /**
   * Registra e persiste o OfficialRaceResult na carreira e atualiza acumulados dos pilotos.
   *
   * Idempotente, atômico com journal de recuperação de falha parcial, auditável e isolado.
   *
   * Opções:
   * - simulateFailureAfterIndex: Permite injetar falha forçada após processar N pilotos (para testes de robustez)
   */
  public registerOfficialRaceResultInCareer(
    officialResult: OfficialRaceResult,
    options?: {
      simulateFailureAfterIndex?: number
      requireBackendSync?: boolean
    },
  ): {
    success: boolean
    alreadyRegistered: boolean
    persistedResult: CanonicalPersistedRaceResult | null
    journal: CareerApplicationJournal
    error?: string
  } {
    return this.registerOfficialRaceResultInCareerSync(officialResult, options)
  }

  public registerOfficialRaceResultInCareerSync(
    officialResult: OfficialRaceResult,
    options?: {
      simulateFailureAfterIndex?: number
      requireBackendSync?: boolean
    },
  ): {
    success: boolean
    alreadyRegistered: boolean
    persistedResult: CanonicalPersistedRaceResult | null
    journal: CareerApplicationJournal
    error?: string
  } {
    if (!officialResult) {
      throw new Error('[CareerPersistence] OfficialRaceResult nulo ou indefinido.')
    }

    const { careerId, season, round, raceVariant } = officialResult
    const resultKey = this.buildRaceResultKey(careerId, season, round, raceVariant)
    const journalKey = this.buildApplyJournalKey(careerId, season, round, raceVariant)

    // 1. CHECKSUM OBRIGATÓRIO (Requisito 7)
    // Se o snapshot foi alterado depois da oficialização, bloquear a aplicação.
    const isIntegrityValid = canonicalRaceResultService.verifyResultIntegrity(officialResult)
    if (!isIntegrityValid) {
      const errMsg = 'Resultado oficial inválido ou alterado após oficialização.'
      let failJournal = this.getApplicationJournal(careerId, season, round, raceVariant)
      if (!failJournal) {
        failJournal = {
          key: journalKey,
          careerId,
          season,
          round,
          officialRaceResultId: officialResult.officialResultId,
          checksum: officialResult.resultHash,
          status: 'FAILED',
          appliedDriverIds: [],
          totalEntries: officialResult.entries.length,
          startedAt: new Date().toISOString(),
          lastError: errMsg,
        }
      } else {
        failJournal.status = 'FAILED'
        failJournal.lastError = errMsg
      }
      this.saveApplicationJournal(failJournal, raceVariant)
      return {
        success: false,
        alreadyRegistered: false,
        persistedResult: null,
        journal: failJournal,
        error: errMsg,
      }
    }

    // 2. IDEMPOTÊNCIA COMPLETA (Requisito 5) E CHECAGEM DE CONFLITO
    const existingJournal = this.getApplicationJournal(careerId, season, round, raceVariant)
    const existingResult = this.getPersistedRaceResult(careerId, season, round, raceVariant)

    // Se já existe registro persistido ou journal com identificador ou checksum diferente: CONFLITO!
    // NUNCA sobrescrever em silêncio resultado conflitante para a mesma prova.
    if (
      existingJournal &&
      existingJournal.officialRaceResultId &&
      existingJournal.officialRaceResultId !== officialResult.officialResultId
    ) {
      const conflictMsg = `Conflito de resultado oficial detectado para ${careerId} s${season} r${round}: já existe prova com ID '${existingJournal.officialRaceResultId}', mas recebido '${officialResult.officialResultId}'. Sobrescrita bloqueada.`
      console.warn('[CareerPersistence]', conflictMsg)
      return {
        success: false,
        alreadyRegistered: false,
        persistedResult: existingResult,
        journal: existingJournal,
        error: conflictMsg,
      }
    }

    if (
      existingResult &&
      existingResult.officialRaceResultId &&
      existingResult.officialRaceResultId !== officialResult.officialResultId
    ) {
      const conflictMsg = `Conflito de race_result detectado para ${careerId} s${season} r${round}: ID existente '${existingResult.officialRaceResultId}' diverge de '${officialResult.officialResultId}'. Sobrescrita bloqueada.`
      console.warn('[CareerPersistence]', conflictMsg)
      return {
        success: false,
        alreadyRegistered: false,
        persistedResult: existingResult,
        journal: existingJournal || {
          key: journalKey,
          careerId,
          season,
          round,
          officialRaceResultId: officialResult.officialResultId,
          checksum: officialResult.resultHash,
          status: 'FAILED',
          appliedDriverIds: [],
          totalEntries: officialResult.entries.length,
          startedAt: new Date().toISOString(),
          lastError: conflictMsg,
        },
        error: conflictMsg,
      }
    }

    // Se journal está COMPLETE: sucesso idempotente sem duplicar (mesmo se existingResult sofreu quota eviction)
    if (existingJournal && existingJournal.status === 'COMPLETE') {
      return {
        success: true,
        alreadyRegistered: true,
        persistedResult: existingResult || null,
        journal: existingJournal,
      }
    }

    // 3. RECUPERAR OU INICIAR JOURNAL (Requisito 6: PENDING → APPLYING → COMPLETE → FAILED)
    const journal: CareerApplicationJournal = existingJournal || {
      key: journalKey,
      careerId,
      season,
      round,
      officialRaceResultId: officialResult.officialResultId,
      checksum: officialResult.resultHash,
      status: 'PENDING',
      appliedDriverIds: [],
      totalEntries: officialResult.entries.length,
      startedAt: new Date().toISOString(),
    }

    journal.status = 'APPLYING'
    this.saveApplicationJournal(journal, raceVariant)

    // 4. PERSISTIR REGISTRO CANÔNICO race_results (Requisito 2)
    // Se ainda não existir ou for retry, assegura registro fiel do snapshot oficial
    let persistedRecord = existingResult
    if (!persistedRecord) {
      // Limpeza de campos desnecessários no snapshot para economia estrita de cota
      const leanSnapshot: OfficialRaceResult = {
        ...officialResult,
      }
      persistedRecord = {
        id: resultKey,
        careerId,
        seasonId: `s${season}`,
        season,
        round,
        eventId: `event_${careerId}_s${season}_r${round}${raceVariant === 'SPRINT_RACE' ? '_sprint' : ''}`,
        circuitId: officialResult.circuitId,
        officialRaceResultId: officialResult.officialResultId,
        checksum: officialResult.resultHash,
        winnerDriverId: officialResult.winnerDriverId,
        poleDriverId: officialResult.poleDriverId,
        fastestLapDriverId: officialResult.fastestLapDriverId,
        officializedAt: officialResult.officializedAt,
        createdAt: new Date().toISOString(),
        entries: officialResult.entries,
        playerEntries: officialResult.playerEntries,
        snapshot: leanSnapshot,
      }
      this.savePersistedRaceResult(persistedRecord, raceVariant)
    }

    // 5. ATUALIZAR ACUMULADOS DOS PILOTOS (Requisito 4 e 6)
    // Usar conjunto rastreado de pilotos já aplicados para tolerância total a falha parcial.
    const appliedSet = new Set<string>(journal.appliedDriverIds || [])

    try {
      const entries = officialResult.entries
      for (let i = 0; i < entries.length; i++) {
        // Simulação de falha parcial para testes
        if (
          options?.simulateFailureAfterIndex !== undefined &&
          i === options.simulateFailureAfterIndex
        ) {
          throw new Error(
            `[Simulação de Falha Parcial] Interrupção forçada após processar índice ${i}`,
          )
        }

        const entry = entries[i]
        const driverId = entry.driverId

        // Se este piloto já foi processado nesta transação/journal, pular estritamente
        if (appliedSet.has(driverId)) {
          continue
        }

        // Semânticas canônicas obrigatórias:
        // - raceStarts: +1 só para quem efetivamente iniciou (não contar DNS)
        const isDns = (entry.status as any) === 'dns'
        const deltaRaceStarts = isDns ? 0 : 1

        // - wins: +1 somente se finalPosition === 1
        const deltaWins = entry.finalPosition === 1 ? 1 : 0

        // - podiums: +1 para P1/P2/P3
        const deltaPodiums = entry.finalPosition >= 1 && entry.finalPosition <= 3 ? 1 : 0

        // - poles: +1 se for o poleDriverId do snapshot oficial
        const deltaPoles = officialResult.poleDriverId === driverId ? 1 : 0

        // - fastestLaps: +1 se for o fastestLapDriverId
        const deltaFastestLaps =
          officialResult.fastestLapDriverId && officialResult.fastestLapDriverId === driverId
            ? 1
            : 0

        // - points: incrementar pela soma de pointsAwarded do snapshot (sem recalcular)
        const deltaPoints = entry.pointsAwarded || 0

        // - dnfs: +1 quando entry possuir status de abandono
        const isDnf = entry.dnf || entry.status === 'dnf'
        const deltaDnfs = isDnf ? 1 : 0

        // - lapsCompleted: += entry.lapsCompleted exatamente como congelado
        const deltaLapsCompleted = entry.lapsCompleted || 0

        // - pitStops: += entry.pitStops
        const deltaPitStops = entry.pitStops || 0

        // - positionsGained: += entry.positionsGainedLost
        const deltaPositionsGained = entry.positionsGainedLost || 0

        // - bestFinish: não usar DNF como melhor resultado numérico se abandonou
        const newFinishPosition = isDnf ? undefined : entry.finalPosition

        // - bestGridPosition: menor número é melhor
        const newGridPosition = entry.gridPosition > 0 ? entry.gridPosition : undefined

        // DRIVER-MORALE-01: Cálculo e persistência canônica da moral por piloto
        // Idempotência estrita garantida pela chave de idempotência (career + season + round + driverId)
        let computedNewMorale: number | undefined
        const currentCareerDriver = driverBase2026Service.getCareerDriver(careerId, driverId)
        const currentMorale = currentCareerDriver?.morale ?? 80

        const isMoraleAlreadyDone = driverMoraleService.isMoraleAlreadyProcessed({
          careerId,
          season,
          round,
          driverId,
        })

        if (!isMoraleAlreadyDone) {
          const moraleCalc = driverMoraleService.calculateDriverMoraleDelta({
            driverId,
            teamId: entry.teamId,
            driverName: entry.driverName,
            teamName: entry.teamName,
            currentMorale,
            finishPosition: entry.finalPosition,
            gridPosition: entry.gridPosition,
            status: entry.status,
            isDnf,
            dnfReason: entry.dnfReason,
            isWinner: entry.finalPosition === 1,
            isPodium: entry.finalPosition >= 1 && entry.finalPosition <= 3,
          })

          computedNewMorale = moraleCalc.afterMorale

          driverMoraleService.markMoraleProcessed(
            {
              careerId,
              season,
              round,
              driverId,
            },
            {
              before: moraleCalc.beforeMorale,
              after: moraleCalc.afterMorale,
              delta: moraleCalc.clampedRaceDelta,
              officializedAt: officialResult.officializedAt,
            },
          )
        }

        driverBase2026Service.updateCareerDriverStats({
          careerId,
          driverId,
          deltaGps: deltaRaceStarts,
          deltaRaceStarts,
          deltaWins,
          deltaPodiums,
          deltaPoles,
          deltaFastestLaps,
          deltaPoints,
          deltaDnfs,
          deltaLapsCompleted,
          deltaPitStops,
          deltaPositionsGained,
          newFinishPosition,
          newGridPosition,
          newMorale: computedNewMorale,
        })

        // Registrar no journal e persistir checkpoint progressivo
        appliedSet.add(driverId)
        journal.appliedDriverIds = Array.from(appliedSet)
        this.saveApplicationJournal(journal, raceVariant)
      }

      // Conclusão com sucesso de todos os pilotos
      journal.status = 'COMPLETE'
      journal.completedAt = new Date().toISOString()
      journal.lastError = undefined
      this.saveApplicationJournal(journal, raceVariant)

      // FW2.1E-H: Gerar snapshot do campeonato após rodada oficial registrada
      try {
        const sNum =
          typeof season === 'number'
            ? season
            : parseInt(String(season).replace(/\D/g, ''), 10) || 2026
        canonicalChampionshipService.processAndPersistRoundChampionship(
          careerId,
          sNum,
          round,
          officialResult.playerTeamId,
        )
      } catch (snapErr) {
        console.warn('[CareerPersistence] Aviso ao gerar snapshot do campeonato:', snapErr)
      }

      // Sincronização assíncrona não bloqueante com PocketBase se houver cliente ativo
      this.syncWithPocketBaseIfAvailable(persistedRecord, journal).catch((e) => {
        console.warn('[CareerPersistence] Sync PocketBase em background:', e)
      })

      return {
        success: true,
        alreadyRegistered: false,
        persistedResult: persistedRecord,
        journal,
      }
    } catch (err: any) {
      journal.status = 'FAILED'
      journal.lastError = err?.message || 'Erro durante a persistência dos pilotos.'
      this.saveApplicationJournal(journal, raceVariant)

      return {
        success: false,
        alreadyRegistered: false,
        persistedResult: persistedRecord,
        journal,
        error: journal.lastError,
      }
    }
  }

  /**
   * Auditoria Canônica da Persistência de Resultado na Carreira (Requisito 12).
   */
  public auditCareerRaceResultPersistence(params: {
    careerId: string
    season: number | string
    round: number
    expectedEntries?: number
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string
  }): CareerPersistenceAuditReport {
    const { careerId, season, round, raceVariant } = params
    const sNum =
      typeof season === 'number' ? season : parseInt(String(season).replace(/\D/g, ''), 10) || 2026
    const errors: string[] = []
    const raceResultKey = this.buildRaceResultKey(careerId, season, round, raceVariant)

    const journal = this.getApplicationJournal(careerId, season, round, raceVariant)
    const persisted = this.getPersistedRaceResult(careerId, season, round, raceVariant)

    if (!journal) {
      errors.push('Journal de aplicação inexistente')
    }
    if (!persisted) {
      errors.push('Registro canônico race_result inexistente')
    }

    const applicationStatus: CareerApplicationStatus = journal?.status || 'PENDING'
    if (applicationStatus !== 'COMPLETE') {
      errors.push(`Status de aplicação incompleto: '${applicationStatus}'`)
    }

    const checksumValid = persisted?.snapshot
      ? canonicalRaceResultService.verifyResultIntegrity(persisted.snapshot)
      : false
    if (!checksumValid) {
      errors.push('Checksum ou integridade do snapshot oficial inválido')
    }

    const entries = persisted?.entries || []
    const expected =
      params.expectedEntries !== undefined ? params.expectedEntries : entries.length || 24
    if (entries.length !== expected) {
      errors.push(
        `Contagem de entradas incorreta: esperado ${expected}, encontrado ${entries.length}`,
      )
    }

    const seenDriverIds = new Set<string>()
    let duplicateDrivers = false
    for (const e of entries) {
      if (seenDriverIds.has(e.driverId)) {
        duplicateDrivers = true
        errors.push(`driverId duplicado nas entradas persistidas: ${e.driverId}`)
      }
      seenDriverIds.add(e.driverId)
    }

    const appliedIds = journal?.appliedDriverIds || []
    const uniqueApplied = new Set(appliedIds)
    const duplicateIncrementsDetected = appliedIds.length !== uniqueApplied.size
    if (duplicateIncrementsDetected) {
      errors.push('Duplicação detectada na lista de pilotos aplicados do journal')
    }

    const allDriversProcessed =
      journal?.appliedDriverIds?.length === entries.length &&
      entries.every((e) => journal?.appliedDriverIds.includes(e.driverId))
    if (!allDriversProcessed) {
      errors.push('Nem todos os pilotos oficiais do snapshot foram registrados pelo journal')
    }

    return {
      isValid: errors.length === 0,
      careerId,
      season: sNum,
      round,
      raceResultFound: !!persisted,
      raceResultKey,
      checksumValid,
      expectedEntries: expected,
      foundEntries: entries.length,
      uniqueDriverIds: !duplicateDrivers,
      duplicateIncrementsDetected,
      applicationStatus,
      allDriversProcessed,
      errors,
    }
  }

  /**
   * Sincroniza o resultado oficial com o backend PocketBase (coleção race_results).
   * Aguardada pelo chamador e com erros propagados com clareza.
   */
  public async syncWithPocketBaseIfAvailable(
    record: CanonicalPersistedRaceResult,
    journal: CareerApplicationJournal,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!pb?.collection) return { success: true }

      const resultKey = record.id
      let existingRecord: any = null

      try {
        const found = await pb
          .collection('race_results')
          .getFirstListItem(
            `result_key = "${resultKey}" || (career_id = "${record.careerId}" && round = ${record.round})`,
          )
        if (found?.id) {
          existingRecord = found
        }
      } catch (_) {
        // Não encontrado ou offline
      }

      // Verificação de conflito no backend: se já existe registro com outro official_race_result_id
      if (
        existingRecord &&
        existingRecord.official_race_result_id &&
        existingRecord.official_race_result_id !== record.officialRaceResultId
      ) {
        const conflictErr = `Conflito de resultado oficial no backend: registro existente possui ID '${existingRecord.official_race_result_id}', mas nova tentativa enviou '${record.officialRaceResultId}'. Sobrescrita bloqueada.`
        console.warn('[CareerPersistence]', conflictErr)
        return { success: false, error: conflictErr }
      }

      const pbPayload = {
        result_key: resultKey,
        career_id: record.careerId,
        round: record.round,
        event_id: record.eventId,
        circuit_id: record.circuitId,
        official_race_result_id: record.officialRaceResultId,
        checksum: record.checksum,
        winner_driver_id: record.winnerDriverId,
        pole_driver_id: record.poleDriverId,
        fastest_lap_driver_id: record.fastestLapDriverId || '',
        officialized_at: record.officializedAt,
        application_status: journal.status,
        result_snapshot: record.snapshot,
      }

      if (existingRecord?.id) {
        try {
          await pb.collection('race_results').update(existingRecord.id, pbPayload)
          return { success: true }
        } catch (updateErr: any) {
          console.warn('[CareerPersistence] Erro ao atualizar race_results no PB:', updateErr)
          return {
            success: false,
            error: updateErr?.message || 'Falha ao atualizar race_results no backend',
          }
        }
      } else {
        // Resolução correta do vínculo de identidade da temporada no PocketBase:
        // Na arquitetura canônica (vide memória e schema), o campo career_id contém o ID da TEMPORADA (seasons),
        // por exemplo '31b0p9k5ygw2sc8'. Não procurar seasons por team_id = careerId.
        let seasonIdPB: string | undefined

        // 1. Verificar diretamente pelo ID da temporada (id = record.careerId)
        if (record.careerId && /^[a-z0-9]{15}$/i.test(record.careerId)) {
          try {
            const s = await pb.collection('seasons').getOne(record.careerId)
            if (s?.id) seasonIdPB = s.id
          } catch {
            /* intentionally ignored */
          }
        }

        // 2. Se não encontrou por getOne, tentar busca por id ou ano correspondente
        if (!seasonIdPB) {
          try {
            const s = await pb
              .collection('seasons')
              .getFirstListItem(`id = "${record.careerId}" || year = ${record.season}`)
            if (s?.id) seasonIdPB = s.id
          } catch {
            /* intentionally ignored */
          }
        }

        // 3. Fallback: primeiro season ativo disponível
        if (!seasonIdPB) {
          try {
            const firstSeason = await pb.collection('seasons').getFirstListItem('')
            if (firstSeason?.id) seasonIdPB = firstSeason.id
          } catch {
            /* intentionally ignored */
          }
        }

        if (seasonIdPB) {
          const winnerEntry = record.entries.find((e) => e.finalPosition === 1) || record.entries[0]
          try {
            await pb.collection('race_results').create({
              ...pbPayload,
              season_id: seasonIdPB,
              position: 1,
              points: winnerEntry?.pointsAwarded || 25,
              fastest_lap: winnerEntry?.fastestLap || false,
            })
            return { success: true }
          } catch (createErr: any) {
            // Conflito de unicidade ou erro concorrente
            if (
              createErr?.status === 400 ||
              createErr?.message?.includes('validation_not_unique')
            ) {
              try {
                const raceConflict = await pb
                  .collection('race_results')
                  .getFirstListItem(`result_key = "${resultKey}"`)
                if (raceConflict?.id) {
                  // Verificar conflito antes de atualizar
                  if (
                    raceConflict.official_race_result_id &&
                    raceConflict.official_race_result_id !== record.officialRaceResultId
                  ) {
                    return {
                      success: false,
                      error: `Conflito de resultado oficial no backend: ID existente '${raceConflict.official_race_result_id}' diverge de '${record.officialRaceResultId}'.`,
                    }
                  }
                  await pb.collection('race_results').update(raceConflict.id, pbPayload)
                  return { success: true }
                }
              } catch (confErr: any) {
                return {
                  success: false,
                  error: confErr?.message || 'Conflito ao salvar race_results no backend',
                }
              }
            } else {
              console.warn('[CareerPersistence] Falha ao criar race_results no PB:', createErr)
              return { success: false, error: createErr?.message || 'Falha ao salvar no backend' }
            }
          }
        } else {
          return {
            success: false,
            error: 'Temporada (season_id) não encontrada no backend para persistência.',
          }
        }
      }
      return { success: true }
    } catch (err: any) {
      console.warn('[CareerPersistence] Falha ao sincronizar race_results no PB:', err)
      return {
        success: false,
        error: err?.message || 'Erro inesperado na sincronização com backend',
      }
    }
  }

  /**
   * Versão assíncrona recomendada: Aguarda a confirmação do Backend e trata cota de localStorage.
   * Torna o Backend a fonte autoritativa de verdade para o Journal e para o Resultado Oficial.
   * Não mostra sucesso antes da confirmação da gravação do Journal no PocketBase.
   */
  public async registerOfficialRaceResultInCareerAsync(
    officialResult: OfficialRaceResult,
    options?: {
      simulateFailureAfterIndex?: number
      requireBackendSync?: boolean
    },
  ): Promise<{
    success: boolean
    alreadyRegistered: boolean
    persistedResult: CanonicalPersistedRaceResult | null
    journal: CareerApplicationJournal
    error?: string
  }> {
    if (!officialResult) {
      throw new Error('[CareerPersistence] OfficialRaceResult nulo ou indefinido.')
    }

    const { careerId, season, round, raceVariant } = officialResult
    const journalKey = this.buildApplyJournalKey(careerId, season, round, raceVariant)

    // 1. Verificar integridade do resultado
    const isIntegrityValid = canonicalRaceResultService.verifyResultIntegrity(officialResult)
    if (!isIntegrityValid) {
      const errMsg = 'Resultado oficial inválido ou alterado após oficialização.'
      const failJournal: CareerApplicationJournal = {
        key: journalKey,
        careerId,
        season,
        round,
        officialRaceResultId: officialResult.officialResultId,
        checksum: officialResult.resultHash,
        status: 'FAILED',
        appliedDriverIds: [],
        totalEntries: officialResult.entries?.length || 0,
        version: 1,
        startedAt: new Date().toISOString(),
        lastError: errMsg,
      }
      if (pb?.collection) {
        try {
          await this.saveApplicationJournalToBackend(failJournal, raceVariant)
        } catch {
          /* intentionally ignored */
        }
      } else {
        this.saveApplicationJournal(failJournal, raceVariant)
      }
      return {
        success: false,
        alreadyRegistered: false,
        persistedResult: null,
        journal: failJournal,
        error: errMsg,
      }
    }

    // 2. Se temos PocketBase, verificar existência autoritativa prévia do Journal no Backend
    let existingRemoteJournal: CareerApplicationJournal | null = null
    if (pb?.collection) {
      try {
        existingRemoteJournal = await this.getApplicationJournalFromBackend(
          careerId,
          season,
          round,
          raceVariant,
        )
      } catch (checkErr: any) {
        console.warn('[CareerPersistence] Falha ao consultar journal prévio no PB:', checkErr)
        if (options?.requireBackendSync) {
          throw checkErr
        }
      }
    }

    // Se o journal remoto já estava COMPLETE e com mesmo officialResultId, sucesso idempotente imediato
    if (
      existingRemoteJournal &&
      existingRemoteJournal.status === 'COMPLETE' &&
      existingRemoteJournal.officialRaceResultId === officialResult.officialResultId &&
      existingRemoteJournal.checksum === officialResult.resultHash
    ) {
      const persistedResult = this.getPersistedRaceResult(careerId, season, round, raceVariant)
      return {
        success: true,
        alreadyRegistered: true,
        persistedResult,
        journal: existingRemoteJournal,
      }
    }

    // 3. PERSISTÊNCIA CANÔNICA NO BACKEND ANTES DO LOOP DE EFEITOS (RACE-CAREER-SAVE-01C1)
    // O resultado oficial canônico completo deve estar CONFIRMADO no backend ANTES de qualquer
    // aplicação de efeitos em pilotos/carreira ou checkpoint local.
    // - mesma identidade e mesmo hash -> reconhece registro existente e prossegue;
    // - hash divergente -> conflito explícito, interrompe;
    // - erro de gravação/consulta -> propaga ao chamador e interrompe ANTES do loop.
    if (pb?.collection) {
      try {
        await canonicalRaceResultService.saveOfficialRaceResultToBackend(officialResult)
      } catch (pbErr: any) {
        // Erro ou conflito de hash no backend: interrompe estritamente antes do loop
        if (options?.requireBackendSync) {
          const errMsg = pbErr?.message || 'Falha na confirmação do backend (PocketBase).'
          const failJournal: CareerApplicationJournal = {
            key: journalKey,
            careerId,
            season,
            round,
            officialRaceResultId: officialResult.officialResultId,
            checksum: officialResult.resultHash,
            status: 'FAILED',
            appliedDriverIds: [],
            totalEntries: officialResult.entries?.length || 0,
            version: 1,
            startedAt: new Date().toISOString(),
            lastError: errMsg,
          }
          return {
            success: false,
            alreadyRegistered: false,
            persistedResult: null,
            journal: failJournal,
            error: errMsg,
          }
        }
        throw pbErr
      }
    }

    // 4. Se PocketBase não estiver disponível, executar o loop síncrono local existente
    if (!pb?.collection) {
      return this.registerOfficialRaceResultInCareerSync(officialResult, options)
    }

    // 5. EXECUÇÃO ASSÍNCRONA DO LOOP COM CHECKPOINTS REMOTOS (RACE-CAREER-SAVE-01C2B)
    return this.executeCareerApplicationLoopAsync({
      officialResult,
      existingRemoteJournal,
      options,
    })
  }

  /**
   * Executa a aplicação do resultado oficial na carreira de forma assíncrona,
   * aguardando a gravação de cada checkpoint no PocketBase sequencialmente (RACE-CAREER-SAVE-01C2B).
   *
   * Ordem dos checkpoints:
   * 1. Checkpoint inicial (APPLYING) aguardado antes de iniciar qualquer efeito em piloto;
   * 2. Aplicação sequencial piloto a piloto: estatísticas + moral (markMoraleProcessed);
   * 3. Checkpoint por piloto persistido e aguardado no backend antes de iniciar o próximo piloto;
   * 4. Checkpoint final (COMPLETE + snapshot do campeonato + sync race_results) aguardado antes de retornar sucesso.
   *
   * Falhas de checkpoint remotos:
   * - Interrompem imediatamente o processamento antes do próximo piloto;
   * - Não retornam COMPLETE;
   * - Preservam o progresso confirmado no journal;
   * - Tentam registrar FAILED no backend sem mascarar o erro original caso o registro de FAILED também falhe.
   */
  public async executeCareerApplicationLoopAsync(params: {
    officialResult: OfficialRaceResult
    existingRemoteJournal: CareerApplicationJournal | null
    options?: {
      simulateFailureAfterIndex?: number
      requireBackendSync?: boolean
    }
  }): Promise<{
    success: boolean
    alreadyRegistered: boolean
    persistedResult: CanonicalPersistedRaceResult | null
    journal: CareerApplicationJournal
    error?: string
  }> {
    const { officialResult, existingRemoteJournal, options } = params
    const { careerId, season, round, raceVariant } = officialResult
    const resultKey = this.buildRaceResultKey(careerId, season, round, raceVariant)
    const journalKey = this.buildApplyJournalKey(careerId, season, round, raceVariant)

    const existingResult = this.getPersistedRaceResult(careerId, season, round, raceVariant)

    // 1. Base do progresso da execução: Journal remoto autoritativo ou novo
    const journal: CareerApplicationJournal = existingRemoteJournal || {
      key: journalKey,
      careerId,
      season,
      round,
      officialRaceResultId: officialResult.officialResultId,
      checksum: officialResult.resultHash,
      status: 'PENDING',
      appliedDriverIds: [],
      totalEntries: officialResult.entries.length,
      startedAt: new Date().toISOString(),
    }

    journal.status = 'APPLYING'
    journal.totalEntries = officialResult.entries.length

    // 2. CHECKPOINT INICIAL REMOTO AGUARDADO (antes de qualquer efeito em piloto)
    try {
      await this.saveApplicationJournalToBackend(journal, raceVariant)
    } catch (initialErr: any) {
      const errMsg = `[Checkpoint Inicial Falhou] ${initialErr?.message || 'Falha ao gravar checkpoint inicial no backend'}`
      journal.status = 'FAILED'
      journal.lastError = errMsg
      if (options?.requireBackendSync) {
        return {
          success: false,
          alreadyRegistered: false,
          persistedResult: null,
          journal,
          error: errMsg,
        }
      }
      throw new Error(errMsg)
    }

    // 3. PERSISTIR REGISTRO CANÔNICO LOCAL/CACHE race_results
    let persistedRecord = existingResult
    if (!persistedRecord) {
      const leanSnapshot: OfficialRaceResult = {
        ...officialResult,
      }
      persistedRecord = {
        id: resultKey,
        careerId,
        seasonId: `s${season}`,
        season,
        round,
        eventId: `event_${careerId}_s${season}_r${round}${raceVariant === 'SPRINT_RACE' ? '_sprint' : ''}`,
        circuitId: officialResult.circuitId,
        officialRaceResultId: officialResult.officialResultId,
        checksum: officialResult.resultHash,
        winnerDriverId: officialResult.winnerDriverId,
        poleDriverId: officialResult.poleDriverId,
        fastestLapDriverId: officialResult.fastestLapDriverId,
        officializedAt: officialResult.officializedAt,
        createdAt: new Date().toISOString(),
        entries: officialResult.entries,
        playerEntries: officialResult.playerEntries,
        snapshot: leanSnapshot,
      }
      this.savePersistedRaceResult(persistedRecord, raceVariant)
    }

    // 4. LOOP ASSÍNCRONO DE APLICAÇÃO DOS PILOTOS COM CHECKPOINTS REMOTOS AGUARDADOS
    const appliedSet = new Set<string>(journal.appliedDriverIds || [])
    const entries = officialResult.entries

    for (let i = 0; i < entries.length; i++) {
      // Simulação de falha parcial para testes
      if (
        options?.simulateFailureAfterIndex !== undefined &&
        i === options.simulateFailureAfterIndex
      ) {
        const simErr = `[Simulação de Falha Parcial] Interrupção forçada após processar índice ${i}`
        journal.status = 'FAILED'
        journal.lastError = simErr
        try {
          await this.saveApplicationJournalToBackend(journal, raceVariant)
        } catch {
          /* preservar erro original */
        }
        return {
          success: false,
          alreadyRegistered: false,
          persistedResult: persistedRecord,
          journal,
          error: simErr,
        }
      }

      const entry = entries[i]
      const driverId = entry.driverId

      // Se este piloto já foi confirmado anteriormente, pular
      if (appliedSet.has(driverId)) {
        continue
      }

      // Semânticas canônicas de deltas
      const isDns = (entry.status as any) === 'dns'
      const deltaRaceStarts = isDns ? 0 : 1
      const deltaWins = entry.finalPosition === 1 ? 1 : 0
      const deltaPodiums = entry.finalPosition >= 1 && entry.finalPosition <= 3 ? 1 : 0
      const deltaPoles = officialResult.poleDriverId === driverId ? 1 : 0
      const deltaFastestLaps =
        officialResult.fastestLapDriverId && officialResult.fastestLapDriverId === driverId ? 1 : 0
      const deltaPoints = entry.pointsAwarded || 0
      const isDnf = entry.dnf || entry.status === 'dnf'
      const deltaDnfs = isDnf ? 1 : 0
      const deltaLapsCompleted = entry.lapsCompleted || 0
      const deltaPitStops = entry.pitStops || 0
      const deltaPositionsGained = entry.positionsGainedLost || 0
      const newFinishPosition = isDnf ? undefined : entry.finalPosition
      const newGridPosition = entry.gridPosition > 0 ? entry.gridPosition : undefined

      // Moral do piloto
      let computedNewMorale: number | undefined
      const currentCareerDriver = driverBase2026Service.getCareerDriver(careerId, driverId)
      const currentMorale = currentCareerDriver?.morale ?? 80

      const isMoraleAlreadyDone = driverMoraleService.isMoraleAlreadyProcessed({
        careerId,
        season,
        round,
        driverId,
      })

      if (!isMoraleAlreadyDone) {
        const moraleCalc = driverMoraleService.calculateDriverMoraleDelta({
          driverId,
          teamId: entry.teamId,
          driverName: entry.driverName,
          teamName: entry.teamName,
          currentMorale,
          finishPosition: entry.finalPosition,
          gridPosition: entry.gridPosition,
          status: entry.status,
          isDnf,
          dnfReason: entry.dnfReason,
          isWinner: entry.finalPosition === 1,
          isPodium: entry.finalPosition >= 1 && entry.finalPosition <= 3,
        })

        computedNewMorale = moraleCalc.afterMorale

        driverMoraleService.markMoraleProcessed(
          {
            careerId,
            season,
            round,
            driverId,
          },
          {
            before: moraleCalc.beforeMorale,
            after: moraleCalc.afterMorale,
            delta: moraleCalc.clampedRaceDelta,
            officializedAt: officialResult.officializedAt,
          },
        )
      }

      driverBase2026Service.updateCareerDriverStats({
        careerId,
        driverId,
        deltaGps: deltaRaceStarts,
        deltaRaceStarts,
        deltaWins,
        deltaPodiums,
        deltaPoles,
        deltaFastestLaps,
        deltaPoints,
        deltaDnfs,
        deltaLapsCompleted,
        deltaPitStops,
        deltaPositionsGained,
        newFinishPosition,
        newGridPosition,
        newMorale: computedNewMorale,
      })

      // Adicionar aos aplicados e persistir checkpoint remoto de forma estritamente aguardada
      appliedSet.add(driverId)
      journal.appliedDriverIds = Array.from(appliedSet)

      try {
        await this.saveApplicationJournalToBackend(journal, raceVariant)
      } catch (driverCheckpointErr: any) {
        // Falha no checkpoint do piloto: interromper antes do próximo piloto
        const errMsg = `[Checkpoint Piloto Falhou: ${driverId}] ${driverCheckpointErr?.message || 'Falha ao persistir checkpoint remoto do piloto'}`
        journal.status = 'FAILED'
        journal.lastError = errMsg

        // Tentar registrar FAILED no backend sem mascarar o erro original
        try {
          await this.saveApplicationJournalToBackend(journal, raceVariant)
        } catch (failSaveErr) {
          console.error(
            '[CareerPersistence] Falha secundária ao registrar status FAILED no backend:',
            failSaveErr,
          )
        }

        if (options?.requireBackendSync) {
          return {
            success: false,
            alreadyRegistered: false,
            persistedResult: persistedRecord,
            journal,
            error: errMsg,
          }
        }
        throw new Error(errMsg)
      }
    }

    // 5. ATUALIZAR STATUS NO JOURNAL PARA COMPLETE
    journal.status = 'COMPLETE'
    journal.completedAt = new Date().toISOString()
    journal.lastError = undefined

    // 6. SNAPSHOT DO CAMPEONATO
    try {
      const sNum =
        typeof season === 'number'
          ? season
          : parseInt(String(season).replace(/\D/g, ''), 10) || 2026
      canonicalChampionshipService.processAndPersistRoundChampionship(
        careerId,
        sNum,
        round,
        officialResult.playerTeamId,
      )
    } catch (snapErr) {
      console.warn('[CareerPersistence] Aviso ao gerar snapshot do campeonato:', snapErr)
    }

    // 7. SINCRONIZAR race_results NO BACKEND
    const pbSync = await this.syncWithPocketBaseIfAvailable(persistedRecord, journal)
    if (!pbSync.success && options?.requireBackendSync) {
      journal.status = 'FAILED'
      journal.lastError = pbSync.error || 'Falha ao sincronizar race_results no backend'
      try {
        await this.saveApplicationJournalToBackend(journal, raceVariant)
      } catch {
        /* preservar erro original */
      }
      return {
        success: false,
        alreadyRegistered: false,
        persistedResult: persistedRecord,
        journal,
        error: pbSync.error || 'Falha na confirmação do backend (PocketBase).',
      }
    }

    // 8. CHECKPOINT FINAL REMOTO AGUARDADO (COMPLETE)
    try {
      await this.saveApplicationJournalToBackend(journal, raceVariant)
    } catch (finalSaveErr: any) {
      const errMsg = `[Checkpoint Final Falhou] ${finalSaveErr?.message || 'Falha ao confirmar conclusão no backend'}`
      journal.status = 'FAILED'
      journal.lastError = errMsg
      try {
        await this.saveApplicationJournalToBackend(journal, raceVariant)
      } catch {
        /* preservar erro original */
      }
      if (options?.requireBackendSync) {
        return {
          success: false,
          alreadyRegistered: false,
          persistedResult: persistedRecord,
          journal,
          error: errMsg,
        }
      }
      throw new Error(errMsg)
    }

    return {
      success: true,
      alreadyRegistered: false,
      persistedResult: persistedRecord,
      journal,
    }
  }

  /**
   * Limpa registros persistidos e journals (apenas para testes).
   */
  public clearPersistenceForTesting(
    careerId: string,
    season: number | string,
    round: number,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    const resKey = this.buildRaceResultKey(careerId, season, round, raceVariant)
    const jKey = this.buildApplyJournalKey(careerId, season, round, raceVariant)
    window.localStorage.removeItem(resKey)
    window.localStorage.removeItem(jKey)
    // Se for não especificada, limpa todas as variantes e chaves legadas
    if (!raceVariant) {
      window.localStorage.removeItem(
        this.buildRaceResultKey(careerId, season, round, 'SPRINT_RACE'),
      )
      window.localStorage.removeItem(
        this.buildApplyJournalKey(careerId, season, round, 'SPRINT_RACE'),
      )
      window.localStorage.removeItem(this.buildRaceResultKey(careerId, season, round, 'MAIN_RACE'))
      window.localStorage.removeItem(
        this.buildApplyJournalKey(careerId, season, round, 'MAIN_RACE'),
      )
      const sId = typeof season === 'number' ? `s${season}` : season
      window.localStorage.removeItem(
        `${CANONICAL_CAREER_RACE_RESULT_PREFIX}_${careerId}_${sId}_${round}`,
      )
      window.localStorage.removeItem(
        `${CANONICAL_CAREER_APPLY_JOURNAL_PREFIX}_${careerId}_${sId}_${round}`,
      )
    }
  }
}

export const canonicalCareerPersistenceService = new CanonicalCareerPersistenceService()
