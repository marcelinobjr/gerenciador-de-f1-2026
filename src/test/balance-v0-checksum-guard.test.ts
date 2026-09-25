import { describe, it, expect } from 'vitest'
import {
  BALANCE_BASELINE_V0_CHECKSUM,
  BASELINE_V0_DATA,
  validateBaselineV0Checksum,
  calculateStableChecksum,
} from '@/data/balance-baseline-v0'
import baselineV0Raw from '@/data/balance-baseline-v0.json'

describe('BALANCE-V0-CHECKSUM-GUARD (V0CHK-01..05)', () => {
  it('V0CHK-01: baseline intacta valida com sucesso contra o validador', () => {
    expect(() => validateBaselineV0Checksum(baselineV0Raw)).not.toThrow()
    expect(validateBaselineV0Checksum(baselineV0Raw)).toBe(true)
  })

  it('V0CHK-02: checksum canônico é sha_v0_cf5fe0ee', () => {
    expect(BALANCE_BASELINE_V0_CHECKSUM).toBe('sha_v0_cf5fe0ee')
    expect((baselineV0Raw as any).checksum).toBe('sha_v0_cf5fe0ee')
    expect(BASELINE_V0_DATA.checksum).toBe('sha_v0_cf5fe0ee')
  })

  it('V0CHK-03: baseline intacta não lança exceção no import e mantém 29 equipes', () => {
    expect(BASELINE_V0_DATA).toBeDefined()
    expect(BASELINE_V0_DATA.teams).toBeDefined()
    const teamKeys = Object.keys(BASELINE_V0_DATA.teams)
    expect(teamKeys.length).toBe(29)
    expect(Object.isFrozen(BASELINE_V0_DATA)).toBe(true)
  })

  it('V0CHK-04: baseline artificialmente alterada falha na validação sem mutar o JSON real', () => {
    // Cria cópias mutadas do payload (sem tocar no JSON real)
    const tamperedMismatch = {
      ...baselineV0Raw,
      checksum: 'sha_v0_corrupted000',
    }
    expect(() => validateBaselineV0Checksum(tamperedMismatch)).toThrow(
      /CHECKSUM_MISMATCH: expected sha_v0_cf5fe0ee but found sha_v0_corrupted000/,
    )

    const tamperedMissing = {
      ...baselineV0Raw,
      checksum: undefined,
    }
    expect(() => validateBaselineV0Checksum(tamperedMissing)).toThrow(
      /CHECKSUM_MISMATCH: expected sha_v0_cf5fe0ee but found undefined/,
    )

    // Confirma que o JSON original permanece estritamente intacto
    expect((baselineV0Raw as any).checksum).toBe('sha_v0_cf5fe0ee')
  })

  it('V0CHK-05: caminho de importação e serviços dependentes carregam sem quebra de checksum', async () => {
    // Import dinâmico da página Team e serviços correlatos para garantir ausência de quebra em cascata
    const teamModule = await import('@/pages/Team')
    expect(teamModule.default).toBeDefined()

    const balanceBaselineService = await import('@/services/balanceBaselineService')
    expect(balanceBaselineService.balanceBaselineService).toBeDefined()

    // O helper legado calculateStableChecksum ainda existe para compatibilidade, mas não quebra a baseline
    expect(typeof calculateStableChecksum).toBe('function')
  })
})
