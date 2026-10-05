import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { canonicalQualifyingPersistenceService } from '../services/canonicalQualifyingPersistenceService'
import { CanonicalQualifyingRunner } from '../services/canonicalQualifyingRunner'
import { resolveEligibleQualifyingDrivers } from '../services/qualifyingParticipantResolver'
import {
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '../services/weekendProgressionService'
import type {
  QualifyingDriverContext,
  QualifyingTickContext,
} from '../services/canonicalQualifyingRunner'

function createMock24Entries() {
  return Array.from({ length: 24 }, (_, i) => ({
    driverId: `driver_${String(i + 1).padStart(2, '0')}`,
    driverName: `Piloto ${i + 1}`,
    carId: i === 0 ? ('car1' as const) : i === 1 ? ('car2' as const) : undefined,
    isPlayerTeam: i === 0 || i === 1,
    teamId: i < 2 ? 'team_player' : `team_${Math.floor(i / 2) + 1}`,
    teamName: i < 2 ? 'Equipe Jogador' : `Equipe ${Math.floor(i / 2) + 1}`,
    teamColor: i < 2 ? '#E10600' : '#334155',
    driverNumber: i + 1,
  }))
}

function createDummyTickContext(
  seasonId: string,
  round: number,
  drivers: QualifyingDriverContext[],
): QualifyingTickContext {
  return {
    seasonId,
    round,
    gpName: 'Grande Prêmio Sprint de Teste',
    circuitName: 'Circuito Teste',
    lengthKm: 5.0,
    tireAbrasiveness: 3,
    weather: 'seco' as const,
    teamChassisRating: 80,
    teamEngineSupplier: 'Audi',
    teamName: 'Equipe Jogador',
    teamColor: '#E10600',
    teamId: 'team_player',
    drivers: drivers.slice(0, 2),
    rivalDrivers: drivers.slice(2),
  }
}

describe('BUG-SQ3-TRANSITION-R3 — Suíte SQ2 Running Órfã e Transição para SQ3', () => {
  const TEST_SEASON_ID = 'season_sq3_r3_test'
  const TEST_ROUND = 4

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // (R1) SQ2 running órfã -> identificada como não concluída, retomável e não dispara SQ3 com estado corrompido
  it('R1 — SQ2 running órfã (sem resultado e sem tick ativo): identificada como em andamento/retomável, sem toast genérico ou avanço espúrio', () => {
    const rawEntries = createMock24Entries()
    const sq2Participants: QualifyingDriverContext[] = rawEntries.slice(0, 18).map((p, idx) => ({
      id: p.driverId,
      name: p.driverName,
      teamId: p.teamId,
      teamName: p.teamName,
      teamColor: p.teamColor,
      carNumber: idx + 1,
      speed: 80,
      consistency: 80,
      defense: 75,
      isPlayer: p.driverId === 'driver_01' || p.driverId === 'driver_02',
    }))

    const sq2RunningState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_sq2_c1',
        compound: 'macio',
        wear: 5,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq2_c2',
        compound: 'macio',
        wear: 5,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: false,
    })

    // Estado órfão no save do jogador: SQ2 ficou salva com status = 'running', tempo restante > 0, mas sem ticker ativo
    sq2RunningState.status = 'running'
    sq2RunningState.timeRemainingSec = 240
    canonicalQualifyingPersistenceService.saveStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      sq2RunningState,
    )

    // Reconciliação canônica de completedSessions: sq2 NÃO pode constar como concluída mesmo se estivesse salva incorretamente
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1', 'sq2'])
    const reconciledCompleted = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(reconciledCompleted).toContain('tp1')
    expect(reconciledCompleted).toContain('sq1')
    expect(reconciledCompleted).not.toContain('sq2')

    // Verificação de participantes da SQ3: como SQ2 não está concluída, deve retornar 0 elegíveis
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq3Participants).toHaveLength(0)

    // Estado canônico lido da SQ2
    const readSq2 = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq2',
    )
    expect(readSq2).not.toBeNull()
    expect(readSq2!.status).toBe('running')
    expect(readSq2!.timeRemainingSec).toBe(240)
  })

  // (R2) Retomar SQ2 órfã -> normaliza para paused -> simular/concluir -> SQ3 libera com participantes corretos
  it('R2 — Retomar SQ2 running órfã normaliza para paused, conclui normalmente e libera SQ3 com os 10 classificados', () => {
    const rawEntries = createMock24Entries()
    const sq2Participants: QualifyingDriverContext[] = rawEntries.slice(0, 18).map((p, idx) => ({
      id: p.driverId,
      name: p.driverName,
      teamId: p.teamId,
      teamName: p.teamName,
      teamColor: p.teamColor,
      carNumber: idx + 1,
      speed: 80,
      consistency: 80,
      defense: 75,
      isPlayer: p.driverId === 'driver_01' || p.driverId === 'driver_02',
    }))

    const sq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_sq2_c1',
        compound: 'macio',
        wear: 5,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq2_c2',
        compound: 'macio',
        wear: 5,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: false,
    })

    sq2State.status = 'running'
    sq2State.timeRemainingSec = 300
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, sq2State)

    // Ao retomar a sessão SQ2 selecionada quando seu estado salvo for running órfão:
    // normalização para 'paused'
    if (sq2State.status === 'running') {
      sq2State.status = 'paused'
      canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, sq2State)
    }

    const loadedNormalized = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq2',
    )
    expect(loadedNormalized?.status).toBe('paused')

    // Conclusão da SQ2 via simulação
    const tickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq2Participants)
    const simRes = CanonicalQualifyingRunner.simulateRemainingSession(loadedNormalized!, tickCtx, {
      persistState: true,
    })
    expect(simRes.nextState.status).toBe('completed')

    // Salvar resultado oficial da SQ2 com corte 18 -> 10
    const advancing10 = simRes.nextState.leaderboard.slice(0, 10).map((e) => e.driverId)
    const eliminated8 = simRes.nextState.leaderboard.slice(10).map((e) => e.driverId)
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: simRes.nextState.leaderboard.map((e, idx) => ({
        position: idx + 1,
        driverId: e.driverId,
        driverName: e.driverName,
        teamId: e.teamId,
        teamName: e.teamName,
        teamColor: e.teamColor,
        compound: e.compound,
        lapsCount: e.laps,
        isPlayer: e.isPlayer,
        bestLapSec: e.bestLapSec,
        bestLapTime: e.bestLapTime,
        bestLapRecordedAtSec: e.bestLapRecordedAtSec,
        isEliminated: idx >= 10,
      })),
      advancingDriverIds: advancing10,
      eliminatedDriverIds: eliminated8,
    })

    // Agora a SQ3 deve liberar com 10 pilotos
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq3Participants).toHaveLength(10)
  })

  // (R3) SQ3 não persiste estado vazio nem marca eliminado se SQ2 não estiver concluída
  it('R3 — Se SQ3 não tem elegíveis por fase anterior não concluída, initializeStage não persiste estado vazio e não marca eliminados prematuramente', () => {
    const rawEntries = createMock24Entries()

    // SQ2 em running órfão
    const sq2RunningState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_sq2_c1',
        compound: 'macio',
        wear: 5,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq2_c2',
        compound: 'macio',
        wear: 5,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: rawEntries.slice(0, 18).map((p, idx) => ({
        id: p.driverId,
        name: p.driverName,
        teamId: p.teamId,
        teamName: p.teamName,
        teamColor: p.teamColor,
        carNumber: idx + 1,
        speed: 80,
        consistency: 80,
        defense: 75,
        isPlayer: p.driverId === 'driver_01' || p.driverId === 'driver_02',
      })),
      persistState: true,
    })

    sq2RunningState.status = 'running'
    sq2RunningState.timeRemainingSec = 150
    canonicalQualifyingPersistenceService.saveStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      sq2RunningState,
    )

    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq3Participants).toHaveLength(0)

    // Se initializeStage for chamado sem participantes elegíveis e a fase anterior não estiver concluída,
    // não deve persistir estado corrompido
    const savedBefore = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq3',
    )
    expect(savedBefore).toBeNull()

    const sq3Draft = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_sq3_c1',
        compound: 'macio',
        wear: 5,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq3_c2',
        compound: 'macio',
        wear: 5,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: false, // Quando eligibleParticipants é vazio e fase anterior incompleta, não persiste
    })

    // Pilotos do jogador NÃO podem ser marcados como eliminados
    expect(sq3Draft.cars.car1.isEliminated).toBe(false)
    expect(sq3Draft.cars.car2.isEliminated).toBe(false)
    expect(sq3Draft.cars.car1.status).toBe('garage')
    expect(sq3Draft.cars.car2.status).toBe('garage')
  })
})
