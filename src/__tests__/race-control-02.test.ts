import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('inspect probe', () => {
  it('reads canonical-race-v2.ts', () => {
    const p = path.resolve(process.cwd(), 'src/types/canonical-race-v2.ts')
    const content = fs.readFileSync(p, 'utf-8')
    console.log('TYPE_DEFS:', content.slice(0, 1500))
    expect(content.length).toBeGreaterThan(0)
  })
})
