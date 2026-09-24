import { BalanceBaselineV0 } from '@/types/structural-strength'
import baselineV0Raw from './balance-baseline-v0.json'

/**
 * Hash estável determinístico FNV-1a de 64 bits para o payload
 */
export function calculateStableChecksum(data: unknown): string {
  const json = typeof data === 'string' ? data : JSON.stringify(data)
  let h1 = 0x811c9dc5
  let h2 = 0xcbf29ce4
  for (let i = 0; i < json.length; i++) {
    const code = json.charCodeAt(i)
    h1 ^= code
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= code
    h2 = Math.imul(h2, 0x01000193)
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
  return `sha_v0_${hex1}${hex2}`
}

/**
 * BASELINE_V0_DATA: Baseline histórica estática canônica imutável.
 * Importada diretamente do JSON estático versionado src/data/balance-baseline-v0.json.
 * Congelada com Object.freeze para prevenir qualquer mutação em runtime.
 */
export const BASELINE_V0_DATA: BalanceBaselineV0 = Object.freeze(
  baselineV0Raw as unknown as BalanceBaselineV0,
)
