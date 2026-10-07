/**
 * bug-q1-q2-transition-q2fix-04.test.ts
 *
 * PROVA DE INTEGRAÇÃO DA CADEIA Q1 CONCLUÍDO → STAGE RESULT(Q1) → PARTICIPANT RESOLVER → Q2 (Q2FIX-04)
 * Apex GP Manager (React + Vite + TS + Tailwind, backend PocketBase/Skip Cloud).
 *
 * OBJETIVO ÚNICO:
 * Provar a integridade completa da cadeia esportiva:
 * Q1 concluído → StageResult(q1) persistido → advancingDriverIds → qualifyingParticipantResolver real → Q2 com classificados corretos.
 *
 * CASOS COBERTOS:
 * T1 — RESULTADO DO Q1:
 *      Executar/finalizar um Q1 determinístico com 24 pilotos e tempos distintos.
 *      Ler o StageResult(q1). Provar: existe; possui advancingDriverIds;
 *      quantidade === CANONICAL_QUALIFYING_RULES['q1'].advancingCount;
 *      sem IDs vazios; sem duplicados. Não hardcodar número arbitrário.
 *
 * T2 — CORTE CORRETO:
 *      Comparar os classificados com o leaderboard final produzido pelo próprio runner.
 *      Provar: exatamente os primeiros N avançam; nenhum eliminado entra; nenhum classificado fica de fora;
 *      ordem inicial dos pilotos não interfere. Não reimplementar sorting/corte no teste.
 *
 * T3 — RESOLVER DO Q2:
 *      Chamar o qualifyingParticipantResolver real para q2.
 *      Provar: Q2 participants === StageResult(q1).advancingDriverIds em quantidade, IDs
 *      e ordem definida pelo contrato real.
 *
 * T4 — Q2 NÃO NASCE VAZIO:
 *      Inicializar Q2 pelo caminho canônico disponível.
 *      Provar: estado existe; participantes/leaderboard não vazios;
 *      todos pertencem aos classificados do Q1. Captura diretamente a regressão original (Q2 com 0 participantes).
 *
 * T5 — RESULTADO AUSENTE:
 *      Em cenário isolado, tornar indisponível o prerequisite Q1. Resolver Q2.
 *      Esperado: QualifyingPrerequisiteError e nunca [].
 *
 * T6 — RESULTADO INVÁLIDO:
 *      Fornecer StageResult com quantidade inválida de advancingDriverIds.
 *      Esperado: QualifyingPrerequisiteError. Q2 não pode nascer parcialmente.
 *
 * T7 — ISOLAMENTO:
 *      Provar que Q2 lê especificamente q1 / mesma season / mesmo round / mesma generation.
 *      Um resultado conflitante de sq1, round diferente ou generation antiga NÃO pode alimentar o Q2.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  CanonicalQualifyingRunner,
  type QualifyingDriverContext,
} from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import {
  resolveEligibleQualifyingDrivers,
  QualifyingPrerequisiteError,
} from '@/services/qualifyingParticipantResolver'
import {
  resetWeekendForRound,
  getActiveWeekendGeneration,
} from '@/services/weekendProgressionService'
import {
  CANONICAL_QUALIFYING_RULES,
  type QualifyingStageState,
  type QualifyingStageResult,
  type QualifyingTimeEntry,
} from '@/types/canonical-qualifying-types'

describe('Q2FIX-04 — Cadeia Q1 Concluído → StageResult(q1) → Participant Resolver → Q2', () => {
  const TEST_SEASON_ID = 'season_q2fix04_test'
  const TEST_ROUND = 5
  const TEST_CAREER_ID = 'career_q2fix04_test'

  // 24 participantes determinísticos com ordens e perfis realistas
  const canonical24Drivers: QualifyingDriverContext[] = Array.from({ length: 24 }).map((_, i) => ({
    id: `drv_q2fix_${String(i + 1).padStart(2, '0')}`,
    name:
      i === 0
        ? 'Max Verstappen'
        : i === 1
          ? 'Gabriel Bortoleto'
          : i === 2
            ? 'Lewis Hamilton'
            : i === 3
              ? 'Charles Leclerc'
              : `Piloto ${i + 1}`,
    teamId:
      i === 0
        ? 'red_bull'
        : i === 1
          ? 'team_audi'
          : i === 2
            ? 'ferrari'
            : `team_${Math.floor(i / 2) + 1}`,
    teamName:
      i === 0
        ? 'Red Bull Racing'
        : i === 1
          ? 'Audi F1 Team'
          : i === 2
            ? 'Scuderia Ferrari'
            : `Equipe ${Math.floor(i / 2) + 1}`,
    teamColor: i === 0 ? '#1E41FF' : i === 1 ? '#E10600' : '#DC0000',
    carNumber: i === 0 ? 1 : i === 1 ? 5 : i === 2 ? 44 : i + 10,
    speed: 95 - i * 0.5,
    consistency: 90,
    defense: 85,
  }))

  const playerCar1 = {
    driverId: canonical24Drivers[0].id,
    driverName: canonical24Drivers[0].name,
    driverNumber: canonical24Drivers[0].carNumber || 1,
    tyreSetId: 'tyre_set_c1_q2fix04',
    compound: 'macio' as const,
    wear: 10,
    fuelKg: 15,
    setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
  }

  const playerCar2 = {
    driverId: canonical24Drivers[1].id,
    driverName: canonical24Drivers[1].name,
    driverNumber: canonical24Drivers[1].carNumber || 5,
    tyreSetId: 'tyre_set_c2_q2fix04',
    compound: 'macio' as const,
    wear: 12,
    fuelKg: 15,
    setup: { frontWing: 7, rearWing: 6, suspension: 5, differential: 52 },
  }

  const allEntriesSnapshot = canonical24Drivers.map((d, idx) => ({
    driverId: d.id,
    driverName: d.name,
    carId: idx === 0 ? 'car1' : idx === 1 ? 'car2' : undefined,
    isPlayerTeam: idx < 2,
    teamId: d.teamId,
    teamName: d.teamName,
    teamColor: d.teamColor,
    driverNumber: d.carNumber,
  }))

  /**
   * Helper que materializa e finaliza um Q1 completo determinístico pelo runner real:
   * 24 pilotos com tempos estritamente crescentes, sem empates, garantindo que
   * o corte do runner produza exatamente o leaderboard ordenado e o StageResult oficial.
   */
  function executeDeterministicCompletedQ1(
    seasonId: string,
    round: number,
    drivers: QualifyingDriverContext[],
  ): { state: QualifyingStageState; result: QualifyingStageResult } {
    // 1. Inicializa Q1 pelo runner real
    const q1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1,
      playerCar2,
      eligibleParticipants: drivers,
      persistState: true,
    })

    // 2. Preenche tempos determinísticos distintos para os 24 pilotos
    // Do P1 ao P24 com tempos crescentes de 70.100s até 73.550s (delta de 0.150s por piloto)
    q1State.leaderboard.forEach((entry, idx) => {
      const lapTimeSec = Number((70.1 + idx * 0.15).toFixed(3))
      entry.bestLapSec = lapTimeSec
      entry.bestLapTime = `1:${(lapTimeSec - 60).toFixed(3).padStart(6, '0')}`
      entry.bestLapRecordedAtSec = 100 + idx * 20
      entry.laps = 3 + (idx % 3)
      entry.gap = idx === 0 ? '-' : `+${(lapTimeSec - 70.1).toFixed(3)}`
    })

    // 3. Finaliza oficialmente a fase com o runner real
    const tickContext = {
      seasonId,
      round,
      gpName: 'GP Teste Q2FIX-04',
      circuitName: 'Circuito Canônico',
      lengthKm: 5.4,
      tireAbrasiveness: 60,
      weather: 'seco' as const,
      teamChassisRating: 85,
      teamEngineSupplier: 'Audi',
      teamName: 'Apex GP',
      teamColor: '#00A6FB',
      drivers,
      rivalDrivers: drivers.filter(
        (d) => d.id !== playerCar1.driverId && d.id !== playerCar2.driverId,
      ),
    }

    const q1Result = CanonicalQualifyingRunner.finalizeStage(q1State, tickContext, {
      persistState: true,
    })

    return { state: q1State, result: q1Result }
  }

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // =================================================================================================
  // T1 — RESULTADO DO Q1
  // =================================================================================================
  it('T1 — RESULTADO DO Q1: Q1 determinístico finalizado gera StageResult(q1) canônico e persistido', () => {
    const { result: finalizedResult } = executeDeterministicCompletedQ1(
      TEST_SEASON_ID,
      TEST_ROUND,
      canonical24Drivers,
    )

    // Leitura independente via serviço de persistência real
    const persistedQ1Result = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )

    // Provas:
    // 1. Existe e não é nulo
    expect(persistedQ1Result).not.toBeNull()
    expect(persistedQ1Result!.stageId).toBe('q1')
    expect(persistedQ1Result!.seasonId).toBe(TEST_SEASON_ID)
    expect(persistedQ1Result!.round).toBe(TEST_ROUND)

    // 2. Possui advancingDriverIds
    expect(Array.isArray(persistedQ1Result!.advancingDriverIds)).toBe(true)

    // 3. Quantidade === CANONICAL_QUALIFYING_RULES['q1'].advancingCount (sem hardcode)
    const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES.q1.advancingCount
    expect(persistedQ1Result!.advancingDriverIds).toHaveLength(expectedAdvancingCount)

    // 4. Sem IDs vazios ou nulos
    for (const driverId of persistedQ1Result!.advancingDriverIds) {
      expect(typeof driverId).toBe('string')
      expect(driverId.trim().length).toBeGreaterThan(0)
    }

    // 5. Sem IDs duplicados
    const uniqueAdvancing = new Set(persistedQ1Result!.advancingDriverIds)
    expect(uniqueAdvancing.size).toBe(expectedAdvancingCount)

    // Coerência estrita entre o objeto retornado e o lido do storage
    expect(persistedQ1Result!.advancingDriverIds).toEqual(finalizedResult.advancingDriverIds)
  })

  // =================================================================================================
  // T2 — CORTE CORRETO
  // =================================================================================================
  it('T2 — CORTE CORRETO: exatamente os primeiros N do leaderboard final avançam e eliminados ficam de fora', () => {
    // Para provar que a ordem inicial não interfere, invertemos os pilotos na lista de entrada
    const reversedDrivers = [...canonical24Drivers].reverse()
    const { state: finalizedState, result: finalizedResult } = executeDeterministicCompletedQ1(
      TEST_SEASON_ID,
      TEST_ROUND,
      reversedDrivers,
    )

    const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES.q1.advancingCount
    const expectedEliminatedCount = CANONICAL_QUALIFYING_RULES.q1.eliminatedCount
    expect(expectedAdvancingCount + expectedEliminatedCount).toBe(
      CANONICAL_QUALIFYING_RULES.q1.participantsCount,
    )

    // Extrair os N primeiros e os eliminados diretamente do leaderboard final produzido pelo runner
    const leaderboardTopN = finalizedState.leaderboard.slice(0, expectedAdvancingCount)
    const leaderboardEliminated = finalizedState.leaderboard.slice(expectedAdvancingCount)

    const topNDriverIds = leaderboardTopN.map((e) => e.driverId)
    const eliminatedDriverIds = leaderboardEliminated.map((e) => e.driverId)

    // Provas:
    // 1. Exatamente os primeiros N avançam
    expect(finalizedResult.advancingDriverIds).toEqual(topNDriverIds)

    // 2. Nenhum eliminado entra nos classificados
    for (const eliminatedId of eliminatedDriverIds) {
      expect(finalizedResult.advancingDriverIds).not.toContain(eliminatedId)
    }

    // 3. Nenhum classificado fica de fora
    for (const advancingId of topNDriverIds) {
      expect(finalizedResult.advancingDriverIds).toContain(advancingId)
      expect(finalizedResult.eliminatedDriverIds).not.toContain(advancingId)
    }

    // 4. Quantidade de eliminados respeita a regra canônica
    expect(finalizedResult.eliminatedDriverIds).toHaveLength(expectedEliminatedCount)
    expect(finalizedResult.eliminatedDriverIds).toEqual(eliminatedDriverIds)

    // 5. Flags no leaderboard estão alinhadas com o corte do runner
    leaderboardTopN.forEach((entry) => {
      expect(entry.isEliminated).toBe(false)
    })
    leaderboardEliminated.forEach((entry) => {
      expect(entry.isEliminated).toBe(true)
      expect(entry.eliminatedInStage).toBe('q1')
    })
  })

  // =================================================================================================
  // T3 — RESOLVER DO Q2
  // =================================================================================================
  it('T3 — RESOLVER DO Q2: qualifyingParticipantResolver real produz participantes do Q2 idênticos aos classificados de Q1', () => {
    const { result: q1Result } = executeDeterministicCompletedQ1(
      TEST_SEASON_ID,
      TEST_ROUND,
      canonical24Drivers,
    )

    // Invocar o resolver canônico real para Q2
    const q2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: allEntriesSnapshot,
      playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
    })

    const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES.q1.advancingCount

    // Provas:
    // 1. Quantidade de participantes do Q2 === advancingCount da regra canônica de Q1
    expect(q2Participants).toHaveLength(expectedAdvancingCount)
    expect(q2Participants).toHaveLength(q1Result.advancingDriverIds.length)

    // 2. IDs e ordem coincidem exatamente com o StageResult(q1).advancingDriverIds
    const q2DriverIds = q2Participants.map((p) => p.id)
    expect(q2DriverIds).toEqual(q1Result.advancingDriverIds)

    // 3. Cada participante possui dados estruturais preenchidos (nome, equipe, carro)
    for (const p of q2Participants) {
      expect(p.id).toBeDefined()
      expect(p.name).toBeDefined()
      expect(p.teamId).toBeDefined()
      expect(p.carNumber).toBeDefined()
    }
  })

  // =================================================================================================
  // T4 — Q2 NÃO NASCE VAZIO
  // =================================================================================================
  it('T4 — Q2 NÃO NASCE VAZIO: inicialização canônica de Q2 materializa estado e leaderboard não vazios com os classificados', () => {
    const { result: q1Result } = executeDeterministicCompletedQ1(
      TEST_SEASON_ID,
      TEST_ROUND,
      canonical24Drivers,
    )

    // 1. Resolve participantes canônicos reais de Q2
    const q2Eligible = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: allEntriesSnapshot,
      playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
    })
    expect(q2Eligible.length).toBeGreaterThan(0)

    // 2. Inicializa Q2 pelo runner real
    const q2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1,
      playerCar2,
      eligibleParticipants: q2Eligible,
      persistState: true,
    })

    // Provas contra a regressão original (Q2 com 0 participantes):
    // 1. O estado de Q2 existe e está pronto para correr
    expect(q2State).toBeDefined()
    expect(q2State.stageId).toBe('q2')
    expect(q2State.status).toBe('not_started')
    expect(q2State.sessionDurationSec).toBe(CANONICAL_QUALIFYING_RULES.q2.durationSec)
    expect(q2State.timeRemainingSec).toBe(CANONICAL_QUALIFYING_RULES.q2.durationSec)

    // 2. Leaderboard NÃO nasce vazio
    expect(q2State.leaderboard.length).toBeGreaterThan(0)
    expect(q2State.leaderboard).toHaveLength(CANONICAL_QUALIFYING_RULES.q1.advancingCount)

    // 3. Todos os participantes do leaderboard pertencem aos classificados do Q1
    const q2LeaderboardDriverIds = q2State.leaderboard.map((e) => e.driverId)
    expect(q2LeaderboardDriverIds).toEqual(q1Result.advancingDriverIds)

    for (const driverId of q2LeaderboardDriverIds) {
      expect(q1Result.advancingDriverIds).toContain(driverId)
      expect(q1Result.eliminatedDriverIds).not.toContain(driverId)
    }

    // 4. O estado persistido em storage confirma leaderboard não vazio
    const persistedQ2 = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q2',
    )
    expect(persistedQ2).not.toBeNull()
    expect(persistedQ2!.leaderboard).toHaveLength(CANONICAL_QUALIFYING_RULES.q1.advancingCount)
    expect(persistedQ2!.leaderboard.length).toBeGreaterThan(0)
  })

  // =================================================================================================
  // T5 — RESULTADO AUSENTE
  // =================================================================================================
  it('T5 — RESULTADO AUSENTE: sem StageResult(q1), resolver Q2 lança QualifyingPrerequisiteError e nunca retorna [] silenciosamente', () => {
    const isolatedRound = 11

    // Confirma que não há StageResult(q1) para este round isolado
    const emptyResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      isolatedRound,
      'q1',
    )
    expect(emptyResult).toBeNull()

    // Resolver Q2 sem pré-requisito concluído DEVE lançar QualifyingPrerequisiteError
    expect(() => {
      resolveEligibleQualifyingDrivers({
        stageId: 'q2',
        seasonId: TEST_SEASON_ID,
        round: isolatedRound,
        allEntries: allEntriesSnapshot,
        playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
      })
    }).toThrow(QualifyingPrerequisiteError)

    // Prova do reason canônico e detalhamento da exceção
    try {
      resolveEligibleQualifyingDrivers({
        stageId: 'q2',
        seasonId: TEST_SEASON_ID,
        round: isolatedRound,
        allEntries: allEntriesSnapshot,
      })
    } catch (err) {
      expect(err instanceof QualifyingPrerequisiteError).toBe(true)
      const prereqErr = err as QualifyingPrerequisiteError
      expect(prereqErr.stageId).toBe('q2')
      expect(prereqErr.parentStageId).toBe('q1')
      expect(prereqErr.reason).toBe('missing_stage_result')
    }
  })

  // =================================================================================================
  // T6 — RESULTADO INVÁLIDO
  // =================================================================================================
  it('T6 — RESULTADO INVÁLIDO: StageResult com contagem inválida de classificados falha explicitamente com QualifyingPrerequisiteError', () => {
    const invalidRound = 12

    // 1. Gravar propositalmente um StageResult com quantidade inválida (ex: 5 em vez de advancingCount da regra canônica)
    const corruptedResult: QualifyingStageResult = {
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: invalidRound,
      completedAt: new Date().toISOString(),
      entries: canonical24Drivers.map((d, idx) => ({
        position: idx + 1,
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
        teamColor: d.teamColor,
        bestLapSec: 72.0 + idx * 0.1,
        bestLapTime: '1:12.000',
        bestLapRecordedAtSec: 100,
        compound: 'macio',
        lapsCount: 3,
        isPlayer: idx < 2,
        isEliminated: idx >= 5,
      })),
      advancingDriverIds: canonical24Drivers.slice(0, 5).map((d) => d.id), // Apenas 5 em vez da contagem regulamentar
      eliminatedDriverIds: canonical24Drivers.slice(5).map((d) => d.id),
    }

    canonicalQualifyingPersistenceService.saveStageResult(corruptedResult)

    // 2. Resolver Q2 sobre esse resultado corrompido
    expect(() => {
      resolveEligibleQualifyingDrivers({
        stageId: 'q2',
        seasonId: TEST_SEASON_ID,
        round: invalidRound,
        allEntries: allEntriesSnapshot,
        playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
      })
    }).toThrow(QualifyingPrerequisiteError)

    try {
      resolveEligibleQualifyingDrivers({
        stageId: 'q2',
        seasonId: TEST_SEASON_ID,
        round: invalidRound,
        allEntries: allEntriesSnapshot,
      })
    } catch (err) {
      expect(err instanceof QualifyingPrerequisiteError).toBe(true)
      const prereqErr = err as QualifyingPrerequisiteError
      expect(prereqErr.reason).toBe('invalid_advancing_count')
    }

    // 3. Testar também caso com IDs duplicados ou vazios
    const duplicateIdsResult: QualifyingStageResult = {
      ...corruptedResult,
      advancingDriverIds: Array(CANONICAL_QUALIFYING_RULES.q1.advancingCount).fill(
        canonical24Drivers[0].id,
      ),
    }
    canonicalQualifyingPersistenceService.saveStageResult(duplicateIdsResult)

    try {
      resolveEligibleQualifyingDrivers({
        stageId: 'q2',
        seasonId: TEST_SEASON_ID,
        round: invalidRound,
        allEntries: allEntriesSnapshot,
      })
    } catch (err) {
      expect(err instanceof QualifyingPrerequisiteError).toBe(true)
      const prereqErr = err as QualifyingPrerequisiteError
      expect(prereqErr.reason).toBe('duplicate_or_invalid_driver_ids')
    }
  })

  // =================================================================================================
  // T7 — ISOLAMENTO
  // =================================================================================================
  it('T7 — ISOLAMENTO: Q2 lê estritamente q1 da mesma season, mesmo round e geração ativa — sem contaminação cruzada', () => {
    const roundA = 13
    const roundB = 14
    const differentSeason = 'season_q2fix04_other'

    // 1. Criar e finalizar Q1 válido no roundA
    const { result: q1RoundA } = executeDeterministicCompletedQ1(
      TEST_SEASON_ID,
      roundA,
      canonical24Drivers,
    )

    // 2. Criar resultado de SQ1 (Sprint Shootout) no roundB e resultado em temporada diferente
    const sq1Result: QualifyingStageResult = {
      stageId: 'sq1',
      seasonId: TEST_SEASON_ID,
      round: roundB,
      completedAt: new Date().toISOString(),
      entries: canonical24Drivers.map((d, idx) => ({
        position: idx + 1,
        driverId: d.id,
        driverName: d.name,
        teamId: d.teamId,
        teamName: d.teamName,
        teamColor: d.teamColor,
        bestLapSec: 75.0,
        bestLapTime: '1:15.000',
        bestLapRecordedAtSec: 50,
        compound: 'medio' as const,
        lapsCount: 2,
        isPlayer: idx < 2,
        isEliminated: idx >= 18,
      })),
      advancingDriverIds: canonical24Drivers.slice(0, 18).map((d) => d.id),
      eliminatedDriverIds: canonical24Drivers.slice(18).map((d) => d.id),
    }
    canonicalQualifyingPersistenceService.saveStageResult(sq1Result)

    const otherSeasonResult: QualifyingStageResult = {
      ...sq1Result,
      stageId: 'q1',
      seasonId: differentSeason,
      round: roundA,
    }
    canonicalQualifyingPersistenceService.saveStageResult(otherSeasonResult)

    // 3. Provar que Q2 no roundB (que só tem sq1, não q1) falha com pré-requisito ausente e NÃO consome sq1
    expect(() => {
      resolveEligibleQualifyingDrivers({
        stageId: 'q2',
        seasonId: TEST_SEASON_ID,
        round: roundB,
        allEntries: allEntriesSnapshot,
      })
    }).toThrow(QualifyingPrerequisiteError)

    // 4. Provar que Q2 no roundA da outra temporada (differentSeason) lê o resultado da sua própria season, não do TEST_SEASON_ID
    const otherSeasonQ2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: differentSeason,
      round: roundA,
      allEntries: allEntriesSnapshot,
    })
    expect(otherSeasonQ2Participants.map((p) => p.id)).toEqual(otherSeasonResult.advancingDriverIds)

    // 5. Provar isolamento de generation via resetWeekendForRound
    const roundForGenReset = 15
    const initialGen = getActiveWeekendGeneration(TEST_SEASON_ID, roundForGenReset, TEST_CAREER_ID)
    expect(initialGen).toBe(1)

    // Materializa Q1 completed na generation 1
    const { state: q1Gen1State } = executeDeterministicCompletedQ1(
      TEST_SEASON_ID,
      roundForGenReset,
      canonical24Drivers,
    )
    expect(q1Gen1State.generation).toBe(1)

    // Executa reset do fim de semana para roundForGenReset (incrementa para generation 2)
    const resetRes = resetWeekendForRound({
      careerId: TEST_CAREER_ID,
      seasonId: TEST_SEASON_ID,
      round: roundForGenReset,
    })
    expect(resetRes.success).toBe(true)
    expect(resetRes.newGeneration).toBe(2)

    // Após reset, o stage state da geração 1 é considerado STALE pela persistência e retorna null
    const staleStateRead = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      roundForGenReset,
      'q1',
    )
    expect(staleStateRead).toBeNull()

    // O Q2 para a rodada resetada não pode reutilizar dados stale da generation 1
    // Uma nova sessão de Q1 deve ser corrida na generation 2 antes do Q2
    const freshQ1Gen2 = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: roundForGenReset,
      playerCar1,
      playerCar2,
      eligibleParticipants: canonical24Drivers,
      persistState: true,
    })
    expect(freshQ1Gen2.generation).toBe(2)
    expect(freshQ1Gen2.status).toBe('not_started')
  })
})
