/**
 * Testes unitários do Loader de Configuração Econômica Versionada — FIN-SOURCE-01A.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  validateEconomicRules,
  loadVersionedEconomicConfig,
  FinancialConfigLoadError,
} from '../lib/finances/loader'
import rawParams from '../assets/01finevoparametros-9bcaa.json'
import { FinancialEconomicRules } from '../lib/finances/types'
import pb from '../lib/pocketbase/client'

const rawRules = (rawParams as unknown as { rules: Record<string, { value: number }> }).rules
const validRules: FinancialEconomicRules = Object.fromEntries(
  Object.entries(rawRules).map(([k, v]) => [k, v.value]),
) as unknown as FinancialEconomicRules

describe('FIN-SOURCE-01A — Financial Loader Unit Tests', () => {
  it('valida com sucesso parâmetros econômicos válidos', () => {
    expect(() => validateEconomicRules(validRules)).not.toThrow()
  })

  it('rejeita objetos nulos ou inválidos', () => {
    expect(() => validateEconomicRules(null)).toThrow(FinancialConfigLoadError)
    expect(() => validateEconomicRules('invalid')).toThrow(FinancialConfigLoadError)
  })

  it('rejeita ausência de campos obrigatórios', () => {
    const missingField = { ...validRules }
    delete (missingField as any).gp_win_prize
    expect(() => validateEconomicRules(missingField)).toThrow(/gp_win_prize/)
  })

  it('rejeita meses por ano diferente de 12', () => {
    const invalidMonths = { ...validRules, months_per_year: 10 }
    expect(() => validateEconomicRules(invalidMonths)).toThrow(/months_per_year/)
  })

  it('rejeita escala monetária diferente de 1.000.000', () => {
    const invalidScale = { ...validRules, monetary_scale_to_usd: 100 }
    expect(() => validateEconomicRules(invalidScale)).toThrow(/monetary_scale_to_usd/)
  })

  it('loadVersionedEconomicConfig exige versão não-vazia', async () => {
    await expect(loadVersionedEconomicConfig('')).rejects.toThrow(FinancialConfigLoadError)
    await expect(loadVersionedEconomicConfig('   ')).rejects.toThrow(FinancialConfigLoadError)
  })

  it('loadVersionedEconomicConfig carrega do banco e valida estrutura', async () => {
    const mockRecord = {
      id: 'rec_123',
      version: 'FIN-SOURCE-01A-DRAFT-1.0.0',
      sha256: 'abc',
      status: 'DRAFT',
      is_active: false,
      work_item: 'FIN-SOURCE-01A',
      delivery_version: 'FIN-SOURCE-01A-DRAFT-1.0.0',
      source_declared_version: 'FIN-EVO-02',
      source_sha256: 'def',
      parameters: validRules,
      catalogs: { reference_c0: 260 },
      metadata: { work_item: 'FIN-SOURCE-01A' },
      created: '2026-03-09T00:00:00Z',
      updated: '2026-03-09T00:00:00Z',
    }

    const spy = vi
      .spyOn(pb.collection('financial_versioned_configs'), 'getFirstListItem')
      .mockResolvedValue(mockRecord as any)

    const result = await loadVersionedEconomicConfig('FIN-SOURCE-01A-DRAFT-1.0.0')
    expect(result.version).toBe('FIN-SOURCE-01A-DRAFT-1.0.0')
    expect(result.parameters.monetary_scale_to_usd).toBe(1000000)

    spy.mockRestore()
  })
})
