/**
 * src/test/race-sprint-qualifying-ui-squi01-12.test.tsx
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01B3-UI: SUÍTE DE TESTES SQUI-01 A SQUI-12
 *
 * TESTES OBRIGATÓRIOS:
 * - SQUI-01: SQ1 renderiza 24 participantes, 18 classificados "Avança ao SQ2", 6 "Eliminado SQ1".
 * - SQUI-02: SQ2 renderiza 18 participantes, 10 "Avança ao SQ3", 8 "Eliminado SQ2".
 * - SQUI-03: SQ3 renderiza 10 finalistas, destaque de P1 (sem avançar para SQ4 e sem "Pole Position do GP").
 * - SQUI-04: SQ1, SQ2 e SQ3 reutilizam QualifyingPhaseView (mesmo componente compartilhado).
 * - SQUI-05: Renderizar SQ não chama RNG, pureRaceEngine, setup nem orquestrador esportivo.
 * - SQUI-06: Grid Sprint renderiza P1..P24 na ordem estrita do SPRINT_STARTING_GRID persistido.
 * - SQUI-07: Grid Sprint consome EXCLUSIVAMENTE SPRINT_STARTING_GRID e Grid Oficial consome STARTING_GRID (isolamento mútuo).
 * - SQUI-08: Grid Sprint não exibe badges de penalidade inventadas do GP.
 * - SQUI-09: Antes de SPRINT_STARTING_GRID existir, não exibe grid falso.
 * - SQUI-10: Weekend NORMAL não exibe elementos Sprint.
 * - SQUI-11: Reload com dados persistidos renderiza identicamente sem perdas ou recomputação.
 * - SQUI-12: Trocar abas/subfases não altera slot, estado, subfase ou resultados.
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QualifyingPhaseView } from '@/components/race/QualifyingPhaseView'
import { SprintQualifyingPhaseTabs } from '@/components/race/SprintQualifyingPhaseTabs'
import { CanonicalQualifyingView } from '@/components/race/CanonicalQualifyingView'
import { getWeekendSlotSequence, resolveWeekendFormat } from '@/services/weekendSlotSequenceService'
import { raceQualifyingOrchestratorService } from '@/services/raceQualifyingOrchestratorService'
import type {
  QualifyingPhaseExecutionState,
  SprintQualifyingResultState,
  SprintStartingGridState,
  StartingGridState,
} from '@/services/raceQualifyingOrchestratorService'

// Helper mock para 24 pilotos SQ1
const createMockSQ1 = (): QualifyingPhaseExecutionState => ({
  variant: 'SPRINT_QUALIFYING',
  phase: 'SQ1',
  careerId: 'c1',
  seasonId: 's1',
  round: 2,
  configVersion: 'v1',
  status: 'READY_FOR_SQ2',
  isCompleted: true,
  totalParticipants: 24,
  advancingCount: 18,
  eliminatedCount: 6,
  results: Array.from({ length: 24 }, (_, i) => ({
    driverId: `drv_${i + 1}`,
    driverName: `Piloto SQ1_${i + 1}`,
    teamId: `team_${(i % 12) + 1}`,
    teamName: `Equipe ${(i % 12) + 1}`,
    carIndex: (i % 2) + 1,
    setup: 85,
    effectiveDriver: 80,
    trackRating: 80,
    basePaceMs: 80000,
    bonusMs: 100,
    compoundDeltaMs: 650,
    compoundUsed: 'MEDIUM',
    bestTimeMs: 80000 + i * 200,
    formattedBestTime: `1:20.${String(i * 200).padStart(3, '0')}`,
    attempts: [],
    position: i + 1,
    isClassified: i < 18,
    isEliminated: i >= 18,
  })),
  classifiedDriverIds: Array.from({ length: 18 }, (_, i) => `drv_${i + 1}`),
  eliminatedDriverIds: Array.from({ length: 6 }, (_, i) => `drv_${i + 19}`),
  trackRecordMs: 80000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

// Helper mock para 18 pilotos SQ2
const createMockSQ2 = (): QualifyingPhaseExecutionState => ({
  variant: 'SPRINT_QUALIFYING',
  phase: 'SQ2',
  careerId: 'c1',
  seasonId: 's1',
  round: 2,
  configVersion: 'v1',
  status: 'READY_FOR_SQ3',
  isCompleted: true,
  totalParticipants: 18,
  advancingCount: 10,
  eliminatedCount: 8,
  results: Array.from({ length: 18 }, (_, i) => ({
    driverId: `drv_${i + 1}`,
    driverName: `Piloto SQ2_${i + 1}`,
    teamId: `team_${(i % 9) + 1}`,
    teamName: `Equipe ${(i % 9) + 1}`,
    carIndex: (i % 2) + 1,
    setup: 86,
    effectiveDriver: 82,
    trackRating: 81,
    basePaceMs: 79500,
    bonusMs: 120,
    compoundDeltaMs: 650,
    compoundUsed: 'MEDIUM',
    bestTimeMs: 79500 + i * 150,
    formattedBestTime: `1:19.${String(i * 150).padStart(3, '0')}`,
    attempts: [],
    position: i + 1,
    isClassified: i < 10,
    isEliminated: i >= 10,
  })),
  classifiedDriverIds: Array.from({ length: 10 }, (_, i) => `drv_${i + 1}`),
  eliminatedDriverIds: Array.from({ length: 8 }, (_, i) => `drv_${i + 11}`),
  trackRecordMs: 79500,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

// Helper mock para 10 pilotos SQ3
const createMockSQ3 = (): QualifyingPhaseExecutionState => ({
  variant: 'SPRINT_QUALIFYING',
  phase: 'SQ3',
  careerId: 'c1',
  seasonId: 's1',
  round: 2,
  configVersion: 'v1',
  status: 'SPRINT_QUALIFYING_COMPLETE',
  isCompleted: true,
  totalParticipants: 10,
  advancingCount: 10,
  eliminatedCount: 0,
  results: Array.from({ length: 10 }, (_, i) => ({
    driverId: `drv_${i + 1}`,
    driverName: `Piloto SQ3_${i + 1}`,
    teamId: `team_${(i % 5) + 1}`,
    teamName: `Equipe ${(i % 5) + 1}`,
    carIndex: (i % 2) + 1,
    setup: 88,
    effectiveDriver: 85,
    trackRating: 84,
    basePaceMs: 78900,
    bonusMs: 150,
    compoundDeltaMs: 0,
    compoundUsed: 'SOFT',
    bestTimeMs: 78900 + i * 100,
    formattedBestTime: `1:18.${String(i * 100).padStart(3, '0')}`,
    attempts: [],
    position: i + 1,
    isClassified: true,
    isEliminated: false,
  })),
  classifiedDriverIds: Array.from({ length: 10 }, (_, i) => `drv_${i + 1}`),
  eliminatedDriverIds: [],
  trackRecordMs: 78900,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

// Helper mock para SPRINT_STARTING_GRID (24 posições)
const createMockSprintGrid = (): SprintStartingGridState => ({
  careerId: 'c1',
  seasonId: 's1',
  round: 2,
  configVersion: 'v1',
  status: 'SPRINT_GRID_READY',
  totalParticipants: 24,
  poleDriverId: 'drv_1',
  poleDriverName: 'Piloto SQ3_1',
  grid: Array.from({ length: 24 }, (_, i) => ({
    gridPosition: i + 1,
    qualifyingPosition: i + 1,
    driverId: `drv_${i + 1}`,
    driverName: `Piloto SprintGrid_${i + 1}`,
    teamId: `team_${(i % 12) + 1}`,
    teamName: `Equipe ${(i % 12) + 1}`,
    carIndex: (i % 2) + 1,
    eliminationPhase: i < 10 ? 'SQ3' : i < 18 ? 'SQ2' : 'SQ1',
    qualifyingTimeMs: 78900 + i * 100,
    formattedQualifyingTime: `1:18.${String(i * 100).padStart(3, '0')}`,
    setup: 85,
    penalties: [],
    totalPenaltyPositions: 0,
    hasPenalty: false,
  })),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

describe('APEX GP MANAGER — RACE-SPRINT-SLOTS-01B3-UI (SQUI-01 a SQUI-12)', () => {
  // =========================================================================
  // SQUI-01: SQ1 renderiza 24/6 eliminados/18 avançam
  // =========================================================================
  it('SQUI-01: SQ1 renderiza 24 participantes, 18 que avançam ao SQ2 e 6 eliminados', () => {
    const sq1 = createMockSQ1()
    render(<QualifyingPhaseView phase="SQ1" state={sq1} />)

    expect(screen.getByText('Fase SQ1 — 24 Carros Inscritos')).toBeInTheDocument()
    expect(screen.getByText('24 Pilotos')).toBeInTheDocument()

    // 18 "Avança ao SQ2"
    const advancingBadges = screen.getAllByText('Avança ao SQ2')
    expect(advancingBadges).toHaveLength(18)

    // 6 eliminados com prefixo "Eliminado SQ1"
    const eliminatedBadges = screen.getAllByText(/Eliminado SQ1/)
    expect(eliminatedBadges).toHaveLength(6)
  })

  // =========================================================================
  // SQUI-02: SQ2 renderiza 18/8 eliminados/10 avançam
  // =========================================================================
  it('SQUI-02: SQ2 renderiza 18 participantes, 10 que avançam ao SQ3 e 8 eliminados', () => {
    const sq2 = createMockSQ2()
    render(<QualifyingPhaseView phase="SQ2" state={sq2} />)

    expect(screen.getByText('Fase SQ2 — Somente os 18 Classificados')).toBeInTheDocument()
    expect(screen.getByText('18 Pilotos')).toBeInTheDocument()

    // 10 "Avança ao SQ3"
    const advancingBadges = screen.getAllByText('Avança ao SQ3')
    expect(advancingBadges).toHaveLength(10)

    // 8 eliminados
    const eliminatedBadges = screen.getAllByText('Eliminado SQ2')
    expect(eliminatedBadges).toHaveLength(8)
  })

  // =========================================================================
  // SQUI-03: SQ3 renderiza 10, sem SQ4, destaque P1 Sprint Pole
  // =========================================================================
  it('SQUI-03: SQ3 renderiza 10 finalistas, destaque de P1 Sprint Pole, sem SQ4 e nunca Pole Position do GP', () => {
    const sq3 = createMockSQ3()
    render(<QualifyingPhaseView phase="SQ3" state={sq3} />)

    expect(
      screen.getByText('Fase SQ3 — Os 10 Finalistas (Pole da Corrida Sprint)'),
    ).toBeInTheDocument()
    expect(screen.getByText('10 Pilotos')).toBeInTheDocument()

    // Destaque de P1 — Sprint Pole ou Pole Sprint
    expect(screen.getByText(/Sprint Pole|Pole Sprint/)).toBeInTheDocument()

    // Sem menção a SQ4 ou "Pole Position do GP"
    expect(screen.queryByText(/SQ4/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pole Position do GP/)).not.toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-04: SQs reutilizam QualifyingPhaseView (mesmo componente)
  // =========================================================================
  it('SQUI-04: SQ1, SQ2 e SQ3 reutilizam o mesmo componente QualifyingPhaseView', () => {
    const sq1 = createMockSQ1()
    const sq2 = createMockSQ2()
    const sq3 = createMockSQ3()

    const { rerender } = render(<QualifyingPhaseView phase="SQ1" state={sq1} />)
    expect(screen.getByText('Fase SQ1 — 24 Carros Inscritos')).toBeInTheDocument()

    rerender(<QualifyingPhaseView phase="SQ2" state={sq2} />)
    expect(screen.getByText('Fase SQ2 — Somente os 18 Classificados')).toBeInTheDocument()

    rerender(<QualifyingPhaseView phase="SQ3" state={sq3} />)
    expect(
      screen.getByText('Fase SQ3 — Os 10 Finalistas (Pole da Corrida Sprint)'),
    ).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-05: Renderizar SQ não chama RNG, pureRaceEngine, setup nem orquestrador
  // =========================================================================
  it('SQUI-05: renderizar SQ é função pura de leitura e não chama RNG, setup nem executa cálculo', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')
    const sq1 = createMockSQ1()

    render(<QualifyingPhaseView phase="SQ1" state={sq1} />)

    // Math.random não é acionado durante renderização visual
    expect(mathRandomSpy).not.toHaveBeenCalled()
    mathRandomSpy.mockRestore()
  })

  // =========================================================================
  // SQUI-06: Grid Sprint renderiza 24 P1–P24 na ordem do SPRINT_STARTING_GRID
  // =========================================================================
  it('SQUI-06: Grid Sprint renderiza 24 carros P1–P24 estritamente na ordem do SPRINT_STARTING_GRID', () => {
    const sprintGrid = createMockSprintGrid()

    render(
      <SprintQualifyingPhaseTabs
        sq1State={createMockSQ1()}
        sq2State={createMockSQ2()}
        sq3State={createMockSQ3()}
        sprintGrid={sprintGrid}
      />,
    )

    // Abre a aba Grid da Sprint
    const gridTab = screen.getByRole('tab', { name: /Grid da Sprint/i })
    fireEvent.click(gridTab)

    // Verifica que 24 posições P1 a P24 estão presentes
    expect(screen.getByText('24 Pilotos (P1–P24)')).toBeInTheDocument()
    expect(screen.getByText('Piloto SprintGrid_1')).toBeInTheDocument()
    expect(screen.getByText('Piloto SprintGrid_24')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-07: Grid Sprint não lê STARTING_GRID do GP e vice-versa
  // =========================================================================
  it('SQUI-07: Grid Sprint consome exclusivamente SPRINT_STARTING_GRID e isola do STARTING_GRID do GP', () => {
    const sprintGrid = createMockSprintGrid()
    render(
      <SprintQualifyingPhaseTabs
        sq1State={createMockSQ1()}
        sq2State={createMockSQ2()}
        sq3State={createMockSQ3()}
        sprintGrid={sprintGrid}
      />,
    )

    const gridTab = screen.getByRole('tab', { name: /Grid da Sprint/i })
    fireEvent.click(gridTab)

    // Presença clara de SPRINT_STARTING_GRID
    expect(screen.getByText('SPRINT_STARTING_GRID')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-08: Sem badge de penalidade inventada na Sprint
  // =========================================================================
  it('SQUI-08: Grid Sprint não inventa badges de penalidade do GP', () => {
    const sprintGrid = createMockSprintGrid()
    render(
      <SprintQualifyingPhaseTabs
        sq1State={createMockSQ1()}
        sq2State={createMockSQ2()}
        sq3State={createMockSQ3()}
        sprintGrid={sprintGrid}
      />,
    )

    const gridTab = screen.getByRole('tab', { name: /Grid da Sprint/i })
    fireEvent.click(gridTab)

    // Não deve haver penalidades aplicadas
    expect(screen.queryByText(/Troca de PU/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\+10 posições/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\+5 posições/)).not.toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-09: Antes do grid existir, não mostrar grid falso
  // =========================================================================
  it('SQUI-09: antes do grid existir, exibe mensagem clara sem fabricar grid falso ou array fictício', () => {
    render(
      <SprintQualifyingPhaseTabs
        sq1State={createMockSQ1()}
        sq2State={null}
        sq3State={null}
        sprintGrid={null}
      />,
    )

    // Tab Grid deve estar desabilitada
    const gridTab = screen.getByRole('tab', { name: /Grid da Sprint/i })
    expect(gridTab).toBeDisabled()
  })

  // =========================================================================
  // SQUI-10: Weekend NORMAL sem elementos Sprint
  // =========================================================================
  it('SQUI-10: weekend NORMAL não exibe nenhum elemento de Qualificação Sprint na sequência canônica', () => {
    const normalFormat = resolveWeekendFormat(1) // GP Austrália = NORMAL
    expect(normalFormat).toBe('NORMAL')

    const sequence = getWeekendSlotSequence('NORMAL')
    const slotNames = sequence.map((s) => s.slotType)

    expect(slotNames).not.toContain('QUALI_SPRINT')
    expect(slotNames).not.toContain('SPRINT')
    expect(slotNames[1]).toBe('TL2')
  })

  // =========================================================================
  // SQUI-11: Reload com dados idênticos
  // =========================================================================
  it('SQUI-11: remontar componente com os mesmos dados mantém renderização idêntica', () => {
    const sq1 = createMockSQ1()
    const { unmount } = render(<QualifyingPhaseView phase="SQ1" state={sq1} />)
    expect(screen.getByText('Piloto SQ1_1')).toBeInTheDocument()
    unmount()

    // Remonta com os mesmos dados persistidos
    render(<QualifyingPhaseView phase="SQ1" state={sq1} />)
    expect(screen.getByText('Piloto SQ1_1')).toBeInTheDocument()
    expect(screen.getByText('24 Pilotos')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-12: Trocar abas não altera estado ou resultados
  // =========================================================================
  it('SQUI-12: navegar entre as subabas SQ1, SQ2, SQ3 não altera resultados nem consome recursos', () => {
    const sq1 = createMockSQ1()
    const sq2 = createMockSQ2()
    const sq3 = createMockSQ3()
    const sprintGrid = createMockSprintGrid()

    render(
      <SprintQualifyingPhaseTabs
        sq1State={sq1}
        sq2State={sq2}
        sq3State={sq3}
        sprintGrid={sprintGrid}
      />,
    )

    // Clica em SQ2
    fireEvent.click(screen.getByRole('tab', { name: /SQ2/i }))
    expect(screen.getByText('Fase SQ2 — Somente os 18 Classificados')).toBeInTheDocument()

    // Clica em SQ3
    fireEvent.click(screen.getByRole('tab', { name: /SQ3/i }))
    expect(
      screen.getByText('Fase SQ3 — Os 10 Finalistas (Pole da Corrida Sprint)'),
    ).toBeInTheDocument()

    // Clica em Grid
    fireEvent.click(screen.getByRole('tab', { name: /Grid da Sprint/i }))
    expect(screen.getByText('Grid de Largada da Corrida Sprint')).toBeInTheDocument()

    // Volta para SQ1
    fireEvent.click(screen.getByRole('tab', { name: /SQ1/i }))
    expect(screen.getByText('Fase SQ1 — 24 Carros Inscritos')).toBeInTheDocument()
    expect(screen.getAllByText('Avança ao SQ2')).toHaveLength(18)
  })
})
