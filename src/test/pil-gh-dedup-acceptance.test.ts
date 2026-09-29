import { describe, it, expect } from 'vitest'
import {
  getCanonicalDisplayName,
  getDriverCanonicalKey,
  resolveCanonicalDriverImagePath,
  normalizeDriverNameToken,
} from '@/lib/driver-canonical-service'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import { MBJ_2026_PILOTS } from '@/lib/mbj-drivers-data'
import fs from 'node:fs'
import path from 'node:path'

describe('PIL-GH: Acceptance Tests — Deduplicação e Identidade Canônica', () => {
  // PIL-GH-01: Alex Palou aparece uma vez
  it('PIL-GH-01: Alex Palou tem a mesma chave canônica para variantes com e sem acento', () => {
    const k1 = getDriverCanonicalKey('Alex Palou')
    const k2 = getDriverCanonicalKey('Álex Palou')
    expect(k1).toBe(k2)
    expect(getCanonicalDisplayName('Álex Palou')).toBe('Alex Palou')
  })

  // PIL-GH-02: Alex/Alexander Albon → uma identidade
  it('PIL-GH-02: Alex/Alexander Albon compartilham chave canônica e identidade', () => {
    const k1 = getDriverCanonicalKey('Alex Albon')
    const k2 = getDriverCanonicalKey('Alexander Albon')
    expect(k1).toBe(k2)
  })

  // PIL-GH-03: Alex/Alexander Dunne → uma identidade
  it('PIL-GH-03: Alex/Alexander Dunne compartilham chave canônica e identidade', () => {
    const k1 = getDriverCanonicalKey('Alex Dunne')
    const k2 = getDriverCanonicalKey('Alexander Dunne')
    expect(k1).toBe(k2)
  })

  // PIL-GH-04: Andre/André Lotterer → uma identidade
  it('PIL-GH-04: Andre/André Lotterer compartilham chave canônica', () => {
    const k1 = getDriverCanonicalKey('Andre Lotterer')
    const k2 = getDriverCanonicalKey('André Lotterer')
    expect(k1).toBe(k2)
  })

  // PIL-GH-05: Antonio/António Félix da Costa → uma identidade
  it('PIL-GH-05: Antonio/António Félix da Costa compartilham chave canônica', () => {
    const k1 = getDriverCanonicalKey('Antonio Felix da Costa')
    const k2 = getDriverCanonicalKey('António Félix da Costa')
    expect(k1).toBe(k2)
  })

  // PIL-GH-06: Gabriele Mini/Minì → uma identidade
  it('PIL-GH-06: Gabriele Mini/Minì compartilham chave canônica', () => {
    const k1 = getDriverCanonicalKey('Gabriele Mini')
    const k2 = getDriverCanonicalKey('Gabriele Minì')
    expect(k1).toBe(k2)
  })

  // PIL-GH-07: Robin Frijns WEC não aparece no catálogo MBJ
  it('PIL-GH-07: Robin Frijns WEC não deve existir em MBJ_2026_PILOTS', () => {
    const wecDriver = MBJ_2026_PILOTS.find(
      (p) => p.name.toLowerCase().trim() === 'robin frijns wec',
    )
    expect(wecDriver).toBeUndefined()
  })

  // PIL-GH-08: Robin Frijns aparece uma vez
  it('PIL-GH-08: Robin Frijns tem registro único no catálogo', () => {
    const frijnsEntries = MBJ_2026_PILOTS.filter(
      (p) => getDriverCanonicalKey(p.name) === getDriverCanonicalKey('Robin Frijns'),
    )
    expect(frijnsEntries.length).toBe(1)
    expect(frijnsEntries[0].name).toBe('Robin Frijns')
  })

  // Testes de Resolução de Fotos Bloco 1
  it('Resolve fotos do Bloco 1 para arquivos físicos válidos em public', () => {
    const bloco1Map: Record<string, string> = {
      'Alba Hurup Larsen': '/pilotos/DRV_0001.jpg',
      'Alessandro Pier Guidi': '/pilotos/DRV_0081.jpg',
      'Alex Dunne': '/pilotos/DRV_0042.jpg',
      'Alex Lynn': '/pilotos/DRV_0138.jpg',
      'Alisha Palmowski': '/pilotos/DRV_0082.jpg',
      'Amauri Cordell': '/pilotos/DRV_0083.jpg',
      'Antonio Fuoco': '/pilotos/DRV_0084.jpg',
      'Ava Dobson': '/pilotos/DRV_0086.jpg',
      'Brad Keselowiski': '/pilotos/DRV_0004.jpg',
      'Callum Hedge': '/pilotos/DRV_0088.jpg',
      'Callum Llott': '/pilotos/DRV_0139.jpg',
      'Callum Voisin': '/pilotos/DRV_0140.jpg',
      'Chase Elliott': '/pilotos/DRV_0006.jpg',
      'Christian Mansell': '/pilotos/DRV_0141.jpg',
      'Christopher Bell': '/pilotos/DRV_0048.jpg',
      'Connor de Phillippi': '/pilotos/DRV_0142.jpg',
      'Dane Cameron': '/pilotos/DRV_0143.jpg',
      'Daniil Kvyat': '/pilotos/DRV_0136.jpg',
      'Dennis Hauger': '/pilotos/DRV_0144.jpg',
      'Denny Hamlin': '/pilotos/DRV_0051.jpg',
      'Dries Vanthoor': '/pilotos/DRV_0145.jpg',
      'Earl Bamber': '/pilotos/DRV_0146.jpg',
      'Edoardo Mortara': '/pilotos/DRV_0090.jpg',
      'Ella Lloyd': '/pilotos/DRV_0091.jpg',
      'Ella Stevens': '/pilotos/DRV_0147.jpg',
      'Emerson Fittipaldi Jr.': '/pilotos/DRV_0148.jpg',
      'Emma Felbermayr': '/pilotos/DRV_0010.jpg',
      'Enzo Fittipaldi': '/pilotos/DRV_0149.jpg',
      'Esmee Kosterman': '/pilotos/DRV_0092.jpg',
      'Felipe Albuquerque': '/pilotos-gerados/Piloto_14.jpg',
      'Freddie Slater': '/pilotos/DRV_0150.jpg',
      'Gabriele Mini': '/pilotos/DRV_0013.jpg',
      'Helio Castroneves': '/pilotos/DRV_0151.jpg',
    }

    for (const [name, expectedPath] of Object.entries(bloco1Map)) {
      const resolved = resolveCanonicalDriverImagePath(null, name)
      expect(resolved, `Path para ${name} não deveria ser nulo`).toBe(expectedPath)
      const photo = resolveDriverPhoto({ name })
      expect(photo.url).toBe(expectedPath)

      // Prova de existência do arquivo local
      const physicalPath = path.resolve(process.cwd(), 'public', expectedPath.replace(/^\//, ''))
      expect(fs.existsSync(physicalPath), `Arquivo físico ${physicalPath} deve existir`).toBe(true)
    }
  })
})
