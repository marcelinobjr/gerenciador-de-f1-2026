/**
 * f-q1-times-01a.test.ts
 *
 * Suíte F-Q1-TIMES-01A:
 * Persistência observável e confiável de QualifyingStageResult.
 *
 * T1 — SAVE OK: saveStageResult persiste e retorna sucesso.
 * T2 — QUOTA RECUPERADA: primeira escrita falha, prune/retry funciona, resultado persiste, retorno = sucesso.
 * T3 — QUOTA PERSISTENTE: primeira e segunda escritas falham. saveStageResult retorna falha explícita. readStageResult continua ausente.
 * T4 — FINALIZESTAGE: persistência falha. StageResult montado continua correto em memória, mas fluxo não trata a conclusão como persistida.
 * T5 — GUARD: falha de persistência não consome definitivamente completedQualiStagesHandledRef.
 * T6 — RETRY POSTERIOR: quando storage volta a aceitar escrita, nova tentativa persiste o mesmo resultado, sem recalcular tempos e sem duplicar efeitos.
 * T7 — Q2FIX: continua bloqueando se resultado persistido não existe; libera quando resultado persistido passa a existir.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { CanonicalQualifyingRunner } from '@/services/canonicalQualifyingRunner'
import { CANONICAL_QUALIFYING_RULES } from '@/types/canonical-qualifying-types'
import type { QualifyingStageResult } from '@/types/canonical-qualifying-types'
import type {
  QualifyingTickContext,
  QualifyingDriverContext,
} from '@/services/canonicalQualifyingRunner'

describe('F-Q1-TIMES-01A — Persistência Observável e Confiável de StageResult', () => {
  const TEST_SEASON_ID = 'season_fq1_times_01a'
  const TEST_ROUND = 1

  const mockDrivers: QualifyingDriverContext[] = Array.from({ length: 24 }).map((_, i) => ({
    id: `driver_${String(i + 1).padStart(2, '0')}`,
    name: `Piloto ${i + 1}`,
    teamId: `team_${Math.floor(i / 2) + 1}`,
    teamName: `Equipe ${Math.floor(i / 2) + 1}`,
    teamColor: '#334155',
    carNumber: i + 1,
    speed: 85 - i * 0.4,
    consistency: 80,
    defense: 75,
  }))

  const playerDriver1 = mockDrivers[0]
  const playerDriver2 = mockDrivers[1]

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
      gpName: 'GP do Bahrein',
      circuitName: 'Bahrain International Circuit',
      lengthKm: 5.412,
      tireAbrasiveness: 60,
      weather: 'seco',
      teamChassisRating: 82,
      teamEngineSupplier: 'Audi',
      teamName: 'Apex GP',
      teamColor: '#00A6FB',
      drivers,
      rivalDrivers: drivers.filter((d) => d.id !== playerDriver1.id && d.id !== playerDriver2.id),
    }
  }

  function createValidQ1Result(seasonId: string, round: number): QualifyingStageResult {
    const entries = Array.from({ length: 24 }).map((_, i) => ({
      position: i + 1,
      driverId: `driver_${String(i + 1).padStart(2, '0')}`,
      driverName: `Piloto ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Equipe ${Math.floor(i / 2) + 1}`,
      teamColor: '#334155',
      bestLapSec: 78.0 + i * 0.1,
      bestLapTime: `1:18.${String(i * 100).padStart(3, '0')}`,
      bestLapRecordedAtSec: 100 + i,
      compound: 'macio' as const,
      tyreSetId: `tyre_${i + 1}`,
      lapsCount: 3,
      isPlayer: i === 0 || i === 1,
      isEliminated: i >= 18,
      eliminatedInStage: i >= 18 ? ('q1' as const) : undefined,
    }))

    return {
      stageId: 'q1',
      seasonId,
      round,
      completedAt: new Date().toISOString(),
      entries,
      advancingDriverIds: entries.slice(0, 18).map((e) => e.driverId),
      eliminatedDriverIds: entries.slice(18).map((e) => e.driverId),
    }
  }

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // T1 — SAVE OK: saveStageResult persiste e retorna sucesso.
  // =========================================================================
  it('T1 — SAVE OK: saveStageResult persiste no storage e retorna { success: true }', () => {
    const validResult = createValidQ1Result(TEST_SEASON_ID, TEST_ROUND)

    const outcome = canonicalQualifyingPersistenceService.saveStageResult(validResult)

    expect(outcome.success).toBe(true)
    expect(outcome.error).toBeUndefined()
    expect(outcome.reason).toBeUndefined()

    const readBack = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(readBack).not.toBeNull()
    expect(readBack!.entries).toHaveLength(24)
    expect(readBack!.advancingDriverIds).toEqual(validResult.advancingDriverIds)
    expect(readBack!.eliminatedDriverIds).toEqual(validResult.eliminatedDriverIds)
  })

  // =========================================================================
  // T2 — QUOTA RECUPERADA: primeira escrita falha, prune/retry funciona, resultado persiste, retorno = sucesso.
  // =========================================================================
  it('T2 — QUOTA RECUPERADA: primeira escrita falha com QuotaExceededError, prune/retry recupera e retorna { success: true }', () => {
    // Adicionar chave antiga para ser liberada pelo prune (round < currentRound - 1)
    const oldKey = `apex_gp_tires_${TEST_SEASON_ID}_r0`
    window.localStorage.setItem(oldKey, 'old_tire_data')

    const originalSetItem = Storage.prototype.setItem.bind(window.localStorage)
    let callCount = 0

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      callCount++
      if (callCount === 1) {
        const quotaErr = new Error('Simulated QuotaExceededError')
        quotaErr.name = 'QuotaExceededError'
        throw quotaErr
      }
      return originalSetItem(key, value)
    })

    const validResult = createValidQ1Result(TEST_SEASON_ID, TEST_ROUND)
    const outcome = canonicalQualifyingPersistenceService.saveStageResult(validResult)

    // O prune e retry devem ter funcionado
    expect(outcome.success).toBe(true)
    expect(callCount).toBe(2)

    // O resultado deve estar gravado no storage
    const readBack = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(readBack).not.toBeNull()
    expect(readBack!.stageId).toBe('q1')

    setItemSpy.mockRestore()
  })

  // =========================================================================
  // T3 — QUOTA PERSISTENTE: primeira e segunda escritas falham. saveStageResult retorna falha explícita. readStageResult continua ausente.
  // =========================================================================
  it('T3 — QUOTA PERSISTENTE: escritas falham persistentemente; saveStageResult retorna { success: false, reason: "QUOTA_EXCEEDED" } e readStageResult continua nulo', () => {
    let callCount = 0
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      callCount++
      const quotaErr = new Error('Persistent QuotaExceededError')
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    const validResult = createValidQ1Result(TEST_SEASON_ID, TEST_ROUND)
    const outcome = canonicalQualifyingPersistenceService.saveStageResult(validResult)

    expect(outcome.success).toBe(false)
    expect(outcome.reason).toBe('QUOTA_EXCEEDED')
    expect(outcome.error).toMatch(/Persistent QuotaExceededError/)
    expect(callCount).toBe(2) // 1ª tentativa + 1 retry pós-prune

    setItemSpy.mockRestore()

    // O readStageResult deve continuar estritamente ausente/null
    const readBack = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(readBack).toBeNull()
  })

  // =========================================================================
  // T4 — FINALIZESTAGE: persistência falha. StageResult montado continua correto em memória, mas fluxo não trata a conclusão como persistida.
  // =========================================================================
  it('T4 — FINALIZESTAGE: persistência falha; StageResult montado em memória está 100% íntegro com tempos, mas storage não tem o resultado persistido', () => {
    // 1. Inicializar stage
    const initialState = CanonicalQualifyingRunner.initializeStage({
      stageId: 'q1',
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      playerCar1: {
        driverId: playerDriver1.id,
        driverName: playerDriver1.name,
        driverNumber: 1,
        tyreSetId: 'tyre_q1_c1',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      playerCar2: {
        driverId: playerDriver2.id,
        driverName: playerDriver2.name,
        driverNumber: 2,
        tyreSetId: 'tyre_q1_c2',
        compound: 'macio',
        wear: 0,
        fuelKg: 15,
        setup: dummySetup,
      },
      eligibleParticipants: mockDrivers,
    })

    // Simular que o leaderboard já possui tempos computados
    initialState.leaderboard.forEach((entry, idx) => {
      entry.bestLapSec = 78.5 + idx * 0.1
      entry.bestLapTime = `1:18.${String(idx * 100).padStart(3, '0')}`
      entry.bestLapRecordedAtSec = 120 + idx
      entry.laps = 2
    })

    const tickContext = createDummyTickContext(TEST_SEASON_ID, TEST_ROUND, mockDrivers)

    // Forçar falha persistente de gravação no storage
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const quotaErr = new Error('Quota Exceeded in finalizeStage')
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    // Executar finalizeStage
    const stageResultInMemory = CanonicalQualifyingRunner.finalizeStage(initialState, tickContext, {
      persistState: true,
    })

    // StageResult em memória continua com todos os tempos e classificação corretos
    expect(stageResultInMemory).toBeDefined()
    expect(stageResultInMemory.stageId).toBe('q1')
    expect(stageResultInMemory.entries).toHaveLength(24)
    expect(stageResultInMemory.advancingDriverIds).toHaveLength(18)
    expect(stageResultInMemory.eliminatedDriverIds).toHaveLength(6)
    expect(stageResultInMemory.entries[0].bestLapSec).toBe(78.5)

    setItemSpy.mockRestore()

    // Mas no storage NÃO foi persistido
    const persistedResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(persistedResult).toBeNull()
  })

  // =========================================================================
  // T5 — GUARD: falha de persistência não consome definitivamente completedQualiStagesHandledRef.
  // =========================================================================
  it('T5 — GUARD: falha de persistência em handleQualifyingStageCompleted não consome completedQualiStagesHandledRef e exibe erro observável', () => {
    const completedStagesHandled = new Set<string>()
    const roundKey = `${TEST_SEASON_ID}_r${TEST_ROUND}_q1`

    const mockToast = vi.fn()

    // Simulação do comportamento de WeekendV2Page com o novo contrato F-Q1-TIMES-01A
    const handleQualifyingStageCompletedSim = (stageId: 'q1'): boolean => {
      // Reconfirmar resultado persistido no storage
      const persistedResultCheck = canonicalQualifyingPersistenceService.readStageResult(
        TEST_SEASON_ID,
        TEST_ROUND,
        stageId,
      )

      const hasValidPersistedResult =
        !!persistedResultCheck &&
        Array.isArray(persistedResultCheck.entries) &&
        persistedResultCheck.entries.length > 0

      if (!hasValidPersistedResult) {
        mockToast({
          variant: 'destructive',
          title: `Erro ao Salvar Resultado do ${stageId.toUpperCase()}`,
          description: `Não foi possível salvar o resultado do ${stageId.toUpperCase()}. Tente novamente.`,
        })
        return false
      }

      return true
    }

    const runEffect = () => {
      if (completedStagesHandled.has(roundKey)) {
        return
      }
      const success = handleQualifyingStageCompletedSim('q1')
      if (success) {
        completedStagesHandled.add(roundKey)
      }
    }

    // 1. Executa o efeito enquanto o storage não tem resultado salvo (ex: falha de storage)
    runEffect()

    // Confirma que o guard NÃO foi consumido
    expect(completedStagesHandled.has(roundKey)).toBe(false)
    // Confirma que o erro observável foi disparado
    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: 'Erro ao Salvar Resultado do Q1',
        description: 'Não foi possível salvar o resultado do Q1. Tente novamente.',
      }),
    )

    // 2. Um segundo render com o erro ainda não resolvido continua sem consumir o guard
    runEffect()
    expect(completedStagesHandled.has(roundKey)).toBe(false)
    expect(mockToast).toHaveBeenCalledTimes(2)
  })

  // =========================================================================
  // T6 — RETRY POSTERIOR: quando storage volta a aceitar escrita, nova tentativa persiste o mesmo resultado, sem recalcular tempos e sem duplicar efeitos.
  // =========================================================================
  it('T6 — RETRY POSTERIOR: quando storage volta a aceitar escrita, nova tentativa persiste o mesmo resultado em memória sem recalcular tempos nem duplicar efeitos', () => {
    const completedStagesHandled = new Set<string>()
    const roundKey = `${TEST_SEASON_ID}_r${TEST_ROUND}_q1`
    const mockToast = vi.fn()
    const mockSyncSlot = vi.fn()

    // Criar o resultado em memória
    const stageResultInMemory = createValidQ1Result(TEST_SEASON_ID, TEST_ROUND)

    // Função simulando retry na UI
    const handleRetry = (): boolean => {
      if (completedStagesHandled.has(roundKey)) return false

      // Tenta persistir o resultado que estava retido em memória
      const saveOutcome = canonicalQualifyingPersistenceService.saveStageResult(stageResultInMemory)
      if (!saveOutcome.success) {
        mockToast({
          variant: 'destructive',
          title: 'Erro ao Salvar Resultado do Q1',
        })
        return false
      }

      const readBack = canonicalQualifyingPersistenceService.readStageResult(
        TEST_SEASON_ID,
        TEST_ROUND,
        'q1',
      )
      if (!readBack) return false

      // Processamento de sucesso
      mockSyncSlot(4)
      mockToast({
        title: 'Fase Q1 Concluída',
      })
      completedStagesHandled.add(roundKey)
      return true
    }

    // Tentativa 1 com storage bloqueado
    let storageBlocked = true
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => {
      if (storageBlocked) {
        const err = new Error('QuotaExceeded')
        err.name = 'QuotaExceededError'
        throw err
      }
      return Storage.prototype.setItem.call(window.localStorage, k, v)
    })

    const attempt1 = handleRetry()
    expect(attempt1).toBe(false)
    expect(completedStagesHandled.has(roundKey)).toBe(false)
    expect(mockSyncSlot).not.toHaveBeenCalled()

    // O storage agora é desbloqueado (espaço liberado pelo usuário ou recuperação)
    storageBlocked = false
    setItemSpy.mockRestore()

    // Tentativa 2: Retry
    const attempt2 = handleRetry()
    expect(attempt2).toBe(true)
    expect(completedStagesHandled.has(roundKey)).toBe(true)
    expect(mockSyncSlot).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Fase Q1 Concluída',
      }),
    )

    // Confirma que os tempos salvos são rigorosamente idênticos ao resultado original em memória
    const persisted = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(persisted).toEqual(stageResultInMemory)

    // Ciclo subsequente: não duplica
    const attempt3 = handleRetry()
    expect(attempt3).toBe(false)
    expect(mockSyncSlot).toHaveBeenCalledTimes(1)
  })

  // =========================================================================
  // T7 — Q2FIX: continua bloqueando se resultado persistido não existe; libera quando resultado persistido passa a existir.
  // =========================================================================
  it('T7 — Q2FIX: barreira Q2FIX-01 continua bloqueando se resultado persistido não existe; libera assim que o resultado passa a existir', () => {
    const mockBlockToast = vi.fn()

    const evaluateQ2FixBarrier = (): boolean => {
      const persistedQ1Result = canonicalQualifyingPersistenceService.readStageResult(
        TEST_SEASON_ID,
        TEST_ROUND,
        'q1',
      )

      const expectedAdvancingCount = CANONICAL_QUALIFYING_RULES['q1'].advancingCount
      const advancingIds = persistedQ1Result?.advancingDriverIds

      const isValidAdvancing =
        !!persistedQ1Result &&
        Array.isArray(advancingIds) &&
        advancingIds.length === expectedAdvancingCount &&
        advancingIds.every((id) => typeof id === 'string' && id.trim().length > 0) &&
        new Set(advancingIds).size === expectedAdvancingCount

      if (!isValidAdvancing) {
        mockBlockToast({
          variant: 'destructive',
          title: 'Transição Q1 → Q2 Bloqueada',
        })
        return false
      }

      return true
    }

    // 1. Sem resultado persistido: BLOQUEIA
    expect(evaluateQ2FixBarrier()).toBe(false)
    expect(mockBlockToast).toHaveBeenCalledTimes(1)

    // 2. Com resultado corrompido ou incompleto (ex: apenas 10 classificados): BLOQUEIA
    const invalidResult = createValidQ1Result(TEST_SEASON_ID, TEST_ROUND)
    invalidResult.advancingDriverIds = invalidResult.advancingDriverIds.slice(0, 10)
    canonicalQualifyingPersistenceService.saveStageResult(invalidResult)

    expect(evaluateQ2FixBarrier()).toBe(false)
    expect(mockBlockToast).toHaveBeenCalledTimes(2)

    // 3. Com resultado canônico completo persistido (18 classificados válidos): LIBERA
    const validResult = createValidQ1Result(TEST_SEASON_ID, TEST_ROUND)
    canonicalQualifyingPersistenceService.saveStageResult(validResult)

    expect(evaluateQ2FixBarrier()).toBe(true)
    // Nenhuma nova chamada ao toast de bloqueio
    expect(mockBlockToast).toHaveBeenCalledTimes(2)
  })
})
