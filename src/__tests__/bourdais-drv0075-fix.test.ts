import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import {
  resolveCanonicalDriverImagePath,
  getCanonicalDisplayName,
  getDriverCanonicalKey,
  DRIVER_CANONICAL_PHOTO_MAP,
} from '@/lib/driver-canonical-service'
import { DRIVER_PORTRAIT_ASSET_MAP } from '@/lib/driver-portrait-map'
import {
  CANONICAL_DRIVER_ID_TO_ASSET_ID,
  getCanonicalDriverMaster,
} from '@/lib/canonical-driver-database'

describe('CORREÇÃO BOURDAIS DRV_0075', () => {
  it('1. Arquivo public/pilotos/DRV_0075.jpg existe fisicamente e não é vazio', () => {
    const filePath = path.resolve(process.cwd(), 'public', 'pilotos', 'DRV_0075.jpg')
    expect(fs.existsSync(filePath), 'DRV_0075.jpg deve existir fisicamente').toBe(true)
    const stats = fs.statSync(filePath)
    expect(stats.size).toBeGreaterThan(1000)
    console.log(
      'PUBLIC PILOTOS FILES:',
      fs
        .readdirSync(path.resolve(process.cwd(), 'public', 'pilotos'))
        .filter((f) => f.includes('0075')),
    )
  })

  it('2. Sébastien Bourdais (com e sem acento) e mbj-128 resolvem para DRV_0075.jpg', () => {
    const resAccent = resolveDriverPhoto({ name: 'Sébastien Bourdais' })
    const resNoAccent = resolveDriverPhoto({ name: 'Sebastien Bourdais' })
    const resById = resolveDriverPhoto({ driverId: 'mbj-128', name: 'Sébastien Bourdais' })

    expect(resAccent.url).toBe('/pilotos/DRV_0075.jpg')
    expect(resAccent.sourceType).toBe('canonical_real')
    expect(resAccent.assetId).toBe('DRV_0075')

    expect(resNoAccent.url).toBe('/pilotos/DRV_0075.jpg')
    expect(resNoAccent.sourceType).toBe('canonical_real')
    expect(resNoAccent.assetId).toBe('DRV_0075')

    expect(resById.url).toBe('/pilotos/DRV_0075.jpg')
    expect(resById.sourceType).toBe('canonical_real')
    expect(resById.assetId).toBe('DRV_0075')

    expect(resolveCanonicalDriverImagePath(null, 'Sébastien Bourdais')).toBe(
      '/pilotos/DRV_0075.jpg',
    )
    expect(resolveCanonicalDriverImagePath(null, 'Sebastien Bourdais')).toBe(
      '/pilotos/DRV_0075.jpg',
    )
    expect(resolveCanonicalDriverImagePath('mbj-128', null)).toBe('/pilotos/DRV_0075.jpg')
  })

  it('3. Mappings globais apontam Bourdais para DRV_0075 sem colisão', () => {
    expect(DRIVER_PORTRAIT_ASSET_MAP.drv_sebastien_bourdais).toBe('DRV_0075')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-128']).toBe('DRV_0075')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_sebastien_bourdais']).toBe('DRV_0075')

    const master = getCanonicalDriverMaster('mbj-128')
    expect(master).toBeDefined()
    expect(master?.assetId).toBe('DRV_0075')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0075.jpg')

    // Confirma que nenhum outro piloto usa DRV_0075 (anti-colisão)
    for (const [key, val] of Object.entries(DRIVER_PORTRAIT_ASSET_MAP)) {
      if (val === 'DRV_0075') {
        expect(key).toBe('drv_sebastien_bourdais')
      }
    }

    for (const [key, val] of Object.entries(DRIVER_CANONICAL_PHOTO_MAP)) {
      if (val === '/pilotos/DRV_0075.jpg') {
        expect(['sebastienbourdais', 'sébastienbourdais', 'mbj-128']).toContain(key)
      }
    }
  })
})
