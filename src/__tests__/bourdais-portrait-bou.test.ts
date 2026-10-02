import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import {
  resolveCanonicalDriverImagePath,
  DRIVER_CANONICAL_PHOTO_MAP,
} from '@/lib/driver-canonical-service'
import { DRIVER_PORTRAIT_ASSET_MAP } from '@/lib/driver-portrait-map'
import {
  CANONICAL_DRIVER_ID_TO_ASSET_ID,
  getCanonicalDriverMaster,
} from '@/lib/canonical-driver-database'
import * as MbjModule from '@/lib/mbj-drivers-data'

describe('BOU01-BOU04: Sébastien Bourdais (DRV_0075) portrait suite', () => {
  it('BOU01: DRV_0075 resolve para o asset correto', () => {
    const resAccent = resolveDriverPhoto({ name: 'Sébastien Bourdais' })
    const resNoAccent = resolveDriverPhoto({ name: 'Sebastien Bourdais' })
    const resById = resolveDriverPhoto({ driverId: 'mbj-128' })
    const resBoth = resolveDriverPhoto({ driverId: 'mbj-128', name: 'Sébastien Bourdais' })

    expect(resAccent.assetId).toBe('DRV_0075')
    expect(resAccent.url).toBe('/pilotos/DRV_0075.jpg')

    expect(resNoAccent.assetId).toBe('DRV_0075')
    expect(resNoAccent.url).toBe('/pilotos/DRV_0075.jpg')

    expect(resById.assetId).toBe('DRV_0075')
    expect(resById.url).toBe('/pilotos/DRV_0075.jpg')

    expect(resBoth.assetId).toBe('DRV_0075')
    expect(resBoth.url).toBe('/pilotos/DRV_0075.jpg')

    // Raw JSON or drivers list
    const driversList =
      (MbjModule as any).MBJ_DRIVERS ||
      (MbjModule as any).mbjDrivers ||
      (MbjModule as any).drivers ||
      []
    if (driversList.length > 0) {
      const mbj128 = driversList.find((d: any) => d.id === 'mbj-128')
      if (mbj128) {
        expect(mbj128.photoFilename).toBe('DRV_0075.jpg')
      }
    }
  })

  it('BOU02: resolver retorna path válido e asset físico existe', () => {
    const resolvedPath = resolveCanonicalDriverImagePath('mbj-128', 'Sébastien Bourdais')
    expect(resolvedPath).toBe('/pilotos/DRV_0075.jpg')

    const filePath = path.resolve(process.cwd(), 'public', 'pilotos', 'DRV_0075.jpg')
    expect(fs.existsSync(filePath)).toBe(true)
    const stats = fs.statSync(filePath)
    expect(stats.size).toBeGreaterThan(1000)
  })

  it('BOU03: fallback continua funcionando quando id/nome inválido ou sem foto', () => {
    const fallbackEmpty = resolveDriverPhoto({})
    expect(fallbackEmpty.sourceType).toBe('fallback_initials')
    expect(fallbackEmpty.url).toBeNull()
    expect(fallbackEmpty.fallbackInitials).toBe('F1')

    const fallbackUnknown = resolveDriverPhoto({ name: 'Piloto Inexistente' })
    expect(fallbackUnknown.sourceType).toBe('fallback_initials')
    expect(fallbackUnknown.url).toBeNull()
    expect(fallbackUnknown.fallbackInitials).toBe('PI')
  })

  it('BOU04: nenhum outro piloto teve mapping alterado sem necessidade', () => {
    // DRV_0075 não colide com nenhum outro piloto
    for (const [key, val] of Object.entries(DRIVER_PORTRAIT_ASSET_MAP)) {
      if (val === 'DRV_0075') {
        expect(['drv_sebastien_bourdais', 'mbj-128']).toContain(key)
      }
    }

    // Max Verstappen mbj-001 continua DRV_0001
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-001']).toBe('DRV_0001')
    expect(resolveDriverPhoto({ driverId: 'mbj-001', name: 'Max Verstappen' }).assetId).toBe(
      'DRV_0001',
    )

    // Fernando Alonso mbj-009 continua DRV_0009
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-009']).toBe('DRV_0009')
  })
})
