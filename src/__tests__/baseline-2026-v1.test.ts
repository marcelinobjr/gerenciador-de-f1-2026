import { describe, it, expect } from 'vitest'
import {
  BASELINE_2026_V1_TEAMS,
  BASELINE_2026_V1_ORDER,
  BASELINE_2026_V1_METADATA,
} from '@/data/baseline-2026-v1'
import { OFFICIAL_2026_GRID_KEYS, ALL_GRID_TEAMS_DATABASE } from '@/lib/grid-teams-database'

describe('BASELINE-2026-LOCK-01-CP1 — Suíte BL26-01..05 & Integridade', () => {
  // BL26-01: existem exatamente 12 equipes na baseline
  it('BL26-01: existem exatamente 12 equipes na baseline', () => {
    const keys = Object.keys(BASELINE_2026_V1_TEAMS)
    expect(keys).toHaveLength(12)
    expect(BASELINE_2026_V1_ORDER).toHaveLength(12)
  })

  // BL26-02: ordem estrutural exata: Mercedes > McLaren > Ferrari > Red Bull > Racing Bulls > Alpine > Audi > Aston Martin > Andretti > Haas > Williams > Cadillac
  it('BL26-02: ordem estrutural exata: Mercedes > McLaren > Ferrari > Red Bull > Racing Bulls > Alpine > Audi > Aston Martin > Andretti > Haas > Williams > Cadillac', () => {
    const expectedOrder = [
      'mercedes',
      'mclaren',
      'ferrari',
      'redbull',
      'racingbulls',
      'alpine',
      'audi',
      'astonmartin',
      'andretti',
      'haas',
      'williams',
      'cadillac',
    ]

    expect([...BASELINE_2026_V1_ORDER]).toEqual(expectedOrder)

    const scores = BASELINE_2026_V1_ORDER.map((k) => BASELINE_2026_V1_TEAMS[k].score)
    expect(scores).toEqual([100, 98, 96, 94, 90, 87, 84, 81, 79, 75, 72, 69])

    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i + 1])
    }
  })

  // BL26-03: Mercedes = 100
  it('BL26-03: Mercedes = 100', () => {
    expect(BASELINE_2026_V1_TEAMS.mercedes.score).toBe(100)
    expect(BASELINE_2026_V1_TEAMS.mercedes.rank).toBe(1)
  })

  // BL26-04: Cadillac = 69 (P12) e Andretti = 79 (P9)
  it('BL26-04: Cadillac = 69 (P12) e Andretti = 79 (P9)', () => {
    expect(BASELINE_2026_V1_TEAMS.cadillac.score).toBe(69)
    expect(BASELINE_2026_V1_TEAMS.cadillac.rank).toBe(12)
    expect(BASELINE_2026_V1_TEAMS.andretti.score).toBe(79)
    expect(BASELINE_2026_V1_TEAMS.andretti.rank).toBe(9)
  })

  // BL26-05: spread estrutural = 31 pontos e equivalente aproximado: 31 × 0.08 = 2.48s
  it('BL26-05: spread estrutural = 31 pontos e equivalente aproximado: 31 × 0.08 = 2.48s', () => {
    const spreadPts = BASELINE_2026_V1_TEAMS.mercedes.score - BASELINE_2026_V1_TEAMS.cadillac.score
    expect(spreadPts).toBe(31)
    expect(BASELINE_2026_V1_METADATA.pointSpread).toBe(31)

    const spreadSec = spreadPts * BASELINE_2026_V1_METADATA.timeConversionSecPerPoint
    expect(Number(spreadSec.toFixed(2))).toBe(2.48)
    expect(BASELINE_2026_V1_METADATA.targetSpreadSec).toBe(2.48)
  })

  // Asserts de integridade
  describe('Asserts de integridade do catálogo e limites', () => {
    it('nenhuma equipe duplicada na lista de chaves ou ordem', () => {
      const keys = Object.keys(BASELINE_2026_V1_TEAMS)
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)

      const orderList = [...BASELINE_2026_V1_ORDER]
      const uniqueOrder = new Set(orderList)
      expect(uniqueOrder.size).toBe(orderList.length)
    })

    it('nenhuma nota fora de 0–100', () => {
      Object.entries(BASELINE_2026_V1_TEAMS).forEach(([key, entry]) => {
        expect(entry.score).toBeGreaterThanOrEqual(0)
        expect(entry.score).toBeLessThanOrEqual(100)
      })
    })

    it('todas as chaves correspondem a equipes válidas do catálogo oficial de 2026', () => {
      const catalogKeys = new Set(ALL_GRID_TEAMS_DATABASE.map((t) => t.key))
      const officialGridSet = new Set(OFFICIAL_2026_GRID_KEYS)

      Object.keys(BASELINE_2026_V1_TEAMS).forEach((key) => {
        expect(catalogKeys.has(key)).toBe(true)
        expect(officialGridSet.has(key)).toBe(true)
      })
    })

    it('nenhuma das 12 equipes oficiais está ausente da baseline', () => {
      OFFICIAL_2026_GRID_KEYS.forEach((officialKey) => {
        expect(BASELINE_2026_V1_TEAMS[officialKey]).toBeDefined()
        expect(BASELINE_2026_V1_ORDER).toContain(officialKey)
      })
    })
  })
})
