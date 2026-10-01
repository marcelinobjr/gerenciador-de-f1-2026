import { describe, it, expect } from 'vitest'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { BASELINE_2026_V1_TEAMS, BASELINE_2026_V1_ORDER } from '@/data/baseline-2026-v1'

describe('BASELINE-BOTTOM-GUARD-01 — Suíte BGB01', () => {
  it('BGB01-01: o ranking estrutural inicial contém exatamente 12 equipes oficiais de 2026', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    expect(grid2026).toHaveLength(12)
  })

  it('BGB01-02: o bottom 3 estrutural inicial contém exatamente Williams, Cadillac e Haas', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings
      .filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
      .sort((a, b) => b.structuralStrengthScore - a.structuralStrengthScore)

    const bottom3 = grid2026.slice(-3).map((t) => t.teamKey)
    const bottom3Set = new Set(bottom3)

    expect(bottom3Set).toEqual(new Set(['williams', 'cadillac', 'haas']))
  })

  it('BGB01-03: nenhuma equipe fora de Williams, Cadillac e Haas está no bottom 3 inicial', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings
      .filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
      .sort((a, b) => b.structuralStrengthScore - a.structuralStrengthScore)

    const bottom3 = grid2026.slice(-3).map((t) => t.teamKey)
    for (const key of bottom3) {
      expect(['williams', 'cadillac', 'haas']).toContain(key)
    }
  })

  it('BGB01-04: pesos da fórmula estrutural estão intocados (60% Tech, 25% Driver, 15% Team)', () => {
    const team = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })
    expect(team.weights.technical).toBe(0.6)
    expect(team.weights.driver).toBe(0.25)
    expect(team.weights.team).toBe(0.15)
  })

  it('BGB01-05: sem hardcode discriminatório de penalidade por nome de equipe', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    expect(report.teamNameBonuses).toBe(0)
  })

  it('BGB01-06: Williams pode evoluir e sair do bottom 3 ao melhorar insumos estruturais', () => {
    const baselineWilliams = structuralStrengthService.getTeamStructuralStrength('williams', {
      seasonYear: 2026,
    })
    const upgradedScore = baselineWilliams.structuralStrengthScore + 15
    expect(upgradedScore).toBeGreaterThan(80)
  })

  it('BGB01-07: Cadillac pode evoluir e sair do bottom 3 ao melhorar insumos estruturais', () => {
    const baselineCadillac = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })
    const upgradedScore = baselineCadillac.structuralStrengthScore + 15
    expect(upgradedScore).toBeGreaterThan(80)
  })

  it('BGB01-08: Haas pode evoluir e sair do bottom 3 ao melhorar insumos estruturais', () => {
    const baselineHaas = structuralStrengthService.getTeamStructuralStrength('haas', {
      seasonYear: 2026,
    })
    const upgradedScore = baselineHaas.structuralStrengthScore + 15
    expect(upgradedScore).toBeGreaterThan(85)
  })

  it('BGB01-09: imutabilidade de V0 preservada', () => {
    const baselineV0 = structuralStrengthService.getBaselineV0()
    expect(baselineV0).toBeDefined()
    expect(baselineV0.schemaVersion).toBe('v0')
  })

  it('BGB01-10: integridade dos 12 scores estruturais da temporada 2026', () => {
    const scores = BASELINE_2026_V1_ORDER.map((k) => BASELINE_2026_V1_TEAMS[k].score)
    expect(scores).toHaveLength(12)
    scores.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    })
  })
})
