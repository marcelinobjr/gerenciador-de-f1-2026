import { describe, it, expect, beforeEach } from 'vitest'
import {
  getRaceWeekendPipeline,
  isSessionUnlocked,
  resolveSessionVisualState,
  SPRINT_WEEKEND_SCHEDULE_CONFIG,
} from '@/services/weekendScheduleConfig'
import {
  getCanonicalWeekendSchedule,
  getNextRequiredWeekendSession,
  normalizeCompletedSessions,
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '@/services/weekendProgressionService'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'

describe('SPT-FMT: Qualificação Sprint em 3 fases (SQ1..SQ3) — FIX C', () => {
  const seasonId = 'season_spt_fmt_test'
  const round = 2 // China Sprint

  const all24Drivers = Array.from({ length: 24 }, (_, idx) => ({
    id: `drv_${idx + 1}`,
    name: `Piloto ${idx + 1}`,
    speed: 80,
    consistency: 80,
    defense: 75,
    teamId: `team_${Math.floor(idx / 2) + 1}`,
    teamName: `Equipe ${Math.floor(idx / 2) + 1}`,
    teamColor: '#E10600',
    carNumber: idx + 1,
  }))

  const tickContext = {
    seasonId,
    round,
    gpName: 'Grande Prêmio da China',
    circuitName: 'Circuito Internacional de Xangai',
    lengthKm: 5.451,
    tireAbrasiveness: 3,
    weather: 'seco' as const,
    teamChassisRating: 80,
    teamEngineSupplier: 'Audi',
    teamName: 'Apex Racing',
    teamColor: '#E10600',
    drivers: [
      { id: 'drv_1', name: 'Piloto 1', speed: 85, consistency: 85, defense: 80 },
      { id: 'drv_2', name: 'Piloto 2', speed: 82, consistency: 82, defense: 78 },
    ],
    rivalDrivers: all24Drivers.slice(2),
  }

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear()
    }
  })

  // SPT-FMT-01: TL1 complete → SQ1 available.
  it('SPT-FMT-01: TL1 complete → SQ1 available', () => {
    const completedBefore = normalizeCompletedSessions([])
    expect(isSessionUnlocked('sq1', completedBefore)).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'sq1',
        activeSessionId: 'sq1',
        completedSessions: completedBefore,
      }),
    ).toBe('locked')

    const completedAfter = normalizeCompletedSessions(['tp1'])
    expect(isSessionUnlocked('sq1', completedAfter)).toBe(true)
    expect(
      resolveSessionVisualState({
        sessionId: 'sq1',
        activeSessionId: 'sq1',
        completedSessions: completedAfter,
      }),
    ).toBe('active')
  })

  // SPT-FMT-02: SQ1 complete → SQ2 available.
  it('SPT-FMT-02: SQ1 complete → SQ2 available', () => {
    const completed = normalizeCompletedSessions(['tp1', 'sq1'])
    expect(isSessionUnlocked('sq2', completed)).toBe(true)
    expect(
      resolveSessionVisualState({
        sessionId: 'sq2',
        activeSessionId: 'sq2',
        completedSessions: completed,
      }),
    ).toBe('active')
  })

  // SPT-FMT-03: SQ1 complete → Sprint NOT available.
  it('SPT-FMT-03: SQ1 complete → Sprint NOT available', () => {
    const completed = normalizeCompletedSessions(['tp1', 'sq1'])
    expect(isSessionUnlocked('sprint_race', completed)).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'sprint_race',
        completedSessions: completed,
      }),
    ).toBe('locked')
  })

  // SPT-FMT-04: SQ2 consumes SQ1 result.
  it('SPT-FMT-04: SQ2 consumes SQ1 result', () => {
    // Executar SQ1
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })
    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    expect(sq1Result).not.toBeNull()
    expect(sq1Result?.advancingDriverIds).toHaveLength(18)

    // SQ2 consome os 18 que avançaram do SQ1
    const sq2Participants = all24Drivers.filter((d) => sq1Result!.advancingDriverIds.includes(d.id))
    expect(sq2Participants).toHaveLength(18)
    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })
    expect(sq2State.leaderboard).toHaveLength(18)
  })

  // SPT-FMT-05: SQ2 complete → SQ3 available.
  it('SPT-FMT-05: SQ2 complete → SQ3 available', () => {
    const completed = normalizeCompletedSessions(['tp1', 'sq1', 'sq2'])
    expect(isSessionUnlocked('sq3', completed)).toBe(true)
    expect(
      resolveSessionVisualState({
        sessionId: 'sq3',
        activeSessionId: 'sq3',
        completedSessions: completed,
      }),
    ).toBe('active')
  })

  // SPT-FMT-06: SQ2 complete → Sprint NOT available.
  it('SPT-FMT-06: SQ2 complete → Sprint NOT available', () => {
    const completed = normalizeCompletedSessions(['tp1', 'sq1', 'sq2'])
    expect(isSessionUnlocked('sprint_race', completed)).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'sprint_race',
        completedSessions: completed,
      }),
    ).toBe('locked')
  })

  // SPT-FMT-07: SQ3 consumes SQ2 result.
  it('SPT-FMT-07: SQ3 consumes SQ2 result', () => {
    // SQ1 e SQ2 concluídos
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: `${seasonId}_fmt07`,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(
      sq1State,
      { ...tickContext, seasonId: `${seasonId}_fmt07` },
      { persistState: true },
    )
    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(
      `${seasonId}_fmt07`,
      round,
      'sq1',
    )
    const sq2Participants = all24Drivers.filter((d) => sq1Result!.advancingDriverIds.includes(d.id))

    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId: `${seasonId}_fmt07`,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(
      sq2State,
      { ...tickContext, seasonId: `${seasonId}_fmt07` },
      { persistState: true },
    )
    const sq2Result = canonicalQualifyingPersistenceService.readStageResult(
      `${seasonId}_fmt07`,
      round,
      'sq2',
    )
    expect(sq2Result).not.toBeNull()
    expect(sq2Result?.advancingDriverIds).toHaveLength(10)

    // SQ3 consome os 10 de SQ2
    const sq3Participants = all24Drivers.filter((d) => sq2Result!.advancingDriverIds.includes(d.id))
    expect(sq3Participants).toHaveLength(10)
    const sq3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId: `${seasonId}_fmt07`,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: true,
    })
    expect(sq3State.leaderboard).toHaveLength(10)
  })

  // SPT-FMT-08: SQ3 complete → Sprint available.
  it('SPT-FMT-08: SQ3 complete → Sprint available', () => {
    const completed = normalizeCompletedSessions(['tp1', 'sq1', 'sq2', 'sq3'])
    expect(isSessionUnlocked('sprint_race', completed)).toBe(true)
    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'sprint_race',
        completedSessions: completed,
      }),
    ).toBe('active')
  })

  // SPT-FMT-09: Sprint grid comes from SQ3.
  it('SPT-FMT-09: Sprint grid comes from SQ3', () => {
    // Criar stage SQ3
    const sq3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId: `${seasonId}_fmt09`,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers.slice(0, 10),
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(
      sq3State,
      { ...tickContext, seasonId: `${seasonId}_fmt09` },
      { persistState: true },
    )

    const sq3Res = canonicalQualifyingPersistenceService.readStageResult(
      `${seasonId}_fmt09`,
      round,
      'sq3',
    )
    expect(sq3Res).not.toBeNull()
    expect(sq3Res?.stageId).toBe('sq3')

    // Lê SQ3 e monta grid da Sprint
    const sortedEntries = [...sq3Res!.entries].sort((a, b) => a.bestLapSec - b.bestLapSec)
    expect(sortedEntries[0].driverId).toBeTruthy()
    expect(sq3Res!.stageId).toBe('sq3')
  })

  // SPT-FMT-10: Sprint does NOT depend on main Q1-Q3.
  it('SPT-FMT-10: Sprint does NOT depend on main Q1-Q3', () => {
    // Qualificação principal não executada
    expect(
      canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
        `${seasonId}_fmt10`,
        round,
      ),
    ).toBeNull()

    // Sprint liberada após SQ3 mesmo com main quali inexistente
    const completed = normalizeCompletedSessions(['tp1', 'sq1', 'sq2', 'sq3'])
    expect(isSessionUnlocked('sprint_race', completed)).toBe(true)
  })

  // SPT-FMT-11: Sprint complete → Q1 available.
  it('SPT-FMT-11: Sprint complete → Q1 available', () => {
    const completed = normalizeCompletedSessions(['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race'])
    expect(isSessionUnlocked('q1', completed)).toBe(true)
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'q1',
        completedSessions: completed,
      }),
    ).toBe('active')
  })

  // SPT-FMT-12: Q1 NOT available before Sprint complete.
  it('SPT-FMT-12: Q1 NOT available before Sprint complete', () => {
    const beforeSprint = normalizeCompletedSessions(['tp1', 'sq1', 'sq2', 'sq3'])
    expect(isSessionUnlocked('q1', beforeSprint)).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'q1',
        completedSessions: beforeSprint,
      }),
    ).toBe('locked')
  })

  // SPT-FMT-13: Reload preserves SQ1/SQ2/SQ3 progression.
  it('SPT-FMT-13: Reload preserves SQ1/SQ2/SQ3 progression', () => {
    const testSeason = 'season_fmt13_reload'
    const testRound = 2

    // Grava progresso até SQ2
    writeStoredCompletedSessions(testSeason, testRound, ['tp1', 'sq1', 'sq2'])

    // Leitura simulando reload da página
    const reloaded = readStoredCompletedSessions(testSeason, testRound)
    expect(reloaded).toContain('tp1')
    expect(reloaded).toContain('sq1')
    expect(reloaded).toContain('sq2')

    // Próxima sessão obrigatória é SQ3
    const nextSess = getNextRequiredWeekendSession(testRound, reloaded)
    expect(nextSess).toBe('sq3')

    // SQ3 disponível, sprint bloqueada
    expect(isSessionUnlocked('sq3', reloaded)).toBe(true)
    expect(isSessionUnlocked('sprint_race', reloaded)).toBe(false)
  })

  // SPT-FMT-14: Stages are not duplicated.
  it('SPT-FMT-14: Stages are not duplicated', () => {
    const completedWithDupes = ['tp1', 'sq1', 'sq1', 'sq2', 'sq2', 'sq3']
    const normalized = normalizeCompletedSessions(completedWithDupes)

    const countSq1 = normalized.filter((s) => s === 'sq1').length
    const countSq2 = normalized.filter((s) => s === 'sq2').length
    const countSq3 = normalized.filter((s) => s === 'sq3').length

    expect(countSq1).toBe(1)
    expect(countSq2).toBe(1)
    expect(countSq3).toBe(1)
  })

  // SPT-FMT-15: Normal non-sprint weekend remains unchanged.
  it('SPT-FMT-15: Normal non-sprint weekend remains unchanged', () => {
    const normalPipeline = getRaceWeekendPipeline({ format: 'standard' })
    expect(normalPipeline).toHaveLength(7)
    expect(normalPipeline.map((p) => p.id)).toEqual(['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race'])

    // No normal, TL1 libera TL2, TL2 libera TL3, TL3 libera Q1
    expect(isSessionUnlocked('tp2', ['tp1'])).toBe(true)
    expect(isSessionUnlocked('tp3', ['tp1', 'tp2'])).toBe(true)
    expect(isSessionUnlocked('q1', ['tp1', 'tp2', 'tp3'])).toBe(true)
    expect(isSessionUnlocked('sprint_race', ['tp1', 'tp2', 'tp3'])).toBe(false)
  })
})
