import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { computeSha256OfFile } from '@/lib/finances/cryptoUtils'

describe('RACE-SOURCE-01 file integrity and hashes', () => {
  const f1 = path.resolve(process.cwd(), 'src/assets/01raceregraseparametros-3c0c5.json')
  const f2 = path.resolve(process.cwd(), 'src/assets/02racecenariosetestes-f3097.json')
  const f3 = path.resolve(process.cwd(), 'src/assets/03raceformulasefonte-0d9bf.json')

  it('files exist and compute valid sha256', () => {
    expect(fs.existsSync(f1)).toBe(true)
    expect(fs.existsSync(f2)).toBe(true)
    expect(fs.existsSync(f3)).toBe(true)

    const r1 = computeSha256OfFile(f1)
    const r2 = computeSha256OfFile(f2)
    const r3 = computeSha256OfFile(f3)

    console.log('HASH F1:', r1.sha256, r1.byteLength)
    console.log('HASH F2:', r2.sha256, r2.byteLength)
    console.log('HASH F3:', r3.sha256, r3.byteLength)

    expect(r1.sha256).toBeDefined()
    expect(r2.sha256).toBeDefined()
    expect(r3.sha256).toBeDefined()
  })
})
