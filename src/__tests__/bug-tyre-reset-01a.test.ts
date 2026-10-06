/**
 * bug-tyre-reset-01a.test.ts
 *
 * BUG-TYRE-RESET-01A / RESET-FIX-2 — GATEKEEPER CONTRA STATE STALE
 *
 * Contratos validados:
 * S1 — STATE ATUAL SALVA: generation N, state N, persistência funciona normalmente.
 * S2 — RESET INVALIDA: executar reset, generation vira N+1.
 * S3 — STALE STAGE STATE: tentar saveStageState com state N; confirmar rejeitado, storage resetado permanece intacto, state antigo não reaparece.
 * S4 — STALE SESSION STATE: mesmo contrato para saveSessionState (rejeitado, storage intacto).
 * S5 — NOVO STATE FUNCIONA: state N+1 persiste normalmente.
 * S6 — RELOAD: após reset e novo state, reload reconhece somente generation N+1.
 * S7 — HANDLER INDIRETO: exercitar fluxos reais (orderCarExitToTrack, updateCarGarageSetup, fitTyreSetInGarage) que chamam save com referência antiga pós-reset; confirmar que o gatekeeper central bloqueia.
 * S8 — LEGACY: cobrir explicitamente state sem generation conforme a regra de compatibilidade adotada (aceito se baseline N=1; rejeitado se rodada já avançou generation por reset).
 * S9 — FUTURE INCONSISTENCY: state com generation > current é rejeitado e não sobrescreve storage silenciosamente.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resetWeekendForRound,
  getActiveWeekendGeneration,
  bumpWeekendGeneration,
  getWeekendGenerationStorageKey,
} from '@/services/weekendProgressionService'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { practiceSessionService } from '@/services/practiceSessionService'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { CanonicalPracticeRunner as PracticeSessionRunner } from '@/services/canonicalPracticeRunner'
import { createInitialSetupKnowledge } from '@/services/canonicalPracticeFeedbackService'
import type { QualifyingStageState } from '@/types/canonical-qualifying-types'
import type { PracticeSessionRecordState } from '@/types/practice-session'

describe('RESET-FIX-2 / bug-tyre-reset-01a — Gatekeeper Contra State Stale', () => {
  const seasonId = 'season_2026_test'
  const round = 1
  const careerId = 'career_player_01'

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // Helper para criar QualifyingStageState mínimo e válido
  function createMockQualiState(
    stageId: 'q1' | 'q2' | 'q3' = 'q1',
    generation?: number,
  ): QualifyingStageState {
    return {
      stageId,
      status: 'paused',
      sessionDurationSec: 1080,
      elapsedTimeSec: 120,
      timeRemainingSec: 960,
      simSpeed: 1,
      cars: {
        car1: {
          carId: 'car1',
          driverId: 'drv_norris',
          driverName: 'Lando Norris',
          driverNumber: 4,
          status: 'garage',
          pitRequested: false,
          currentTyreSetId: 'tyre_set_01',
          currentCompound: 'macio',
          tyreWear: 5,
          fuelKg: 15,
          currentLapProgressPct: 0,
          outLapsDone: 0,
          flyingLapsDone: 0,
          inLapsDone: 0,
          totalLaps: 1,
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          isEliminated: false,
        },
        car2: {
          carId: 'car2',
          driverId: 'drv_piastri',
          driverName: 'Oscar Piastri',
          driverNumber: 81,
          status: 'garage',
          pitRequested: false,
          currentTyreSetId: 'tyre_set_02',
          currentCompound: 'macio',
          tyreWear: 8,
          fuelKg: 15,
          currentLapProgressPct: 0,
          outLapsDone: 0,
          flyingLapsDone: 0,
          inLapsDone: 0,
          totalLaps: 1,
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          isEliminated: false,
        },
      },
      leaderboard: [],
      lapHistory: {},
      radioFeed: [],
      parcFermeActive: false,
      revision: 1,
      generation,
      weekendGeneration: generation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  // Helper para criar PracticeSessionRecordState mínimo
  function createMockPracticeState(generation?: number): PracticeSessionRecordState {
    return {
      careerId,
      seasonId,
      round,
      sessionType: 'tp1',
      status: 'paused',
      sessionDurationSec: 3600,
      elapsedTimeSec: 300,
      timeRemainingSec: 3300,
      simSpeed: 1,
      cars: {
        car1: {
          carId: 'car1',
          driverId: 'drv_norris',
          driverName: 'Lando Norris',
          status: 'garage',
          pitRequested: false,
          program: 'car_setup',
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          currentTyreSetId: 'tyre_tp_01',
          currentCompound: 'medio',
          tyreWear: 10,
          fuelKg: 30,
          lapsInStint: 0,
          totalLaps: 2,
          currentLapProgressPct: 0,
        },
        car2: {
          carId: 'car2',
          driverId: 'drv_piastri',
          driverName: 'Oscar Piastri',
          status: 'garage',
          pitRequested: false,
          program: 'race_pace',
          setup: { frontWing: 6, rearWing: 6, suspension: 6, differential: 50 },
          currentTyreSetId: 'tyre_tp_02',
          currentCompound: 'medio',
          tyreWear: 12,
          fuelKg: 30,
          lapsInStint: 0,
          totalLaps: 2,
          currentLapProgressPct: 0,
        },
      },
      stints: [],
      lapHistory: {},
      leaderboard: [],
      radioFeed: [],
      feedbacks: [],
      knowledge: createInitialSetupKnowledge(),
      revision: 1,
      generation,
      weekendGeneration: generation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  it('S1 — STATE ATUAL SALVA: generation N, state N, persistência funciona normalmente', async () => {
    const currentGen = getActiveWeekendGeneration(seasonId, round, careerId)
    expect(currentGen).toBe(1)

    const qualiState = createMockQualiState('q1', currentGen)
    const practiceState = createMockPracticeState(currentGen)

    const qualiSaved = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      qualiState,
    )
    expect(qualiSaved).toBe(true)

    await practiceSessionService.saveSessionState(practiceState)

    const qualiKey = canonicalQualifyingPersistenceService.getStageStateKey(seasonId, round, 'q1')
    expect(localStorage.getItem(qualiKey)).not.toBeNull()

    const loadedQuali = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
    expect(loadedQuali).not.toBeNull()
    expect(loadedQuali?.generation).toBe(currentGen)
    expect(loadedQuali?.weekendGeneration).toBe(currentGen)

    const loadedPractice = practiceSessionService.readFromLocalCache(
      careerId,
      seasonId,
      round,
      'tp1',
    )
    expect(loadedPractice).not.toBeNull()
    expect(loadedPractice?.generation).toBe(currentGen)
    expect(loadedPractice?.weekendGeneration).toBe(currentGen)
  })

  it('S2 — RESET INVALIDA: executar reset, generation vira N+1', () => {
    expect(getActiveWeekendGeneration(seasonId, round, careerId)).toBe(1)

    const resetRes = resetWeekendForRound({ careerId, seasonId, round })
    expect(resetRes.success).toBe(true)
    expect(resetRes.newGeneration).toBe(2)
    expect(getActiveWeekendGeneration(seasonId, round, careerId)).toBe(2)
  })

  it('S3 — STALE STAGE STATE: tentar saveStageState com state N após reset; confirmar rejeitado, storage resetado permanece intacto, state antigo não reaparece', () => {
    // 1. Salvar state na geração 1
    const stateQ1 = createMockQualiState('q1', 1)
    expect(canonicalQualifyingPersistenceService.saveStageState(seasonId, round, stateQ1)).toBe(
      true,
    )
    const qualiKey = canonicalQualifyingPersistenceService.getStageStateKey(seasonId, round, 'q1')
    expect(localStorage.getItem(qualiKey)).not.toBeNull()

    // 2. Reset para geração 2
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round, careerId)).toBe(2)
    expect(localStorage.getItem(qualiKey)).toBeNull()

    // 3. Tentar saveStageState com state da geração 1 (stale)
    const savedStale = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      stateQ1,
    )
    expect(savedStale).toBe(false)

    // Storage resetado permanece intacto e limpo
    expect(localStorage.getItem(qualiKey)).toBeNull()
    expect(canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')).toBeNull()
  })

  it('S4 — STALE SESSION STATE: mesmo contrato para saveSessionState (rejeitado, storage intacto)', async () => {
    // 1. Salvar treino na geração 1
    const stateTP1 = createMockPracticeState(1)
    await practiceSessionService.saveSessionState(stateTP1)
    const tp1Key = `apex_practice_session_${careerId}_${seasonId}_${round}_tp1`
    expect(localStorage.getItem(tp1Key)).not.toBeNull()

    // 2. Reset para geração 2
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round, careerId)).toBe(2)
    expect(localStorage.getItem(tp1Key)).toBeNull()

    // 3. Tentar saveSessionState com state da geração 1 (stale)
    await practiceSessionService.saveSessionState(stateTP1)

    // Storage de treino permanece intacto e limpo
    expect(localStorage.getItem(tp1Key)).toBeNull()
    expect(practiceSessionService.readFromLocalCache(careerId, seasonId, round, 'tp1')).toBeNull()
  })

  it('S5 — NOVO STATE FUNCIONA: state N+1 persiste normalmente', async () => {
    // Reset para avançar para geração 2
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round, careerId)).toBe(2)

    // Novo state criado já com geração 2
    const freshQuali = createMockQualiState('q1', 2)
    const freshPractice = createMockPracticeState(2)

    const savedQ = canonicalQualifyingPersistenceService.saveStageState(seasonId, round, freshQuali)
    expect(savedQ).toBe(true)

    await practiceSessionService.saveSessionState(freshPractice)

    const loadedQ = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
    expect(loadedQ).not.toBeNull()
    expect(loadedQ?.generation).toBe(2)
    expect(loadedQ?.weekendGeneration).toBe(2)

    const loadedP = practiceSessionService.readFromLocalCache(careerId, seasonId, round, 'tp1')
    expect(loadedP).not.toBeNull()
    expect(loadedP?.generation).toBe(2)
    expect(loadedP?.weekendGeneration).toBe(2)
  })

  it('S6 — RELOAD: após reset e novo state, reload reconhece somente generation N+1', () => {
    // 1. Reset para geração 2
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round, careerId)).toBe(2)

    // 2. Se injeção externa espúria colocar chave antiga no storage
    const qualiKey = canonicalQualifyingPersistenceService.getStageStateKey(seasonId, round, 'q1')
    const rogueState = createMockQualiState('q1', 1)
    localStorage.setItem(qualiKey, JSON.stringify(rogueState))

    // 3. Leitor (reload) descarta state obsoleto
    expect(canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')).toBeNull()

    // 4. Salvar estado legítimo geração 2
    const validGen2 = createMockQualiState('q1', 2)
    canonicalQualifyingPersistenceService.saveStageState(seasonId, round, validGen2)

    const reloaded = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
    expect(reloaded).not.toBeNull()
    expect(reloaded?.generation).toBe(2)
    expect(reloaded?.weekendGeneration).toBe(2)
  })

  it('S7 — HANDLER INDIRETO: exercitar fluxos reais que chamam o save com referência antiga pós-reset; confirmar que o gatekeeper central bloqueia', async () => {
    const qualiStateStale = createMockQualiState('q1', 1)
    const practiceStateStale = createMockPracticeState(1)

    // Reset do fim de semana
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round, careerId)).toBe(2)

    // A. Saída para pista via runner
    const exitRes = CanonicalQualifyingRunner.orderCarExitToTrack(qualiStateStale, 'car1')
    expect(exitRes.success).toBe(true)
    const saveExit = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      qualiStateStale,
    )
    expect(saveExit).toBe(false)
    expect(canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')).toBeNull()

    // B. Ajuste de acerto mecânico em qualifying
    const setupRes = CanonicalQualifyingRunner.updateCarGarageSetup(qualiStateStale, 'car1', {
      frontWing: 10,
    })
    expect(setupRes.success).toBe(true)
    const saveSetup = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      qualiStateStale,
    )
    expect(saveSetup).toBe(false)

    // C. Instalação de pneu em qualifying
    CanonicalQualifyingRunner.fitTyreSetInGarage(qualiStateStale, 'car1', {
      id: 'tyre_set_stale_99',
      compound: 'macio',
      wear: 60,
    })
    const saveTyre = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      qualiStateStale,
    )
    expect(saveTyre).toBe(false)
    expect(canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')).toBeNull()

    // D. Treino: alteração de setup em objeto stale
    practiceStateStale.cars.car1.setup = { ...practiceStateStale.cars.car1.setup, frontWing: 10 }
    await practiceSessionService.saveSessionState(practiceStateStale)
    expect(practiceSessionService.readFromLocalCache(careerId, seasonId, round, 'tp1')).toBeNull()
  })

  it('S8 — LEGACY: cobrir explicitamente state sem generation conforme a regra de compatibilidade adotada', async () => {
    // 1. Estado legado antes de qualquer reset (geração baseline = 1)
    expect(getActiveWeekendGeneration(seasonId, round, careerId)).toBe(1)

    const legacyQualiBeforeReset = createMockQualiState('q1', undefined)
    const savedLegacyQ = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      legacyQualiBeforeReset,
    )
    expect(savedLegacyQ).toBe(true)
    expect(legacyQualiBeforeReset.generation).toBe(1)
    expect(legacyQualiBeforeReset.weekendGeneration).toBe(1)

    const readLegacyQ = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
    expect(readLegacyQ).not.toBeNull()
    expect(readLegacyQ?.generation).toBe(1)
    expect(readLegacyQ?.weekendGeneration).toBe(1)

    const legacyPracticeBeforeReset = createMockPracticeState(undefined)
    await practiceSessionService.saveSessionState(legacyPracticeBeforeReset)
    expect(legacyPracticeBeforeReset.generation).toBe(1)
    expect(legacyPracticeBeforeReset.weekendGeneration).toBe(1)

    const readLegacyP = practiceSessionService.readFromLocalCache(careerId, seasonId, round, 'tp1')
    expect(readLegacyP).not.toBeNull()
    expect(readLegacyP?.generation).toBe(1)
    expect(readLegacyP?.weekendGeneration).toBe(1)

    // 2. Agora o fim de semana avança geração por reset (geração vira 2)
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round, careerId)).toBe(2)

    // 3. Tentar persistir um state legado sem generation APÓS o reset
    const legacyQualiAfterReset = createMockQualiState('q1', undefined)
    const savedLegacyAfter = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      legacyQualiAfterReset,
    )
    // REJEITADO! Pois a rodada já avançou além da baseline 1 e não pode presumir silenciosamente que é atual
    expect(savedLegacyAfter).toBe(false)
    expect(canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')).toBeNull()

    const legacyPracticeAfterReset = createMockPracticeState(undefined)
    await practiceSessionService.saveSessionState(legacyPracticeAfterReset)
    expect(practiceSessionService.readFromLocalCache(careerId, seasonId, round, 'tp1')).toBeNull()
  })

  it('S9 — FUTURE INCONSISTENCY: state com generation > current é rejeitado e não sobrescreve storage silenciosamente', async () => {
    expect(getActiveWeekendGeneration(seasonId, round, careerId)).toBe(1)

    const futureQuali = createMockQualiState('q1', 99)
    const savedQ = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      futureQuali,
    )
    expect(savedQ).toBe(false)
    expect(canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')).toBeNull()

    const futurePractice = createMockPracticeState(99)
    await practiceSessionService.saveSessionState(futurePractice)
    expect(practiceSessionService.readFromLocalCache(careerId, seasonId, round, 'tp1')).toBeNull()
  })
})
