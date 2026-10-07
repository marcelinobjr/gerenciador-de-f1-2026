/**
 * storage-quota-01b1-e.test.ts
 *
 * STORAGE-QUOTA-01B1-E — REDUZIR O RACE STATE PESADO DO LOCALSTORAGE
 *
 * Suíte de testes exigida pelo briefing:
 * E1 — BACKEND CONFIRMADO: save local + backend confirmado → payload pesado local é removido/reduzido.
 * E2 — BACKEND FALHA: save backend falha → local completo permanece.
 * E3 — LAZY MIGRATION: state apenas local → migração backend confirma → local pesado é reduzido.
 * E4 — MIGRAÇÃO FALHA: local continua intacto.
 * E5 — MAIN/SPRINT: redução de uma variant não apaga a outra.
 * E6 — LEGACY: chaves legacy equivalentes limpas somente após confirmação.
 * E7 — RESUME BACKEND: após redução local, resume continua funcionando pelo backend.
 * E8 — BACKEND OFFLINE APÓS REDUÇÃO: não reinicializa corrida; retorna indisponibilidade explícita.
 * E9 — IMPACTO DE TAMANHO: com fixture representativa, confirmar redução mensurável do consumo local da família race state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canonicalRaceSaveService } from '@/services/canonicalRaceSaveService'
import {
  canonicalRaceStateBackendService,
  type CanonicalRaceBackendContext,
} from '@/services/canonicalRaceStateBackendService'
import { canonicalRaceInitializationService } from '@/services/canonicalRaceInitializationService'
import { canonicalRaceEngineService } from '@/services/canonicalRaceEngineService'
import { auditLocalStorageUsage, APEX_STORAGE_FAMILIES } from '@/services/storageQuotaService'
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
  const careerId = params?.careerId || 'career_e_test'
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

describe('STORAGE-QUOTA-01B1-E: REDUZIR O RACE STATE PESADO DO LOCALSTORAGE', () => {
  beforeEach(() => {
    localStorage.clear()
    canonicalRaceStateBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  // E1 — BACKEND CONFIRMADO: save local + backend confirmado → payload pesado local é removido/reduzido
  it('E1 — BACKEND CONFIRMADO: save local grava primeiro; quando backend confirma, payload pesado local é removido', async () => {
    const race = initializeStandardRace({ round: 1 })
    const keyV2 = canonicalRaceSaveService.buildStorageKey(race.careerId, race.season, race.round)
    const keyLegacy = canonicalRaceSaveService.buildLegacyStorageKey(
      race.careerId,
      race.season,
      race.round,
    )

    let resolveSavePromise!: (val: { success: boolean; id?: string }) => void
    const pendingSave = new Promise<{ success: boolean; id?: string }>((resolve) => {
      resolveSavePromise = resolve
    })

    const saveBackendSpy = vi
      .spyOn(canonicalRaceStateBackendService, 'saveRaceState')
      .mockReturnValue(pendingSave)

    // 1. Executa o save: local é gravado síncrono imediatamente
    const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(race)
    expect(saveRes.success).toBe(true)
    expect(saveBackendSpy).toHaveBeenCalledTimes(1)

    // Antes da confirmação do backend, o payload pesado ainda está presente localmente
    expect(localStorage.getItem(keyV2)).not.toBeNull()
    expect(localStorage.getItem(keyLegacy)).not.toBeNull()

    // 2. Backend confirma o salvamento
    resolveSavePromise({ success: true, id: 'pb_rec_e1' })
    await pendingSave
    // Permite que o microtask do .then() execute
    await Promise.resolve()

    // 3. Após confirmação do backend, o payload pesado local é expurgado
    expect(localStorage.getItem(keyV2)).toBeNull()
    expect(localStorage.getItem(keyLegacy)).toBeNull()
  })

  // E2 — BACKEND FALHA: save backend falha → local completo permanece
  it('E2 — BACKEND FALHA: save backend falha → payload local completo permanece intacto para fallback', async () => {
    const race = initializeStandardRace({ round: 2 })
    const keyV2 = canonicalRaceSaveService.buildStorageKey(race.careerId, race.season, race.round)
    const keyLegacy = canonicalRaceSaveService.buildLegacyStorageKey(
      race.careerId,
      race.season,
      race.round,
    )

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    let rejectSavePromise!: (val: { success: boolean; error?: string }) => void
    const pendingSave = new Promise<{ success: boolean; error?: string }>((resolve) => {
      rejectSavePromise = resolve
    })

    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockReturnValue(pendingSave)

    const saveRes = canonicalRaceSaveService.saveCanonicalRaceState(race)
    expect(saveRes.success).toBe(true)

    // Backend retorna falha (ex: timeout de rede ou cota PB)
    rejectSavePromise({ success: false, error: '504 Gateway Timeout' })
    await pendingSave
    await Promise.resolve()

    // Cópia local completa permanece intacta
    const localRaw = localStorage.getItem(keyV2)
    expect(localRaw).not.toBeNull()
    const parsed = JSON.parse(localRaw!) as CanonicalRaceState
    expect(parsed.careerId).toBe(race.careerId)
    expect(parsed.drivers).toHaveLength(24)

    expect(localStorage.getItem(keyLegacy)).not.toBeNull()

    warnSpy.mockRestore()
  })

  // E3 — LAZY MIGRATION: state apenas local → migração backend confirma → local pesado é reduzido
  it('E3 — LAZY MIGRATION: state apenas local → migração backend confirma → local pesado é reduzido', async () => {
    const localRace = initializeStandardRace({ round: 3 })
    localRace.revision = 5
    localRace.currentLap = 10

    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
    )
    const keyLegacy = canonicalRaceSaveService.buildLegacyStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
    )

    // Injeta apenas no localStorage (simulando corrida pré-migração)
    localStorage.setItem(keyV2, JSON.stringify(localRace))
    localStorage.setItem(keyLegacy, JSON.stringify(localRace))

    // Backend responde NOT_FOUND inicialmente
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(null)
    const saveSpy = vi
      .spyOn(canonicalRaceStateBackendService, 'saveRaceState')
      .mockResolvedValue({ success: true, id: 'rec_e3_migrated' })

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
    )

    // Migração ocorreu com sucesso e retornou estado para resume
    expect(result.source).toBe('local_migrated')
    expect(result.state).not.toBeNull()
    expect(result.state!.currentLap).toBe(10)
    expect(saveSpy).toHaveBeenCalledTimes(1)

    // Após confirmação da migração pelo backend, payload pesado local é removido
    expect(localStorage.getItem(keyV2)).toBeNull()
    expect(localStorage.getItem(keyLegacy)).toBeNull()
  })

  // E4 — MIGRAÇÃO FALHA: local continua intacto
  it('E4 — MIGRAÇÃO FALHA: promoção ao backend falha → payload local continua intacto', async () => {
    const localRace = initializeStandardRace({ round: 4 })
    localRace.currentLap = 15

    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
    )
    const keyLegacy = canonicalRaceSaveService.buildLegacyStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
    )

    localStorage.setItem(keyV2, JSON.stringify(localRace))
    localStorage.setItem(keyLegacy, JSON.stringify(localRace))

    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(null)
    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockResolvedValue({
      success: false,
      error: 'PocketBase quota exceeded',
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
    )

    // Não bloqueia o jogador, informa local_migration_failed
    expect(result.source).toBe('local_migration_failed')
    expect(result.state).not.toBeNull()
    expect(result.state!.currentLap).toBe(15)

    // Como backend falhou, o local completo NÃO é removido
    expect(localStorage.getItem(keyV2)).not.toBeNull()
    expect(localStorage.getItem(keyLegacy)).not.toBeNull()

    warnSpy.mockRestore()
  })

  // E5 — MAIN/SPRINT: redução de uma variant não apaga a outra
  it('E5 — MAIN/SPRINT: redução de uma variant não apaga a outra', async () => {
    const careerId = 'career_e5_iso'
    const season = 2026
    const round = 5

    const mainRace = initializeStandardRace({ careerId, season, round, raceVariant: 'MAIN_RACE' })
    const sprintRace = initializeStandardRace({
      careerId,
      season,
      round,
      raceVariant: 'SPRINT_RACE',
      totalLaps: 15,
    })

    const mainKeyV2 = canonicalRaceSaveService.buildStorageKey(careerId, season, round, 'MAIN_RACE')
    const sprintKeyV2 = canonicalRaceSaveService.buildStorageKey(
      careerId,
      season,
      round,
      'SPRINT_RACE',
    )

    // Salvar Sprint localmente e simular falha no backend (fica apenas no local)
    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockImplementation(async (ctx) => {
      if (ctx.variant === 'MAIN_RACE') {
        return { success: true, id: 'rec_main' }
      }
      return { success: false, error: 'Backend down for sprint' }
    })

    canonicalRaceSaveService.saveCanonicalRaceState(sprintRace)
    await Promise.resolve()
    // Sprint deve permanecer no localStorage pois backend falhou
    expect(localStorage.getItem(sprintKeyV2)).not.toBeNull()

    // Agora salva Main: backend confirma sucesso
    canonicalRaceSaveService.saveCanonicalRaceState(mainRace)
    await Promise.resolve()
    await Promise.resolve()

    // Main foi confirmada e sua chave foi expurgada do local
    expect(localStorage.getItem(mainKeyV2)).toBeNull()
    // Sprint NÃO foi afetada e continua preservada localmente
    expect(localStorage.getItem(sprintKeyV2)).not.toBeNull()
    const parsedSprint = JSON.parse(localStorage.getItem(sprintKeyV2)!) as CanonicalRaceState
    expect(parsedSprint.raceVariant).toBe('SPRINT_RACE')
  })

  // E6 — LEGACY: chaves legacy equivalentes limpas somente após confirmação
  it('E6 — LEGACY: chaves v2 e legacy equivalentes são limpas somente após confirmação backend', async () => {
    const race = initializeStandardRace({ round: 6 })
    const keyV2 = canonicalRaceSaveService.buildStorageKey(race.careerId, race.season, race.round)
    const keyLegacy = canonicalRaceSaveService.buildLegacyStorageKey(
      race.careerId,
      race.season,
      race.round,
    )

    let resolveBackend!: (val: { success: boolean }) => void
    const pbPromise = new Promise<{ success: boolean }>((res) => {
      resolveBackend = res
    })
    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockReturnValue(pbPromise)

    canonicalRaceSaveService.saveCanonicalRaceState(race)

    // Durante in-flight: ambas as chaves presentes
    expect(localStorage.getItem(keyV2)).not.toBeNull()
    expect(localStorage.getItem(keyLegacy)).not.toBeNull()

    // Confirmação
    resolveBackend({ success: true })
    await pbPromise
    await Promise.resolve()

    // Ambas as chaves pesadas eliminadas após confirmação
    expect(localStorage.getItem(keyV2)).toBeNull()
    expect(localStorage.getItem(keyLegacy)).toBeNull()
  })

  // E7 — RESUME BACKEND: após redução local, resume continua funcionando pelo backend
  it('E7 — RESUME BACKEND: após redução local, resume continua funcionando perfeitamente pelo PocketBase', async () => {
    let race = initializeStandardRace({ round: 7, totalLaps: 50 })
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 5, { seedOverride: 777 })
    expect(race.currentLap).toBe(6)

    let pbStoredState: CanonicalRaceState | null = null
    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockImplementation(
      async (_ctx, state) => {
        pbStoredState = state
        return { success: true, id: 'pb_r7' }
      },
    )
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockImplementation(async () => {
      return pbStoredState
    })

    // Salva a corrida: vai pro local primeiro, espelha no PB, e após confirmação o local é expurgado
    canonicalRaceSaveService.saveCanonicalRaceState(race)
    await Promise.resolve()
    await Promise.resolve()

    // Confirma que localStorage está vazio para essa corrida
    const keyV2 = canonicalRaceSaveService.buildStorageKey(race.careerId, race.season, race.round)
    expect(localStorage.getItem(keyV2)).toBeNull()

    // Resume / Load: deve ler com perfeição a partir do PocketBase
    const resumed = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      race.careerId,
      race.season,
      race.round,
    )

    expect(resumed.source).toBe('backend')
    expect(resumed.state).not.toBeNull()
    expect(resumed.state!.currentLap).toBe(6)
    expect(resumed.state!.drivers).toHaveLength(24)
    expect(resumed.state!.careerId).toBe(race.careerId)
  })

  // E8 — BACKEND OFFLINE APÓS REDUÇÃO: não reinicializa corrida; retorna indisponibilidade explícita
  it('E8 — BACKEND OFFLINE APÓS REDUÇÃO: se local foi reduzido e backend fica indisponível, retorna indisponibilidade explícita sem inventar corrida do zero', async () => {
    const careerId = 'career_offline_test'
    const season = 2026
    const round = 8

    // Corrida já foi externalizada para o backend anteriormente e o local foi expurgado
    const keyV2 = canonicalRaceSaveService.buildStorageKey(careerId, season, round)
    const keyLegacy = canonicalRaceSaveService.buildLegacyStorageKey(careerId, season, round)
    expect(localStorage.getItem(keyV2)).toBeNull()
    expect(localStorage.getItem(keyLegacy)).toBeNull()

    // Backend agora está totalmente offline (503 / NetworkError)
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockRejectedValue(
      new Error('503 Service Unavailable: Network down'),
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      careerId,
      season,
      round,
    )

    // Retorna erro explícito de backend indisponível e state null
    expect(result.state).toBeNull()
    expect(result.source).toBe('none')
    expect(result.backendError).toContain('503 Service Unavailable')

    // Confirma que NÃO reinicializou corrida nem inventou um snapshot
    expect(result.state).toBeNull()

    warnSpy.mockRestore()
  })

  // E9 — IMPACTO DE TAMANHO: com fixture representativa, confirmar redução mensurável do consumo local da família race state
  it('E9 — IMPACTO DE TAMANHO: com fixture representativa de 24 pilotos e dados de telemetria, confirma redução mensurável do consumo do localStorage', async () => {
    let race = initializeStandardRace({ round: 9, totalLaps: 50 })
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 3, { seedOverride: 456 })

    // 1. Medir o consumo com o race state salvo apenas no localStorage
    const keyV2 = canonicalRaceSaveService.buildStorageKey(race.careerId, race.season, race.round)
    const keyLegacy = canonicalRaceSaveService.buildLegacyStorageKey(
      race.careerId,
      race.season,
      race.round,
    )
    const serialized = JSON.stringify(race)
    localStorage.setItem(keyV2, serialized)
    localStorage.setItem(keyLegacy, serialized)

    const auditBefore = auditLocalStorageUsage()
    const raceStateFamilyBefore = auditBefore.families[APEX_STORAGE_FAMILIES.RACE_STATE]

    expect(raceStateFamilyBefore).toBeDefined()
    expect(raceStateFamilyBefore.count).toBe(2)
    // Snapshot de corrida com 24 carros costuma ter entre 10 KB e 30 KB (x2 = 20KB a 60KB em UTF-16)
    expect(raceStateFamilyBefore.totalBytes).toBeGreaterThan(15000)
    const bytesBefore = raceStateFamilyBefore.totalBytes

    // 2. Agora simular confirmação no backend e purgar o payload pesado local
    canonicalRaceSaveService.purgeHeavyLocalStorageRaceState(race.careerId, race.season, race.round)

    const auditAfter = auditLocalStorageUsage()
    const raceStateFamilyAfter = auditAfter.families[APEX_STORAGE_FAMILIES.RACE_STATE]

    // Consumo da família de race state zerado ou ausente
    const bytesAfter = raceStateFamilyAfter?.totalBytes || 0
    expect(bytesAfter).toBe(0)

    // Redução mensurável comprovada (100% de liberação da família race state)
    const freedBytes = bytesBefore - bytesAfter
    expect(freedBytes).toBeGreaterThan(15000)
  })
})
