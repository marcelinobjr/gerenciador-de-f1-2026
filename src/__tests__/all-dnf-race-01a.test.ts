import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { CanonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalChampionshipService } from '@/services/canonicalChampionshipService'
import { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

/**
 * HOTFIX ALL-DNF-RACE-01A — Testes Funcionais Focados
 * Suíte ALLDNF01A-01 .. ALLDNF01A-08
 *
 * Fixture canônica base: scheduledLaps=58, currentLap=34, todos DNF, activeCars=0.
 */
describe('HOTFIX ALL-DNF-RACE-01A — Encerramento de simulação com activeCars === 0', () => {
  let engine: CanonicalRaceEngineService
  let resultService: CanonicalRaceResultService

  const careerId = 'test_career_alldnf_01a_suite'
  const season = 2026
  const round = 1
  const raceId = 'test_gp_alldnf_01a_suite'

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
    const totalLaps = options?.totalLaps ?? 58
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
      circuitName: 'Albert Park',
      circuitCountry: 'AUS',
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

  // ALLDNF01A-01: Zero carros ativos -> simulação encerra imediatamente e currentLap fica travado na volta do abandono
  it('ALLDNF01A-01: com scheduledLaps=58, currentLap=34 e todos DNF, a simulação encerra e currentLap permanece 34', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 34,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 33
          d.raceTime = 3000 + idx
          d.dnfReason = 'Falha Mecânica'
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })

    expect(endedState.status).toBe('completed')
    expect(endedState.raceControl?.currentFlag).toBe('FINISHED')
    expect(endedState.currentLap).toBe(34)
  })

  // ALLDNF01A-02: NENHUM processamento da volta N+1 (sem lap tick, sem sector, sem degradação, sem consumo)
  it('ALLDNF01A-02: nenhum processamento da volta 35 ocorre quando corrida já está com activeCars === 0', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 34,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 33
          d.raceTime = 3000 + idx
          d.fuel = 50.0
          d.tyreAge = 12
          d.carCondition = 85.0
          d.dnfReason = 'Acidente'
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })
    expect(endedState.currentLap).toBe(34)

    // Tentativa subsequente de avanço na mesma corrida encerrada
    const afterNextTick = engine.advanceOneLap(endedState, { persistState: false })
    expect(afterNextTick.currentLap).toBe(34)
    expect(afterNextTick.status).toBe('completed')

    // Verificar que combustível, desgaste de pneu e condição do carro não sofreram tick
    afterNextTick.drivers.forEach((d) => {
      expect(d.fuel).toBe(50.0)
      expect(d.tyreAge).toBe(12)
      expect(d.carCondition).toBe(85.0)
      expect(d.lap).toBe(33)
    })
  })

  // ALLDNF01A-03: Com >= 1 carro ativo -> NÃO encerra por ALL-DNF
  it('ALLDNF01A-03: com 1 carro ativo e 23 DNF, a simulação NÃO encerra por ALL-DNF e avança a volta', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 34,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          if (idx === 0) {
            d.raceStatus = 'racing'
            d.isDnf = false
            d.lap = 33
          } else {
            d.raceStatus = 'dnf'
            d.isDnf = true
            d.lap = 32
            d.dnfReason = 'Colisão'
          }
        })
      },
    })

    const nextState = engine.advanceOneLap(state, { persistState: false })

    expect(nextState.status).toBe('running')
    expect(nextState.currentLap).toBe(35)
    expect(nextState.raceControl?.currentFlag).not.toBe('FINISHED')
  })

  // ALLDNF01A-04: Nenhum carro DNF/retired é reativado pelo encerramento
  it('ALLDNF01A-04: nenhum carro DNF tem seu raceStatus alterado para finished ou racing ao encerrar por ALL-DNF', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 34,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 30 + (idx % 4)
          d.dnfReason = 'Superaquecimento'
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })

    expect(endedState.status).toBe('completed')
    endedState.drivers.forEach((d) => {
      expect(d.raceStatus).toBe('dnf')
      expect(d.isDnf).toBe(true)
      expect(d.dnfReason).toBe('Superaquecimento')
    })
  })

  // ALLDNF01A-05: FINISHED não conta como ativo para reabrir ou continuar a corrida
  it('ALLDNF01A-05: carros com status finished não contam como ativos (activeCars continua 0)', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 34,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          if (idx === 0) {
            d.raceStatus = 'finished'
            d.isDnf = false
            d.lap = 34
          } else {
            d.raceStatus = 'dnf'
            d.isDnf = true
            d.lap = 30
          }
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })

    expect(endedState.status).toBe('completed')
    expect(endedState.currentLap).toBe(34)
    expect(endedState.raceControl?.currentFlag).toBe('FINISHED')
  })

  // ALLDNF01A-06: Dados acumulados preservados intactos (laps, raceTime, motivo de abandono, posição, pneus)
  it('ALLDNF01A-06: dados acumulados (lapsCompleted, raceTime, dnfReason, tyreAge, fuel, position) são preservados', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 34,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 34 - (idx % 5)
          d.raceTime = 3000 + idx * 10
          d.fuel = 45.5 - idx
          d.tyreAge = 14
          d.tyreCompound = 'duro'
          d.currentPosition = idx + 1
          d.dnfReason = `Falha componente ${idx}`
        })
      },
    })

    const endedState = engine.advanceOneLap(state, { persistState: false })

    state.drivers.forEach((original) => {
      const updated = endedState.drivers.find((d) => d.driverId === original.driverId)
      expect(updated).toBeDefined()
      expect(updated!.lap).toBe(original.lap)
      expect(updated!.raceTime).toBe(original.raceTime)
      expect(updated!.fuel).toBe(original.fuel)
      expect(updated!.tyreAge).toBe(original.tyreAge)
      expect(updated!.tyreCompound).toBe('duro')
      expect(updated!.currentPosition).toBe(original.currentPosition)
      expect(updated!.dnfReason).toBe(original.dnfReason)
    })
  })

  // ALLDNF01A-07: Idempotência de avanço em estado já completado por ALL-DNF
  it('ALLDNF01A-07: advanceOneLap em estado já completed por ALL-DNF é estritamente idempotente', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 34,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 34
          d.raceTime = 2900 + idx
          d.dnfReason = 'Bateria ERS'
        })
      },
    })

    const ended1 = engine.advanceOneLap(state, { persistState: false })
    const ended2 = engine.advanceOneLap(ended1, { persistState: false })

    expect(ended2.status).toBe('completed')
    expect(ended2.currentLap).toBe(34)
    expect(ended2.raceControl?.currentFlag).toBe('FINISHED')
    expect(ended2.drivers[0].driverId).toBe(ended1.drivers[0].driverId)
  })

  // ALLDNF01A-08: advanceMultipleLaps para imediatamente quando ocorre ALL-DNF sem processar voltas restantes
  it('ALLDNF01A-08: advanceMultipleLaps interrompe o loop no primeiro tick com activeCars === 0 sem iterar até o fim', () => {
    const state = createMockRaceState({
      totalLaps: 58,
      currentLap: 34,
      status: 'running',
      setupDrivers: (drivers) => {
        drivers.forEach((d, idx) => {
          d.raceStatus = 'dnf'
          d.isDnf = true
          d.lap = 34
          d.raceTime = 3000 + idx
        })
      },
    })

    // Solicita avançar 10 voltas
    const finalState = engine.advanceMultipleLaps(state, 10, { persistState: false })

    expect(finalState.status).toBe('completed')
    expect(finalState.currentLap).toBe(34)
    expect(finalState.raceControl?.currentFlag).toBe('FINISHED')
  })
})
