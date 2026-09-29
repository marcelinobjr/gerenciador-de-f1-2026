import { describe, it, expect } from 'vitest'
import { canonicalRaceInitializationService } from '../services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '../services/canonicalRaceEngineService'
import type { WeatherTransition } from '../types/climate'

describe('RACE-PROVENANCE-AUDIT-02B-E0: Micro-auditoria Chuva / Decisão Humana', () => {
  const createMockGrid = () => [
    {
      position: 1,
      gridPosition: 1,
      driverId: 'drv_human',
      driverName: 'Human Driver',
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
      driverId: 'drv_ai_1',
      driverName: 'AI Rival',
      teamId: 'ai_team',
      teamName: 'AI Team',
      teamColor: '#00D2BE',
      isPlayer: false,
      grid: 2,
      qBestMs: 80100,
      bestLapSec: 80.1,
      bestLapTime: '1:20.100',
      bestLapCompound: 'macio' as const,
      eliminationStage: 'Q3' as const,
    },
  ]

  it('DRY -> WET: prova transição determinística na volta 3, auto-pit sem consulta humana e troca para intermediario', () => {
    const transitions: WeatherTransition[] = [
      {
        lap: 3,
        condition: 'chuva_fraca',
        rainIntensity: 'LIGHT',
        description: 'Chuva leve atinge a pista',
      },
    ]

    let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'test_audit_e0',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps: 6,
      playerTeamId: 'player_team',
      canonicalQualifyingGrid: createMockGrid() as any,
    })
    state.weatherTransitions = transitions

    // Estado inicial: seco, compostos slick (medio)
    expect(state.weather).toBe('seco')
    const humanD0 = state.drivers.find((d) => d.isPlayer)!
    const aiD0 = state.drivers.find((d) => !d.isPlayer)!
    expect(humanD0.tyreCompound).toBe('medio')
    expect(aiD0.tyreCompound).toBe('medio')

    // Volta 1: seco
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    expect(state.weather).toBe('seco')
    expect(state.drivers.find((d) => d.isPlayer)!.tyreCompound).toBe('medio')

    // Volta 2: seco
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    expect(state.weather).toBe('seco')

    // Volta 3: transição para chuva_fraca!
    // A engine detecta a chuva, agenda pit stop automaticamente para humano e IA (pitRequested: true)
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    expect(state.weather).toBe('chuva_fraca')

    const humanStratL3 = state.driverStrategies[humanD0.driverId]
    const aiStratL3 = state.driverStrategies[aiD0.driverId]

    // Prova E5, E6, E7, E8:
    // Auto-pit disparado pela engine para ambos sem perguntar nada
    expect(humanStratL3.pitRequested).toBe(true)
    expect(humanStratL3.targetCompound).toBe('intermediario')
    expect(aiStratL3.pitRequested).toBe(true)
    expect(aiStratL3.targetCompound).toBe('intermediario')

    // Volta 4: pit stop executado automaticamente
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    const humanL4 = state.drivers.find((d) => d.isPlayer)!
    const aiL4 = state.drivers.find((d) => !d.isPlayer)!

    expect(humanL4.tyreCompound).toBe('intermediario')
    expect(aiL4.tyreCompound).toBe('intermediario')
    expect(humanL4.pitStops).toBe(1)
    expect(aiL4.pitStops).toBe(1)

    // Voltas 5 e 6: permanecem na pista com intermediario
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    expect(state.status).toBe('completed')
  })

  it('WET -> DRY: prova transição determinística na volta 3 de chuva_fraca para seco, auto-pit para medio', () => {
    const transitions: WeatherTransition[] = [
      {
        lap: 3,
        condition: 'seco',
        description: 'Pista seca novamente',
      },
    ]

    let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'test_audit_e0_wet_dry',
      season: 2026,
      round: 1,
      circuitName: 'Albert Park',
      circuitCountry: 'Austrália',
      totalLaps: 6,
      playerTeamId: 'player_team',
      canonicalQualifyingGrid: createMockGrid() as any,
    })
    state.weatherTransitions = transitions

    // Forçar clima inicial como chuva_fraca e pneus intermediários
    state.weather = 'chuva_fraca'
    state.drivers = state.drivers.map((d) => ({
      ...d,
      tyreCompound: 'intermediario',
    }))

    // Volta 1 e 2: chuva_fraca, carros continuam com intermediario
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    expect(state.weather).toBe('chuva_fraca')
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    expect(state.weather).toBe('chuva_fraca')

    // Volta 3: transiciona para seco!
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    expect(state.weather).toBe('seco')

    const humanStratL3 = state.driverStrategies['drv_human']
    const aiStratL3 = state.driverStrategies['drv_ai_1']

    // Engine programa pit stop automaticamente para voltar a pneus secos ('medio')
    expect(humanStratL3.pitRequested).toBe(true)
    expect(humanStratL3.targetCompound).toBe('medio')
    expect(aiStratL3.pitRequested).toBe(true)
    expect(aiStratL3.targetCompound).toBe('medio')

    // Volta 4: pit efetuado, trocam para 'medio'
    state = canonicalRaceEngineService.advanceOneLap(state, { persistState: false })
    const humanL4 = state.drivers.find((d) => d.isPlayer)!
    const aiL4 = state.drivers.find((d) => !d.isPlayer)!

    expect(humanL4.tyreCompound).toBe('medio')
    expect(aiL4.tyreCompound).toBe('medio')
    expect(humanL4.pitStops).toBe(1)
    expect(aiL4.pitStops).toBe(1)
  })
})
