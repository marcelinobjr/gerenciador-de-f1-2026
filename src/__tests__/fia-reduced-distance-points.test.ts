import { describe, it, expect } from 'vitest'
import { calculateFiaPoints } from '@/lib/f1-standings-calculator'
import { canonicalRaceResultService } from '@/services/canonicalRaceResultService'

describe('Regra FIA de distância reduzida (calculateFiaPoints)', () => {
  const totalLaps = 50

  it('Menos de 2 voltas: 0 pontos para todos', () => {
    // 0 voltas
    expect(calculateFiaPoints(1, 0, totalLaps)).toBe(0)
    expect(calculateFiaPoints(10, 0, totalLaps)).toBe(0)
    // 1 volta
    expect(calculateFiaPoints(1, 1, totalLaps)).toBe(0)
    expect(calculateFiaPoints(2, 1, totalLaps)).toBe(0)
    expect(calculateFiaPoints(5, 1, totalLaps)).toBe(0)
  })

  it('Entre 2 voltas e 25% da distância: apenas Top 5 pontuam (6, 4, 3, 2, 1)', () => {
    // 10 voltas em 50 = 20% (<= 25%)
    expect(calculateFiaPoints(1, 10, totalLaps)).toBe(6)
    expect(calculateFiaPoints(2, 10, totalLaps)).toBe(4)
    expect(calculateFiaPoints(3, 10, totalLaps)).toBe(3)
    expect(calculateFiaPoints(4, 10, totalLaps)).toBe(2)
    expect(calculateFiaPoints(5, 10, totalLaps)).toBe(1)
    expect(calculateFiaPoints(6, 10, totalLaps)).toBe(0)
    expect(calculateFiaPoints(10, 10, totalLaps)).toBe(0)

    // Exatamente 25% (ex: 25 em 100)
    expect(calculateFiaPoints(1, 25, 100)).toBe(6)
    expect(calculateFiaPoints(5, 25, 100)).toBe(1)
    expect(calculateFiaPoints(6, 25, 100)).toBe(0)

    // Exatamente 2 voltas
    expect(calculateFiaPoints(1, 2, totalLaps)).toBe(6)
  })

  it('Entre 25% e 50% da distância: Top 9 pontuam (13, 10, 8, 6, 5, 4, 3, 2, 1)', () => {
    // 20 voltas em 50 = 40% (> 25% e <= 50%)
    expect(calculateFiaPoints(1, 20, totalLaps)).toBe(13)
    expect(calculateFiaPoints(2, 20, totalLaps)).toBe(10)
    expect(calculateFiaPoints(3, 20, totalLaps)).toBe(8)
    expect(calculateFiaPoints(4, 20, totalLaps)).toBe(6)
    expect(calculateFiaPoints(5, 20, totalLaps)).toBe(5)
    expect(calculateFiaPoints(6, 20, totalLaps)).toBe(4)
    expect(calculateFiaPoints(7, 20, totalLaps)).toBe(3)
    expect(calculateFiaPoints(8, 20, totalLaps)).toBe(2)
    expect(calculateFiaPoints(9, 20, totalLaps)).toBe(1)
    expect(calculateFiaPoints(10, 20, totalLaps)).toBe(0)

    // Exatamente 50% (ex: 50 em 100)
    expect(calculateFiaPoints(1, 50, 100)).toBe(13)
    expect(calculateFiaPoints(9, 50, 100)).toBe(1)
    expect(calculateFiaPoints(10, 50, 100)).toBe(0)
  })

  it('Entre 50% e 75% da distância: Top 10 pontuam (19, 14, 12, 10, 8, 6, 5, 3, 2, 1)', () => {
    // 35 voltas em 50 = 70% (> 50% e <= 75%)
    expect(calculateFiaPoints(1, 35, totalLaps)).toBe(19)
    expect(calculateFiaPoints(2, 35, totalLaps)).toBe(14)
    expect(calculateFiaPoints(3, 35, totalLaps)).toBe(12)
    expect(calculateFiaPoints(4, 35, totalLaps)).toBe(10)
    expect(calculateFiaPoints(5, 35, totalLaps)).toBe(8)
    expect(calculateFiaPoints(6, 35, totalLaps)).toBe(6)
    expect(calculateFiaPoints(7, 35, totalLaps)).toBe(5)
    expect(calculateFiaPoints(8, 35, totalLaps)).toBe(3)
    expect(calculateFiaPoints(9, 35, totalLaps)).toBe(2)
    expect(calculateFiaPoints(10, 35, totalLaps)).toBe(1)
    expect(calculateFiaPoints(11, 35, totalLaps)).toBe(0)

    // Exatamente 75% (ex: 75 em 100)
    expect(calculateFiaPoints(1, 75, 100)).toBe(19)
    expect(calculateFiaPoints(10, 75, 100)).toBe(1)
    expect(calculateFiaPoints(11, 75, 100)).toBe(0)
  })

  it('Mais de 75% da distância: pontuação cheia (25, 18, 15, 12, 10, 8, 6, 4, 2, 1)', () => {
    // 40 voltas em 50 = 80% (> 75%)
    expect(calculateFiaPoints(1, 40, totalLaps)).toBe(25)
    expect(calculateFiaPoints(2, 40, totalLaps)).toBe(18)
    expect(calculateFiaPoints(3, 40, totalLaps)).toBe(15)
    expect(calculateFiaPoints(4, 40, totalLaps)).toBe(12)
    expect(calculateFiaPoints(5, 40, totalLaps)).toBe(10)
    expect(calculateFiaPoints(6, 40, totalLaps)).toBe(8)
    expect(calculateFiaPoints(7, 40, totalLaps)).toBe(6)
    expect(calculateFiaPoints(8, 40, totalLaps)).toBe(4)
    expect(calculateFiaPoints(9, 40, totalLaps)).toBe(2)
    expect(calculateFiaPoints(10, 40, totalLaps)).toBe(1)
    expect(calculateFiaPoints(11, 40, totalLaps)).toBe(0)
  })

  it('canonicalRaceResultService exporta calculateFiaPoints', () => {
    expect(canonicalRaceResultService).toBeDefined()
  })
})
