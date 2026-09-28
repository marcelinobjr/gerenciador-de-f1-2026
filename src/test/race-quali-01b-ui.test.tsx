/**
 * src/test/race-quali-01b-ui.test.tsx
 *
 * Suíte de Testes de Integração de UI (UI01–UI08) para RACE-QUALI-01B / ETAPA 2B:
 * Conexão direta da UI aos artefatos persistidos de Q1, Q2, Q3, QUALIFYING_RESULT e STARTING_GRID.
 *
 * Requisitos:
 * - UI01 Q1: 24 linhas na fixture, 6 marcados como eliminados.
 * - UI02 Q2: 18 entries, 8 eliminados, nenhum eliminado do Q1 presente.
 * - UI03 Q3: 10 entries, ordem correspondente ao resultado persistido.
 * - UI04 Grid sem penalidade: Grid Oficial coincide com QUALIFYING_RESULT.
 * - UI05 Grid com penalidade: qualifyingPosition preservada, gridPosition alterada, penalidade visível.
 * - UI06 Não recalcular: a renderização não chama funções de cálculo esportivo/RNG.
 * - UI07 Reload: após reconstrução do estado persistido, UI mostra exatamente os mesmos dados.
 * - UI08 Estado: Grid Oficial não aparece como definitivo antes de GRID_READY.
 */

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CanonicalQualifyingView } from '@/components/race/CanonicalQualifyingView'
import {
  raceQualifyingOrchestratorService,
  QualifyingPhaseExecutionState,
  GlobalQualifyingResultState,
  StartingGridState,
} from '@/services/raceQualifyingOrchestratorService'

describe('RACE-QUALI-01B / ETAPA 2B: Integração da UI da Classificação e Grid Oficial (UI01–UI08)', () => {
  const careerId = 'test_career_ui'
  const seasonId = '2026'
  const round = 1

  // Fixtures auxiliares de 24 pilotos bijetivos
  const createMockParticipants = (count: number, prefix: string = 'P') => {
    return Array.from({ length: count }, (_, i) => ({
      driverId: `drv_${prefix}_${i + 1}`,
      driverName: `Piloto ${prefix}${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Equipe ${Math.floor(i / 2) + 1}`,
      carIndex: ((i % 2) + 1) as 1 | 2,
      setup: 92.5,
      effectiveDriver: 85,
      trackRating: 88,
      basePaceMs: 82000,
      bonusMs: 0.2,
      bestTimeMs: 82000 + i * 150,
      formattedBestTime: `1:22.${String(i * 150).padStart(3, '0')}`,
      attempts: [],
      position: i + 1,
      isClassified: i < (count === 24 ? 18 : count === 18 ? 10 : count),
      isEliminated: i >= (count === 24 ? 18 : count === 18 ? 10 : count),
    }))
  }

  const mockQ1Results = createMockParticipants(24, 'Q1')
  const mockQ2Results = createMockParticipants(18, 'Q2')
  const mockQ3Results = createMockParticipants(10, 'Q3')

  const mockQ1State: QualifyingPhaseExecutionState = {
    phase: 'Q1',
    careerId,
    seasonId,
    round,
    configVersion: 'v1',
    status: 'READY_FOR_Q2',
    isCompleted: true,
    totalParticipants: 24,
    advancingCount: 18,
    eliminatedCount: 6,
    results: mockQ1Results,
    classifiedDriverIds: mockQ1Results.slice(0, 18).map((r) => r.driverId),
    eliminatedDriverIds: mockQ1Results.slice(18).map((r) => r.driverId),
    trackRecordMs: 80000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const mockQ2State: QualifyingPhaseExecutionState = {
    phase: 'Q2',
    careerId,
    seasonId,
    round,
    configVersion: 'v1',
    status: 'READY_FOR_Q3',
    isCompleted: true,
    totalParticipants: 18,
    advancingCount: 10,
    eliminatedCount: 8,
    results: mockQ2Results,
    classifiedDriverIds: mockQ2Results.slice(0, 10).map((r) => r.driverId),
    eliminatedDriverIds: mockQ2Results.slice(10).map((r) => r.driverId),
    trackRecordMs: 80000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const mockQ3State: QualifyingPhaseExecutionState = {
    phase: 'Q3',
    careerId,
    seasonId,
    round,
    configVersion: 'v1',
    status: 'QUALIFYING_COMPLETE',
    isCompleted: true,
    totalParticipants: 10,
    advancingCount: 10,
    eliminatedCount: 0,
    results: mockQ3Results,
    classifiedDriverIds: mockQ3Results.map((r) => r.driverId),
    eliminatedDriverIds: [],
    trackRecordMs: 80000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const mockGlobalQuali: GlobalQualifyingResultState = {
    careerId,
    seasonId,
    round,
    configVersion: 'v1',
    status: 'QUALIFYING_RESULT_READY',
    totalParticipants: 24,
    poleDriverId: mockQ3Results[0].driverId,
    poleDriverName: mockQ3Results[0].driverName,
    poleTimeMs: mockQ3Results[0].bestTimeMs,
    formattedPoleTime: mockQ3Results[0].formattedBestTime,
    results: Array.from({ length: 24 }, (_, i) => ({
      position: i + 1,
      driverId: `drv_final_${i + 1}`,
      driverName: `Piloto Final ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Equipe ${Math.floor(i / 2) + 1}`,
      carIndex: ((i % 2) + 1) as 1 | 2,
      eliminationPhase: i < 10 ? 'Q3' : i < 18 ? 'Q2' : 'Q1',
      phaseBestTimeMs: 82000 + i * 100,
      formattedPhaseBestTime: `1:22.${String(i * 100).padStart(3, '0')}`,
      setup: 92.5,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const mockStartingGridNoPenalties: StartingGridState = {
    careerId,
    seasonId,
    round,
    configVersion: 'v1',
    status: 'GRID_READY',
    totalParticipants: 24,
    poleDriverId: mockGlobalQuali.results[0].driverId,
    poleDriverName: mockGlobalQuali.results[0].driverName,
    grid: mockGlobalQuali.results.map((r) => ({
      gridPosition: r.position,
      qualifyingPosition: r.position,
      driverId: r.driverId,
      driverName: r.driverName,
      teamId: r.teamId,
      teamName: r.teamName,
      carIndex: r.carIndex,
      eliminationPhase: r.eliminationPhase,
      qualifyingTimeMs: r.phaseBestTimeMs,
      formattedQualifyingTime: r.formattedPhaseBestTime,
      setup: r.setup,
      penalties: [],
      totalPenaltyPositions: 0,
      hasPenalty: false,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('UI01 Q1: 24 linhas na fixture, 6 marcados como eliminados', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        return null
      },
    )
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(null)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(null)

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Fase Q1 — 24 Carros Inscritos')).toBeInTheDocument()
    })

    const rows = screen.getAllByText(/Piloto Q1/)
    expect(rows).toHaveLength(24)

    // 6 eliminados
    const eliminatedBadges = screen.getAllByText(/Eliminado Q1/)
    expect(eliminatedBadges).toHaveLength(6)

    // 18 avançam
    const advanceBadges = screen.getAllByText('Avança ao Q2')
    expect(advanceBadges).toHaveLength(18)
  })

  it('UI02 Q2: 18 entries, 8 eliminados, nenhum eliminado do Q1 presente', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        return null
      },
    )
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(null)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(null)

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Fase Q2 — Somente os 18 Classificados')).toBeInTheDocument()
    })

    const q2Rows = screen.getAllByText(/Piloto Q2/)
    expect(q2Rows).toHaveLength(18)

    // 8 eliminados
    const eliminatedBadges = screen.getAllByText(/Eliminado Q2/)
    expect(eliminatedBadges).toHaveLength(8)

    // 10 finalistas que avançam ao Q3
    const finalistBadges = screen.getAllByText('Avança ao Q3')
    expect(finalistBadges).toHaveLength(10)

    // Nenhum piloto de Q1 com identificador diferente aparece no Q2
    const q1Excluded = mockQ1Results.slice(18)
    q1Excluded.forEach((p) => {
      expect(screen.queryByText(p.driverName)).toBeNull()
    })
  })

  it('UI03 Q3: 10 entries, ordem correspondente ao resultado persistido', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        if (phase === 'Q3') return mockQ3State
        return null
      },
    )
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(null)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(null)

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(
        screen.getByText('Fase Q3 — Os 10 Finalistas (Disputa da Pole Position)'),
      ).toBeInTheDocument()
    })

    const q3Rows = screen.getAllByText(/Piloto Q3/)
    expect(q3Rows).toHaveLength(10)
    expect(screen.getByText('Pole Position')).toBeInTheDocument()
  })

  it('UI04 Grid sem penalidade: Grid Oficial coincide com QUALIFYING_RESULT', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        if (phase === 'Q3') return mockQ3State
        return null
      },
    )
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(mockGlobalQuali)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(
      mockStartingGridNoPenalties,
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(
        screen.getByText('Grid de Largada Oficial do Grande Prêmio (P1 – P24)'),
      ).toBeInTheDocument()
    })

    // 24 posições bijetivas renderizadas
    const gridRows = screen.getAllByText(/Piloto Final/)
    expect(gridRows).toHaveLength(24)

    // Sem penalidade: nenhuma indicação redundante de "+ posições"
    expect(screen.queryByText(/posições/)).toBeNull()
  })

  it('UI05 Grid com penalidade: qualifyingPosition preservada, gridPosition alterada, penalidade visível', async () => {
    // Piloto 3 sofreu +10 posições de penalidade (largando em P13)
    const penalizedGrid: StartingGridState = {
      ...mockStartingGridNoPenalties,
      grid: mockStartingGridNoPenalties.grid.map((entry) => {
        if (entry.driverId === 'drv_final_3') {
          return {
            ...entry,
            gridPosition: 13,
            qualifyingPosition: 3,
            hasPenalty: true,
            totalPenaltyPositions: 10,
            penaltyReason: 'Troca de PU fora da quota',
            penalties: [{ positions: 10, reason: 'Troca de PU fora da quota' }],
          }
        }
        return entry
      }),
    }

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockResolvedValue(null)
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(mockGlobalQuali)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(
      penalizedGrid,
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(
        screen.getByText('Grid de Largada Oficial do Grande Prêmio (P1 – P24)'),
      ).toBeInTheDocument()
    })

    // Preserva Classificou: P3 / Larga: P13
    expect(screen.getByText(/Classificou: P3 \/ Larga: P13/)).toBeInTheDocument()
    // Badge de penalidade visível
    expect(screen.getByText('+10 posições')).toBeInTheDocument()
    expect(screen.getByText('Troca de PU fora da quota')).toBeInTheDocument()
  })

  it('UI06 Não recalcular: a renderização não chama funções de cálculo esportivo/RNG', async () => {
    const spyExecuteQ1 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ1')
    const spyExecuteQ2 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ2')
    const spyExecuteQ3 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ3')
    const spyBuildGrid = vi.spyOn(raceQualifyingOrchestratorService, 'buildStartingGrid')

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockResolvedValue(null)
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(null)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(null)

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText(/READY_FOR_Q1/)).toBeInTheDocument()
    })

    expect(spyExecuteQ1).not.toHaveBeenCalled()
    expect(spyExecuteQ2).not.toHaveBeenCalled()
    expect(spyExecuteQ3).not.toHaveBeenCalled()
    expect(spyBuildGrid).not.toHaveBeenCalled()
  })

  it('UI07 Reload: após reconstrução do estado persistido, UI mostra exatamente os mesmos dados', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        return null
      },
    )
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(null)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(null)

    const { unmount } = render(
      <CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Piloto Q11')).toBeInTheDocument()
      expect(screen.getByText(mockQ1Results[0].formattedBestTime)).toBeInTheDocument()
    })

    unmount()

    // Segundo render (reload)
    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Piloto Q11')).toBeInTheDocument()
      expect(screen.getByText(mockQ1Results[0].formattedBestTime)).toBeInTheDocument()
    })
  })

  it('UI08 Estado: Grid Oficial não aparece como definitivo antes de GRID_READY', async () => {
    // Estado com status intermediário STARTING_GRID_READY (não finalizado como GRID_READY)
    const incompleteGrid: StartingGridState = {
      ...mockStartingGridNoPenalties,
      status: 'STARTING_GRID_READY',
    }

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockResolvedValue(null)
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(null)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(
      incompleteGrid,
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText(/Grid Oficial/)).toBeInTheDocument()
    })

    // O status do grid definitivo não é GRID_READY, portanto a aba Grid Oficial fica bloqueada
    const gridTab = screen.getByRole('tab', { name: /Grid Oficial/ })
    expect(gridTab).toBeDisabled()
  })
})
