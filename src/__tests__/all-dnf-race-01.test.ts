import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { CanonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { calculateFiaPoints } from '@/lib/f1-standings-calculator'
import { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

describe('ALLDNF01 — Encerramento e Classificação All-DNF (Regra FIA 2026)', () => {
  let engine: CanonicalRaceEngineService
  let resultService: CanonicalRaceResultService
  let initService: typeof canonicalRaceInitializationService

  const careerId = 'test_career_alldnf'
  const season = 2026
  const round = 1
  const raceId = 'test_gp_alldnf'

  beforeEach(() => {
    engine = new CanonicalRaceEngineService()
    resultService = new CanonicalRaceResultService()
    initService = canonicalRaceInitializationService
    resultService.clearOfficialRaceResultForTesting(careerId, season, round)
    canonicalChampionshipService.clearSnapshotsForTesting(careerId, season, round)
  })

  function createMockRaceState(options?: {
    totalLaps?: number
    currentLap?: number
    setupDrivers?: (drivers: CanonicalRaceDriverState[]) => void
  }): CanonicalRaceState {
    const totalLaps = options?.totalLaps ?? 60
    const currentLap = options?.currentLap ?? 1
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
        lap: 0,
        raceTime: 0,
        gap: pos === 1 ? 'LÍDER' : '+0.000s',
        tyreCompound: 'medio',
        tyreAge: 0,
        fuel: 100,
        carCondition: 100,
        raceStatus: 'racing',
        pitStops: 0,
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
      status: 'running',
      safetyCarActive: false,
      vscActive: false,
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
      events: [],
    }
  }

  // -01 todos DNF -> corrida termina
  it('ALLDNF01-01: todos DNF -> corrida termina com status completed', () => {
    const state = createMockRaceState({
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 10
          d.raceTime = 1000 + idx
          d.dnfReason = 'Motor Quebrado'
        })
      },
    })

    const nextState = engine.advanceOneLap(state, { persistState: false })
    expect(nextState.status).toBe('completed')
    expect(nextState.raceControl?.currentFlag).toBe('FINISHED')
  })

  // -02 nenhuma volta adicional é processada após activeCars = 0
  it('ALLDNF01-02: nenhuma volta adicional é processada após activeCars = 0', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 15,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 14
          d.raceTime = 1200 + idx
        })
      },
    })

    const finished = engine.advanceOneLap(state, { persistState: false })
    expect(finished.status).toBe('completed')
    const lapAtFinish = finished.currentLap

    // Tentativa de avançar mais voltas não deve alterar a volta
    const nextTry = engine.advanceOneLap(finished, { persistState: false })
    expect(nextTry.currentLap).toBe(lapAtFinish)
    expect(nextTry.status).toBe('completed')
  })

  // -03 classificação usa voltas completas
  it('ALLDNF01-03: classificação usa voltas completas', () => {
    const state = createMockRaceState({
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Motorista com maior índice tem mais voltas completadas
          d.lap = idx + 1
          d.raceTime = 1000 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    // Piloto com 24 voltas (drv_24) deve estar em P1
    expect(official.entries[0].driverId).toBe('drv_24')
    expect(official.entries[0].lapsCompleted).toBe(24)
    expect(official.entries[0].finalPosition).toBe(1)
  })

  // -04 empate em voltas usa ordem de linha (raceTime menor)
  it('ALLDNF01-04: empate em voltas usa ordem em que cruzaram a linha (raceTime)', () => {
    const state = createMockRaceState({
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 20
          // drv_05 cruzou antes (raceTime menor)
          d.raceTime = idx === 4 ? 1500 : 1600 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    expect(official.entries[0].driverId).toBe('drv_05')
    expect(official.entries[0].finalPosition).toBe(1)
  })

  // -05 DNF pode permanecer classified
  it('ALLDNF01-05: DNF pode permanecer classified preservando status dnf e classificationStatus CLASSIFIED', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Líder com 40 voltas, piloto 2 com 38 voltas (ambos >= 90% = 36 voltas)
          d.lap = idx === 0 ? 40 : idx === 1 ? 38 : 20
          d.raceTime = 2000 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const entry1 = official.entries[0]
    const entry2 = official.entries[1]

    // Status de chegada permanece dnf, sem converter para finished
    expect(entry1.dnf).toBe(true)
    expect(entry1.status).toBe('dnf')
    expect((entry1 as any).classificationStatus).toBe('CLASSIFIED')

    expect(entry2.dnf).toBe(true)
    expect(entry2.status).toBe('dnf')
    expect((entry2 as any).classificationStatus).toBe('CLASSIFIED')
  })

  // -06 <90% -> NC / NOT_CLASSIFIED
  it('ALLDNF01-06: piloto com menos de 90% das voltas do vencedor é NC', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Líder com 40 voltas -> 90% = 36 voltas.
          // Piloto 4 com 35 voltas -> NC
          d.lap = idx === 0 ? 40 : idx === 1 ? 38 : idx === 2 ? 36 : 35
          d.raceTime = 2500 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const ncEntry = official.entries.find((e) => e.lapsCompleted === 35)
    expect(ncEntry).toBeDefined()
    expect((ncEntry as any).classificationStatus).toBe('NOT_CLASSIFIED')
  })

  // -07 >=90% -> classified
  it('ALLDNF01-07: piloto com >= 90% das voltas do vencedor é CLASSIFIED', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Líder com 40 voltas -> 90% = 36.
          // Piloto com 36 voltas exatamente -> CLASSIFIED
          d.lap = idx === 0 ? 40 : idx === 1 ? 36 : 30
          d.raceTime = 2500 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const classifiedEntry = official.entries.find((e) => e.lapsCompleted === 36)
    expect(classifiedEntry).toBeDefined()
    expect((classifiedEntry as any).classificationStatus).toBe('CLASSIFIED')
  })

  // -08 menos de 2 voltas válidas -> 0 pontos
  it('ALLDNF01-08: menos de 2 voltas válidas -> 0 pontos', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 1 // Apenas 1 volta completada
          d.raceTime = 90 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    official.entries.forEach((entry) => {
      expect(entry.pointsAwarded).toBe(0)
    })
  })

  // -09 2L–<25% usa tabela reduzida correta (6, 4, 3, 2, 1)
  it('ALLDNF01-09: 2L a <25% de distância usa tabela reduzida FIA (P1=6, P2=4, P3=3, P4=2, P5=1)', () => {
    const totalLaps = 60
    const leaderLaps = 12 // 12 / 60 = 20% (< 25%)
    const state = createMockRaceState({
      totalLaps,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Todos completaram 12 voltas (>= 90% de 12 = 10 voltas)
          d.lap = leaderLaps
          d.raceTime = 1000 + idx
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
  })

  // -10 25–<50% correta (13, 10, 8, 6, 5, 4, 3, 2, 1)
  it('ALLDNF01-10: 25% a <50% de distância usa tabela reduzida FIA (Top 9)', () => {
    const totalLaps = 60
    const leaderLaps = 24 // 24 / 60 = 40%
    const state = createMockRaceState({
      totalLaps,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = leaderLaps
          d.raceTime = 2000 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    const expectedPoints = [13, 10, 8, 6, 5, 4, 3, 2, 1, 0]
    expectedPoints.forEach((pts, idx) => {
      expect(official.entries[idx].pointsAwarded).toBe(pts)
    })
  })

  // -11 50–<75% correta (19, 14, 12, 10, 8, 6, 5, 4, 3, 2, 1)
  it('ALLDNF01-11: 50% a <75% de distância usa tabela reduzida FIA (Top 10)', () => {
    const totalLaps = 60
    const leaderLaps = 40 // 40 / 60 = 66.6%
    const state = createMockRaceState({
      totalLaps,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = leaderLaps
          d.raceTime = 3000 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    // FIA_REDUCED_POINTS_75: [19, 14, 12, 10, 8, 6, 5, 3, 2, 1]
    const p1 = official.entries[0].pointsAwarded
    const p2 = official.entries[1].pointsAwarded
    const p10 = official.entries[9].pointsAwarded
    const p11 = official.entries[10].pointsAwarded

    expect(p1).toBe(19)
    expect(p2).toBe(14)
    expect(p10).toBe(1)
    expect(p11).toBe(0)
  })

  // -12 >=75% tabela integral (25, 18, 15, 12, 10, 8, 6, 4, 2, 1)
  it('ALLDNF01-12: >=75% de distância usa tabela integral de pontos FIA', () => {
    const totalLaps = 60
    const leaderLaps = 47 // 47 / 60 = 78.3%
    const state = createMockRaceState({
      totalLaps,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = leaderLaps
          d.raceTime = 4000 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    expect(official.entries[0].pointsAwarded).toBe(25)
    expect(official.entries[1].pointsAwarded).toBe(18)
    expect(official.entries[9].pointsAwarded).toBe(1)
    expect(official.entries[10].pointsAwarded).toBe(0)
  })

  // -13 zero voltas completas não inventa vencedor pela grid
  it('ALLDNF01-13: zero voltas completas não inventa vencedor pela grid; pontuação = 0', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 1,
      setupDrivers: (drivers) => {
        drivers.forEach((d) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 0 // Nenhuma volta completada por ninguém
          d.raceTime = 0
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(finished)

    official.entries.forEach((e) => {
      expect(e.pointsAwarded).toBe(0)
      expect((e as any).classificationStatus).toBe('NOT_CLASSIFIED')
    })
  })

  // -14 championship recebe resultado uma vez
  it('ALLDNF01-14: championship recebe resultado da corrida All-DNF uma única vez', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 50
          d.raceTime = 4000 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.officializeRace(finished)

    const snap1 = canonicalChampionshipService.processAndPersistRoundChampionship(
      careerId,
      season,
      round,
      'team_01',
    )
    const pts1 = snap1.driverStandings.find(
      (d) => d.driverId === official.entries[0].driverId,
    )?.points

    // Repetir a chamada
    const snap2 = canonicalChampionshipService.processAndPersistRoundChampionship(
      careerId,
      season,
      round,
      'team_01',
    )
    const pts2 = snap2.driverStandings.find(
      (d) => d.driverId === official.entries[0].driverId,
    )?.points

    expect(pts1).toBe(25)
    expect(pts2).toBe(25)
  })

  // -15 save/reload preserva classificação
  it('ALLDNF01-15: save e reload preservam classificação intacta de All-DNF', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = idx === 0 ? 45 : 30
          d.raceTime = 3500 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.officializeRace(finished)

    const reloaded = resultService.getOfficialRaceResult(careerId, season, round)
    expect(reloaded).not.toBeNull()
    expect(reloaded?.entries[0].driverId).toBe(official.entries[0].driverId)
    expect(reloaded?.entries[0].finalPosition).toBe(1)
    expect(resultService.verifyResultIntegrity(reloaded!)).toBe(true)
  })

  // -16 finalização idempotente
  it('ALLDNF01-16: finalização All-DNF é estritamente idempotente', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 40
          d.raceTime = 3000 + idx
        })
      },
    })
    const finished = engine.advanceOneLap(state, { persistState: false })
    const res1 = resultService.officializeRace(finished)
    const res2 = resultService.officializeRace(finished)

    expect(res1.resultHash).toBe(res2.resultHash)
    expect(res1.officialResultId).toBe(res2.officialResultId)
    expect(res1.entries[0].pointsAwarded).toBe(res2.entries[0].pointsAwarded)
  })
})
