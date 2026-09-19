import pb from '@/lib/pocketbase/client'
import type {
  PracticeSessionRecordState,
  PracticeSessionStatus,
  PracticeCarLiveState,
  PracticeStint,
  PracticeLapRecord,
  PracticeTimeEntry,
  PracticeRadioFeedEvent,
} from '@/types/practice-session'
import { CANONICAL_PRACTICE_DURATION_SEC } from '@/types/practice-session'
import type { PracticePreparation, PracticeSessionType } from '@/types/practice-preparation'
import { getAICompetitors, type AICompetitor } from '@/lib/f1-data'
import { formatLapTime, formatGap } from '@/lib/f1-race-sim-engine'
import { resolveCircuitProfile } from '@/data/circuit-performance-profiles'
import { carTechnicalService } from '@/services/carTechnicalService'
import { OFFICIAL_POWER_UNITS } from '@/lib/car-technical-data'
import { calculateCombinedPace } from '@/lib/f1-pace-model'
import { createInitialSetupKnowledge } from '@/services/canonicalPracticeFeedbackService'
import { createInitialWeekendTyreKnowledge } from '@/services/canonicalPracticeTyreService'
import type { WeekendTyreKnowledge, TyreStintObservation } from '@/types/practice-tyres'

const LEASE_DURATION_MS = 25000 // 25s de lease para exclusividade de executor

export class PracticeSessionService {
  private getStorageKey(
    careerId: string,
    seasonId: string,
    round: number,
    sessionType: PracticeSessionType,
  ): string {
    return `apex_practice_session_${careerId}_${seasonId}_${round}_${sessionType}`
  }

  /**
   * Abre ou retoma a sessão persistente de treino para a rodada / tipo especificado.
   * Não cria nova se já estiver em andamento; reidrata do PocketBase ou do fallback local.
   */
  async openOrResumePracticeSession(params: {
    careerId: string
    seasonId: string
    round: number
    sessionType: PracticeSessionType
    preparation: PracticePreparation
    driverNames?: { car1: string; driver1Id: string; car2: string; driver2Id: string }
    teamName?: string
    teamColor?: string
    teamChassisRating?: number
    engineSupplier?: string
  }): Promise<{
    session: PracticeSessionRecordState
    isResumed: boolean
  }> {
    const { careerId, seasonId, round, sessionType, preparation } = params

    // 1. Tentar ler do PocketBase em session_setups
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${careerId}" && season_id = "${seasonId}" && round = ${round} && session = "${sessionType}"`,
      })

      if (records.items.length > 0) {
        const item = records.items[0]
        const strategies = item.driver_strategies as any
        if (strategies && strategies.practiceSessionState) {
          const storedState = strategies.practiceSessionState as PracticeSessionRecordState
          this.cacheLocally(storedState)
          return { session: storedState, isResumed: true }
        }
      }
    } catch (err) {
      console.warn(
        '[practiceSessionService] Falha ao consultar PocketBase, tentando cache local:',
        err,
      )
    }

    // 2. Tentar fallback no localStorage
    const localCached = this.readFromLocalCache(careerId, seasonId, round, sessionType)
    if (localCached) {
      return { session: localCached, isResumed: true }
    }

    // 3. Não existe sessão em andamento: inicializar nova a partir da preparação da 4A
    // Etapa 4C2: Continuidade no mesmo fim de semana (TL1 -> TL2 -> TL3)
    // Se for TL2 ou TL3, herdamos o conhecimento de pneus e setup já consolidados de sessões anteriores
    const inheritedKnowledge = this.resolveInheritedWeekendKnowledge(
      careerId,
      seasonId,
      round,
      sessionType,
    )

    const freshSession = this.createInitialSessionState({
      careerId,
      seasonId,
      round,
      sessionType,
      preparation,
      driverNames: params.driverNames,
      teamName: params.teamName,
      teamColor: params.teamColor,
      teamChassisRating: params.teamChassisRating,
      engineSupplier: params.engineSupplier,
      initialTyreKnowledge: inheritedKnowledge.tyreKnowledge,
      initialTyreObservations: inheritedKnowledge.tyreObservations,
      initialSetupKnowledge: inheritedKnowledge.setupKnowledge,
    })

    await this.saveSessionState(freshSession)
    return { session: freshSession, isResumed: false }
  }

  /**
   * Inicializa o estado canônico do treino consumindo exatamente a preparação da 4A.
   */
  createInitialSessionState(params: {
    careerId: string
    seasonId: string
    round: number
    sessionType: PracticeSessionType
    preparation: PracticePreparation
    driverNames?: { car1: string; driver1Id: string; car2: string; driver2Id: string }
    teamName?: string
    teamColor?: string
    teamChassisRating?: number
    engineSupplier?: string
    initialTyreKnowledge?: WeekendTyreKnowledge
    initialTyreObservations?: TyreStintObservation[]
    initialSetupKnowledge?: import('@/types/practice-session').SetupKnowledgeModel
  }): PracticeSessionRecordState {
    const { careerId, seasonId, round, sessionType, preparation } = params
    const pCar1 = preparation.cars[0]
    const pCar2 = preparation.cars[1]

    const car1Live: PracticeCarLiveState = {
      carId: 'car1',
      driverId: pCar1.driverId || params.driverNames?.driver1Id || 'drv_c1',
      driverName: params.driverNames?.car1 || 'Piloto 1',
      status: 'garage',
      pitRequested: false,
      program: pCar1.program,
      setup: { ...pCar1.setup },
      currentTyreSetId: pCar1.tyreSelection?.setId || `${careerId}_c1_default_tire`,
      currentCompound: pCar1.tyreSelection?.compound || 'medio',
      tyreWear: 2, // Pneu novo de treino
      fuelKg: pCar1.fuelLoad.kg,
      lapsInStint: 0,
      totalLaps: 0,
      currentLapProgressPct: 0,
    }

    const car2Live: PracticeCarLiveState = {
      carId: 'car2',
      driverId: pCar2.driverId || params.driverNames?.driver2Id || 'drv_c2',
      driverName: params.driverNames?.car2 || 'Piloto 2',
      status: 'garage',
      pitRequested: false,
      program: pCar2.program,
      setup: { ...pCar2.setup },
      currentTyreSetId: pCar2.tyreSelection?.setId || `${careerId}_c2_default_tire`,
      currentCompound: pCar2.tyreSelection?.compound || 'medio',
      tyreWear: 2,
      fuelKg: pCar2.fuelLoad.kg,
      lapsInStint: 0,
      totalLaps: 0,
      currentLapProgressPct: 0,
    }

    // Gerar tabela inicial com todos os pilotos do grid (IA + 2 do jogador)
    const initialLeaderboard = this.buildInitialLeaderboard({
      careerId,
      round,
      car1: car1Live,
      car2: car2Live,
      teamName: params.teamName || 'Minha Escuderia',
      teamColor: params.teamColor || '#00A6FB',
      teamChassisRating: params.teamChassisRating || 75,
      engineSupplier: params.engineSupplier || 'Audi',
    })

    const initialFeed: PracticeRadioFeedEvent[] = [
      {
        id: `ev_start_${Date.now()}`,
        second: 0,
        type: 'info',
        message: `Sessão de ${sessionType.toUpperCase()} iniciada. Pit lane aberto (duração: 60 minutos).`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]

    const nowIso = new Date().toISOString()
    return {
      careerId,
      seasonId,
      round,
      sessionType,
      status: 'paused', // inicia pausada aguardando o comando do jogador
      sessionDurationSec: CANONICAL_PRACTICE_DURATION_SEC,
      elapsedTimeSec: 0,
      timeRemainingSec: CANONICAL_PRACTICE_DURATION_SEC,
      simSpeed: 1,
      cars: {
        car1: car1Live,
        car2: car2Live,
      },
      stints: [],
      lapHistory: {
        [car1Live.driverId]: [],
        [car2Live.driverId]: [],
      },
      leaderboard: initialLeaderboard,
      radioFeed: initialFeed,
      feedbacks: [],
      knowledge: params.initialSetupKnowledge || createInitialSetupKnowledge(),
      unreadFeedbackCarIds: [],
      tyreObservations: params.initialTyreObservations ? [...params.initialTyreObservations] : [],
      tyreKnowledge: params.initialTyreKnowledge
        ? JSON.parse(JSON.stringify(params.initialTyreKnowledge))
        : createInitialWeekendTyreKnowledge(),
      revision: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
  }

  /**
   * Monta o grid inicial de tempos (tabela de tempos de treino ordenada).
   * Sem voltas registradas no instante zero.
   */
  private buildInitialLeaderboard(params: {
    careerId: string
    round: number
    car1: PracticeCarLiveState
    car2: PracticeCarLiveState
    teamName: string
    teamColor: string
    teamChassisRating: number
    engineSupplier: string
  }): PracticeTimeEntry[] {
    const aiList = getAICompetitors()

    const aiEntries: PracticeTimeEntry[] = aiList.flatMap((ai) => {
      return [
        {
          position: 0,
          driverId: `${ai.id}_d1`,
          driverName: ai.driver1.name,
          teamName: ai.name,
          teamColor: ai.color,
          compound: 'medio' as const,
          laps: 0,
          bestLapSec: 0,
          bestLapTime: '--:--.---',
          gap: '-',
          isPlayer: false,
        },
        {
          position: 0,
          driverId: `${ai.id}_d2`,
          driverName: ai.driver2.name,
          teamName: ai.name,
          teamColor: ai.color,
          compound: 'medio' as const,
          laps: 0,
          bestLapSec: 0,
          bestLapTime: '--:--.---',
          gap: '-',
          isPlayer: false,
        },
      ]
    })

    const playerEntries: PracticeTimeEntry[] = [
      {
        position: 0,
        driverId: params.car1.driverId,
        driverName: params.car1.driverName,
        teamName: params.teamName,
        teamColor: params.teamColor,
        compound: params.car1.currentCompound,
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer: true,
        carId: 'car1',
      },
      {
        position: 0,
        driverId: params.car2.driverId,
        driverName: params.car2.driverName,
        teamName: params.teamName,
        teamColor: params.teamColor,
        compound: params.car2.currentCompound,
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer: true,
        carId: 'car2',
      },
    ]

    const all = [...playerEntries, ...aiEntries]
    return all.map((item, idx) => ({ ...item, position: idx + 1 }))
  }

  /**
   * Adquire trava de executor exclusivo para esta sessão de treino.
   */
  async acquireExecutionLock(
    session: PracticeSessionRecordState,
    executorId: string,
  ): Promise<{ acquired: boolean; currentExecutorId?: string; leaseUntil?: string }> {
    const now = Date.now()
    const leaseExpires = session.executorLeaseUntil
      ? new Date(session.executorLeaseUntil).getTime()
      : 0

    if (session.activeExecutorId && session.activeExecutorId !== executorId && leaseExpires > now) {
      return {
        acquired: false,
        currentExecutorId: session.activeExecutorId,
        leaseUntil: session.executorLeaseUntil,
      }
    }

    const newLease = new Date(now + LEASE_DURATION_MS).toISOString()
    session.activeExecutorId = executorId
    session.executorLeaseUntil = newLease
    session.lockHeartbeatAt = new Date().toISOString()

    await this.saveSessionState(session)
    return {
      acquired: true,
      currentExecutorId: executorId,
      leaseUntil: newLease,
    }
  }

  /**
   * Heartbeat para renovar a autorização do executor na sessão.
   */
  async renewExecutionLock(
    session: PracticeSessionRecordState,
    executorId: string,
  ): Promise<boolean> {
    if (session.activeExecutorId && session.activeExecutorId !== executorId) {
      const leaseExpires = session.executorLeaseUntil
        ? new Date(session.executorLeaseUntil).getTime()
        : 0
      if (leaseExpires > Date.now()) return false
    }

    session.activeExecutorId = executorId
    session.executorLeaseUntil = new Date(Date.now() + LEASE_DURATION_MS).toISOString()
    session.lockHeartbeatAt = new Date().toISOString()
    this.cacheLocally(session)
    return true
  }

  /**
   * Libera trava ao desmontar ou trocar de tela.
   */
  async releaseExecutionLock(
    session: PracticeSessionRecordState,
    executorId: string,
  ): Promise<void> {
    if (session.activeExecutorId === executorId) {
      session.activeExecutorId = undefined
      session.executorLeaseUntil = undefined
      await this.saveSessionState(session)
    }
  }

  /**
   * Salva o estado atual da sessão no PocketBase (em session_setups) e no cache local.
   * Totalmente idempotente.
   */
  async saveSessionState(state: PracticeSessionRecordState): Promise<PracticeSessionRecordState> {
    state.revision = (state.revision || 0) + 1
    state.updatedAt = new Date().toISOString()

    // 1. Persistir no PocketBase dentro de session_setups.driver_strategies
    try {
      const records = await pb.collection('session_setups').getList(1, 1, {
        filter: `team_id = "${state.careerId}" && season_id = "${state.seasonId}" && round = ${state.round} && session = "${state.sessionType}"`,
      })

      if (records.items.length > 0) {
        const existing = records.items[0]
        const currentStrategies = (existing.driver_strategies as any) || {}
        const mergedStrategies = {
          ...currentStrategies,
          practiceSessionState: state,
        }

        await pb.collection('session_setups').update(existing.id, {
          driver_strategies: mergedStrategies,
          notes: JSON.stringify(mergedStrategies),
        })
      } else {
        const newRecordPayload = {
          team_id: state.careerId,
          season_id: state.seasonId,
          round: state.round,
          session: state.sessionType,
          driver_strategies: { practiceSessionState: state },
          notes: JSON.stringify({ practiceSessionState: state }),
        }
        await pb.collection('session_setups').create(newRecordPayload)
      }
    } catch (err) {
      console.warn(
        '[practiceSessionService] Erro ao gravar estado no PocketBase, usando cache local:',
        err,
      )
    }

    // 2. Sempre espelhar no cache local síncrono
    this.cacheLocally(state)
    return state
  }

  /**
   * Finaliza oficialmente a sessão como 'completed'. Idempotente.
   */
  async markPracticeCompleted(
    state: PracticeSessionRecordState,
  ): Promise<PracticeSessionRecordState> {
    if (state.status === 'completed') return state

    state.status = 'completed'
    state.timeRemainingSec = 0
    state.activeExecutorId = undefined
    state.executorLeaseUntil = undefined

    // Garante que nenhum carro fique preso em trânsito
    if (state.cars.car1.status !== 'garage') {
      state.cars.car1.status = 'garage'
      state.cars.car1.pitRequested = false
    }
    if (state.cars.car2.status !== 'garage') {
      state.cars.car2.status = 'garage'
      state.cars.car2.pitRequested = false
    }

    // Encerra stints abertos
    state.stints.forEach((st) => {
      if (st.status === 'active') {
        st.status = 'completed'
        st.endedAt = new Date().toISOString()
      }
    })

    const finishEvent: PracticeRadioFeedEvent = {
      id: `ev_finish_${Date.now()}`,
      second: state.elapsedTimeSec,
      type: 'finish',
      message: 'Bandeira quadriculada. Sessão de Treino Livre encerrada!',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
    state.radioFeed = [finishEvent, ...state.radioFeed].slice(0, 50)

    await this.saveSessionState(state)
    return state
  }

  private cacheLocally(state: PracticeSessionRecordState): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      const key = this.getStorageKey(state.careerId, state.seasonId, state.round, state.sessionType)
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }

  readFromLocalCache(
    careerId: string,
    seasonId: string,
    round: number,
    sessionType: PracticeSessionType,
  ): PracticeSessionRecordState | null {
    if (typeof window === 'undefined' || !window.localStorage) return null
    try {
      const key = this.getStorageKey(careerId, seasonId, round, sessionType)
      const data = localStorage.getItem(key)
      if (!data) return null
      return JSON.parse(data) as PracticeSessionRecordState
    } catch {
      return null
    }
  }

  /**
   * Resolve o conhecimento de pneus e setup herdado de sessões anteriores no mesmo fim de semana.
   * Regra: TP2 herda de TP1; TP3 herda de TP2 (ou TP1).
   * Idempotente, não transfere conhecimento entre GPs diferentes.
   */
  resolveInheritedWeekendKnowledge(
    careerId: string,
    seasonId: string,
    round: number,
    sessionType: PracticeSessionType,
  ): {
    tyreKnowledge?: WeekendTyreKnowledge
    tyreObservations?: TyreStintObservation[]
    setupKnowledge?: import('@/types/practice-session').SetupKnowledgeModel
  } {
    const sessionOrder: PracticeSessionType[] = ['tp1', 'tp2', 'tp3']
    const currentIndex = sessionOrder.indexOf(sessionType)
    if (currentIndex <= 0) {
      return {}
    }

    // Busca nas sessões anteriores em ordem reversa (ex: para tp3, olha tp2 depois tp1)
    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevType = sessionOrder[i]
      const prevSession = this.readFromLocalCache(careerId, seasonId, round, prevType)
      if (prevSession && prevSession.tyreKnowledge) {
        return {
          tyreKnowledge: prevSession.tyreKnowledge,
          tyreObservations: prevSession.tyreObservations,
          setupKnowledge: prevSession.knowledge,
        }
      }
    }

    return {}
  }
}

export const practiceSessionService = new PracticeSessionService()
