import { describe, it, expect } from 'vitest'
import {
  getRaceWeekendPipeline,
  CANONICAL_SESSION_DEFINITIONS,
  resolveSessionVisualState,
} from '@/services/weekendScheduleConfig'
import {
  getCanonicalWeekendSchedule,
  NORMAL_WEEKEND_SCHEDULE,
  SPRINT_WEEKEND_SCHEDULE,
  checkWeekendRaceAccess,
  hasSprintWeekend,
} from '@/services/weekendProgressionService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { SPRINT_SLOT_TYPES, NORMAL_SLOT_TYPES } from '@/services/weekendSlotSequenceService'

describe('SILVERSTONE-RACE-REVIEW-01 — Bloco A: Sprint Flow 02', () => {
  // SPRINT-02-01: Formato Normal continua TL1 -> TL2 -> TL3 -> Q1 -> Q2 -> Q3 -> Race
  it('SPRINT-02-01: Formato Normal continua TL1 -> TL2 -> TL3 -> Q1 -> Q2 -> Q3 -> Race', () => {
    const pipeline = getRaceWeekendPipeline({ format: 'standard' })
    const ids = pipeline.map((s) => s.id)
    expect(ids).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])
  })

  // SPRINT-02-02: Formato Sprint canônico tem 7 slots: TL1 -> SQ1 -> Sprint Race -> Q1 -> Q2 -> Q3 -> Race
  it('SPRINT-02-02: Formato Sprint canônico tem 7 slots: TL1 -> SQ1 -> Sprint Race -> Q1 -> Q2 -> Q3 -> Race', () => {
    const pipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = pipeline.map((s) => s.id)
    expect(ids).toEqual(['tp1', 'sq1', 'sprint_race', 'q1', 'q2', 'q3', 'race'])
  })

  // SPRINT-02-03: TL3 NÃO existe em fim de semana Sprint
  it('SPRINT-02-03: TL3 NÃO existe em fim de semana Sprint', () => {
    const pipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = pipeline.map((s) => s.id)
    expect(ids).not.toContain('tp3')
  })

  // SPRINT-02-04: TL2 NÃO existe em fim de semana Sprint (canônico 7 slots)
  it('SPRINT-02-04: TL2 NÃO existe em fim de semana Sprint (canônico 7 slots)', () => {
    const pipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = pipeline.map((s) => s.id)
    expect(ids).not.toContain('tp2')
  })

  // SPRINT-02-05: Sprint Qualifying usa grid próprio / slot sequence correto
  it('SPRINT-02-05: Sprint Qualifying precede a Sprint Race e tem slots isolados', () => {
    expect(SPRINT_SLOT_TYPES).toContain('QUALI_SPRINT')
    expect(SPRINT_SLOT_TYPES).toContain('SPRINT')
    expect(SPRINT_SLOT_TYPES.indexOf('QUALI_SPRINT')).toBeLessThan(
      SPRINT_SLOT_TYPES.indexOf('SPRINT'),
    )
  })

  // SPRINT-02-06: GP Qualifying vem após a Sprint Race no fim de semana Sprint
  it('SPRINT-02-06: GP Qualifying vem após a Corrida Sprint', () => {
    const pipeline = getRaceWeekendPipeline({ format: 'sprint' })
    const ids = pipeline.map((s) => s.id)
    const sprintRaceIdx = ids.indexOf('sprint_race')
    const q1Idx = ids.indexOf('q1')
    expect(sprintRaceIdx).toBeGreaterThan(-1)
    expect(q1Idx).toBeGreaterThan(sprintRaceIdx)
  })

  // SPRINT-02-07: SPRINT_LAPS = Math.round(mainRaceLaps * 0.30)
  it('SPRINT-02-07: SPRINT_LAPS = Math.round(mainRaceLaps * 0.30), determinístico (ex: Silverstone 52 -> 16 voltas)', () => {
    const silverstoneLaps = canonicalRaceInitializationService.calculateSprintLaps(5.891, 100, 52)
    expect(silverstoneLaps).toBe(16) // 52 * 0.30 = 15.6 -> round = 16

    const monzaLaps = canonicalRaceInitializationService.calculateSprintLaps(5.793, 100, 53)
    expect(monzaLaps).toBe(16) // 53 * 0.30 = 15.9 -> round = 16

    const spaLaps = canonicalRaceInitializationService.calculateSprintLaps(7.004, 100, 44)
    expect(spaLaps).toBe(13) // 44 * 0.30 = 13.2 -> round = 13
  })

  // SPRINT-02-08 & SPRINT-02-09: Sem pit stop obrigatório na Sprint
  it('SPRINT-02-08 & SPRINT-02-09: Sem troca obrigatória e pode terminar sem pit', () => {
    // Verificamos que o serviço atribui mandatedStops: 0 e minimumDryCompounds: 1 para sprint
    const state = canonicalRaceInitializationService.initializeSprintRaceState({
      careerId: 'test_career',
      seasonNumber: 2026,
      round: 11, // Silverstone
      circuitName: 'Silverstone Circuit',
      circuitCountry: 'GBR',
      circuitLengthKm: 5.891,
      mainRaceLaps: 52,
      playerTeamId: 'mercedes',
      weather: 'dry',
    })

    expect(state.regulations.mandatedStops).toBe(0)
    expect(state.regulations.minimumDryCompounds).toBe(1)
    expect(state.totalLaps).toBe(16)
  })

  // SPRINT-02-10: Desbloqueio e gating visual de sessões Sprint
  it('SPRINT-02-10: Desbloqueio de sessões Sprint segue a sequência canônica', () => {
    // sq1 desbloqueia com apenas tp1 concluído (sem exigir tp2)
    const sq1State = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'sq1',
      completedSessions: ['tp1'],
    })
    expect(sq1State).toBe('active')

    const sprintLocked = resolveSessionVisualState({
      sessionId: 'sprint_race',
      activeSessionId: 'sq1',
      completedSessions: ['tp1'],
    })
    expect(sprintLocked).toBe('locked')

    const sprintAvailable = resolveSessionVisualState({
      sessionId: 'sprint_race',
      activeSessionId: 'sprint_race',
      completedSessions: ['tp1', 'sq1'],
    })
    expect(sprintAvailable).toBe('active')
  })

  // SPRINT-02-11: Silverstone round 11 tem hasSprint = true e reproduz sequência
  it('SPRINT-02-11: Silverstone round 11 possui Sprint e sua sequência é canônica', () => {
    const isSprint = hasSprintWeekend(11)
    expect(isSprint).toBe(true)

    const schedule = getCanonicalWeekendSchedule(11)
    expect(schedule).toEqual(['tp1', 'sq1', 'sprint_race', 'q1', 'q2', 'q3', 'race'])
  })
})
