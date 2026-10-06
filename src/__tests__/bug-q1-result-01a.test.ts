/**
 * bug-q1-result-01a.test.ts
 *
 * Suíte BUG-Q1-RESULT-01A:
 * Finalização canônica do Q1 diretamente pelo runner:
 * Q1-A: Inicializar Q1 real pelo runner. Avançar o tempo pelo caminho advanceBySeconds até zero.
 *       Confirmar imediatamente, SEM depender de WeekendV2Page/useEffect:
 *       - estado = completed;
 *       - readStageResult('q1') retorna resultado não nulo;
 *       - resultado contém a classificação final;
 *       - advancingDriverIds possui a quantidade canônica de Q1 (CANONICAL_QUALIFYING_RULES.q1.advancingCount).
 * Q1-B: Repetir a operação de conclusão.
 *       Confirmar: mesmo StageResult; nenhuma duplicação; nenhuma nova simulação.
 * Q1-C: Executar simulateRemainingSession e confirmar o mesmo contrato de persistência.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import type {
  QualifyingTickContext,
  QualifyingDriverContext,
} from '@/services/canonicalQualifyingRunner'

describe('BUG-Q1-RESULT-01A — Finalização Canônica do Q1 pelo Runner', () => {
  const TEST_SEASON_ID = 'season_q1_result_01a'
  const TEST_ROUND = 1

  const mockDrivers: QualifyingDriverContext[] = Array.from({ length: 24 }).map((_, i) => ({
    id: `driver_${String(i + 1).padStart(2, '0')}`,
    name: `Piloto ${i + 1}`,
    teamId: `team_${Math.floor(i / 2) + 1}`,
    teamName: `Equipe ${Math.floor(i / 2) + 1}`,
    teamColor: '#334155',
    carNumber: i + 1,
    speed: 85 - i * 0.4,
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
      gpName: 'GP do Bahrein',
      circuitName: 'Bahrain International Circuit',
      lengthKm: 5.412,
      tireAbrasiveness: 60,
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

  it('Q1-A: advanceBySeconds até zero finaliza Q1 e materializa StageResult no storage sem depender da UI', () => {
    // 1. Inicializar um Q1 real pelo runner
    const initialState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: playerDriver1.id,
        driverName: playerDriver1.name,
        driverNumber: 1,
        tyreSetId: 'tyre_q1_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_q1_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: mockDrivers,
    })

    expect(initialState.leaderboard).toHaveLength(24)
    expect(initialState.stageId).toBe('q1')
    expect(initialState.status).toBe('not_started')

    // Antes de avançar até o fim, confirmar que não há StageResult gravado
    expect(
      canonicalQualifyingPersistenceService.readStageResult(TEST_SEASON_ID, TEST_ROUND, 'q1'),
    ).toBeNull()

    // 2. Avançar o tempo pelo caminho advanceBySeconds até zerar o relógio
    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, mockDrivers)
    const advanceRes = CanonicalQualifyingRunner.advanceBySeconds(
      initialState,
      initialState.sessionDurationSec,
      tickContext,
      { persistState: true },
    )

    // 3. Confirmar imediatamente:
    // - estado = completed
    expect(advanceRes.nextState.status).toBe('completed')
    expect(advanceRes.nextState.timeRemainingSec).toBe(0)

    // - readStageResult('q1') retorna resultado não nulo
    const stageResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(stageResult).not.toBeNull()
    expect(stageResult!.stageId).toBe('q1')
    expect(stageResult!.seasonId).toBe(TEST_SEASON_ID)
    expect(stageResult!.round).toBe(TEST_ROUND)

    // - resultado contém a classificação final ordenada
    expect(stageResult!.entries).toHaveLength(24)
    expect(stageResult!.entries[0].position).toBe(1)
    expect(stageResult!.entries[23].position).toBe(24)

    // - advancingDriverIds possui a quantidade definida pela regra canônica Q1→Q2
    const canonicalAdvancingCount = CANONICAL_QUALIFYING_RULES.q1.advancingCount
    const canonicalEliminatedCount = CANONICAL_QUALIFYING_RULES.q1.eliminatedCount
    expect(stageResult!.advancingDriverIds).toHaveLength(canonicalAdvancingCount)
    expect(stageResult!.eliminatedDriverIds).toHaveLength(canonicalEliminatedCount)

    // Os classificados nos advancingDriverIds batem com os primeiros colocados
    const expectedAdvancing = stageResult!.entries
      .slice(0, canonicalAdvancingCount)
      .map((e) => e.driverId)
    expect(stageResult!.advancingDriverIds).toEqual(expectedAdvancing)

    // Estado persistido no storage também reflete completed
    const persistedState = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(persistedState).not.toBeNull()
    expect(persistedState!.status).toBe('completed')
    expect(persistedState!.timeRemainingSec).toBe(0)
  })

  it('Q1-B: repetir a operação de conclusão é idempotente e preserva o StageResult', () => {
    // 1. Inicializar e avançar até zero
    const initialState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: playerDriver1.id,
        driverName: playerDriver1.name,
        driverNumber: 1,
        tyreSetId: 'tyre_q1_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_q1_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: mockDrivers,
    })

    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, mockDrivers)
    const firstAdvance = CanonicalQualifyingRunner.advanceBySeconds(
      initialState,
      initialState.sessionDurationSec,
      tickContext,
      { persistState: true },
    )

    const firstResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(firstResult).not.toBeNull()

    // 2. Repetir advanceBySeconds sobre o estado já concluído
    const secondAdvance = CanonicalQualifyingRunner.advanceBySeconds(
      firstAdvance.nextState,
      60,
      tickContext,
      { persistState: true },
    )

    expect(secondAdvance.secondsSimulated).toBe(0)
    expect(secondAdvance.nextState.status).toBe('completed')
    expect(secondAdvance.nextState.timeRemainingSec).toBe(0)

    const secondResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(secondResult).not.toBeNull()
    expect(secondResult!.advancingDriverIds).toEqual(firstResult!.advancingDriverIds)
    expect(secondResult!.eliminatedDriverIds).toEqual(firstResult!.eliminatedDriverIds)
    expect(secondResult!.entries.map((e) => e.driverId)).toEqual(
      firstResult!.entries.map((e) => e.driverId),
    )
    expect(secondResult!.entries.map((e) => e.bestLapSec)).toEqual(
      firstResult!.entries.map((e) => e.bestLapSec),
    )
  })

  it('Q1-C: simulateRemainingSession materializa StageResult com o mesmo contrato de persistência', () => {
    // 1. Inicializar Q1
    const initialState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: playerDriver1.id,
        driverName: playerDriver1.name,
        driverNumber: 1,
        tyreSetId: 'tyre_q1_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_q1_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: mockDrivers,
    })

    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, mockDrivers)

    // 2. Executar simulateRemainingSession
    const simRes = CanonicalQualifyingRunner.simulateRemainingSession(initialState, tickContext, {
      persistState: true,
    })

    expect(simRes.nextState.status).toBe('completed')
    expect(simRes.nextState.timeRemainingSec).toBe(0)

    // 3. Confirmar persistência imediata do resultado
    const stageResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(stageResult).not.toBeNull()
    expect(stageResult!.stageId).toBe('q1')
    expect(stageResult!.entries).toHaveLength(24)

    const canonicalAdvancingCount = CANONICAL_QUALIFYING_RULES.q1.advancingCount
    const canonicalEliminatedCount = CANONICAL_QUALIFYING_RULES.q1.eliminatedCount
    expect(stageResult!.advancingDriverIds).toHaveLength(canonicalAdvancingCount)
    expect(stageResult!.eliminatedDriverIds).toHaveLength(canonicalEliminatedCount)

    // Reexecutar simulateRemainingSession sobre sessão concluída não deve quebrar
    const reSimRes = CanonicalQualifyingRunner.simulateRemainingSession(
      simRes.nextState,
      tickContext,
      { persistState: true },
    )
    expect(reSimRes.secondsSimulated).toBe(0)
    expect(reSimRes.nextState.status).toBe('completed')
  })
})
