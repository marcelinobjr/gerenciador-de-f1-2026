/**
 * bug-q1-result-01b.test.ts
 *
 * Suíte BUG-Q1-RESULT-01B — Guard Robusto + Promoção do Slot 4:
 *
 * Q1-D — RETRY DO GUARD:
 *   Simular primeira tentativa onde readStageResult retorna ausente ou falha temporariamente.
 *   Confirmar:
 *   - stage não fica permanentemente marcado como handled;
 *   - nova tentativa ocorre;
 *   - quando o resultado fica disponível, o processamento acontece e aí sim o stage é marcado como handled.
 *
 * Q1-E — SEM DUPLICAÇÃO:
 *   Resultado já disponível; executar mais de um ciclo do efeito.
 *   Confirmar:
 *   - um único processamento efetivo;
 *   - sem toast/efeito duplicado;
 *   - sem completeSlot/syncSlot duplicado;
 *   - StageResult permanece íntegro e inalterado.
 *
 * Q1-F — SLOT DIVERGENTE:
 *   Q1 concluído e resultado persistido, mas currentSlot != 4 (ex: currentSlot = 1 ou 3 por resíduo).
 *   Confirmar:
 *   - slot 4 passa a COMPLETED e é registrado em completedSlots;
 *   - resultado não é recalculado;
 *   - slots não relacionados permanecem intactos (ex: Q2/slot 5 não é concluído cegamente).
 *
 * Q1-G — REGRESSÃO NORMAL:
 *   Q1 concluído com currentSlot == 4;
 *   Confirmar que o fluxo continua funcionando normalmente (slot 4 = COMPLETED, slot 5 = AVAILABLE, currentSlot = 5).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalWeekendSlotPersistenceService } from '@/services/canonicalWeekendSlotPersistenceService'
import {
  readStoredCompletedSessions,
  writeStoredCompletedSessions,
} from '@/services/weekendProgressionService'
import type { QualifyingStageResult } from '@/types/canonical-qualifying-types'
import type { CanonicalWeekendSlotState } from '@/types/weekend-slot-types'

describe('BUG-Q1-RESULT-01B — Guard Robusto + Promoção do Slot 4', () => {
  const TEST_SEASON_ID = 'season_q1_result_01b'
  const TEST_ROUND = 1
  const TEST_CAREER_ID = 'career_team_apex'

  function createValidQ1Result(seasonId: string, round: number): QualifyingStageResult {
    const entries = Array.from({ length: 24 }).map((_, i) => ({
      position: i + 1,
      driverId: `driver_${String(i + 1).padStart(2, '0')}`,
      driverName: `Piloto ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Equipe ${Math.floor(i / 2) + 1}`,
      teamColor: '#334155',
      bestLapSec: 78.0 + i * 0.1,
      bestLapTime: '1:18.000',
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
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  afterEach(() => {
    localStorage.clear()
    canonicalWeekendSlotPersistenceService.clearMemoryCache()
  })

  // -------------------------------------------------------------------------------------------------
  // Q1-D — RETRY DO GUARD:
  // -------------------------------------------------------------------------------------------------
  it('Q1-D: quando readStageResult está ausente/falha, o guard NÃO consome o stage, permitindo retry que tem sucesso quando o resultado fica disponível', () => {
    const completedStagesHandled = new Set<string>()
    const roundKey = `${TEST_SEASON_ID}_r${TEST_ROUND}_q1`

    let stageResultAvailable = false
    const onStageSuccess = vi.fn()

    // Simula a lógica do useEffect + handleQualifyingStageCompleted
    const runEffectCycle = (): boolean => {
      if (completedStagesHandled.has(roundKey)) {
        return false // já tratado com sucesso anteriormente
      }

      // Handler tenta consumir o resultado persistido
      const stageResult = stageResultAvailable
        ? canonicalQualifyingPersistenceService.readStageResult(TEST_SEASON_ID, TEST_ROUND, 'q1')
        : null

      const hasValidPersistedResult =
        !!stageResult && Array.isArray(stageResult.entries) && stageResult.entries.length > 0

      if (!hasValidPersistedResult) {
        // Falha: não marca como handled para permitir retry
        return false
      }

      onStageSuccess(stageResult)
      completedStagesHandled.add(roundKey)
      return true
    }

    // 1ª tentativa: resultado AINDA NÃO gravado no storage
    const firstAttempt = runEffectCycle()
    expect(firstAttempt).toBe(false)
    expect(completedStagesHandled.has(roundKey)).toBe(false) // NÃO pode ter sido consumido permanentemente
    expect(onStageSuccess).not.toHaveBeenCalled()

    // 2ª tentativa: resultado ainda ausente (ex: re-render intermediário)
    const secondAttempt = runEffectCycle()
    expect(secondAttempt).toBe(false)
    expect(completedStagesHandled.has(roundKey)).toBe(false)
    expect(onStageSuccess).not.toHaveBeenCalled()

    // Agora o runner finaliza e salva o StageResult canônico
    const validResult = createValidQ1Result(TEST_SEASON_ID, TEST_ROUND)
    canonicalQualifyingPersistenceService.saveStageResult(validResult)
    stageResultAvailable = true

    // 3ª tentativa (retry no próximo ciclo/render): resultado agora está disponível
    const thirdAttempt = runEffectCycle()
    expect(thirdAttempt).toBe(true)
    expect(completedStagesHandled.has(roundKey)).toBe(true) // Agora sim está marcado como handled
    expect(onStageSuccess).toHaveBeenCalledTimes(1)
    expect(onStageSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        stageId: 'q1',
        seasonId: TEST_SEASON_ID,
      }),
    )

    // 4ª tentativa subsequente: já handled, não roda novamente
    const fourthAttempt = runEffectCycle()
    expect(fourthAttempt).toBe(false)
    expect(onStageSuccess).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------------------------------
  // Q1-E — SEM DUPLICAÇÃO:
  // -------------------------------------------------------------------------------------------------
  it('Q1-E: resultado disponível; executar múltiplos ciclos do efeito não duplica efeitos nem altera o StageResult', () => {
    const validResult = createValidQ1Result(TEST_SEASON_ID, TEST_ROUND)
    canonicalQualifyingPersistenceService.saveStageResult(validResult)

    const completedStagesHandled = new Set<string>()
    const roundKey = `${TEST_SEASON_ID}_r${TEST_ROUND}_q1`

    const mockToast = vi.fn()
    const mockSyncSlot = vi.fn()

    const handleQualifyingStageCompletedSim = (stageId: 'q1'): boolean => {
      const stageResult = canonicalQualifyingPersistenceService.readStageResult(
        TEST_SEASON_ID,
        TEST_ROUND,
        stageId,
      )

      const hasValidPersistedResult =
        !!stageResult && Array.isArray(stageResult.entries) && stageResult.entries.length > 0

      if (!hasValidPersistedResult) return false

      const currentStored = readStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND)
      const isAlreadyStored = currentStored.includes(stageId)
      if (!isAlreadyStored) {
        writeStoredCompletedSessions(TEST_SEASON_ID, TEST_ROUND, [...currentStored, stageId])
        mockToast({ title: `Fase ${stageId.toUpperCase()} Concluída` })
      }

      mockSyncSlot(stageId)
      return true
    }

    const triggerEffect = () => {
      if (completedStagesHandled.has(roundKey)) {
        return
      }
      const success = handleQualifyingStageCompletedSim('q1')
      if (success) {
        completedStagesHandled.add(roundKey)
      }
    }

    // Ciclo 1
    triggerEffect()
    expect(completedStagesHandled.has(roundKey)).toBe(true)
    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockSyncSlot).toHaveBeenCalledTimes(1)

    // Ciclos 2, 3 e 4 (re-renders múltiplos comuns em React)
    triggerEffect()
    triggerEffect()
    triggerEffect()

    // Confirma que não duplicou
    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockSyncSlot).toHaveBeenCalledTimes(1)

    // Confirmar que o StageResult gravado permanece estritamente idêntico
    const persistedResultAfter = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(persistedResultAfter).toEqual(validResult)
  })

  // -------------------------------------------------------------------------------------------------
  // Q1-F — SLOT DIVERGENTE:
  // -------------------------------------------------------------------------------------------------
  it('Q1-F: quando Q1 é concluído com resultado persistido mas currentSlot != 4, slot 4 passa a COMPLETED e outros slots não relacionados ficam intactos', async () => {
    // 1. Criar estado inicial onde currentSlot está divergente (ex: currentSlot = 1 ou 3 por estado residual)
    const initialState = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: TEST_CAREER_ID,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      weekendFormat: 'NORMAL',
    })

    // Forçar divergência: currentSlot = 1 (TL1) mesmo que o Q1 esteja terminando
    expect(initialState.currentSlot).toBe(1)
    expect(initialState.slots[4].status).toBe('LOCKED')
    expect(initialState.slots[5].status).toBe('LOCKED')

    // 2. Persistir resultado válido do Q1
    const validResult = createValidQ1Result(TEST_SEASON_ID, TEST_ROUND)
    canonicalQualifyingPersistenceService.saveStageResult(validResult)

    // 3. Executar syncSlotCompleted(state, 4) conforme novo contrato de WeekendV2Page
    const updatedState = await canonicalWeekendSlotPersistenceService.syncSlotCompleted(
      initialState,
      4,
    )

    // 4. Confirmar que slot 4 passa a COMPLETED
    expect(updatedState.slots[4].status).toBe('COMPLETED')
    expect(updatedState.completedSlots).toContain(4)

    // 5. Confirmar que slots não relacionados NÃO foram afetados:
    // Slot 5 (Q2) NÃO é marcado como COMPLETED cegamente
    expect(updatedState.slots[5].status).not.toBe('COMPLETED')
    // Slot 6 (Q3) continua LOCKED
    expect(updatedState.slots[6].status).toBe('LOCKED')
    // Slot 7 (CORRIDA) continua LOCKED
    expect(updatedState.slots[7].status).toBe('LOCKED')

    // 6. Confirmar que o StageResult não foi recalculado ou corrompido
    const checkResult = canonicalQualifyingPersistenceService.readStageResult(
      TEST_SEASON_ID,
      TEST_ROUND,
      'q1',
    )
    expect(checkResult).toEqual(validResult)
  })

  // -------------------------------------------------------------------------------------------------
  // Q1-G — REGRESSÃO NORMAL:
  // -------------------------------------------------------------------------------------------------
  it('Q1-G: com currentSlot == 4 (fluxo normal), conclusão do Q1 avança para slot 5 (Q2) como AVAILABLE', async () => {
    // Criar estado onde os slots 1, 2 e 3 já foram concluídos normalmente e estamos no slot 4 (Q1)
    const state = canonicalWeekendSlotPersistenceService.createInitialState({
      careerId: TEST_CAREER_ID,
      seasonId: TEST_SEASON_ID,
      round: TEST_ROUND,
      weekendFormat: 'NORMAL',
    })

    const afterTL1 = await canonicalWeekendSlotPersistenceService.completeSlot(state, 1)
    const afterTL2 = await canonicalWeekendSlotPersistenceService.completeSlot(afterTL1, 2)
    const afterTL3 = await canonicalWeekendSlotPersistenceService.completeSlot(afterTL2, 3)

    expect(afterTL3.currentSlot).toBe(4)
    expect(afterTL3.slotType).toBe('Q1')
    expect(afterTL3.slots[4].status).toBe('AVAILABLE')

    // Persistir StageResult canônico de Q1
    const validResult = createValidQ1Result(TEST_SEASON_ID, TEST_ROUND)
    canonicalQualifyingPersistenceService.saveStageResult(validResult)

    // Sincronizar conclusão do Q1
    const afterQ1 = await canonicalWeekendSlotPersistenceService.syncSlotCompleted(afterTL3, 4)

    // Confirmar:
    // - slot 4 = COMPLETED
    expect(afterQ1.slots[4].status).toBe('COMPLETED')
    expect(afterQ1.completedSlots).toContain(4)
    // - currentSlot avançou para 5 (Q2)
    expect(afterQ1.currentSlot).toBe(5)
    expect(afterQ1.slotType).toBe('Q2')
    // - slot 5 = AVAILABLE
    expect(afterQ1.slots[5].status).toBe('AVAILABLE')
    // - slot 6 (Q3) permanece LOCKED
    expect(afterQ1.slots[6].status).toBe('LOCKED')
  })
})
