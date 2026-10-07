/**
 * storage-quota-01b1-c.test.ts
 *
 * STORAGE-QUOTA-01B1-C — LEITURA/RESUME PREFERINDO BACKEND (POCKETBASE)
 *
 * Contratos validados:
 * C1 — BACKEND PREFERIDO: backend e local possuem state válido diferente; retorno = backend.
 * C2 — BACKEND NOT FOUND: backend retorna null; local válido existe; fallback local.
 * C3 — BACKEND ERROR: backend lança erro/rede indisponível; local válido existe; fallback local + erro observável.
 * C4 — AMBOS AUSENTES: backend null e local ausente; resultado continua sendo ausência de sessão; não inicializa corrida nova.
 * C5 — SPRINT/MAIN: mesmo career/season/round; cada variant carrega seu próprio state.
 * C6 — BACKEND INVÁLIDO: backend retorna payload inválido; local válido existe; rejeição do backend e fallback seguro local.
 * C7 — RESUME REAL: salvar state com lap > 1, ordem alterada, fuel/tyres modificados, flags/state relevantes; carregar pelo fluxo novo; preservação dos mesmos campos, sem reinicialização.
 * C8 — LOAD NÃO ESCREVE: o ato de carregar não chama saveRaceState, não altera backend, não regrava localStorage nesta fase.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import {
  canonicalRaceStateBackendService,
  CanonicalRaceBackendContext,
} from '@/services/canonicalRaceStateBackendService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import type { FinalQualifyingGridEntry } from '@/types/canonical-qualifying-types'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function createMockQualifyingGrid(playerTeamId = 'sauber_audi'): FinalQualifyingGridEntry[] {
  const teams = [
    { id: playerTeamId, name: 'Audi Revolut F1 Team', color: '#C0C0C0' },
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#DC0000' },
    { id: 'red_bull', name: 'Red Bull Racing', color: '#1E41FF' },
    { id: 'mercedes', name: 'Mercedes-AMG F1', color: '#00D2BE' },
    { id: 'mclaren', name: 'McLaren F1 Team', color: '#FF8700' },
    { id: 'aston_martin', name: 'Aston Martin F1', color: '#006F62' },
    { id: 'alpine', name: 'Alpine F1 Team', color: '#0090FF' },
    { id: 'williams', name: 'Williams Racing', color: '#005AFF' },
    { id: 'racing_bulls', name: 'Visa Cash App RB', color: '#6692FF' },
    { id: 'haas', name: 'Haas F1 Team', color: '#B6BABD' },
    { id: 'cadillac', name: 'Cadillac F1 Team', color: '#FFD700' },
    { id: 'andretti', name: 'Andretti Global', color: '#002B49' },
  ]

  const grid: FinalQualifyingGridEntry[] = []
  let pos = 1
  for (const t of teams) {
    const isPlayer = t.id === playerTeamId
    for (let carNum = 1; carNum <= 2; carNum++) {
      grid.push({
        gridPosition: pos,
        driverId: `drv_${t.id}_car${carNum}`,
        driverName: `Driver ${carNum} ${t.name}`,
        teamId: t.id,
        teamName: t.name,
        teamColor: t.color,
        isPlayer,
        carId: isPlayer ? (carNum === 1 ? 'car1' : 'car2') : undefined,
        eliminationStage: pos <= 10 ? 'Q3' : pos <= 18 ? 'Q2' : 'Q1',
        bestLapSec: 80.0 + pos * 0.1,
        bestLapTime: `1:20.${String(pos).padStart(3, '0')}`,
        bestLapCompound: pos <= 10 ? 'macio' : 'medio',
      })
      pos++
    }
  }
  return grid
}

function initializeStandardRace(params?: {
  careerId?: string
  season?: number
  round?: number
  raceVariant?: 'MAIN_RACE' | 'SPRINT_RACE'
  totalLaps?: number
}): CanonicalRaceState {
  const careerId = params?.careerId || 'career_storage_01b1_c_test'
  const season = params?.season ?? 2026
  const round = params?.round ?? 1
  const raceVariant = params?.raceVariant || 'MAIN_RACE'
  const totalLaps = params?.totalLaps ?? 50
  const grid = createMockQualifyingGrid('sauber_audi')

  return canonicalRaceInitializationService.initializeRaceFromCanonicalGrid({
    careerId,
    season,
    round,
    circuitName: 'Sakhir International Circuit',
    circuitCountry: 'Bahrain',
    totalLaps,
    playerTeamId: 'sauber_audi',
    canonicalQualifyingGrid: grid,
    raceVariant,
    persistState: false,
  })
}

describe('STORAGE-QUOTA-01B1-C: Leitura/Resume Preferindo PocketBase', () => {
  beforeEach(() => {
    localStorage.clear()
    canonicalRaceStateBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  // C1 — BACKEND PREFERIDO
  it('C1 — BACKEND PREFERIDO: backend e local possuem state válido diferente; retorno = backend', async () => {
    const localRace = initializeStandardRace({ round: 1 })
    localRace.revision = 10
    localRace.currentLap = 5

    const backendRace = initializeStandardRace({ round: 1 })
    backendRace.revision = 12
    backendRace.currentLap = 8

    // Grava localmente sem espelhar backend
    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(localRace))

    // Mock do backend retornando a versão do backend
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(backendRace)

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )

    expect(result.source).toBe('backend')
    expect(result.state).not.toBeNull()
    expect(result.state!.revision).toBe(12)
    expect(result.state!.currentLap).toBe(8)

    // O wrapper no canonicalRaceInitializationService também deve refletir o mesmo
    const wrappedState = await canonicalRaceInitializationService.readCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    expect(wrappedState).not.toBeNull()
    expect(wrappedState!.revision).toBe(12)
    expect(wrappedState!.currentLap).toBe(8)
  })

  // C2 — BACKEND NOT FOUND
  it('C2 — BACKEND NOT FOUND: backend retorna null; local válido existe; fallback local', async () => {
    const localRace = initializeStandardRace({ round: 2 })
    localRace.revision = 3
    localRace.currentLap = 2

    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(localRace))

    // Backend retorna null (NOT FOUND)
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(null)

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )

    expect(result.source).toBe('local')
    expect(result.state).not.toBeNull()
    expect(result.state!.revision).toBe(3)
    expect(result.state!.currentLap).toBe(2)
    expect(result.backendError).toBeUndefined()
  })

  // C3 — BACKEND ERROR
  it('C3 — BACKEND ERROR: backend lança erro/rede indisponível; local válido existe; fallback local + erro observável', async () => {
    const localRace = initializeStandardRace({ round: 3 })
    localRace.revision = 5
    localRace.currentLap = 10

    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(localRace))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockRejectedValue(
      new Error('503 Service Unavailable: PB timeout'),
    )

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )

    expect(result.source).toBe('local')
    expect(result.state).not.toBeNull()
    expect(result.state!.revision).toBe(5)
    expect(result.backendError).toContain('503 Service Unavailable')
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  // C4 — AMBOS AUSENTES
  it('C4 — AMBOS AUSENTES: backend null e local ausente; resultado continua sendo ausência de sessão; não inicializa corrida nova', async () => {
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(null)

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      'career_empty_test',
      2026,
      99,
      'MAIN_RACE',
    )

    expect(result.source).toBe('none')
    expect(result.state).toBeNull()
  })

  // C5 — SPRINT/MAIN
  it('C5 — SPRINT/MAIN: mesmo career/season/round; cada variant carrega seu próprio state', async () => {
    const mainRace = initializeStandardRace({ round: 4, raceVariant: 'MAIN_RACE' })
    mainRace.currentLap = 25
    mainRace.raceVariant = 'MAIN_RACE'

    const sprintRace = initializeStandardRace({
      round: 4,
      raceVariant: 'SPRINT_RACE',
      totalLaps: 15,
    })
    sprintRace.currentLap = 12
    sprintRace.raceVariant = 'SPRINT_RACE'

    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockImplementation(
      async (ctx: CanonicalRaceBackendContext) => {
        if (ctx.variant === 'SPRINT_RACE') return sprintRace
        return mainRace
      },
    )

    const loadedMain = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      mainRace.careerId,
      mainRace.season,
      mainRace.round,
      'MAIN_RACE',
    )

    const loadedSprint = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      sprintRace.careerId,
      sprintRace.season,
      sprintRace.round,
      'SPRINT_RACE',
    )

    expect(loadedMain.state?.raceVariant).toBe('MAIN_RACE')
    expect(loadedMain.state?.currentLap).toBe(25)

    expect(loadedSprint.state?.raceVariant).toBe('SPRINT_RACE')
    expect(loadedSprint.state?.currentLap).toBe(12)
  })

  // C6 — BACKEND INVÁLIDO
  it('C6 — BACKEND INVÁLIDO: backend retorna payload inválido; local válido existe; rejeição do backend e fallback seguro local', async () => {
    const localRace = initializeStandardRace({ round: 5 })
    localRace.revision = 7
    localRace.currentLap = 15

    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(localRace))

    // Payload corrompido do backend (sem drivers e totalLaps inválido)
    const corruptBackendPayload = {
      careerId: localRace.careerId,
      season: 2026,
      round: 5,
      raceId: 'corrupt',
      totalLaps: -1,
      drivers: [], // Inválido (deve ter 24)
    } as unknown as CanonicalRaceState

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(
      corruptBackendPayload,
    )

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )

    // Rejeita backend e cai com segurança no local
    expect(result.source).toBe('local')
    expect(result.state).not.toBeNull()
    expect(result.state!.revision).toBe(7)
    expect(result.backendError).toContain('Payload inválido no PocketBase')

    warnSpy.mockRestore()
  })

  // C7 — RESUME REAL
  it('C7 — RESUME REAL: salvar state com lap > 1, ordem alterada, fuel/tyres modificados, flags/state relevantes; carregar pelo fluxo novo; preservação dos mesmos campos, sem reinicialização', async () => {
    let race = initializeStandardRace({ round: 6, totalLaps: 50 })
    // Avançar voltas para modificar estado físico
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 4, { seedOverride: 999 })
    expect(race.currentLap).toBe(5)

    // Mock de persistência de backend
    let storedInPB: CanonicalRaceState | null = null
    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockImplementation(
      async (_ctx, state) => {
        storedInPB = state
        return { success: true }
      },
    )
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockImplementation(async () => {
      return storedInPB
    })

    // Salva via saveCanonicalRaceState (que espelha no PB)
    canonicalRaceSaveService.saveCanonicalRaceState(race)

    // Carrega pelo fluxo preferencial
    const loaded = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      race.careerId,
      race.season,
      race.round,
      'MAIN_RACE',
    )

    expect(loaded.source).toBe('backend')
    expect(loaded.state).not.toBeNull()
    const s = loaded.state!

    // Conferir campos essenciais preservados
    expect(s.currentLap).toBe(5)
    expect(s.totalLaps).toBe(50)
    expect(s.drivers).toHaveLength(24)
    expect(s.raceSeed).toBe(race.raceSeed)
    expect(s.driverStrategies).toBeDefined()

    // Pilotos modificados preservam consumo e pneus
    for (let i = 0; i < 24; i++) {
      expect(s.drivers[i].driverId).toBe(race.drivers[i].driverId)
      expect(s.drivers[i].fuel).toBe(race.drivers[i].fuel)
      expect(s.drivers[i].tyreAge).toBe(race.drivers[i].tyreAge)
      expect(s.drivers[i].currentPosition).toBe(race.drivers[i].currentPosition)
    }
  })

  // C8 — LOAD NÃO ESCREVE
  it('C8 — LOAD NÃO ESCREVE: o ato de carregar não chama saveRaceState, não altera backend, não regrava localStorage nesta fase', async () => {
    const backendRace = initializeStandardRace({ round: 7 })
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(backendRace)

    const saveBackendSpy = vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState')
    const saveLocalSpy = vi.spyOn(canonicalRaceSaveService, 'saveCanonicalRaceState')
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const loaded = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      backendRace.careerId,
      backendRace.season,
      backendRace.round,
      'MAIN_RACE',
    )

    expect(loaded.source).toBe('backend')
    expect(loaded.state).not.toBeNull()

    // Nenhuma operação de escrita deve ter sido disparada
    expect(saveBackendSpy).not.toHaveBeenCalled()
    expect(saveLocalSpy).not.toHaveBeenCalled()
    expect(setItemSpy).not.toHaveBeenCalled()
  })
})
