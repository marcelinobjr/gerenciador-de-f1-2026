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
import { ClientResponseError } from 'pocketbase'
import { loadVersionedRaceConfig, RaceConfigLoadError } from '@/lib/race/loader'
import type { VersionedRaceConfig } from '@/lib/race/types'
import {
  calculatePracticeSetupGain,
  applySetupCap,
  DEFAULT_SOURCE_RACE_PARAMETERS,
} from '@/lib/race/pureRaceEngine'
import { createMulberry32 } from '@/services/weatherGenerator'

export type PracticeSessionId = 'TL1' | 'TL2' | 'TL3'

export interface PracticeSessionRulesResolved {
  session: PracticeSessionId
  planned_laps: number
  max_setup_gain: number
  time_offset_sec?: number
  soft_tyre_prob?: number
}

export interface PracticeSetupApplicationInputs {
  careerId: string
  seasonId: string
  round: number
  session: PracticeSessionId
  teamId: string
  carIndex: 1 | 2
  driverId: string
  configVersion: string
  completedLaps: number
  consistency: number
  previousSetup?: number // Opcional: se omitido, busca da persistência do carro/vaga
  uniformSetupDraw?: number
  prngSeed?: number
  isSprint?: boolean
}

export interface PracticeSetupApplicationRecord {
  applicationKey: string
  careerId: string
  seasonId: string
  round: number
  session: PracticeSessionId
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

export type WeekendNormalStatus = 'TL1' | 'TL2' | 'TL3' | 'READY_FOR_Q1'

export interface WeekendNormalState {
  careerId: string
  seasonId: string
  round: number
  status: WeekendNormalStatus
  lastCompletedSession: PracticeSessionId | null
  carSetups: Record<
    string, // carKey: `${teamId}_c${carIndex}`
    {
      teamId: string
      carIndex: 1 | 2
      accumulatedSetup: number
      qualifyingBonusSeconds: number
      raceBonusSecondsPerLap: number
      lastDriverId: string
      sessionsCompleted: PracticeSessionId[]
    }
  >
}

export class RacePracticeSetupService {
  // Deduplicação in-flight de requisições GET para a collection session_setups (BUG-429-SETUPS-A):
  // Map<canonicalKey, Promise<Result>>
  // canonicalKey: `team_id::${careerId}::season_id::${seasonId}::round::${round}::session::${internalSession}`
  private inFlightSessionSetupRequests = new Map<
    string,
    Promise<Record<string, PracticeSetupApplicationRecord> | null>
  >()

  /**
   * Constrói a chave canônica estável que representa univocamente a consulta real ao PocketBase:
   * collection session_setups com filtro:
   * team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "${internalSession}"
   */
  public buildSessionSetupCanonicalKey(
    careerId: string,
    seasonId: string,
    round: number,
    internalSession: string,
  ): string {
    return `team_id::${careerId}::season_id::${seasonId}::round::${round}::session::${internalSession}`
  }

  /**
   * Retorna a quantidade atual de requisições in-flight (para inspeção e testes).
   */
  public getInFlightRequestsCount(): number {
    return this.inFlightSessionSetupRequests.size
  }

  /**
   * Limpa o mapa in-flight (útil para testes ou reinicialização de estado).
   */
  public clearInFlightRequests(): void {
    this.inFlightSessionSetupRequests.clear()
  }

  /**
   * Mantido para compatibilidade retroativa de limpeza em testes.
   */
  public clearMemoryCache(): void {
    this.clearInFlightRequests()
  }

  /**
   * Busca no PocketBase a coleção session_setups com deduplicação estrita de requests in-flight.
   *
   * Comportamento:
   * - Primeira chamada para a chave → cria GET e registra Promise no Map in-flight;
   * - Segunda chamada para a mesma chave enquanto a primeira está pendente → reutiliza a mesma Promise;
   * - Não dispara segundo GET;
   * - Ao resolver ou rejeitar → remove a Promise do Map imediatamente (via finally);
   * - Não mantém Promise rejeitada;
   * - Não cria cache permanente acidental;
   * - Não esconde erros (rejeição é propagada para quem aguardava).
   */
  private async fetchSessionSetupStore(
    careerId: string,
    seasonId: string,
    round: number,
    internalSession: string,
  ): Promise<Record<string, PracticeSetupApplicationRecord> | null> {
    const canonicalKey = this.buildSessionSetupCanonicalKey(
      careerId,
      seasonId,
      round,
      internalSession,
    )

    // Se já existe uma requisição em voo para essa mesma chave canônica, reutiliza a mesma Promise
    const existingPromise = this.inFlightSessionSetupRequests.get(canonicalKey)
    if (existingPromise) {
      return existingPromise
    }

    const queryPromise = (async () => {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "${internalSession}"`,
      })

      let resolvedStore: Record<string, PracticeSetupApplicationRecord> | null = null
      if (records && records.items && records.items.length > 0) {
        const item = records.items[0]
        const strategies = (item.driver_strategies as any) || {}
        resolvedStore =
          (strategies.practiceSetupApplications as Record<
            string,
            PracticeSetupApplicationRecord
          >) || null
      }

      return resolvedStore
    })().finally(() => {
      // Ao resolver ou rejeitar, remove a Promise do mapa imediatamente
      this.inFlightSessionSetupRequests.delete(canonicalKey)
    })

    this.inFlightSessionSetupRequests.set(canonicalKey, queryPromise)
    return queryPromise
  }

  /**
   * Resolve as regras de treinos a partir da configuração versionada.
   * Não hardcoda valores caso a tabela practice_sessions exista no snapshot.
   */
  public resolvePracticeSessionRules(
    config: VersionedRaceConfig,
    session: PracticeSessionId,
  ): PracticeSessionRulesResolved {
    const tables = config.tables as Record<string, unknown> | undefined

    // 1. Tenta obter de tables.practices (formato array do snapshot migration 1741500047)
    if (tables?.practices && Array.isArray(tables.practices)) {
      const found = tables.practices.find((p: any) => p.session === session)
      if (found) {
        return {
          session,
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
            session,
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
   * Apura e persiste canonicamente o acerto de treinos (TL1, TL2, TL3).
   * Totalmente idempotente:
   * - Se já existir registro para a mesma aplicação com as mesmas entradas, retorna o registro existente.
   * - Se existir registro mas com parâmetros conflitantes, sinaliza conflito explícito.
   * - Em execução nova, calcula via função pura, grava no PocketBase e espelha em cache.
   * - Rejeita rigorosamente TL2/TL3 quando isSprint === true.
   * - Em fins de semana normais, garante ordem estrita (TL2 requer TL1 concluído; TL3 requer TL2).
   */
  public async processAndPersistPracticeSetup(
    session: PracticeSessionId,
    inputs: PracticeSetupApplicationInputs,
  ): Promise<PracticeSetupProcessResult> {
    const {
      careerId,
      seasonId,
      round,
      teamId,
      carIndex,
      driverId,
      configVersion,
      completedLaps,
      consistency,
      previousSetup: directPrevSetup,
      uniformSetupDraw,
      prngSeed,
      isSprint = false,
    } = inputs

    // 1. Verificação estrita de formato SPRINT:
    // Rejeitar TL2 e TL3 quando isSprint for true
    if (isSprint && (session === 'TL2' || session === 'TL3')) {
      throw new Error(
        `Sessão '${session}' não é realizada em formato de fim de semana Sprint (apenas TL1 é disputado).`,
      )
    }

    // 2. Validações prévias estritas
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
    if (session !== 'TL1' && session !== 'TL2' && session !== 'TL3') {
      throw new Error(`Sessão '${session}' não suportada (apenas 'TL1', 'TL2' ou 'TL3').`)
    }
    if (completedLaps < 0 || !Number.isFinite(completedLaps)) {
      throw new Error(`Voltas completadas inválidas: ${completedLaps}`)
    }
    if (consistency < 0 || consistency > 100 || !Number.isFinite(consistency)) {
      throw new Error(`Consistência do piloto inválida (deve ser entre 0 e 100): ${consistency}`)
    }

    // 3. Carrega configuração versionada explícita (falha explicitamente ANTES de gravar)
    const config = await loadVersionedRaceConfig(configVersion)
    if (!config || !config.parameters) {
      throw new RaceConfigLoadError(
        `Configuração de corrida '${configVersion}' inválida ou ausente.`,
      )
    }

    const rules = this.resolvePracticeSessionRules(config, session)

    // 4. Monta chave determinística do fato
    const factKey = buildPracticeSetupFactKey({
      careerId,
      seasonId,
      round,
      session,
      teamId,
      carIndex,
    })

    // 5. Checagem de registro prévio existente (Idempotência / Reload)
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
        (directPrevSetup === undefined || existing.previousSetup === directPrevSetup)

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

    // 6. Resolução estrita da ordem regulamentar e do acerto anterior (previousSetup)
    // Se a aplicação é TL2, requer TL1 para este carro/vaga.
    // Se a aplicação é TL3, requer TL2 para este carro/vaga.
    let resolvedPreviousSetup = directPrevSetup

    if (session === 'TL2') {
      const tl1Key = buildPracticeSetupFactKey({
        careerId,
        seasonId,
        round,
        session: 'TL1',
        teamId,
        carIndex,
      })
      const tl1Record = await this.loadPersistedApplication(
        careerId,
        seasonId,
        round,
        'TL1',
        tl1Key,
      )
      if (!tl1Record) {
        throw new Error(
          `Sessão TL2 inválida: o TL1 para o Carro ${carIndex} (${teamId}) ainda não foi concluído e persistido.`,
        )
      }
      if (resolvedPreviousSetup === undefined) {
        resolvedPreviousSetup = tl1Record.accumulatedSetup
      }
    } else if (session === 'TL3') {
      const tl2Key = buildPracticeSetupFactKey({
        careerId,
        seasonId,
        round,
        session: 'TL2',
        teamId,
        carIndex,
      })
      const tl2Record = await this.loadPersistedApplication(
        careerId,
        seasonId,
        round,
        'TL2',
        tl2Key,
      )
      if (!tl2Record) {
        throw new Error(
          `Sessão TL3 inválida: o TL2 para o Carro ${carIndex} (${teamId}) ainda não foi concluído e persistido.`,
        )
      }
      if (resolvedPreviousSetup === undefined) {
        resolvedPreviousSetup = tl2Record.accumulatedSetup
      }
    } else {
      // TL1
      if (resolvedPreviousSetup === undefined) {
        resolvedPreviousSetup = 0
      }
    }

    if (
      resolvedPreviousSetup < 0 ||
      resolvedPreviousSetup > 100 ||
      !Number.isFinite(resolvedPreviousSetup)
    ) {
      throw new Error(`Acerto anterior inválido (deve ser entre 0 e 100): ${resolvedPreviousSetup}`)
    }

    // 7. Determinação do sorteio uniforme de ganho
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

    // 8. Cálculo funcional através da função pura (pureRaceEngine.ts)
    const gainResult = calculatePracticeSetupGain({
      planned_laps: rules.planned_laps,
      completed_laps: completedLaps,
      max_gain: rules.max_setup_gain,
      consistency,
      uniform_setup_draw: draw,
    })

    const capResult = applySetupCap({
      previous_setup: resolvedPreviousSetup,
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
      previousSetup: resolvedPreviousSetup,
      sessionGain: gainResult.gain,
      accumulatedSetup: capResult.new_setup,
      qualifyingBonusSeconds,
      raceBonusSecondsPerLap,
      appliedAt: new Date().toISOString(),
    }

    // 9. Persistência Canônica no PocketBase (session_setups) e no Cache Local
    await this.persistApplication(record)

    return {
      record,
      isAlreadyCompleted: false,
    }
  }

  /**
   * Compatibilidade retroativa para TL1: delega para processAndPersistPracticeSetup('TL1', inputs).
   */
  public async processAndPersistTL1Setup(
    inputs: PracticeSetupApplicationInputs,
  ): Promise<PracticeSetupProcessResult> {
    return this.processAndPersistPracticeSetup(inputs.session || 'TL1', inputs)
  }

  /**
   * Consulta o estado ATUAL acumulado do carro/vaga no fim de semana.
   * Garante a invariante: consultar TL1 após concluir TL3 NÃO rebaixa o acerto atual do carro!
   */
  public async getCarAccumulatedSetup(params: {
    careerId: string
    seasonId: string
    round: number
    teamId: string
    carIndex: 1 | 2
    isSprint?: boolean
  }): Promise<{
    accumulatedSetup: number
    lastCompletedSession: PracticeSessionId | null
    qualifyingBonusSeconds: number
    raceBonusSecondsPerLap: number
    isPracticeComplete: boolean
    nextStep: 'TL1' | 'TL2' | 'TL3' | 'Q1' | 'SQ1'
  }> {
    const { careerId, seasonId, round, teamId, carIndex, isSprint = false } = params

    try {
      // Tenta TL3 -> TL2 -> TL1 (ordem reversa para obter o estado mais avançado)
      const sessionsToCheck: PracticeSessionId[] = isSprint ? ['TL1'] : ['TL3', 'TL2', 'TL1']

      for (const sess of sessionsToCheck) {
        const factKey = buildPracticeSetupFactKey({
          careerId,
          seasonId,
          round,
          session: sess,
          teamId,
          carIndex,
        })
        const rec = await this.loadPersistedApplication(careerId, seasonId, round, sess, factKey)
        if (rec) {
          let isPracticeComplete = false
          let nextStep: 'TL1' | 'TL2' | 'TL3' | 'Q1' | 'SQ1' = 'TL1'

          if (isSprint) {
            if (sess === 'TL1') {
              isPracticeComplete = true
              nextStep = 'SQ1'
            }
          } else {
            if (sess === 'TL3') {
              isPracticeComplete = true
              nextStep = 'Q1'
            } else if (sess === 'TL2') {
              nextStep = 'TL3'
            } else if (sess === 'TL1') {
              nextStep = 'TL2'
            }
          }

          return {
            accumulatedSetup: rec.accumulatedSetup,
            lastCompletedSession: sess,
            qualifyingBonusSeconds: rec.qualifyingBonusSeconds,
            raceBonusSecondsPerLap: rec.raceBonusSecondsPerLap,
            isPracticeComplete,
            nextStep,
          }
        }
      }
    } catch (err: any) {
      console.warn(
        `[RacePracticeSetupService] Erro em getCarAccumulatedSetup (fallback padrão ativado):`,
        err?.message || err,
      )
    }

    return {
      accumulatedSetup: 0,
      lastCompletedSession: null,
      qualifyingBonusSeconds: 0,
      raceBonusSecondsPerLap: 0,
      isPracticeComplete: false,
      nextStep: 'TL1',
    }
  }

  /**
   * Retorna o estado consolidado do fim de semana NORMAL (TL1 -> TL2 -> TL3 -> READY_FOR_Q1).
   * O acerto pertence ao CARRO + FIM DE SEMANA.
   * Quando o TL3 é completado para o fim de semana, o status avança para READY_FOR_Q1.
   */
  public async getWeekendNormalState(params: {
    careerId: string
    seasonId: string
    round: number
    teamId: string
    cars?: (1 | 2)[]
  }): Promise<WeekendNormalState> {
    const { careerId, seasonId, round, teamId, cars = [1, 2] } = params
    const carSetups: WeekendNormalState['carSetups'] = {}
    const order: PracticeSessionId[] = ['TL1', 'TL2', 'TL3']
    const carCompletedIndices: number[] = []

    try {
      for (const carIndex of cars) {
        const carKey = `${teamId}_c${carIndex}`
        let accumulated = 0
        let qualiBonus = 0
        let raceBonus = 0
        let lastDriver = ''
        const completedList: PracticeSessionId[] = []
        let carMaxIndex = -1

        for (let i = 0; i < order.length; i++) {
          const sess = order[i]
          const factKey = buildPracticeSetupFactKey({
            careerId,
            seasonId,
            round,
            session: sess,
            teamId,
            carIndex,
          })
          const rec = await this.loadPersistedApplication(careerId, seasonId, round, sess, factKey)
          if (rec) {
            accumulated = rec.accumulatedSetup
            qualiBonus = rec.qualifyingBonusSeconds
            raceBonus = rec.raceBonusSecondsPerLap
            lastDriver = rec.driverId
            completedList.push(sess)
            carMaxIndex = i
          }
        }

        carCompletedIndices.push(carMaxIndex)

        carSetups[carKey] = {
          teamId,
          carIndex,
          accumulatedSetup: accumulated,
          qualifyingBonusSeconds: qualiBonus,
          raceBonusSecondsPerLap: raceBonus,
          lastDriverId: lastDriver,
          sessionsCompleted: completedList,
        }
      }

      // O status do fim de semana da equipe exige que todos os carros participantes
      // tenham completado a sessão para a sessão como um todo ser considerada concluída.
      // minIndex representa a sessão que TODOS os carros concluíram.
      const minIndex = carCompletedIndices.length > 0 ? Math.min(...carCompletedIndices) : -1

      let status: WeekendNormalStatus = 'TL1'
      let lastCompletedSession: PracticeSessionId | null = null

      if (minIndex === 0) {
        status = 'TL2'
        lastCompletedSession = 'TL1'
      } else if (minIndex === 1) {
        status = 'TL3'
        lastCompletedSession = 'TL2'
      } else if (minIndex >= 2) {
        status = 'READY_FOR_Q1'
        lastCompletedSession = 'TL3'
      }

      return {
        careerId,
        seasonId,
        round,
        status,
        lastCompletedSession,
        carSetups,
      }
    } catch (err: any) {
      console.warn(
        `[RacePracticeSetupService] Erro em getWeekendNormalState (fallback seguro):`,
        err?.message || err,
      )
      return {
        careerId,
        seasonId,
        round,
        status: 'TL1',
        lastCompletedSession: null,
        carSetups,
      }
    }
  }

  /**
   * Consulta um registro previamente persistido de apuração de treinos livres.
   */
  public async loadPersistedApplication(
    careerId: string,
    seasonId: string,
    round: number,
    session: PracticeSessionId,
    applicationKey: string,
  ): Promise<PracticeSetupApplicationRecord | null> {
    // 1. Tentar ler do PocketBase na coleção session_setups (com deduplicação in-flight de requisição)
    const sessionInternalMap: Record<PracticeSessionId, string> = {
      TL1: 'tp1',
      TL2: 'tp2',
      TL3: 'tp3',
    }
    const internalSession = sessionInternalMap[session] || 'tp1'

    try {
      const setupStore = await this.fetchSessionSetupStore(
        careerId,
        seasonId,
        round,
        internalSession,
      )
      if (setupStore && setupStore[applicationKey]) {
        // Atualiza o cache local com o valor válido recebido do backend
        this.saveToLocalCache(careerId, seasonId, round, session, setupStore[applicationKey])
        return setupStore[applicationKey]
      }
    } catch (err: unknown) {
      if (err instanceof ClientResponseError && err.status === 429) {
        return null
      }

      throw err
    }

    // 2. Sem erro 429, consulta concluída com sucesso: se não encontrou no backend, consulta cache local
    return this.readFromLocalCache(careerId, seasonId, round, session, applicationKey)
  }

  /**
   * Persiste canonicamente o registro no PocketBase dentro de session_setups.driver_strategies.practiceSetupApplications
   * e espelha no cache local.
   */
  private async persistApplication(record: PracticeSetupApplicationRecord): Promise<void> {
    const { careerId, seasonId, round, session, applicationKey } = record

    const sessionInternalMap: Record<PracticeSessionId, string> = {
      TL1: 'tp1',
      TL2: 'tp2',
      TL3: 'tp3',
    }
    const internalSession = sessionInternalMap[session] || 'tp1'

    try {
      const { canonicalSessionSetupPersistenceService } =
        await import('@/services/canonicalSessionSetupPersistenceService')
      await canonicalSessionSetupPersistenceService.upsertSessionSetup({
        teamId: careerId,
        seasonId,
        round,
        session: internalSession,
        payload: {
          wing_level: 6,
          suspension_stiffness: 6,
          pu_electric_ratio: 50,
          driver_strategies: {
            practiceSetupApplications: {
              [applicationKey]: record,
            },
          },
        },
        mergeWithExisting: (existingItem) => {
          const currentStrategies = (existingItem?.driver_strategies as any) || {}
          const currentApps = currentStrategies.practiceSetupApplications || {}
          const mergedApps = {
            ...currentApps,
            [applicationKey]: record,
          }
          const mergedStrategies = {
            ...currentStrategies,
            practiceSetupApplications: mergedApps,
          }
          return {
            driver_strategies: mergedStrategies,
          }
        },
      })
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
