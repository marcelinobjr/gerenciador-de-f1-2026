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
    window.localStorage.setItem(key, JSON.stringify(journal))
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
    if (!raw) return null
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
    window.localStorage.setItem(key, JSON.stringify(record))
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
    return res !== null
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

    // 2. IDEMPOTÊNCIA COMPLETA (Requisito 5)
    // Se race_result já existe e journal está COMPLETE: sucesso idempotente sem duplicar.
    const existingJournal = this.getApplicationJournal(careerId, season, round, raceVariant)
    const existingResult = this.getPersistedRaceResult(careerId, season, round, raceVariant)

    if (existingJournal && existingJournal.status === 'COMPLETE' && existingResult) {
      return {
        success: true,
        alreadyRegistered: true,
        persistedResult: existingResult,
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
        snapshot: officialResult,
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
   * Sincroniza o resultado oficial persistido na coleção race_results do PocketBase (se disponível).
   * Não lança erro nem bloqueia o fluxo síncrono da UI / testes se falhar.
   */
  public async syncWithPocketBaseIfAvailable(
    record: CanonicalPersistedRaceResult,
    journal: CareerApplicationJournal,
  ): Promise<void> {
    try {
      if (!pb?.collection) return

      // Buscar se já existe registro com result_key
      const resultKey = record.id
      let existingRecordId: string | null = null

      try {
        const found = await pb
          .collection('race_results')
          .getFirstListItem(
            `result_key = "${resultKey}" || (career_id = "${record.careerId}" && round = ${record.round})`,
          )
        if (found?.id) {
          existingRecordId = found.id
        }
      } catch (_) {
        // Não encontrado ou offline
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

      if (existingRecordId) {
        await pb.collection('race_results').update(existingRecordId, pbPayload)
      } else {
        // Tentar buscar se temos season_id no PB
        let seasonIdPB: string | undefined
        try {
          const s = await pb
            .collection('seasons')
            .getFirstListItem(`team_id = "${record.careerId}"`)
          if (s?.id) seasonIdPB = s.id
        } catch {
          /* intentionally ignored */
        }

        if (seasonIdPB) {
          const winnerEntry = record.entries.find((e) => e.finalPosition === 1) || record.entries[0]
          await pb.collection('race_results').create({
            ...pbPayload,
            season_id: seasonIdPB,
            position: 1,
            points: winnerEntry?.pointsAwarded || 25,
            fastest_lap: winnerEntry?.fastestLap || false,
          })
        }
      }
    } catch (err) {
      console.warn('[CareerPersistence] Falha tolerada ao sincronizar race_results no PB:', err)
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
