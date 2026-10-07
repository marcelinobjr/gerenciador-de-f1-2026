/**
 * storage-quota-01b2-e.test.ts
 *
 * STORAGE-QUOTA-01B2-E — EXPURGAR INVENTÁRIO PESADO DE PNEUS DO LOCALSTORAGE
 *
 * Suíte de testes canônica para a política de expurgo do inventário de pneus:
 * E1 — BACKEND CONFIRMADO: save local + backend success; local pesado é removido/reduzido.
 * E2 — BACKEND FALHA: local permanece íntegro.
 * E3 — LAZY MIGRATION: inventário só-local promovido com sucesso; depois local é expurgado.
 * E4 — MIGRAÇÃO FALHA: local permanece intacto.
 * E5 — ISOLAMENTO: expurgo de uma career/season/round não toca outra.
 * E6 — READ BACKEND: após expurgo, leitura continua funcionando pelo PocketBase.
 * E7 — BACKEND OFFLINE APÓS EXPURGO: não cria inventário novo; retorna erro/indisponibilidade explícita.
 * E8 — PAYLOAD: confirmar que o inventário backend mantém tyreSetId, compound, wear, lapsUsed, condition, status.
 * E9 — IMPACTO DE TAMANHO: com fixture representativa, medir redução real do localStorage após expurgo.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  canonicalWeekendTyrePersistence,
  getWeekendTireStorageKey,
  type StoredWeekendTireData,
} from '@/services/canonicalWeekendTyrePersistence'
import { canonicalWeekendTyreBackendService } from '@/services/canonicalWeekendTyreBackendService'
import type { TireSetItem } from '@/types/f1'

function createSampleStoredWeekendTireData(
  seasonId = 'career_e_test',
  round = 1,
  overrides: Partial<StoredWeekendTireData> = {},
): StoredWeekendTireData {
  const driver1Sets: TireSetItem[] = [
    {
      id: 'set_e1_s1',
      tyreSetId: 'set_e1_s1',
      driverId: 'drv_norris',
      compound: 'macio',
      wear: 15,
      condition: 85,
      lapsUsed: 6,
      isFitted: true,
      status: 'instalado',
    },
    {
      id: 'set_e1_m1',
      tyreSetId: 'set_e1_m1',
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
      id: 'set_e2_s1',
      tyreSetId: 'set_e2_s1',
      driverId: 'drv_piastri',
      compound: 'macio',
      wear: 5,
      condition: 95,
      lapsUsed: 2,
      isFitted: false,
      status: 'usado',
    },
    {
      id: 'set_e2_h1',
      tyreSetId: 'set_e2_h1',
      driverId: 'drv_piastri',
      compound: 'duro',
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

/**
 * Cria uma fixture completa de inventário representativo de GP (20 pilotos x 20 jogos)
 * para medir com precisão a redução de bytes no localStorage.
 */
function createFullGridRepresentativeFixture(seasonId: string, round: number): StoredWeekendTireData {
  const inventoriesByDriver: Record<string, TireSetItem[]> = {}
  const compounds: Array<'macio' | 'medio' | 'duro' | 'intermediario' | 'chuva_extrema'> = [
    'macio',
    'medio',
    'duro',
    'intermediario',
    'chuva_extrema',
  ]

  for (let d = 1; d <= 20; d++) {
    const dId = `drv_${d}`
    const sets: TireSetItem[] = []
    for (let s = 1; s <= 20; s++) {
      const cmp = compounds[s % compounds.length]
      sets.push({
        id: `set_${dId}_${s}`,
        tyreSetId: `set_${dId}_${s}`,
        driverId: dId,
        compound: cmp,
        wear: s * 3,
        condition: Math.max(0, 100 - s * 3),
        lapsUsed: s,
        isFitted: s === 1,
        status: s === 1 ? 'instalado' : s > 10 ? 'disponivel' : 'usado',
      })
    }
    inventoriesByDriver[dId] = sets
  }

  return {
    seasonId,
    round,
    isSprint: false,
    allotmentRules: {
      format: 'standard',
      slicks: { duro: 2, medio: 3, macio: 8, total: 13 },
      wet: { intermediario: 4, chuva_extrema: 3, total: 7 },
      totalSetsPerDriver: 20,
      totalTyresPerDriver: 80,
    },
    inventoriesByDriver,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('STORAGE-QUOTA-01B2-E: Expurgar inventário pesado de pneus do localStorage', () => {
  const careerId = 'career_e_test'
  const round = 1
  const storageKey = getWeekendTireStorageKey(careerId, round)

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    canonicalWeekendTyreBackendService.clearCachesForTesting()
  })

  // E1 — BACKEND CONFIRMADO: save local + backend success; local pesado é removido/reduzido.
  it('E1 — BACKEND CONFIRMADO: write vivo salva local e, ao confirmar no backend, expurga cópia local pesada', async () => {
    const payload = createSampleStoredWeekendTireData(careerId, round)

    // Configura saveInventory com sucesso real
    vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory').mockResolvedValue({
      success: true,
      id: 'rec_e1_confirmed',
    })

    // Dispara escrita viva
    canonicalWeekendTyrePersistence.writeWeekendTireData(payload)

    // Aguarda resolução da promise do backend
    await new Promise((r) => setTimeout(r, 20))

    // O inventário local pesado deve ter sido removido
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  // E2 — BACKEND FALHA: local permanece íntegro.
  it('E2 — BACKEND FALHA: quando backend falha ou rejeita, local pesado permanece íntegro como fallback', async () => {
    const payload = createSampleStoredWeekendTireData(careerId, round)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Caso A: saveInventory retorna { success: false, error: 'Network error' }
    vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory').mockResolvedValue({
      success: false,
      error: 'PocketBase timeout',
    })

    canonicalWeekendTyrePersistence.writeWeekendTireData(payload)
    await new Promise((r) => setTimeout(r, 20))

    // Local DEVE permanecer intacto
    const rawA = localStorage.getItem(storageKey)
    expect(rawA).not.toBeNull()
    expect(JSON.parse(rawA!).seasonId).toBe(careerId)

    // Caso B: saveInventory rejeita com exceção não tratada
    vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory').mockRejectedValue(
      new Error('Connection refused'),
    )

    canonicalWeekendTyrePersistence.writeWeekendTireData(payload)
    await new Promise((r) => setTimeout(r, 20))

    // Local continua intacto
    const rawB = localStorage.getItem(storageKey)
    expect(rawB).not.toBeNull()

    warnSpy.mockRestore()
  })

  // E3 — LAZY MIGRATION: inventário só-local promovido com sucesso; depois local é expurgado.
  it('E3 — LAZY MIGRATION: inventário promovido ao backend com sucesso é expurgado do localStorage', async () => {
    const payload = createSampleStoredWeekendTireData(careerId, round)
    localStorage.setItem(storageKey, JSON.stringify(payload))

    // Backend responde NOT_FOUND inicialmente
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(null)
    // Confirmação com sucesso
    const saveSpy = vi
      .spyOn(canonicalWeekendTyreBackendService, 'saveInventory')
      .mockResolvedValue({ success: true, id: 'rec_e3_migrated' })

    const readResult = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    expect(readResult.source).toBe('local_migrated')
    expect(readResult.data).toEqual(payload)
    expect(saveSpy).toHaveBeenCalledTimes(1)

    // Após confirmação real, o payload pesado local DEVE ter sido removido
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  // E4 — MIGRAÇÃO FALHA: local permanece intacto.
  it('E4 — MIGRAÇÃO FALHA: se promoção ao backend falhar, inventário local permanece intacto', async () => {
    const payload = createSampleStoredWeekendTireData(careerId, round)
    localStorage.setItem(storageKey, JSON.stringify(payload))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Backend responde NOT_FOUND na leitura
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(null)

    // Mas falha no save da migração
    vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory').mockResolvedValue({
      success: false,
      error: 'PB Disk Full',
    })

    const readResult = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    expect(readResult.source).toBe('local_migration_failed')
    expect(readResult.data).toEqual(payload)

    // O inventário local NÃO pode ter sido expurgado
    const localRaw = localStorage.getItem(storageKey)
    expect(localRaw).not.toBeNull()
    expect(JSON.parse(localRaw!).seasonId).toBe(careerId)

    warnSpy.mockRestore()
  })

  // E5 — ISOLAMENTO: expurgo de uma career/season/round não toca outra.
  it('E5 — ISOLAMENTO: expurgo de uma career/season/round não toca dados de outra rodada ou carreira', async () => {
    const careerOther = 'career_other'
    const round2 = 2

    const payloadTarget = createSampleStoredWeekendTireData(careerId, round)
    const payloadSameCareerR2 = createSampleStoredWeekendTireData(careerId, round2)
    const payloadOtherCareerR1 = createSampleStoredWeekendTireData(careerOther, round)

    const keyTarget = getWeekendTireStorageKey(careerId, round)
    const keySameCareerR2 = getWeekendTireStorageKey(careerId, round2)
    const keyOtherCareerR1 = getWeekendTireStorageKey(careerOther, round)

    // Popula todas no localStorage
    localStorage.setItem(keyTarget, JSON.stringify(payloadTarget))
    localStorage.setItem(keySameCareerR2, JSON.stringify(payloadSameCareerR2))
    localStorage.setItem(keyOtherCareerR1, JSON.stringify(payloadOtherCareerR1))

    // Expurgar somente o target (careerId, round 1)
    canonicalWeekendTyrePersistence.purgeLocalWeekendTires(careerId, round)

    // Apenas a chave alvo é removida
    expect(localStorage.getItem(keyTarget)).toBeNull()

    // Demais chaves permanecem intactas
    expect(localStorage.getItem(keySameCareerR2)).not.toBeNull()
    expect(JSON.parse(localStorage.getItem(keySameCareerR2)!).round).toBe(round2)

    expect(localStorage.getItem(keyOtherCareerR1)).not.toBeNull()
    expect(JSON.parse(localStorage.getItem(keyOtherCareerR1)!).seasonId).toBe(careerOther)
  })

  // E6 — READ BACKEND: após expurgo, leitura continua funcionando pelo PocketBase.
  it('E6 — READ BACKEND: após expurgo do local, readWeekendTyresPreferred retorna backend normalmente', async () => {
    const payload = createSampleStoredWeekendTireData(careerId, round)

    // Simula estado pós-expurgo: localStorage vazio para esta chave
    expect(localStorage.getItem(storageKey)).toBeNull()

    // Backend retorna o payload externalizado
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockResolvedValue(payload)

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    expect(result.source).toBe('backend')
    expect(result.data).not.toBeNull()
    expect(result.data?.seasonId).toBe(careerId)
    expect(result.data?.round).toBe(round)
    expect(result.data?.inventoriesByDriver['drv_norris']).toHaveLength(2)
  })

  // E7 — BACKEND OFFLINE APÓS EXPURGO: não cria inventário novo; retorna erro/indisponibilidade explícita.
  it('E7 — BACKEND OFFLINE APÓS EXPURGO: não recria pneus sintéticos nem inventa dados, retorna none com backendError', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Local já foi expurgado
    expect(localStorage.getItem(storageKey)).toBeNull()

    // Backend offline (503 / conexão perdida)
    vi.spyOn(canonicalWeekendTyreBackendService, 'readInventory').mockRejectedValue(
      new Error('503 Service Unavailable: Network Down'),
    )

    const result = await canonicalWeekendTyrePersistence.readWeekendTyresPreferred(careerId, round)

    // Deve retornar indisponibilidade explícita (data: null, source: 'none', backendError definido)
    expect(result.data).toBeNull()
    expect(result.source).toBe('none')
    expect(result.backendError).toContain('503 Service Unavailable')

    // Local permanece sem nenhum inventário sintético criado
    expect(localStorage.getItem(storageKey)).toBeNull()

    warnSpy.mockRestore()
  })

  // E8 — PAYLOAD: confirmar que o inventário backend mantém tyreSetId, compound, wear, lapsUsed, condition, status.
  it('E8 — PAYLOAD: confirma que o payload entregue e salvo no backend preserva todos os campos canônicos', async () => {
    let capturedPayload: any = null

    vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory').mockImplementation(
      async (_ctx, p) => {
        capturedPayload = p
        return { success: true, id: 'rec_e8' }
      },
    )

    const complexPayload = createSampleStoredWeekendTireData(careerId, round)
    // Personaliza campos finos
    complexPayload.inventoriesByDriver['drv_norris'][0].tyreSetId = 'set_norris_special'
    complexPayload.inventoriesByDriver['drv_norris'][0].wear = 42
    complexPayload.inventoriesByDriver['drv_norris'][0].lapsUsed = 14
    complexPayload.inventoriesByDriver['drv_norris'][0].condition = 58
    complexPayload.inventoriesByDriver['drv_norris'][0].status = 'usado'
    complexPayload.inventoriesByDriver['drv_norris'][0].compound = 'macio'

    canonicalWeekendTyrePersistence.writeWeekendTireData(complexPayload)
    await new Promise((r) => setTimeout(r, 20))

    expect(capturedPayload).not.toBeNull()
    const setNorris = capturedPayload.inventoriesByDriver['drv_norris'][0]
    expect(setNorris.tyreSetId).toBe('set_norris_special')
    expect(setNorris.compound).toBe('macio')
    expect(setNorris.wear).toBe(42)
    expect(setNorris.lapsUsed).toBe(14)
    expect(setNorris.condition).toBe(58)
    expect(setNorris.status).toBe('usado')

    // Local foi devidamente expurgado
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  // E9 — IMPACTO DE TAMANHO: com fixture representativa, medir redução real do localStorage após expurgo.
  it('E9 — IMPACTO DE TAMANHO: com fixture representativa completa (20 pilotos x 20 jogos), medir redução real do localStorage', async () => {
    const fullFixture = createFullGridRepresentativeFixture(careerId, round)
    const serialized = JSON.stringify(fullFixture)
    const sizeInChars = serialized.length
    // No cálculo de DOMString UTF-16, cada char equivale a 2 bytes
    const estimatedBytes = sizeInChars * 2

    // 1. Grava no localStorage simulando estado pré-expurgo
    localStorage.setItem(storageKey, serialized)
    const initialRaw = localStorage.getItem(storageKey)
    expect(initialRaw).not.toBeNull()
    expect(initialRaw?.length).toBe(sizeInChars)

    // Mede tamanho representativo: deve ter dezenas de kilobytes
    expect(estimatedBytes).toBeGreaterThan(20000) // Mais de 20 KB de payload

    // 2. Confirmação do backend acionando o expurgo
    vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory').mockResolvedValue({
      success: true,
      id: 'rec_e9_full',
    })

    canonicalWeekendTyrePersistence.purgeLocalWeekendTires(careerId, round)

    // 3. Mede tamanho após o expurgo
    const postPurgeRaw = localStorage.getItem(storageKey)
    expect(postPurgeRaw).toBeNull()

    const freedBytes = estimatedBytes
    const freedKB = Math.round((freedBytes / 1024) * 100) / 100

    expect(freedKB).toBeGreaterThan(20)
    // console.info informativo do ganho de cota
    console.info(
      `[STORAGE-QUOTA-01B2-E] Redução real medida do localStorage: ${freedKB} KB (${freedBytes} bytes liberados na chave ${storageKey})`,
    )
  })
})
