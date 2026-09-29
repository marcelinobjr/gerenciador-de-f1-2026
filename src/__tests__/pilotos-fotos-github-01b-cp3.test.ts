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
 * Suite de Testes Focada: PILOTOS-FOTOS-GITHUB-01B-CP3
 *
 * Bloco 1 - Próximos 10 Pilotos Canônicos Mapeados (Dries Vanthoor a Gabriele Mini):
 * 21. Dries Vanthoor -> DRV_0145.jpg
 * 22. Earl Bamber -> DRV_0146.jpg
 * 23. Edoardo Mortara -> DRV_0090.jpg
 * 24. Ella Lloyd -> DRV_0091.jpg
 * 25. Ella Stevens -> DRV_0147.jpg
 * 26. Emerson Fittipaldi Jr. -> DRV_0148.jpg
 * 27. Emma Felbermayr -> DRV_0010.jpg
 * 28. Enzo Fittipaldi -> DRV_0149.jpg
 * 29. Esmee Kosterman -> DRV_0092.jpg
 * 30. Gabriele Mini -> DRV_0013.jpg
 */

describe('PILOTOS-FOTOS-GITHUB-01B-CP3: Próximos 10 Mappings Canônicos (Dries Vanthoor a Gabriele Mini)', () => {
  const CP3_MAPPINGS = [
    { name: 'Dries Vanthoor', expectedAsset: 'DRV_0145', expectedFile: 'DRV_0145.jpg' },
    { name: 'Earl Bamber', expectedAsset: 'DRV_0146', expectedFile: 'DRV_0146.jpg' },
    { name: 'Edoardo Mortara', expectedAsset: 'DRV_0090', expectedFile: 'DRV_0090.jpg' },
    { name: 'Ella Lloyd', expectedAsset: 'DRV_0091', expectedFile: 'DRV_0091.jpg' },
    { name: 'Ella Stevens', expectedAsset: 'DRV_0147', expectedFile: 'DRV_0147.jpg' },
    { name: 'Emerson Fittipaldi Jr.', expectedAsset: 'DRV_0148', expectedFile: 'DRV_0148.jpg' },
    { name: 'Emma Felbermayr', expectedAsset: 'DRV_0010', expectedFile: 'DRV_0010.jpg' },
    { name: 'Enzo Fittipaldi', expectedAsset: 'DRV_0149', expectedFile: 'DRV_0149.jpg' },
    { name: 'Esmee Kosterman', expectedAsset: 'DRV_0092', expectedFile: 'DRV_0092.jpg' },
    { name: 'Gabriele Mini', expectedAsset: 'DRV_0013', expectedFile: 'DRV_0013.jpg' },
  ] as const

  // CP3-01: todos os 10 retornam path não vazio
  it('CP3-01: todos os 10 retornam path não vazio', () => {
    expect(CP3_MAPPINGS).toHaveLength(10)
    for (const item of CP3_MAPPINGS) {
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

  // CP3-02: todos os arquivos existem em public/pilotos/ com payload válido
  it('CP3-02: todos os arquivos existem em public/pilotos/ com payload válido', () => {
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    const dirExists = fs.existsSync(pilotosDir)
    expect(dirExists, 'Diretório public/pilotos deve existir').toBe(true)

    for (const item of CP3_MAPPINGS) {
      const filePath = path.resolve(pilotosDir, item.expectedFile)
      const fileExists = fs.existsSync(filePath)
      expect(fileExists, `Arquivo físico ${item.expectedFile} deve existir em public/pilotos`).toBe(
        true,
      )

      const stat = fs.statSync(filePath)
      expect(stat.size, `Arquivo ${item.expectedFile} não pode ser vazio`).toBeGreaterThan(100)
    }
  })

  // CP3-03: Gabriele Mini e Gabriele Minì retornam a mesma foto (DRV_0013)
  it('CP3-03: Gabriele Mini e Gabriele Minì retornam a mesma foto (DRV_0013)', () => {
    const resMini = resolveDriverPhoto({ name: 'Gabriele Mini' })
    const resMiniAccented = resolveDriverPhoto({ name: 'Gabriele Minì' })

    expect(resMini.url).toBe('/pilotos/DRV_0013.jpg')
    expect(resMiniAccented.url).toBe('/pilotos/DRV_0013.jpg')
    expect(resMini.url).toBe(resMiniAccented.url)
    expect(resMini.assetId).toBe('DRV_0013')
    expect(resMiniAccented.assetId).toBe('DRV_0013')

    expect(getDriverCanonicalKey('Gabriele Mini')).toBe(getDriverCanonicalKey('Gabriele Minì'))
    expect(getCanonicalDisplayName('Gabriele Minì')).toBe('Gabriele Mini')

    const pathDirect1 = resolveCanonicalDriverImagePath(null, 'Gabriele Mini')
    const pathDirect2 = resolveCanonicalDriverImagePath(null, 'Gabriele Minì')
    expect(pathDirect1).toBe('/pilotos/DRV_0013.jpg')
    expect(pathDirect2).toBe('/pilotos/DRV_0013.jpg')
  })

  // CP3-04: nenhum dos 10 cai em placeholder/fallback genérico
  it('CP3-04: nenhum dos 10 cai em placeholder/fallback genérico', () => {
    for (const item of CP3_MAPPINGS) {
      const resolved = resolveDriverPhoto({ name: item.name })
      expect(resolved.sourceType).not.toBe('fallback_initials')
      expect(resolved.sourceType).toBe('canonical_real')
      expect(resolved.url).not.toBeNull()
      expect(resolved.url).toBe(`/pilotos/${item.expectedFile}`)
      expect(resolved.assetId).toBe(item.expectedAsset)

      const canonicalKey = getDriverCanonicalKey(item.name)
      expect(canonicalKey, `Chave canônica gerada para ${item.name}`).toBeTruthy()

      const pathWithoutId = resolveCanonicalDriverImagePath(null, item.name)
      expect(pathWithoutId).toBe(`/pilotos/${item.expectedFile}`)
    }
  })
})
