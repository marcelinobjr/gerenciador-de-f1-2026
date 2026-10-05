import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { canonicalQualifyingPersistenceService } from '../services/canonicalQualifyingPersistenceService'
import { CanonicalQualifyingRunner } from '../services/canonicalQualifyingRunner'
import { resolveEligibleQualifyingDrivers } from '../services/qualifyingParticipantResolver'
import { CANONICAL_QUALIFYING_RULES } from '../types/canonical-qualifying-types'
import type {
  QualifyingDriverContext,
  QualifyingTickContext,
} from '../services/canonicalQualifyingRunner'
import type { QualifyingStageState } from '../types/canonical-qualifying-types'

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
    gpName: 'Grande Prêmio de São Paulo Sprint',
    circuitName: 'Autódromo de Interlagos',
    lengthKm: 4.309,
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

describe('BUG-SQ3-TRANSITION — Transição para SQ3 com Pilotos do Jogador Eliminados', () => {
  const TEST_SEASON_ID = 'season_sq3_bug_test'
  const TEST_ROUND = 3

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // -------------------------------------------------------------------------------------------------
  // CENÁRIO PRINCIPAL:
  // Fim de semana Sprint; SQ1 concluída (24); SQ2 concluída com os dois pilotos do jogador eliminados;
  // SQ3 inicializa com os 10 classificados da IA; PLAY/SIMULAR RESTANTE executam sem toast impeditivo;
  // SQ3 finalizada gera resultado canônico P1–P10; buildSprintGridFromSQ3Result monta o grid 24 carros;
  // Sprint pronta para largar.
  // -------------------------------------------------------------------------------------------------
  it('Cenário Principal: SQ2 elimina os 2 pilotos do jogador -> SQ3 inicializa com 10 da IA, avança e simula, gera resultado P1-P10 e grid de 24 carros', () => {
    const rawEntries = createMock24Entries()

    // 1. SQ1: 24 participantes. Classificam 18.
    const sq1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq1Participants).toHaveLength(24)

    const sq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_sq1_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq1_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    // Tempos SQ1: driver_01 e driver_02 avançam entre os 18 primeiros
    sq1State.leaderboard = sq1Participants.map((p, idx) => ({
      position: idx + 1,
      driverId: p.id,
      driverName: p.name,
      teamId: p.teamId || 'team',
      teamName: p.teamName || 'Equipe',
      teamColor: p.teamColor || '#334155',
      carNumber: p.carNumber || idx + 1,
      compound: 'macio' as const,
      laps: 2,
      bestLapSec: 75.0 + idx * 0.1,
      bestLapTime: `1:15.${idx}00`,
      bestLapRecordedAtSec: idx * 5,
      gap: '+0.000',
      isPlayer: p.id === 'driver_01' || p.id === 'driver_02',
      carId:
        p.id === 'driver_01'
          ? ('car1' as const)
          : p.id === 'driver_02'
            ? ('car2' as const)
            : undefined,
      status: 'garage' as const,
      isEliminated: false,
    }))

    const tickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq1Participants)
    CanonicalQualifyingRunner.finalizeStage(sq1State, tickCtx, { persistState: true })

    // 2. SQ2: 18 participantes.
    // CONFIGURAÇÃO DELIBERADA DO BUG: os pilotos do jogador (driver_01 e driver_02) ficam em P17 e P18 (ELIMINADOS)
    const sq2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq2Participants).toHaveLength(18)

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
        wear: 10,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq2_c2',
        compound: 'macio',
        wear: 10,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: false,
    })

    // Na SQ2, os 10 primeiros que avançam são rivais (driver_03 a driver_12).
    // Os eliminados são driver_13..16 + driver_01 e driver_02.
    const advancingAI = sq2Participants
      .filter((p) => p.id !== 'driver_01' && p.id !== 'driver_02')
      .slice(0, 10)
    const eliminatedAI = sq2Participants
      .filter((p) => p.id !== 'driver_01' && p.id !== 'driver_02')
      .slice(10)
    const playerDrivers = sq2Participants.filter(
      (p) => p.id === 'driver_01' || p.id === 'driver_02',
    )

    const sq2FinalLeaderboard = [...advancingAI, ...eliminatedAI, ...playerDrivers]
    expect(sq2FinalLeaderboard).toHaveLength(18)

    sq2State.leaderboard = sq2FinalLeaderboard.map((p, idx) => ({
      position: idx + 1,
      driverId: p.id,
      driverName: p.name,
      teamId: p.teamId || 'team',
      teamName: p.teamName || 'Equipe',
      teamColor: p.teamColor || '#334155',
      carNumber: p.carNumber || idx + 1,
      compound: 'macio' as const,
      laps: 2,
      bestLapSec: 74.0 + idx * 0.1,
      bestLapTime: `1:14.${idx}00`,
      bestLapRecordedAtSec: idx * 5,
      gap: '+0.000',
      isPlayer: p.id === 'driver_01' || p.id === 'driver_02',
      carId:
        p.id === 'driver_01'
          ? ('car1' as const)
          : p.id === 'driver_02'
            ? ('car2' as const)
            : undefined,
      status: 'garage' as const,
      isEliminated: idx >= 10,
    }))

    const sq2Result = CanonicalQualifyingRunner.finalizeStage(sq2State, tickCtx, {
      persistState: true,
    })
    expect(sq2Result.advancingDriverIds).toHaveLength(10)
    expect(sq2Result.advancingDriverIds.includes('driver_01')).toBe(false)
    expect(sq2Result.advancingDriverIds.includes('driver_02')).toBe(false)
    expect(sq2Result.eliminatedDriverIds.includes('driver_01')).toBe(true)
    expect(sq2Result.eliminatedDriverIds.includes('driver_02')).toBe(true)

    // 3. SQ3: Resolução de participantes e Inicialização
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    // SQ3 deve ter exatamente os 10 pilotos da IA
    expect(sq3Participants).toHaveLength(10)
    sq3Participants.forEach((p) => {
      expect(p.id).not.toBe('driver_01')
      expect(p.id).not.toBe('driver_02')
    })

    // Inicialização da SQ3
    const sq3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_sq3_c1',
        compound: 'macio',
        wear: 20,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq3_c2',
        compound: 'macio',
        wear: 20,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: true,
    })

    // O leaderboard da SQ3 deve ter 10 pilotos e NÃO estar vazio
    expect(sq3State.leaderboard).toHaveLength(10)
    expect(sq3State.cars.car1.isEliminated).toBe(true)
    expect(sq3State.cars.car1.status).toBe('eliminated')
    expect(sq3State.cars.car2.isEliminated).toBe(true)
    expect(sq3State.cars.car2.status).toBe('eliminated')

    // 4. Execução de avanço de tempo e simulação restante no modo espectador
    const sq3TickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq3Participants)

    // Simula avanço de segundos (+1 min)
    const stepRes = CanonicalQualifyingRunner.advanceBySeconds(sq3State, 60, sq3TickCtx, {
      persistState: true,
    })
    expect(stepRes.nextState.status).toBe('paused')
    expect(stepRes.nextState.leaderboard).toHaveLength(10)

    // Simula o restante da sessão
    const simRemainingRes = CanonicalQualifyingRunner.simulateRemainingSession(
      stepRes.nextState,
      sq3TickCtx,
      {
        persistState: true,
      },
    )
    expect(simRemainingRes.nextState.status).toBe('completed')
    expect(simRemainingRes.nextState.timeRemainingSec).toBe(0)
    expect(simRemainingRes.nextState.leaderboard).toHaveLength(10)

    // O resultado canônico da SQ3 deve estar persistido e com 10 pilotos
    const sq3SavedResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq3',
    )
    expect(sq3SavedResult).not.toBeNull()
    expect(sq3SavedResult!.entries).toHaveLength(10)
    expect(sq3SavedResult!.entries[0].position).toBe(1)
    expect(sq3SavedResult!.entries[9].position).toBe(10)

    // 5. Grid da Sprint montado a partir da SQ3
    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )
    expect(sprintGrid).not.toBeNull()
    expect(sprintGrid!.finalGrid).toHaveLength(24)

    // P1-P10 definidos pela SQ3
    for (let i = 0; i < 10; i++) {
      expect(sprintGrid!.finalGrid[i].gridPosition).toBe(i + 1)
      expect(sprintGrid!.finalGrid[i].eliminationStage).toBe('Q3')
      expect(sprintGrid!.finalGrid[i].driverId).toBe(sq3SavedResult!.entries[i].driverId)
    }

    // Pilotos do jogador eliminados na SQ2 aparecem nas posições P11-P18
    const p11To18Ids = sprintGrid!.finalGrid.slice(10, 18).map((g) => g.driverId)
    expect(p11To18Ids).toContain('driver_01')
    expect(p11To18Ids).toContain('driver_02')
  })

  // -------------------------------------------------------------------------------------------------
  // CONTROLE A:
  // Piloto do jogador presente na SQ3 continua funcionando normalmente
  // -------------------------------------------------------------------------------------------------
  it('Controle A: Piloto do jogador presente na SQ3 continua funcionando normalmente com status de garagem e voltas', () => {
    const rawEntries = createMock24Entries()

    // Na SQ2, driver_01 se classifica para a SQ3 (P5) e driver_02 é eliminado
    const sq2ResultEntries = rawEntries.slice(0, 18).map((p, idx) => ({
      position: idx + 1,
      driverId: p.driverId,
      driverName: p.driverName,
      teamId: p.teamId || 'team',
      teamName: p.teamName || 'Equipe',
      teamColor: p.teamColor || '#334155',
      compound: 'macio' as const,
      lapsCount: 2,
      isPlayer: p.driverId === 'driver_01' || p.driverId === 'driver_02',
      bestLapSec: 74.0 + idx * 0.1,
      bestLapTime: `1:14.${idx}00`,
      bestLapRecordedAtSec: idx * 5,
      isEliminated: idx >= 10,
    }))

    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq2ResultEntries,
      advancingDriverIds: sq2ResultEntries.slice(0, 10).map((e) => e.driverId),
      eliminatedDriverIds: sq2ResultEntries.slice(10).map((e) => e.driverId),
    })

    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    expect(sq3Participants).toHaveLength(10)
    expect(sq3Participants.some((p) => p.id === 'driver_01')).toBe(true)
    expect(sq3Participants.some((p) => p.id === 'driver_02')).toBe(false)

    const sq3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_sq3_c1',
        compound: 'macio',
        wear: 20,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq3_c2',
        compound: 'macio',
        wear: 20,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: false,
    })

    // Carro 1 elegível na garagem, Carro 2 eliminado
    expect(sq3State.cars.car1.isEliminated).toBe(false)
    expect(sq3State.cars.car1.status).toBe('garage')
    expect(sq3State.cars.car2.isEliminated).toBe(true)
    expect(sq3State.cars.car2.status).toBe('eliminated')

    // Carro 1 pode receber ordem de ir para a pista
    const exitRes = CanonicalQualifyingRunner.orderCarExitToTrack(sq3State, 'car1')
    expect(exitRes.success).toBe(true)
    expect(sq3State.cars.car1.status).toBe('out_lap')

    // Carro 2 não pode sair
    const exitRes2 = CanonicalQualifyingRunner.orderCarExitToTrack(sq3State, 'car2')
    expect(exitRes2.success).toBe(false)
  })

  // -------------------------------------------------------------------------------------------------
  // CONTROLE B:
  // SQ2 sem resultado real -> SQ3 continua bloqueada (guard preservado)
  // -------------------------------------------------------------------------------------------------
  it('Controle B: SQ2 sem resultado real nem estado completado -> SQ3 retorna lista vazia e guard deve bloquear', () => {
    const rawEntries = createMock24Entries()

    // Não salva nenhum resultado ou estado de SQ2
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    // Sem resultado anterior, participantes elegíveis para SQ3 é vazio
    expect(sq3Participants).toHaveLength(0)

    // Se initializeStage for chamado com 0 participantes:
    const sq3State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_sq3_c1',
        compound: 'macio',
        wear: 20,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq3_c2',
        compound: 'macio',
        wear: 20,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: false,
    })

    expect(sq3State.leaderboard).toHaveLength(0)
  })

  // -------------------------------------------------------------------------------------------------
  // CONTROLE C:
  // Reload após SQ3 com jogador eliminado -> leaderboard da SQ3 não zera, sem fallback para a classificação principal
  // -------------------------------------------------------------------------------------------------
  it('Controle C: Reload após SQ3 com jogador eliminado preserva leaderboard sem zerar e sem cache envenenado', () => {
    const rawEntries = createMock24Entries()

    // Prepara e salva SQ2
    const sq2ResultEntries = rawEntries.slice(0, 18).map((p, idx) => ({
      position: idx + 1,
      driverId: p.driverId,
      driverName: p.driverName,
      teamId: p.teamId || 'team',
      teamName: p.teamName || 'Equipe',
      teamColor: p.teamColor || '#334155',
      compound: 'macio' as const,
      lapsCount: 2,
      isPlayer: p.driverId === 'driver_01' || p.driverId === 'driver_02',
      bestLapSec: 74.0 + idx * 0.1,
      bestLapTime: `1:14.${idx}00`,
      bestLapRecordedAtSec: idx * 5,
      isEliminated: idx >= 10,
    }))
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq2ResultEntries,
      advancingDriverIds: sq2ResultEntries.slice(0, 10).map((e) => e.driverId),
      eliminatedDriverIds: sq2ResultEntries.slice(10).map((e) => e.driverId),
    })

    // Salva deliberadamente um estado de SQ3 corrompido com leaderboard vazio (cache envenenado)
    const poisonedState: QualifyingStageState = {
      stageId: 'sq3',
      status: 'not_started',
      sessionDurationSec: 480,
      elapsedTimeSec: 0,
      timeRemainingSec: 480,
      simSpeed: 1,
      parcFermeActive: false,
      cars: {
        car1: {
          carId: 'car1',
          driverId: 'driver_01',
          driverName: 'Piloto 1',
          driverNumber: 1,
          status: 'eliminated',
          pitRequested: false,
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          currentTyreSetId: 't1',
          currentCompound: 'macio',
          tyreWear: 0,
          fuelKg: 15,
          outLapsDone: 0,
          flyingLapsDone: 0,
          inLapsDone: 0,
          totalLaps: 0,
          currentLapProgressPct: 0,
          isEliminated: true,
          eliminatedInStage: 'sq2',
        },
        car2: {
          carId: 'car2',
          driverId: 'driver_02',
          driverName: 'Piloto 2',
          driverNumber: 2,
          status: 'eliminated',
          pitRequested: false,
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          currentTyreSetId: 't2',
          currentCompound: 'macio',
          tyreWear: 0,
          fuelKg: 15,
          outLapsDone: 0,
          flyingLapsDone: 0,
          inLapsDone: 0,
          totalLaps: 0,
          currentLapProgressPct: 0,
          isEliminated: true,
          eliminatedInStage: 'sq2',
        },
      },
      leaderboard: [], // CACHE ENVENENADO VAZIO
      lapHistory: {},
      radioFeed: [],
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, poisonedState)

    // Resolve participantes elegíveis
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq3Participants).toHaveLength(10)

    // Chama initializeStage: a correção deve IGNORAR o cache vazio e reinicializar com os 10 participantes elegíveis
    const reloadedStage = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_sq3_c1',
        compound: 'macio',
        wear: 20,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq3_c2',
        compound: 'macio',
        wear: 20,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: true,
    })

    expect(reloadedStage.leaderboard).toHaveLength(10)
    expect(reloadedStage.stageId).toBe('sq3')
  })

  // -------------------------------------------------------------------------------------------------
  // CONTROLE D:
  // Grid da Sprint isolado do grid da corrida principal
  // -------------------------------------------------------------------------------------------------
  it('Controle D: Grid da Sprint e Grid da Corrida Principal mantêm isolamento total', () => {
    const rawEntries = createMock24Entries()

    // 1. Simula qualificação Sprint (SQ1, SQ2, SQ3) com pole para driver_05
    const sq1Entries = rawEntries.map((e, idx) => ({
      position: idx + 1,
      driverId: e.driverId,
      driverName: e.driverName,
      teamId: e.teamId,
      teamName: e.teamName,
      teamColor: e.teamColor,
      compound: 'macio' as const,
      lapsCount: 2,
      isPlayer: e.isPlayerTeam,
      bestLapSec: 75.0 + idx * 0.1,
      bestLapTime: `1:15.${idx}00`,
      bestLapRecordedAtSec: idx * 5,
      isEliminated: idx >= 18,
    }))
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq1Entries,
      advancingDriverIds: sq1Entries.slice(0, 18).map((e) => e.driverId),
      eliminatedDriverIds: sq1Entries.slice(18).map((e) => e.driverId),
    })

    const sq2Entries = sq1Entries.slice(0, 18).map((e, idx) => ({
      ...e,
      bestLapSec: 73.0 + idx * 0.1,
      isEliminated: idx >= 10,
    }))
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq2Entries,
      advancingDriverIds: sq2Entries.slice(0, 10).map((e) => e.driverId),
      eliminatedDriverIds: sq2Entries.slice(10).map((e) => e.driverId),
    })

    // driver_05 faz a pole na Sprint
    const sq3Entries = sq2Entries.slice(0, 10).map((e, idx) => ({
      ...e,
      bestLapSec: e.driverId === 'driver_05' ? 71.0 : 72.0 + idx * 0.1,
      isEliminated: false,
    }))
    sq3Entries.sort((a, b) => a.bestLapSec - b.bestLapSec)
    sq3Entries.forEach((e, idx) => {
      e.position = idx + 1
    })

    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq3Entries,
      advancingDriverIds: sq3Entries.map((e) => e.driverId),
      eliminatedDriverIds: [],
    })

    // 2. Simula qualificação Principal (Q1, Q2, Q3) com pole para driver_01
    const q1Entries = rawEntries.map((e, idx) => ({
      position: idx + 1,
      driverId: e.driverId,
      driverName: e.driverName,
      teamId: e.teamId,
      teamName: e.teamName,
      teamColor: e.teamColor,
      compound: 'macio' as const,
      lapsCount: 2,
      isPlayer: e.isPlayerTeam,
      bestLapSec: 76.0 + idx * 0.1,
      bestLapTime: `1:16.${idx}00`,
      bestLapRecordedAtSec: idx * 5,
      isEliminated: idx >= 18,
    }))
    const q1Res = {
      stageId: 'q1' as const,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: q1Entries,
      advancingDriverIds: q1Entries.slice(0, 18).map((e) => e.driverId),
      eliminatedDriverIds: q1Entries.slice(18).map((e) => e.driverId),
    }
    canonicalQualifyingPersistenceService.saveStageResult(q1Res)

    const q2Entries = q1Entries.slice(0, 18).map((e, idx) => ({
      ...e,
      bestLapSec: 74.0 + idx * 0.1,
      isEliminated: idx >= 10,
    }))
    const q2Res = {
      stageId: 'q2' as const,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: q2Entries,
      advancingDriverIds: q2Entries.slice(0, 10).map((e) => e.driverId),
      eliminatedDriverIds: q2Entries.slice(10).map((e) => e.driverId),
    }
    canonicalQualifyingPersistenceService.saveStageResult(q2Res)

    // driver_01 faz a pole na corrida Principal
    const q3Entries = q2Entries.slice(0, 10).map((e, idx) => ({
      ...e,
      bestLapSec: e.driverId === 'driver_01' ? 70.0 : 71.5 + idx * 0.1,
      isEliminated: false,
    }))
    q3Entries.sort((a, b) => a.bestLapSec - b.bestLapSec)
    q3Entries.forEach((e, idx) => {
      e.position = idx + 1
    })
    const q3Res = {
      stageId: 'q3' as const,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: q3Entries,
      advancingDriverIds: q3Entries.map((e) => e.driverId),
      eliminatedDriverIds: [],
    }
    canonicalQualifyingPersistenceService.saveStageResult(q3Res)

    // Monta ambos os grids
    const sprintGrid = canonicalQualifyingPersistenceService.buildSprintGridFromSQ3Result(
      TEST_SEASON_ID,
      TEST_ROUND,
    )
    const mainGrid = canonicalQualifyingPersistenceService.buildCombinedFinalGrid({
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      q1Result: q1Res,
      q2Result: q2Res,
      q3Result: q3Res,
    })

    expect(sprintGrid).not.toBeNull()
    expect(mainGrid).not.toBeNull()

    // Pole da Sprint é driver_05, Pole da Corrida Principal é driver_01
    expect(sprintGrid!.poleDriverId).toBe('driver_05')
    expect(sprintGrid!.finalGrid[0].driverId).toBe('driver_05')

    expect(mainGrid.poleDriverId).toBe('driver_01')
    expect(mainGrid.finalGrid[0].driverId).toBe('driver_01')
  })

  // -------------------------------------------------------------------------------------------------
  // CONTROLE FALLBACK DE RESOLUÇÃO:
  // Se advancingDriverIds ausente no resultado da SQ2 mas SQ2 está salva como completed no stageState,
  // resolveEligibleQualifyingDrivers deriva os classificados via CANONICAL_QUALIFYING_RULES.advancingCount
  // -------------------------------------------------------------------------------------------------
  it('Fallback de resolução: se advancingDriverIds ausente no resultado de SQ2, recorre a readStageState completed', () => {
    const rawEntries = createMock24Entries()

    // Salva stageResult com advancingDriverIds vazio
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: [],
      advancingDriverIds: [],
      eliminatedDriverIds: [],
    })

    // Salva stageState como completed com leaderboard ordenado de 18 carros
    const parentState: QualifyingStageState = {
      stageId: 'sq2',
      status: 'completed',
      sessionDurationSec: 600,
      elapsedTimeSec: 600,
      timeRemainingSec: 0,
      simSpeed: 1,
      parcFermeActive: true,
      cars: {
        car1: {
          carId: 'car1',
          driverId: 'driver_01',
          driverName: 'Piloto 1',
          driverNumber: 1,
          status: 'eliminated',
          pitRequested: false,
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          currentTyreSetId: 't1',
          currentCompound: 'macio',
          tyreWear: 0,
          fuelKg: 15,
          outLapsDone: 0,
          flyingLapsDone: 0,
          inLapsDone: 0,
          totalLaps: 0,
          currentLapProgressPct: 0,
          isEliminated: true,
          eliminatedInStage: 'sq2',
        },
        car2: {
          carId: 'car2',
          driverId: 'driver_02',
          driverName: 'Piloto 2',
          driverNumber: 2,
          status: 'eliminated',
          pitRequested: false,
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          currentTyreSetId: 't2',
          currentCompound: 'macio',
          tyreWear: 0,
          fuelKg: 15,
          outLapsDone: 0,
          flyingLapsDone: 0,
          inLapsDone: 0,
          totalLaps: 0,
          currentLapProgressPct: 0,
          isEliminated: true,
          eliminatedInStage: 'sq2',
        },
      },
      leaderboard: rawEntries.slice(0, 18).map((p, idx) => ({
        position: idx + 1,
        driverId: p.driverId,
        driverName: p.driverName,
        teamId: p.teamId || 'team',
        teamName: p.teamName || 'Equipe',
        teamColor: p.teamColor || '#334155',
        carNumber: p.driverNumber || idx + 1,
        compound: 'macio' as const,
        laps: 2,
        bestLapSec: 74.0 + idx * 0.1,
        bestLapTime: `1:14.${idx}00`,
        bestLapRecordedAtSec: idx * 5,
        gap: '+0.000',
        isPlayer: false,
        status: 'garage' as const,
        isEliminated: idx >= 10,
      })),
      lapHistory: {},
      radioFeed: [],
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, parentState)

    // Resolve participantes para SQ3
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    // Deve derivar os top 10 do parentState via CANONICAL_QUALIFYING_RULES.sq2.advancingCount (10)
    expect(sq3Participants).toHaveLength(CANONICAL_QUALIFYING_RULES.sq2.advancingCount)
    expect(sq3Participants.map((p) => p.id)).toEqual(rawEntries.slice(0, 10).map((p) => p.driverId))
  })
})
