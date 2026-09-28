/**
 * src/test/race-quali-01b-ui-grid.test.tsx
 *
 * RACE-QUALI-01B-UI-GRID: Fechamento da Classificação Principal (Grid Oficial + Penalidades Persistidas)
 *
 * Bateria de Testes Canônicos Obrigatórios:
 * UI-GRID-01 — SEM PENALIDADES: STARTING_GRID persistido com 24 entries é renderizado na mesma ordem de QUALIFYING_RESULT.
 * UI-GRID-02 — COM PENALIDADE: fixture com qualifyingPosition != gridPosition; a tela mostra gridPosition correta, qualifyingPosition preservada e penalidade visível.
 * UI-GRID-03 — GRID COMPLETO: 24 entries, P1–P24, nenhum duplicado visual.
 * UI-GRID-04 — GRID_NOT_READY: antes de GRID_READY, não apresentar grid definitivo falso.
 * UI-GRID-05 — ZERO CÁLCULO: renderizar Grid Oficial não chama serviço de penalidade, RNG, pureRaceEngine, cálculo de posições, nem qualifying orchestrator para recalcular resultado.
 * UI-GRID-06 — RELOAD: estado reconstruído da persistência apresenta exatamente o mesmo grid.
 * UI-GRID-07 — POLE COM PENALIDADE: quando qualifyingPosition P1 sofre penalidade, Q3 continua representando P1 da classificação e Grid Oficial mostra a nova posição de largada; a UI não mistura os dois conceitos.
 */

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CanonicalQualifyingView } from '@/components/race/CanonicalQualifyingView'
import {
  raceQualifyingOrchestratorService,
  QualifyingPhaseExecutionState,
  GlobalQualifyingResultState,
  StartingGridState,
  StartingGridEntry,
} from '@/services/raceQualifyingOrchestratorService'

describe('RACE-QUALI-01B-UI-GRID — Grid Oficial e Penalidades Persistidas (UI-GRID-01..07)', () => {
  const careerId = 'career_ui_grid_test'
  const seasonId = '2026'
  const round = 1

  // Fixture geradora de resultados de classificação pura
  const createPhaseResults = (count: number, prefix: string) => {
    return Array.from({ length: count }, (_, i) => ({
      driverId: `drv_${prefix}_${i + 1}`,
      driverName: `Piloto ${prefix} ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Scuderia ${Math.floor(i / 2) + 1}`,
      carIndex: ((i % 2) + 1) as 1 | 2,
      setup: 92.0 + (i % 5),
      effectiveDriver: 85,
      trackRating: 88,
      basePaceMs: 80000,
      bonusMs: 0.2,
      bestTimeMs: 80000 + i * 120,
      formattedBestTime: `1:20.${String(i * 120).padStart(3, '0')}`,
      attempts: [],
      position: i + 1,
      isClassified: count === 24 ? i < 18 : count === 18 ? i < 10 : true,
      isEliminated: count === 24 ? i >= 18 : count === 18 ? i >= 10 : false,
    }))
  }

  const mockQ1Results24 = createPhaseResults(24, 'Q1')
  const mockQ2Results18 = createPhaseResults(18, 'Q2')
  const mockQ3Results10 = createPhaseResults(10, 'Q3')

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
    results: mockQ1Results24,
    classifiedDriverIds: mockQ1Results24.slice(0, 18).map((r) => r.driverId),
    eliminatedDriverIds: mockQ1Results24.slice(18).map((r) => r.driverId),
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
    results: mockQ2Results18,
    classifiedDriverIds: mockQ2Results18.slice(0, 10).map((r) => r.driverId),
    eliminatedDriverIds: mockQ2Results18.slice(10).map((r) => r.driverId),
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
    results: mockQ3Results10,
    classifiedDriverIds: mockQ3Results10.map((r) => r.driverId),
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
    poleDriverId: mockQ3Results10[0].driverId,
    poleDriverName: mockQ3Results10[0].driverName,
    poleTimeMs: mockQ3Results10[0].bestTimeMs,
    formattedPoleTime: mockQ3Results10[0].formattedBestTime,
    results: Array.from({ length: 24 }, (_, i) => ({
      position: i + 1,
      driverId: `drv_full_${i + 1}`,
      driverName: `Piloto Grid ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Scuderia ${Math.floor(i / 2) + 1}`,
      carIndex: ((i % 2) + 1) as 1 | 2,
      eliminationPhase: i < 10 ? 'Q3' : i < 18 ? 'Q2' : 'Q1',
      phaseBestTimeMs: 80000 + i * 100,
      formattedPhaseBestTime: `1:20.${String(i * 100).padStart(3, '0')}`,
      setup: 93.0,
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // STARTING_GRID sem penalidades: qualifyingPosition == gridPosition
  const mockStartingGridClean: StartingGridState = {
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

  // =========================================================================
  // UI-GRID-01 — SEM PENALIDADES
  // =========================================================================
  it('UI-GRID-01 — SEM PENALIDADES: STARTING_GRID persistido com 24 entries é renderizado na mesma ordem de QUALIFYING_RESULT', async () => {
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
      mockStartingGridClean,
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    // O status é GRID_READY, então abre na aba 'grid'
    await waitFor(() => {
      expect(
        screen.getByText('Grid de Largada Oficial do Grande Prêmio (P1 – P24)'),
      ).toBeInTheDocument()
    })

    const rows = screen.getAllByText(/Piloto Grid \d+/)
    expect(rows).toHaveLength(24)

    // Os pilotos aparecem em ordem P1..P24 correspondendo exatamente a QUALIFYING_RESULT
    mockGlobalQuali.results.forEach((qEntry, idx) => {
      expect(rows[idx]).toHaveTextContent(qEntry.driverName)
    })

    // Sem penalidade: não repete texto redundante de "+ posições"
    expect(screen.queryByText(/posições/)).toBeNull()
  })

  // =========================================================================
  // UI-GRID-02 — COM PENALIDADE
  // =========================================================================
  it('UI-GRID-02 — COM PENALIDADE: fixture com qualifyingPosition != gridPosition; tela mostra gridPosition correta, qualifyingPosition preservada e penalidade visível', async () => {
    // Piloto 3 classificou em P3, sofreu penalidade de 10 posições de PU (larga em P13)
    const gridWithPenalty: StartingGridEntry[] = mockStartingGridClean.grid.map((entry) => {
      if (entry.driverId === 'drv_full_3') {
        return {
          ...entry,
          gridPosition: 13,
          qualifyingPosition: 3,
          hasPenalty: true,
          totalPenaltyPositions: 10,
          penaltyReason: 'Troca de PU fora da quota (PU5)',
          penalties: [
            {
              id: 'pen_pu_3',
              positions: 10,
              reason: 'Troca de PU fora da quota (PU5)',
              source: 'PU_QUOTA_REGULATION',
            },
          ],
        }
      }
      return entry
    })

    const startingGridPenalized: StartingGridState = {
      ...mockStartingGridClean,
      grid: gridWithPenalty,
    }

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
      startingGridPenalized,
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(
        screen.getByText('Grid de Largada Oficial do Grande Prêmio (P1 – P24)'),
      ).toBeInTheDocument()
    })

    // qualifyingPosition e gridPosition claramente diferenciadas para o piloto penalizado
    expect(screen.getByText(/Classificou: P3 \/ Larga: P13/)).toBeInTheDocument()

    // Badge com posições perdidas e motivo regulamentar visível
    expect(screen.getByText(/\+10 posições/)).toBeInTheDocument()
    expect(screen.getByText('Troca de PU fora da quota (PU5)')).toBeInTheDocument()
  })

  // =========================================================================
  // UI-GRID-03 — GRID COMPLETO
  // =========================================================================
  it('UI-GRID-03 — GRID COMPLETO: 24 entries, P1–P24, nenhum duplicado visual', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockResolvedValue(null)
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(mockGlobalQuali)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(
      mockStartingGridClean,
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(
        screen.getByText('Grid de Largada Oficial do Grande Prêmio (P1 – P24)'),
      ).toBeInTheDocument()
    })

    const rows = screen.getAllByText(/Piloto Grid \d+/)
    expect(rows).toHaveLength(24)

    // Verifica que cada um dos 24 pilotos tem nome único renderizado
    const names = rows.map((r) => r.textContent)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(24)

    // Badge de contagem de carros bijetivo
    expect(screen.getByText('24 CARROS BIJETIVO')).toBeInTheDocument()
  })

  // =========================================================================
  // UI-GRID-04 — GRID_NOT_READY
  // =========================================================================
  it('UI-GRID-04 — GRID_NOT_READY: antes de GRID_READY, não apresentar grid definitivo falso', async () => {
    // Estado com status STARTING_GRID_READY ou null
    const notReadyGrid: StartingGridState = {
      ...mockStartingGridClean,
      status: 'STARTING_GRID_READY',
    }

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
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(
      notReadyGrid,
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText(/Q1_COMPLETE/)).toBeInTheDocument()
    })

    // A tab do Grid Oficial fica desabilitada e indicada como (Bloqueado)
    const gridTab = screen.getByRole('tab', { name: /Grid Oficial \(Bloqueado\)/ })
    expect(gridTab).toBeDisabled()

    // O grid definitivo P1–P24 não é renderizado como se fosse oficial
    expect(screen.queryByText('24 CARROS BIJETIVO')).toBeNull()
  })

  // =========================================================================
  // UI-GRID-05 — ZERO CÁLCULO
  // =========================================================================
  it('UI-GRID-05 — ZERO CÁLCULO: renderizar Grid Oficial não chama serviço de penalidade, RNG, nem qualifying orchestrator para recalcular', async () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')
    const spyBuildGrid = vi.spyOn(raceQualifyingOrchestratorService, 'buildStartingGrid')
    const spyBuildGlobal = vi.spyOn(
      raceQualifyingOrchestratorService,
      'buildGlobalQualifyingResult',
    )
    const spyExecuteQ1 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ1')
    const spyExecuteQ2 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ2')
    const spyExecuteQ3 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ3')

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockResolvedValue(null)
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(mockGlobalQuali)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(
      mockStartingGridClean,
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(
        screen.getByText('Grid de Largada Oficial do Grande Prêmio (P1 – P24)'),
      ).toBeInTheDocument()
    })

    expect(mathRandomSpy).not.toHaveBeenCalled()
    expect(spyBuildGrid).not.toHaveBeenCalled()
    expect(spyBuildGlobal).not.toHaveBeenCalled()
    expect(spyExecuteQ1).not.toHaveBeenCalled()
    expect(spyExecuteQ2).not.toHaveBeenCalled()
    expect(spyExecuteQ3).not.toHaveBeenCalled()
  })

  // =========================================================================
  // UI-GRID-06 — RELOAD
  // =========================================================================
  it('UI-GRID-06 — RELOAD: estado reconstruído da persistência apresenta exatamente o mesmo grid', async () => {
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
      mockStartingGridClean,
    )

    const { unmount } = render(
      <CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Piloto Grid 1')).toBeInTheDocument()
      expect(screen.getByText('Piloto Grid 24')).toBeInTheDocument()
    })

    unmount()

    // Segundo render (reload da página)
    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Piloto Grid 1')).toBeInTheDocument()
      expect(screen.getByText('Piloto Grid 24')).toBeInTheDocument()
    })

    const rows = screen.getAllByText(/Piloto Grid \d+/)
    expect(rows).toHaveLength(24)
  })

  // =========================================================================
  // UI-GRID-07 — POLE COM PENALIDADE
  // =========================================================================
  it('UI-GRID-07 — POLE COM PENALIDADE: quando qualifyingPosition P1 sofre penalidade, Q3 continua representando P1 da classificação e Grid Oficial mostra a nova posição de largada; UI não mistura os dois conceitos', async () => {
    // Piloto 1 (vencedor de Q3) sofreu penalidade de 10 posições.
    // Ele larga em P11; Piloto 2 herda a posição P1 de largada.
    const penalizedPoleGrid: StartingGridEntry[] = [
      // P1 largando é o Piloto 2 (que classificou P2)
      {
        gridPosition: 1,
        qualifyingPosition: 2,
        driverId: 'drv_full_2',
        driverName: 'Piloto Grid 2',
        teamId: 'team_1',
        teamName: 'Scuderia 1',
        carIndex: 2,
        eliminationPhase: 'Q3',
        qualifyingTimeMs: 80100,
        formattedQualifyingTime: '1:20.100',
        setup: 93.0,
        penalties: [],
        totalPenaltyPositions: 0,
        hasPenalty: false,
      },
      ...mockStartingGridClean.grid.slice(2, 11).map((item, idx) => ({
        ...item,
        gridPosition: idx + 2,
      })),
      // Piloto 1 larga em P11
      {
        gridPosition: 11,
        qualifyingPosition: 1,
        driverId: 'drv_full_1',
        driverName: 'Piloto Grid 1',
        teamId: 'team_1',
        teamName: 'Scuderia 1',
        carIndex: 1,
        eliminationPhase: 'Q3',
        qualifyingTimeMs: 80000,
        formattedQualifyingTime: '1:20.000',
        setup: 93.0,
        penalties: [
          {
            id: 'pen_pole',
            positions: 10,
            reason: 'Troca de PU fora da quota',
            source: 'PU_QUOTA_REGULATION',
          },
        ],
        totalPenaltyPositions: 10,
        hasPenalty: true,
        penaltyReason: 'Troca de PU fora da quota',
      },
      ...mockStartingGridClean.grid.slice(11),
    ]

    const startingGridStateWithPolePenalty: StartingGridState = {
      ...mockStartingGridClean,
      poleDriverId: 'drv_full_2', // Quem larga em P1
      poleDriverName: 'Piloto Grid 2',
      grid: penalizedPoleGrid,
    }

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
      startingGridStateWithPolePenalty,
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    // Na aba Grid Oficial: Piloto Grid 1 larga em P11, mas classificou em P1
    await waitFor(() => {
      expect(
        screen.getByText('Grid de Largada Oficial do Grande Prêmio (P1 – P24)'),
      ).toBeInTheDocument()
    })

    // Na aba Grid Oficial, Piloto 1 tem qualifyingPosition P1 e larga P11
    expect(screen.getByText(/Classificou: P1 \/ Larga: P11/)).toBeInTheDocument()
    expect(screen.getByText(/\+10 posições/)).toBeInTheDocument()

    // Agora navegamos até a aba Q3
    const q3Tab = screen.getByRole('tab', { name: /Q3/ })
    await userEvent.click(q3Tab)

    await waitFor(() => {
      expect(
        screen.getByText('Fase Q3 — Os 10 Finalistas (Disputa da Pole Position)'),
      ).toBeInTheDocument()
    })

    // Na aba Q3, o resultado esportivo puro da classificação é preservado intacto:
    // P1 da classificação continua com o badge Pole Position e Piloto Q3 1
    expect(screen.getByText('Pole Position')).toBeInTheDocument()
    expect(screen.getByText('Piloto Q3 1')).toBeInTheDocument()
    // A aba Q3 NÃO foi reescrita pela penalidade de grid
    expect(screen.queryByText(/Classificou: P1 \/ Larga: P11/)).toBeNull()
  })
})
