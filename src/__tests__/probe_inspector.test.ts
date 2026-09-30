import fs from 'node:fs'
import { describe, it } from 'vitest'

describe('probe files', () => {
  it('reads target files', () => {
    const f1 = 'src/data/balance-baseline-v0.ts'
    const f2 = 'src/data/baseline-2026-v1.ts'
    const f3 = 'src/services/structuralStrengthService.ts'
    if (fs.existsSync(f1))
      console.log('F1_START\n' + fs.readFileSync(f1, 'utf-8').slice(0, 500) + '\nF1_END')
    if (fs.existsSync(f2)) console.log('F2_START\n' + fs.readFileSync(f2, 'utf-8') + '\nF2_END')
    if (fs.existsSync(f3))
      console.log('F3_START\n' + fs.readFileSync(f3, 'utf-8').slice(0, 800) + '\nF3_END')
    expect(true).toBe(true)
  })
})
