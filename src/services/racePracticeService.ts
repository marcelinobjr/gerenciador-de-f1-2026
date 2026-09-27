/**
 * src/services/racePracticeService.ts
 *
 * Serviço de execução e persistência canônica dos Treinos Livres com acerto persistido (RACE-TL-01).
 *
 * Responsabilidades:
 * 1. Resolução estrita da configuração versionada vinculada à carreira de teste.
 * 2. Orquestração determinística de sessões de TL (TL1, TL2, TL3) para fim de semana normal e sprint.
 * 3. Escalação correta de pilotos por vaga de carro (Carro 1 e Carro 2), incluindo reservas no TL1.
 * 4. Persistência de acerto e histórico no LocalStorage / race_sessions com imutabilidade e idempotência.
 * 5. Bônus de acerto disponibilizado (qualificação 0..0.25s e corrida 0..0.15s/volta) sem alterar atributos permanentes.
 */

import { loadVersionedRaceConfig, RaceConfigLoadError } from '../lib/race/loader'
import type { VersionedRaceConfig } from '../lib/race/types'
import {
  getPracticeSessionRules,
  executePracticeForCar,
  calculateCompletedLaps,
  type PersistedWeekendSetupState,
  type SessionParticipant,
  type PracticeSessionResultItem,
} from '../lib/race/practiceSessionIntegrator'

const STORAGE_PREFIX = 'apex_race_setup_state'

export function getWeekendSetupStorageKey(
  careerId: string,
  seasonId: string,
  round: number,
): string {
  return `${STORAGE_PREFIX}_${careerId}_${seasonId}_r${round}`
}

export class RacePracticeService {
  /**
   * Lê o estado persistido do fim de semana atual.
   */
  public getPersistedWeekendState(
    careerId: string,
    seasonId: string,
    round: number,
  ): PersistedWeekendSetupState | null {
    const key = getWeekendSetupStorageKey(careerId, seasonId, round)
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(raw) as PersistedWeekendSetupState
    } catch {
      return null
    }
  }

  /**
   * Salva o estado do fim de semana.
   */
  public savePersistedWeekendState(state: PersistedWeekendSetupState): void {
    const key = getWeekendSetupStorageKey(state.careerId, state.seasonId, state.round)
    localStorage.setItem(key, JSON.stringify(state))
  }

  /**
   * Inicializa ou carrega o estado de fim de semana para a carreira.
   */
  public async getOrInitWeekendState(params: {
    careerId: string
    seasonId: string
    round: number
    isSprint: boolean
    configVersion: string
  }): Promise<{ state: PersistedWeekendSetupState; config: VersionedRaceConfig }> {
    const { careerId, seasonId, round, isSprint, configVersion } = params

    // 1. Carregar configuração versionada explicitamente
    const config = await loadVersionedRaceConfig(configVersion)
    if (!config || !config.parameters) {
      throw new RaceConfigLoadError(
        `Configuração esportiva '${configVersion}' inválida ou não encontrada.`,
      )
    }

    const existing = this.getPersistedWeekendState(careerId, seasonId, round)
    if (existing) {
      // Verificar se a versão persistida bate com a solicitada
      if (existing.version !== config.version) {
        throw new RaceConfigLoadError(
          `Incompatibilidade de configuração de corrida: estado persistido possui versão '${existing.version}', solicitado '${config.version}'.`,
        )
      }
      return { state: existing, config }
    }

    const newState: PersistedWeekendSetupState = {
      version: config.version,
      sha256: config.sha256,
      careerId,
      seasonId,
      round,
      isSprint,
      lastCompletedSession: null,
      carSetups: {},
    }

    this.savePersistedWeekendState(newState)
    return { state: newState, config }
  }

  /**
   * Executa uma sessão de treino livre de forma determinística e idempotente.
   * Se a sessão já foi executada para a vaga do carro, recupera o mesmo resultado sem novos ganhos.
   */
  public async executeSession(params: {
    careerId: string
    seasonId: string
    round: number
    session: 'TL1' | 'TL2' | 'TL3'
    participants: SessionParticipant[]
    configVersion: string
    isSprint?: boolean
    deterministicDraws?: Record<
      string, // key: `${teamId}_car${carIndex}`
      {
        lapVariationDraw?: number // 0..1
        setupDraw?: number // 0..1
        compoundDraw?: number // 0..1
        forcedLaps?: number // se fornecido, usa este valor
      }
    >
  }): Promise<{
    state: PersistedWeekendSetupState
    results: PracticeSessionResultItem[]
    isAlreadyCompleted: boolean
  }> {
    const {
      careerId,
      seasonId,
      round,
      session,
      participants,
      configVersion,
      isSprint = false,
    } = params

    // Regra SPRINT: Em fim de semana sprint, apenas TL1 existe. TL2 e TL3 são NÃO REALIZADOS.
    if (isSprint && (session === 'TL2' || session === 'TL3')) {
      throw new Error(
        `Sessão ${session} não é permitida em formato de fim de semana Sprint (apenas TL1 é realizado).`,
      )
    }

    const { state, config } = await this.getOrInitWeekendState({
      careerId,
      seasonId,
      round,
      isSprint,
      configVersion,
    })

    // Regra NORMAL: Ordem estrita de progressão das sessões
    // TL2 só pode ser executado após conclusão do TL1
    // TL3 só pode ser executado após conclusão do TL2
    if (!isSprint) {
      if (session === 'TL2') {
        const hasTL1 =
          state.lastCompletedSession === 'TL1' ||
          state.lastCompletedSession === 'TL2' ||
          state.lastCompletedSession === 'TL3'
        if (!hasTL1) {
          throw new Error('Sessão TL2 não é permitida antes da conclusão do TL1.')
        }
      } else if (session === 'TL3') {
        const hasTL2 = state.lastCompletedSession === 'TL2' || state.lastCompletedSession === 'TL3'
        if (!hasTL2) {
          throw new Error('Sessão TL3 não é permitida antes da conclusão do TL2.')
        }
      }
    }

    const sessionRules = getPracticeSessionRules(config, session)
    const lapVariation = config.parameters.practice_lap_count_variation ?? 0.15

    const results: PracticeSessionResultItem[] = []
    let modified = false

    // Validação de unicidade de pilotos na sessão
    const driverIdsSeen = new Set<string>()
    for (const p of participants) {
      if (driverIdsSeen.has(p.driverId)) {
        throw new Error(
          `Piloto duplicado detectado na sessão ${session}: driverId '${p.driverId}' está escalado mais de uma vez.`,
        )
      }
      driverIdsSeen.add(p.driverId)
    }

    for (const p of participants) {
      const carKey = `${p.teamId}_car${p.carIndex}`
      let carRecord = state.carSetups[carKey]

      if (!carRecord) {
        carRecord = {
          teamId: p.teamId,
          carIndex: p.carIndex,
          accumulatedSetup: 0,
          qualifyingBonusSeconds: 0,
          raceBonusSecondsPerLap: 0,
          sessions: [],
        }
        state.carSetups[carKey] = carRecord
      }

      // IDEMPOTÊNCIA: Verificar se esta sessão já foi executada para este carro
      const existingSessionEntry = carRecord.sessions.find((s) => s.session === session)
      if (existingSessionEntry) {
        // Recuperar resultado persistido existente
        results.push({
          teamId: p.teamId,
          carIndex: p.carIndex,
          driverId: existingSessionEntry.driverId,
          isReserve: existingSessionEntry.isReserve,
          lapsCompleted: existingSessionEntry.lapsCompleted,
          plannedLaps: existingSessionEntry.plannedLaps,
          tyreCompound: existingSessionEntry.tyreCompound,
          sessionGain: existingSessionEntry.sessionGain,
          accumulatedSetup: existingSessionEntry.accumulatedSetup,
          qualifyingBonusSeconds: carRecord.qualifyingBonusSeconds,
          raceBonusSecondsPerLap: carRecord.raceBonusSecondsPerLap,
        })
        continue
      }

      // Cálculo de voltas concluídas
      const carDraws = params.deterministicDraws?.[carKey]
      let laps = carDraws?.forcedLaps
      if (laps === undefined) {
        const lapDraw = carDraws?.lapVariationDraw ?? 0.5
        laps = calculateCompletedLaps(sessionRules.laps, lapVariation, lapDraw)
      }

      const previousSetup = carRecord.accumulatedSetup

      // Execução pura
      const exec = executePracticeForCar({
        config,
        session,
        previousSetup,
        driverConsistency: p.consistency,
        lapsCompleted: laps,
        randomSetupDraw: carDraws?.setupDraw ?? 0.5,
        compoundDraw: carDraws?.compoundDraw ?? 0.5,
      })

      // Atualizar registro do carro
      carRecord.accumulatedSetup = exec.accumulatedSetup
      carRecord.qualifyingBonusSeconds = exec.qualifyingBonusSeconds
      carRecord.raceBonusSecondsPerLap = exec.raceBonusSecondsPerLap
      carRecord.sessions.push({
        session,
        driverId: p.driverId,
        isReserve: Boolean(p.isReserve),
        lapsCompleted: laps,
        plannedLaps: exec.plannedLaps,
        sessionGain: exec.sessionGain,
        accumulatedSetup: exec.accumulatedSetup,
        tyreCompound: exec.compoundUsed,
        timestamp: new Date().toISOString(),
      })

      modified = true

      results.push({
        teamId: p.teamId,
        carIndex: p.carIndex,
        driverId: p.driverId,
        isReserve: Boolean(p.isReserve),
        lapsCompleted: laps,
        plannedLaps: exec.plannedLaps,
        tyreCompound: exec.compoundUsed,
        sessionGain: exec.sessionGain,
        accumulatedSetup: exec.accumulatedSetup,
        qualifyingBonusSeconds: exec.qualifyingBonusSeconds,
        raceBonusSecondsPerLap: exec.raceBonusSecondsPerLap,
      })
    }

    if (modified) {
      state.lastCompletedSession = session
      this.savePersistedWeekendState(state)
    }

    return {
      state,
      results,
      isAlreadyCompleted: !modified,
    }
  }

  /**
   * Retorna o próximo passo regulamentar a partir do estado de treinos.
   * NORMAL:
   *   null -> TL1
   *   TL1 -> TL2
   *   TL2 -> TL3
   *   TL3 -> pronto para Q1
   * SPRINT:
   *   null -> TL1
   *   TL1 -> pronto para SQ1
   */
  public getNextStep(
    state: PersistedWeekendSetupState | null,
    isSprint: boolean,
  ): {
    nextSession: 'TL1' | 'TL2' | 'TL3' | 'Q1' | 'SQ1'
    statusDescription: string
    isPracticeComplete: boolean
  } {
    if (!state || !state.lastCompletedSession) {
      return {
        nextSession: 'TL1',
        statusDescription: 'Treinos Livres não iniciados. Próxima sessão: TL1',
        isPracticeComplete: false,
      }
    }

    if (isSprint) {
      if (state.lastCompletedSession === 'TL1') {
        return {
          nextSession: 'SQ1',
          statusDescription: 'Treino livre concluído. Fim de semana sprint pronto para SQ1.',
          isPracticeComplete: true,
        }
      }
    } else {
      switch (state.lastCompletedSession) {
        case 'TL1':
          return {
            nextSession: 'TL2',
            statusDescription: 'TL1 concluído. Próxima sessão: TL2',
            isPracticeComplete: false,
          }
        case 'TL2':
          return {
            nextSession: 'TL3',
            statusDescription: 'TL2 concluído. Próxima sessão: TL3',
            isPracticeComplete: false,
          }
        case 'TL3':
          return {
            nextSession: 'Q1',
            statusDescription: 'Todos os treinos livres concluídos. Pronto para Q1.',
            isPracticeComplete: true,
          }
      }
    }

    return {
      nextSession: 'TL1',
      statusDescription: 'Pronto para treinos livres.',
      isPracticeComplete: false,
    }
  }

  /**
   * Consulta os bônus de setup acumulados de uma vaga de carro para uso em sessões seguintes.
   */
  public getCarSetupBonus(
    careerId: string,
    seasonId: string,
    round: number,
    teamId: string,
    carIndex: 1 | 2,
  ): {
    accumulatedSetup: number
    qualifyingBonusSeconds: number
    raceBonusSecondsPerLap: number
  } {
    const state = this.getPersistedWeekendState(careerId, seasonId, round)
    if (!state) {
      return {
        accumulatedSetup: 0,
        qualifyingBonusSeconds: 0,
        raceBonusSecondsPerLap: 0,
      }
    }

    const car = state.carSetups[`${teamId}_car${carIndex}`]
    if (!car) {
      return {
        accumulatedSetup: 0,
        qualifyingBonusSeconds: 0,
        raceBonusSecondsPerLap: 0,
      }
    }

    return {
      accumulatedSetup: car.accumulatedSetup,
      qualifyingBonusSeconds: car.qualifyingBonusSeconds,
      raceBonusSecondsPerLap: car.raceBonusSecondsPerLap,
    }
  }
}

export const racePracticeService = new RacePracticeService()
