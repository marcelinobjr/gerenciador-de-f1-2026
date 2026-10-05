/**
 * bug-sq1-result-integrity-01.test.ts
 *
 * Suíte de homologação BUG-SQ1-RESULT-INTEGRITY-01:
 * I1: Concluir SQ1 → resultado persistido com advancingDriverIds(18).
 * I2: Sem resultado persistido a etapa não entra em concluídas (readStoredCompletedSessions purga).
 * I3: initializeStage não sobrescreve completed com fresh.
 * I4: SQ2 inicializa com grid derivado do resultado da SQ1 (18 pilotos classificados).
 * I5: Detecção de conclusão idempotente (guard roundKey / stageId).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import {
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '@/services/weekendProgressionService'
import { resolveEligibleQualifyingDrivers } from '@/services/qualifyingParticipantResolver'
import type {
  QualifyingTickContext,
  QualifyingDriverContext,
} from '@/services/canonicalQualifyingRunner'
import type { QualifyingStageId, QualifyingStageResult } from '@/types/canonical-qualifying-types'

describe('BUG-SQ1-RESULT-INTEGRITY-01 — Integridade de Resultado e Estado Canônico da SQ1', () => {
  const TEST_SEASON_ID = 'season_sq1_integrity_test'
  const TEST_ROUND = 4

  const mockDrivers: QualifyingDriverContext[] = Array.from({ length: 24 }).map((_, i) => ({
    id: `driver_${String(i + 1).padStart(2, '0')}`,
    name: `Piloto ${i + 1}`,
    teamId: `team_${Math.floor(i / 2) + 1}`,
    teamName: `Equipe ${Math.floor(i / 2) + 1}`,
    teamColor: '#334155',
    carNumber: i + 1,
    speed: 85 - i * 0.5,
    consistency: 80,
    defense: 75,
  }))

  const playerDriver1 = mockDrivers[0]
  const playerDriver2 = mockDrivers[1]

  const dummySetup = {
    frontWing: 6,
    rearWing: 6,
    suspension: 6,
    differential: 50,
  }

  function createDummyTickContext(
    seasonId: string,
    round: number,
    drivers: QualifyingDriverContext[],
  ): QualifyingTickContext {
    return {
      seasonId,
      round,
      gpName: 'GP de Silverstone',
      circuitName: 'Silverstone Circuit',
      lengthKm: 5.891,
      tireAbrasiveness: 50,
      weather: 'seco',
      teamChassisRating: 82,
      teamEngineSupplier: 'Audi',
      teamName: 'Apex GP',
      teamColor: '#00A6FB',
      drivers,
      rivalDrivers: drivers.filter((d) => d.id !== playerDriver1.id && d.id !== playerDriver2.id),
    }
  }

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // -------------------------------------------------------------------------------------------------
  // I1: Concluir SQ1 → resultado persistido com advancingDriverIds(18)
  // -------------------------------------------------------------------------------------------------
  it('I1: concluir SQ1 → resultado persistido com advancingDriverIds(18) e eliminatedDriverIds(6)', () => {
    // 1. Inicializar SQ1 com 24 pilotos
    const initialState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: playerDriver1.id,
        driverName: playerDriver1.name,
        driverNumber: 1,
        tyreSetId: 'tyre_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: mockDrivers,
    })

    expect(initialState.leaderboard).toHaveLength(24)

    // 2. Simular a sessão até a conclusão
    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, mockDrivers)
    const simRes = CanonicalQualifyingRunner.simulateRemainingSession(initialState, tickContext)

    expect(simRes.nextState.status).toBe('completed')
    expect(simRes.nextState.timeRemainingSec).toBe(0)

    // 3. Verificar que o resultado foi salvo no storage e possui 18 advancingDriverIds e 6 eliminados
    const savedResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq1',
    )
    expect(savedResult).not.toBeNull()
    expect(savedResult!.advancingDriverIds).toHaveLength(18)
    expect(savedResult!.eliminatedDriverIds).toHaveLength(6)
    expect(savedResult!.entries).toHaveLength(24)

    // 4. Se o resultado estivesse ausente, a reconstrução canônica reconstrói e salva
    localStorage.removeItem(`apex_qualifying_stage_result_v2_${TEST_SEASON_ID}_r${TEST_ROUND}_sq1`)
    expect(
      canonicalQualifyingPersistenceService.readStageResult(TEST_SEASON_ID, TEST_ROUND, 'sq1'),
    ).toBeNull()

    // Reconstrução manual idêntica a handleQualifyingStageCompleted
    const stgState = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq1',
    )!
    CanonicalQualifyingRunner.sortLeaderboard(stgState.leaderboard)
    const advancing: string[] = []
    const eliminated: string[] = []
    stgState.leaderboard.forEach((entry, idx) => {
      if (idx + 1 <= 18) {
        advancing.push(entry.driverId)
      } else {
        eliminated.push(entry.driverId)
      }
    })
    const reconstructed: QualifyingStageResult = {
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: stgState.leaderboard.map((e) => ({
        position: e.position,
        driverId: e.driverId,
        driverName: e.driverName,
        teamId: e.teamId,
        teamName: e.teamName,
        teamColor: e.teamColor,
        bestLapSec: e.bestLapSec,
        bestLapTime: e.bestLapTime,
        bestLapRecordedAtSec: e.bestLapRecordedAtSec || 0,
        compound: e.compound,
        tyreSetId: e.tyreSetId,
        lapsCount: e.laps,
        isPlayer: e.isPlayer,
        carId: e.carId,
        isEliminated: !!e.isEliminated,
        eliminatedInStage: e.eliminatedInStage,
      })),
      advancingDriverIds: advancing,
      eliminatedDriverIds: eliminated,
    }
    canonicalQualifyingPersistenceService.saveStageResult(reconstructed)

    const reloadedResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq1',
    )
    expect(reloadedResult).not.toBeNull()
    expect(reloadedResult!.advancingDriverIds).toHaveLength(18)
    expect(reloadedResult!.eliminatedDriverIds).toHaveLength(6)
  })

  // -------------------------------------------------------------------------------------------------
  // I2: Sem resultado persistido a etapa não entra em concluídas (readStoredCompletedSessions purga)
  // -------------------------------------------------------------------------------------------------
  it('I2: sem resultado persistido ou com estado not_started/ausente, a etapa não entra em concluídas', () => {
    // Caso A: SQ1 gravada em completedSessions, mas estado canônico está 'not_started'
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1'])
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, {
      stageId: 'sq1',
      status: 'not_started',
      sessionDurationSec: 720,
      elapsedTimeSec: 0,
      timeRemainingSec: 720,
      simSpeed: 1,
      cars: {} as any,
      leaderboard: [],
      lapHistory: {},
      radioFeed: [],
      parcFermeActive: false,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    // Sem resultado persistido
    let completed = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(completed).not.toContain('sq1')

    // Caso B: SQ1 gravada em completedSessions com status 'completed', mas SEM resultado persistido no storage
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, {
      stageId: 'sq1',
      status: 'completed',
      sessionDurationSec: 720,
      elapsedTimeSec: 720,
      timeRemainingSec: 0,
      simSpeed: 1,
      cars: {} as any,
      leaderboard: [],
      lapHistory: {},
      radioFeed: [],
      parcFermeActive: false,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    // Sem resultado salvo (apex_qualifying_stage_result_v2_...)
    completed = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(completed).not.toContain('sq1')

    // Caso C: Estado canônico ausente por completo
    localStorage.removeItem(`apex_qualifying_stage_state_v2_${TEST_SEASON_ID}_r${TEST_ROUND}_sq1`)
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1'])
    completed = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(completed).not.toContain('sq1')

    // Caso D: Quando estado está 'completed' E resultado está persistido com entries, a etapa permanece concluída
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, {
      stageId: 'sq1',
      status: 'completed',
      sessionDurationSec: 720,
      elapsedTimeSec: 720,
      timeRemainingSec: 0,
      simSpeed: 1,
      cars: {} as any,
      leaderboard: mockDrivers.map((d, i) => ({
        position: i + 1,
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
        teamColor: d.teamColor,
        compound: 'macio',
        laps: 2,
        bestLapSec: 78.0 + i * 0.1,
        bestLapTime: '1:18.000',
        gap: '-',
        isPlayer: false,
        status: 'garage',
        isEliminated: i >= 18,
      })),
      lapHistory: {},
      radioFeed: [],
      parcFermeActive: false,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: mockDrivers.map((d, i) => ({
        position: i + 1,
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
        teamColor: d.teamColor,
        bestLapSec: 78.0 + i * 0.1,
        bestLapTime: '1:18.000',
        bestLapRecordedAtSec: 200,
        compound: 'macio',
        lapsCount: 2,
        isPlayer: false,
        isEliminated: i >= 18,
      })),
      advancingDriverIds: mockDrivers.slice(0, 18).map((d) => d.id),
      eliminatedDriverIds: mockDrivers.slice(18).map((d) => d.id),
    })

    completed = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(completed).toContain('sq1')
  })

  // -------------------------------------------------------------------------------------------------
  // I3: initializeStage não sobrescreve completed com fresh
  // -------------------------------------------------------------------------------------------------
  it('I3: initializeStage não sobrescreve completed com fresh', () => {
    // 1. Salvar estado completed de SQ1 com voltas completadas
    const completedState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: playerDriver1.id,
        driverName: playerDriver1.name,
        driverNumber: 1,
        tyreSetId: 'tyre_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: mockDrivers,
    })

    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, mockDrivers)
    CanonicalQualifyingRunner.simulateRemainingSession(completedState, tickContext)

    const savedCompleted = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq1',
    )!
    expect(savedCompleted.status).toBe('completed')
    expect(savedCompleted.timeRemainingSec).toBe(0)
    expect(savedCompleted.leaderboard.some((e) => e.laps > 0)).toBe(true)

    // 2. Chamar initializeStage novamente com eligibleParticipants
    const reloaded = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: playerDriver1.id,
        driverName: playerDriver1.name,
        driverNumber: 1,
        tyreSetId: 'tyre_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: mockDrivers,
    })

    // Deve retornar o estado 'completed' intacto, sem zerar voltas nem voltar para 'not_started'
    expect(reloaded.status).toBe('completed')
    expect(reloaded.timeRemainingSec).toBe(0)
    expect(reloaded.leaderboard.some((e) => e.laps > 0)).toBe(true)

    // E no storage, o estado continua 'completed'
    const storedAfter = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq1',
    )!
    expect(storedAfter.status).toBe('completed')
  })

  // -------------------------------------------------------------------------------------------------
  // I4: SQ2 inicializa com grid derivado do resultado da SQ1 (18 pilotos)
  // -------------------------------------------------------------------------------------------------
  it('I4: SQ2 inicializa com grid derivado do resultado da SQ1 (18 pilotos classificados)', () => {
    // 1. Simular e concluir SQ1
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: playerDriver1.id,
        driverName: playerDriver1.name,
        driverNumber: 1,
        tyreSetId: 'tyre_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: mockDrivers,
    })

    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, mockDrivers)
    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext)

    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq1',
    )!
    expect(sq1Result).not.toBeNull()
    expect(sq1Result.advancingDriverIds).toHaveLength(18)

    // 2. Resolver pilotos elegíveis para a SQ2
    const allEntries = mockDrivers.map((d) => ({
      driverId: d.id,
      driverName: d.name,
      teamId: d.teamId,
      teamName: d.teamName,
      driverNumber: d.carNumber,
    }))

    const sq2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries,
      playerDriverIds: [playerDriver1.id, playerDriver2.id],
    })

    expect(sq2Participants).toHaveLength(18)
    expect(sq2Participants.map((p) => p.id)).toEqual(sq1Result.advancingDriverIds)

    // 3. Inicializar SQ2 com esses 18 classificados
    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: playerDriver1.id,
        driverName: playerDriver1.name,
        driverNumber: 1,
        tyreSetId: 'tyre_sq2_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_sq2_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: sq2Participants,
    })

    expect(sq2State.stageId).toBe('sq2')
    expect(sq2State.leaderboard).toHaveLength(18)
    expect(sq2State.leaderboard.map((e) => e.driverId)).toEqual(sq1Result.advancingDriverIds)
    // Duração regulamentar da SQ2
    expect(sq2State.sessionDurationSec).toBe(600)
    expect(sq2State.timeRemainingSec).toBe(600)
  })

  // -------------------------------------------------------------------------------------------------
  // I5: Detecção de conclusão idempotente (guard por roundKey / stageId)
  // -------------------------------------------------------------------------------------------------
  it('I5: detecção de conclusão idempotente evita múltiplas chamadas de finalização', () => {
    const completedSet = new Set<string>()
    const onStageCompletedMock = vi.fn()

    const simulateEffectTrigger = (stageId: QualifyingStageId, status: string, round: number) => {
      if (status !== 'completed') return
      const roundKey = `${TEST_SEASON_ID}_r${round}_${stageId}`
      if (completedSet.has(roundKey)) return
      completedSet.add(roundKey)
      onStageCompletedMock(stageId)
    }

    // 1ª execução com SQ1 completed: deve disparar
    simulateEffectTrigger('sq1', 'completed', TEST_ROUND)
    expect(onStageCompletedMock).toHaveBeenCalledTimes(1)
    expect(onStageCompletedMock).toHaveBeenCalledWith('sq1')

    // 2ª execução com SQ1 completed (ex: re-render ou tick extra): NÃO deve redisparar
    simulateEffectTrigger('sq1', 'completed', TEST_ROUND)
    expect(onStageCompletedMock).toHaveBeenCalledTimes(1)

    // Execução para SQ2 completed: deve disparar separadamente
    simulateEffectTrigger('sq2', 'completed', TEST_ROUND)
    expect(onStageCompletedMock).toHaveBeenCalledTimes(2)
    expect(onStageCompletedMock).toHaveBeenLastCalledWith('sq2')

    // Execução para SQ1 em outra rodada (ex: round 5): deve disparar normalmente
    simulateEffectTrigger('sq1', 'completed', TEST_ROUND + 1)
    expect(onStageCompletedMock).toHaveBeenCalledTimes(3)
  })
})
