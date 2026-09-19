import pb from '@/lib/pocketbase/client'
import type {
  RaceSessionRecord,
  RaceSessionStatus,
  RaceSessionType,
  RaceSessionCheckpointData,
} from '@/types/race-session'
import type { LapRecord } from '@/components/race/LiveStandingsTable'

const LEASE_DURATION_MS = 25000 // 25s lease timeout

export const raceSessionService = {
  /**
   * Constrói a chave canônica da sessão:
   * CARREIRA(team) + TEMPORADA(season) + RODADA(round) + TIPO(session_type)
   */
  buildSessionKey(params: {
    seasonId: string
    teamId: string
    round: number
    sessionType?: RaceSessionType
  }): string {
    const sType = params.sessionType || 'race'
    return `sess_${params.seasonId}_${params.teamId}_r${params.round}_${sType}`
  },

  /**
   * Consulta a sessão existente sem modificações.
   */
  async getSession(params: {
    seasonId: string
    teamId: string
    round: number
    sessionType?: RaceSessionType
  }): Promise<RaceSessionRecord | null> {
    const sessionKey = this.buildSessionKey(params)
    try {
      const records = await pb.collection('race_sessions').getList<RaceSessionRecord>(1, 1, {
        filter: `session_key = "${sessionKey}"`,
      })
      return records.items[0] || null
    } catch (err) {
      console.warn('[raceSessionService] Erro ao buscar sessão:', err)
      return null
    }
  },

  /**
   * Inicializa ou retoma a sessão compartilhada única.
   */
  async openOrResumeRaceSession(params: {
    seasonId: string
    teamId: string
    userId: string
    seasonYear: number
    round: number
    sessionType?: RaceSessionType
    totalLaps: number
    initialData?: RaceSessionCheckpointData
  }): Promise<{
    session: RaceSessionRecord
    isResumed: boolean
  }> {
    const sessionKey = this.buildSessionKey(params)
    const existing = await this.getSession(params)

    if (existing) {
      return {
        session: existing,
        isResumed: existing.status !== 'not_started',
      }
    }

    // Cria nova sessão canônica inicial
    const newSessionData: Partial<RaceSessionRecord> = {
      session_key: sessionKey,
      season_id: params.seasonId,
      team_id: params.teamId,
      user_id: params.userId,
      season_year: params.seasonYear,
      round: params.round,
      session_type: params.sessionType || 'race',
      status: 'not_started',
      revision: 1,
      current_lap: 1,
      total_laps: params.totalLaps,
      sim_speed: 1,
      pause_reason: '',
      checkpoint_data: params.initialData || undefined,
      lap_history: {},
    }

    try {
      const created = await pb.collection('race_sessions').create<RaceSessionRecord>(newSessionData)
      return {
        session: created,
        isResumed: false,
      }
    } catch (err) {
      // Se colidir corrida paralela que acabou de criar, tenta reler
      const fallback = await this.getSession(params)
      if (fallback) {
        return {
          session: fallback,
          isResumed: fallback.status !== 'not_started',
        }
      }
      throw err
    }
  },

  /**
   * Adquire trava de executor exclusivo para esta aba/janela.
   * Se outro executor ativo estiver com lease válido, rejeita a execução.
   */
  async acquireExecutionLock(
    sessionId: string,
    executorId: string,
  ): Promise<{
    acquired: boolean
    currentExecutorId?: string
    leaseUntil?: string
  }> {
    try {
      const current = await pb.collection('race_sessions').getOne<RaceSessionRecord>(sessionId)
      const now = Date.now()
      const leaseExpiresAt = current.executor_lease_until
        ? new Date(current.executor_lease_until).getTime()
        : 0

      const isCurrentActive =
        current.active_executor_id &&
        current.active_executor_id !== executorId &&
        leaseExpiresAt > now

      if (isCurrentActive) {
        return {
          acquired: false,
          currentExecutorId: current.active_executor_id,
          leaseUntil: current.executor_lease_until,
        }
      }

      const newLease = new Date(now + LEASE_DURATION_MS).toISOString()
      const updated = await pb.collection('race_sessions').update<RaceSessionRecord>(sessionId, {
        active_executor_id: executorId,
        executor_lease_until: newLease,
        lock_heartbeat_at: new Date().toISOString(),
      })

      return {
        acquired: updated.active_executor_id === executorId,
        currentExecutorId: updated.active_executor_id,
        leaseUntil: updated.executor_lease_until,
      }
    } catch (err) {
      console.error('[raceSessionService] Falha ao adquirir lock:', err)
      return { acquired: false }
    }
  },

  /**
   * Heartbeat periódico da trava para manter exclusividade sem expirar.
   */
  async renewExecutionLock(sessionId: string, executorId: string): Promise<boolean> {
    try {
      const current = await pb.collection('race_sessions').getOne<RaceSessionRecord>(sessionId)
      if (current.active_executor_id && current.active_executor_id !== executorId) {
        return false
      }
      const newLease = new Date(Date.now() + LEASE_DURATION_MS).toISOString()
      await pb.collection('race_sessions').update(sessionId, {
        active_executor_id: executorId,
        executor_lease_until: newLease,
        lock_heartbeat_at: new Date().toISOString(),
      })
      return true
    } catch (err) {
      console.warn('[raceSessionService] Falha no heartbeat do lock:', err)
      return false
    }
  },

  /**
   * Libera a trava de execução quando a aba fecha ou navega para outra tela.
   */
  async releaseExecutionLock(sessionId: string, executorId: string): Promise<void> {
    try {
      const current = await pb.collection('race_sessions').getOne<RaceSessionRecord>(sessionId)
      if (current.active_executor_id === executorId) {
        await pb.collection('race_sessions').update(sessionId, {
          active_executor_id: '',
          executor_lease_until: '',
        })
      }
    } catch (err) {
      console.warn('[raceSessionService] Falha ao liberar lock:', err)
    }
  },

  /**
   * Salva checkpoint atômico com verificação de revisão e executor.
   */
  async saveCheckpoint(params: {
    sessionId: string
    executorId: string
    expectedRevision: number
    status: RaceSessionStatus
    currentLap: number
    simSpeed: number
    pauseReason?: string
    checkpointData: RaceSessionCheckpointData
    lapHistory?: Record<string, LapRecord[]>
  }): Promise<{
    success: boolean
    newRevision: number
    error?: string
  }> {
    try {
      const current = await pb
        .collection('race_sessions')
        .getOne<RaceSessionRecord>(params.sessionId)

      // Validação de executor
      const now = Date.now()
      const leaseExpiresAt = current.executor_lease_until
        ? new Date(current.executor_lease_until).getTime()
        : 0
      if (
        current.active_executor_id &&
        current.active_executor_id !== params.executorId &&
        leaseExpiresAt > now
      ) {
        return {
          success: false,
          newRevision: current.revision,
          error: 'Outra aba ou executor detém a autorização ativa desta sessão.',
        }
      }

      // Validação de revisão (impede sobrescrita de estado antigo)
      if (current.revision > params.expectedRevision) {
        return {
          success: false,
          newRevision: current.revision,
          error: `Conflito de revisão: servidor está na rev ${current.revision}, local na rev ${params.expectedRevision}.`,
        }
      }

      const nextRevision = (current.revision || 0) + 1
      const newLease = new Date(Date.now() + LEASE_DURATION_MS).toISOString()

      const updatePayload: Partial<RaceSessionRecord> = {
        revision: nextRevision,
        status: params.status,
        current_lap: params.currentLap,
        sim_speed: params.simSpeed,
        pause_reason: params.pauseReason || '',
        checkpoint_data: params.checkpointData,
        active_executor_id: params.executorId,
        executor_lease_until: newLease,
        lock_heartbeat_at: new Date().toISOString(),
      }

      if (params.lapHistory) {
        updatePayload.lap_history = params.lapHistory
      }

      const updated = await pb
        .collection('race_sessions')
        .update<RaceSessionRecord>(params.sessionId, updatePayload)

      return {
        success: true,
        newRevision: updated.revision,
      }
    } catch (err: any) {
      console.error('[raceSessionService] Falha ao gravar checkpoint:', err)
      return {
        success: false,
        newRevision: params.expectedRevision,
        error: err?.message || 'Falha de comunicação com o servidor ao persistir checkpoint.',
      }
    }
  },

  /**
   * Finaliza oficialmente a sessão como 'completed'.
   * Idempotente: se já estiver 'completed', não reaplica.
   */
  async markSessionCompleted(sessionId: string, executorId: string): Promise<boolean> {
    try {
      const current = await pb.collection('race_sessions').getOne<RaceSessionRecord>(sessionId)
      if (current.status === 'completed') {
        return true
      }

      await pb.collection('race_sessions').update(sessionId, {
        status: 'completed',
        active_executor_id: '',
        executor_lease_until: '',
      })
      return true
    } catch (err) {
      console.error('[raceSessionService] Erro ao marcar sessão como concluída:', err)
      return false
    }
  },
}
