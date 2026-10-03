import { describe, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('probe files', () => {
  it('reads sprint files', () => {
    // let's read sprint files
    const p = path.resolve(process.cwd(), 'src/__tests__/china-sprint-flow-01.test.ts')
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8')
      throw new Error('CHINA_SPRINT:\n' + content.slice(0, 1000))
    }
  })
})
