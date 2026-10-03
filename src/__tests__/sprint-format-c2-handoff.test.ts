import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import { normalizeCompletedSessions } from '@/services/weekendProgressionService'
import type {
  QualifyingDriverContext,
  QualifyingTickContext,
} from '@/services/canonicalQualifyingRunner'

describe('SPRINT-FDS-01-R4C2-H: MICRO-RODADA DE HOMOLOGAÇÃO DO HANDOFF SQ1 -> SQ2 -> SQ3 (Sprint Qualifying)', () => {
  const seasonId = 'season_2026_c2_handoff'
  const round = 2 // GP da China (Sprint)

  // Mock localStorage
  class LocalStorageMock {
    private store: Record<string, string> = {}
    getItem(key: string) {
      return this.store[key] || null
    }
    setItem(key: string, value: string) {
      this.store[key] = String(value)
    }
    removeItem(key: string) {
      delete this.store[key]
    }
    clear() {
      this.store = {}
    }
  }

  // Helper canônico similar a WeekendV2Page.resolveEligibleQualifyingParticipants
  function resolveParticipantsForStage(
    stageId: 'sq1' | 'sq2' | 'sq3' | 'q1' | 'q2' | 'q3',
    all24Drivers: QualifyingDriverContext[],
    currentSeasonId: string,
    currentRound: number,
  ): QualifyingDriverContext[] {
    if (stageId === 'q1' || stageId === 'sq1') {
      return all24Drivers.slice(0, CANONICAL_QUALIFYING_RULES[stageId].participantsCount)
    }

    if (stageId === 'q2' || stageId === 'sq2') {
      const parentStage = stageId === 'sq2' ? 'sq1' : 'q1'
      const parentRes = canonicalQualifyingPersistenceService.readStageResult(
        currentSeasonId,
        currentRound,
        parentStage,
      )
      if (parentRes && parentRes.advancingDriverIds) {
        return all24Drivers.filter((p) => parentRes.advancingDriverIds.includes(p.id))
      }
      return all24Drivers.slice(0, CANONICAL_QUALIFYING_RULES[stageId].participantsCount)
    }

    if (stageId === 'q3' || stageId === 'sq3') {
      const parentStage = stageId === 'sq3' ? 'sq2' : 'q2'
      const parentRes = canonicalQualifyingPersistenceService.readStageResult(
        currentSeasonId,
        currentRound,
        parentStage,
      )
      if (parentRes && parentRes.advancingDriverIds) {
        return all24Drivers.filter((p) => parentRes.advancingDriverIds.includes(p.id))
      }
      return all24Drivers.slice(0, CANONICAL_QUALIFYING_RULES[stageId].participantsCount)
    }

    return all24Drivers
  }

  // 24 pilotos oficiais
  const all24Drivers: QualifyingDriverContext[] = Array.from({ length: 24 }, (_, idx) => ({
    id: `drv_${idx + 1}`,
    name: `Driver ${idx + 1}`,
    speed: 88 - idx,
    consistency: 85,
    defense: 80,
    teamId: `team_${Math.floor(idx / 2) + 1}`,
    teamName: `Team ${Math.floor(idx / 2) + 1}`,
    teamColor: idx % 2 === 0 ? '#E10600' : '#1E40AF',
    carNumber: idx + 1,
  }))

  const tickContext: QualifyingTickContext = {
    seasonId,
    round,
    gpName: 'Grande Prêmio da China',
    circuitName: 'Circuito Internacional de Xangai',
    lengthKm: 5.451,
    tireAbrasiveness: 3,
    weather: 'seco',
    teamChassisRating: 85,
    teamEngineSupplier: 'Audi',
    teamName: 'Team 1',
    teamColor: '#E10600',
    drivers: [all24Drivers[0], all24Drivers[1]],
    rivalDrivers: all24Drivers.slice(2),
  }

  beforeEach(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).localStorage = new LocalStorageMock()
    }
  })

  // C2-01: SQ1 concluída persiste stage result 'sq1'.
  it('C2-01: SQ1 concluída persiste stage result "sq1"', () => {
    const sq1Participants = resolveParticipantsForStage('sq1', all24Drivers, seasonId, round)
    expect(sq1Participants).toHaveLength(CANONICAL_QUALIFYING_RULES.sq1.participantsCount) // 24

    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq1Participants,
      persistState: true,
    })

    const simResult = CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })
    expect(simResult.nextState.status).toBe('completed')

    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    expect(sq1Result).not.toBeNull()
    expect(sq1Result?.stageId).toBe('sq1')
    expect(sq1Result?.seasonId).toBe(seasonId)
    expect(sq1Result?.round).toBe(round)
    expect(sq1Result?.entries).toHaveLength(CANONICAL_QUALIFYING_RULES.sq1.participantsCount)
    expect(sq1Result?.advancingDriverIds).toHaveLength(
      CANONICAL_QUALIFYING_RULES.sq1.advancingCount,
    ) // 18
    expect(sq1Result?.eliminatedDriverIds).toHaveLength(
      CANONICAL_QUALIFYING_RULES.sq1.eliminatedCount,
    ) // 6
  })

  // C2-02: SQ2 lê o resultado persistido da SQ1.
  it('C2-02: SQ2 lê o resultado persistido da SQ1', () => {
    // 1. Simular SQ1
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    // 2. Leitura canônica pela persistência
    const readSq1 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    expect(readSq1).not.toBeNull()
    expect(readSq1?.stageId).toBe('sq1')
    expect(readSq1?.advancingDriverIds).toBeDefined()
    expect(readSq1?.advancingDriverIds).toHaveLength(CANONICAL_QUALIFYING_RULES.sq1.advancingCount)
  })

  // C2-03: participantes da SQ2 correspondem aos classificados canônicos da SQ1 (esperado 18 conforme CANONICAL_QUALIFYING_RULES.sq1.advancingCount).
  it('C2-03: participantes da SQ2 correspondem aos classificados canônicos da SQ1 (18 classificados)', () => {
    // 1. Finalizar SQ1
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')!
    const sq2Participants = resolveParticipantsForStage('sq2', all24Drivers, seasonId, round)

    // Quantidade canônica de SQ2
    expect(sq2Participants).toHaveLength(CANONICAL_QUALIFYING_RULES.sq2.participantsCount) // 18
    expect(sq2Participants).toHaveLength(CANONICAL_QUALIFYING_RULES.sq1.advancingCount) // 18

    // Todos os participantes da SQ2 pertencem estritamente aos advancingDriverIds de SQ1
    const sq2Ids = sq2Participants.map((p) => p.id)
    expect(sq2Ids).toEqual(sq1Result.advancingDriverIds)

    // Nenhum eliminado de SQ1 participa de SQ2
    sq1Result.eliminatedDriverIds.forEach((elimId) => {
      expect(sq2Ids).not.toContain(elimId)
    })
  })

  // C2-04: SQ2 NÃO volta a usar grid inicial completo nem a qualificação principal.
  it('C2-04: SQ2 NÃO volta a usar grid inicial completo nem a qualificação principal', () => {
    // 1. Simular SQ1
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    const sq2Participants = resolveParticipantsForStage('sq2', all24Drivers, seasonId, round)

    // NÃO usa grid completo de 24
    expect(sq2Participants.length).not.toBe(24)
    expect(sq2Participants.length).toBe(18)

    // Q1 principal e Q2 principal continuam estritamente vazios
    const q1Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q1')
    const q2Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q2')
    expect(q1Result).toBeNull()
    expect(q2Result).toBeNull()

    // O grid principal completo não foi invocado nem criado
    const mainGrid = canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
      seasonId,
      round,
    )
    expect(mainGrid).toBeNull()
  })

  // C2-05: SQ2 concluída persiste stage result 'sq2'.
  it('C2-05: SQ2 concluída persiste stage result "sq2"', () => {
    // 1. Simular SQ1
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    // 2. Inicializar e simular SQ2
    const sq2Participants = resolveParticipantsForStage('sq2', all24Drivers, seasonId, round)
    const sq2Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })

    const simSq2 = CanonicalQualifyingRunner.simulateRemainingSession(sq2Initial, tickContext, {
      persistState: true,
    })
    expect(simSq2.nextState.status).toBe('completed')

    const sq2Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')
    expect(sq2Result).not.toBeNull()
    expect(sq2Result?.stageId).toBe('sq2')
    expect(sq2Result?.entries).toHaveLength(CANONICAL_QUALIFYING_RULES.sq2.participantsCount) // 18
    expect(sq2Result?.advancingDriverIds).toHaveLength(
      CANONICAL_QUALIFYING_RULES.sq2.advancingCount,
    ) // 10
    expect(sq2Result?.eliminatedDriverIds).toHaveLength(
      CANONICAL_QUALIFYING_RULES.sq2.eliminatedCount,
    ) // 8
  })

  // C2-06: SQ3 lê o resultado persistido da SQ2.
  it('C2-06: SQ3 lê o resultado persistido da SQ2', () => {
    // 1. Executar SQ1
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    // 2. Executar SQ2
    const sq2Participants = resolveParticipantsForStage('sq2', all24Drivers, seasonId, round)
    const sq2Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq2Initial, tickContext, {
      persistState: true,
    })

    // 3. Leitura do resultado de SQ2 por SQ3
    const readSq2 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')
    expect(readSq2).not.toBeNull()
    expect(readSq2?.stageId).toBe('sq2')
    expect(readSq2?.advancingDriverIds).toBeDefined()
    expect(readSq2?.advancingDriverIds).toHaveLength(CANONICAL_QUALIFYING_RULES.sq2.advancingCount)
  })

  // C2-07: participantes da SQ3 correspondem aos classificados canônicos da SQ2 (esperado 10 conforme CANONICAL_QUALIFYING_RULES.sq2.advancingCount).
  it('C2-07: participantes da SQ3 correspondem aos classificados canônicos da SQ2 (10 classificados)', () => {
    // 1. Executar SQ1
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    // 2. Executar SQ2
    const sq2Participants = resolveParticipantsForStage('sq2', all24Drivers, seasonId, round)
    const sq2Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq2Initial, tickContext, {
      persistState: true,
    })

    const sq2Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')!
    const sq3Participants = resolveParticipantsForStage('sq3', all24Drivers, seasonId, round)

    // Quantidade canônica de SQ3
    expect(sq3Participants).toHaveLength(CANONICAL_QUALIFYING_RULES.sq3.participantsCount) // 10
    expect(sq3Participants).toHaveLength(CANONICAL_QUALIFYING_RULES.sq2.advancingCount) // 10

    // Todos os participantes da SQ3 pertencem estritamente aos advancingDriverIds de SQ2
    const sq3Ids = sq3Participants.map((p) => p.id)
    expect(sq3Ids).toEqual(sq2Result.advancingDriverIds)

    // Nenhum eliminado de SQ2 participa de SQ3
    sq2Result.eliminatedDriverIds.forEach((elimId) => {
      expect(sq3Ids).not.toContain(elimId)
    })
  })

  // C2-08: SQ3 NÃO usa diretamente SQ1 quando SQ2 existe.
  it('C2-08: SQ3 NÃO usa diretamente SQ1 quando SQ2 existe', () => {
    // 1. Executar SQ1
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    // 2. Executar SQ2
    const sq2Participants = resolveParticipantsForStage('sq2', all24Drivers, seasonId, round)
    const sq2Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq2Initial, tickContext, {
      persistState: true,
    })

    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')!
    const sq2Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')!
    const sq3Participants = resolveParticipantsForStage('sq3', all24Drivers, seasonId, round)

    // SQ3 tem 10 participantes, enquanto SQ1 avançou 18
    expect(sq3Participants.length).toBe(10)
    expect(sq1Result.advancingDriverIds.length).toBe(18)
    expect(sq3Participants.length).not.toBe(sq1Result.advancingDriverIds.length)

    // Os 8 pilotos eliminados no SQ2 estavam entre os 18 que avançaram de SQ1, mas NÃO estão no SQ3
    const eliminatedInSq2 = sq2Result.eliminatedDriverIds
    expect(eliminatedInSq2.length).toBe(8)
    eliminatedInSq2.forEach((elimId) => {
      expect(sq1Result.advancingDriverIds).toContain(elimId)
      expect(sq3Participants.map((p) => p.id)).not.toContain(elimId)
    })
  })

  // C2-09: stage results sq1/sq2/sq3 permanecem separados, sem colisão.
  it('C2-09: stage results sq1/sq2/sq3 permanecem separados, sem colisão', () => {
    // 1. Simular SQ1
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    // 2. Simular SQ2
    const sq2Participants = resolveParticipantsForStage('sq2', all24Drivers, seasonId, round)
    const sq2Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq2Initial, tickContext, {
      persistState: true,
    })

    // 3. Simular SQ3
    const sq3Participants = resolveParticipantsForStage('sq3', all24Drivers, seasonId, round)
    const sq3Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq3Initial, tickContext, {
      persistState: true,
    })

    // Conferir chaves de armazenamento distintas
    const keySq1 = canonicalQualifyingPersistenceService.getStageResultKey(seasonId, round, 'sq1')
    const keySq2 = canonicalQualifyingPersistenceService.getStageResultKey(seasonId, round, 'sq2')
    const keySq3 = canonicalQualifyingPersistenceService.getStageResultKey(seasonId, round, 'sq3')

    expect(keySq1).not.toBe(keySq2)
    expect(keySq2).not.toBe(keySq3)
    expect(keySq1).not.toBe(keySq3)

    // Ler cada resultado de forma independente
    const resSq1 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    const resSq2 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')
    const resSq3 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq3')

    expect(resSq1).not.toBeNull()
    expect(resSq2).not.toBeNull()
    expect(resSq3).not.toBeNull()

    expect(resSq1?.stageId).toBe('sq1')
    expect(resSq2?.stageId).toBe('sq2')
    expect(resSq3?.stageId).toBe('sq3')

    expect(resSq1?.entries).toHaveLength(24)
    expect(resSq2?.entries).toHaveLength(18)
    expect(resSq3?.entries).toHaveLength(10)
  })

  // C2-10: reload/persistência preserva os stages sem misturar resultados.
  it('C2-10: reload/persistência preserva os stages sem misturar resultados', () => {
    // 1. Simular e salvar SQ1, SQ2 e SQ3
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    const sq2Participants = resolveParticipantsForStage('sq2', all24Drivers, seasonId, round)
    const sq2Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq2Initial, tickContext, {
      persistState: true,
    })

    const sq3Participants = resolveParticipantsForStage('sq3', all24Drivers, seasonId, round)
    const sq3Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq3Initial, tickContext, {
      persistState: true,
    })

    // 2. Simular um reload limpando estados em memória e relendo do storage
    const reloadedSq1State = canonicalQualifyingPersistenceService.readStageState(
      seasonId,
      round,
      'sq1',
    )
    const reloadedSq2State = canonicalQualifyingPersistenceService.readStageState(
      seasonId,
      round,
      'sq2',
    )
    const reloadedSq3State = canonicalQualifyingPersistenceService.readStageState(
      seasonId,
      round,
      'sq3',
    )

    expect(reloadedSq1State).not.toBeNull()
    expect(reloadedSq2State).not.toBeNull()
    expect(reloadedSq3State).not.toBeNull()

    expect(reloadedSq1State?.stageId).toBe('sq1')
    expect(reloadedSq2State?.stageId).toBe('sq2')
    expect(reloadedSq3State?.stageId).toBe('sq3')

    expect(reloadedSq1State?.status).toBe('completed')
    expect(reloadedSq2State?.status).toBe('completed')
    expect(reloadedSq3State?.status).toBe('completed')

    // Confirmar que initializeStage retorna o estado salvo sem recomeçar do zero
    const restoredSq1 = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
    })
    expect(restoredSq1.status).toBe('completed')
    expect(restoredSq1.stageId).toBe('sq1')
  })

  // C2-11: quali principal q1/q2/q3 permanece isolada da Sprint Qualifying sq1/sq2/sq3.
  it('C2-11: quali principal q1/q2/q3 permanece isolada da Sprint Qualifying sq1/sq2/sq3', () => {
    // 1. Simular SQ1, SQ2 e SQ3
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    const sq2Participants = resolveParticipantsForStage('sq2', all24Drivers, seasonId, round)
    const sq2Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq2Initial, tickContext, {
      persistState: true,
    })

    const sq3Participants = resolveParticipantsForStage('sq3', all24Drivers, seasonId, round)
    const sq3Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 20,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq3Initial, tickContext, {
      persistState: true,
    })

    // Verificar que Q1, Q2, Q3 principais continuam estritamente nulos
    expect(canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q1')).toBeNull()
    expect(canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q2')).toBeNull()
    expect(canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q3')).toBeNull()
    expect(
      canonicalQualifyingPersistenceService.readCompleteQualifyingResult(seasonId, round),
    ).toBeNull()

    // 2. Agora simular Q1 principal
    const q1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1_main',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 7, rearWing: 7, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2_main',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 7, rearWing: 7, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(q1Initial, tickContext, {
      persistState: true,
    })

    const q1Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q1')
    expect(q1Result).not.toBeNull()
    expect(q1Result?.stageId).toBe('q1')

    // SQ1 permanece inalterado com seu próprio resultado
    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    expect(sq1Result).not.toBeNull()
    expect(sq1Result?.stageId).toBe('sq1')

    // Chaves de storage são totalmente distintas
    const sq1Key = canonicalQualifyingPersistenceService.getStageResultKey(seasonId, round, 'sq1')
    const q1Key = canonicalQualifyingPersistenceService.getStageResultKey(seasonId, round, 'q1')
    expect(sq1Key).toContain('_sq1')
    expect(q1Key).toContain('_q1')
    expect(sq1Key).not.toBe(q1Key)
  })

  // C2-12: aliases canônicos sprint_q1->sq1, sprint_q2->sq2, sprint_q3->sq3 continuam válidos e não criam resultados paralelos duplicados.
  it('C2-12: aliases canônicos sprint_q1->sq1, sprint_q2->sq2, sprint_q3->sq3 continuam válidos e não criam resultados paralelos duplicados', () => {
    // 1. Normalização via normalizeCompletedSessions
    const withAliases = ['tp1', 'sprint_q1', 'sprint_q2', 'sprint_q3']
    const normalized = normalizeCompletedSessions(withAliases)

    expect(normalized).toContain('sq1')
    expect(normalized).toContain('sq2')
    expect(normalized).toContain('sq3')
    expect(normalized).toContain('sprint_qualifying')

    // 2. Persistência e chaves não geram chaves duplicadas para o mesmo stage
    const keyCanonicalSq1 = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      round,
      'sq1',
    )
    const keyAliasSq1 = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      round,
      'sq1' as any,
    )
    expect(keyCanonicalSq1).toBe(keyAliasSq1)

    // 3. Salvar SQ1 e ler usando SQ1
    const sq1Initial = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Driver 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Driver 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1Initial, tickContext, {
      persistState: true,
    })

    const read = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    expect(read).not.toBeNull()
    expect(read?.stageId).toBe('sq1')

    // Nenhum resultado criado sob q1
    expect(canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q1')).toBeNull()
  })
})
