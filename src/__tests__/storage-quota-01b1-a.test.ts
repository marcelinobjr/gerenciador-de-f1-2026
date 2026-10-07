import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  canonicalRaceStateBackendService,
  type CanonicalRaceBackendContext,
} from '@/services/canonicalRaceStateBackendService'
import type { CanonicalRaceState } from '@/types/canonical-race-v2'

function createSampleRaceState(overrides: Partial<CanonicalRaceState> = {}): CanonicalRaceState {
  return {
    version: '2.0',
    saveSchemaVersion: 'race-save-v1',
    raceVariant: 'MAIN_RACE',
    careerId: 'career_test_01',
    season: 2026,
    round: 3,
    raceId: 'race_2026_03',
    circuitName: 'Albert Park Circuit',
    circuitCountry: 'Australia',
    circuitLengthKm: 5.278,
    totalLaps: 58,
    currentLap: 15,
    status: 'running',
    safetyCarActive: false,
    vscActive: false,
    redFlagActive: false,
    weather: 'seco',
    simSpeed: 1,
    drivers: [],
    driverLookup: {},
    playerTeamId: 'team_audi',
    tactics: { drv1: 'attack', drv2: 'normal' },
    paceOrders: { drv1: 'empurrar', drv2: 'normal' },
    revision: 15,
    updatedAt: new Date().toISOString(),
    raceSeed: 424242,
    events: [
      {
        id: 'evt_1',
        lap: 12,
        type: 'overtake',
        message: 'Piloto ultrapassou na curva 3',
        timestamp: new Date().toISOString(),
      },
    ],
    ...overrides,
  }
}

describe('storage-quota-01b1-a: Adaptador PocketBase para Race State Canônico', () => {
  let mockGetFirstListItem: any
  let mockGetOne: any
  let mockCreate: any
  let mockUpdate: any

  beforeEach(() => {
    vi.restoreAllMocks()
    canonicalRaceStateBackendService.clearCachesForTesting()

    mockGetFirstListItem = vi.fn()
    mockGetOne = vi.fn()
    mockCreate = vi.fn()
    mockUpdate = vi.fn()

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'canonical_race_states') {
        return {
          getFirstListItem: mockGetFirstListItem,
          getOne: mockGetOne,
          create: mockCreate,
          update: mockUpdate,
        } as any
      }
      return {} as any
    })
  })

  // A1 — SAVE/READ: salvar um race state, ler; payload equivalente.
  it('A1 — SAVE/READ: salvar um race state, ler; payload equivalente', async () => {
    const ctx: CanonicalRaceBackendContext = {
      careerId: 'career_alpha',
      season: 2026,
      round: 5,
      variant: 'MAIN_RACE',
    }

    const originalState = createSampleRaceState({
      careerId: 'career_alpha',
      season: 2026,
      round: 5,
      currentLap: 22,
      totalLaps: 52,
    })

    // Setup mock para save inicial (registro não existe, depois é criado)
    mockGetFirstListItem.mockRejectedValueOnce(new Error('Record not found'))
    mockCreate.mockResolvedValueOnce({
      id: 'rec_pb_123',
      session_key: 'race_state_career_alpha_s2026_r5_MAIN_RACE',
      career_id: 'career_alpha',
      season: 2026,
      round: 5,
      variant: 'MAIN_RACE',
      payload: originalState,
    })

    const saveResult = await canonicalRaceStateBackendService.saveRaceState(ctx, originalState)
    expect(saveResult.success).toBe(true)
    expect(saveResult.id).toBe('rec_pb_123')
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        session_key: 'race_state_career_alpha_s2026_r5_MAIN_RACE',
        career_id: 'career_alpha',
        season: 2026,
        round: 5,
        variant: 'MAIN_RACE',
        payload: originalState,
      }),
    )

    // Setup mock para read
    // O ID está no cache em memória, então getOne é chamado com 'rec_pb_123'
    mockGetOne.mockResolvedValueOnce({
      id: 'rec_pb_123',
      session_key: 'race_state_career_alpha_s2026_r5_MAIN_RACE',
      payload: originalState,
    })

    const readState = await canonicalRaceStateBackendService.readRaceState(ctx)
    expect(readState).not.toBeNull()
    expect(readState).toEqual(originalState)
    expect(readState?.currentLap).toBe(22)
    expect(readState?.totalLaps).toBe(52)
    expect(readState?.careerId).toBe('career_alpha')
  })

  // A2 — IDENTIDADE: mesmo career/season/round; MAIN e SPRINT permanecem separados.
  it('A2 — IDENTIDADE: mesmo career/season/round; MAIN e SPRINT permanecem separados', async () => {
    const mainCtx: CanonicalRaceBackendContext = {
      careerId: 'career_beta',
      season: 2026,
      round: 2,
      variant: 'MAIN_RACE',
    }
    const sprintCtx: CanonicalRaceBackendContext = {
      careerId: 'career_beta',
      season: 2026,
      round: 2,
      variant: 'SPRINT_RACE',
    }

    const mainState = createSampleRaceState({
      careerId: 'career_beta',
      raceVariant: 'MAIN_RACE',
      currentLap: 40,
      totalLaps: 56,
    })
    const sprintState = createSampleRaceState({
      careerId: 'career_beta',
      raceVariant: 'SPRINT_RACE',
      currentLap: 12,
      totalLaps: 19,
    })

    const mainKey = canonicalRaceStateBackendService.buildSessionKey(mainCtx)
    const sprintKey = canonicalRaceStateBackendService.buildSessionKey(sprintCtx)

    expect(mainKey).toBe('race_state_career_beta_s2026_r2_MAIN_RACE')
    expect(sprintKey).toBe('race_state_career_beta_s2026_r2_SPRINT_RACE')
    expect(mainKey).not.toEqual(sprintKey)

    // Mock simulando armazenamento chave-valor no backend
    const store = new Map<string, any>()
    mockGetFirstListItem.mockImplementation(async (filter: string) => {
      for (const [key, val] of store.entries()) {
        if (filter.includes(key)) return val
      }
      throw new Error('Record not found')
    })
    mockCreate.mockImplementation(async (data: any) => {
      const rec = { id: `id_${data.session_key}`, ...data }
      store.set(data.session_key, rec)
      return rec
    })
    mockGetOne.mockImplementation(async (id: string) => {
      for (const val of store.values()) {
        if (val.id === id) return val
      }
      throw new Error('Record not found')
    })

    // Salvar ambos
    await canonicalRaceStateBackendService.saveRaceState(mainCtx, mainState)
    await canonicalRaceStateBackendService.saveRaceState(sprintCtx, sprintState)

    // Ler ambos e verificar isolamento
    const loadedMain = await canonicalRaceStateBackendService.readRaceState(mainCtx)
    const loadedSprint = await canonicalRaceStateBackendService.readRaceState(sprintCtx)

    expect(loadedMain).not.toBeNull()
    expect(loadedSprint).not.toBeNull()
    expect(loadedMain?.currentLap).toBe(40)
    expect(loadedMain?.totalLaps).toBe(56)
    expect(loadedMain?.raceVariant).toBe('MAIN_RACE')

    expect(loadedSprint?.currentLap).toBe(12)
    expect(loadedSprint?.totalLaps).toBe(19)
    expect(loadedSprint?.raceVariant).toBe('SPRINT_RACE')
  })

  // A3 — UPSERT: salvar novamente a mesma identidade; leitura retorna a versão nova, sem duplicata lógica.
  it('A3 — UPSERT: salvar novamente a mesma identidade; leitura retorna a versão nova, sem duplicata lógica', async () => {
    const ctx: CanonicalRaceBackendContext = {
      careerId: 'career_gamma',
      season: 2026,
      round: 8,
      variant: 'MAIN_RACE',
    }

    const stateV1 = createSampleRaceState({
      careerId: 'career_gamma',
      season: 2026,
      round: 8,
      currentLap: 10,
      revision: 10,
    })

    const stateV2 = createSampleRaceState({
      careerId: 'career_gamma',
      season: 2026,
      round: 8,
      currentLap: 11,
      revision: 11,
    })

    let backendRecord: any = null

    mockGetFirstListItem.mockImplementation(async () => {
      if (backendRecord) return backendRecord
      throw new Error('Record not found')
    })

    mockCreate.mockImplementation(async (data: any) => {
      backendRecord = { id: 'rec_gamma_1', ...data }
      return backendRecord
    })

    mockUpdate.mockImplementation(async (id: string, data: any) => {
      backendRecord = { ...backendRecord, ...data, id }
      return backendRecord
    })

    mockGetOne.mockImplementation(async (id: string) => {
      if (backendRecord && backendRecord.id === id) return backendRecord
      throw new Error('Record not found')
    })

    // 1. Primeiro save: cria registro
    const res1 = await canonicalRaceStateBackendService.saveRaceState(ctx, stateV1)
    expect(res1.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()

    // Leitura 1
    const read1 = await canonicalRaceStateBackendService.readRaceState(ctx)
    expect(read1?.currentLap).toBe(10)
    expect(read1?.revision).toBe(10)

    // 2. Segundo save com mesma identidade: deve fazer update, não create
    const res2 = await canonicalRaceStateBackendService.saveRaceState(ctx, stateV2)
    expect(res2.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(1) // Continua 1, não duplicou
    expect(mockUpdate).toHaveBeenCalledTimes(1) // Foi chamado update

    // Leitura 2 retorna a versão nova V2
    const read2 = await canonicalRaceStateBackendService.readRaceState(ctx)
    expect(read2?.currentLap).toBe(11)
    expect(read2?.revision).toBe(11)
  })

  // A4 — NOT FOUND: identidade inexistente retorna ausência explícita.
  it('A4 — NOT FOUND: identidade inexistente retorna ausência explícita (null)', async () => {
    const nonexistentCtx: CanonicalRaceBackendContext = {
      careerId: 'career_does_not_exist',
      season: 2026,
      round: 99,
      variant: 'MAIN_RACE',
    }

    mockGetFirstListItem.mockRejectedValue(new Error('Record not found 404'))
    mockGetOne.mockRejectedValue(new Error('Record not found 404'))

    const result = await canonicalRaceStateBackendService.readRaceState(nonexistentCtx)
    expect(result).toBeNull()
  })
})
