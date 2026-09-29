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
 * Suite de Testes Focada: PILOTOS-FOTOS-GITHUB-01B-CP5
 *
 * Bloco 1 - Próximos 10 Pilotos Canônicos Mapeados (Marco Wittmann a Norman Nato):
 * 41. Marco Wittmann -> DRV_0160.jpg (mbj-117)
 * 42. Marcus Armstrong -> DRV_0161.jpg (mbj-096)
 * 43. Mathieu Jaminet -> DRV_0162.jpg (mbj-113)
 * 44. Matt Campbell -> DRV_0163.jpg (mbj-114)
 * 45. Matteo Cairoli -> DRV_0164.jpg
 * 46. Mike Conway -> DRV_0165.jpg (mbj-107)
 * 47. Mirko Bortolotti -> DRV_0166.jpg
 * 48. Nicky Yelloly -> DRV_0167.jpg
 * 49. Nolan Siegel -> DRV_0168.jpg (mbj-101)
 * 50. Norman Nato -> DRV_0169.jpg
 */

describe('PILOTOS-FOTOS-GITHUB-01B-CP5: 10 Mappings Canônicos (Marco Wittmann a Norman Nato)', () => {
  const CP5_MAPPINGS = [
    {
      name: 'Marco Wittmann',
      expectedAsset: 'DRV_0160',
      expectedFile: 'DRV_0160.jpg',
      id: 'mbj-117',
    },
    {
      name: 'Marcus Armstrong',
      expectedAsset: 'DRV_0161',
      expectedFile: 'DRV_0161.jpg',
      id: 'mbj-096',
    },
    {
      name: 'Mathieu Jaminet',
      expectedAsset: 'DRV_0162',
      expectedFile: 'DRV_0162.jpg',
      id: 'mbj-113',
    },
    {
      name: 'Matt Campbell',
      expectedAsset: 'DRV_0163',
      expectedFile: 'DRV_0163.jpg',
      id: 'mbj-114',
    },
    { name: 'Matteo Cairoli', expectedAsset: 'DRV_0164', expectedFile: 'DRV_0164.jpg' },
    { name: 'Mike Conway', expectedAsset: 'DRV_0165', expectedFile: 'DRV_0165.jpg', id: 'mbj-107' },
    { name: 'Mirko Bortolotti', expectedAsset: 'DRV_0166', expectedFile: 'DRV_0166.jpg' },
    { name: 'Nicky Yelloly', expectedAsset: 'DRV_0167', expectedFile: 'DRV_0167.jpg' },
    {
      name: 'Nolan Siegel',
      expectedAsset: 'DRV_0168',
      expectedFile: 'DRV_0168.jpg',
      id: 'mbj-101',
    },
    { name: 'Norman Nato', expectedAsset: 'DRV_0169', expectedFile: 'DRV_0169.jpg' },
  ] as const

  // CP5-01: os 10 pilotos resolvem para path não vazio e correto
  it('CP5-01: os 10 pilotos resolvem para path não vazio', () => {
    expect(CP5_MAPPINGS).toHaveLength(10)
    for (const item of CP5_MAPPINGS) {
      const resolved = resolveDriverPhoto({ name: item.name })
      expect(resolved.url, `Path não vazio para ${item.name}`).toBeTruthy()
      expect(resolved.url).toBe(`/pilotos/${item.expectedFile}`)
      expect(resolved.sourceType).toBe('canonical_real')

      const canonicalPath = resolveCanonicalDriverImagePath(null, item.name)
      expect(canonicalPath, `Path canônico não vazio para ${item.name}`).toBe(
        `/pilotos/${item.expectedFile}`,
      )

      if ('id' in item && item.id) {
        const canonicalById = resolveCanonicalDriverImagePath(item.id, null)
        expect(canonicalById, `Path canônico por ID para ${item.id}`).toBe(
          `/pilotos/${item.expectedFile}`,
        )
      }
    }
  })

  // CP5-02: todos os arquivos resolvidos existem em public/pilotos/ com payload válido
  it('CP5-02: todos os arquivos resolvidos existem (fs.existsSync em public/pilotos/)', () => {
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    const dirExists = fs.existsSync(pilotosDir)
    expect(dirExists, 'Diretório public/pilotos deve existir').toBe(true)

    for (const item of CP5_MAPPINGS) {
      const filePath = path.resolve(pilotosDir, item.expectedFile)
      const fileExists = fs.existsSync(filePath)
      expect(fileExists, `Arquivo físico ${item.expectedFile} deve existir em public/pilotos`).toBe(
        true,
      )

      const stat = fs.statSync(filePath)
      expect(stat.size, `Arquivo ${item.expectedFile} não pode ser vazio`).toBeGreaterThan(100)
    }
  })

  // CP5-03: aliases (Nicky/Nick Yelloly, Norman/Norm Nato) retornam a mesma foto
  it('CP5-03: aliases (Nicky/Nick Yelloly e Norman/Norm Nato) retornam a mesma foto', () => {
    // 1. Nicky Yelloly ↔ Nick Yelloly
    const resYelloly1 = resolveDriverPhoto({ name: 'Nicky Yelloly' })
    const resYelloly2 = resolveDriverPhoto({ name: 'Nick Yelloly' })
    expect(resYelloly1.url).toBe('/pilotos/DRV_0167.jpg')
    expect(resYelloly2.url).toBe('/pilotos/DRV_0167.jpg')
    expect(getDriverCanonicalKey('Nicky Yelloly')).toBe(getDriverCanonicalKey('Nick Yelloly'))
    expect(getCanonicalDisplayName('Nicky Yelloly')).toBe('Nicky Yelloly')
    expect(getCanonicalDisplayName('nick yelloly')).toBe('Nicky Yelloly')

    // 2. Norman Nato ↔ Norm Nato
    const resNato1 = resolveDriverPhoto({ name: 'Norman Nato' })
    const resNato2 = resolveDriverPhoto({ name: 'Norm Nato' })
    expect(resNato1.url).toBe('/pilotos/DRV_0169.jpg')
    expect(resNato2.url).toBe('/pilotos/DRV_0169.jpg')
    expect(getDriverCanonicalKey('Norman Nato')).toBe(getDriverCanonicalKey('Norm Nato'))
    expect(getCanonicalDisplayName('norm nato')).toBe('Norman Nato')

    // 3. Checagem anti-duplicação: nenhum arquivo com prefixo duplicado DRV_DRV_0160..0169 existe
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    for (let i = 160; i <= 169; i++) {
      const dupPrefixFile = `DRV_DRV_0${i}.jpg`
      const dupPath = path.resolve(pilotosDir, dupPrefixFile)
      expect(fs.existsSync(dupPath), `Arquivo duplicado ${dupPrefixFile} não deve existir`).toBe(
        false,
      )
    }
  })

  // CP5-04: nenhum cai em placeholder se o arquivo existe
  it('CP5-04: nenhum cai em placeholder se o arquivo existe', () => {
    for (const item of CP5_MAPPINGS) {
      const resolved = resolveDriverPhoto({ name: item.name })
      expect(resolved.sourceType).not.toBe('fallback_initials')
      expect(resolved.sourceType).toBe('canonical_real')
      expect(resolved.assetId).toBe(item.expectedAsset)
      expect(resolved.url).toBe(`/pilotos/${item.expectedFile}`)
    }
  })
})
