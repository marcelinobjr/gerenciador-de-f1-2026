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
 * Suite de Testes Focada: PILOTOS-FOTOS-GITHUB-01B-CP1
 * 
 * Bloco 1 - Primeiros 10 Pilotos Canônicos Mapeados:
 * 1. Alba Hurup Larsen -> DRV_0001.jpg
 * 2. Alessandro Pier Guidi -> DRV_0081.jpg
 * 3. Alex Dunne -> DRV_0042.jpg
 * 4. Alex Lynn -> DRV_0138.jpg
 * 5. Alisha Palmowski -> DRV_0082.jpg
 * 6. Amauri Cordell -> DRV_0083.jpg
 * 7. Antonio Fuoco -> DRV_0084.jpg
 * 8. Ava Dobson -> DRV_0086.jpg
 * 9. Brad Keselowiski -> DRV_0004.jpg
 * 10. Callum Hedge -> DRV_0088.jpg
 */

describe('PILOTOS-FOTOS-GITHUB-01B-CP1: Primeiros 10 Mappings Canônicos', () => {
  const CP1_MAPPINGS = [
    { name: 'Alba Hurup Larsen', expectedAsset: 'DRV_0001', expectedFile: 'DRV_0001.jpg' },
    { name: 'Alessandro Pier Guidi', expectedAsset: 'DRV_0081', expectedFile: 'DRV_0081.jpg' },
    { name: 'Alex Dunne', expectedAsset: 'DRV_0042', expectedFile: 'DRV_0042.jpg' },
    { name: 'Alex Lynn', expectedAsset: 'DRV_0138', expectedFile: 'DRV_0138.jpg' },
    { name: 'Alisha Palmowski', expectedAsset: 'DRV_0082', expectedFile: 'DRV_0082.jpg' },
    { name: 'Amauri Cordell', expectedAsset: 'DRV_0083', expectedFile: 'DRV_0083.jpg' },
    { name: 'Antonio Fuoco', expectedAsset: 'DRV_0084', expectedFile: 'DRV_0084.jpg' },
    { name: 'Ava Dobson', expectedAsset: 'DRV_0086', expectedFile: 'DRV_0086.jpg' },
    { name: 'Brad Keselowiski', expectedAsset: 'DRV_0004', expectedFile: 'DRV_0004.jpg' },
    { name: 'Callum Hedge', expectedAsset: 'DRV_0088', expectedFile: 'DRV_0088.jpg' },
  ] as const

  // CP1-01: todos retornam path não vazio
  it('CP1-01: todos os 10 pilotos retornam path não vazio', () => {
    expect(CP1_MAPPINGS).toHaveLength(10)
    for (const item of CP1_MAPPINGS) {
      const resolved = resolveDriverPhoto({ name: item.name })
      expect(resolved.url, `Path não vazio para ${item.name}`).toBeTruthy()
      expect(resolved.url).toBe(`/pilotos/${item.expectedFile}`)
      expect(resolved.sourceType).toBe('canonical_real')

      const canonicalPath = resolveCanonicalDriverImagePath(null, item.name)
      expect(canonicalPath, `Path canônico não vazio para ${item.name}`).toBe(`/pilotos/${item.expectedFile}`)
    }
  })

  // CP1-02: todos os arquivos existem (verificação real, não placeholder)
  it('CP1-02: todos os arquivos existem na pasta local public/pilotos', () => {
    const pilotosDir = path.resolve(process.cwd(), 'public', 'pilotos')
    const dirExists = fs.existsSync(pilotosDir)
    expect(dirExists, 'Diretório public/pilotos deve existir').toBe(true)

    for (const item of CP1_MAPPINGS) {
      const filePath = path.resolve(pilotosDir, item.expectedFile)
      const fileExists = fs.existsSync(filePath)
      expect(fileExists, `Arquivo físico ${item.expectedFile} deve existir em public/pilotos`).toBe(true)

      const stat = fs.statSync(filePath)
      expect(stat.size, `Arquivo ${item.expectedFile} não pode ser vazio`).toBeGreaterThan(100)
    }
  })

  // CP1-03: Alex Dunne e Alexander Dunne retornam a mesma foto
  it('CP1-03: Alex Dunne e Alexander Dunne retornam a mesma foto', () => {
    const resAlex = resolveDriverPhoto({ name: 'Alex Dunne' })
    const resAlexander = resolveDriverPhoto({ name: 'Alexander Dunne' })

    expect(resAlex.url).toBe('/pilotos/DRV_0042.jpg')
    expect(resAlexander.url).toBe('/pilotos/DRV_0042.jpg')
    expect(resAlex.url).toBe(resAlexander.url)
    expect(resAlex.assetId).toBe('DRV_0042')
    expect(resAlexander.assetId).toBe('DRV_0042')

    // Chave canônica unificada
    const keyAlex = getDriverCanonicalKey('Alex Dunne')
    const keyAlexander = getDriverCanonicalKey('Alexander Dunne')
    expect(keyAlex).toBe(keyAlexander)
    expect(getCanonicalDisplayName('Alex Dunne')).toBe('Alexander Dunne')
  })

  // CP1-04: nenhum cai em placeholder
  it('CP1-04: nenhum dos 10 pilotos cai em fallback_initials ou placeholder', () => {
    for (const item of CP1_MAPPINGS) {
      const resolved = resolveDriverPhoto({ name: item.name })
      expect(resolved.sourceType).not.toBe('fallback_initials')
      expect(resolved.url).not.toBeNull()
      expect(resolved.url).toMatch(/^\/pilotos\/DRV_\d{4}\.jpg$/)
      expect(resolved.assetId).toBe(item.expectedAsset)
    }
  })
})
