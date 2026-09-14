import { describe, it } from 'vitest'
import fs from 'node:fs'

describe('Inspect PDF stream chunks', () => {
  it('checks raw text markers in poster pdf', () => {
    const posterBuf = fs.readFileSync('src/assets/posterespilotosmbj2026-13ddc.pdf')
    console.log('Poster PDF bytes:', posterBuf.length)
    const head = posterBuf.slice(0, 1000).toString('latin1')
    console.log('Poster PDF header:', head)
  })
})
