import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { canonicalQualifyingPersistenceService } from '../services/canonicalQualifyingPersistenceService'
import { CanonicalQualifyingRunner } from '../services/canonicalQualifyingRunner'
import { resolveEligibleQualifyingDrivers } from '../services/qualifyingParticipantResolver'
import { CANONICAL_QUALIFYING_RULES } from '../types/canonical-qualifying-types'
import type {
  QualifyingDriverContext,
  QualifyingTickContext,
} from '../services/canonicalQualifyingRunner'

// Fixture canônica para os 24 pilotos inscritos (ordem de entrada arbitrária)
function createMock24Entries() {
  return Array.from({ length: 24 }, (_, i) => ({
    driverId: `driver_${String(i + 1).padStart(2, '0')}`,
    driverName: `Piloto ${i + 1}`,
    carId: i === 0 ? 'car1' : i === 1 ? 'car2' : undefined,
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
    gpName: 'Grande Prêmio de Teste',
    circuitName: 'Circuito Teste',
    lengthKm: 5.4,
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

describe('SPRINT-HANDOFF-01A — SQ1 Concluída Alimenta SQ2', () => {
  const TEST_SEASON_ID = 'season_sprint_handoff_test'
  const TEST_ROUND = 10

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('A. CLASSIFICADOS CORRETOS: SQ1 concluída alimenta SQ2 com exatamente os classificados pelas regras canônicas sem eliminados e sem seleção por índice', () => {
    const rawEntries = createMock24Entries()

    // 1. Resolve participantes iniciais da SQ1 usando o resolver canônico
    const sq1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    expect(sq1Participants).toHaveLength(24)

    // 2. Inicializa SQ1 com a assinatura real (objeto de parâmetros)
    const initialSq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    // 3. Fixture deliberada: tempos invertidos em relação à ordem de entrada
    // driver_24 registra o menor tempo (80.000s -> P1), driver_01 registra o maior tempo (84.600s -> P24).
    // SQ1 avança top 18 (driver_24 até driver_07). Eliminados: driver_06, driver_05, driver_04, driver_03, driver_02, driver_01.
    initialSq1State.leaderboard = sq1Participants.map((driver, idx) => {
      const driverIndex = idx + 1 // 1..24
      const lapTimeSec = 80.0 + (24 - driverIndex) * 0.2
      return {
        position: idx + 1,
        driverId: driver.id,
        driverName: driver.name,
        teamId: driver.teamId || 'team',
        teamName: driver.teamName || 'Equipe',
        teamColor: driver.teamColor || '#334155',
        carNumber: driver.carNumber || driverIndex,
        compound: 'macio' as const,
        laps: 2,
        bestLapSec: lapTimeSec,
        bestLapTime: `${Math.floor(lapTimeSec / 60)}:${(lapTimeSec % 60).toFixed(3).padStart(6, '0')}`,
        bestLapRecordedAtSec: idx * 10,
        gap: '+0.000',
        isPlayer: driver.id === 'driver_01' || driver.id === 'driver_02',
        carId:
          driver.id === 'driver_01'
            ? ('car1' as const)
            : driver.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    // 4. Finaliza SQ1 via motor canônico e salva o resultado oficial
    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq1Participants)
    const sq1Result = CanonicalQualifyingRunner.finalizeStage(initialSq1State, tickContext, {
      persistState: true,
    })

    expect(sq1Result.stageId).toBe('sq1')
    expect(sq1Result.advancingDriverIds).toHaveLength(CANONICAL_QUALIFYING_RULES.sq1.advancingCount) // 18
    expect(sq1Result.eliminatedDriverIds).toHaveLength(
      CANONICAL_QUALIFYING_RULES.sq1.eliminatedCount,
    ) // 6

    // O mais rápido (P1) deve ser driver_24 e o P18 deve ser driver_07
    expect(sq1Result.advancingDriverIds[0]).toBe('driver_24')
    expect(sq1Result.advancingDriverIds[17]).toBe('driver_07')

    // 5. Resolve participantes elegíveis para SQ2 via o resolvedor de produção
    const sq2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    // 1. Quantidade exata de classificados: 18
    expect(sq2Participants).toHaveLength(18)

    // 2. Ordem esportiva preservada: P1 é driver_24 (menor tempo na SQ1), não driver_01 (índice 0)
    expect(sq2Participants[0].id).toBe('driver_24')
    expect(sq2Participants[17].id).toBe('driver_07')

    // IDs exatamente iguais aos advancingDriverIds de SQ1
    expect(sq2Participants.map((p) => p.id)).toEqual(sq1Result.advancingDriverIds)

    // 3. Ausência total dos eliminados da SQ1 (driver_01 a driver_06)
    const sq2DriverIds = new Set(sq2Participants.map((p) => p.id))
    sq1Result.eliminatedDriverIds.forEach((elimId) => {
      expect(sq2DriverIds.has(elimId)).toBe(false)
    })
    expect(sq2DriverIds.has('driver_01')).toBe(false)
    expect(sq2DriverIds.has('driver_06')).toBe(false)

    // 4. Integridade dos dados do participante: driverId, equipe, carro preservados
    const p1 = sq2Participants[0]
    expect(p1.id).toBe('driver_24')
    expect(p1.teamId).toBe('team_12')
    expect(p1.carNumber).toBe(24)
  })

  it('B. SQ2 CONCLUÍDA ALIMENTA SQ3: SQ2 finalizada e persistida entrega participantes da SQ3 = advancingDriverIds da SQ2', () => {
    const rawEntries = createMock24Entries()

    // 1. Prepara SQ1 e salva resultado (top 18 avançam: driver_01 a driver_18)
    const sq1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    const initialSq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    initialSq1State.leaderboard = sq1Participants.map((driver, idx) => {
      const lapTimeSec = 78.0 + idx * 0.1
      return {
        position: idx + 1,
        driverId: driver.id,
        driverName: driver.name,
        teamId: driver.teamId || 'team',
        teamName: driver.teamName || 'Equipe',
        teamColor: driver.teamColor || '#334155',
        carNumber: driver.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: 2,
        bestLapSec: lapTimeSec,
        bestLapTime: `${Math.floor(lapTimeSec / 60)}:${(lapTimeSec % 60).toFixed(3).padStart(6, '0')}`,
        bestLapRecordedAtSec: idx * 5,
        gap: '+0.000',
        isPlayer: driver.id === 'driver_01' || driver.id === 'driver_02',
        carId:
          driver.id === 'driver_01'
            ? ('car1' as const)
            : driver.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const tickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq1Participants)
    const sq1Result = CanonicalQualifyingRunner.finalizeStage(initialSq1State, tickCtx, {
      persistState: true,
    })
    expect(sq1Result.advancingDriverIds).toHaveLength(18)

    // 2. Resolve participantes para SQ2 via resolvedor oficial
    const sq2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq2Participants).toHaveLength(18)

    // 3. Inicializa SQ2 com o runner canônico (ordem invertida nos tempos da SQ2: driver_18 mais rápido)
    const initialSq2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01_sq2',
        compound: 'macio',
        wear: 10,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02_sq2',
        compound: 'macio',
        wear: 10,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq2Participants,
      persistState: false,
    })

    // Na SQ2, os 18 pilotos disputam 10 vagas para a SQ3. Invertemos a ordem de tempos:
    initialSq2State.leaderboard = sq2Participants.map((driver, idx) => {
      const lapTimeSec = 76.0 + (18 - (idx + 1)) * 0.15
      return {
        position: idx + 1,
        driverId: driver.id,
        driverName: driver.name,
        teamId: driver.teamId || 'team',
        teamName: driver.teamName || 'Equipe',
        teamColor: driver.teamColor || '#334155',
        carNumber: driver.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: 2,
        bestLapSec: lapTimeSec,
        bestLapTime: `${Math.floor(lapTimeSec / 60)}:${(lapTimeSec % 60).toFixed(3).padStart(6, '0')}`,
        bestLapRecordedAtSec: idx * 5,
        gap: '+0.000',
        isPlayer: driver.id === 'driver_01' || driver.id === 'driver_02',
        carId:
          driver.id === 'driver_01'
            ? ('car1' as const)
            : driver.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const sq2Result = CanonicalQualifyingRunner.finalizeStage(initialSq2State, tickCtx, {
      persistState: true,
    })
    expect(sq2Result.stageId).toBe('sq2')
    expect(sq2Result.advancingDriverIds).toHaveLength(CANONICAL_QUALIFYING_RULES.sq2.advancingCount) // 10
    expect(sq2Result.eliminatedDriverIds).toHaveLength(
      CANONICAL_QUALIFYING_RULES.sq2.eliminatedCount,
    ) // 8

    // 4. Resolve participantes da SQ3 via o resolvedor de produção
    const sq3Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq3',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    expect(sq3Participants).toHaveLength(10)
    expect(sq3Participants.map((p) => p.id)).toEqual(sq2Result.advancingDriverIds)

    // Eliminados da SQ2 não entram na SQ3
    const sq3DriverIds = new Set(sq3Participants.map((p) => p.id))
    sq2Result.eliminatedDriverIds.forEach((elimId) => {
      expect(sq3DriverIds.has(elimId)).toBe(false)
    })
  })

  it('C. REPETIÇÃO E RETOMADA: repetir a leitura ou recarregar não altera os participantes nem causa duplicação', () => {
    const rawEntries = createMock24Entries()

    const sq1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    const initialSq1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    initialSq1State.leaderboard = sq1Participants.map((driver, idx) => {
      const lapTimeSec = 79.0 + (24 - idx) * 0.1
      return {
        position: idx + 1,
        driverId: driver.id,
        driverName: driver.name,
        teamId: driver.teamId || 'team',
        teamName: driver.teamName || 'Equipe',
        teamColor: driver.teamColor || '#334155',
        carNumber: driver.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: 1,
        bestLapSec: lapTimeSec,
        bestLapTime: `${Math.floor(lapTimeSec / 60)}:${(lapTimeSec % 60).toFixed(3).padStart(6, '0')}`,
        bestLapRecordedAtSec: idx * 5,
        gap: '+0.000',
        isPlayer: false,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const tickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq1Participants)
    CanonicalQualifyingRunner.finalizeStage(initialSq1State, tickCtx, { persistState: true })

    // Primeira chamada para resolver SQ2
    const firstCall = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    // Segunda chamada (simula recarga / re-render / reload de página)
    const secondCall = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    expect(firstCall).toHaveLength(18)
    expect(secondCall).toHaveLength(18)
    expect(firstCall.map((p) => p.id)).toEqual(secondCall.map((p) => p.id))

    // Sem duplicações
    const uniqueIds = new Set(secondCall.map((p) => p.id))
    expect(uniqueIds.size).toBe(18)
  })

  it('D. ISOLAMENTO: ausência de resultado válido de SQ1 bloqueia SQ2; resultado de Q1 não pode ser usado como substituto', () => {
    const rawEntries = createMock24Entries()

    // 1. Sem resultado algum da SQ1: SQ2 retorna lista vazia (bloqueio esportivo)
    const emptySQ2 = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(emptySQ2).toEqual([])

    // 2. Simula salvamento de Q1 da corrida principal na mesma rodada e temporada
    const q1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    const q1InitialState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 1',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 2',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
      },
      eligibleParticipants: q1Participants,
      persistState: false,
    })

    q1InitialState.leaderboard = q1Participants.map((driver, idx) => {
      const lapTimeSec = 81.0 + idx * 0.1
      return {
        position: idx + 1,
        driverId: driver.id,
        driverName: driver.name,
        teamId: driver.teamId || 'team',
        teamName: driver.teamName || 'Equipe',
        teamColor: driver.teamColor || '#334155',
        carNumber: driver.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: 1,
        bestLapSec: lapTimeSec,
        bestLapTime: `${Math.floor(lapTimeSec / 60)}:${(lapTimeSec % 60).toFixed(3).padStart(6, '0')}`,
        bestLapRecordedAtSec: idx * 5,
        gap: '+0.000',
        isPlayer: false,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const tickCtx = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, q1Participants)
    const q1Result = CanonicalQualifyingRunner.finalizeStage(q1InitialState, tickCtx, {
      persistState: true,
    })

    // Confirma que Q1 foi salvo com sucesso
    const q1Saved = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(q1Saved).not.toBeNull()
    expect(q1Saved?.stageId).toBe('q1')

    // SQ2 DEVE CONTINUAR BLOQUEADA (vazia), pois SQ1 ainda não foi realizada nesta rodada
    const sq2WithOnlyQ1 = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq2WithOnlyQ1).toEqual([])

    // Em contrapartida, Q2 principal agora deve ser liberada com os classificados de Q1
    const q2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(q2Participants).toHaveLength(18)
    expect(q2Participants.map((p) => p.id)).toEqual(q1Result.advancingDriverIds)
  })
})
