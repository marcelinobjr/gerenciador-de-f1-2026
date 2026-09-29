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
 * Suite de Testes Dedicada: BLOCO B (PILOTOS-FOTOS-GITHUB-01B)
 *
 * Pilotos do Bloco 1 mapeados e validados:
 * Alba Hurup Larsen -> DRV_0001.jpg
 * Alessandro Pier Guidi -> DRV_0081.jpg
 * Alex Dunne -> DRV_0042.jpg
 * Alex Lynn -> DRV_0138.jpg
 * Alisha Palmowski -> DRV_0082.jpg
 * Amauri Cordell -> DRV_0083.jpg
 * Antonio Fuoco -> DRV_0084.jpg
 * Ava Dobson -> DRV_0086.jpg
 * Brad Keselowiski -> DRV_0004.jpg
 * Callum Hedge -> DRV_0088.jpg
 * Callum Llott -> DRV_0139.jpg
 * Callum Voisin -> DRV_0140.jpg
 * Chase Elliott -> DRV_0006.jpg
 * Christian Mansell -> DRV_0141.jpg
 * Christopher Bell -> DRV_0048.jpg
 * Connor de Phillippi -> DRV_0142.jpg
 * Dane Cameron -> DRV_0143.jpg
 * Daniil Kvyat -> DRV_0136.jpg
 * Dennis Hauger -> DRV_0144.jpg
 * Denny Hamlin -> DRV_0051.jpg
 * Dries Vanthoor -> DRV_0145.jpg
 * Earl Bamber -> DRV_0146.jpg
 * Edoardo Mortara -> DRV_0090.jpg
 * Ella Lloyd -> DRV_0091.jpg
 * Ella Stevens -> DRV_0147.jpg
 * Emerson Fittipaldi Jr. -> DRV_0148.jpg
 * Emma Felbermayr -> DRV_0010.jpg
 * Enzo Fittipaldi -> DRV_0149.jpg
 * Esmee Kosterman -> DRV_0092.jpg
 * Gabriele Mini -> DRV_0013.jpg
 * Helio Castroneves -> DRV_0151.jpg
 * Freddie Slater -> DRV_0150.jpg
 */

describe('PIL-GH-B: Pilotos Fotos Github Bloco 1 Acceptance Tests', () => {
  const BLOCK_1_DRIVERS = [
    { name: 'Alba Hurup Larsen', expectedAsset: 'DRV_0001' },
    { name: 'Alessandro Pier Guidi', expectedAsset: 'DRV_0081' },
    { name: 'Alex Dunne', expectedAsset: 'DRV_0042' },
    { name: 'Alex Lynn', expectedAsset: 'DRV_0138' },
    { name: 'Alisha Palmowski', expectedAsset: 'DRV_0082' },
    { name: 'Amauri Cordell', expectedAsset: 'DRV_0083' },
    { name: 'Antonio Fuoco', expectedAsset: 'DRV_0084' },
    { name: 'Ava Dobson', expectedAsset: 'DRV_0086' },
    { name: 'Brad Keselowiski', expectedAsset: 'DRV_0004' },
    { name: 'Callum Hedge', expectedAsset: 'DRV_0088' },
    { name: 'Callum Llott', expectedAsset: 'DRV_0139' },
    { name: 'Callum Voisin', expectedAsset: 'DRV_0140' },
    { name: 'Chase Elliott', expectedAsset: 'DRV_0006' },
    { name: 'Christian Mansell', expectedAsset: 'DRV_0141' },
    { name: 'Christopher Bell', expectedAsset: 'DRV_0048' },
    { name: 'Connor de Phillippi', expectedAsset: 'DRV_0142' },
    { name: 'Dane Cameron', expectedAsset: 'DRV_0143' },
    { name: 'Daniil Kvyat', expectedAsset: 'DRV_0136' },
    { name: 'Dennis Hauger', expectedAsset: 'DRV_0144' },
    { name: 'Denny Hamlin', expectedAsset: 'DRV_0051' },
    { name: 'Dries Vanthoor', expectedAsset: 'DRV_0145' },
    { name: 'Earl Bamber', expectedAsset: 'DRV_0146' },
    { name: 'Edoardo Mortara', expectedAsset: 'DRV_0090' },
    { name: 'Ella Lloyd', expectedAsset: 'DRV_0091' },
    { name: 'Ella Stevens', expectedAsset: 'DRV_0147' },
    { name: 'Emerson Fittipaldi Jr.', expectedAsset: 'DRV_0148' },
    { name: 'Emma Felbermayr', expectedAsset: 'DRV_0010' },
    { name: 'Enzo Fittipaldi', expectedAsset: 'DRV_0149' },
    { name: 'Esmee Kosterman', expectedAsset: 'DRV_0092' },
    { name: 'Gabriele Mini', expectedAsset: 'DRV_0013' },
    { name: 'Helio Castroneves', expectedAsset: 'DRV_0151' },
    { name: 'Freddie Slater', expectedAsset: 'DRV_0150' },
  ]

  // PIL-GH-B-01: todos os pilotos do bloco 1 resolvem para path não vazio
  it('PIL-GH-B-01: todos os pilotos do bloco 1 resolvem para path não vazio', () => {
    for (const driver of BLOCK_1_DRIVERS) {
      const resolved = resolveDriverPhoto({ name: driver.name })
      expect(resolved.url, `Path não vazio para ${driver.name}`).toBeTruthy()
      expect(resolved.url).toMatch(new RegExp(`/pilotos/${driver.expectedAsset}\\.jpg`))
    }
  })

  // PIL-GH-B-02: todos os paths resolvidos existem no filesystem local consumido pela app se presente
  it('PIL-GH-B-02: todos os paths resolvidos possuem formato de asset canônico válido', () => {
    for (const driver of BLOCK_1_DRIVERS) {
      const direct = resolveCanonicalDriverImagePath(null, driver.name)
      expect(direct).toBe(`/pilotos/${driver.expectedAsset}.jpg`)

      // Se o diretório public/pilotos existir localmente, verificar existência física
      const localPath = path.resolve(process.cwd(), 'public', direct.replace(/^\//, ''))
      if (fs.existsSync(path.resolve(process.cwd(), 'public', 'pilotos'))) {
        expect(fs.existsSync(localPath), `Arquivo físico existe: ${localPath}`).toBe(true)
      }
    }
  })

  // PIL-GH-B-03: Alex Dunne/Alexander Dunne retornam a mesma foto
  it('PIL-GH-B-03: Alex Dunne e Alexander Dunne retornam a mesma foto', () => {
    const resAlex = resolveDriverPhoto({ name: 'Alex Dunne' })
    const resAlexander = resolveDriverPhoto({ name: 'Alexander Dunne' })
    expect(resAlex.url).toBe('/pilotos/DRV_0042.jpg')
    expect(resAlexander.url).toBe('/pilotos/DRV_0042.jpg')
    expect(resAlex.url).toBe(resAlexander.url)

    expect(getDriverCanonicalKey('Alex Dunne')).toBe(getDriverCanonicalKey('Alexander Dunne'))
    expect(getCanonicalDisplayName('Alex Dunne')).toBe('Alexander Dunne')
  })

  // PIL-GH-B-04: Gabriele Mini/Minì retornam a mesma foto
  it('PIL-GH-B-04: Gabriele Mini e Gabriele Minì retornam a mesma foto', () => {
    const resMini = resolveDriverPhoto({ name: 'Gabriele Mini' })
    const resMiniAcc = resolveDriverPhoto({ name: 'Gabriele Minì' })
    expect(resMini.url).toBe('/pilotos/DRV_0013.jpg')
    expect(resMiniAcc.url).toBe('/pilotos/DRV_0013.jpg')
    expect(resMini.url).toBe(resMiniAcc.url)

    expect(getDriverCanonicalKey('Gabriele Mini')).toBe(getDriverCanonicalKey('Gabriele Minì'))
  })

  // PIL-GH-B-05: nenhum piloto do bloco 1 cai em placeholder se o arquivo existe
  it('PIL-GH-B-05: nenhum piloto do bloco 1 cai em fallback_initials se mapeado', () => {
    for (const driver of BLOCK_1_DRIVERS) {
      const resolved = resolveDriverPhoto({ name: driver.name })
      expect(resolved.sourceType).toBe('canonical_real')
      expect(resolved.url).not.toBeNull()
      expect(resolved.assetId).toBe(driver.expectedAsset)
    }
  })

  // PIL-GH-B-06: Freddie Slater resolve para o filename REAL encontrado no GitHub
  it('PIL-GH-B-06: Freddie Slater resolve para DRV_0150.jpg', () => {
    const resSlater = resolveDriverPhoto({ name: 'Freddie Slater' })
    expect(resSlater.url).toBe('/pilotos/DRV_0150.jpg')
    expect(resSlater.assetId).toBe('DRV_0150')
    expect(resSlater.sourceType).toBe('canonical_real')

    // Suporta também variação drvdrv0150 caso requisitada
    const directSlater = resolveCanonicalDriverImagePath(null, 'Freddie Slater')
    expect(directSlater).toBe('/pilotos/DRV_0150.jpg')
  })
})
