/**
 * bug-sq1-result-integrity-01.test.ts
 *
 * PROVA DE INTEGRIDADE DO RESULTADO CANÔNICO DA SQ1 (BUG-SQ1-RESULT-INTEGRITY-01A)
 * Apex GP Manager (React + Vite + TS + Tailwind, backend PocketBase/Skip Cloud).
 *
 * OBJETIVO:
 * Provar que o resultado final da SQ1 representa corretamente a classificação esportiva real
 * e que os advancingDriverIds persistidos correspondem exatamente aos pilotos que deveriam
 * avançar para a SQ2.
 *
 * CASOS HOMOLOGADOS:
 * I1 — Ranking por mérito: tempos reais, independência de ordem do array, sem tempo atrás de quem tem tempo
 * I2 — Corte correto: quantidade de classificados = regra canônica (18), eliminados imediatamente após
 * I3 — advancingDriverIds: igualdade exata de IDs e ordem com leaderboard final.slice(0, 18)
 * I4 — Persistência: saveStageResult / readStageResult preserva ranking e advancingDriverIds sem reordenação
 * I5 — Consumo pela SQ2: resolveEligibleQualifyingDrivers entrega exatamente advancingDriverIds de SQ1 sem eliminados
 * Extra — Isolamento esportivo: SQ2 bloqueada sem SQ1; Q1 não contamina SQ1 nem SQ2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import {
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '@/services/weekendProgressionService'
import { resolveEligibleQualifyingDrivers } from '@/services/qualifyingParticipantResolver'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import type {
  QualifyingTickContext,
  QualifyingDriverContext,
} from '@/services/canonicalQualifyingRunner'
import type {
  QualifyingStageId,
  QualifyingStageResult,
  QualifyingTimeEntry,
} from '@/types/canonical-qualifying-types'

describe('BUG-SQ1-RESULT-INTEGRITY-01A — Prova de Integridade do Resultado Canônico da SQ1', () => {
  const TEST_SEASON_ID = 'season_sq1_proof_test'
  const TEST_ROUND = 4

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
      gpName: 'GP de Silverstone Sprint',
      circuitName: 'Silverstone Circuit',
      lengthKm: 5.891,
      tireAbrasiveness: 50,
      weather: 'seco',
      teamChassisRating: 82,
      teamEngineSupplier: 'Audi',
      teamName: 'Apex GP',
      teamColor: '#00A6FB',
      drivers: drivers.slice(0, 2),
      rivalDrivers: drivers.slice(2),
    }
  }

  /**
   * Fixture Não-Trivial com 24 pilotos inscritos deliberadamente desordenada:
   * 1. Ordem no array é embaralhada (não-sequencial).
   * 2. Piloto inicialmente no final do array (driver_24, índice 23) tem tempo de P1 (78.100s).
   * 3. Piloto inicialmente no começo do array (driver_01, índice 0) tem tempo alto (84.500s) e é eliminado (P20).
   * 4. Dois pilotos com empate exato em tempo de volta (driver_05 e driver_06 empatados em 80.200s):
   *    driver_05 registrou aos 120s e driver_06 aos 180s -> critério canônico desempata para driver_05.
   * 5. Pilotos sem tempo válido (bestLapSec = 0):
   *    - driver_21: 1 volta registrada (laps = 1), mas sem tempo válido.
   *    - driver_22: 0 voltas registradas (laps = 0), carNumber 88.
   *    - driver_23: 0 voltas registradas (laps = 0), carNumber 99.
   *    Ambos devem ficar estritamente atrás de todos os 21 pilotos com tempos válidos.
   */
  function createNonTrivialSQ1Fixture(): {
    rawEntries: Array<{
      driverId: string
      driverName: string
      teamId: string
      teamName: string
      teamColor: string
      carNumber: number
      isPlayerTeam: boolean
      carId?: 'car1' | 'car2'
    }>
    customLapAssignments: Array<{
      driverId: string
      lapTimeSec: number
      recordedAtSec: number
      laps: number
    }>
  } {
    const rawEntries = [
      {
        driverId: 'driver_01',
        driverName: 'Piloto 01 (Início Array - Elim)',
        teamId: 'team_01',
        teamName: 'Equipe 1',
        teamColor: '#E10600',
        carNumber: 1,
        isPlayerTeam: true,
        carId: 'car1' as const,
      },
      {
        driverId: 'driver_02',
        driverName: 'Piloto 02',
        teamId: 'team_01',
        teamName: 'Equipe 1',
        teamColor: '#E10600',
        carNumber: 2,
        isPlayerTeam: true,
        carId: 'car2' as const,
      },
      {
        driverId: 'driver_03',
        driverName: 'Piloto 03',
        teamId: 'team_02',
        teamName: 'Equipe 2',
        teamColor: '#334155',
        carNumber: 3,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_04',
        driverName: 'Piloto 04',
        teamId: 'team_02',
        teamName: 'Equipe 2',
        teamColor: '#334155',
        carNumber: 4,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_05',
        driverName: 'Piloto 05 (Empate A)',
        teamId: 'team_03',
        teamName: 'Equipe 3',
        teamColor: '#334155',
        carNumber: 5,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_06',
        driverName: 'Piloto 06 (Empate B)',
        teamId: 'team_03',
        teamName: 'Equipe 3',
        teamColor: '#334155',
        carNumber: 6,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_07',
        driverName: 'Piloto 07',
        teamId: 'team_04',
        teamName: 'Equipe 4',
        teamColor: '#334155',
        carNumber: 7,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_08',
        driverName: 'Piloto 08',
        teamId: 'team_04',
        teamName: 'Equipe 4',
        teamColor: '#334155',
        carNumber: 8,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_09',
        driverName: 'Piloto 09',
        teamId: 'team_05',
        teamName: 'Equipe 5',
        teamColor: '#334155',
        carNumber: 9,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_10',
        driverName: 'Piloto 10',
        teamId: 'team_05',
        teamName: 'Equipe 5',
        teamColor: '#334155',
        carNumber: 10,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_11',
        driverName: 'Piloto 11',
        teamId: 'team_06',
        teamName: 'Equipe 6',
        teamColor: '#334155',
        carNumber: 11,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_12',
        driverName: 'Piloto 12',
        teamId: 'team_06',
        teamName: 'Equipe 6',
        teamColor: '#334155',
        carNumber: 12,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_13',
        driverName: 'Piloto 13',
        teamId: 'team_07',
        teamName: 'Equipe 7',
        teamColor: '#334155',
        carNumber: 13,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_14',
        driverName: 'Piloto 14',
        teamId: 'team_07',
        teamName: 'Equipe 7',
        teamColor: '#334155',
        carNumber: 14,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_15',
        driverName: 'Piloto 15',
        teamId: 'team_08',
        teamName: 'Equipe 8',
        teamColor: '#334155',
        carNumber: 15,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_16',
        driverName: 'Piloto 16',
        teamId: 'team_08',
        teamName: 'Equipe 8',
        teamColor: '#334155',
        carNumber: 16,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_17',
        driverName: 'Piloto 17',
        teamId: 'team_09',
        teamName: 'Equipe 9',
        teamColor: '#334155',
        carNumber: 17,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_18',
        driverName: 'Piloto 18 (Corte P18)',
        teamId: 'team_09',
        teamName: 'Equipe 9',
        teamColor: '#334155',
        carNumber: 18,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_19',
        driverName: 'Piloto 19 (Primeiro Elim P19)',
        teamId: 'team_10',
        teamName: 'Equipe 10',
        teamColor: '#334155',
        carNumber: 19,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_20',
        driverName: 'Piloto 20',
        teamId: 'team_10',
        teamName: 'Equipe 10',
        teamColor: '#334155',
        carNumber: 20,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_21',
        driverName: 'Piloto 21 (Sem Tempo - 1 lap)',
        teamId: 'team_11',
        teamName: 'Equipe 11',
        teamColor: '#334155',
        carNumber: 21,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_22',
        driverName: 'Piloto 22 (Sem Tempo - 0 laps)',
        teamId: 'team_11',
        teamName: 'Equipe 11',
        teamColor: '#334155',
        carNumber: 88,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_23',
        driverName: 'Piloto 23 (Sem Tempo - 0 laps)',
        teamId: 'team_12',
        teamName: 'Equipe 12',
        teamColor: '#334155',
        carNumber: 99,
        isPlayerTeam: false,
      },
      {
        driverId: 'driver_24',
        driverName: 'Piloto 24 (Fim Array - Top 1)',
        teamId: 'team_12',
        teamName: 'Equipe 12',
        teamColor: '#334155',
        carNumber: 24,
        isPlayerTeam: false,
      },
    ]

    // Atribuição de tempos esportivos calibrada
    const customLapAssignments = [
      // P1: driver_24 (fim do array) -> 78.100s
      { driverId: 'driver_24', lapTimeSec: 78.1, recordedAtSec: 300, laps: 2 },
      // P2: driver_02 -> 78.300s
      { driverId: 'driver_02', lapTimeSec: 78.3, recordedAtSec: 250, laps: 2 },
      // P3: driver_14 -> 78.500s
      { driverId: 'driver_14', lapTimeSec: 78.5, recordedAtSec: 280, laps: 2 },
      // P4: driver_10 -> 78.700s
      { driverId: 'driver_10', lapTimeSec: 78.7, recordedAtSec: 290, laps: 2 },
      // P5 e P6: driver_05 e driver_06 com EMPATE em 80.200s!
      // driver_05 gravou aos 120s; driver_06 gravou aos 180s. driver_05 deve ser P5 e driver_06 P6.
      { driverId: 'driver_05', lapTimeSec: 80.2, recordedAtSec: 120, laps: 2 },
      { driverId: 'driver_06', lapTimeSec: 80.2, recordedAtSec: 180, laps: 2 },
      // P7 a P17:
      { driverId: 'driver_03', lapTimeSec: 80.5, recordedAtSec: 150, laps: 2 },
      { driverId: 'driver_04', lapTimeSec: 80.6, recordedAtSec: 160, laps: 2 },
      { driverId: 'driver_07', lapTimeSec: 80.7, recordedAtSec: 170, laps: 2 },
      { driverId: 'driver_08', lapTimeSec: 80.8, recordedAtSec: 180, laps: 2 },
      { driverId: 'driver_09', lapTimeSec: 80.9, recordedAtSec: 190, laps: 2 },
      { driverId: 'driver_11', lapTimeSec: 81.0, recordedAtSec: 200, laps: 2 },
      { driverId: 'driver_12', lapTimeSec: 81.1, recordedAtSec: 210, laps: 2 },
      { driverId: 'driver_13', lapTimeSec: 81.2, recordedAtSec: 220, laps: 2 },
      { driverId: 'driver_15', lapTimeSec: 81.3, recordedAtSec: 230, laps: 2 },
      { driverId: 'driver_16', lapTimeSec: 81.4, recordedAtSec: 240, laps: 2 },
      { driverId: 'driver_17', lapTimeSec: 81.5, recordedAtSec: 250, laps: 2 },
      // P18 (ÚLTIMO CLASSIFICADO PARA SQ2): driver_18 com 81.900s
      { driverId: 'driver_18', lapTimeSec: 81.9, recordedAtSec: 260, laps: 2 },
      // P19 (PRIMEIRO ELIMINADO DA SQ1): driver_19 com 82.200s
      { driverId: 'driver_19', lapTimeSec: 82.2, recordedAtSec: 270, laps: 2 },
      // P20: driver_01 (começo do array!) com 84.500s -> ELIMINADO
      { driverId: 'driver_01', lapTimeSec: 84.5, recordedAtSec: 100, laps: 2 },
      // P21: driver_20 com 85.000s -> ELIMINADO
      { driverId: 'driver_20', lapTimeSec: 85.0, recordedAtSec: 320, laps: 1 },
      // P22 (SEM TEMPO, mas 1 lap): driver_21
      { driverId: 'driver_21', lapTimeSec: 0, recordedAtSec: 0, laps: 1 },
      // P23 (SEM TEMPO, 0 laps, carNumber 88): driver_22
      { driverId: 'driver_22', lapTimeSec: 0, recordedAtSec: 0, laps: 0 },
      // P24 (SEM TEMPO, 0 laps, carNumber 99): driver_23
      { driverId: 'driver_23', lapTimeSec: 0, recordedAtSec: 0, laps: 0 },
    ]

    return { rawEntries, customLapAssignments }
  }

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // -------------------------------------------------------------------------------------------------
  // I1 — RANKING POR MÉRITO
  // -------------------------------------------------------------------------------------------------
  it('I1: ranking por mérito — tempos reais prevalecem, sem tempo atrás de quem tem tempo, independe da ordem do array', () => {
    const { rawEntries, customLapAssignments } = createNonTrivialSQ1Fixture()

    const sq1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    expect(sq1Participants).toHaveLength(24)

    const initialStageState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 01',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 02',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    // Popula o leaderboard com a fixture desordenada deliberada
    const assignmentMap = new Map(customLapAssignments.map((a) => [a.driverId, a]))
    initialStageState.leaderboard = sq1Participants.map((p, idx) => {
      const assignment = assignmentMap.get(p.id)!
      const bestLapSec = assignment.lapTimeSec
      return {
        position: idx + 1,
        driverId: p.id,
        driverName: p.name,
        teamId: p.teamId || 'team',
        teamName: p.teamName || 'Equipe',
        teamColor: p.teamColor || '#334155',
        carNumber: p.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: assignment.laps,
        bestLapSec,
        bestLapTime:
          bestLapSec > 0
            ? `${Math.floor(bestLapSec / 60)}:${(bestLapSec % 60).toFixed(3).padStart(6, '0')}`
            : '--:--.---',
        bestLapRecordedAtSec: assignment.recordedAtSec,
        gap: '-',
        isPlayer: p.id === 'driver_01' || p.id === 'driver_02',
        carId:
          p.id === 'driver_01'
            ? ('car1' as const)
            : p.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq1Participants)
    const sq1Result = CanonicalQualifyingRunner.finalizeStage(initialStageState, tickContext, {
      persistState: true,
    })

    // 1. O P1 esportivo é driver_24 (que estava no final do array com 78.100s), não driver_01 (índice 0)
    expect(sq1Result.entries[0].driverId).toBe('driver_24')
    expect(sq1Result.entries[0].bestLapSec).toBe(78.1)
    expect(sq1Result.entries[0].position).toBe(1)

    // 2. driver_01 (no começo do array, mas tempo alto 84.500s) fica em P20 (eliminado)
    const p1Entry = sq1Result.entries.find((e) => e.driverId === 'driver_01')
    expect(p1Entry).toBeDefined()
    expect(p1Entry!.position).toBe(20)
    expect(p1Entry!.isEliminated).toBe(true)

    // 3. Critério canônico de desempate por timestamp: driver_05 e driver_06 empataram em 80.200s
    // driver_05 marcou aos 120s, driver_06 aos 180s -> driver_05 fica à frente (P5 vs P6)
    const p5Entry = sq1Result.entries.find((e) => e.driverId === 'driver_05')
    const p6Entry = sq1Result.entries.find((e) => e.driverId === 'driver_06')
    expect(p5Entry!.position).toBe(5)
    expect(p6Entry!.position).toBe(6)
    expect(p5Entry!.position).toBeLessThan(p6Entry!.position)

    // 4. Pilotos com tempo válido vs sem tempo:
    // Todos os 21 pilotos com bestLapSec > 0 estão rigorosamente à frente dos 3 sem tempo (driver_21, driver_22, driver_23)
    const withTimeEntries = sq1Result.entries.filter((e) => e.bestLapSec > 0)
    const withoutTimeEntries = sq1Result.entries.filter((e) => e.bestLapSec <= 0)
    expect(withTimeEntries).toHaveLength(21)
    expect(withoutTimeEntries).toHaveLength(3)

    const maxPosWithTime = Math.max(...withTimeEntries.map((e) => e.position))
    const minPosWithoutTime = Math.min(...withoutTimeEntries.map((e) => e.position))
    expect(maxPosWithTime).toBe(21)
    expect(minPosWithoutTime).toBe(22)
    expect(maxPosWithTime).toBeLessThan(minPosWithoutTime)

    // 5. Ordem estrita entre pilotos sem tempo:
    // driver_21 tem 1 volta -> P22
    // driver_22 tem 0 voltas, carNumber 88 -> P23
    // driver_23 tem 0 voltas, carNumber 99 -> P24
    expect(sq1Result.entries[21].driverId).toBe('driver_21')
    expect(sq1Result.entries[22].driverId).toBe('driver_22')
    expect(sq1Result.entries[23].driverId).toBe('driver_23')
  })

  // -------------------------------------------------------------------------------------------------
  // I2 — CORTE CORRETO
  // -------------------------------------------------------------------------------------------------
  it('I2: corte correto — quantidade de classificados bate com a regra canônica (18), eliminados imediatamente após', () => {
    const { rawEntries, customLapAssignments } = createNonTrivialSQ1Fixture()

    const sq1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    const initialStageState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 01',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 02',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    const assignmentMap = new Map(customLapAssignments.map((a) => [a.driverId, a]))
    initialStageState.leaderboard = sq1Participants.map((p, idx) => {
      const assignment = assignmentMap.get(p.id)!
      const bestLapSec = assignment.lapTimeSec
      return {
        position: idx + 1,
        driverId: p.id,
        driverName: p.name,
        teamId: p.teamId || 'team',
        teamName: p.teamName || 'Equipe',
        teamColor: p.teamColor || '#334155',
        carNumber: p.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: assignment.laps,
        bestLapSec,
        bestLapTime:
          bestLapSec > 0
            ? `${Math.floor(bestLapSec / 60)}:${(bestLapSec % 60).toFixed(3).padStart(6, '0')}`
            : '--:--.---',
        bestLapRecordedAtSec: assignment.recordedAtSec,
        gap: '-',
        isPlayer: p.id === 'driver_01' || p.id === 'driver_02',
        carId:
          p.id === 'driver_01'
            ? ('car1' as const)
            : p.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq1Participants)
    const sq1Result = CanonicalQualifyingRunner.finalizeStage(initialStageState, tickContext, {
      persistState: true,
    })

    const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES.sq1.advancingCount
    const expectedEliminatedCount = CANONICAL_QUALIFYING_RULES.sq1.eliminatedCount

    expect(expectedAdvancingCount).toBe(18)
    expect(expectedEliminatedCount).toBe(6)

    // Exatamente 18 avançam e 6 são eliminados
    expect(sq1Result.advancingDriverIds).toHaveLength(expectedAdvancingCount)
    expect(sq1Result.eliminatedDriverIds).toHaveLength(expectedEliminatedCount)

    // O último classificado (posição 18) é driver_18 (81.900s)
    const p18Entry = sq1Result.entries[17]
    expect(p18Entry.position).toBe(18)
    expect(p18Entry.driverId).toBe('driver_18')
    expect(p18Entry.isEliminated).toBe(false)
    expect(sq1Result.advancingDriverIds).toContain('driver_18')

    // O primeiro eliminado (posição 19) está imediatamente após: driver_19 (82.200s)
    const p19Entry = sq1Result.entries[18]
    expect(p19Entry.position).toBe(19)
    expect(p19Entry.driverId).toBe('driver_19')
    expect(p19Entry.isEliminated).toBe(true)
    expect(p19Entry.eliminatedInStage).toBe('sq1')
    expect(sq1Result.eliminatedDriverIds).toContain('driver_19')
    expect(sq1Result.advancingDriverIds).not.toContain('driver_19')

    // Relação temporal de mérito no limite de corte:
    expect(p18Entry.bestLapSec).toBeLessThan(p19Entry.bestLapSec)
  })

  // -------------------------------------------------------------------------------------------------
  // I3 — ADVANCING DRIVER IDS
  // -------------------------------------------------------------------------------------------------
  it('I3: advancingDriverIds — igualdade estrita de IDs e ordem com leaderboard final.slice(0, advancingCount)', () => {
    const { rawEntries, customLapAssignments } = createNonTrivialSQ1Fixture()

    const sq1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    const initialStageState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 01',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 02',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    const assignmentMap = new Map(customLapAssignments.map((a) => [a.driverId, a]))
    initialStageState.leaderboard = sq1Participants.map((p, idx) => {
      const assignment = assignmentMap.get(p.id)!
      const bestLapSec = assignment.lapTimeSec
      return {
        position: idx + 1,
        driverId: p.id,
        driverName: p.name,
        teamId: p.teamId || 'team',
        teamName: p.teamName || 'Equipe',
        teamColor: p.teamColor || '#334155',
        carNumber: p.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: assignment.laps,
        bestLapSec,
        bestLapTime:
          bestLapSec > 0
            ? `${Math.floor(bestLapSec / 60)}:${(bestLapSec % 60).toFixed(3).padStart(6, '0')}`
            : '--:--.---',
        bestLapRecordedAtSec: assignment.recordedAtSec,
        gap: '-',
        isPlayer: p.id === 'driver_01' || p.id === 'driver_02',
        carId:
          p.id === 'driver_01'
            ? ('car1' as const)
            : p.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq1Participants)
    const sq1Result = CanonicalQualifyingRunner.finalizeStage(initialStageState, tickContext, {
      persistState: true,
    })

    const advancingCount = CANONICAL_QUALIFYING_RULES.sq1.advancingCount // 18
    const expectedTop18Ids = initialStageState.leaderboard
      .slice(0, advancingCount)
      .map((entry) => entry.driverId)

    // PROVA DE IGUALDADE EXATA:
    // Não apenas mesma quantidade, mas MESMOS IDs na MESMA ordem posicional (P1 a P18)
    expect(sq1Result.advancingDriverIds).toEqual(expectedTop18Ids)

    // Conferência item a item
    for (let i = 0; i < advancingCount; i++) {
      expect(sq1Result.advancingDriverIds[i]).toBe(sq1Result.entries[i].driverId)
      expect(sq1Result.entries[i].position).toBe(i + 1)
      expect(sq1Result.entries[i].isEliminated).toBe(false)
    }

    // Conferência de eliminados: posições 19 a 24
    const expectedEliminatedIds = initialStageState.leaderboard
      .slice(advancingCount)
      .map((entry) => entry.driverId)
    expect(sq1Result.eliminatedDriverIds).toEqual(expectedEliminatedIds)
    for (let i = advancingCount; i < 24; i++) {
      expect(sq1Result.eliminatedDriverIds[i - advancingCount]).toBe(sq1Result.entries[i].driverId)
      expect(sq1Result.entries[i].position).toBe(i + 1)
      expect(sq1Result.entries[i].isEliminated).toBe(true)
    }
  })

  // -------------------------------------------------------------------------------------------------
  // I4 — PERSISTÊNCIA E RELOAD
  // -------------------------------------------------------------------------------------------------
  it('I4: persistência e reload — ranking preservado, advancingDriverIds preservados, sem reordenação após reload', () => {
    const { rawEntries, customLapAssignments } = createNonTrivialSQ1Fixture()

    const sq1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    const initialStageState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 01',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 02',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    const assignmentMap = new Map(customLapAssignments.map((a) => [a.driverId, a]))
    initialStageState.leaderboard = sq1Participants.map((p, idx) => {
      const assignment = assignmentMap.get(p.id)!
      const bestLapSec = assignment.lapTimeSec
      return {
        position: idx + 1,
        driverId: p.id,
        driverName: p.name,
        teamId: p.teamId || 'team',
        teamName: p.teamName || 'Equipe',
        teamColor: p.teamColor || '#334155',
        carNumber: p.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: assignment.laps,
        bestLapSec,
        bestLapTime:
          bestLapSec > 0
            ? `${Math.floor(bestLapSec / 60)}:${(bestLapSec % 60).toFixed(3).padStart(6, '0')}`
            : '--:--.---',
        bestLapRecordedAtSec: assignment.recordedAtSec,
        gap: '-',
        isPlayer: p.id === 'driver_01' || p.id === 'driver_02',
        carId:
          p.id === 'driver_01'
            ? ('car1' as const)
            : p.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq1Participants)
    const originalResult = CanonicalQualifyingRunner.finalizeStage(initialStageState, tickContext, {
      persistState: true,
    })

    // 1. Recarrega o resultado oficial via readStageResult
    const loadedResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq1',
    )

    expect(loadedResult).not.toBeNull()
    expect(loadedResult!.stageId).toBe('sq1')
    expect(loadedResult!.seasonId).toBe(TEST_SEASON_ID)
    expect(loadedResult!.round).toBe(TEST_ROUND)

    // Prova de preservação estrita de advancingDriverIds
    expect(loadedResult!.advancingDriverIds).toEqual(originalResult.advancingDriverIds)
    expect(loadedResult!.eliminatedDriverIds).toEqual(originalResult.eliminatedDriverIds)

    // Prova de preservação de todo o ranking (P1 a P24)
    expect(loadedResult!.entries.map((e) => e.driverId)).toEqual(
      originalResult.entries.map((e) => e.driverId),
    )
    expect(loadedResult!.entries.map((e) => e.position)).toEqual(
      originalResult.entries.map((e) => e.position),
    )
    expect(loadedResult!.entries.map((e) => e.bestLapSec)).toEqual(
      originalResult.entries.map((e) => e.bestLapSec),
    )

    // 2. Recarrega o estado via readStageState
    const loadedState = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'sq1',
    )
    expect(loadedState).not.toBeNull()
    expect(loadedState!.status).toBe('completed')
    expect(loadedState!.leaderboard.map((e) => e.driverId)).toEqual(
      originalResult.entries.map((e) => e.driverId),
    )

    // 3. Simula chamada subsequente de initializeStage (reidratação de página)
    const rehydratedState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 01',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 02',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    // Garante que reidratar não altera a ordem do leaderboard nem o status
    expect(rehydratedState.status).toBe('completed')
    expect(rehydratedState.leaderboard.map((e) => e.driverId)).toEqual(
      originalResult.entries.map((e) => e.driverId),
    )
  })

  // -------------------------------------------------------------------------------------------------
  // I5 — CONSUMO PELA SQ2
  // -------------------------------------------------------------------------------------------------
  it('I5: consumo pela SQ2 — participantes da SQ2 = exatamente advancingDriverIds da SQ1, sem eliminados, sem duplicatas', () => {
    const { rawEntries, customLapAssignments } = createNonTrivialSQ1Fixture()

    const sq1Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    const initialStageState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: 'driver_01',
        driverName: 'Piloto 01',
        driverNumber: 1,
        tyreSetId: 'tyre_set_01',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: 'driver_02',
        driverName: 'Piloto 02',
        driverNumber: 2,
        tyreSetId: 'tyre_set_02',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: sq1Participants,
      persistState: false,
    })

    const assignmentMap = new Map(customLapAssignments.map((a) => [a.driverId, a]))
    initialStageState.leaderboard = sq1Participants.map((p, idx) => {
      const assignment = assignmentMap.get(p.id)!
      const bestLapSec = assignment.lapTimeSec
      return {
        position: idx + 1,
        driverId: p.id,
        driverName: p.name,
        teamId: p.teamId || 'team',
        teamName: p.teamName || 'Equipe',
        teamColor: p.teamColor || '#334155',
        carNumber: p.carNumber || idx + 1,
        compound: 'macio' as const,
        laps: assignment.laps,
        bestLapSec,
        bestLapTime:
          bestLapSec > 0
            ? `${Math.floor(bestLapSec / 60)}:${(bestLapSec % 60).toFixed(3).padStart(6, '0')}`
            : '--:--.---',
        bestLapRecordedAtSec: assignment.recordedAtSec,
        gap: '-',
        isPlayer: p.id === 'driver_01' || p.id === 'driver_02',
        carId:
          p.id === 'driver_01'
            ? ('car1' as const)
            : p.id === 'driver_02'
              ? ('car2' as const)
              : undefined,
        status: 'garage' as const,
        isEliminated: false,
      }
    })

    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, sq1Participants)
    const sq1Result = CanonicalQualifyingRunner.finalizeStage(initialStageState, tickContext, {
      persistState: true,
    })

    // Resolve os participantes da SQ2 usando a função de produção
    const sq2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })

    // 1. Quantidade exata: 18
    expect(sq2Participants).toHaveLength(18)

    // 2. Participantes da SQ2 = exatamente advancingDriverIds de SQ1 na mesma ordem
    expect(sq2Participants.map((p) => p.id)).toEqual(sq1Result.advancingDriverIds)

    // 3. Nenhum eliminado reaparece na SQ2
    const sq2IdsSet = new Set(sq2Participants.map((p) => p.id))
    for (const elimId of sq1Result.eliminatedDriverIds) {
      expect(sq2IdsSet.has(elimId)).toBe(false)
    }

    // Piloto driver_01 (eliminado na SQ1) NÃO pode estar na SQ2
    expect(sq2IdsSet.has('driver_01')).toBe(false)
    // Piloto driver_19 (eliminado P19) NÃO pode estar na SQ2
    expect(sq2IdsSet.has('driver_19')).toBe(false)
    // Pilotos sem tempo (driver_21, 22, 23) NÃO podem estar na SQ2
    expect(sq2IdsSet.has('driver_21')).toBe(false)
    expect(sq2IdsSet.has('driver_22')).toBe(false)
    expect(sq2IdsSet.has('driver_23')).toBe(false)

    // 4. Nenhum classificado some da SQ2
    for (const advId of sq1Result.advancingDriverIds) {
      expect(sq2IdsSet.has(advId)).toBe(true)
    }

    // 5. Nenhuma duplicação
    expect(sq2IdsSet.size).toBe(18)

    // 6. Dados preservados nos participantes da SQ2
    const p1InSq2 = sq2Participants[0]
    expect(p1InSq2.id).toBe('driver_24')
    expect(p1InSq2.teamId).toBe('team_12')
    expect(p1InSq2.carNumber).toBe(24)
  })

  // -------------------------------------------------------------------------------------------------
  // EXTRA — ISOLAMENTO ESPORTIVO: SQ1 vs Q1 PRINCIPAL
  // -------------------------------------------------------------------------------------------------
  it('Extra: isolamento esportivo — a SQ2 da Sprint NÃO consome o resultado do Q1 da corrida principal', () => {
    const { rawEntries } = createNonTrivialSQ1Fixture()

    // 1. Sem resultado de SQ1: SQ2 deve estar vazia (bloqueada)
    const sq2Before = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq2Before).toEqual([])

    // 2. Simula término e persistência apenas de Q1 da classificação principal
    const q1Result: QualifyingStageResult = {
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      completedAt: new Date().toISOString(),
      entries: rawEntries.map((e, idx) => ({
        position: idx + 1,
        driverId: e.driverId,
        driverName: e.driverName,
        teamId: e.teamId,
        teamName: e.teamName,
        teamColor: e.teamColor,
        bestLapSec: 79.0 + idx * 0.1,
        bestLapTime: '1:19.000',
        bestLapRecordedAtSec: 100,
        compound: 'macio' as const,
        lapsCount: 2,
        isPlayer: e.isPlayerTeam,
        isEliminated: idx >= 18,
      })),
      advancingDriverIds: rawEntries.slice(0, 18).map((e) => e.driverId),
      eliminatedDriverIds: rawEntries.slice(18).map((e) => e.driverId),
    }
    canonicalQualifyingPersistenceService.saveStageResult(q1Result)

    // 3. SQ2 DEVE CONTINUAR BLOQUEADA (vazia), provando que Q1 não contamina SQ1/SQ2
    const sq2WithOnlyQ1 = resolveEligibleQualifyingDrivers({
      stageId: 'sq2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: rawEntries,
      playerDriverIds: ['driver_01', 'driver_02'],
    })
    expect(sq2WithOnlyQ1).toEqual([])

    // 4. Q2 principal consome Q1 normalmente
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

  // -------------------------------------------------------------------------------------------------
  // EXTRA — PURGAÇÃO DE COMPLETED SESSIONS SE ESTADO NÃO FOR COMPLETED OU SEM RESULTADO
  // -------------------------------------------------------------------------------------------------
  it('Extra: purgação em readStoredCompletedSessions — se SQ1 for marcada como concluída sem resultado/estado, é expurgada', () => {
    writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, ['tp1', 'sq1'])

    // SQ1 gravada em completedSessions, mas sem estado canônico nem resultado
    let completed = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
    expect(completed).not.toContain('sq1')
    expect(completed).toContain('tp1')
  })

  // -------------------------------------------------------------------------------------------------
  // EXTRA — IDEMPOTÊNCIA DE EXECUÇÃO
  // -------------------------------------------------------------------------------------------------
  it('Extra: idempotência de conclusão — múltiplos triggers de finalização não causam duplicações', () => {
    const completedSet = new Set<string>()
    const onStageCompletedMock = vi.fn()

    const simulateEffectTrigger = (stageId: QualifyingStageId, status: string, round: number) => {
      if (status !== 'completed') return
      const roundKey = `${TEST_SEASON_ID}_r${round}_${stageId}`
      if (completedSet.has(roundKey)) return
      completedSet.add(roundKey)
      onStageCompletedMock(stageId)
    }

    simulateEffectTrigger('sq1', 'completed', TEST_ROUND)
    expect(onStageCompletedMock).toHaveBeenCalledTimes(1)
    expect(onStageCompletedMock).toHaveBeenCalledWith('sq1')

    // 2ª execução com mesmo roundKey
    simulateEffectTrigger('sq1', 'completed', TEST_ROUND)
    expect(onStageCompletedMock).toHaveBeenCalledTimes(1)
  })
})
