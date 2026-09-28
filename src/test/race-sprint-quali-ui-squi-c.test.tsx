/**
 * src/test/race-sprint-quali-ui-squi-c.test.tsx
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01B3C-UI
 * GRID SPRINT: CONSUMIR SPRINT_STARTING_GRID PERSISTIDO
 *
 * SUÍTE DE TESTES OBRIGATÓRIOS SQUI-C01 A SQUI-C12:
 * - SQUI-C01 — FONTE: Grid Sprint lê exclusivamente SPRINT_STARTING_GRID.
 * - SQUI-C02 — PARTICIPANTES: 24 participantes renderizados.
 * - SQUI-C03 — POSIÇÕES: P1–P24 contínuos, sem duplicação visual.
 * - SQUI-C04 — ISOLAMENTO: Grid Sprint não lê STARTING_GRID principal; Grid Oficial do GP não lê SPRINT_STARTING_GRID.
 * - SQUI-C05 — ZERO CÁLCULO: render não chama RNG, pureRaceEngine, qualifying orchestrator, cálculo de grid ou cálculo de penalidades.
 * - SQUI-C06 — NOT READY: sem SPRINT_STARTING_GRID, mostrar estado "ainda não definido" ou equivalente; não usar fallback silencioso.
 * - SQUI-C07 — SEM PENALIDADE INVENTADA: na versão atual, nenhuma badge de penalidade pré-Sprint aparece.
 * - SQUI-C08 — RELOAD: persistência reconstruída produz exatamente o mesmo Grid Sprint.
 * - SQUI-C09 — SLOT: visualizar Grid Sprint não altera currentSlot, slotStatus, subPhase.
 * - SQUI-C10 — NORMAL: weekend NORMAL não exibe Grid Sprint.
 * - SQUI-C11 — GRID DO GP INTACTO: Grid Oficial principal continua consumindo STARTING_GRID.
 * - SQUI-C12 — TROCA DE VISÃO: SQ1 <-> SQ2 <-> SQ3 <-> Grid Sprint não recalcula nem altera qualquer artefato esportivo.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CanonicalQualifyingView } from '@/components/race/CanonicalQualifyingView'
import { SprintStartingGridSummary } from '@/components/race/SprintStartingGridSummary'
import { SprintQualifyingPhaseTabs } from '@/components/race/SprintQualifyingPhaseTabs'
import {
  raceQualifyingOrchestratorService,
  type QualifyingPhaseExecutionState,
  type SprintQualifyingResultState,
  type SprintStartingGridState,
  type StartingGridState,
} from '@/services/raceQualifyingOrchestratorService'
import { getWeekendSlotSequence, resolveWeekendFormat } from '@/services/weekendSlotSequenceService'

// Helper para mock de 24 pilotos em SPRINT_STARTING_GRID
function createMockSprintStartingGrid(count = 24): SprintStartingGridState {
  const grid = Array.from({ length: count }, (_, idx) => {
    const pos = idx + 1
    const elimPhase: 'SQ1' | 'SQ2' | 'SQ3' = pos <= 10 ? 'SQ3' : pos <= 18 ? 'SQ2' : 'SQ1'
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      gridPosition: pos,
      driverId: `drv_sprint_${pos}`,
      driverName: `Sprint Pilot ${pos}`,
      teamId: `team_${Math.floor(idx / 2) + 1}`,
      teamName: `Sprint Team ${Math.floor(idx / 2) + 1}`,
      carIndex,
      qualifyingPosition: pos,
      eliminationPhase: elimPhase,
      qualifyingTimeMs: 78000 + idx * 60,
      bestAttemptMs: 78000 + idx * 60,
      formattedQualifyingTime: `1:18.${String(idx * 60).padStart(3, '0')}`,
      setup: 35 + idx,
      penalties: [],
      totalPenaltyPositions: 0,
      hasPenalty: false,
    }
  })

  return {
    careerId: 'c_sprint_test',
    seasonId: '2026',
    round: 2,
    configVersion: 'v1',
    totalParticipants: count,
    poleDriverId: 'drv_sprint_1',
    poleDriverName: 'Sprint Pilot 1',
    grid,
    status: 'SPRINT_GRID_READY',
    createdAt: '2026-03-28T10:00:00.000Z',
    updatedAt: '2026-03-28T10:00:00.000Z',
  }
}

// Helper para mock de 24 pilotos em STARTING_GRID do GP Principal
function createMockGpStartingGrid(count = 24): StartingGridState {
  const grid = Array.from({ length: count }, (_, idx) => {
    const pos = idx + 1
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      gridPosition: pos,
      driverId: `drv_gp_${pos}`,
      driverName: `GP Pilot ${pos}`,
      teamId: `gp_team_${Math.floor(idx / 2) + 1}`,
      teamName: `GP Team ${Math.floor(idx / 2) + 1}`,
      carIndex,
      qualifyingPosition: pos,
      eliminationPhase: (pos <= 10 ? 'Q3' : pos <= 18 ? 'Q2' : 'Q1') as 'Q1' | 'Q2' | 'Q3',
      qualifyingTimeMs: 77000 + idx * 50,
      bestAttemptMs: 77000 + idx * 50,
      formattedQualifyingTime: `1:17.${String(idx * 50).padStart(3, '0')}`,
      setup: 40 + idx,
      penalties: [],
      totalPenaltyPositions: 0,
      hasPenalty: false,
    }
  })

  return {
    careerId: 'c_gp_test',
    seasonId: '2026',
    round: 2,
    configVersion: 'v1',
    totalParticipants: count,
    poleDriverId: 'drv_gp_1',
    poleDriverName: 'GP Pilot 1',
    grid,
    status: 'GRID_READY',
    createdAt: '2026-03-28T14:00:00.000Z',
    updatedAt: '2026-03-28T14:00:00.000Z',
  }
}

function createMockPhase(phase: 'SQ1' | 'SQ2' | 'SQ3'): QualifyingPhaseExecutionState {
  const count = phase === 'SQ1' ? 24 : phase === 'SQ2' ? 18 : 10
  return {
    variant: 'SPRINT_QUALIFYING',
    phase,
    careerId: 'c_sprint_test',
    seasonId: '2026',
    round: 2,
    configVersion: 'v1',
    status:
      phase === 'SQ1'
        ? 'READY_FOR_SQ2'
        : phase === 'SQ2'
          ? 'READY_FOR_SQ3'
          : 'SPRINT_QUALIFYING_COMPLETE',
    isCompleted: true,
    totalParticipants: count,
    advancingCount: phase === 'SQ1' ? 18 : phase === 'SQ2' ? 10 : 10,
    eliminatedCount: phase === 'SQ1' ? 6 : phase === 'SQ2' ? 8 : 0,
    results: Array.from({ length: count }, (_, idx) => ({
      driverId: `drv_sprint_${idx + 1}`,
      driverName: `Sprint Pilot ${idx + 1}`,
      teamId: `team_${Math.floor(idx / 2) + 1}`,
      teamName: `Sprint Team ${Math.floor(idx / 2) + 1}`,
      carIndex: ((idx % 2) + 1) as 1 | 2,
      setup: 35 + idx,
      effectiveDriver: 82,
      trackRating: 80,
      basePaceMs: 79000,
      bonusMs: 40,
      compoundDeltaMs: phase === 'SQ3' ? 0 : 650,
      compoundUsed: (phase === 'SQ3' ? 'SOFT' : 'MEDIUM') as 'SOFT' | 'MEDIUM',
      bestTimeMs: 78000 + idx * 60,
      formattedBestTime: `1:18.${String(idx * 60).padStart(3, '0')}`,
      attempts: [],
      position: idx + 1,
      isClassified: true,
      isEliminated: phase === 'SQ1' ? idx >= 18 : phase === 'SQ2' ? idx >= 10 : false,
    })),
    classifiedDriverIds: [],
    eliminatedDriverIds: [],
    trackRecordMs: 78000,
    createdAt: '2026-03-28T09:00:00.000Z',
    updatedAt: '2026-03-28T09:00:00.000Z',
  }
}

describe('APEX GP MANAGER — RACE-SPRINT-SLOTS-01B3C-UI (SQUI-C01 a SQUI-C12)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('SQUI-C01 — FONTE: Grid Sprint lê exclusivamente SPRINT_STARTING_GRID', async () => {
    const mockSprintGrid = createMockSprintStartingGrid(24)
    const loadSprintGridSpy = vi
      .spyOn(raceQualifyingOrchestratorService, 'loadPersistedSprintStartingGrid')
      .mockResolvedValue(mockSprintGrid)

    const loadGpGridSpy = vi
      .spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid')
      .mockResolvedValue(createMockGpStartingGrid(24))

    render(
      <CanonicalQualifyingView
        careerId="c_sprint_test"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await waitFor(() => {
      expect(loadSprintGridSpy).toHaveBeenCalledWith('c_sprint_test', '2026', 2)
    })
    expect(loadGpGridSpy).not.toHaveBeenCalled()

    // O título e os pilotos do Sprint Grid devem aparecer
    expect(await screen.findByText('Sprint Pilot 1')).toBeInTheDocument()
    expect(screen.queryByText('GP Pilot 1')).not.toBeInTheDocument()
    expect(loadGpGridSpy).not.toHaveBeenCalled()
  })

  it('SQUI-C02 — PARTICIPANTES: 24 participantes renderizados no Grid Sprint', () => {
    const mockSprintGrid = createMockSprintStartingGrid(24)
    render(<SprintStartingGridSummary sprintGrid={mockSprintGrid} />)

    expect(screen.getByText('24 CARROS BIJETIVO')).toBeInTheDocument()
    for (let pos = 1; pos <= 24; pos++) {
      expect(screen.getByText(`Sprint Pilot ${pos}`)).toBeInTheDocument()
    }
  })

  // =========================================================================
  // SQUI-C03 — POSIÇÕES: P1–P24 contínuos, sem duplicação visual
  // =========================================================================
  it('SQUI-C03 — POSIÇÕES: P1–P24 contínuos, sem duplicação visual', () => {
    const mockSprintGrid = createMockSprintStartingGrid(24)
    render(<SprintStartingGridSummary sprintGrid={mockSprintGrid} />)

    for (let pos = 1; pos <= 24; pos++) {
      const row = screen.getByTestId(`sprint-grid-row-${pos}`)
      expect(row).toBeInTheDocument()
      expect(row).toHaveTextContent(`P${pos}`)
      expect(row).toHaveTextContent(`Sprint Pilot ${pos}`)
    }
  })

  // =========================================================================
  // SQUI-C04 — ISOLAMENTO: Grid Sprint não lê STARTING_GRID principal;
  //                          Grid Oficial do GP não lê SPRINT_STARTING_GRID
  // =========================================================================
  it('SQUI-C04 — ISOLAMENTO: isolamento absoluto dos dois grids', async () => {
    const loadSprintGridSpy = vi
      .spyOn(raceQualifyingOrchestratorService, 'loadPersistedSprintStartingGrid')
      .mockResolvedValue(createMockSprintStartingGrid(24))

    const loadGpGridSpy = vi
      .spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid')
      .mockResolvedValue(createMockGpStartingGrid(24))

    // 1. Renderiza SPRINT
    const { unmount } = render(
      <CanonicalQualifyingView
        careerId="c_test"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Grid de Largada da Corrida Sprint (P1 – P24)')
    expect(loadSprintGridSpy).toHaveBeenCalled()
    expect(loadGpGridSpy).not.toHaveBeenCalled()
    expect(screen.getByText('Sprint Pilot 1')).toBeInTheDocument()
    expect(screen.queryByText('GP Pilot 1')).not.toBeInTheDocument()
    unmount()

    // 2. Renderiza MAIN
    loadSprintGridSpy.mockClear()
    loadGpGridSpy.mockClear()

    render(
      <CanonicalQualifyingView
        careerId="c_test"
        seasonId="2026"
        round={1}
        variant="MAIN_QUALIFYING"
      />,
    )

    await screen.findByText('Grid de Largada Oficial do Grande Prêmio (P1 – P24)')
    expect(loadGpGridSpy).toHaveBeenCalled()
    expect(loadSprintGridSpy).not.toHaveBeenCalled()
    expect(screen.getByText('GP Pilot 1')).toBeInTheDocument()
    expect(screen.queryByText('Sprint Pilot 1')).not.toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-C05 — ZERO CÁLCULO: render não chama RNG, pureRaceEngine,
  //                          qualifying orchestrator, cálculo de grid ou penalidade
  // =========================================================================
  it('SQUI-C05 — ZERO CÁLCULO: render não chama RNG nem orquestrador esportivo', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')
    const buildSprintGridSpy = vi.spyOn(
      raceQualifyingOrchestratorService,
      'buildSprintStartingGrid',
    )
    const buildSprintQualiSpy = vi.spyOn(
      raceQualifyingOrchestratorService,
      'buildSprintQualifyingResult',
    )
    const buildStartingGridSpy = vi.spyOn(raceQualifyingOrchestratorService, 'buildStartingGrid')

    const mockSprintGrid = createMockSprintStartingGrid(24)
    render(<SprintStartingGridSummary sprintGrid={mockSprintGrid} />)

    expect(mathRandomSpy).not.toHaveBeenCalled()
    expect(buildSprintGridSpy).not.toHaveBeenCalled()
    expect(buildSprintQualiSpy).not.toHaveBeenCalled()
    expect(buildStartingGridSpy).not.toHaveBeenCalled()
  })

  // =========================================================================
  // SQUI-C06 — NOT READY: sem SPRINT_STARTING_GRID, mostrar estado "ainda não definido"
  // =========================================================================
  it('SQUI-C06 — NOT READY: sem SPRINT_STARTING_GRID, mostra estado apropriado sem fallback falso', () => {
    // 1. null
    const { unmount } = render(<SprintStartingGridSummary sprintGrid={null} />)
    expect(screen.getByText(/Grid Sprint ainda não definido/i)).toBeInTheDocument()
    expect(screen.queryByText('24 CARROS BIJETIVO')).not.toBeInTheDocument()
    expect(screen.queryByText('Sprint Pilot 1')).not.toBeInTheDocument()
    expect(screen.queryByText('GP Pilot 1')).not.toBeInTheDocument()
    unmount()

    // 2. grid vazio
    render(
      <SprintStartingGridSummary
        sprintGrid={
          {
            careerId: 'c_test',
            seasonId: '2026',
            round: 2,
            configVersion: 'v1',
            totalParticipants: 0,
            poleDriverId: '',
            poleDriverName: '',
            grid: [],
            status: 'SPRINT_GRID_READY',
            createdAt: '',
            updatedAt: '',
          } as SprintStartingGridState
        }
      />,
    )
    expect(screen.getByText(/Grid Sprint ainda não definido/i)).toBeInTheDocument()
    expect(screen.queryByText('Sprint Pilot 1')).not.toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-C07 — SEM PENALIDADE INVENTADA: nenhuma badge de penalidade pré-Sprint
  // =========================================================================
  it('SQUI-C07 — SEM PENALIDADE INVENTADA: nenhuma badge de penalidade pré-Sprint aparece', () => {
    const mockSprintGrid = createMockSprintStartingGrid(24)
    render(<SprintStartingGridSummary sprintGrid={mockSprintGrid} />)

    // Não deve haver menção a "+5 posições", "+10 posições", penalidade de motor ou PU
    expect(screen.queryByText(/\+5/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\+10/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/posições de penalidade/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Troca de motor/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Fora da quota/i)).not.toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-C08 — RELOAD: persistência reconstruída produz exatamente o mesmo Grid Sprint
  // =========================================================================
  it('SQUI-C08 — RELOAD: persistência reconstruída produz exatamente o mesmo Grid Sprint', async () => {
    const mockSprintGrid = createMockSprintStartingGrid(24)
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintStartingGrid',
    ).mockResolvedValue(mockSprintGrid)

    // Montagem 1
    const { unmount } = render(
      <CanonicalQualifyingView
        careerId="c_sprint_test"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Grid de Largada da Corrida Sprint (P1 – P24)')
    expect(screen.getByText('Sprint Pilot 1')).toBeInTheDocument()
    expect(screen.getByText('Sprint Pilot 24')).toBeInTheDocument()
    unmount()

    // Montagem 2 ("Reload")
    render(
      <CanonicalQualifyingView
        careerId="c_sprint_test"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Grid de Largada da Corrida Sprint (P1 – P24)')
    expect(screen.getByText('Sprint Pilot 1')).toBeInTheDocument()
    expect(screen.getByText('Sprint Pilot 24')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-C09 — SLOT: visualizar Grid Sprint não altera currentSlot, slotStatus, subPhase
  // =========================================================================
  it('SQUI-C09 — SLOT: visualizar Grid Sprint não altera slot ou subfases', () => {
    const executeSpy = vi.spyOn(raceQualifyingOrchestratorService, 'executeQualifyingPhase')
    const buildGridSpy = vi.spyOn(raceQualifyingOrchestratorService, 'buildSprintStartingGrid')

    const mockSprintGrid = createMockSprintStartingGrid(24)
    render(
      <SprintQualifyingPhaseTabs
        sq1State={createMockPhase('SQ1')}
        sq2State={createMockPhase('SQ2')}
        sq3State={createMockPhase('SQ3')}
        sprintGrid={mockSprintGrid}
      />,
    )

    const gridTab = screen.getByRole('tab', { name: /Grid da Sprint/i })
    fireEvent.click(gridTab)

    expect(screen.getByText('Grid de Largada da Corrida Sprint (P1 – P24)')).toBeInTheDocument()
    expect(executeSpy).not.toHaveBeenCalled()
    expect(buildGridSpy).not.toHaveBeenCalled()
  })

  // =========================================================================
  // SQUI-C10 — NORMAL: weekend NORMAL não exibe Grid Sprint
  // =========================================================================
  it('SQUI-C10 — NORMAL: weekend NORMAL não exibe Grid Sprint', () => {
    const normalFormat = resolveWeekendFormat(1) // Melbourne = NORMAL
    expect(normalFormat).toBe('NORMAL')

    const seq = getWeekendSlotSequence('NORMAL')
    const labels = seq.map((s) => s.displayLabel)

    expect(labels).not.toContain('Grid Sprint')
    expect(labels).not.toContain('Qualificação Sprint')
    expect(labels.some((l) => l.includes('Sprint'))).toBe(false)
  })

  // =========================================================================
  // SQUI-C11 — GRID DO GP INTACTO: Grid Oficial principal continua consumindo STARTING_GRID
  // =========================================================================
  it('SQUI-C11 — GRID DO GP INTACTO: Grid Oficial principal continua consumindo STARTING_GRID', async () => {
    const gpGrid = createMockGpStartingGrid(24)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(
      gpGrid,
    )

    render(
      <CanonicalQualifyingView
        careerId="c_main_test"
        seasonId="2026"
        round={1}
        variant="MAIN_QUALIFYING"
      />,
    )

    await screen.findByText('Grid de Largada Oficial do Grande Prêmio (P1 – P24)')
    expect(screen.getByText('GP Pilot 1')).toBeInTheDocument()
    expect(screen.getByText('GP Pilot 24')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-C12 — TROCA DE VISÃO: SQ1 <-> SQ2 <-> SQ3 <-> Grid Sprint não recalcula artefatos
  // =========================================================================
  it('SQUI-C12 — TROCA DE VISÃO: alternar SQ1 <-> SQ2 <-> SQ3 <-> Grid Sprint não recalcula nem altera qualquer artefato esportivo', () => {
    const executeSpy = vi.spyOn(raceQualifyingOrchestratorService, 'executeQualifyingPhase')
    const buildSprintQualiSpy = vi.spyOn(
      raceQualifyingOrchestratorService,
      'buildSprintQualifyingResult',
    )
    const buildGridSpy = vi.spyOn(raceQualifyingOrchestratorService, 'buildSprintStartingGrid')

    render(
      <SprintQualifyingPhaseTabs
        sq1State={createMockPhase('SQ1')}
        sq2State={createMockPhase('SQ2')}
        sq3State={createMockPhase('SQ3')}
        sprintGrid={createMockSprintStartingGrid(24)}
      />,
    )

    // Clicar em cada aba em sequência
    fireEvent.click(screen.getByRole('tab', { name: /SQ1/i }))
    fireEvent.click(screen.getByRole('tab', { name: /SQ2/i }))
    fireEvent.click(screen.getByRole('tab', { name: /SQ3/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Grid da Sprint/i }))
    fireEvent.click(screen.getByRole('tab', { name: /SQ1/i }))

    expect(executeSpy).not.toHaveBeenCalled()
    expect(buildSprintQualiSpy).not.toHaveBeenCalled()
    expect(buildGridSpy).not.toHaveBeenCalled()
  })
})
