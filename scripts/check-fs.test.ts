import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

describe('check-fs', () => {
  it('reads headers to confirm image', () => {
    const p3 = path.resolve(process.cwd(), 'src/assets/05-gabrielbortoleto-ed602.png')
    const p4 = path.resolve(process.cwd(), 'src/assets/05-gabrielbortoleto-171b0.png')
    const p5 = path.resolve(process.cwd(), 'src/assets/image-bc4f0.png')
    const buf3 = fs.readFileSync(p3)
    const buf4 = fs.readFileSync(p4)
    const buf5 = fs.readFileSync(p5)
    const w3 = buf3.readUInt32BE(16)
    const h3 = buf3.readUInt32BE(20)
    const w4 = buf4.readUInt32BE(16)
    const h4 = buf4.readUInt32BE(20)
    const w5 = buf5.readUInt32BE(16)
    const h5 = buf5.readUInt32BE(20)

    // Check sizes
    expect({
      w3,
      h3,
      len3: buf3.length,
      w4,
      h4,
      len4: buf4.length,
      w5,
      h5,
      len5: buf5.length,
    }).toEqual({
      w3: 0,
      h3: 0,
      len3: 0,
      w4: 0,
      h4: 0,
      len4: 0,
      w5: 0,
      h5: 0,
      len5: 0,
    })
  })
})
