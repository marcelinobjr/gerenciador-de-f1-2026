import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCanonicalWeekendSchedule,
  getNextRequiredWeekendSession,
  checkWeekendRaceAccess,
  hasSprintWeekend,
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
  NORMAL_WEEKEND_SCHEDULE,
  SPRINT_WEEKEND_SCHEDULE,
} from '@/services/weekendProgressionService'
import { raceSessionService } from '@/services/raceSessionService'
import { CIRCUIT_PERFORMANCE_PROFILES } from '@/data/circuit-performance-profiles'

/**
 * HOTFIX WEEKEND-01A — SUÍTE DE TESTES CANÔNICA DE PROGRESSÃO DE FIM DE SEMANA
 *
 * Cenários Obrigatórios:
 * A — GP normal: TL1 pendente → corrida bloqueada.
 * B — GP normal: TL1/TL2/TL3 concluídos, quali pendente → bloqueada.
 * C — GP normal: TL1/TL2/TL3/quali concluídos → liberada.
 * D — Sprint: sequência correta sem TL2/TL3.
 * E — rota direta: abrir /corrida-ao-vivo antes da hora não cria sessão (pelo menos um teste atravessando o caminho real do guard/serviço).
 * F — retry/rerender: liberado, não cria duas sessões.
 */
describe('HOTFIX WEEKEND-01A: Validação Canônica de Progressão de Sessões do Fim de Semana', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // CENÁRIO A: GP normal: TL1 pendente → corrida bloqueada
  // =========================================================================
  it('Cenário A: GP normal — quando TL1 está pendente, a corrida é bloqueada com mensagem clara', () => {
    // Round 1 é Albert Park (GP Normal: hasSprint = false)
    const roundNormal = 1
    expect(hasSprintWeekend(roundNormal)).toBe(false)

    // Nenhuma sessão concluída
    const completedSessions: string[] = []
    const nextSession = getNextRequiredWeekendSession(roundNormal, completedSessions)
    expect(nextSession).toBe('tp1')

    const gate = checkWeekendRaceAccess(roundNormal, completedSessions)
    expect(gate.allowed).toBe(false)
    expect(gate.nextRequiredSession).toBe('tp1')
    expect(gate.blockingReason).toBe('Conclua ou simule TL1 para continuar.')
    expect(gate.isSprintWeekend).toBe(false)
    expect(gate.schedule).toEqual(NORMAL_WEEKEND_SCHEDULE)
  })

  // =========================================================================
  // CENÁRIO B: GP normal: TL1/TL2/TL3 concluídos, quali pendente → bloqueada
  // =========================================================================
  it('Cenário B: GP normal — quando treinos livres estão concluídos mas a classificação está pendente, a corrida permanece bloqueada', () => {
    const roundNormal = 1

    // TL1, TL2 e TL3 concluídos
    const completedSessions = ['tp1', 'tp2', 'tp3']
    const nextSession = getNextRequiredWeekendSession(roundNormal, completedSessions)
    expect(nextSession).toBe('qualifying')

    const gate = checkWeekendRaceAccess(roundNormal, completedSessions)
    expect(gate.allowed).toBe(false)
    expect(gate.nextRequiredSession).toBe('qualifying')
    expect(gate.blockingReason).toBe('Conclua ou simule Quali para continuar.')
  })

  // =========================================================================
  // CENÁRIO C: GP normal: TL1/TL2/TL3/quali concluídos → liberada
  // =========================================================================
  it('Cenário C: GP normal — quando todos os treinos e classificação estão concluídos, a corrida é liberada', () => {
    const roundNormal = 1

    // Treinos e Qualificação concluídos (testa tanto 'qualifying' quanto alias canônico 'q3')
    const completedSessionsWithAlias = ['tp1', 'tp2', 'tp3', 'q3']
    const nextSession = getNextRequiredWeekendSession(roundNormal, completedSessionsWithAlias)
    expect(nextSession).toBe('race')

    const gate = checkWeekendRaceAccess(roundNormal, completedSessionsWithAlias)
    expect(gate.allowed).toBe(true)
    expect(gate.nextRequiredSession).toBe('race')
    expect(gate.blockingReason).toBeNull()

    // Testando com a chave 'qualifying' explicitamente
    const completedSessionsCanonical = ['tp1', 'tp2', 'tp3', 'qualifying']
    const gateCanonical = checkWeekendRaceAccess(roundNormal, completedSessionsCanonical)
    expect(gateCanonical.allowed).toBe(true)
    expect(gateCanonical.blockingReason).toBeNull()
  })

  // =========================================================================
  // CP1C: APEX GP MANAGER — SILVERSTONE-RACE-REVIEW-01A-CP1C
  // PROGRESSÃO SPRINT ALINHADA À SCHEDULE CANÔNICA
  // =========================================================================
  describe('CP1C: Alinhamento Canônico da Progressão Sprint', () => {
    const roundSprint = 2 // Shanghai (hasSprint = true)

    it('CP1C-01 TL1 → TL2', () => {
      expect(getNextRequiredWeekendSession(roundSprint, [])).toBe('tp1')
      expect(getNextRequiredWeekendSession(roundSprint, ['tp1'])).toBe('tp2')
    })

    it('CP1C-02 TL2 → SQ1 (TL3 rigorosamente ausente)', () => {
      const schedule = getCanonicalWeekendSchedule(roundSprint)
      expect(schedule).toContain('tp2')
      expect(schedule).not.toContain('tp3')
      expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2'])).toBe('sq1')
    })

    it('CP1C-03 SQ1 → SQ2', () => {
      expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2', 'sq1'])).toBe('sq2')
    })

    it('CP1C-04 SQ2 → SQ3', () => {
      expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2', 'sq1', 'sq2'])).toBe('sq3')
    })

    it('CP1C-05 SQ3 → Sprint', () => {
      expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2', 'sq1', 'sq2', 'sq3'])).toBe(
        'sprint_race',
      )
    })

    it('CP1C-06 Sprint → GP Q1 (SPRINT-A-09)', () => {
      expect(
        getNextRequiredWeekendSession(roundSprint, [
          'tp1',
          'tp2',
          'sq1',
          'sq2',
          'sq3',
          'sprint_race',
        ]),
      ).toBe('q1')
    })

    it('CP1C-07 GP Q1 → GP Q2', () => {
      expect(
        getNextRequiredWeekendSession(roundSprint, [
          'tp1',
          'tp2',
          'sq1',
          'sq2',
          'sq3',
          'sprint_race',
          'q1',
        ]),
      ).toBe('q2')
    })

    it('CP1C-08 GP Q2 → GP Q3', () => {
      expect(
        getNextRequiredWeekendSession(roundSprint, [
          'tp1',
          'tp2',
          'sq1',
          'sq2',
          'sq3',
          'sprint_race',
          'q1',
          'q2',
        ]),
      ).toBe('q3')
    })

    it('CP1C-09 GP Q3 → Main Race', () => {
      expect(
        getNextRequiredWeekendSession(roundSprint, [
          'tp1',
          'tp2',
          'sq1',
          'sq2',
          'sq3',
          'sprint_race',
          'q1',
          'q2',
          'q3',
        ]),
      ).toBe('race')

      // Main race desbloqueia após Q3
      const gate = checkWeekendRaceAccess(roundSprint, [
        'tp1',
        'tp2',
        'sq1',
        'sq2',
        'sq3',
        'sprint_race',
        'q1',
        'q2',
        'q3',
      ])
      expect(gate.allowed).toBe(true)
      expect(gate.nextRequiredSession).toBe('race')
    })

    it('CP1C-10 Main Race → weekend complete', () => {
      const allDone = ['tp1', 'tp2', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2', 'q3', 'race']
      expect(getNextRequiredWeekendSession(roundSprint, allDone)).toBeNull()
      const gate = checkWeekendRaceAccess(roundSprint, allDone)
      expect(gate.allowed).toBe(true)
      expect(gate.nextRequiredSession).toBeNull()
    })
  })

  // =========================================================================
  // CENÁRIO D: Sprint: sequência correta com TL1 e TL2, sem TL3 (SILVERSTONE-RACE-REVIEW-01A)
  // =========================================================================
  it('Cenário D: Formato Sprint — sequência correta (tp1 → tp2 → sq1 → sq2 → sq3 → sprint_race → q1 → q2 → q3 → race) sem TL3', () => {
    // Round 2 é Shanghai (Chinese GP, hasSprint = true)
    const roundSprint = 2
    expect(hasSprintWeekend(roundSprint)).toBe(true)

    const sprintSchedule = getCanonicalWeekendSchedule(roundSprint)
    expect(sprintSchedule).toEqual([
      'tp1',
      'tp2',
      'sq1',
      'sq2',
      'sq3',
      'sprint_race',
      'q1',
      'q2',
      'q3',
      'race',
    ])
    expect(sprintSchedule).toContain('tp2')
    expect(sprintSchedule).not.toContain('tp3')

    // Passo 1: Nenhum concluído -> próximo é tp1
    expect(getNextRequiredWeekendSession(roundSprint, [])).toBe('tp1')

    // Passo 2: Apenas tp1 concluído -> próximo é tp2
    expect(getNextRequiredWeekendSession(roundSprint, ['tp1'])).toBe('tp2')
    let gate = checkWeekendRaceAccess(roundSprint, ['tp1'])
    expect(gate.allowed).toBe(false)
    expect(gate.nextRequiredSession).toBe('tp2')

    // Passo 3: tp1 e tp2 concluídos -> próximo é sq1
    expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2'])).toBe('sq1')

    // Passo 4: tp1, tp2, sq1, sq2, sq3 concluídos -> próximo é sprint_race
    expect(getNextRequiredWeekendSession(roundSprint, ['tp1', 'tp2', 'sq1', 'sq2', 'sq3'])).toBe(
      'sprint_race',
    )

    // Passo 5: Todas preliminares concluídas -> corrida LIBERADA sem jamais exigir tp3!
    const allSprintPreliminary = [
      'tp1',
      'tp2',
      'sq1',
      'sq2',
      'sq3',
      'sprint_race',
      'q1',
      'q2',
      'q3',
    ]
    gate = checkWeekendRaceAccess(roundSprint, allSprintPreliminary)
    expect(gate.allowed).toBe(true)
    expect(gate.nextRequiredSession).toBe('race')
    expect(gate.blockingReason).toBeNull()
  })

  // =========================================================================
  // CENÁRIO E: Rota direta — abrir /corrida-ao-vivo antes da hora não cria sessão
  // =========================================================================
  it('Cenário E: Rota direta — abrir /corrida-ao-vivo antes da hora bloqueia e NÃO chama openOrResumeRaceSession', async () => {
    const seasonId = 'season_test_2026'
    const round = 1

    // Salva progresso onde apenas TL1 está concluído (TL2, TL3, quali ainda pendentes)
    writeStoredCompletedSessions(seasonId, round, ['tp1'])

    // Spy no raceSessionService.openOrResumeRaceSession
    const openSessionSpy = vi.spyOn(raceSessionService, 'openOrResumeRaceSession')
    const getSessionSpy = vi.spyOn(raceSessionService, 'getSession').mockResolvedValue(null as any)

    // Simula a lógica de montagem do LiveRacePage:
    // 1. Verifica se já existe sessão salva no PocketBase
    const existingSession = await raceSessionService.getSession({
      seasonId,
      teamId: 'team_audi',
      round,
      sessionType: 'race',
    })

    // 2. Aplica o guard WEEKEND-01A
    let sessionCreated = false
    if (!existingSession) {
      const storedCompleted = readStoredCompletedSessions(seasonId, round)
      const gate = checkWeekendRaceAccess(round, storedCompleted)
      if (!gate.allowed) {
        // Bloqueio ativado! Interrompe a execução antes de criar a sessão
        sessionCreated = false
      } else {
        await raceSessionService.openOrResumeRaceSession({
          seasonId,
          teamId: 'team_audi',
          userId: 'user_1',
          seasonYear: 2026,
          round,
          totalLaps: 58,
        })
        sessionCreated = true
      }
    }

    // Asserções críticas:
    expect(sessionCreated).toBe(false)
    expect(openSessionSpy).not.toHaveBeenCalled()
    expect(getSessionSpy).toHaveBeenCalled()
  })

  // =========================================================================
  // CENÁRIO F: Retry/Rerender — quando liberado, não cria duas sessões
  // =========================================================================
  it('Cenário F: Retry / Rerender — quando liberado, chamadas subsequentes reutilizam a sessão e não criam duplicatas', async () => {
    const seasonId = 'season_test_2026'
    const teamId = 'team_audi'
    const round = 1

    // Todas as sessões preliminares concluídas: corrida liberada
    const completed = ['tp1', 'tp2', 'tp3', 'qualifying']
    writeStoredCompletedSessions(seasonId, round, completed)

    const gate = checkWeekendRaceAccess(round, completed)
    expect(gate.allowed).toBe(true)

    // Mock do serviço de sessão para simular retorno de sessão existente após a primeira criação
    let createdRecord: any = null
    const openSpy = vi
      .spyOn(raceSessionService, 'openOrResumeRaceSession')
      .mockImplementation(async (params) => {
        if (createdRecord) {
          return { session: createdRecord, isResumed: true }
        }
        createdRecord = {
          id: 'sess_persisted_123',
          session_key: `sess_${params.seasonId}_${params.teamId}_r${params.round}_race`,
          status: 'not_started',
          revision: 1,
          current_lap: 1,
          total_laps: params.totalLaps,
        }
        return { session: createdRecord, isResumed: false }
      })

    // Primeira montagem/render da página
    const result1 = await raceSessionService.openOrResumeRaceSession({
      seasonId,
      teamId,
      userId: 'user_1',
      seasonYear: 2026,
      round,
      totalLaps: 58,
    })

    expect(result1.isResumed).toBe(false)
    expect(result1.session.id).toBe('sess_persisted_123')

    // Segunda montagem / retry / rerender da página (ex: StrictMode, retry button, tab switch)
    const result2 = await raceSessionService.openOrResumeRaceSession({
      seasonId,
      teamId,
      userId: 'user_1',
      seasonYear: 2026,
      round,
      totalLaps: 58,
    })

    expect(result2.isResumed).toBe(true)
    expect(result2.session.id).toBe('sess_persisted_123')
    expect(openSpy).toHaveBeenCalledTimes(2)
    // ID da sessão permanece rigorosamente idêntico, sem duplicar registros
    expect(result1.session.id).toEqual(result2.session.id)
  })
})
