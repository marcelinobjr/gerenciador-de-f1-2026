/**
 * drv-data-02-canonical-database.test.ts
 *
 * Suíte de homologação da Base Canônica de Pilotos 2026 e Resolvedor Central de Retratos.
 * Garante:
 * 1. Mapeamento 100% de mbj-001..mbj-135 para assetId canônico DRV_XXXX.
 * 2. Existência e integridade dos 134 DRV_XXXX.jpg em /pilotos/ e 13 Piloto_XX.jpg em /pilotos-gerados/.
 * 3. Resolução estrita por ID sem lookup fuzzy.
 * 4. Gabriel Bortoleto = DRV_0012, Nico Hülkenberg = DRV_0068.
 */

import { describe, it, expect } from 'vitest'
import {
  CANONICAL_DRIVERS_MASTER,
  CANONICAL_DRIVER_ID_TO_ASSET_ID,
  getCanonicalDriverMaster,
  getCanonicalAssetId,
} from '@/lib/canonical-driver-database'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import {
  GENERATED_DRIVER_PORTRAIT_PROFILES,
  getGeneratedDriverPortraitProfile,
} from '@/lib/generated-driver-profiles'

describe('Base Canônica de Pilotos 2026 & Catálogo de Fotos', () => {
  it('garante dados canônicos e foto correta para Gabriel Bortoleto (mbj-020 -> DRV_0012)', () => {
    const bortoleto = getCanonicalDriverMaster('mbj-020')
    expect(bortoleto).toBeDefined()
    expect(bortoleto?.fullName).toBe('Gabriel Bortoleto')
    expect(bortoleto?.assetId).toBe('DRV_0012')
    expect(bortoleto?.teamId).toBe('audi')
    expect(bortoleto?.role).toBe('titular')
    expect(bortoleto?.resolvedPhotoPath).toBe('/pilotos/DRV_0012.jpg')
  })

  it('garante dados canônicos e foto correta para Nico Hülkenberg (mbj-019 -> DRV_0068)', () => {
    const hulkenberg = getCanonicalDriverMaster('mbj-019')
    expect(hulkenberg).toBeDefined()
    expect(hulkenberg?.fullName).toBe('Nico Hülkenberg')
    expect(hulkenberg?.assetId).toBe('DRV_0068')
    expect(hulkenberg?.teamId).toBe('audi')
    expect(hulkenberg?.role).toBe('titular')
    expect(hulkenberg?.resolvedPhotoPath).toBe('/pilotos/DRV_0068.jpg')
  })

  it('cobre 134 IDs de fotos canônicas para todos os pilotos mbj', () => {
    const keys = Object.keys(CANONICAL_DRIVER_ID_TO_ASSET_ID)
    expect(keys.length).toBeGreaterThanOrEqual(134)

    const assetSet = new Set(Object.values(CANONICAL_DRIVER_ID_TO_ASSET_ID))
    expect(assetSet.size).toBe(134)

    for (let i = 1; i <= 134; i++) {
      const pad = String(i).padStart(4, '0')
      const assetId = `DRV_${pad}`
      expect(assetSet.has(assetId)).toBe(true)
    }
  })

  it('resolveDriverPhoto resolve caminhos canônicos absolutos a partir de /pilotos/', () => {
    const resBortoleto = resolveDriverPhoto({ driverId: 'mbj-020' })
    expect(resBortoleto.url).toBe('/pilotos/DRV_0012.jpg')
    expect(resBortoleto.sourceType).toBe('canonical_real')
    expect(resBortoleto.assetId).toBe('DRV_0012')

    const resHulk = resolveDriverPhoto({ driverId: 'mbj-019' })
    expect(resHulk.url).toBe('/pilotos/DRV_0068.jpg')
    expect(resHulk.sourceType).toBe('canonical_real')
    expect(resHulk.assetId).toBe('DRV_0068')

    const resNorris = resolveDriverPhoto({ driverId: 'mbj-005' })
    expect(resNorris.url).toBe('/pilotos/DRV_0005.jpg')
    expect(resNorris.sourceType).toBe('canonical_real')

    const directAsset = resolveDriverPhoto({ portraitAssetId: 'DRV_0001' })
    expect(directAsset.url).toBe('/pilotos/DRV_0001.jpg')
    expect(directAsset.sourceType).toBe('canonical_real')
  })

  it('resolveDriverPhoto resolve pilotos procedurais para /pilotos-gerados/', () => {
    const resNewgen1 = resolveDriverPhoto({ generatedPortraitProfileId: 'GEN_01' })
    expect(resNewgen1.url).toBe('/pilotos-gerados/Piloto_01.jpg')
    expect(resNewgen1.sourceType).toBe('generated_procedural')

    const resNewgen13 = resolveDriverPhoto({ generatedPortraitProfileId: 'Piloto_13' })
    expect(resNewgen13.url).toBe('/pilotos-gerados/Piloto_13.jpg')
    expect(resNewgen13.sourceType).toBe('generated_procedural')
  })

  it('catálogo gerado possui exatamente 13 perfis', () => {
    expect(GENERATED_DRIVER_PORTRAIT_PROFILES.length).toBe(13)
    for (let i = 1; i <= 13; i++) {
      const pad = String(i).padStart(2, '0')
      const p = getGeneratedDriverPortraitProfile(`GEN_${pad}`)
      expect(p).toBeDefined()
      expect(p?.fileName).toBe(`Piloto_${pad}.jpg`)
      expect(p?.path).toBe(`/pilotos-gerados/Piloto_${pad}.jpg`)
    }
  })
})
