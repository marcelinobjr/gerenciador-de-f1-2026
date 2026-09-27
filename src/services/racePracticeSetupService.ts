/**
 * src/services/racePracticeSetupService.ts
 *
 * Serviço canônico de Apuração e Persistência do Acerto de Treino Livre (RACE-TL-01A).
 * Foco estrito: Apuração do Acerto de TL1 para um participante/carro,
 * cálculo através da função pura (pureRaceEngine.ts), gravação canônica idempotente
 * em session_setups (PocketBase) com cache resiliente, e recuperação exata após reload.
 *
 * CONTRATO E INVARIANTES:
 * 1. Entrada explícita: careerId, seasonId, round, session ('TL1'), teamId, carIndex (1|2),
 *    driverId, configVersion, completedLaps, consistency, previousSetup, uniformSetupDraw.
 * 2. Validação: Falha explicitamente ANTES de qualquer gravação se configVersion ou entradas forem inválidas.
 * 3. Função pura: Consome calculatePracticeSetupGain e applySetupCap de pureRaceEngine.ts.
 * 4. Persistência canônica: Armazenamento em PocketBase collection 'session_setups' (com mirror em cache local).
 * 5. Idempotência estrita: Identificador estável determinístico baseado em
 *    `tl_setup_${careerId}_${seasonId}_r${round}_${session}_${teamId}_c${carIndex}`.
 *    Repetição da mesma solicitação devolve o resultado existente sem recalcular nem sortear de novo.
 *    Solicitação com entradas incompatíveis para fato já gravado sinaliza conflito.
 * 6. Sem efeitos colaterais permanentes: Não altera atributos de pilotos ou carros,
 *    não conclui fim de semana, não avança rodadas.
 */

import pb from '@/lib/pocketbase/client'
import { loadVersionedRaceConfig, RaceConfigLoadError } from '@/lib/race/loader'
import type { VersionedRaceConfig } from '@/lib/race/types'
import {
  calculatePracticeSetupGain,
  applySetupCap,
  DEFAULT_SOURCE_RACE_PARAMETERS,
} from '@/lib/race/pureRaceEngine'
import { createMulberry32 } from '@/services/weatherGenerator'

export interface PracticeSessionRulesResolved {
  session: 'TL1'
  planned_laps: number
  max_setup_gain: number
  time_offset_sec?: number
  soft_tyre_prob?: number
}

export interface PracticeSetupApplicationInputs {
  careerId: string
  seasonId: string
  round: number
  session: 'TL1'
  teamId: string
  carIndex: 1 | 2
  driverId: string
  configVersion: string
  completedLaps: number
  consistency: number
  previousSetup: number
  uniformSetupDraw?: number
  prngSeed?: number
}

export interface PracticeSetupApplicationRecord {
  applicationKey: string
  careerId: string
  seasonId: string
  round: number
  session: 'TL1'
  teamId: string
  carIndex: 1 | 2
  driverId: string
  configVersion: string
  configSha256?: string
  plannedLaps: number
  completedLaps: number
  consistency: number
  uniformSetupDraw: number
  previousSetup: number
  sessionGain: number
  accumulatedSetup: number
  qualifyingBonusSeconds: number
  raceBonusSecondsPerLap: number
  appliedAt: string
}

export interface PracticeSetupProcessResult {
  record: PracticeSetupApplicationRecord
  isAlreadyCompleted: boolean
}

/**
 * Constrói a chave determinística e estável de apuração do acerto da sessão.
 */
export function buildPracticeSetupFactKey(params: {
  careerId: string
  seasonId: string
  round: number
  session: string
  teamId: string
  carIndex: number
}): string {
  return `tl_setup_${params.careerId}_${params.seasonId}_r${params.round}_${params.session}_${params.teamId}_c${params.carIndex}`
}

/**
 * Obtém a chave de cache local síncrono.
 */
export function getPracticeSetupStorageKey(
  careerId: string,
  seasonId: string,
  round: number,
  session: string,
): string {
  return `apex_practice_setup_${careerId}_${seasonId}_r${round}_${session}`
}

export class RacePracticeSetupService {
  /**
   * Resolve as regras de TL1 a partir da configuração versionada.
   * Não hardcoda valores caso a tabela practice_sessions exista no snapshot.
   */
  public resolvePracticeSessionRules(
    config: VersionedRaceConfig,
    session: 'TL1',
  ): PracticeSessionRulesResolved {
    const tables = config.tables as Record<string, unknown> | undefined

    // 1. Tenta obter de tables.practices (formato array do snapshot migration 1741500047)
    if (tables?.practices && Array.isArray(tables.practices)) {
      const found = tables.practices.find((p: any) => p.session === session)
      if (found) {
        return {
          session: 'TL1',
          planned_laps: Number(found.laps),
          max_setup_gain: Number(found.max_setup_gain),
          time_offset_sec:
            found.time_offset_sec !== undefined ? Number(found.time_offset_sec) : undefined,
          soft_tyre_prob:
            found.soft_tyre_prob !== undefined ? Number(found.soft_tyre_prob) : undefined,
        }
      }
    }

    // 2. Tenta obter de tables.practice_sessions (formato cru do JSON 01)
    if (tables?.practice_sessions && typeof tables.practice_sessions === 'object') {
      const ps = tables.practice_sessions as any
      if (Array.isArray(ps.rows)) {
        const row = ps.rows.find((r: any) => r.values?.E === session)
        if (row && row.values) {
          return {
            session: 'TL1',
            planned_laps: Number(row.values.F),
            max_setup_gain: Number(row.values.G),
            time_offset_sec: Number(row.values.H),
            soft_tyre_prob: Number(row.values.I),
          }
        }
      }
    }

    throw new RaceConfigLoadError(
      `Tabela de sessões de treino ('practices' ou 'practice_sessions') não encontrada ou incompleta na versão '${config.version}' para sessão '${session}'.`,
    )
  }

  /**
   * Apura e persiste canonicamente o acerto do TL1.
   * Totalmente idempotente:
   * - Se já existir registro para a mesma aplicação com as mesmas entradas, retorna o registro existente.
   * - Se existir registro mas com parâmetros conflitantes, sinaliza conflito explícito.
   * - Em execução nova, calcula via função pura, grava no PocketBase e espelha em cache.
   */
  public async processAndPersistTL1Setup(
    inputs: PracticeSetupApplicationInputs,
  ): Promise<PracticeSetupProcessResult> {
    const {
      careerId,
      seasonId,
      round,
      session,
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps,
      consistency,
      previousSetup,
      uniformSetupDraw,
      prngSeed,
    } = inputs

    // 1. Validações prévias estritas
    if (!configVersion || typeof configVersion !== 'string' || configVersion.trim() === '') {
      throw new RaceConfigLoadError(
        'Versão da configuração não informada. Versão explícita é obrigatória.',
      )
    }
    if (!careerId || !seasonId || round <= 0) {
      throw new Error(
        `Contexto de carreira/fim de semana inválido: careerId='${careerId}', seasonId='${seasonId}', round=${round}`,
      )
    }
    if (!teamId || !driverId || (carIndex !== 1 && carIndex !== 2)) {
      throw new Error(
        `Identificação do participante inválida: teamId='${teamId}', carIndex=${carIndex}, driverId='${driverId}'`,
      )
    }
    if (session !== 'TL1') {
      throw new Error(`Sessão '${session}' não suportada nesta microentrega (apenas 'TL1').`)
    }
    if (completedLaps < 0 || !Number.isFinite(completedLaps)) {
      throw new Error(`Voltas completadas inválidas: ${completedLaps}`)
    }
    if (consistency < 0 || consistency > 100 || !Number.isFinite(consistency)) {
      throw new Error(`Consistência do piloto inválida (deve ser entre 0 e 100): ${consistency}`)
    }
    if (previousSetup < 0 || previousSetup > 100 || !Number.isFinite(previousSetup)) {
      throw new Error(`Acerto anterior inválido (deve ser entre 0 e 100): ${previousSetup}`)
    }

    // 2. Carrega configuração versionada explícita (falha explicitamente ANTES de gravar)
    const config = await loadVersionedRaceConfig(configVersion)
    if (!config || !config.parameters) {
      throw new RaceConfigLoadError(
        `Configuração de corrida '${configVersion}' inválida ou ausente.`,
      )
    }

    const rules = this.resolvePracticeSessionRules(config, session)

    // 3. Monta chave determinística
    const factKey = buildPracticeSetupFactKey({
      careerId,
      seasonId,
      round,
      session,
      teamId,
      carIndex,
    })

    // 4. Checagem de registro prévio existente (Idempotência / Reload)
    const existing = await this.loadPersistedApplication(
      careerId,
      seasonId,
      round,
      session,
      factKey,
    )
    if (existing) {
      // Validação de consistência do registro existente
      const isMatch =
        existing.driverId === driverId &&
        existing.configVersion === configVersion &&
        existing.completedLaps === completedLaps &&
        existing.consistency === consistency &&
        existing.previousSetup === previousSetup

      if (!isMatch) {
        throw new Error(
          `Conflito de aplicação para a chave '${factKey}': a sessão já foi processada com parâmetros distintos e não pode ser sobrescrita silenciosamente.`,
        )
      }

      return {
        record: existing,
        isAlreadyCompleted: true,
      }
    }

    // 5. Determinação do sorteio uniforme de ganho
    let draw = uniformSetupDraw
    if (draw === undefined) {
      if (prngSeed !== undefined) {
        const rng = createMulberry32(prngSeed)
        draw = rng()
      } else {
        // Fallback default neutro da especificação
        draw = 0.5
      }
    }

    if (draw < 0 || draw > 1 || !Number.isFinite(draw)) {
      throw new Error(`Sorteio uniforme de acerto inválido (deve estar entre 0 e 1): ${draw}`)
    }

    // 6. Cálculo funcional através da função pura (pureRaceEngine.ts)
    const gainResult = calculatePracticeSetupGain({
      planned_laps: rules.planned_laps,
      completed_laps: completedLaps,
      max_gain: rules.max_setup_gain,
      consistency,
      uniform_setup_draw: draw,
    })

    const capResult = applySetupCap({
      previous_setup: previousSetup,
      session_gain: gainResult.gain,
    })

    const maxQualiBonus =
      config.parameters.max_setup_qualifying_bonus_seconds ??
      DEFAULT_SOURCE_RACE_PARAMETERS.max_setup_qualifying_bonus_seconds
    const maxRaceBonus =
      config.parameters.max_setup_race_bonus_seconds_per_lap ??
      DEFAULT_SOURCE_RACE_PARAMETERS.max_setup_race_bonus_seconds_per_lap

    const qualifyingBonusSeconds = (capResult.new_setup / 100) * maxQualiBonus
    const raceBonusSecondsPerLap = (capResult.new_setup / 100) * maxRaceBonus

    const record: PracticeSetupApplicationRecord = {
      applicationKey: factKey,
      careerId,
      seasonId,
      round,
      session,
      teamId,
      carIndex,
      driverId,
      configVersion: config.version,
      configSha256: config.sha256,
      plannedLaps: rules.planned_laps,
      completedLaps,
      consistency,
      uniformSetupDraw: draw,
      previousSetup,
      sessionGain: gainResult.gain,
      accumulatedSetup: capResult.new_setup,
      qualifyingBonusSeconds,
      raceBonusSecondsPerLap,
      appliedAt: new Date().toISOString(),
    }

    // 7. Persistência Canônica no PocketBase (session_setups) e no Cache Local
    await this.persistApplication(record)

    return {
      record,
      isAlreadyCompleted: false,
    }
  }

  /**
   * Consulta um registro previamente persistido de apuração de TL1.
   */
  public async loadPersistedApplication(
    careerId: string,
    seasonId: string,
    round: number,
    session: 'TL1',
    applicationKey: string,
  ): Promise<PracticeSetupApplicationRecord | null> {
    // 1. Tentar ler do PocketBase na coleção session_setups
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "tp1"`,
      })

      if (records.items.length > 0) {
        const item = records.items[0]
        const strategies = (item.driver_strategies as any) || {}
        const setupStore = strategies.practiceSetupApplications as
          | Record<string, PracticeSetupApplicationRecord>
          | undefined

        if (setupStore && setupStore[applicationKey]) {
          return setupStore[applicationKey]
        }
      }
    } catch {
      // Ignora erro de rede/mock do PB e tenta o cache local
    }

    // 2. Fallback de resiliência: Cache local
    return this.readFromLocalCache(careerId, seasonId, round, session, applicationKey)
  }

  /**
   * Persiste canonicamente o registro no PocketBase dentro de session_setups.driver_strategies.practiceSetupApplications
   * e espelha no cache local.
   */
  private async persistApplication(record: PracticeSetupApplicationRecord): Promise<void> {
    const { careerId, seasonId, round, session, applicationKey } = record

    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "tp1"`,
      })

      if (records.items.length > 0) {
        const existingItem = records.items[0]
        const currentStrategies = (existingItem.driver_strategies as any) || {}
        const currentApps = currentStrategies.practiceSetupApplications || {}

        // Atualização atômica / merge com proteção de chave estável
        const mergedApps = {
          ...currentApps,
          [applicationKey]: record,
        }

        const mergedStrategies = {
          ...currentStrategies,
          practiceSetupApplications: mergedApps,
        }

        await pb.collection('session_setups').update(existingItem.id, {
          driver_strategies: mergedStrategies,
          notes: JSON.stringify(mergedStrategies),
        })
      } else {
        const newRecordPayload = {
          team_id: careerId,
          season_id: seasonId,
          round,
          session: 'tp1',
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            practiceSetupApplications: {
              [applicationKey]: record,
            },
          },
          notes: JSON.stringify({
            practiceSetupApplications: {
              [applicationKey]: record,
            },
          }),
        }

        await pb.collection('session_setups').create(newRecordPayload)
      }
    } catch (err) {
      console.warn(
        `[RacePracticeSetupService] Erro ao persistir no PocketBase (session_setups), espelhando no cache local:`,
        err,
      )
    }

    // Espelho no armazenamento local resiliente
    this.saveToLocalCache(careerId, seasonId, round, session, record)
  }

  private saveToLocalCache(
    careerId: string,
    seasonId: string,
    round: number,
    session: string,
    record: PracticeSetupApplicationRecord,
  ): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = getPracticeSetupStorageKey(careerId, seasonId, round, session)
      const raw = localStorage.getItem(key)
      const data: Record<string, PracticeSetupApplicationRecord> = raw ? JSON.parse(raw) : {}
      data[record.applicationKey] = record
      localStorage.setItem(key, JSON.stringify(data))
    } catch {
      /* ignore */
    }
  }

  private readFromLocalCache(
    careerId: string,
    seasonId: string,
    round: number,
    session: string,
    applicationKey: string,
  ): PracticeSetupApplicationRecord | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const key = getPracticeSetupStorageKey(careerId, seasonId, round, session)
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const data = JSON.parse(raw) as Record<string, PracticeSetupApplicationRecord>
      return data[applicationKey] || null
    } catch {
      return null
    }
  }
}

export const racePracticeSetupService = new RacePracticeSetupService()
export default racePracticeSetupService
