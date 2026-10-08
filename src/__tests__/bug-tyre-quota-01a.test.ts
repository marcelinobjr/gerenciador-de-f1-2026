/**
 * bug-tyre-quota-01a.test.ts
 *
 * Suíte de testes para resiliência de QuotaExceededError no inventário canônico de pneus:
 *
 * Cenário (a): Local lança QuotaExceededError + Backend confirma com sucesso
 *   → Fluxo de seleção de sessão (getOrCreateWeekendInventories) NÃO lança exceção,
 *   → Inventário retornado e disponível na UI/memória,
 *   → Cópia pesada local é expurgada liberando cota após confirmação do backend.
 *
 * Cenário (b): Local lança QuotaExceededError + Backend falha (indisponibilidade/erro de rede)
 *   → Erro é observável (log de erro explicativo com contexto),
 *   → NÃO há crash ou exceção não capturada na UI (fluxo continua degradado com inventário em memória),
 *   → Sem falso sucesso nem corrupção de dados.
 *
 * Cenário (c): Caminho feliz inalterado
 *   → Local grava normalmente, PocketBase recebe espelhamento, expurgo pós-confirmação opera normalmente.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  canonicalWeekendTyrePersistence,
  getWeekendTireStorageKey,
  type StoredWeekendTireData,
} from '@/services/canonicalWeekendTyrePersistence'
import { canonicalWeekendTyreBackendService } from '@/services/canonicalWeekendTyreBackendService'
import type { TireSetItem } from '@/types/f1'

describe('BUG-TYRE-QUOTA-01A: Resiliência de Cota no Inventário Canônico de Pneus', () => {
  const TEST_CAREER_ID = 'uc5qbo5uosqcocs'
  const TEST_ROUND = 1
  const DRIVER_IDS = ['drv_player_1', 'drv_player_2']
  const storageKey = getWeekendTireStorageKey(TEST_CAREER_ID, TEST_ROUND)

  beforeEach(() => {
    localStorage.clear()
    canonicalWeekendTyrePersistence.clearMemoryForTesting()
    canonicalWeekendTyreBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    canonicalWeekendTyrePersistence.clearMemoryForTesting()
    canonicalWeekendTyreBackendService.clearCachesForTesting()
    vi.restoreAllMocks()
  })

  // =========================================================================
  // CENÁRIO (a): Local lança QuotaExceeded + Backend confirma
  // =========================================================================
  it('(a) Local lança QuotaExceeded + Backend confirma: seleção de sessão não lança, inventário disponível, chave local expurgada pós-confirmação', async () => {
    // 1. Simular QuotaExceededError no localStorage (idêntico ao erro de produção reportado)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      const quotaErr = new Error(
        `Failed to execute 'setItem' on 'Storage': Setting the value of '${key}' exceeded the quota.`,
      )
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    // 2. Simular sucesso no PocketBase (backend autoritativo confirma save)
    let capturedBackendPayload: StoredWeekendTireData | null = null
    const saveBackendSpy = vi
      .spyOn(canonicalWeekendTyreBackendService, 'saveInventory')
      .mockImplementation(async (_ctx, payload) => {
        capturedBackendPayload = payload as StoredWeekendTireData
        return { success: true, id: 'rec_tyre_pb_01' }
      })

    // 3. Executar o fluxo exato que quebrava na UI em WeekendV2Page linha 910:
    // canonicalWeekendTyrePersistence.getOrCreateWeekendInventories(...)
    let inventories: Record<string, TireSetItem[]> | null = null
    expect(() => {
      inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId: TEST_CAREER_ID,
        round: TEST_ROUND,
        driverIds: DRIVER_IDS,
        primaryDriverIds: DRIVER_IDS,
      })
    }).not.toThrow()

    // 4. Inventário retornado está completo e válido para os pilotos
    expect(inventories).not.toBeNull()
    expect(inventories![DRIVER_IDS[0]]).toBeDefined()
    expect(inventories![DRIVER_IDS[0]].length).toBeGreaterThan(0)
    expect(inventories![DRIVER_IDS[1]]).toBeDefined()
    expect(inventories![DRIVER_IDS[1]].length).toBeGreaterThan(0)

    // 5. Backend foi chamado para espelhar o inventário
    expect(saveBackendSpy).toHaveBeenCalledTimes(1)

    // Aguardar a resolução da Promise assíncrona do backend e do expurgo local pós-confirmação
    await new Promise((r) => setTimeout(r, 20))

    // 6. Confirma que o backend recebeu o inventário canônico
    expect(capturedBackendPayload).not.toBeNull()
    expect(capturedBackendPayload!.seasonId).toBe(TEST_CAREER_ID)
    expect(capturedBackendPayload!.round).toBe(TEST_ROUND)

    // 7. A chave local pesada foi expurgada (ou removida) em consonância com 01B2-E,
    // aliviando a cota exatamente nessa condição
    expect(localStorage.getItem(storageKey)).toBeNull()

    // 8. Leitura síncrona posterior pelo sistema de corrida/qualificação continua funcionando
    // sem bater em null, graças ao cache de memória e ao espelho backend
    const readAfter = canonicalWeekendTyrePersistence.readWeekendTireData(
      TEST_CAREER_ID,
      TEST_ROUND,
    )
    expect(readAfter).not.toBeNull()
    expect(readAfter!.inventoriesByDriver[DRIVER_IDS[0]]).toBeDefined()
  })

  // =========================================================================
  // CENÁRIO (b): Local lança QuotaExceeded + Backend falha
  // =========================================================================
  it('(b) Local lança QuotaExceeded + Backend falha: erro observável, sem exceção não capturada na UI, fallback degradado em memória', async () => {
    // 1. Simular QuotaExceededError no localStorage
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      const quotaErr = new Error(
        `Failed to execute 'setItem' on 'Storage': Setting the value of '${key}' exceeded the quota.`,
      )
      quotaErr.name = 'QuotaExceededError'
      throw quotaErr
    })

    // 2. Simular falha de rede / indisponibilidade no PocketBase
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const saveBackendSpy = vi
      .spyOn(canonicalWeekendTyreBackendService, 'saveInventory')
      .mockResolvedValueOnce({
        success: false,
        error: 'PocketBase 503 Service Unavailable',
      })

    // 3. Execução NÃO lança exceção para a UI / handler de clique
    let inventories: Record<string, TireSetItem[]> | null = null
    expect(() => {
      inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
        seasonId: TEST_CAREER_ID,
        round: TEST_ROUND,
        driverIds: DRIVER_IDS,
        primaryDriverIds: DRIVER_IDS,
      })
    }).not.toThrow()

    // 4. Inventário retornado permanece operando em memória para que o usuário não seja travado
    expect(inventories).not.toBeNull()
    expect(inventories![DRIVER_IDS[0]]).toBeDefined()

    // Aguardar conclusão da promessa do backend
    await new Promise((r) => setTimeout(r, 20))

    // 5. Erro observável foi logado informando que ambos falharam
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Ambos local e backend falharam ao salvar pneus'),
    )

    errorSpy.mockRestore()
  })

  // =========================================================================
  // CENÁRIO (c): Caminho feliz inalterado
  // =========================================================================
  it('(c) Caminho feliz inalterado: local grava normalmente e backend confirma com expurgo 01B2-E', async () => {
    let capturedBackendPayload: StoredWeekendTireData | null = null
    vi.spyOn(canonicalWeekendTyreBackendService, 'saveInventory').mockImplementation(
      async (_ctx, payload) => {
        capturedBackendPayload = payload as StoredWeekendTireData
        return { success: true, id: 'rec_happy_path' }
      },
    )

    // Chamada normal
    const inventories = canonicalWeekendTyrePersistence.getOrCreateWeekendInventories({
      seasonId: TEST_CAREER_ID,
      round: TEST_ROUND,
      driverIds: DRIVER_IDS,
      primaryDriverIds: DRIVER_IDS,
    })

    expect(inventories).toBeDefined()
    expect(inventories[DRIVER_IDS[0]]).toHaveLength(20)

    await new Promise((r) => setTimeout(r, 20))

    // Backend recebeu dados
    expect(capturedBackendPayload).not.toBeNull()
    expect(capturedBackendPayload!.seasonId).toBe(TEST_CAREER_ID)

    // Expurgo pós-confirmação executou conforme 01B2-E
    expect(localStorage.getItem(storageKey)).toBeNull()
  })
})
