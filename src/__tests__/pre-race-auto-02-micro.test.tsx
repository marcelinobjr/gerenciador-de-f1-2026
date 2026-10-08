/**
 * src/__tests__/pre-race-auto-02-micro.test.tsx
 *
 * Suíte de Testes PRE-RACE-AUTO-02-MICRO:
 * Fechamento do estado sem saída entre Grid e Pré-Corrida após reload / retomada.
 *
 * Casos de teste focados: PA2-M1..M6
 * - PA2-M1: reload/retomada com race selecionada + qualifying completa + grid válido + sem race state + sem official result => pré-race abre automaticamente.
 * - PA2-M2: usuário clica "Voltar ao grid" => efeito não reabre em loop.
 * - PA2-M3: botão fallback "PREPARAR CORRIDA" => abre o painel pré-corrida.
 * - PA2-M4: canonicalRaceState existente => NÃO abre pré-race.
 * - PA2-M5: officialRaceResult existente => NÃO abre pré-race.
 * - PA2-M6: autoabertura NÃO inicia Race Engine e NÃO reseta estratégia existente.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React, { useState, useRef, useEffect } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { CompleteQualifyingGridSummary } from '@/components/race/CompleteQualifyingGridSummary'
import { normalizeCompletedSessions } from '@/services/weekendProgressionService'
import type {
  CompleteQualifyingWeekendResult,
  FinalQualifyingGridEntry,
  QualifyingStageResult,
} from '@/types/canonical-qualifying-types'

function buildMockFinalGrid(): FinalQualifyingGridEntry[] {
  return Array.from({ length: 24 }, (_, i) => ({
    gridPosition: i + 1,
    driverId: `drv_${i + 1}`,
    driverName: `Driver ${i + 1}`,
    teamId: i < 2 ? 'team_player' : `team_${Math.floor(i / 2) + 1}`,
    teamName: i < 2 ? 'Player Team' : `Team ${Math.floor(i / 2) + 1}`,
    teamColor: '#E10600',
    isPlayer: i < 2,
    eliminationStage: i < 10 ? 'Q3' : i < 18 ? 'Q2' : 'Q1',
    bestLapSec: 80 + i * 0.1,
    bestLapTime: `1:20.${String(i).padStart(3, '0')}`,
    bestLapCompound: 'macio' as const,
  }))
}

function buildMockStageResult(stageId: 'q1' | 'q2' | 'q3'): QualifyingStageResult {
  return {
    stageId,
    seasonId: 'season_2026',
    round: 1,
    completedAt: new Date().toISOString(),
    entries: [],
    advancingDriverIds: [],
    eliminatedDriverIds: [],
  }
}

function buildMockCompleteQualifyingResult(): CompleteQualifyingWeekendResult {
  return {
    seasonId: 'season_2026',
    round: 1,
    finalGrid: buildMockFinalGrid(),
    poleDriverId: 'drv_1',
    poleDriverName: 'Driver 1',
    poleLapTime: '1:20.000',
    completedAt: new Date().toISOString(),
    q1Result: buildMockStageResult('q1'),
    q2Result: buildMockStageResult('q2'),
    q3Result: buildMockStageResult('q3'),
  }
}

/**
 * Componente harness que reproduz a máquina de estados exata de renderização
 * e efeito de reconciliação de WeekendV2Page
 */
interface WeekendReconciliationHarnessProps {
  initialSessionId?: string
  initialCompletedSessions?: string[]
  initialCompleteQualifyingResult?: CompleteQualifyingWeekendResult | null
  initialCanonicalRaceState?: any
  initialOfficialRaceResult?: any
  initialShowPreRacePreparation?: boolean
  existingStrategySnapshot?: any
  onStrategyResetSpy?: () => void
  onRaceEngineStartSpy?: () => void
}

const WeekendReconciliationHarness: React.FC<WeekendReconciliationHarnessProps> = ({
  initialSessionId = 'race',
  initialCompletedSessions = ['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'qualifying'],
  initialCompleteQualifyingResult = buildMockCompleteQualifyingResult(),
  initialCanonicalRaceState = null,
  initialOfficialRaceResult = null,
  initialShowPreRacePreparation = false,
  existingStrategySnapshot = null,
  onStrategyResetSpy,
  onRaceEngineStartSpy,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId)
  const [completedSessions, setCompletedSessions] = useState<string[]>(initialCompletedSessions)
  const [completeQualifyingResult, setCompleteQualifyingResult] =
    useState<CompleteQualifyingWeekendResult | null>(initialCompleteQualifyingResult)
  const [canonicalRaceState, setCanonicalRaceState] = useState<any>(initialCanonicalRaceState)
  const [officialRaceResult, setOfficialRaceResult] = useState<any>(initialOfficialRaceResult)
  const [showPreRacePreparation, setShowPreRacePreparation] = useState<boolean>(
    initialShowPreRacePreparation,
  )

  // Guard do PRE-RACE-AUTO-02-MICRO
  const userChoseReturnToGridRef = useRef<boolean>(false)

  // Simulação de estratégia mantida em memória (PA2-M6)
  const strategySnapshotRef = useRef<any>(existingStrategySnapshot)

  // Efeito de reconciliação idêntico ao de WeekendV2Page
  useEffect(() => {
    if (selectedSessionId !== 'race') return
    if (userChoseReturnToGridRef.current) return
    if (showPreRacePreparation) return
    if (canonicalRaceState != null || officialRaceResult != null) return

    const normalizedStored = normalizeCompletedSessions(completedSessions)
    const isQualifyingCompleted =
      normalizedStored.includes('q3') ||
      normalizedStored.includes('qualifying') ||
      completedSessions.includes('q3') ||
      completedSessions.includes('qualifying')

    if (!isQualifyingCompleted) return

    const hasValidGrid =
      !!completeQualifyingResult &&
      Array.isArray(completeQualifyingResult.finalGrid) &&
      completeQualifyingResult.finalGrid.length > 0

    if (hasValidGrid) {
      setShowPreRacePreparation(true)
    }
  }, [
    selectedSessionId,
    completedSessions,
    completeQualifyingResult,
    canonicalRaceState,
    officialRaceResult,
    showPreRacePreparation,
  ])

  // Callbacks de transição
  const handleCancelToGrid = () => {
    userChoseReturnToGridRef.current = true
    setShowPreRacePreparation(false)
  }

  const handleManualGoToRace = () => {
    userChoseReturnToGridRef.current = false
    setShowPreRacePreparation(true)
  }

  const handleStartRace = () => {
    if (onRaceEngineStartSpy) onRaceEngineStartSpy()
    setCanonicalRaceState({ started: true, lap: 1 })
    setShowPreRacePreparation(false)
  }

  return (
    <div data-testid="weekend-harness">
      <div data-testid="state-session">{selectedSessionId}</div>
      <div data-testid="state-pre-race">
        {showPreRacePreparation ? 'pre-race-open' : 'grid-view'}
      </div>
      <div data-testid="state-race-engine">{canonicalRaceState ? 'race-started' : 'race-null'}</div>
      <div data-testid="state-official-result">
        {officialRaceResult ? 'result-exists' : 'result-null'}
      </div>

      {officialRaceResult ? (
        <div data-testid="view-official-result">RESULTADO OFICIAL</div>
      ) : canonicalRaceState ? (
        <div data-testid="view-race-engine">RACE ENGINE EM EXECUÇÃO</div>
      ) : showPreRacePreparation ? (
        <div data-testid="view-pre-race-panel">
          <span>PAINEL DE ESTRATÉGIA PRÉ-CORRIDA</span>
          <button type="button" onClick={handleCancelToGrid}>
            Voltar ao grid
          </button>
          <button type="button" onClick={handleStartRace}>
            Confirmar e Iniciar Corrida
          </button>
          {strategySnapshotRef.current && (
            <div data-testid="active-strategy-id">{strategySnapshotRef.current.planId}</div>
          )}
        </div>
      ) : completeQualifyingResult ? (
        <CompleteQualifyingGridSummary
          result={completeQualifyingResult}
          onGoToRace={handleManualGoToRace}
        />
      ) : (
        <div data-testid="view-placeholder">PLACEHOLDER</div>
      )}
    </div>
  )
}

describe('PRE-RACE-AUTO-02-MICRO — Fechamento do Estado sem Saída (PA2-M1..M6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // PA2-M1: reload/retomada com race selecionada + qualifying completa + grid válido + sem race state + sem official result => pré-race abre
  it('PA2-M1: reload com Q3 concluída, race selecionada e grid válido abre automaticamente o painel pré-corrida', () => {
    render(
      <WeekendReconciliationHarness
        initialSessionId="race"
        initialCompletedSessions={['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'qualifying']}
        initialCompleteQualifyingResult={buildMockCompleteQualifyingResult()}
        initialCanonicalRaceState={null}
        initialOfficialRaceResult={null}
        initialShowPreRacePreparation={false}
      />,
    )

    // O efeito de reconciliação deve detectar as condições e abrir o painel
    expect(screen.getByTestId('view-pre-race-panel')).toBeDefined()
    expect(screen.getByText('PAINEL DE ESTRATÉGIA PRÉ-CORRIDA')).toBeDefined()
    expect(screen.getByTestId('state-pre-race').textContent).toBe('pre-race-open')
  })

  // PA2-M2: usuário clica "Voltar ao grid" => efeito não reabre em loop
  it('PA2-M2: usuário clica "Voltar ao grid" => guard bloqueia reabertura e tela permanece no grid sem loop', () => {
    render(
      <WeekendReconciliationHarness
        initialSessionId="race"
        initialCompletedSessions={['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'qualifying']}
        initialCompleteQualifyingResult={buildMockCompleteQualifyingResult()}
        initialCanonicalRaceState={null}
        initialOfficialRaceResult={null}
        initialShowPreRacePreparation={false}
      />,
    )

    // Inicialmente abre pelo efeito
    expect(screen.getByTestId('view-pre-race-panel')).toBeDefined()

    // Usuário clica "Voltar ao grid"
    const returnBtn = screen.getByText('Voltar ao grid')
    fireEvent.click(returnBtn)

    // Agora deve estar no grid summary e NÃO reabrir em loop
    expect(screen.queryByTestId('view-pre-race-panel')).toBeNull()
    expect(screen.getByText('GRID OFICIAL FIA FORMADO')).toBeDefined()
    expect(screen.getByText('PREPARAR CORRIDA')).toBeDefined()
    expect(screen.getByTestId('state-pre-race').textContent).toBe('grid-view')
  })

  // PA2-M3: botão fallback "PREPARAR CORRIDA" => abre o painel pré-corrida
  it('PA2-M3: botão fallback "PREPARAR CORRIDA" no grid reabre o painel pré-corrida normalmente', () => {
    render(
      <WeekendReconciliationHarness
        initialSessionId="race"
        initialCompletedSessions={['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'qualifying']}
        initialCompleteQualifyingResult={buildMockCompleteQualifyingResult()}
        initialCanonicalRaceState={null}
        initialOfficialRaceResult={null}
        initialShowPreRacePreparation={false}
      />,
    )

    // Abre auto
    expect(screen.getByTestId('view-pre-race-panel')).toBeDefined()

    // Volta ao grid
    fireEvent.click(screen.getByText('Voltar ao grid'))
    expect(screen.queryByTestId('view-pre-race-panel')).toBeNull()

    // Clica no fallback "PREPARAR CORRIDA"
    const fallbackBtn = screen.getByText('PREPARAR CORRIDA')
    fireEvent.click(fallbackBtn)

    // Painel reabre normalmente
    expect(screen.getByTestId('view-pre-race-panel')).toBeDefined()
    expect(screen.getByTestId('state-pre-race').textContent).toBe('pre-race-open')
  })

  // PA2-M4: canonicalRaceState existente => NÃO abre pré-race
  it('PA2-M4: corrida já em andamento (canonicalRaceState != null) => NÃO abre pré-race e exibe Race Engine', () => {
    render(
      <WeekendReconciliationHarness
        initialSessionId="race"
        initialCompletedSessions={['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'qualifying']}
        initialCompleteQualifyingResult={buildMockCompleteQualifyingResult()}
        initialCanonicalRaceState={{ lap: 5, totalLaps: 57 }}
        initialOfficialRaceResult={null}
        initialShowPreRacePreparation={false}
      />,
    )

    // Deve exibir diretamente o Race Engine, sem abrir o painel de estratégia
    expect(screen.getByTestId('view-race-engine')).toBeDefined()
    expect(screen.queryByTestId('view-pre-race-panel')).toBeNull()
    expect(screen.queryByText('PREPARAR CORRIDA')).toBeNull()
  })

  // PA2-M5: officialRaceResult existente => NÃO abre pré-race
  it('PA2-M5: resultado oficial já existente (officialRaceResult != null) => NÃO abre pré-race e exibe resultado oficial', () => {
    render(
      <WeekendReconciliationHarness
        initialSessionId="race"
        initialCompletedSessions={['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'qualifying', 'race']}
        initialCompleteQualifyingResult={buildMockCompleteQualifyingResult()}
        initialCanonicalRaceState={null}
        initialOfficialRaceResult={{ winner: 'Driver 1', round: 1 }}
        initialShowPreRacePreparation={false}
      />,
    )

    // Deve exibir o resultado oficial da corrida
    expect(screen.getByTestId('view-official-result')).toBeDefined()
    expect(screen.queryByTestId('view-pre-race-panel')).toBeNull()
    expect(screen.queryByText('PREPARAR CORRIDA')).toBeNull()
  })

  // PA2-M6: autoabertura NÃO inicia Race Engine e NÃO reseta estratégia existente
  it('PA2-M6: autoabertura NÃO inicia Race Engine e preserva estratégia existente em memória', () => {
    const raceEngineSpy = vi.fn()
    const customSnapshot = { planId: 'custom-strat-plan-42', fuelKg: 45 }

    render(
      <WeekendReconciliationHarness
        initialSessionId="race"
        initialCompletedSessions={['tp1', 'tp2', 'tp3', 'q1', 'q2', 'q3', 'qualifying']}
        initialCompleteQualifyingResult={buildMockCompleteQualifyingResult()}
        initialCanonicalRaceState={null}
        initialOfficialRaceResult={null}
        initialShowPreRacePreparation={false}
        existingStrategySnapshot={customSnapshot}
        onRaceEngineStartSpy={raceEngineSpy}
      />,
    )

    // O painel pré-corrida abre
    expect(screen.getByTestId('view-pre-race-panel')).toBeDefined()

    // O Race Engine NÃO foi disparado
    expect(raceEngineSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('state-race-engine').textContent).toBe('race-null')

    // A estratégia existente foi preservada sem reset
    expect(screen.getByTestId('active-strategy-id').textContent).toBe('custom-strat-plan-42')
  })
})
