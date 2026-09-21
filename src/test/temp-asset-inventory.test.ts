// @ts-nocheck
import { describe, it, expect } from 'vitest'

describe('Inventory hash checker', () => {
  it('checks images', async () => {
    // Dynamic import to avoid static tsc checking if needed or use standard node modules
    const fs = await import('node:fs')
    const crypto = await import('node:crypto')

    const drvList = []
    for (let i = 101; i <= 134; i++) {
      const pad = String(i).padStart(4, '0')
      const name = `DRV_${pad}.jpg`
      const rootPath = `./${name}`
      const canonPath = `./public/pilotos/${name}`
      const rootBuf = fs.readFileSync(rootPath)
      const canonBuf = fs.readFileSync(canonPath)
      const rootHash = crypto.createHash('sha256').update(rootBuf).digest('hex')
      const canonHash = crypto.createHash('sha256').update(canonBuf).digest('hex')
      expect(rootHash).toBe(canonHash)
      drvList.push({ name, size: rootBuf.length, hash: rootHash })
    }

    const pilotoList = []
    for (let i = 1; i <= 13; i++) {
      const pad = String(i).padStart(2, '0')
      const name = `Piloto_${pad}.jpg`
      const rootPath = `./${name}`
      const canonPath = `./public/pilotos-gerados/${name}`
      const rootBuf = fs.readFileSync(rootPath)
      const canonBuf = fs.readFileSync(canonPath)
      const rootHash = crypto.createHash('sha256').update(rootBuf).digest('hex')
      const canonHash = crypto.createHash('sha256').update(canonBuf).digest('hex')
      expect(rootHash).toBe(canonHash)
      pilotoList.push({ name, size: rootBuf.length, hash: rootHash })
    }

    throw new Error('HASH_VERIFIED:::' + JSON.stringify({ drv: drvList, piloto: pilotoList }))
  })
})
