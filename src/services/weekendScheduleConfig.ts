/**
 * weekendScheduleConfig.ts
 *
 * Configuração e definição canônica de sessões do fim de semana para a aba CORRIDA.
 *
 * Arquitetura unificada por formato de evento (Padrão, Sprint, etc.):
 * - Weekend Normal (7 slots): TL1 -> TL2 -> TL3 -> Q1 -> Q2 -> Q3 -> RACE.
 * - Weekend Sprint (7 slots canônicos): TL1 -> SQ1 (Quali Sprint) -> SPRINT -> Q1 -> Q2 -> Q3 -> RACE.
 *   (TL2 e TL3 ausentes no Sprint; SQ1 liberada após TL1; Q1 liberada após Sprint).
 */

export type RaceWeekendSessionId =
  | 'tp1'
  | 'tp2'
  | 'tp3'
  | 'sq1'
  | 'sq2'
  | 'sq3'
  | 'sprint_race'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'race'

/**
 * Slots de alto nível do fim de semana para mapeamento macro/granular.
 */
export type WeekendMacroSlot =
  | 'PRACTICE_1'
  | 'PRACTICE_2'
  | 'PRACTICE_3'
  | 'SPRINT_QUALIFYING'
  | 'SPRINT_RACE'
  | 'MAIN_QUALIFYING'
  | 'MAIN_RACE'

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

import { normalizeCompletedSessions } from '@/services/weekendProgressionService'

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
    sq1: {
      id: 'sq1',
      shortLabel: 'SQ1',
      fullName: 'Qualificação Sprint',
      category: 'qualifying',
      order: 2,
      isPlayableInV2: true,
      blockedMessage: 'Disponível após conclusão do TL1.',
    },
    sq2: {
      id: 'sq2',
      shortLabel: 'SQ2',
      fullName: 'Qualificação Sprint — Fase 2',
      category: 'qualifying',
      order: 3.2,
      isPlayableInV2: true,
      blockedMessage: 'Disponível após conclusão do SQ1.',
    },
    sq3: {
      id: 'sq3',
      shortLabel: 'SQ3',
      fullName: 'Qualificação Sprint — Fase 3',
      category: 'qualifying',
      order: 3.3,
      isPlayableInV2: true,
      blockedMessage: 'Disponível após conclusão do SQ2.',
    },
    sprint_race: {
      id: 'sprint_race',
      shortLabel: 'SPRINT',
      fullName: 'Corrida Sprint',
      category: 'race',
      order: 3,
      isPlayableInV2: false,
      blockedMessage: 'Disponível após conclusão da Qualificação Sprint (SQ1/SQ3).',
    },
    q1: {
      id: 'q1',
      shortLabel: 'Q1',
      fullName: 'Classificação — Fase 1',
      category: 'qualifying',
      order: 4,
      isPlayableInV2: true,
      blockedMessage: 'Disponível após conclusão dos treinos ou da Corrida Sprint.',
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
 * Mapeamento canônico de macro-slots para sessões detalhadas da esteira.
 */
export const MACRO_SLOT_SESSION_EXPANSION: Record<
  WeekendMacroSlot,
  readonly RaceWeekendSessionId[]
> = {
  PRACTICE_1: ['tp1'],
  PRACTICE_2: ['tp2'],
  PRACTICE_3: ['tp3'],
  SPRINT_QUALIFYING: ['sq1', 'sq2', 'sq3'],
  SPRINT_RACE: ['sprint_race'],
  MAIN_QUALIFYING: ['q1', 'q2', 'q3'],
  MAIN_RACE: ['race'],
}

/**
 * Macro slots ordenados para fim de semana NORMAL:
 * PRACTICE_1 -> PRACTICE_2 -> PRACTICE_3 -> MAIN_QUALIFYING -> MAIN_RACE
 */
export const NORMAL_WEEKEND_MACRO_SLOTS: readonly WeekendMacroSlot[] = Object.freeze([
  'PRACTICE_1',
  'PRACTICE_2',
  'PRACTICE_3',
  'MAIN_QUALIFYING',
  'MAIN_RACE',
])

/**
 * Macro slots ordenados para fim de semana SPRINT:
 * PRACTICE_1 -> PRACTICE_2 -> SPRINT_QUALIFYING -> SPRINT_RACE -> MAIN_QUALIFYING -> MAIN_RACE
 * (TL3 rigorosamente ausente; TL2 presente; SQ próprio antes de Sprint; Main Quali antes de GP Race).
 */
export const SPRINT_WEEKEND_MACRO_SLOTS: readonly WeekendMacroSlot[] = Object.freeze([
  'PRACTICE_1',
  'SPRINT_QUALIFYING',
  'SPRINT_RACE',
  'MAIN_QUALIFYING',
  'MAIN_RACE',
])

/**
 * Configuração canônica da sequência Sprint exportada explicitamente para consumidores da esteira.
 * Canônico de 7 slots: TL1 -> SQ1 -> SPRINT -> Q1 -> Q2 -> Q3 -> CORRIDA
 */
export const SPRINT_WEEKEND_SCHEDULE_CONFIG = {
  macroSlots: SPRINT_WEEKEND_MACRO_SLOTS,
  sessionIds: ['tp1', 'sq1', 'sprint_race', 'q1', 'q2', 'q3', 'race'] as const,
  hasPractice3: false,
  hasPractice2: false,
  hasSprintQualifying: true,
  hasSprintRace: true,
  hasMainQualifying: true,
  hasMainRace: true,
} as const

/**
 * Expande uma sequência de macro slots nas sessões detalhadas canônicas correspondentes.
 */
export function expandMacroSlotsToSessions(
  slots: readonly WeekendMacroSlot[],
): RaceWeekendSessionId[] {
  return slots.flatMap((slot) => [...MACRO_SLOT_SESSION_EXPANSION[slot]])
}

/**
 * Retorna as sessões da esteira para o evento.
 * No formato normal: [ TL1, TL2, TL3, Q1, Q2, Q3, CORRIDA ].
 * No formato sprint: [ TL1, TL2, SQ1, SQ2, SQ3, SPRINT, Q1, Q2, Q3, CORRIDA ].
 */
export function getRaceWeekendPipeline(
  options?: WeekendScheduleOptions,
): WeekendSessionDefinition[] {
  const isSprint = options?.format === 'sprint'
  if (isSprint) {
    // SPRINT canônico de 7 slots: TL1 -> SQ1 -> SPRINT -> Q1 -> Q2 -> Q3 -> CORRIDA PRINCIPAL
    // TL2 e TL3 ausentes no formato Sprint
    const sprintSequence: RaceWeekendSessionId[] = [
      'tp1',
      'sq1',
      'sprint_race',
      'q1',
      'q2',
      'q3',
      'race',
    ]
    return sprintSequence.map((id) => CANONICAL_SESSION_DEFINITIONS[id])
  }

  const includeP3 = options?.includePractice3 ?? true
  const macroSlots: WeekendMacroSlot[] = includeP3
    ? [...NORMAL_WEEKEND_MACRO_SLOTS]
    : ['PRACTICE_1', 'PRACTICE_2', 'MAIN_QUALIFYING', 'MAIN_RACE']

  const normalSequence = expandMacroSlotsToSessions(macroSlots)
  return normalSequence.map((id) => CANONICAL_SESSION_DEFINITIONS[id])
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

  const normalized = normalizeCompletedSessions(completedSessions)
  const isCompleted = normalized.includes(sessionId)

  if (isCompleted) {
    return 'completed'
  }

  // Normaliza o activeSessionId também caso venha como alias
  const normalizedActiveList = normalizeCompletedSessions([activeSessionId])
  const isCurrentActive = sessionId === activeSessionId || normalizedActiveList.includes(sessionId)

  // Verifica se a sessão está desbloqueada antes de marcá-la como active
  const isUnlocked = isSessionUnlocked(sessionId, normalized)

  if (isCurrentActive && isUnlocked) {
    if (isSessionRunning) return 'active'
    if (isSessionPaused) return 'paused'
    return 'active'
  }

  return isUnlocked ? 'available' : 'locked'
}

/**
 * Função auxiliar canônica que avalia se uma sessão está desbloqueada dadas as sessões concluídas normalizadas.
 * Exportada para testes e validação formal de gates.
 */
export function isSessionUnlocked(
  sessionId: RaceWeekendSessionId,
  normalizedCompleted: string[],
): boolean {
  if (sessionId === 'tp1') {
    return true
  }

  if (sessionId === 'tp2') {
    return normalizedCompleted.includes('tp1')
  }

  if (sessionId === 'tp3') {
    return normalizedCompleted.includes('tp2')
  }

  // Desbloqueio de sessões Sprint: SQ1 liberada com TL1 concluído (não exige TL2).
  // Também aceita TL2 se porventura estiver completado.
  if (sessionId === 'sq1') {
    return normalizedCompleted.includes('tp1')
  }

  if (sessionId === 'sq2') {
    return normalizedCompleted.includes('sq1')
  }

  if (sessionId === 'sq3') {
    return normalizedCompleted.includes('sq2')
  }

  if (sessionId === 'sprint_race') {
    return (
      normalizedCompleted.includes('sq1') ||
      normalizedCompleted.includes('sq2') ||
      normalizedCompleted.includes('sq3') ||
      normalizedCompleted.includes('sprint_qualifying')
    )
  }

  // Q1 requer conclusão dos treinos: no formato NORMAL requer TL3 concluído. No Sprint, requer sprint_race concluída.
  if (sessionId === 'q1') {
    const normalOk = normalizedCompleted.includes('tp3')
    const sprintOk =
      normalizedCompleted.includes('sprint_race') || normalizedCompleted.includes('sprint')
    return normalOk || sprintOk
  }

  if (sessionId === 'q2') {
    return normalizedCompleted.includes('q1')
  }

  if (sessionId === 'q3') {
    return normalizedCompleted.includes('q2')
  }

  if (sessionId === 'race') {
    return Boolean(normalizedCompleted.includes('q3') || normalizedCompleted.includes('qualifying'))
  }

  return false
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
