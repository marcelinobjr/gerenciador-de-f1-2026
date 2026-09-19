import pb from '@/lib/pocketbase/client'
import type {
  RaceSessionRecord,
  RaceSessionStatus,
  RaceSessionType,
  RaceSessionCheckpointData,
  RacePendingDecision,
  RaceResolvedDecision,
} from '@/types/race-session'
import type { LapRecord } from '@/components/race/LiveStandingsTable'
import { calculatePitStopDuration } from '@/lib/f1-tire-system'

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

  /**
   * ETAPA 2: Resolução Atômica de Decisão com Proteção Anti-Loop e Concorrência Multi-Aba.
   * Valida a existência da decisão pendente no servidor.
   * Rejeita caso o eventId já tenha sido resolvido (evita duplo clique ou concorrência entre abas).
   * Aplica a consequência esportiva (ex: box now -> novos pneus e pit loss).
   * Registra no resolvedDecisions histórico e remove de pendingDecisions.
   * Persiste tudo atomicamente no PocketBase e incrementa a revisão.
   */
  async resolveDecision(params: {
    sessionId: string
    executorId: string
    decisionId: string
    choice: string // ex: 'box_now' | 'stay_out'
    newCompoundChoice?: 'macio' | 'medio' | 'duro' | 'intermediario' | 'chuva_extrema'
    targetSetId?: string
  }): Promise<{
    success: boolean
    alreadyResolved?: boolean
    error?: string
    updatedSession?: RaceSessionRecord
    remainingPendingDecisions?: RacePendingDecision[]
    resolvedDecision?: RaceResolvedDecision
  }> {
    try {
      const session = await pb
        .collection('race_sessions')
        .getOne<RaceSessionRecord>(params.sessionId)
      const cp = session.checkpoint_data || {
        grid: [],
        currentLap: session.current_lap || 1,
        totalLaps: session.total_laps || 50,
        weather: 'seco',
        liveEvents: [],
        playerCarTactics: {},
        playerPaceOrders: {},
        mechanicalIssues: [],
        penalties: [],
        lastSavedAt: new Date().toISOString(),
      }

      const pendingList: RacePendingDecision[] = cp.pendingDecisions || []
      const resolvedList: RaceResolvedDecision[] = cp.resolvedDecisions || []

      // 1. Verificação anti-duplicidade (Proteção Anti-Loop e Concorrência entre Abas)
      const alreadyResolved = resolvedList.find((r) => r.eventId === params.decisionId)
      if (alreadyResolved) {
        return {
          success: false,
          alreadyResolved: true,
          error: `Operação rejeitada: o evento "${params.decisionId}" já foi resolvido em ${alreadyResolved.resolvedAt}.`,
          remainingPendingDecisions: pendingList.filter((d) => d.id !== params.decisionId),
        }
      }

      // 2. Busca a decisão pendente
      const targetDecision = pendingList.find((d) => d.id === params.decisionId)
      if (!targetDecision) {
        return {
          success: false,
          alreadyResolved: false,
          error: `Decisão pendente "${params.decisionId}" não encontrada no estado da sessão.`,
        }
      }

      // 3. Aplicação da consequência esportiva no grid
      const updatedGrid = [...(cp.grid || [])]
      const targetDriverId = targetDecision.driverId
      const targetCar = updatedGrid.find((c) => c.driverId === targetDriverId)

      let consequenceSummary = `Escolha realizada: ${params.choice}`

      // 3.1 Revalidação Canônica Rigorosa (4D.2)
      // Conferir se o contexto ainda é válido: piloto em prova, sessão ativa, etc.
      if (session.status === 'completed') {
        return {
          success: false,
          alreadyResolved: false,
          error: 'Operação cancelada: a sessão de corrida já foi finalizada.',
        }
      }

      if (!targetCar || targetCar.dnf) {
        return {
          success: false,
          alreadyResolved: false,
          error: `O piloto ${targetDecision.driverName || targetDriverId} não está mais apto ou abandonou a prova.`,
        }
      }

      const inventories = cp.driverTireInventories ? { ...cp.driverTireInventories } : undefined
      let updatedDriverSets = inventories?.[targetDriverId] ? [...inventories[targetDriverId]] : undefined

      if (params.choice === 'box_now') {
        // Obter payload informado se disponível
        const payload = targetDecision.payload || {}
        const proposedCompound = (payload.proposedCompound as any) || params.newCompoundChoice
        const proposedSetId = params.targetSetId || (payload.proposedSetId as string | undefined)

        // Determinar o composto a ser instalado
        const chosenCompound =
          params.newCompoundChoice ||
          proposedCompound ||
          (cp.weather !== 'seco'
            ? cp.weather === 'chuva_forte'
              ? 'chuva_extrema'
              : 'intermediario'
            : targetCar.tireCompound === 'medio'
              ? 'duro'
              : 'medio')

        // Validar estoque do piloto se inventário existir
        let chosenSetWear = 4
        if (updatedDriverSets && updatedDriverSets.length > 0) {
          let chosenSet = proposedSetId
            ? updatedDriverSets.find((s) => s.id === proposedSetId && !s.isFitted)
            : updatedDriverSets.find((s) => s.compound === chosenCompound && !s.isFitted)

          if (!chosenSet) {
            // Se o jogo específico proposto não estiver disponível, buscar qualquer outro elegível do composto
            chosenSet = updatedDriverSets.find((s) => s.compound === chosenCompound && !s.isFitted && s.wear < 90)
          }

          if (chosenSet) {
            // Desmontar pneu anterior e montar o novo
            updatedDriverSets = updatedDriverSets.map((s) => {
              if (s.isFitted) {
                return { ...s, isFitted: false, wear: Math.min(100, targetCar.tireWear || s.wear) }
              }
              if (s.id === chosenSet!.id) {
                return { ...s, isFitted: true }
              }
              return s
            })
            chosenSetWear = chosenSet.wear || 4
          }
        }

        const pitDuration = calculatePitStopDuration(
          targetCar.teamName,
          targetCar.driverName,
          true,
          80,
        )

        targetCar.tireCompound = chosenCompound
        targetCar.tireWear = chosenSetWear
        targetCar.lapsOnCurrentTire = 0
        targetCar.pitStopsDone = (targetCar.pitStopsDone || 0) + 1
        targetCar.accumulatedTimeSec =
          (targetCar.accumulatedTimeSec || 0) + pitDuration.durationSec
        targetCar.cliffStatus = undefined

        consequenceSummary = `Box realizado: calçou pneus ${chosenCompound} em ${pitDuration.durationSec.toFixed(2)}s.`
      } else if (params.choice === 'stay_out') {
        // Consequência de adiar box: estende a janela de pit lap em 4 voltas
        if (targetCar.pitLap) {
          targetCar.pitLap = targetCar.pitLap + 4
        }
        consequenceSummary = `Permaneceu na pista. Janela estendida.`
      }

      // 4. Registro no histórico de decisões resolvidas (Chave de proteção anti-loop persistente)
      const newResolvedRecord: RaceResolvedDecision = {
        eventId: targetDecision.id,
        type: targetDecision.type,
        driverId: targetDecision.driverId,
        lap: targetDecision.lap,
        resolvedAt: new Date().toISOString(),
        resolvedByExecutorId: params.executorId,
        choice: params.choice,
        consequenceSummary,
      }

      const updatedResolvedList = [...resolvedList, newResolvedRecord]
      const updatedPendingList = pendingList.filter((d) => d.id !== params.decisionId)

      // Atualiza eventos ao vivo
      const nowTimeStr = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      const resolutionEvent = {
        id: `ev_res_${Date.now()}_${targetDecision.id}`,
        lap: targetDecision.lap,
        type: 'team_radio' as const,
        message: `📋 DECISÃO RESOLVIDA [${targetDecision.driverName || 'Piloto'}]: ${consequenceSummary}`,
        driverName: targetDecision.driverName,
        isPlayer: true,
        timestamp: nowTimeStr,
      }

      const updatedCheckpoint: RaceSessionCheckpointData = {
        ...cp,
        grid: updatedGrid,
        pendingDecisions: updatedPendingList,
        resolvedDecisions: updatedResolvedList,
        driverTireInventories: updatedDriverSets && inventories
          ? { ...inventories, [targetDriverId]: updatedDriverSets }
          : cp.driverTireInventories,
        liveEvents: [resolutionEvent, ...(cp.liveEvents || [])].slice(0, 40),
        lastSavedAt: new Date().toISOString(),
      }

      // Se ainda houver decisões pendentes de outro piloto, permanece 'awaiting_decision'.
      // Se não houver mais, vai para 'paused' e o jogador aperta Play quando desejar.
      const newStatus: RaceSessionStatus =
        updatedPendingList.length > 0 ? 'awaiting_decision' : 'paused'
      const newPauseReason =
        updatedPendingList.length > 0
          ? `Aguardando decisão para: ${updatedPendingList.map((d) => d.title).join(' | ')}`
          : 'Decisão resolvida. Aguardando comando de Play do jogador.'

      const nextRevision = (session.revision || 0) + 1
      const newLease = new Date(Date.now() + LEASE_DURATION_MS).toISOString()

      const updated = await pb
        .collection('race_sessions')
        .update<RaceSessionRecord>(params.sessionId, {
          revision: nextRevision,
          status: newStatus,
          pause_reason: newPauseReason,
          checkpoint_data: updatedCheckpoint,
          active_executor_id: params.executorId,
          executor_lease_until: newLease,
          lock_heartbeat_at: new Date().toISOString(),
        })

      return {
        success: true,
        alreadyResolved: false,
        updatedSession: updated,
        remainingPendingDecisions: updatedPendingList,
        resolvedDecision: newResolvedRecord,
      }
    } catch (err: any) {
      console.error('[raceSessionService] Falha ao resolver decisão atômica:', err)
      return {
        success: false,
        alreadyResolved: false,
        error: err?.message || 'Falha de comunicação ao resolver decisão.',
      }
    }
  },
}
