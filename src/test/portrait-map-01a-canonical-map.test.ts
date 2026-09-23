/**
 * portrait-map-01a-canonical-map.test.ts
 *
 * Suíte de homologação canônica de mapeamento de retratos de pilotos (PM01A-01..10 + Regressões).
 * Garante a integridade estrita entre driverId canônico e assetId (DRV_0001..DRV_0134):
 * - PM01A-01 Bortoleto -> DRV_0012 -> /pilotos/DRV_0012.jpg, sem fallback.
 * - PM01A-02 Hülkenberg -> DRV_0068.
 * - PM01A-03 Piastri mbj-006 -> DRV_0108; aliases 'piastri', 'drv_oscar_piastri', 'oscar_piastri' resolvem ao mesmo driver; NÃO resolve DRV_0006.
 * - PM01A-04 Norris mbj-005 -> DRV_0019, sem colidir com Leclerc mbj-004 -> DRV_0047.
 * - PM01A-05 Sainz mbj-014 -> DRV_0089.
 * - PM01A-06 134 assetIds reais únicos, 0 duplicados.
 * - PM01A-07 canonicalDrivers=135, realPortraitMappings=134, sem asset por design=1 (Tony Kanaan mbj-135, assetId null), não existe DRV_0135.
 * - PM01A-08 zero URL externa (drive.google.com / lh3.googleusercontent.com / thumbnail / uc?id=) nos paths de runtime.
 * - PM01A-09 aliases de Piastri/Norris/Russell/Leclerc/Hamilton sem colisão; Russell -> DRV_0096, não DRV_0007.
 * - PM01A-10 auditCanonicalDriverPortraitMap() retorna: canonicalDrivers=135, realPortraitMappings=134, driversWithoutPortraitByDesign=1, duplicateDriverIds=0, duplicateAssetIds=0, missingAssetIds=0, malformedAssetIds=0, unresolvedRealDrivers=0, externalRuntimeUrls=0.
 * - Regressões extras: Verstappen->DRV_0022, Doohan->DRV_0015, Mick Schumacher->DRV_0105, Hamilton->DRV_0104.
 */

import { describe, it, expect } from 'vitest'
import {
  CANONICAL_DRIVERS_MASTER,
  CANONICAL_DRIVER_ID_TO_ASSET_ID,
  getCanonicalDriverMaster,
  getCanonicalAssetId,
  resolveCanonicalDriverId,
  auditCanonicalDriverPortraitMap,
} from '@/lib/canonical-driver-database'
import { DRIVER_PORTRAIT_ASSET_MAP } from '@/lib/driver-portrait-map'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'

describe('PORTRAIT-MAP-01A: Mapeamento Canônico de Retratos de Pilotos (PM01A-01..10 + Regressões)', () => {
  // PM01A-01: Bortoleto -> DRV_0012 -> /pilotos/DRV_0012.jpg, sem fallback
  it('PM01A-01: Gabriel Bortoleto mbj-020 resolve para DRV_0012 e caminho local /pilotos/DRV_0012.jpg sem fallback', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-020']).toBe('DRV_0012')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_gabriel_bortoleto']).toBe('DRV_0012')
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_gabriel_bortoleto']).toBe('DRV_0012')

    const master = getCanonicalDriverMaster('mbj-020')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Gabriel Bortoleto')
    expect(master?.assetId).toBe('DRV_0012')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0012.jpg')

    const photo = resolveDriverPhoto({ driverId: 'mbj-020', name: 'Gabriel Bortoleto' })
    expect(photo.url).toBe('/pilotos/DRV_0012.jpg')
    expect(photo.sourceType).toBe('canonical_real')
    expect(photo.assetId).toBe('DRV_0012')
    expect(photo.candidateUrls).toContain('/pilotos/DRV_0012.jpg')
  })

  // PM01A-02: Hülkenberg -> DRV_0068
  it('PM01A-02: Nico Hülkenberg mbj-019 resolve para DRV_0068 e /pilotos/DRV_0068.jpg', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-019']).toBe('DRV_0068')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_nico_hulkenberg']).toBe('DRV_0068')
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_nico_hulkenberg']).toBe('DRV_0068')

    const master = getCanonicalDriverMaster('mbj-019')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Nico Hülkenberg')
    expect(master?.assetId).toBe('DRV_0068')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0068.jpg')

    const photo = resolveDriverPhoto({ driverId: 'mbj-019', name: 'Nico Hülkenberg' })
    expect(photo.url).toBe('/pilotos/DRV_0068.jpg')
    expect(photo.sourceType).toBe('canonical_real')
    expect(photo.assetId).toBe('DRV_0068')
  })

  // PM01A-03: Piastri mbj-006 -> DRV_0108; aliases resolvem ao mesmo driver; NÃO resolve DRV_0006
  it('PM01A-03: Oscar Piastri mbj-006 resolve para DRV_0108 e NÃO para DRV_0006; aliases resolvem ao mesmo piloto', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-006']).toBe('DRV_0108')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-006']).not.toBe('DRV_0006')
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_oscar_piastri']).toBe('DRV_0108')

    const master = getCanonicalDriverMaster('mbj-006')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Oscar Piastri')
    expect(master?.assetId).toBe('DRV_0108')
    expect(master?.assetId).not.toBe('DRV_0006')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0108.jpg')

    // DRV_0006 no mapa de retratos é Chase Elliott
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_chase_elliott']).toBe('DRV_0006')

    // Resolução de grid com aliases
    const dummyGrid = [
      { driverId: 'mbj-006', driverName: 'Oscar Piastri', position: 2 },
      { driverId: 'mbj-005', driverName: 'Lando Norris', position: 1 },
    ]

    const fromPiastri = resolveCanonicalDriverId('piastri', dummyGrid)
    const fromDrvPiastri = resolveCanonicalDriverId('drv_oscar_piastri', dummyGrid)
    const fromOscarPiastri = resolveCanonicalDriverId('oscar_piastri', dummyGrid)
    const fromDriverOscarPiastri = resolveCanonicalDriverId('driver_oscar_piastri', dummyGrid)

    expect(fromPiastri?.driverId).toBe('mbj-006')
    expect(fromDrvPiastri?.driverId).toBe('mbj-006')
    expect(fromOscarPiastri?.driverId).toBe('mbj-006')
    expect(fromDriverOscarPiastri?.driverId).toBe('mbj-006')
  })

  // PM01A-04: Norris mbj-005 -> DRV_0019, sem colidir com Leclerc mbj-004 -> DRV_0047
  it('PM01A-04: Norris mbj-005 resolve para DRV_0019 sem colidir com Leclerc mbj-004 -> DRV_0047', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-005']).toBe('DRV_0019')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_lando_norris']).toBe('DRV_0019')
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_lando_norris']).toBe('DRV_0019')

    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-004']).toBe('DRV_0047')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_charles_leclerc']).toBe('DRV_0047')
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_charles_leclerc']).toBe('DRV_0047')

    expect(getCanonicalAssetId('mbj-005')).not.toBe(getCanonicalAssetId('mbj-004'))

    const masterNorris = getCanonicalDriverMaster('mbj-005')
    const masterLeclerc = getCanonicalDriverMaster('mbj-004')
    expect(masterNorris?.assetId).toBe('DRV_0019')
    expect(masterLeclerc?.assetId).toBe('DRV_0047')
    expect(masterNorris?.resolvedPhotoPath).toBe('/pilotos/DRV_0019.jpg')
    expect(masterLeclerc?.resolvedPhotoPath).toBe('/pilotos/DRV_0047.jpg')
  })

  // PM01A-05: Sainz mbj-014 -> DRV_0089
  it('PM01A-05: Carlos Sainz mbj-014 resolve para DRV_0089 e /pilotos/DRV_0089.jpg', () => {
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-014']).toBe('DRV_0089')
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_carlos_sainz']).toBe('DRV_0089')
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_carlos_sainz']).toBe('DRV_0089')

    const master = getCanonicalDriverMaster('mbj-014')
    expect(master).not.toBeNull()
    expect(master?.fullName).toBe('Carlos Sainz Jr')
    expect(master?.assetId).toBe('DRV_0089')
    expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0089.jpg')

    const photo = resolveDriverPhoto({ driverId: 'mbj-014' })
    expect(photo.url).toBe('/pilotos/DRV_0089.jpg')
    expect(photo.sourceType).toBe('canonical_real')
    expect(photo.assetId).toBe('DRV_0089')
  })

  // PM01A-06: 134 assetIds reais únicos, 0 duplicados
  it('PM01A-06: exatamente 134 assetIds reais únicos no catálogo mestre sem duplicatas', () => {
    const assetMapValues: string[] = Object.values(DRIVER_PORTRAIT_ASSET_MAP)
    expect(assetMapValues).toHaveLength(134)
    const uniqueMapAssets = new Set<string>(assetMapValues)
    expect(uniqueMapAssets.size).toBe(134)

    // E no banco mestre canônico CANONICAL_DRIVERS_MASTER:
    const masterAssets = CANONICAL_DRIVERS_MASTER.map((d) => d.assetId).filter(
      (a): a is string => a !== null,
    )
    expect(masterAssets).toHaveLength(134)
    const uniqueMasterAssets = new Set<string>(masterAssets)
    expect(uniqueMasterAssets.size).toBe(134)

    // Todos na faixa DRV_0001 até DRV_0134
    for (let i = 1; i <= 134; i++) {
      const pad = String(i).padStart(4, '0')
      const expectedAsset = `DRV_${pad}`
      expect(uniqueMasterAssets.has(expectedAsset)).toBe(true)
      expect(uniqueMapAssets.has(expectedAsset)).toBe(true)
    }
  })

  // PM01A-07: canonicalDrivers=135, realPortraitMappings=134, sem asset por design=1 (Tony Kanaan mbj-135, assetId null), não existe DRV_0135
  it('PM01A-07: canonicalDrivers=135, realPortraitMappings=134, Tony Kanaan mbj-135 assetId null por design, DRV_0135 inexistente', () => {
    expect(CANONICAL_DRIVERS_MASTER).toHaveLength(135)
    expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-135']).toBeNull()

    const kanaan = getCanonicalDriverMaster('mbj-135')
    expect(kanaan).not.toBeNull()
    expect(kanaan?.fullName).toBe('Tony Kanaan')
    expect(kanaan?.assetId).toBeNull()
    expect(kanaan?.resolvedPhotoPath).toBeNull()

    // Resolução de foto de Kanaan cai para fallback gracioso de iniciais
    const photoKanaan = resolveDriverPhoto({ driverId: 'mbj-135', name: 'Tony Kanaan' })
    expect(photoKanaan.url).toBeNull()
    expect(photoKanaan.sourceType).toBe('fallback_initials')
    expect(photoKanaan.fallbackInitials).toBe('TK')

    // Não existe DRV_0135 em nenhum catálogo
    const allValues = Object.values(CANONICAL_DRIVER_ID_TO_ASSET_ID)
    expect(allValues).not.toContain('DRV_0135')
    expect(Object.values(DRIVER_PORTRAIT_ASSET_MAP)).not.toContain('DRV_0135')
  })

  // PM01A-08: zero URL externa (drive.google.com / lh3.googleusercontent.com / thumbnail / uc?id=) nos paths de runtime
  it('PM01A-08: zero URL externa nos caminhos de foto resolvidos em tempo de execução', () => {
    const forbiddenPatterns = [
      'drive.google.com',
      'lh3.googleusercontent.com',
      'thumbnail',
      'uc?id=',
      'http://',
      'https://',
    ]

    for (const driver of CANONICAL_DRIVERS_MASTER) {
      if (driver.resolvedPhotoPath) {
        expect(driver.resolvedPhotoPath.startsWith('/pilotos/DRV_')).toBe(true)
        for (const pattern of forbiddenPatterns) {
          expect(driver.resolvedPhotoPath.toLowerCase()).not.toContain(pattern)
        }
      }

      // Testar via resolvedor central
      const resolved = resolveDriverPhoto({ driverId: driver.driverId, name: driver.fullName })
      if (resolved.url) {
        expect(resolved.url.startsWith('/pilotos/DRV_')).toBe(true)
        for (const pattern of forbiddenPatterns) {
          expect(resolved.url.toLowerCase()).not.toContain(pattern)
        }
      }
      for (const candidate of resolved.candidateUrls) {
        for (const pattern of forbiddenPatterns) {
          expect(candidate.toLowerCase()).not.toContain(pattern)
        }
      }
    }
  })

  // PM01A-09: aliases de Piastri/Norris/Russell/Leclerc/Hamilton sem colisão; Russell -> DRV_0096, não DRV_0007
  it('PM01A-09: aliases de Piastri, Norris, Russell, Leclerc e Hamilton sem colisão cruzada; Russell aponta para DRV_0096 e não DRV_0007', () => {
    // Russell mapeado para DRV_0096 (DRV_0007 pertence a Christian Lundgaard)
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_george_russell']).toBe('DRV_0096')
    expect(DRIVER_PORTRAIT_ASSET_MAP['drv_christian_lundgaard']).toBe('DRV_0007')

    const grid = [
      { driverId: 'mbj-003', driverName: 'Lewis Hamilton', position: 1 },
      { driverId: 'mbj-004', driverName: 'Charles Leclerc', position: 2 },
      { driverId: 'mbj-005', driverName: 'Lando Norris', position: 3 },
      { driverId: 'mbj-006', driverName: 'Oscar Piastri', position: 4 },
      { driverId: 'mbj-007', driverName: 'George Russell', position: 5 },
    ]

    const resHamilton = resolveCanonicalDriverId('hamilton', grid)
    const resLeclerc = resolveCanonicalDriverId('leclerc', grid)
    const resNorris = resolveCanonicalDriverId('norris', grid)
    const resPiastri = resolveCanonicalDriverId('piastri', grid)
    const resRussell = resolveCanonicalDriverId('russell', grid)

    expect(resHamilton?.driverId).toBe('mbj-003')
    expect(resLeclerc?.driverId).toBe('mbj-004')
    expect(resNorris?.driverId).toBe('mbj-005')
    expect(resPiastri?.driverId).toBe('mbj-006')
    expect(resRussell?.driverId).toBe('mbj-007')

    // Confirma que nenhum alias de Russell resolve para DRV_0007
    const russellMaster = getCanonicalDriverMaster('mbj-007')
    expect(russellMaster?.fullName).toBe('George Russell')
  })

  // PM01A-10: auditCanonicalDriverPortraitMap() retorna todos os campos esperados
  it('PM01A-10: auditCanonicalDriverPortraitMap() retorna estado canônico 100% íntegro', () => {
    const report = auditCanonicalDriverPortraitMap()

    expect(report.canonicalDrivers).toBe(135)
    expect(report.realPortraitMappings).toBe(134)
    expect(report.driversWithoutPortraitByDesign).toBe(1)
    expect(report.duplicateDriverIds).toBe(0)
    expect(report.duplicateAssetIds).toBe(0)
    expect(report.missingAssetIds).toBe(0)
    expect(report.malformedAssetIds).toBe(0)
    expect(report.unresolvedRealDrivers).toBe(0)
    expect(report.externalRuntimeUrls).toBe(0)
    expect(report.driversWithoutPortrait).toEqual(['mbj-135'])
  })

  // Regressões extras: Verstappen->DRV_0022, Doohan->DRV_0015, Mick Schumacher->DRV_0105, Hamilton->DRV_0104
  describe('Regressões extras canônicas (Verstappen, Doohan, Mick Schumacher, Hamilton)', () => {
    it('Verstappen (mbj-001) resolve para DRV_0022 e /pilotos/DRV_0022.jpg', () => {
      expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-001']).toBe('DRV_0022')
      expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_max_verstappen']).toBe('DRV_0022')
      expect(DRIVER_PORTRAIT_ASSET_MAP['drv_max_verstappen']).toBe('DRV_0022')

      const master = getCanonicalDriverMaster('mbj-001')
      expect(master?.assetId).toBe('DRV_0022')
      expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0022.jpg')

      const photo = resolveDriverPhoto({ driverId: 'mbj-001' })
      expect(photo.url).toBe('/pilotos/DRV_0022.jpg')
      expect(photo.sourceType).toBe('canonical_real')
    })

    it('Doohan (mbj-012) resolve para DRV_0015 e /pilotos/DRV_0015.jpg', () => {
      expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-012']).toBe('DRV_0015')
      expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_jack_doohan']).toBe('DRV_0015')
      expect(DRIVER_PORTRAIT_ASSET_MAP['drv_jack_doohan']).toBe('DRV_0015')

      const master = getCanonicalDriverMaster('mbj-012')
      expect(master?.assetId).toBe('DRV_0015')
      expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0015.jpg')

      const photo = resolveDriverPhoto({ driverId: 'mbj-012' })
      expect(photo.url).toBe('/pilotos/DRV_0015.jpg')
      expect(photo.sourceType).toBe('canonical_real')
    })

    it('Mick Schumacher (mbj-037) resolve para DRV_0105 e /pilotos/DRV_0105.jpg', () => {
      expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['mbj-037']).toBe('DRV_0105')
      expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_mick_schumacher']).toBe('DRV_0105')
      expect(DRIVER_PORTRAIT_ASSET_MAP['drv_mick_schumacher']).toBe('DRV_0105')

      const master = getCanonicalDriverMaster('mbj-037')
      expect(master?.assetId).toBe('DRV_0105')
      expect(master?.resolvedPhotoPath).toBe('/pilotos/DRV_0105.jpg')

      const photo = resolveDriverPhoto({ driverId: 'mbj-037' })
      expect(photo.url).toBe('/pilotos/DRV_0105.jpg')
      expect(photo.sourceType).toBe('canonical_real')
    })

    it('Hamilton (mbj-003) resolve para DRV_0104 no mapa canônico e /pilotos/DRV_0104.jpg', () => {
      expect(DRIVER_PORTRAIT_ASSET_MAP['drv_lewis_hamilton']).toBe('DRV_0104')
      expect(CANONICAL_DRIVER_ID_TO_ASSET_ID['drv_lewis_hamilton']).toBe('DRV_0104')

      const photoByAlias = resolveDriverPhoto({ driverId: 'drv_lewis_hamilton' })
      expect(photoByAlias.url).toBe('/pilotos/DRV_0104.jpg')
      expect(photoByAlias.sourceType).toBe('canonical_real')
    })
  })
})
