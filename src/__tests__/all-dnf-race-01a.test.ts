import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { CanonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

describe('ALL-DNF-RACE-01A — Hotfix de loop e encerramento All-DNF', () => {
  let engine: CanonicalRaceEngineService
  let resultService: CanonicalRaceResultService

  const careerId = 'test_career_alldnf_01a'
  const season = 2026
  const round = 1
  const raceId = 'test_gp_alldnf_01a'

  beforeEach(() => {
    engine = new CanonicalRaceEngineService()
    resultService = new CanonicalRaceResultService()
    resultService.clearOfficialRaceResultForTesting(careerId, season, round)
    canonicalChampionshipService.clearSnapshotsForTesting(careerId, season, round)
  })

  function createMockRaceState(options?: {
    totalLaps?: number
    currentLap?: number
    status?: CanonicalRaceState['status']
    setupDrivers?: (drivers: CanonicalRaceDriverState[]) => void
  }): CanonicalRaceState {
    const totalLaps = options?.totalLaps ?? 50
    const currentLap = options?.currentLap ?? 1
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
      status,
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

  // DNF01: corrida iniciada com ativos continua normalmente
  it('DNF01: corrida iniciada com carros ativos continua e avança', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 5,
      status: 'running',
    })

    const nextState = engine.advanceOneLap(state, { persistState: false })
    expect(nextState.status).toBe('running')
    expect(nextState.currentLap).toBe(6)
  })

  // DNF02: último abandono -> 0 ativos e encerra no mesmo tick
  it('DNF02: último abandono -> 0 ativos encerra no mesmo tick com status completed', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 10,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 10
          d.raceTime = 1000 + idx
          d.dnfReason = 'Colisão'
        })
      },
    })

    const nextState = engine.advanceOneLap(state, { persistState: false })
    expect(nextState.status).toBe('completed')
    expect(nextState.raceControl?.currentFlag).toBe('FINISHED')
  })

  // DNF03: nenhuma volta nova após 0 ativos
  it('DNF03: nenhuma volta nova é processada após 0 ativos', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 12,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 12
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })
    expect(endedState.status).toBe('completed')
    const lapWhenEnded = endedState.currentLap

    const subsequent = engine.advanceOneLap(endedState, { persistState: false })
    expect(subsequent.currentLap).toBe(lapWhenEnded)
    expect(subsequent.status).toBe('completed')
  })

  // DNF04: nenhum novo consumo/degradação após encerramento All-DNF
  it('DNF04: nenhum novo consumo de combustível ou degradação de pneu ocorre após 0 ativos', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 15,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 15
          d.fuel = 75.5
          d.tyreAge = 15
          d.carCondition = 88.0
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })
    const subsequent = engine.advanceOneLap(endedState, { persistState: false })

    subsequent.drivers.forEach((d) => {
      expect(d.fuel).toBe(75.5)
      expect(d.tyreAge).toBe(15)
      expect(d.carCondition).toBe(88.0)
    })
  })

  // DNF05: pré-largada vazia não dispara All-DNF erroneamente
  it('DNF05: estado pré-largada sem pilotos ou não hidratado não encerra prematuramente', () => {
    const unhydratedState: CanonicalRaceState = {
      version: '2.0',
      careerId,
      season,
      round,
      raceId,
      circuitName: 'Silverstone',
      circuitCountry: 'GBR',
      totalLaps: 50,
      currentLap: 1,
      status: 'not_started',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      weather: 'seco',
      simSpeed: 1,
      drivers: [],
      driverLookup: {},
      playerTeamId: 'team_01',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      events: [],
    }

    const res = engine.advanceOneLap(unhydratedState, { persistState: false })
    // Com 0 drivers, não deve virar completed nem disparar finish
    expect(res.status).not.toBe('completed')
  })

  // DNF06: 1 ativo continua corrida
  it('DNF06: com 1 carro ativo e 23 DNF, a corrida continua', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 20,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          if (idx > 0) {
            d.raceStatus = 'dnf'
            d.isDnf = true
            d.lap = 19
          } else {
            d.raceStatus = 'racing'
            d.isDnf = false
            d.lap = 19
          }
        })
      },
    })

    const nextState = engine.advanceOneLap(state, { persistState: false })
    expect(nextState.status).toBe('running')
    const active = nextState.drivers.filter(
      (d) => d.raceStatus !== 'dnf' && !d.isDnf && d.raceStatus !== 'finished',
    )
    expect(active.length).toBe(1)
  })

  // DNF07: encerramento chamado exatamente 1x
  it('DNF07: encerramento e oficialização podem ser chamados com consistência única', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 25,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 25
          d.raceTime = 2000 + idx
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })
    expect(endedState.status).toBe('completed')

    const official1 = resultService.officializeRace(endedState)
    const official2 = resultService.officializeRace(endedState)
    expect(official1.officialResultId).toBe(official2.officialResultId)
    expect(official1.resultHash).toBe(official2.resultHash)
  })

  // DNF08: reload não re-encerra (validação de idempotência)
  it('DNF08: reload recupera resultado oficial sem duplicar encerramento', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 30,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 30
          d.raceTime = 2500 + idx
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.officializeRace(endedState)

    const reloaded = resultService.getOfficialRaceResult(careerId, season, round)
    expect(reloaded).not.toBeNull()
    expect(reloaded?.officialResultId).toBe(official.officialResultId)
    expect(reloaded?.entries.length).toBe(24)
  })

  // DNF09: classificação acumulada preservada
  it('DNF09: classificação acumulada é preservada pelas voltas e tempo acumulado', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 35,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Piloto 0 tem 34 voltas, piloto 1 tem 33 voltas, outros têm 30 voltas
          d.lap = idx === 0 ? 34 : idx === 1 ? 33 : 30
          d.raceTime = 3000 + idx
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(endedState)

    expect(official.entries[0].driverId).toBe('drv_01')
    expect(official.entries[0].finalPosition).toBe(1)
    expect(official.entries[1].driverId).toBe('drv_02')
    expect(official.entries[1].finalPosition).toBe(2)
  })

  // DNF10: sem hardcode de vencedor
  it('DNF10: não há hardcode de vencedor (o piloto com melhor progresso esportivo lidera)', () => {
    const state = createMockRaceState({
      totalLaps: 50,
      currentLap: 35,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Último piloto do grid completou mais voltas antes de abandonar
          d.lap = idx === 23 ? 35 : 20
          d.raceTime = 2500 + idx
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(endedState)

    expect(official.entries[0].driverId).toBe('drv_24')
    expect(official.entries[0].finalPosition).toBe(1)
  })

  // DNF11: regra FIA 90% inalterada
  it('DNF11: regra FIA 90% inalterada (piloto com <90% das voltas do líder DNF fica NOT_CLASSIFIED)', () => {
    const state = createMockRaceState({
      totalLaps: 60,
      currentLap: 40,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          // Líder com 40 voltas -> 90% = 36 voltas
          // idx 0 -> 40 (CLASSIFIED)
          // idx 1 -> 36 (CLASSIFIED)
          // idx 2 -> 35 (NOT_CLASSIFIED)
          d.lap = idx === 0 ? 40 : idx === 1 ? 36 : 35
          d.raceTime = 3200 + idx
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })
    const official = resultService.createOfficialRaceResult(endedState)

    const p1 = official.entries.find((e) => e.driverId === 'drv_01')
    const p2 = official.entries.find((e) => e.driverId === 'drv_02')
    const p3 = official.entries.find((e) => e.driverId === 'drv_03')

    expect((p1 as any).classificationStatus).toBe('CLASSIFIED')
    expect((p2 as any).classificationStatus).toBe('CLASSIFIED')
    expect((p3 as any).classificationStatus).toBe('NOT_CLASSIFIED')
  })

  // DNF12: corrida normal com chegada funciona como antes
  it('DNF12: corrida normal com chegada funciona como antes (vencedor conclui totalLaps)', () => {
    const state = createMockRaceState({
      totalLaps: 10,
      currentLap: 10,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'racing'
          d.isDnf = false
          d.lap = 9
          d.raceTime = 900 + idx
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })
    expect(endedState.status).toBe('completed')
    expect(endedState.raceControl?.currentFlag).toBe('FINISHED')
    const finishers = endedState.drivers.filter((d) => d.raceStatus === 'finished')
    expect(finishers.length).toBeGreaterThan(0)
  })
})
