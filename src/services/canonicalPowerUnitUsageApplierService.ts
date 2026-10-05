/**
 * canonicalPowerUnitUsageApplierService.ts
 *
 * PU-05A2-P3-B1-R: Aplicador Persistente do Uso por Unidade de Potência
 * (Idempotência Autoritativa no Backend / Skip Cloud / PocketBase)
 *
 * OBJETIVO:
 * Consumir o relatório de apuração P3-A (SessionPowerUnitUsageProjectionReport)
 * e aplicar quilometragem e débito de desgaste ao inventário correto (TeamModel.engine_history),
 * com proteção persistente e autoritativa no backend contra aplicação duplicada e concorrência.
 *
 * CONTRATOS E REGRAS:
 * 1. Não recalcular: consome diretamente projection.distanceKm e projection.wearDebit.
 * 2. Unidade registrada na sessão: localiza no inventário por teamId + powerUnitId, NUNCA pela garagem atual.
 * 3. Idempotência estrita: baseada na identidade da sessão (careerId, season, round, raceVariant)
 *    e rastreamento granular por unidade aplicada (appliedUnitIds) para suportar retomada e falha parcial.
 * 4. AUTORIDADE DO BACKEND:
 *    - O backend (coleção `power_unit_usage_journals` + hook transacional) é a FONTE AUTORITATIVA.
 *    - localStorage e memória atuam estritamente como CACHE secundário de conveniência.
 *    - O aplicador consulta o backend antes de qualquer operação; se já estiver COMPLETE no backend,
 *      retorna ALREADY_APPLIED mesmo se o localStorage tiver sido completamente limpo.
 * 5. Registros não reconhecidos (LEGACY_UNLINKED, PENDING_ENGINE_SESSION_EVOLUTION, etc.):
 *    não são debitados e são categorizados como 'NOT_APPLICABLE'.
 * 6. NÃO conectar à oficialização automática nesta fase.
 */

import pb from '@/lib/pocketbase/client'
import type { TeamModel } from '@/types/f1'
import type {
  SessionPowerUnitUsageProjectionReport,
  ParticipantPowerUnitUsageProjection,
} from '@/services/canonicalPowerUnitUsageProjectionService'
import type { RaceVariant } from '@/types/canonical-race-v2'

export const CANONICAL_PU_USAGE_JOURNAL_PREFIX = 'apex_gp_pu_usage_journal'

export type PowerUnitApplicationStatus =
  | 'PENDING'
  | 'APPLYING'
  | 'COMPLETE'
  | 'PARTIAL'
  | 'FAILED'
  | 'SKIPPED'

export interface PowerUnitUsageJournalEntry {
  id?: string
  journalKey: string
  careerId: string
  season: number
  round: number
  raceVariant: RaceVariant
  sessionKey: string
  status: PowerUnitApplicationStatus
  appliedUnitIds: number[]
  appliedDriverIds: string[]
  startedAt: string
  completedAt?: string
  lastError?: string
}

export type UnitApplicationResultStatus =
  | 'APPLIED'
  | 'ALREADY_APPLIED'
  | 'ZERO_WEAR_APPLIED'
  | 'NOT_APPLICABLE'
  | 'FAILED_NOT_FOUND'
  | 'FAILED_PERSISTENCE'

export interface UnitApplicationResult {
  driverId: string
  driverName: string
  teamId: string
  powerUnitId?: number
  status: UnitApplicationResultStatus
  distanceKmAdded: number
  wearDebitApplied: number
  previousMileageKm?: number
  newMileageKm?: number
  previousCondition?: number
  newCondition?: number
  previousWear?: number
  newWear?: number
  message?: string
}

export interface SessionPowerUnitUsageApplicationResult {
  sessionKey: string
  careerId: string
  season: number
  round: number
  raceVariant: RaceVariant
  status: 'SUCCESS' | 'PARTIAL' | 'ALREADY_APPLIED' | 'FAILED' | 'SKIPPED'
  journal: PowerUnitUsageJournalEntry
  appliedCount: number
  alreadyAppliedCount: number
  pendingOrUnlinkedCount: number
  failedCount: number
  unitResults: UnitApplicationResult[]
  error?: string
}

export interface ApplySessionPowerUnitUsageOptions {
  /**
   * Fornece o TeamModel explicitamente (ex: em testes ou quando o chamador já possui o modelo).
   * Se omitido, busca no PocketBase ou localmente pelo teamId.
   */
  teamOverrides?: Map<string, TeamModel> | Record<string, TeamModel>
  /**
   * Simula falha proposital após aplicar a N-ésima unidade (base 1, ex: 1 = falha após aplicar a 1ª unidade).
   * Útil para testes de resiliência e retomada de falha parcial.
   */
  simulateFailureAfterUnitIndex?: number
  /**
   * Permite persistência sem rede (exclusivamente em memória/localStorage ou TeamModel fornecido).
   */
  dryRunOrLocalOnly?: boolean
  /**
   * Força a execução via fallback local mesmo com cliente PB presente (útil em testes de unidade puros).
   */
  forceLocalEngine?: boolean
}

export class CanonicalPowerUnitUsageApplierService {
  // Mantém controle de concorrência ativa por journalKey
  private static activeOperations: Map<string, Promise<SessionPowerUnitUsageApplicationResult>> =
    new Map()
  private memoryJournalCache: Map<string, PowerUnitUsageJournalEntry> = new Map()

  /**
   * Constrói a chave canônica única do Journal de Aplicação de Uso de PU:
   * apex_gp_pu_usage_journal_{careerId}_s{season}_r{round}_{sprint|main}
   */
  public buildJournalKey(
    careerId: string,
    season: number,
    round: number,
    raceVariant: RaceVariant = 'MAIN_RACE',
  ): string {
    const variantSlug = raceVariant === 'SPRINT_RACE' ? 'sprint' : 'main'
    return `${CANONICAL_PU_USAGE_JOURNAL_PREFIX}_${careerId}_s${season}_r${round}_${variantSlug}`
  }

  /**
   * Consulta o Journal autoritativo no Backend (PocketBase collection 'power_unit_usage_journals').
   */
  public async fetchBackendJournal(
    careerId: string,
    season: number,
    round: number,
    raceVariant: RaceVariant = 'MAIN_RACE',
  ): Promise<{
    journal: PowerUnitUsageJournalEntry
    unitResults?: UnitApplicationResult[]
  } | null> {
    const journalKey = this.buildJournalKey(careerId, season, round, raceVariant)
    if (!pb) return null

    // 1. Tentar consultar prioritariamente pelo endpoint autorizado do backend
    try {
      const queryParams = new URLSearchParams({
        careerId,
        season: String(season),
        round: String(round),
        raceVariant,
      })
      const resp = await pb.send<{
        journal: PowerUnitUsageJournalEntry
        unitResults?: UnitApplicationResult[]
      }>(`/backend/v1/pu-usage/journal?${queryParams.toString()}`, {
        method: 'GET',
      })
      if (resp && resp.journal) {
        this.saveLocalJournalCache(resp.journal)
        return resp
      }
    } catch (_) {
      // Falha no endpoint autorizado (401, 403, 404 ou indisponível)
    }

    // 2. Consulta via collection com RLS protegida (apenas leitura autorizada)
    if (pb?.collection) {
      try {
        const record = await pb
          .collection('power_unit_usage_journals')
          .getFirstListItem(`journal_key = "${journalKey}"`)

        if (record) {
          const entry: PowerUnitUsageJournalEntry = {
            id: record.id,
            journalKey: record.journal_key,
            careerId: record.career_id,
            season: record.season,
            round: record.round,
            raceVariant: record.race_variant,
            sessionKey: record.session_key,
            status: record.status as PowerUnitApplicationStatus,
            appliedUnitIds: Array.isArray(record.applied_unit_ids) ? record.applied_unit_ids : [],
            appliedDriverIds: Array.isArray(record.applied_driver_ids)
              ? record.applied_driver_ids
              : [],
            startedAt: record.created,
            completedAt: record.updated,
            lastError: record.last_error,
          }
          const unitResults = Array.isArray(record.unit_results) ? record.unit_results : undefined
          this.saveLocalJournalCache(entry)
          return { journal: entry, unitResults }
        }
      } catch {
        // Registro não encontrado ou offline
      }
    }

    return null
  }

  /**
   * Recupera o Journal de Aplicação do cache (memória -> localStorage).
   */
  public getJournal(
    careerId: string,
    season: number,
    round: number,
    raceVariant: RaceVariant = 'MAIN_RACE',
  ): PowerUnitUsageJournalEntry | null {
    return this.getLocalJournalCache(careerId, season, round, raceVariant)
  }

  public getLocalJournalCache(
    careerId: string,
    season: number,
    round: number,
    raceVariant: RaceVariant = 'MAIN_RACE',
  ): PowerUnitUsageJournalEntry | null {
    const key = this.buildJournalKey(careerId, season, round, raceVariant)
    if (this.memoryJournalCache.has(key)) {
      return { ...this.memoryJournalCache.get(key)! }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw) as PowerUnitUsageJournalEntry
          this.memoryJournalCache.set(key, parsed)
          return parsed
        }
      } catch {
        // Tolerância a erros de deserialização
      }
    }
    return null
  }

  /**
   * Salva o Journal de Aplicação no cache local (memória e localStorage).
   */
  public saveLocalJournalCache(journal: PowerUnitUsageJournalEntry): void {
    const key = journal.journalKey
    this.memoryJournalCache.set(key, { ...journal })
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, JSON.stringify(journal))
      } catch {
        // Tolerância a restrições de cota de localStorage
      }
    }
  }

  /**
   * Limpa cache local de journals (útil para testes).
   */
  public clearJournalCache(): void {
    this.memoryJournalCache.clear()
  }

  /**
   * Aplica o uso e desgaste de unidades de potência apurado por P3-A com idempotência autoritativa.
   */
  public async applySessionPowerUnitUsage(
    projectionReport: SessionPowerUnitUsageProjectionReport,
    options: ApplySessionPowerUnitUsageOptions = {},
  ): Promise<SessionPowerUnitUsageApplicationResult> {
    if (!projectionReport) {
      throw new Error('[applySessionPowerUnitUsage] Relatório de apuração ausente ou nulo.')
    }

    const { careerId, season, round, raceVariant } = projectionReport
    const journalKey = this.buildJournalKey(careerId, season, round, raceVariant)

    // 0. Proteção contra chamadas concorrentes locais na mesma aba/instância
    const existingOp = CanonicalPowerUnitUsageApplierService.activeOperations.get(journalKey)
    if (existingOp) {
      return await existingOp
    }

    const operationPromise = this.executeApplySessionPowerUnitUsage(projectionReport, options)
    CanonicalPowerUnitUsageApplierService.activeOperations.set(journalKey, operationPromise)

    try {
      return await operationPromise
    } finally {
      CanonicalPowerUnitUsageApplierService.activeOperations.delete(journalKey)
    }
  }

  private async executeApplySessionPowerUnitUsage(
    projectionReport: SessionPowerUnitUsageProjectionReport,
    options: ApplySessionPowerUnitUsageOptions,
  ): Promise<SessionPowerUnitUsageApplicationResult> {
    const { careerId, season, round, raceVariant, sessionKey } = projectionReport
    const journalKey = this.buildJournalKey(careerId, season, round, raceVariant)

    // PU-05A2-P3-B1-SEC: DÉBITO SOMENTE PELO CAMINHO AUTORIZADO
    // Em qualquer operação de produção/aplicação com cliente PocketBase ativo,
    // o débito e criação de journal DEVEM passar ÚNICA e EXCLUSIVAMENTE pelo hook transacional
    // protegido do backend (/backend/v1/pu-usage/apply-session).
    // Nenhum fallback de leitura-antes-gravação no inventário/journal é chamado em caso de erro,
    // timeout, indisponibilidade ou auth/autorização rejeitada.
    if (!options.dryRunOrLocalOnly && !options.forceLocalEngine && pb?.collection) {
      try {
        const response = await pb.send<SessionPowerUnitUsageApplicationResult>(
          '/backend/v1/pu-usage/apply-session',
          {
            method: 'POST',
            body: { projectionReport },
          },
        )

        if (response && response.journal) {
          // Atualiza cache local após confirmação autoritativa do backend
          this.saveLocalJournalCache(response.journal)
          return response
        }
      } catch (backendHookErr: any) {
        // Em caso de erro remoto, timeout ou resposta perdida:
        // 1. Tentar consultar o journal autoritativo pelo endpoint protegido GET /backend/v1/pu-usage/journal
        //    (se o servidor tiver concluído a aplicação antes da perda de rede, reconhece ALREADY_APPLIED sem novo débito)
        try {
          const backendJournal = await this.fetchBackendJournal(
            careerId,
            season,
            round,
            raceVariant,
          )
          if (backendJournal && backendJournal.journal.status === 'COMPLETE') {
            const alreadyAppliedResults: UnitApplicationResult[] = projectionReport.projections.map(
              (proj) => ({
                driverId: proj.driverId,
                driverName: proj.driverName,
                teamId: proj.teamId,
                powerUnitId: proj.powerUnitId,
                status: 'ALREADY_APPLIED',
                distanceKmAdded: 0,
                wearDebitApplied: 0,
                message: `Sessão ${sessionKey} e unidade PU-${proj.powerUnitId} já aplicadas no backend.`,
              }),
            )

            this.saveLocalJournalCache(backendJournal.journal)

            return {
              sessionKey,
              careerId,
              season,
              round,
              raceVariant,
              status: 'ALREADY_APPLIED',
              journal: backendJournal.journal,
              appliedCount: 0,
              alreadyAppliedCount: alreadyAppliedResults.length,
              pendingOrUnlinkedCount: 0,
              failedCount: 0,
              unitResults: alreadyAppliedResults,
            }
          }
        } catch (_) {
          // Falha na consulta ou acesso rejeitado
        }

        // B1-SEC: NÃO efetuar débito alternativo, NÃO marcar concluído no cache local.
        // Devolver erro ou estado pendente explícito ao chamador mantendo a identidade para reconciliação.
        const errorMessage =
          backendHookErr?.response?.message ||
          backendHookErr?.message ||
          'Falha na aplicação autorizada de uso de PU no backend.'

        const journalStatus: PowerUnitApplicationStatus =
          backendHookErr?.status === 401
            ? 'FAILED'
            : backendHookErr?.status === 403
              ? 'FAILED'
              : 'PENDING'

        const resultStatus: SessionPowerUnitUsageApplicationResult['status'] = 'FAILED'

        return {
          sessionKey,
          careerId,
          season,
          round,
          raceVariant,
          status: resultStatus,
          journal: {
            journalKey,
            careerId,
            season,
            round,
            raceVariant,
            sessionKey,
            status: journalStatus,
            appliedUnitIds: [],
            appliedDriverIds: [],
            startedAt: new Date().toISOString(),
            lastError: errorMessage,
          },
          appliedCount: 0,
          alreadyAppliedCount: 0,
          pendingOrUnlinkedCount: projectionReport.projections.length,
          failedCount: projectionReport.projections.length,
          unitResults: projectionReport.projections.map((p) => ({
            driverId: p.driverId,
            driverName: p.driverName,
            teamId: p.teamId,
            powerUnitId: p.powerUnitId,
            status: 'FAILED_PERSISTENCE',
            distanceKmAdded: 0,
            wearDebitApplied: 0,
            message: `Aplicação rejeitada ou hook indisponível: ${errorMessage}`,
          })),
          error: errorMessage,
        }
      }
    }

    // Modo estritamente local e em memória/objeto passado para testes de unidade offline puros
    // (apenas se options.dryRunOrLocalOnly ou options.forceLocalEngine foram explicitamente configurados)
    return await this.applyInMemoryIsolatedSimulation(projectionReport, options)
  }

  /**
   * Executa a aplicação puramente em memória / TeamModel fornecido (para testes unitários isolados offline).
   * NUNCA chamado no fluxo padrão de produção onde o PocketBase está conectado.
   */
  private async applyInMemoryIsolatedSimulation(
    projectionReport: SessionPowerUnitUsageProjectionReport,
    options: ApplySessionPowerUnitUsageOptions,
  ): Promise<SessionPowerUnitUsageApplicationResult> {
    const { careerId, season, round, raceVariant, sessionKey } = projectionReport
    const journalKey = this.buildJournalKey(careerId, season, round, raceVariant)

    const localJournal = this.getLocalJournalCache(careerId, season, round, raceVariant)
    if (localJournal && localJournal.status === 'COMPLETE') {
      const alreadyAppliedResults: UnitApplicationResult[] = projectionReport.projections.map(
        (proj) => ({
          driverId: proj.driverId,
          driverName: proj.driverName,
          teamId: proj.teamId,
          powerUnitId: proj.powerUnitId,
          status: 'ALREADY_APPLIED',
          distanceKmAdded: 0,
          wearDebitApplied: 0,
          message: `Sessão ${sessionKey} e unidade PU-${proj.powerUnitId} já aplicadas autoritativamente.`,
        }),
      )

      return {
        sessionKey,
        careerId,
        season,
        round,
        raceVariant,
        status: 'ALREADY_APPLIED',
        journal: localJournal,
        appliedCount: 0,
        alreadyAppliedCount: alreadyAppliedResults.length,
        pendingOrUnlinkedCount: 0,
        failedCount: 0,
        unitResults: alreadyAppliedResults,
      }
    }

    const journal: PowerUnitUsageJournalEntry = localJournal || {
      journalKey,
      careerId,
      season,
      round,
      raceVariant,
      sessionKey,
      status: 'PENDING',
      appliedUnitIds: [],
      appliedDriverIds: [],
      startedAt: new Date().toISOString(),
    }

    journal.status = 'APPLYING'
    this.saveLocalJournalCache(journal)

    const appliedUnitIdsSet = new Set<number>(journal.appliedUnitIds || [])
    const appliedDriverIdsSet = new Set<string>(journal.appliedDriverIds || [])

    const unitResults: UnitApplicationResult[] = []
    let appliedCount = 0
    let alreadyAppliedCount = 0
    let pendingOrUnlinkedCount = 0
    let failedCount = 0

    const projectionsByTeam = new Map<string, ParticipantPowerUnitUsageProjection[]>()
    for (const proj of projectionReport.projections) {
      const list = projectionsByTeam.get(proj.teamId) || []
      list.push(proj)
      projectionsByTeam.set(proj.teamId, list)
    }

    let globalUnitProcessingIndex = 0

    try {
      for (const [teamId, teamProjections] of projectionsByTeam.entries()) {
        let team: TeamModel | null = null

        if (options.teamOverrides) {
          if (options.teamOverrides instanceof Map) {
            team = options.teamOverrides.get(teamId) || null
          } else {
            team = (options.teamOverrides as Record<string, TeamModel>)[teamId] || null
          }
        }

        for (const proj of teamProjections) {
          if (!proj.hasValidLinkage || !proj.powerUnitId) {
            pendingOrUnlinkedCount++
            unitResults.push({
              driverId: proj.driverId,
              driverName: proj.driverName,
              teamId: proj.teamId,
              powerUnitId: undefined,
              status: 'NOT_APPLICABLE',
              distanceKmAdded: 0,
              wearDebitApplied: 0,
              message: `Participante sem vínculo individual de PU (${proj.wearDebitStatus}).`,
            })
            continue
          }

          if (
            proj.wearDebitStatus === 'PENDING_ENGINE_SESSION_EVOLUTION' ||
            proj.wearDebitStatus === 'LEGACY_UNLINKED'
          ) {
            pendingOrUnlinkedCount++
            unitResults.push({
              driverId: proj.driverId,
              driverName: proj.driverName,
              teamId: proj.teamId,
              powerUnitId: proj.powerUnitId,
              status: 'NOT_APPLICABLE',
              distanceKmAdded: 0,
              wearDebitApplied: 0,
              message: `Débito de desgaste não reconhecido (${proj.wearDebitStatus}): ${proj.pendingReason || 'desgaste pendente'}.`,
            })
            continue
          }

          const puId = proj.powerUnitId

          if (appliedUnitIdsSet.has(puId)) {
            alreadyAppliedCount++
            unitResults.push({
              driverId: proj.driverId,
              driverName: proj.driverName,
              teamId: proj.teamId,
              powerUnitId: puId,
              status: 'ALREADY_APPLIED',
              distanceKmAdded: 0,
              wearDebitApplied: 0,
              message: `Unidade PU-${puId} já foi aplicada nesta sessão pelo Journal.`,
            })
            continue
          }

          if (!team) {
            failedCount++
            unitResults.push({
              driverId: proj.driverId,
              driverName: proj.driverName,
              teamId: proj.teamId,
              powerUnitId: puId,
              status: 'FAILED_NOT_FOUND',
              distanceKmAdded: 0,
              wearDebitApplied: 0,
              message: `Equipe '${teamId}' não encontrada para aplicar unidade PU-${puId}.`,
            })
            continue
          }

          const history = Array.isArray(team.engine_history) ? [...team.engine_history] : []
          const unitIndex = history.findIndex((eng) => Number(eng.id) === puId)

          if (unitIndex === -1) {
            failedCount++
            unitResults.push({
              driverId: proj.driverId,
              driverName: proj.driverName,
              teamId: proj.teamId,
              powerUnitId: puId,
              status: 'FAILED_NOT_FOUND',
              distanceKmAdded: 0,
              wearDebitApplied: 0,
              message: `Unidade PU-${puId} não encontrada no engine_history da equipe '${teamId}'.`,
            })
            continue
          }

          const existingUnit = history[unitIndex]
          const prevMileage =
            typeof existingUnit.mileage_km === 'number' ? existingUnit.mileage_km : 0
          const prevCond =
            typeof existingUnit.condition === 'number'
              ? existingUnit.condition
              : typeof existingUnit.wear === 'number'
                ? Math.max(0, 100 - existingUnit.wear)
                : 100
          const prevWear =
            typeof existingUnit.wear === 'number' ? existingUnit.wear : Math.max(0, 100 - prevCond)

          const addDistance = proj.distanceKm || 0
          const wearDebit = proj.wearDebit || 0

          const newMileage = Number((prevMileage + addDistance).toFixed(3))
          const newCond = Number(Math.max(0, Math.min(100, prevCond - wearDebit)).toFixed(2))
          const newWear = Number(Math.max(0, Math.min(100, 100 - newCond)).toFixed(2))

          history[unitIndex] = {
            ...existingUnit,
            mileage_km: newMileage,
            condition: newCond,
            wear: newWear,
          }

          team.engine_history = history
          if (
            team.id === proj.teamId &&
            (existingUnit.status === 'instalado' || !existingUnit.status)
          ) {
            team.active_engine_wear = newWear
          }

          globalUnitProcessingIndex++
          appliedUnitIdsSet.add(puId)
          appliedDriverIdsSet.add(proj.driverId)
          journal.appliedUnitIds = Array.from(appliedUnitIdsSet)
          journal.appliedDriverIds = Array.from(appliedDriverIdsSet)

          this.saveLocalJournalCache(journal)

          appliedCount++
          unitResults.push({
            driverId: proj.driverId,
            driverName: proj.driverName,
            teamId: proj.teamId,
            powerUnitId: puId,
            status: wearDebit === 0 ? 'ZERO_WEAR_APPLIED' : 'APPLIED',
            distanceKmAdded: addDistance,
            wearDebitApplied: wearDebit,
            previousMileageKm: prevMileage,
            newMileageKm: newMileage,
            previousCondition: prevCond,
            newCondition: newCond,
            previousWear: prevWear,
            newWear: newWear,
          })

          if (
            options.simulateFailureAfterUnitIndex !== undefined &&
            globalUnitProcessingIndex === options.simulateFailureAfterUnitIndex
          ) {
            throw new Error(
              `[Simulação de Falha Injetada] Interrupção forçada após aplicar a unidade índice ${globalUnitProcessingIndex} (PU-${puId}).`,
            )
          }
        }
      }

      const finalStatus: PowerUnitApplicationStatus =
        failedCount > 0
          ? 'PARTIAL'
          : appliedCount > 0 || alreadyAppliedCount > 0
            ? 'COMPLETE'
            : 'COMPLETE'

      journal.status = finalStatus
      journal.completedAt = new Date().toISOString()
      journal.lastError = undefined

      this.saveLocalJournalCache(journal)

      return {
        sessionKey,
        careerId,
        season,
        round,
        raceVariant,
        status: failedCount > 0 ? 'PARTIAL' : 'SUCCESS',
        journal,
        appliedCount,
        alreadyAppliedCount,
        pendingOrUnlinkedCount,
        failedCount,
        unitResults,
      }
    } catch (err: any) {
      journal.status = appliedCount > 0 ? 'PARTIAL' : 'FAILED'
      journal.lastError = err?.message || 'Erro durante a aplicação de uso de PU.'

      return {
        sessionKey,
        careerId,
        season,
        round,
        raceVariant,
        status: appliedCount > 0 ? 'PARTIAL' : 'FAILED',
        journal,
        appliedCount,
        alreadyAppliedCount,
        pendingOrUnlinkedCount,
        failedCount: failedCount || 1,
        unitResults,
        error: journal.lastError,
      }
    }
  }
}

export const canonicalPowerUnitUsageApplierService = new CanonicalPowerUnitUsageApplierService()
