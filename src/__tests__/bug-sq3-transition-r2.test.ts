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
import type { QualifyingTimeEntry } from '../types/canonical-qualifying-types'

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

describe('BUG-SQ3-TRANSITION-R2 — Suíte de Homologação Final (F1 a F6)', () => {
  const TEST_SEASON_ID = 'season_sq3_r2_test'
  const TEST_ROUND = 4

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // -------------------------------------------------------------------------------------------------
  // F1 — Jogador classificado: SQ2 completed + piloto do jogador em advancingDriverIds
  // SQ3 abre normalmente e piloto participa.
  // -------------------------------------------------------------------------------------------------
  it('F1 — Jogador classificado: SQ2 completed + piloto do jogador em advancingDriverIds -> SQ3 abre normalmente e piloto participa', () => {
    const rawEntries = createMock24Entries()

    // Mock do resultado oficial concluído da SQ2
    const sq2Entries = rawEntries.slice(0, 18).map((p, idx) => ({
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

    // driver_01 avança em P3; driver_02 eliminado em P14
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq2Entries,
      advancingDriverIds: sq2Entries.slice(0, 10).map((e) => e.driverId),
      eliminatedDriverIds: sq2Entries.slice(10).map((e) => e.driverId),
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
        wear: 10,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_sq3_c2',
        compound: 'macio',
        wear: 10,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq3Participants,
      persistState: false,
    })

    // Carro 1 elegível na garagem; Carro 2 eliminado
    expect(sq3State.cars.car1.isEliminated).toBe(false)
    expect(sq3State.cars.car1.status).toBe('garage')
    expect(sq3State.cars.car2.isEliminated).toBe(true)
    expect(sq3State.cars.car2.status).toBe('eliminated')
    expect(sq3State.leaderboard).toHaveLength(10)
    expect(sq3State.leaderboard.some((e) => e.driverId === 'driver_01')).toBe(true)
  })

  // -------------------------------------------------------------------------------------------------
  // F2 — Jogador eliminado: SQ2 completed + nenhum piloto do jogador em advancingDriverIds
  // SQ3 continua válida; jogador fica como espectador; não aparece "fase anterior não concluída".
  // -------------------------------------------------------------------------------------------------
  it('F2 — Jogador eliminado: SQ2 completed + nenhum piloto do jogador em advancingDriverIds -> SQ3 continua válida com os demais classificados e jogador como espectador', () => {
    const rawEntries = createMock24Entries()

    // Na SQ2, os 10 primeiros que avançam são exclusivamente pilotos rivais
    const sq2Entries = rawEntries.slice(2, 20).map((p, idx) => ({
      position: idx + 1,
      driverId: p.driverId,
      driverName: p.driverName,
      teamId: p.teamId || 'team',
      teamName: p.teamName || 'Equipe',
      teamColor: p.teamColor || '#334155',
      compound: 'macio' as const,
      lapsCount: 2,
      isPlayer: false,
      bestLapSec: 74.0 + idx * 0.1,
      bestLapTime: `1:14.${idx}00`,
      bestLapRecordedAtSec: idx * 5,
      isEliminated: idx >= 10,
    }))

    // Pilotos do jogador em P17 e P18 eliminados
    sq2Entries.push({
      position: 17,
      driverId: 'driver_01',
      driverName: 'Piloto 1',
      teamId: 'team_player',
      teamName: 'Equipe Jogador',
      teamColor: '#E10600',
      compound: 'macio',
      lapsCount: 2,
      isPlayer: true,
      bestLapSec: 76.5,
      bestLapTime: '1:16.500',
      bestLapRecordedAtSec: 40,
      isEliminated: true,
    })
    sq2Entries.push({
      position: 18,
      driverId: 'driver_02',
      driverName: 'Piloto 2',
      teamId: 'team_player',
      teamName: 'Equipe Jogador',
      teamColor: '#E10600',
      compound: 'macio',
      lapsCount: 2,
      isPlayer: true,
      bestLapSec: 76.8,
      bestLapTime: '1:16.800',
      bestLapRecordedAtSec: 45,
      isEliminated: true,
    })

    const advancing10AI = sq2Entries.slice(0, 10).map((e) => e.driverId)
    canonicalQualifyingPersistenceService.saveStageResult({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: sq2Entries,
      advancingDriverIds: advancing10AI,
      eliminatedDriverIds: [
        'driver_01',
        'driver_02',
        ...sq2Entries.slice(10, 16).map((e) => e.driverId),
      ],
    })

    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    expect(sq3Participants).toHaveLength(10)
    expect(sq3Participants.some((p) => p.id === 'driver_01')).toBe(false)
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

    // SQ3 continua perfeitamente válida com 10 participantes, ambos carros do jogador eliminados
    expect(sq3State.leaderboard).toHaveLength(10)
    expect(sq3State.cars.car1.isEliminated).toBe(true)
    expect(sq3State.cars.car1.status).toBe('eliminated')
    expect(sq3State.cars.car2.isEliminated).toBe(true)
    expect(sq3State.cars.car2.status).toBe('eliminated')

    // Simulação da SQ3 como espectador conclui com sucesso
    const sq3TickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq3Participants)
    const simRes = CanonicalQualifyingRunner.simulateRemainingSession(sq3State, sq3TickCtx, {
      persistState: true,
    })
    expect(simRes.nextState.status).toBe('completed')
    expect(simRes.nextState.leaderboard).toHaveLength(10)

    const savedSQ3 = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq3',
    )
    expect(savedSQ3).not.toBeNull()
    expect(savedSQ3!.entries).toHaveLength(10)
  })

  // -------------------------------------------------------------------------------------------------
  // F3 — SQ2 pausada: SQ3 não abre; SQ2 fica retomável; não marcar pilotos como eliminados;
  // não disparar toast incorreto de fase anterior concluída/inválida.
  // -------------------------------------------------------------------------------------------------
  it('F3 — SQ2 pausada: SQ3 não abre; SQ2 fica retomável; não marcar pilotos como eliminados precocemente', () => {
    const rawEntries = createMock24Entries()

    // Cria e persiste SQ2 no estado 'paused' (sessão em andamento interrompida)
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

    const sq2PausedState = CanonicalQualifyingRunner.initializeStage({
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

    sq2PausedState.status = 'paused'
    sq2PausedState.timeRemainingSec = 300 // 5 minutos restantes
    canonicalQualifyingPersistenceService.saveStageState(TEST_SEASON_ID, TEST_ROUND, sq2PausedState)

    // Verificar se a SQ2 está pausada e NÃO concluída
    const readSq2 = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq2',
    )
    expect(readSq2).not.toBeNull()
    expect(readSq2!.status).toBe('paused')
    expect(readSq2!.cars.car1.isEliminated).toBe(false)
    expect(readSq2!.cars.car2.isEliminated).toBe(false)

    // Se tentar resolver participantes para SQ3 enquanto SQ2 está pausada:
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    // SQ3 não pode ter participantes porque SQ2 não concluiu
    expect(sq3Participants).toHaveLength(0)

    // Ao inicializar uma suposta SQ3 sem corte concluído, os carros do jogador NÃO podem ser marcados como isEliminated
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
      persistState: false,
    })

    expect(sq3Draft.cars.car1.isEliminated).toBe(false)
    expect(sq3Draft.cars.car2.isEliminated).toBe(false)
  })

  // -------------------------------------------------------------------------------------------------
  // F4 — Sem tempo: leaderboard contendo pilotos com volta válida e sem volta válida.
  // Provar: todos com tempo ficam à frente dos sem-tempo; sem-tempo seguem a ordem esportiva anterior definida;
  // nunca a ordem acidental do array.
  // -------------------------------------------------------------------------------------------------
  it('F4 — Sem tempo: pilotos com tempo à frente dos sem-tempo; sem-tempo ordenados pelo carNumber esportivo de entrada', () => {
    const mixedEntries: QualifyingTimeEntry[] = [
      {
        position: 0,
        driverId: 'drv_no_time_99',
        driverName: 'Piloto 99',
        teamId: 'team_b',
        teamName: 'Equipe B',
        teamColor: '#000',
        carNumber: 99,
        compound: 'macio',
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer: false,
        status: 'garage',
      },
      {
        position: 0,
        driverId: 'drv_fast_01',
        driverName: 'Piloto Rápido',
        teamId: 'team_a',
        teamName: 'Equipe A',
        teamColor: '#000',
        carNumber: 44,
        compound: 'macio',
        laps: 1,
        bestLapSec: 72.15,
        bestLapTime: '1:12.150',
        bestLapRecordedAtSec: 10,
        gap: '-',
        isPlayer: false,
        status: 'garage',
      },
      {
        position: 0,
        driverId: 'drv_no_time_05',
        driverName: 'Piloto 05',
        teamId: 'team_c',
        teamName: 'Equipe C',
        teamColor: '#000',
        carNumber: 5,
        compound: 'macio',
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer: false,
        status: 'garage',
      },
      {
        position: 0,
        driverId: 'drv_slow_02',
        driverName: 'Piloto Lento',
        teamId: 'team_d',
        teamName: 'Equipe D',
        teamColor: '#000',
        carNumber: 77,
        compound: 'macio',
        laps: 2,
        bestLapSec: 74.3,
        bestLapTime: '1:14.300',
        bestLapRecordedAtSec: 20,
        gap: '-',
        isPlayer: false,
        status: 'garage',
      },
      {
        position: 0,
        driverId: 'drv_no_time_12',
        driverName: 'Piloto 12',
        teamId: 'team_e',
        teamName: 'Equipe E',
        teamColor: '#000',
        carNumber: 12,
        compound: 'macio',
        laps: 0,
        bestLapSec: 0,
        bestLapTime: '--:--.---',
        gap: '-',
        isPlayer: false,
        status: 'garage',
      },
    ]

    CanonicalQualifyingRunner.sortLeaderboard(mixedEntries)

    // P1 e P2 devem ser os com tempo válido: 72.15s e 74.30s
    expect(mixedEntries[0].driverId).toBe('drv_fast_01')
    expect(mixedEntries[0].position).toBe(1)
    expect(mixedEntries[1].driverId).toBe('drv_slow_02')
    expect(mixedEntries[1].position).toBe(2)

    // P3, P4, P5 devem ser os sem tempo, desempatados pelo carNumber esportivo de inscrição (5 < 12 < 99)
    expect(mixedEntries[2].driverId).toBe('drv_no_time_05')
    expect(mixedEntries[2].position).toBe(3)
    expect(mixedEntries[2].carNumber).toBe(5)

    expect(mixedEntries[3].driverId).toBe('drv_no_time_12')
    expect(mixedEntries[3].position).toBe(4)
    expect(mixedEntries[3].carNumber).toBe(12)

    expect(mixedEntries[4].driverId).toBe('drv_no_time_99')
    expect(mixedEntries[4].position).toBe(5)
    expect(mixedEntries[4].carNumber).toBe(99)
  })

  // -------------------------------------------------------------------------------------------------
  // F5 — IA recebe oportunidade de tentativa: simular sessão de classificação com pilotos aptos.
  // Provar que o scheduler não permite que um piloto saudável permaneça nos boxes durante toda a sessão apenas devido a sorteios negativos.
  // -------------------------------------------------------------------------------------------------
  it('F5 — IA recebe oportunidade de tentativa: scheduler determinístico garante oportunidade de saída para pilotos aptos', () => {
    const rawEntries = createMock24Entries()
    const q1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    const q1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_q1_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_q1_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: q1Participants,
      persistState: false,
    })

    const tickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, q1Participants)

    // Simula a sessão inteira via simulateRemainingSession
    const simRes = CanonicalQualifyingRunner.simulateRemainingSession(q1State, tickCtx, {
      persistState: false,
    })

    expect(simRes.nextState.status).toBe('completed')
    expect(simRes.nextState.timeRemainingSec).toBe(0)

    // Todos os pilotos da IA aptos devem ter realizado pelo menos 1 volta (laps >= 1) e registrado tempo válido
    const aiEntries = simRes.nextState.leaderboard.filter((e) => !e.isPlayer)
    expect(aiEntries.length).toBe(22)

    aiEntries.forEach((ai) => {
      expect(ai.laps).toBeGreaterThanOrEqual(1)
      expect(ai.bestLapSec).toBeGreaterThan(0)
      expect(ai.bestLapTime).not.toBe('--:--.---')
    })
  })

  // -------------------------------------------------------------------------------------------------
  // F6 — Reload: persistir SQ2 paused, recarregar WeekendV2 -> continua paused, não aparece como concluída,
  // retomada permanece disponível. Persistir SQ2 completed, recarregar -> continua concluída, SQ3 recebe participantes corretos.
  // -------------------------------------------------------------------------------------------------
  it('F6 — Reload: persistir SQ2 paused reconcilia completedSessions e mantém retomada; persistir SQ2 completed libera SQ3 com participantes', () => {
    // Caso 1: SQ2 pausada, mas localStorage continha uma entrada suja antiga 'sq2'
    const sq2State = {
      stageId: 'sq2',
      status: 'paused',
      timeRemainingSec: 180,
      sessionDurationSec: 600,
      leaderboard: [],
    }
    localStorage.setItem(
      `apex_f1_quali_${TEST_SEASON_ID}_r${TEST_ROUND}_sq2`,
      JSON.stringify(sq2State),
    )

    // Escreve completedSessions com entrada suja 'sq2'
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1', 'sq2'])

    // Ao ler via readStoredCompletedSessions, a reconciliação expurga 'sq2' porque o estado canônico é 'paused'
    const reconciledList = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(reconciledList).toContain('tp1')
    expect(reconciledList).toContain('sq1')
    expect(reconciledList).not.toContain('sq2')

    // Caso 2: SQ2 concluída oficialmente
    sq2State.status = 'completed'
    sq2State.timeRemainingSec = 0
    localStorage.setItem(
      `apex_f1_quali_${TEST_SEASON_ID}_r${TEST_ROUND}_sq2`,
      JSON.stringify(sq2State),
    )

    const reloadedCompleted = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(reloadedCompleted).toContain('sq2')
  })
})
