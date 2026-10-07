/**
 * storage-quota-01b1-b.test.ts
 *
 * STORAGE-QUOTA-01B1-B — ESPELHAR A ESCRITA DO RACE STATE NO POCKETBASE
 *
 * Contratos validados:
 * B1 — MAIN SAVE: executar o save real da corrida principal. Confirmar: localStorage continua sendo escrito; backend recebe state equivalente.
 * B2 — SPRINT SAVE: mesmo para Sprint (variant = 'SPRINT_RACE').
 * B3 — ISOLAMENTO: MAIN e SPRINT da mesma rodada geram dois registros distintos.
 * B4 — ATUALIZAÇÃO: salvar mesma sessão novamente após avanço de volta. Backend recebe state atualizado da mesma identidade, sem duplicata lógica.
 * B5 — FALHA DE BACKEND: simular backend indisponível. Confirmar: fluxo local atual não é destruído; erro backend fica explícito/observável; nenhum sucesso falso do backend.
 * B6 — PAYLOAD: comparar campos essenciais entre state salvo localmente e payload backend: lap; drivers/order; tyres; fuel; flags; session identity.
 *
 * Proibições respeitadas:
 * - Não alterar leitura/resume (readRaceState continua NÃO usado no fluxo vivo de load);
 * - Não remover localStorage;
 * - Não criar DTO alternativo;
 * - Manter 100% de compatibilidade e integridade.
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
  const careerId = params?.careerId || 'career_storage_01b1_test'
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
    persistState: false, // para controlarmos o momento exato de salvar
  })
}

describe('STORAGE-QUOTA-01B1-B: Espelhamento da Escrita no PocketBase', () => {
  beforeEach(() => {
    localStorage.clear()
    canonicalRaceStateBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  // B1 — MAIN SAVE
  it('B1 — MAIN SAVE: executar o save real da corrida principal; confirma que localStorage continua sendo escrito e backend recebe state equivalente', async () => {
    const race = initializeStandardRace({ raceVariant: 'MAIN_RACE' })
    const saveBackendSpy = vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState')

    const saveResult = canonicalRaceSaveService.saveCanonicalRaceState(race)
    expect(saveResult.success).toBe(true)

    // 1. LocalStorage gravado nas chaves v2 e legacy
    const keyV2 = canonicalRaceSaveService.buildStorageKey(
      race.careerId,
      race.season,
      race.round,
      'MAIN_RACE',
    )
    const keyLegacy = canonicalRaceSaveService.buildLegacyStorageKey(
      race.careerId,
      race.season,
      race.round,
      'MAIN_RACE',
    )
    expect(localStorage.getItem(keyV2)).not.toBeNull()
    expect(localStorage.getItem(keyLegacy)).not.toBeNull()

    // 2. Backend chamado com contexto exato e payload correspondente
    expect(saveBackendSpy).toHaveBeenCalledTimes(1)
    const [calledCtx, calledState] = saveBackendSpy.mock.calls[0]

    expect(calledCtx.careerId).toBe(race.careerId)
    expect(calledCtx.season).toBe(race.season)
    expect(calledCtx.round).toBe(race.round)
    expect(calledCtx.variant).toBe('MAIN_RACE')

    expect(calledState.careerId).toBe(race.careerId)
    expect(calledState.currentLap).toBe(race.currentLap)
    expect(calledState.drivers).toHaveLength(24)

    // Aguardar resolução do backend
    const backendResult = await saveBackendSpy.mock.results[0].value
    expect(backendResult).toBeDefined()
  })

  // B2 — SPRINT SAVE
  it('B2 — SPRINT SAVE: salva Sprint com raceVariant = SPRINT_RACE; confirma que backend recebe variant SPRINT_RACE', async () => {
    const sprintRace = initializeStandardRace({ raceVariant: 'SPRINT_RACE', totalLaps: 15 })
    const saveBackendSpy = vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState')

    const saveResult = canonicalRaceSaveService.saveCanonicalRaceState(sprintRace)
    expect(saveResult.success).toBe(true)

    const keySprintV2 = canonicalRaceSaveService.buildStorageKey(
      sprintRace.careerId,
      sprintRace.season,
      sprintRace.round,
      'SPRINT_RACE',
    )
    expect(localStorage.getItem(keySprintV2)).not.toBeNull()

    expect(saveBackendSpy).toHaveBeenCalledTimes(1)
    const [calledCtx, calledState] = saveBackendSpy.mock.calls[0]
    expect(calledCtx.variant).toBe('SPRINT_RACE')
    expect(calledState.raceVariant).toBe('SPRINT_RACE')
  })

  // B3 — ISOLAMENTO
  it('B3 — ISOLAMENTO: MAIN e SPRINT da mesma rodada geram dois contextos e session_keys distintos no backend', async () => {
    const mainRace = initializeStandardRace({ round: 2, raceVariant: 'MAIN_RACE' })
    const sprintRace = initializeStandardRace({ round: 2, raceVariant: 'SPRINT_RACE' })

    const savedCalls: Array<{ ctx: CanonicalRaceBackendContext; state: CanonicalRaceState }> = []
    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockImplementation(
      async (ctx, state) => {
        savedCalls.push({ ctx, state })
        return { success: true, id: `rec_${ctx.variant}` }
      },
    )

    canonicalRaceSaveService.saveCanonicalRaceState(mainRace)
    canonicalRaceSaveService.saveCanonicalRaceState(sprintRace)

    expect(savedCalls).toHaveLength(2)

    const mainCall = savedCalls.find((c) => c.ctx.variant === 'MAIN_RACE')!
    const sprintCall = savedCalls.find((c) => c.ctx.variant === 'SPRINT_RACE')!

    expect(mainCall).toBeDefined()
    expect(sprintCall).toBeDefined()

    const mainKey = canonicalRaceStateBackendService.buildSessionKey(mainCall.ctx)
    const sprintKey = canonicalRaceStateBackendService.buildSessionKey(sprintCall.ctx)

    expect(mainKey).not.toBe(sprintKey)
    expect(mainKey).toContain('_MAIN_RACE')
    expect(sprintKey).toContain('_SPRINT_RACE')
  })

  // B4 — ATUALIZAÇÃO
  it('B4 — ATUALIZAÇÃO: salvar mesma sessão novamente após avanço de volta; backend recebe state atualizado da mesma identidade', async () => {
    let race = initializeStandardRace({ round: 3, totalLaps: 50 })
    const backendHistory: CanonicalRaceState[] = []

    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockImplementation(
      async (_ctx, state) => {
        backendHistory.push(state)
        return { success: true, id: 'rec_s3_r3' }
      },
    )

    // Salvar volta 1
    canonicalRaceSaveService.saveCanonicalRaceState(race)
    expect(backendHistory).toHaveLength(1)
    expect(backendHistory[0].currentLap).toBe(1)

    // Avançar 3 voltas
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 3, { seedOverride: 42 })
    expect(race.currentLap).toBe(4)

    // Salvar volta 4
    canonicalRaceSaveService.saveCanonicalRaceState(race)
    expect(backendHistory).toHaveLength(2)
    expect(backendHistory[1].currentLap).toBe(4)
    expect(backendHistory[1].revision).toBeGreaterThan(backendHistory[0].revision || 0)
  })

  // B5 — FALHA DE BACKEND
  it('B5 — FALHA DE BACKEND: backend indisponível ou rejeitando; fluxo local continua funcionando e erro é observável via console.warn', async () => {
    const race = initializeStandardRace({ round: 4 })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Simular falha de rede / 500 no backend
    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockResolvedValueOnce({
      success: false,
      error: 'NetworkError: connection timed out',
    })

    const saveResult = canonicalRaceSaveService.saveCanonicalRaceState(race)

    // O fluxo local não é interrompido
    expect(saveResult.success).toBe(true)

    // LocalStorage continua com o dado íntegro
    const key = canonicalRaceSaveService.buildStorageKey(race.careerId, race.season, race.round)
    expect(localStorage.getItem(key)).not.toBeNull()

    // Aguardar tick para a promise interna do backend resolver
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Erro do backend fica explícito e observável
    expect(warnSpy).toHaveBeenCalled()
    const foundWarning = warnSpy.mock.calls.some((args) =>
      args.some(
        (a) => typeof a === 'string' && a.includes('Falha ao espelhar race state no PocketBase'),
      ),
    )
    expect(foundWarning).toBe(true)

    warnSpy.mockRestore()
  })

  // B6 — PAYLOAD
  it('B6 — PAYLOAD: compara campos essenciais entre state salvo localmente e payload backend (lap, drivers/order, tyres, fuel, flags, session identity)', async () => {
    let race = initializeStandardRace({ round: 5, totalLaps: 50 })
    // Avançar 2 voltas para ter desgaste de pneus, combustível consumido e tempos
    race = canonicalRaceEngineService.advanceMultipleLaps(race, 2, { seedOverride: 888 })

    let capturedBackendPayload: CanonicalRaceState | null = null
    vi.spyOn(canonicalRaceStateBackendService, 'saveRaceState').mockImplementation(
      async (_ctx, state) => {
        capturedBackendPayload = state
        return { success: true }
      },
    )

    canonicalRaceSaveService.saveCanonicalRaceState(race)

    const key = canonicalRaceSaveService.buildStorageKey(race.careerId, race.season, race.round)
    const localSaved = JSON.parse(localStorage.getItem(key)!) as CanonicalRaceState

    expect(capturedBackendPayload).not.toBeNull()
    const backendSaved = capturedBackendPayload!

    // 1. Session identity
    expect(backendSaved.careerId).toBe(localSaved.careerId)
    expect(backendSaved.season).toBe(localSaved.season)
    expect(backendSaved.round).toBe(localSaved.round)
    expect(backendSaved.raceId).toBe(localSaved.raceId)
    expect(backendSaved.raceVariant).toBe(localSaved.raceVariant)

    // 2. Lap & status
    expect(backendSaved.currentLap).toBe(localSaved.currentLap)
    expect(backendSaved.totalLaps).toBe(localSaved.totalLaps)
    expect(backendSaved.status).toBe(localSaved.status)

    // 3. Flags & Race control
    expect(backendSaved.raceControl?.currentFlag).toBe(localSaved.raceControl?.currentFlag)
    expect(backendSaved.safetyCarActive).toBe(localSaved.safetyCarActive)
    expect(backendSaved.vscActive).toBe(localSaved.vscActive)
    expect(backendSaved.redFlagActive).toBe(localSaved.redFlagActive)

    // 4. Drivers / Order / Tyres / Fuel
    expect(backendSaved.drivers).toHaveLength(24)
    expect(localSaved.drivers).toHaveLength(24)

    for (let i = 0; i < 24; i++) {
      const dBackend = backendSaved.drivers[i]
      const dLocal = localSaved.drivers[i]

      expect(dBackend.driverId).toBe(dLocal.driverId)
      expect(dBackend.currentPosition).toBe(dLocal.currentPosition)
      expect(dBackend.tyreCompound).toBe(dLocal.tyreCompound)
      expect(dBackend.tyreAge).toBe(dLocal.tyreAge)
      expect(dBackend.fuel).toBe(dLocal.fuel)
      expect(dBackend.raceTime).toBe(dLocal.raceTime)
    }

    // 5. Invariante: load continua vindo do localStorage e NÃO do PocketBase
    const readSpy = vi.spyOn(canonicalRaceStateBackendService, 'readRaceState')
    const loadedLocally = canonicalRaceSaveService.loadCanonicalRaceState(
      race.careerId,
      race.season,
      race.round,
    )
    expect(loadedLocally.state).not.toBeNull()
    expect(readSpy).not.toHaveBeenCalled()
  })
})
