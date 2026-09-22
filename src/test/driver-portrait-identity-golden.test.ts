/**
 * driver-portrait-identity-golden.test.ts
 *
 * Teste Golden de Identidade dos Retratos dos Pilotos (GOLDEN-01..08):
 * - Carlos Sainz (drv_carlos_sainz / mbj-014) -> DRV_0089 (/pilotos/DRV_0089.jpg)
 * - Jack Doohan (drv_jack_doohan / mbj-012) -> DRV_0015 (/pilotos/DRV_0015.jpg)
 * - Max Verstappen (drv_max_verstappen / mbj-001) -> DRV_0022 (/pilotos/DRV_0022.jpg)
 * - Lando Norris (drv_lando_norris / mbj-005) -> DRV_0019 (/pilotos/DRV_0019.jpg)
 * - Charles Leclerc (drv_charles_leclerc / mbj-004) -> DRV_0047 (/pilotos/DRV_0047.jpg)
 * - Mick Schumacher (drv_mick_schumacher / mbj-037) -> DRV_0105 (/pilotos/DRV_0105.jpg)
 * - Gabriel Bortoleto (drv_gabriel_bortoleto / mbj-020) -> DRV_0012 (/pilotos/DRV_0012.jpg)
 * - Nico Hülkenberg (drv_nico_hulkenberg / mbj-019) -> DRV_0068 (/pilotos/DRV_0068.jpg)
 */

import { describe, it, expect } from 'vitest'
import {
  CANONICAL_DRIVER_ID_TO_ASSET_ID,
  getCanonicalAssetId,
  getCanonicalDriverMaster,
} from '@/lib/canonical-driver-database'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'

describe('DRIVER-PORTRAIT-IDENTITY-GOLDEN (GOLDEN-01..08)', () => {
  it('GOLDEN-01: Carlos Sainz (drv_carlos_sainz / mbj-014) resolve para DRV_0089 e /pilotos/DRV_0089.jpg', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-014']).toBe('DRV_0089')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_carlos_sainz']).toBe('DRV_0089')
    expect(getCanonicalAssetId('mbj-014')).toBe('DRV_0089')
    expect(getCanonicalAssetId('drv_carlos_sainz')).toBe('DRV_0089')

    const master = getCanonicalDriverMaster('mbj-014')
    expect(master?.assetId).toBe('DRV_0089')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0089.jpg')

    const photoFromMbj = resolveDriverPhoto({ driverId: 'mbj-014' })
    expect(photoFromMbj.url).toBe('/pilotos/DRV_0089.jpg')
    expect(photoFromMbj.assetId).toBe('DRV_0089')

    const photoFromAlias = resolveDriverPhoto({ driverId: 'drv_carlos_sainz' })
    expect(photoFromAlias.url).toBe('/pilotos/DRV_0089.jpg')
    expect(photoFromAlias.assetId).toBe('DRV_0089')
  })

  it('GOLDEN-02: Jack Doohan (drv_jack_doohan / mbj-012) resolve para DRV_0015 e /pilotos/DRV_0015.jpg', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-012']).toBe('DRV_0015')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_jack_doohan']).toBe('DRV_0015')
    expect(getCanonicalAssetId('mbj-012')).toBe('DRV_0015')
    expect(getCanonicalAssetId('drv_jack_doohan')).toBe('DRV_0015')

    const master = getCanonicalDriverMaster('mbj-012')
    expect(master?.assetId).toBe('DRV_0015')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0015.jpg')

    const photoFromMbj = resolveDriverPhoto({ driverId: 'mbj-012' })
    expect(photoFromMbj.url).toBe('/pilotos/DRV_0015.jpg')
    expect(photoFromMbj.assetId).toBe('DRV_0015')

    const photoFromAlias = resolveDriverPhoto({ driverId: 'drv_jack_doohan' })
    expect(photoFromAlias.url).toBe('/pilotos/DRV_0015.jpg')
    expect(photoFromAlias.assetId).toBe('DRV_0015')
  })

  it('GOLDEN-03: Max Verstappen (drv_max_verstappen / mbj-001) resolve para DRV_0022 e /pilotos/DRV_0022.jpg', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-001']).toBe('DRV_0022')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_max_verstappen']).toBe('DRV_0022')
    expect(getCanonicalAssetId('mbj-001')).toBe('DRV_0022')
    expect(getCanonicalAssetId('drv_max_verstappen')).toBe('DRV_0022')

    const master = getCanonicalDriverMaster('mbj-001')
    expect(master?.assetId).toBe('DRV_0022')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0022.jpg')

    const photoFromMbj = resolveDriverPhoto({ driverId: 'mbj-001' })
    expect(photoFromMbj.url).toBe('/pilotos/DRV_0022.jpg')
    expect(photoFromMbj.assetId).toBe('DRV_0022')

    const photoFromAlias = resolveDriverPhoto({ driverId: 'drv_max_verstappen' })
    expect(photoFromAlias.url).toBe('/pilotos/DRV_0022.jpg')
    expect(photoFromAlias.assetId).toBe('DRV_0022')
  })

  it('GOLDEN-04: Lando Norris (drv_lando_norris / mbj-005) resolve para DRV_0019 e /pilotos/DRV_0019.jpg', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-005']).toBe('DRV_0019')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_lando_norris']).toBe('DRV_0019')
    expect(getCanonicalAssetId('mbj-005')).toBe('DRV_0019')
    expect(getCanonicalAssetId('drv_lando_norris')).toBe('DRV_0019')

    const master = getCanonicalDriverMaster('mbj-005')
    expect(master?.assetId).toBe('DRV_0019')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0019.jpg')

    const photoFromMbj = resolveDriverPhoto({ driverId: 'mbj-005' })
    expect(photoFromMbj.url).toBe('/pilotos/DRV_0019.jpg')
    expect(photoFromMbj.assetId).toBe('DRV_0019')

    const photoFromAlias = resolveDriverPhoto({ driverId: 'drv_lando_norris' })
    expect(photoFromAlias.url).toBe('/pilotos/DRV_0019.jpg')
    expect(photoFromAlias.assetId).toBe('DRV_0019')
  })

  it('GOLDEN-05: Charles Leclerc (drv_charles_leclerc / mbj-004) resolve para DRV_0047 e /pilotos/DRV_0047.jpg', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-004']).toBe('DRV_0047')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_charles_leclerc']).toBe('DRV_0047')
    expect(getCanonicalAssetId('mbj-004')).toBe('DRV_0047')
    expect(getCanonicalAssetId('drv_charles_leclerc')).toBe('DRV_0047')

    const master = getCanonicalDriverMaster('mbj-004')
    expect(master?.assetId).toBe('DRV_0047')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0047.jpg')

    const photoFromMbj = resolveDriverPhoto({ driverId: 'mbj-004' })
    expect(photoFromMbj.url).toBe('/pilotos/DRV_0047.jpg')
    expect(photoFromMbj.assetId).toBe('DRV_0047')

    const photoFromAlias = resolveDriverPhoto({ driverId: 'drv_charles_leclerc' })
    expect(photoFromAlias.url).toBe('/pilotos/DRV_0047.jpg')
    expect(photoFromAlias.assetId).toBe('DRV_0047')
  })

  it('GOLDEN-06: Mick Schumacher (drv_mick_schumacher / mbj-037) resolve para DRV_0105 e /pilotos/DRV_0105.jpg', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-037']).toBe('DRV_0105')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_mick_schumacher']).toBe('DRV_0105')
    expect(getCanonicalAssetId('mbj-037')).toBe('DRV_0105')
    expect(getCanonicalAssetId('drv_mick_schumacher')).toBe('DRV_0105')

    const master = getCanonicalDriverMaster('mbj-037')
    expect(master?.assetId).toBe('DRV_0105')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0105.jpg')

    const photoFromMbj = resolveDriverPhoto({ driverId: 'mbj-037' })
    expect(photoFromMbj.url).toBe('/pilotos/DRV_0105.jpg')
    expect(photoFromMbj.assetId).toBe('DRV_0105')

    const photoFromAlias = resolveDriverPhoto({ driverId: 'drv_mick_schumacher' })
    expect(photoFromAlias.url).toBe('/pilotos/DRV_0105.jpg')
    expect(photoFromAlias.assetId).toBe('DRV_0105')
  })

  it('GOLDEN-07: Gabriel Bortoleto (drv_gabriel_bortoleto / mbj-020) resolve para DRV_0012 e /pilotos/DRV_0012.jpg', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-020']).toBe('DRV_0012')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_gabriel_bortoleto']).toBe('DRV_0012')
    expect(getCanonicalAssetId('mbj-020')).toBe('DRV_0012')
    expect(getCanonicalAssetId('drv_gabriel_bortoleto')).toBe('DRV_0012')

    const master = getCanonicalDriverMaster('mbj-020')
    expect(master?.assetId).toBe('DRV_0012')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0012.jpg')

    const photoFromMbj = resolveDriverPhoto({ driverId: 'mbj-020' })
    expect(photoFromMbj.url).toBe('/pilotos/DRV_0012.jpg')
    expect(photoFromMbj.assetId).toBe('DRV_0012')

    const photoFromAlias = resolveDriverPhoto({ driverId: 'drv_gabriel_bortoleto' })
    expect(photoFromAlias.url).toBe('/pilotos/DRV_0012.jpg')
    expect(photoFromAlias.assetId).toBe('DRV_0012')
  })

  it('GOLDEN-08: Nico Hülkenberg (drv_nico_hulkenberg / mbj-019) resolve para DRV_0068 e /pilotos/DRV_0068.jpg', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-019']).toBe('DRV_0068')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_nico_hulkenberg']).toBe('DRV_0068')
    expect(getCanonicalAssetId('mbj-019')).toBe('DRV_0068')
    expect(getCanonicalAssetId('drv_nico_hulkenberg')).toBe('DRV_0068')

    const master = getCanonicalDriverMaster('mbj-019')
    expect(master?.assetId).toBe('DRV_0068')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0068.jpg')

    const photoFromMbj = resolveDriverPhoto({ driverId: 'mbj-019' })
    expect(photoFromMbj.url).toBe('/pilotos/DRV_0068.jpg')
    expect(photoFromMbj.assetId).toBe('DRV_0068')

    const photoFromAlias = resolveDriverPhoto({ driverId: 'drv_nico_hulkenberg' })
    expect(photoFromAlias.url).toBe('/pilotos/DRV_0068.jpg')
    expect(photoFromAlias.assetId).toBe('DRV_0068')
  })
})
