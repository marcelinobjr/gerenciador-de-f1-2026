import { describe, it, expect } from 'vitest'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import {
  resolveCanonicalDriverImagePath,
  getCanonicalDisplayName,
  getDriverCanonicalKey,
} from '@/lib/driver-canonical-service'
import { getCanonicalAssetId, findCanonicalDriverMaster } from '@/lib/canonical-driver-database'

describe('BUG-PILOTOS-01B1A: Micro-Patch 16 Pilotos (PB/MBJ ID -> Foto Canônica)', () => {
  // Lista dos 16 pilotos com id real, nome canônico e asset esperado
  const BATCH_16_DRIVERS = [
    {
      id: '9v5e8eui71eusma',
      name: 'Alba Hurup Larsen',
      expectedAssetId: 'DRV_0001',
      expectedPath: '/pilotos/DRV_0001.jpg',
    },
    {
      id: '96j5j7yw9rzrniw',
      name: 'Alessandro Pier Guidi',
      expectedAssetId: 'DRV_0081',
      expectedPath: '/pilotos/DRV_0081.jpg',
    },
    {
      id: 'hl14dawcbv4jv79',
      name: 'Alex Dunne',
      expectedAssetId: 'DRV_0042',
      expectedPath: '/pilotos/DRV_0042.jpg',
    },
    {
      id: 'mbj-103',
      name: 'Alex Lynn',
      expectedAssetId: 'DRV_0138',
      expectedPath: '/pilotos/DRV_0138.jpg',
    },
    {
      id: 'y6yxh8xqcjon2un',
      name: 'Alisha Palmowski',
      expectedAssetId: 'DRV_0082',
      expectedPath: '/pilotos/DRV_0082.jpg',
    },
    {
      id: '1jtl9kaxbv1ptps',
      name: 'Amauri Cordell',
      expectedAssetId: 'DRV_0083',
      expectedPath: '/pilotos/DRV_0083.jpg',
    },
    {
      id: 'v29qlvsii7r9us0',
      name: 'Antonio Fuoco',
      expectedAssetId: 'DRV_0084',
      expectedPath: '/pilotos/DRV_0084.jpg',
    },
    {
      id: 'kw21vwkrfiludy2',
      name: 'Ava Dobson',
      expectedAssetId: 'DRV_0086',
      expectedPath: '/pilotos/DRV_0086.jpg',
    },
    {
      id: 'zdxbpd8b2jrtq1y',
      name: 'Brad Keselowski',
      expectedAssetId: 'DRV_0004',
      expectedPath: '/pilotos/DRV_0004.jpg',
    },
    {
      id: 'h3llycw9bdhwrac',
      name: 'Callum Hedge',
      expectedAssetId: 'DRV_0088',
      expectedPath: '/pilotos/DRV_0088.jpg',
    },
    {
      id: 'mbj-100',
      name: 'Callum Ilott',
      expectedAssetId: 'DRV_0139',
      expectedPath: '/pilotos/DRV_0139.jpg',
    },
    {
      id: 'mbj-076',
      name: 'Callum Voisin',
      expectedAssetId: 'DRV_0140',
      expectedPath: '/pilotos/DRV_0140.jpg',
    },
    {
      id: 'm2tpbn2r0mak1ut',
      name: 'Chase Elliott',
      expectedAssetId: 'DRV_0006',
      expectedPath: '/pilotos/DRV_0006.jpg',
    },
    {
      id: 'mbj-077',
      name: 'Christian Mansell',
      expectedAssetId: 'DRV_0141',
      expectedPath: '/pilotos/DRV_0141.jpg',
    },
    {
      id: 'ap51biwjhwsh2pf',
      name: 'Christopher Bell',
      expectedAssetId: 'DRV_0048',
      expectedPath: '/pilotos/DRV_0048.jpg',
    },
    {
      id: 'mbj-115',
      name: 'Connor de Phillippi',
      expectedAssetId: 'DRV_0142',
      expectedPath: '/pilotos/DRV_0142.jpg',
    },
  ]

  // B1A-01 a B1A-16: Testes individuais na ordem estrita
  BATCH_16_DRIVERS.forEach((driver, idx) => {
    const numStr = String(idx + 1).padStart(2, '0')
    it(`B1A-${numStr}: ${driver.name} (ID ${driver.id}) resolve para ${driver.expectedPath}`, () => {
      // 1. getCanonicalAssetId direto pelo ID
      expect(getCanonicalAssetId(driver.id)).toBe(driver.expectedAssetId)

      // 2. resolveCanonicalDriverImagePath direto pelo ID
      expect(resolveCanonicalDriverImagePath(driver.id)).toBe(driver.expectedPath)

      // 3. resolveCanonicalDriverImagePath com nome
      expect(resolveCanonicalDriverImagePath(driver.id, driver.name)).toBe(driver.expectedPath)

      // 4. resolveDriverPhoto completo consumido pela UI (DriverPoster / DriverPhotoAvatar)
      const photoRes = resolveDriverPhoto({ driverId: driver.id, name: driver.name })
      expect(photoRes.url).toBe(driver.expectedPath)
      expect(photoRes.candidateUrls).toContain(driver.expectedPath)
      expect(photoRes.sourceType).toBe('canonical_real')
    })
  })

  // Regressão dos Aliases da 01A
  describe('Regressão de Aliases 01A e deduplicação', () => {
    it('Alex Dunne e Alexander Dunne resolvem para a mesma imagem e ID canônico', () => {
      const pathDunne1 = resolveCanonicalDriverImagePath('hl14dawcbv4jv79', 'Alex Dunne')
      const pathDunne2 = resolveCanonicalDriverImagePath('mbj-071', 'Alexander Dunne')
      expect(pathDunne1).toBe('/pilotos/DRV_0042.jpg')
      expect(pathDunne2).toBe('/pilotos/DRV_0042.jpg')
      expect(pathDunne1).toBe(pathDunne2)

      expect(getCanonicalDisplayName('Alex Dunne')).toBe('Alexander Dunne')
      expect(getDriverCanonicalKey('Alex Dunne')).toBe(getDriverCanonicalKey('Alexander Dunne'))
    })

    it('Callum Llott (typo) e Callum Ilott resolvem para a mesma imagem', () => {
      const pathIlott1 = resolveCanonicalDriverImagePath('mbj-100', 'Callum Ilott')
      const pathIlott2 = resolveCanonicalDriverImagePath('mbj-100', 'Callum Llott')
      expect(pathIlott1).toBe('/pilotos/DRV_0139.jpg')
      expect(pathIlott2).toBe('/pilotos/DRV_0139.jpg')
      expect(pathIlott1).toBe(pathIlott2)

      expect(getCanonicalDisplayName('Callum Llott')).toBe('Callum Ilott')
      expect(getDriverCanonicalKey('Callum Llott')).toBe(getDriverCanonicalKey('Callum Ilott'))
    })

    it('Brad Keselowiski (typo) e Brad Keselowski resolvem para a mesma imagem', () => {
      const pathBrad1 = resolveCanonicalDriverImagePath('zdxbpd8b2jrtq1y', 'Brad Keselowski')
      const pathBrad2 = resolveCanonicalDriverImagePath('zdxbpd8b2jrtq1y', 'Brad Keselowiski')
      expect(pathBrad1).toBe('/pilotos/DRV_0004.jpg')
      expect(pathBrad2).toBe('/pilotos/DRV_0004.jpg')
      expect(pathBrad1).toBe(pathBrad2)
    })

    it('Amauri Cordell e Amaury Cordeel resolvem para a mesma imagem', () => {
      const pathAmauri1 = resolveCanonicalDriverImagePath('1jtl9kaxbv1ptps', 'Amauri Cordell')
      const pathAmauri2 = resolveCanonicalDriverImagePath('1jtl9kaxbv1ptps', 'Amaury Cordeel')
      expect(pathAmauri1).toBe('/pilotos/DRV_0083.jpg')
      expect(pathAmauri2).toBe('/pilotos/DRV_0083.jpg')
      expect(pathAmauri1).toBe(pathAmauri2)
    })
  })
})
