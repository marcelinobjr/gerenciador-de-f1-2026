import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function makeMockRaceState(
  raceVariant: 'MAIN_RACE' | 'SPRINT_RACE',
  round = 2,
  careerId = 'career_test_sprint',
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

describe('SPT-CHAMP: Isolar resultado da Sprint e somar no Campeonato (Fix B)', () => {
  const careerId = 'career_sprint_b_test'
  const season = 2026
  const round = 2

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  it('SPT-CHAMP-01: Sprint oficializada cria resultado SPRINT_RACE', () => {
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    expect(sprintOfficial.raceVariant).toBe('SPRINT_RACE')

    const reg = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)
    expect(reg.success).toBe(true)
    expect(reg.persistedResult).not.toBeNull()
    expect(reg.persistedResult?.snapshot?.raceVariant).toBe('SPRINT_RACE')
  })

  it('SPT-CHAMP-02: Main oficializada cria resultado MAIN_RACE', () => {
    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    expect(mainOfficial.raceVariant).toBe('MAIN_RACE')

    const reg = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)
    expect(reg.success).toBe(true)
    expect(reg.persistedResult).not.toBeNull()
    expect(reg.persistedResult?.snapshot?.raceVariant).toBe('MAIN_RACE')
  })

  it('SPT-CHAMP-03: Ambos coexistem na mesma season/round', () => {
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)

    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    const persistedSprint = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      season,
      round,
      'SPRINT_RACE',
    )
    const persistedMain = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )

    expect(persistedSprint).not.toBeNull()
    expect(persistedMain).not.toBeNull()
    expect(persistedSprint?.season).toBe(2026)
    expect(persistedSprint?.round).toBe(round)
    expect(persistedMain?.season).toBe(2026)
    expect(persistedMain?.round).toBe(round)
  })

  it('SPT-CHAMP-04: Persisted IDs/keys são distintos', () => {
    const sprintKey = canonicalCareerPersistenceService.buildRaceResultKey(
      careerId,
      season,
      round,
      'SPRINT_RACE',
    )
    const mainKey = canonicalCareerPersistenceService.buildRaceResultKey(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )
    expect(sprintKey).not.toBe(mainKey)
    expect(sprintKey).toContain('_sprint')
    expect(mainKey).toContain('_main')

    const sprintJournalKey = canonicalCareerPersistenceService.buildApplyJournalKey(
      careerId,
      season,
      round,
      'SPRINT_RACE',
    )
    const mainJournalKey = canonicalCareerPersistenceService.buildApplyJournalKey(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )
    expect(sprintJournalKey).not.toBe(mainJournalKey)
  })

  it('SPT-CHAMP-05: Driver standings soma Sprint + Main', () => {
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)

    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    const snapshot = canonicalChampionshipService.rebuildChampionshipStandings(
      careerId,
      season,
      round,
    )

    // drv_1: Sprint P1 (8) + Main P1 (25) = 33 pts
    const drv1 = snapshot.driverStandings.find((d) => d.driverId === 'drv_1')
    expect(drv1?.points).toBe(33)
    expect(drv1?.raceStarts).toBe(2)

    // drv_2: Sprint P2 (7) + Main P2 (18) = 25 pts
    const drv2 = snapshot.driverStandings.find((d) => d.driverId === 'drv_2')
    expect(drv2?.points).toBe(25)
    expect(drv2?.raceStarts).toBe(2)

    // drv_8: Sprint P8 (1) + Main P8 (4) = 5 pts
    const drv8 = snapshot.driverStandings.find((d) => d.driverId === 'drv_8')
    expect(drv8?.points).toBe(5)
  })

  it('SPT-CHAMP-06: Constructor standings soma Sprint + Main', () => {
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)

    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    const snapshot = canonicalChampionshipService.rebuildChampionshipStandings(
      careerId,
      season,
      round,
    )

    // team_1 possui drv_1 (33 pts) e drv_2 (25 pts) -> soma da equipe = 58 pts
    const team1 = snapshot.constructorStandings.find(
      (c) => c.teamId === 'team_1' || c.teamName === 'Team 1',
    )
    expect(team1?.points).toBe(58)
  })

  it('SPT-CHAMP-07: Sprint reprocessada é idempotente', () => {
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    const firstReg =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)
    expect(firstReg.success).toBe(true)

    // Reprocessar Sprint
    const secondReg =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)
    expect(secondReg.alreadyRegistered).toBe(true)

    const eligible = canonicalChampionshipService.getEligibleOfficialRaceResults(
      careerId,
      season,
      round,
    )
    const sprintResults = eligible.filter((r) => r.snapshot?.raceVariant === 'SPRINT_RACE')
    expect(sprintResults.length).toBe(1)
  })

  it('SPT-CHAMP-08: Main reprocessada é idempotente', () => {
    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    const firstReg =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)
    expect(firstReg.success).toBe(true)

    // Reprocessar Main
    const secondReg =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)
    expect(secondReg.alreadyRegistered).toBe(true)

    const eligible = canonicalChampionshipService.getEligibleOfficialRaceResults(
      careerId,
      season,
      round,
    )
    const mainResults = eligible.filter((r) => r.snapshot?.raceVariant === 'MAIN_RACE')
    expect(mainResults.length).toBe(1)
  })

  it('SPT-CHAMP-09: Reload preserva ambas', () => {
    // 1. Gravar ambas
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)

    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    // 2. Simular leitura limpa como em um novo reload da página
    const loadedSprint = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      season,
      round,
      'SPRINT_RACE',
    )
    const loadedMain = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )
    expect(loadedSprint).not.toBeNull()
    expect(loadedMain).not.toBeNull()
    expect(loadedSprint?.snapshot?.raceVariant).toBe('SPRINT_RACE')
    expect(loadedMain?.snapshot?.raceVariant).toBe('MAIN_RACE')

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const drv1 = standings.driverStandings.find((d) => d.driverId === 'drv_1')
    expect(drv1?.points).toBe(33)
  })

  it('SPT-CHAMP-10: Rodada sem Sprint continua funcionando', () => {
    const nonSprintRound = 3
    const mainState = makeMockRaceState('MAIN_RACE', nonSprintRound, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    const persistedSprint = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      season,
      nonSprintRound,
      'SPRINT_RACE',
    )
    const persistedMain = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      season,
      nonSprintRound,
      'MAIN_RACE',
    )

    expect(persistedSprint).toBeNull()
    expect(persistedMain).not.toBeNull()

    const snapshot = canonicalChampionshipService.rebuildChampionshipStandings(
      careerId,
      season,
      nonSprintRound,
    )
    const drv1 = snapshot.driverStandings.find((d) => d.driverId === 'drv_1')
    expect(drv1?.points).toBe(25) // apenas 25 da corrida principal
    expect(drv1?.raceStarts).toBe(1)
  })

  it('SPT-CHAMP-11: Resultado Sprint não substitui Main', () => {
    // 1. Main é gravada primeiro
    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    // 2. Sprint é gravada em seguida
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)

    // Main deve permanecer íntegra e não ter sido sobrescrita
    const persistedMain = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )
    expect(persistedMain).not.toBeNull()
    expect(persistedMain?.snapshot?.raceVariant).toBe('MAIN_RACE')
    expect(persistedMain?.entries[0]?.pointsAwarded).toBe(25)
  })

  it('SPT-CHAMP-12: Resultado Main não substitui Sprint', () => {
    // 1. Sprint é gravada primeiro
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)

    // 2. Main é gravada em seguida
    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    // Sprint deve permanecer íntegra e não ter sido sobrescrita
    const persistedSprint = canonicalCareerPersistenceService.getPersistedRaceResult(
      careerId,
      season,
      round,
      'SPRINT_RACE',
    )
    expect(persistedSprint).not.toBeNull()
    expect(persistedSprint?.snapshot?.raceVariant).toBe('SPRINT_RACE')
    expect(persistedSprint?.entries[0]?.pointsAwarded).toBe(8)
  })
})
