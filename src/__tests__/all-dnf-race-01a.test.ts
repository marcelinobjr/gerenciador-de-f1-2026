import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { CanonicalRaceState, CanonicalRaceDriverState } from '@/types/canonical-race-v2'

describe('ALL-DNF-RACE-01A — Micro-hotfix Stop Race Simulation when activeCars === 0', () => {
  let engine: CanonicalRaceEngineService

  const careerId = 'career_alldnf_01a'
  const season = 2026
  const round = 1
  const raceId = 'gp_alldnf_01a'

  beforeEach(() => {
    engine = new CanonicalRaceEngineService()
  })

  /**
   * Fixture controlada:
   * 20 carros, totalLaps = 58, currentLap = 34
   */
  function createControlledFixture(options?: {
    activeCarsCount?: number
    currentLap?: number
    totalLaps?: number
  }): CanonicalRaceState {
    const totalLaps = options?.totalLaps ?? 58
    const currentLap = options?.currentLap ?? 34
    const activeCarsCount = options?.activeCarsCount ?? 0

    const drivers: CanonicalRaceDriverState[] = Array.from({ length: 24 }, (_, i) => {
      const pos = i + 1
      const isCarActive = i < activeCarsCount
      return {
        careerId,
        season,
        raceId,
        driverId: `drv_${pos.toString().padStart(2, '0')}`,
        teamId: `team_${Math.floor(i / 2) + 1}`,
        driverName: `Driver ${pos}`,
        teamName: `Team ${Math.floor(i / 2) + 1}`,
        teamColor: '#00D2BE',
        gridPosition: pos,
        currentPosition: pos,
        lap: 34,
        raceTime: 3400 + i,
        gap: pos === 1 ? 'LÍDER' : '+0.000s',
        tyreCompound: 'medio',
        tyreAge: 10,
        fuel: 50,
        carCondition: 90,
        raceStatus: isCarActive ? 'racing' : 'dnf',
        isDnf: !isCarActive,
        dnfReason: !isCarActive ? 'Falha Mecânica' : undefined,
        dnfLap: !isCarActive ? 34 : undefined,
        pitStops: 1,
        isPlayer: pos <= 2,
      }
    })

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
      playerTeamId: 'team_1',
      tactics: {},
      paceOrders: {},
      revision: 1,
      updatedAt: new Date().toISOString(),
      events: [],
    }
  }

  // ALLDNF01A-01: activeCars > 0 → runner continua normalmente.
  it('ALLDNF01A-01: activeCars > 0 -> runner continua normalmente', () => {
    // 20 carros ativos (ou 24 ativos)
    const state = createControlledFixture({ activeCarsCount: 20, currentLap: 34, totalLaps: 58 })
    const activeBefore = state.drivers.filter(
      (d) => d.raceStatus !== 'dnf' && !d.isDnf && d.raceStatus !== 'finished',
    ).length
    expect(activeBefore).toBe(20)

    const nextState = engine.advanceOneLap(state, { persistState: false })

    // Runner continuou e avançou de volta
    expect(nextState.currentLap).toBe(35)
    expect(nextState.status).not.toBe('completed')
    expect(nextState.raceControl?.currentFlag).not.toBe('FINISHED')
  })

  // ALLDNF01A-02: activeCars = 0 → runner encerra.
  it('ALLDNF01A-02: activeCars = 0 -> runner encerra', () => {
    // Fixture: totalLaps = 58, currentLap = 34, 20/24 carros todos DNF, activeCars = 0
    const state = createControlledFixture({ activeCarsCount: 0, currentLap: 34, totalLaps: 58 })
    const activeBefore = state.drivers.filter(
      (d) => d.raceStatus !== 'dnf' && !d.isDnf && d.raceStatus !== 'finished',
    ).length
    expect(activeBefore).toBe(0)

    const nextState = engine.advanceOneLap(state, { persistState: false })

    expect(nextState.status).toBe('completed')
    expect(nextState.raceControl?.currentFlag).toBe('FINISHED')
  })

  // ALLDNF01A-03: após activeCars = 0 → currentLap não incrementa novamente.
  it('ALLDNF01A-03: apos activeCars = 0 -> currentLap nao incrementa novamente', () => {
    const state = createControlledFixture({ activeCarsCount: 0, currentLap: 34, totalLaps: 58 })

    // Executa próximo tick/step
    const finishedState = engine.advanceOneLap(state, { persistState: false })
    expect(finishedState.status).toBe('completed')
    expect(finishedState.currentLap).toBe(34) // Não processou volta 35

    // Tentar avançar mais ticks/voltas no estado encerrado
    const nextTick1 = engine.advanceOneLap(finishedState, { persistState: false })
    expect(nextTick1.currentLap).toBe(34)
    expect(nextTick1.status).toBe('completed')

    const nextTickMultiple = engine.advanceMultipleLaps(finishedState, 5, { persistState: false })
    expect(nextTickMultiple.currentLap).toBe(34)
    expect(nextTickMultiple.status).toBe('completed')
  })

  // ALLDNF01A-04: nenhum carro DNF é reativado.
  it('ALLDNF01A-04: nenhum carro DNF e reativado', () => {
    const state = createControlledFixture({ activeCarsCount: 0, currentLap: 34, totalLaps: 58 })
    const finishedState = engine.advanceOneLap(state, { persistState: false })

    // Nenhum carro deve voltar para racing ou ter isDnf false
    finishedState.drivers.forEach((driver) => {
      expect(driver.isDnf).toBe(true)
      expect(driver.raceStatus).toBe('dnf')
    })

    const activeAfter = finishedState.drivers.filter(
      (d) => d.raceStatus !== 'dnf' && !d.isDnf && d.raceStatus !== 'finished',
    ).length
    expect(activeAfter).toBe(0)
  })

  // ALLDNF01A-05: o estado final registra que a simulação foi encerrada.
  it('ALLDNF01A-05: o estado final registra que a simulacao foi encerrada', () => {
    const state = createControlledFixture({ activeCarsCount: 0, currentLap: 34, totalLaps: 58 })
    const finishedState = engine.advanceOneLap(state, { persistState: false })

    expect(finishedState.status).toBe('completed')
    expect(finishedState.completedAt).toBeDefined()
    expect(typeof finishedState.completedAt).toBe('string')
    expect(finishedState.raceControl?.currentFlag).toBe('FINISHED')
    expect(finishedState.currentLap).toBe(34)
  })
})
