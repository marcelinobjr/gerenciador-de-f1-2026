import { describe, it, expect } from 'vitest'
import fs from 'fs'

describe('Verify Ficha Mestre file', () => {
  it('checks saved file', () => {
    const fichaExists = fs.existsSync('src/assets/bancopilotosmbj2026-39678.pdf')
    expect(fichaExists).toBe(true)
    const stat = fs.statSync('src/assets/bancopilotosmbj2026-39678.pdf')
    console.log('Ficha Mestre size on disk:', stat.size)
    expect(stat.size).toBeGreaterThan(1000)
  })
})
