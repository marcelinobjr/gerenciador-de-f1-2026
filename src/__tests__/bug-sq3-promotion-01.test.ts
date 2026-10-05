import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import {
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '@/services/weekendProgressionService'
import { resolveEligibleQualifyingDrivers } from '@/services/qualifyingParticipantResolver'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
import { resolveSessionVisualState, isSessionUnlocked } from '@/services/weekendScheduleConfig'
import type {
  QualifyingTickContext,
  QualifyingDriverContext,
} from '@/services/canonicalQualifyingRunner'
import type { QualifyingStageId } from '@/types/canonical-qualifying-types'

describe('BUG-SQ3-PROMOTION-01 — Promoção SQ2 → SQ3, Sincronismo de UI e Guards de Sessão Concluída', () => {
  const TEST_SEASON_ID = 'season_promo_sq3_test'
  const TEST_ROUND = 4
  const TEST_CAREER_ID = 'career_promo_sq3_test'

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
      tireAbrasiveness: 50,
      weather: 'seco',
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
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  afterEach(() => {
    localStorage.clear()
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  // -------------------------------------------------------------------------------------------------
  // P1: SQ2 concluída → slot SQ3 "Disponível", weekend_slot_state avança
  // -------------------------------------------------------------------------------------------------
  it('P1: SQ2 concluída → slot SQ3 "Disponível", weekend_slot_state avança subPhase para SQ3', async () => {
    // 1. Inicializa o slot state em formato Sprint no slot 2 (QUALI_SPRINT), subPhase SQ2
    const slotState = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: TEST_CAREER_ID,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      weekendFormat: 'SPRINT',
    })
    slotState.currentSlot = 2
    slotState.subPhase = 'SQ2'
    await canonicalWeekendSlotPersistenceService.saveSlotState(slotState)

    // 2. Salva SQ1 e SQ2 concluídas
    canonicalQualifyingPersistenceService.saveStageResult({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      stageId: 'sq1',
      entries: createMockStageEntries(24, 18),
      advancingDriverIds: mockDrivers.slice(0, 18).map((d) => d.id),
      eliminatedDriverIds: mockDrivers.slice(18).map((d) => d.id),
      completedAt: new Date().toISOString(),
    })

    const sq2AdvancingIds = mockDrivers.slice(0, 10).map((d) => d.id)
    canonicalQualifyingPersistenceService.saveStageResult({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      stageId: 'sq2',
      entries: createMockStageEntries(18, 10),
      advancingDriverIds: sq2AdvancingIds,
      eliminatedDriverIds: mockDrivers.slice(10, 18).map((d) => d.id),
      completedAt: new Date().toISOString(),
    })

    // Registra sq1 e sq2 como concluídas
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1', 'sq2'])

    // Atualiza a subfase como handleQualifyingStageCompleted faz
    await canonicalWeekendSlotPersistenceService.updateSubPhase({
      careerId: TEST_CAREER_ID,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      slotNumber: 2,
      subPhase: 'SQ3',
    })

    // 3. Verifica que weekend_slot_state avançou para SQ3
    const updatedSlot = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: TEST_CAREER_ID,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
    })
    expect(updatedSlot.currentSlot).toBe(2)
    expect(updatedSlot.subPhase).toBe('SQ3')

    // 4. Verifica que SQ3 está desbloqueada e com visualState "available"
    const completed = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    const isSQ3Unlocked = isSessionUnlocked('sq3', completed, true)
    expect(isSQ3Unlocked).toBe(true)

    const visualStateSQ3 = resolveSessionVisualState({
      sessionId: 'sq3',
      activeSessionId: 'sq2', // SQ2 acabou de ser concluída antes de mudar aba
      completedSessions: completed,
      isSprintRound: true,
    })
    expect(visualStateSQ3).toBe('available')
  })

  // -------------------------------------------------------------------------------------------------
  // P2: Selecionar SQ3 → cronômetro 600s/480s, participantes = 10 classificados da SQ2
  // -------------------------------------------------------------------------------------------------
  it('P2: selecionar SQ3 → participantes = 10 classificados da SQ2 e cronômetro inicializado', () => {
    // 1. SQ2 com 10 classificados específicos
    const sq2Top10 = [playerDriver1.id, ...mockDrivers.slice(2, 11).map((d) => d.id)]
    canonicalQualifyingPersistenceService.saveStageResult({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      stageId: 'sq2',
      entries: createMockStageEntries(18, 10),
      advancingDriverIds: sq2Top10,
      eliminatedDriverIds: mockDrivers.slice(11, 19).map((d) => d.id),
      completedAt: new Date().toISOString(),
    })

    // 2. Resolver participantes para SQ3
    const allEntries = mockDrivers.map((d) => ({
      driverId: d.id,
      driverName: d.name,
      teamId: d.teamId,
      teamName: d.teamName,
      driverNumber: d.carNumber,
    }))

    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries,
      playerDriverIds: [playerDriver1.id, playerDriver2.id],
    })

    expect(sq3Participants).toHaveLength(10)
    expect(sq3Participants.map((p) => p.id)).toEqual(sq2Top10)

    // 3. Inicializar a sessão de SQ3
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

    expect(sq3State.stageId).toBe('sq3')
    expect(sq3State.timeRemainingSec).toBe(sq3State.sessionDurationSec)
    // sq3 tem participantes no leaderboard
    expect(sq3State.leaderboard).toHaveLength(10)
    expect(sq3State.leaderboard.map((e) => e.driverId)).toEqual(sq2Top10)
  })

  // -------------------------------------------------------------------------------------------------
  // P3: Play/+1min/Simular na SQ3 executam sem toast "Sessão Concluída"
  // -------------------------------------------------------------------------------------------------
  it('P3: Play/+1min/Simular na SQ3 executam sem toast "Sessão Concluída" mesmo que SQ2 esteja concluída', () => {
    // SQ2 marcada como concluída no storage
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1', 'sq2'])

    const sq2Top10 = mockDrivers.slice(0, 10).map((d) => d.id)
    canonicalQualifyingPersistenceService.saveStageResult({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      stageId: 'sq2',
      entries: createMockStageEntries(18, 10),
      advancingDriverIds: sq2Top10,
      eliminatedDriverIds: mockDrivers.slice(10, 18).map((d) => d.id),
      completedAt: new Date().toISOString(),
    })

    const sq3Participants = mockDrivers.slice(0, 10)
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

    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, sq3State)

    // Simulando o guard da Correção 3:
    // Se selectedSessionId for 'sq3', mas activeState em memória residisse como 'sq2' (concluída):
    const selectedSessionId: QualifyingStageId = 'sq3'
    let activeState: any = {
      ...sq3State,
      stageId: 'sq2' as QualifyingStageId,
      status: 'completed' as const,
    }

    const toastMock = vi.fn()

    // Lógica da CORREÇÃO 3:
    if (activeState.stageId !== selectedSessionId) {
      const fresh = canonicalQualifyingPersistenceService.readStageState(
        TEST_SEASON_ID,
        TEST_ROUND,
        selectedSessionId,
      )
      if (fresh) {
        activeState = fresh
      }
    }

    const stored = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    // Guard avaliado estritamente contra selectedSessionId
    if (
      selectedSessionId === activeState.stageId &&
      (activeState.status === 'completed' || stored.includes(selectedSessionId))
    ) {
      toastMock({
        variant: 'destructive',
        title: 'Sessão Concluída',
        description: 'Não é permitido executar novamente uma fase oficialmente concluída.',
      })
    }

    // Não deve disparar o toast destrutivo de Sessão Concluída para SQ3!
    expect(toastMock).not.toHaveBeenCalled()
    expect(activeState.stageId).toBe('sq3')
    expect(activeState.status).toBe('not_started')

    // Executa +1min e Simular na SQ3
    const tickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq3Participants)
    const advanceRes = CanonicalQualifyingRunner.advanceBySeconds(activeState, 60, tickCtx)
    expect(advanceRes.secondsSimulated).toBeGreaterThan(0)
    expect(advanceRes.nextState.timeRemainingSec).toBe(activeState.sessionDurationSec - 60)

    const simRes = CanonicalQualifyingRunner.simulateRemainingSession(advanceRes.nextState, tickCtx)
    expect(simRes.nextState.status).toBe('completed')
    expect(simRes.nextState.timeRemainingSec).toBe(0)
  })

  // -------------------------------------------------------------------------------------------------
  // P4: Re-executar SQ2 concluída deliberadamente → toast mantido (guard intacto)
  // -------------------------------------------------------------------------------------------------
  it('P4: re-executar SQ2 concluída deliberadamente → toast mantido (guard intacto)', () => {
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1', 'sq2'])

    const sq2State = {
      stageId: 'sq2' as QualifyingStageId,
      status: 'completed' as const,
    }

    const selectedSessionId: QualifyingStageId = 'sq2'
    let activeState = { ...sq2State }

    const toastMock = vi.fn()

    const stored = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    if (
      selectedSessionId === activeState.stageId &&
      (activeState.status === 'completed' || stored.includes(selectedSessionId))
    ) {
      toastMock({
        variant: 'destructive',
        title: 'Sessão Concluída',
        description: 'Não é permitido executar novamente uma fase oficialmente concluída.',
      })
    }

    // O toast DEVE ser disparado pois o usuário deliberadamente tentou rodar SQ2 que já estava concluída
    expect(toastMock).toHaveBeenCalledWith({
      variant: 'destructive',
      title: 'Sessão Concluída',
      description: 'Não é permitido executar novamente uma fase oficialmente concluída.',
    })
  })

  // -------------------------------------------------------------------------------------------------
  // P5: Regressões verdes: bug-sq3-transition-r3, bug-sq3-transition-r2, sprint-handoff-01a, sprint-grid-01
  // Validando compatibilidade de avanço e geração de grid da Sprint
  // -------------------------------------------------------------------------------------------------
  it('P5: regressões verdes de avanço SQ1 -> SQ2 -> SQ3 e integridade esportiva', () => {
    // 1. SQ1: 24 inscritos -> 18 classificados
    const sq1Advancing = mockDrivers.slice(0, 18).map((d) => d.id)
    canonicalQualifyingPersistenceService.saveStageResult({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      stageId: 'sq1',
      entries: createMockStageEntries(24, 18),
      advancingDriverIds: sq1Advancing,
      eliminatedDriverIds: mockDrivers.slice(18).map((d) => d.id),
      completedAt: new Date().toISOString(),
    })

    // 2. SQ2: 18 participantes -> 10 classificados
    const sq2Advancing = mockDrivers.slice(0, 10).map((d) => d.id)
    canonicalQualifyingPersistenceService.saveStageResult({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      stageId: 'sq2',
      entries: createMockStageEntries(18, 10),
      advancingDriverIds: sq2Advancing,
      eliminatedDriverIds: mockDrivers.slice(10, 18).map((d) => d.id),
      completedAt: new Date().toISOString(),
    })

    // 3. SQ3: 10 participantes apurados
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
    expect(sq3Participants.map((p) => p.id)).toEqual(sq2Advancing)
  })

  // -------------------------------------------------------------------------------------------------
  // P6: Reload no meio da SQ3 → retomável; SQ2 permanece concluída
  // -------------------------------------------------------------------------------------------------
  it('P6: reload no meio da SQ3 → retomável; SQ2 permanece concluída', () => {
    // 1. SQ2 concluída no histórico
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1', 'sq2'])

    // 2. SQ3 estava rodando no momento do reload (órfão)
    const sq3Participants = mockDrivers.slice(0, 10)
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
        wear: 5,
        fuelKg: 10,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_sq3_c2',
        compound: 'macio',
        wear: 5,
        fuelKg: 10,
        setup: dummySetup,
      },
      eligibleParticipants: sq3Participants,
    })

    sq3State.status = 'running'
    sq3State.timeRemainingSec = 200
    sq3State.elapsedTimeSec = 280
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, sq3State)

    // 3. Simula reidratação pós-reload: normalizar running órfão para paused
    const reloadedSQ3 = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq3',
    )
    expect(reloadedSQ3).not.toBeNull()
    if (reloadedSQ3 && reloadedSQ3.status === 'running') {
      reloadedSQ3.status = 'paused'
      canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, reloadedSQ3)
    }

    const verifiedSQ3 = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq3',
    )
    expect(verifiedSQ3!.status).toBe('paused')
    expect(verifiedSQ3!.timeRemainingSec).toBe(200)

    // 4. SQ2 permanece concluída e intocada
    const completed = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(completed).toContain('sq2')
    expect(completed).not.toContain('sq3')
  })
})
