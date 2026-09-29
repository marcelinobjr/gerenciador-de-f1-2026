import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import {
  resolveCanonicalDriverImagePath,
  getCanonicalDisplayName,
  getDriverCanonicalKey,
} from '@/lib/driver-canonical-service'

/**
 * Suite de Testes Focada: PILOTOS-FOTOS-GITHUB-01B-CP4
 *
 * Bloco 1 - Próximos 10 Pilotos Canônicos Mapeados (Helio Castroneves a Freddie Slater):
 * 31. Helio Castroneves -> DRV_0151.jpg
 * 32. Jade Jacquet -> DRV_0097.jpg
 * 33. James Calado -> DRV_0099.jpg
 * 34. Joey Logano -> DRV_0058.jpg
 * 35. Jonathan Browne -> DRV_0100.jpg
 * 36. Josef Newgarden -> DRV_0016.jpg
 * 37. Josep Maria Marti -> DRV_0101.jpg
 * 38. Joshua Dürksen -> DRV_0116.jpg
 * 39. Kamui Kobayashi -> DRV_0017.jpg
 * 40. Freddie Slater -> DRV_0150.jpg
 */

describe('PILOTOS-FOTOS-GITHUB-01B-CP4: Próximos 10 Mappings Canônicos (Helio Castroneves a Freddie Slater)', () => {
  const CP4_MAPPINGS = [
    { name: 'Helio Castroneves', expectedAsset: 'DRV_0151', expectedFile: 'DRV_0151.jpg' },
    { name: 'Jade Jacquet', expectedAsset: 'DRV_0097', expectedFile: 'DRV_0097.jpg' },
    { name: 'James Calado', expectedAsset: 'DRV_0099', expectedFile: 'DRV_0099.jpg' },
    { name: 'Joey Logano', expectedAsset: 'DRV_0058', expectedFile: 'DRV_0058.jpg' },
    { name: 'Jonathan Browne', expectedAsset: 'DRV_0100', expectedFile: 'DRV_0100.jpg' },
    { name: 'Josef Newgarden', expectedAsset: 'DRV_0016', expectedFile: 'DRV_0016.jpg' },
    { name: 'Josep Maria Marti', expectedAsset: 'DRV_0101', expectedFile: 'DRV_0101.jpg' },
    { name: 'Joshua Dürksen', expectedAsset: 'DRV_0116', expectedFile: 'DRV_0116.jpg' },
    { name: 'Kamui Kobayashi', expectedAsset: 'DRV_0017', expectedFile: 'DRV_0017.jpg' },
    { name: 'Freddie Slater', expectedAsset: 'DRV_0150', expectedFile: 'DRV_0150.jpg' },
  ] as const

  // CP4-01: todos os 10 retornam path não vazio e correto
  it('CP4-01: todos os 10 retornam path não vazio e correto', () => {
    expect(CP4_MAPPINGS).toHaveLength(10)
    for (const item of CP4_MAPPINGS) {
      const resolved = resolveDriverPhoto({ name: item.name })
      expect(resolved.url, `Path não vazio para ${item.name}`).toBeTruthy()
      expect(resolved.url).toBe(`/pilotos/${item.expectedFile}`)
      expect(resolved.sourceType).toBe('canonical_real')

      const canonicalPath = resolveCanonicalDriverImagePath(null, item.name)
      expect(canonicalPath, `Path canônico não vazio para ${item.name}`).toBe(
        `/pilotos/${item.expectedFile}`,
      )
    }
  })

  // CP4-02: todos os arquivos existem em public/pilotos/ com payload válido
  it('CP4-02: todos os arquivos existem em public/pilotos/ com payload válido', () => {
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    const dirExists = fs.existsSync(pilotosDir)
    expect(dirExists, 'Diretório public/pilotos deve existir').toBe(true)

    for (const item of CP4_MAPPINGS) {
      const filePath = path.resolve(pilotosDir, item.expectedFile)
      const fileExists = fs.existsSync(filePath)
      expect(fileExists, `Arquivo físico ${item.expectedFile} deve existir em public/pilotos`).toBe(
        true,
      )

      const stat = fs.statSync(filePath)
      expect(stat.size, `Arquivo ${item.expectedFile} não pode ser vazio`).toBeGreaterThan(100)
    }
  })

  // CP4-03: Freddie Slater usa filename real verificado (DRV_0150.jpg) e NÃO DRV_DRV_0150.jpg
  it('CP4-03: Freddie Slater verifica filename real (DRV_0150.jpg vs DRV_DRV_0150.jpg)', () => {
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    const hasDrv0150 = fs.existsSync(path.resolve(pilotosDir, 'DRV_0150.jpg'))
    const hasDrvDrv0150 = fs.existsSync(path.resolve(pilotosDir, 'DRV_DRV_0150.jpg'))

    expect(hasDrv0150, 'DRV_0150.jpg deve existir fisicamente').toBe(true)
    expect(hasDrvDrv0150, 'DRV_DRV_0150.jpg NÃO deve existir').toBe(false)

    const resolved = resolveDriverPhoto({ name: 'Freddie Slater' })
    expect(resolved.url).toBe('/pilotos/DRV_0150.jpg')
    expect(resolved.assetId).toBe('DRV_0150')
    expect(resolved.sourceType).toBe('canonical_real')

    const canonicalPath = resolveCanonicalDriverImagePath(null, 'Freddie Slater')
    expect(canonicalPath).toBe('/pilotos/DRV_0150.jpg')
  })

  // CP4-04: aliases canônicos dos 10 pilotos mapeados (Helio Castroneves, Pepe Martí, Dürksen, Newgarden)
  it('CP4-04: aliases canônicos resolvem para a mesma foto e chave canônica', () => {
    // 1. Helio Castroneves / Hélio Castroneves
    const resHelio1 = resolveDriverPhoto({ name: 'Helio Castroneves' })
    const resHelio2 = resolveDriverPhoto({ name: 'Hélio Castroneves' })
    expect(resHelio1.url).toBe('/pilotos/DRV_0151.jpg')
    expect(resHelio2.url).toBe('/pilotos/DRV_0151.jpg')
    expect(getDriverCanonicalKey('Helio Castroneves')).toBe(
      getDriverCanonicalKey('Hélio Castroneves'),
    )

    // 2. Josep Maria Marti / Pepe Marti / Josep Maria Martí
    const resMarti1 = resolveDriverPhoto({ name: 'Josep Maria Marti' })
    const resMarti2 = resolveDriverPhoto({ name: 'Pepe Marti' })
    const resMarti3 = resolveDriverPhoto({ name: 'Josep Maria Martí' })
    expect(resMarti1.url).toBe('/pilotos/DRV_0101.jpg')
    expect(resMarti2.url).toBe('/pilotos/DRV_0101.jpg')
    expect(resMarti3.url).toBe('/pilotos/DRV_0101.jpg')

    // 3. Joshua Dürksen / Joshua Durksen / Joshua Duerksen
    const resDurk1 = resolveDriverPhoto({ name: 'Joshua Dürksen' })
    const resDurk2 = resolveDriverPhoto({ name: 'Joshua Durksen' })
    const resDurk3 = resolveDriverPhoto({ name: 'Joshua Duerksen' })
    expect(resDurk1.url).toBe('/pilotos/DRV_0116.jpg')
    expect(resDurk2.url).toBe('/pilotos/DRV_0116.jpg')
    expect(resDurk3.url).toBe('/pilotos/DRV_0116.jpg')

    // 4. Josef Newgarden / Josef Nesgarden
    const resNew1 = resolveDriverPhoto({ name: 'Josef Newgarden' })
    const resNew2 = resolveDriverPhoto({ name: 'Josef Nesgarden' })
    expect(resNew1.url).toBe('/pilotos/DRV_0016.jpg')
    expect(resNew2.url).toBe('/pilotos/DRV_0016.jpg')

    // 5. Nenhum dos 10 cai em fallback_initials
    for (const item of CP4_MAPPINGS) {
      const resolved = resolveDriverPhoto({ name: item.name })
      expect(resolved.sourceType).not.toBe('fallback_initials')
      expect(resolved.sourceType).toBe('canonical_real')
      expect(resolved.assetId).toBe(item.expectedAsset)
    }
  })
})
