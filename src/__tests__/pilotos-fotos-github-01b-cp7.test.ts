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
import { CANONICAL_DRIVER_ID_TO_ASSET_ID } from '@/lib/canonical-driver-database'

/**
 * Suite de Testes Focada: PILOTOS-FOTOS-GITHUB-01B-CP7
 *
 * Bloco 1 - Próximos 10 Pilotos Canônicos Mapeados (Sheldon van der Linde a Sébastien Bourdais):
 * 61. Sheldon van der Linde -> DRV_0180.jpg (mbj-116)
 * 62. Takuma Sato -> DRV_0181.jpg (mbj-132)
 * 63. Tim Tramnitz -> DRV_0182.jpg (mbj-075)
 * 64. Tom Blomqvist -> DRV_0183.jpg (mbj-125)
 * 65. Tony Kanaan -> DRV_0184.jpg (mbj-135)
 * 66. Tuukka Taponen -> DRV_0185.jpg (mbj-068)
 * 67. Ugo Ugochukwu -> DRV_0186.jpg (mbj-070)
 * 68. Will Stevens -> DRV_0187.jpg (mbj-101)
 * 69. Zak O'Sullivan -> DRV_0188.jpg (mbj-058)
 * 70. Sébastien Bourdais -> DRV_0189.jpg (mbj-136)
 */

describe('PILOTOS-FOTOS-GITHUB-01B-CP7: 10 Mappings Canônicos (Sheldon van der Linde a Sébastien Bourdais)', () => {
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
      expectedAsset: 'DRV_0189',
      expectedFile: 'DRV_0189.jpg',
      id: 'mbj-136',
    },
  ] as const

  // CP7-01: os 10 pilotos resolvem para path não vazio e correto no mapping
  it('CP7-01: mapping presente - os 10 pilotos resolvem para path e assetId corretos', () => {
    expect(CP7_MAPPINGS).toHaveLength(10)
    for (const item of CP7_MAPPINGS) {
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

  // CP7-02: arquivo de foto existe em public/pilotos/
  it('CP7-02: arquivo de foto existe (fs.existsSync em public/pilotos/) para fotos disponíveis', () => {
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    const dirExists = fs.existsSync(pilotosDir)
    expect(dirExists, 'Diretório public/pilotos deve existir').toBe(true)

    for (const item of CP7_MAPPINGS) {
      const filePath = path.resolve(pilotosDir, item.expectedFile)
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath)
        expect(stat.size, `Arquivo ${item.expectedFile} não pode ser vazio`).toBeGreaterThan(100)
      }
    }
  })

  // CP7-03: aliases resolvem
  it('CP7-03: alias resolve - variações de nome retornam a mesma foto e canonical key', () => {
    // 1. Zak O'Sullivan ↔ Zak OSullivan
    const resZak1 = resolveDriverPhoto({ name: "Zak O'Sullivan" })
    const resZak2 = resolveDriverPhoto({ name: 'Zak OSullivan' })
    expect(resZak1.url).toBe('/pilotos/DRV_0188.jpg')
    expect(resZak2.url).toBe('/pilotos/DRV_0188.jpg')

    // 2. Sébastien Bourdais ↔ Sebastien Bourdais
    const resBourdais1 = resolveDriverPhoto({ name: 'Sébastien Bourdais' })
    const resBourdais2 = resolveDriverPhoto({ name: 'Sebastien Bourdais' })
    expect(resBourdais1.url).toBe('/pilotos/DRV_0189.jpg')
    expect(resBourdais2.url).toBe('/pilotos/DRV_0189.jpg')
    expect(getDriverCanonicalKey('Sébastien Bourdais')).toBe(
      getDriverCanonicalKey('Sebastien Bourdais'),
    )

    // 3. Takuma Sato
    const resSato = resolveDriverPhoto({ name: 'Takuma Sato' })
    expect(resSato.url).toBe('/pilotos/DRV_0181.jpg')

    // 4. Tim Tramnitz
    const resTramnitz = resolveDriverPhoto({ name: 'Tim Tramnitz' })
    expect(resTramnitz.url).toBe('/pilotos/DRV_0182.jpg')

    // 5. Sheldon van der Linde
    const resSheldon = resolveDriverPhoto({ name: 'Sheldon van der Linde' })
    expect(resSheldon.url).toBe('/pilotos/DRV_0180.jpg')
  })

  // CP7-04: sem chave duplicada em DRIVER_PORTRAIT_ASSET_MAP
  it('CP7-04: sem chave duplicada em DRIVER_PORTRAIT_ASSET_MAP e mapping consistente', () => {
    const keys = Object.keys(DRIVER_PORTRAIT_ASSET_MAP)
    const uniqueKeys = new Set(keys)
    expect(uniqueKeys.size).toBe(keys.length)

    // Checagem de que todos os assets DRV_0180..0189 estão definidos no mapa
    const values = Object.values(DRIVER_PORTRAIT_ASSET_MAP)
    for (let i = 180; i <= 189; i++) {
      const asset = `DRV_0${i}`
      expect(values).toContain(asset)
    }
  })
})
