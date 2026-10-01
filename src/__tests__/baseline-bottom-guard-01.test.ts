import { describe, it, expect } from 'vitest'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { BASELINE_2026_V1_TEAMS, BASELINE_2026_V1_ORDER } from '@/data/baseline-2026-v1'

describe('BASELINE-BOTTOM-GUARD-01 — Suíte BGB01', () => {
  // BGB01R-01: ranking inicial possui 12 equipes inscritas canônicas
  it('BGB01R-01: ranking inicial possui 12 equipes inscritas canônicas', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    expect(grid2026).toHaveLength(12)
  })

  // BGB01R-02: ranking é determinístico
  it('BGB01R-02: ranking é determinístico', () => {
    const report1 = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const report2 = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid1 = report1.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    const grid2 = report2.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    expect(grid1.map((t) => ({ key: t.teamKey, score: t.structuralStrengthScore }))).toEqual(
      grid2.map((t) => ({ key: t.teamKey, score: t.structuralStrengthScore })),
    )
  })

  // BGB01R-03: Williams está em P10, P11 ou P12
  it('BGB01R-03: Williams está em P10, P11 ou P12', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    const bottom3Keys = grid2026.slice(-3).map((t) => t.teamKey)
    expect(bottom3Keys).toContain('williams')
  })

  // BGB01R-04: Cadillac está em P10, P11 ou P12
  it('BGB01R-04: Cadillac está em P10, P11 ou P12', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    const bottom3Keys = grid2026.slice(-3).map((t) => t.teamKey)
    expect(bottom3Keys).toContain('cadillac')
  })

  // BGB01R-05: Haas está em P10, P11 ou P12
  it('BGB01R-05: Haas está em P10, P11 ou P12', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    const bottom3Keys = grid2026.slice(-3).map((t) => t.teamKey)
    expect(bottom3Keys).toContain('haas')
  })

  // BGB01R-06: set(P10,P11,P12) é EXATAMENTE {Williams, Cadillac, Haas}
  it('BGB01R-06: set(P10,P11,P12) é EXATAMENTE {Williams, Cadillac, Haas}', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    const bottom3Keys = grid2026.slice(-3).map((t) => t.teamKey)
    expect(new Set(bottom3Keys)).toEqual(new Set(['williams', 'cadillac', 'haas']))
  })

  // BGB01R-07: Aston Martin NÃO está no bottom 3
  it('BGB01R-07: Aston Martin NÃO está no bottom 3', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    const bottom3Keys = grid2026.slice(-3).map((t) => t.teamKey)
    expect(bottom3Keys).not.toContain('astonmartin')
  })

  // BGB01R-08: Andretti NÃO está no bottom 3
  it('BGB01R-08: Andretti NÃO está no bottom 3', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    const bottom3Keys = grid2026.slice(-3).map((t) => t.teamKey)
    expect(bottom3Keys).not.toContain('andretti')
  })

  // BGB01R-09: nenhum teamName conditional produz o ranking
  it('BGB01R-09: nenhum teamName conditional produz o ranking', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    expect(report.teamNameBonuses).toBe(0)
    expect(report.duplicateFactors).toBe(0)
  })

  // BGB01R-10: após melhoria estrutural controlada de Williams OU Cadillac OU Haas, a equipe pode sair do bottom 3
  it('BGB01R-10: após melhoria estrutural controlada de Williams OU Cadillac OU Haas, a equipe pode sair do bottom 3', () => {
    const targetKeys = ['williams', 'cadillac', 'haas'] as const
    const reportInitial = structuralStrengthService.auditStructuralStrengthSystem({
      seasonYear: 2026,
    })
    const grid2026Initial = reportInitial.rankings.filter(
      (t) => t.teamKey in BASELINE_2026_V1_TEAMS,
    )
    const p9Score = grid2026Initial[grid2026Initial.length - 4]?.structuralStrengthScore ?? 80

    for (const key of targetKeys) {
      const baseline = structuralStrengthService.getTeamStructuralStrength(key, {
        seasonYear: 2026,
      })
      const initialComponents = baseline.technicalBreakdown.componentsMap
      const upgradedComponents: Record<string, number> = {}
      for (const [partKey, val] of Object.entries(initialComponents)) {
        upgradedComponents[partKey] = val + 15
      }

      const upgradedTeam = structuralStrengthService.calculateStructuralStrength({
        teamKey: key,
        teamName: baseline.teamName,
        components: upgradedComponents,
        effectivePuRating: baseline.technicalBreakdown.effectivePuScore + 10,
        reliability: baseline.technicalBreakdown.reliabilityScore,
        condition: baseline.technicalBreakdown.conditionScore,
        puSupplier: baseline.technicalBreakdown.puSupplier,
        effectiveIntegration: baseline.technicalBreakdown.effectiveIntegration,
        nominalPuRating: baseline.technicalBreakdown.nominalPuRating,
        drivers: baseline.driverBreakdown.drivers,
        facilities: baseline.teamBreakdown.facilitiesLevels,
        teamMorale: baseline.teamBreakdown.teamMoraleScore,
      })

      // Prova que com melhoria estrutural a equipe supera o corte do bottom 3 e pode sair
      expect(upgradedTeam.structuralStrengthScore).toBeGreaterThan(p9Score)
      expect(upgradedTeam.structuralStrengthScore).toBeGreaterThan(baseline.structuralStrengthScore)
    }
  })
})
