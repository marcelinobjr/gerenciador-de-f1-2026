import { describe, it, expect } from 'vitest'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { BASELINE_2026_V1_TEAMS, BASELINE_2026_V1_ORDER } from '@/data/baseline-2026-v1'

describe('BASELINE-2026-LOCK-01-CP2 — Suíte BL26-CP2-01..04 (Fase 1)', () => {
  // BL26-CP2-01: 2026 usa a baseline, via breakdown.baselineOrigin
  it('BL26-CP2-01: 2026 usa a baseline, via breakdown.baselineOrigin', () => {
    const mercedes = structuralStrengthService.getTeamStructuralStrength('mercedes', {
      seasonYear: 2026,
    })
    expect(mercedes.baselineOrigin).toBe('BASELINE_2026_V1')
    expect(mercedes.baselineAnchorScore).toBe(100)

    const audi = structuralStrengthService.getTeamStructuralStrength('audi', {
      seasonYear: 2026,
    })
    expect(audi.baselineOrigin).toBe('BASELINE_2026_V1')
    expect(audi.baselineAnchorScore).toBe(84)

    const andretti = structuralStrengthService.getTeamStructuralStrength('andretti', {
      seasonYear: 2026,
    })
    expect(andretti.baselineOrigin).toBe('BASELINE_2026_V1')
    expect(andretti.baselineAnchorScore).toBe(69)
  })

  // BL26-CP2-02: Mercedes = 100
  it('BL26-CP2-02: Mercedes = 100', () => {
    const mercedes = structuralStrengthService.getTeamStructuralStrength('mercedes', {
      seasonYear: 2026,
    })
    expect(mercedes.structuralStrengthScore).toBe(100)
    expect(mercedes.baselineAnchorScore).toBe(100)
    expect(mercedes.baselineOrigin).toBe('BASELINE_2026_V1')
  })

  // BL26-CP2-03: Andretti = 69
  it('BL26-CP2-03: Andretti = 69', () => {
    const andretti = structuralStrengthService.getTeamStructuralStrength('andretti', {
      seasonYear: 2026,
    })
    expect(andretti.structuralStrengthScore).toBe(69)
    expect(andretti.baselineAnchorScore).toBe(69)
    expect(andretti.baselineOrigin).toBe('BASELINE_2026_V1')
  })

  // BL26-CP2-04: ordem exata das 12
  it('BL26-CP2-04: ordem exata das 12 equipes em 2026', () => {
    const scores = BASELINE_2026_V1_ORDER.map((teamKey) => {
      const breakdown = structuralStrengthService.getTeamStructuralStrength(teamKey, {
        seasonYear: 2026,
      })
      return {
        teamKey,
        score: breakdown.structuralStrengthScore,
        anchor: breakdown.baselineAnchorScore,
        origin: breakdown.baselineOrigin,
      }
    })

    const expectedScores = [100, 98, 96, 94, 90, 87, 84, 81, 79, 75, 72, 69]

    scores.forEach((entry, idx) => {
      expect(entry.score).toBe(expectedScores[idx])
      expect(entry.anchor).toBe(expectedScores[idx])
      expect(entry.origin).toBe('BASELINE_2026_V1')
    })

    // Confirma ordem estritamente decrescente
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i].score).toBeGreaterThan(scores[i + 1].score)
    }
  })
})
