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
    expect(andretti.baselineAnchorScore).toBe(79)
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

  // BL26-CP2-03: Haas = 69 (P12), Cadillac = 72 (P11), Williams = 75 (P10)
  it('BL26-CP2-03: Haas = 69 (P12), Cadillac = 72 (P11), Williams = 75 (P10)', () => {
    const haas = structuralStrengthService.getTeamStructuralStrength('haas', {
      seasonYear: 2026,
    })
    expect(haas.structuralStrengthScore).toBe(69)
    expect(haas.baselineAnchorScore).toBe(69)
    expect(haas.baselineOrigin).toBe('BASELINE_2026_V1')

    const cadillac = structuralStrengthService.getTeamStructuralStrength('cadillac', {
      seasonYear: 2026,
    })
    expect(cadillac.structuralStrengthScore).toBe(72)
    expect(cadillac.baselineAnchorScore).toBe(72)
    expect(cadillac.baselineOrigin).toBe('BASELINE_2026_V1')

    const williams = structuralStrengthService.getTeamStructuralStrength('williams', {
      seasonYear: 2026,
    })
    expect(williams.structuralStrengthScore).toBe(75)
    expect(williams.baselineAnchorScore).toBe(75)
    expect(williams.baselineOrigin).toBe('BASELINE_2026_V1')
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

  // BL26-CP2-05: season != 2026 preserva V0
  it('BL26-CP2-05: season != 2026 preserva V0 sem ativação de âncora', () => {
    const merc2025 = structuralStrengthService.getTeamStructuralStrength('mercedes', {
      seasonYear: 2025,
    })
    expect(merc2025.baselineOrigin).toBeUndefined()
    expect(merc2025.baselineAnchorScore).toBeUndefined()

    const audi2027 = structuralStrengthService.getTeamStructuralStrength('audi', {
      seasonYear: 2027,
    })
    expect(audi2027.baselineOrigin).toBeUndefined()
    expect(audi2027.baselineAnchorScore).toBeUndefined()
  })

  // BL26-CP2-06: equipe fora das 12 preserva V0
  it('BL26-CP2-06: equipe fora das 12 preserva V0', () => {
    // Exemplo de equipes V0 fora das 12 canônicas de 2026 (ex: lotus, sauber, dallara, custom_team)
    const customTeam = structuralStrengthService.getTeamStructuralStrength('custom_team', {
      seasonYear: 2026,
    })
    expect(customTeam.baselineOrigin).toBeUndefined()
    expect(customTeam.baselineAnchorScore).toBeUndefined()

    const lotus = structuralStrengthService.getTeamStructuralStrength('lotus', {
      seasonYear: 2026,
    })
    expect(lotus.baselineOrigin).toBeUndefined()
    expect(lotus.baselineAnchorScore).toBeUndefined()
  })

  // BL26-CP2-07: Audi 84 + melhoria técnica controlada → score > 84 (âncora não trava evolução)
  it('BL26-CP2-07: Audi 84 + melhoria técnica controlada -> score > 84 (âncora não trava evolução)', () => {
    const audiInitial = structuralStrengthService.getTeamStructuralStrength('audi', {
      seasonYear: 2026,
    })
    expect(audiInitial.structuralStrengthScore).toBe(84)

    // Simula uma evolução técnica (ex: upgrade de chassis/PU) a partir dos componentes iniciais da Audi
    const initialComponents = audiInitial.technicalBreakdown.componentsMap
    const upgradedComponents: Record<string, number> = {}
    for (const [k, v] of Object.entries(initialComponents)) {
      upgradedComponents[k] = v + 10 // +10 pontos em todas as partes do carro
    }

    const evolvedBreakdown = structuralStrengthService.calculateStructuralStrength({
      teamKey: 'audi',
      teamName: 'Audi F1 Team',
      components: upgradedComponents,
      effectivePuRating: audiInitial.technicalBreakdown.effectivePuScore + 5, // +5 na PU
      reliability: audiInitial.technicalBreakdown.reliabilityScore,
      condition: audiInitial.technicalBreakdown.conditionScore,
      puSupplier: audiInitial.technicalBreakdown.puSupplier,
      effectiveIntegration: audiInitial.technicalBreakdown.effectiveIntegration,
      nominalPuRating: audiInitial.technicalBreakdown.nominalPuRating,
      drivers: audiInitial.driverBreakdown.drivers,
      facilities: audiInitial.teamBreakdown.facilitiesLevels,
      teamMorale: audiInitial.teamBreakdown.teamMoraleScore,
    })

    expect(evolvedBreakdown.structuralStrengthScore).toBeGreaterThan(84)
    expect(evolvedBreakdown.technicalScore).toBeGreaterThan(audiInitial.technicalScore)
  })

  // BL26-CP2-08: sem double-count (baseline calibrada via insumos canônicos, não somada como bônus)
  it('BL26-CP2-08: sem double-count (pesos canônicos 60/25/15 respeitados exatamente, sem bônus somado)', () => {
    for (const teamKey of BASELINE_2026_V1_ORDER) {
      const breakdown = structuralStrengthService.getTeamStructuralStrength(teamKey, {
        seasonYear: 2026,
      })

      // Verifica fórmula: TECH * 0.60 + DRIVER * 0.25 + TEAM * 0.15 == structuralStrengthScore
      const expectedWeightedSum =
        breakdown.technicalScore * 0.6 + breakdown.driverScore * 0.25 + breakdown.teamScore * 0.15

      // Diferença não pode exceder margem de arredondamento
      expect(Math.abs(expectedWeightedSum - breakdown.structuralStrengthScore)).toBeLessThanOrEqual(
        0.05,
      )

      // Confirma que os pesos oficiais são os aplicados
      expect(breakdown.weights.technical).toBe(0.6)
      expect(breakdown.weights.driver).toBe(0.25)
      expect(breakdown.weights.team).toBe(0.15)
    }
  })
})
