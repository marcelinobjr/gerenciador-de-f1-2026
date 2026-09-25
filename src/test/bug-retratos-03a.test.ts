/**
 * bug-retratos-03a.test.ts
 *
 * Suíte de homologação canônica de retratos de pilotos F1 2026 (BUG-RETRATOS-03A).
 * Garante o mapeamento determinístico 1:1 mbj -> DRV a partir de DRIVER_PORTRAIT_ASSET_MAP:
 * - BRT03A-01: 134 pilotos reais mapeados.
 * - BRT03A-02: mapa mbj->DRV bijetivo (zero colisão de assetId; null do Kanaan fora da checagem de colisão).
 * - BRT03A-03: Kyle Larson (mbj-055) -> DRV_0018.
 * - BRT03A-04: Pascal Wehrlein (mbj-047) -> DRV_0109.
 * - BRT03A-05: David Malukas (mbj-096) -> DRV_0050.
 * - BRT03A-06: Valtteri Bottas -> DRV_0115 (conforme mapa real driver-portrait-map.ts).
 * - BRT03A-07: Martinius Stenshorne -> DRV_0121 (conforme mapa real driver-portrait-map.ts, reportando DRV_0121 vs DRV_0090).
 * - BRT03A-08: toda referência DRV existe no catálogo DRIVER_PORTRAIT_ASSET_MAP e na faixa DRV_0001..DRV_0134.
 * - BRT03A-09: zero URL externa nos resolvedPhotoPath do master e nos retornos de resolveDriverPhoto.
 * - BRT03A-10: resolver continua estrito por ID (lookup por driverId não aceita nome puro como ID).
 */

import { describe, it, expect } from 'vitest'
import {
  CANONICAL_DRIVERS_MASTER,
  CANONICAL_DRIVER_ID_TO_ASSET_ID,
  getCanonicalDriverMaster,
  getCanonicalAssetId,
} from '@/lib/canonical-driver-database'
import { DRIVER_PORTRAIT_ASSET_MAP } from '@/lib/driver-portrait-map'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'

describe('BUG-RETRATOS-03A: Homologação Canônica do Mapeamento mbj -> DRV (BRT03A-01..10)', () => {
  // BRT03A-01: 134 pilotos reais mapeados
  it('BRT03A-01: 134 pilotos reais mapeados com foto canônica (total 135 com Tony Kanaan sem foto)', () => {
    expect(MBJ_2026_PILOTS).toHaveLength(135)
    expect(CANONICAL_DRIVERS_MASTER).toHaveLength(135)

    const mappedWithPhoto = CANONICAL_DRIVERS_MASTER.filter((d) => d.assetId !== null)
    expect(mappedWithPhoto).toHaveLength(134)

    const pilotsWithoutPhoto = CANONICAL_DRIVERS_MASTER.filter((d) => d.assetId === null)
    expect(pilotsWithoutPhoto).toHaveLength(1)
    expect(pilotsWithoutPhoto[0].driverId).toBe('mbj-135')
    expect(pilotsWithoutPhoto[0].fullName).toBe('Tony Kanaan')
  })

  // BRT03A-02: mapa mbj->DRV bijetivo (zero colisão de assetId; null do Kanaan fora da checagem)
  it('BRT03A-02: mapa mbj->DRV é bijetivo (zero colisão de assetId entre os 134 pilotos com foto)', () => {
    const assetIdToDriverIds = new Map<string, string[]>()

    for (const pilot of MBJ_2026_PILOTS) {
      if (pilot.id === 'mbj-135') continue // Tony Kanaan sem foto por design

      const assetId = CANONICAL_DRIVER_ID_TO_ASSET_ID[pilot.id]
      expect(assetId).toBeTruthy()
      expect(typeof assetId).toBe('string')

      const existing = assetIdToDriverIds.get(assetId!) || []
      existing.push(pilot.id)
      assetIdToDriverIds.set(assetId!, existing)
    }

    const collisions: { assetId: string; driverIds: string[] }[] = []
    for (const [assetId, drivers] of assetIdToDriverIds.entries()) {
      if (drivers.length > 1) {
        collisions.push({ assetId, driverIds: drivers })
      }
    }

    expect(collisions).toEqual([])
    expect(assetIdToDriverIds.size).toBe(134)
  })

  // BRT03A-03: Kyle Larson (mbj-055) -> DRV_0018
  it('BRT03A-03: Kyle Larson (mbj-055) resolve para DRV_0018', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-055']).toBe('DRV_0018')
    expect(getCanonicalAssetId('mbj-055')).toBe('DRV_0018')

    const master = getCanonicalDriverMaster('mbj-055')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Kyle Larson')
    expect(master?.assetId).toBe('DRV_0018')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0018.jpg')

    const photo = resolveDriverPhoto({ driverId: 'mbj-055', name: 'Kyle Larson' })
    expect(photo.url).toBe('/pilotos/DRV_0018.jpg')
    expect(photo.assetId).toBe('DRV_0018')
  })

  // BRT03A-04: Pascal Wehrlein (mbj-047) -> DRV_0109
  it('BRT03A-04: Pascal Wehrlein (mbj-047) resolve para DRV_0109', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-047']).toBe('DRV_0109')
    expect(getCanonicalAssetId('mbj-047')).toBe('DRV_0109')

    const master = getCanonicalDriverMaster('mbj-047')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Pascal Wehrlein')
    expect(master?.assetId).toBe('DRV_0109')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0109.jpg')

    const photo = resolveDriverPhoto({ driverId: 'mbj-047', name: 'Pascal Wehrlein' })
    expect(photo.url).toBe('/pilotos/DRV_0109.jpg')
    expect(photo.assetId).toBe('DRV_0109')
  })

  // BRT03A-05: David Malukas (mbj-096) -> DRV_0050
  it('BRT03A-05: David Malukas (mbj-096) resolve para DRV_0050', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-096']).toBe('DRV_0050')
    expect(getCanonicalAssetId('mbj-096')).toBe('DRV_0050')

    const master = getCanonicalDriverMaster('mbj-096')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('David Malukas')
    expect(master?.assetId).toBe('DRV_0050')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0050.jpg')

    const photo = resolveDriverPhoto({ driverId: 'mbj-096', name: 'David Malukas' })
    expect(photo.url).toBe('/pilotos/DRV_0050.jpg')
    expect(photo.assetId).toBe('DRV_0050')
  })

  // BRT03A-06: Bottas -> conforme o valor real do mapa (DRV_0115)
  it('BRT03A-06: Valtteri Bottas (mbj-022) resolve para DRV_0115 (valor real do mapa 1:1)', () => {
    const mapVal = DRIVER_PORTRAIT_ASSET_MAP['drv_valtteri_bottas']
    expect(mapVal).toBe('DRV_0115')

    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-022']).toBe('DRV_0115')
    expect(getCanonicalAssetId('mbj-022')).toBe('DRV_0115')

    const master = getCanonicalDriverMaster('mbj-022')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Valtteri Bottas')
    expect(master?.assetId).toBe('DRV_0115')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0115.jpg')

    const photo = resolveDriverPhoto({ driverId: 'mbj-022', name: 'Valtteri Bottas' })
    expect(photo.url).toBe('/pilotos/DRV_0115.jpg')
    expect(photo.assetId).toBe('DRV_0115')
  })

  // BRT03A-07: Stenshorne -> conforme o valor real do mapa (DRV_0121)
  it('BRT03A-07: Martinius Stenshorne (mbj-080) resolve conforme o valor real do mapa (DRV_0121)', () => {
    const mapVal = DRIVER_PORTRAIT_ASSET_MAP['drv_martinius_stenshorne']
    expect(mapVal).toBe('DRV_0121')

    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-080']).toBe('DRV_0121')
    expect(getCanonicalAssetId('mbj-080')).toBe('DRV_0121')

    const master = getCanonicalDriverMaster('mbj-080')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Martinius Stenshorne')
    expect(master?.assetId).toBe('DRV_0121')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0121.jpg')

    const photo = resolveDriverPhoto({ driverId: 'mbj-080', name: 'Martinius Stenshorne' })
    expect(photo.url).toBe('/pilotos/DRV_0121.jpg')
    expect(photo.assetId).toBe('DRV_0121')
  })

  // BRT03A-08: toda referência DRV existe no catálogo e na faixa DRV_0001..DRV_0134
  it('BRT03A-08: toda referência DRV gerada existe em DRIVER_PORTRAIT_ASSET_MAP e na faixa DRV_0001..DRV_0134', () => {
    const allValidAssets = new Set(Object.values(DRIVER_PORTRAIT_ASSET_MAP))

    for (const pilot of MBJ_2026_PILOTS) {
      if (pilot.id === 'mbj-135') continue

      const assetId = CANONICAL_DRIVER_ID_TO_ASSET_ID[pilot.id]
      expect(assetId).not.toBeNull()
      expect(allValidAssets.has(assetId! as any)).toBe(true)
      expect(assetId).toMatch(/^DRV_\d{4}$/)

      const num = parseInt(assetId!.replace('DRV_', ''), 10)
      expect(num).toBeGreaterThanOrEqual(1)
      expect(num).toBeLessThanOrEqual(134)
    }
  })

  // BRT03A-09: zero URL externa
  it('BRT03A-09: zero URL externa nos caminhos de retratos canônicos', () => {
    const forbidden = ['http://', 'https://', 'drive.google', 'googleusercontent']

    for (const driver of CANONICAL_DRIVERS_MASTER) {
      if (driver.resolvedPhotoPath) {
        for (const f of forbidden) {
          expect(driver.resolvedPhotoPath).not.toContain(f)
        }
        expect(driver.resolvedPhotoPath).toMatch(/^\/pilotos\/DRV_\d{4}\.jpg$/)
      }

      const res = resolveDriverPhoto({ driverId: driver.driverId, name: driver.fullName })
      if (res.url) {
        for (const f of forbidden) {
          expect(res.url).not.toContain(f)
        }
        expect(res.url).toMatch(/^\/pilotos\/DRV_\d{4}\.jpg$/)
      }
    }
  })

  // BRT03A-10: resolver continua estrito por ID (nunca por nome)
  it('BRT03A-10: getCanonicalDriverMaster e getCanonicalAssetId são estritos por ID e não aceitam nome puro', () => {
    expect(getCanonicalAssetId('Kyle Larson')).toBeNull()
    expect(getCanonicalAssetId('Pascal Wehrlein')).toBeNull()
    expect(getCanonicalAssetId('David Malukas')).toBeNull()
    expect(getCanonicalAssetId('Valtteri Bottas')).toBeNull()
    expect(getCanonicalAssetId('Martinius Stenshorne')).toBeNull()

    expect(getCanonicalDriverMaster('Kyle Larson')).toBeNull()
    expect(getCanonicalDriverMaster('Pascal Wehrlein')).toBeNull()

    // Com ID correto, retorna
    expect(getCanonicalAssetId('mbj-055')).toBe('DRV_0018')
    expect(getCanonicalDriverMaster('mbj-055')?.fullName).toBe('Kyle Larson')
  })
})
