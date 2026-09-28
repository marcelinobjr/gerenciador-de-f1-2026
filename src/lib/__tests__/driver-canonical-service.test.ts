import { describe, it, expect } from 'vitest'
import {
  getCanonicalDisplayName,
  getDriverCanonicalKey,
  resolveCanonicalDriverImagePath,
  CANONICAL_NAME_MAP,
} from '@/lib/driver-canonical-service'

describe('BUG-PILOTOS-01: Canonical Driver Service & Photo Mapping', () => {
  it('deduplica e unifica variantes de nomes para o canônico', () => {
    // Alex Albon vs Alexander Albon
    expect(getCanonicalDisplayName('Alex Albon')).toBe('Alexander Albon')
    expect(getCanonicalDisplayName('Alexander Albon')).toBe('Alexander Albon')
    expect(getDriverCanonicalKey('Alex Albon')).toBe(getDriverCanonicalKey('Alexander Albon'))

    // Alex Dunne vs Alexander Dunne
    expect(getCanonicalDisplayName('Alex Dunne')).toBe('Alexander Dunne')
    expect(getCanonicalDisplayName('Alexander Dunne')).toBe('Alexander Dunne')
    expect(getDriverCanonicalKey('Alex Dunne')).toBe(getDriverCanonicalKey('Alexander Dunne'))

    // Álex Palou vs Alex Palou
    expect(getCanonicalDisplayName('Alex Palou')).toBe('Álex Palou')
    expect(getCanonicalDisplayName('Álex Palou')).toBe('Álex Palou')
    expect(getDriverCanonicalKey('Alex Palou')).toBe(getDriverCanonicalKey('Álex Palou'))

    // André Lotterer vs Andre Lotterer
    expect(getCanonicalDisplayName('Andre Lotterer')).toBe('André Lotterer')
    expect(getCanonicalDisplayName('André Lotterer')).toBe('André Lotterer')
    expect(getDriverCanonicalKey('Andre Lotterer')).toBe(getDriverCanonicalKey('André Lotterer'))

    // António Félix da Costa vs Antonio Felix da Costa
    expect(getCanonicalDisplayName('Antonio Felix da Costa')).toBe('António Félix da Costa')
    expect(getCanonicalDisplayName('António Félix da Costa')).toBe('António Félix da Costa')
    expect(getDriverCanonicalKey('Antonio Felix da Costa')).toBe(
      getDriverCanonicalKey('António Félix da Costa'),
    )

    // Gabriele Mini vs Gabriele Minì
    expect(getCanonicalDisplayName('Gabriele Mini')).toBe('Gabriele Mini')
    expect(getCanonicalDisplayName('Gabriele Minì')).toBe('Gabriele Mini')
    expect(getDriverCanonicalKey('Gabriele Mini')).toBe(getDriverCanonicalKey('Gabriele Minì'))
  })

  it('resolve imagens ausentes corretamente para assets existentes em /pilotos', () => {
    expect(resolveCanonicalDriverImagePath(null, 'Alba Hurup Larsen')).toBe('/pilotos/DRV_0001.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Alessandro Pier Guidi')).toBe(
      '/pilotos/DRV_0081.jpg',
    )
    expect(resolveCanonicalDriverImagePath(null, 'Alex Dunne')).toBe('/pilotos/DRV_0042.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Alexander Dunne')).toBe('/pilotos/DRV_0042.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Alex Lynn')).toBe('/pilotos/DRV_0138.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Alisha Palmowski')).toBe('/pilotos/DRV_0082.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Amauri Cordell')).toBe('/pilotos/DRV_0083.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Amaury Cordeel')).toBe('/pilotos/DRV_0083.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Antonio Fuoco')).toBe('/pilotos/DRV_0084.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Ava Dobson')).toBe('/pilotos/DRV_0086.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Brad Keselowiski')).toBe('/pilotos/DRV_0004.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Brad Keselowski')).toBe('/pilotos/DRV_0004.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Callum Hedge')).toBe('/pilotos/DRV_0088.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Callum Ilott')).toBe('/pilotos/DRV_0139.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Callum Llott')).toBe('/pilotos/DRV_0139.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Callum Voisin')).toBe('/pilotos/DRV_0140.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Chase Elliott')).toBe('/pilotos/DRV_0006.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Christian Mansell')).toBe('/pilotos/DRV_0141.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Christopher Bell')).toBe('/pilotos/DRV_0048.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Connor de Phillippi')).toBe(
      '/pilotos/DRV_0142.jpg',
    )
    expect(resolveCanonicalDriverImagePath(null, 'Dane Cameron')).toBe('/pilotos/DRV_0143.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Daniil Kvyat')).toBe('/pilotos/DRV_0136.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Dennis Hauger')).toBe('/pilotos/DRV_0144.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Denny Hamlin')).toBe('/pilotos/DRV_0051.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Dries Vanthoor')).toBe('/pilotos/DRV_0145.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Earl Bamber')).toBe('/pilotos/DRV_0146.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Edoardo Mortara')).toBe('/pilotos/DRV_0090.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Ella Lloyd')).toBe('/pilotos/DRV_0091.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Ella Stevens')).toBe('/pilotos/DRV_0147.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Emerson Fittipaldi Jr.')).toBe(
      '/pilotos/DRV_0148.jpg',
    )
    expect(resolveCanonicalDriverImagePath(null, 'Emma Felbermayr')).toBe('/pilotos/DRV_0010.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Enzo Fittipaldi')).toBe('/pilotos/DRV_0149.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Esmee Kosterman')).toBe('/pilotos/DRV_0092.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Freddie Slater')).toBe('/pilotos/DRV_0150.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Gabriele Mini')).toBe('/pilotos/DRV_0013.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Helio Castroneves')).toBe('/pilotos/DRV_0151.jpg')
    expect(resolveCanonicalDriverImagePath(null, 'Hélio Castroneves')).toBe('/pilotos/DRV_0151.jpg')
  })

  it('resolve Felipe Albuquerque para pasta pilotos-gerados', () => {
    const img = resolveCanonicalDriverImagePath(null, 'Felipe Albuquerque')
    expect(img).toBeTruthy()
    expect(img).toMatch(/\/pilotos-gerados\/Piloto_22\.jpg/)
  })
})
