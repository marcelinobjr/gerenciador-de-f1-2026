import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { canonicalQualifyingPersistenceService } from '../services/canonicalQualifyingPersistenceService'
import { CanonicalQualifyingRunner } from '../services/canonicalQualifyingRunner'
import { CANONICAL_QUALIFYING_RULES } from '../types/canonical-qualifying-types'
import type { QualifyingStageState, QualifyingStageResult } from '../types/canonical-qualifying-types'
import type { QualifyingDriverContext, QualifyingTickContext } from '../services/canonicalQualifyingRunner'

// Mock / fixture para os 24 pilotos em ordem NÃO classificada (ex: ordem arbitrária)
function createMock24Drivers(): QualifyingDriverContext[] {
  return Array.from({ length: 24 }, (_, i) => ({
    id: `driver_${String(i + 1).padStart(2, '0')}`,
    name: `Piloto ${i + 1}`,
    speed: 75 + (i % 10),
    consistency: 80,
    defense: 75,
    teamId: `team_${Math.floor(i / 2) + 1}`,
    teamName: `Equipe ${Math.floor(i / 2) + 1}`,
    teamColor: '#334155',
    carNumber: i + 1,
  }))
}

function createDummyTickContext(): QualifyingTickContext {
  return {
    trackGrip: 1.0,
    ambientTemp: 22,
    trackTemp: 28,
    isWet: false,
    playerDriverIds: ['driver_01', 'driver_02'],
    rivalDrivers: [],
  }
}

// Resolução de participantes da SQ2 com base canônica idêntica à de WeekendV2Page
function resolveSQ2Participants(
  seasonId: string,
  round: number,
  all24: QualifyingDriverContext[],
): QualifyingDriverContext[] {
  const sq1Res = canonicalQualifyingPersistenceService.readStageResult(seasonId, round, 'sq1')
  if (sq1Res && sq1Res.advancingDriverIds && sq1Res.advancingDriverIds.length > 0) {
    const advSet = new Set(sq1Res.advancingDriverIds)
    const participantsMap = new Map(all24.map((p) => [p.id, p]))
    const orderedClassified: QualifyingDriverContext[] = []
    for (const driverId of sq1Res.advancingDriverIds) {
      const found = participantsMap.get(driverId)
      if (found) {
        orderedClassified.push(found)
      }
    }
    if (orderedClassified.length > 0) {
      return orderedClassified
    }
    return all24.filter((p) => advSet.has(p.id))
  }
  return []
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
    const all24 = createMock24Drivers()

    // Cria runner canônico com 24 pilotos para SQ1
    const initialSq1State: QualifyingStageState = CanonicalQualifyingRunner.initializeStage(
      'sq1',
      all24,
      120, // 2 horas (120 min)
    )

    // Fixture deliberada: tempos ordenados de forma invertida aos IDs
    // O piloto driver_24 faz a melhor volta (P1), driver_23 P2, ..., driver_01 P24.
    // SQ1 avança top 18 (driver_24 até driver_07). Eliminados: driver_06, driver_05, driver_04, driver_03, driver_02, driver_01 (6 pilotos).
    initialSq1State.leaderboard = all24.map((driver, idx) => {
      const driverIndex = idx + 1 // 1..24
      // Tempo: menor para driver_24 (80000ms), maior para driver_01 (84600ms)
      const lapTimeMs = 80000 + (24 - driverIndex) * 200
      return {
        position: idx + 1,
        driverId: driver.id,
        driverName: driver.name,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        carNumber: driver.carNumber,
        bestLapSec: lapTimeMs / 1000,
        bestLapTime: `${Math.floor(lapTimeMs / 60000)}:${((lapTimeMs % 60000) / 1000).toFixed(3)}`,
        gap: '+0.000',
        laps: 2,
        isPlayer: driver.id === 'driver_01' || driver.id === 'driver_02',
        bestLapTimeMs,
        gapToLeaderMs: 0,
        gapToAheadMs: 0,
        sector1Ms: lapTimeMs / 3,
        sector2Ms: lapTimeMs / 3,
        sector3Ms: lapTimeMs / 3,
        lapsCompleted: 2,
        status: 'in_garage',
        compound: 'soft',
        eliminated: false,
        onHotLap: false,
      }
    })

    // Finaliza SQ1 via método canônico da classe
    const dummyCtx = createDummyTickContext()
    const sq1Result: QualifyingStageResult = CanonicalQualifyingRunner.finalizeStage(
      initialSq1State,
      dummyCtx,
    )

    expect(sq1Result.stageId).toBe('sq1')
    expect(sq1Result.advancingDriverIds.length).toBe(CANONICAL_QUALIFYING_RULES.sq1.advancingCount) // 18
    expect(sq1Result.eliminatedDriverIds.length).toBe(CANONICAL_QUALIFYING_RULES.sq1.eliminatedCount) // 6

    // Salva o resultado canônico da SQ1 no serviço de persistência
    canonicalQualifyingPersistenceService.saveStageResult(sq1Result)

    // Agora resolve participantes para a SQ2
    const sq2Participants = resolveSQ2Participants(TEST_SEASON_ID, TEST_ROUND, all24)

    // 1. Quantidade exata de classificados: 18
    expect(sq2Participants.length).toBe(18)

    // 2. O P1 deve ser driver_24 (pois teve o menor tempo), não driver_01 (índice 0)
    expect(sq2Participants[0].id).toBe('driver_24')
    expect(sq2Participants[17].id).toBe('driver_07')

    // 3. Ausência total dos eliminados na SQ2
    const sq2DriverIds = new Set(sq2Participants.map((p) => p.id))
    sq1Result.eliminatedDriverIds.forEach((elimId) => {
      expect(sq2DriverIds.has(elimId)).toBe(false)
    })

    // 4. Integridade dos dados do participante: driverId, equipe, carro preservados
    const p1 = sq2Participants[0]
    expect(p1.teamId).toBe('team_12')
    expect(p1.carNumber).toBe(24)
  })

  it('B. RESULTADO DE ORIGEM PRESERVADO: SQ1 mantém resultado completo (incluindo eliminados) e SQ2 inicia como nova sessão sem voltas transportadas', () => {
    const all24 = createMock24Drivers()

    const initialSq1State = CanonicalQualifyingRunner.initializeStage('sq1', all24, 120)

    initialSq1State.leaderboard = all24.map((driver, idx) => {
      const lapTimeMs = 78000 + idx * 150
      return {
        position: idx + 1,
        driverId: driver.id,
        driverName: driver.name,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        carNumber: driver.carNumber,
        bestLapSec: lapTimeMs / 1000,
        bestLapTime: `${Math.floor(lapTimeMs / 60000)}:${((lapTimeMs % 60000) / 1000).toFixed(3)}`,
        gap: '+0.000',
        laps: 1,
        isPlayer: false,
        bestLapTimeMs: lapTimeMs,
        gapToLeaderMs: 0,
        gapToAheadMs: 0,
        sector1Ms: 26000,
        sector2Ms: 26000,
        sector3Ms: 26000,
        lapsCompleted: 1,
        status: 'in_garage',
        compound: 'soft',
        eliminated: false,
        onHotLap: false,
      }
    })

    const dummyCtx = createDummyTickContext()
    const sq1Result = CanonicalQualifyingRunner.finalizeStage(initialSq1State, dummyCtx)
    canonicalQualifyingPersistenceService.saveStageResult(sq1Result)

    // Verifica que SQ1 está intacta na persistência
    const readBackSQ1 = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq1',
    )
    expect(readBackSQ1).not.toBeNull()
    expect(readBackSQ1?.finalClassification.length).toBe(24)
    expect(readBackSQ1?.eliminatedDriverIds.length).toBe(6)
    expect(readBackSQ1?.advancingDriverIds.length).toBe(18)

    // Inicializa a SQ2 com os participantes apurados da SQ1
    const sq2Participants = resolveSQ2Participants(TEST_SEASON_ID, TEST_ROUND, all24)
    expect(sq2Participants.length).toBe(18)

    const sq2InitialState = CanonicalQualifyingRunner.initializeStage('sq2', sq2Participants, 120)

    // SQ2 deve ser uma nova sessão: sem voltas completadas inicialmente
    expect(sq2InitialState.stageId).toBe('sq2')
    expect(sq2InitialState.status).toBe('in_progress')
    sq2InitialState.leaderboard.forEach((entry) => {
      expect(entry.bestLapTimeMs).toBeNull()
      expect(entry.lapsCompleted).toBe(0)
    })
  })

  it('C. REPETIÇÃO E RETOMADA: repetir a leitura ou recarregar não altera os participantes nem causa duplicação', () => {
    const all24 = createMock24Drivers()

    const initialSq1State = CanonicalQualifyingRunner.initializeStage('sq1', all24, 120)

    initialSq1State.leaderboard = all24.map((driver, idx) => {
      const lapTimeMs = 79000 + (24 - idx) * 100
      return {
        position: idx + 1,
        driverId: driver.id,
        driverName: driver.name,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        carNumber: driver.carNumber,
        bestLapSec: lapTimeMs / 1000,
        bestLapTime: `${Math.floor(lapTimeMs / 60000)}:${((lapTimeMs % 60000) / 1000).toFixed(3)}`,
        gap: '+0.000',
        laps: 1,
        isPlayer: false,
        bestLapTimeMs: lapTimeMs,
        gapToLeaderMs: 0,
        gapToAheadMs: 0,
        sector1Ms: 26000,
        sector2Ms: 26000,
        sector3Ms: 27000,
        lapsCompleted: 1,
        status: 'in_garage',
        compound: 'soft',
        eliminated: false,
        onHotLap: false,
      }
    })

    const dummyCtx = createDummyTickContext()
    const sq1Result = CanonicalQualifyingRunner.finalizeStage(initialSq1State, dummyCtx)
    canonicalQualifyingPersistenceService.saveStageResult(sq1Result)

    // Primeira chamada para montar SQ2
    const firstCall = resolveSQ2Participants(TEST_SEASON_ID, TEST_ROUND, all24)
    // Segunda chamada (repetição/re-render/reload)
    const secondCall = resolveSQ2Participants(TEST_SEASON_ID, TEST_ROUND, all24)

    expect(firstCall.length).toBe(18)
    expect(secondCall.length).toBe(18)
    expect(firstCall.map((p) => p.id)).toEqual(secondCall.map((p) => p.id))

    // Nenhuma duplicação de IDs
    const uniqueIds = new Set(secondCall.map((p) => p.id))
    expect(uniqueIds.size).toBe(18)
  })

  it('D. ISOLAMENTO: ausência de resultado válido de SQ1 bloqueia SQ2; resultado de Q1 não pode ser usado como substituto', () => {
    const all24 = createMock24Drivers()

    // 1. Sem resultado algum da SQ1: SQ2 retorna lista vazia (bloqueio real)
    const emptySQ2 = resolveSQ2Participants(TEST_SEASON_ID, TEST_ROUND, all24)
    expect(emptySQ2).toEqual([])

    // 2. Simula salvamento de Q1 da corrida principal na mesma temporada e mesma rodada
    const q1InitialState = CanonicalQualifyingRunner.initializeStage('q1', all24, 120)

    q1InitialState.leaderboard = all24.map((driver, idx) => {
      const lapTimeMs = 81000 + idx * 100
      return {
        position: idx + 1,
        driverId: driver.id,
        driverName: driver.name,
        teamId: driver.teamId,
        teamName: driver.teamName,
        teamColor: driver.teamColor,
        carNumber: driver.carNumber,
        bestLapSec: lapTimeMs / 1000,
        bestLapTime: `${Math.floor(lapTimeMs / 60000)}:${((lapTimeMs % 60000) / 1000).toFixed(3)}`,
        gap: '+0.000',
        laps: 1,
        isPlayer: false,
        bestLapTimeMs: lapTimeMs,
        gapToLeaderMs: 0,
        gapToAheadMs: 0,
        sector1Ms: 27000,
        sector2Ms: 27000,
        sector3Ms: 27000,
        lapsCompleted: 1,
        status: 'in_garage',
        compound: 'soft',
        eliminated: false,
        onHotLap: false,
      }
    })

    const dummyCtx = createDummyTickContext()
    const q1Result = CanonicalQualifyingRunner.finalizeStage(q1InitialState, dummyCtx)
    canonicalQualifyingPersistenceService.saveStageResult(q1Result)

    // Confirma que Q1 foi salvo
    const q1Saved = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(q1Saved).not.toBeNull()
    expect(q1Saved?.stageId).toBe('q1')

    // SQ2 DEVE CONTINUAR BLOQUEADA (vazia), pois SQ1 ainda não foi realizada nesta rodada
    const sq2WithOnlyQ1 = resolveSQ2Participants(TEST_SEASON_ID, TEST_ROUND, all24)
    expect(sq2WithOnlyQ1).toEqual([])
  })
})
