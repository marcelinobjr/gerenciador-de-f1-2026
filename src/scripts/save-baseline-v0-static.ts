import { buildCompleteBaselineV0, calculateStableChecksum } from './generate-baseline-v0'
import * as fs from 'fs'
import * as path from 'path'

export function persistBaselineV0Static(): void {
  const full = buildCompleteBaselineV0()
  const targetPath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')
  const json = JSON.stringify(full, null, 2)
  fs.writeFileSync(targetPath, json, 'utf-8')
}

// Execução se chamado diretamente
if (typeof process !== 'undefined' && process.cwd) {
  try {
    persistBaselineV0Static()
  } catch {
    // browser safe
  }
}
