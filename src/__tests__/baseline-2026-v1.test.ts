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

  // BL26-02: ordem estrutural exata: Mercedes > Ferrari > McLaren > Red Bull > Racing Bulls >= Alpine > Audi > Haas > Williams > Aston Martin > Cadillac > Andretti
  it('BL26-02: ordem estrutural exata: Mercedes > Ferrari > McLaren > Red Bull > Racing Bulls >= Alpine > Audi > Haas > Williams > Aston Martin > Cadillac > Andretti', () => {
    const expectedOrder = [
      'mercedes',
      'ferrari',
      'mclaren',
      'redbull',
      'racingbulls',
      'alpine',
      'audi',
      'haas',
      'williams',
      'astonmartin',
      'cadillac',
      'andretti',
    ]

    expect([...BASELINE_2026_V1_ORDER]).toEqual(expectedOrder)

    const scores = BASELINE_2026_V1_ORDER.map((k) => BASELINE_2026_V1_TEAMS[k].score)
    expect(scores).toEqual([100, 98, 96, 94, 87, 87, 86, 75, 70, 60, 50, 45])

    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
    }
  })

  // BL26-03: Mercedes = 100
  it('BL26-03: Mercedes = 100', () => {
    expect(BASELINE_2026_V1_TEAMS.mercedes.score).toBe(100)
    expect(BASELINE_2026_V1_TEAMS.mercedes.rank).toBe(1)
  })

  // BL26-04: Bottom 3: Aston Martin = 60 (P10), Cadillac = 50 (P11), Andretti = 45 (P12) e Haas = 75 (P8), Williams = 70 (P9)
  it('BL26-04: Bottom 3: Aston Martin = 60 (P10), Cadillac = 50 (P11), Andretti = 45 (P12) e Haas = 75 (P8), Williams = 70 (P9)', () => {
    expect(BASELINE_2026_V1_TEAMS.andretti.score).toBe(45)
    expect(BASELINE_2026_V1_TEAMS.andretti.rank).toBe(12)
    expect(BASELINE_2026_V1_TEAMS.cadillac.score).toBe(50)
    expect(BASELINE_2026_V1_TEAMS.cadillac.rank).toBe(11)
    expect(BASELINE_2026_V1_TEAMS.astonmartin.score).toBe(60)
    expect(BASELINE_2026_V1_TEAMS.astonmartin.rank).toBe(10)
    expect(BASELINE_2026_V1_TEAMS.williams.score).toBe(70)
    expect(BASELINE_2026_V1_TEAMS.williams.rank).toBe(9)
    expect(BASELINE_2026_V1_TEAMS.haas.score).toBe(75)
    expect(BASELINE_2026_V1_TEAMS.haas.rank).toBe(8)
  })

  // BL26-05: spread estrutural = 55 pontos e equivalente aproximado: 55 × 0.08 = 4.40s
  it('BL26-05: spread estrutural = 55 pontos e equivalente aproximado: 55 × 0.08 = 4.40s', () => {
    const spreadPts = BASELINE_2026_V1_TEAMS.mercedes.score - BASELINE_2026_V1_TEAMS.andretti.score
    expect(spreadPts).toBe(55)
    expect(BASELINE_2026_V1_METADATA.pointSpread).toBe(55)

    const spreadSec = spreadPts * BASELINE_2026_V1_METADATA.timeConversionSecPerPoint
    expect(Number(spreadSec.toFixed(2))).toBe(4.4)
    expect(BASELINE_2026_V1_METADATA.targetSpreadSec).toBe(4.4)
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
