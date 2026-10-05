import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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

describe('BUG-SQ3-TRANSITION-R3 — Suíte de Homologação Final (R1 a R4)', () => {
  const TEST_SEASON_ID = 'season_sq3_r3_test'
  const TEST_ROUND = 4

  const mockDrivers: QualifyingDriverContext[] = Array.from({ length: 24 }).map((_, i) => ({
    id: `driver_${String(i + 1).padStart(2, '0')}`,
    name: `Piloto ${i + 1}`,
    teamId: `team_${Math.floor(i / 2) + 1}`,
    teamName: `Equipe ${Math.floor(i / 2) + 1}`,
    teamColor: '#334155',
    basePaceSec: 80.0 + i * 0.1,
    consistency: 85,
    tyreManagement: 80,
    carPerformanceScore: 80 - i * 0.5,
    carNumber: i + 1,
    speed: 80,
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
      gpName: 'GP do Canadá',
      circuitName: 'Circuito Gilles Villeneuve',
      lengthKm: 4.361,
      tireAbrasiveness: 'media',
      weather: 25,
      teamChassisRating: 82,
      teamEngineSupplier: 'Ferrari',
      teamName: 'Apex GP',
      teamColor: '#E10600',
      drivers,
      rivalDrivers: drivers.filter((d) => d.id !== playerDriver1.id && d.id !== playerDriver2.id),
    }
  }

  function createMockStageEntries(count: number, advancingCount: number) {
    return mockDrivers.slice(0, count).map((d, i) => ({
      position: i + 1,
      driverId: d.id,
      driverName: d.name,
      teamId: d.teamId,
      teamName: d.teamName,
      teamColor: d.teamColor,
      bestLapSec: 75.0 + i * 0.1,
      bestLapTime: `1:15.${String(i * 100).padStart(3, '0')}`,
      bestLapRecordedAtSec: 300,
      compound: 'macio' as const,
      lapsCount: 3,
      isPlayer: d.id === playerDriver1.id || d.id === playerDriver2.id,
      status: 'garage' as const,
      isEliminated: i >= advancingCount,
    }))
  }

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // -------------------------------------------------------------------------------------------------
  // R1: Running órfão após reload/reidratação
  // - Tratar como sessão retomável;
  // - Não considerar concluída;
  // - Não marcar piloto como eliminado;
  // - Não abrir SQ3 precocemente;
  // - Preservar progresso da sessão (tempo restante, voltas feitas, tempos já marcados).
  // -------------------------------------------------------------------------------------------------
  it('R1 — Running órfão após reload -> retomável, não concluído, não eliminado, progresso preservado', () => {
    // 1. Configurar SQ1 completada formalmente com 18 classificados (incluindo os dois do jogador)
    const sq1AdvancingIds = mockDrivers.slice(0, 18).map((d) => d.id)
    canonicalQualifyingPersistenceService.saveStageResult({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      stageId: 'sq1',
      sessionName: 'SQ1',
      entries: createMockStageEntries(24, 18),
      advancingDriverIds: sq1AdvancingIds,
      eliminatedDriverIds: mockDrivers.slice(18).map((d) => d.id),
      poleLapSec: 75.0,
      poleLapFormatted: '1:15.000',
      totalLapsRun: 72,
      completedAt: new Date().toISOString(),
    })

    // 2. SQ2 foi iniciada e estava rodando quando houve reload do navegador
    // Estado órfão salvo no localStorage com status: 'running', 240s restantes, voltas já marcadas
    const sq2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: mockDrivers.map((d) => ({
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
      })),
      playerDriverIds: [playerDriver1.id, playerDriver2.id],
    })

    const sq2Initial = CanonicalQualifyingRunner.initializeStage({
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

    // Simular que SQ2 rodou até restar 240s e status está 'running'
    sq2Initial.status = 'running'
    sq2Initial.timeRemainingSec = 240
    sq2Initial.elapsedTimeSec = 360
    // Atribuir tempo para o Carro 1
    sq2Initial.leaderboard[0].bestLapSec = 74.5
    sq2Initial.leaderboard[0].bestLapTime = '1:14.500'
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, sq2Initial)

    // Simular que completedSessions porventura tinha lixo ou SQ2 marcada
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1', 'sq2'])

    // Reconciliação canônica ao reidratar
    const reconciledCompleted = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(reconciledCompleted).toContain('tp1')
    expect(reconciledCompleted).toContain('sq1')
    expect(reconciledCompleted).not.toContain('sq2') // Expurgada de concluídas!

    // Verificar que SQ3 NÃO abre precocemente e participantes de SQ3 não são gerados
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: mockDrivers.map((d) => ({
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
      })),
      playerDriverIds: [playerDriver1.id, playerDriver2.id],
    })
    expect(sq3Participants).toHaveLength(0) // SQ2 não concluída -> SQ3 bloqueada

    // Verificar que o estado persistido do SQ2 preservou progresso e não marcou pilotos como eliminados
    const reloadedSQ2 = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq2',
    )
    expect(reloadedSQ2).not.toBeNull()
    expect(reloadedSQ2!.timeRemainingSec).toBe(240)
    expect(reloadedSQ2!.cars.car1.isEliminated).toBe(false)
    expect(reloadedSQ2!.cars.car2.isEliminated).toBe(false)
    expect(reloadedSQ2!.leaderboard[0].bestLapSec).toBe(74.5)
  })

  // -------------------------------------------------------------------------------------------------
  // R2: Running realmente ativo
  // - Sessão ativa com ticker rodando continua executando normalmente sem conversão indevida para paused.
  // -------------------------------------------------------------------------------------------------
  it('R2 — Running realmente ativo -> continua ativo e simula ticks sem conversão indevida', () => {
    const sq2Participants = mockDrivers.slice(0, 18)
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

    sq2State.status = 'running'
    const tickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq2Participants)

    // Executa múltiplos ticks enquanto a sessão está ativa
    const tick1 = CanonicalQualifyingRunner.tick(sq2State, 10, tickCtx)
    expect(tick1.nextState.status).toBe('running')
    expect(tick1.nextState.timeRemainingSec).toBe(sq2State.sessionDurationSec - 10)

    const tick2 = CanonicalQualifyingRunner.tick(tick1.nextState, 10, tickCtx)
    expect(tick2.nextState.status).toBe('running')
    expect(tick2.nextState.timeRemainingSec).toBe(sq2State.sessionDurationSec - 20)
  })

  // -------------------------------------------------------------------------------------------------
  // R3: Retomada da SQ2 -> conclusão normal -> SQ3 liberada corretamente
  // -------------------------------------------------------------------------------------------------
  it('R3 — Retomada da SQ2 -> conclusão normal -> SQ3 liberada corretamente com avanço esportivo', () => {
    // 1. Salvar SQ1 formalmente
    canonicalQualifyingPersistenceService.saveStageResult({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      stageId: 'sq1',
      sessionName: 'SQ1',
      entries: createMockStageEntries(24, 18),
      advancingDriverIds: mockDrivers.slice(0, 18).map((d) => d.id),
      eliminatedDriverIds: mockDrivers.slice(18).map((d) => d.id),
      poleLapSec: 75.0,
      poleLapFormatted: '1:15.000',
      totalLapsRun: 72,
      completedAt: new Date().toISOString(),
    })

    // 2. Inicializar SQ2 em estado retomável (paused ou running órfão)
    const sq2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: mockDrivers.map((d) => ({
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
      })),
      playerDriverIds: [playerDriver1.id, playerDriver2.id],
    })

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

    sq2State.status = 'paused'
    sq2State.timeRemainingSec = 200

    // 3. Simular restante da SQ2 (conclusão normal)
    const tickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq2Participants)
    const simRes = CanonicalQualifyingRunner.simulateRemainingSession(sq2State, tickCtx)

    expect(simRes.nextState.status).toBe('completed')
    expect(simRes.nextState.timeRemainingSec).toBe(0)

    // 4. Verificar que o resultado foi salvo e possui 10 pilotos avançando (corte 18 -> 10)
    const savedSQ2 = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq2',
    )
    expect(savedSQ2).not.toBeNull()
    expect(savedSQ2!.advancingDriverIds).toHaveLength(10)
    expect(savedSQ2!.eliminatedDriverIds).toHaveLength(8)

    // 5. Agora SQ3 é liberada com os 10 classificados
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: mockDrivers.map((d) => ({
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
      })),
      playerDriverIds: [playerDriver1.id, playerDriver2.id],
    })
    expect(sq3Participants).toHaveLength(10)
    expect(sq3Participants.map((p) => p.id)).toEqual(savedSQ2!.advancingDriverIds)
  })

  // -------------------------------------------------------------------------------------------------
  // R4: Regressão completa
  // - paused continua funcionando;
  // - completed continua funcionando;
  // - jogador eliminado -> espectador na SQ3 (não eliminado falso no meio da SQ2);
  // - jogador classificado -> participa ativamente;
  // - handoff e grid Sprint continuam verdes (P1-P10 de SQ3, P11-P18 de SQ2, P19-P24 de SQ1).
  // -------------------------------------------------------------------------------------------------
  it('R4 — Regressão: paused/completed, jogador eliminado vira espectador na SQ3, grid Sprint 24 carros exato', () => {
    // 1. SQ1 Result
    const sq1Entries = mockDrivers.map((d, i) => ({
      position: i + 1,
      driverId: d.id,
      driverName: d.name,
      teamId: d.teamId,
      teamName: d.teamName,
      teamColor: d.teamColor,
      bestLapSec: 75.0 + i * 0.1,
      bestLapTime: '1:15.000',
      bestLapRecordedAtSec: 300,
      compound: 'macio' as const,
      lapsCount: 3,
      isPlayer: d.id === playerDriver1.id || d.id === playerDriver2.id,
      status: 'garage' as const,
      isEliminated: i >= 18,
    }))
    canonicalQualifyingPersistenceService.saveStageResult({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      stageId: 'sq1',
      sessionName: 'SQ1',
      entries: sq1Entries,
      advancingDriverIds: mockDrivers.slice(0, 18).map((d) => d.id),
      eliminatedDriverIds: mockDrivers.slice(18).map((d) => d.id),
      poleLapSec: 75.0,
      poleLapFormatted: '1:15.000',
      totalLapsRun: 72,
      completedAt: new Date().toISOString(),
    })

    // 2. SQ2 Result onde Carro 1 classifica (P3) e Carro 2 é eliminado (P14)
    // Advancing: driver_01 (player) + 9 IAs
    const sq2Advancing = [playerDriver1.id, ...mockDrivers.slice(2, 11).map((d) => d.id)]
    const sq2Eliminated = [playerDriver2.id, ...mockDrivers.slice(11, 18).map((d) => d.id)]

    const sq2Entries = [...sq2Advancing, ...sq2Eliminated].map((id, idx) => {
      const d = mockDrivers.find((m) => m.id === id)!
      return {
        position: idx + 1,
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
        teamColor: d.teamColor,
        bestLapSec: 74.0 + idx * 0.1,
        bestLapTime: '1:14.000',
        bestLapRecordedAtSec: 300,
        compound: 'macio' as const,
        lapsCount: 4,
        isPlayer: d.id === playerDriver1.id || d.id === playerDriver2.id,
        status: 'garage' as const,
        isEliminated: idx >= 10,
      }
    })

    canonicalQualifyingPersistenceService.saveStageResult({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      stageId: 'sq2',
      sessionName: 'SQ2',
      entries: sq2Entries,
      advancingDriverIds: sq2Advancing,
      eliminatedDriverIds: sq2Eliminated,
      poleLapSec: 74.0,
      poleLapFormatted: '1:14.000',
      totalLapsRun: 72,
      completedAt: new Date().toISOString(),
    })

    // 3. Resolver participantes da SQ3:
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: mockDrivers.map((d) => ({
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
      })),
      playerDriverIds: [playerDriver1.id, playerDriver2.id],
    })

    expect(sq3Participants).toHaveLength(10)
    expect(sq3Participants.some((p) => p.id === playerDriver1.id)).toBe(true) // Carro 1 participa
    expect(sq3Participants.some((p) => p.id === playerDriver2.id)).toBe(false) // Carro 2 eliminado

    // 4. Inicializar SQ3
    const sq3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: playerDriver1.id,
        driverName: playerDriver1.name,
        driverNumber: 1,
        tyreSetId: 'tyre_sq3_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_sq3_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: sq3Participants,
    })

    // Carro 1 ativo, Carro 2 eliminado como espectador
    expect(sq3State.cars.car1.isEliminated).toBe(false)
    expect(sq3State.cars.car1.status).toBe('garage')
    expect(sq3State.cars.car2.isEliminated).toBe(true)
    expect(sq3State.cars.car2.status).toBe('eliminated')

    // 5. Simular SQ3
    const sq3TickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq3Participants)
    const sq3Sim = CanonicalQualifyingRunner.simulateRemainingSession(sq3State, sq3TickCtx)
    expect(sq3Sim.nextState.status).toBe('completed')

    // 6. Validar Grid da Sprint (24 posições canônicas deduped)
    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )

    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid!.positions).toHaveLength(24)

    // P1-P10 são os 10 da SQ3
    const p1To10Ids = sprintGrid!.positions.slice(0, 10).map((g) => g.driverId)
    expect(p1To10Ids).toEqual(sq3Participants.map((p) => p.id))

    // P11-P18 são os 8 eliminados da SQ2
    const p11To18Ids = sprintGrid!.positions.slice(10, 18).map((g) => g.driverId)
    expect(p11To18Ids).toEqual(sq2Eliminated)

    // P19-P24 são os 6 eliminados da SQ1
    const p19To24Ids = sprintGrid!.positions.slice(18, 24).map((g) => g.driverId)
    expect(p19To24Ids).toEqual(mockDrivers.slice(18).map((d) => d.id))

    // Dedup perfeito
    const uniqueIds = new Set(sprintGrid!.positions.map((g) => g.driverId))
    expect(uniqueIds.size).toBe(24)
  })
})
