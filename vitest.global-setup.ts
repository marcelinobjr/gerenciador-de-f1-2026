import { buildCompleteBaselineV0 } from './src/scripts/generate-baseline-v0'
import * as fs from 'fs'
import * as path from 'path'

export default function setup() {
  const filePath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')
  const baseline = buildCompleteBaselineV0()
  const content = JSON.stringify(baseline, null, 2)
  fs.writeFileSync(filePath, content, 'utf-8')
  // Verifica se gravou
  const stat = fs.statSync(filePath)
  if (stat.size < 1000) {
    throw new Error(`Failed to write baseline V0: size is ${stat.size}`)
  }
}
