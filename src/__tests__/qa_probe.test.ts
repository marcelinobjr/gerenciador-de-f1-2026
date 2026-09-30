import fs from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('probe', () => {
  it('reads files', () => {
    const f1 = fs.existsSync('src/pages/Standings.tsx')
    const f2 = fs.existsSync('src/pages/Teams.tsx')
    // fail intentionally to see console output or assertion
    expect({
      f1,
      f2,
      contentStandings: fs.readFileSync('src/pages/Standings.tsx', 'utf-8').slice(0, 200),
    }).toBeNull()
  })
})
