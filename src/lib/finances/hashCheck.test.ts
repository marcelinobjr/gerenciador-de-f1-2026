import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import { computeSha256OfFile } from './cryptoUtils'

describe('Compute SHA256 of uploaded assets', () => {
  it('computes sha256 of the 3 json files', () => {
    const f1 = path.resolve(process.cwd(), 'src/assets/01finevoparametros-9bcaa.json')
    const f2 = path.resolve(process.cwd(), 'src/assets/02finevocenariosetestes-e6c0c.json')
    const f3 = path.resolve(process.cwd(), 'src/assets/03finevoformulasefonte-aac56.json')

    const r1 = computeSha256OfFile(f1)
    const r2 = computeSha256OfFile(f2)
    const r3 = computeSha256OfFile(f3)

    throw new Error(
      `HASHES:\n1: ${r1.sha256} (${r1.byteLength} bytes)\n2: ${r2.sha256} (${r2.byteLength} bytes)\n3: ${r3.sha256} (${r3.byteLength} bytes)`,
    )
  })
})
