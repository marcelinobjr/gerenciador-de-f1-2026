import { describe, it, expect, beforeEach } from 'vitest'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { raceQualifyingOrchestratorService } from '@/services/raceQualifyingOrchestratorService'
import {
  normalizeCompletedSessions,
  getNextRequiredWeekendSession,
  getCanonicalWeekendSchedule,
} from '@/services/weekendProgressionService'
import { isSessionUnlocked, resolveSessionVisualState } from '@/services/weekendScheduleConfig'
import type { QualifyingStageId } from '@/types/canonical-qualifying-types'

/**
 * Helper que replica o algoritmo canônico de resolveEligibleQualifyingParticipants
 * presente em src/pages/WeekendV2Page.tsx (linhas 826-894) consumindo diretamente
 * canonicalQualifyingPersistenceService.readStageResult(seasonId, round, parentStage)
 */
function resolveEligibleQualifyingParticipantsHelper(params: {
  stageId: QualifyingStageId
  seasonId: string
  currentRound: number
  all24: Array<{
    id: string
    name: string
    speed: number
    consistency: number
    defense: number
    teamId: string
    teamName: string
    teamColor: string
    carNumber: number
  }>
}) {
  const { stageId, seasonId, currentRound, all24 } = params

  if (stageId === 'q1' || (stageId as any) === 'sq1') {
    return all24.slice(0, 24)
  }

  if (stageId === 'q2' || (stageId as any) === 'sq2') {
    const parentStage = (stageId as any) === 'sq2' ? 'sq1' : 'q1'
    const q1Res = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      currentRound,
      parentStage as any,
    )
    if (q1Res && q1Res.advancingDriverIds) {
      return all24.filter((p) => q1Res.advancingDriverIds.includes(p.id))
    }
    return all24.slice(0, 18)
  }

  if (stageId === 'q3' || (stageId as any) === 'sq3') {
    const parentStage = (stageId as any) === 'sq3' ? 'sq2' : 'q2'
    const q2Res = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      currentRound,
      parentStage as any,
    )
    if (q2Res && q2Res.advancingDriverIds) {
      return all24.filter((p) => q2Res.advancingDriverIds.includes(p.id))
    }
    return all24.slice(0, 10)
  }

  return all24
}

describe('SPRINT-FDS-01-R4C2: Sprint Qualifying Stage Results & Handoff (C2-01..C2-12)', () => {
  const seasonId = 'season_2026_c2_test'
  const roundSprint = 2 // GP da China (Sprint)
  const careerId = 'career_c2_handoff'

  const all24Drivers = Array.from({ length: 24 }, (_, idx) => ({
    id: `drv_${idx + 1}`,
    name: `Piloto ${idx + 1}`,
    speed: 80,
    consistency: 80,
    defense: 75,
    teamId: `team_${Math.floor(idx / 2) + 1}`,
    teamName: `Equipe ${Math.floor(idx / 2) + 1}`,
    teamColor: '#E10600',
    carNumber: idx + 1,
  }))

  const tickContext = {
    seasonId,
    round: roundSprint,
    gpName: 'Grande Prêmio da China',
    circuitName: 'Circuito Internacional de Xangai',
    lengthKm: 5.451,
    tireAbrasiveness: 3,
    weather: 'seco' as const,
    teamChassisRating: 80,
    teamEngineSupplier: 'Audi',
    teamName: 'Apex Racing',
    teamColor: '#E10600',
    drivers: [
      { id: 'drv_1', name: 'Piloto 1', speed: 85, consistency: 85, defense: 80 },
      { id: 'drv_2', name: 'Piloto 2', speed: 82, consistency: 82, defense: 78 },
    ],
    rivalDrivers: all24Drivers.slice(2),
  }

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  // C2-01: SQ1 concluída persiste stage result 'sq1'.
  it('C2-01: SQ1 concluída persiste stage result sq1', () => {
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })

    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })

    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq1',
    )
    expect(sq1Result).not.toBeNull()
    expect(sq1Result?.stageId).toBe('sq1')
    expect(sq1Result?.seasonId).toBe(seasonId)
    expect(sq1Result?.round).toBe(roundSprint)
    expect(sq1Result?.entries).toHaveLength(24)
    expect(sq1Result?.advancingDriverIds).toHaveLength(18)
    expect(sq1Result?.eliminatedDriverIds).toHaveLength(6)

    // Verifica que a chave em localStorage usa o sufixo _sq1
    const rawSq1 = localStorage.getItem(
      canonicalQualifyingPersistenceService.getStageResultKey(seasonId, roundSprint, 'sq1'),
    )
    expect(rawSq1).toBeTruthy()
    expect(rawSq1).toContain('"stageId":"sq1"')
  })

  // C2-02: SQ2 lê o resultado da SQ1.
  it('C2-02: SQ2 lê o resultado da SQ1', async () => {
    // 1. Executa SQ1 e persiste
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })

    // 2. Leitura canônica pela persistence service com parentStage 'sq1'
    const persistedSq1 = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq1',
    )
    expect(persistedSq1).not.toBeNull()
    expect(persistedSq1?.stageId).toBe('sq1')

    // 3. Orquestrador carrega SQ1 como pré-requisito obrigatório para SQ2
    // Se SQ1 não estivesse persistido/concluído, o orquestrador lançaria erro de ordem de sessões
    const orchestratorParticipants = all24Drivers.map((d, idx) => ({
      driverId: d.id,
      driverName: d.name,
      teamId: d.teamId,
      teamName: d.teamName,
      carIndex: ((idx % 2) + 1) as 1 | 2,
      carPerformance: 80,
      speed: 80,
      qualifying: 80,
    }))

    // Simula a execução do SQ1 no orquestrador também para testar raceQualifyingOrchestratorService
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId,
      seasonId,
      round: roundSprint,
      participants: orchestratorParticipants,
    })

    const sq1PhaseState = await raceQualifyingOrchestratorService.loadPersistedPhaseState(
      'SQ1',
      careerId,
      seasonId,
      roundSprint,
    )
    expect(sq1PhaseState).not.toBeNull()
    expect(sq1PhaseState?.isCompleted).toBe(true)

    // SQ2 executa com sucesso porque SQ1 está concluído e lido
    const sq2Result = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId,
      seasonId,
      round: roundSprint,
      participants: orchestratorParticipants,
    })
    expect(sq2Result.phase).toBe('SQ2')
    expect(sq2Result.isCompleted).toBe(true)
  })

  // C2-03: participantes da SQ2 correspondem aos classificados canônicos da SQ1 (18).
  it('C2-03: participantes da SQ2 correspondem aos classificados canônicos da SQ1 (18)', () => {
    // 1. Executa SQ1
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })

    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq1',
    )
    expect(sq1Result).not.toBeNull()
    const advancing18Ids = sq1Result!.advancingDriverIds
    expect(advancing18Ids).toHaveLength(18)

    // 2. Resolve participantes para SQ2 via helper idêntico ao WeekendV2Page
    const eligibleSQ2 = resolveEligibleQualifyingParticipantsHelper({
      stageId: 'sq2',
      seasonId,
      currentRound: roundSprint,
      all24: all24Drivers,
    })

    expect(eligibleSQ2).toHaveLength(18)
    expect(eligibleSQ2.map((p) => p.id)).toEqual(advancing18Ids)

    // 3. Inicializa SQ2 com esses 18 e verifica leaderboard
    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 5,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 5,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: eligibleSQ2,
      persistState: true,
    })

    expect(sq2State.stageId).toBe('sq2')
    expect(sq2State.leaderboard).toHaveLength(18)
  })

  // C2-04: SQ2 NÃO volta a usar o grid completo/original.
  it('C2-04: SQ2 NAO volta a usar o grid completo/original', () => {
    // 1. Executa SQ1
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })

    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq1',
    )!
    const eliminated6Ids = sq1Result.eliminatedDriverIds
    expect(eliminated6Ids).toHaveLength(6)

    // 2. Resolve participantes de SQ2
    const eligibleSQ2 = resolveEligibleQualifyingParticipantsHelper({
      stageId: 'sq2',
      seasonId,
      currentRound: roundSprint,
      all24: all24Drivers,
    })

    expect(eligibleSQ2.length).not.toBe(24)
    expect(eligibleSQ2.length).toBe(18)

    // Nenhum dos eliminados no SQ1 pode estar presente na lista do SQ2
    for (const eliminatedId of eliminated6Ids) {
      expect(eligibleSQ2.some((p) => p.id === eliminatedId)).toBe(false)
    }
  })

  // C2-05: SQ2 concluída persiste stage 'sq2'.
  it('C2-05: SQ2 concluída persiste stage sq2', () => {
    // 1. Executa SQ1
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })

    const eligibleSQ2 = resolveEligibleQualifyingParticipantsHelper({
      stageId: 'sq2',
      seasonId,
      currentRound: roundSprint,
      all24: all24Drivers,
    })

    // 2. Executa SQ2
    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: eligibleSQ2,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq2State, tickContext, {
      persistState: true,
    })

    const sq2Result = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq2',
    )
    expect(sq2Result).not.toBeNull()
    expect(sq2Result?.stageId).toBe('sq2')
    expect(sq2Result?.seasonId).toBe(seasonId)
    expect(sq2Result?.round).toBe(roundSprint)
    expect(sq2Result?.entries).toHaveLength(18)
    expect(sq2Result?.advancingDriverIds).toHaveLength(10) // 10 avançam para SQ3
    expect(sq2Result?.eliminatedDriverIds).toHaveLength(8) // 8 eliminados no SQ2

    const rawSq2 = localStorage.getItem(
      canonicalQualifyingPersistenceService.getStageResultKey(seasonId, roundSprint, 'sq2'),
    )
    expect(rawSq2).toBeTruthy()
    expect(rawSq2).toContain('"stageId":"sq2"')
  })

  // C2-06: SQ3 lê o resultado da SQ2.
  it('C2-06: SQ3 lê o resultado da SQ2', async () => {
    // 1. Executa SQ1 e SQ2
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })

    const eligibleSQ2 = resolveEligibleQualifyingParticipantsHelper({
      stageId: 'sq2',
      seasonId,
      currentRound: roundSprint,
      all24: all24Drivers,
    })

    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: eligibleSQ2,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq2State, tickContext, {
      persistState: true,
    })

    // Leitura do stage result de sq2
    const readSq2 = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq2',
    )
    expect(readSq2).not.toBeNull()
    expect(readSq2?.stageId).toBe('sq2')

    // Orquestrador: SQ3 exige SQ2 concluído
    const orchestratorParticipants = all24Drivers.map((d, idx) => ({
      driverId: d.id,
      driverName: d.name,
      teamId: d.teamId,
      teamName: d.teamName,
      carIndex: ((idx % 2) + 1) as 1 | 2,
      carPerformance: 80,
      speed: 80,
      qualifying: 80,
    }))

    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ1',
      careerId,
      seasonId,
      round: roundSprint,
      participants: orchestratorParticipants,
    })
    await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ2',
      careerId,
      seasonId,
      round: roundSprint,
      participants: orchestratorParticipants,
    })

    const sq3Result = await raceQualifyingOrchestratorService.executePhase({
      phase: 'SQ3',
      careerId,
      seasonId,
      round: roundSprint,
      participants: orchestratorParticipants,
    })
    expect(sq3Result.phase).toBe('SQ3')
    expect(sq3Result.isCompleted).toBe(true)
    expect(sq3Result.results).toHaveLength(10)
  })

  // C2-07: participantes da SQ3 correspondem aos classificados canônicos da SQ2 (10).
  it('C2-07: participantes da SQ3 correspondem aos classificados canonicos da SQ2 (10)', () => {
    // 1. Executa SQ1 e SQ2
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })

    const eligibleSQ2 = resolveEligibleQualifyingParticipantsHelper({
      stageId: 'sq2',
      seasonId,
      currentRound: roundSprint,
      all24: all24Drivers,
    })

    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: eligibleSQ2,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq2State, tickContext, {
      persistState: true,
    })

    const sq2Result = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq2',
    )!
    const advancing10Ids = sq2Result.advancingDriverIds
    expect(advancing10Ids).toHaveLength(10)

    // 2. Resolve participantes para SQ3 via helper do WeekendV2Page
    const eligibleSQ3 = resolveEligibleQualifyingParticipantsHelper({
      stageId: 'sq3',
      seasonId,
      currentRound: roundSprint,
      all24: all24Drivers,
    })

    expect(eligibleSQ3).toHaveLength(10)
    expect(eligibleSQ3.map((p) => p.id)).toEqual(advancing10Ids)

    // 3. Inicializa SQ3 e confere leaderboard de 10
    const sq3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'macio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: eligibleSQ3,
      persistState: true,
    })

    expect(sq3State.stageId).toBe('sq3')
    expect(sq3State.leaderboard).toHaveLength(10)
  })

  // C2-08: SQ3 NÃO usa diretamente o resultado da SQ1 quando SQ2 existe.
  it('C2-08: SQ3 NAO usa diretamente o resultado da SQ1 quando SQ2 existe', () => {
    // 1. Executa SQ1
    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 0,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: all24Drivers,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq1State, tickContext, {
      persistState: true,
    })

    const eligibleSQ2 = resolveEligibleQualifyingParticipantsHelper({
      stageId: 'sq2',
      seasonId,
      currentRound: roundSprint,
      all24: all24Drivers,
    })

    // 2. Executa SQ2
    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId,
      round: roundSprint,
      playerCar1: {
        driverId: 'drv_1',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tire_c1',
        compound: 'medio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'drv_2',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tire_c2',
        compound: 'medio',
        wear: 10,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: eligibleSQ2,
      persistState: true,
    })
    CanonicalQualifyingRunner.simulateRemainingSession(sq2State, tickContext, {
      persistState: true,
    })

    const sq1Result = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq1',
    )!
    const sq2Result = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq2',
    )!

    const eligibleSQ3 = resolveEligibleQualifyingParticipantsHelper({
      stageId: 'sq3',
      seasonId,
      currentRound: roundSprint,
      all24: all24Drivers,
    })

    // SQ1 tem 18 classificados, SQ2 tem 10 classificados
    // SQ3 DEVE ter exatamente 10 participantes, e NÃO 18
    expect(eligibleSQ3).toHaveLength(10)
    expect(eligibleSQ3.length).not.toBe(sq1Result.advancingDriverIds.length)

    // Os 8 eliminados de SQ2 pertenciam a SQ1, mas NÃO estão em SQ3
    const sq2Eliminated = sq2Result.eliminatedDriverIds
    expect(sq2Eliminated).toHaveLength(8)
    for (const eliminatedId of sq2Eliminated) {
      expect(eligibleSQ3.some((p) => p.id === eliminatedId)).toBe(false)
    }
  })

  // C2-09: reload preserva sq1/sq2/sq3 sem colisão entre stages.
  it('C2-09: reload preserva sq1/sq2/sq3 sem colisao entre stages', () => {
    // Grava resultados simulados para sq1, sq2 e sq3
    const makeMockResult = (stageId: 'sq1' | 'sq2' | 'sq3', count: number) => ({
      stageId,
      seasonId,
      round: roundSprint,
      completedAt: new Date().toISOString(),
      entries: all24Drivers.slice(0, count).map((d, idx) => ({
        position: idx + 1,
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
        teamColor: d.teamColor,
        bestLapSec: 80 + idx * 0.1,
        bestLapTime: `1:20.${idx}00`,
        bestLapRecordedAtSec: idx * 10,
        compound: 'medio' as const,
        tyreSetId: `tire_${d.id}`,
        lapsCount: 3,
        isPlayer: idx < 2,
        carId: idx === 0 ? 'car1' : idx === 1 ? 'car2' : undefined,
        isEliminated: false,
      })),
      advancingDriverIds: all24Drivers
        .slice(0, stageId === 'sq1' ? 18 : stageId === 'sq2' ? 10 : 10)
        .map((d) => d.id),
      eliminatedDriverIds: all24Drivers
        .slice(stageId === 'sq1' ? 18 : stageId === 'sq2' ? 10 : 10, count)
        .map((d) => d.id),
    })

    canonicalQualifyingPersistenceService.saveStageResult(makeMockResult('sq1', 24))
    canonicalQualifyingPersistenceService.saveStageResult(makeMockResult('sq2', 18))
    canonicalQualifyingPersistenceService.saveStageResult(makeMockResult('sq3', 10))

    // Simula reload: lê do storage
    const loadedSq1 = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq1',
    )
    const loadedSq2 = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq2',
    )
    const loadedSq3 = canonicalQualifyingPersistenceService.readStageResult(
      seasonId,
      roundSprint,
      'sq3',
    )

    expect(loadedSq1).not.toBeNull()
    expect(loadedSq2).not.toBeNull()
    expect(loadedSq3).not.toBeNull()

    expect(loadedSq1?.stageId).toBe('sq1')
    expect(loadedSq2?.stageId).toBe('sq2')
    expect(loadedSq3?.stageId).toBe('sq3')

    expect(loadedSq1?.entries).toHaveLength(24)
    expect(loadedSq2?.entries).toHaveLength(18)
    expect(loadedSq3?.entries).toHaveLength(10)

    // Chaves distintas no storage
    const key1 = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      roundSprint,
      'sq1',
    )
    const key2 = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      roundSprint,
      'sq2',
    )
    const key3 = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      roundSprint,
      'sq3',
    )

    expect(key1).not.toBe(key2)
    expect(key2).not.toBe(key3)
    expect(key1).not.toBe(key3)
    expect(key1.endsWith('_sq1')).toBe(true)
    expect(key2.endsWith('_sq2')).toBe(true)
    expect(key3.endsWith('_sq3')).toBe(true)
  })

  // C2-10: qualificação principal (q1/q2/q3) permanece isolada, não compartilha stage com sq1/sq2/sq3.
  it('C2-10: qualificacao principal (q1/q2/q3) permanece isolada, nao compartilha stage com sq1/sq2/sq3', () => {
    // 1. Grava resultado em SQ1 e SQ2
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq1',
      seasonId,
      round: roundSprint,
      completedAt: new Date().toISOString(),
      entries: [],
      advancingDriverIds: ['drv_1'],
      eliminatedDriverIds: [],
    })

    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq2',
      seasonId,
      round: roundSprint,
      completedAt: new Date().toISOString(),
      entries: [],
      advancingDriverIds: ['drv_1'],
      eliminatedDriverIds: [],
    })

    // 2. Q1, Q2, Q3 e grid final continuam rigorosamente vazios/nulos
    expect(
      canonicalQualifyingPersistenceService.readStageResult(seasonId, roundSprint, 'q1'),
    ).toBeNull()
    expect(
      canonicalQualifyingPersistenceService.readStageResult(seasonId, roundSprint, 'q2'),
    ).toBeNull()
    expect(
      canonicalQualifyingPersistenceService.readStageResult(seasonId, roundSprint, 'q3'),
    ).toBeNull()
    expect(
      canonicalQualifyingPersistenceService.readCompleteQualifyingResult(seasonId, roundSprint),
    ).toBeNull()

    // 3. Chaves canônicas de SQ e Q não colidem
    const sq1Key = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      roundSprint,
      'sq1',
    )
    const q1Key = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      roundSprint,
      'q1',
    )
    expect(sq1Key).not.toBe(q1Key)
    expect(sq1Key.endsWith('_sq1')).toBe(true)
    expect(q1Key.endsWith('_q1')).toBe(true)

    const sq2Key = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      roundSprint,
      'sq2',
    )
    const q2Key = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      roundSprint,
      'q2',
    )
    expect(sq2Key).not.toBe(q2Key)

    const sq3Key = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      roundSprint,
      'sq3',
    )
    const q3Key = canonicalQualifyingPersistenceService.getStageResultKey(
      seasonId,
      roundSprint,
      'q3',
    )
    expect(sq3Key).not.toBe(q3Key)
  })

  // C2-11: aliases sprint_q1→sq1, sprint_q2→sq2, sprint_q3→sq3 normalizados corretamente.
  it('C2-11: aliases sprint_q1->sq1, sprint_q2->sq2, sprint_q3->sq3 normalizados corretamente', () => {
    // Entrada com aliases legados
    const rawSessions = ['sprint_q1', 'sprint_q2', 'sprint_q3']
    const normalized = normalizeCompletedSessions(rawSessions)

    // Deve conter as formas canônicas
    expect(normalized).toContain('sq1')
    expect(normalized).toContain('sq2')
    expect(normalized).toContain('sq3')
    expect(normalized).toContain('sprint_qualifying')

    // Verificação reversa: sq1 -> sprint_q1, sq2 -> sprint_q2, sq3 -> sprint_q3
    const fromCanonical = normalizeCompletedSessions(['sq1', 'sq2', 'sq3'])
    expect(fromCanonical).toContain('sq1')
    expect(fromCanonical).toContain('sprint_q1')
    expect(fromCanonical).toContain('sq2')
    expect(fromCanonical).toContain('sprint_q2')
    expect(fromCanonical).toContain('sq3')
    expect(fromCanonical).toContain('sprint_q3')

    // Confirmação de isolamento estrito: normalizar SQ não introduz sessões de Q principal
    expect(fromCanonical).not.toContain('q1')
    expect(fromCanonical).not.toContain('q2')
    expect(fromCanonical).not.toContain('q3')
    expect(fromCanonical).not.toContain('qualifying')
    expect(fromCanonical).not.toContain('race')
  })

  // C2-12: SQ1 libera SQ2 e SQ2 libera SQ3 (gating C1 sem regressão).
  it('C2-12: SQ1 libera SQ2 e SQ2 libera SQ3 (gating C1 sem regressao)', () => {
    const schedule = getCanonicalWeekendSchedule(roundSprint)
    expect(schedule).toEqual(['tp1', 'sq1', 'sq2', 'sq3', 'sprint_race', 'q1', 'q2', 'q3', 'race'])

    // Estado inicial: apenas tp1 completo
    const afterTL1 = ['tp1']
    expect(isSessionUnlocked('sq1', afterTL1, true)).toBe(true)
    expect(isSessionUnlocked('sq2', afterTL1, true)).toBe(false)
    expect(isSessionUnlocked('sq3', afterTL1, true)).toBe(false)
    expect(getNextRequiredWeekendSession(roundSprint, afterTL1)).toBe('sq1')

    // SQ1 concluído libera SQ2
    const afterSQ1 = ['tp1', 'sq1']
    expect(isSessionUnlocked('sq2', afterSQ1, true)).toBe(true)
    expect(isSessionUnlocked('sq3', afterSQ1, true)).toBe(false)
    expect(getNextRequiredWeekendSession(roundSprint, afterSQ1)).toBe('sq2')
    expect(
      resolveSessionVisualState({
        sessionId: 'sq2',
        activeSessionId: 'sq2',
        completedSessions: afterSQ1,
        isSprintRound: true,
      }),
    ).toBe('active')

    // SQ2 concluído libera SQ3
    const afterSQ2 = ['tp1', 'sq1', 'sq2']
    expect(isSessionUnlocked('sq3', afterSQ2, true)).toBe(true)
    expect(isSessionUnlocked('sprint_race', afterSQ2, true)).toBe(false)
    expect(getNextRequiredWeekendSession(roundSprint, afterSQ2)).toBe('sq3')
    expect(
      resolveSessionVisualState({
        sessionId: 'sq3',
        activeSessionId: 'sq3',
        completedSessions: afterSQ2,
        isSprintRound: true,
      }),
    ).toBe('active')

    // SQ3 concluído libera Sprint Race
    const afterSQ3 = ['tp1', 'sq1', 'sq2', 'sq3']
    expect(isSessionUnlocked('sprint_race', afterSQ3, true)).toBe(true)
    expect(getNextRequiredWeekendSession(roundSprint, afterSQ3)).toBe('sprint_race')
  })
})
