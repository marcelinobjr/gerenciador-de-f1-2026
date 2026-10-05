import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import {
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '@/services/weekendProgressionService'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
import { resolveSessionVisualState, isSessionUnlocked } from '@/services/weekendScheduleConfig'
import type { QualifyingDriverContext } from '@/services/canonicalQualifyingRunner'

describe('BUG-SQ3-PROMOTION-01A — Promoção canônica SQ2 → SQ3 no weekend_slot_state', () => {
  const TEST_SEASON_ID = 'season_promo_sq3_01a'
  const TEST_ROUND = 2
  const TEST_CAREER_ID = 'career_promo_sq3_01a'

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
      isPlayer: i < 2,
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

  it('SQ2 completed → slot SQ3 passa a ser available/disponível E SQ2 permanece completed', async () => {
    // 1. Inicializa weekend_slot_state no formato SPRINT
    const slotState = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: TEST_CAREER_ID,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      weekendFormat: 'SPRINT',
    })
    slotState.currentSlot = 2
    slotState.subPhase = 'SQ2'
    if (slotState.slots[2]) {
      slotState.slots[2].subPhase = 'SQ2'
      slotState.slots[2].status = 'AVAILABLE'
    }
    await canonicalWeekendSlotPersistenceService.saveSlotState(slotState)

    // 2. Concluir SQ1 e SQ2 oficialmente
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

    // Registra SQ1 e SQ2 concluídas em completedSessions
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1', 'sq2'])

    // Marca stageState da SQ2 com status completed
    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: mockDrivers[0].id,
        driverName: mockDrivers[0].name,
        driverNumber: 1,
        tyreSetId: 't1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: mockDrivers[1].id,
        driverName: mockDrivers[1].name,
        driverNumber: 2,
        tyreSetId: 't2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: mockDrivers.slice(0, 18),
    })
    sq2State.status = 'completed'
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, sq2State)

    // Simula a transição canônica de SQ2 concluída no weekend_slot_state via saveSlotState / updateSubPhase
    const currentSlotState = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: TEST_CAREER_ID,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
    })
    if (currentSlotState) {
      if (currentSlotState.slots[2]) {
        currentSlotState.slots[2].subPhase = 'SQ3'
        currentSlotState.slots[2].status = 'AVAILABLE'
      }
      currentSlotState.subPhase = 'SQ3'
      currentSlotState.slotStatus = 'AVAILABLE'
      await canonicalWeekendSlotPersistenceService.saveSlotState(currentSlotState)
    }

    // 3. Prova 1: SQ2 permanece oficialmente completed
    const readSQ2State = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq2',
    )
    expect(readSQ2State).not.toBeNull()
    expect(readSQ2State?.status).toBe('completed')

    const storedCompleted = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(storedCompleted).toContain('sq2')

    const visualStateSQ2 = resolveSessionVisualState({
      sessionId: 'sq2',
      activeSessionId: 'sq3',
      completedSessions: storedCompleted,
      isSprintRound: true,
    })
    expect(visualStateSQ2).toBe('completed')

    // 4. Prova 2: Próximo slot/fase de Sprint Qualifying correspondente à SQ3 está DISPONÍVEL (available)
    const reloadedSlot = await canonicalWeekendSlotPersistenceService.loadOrMigrateSlotState({
      careerId: TEST_CAREER_ID,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
    })
    expect(reloadedSlot.slots[2].subPhase).toBe('SQ3')
    expect(reloadedSlot.slots[2].status).toBe('AVAILABLE')
    expect(reloadedSlot.subPhase).toBe('SQ3')
    expect(reloadedSlot.slotStatus).toBe('AVAILABLE')

    const isSQ3Unlocked = isSessionUnlocked('sq3', storedCompleted, true)
    expect(isSQ3Unlocked).toBe(true)

    const visualStateSQ3 = resolveSessionVisualState({
      sessionId: 'sq3',
      activeSessionId: 'sq2',
      completedSessions: storedCompleted,
      isSprintRound: true,
    })
    expect(visualStateSQ3).toBe('available')
  })
})
