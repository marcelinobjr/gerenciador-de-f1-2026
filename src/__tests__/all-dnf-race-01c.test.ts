import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { CanonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { calculateFiaPoints } from '@/lib/f1-standings-calculator'
import { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

/**
 * ALL-DNF-RACE-01C — PONTUAÇÃO FIA 2026 + CAMPEONATOS + PERSISTÊNCIA (TODAS DNF)
 * Suíte de Testes Canônica: ALLDNF01C-01 .. ALLDNF01C-20
 *
 * Contratos FIA 2026 Article A2.2.1:
 * - Faixa 0: líder < 2 voltas completas consecutivas sem SC/VSC -> 0 pontos
 * - Faixa 1 (>= 2 voltas e < 25%): 6, 4, 3, 2, 1 (Top 5)
 * - Faixa 2 (>= 25% e < 50%): 13, 10, 8, 6, 5, 4, 3, 2, 1, P10=0 (Top 9)
 * - Faixa 3 (>= 50% e < 75%): 19, 14, 12, 10, 8, 6, 4, 3, 2, 1 (Top 10)
 * - Faixa 4 (>= 75%): 25, 18, 15, 12, 10, 8, 6, 4, 2, 1 (Top 10 cheia)
 * - Somente CLASSIFIED pontua; NC -> 0 pontos
 * - DNF + CLASSIFIED pode receber pontos normalmente
 * - Persistência oficial e idempotência absoluta
 */
describe('HOTFIX ALL-DNF-RACE-01C — Pontuação FIA 2026, Campeonatos e Persistência', () => {
  let engine: CanonicalRaceEngineService
  let resultService: CanonicalRaceResultService

  const careerId = 'test_career_alldnf_01c_suite'
  const season = 2026
  const round = 4
  const raceId = 'test_gp_alldnf_01c_suite'

  beforeEach(() => {
    engine = new CanonicalRaceEngineService()
    resultService = new CanonicalRaceResultService()
    resultService.clearOfficialRaceResultForTesting(careerId, season, round)
    canonicalCareerPersistenceService.clearPersistenceForTesting(careerId, season, round)
    canonicalChampionshipService.clearSnapshotsForTesting(careerId, season, round)
  })

  function createMockRaceState(options?: {
    totalLaps?: number
    currentLap?: number
    status?: CanonicalRaceState['status']
    safetyCarActive?: boolean
    vscActive?: boolean
    raceControlLaps?: { safetyCarLaps?: number; vscLaps?: number }
    events?: any[]
    setupDrivers?: (drivers: CanonicalRaceDriverState[]) => void
  }): CanonicalRaceState {
    const totalLaps = options?.totalLaps ?? 60
    const currentLap = options?.currentLap ?? 34
    const status = options?.status ?? 'running'

    const drivers: CanonicalRaceDriverState[] = Array.from({ length: 24 }, (_, i) => {
      const pos = i + 1
      const teamIdx = Math.floor(i / 2) + 1
      return {
        careerId,
        season,
        raceId,
        driverId: `drv_${pos.toString().padStart(2, '0')}`,
        teamId: `team_${teamIdx.toString().padStart(2, '0')}`,
        driverName: `Driver ${pos}`,
        teamName: `Team ${teamIdx}`,
        teamColor: '#FF0000',
        gridPosition: pos,
        currentPosition: pos,
        lap: currentLap > 1 ? currentLap - 1 : 0,
        raceTime: currentLap > 1 ? (currentLap - 1) * 90 + pos : 0,
        gap: pos === 1 ? 'LÍDER' : '+0.500s',
        tyreCompound: 'medio',
        tyreAge: currentLap > 1 ? currentLap - 1 : 0,
        fuel: 80 - pos,
        carCondition: 95 - pos,
        raceStatus: 'racing',
        pitStops: 1,
        isPlayer: pos <= 2,
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
      status,
      safetyCarActive: options?.safetyCarActive ?? false,
      vscActive: options?.vscActive ?? false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      drivers,
      driverLookup: lookup,
      playerTeamId: 'team_01',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      events: options?.events ?? [],
      raceControl: {
        currentFlag: 'GREEN',
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

  // ALLDNF01C-01: líder < 2 green consecutive laps -> 0 pontos para todos
  it('ALLDNF01C-01: líder < 2 green consecutive laps -> 0 pontos para todos', () => {
    // leaderLaps = 2 mas ambas as voltas foram sob Safety Car
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 3,
      raceControlLaps: { safetyCarLaps: 2 },
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 2
          d.raceTime = 200 + idx
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    expect(official.entries[0].lapsCompleted).toBe(2)
    official.entries.forEach((e) => {
      expect(e.pointsAwarded).toBe(0)
    })
  })

  // ALLDNF01C-02: 2 voltas válidas e distância <25% -> tabela 6/4/3/2/1
  it('ALLDNF01C-02: 2 voltas válidas e distância <25% -> tabela 6/4/3/2/1', () => {
    // scheduledLaps = 60, leaderLaps = 10 (16.67% < 25%)
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 11,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 10
          d.raceTime = 900 + idx * 2
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    expect(official.entries[0].pointsAwarded).toBe(6)
    expect(official.entries[1].pointsAwarded).toBe(4)
    expect(official.entries[2].pointsAwarded).toBe(3)
    expect(official.entries[3].pointsAwarded).toBe(2)
    expect(official.entries[4].pointsAwarded).toBe(1)
    expect(official.entries[5].pointsAwarded).toBe(0)
    expect(official.entries[9].pointsAwarded).toBe(0)
  })

  // ALLDNF01C-03: >=25% e <50% -> 13/10/8/6/5/4/3/2/1/0 (P10 = 0)
  it('ALLDNF01C-03: >=25% e <50% -> 13/10/8/6/5/4/3/2/1/0 (P10 = 0)', () => {
    // scheduledLaps = 60, leaderLaps = 20 (33.33%)
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 21,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 20
          d.raceTime = 1800 + idx * 2
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const expected = [13, 10, 8, 6, 5, 4, 3, 2, 1, 0]
    expected.forEach((pts, idx) => {
      expect(official.entries[idx].pointsAwarded).toBe(pts)
    })
    expect(official.entries[9].pointsAwarded).toBe(0) // P10 = 0 estrito
  })

  // ALLDNF01C-04: >=50% e <75% -> 19/14/12/10/8/6/4/3/2/1
  it('ALLDNF01C-04: >=50% e <75% -> 19/14/12/10/8/6/4/3/2/1', () => {
    // scheduledLaps = 60, leaderLaps = 35 (58.33%)
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 36,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 35
          d.raceTime = 3000 + idx * 2
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const expected = [19, 14, 12, 10, 8, 6, 4, 3, 2, 1]
    expected.forEach((pts, idx) => {
      expect(official.entries[idx].pointsAwarded).toBe(pts)
    })
    expect(official.entries[10].pointsAwarded).toBe(0)
  })

  // ALLDNF01C-05: >=75% -> 25/18/15/12/10/8/6/4/2/1
  it('ALLDNF01C-05: >=75% -> 25/18/15/12/10/8/6/4/2/1', () => {
    // scheduledLaps = 60, leaderLaps = 46 (76.67%)
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 47,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 46
          d.raceTime = 4000 + idx * 2
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const expected = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    expected.forEach((pts, idx) => {
      expect(official.entries[idx].pointsAwarded).toBe(pts)
    })
    expect(official.entries[10].pointsAwarded).toBe(0)
  })

  // ALLDNF01C-06: exatamente 25% -> faixa 2
  it('ALLDNF01C-06: exatamente 25% (ex: 15 voltas em 60) -> faixa 2 (13/10/8...)', () => {
    expect(calculateFiaPoints(1, 15, 60)).toBe(13)
    expect(calculateFiaPoints(9, 15, 60)).toBe(1)
    expect(calculateFiaPoints(10, 15, 60)).toBe(0)

    // E logo abaixo de 25% (ex: 24.99% => 14 voltas em 60) -> faixa 1 (6/4/3/2/1)
    expect(calculateFiaPoints(1, 14, 60)).toBe(6)
  })

  // ALLDNF01C-07: exatamente 50% -> faixa 3
  it('ALLDNF01C-07: exatamente 50% (ex: 30 voltas em 60) -> faixa 3 (19/14/12...)', () => {
    expect(calculateFiaPoints(1, 30, 60)).toBe(19)
    expect(calculateFiaPoints(10, 30, 60)).toBe(1)

    // E logo abaixo de 50% (ex: 29 voltas em 60) -> faixa 2
    expect(calculateFiaPoints(1, 29, 60)).toBe(13)
  })

  // ALLDNF01C-08: exatamente 75% -> faixa 4
  it('ALLDNF01C-08: exatamente 75% (ex: 45 voltas em 60) -> faixa 4 (25/18/15...)', () => {
    expect(calculateFiaPoints(1, 45, 60)).toBe(25)
    expect(calculateFiaPoints(10, 45, 60)).toBe(1)

    // E logo abaixo de 75% (ex: 44 voltas em 60) -> faixa 3
    expect(calculateFiaPoints(1, 44, 60)).toBe(19)
  })

  // ALLDNF01C-09: NC recebe 0 pontos
  it('ALLDNF01C-09: piloto NC/NOT_CLASSIFIED recebe rigorosamente 0 pontos mesmo em posição elegível', () => {
    // leaderLaps = 40 (threshold = 36), P4 tem 35 laps -> NOT_CLASSIFIED
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = idx < 3 ? 40 : 35 // P1, P2, P3 com 40 voltas; P4..P24 com 35 voltas
          d.raceTime = 3000 + idx * 5
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const p4 = official.entries[3]
    expect(p4.finalPosition).toBe(4)
    expect(p4.classificationStatus).toBe('NOT_CLASSIFIED')
    expect(p4.isClassified).toBe(false)
    expect(p4.pointsAwarded).toBe(0)
  })

  // ALLDNF01C-10: DNF + CLASSIFIED pode receber pontos
  it('ALLDNF01C-10: piloto DNF + CLASSIFIED recebe pontos normalmente conforme posição e distância', () => {
    // 60 voltas, líder 40 voltas (50% < 40/60 < 75% -> Faixa 3: P1=19, P2=14, P3=12)
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 40
          d.raceTime = 3000 + idx * 5
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    expect(official.entries[0].status).toBe('dnf')
    expect(official.entries[0].classificationStatus).toBe('CLASSIFIED')
    expect(official.entries[0].pointsAwarded).toBe(19) // P1 Faixa 3

    expect(official.entries[1].status).toBe('dnf')
    expect(official.entries[1].classificationStatus).toBe('CLASSIFIED')
    expect(official.entries[1].pointsAwarded).toBe(14) // P2 Faixa 3
  })

  // ALLDNF01C-11: pontos de piloto são adicionados ao Driver Championship
  it('ALLDNF01C-11: pontos de piloto são adicionados ao Driver Championship pelo pipeline canônico', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 21, // 20 voltas = 33.33% (Faixa 2: P1=13, P2=10)
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 20
          d.raceTime = 1800 + idx * 5
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)
    const reg = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    expect(reg.success).toBe(true)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const p1Driver = standings.driverStandings.find(
      (d) => d.driverId === official.entries[0].driverId,
    )
    expect(p1Driver).toBeDefined()
    expect(p1Driver!.points).toBe(13) // Recebeu exatamente os 13 pts da Faixa 2
  })

  // ALLDNF01C-12: pontos dos dois pilotos são somados corretamente ao Constructor Championship
  it('ALLDNF01C-12: pontos dos dois pilotos são somados corretamente ao Constructor Championship', () => {
    // Equipe 1 tem P1 (13 pts) e P2 (10 pts) -> esperado: 23 pts no construtores
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 21,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 20
          d.raceTime = 1800 + idx * 5
          // drv_01 e drv_02 pertencem a team_01
          if (idx === 0) {
            d.driverId = 'drv_01'
            d.teamId = 'team_01'
            d.teamName = 'Team 1'
          } else if (idx === 1) {
            d.driverId = 'drv_02'
            d.teamId = 'team_01'
            d.teamName = 'Team 1'
          }
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const team1 = standings.constructorStandings.find((c) => c.teamId === 'team_01')
    expect(team1).toBeDefined()
    expect(team1!.points).toBe(13 + 10) // 23 pontos somados fielmente
  })

  // ALLDNF01C-13: NC não contribui para Constructor Championship
  it('ALLDNF01C-13: piloto NC não contribui para Constructor Championship (0 pts somados)', () => {
    // drv_01 = P1 (13 pts), drv_02 = P4 com voltas insuficientes (<36 laps com líder 40 -> NC)
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 41,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          if (idx === 0) {
            d.driverId = 'drv_01'
            d.teamId = 'team_01'
            d.lap = 40
            d.raceTime = 3000
          } else if (idx === 1) {
            d.driverId = 'drv_02'
            d.teamId = 'team_01'
            d.lap = 35 // < 36 -> NC
            d.raceTime = 3005
          } else {
            d.lap = 35
            d.raceTime = 3010 + idx
          }
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    // P1 (Faixa 3 >=50% e <75% -> 19 pts). drv_02 é NC -> 0 pts.
    const standings = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const team1 = standings.constructorStandings.find((c) => c.teamId === 'team_01')
    expect(team1).toBeDefined()
    expect(team1!.points).toBe(19) // Apenas os 19 pts de P1
  })

  // ALLDNF01C-14: resultado oficial preserva pointsAwarded ou fonte equivalente
  it('ALLDNF01C-14: resultado oficial preserva pointsAwarded de forma imutável', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 11,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 10
          d.raceTime = 900 + idx
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    expect(official.entries[0].pointsAwarded).toBe(6)
    expect(official.entries[4].pointsAwarded).toBe(1)
    expect(official.entries[5].pointsAwarded).toBe(0)
    expect(resultService.verifyResultIntegrity(official)).toBe(true)
  })

  // ALLDNF01C-15: save/reload preserva pontuação oficial
  it('ALLDNF01C-15: save e reload preservam intacta a pontuação oficial', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 16,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 15
          d.raceTime = 1350 + idx
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)
    resultService.saveOfficialRaceResult(official, true)

    const reloaded = resultService.loadOfficialResult(careerId, season, raceId)
    expect(reloaded).not.toBeNull()
    expect(reloaded!.entries[0].pointsAwarded).toBe(13) // Faixa 2: 15/60 = 25%
    expect(reloaded!.entries[1].pointsAwarded).toBe(10)
    expect(reloaded!.entries[9].pointsAwarded).toBe(0)
  })

  // ALLDNF01C-16: oficializar duas vezes não duplica Driver points
  it('ALLDNF01C-16: registrar/oficializar duas vezes não duplica Driver points', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 21,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 20
          d.raceTime = 1800 + idx
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    // Primeira aplicação
    const reg1 = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    expect(reg1.success).toBe(true)
    const st1 = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const ptsAfterFirst = st1.driverStandings[0].points

    // Segunda aplicação (mesmo resultado/round)
    const reg2 = canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    expect(reg2.success).toBe(true)
    expect(reg2.alreadyRegistered).toBe(true)
    const st2 = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const ptsAfterSecond = st2.driverStandings[0].points

    expect(ptsAfterSecond).toBe(ptsAfterFirst)
  })

  // ALLDNF01C-17: oficializar duas vezes não duplica Constructor points
  it('ALLDNF01C-17: registrar/oficializar duas vezes não duplica Constructor points', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 21,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 20
          d.raceTime = 1800 + idx
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    const st1 = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const teamPts1 = st1.constructorStandings[0].points

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    const st2 = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const teamPts2 = st2.constructorStandings[0].points

    expect(teamPts2).toBe(teamPts1)
  })

  // ALLDNF01C-18: oficializar duas vezes não duplica wins/podiums/race count/history-results
  it('ALLDNF01C-18: oficializar duas vezes não duplica wins, podiums e race count', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 21,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 20
          d.raceTime = 1800 + idx
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const st = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    const winner = st.driverStandings[0]
    expect(winner.wins).toBe(1)
    expect(winner.podiums).toBe(1)
    expect(winner.racesCounted).toBe(1)
  })

  // ALLDNF01C-19: abrir/recarregar resultado não dispara nova pontuação
  it('ALLDNF01C-19: carregar resultado oficial existente não dispara nova pontuação', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 21,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 20
          d.raceTime = 1800 + idx
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)
    resultService.saveOfficialRaceResult(official, true)
    canonicalCareerPersistenceService.registerOfficialRaceResultInCareer(official)

    const loaded1 = resultService.loadOfficialResult(careerId, season, raceId)
    const loaded2 = resultService.loadOfficialResult(careerId, season, raceId)

    expect(loaded1!.entries[0].pointsAwarded).toBe(loaded2!.entries[0].pointsAwarded)
    const st = canonicalChampionshipService.getChampionshipStandings(careerId, season, round)
    expect(st.driverStandings[0].points).toBe(13)
  })

  // ALLDNF01C-20: corrida normal completa continua recebendo pontuação integral correta
  it('ALLDNF01C-20: corrida normal completa continua recebendo pontuação integral correta (25-18-15-12-10-8-6-4-2-1)', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 60,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'racing'
          d.isDnf = false
          d.lap = 60
          d.raceTime = 5400 + idx * 2
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const fullPoints = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    fullPoints.forEach((expectedPts, idx) => {
      expect(official.entries[idx].pointsAwarded).toBe(expectedPts)
    })
    expect(official.entries[10].pointsAwarded).toBe(0)
  })
})
