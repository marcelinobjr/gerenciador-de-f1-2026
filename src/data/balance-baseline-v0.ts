import { BalanceBaselineV0 } from '@/types/structural-strength'
import baselineV0Raw from './balance-baseline-v0.json'

/**
 * BASELINE_V0_DATA: Baseline histórica estática canônica imutável.
 * Importada diretamente do JSON estático versionado src/data/balance-baseline-v0.json.
 * Congelada com Object.freeze para prevenir qualquer mutação em runtime.
 */
export const BASELINE_V0_DATA: BalanceBaselineV0 = Object.freeze(
  baselineV0Raw as unknown as BalanceBaselineV0,
)
