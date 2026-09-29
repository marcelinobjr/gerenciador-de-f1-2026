import { describe, it, expect } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import type { WeatherTransition } from '@/types/climate'

describe('RACE-PROVENANCE-AUDIT-02B-E0: Micro-auditoria Chuva / Decisão Humana', () => {
  it('E0-01: Transição DRY -> WET — IA reage automaticamente, equipe humana não recebe prompt/pausa', () => {
    const transitions: WeatherTransition[] = [
      { lap: 3, condition: 'chuva_fraca', description: 'Chuva leve na volta 3' },
    ]

    let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'test_career_e0',
      season: 2026,
      round: 4,
      circuitName: 'Bahrain',
      totalLaps: 6,
      playerTeamId: 'team_audi',
      weather: 'seco',
      weatherTransitions: transitions,
    })

    expect(state.weather).toBe('seco')

    // Volta 1: seco
    state = canonicalRaceEngineService.advanceOneLap(state)
    expect(state.currentLap).toBe(1)
    expect(state.weather).toBe('seco')

    // Volta 2: seco
    state = canonicalRaceEngineService.advanceOneLap(state)
    expect(state.currentLap).toBe(2)
    expect(state.weather).toBe('seco')

    // Volta 3: transição para chuva_fraca
    state = canonicalRaceEngineService.advanceOneLap(state)
    expect(state.currentLap).toBe(3)
    expect(state.weather).toBe('chuva_fraca')

    // Na volta 3, a engine detecta a chuva no loop de estratégias (linhas 710-745 de canonicalRaceEngineService)
    // Para TODOS os carros (humanos e IA), a engine aciona needsWeatherPit = true e seta strat.pitRequested = true
    // strat.targetCompound = 'intermediario'
    const playerDrivers = state.drivers.filter((d) => d.teamId === 'team_audi')
    const aiDrivers = state.drivers.filter((d) => d.teamId !== 'team_audi')

    expect(playerDrivers.length).toBeGreaterThan(0)
    expect(aiDrivers.length).toBeGreaterThan(0)

    // O status da corrida nunca entra em 'awaiting_decision' ou 'paused'
    expect(state.status).toBe('running')

    // Na volta 4, os carros realizam o pit automático sem intervenção ou confirmação do jogador
    state = canonicalRaceEngineService.advanceOneLap(state)
    expect(state.currentLap).toBe(4)
    expect(state.weather).toBe('chuva_fraca')

    // Pilotos trocaram automaticamente para intermediário
    playerDrivers.forEach((p) => {
      const updated = state.drivers.find((d) => d.driverId === p.driverId)
      expect(updated?.tyreCompound).toBe('intermediario')
      expect(updated?.pitStops).toBe(1)
    })
  })

  it('E0-02: Transição WET -> DRY — Carros em pneu de chuva trocam automaticamente para médio', () => {
    const transitions: WeatherTransition[] = [
      { lap: 3, condition: 'seco', description: 'Pista seca na volta 3' },
    ]

    let state = canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
      careerId: 'test_career_e0_wet',
      season: 2026,
      round: 4,
      circuitName: 'Bahrain',
      totalLaps: 6,
      playerTeamId: 'team_audi',
      weather: 'chuva_fraca',
      weatherTransitions: transitions,
    })

    // Colocar pilotos com intermediario na largada
    state = {
      ...state,
      drivers: state.drivers.map((d) => ({
        ...d,
        tyreCompound: 'intermediario',
      })),
    }

    // Volta 1: chuva_fraca
    state = canonicalRaceEngineService.advanceOneLap(state)
    expect(state.currentLap).toBe(1)

    // Volta 2: chuva_fraca
    state = canonicalRaceEngineService.advanceOneLap(state)
    expect(state.currentLap).toBe(2)

    // Volta 3: transição para seco
    state = canonicalRaceEngineService.advanceOneLap(state)
    expect(state.currentLap).toBe(3)
    expect(state.weather).toBe('seco')

    // Volta 4: pit automático para médio
    state = canonicalRaceEngineService.advanceOneLap(state)
    expect(state.currentLap).toBe(4)

    const playerCar = state.drivers.find((d) => d.teamId === 'team_audi')
    expect(playerCar?.tyreCompound).toBe('medio')
    expect(playerCar?.pitStops).toBe(1)
  })
})
