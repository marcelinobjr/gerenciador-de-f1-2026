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
 * Suite de Testes Focada: PILOTOS-FOTOS-GITHUB-01B-CP6
 *
 * Bloco 1 - Próximos 10 Pilotos Canônicos Mapeados (Nyck de Vries a Romain Grosjean):
 * 51. Nyck de Vries / Nicky de Vries -> DRV_0170.jpg (mbj-039)
 * 52. Patricio O'Ward / Pato O'Ward -> DRV_0171.jpg (mbj-025)
 * 53. Raffaele Marciello / Lello Marciello -> DRV_0172.jpg (mbj-120)
 * 54. Rene Rast / René Rast -> DRV_0173.jpg (mbj-106)
 * 55. Renger van der Zande -> DRV_0174.jpg (mbj-131)
 * 56. Ricky Taylor -> DRV_0175.jpg (mbj-121)
 * 57. Rinus VeeKay / Rinus van Kalmthout -> DRV_0176.jpg (mbj-094)
 * 58. Robert Shwartzman -> DRV_0177.jpg (mbj-040)
 * 59. Robin Frijns -> DRV_0178.jpg (mbj-087)
 * 60. Romain Grosjean -> DRV_0179.jpg (mbj-132)
 */

describe('PILOTOS-FOTOS-GITHUB-01B-CP6: 10 Mappings Canônicos (Nyck de Vries a Romain Grosjean)', () => {
  const CP6_MAPPINGS = [
    {
      name: 'Nyck de Vries',
      expectedAsset: 'DRV_0170',
      expectedFile: 'DRV_0170.jpg',
      id: 'mbj-039',
    },
    {
      name: "Patricio O'Ward",
      expectedAsset: 'DRV_0171',
      expectedFile: 'DRV_0171.jpg',
      id: 'mbj-025',
    },
    {
      name: 'Raffaele Marciello',
      expectedAsset: 'DRV_0172',
      expectedFile: 'DRV_0172.jpg',
      id: 'mbj-120',
    },
    {
      name: 'Rene Rast',
      expectedAsset: 'DRV_0173',
      expectedFile: 'DRV_0173.jpg',
      id: 'mbj-106',
    },
    {
      name: 'Renger van der Zande',
      expectedAsset: 'DRV_0174',
      expectedFile: 'DRV_0174.jpg',
      id: 'mbj-131',
    },
    {
      name: 'Ricky Taylor',
      expectedAsset: 'DRV_0175',
      expectedFile: 'DRV_0175.jpg',
      id: 'mbj-121',
    },
    {
      name: 'Rinus VeeKay',
      expectedAsset: 'DRV_0176',
      expectedFile: 'DRV_0176.jpg',
      id: 'mbj-094',
    },
    {
      name: 'Robert Shwartzman',
      expectedAsset: 'DRV_0177',
      expectedFile: 'DRV_0177.jpg',
      id: 'mbj-040',
    },
    {
      name: 'Robin Frijns',
      expectedAsset: 'DRV_0178',
      expectedFile: 'DRV_0178.jpg',
      id: 'mbj-087',
    },
    {
      name: 'Romain Grosjean',
      expectedAsset: 'DRV_0179',
      expectedFile: 'DRV_0179.jpg',
      id: 'mbj-132',
    },
  ] as const

  // CP6-01: os 10 pilotos resolvem para path não vazio e correto
  it('CP6-01: os 10 pilotos resolvem para path não vazio e canônico', () => {
    expect(CP6_MAPPINGS).toHaveLength(10)
    for (const item of CP6_MAPPINGS) {
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

  // CP6-02: todos os arquivos resolvidos existem em public/pilotos/ com payload válido
  it('CP6-02: todos os arquivos resolvidos existem (fs.existsSync em public/pilotos/)', () => {
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    const dirExists = fs.existsSync(pilotosDir)
    expect(dirExists, 'Diretório public/pilotos deve existir').toBe(true)

    for (const item of CP6_MAPPINGS) {
      const filePath = path.resolve(pilotosDir, item.expectedFile)
      const fileExists = fs.existsSync(filePath)
      expect(fileExists, `Arquivo físico ${item.expectedFile} deve existir em public/pilotos`).toBe(
        true,
      )

      const stat = fs.statSync(filePath)
      expect(stat.size, `Arquivo ${item.expectedFile} não pode ser vazio`).toBeGreaterThan(100)
    }
  })

  // CP6-03: aliases canônicos (Nyck/Nicky de Vries, Pato/Patricio O'Ward, Rene/René Rast, Rinus VeeKay/van Kalmthout, Lello Marciello)
  it('CP6-03: aliases canônicos resolvem para a mesma foto e chave canônica', () => {
    // 1. Nyck de Vries ↔ Nicky de Vries
    const resDeVries1 = resolveDriverPhoto({ name: 'Nyck de Vries' })
    const resDeVries2 = resolveDriverPhoto({ name: 'Nicky de Vries' })
    expect(resDeVries1.url).toBe('/pilotos/DRV_0170.jpg')
    expect(resDeVries2.url).toBe('/pilotos/DRV_0170.jpg')
    expect(getCanonicalDisplayName('Nicky de Vries')).toBe('Nyck de Vries')

    // 2. Patricio O'Ward ↔ Pato O'Ward
    const resWard1 = resolveDriverPhoto({ name: "Patricio O'Ward" })
    const resWard2 = resolveDriverPhoto({ name: "Pato O'Ward" })
    expect(resWard1.url).toBe('/pilotos/DRV_0171.jpg')
    expect(resWard2.url).toBe('/pilotos/DRV_0171.jpg')
    expect(getCanonicalDisplayName("Patricio O'Ward")).toBe("Pato O'Ward")

    // 3. Rene Rast ↔ René Rast
    const resRast1 = resolveDriverPhoto({ name: 'Rene Rast' })
    const resRast2 = resolveDriverPhoto({ name: 'René Rast' })
    expect(resRast1.url).toBe('/pilotos/DRV_0173.jpg')
    expect(resRast2.url).toBe('/pilotos/DRV_0173.jpg')
    expect(getDriverCanonicalKey('Rene Rast')).toBe(getDriverCanonicalKey('René Rast'))
    expect(getCanonicalDisplayName('Rene Rast')).toBe('René Rast')

    // 4. Rinus VeeKay ↔ Rinus van Kalmthout
    const resVeeKay1 = resolveDriverPhoto({ name: 'Rinus VeeKay' })
    const resVeeKay2 = resolveDriverPhoto({ name: 'Rinus van Kalmthout' })
    expect(resVeeKay1.url).toBe('/pilotos/DRV_0176.jpg')
    expect(resVeeKay2.url).toBe('/pilotos/DRV_0176.jpg')
    expect(getDriverCanonicalKey('Rinus VeeKay')).toBe(getDriverCanonicalKey('Rinus van Kalmthout'))
    expect(getCanonicalDisplayName('Rinus van Kalmthout')).toBe('Rinus VeeKay')

    // 5. Raffaele Marciello ↔ Lello Marciello
    const resMarciello1 = resolveDriverPhoto({ name: 'Raffaele Marciello' })
    const resMarciello2 = resolveDriverPhoto({ name: 'Lello Marciello' })
    expect(resMarciello1.url).toBe('/pilotos/DRV_0172.jpg')
    expect(resMarciello2.url).toBe('/pilotos/DRV_0172.jpg')
    expect(getCanonicalDisplayName('Lello Marciello')).toBe('Raffaele Marciello')

    // 6. Checagem anti-duplicação: nenhum arquivo com prefixo duplicado DRV_DRV_0170..0179 existe
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    for (let i = 170; i <= 179; i++) {
      const dupPrefixFile = `DRV_DRV_0${i}.jpg`
      const dupPath = path.resolve(pilotosDir, dupPrefixFile)
      expect(fs.existsSync(dupPath), `Arquivo duplicado ${dupPrefixFile} não deve existir`).toBe(
        false,
      )
    }
  })

  // CP6-04: nenhum cai em fallback_initials se o arquivo existe
  it('CP6-04: nenhum cai em fallback_initials quando o arquivo existe', () => {
    for (const item of CP6_MAPPINGS) {
      const resolved = resolveDriverPhoto({ name: item.name })
      expect(resolved.sourceType).not.toBe('fallback_initials')
      expect(resolved.sourceType).toBe('canonical_real')
      expect(resolved.assetId).toBe(item.expectedAsset)
      expect(resolved.url).toBe(`/pilotos/${item.expectedFile}`)
    }
  })
})
