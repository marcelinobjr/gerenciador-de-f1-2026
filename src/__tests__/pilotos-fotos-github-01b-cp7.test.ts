import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { resolveDriverPhoto } from '@/lib/driver-photo-resolver'
import {
  resolveCanonicalDriverImagePath,
  getCanonicalDisplayName,
  getDriverCanonicalKey,
} from '@/lib/driver-canonical-service'
import { DRIVER_PORTRAIT_ASSET_MAP } from '@/lib/driver-portrait-map'

/**
 * Suite de Testes Focada: PILOTOS-FOTOS-GITHUB-01B-CP7
 *
 * Bloco 1 - Próximos mappings canônicos validados (61–70):
 * 61. Sheldon van der Linde -> DRV_0180.jpg (mbj-116)
 * 62. Takuma Sato -> DRV_0181.jpg (mbj-132)
 * 63. Tim Tramnitz -> DRV_0182.jpg (mbj-075)
 * 64. Tom Blomqvist -> DRV_0183.jpg (mbj-125)
 * 65. Tony Kanaan -> DRV_0184.jpg (mbj-135)
 * 66. Tuukka Taponen -> DRV_0185.jpg (mbj-068)
 * 67. Ugo Ugochukwu -> DRV_0186.jpg (mbj-070)
 * 68. Will Stevens -> DRV_0187.jpg (mbj-101)
 * 69. Zak O'Sullivan -> DRV_0188.jpg (mbj-058)
 * 70. Sébastien Bourdais -> DRV_0075.jpg (mbj-128) [corrigido de DRV_0189/DRV_0137 para DRV_0075]
 */

describe('PILOTOS-FOTOS-GITHUB-01B-CP7: Mappings Canônicos (61–70)', () => {
  // Os 10 pilotos do lote, incluindo Sébastien Bourdais apontando para DRV_0075.jpg
  const CP7_MAPPINGS = [
    {
      name: 'Sheldon van der Linde',
      expectedAsset: 'DRV_0180',
      expectedFile: 'DRV_0180.jpg',
      id: 'mbj-116',
    },
    {
      name: 'Takuma Sato',
      expectedAsset: 'DRV_0181',
      expectedFile: 'DRV_0181.jpg',
      id: 'mbj-132',
    },
    {
      name: 'Tim Tramnitz',
      expectedAsset: 'DRV_0182',
      expectedFile: 'DRV_0182.jpg',
      id: 'mbj-075',
    },
    {
      name: 'Tom Blomqvist',
      expectedAsset: 'DRV_0183',
      expectedFile: 'DRV_0183.jpg',
      id: 'mbj-125',
    },
    {
      name: 'Tony Kanaan',
      expectedAsset: 'DRV_0184',
      expectedFile: 'DRV_0184.jpg',
      id: 'mbj-135',
    },
    {
      name: 'Tuukka Taponen',
      expectedAsset: 'DRV_0185',
      expectedFile: 'DRV_0185.jpg',
      id: 'mbj-068',
    },
    {
      name: 'Ugo Ugochukwu',
      expectedAsset: 'DRV_0186',
      expectedFile: 'DRV_0186.jpg',
      id: 'mbj-070',
    },
    {
      name: 'Will Stevens',
      expectedAsset: 'DRV_0187',
      expectedFile: 'DRV_0187.jpg',
      id: 'mbj-101',
    },
    {
      name: "Zak O'Sullivan",
      expectedAsset: 'DRV_0188',
      expectedFile: 'DRV_0188.jpg',
      id: 'mbj-058',
    },
    {
      name: 'Sébastien Bourdais',
      expectedAsset: 'DRV_0075',
      expectedFile: 'DRV_0075.jpg',
      id: 'mbj-128',
    },
  ] as const

  // CP7-01: todos os pilotos do lote resolvem para path não vazio
  it('CP7-01: todos os pilotos do lote resolvem para path não vazio', () => {
    expect(CP7_MAPPINGS.length).toBeGreaterThanOrEqual(9)
    for (const item of CP7_MAPPINGS) {
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

  // CP7-02: todos os arquivos resolvidos existem fisicamente
  it('CP7-02: todos os arquivos resolvidos existem fisicamente em public/pilotos/', () => {
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    const dirExists = fs.existsSync(pilotosDir)
    expect(dirExists, 'Diretório public/pilotos deve existir').toBe(true)

    for (const item of CP7_MAPPINGS) {
      const filePath = path.resolve(pilotosDir, item.expectedFile)
      const fileExists = fs.existsSync(filePath)
      expect(fileExists, `Arquivo físico ${item.expectedFile} deve existir em public/pilotos`).toBe(
        true,
      )

      const stat = fs.statSync(filePath)
      expect(stat.size, `Arquivo ${item.expectedFile} não pode ser vazio`).toBeGreaterThan(100)
    }
  })

  // CP7-03: aliases retornam a mesma foto
  it('CP7-03: aliases retornam a mesma foto', () => {
    // 1. Zak O'Sullivan ↔ Zak OSullivan ↔ Zak O’Sullivan (aspas tipográficas)
    const resZak1 = resolveDriverPhoto({ name: "Zak O'Sullivan" })
    const resZak2 = resolveDriverPhoto({ name: 'Zak OSullivan' })
    const resZak3 = resolveDriverPhoto({ name: 'Zak O’Sullivan' })
    expect(resZak1.url).toBe('/pilotos/DRV_0188.jpg')
    expect(resZak2.url).toBe('/pilotos/DRV_0188.jpg')
    expect(resZak3.url).toBe('/pilotos/DRV_0188.jpg')
    expect(getDriverCanonicalKey("Zak O'Sullivan")).toBe(getDriverCanonicalKey('Zak OSullivan'))
    expect(getDriverCanonicalKey("Zak O'Sullivan")).toBe(getDriverCanonicalKey('Zak O’Sullivan'))
    expect(getCanonicalDisplayName("zak o'sullivan")).toBe("Zak O'Sullivan")
    expect(getCanonicalDisplayName('zak osullivan')).toBe("Zak O'Sullivan")
    expect(getCanonicalDisplayName('zak o’sullivan')).toBe("Zak O'Sullivan")

    // 2. Sébastien Bourdais ↔ Sebastien Bourdais
    expect(getCanonicalDisplayName('sébastien bourdais')).toBe('Sébastien Bourdais')
    expect(getCanonicalDisplayName('sebastien bourdais')).toBe('Sébastien Bourdais')
    expect(getDriverCanonicalKey('Sébastien Bourdais')).toBe(
      getDriverCanonicalKey('Sebastien Bourdais'),
    )
    const resBourdais1 = resolveDriverPhoto({ name: 'Sébastien Bourdais' })
    const resBourdais2 = resolveDriverPhoto({ name: 'Sebastien Bourdais' })
    expect(resBourdais1.url).toBe('/pilotos/DRV_0075.jpg')
    expect(resBourdais2.url).toBe('/pilotos/DRV_0075.jpg')
    expect(resBourdais1.assetId).toBe('DRV_0075')
    expect(resBourdais2.assetId).toBe('DRV_0075')

    // 3. Verificações anti-prefixo duplicado (ex.: DRV_DRV_0180..0188 não existem)
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    for (let i = 180; i <= 188; i++) {
      const dupPrefixFile = `DRV_DRV_0${i}.jpg`
      const dupPath = path.resolve(pilotosDir, dupPrefixFile)
      expect(fs.existsSync(dupPath), `Arquivo duplicado ${dupPrefixFile} não deve existir`).toBe(
        false,
      )
    }
  })

  // CP7-04: nenhum cai em placeholder/fallback
  it('CP7-04: nenhum cai em placeholder/fallback', () => {
    for (const item of CP7_MAPPINGS) {
      const resolved = resolveDriverPhoto({ name: item.name })
      expect(resolved.sourceType).not.toBe('fallback_initials')
      expect(resolved.sourceType).toBe('canonical_real')
      expect(resolved.assetId).toBe(item.expectedAsset)
      expect(resolved.url).toBe(`/pilotos/${item.expectedFile}`)
    }
  })
})
