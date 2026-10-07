import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  canonicalWeekendTyreBackendService,
  type CanonicalWeekendTyreBackendContext,
} from '@/services/canonicalWeekendTyreBackendService'
import type { StoredWeekendTireData } from '@/services/canonicalWeekendTyrePersistence'
import type { TireSetItem } from '@/types/f1'

function createSampleStoredWeekendTireData(
  seasonId = 'season_2026',
  round = 1,
  overrides: Partial<StoredWeekendTireData> = {},
): StoredWeekendTireData {
  const driver1Sets: TireSetItem[] = [
    {
      id: 'set_d1_s1',
      tyreSetId: 'set_d1_s1',
      driverId: 'drv_norris',
      compound: 'macio',
      wear: 0,
      condition: 100,
      lapsUsed: 0,
      isFitted: true,
      status: 'instalado',
    },
    {
      id: 'set_d1_m1',
      tyreSetId: 'set_d1_m1',
      driverId: 'drv_norris',
      compound: 'medio',
      wear: 15,
      condition: 85,
      lapsUsed: 8,
      isFitted: false,
      status: 'usado',
    },
    {
      id: 'set_d1_h1',
      tyreSetId: 'set_d1_h1',
      driverId: 'drv_norris',
      compound: 'duro',
      wear: 0,
      condition: 100,
      lapsUsed: 0,
      isFitted: false,
      status: 'disponivel',
    },
  ]

  const driver2Sets: TireSetItem[] = [
    {
      id: 'set_d2_s1',
      tyreSetId: 'set_d2_s1',
      driverId: 'drv_piastri',
      compound: 'macio',
      wear: 0,
      condition: 100,
      lapsUsed: 0,
      isFitted: false,
      status: 'disponivel',
    },
  ]

  return {
    seasonId,
    round,
    isSprint: false,
    allotmentRules: {
      format: 'standard',
      slicks: {
        duro: 2,
        medio: 3,
        macio: 8,
        total: 13,
      },
      wet: {
        intermediario: 4,
        chuva_extrema: 3,
        total: 7,
      },
      totalSetsPerDriver: 20,
      totalTyresPerDriver: 80,
    },
    inventoriesByDriver: {
      drv_norris: driver1Sets,
      drv_piastri: driver2Sets,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('storage-quota-01b2-a: Adaptador PocketBase para Inventário Canônico de Pneus', () => {
  let mockGetFirstListItem: any
  let mockGetOne: any
  let mockCreate: any
  let mockUpdate: any

  beforeEach(() => {
    vi.restoreAllMocks()
    canonicalWeekendTyreBackendService.clearCachesForTesting()

    mockGetFirstListItem = vi.fn()
    mockGetOne = vi.fn()
    mockCreate = vi.fn()
    mockUpdate = vi.fn()

    vi.spyOn(pb, 'collection').mockImplementation((colName: string) => {
      if (colName === 'canonical_weekend_tyres') {
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

  // A1 — SAVE/READ: salvar inventário, ler, payload equivalente.
  it('A1 — SAVE/READ: salvar inventário, ler, payload equivalente', async () => {
    const ctx: CanonicalWeekendTyreBackendContext = {
      careerId: 'career_player_01',
      season: 2026,
      round: 1,
    }

    const originalPayload = createSampleStoredWeekendTireData('season_2026', 1)

    // Setup mock para save inicial (registro não existe, depois é criado)
    mockGetFirstListItem.mockRejectedValueOnce(new Error('Record not found'))
    mockCreate.mockResolvedValueOnce({
      id: 'rec_pb_tire_101',
      inventory_key: 'tyre_inv_career_player_01_s2026_r1_all',
      career_id: 'career_player_01',
      season: 2026,
      round: 1,
      driver_id: '',
      payload: originalPayload,
    })

    const saveResult = await canonicalWeekendTyreBackendService.saveInventory(ctx, originalPayload)
    expect(saveResult.success).toBe(true)
    expect(saveResult.id).toBe('rec_pb_tire_101')
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        inventory_key: 'tyre_inv_career_player_01_s2026_r1_all',
        career_id: 'career_player_01',
        season: 2026,
        round: 1,
        payload: originalPayload,
      }),
    )

    // Setup mock para read (recupera do cache de ID)
    mockGetOne.mockResolvedValueOnce({
      id: 'rec_pb_tire_101',
      inventory_key: 'tyre_inv_career_player_01_s2026_r1_all',
      payload: originalPayload,
    })

    const readPayload =
      await canonicalWeekendTyreBackendService.readInventory<StoredWeekendTireData>(ctx)
    expect(readPayload).not.toBeNull()
    expect(readPayload).toEqual(originalPayload)
    expect(readPayload?.inventoriesByDriver.drv_norris[0].tyreSetId).toBe('set_d1_s1')
    expect(readPayload?.inventoriesByDriver.drv_norris[0].wear).toBe(0)
    expect(readPayload?.inventoriesByDriver.drv_norris[1].wear).toBe(15)
    expect(readPayload?.inventoriesByDriver.drv_norris[1].lapsUsed).toBe(8)
    expect(readPayload?.inventoriesByDriver.drv_norris[1].status).toBe('usado')
  })

  // A2 — ISOLAMENTO DE RODADA: mesmo piloto/carreira em rounds diferentes não colidem.
  it('A2 — ISOLAMENTO DE RODADA: mesmo piloto/carreira em rounds diferentes não colidem', async () => {
    const round1Ctx: CanonicalWeekendTyreBackendContext = {
      careerId: 'career_player_01',
      season: 2026,
      round: 1,
      driverId: 'drv_norris',
    }
    const round2Ctx: CanonicalWeekendTyreBackendContext = {
      careerId: 'career_player_01',
      season: 2026,
      round: 2,
      driverId: 'drv_norris',
    }

    const keyR1 = canonicalWeekendTyreBackendService.buildInventoryKey(round1Ctx)
    const keyR2 = canonicalWeekendTyreBackendService.buildInventoryKey(round2Ctx)

    expect(keyR1).toBe('tyre_inv_career_player_01_s2026_r1_drv_drv_norris')
    expect(keyR2).toBe('tyre_inv_career_player_01_s2026_r2_drv_drv_norris')
    expect(keyR1).not.toBe(keyR2)

    const payloadR1: TireSetItem[] = [
      {
        id: 'r1_set_1',
        tyreSetId: 'r1_set_1',
        driverId: 'drv_norris',
        compound: 'macio',
        wear: 45,
        condition: 55,
        lapsUsed: 12,
        status: 'usado',
      },
    ]

    const payloadR2: TireSetItem[] = [
      {
        id: 'r2_set_1',
        tyreSetId: 'r2_set_1',
        driverId: 'drv_norris',
        compound: 'macio',
        wear: 0,
        condition: 100,
        lapsUsed: 0,
        status: 'disponivel',
      },
    ]

    const store = new Map<string, any>()
    mockGetFirstListItem.mockImplementation(async (filter: string) => {
      for (const [k, v] of store.entries()) {
        if (filter.includes(k)) return v
      }
      throw new Error('Record not found')
    })
    mockCreate.mockImplementation(async (data: any) => {
      const rec = { id: `id_${data.inventory_key}`, ...data }
      store.set(data.inventory_key, rec)
      return rec
    })
    mockGetOne.mockImplementation(async (id: string) => {
      for (const v of store.values()) {
        if (v.id === id) return v
      }
      throw new Error('Record not found')
    })

    await canonicalWeekendTyreBackendService.saveInventory(round1Ctx, payloadR1)
    await canonicalWeekendTyreBackendService.saveInventory(round2Ctx, payloadR2)

    const readR1 = await canonicalWeekendTyreBackendService.readInventory<TireSetItem[]>(round1Ctx)
    const readR2 = await canonicalWeekendTyreBackendService.readInventory<TireSetItem[]>(round2Ctx)

    expect(readR1).not.toBeNull()
    expect(readR2).not.toBeNull()
    expect(readR1![0].id).toBe('r1_set_1')
    expect(readR1![0].wear).toBe(45)
    expect(readR2![0].id).toBe('r2_set_1')
    expect(readR2![0].wear).toBe(0)
  })

  // A3 — ISOLAMENTO DE CARREIRA: mesmo season/round/driver em carreira diferente não colide.
  it('A3 — ISOLAMENTO DE CARREIRA: mesmo season/round/driver em carreira diferente não colide', async () => {
    const careerAlphaCtx: CanonicalWeekendTyreBackendContext = {
      careerId: 'career_alpha',
      season: 2026,
      round: 4,
      driverId: 'drv_verstappen',
    }
    const careerBetaCtx: CanonicalWeekendTyreBackendContext = {
      careerId: 'career_beta',
      season: 2026,
      round: 4,
      driverId: 'drv_verstappen',
    }

    const keyAlpha = canonicalWeekendTyreBackendService.buildInventoryKey(careerAlphaCtx)
    const keyBeta = canonicalWeekendTyreBackendService.buildInventoryKey(careerBetaCtx)

    expect(keyAlpha).toBe('tyre_inv_career_alpha_s2026_r4_drv_drv_verstappen')
    expect(keyBeta).toBe('tyre_inv_career_beta_s2026_r4_drv_drv_verstappen')
    expect(keyAlpha).not.toBe(keyBeta)

    const payloadAlpha: TireSetItem[] = [
      {
        id: 'alpha_set_1',
        tyreSetId: 'alpha_set_1',
        driverId: 'drv_verstappen',
        compound: 'duro',
        wear: 20,
        lapsUsed: 15,
        status: 'usado',
      },
    ]

    const payloadBeta: TireSetItem[] = [
      {
        id: 'beta_set_1',
        tyreSetId: 'beta_set_1',
        driverId: 'drv_verstappen',
        compound: 'duro',
        wear: 80,
        lapsUsed: 35,
        status: 'usado',
      },
    ]

    const store = new Map<string, any>()
    mockGetFirstListItem.mockImplementation(async (filter: string) => {
      for (const [k, v] of store.entries()) {
        if (filter.includes(k)) return v
      }
      throw new Error('Record not found')
    })
    mockCreate.mockImplementation(async (data: any) => {
      const rec = { id: `id_${data.inventory_key}`, ...data }
      store.set(data.inventory_key, rec)
      return rec
    })
    mockGetOne.mockImplementation(async (id: string) => {
      for (const v of store.values()) {
        if (v.id === id) return v
      }
      throw new Error('Record not found')
    })

    await canonicalWeekendTyreBackendService.saveInventory(careerAlphaCtx, payloadAlpha)
    await canonicalWeekendTyreBackendService.saveInventory(careerBetaCtx, payloadBeta)

    const readAlpha =
      await canonicalWeekendTyreBackendService.readInventory<TireSetItem[]>(careerAlphaCtx)
    const readBeta =
      await canonicalWeekendTyreBackendService.readInventory<TireSetItem[]>(careerBetaCtx)

    expect(readAlpha).not.toBeNull()
    expect(readBeta).not.toBeNull()
    expect(readAlpha![0].id).toBe('alpha_set_1')
    expect(readAlpha![0].wear).toBe(20)
    expect(readBeta![0].id).toBe('beta_set_1')
    expect(readBeta![0].wear).toBe(80)
  })

  // A4 — UPSERT: salvar novamente mesma identidade com wear/lapsUsed alterados; leitura retorna versão nova sem duplicata lógica.
  it('A4 — UPSERT: salvar novamente mesma identidade com wear/lapsUsed alterados; leitura retorna versão nova sem duplicata lógica', async () => {
    const ctx: CanonicalWeekendTyreBackendContext = {
      careerId: 'career_gamma',
      season: 2026,
      round: 6,
      driverId: 'drv_leclerc',
    }

    const inventoryV1: TireSetItem[] = [
      {
        id: 'set_lec_1',
        tyreSetId: 'set_lec_1',
        driverId: 'drv_leclerc',
        compound: 'macio',
        wear: 0,
        condition: 100,
        lapsUsed: 0,
        status: 'disponivel',
      },
    ]

    const inventoryV2: TireSetItem[] = [
      {
        id: 'set_lec_1',
        tyreSetId: 'set_lec_1',
        driverId: 'drv_leclerc',
        compound: 'macio',
        wear: 38,
        condition: 62,
        lapsUsed: 14,
        status: 'usado',
      },
    ]

    let backendRecord: any = null

    mockGetFirstListItem.mockImplementation(async () => {
      if (backendRecord) return backendRecord
      throw new Error('Record not found')
    })

    mockCreate.mockImplementation(async (data: any) => {
      backendRecord = { id: 'rec_gamma_lec_1', ...data }
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
    const res1 = await canonicalWeekendTyreBackendService.saveInventory(ctx, inventoryV1)
    expect(res1.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).not.toHaveBeenCalled()

    // Leitura 1
    const read1 = await canonicalWeekendTyreBackendService.readInventory<TireSetItem[]>(ctx)
    expect(read1![0].wear).toBe(0)
    expect(read1![0].lapsUsed).toBe(0)

    // 2. Segundo save com mesma identidade e desgaste alterado: deve fazer update, não create
    const res2 = await canonicalWeekendTyreBackendService.saveInventory(ctx, inventoryV2)
    expect(res2.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(1) // Não duplicou
    expect(mockUpdate).toHaveBeenCalledTimes(1) // Chamou update

    // Leitura 2 retorna a versão nova V2
    const read2 = await canonicalWeekendTyreBackendService.readInventory<TireSetItem[]>(ctx)
    expect(read2![0].wear).toBe(38)
    expect(read2![0].lapsUsed).toBe(14)
    expect(read2![0].condition).toBe(62)
    expect(read2![0].status).toBe('usado')
  })

  // A5 — NOT FOUND: identidade inexistente retorna null/ausência explícita.
  it('A5 — NOT FOUND: identidade inexistente retorna null/ausência explícita', async () => {
    const nonexistentCtx: CanonicalWeekendTyreBackendContext = {
      careerId: 'career_ghost',
      season: 2026,
      round: 99,
      driverId: 'drv_unknown',
    }

    mockGetFirstListItem.mockRejectedValue(new Error('Record not found 404'))
    mockGetOne.mockRejectedValue(new Error('Record not found 404'))

    const result = await canonicalWeekendTyreBackendService.readInventory(nonexistentCtx)
    expect(result).toBeNull()
  })
})
