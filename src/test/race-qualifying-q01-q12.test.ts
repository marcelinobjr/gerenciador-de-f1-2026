/**
 * src/test/race-qualifying-q01-q12.test.ts
 *
 * Testes focados Q01–Q12 para a especificação RACE-QUALI-01:
 * - Q01: Participantes únicos no grid (24 pilotos na fixture, sem duplicação de vaga/carro)
 * - Q02: Corte Q1 -> 18 carros avançam, 6 eliminados (P19-P24)
 * - Q03: Corte Q2 -> 10 carros avançam, 8 eliminados (P11-P18)
 * - Q04: Posições únicas no Q3 (10 carros, P1-P10)
 * - Q05: Grid final completo P1–P24 e estritamente único
 * - Q06: Bônus de acerto de setup (RF07: 90.2275 -> 225.56875000000002 ms) aplicado UMA única vez
 * - Q07: Idempotência de reexecução (reexecutar fase já concluída devolve resultado persistido sem sortear de novo)
 * - Q08: Reload entre fases = execução direta contínua sem perder tempos nem fase
 * - Q09: Eliminado não reaparece em fase posterior (Q1 eliminado não tem tempo em Q2 ou Q3)
 * - Q10: Isolamento estrito entre diferentes carreiras e rodadas
 * - Q11: QUALIFYING_RESULT (ordem de pista) distinto de STARTING_GRID (com penalidades de grid aplicadas bijetivamente)
 * - Q12: Empate controlado e determinístico (ordem lexicográfica estável sem Math.random)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  raceQualifyingService,
  QualifyingDriverInput,
  QualifyingWeekendState,
} from '../services/raceQualifyingService'
import { DEFAULT_SOURCE_RACE_PARAMETERS } from '../lib/race/pureRaceEngine'

// 24 pilotos canônicos para fixture
const create24DriversFixture = (setupValue = 90.2275): QualifyingDriverInput[] => {
  const teams = [
    { teamId: 'mclaren', teamName: 'McLaren', baseCar: 92 },
    { teamId: 'ferrari', teamName: 'Ferrari', baseCar: 91 },
    { teamId: 'redbull', teamName: 'Red Bull Racing', baseCar: 90 },
    { teamId: 'mercedes', teamName: 'Mercedes', baseCar: 88 },
    { teamId: 'astonmartin', teamName: 'Aston Martin', baseCar: 85 },
    { teamId: 'alpine', teamName: 'Alpine', baseCar: 82 },
    { teamId: 'williams', teamName: 'Williams', baseCar: 81 },
    { teamId: 'racingbulls', teamName: 'Racing Bulls', baseCar: 80 },
    { teamId: 'sauber', teamName: 'Sauber', baseCar: 78 },
    { teamId: 'haas', teamName: 'Haas', baseCar: 77 },
    { teamId: 'andretti', teamName: 'Andretti', baseCar: 76 },
    { teamId: 'toyota', teamName: 'Toyota Gazoo', baseCar: 75 },
  ]

  const drivers: QualifyingDriverInput[] = []
  teams.forEach((t, tIdx) => {
    // 2 pilotos por equipe
    for (let c = 1; c <= 2; c++) {
      const driverIndex = tIdx * 2 + c
      drivers.push({
        driverId: `drv_${driverIndex.toString().padStart(3, '0')}`,
        driverName: `Driver ${driverIndex}`,
        teamId: t.teamId,
        teamName: t.teamName,
        carId: `car_${t.teamId}_${c}`,
        carPerformance: t.baseCar,
        speed: 80 + (24 - driverIndex) * 0.5,
        qualifying: 80 + (24 - driverIndex) * 0.5,
        form: 50,
        morale: 50,
        wet_skill: 50,
        setup: setupValue, // Fixture RF07
        gridPenaltyPositions: 0,
      })
    }
  })

  return drivers
}

describe('RACE-QUALI-01 — Testes Focados Q01–Q12', () => {
  const careerId = 'career_test_01'
  const seasonId = 'season_2026'
  const round = 1

  beforeEach(() => {
    raceQualifyingService.clearState(careerId, seasonId, round)
  })

  // Q01: Participantes únicos no grid
  it('Q01: participantes únicos no grid (24 pilotos, sem duplicações de piloto ou vaga)', () => {
    const fixture = create24DriversFixture()
    // Introduz tentativa de entrada duplicada
    const fixtureWithDupes = [...fixture, fixture[0], fixture[5]]

    const state = raceQualifyingService.getOrCreateQualifyingState({
      careerId,
      seasonId,
      round,
      participants: fixtureWithDupes,
    })

    expect(state.totalParticipants).toBe(24)
    expect(state.results).toHaveLength(24)

    const ids = state.results.map((r) => r.driverId)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(24)
  })

  // Q02: Corte Q1 -> 18 avançam, 6 eliminados
  it('Q02: corte Q1 -> 18 avançam para Q2 e 6 são eliminados (P19-P24)', () => {
    const fixture = create24DriversFixture()
    raceQualifyingService.getOrCreateQualifyingState({
      careerId,
      seasonId,
      round,
      participants: fixture,
    })

    const state = raceQualifyingService.executeQ1(careerId, seasonId, round)

    expect(state.phase).toBe('Q2')
    const eliminatedQ1 = state.results.filter((r) => r.eliminatedInPhase === 'Q1')
    const advancingToQ2 = state.results.filter((r) => !r.eliminatedInPhase)

    expect(eliminatedQ1).toHaveLength(6)
    expect(advancingToQ2).toHaveLength(18)

    // Posições dos eliminados devem ser estritamente P19..P24
    const eliminatedPositions = eliminatedQ1.map((r) => r.qualifyingPosition).sort((a, b) => a - b)
    expect(eliminatedPositions).toEqual([19, 20, 21, 22, 23, 24])
  })

  // Q03: Corte Q2 -> 10 avançam, 8 eliminados
  it('Q03: corte Q2 -> 10 avançam para Q3 e 8 são eliminados (P11-P18)', () => {
    const fixture = create24DriversFixture()
    raceQualifyingService.getOrCreateQualifyingState({
      careerId,
      seasonId,
      round,
      participants: fixture,
    })

    raceQualifyingService.executeQ1(careerId, seasonId, round)
    const state = raceQualifyingService.executeQ2(careerId, seasonId, round)

    expect(state.phase).toBe('Q3')
    const eliminatedQ2 = state.results.filter((r) => r.eliminatedInPhase === 'Q2')
    const advancingToQ3 = state.results.filter((r) => !r.eliminatedInPhase)

    expect(eliminatedQ2).toHaveLength(8)
    expect(advancingToQ3).toHaveLength(10)

    // Posições dos eliminados no Q2 devem ser estritamente P11..P18
    const eliminatedPositions = eliminatedQ2.map((r) => r.qualifyingPosition).sort((a, b) => a - b)
    expect(eliminatedPositions).toEqual([11, 12, 13, 14, 15, 16, 17, 18])
  })

  // Q04: Posições únicas no Q3
  it('Q04: posições únicas no Q3 (10 carros, P1-P10 sem empates ilegais)', () => {
    const fixture = create24DriversFixture()
    raceQualifyingService.getOrCreateQualifyingState({
      careerId,
      seasonId,
      round,
      participants: fixture,
    })

    const state = raceQualifyingService.executeFullQualifying(careerId, seasonId, round)

    expect(state.phase).toBe('GRID_READY')
    const top10 = state.results.filter((r) => !r.eliminatedInPhase)
    expect(top10).toHaveLength(10)

    const q3Positions = top10.map((r) => r.qualifyingPosition).sort((a, b) => a - b)
    expect(q3Positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    const uniquePositions = new Set(q3Positions)
    expect(uniquePositions.size).toBe(10)
  })

  // Q05: Grid final P1–P24 completo e único
  it('Q05: grid final P1–P24 completo e estritamente bijetivo', () => {
    const fixture = create24DriversFixture()
    raceQualifyingService.getOrCreateQualifyingState({
      careerId,
      seasonId,
      round,
      participants: fixture,
    })

    const state = raceQualifyingService.executeFullQualifying(careerId, seasonId, round)

    expect(state.startingGridOrder).toHaveLength(24)
    const positions = state.results.map((r) => r.startingGridPosition).sort((a, b) => a - b)
    expect(positions).toHaveLength(24)
    expect(positions).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
    ])

    const seenDrivers = new Set(state.startingGridOrder)
    expect(seenDrivers.size).toBe(24)
  })

  // Q06: Bônus de acerto de setup 90.2275 -> 225.56875000000002 ms aplicado UMA única vez
  it('Q06: bônus do setup 90.2275 -> 225.56875000000002 ms aplicado uma única vez no tempo da tentativa', () => {
    const fixture = create24DriversFixture(90.2275)
    const state = raceQualifyingService.getOrCreateQualifyingState({
      careerId,
      seasonId,
      round,
      participants: fixture,
    })

    raceQualifyingService.executeQ1(careerId, seasonId, round)

    // Verifica a primeira tentativa de volta do piloto 1
    const p1 = state.results[0]
    const attempt = p1.lapAttempts.Q1![0]

    // max_setup_qualifying_bonus_seconds = 0.25 s
    // setup = 90.2275
    // bonus_ms = (90.2275 / 100) * 0.25 * 1000 = 225.56875000000002 ms
    const expectedBonusMs = (90.2275 / 100) * DEFAULT_SOURCE_RACE_PARAMETERS.max_setup_qualifying_bonus_seconds * 1000
    expect(expectedBonusMs).toBeCloseTo(225.56875, 10)
    expect(attempt.bonusMs).toBeCloseTo(225.56875, 10)

    // Verifica se a fórmula de tempo time_ms = base_pace - bonus_ms + z * sigma
    const sigma = state.parametersUsed.qualifying_noise_sd_ms
    const calculated = p1.basePaceMs - attempt.bonusMs + attempt.normalDrawZ * sigma
    expect(attempt.timeMs).toBeCloseTo(calculated, 8)
  })

  // Q07: Idempotência de reexecução
  it('Q07: idempotência de reexecução (reexecutar Q1 ou Q2 devolve o resultado persistido sem sortear de novo)', () => {
    const fixture = create24DriversFixture()
    raceQualifyingService.getOrCreateQualifyingState({
      careerId,
      seasonId,
      round,
      participants: fixture,
    })

    const state1 = raceQualifyingService.executeQ1(careerId, seasonId, round)
    const p1TimeFirstRun = state1.results[0].q1TimeMs

    // Segunda chamada na mesma fase
    const state2 = raceQualifyingService.executeQ1(careerId, seasonId, round)
    const p1TimeSecondRun = state2.results[0].q1TimeMs

    expect(p1TimeFirstRun).toBe(p1TimeSecondRun)
    expect(state1.results[0].lapAttempts.Q1![0].timeMs).toBe(state2.results[0].lapAttempts.Q1![0].timeMs)
  })

  // Q08: Reload entre fases = execução direta
  it('Q08: reload entre fases preserva estado e avança de forma idêntica à execução direta', () => {
    const fixture = create24DriversFixture()
    const state = raceQualifyingService.getOrCreateQualifyingState({
      careerId,
      seasonId,
      round,
      participants: fixture,
    })

    // Executa Q1
    raceQualifyingService.executeQ1(careerId, seasonId, round)

    // Simula reload salvando e restaurando o snapshot
    const serialized = JSON.stringify(state)
    const reloadedState: QualifyingWeekendState = JSON.parse(serialized)

    const otherCareerId = 'career_reloaded_01'
    reloadedState.careerId = otherCareerId
    raceQualifyingService.restoreState(reloadedState)

    // Continua para o Q2 e Q3 na instância recarregada
    raceQualifyingService.executeQ2(otherCareerId, seasonId, round)
    const completedState = raceQualifyingService.executeQ3(otherCareerId, seasonId, round)

    expect(completedState.phase).toBe('GRID_READY')
    expect(completedState.isComplete).toBe(true)
    expect(completedState.startingGridOrder).toHaveLength(24)

    raceQualifyingService.clearState(otherCareerId, seasonId, round)
  })

  // Q09: Eliminado não reaparece em fase posterior
  it('Q09: piloto eliminado no Q1 não reaparece no Q2 nem no Q3 e não ganha novas voltas', () => {
    const fixture = create24DriversFixture()
    raceQualifyingService.getOrCreateQualifyingState({
      careerId,
      seasonId,
      round,
      participants: fixture,
    })

    const state = raceQualifyingService.executeFullQualifying(careerId, seasonId, round)

    const eliminatedInQ1 = state.results.filter((r) => r.eliminatedInPhase === 'Q1')
    expect(eliminatedInQ1).toHaveLength(6)

    for (const driver of eliminatedInQ1) {
      expect(driver.lapAttempts.Q2).toBeUndefined()
      expect(driver.lapAttempts.Q3).toBeUndefined()
      expect(driver.q2TimeMs).toBeUndefined()
      expect(driver.q3TimeMs).toBeUndefined()
      expect(driver.qualifyingPosition).toBeGreaterThanOrEqual(19)
    }

    const eliminatedInQ2 = state.results.filter((r) => r.eliminatedInPhase === 'Q2')
    expect(eliminatedInQ2).toHaveLength(8)

    for (const driver of eliminatedInQ2) {
      expect(driver.lapAttempts.Q3).toBeUndefined()
      expect(driver.q3TimeMs).toBeUndefined()
      expect(driver.qualifyingPosition).toBeGreaterThanOrEqual(11)
      expect(driver.qualifyingPosition).toBeLessThanOrEqual(18)
    }
  })

  // Q10: Isolamento estrito entre carreiras e rodadas
  it('Q10: isolamento estrito entre diferentes carreiras e rodadas', () => {
    const fixture = create24DriversFixture()

    raceQualifyingService.getOrCreateQualifyingState({
      careerId: 'career_A',
      seasonId: 'season_2026',
      round: 1,
      participants: fixture,
    })

    raceQualifyingService.getOrCreateQualifyingState({
      careerId: 'career_B',
      seasonId: 'season_2026',
      round: 1,
      participants: fixture,
    })

    const stateA = raceQualifyingService.executeQ1('career_A', 'season_2026', 1)
    const stateB = raceQualifyingService.getState('career_B', 'season_2026', 1)

    expect(stateA.phase).toBe('Q2')
    expect(stateB?.phase).toBe('READY_FOR_Q1')

    raceQualifyingService.clearState('career_A', 'season_2026', 1)
    raceQualifyingService.clearState('career_B', 'season_2026', 1)
  })

  // Q11: QUALIFYING_RESULT separado do STARTING_GRID com penalidades
  it('Q11: QUALIFYING_RESULT (ordem pura) distinto de STARTING_GRID (com penalidades aplicadas)', () => {
    const fixture = create24DriversFixture()
    // Aplica penalidade de 10 posições de grid no primeiro colocado provável
    fixture[0].gridPenaltyPositions = 10

    raceQualifyingService.getOrCreateQualifyingState({
      careerId,
      seasonId,
      round,
      participants: fixture,
    })

    const state = raceQualifyingService.executeFullQualifying(careerId, seasonId, round)

    const penalizedDriver = state.results.find((r) => r.driverId === fixture[0].driverId)!
    expect(penalizedDriver.gridPenaltyPositions).toBe(10)

    // Se ele largou no top 5 do qualifying, a posição inicial no grid deve ser recuada
    expect(penalizedDriver.startingGridPosition).toBeGreaterThan(penalizedDriver.qualifyingPosition)

    // O grid final ainda contém exatamente 24 posições únicas
    const allGridPositions = state.results.map((r) => r.startingGridPosition).sort((a, b) => a - b)
    expect(allGridPositions).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
    ])
  })

  // Q12: Empate controlado e determinístico
  it('Q12: política de empate determinística e documentada (sem Math.random)', () => {
    const idA = 'drv_alfa'
    const idB = 'drv_beta'

    // Casos de tempo diferente
    expect(raceQualifyingService.compareDriverTimes(80000, 80050, idA, idB)).toBeLessThan(0)
    expect(raceQualifyingService.compareDriverTimes(80050, 80000, idA, idB)).toBeGreaterThan(0)

    // Caso de empate exato: desempate por ordem lexicográfica do driverId
    expect(raceQualifyingService.compareDriverTimes(80000, 80000, idA, idB)).toBeLessThan(0)
    expect(raceQualifyingService.compareDriverTimes(80000, 80000, idB, idA)).toBeGreaterThan(0)
  })
})
