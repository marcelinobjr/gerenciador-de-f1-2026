/**
 * storage-quota-01b1-d.test.ts
 *
 * STORAGE-QUOTA-01B1-D — LAZY MIGRATION DO RACE STATE LOCAL PARA BACKEND
 *
 * Suíte de testes exigida pelo briefing:
 * D1 — MIGRAÇÃO: backend NOT_FOUND + local válido → saveRaceState chamado uma vez; backend recebe payload equivalente; retorno continua utilizável para resume.
 * D2 — PRÓXIMA LEITURA: após D1, nova leitura retorna backend; nenhuma nova migração ocorre.
 * D3 — BACKEND JÁ EXISTE: backend válido → não chama saveRaceState.
 * D4 — BACKEND ERROR: backend indisponível + local válido → fallback local funciona; não tenta migração.
 * D5 — LOCAL AUSENTE: backend NOT_FOUND + local ausente → retorna none; não cria registro vazio.
 * D6 — LOCAL INVÁLIDO: backend NOT_FOUND + local inválido → não migra payload corrompido.
 * D7 — SPRINT/MAIN: migração de uma variant não interfere na outra.
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
  const careerId = params?.careerId || 'career_d_test'
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

describe('STORAGE-QUOTA-01B1-D: LAZY MIGRATION DO RACE STATE LOCAL PARA BACKEND', () => {
  beforeEach(() => {
    localStorage.clear()
    canonicalRaceStateBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  // D1 — MIGRAÇÃO: backend NOT_FOUND + local válido → saveRaceState chamado uma vez; backend recebe payload equivalente; retorno continua utilizável para resume.
  it('D1 — MIGRAÇÃO: backend NOT_FOUND + local válido → saveRaceState chamado uma vez; backend recebe payload equivalente; retorno continua utilizável para resume', async () => {
    const localRace = initializeStandardRace({ round: 1 })
    localRace.revision = 7
    localRace.currentLap = 12

    // Grava apenas no localStorage
    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(localRace))

    // Backend retorna NOT_FOUND (null)
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(null)
    const saveSpy = vi
      .spyOn(canonicalRaceStateBackendService, 'saveRaceState')
      .mockResolvedValue({ success: true, id: 'rec_d1_migrated' })

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )

    // Confirma retorno utilizável para resume
    expect(result.state).not.toBeNull()
    expect(result.state!.revision).toBe(7)
    expect(result.state!.currentLap).toBe(12)
    expect(result.source).toBe('local_migrated')

    // Confirma que saveRaceState foi chamado exatamente uma vez com o contexto e payload corretos
    expect(saveSpy).toHaveBeenCalledTimes(1)
    const [savedCtx, savedPayload] = saveSpy.mock.calls[0]
    expect(savedCtx).toEqual({
      careerId: localRace.careerId,
      season: localRace.season,
      round: localRace.round,
      variant: 'MAIN_RACE',
    })
    expect(savedPayload.careerId).toBe(localRace.careerId)
    expect(savedPayload.currentLap).toBe(12)
    expect(savedPayload.drivers).toHaveLength(24)

    // Cópia local NÃO é apagada nesta rodada
    expect(localStorage.getItem(keyV2)).not.toBeNull()

    // Teste também da falha de migração com salvamento falhando
    saveSpy.mockResolvedValueOnce({ success: false, error: 'Database quota exceeded' })
    const failedResult = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    expect(failedResult.state).not.toBeNull()
    expect(failedResult.source).toBe('local_migration_failed')
    expect(failedResult.migrationError).toBe('Database quota exceeded')
    expect(failedResult.error).toBe('Database quota exceeded')
  })

  // D2 — PRÓXIMA LEITURA: após D1, nova leitura retorna backend; nenhuma nova migração ocorre.
  it('D2 — PRÓXIMA LEITURA: após D1, nova leitura retorna backend; nenhuma nova migração ocorre', async () => {
    const race = initializeStandardRace({ round: 2 })
    race.revision = 3
    race.currentLap = 5

    // Simula estado que já foi salvo/migrado no backend e ainda está no local
    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      race.careerId,
      race.season,
      race.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(race))

    // Backend agora retorna o estado que foi promovido
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(race)
    const saveSpy = vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState')

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      race.careerId,
      race.season,
      race.round,
      'MAIN_RACE',
    )

    // Retorna backend
    expect(result.source).toBe('backend')
    expect(result.state).not.toBeNull()
    expect(result.state!.revision).toBe(3)
    // Nenhuma chamada a saveRaceState deve ocorrer
    expect(saveSpy).not.toHaveBeenCalled()
  })

  // D3 — BACKEND JÁ EXISTE: backend válido → não chama saveRaceState.
  it('D3 — BACKEND JÁ EXISTE: backend válido → não chama saveRaceState', async () => {
    const localRace = initializeStandardRace({ round: 3 })
    localRace.revision = 1
    localRace.currentLap = 2

    const backendRace = initializeStandardRace({ round: 3 })
    backendRace.revision = 10
    backendRace.currentLap = 15

    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(localRace))

    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(backendRace)
    const saveSpy = vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState')

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )

    expect(result.source).toBe('backend')
    expect(result.state!.revision).toBe(10)
    expect(saveSpy).not.toHaveBeenCalled()
  })

  // D4 — BACKEND ERROR: backend indisponível + local válido → fallback local funciona; não tenta migração.
  it('D4 — BACKEND ERROR: backend indisponível + local válido → fallback local funciona; não tenta migração', async () => {
    const localRace = initializeStandardRace({ round: 4 })
    localRace.revision = 4
    localRace.currentLap = 8

    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )
    localStorage.setItem(keyV2, JSON.stringify(localRace))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Backend lança erro de rede / 503
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockRejectedValue(
      new Error('503 Service Unavailable: Timeout to PB'),
    )
    const saveSpy = vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState')

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      localRace.careerId,
      localRace.season,
      localRace.round,
      'MAIN_RACE',
    )

    // Fallback local funciona normalmente com erro observável
    expect(result.source).toBe('local')
    expect(result.state).not.toBeNull()
    expect(result.state!.revision).toBe(4)
    expect(result.backendError).toContain('503 Service Unavailable')

    // NÃO tenta migração cega se backend está com erro
    expect(saveSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  // D5 — LOCAL AUSENTE: backend NOT_FOUND + local ausente → retorna none; não cria registro vazio.
  it('D5 — LOCAL AUSENTE: backend NOT_FOUND + local ausente → retorna none; não cria registro vazio', async () => {
    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(null)
    const saveSpy = vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState')

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      'career_no_state',
      2026,
      99,
      'MAIN_RACE',
    )

    expect(result.source).toBe('none')
    expect(result.state).toBeNull()
    expect(saveSpy).not.toHaveBeenCalled()
  })

  // D6 — LOCAL INVÁLIDO: backend NOT_FOUND + local inválido → não migra payload corrompido.
  it('D6 — LOCAL INVÁLIDO: backend NOT_FOUND + local inválido → não migra payload corrompido', async () => {
    const corruptKey = canonicalRaceSaveService.buildStorageKey(
      'career_corrupt_test',
      2026,
      5,
      'MAIN_RACE',
    )
    // Grava JSON corrompido ou payload faltando campos fundamentais
    localStorage.setItem(
      corruptKey,
      JSON.stringify({
        careerId: 'career_corrupt_test',
        season: 2026,
        round: 5,
        drivers: [{ incomplete: true }],
      }),
    )

    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockResolvedValue(null)
    const saveSpy = vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      'career_corrupt_test',
      2026,
      5,
      'MAIN_RACE',
    )

    // Local falha validação, não deve salvar no backend
    expect(result.state).toBeNull()
    expect(result.source).toBe('none')
    expect(saveSpy).not.toHaveBeenCalled()

    errSpy.mockRestore()
  })

  // D7 — SPRINT/MAIN: migração de uma variant não interfere na outra.
  it('D7 — SPRINT/MAIN: migração de uma variant não interfere na outra', async () => {
    const careerId = 'career_d7_sprint_main'
    const season = 2026
    const round = 6

    const mainRace = initializeStandardRace({ careerId, season, round, raceVariant: 'MAIN_RACE' })
    mainRace.currentLap = 20

    const sprintRace = initializeStandardRace({
      careerId,
      season,
      round,
      raceVariant: 'SPRINT_RACE',
      totalLaps: 15,
    })
    sprintRace.currentLap = 7

    // Grava apenas o SPRINT no local, MAIN já existe no backend
    const sprintKey = canonicalRaceSaveService.buildStorageKey(
      careerId,
      season,
      round,
      'SPRINT_RACE',
    )
    localStorage.setItem(sprintKey, JSON.stringify(sprintRace))

    vi.spyOn(canonicalRaceStateBackendService, 'readRaceState').mockImplementation(
      async (ctx: CanonicalRaceBackendContext) => {
        if (ctx.variant === 'MAIN_RACE') return mainRace
        // SPRINT_RACE não existe no backend ainda (NOT_FOUND)
        return null
      },
    )

    const saveSpy = vi
      .spyOn(canonicalRaceStateBackendService, 'saveRaceState')
      .mockResolvedValue({ success: true, id: 'rec_sprint_migrated' })

    // 1. Carrega MAIN: backend já existe -> não migra
    const mainLoaded = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      careerId,
      season,
      round,
      'MAIN_RACE',
    )
    expect(mainLoaded.source).toBe('backend')
    expect(mainLoaded.state?.raceVariant).toBe('MAIN_RACE')
    expect(saveSpy).not.toHaveBeenCalled()

    // 2. Carrega SPRINT: backend NOT_FOUND + local válido -> migra SPRINT
    const sprintLoaded = await canonicalRaceSaveService.loadCanonicalRaceStatePreferred(
      careerId,
      season,
      round,
      'SPRINT_RACE',
    )
    expect(sprintLoaded.source).toBe('local_migrated')
    expect(sprintLoaded.state?.raceVariant).toBe('SPRINT_RACE')
    expect(sprintLoaded.state?.currentLap).toBe(7)

    expect(saveSpy).toHaveBeenCalledTimes(1)
    const [savedCtx, savedPayload] = saveSpy.mock.calls[0]
    expect(savedCtx.variant).toBe('SPRINT_RACE')
    expect(savedPayload.raceVariant).toBe('SPRINT_RACE')
  })
})
