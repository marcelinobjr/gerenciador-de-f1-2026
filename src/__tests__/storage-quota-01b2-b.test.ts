import { describe, it, expect, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import {
  canonicalWeekendTyrePersistence,
  type StoredWeekendTireData,
} from '@/services/canonicalWeekendTyrePersistence'
import { canonicalWeekendTyreBackendService } from '@/services/canonicalWeekendTyreBackendService'

describe('STORAGE-QUOTA-01B2-B: Espelhamento de Escrita Viva do Inventário de Pneus', () => {
  const mockCareerId = 'career_b2_test'
  const mockRound = 4

  const mockPayload: StoredWeekendTireData = {
    seasonId: mockCareerId,
    round: mockRound,
    isSprint: false,
    allotmentRules: {
      soft: 8,
      medium: 3,
      hard: 2,
      intermediate: 4,
      wet: 3,
      totalSlick: 13,
      totalDryWet: 20,
    },
    inventoriesByDriver: {
      drv_hamilton: [
        {
          id: 'set_1',
          compound: 'SOFT',
          condition: 'NEW',
          status: 'AVAILABLE',
          wear: 0,
          lapsUsed: 0,
        },
        {
          id: 'set_2',
          compound: 'MEDIUM',
          condition: 'NEW',
          status: 'AVAILABLE',
          wear: 0,
          lapsUsed: 0,
        },
      ],
      drv_verstappen: [
        {
          id: 'set_v1',
          compound: 'HARD',
          condition: 'NEW',
          status: 'AVAILABLE',
          wear: 0,
          lapsUsed: 0,
        },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    canonicalWeekendTyreBackendService.clearCachesForTesting()
  })

  // B1 — SAVE AGREGADO/POR PILOTO: executar o write real do inventário;
  // confirmar que local continua sendo escrito e backend recebe payload equivalente.
  it('B1 — SAVE AGREGADO: write real persiste localmente e espelha no PocketBase com driverId _all', async () => {
    let capturedRecord: any = null
    const saveSpy = vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory')

    // Mock do pb.collection('canonical_weekend_tyres')
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_weekend_tyres') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
          create: vi.fn().mockImplementation(async (data: any) => {
            capturedRecord = { id: 'rec_b1', ...data }
            return capturedRecord
          }),
          update: vi.fn(),
        } as any
      }
      return {} as any
    })

    // Dispara a escrita real viva
    canonicalWeekendTyrePersistence.writeWeekendTireData(mockPayload)

    // Aguarda o término da Promise assíncrona disparada
    await new Promise((r) => setTimeout(r, 50))

    // 1. Confirma persistência local
    const localRaw = localStorage.getItem(`apex_gp_tires_${mockCareerId}_r${mockRound}`)
    expect(localRaw).toBeTruthy()
    const localParsed = JSON.parse(localRaw!)
    expect(localParsed.seasonId).toBe(mockCareerId)
    expect(localParsed.round).toBe(mockRound)
    expect(localParsed.inventoriesByDriver.drv_hamilton[0].id).toBe('set_1')

    // 2. Confirma chamada ao saveInventory com driverId = undefined (_all)
    expect(saveSpy).toHaveBeenCalledTimes(1)
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        careerId: mockCareerId,
        round: mockRound,
        driverId: undefined,
      }),
      mockPayload,
    )

    // 3. Confirma criação no PocketBase
    expect(capturedRecord).not.toBeNull()
    expect(capturedRecord.inventory_key).toBe(`tyre_inv_${mockCareerId}_s1_r${mockRound}_all`)
    expect(capturedRecord.payload.inventoriesByDriver.drv_hamilton[0].id).toBe('set_1')
  })

  // B2 — DESGASTE REAL: alterar wear/lapsUsed por fluxo de persistência real;
  // confirmar que backend recebe os valores atualizados.
  it('B2 — DESGASTE REAL: alteração de wear/lapsUsed no fluxo de persistência é espelhada com valores exatos', async () => {
    let lastSavedPayload: any = null
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_weekend_tyres') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
          create: vi.fn().mockImplementation(async (data: any) => {
            lastSavedPayload = data.payload
            return { id: 'rec_b2', ...data }
          }),
          update: vi.fn().mockImplementation(async (_id: string, data: any) => {
            lastSavedPayload = data.payload
            return { id: _id, ...data }
          }),
        } as any
      }
      return {} as any
    })

    // 1. Inicializa com o payload base
    canonicalWeekendTyrePersistence.writeWeekendTireData(mockPayload)
    await new Promise((r) => setTimeout(r, 50))

    // 2. Simula desgaste de corrida/treino
    const updatedPayload: StoredWeekendTireData = {
      ...mockPayload,
      inventoriesByDriver: {
        ...mockPayload.inventoriesByDriver,
        drv_hamilton: [
          {
            id: 'set_1',
            compound: 'SOFT',
            condition: 'USED',
            status: 'AVAILABLE',
            wear: 24.5,
            lapsUsed: 12,
          },
          mockPayload.inventoriesByDriver.drv_hamilton[1],
        ],
      },
    }

    // 3. Grava desgaste no fluxo real
    canonicalWeekendTyrePersistence.writeWeekendTireData(updatedPayload)
    await new Promise((r) => setTimeout(r, 50))

    // Confirma que o backend recebeu o wear e lapsUsed atualizados
    expect(lastSavedPayload).not.toBeNull()
    const hamSet1 = lastSavedPayload.inventoriesByDriver.drv_hamilton[0]
    expect(hamSet1.wear).toBe(24.5)
    expect(hamSet1.lapsUsed).toBe(12)
    expect(hamSet1.condition).toBe('USED')
  })

  // B3 — UPSERT: salvar mesma identidade novamente; backend atualiza registro existente, sem duplicata lógica.
  it('B3 — UPSERT: salvar mesma identidade novamente atualiza registro existente sem duplicata', async () => {
    let createCount = 0
    let updateCount = 0
    const recordsMap = new Map<string, any>()

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_weekend_tyres') {
        return {
          getFirstListItem: vi.fn().mockImplementation(async (filter: string) => {
            for (const r of recordsMap.values()) {
              if (filter.includes(r.inventory_key)) return r
            }
            throw new Error('not found')
          }),
          create: vi.fn().mockImplementation(async (data: any) => {
            createCount++
            const rec = { id: `rec_${createCount}`, ...data }
            recordsMap.set(rec.id, rec)
            return rec
          }),
          update: vi.fn().mockImplementation(async (id: string, data: any) => {
            updateCount++
            const existing = recordsMap.get(id) || { id }
            const updated = { ...existing, ...data }
            recordsMap.set(id, updated)
            return updated
          }),
        } as any
      }
      return {} as any
    })

    // Write 1
    canonicalWeekendTyrePersistence.writeWeekendTireData(mockPayload)
    await new Promise((r) => setTimeout(r, 50))

    // Write 2 (mesma identidade lógica de fim de semana)
    canonicalWeekendTyrePersistence.writeWeekendTireData(mockPayload)
    await new Promise((r) => setTimeout(r, 50))

    // Deve ter feito 1 create e 1 update (ou aproveitado recordIdCache)
    expect(createCount).toBe(1)
    expect(updateCount).toBe(1)
    expect(recordsMap.size).toBe(1)
  })

  // B4 — ISOLAMENTO: outra carreira/season/round não é sobrescrita.
  it('B4 — ISOLAMENTO: outra carreira/season/round não é sobrescrita', async () => {
    const store = new Map<string, any>()

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_weekend_tyres') {
        return {
          getFirstListItem: vi.fn().mockImplementation(async (filter: string) => {
            for (const r of store.values()) {
              if (filter.includes(r.inventory_key)) return r
            }
            throw new Error('not found')
          }),
          create: vi.fn().mockImplementation(async (data: any) => {
            const id = `rec_${store.size + 1}`
            const rec = { id, ...data }
            store.set(data.inventory_key, rec)
            return rec
          }),
          update: vi.fn().mockImplementation(async (id: string, data: any) => {
            let foundKey: string | null = null
            for (const [k, v] of store.entries()) {
              if (v.id === id) foundKey = k
            }
            if (foundKey) {
              const rec = { ...store.get(foundKey), ...data }
              store.set(foundKey, rec)
              return rec
            }
            return { id, ...data }
          }),
        } as any
      }
      return {} as any
    })

    // Carreira A - Round 4
    canonicalWeekendTyrePersistence.writeWeekendTireData(mockPayload)
    await new Promise((r) => setTimeout(r, 50))

    // Carreira B - Round 4
    const payloadB: StoredWeekendTireData = {
      ...mockPayload,
      seasonId: 'career_other',
    }
    canonicalWeekendTyrePersistence.writeWeekendTireData(payloadB)
    await new Promise((r) => setTimeout(r, 50))

    // Carreira A - Round 5
    const payloadR5: StoredWeekendTireData = {
      ...mockPayload,
      round: 5,
    }
    canonicalWeekendTyrePersistence.writeWeekendTireData(payloadR5)
    await new Promise((r) => setTimeout(r, 50))

    expect(store.size).toBe(3)
    expect(store.has(`tyre_inv_${mockCareerId}_s1_r4_all`)).toBe(true)
    expect(store.has('tyre_inv_career_other_s1_r4_all')).toBe(true)
    expect(store.has(`tyre_inv_${mockCareerId}_s1_r5_all`)).toBe(true)
  })

  // B5 — FALHA BACKEND: simular backend indisponível;
  // confirmar que save local permanece íntegro, erro backend observável, nenhum falso sucesso backend.
  it('B5 — FALHA BACKEND: falha de rede/PB não afeta save local e erro é logado sem estourar exceção', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_weekend_tyres') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue(new Error('PB 500 Network error')),
          create: vi.fn().mockRejectedValue(new Error('PB 500 Network error')),
        } as any
      }
      return {} as any
    })

    // Executa write — NÃO deve lançar erro para o chamador
    expect(() => {
      canonicalWeekendTyrePersistence.writeWeekendTireData(mockPayload)
    }).not.toThrow()

    // Aguarda o término da Promise
    await new Promise((r) => setTimeout(r, 50))

    // 1. Save local permanece íntegro
    const localRaw = localStorage.getItem(`apex_gp_tires_${mockCareerId}_r${mockRound}`)
    expect(localRaw).toBeTruthy()
    const localData = JSON.parse(localRaw!)
    expect(localData.seasonId).toBe(mockCareerId)

    // 2. Erro foi logado via console.warn
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WeekendTirePersistence] Falha assíncrona ao espelhar pneus no PocketBase:'),
      expect.anything(),
    )
  })

  // B6 — PAYLOAD: comparar campos essenciais
  // (tyreSetId, compound, wear, lapsUsed, condition, status, identities/inventoriesByDriver relevantes).
  it('B6 — PAYLOAD: preserva integralmente todos os campos essenciais sem recalcular nem truncar', async () => {
    let capturedPayload: any = null

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'canonical_weekend_tyres') {
        return {
          getFirstListItem: vi.fn().mockRejectedValue(new Error('not found')),
          create: vi.fn().mockImplementation(async (data: any) => {
            capturedPayload = data.payload
            return { id: 'rec_b6', ...data }
          }),
        } as any
      }
      return {} as any
    })

    canonicalWeekendTyrePersistence.writeWeekendTireData(mockPayload)
    await new Promise((r) => setTimeout(r, 50))

    expect(capturedPayload).not.toBeNull()
    expect(capturedPayload.seasonId).toBe(mockPayload.seasonId)
    expect(capturedPayload.round).toBe(mockPayload.round)
    expect(capturedPayload.isSprint).toBe(mockPayload.isSprint)
    expect(capturedPayload.allotmentRules).toEqual(mockPayload.allotmentRules)
    expect(capturedPayload.inventoriesByDriver).toEqual(mockPayload.inventoriesByDriver)

    // Comparar item por item
    const ham1 = capturedPayload.inventoriesByDriver.drv_hamilton[0]
    expect(ham1.id).toBe('set_1')
    expect(ham1.compound).toBe('SOFT')
    expect(ham1.condition).toBe('NEW')
    expect(ham1.status).toBe('AVAILABLE')
    expect(ham1.wear).toBe(0)
    expect(ham1.lapsUsed).toBe(0)
  })

  // B7 — LEITURA AINDA LOCAL: confirmar que readInventory NÃO é chamado pelo reload atual.
  it('B7 — LEITURA AINDA LOCAL: readWeekendTireData e reload leem do localStorage sem chamar readInventory', () => {
    const readBackendSpy = vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory')

    // Popula localStorage
    localStorage.setItem(
      `apex_gp_tires_${mockCareerId}_r${mockRound}`,
      JSON.stringify(mockPayload),
    )

    // Chama leitura local
    const result = canonicalWeekendTyrePersistence.readWeekendTireData(mockCareerId, mockRound)

    // Confirma retorno local correto
    expect(result).not.toBeNull()
    expect(result?.seasonId).toBe(mockCareerId)
    expect(result?.round).toBe(mockRound)

    // Confirma que readInventory NÃO foi chamado
    expect(readBackendSpy).not.toHaveBeenCalled()
  })
})
