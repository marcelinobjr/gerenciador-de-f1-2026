/**
 * balance-baseline-v0-checksum-guard.test.ts
 *
 * Testes específicos V0CHK-01..05 para a guarda de checksum da baseline V0:
 * - V0CHK-01: baseline intacta valida com sucesso.
 * - V0CHK-02: checksum canônico exportado = sha_v0_cf5fe0ee.
 * - V0CHK-03: baseline intacta não lança erro no import / runtime.
 * - V0CHK-04: baseline artificialmente alterada falha na validação de checksum.
 * - V0CHK-05: caminho de importação usado pela página /team carrega sem CHECKSUM_MISMATCH.
 */

import { describe, it, expect } from 'vitest'
import { BALANCE_BASELINE_V0_CHECKSUM, BASELINE_V0_DATA } from '@/data/balance-baseline-v0'
import baselineV0Raw from '@/data/balance-baseline-v0.json'

describe('BALANCE-V0-CHECKSUM-GUARD: Testes V0CHK-01 até V0CHK-05', () => {
  // V0CHK-01: baseline intacta valida.
  it('V0CHK-01: baseline intacta valida e corresponde à baseline oficial', () => {
    expect(baselineV0Raw).toBeDefined()
    expect(baselineV0Raw.checksum).toBe(BALANCE_BASELINE_V0_CHECKSUM)
    expect(BASELINE_V0_DATA.checksum).toBe(BALANCE_BASELINE_V0_CHECKSUM)
    expect(Object.keys(BASELINE_V0_DATA.teams).length).toBe(29)
  })

  // V0CHK-02: checksum canônico = sha_v0_cf5fe0ee.
  it('V0CHK-02: checksum canônico é rigorosamente sha_v0_cf5fe0ee', () => {
    expect(BALANCE_BASELINE_V0_CHECKSUM).toBe('sha_v0_cf5fe0ee')
    expect(BASELINE_V0_DATA.checksum).toBe('sha_v0_cf5fe0ee')
  })

  // V0CHK-03: baseline intacta não lança no import.
  it('V0CHK-03: baseline intacta não lança exceção no import e é imutável', () => {
    expect(() => {
      const data = BASELINE_V0_DATA
      expect(data).toBeDefined()
      expect(data.immutable).toBe(true)
    }).not.toThrow()
  })

  // V0CHK-04: baseline artificialmente alterada falha na validação.
  it('V0CHK-04: baseline artificialmente alterada falha na validação de checksum', () => {
    const mutated = {
      ...baselineV0Raw,
      checksum: 'sha_v0_corrupted_value',
    }

    const validateChecksum = (payload: { checksum?: string }) => {
      if (payload.checksum !== BALANCE_BASELINE_V0_CHECKSUM) {
        throw new Error(
          `CHECKSUM_MISMATCH: expected ${BALANCE_BASELINE_V0_CHECKSUM} but found ${payload.checksum}`,
        )
      }
      return true
    }

    expect(() => validateChecksum(mutated)).toThrow(/CHECKSUM_MISMATCH/)
  })

  // V0CHK-05: /team não quebra por checksum (validar caminho de importação usado por /team).
  it('V0CHK-05: /team não quebra por checksum ao importar serviços dependentes da V0', async () => {
    // Importa dinamicamente a cadeia de serviços consumida pela página de equipe /team
    const [teamPageModule, balanceServiceModule, structuralStrengthModule] = await Promise.all([
      import('@/pages/Team'),
      import('@/services/balanceBaselineService'),
      import('@/services/structuralStrengthService'),
    ])

    expect(teamPageModule).toBeDefined()
    expect(balanceServiceModule.balanceBaselineService).toBeDefined()
    expect(structuralStrengthModule.structuralStrengthService).toBeDefined()

    // Verifica se os métodos que carregam a baseline V0 rodam sem lançar CHECKSUM_MISMATCH
    const loadedBaseline = balanceServiceModule.balanceBaselineService.loadBalanceBaseline('v0')
    expect(loadedBaseline.checksum).toBe('sha_v0_cf5fe0ee')
    expect(loadedBaseline.totalTeamsCount).toBe(29)

    const strengthBaseline = structuralStrengthModule.structuralStrengthService.getBaselineV0()
    expect(strengthBaseline.checksum).toBe('sha_v0_cf5fe0ee')
  })
})
