/**
 * weekendProgressionService.ts
 *
 * HOTFIX WEEKEND-01A / SILVERSTONE-RACE-REVIEW-01A:
 * Bloquear bypass de sessões do fim de semana.
 * Define o cronograma canônico e calcula a próxima sessão obrigatória pendente.
 * Formatos:
 *  - GP Normal: tp1 → tp2 → tp3 → q1 → q2 → q3 → race
 *  - GP Sprint: tp1 → tp2 → sq1 → sq2 → sq3 → sprint_race → q1 → q2 → q3 → race
 * (Detecção via CIRCUIT_PERFORMANCE_PROFILES[round].hasSprint)
 */

import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'

export type CanonicalWeekendSession =
  | 'tp1'
  | 'tp2'
  | 'tp3'
  | 'sq1'
  | 'sq2'
  | 'sq3'
  | 'sprint_qualifying'
  | 'sprint_race'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'qualifying'
  | 'race'

import {
  SPRINT_WEEKEND_SCHEDULE_CONFIG,
  NORMAL_WEEKEND_MACRO_SLOTS,
  SPRINT_WEEKEND_MACRO_SLOTS,
  expandMacroSlotsToSessions,
} from '@/services/weekendScheduleConfig'

export const NORMAL_WEEKEND_SCHEDULE: CanonicalWeekendSession[] = [
  ...expandMacroSlotsToSessions(NORMAL_WEEKEND_MACRO_SLOTS),
]

export const NORMAL_WEEKEND_MACRO_SCHEDULE: CanonicalWeekendSession[] = [
  'tp1',
  'tp2',
  'tp3',
  'qualifying',
  'race',
]

export const SPRINT_WEEKEND_SCHEDULE: CanonicalWeekendSession[] = [
  ...SPRINT_WEEKEND_SCHEDULE_CONFIG.sessionIds,
]

export const SPRINT_WEEKEND_MACRO_SCHEDULE: CanonicalWeekendSession[] = [
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
  sq1: 'SQ1 (Qualificação Sprint — Fase 1)',
  sq2: 'SQ2 (Qualificação Sprint — Fase 2)',
  sq3: 'SQ3 (Qualificação Sprint — Fase 3)',
  sprint_qualifying: 'Qualificação Sprint',
  sprint_race: 'Corrida Sprint',
  q1: 'Q1 (Classificação — Fase 1)',
  q2: 'Q2 (Classificação — Fase 2)',
  q3: 'Q3 (Classificação — Fase 3)',
  qualifying: 'Classificação Oficial',
  race: 'Corrida Principal',
}

export const SESSION_SHORT_LABELS: Record<CanonicalWeekendSession, string> = {
  tp1: 'TL1',
  tp2: 'TL2',
  tp3: 'TL3',
  sq1: 'SQ1',
  sq2: 'SQ2',
  sq3: 'SQ3',
  sprint_qualifying: 'Quali Sprint',
  sprint_race: 'Sprint',
  q1: 'Q1',
  q2: 'Q2',
  q3: 'Q3',
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
  if (s === 'fp1' || s === 'tl1') {
    return 'tp1'
  }
  if (s === 'fp2' || s === 'tl2') {
    return 'tp2'
  }
  if (s === 'fp3' || s === 'tl3') {
    return 'tp3'
  }
  if (s === 'sprint_q1' || s === 'sprint_quali_1' || s === 'sq_1') {
    return 'sq1'
  }
  if (s === 'sprint_q2' || s === 'sprint_quali_2' || s === 'sq_2') {
    return 'sq2'
  }
  if (s === 'sprint_q3' || s === 'sprint_quali_3' || s === 'sq_3') {
    return 'sq3'
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
  // Se q3 foi concluído, o bloco de qualifying inteiro é considerado concluído (e suas fases para compatibilidade).
  // Nota: 'qualifying' só expande q1..q3 se for expressamente marcado como completo no formato macro.
  // SQ e Q permanecem estritamente isolados (SQ não expande Q; Q não expande SQ).
  if (set.has('q3') || set.has('qualifying')) {
    set.add('qualifying')
    set.add('q1')
    set.add('q2')
    set.add('q3')
  }
  if (set.has('q2')) {
    set.add('q1')
  }
  // Se sq3 foi concluído, o bloco de sprint_qualifying é considerado concluído (e suas fases).
  // SQ3 não conclui Q1/Q2/Q3 e não pula a Sprint Race.
  if (set.has('sq3') || set.has('sprint_qualifying')) {
    set.add('sprint_qualifying')
    set.add('sq1')
    set.add('sq2')
    set.add('sq3')
  }
  if (set.has('sq2')) {
    set.add('sq1')
  }
  // Mapeamentos canônicos e reversos de aliases para compatibilidade total entre engines
  if (set.has('tp1')) {
    set.add('tl1')
    set.add('fp1')
  }
  if (set.has('tp2')) {
    set.add('tl2')
    set.add('fp2')
  }
  if (set.has('tp3')) {
    set.add('tl3')
    set.add('fp3')
  }
  if (set.has('sq1')) {
    set.add('sprint_q1')
  }
  if (set.has('sq2')) {
    set.add('sprint_q2')
  }
  if (set.has('sq3')) {
    set.add('sprint_q3')
  }
  // Se sprint_race foi concluído, marcar alias 'sprint'
  if (set.has('sprint_race') || set.has('sprint')) {
    set.add('sprint_race')
    set.add('sprint')
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
 * - GP Normal: tp1 → tp2 → tp3 → q1 → q2 → q3 → race
 * - GP Sprint: tp1 → tp2 → sq1 → sq2 → sq3 → sprint_race → q1 → q2 → q3 → race
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
    const parsed = raw ? JSON.parse(raw) : []
    const list: string[] = Array.isArray(parsed) ? parsed : []

    // BUG-SQ3-TRANSITION-R2 / BUG-SQ3-TRANSITION-R3: Reconciliação canônica com canonicalQualifyingPersistenceService
    // O estado canônico é a fonte da verdade decisória. Uma sessão status === 'paused' ou 'running' (órfão)
    // NÃO PODE constar como concluída no completedSessions.
    // Ao reidratar:
    // - se a sessão de qualificação canônica estiver 'paused' ou 'running', expurgar de completedSessions.
    // - se estiver 'completed', garantir que conste em completedSessions.
    try {
      const qualiStages = ['q1', 'q2', 'q3', 'sq1', 'sq2', 'sq3'] as const
      let modified = false
      const validated = new Set(list)

      for (const stg of qualiStages) {
        // Verificar ambas as chaves: legado apex_f1_quali_ e canônica apex_qualifying_stage_state_v2
        const legacyKey = `apex_f1_quali_${seasonId}_r${round}_${stg}`
        const canonicalKey = `apex_qualifying_stage_state_v2_${seasonId}_r${round}_${stg}`
        const resultKey = `apex_qualifying_stage_result_v2_${seasonId}_r${round}_${stg}`
        const rawState =
          window.localStorage.getItem(canonicalKey) || window.localStorage.getItem(legacyKey)
        const rawResult = window.localStorage.getItem(resultKey)

        if (rawState) {
          const parsedState = JSON.parse(rawState)
          if (parsedState && parsedState.status) {
            if (
              parsedState.status === 'paused' ||
              parsedState.status === 'running' ||
              parsedState.status === 'not_started'
            ) {
              // BUG-SQ1-RESULT-INTEGRITY-01 (Correção 3): purgar etapa de quali da lista de concluídas
              // se o estado canônico estiver not_started (ou paused/running)
              if (validated.has(stg)) {
                validated.delete(stg)
                modified = true
              }
            } else if (parsedState.status === 'completed') {
              // Só considerar concluída se houver resultado persistido com entries válidas
              let hasValidResult = false
              if (rawResult) {
                try {
                  const parsedResult = JSON.parse(rawResult)
                  if (
                    parsedResult &&
                    Array.isArray(parsedResult.entries) &&
                    parsedResult.entries.length > 0
                  ) {
                    hasValidResult = true
                  }
                } catch {
                  // ignore
                }
              }

              if (hasValidResult) {
                if (!validated.has(stg)) {
                  validated.add(stg)
                  modified = true
                }
              } else {
                // BUG-SQ1-RESULT-INTEGRITY-01 (Correção 3): Sem resultado persistido válido, purgar da lista de concluídas
                if (validated.has(stg)) {
                  validated.delete(stg)
                  modified = true
                }
              }
            }
          }
        } else {
          // BUG-SQ1-RESULT-INTEGRITY-01 (Correção 3): se estado canônico ausente, purgar da lista de concluídas
          if (validated.has(stg)) {
            validated.delete(stg)
            modified = true
          }
        }
      }

      if (modified) {
        const updatedList = Array.from(validated)
        window.localStorage.setItem(
          getCompletedSessionsStorageKey(seasonId, round),
          JSON.stringify(updatedList),
        )
        return updatedList
      }
    } catch {
      // Ignora erro na reconciliação e retorna lista básica
    }

    return list
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

export interface ResetWeekendOptions {
  careerId?: string
  seasonId: string
  round: number
}

export interface ResetWeekendResult {
  success: boolean
  clearedKeys: string[]
}

/**
 * Reseta os dados e estados de sessões de um fim de semana específico sem tocar
 * em campeonatos, pontuações, morais, contratos, PU ou histórico de outras rodadas.
 */
export function resetWeekendForRound(options: ResetWeekendOptions): ResetWeekendResult {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { success: false, clearedKeys: [] }
  }

  const { careerId, seasonId, round } = options
  const clearedKeys: string[] = []

  const removeKey = (key: string) => {
    try {
      if (window.localStorage.getItem(key) !== null) {
        window.localStorage.removeItem(key)
        clearedKeys.push(key)
      }
    } catch {
      // Ignora erro de acesso ao localStorage
    }
  }

  // 1. Chave de sessões concluídas do fim de semana
  removeKey(getCompletedSessionsStorageKey(seasonId, round))

  // 2. Chaves de qualificação por estágio (SQ1, SQ2, SQ3, Q1, Q2, Q3)
  const qualiStages = ['sq1', 'sq2', 'sq3', 'q1', 'q2', 'q3'] as const
  for (const stage of qualiStages) {
    removeKey(`apex_qualifying_stage_state_v2_${seasonId}_r${round}_${stage}`)
    removeKey(`apex_qualifying_stage_result_v2_${seasonId}_r${round}_${stage}`)
    removeKey(`apex_f1_quali_${seasonId}_r${round}_${stage}`)
  }

  // 3. Grid final de qualificação
  removeKey(`apex_qualifying_final_grid_v2_${seasonId}_r${round}`)

  // 4. Parc Fermé
  removeKey(`apex_parc_ferme_v2_${seasonId}_r${round}`)

  // 5. Pneus do fim de semana
  removeKey(`apex_gp_tires_${seasonId}_r${round}`)

  // 6. Chaves que dependem de careerId
  if (careerId) {
    const practiceTypes = ['tp1', 'tp2', 'tp3'] as const
    for (const tp of practiceTypes) {
      removeKey(`apex_practice_session_${careerId}_${seasonId}_${round}_${tp}`)
      removeKey(`apex_practice_prep_${careerId}_${seasonId}_${round}_${tp}`)
      removeKey(`apex_practice_setup_${careerId}_${seasonId}_r${round}_${tp}`)
    }

    // Slots do fim de semana (RACE-SPRINT-SLOTS-01A)
    removeKey(`apex_weekend_slot_state_v1_${careerId}_${seasonId}_r${round}`)

    // Estados canônicos de corrida (Principal e Sprint)
    removeKey(`apex_race_v2_canonical_state_${careerId}_s${seasonId}_r${round}`)
    removeKey(`apex_sprint_race_canonical_state_${careerId}_s${seasonId}_r${round}`)
    removeKey(`f1_2026_canonical_race_v2_${careerId}_s${seasonId}_r${round}`)
    removeKey(`f1_2026_canonical_race_v2_sprint_${careerId}_s${seasonId}_r${round}`)

    // Chaves de orquestração legado/alternativas se existirem para este round
    const orchestratorPhases = ['q1', 'q2', 'q3', 'sq1', 'sq2', 'sq3', 'tp1', 'tp2', 'tp3']
    for (const p of orchestratorPhases) {
      removeKey(`apex_sprint_${p}_state_${careerId}_${seasonId}_r${round}`)
      removeKey(`apex_${p}_state_${careerId}_${seasonId}_r${round}`)
    }
    removeKey(`apex_qualifying_result_state_${careerId}_${seasonId}_r${round}`)
    removeKey(`apex_starting_grid_state_${careerId}_${seasonId}_r${round}`)
    removeKey(`apex_sprint_qualifying_result_state_${careerId}_${seasonId}_r${round}`)
    removeKey(`apex_sprint_starting_grid_state_${careerId}_${seasonId}_r${round}`)
  }

  return {
    success: true,
    clearedKeys,
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
  resetWeekendForRound,
}
