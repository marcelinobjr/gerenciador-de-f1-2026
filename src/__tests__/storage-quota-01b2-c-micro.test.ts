import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  canonicalWeekendTyrePersistence,
  type StoredWeekendTireData,
} from '@/services/canonicalWeekendTyrePersistence'
import { canonicalWeekendTyreBackendService } from '@/services/canonicalWeekendTyreBackendService'
import type { TireSetItem } from '@/types/f1'

function createSampleStoredWeekendTireData(
  seasonId = 'career_c_test',
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
      wear: 10,
      condition: 90,
      lapsUsed: 5,
      isFitted: false,
      status: 'usado',
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

describe('storage-quota-01b2-c-micro: LEITURA DE PNEUS PREFERINDO BACKEND', () => {
  const careerId = 'career_c_micro_test'
  const round = 2

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    canonicalWeekendTyreBackendService.clearCachesForTesting()
  })

  // C1 — BACKEND: backend possui inventário válido; retorno = backend.
  it('C1 — BACKEND: backend possui inventário válido; retorno = backend', async () => {
    const backendPayload = createSampleStoredWeekendTireData(careerId, round, {
      inventoriesByDriver: {
        drv_norris: [
          {
            id: 'set_d1_s1',
            tyreSetId: 'set_d1_s1',
            driverId: 'drv_norris',
            compound: 'macio',
            wear: 30,
            condition: 70,
            lapsUsed: 12,
            isFitted: true,
            status: 'usado',
          },
        ],
      },
    })

    const readSpy = vi
      .spyOn(canonicalWeekendTyreBackendService, 'readInventory')
      .mockResolvedValue(backendPayload)

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    expect(readSpy).toHaveBeenCalledTimes(1)
    expect(result.source).toBe('backend')
    expect(result.data).not.toBeNull()
    expect(result.data).toEqual(backendPayload)
    expect(result.data?.inventoriesByDriver.drv_norris[0].wear).toBe(30)
    expect(result.data?.inventoriesByDriver.drv_norris[0].lapsUsed).toBe(12)
    expect(result.backendError).toBeUndefined()
  })

  // C2 — NOT_FOUND: backend retorna null; local válido existe; lazy migration promove para o backend (01B2-D).
  it('C2 — NOT_FOUND: backend retorna null; local válido existe; lazy migration promove para o backend (01B2-D)', async () => {
    const localPayload = createSampleStoredWeekendTireData(careerId, round)
    localStorage.setItem(`apex_gp_tires_${careerId}_r${round}`, JSON.stringify(localPayload))

    // Backend retorna null (NOT_FOUND)
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(null)
    const saveSpy = vi
      .spyOn(canonicalWeekendTyreBackendService, 'saveInventory')
      .mockResolvedValue({ success: true, id: 'rec_c2_migrated' })

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    // Em 01B2-D, NOT_FOUND + local válido dispara promoção com source 'local_migrated'
    expect(result.source).toBe('local_migrated')
    expect(result.data).not.toBeNull()
    expect(result.data).toEqual(localPayload)
    expect(result.backendError).toBeUndefined()
    expect(saveSpy).toHaveBeenCalledTimes(1)
  })

  // C3 — BACKEND_ERROR: backend falha; local válido existe; fallback local funciona e erro é observável.
  it('C3 — BACKEND_ERROR: backend falha; local válido existe; fallback local funciona e erro é observável', async () => {
    const localPayload = createSampleStoredWeekendTireData(careerId, round)
    localStorage.setItem(`apex_gp_tires_${careerId}_r${round}`, JSON.stringify(localPayload))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockRejectedValue(
      new Error('PocketBase Connection Timed Out 503'),
    )

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    expect(result.source).toBe('local')
    expect(result.data).not.toBeNull()
    expect(result.data).toEqual(localPayload)
    expect(result.backendError).toBe('PocketBase Connection Timed Out 503')
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  // C4 — DIVERGÊNCIA: backend e local possuem wear/lapsUsed diferentes; backend vence.
  it('C4 — DIVERGÊNCIA: backend e local possuem wear/lapsUsed diferentes; backend vence', async () => {
    const localPayload = createSampleStoredWeekendTireData(careerId, round, {
      inventoriesByDriver: {
        drv_norris: [
          {
            id: 'set_d1_s1',
            tyreSetId: 'set_d1_s1',
            driverId: 'drv_norris',
            compound: 'macio',
            wear: 80, // Maior desgaste local
            condition: 20,
            lapsUsed: 35,
            isFitted: false,
            status: 'usado',
          },
        ],
      },
    })
    localStorage.setItem(`apex_gp_tires_${careerId}_r${round}`, JSON.stringify(localPayload))

    const backendPayload = createSampleStoredWeekendTireData(careerId, round, {
      inventoriesByDriver: {
        drv_norris: [
          {
            id: 'set_d1_s1',
            tyreSetId: 'set_d1_s1',
            driverId: 'drv_norris',
            compound: 'macio',
            wear: 25, // Menor desgaste no backend
            condition: 75,
            lapsUsed: 10,
            isFitted: true,
            status: 'usado',
          },
        ],
      },
    })

    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(backendPayload)

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    // Backend vence, sem merge e sem escolher maior wear
    expect(result.source).toBe('backend')
    expect(result.data).not.toBeNull()
    expect(result.data?.inventoriesByDriver.drv_norris[0].wear).toBe(25)
    expect(result.data?.inventoriesByDriver.drv_norris[0].lapsUsed).toBe(10)
    expect(result.data?.inventoriesByDriver.drv_norris[0].condition).toBe(75)
  })

  // C5 — PAYLOAD INVÁLIDO: backend inválido + local válido; backend rejeitado; local utilizado.
  it('C5 — PAYLOAD INVÁLIDO: backend inválido + local válido; backend rejeitado; local utilizado', async () => {
    const localPayload = createSampleStoredWeekendTireData(careerId, round)
    localStorage.setItem(`apex_gp_tires_${careerId}_r${round}`, JSON.stringify(localPayload))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Backend retorna objeto com payload corrompido / inválido (ex: sem seasonId e sem round)
    const corruptedBackendPayload = {
      corruptedField: 1234,
      inventoriesByDriver: null,
    } as any

    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(
      corruptedBackendPayload,
    )

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    expect(result.source).toBe('local')
    expect(result.data).not.toBeNull()
    expect(result.data).toEqual(localPayload)
    expect(result.backendError).toContain('Payload inválido no PocketBase')
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  // C6 — IDENTIDADE: outra carreira/season/round não contamina a leitura.
  it('C6 — IDENTIDADE: outra carreira/season/round não contamina a leitura', async () => {
    const backendStore = new Map<string, any>()

    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockImplementation(
      async (context) => {
        const key = canonicalWeekendTyreBackendService.buildInventoryKey(context)
        return backendStore.get(key) || null
      },
    )

    const payloadCareer1Round1 = createSampleStoredWeekendTireData('career_1', 1)
    const payloadCareer1Round2 = createSampleStoredWeekendTireData('career_1', 2)
    const payloadCareer2Round1 = createSampleStoredWeekendTireData('career_2', 1)

    backendStore.set(
      canonicalWeekendTyreBackendService.buildInventoryKey({
        careerId: 'career_1',
        season: 1,
        round: 1,
      }),
      payloadCareer1Round1,
    )
    backendStore.set(
      canonicalWeekendTyreBackendService.buildInventoryKey({
        careerId: 'career_1',
        season: 1,
        round: 2,
      }),
      payloadCareer1Round2,
    )
    backendStore.set(
      canonicalWeekendTyreBackendService.buildInventoryKey({
        careerId: 'career_2',
        season: 1,
        round: 1,
      }),
      payloadCareer2Round1,
    )

    const res1 = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred('career_1', 1)
    const res2 = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred('career_1', 2)
    const res3 = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred('career_2', 1)
    const resNone = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred('career_2', 99)

    expect(res1.data?.seasonId).toBe('career_1')
    expect(res1.data?.round).toBe(1)

    expect(res2.data?.seasonId).toBe('career_1')
    expect(res2.data?.round).toBe(2)

    expect(res3.data?.seasonId).toBe('career_2')
    expect(res3.data?.round).toBe(1)

    expect(resNone.source).toBe('none')
    expect(resNone.data).toBeNull()
  })

  // C7 — LOAD NÃO ESCREVE: confirmar que saveInventory não é chamado, localStorage.setItem não é chamado e nenhum payload é removido.
  it('C7 — LOAD NÃO ESCREVE: confirmar que saveInventory não é chamado, localStorage.setItem não é chamado e nenhum payload é removido durante a leitura', async () => {
    const localPayload = createSampleStoredWeekendTireData(careerId, round)
    localStorage.setItem(`apex_gp_tires_${careerId}_r${round}`, JSON.stringify(localPayload))

    const backendPayload = createSampleStoredWeekendTireData(careerId, round)
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(backendPayload)

    const saveBackendSpy = vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory')
    const writeLocalSpy = vi.spyOn(canonicalWeekendTyrePersistence, 'writeWeekendTireData')
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    expect(result.source).toBe('backend')
    expect(result.data).not.toBeNull()

    // Verificações rigorosas de NÃO ESCRITA
    expect(saveBackendSpy).not.toHaveBeenCalled()
    expect(writeLocalSpy).not.toHaveBeenCalled()
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(removeItemSpy).not.toHaveBeenCalled()

    // O item local ainda existe inalterado
    expect(localStorage.getItem(`apex_gp_tires_${careerId}_r${round}`)).not.toBeNull()
  })
})
