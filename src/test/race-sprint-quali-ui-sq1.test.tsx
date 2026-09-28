/**
 * src/test/race-sprint-quali-ui-sq1.test.tsx
 *
 * APEX GP MANAGER — RACE-SPRINT-SLOTS-01B3A-UI
 * Suíte de Testes da Microentrega SQ1 UI (SQUI-A01 a SQUI-A08):
 *
 * - SQUI-A01 COMPONENTE: SQ1 renderizado pela mesma camada funcional QualifyingPhaseView
 *   usada pelo MAIN (testar comportamento, não nome de arquivo)
 * - SQUI-A02 FONTE CORRETA: SPRINT/SQ1 lê o estado persistido Sprint (chave apex_sprint_qualifying_phase_sq1_*
 *   ou apex_sprint_sq1_state_*), NÃO lê MAIN/Q1
 * - SQUI-A03 PARTICIPANTES: 24 participantes renderizados
 * - SQUI-A04 STATUS: 18 com "Avança ao SQ2" + 6 com "Eliminado SQ1"
 * - SQUI-A05 ZERO CÁLCULO: render não chama RNG, pureRaceEngine, cálculo de setup,
 *   compound delta nem execução do orquestrador
 * - SQUI-A06 NOT RUN: SQ1 não realizado mostra estado apropriado (sem fabricar P0/tempo zero/dados de Q1)
 * - SQUI-A07 NORMAL: weekend NORMAL não exibe SQ1 nem abas Sprint
 * - SQUI-A08 RELOAD: estado persistido reconstruído produz a mesma apresentação
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QualifyingPhaseView } from '@/components/race/QualifyingPhaseView'
import { CanonicalQualifyingView } from '@/components/race/CanonicalQualifyingView'
import {
  raceQualifyingOrchestratorService,
  type QualifyingPhaseExecutionState,
} from '@/services/raceQualifyingOrchestratorService'
import { getWeekendSlotSequence, resolveWeekendFormat } from '@/services/weekendSlotSequenceService'

// Helper mock para 24 participantes SQ1
function makeSQ1Drivers(count = 24) {
  return Array.from({ length: count }, (_, idx) => {
    const pos = idx + 1
    const isElim = pos > 18
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      driverId: `drv_sq1_${pos}`,
      driverName: `Piloto SQ1 ${pos}`,
      teamId: `team_${Math.floor(idx / 2) + 1}`,
      teamName: `Scuderia ${Math.floor(idx / 2) + 1}`,
      carIndex,
      setup: 70 + idx,
      effectiveDriver: 80,
      trackRating: 82,
      basePaceMs: 80000,
      bonusMs: 80,
      compoundDeltaMs: 650,
      compoundUsed: 'MEDIUM' as const,
      bestTimeMs: 80000 + idx * 120,
      formattedBestTime: `1:20.${String(idx * 120).padStart(3, '0')}`,
      attempts: [],
      position: pos,
      isClassified: !isElim,
      isEliminated: isElim,
    }
  })
}

function makeQ1Drivers(count = 24) {
  return Array.from({ length: count }, (_, idx) => {
    const pos = idx + 1
    const isElim = pos > 18
    const carIndex: 1 | 2 = ((idx % 2) + 1) as 1 | 2
    return {
      driverId: `drv_q1_${pos}`,
      driverName: `Piloto MAIN Q1 ${pos}`,
      teamId: `team_main_${Math.floor(idx / 2) + 1}`,
      teamName: `Scuderia Main ${Math.floor(idx / 2) + 1}`,
      carIndex,
      setup: 60 + idx,
      effectiveDriver: 85,
      trackRating: 85,
      basePaceMs: 79000,
      bonusMs: 100,
      compoundDeltaMs: 0,
      compoundUsed: 'SOFT' as const,
      bestTimeMs: 79000 + idx * 100,
      formattedBestTime: `1:19.${String(idx * 100).padStart(3, '0')}`,
      attempts: [],
      position: pos,
      isClassified: !isElim,
      isEliminated: isElim,
    }
  })
}

function createMockSQ1State(): QualifyingPhaseExecutionState {
  const results = makeSQ1Drivers(24)
  return {
    variant: 'SPRINT_QUALIFYING',
    phase: 'SQ1',
    careerId: 'test_career_sq1',
    seasonId: '2026',
    round: 2,
    configVersion: 'v1',
    status: 'READY_FOR_SQ2',
    isCompleted: true,
    totalParticipants: 24,
    advancingCount: 18,
    eliminatedCount: 6,
    results,
    classifiedDriverIds: results.filter((r) => !r.isEliminated).map((r) => r.driverId),
    eliminatedDriverIds: results.filter((r) => r.isEliminated).map((r) => r.driverId),
    trackRecordMs: 80000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function createMockQ1State(): QualifyingPhaseExecutionState {
  const results = makeQ1Drivers(24)
  return {
    variant: 'MAIN_QUALIFYING',
    phase: 'Q1',
    careerId: 'test_career_sq1',
    seasonId: '2026',
    round: 2,
    configVersion: 'v1',
    status: 'READY_FOR_Q2',
    isCompleted: true,
    totalParticipants: 24,
    advancingCount: 18,
    eliminatedCount: 6,
    results,
    classifiedDriverIds: results.filter((r) => !r.isEliminated).map((r) => r.driverId),
    eliminatedDriverIds: results.filter((r) => r.isEliminated).map((r) => r.driverId),
    trackRecordMs: 79000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('APEX GP MANAGER — SUÍTE SQUI-A01..A08 (Microentrega SQ1 UI)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  // =========================================================================
  // SQUI-A01 COMPONENTE: SQ1 renderizado pela mesma camada funcional
  // QualifyingPhaseView usada pelo MAIN (testar comportamento, não nome de arquivo)
  // =========================================================================
  it('SQUI-A01 COMPONENTE: SQ1 renderizado pela mesma camada funcional QualifyingPhaseView usada pelo MAIN', () => {
    const sq1State = createMockSQ1State()
    const q1State = createMockQ1State()

    // 1. Renderiza MAIN Q1 através da camada funcional
    const { rerender } = render(<QualifyingPhaseView phase="Q1" state={q1State} />)
    expect(screen.getByText('Classificação Principal')).toBeInTheDocument()
    expect(screen.getByText('Status Q1')).toBeInTheDocument()
    expect(screen.getByText('Piloto MAIN Q1 1')).toBeInTheDocument()

    // 2. Re-renderiza SQ1 pela MESMA camada funcional
    rerender(<QualifyingPhaseView phase="SQ1" state={sq1State} />)
    expect(screen.getByText('Qualificação Sprint')).toBeInTheDocument()
    expect(screen.getByText('Status SQ1')).toBeInTheDocument()
    expect(screen.getByText('Piloto SQ1 1')).toBeInTheDocument()
    expect(screen.getByText('Fase SQ1 — 24 Carros Inscritos')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-A02 FONTE CORRETA: SPRINT/SQ1 lê o estado persistido Sprint
  // (chave apex_sprint_qualifying_phase_sq1_* ou apex_sprint_sq1_state_*), NÃO lê MAIN/Q1
  // =========================================================================
  it('SQUI-A02 FONTE CORRETA: SPRINT/SQ1 lê o estado persistido Sprint, NÃO lê MAIN/Q1', async () => {
    const sq1State = createMockSQ1State()
    const q1State = createMockQ1State()

    const loadPhaseSpy = vi
      .spyOn(raceQualifyingOrchestratorService, 'loadPersistedPhaseState')
      .mockImplementation(async (phase) => {
        if (phase === 'SQ1') return sq1State
        if (phase === 'Q1') return q1State
        return null
      })

    // Renderiza a CanonicalQualifyingView no modo SPRINT_QUALIFYING
    render(
      <CanonicalQualifyingView
        careerId="test_career_sq1"
        seasonId="2026"
        round={2}
        variant="SPRINT_QUALIFYING"
      />,
    )

    // Deve carregar SQ1 e NÃO carregar Q1 para alimentar SQ1
    await screen.findByText('Qualificação Sprint — Etapa 2')
    expect(loadPhaseSpy).toHaveBeenCalledWith('SQ1', 'test_career_sq1', '2026', 2)

    // Confirma que os dados exibidos são do SQ1 e não do MAIN Q1
    expect(screen.getByText('Piloto SQ1 1')).toBeInTheDocument()
    expect(screen.queryByText('Piloto MAIN Q1 1')).not.toBeInTheDocument()

    // Valida também suporte à leitura direta via chave legada/alternativa em localStorage
    const legacyKey = 'apex_sprint_qualifying_phase_sq1_career_leg_2026_r2'
    localStorage.setItem(legacyKey, JSON.stringify(sq1State))
    loadPhaseSpy.mockResolvedValueOnce(null) // força fallback de loadPersistedSQ1State
    const loadedLegacy = await raceQualifyingOrchestratorService.loadPersistedSQ1State(
      'career_leg',
      '2026',
      2,
    )
    expect(loadedLegacy).not.toBeNull()
    expect(loadedLegacy?.results[0].driverName).toBe('Piloto SQ1 1')
  })

  // =========================================================================
  // SQUI-A03 PARTICIPANTES: 24 participantes renderizados
  // =========================================================================
  it('SQUI-A03 PARTICIPANTES: 24 participantes renderizados na sessão SQ1', () => {
    const sq1State = createMockSQ1State()
    render(<QualifyingPhaseView phase="SQ1" state={sq1State} />)

    expect(screen.getByText('24 Pilotos')).toBeInTheDocument()
    const rows = screen.getAllByText(/Piloto SQ1 \d+/)
    expect(rows).toHaveLength(24)
    expect(screen.getByText('Piloto SQ1 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto SQ1 24')).toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-A04 STATUS: 18 com "Avança ao SQ2" + 6 com "Eliminado SQ1"
  // =========================================================================
  it('SQUI-A04 STATUS: exatamente 18 com "Avança ao SQ2" e 6 com "Eliminado SQ1"', () => {
    const sq1State = createMockSQ1State()
    render(<QualifyingPhaseView phase="SQ1" state={sq1State} />)

    const advancingBadges = screen.getAllByText('Avança ao SQ2')
    expect(advancingBadges).toHaveLength(18)

    const eliminatedBadges = screen.getAllByText('Eliminado SQ1')
    expect(eliminatedBadges).toHaveLength(6)
  })

  // =========================================================================
  // SQUI-A05 ZERO CÁLCULO: render não chama RNG, pureRaceEngine, cálculo de setup,
  // compound delta nem execução do orquestrador
  // =========================================================================
  it('SQUI-A05 ZERO CÁLCULO: render não chama RNG, cálculo de setup nem orquestrador esportivo', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random')
    const executePhaseSpy = vi.spyOn(raceQualifyingOrchestratorService, 'executeQualifyingPhase')
    const executeSQ1Spy = vi.spyOn(raceQualifyingOrchestratorService, 'executeSQ1')

    const sq1State = createMockSQ1State()
    render(<QualifyingPhaseView phase="SQ1" state={sq1State} />)

    expect(mathRandomSpy).not.toHaveBeenCalled()
    expect(executePhaseSpy).not.toHaveBeenCalled()
    expect(executeSQ1Spy).not.toHaveBeenCalled()
  })

  // =========================================================================
  // SQUI-A06 NOT RUN: SQ1 não realizado mostra estado apropriado (sem fabricar P0/tempo zero/dados de Q1)
  // =========================================================================
  it('SQUI-A06 NOT RUN: SQ1 não realizado mostra estado apropriado sem fabricar P0/tempo zero nem dados de Q1', () => {
    render(<QualifyingPhaseView phase="SQ1" state={null} />)

    expect(screen.getByText('Sessão SQ1 ainda não realizada (READY_FOR_SQ1).')).toBeInTheDocument()

    // Não deve fabricar pilotos inexistentes, P0 ou tempos zerados fictícios
    expect(screen.queryByText(/Piloto/)).not.toBeInTheDocument()
    expect(screen.queryByText('P0')).not.toBeInTheDocument()
    expect(screen.queryByText('0:00.000')).not.toBeInTheDocument()
    expect(screen.queryByText('Avança ao SQ2')).not.toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-A07 NORMAL: weekend NORMAL não exibe SQ1 nem abas Sprint
  // =========================================================================
  it('SQUI-A07 NORMAL: weekend NORMAL não exibe SQ1 nem abas Sprint', () => {
    const normalFormat = resolveWeekendFormat(1) // Melbourne = NORMAL
    expect(normalFormat).toBe('NORMAL')

    const sequence = getWeekendSlotSequence('NORMAL')
    const slotNames = sequence.map((s) => s.slotType)
    const displayLabels = sequence.map((s) => s.displayLabel)

    // Nenhuma menção a SQ1 ou Sprint no final de semana NORMAL
    expect(slotNames).not.toContain('QUALI_SPRINT')
    expect(slotNames).not.toContain('SPRINT_QUALIFYING')
    expect(slotNames).not.toContain('SPRINT')
    expect(displayLabels.some((l) => l.includes('SQ1'))).toBe(false)
    expect(displayLabels.some((l) => l.includes('Sprint'))).toBe(false)

    // Na visualização canônica de MAIN_QUALIFYING
    render(
      <CanonicalQualifyingView
        careerId="test_career_sq1"
        seasonId="2026"
        round={1}
        variant="MAIN_QUALIFYING"
      />,
    )

    // Abas devem ser Q1/Q2/Q3/Resultado/Grid Oficial, sem abas de Sprint SQ1
    expect(screen.queryByRole('tab', { name: /^SQ1/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^SQ2/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^SQ3/i })).not.toBeInTheDocument()
  })

  // =========================================================================
  // SQUI-A08 RELOAD: estado persistido reconstruído produz a mesma apresentação
  // =========================================================================
  it('SQUI-A08 RELOAD: estado persistido reconstruído produz a mesma apresentação', () => {
    const sq1State = createMockSQ1State()

    // 1º ciclo de montagem
    const { unmount } = render(<QualifyingPhaseView phase="SQ1" state={sq1State} />)
    expect(screen.getByText('Piloto SQ1 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto SQ1 24')).toBeInTheDocument()
    expect(screen.getAllByText('Avança ao SQ2')).toHaveLength(18)
    expect(screen.getAllByText('Eliminado SQ1')).toHaveLength(6)

    // Desmonta simulando navegação / refresh
    unmount()

    // Reconstrução a partir de estado persistido serializado/desserializado
    const serialized = JSON.stringify(sq1State)
    const reconstructed = JSON.parse(serialized) as QualifyingPhaseExecutionState

    render(<QualifyingPhaseView phase="SQ1" state={reconstructed} />)
    expect(screen.getByText('Piloto SQ1 1')).toBeInTheDocument()
    expect(screen.getByText('Piloto SQ1 24')).toBeInTheDocument()
    expect(screen.getAllByText('Avança ao SQ2')).toHaveLength(18)
    expect(screen.getAllByText('Eliminado SQ1')).toHaveLength(6)
  })
})
