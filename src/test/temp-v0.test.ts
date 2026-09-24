import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { buildCompleteBaselineV0 } from '@/scripts/generate-baseline-v0'

describe('Persistência canônica do JSON V0', () => {
  it('gera src/data/balance-baseline-v0.json completo', () => {
    const filePath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')
    const full = buildCompleteBaselineV0()
    fs.writeFileSync(filePath, JSON.stringify(full, null, 2), 'utf-8')
    expect(fs.existsSync(filePath)).toBe(true)
  })
})
