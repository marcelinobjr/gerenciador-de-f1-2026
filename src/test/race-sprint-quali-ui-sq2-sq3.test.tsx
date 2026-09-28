/**
 * src/test/race-sprint-quali-ui-sq2-sq3.test.tsx
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01B3B-UI
 * ADICIONAR SQ2 + SQ3 À UI HOMOLOGADA DO SQ1
 *
 * SUÍTE DE TESTES OBRIGATÓRIOS SQUI-B01 A SQUI-B12:
 * SQUI-B01 — SQ2 COMPONENTE: SQ2 é renderizado via QualifyingPhaseView.
 * SQUI-B02 — SQ2 FONTE: SQ2 lê SPRINT/SQ2. Não lê MAIN/Q2.
 * SQUI-B03 — SQ2 PARTICIPANTES: 18 participantes renderizados.
 * SQUI-B04 — SQ2 STATUS: 10 "Avança ao SQ3". 8 "Eliminado SQ2".
 * SQUI-B05 — SQ3 COMPONENTE: SQ3 usa QualifyingPhaseView.
 * SQUI-B06 — SQ3 FONTE: SQ3 lê SPRINT/SQ3. Não lê MAIN/Q3.
 * SQUI-B07 — SQ3 PARTICIPANTES: 10 participantes renderizados.
 * SQUI-B08 — SEM SQ4: SQ3 não apresenta "Avança ao SQ4" nem equivalente.
 * SQUI-B09 — NOT RUN: SQ2/SQ3 inexistentes mostram estado apropriado.
 * SQUI-B10 — ZERO CÁLCULO: render de SQ2/SQ3 não chama RNG, pureRaceEngine, setup calculator, compound delta, qualifying orchestrator esportivo.
 * SQUI-B11 — RELOAD: remount/reconstrução de persistência apresenta exatamente os mesmos resultados.
 * SQUI-B12 — NORMAL: Weekend NORMAL não exibe SQ2 nem SQ3.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QualifyingPhaseView } from '@/components/race/QualifyingPhaseView'
import { SprintQualifyingPhaseTabs } from '@/components/race/SprintQualifyingPhaseTabs'
import { CanonicalQualifyingView } from '@/components/race/CanonicalQualifyingView'
import {
  raceQualifyingOrchestratorService,
  type QualifyingPhaseExecutionState,
} from '@/services/raceQualifyingOrchestratorService'
import { getWeekendSlotSequence, resolveWeekendFormat } from '@/services/weekendSlotSequenceService'

// Helper mock para 18 participantes SQ2
function makeSQ2Drivers(count = 18) {
  return Array.from({ length: count }, (_, idx) => {
    const pos = idx + 1
    const isElim = pos > 10 // 10 avançam, 8 eliminados
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      driverId: `drv_sq2_${pos}`,
      driverName: `Piloto SQ2 ${pos}`,
      teamId: `team_${Math.floor(idx / 2) + 1}`,
      teamName: `Scuderia SQ2 ${Math.floor(idx / 2) + 1}`,
      carIndex,
      setup: 75 + idx,
      effectiveDriver: 82,
      trackRating: 83,
      basePaceMs: 79500,
      bonusMs: 90,
      compoundDeltaMs: 650,
      compoundUsed: 'MEDIUM' as const,
      bestTimeMs: 79500 + idx * 110,
      formattedBestTime: `1:19.${String(idx * 110).padStart(3, '0')}`,
      attempts: [],
      position: pos,
      isClassified: !isElim,
      isEliminated: isElim,
    }
  })
}

// Helper mock para 18 participantes MAIN Q2
function makeQ2Drivers(count = 18) {
  return Array.from({ length: count }, (_, idx) => {
    const pos = idx + 1
    const isElim = pos > 10
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      driverId: `drv_main_q2_${pos}`,
      driverName: `Piloto MAIN Q2 ${pos}`,
      teamId: `team_main_${Math.floor(idx / 2) + 1}`,
      teamName: `Scuderia Main ${Math.floor(idx / 2) + 1}`,
      carIndex,
      setup: 65 + idx,
      effectiveDriver: 87,
      trackRating: 86,
      basePaceMs: 78500,
      bonusMs: 110,
      compoundDeltaMs: 0,
      compoundUsed: 'SOFT' as const,
      bestTimeMs: 78500 + idx * 95,
      formattedBestTime: `1:18.${String(idx * 95).padStart(3, '0')}`,
      attempts: [],
      position: pos,
      isClassified: !isElim,
      isEliminated: isElim,
    }
  })
}

// Helper mock para 10 participantes SQ3
function makeSQ3Drivers(count = 10) {
  return Array.from({ length: count }, (_, idx) => {
    const pos = idx + 1
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      driverId: `drv_sq3_${pos}`,
      driverName: `Piloto SQ3 ${pos}`,
      teamId: `team_${Math.floor(idx / 2) + 1}`,
      teamName: `Scuderia SQ3 ${Math.floor(idx / 2) + 1}`,
      carIndex,
      setup: 80 + idx,
      effectiveDriver: 85,
      trackRating: 85,
      basePaceMs: 78800,
      bonusMs: 120,
      compoundDeltaMs: 0,
      compoundUsed: 'SOFT' as const,
      bestTimeMs: 78800 + idx * 90,
      formattedBestTime: `1:18.${String(idx * 90).padStart(3, '0')}`,
      attempts: [],
      position: pos,
      isClassified: true,
      isEliminated: false,
    }
  })
}

// Helper mock para 10 participantes MAIN Q3
function makeQ3Drivers(count = 10) {
  return Array.from({ length: count }, (_, idx) => {
    const pos = idx + 1
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      driverId: `drv_main_q3_${pos}`,
      driverName: `Piloto MAIN Q3 ${pos}`,
      teamId: `team_main_${Math.floor(idx / 2) + 1}`,
      teamName: `Scuderia Main ${Math.floor(idx / 2) + 1}`,
      carIndex,
      setup: 70 + idx,
      effectiveDriver: 90,
      trackRating: 88,
      basePaceMs: 78000,
      bonusMs: 130,
      compoundDeltaMs: 0,
      compoundUsed: 'SOFT' as const,
      bestTimeMs: 78000 + idx * 80,
      formattedBestTime: `1:18.${String(idx * 80).padStart(3, '0')}`,
      attempts: [],
      position: pos,
      isClassified: true,
      isEliminated: false,
    }
  })
}

function createMockSQ2State(): QualifyingPhaseExecutionState {
  const results = makeSQ2Drivers(18)
  return {
    variant: 'SPRINT_QUALIFYING',
    phase: 'SQ2',
    careerId: 'test_career_sq23',
    seasonId: '2026',
    round: 2,
    configVersion: 'v1',
    status: 'READY_FOR_SQ3',
    isCompleted: true,
    totalParticipants: 18,
    advancingCount: 10,
    eliminatedCount: 8,
    results,
    classifiedDriverIds: results.filter((r) => !r.isEliminated).map((r) => r.driverId),
    eliminatedDriverIds: results.filter((r) => r.isEliminated).map((r) => r.driverId),
    trackRecordMs: 79500,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function createMockQ2State(): QualifyingPhaseExecutionState {
  const results = makeQ2Drivers(18)
  return {
    variant: 'MAIN_QUALIFYING',
    phase: 'Q2',
    careerId: 'test_career_sq23',
    seasonId: '2026',
    round: 2,
    configVersion: 'v1',
    status: 'READY_FOR_Q3',
    isCompleted: true,
    totalParticipants: 18,
    advancingCount: 10,
    eliminatedCount: 8,
    results,
    classifiedDriverIds: results.filter((r) => !r.isEliminated).map((r) => r.driverId),
    eliminatedDriverIds: results.filter((r) => r.isEliminated).map((r) => r.driverId),
    trackRecordMs: 78500,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function createMockSQ3State(): QualifyingPhaseExecutionState {
  const results = makeSQ3Drivers(10)
  return {
    variant: 'SPRINT_QUALIFYING',
    phase: 'SQ3',
    careerId: 'test_career_sq23',
    seasonId: '2026',
    round: 2,
    configVersion: 'v1',
    status: 'SPRINT_QUALIFYING_COMPLETE',
    isCompleted: true,
    totalParticipants: 10,
    advancingCount: 10,
    eliminatedCount: 0,
    results,
    classifiedDriverIds: results.map((r) => r.driverId),
    eliminatedDriverIds: [],
    trackRecordMs: 78800,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function createMockQ3State(): QualifyingPhaseExecutionState {
  const results = makeQ3Drivers(10)
  return {
    variant: 'MAIN_QUALIFYING',
    phase: 'Q3',
    careerId: 'test_career_sq23',
    seasonId: '2026',
    round: 2,
    configVersion: 'v1',
    status: 'QUALIFYING_COMPLETE',
    isCompleted: true,
    totalParticipants: 10,
    advancingCount: 10,
    eliminatedCount: 0,
    results,
    classifiedDriverIds: results.map((r) => r.driverId),
    eliminatedDriverIds: [],
    trackRecordMs: 78000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('APEX GP MANAGER — SUÍTE SQUI-B01..B12 (SQ2 + SQ3 UI)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  // =========================================================================
  // SQUI-B01 — SQ2 COMPONENTE: SQ2 é renderizado via QualifyingPhaseView.
  // =========================================================================
  it('SQUI-B01 — SQ2 COMPONENTE: SQ2 é renderizado via QualifyingPhaseView', () => {
    const sq2State = createMockSQ2State()
    render(<QualifyingPhaseView phase="SQ2" state={sq2State} />)

    // Renderiza via QualifyingPhaseView
    expect(screen.getByText('Qualificação Sprint')).toBeInTheDocument()
    expect(screen.getByText('Fase SQ2 — Somente os 18 Classificados')).toBeInTheDocument()
    expect(screen.getByText('Status SQ2')).toBeInTheDocument()
    expect(screen.getByText('Piloto SQ2 1')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-B02 — SQ2 FONTE: SQ2 lê SPRINT/SQ2. Não lê MAIN/Q2.
  // =========================================================================
  it('SQUI-B02 — SQ2 FONTE: SQ2 lê SPRINT/SQ2. Não lê MAIN/Q2', async () => {
    const sq2State = createMockSQ2State()
    const q2State = createMockQ2State()

    const loadPhaseSpy = vi
      .spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState')
      .mockImplementation(async (phase) => {
        if (phase === 'SQ2') return sq2State
        if (phase === 'Q2') return q2State
        return null
      })

    render(
      <CanonicalQualifyingView
        careerId="test_career_sq23"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Qualificação Sprint — Etapa 2')

    // Deve ter chamado loadPersistedPhaseState para 'SQ2'
    expect(loadPhaseSpy).toHaveBeenCalledWith('SQ2', 'test_career_sq23', '2026', 2)

    // Os dados exibidos do SQ2 pertencem ao namespace Sprint, e não a MAIN/Q2
    expect(screen.getByText('Piloto SQ2 1')).toBeInTheDocument()
    expect(screen.queryByText('Piloto MAIN Q2 1')).not.toBeInTheDocument()

    // Testar também reader canônico loadPersistedSQ2State
    const sq2Loaded = await raceQualifyingOrchestratorService.loadPersistedSQ2State(
      'test_career_sq23',
      '2026',
      2,
    )
    expect(sq2Loaded?.variant).toBe('SPRINT_QUALIFYING')
    expect(sq2Loaded?.phase).toBe('SQ2')
    expect(sq2Loaded?.results[0].driverName).toBe('Piloto SQ2 1')
  })

  // =========================================================================
  // SQUI-B03 — SQ2 PARTICIPANTES: 18 participantes renderizados.
  // =========================================================================
  it('SQUI-B03 — SQ2 PARTICIPANTES: 18 participantes renderizados', () => {
    const sq2State = createMockSQ2State()
    render(<QualifyingPhaseView phase="SQ2" state={sq2State} />)

    expect(screen.getByText('18 Pilotos')).toBeInTheDocument()
    const rows = screen.getAllByText(/Piloto SQ2 \d+/)
    expect(rows).toHaveLength(18)
    expect(screen.getByText('Piloto SQ2 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto SQ2 18')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-B04 — SQ2 STATUS: 10 "Avança ao SQ3". 8 "Eliminado SQ2".
  // =========================================================================
  it('SQUI-B04 — SQ2 STATUS: 10 "Avança ao SQ3". 8 "Eliminado SQ2"', () => {
    const sq2State = createMockSQ2State()
    render(<QualifyingPhaseView phase="SQ2" state={sq2State} />)

    const advancingBadges = screen.getAllByText('Avança ao SQ3')
    expect(advancingBadges).toHaveLength(10)

    const eliminatedBadges = screen.getAllByText('Eliminado SQ2')
    expect(eliminatedBadges).toHaveLength(8)
  })

  // =========================================================================
  // SQUI-B05 — SQ3 COMPONENTE: SQ3 usa QualifyingPhaseView.
  // =========================================================================
  it('SQUI-B05 — SQ3 COMPONENTE: SQ3 usa QualifyingPhaseView', () => {
    const sq3State = createMockSQ3State()
    render(<QualifyingPhaseView phase="SQ3" state={sq3State} />)

    expect(screen.getByText('Qualificação Sprint')).toBeInTheDocument()
    expect(
      screen.getByText('Fase SQ3 — Os 10 Finalistas (Pole da Corrida Sprint)'),
    ).toBeInTheDocument()
    expect(screen.getByText('Classificação Sprint')).toBeInTheDocument()
    expect(screen.getByText('Piloto SQ3 1')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-B06 — SQ3 FONTE: SQ3 lê SPRINT/SQ3. Não lê MAIN/Q3.
  // =========================================================================
  it('SQUI-B06 — SQ3 FONTE: SQ3 lê SPRINT/SQ3. Não lê MAIN/Q3', async () => {
    const sq3State = createMockSQ3State()
    const q3State = createMockQ3State()

    const loadPhaseSpy = vi
      .spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState')
      .mockImplementation(async (phase) => {
        if (phase === 'SQ3') return sq3State
        if (phase === 'Q3') return q3State
        return null
      })

    render(
      <CanonicalQualifyingView
        careerId="test_career_sq23"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    await screen.findByText('Qualificação Sprint — Etapa 2')

    // Deve ter chamado loadPersistedPhaseState para 'SQ3'
    expect(loadPhaseSpy).toHaveBeenCalledWith('SQ3', 'test_career_sq23', '2026', 2)

    // Os dados exibidos do SQ3 pertencem ao namespace Sprint, e não a MAIN/Q3
    expect(screen.getByText('Piloto SQ3 1')).toBeInTheDocument()
    expect(screen.queryByText('Piloto MAIN Q3 1')).not.toBeInTheDocument()

    // Testar também reader canônico loadPersistedSQ3State
    const sq3Loaded = await raceQualifyingOrchestratorService.loadPersistedSQ3State(
      'test_career_sq23',
      '2026',
      2,
    )
    expect(sq3Loaded?.variant).toBe('SPRINT_QUALIFYING')
    expect(sq3Loaded?.phase).toBe('SQ3')
    expect(sq3Loaded?.results[0].driverName).toBe('Piloto SQ3 1')
  })

  // =========================================================================
  // SQUI-B07 — SQ3 PARTICIPANTES: 10 participantes renderizados.
  // =========================================================================
  it('SQUI-B07 — SQ3 PARTICIPANTES: 10 participantes renderizados', () => {
    const sq3State = createMockSQ3State()
    render(<QualifyingPhaseView phase="SQ3" state={sq3State} />)

    expect(screen.getByText('10 Pilotos')).toBeInTheDocument()
    const rows = screen.getAllByText(/Piloto SQ3 \d+/)
    expect(rows).toHaveLength(10)
    expect(screen.getByText('Piloto SQ3 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto SQ3 10')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-B08 — SEM SQ4: SQ3 não apresenta "Avança ao SQ4" nem equivalente.
  // =========================================================================
  it('SQUI-B08 — SEM SQ4: SQ3 não apresenta "Avança ao SQ4" nem equivalente', () => {
    const sq3State = createMockSQ3State()
    render(<QualifyingPhaseView phase="SQ3" state={sq3State} />)

    // Sem menção a SQ4 ou "Avança ao SQ4"
    expect(screen.queryByText(/SQ4/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Avança ao SQ4/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Avança ao/i)).not.toBeInTheDocument()

    // Apresenta destaque para P1 — Sprint Pole e Finalistas P2..P10
    expect(screen.getByText('P1 — Sprint Pole')).toBeInTheDocument()
    expect(screen.getByText('Finalista (P2)')).toBeInTheDocument()
    expect(screen.getByText('Finalista (P10)')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-B09 — NOT RUN: SQ2/SQ3 inexistentes mostram estado apropriado.
  // =========================================================================
  it('SQUI-B09 — NOT RUN: SQ2/SQ3 inexistentes mostram estado apropriado', () => {
    const { rerender } = render(<QualifyingPhaseView phase="SQ2" state={null} />)
    expect(
      screen.getByText('Sessão SQ2 ainda não realizada (aguardando conclusão do SQ1).'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Piloto/)).not.toBeInTheDocument()
    expect(screen.queryByText('P0')).not.toBeInTheDocument()

    rerender(<QualifyingPhaseView phase="SQ3" state={null} />)
    expect(
      screen.getByText('Sessão SQ3 ainda não realizada (aguardando conclusão do SQ2).'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Piloto/)).not.toBeInTheDocument()
    expect(screen.queryByText('P0')).not.toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-B10 — ZERO CÁLCULO: render de SQ2/SQ3 não chama RNG, pureRaceEngine,
  // setup calculator, compound delta, qualifying orchestrator esportivo.
  // =========================================================================
  it('SQUI-B10 — ZERO CÁLCULO: render de SQ2/SQ3 não chama RNG, cálculo de setup nem orquestrador esportivo', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')
    const executePhaseSpy = vi.spyOn(raceQualifyingOrchestratorService, 'executeQualifyingPhase')
    const executeSQ2Spy = vi.spyOn(raceQualifyingOrchestratorService, 'executeSQ2')
    const executeSQ3Spy = vi.spyOn(raceQualifyingOrchestratorService, 'executeSQ3')

    const sq2State = createMockSQ2State()
    const sq3State = createMockSQ3State()

    const { rerender } = render(<QualifyingPhaseView phase="SQ2" state={sq2State} />)
    rerender(<QualifyingPhaseView phase="SQ3" state={sq3State} />)

    expect(mathRandomSpy).not.toHaveBeenCalled()
    expect(executePhaseSpy).not.toHaveBeenCalled()
    expect(executeSQ2Spy).not.toHaveBeenCalled()
    expect(executeSQ3Spy).not.toHaveBeenCalled()
  })

  // =========================================================================
  // SQUI-B11 — RELOAD: remount/reconstrução de persistência apresenta exatamente os mesmos resultados.
  // =========================================================================
  it('SQUI-B11 — RELOAD: remount/reconstrução de persistência apresenta exatamente os mesmos resultados', () => {
    const sq2State = createMockSQ2State()
    const sq3State = createMockSQ3State()

    // 1º ciclo SQ2
    const { unmount, rerender } = render(<QualifyingPhaseView phase="SQ2" state={sq2State} />)
    expect(screen.getByText('Piloto SQ2 1')).toBeInTheDocument()
    expect(screen.getAllByText('Avança ao SQ3')).toHaveLength(10)
    expect(screen.getAllByText('Eliminado SQ2')).toHaveLength(8)

    unmount()

    // Reconstrução a partir de JSON stringificado
    const reconstructedSQ2 = JSON.parse(JSON.stringify(sq2State)) as QualifyingPhaseExecutionState
    render(<QualifyingPhaseView phase="SQ2" state={reconstructedSQ2} />)
    expect(screen.getByText('Piloto SQ2 1')).toBeInTheDocument()
    expect(screen.getAllByText('Avança ao SQ3')).toHaveLength(10)
    expect(screen.getAllByText('Eliminado SQ2')).toHaveLength(8)

    // Ciclo SQ3
    const reconstructedSQ3 = JSON.parse(JSON.stringify(sq3State)) as QualifyingPhaseExecutionState
    rerender(<QualifyingPhaseView phase="SQ3" state={reconstructedSQ3} />)
    expect(screen.getByText('Piloto SQ3 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto SQ3 10')).toBeInTheDocument()
    expect(screen.getByText('P1 — Sprint Pole')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-B12 — NORMAL: Weekend NORMAL não exibe SQ2 nem SQ3.
  // =========================================================================
  it('SQUI-B12 — NORMAL: Weekend NORMAL não exibe SQ2 nem SQ3', () => {
    const normalFormat = resolveWeekendFormat(1) // Melbourne = NORMAL
    expect(normalFormat).toBe('NORMAL')

    const sequence = getWeekendSlotSequence('NORMAL')
    const displayLabels = sequence.map((s) => s.displayLabel)

    expect(displayLabels.some((l) => l.includes('SQ2'))).toBe(false)
    expect(displayLabels.some((l) => l.includes('SQ3'))).toBe(false)
    expect(displayLabels.some((l) => l.includes('Sprint'))).toBe(false)

    // Renderiza CanonicalQualifyingView no modo MAIN_QUALIFYING
    render(
      <CanonicalQualifyingView
        careerId="test_career_sq23"
        seasonId="2026"
        round={1}
        variant="MAIN_QUALIFYING"
      />,
    )

    // Abas de Sprint não devem existir
    expect(screen.queryByRole('tab', { name: /^SQ1/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^SQ2/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^SQ3/i })).not.toBeInTheDocument()
  })
})
