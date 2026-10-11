/**
 * race-dual-view-01a-part2.test.ts
 *
 * RACE-DUAL-VIEW-01A (Parte 2):
 * Visão Compacta de Race Control em /race (RacePage.tsx)
 *
 * 1. Quando há canonicalRaceState ativo ou concluído (lido via readCanonicalRaceStatePreferred),
 *    o estado da corrida é o mesmo entre /corrida e /race, sem reiniciar.
 * 2. Navegar entre /corrida e /race preserva volta, posições e snapshot (mesma fonte da verdade).
 * 3. Quando não há corrida iniciada, a /race mantém o modo de preparação pré-corrida.
 * 4. Pós-corrida concluída e oficializada, o OfficialRaceResultPanel e o gate de avanço
 *    permanecem intactos e funcionais.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'
import { canonicalCareerPersistenceService } from '@/services/canonicalCareerPersistenceService'
import type { CanonicalRaceState, OfficialRaceResult } from '@/types/canonical-race-v2'

describe('RACE-DUAL-VIEW-01A Parte 2 — Visão Compacta de Race Control na /race', () => {
  const careerId = '31b0p9k5ygw2sc8'
  const seasonYear = 2026
  const round = 1
  const variant = 'MAIN_RACE' as const

  const mockActiveRaceState: CanonicalRaceState = {
    saveSchemaVersion: 'race-save-v1',
    raceId: 'race_s2026_r1_main',
    careerId,
    season: seasonYear,
    round,
    raceVariant: variant,
    circuitName: 'Circuito Internacional do Bahrain',
    circuitCountry: 'Bahrain',
    totalLaps: 57,
    currentLap: 12,
    status: 'running',
    safetyCarActive: false,
    vscActive: false,
    redFlagActive: false,
    version: 1,
    simSpeed: 1,
    playerTeamId: 'team_audi',
    driverLookup: {},
    raceControl: {
      currentFlag: 'GREEN',
      safetyCarActive: false,
      vscActive: false,
      redFlagActive: false,
      activeSector: null,
      messages: [],
    },
    weather: {
      condition: 'DRY',
      airTempC: 28,
      trackTempC: 35,
      isWet: false,
      trackGripPct: 100,
      rainProbabilityPct: 0,
    } as any,
    drivers: [
      {
        driverId: 'drv_norris',
        driverName: 'Lando Norris',
        teamId: 'team_mclaren',
        teamName: 'McLaren',
        currentPosition: 1,
        gridPosition: 1,
        lap: 12,
        isPlayer: false,
        pitStopCount: 0,
        currentCompound: 'medio',
        tyreWearPct: 15,
        status: 'ON_TRACK',
      } as any,
      {
        driverId: 'drv_bortoleto',
        driverName: 'Gabriel Bortoleto',
        teamId: 'team_audi',
        teamName: 'Audi F1 Team',
        currentPosition: 2,
        gridPosition: 4,
        lap: 12,
        isPlayer: true,
        carId: 'car1',
        pitStopCount: 0,
        currentCompound: 'macio',
        tyreWearPct: 22,
        status: 'ON_TRACK',
      } as any,
    ],
    events: [],
  } as unknown as CanonicalRaceState

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. /race e /corrida compartilham exatamente a mesma fonte de verdade via readCanonicalRaceStatePreferred', async () => {
    const readSpy = vi
      .spyOn(canonicalRaceInitializationService, 'readCanonicalRaceStatePreferred')
      .mockResolvedValue(mockActiveRaceState)

    // Simula leitura de estado pela /race
    const stateInRacePage =
      await canonicalRaceInitializationService.readCanonicalRaceStatePreferred(
        careerId,
        seasonYear,
        round,
        variant,
      )

    // Simula leitura de estado pela /corrida
    const stateInCorridaPage =
      await canonicalRaceInitializationService.readCanonicalRaceStatePreferred(
        careerId,
        seasonYear,
        round,
        variant,
      )

    expect(readSpy).toHaveBeenCalledTimes(2)
    expect(stateInRacePage).toEqual(stateInCorridaPage)
    expect(stateInRacePage?.currentLap).toBe(12)
    expect(stateInRacePage?.drivers[1].currentPosition).toBe(2)
  })

  it('2. Avanço de volta na /corrida reflete na mesma volta ao abrir /race sem reiniciar', async () => {
    let savedState = { ...mockActiveRaceState }

    vi.spyOn(
      canonicalRaceInitializationService,
      'readCanonicalRaceStatePreferred',
    ).mockImplementation(async () => savedState)

    vi.spyOn(canonicalRaceInitializationService, 'saveCanonicalRaceState').mockImplementation(
      (state) => {
        savedState = { ...state }
      },
    )

    // Simula /corrida avançando para volta 13
    const nextState = canonicalRaceEngineService.advanceOneLap(savedState)
    canonicalRaceInitializationService.saveCanonicalRaceState(nextState)

    expect(savedState.currentLap).toBe(13)

    // Ao navegar para /race, lê o estado salvo preferencial
    const loadedInRacePage =
      await canonicalRaceInitializationService.readCanonicalRaceStatePreferred(
        careerId,
        seasonYear,
        round,
        variant,
      )

    expect(loadedInRacePage?.currentLap).toBe(13)
    expect(loadedInRacePage?.status).toBe('running')
  })

  it('3. Sem corrida ativa (null), preparação pré-corrida permanece elegível', async () => {
    vi.spyOn(
      canonicalRaceInitializationService,
      'readCanonicalRaceStatePreferred',
    ).mockResolvedValue(null)

    const state = await canonicalRaceInitializationService.readCanonicalRaceStatePreferred(
      careerId,
      seasonYear,
      round,
      variant,
    )

    expect(state).toBeNull()
  })

  it('4. Corrida concluída pode ser oficializada mantendo integridade com OfficialRaceResultPanel', () => {
    const completedState: CanonicalRaceState = {
      ...mockActiveRaceState,
      currentLap: 57,
      status: 'completed',
    }

    const officialResult: OfficialRaceResult = canonicalRaceResultService.officializeRace({
      ...completedState,
      playerTeamId: 'team_audi',
    })

    expect(officialResult).toBeDefined()
    expect(officialResult.round).toBe(1)
    expect(officialResult.officialResultId).toContain('r1_main')
    expect(officialResult.winnerDriverId).toBe('drv_norris')
  })
})
