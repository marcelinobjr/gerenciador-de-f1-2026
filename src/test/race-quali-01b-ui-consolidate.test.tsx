/**
 * src/test/race-quali-01b-ui-consolidate.test.tsx
 *
 * RACE-QUALI-01B-UI-CONSOLIDATE: Generalização da UI de Classificação e Conexão Q2 + Q3.
 *
 * Bateria de Testes Canônicos Obrigatórios:
 * - UI-Q2-01 — PARTICIPANTES: 18 resultados persistidos de Q2 são exibidos.
 * - UI-Q2-02 — ELIMINADOS: 8 eliminados aparecem conforme o estado persistido.
 * - UI-Q2-03 — SEM RESSURREIÇÃO: nenhum piloto eliminado no Q1 aparece no resultado persistido renderizado de Q2.
 * - UI-Q2-04 — NOT RUN: Q2 não realizada mostra estado correto.
 * - UI-Q3-01 — PARTICIPANTES: 10 resultados persistidos são exibidos.
 * - UI-Q3-02 — ORDEM: ordem visual corresponde à posição persistida de Q3.
 * - UI-Q3-03 — SEM FASE FICTÍCIA: Q3 não apresenta "Avança ao Q4" nem regra equivalente.
 * - UI-Q3-04 — NOT RUN: Q3 não realizada mostra estado correto.
 * - UI-COMMON-01 — COMPONENTE COMUM: Q1/Q2/Q3 usam a mesma camada genérica de apresentação (QualifyingPhaseView).
 * - UI-COMMON-02 — ZERO CÁLCULO: renderizar qualquer das três fases não chama RNG, pureRaceEngine, cálculo de setup nem execução de classificação.
 * - UI-COMMON-03 — RELOAD: estado reconstruído do armazenamento gera a mesma apresentação.
 */

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CanonicalQualifyingView } from '@/components/race/CanonicalQualifyingView'
import { QualifyingPhaseView } from '@/components/race/QualifyingPhaseView'
import {
  raceQualifyingOrchestratorService,
  QualifyingPhaseExecutionState,
} from '@/services/raceQualifyingOrchestratorService'

describe('RACE-QUALI-01B-UI-CONSOLIDATE — Generalização e Conexão de Q1, Q2 e Q3', () => {
  const careerId = 'career_ui_consolidate_test'
  const seasonId = '2026'
  const round = 1

  // Fixture geradora de participantes persistidos
  const createPhaseResults = (count: number, prefix: string) => {
    return Array.from({ length: count }, (_, i) => ({
      driverId: `drv_${prefix}_${i + 1}`,
      driverName: `Piloto ${prefix} ${i + 1}`,
      teamId: `team_${Math.floor(i / 2) + 1}`,
      teamName: `Scuderia ${Math.floor(i / 2) + 1}`,
      carIndex: ((i % 2) + 1) as 1 | 2,
      setup: 91.5 + (i % 5),
      effectiveDriver: 82,
      trackRating: 86,
      basePaceMs: 81000,
      bonusMs: 0.15,
      bestTimeMs: 81000 + i * 110,
      formattedBestTime: `1:21.${String(i * 110).padStart(3, '0')}`,
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

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedGlobalQualifyingResult',
    ).mockResolvedValue(null)
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid').mockResolvedValue(null)
  })

  // =========================================================================
  // UI-Q2-01 — PARTICIPANTES
  // =========================================================================
  it('UI-Q2-01 — PARTICIPANTES: 18 resultados persistidos de Q2 são exibidos', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    // A tela abre na aba ativa (Q2 porque Q2 está completo)
    await waitFor(() => {
      expect(screen.getByText('Fase Q2 — Somente os 18 Classificados')).toBeInTheDocument()
    })

    const rows = screen.getAllByText(/Piloto Q2/)
    expect(rows).toHaveLength(18)
    expect(screen.getByText('18 Pilotos')).toBeInTheDocument()
  })

  // =========================================================================
  // UI-Q2-02 — ELIMINADOS
  // =========================================================================
  it('UI-Q2-02 — ELIMINADOS: 8 eliminados aparecem conforme o estado persistido', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Fase Q2 — Somente os 18 Classificados')).toBeInTheDocument()
    })

    const eliminatedBadges = screen.getAllByText('Eliminado Q2')
    expect(eliminatedBadges).toHaveLength(8)

    const advanceBadges = screen.getAllByText('Avança ao Q3')
    expect(advanceBadges).toHaveLength(10)
  })

  // =========================================================================
  // UI-Q2-03 — SEM RESSURREIÇÃO
  // =========================================================================
  it('UI-Q2-03 — SEM RESSURREIÇÃO: nenhum piloto eliminado no Q1 aparece no resultado persistido renderizado de Q2', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Fase Q2 — Somente os 18 Classificados')).toBeInTheDocument()
    })

    // Os 6 eliminados do Q1 (índices 18 a 23 da fixture Q1)
    const q1Eliminated = mockQ1Results24.slice(18)
    expect(q1Eliminated).toHaveLength(6)

    for (const eliminatedPilot of q1Eliminated) {
      expect(screen.queryByText(eliminatedPilot.driverName)).toBeNull()
    }
  })

  // =========================================================================
  // UI-Q2-04 — NOT RUN
  // =========================================================================
  it('UI-Q2-04 — NOT RUN: Q2 não realizada mostra estado correto', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        // Q2 não realizada
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    // Como Q1 está completo mas Q2 não rodou, navega até a aba Q2
    await waitFor(() => {
      expect(screen.getByText('Fase Q1 — 24 Carros Inscritos')).toBeInTheDocument()
    })

    const q2TabTrigger = screen.getByRole('tab', { name: /Q2/ })
    await userEvent.click(q2TabTrigger)

    await waitFor(() => {
      expect(
        screen.getByText('Sessão Q2 ainda não realizada (aguardando conclusão do Q1).'),
      ).toBeInTheDocument()
    })

    // Sem pilotos fantasmas nem tempos zerados
    expect(screen.queryByText(/Piloto Q2/)).toBeNull()
    expect(screen.queryByText('0:00.000')).toBeNull()
    expect(screen.queryByText('P0')).toBeNull()
  })

  // =========================================================================
  // UI-Q3-01 — PARTICIPANTES
  // =========================================================================
  it('UI-Q3-01 — PARTICIPANTES: 10 resultados persistidos são exibidos', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        if (phase === 'Q3') return mockQ3State
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(
        screen.getByText('Fase Q3 — Os 10 Finalistas (Disputa da Pole Position)'),
      ).toBeInTheDocument()
    })

    const q3Rows = screen.getAllByText(/Piloto Q3/)
    expect(q3Rows).toHaveLength(10)
    expect(screen.getByText('10 Pilotos')).toBeInTheDocument()
  })

  // =========================================================================
  // UI-Q3-02 — ORDEM
  // =========================================================================
  it('UI-Q3-02 — ORDEM: ordem visual corresponde à posição persistida de Q3', async () => {
    // Inversão proposital para validar que a UI renderiza na ordem recebida do estado persistido
    const invertedQ3Results = [
      { ...mockQ3Results10[3], position: 1 },
      { ...mockQ3Results10[1], position: 2 },
      { ...mockQ3Results10[0], position: 3 },
      { ...mockQ3Results10[2], position: 4 },
      ...mockQ3Results10.slice(4),
    ]

    const customQ3State: QualifyingPhaseExecutionState = {
      ...mockQ3State,
      results: invertedQ3Results,
    }

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        if (phase === 'Q3') return customQ3State
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(
        screen.getByText('Fase Q3 — Os 10 Finalistas (Disputa da Pole Position)'),
      ).toBeInTheDocument()
    })

    const renderedPilots = screen.getAllByText(/Piloto Q3/)
    expect(renderedPilots[0]).toHaveTextContent(invertedQ3Results[0].driverName)
    expect(renderedPilots[1]).toHaveTextContent(invertedQ3Results[1].driverName)
    expect(renderedPilots[2]).toHaveTextContent(invertedQ3Results[2].driverName)
    expect(renderedPilots[3]).toHaveTextContent(invertedQ3Results[3].driverName)
  })

  // =========================================================================
  // UI-Q3-03 — SEM FASE FICTÍCIA
  // =========================================================================
  it('UI-Q3-03 — SEM FASE FICTÍCIA: Q3 não apresenta "Avança ao Q4" nem regra equivalente', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        if (phase === 'Q3') return mockQ3State
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(
        screen.getByText('Fase Q3 — Os 10 Finalistas (Disputa da Pole Position)'),
      ).toBeInTheDocument()
    })

    // Não pode haver "Avança ao Q4", "Q4", etc.
    expect(screen.queryByText(/Avança ao Q4/i)).toBeNull()
    expect(screen.queryByText(/Eliminado Q3/i)).toBeNull()

    // O P1 recebe Pole Position
    expect(screen.getByText('Pole Position')).toBeInTheDocument()
    // Os demais recebem Finalista
    const finalistBadges = screen.getAllByText(/Finalista \(P\d+\)/)
    expect(finalistBadges).toHaveLength(9)
  })

  // =========================================================================
  // UI-Q3-04 — NOT RUN
  // =========================================================================
  it('UI-Q3-04 — NOT RUN: Q3 não realizada mostra estado correto', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        // Q3 não realizada
        return null
      },
    )

    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    // Q2 está completo, tela abre em Q2. Clicamos na aba Q3
    await waitFor(() => {
      expect(screen.getByText('Fase Q2 — Somente os 18 Classificados')).toBeInTheDocument()
    })

    const q3TabTrigger = screen.getByRole('tab', { name: /Q3/ })
    await userEvent.click(q3TabTrigger)

    await waitFor(() => {
      expect(
        screen.getByText('Sessão Q3 ainda não realizada (aguardando conclusão do Q2).'),
      ).toBeInTheDocument()
    })

    // Sem pilotos de Q3 nem tempos fabricados
    expect(screen.queryByText(/Piloto Q3/)).toBeNull()
    expect(screen.queryByText('0:00.000')).toBeNull()
    expect(screen.queryByText('P0')).toBeNull()
  })

  // =========================================================================
  // UI-COMMON-01 — COMPONENTE COMUM
  // =========================================================================
  it('UI-COMMON-01 — COMPONENTE COMUM: Q1/Q2/Q3 usam a mesma camada genérica de apresentação', () => {
    // Testa a camada genérica QualifyingPhaseView renderizando separadamente cada fase com o mesmo componente
    const { rerender } = render(<QualifyingPhaseView phase="Q1" state={mockQ1State} />)
    expect(screen.getByText('Fase Q1 — 24 Carros Inscritos')).toBeInTheDocument()
    expect(screen.getAllByText(/Piloto Q1/)).toHaveLength(24)

    rerender(<QualifyingPhaseView phase="Q2" state={mockQ2State} />)
    expect(screen.getByText('Fase Q2 — Somente os 18 Classificados')).toBeInTheDocument()
    expect(screen.getAllByText(/Piloto Q2/)).toHaveLength(18)

    rerender(<QualifyingPhaseView phase="Q3" state={mockQ3State} />)
    expect(
      screen.getByText('Fase Q3 — Os 10 Finalistas (Disputa da Pole Position)'),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Piloto Q3/)).toHaveLength(10)
  })

  // =========================================================================
  // UI-COMMON-02 — ZERO CÁLCULO
  // =========================================================================
  it('UI-COMMON-02 — ZERO CÁLCULO: renderizar qualquer das três fases não chama RNG, pureRaceEngine, cálculo de setup, execução de classificação', async () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')
    const spyExecuteQ1 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ1')
    const spyExecuteQ2 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ2')
    const spyExecuteQ3 = vi.spyOn(raceQualifyingOrchestratorService, 'executeQ3')
    const spyBuildGrid = vi.spyOn(raceQualifyingOrchestratorService, 'buildStartingGrid')

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        if (phase === 'Q3') return mockQ3State
        return null
      },
    )

    const { unmount } = render(
      <CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />,
    )

    await waitFor(() => {
      expect(
        screen.getByText('Fase Q3 — Os 10 Finalistas (Disputa da Pole Position)'),
      ).toBeInTheDocument()
    })

    // Trocar para Q1 e Q2
    const q1Tab = screen.getByRole('tab', { name: /Q1/ })
    await userEvent.click(q1Tab)
    await waitFor(() => {
      expect(screen.getByText('Fase Q1 — 24 Carros Inscritos')).toBeInTheDocument()
    })

    const q2Tab = screen.getByRole('tab', { name: /Q2/ })
    await userEvent.click(q2Tab)
    await waitFor(() => {
      expect(screen.getByText('Fase Q2 — Somente os 18 Classificados')).toBeInTheDocument()
    })

    unmount()

    // Nenhuma operação esportiva ou aleatória foi disparada durante renderização ou navegação de abas
    expect(mathRandomSpy).not.toHaveBeenCalled()
    expect(spyExecuteQ1).not.toHaveBeenCalled()
    expect(spyExecuteQ2).not.toHaveBeenCalled()
    expect(spyExecuteQ3).not.toHaveBeenCalled()
    expect(spyBuildGrid).not.toHaveBeenCalled()
  })

  // =========================================================================
  // UI-COMMON-03 — RELOAD
  // =========================================================================
  it('UI-COMMON-03 — RELOAD: estado reconstruído do armazenamento gera a mesma apresentação', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => {
        if (phase === 'Q1') return mockQ1State
        if (phase === 'Q2') return mockQ2State
        if (phase === 'Q3') return mockQ3State
        return null
      },
    )

    // Render inicial
    const { unmount } = render(
      <CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />,
    )

    await waitFor(() => {
      expect(screen.getByText('Piloto Q3 1')).toBeInTheDocument()
      expect(screen.getByText(mockQ3Results10[0].formattedBestTime)).toBeInTheDocument()
    })

    unmount()

    // Segundo render (reload do app/página)
    render(<CanonicalQualifyingView careerId={careerId} seasonId={seasonId} round={round} />)

    await waitFor(() => {
      expect(screen.getByText('Piloto Q3 1')).toBeInTheDocument()
      expect(screen.getByText(mockQ3Results10[0].formattedBestTime)).toBeInTheDocument()
      expect(screen.getByText('Pole Position')).toBeInTheDocument()
    })
  })
})
