import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { CanonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { calculateRacePoints } from '@/lib/f1-standings-calculator'
import { OFFICIAL_GRID_TEAMS } from '@/lib/f1-data'
import type { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

/**
 * ALL-DNF-RACE-01C-B — APLICAÇÃO CANÔNICA DOS PONTOS
 * RESULTADO OFICIAL → PILOTOS → CONSTRUTORES
 *
 * Suíte de Testes Canônica: ALLDNF01CB-01 .. ALLDNF01CB-16
 *
 * Contratos testados:
 * - 01: officializeRace usa os pontos calculados pelo resolver canônico.
 * - 02: P1 CLASSIFIED com 6 pts → Driver Championship +6.
 * - 03: P2 CLASSIFIED com 4 pts → Driver Championship +4.
 * - 04: NC → Driver Championship +0.
 * - 05: DNF + CLASSIFIED → recebe pontos normalmente.
 * - 06: DNF + NC → 0 pontos.
 * - 07: Dois pilotos da mesma equipe 6 + 3 → Constructor Championship +9.
 * - 08: Piloto NC da mesma equipe não adiciona pontos ao construtor.
 * - 09: Pontos não vazam entre equipes diferentes.
 * - 10: Player team usa exatamente a mesma regra das demais equipes.
 * - 11: Evento sem elegibilidade para pontos: Driver delta = 0, Constructor delta = 0.
 * - 12: Faixa <25% é refletida corretamente nos campeonatos.
 * - 13: Faixa >=75% é refletida corretamente nos campeonatos.
 * - 14: Driver standings usa os mesmos pointsAwarded do resultado oficial.
 * - 15: Constructor standings usa a soma dos mesmos pointsAwarded oficiais.
 * - 16: Nenhuma tabela paralela de pontos é usada pelos writers de campeonato.
 */

describe('ALL-DNF-RACE-01C-B — Aplicação Canônica dos Pontos aos Campeonatos', () => {
  let engine: CanonicalRaceEngineService
  let resultService: CanonicalRaceResultService

  const careerId = 'test_career_alldnf_01c_b'
  const season = 2026
  const round = 1
  const raceId = 'test_gp_alldnf_01c_b'

  beforeEach(() => {
    engine = new CanonicalRaceEngineService()
    resultService = new CanonicalRaceResultService()
    resultService.clearOfficialRaceResultForTesting(careerId, season, round)
    canonicalCareerPersistenceService.clearPersistenceForTesting(careerId, season, round)
    canonicalChampionshipService.clearSnapshotsForTesting(careerId, season, round)
  })

  /**
   * Helper para montar o estado da prova com as 12 equipes oficiais da F1 2026
   */
  function createCanonicalAllDnfRaceState(options?: {
    totalLaps?: number
    currentLap?: number
    safetyCarActive?: boolean
    vscActive?: boolean
    raceControlLaps?: { safetyCarLaps?: number; vscLaps?: number }
    playerTeamId?: string
    setupDrivers?: (drivers: CanonicalRaceDriverState[]) => void
  }): CanonicalRaceState {
    const totalLaps = options?.totalLaps ?? 60
    const currentLap = options?.currentLap ?? 11
    const pTeamId = options?.playerTeamId ?? 'audi'

    // Usar as 12 equipes oficiais canônicas de 2026 (2 pilotos por equipe = 24 pilotos)
    const drivers: CanonicalRaceDriverState[] = []
    OFFICIAL_GRID_TEAMS.forEach((team, teamIndex) => {
      for (let carNum = 1; carNum <= 2; carNum++) {
        const globalIdx = teamIndex * 2 + (carNum - 1)
        const pos = globalIdx + 1
        const driverName = carNum === 1 ? team.driver1.name : team.driver2.name
        const driverId = `drv_${pos.toString().padStart(2, '0')}`

        drivers.push({
          careerId,
          season,
          raceId,
          driverId,
          teamId: team.key,
          driverName,
          teamName: team.name,
          teamColor: team.color,
          gridPosition: pos,
          currentPosition: pos,
          lap: currentLap > 1 ? currentLap - 1 : 0,
          raceTime: currentLap > 1 ? (currentLap - 1) * 90 + pos * 2 : 0,
          gap: pos === 1 ? 'LÍDER' : `+${(pos * 0.5).toFixed(3)}s`,
          tyreCompound: 'medio',
          tyreAge: currentLap > 1 ? currentLap - 1 : 0,
          fuel: 80 - pos,
          carCondition: 95 - pos,
          raceStatus: 'dnf',
          isDnf: true,
          pitStops: 1,
          isPlayer: team.key === pTeamId,
        })
      }
    })

    if (options?.setupDrivers) {
      options.setupDrivers(drivers)
    }

    const lookup: Record<string, CanonicalRaceDriverState> = {}
    drivers.forEach((d) => {
      lookup[d.driverId] = d
    })

    return {
      version: '2.0',
      careerId,
      season,
      round,
      raceId,
      circuitName: 'Silverstone',
      circuitCountry: 'GBR',
      totalLaps,
      currentLap,
      status: 'completed',
      safetyCarActive: options?.safetyCarActive ?? false,
      vscActive: options?.vscActive ?? false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      drivers,
      driverLookup: lookup,
      playerTeamId: pTeamId,
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      events: [],
      raceControl: {
        currentFlag: 'FINISHED',
        lapsRemainingInPhase: 0,
        safetyCarLaps: options?.raceControlLaps?.safetyCarLaps ?? 0,
        vscLaps: options?.raceControlLaps?.vscLaps ?? 0,
        redFlagLaps: 0,
        scQueuedOrder: [],
        restartPending: false,
        activeEvents: [],
        history: [],
      },
    }
  }

  // ALLDNF01CB-01: officializeRace usa os pontos calculados pelo resolver canônico
  it('ALLDNF01CB-01: officializeRace usa os pontos calculados pelo resolver canônico calculateRacePoints', () => {
    // 60 voltas, líder com 10 voltas (<25% -> 6/4/3/2/1)
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 11,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.lap = 10
          d.raceTime = 900 + idx * 2
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    expect(official).toBeDefined()

    // Para cada piloto, verificar que entry.pointsAwarded bate com calculateRacePoints()
    official.entries.forEach((entry) => {
      const expectedPoints = calculateRacePoints({
        position: entry.finalPosition,
        scheduledLaps: 60,
        leaderLaps: 10,
        hasMinimumPointEligibility: true,
        isClassified: entry.isClassified,
        classificationStatus: entry.classificationStatus,
        raceStatus: entry.status,
      })
      expect(entry.pointsAwarded).toBe(expectedPoints)
      expect((entry as any).points).toBe(expectedPoints)
    })
  })

  // ALLDNF01CB-02: P1 CLASSIFIED com 6 pts → Driver Championship +6
  it('ALLDNF01CB-02: P1 CLASSIFIED com 6 pts → Driver Championship +6', () => {
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 11,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.lap = 10
          d.raceTime = 900 + idx * 2
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    const p1Entry = official.entries[0]
    expect(p1Entry.finalPosition).toBe(1)
    expect(p1Entry.classificationStatus).toBe('CLASSIFIED')
    expect(p1Entry.pointsAwarded).toBe(6)

    const reg = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    expect(reg.success).toBe(true)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const champP1 = standings.driverStandings.find((d) => d.driverId === p1Entry.driverId)
    expect(champP1).toBeDefined()
    expect(champP1!.points).toBe(6)
  })

  // ALLDNF01CB-03: P2 CLASSIFIED com 4 pts → Driver Championship +4
  it('ALLDNF01CB-03: P2 CLASSIFIED com 4 pts → Driver Championship +4', () => {
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 11,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.lap = 10
          d.raceTime = 900 + idx * 2
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    const p2Entry = official.entries[1]
    expect(p2Entry.finalPosition).toBe(2)
    expect(p2Entry.classificationStatus).toBe('CLASSIFIED')
    expect(p2Entry.pointsAwarded).toBe(4)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const champP2 = standings.driverStandings.find((d) => d.driverId === p2Entry.driverId)
    expect(champP2).toBeDefined()
    expect(champP2!.points).toBe(4)
  })

  // ALLDNF01CB-04: NC → Driver Championship +0
  it('ALLDNF01CB-04: NC → Driver Championship +0 mesmo que posição relativa esteja no Top 10', () => {
    // Líder 40 laps (90% floor = 36 laps). P4 completou 35 laps -> NOT_CLASSIFIED / NC.
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.lap = idx < 3 ? 40 : 35
          d.raceTime = 3000 + idx * 5
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    const p4Entry = official.entries[3]
    expect(p4Entry.finalPosition).toBe(4)
    expect(p4Entry.classificationStatus).toBe('NOT_CLASSIFIED')
    expect(p4Entry.pointsAwarded).toBe(0)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const champP4 = standings.driverStandings.find((d) => d.driverId === p4Entry.driverId)
    expect(champP4).toBeDefined()
    expect(champP4!.points).toBe(0)
  })

  // ALLDNF01CB-05: DNF + CLASSIFIED → recebe pontos normalmente
  it('ALLDNF01CB-05: DNF + CLASSIFIED recebe pontos normalmente sem exigir FINISHED', () => {
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 21, // 20 voltas = 33.33% (Faixa 2: P1=13, P2=10, P3=8)
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 20
          d.raceTime = 1800 + idx * 2
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    const p1 = official.entries[0]
    expect(p1.status).toBe('dnf')
    expect(p1.classificationStatus).toBe('CLASSIFIED')
    expect(p1.pointsAwarded).toBe(13)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const champP1 = standings.driverStandings.find((d) => d.driverId === p1.driverId)
    expect(champP1).toBeDefined()
    expect(champP1!.points).toBe(13)
  })

  // ALLDNF01CB-06: DNF + NC → 0 pontos
  it('ALLDNF01CB-06: DNF + NC → 0 pontos no resultado e no campeonato', () => {
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = idx === 0 ? 40 : 10 // P2..P24 com 10 voltas (< 36 laps -> NC)
          d.raceTime = 3000 + idx * 5
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    const p2Entry = official.entries[1]
    expect(p2Entry.status).toBe('dnf')
    expect(p2Entry.classificationStatus).toBe('NOT_CLASSIFIED')
    expect(p2Entry.pointsAwarded).toBe(0)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const champP2 = standings.driverStandings.find((d) => d.driverId === p2Entry.driverId)
    expect(champP2).toBeDefined()
    expect(champP2!.points).toBe(0)
  })

  // ALLDNF01CB-07: Dois pilotos da mesma equipe 6 + 3 → Constructor Championship +9
  it('ALLDNF01CB-07: dois pilotos da mesma equipe 6 + 3 → Constructor Championship +9', () => {
    // FIXTURE: Team X (mercedes) com Driver A (P1 = 6 pts) e Driver C (P3 = 3 pts)
    // Team Y (ferrari) com Driver B (P2 = 4 pts)
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 11, // 10 voltas = 16.67% (<25% -> P1=6, P2=4, P3=3, P4=2, P5=1)
      setupDrivers: (drivers) => {
        // Ordenar explicitamente tempos para garantir:
        // P1: drv_01 (mercedes)
        // P2: drv_03 (ferrari)
        // P3: drv_02 (mercedes)
        const d1 = drivers.find((d) => d.driverId === 'drv_01')!
        const d2 = drivers.find((d) => d.driverId === 'drv_02')!
        const d3 = drivers.find((d) => d.driverId === 'drv_03')!

        drivers.forEach((d) => {
          d.lap = 10
          d.raceTime = 2000
        })

        d1.lap = 10
        d1.raceTime = 900 // P1 -> 6 pts (mercedes)
        d3.lap = 10
        d3.raceTime = 910 // P2 -> 4 pts (ferrari)
        d2.lap = 10
        d2.raceTime = 920 // P3 -> 3 pts (mercedes)
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    expect(official.entries[0].driverId).toBe('drv_01')
    expect(official.entries[0].teamId).toBe('mercedes')
    expect(official.entries[0].pointsAwarded).toBe(6)

    expect(official.entries[1].driverId).toBe('drv_03')
    expect(official.entries[1].teamId).toBe('ferrari')
    expect(official.entries[1].pointsAwarded).toBe(4)

    expect(official.entries[2].driverId).toBe('drv_02')
    expect(official.entries[2].teamId).toBe('mercedes')
    expect(official.entries[2].pointsAwarded).toBe(3)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const teamMercedes = standings.constructorStandings.find((c) => c.teamId === 'mercedes')
    expect(teamMercedes).toBeDefined()
    expect(teamMercedes!.points).toBe(6 + 3) // 9 pontos exatos
  })

  // ALLDNF01CB-08: Piloto NC da mesma equipe não adiciona pontos ao construtor
  it('ALLDNF01CB-08: piloto NC da mesma equipe não adiciona pontos ao construtor', () => {
    // mercedes: Driver 1 (P1, 40 laps -> Faixa 3 >=50% = 19 pts)
    // mercedes: Driver 2 (P4, 30 laps < 36 -> NC = 0 pts)
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 41,
      setupDrivers: (drivers) => {
        const d1 = drivers.find((d) => d.driverId === 'drv_01')!
        const d2 = drivers.find((d) => d.driverId === 'drv_02')!

        drivers.forEach((d) => {
          d.lap = 30
          d.raceTime = 3500
        })

        d1.lap = 40
        d1.raceTime = 3000 // P1 CLASSIFIED -> 19 pts
        d2.lap = 30
        d2.raceTime = 3020 // P2 no tempo mas NC por <90% (30 < 36) -> 0 pts
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    const mercD1 = official.entries.find((e) => e.driverId === 'drv_01')!
    const mercD2 = official.entries.find((e) => e.driverId === 'drv_02')!

    expect(mercD1.classificationStatus).toBe('CLASSIFIED')
    expect(mercD1.pointsAwarded).toBe(19)
    expect(mercD2.classificationStatus).toBe('NOT_CLASSIFIED')
    expect(mercD2.pointsAwarded).toBe(0)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const merc = standings.constructorStandings.find((c) => c.teamId === 'mercedes')
    expect(merc).toBeDefined()
    expect(merc!.points).toBe(19) // Apenas os 19 pts de Driver 1
  })

  // ALLDNF01CB-09: Pontos não vazam entre equipes diferentes
  it('ALLDNF01CB-09: pontos não vazam entre equipes diferentes (vínculo canônico por teamId)', () => {
    // FIXTURE COMPLETA:
    // P1: Driver A (Team X: mercedes) -> 6 pts
    // P2: Driver B (Team Y: ferrari)  -> 4 pts
    // P3: Driver C (Team X: mercedes) -> 3 pts
    // P4: Driver D (Team Z: mclaren)  -> NC (5 laps) -> 0 pts
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 11,
      setupDrivers: (drivers) => {
        const dA = drivers.find((d) => d.driverId === 'drv_01')! // mercedes
        const dC = drivers.find((d) => d.driverId === 'drv_02')! // mercedes
        const dB = drivers.find((d) => d.driverId === 'drv_03')! // ferrari
        const dD = drivers.find((d) => d.driverId === 'drv_05')! // mclaren

        drivers.forEach((d) => {
          d.lap = 10
          d.raceTime = 2500
        })

        dA.lap = 10
        dA.raceTime = 900 // P1
        dB.lap = 10
        dB.raceTime = 910 // P2
        dC.lap = 10
        dC.raceTime = 920 // P3
        dD.lap = 5 // P4 no tempo mas NC (5 laps < 9)
        dD.raceTime = 930
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const teamX = standings.constructorStandings.find((c) => c.teamId === 'mercedes')!
    const teamY = standings.constructorStandings.find((c) => c.teamId === 'ferrari')!
    const teamZ = standings.constructorStandings.find((c) => c.teamId === 'mclaren')!

    // Driver A +6, Driver B +4, Driver C +3, Driver D +0
    // Team X +9, Team Y +4, Team Z +0
    expect(teamX.points).toBe(9)
    expect(teamY.points).toBe(4)
    expect(teamZ.points).toBe(0)
  })

  // ALLDNF01CB-10: Player team usa exatamente a mesma regra das demais equipes
  it('ALLDNF01CB-10: player team usa exatamente a mesma regra das demais equipes', () => {
    // Definir Audi como player team
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 11,
      playerTeamId: 'audi',
      setupDrivers: (drivers) => {
        const audiD1 = drivers.find(
          (d) => d.teamId === 'audi' && d.driverName === 'Gabriel Bortoleto',
        )!
        const audiD2 = drivers.find(
          (d) => d.teamId === 'audi' && d.driverName === 'Nico Hülkenberg',
        )!

        drivers.forEach((d) => {
          d.lap = 10
          d.raceTime = 2000
        })

        audiD1.lap = 10
        audiD1.raceTime = 900 // P1 -> 6 pts
        audiD2.lap = 10
        audiD2.raceTime = 910 // P2 -> 4 pts
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(
      careerId,
      season,
      round,
      'audi',
    )
    const audiTeam = standings.constructorStandings.find((c) => c.teamId === 'audi')
    expect(audiTeam).toBeDefined()
    expect(audiTeam!.isPlayer).toBe(true)
    expect(audiTeam!.points).toBe(6 + 4) // 10 pts exatos sem regra especial
  })

  // ALLDNF01CB-11: Evento sem elegibilidade para pontos: Driver delta = 0, Constructor delta = 0
  it('ALLDNF01CB-11: evento sem elegibilidade para pontos: Driver delta = 0, Constructor delta = 0', () => {
    // Prova inteira sob Safety Car (líder com 3 voltas, mas 3 voltas sob SC -> green laps = 0 < 2)
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 4,
      raceControlLaps: { safetyCarLaps: 3 },
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.lap = 3
          d.raceTime = 300 + idx
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    official.entries.forEach((e) => {
      expect(e.pointsAwarded).toBe(0)
    })

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    standings.driverStandings.forEach((d) => {
      expect(d.points).toBe(0)
    })
    standings.constructorStandings.forEach((c) => {
      expect(c.points).toBe(0)
    })
  })

  // ALLDNF01CB-12: Faixa <25% é refletida corretamente nos campeonatos
  it('ALLDNF01CB-12: faixa <25% (6/4/3/2/1) é refletida fielmente nos campeonatos', () => {
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 11, // 10/60 = 16.67%
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.lap = 10
          d.raceTime = 900 + idx * 2
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const top5Expected = [6, 4, 3, 2, 1]

    for (let i = 0; i < 5; i++) {
      const entry = official.entries[i]
      const champDriver = standings.driverStandings.find((d) => d.driverId === entry.driverId)
      expect(champDriver).toBeDefined()
      expect(champDriver!.points).toBe(top5Expected[i])
    }

    const p6Entry = official.entries[5]
    const champP6 = standings.driverStandings.find((d) => d.driverId === p6Entry.driverId)
    expect(champP6!.points).toBe(0)
  })

  // ALLDNF01CB-13: Faixa >=75% é refletida corretamente nos campeonatos
  it('ALLDNF01CB-13: faixa >=75% (25/18/15/12/10/8/6/4/2/1) é refletida fielmente nos campeonatos', () => {
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 46, // 45/60 = 75%
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.lap = 45
          d.raceTime = 4000 + idx * 2
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const fullExpected = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

    for (let i = 0; i < 10; i++) {
      const entry = official.entries[i]
      const champDriver = standings.driverStandings.find((d) => d.driverId === entry.driverId)
      expect(champDriver).toBeDefined()
      expect(champDriver!.points).toBe(fullExpected[i])
    }

    const p11Entry = official.entries[10]
    const champP11 = standings.driverStandings.find((d) => d.driverId === p11Entry.driverId)
    expect(champP11!.points).toBe(0)
  })

  // ALLDNF01CB-14: Driver standings usa os mesmos pointsAwarded do resultado oficial
  it('ALLDNF01CB-14: driver standings usa exatamente os pointsAwarded do resultado oficial (soma idêntica)', () => {
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 21,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.lap = 20
          d.raceTime = 1800 + idx * 2
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)

    // A soma de pointsAwarded dos pilotos no resultado oficial deve ser idêntica
    // à soma de pontos em driverStandings
    const officialTotalDriverPoints = official.entries.reduce((sum, e) => sum + e.pointsAwarded, 0)
    const standingsTotalDriverPoints = standings.driverStandings.reduce(
      (sum, d) => sum + d.points,
      0,
    )

    expect(standingsTotalDriverPoints).toBe(officialTotalDriverPoints)
  })

  // ALLDNF01CB-15: Constructor standings usa a soma dos mesmos pointsAwarded oficiais
  it('ALLDNF01CB-15: constructor standings usa a soma dos mesmos pointsAwarded oficiais (soma idêntica)', () => {
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 21,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.lap = 20
          d.raceTime = 1800 + idx * 2
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)

    const officialTotalPoints = official.entries.reduce((sum, e) => sum + e.pointsAwarded, 0)
    const constructorTotalPoints = standings.constructorStandings.reduce(
      (sum, c) => sum + c.points,
      0,
    )

    expect(constructorTotalPoints).toBe(officialTotalPoints)
  })

  // ALLDNF01CB-16: Nenhuma tabela paralela de pontos é usada pelos writers de campeonato
  it('ALLDNF01CB-16: auditChampionshipStandings confirma ausência de tabelas paralelas e discrepâncias', () => {
    const state = createCanonicalAllDnfRaceState({
      totalLaps: 60,
      currentLap: 11,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.lap = 10
          d.raceTime = 900 + idx * 2
        })
      },
    })

    const official = resultService.createOfficialRaceResult(state)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const auditReport = canonicalChampionshipService.auditChampionshipStandings({
      careerId,
      season,
      throughRound: round,
    })

    expect(auditReport.isValid).toBe(true)
    expect(auditReport.pointsSumMatch).toBe(true)
    expect(auditReport.errors).toEqual([])
    expect(auditReport.totalDriverPointsAwarded).toBe(auditReport.totalDriverPointsCalculated)
    expect(auditReport.totalConstructorPointsAwarded).toBe(
      auditReport.totalConstructorPointsCalculated,
    )
  })
})
