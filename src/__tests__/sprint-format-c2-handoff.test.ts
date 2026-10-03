import { describe, it, expect, beforeEach } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import {
  CanonicalQualifyingRunner,
  type QualifyingTickContext,
  type QualifyingDriverContext,
} from '@/services/canonicalQualifyingRunner'
import {
  CANONICAL_QUALIFYING_RULES,
  type QualifyingDriverStatus,
  type QualifyingStageId,
  type QualifyingStageState,
} from '@/types/canonical-qualifying-types'
import { normalizeCompletedSessions } from '@/services/weekendProgressionService'

// Helper para criar mock de pilotos oficiais do grid
function createMockDriverContexts(count = 24): QualifyingDriverContext[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `drv_${idx + 1}`,
    name: `Driver ${idx + 1}`,
    speed: 80,
    consistency: 80,
    defense: 75,
    teamId: `team_${Math.floor(idx / 2) + 1}`,
    teamName: `Team ${Math.floor(idx / 2) + 1}`,
    teamColor: '#E10600',
    carNumber: idx + 1,
  }))
}

// Helper para criar QualifyingTickContext completo e tipado
function createTickContext(
  seasonId: string,
  round: number,
  participants: QualifyingDriverContext[],
): QualifyingTickContext {
  return {
    seasonId,
    round,
    gpName: 'Chinese Grand Prix',
    circuitName: 'Shanghai International Circuit',
    lengthKm: 5.451,
    tireAbrasiveness: 6,
    weather: 'seco',
    teamChassisRating: 80,
    teamEngineSupplier: 'Audi',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    drivers: participants.slice(0, 2),
    rivalDrivers: participants.slice(2),
  }
}

// Helper para criar estado inicial de teste para qualquer estágio
function createMockStageState(
  stageId: QualifyingStageId,
  seasonId: string,
  round: number,
  participants: QualifyingDriverContext[],
): QualifyingStageState {
  const rules = CANONICAL_QUALIFYING_RULES[stageId]
  const slice = participants.slice(0, rules.participantsCount)

  const leaderboard = slice.map((p, idx) => ({
    position: idx + 1,
    driverId: p.id,
    driverName: p.name,
    teamId: p.teamId,
    teamName: p.teamName,
    teamColor: p.teamColor,
    compound: 'macio' as const,
    laps: 3,
    bestLapSec: 75.0 + idx * 0.15,
    bestLapTime: `1:15.${String(idx * 150).padStart(3, '0')}`,
    bestLapRecordedAtSec: 200 + idx * 10,
    gap: idx === 0 ? 'Pole/Líder' : `+${(idx * 0.15).toFixed(3)}s`,
    isPlayer: idx < 2,
    carId: idx === 0 ? ('car1' as const) : idx === 1 ? ('car2' as const) : undefined,
    status: 'garage' as QualifyingDriverStatus,
    carNumber: p.carNumber,
  }))

  return {
    stageId,
    status: 'running',
    sessionDurationSec: rules.durationSec,
    elapsedTimeSec: rules.durationSec,
    timeRemainingSec: 0,
    simSpeed: 1,
    cars: {
      car1: {
        carId: 'car1',
        driverId: slice[0]?.id || 'drv_1',
        driverName: slice[0]?.name || 'Driver 1',
        driverNumber: slice[0]?.carNumber || 1,
        status: 'garage',
        pitRequested: false,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
        currentTyreSetId: 'tyre_1',
        currentCompound: 'macio',
        tyreWear: 10,
        fuelKg: 15,
        outLapsDone: 1,
        flyingLapsDone: 1,
        inLapsDone: 1,
        totalLaps: 3,
        currentLapProgressPct: 0,
        bestLapSec: leaderboard[0]?.bestLapSec,
        bestLapTime: leaderboard[0]?.bestLapTime,
        isEliminated: false,
      },
      car2: {
        carId: 'car2',
        driverId: slice[1]?.id || 'drv_2',
        driverName: slice[1]?.name || 'Driver 2',
        driverNumber: slice[1]?.carNumber || 2,
        status: 'garage',
        pitRequested: false,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
        currentTyreSetId: 'tyre_2',
        currentCompound: 'macio',
        tyreWear: 10,
        fuelKg: 15,
        outLapsDone: 1,
        flyingLapsDone: 1,
        inLapsDone: 1,
        totalLaps: 3,
        currentLapProgressPct: 0,
        bestLapSec: leaderboard[1]?.bestLapSec,
        bestLapTime: leaderboard[1]?.bestLapTime,
        isEliminated: false,
      },
    },
    leaderboard,
    lapHistory: {},
    radioFeed: [],
    parcFermeActive: true,
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// Resolução dos participantes elegíveis simulando a lógica canônica de WeekendV2Page
// (resolveEligibleQualifyingParticipants consome readStageResult do estágio predecessor)
function resolveEligibleParticipantsCanonical(
  stageId: QualifyingStageId,
  seasonId: string,
  round: number,
  all24: QualifyingDriverContext[],
) {
  if (stageId === 'q1' || stageId === 'sq1') {
    return all24.slice(0, CANONICAL_QUALIFYING_RULES[stageId].participantsCount)
  }

  if (stageId === 'q2' || stageId === 'sq2') {
    const parentStage: QualifyingStageId = stageId === 'sq2' ? 'sq1' : 'q1'
    const parentRes = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      round,
      parentStage,
    )
    if (parentRes && parentRes.advancingDriverIds) {
      return all24.filter((p) => parentRes.advancingDriverIds.includes(p.id))
    }
    // Fallback canônico regulamentar (CANONICAL_QUALIFYING_RULES.sq1.advancingCount = 18)
    return all24.slice(0, CANONICAL_QUALIFYING_RULES[parentStage].advancingCount)
  }

  if (stageId === 'q3' || stageId === 'sq3') {
    const parentStage: QualifyingStageId = stageId === 'sq3' ? 'sq2' : 'q2'
    const parentRes = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      round,
      parentStage,
    )
    if (parentRes && parentRes.advancingDriverIds) {
      return all24.filter((p) => parentRes.advancingDriverIds.includes(p.id))
    }
    // Fallback canônico regulamentar (CANONICAL_QUALIFYING_RULES.sq2.advancingCount = 10)
    return all24.slice(0, CANONICAL_QUALIFYING_RULES[parentStage].advancingCount)
  }

  return all24
}

describe('SPRINT-FDS-01-R4C2: Sprint Qualifying Stage Handoff (C2-01..C2-12)', () => {
  const seasonId = 'season_2026_sprint_c2'
  const round = 2 // GP da China (Sprint Weekend)
  const allDrivers = createMockDriverContexts(24)
  const tickContext = createTickContext(seasonId, round, allDrivers)

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  // C2-01: SQ1 concluída persiste stage 'sq1'
  it('C2-01: SQ1 concluída persiste stage sq1 via canonicalQualifyingPersistenceService', () => {
    const sq1State = createMockStageState('sq1', seasonId, round, allDrivers)
    const sq1Result = CanonicalQualifyingRunner.finalizeStage(sq1State, tickContext, {
      persistState: true,
    })

    expect(sq1Result.stageId).toBe('sq1')
    expect(sq1Result.seasonId).toBe(seasonId)
    expect(sq1Result.round).toBe(round)

    const persistedResult = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      round,
      'sq1',
    )
    expect(persistedResult).not.toBeNull()
    expect(persistedResult?.stageId).toBe('sq1')
    expect(persistedResult?.entries).toHaveLength(CANONICAL_QUALIFYING_RULES.sq1.participantsCount) // 24
  })

  // C2-02: SQ2 lê resultado da SQ1
  it('C2-02: SQ2 lê resultado da SQ1 para determinar avanço e participantes', () => {
    const sq1State = createMockStageState('sq1', seasonId, round, allDrivers)
    const finalizedSq1 = CanonicalQualifyingRunner.finalizeStage(sq1State, tickContext, {
      persistState: true,
    })

    const readSq1 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    expect(readSq1).not.toBeNull()
    expect(readSq1?.advancingDriverIds).toEqual(finalizedSq1.advancingDriverIds)
    expect(readSq1?.advancingDriverIds).toHaveLength(CANONICAL_QUALIFYING_RULES.sq1.advancingCount)
  })

  // C2-03: Participantes da SQ2 = classificados canônicos da SQ1 (18)
  it('C2-03: participantes da SQ2 correspondem exatamente aos classificados da SQ1', () => {
    // Origem regulamentar da constante canônica: CANONICAL_QUALIFYING_RULES.sq1.advancingCount (18)
    const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES.sq1.advancingCount
    expect(expectedAdvancingCount).toBe(18)

    const sq1State = createMockStageState('sq1', seasonId, round, allDrivers)
    CanonicalQualifyingRunner.finalizeStage(sq1State, tickContext, { persistState: true })

    const eligibleSq2 = resolveEligibleParticipantsCanonical('sq2', seasonId, round, allDrivers)
    expect(eligibleSq2).toHaveLength(expectedAdvancingCount)

    const sq1Res = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')!
    const eligibleIds = eligibleSq2.map((p) => p.id)
    expect(eligibleIds).toEqual(sq1Res.advancingDriverIds)

    // Eliminados do SQ1 não podem figurar na SQ2
    sq1Res.eliminatedDriverIds.forEach((elimId) => {
      expect(eligibleIds).not.toContain(elimId)
    })
  })

  // C2-04: SQ2 não usa grid completo nem quali principal
  it('C2-04: SQ2 não usa grid completo (24) nem resultado da quali principal (q1/q2/q3)', () => {
    // 1. Simular uma qualificação principal anterior ou futura salva no storage
    const q1State = createMockStageState('q1', seasonId, round, allDrivers)
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'q1',
      seasonId,
      round,
      completedAt: new Date().toISOString(),
      entries: q1State.leaderboard.map((e) => ({
        ...e,
        bestLapRecordedAtSec: 100,
        lapsCount: 2,
        isEliminated: false,
      })),
      // Inverter ordem dos avançados no Q1 para provar independência
      advancingDriverIds: allDrivers.slice(6, 24).map((d) => d.id),
      eliminatedDriverIds: allDrivers.slice(0, 6).map((d) => d.id),
    })

    // 2. Simular SQ1 concluída com ordem padrão (0..17 avançam)
    const sq1State = createMockStageState('sq1', seasonId, round, allDrivers)
    CanonicalQualifyingRunner.finalizeStage(sq1State, tickContext, { persistState: true })

    // 3. Resolver participantes para SQ2
    const eligibleSq2 = resolveEligibleParticipantsCanonical('sq2', seasonId, round, allDrivers)

    // Não usa grid completo de 24
    expect(eligibleSq2).not.toHaveLength(24)
    expect(eligibleSq2).toHaveLength(CANONICAL_QUALIFYING_RULES.sq2.participantsCount) // 18

    // Participantes de SQ2 derivam de SQ1 (0..17), não de Q1 (6..23)
    const sq1Res = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')!
    expect(eligibleSq2.map((p) => p.id)).toEqual(sq1Res.advancingDriverIds)
    expect(eligibleSq2.map((p) => p.id)).not.toEqual(
      canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q1')!
        .advancingDriverIds,
    )
  })

  // C2-05: SQ2 persiste 'sq2'
  it('C2-05: SQ2 concluída persiste stage sq2 via canonicalQualifyingPersistenceService', () => {
    const sq1State = createMockStageState('sq1', seasonId, round, allDrivers)
    CanonicalQualifyingRunner.finalizeStage(sq1State, tickContext, { persistState: true })

    const eligibleSq2 = resolveEligibleParticipantsCanonical('sq2', seasonId, round, allDrivers)
    const sq2State = createMockStageState('sq2', seasonId, round, eligibleSq2)

    const sq2Result = CanonicalQualifyingRunner.finalizeStage(sq2State, tickContext, {
      persistState: true,
    })

    expect(sq2Result.stageId).toBe('sq2')
    const persistedSq2 = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      round,
      'sq2',
    )
    expect(persistedSq2).not.toBeNull()
    expect(persistedSq2?.stageId).toBe('sq2')
    expect(persistedSq2?.entries).toHaveLength(CANONICAL_QUALIFYING_RULES.sq2.participantsCount) // 18
  })

  // C2-06: SQ3 lê SQ2
  it('C2-06: SQ3 lê resultado da SQ2 para determinar participantes', () => {
    const sq1State = createMockStageState('sq1', seasonId, round, allDrivers)
    CanonicalQualifyingRunner.finalizeStage(sq1State, tickContext, { persistState: true })

    const eligibleSq2 = resolveEligibleParticipantsCanonical('sq2', seasonId, round, allDrivers)
    const sq2State = createMockStageState('sq2', seasonId, round, eligibleSq2)
    const finalizedSq2 = CanonicalQualifyingRunner.finalizeStage(sq2State, tickContext, {
      persistState: true,
    })

    const readSq2 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')
    expect(readSq2).not.toBeNull()
    expect(readSq2?.advancingDriverIds).toEqual(finalizedSq2.advancingDriverIds)
  })

  // C2-07: Participantes da SQ3 = classificados da SQ2 (10)
  it('C2-07: participantes da SQ3 correspondem exatamente aos classificados da SQ2', () => {
    // Origem regulamentar da constante canônica: CANONICAL_QUALIFYING_RULES.sq2.advancingCount (10)
    const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES.sq2.advancingCount
    expect(expectedAdvancingCount).toBe(10)

    const sq1State = createMockStageState('sq1', seasonId, round, allDrivers)
    CanonicalQualifyingRunner.finalizeStage(sq1State, tickContext, { persistState: true })

    const eligibleSq2 = resolveEligibleParticipantsCanonical('sq2', seasonId, round, allDrivers)
    const sq2State = createMockStageState('sq2', seasonId, round, eligibleSq2)
    CanonicalQualifyingRunner.finalizeStage(sq2State, tickContext, { persistState: true })

    const eligibleSq3 = resolveEligibleParticipantsCanonical('sq3', seasonId, round, allDrivers)
    expect(eligibleSq3).toHaveLength(expectedAdvancingCount)

    const sq2Res = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')!
    const sq3Ids = eligibleSq3.map((p) => p.id)
    expect(sq3Ids).toEqual(sq2Res.advancingDriverIds)

    // Eliminados do SQ2 (P11..P18) não podem figurar na SQ3
    sq2Res.eliminatedDriverIds.forEach((elimId) => {
      expect(sq3Ids).not.toContain(elimId)
    })
  })

  // C2-08: SQ3 não usa SQ1 diretamente quando SQ2 existe
  it('C2-08: SQ3 consome SQ2 como estágio predecessor e não pula para SQ1', () => {
    const sq1State = createMockStageState('sq1', seasonId, round, allDrivers)
    CanonicalQualifyingRunner.finalizeStage(sq1State, tickContext, { persistState: true })

    const eligibleSq2 = resolveEligibleParticipantsCanonical('sq2', seasonId, round, allDrivers)
    const sq2State = createMockStageState('sq2', seasonId, round, eligibleSq2)
    CanonicalQualifyingRunner.finalizeStage(sq2State, tickContext, { persistState: true })

    const sq1Res = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')!
    const sq2Res = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')!
    const eligibleSq3 = resolveEligibleParticipantsCanonical('sq3', seasonId, round, allDrivers)

    // SQ1 tem 18 classificados, SQ2 tem 10 classificados
    expect(sq1Res.advancingDriverIds).toHaveLength(CANONICAL_QUALIFYING_RULES.sq1.advancingCount) // 18
    expect(sq2Res.advancingDriverIds).toHaveLength(CANONICAL_QUALIFYING_RULES.sq2.advancingCount) // 10

    // SQ3 deve ter 10 participantes, coincidindo com SQ2 e não com os 18 da SQ1
    expect(eligibleSq3).toHaveLength(sq2Res.advancingDriverIds.length)
    expect(eligibleSq3.map((p) => p.id)).toEqual(sq2Res.advancingDriverIds)
    expect(eligibleSq3.map((p) => p.id)).not.toEqual(sq1Res.advancingDriverIds)
  })

  // C2-09: Stages sq1/sq2/sq3 separados
  it('C2-09: stages sq1, sq2 e sq3 possuem persistência, chaves e estados completamente separados', () => {
    const keySq1 = canonicalQualifyingPersistenceService.getStageResultKey(seasonId, round, 'sq1')
    const keySq2 = canonicalQualifyingPersistenceService.getStageResultKey(seasonId, round, 'sq2')
    const keySq3 = canonicalQualifyingPersistenceService.getStageResultKey(seasonId, round, 'sq3')

    expect(keySq1).not.toBe(keySq2)
    expect(keySq2).not.toBe(keySq3)
    expect(keySq1).not.toBe(keySq3)
    expect(keySq1).toContain('_sq1')
    expect(keySq2).toContain('_sq2')
    expect(keySq3).toContain('_sq3')

    // Executar e persistir os 3 estágios
    const sq1 = createMockStageState('sq1', seasonId, round, allDrivers)
    CanonicalQualifyingRunner.finalizeStage(sq1, tickContext, { persistState: true })

    const eligibleSq2 = resolveEligibleParticipantsCanonical('sq2', seasonId, round, allDrivers)
    const sq2 = createMockStageState('sq2', seasonId, round, eligibleSq2)
    CanonicalQualifyingRunner.finalizeStage(sq2, tickContext, { persistState: true })

    const eligibleSq3 = resolveEligibleParticipantsCanonical('sq3', seasonId, round, allDrivers)
    const sq3 = createMockStageState('sq3', seasonId, round, eligibleSq3)
    CanonicalQualifyingRunner.finalizeStage(sq3, tickContext, { persistState: true })

    const r1 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    const r2 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')
    const r3 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq3')

    expect(r1?.stageId).toBe('sq1')
    expect(r2?.stageId).toBe('sq2')
    expect(r3?.stageId).toBe('sq3')
    expect(r1?.entries).toHaveLength(24)
    expect(r2?.entries).toHaveLength(18)
    expect(r3?.entries).toHaveLength(10)
  })

  // C2-10: Reload preserva stages
  it('C2-10: reload simulado restaura integralmente os resultados e estados de sq1, sq2 e sq3', () => {
    // 1. Simular execução completa das 3 fases
    const sq1 = createMockStageState('sq1', seasonId, round, allDrivers)
    CanonicalQualifyingRunner.finalizeStage(sq1, tickContext, { persistState: true })

    const eligibleSq2 = resolveEligibleParticipantsCanonical('sq2', seasonId, round, allDrivers)
    const sq2 = createMockStageState('sq2', seasonId, round, eligibleSq2)
    CanonicalQualifyingRunner.finalizeStage(sq2, tickContext, { persistState: true })

    const eligibleSq3 = resolveEligibleParticipantsCanonical('sq3', seasonId, round, allDrivers)
    const sq3 = createMockStageState('sq3', seasonId, round, eligibleSq3)
    CanonicalQualifyingRunner.finalizeStage(sq3, tickContext, { persistState: true })

    // 2. Simular recarregamento da página (leitura pura a partir do localStorage persistido)
    const loadedSq1 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    const loadedSq2 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')
    const loadedSq3 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq3')

    expect(loadedSq1).not.toBeNull()
    expect(loadedSq2).not.toBeNull()
    expect(loadedSq3).not.toBeNull()

    expect(loadedSq1?.advancingDriverIds).toHaveLength(18)
    expect(loadedSq2?.advancingDriverIds).toHaveLength(10)
    expect(loadedSq3?.entries).toHaveLength(10)

    // Estados ao vivo de cada fase também preservados
    const stateSq1 = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'sq1')
    const stateSq2 = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'sq2')
    const stateSq3 = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'sq3')

    expect(stateSq1?.status).toBe('completed')
    expect(stateSq2?.status).toBe('completed')
    expect(stateSq3?.status).toBe('completed')
  })

  // C2-11: Quali principal (_q1/_q2/_q3) isolada
  it('C2-11: quali principal (_q1/_q2/_q3) permanece estritamente isolada de sq1/sq2/sq3', () => {
    // 1. Gravar SQ1, SQ2 e SQ3
    const sq1 = createMockStageState('sq1', seasonId, round, allDrivers)
    CanonicalQualifyingRunner.finalizeStage(sq1, tickContext, { persistState: true })
    const eligibleSq2 = resolveEligibleParticipantsCanonical('sq2', seasonId, round, allDrivers)
    const sq2 = createMockStageState('sq2', seasonId, round, eligibleSq2)
    CanonicalQualifyingRunner.finalizeStage(sq2, tickContext, { persistState: true })
    const eligibleSq3 = resolveEligibleParticipantsCanonical('sq3', seasonId, round, allDrivers)
    const sq3 = createMockStageState('sq3', seasonId, round, eligibleSq3)
    CanonicalQualifyingRunner.finalizeStage(sq3, tickContext, { persistState: true })

    // 2. Gravar Q1, Q2 e Q3 com tempos diferentes
    const q1 = createMockStageState('q1', seasonId, round, allDrivers)
    CanonicalQualifyingRunner.finalizeStage(q1, tickContext, { persistState: true })
    const eligibleQ2 = resolveEligibleParticipantsCanonical('q2', seasonId, round, allDrivers)
    const q2 = createMockStageState('q2', seasonId, round, eligibleQ2)
    CanonicalQualifyingRunner.finalizeStage(q2, tickContext, { persistState: true })
    const eligibleQ3 = resolveEligibleParticipantsCanonical('q3', seasonId, round, allDrivers)
    const q3 = createMockStageState('q3', seasonId, round, eligibleQ3)
    CanonicalQualifyingRunner.finalizeStage(q3, tickContext, { persistState: true })

    // 3. Verificar que chaves e dados de SQ e Q não colidem nem sobrescrevem
    const resSq1 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
    const resQ1 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q1')
    expect(resSq1?.stageId).toBe('sq1')
    expect(resQ1?.stageId).toBe('q1')

    const resSq2 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq2')
    const resQ2 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q2')
    expect(resSq2?.stageId).toBe('sq2')
    expect(resQ2?.stageId).toBe('q2')

    const resSq3 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq3')
    const resQ3 = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'q3')
    expect(resSq3?.stageId).toBe('sq3')
    expect(resQ3?.stageId).toBe('q3')
  })

  // C2-12: Aliases sprint_q1→sq1, sprint_q2→sq2, sprint_q3→sq3 válidos sem duplicação
  it('C2-12: aliases sprint_q1->sq1, sprint_q2->sq2, sprint_q3->sq3 são normalizados sem duplicatas', () => {
    // Teste com entrada contendo aliases legados
    const legacyInput = ['tp1', 'sprint_q1', 'sprint_q2', 'sprint_q3']
    const normalized = normalizeCompletedSessions(legacyInput)

    // Formas canônicas devem estar presentes
    expect(normalized).toContain('sq1')
    expect(normalized).toContain('sq2')
    expect(normalized).toContain('sq3')

    // Aliases bidirecionais de compatibilidade também estão presentes
    expect(normalized).toContain('sprint_q1')
    expect(normalized).toContain('sprint_q2')
    expect(normalized).toContain('sprint_q3')

    // Sem duplicação de itens
    const uniqueItems = new Set(normalized)
    expect(normalized.length).toBe(uniqueItems.size)

    // Teste de normalização inversa partindo de sq1..sq3
    const canonicalInput = ['sq1', 'sq2', 'sq3']
    const normalizedCanonical = normalizeCompletedSessions(canonicalInput)
    expect(normalizedCanonical).toContain('sq1')
    expect(normalizedCanonical).toContain('sq2')
    expect(normalizedCanonical).toContain('sq3')
    expect(normalizedCanonical).toContain('sprint_q1')
    expect(normalizedCanonical).toContain('sprint_q2')
    expect(normalizedCanonical).toContain('sprint_q3')
    expect(normalizedCanonical.length).toBe(new Set(normalizedCanonical).size)

    // Isolamento: sq1/sq2/sq3 NÃO devem incluir q1, q2 ou q3
    expect(normalizedCanonical).not.toContain('q1')
    expect(normalizedCanonical).not.toContain('q2')
    expect(normalizedCanonical).not.toContain('q3')
    expect(normalizedCanonical).not.toContain('qualifying')
  })
})
