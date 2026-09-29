import { describe, it, expect } from 'vitest'
import { canonicalRaceInitializationService } from '../services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'
import { raceStrategyService } from '../services/raceStrategyService'
import { canonicalRaceSaveService } from '../services/canonicalRaceSaveService'
import type { WeatherTransition } from '../types/climate'

describe('RACE-PROVENANCE-AUDIT-02B-E1A: Backend da Decisão Humana em Mudança de Clima', () => {
  const createMockGrid = () => [
    {
      position: 1,
      gridPosition: 1,
      driverId: 'drv_human_1',
      driverName: 'Human Driver 1',
      teamId: 'player_team',
      teamName: 'Player Team',
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
      driverName: 'Human Driver 2',
      teamId: 'player_team',
      teamName: 'Player Team',
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
      driverName: 'AI Rival 1',
      teamId: 'ai_team',
      teamName: 'AI Team',
      teamColor: '#00D2BE',
      isPlayer: false,
      grid: 3,
      qBestMs: 80100,
      bestLapSec: 80.1,
      bestLapTime: '1:20.100',
      bestLapCompound: 'macio' as const,
      eliminationStage: 'Q3' as const,
    },
    {
      position: 4,
      gridPosition: 4,
      driverId: 'drv_ai_2',
      driverName: 'AI Rival 2',
      teamId: 'ai_team',
      teamName: 'AI Team',
      teamColor: '#00D2BE',
      isPlayer: false,
      grid: 4,
      qBestMs: 80150,
      bestLapSec: 80.15,
      bestLapTime: '1:20.150',
      bestLapCompound: 'macio' as const,
      eliminationStage: 'Q3' as const,
    },
  ]

  const initTestRace = (transitions: WeatherTransition[], totalLaps = 8) => {
    const state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'test_e1a_career',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps,
      playerTeamId: 'player_team',
      canonicalQualifyingGrid: createMockGrid() as any,
    })
    state.weatherTransitions = transitions
    return state
  }

  // E1A-01: DRY→WET cria pending decision para carro humano
  it('E1A-01: DRY→WET cria pending decision para carro humano na transição', () => {
    let state = initTestRace([
      { lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT', description: 'Chuva leve' },
    ])

    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 1
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 2
    expect(state.pendingWeatherDecision).toBeUndefined()

    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 3 (transição!)
    expect(state.weather).toBe('chuva_fraca')
    expect(state.pendingWeatherDecision).toBeDefined()
    expect(state.pendingWeatherDecision?.active).toBe(true)
    expect(state.pendingWeatherDecision?.transition).toBe('DRY_TO_WET')
    expect(state.pendingWeatherDecision?.triggeredLap).toBe(3)
    expect(state.pendingWeatherDecision?.drivers.length).toBe(2)
    expect(state.pendingWeatherDecision?.drivers.map((d) => d.driverId)).toContain('drv_human_1')
    expect(state.pendingWeatherDecision?.drivers.map((d) => d.driverId)).toContain('drv_human_2')
  })

  // E1A-02: carro humano NÃO recebe auto-pit antes da decisão
  it('E1A-02: carro humano NÃO recebe auto-pit antes da decisão', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 3

    const humanStrat1 = state.driverStrategies?.['drv_human_1']
    const humanStrat2 = state.driverStrategies?.['drv_human_2']
    expect(humanStrat1?.pitRequested).toBeFalsy()
    expect(humanStrat1?.pitThisLap).toBeFalsy()
    expect(humanStrat2?.pitRequested).toBeFalsy()
    expect(humanStrat2?.pitThisLap).toBeFalsy()
  })

  // E1A-03: IA continua recebendo reação automática
  it('E1A-03: IA continua recebendo reação automática', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 3

    const aiStrat1 = state.driverStrategies?.['drv_ai_1']
    const aiStrat2 = state.driverStrategies?.['drv_ai_2']
    expect(aiStrat1?.pitRequested).toBe(true)
    expect(aiStrat1?.targetCompound).toBe('intermediario')
    expect(aiStrat2?.pitRequested).toBe(true)
    expect(aiStrat2?.targetCompound).toBe('intermediario')
  })

  // E1A-04: dois carros humanos recebem decisões independentes
  it('E1A-04: dois carros humanos recebem decisões independentes', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    // Decisão para Carro 1: PIT_NOW + intermediario
    const res1 = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'intermediario',
    })
    expect(res1.success).toBe(true)
    state = res1.updatedState

    // Carro 1 decidido, Carro 2 ainda pendente
    const pwd1 = state.pendingWeatherDecision!
    expect(pwd1.drivers.find((d) => d.driverId === 'drv_human_1')?.status).toBe('decided')
    expect(pwd1.drivers.find((d) => d.driverId === 'drv_human_1')?.action).toBe('PIT_NOW')
    expect(pwd1.drivers.find((d) => d.driverId === 'drv_human_2')?.status).toBe('pending')
    expect(pwd1.active).toBe(true) // Ainda ativa pois Carro 2 falta decidir

    // Decisão para Carro 2: STAY_OUT
    const res2 = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_2',
      action: 'STAY_OUT',
    })
    expect(res2.success).toBe(true)
    state = res2.updatedState

    const pwd2 = state.pendingWeatherDecision!
    expect(pwd2.drivers.find((d) => d.driverId === 'drv_human_2')?.status).toBe('decided')
    expect(pwd2.drivers.find((d) => d.driverId === 'drv_human_2')?.action).toBe('STAY_OUT')
    expect(pwd2.active).toBe(false) // Ambos decidiram!
  })

  // E1A-05: DNF não recebe decisão
  it('E1A-05: DNF não recebe decisão pendente', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    // Marcar drv_human_2 como DNF na volta 2
    const h2 = state.drivers.find((d) => d.driverId === 'drv_human_2')!
    h2.raceStatus = 'dnf'
    h2.isDnf = true
    h2.dnfReason = 'Quebra de Motor'

    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 3

    expect(state.pendingWeatherDecision).toBeDefined()
    expect(state.pendingWeatherDecision?.drivers.length).toBe(1)
    expect(state.pendingWeatherDecision?.drivers[0].driverId).toBe('drv_human_1')
  })

  // E1A-06: advanceOneLap bloqueia enquanto existe decisão pendente
  it('E1A-06: advanceOneLap bloqueia enquanto existe decisão pendente', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 3 transição

    expect(state.status).toBe('awaiting_player_weather_decision')
    const currentLapBefore = state.currentLap

    // Tentar avançar enquanto pendente
    const blockedState = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    expect(blockedState.currentLap).toBe(currentLapBefore)
    expect(blockedState.status).toBe('awaiting_player_weather_decision')
  })

  // E1A-07: PIT_NOW + intermediário gera instrução canônica de pit
  it('E1A-07: PIT_NOW + intermediário gera instrução canônica de pit', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    const res = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'intermediario',
    })
    expect(res.success).toBe(true)
    const strat = res.updatedState.driverStrategies?.['drv_human_1']
    expect(strat?.pitRequested).toBe(true)
    expect(strat?.pitThisLap).toBe(true)
    expect(strat?.targetCompound).toBe('intermediario')
  })

  // E1A-08: PIT_NOW + chuva extrema gera instrução canônica de pit
  it('E1A-08: PIT_NOW + chuva extrema gera instrução canônica de pit', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_forte', rainIntensity: 'HEAVY' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    const res = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'chuva_extrema',
    })
    expect(res.success).toBe(true)
    const strat = res.updatedState.driverStrategies?.['drv_human_1']
    expect(strat?.pitRequested).toBe(true)
    expect(strat?.targetCompound).toBe('chuva_extrema')
  })

  // E1A-09: STAY_OUT não gera pit
  it('E1A-09: STAY_OUT não gera pit e preserva composto atual', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    const res = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_1',
      action: 'STAY_OUT',
    })
    expect(res.success).toBe(true)
    const strat = res.updatedState.driverStrategies?.['drv_human_1']
    expect(strat?.pitRequested).toBe(false)
    expect(strat?.pitThisLap).toBe(false)
  })

  // E1A-10: quando todos os carros decidem, corrida pode continuar
  it('E1A-10: quando todos os carros decidem, corrida pode continuar', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 3

    // Submeter decisões para ambos os pilotos
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

    // Agora advanceOneLap deve avançar normalmente para a volta 4!
    const nextState = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    expect(nextState.currentLap).toBe(4)
    // Carro 1 fez pit stop para intermediario
    expect(nextState.drivers.find((d) => d.driverId === 'drv_human_1')?.tyreCompound).toBe(
      'intermediario',
    )
    // Carro 2 ficou na pista com medio
    expect(nextState.drivers.find((d) => d.driverId === 'drv_human_2')?.tyreCompound).toBe('medio')
  })

  // E1A-11: WET→DRY também cria decisão humana
  it('E1A-11: WET→DRY também cria decisão humana', () => {
    let state = initTestRace([{ lap: 3, condition: 'seco', description: 'Pista seca' }])
    state.weather = 'chuva_fraca'
    state.drivers = state.drivers.map((d) => ({ ...d, tyreCompound: 'intermediario' }))

    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 1
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 2
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 3 (seca!)

    expect(state.weather).toBe('seco')
    expect(state.pendingWeatherDecision).toBeDefined()
    expect(state.pendingWeatherDecision?.active).toBe(true)
    expect(state.pendingWeatherDecision?.transition).toBe('WET_TO_DRY')
    expect(state.status).toBe('awaiting_player_weather_decision')
  })

  // E1A-12: WET→DRY aceita composto seco (macio, medio, duro)
  it('E1A-12: WET→DRY aceita composto seco', () => {
    let state = initTestRace([{ lap: 3, condition: 'seco' }])
    state.weather = 'chuva_fraca'
    state.drivers = state.drivers.map((d) => ({ ...d, tyreCompound: 'intermediario' }))
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    const res = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'duro',
    })
    expect(res.success).toBe(true)
    expect(res.updatedState.driverStrategies?.['drv_human_1']?.targetCompound).toBe('duro')
  })

  // E1A-13: composto inválido para condição é rejeitado
  it('E1A-13: composto inválido para condição é rejeitado', () => {
    // Caso DRY->WET tentando pneu seco
    let stateDry = initTestRace([{ lap: 3, condition: 'chuva_fraca' }])
    stateDry = canonicalRaceEngineService.advanceOneLap(stateDry, { persistState: false })
    stateDry = canonicalRaceEngineService.advanceOneLap(stateDry, { persistState: false })
    stateDry = canonicalRaceEngineService.advanceOneLap(stateDry, { persistState: false })

    const resInvalidDry = raceStrategyService.submitWeatherDecision({
      raceState: stateDry,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'macio',
    })
    expect(resInvalidDry.success).toBe(false)
    expect(resInvalidDry.error).toContain('Composto inválido')

    // Caso WET->DRY tentando pneu de chuva
    let stateWet = initTestRace([{ lap: 3, condition: 'seco' }])
    stateWet.weather = 'chuva_fraca'
    stateWet = canonicalRaceEngineService.advanceOneLap(stateWet, { persistState: false })
    stateWet = canonicalRaceEngineService.advanceOneLap(stateWet, { persistState: false })
    stateWet = canonicalRaceEngineService.advanceOneLap(stateWet, { persistState: false })

    const resInvalidWet = raceStrategyService.submitWeatherDecision({
      raceState: stateWet,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'intermediario',
    })
    expect(resInvalidWet.success).toBe(false)
    expect(resInvalidWet.error).toContain('Composto inválido')
  })

  // E1A-14: save/reload preserva decisão pendente
  it('E1A-14: save/reload preserva decisão pendente', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 3

    // Carro 1 decide, Carro 2 fica pendente
    state = raceStrategyService.submitWeatherDecision({
      raceState: state,
      driverId: 'drv_human_1',
      action: 'PIT_NOW',
      selectedCompound: 'intermediario',
    }).updatedState

    // Salvar estado
    const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(state)
    expect(saveRes.success).toBe(true)

    // Recarregar
    const loadRes = canonicalRaceSaveService.loadCanonicalRaceState(
      state.careerId,
      state.season,
      state.round,
    )
    expect(loadRes.state).toBeDefined()
    const loaded = loadRes.state!
    expect(loaded.pendingWeatherDecision?.active).toBe(true)
    expect(loaded.pendingWeatherDecision?.transition).toBe('DRY_TO_WET')
    expect(
      loaded.pendingWeatherDecision?.drivers.find((d) => d.driverId === 'drv_human_1')?.status,
    ).toBe('decided')
    expect(
      loaded.pendingWeatherDecision?.drivers.find((d) => d.driverId === 'drv_human_2')?.status,
    ).toBe('pending')
    expect(loaded.status).toBe('awaiting_player_weather_decision')
  })

  // E1A-15: reload não executa auto-decision
  it('E1A-15: reload não executa auto-decision e continua bloqueando', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })

    canonicalRaceSaveService.saveCanonicalRaceState(state)

    const loaded = canonicalRaceSaveService.loadCanonicalRaceState(
      state.careerId,
      state.season,
      state.round,
    ).state!

    // Continua bloqueando advanceOneLap
    const advanceAttempt = canonicalRaceEngineService.advanceOneLap(loaded, { persistState: false })
    expect(advanceAttempt.currentLap).toBe(3)
    expect(advanceAttempt.status).toBe('awaiting_player_weather_decision')
    expect(advanceAttempt.driverStrategies?.['drv_human_1']?.pitRequested).toBeFalsy()
  })

  // E1A-16: mesma transição não duplica pending decision
  it('E1A-16: mesma transição não duplica pending decision', () => {
    let state = initTestRace([{ lap: 3, condition: 'chuva_fraca', rainIntensity: 'LIGHT' }])
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false }) // lap 3

    const key1 = state.pendingWeatherDecision?.decisionKey
    expect(key1).toBeDefined()

    // Chamar advanceOneLap novamente não deve recriar nem apagar as decisões
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    expect(state.pendingWeatherDecision?.decisionKey).toBe(key1)
    expect(state.pendingWeatherDecision?.drivers.length).toBe(2)
  })
})
