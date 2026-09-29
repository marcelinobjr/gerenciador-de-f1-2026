import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('CHECK DRV_DRV_0150', () => {
  it('checks if DRV_DRV_0150.jpg exists', () => {
    const dir = path.resolve(process.cwd(), 'public/pilotos')
    const hasDrvDrv = fs.existsSync(path.join(dir, 'DRV_DRV_0150.jpg'))
    const hasDrv = fs.existsSync(path.join(dir, 'DRV_0150.jpg'))
    // expect hasDrv to be true
    expect(hasDrv).toBe(true)
    // check hasDrvDrv
    expect(hasDrvDrv).toBe(false)
  })
})
