import { describe, it, expect } from 'vitest'
import { structuralStrengthService } from '@/services/structuralStrengthService'
import { BASELINE_2026_V1_TEAMS, BASELINE_2026_V1_ORDER } from '@/data/baseline-2026-v1'

describe('BASELINE-BOTTOM-GUARD-01 — Suíte BGB01', () => {
  // BGB01R-01: ranking possui 12 equipes
  it('BGB01R-01: ranking possui 12 equipes', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    expect(grid2026).toHaveLength(12)
  })

  // BGB01R-02: ranking inicial é determinístico
  it('BGB01R-02: ranking inicial é determinístico', () => {
    const report1 = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const report2 = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid1 = report1.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    const grid2 = report2.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    expect(grid1.map((t) => ({ key: t.teamKey, score: t.structuralStrengthScore }))).toEqual(
      grid2.map((t) => ({ key: t.teamKey, score: t.structuralStrengthScore })),
    )
  })

  // BGB01R-03: Mercedes = 100
  it('BGB01R-03: Mercedes = 100', () => {
    const merc = structuralStrengthService.getTeamStructuralStrength('mercedes', {
      seasonYear: 2026,
    })
    expect(merc.structuralStrengthScore).toBe(100)
    expect(merc.baselineAnchorScore).toBe(100)
  })

  // BGB01R-04: Ferrari = 98 e McLaren = 96
  it('BGB01R-04: Ferrari = 98 e McLaren = 96', () => {
    const ferrari = structuralStrengthService.getTeamStructuralStrength('ferrari', {
      seasonYear: 2026,
    })
    const mclaren = structuralStrengthService.getTeamStructuralStrength('mclaren', {
      seasonYear: 2026,
    })
    expect(ferrari.structuralStrengthScore).toBe(98)
    expect(mclaren.structuralStrengthScore).toBe(96)
  })

  // BGB01R-05: Red Bull = 94
  it('BGB01R-05: Red Bull = 94', () => {
    const redbull = structuralStrengthService.getTeamStructuralStrength('redbull', {
      seasonYear: 2026,
    })
    expect(redbull.structuralStrengthScore).toBe(94)
  })

  // BGB01R-06: Racing Bulls = 87 e Alpine = 87
  it('BGB01R-06: Racing Bulls = 87 e Alpine = 87', () => {
    const rb = structuralStrengthService.getTeamStructuralStrength('racingbulls', {
      seasonYear: 2026,
    })
    const alpine = structuralStrengthService.getTeamStructuralStrength('alpine', {
      seasonYear: 2026,
    })
    expect(rb.structuralStrengthScore).toBe(87)
    expect(alpine.structuralStrengthScore).toBe(87)
  })

  // BGB01R-07: Audi = 86, Haas = 75, Williams = 70
  it('BGB01R-07: Audi = 86, Haas = 75, Williams = 70', () => {
    const audi = structuralStrengthService.getTeamStructuralStrength('audi', {
      seasonYear: 2026,
    })
    const haas = structuralStrengthService.getTeamStructuralStrength('haas', {
      seasonYear: 2026,
    })
    const williams = structuralStrengthService.getTeamStructuralStrength('williams', {
      seasonYear: 2026,
    })
    expect(audi.structuralStrengthScore).toBe(86)
    expect(haas.structuralStrengthScore).toBe(75)
    expect(williams.structuralStrengthScore).toBe(70)
  })

  // BGB01R-08: Aston Martin = 60, Cadillac = 50, Andretti = 45
  it('BGB01R-08: Aston Martin = 60, Cadillac = 50, Andretti = 45', () => {
    const aston = structuralStrengthService.getTeamStructuralStrength('astonmartin', {
      seasonYear: 2026,
    })
    const cadillac = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })
    const andretti = structuralStrengthService.getTeamStructuralStrength('andretti', {
      seasonYear: 2026,
    })
    expect(aston.structuralStrengthScore).toBe(60)
    expect(cadillac.structuralStrengthScore).toBe(50)
    expect(andretti.structuralStrengthScore).toBe(45)
  })

  // BGB01R-09: set(P10,P11,P12) = Aston Martin / Cadillac / Andretti; nenhum runtime team-name modifier
  it('BGB01R-09: set(P10,P11,P12) = Aston Martin / Cadillac / Andretti; nenhum runtime team-name modifier', () => {
    const report = structuralStrengthService.auditStructuralStrengthSystem({ seasonYear: 2026 })
    const grid2026 = report.rankings.filter((t) => t.teamKey in BASELINE_2026_V1_TEAMS)
    const bottom3Keys = grid2026.slice(-3).map((t) => t.teamKey)
    expect(new Set(bottom3Keys)).toEqual(new Set(['astonmartin', 'cadillac', 'andretti']))
    expect(report.teamNameBonuses).toBe(0)
    expect(report.duplicateFactors).toBe(0)
  })

  // BGB01R-10: melhoria estrutural controlada pode alterar o ranking futuro — nenhuma equipe é presa à posição inicial
  it('BGB01R-10: melhoria estrutural controlada pode alterar o ranking futuro — nenhuma equipe é presa à posição inicial', () => {
    const targetKeys = ['astonmartin', 'cadillac', 'andretti'] as const
    const reportInitial = structuralStrengthService.auditStructuralStrengthSystem({
      seasonYear: 2026,
    })
    const grid2026Initial = reportInitial.rankings.filter(
      (t) => t.teamKey in BASELINE_2026_V1_TEAMS,
    )
    const p9Score = grid2026Initial[grid2026Initial.length - 4]?.structuralStrengthScore ?? 70

    for (const key of targetKeys) {
      const baseline = structuralStrengthService.getTeamStructuralStrength(key, {
        seasonYear: 2026,
      })
      const initialComponents = baseline.technicalBreakdown.componentsMap
      const upgradedComponents: Record<string, number> = {}
      for (const [partKey, val] of Object.entries(initialComponents)) {
        upgradedComponents[partKey] = val + 40
      }

      const upgradedTeam = structuralStrengthService.calculateStructuralStrength({
        teamKey: key,
        teamName: baseline.teamName,
        components: upgradedComponents,
        effectivePuRating: baseline.technicalBreakdown.effectivePuScore + 30,
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
