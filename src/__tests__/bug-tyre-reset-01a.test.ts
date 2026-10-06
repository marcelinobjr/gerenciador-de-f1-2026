/**
 * bug-tyre-reset-01a.test.ts
 *
 * BUG-TYRE-RESET-01A — BLOQUEAR RESSURREIÇÃO DE ESTADO PRÉ-RESET
 *
 * Validações:
 * R1: estado geração N → reset → tentativa de persistir N → storage permanece limpo.
 * R2: estado da geração N+1 pós-reset persiste normalmente.
 * R3: handler com referência antiga (ordem exit) não ressuscita estado.
 * R4: mesmo para apply car setup.
 * R5: pós-reset + tentativa espúria, reload reconhece apenas geração N+1.
 * R6: pneus/inventário da sessão descartada não reaparecem via objeto stale.
 * R7: regressão — fluxo normal sem reset continua salvando (incluindo estados legados sem generation).
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
import { CanonicalPracticeV2Runner as PracticeSessionRunner } from '@/services/canonicalPracticeV2Runner'
import { createInitialSetupKnowledge } from '@/services/canonicalPracticeFeedbackService'
import type { QualifyingStageState } from '@/types/canonical-qualifying-types'
import type { PracticeSessionRecordState } from '@/types/practice-session'

describe('BUG-TYRE-RESET-01A — Bloquear Ressurreição de Estado Pré-Reset', () => {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  it('R1: estado geração N → reset → tentativa de persistir N → storage permanece limpo', async () => {
    // 1. Iniciar na geração 1
    expect(getActiveWeekendGeneration(seasonId, round)).toBe(1)
    const stateQ1 = createMockQualiState('q1', 1)
    const stateTP1 = createMockPracticeState(1)

    // Salvar estados na geração 1
    expect(canonicalQualifyingPersistenceService.saveStageState(seasonId, round, stateQ1)).toBe(
      true,
    )
    await practiceSessionService.saveSessionState(stateTP1)

    const qualiKey = canonicalQualifyingPersistenceService.getStageStateKey(seasonId, round, 'q1')
    expect(localStorage.getItem(qualiKey)).not.toBeNull()

    // 2. Executar resetWeekendForRound
    const resetRes = resetWeekendForRound({
      careerId,
      seasonId,
      round,
    })
    expect(resetRes.success).toBe(true)
    expect(resetRes.newGeneration).toBe(2)
    expect(getActiveWeekendGeneration(seasonId, round)).toBe(2)
    // Chaves antigas foram limpas
    expect(localStorage.getItem(qualiKey)).toBeNull()

    // 3. Tentativa de persistir estado antigo da geração 1 (stale em memória)
    const qualiSaveResult = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      stateQ1,
    )
    expect(qualiSaveResult).toBe(false)
    // O storage continua estritamente limpo!
    expect(localStorage.getItem(qualiKey)).toBeNull()

    // Mesma garantia para treino livre
    const tp1Key = `apex_practice_session_${careerId}_${seasonId}_${round}_tp1`
    await practiceSessionService.saveSessionState(stateTP1)
    expect(localStorage.getItem(tp1Key)).toBeNull()
  })

  it('R2: estado da geração N+1 pós-reset persiste normalmente', async () => {
    // 1. Reset para subir geração de 1 para 2
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round)).toBe(2)

    // 2. Novo estado gerado explicitamente na geração 2
    const freshQuali = createMockQualiState('q1', 2)
    const freshPractice = createMockPracticeState(2)

    const savedQ = canonicalQualifyingPersistenceService.saveStageState(seasonId, round, freshQuali)
    expect(savedQ).toBe(true)

    await practiceSessionService.saveSessionState(freshPractice)

    // Deve estar persistido
    const loadedQ = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
    expect(loadedQ).not.toBeNull()
    expect(loadedQ?.generation).toBe(2)

    const loadedPractice = practiceSessionService.readFromLocalCache(
      careerId,
      seasonId,
      round,
      'tp1',
    )
    expect(loadedPractice).not.toBeNull()
    expect(loadedPractice?.generation).toBe(2)
  })

  it('R3: handler com referência antiga (ordem exit) não ressuscita estado pós-reset', async () => {
    // 1. Estado ativo de qualificação e treino na geração 1
    const qualiStateStale = createMockQualiState('q1', 1)
    const practiceStateStale = createMockPracticeState(1)

    // 2. Usuário clica em Reset
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round)).toBe(2)

    // 3. Um evento de "Order Exit" ou ação concorrente que segurava qualiStateStale tenta rodar
    const exitRes = CanonicalQualifyingRunner.orderCarExitToTrack(qualiStateStale, 'car1')
    expect(exitRes.success).toBe(true)

    // O handler tenta persistir o estado stale
    const persisted = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      qualiStateStale,
    )
    expect(persisted).toBe(false)

    // Storage de qualificação permanece vazio
    const read = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
    expect(read).toBeNull()

    // O mesmo para treino
    const practiceExit = PracticeSessionRunner.orderCarExitToTrack(practiceStateStale, 'car1')
    expect(practiceExit.success).toBe(true)
    await practiceSessionService.saveSessionState(practiceStateStale)

    const readPractice = practiceSessionService.readFromLocalCache(careerId, seasonId, round, 'tp1')
    expect(readPractice).toBeNull()
  })

  it('R4: handler com referência antiga (apply car setup) não ressuscita estado', async () => {
    // 1. Estado da geração 1
    const qualiStateStale = createMockQualiState('q1', 1)
    const practiceStateStale = createMockPracticeState(1)

    // 2. Reset
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round)).toBe(2)

    // 3. Handler de acerto mecânico acionado em objeto da geração anterior
    const newSetup = { frontWing: 10, rearWing: 10, suspension: 2, differential: 60 }
    const qualiUpdate = CanonicalQualifyingRunner.updateCarGarageSetup(
      qualiStateStale,
      'car1',
      newSetup,
    )
    expect(qualiUpdate.success).toBe(true)

    const saveQuali = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      qualiStateStale,
    )
    expect(saveQuali).toBe(false)
    expect(canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')).toBeNull()

    // Para treino livre
    const practiceUpdate = PracticeSessionRunner.updateCarGarageSetup(
      practiceStateStale,
      'car1',
      newSetup,
    )
    expect(practiceUpdate).toBe(true)

    await practiceSessionService.saveSessionState(practiceStateStale)
    expect(practiceSessionService.readFromLocalCache(careerId, seasonId, round, 'tp1')).toBeNull()
  })

  it('R5: pós-reset + tentativa espúria, reload reconhece apenas geração N+1', () => {
    // 1. Rodada resetada, avançando para geração 2
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round)).toBe(2)

    // 2. Se algo espúrio conseguisse escrever diretamente uma chave antiga no localStorage
    // (ex: simulação de script desatualizado com generation: 1)
    const rogueState = createMockQualiState('q1', 1)
    const qualiKey = canonicalQualifyingPersistenceService.getStageStateKey(seasonId, round, 'q1')
    localStorage.setItem(qualiKey, JSON.stringify(rogueState))

    // 3. O leitor canônico (reload) deve detectar a geração obsoleta e descartar o estado
    const reloaded = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
    expect(reloaded).toBeNull()

    // O mesmo para treino
    const roguePractice = createMockPracticeState(1)
    const tpKey = `apex_practice_session_${careerId}_${seasonId}_${round}_tp1`
    localStorage.setItem(tpKey, JSON.stringify(roguePractice))
    const reloadedPractice = practiceSessionService.readFromLocalCache(
      careerId,
      seasonId,
      round,
      'tp1',
    )
    expect(reloadedPractice).toBeNull()

    // 4. Mas um estado salvo com geração 2 é lido perfeitamente
    const gen2State = createMockQualiState('q1', 2)
    canonicalQualifyingPersistenceService.saveStageState(seasonId, round, gen2State)
    const validReloaded = canonicalQualifyingPersistenceService.readStageState(
      seasonId,
      round,
      'q1',
    )
    expect(validReloaded).not.toBeNull()
    expect(validReloaded?.generation).toBe(2)
  })

  it('R6: pneus/inventário da sessão descartada não reaparecem via objeto stale', () => {
    // 1. Sessão antiga tem pneu com desgaste acumulado
    const qualiStateStale = createMockQualiState('q1', 1)
    qualiStateStale.cars.car1.currentTyreSetId = 'tyre_used_99'
    qualiStateStale.cars.car1.tyreWear = 75

    // 2. Reset do fim de semana
    resetWeekendForRound({ careerId, seasonId, round })
    expect(getActiveWeekendGeneration(seasonId, round)).toBe(2)

    // 3. Tentativa de chamar fitTyreSetInGarage e persistir
    CanonicalQualifyingRunner.fitTyreSetInGarage(qualiStateStale, 'car1', {
      id: 'tyre_used_99',
      compound: 'macio',
      wear: 75,
    })
    const saved = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      qualiStateStale,
    )
    expect(saved).toBe(false)

    // Verifica que o estado persistido não existe e não contém esse pneu
    const read = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
    expect(read).toBeNull()
  })

  it('R7: regressão — fluxo normal sem reset continua salvando (com e sem generation prévio)', async () => {
    // 1. Estado sem generation explícito (legado/retrocompatibilidade)
    const legacyQuali = createMockQualiState('q1', undefined)
    const savedLegacy = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      legacyQuali,
    )
    expect(savedLegacy).toBe(true)

    // Foi salvo com a geração ativa atual (1)
    const readLegacy = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
    expect(readLegacy).not.toBeNull()
    expect(readLegacy?.generation).toBe(1)

    // 2. Treino sem generation explícito
    const legacyPractice = createMockPracticeState(undefined)
    await practiceSessionService.saveSessionState(legacyPractice)
    const readPractice = practiceSessionService.readFromLocalCache(careerId, seasonId, round, 'tp1')
    expect(readPractice).not.toBeNull()
    expect(readPractice?.generation).toBe(1)

    // 3. Atualizações subsequentes na mesma geração continuam funcionando perfeitamente
    readLegacy!.elapsedTimeSec += 60
    const updateResult = canonicalQualifyingPersistenceService.saveStageState(
      seasonId,
      round,
      readLegacy!,
    )
    expect(updateResult).toBe(true)

    const reRead = canonicalQualifyingPersistenceService.readStageState(seasonId, round, 'q1')
    expect(reRead?.elapsedTimeSec).toBe(180)
  })
})
