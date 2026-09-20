/**
 * weekendScheduleConfig.ts
 *
 * Configuração e definição canônica de sessões do fim de semana para a aba CORRIDA.
 *
 * Arquitetura extensível por formato de evento (Padrão, Sprint, etc.):
 * - Padrão F1 2026 oficial na esteira principal: TL1 -> TL2 -> Q1 -> Q2 -> Q3 -> CORRIDA.
 * - TL3 permanece 100% implementado no backend, runners e testes (isolado por configuração
 *   `includePractice3InSchedule`, permitindo reinserção futura sem alteração de código das sessões).
 */

export type RaceWeekendSessionId = 'tp1' | 'tp2' | 'tp3' | 'q1' | 'q2' | 'q3' | 'race'

export type SessionVisualState = 'locked' | 'available' | 'active' | 'paused' | 'completed'

export interface WeekendSessionDefinition {
  id: RaceWeekendSessionId
  shortLabel: string
  fullName: string
  category: 'practice' | 'qualifying' | 'race'
  order: number
  /** Se a sessão é executável no motor de treino (TL1/TL2/TL3) nesta versão */
  isPlayableInV2: boolean
  /** Mensagem exibida quando bloqueada ou em desenvolvimento */
  blockedMessage: string
}

export interface WeekendScheduleOptions {
  /** Formato do fim de semana (standard, sprint) */
  format?: 'standard' | 'sprint'
  /** Flag explícita para incluir TL3 quando o regulamento/evento exigir */
  includePractice3?: boolean
}

/**
 * Definições canônicas de todas as sessões suportadas pela esteira.
 */
export const CANONICAL_SESSION_DEFINITIONS: Record<RaceWeekendSessionId, WeekendSessionDefinition> =
  {
    tp1: {
      id: 'tp1',
      shortLabel: 'TL1',
      fullName: 'Treino Livre 1',
      category: 'practice',
      order: 1,
      isPlayableInV2: true,
      blockedMessage: 'Sessão inicial do fim de semana.',
    },
    tp2: {
      id: 'tp2',
      shortLabel: 'TL2',
      fullName: 'Treino Livre 2',
      category: 'practice',
      order: 2,
      isPlayableInV2: true,
      blockedMessage: 'Disponível após a conclusão do TL1.',
    },
    tp3: {
      id: 'tp3',
      shortLabel: 'TL3',
      fullName: 'Treino Livre 3',
      category: 'practice',
      order: 3,
      isPlayableInV2: true,
      blockedMessage: 'Disponível após a conclusão do TL2.',
    },
    q1: {
      id: 'q1',
      shortLabel: 'Q1',
      fullName: 'Classificação — Fase 1',
      category: 'qualifying',
      order: 4,
      isPlayableInV2: true,
      blockedMessage: 'Disponível após conclusão do TL2.',
    },
    q2: {
      id: 'q2',
      shortLabel: 'Q2',
      fullName: 'Classificação — Fase 2',
      category: 'qualifying',
      order: 5,
      isPlayableInV2: true,
      blockedMessage: 'Disponível após conclusão do Q1.',
    },
    q3: {
      id: 'q3',
      shortLabel: 'Q3',
      fullName: 'Classificação — Fase 3',
      category: 'qualifying',
      order: 6,
      isPlayableInV2: true,
      blockedMessage: 'Disponível após conclusão do Q2.',
    },
    race: {
      id: 'race',
      shortLabel: 'CORRIDA',
      fullName: 'Grande Prêmio (Corrida Principal)',
      category: 'race',
      order: 7,
      isPlayableInV2: false,
      blockedMessage: 'Disponível após conclusão da classificação (Q3).',
    },
  }

/**
 * Retorna as sessões da esteira para o evento.
 * Na esteira padrão da aba CORRIDA: [ TL1, TL2, Q1, Q2, Q3, CORRIDA ].
 * Se `includePractice3` for true (ou regulamento específico exigir), TL3 é inserido entre TL2 e Q1.
 */
export function getRaceWeekendPipeline(
  options?: WeekendScheduleOptions,
): WeekendSessionDefinition[] {
  const includeP3 = options?.includePractice3 ?? false

  const baseSequence: RaceWeekendSessionId[] = includeP3
    ? ['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race']
    : ['tp1', 'tp2', 'q1', 'q2', 'q3', 'race']

  return baseSequence.map((id) => CANONICAL_SESSION_DEFINITIONS[id])
}

/**
 * Determina o estado visual canônico de uma etapa na esteira.
 */
export function resolveSessionVisualState(params: {
  sessionId: RaceWeekendSessionId
  activeSessionId: RaceWeekendSessionId
  completedSessions: string[]
  isSessionRunning?: boolean
  isSessionPaused?: boolean
}): SessionVisualState {
  const { sessionId, activeSessionId, completedSessions, isSessionRunning, isSessionPaused } =
    params

  const isCompleted = completedSessions.includes(sessionId)

  if (isCompleted) {
    return 'completed'
  }

  const isCurrentActive = sessionId === activeSessionId

  if (isCurrentActive) {
    if (isSessionRunning) return 'active'
    if (isSessionPaused) return 'paused'
    return 'active'
  }

  // Regras de desbloqueio canônico
  if (sessionId === 'tp1') {
    return 'available'
  }

  if (sessionId === 'tp2') {
    return completedSessions.includes('tp1') ? 'available' : 'locked'
  }

  if (sessionId === 'tp3') {
    return completedSessions.includes('tp2') ? 'available' : 'locked'
  }

  // Q1 requer conclusão dos treinos (TL2, ou TL3 se incluso)
  if (sessionId === 'q1') {
    return completedSessions.includes('tp2') ? 'available' : 'locked'
  }

  if (sessionId === 'q2') {
    return completedSessions.includes('q1') ? 'available' : 'locked'
  }

  if (sessionId === 'q3') {
    return completedSessions.includes('q2') ? 'available' : 'locked'
  }

  if (sessionId === 'race') {
    return completedSessions.includes('q3') || completedSessions.includes('qualifying')
      ? 'available'
      : 'locked'
  }

  return 'locked'
}

/**
 * Determina qual sessão canônica deve ser selecionada prioritariamente ao abrir a aba CORRIDA.
 * Prioridade:
 * 1. Sessão em andamento / pausada no estado real do domínio.
 * 2. Próxima sessão desbloqueada ainda não concluída na esteira.
 * 3. Última sessão concluída (se todas completas).
 */
export function resolveInitialRaceSession(params: {
  pipeline: WeekendSessionDefinition[]
  completedSessions: string[]
  lastActiveSessionId?: RaceWeekendSessionId | null
}): RaceWeekendSessionId {
  const { pipeline, completedSessions, lastActiveSessionId } = params

  // Se a última sessão ativa ainda não foi concluída, manter aberta
  if (lastActiveSessionId && !completedSessions.includes(lastActiveSessionId)) {
    return lastActiveSessionId
  }

  // Procurar a primeira etapa não concluída da esteira
  for (const step of pipeline) {
    if (!completedSessions.includes(step.id)) {
      return step.id
    }
  }

  // Se tudo concluído, manter a última (Corrida)
  return pipeline[pipeline.length - 1]?.id || 'tp1'
}
