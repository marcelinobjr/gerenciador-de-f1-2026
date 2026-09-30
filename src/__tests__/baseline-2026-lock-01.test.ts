import { describe, it, expect } from 'vitest'
import {
  BASELINE_2026_V1_TEAMS,
  BASELINE_2026_V1_ORDER,
  BASELINE_2026_V1_METADATA,
} from '@/data/baseline-2026-v1'
import { structuralStrengthService } from '@/services/structuralStrengthService'

describe('BASELINE-2026-LOCK-01 — Checkpoint 1 (BL26-01..05)', () => {
  it('BL26-01: baseline exata 12 equipes', () => {
    expect(Object.keys(BASELINE_2026_V1_TEAMS)).toHaveLength(12)
    expect(BASELINE_2026_V1_ORDER).toHaveLength(12)
  })

  it('BL26-02: ordem estrutural correta', () => {
    const scores = BASELINE_2026_V1_ORDER.map((key) => {
      const team = structuralStrengthService.getTeamStructuralStrength(key)
      return { key, score: team.structuralStrengthScore }
    })

    // Garante que cada posição subsequente é menor ou igual à anterior
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i].score).toBeGreaterThan(scores[i + 1].score)
    }

    // Lista exata esperada
    expect(scores.map((s) => s.key)).toEqual([
      'mercedes',
      'mclaren',
      'ferrari',
      'redbull',
      'racingbulls',
      'alpine',
      'audi',
      'haas',
      'williams',
      'astonmartin',
      'cadillac',
      'andretti',
    ])
  })

  it('BL26-03: Mercedes = 100', () => {
    const merc = structuralStrengthService.getTeamStructuralStrength('mercedes')
    expect(merc.structuralStrengthScore).toBe(100)
    expect(BASELINE_2026_V1_TEAMS.mercedes.score).toBe(100)
  })

  it('BL26-04: Andretti = 69', () => {
    const andretti = structuralStrengthService.getTeamStructuralStrength('andretti')
    expect(andretti.structuralStrengthScore).toBe(69)
    expect(BASELINE_2026_V1_TEAMS.andretti.score).toBe(69)
  })

  it('BL26-05: spread estrutural ~2.48s', () => {
    const merc = structuralStrengthService.getTeamStructuralStrength('mercedes')
    const andretti = structuralStrengthService.getTeamStructuralStrength('andretti')
    const ptDelta = merc.structuralStrengthScore - andretti.structuralStrengthScore
    expect(ptDelta).toBe(31)

    const secSpread = Number(
      (ptDelta * BASELINE_2026_V1_METADATA.timeConversionSecPerPoint).toFixed(2),
    )
    expect(secSpread).toBe(2.48)
  })
})
