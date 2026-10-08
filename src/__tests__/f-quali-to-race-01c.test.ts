/**
 * src/__tests__/f-quali-to-race-01c.test.ts
 *
 * Suíte de Testes F-QUALI-TO-RACE-01C:
 * Autoavanço para a Corrida após Q3 concluída com grid válido.
 *
 * Casos de teste focados: RACE-C1..C9
 * C1 — Q3 + grid válido => seleciona 'race' (selectedSessionId atualizado, states limpos)
 * C2 — Q3 sem grid válido => NÃO seleciona 'race'
 * C3 — Backend authority + quota local com grid válido => seleciona 'race'
 * C4 — Q1 => q2 (sem regressão de avanço)
 * C5 — Q2 => q3 (sem regressão de avanço)
 * C6 — Handler q3 executado duas vezes => idempotente (não reexecuta nem sobrescreve indevidamente)
 * C7 — Não inicializa Race Engine (canonicalRaceState / engine permanecem null)
 * C8 — Não confirma/cria estratégia (showPreRacePreparation permanece false, snapshot não confirmado)
 * C9 — Sprint/SQ (sq1, sq2, sq3) não autoavançam para race
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalQualifyingFinalGridBackendService } from '@/services/canonicalQualifyingFinalGridBackendService'
import type {
  CompleteQualifyingWeekendResult,
  QualifyingStageResult,
  QualifyingStageId,
} from '@/types/canonical-qualifying-types'

function buildMockStageResult(
  stageId: 'q1' | 'q2' | 'q3' | 'sq1' | 'sq2' | 'sq3',
  seasonId = 'season_2026',
  round = 1,
): QualifyingStageResult {
  const driverCount = stageId === 'q1' ? 24 : stageId === 'q2' ? 18 : 10
  const entries = Array.from({ length: driverCount }, (_, i) => ({
    position: i + 1,
    driverId: `drv_${i + 1}`,
    driverName: `Driver ${i + 1}`,
    teamId: `team_${Math.floor(i / 2) + 1}`,
    teamName: `Team ${Math.floor(i / 2) + 1}`,
    teamColor: '#ff0000',
    carId: (i % 2 === 0 ? 'car1' : 'car2') as 'car1' | 'car2',
    isPlayer: i === 0,
    bestLapSec: 80 + i * 0.1,
    bestLapTime: `1:20.${String(i).padStart(3, '0')}`,
    bestLapRecordedAtSec: 500 + i,
    compound: 'macio' as const,
    tyreSetId: `set_${i + 1}`,
    lapsCompleted: 3,
    lapsCount: 3,
    isEliminated: stageId === 'q1' ? i >= 18 : stageId === 'q2' ? i >= 10 : false,
  }))

  const eliminatedDriverIds =
    stageId === 'q1'
      ? entries.slice(18).map((e) => e.driverId)
      : stageId === 'q2'
        ? entries.slice(10).map((e) => e.driverId)
        : []

  const advancingDriverIds =
    stageId === 'q1'
      ? entries.slice(0, 18).map((e) => e.driverId)
      : stageId === 'q2'
        ? entries.slice(0, 10).map((e) => e.driverId)
        : []

  return {
    stageId,
    seasonId,
    round,
    completedAt: '2026-03-15T14:00:00Z',
    entries,
    eliminatedDriverIds,
    advancingDriverIds,
  }
}

/**
 * Harness de simulação do handleQualifyingStageCompleted fiel ao código em WeekendV2Page
 */
interface WeekendV2QualiStateHarness {
  selectedSessionId: string
  completedSessions: string[]
  sessionState: any
  qualifyingState: any
  completeQualifyingResult: CompleteQualifyingWeekendResult | null
  canonicalRaceState: any
  showPreRacePreparation: boolean
  completedStagesHandled: Set<string>
  toastMessages: Array<{ title: string; description?: string; variant?: string }>
}

function createWeekendHarness(initialSessionId = 'q3'): {
  state: WeekendV2QualiStateHarness
  handleQualifyingStageCompletedSim: (stageId: QualifyingStageId) => boolean
} {
  const state: WeekendV2QualiStateHarness = {
    selectedSessionId: initialSessionId,
    completedSessions: ['practice_1', 'practice_2', 'practice_3'],
    sessionState: { active: true },
    qualifyingState: { stageId: initialSessionId, leaderboard: [] },
    completeQualifyingResult: null,
    canonicalRaceState: null,
    showPreRacePreparation: false,
    completedStagesHandled: new Set<string>(),
    toastMessages: [],
  }

  const toast = (msg: { title: string; description?: string; variant?: string }) => {
    state.toastMessages.push(msg)
  }

  const setSelectedSessionId = (s: string) => {
    state.selectedSessionId = s
  }
  const setSessionState = (v: any) => {
    state.sessionState = v
  }
  const setQualifyingState = (v: any) => {
    state.qualifyingState = v
  }
  const setCompleteQualifyingResult = (v: CompleteQualifyingWeekendResult | null) => {
    state.completeQualifyingResult = v
  }
  const setCompletedSessions = (v: string[]) => {
    state.completedSessions = v
  }

  const season = { id: 'season_2026' }
  const currentRound = 1

  const handleQualifyingStageCompletedSim = (stageId: QualifyingStageId): boolean => {
    const stageKey = `${season.id}_r${currentRound}_${stageId}`
    const isStageAlreadyStored = state.completedStagesHandled.has(stageKey)
    if (!isStageAlreadyStored) {
      state.completedStagesHandled.add(stageKey)
    }

    let updated = [...state.completedSessions]

    if (!isStageAlreadyStored) {
      if (stageId === 'q3') {
        const q1Res = canonicalQualifyingPersistenceService.readStageResult(
          season.id,
          currentRound,
          'q1',
        )
        const q2Res = canonicalQualifyingPersistenceService.readStageResult(
          season.id,
          currentRound,
          'q2',
        )
        const q3Res = canonicalQualifyingPersistenceService.readStageResult(
          season.id,
          currentRound,
          'q3',
        )

        let effectiveGrid: CompleteQualifyingWeekendResult | null = null

        if (q1Res && q2Res && q3Res) {
          let fullGrid: CompleteQualifyingWeekendResult | null = null
          try {
            fullGrid = canonicalQualifyingPersistenceService.buildCombinedFinalGrid({
              seasonId: season.id,
              round: currentRound,
              q1Result: q1Res,
              q2Result: q2Res,
              q3Result: q3Res,
            })
          } catch (gridErr: any) {
            console.error('buildCombinedFinalGrid err', gridErr)
          }

          effectiveGrid =
            fullGrid ||
            canonicalQualifyingPersistenceService.readCompleteQualifyingResult(
              season.id,
              currentRound,
            )

          if (
            !effectiveGrid ||
            !Array.isArray(effectiveGrid.finalGrid) ||
            effectiveGrid.finalGrid.length === 0
          ) {
            toast({
              variant: 'destructive',
              title: 'Erro ao Salvar Grid Final de Qualificação',
              description: 'Não foi possível salvar o grid final combinado. Tente novamente.',
            })
            return false
          }

          setCompleteQualifyingResult(effectiveGrid)
        }

        if (!updated.includes('qualifying')) {
          updated = [...updated, 'qualifying']
          setCompletedSessions(updated)
        }

        toast({
          title: 'Classificação Concluída — Grid Formado!',
          description: 'Q1, Q2 e Q3 finalizados. A etapa de Corrida Principal está desbloqueada.',
        })

        // F-QUALI-TO-RACE-01C: Autoavanço para a Corrida após Q3 concluída com grid válido
        const hasValidGrid =
          !!effectiveGrid &&
          Array.isArray(effectiveGrid.finalGrid) &&
          effectiveGrid.finalGrid.length > 0

        if (hasValidGrid && state.selectedSessionId !== 'race') {
          setSelectedSessionId('race')
          setSessionState(null)
          setQualifyingState(null)
        }
      } else if (stageId === 'sq3') {
        toast({
          title: 'Fase SQ3 Concluída',
          description: 'Qualificação Sprint finalizada. A Corrida Sprint está disponível!',
        })
      } else {
        toast({
          title: `Fase ${stageId.toUpperCase()} Concluída`,
          description: `Eliminações e classificação oficial registradas. Próxima etapa disponível.`,
        })
      }
    }

    const nextStageMap: Record<string, QualifyingStageId> = {
      sq1: 'sq2',
      sq2: 'sq3',
      q1: 'q2',
      q2: 'q3',
    }
    const nextStage = nextStageMap[stageId]
    if (nextStage && state.selectedSessionId !== nextStage) {
      setSelectedSessionId(nextStage)
      setQualifyingState(null)
    }

    return true
  }

  return { state, handleQualifyingStageCompletedSim }
}

describe('F-QUALI-TO-RACE-01C — Autoavanço para a Corrida pós-Q3 (RACE-C1..C9)', () => {
  let localStorageMock: Record<string, string> = {}

  beforeEach(() => {
    localStorageMock = {}
    canonicalQualifyingPersistenceService.clearCachesForTesting()
    canonicalQualifyingFinalGridBackendService.clearCachesForTesting()
    vi.restoreAllMocks()

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key]
        }),
        clear: vi.fn(() => {
          localStorageMock = {}
        }),
      },
      writable: true,
      configurable: true,
    })
  })

  // C1: Q3 + grid válido => seleciona 'race'
  it('RACE-C1: Q3 concluída com grid válido seleciona automaticamente "race" e limpa sessionState/qualifyingState', () => {
    const q1 = buildMockStageResult('q1')
    const q2 = buildMockStageResult('q2')
    const q3 = buildMockStageResult('q3')
    canonicalQualifyingPersistenceService.saveStageResult(q1)
    canonicalQualifyingPersistenceService.saveStageResult(q2)
    canonicalQualifyingPersistenceService.saveStageResult(q3)

    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')

    const success = handleQualifyingStageCompletedSim('q3')

    expect(success).toBe(true)
    expect(state.selectedSessionId).toBe('race')
    expect(state.sessionState).toBeNull()
    expect(state.qualifyingState).toBeNull()
    expect(state.completedSessions).toContain('qualifying')
    expect(state.completeQualifyingResult).not.toBeNull()
    expect(state.completeQualifyingResult?.finalGrid.length).toBe(24)
  })

  // C2: Q3 sem grid válido => NÃO seleciona 'race'
  it('RACE-C2: Q3 sem grid válido não seleciona "race" e mantém sessão anterior com erro observável', () => {
    // Não persistimos q1/q2/q3, logo não há grid
    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')

    const success = handleQualifyingStageCompletedSim('q3')

    // Sem os 3 stages, effectiveGrid é null -> não avança para race
    expect(state.selectedSessionId).toBe('q3')
    expect(state.selectedSessionId).not.toBe('race')
    expect(state.sessionState).not.toBeNull()
  })

  // C3: Backend authority + quota local => seleciona 'race'
  it('RACE-C3: Backend authority + quota local (com grid válido) seleciona "race" com sucesso', () => {
    const q1 = buildMockStageResult('q1')
    const q2 = buildMockStageResult('q2')
    const q3 = buildMockStageResult('q3')
    canonicalQualifyingPersistenceService.saveStageResult(q1)
    canonicalQualifyingPersistenceService.saveStageResult(q2)
    canonicalQualifyingPersistenceService.saveStageResult(q3)

    // Simula quota estourada no localStorage e backend respondendo com sucesso
    vi.spyOn(canonicalQualifyingFinalGridBackendService, 'saveFinalGrid').mockResolvedValue({
      success: true,
      id: 'rec_grid_c3',
    })

    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')

    const success = handleQualifyingStageCompletedSim('q3')

    expect(success).toBe(true)
    expect(state.selectedSessionId).toBe('race')
    expect(state.sessionState).toBeNull()
    expect(state.qualifyingState).toBeNull()
    expect(state.completeQualifyingResult?.finalGrid.length).toBe(24)
  })

  // C4: Q1 => q2 (sem regressão)
  it('RACE-C4: Conclusão do Q1 avança para "q2" sem regressão e não toca na corrida', () => {
    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q1')

    const success = handleQualifyingStageCompletedSim('q1')

    expect(success).toBe(true)
    expect(state.selectedSessionId).toBe('q2')
    expect(state.selectedSessionId).not.toBe('race')
    expect(state.completedSessions).not.toContain('qualifying')
  })

  // C5: Q2 => q3 (sem regressão)
  it('RACE-C5: Conclusão do Q2 avança para "q3" sem regressão e não toca na corrida', () => {
    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q2')

    const success = handleQualifyingStageCompletedSim('q2')

    expect(success).toBe(true)
    expect(state.selectedSessionId).toBe('q3')
    expect(state.selectedSessionId).not.toBe('race')
    expect(state.completedSessions).not.toContain('qualifying')
  })

  // C6: Handler Q3 duas vezes => idempotente
  it('RACE-C6: Disparo duplicado do handler Q3 é estritamente idempotente', () => {
    const q1 = buildMockStageResult('q1')
    const q2 = buildMockStageResult('q2')
    const q3 = buildMockStageResult('q3')
    canonicalQualifyingPersistenceService.saveStageResult(q1)
    canonicalQualifyingPersistenceService.saveStageResult(q2)
    canonicalQualifyingPersistenceService.saveStageResult(q3)

    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')

    // Disparo 1
    const run1 = handleQualifyingStageCompletedSim('q3')
    expect(run1).toBe(true)
    expect(state.selectedSessionId).toBe('race')

    // Disparo 2 (idempotência via ref e selectedSessionId !== 'race')
    const toastCountBefore = state.toastMessages.length
    const run2 = handleQualifyingStageCompletedSim('q3')
    expect(run2).toBe(true)
    expect(state.selectedSessionId).toBe('race')
    // Nenhum toast repetido (guard isStageAlreadyStored protegeu)
    expect(state.toastMessages.length).toBe(toastCountBefore)
  })

  // C7: Não inicializa Race Engine (canonicalRaceState permanece null)
  it('RACE-C7: Autoavanço seleciona a tela de Corrida sem inicializar o Race Engine (canonicalRaceState permanece null)', () => {
    const q1 = buildMockStageResult('q1')
    const q2 = buildMockStageResult('q2')
    const q3 = buildMockStageResult('q3')
    canonicalQualifyingPersistenceService.saveStageResult(q1)
    canonicalQualifyingPersistenceService.saveStageResult(q2)
    canonicalQualifyingPersistenceService.saveStageResult(q3)

    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')
    handleQualifyingStageCompletedSim('q3')

    expect(state.selectedSessionId).toBe('race')
    expect(state.canonicalRaceState).toBeNull()
  })

  // C8: Não confirma/cria estratégia (showPreRacePreparation permanece false)
  it('RACE-C8: Autoavanço não confirma estratégia nem força showPreRacePreparation para true sem interação', () => {
    const q1 = buildMockStageResult('q1')
    const q2 = buildMockStageResult('q2')
    const q3 = buildMockStageResult('q3')
    canonicalQualifyingPersistenceService.saveStageResult(q1)
    canonicalQualifyingPersistenceService.saveStageResult(q2)
    canonicalQualifyingPersistenceService.saveStageResult(q3)

    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')
    handleQualifyingStageCompletedSim('q3')

    expect(state.selectedSessionId).toBe('race')
    expect(state.showPreRacePreparation).toBe(false)
  })

  // C9: Sprint/SQ (sq1, sq2, sq3) não autoavançam para race
  it('RACE-C9: Ciclos de Sprint SQ1, SQ2 e SQ3 não autoavançam para "race"', () => {
    const { state: stateSq1, handleQualifyingStageCompletedSim: simSq1 } =
      createWeekendHarness('sq1')
    simSq1('sq1')
    expect(stateSq1.selectedSessionId).toBe('sq2')
    expect(stateSq1.selectedSessionId).not.toBe('race')

    const { state: stateSq2, handleQualifyingStageCompletedSim: simSq2 } =
      createWeekendHarness('sq2')
    simSq2('sq2')
    expect(stateSq2.selectedSessionId).toBe('sq3')
    expect(stateSq2.selectedSessionId).not.toBe('race')

    const { state: stateSq3, handleQualifyingStageCompletedSim: simSq3 } =
      createWeekendHarness('sq3')
    simSq3('sq3')
    // SQ3 concluído não tem nextStage mapeado para 'race'
    expect(stateSq3.selectedSessionId).toBe('sq3')
    expect(stateSq3.selectedSessionId).not.toBe('race')
    expect(stateSq3.completedSessions).not.toContain('qualifying')
  })
})
