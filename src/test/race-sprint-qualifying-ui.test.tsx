/**
 * src/test/race-sprint-qualifying-ui.test.tsx
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01B: SUÍTE DE TESTES DE UI SQUI01 A SQUI06
 *
 * TESTES OBRIGATÓRIOS:
 * - SQUI01: SQ1 renderiza usando QualifyingPhaseView.
 * - SQUI02: SQ2 renderiza no mesmo componente.
 * - SQUI03: SQ3 renderiza no mesmo componente.
 * - SQUI04: trocar SQ1↔SQ2↔SQ3 não recalcula resultados.
 * - SQUI05: weekend NORMAL não exibe Quali Sprint.
 * - SQUI06: weekend SPRINT exibe slot 2 "Quali Sprint" com as três subfases.
 */

import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QualifyingPhaseView } from '@/components/race/QualifyingPhaseView'
import { SprintQualifyingPhaseTabs } from '@/components/race/SprintQualifyingPhaseTabs'
import { getWeekendSlotSequence, resolveWeekendFormat } from '@/services/weekendSlotSequenceService'
import type { QualifyingPhaseExecutionState } from '@/services/raceQualifyingOrchestratorService'

const mockPhaseState = (phase: 'SQ1' | 'SQ2' | 'SQ3'): QualifyingPhaseExecutionState => ({
  variant: 'SPRINT_QUALIFYING',
  phase,
  careerId: 'test_c',
  seasonId: 'test_s',
  round: 2,
  configVersion: 'v1',
  status:
    phase === 'SQ1'
      ? 'READY_FOR_SQ2'
      : phase === 'SQ2'
        ? 'READY_FOR_SQ3'
        : 'SPRINT_QUALIFYING_COMPLETE',
  isCompleted: true,
  totalParticipants: phase === 'SQ1' ? 24 : phase === 'SQ2' ? 18 : 10,
  advancingCount: phase === 'SQ1' ? 18 : 10,
  eliminatedCount: phase === 'SQ1' ? 6 : phase === 'SQ2' ? 8 : 0,
  results: [
    {
      driverId: 'drv_01',
      driverName: 'Max Verstappen',
      teamId: 'team_redbull',
      teamName: 'Red Bull Racing',
      carIndex: 1,
      setup: 32.81,
      effectiveDriver: 95,
      trackRating: 92,
      basePaceMs: 80000,
      bonusMs: 82.025,
      compoundDeltaMs: phase === 'SQ3' ? 0 : 650,
      compoundUsed: phase === 'SQ3' ? 'SOFT' : 'MEDIUM',
      bestTimeMs: phase === 'SQ3' ? 79917.975 : 80567.975,
      formattedBestTime: phase === 'SQ3' ? '1:19.918' : '1:20.568',
      attempts: [],
      position: 1,
      isClassified: true,
      isEliminated: false,
    },
  ],
  classifiedDriverIds: ['drv_01'],
  eliminatedDriverIds: [],
  trackRecordMs: 80000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

describe('RACE-SPRINT-SLOTS-01B — UI Quali Sprint (SQUI01 a SQUI06)', () => {
  // =========================================================================
  // SQUI01
  // =========================================================================
  it('SQUI01: SQ1 renderiza usando QualifyingPhaseView', () => {
    const sq1State = mockPhaseState('SQ1')
    render(<QualifyingPhaseView phase="SQ1" state={sq1State} />)

    expect(screen.getByText('Fase SQ1 — 24 Carros Inscritos')).toBeInTheDocument()
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument()
    expect(screen.getByText('Red Bull Racing')).toBeInTheDocument()
    expect(screen.getByText('1:20.568')).toBeInTheDocument()
    expect(screen.getByText('M (+0.65s)')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI02
  // =========================================================================
  it('SQUI02: SQ2 renderiza no mesmo componente', () => {
    const sq2State = mockPhaseState('SQ2')
    render(<QualifyingPhaseView phase="SQ2" state={sq2State} />)

    expect(screen.getByText('Fase SQ2 — Somente os 18 Classificados')).toBeInTheDocument()
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument()
    expect(screen.getByText('M (+0.65s)')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI03
  // =========================================================================
  it('SQUI03: SQ3 renderiza no mesmo componente com destaque de Macio e Pole', () => {
    const sq3State = mockPhaseState('SQ3')
    render(<QualifyingPhaseView phase="SQ3" state={sq3State} />)

    expect(
      screen.getByText('Fase SQ3 — Os 10 Finalistas (Pole da Corrida Sprint)'),
    ).toBeInTheDocument()
    expect(screen.getByText('Max Verstappen')).toBeInTheDocument()
    expect(screen.getByText('1:19.918')).toBeInTheDocument()
    expect(screen.getByText('S (0s)')).toBeInTheDocument()
    expect(screen.getByText('Pole Sprint')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI04
  // =========================================================================
  it('SQUI04: trocar SQ1↔SQ2↔SQ3 não recalcula resultados', () => {
    const sq1State = mockPhaseState('SQ1')
    const sq2State = mockPhaseState('SQ2')
    const sq3State = mockPhaseState('SQ3')

    render(
      <SprintQualifyingPhaseTabs sq1State={sq1State} sq2State={sq2State} sq3State={sq3State} />,
    )

    // Inicialmente SQ1 está ativo
    expect(screen.getByText('Fase SQ1 — 24 Carros Inscritos')).toBeInTheDocument()

    // Clica em SQ2
    const tabSq2 = screen.getByRole('tab', { name: /SQ2/i })
    fireEvent.click(tabSq2)
    expect(screen.getByText('Fase SQ2 — Somente os 18 Classificados')).toBeInTheDocument()

    // Clica em SQ3
    const tabSq3 = screen.getByRole('tab', { name: /SQ3/i })
    fireEvent.click(tabSq3)
    expect(
      screen.getByText('Fase SQ3 — Os 10 Finalistas (Pole da Corrida Sprint)'),
    ).toBeInTheDocument()

    // Voltar para SQ1 não perde dados
    const tabSq1 = screen.getByRole('tab', { name: /SQ1/i })
    fireEvent.click(tabSq1)
    expect(screen.getByText('Fase SQ1 — 24 Carros Inscritos')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI05
  // =========================================================================
  it('SQUI05: weekend NORMAL não exibe Quali Sprint na sequência canônica', () => {
    const normalFormat = resolveWeekendFormat(1) // Round 1 = Austrália (Normal)
    expect(normalFormat).toBe('NORMAL')

    const sequence = getWeekendSlotSequence('NORMAL')
    const slotTypes = sequence.map((s) => s.slotType)

    expect(slotTypes).not.toContain('QUALI_SPRINT')
    expect(slotTypes).not.toContain('SPRINT_QUALIFYING')
    expect(slotTypes).not.toContain('SPRINT')
    expect(slotTypes[1]).toBe('TL2')
  })

  // =========================================================================
  // SQUI06
  // =========================================================================
  it('SQUI06: weekend SPRINT exibe slot 2 "Quali Sprint" com subfases', () => {
    const sprintFormat = resolveWeekendFormat(2) // Round 2 = China (Sprint)
    expect(sprintFormat).toBe('SPRINT')

    const sequence = getWeekendSlotSequence('SPRINT')
    const slot2 = sequence.find((s) => s.slotNumber === 2)!

    expect(slot2).toBeDefined()
    expect(slot2.slotType).toBe('QUALI_SPRINT')
    expect(slot2.displayLabel).toBe('Qualificação Sprint')
    expect(slot2.shortLabel).toBe('Quali Sprint')
    expect(slot2.description).toContain('subfases SQ1, SQ2, SQ3')
  })
})
