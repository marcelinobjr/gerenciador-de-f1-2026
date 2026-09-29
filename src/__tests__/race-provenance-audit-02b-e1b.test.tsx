import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CanonicalWeatherDecisionModal } from '../components/race/CanonicalWeatherDecisionModal'
import { CanonicalRaceInitializationPanel } from '../components/race/CanonicalRaceInitializationPanel'
import { canonicalRaceInitializationService } from '../services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'
import { raceStrategyService } from '../services/raceStrategyService'
import { canonicalRaceSaveService } from '../services/canonicalRaceSaveService'
import type { CanonicalRaceState } from '../types/canonical-race-v2'
import type { WeatherTransition } from '../types/climate'

const createMockGrid = () => [
  {
    position: 1,
    gridPosition: 1,
    driverId: 'drv_human_1',
    driverName: 'Gabriel Bortoleto',
    teamId: 'player_team',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    isPlayer: true,
    grid: 1,
    qBestMs: 80000,
    bestLapSec: 80.0,
    bestLapTime: '1:20.000',
    bestLapCompound: 'macio' as const,
    eliminationStage: 'Q3' as const,
  },
  {
    position: 2,
    gridPosition: 2,
    driverId: 'drv_human_2',
    driverName: 'Nico Hülkenberg',
    teamId: 'player_team',
    teamName: 'Audi F1 Team',
    teamColor: '#E10600',
    isPlayer: true,
    grid: 2,
    qBestMs: 80050,
    bestLapSec: 80.05,
    bestLapTime: '1:20.050',
    bestLapCompound: 'macio' as const,
    eliminationStage: 'Q3' as const,
  },
  {
    position: 3,
    gridPosition: 3,
    driverId: 'drv_ai_1',
    driverName: 'Max Verstappen',
    teamId: 'ai_team',
    teamName: 'Red Bull Racing',
    teamColor: '#00D2BE',
    isPlayer: false,
    grid: 3,
    qBestMs: 80100,
    bestLapSec: 80.1,
    bestLapTime: '1:20.100',
    bestLapCompound: 'macio' as const,
    eliminationStage: 'Q3' as const,
  },
]

const initTestRace = (transitions: WeatherTransition[], totalLaps = 8): CanonicalRaceState => {
  const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId: 'test_e1b_career',
    season: 2026,
    round: 1,
    circuitName: 'Interlagos',
    circuitCountry: 'Brasil',
    totalLaps,
    playerTeamId: 'player_team',
    canonicalQualifyingGrid: createMockGrid() as any,
  })
  state.weatherTransitions = transitions
  return state
}

describe('RACE-PROVENANCE-AUDIT-02B-E1B: UI da Decisão Humana em Mudança de Clima', () => {
  // E1B-01: modal aparece quando raceStatus = awaiting_player_weather_decision
  it('E1B-01: modal aparece quando raceStatus = awaiting_player_weather_decision', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // Lap 3

    expect(state.status).toBe('awaiting_player_weather_decision')
    render(<CanonicalWeatherDecisionModal raceState={state} />)

    expect(screen.getByText(/MUDANÇA DE CLIMA/i)).toBeInTheDocument()
    expect(screen.getByText(/Condições da pista mudaram/i)).toBeInTheDocument()
    expect(screen.getByText(/Gabriel Bortoleto/i)).toBeInTheDocument()
    expect(screen.getByText(/Nico Hülkenberg/i)).toBeInTheDocument()
  })

  // E1B-02: modal não aparece em corrida normal
  it('E1B-02: modal não aparece em corrida normal', () => {
    let state = initTestRace([])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    expect(state.status).toBe('running')
    const { container } = render(<CanonicalWeatherDecisionModal raceState={state} />)
    expect(container).toBeEmptyDOMElement()
  })

  // E1B-03: DRY→WET mostra intermediário e chuva extrema
  it('E1B-03: DRY→WET mostra intermediário e chuva extrema', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    render(<CanonicalWeatherDecisionModal raceState={state} />)
    expect(screen.getAllByText(/Intermediário/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Chuva Extrema/i).length).toBeGreaterThan(0)
  })

  // E1B-04: DRY→WET não mostra slicks
  it('E1B-04: DRY→WET não mostra slicks', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    render(<CanonicalWeatherDecisionModal raceState={state} />)
    expect(screen.queryByText(/Macio/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Médio/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Duro/i)).not.toBeInTheDocument()
  })

  // E1B-05: WET→DRY mostra macio/médio/duro
  it('E1B-05: WET→DRY mostra macio/médio/duro', () => {
    let state = initTestRace([{ lap: 3, condition: 'seco' }])
    state.weather = 'chuva_fraca'
    state.drivers = state.drivers.map((d) => ({ ...d, tyreCompound: 'intermediario' }))
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    expect(state.pendingWeatherDecision?.transition).toBe('WET_TO_DRY')
    render(<CanonicalWeatherDecisionModal raceState={state} />)

    expect(screen.getAllByText(/Macio/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Médio/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Duro/i).length).toBeGreaterThan(0)
  })

  // E1B-06: WET→DRY não mostra pneus de chuva
  it('E1B-06: WET→DRY não mostra pneus de chuva', () => {
    let state = initTestRace([{ lap: 3, condition: 'seco' }])
    state.weather = 'chuva_fraca'
    state.drivers = state.drivers.map((d) => ({ ...d, tyreCompound: 'intermediario' }))
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    render(<CanonicalWeatherDecisionModal raceState={state} />)
    expect(screen.queryByText(/Intermediário/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Chuva Extrema/i)).not.toBeInTheDocument()
  })

  // E1B-07: STAY_OUT chama submitWeatherDecision corretamente
  it('E1B-07: STAY_OUT chama submitWeatherDecision corretamente', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    const onSubmitMock = vi.fn()
    render(<CanonicalWeatherDecisionModal raceState={state} onSubmitDecision={onSubmitMock} />)

    const stayOutBtn = screen.getByTestId('stay-out-btn-drv_human_1')
    fireEvent.click(stayOutBtn)

    expect(onSubmitMock).toHaveBeenCalledWith('drv_human_1', 'STAY_OUT', undefined)
  })

  // E1B-08: PIT_NOW exige seleção de composto
  it('E1B-08: PIT_NOW exige seleção de composto', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    const onSubmitMock = vi.fn()
    render(<CanonicalWeatherDecisionModal raceState={state} onSubmitDecision={onSubmitMock} />)

    const confirmPitBtn = screen.getByTestId('confirm-pit-btn-drv_human_1')
    expect(confirmPitBtn).toBeDisabled()

    fireEvent.click(confirmPitBtn)
    expect(onSubmitMock).not.toHaveBeenCalled()
  })

  // E1B-09: PIT_NOW envia composto correto
  it('E1B-09: PIT_NOW envia composto correto', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    const onSubmitMock = vi.fn()
    render(<CanonicalWeatherDecisionModal raceState={state} onSubmitDecision={onSubmitMock} />)

    const interBtn = screen.getByTestId('compound-btn-drv_human_1-intermediario')
    fireEvent.click(interBtn)

    const confirmPitBtn = screen.getByTestId('confirm-pit-btn-drv_human_1')
    expect(confirmPitBtn).not.toBeDisabled()

    fireEvent.click(confirmPitBtn)
    expect(onSubmitMock).toHaveBeenCalledWith('drv_human_1', 'PIT_NOW', 'intermediario')
  })

  // E1B-10: dois carros podem ter decisões diferentes
  it('E1B-10: dois carros podem ter decisões diferentes', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    // Decisão 1: Carro 1 PIT_NOW com intermediario
    const res1 = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'intermediario',
    })
    expect(res1.success).toBe(true)

    // Decisão 2: Carro 2 STAY_OUT
    const res2 = raceStrategyService.submitWeatherDecision({
      raceState: res1.updatedState,
      driverId: 'drv_human_2',
      action: 'STAY_OUT',
    })
    expect(res2.success).toBe(true)

    const pwd = res2.updatedState.pendingWeatherDecision!
    expect(pwd.drivers.find((d) => d.driverId === 'drv_human_1')?.action).toBe('PIT_NOW')
    expect(pwd.drivers.find((d) => d.driverId === 'drv_human_1')?.selectedCompound).toBe(
      'intermediario',
    )
    expect(pwd.drivers.find((d) => d.driverId === 'drv_human_2')?.action).toBe('STAY_OUT')
  })

  // E1B-11: um carro resolvido permanece marcado enquanto outro está pendente
  it('E1B-11: um carro resolvido permanece marcado enquanto outro está pendente', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    // Resolver apenas Carro 1
    const res1 = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'intermediario',
    })
    state = res1.updatedState

    render(<CanonicalWeatherDecisionModal raceState={state} />)

    // Carro 1 mostra status decidido
    const card1 = screen.getByTestId('weather-decision-card-drv_human_1')
    expect(card1).toHaveTextContent(/Pit programado — INTERMEDIARIO/i)
    expect(card1).toHaveTextContent(/Decisão Concluída/i)

    // Carro 2 continua com botões de ação pendente
    const card2 = screen.getByTestId('weather-decision-card-drv_human_2')
    expect(card2).toHaveTextContent(/CONTINUAR NA PISTA/i)
    expect(screen.getByTestId('stay-out-btn-drv_human_2')).toBeInTheDocument()
  })

  // E1B-12: advance fica bloqueado enquanto há pending decision
  it('E1B-12: advance fica bloqueado enquanto há pending decision', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    const onAdvanceMock = vi.fn()
    render(<CanonicalRaceInitializationPanel raceState={state} onAdvanceOneLap={onAdvanceMock} />)

    const advanceBtn = screen.getByText(/Aguardando Decisão/i)
    expect(advanceBtn).toBeDisabled()
    fireEvent.click(advanceBtn)
    expect(onAdvanceMock).not.toHaveBeenCalled()
  })

  // E1B-13: modal fecha somente quando backend remove pending decision
  it('E1B-13: modal fecha somente quando backend remove pending decision', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    // Resolver ambos os carros
    state = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'intermediario',
    }).updatedState

    state = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_2',
      action: 'STAY_OUT',
    }).updatedState

    expect(state.pendingWeatherDecision?.active).toBe(false)
    expect(state.status).toBe('running')

    const { container } = render(<CanonicalWeatherDecisionModal raceState={state} />)
    expect(container).toBeEmptyDOMElement()
  })

  // E1B-14: reload restaura modal
  it('E1B-14: reload restaura modal', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    // Salvar no storage
    canonicalRaceSaveService.saveCanonicalRaceState(state)

    // Recarregar
    const reloaded = canonicalRaceSaveService.loadCanonicalRaceState(
      state.careerId,
      state.season,
      state.round,
    ).state!

    expect(reloaded.status).toBe('awaiting_player_weather_decision')
    render(<CanonicalWeatherDecisionModal raceState={reloaded} />)

    expect(screen.getByText(/MUDANÇA DE CLIMA/i)).toBeInTheDocument()
    expect(screen.getByText(/Gabriel Bortoleto/i)).toBeInTheDocument()
  })

  // E1B-15: reload preserva decisão parcial
  it('E1B-15: reload preserva decisão parcial', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    // Decidir Carro 1
    state = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'intermediario',
    }).updatedState

    // Salvar e recarregar
    canonicalRaceSaveService.saveCanonicalRaceState(state)
    const reloaded = canonicalRaceSaveService.loadCanonicalRaceState(
      state.careerId,
      state.season,
      state.round,
    ).state!

    render(<CanonicalWeatherDecisionModal raceState={reloaded} />)

    const card1 = screen.getByTestId('weather-decision-card-drv_human_1')
    expect(card1).toHaveTextContent(/Pit programado — INTERMEDIARIO/i)

    const card2 = screen.getByTestId('weather-decision-card-drv_human_2')
    expect(card2).toHaveTextContent(/CONTINUAR NA PISTA/i)
  })

  // E1B-16: erro de submit mantém decisão pendente
  it('E1B-16: erro de submit mantém decisão pendente e exibe mensagem', async () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    const onSubmitMock = vi.fn().mockResolvedValue({
      success: false,
      error: 'Falha simulada na validação da parada.',
    })

    render(<CanonicalWeatherDecisionModal raceState={state} onSubmitDecision={onSubmitMock} />)

    const stayOutBtn = screen.getByTestId('stay-out-btn-drv_human_1')
    fireEvent.click(stayOutBtn)

    await waitFor(() => {
      expect(screen.getByText(/Falha simulada na validação da parada./i)).toBeInTheDocument()
    })

    // Decisão continua pendente na UI
    expect(screen.getByTestId('stay-out-btn-drv_human_1')).toBeInTheDocument()
  })

  // E1B-17: double click não duplica submit
  it('E1B-17: double click não duplica submit', async () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    let resolvePromise: (val: any) => void
    const slowSubmit = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve
        }),
    )

    render(<CanonicalWeatherDecisionModal raceState={state} onSubmitDecision={slowSubmit} />)

    const stayOutBtn = screen.getByTestId('stay-out-btn-drv_human_1')
    fireEvent.click(stayOutBtn)
    fireEvent.click(stayOutBtn) // Segundo clique enquanto submitting

    expect(slowSubmit).toHaveBeenCalledTimes(1)

    // Libera a promise
    resolvePromise!({ success: true })
  })

  // E1B-18: fluxo normal de pit manual continua funcionando
  it('E1B-18: fluxo normal de pit manual continua funcionando', () => {
    let state = initTestRace([])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    expect(state.status).toBe('running')
    const nextState = raceStrategyService.requestPitStop(state, 'drv_human_1', 'duro')
    expect(nextState.driverStrategies?.['drv_human_1']?.pitRequested).toBe(true)
    expect(nextState.driverStrategies?.['drv_human_1']?.targetCompound).toBe('duro')

    const canceledState = raceStrategyService.cancelPitRequest(nextState, 'drv_human_1')
    expect(canceledState.driverStrategies?.['drv_human_1']?.pitRequested).toBe(false)
  })
})
