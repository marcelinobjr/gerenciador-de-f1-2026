import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { calculateStableChecksum } from '@/data/balance-baseline-v0'

describe('check v0 test', () => {
  it('check v0 on disk', () => {
    const filePath = path.resolve(process.cwd(), 'src/data/balance-baseline-v0.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    const teams = Object.keys(parsed.teams)
    expect(teams.length).toBe(1)
  })
})
