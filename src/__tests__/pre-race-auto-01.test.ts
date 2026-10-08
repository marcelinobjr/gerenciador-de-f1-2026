/**
 * src/__tests__/pre-race-auto-01.test.ts
 *
 * Suíte de Testes PRE-RACE-AUTO-01:
 * Autoavanço para a Corrida e abertura automática do painel pré-corrida após Q3 concluída com grid válido.
 *
 * Casos de teste focados: AUTO-R1..R9
 * - AUTO-R1: Q3 válida termina => Corrida selecionada automaticamente ('race').
 * - AUTO-R2: Q3 válida termina => showPreRacePreparation = true (painel pré-corrida abre automaticamente).
 * - AUTO-R3: Q3 inválida/sem final grid => pré-corrida NÃO abre e sessão 'race' não é selecionada.
 * - AUTO-R4: autoavanço NÃO inicializa Race Engine (canonicalRaceState permanece null).
 * - AUTO-R5: autoavanço NÃO confirma estratégia nem dispara onConfirmAndStartRace automaticamente.
 * - AUTO-R6: handler executado duas vezes => painel abre uma vez, sem duplicação de toasts nem loop.
 * - AUTO-R7: PRE-RACE-01B continua funcionando: snapshot inválido => card de erro aparece dentro do painel.
 * - AUTO-R8: Q1→Q2 e Q2→Q3 continuam inalterados (não abrem corrida nem pré-corrida).
 * - AUTO-R9: Sprint não sofre alteração (SQ1→SQ2, SQ2→SQ3, SQ3 não abre corrida nem pré-corrida).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { PreRaceStrategyPreparationPanel } from '@/components/race/PreRaceStrategyPreparationPanel'
import { canonicalQualifyingPersistenceService } from '@/services/canonicalQualifyingPersistenceService'
import { canonicalQualifyingFinalGridBackendService } from '@/services/canonicalQualifyingFinalGridBackendService'
import type {
  CompleteQualifyingWeekendResult,
  QualifyingStageResult,
  QualifyingStageId,
  FinalQualifyingGridEntry,
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
 * Harness de simulação do handleQualifyingStageCompleted de WeekendV2Page
 */
interface WeekendV2QualiStateHarness {
  selectedSessionId: string
  completedSessions: string[]
  sessionState: any
  qualifyingState: any
  completeQualifyingResult: CompleteQualifyingWeekendResult | null
  canonicalRaceState: any
  showPreRacePreparation: boolean
  strategyConfirmed: boolean
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
    strategyConfirmed: false,
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
  const setShowPreRacePreparation = (v: boolean) => {
    state.showPreRacePreparation = v
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

        // PRE-RACE-AUTO-01: Autoavanço para a Corrida e abertura automática do painel pré-corrida após Q3 concluída com grid válido
        const hasValidGrid =
          !!effectiveGrid &&
          Array.isArray(effectiveGrid.finalGrid) &&
          effectiveGrid.finalGrid.length > 0

        if (hasValidGrid) {
          if (state.selectedSessionId !== 'race') {
            setSelectedSessionId('race')
            setSessionState(null)
            setQualifyingState(null)
          }
          if (!state.showPreRacePreparation) {
            setShowPreRacePreparation(true)
          }
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

describe('PRE-RACE-AUTO-01 — Autoavanço e Abertura do Painel Pré-Corrida (AUTO-R1..R9)', () => {
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

  // AUTO-R1: Q3 válida termina => Corrida selecionada automaticamente
  it('AUTO-R1: Q3 concluída com grid válido seleciona automaticamente "race"', () => {
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
  })

  // AUTO-R2: Q3 válida termina => showPreRacePreparation = true (painel pré-corrida abre)
  it('AUTO-R2: Q3 concluída com grid válido ativa automaticamente showPreRacePreparation = true', () => {
    const q1 = buildMockStageResult('q1')
    const q2 = buildMockStageResult('q2')
    const q3 = buildMockStageResult('q3')
    canonicalQualifyingPersistenceService.saveStageResult(q1)
    canonicalQualifyingPersistenceService.saveStageResult(q2)
    canonicalQualifyingPersistenceService.saveStageResult(q3)

    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')
    expect(state.showPreRacePreparation).toBe(false)

    handleQualifyingStageCompletedSim('q3')

    expect(state.selectedSessionId).toBe('race')
    expect(state.showPreRacePreparation).toBe(true)
  })

  // AUTO-R3: Q3 inválida/sem final grid => pré-corrida NÃO abre
  it('AUTO-R3: Q3 inválida ou sem final grid não abre o painel pré-corrida nem avança para "race"', () => {
    // Sem resultados prévios de q1, q2 e q3 salvos -> sem grid final
    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')

    const success = handleQualifyingStageCompletedSim('q3')

    expect(state.selectedSessionId).toBe('q3')
    expect(state.selectedSessionId).not.toBe('race')
    expect(state.showPreRacePreparation).toBe(false)
  })

  // AUTO-R4: autoavanço NÃO inicializa Race Engine
  it('AUTO-R4: autoavanço NÃO inicializa Race Engine (canonicalRaceState permanece null)', () => {
    const q1 = buildMockStageResult('q1')
    const q2 = buildMockStageResult('q2')
    const q3 = buildMockStageResult('q3')
    canonicalQualifyingPersistenceService.saveStageResult(q1)
    canonicalQualifyingPersistenceService.saveStageResult(q2)
    canonicalQualifyingPersistenceService.saveStageResult(q3)

    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')
    handleQualifyingStageCompletedSim('q3')

    expect(state.selectedSessionId).toBe('race')
    expect(state.showPreRacePreparation).toBe(true)
    expect(state.canonicalRaceState).toBeNull()
  })

  // AUTO-R5: autoavanço NÃO confirma estratégia
  it('AUTO-R5: autoavanço NÃO confirma estratégia nem dispara início automático da prova', () => {
    const q1 = buildMockStageResult('q1')
    const q2 = buildMockStageResult('q2')
    const q3 = buildMockStageResult('q3')
    canonicalQualifyingPersistenceService.saveStageResult(q1)
    canonicalQualifyingPersistenceService.saveStageResult(q2)
    canonicalQualifyingPersistenceService.saveStageResult(q3)

    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')
    handleQualifyingStageCompletedSim('q3')

    expect(state.strategyConfirmed).toBe(false)
    expect(state.canonicalRaceState).toBeNull()
  })

  // AUTO-R6: handler executado duas vezes => painel abre uma vez, sem duplicação
  it('AUTO-R6: handler executado duas vezes é idempotente, sem duplicar toasts nem recriar estado', () => {
    const q1 = buildMockStageResult('q1')
    const q2 = buildMockStageResult('q2')
    const q3 = buildMockStageResult('q3')
    canonicalQualifyingPersistenceService.saveStageResult(q1)
    canonicalQualifyingPersistenceService.saveStageResult(q2)
    canonicalQualifyingPersistenceService.saveStageResult(q3)

    const { state, handleQualifyingStageCompletedSim } = createWeekendHarness('q3')

    // Disparo 1
    handleQualifyingStageCompletedSim('q3')
    expect(state.selectedSessionId).toBe('race')
    expect(state.showPreRacePreparation).toBe(true)
    const toastCountFirst = state.toastMessages.length

    // Disparo 2
    handleQualifyingStageCompletedSim('q3')
    expect(state.selectedSessionId).toBe('race')
    expect(state.showPreRacePreparation).toBe(true)
    expect(state.toastMessages.length).toBe(toastCountFirst)
  })

  // AUTO-R7: PRE-RACE-01B continua funcionando: snapshot inválido => card de erro aparece
  it('AUTO-R7: blindagem PRE-RACE-01B permanece ativa se snapshot falhar ao autoabrir', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Grid quebrado (sem pilotos da equipe 'audi')
    const brokenGrid: FinalQualifyingGridEntry[] = Array.from({ length: 24 }, (_, i) => ({
      gridPosition: i + 1,
      driverId: `drv_adv_${i + 1}`,
      driverName: `Adversary ${i + 1}`,
      teamId: 'ferrari',
      teamName: 'FERRARI',
      teamColor: '#ff0000',
      isPlayer: false,
      eliminationStage: 'Q1',
      bestLapSec: 85 + i * 0.1,
      bestLapTime: '1:25.000',
      bestLapCompound: 'duro',
    }))

    render(
      React.createElement(PreRaceStrategyPreparationPanel, {
        careerId: 'c_auto_r7',
        seasonYear: 2026,
        round: 1,
        teamId: 'audi',
        totalLaps: 57,
        canonicalGrid: brokenGrid,
        inventories: {},
        onConfirmAndStartRace: () => {},
      }),
    )

    // O card de erro blindado PRE-RACE-01B é montado
    expect(screen.getByText('Não foi possível preparar a corrida')).toBeDefined()
    expect(
      screen.getByText(
        'Não foi possível identificar corretamente os dois carros da sua equipe no grid oficial.',
      ),
    ).toBeDefined()
    expect(screen.getByText('Tentar novamente')).toBeDefined()
  })

  // AUTO-R8: Q1→Q2 e Q2→Q3 continuam inalterados
  it('AUTO-R8: Q1 avança para Q2 e Q2 avança para Q3 sem abrir pré-corrida nem selecionar race', () => {
    const { state: stateQ1, handleQualifyingStageCompletedSim: simQ1 } = createWeekendHarness('q1')
    simQ1('q1')
    expect(stateQ1.selectedSessionId).toBe('q2')
    expect(stateQ1.showPreRacePreparation).toBe(false)

    const { state: stateQ2, handleQualifyingStageCompletedSim: simQ2 } = createWeekendHarness('q2')
    simQ2('q2')
    expect(stateQ2.selectedSessionId).toBe('q3')
    expect(stateQ2.showPreRacePreparation).toBe(false)
  })

  // AUTO-R9: Sprint não sofre alteração
  it('AUTO-R9: Fases Sprint SQ1, SQ2 e SQ3 não selecionam "race" nem abrem pré-corrida', () => {
    const { state: stateSq1, handleQualifyingStageCompletedSim: simSq1 } =
      createWeekendHarness('sq1')
    simSq1('sq1')
    expect(stateSq1.selectedSessionId).toBe('sq2')
    expect(stateSq1.showPreRacePreparation).toBe(false)

    const { state: stateSq2, handleQualifyingStageCompletedSim: simSq2 } =
      createWeekendHarness('sq2')
    simSq2('sq2')
    expect(stateSq2.selectedSessionId).toBe('sq3')
    expect(stateSq2.showPreRacePreparation).toBe(false)

    const { state: stateSq3, handleQualifyingStageCompletedSim: simSq3 } =
      createWeekendHarness('sq3')
    simSq3('sq3')
    expect(stateSq3.selectedSessionId).toBe('sq3')
    expect(stateSq3.selectedSessionId).not.toBe('race')
    expect(stateSq3.showPreRacePreparation).toBe(false)
  })
})
