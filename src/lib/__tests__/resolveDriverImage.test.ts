import { describe, it, expect } from 'vitest'
import {
  hashDriverId,
  getGeneratedDriverImageIndex,
  getGeneratedDriverImagePath,
  resolveDriverImage,
} from '@/lib/resolveDriverImage'

describe('resolveDriverImage test suite', () => {
  it('hashDriverId é determinístico e estável', () => {
    const hash1 = hashDriverId('mbj-custom-01')
    const hash2 = hashDriverId('mbj-custom-01')
    expect(hash1).toBe(hash2)
  })

  it('getGeneratedDriverImageIndex retorna índice entre 1 e 39', () => {
    for (let i = 0; i < 100; i++) {
      const idx = getGeneratedDriverImageIndex(`mbj-newgen-${i}`)
      expect(idx).toBeGreaterThanOrEqual(1)
      expect(idx).toBeLessThanOrEqual(39)
    }
  })

  it('getGeneratedDriverImagePath formata corretamente com pad de 2 dígitos', () => {
    expect(getGeneratedDriverImagePath(1)).toBe('/pilotos-gerados/Piloto_01.jpg')
    expect(getGeneratedDriverImagePath(9)).toBe('/pilotos-gerados/Piloto_09.jpg')
    expect(getGeneratedDriverImagePath(10)).toBe('/pilotos-gerados/Piloto_10.jpg')
    expect(getGeneratedDriverImagePath(39)).toBe('/pilotos-gerados/Piloto_39.jpg')
  })

  it('pilotos reais retornam null', () => {
    expect(resolveDriverImage({ id: 'mbj-001', name: 'Max Verstappen', isReal: true })).toBe(null)
    expect(resolveDriverImage({ id: 'mbj-004', name: 'Lando Norris', isReal: true })).toBe(null)
    expect(resolveDriverImage({ id: 'mbj-020', name: 'Gabriel Bortoleto', isReal: true })).toBe(
      null,
    )
  })

  it('pilotos fictícios retornam path gerado', () => {
    const img1 = resolveDriverImage({ id: 'mbj-gen-01', name: 'Piloto Teste', isGenerated: true })
    expect(img1).toMatch(/^\/pilotos-gerados\/Piloto_\d{2}\.jpg$/)
  })
})
