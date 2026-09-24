import { buildCompleteBaselineV0 } from '@/scripts/generate-baseline-v0'
import { BalanceBaselineV0 } from '@/types/structural-strength'
import * as fs from 'fs'
import * as path from 'path'

// Gera baseline em memória
export const BASELINE_V0_DATA: BalanceBaselineV0 = buildCompleteBaselineV0()

// Salva em disco de forma síncrona na inicialização do módulo se em ambiente Node / runner
if (typeof process !== 'undefined' && process.cwd) {
  try {
    const jsonPath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')
    const generated = JSON.stringify(BASELINE_V0_DATA, null, 2)
    fs.writeFileSync(jsonPath, generated, 'utf-8')
  } catch {
    // defende contra ambientes browser puro sem fs
  }
}
