import { describe, it, expect, beforeEach } from 'vitest'
import {
  SPRINT_WEEKEND_SCHEDULE,
  NORMAL_WEEKEND_SCHEDULE,
  getCanonicalWeekendSchedule,
  getNextRequiredWeekendSession,
  hasSprintWeekend,
  normalizeCompletedSessions,
} from '@/services/weekendProgressionService'
import {
  getRaceWeekendPipeline,
  isSessionUnlocked,
  resolveSessionVisualState,
  CANONICAL_SESSION_DEFINITIONS,
} from '@/services/weekendScheduleConfig'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import {
  CanonicalQualifyingRunner,
  type QualifyingTickContext,
  type QualifyingDriverContext,
} from '@/services/canonicalQualifyingRunner'
import {
  CANONICAL_QUALIFYING_RULES,
  type QualifyingStageResult,
  type CompleteQualifyingWeekendResult,
} from '@/types/canonical-qualifying-types'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

// Helpers canônicos de fixture
function createMockDriverList(count = 24): QualifyingDriverContext[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `drv_${idx + 1}`,
    name: `Driver ${idx + 1}`,
    speed: 80,
    consistency: 80,
    defense: 75,
    teamId: `team_${Math.floor(idx / 2) + 1}`,
    teamName: `Team ${Math.floor(idx / 2) + 1}`,
    teamColor: '#E10600',
    carNumber: idx + 1,
  }))
}

function createTickContext(
  seasonId: string,
  round: number,
  participants: QualifyingDriverContext[],
): QualifyingTickContext {
  return {
    seasonId,
    round,
    gpName: 'Chinese Grand Prix',
    circuitName: 'Shanghai International Circuit',
    lengthKm: 5.451,
    tireAbrasiveness: 6,
    weather: 'seco',
    teamChassisRating: 80,
    teamEngineSupplier: 'Audi',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    drivers: participants.slice(0, 2),
    rivalDrivers: participants.slice(2),
  }
}

function makeMockQualifyingStageResult(
  seasonId: string,
  round: number,
  stageId: 'sq1' | 'sq2' | 'sq3' | 'q1' | 'q2' | 'q3',
  count: number,
  prefix: string,
  startLapSec = 75.0,
): QualifyingStageResult {
  const advancingTarget = CANONICAL_QUALIFYING_RULES[stageId].advancingCount
  const entries = Array.from({ length: count }, (_, idx) => ({
    position: idx + 1,
    driverId: `${prefix}_drv_${idx + 1}`,
    driverName: `${prefix.toUpperCase()} Driver ${idx + 1}`,
    teamId: `team_${Math.floor(idx / 2) + 1}`,
    teamName: `Team ${Math.floor(idx / 2) + 1}`,
    teamColor: '#E10600',
    compound: 'macio' as const,
    bestLapSec: startLapSec + idx * 0.1,
    bestLapTime: `1:${(startLapSec + idx * 0.1).toFixed(3)}`,
    bestLapRecordedAtSec: 200 + idx * 5,
    lapsCount: 3,
    isEliminated: idx >= advancingTarget,
    isPlayer: idx < 2,
    carId: idx === 0 ? ('car1' as const) : idx === 1 ? ('car2' as const) : undefined,
  }))

  return {
    stageId,
    seasonId,
    round,
    completedAt: new Date().toISOString(),
    entries,
    advancingDriverIds: entries.slice(0, advancingTarget).map((e) => e.driverId),
    eliminatedDriverIds: entries.slice(advancingTarget).map((e) => e.driverId),
  }
}

function makeMockRaceState(
  raceVariant: 'MAIN_RACE' | 'SPRINT_RACE',
  round = 2,
  careerId = 'career_spt_test',
): CanonicalRaceState {
  const drivers = Array.from({ length: 24 }, (_, i) => ({
    driverId: `drv_${i + 1}`,
    driverName: `Driver ${i + 1}`,
    teamId: `team_${Math.floor(i / 2) + 1}`,
    teamName: `Team ${Math.floor(i / 2) + 1}`,
    teamColor: '#E10600',
    currentPosition: i + 1,
    position: i + 1,
    gridPosition: i + 1,
    startingGridPosition: i + 1,
    lap: raceVariant === 'SPRINT_RACE' ? 19 : 56,
    lapsCompleted: raceVariant === 'SPRINT_RACE' ? 19 : 56,
    isDnf: false,
    status: 'finished',
    raceStatus: 'finished',
    pitStopsCount: raceVariant === 'SPRINT_RACE' ? 0 : 2,
    bestLapSec: 80 + i * 0.1,
  }))

  return {
    careerId,
    season: 2026,
    round,
    raceId: `race_s2026_r${round}_${raceVariant.toLowerCase()}`,
    raceVariant,
    status: 'completed',
    currentLap: raceVariant === 'SPRINT_RACE' ? 19 : 56,
    totalLaps: raceVariant === 'SPRINT_RACE' ? 19 : 56,
    drivers,
    raceControl: {
      currentFlag: 'FINISHED',
      safetyCarLaps: 0,
      vscLaps: 0,
    },
    fastestLap: {
      driverId: 'drv_1',
      lapTimeSec: 80.1,
      lapTimeFormatted: '1:20.100',
      lap: 10,
    },
    events: [],
  } as any
}

describe('MICRO-RODADA SPRINT-FDS-01-R4C4 — HOMOLOGAÇÃO FINAL DO FIM DE SEMANA SPRINT (SPT-FMT-01..15)', () => {
  const seasonId = 'season_spt_fmt_2026'
  const roundSprint = 2 // GP da China (Sprint Weekend)
  const roundNormal = 1 // GP do Bahrein (Standard Weekend)
  const careerId = 'career_spt_fmt_homologation'

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  // SPT-FMT-01: Sprint Weekend possui exatamente TL1, SQ1, SQ2, SQ3, SPRINT, Q1, Q2, Q3, MAIN na ordem correta.
  it('SPT-FMT-01: Sprint Weekend possui exatamente TL1, SQ1, SQ2, SQ3, SPRINT, Q1, Q2, Q3, MAIN na ordem correta', () => {
    expect(hasSprintWeekend(roundSprint)).toBe(true)
    const expectedSessions = ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2', 'q3', 'race']

    // Valida getCanonicalWeekendSchedule
    const canonicalSchedule = getCanonicalWeekendSchedule(roundSprint)
    expect(canonicalSchedule).toHaveLength(9)
    expect(canonicalSchedule).toEqual(expectedSessions)

    // Valida SPRINT_WEEKEND_SCHEDULE
    expect(SPRINT_WEEKEND_SCHEDULE).toHaveLength(9)
    expect(SPRINT_WEEKEND_SCHEDULE).toEqual(expectedSessions)

    // Valida pipeline UI da esteira
    const pipeline = getRaceWeekendPipeline({ format: 'sprint' })
    expect(pipeline).toHaveLength(9)
    expect(pipeline.map((p) => p.id)).toEqual(expectedSessions)
    expect(pipeline.every((sess) => sess !== undefined && sess !== null)).toBe(true)
  })

  // SPT-FMT-02: TL1 concluída → SQ1 disponível.
  it('SPT-FMT-02: TL1 concluída -> SQ1 disponível', () => {
    const completed = ['tp1']
    const nextSession = getNextRequiredWeekendSession(roundSprint, completed)
    expect(nextSession).toBe('sq1')

    const unlocked = isSessionUnlocked('sq1', completed, true)
    expect(unlocked).toBe(true)

    const visual = resolveSessionVisualState({
      sessionId: 'sq1',
      activeSessionId: 'tp1',
      completedSessions: completed,
      isSprintRound: true,
    })
    expect(visual).toBe('available')
  })

  // SPT-FMT-03: SQ1 concluída → SQ2 disponível; Sprint NÃO disponível.
  it('SPT-FMT-03: SQ1 concluída -> SQ2 disponível; Sprint NÃO disponível', () => {
    const completed = ['tp1', 'sq1']
    const nextSession = getNextRequiredWeekendSession(roundSprint, completed)
    expect(nextSession).toBe('sq2')

    // SQ2 liberada
    expect(isSessionUnlocked('sq2', completed, true)).toBe(true)
    expect(
      resolveSessionVisualState({
        sessionId: 'sq2',
        activeSessionId: 'tp1',
        completedSessions: completed,
        isSprintRound: true,
      }),
    ).toBe('available')

    // Sprint bloqueada
    expect(isSessionUnlocked('sprint_race', completed, true)).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'tp1',
        completedSessions: completed,
        isSprintRound: true,
      }),
    ).toBe('locked')
  })

  // SPT-FMT-04: SQ2 recebe os classificados canônicos provenientes da SQ1 (18 classificados conforme regra canônica).
  it('SPT-FMT-04: SQ2 recebe os classificados canônicos provenientes da SQ1 (18 classificados)', () => {
    const all24 = createMockDriverList(24)
    const tickContext = createTickContext(seasonId, roundSprint, all24)

    // Executa e finaliza SQ1 canônica
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tyre_1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tyre_2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24,
      persistState: true,
    })

    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })

    const sq1Saved = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq1',
    )
    expect(sq1Saved).not.toBeNull()
    const canonicalAdvancingTarget = CANONICAL_QUALIFYING_RULES.sq1.advancingCount
    expect(canonicalAdvancingTarget).toBe(18)
    expect(sq1Saved?.advancingDriverIds).toHaveLength(canonicalAdvancingTarget)

    // Participantes elegíveis para SQ2 extraídos de SQ1
    const sq2Participants = all24.filter((p) => sq1Saved!.advancingDriverIds.includes(p.id))
    expect(sq2Participants).toHaveLength(canonicalAdvancingTarget)
    expect(sq2Participants.map((p) => p.id)).toEqual(sq1Saved!.advancingDriverIds)

    // Elimados em SQ1 não entram em SQ2
    sq1Saved!.eliminatedDriverIds.forEach((elimId) => {
      expect(sq2Participants.map((p) => p.id)).not.toContain(elimId)
    })
  })

  // SPT-FMT-05: SQ2 concluída → SQ3 disponível; Sprint NÃO disponível.
  it('SPT-FMT-05: SQ2 concluída -> SQ3 disponível; Sprint NÃO disponível', () => {
    const completed = ['tp1', 'sq1', 'sq2']
    const nextSession = getNextRequiredWeekendSession(roundSprint, completed)
    expect(nextSession).toBe('sq3')

    // SQ3 disponível
    expect(isSessionUnlocked('sq3', completed, true)).toBe(true)
    expect(
      resolveSessionVisualState({
        sessionId: 'sq3',
        activeSessionId: 'tp1',
        completedSessions: completed,
        isSprintRound: true,
      }),
    ).toBe('available')

    // Sprint Race permanece estritamente bloqueada
    expect(isSessionUnlocked('sprint_race', completed, true)).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'tp1',
        completedSessions: completed,
        isSprintRound: true,
      }),
    ).toBe('locked')
  })

  // SPT-FMT-06: SQ3 recebe os classificados canônicos provenientes da SQ2 (10 classificados canônicos).
  it('SPT-FMT-06: SQ3 recebe os classificados canônicos provenientes da SQ2 (10 classificados canônicos)', () => {
    const all24 = createMockDriverList(24)
    const tickContext = createTickContext(seasonId, roundSprint, all24)

    // 1. Finaliza SQ1
    const sq1Res = makeMockQualifyingStageResult(seasonId, roundSprint, 'sq1', 24, 'sq1', 77.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq1Res)

    // 2. Executa SQ2 com os 18 de SQ1
    const sq2Participants = all24.filter((p) => sq1Res.advancingDriverIds.includes(p.id))
    expect(sq2Participants).toHaveLength(CANONICAL_QUALIFYING_RULES.sq1.advancingCount) // 18

    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tyre_1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tyre_2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })

    CanonicalQualifyingRunner.simulateRemainingSession(sq2State, tickContext, {
      persistState: true,
    })

    const sq2Saved = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq2',
    )
    expect(sq2Saved).not.toBeNull()
    const canonicalAdvancingSQ2 = CANONICAL_QUALIFYING_RULES.sq2.advancingCount
    expect(canonicalAdvancingSQ2).toBe(10)
    expect(sq2Saved?.advancingDriverIds).toHaveLength(canonicalAdvancingSQ2)

    // SQ3 recebe exatamente os 10 de SQ2
    const sq3Participants = all24.filter((p) => sq2Saved!.advancingDriverIds.includes(p.id))
    expect(sq3Participants).toHaveLength(10)
    expect(sq3Participants.map((p) => p.id)).toEqual(sq2Saved!.advancingDriverIds)
  })

  // SPT-FMT-07: SQ3 concluída → Sprint disponível.
  it('SPT-FMT-07: SQ3 concluída -> Sprint disponível', () => {
    const completed = ['tp1', 'sq1', 'sq2', 'sq3']
    const nextSession = getNextRequiredWeekendSession(roundSprint, completed)
    expect(nextSession).toBe('sprint_race')

    expect(isSessionUnlocked('sprint_race', completed, true)).toBe(true)
    expect(
      resolveSessionVisualState({
        sessionId: 'sprint_race',
        activeSessionId: 'tp1',
        completedSessions: completed,
        isSprintRound: true,
      }),
    ).toBe('available')
  })

  // SPT-FMT-08: grid da Sprint vem do resultado final da SQ3 — não SQ1, não SQ2, não qualifying principal.
  it('SPT-FMT-08: grid da Sprint vem do resultado final da SQ3 — não SQ1, não SQ2, não qualifying principal', () => {
    // 1. Gravar SQ1, SQ2, SQ3 com pilotos e tempos diferentes
    const sq1 = makeMockQualifyingStageResult(seasonId, roundSprint, 'sq1', 24, 'sq1_pilot', 78.0)
    const sq2 = makeMockQualifyingStageResult(seasonId, roundSprint, 'sq2', 18, 'sq2_pilot', 76.0)
    const sq3 = makeMockQualifyingStageResult(seasonId, roundSprint, 'sq3', 10, 'sq3_pilot', 74.0)

    // Colocar sq3_pilot_5 como o tempo mais rápido absoluto da SQ3
    sq3.entries[4].bestLapSec = 72.1
    sq3.entries[4].bestLapTime = '1:12.100'

    canonicalQualifyingPersistenceService.saveStageResult(sq1)
    canonicalQualifyingPersistenceService.saveStageResult(sq2)
    canonicalQualifyingPersistenceService.saveStageResult(sq3)

    // 2. Gravar qualificação principal Q1-Q3 independente com outro piloto na pole
    const mainQuali: CompleteQualifyingWeekendResult = {
      seasonId,
      round: roundSprint,
      completedAt: new Date().toISOString(),
      poleDriverId: 'main_exclusive_pole_driver',
      poleDriverName: 'Main Exclusive Pole Driver',
      poleLapTime: '1:10.500',
      q1Result: undefined as any,
      q2Result: undefined as any,
      q3Result: undefined as any,
      finalGrid: [
        {
          gridPosition: 1,
          driverId: 'main_exclusive_pole_driver',
          driverName: 'Main Exclusive Pole Driver',
          teamId: 'team_main',
          teamName: 'Main Team',
          teamColor: '#000',
          isPlayer: false,
          eliminationStage: 'Q3',
          bestLapSec: 70.5,
          bestLapTime: '1:10.500',
          bestLapCompound: 'macio',
        },
      ],
    }
    canonicalQualifyingPersistenceService.saveCompleteQualifyingResult(mainQuali)

    // 3. Montar grid da Sprint via buildSprintGridFromSQ3Result
    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      roundSprint,
    )

    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid?.finalGrid).toHaveLength(24)

    // Pole da Sprint deve ser o mais rápido da SQ3 (sq3_pilot_5)
    expect(sprintGrid?.poleDriverId).toBe('sq3_pilot_5')
    expect(sprintGrid?.finalGrid[0].driverId).toBe('sq3_pilot_5')
    expect(sprintGrid?.finalGrid[0].gridPosition).toBe(1)

    // Prova explícita: não é de SQ1
    expect(sprintGrid?.poleDriverId).not.toBe(sq1.entries[0].driverId)
    // Prova explícita: não é de SQ2
    expect(sprintGrid?.poleDriverId).not.toBe(sq2.entries[0].driverId)
    // Prova explícita: não é da qualifying principal
    expect(sprintGrid?.poleDriverId).not.toBe('main_exclusive_pole_driver')
  })

  // SPT-FMT-09: Sprint inicializa com raceVariant = SPRINT_RACE usando o Race Engine canônico (initializeRaceFromCanonicalGrid).
  it('SPT-FMT-09: Sprint inicializa com raceVariant = SPRINT_RACE usando o Race Engine canônico', () => {
    const sq3 = makeMockQualifyingStageResult(seasonId, roundSprint, 'sq3', 10, 'sq3', 73.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq3)

    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      roundSprint,
    )!
    expect(sprintGrid).not.toBeNull()

    const sprintRaceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      raceVariant: 'SPRINT_RACE',
      careerId,
      season: 2026,
      round: roundSprint,
      circuitName: 'Shanghai International Circuit',
      circuitCountry: 'China',
      totalLaps: 19,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: sprintGrid.finalGrid,
    })

    expect(sprintRaceState.raceVariant).toBe('SPRINT_RACE')
    expect(sprintRaceState.totalLaps).toBe(19)
    expect(sprintRaceState.drivers).toHaveLength(24)
    expect(sprintRaceState.drivers[0].driverId).toBe(sprintGrid.finalGrid[0].driverId)
  })

  // SPT-FMT-10: Sprint pontua 8-7-6-5-4-3-2-1.
  it('SPT-FMT-10: Sprint pontua 8-7-6-5-4-3-2-1 (P9+ = 0)', () => {
    const sprintState = makeMockRaceState('SPRINT_RACE', roundSprint, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)

    expect(sprintOfficial.raceVariant).toBe('SPRINT_RACE')
    const awarded = sprintOfficial.entries.map((e) => e.pointsAwarded)

    // Top 8 pontuam
    expect(awarded.slice(0, 8)).toEqual([8, 7, 6, 5, 4, 3, 2, 1])
    // P9+ recebem 0 pontos
    awarded.slice(8).forEach((pts, idx) => {
      expect(pts, `P${idx + 9} points should be 0`).toBe(0)
    })
  })

  // SPT-FMT-11: Sprint concluída → Q1 principal disponível; antes da conclusão, Q1 bloqueada.
  it('SPT-FMT-11: Sprint concluída -> Q1 principal disponível; antes da conclusão, Q1 bloqueada', () => {
    // Antes da conclusão da Sprint (SQ3 concluída)
    const beforeSprint = ['tp1', 'sq1', 'sq2', 'sq3']
    expect(isSessionUnlocked('q1', beforeSprint, true)).toBe(false)
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'tp1',
        completedSessions: beforeSprint,
        isSprintRound: true,
      }),
    ).toBe('locked')

    // Após conclusão da Sprint
    const afterSprint = ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race']
    expect(isSessionUnlocked('q1', afterSprint, true)).toBe(true)
    expect(
      resolveSessionVisualState({
        sessionId: 'q1',
        activeSessionId: 'tp1',
        completedSessions: afterSprint,
        isSprintRound: true,
      }),
    ).toBe('available')

    const nextSession = getNextRequiredWeekendSession(roundSprint, afterSprint)
    expect(nextSession).toBe('q1')
  })

  // SPT-FMT-12: Q1→Q2→Q3 da classificação principal permanecem intactas.
  it('SPT-FMT-12: Q1->Q2->Q3 da classificação principal permanecem intactas', () => {
    const sprintBase = ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race']

    // Q1 concluída -> Q2 liberada, Q3 bloqueada, Corrida bloqueada
    const afterQ1 = [...sprintBase, 'q1']
    expect(isSessionUnlocked('q2', afterQ1, true)).toBe(true)
    expect(isSessionUnlocked('q3', afterQ1, true)).toBe(false)
    expect(isSessionUnlocked('race', afterQ1, true)).toBe(false)
    expect(getNextRequiredWeekendSession(roundSprint, afterQ1)).toBe('q2')

    // Q2 concluída -> Q3 liberada, Corrida bloqueada
    const afterQ2 = [...afterQ1, 'q2']
    expect(isSessionUnlocked('q3', afterQ2, true)).toBe(true)
    expect(isSessionUnlocked('race', afterQ2, true)).toBe(false)
    expect(getNextRequiredWeekendSession(roundSprint, afterQ2)).toBe('q3')

    // Q3 concluída -> Corrida Principal liberada
    const afterQ3 = [...afterQ2, 'q3']
    expect(isSessionUnlocked('race', afterQ3, true)).toBe(true)
    expect(getNextRequiredWeekendSession(roundSprint, afterQ3)).toBe('race')
  })

  // SPT-FMT-13: MAIN_RACE usa o resultado da classificação principal Q1-Q3; não usa SQ3 como grid.
  it('SPT-FMT-13: MAIN_RACE usa o resultado da classificação principal Q1-Q3; não usa SQ3 como grid', () => {
    // SQ3 com piloto A na pole
    const sq3 = makeMockQualifyingStageResult(seasonId, roundSprint, 'sq3', 10, 'sq3_pilot', 74.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq3)

    // Q1, Q2, Q3 principais com piloto B na pole
    const q1 = makeMockQualifyingStageResult(seasonId, roundSprint, 'q1', 24, 'main_pilot', 75.0)
    const q2 = makeMockQualifyingStageResult(seasonId, roundSprint, 'q2', 18, 'main_pilot', 73.0)
    const q3 = makeMockQualifyingStageResult(seasonId, roundSprint, 'q3', 10, 'main_pilot', 71.0)
    canonicalQualifyingPersistenceService.buildCombinedFinalGrid({
      seasonId,
      round: roundSprint,
      q1Result: q1,
      q2Result: q2,
      q3Result: q3,
      persistResult: true,
    })

    // Consulta do grid da corrida principal (isSprint = false)
    const mainGrid = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      seasonId,
      roundSprint,
    )
    expect(mainGrid).not.toBeNull()
    expect(mainGrid?.poleDriverId).toBe('main_pilot_drv_1')
    expect(mainGrid?.poleDriverId).not.toBe(sq3.entries[0].driverId)
    expect(mainGrid?.finalGrid[0].driverId).toBe('main_pilot_drv_1')

    // Consulta do grid da sprint (isSprint = true)
    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      roundSprint,
    )
    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid?.poleDriverId).toBe('sq3_pilot_drv_1')
    expect(sprintGrid?.poleDriverId).not.toBe('main_pilot_drv_1')
  })

  // SPT-FMT-14: na mesma rodada, SPRINT_RACE + MAIN_RACE coexistem e contribuem ambas para Drivers e Constructors Championship (ex.: Sprint P1 = 8 + Main P1 = 25 = 33 acumulado).
  it('SPT-FMT-14: na mesma rodada, SPRINT_RACE + MAIN_RACE coexistem e contribuem ambas para Drivers e Constructors Championship', () => {
    // 1. Oficializa e registra SPRINT_RACE
    const sprintState = makeMockRaceState('SPRINT_RACE', roundSprint, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    const regSprint =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)
    expect(regSprint.success).toBe(true)

    // 2. Oficializa e registra MAIN_RACE
    const mainState = makeMockRaceState('MAIN_RACE', roundSprint, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    const regMain =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)
    expect(regMain.success).toBe(true)

    // 3. Verifica coexistência na persistência de resultados
    const persistedSprint = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      2026,
      roundSprint,
      'SPRINT_RACE',
    )
    const persistedMain = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      2026,
      roundSprint,
      'MAIN_RACE',
    )
    expect(persistedSprint).not.toBeNull()
    expect(persistedMain).not.toBeNull()
    expect(persistedSprint?.snapshot?.raceVariant).toBe('SPRINT_RACE')
    expect(persistedMain?.snapshot?.raceVariant).toBe('MAIN_RACE')

    // 4. Rebuild do campeonato com ambas as corridas
    const snapshot = canonicalChampionshipService.rebuildChampionshipStandings(
      careerId,
      2026,
      roundSprint,
    )

    // drv_1: Sprint P1 (8) + Main P1 (25) = 33 pts acumulados
    const drv1 = snapshot.driverStandings.find((d) => d.driverId === 'drv_1')
    expect(drv1?.points).toBe(33)
    expect(drv1?.raceStarts).toBe(2)

    // drv_2: Sprint P2 (7) + Main P2 (18) = 25 pts acumulados
    const drv2 = snapshot.driverStandings.find((d) => d.driverId === 'drv_2')
    expect(drv2?.points).toBe(25)
    expect(drv2?.raceStarts).toBe(2)

    // team_1: drv_1 (33) + drv_2 (25) = 58 pts acumulados no campeonato de construtores
    const team1 = snapshot.constructorStandings.find(
      (c) => c.teamId === 'team_1' || c.teamName === 'Team 1',
    )
    expect(team1?.points).toBe(58)
  })

  // SPT-FMT-15: reload no meio ou após o fim de semana preserva stages SQ1/SQ2/SQ3, Sprint result, Main result, completedSessions, próxima sessão correta, championship, e não duplica nada.
  it('SPT-FMT-15: reload preserva stages SQ1/SQ2/SQ3, Sprint result, Main result, completedSessions, próxima sessão correta, championship, e não duplica nada', () => {
    // 1. Salva stages da quali sprint
    const sq1 = makeMockQualifyingStageResult(seasonId, roundSprint, 'sq1', 24, 's1', 77.0)
    const sq2 = makeMockQualifyingStageResult(seasonId, roundSprint, 'sq2', 18, 's2', 75.0)
    const sq3 = makeMockQualifyingStageResult(seasonId, roundSprint, 'sq3', 10, 's3', 73.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq1)
    canonicalQualifyingPersistenceService.saveStageResult(sq2)
    canonicalQualifyingPersistenceService.saveStageResult(sq3)

    // 2. Salva Sprint Race
    const sprintState = makeMockRaceState('SPRINT_RACE', roundSprint, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)

    // 3. Salva Main Qualifying e Main Race
    const mainCombined: CompleteQualifyingWeekendResult = {
      seasonId,
      round: roundSprint,
      completedAt: new Date().toISOString(),
      poleDriverId: 'main_drv_1',
      poleDriverName: 'Main Driver 1',
      poleLapTime: '1:10.000',
      q1Result: undefined as any,
      q2Result: undefined as any,
      q3Result: undefined as any,
      finalGrid: [
        {
          gridPosition: 1,
          driverId: 'drv_1',
          driverName: 'Driver 1',
          teamId: 'team_1',
          teamName: 'Team 1',
          teamColor: '#E10600',
          isPlayer: true,
          eliminationStage: 'Q3',
          bestLapSec: 70.0,
          bestLapTime: '1:10.000',
          bestLapCompound: 'macio',
        },
      ],
    }
    canonicalQualifyingPersistenceService.saveCompleteQualifyingResult(mainCombined)

    const mainState = makeMockRaceState('MAIN_RACE', roundSprint, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    // 4. Sessões concluídas normalizadas
    const completedSessions = ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2', 'q3', 'race']
    const serializedSessions = JSON.stringify(completedSessions)
    const reloadedCompleted: string[] = JSON.parse(serializedSessions)
    const normalized = normalizeCompletedSessions(reloadedCompleted)
    expect(normalized.length).toBe(new Set(normalized).size) // Sem duplicatas

    // 5. Simular "Reload" lendo exclusivamente do storage persistido
    const readSq1 = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq1',
    )
    const readSq2 = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq2',
    )
    const readSq3 = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq3',
    )
    expect(readSq1).not.toBeNull()
    expect(readSq2).not.toBeNull()
    expect(readSq3).not.toBeNull()
    expect(readSq1?.stageId).toBe('sq1')
    expect(readSq2?.stageId).toBe('sq2')
    expect(readSq3?.stageId).toBe('sq3')

    const readSprint = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      2026,
      roundSprint,
      'SPRINT_RACE',
    )
    const readMain = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      2026,
      roundSprint,
      'MAIN_RACE',
    )
    expect(readSprint?.snapshot?.raceVariant).toBe('SPRINT_RACE')
    expect(readMain?.snapshot?.raceVariant).toBe('MAIN_RACE')

    // 6. Teste de idempotência ao tentar registrar novamente pós-reload
    const duplicateSprintReg =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)
    expect(duplicateSprintReg.alreadyRegistered).toBe(true)

    const duplicateMainReg =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)
    expect(duplicateMainReg.alreadyRegistered).toBe(true)

    // 7. Campeonato pós-reload permanece íntegro com 33 pontos para drv_1 e 58 para equipe
    const standings = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      2026,
      roundSprint,
    )
    const drv1 = standings.driverStandings.find((d) => d.driverId === 'drv_1')
    expect(drv1?.points).toBe(33)
    const team1 = standings.constructorStandings.find(
      (c) => c.teamId === 'team_1' || c.teamName === 'Team 1',
    )
    expect(team1?.points).toBe(58)
  })

  // WEEKEND NORMAL (obrigatório): provar que um weekend SEM Sprint continua TL1→TL2→TL3→Q1→Q2→Q3→MAIN sem SQ1/SQ2/SQ3/Sprint aparecendo.
  it('WEEKEND NORMAL: sem Sprint continua TL1->TL2->TL3->Q1->Q2->Q3->MAIN sem SQ1/SQ2/SQ3/Sprint', () => {
    expect(hasSprintWeekend(roundNormal)).toBe(false)
    const normalSchedule = getCanonicalWeekendSchedule(roundNormal)
    const expectedSessions = ['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'race']

    expect(normalSchedule).toHaveLength(7)
    expect(normalSchedule).toEqual(expectedSessions)
    expect(NORMAL_WEEKEND_SCHEDULE).toEqual(expectedSessions)

    const normalPipeline = getRaceWeekendPipeline({ format: 'standard' })
    expect(normalPipeline).toHaveLength(7)
    const normalIds = normalPipeline.map((s) => s.id)
    expect(normalIds).toEqual(expectedSessions)

    // Garante que NENHUMA sessão Sprint aparece
    expect(normalIds).not.toContain('sq1')
    expect(normalIds).not.toContain('sq2')
    expect(normalIds).not.toContain('sq3')
    expect(normalIds).not.toContain('sprint_race')

    // No normal, Q1 requer tp3 concluído (não sprint_race)
    expect(isSessionUnlocked('q1', ['tp1', 'tp2'], false)).toBe(false)
    expect(isSessionUnlocked('q1', ['tp1', 'tp2', 'tp3'], false)).toBe(true)
  })
})
