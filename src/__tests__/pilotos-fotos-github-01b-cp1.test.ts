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
 * Suite de Testes Mínima — CP1: Primeiros 10 mappings de fotos de pilotos
 * Bloco 1 (PILOTOS-FOTOS-GITHUB-01B-CP1)
 *
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

describe('PILOTOS-FOTOS-GITHUB-01B-CP1: Primeiros 10 mappings de foto', () => {
  const CP1_DRIVERS = [
    { name: 'Alba Hurup Larsen', expectedAsset: 'DRV_0001.jpg' },
    { name: 'Alessandro Pier Guidi', expectedAsset: 'DRV_0081.jpg' },
    { name: 'Alex Dunne', expectedAsset: 'DRV_0042.jpg' },
    { name: 'Alex Lynn', expectedAsset: 'DRV_0138.jpg' },
    { name: 'Alisha Palmowski', expectedAsset: 'DRV_0082.jpg' },
    { name: 'Amauri Cordell', expectedAsset: 'DRV_0083.jpg' },
    { name: 'Antonio Fuoco', expectedAsset: 'DRV_0084.jpg' },
    { name: 'Ava Dobson', expectedAsset: 'DRV_0086.jpg' },
    { name: 'Brad Keselowiski', expectedAsset: 'DRV_0004.jpg' },
    { name: 'Callum Hedge', expectedAsset: 'DRV_0088.jpg' },
  ]

  // CP1-01: todos retornam path não vazio
  it('CP1-01: todos os 10 pilotos retornam path não vazio', () => {
    for (const driver of CP1_DRIVERS) {
      const resolved = resolveDriverPhoto({ name: driver.name })
      expect(resolved.url, `Path não vazio para ${driver.name}`).toBeTruthy()
      expect(resolved.url).toBe(`/pilotos/${driver.expectedAsset}`)

      const direct = resolveCanonicalDriverImagePath(null, driver.name)
      expect(direct, `Direct path não vazio para ${driver.name}`).toBe(
        `/pilotos/${driver.expectedAsset}`,
      )
    }
  })

  // CP1-02: todos os arquivos existem (verificação real, formato e filesystem se presente)
  it('CP1-02: todos os arquivos possuem path válido e existem fisicamente se public/pilotos estiver montado', () => {
    for (const driver of CP1_DRIVERS) {
      const direct = resolveCanonicalDriverImagePath(null, driver.name)
      expect(direct).toBe(`/pilotos/${driver.expectedAsset}`)
      expect(direct?.endsWith('.jpg')).toBe(true)

      const localDir = path.resolve(process.cwd(), 'public', 'pilotos')
      if (fs.existsSync(localDir)) {
        const filePath = path.resolve(localDir, driver.expectedAsset)
        expect(fs.existsSync(filePath), `Arquivo real existe em disco: ${filePath}`).toBe(true)
      }
    }
  })

  // CP1-03: Alex Dunne e Alexander Dunne retornam a mesma foto
  it('CP1-03: Alex Dunne e Alexander Dunne retornam a MESMA identidade canônica e foto DRV_0042.jpg', () => {
    const resAlex = resolveDriverPhoto({ name: 'Alex Dunne' })
    const resAlexander = resolveDriverPhoto({ name: 'Alexander Dunne' })

    expect(resAlex.url).toBe('/pilotos/DRV_0042.jpg')
    expect(resAlexander.url).toBe('/pilotos/DRV_0042.jpg')
    expect(resAlex.url).toBe(resAlexander.url)

    // Verifica que usam a mesma chave canônica do driver-canonical-service
    expect(getDriverCanonicalKey('Alex Dunne')).toBe('alexanderdunne')
    expect(getDriverCanonicalKey('Alexander Dunne')).toBe('alexanderdunne')
    expect(getDriverCanonicalKey('Alex Dunne')).toBe(getDriverCanonicalKey('Alexander Dunne'))

    // Display name unificado
    expect(getCanonicalDisplayName('Alex Dunne')).toBe('Alexander Dunne')
    expect(getCanonicalDisplayName('Alexander Dunne')).toBe('Alexander Dunne')
  })

  // CP1-04: nenhum cai em placeholder
  it('CP1-04: nenhum dos 10 pilotos cai em fallback_initials ou placeholder', () => {
    for (const driver of CP1_DRIVERS) {
      const resolved = resolveDriverPhoto({ name: driver.name })
      expect(resolved.sourceType).toBe('canonical_real')
      expect(resolved.url).not.toBeNull()
      expect(resolved.url).toBe(`/pilotos/${driver.expectedAsset}`)
      expect(resolved.assetId).toBe(driver.expectedAsset.replace('.jpg', ''))
    }
  })
})
