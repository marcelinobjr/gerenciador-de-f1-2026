import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

describe('check-fs', () => {
  it('reads headers to confirm image', () => {
    const p1 = path.resolve(process.cwd(), 'src/assets/audi-a0460.png')
    const p2 = path.resolve(process.cwd(), 'src/assets/image-cd908.png')
    const buf1 = fs.readFileSync(p1)
    const buf2 = fs.readFileSync(p2)
    const w1 = buf1.readUInt32BE(16)
    const h1 = buf1.readUInt32BE(20)
    const w2 = buf2.readUInt32BE(16)
    const h2 = buf2.readUInt32BE(20)
    expect({ w1, h1, w2, h2 }).toEqual({ w1: 0, h1: 0, w2: 0, h2: 0 })
  })
})
