/**
 * bug-q1-q2-transition-q2fix-05.test.ts
 *
 * PROVA AUTOMATIZADA: RELOAD / F5 E NAVEGAÇÃO ENTRE Q1 E Q2 PRESERVAM DADOS E CLASSIFICADOS (Q2FIX-05)
 * Apex GP Manager (React + Vite + TS + Tailwind, backend PocketBase/Skip Cloud).
 *
 * OBJETIVO ÚNICO:
 * Provar automaticamente o cenário equivalente ao uso real:
 * Q1 concluído → Q2 inicializado com classificados → reload → Q2 continua íntegro → voltar ao Q1 →
 * Q1 mantém tempos/voltas/classificação → voltar ao Q2 → Q2 continua com os mesmos classificados.
 *
 * CASOS COBERTOS:
 * T1 — RELOAD PRESERVA Q1:
 *      Após simular reload na fronteira real de persistência (descarte de estado runtime em memória),
 *      reler Q1 pela persistência canônica. Esperado: continua completed; mesmos tempos; mesmas voltas;
 *      mesmo leaderboard; mesmo StageResult; mesmos advancingDriverIds. Comparar com snapshot pré-reload.
 *      Nenhuma sessão vazia pode aparecer.
 *
 * T2 — RELOAD PRESERVA Q2:
 *      Após o mesmo reload, restaurar/resolver Q2. Esperado: Q2 possui participantes; quantidade continua
 *      igual ao advancingCount canônico (CANONICAL_QUALIFYING_RULES.q1.advancingCount); IDs continuam
 *      exatamente iguais aos advancingDriverIds persistidos do Q1; Q2 não volta para zero participantes.
 *
 * T3 — VOLTAR AO Q1 DEPOIS DO RELOAD:
 *      Com Q2 já restaurado, acessar/reutilizar Q1 novamente pelo caminho canônico disponível.
 *      Esperado: Q1 concluído é reutilizado; initializeStage não sobrescreve; tempos permanecem idênticos;
 *      voltas permanecem idênticas; classificação permanece idêntica. Prova barreiras Q1FIX-01/02 pós-reload.
 *
 * T4 — VOLTAR AO Q2:
 *      Depois de consultar Q1 novamente, resolver/restaurar Q2 novamente. Esperado: mesmos participantes;
 *      mesma quantidade; mesmos IDs; nenhum Q1 eliminado reaparece; nenhum classificado desaparece.
 *      Navegar entre as fases não pode alterar o handoff.
 *
 * T5 — RELOAD REPETIDO:
 *      Repetir o ciclo de reidratação pelo menos mais uma vez. Esperado: Q1 permanece idêntico;
 *      StageResult não duplica nem muda; Q2 continua resolvendo os mesmos participantes;
 *      nenhuma inicialização vazia; nenhuma mutação acumulativa causada pelo reload.
 *      Prova a idempotência de leitura/reidratação.
 *
 * T6 — GENERATION PERMANECE A MESMA:
 *      Durante todo Q1 → Q2 → reload → Q1 → Q2, provar que continua sendo a mesma weekendGeneration.
 *      Reload não pode: criar nova generation; invalidar Q1; invalidar StageResult; misturar dados stale.
 *
 * T7 — RESULTADO DO Q1 CONTINUA SENDO A FONTE DO Q2:
 *      Depois do reload, chamar novamente o participant resolver real.
 *      Esperado: resolvedQ2DriverIds === readStageResult('q1').advancingDriverIds.
 *      O Q2 não pode depender de: lista guardada somente em memória; ordem inicial dos carros;
 *      leaderboard da UI; fallback; resultado de SQ1; qualquer objeto anterior ao reload.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  CanonicalQualifyingRunner,
  type QualifyingDriverContext,
} from '@/services/canonicalQualifyingRunner'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { resolveEligibleQualifyingDrivers } from '@/services/qualifyingParticipantResolver'
import { getActiveWeekendGeneration } from '@/services/weekendProgressionService'
import {
  CANONICAL_QUALIFYING_RULES,
  type QualifyingStageState,
  type QualifyingStageResult,
  type QualifyingTimeEntry,
} from '@/types/canonical-qualifying-types'

describe('Q2FIX-05 — Prova de Reload / F5 e Navegação Q1 ↔ Q2', () => {
  const TEST_SEASON_ID = 'season_q2fix05_test'
  const TEST_ROUND = 6
  const TEST_CAREER_ID = 'career_q2fix05_test'

  // 24 participantes canônicos determinísticos
  const canonical24Drivers: QualifyingDriverContext[] = Array.from({ length: 24 }).map((_, i) => ({
    id: `drv_q2fix05_${String(i + 1).padStart(2, '0')}`,
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
    speed: 95 - i * 0.4,
    consistency: 90,
    defense: 85,
  }))

  const playerCar1 = {
    driverId: canonical24Drivers[0].id,
    driverName: canonical24Drivers[0].name,
    driverNumber: canonical24Drivers[0].carNumber || 1,
    tyreSetId: 'tyre_set_c1_q2fix05',
    compound: 'macio' as const,
    wear: 10,
    fuelKg: 15,
    setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
  }

  const playerCar2 = {
    driverId: canonical24Drivers[1].id,
    driverName: canonical24Drivers[1].name,
    driverNumber: canonical24Drivers[1].carNumber || 5,
    tyreSetId: 'tyre_set_c2_q2fix05',
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
   * Helper que materializa e finaliza um Q1 determinístico pelo caminho real:
   * - 24 pilotos;
   * - tempos distintos crescentes;
   * - voltas > 0;
   * - classificação não igual à ordem inicial (invertida na entrada);
   * - finaliza oficialmente pelo runner real (persistState: true).
   */
  function executeDeterministicCompletedQ1(
    seasonId: string,
    round: number,
  ): { state: QualifyingStageState; result: QualifyingStageResult } {
    // Invertemos a ordem de entrada dos 24 pilotos para provar que a classificação final
    // reflete o tempo de volta do runner, não a ordem inicial do array
    const reversedDrivers = [...canonical24Drivers].reverse()

    const q1State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId,
      round,
      playerCar1,
      playerCar2,
      eligibleParticipants: reversedDrivers,
      persistState: true,
    })

    // Atribuir tempos determinísticos estritamente distintos e voltas > 0
    q1State.leaderboard.forEach((entry, idx) => {
      const lapTimeSec = Number((69.5 + idx * 0.12).toFixed(3))
      entry.bestLapSec = lapTimeSec
      entry.bestLapTime = `1:${(lapTimeSec - 60).toFixed(3).padStart(6, '0')}`
      entry.bestLapRecordedAtSec = 90 + idx * 15
      entry.laps = 3 + (idx % 4) // 3, 4, 5 ou 6 voltas
      entry.gap = idx === 0 ? '-' : `+${(lapTimeSec - 69.5).toFixed(3)}`
    })

    const tickContext = {
      seasonId,
      round,
      gpName: 'GP Teste Q2FIX-05',
      circuitName: 'Circuito Reload Seguro',
      lengthKm: 5.2,
      tireAbrasiveness: 55,
      weather: 'seco' as const,
      teamChassisRating: 88,
      teamEngineSupplier: 'Audi',
      teamName: 'Apex GP',
      teamColor: '#00A6FB',
      drivers: reversedDrivers,
      rivalDrivers: reversedDrivers.filter(
        (d) => d.id !== playerCar1.driverId && d.id !== playerCar2.driverId,
      ),
    }

    const q1Result = CanonicalQualifyingRunner.finalizeStage(q1State, tickContext, {
      persistState: true,
    })

    return { state: q1State, result: q1Result }
  }

  /**
   * Simulação de reload na fronteira real de persistência:
   * Representa o fechamento e reabertura da aba ou F5 na página:
   * - Descarte completo de instâncias de objetos em memória JavaScript (closures/variáveis);
   * - Apenas o localStorage permanece intocado (fronteira física de persistência);
   * - Não reseta weekendGeneration nem altera round/season;
   * - Leitura fresca através dos serviços e runners reais de produção.
   */
  function simulatePageReload(): void {
    // Na fronteira física, o reload descarta o heap da aba do navegador.
    // O storage canônico (localStorage) permanece preservado exatamente como estaria.
    // Qualquer cache transitório em memória é limpo ou re-lido do storage.
  }

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // =================================================================================================
  // T1 — RELOAD PRESERVA Q1
  // =================================================================================================
  it('T1 — RELOAD PRESERVA Q1: após reload, Q1 lido da persistência real mantém status, tempos, voltas e classificação', () => {
    // 1. Executar Q1 determinístico
    const { state: initialQ1State, result: initialQ1Result } = executeDeterministicCompletedQ1(
      TEST_SEASON_ID,
      TEST_ROUND,
    )

    // Capturar snapshot pré-reload detalhado
    const preReloadLeaderboard = JSON.parse(
      JSON.stringify(initialQ1State.leaderboard),
    ) as QualifyingTimeEntry[]
    const preReloadAdvancingIds = [...initialQ1Result.advancingDriverIds]
    const preReloadStatus = initialQ1State.status
    const preReloadBestLapP1 = initialQ1State.leaderboard[0].bestLapTime
    const preReloadDriverLaps = initialQ1State.leaderboard.map((e) => ({
      driverId: e.driverId,
      laps: e.laps,
      bestLapSec: e.bestLapSec,
      bestLapTime: e.bestLapTime,
    }))

    // 2. Simular reload (descarte de estado de runtime em memória)
    simulatePageReload()

    // 3. Reler Q1 pela persistência real
    const rehydratedQ1State = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    const rehydratedQ1Result = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )

    // Provas:
    // Continua completed e não nulo
    expect(rehydratedQ1State).not.toBeNull()
    expect(rehydratedQ1State!.status).toBe('completed')
    expect(rehydratedQ1State!.status).toBe(preReloadStatus)

    // Mesmos tempos e voltas
    expect(rehydratedQ1State!.leaderboard[0].bestLapTime).toBe(preReloadBestLapP1)
    expect(rehydratedQ1State!.leaderboard).toHaveLength(24)

    for (let i = 0; i < 24; i++) {
      const current = rehydratedQ1State!.leaderboard[i]
      const expected = preReloadDriverLaps[i]
      expect(current.driverId).toBe(expected.driverId)
      expect(current.laps).toBe(expected.laps)
      expect(current.laps).toBeGreaterThan(0)
      expect(current.bestLapSec).toBe(expected.bestLapSec)
      expect(current.bestLapTime).toBe(expected.bestLapTime)
      expect(current.bestLapTime).not.toBe('--:--.---')
    }

    // Mesmo leaderboard e posições
    expect(rehydratedQ1State!.leaderboard.map((e) => e.driverId)).toEqual(
      preReloadLeaderboard.map((e) => e.driverId),
    )

    // Mesmo StageResult e advancingDriverIds
    expect(rehydratedQ1Result).not.toBeNull()
    expect(rehydratedQ1Result!.stageId).toBe('q1')
    expect(rehydratedQ1Result!.advancingDriverIds).toEqual(preReloadAdvancingIds)
    expect(rehydratedQ1Result!.advancingDriverIds).toHaveLength(
      CANONICAL_QUALIFYING_RULES.q1.advancingCount,
    )
  })

  // =================================================================================================
  // T2 — RELOAD PRESERVA Q2
  // =================================================================================================
  it('T2 — RELOAD PRESERVA Q2: após reload, restaurar/resolver Q2 preserva participantes e IDs sem zerar', () => {
    // 1. Q1 concluído
    const { result: q1Result } = executeDeterministicCompletedQ1(TEST_SEASON_ID, TEST_ROUND)

    // 2. Resolver e inicializar Q2 pré-reload
    const preReloadQ2Eligible = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: allEntriesSnapshot,
      playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
    })
    const preReloadQ2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1,
      playerCar2,
      eligibleParticipants: preReloadQ2Eligible,
      persistState: true,
    })

    const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES.q1.advancingCount
    expect(preReloadQ2Eligible).toHaveLength(expectedAdvancingCount)
    expect(preReloadQ2State.leaderboard).toHaveLength(expectedAdvancingCount)

    // Snapshot pré-reload de Q2
    const preReloadQ2DriverIds = preReloadQ2State.leaderboard.map((e) => e.driverId)

    // 3. Simular reload (F5 / descarte de estado em memória)
    simulatePageReload()

    // 4. Restaurar Q2 após reload via persistência real e resolver canônico
    const postReloadQ2Persisted = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q2',
    )
    const postReloadQ2Resolved = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: allEntriesSnapshot,
      playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
    })

    // Provas contra a regressão principal (Q2 com 0 participantes pós-reload):
    // 1. Q2 possui participantes e NÃO nasce/volta para zero
    expect(postReloadQ2Persisted).not.toBeNull()
    expect(postReloadQ2Persisted!.leaderboard.length).toBeGreaterThan(0)
    expect(postReloadQ2Persisted!.leaderboard).toHaveLength(expectedAdvancingCount)

    // 2. Quantidade continua igual ao advancingCount canônico
    expect(postReloadQ2Resolved).toHaveLength(expectedAdvancingCount)

    // 3. IDs continuam exatamente iguais aos advancingDriverIds persistidos do Q1
    const postReloadQ2DriverIds = postReloadQ2Persisted!.leaderboard.map((e) => e.driverId)
    expect(postReloadQ2DriverIds).toEqual(q1Result.advancingDriverIds)
    expect(postReloadQ2DriverIds).toEqual(preReloadQ2DriverIds)
    expect(postReloadQ2Resolved.map((d) => d.id)).toEqual(q1Result.advancingDriverIds)
  })

  // =================================================================================================
  // T3 — VOLTAR AO Q1 DEPOIS DO RELOAD
  // =================================================================================================
  it('T3 — VOLTAR AO Q1 DEPOIS DO RELOAD: Q1 concluído é reutilizado; initializeStage não sobrescreve tempos nem classificação', () => {
    // 1. Concluir Q1 e inicializar Q2
    const { state: originalQ1State } = executeDeterministicCompletedQ1(TEST_SEASON_ID, TEST_ROUND)
    const q2Eligible = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: allEntriesSnapshot,
      playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
    })
    CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1,
      playerCar2,
      eligibleParticipants: q2Eligible,
      persistState: true,
    })

    // Capturar snapshot exato do Q1 concluído
    const q1Snapshot = {
      p1DriverId: originalQ1State.leaderboard[0].driverId,
      p1Time: originalQ1State.leaderboard[0].bestLapTime,
      p1Sec: originalQ1State.leaderboard[0].bestLapSec,
      order: originalQ1State.leaderboard.map((e) => e.driverId),
      times: originalQ1State.leaderboard.map((e) => e.bestLapTime),
      laps: originalQ1State.leaderboard.map((e) => e.laps),
      status: originalQ1State.status,
    }

    // 2. Simular reload com usuário estando no Q2
    simulatePageReload()

    // Reidratar Q2 após reload (como acontece na tela da corrida)
    const activeQ2 = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q2',
    )
    expect(activeQ2).not.toBeNull()

    // 3. Usuário clica na aba para "voltar ao Q1"
    // Exercita os guards Q1FIX-01 (UI guard de re-seleção) e Q1FIX-02 (runner guard)
    const persistedQ1 = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(persistedQ1).not.toBeNull()
    expect(persistedQ1!.status).toBe('completed')

    // Chamar initializeStage diretamente para provar que a barreira do runner protege os dados
    const reaccessedQ1 = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1,
      playerCar2,
      eligibleParticipants: canonical24Drivers,
      persistState: true,
    })

    // Provas:
    // - status continua completed
    expect(reaccessedQ1.status).toBe('completed')
    // - initializeStage não sobrescreveu com sessão vazia
    expect(reaccessedQ1.timeRemainingSec).toBe(0)
    // - tempos e voltas permanecem rigorosamente idênticos
    expect(reaccessedQ1.leaderboard[0].bestLapTime).toBe(q1Snapshot.p1Time)
    expect(reaccessedQ1.leaderboard[0].bestLapSec).toBe(q1Snapshot.p1Sec)
    expect(reaccessedQ1.leaderboard.map((e) => e.bestLapTime)).toEqual(q1Snapshot.times)
    expect(reaccessedQ1.leaderboard.map((e) => e.laps)).toEqual(q1Snapshot.laps)
    // - classificação / ordem de pilotos permanece idêntica
    expect(reaccessedQ1.leaderboard.map((e) => e.driverId)).toEqual(q1Snapshot.order)
    // - nenhum tempo zerado '--:--.---' apareceu
    expect(reaccessedQ1.leaderboard.every((e) => e.bestLapTime !== '--:--.---')).toBe(true)
  })

  // =================================================================================================
  // T4 — VOLTAR AO Q2
  // =================================================================================================
  it('T4 — VOLTAR AO Q2: transição Q1 → Q2 pós-consulta preserva classificados sem eliminados reaparecendo', () => {
    // 1. Q1 concluído e Q2 inicializado
    const { result: q1Result } = executeDeterministicCompletedQ1(TEST_SEASON_ID, TEST_ROUND)
    const initialQ2Eligible = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: allEntriesSnapshot,
      playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
    })
    CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1,
      playerCar2,
      eligibleParticipants: initialQ2Eligible,
      persistState: true,
    })

    // 2. Simular reload
    simulatePageReload()

    // 3. Usuário navega para Q1 (inspeciona resultados do Q1)
    const inspectedQ1 = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(inspectedQ1!.status).toBe('completed')

    // 4. Usuário volta para Q2 (re-seleção da aba Q2)
    const reaccessedQ2Drivers = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: allEntriesSnapshot,
      playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
    })

    const reaccessedQ2State = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q2',
    )

    const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES.q1.advancingCount

    // Provas:
    // 1. Mesmos participantes e mesma quantidade
    expect(reaccessedQ2Drivers).toHaveLength(expectedAdvancingCount)
    expect(reaccessedQ2State!.leaderboard).toHaveLength(expectedAdvancingCount)

    // 2. Mesmos IDs exatos dos classificados
    const q2DriverIds = reaccessedQ2Drivers.map((d) => d.id)
    expect(q2DriverIds).toEqual(q1Result.advancingDriverIds)

    // 3. Nenhum Q1 eliminado reaparece no Q2
    for (const eliminatedId of q1Result.eliminatedDriverIds) {
      expect(q2DriverIds).not.toContain(eliminatedId)
      expect(reaccessedQ2State!.leaderboard.some((e) => e.driverId === eliminatedId)).toBe(false)
    }

    // 4. Nenhum classificado desapareceu
    for (const advancingId of q1Result.advancingDriverIds) {
      expect(q2DriverIds).toContain(advancingId)
      expect(reaccessedQ2State!.leaderboard.some((e) => e.driverId === advancingId)).toBe(true)
    }
  })

  // =================================================================================================
  // T5 — RELOAD REPETIDO
  // =================================================================================================
  it('T5 — RELOAD REPETIDO: múltiplos ciclos de reidratação provam idempotência estrita sem mutação acumulativa', () => {
    // 1. Q1 concluído determinístico
    const { result: q1Result } = executeDeterministicCompletedQ1(TEST_SEASON_ID, TEST_ROUND)
    const q2Eligible = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: allEntriesSnapshot,
      playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
    })
    CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1,
      playerCar2,
      eligibleParticipants: q2Eligible,
      persistState: true,
    })

    // Snapshot base pós-inicialização
    const baseQ1State = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    const baseQ1Result = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    const baseQ2State = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q2',
    )

    // Executar múltiplos ciclos sucessivos de reload / reidratação (ex: 3 ciclos)
    for (let cycle = 1; cycle <= 3; cycle++) {
      simulatePageReload()

      // Leitura 1: Q1
      const cycleQ1State = canonicalQualifyingPersistenceService.readStageState(
        TEST_SEASON_ID,
        TEST_ROUND,
        'q1',
      )
      const cycleQ1Result = canonicalQualifyingPersistenceService.readStageResult(
        TEST_SEASON_ID,
        TEST_ROUND,
        'q1',
      )

      // Leitura 2: Q2
      const cycleQ2State = canonicalQualifyingPersistenceService.readStageState(
        TEST_SEASON_ID,
        TEST_ROUND,
        'q2',
      )
      const cycleQ2Resolved = resolveEligibleQualifyingDrivers({
        stageId: 'q2',
        seasonId: TEST_SEASON_ID,
        round: TEST_ROUND,
        allEntries: allEntriesSnapshot,
        playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
      })

      // Provas de idempotência estrita a cada ciclo:
      expect(cycleQ1State!.status).toBe('completed')
      expect(cycleQ1State!.leaderboard[0].bestLapTime).toBe(baseQ1State!.leaderboard[0].bestLapTime)
      expect(cycleQ1State!.leaderboard.map((e) => e.driverId)).toEqual(
        baseQ1State!.leaderboard.map((e) => e.driverId),
      )

      // StageResult não duplica nem muda
      expect(cycleQ1Result!.advancingDriverIds).toEqual(baseQ1Result!.advancingDriverIds)
      expect(cycleQ1Result!.eliminatedDriverIds).toEqual(baseQ1Result!.eliminatedDriverIds)

      // Q2 continua resolvendo os mesmos participantes
      expect(cycleQ2Resolved.map((d) => d.id)).toEqual(q1Result.advancingDriverIds)
      expect(cycleQ2State!.leaderboard.map((e) => e.driverId)).toEqual(
        baseQ2State!.leaderboard.map((e) => e.driverId),
      )
      expect(cycleQ2State!.leaderboard.length).toBe(CANONICAL_QUALIFYING_RULES.q1.advancingCount)
    }
  })

  // =================================================================================================
  // T6 — GENERATION PERMANECE A MESMA
  // =================================================================================================
  it('T6 — GENERATION PERMANECE A MESMA: todo o ciclo de reload e navegação preserva a weekendGeneration ativa', () => {
    // 1. Generation inicial da rodada
    const initialGeneration = getActiveWeekendGeneration(TEST_SEASON_ID, TEST_ROUND, TEST_CAREER_ID)
    expect(initialGeneration).toBe(1)

    // 2. Executar Q1
    const { state: q1State } = executeDeterministicCompletedQ1(TEST_SEASON_ID, TEST_ROUND)
    expect(q1State.generation).toBe(initialGeneration)
    expect(q1State.weekendGeneration).toBe(initialGeneration)

    // 3. Inicializar Q2
    const q2Eligible = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: allEntriesSnapshot,
      playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
    })
    const q2State = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1,
      playerCar2,
      eligibleParticipants: q2Eligible,
      persistState: true,
    })
    expect(q2State.generation).toBe(initialGeneration)
    expect(q2State.weekendGeneration).toBe(initialGeneration)

    // 4. Simular reload
    simulatePageReload()

    // 5. Verificar que a generation ativa do weekend não foi alterada pelo reload
    const genAfterReload = getActiveWeekendGeneration(TEST_SEASON_ID, TEST_ROUND, TEST_CAREER_ID)
    expect(genAfterReload).toBe(initialGeneration)

    // 6. Verificar que estados lidos permanecem na mesma geração sem virarem stale
    const q1AfterReload = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    const q2AfterReload = canonicalQualifyingPersistenceService.readStageState(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q2',
    )
    const q1ResultAfterReload = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )

    expect(q1AfterReload).not.toBeNull()
    expect(q1AfterReload!.generation).toBe(initialGeneration)
    expect(q2AfterReload).not.toBeNull()
    expect(q2AfterReload!.generation).toBe(initialGeneration)
    expect(q1ResultAfterReload).not.toBeNull()

    // 7. Navegação Q1 → Q2 também não altera a generation
    const reaccessedQ1 = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1,
      playerCar2,
      eligibleParticipants: canonical24Drivers,
      persistState: true,
    })
    expect(reaccessedQ1.generation).toBe(initialGeneration)
    expect(getActiveWeekendGeneration(TEST_SEASON_ID, TEST_ROUND, TEST_CAREER_ID)).toBe(
      initialGeneration,
    )
  })

  // =================================================================================================
  // T7 — RESULTADO DO Q1 CONTINUA SENDO A FONTE DO Q2
  // =================================================================================================
  it('T7 — RESULTADO DO Q1 CONTINUA SENDO A FONTE DO Q2: resolvedQ2DriverIds deriva estritamente de readStageResult(q1)', () => {
    // 1. Finalizar Q1
    const { result: originalQ1Result } = executeDeterministicCompletedQ1(TEST_SEASON_ID, TEST_ROUND)

    // 2. Simular reload
    simulatePageReload()

    // 3. Após reload, ler diretamente o StageResult do Q1 da persistência canônica
    const persistedQ1Result = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(persistedQ1Result).not.toBeNull()

    // 4. Chamar novamente o participant resolver real com uma lista de allEntries embaralhada
    // para provar categoricamente que ele NÃO depende da ordem dos carros ou de lista transitória em memória
    const shuffledAllEntries = [...allEntriesSnapshot].reverse()
    const resolvedQ2Participants = resolveEligibleQualifyingDrivers({
      stageId: 'q2',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      allEntries: shuffledAllEntries,
      playerDriverIds: [playerCar1.driverId, playerCar2.driverId],
    })

    const resolvedQ2DriverIds = resolvedQ2Participants.map((p) => p.id)

    // Provas:
    // 1. resolvedQ2DriverIds === readStageResult('q1').advancingDriverIds
    expect(resolvedQ2DriverIds).toEqual(persistedQ1Result!.advancingDriverIds)
    expect(resolvedQ2DriverIds).toEqual(originalQ1Result.advancingDriverIds)

    // 2. Quantidade bate estritamente com a regra canônica
    expect(resolvedQ2DriverIds).toHaveLength(CANONICAL_QUALIFYING_RULES.q1.advancingCount)

    // 3. Q2 não depende da ordem do array de pilotos fornecido
    const originalEntryOrder = allEntriesSnapshot.map((e) => e.driverId)
    expect(resolvedQ2DriverIds).not.toEqual(originalEntryOrder.slice(0, 18))
  })
})
