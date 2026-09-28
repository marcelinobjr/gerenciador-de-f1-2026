/**
 * src/test/race-sprint-slots-01b3-ui.test.tsx
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01B3-UI
 * Testes UI Obrigatórios (SQUI-01 a SQUI-12):
 * - SQUI-01: SPRINT/SQ1 renderiza 24 participantes, 6 eliminados, 18 avançam
 * - SQUI-02: SPRINT/SQ2 renderiza 18 participantes, 8 eliminados, 10 avançam
 * - SQUI-03: SPRINT/SQ3 renderiza 10 participantes, sem avanço fictício a SQ4
 * - SQUI-04: SQ1/SQ2/SQ3 reutilizam QualifyingPhaseView — testar comportamento, não apenas nome de arquivo
 * - SQUI-05: renderizar SQ não chama RNG, pureRaceEngine, cálculo de setup, compound delta nem qualifying orchestrator
 * - SQUI-06: Grid Sprint renderiza 24 participantes P1–P24 na ordem do SPRINT_STARTING_GRID
 * - SQUI-07: Grid Sprint não lê STARTING_GRID do GP; Grid Oficial do GP não lê SPRINT_STARTING_GRID
 * - SQUI-08: nenhuma badge de penalidade pré-Sprint criada artificialmente
 * - SQUI-09: antes de SPRINT_STARTING_GRID existir, não mostrar grid definitivo falso
 * - SQUI-10: weekend NORMAL não exibe elementos Sprint
 * - SQUI-11: reload mostra exatamente os mesmos SQ1/SQ2/SQ3/Grid Sprint
 * - SQUI-12: visualizar/trocar abas não altera currentSlot, slotStatus, subPhase nem resultados
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QualifyingPhaseView } from '@/components/race/QualifyingPhaseView'
import { CanonicalQualifyingView } from '@/components/race/CanonicalQualifyingView'
import {
  raceQualifyingOrchestratorService,
  type QualifyingPhaseExecutionState,
  type SprintQualifyingResultState,
  type SprintStartingGridState,
  type StartingGridState,
} from '@/services/raceQualifyingOrchestratorService'
import { getWeekendSlotSequence, resolveWeekendFormat } from '@/services/weekendSlotSequenceService'

// Helper para criar mock de participantes
function makeDrivers(count: number, phase: 'SQ1' | 'SQ2' | 'SQ3') {
  return Array.from({ length: count }, (_, idx) => {
    const pos = idx + 1
    const isElim = phase === 'SQ1' ? pos > 18 : phase === 'SQ2' ? pos > 10 : false
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      driverId: `drv_${idx + 1}`,
      driverName: `Piloto ${idx + 1}`,
      teamId: `team_${idx + 1}`,
      teamName: `Equipe ${Math.floor(idx / 2) + 1}`,
      carIndex,
      setup: 30 + idx,
      effectiveDriver: 80,
      trackRating: 80,
      basePaceMs: 80000,
      bonusMs: 50,
      compoundDeltaMs: phase === 'SQ3' ? 0 : 650,
      compoundUsed: (phase === 'SQ3' ? 'SOFT' : 'MEDIUM') as 'SOFT' | 'MEDIUM',
      bestTimeMs: 80000 + idx * 100,
      formattedBestTime: `1:20.${String(idx * 100).padStart(3, '0')}`,
      attempts: [],
      position: pos,
      isClassified: !isElim,
      isEliminated: isElim,
    }
  })
}

function mockPhaseState(phase: 'SQ1' | 'SQ2' | 'SQ3'): QualifyingPhaseExecutionState {
  const count = phase === 'SQ1' ? 24 : phase === 'SQ2' ? 18 : 10
  const advancing = phase === 'SQ1' ? 18 : phase === 'SQ2' ? 10 : 10
  const elim = phase === 'SQ1' ? 6 : phase === 'SQ2' ? 8 : 0
  const results = makeDrivers(count, phase)

  return {
    variant: 'SPRINT_QUALIFYING',
    phase,
    careerId: 'test_career',
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
    advancingCount: advancing,
    eliminatedCount: elim,
    results,
    classifiedDriverIds: results.filter((r) => !r.isEliminated).map((r) => r.driverId),
    eliminatedDriverIds: results.filter((r) => r.isEliminated).map((r) => r.driverId),
    trackRecordMs: 80000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function mockSprintResult(): SprintQualifyingResultState {
  const results = Array.from({ length: 24 }, (_, idx) => {
    const pos = idx + 1
    const elimPhase: 'SQ1' | 'SQ2' | 'SQ3' = pos <= 10 ? 'SQ3' : pos <= 18 ? 'SQ2' : 'SQ1'
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      driverId: `drv_${pos}`,
      driverName: `Piloto ${pos}`,
      teamId: `team_${pos}`,
      teamName: `Equipe ${Math.floor(idx / 2) + 1}`,
      carIndex,
      position: pos,
      eliminationPhase: elimPhase,
      phaseBestTimeMs: 80000 + idx * 50,
      bestAttemptMs: 80000 + idx * 50,
      formattedPhaseBestTime: `1:20.${String(idx * 50).padStart(3, '0')}`,
      setup: 30 + idx,
    }
  })

  return {
    careerId: 'test_career',
    seasonId: '2026',
    round: 2,
    totalDrivers: 24,
    results,
    status: 'SPRINT_QUALIFYING_RESULT_READY',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function mockSprintGrid(): SprintStartingGridState {
  const grid = Array.from({ length: 24 }, (_, idx) => {
    const pos = idx + 1
    const elimPhase: 'SQ1' | 'SQ2' | 'SQ3' = pos <= 10 ? 'SQ3' : pos <= 18 ? 'SQ2' : 'SQ1'
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      gridPosition: pos,
      driverId: `drv_${pos}`,
      driverName: `Piloto ${pos}`,
      teamId: `team_${pos}`,
      teamName: `Equipe ${Math.floor(idx / 2) + 1}`,
      carIndex,
      qualifyingPosition: pos,
      eliminationPhase: elimPhase,
      qualifyingTimeMs: 80000 + idx * 50,
      bestAttemptMs: 80000 + idx * 50,
      formattedQualifyingTime: `1:20.${String(idx * 50).padStart(3, '0')}`,
      setup: 30 + idx,
      penalties: [],
      totalPenaltyPositions: 0,
      hasPenalty: false,
    }
  })

  return {
    careerId: 'test_career',
    seasonId: '2026',
    round: 2,
    totalCars: 24,
    grid,
    status: 'SPRINT_GRID_READY',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('APEX GP MANAGER — RACE-SPRINT-SLOTS-01B3-UI (SQUI-01 a SQUI-12)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // =========================================================================
  // SQUI-01: SPRINT/SQ1 renderiza 24 participantes, 6 eliminados, 18 avançam
  // =========================================================================
  it('SQUI-01: SPRINT/SQ1 renderiza 24 participantes, 6 eliminados, 18 avançam', () => {
    const sq1State = mockPhaseState('SQ1')
    render(<QualifyingPhaseView phase="SQ1" state={sq1State} />)

    expect(screen.getByText(/Fase SQ1 — 24 Carros Inscritos/i)).toBeInTheDocument()
    expect(screen.getByText('Piloto 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto 24')).toBeInTheDocument()

    // 18 avançam
    const advanceBadges = screen.getAllByText('Avança ao SQ2')
    expect(advanceBadges.length).toBe(18)

    // 6 eliminados
    const eliminatedBadges = screen.getAllByText('Eliminado SQ1')
    expect(eliminatedBadges.length).toBe(6)
  })

  // =========================================================================
  // SQUI-02: SPRINT/SQ2 renderiza 18 participantes, 8 eliminados, 10 avançam
  // =========================================================================
  it('SQUI-02: SPRINT/SQ2 renderiza 18 participantes, 8 eliminados, 10 avançam', () => {
    const sq2State = mockPhaseState('SQ2')
    render(<QualifyingPhaseView phase="SQ2" state={sq2State} />)

    expect(screen.getByText(/Fase SQ2 — Somente os 18 Classificados/i)).toBeInTheDocument()
    expect(screen.getByText('Piloto 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto 18')).toBeInTheDocument()
    expect(screen.queryByText('Piloto 19')).not.toBeInTheDocument()

    // 10 avançam
    const advanceBadges = screen.getAllByText('Avança ao SQ3')
    expect(advanceBadges.length).toBe(10)

    // 8 eliminados
    const eliminatedBadges = screen.getAllByText('Eliminado SQ2')
    expect(eliminatedBadges.length).toBe(8)
  })

  // =========================================================================
  // SQUI-03: SPRINT/SQ3 renderiza 10 participantes, sem avanço fictício a SQ4
  // =========================================================================
  it('SQUI-03: SPRINT/SQ3 renderiza 10 participantes, sem avanço fictício a SQ4', () => {
    const sq3State = mockPhaseState('SQ3')
    render(<QualifyingPhaseView phase="SQ3" state={sq3State} />)

    expect(
      screen.getByText(/Fase SQ3 — Os 10 Finalistas \(Pole da Corrida Sprint\)/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Piloto 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto 10')).toBeInTheDocument()
    expect(screen.queryByText('Piloto 11')).not.toBeInTheDocument()

    // Sem avanço fictício para SQ4
    expect(screen.queryByText(/SQ4/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Avança ao SQ4/i)).not.toBeInTheDocument()

    // P1 destacado como Sprint Pole
    expect(screen.getByText('P1 — Sprint Pole')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-04: SQ1/SQ2/SQ3 reutilizam QualifyingPhaseView — testar comportamento
  // =========================================================================
  it('SQUI-04: SQ1/SQ2/SQ3 reutilizam QualifyingPhaseView', () => {
    const sq1State = mockPhaseState('SQ1')
    const { unmount: unmount1 } = render(<QualifyingPhaseView phase="SQ1" state={sq1State} />)
    expect(screen.getByText('Status SQ1')).toBeInTheDocument()
    unmount1()

    const sq2State = mockPhaseState('SQ2')
    const { unmount: unmount2 } = render(<QualifyingPhaseView phase="SQ2" state={sq2State} />)
    expect(screen.getByText('Status SQ2')).toBeInTheDocument()
    unmount2()

    const sq3State = mockPhaseState('SQ3')
    render(<QualifyingPhaseView phase="SQ3" state={sq3State} />)
    expect(screen.getByText('Classificação Sprint')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-05: renderizar SQ não chama RNG, pureRaceEngine, cálculo de setup, delta nem orquestrador
  // =========================================================================
  it('SQUI-05: renderizar SQ não chama RNG nem orquestrador esportivo durante a renderização', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')
    const buildSprintSpy = vi.spyOn(
      raceQualifyingOrchestratorService,
      'buildSprintQualifyingResult',
    )
    const buildGridSpy = vi.spyOn(raceQualifyingOrchestratorService, 'buildSprintStartingGrid')

    const sq1State = mockPhaseState('SQ1')
    render(<QualifyingPhaseView phase="SQ1" state={sq1State} />)

    expect(mathRandomSpy).not.toHaveBeenCalled()
    expect(buildSprintSpy).not.toHaveBeenCalled()
    expect(buildGridSpy).not.toHaveBeenCalled()
  })

  // =========================================================================
  // SQUI-06: Grid Sprint renderiza 24 participantes P1–P24 na ordem do SPRINT_STARTING_GRID
  // =========================================================================
  it('SQUI-06: Grid Sprint renderiza 24 participantes P1–P24 na ordem do SPRINT_STARTING_GRID', async () => {
    const sResult = mockSprintResult()
    const sGrid = mockSprintGrid()

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockResolvedValue(
      mockPhaseState('SQ1'),
    )
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintQualifyingResult',
    ).mockResolvedValue(sResult)
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintStartingGrid',
    ).mockResolvedValue(sGrid)

    render(
      <CanonicalQualifyingView
        careerId="test_career"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    // Aguarda carregar dados
    const gridTitle = await screen.findByText('Grid de Largada da Corrida Sprint (P1 – P24)')
    expect(gridTitle).toBeInTheDocument()
    expect(screen.getByText('24 CARROS BIJETIVO')).toBeInTheDocument()
    expect(screen.getByText('Piloto 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto 24')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-07: Grid Sprint não lê STARTING_GRID do GP; Grid Oficial do GP não lê SPRINT_STARTING_GRID
  // =========================================================================
  it('SQUI-07: isolamento estrito entre Grid Sprint e Grid GP', async () => {
    const sprintGridSpy = vi
      .spyOn(raceQualifyingOrchestratorService, 'loadPersistedSprintStartingGrid')
      .mockResolvedValue(mockSprintGrid())
    const gpGridSpy = vi
      .spyOn(raceQualifyingOrchestratorService, 'loadPersistedStartingGrid')
      .mockResolvedValue(null)

    // Renderiza variante Sprint
    const { unmount } = render(
      <CanonicalQualifyingView
        careerId="test_career"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Qualificação Sprint — Etapa 2')
    expect(sprintGridSpy).toHaveBeenCalled()
    expect(gpGridSpy).not.toHaveBeenCalled()
    unmount()

    // Renderiza variante GP Main
    sprintGridSpy.mockClear()
    gpGridSpy.mockClear()

    render(
      <CanonicalQualifyingView
        careerId="test_career"
        seasonId="2026"
        round={1}
        variant="MAIN_QUALIFYING"
      />,
    )

    await screen.findByText('Classificação Oficial — Etapa 1')
    expect(gpGridSpy).toHaveBeenCalled()
    expect(sprintGridSpy).not.toHaveBeenCalled()
  })

  // =========================================================================
  // SQUI-08: nenhuma badge de penalidade pré-Sprint criada artificialmente
  // =========================================================================
  it('SQUI-08: nenhuma badge de penalidade pré-Sprint criada artificialmente', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockResolvedValue(
      mockPhaseState('SQ1'),
    )
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintQualifyingResult',
    ).mockResolvedValue(mockSprintResult())
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintStartingGrid',
    ).mockResolvedValue(mockSprintGrid())

    render(
      <CanonicalQualifyingView
        careerId="test_career"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Grid de Largada da Corrida Sprint (P1 – P24)')
    // Não inventar badges de penalidade pré-Sprint
    expect(screen.queryByText(/posições de penalidade/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Troca de motor/i)).not.toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-09: antes de SPRINT_STARTING_GRID existir, não mostrar grid definitivo falso
  // =========================================================================
  it('SQUI-09: antes de SPRINT_STARTING_GRID existir, não mostrar grid definitivo falso', async () => {
    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockResolvedValue(
      mockPhaseState('SQ1'),
    )
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintQualifyingResult',
    ).mockResolvedValue(null)
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintStartingGrid',
    ).mockResolvedValue(null)

    render(
      <CanonicalQualifyingView
        careerId="test_career"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Fase SQ1 — 24 Carros Inscritos')
    // Grid deve estar bloqueado
    const gridTab = screen.getByRole('tab', { name: /Grid Sprint/i })
    expect(gridTab).toBeDisabled()
    expect(screen.queryByText('24 CARROS BIJETIVO')).not.toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-10: weekend NORMAL não exibe elementos Sprint
  // =========================================================================
  it('SQUI-10: weekend NORMAL não exibe elementos Sprint', () => {
    const normalFormat = resolveWeekendFormat(1) // R1 Melbourne
    expect(normalFormat).toBe('NORMAL')

    const sequence = getWeekendSlotSequence('NORMAL')
    const labels = sequence.map((s) => s.displayLabel)

    expect(labels).not.toContain('Qualificação Sprint')
    expect(labels).not.toContain('Corrida Sprint')
    expect(labels.some((l) => l.includes('Sprint'))).toBe(false)
  })

  // =========================================================================
  // SQUI-11: reload mostra exatamente os mesmos SQ1/SQ2/SQ3/Grid Sprint
  // =========================================================================
  it('SQUI-11: reload mostra exatamente os mesmos SQ1/SQ2/SQ3/Grid Sprint', async () => {
    const sq1 = mockPhaseState('SQ1')
    const sq2 = mockPhaseState('SQ2')
    const sq3 = mockPhaseState('SQ3')
    const sResult = mockSprintResult()
    const sGrid = mockSprintGrid()

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => (phase === 'SQ1' ? sq1 : phase === 'SQ2' ? sq2 : sq3),
    )
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintQualifyingResult',
    ).mockResolvedValue(sResult)
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintStartingGrid',
    ).mockResolvedValue(sGrid)

    // Render inicial
    const { unmount } = render(
      <CanonicalQualifyingView
        careerId="test_career"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Grid de Largada da Corrida Sprint (P1 – P24)')
    expect(screen.getByText('Piloto 1')).toBeInTheDocument()
    unmount()

    // "Reload"
    render(
      <CanonicalQualifyingView
        careerId="test_career"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Grid de Largada da Corrida Sprint (P1 – P24)')
    expect(screen.getByText('Piloto 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto 24')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-12: visualizar/trocar abas não altera currentSlot, slotStatus nem resultados
  // =========================================================================
  it('SQUI-12: visualizar/trocar abas não altera resultados nem consome mutações', async () => {
    const sq1 = mockPhaseState('SQ1')
    const sq2 = mockPhaseState('SQ2')
    const sq3 = mockPhaseState('SQ3')
    const sResult = mockSprintResult()
    const sGrid = mockSprintGrid()

    vi.spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState').mockImplementation(
      async (phase) => (phase === 'SQ1' ? sq1 : phase === 'SQ2' ? sq2 : sq3),
    )
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintQualifyingResult',
    ).mockResolvedValue(sResult)
    vi.spyOn(
      raceQualifyingOrchestratorService,
      'loadPersistedSprintStartingGrid',
    ).mockResolvedValue(sGrid)

    const executePhaseSpy = vi.spyOn(raceQualifyingOrchestratorService, 'executeQualifyingPhase')
    const buildSprintSpy = vi.spyOn(
      raceQualifyingOrchestratorService,
      'buildSprintQualifyingResult',
    )

    render(
      <CanonicalQualifyingView
        careerId="test_career"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Grid de Largada da Corrida Sprint (P1 – P24)')

    // Alternar abas
    const sq1Tab = screen.getByRole('tab', { name: /SQ1/i })
    fireEvent.click(sq1Tab)
    expect(screen.getByText('Fase SQ1 — 24 Carros Inscritos')).toBeInTheDocument()

    const sq2Tab = screen.getByRole('tab', { name: /SQ2/i })
    fireEvent.click(sq2Tab)
    expect(screen.getByText('Fase SQ2 — Somente os 18 Classificados')).toBeInTheDocument()

    const sq3Tab = screen.getByRole('tab', { name: /SQ3/i })
    fireEvent.click(sq3Tab)
    expect(
      screen.getByText(/Fase SQ3 — Os 10 Finalistas \(Pole da Corrida Sprint\)/i),
    ).toBeInTheDocument()

    // Nenhuma mutação disparada
    expect(executePhaseSpy).not.toHaveBeenCalled()
    expect(buildSprintSpy).not.toHaveBeenCalled()
  })
})
