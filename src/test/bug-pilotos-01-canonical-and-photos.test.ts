import { describe, it, expect } from 'vitest'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import {
  getCanonicalDisplayName,
  getDriverCanonicalKey,
  resolveCanonicalDriverImagePath,
} from '@/lib/driver-canonical-service'

describe('BUG-PILOTOS-01: Canonical Deduplication & Photo Resolver Integration', () => {
  describe('Canonical Deduplication & Name Normalization', () => {
    it('unifica Alex Palou e Álex Palou para mesma chave canônica e nome único', () => {
      const name1 = 'Alex Palou'
      const name2 = 'Álex Palou'
      expect(getCanonicalDisplayName(name1)).toBe('Alex Palou')
      expect(getCanonicalDisplayName(name2)).toBe('Alex Palou')
      expect(getDriverCanonicalKey(name1)).toBe(getDriverCanonicalKey(name2))
    })

    it('unifica Alex Albon e Alexander Albon para mesma chave e nome canônico', () => {
      expect(getCanonicalDisplayName('Alex Albon')).toBe('Alexander Albon')
      expect(getCanonicalDisplayName('Alexander Albon')).toBe('Alexander Albon')
      expect(getDriverCanonicalKey('Alex Albon')).toBe(getDriverCanonicalKey('Alexander Albon'))
    })

    it('unifica Alex Dunne e Alexander Dunne para Alexander Dunne', () => {
      expect(getCanonicalDisplayName('Alex Dunne')).toBe('Alexander Dunne')
      expect(getCanonicalDisplayName('Alexander Dunne')).toBe('Alexander Dunne')
      expect(getDriverCanonicalKey('Alex Dunne')).toBe(getDriverCanonicalKey('Alexander Dunne'))
    })

    it('unifica Andre Lotterer e André Lotterer para André Lotterer', () => {
      expect(getCanonicalDisplayName('Andre Lotterer')).toBe('André Lotterer')
      expect(getCanonicalDisplayName('André Lotterer')).toBe('André Lotterer')
      expect(getDriverCanonicalKey('Andre Lotterer')).toBe(getDriverCanonicalKey('André Lotterer'))
    })

    it('unifica António Félix da Costa e Antonio Felix da Costa para António Félix da Costa', () => {
      expect(getCanonicalDisplayName('Antonio Felix da Costa')).toBe('António Félix da Costa')
      expect(getCanonicalDisplayName('António Félix da Costa')).toBe('António Félix da Costa')
      expect(getDriverCanonicalKey('Antonio Felix da Costa')).toBe(
        getDriverCanonicalKey('António Félix da Costa'),
      )
    })

    it('unifica Gabriele Mini e Gabriele Minì para Gabriele Mini (um só)', () => {
      expect(getCanonicalDisplayName('Gabriele Mini')).toBe('Gabriele Mini')
      expect(getCanonicalDisplayName('Gabriele Minì')).toBe('Gabriele Mini')
      expect(getDriverCanonicalKey('Gabriele Mini')).toBe(getDriverCanonicalKey('Gabriele Minì'))
    })
  })

  describe('Photo Resolver mapping against public/pilotos assets', () => {
    const testCases: Array<{ name: string; expectedAsset: string }> = [
      { name: 'Alba Hurup Larsen', expectedAsset: '/pilotos/DRV_0001.jpg' },
      { name: 'Alessandro Pier Guidi', expectedAsset: '/pilotos/DRV_0081.jpg' },
      { name: 'Alex Dunne', expectedAsset: '/pilotos/DRV_0042.jpg' },
      { name: 'Alexander Dunne', expectedAsset: '/pilotos/DRV_0042.jpg' },
      { name: 'Alex Lynn', expectedAsset: '/pilotos/DRV_0138.jpg' },
      { name: 'Alisha Palmowski', expectedAsset: '/pilotos/DRV_0082.jpg' },
      { name: 'Amauri Cordell', expectedAsset: '/pilotos/DRV_0083.jpg' },
      { name: 'Amaury Cordeel', expectedAsset: '/pilotos/DRV_0083.jpg' },
      { name: 'Antonio Fuoco', expectedAsset: '/pilotos/DRV_0084.jpg' },
      { name: 'Ava Dobson', expectedAsset: '/pilotos/DRV_0086.jpg' },
      { name: 'Brad Keselowiski', expectedAsset: '/pilotos/DRV_0004.jpg' },
      { name: 'Brad Keselowski', expectedAsset: '/pilotos/DRV_0004.jpg' },
      { name: 'Callum Hedge', expectedAsset: '/pilotos/DRV_0088.jpg' },
      { name: 'Callum Ilott', expectedAsset: '/pilotos/DRV_0139.jpg' },
      { name: 'Callum Llott', expectedAsset: '/pilotos/DRV_0139.jpg' },
      { name: 'Callum Voisin', expectedAsset: '/pilotos/DRV_0140.jpg' },
      { name: 'Chase Elliott', expectedAsset: '/pilotos/DRV_0006.jpg' },
      { name: 'Christian Mansell', expectedAsset: '/pilotos/DRV_0141.jpg' },
      { name: 'Christopher Bell', expectedAsset: '/pilotos/DRV_0048.jpg' },
      { name: 'Connor de Phillippi', expectedAsset: '/pilotos/DRV_0142.jpg' },
      { name: 'Dane Cameron', expectedAsset: '/pilotos/DRV_0143.jpg' },
      { name: 'Daniil Kvyat', expectedAsset: '/pilotos/DRV_0136.jpg' },
      { name: 'Dennis Hauger', expectedAsset: '/pilotos/DRV_0144.jpg' },
      { name: 'Denny Hamlin', expectedAsset: '/pilotos/DRV_0051.jpg' },
      { name: 'Dries Vanthoor', expectedAsset: '/pilotos/DRV_0145.jpg' },
      { name: 'Earl Bamber', expectedAsset: '/pilotos/DRV_0146.jpg' },
      { name: 'Edoardo Mortara', expectedAsset: '/pilotos/DRV_0090.jpg' },
      { name: 'Ella Lloyd', expectedAsset: '/pilotos/DRV_0091.jpg' },
      { name: 'Ella Stevens', expectedAsset: '/pilotos/DRV_0147.jpg' },
      { name: 'Emerson Fittipaldi Jr.', expectedAsset: '/pilotos/DRV_0148.jpg' },
      { name: 'Emma Felbermayr', expectedAsset: '/pilotos/DRV_0010.jpg' },
      { name: 'Enzo Fittipaldi', expectedAsset: '/pilotos/DRV_0149.jpg' },
      { name: 'Esmee Kosterman', expectedAsset: '/pilotos/DRV_0092.jpg' },
      { name: 'Freddie Slater', expectedAsset: '/pilotos/DRV_0150.jpg' },
      { name: 'Gabriele Mini', expectedAsset: '/pilotos/DRV_0013.jpg' },
      { name: 'Helio Castroneves', expectedAsset: '/pilotos/DRV_0151.jpg' },
      { name: 'Hélio Castroneves', expectedAsset: '/pilotos/DRV_0151.jpg' },
    ]

    for (const tc of testCases) {
      it(`resolveDriverPhoto resolve ${tc.name} para ${tc.expectedAsset}`, () => {
        const result = resolveDriverPhoto({ name: tc.name })
        expect(result.url).toBe(tc.expectedAsset)
        expect(result.candidateUrls).toContain(tc.expectedAsset)
        expect(result.sourceType).toBe('canonical_real')
      })
    }

    it('resolve Felipe Albuquerque para foto em public/pilotos-gerados', () => {
      const result = resolveDriverPhoto({ name: 'Felipe Albuquerque' })
      expect(result.url).toBe('/pilotos-gerados/Piloto_14.jpg')
      expect(result.candidateUrls).toContain('/pilotos-gerados/Piloto_14.jpg')
    })
  })
})
