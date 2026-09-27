import { describe, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('inspect canonical and initialization files', () => {
  it('reads canonical files', () => {
    const p1 = path.resolve('src/lib/canonical-driver-database.ts')
    if (fs.existsSync(p1)) {
      const c1 = fs.readFileSync(p1, 'utf-8')
      console.log('CANONICAL_DRIVER_DB_SNIPPET:', c1.slice(0, 1500))
    }
    const p2 = path.resolve('src/lib/mbj-drivers-data.ts')
    if (fs.existsSync(p2)) {
      const c2 = fs.readFileSync(p2, 'utf-8')
      console.log('MBJ_DRIVERS_DATA_LEN:', c2.length)
    }
  })
})
