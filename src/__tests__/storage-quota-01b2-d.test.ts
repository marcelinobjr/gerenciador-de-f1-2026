/**
 * storage-quota-01b2-d.test.ts
 *
 * STORAGE-QUOTA-01B2-D — LAZY MIGRATION DO INVENTÁRIO DE PNEUS LOCAL PARA BACKEND
 *
 * Suíte de testes canônica para a lazy migration de inventário de pneus:
 * D1 — MIGRAÇÃO: backend NOT_FOUND, local válido. Confirmar: saveInventory chamado uma vez;
 *      backend recebe payload equivalente; retorno continua utilizável.
 * D2 — PRÓXIMA LEITURA: após D1, nova leitura retorna backend; nenhuma nova migração ocorre.
 * D3 — BACKEND JÁ EXISTE: backend válido → não chama saveInventory.
 * D4 — BACKEND ERROR: backend indisponível + local válido → fallback local funciona; não tenta migração.
 * D5 — LOCAL AUSENTE: backend NOT_FOUND + local ausente → retorna none; não cria inventário vazio.
 * D6 — LOCAL INVÁLIDO: backend NOT_FOUND + local inválido → não migra payload corrompido.
 * D7 — ISOLAMENTO: migração de uma career/season/round não interfere em outra.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  canonicalWeekendTyrePersistence,
  type StoredWeekendTireData,
} from '@/services/canonicalWeekendTyrePersistence'
import { canonicalWeekendTyreBackendService } from '@/services/canonicalWeekendTyreBackendService'
import type { TireSetItem } from '@/types/f1'

function createSampleStoredWeekendTireData(
  seasonId = 'career_d_test',
  round = 1,
  overrides: Partial<StoredWeekendTireData> = {},
): StoredWeekendTireData {
  const driver1Sets: TireSetItem[] = [
    {
      id: 'set_d1_s1',
      tyreSetId: 'set_d1_s1',
      driverId: 'drv_norris',
      compound: 'macio',
      wear: 15,
      condition: 85,
      lapsUsed: 6,
      isFitted: true,
      status: 'instalado',
    },
    {
      id: 'set_d1_m1',
      tyreSetId: 'set_d1_m1',
      driverId: 'drv_norris',
      compound: 'medio',
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
      wear: 5,
      condition: 95,
      lapsUsed: 2,
      isFitted: false,
      status: 'usado',
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

describe('STORAGE-QUOTA-01B2-D: LAZY MIGRATION DO INVENTÁRIO DE PNEUS LOCAL PARA BACKEND', () => {
  const careerId = 'career_d_test'
  const round = 1

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    canonicalWeekendTyreBackendService.clearCachesForTesting()
  })

  // D1 — MIGRAÇÃO: backend NOT_FOUND, local válido. Confirmar: saveInventory chamado uma vez; backend recebe payload equivalente; retorno continua utilizável.
  it('D1 — MIGRAÇÃO: backend NOT_FOUND, local válido. Confirmar: saveInventory chamado uma vez; backend recebe payload equivalente; retorno continua utilizável', async () => {
    const localPayload = createSampleStoredWeekendTireData(careerId, round)
    localStorage.setItem(`apex_gp_tires_${careerId}_r${round}`, JSON.stringify(localPayload))

    // Backend responde NOT_FOUND (null)
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(null)
    const saveSpy = vi
      .spyOn(canonicalWeekendTyreBackendService, 'saveInventory')
      .mockResolvedValue({ success: true, id: 'rec_d1_tyres_migrated' })

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    // Retorno continua utilizável e indica migração bem-sucedida
    expect(result.data).not.toBeNull()
    expect(result.data).toEqual(localPayload)
    expect(result.source).toBe('local_migrated')
    expect(result.backendError).toBeUndefined()

    // Confirma que saveInventory foi chamado exatamente UMA vez
    expect(saveSpy).toHaveBeenCalledTimes(1)
    const [savedCtx, savedPayload] = saveSpy.mock.calls[0]
    expect(savedCtx).toEqual({
      careerId,
      season: 1,
      round,
      driverId: undefined, // _all para payload agregado por rodada
    })
    expect(savedPayload).toEqual(localPayload)

    // localStorage continua intacto (não apagado em 01B2-D)
    expect(localStorage.getItem(`apex_gp_tires_${careerId}_r${round}`)).not.toBeNull()

    // Teste de falha na promoção: jogador não é bloqueado, erro observável registrado
    saveSpy.mockResolvedValueOnce({ success: false, error: 'Storage quota exceeded in PB' })
    const failedResult = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(
      careerId,
      round,
    )
    expect(failedResult.data).not.toBeNull()
    expect(failedResult.source).toBe('local_migration_failed')
    expect(failedResult.backendError).toBe('Storage quota exceeded in PB')
    expect(failedResult.migrationError).toBe('Storage quota exceeded in PB')

    // Teste de exceção na promoção: jogador não é bloqueado
    saveSpy.mockRejectedValueOnce(new Error('Network offline during save'))
    const threwResult = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(
      careerId,
      round,
    )
    expect(threwResult.data).not.toBeNull()
    expect(threwResult.source).toBe('local_migration_failed')
    expect(threwResult.backendError).toContain('Network offline during save')
  })

  // D2 — PRÓXIMA LEITURA: após D1, nova leitura retorna backend; nenhuma nova migração ocorre.
  it('D2 — PRÓXIMA LEITURA: após D1, nova leitura retorna backend; nenhuma nova migração ocorre', async () => {
    const payload = createSampleStoredWeekendTireData(careerId, round)
    localStorage.setItem(`apex_gp_tires_${careerId}_r${round}`, JSON.stringify(payload))

    // Backend agora contém o inventário que foi promovido
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(payload)
    const saveSpy = vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory')

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    expect(result.source).toBe('backend')
    expect(result.data).not.toBeNull()
    expect(result.data).toEqual(payload)
    // Nenhuma chamada adicional ao saveInventory
    expect(saveSpy).not.toHaveBeenCalled()
  })

  // D3 — BACKEND JÁ EXISTE: backend válido → não chama saveInventory.
  it('D3 — BACKEND JÁ EXISTE: backend válido → não chama saveInventory', async () => {
    const localPayload = createSampleStoredWeekendTireData(careerId, round, {
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    localStorage.setItem(`apex_gp_tires_${careerId}_r${round}`, JSON.stringify(localPayload))

    const backendPayload = createSampleStoredWeekendTireData(careerId, round, {
      createdAt: '2026-02-01T00:00:00.000Z',
    })

    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(backendPayload)
    const saveSpy = vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory')

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    expect(result.source).toBe('backend')
    expect(result.data).toEqual(backendPayload)
    expect(saveSpy).not.toHaveBeenCalled()
  })

  // D4 — BACKEND ERROR: backend indisponível + local válido → fallback local funciona; não tenta migração.
  it('D4 — BACKEND ERROR: backend indisponível + local válido → fallback local funciona; não tenta migração', async () => {
    const localPayload = createSampleStoredWeekendTireData(careerId, round)
    localStorage.setItem(`apex_gp_tires_${careerId}_r${round}`, JSON.stringify(localPayload))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Backend responde com erro de rede ou 503
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockRejectedValue(
      new Error('503 Service Unavailable: PB Down'),
    )
    const saveSpy = vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory')

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    // Fallback local funciona normalmente
    expect(result.source).toBe('local')
    expect(result.data).toEqual(localPayload)
    expect(result.backendError).toBe('503 Service Unavailable: PB Down')

    // NÃO tenta migração cega quando o backend está indisponível
    expect(saveSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  // D5 — LOCAL AUSENTE: backend NOT_FOUND + local ausente → retorna none; não cria inventário vazio.
  it('D5 — LOCAL AUSENTE: backend NOT_FOUND + local ausente → retorna none; não cria inventário vazio', async () => {
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(null)
    const saveSpy = vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory')

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(
      'career_none',
      99,
    )

    expect(result.source).toBe('none')
    expect(result.data).toBeNull()
    expect(saveSpy).not.toHaveBeenCalled()
  })

  // D6 — LOCAL INVÁLIDO: backend NOT_FOUND + local inválido → não migra payload corrompido.
  it('D6 — LOCAL INVÁLIDO: backend NOT_FOUND + local inválido → não migra payload corrompido', async () => {
    // Grava dados locais corrompidos (sem seasonId e com round inválido)
    localStorage.setItem(
      `apex_gp_tires_${careerId}_r${round}`,
      JSON.stringify({
        corrupted: true,
        inventoriesByDriver: null,
      }),
    )

    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(null)
    const saveSpy = vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    expect(result.source).toBe('none')
    expect(result.data).toBeNull()
    expect(saveSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  // D7 — ISOLAMENTO: migração de uma career/season/round não interfere em outra.
  it('D7 — ISOLAMENTO: migração de uma career/season/round não interfere em outra', async () => {
    const careerA = 'career_alpha'
    const careerB = 'career_beta'
    const round1 = 1
    const round2 = 2

    const payloadA1 = createSampleStoredWeekendTireData(careerA, round1)
    const payloadB2 = createSampleStoredWeekendTireData(careerB, round2)

    // careerA r1 está salvo apenas no local
    localStorage.setItem(`apex_gp_tires_${careerA}_r${round1}`, JSON.stringify(payloadA1))

    // Simula store do backend onde careerB r2 já existe, mas careerA r1 não
    const backendStore = new Map<string, any>()
    const keyB2 = canonicalWeekendTyreBackendService.buildInventoryKey({
      careerId: careerB,
      season: 1,
      round: round2,
    })
    backendStore.set(keyB2, payloadB2)

    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockImplementation(
      async (ctx) => {
        const k = canonicalWeekendTyreBackendService.buildInventoryKey(ctx)
        return backendStore.get(k) || null
      },
    )

    const saveSpy = vi
      .spyOn(canonicalWeekendTyreBackendService, 'saveInventory')
      .mockImplementation(async (ctx, p) => {
        const k = canonicalWeekendTyreBackendService.buildInventoryKey(ctx)
        backendStore.set(k, p)
        return { success: true, id: `id_${k}` }
      })

    // 1. Leitura de careerB r2 -> encontra no backend, NÃO migra
    const resB2 = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerB, round2)
    expect(resB2.source).toBe('backend')
    expect(resB2.data?.seasonId).toBe(careerB)
    expect(resB2.data?.round).toBe(round2)
    expect(saveSpy).not.toHaveBeenCalled()

    // 2. Leitura de careerA r1 -> NOT_FOUND no backend, promove do local
    const resA1 = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerA, round1)
    expect(resA1.source).toBe('local_migrated')
    expect(resA1.data?.seasonId).toBe(careerA)
    expect(resA1.data?.round).toBe(round1)
    expect(saveSpy).toHaveBeenCalledTimes(1)

    const [savedCtx, savedData] = saveSpy.mock.calls[0]
    expect(savedCtx.careerId).toBe(careerA)
    expect(savedCtx.round).toBe(round1)
    expect((savedData as StoredWeekendTireData).seasonId).toBe(careerA)

    // 3. Próxima leitura de careerA r1 -> agora encontra no backend, não migra novamente
    saveSpy.mockClear()
    const resA1Next = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(
      careerA,
      round1,
    )
    expect(resA1Next.source).toBe('backend')
    expect(saveSpy).not.toHaveBeenCalled()
  })
})
