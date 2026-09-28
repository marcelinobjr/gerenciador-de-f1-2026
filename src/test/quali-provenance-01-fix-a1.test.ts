import { describe, it, expect } from 'vitest'
import { calculateQualifyingRatingDeltaMs } from '@/lib/race/pureRaceEngine'

describe('QUALI-PROVENANCE-01-FIX-A1: Núcleo Matemático Canônico Min-Max', () => {
  // QFIX-A1-01 — MAX RATING: rating = maxRating -> esperado 0 ms
  it('QFIX-A1-01 — MAX RATING: rating = maxRating -> esperado 0 ms', () => {
    const delta = calculateQualifyingRatingDeltaMs({
      rating: 95,
      minRating: 70,
      maxRating: 95,
      spreadMs: 2500,
    })
    expect(delta).toBe(0)
  })

  // QFIX-A1-02 — MIN RATING: rating = minRating, spreadMs = 2500 -> esperado 2500 ms
  it('QFIX-A1-02 — MIN RATING: rating = minRating, spreadMs = 2500 -> esperado 2500 ms', () => {
    const delta = calculateQualifyingRatingDeltaMs({
      rating: 70,
      minRating: 70,
      maxRating: 95,
      spreadMs: 2500,
    })
    expect(delta).toBe(2500)
  })

  // QFIX-A1-03 — MID RATING: rating exatamente no meio -> esperado 1250 ms
  it('QFIX-A1-03 — MID RATING: rating exatamente no meio -> esperado 1250 ms', () => {
    const delta = calculateQualifyingRatingDeltaMs({
      rating: 82.5,
      minRating: 70,
      maxRating: 95,
      spreadMs: 2500,
    })
    expect(delta).toBeCloseTo(1250, 5)
  })

  // QFIX-A1-04 — RATINGS IGUAIS: maxRating == minRating -> esperado 0 ms, sem NaN, sem Infinity, sem exception inesperada
  it('QFIX-A1-04 — RATINGS IGUAIS: maxRating == minRating -> esperado 0 ms, sem NaN, sem Infinity, sem exception inesperada', () => {
    const delta = calculateQualifyingRatingDeltaMs({
      rating: 85,
      minRating: 85,
      maxRating: 85,
      spreadMs: 2500,
    })
    expect(delta).toBe(0)
    expect(Number.isNaN(delta)).toBe(false)
    expect(Number.isFinite(delta)).toBe(true)
  })

  // QFIX-A1-05 — SPREAD CONFIGURÁVEL: spreadMs = 1000, pior rating -> 1000 ms. Provar que a função não hardcoda 2500
  it('QFIX-A1-05 — SPREAD CONFIGURÁVEL: spreadMs = 1000, pior rating -> 1000 ms (sem hardcode 2500)', () => {
    const delta = calculateQualifyingRatingDeltaMs({
      rating: 60,
      minRating: 60,
      maxRating: 90,
      spreadMs: 1000,
    })
    expect(delta).toBe(1000)
    expect(delta).not.toBe(2500)
  })

  // QFIX-A1-06 — REGRESSÃO CONTRA ×35: escolher inputs onde min-max e (100-rating)×35 produzam valores claramente diferentes. Assertar explicitamente o valor min-max correto.
  it('QFIX-A1-06 — REGRESSÃO CONTRA ×35: impede retorno futuro do modelo (100-rating)×35', () => {
    // Cenário com grid real: maxRating = 90, minRating = 70, spreadMs = 2500.
    // Avaliando piloto com rating = 70 (pior do grid):
    // Min-Max canônico: (90 - 70) / (90 - 70) * 2500 = 2500 ms
    // Modelo divergente x35: (100 - 70) * 35 = 1050 ms
    // Diferença líquida entre min e max no modelo x35: (100-70)*35 - (100-90)*35 = 1050 - 350 = 700 ms (divergência brutal de 1800 ms!)
    const minMaxDeltaWorst = calculateQualifyingRatingDeltaMs({
      rating: 70,
      minRating: 70,
      maxRating: 90,
      spreadMs: 2500,
    })
    const divergentX35DeltaWorst = (100 - 70) * 35 // 1050 ms

    expect(minMaxDeltaWorst).toBe(2500)
    expect(minMaxDeltaWorst).not.toBe(divergentX35DeltaWorst)
    expect(Math.abs(minMaxDeltaWorst - divergentX35DeltaWorst)).toBe(1450)

    // Avaliando piloto mediano com rating = 80:
    // Min-Max canônico: (90 - 80) / (90 - 70) * 2500 = 0.5 * 2500 = 1250 ms
    // Modelo divergente x35: (100 - 80) * 35 = 700 ms
    const minMaxDeltaMid = calculateQualifyingRatingDeltaMs({
      rating: 80,
      minRating: 70,
      maxRating: 90,
      spreadMs: 2500,
    })
    const divergentX35DeltaMid = (100 - 80) * 35 // 700 ms

    expect(minMaxDeltaMid).toBe(1250)
    expect(minMaxDeltaMid).not.toBe(divergentX35DeltaMid)
    expect(Math.abs(minMaxDeltaMid - divergentX35DeltaMid)).toBe(550)
  })
})
