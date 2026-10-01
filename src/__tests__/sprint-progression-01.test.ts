import { describe, it, expect, beforeEach } from 'vitest'
import { resolveSessionVisualState, getRaceWeekendPipeline } from '@/services/weekendScheduleConfig'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
import {
  normalizeCompletedSessions,
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '@/services/weekendProgressionService'
describe('SPRINT-PROGRESSION-01: Canonical Sprint Weekend Progression & SQ1 Unlocking Gate (SP01–SP06)', () => {
  const SPRINT_ROUND = 4
  const SPRINT_SEASON = 'season_2026_sprint'

  beforeEach(() => {
    localStorage.clear()
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  // SP01 — TL1/TL2 incompletos → SQ1 locked (bloqueado)
  it('SP01 — TL1/TL2 incompletos → SQ1 permanece bloqueado (locked)', () => {
    // DUMP TEST
// 1. Sem nenhuma sessão
    const stateEmpty = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tp1',
      completedSessions: [],
    })
    expect(stateEmpty).toBe('locked')

    // 2. Com TL1 isolado
    const stateOnlyTl1 = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tp2',
      completedSessions: ['tp1'],
    })
    expect(stateOnlyTl1).toBe('locked')

    // 3. Com alias FP1 isolado
    const stateOnlyFp1 = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tp2',
      completedSessions: ['fp1'],
    })
    expect(stateOnlyFp1).toBe('locked')
  })

  // SP02 — Bloqueios corretos antes do SQ1 e validação de gates
  it('SP02 — TL2 requer TL1 e SQ1 requer estritamente TL1 + TL2 concluídos', () => {
    // TL2 sem TL1 está bloqueado
    const tl2StateWithoutTl1 = resolveSessionVisualState({
      sessionId: 'tp2',
      activeSessionId: 'tp1',
      completedSessions: [],
    })
    expect(tl2StateWithoutTl1).toBe('locked')

    // TL2 com TL1 está disponível
    const tl2StateWithTl1 = resolveSessionVisualState({
      sessionId: 'tp2',
      activeSessionId: 'tp1',
      completedSessions: ['tp1'],
    })
    expect(tl2StateWithTl1).toBe('available')

    // SQ1 com apenas TL2 (sem TL1) permanece bloqueado
    const sq1StateOnlyTl2 = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tp2',
      completedSessions: ['tp2'],
    })
    expect(sq1StateOnlyTl2).toBe('locked')
  })

  // SP03 — TL1 + TL2 concluídas → SQ1 desbloqueado (available / active) com suporte a identificadores divergentes (TL2 vs FP2, SQ1 vs SPRINT_Q1)
  it('SP03 — TL1 + TL2 concluídas → SQ1 fica disponível (unlocked) mesmo com identificadores divergentes', () => {
    // Canônico puro: tp1 + tp2
    const sq1AvailableCanonical = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tp2',
      completedSessions: ['tp1', 'tp2'],
    })
    expect(sq1AvailableCanonical).toBe('available')

    // Com aliases TL1 + TL2
    const sq1WithTl = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tl2' as any,
      completedSessions: ['tl1', 'tl2'],
    })
    expect(sq1WithTl).toBe('available')

    // Com aliases FP1 + FP2
    const sq1WithFp = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'fp2' as any,
      completedSessions: ['fp1', 'fp2'],
    })
    expect(sq1WithFp).toBe('available')

    // Normalizador de sessões normaliza FP2 e SPRINT_Q1
    const normalized = normalizeCompletedSessions(['fp1', 'fp2', 'sprint_q1'])
    expect(normalized).toContain('tp1')
    expect(normalized).toContain('tp2')
    expect(normalized).toContain('sq1')
  })

  // SP04 — SQ1 selecionado após TL2 → sessão ativa e não locked
  it('SP04 — SQ1 selecionado na esteira após TL2 → não bloqueado (estado active ou available)', () => {
    const completed = ['tp1', 'tp2']
    const visualState = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'sq1',
      completedSessions: completed,
    })
    expect(visualState).toBe('active')
    expect(visualState).not.toBe('locked')
  })

  // SP05 — Save + Reload e persistência canônica preservam o estado desbloqueado do save real
  it('SP05 — Persistência no save real e reload preservam o gate de SQ1 desbloqueado', async () => {
    // 1. Gravar via weekendProgressionService (armazenamento canônico persistido no save)
    writeStoredCompletedSessions(SPRINT_SEASON, SPRINT_ROUND, ['tp1', 'tp2'])

    // 2. Simular reload (leitura do storage persistido)
    const reloaded = readStoredCompletedSessions(SPRINT_SEASON, SPRINT_ROUND)
    expect(reloaded).toContain('tp1')
    expect(reloaded).toContain('tp2')

    // 3. Avaliar desbloqueio de SQ1 a partir dos dados persistidos
    const visualState = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'sq1',
      completedSessions: reloaded,
    })
    expect(visualState).toBe('active')
    expect(visualState).not.toBe('locked')

    // 4. Migração e persistência via canonicalWeekendSlotPersistenceService
    const slotState = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: 'test_career',
      seasonId: SPRINT_SEASON,
      round: SPRINT_ROUND,
      weekendFormat: 'SPRINT',
    })
    expect(slotState).toBeDefined()
    // Slots 1 e 2 foram concluídos, próximo slot disponível
    expect(slotState.completedSlots).toContain(1)
  })

  // SP06 — Transições completas do formato Sprint (TL1 → TL2 → SQ1 → SQ2 → SQ3 → SPRINT → Q1 → Q2 → Q3 → RACE)
  it('SP06 — Transições sequenciais completas do fim de semana Sprint sem afetar fim de semana Normal', () => {
    const sprintPipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const sessionIds = sprintPipeline.map((s) => s.id)
    expect(sessionIds).toEqual([
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

    // SQ1 completo libera SQ2
    expect(
      resolveSessionVisualState({
        sessionId: 'sq2',
        activeSessionId: 'sq1',
        completedSessions: ['tp1', 'tp2', 'sq1'],
      }),
    ).toBe('available')

    // SQ2 completo libera SQ3
    expect(
      resolveSessionVisualState({
        sessionId: 'sq3',
        activeSessionId: 'sq2',
        completedSessions: ['tp1', 'tp2', 'sq1', 'sq2'],
      }),
    ).toBe('available')

    // SQ3 completo libera SPRINT RACE
    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'sq3',
        completedSessions: ['tp1', 'tp2', 'sq1', 'sq2', 'sq3'],
      }),
    ).toBe('available')

    // Sprint Race concluída libera Q1 Principal
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'sprint_race',
        completedSessions: ['tp1', 'tp2', 'sq1', 'sq2', 'sq3', 'sprint_race'],
      }),
    ).toBe('available')

    // Fim de semana normal sem regressão
    const normalPipeline = getRaceWeekendPipeline({ format: 'standard', includePractice3: true })
    expect(normalPipeline.map((s) => s.id)).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])
  })
})
