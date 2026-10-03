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

  it('SPT-CHAMP-01: mesma rodada com Sprint + Main oficializadas → snapshot soma ambas as pontuações', () => {
    // 1. Oficializa e registra Sprint
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    const sprintReg =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)
    expect(sprintReg.success).toBe(true)

    // 2. Oficializa e registra Main Race da mesma rodada
    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    const mainReg =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)
    expect(mainReg.success).toBe(true)

    // Ambos os fatos esportivos devem estar persistidos sob chaves distintas
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
    expect(persistedSprint?.id).not.toBe(persistedMain?.id)

    // 3. Obter snapshot do campeonato da rodada 2
    const snapshot = canonicalChampionshipService.rebuildChampionshipStandings(
      careerId,
      season,
      round,
    )

    // drv_1 ganhou Sprint (P1=8) e Main (P1=25) -> Total = 33 pontos
    const drv1 = snapshot.driverStandings.find((d) => d.driverId === 'drv_1')
    expect(drv1).toBeDefined()
    expect(drv1?.points).toBe(33) // 8 + 25 = 33!
    expect(drv1?.raceStarts).toBe(2) // 1 largada da Sprint + 1 largada da Main

    // drv_2 foi P2 na Sprint (7) e P2 na Main (18) -> Total = 25 pontos
    const drv2 = snapshot.driverStandings.find((d) => d.driverId === 'drv_2')
    expect(drv2?.points).toBe(25) // 7 + 18 = 25!
    expect(drv2?.raceStarts).toBe(2)

    // drv_8 foi P8 na Sprint (1) e P8 na Main (4) -> Total = 5 pontos
    const drv8 = snapshot.driverStandings.find((d) => d.driverId === 'drv_8')
    expect(drv8?.points).toBe(5)

    // drv_9 foi P9 na Sprint (0) e P9 na Main (2) -> Total = 2 pontos
    const drv9 = snapshot.driverStandings.find((d) => d.driverId === 'drv_9')
    expect(drv9?.points).toBe(2)

    // drv_10 foi P10 na Sprint (0) e P10 na Main (1) -> Total = 1 ponto
    const drv10 = snapshot.driverStandings.find((d) => d.driverId === 'drv_10')
    expect(drv10?.points).toBe(1)

    // Construtores: team_1 tem drv_1 e drv_2 -> Sprint (8+7=15) + Main (25+18=43) = 58
    const team1 = snapshot.constructorStandings.find(
      (c) => c.teamId === 'team_1' || c.teamName === 'Team 1',
    )
    if (team1) {
      expect(team1.points).toBe(58)
    }
  })

  it('SPT-CHAMP-02: journal COMPLETE por variante isolada', () => {
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)

    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    const sprintJournal = canonicalCareerPersistenceService.getApplicationJournal(
      careerId,
      season,
      round,
      'SPRINT_RACE',
    )
    const mainJournal = canonicalCareerPersistenceService.getApplicationJournal(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )

    expect(sprintJournal?.status).toBe('COMPLETE')
    expect(mainJournal?.status).toBe('COMPLETE')
    expect(sprintJournal?.key).not.toBe(mainJournal?.key)
  })

  it('SPT-CHAMP-03: idempotência (re-registrar a Sprint ou Main não duplica dados)', () => {
    const sprintState = makeMockRaceState('SPRINT_RACE', round, careerId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)

    // Re-registrar Sprint
    const reSprint =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)
    expect(reSprint.alreadyRegistered).toBe(true)

    const mainState = makeMockRaceState('MAIN_RACE', round, careerId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    // Re-registrar Main
    const reMain =
      canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)
    expect(reMain.alreadyRegistered).toBe(true)

    const snapshot = canonicalChampionshipService.rebuildChampionshipStandings(
      careerId,
      season,
      round,
    )
    const drv1 = snapshot.driverStandings.find((d) => d.driverId === 'drv_1')
    expect(drv1?.points).toBe(33) // permanece 33, sem duplicar
  })

  it('SPT-CHAMP-04: ordem invertida (Main antes da Sprint) não perde resultado nem pontuação', () => {
    const cId = 'career_inverted_test'
    // 1. Registra Main Race primeiro
    const mainState = makeMockRaceState('MAIN_RACE', round, cId)
    const mainOfficial = canonicalRaceResultService.officializeRace(mainState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(mainOfficial)

    // 2. Registra Sprint Race depois
    const sprintState = makeMockRaceState('SPRINT_RACE', round, cId)
    const sprintOfficial = canonicalRaceResultService.officializeRace(sprintState)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(sprintOfficial)

    const snapshot = canonicalChampionshipService.rebuildChampionshipStandings(cId, season, round)
    const drv1 = snapshot.driverStandings.find((d) => d.driverId === 'drv_1')
    expect(drv1?.points).toBe(33) // soma ambas perfeitamente independente da ordem
  })
})
