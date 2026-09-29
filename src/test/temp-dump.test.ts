import { describe, it, expect } from 'vitest'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import { DRIVER_PORTRAIT_ASSET_MAP } from '@/lib/driver-portrait-map'
import fs from 'fs'
import path from 'path'

describe('DUMP PILOTS IN TEST ASSERTION', () => {
  it('checks pilots', () => {
    const list = MBJ_2026_PILOTS.map((p) => p.name)
    const helioIdx = list.findIndex((n) => n.includes('Castroneves'))
    const slaterIdx = list.findIndex((n) => n.includes('Slater'))

    // Check files in public/pilotos
    const pilotosDir = path.resolve(process.cwd(), 'public/pilotos')
    const files = fs.readdirSync(pilotosDir).sort()

    // Let's assert something that fails so vitest output shows the details or check exact slice
    const slice = list.slice(helioIdx, helioIdx + 15)
    expect({
      helioIdx,
      slaterIdx,
      slice,
      filesCount: files.length,
      sampleFiles: files.filter((f) => f.includes('015')),
    }).toEqual({})
  })
})
