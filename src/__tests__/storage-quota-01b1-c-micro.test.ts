/**
 * storage-quota-01b1-c-micro.test.ts
 *
 * STORAGE-QUOTA-01B1-C-MICRO — LOAD PREFERINDO BACKEND (POCKETBASE)
 *
 * Suíte de testes mínimos exigida pelo briefing:
 * C1 — BACKEND: backend possui state válido → retorno é backend.
 * C2 — NOT FOUND: backend retorna null, local válido existe → retorno é local.
 * C3 — BACKEND ERROR: backend falha, local válido existe → retorno é local e erro é observável.
 * C4 — MAIN/SPRINT: mesma career/season/round → cada variant lê seu próprio state.
 * C5 — LOAD NÃO ESCREVE: confirmar que saveRaceState não é chamado e localStorage não é regravado.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import {
  canonicalRaceStateBackendService,
  type CanonicalRaceBackendContext,
} from '@/services/canonicalRaceStateBackendService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
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
  const careerId = params?.careerId || 'career_micro_c_test'
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

describe('storage-quota-01b1-c-micro: LOAD PREFERINDO BACKEND', () => {
  beforeEach(() => {
    localStorage.clear()
    canonicalRaceStateBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  // C1 — BACKEND: backend possui state válido → retorno é backend.
  it('C1 — BACKEND: backend possui state válido → retorno é backend', async () => {
    const localRace = initializeStandardRace({ round: 1 })
    localRace.revision = 2
    localRace.currentLap = 3

    const backendRace = initializeStandardRace({ round: 1 })
    backendRace.revision = 5
    backendRace.currentLap = 10

    // Grava localmente com valor diferente
    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(localRace))

    // Backend retorna state válido
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(backendRace)

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )

    expect(result.source).toBe('backend')
    expect(result.state).not.toBeNull()
    expect(result.state!.revision).toBe(5)
    expect(result.state!.currentLap).toBe(10)

    // Wrapper assíncrono em canonicalRaceInitializationService
    const wrapped = await canonicalRaceInitializationService.readCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    expect(wrapped).not.toBeNull()
    expect(wrapped!.revision).toBe(5)
    expect(wrapped!.currentLap).toBe(10)
  })

  // C2 — NOT FOUND: backend retorna null, local válido existe → retorno é local_migrated (ou local com promoção).
  it('C2 — NOT FOUND: backend retorna null, local válido existe → retorno é local com promoção ou fallback local', async () => {
    const localRace = initializeStandardRace({ round: 2 })
    localRace.revision = 4
    localRace.currentLap = 6

    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(localRace))

    // Backend retorna null (NOT_FOUND) e saveRaceState confirma
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(null)
    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockResolvedValue({ success: true })

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )

    expect(['local', 'local_migrated']).toContain(result.source)
    expect(result.state).not.toBeNull()
    expect(result.state!.revision).toBe(4)
    expect(result.state!.currentLap).toBe(6)
    expect(result.backendError).toBeUndefined()
  })
  // C3 — BACKEND ERROR: backend falha, local válido existe → retorno é local e erro é observável.
  it('C3 — BACKEND ERROR: backend falha, local válido existe → retorno é local e erro é observável', async () => {
    const localRace = initializeStandardRace({ round: 3 })
    localRace.revision = 8
    localRace.currentLap = 15

    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(localRace))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockRejectedValue(
      new Error('PocketBase Network Connection Error'),
    )

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )

    expect(result.source).toBe('local')
    expect(result.state).not.toBeNull()
    expect(result.state!.revision).toBe(8)
    expect(result.state!.currentLap).toBe(15)
    expect(result.backendError).toBe('PocketBase Network Connection Error')
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  // C4 — MAIN/SPRINT: mesma career/season/round → cada variant lê seu próprio state.
  it('C4 — MAIN/SPRINT: mesma career/season/round → cada variant lê seu próprio state', async () => {
    const mainRace = initializeStandardRace({ round: 4, raceVariant: 'MAIN_RACE' })
    mainRace.currentLap = 40
    mainRace.raceVariant = 'MAIN_RACE'

    const sprintRace = initializeStandardRace({
      round: 4,
      raceVariant: 'SPRINT_RACE',
      totalLaps: 15,
    })
    sprintRace.currentLap = 9
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
    expect(loadedMain.state?.currentLap).toBe(40)

    expect(loadedSprint.state?.raceVariant).toBe('SPRINT_RACE')
    expect(loadedSprint.state?.currentLap).toBe(9)
  })

  // C5 — LOAD NÃO ESCREVE: confirmar que saveRaceState não é chamado e localStorage não é regravado.
  it('C5 — LOAD NÃO ESCREVE: confirmar que saveRaceState não é chamado e localStorage não é regravado', async () => {
    const backendRace = initializeStandardRace({ round: 5 })
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

    expect(saveBackendSpy).not.toHaveBeenCalled()
    expect(saveLocalSpy).not.toHaveBeenCalled()
    expect(setItemSpy).not.toHaveBeenCalled()
  })
})
