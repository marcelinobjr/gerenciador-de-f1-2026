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
   * Salva o Journal de Aplicação.
   */
  public saveApplicationJournal(
    journal: CareerApplicationJournal,
    raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE' | string,
  ): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    const key = this.buildApplyJournalKey(
      journal.careerId,
      journal.season,
      journal.round,
      raceVariant,
    )
    // Enxugar o journal para conter apenas dados essenciais de retomada
    // (referência, status, pilotos aplicados, total e timestamps) sem duplicação de dados pesados
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
      startedAt: journal.startedAt,
      completedAt: journal.completedAt,
      lastError: journal.lastError,
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(slimJournal))
    } catch (quotaErr) {
      console.warn(
        `[CareerPersistence] Falha de cota no localStorage ao salvar journal (cache local: ${key}):`,
        quotaErr,
      )
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
   * Verifica se o resultado já está completamente persistido e registrado na carreira.
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
    const syncRes = this.registerOfficialRaceResultInCareerSync(officialResult, options)
    if (!syncRes.success || !syncRes.persistedResult) {
      return syncRes
    }

    // Se temos cliente PB, salvar objeto canônico completo no PocketBase com saveOfficialRaceResultToBackend
    if (pb?.collection) {
      try {
        await canonicalRaceResultService.saveOfficialRaceResultToBackend(officialResult)
      } catch (pbErr: any) {
        if (options?.requireBackendSync) {
          return {
            ...syncRes,
            success: false,
            error: pbErr?.message || 'Falha na confirmação do backend (PocketBase).',
          }
        }
        console.warn(
          '[CareerPersistence] Falha não-bloqueante ao sincronizar resultado com PB:',
          pbErr,
        )
      }

      const pbSync = await this.syncWithPocketBaseIfAvailable(
        syncRes.persistedResult,
        syncRes.journal,
      )
      if (options?.requireBackendSync && !pbSync.success) {
        return {
          ...syncRes,
          success: false,
          error: pbSync.error || 'Falha na confirmação do backend (PocketBase).',
        }
      }
    }

    return syncRes
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
