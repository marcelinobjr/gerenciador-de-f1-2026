import { describe, it } from 'vitest'
import * as fs from 'fs'

describe('audit-probe', () => {
  it('reads practice files', () => {
    const s = fs.readFileSync('src/services/practiceSessionService.ts', 'utf-8')
    console.log('PRACTICE_SESSION_SERVICE_LEN:', s.length)
  })
})
