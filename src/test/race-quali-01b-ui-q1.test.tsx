/**
 * src/test/race-quali-01b-ui-q1.test.tsx
 *
 * Suíte de Testes Mínimos para RACE-QUALI-01B-UI-Q1:
 * - UI-Q1-01: com resultado persistido, renderiza participantes na ordem recebida.
 * - UI-Q1-02: na fixture, 24 participantes.
 * - UI-Q1-03: 6 participantes com estado visual de eliminação, conforme resultado persistido (sem recalcular corte no teste).
 * - UI-Q1-04: renderizar não chama RNG, motor de tempo, setup nem execução de sessão.
 * - UI-Q1-05: Q1 ausente → estado apropriado, sem inventar classificação.
 */

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CanonicalQualifyingView } from '@/components/race/CanonicalQualifyingView'
import {
  raceQualifyingOrchestratorService,
  QualifyingPhaseExecutionState,
} from '@/services/raceQualifyingOrchestratorService'

describe('RACE-QUALI-01B-UI-Q1 — Testes Mínimos da Aba Q1 Persistida', () => {
  const careerId = 'test_career_ui_q1'
  const seasonId = '2026'
  const round = 1

  // Fixture de 24 participantes na ordem persistida (com inversão proposital para testar que a UI não faz sort)
  const createMockQ1Results = (count: number = 24) => {
    return Array.from({ length: count }, (_, i) => ({
      driverId: `drv_q1_${i + 1}`,
      driverName: `Piloto Alfa ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Scuderia ${Math.floor(i / 2) + 1}`,
      carIndex: ((i % 2) + 1) as 1 | 2,
      setup: 90.0 + (i % 5),
      effectiveDriver: 80,
      trackRating: 85,
      basePaceMs: 80000,
      bonusMs: 0.1,
      bestTimeMs: 81000 + i * 120,
      formattedBestTime: `1:21.${String(i * 120).padStart(3, '0')}`,
      attempts: [],
      position: i + 1,
      isClassified: i < 18,
      isEliminated: i >= 18,
    }))
  }

  const mockQ1Results24 = createMockQ1Results(24)

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
    trackRecordMs: 79000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(null)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(null)
  })

  it('UI-Q1-01: com resultado persistido, renderiza participantes na ordem recebida (sem sort por tempo na UI)', async () => {
    // Ordem arbitrária persistida pelo backend
    const customOrderResults = [
      { ...mockQ1Results24[2], position: 1 },
      { ...mockQ1Results24[0], position: 2 },
      { ...mockQ1Results24[1], position: 3 },
      ...mockQ1Results24.slice(3),
    ]

    const customState: QualifyingPhaseExecutionState = {
      ...mockQ1State,
      results: customOrderResults,
    }

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return customState
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Fase Q1 — 24 Carros Inscritos')).toBeInTheDocument()
    })

    const driverCells = screen.getAllByText(/Piloto Alfa/)
    expect(driverCells[0]).toHaveTextContent(customOrderResults[0].driverName)
    expect(driverCells[1]).toHaveTextContent(customOrderResults[1].driverName)
    expect(driverCells[2]).toHaveTextContent(customOrderResults[2].driverName)
  })

  it('UI-Q1-02: na fixture, 24 participantes renderizados', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Fase Q1 — 24 Carros Inscritos')).toBeInTheDocument()
    })

    const rows = screen.getAllByText(/Piloto Alfa/)
    expect(rows).toHaveLength(24)
  })

  it('UI-Q1-03: 6 participantes com estado visual de eliminação, conforme resultado persistido (sem recalcular corte no teste)', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Fase Q1 — 24 Carros Inscritos')).toBeInTheDocument()
    })

    const eliminatedBadges = screen.getAllByText(/Eliminado Q1/)
    expect(eliminatedBadges).toHaveLength(6)

    const advancingBadges = screen.getAllByText('Avança ao Q2')
    expect(advancingBadges).toHaveLength(18)
  })

  it('UI-Q1-04: renderizar não chama RNG, motor de tempo, setup nem execução de sessão', async () => {
    const spyExecuteQ1 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ1')
    const spyExecuteQ2 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ2')
    const spyExecuteQ3 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ3')
    const spyBuildGrid = vi.spyOn(raceQualifyingOrchestratorService, 'buildStartingGrid')
    const mathRandomSpy = vi.spyOn(Math, 'random')

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Fase Q1 — 24 Carros Inscritos')).toBeInTheDocument()
    })

    expect(spyExecuteQ1).not.toHaveBeenCalled()
    expect(spyExecuteQ2).not.toHaveBeenCalled()
    expect(spyExecuteQ3).not.toHaveBeenCalled()
    expect(spyBuildGrid).not.toHaveBeenCalled()
    expect(mathRandomSpy).not.toHaveBeenCalled()
  })

  it('UI-Q1-05: Q1 ausente → estado apropriado, sem inventar classificação', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockResolvedValue(null)

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Sessão Q1 ainda não realizada (READY_FOR_Q1).')).toBeInTheDocument()
    })

    // Não fabrica linhas nem inventa pilotos/posições falsas
    expect(screen.queryByText(/Piloto Alfa/)).toBeNull()
    expect(screen.queryByText('0:00.000')).toBeNull()
    expect(screen.queryByText('P0')).toBeNull()
  })
})
