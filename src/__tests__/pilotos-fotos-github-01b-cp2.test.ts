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
 * Suite de Testes Focada: PILOTOS-FOTOS-GITHUB-01B-CP2
 *
 * Bloco 1 - Próximos 10 Pilotos Canônicos Mapeados (Callum Llott em diante):
 * 11. Callum Llott -> DRV_0139.jpg
 * 12. Callum Voisin -> DRV_0140.jpg
 * 13. Chase Elliott -> DRV_0006.jpg
 * 14. Christian Mansell -> DRV_0141.jpg
 * 15. Christopher Bell -> DRV_0048.jpg
 * 16. Connor de Phillippi -> DRV_0142.jpg
 * 17. Dane Cameron -> DRV_0143.jpg
 * 18. Daniil Kvyat -> DRV_0136.jpg
 * 19. Dennis Hauger -> DRV_0144.jpg
 * 20. Denny Hamlin -> DRV_0051.jpg
 */

describe('PILOTOS-FOTOS-GITHUB-01B-CP2: Próximos 10 Mappings Canônicos (Callum Llott em diante)', () => {
  const CP2_MAPPINGS = [
    { name: 'Callum Llott', expectedAsset: 'DRV_0139', expectedFile: 'DRV_0139.jpg' },
    { name: 'Callum Voisin', expectedAsset: 'DRV_0140', expectedFile: 'DRV_0140.jpg' },
    { name: 'Chase Elliott', expectedAsset: 'DRV_0006', expectedFile: 'DRV_0006.jpg' },
    { name: 'Christian Mansell', expectedAsset: 'DRV_0141', expectedFile: 'DRV_0141.jpg' },
    { name: 'Christopher Bell', expectedAsset: 'DRV_0048', expectedFile: 'DRV_0048.jpg' },
    { name: 'Connor de Phillippi', expectedAsset: 'DRV_0142', expectedFile: 'DRV_0142.jpg' },
    { name: 'Dane Cameron', expectedAsset: 'DRV_0143', expectedFile: 'DRV_0143.jpg' },
    { name: 'Daniil Kvyat', expectedAsset: 'DRV_0136', expectedFile: 'DRV_0136.jpg' },
    { name: 'Dennis Hauger', expectedAsset: 'DRV_0144', expectedFile: 'DRV_0144.jpg' },
    { name: 'Denny Hamlin', expectedAsset: 'DRV_0051', expectedFile: 'DRV_0051.jpg' },
  ] as const

  // CP2-01: todos os 10 retornam path não vazio
  it('CP2-01: todos os 10 retornam path não vazio', () => {
    expect(CP2_MAPPINGS).toHaveLength(10)
    for (const item of CP2_MAPPINGS) {
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

  // CP2-02: todos os arquivos existem (payload válido)
  it('CP2-02: todos os arquivos existem (payload válido em public/pilotos)', () => {
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    const dirExists = fs.existsSync(pilotosDir)
    expect(dirExists, 'Diretório public/pilotos deve existir').toBe(true)

    for (const item of CP2_MAPPINGS) {
      const filePath = path.resolve(pilotosDir, item.expectedFile)
      const fileExists = fs.existsSync(filePath)
      expect(fileExists, `Arquivo físico ${item.expectedFile} deve existir em public/pilotos`).toBe(
        true,
      )

      const stat = fs.statSync(filePath)
      expect(stat.size, `Arquivo ${item.expectedFile} não pode ser vazio`).toBeGreaterThan(100)
    }
  })

  // CP2-03: nenhum cai em placeholder quando o arquivo existe
  it('CP2-03: nenhum cai em placeholder quando o arquivo existe', () => {
    for (const item of CP2_MAPPINGS) {
      const resolved = resolveDriverPhoto({ name: item.name })
      expect(resolved.sourceType).not.toBe('fallback_initials')
      expect(resolved.url).not.toBeNull()
      expect(resolved.url).toBe(`/pilotos/${item.expectedFile}`)
      expect(resolved.assetId).toBe(item.expectedAsset)
    }
  })

  // CP2-04: resolução é por identidade canônica (não por runtime ID)
  it('CP2-04: resolução é por identidade canônica (não por runtime ID)', () => {
    // 1. Callum Llott / Callum Ilott (alias canônico)
    const resLlott = resolveDriverPhoto({ name: 'Callum Llott' })
    const resIlott = resolveDriverPhoto({ name: 'Callum Ilott' })
    expect(resLlott.url).toBe('/pilotos/DRV_0139.jpg')
    expect(resIlott.url).toBe('/pilotos/DRV_0139.jpg')
    expect(resLlott.url).toBe(resIlott.url)
    expect(resLlott.assetId).toBe('DRV_0139')
    expect(getDriverCanonicalKey('Callum Llott')).toBe(getDriverCanonicalKey('Callum Ilott'))
    expect(getCanonicalDisplayName('Callum Llott')).toBe('Callum Ilott')

    // 2. Chase Elliott / Chase Elliot (alias)
    const resChase1 = resolveDriverPhoto({ name: 'Chase Elliott' })
    const resChase2 = resolveDriverPhoto({ name: 'Chase Elliot' })
    expect(resChase1.url).toBe('/pilotos/DRV_0006.jpg')
    expect(resChase2.url).toBe('/pilotos/DRV_0006.jpg')

    // 3. Connor de Phillippi / Connor De Phillippi (case-insensitivity / spacing)
    const resConnor1 = resolveDriverPhoto({ name: 'Connor de Phillippi' })
    const resConnor2 = resolveDriverPhoto({ name: 'Connor De Phillippi' })
    expect(resConnor1.url).toBe('/pilotos/DRV_0142.jpg')
    expect(resConnor2.url).toBe('/pilotos/DRV_0142.jpg')

    // 4. Resolução por nome canônico isolado, sem runtime ID
    for (const item of CP2_MAPPINGS) {
      const canonicalKey = getDriverCanonicalKey(item.name)
      expect(canonicalKey, `Chave canônica gerada para ${item.name}`).toBeTruthy()

      const pathWithoutId = resolveCanonicalDriverImagePath(null, item.name)
      expect(pathWithoutId).toBe(`/pilotos/${item.expectedFile}`)
    }
  })
})
