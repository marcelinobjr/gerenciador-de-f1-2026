import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import crypto from 'node:crypto'

describe('Orphan asset verification script', () => {
  it('computes hashes and sizes', () => {
    const rootDrv: any[] = []
    for (let i = 101; i <= 134; i++) {
      const pad = String(i).padStart(4, '0')
      const name = `DRV_${pad}.jpg`
      const rootPath = `./${name}`
      const canonPath = `./public/pilotos/${name}`
      expect(fs.existsSync(rootPath)).toBe(true)
      expect(fs.existsSync(canonPath)).toBe(true)

      const rootBuf = fs.readFileSync(rootPath)
      const canonBuf = fs.readFileSync(canonPath)

      const rootHash = crypto.createHash('sha256').update(rootBuf).digest('hex')
      const canonHash = crypto.createHash('sha256').update(canonBuf).digest('hex')

      expect(rootHash).toBe(canonHash)
      expect(rootBuf.length).toBe(canonBuf.length)
      rootDrv.push({ name, size: rootBuf.length, hash: rootHash })
    }

    const rootPiloto: any[] = []
    for (let i = 1; i <= 13; i++) {
      const pad = String(i).padStart(2, '0')
      const name = `Piloto_${pad}.jpg`
      const rootPath = `./${name}`
      const canonPath = `./public/pilotos-gerados/${name}`
      expect(fs.existsSync(rootPath)).toBe(true)
      expect(fs.existsSync(canonPath)).toBe(true)

      const rootBuf = fs.readFileSync(rootPath)
      const canonBuf = fs.readFileSync(canonPath)

      const rootHash = crypto.createHash('sha256').update(rootBuf).digest('hex')
      const canonHash = crypto.createHash('sha256').update(canonBuf).digest('hex')

      expect(rootHash).toBe(canonHash)
      expect(rootBuf.length).toBe(canonBuf.length)
      rootPiloto.push({ name, size: rootBuf.length, hash: rootHash })
    }

    console.log('DRV_COUNT:', rootDrv.length)
    console.log('PILOTO_COUNT:', rootPiloto.length)
    throw new Error('RESULTS:::' + JSON.stringify({ drv: rootDrv, piloto: rootPiloto }))
  })
})
