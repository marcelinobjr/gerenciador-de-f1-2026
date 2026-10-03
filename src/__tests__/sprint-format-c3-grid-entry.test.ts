import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { isSessionUnlocked, resolveSessionVisualState } from '@/services/weekendScheduleConfig'
import {
  getNextRequiredWeekendSession,
  normalizeCompletedSessions,
} from '@/services/weekendProgressionService'
import type {
  QualifyingStageResult,
  CompleteQualifyingWeekendResult,
} from '@/types/canonical-qualifying-types'

function makeMockQualifyingStageResult(
  seasonId: string,
  round: number,
  stageId: 'sq1' | 'sq2' | 'sq3' | 'q1' | 'q2' | 'q3',
  count: number,
  prefix: string,
  startLapSec = 75.0,
): QualifyingStageResult {
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
    isEliminated: false,
    isPlayer: idx < 2,
    carId: idx === 0 ? ('car1' as const) : idx === 1 ? ('car2' as const) : undefined,
  }))

  return {
    stageId,
    seasonId,
    round,
    completedAt: new Date().toISOString(),
    entries,
    advancingDriverIds: entries.slice(0, Math.min(count, 10)).map((e) => e.driverId),
    eliminatedDriverIds: entries.slice(10).map((e) => e.driverId),
  }
}

describe('SPRINT-FDS-01-R4C3: Sprint Grid Entry & Progression (C3-01..C3-14)', () => {
  const seasonId = 'season_2026_c3'
  const round = 2 // GP da China (Sprint Weekend)

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  // C3-01: com SQ3 concluída, readStageResult(..., 'sq3') retorna o resultado persistido usado para montar o grid da Sprint.
  it('C3-01: com SQ3 concluída, readStageResult(..., "sq3") retorna o resultado persistido usado para montar o grid da Sprint', () => {
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 74.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    const readBack = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq3')
    expect(readBack).not.toBeNull()
    expect(readBack?.stageId).toBe('sq3')
    expect(readBack?.entries).toHaveLength(10)
    expect(readBack?.entries[0].driverId).toBe('sq3_drv_1')

    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )
    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid?.finalGrid[0].driverId).toBe('sq3_drv_1')
    expect(sprintGrid?.poleDriverId).toBe('sq3_drv_1')
  })

  // C3-02: grid da Sprint preserva a ordem final da SQ3.
  it('C3-02: grid da Sprint preserva a ordem final da SQ3', () => {
    // Definimos SQ3 deliberadamente invertida ou com tempos específicos
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 73.0)
    // Alterar ordem de tempo do piloto 3 para ser mais rápido que todos
    sq3Result.entries[2].bestLapSec = 71.5
    sq3Result.entries[2].bestLapTime = '1:11.500'
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )
    expect(sprintGrid).not.toBeNull()
    // O piloto 3 deve ser o P1 (pole) pois tem o menor bestLapSec de SQ3
    expect(sprintGrid?.finalGrid[0].driverId).toBe('sq3_drv_3')
    expect(sprintGrid?.finalGrid[0].gridPosition).toBe(1)
    expect(sprintGrid?.poleDriverId).toBe('sq3_drv_3')
  })

  // C3-03: grid da Sprint NÃO usa SQ1 como topo de grid nem ignora SQ3.
  it('C3-03: grid da Sprint NÃO usa SQ1', () => {
    const sq1Result = makeMockQualifyingStageResult(seasonId, round, 'sq1', 24, 'sq1', 76.0)
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 73.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq1Result)
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )
    expect(sprintGrid).not.toBeNull()
    // P1 do Sprint deve ser de SQ3, não de SQ1
    expect(sprintGrid?.finalGrid[0].driverId).toBe('sq3_drv_1')
    expect(sprintGrid?.finalGrid[0].driverId).not.toBe('sq1_drv_1')
  })

  // C3-04: grid da Sprint NÃO usa SQ2 como topo de grid nem ignora SQ3.
  it('C3-04: grid da Sprint NÃO usa SQ2', () => {
    const sq2Result = makeMockQualifyingStageResult(seasonId, round, 'sq2', 18, 'sq2', 75.0)
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 73.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq2Result)
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )
    expect(sprintGrid).not.toBeNull()
    // P1 do Sprint deve ser de SQ3, não de SQ2
    expect(sprintGrid?.finalGrid[0].driverId).toBe('sq3_drv_1')
    expect(sprintGrid?.finalGrid[0].driverId).not.toBe('sq2_drv_1')
  })

  // C3-05: grid da Sprint NÃO depende de readCompleteQualifyingResult da quali principal.
  it('C3-05: grid da Sprint NÃO depende de readCompleteQualifyingResult da quali principal', () => {
    // Simular que NÃO existe complete qualifying result no localStorage
    const mainQualiKey = canonicalQualifyingPersistenceService.getFinalGridKey(seasonId, round)
    localStorage.removeItem(mainQualiKey)
    expect(
      canonicalQualifyingPersistenceService.readCompleteQualifyingResult(seasonId, round),
    ).toBeNull()

    // Mas SQ3 existe
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 73.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )
    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid?.poleDriverId).toBe('sq3_drv_1')

    // Mesmo se salvar uma quali principal com outro piloto na pole, Sprint NÃO é afetada
    const mockMainComplete: CompleteQualifyingWeekendResult = {
      seasonId,
      round,
      completedAt: new Date().toISOString(),
      poleDriverId: 'main_q3_pole_driver',
      poleDriverName: 'Main Pole Driver',
      poleLapTime: '1:10.000',
      q1Result: undefined as any,
      q2Result: undefined as any,
      q3Result: undefined as any,
      finalGrid: [
        {
          gridPosition: 1,
          driverId: 'main_q3_pole_driver',
          driverName: 'Main Pole Driver',
          teamId: 'team_main',
          teamName: 'Main Team',
          teamColor: '#000000',
          isPlayer: false,
          eliminationStage: 'Q3',
          bestLapSec: 70.0,
          bestLapTime: '1:10.000',
          bestLapCompound: 'macio',
        },
      ],
    }
    canonicalQualifyingPersistenceService.saveCompleteQualifyingResult(mockMainComplete)

    const sprintGridAfterMain = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )
    expect(sprintGridAfterMain?.poleDriverId).toBe('sq3_drv_1')
    expect(sprintGridAfterMain?.poleDriverId).not.toBe('main_q3_pole_driver')
  })

  // C3-06: initial load da Sprint usa SQ3.
  it('C3-06: initial load da Sprint usa SQ3 via helper canônico compartilhado', () => {
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 73.5)
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    // Simulando initial load de WeekendV2Page:
    // resolveRaceOrSprintGrid(season.id, currentRound, isSprintTarget) onde isSprintTarget = true
    const isSprintTarget = true
    const initialGrid = isSprintTarget
      ? canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(seasonId, round)
      : canonicalQualifyingPersistenceService.readCompleteQualifyingResult(seasonId, round)

    expect(initialGrid).not.toBeNull()
    expect(initialGrid?.poleDriverId).toBe('sq3_drv_1')
  })

  // C3-07: seleção manual da Sprint usa SQ3.
  it('C3-07: seleção manual da Sprint usa SQ3 via helper canônico compartilhado', () => {
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 73.5)
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    // Simulando handleSelectSessionFromSchedule onde sess === 'sprint_race' (isSprintTarget = true):
    const sess = 'sprint_race'
    const isSprintTarget = sess === 'sprint_race'
    const manualGrid = isSprintTarget
      ? canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(seasonId, round)
      : canonicalQualifyingPersistenceService.readCompleteQualifyingResult(seasonId, round)

    expect(manualGrid).not.toBeNull()
    expect(manualGrid?.poleDriverId).toBe('sq3_drv_1')
  })

  // C3-08: initial load e seleção manual produzem a mesma ordem de grid.
  it('C3-08: initial load e seleção manual produzem a mesma ordem de grid', () => {
    const sq1Result = makeMockQualifyingStageResult(seasonId, round, 'sq1', 24, 'sq1', 77.0)
    const sq2Result = makeMockQualifyingStageResult(seasonId, round, 'sq2', 18, 'sq2', 75.0)
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 73.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq1Result)
    canonicalQualifyingPersistenceService.saveStageResult(sq2Result)
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    const initialLoadGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )
    const manualSelectionGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )

    expect(initialLoadGrid).not.toBeNull()
    expect(manualSelectionGrid).not.toBeNull()
    expect(initialLoadGrid?.finalGrid.map((g) => g.driverId)).toEqual(
      manualSelectionGrid?.finalGrid.map((g) => g.driverId),
    )
    expect(initialLoadGrid?.finalGrid.map((g) => g.gridPosition)).toEqual(
      manualSelectionGrid?.finalGrid.map((g) => g.gridPosition),
    )
  })

  // C3-09: Sprint inicializa com raceVariant = SPRINT_RACE.
  it('C3-09: Sprint inicializa com raceVariant = SPRINT_RACE via initializeRaceFromCanonicalGrid', () => {
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 73.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)
    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )!

    const sprintRaceState = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      raceVariant: 'SPRINT_RACE',
      careerId: 'career_c3_test',
      season: 2026,
      round,
      circuitName: 'Shanghai International Circuit',
      circuitCountry: 'China',
      totalLaps: 19,
      playerTeamId: 'team_1',
      canonicalQualifyingGrid: sprintGrid.finalGrid,
    })

    expect(sprintRaceState.raceVariant).toBe('SPRINT_RACE')
    expect(sprintRaceState.totalLaps).toBe(19)
    expect(sprintRaceState.drivers[0].driverId).toBe('sq3_drv_1')
  })

  // C3-10: MAIN_RACE continua usando o resultado da qualificação principal Q1-Q3.
  it('C3-10: MAIN_RACE continua usando o resultado da qualificação principal Q1-Q3', () => {
    // 1. Salvar Sprint (SQ3)
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 74.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    // 2. Salvar Main Qualifying (Q1, Q2, Q3)
    const q1 = makeMockQualifyingStageResult(seasonId, round, 'q1', 24, 'main_q1', 75.0)
    const q2 = makeMockQualifyingStageResult(seasonId, round, 'q2', 18, 'main_q2', 73.0)
    const q3 = makeMockQualifyingStageResult(seasonId, round, 'q3', 10, 'main_q3', 71.0)
    const mainCombined = canonicalQualifyingPersistenceService.buildCombinedFinalGrid({
      seasonId,
      round,
      q1Result: q1,
      q2Result: q2,
      q3Result: q3,
      persistResult: true,
    })

    // MAIN_RACE consulta com isSprint = false
    const mainGrid = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      seasonId,
      round,
    )
    expect(mainGrid).not.toBeNull()
    expect(mainGrid?.poleDriverId).toBe('main_q3_drv_1')
    expect(mainGrid?.poleDriverId).not.toBe('sq3_drv_1')
    expect(mainGrid?.finalGrid[0].driverId).toBe('main_q3_drv_1')
  })

  // C3-11: antes da conclusão da Sprint, Q1 principal permanece bloqueada.
  it('C3-11: antes da conclusão da Sprint, Q1 principal permanece bloqueada', () => {
    // Fim de semana sprint com SQ3 concluída mas sprint_race AINDA NÃO concluída
    const completedBeforeSprint = ['tp1', 'sq1', 'sq2', 'sq3']
    const normalized = normalizeCompletedSessions(completedBeforeSprint)
    expect(normalized.includes('sprint_race')).toBe(false)

    // Gating canônico
    const q1Unlocked = isSessionUnlocked('q1', completedBeforeSprint, true)
    expect(q1Unlocked).toBe(false)

    // Visual state
    const visualState = resolveSessionVisualState({
      sessionId: 'q1',
      activeSessionId: 'sprint_race',
      completedSessions: completedBeforeSprint,
      isSprintRound: true,
    })
    expect(visualState).toBe('locked')
  })

  // C3-12: após conclusão da Sprint, Q1 principal fica disponível.
  it('C3-12: após conclusão da Sprint, Q1 principal fica disponível', () => {
    // Fim de semana sprint com sprint_race concluída
    const completedAfterSprint = ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race']
    const normalized = normalizeCompletedSessions(completedAfterSprint)
    expect(normalized.includes('sprint_race')).toBe(true)

    // Gating canônico
    const q1Unlocked = isSessionUnlocked('q1', completedAfterSprint, true)
    expect(q1Unlocked).toBe(true)

    // Visual state
    const visualState = resolveSessionVisualState({
      sessionId: 'q1',
      activeSessionId: 'tp1',
      completedSessions: completedAfterSprint,
      isSprintRound: true,
    })
    expect(visualState).toBe('available')

    // Próxima sessão requerida é Q1
    const nextSession = getNextRequiredWeekendSession(round, completedAfterSprint)
    expect(nextSession).toBe('q1')
  })

  // C3-13: reload após SQ3 concluída preserva a possibilidade de entrar na Sprint com o mesmo grid.
  it('C3-13: reload após SQ3 concluída preserva a possibilidade de entrar na Sprint com o mesmo grid', () => {
    const sq3Result = makeMockQualifyingStageResult(seasonId, round, 'sq3', 10, 'sq3', 73.0)
    canonicalQualifyingPersistenceService.saveStageResult(sq3Result)

    // Grid gerado antes do suposto reload
    const gridBeforeReload = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )

    // Simula reload (lendo do mesmo storage persistido)
    const gridAfterReload = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      seasonId,
      round,
    )

    expect(gridAfterReload).not.toBeNull()
    expect(gridAfterReload?.poleDriverId).toBe(gridBeforeReload?.poleDriverId)
    expect(gridAfterReload?.finalGrid.map((e) => e.driverId)).toEqual(
      gridBeforeReload?.finalGrid.map((e) => e.driverId),
    )
  })

  // C3-14: reload após Sprint concluída preserva Q1 como próxima sessão disponível.
  it('C3-14: reload após Sprint concluída preserva Q1 como próxima sessão disponível', () => {
    const completed = ['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race']
    // Simulando persistência das sessões completadas
    const rawSaved = JSON.stringify(completed)
    const reloadedCompleted: string[] = JSON.parse(rawSaved)

    const nextSession = getNextRequiredWeekendSession(round, reloadedCompleted)
    expect(nextSession).toBe('q1')

    const unlocked = isSessionUnlocked('q1', reloadedCompleted, true)
    expect(unlocked).toBe(true)

    const visual = resolveSessionVisualState({
      sessionId: 'q1',
      activeSessionId: 'tp1',
      completedSessions: reloadedCompleted,
      isSprintRound: true,
    })
    expect(visual).toBe('available')
  })
})
