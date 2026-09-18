import { describe, it, expect } from 'vitest'
import {
  CAR_PART_ASSETS,
  normalizeCarPartType,
  getCarPartPhoto,
  getCarPartFallbackSvg,
  CarPartType,
} from '@/data/assets/carPartAssets'
import {
  DRIVER_ASSET_MANIFEST,
  getDriverImage,
  getDriverPhoto,
  normalizeDriverKey,
} from '@/data/assets/driverAssets'
import { getDriverPhotoSources } from '@/lib/driver-photos'
import { getLocalDriverPosterCandidates } from '@/lib/pilot-posters'

describe('MICRO-PATCH v0.0.280 — Assets de Componentes do Carro (6/6)', () => {
  const allSixParts: CarPartType[] = [
    'frontWing',
    'rearWing',
    'floor',
    'sidepods',
    'engine',
    'suspension',
  ]

  it('todos os 6 componentes possuem fotos locais válidas empacotadas no Vite bundle', () => {
    for (const part of allSixParts) {
      const asset = CAR_PART_ASSETS[part]
      expect(asset).toBeDefined()
      expect(asset.photoUrl).toBeDefined()
      expect(typeof asset.photoUrl).toBe('string')
      expect(asset.photoUrl!.length).toBeGreaterThan(0)
      // O path empacotado não pode ser um path quebrado estático inexistente em public
      expect(asset.photoUrl).not.toContain('/assets/car-parts/')
      // Deve resolver para string de import do Vite
      expect(asset.photoUrl).toMatch(/\.(png|jpg|jpeg|webp)($|\?)/i)
    }
  })

  it('getCarPartPhoto resolve imagem válida para qualquer uma das 6 chaves', () => {
    for (const part of allSixParts) {
      const photo = getCarPartPhoto(part)
      expect(photo).toBeTruthy()
      expect(typeof photo).toBe('string')
      expect(photo).toBe(CAR_PART_ASSETS[part].photoUrl)
    }
  })

  it('getCarPartPhoto resolve aliases em português para as novas peças', () => {
    expect(getCarPartPhoto('Laterais')).toBe(CAR_PART_ASSETS.sidepods.photoUrl)
    expect(getCarPartPhoto('sidepod')).toBe(CAR_PART_ASSETS.sidepods.photoUrl)
    expect(getCarPartPhoto('Motor')).toBe(CAR_PART_ASSETS.engine.photoUrl)
    expect(getCarPartPhoto('Unidade de Potência')).toBe(CAR_PART_ASSETS.engine.photoUrl)
    expect(getCarPartPhoto('PU')).toBe(CAR_PART_ASSETS.engine.photoUrl)
    expect(getCarPartPhoto('Suspensão')).toBe(CAR_PART_ASSETS.suspension.photoUrl)
    expect(getCarPartPhoto('suspensao')).toBe(CAR_PART_ASSETS.suspension.photoUrl)
  })

  it('fallback vetorial SVG permanece disponível e limpo como Data URL', () => {
    for (const part of allSixParts) {
      const svg = getCarPartFallbackSvg(part)
      expect(svg).toContain('data:image/svg+xml')
      expect(svg).toContain('%3Csvg')
    }
  })
})

describe('MICRO-PATCH v0.0.280 — Resolução Canônica da Foto do Nico Hülkenberg', () => {
  it('DRIVER_ASSET_MANIFEST possui entrada para hulkenberg com suporte a acento e id canônico', () => {
    const hulkenberg = DRIVER_ASSET_MANIFEST.hulkenberg
    expect(hulkenberg).toBeDefined()
    expect(hulkenberg.name).toBe('Nico Hülkenberg')
    expect(hulkenberg.fallbackDriveKey).toBe('27-Nuco_Hulkemberg.jpg')
    expect(hulkenberg.aliases).toContain('nico hülkenberg')
    expect(hulkenberg.aliases).toContain('nico hulkenberg')
  })

  it('normalizeDriverKey resolve variações com trema/umlaut, sem acento, por id ou por nome', () => {
    expect(normalizeDriverKey('Nico Hülkenberg')).toBe('hulkenberg')
    expect(normalizeDriverKey('Nico Hulkenberg')).toBe('hulkenberg')
    expect(normalizeDriverKey('Hülkenberg')).toBe('hulkenberg')
    expect(normalizeDriverKey('Hulkenberg')).toBe('hulkenberg')
    expect(normalizeDriverKey('nico_hulkenberg')).toBe('hulkenberg')
    expect(normalizeDriverKey('mbj-019')).toBe('hulkenberg')
    expect(normalizeDriverKey('drv_hulkenberg')).toBe('hulkenberg')
  })

  it('getDriverImage resolve URL válida para Nico Hülkenberg (via fallbackDriveKey e CDN Google Photos)', () => {
    const urlFromUmlaut = getDriverImage('Nico Hülkenberg')
    expect(urlFromUmlaut).toBeTruthy()
    expect(typeof urlFromUmlaut).toBe('string')
    expect(urlFromUmlaut).toContain('googleusercontent.com')

    const urlFromPlain = getDriverImage('Nico Hulkenberg')
    expect(urlFromPlain).toBe(urlFromUmlaut)

    const urlFromId = getDriverImage('nico_hulkenberg')
    expect(urlFromId).toBe(urlFromUmlaut)
  })

  it('getDriverPhotoSources e poster candidates fornecem URL válida para Hülkenberg sem quebra', () => {
    const sources = getDriverPhotoSources('Nico Hülkenberg')
    expect(sources.normalizedKey).toBe('hulkenberg')
    expect(sources.dropboxUrl).toBeTruthy()

    const candidates = getLocalDriverPosterCandidates('Nico Hülkenberg')
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.some((c) => c.includes('googleusercontent.com'))).toBe(true)
  })
})
