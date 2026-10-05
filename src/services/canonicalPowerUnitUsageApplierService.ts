/**
 * canonicalPowerUnitUsageApplierService.ts
 *
 * PU-05A2-P3-B1: Aplicador Persistente do Uso por Unidade de Potência
 *
 * OBJETIVO:
 * Consumir o relatório de apuração P3-A (SessionPowerUnitUsageProjectionReport)
 * e aplicar quilometragem e débito de desgaste ao inventário correto (TeamModel.engine_history),
 * com proteção persistente contra aplicação duplicada via Journal de Idempotência.
 *
 * CONTRATOS E REGRAS:
 * 1. Não recalcular: consome diretamente projection.distanceKm e projection.wearDebit.
 * 2. Unidade registrada na sessão: localiza no inventário por teamId + powerUnitId, NUNCA pela garagem atual.
 * 3. Idempotência estrita: baseada na identidade da sessão (careerId, season, round, raceVariant)
 *    e rastreamento por unidade aplicada (appliedUnitIds) para suportar retomada e falha parcial.
 * 4. Proteção contra duplicidade: checagem prévia no Journal e pós-persistência consistente.
 * 5. Registros não reconhecidos (LEGACY_UNLINKED, PENDING_ENGINE_SESSION_EVOLUTION, etc.):
 *    não são debitados e são categorizados como 'pending' ou 'unlinked'.
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
   * Recupera o Journal de Aplicação persistido.
   * Ordem: memória -> localStorage.
   */
  public getJournal(
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
   * Salva o Journal de Aplicação na memória e no localStorage.
   */
  public saveJournal(journal: PowerUnitUsageJournalEntry): void {
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
   * Limpa cache de journals (útil para testes).
   */
  public clearJournalCache(): void {
    this.memoryJournalCache.clear()
  }

  /**
   * Aplica o uso e desgaste de unidades de potência apurado por P3-A.
   *
   * @param projectionReport Relatório estruturado de projeção (projectSessionPowerUnitUsage).
   * @param options Opções adicionais de injeção de modelo, simulação de falha ou modo local.
   */
  public async applySessionPowerUnitUsage(
    projectionReport: SessionPowerUnitUsageProjectionReport,
    options: ApplySessionPowerUnitUsageOptions = {},
  ): Promise<SessionPowerUnitUsageApplicationResult> {
    if (!projectionReport) {
      throw new Error('[applySessionPowerUnitUsage] Relatório de apuração ausente ou nulo.')
    }

    const { careerId, season, round, raceVariant, sessionKey } = projectionReport
    const journalKey = this.buildJournalKey(careerId, season, round, raceVariant)

    // 0. Proteção contra chamadas concorrentes para a mesma chave de sessão
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

    // 1. Verificar idempotência global da sessão
    const existingJournal = this.getJournal(careerId, season, round, raceVariant)
    if (existingJournal && existingJournal.status === 'COMPLETE') {
      // Sessão já foi 100% aplicada anteriormente
      const alreadyAppliedResults: UnitApplicationResult[] = projectionReport.projections.map(
        (proj) => ({
          driverId: proj.driverId,
          driverName: proj.driverName,
          teamId: proj.teamId,
          powerUnitId: proj.powerUnitId,
          status: 'ALREADY_APPLIED',
          distanceKmAdded: 0,
          wearDebitApplied: 0,
          message: `Sessão ${sessionKey} e unidade PU-${proj.powerUnitId} já aplicadas anteriormente.`,
        }),
      )

      return {
        sessionKey,
        careerId,
        season,
        round,
        raceVariant,
        status: 'ALREADY_APPLIED',
        journal: existingJournal,
        appliedCount: 0,
        alreadyAppliedCount: alreadyAppliedResults.length,
        pendingOrUnlinkedCount: 0,
        failedCount: 0,
        unitResults: alreadyAppliedResults,
      }
    }

    // 2. Inicializar ou retomar Journal
    const journal: PowerUnitUsageJournalEntry = existingJournal || {
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
    this.saveJournal(journal)

    const appliedUnitIdsSet = new Set<number>(journal.appliedUnitIds || [])
    const appliedDriverIdsSet = new Set<string>(journal.appliedDriverIds || [])

    const unitResults: UnitApplicationResult[] = []
    let appliedCount = 0
    let alreadyAppliedCount = 0
    let pendingOrUnlinkedCount = 0
    let failedCount = 0

    // Agrupar projeções por equipe para resolver TeamModel e aplicar lote consistente
    const projectionsByTeam = new Map<string, ParticipantPowerUnitUsageProjection[]>()
    for (const proj of projectionReport.projections) {
      const list = projectionsByTeam.get(proj.teamId) || []
      list.push(proj)
      projectionsByTeam.set(proj.teamId, list)
    }

    let globalUnitProcessingIndex = 0

    try {
      for (const [teamId, teamProjections] of projectionsByTeam.entries()) {
        // Obter TeamModel
        let team: TeamModel | null = null

        if (options.teamOverrides) {
          if (options.teamOverrides instanceof Map) {
            team = options.teamOverrides.get(teamId) || null
          } else {
            team = (options.teamOverrides as Record<string, TeamModel>)[teamId] || null
          }
        }

        if (!team && !options.dryRunOrLocalOnly) {
          try {
            team = await pb.collection('teams').getOne<TeamModel>(teamId)
          } catch {
            // Se não encontrou no PocketBase, permanece null
          }
        }

        for (const proj of teamProjections) {
          // Checar se o participante possui vínculo válido e débito reconhecido ou zero uso
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

          // Proteção de retomada por unidade: se já aplicada nesta sessão, ignorar novo débito
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

          // Localizar a unidade no histórico/inventário da equipe
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

          // Novos valores com precisão e limites canônicos [0, 100]
          const newMileage = Number((prevMileage + addDistance).toFixed(3))
          const newCond = Number(Math.max(0, Math.min(100, prevCond - wearDebit)).toFixed(2))
          const newWear = Number(Math.max(0, Math.min(100, 100 - newCond)).toFixed(2))

          // Atualizar o registro da unidade
          history[unitIndex] = {
            ...existingUnit,
            mileage_km: newMileage,
            condition: newCond,
            wear: newWear,
          }

          // Persistir no TeamModel
          team.engine_history = history
          if (
            team.id === proj.teamId &&
            (existingUnit.status === 'instalado' || !existingUnit.status)
          ) {
            // Se for unidade ativa, sincronizar active_engine_wear
            team.active_engine_wear = newWear
          }

          // Se não estiver em modo local apenas, sincronizar com PocketBase
          if (!options.dryRunOrLocalOnly && pb?.collection) {
            try {
              await pb.collection('teams').update(team.id, {
                engine_history: history,
                active_engine_wear: team.active_engine_wear,
              })
            } catch (persistErr: any) {
              failedCount++
              unitResults.push({
                driverId: proj.driverId,
                driverName: proj.driverName,
                teamId: proj.teamId,
                powerUnitId: puId,
                status: 'FAILED_PERSISTENCE',
                distanceKmAdded: 0,
                wearDebitApplied: 0,
                message: `Falha ao persistir no PocketBase: ${persistErr?.message || 'erro de rede/banco'}`,
              })
              throw new Error(
                `Falha de persistência da unidade PU-${puId} na equipe ${team.id}: ${persistErr?.message}`,
              )
            }
          }

          // Unidade gravada com sucesso!
          globalUnitProcessingIndex++
          appliedUnitIdsSet.add(puId)
          appliedDriverIdsSet.add(proj.driverId)
          journal.appliedUnitIds = Array.from(appliedUnitIdsSet)
          journal.appliedDriverIds = Array.from(appliedDriverIdsSet)
          this.saveJournal(journal)

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

          // Simulação de falha controlada para testes de tolerância e retomada
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

      // Conclusão com sucesso
      const finalStatus: PowerUnitApplicationStatus =
        failedCount > 0
          ? 'PARTIAL'
          : appliedCount > 0 || alreadyAppliedCount > 0
            ? 'COMPLETE'
            : 'COMPLETE'

      journal.status = finalStatus
      journal.completedAt = new Date().toISOString()
      journal.lastError = undefined
      this.saveJournal(journal)

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
      this.saveJournal(journal)

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
