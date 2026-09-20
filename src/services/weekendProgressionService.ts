/**
 * weekendProgressionService.ts
 *
 * HOTFIX WEEKEND-01A: Bloquear bypass de sessões do fim de semana.
 * Define o cronograma canônico e calcula a próxima sessão obrigatória pendente.
 * Formatos:
 *  - GP Normal: tp1 → tp2 → tp3 → qualifying → race
 *  - GP Sprint: tp1 → sprint_qualifying → sprint_race → qualifying → race
 * (Detecção via CIRCUIT_PERFORMANCE_PROFILES[round].hasSprint)
 */

import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'

export type CanonicalWeekendSession =
  | 'tp1'
  | 'tp2'
  | 'tp3'
  | 'sprint_qualifying'
  | 'sprint_race'
  | 'qualifying'
  | 'race'

export const NORMAL_WEEKEND_SCHEDULE: CanonicalWeekendSession[] = [
  'tp1',
  'tp2',
  'tp3',
  'qualifying',
  'race',
]

export const SPRINT_WEEKEND_SCHEDULE: CanonicalWeekendSession[] = [
  'tp1',
  'sprint_qualifying',
  'sprint_race',
  'qualifying',
  'race',
]

export const SESSION_DISPLAY_NAMES: Record<CanonicalWeekendSession, string> = {
  tp1: 'TL1 (Treino Livre 1)',
  tp2: 'TL2 (Treino Livre 2)',
  tp3: 'TL3 (Treino Livre 3)',
  sprint_qualifying: 'Qualificação Sprint',
  sprint_race: 'Corrida Sprint',
  qualifying: 'Classificação Oficial',
  race: 'Corrida Principal',
}

export const SESSION_SHORT_LABELS: Record<CanonicalWeekendSession, string> = {
  tp1: 'TL1',
  tp2: 'TL2',
  tp3: 'TL3',
  sprint_qualifying: 'Quali Sprint',
  sprint_race: 'Sprint',
  qualifying: 'Quali',
  race: 'Corrida',
}

/**
 * Mapeamento de equivalências para compatibilidade com formatos legados de completedSessions
 * (ex: 'q1', 'q2', 'q3' mapeiam para 'qualifying'; 'sprint_shootout' mapeia para 'sprint_qualifying', etc.)
 */
function normalizeSessionKey(session: string): string {
  const s = session.toLowerCase().trim()
  if (s === 'qualy' || s === 'quali') {
    return 'qualifying'
  }
  if (s === 'sq' || s === 'sprint_shootout' || s === 'sprint_qualy') {
    return 'sprint_qualifying'
  }
  if (s === 'sprint') {
    return 'sprint_race'
  }
  return s
}

/**
 * Normaliza uma lista de sessões concluídas pelo usuário/sistema
 */
export function normalizeCompletedSessions(completedSessions: string[]): string[] {
  const set = new Set<string>()
  for (const item of completedSessions) {
    if (!item) continue
    set.add(item)
    const norm = normalizeSessionKey(item)
    set.add(norm)
  }
  // Se q3 foi concluído, o bloco de qualifying inteiro é considerado concluído
  if (set.has('q3')) {
    set.add('qualifying')
  }
  return Array.from(set)
}

/**
 * Localiza se a rodada possui formato Sprint no calendário canônico da FIA 2026.
 */
export function hasSprintWeekend(round: number): boolean {
  const profile = CIRCUIT_PERFORMANCE_PROFILES.find((c) => c.round === round)
  return profile?.hasSprint ?? false
}

/**
 * Retorna o cronograma canônico ordenado para a rodada especificada.
 * - GP Normal: tp1 → tp2 → tp3 → qualifying → race
 * - GP Sprint: tp1 → sprint_qualifying → sprint_race → qualifying → race
 */
export function getCanonicalWeekendSchedule(round: number): CanonicalWeekendSession[] {
  return hasSprintWeekend(round) ? [...SPRINT_WEEKEND_SCHEDULE] : [...NORMAL_WEEKEND_SCHEDULE]
}

/**
 * Retorna a próxima sessão obrigatória do fim de semana que ainda não foi concluída.
 * Se todas as sessões anteriores estiverem completas, retorna 'race' ou null (se race já concluída).
 */
export function getNextRequiredWeekendSession(
  round: number,
  completedSessions: string[] = [],
): CanonicalWeekendSession | null {
  const schedule = getCanonicalWeekendSchedule(round)
  const normalizedCompleted = normalizeCompletedSessions(completedSessions)

  for (const session of schedule) {
    if (!normalizedCompleted.includes(session)) {
      return session
    }
  }

  return null
}

/**
 * Validação de autorização para a Corrida Principal.
 * Retorna se a corrida está liberada e, se não estiver, a mensagem de bloqueio e a próxima sessão necessária.
 */
export interface WeekendRaceGateCheck {
  allowed: boolean
  nextRequiredSession: CanonicalWeekendSession | null
  nextSessionLabel: string | null
  blockingReason: string | null
  isSprintWeekend: boolean
  schedule: CanonicalWeekendSession[]
}

export function checkWeekendRaceAccess(
  round: number,
  completedSessions: string[] = [],
): WeekendRaceGateCheck {
  const schedule = getCanonicalWeekendSchedule(round)
  const isSprint = hasSprintWeekend(round)
  const nextRequired = getNextRequiredWeekendSession(round, completedSessions)

  // A corrida só é permitida se a próxima sessão requerida for 'race'
  // (ou null, se a corrida já foi completada e está sendo retomada/revisada)
  if (nextRequired === 'race' || nextRequired === null) {
    return {
      allowed: true,
      nextRequiredSession: nextRequired,
      nextSessionLabel: nextRequired ? SESSION_DISPLAY_NAMES[nextRequired] : null,
      blockingReason: null,
      isSprintWeekend: isSprint,
      schedule,
    }
  }

  const shortName = SESSION_SHORT_LABELS[nextRequired] || nextRequired
  const fullName = SESSION_DISPLAY_NAMES[nextRequired] || nextRequired

  return {
    allowed: false,
    nextRequiredSession: nextRequired,
    nextSessionLabel: fullName,
    blockingReason: `Conclua ou simule ${shortName} para continuar.`,
    isSprintWeekend: isSprint,
    schedule,
  }
}

/**
 * Helper de persistência/leitura de sessões concluídas no localStorage por temporada e rodada.
 * Garante sincronização entre RaceSlimWrapper, LiveRacePage e simuladores de fim de semana.
 */
const STORAGE_PREFIX = 'apex_f1_weekend_completed_v1'

export function getCompletedSessionsStorageKey(seasonId: string, round: number): string {
  return `${STORAGE_PREFIX}_${seasonId}_r${round}`
}

export function readStoredCompletedSessions(seasonId: string, round: number): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(getCompletedSessionsStorageKey(seasonId, round))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeStoredCompletedSessions(
  seasonId: string,
  round: number,
  sessions: string[],
): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const norm = normalizeCompletedSessions(sessions)
    window.localStorage.setItem(
      getCompletedSessionsStorageKey(seasonId, round),
      JSON.stringify(norm),
    )
  } catch {
    // Ignore localStorage write error
  }
}

export const weekendProgressionService = {
  getCanonicalWeekendSchedule,
  getNextRequiredWeekendSession,
  checkWeekendRaceAccess,
  hasSprintWeekend,
  normalizeCompletedSessions,
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
}
