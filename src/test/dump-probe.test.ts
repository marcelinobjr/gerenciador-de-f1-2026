import { describe, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('inspect probe', () => {
  it('dumps canonical driver database snippet', () => {
    const p1 = path.resolve('src/lib/canonical-driver-database.ts')
    const c1 = fs.readFileSync(p1, 'utf-8')
    fs.writeFileSync(path.resolve('src/test/dump_canonical_db.txt'), c1.slice(0, 3000))
  })
})
